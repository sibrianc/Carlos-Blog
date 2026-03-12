import pytest
import sqlite3
from pathlib import Path
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash

from main import BlogPost, Comment, User, create_app, create_post_comment, db


def create_user(email, password, *, name="User"):
    user = User(
        email=email,
        name=name,
        password=generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
    )
    db.session.add(user)
    db.session.commit()
    return user


def login(client, email, password):
    return client.post(
        "/login",
        data={"email": email, "password": password, "submit": "Let Me In!"},
        follow_redirects=True,
    )


def test_create_app_requires_db_uri_in_production(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("FLASK_KEY", "production-secret")
    monkeypatch.delenv("DB_URI", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="DB_URI"):
        create_app()


def test_first_registered_user_is_not_admin(client, app):
    client.post(
        "/register",
        data={
            "email": "reader@example.com",
            "password": "long-password-123",
            "name": "Reader",
            "submit": "Sign Me Up!",
        },
        follow_redirects=True,
    )

    with app.app_context():
        user = db.session.execute(db.select(User).where(User.email == "reader@example.com")).scalar_one()
        assert user.has_admin_access is False


def test_registration_can_be_disabled(client, app):
    app.config["PUBLIC_REGISTRATION_ENABLED"] = False

    response = client.get("/register", follow_redirects=True)

    assert b"Public registration is currently disabled." in response.data
    assert response.status_code == 200


def test_register_link_is_visible_even_when_public_registration_is_disabled(client, app):
    app.config["PUBLIC_REGISTRATION_ENABLED"] = False

    response = client.get("/")

    assert b'href="/register"' in response.data


def test_login_page_links_to_registration_page(client, app):
    response = client.get("/login")

    assert b"Open the registration page" in response.data


def test_registration_defaults_to_disabled_in_production(tmp_path, monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.delenv("PUBLIC_REGISTRATION_ENABLED", raising=False)

    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "production-test",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'prod.db'}",
            "WTF_CSRF_ENABLED": False,
            "ADMIN_EMAIL": "",
        }
    )

    assert app.config["PUBLIC_REGISTRATION_ENABLED"] is False


def test_delete_requires_post(client):
    response = client.get("/delete/1")
    assert response.status_code == 405


def test_logout_requires_post(client):
    response = client.get("/logout")
    assert response.status_code == 405


def test_login_uses_generic_error_message(client, app):
    with app.app_context():
        create_user("known@example.com", "long-password-123", name="Known")

    wrong_password_response = login(client, "known@example.com", "wrong-password-123")
    unknown_user_response = login(client, "missing@example.com", "wrong-password-123")

    assert b"Invalid email or password." in wrong_password_response.data
    assert b"Invalid email or password." in unknown_user_response.data


def test_login_accepts_legacy_short_passwords(client, app):
    with app.app_context():
        create_user("legacy@example.com", "shortpass", name="Legacy")

    response = login(client, "legacy@example.com", "shortpass")

    assert b"Log Out" in response.data


def test_login_shows_feedback_when_form_validation_fails(client):
    response = client.post(
        "/login",
        data={"email": "not-an-email", "password": "", "submit": "Let Me In!"},
        follow_redirects=True,
    )

    assert b"Please enter a valid email and password." in response.data


def test_post_body_is_sanitized_on_render(client, app):
    with app.app_context():
        author = create_user("admin@example.com", "long-password-123", name="Admin")
        post = BlogPost(
            title="Unsafe post",
            subtitle="Subtitle",
            body="<script>alert('xss')</script><p>Visible content</p>",
            img_url="https://example.com/image.jpg",
            author=author,
            date="March 12, 2026",
        )
        db.session.add(post)
        db.session.commit()

    response = client.get("/post/1")

    assert b"<script>alert('xss')</script>" not in response.data
    assert b"Visible content" in response.data


def test_delete_post_removes_comments(client, app):
    with app.app_context():
        admin = create_user("admin@example.com", "long-password-123", name="Admin")
        author = create_user("reader@example.com", "long-password-456", name="Reader")
        post = BlogPost(
            title="Post to delete",
            subtitle="Subtitle",
            body="<p>Body</p>",
            img_url="https://example.com/image.jpg",
            author=admin,
            date="March 12, 2026",
        )
        db.session.add(post)
        db.session.commit()

        comment = Comment(text="First!", author=author, post=post)
        db.session.add(comment)
        db.session.commit()

    login(client, "admin@example.com", "long-password-123")
    client.post("/delete/1", data={"submit": "Submit"}, follow_redirects=True)

    with app.app_context():
        assert db.session.get(BlogPost, 1) is None
        assert db.session.execute(db.select(Comment)).scalars().all() == []


def test_homepage_works_with_legacy_schema(tmp_path):
    db_path = Path(tmp_path) / "legacy.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email VARCHAR(250) NOT NULL UNIQUE,
            password VARCHAR(250) NOT NULL,
            name VARCHAR(250) NOT NULL
        );
        CREATE TABLE blog_posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(250) NOT NULL UNIQUE,
            subtitle VARCHAR(250) NOT NULL,
            date VARCHAR(250) NOT NULL,
            body TEXT NOT NULL,
            img_url VARCHAR(250) NOT NULL,
            author_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id)
        );
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            text TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            parent_id INTEGER,
            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(author_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES blog_posts(id),
            FOREIGN KEY(parent_id) REFERENCES comments(id)
        );
        """
    )
    cur.execute(
        "INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)",
        ("writer@example.com", "hash", "Writer"),
    )
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        (
            "Legacy Post",
            "Still Works",
            "March 12, 2026",
            "<p>Hello</p>",
            "https://example.com/image.jpg",
        ),
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "legacy-test",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path.as_posix()}",
            "WTF_CSRF_ENABLED": False,
            "PUBLIC_REGISTRATION_ENABLED": True,
            "ADMIN_EMAIL": "",
        }
    )
    client = app.test_client()

    response = client.get("/")

    assert response.status_code == 200
    assert b"Legacy Post" in response.data


def test_security_headers_are_added(client):
    response = client.get("/")

    assert response.headers["Content-Security-Policy"]
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Permissions-Policy"] == "camera=(), geolocation=(), microphone=()"
    assert "Strict-Transport-Security" not in response.headers


def test_hsts_is_enabled_when_secure_cookies_are_enabled(tmp_path):
    app = create_app(
        {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'secure.db'}",
            "SECRET_KEY": "secure-secret",
            "SESSION_COOKIE_SECURE": True,
            "ADMIN_EMAIL": "",
        }
    )

    with app.app_context():
        db.create_all()

    client = app.test_client()
    response = client.get("/")

    assert response.headers["Strict-Transport-Security"] == "max-age=31536000; includeSubDomains"
    assert "upgrade-insecure-requests" in response.headers["Content-Security-Policy"]


def test_post_header_image_falls_back_when_url_is_unsafe(client, app):
    with app.app_context():
        author = create_user("writer@example.com", "long-password-123", name="Writer")
        post = BlogPost(
            title="Unsafe image",
            subtitle="Subtitle",
            body="<p>Body</p>",
            img_url='javascript:alert("xss")',
            author=author,
            date="March 12, 2026",
        )
        db.session.add(post)
        db.session.commit()

    response = client.get("/post/1")

    assert b"javascript:alert" not in response.data
    assert b"/static/assets/img/post-bg.jpg" in response.data


def test_reset_password_cli_updates_the_stored_hash(app):
    with app.app_context():
        create_user("reset@example.com", "long-password-123", name="Reset")

    runner = app.test_cli_runner()
    result = runner.invoke(
        args=[
            "reset-password",
            "--email",
            "reset@example.com",
            "--password",
            "new-long-password-456",
        ]
    )

    assert result.exit_code == 0
    assert "Password updated for reset@example.com." in result.output

    with app.app_context():
        user = db.session.execute(db.select(User).where(User.email == "reset@example.com")).scalar_one()
        assert check_password_hash(user.password, "new-long-password-456")


def test_login_rate_limit_falls_back_to_memory_without_rate_limit_table(tmp_path):
    db_path = Path(tmp_path) / "legacy-rate-limit.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email VARCHAR(250) NOT NULL UNIQUE,
            password VARCHAR(250) NOT NULL,
            name VARCHAR(250) NOT NULL
        );
        """
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "memory-limit-secret",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path.as_posix()}",
            "WTF_CSRF_ENABLED": False,
            "ADMIN_EMAIL": "",
            "RATE_LIMITS": {"login": 1, "register": 5, "comment": 10},
            "RATE_LIMIT_WINDOWS": {"login": 3600, "register": 3600, "comment": 900},
        }
    )
    client = app.test_client()

    first_response = client.post(
        "/login",
        data={
            "email": "missing@example.com",
            "password": "long-password-123",
            "submit": "Let Me In!",
        },
        follow_redirects=True,
        environ_overrides={"REMOTE_ADDR": "198.51.100.23"},
    )
    second_response = client.post(
        "/login",
        data={
            "email": "missing@example.com",
            "password": "long-password-123",
            "submit": "Let Me In!",
        },
        follow_redirects=True,
        environ_overrides={"REMOTE_ADDR": "198.51.100.23"},
    )

    assert b"Invalid email or password." in first_response.data
    assert b"Too many attempts." in second_response.data


def test_login_rate_limit_persists_across_app_instances(tmp_path):
    db_path = Path(tmp_path) / "persistent-rate-limit.db"
    database_uri = f"sqlite:///{db_path.as_posix()}"
    base_config = {
        "TESTING": True,
        "SECRET_KEY": "persistent-secret",
        "SQLALCHEMY_DATABASE_URI": database_uri,
        "WTF_CSRF_ENABLED": False,
        "ADMIN_EMAIL": "",
        "RATE_LIMITS": {"login": 1, "register": 5, "comment": 10},
        "RATE_LIMIT_WINDOWS": {"login": 3600, "register": 3600, "comment": 900},
    }

    app_one = create_app(base_config)
    with app_one.app_context():
        db.create_all()

    client_one = app_one.test_client()
    first_response = client_one.post(
        "/login",
        data={
            "email": "missing@example.com",
            "password": "long-password-123",
            "submit": "Let Me In!",
        },
        follow_redirects=True,
        environ_overrides={"REMOTE_ADDR": "203.0.113.7"},
    )

    app_two = create_app(base_config)
    client_two = app_two.test_client()
    second_response = client_two.post(
        "/login",
        data={
            "email": "missing@example.com",
            "password": "long-password-123",
            "submit": "Let Me In!",
        },
        follow_redirects=True,
        environ_overrides={"REMOTE_ADDR": "203.0.113.7"},
    )

    assert b"Invalid email or password." in first_response.data
    assert b"Too many attempts." in second_response.data


def test_post_route_works_with_legacy_comment_schema(tmp_path):
    db_path = Path(tmp_path) / "legacy-post-route.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email VARCHAR(250) NOT NULL UNIQUE,
            password VARCHAR(250) NOT NULL,
            name VARCHAR(250) NOT NULL
        );
        CREATE TABLE blog_posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(250) NOT NULL UNIQUE,
            subtitle VARCHAR(250) NOT NULL,
            date VARCHAR(250) NOT NULL,
            body TEXT NOT NULL,
            img_url VARCHAR(250) NOT NULL,
            author_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id)
        );
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            text TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES blog_posts(id)
        );
        """
    )
    cur.execute(
        "INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)",
        ("writer@example.com", "hash", "Writer"),
    )
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        (
            "Legacy Comments Post",
            "Still Works",
            "March 12, 2026",
            "<p>Hello</p>",
            "https://example.com/image.jpg",
        ),
    )
    cur.execute(
        "INSERT INTO comments (id, text, author_id, post_id) VALUES (1, ?, 1, 1)",
        ("Legacy comment",),
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "legacy-post-route",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path.as_posix()}",
            "WTF_CSRF_ENABLED": False,
            "PUBLIC_REGISTRATION_ENABLED": True,
            "ADMIN_EMAIL": "",
        }
    )
    client = app.test_client()

    response = client.get("/post/1")

    assert response.status_code == 200
    assert b"Legacy Comments Post" in response.data
    assert b"Legacy comment" in response.data


def test_post_route_works_with_orphaned_comment_author(client, app):
    with app.app_context():
        author = create_user("writer@example.com", "long-password-123", name="Writer")
        post = BlogPost(
            title="Orphaned comment author",
            subtitle="Still Works",
            body="<p>Hello</p>",
            img_url="https://example.com/image.jpg",
            author=author,
            date="March 12, 2026",
        )
        db.session.add(post)
        db.session.commit()
        db.session.execute(
            text(
                """
                INSERT INTO comments (text, author_id, post_id, parent_id)
                VALUES (:text, :author_id, :post_id, :parent_id)
                """
            ),
            {
                "text": "Comment from deleted user",
                "author_id": 9999,
                "post_id": post.id,
                "parent_id": None,
            },
        )
        db.session.commit()

    response = client.get("/post/1")

    assert response.status_code == 200
    assert b"Comment from deleted user" in response.data
    assert b"Deleted user" in response.data


def test_create_post_comment_helper_works_with_legacy_comment_schema(tmp_path):
    db_path = Path(tmp_path) / "legacy-comment-helper.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email VARCHAR(250) NOT NULL UNIQUE,
            password VARCHAR(250) NOT NULL,
            name VARCHAR(250) NOT NULL
        );
        CREATE TABLE blog_posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(250) NOT NULL UNIQUE,
            subtitle VARCHAR(250) NOT NULL,
            date VARCHAR(250) NOT NULL,
            body TEXT NOT NULL,
            img_url VARCHAR(250) NOT NULL,
            author_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id)
        );
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            text TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES blog_posts(id)
        );
        """
    )
    cur.execute(
        "INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)",
        ("writer@example.com", "hash", "Writer"),
    )
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        (
            "Legacy Comment Submit",
            "Still Works",
            "March 12, 2026",
            "<p>Hello</p>",
            "https://example.com/image.jpg",
        ),
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "legacy-comment-submit",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path.as_posix()}",
            "WTF_CSRF_ENABLED": False,
            "PUBLIC_REGISTRATION_ENABLED": True,
            "ADMIN_EMAIL": "",
        }
    )
    with app.app_context():
        create_post_comment(1, 1, "A new legacy-safe comment")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    rows = list(cur.execute("SELECT text FROM comments ORDER BY id"))
    conn.close()

    assert rows == [("A new legacy-safe comment",)]


def test_delete_route_works_with_legacy_comment_schema(tmp_path):
    db_path = Path(tmp_path) / "legacy-delete-route.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email VARCHAR(250) NOT NULL UNIQUE,
            password VARCHAR(250) NOT NULL,
            name VARCHAR(250) NOT NULL
        );
        CREATE TABLE blog_posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(250) NOT NULL UNIQUE,
            subtitle VARCHAR(250) NOT NULL,
            date VARCHAR(250) NOT NULL,
            body TEXT NOT NULL,
            img_url VARCHAR(250) NOT NULL,
            author_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id)
        );
        CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            text TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            FOREIGN KEY(author_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES blog_posts(id)
        );
        """
    )
    password_hash = generate_password_hash(
        "long-password-123",
        method="pbkdf2:sha256",
        salt_length=16,
    )
    cur.execute(
        "INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)",
        ("admin@example.com", password_hash, "Admin"),
    )
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        (
            "Legacy Delete Post",
            "Still Works",
            "March 12, 2026",
            "<p>Hello</p>",
            "https://example.com/image.jpg",
        ),
    )
    cur.execute(
        "INSERT INTO comments (id, text, author_id, post_id) VALUES (1, ?, 1, 1)",
        ("Legacy comment",),
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "legacy-delete-route",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path.as_posix()}",
            "WTF_CSRF_ENABLED": False,
            "PUBLIC_REGISTRATION_ENABLED": True,
            "ADMIN_EMAIL": "admin@example.com",
        }
    )
    client = app.test_client()

    login(client, "admin@example.com", "long-password-123")
    response = client.post("/delete/1", data={"submit": "Submit"}, follow_redirects=True)

    assert response.status_code == 200
    assert b"Post deleted." in response.data

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    remaining_posts = list(cur.execute("SELECT id FROM blog_posts"))
    remaining_comments = list(cur.execute("SELECT id FROM comments"))
    conn.close()

    assert remaining_posts == []
    assert remaining_comments == []
