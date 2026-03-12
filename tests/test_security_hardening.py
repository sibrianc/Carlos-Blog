import pytest
import sqlite3
from pathlib import Path
from werkzeug.security import generate_password_hash

from main import BlogPost, Comment, User, create_app, db


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
