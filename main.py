import hashlib
import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from functools import wraps
from threading import RLock
from urllib.parse import quote, urlsplit, urlunsplit

import click
from flask import (
    Flask,
    abort,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_bootstrap import Bootstrap5
from flask_ckeditor import CKEditor
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_user,
    logout_user,
)
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect
from markupsafe import Markup, escape
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func, inspect, select, text
from sqlalchemy.exc import IntegrityError, NoSuchTableError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

from forms import ActionForm, CommentForm, CreatePostForm, LoginForm, RegisterForm

try:
    import bleach
except ImportError:  # pragma: no cover - bleach is optional at runtime.
    bleach = None


POST_ALLOWED_TAGS = {
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "ul",
}
COMMENT_ALLOWED_TAGS = {"a", "blockquote", "br", "code", "em", "li", "ol", "p", "pre", "strong", "ul"}
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "rel"],
    "img": ["src", "alt", "title"],
}
ALLOWED_PROTOCOLS = {"http", "https", "mailto"}
UNSAFE_URL_CHARACTERS = {'"', "'", "(", ")", "\\", "\n", "\r", "<", ">"}


class Base(DeclarativeBase):
    pass


bootstrap = Bootstrap5()
ckeditor = CKEditor()
csrf = CSRFProtect()
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
migrate = Migrate(compare_type=True)


class DatabaseBackedRateLimiter:
    def __init__(self):
        self._locks = defaultdict(RLock)

    def init_app(self, app):
        app.extensions["memory_rate_limiter"] = defaultdict(deque)

    def is_allowed(self, app, scope, identifier, limit, window_seconds):
        if rate_limit_events_table_exists():
            try:
                return self._is_allowed_db(scope, identifier, limit, window_seconds)
            except Exception:
                db.session.rollback()
                app.logger.exception("Falling back to in-memory rate limiting due to datastore error.")

        bucket_key = f"{scope}:{identifier}"
        return self._is_allowed_memory(app, bucket_key, limit, window_seconds)

    def _is_allowed_memory(self, app, bucket_key, limit, window_seconds):
        buckets = app.extensions["memory_rate_limiter"]
        lock = self._locks[bucket_key]
        now = time.time()

        with lock:
            bucket = buckets[bucket_key]
            while bucket and now - bucket[0] > window_seconds:
                bucket.popleft()

            if len(bucket) >= limit:
                return False

            bucket.append(now)
            return True

    def _is_allowed_db(self, scope, identifier, limit, window_seconds):
        now = datetime.now(UTC)
        window_start = now - timedelta(seconds=window_seconds)
        retention_cutoff = now - timedelta(seconds=current_app.config["RATE_LIMIT_RETENTION_SECONDS"])
        identifier_hash = hash_rate_limit_identifier(scope, identifier)
        lock = self._locks[f"db:{identifier_hash}"]

        with lock:
            db.session.execute(
                text("DELETE FROM rate_limit_events WHERE created_at < :retention_cutoff"),
                {"retention_cutoff": retention_cutoff},
            )
            current_count = db.session.execute(
                select(func.count(RateLimitEvent.id)).where(
                    RateLimitEvent.scope == scope,
                    RateLimitEvent.identifier_hash == identifier_hash,
                    RateLimitEvent.created_at >= window_start,
                )
            ).scalar_one()

            if current_count >= limit:
                db.session.commit()
                return False

            db.session.add(
                RateLimitEvent(
                    scope=scope,
                    identifier_hash=identifier_hash,
                    created_at=now,
                )
            )
            db.session.commit()
            return True


rate_limiter = DatabaseBackedRateLimiter()


@dataclass(slots=True)
class CommentAuthorSnapshot:
    email: str
    name: str


@dataclass(slots=True)
class CommentSnapshot:
    id: int
    text: str
    author: CommentAuthorSnapshot
    timestamp: datetime | None = None


class BlogPost(db.Model):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(250), unique=True, nullable=False)
    subtitle: Mapped[str] = mapped_column(String(250), nullable=False)
    date: Mapped[str] = mapped_column(String(250), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    img_url: Mapped[str] = mapped_column(String(250), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    author: Mapped["User"] = relationship("User", back_populates="posts")
    comments: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan",
    )


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(250), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(250), nullable=False)
    name: Mapped[str] = mapped_column(String(250), nullable=False)

    posts: Mapped[list[BlogPost]] = relationship("BlogPost", back_populates="author")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="author")

    @property
    def has_admin_access(self):
        admin_email = current_app.config.get("ADMIN_EMAIL", "")
        if admin_email and normalize_email(self.email) == admin_email:
            return True

        if not self.id or not users_table_has_is_admin_column():
            return False

        result = db.session.execute(
            text("SELECT is_admin FROM users WHERE id = :user_id"),
            {"user_id": self.id},
        ).scalar_one_or_none()
        return bool(result)


class Comment(db.Model):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    post_id: Mapped[int] = mapped_column(ForeignKey("blog_posts.id"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    author: Mapped[User] = relationship("User", back_populates="comments")
    post: Mapped[BlogPost] = relationship("BlogPost", back_populates="comments")
    parent: Mapped["Comment | None"] = relationship(
        "Comment",
        remote_side=[id],
        back_populates="replies",
    )
    replies: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
    )


class RateLimitEvent(db.Model):
    __tablename__ = "rate_limit_events"
    __table_args__ = (
        Index(
            "ix_rate_limit_events_scope_identifier_created_at",
            "scope",
            "identifier_hash",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scope: Mapped[str] = mapped_column(String(50), nullable=False)
    identifier_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def _is_truthy(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _is_production_environment():
    env_name = (os.getenv("FLASK_ENV") or os.getenv("APP_ENV") or "").lower()
    return bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL") or env_name == "production")


def _normalize_database_uri(database_uri):
    if database_uri and database_uri.startswith("postgres://"):
        return database_uri.replace("postgres://", "postgresql://", 1)
    return database_uri


def _get_database_uri(test_config, production):
    if test_config and test_config.get("SQLALCHEMY_DATABASE_URI"):
        return test_config["SQLALCHEMY_DATABASE_URI"]

    database_uri = _normalize_database_uri(os.getenv("DB_URI") or os.getenv("DATABASE_URL"))
    if database_uri:
        return database_uri

    if production:
        raise RuntimeError("DB_URI must be set in production. Refusing to fall back to SQLite.")

    return "sqlite:///posts.db"


def _get_secret_key(test_config, production):
    if test_config and test_config.get("SECRET_KEY"):
        return test_config["SECRET_KEY"]

    secret_key = os.getenv("FLASK_KEY")
    if secret_key:
        return secret_key

    if production:
        raise RuntimeError("FLASK_KEY must be set in production.")

    return "dev-only-change-me"


def normalize_email(email):
    return (email or "").strip().lower()


def sanitize_html(value, allowed_tags):
    raw_value = value or ""
    if bleach is None:
        return str(escape(raw_value))

    return bleach.clean(
        raw_value,
        tags=allowed_tags,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )


def sanitize_post_html_for_storage(value):
    if bleach is None:
        return value or ""
    return sanitize_html(value, POST_ALLOWED_TAGS)


def sanitize_comment_html_for_storage(value):
    if bleach is None:
        return value or ""
    return sanitize_html(value, COMMENT_ALLOWED_TAGS)


def render_post_html(value):
    return Markup(sanitize_html(value, POST_ALLOWED_TAGS))


def render_comment_html(value):
    return Markup(sanitize_html(value, COMMENT_ALLOWED_TAGS))


def gravatar_url(email, size=100):
    normalized_email = normalize_email(email).encode("utf-8")
    email_hash = hashlib.md5(normalized_email, usedforsecurity=False).hexdigest()
    return f"https://www.gravatar.com/avatar/{email_hash}?s={size}&d=retro&r=g"


def get_table_columns(table_name):
    cache = current_app.extensions.setdefault("schema_cache", {})
    cache_key = f"{table_name}_columns"
    if cache_key not in cache:
        try:
            cache[cache_key] = {column["name"] for column in inspect(db.engine).get_columns(table_name)}
        except NoSuchTableError:
            return set()
        except Exception:
            current_app.logger.exception("Unable to inspect table metadata for %s.", table_name)
            return set()
    return cache[cache_key]


def users_table_has_is_admin_column():
    return "is_admin" in get_table_columns("users")


def rate_limit_events_table_exists():
    return bool(get_table_columns("rate_limit_events"))


def hash_rate_limit_identifier(scope, identifier):
    secret = (current_app.secret_key or "").encode("utf-8")
    payload = f"{scope}:{identifier}".encode("utf-8")
    return hashlib.sha256(secret + b":" + payload).hexdigest()


def safe_external_image_url(value):
    candidate = (value or "").strip()
    if not candidate or any(char in candidate for char in UNSAFE_URL_CHARACTERS):
        return None

    parts = urlsplit(candidate)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return None
    if parts.username or parts.password:
        return None

    safe_path = quote(parts.path or "/", safe="/%:@-._~!$&*+,;=")
    safe_query = quote(parts.query, safe="=&%:@-._~!$*+,;")
    return urlunsplit((parts.scheme, parts.netloc, safe_path, safe_query, ""))


def resolve_post_header_image(url):
    return safe_external_image_url(url) or url_for("static", filename="assets/img/post-bg.jpg")


def fetch_post_comments(post_id):
    comment_columns = get_table_columns("comments")
    if not comment_columns:
        return []

    timestamp_select = "comments.timestamp AS comment_timestamp" if "timestamp" in comment_columns else "NULL AS comment_timestamp"
    order_by = "comments.timestamp DESC, comments.id DESC" if "timestamp" in comment_columns else "comments.id DESC"
    rows = db.session.execute(
        text(
            f"""
            SELECT comments.id, comments.text, {timestamp_select}, users.email, users.name
            FROM comments
            LEFT JOIN users ON users.id = comments.author_id
            WHERE comments.post_id = :post_id
            ORDER BY {order_by}
            """
        ),
        {"post_id": post_id},
    ).mappings()
    return [
        CommentSnapshot(
            id=row["id"],
            text=row["text"],
            author=CommentAuthorSnapshot(
                email=row["email"] or "",
                name=row["name"] or "Deleted user",
            ),
            timestamp=row["comment_timestamp"],
        )
        for row in rows
    ]


def create_post_comment(post_id, author_id, comment_text):
    db.session.execute(
        text(
            """
            INSERT INTO comments (text, author_id, post_id)
            VALUES (:comment_text, :author_id, :post_id)
            """
        ),
        {
            "comment_text": comment_text,
            "author_id": author_id,
            "post_id": post_id,
        },
    )
    db.session.commit()


def delete_post_record(post_id):
    if get_table_columns("comments"):
        db.session.execute(
            text("DELETE FROM comments WHERE post_id = :post_id"),
            {"post_id": post_id},
        )
    db.session.execute(
        text("DELETE FROM blog_posts WHERE id = :post_id"),
        {"post_id": post_id},
    )
    db.session.commit()


def persist_admin_flag(user_id, is_admin):
    if not user_id or not users_table_has_is_admin_column():
        return False

    db.session.execute(
        text("UPDATE users SET is_admin = :is_admin WHERE id = :user_id"),
        {"is_admin": bool(is_admin), "user_id": user_id},
    )
    db.session.commit()
    return True


def sync_admin_from_config(user):
    admin_email = current_app.config.get("ADMIN_EMAIL", "")
    if admin_email and normalize_email(user.email) == admin_email:
        persist_admin_flag(user.id, True)


def commit_changes():
    try:
        db.session.commit()
        return True
    except IntegrityError:
        db.session.rollback()
        return False


def get_client_ip():
    return request.remote_addr or "unknown"


def get_rate_limit_identifier(scope):
    client_ip = get_client_ip()

    if scope == "register":
        return client_ip

    if scope == "login":
        email = normalize_email(request.form.get("email"))
        return f"{client_ip}:{email or 'anonymous'}"

    if scope == "comment" and current_user.is_authenticated:
        return f"{client_ip}:user:{current_user.get_id()}"

    return client_ip


def enforce_rate_limit(scope, endpoint, endpoint_values=None):
    limit = current_app.config["RATE_LIMITS"].get(scope)
    if not limit:
        return None

    window_seconds = current_app.config["RATE_LIMIT_WINDOWS"].get(
        scope,
        current_app.config["RATE_LIMIT_WINDOW_SECONDS"],
    )
    identifier = get_rate_limit_identifier(scope)
    if rate_limiter.is_allowed(current_app, scope, identifier, limit, window_seconds):
        return None

    flash("Too many attempts. Please wait a few minutes before trying again.", "warning")
    endpoint_values = endpoint_values or {}
    return redirect(url_for(endpoint, **endpoint_values))


def is_registration_enabled():
    return current_app.config["PUBLIC_REGISTRATION_ENABLED"]


def admin_only(view_func):
    @wraps(view_func)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return login_manager.unauthorized()
        if not current_user.has_admin_access:
            abort(403)
        return view_func(*args, **kwargs)

    return decorated_function


def sort_posts(posts):
    dated_posts = []
    for post in posts:
        try:
            parsed_date = datetime.strptime(post.date, "%B %d, %Y")
        except ValueError:
            parsed_date = datetime.min
        dated_posts.append((post, parsed_date))

    return [post for post, _ in sorted(dated_posts, key=lambda item: item[1], reverse=True)]


def build_content_security_policy(production):
    directives = [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "connect-src 'self'",
        "img-src 'self' https: data:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://use.fontawesome.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
    ]
    if production:
        directives.append("upgrade-insecure-requests")
    return "; ".join(directives)


def register_security_headers(app):
    production = app.config["SESSION_COOKIE_SECURE"]
    content_security_policy = build_content_security_policy(production)

    @app.after_request
    def add_security_headers(response):
        response.headers["Content-Security-Policy"] = content_security_policy
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
        if production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


def register_cli_commands(app):
    @app.cli.command("sync-admin-from-env")
    @click.option("--email", default=None, help="Override ADMIN_EMAIL for this run.")
    def sync_admin_from_env(email):
        admin_email = normalize_email(email or current_app.config.get("ADMIN_EMAIL"))
        if not admin_email:
            raise click.ClickException("ADMIN_EMAIL is not configured.")

        user = db.session.execute(select(User).where(User.email == admin_email)).scalar_one_or_none()
        if user is None:
            raise click.ClickException(f"No user found for {admin_email}.")

        if user.has_admin_access:
            click.echo(f"{admin_email} is already an admin.")
            return

        if persist_admin_flag(user.id, True):
            click.echo(f"{admin_email} is now an admin.")
            return

        click.echo(
            "The database does not have a persistent is_admin column yet. "
            "ADMIN_EMAIL still grants admin access until that migration is applied."
        )

    @app.cli.command("reset-password")
    @click.option("--email", required=True, help="Email of the account to update.")
    @click.password_option("--password", confirmation_prompt=True)
    def reset_password(email, password):
        normalized_email = normalize_email(email)
        user = db.session.execute(select(User).where(User.email == normalized_email)).scalar_one_or_none()
        if user is None:
            raise click.ClickException(f"No user found for {normalized_email}.")

        user.password = generate_password_hash(
            password,
            method="pbkdf2:sha256",
            salt_length=16,
        )
        db.session.commit()
        click.echo(f"Password updated for {normalized_email}.")


def register_template_hooks(app):
    @app.template_filter("sanitize_post_html")
    def sanitize_post_html_filter(value):
        return render_post_html(value)

    @app.template_filter("sanitize_comment_html")
    def sanitize_comment_html_filter(value):
        return render_comment_html(value)

    @app.template_filter("gravatar")
    def gravatar_filter(value):
        return gravatar_url(value)

    @app.template_filter("post_header_image")
    def post_header_image_filter(value):
        return resolve_post_header_image(value)

    @app.context_processor
    def inject_shared_context():
        return {
            "logout_form": ActionForm(),
            "action_form": ActionForm(),
            "registration_enabled": is_registration_enabled(),
        }


def register_routes(app):
    @app.route("/")
    def get_all_posts():
        posts = db.session.execute(select(BlogPost)).scalars().all()
        return render_template("index.html", all_posts=sort_posts(posts), current_user=current_user)

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if not is_registration_enabled():
            flash("Public registration is currently disabled.", "warning")
            return redirect(url_for("login"))

        form = RegisterForm()
        if request.method == "POST":
            limited_response = enforce_rate_limit("register", "register")
            if limited_response:
                return limited_response

            if form.validate_on_submit():
                email = normalize_email(form.email.data)
                existing_user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
                if existing_user:
                    flash("An account with that email already exists. Please log in.", "warning")
                    return redirect(url_for("login"))

                new_user = User(
                    email=email,
                    name=form.name.data.strip(),
                    password=generate_password_hash(
                        form.password.data,
                        method="pbkdf2:sha256",
                        salt_length=16,
                    ),
                )
                db.session.add(new_user)

                if not commit_changes():
                    flash("We could not create your account. Please try again.", "danger")
                    return render_template("register.html", form=form, current_user=current_user), 400

                login_user(new_user)
                sync_admin_from_config(new_user)
                return redirect(url_for("get_all_posts"))

        return render_template("register.html", form=form, current_user=current_user)

    @app.route("/login", methods=["GET", "POST"])
    def login():
        form = LoginForm()
        if request.method == "POST":
            limited_response = enforce_rate_limit("login", "login")
            if limited_response:
                return limited_response

            if form.validate_on_submit():
                email = normalize_email(form.email.data)
                user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
                invalid_credentials = (
                    user is None or not check_password_hash(user.password, form.password.data)
                )
                if invalid_credentials:
                    flash("Invalid email or password.", "danger")
                    return redirect(url_for("login"))

                login_user(user)
                sync_admin_from_config(user)
                return redirect(url_for("get_all_posts"))

        return render_template("login.html", form=form, current_user=current_user)

    @app.route("/logout", methods=["POST"])
    def logout():
        form = ActionForm()
        if not form.validate_on_submit():
            abort(400)

        logout_user()
        flash("You have been logged out.", "info")
        return redirect(url_for("get_all_posts"))

    @app.route("/post/<int:post_id>", methods=["GET", "POST"])
    def show_post(post_id):
        requested_post = db.get_or_404(BlogPost, post_id)
        form = CommentForm()

        if request.method == "POST":
            if not current_user.is_authenticated:
                flash("Log in to comment on this post.", "warning")
                return redirect(url_for("login"))

            limited_response = enforce_rate_limit("comment", "show_post", {"post_id": post_id})
            if limited_response:
                return limited_response

            if form.validate_on_submit():
                try:
                    create_post_comment(
                        requested_post.id,
                        current_user.id,
                        sanitize_comment_html_for_storage(form.comment_text.data),
                    )
                except IntegrityError:
                    db.session.rollback()
                    flash("We could not save your comment. Please try again.", "danger")
                except Exception:
                    db.session.rollback()
                    current_app.logger.exception("Unable to save comment for post %s.", requested_post.id)
                    flash("We could not save your comment. Please try again.", "danger")
                else:
                    flash("Comment added.", "success")
                return redirect(url_for("show_post", post_id=post_id))

        comments = fetch_post_comments(requested_post.id)
        return render_template(
            "post.html",
            post=requested_post,
            post_header_image=resolve_post_header_image(requested_post.img_url),
            current_user=current_user,
            form=form if current_user.is_authenticated else None,
            comments=comments,
        )

    @app.route("/new-post", methods=["GET", "POST"])
    @admin_only
    def add_new_post():
        form = CreatePostForm()
        if form.validate_on_submit():
            new_post = BlogPost(
                title=form.title.data.strip(),
                subtitle=form.subtitle.data.strip(),
                body=sanitize_post_html_for_storage(form.body.data),
                img_url=form.img_url.data.strip(),
                author=current_user,
                date=date.today().strftime("%B %d, %Y"),
            )
            db.session.add(new_post)

            if not commit_changes():
                flash("A post with that title already exists.", "warning")
                return render_template("make-post.html", form=form, current_user=current_user), 400

            flash("Post created.", "success")
            return redirect(url_for("get_all_posts"))

        return render_template("make-post.html", form=form, current_user=current_user)

    @app.route("/edit-post/<int:post_id>", methods=["GET", "POST"])
    @admin_only
    def edit_post(post_id):
        post = db.get_or_404(BlogPost, post_id)
        edit_form = CreatePostForm(
            title=post.title,
            subtitle=post.subtitle,
            img_url=post.img_url,
            body=post.body,
        )
        if edit_form.validate_on_submit():
            post.title = edit_form.title.data.strip()
            post.subtitle = edit_form.subtitle.data.strip()
            post.img_url = edit_form.img_url.data.strip()
            post.body = sanitize_post_html_for_storage(edit_form.body.data)

            if not commit_changes():
                flash("We could not update the post. Check that the title is unique.", "warning")
                return render_template(
                    "make-post.html",
                    form=edit_form,
                    is_edit=True,
                    current_user=current_user,
                ), 400

            flash("Post updated.", "success")
            return redirect(url_for("show_post", post_id=post.id))

        return render_template("make-post.html", form=edit_form, is_edit=True, current_user=current_user)

    @app.route("/delete/<int:post_id>", methods=["POST"])
    @admin_only
    def delete_post(post_id):
        form = ActionForm()
        if not form.validate_on_submit():
            abort(400)

        db.get_or_404(BlogPost, post_id)

        try:
            delete_post_record(post_id)
        except IntegrityError:
            db.session.rollback()
            flash("We could not delete that post safely.", "danger")
            return redirect(url_for("show_post", post_id=post_id))
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Unable to delete post %s.", post_id)
            flash("We could not delete that post safely.", "danger")
            return redirect(url_for("show_post", post_id=post_id))

        flash("Post deleted.", "info")
        return redirect(url_for("get_all_posts"))

    @app.route("/about")
    def about():
        return render_template("about.html", current_user=current_user)

    @app.route("/contact")
    def contact():
        return render_template("contact.html", current_user=current_user)


def create_app(test_config=None):
    production = _is_production_environment()
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    app.config.update(
        SECRET_KEY=_get_secret_key(test_config, production),
        SQLALCHEMY_DATABASE_URI=_get_database_uri(test_config, production),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=production,
        REMEMBER_COOKIE_HTTPONLY=True,
        REMEMBER_COOKIE_SAMESITE="Lax",
        REMEMBER_COOKIE_SECURE=production,
        PREFERRED_URL_SCHEME="https" if production else "http",
        PUBLIC_REGISTRATION_ENABLED=_is_truthy(
            os.getenv("PUBLIC_REGISTRATION_ENABLED"),
            default=not production,
        ),
        ADMIN_EMAIL=normalize_email(os.getenv("ADMIN_EMAIL")),
        RATE_LIMITS={"login": 5, "register": 5, "comment": 10},
        RATE_LIMIT_WINDOWS={"login": 300, "register": 3600, "comment": 900},
        RATE_LIMIT_WINDOW_SECONDS=300,
        RATE_LIMIT_RETENTION_SECONDS=86400,
    )

    if test_config:
        app.config.update(test_config)
        app.config["ADMIN_EMAIL"] = normalize_email(app.config.get("ADMIN_EMAIL"))

    bootstrap.init_app(app)
    ckeditor.init_app(app)
    csrf.init_app(app)
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    rate_limiter.init_app(app)
    login_manager.login_view = "login"
    login_manager.session_protection = "strong"
    register_security_headers(app)
    register_cli_commands(app)
    register_template_hooks(app)
    register_routes(app)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=not _is_production_environment(), port=5002)
