import pytest
from werkzeug.security import generate_password_hash

from main import BlogPost, Comment, User, create_app, db


def create_user(email, password, *, is_admin=False, name="User"):
    user = User(
        email=email,
        name=name,
        password=generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
        is_admin=is_admin,
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
        assert user.is_admin is False


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
        author = create_user("admin@example.com", "long-password-123", is_admin=True, name="Admin")
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
        admin = create_user("admin@example.com", "long-password-123", is_admin=True, name="Admin")
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
