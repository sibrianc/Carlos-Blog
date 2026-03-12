import os
import time
from collections import defaultdict, deque
from datetime import date, datetime
from functools import wraps
from threading import RLock

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
from flask_gravatar import Gravatar
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
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import expression
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


class Base(DeclarativeBase):
    pass


bootstrap = Bootstrap5()
ckeditor = CKEditor()
csrf = CSRFProtect()
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
migrate = Migrate(compare_type=True)


class SimpleRateLimiter:
    def __init__(self):
        self._locks = defaultdict(RLock)

    def init_app(self, app):
        app.extensions["simple_rate_limiter"] = defaultdict(deque)

    def is_allowed(self, app, bucket_key, limit, window_seconds):
        buckets = app.extensions["simple_rate_limiter"]
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


rate_limiter = SimpleRateLimiter()


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
    is_admin: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=expression.false(),
    )

    posts: Mapped[list[BlogPost]] = relationship("BlogPost", back_populates="author")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="author")

    @property
    def has_admin_access(self):
        admin_email = current_app.config.get("ADMIN_EMAIL", "")
        return bool(self.is_admin or (admin_email and self.email.lower() == admin_email))


class Comment(db.Model):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    post_id: Mapped[int] = mapped_column(ForeignKey("blog_posts.id"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
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


def sync_admin_from_config(user):
    admin_email = current_app.config.get("ADMIN_EMAIL", "")
    if admin_email and normalize_email(user.email) == admin_email and not user.is_admin:
        user.is_admin = True
        db.session.commit()


def commit_changes():
    try:
        db.session.commit()
        return True
    except IntegrityError:
        db.session.rollback()
        return False


def get_client_ip():
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.remote_addr or "unknown"


def enforce_rate_limit(scope, endpoint, endpoint_values=None):
    limit = current_app.config["RATE_LIMITS"].get(scope)
    if not limit:
        return None

    window_seconds = current_app.config["RATE_LIMIT_WINDOW_SECONDS"]
    bucket_key = f"{scope}:{get_client_ip()}"
    if rate_limiter.is_allowed(current_app, bucket_key, limit, window_seconds):
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

        if user.is_admin:
            click.echo(f"{admin_email} is already an admin.")
            return

        user.is_admin = True
        db.session.commit()
        click.echo(f"{admin_email} is now an admin.")


def register_template_hooks(app):
    @app.template_filter("sanitize_post_html")
    def sanitize_post_html_filter(value):
        return render_post_html(value)

    @app.template_filter("sanitize_comment_html")
    def sanitize_comment_html_filter(value):
        return render_comment_html(value)

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
                    is_admin=email == current_app.config.get("ADMIN_EMAIL"),
                )
                db.session.add(new_user)

                if not commit_changes():
                    flash("We could not create your account. Please try again.", "danger")
                    return render_template("register.html", form=form, current_user=current_user), 400

                login_user(new_user)
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
                new_comment = Comment(
                    text=sanitize_comment_html_for_storage(form.comment_text.data),
                    author=current_user,
                    post=requested_post,
                )
                db.session.add(new_comment)

                if not commit_changes():
                    flash("We could not save your comment. Please try again.", "danger")
                else:
                    flash("Comment added.", "success")
                return redirect(url_for("show_post", post_id=post_id))

        comments = sorted(requested_post.comments, key=lambda comment: comment.timestamp, reverse=True)
        return render_template(
            "post.html",
            post=requested_post,
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

        post_to_delete = db.get_or_404(BlogPost, post_id)
        db.session.delete(post_to_delete)

        if not commit_changes():
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
        RATE_LIMIT_WINDOW_SECONDS=300,
    )

    if test_config:
        app.config.update(test_config)

    bootstrap.init_app(app)
    ckeditor.init_app(app)
    csrf.init_app(app)
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    rate_limiter.init_app(app)
    login_manager.login_view = "login"
    login_manager.session_protection = "strong"
    Gravatar(
        app,
        size=100,
        rating="g",
        default="retro",
        force_default=False,
        force_lower=True,
        use_ssl=True,
        base_url=None,
    )

    register_cli_commands(app)
    register_template_hooks(app)
    register_routes(app)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=not _is_production_environment(), port=5002)
