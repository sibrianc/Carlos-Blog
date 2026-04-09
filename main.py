import hashlib
import json
import os
import time
from collections import defaultdict, deque
from pathlib import Path
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from functools import wraps
from threading import RLock
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

import click
from flask import (
    Flask,
    abort,
    current_app,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
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
from flask_wtf.csrf import generate_csrf
from markupsafe import Markup, escape
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func, inspect, select, text
from sqlalchemy.exc import IntegrityError, NoSuchTableError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from werkzeug.datastructures import MultiDict
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

from forms import ActionForm, CommentForm, ContactForm, CreatePostForm, LoginForm, RegisterForm

try:
    from authlib.integrations.flask_client import OAuth
except ImportError:  # pragma: no cover - Authlib is optional until Google OAuth is configured.
    OAuth = None

try:
    import bleach
except ImportError:  # pragma: no cover - bleach is optional at runtime.
    bleach = None


def load_local_env_file():
    env_path = Path(__file__).resolve().with_name(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


load_local_env_file()


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
DEFAULT_FRAGMENT_IMAGE = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop"


class ContactDeliveryConfigurationError(RuntimeError):
    pass


class ContactDeliveryError(RuntimeError):
    pass

class Base(DeclarativeBase):
    pass


bootstrap = Bootstrap5()
ckeditor = CKEditor()
csrf = CSRFProtect()
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
migrate = Migrate(compare_type=True)
oauth = OAuth() if OAuth is not None else None


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


def safe_internal_redirect_path(path_value):
    if not path_value:
        return None

    candidate = str(path_value).strip()
    parts = urlsplit(candidate)
    if parts.scheme or parts.netloc or not parts.path.startswith("/"):
        return None
    return urlunsplit(("", "", parts.path, parts.query, ""))


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


def send_contact_email(name, email, phone, message):
    resend_api_key = (current_app.config.get("RESEND_API_KEY") or "").strip()
    from_email = (current_app.config.get("CONTACT_FROM_EMAIL") or "").strip()
    recipient_email = (current_app.config.get("CONTACT_RECIPIENT_EMAIL") or "").strip()

    if not resend_api_key or not from_email or not recipient_email:
        raise ContactDeliveryConfigurationError("Contact delivery is not configured.")

    safe_name = escape(name)
    safe_email = escape(email)
    safe_phone = escape(phone)
    safe_message = escape(message).replace("\n", "<br>")
    subject = f"New contact form message from {name}"
    payload = json.dumps(
        {
            "from": from_email,
            "to": [recipient_email],
            "subject": subject,
            "reply_to": email,
            "html": (
                "<div style=\"font-family:Georgia,serif;line-height:1.6;color:#f2eee6;background:#0d1011;padding:24px;\">"
                "<h2 style=\"margin-top:0;color:#71d7cd;\">New message from The Living Codex</h2>"
                f"<p><strong>Name:</strong> {safe_name}</p>"
                f"<p><strong>Email:</strong> {safe_email}</p>"
                f"<p><strong>Phone:</strong> {safe_phone}</p>"
                f"<p><strong>Message:</strong><br>{safe_message}</p>"
                "</div>"
            ),
            "text": (
                f"Name: {name}\n"
                f"Email: {email}\n"
                f"Phone: {phone}\n\n"
                f"Message:\n{message}"
            ),
        }
    ).encode("utf-8")
    resend_request = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "the-living-codex-contact/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(resend_request, timeout=10) as response:
            status_code = getattr(response, "status", response.getcode())
            response_body = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        current_app.logger.warning("Resend rejected contact request: %s", error_body)
        raise ContactDeliveryError("Contact delivery is unavailable right now.") from exc
    except URLError as exc:
        current_app.logger.warning("Resend contact delivery failed: %s", exc)
        raise ContactDeliveryError("Contact delivery is unavailable right now.") from exc

    if status_code >= 400:
        current_app.logger.warning("Unexpected Resend response: %s %s", status_code, response_body)
        raise ContactDeliveryError("Contact delivery is unavailable right now.")


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


def resolve_google_user_claims(userinfo):
    email = normalize_email(userinfo.get("email"))
    if not email or not userinfo.get("email_verified"):
        raise ValueError("Google account email must be verified.")

    existing_user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing_user is not None:
        return existing_user

    if not is_registration_enabled():
        raise PermissionError("Public registration is currently disabled.")

    display_name = (userinfo.get("name") or email.split("@", 1)[0] or "Google User").strip()
    display_name = display_name[:250] or "Google User"
    generated_password = generate_password_hash(
        os.urandom(32).hex(),
        method="pbkdf2:sha256",
        salt_length=16,
    )
    new_user = User(email=email, name=display_name, password=generated_password)
    db.session.add(new_user)

    if not commit_changes():
        existing_user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing_user is not None:
            return existing_user
        raise RuntimeError("We could not create the Google account.")

    return new_user


def google_oauth_enabled():
    return bool(current_app.extensions.get("google_oauth_client"))


def consume_post_login_redirect(default_endpoint="get_all_posts"):
    next_path = safe_internal_redirect_path(session.pop("post_login_redirect", None))
    if next_path:
        return next_path
    return url_for(default_endpoint)


def redirect_for_admin_shell_access():
    if not current_user.is_authenticated:
        next_path = safe_internal_redirect_path(request.path) or "/create-fragment"
        return redirect(url_for("login", next=next_path))
    return redirect(url_for("get_all_posts"))


def get_client_ip():
    return request.remote_addr or "unknown"


def get_rate_limit_identifier(scope):
    client_ip = get_client_ip()
    payload = request.get_json(silent=True) or {}

    if scope == "register":
        return client_ip

    if scope == "login":
        email = normalize_email(request.form.get("email") or payload.get("email"))
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
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://use.fontawesome.com https://cdn.ckeditor.com",
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




def frontend_dist_directory():
    return os.path.join(current_app.root_path, "frontend", "dist")


def serve_frontend_index():
    dist_dir = frontend_dist_directory()
    index_path = os.path.join(dist_dir, "index.html")
    if not os.path.exists(index_path):
        current_app.logger.error("Frontend build missing at %s.", index_path)
        abort(503)
    return send_from_directory(dist_dir, "index.html")


def serve_frontend_asset(asset_path):
    dist_dir = frontend_dist_directory()
    asset_file = os.path.join(dist_dir, asset_path)
    if not os.path.isfile(asset_file):
        abort(404)
    return send_from_directory(dist_dir, asset_path)


def coerce_string(value):
    if value is None:
        return ""
    return value if isinstance(value, str) else str(value)


def build_api_form(form_class, values):
    return form_class(
        formdata=MultiDict({key: coerce_string(value) for key, value in values.items()}),
        meta={"csrf": False},
    )


def api_error(message, status=400, field_errors=None):
    payload = {"error": message}
    if field_errors:
        payload["fieldErrors"] = field_errors
    return jsonify(payload), status


def serialize_current_user(user):
    if user is None:
        return None

    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "isAdmin": bool(user.has_admin_access),
        "avatarUrl": gravatar_url(user.email, size=160),
    }


def format_comment_timestamp(timestamp):
    if timestamp is None:
        return None
    if isinstance(timestamp, str):
        return timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    return timestamp.astimezone(UTC).strftime("%B %d, %Y %I:%M %p UTC")


def serialize_comment_snapshot(comment):
    return {
        "id": str(comment.id),
        "textHtml": str(render_comment_html(comment.text)),
        "authorName": comment.author.name,
        "authorEmail": comment.author.email,
        "avatarUrl": gravatar_url(comment.author.email, size=96),
        "timestampLabel": format_comment_timestamp(comment.timestamp),
    }


def serialize_post_summary(post):
    author_name = post.author.name if getattr(post, "author", None) else "Deleted user"
    return {
        "id": str(post.id),
        "title": post.title,
        "subtitle": post.subtitle,
        "description": post.subtitle,
        "imageSrc": resolve_post_header_image(post.img_url),
        "imageAlt": post.title,
        "authorName": author_name,
        "publishedLabel": post.date,
    }


def serialize_post_detail(post):
    payload = serialize_post_summary(post)
    payload.update(
        {
            "bodyHtml": str(render_post_html(post.body)),
            "comments": [serialize_comment_snapshot(comment) for comment in fetch_post_comments(post.id)],
            "canEdit": bool(current_user.is_authenticated and current_user.has_admin_access),
            "canDelete": bool(current_user.is_authenticated and current_user.has_admin_access),
        }
    )
    return payload


def build_session_payload():
    return {
        "authenticated": bool(current_user.is_authenticated),
        "user": serialize_current_user(current_user if current_user.is_authenticated else None),
        "registrationEnabled": is_registration_enabled(),
        "googleAuthEnabled": google_oauth_enabled(),
        "csrfToken": generate_csrf(),
    }


def require_api_authentication():
    if not current_user.is_authenticated:
        return api_error("Authentication required.", 401)
    return None


def require_api_admin_access():
    if not current_user.is_authenticated:
        return api_error("Authentication required.", 401)
    if not current_user.has_admin_access:
        return api_error("Admin access required.", 403)
    return None


def enforce_api_rate_limit(scope):
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

    return api_error("Too many attempts. Please wait a few minutes before trying again.", 429)


def configure_google_oauth(app):
    app.extensions["google_oauth_client"] = None

    if oauth is None:
        return

    oauth.init_app(app)
    client_id = (app.config.get("GOOGLE_CLIENT_ID") or "").strip()
    client_secret = (app.config.get("GOOGLE_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        return

    app.extensions["google_oauth_client"] = oauth.register(
        name=f"google_{id(app)}",
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def register_routes(app):
    @app.route("/app/<path:asset_path>")
    def frontend_assets(asset_path):
        return serve_frontend_asset(asset_path)

    @app.route("/")
    def get_all_posts():
        return serve_frontend_index()

    @app.route("/chronicles")
    def chronicles_archive():
        return serve_frontend_index()

    @app.route("/chronicle/<int:post_id>")
    def frontend_chronicle(post_id):
        if db.session.get(BlogPost, post_id) is None:
            abort(404)
        return serve_frontend_index()

    @app.route("/create-fragment")
    def create_fragment_page():
        if not current_user.is_authenticated or not current_user.has_admin_access:
            return redirect_for_admin_shell_access()
        return serve_frontend_index()

    @app.route("/create-fragment/<int:post_id>/edit")
    def edit_fragment_page(post_id):
        if not current_user.is_authenticated or not current_user.has_admin_access:
            return redirect_for_admin_shell_access()
        if db.session.get(BlogPost, post_id) is None:
            abort(404)
        return serve_frontend_index()

    @app.route("/codex")
    @app.route("/codex/<path:codex_path>")
    def codex_page(codex_path=None):
        return serve_frontend_index()

    @app.route("/about")
    def about():
        return serve_frontend_index()

    @app.route("/contact")
    def contact():
        return serve_frontend_index()

    @app.get("/auth/google/start")
    def auth_google_start():
        google_client = current_app.extensions.get("google_oauth_client")
        if google_client is None:
            return redirect(url_for("login", oauth_error="google_unavailable"))

        next_path = safe_internal_redirect_path(request.args.get("next"))
        if next_path:
            session["post_login_redirect"] = next_path

        redirect_uri = url_for(
            "auth_google_callback",
            _external=True,
            _scheme=current_app.config.get("PREFERRED_URL_SCHEME", "http"),
        )
        return google_client.authorize_redirect(redirect_uri, prompt="select_account")

    @app.get("/auth/google/callback")
    def auth_google_callback():
        google_client = current_app.extensions.get("google_oauth_client")
        if google_client is None:
            return redirect(url_for("login", oauth_error="google_unavailable"))

        try:
            token = google_client.authorize_access_token()
            userinfo = token.get("userinfo")
            if userinfo is None:
                userinfo = google_client.get(
                    "https://openidconnect.googleapis.com/v1/userinfo",
                    token=token,
                ).json()
            user = resolve_google_user_claims(userinfo)
        except PermissionError:
            return redirect(url_for("login", oauth_error="google_registration_closed"))
        except ValueError:
            return redirect(url_for("login", oauth_error="google_unverified"))
        except Exception:
            current_app.logger.exception("Google OAuth callback failed.")
            return redirect(url_for("login", oauth_error="google_failed"))

        login_user(user)
        sync_admin_from_config(user)
        return redirect(consume_post_login_redirect())

    @app.get("/api/session")
    def api_session():
        return jsonify(build_session_payload())

    @app.post("/api/contact")
    def api_contact():
        limited_response = enforce_api_rate_limit("contact")
        if limited_response:
            return limited_response

        payload = request.get_json(silent=True) or {}
        form = build_api_form(
            ContactForm,
            {
                "name": payload.get("name"),
                "email": payload.get("email"),
                "phone": payload.get("phone"),
                "message": payload.get("message"),
            },
        )
        if not form.validate():
            return api_error("Please correct the contact form and try again.", 400, form.errors)

        try:
            send_contact_email(
                name=form.name.data.strip(),
                email=normalize_email(form.email.data),
                phone=form.phone.data.strip(),
                message=form.message.data.strip(),
            )
        except ContactDeliveryConfigurationError:
            return api_error("Contact delivery is not configured right now.", 503)
        except ContactDeliveryError:
            return api_error("Contact delivery is unavailable right now. Please try again later.", 503)
        except Exception:
            current_app.logger.exception("Unexpected contact delivery failure.")
            return api_error("Contact delivery is unavailable right now. Please try again later.", 503)

        return jsonify({"sent": True, "message": "Your message has been sent."})

    @app.post("/api/auth/register")
    def api_register():
        if not is_registration_enabled():
            return api_error("Public registration is currently disabled.", 403)

        limited_response = enforce_api_rate_limit("register")
        if limited_response:
            return limited_response

        payload = request.get_json(silent=True) or {}
        form = build_api_form(
            RegisterForm,
            {
                "name": payload.get("name"),
                "email": payload.get("email"),
                "password": payload.get("password"),
            },
        )
        if not form.validate():
            return api_error("Please correct the highlighted registration fields and try again.", 400, form.errors)

        email = normalize_email(form.email.data)
        existing_user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing_user:
            return api_error("An account with that email already exists. Please log in.", 409, {"email": ["An account with that email already exists."]})

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
            return api_error("We could not create your account. Please try again.", 500)

        login_user(new_user)
        sync_admin_from_config(new_user)
        return jsonify(build_session_payload())

    @app.post("/api/auth/login")
    def api_login():
        limited_response = enforce_api_rate_limit("login")
        if limited_response:
            return limited_response

        payload = request.get_json(silent=True) or {}
        form = build_api_form(
            LoginForm,
            {
                "email": payload.get("email"),
                "password": payload.get("password"),
            },
        )
        if not form.validate():
            return api_error("Please enter a valid email and password.", 400, form.errors)

        email = normalize_email(form.email.data)
        user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        invalid_credentials = user is None or not check_password_hash(user.password, form.password.data)
        if invalid_credentials:
            return api_error("Invalid email or password.", 401)

        login_user(user)
        sync_admin_from_config(user)
        return jsonify(build_session_payload())

    @app.post("/api/auth/logout")
    def api_logout():
        logout_user()
        return jsonify({"ok": True})

    @app.get("/api/chronicles")
    def api_chronicles():
        posts = db.session.execute(select(BlogPost)).scalars().all()
        return jsonify({"chronicles": [serialize_post_summary(post) for post in sort_posts(posts)]})

    @app.get("/api/chronicles/<int:post_id>")
    def api_chronicle_detail(post_id):
        post = db.session.get(BlogPost, post_id)
        if post is None:
            return api_error("Chronicle not found.", 404)
        return jsonify({"chronicle": serialize_post_detail(post)})

    @app.post("/api/chronicles/<int:post_id>/comments")
    def api_create_comment(post_id):
        post = db.session.get(BlogPost, post_id)
        if post is None:
            return api_error("Chronicle not found.", 404)

        auth_error = require_api_authentication()
        if auth_error:
            return auth_error

        limited_response = enforce_api_rate_limit("comment")
        if limited_response:
            return limited_response

        payload = request.get_json(silent=True) or {}
        form = build_api_form(CommentForm, {"comment_text": payload.get("commentText")})
        if not form.validate():
            return api_error("Please provide a valid comment.", 400, form.errors)

        try:
            create_post_comment(post.id, current_user.id, sanitize_comment_html_for_storage(form.comment_text.data))
        except IntegrityError:
            db.session.rollback()
            return api_error("We could not save your comment. Please try again.", 500)
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Unable to save comment for post %s.", post.id)
            return api_error("We could not save your comment. Please try again.", 500)

        return jsonify({"commentAdded": True})

    @app.post("/api/fragments")
    def api_create_fragment():
        admin_error = require_api_admin_access()
        if admin_error:
            return admin_error

        payload = request.get_json(silent=True) or {}
        form = build_api_form(
            CreatePostForm,
            {
                "title": payload.get("title"),
                "subtitle": payload.get("description"),
                "img_url": payload.get("imageSrc") or DEFAULT_FRAGMENT_IMAGE,
                "body": payload.get("loreText"),
            },
        )
        if not form.validate():
            return api_error("Please correct the fragment fields and try again.", 400, form.errors)

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
            return api_error("A post with that title already exists.", 409, {"title": ["A post with that title already exists."]})

        return jsonify({"chronicle": serialize_post_detail(new_post)})

    @app.route("/api/fragments/<int:post_id>", methods=["GET", "PUT", "DELETE"])
    def api_fragment_detail(post_id):
        post = db.session.get(BlogPost, post_id)
        if post is None:
            return api_error("Chronicle not found.", 404)

        if request.method == "GET":
            return jsonify({"chronicle": serialize_post_detail(post)})

        admin_error = require_api_admin_access()
        if admin_error:
            return admin_error

        if request.method == "PUT":
            payload = request.get_json(silent=True) or {}
            form = build_api_form(
                CreatePostForm,
                {
                    "title": payload.get("title"),
                    "subtitle": payload.get("description"),
                    "img_url": payload.get("imageSrc") or DEFAULT_FRAGMENT_IMAGE,
                    "body": payload.get("loreText"),
                },
            )
            if not form.validate():
                return api_error("Please correct the fragment fields and try again.", 400, form.errors)

            post.title = form.title.data.strip()
            post.subtitle = form.subtitle.data.strip()
            post.img_url = form.img_url.data.strip()
            post.body = sanitize_post_html_for_storage(form.body.data)

            if not commit_changes():
                return api_error("We could not update the post. Check that the title is unique.", 409, {"title": ["Check that the title is unique."]})

            return jsonify({"chronicle": serialize_post_detail(post)})

        try:
            delete_post_record(post_id)
        except IntegrityError:
            db.session.rollback()
            return api_error("We could not delete that post safely.", 500)
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Unable to delete post %s.", post_id)
            return api_error("We could not delete that post safely.", 500)

        return jsonify({"deleted": True})

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if request.method == "GET":
            return serve_frontend_index()

        registration_enabled = is_registration_enabled()
        form = RegisterForm() if registration_enabled else None

        if not is_registration_enabled():
            flash("Public registration is currently disabled.", "warning")
            return render_template(
                "register.html",
                form=form,
                current_user=current_user,
                registration_enabled=registration_enabled,
            ), 200

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

        flash("Please correct the highlighted registration fields and try again.", "warning")
        return render_template(
            "register.html",
            form=form,
            current_user=current_user,
            registration_enabled=registration_enabled,
        )

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "GET":
            return serve_frontend_index()

        form = LoginForm()
        limited_response = enforce_rate_limit("login", "login")
        if limited_response:
            return limited_response

        if form.validate_on_submit():
            email = normalize_email(form.email.data)
            user = db.session.execute(select(User).where(User.email == email)).scalar_one_or_none()
            invalid_credentials = user is None or not check_password_hash(user.password, form.password.data)
            if invalid_credentials:
                flash("Invalid email or password.", "danger")
                return redirect(url_for("login"))

            login_user(user)
            sync_admin_from_config(user)
            return redirect(url_for("get_all_posts"))

        flash("Please enter a valid email and password.", "warning")
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
        db.get_or_404(BlogPost, post_id)

        if request.method == "GET":
            return redirect(url_for("frontend_chronicle", post_id=post_id))

        if not current_user.is_authenticated:
            flash("Log in to comment on this post.", "warning")
            return redirect(url_for("login"))

        limited_response = enforce_rate_limit("comment", "frontend_chronicle", {"post_id": post_id})
        if limited_response:
            return limited_response

        form = CommentForm()
        if form.validate_on_submit():
            try:
                create_post_comment(post_id, current_user.id, sanitize_comment_html_for_storage(form.comment_text.data))
            except IntegrityError:
                db.session.rollback()
                flash("We could not save your comment. Please try again.", "danger")
            except Exception:
                db.session.rollback()
                current_app.logger.exception("Unable to save comment for post %s.", post_id)
                flash("We could not save your comment. Please try again.", "danger")
            else:
                flash("Comment added.", "success")
        else:
            flash("Please provide a valid comment.", "warning")

        return redirect(url_for("frontend_chronicle", post_id=post_id))

    @app.route("/new-post", methods=["GET"])
    @admin_only
    def add_new_post():
        return redirect(url_for("create_fragment_page"))

    @app.route("/edit-post/<int:post_id>", methods=["GET"])
    @admin_only
    def edit_post(post_id):
        db.get_or_404(BlogPost, post_id)
        return redirect(url_for("edit_fragment_page", post_id=post_id))

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
            return redirect(url_for("frontend_chronicle", post_id=post_id))
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Unable to delete post %s.", post_id)
            flash("We could not delete that post safely.", "danger")
            return redirect(url_for("frontend_chronicle", post_id=post_id))

        flash("Post deleted.", "info")
        return redirect(url_for("get_all_posts"))

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
        GOOGLE_CLIENT_ID=(os.getenv("GOOGLE_CLIENT_ID") or "").strip(),
        GOOGLE_CLIENT_SECRET=(os.getenv("GOOGLE_CLIENT_SECRET") or "").strip(),
        RESEND_API_KEY=(os.getenv("RESEND_API_KEY") or "").strip(),
        CONTACT_FROM_EMAIL=(os.getenv("CONTACT_FROM_EMAIL") or "").strip(),
        CONTACT_RECIPIENT_EMAIL=(os.getenv("CONTACT_RECIPIENT_EMAIL") or "").strip(),
        RATE_LIMITS={"login": 5, "register": 5, "comment": 10, "contact": 5},
        RATE_LIMIT_WINDOWS={"login": 300, "register": 3600, "comment": 900, "contact": 3600},
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
    configure_google_oauth(app)
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
