import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash

import main as main_module
from main import BlogPost, Comment, User, create_app, create_post_comment, db


def create_user(email, password, *, name='User'):
    user = User(
        email=email,
        name=name,
        password=generate_password_hash(password, method='pbkdf2:sha256', salt_length=16),
    )
    db.session.add(user)
    db.session.commit()
    return user


def api_login(client, email, password, **kwargs):
    return client.post('/api/auth/login', json={'email': email, 'password': password}, **kwargs)


def api_register(client, name, email, password, **kwargs):
    return client.post('/api/auth/register', json={'name': name, 'email': email, 'password': password}, **kwargs)


def api_contact(client, payload, **kwargs):
    return client.post('/api/contact', json=payload, **kwargs)


def assert_spa_shell(response):
    assert response.status_code == 200
    assert b'<div id="root"></div>' in response.data
    assert b'The Living Codex' in response.data


def test_create_app_requires_db_uri_in_production(monkeypatch):
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.setenv('FLASK_KEY', 'production-secret')
    monkeypatch.delenv('DB_URI', raising=False)
    monkeypatch.delenv('DATABASE_URL', raising=False)

    with pytest.raises(RuntimeError, match='DB_URI'):
        create_app()


def test_frontend_shell_is_served_for_primary_routes(client, app):
    with app.app_context():
        author = create_user('writer@example.com', 'long-password-123', name='Writer')
        post = BlogPost(
            title='Live Chronicle',
            subtitle='A surviving archive entry',
            body='<p>Body</p>',
            img_url='https://example.com/image.jpg',
            author=author,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()

    assert_spa_shell(client.get('/'))
    assert_spa_shell(client.get('/chronicles'))
    assert_spa_shell(client.get('/chronicle/1'))
    assert_spa_shell(client.get('/login'))
    assert_spa_shell(client.get('/register'))
    assert_spa_shell(client.get('/contact'))


def test_api_session_reports_registration_flag_and_csrf(client, app):
    app.config['PUBLIC_REGISTRATION_ENABLED'] = False

    response = client.get('/api/session')
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['authenticated'] is False
    assert payload['registrationEnabled'] is False
    assert payload['googleAuthEnabled'] is False
    assert payload['csrfToken']


def test_create_fragment_redirects_unauthenticated_users_to_login_with_next(client):
    response = client.get('/create-fragment', follow_redirects=False)

    assert response.status_code == 302
    assert response.headers['Location'].endswith('/login?next=/create-fragment')


def test_create_fragment_redirects_non_admin_users_home(client, app):
    with app.app_context():
        create_user('reader@example.com', 'long-password-123', name='Reader')

    api_login(client, 'reader@example.com', 'long-password-123')
    response = client.get('/create-fragment', follow_redirects=False)

    assert response.status_code == 302
    assert response.headers['Location'].endswith('/')


def test_google_oauth_start_redirects_when_not_configured(client):
    response = client.get('/auth/google/start', follow_redirects=False)

    assert response.status_code == 302
    assert response.headers['Location'].endswith('/login?oauth_error=google_unavailable')


def test_contact_route_returns_provider_unavailable_when_not_configured(client):
    response = api_contact(
        client,
        {
            'name': 'Reader',
            'email': 'reader@example.com',
            'phone': '+1 555 867 5309',
            'message': 'Hello from the redesigned contact form.',
        },
    )

    assert response.status_code == 503
    assert response.get_json()['error'] == 'Contact delivery is not configured right now.'


def test_contact_route_validates_fields(client):
    response = api_contact(
        client,
        {
            'name': 'A',
            'email': 'invalid-email',
            'phone': 'abc',
            'message': 'short',
        },
    )
    payload = response.get_json()

    assert response.status_code == 400
    assert payload['error'] == 'Please correct the contact form and try again.'
    assert 'name' in payload['fieldErrors']
    assert 'email' in payload['fieldErrors']
    assert 'phone' in payload['fieldErrors']
    assert 'message' in payload['fieldErrors']


def test_contact_route_sends_message_when_delivery_is_available(client, app, monkeypatch):
    app.config.update(
        RESEND_API_KEY='test-resend-key',
        CONTACT_FROM_EMAIL='codex@example.com',
        CONTACT_RECIPIENT_EMAIL='owner@example.com',
    )
    delivered = {}

    def fake_send_contact_email(name, email, phone, message):
        delivered.update({'name': name, 'email': email, 'phone': phone, 'message': message})

    monkeypatch.setattr(main_module, 'send_contact_email', fake_send_contact_email)

    response = api_contact(
        client,
        {
            'name': 'Reader',
            'email': 'reader@example.com',
            'phone': '+1 555 867 5309',
            'message': 'Hello from the redesigned contact form.',
        },
    )

    assert response.status_code == 200
    assert response.get_json() == {'sent': True, 'message': 'Your message has been sent.'}
    assert delivered == {
        'name': 'Reader',
        'email': 'reader@example.com',
        'phone': '+1 555 867 5309',
        'message': 'Hello from the redesigned contact form.',
    }


def test_contact_rate_limit_applies(client, app, monkeypatch):
    app.config['RATE_LIMITS']['contact'] = 1
    app.config['RATE_LIMIT_WINDOWS']['contact'] = 3600
    app.config.update(
        RESEND_API_KEY='test-resend-key',
        CONTACT_FROM_EMAIL='codex@example.com',
        CONTACT_RECIPIENT_EMAIL='owner@example.com',
    )
    monkeypatch.setattr(main_module, 'send_contact_email', lambda *args, **kwargs: None)
    payload = {
        'name': 'Reader',
        'email': 'reader@example.com',
        'phone': '+1 555 867 5309',
        'message': 'Hello from the redesigned contact form.',
    }

    first_response = api_contact(client, payload, environ_overrides={'REMOTE_ADDR': '198.51.100.80'})
    second_response = api_contact(client, payload, environ_overrides={'REMOTE_ADDR': '198.51.100.80'})

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.get_json()['error'] == 'Too many attempts. Please wait a few minutes before trying again.'


def test_first_registered_user_is_not_admin(client, app):
    response = api_register(client, 'Reader', 'reader@example.com', 'long-password-123')

    assert response.status_code == 200

    with app.app_context():
        user = db.session.execute(db.select(User).where(User.email == 'reader@example.com')).scalar_one()
        assert user.has_admin_access is False


def test_registration_can_be_disabled_via_api_while_route_stays_available(client, app):
    app.config['PUBLIC_REGISTRATION_ENABLED'] = False

    register_response = api_register(client, 'Reader', 'reader@example.com', 'long-password-123')
    shell_response = client.get('/register')

    assert register_response.status_code == 403
    assert register_response.get_json()['error'] == 'Public registration is currently disabled.'
    assert_spa_shell(shell_response)


def test_registration_defaults_to_disabled_in_production(tmp_path, monkeypatch):
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.delenv('PUBLIC_REGISTRATION_ENABLED', raising=False)

    app = create_app(
        {
            'TESTING': True,
            'SECRET_KEY': 'production-test',
            'SQLALCHEMY_DATABASE_URI': f"sqlite:///{tmp_path / 'prod.db'}",
            'WTF_CSRF_ENABLED': False,
            'ADMIN_EMAIL': '',
        }
    )

    assert app.config['PUBLIC_REGISTRATION_ENABLED'] is False


def test_delete_requires_post(client):
    response = client.get('/delete/1')
    assert response.status_code == 405


def test_logout_requires_post(client):
    response = client.get('/logout')
    assert response.status_code == 405


def test_login_uses_generic_error_message(client, app):
    with app.app_context():
        create_user('known@example.com', 'long-password-123', name='Known')

    wrong_password_response = api_login(client, 'known@example.com', 'wrong-password-123')
    unknown_user_response = api_login(client, 'missing@example.com', 'wrong-password-123')

    assert wrong_password_response.status_code == 401
    assert wrong_password_response.get_json()['error'] == 'Invalid email or password.'
    assert unknown_user_response.status_code == 401
    assert unknown_user_response.get_json()['error'] == 'Invalid email or password.'


def test_login_accepts_legacy_short_passwords(client, app):
    with app.app_context():
        create_user('legacy@example.com', 'shortpass', name='Legacy')

    response = api_login(client, 'legacy@example.com', 'shortpass')
    session_response = client.get('/api/session')

    assert response.status_code == 200
    assert session_response.get_json()['authenticated'] is True
    assert session_response.get_json()['user']['email'] == 'legacy@example.com'


def test_login_shows_feedback_when_validation_fails(client):
    response = client.post('/api/auth/login', json={'email': 'not-an-email', 'password': ''})

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Please enter a valid email and password.'


def test_api_fragment_crud_requires_admin(client, app):
    with app.app_context():
        create_user('reader@example.com', 'long-password-123', name='Reader')
        author = create_user('writer@example.com', 'long-password-456', name='Writer')
        post = BlogPost(
            title='Existing Chronicle',
            subtitle='Subtitle',
            body='<p>Body</p>',
            img_url='https://example.com/image.jpg',
            author=author,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()

    api_login(client, 'reader@example.com', 'long-password-123')
    create_response = client.post('/api/fragments', json={'title': 'Nope', 'description': 'Nope', 'loreText': '<p>Nope</p>', 'imageSrc': 'https://example.com/x.jpg'})
    update_response = client.put('/api/fragments/1', json={'title': 'Nope', 'description': 'Nope', 'loreText': '<p>Nope</p>', 'imageSrc': 'https://example.com/x.jpg'})
    delete_response = client.delete('/api/fragments/1')

    assert create_response.status_code == 403
    assert update_response.status_code == 403
    assert delete_response.status_code == 403


def test_api_fragment_crud_round_trip_for_admin(client, app):
    with app.app_context():
        create_user('admin@example.com', 'long-password-123', name='Admin')

    api_login(client, 'admin@example.com', 'long-password-123')
    create_response = client.post(
        '/api/fragments',
        json={
            'title': 'Admin Chronicle',
            'description': 'Created from API',
            'loreText': '<p>Rendered body</p>',
            'imageSrc': 'https://example.com/image.jpg',
        },
    )
    created_payload = create_response.get_json()['chronicle']

    update_response = client.put(
        f"/api/fragments/{created_payload['id']}",
        json={
            'title': 'Admin Chronicle Revised',
            'description': 'Updated from API',
            'loreText': '<p>Updated body</p>',
            'imageSrc': 'https://example.com/updated.jpg',
        },
    )
    fetch_response = client.get(f"/api/fragments/{created_payload['id']}")
    delete_response = client.delete(f"/api/fragments/{created_payload['id']}")
    missing_response = client.get(f"/api/fragments/{created_payload['id']}")

    assert create_response.status_code == 200
    assert created_payload['title'] == 'Admin Chronicle'
    assert update_response.status_code == 200
    assert update_response.get_json()['chronicle']['title'] == 'Admin Chronicle Revised'
    assert fetch_response.status_code == 200
    assert delete_response.status_code == 200
    assert delete_response.get_json()['deleted'] is True
    assert missing_response.status_code == 404


def test_api_comment_requires_authentication(client, app):
    with app.app_context():
        author = create_user('writer@example.com', 'long-password-123', name='Writer')
        post = BlogPost(
            title='Protected Comments',
            subtitle='Subtitle',
            body='<p>Body</p>',
            img_url='https://example.com/image.jpg',
            author=author,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()

    response = client.post('/api/chronicles/1/comments', json={'commentText': '<p>Hello</p>'})

    assert response.status_code == 401
    assert response.get_json()['error'] == 'Authentication required.'


def test_post_body_is_sanitized_on_api_render(client, app):
    with app.app_context():
        author = create_user('admin@example.com', 'long-password-123', name='Admin')
        post = BlogPost(
            title='Unsafe post',
            subtitle='Subtitle',
            body="<script>alert('xss')</script><p>Visible content</p>",
            img_url='https://example.com/image.jpg',
            author=author,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()

    response = client.get('/api/chronicles/1')
    body_html = response.get_json()['chronicle']['bodyHtml']

    assert "<script>alert('xss')</script>" not in body_html
    assert 'Visible content' in body_html


def test_delete_post_removes_comments(client, app):
    with app.app_context():
        admin = create_user('admin@example.com', 'long-password-123', name='Admin')
        author = create_user('reader@example.com', 'long-password-456', name='Reader')
        post = BlogPost(
            title='Post to delete',
            subtitle='Subtitle',
            body='<p>Body</p>',
            img_url='https://example.com/image.jpg',
            author=admin,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()
        comment = Comment(text='First!', author=author, post=post)
        db.session.add(comment)
        db.session.commit()

    api_login(client, 'admin@example.com', 'long-password-123')
    response = client.post('/delete/1', data={'submit': 'Submit'}, follow_redirects=True)

    assert response.status_code == 200
    with app.app_context():
        assert db.session.get(BlogPost, 1) is None
        assert db.session.execute(db.select(Comment)).scalars().all() == []


def test_legacy_routes_redirect_to_new_chronicle_and_create_fragment(client, app):
    with app.app_context():
        admin = create_user('admin@example.com', 'long-password-123', name='Admin')
        post = BlogPost(
            title='Legacy Redirects',
            subtitle='Subtitle',
            body='<p>Body</p>',
            img_url='https://example.com/image.jpg',
            author=admin,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()

    api_login(client, 'admin@example.com', 'long-password-123')
    show_response = client.get('/post/1', follow_redirects=False)
    new_post_response = client.get('/new-post', follow_redirects=False)
    edit_response = client.get('/edit-post/1', follow_redirects=False)

    assert show_response.status_code == 302
    assert show_response.headers['Location'].endswith('/chronicle/1')
    assert new_post_response.status_code == 302
    assert new_post_response.headers['Location'].endswith('/create-fragment')
    assert edit_response.status_code == 302
    assert edit_response.headers['Location'].endswith('/create-fragment/1/edit')


def test_api_chronicles_works_with_legacy_schema(tmp_path):
    db_path = Path(tmp_path) / 'legacy.db'
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
    cur.execute("INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)", ('writer@example.com', 'hash', 'Writer'))
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        ('Legacy Post', 'Still Works', 'March 12, 2026', '<p>Hello</p>', 'https://example.com/image.jpg'),
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            'TESTING': True,
            'SECRET_KEY': 'legacy-test',
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path.as_posix()}',
            'WTF_CSRF_ENABLED': False,
            'PUBLIC_REGISTRATION_ENABLED': True,
            'ADMIN_EMAIL': '',
        }
    )
    client = app.test_client()

    response = client.get('/api/chronicles')
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['chronicles'][0]['title'] == 'Legacy Post'


def test_security_headers_are_added(client):
    response = client.get('/')

    assert response.headers['Content-Security-Policy']
    assert response.headers['X-Frame-Options'] == 'DENY'
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert response.headers['Permissions-Policy'] == 'camera=(), geolocation=(), microphone=()'
    assert 'Strict-Transport-Security' not in response.headers


def test_hsts_is_enabled_when_secure_cookies_are_enabled(tmp_path):
    app = create_app(
        {
            'TESTING': True,
            'WTF_CSRF_ENABLED': False,
            'SQLALCHEMY_DATABASE_URI': f"sqlite:///{tmp_path / 'secure.db'}",
            'SECRET_KEY': 'secure-secret',
            'SESSION_COOKIE_SECURE': True,
            'ADMIN_EMAIL': '',
        }
    )

    with app.app_context():
        db.create_all()

    client = app.test_client()
    response = client.get('/')

    assert response.headers['Strict-Transport-Security'] == 'max-age=31536000; includeSubDomains'
    assert 'upgrade-insecure-requests' in response.headers['Content-Security-Policy']


def test_post_header_image_falls_back_when_url_is_unsafe(client, app):
    with app.app_context():
        author = create_user('writer@example.com', 'long-password-123', name='Writer')
        post = BlogPost(
            title='Unsafe image',
            subtitle='Subtitle',
            body='<p>Body</p>',
            img_url='javascript:alert("xss")',
            author=author,
            date='March 12, 2026',
        )
        db.session.add(post)
        db.session.commit()

    response = client.get('/api/chronicles/1')

    assert response.status_code == 200
    assert response.get_json()['chronicle']['imageSrc'].endswith('/static/assets/img/post-bg.jpg')


def test_reset_password_cli_updates_the_stored_hash(app):
    with app.app_context():
        create_user('reset@example.com', 'long-password-123', name='Reset')

    runner = app.test_cli_runner()
    result = runner.invoke(args=['reset-password', '--email', 'reset@example.com', '--password', 'new-long-password-456'])

    assert result.exit_code == 0
    assert 'Password updated for reset@example.com.' in result.output

    with app.app_context():
        user = db.session.execute(db.select(User).where(User.email == 'reset@example.com')).scalar_one()
        assert check_password_hash(user.password, 'new-long-password-456')


def test_login_rate_limit_falls_back_to_memory_without_rate_limit_table(tmp_path):
    db_path = Path(tmp_path) / 'legacy-rate-limit.db'
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
            'TESTING': True,
            'SECRET_KEY': 'memory-limit-secret',
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path.as_posix()}',
            'WTF_CSRF_ENABLED': False,
            'ADMIN_EMAIL': '',
            'RATE_LIMITS': {'login': 1, 'register': 5, 'comment': 10},
            'RATE_LIMIT_WINDOWS': {'login': 3600, 'register': 3600, 'comment': 900},
        }
    )
    client = app.test_client()

    first_response = api_login(client, 'missing@example.com', 'long-password-123', environ_overrides={'REMOTE_ADDR': '198.51.100.23'})
    second_response = api_login(client, 'missing@example.com', 'long-password-123', environ_overrides={'REMOTE_ADDR': '198.51.100.23'})

    assert first_response.status_code == 401
    assert first_response.get_json()['error'] == 'Invalid email or password.'
    assert second_response.status_code == 429
    assert second_response.get_json()['error'] == 'Too many attempts. Please wait a few minutes before trying again.'


def test_login_rate_limit_persists_across_app_instances(tmp_path):
    db_path = Path(tmp_path) / 'persistent-rate-limit.db'
    database_uri = f'sqlite:///{db_path.as_posix()}'
    base_config = {
        'TESTING': True,
        'SECRET_KEY': 'persistent-secret',
        'SQLALCHEMY_DATABASE_URI': database_uri,
        'WTF_CSRF_ENABLED': False,
        'ADMIN_EMAIL': '',
        'RATE_LIMITS': {'login': 1, 'register': 5, 'comment': 10},
        'RATE_LIMIT_WINDOWS': {'login': 3600, 'register': 3600, 'comment': 900},
    }

    app_one = create_app(base_config)
    with app_one.app_context():
        db.create_all()

    client_one = app_one.test_client()
    first_response = api_login(client_one, 'missing@example.com', 'long-password-123', environ_overrides={'REMOTE_ADDR': '203.0.113.7'})

    app_two = create_app(base_config)
    client_two = app_two.test_client()
    second_response = api_login(client_two, 'missing@example.com', 'long-password-123', environ_overrides={'REMOTE_ADDR': '203.0.113.7'})

    assert first_response.status_code == 401
    assert second_response.status_code == 429


def test_api_chronicle_detail_works_with_legacy_comment_schema(tmp_path):
    db_path = Path(tmp_path) / 'legacy-post-route.db'
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
    cur.execute("INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)", ('writer@example.com', 'hash', 'Writer'))
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        ('Legacy Comments Post', 'Still Works', 'March 12, 2026', '<p>Hello</p>', 'https://example.com/image.jpg'),
    )
    cur.execute('INSERT INTO comments (id, text, author_id, post_id) VALUES (1, ?, 1, 1)', ('Legacy comment',))
    conn.commit()
    conn.close()

    app = create_app(
        {
            'TESTING': True,
            'SECRET_KEY': 'legacy-post-route',
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path.as_posix()}',
            'WTF_CSRF_ENABLED': False,
            'PUBLIC_REGISTRATION_ENABLED': True,
            'ADMIN_EMAIL': '',
        }
    )
    client = app.test_client()

    response = client.get('/api/chronicles/1')
    payload = response.get_json()['chronicle']

    assert response.status_code == 200
    assert payload['title'] == 'Legacy Comments Post'
    assert payload['comments'][0]['authorName'] == 'Writer'
    assert 'Legacy comment' in payload['comments'][0]['textHtml']


def test_api_chronicle_detail_works_with_orphaned_comment_author(client, app):
    with app.app_context():
        author = create_user('writer@example.com', 'long-password-123', name='Writer')
        post = BlogPost(
            title='Orphaned comment author',
            subtitle='Still Works',
            body='<p>Hello</p>',
            img_url='https://example.com/image.jpg',
            author=author,
            date='March 12, 2026',
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
            {'text': 'Comment from deleted user', 'author_id': 9999, 'post_id': post.id, 'parent_id': None},
        )
        db.session.commit()

    response = client.get('/api/chronicles/1')
    payload = response.get_json()['chronicle']

    assert response.status_code == 200
    assert 'Comment from deleted user' in payload['comments'][0]['textHtml']
    assert payload['comments'][0]['authorName'] == 'Deleted user'


def test_create_post_comment_helper_works_with_legacy_comment_schema(tmp_path):
    db_path = Path(tmp_path) / 'legacy-comment-helper.db'
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
    cur.execute("INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)", ('writer@example.com', 'hash', 'Writer'))
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        ('Legacy Comment Submit', 'Still Works', 'March 12, 2026', '<p>Hello</p>', 'https://example.com/image.jpg'),
    )
    conn.commit()
    conn.close()

    app = create_app(
        {
            'TESTING': True,
            'SECRET_KEY': 'legacy-comment-submit',
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path.as_posix()}',
            'WTF_CSRF_ENABLED': False,
            'PUBLIC_REGISTRATION_ENABLED': True,
            'ADMIN_EMAIL': '',
        }
    )
    with app.app_context():
        create_post_comment(1, 1, 'A new legacy-safe comment')

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    rows = list(cur.execute('SELECT text FROM comments ORDER BY id'))
    conn.close()

    assert rows == [('A new legacy-safe comment',)]


def test_delete_route_works_with_legacy_comment_schema(tmp_path):
    db_path = Path(tmp_path) / 'legacy-delete-route.db'
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
    password_hash = generate_password_hash('long-password-123', method='pbkdf2:sha256', salt_length=16)
    cur.execute("INSERT INTO users (id, email, password, name) VALUES (1, ?, ?, ?)", ('admin@example.com', password_hash, 'Admin'))
    cur.execute(
        """
        INSERT INTO blog_posts (id, title, subtitle, date, body, img_url, author_id)
        VALUES (1, ?, ?, ?, ?, ?, 1)
        """,
        ('Legacy Delete Post', 'Still Works', 'March 12, 2026', '<p>Hello</p>', 'https://example.com/image.jpg'),
    )
    cur.execute('INSERT INTO comments (id, text, author_id, post_id) VALUES (1, ?, 1, 1)', ('Legacy comment',))
    conn.commit()
    conn.close()

    app = create_app(
        {
            'TESTING': True,
            'SECRET_KEY': 'legacy-delete-route',
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path.as_posix()}',
            'WTF_CSRF_ENABLED': False,
            'PUBLIC_REGISTRATION_ENABLED': True,
            'ADMIN_EMAIL': 'admin@example.com',
        }
    )
    client = app.test_client()

    api_login(client, 'admin@example.com', 'long-password-123')
    response = client.post('/delete/1', data={'submit': 'Submit'}, follow_redirects=True)

    assert response.status_code == 200

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    remaining_posts = list(cur.execute('SELECT id FROM blog_posts'))
    remaining_comments = list(cur.execute('SELECT id FROM comments'))
    conn.close()

    assert remaining_posts == []
    assert remaining_comments == []
