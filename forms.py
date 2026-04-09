from flask_ckeditor import CKEditorField
from flask_wtf import FlaskForm
from wtforms import PasswordField, StringField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Length, Regexp, URL


class CreatePostForm(FlaskForm):
    title = StringField('Blog Post Title', validators=[DataRequired(), Length(max=250)])
    subtitle = StringField('Subtitle', validators=[DataRequired(), Length(max=250)])
    img_url = StringField('Blog Image URL', validators=[DataRequired(), URL()])
    body = CKEditorField('Blog Content', validators=[DataRequired()])
    submit = SubmitField('Submit Post')


class RegisterForm(FlaskForm):
    email = StringField(
        'Email',
        validators=[
            DataRequired(),
            Length(max=250),
            Regexp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', message='Enter a valid email address.'),
        ],
    )
    password = PasswordField('Password', validators=[DataRequired(), Length(min=12, max=128)])
    name = StringField('Name', validators=[DataRequired(), Length(min=2, max=250)])
    submit = SubmitField('Sign Me Up!')


class LoginForm(FlaskForm):
    email = StringField(
        'Email',
        validators=[
            DataRequired(),
            Length(max=250),
            Regexp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', message='Enter a valid email address.'),
        ],
    )
    password = PasswordField('Password', validators=[DataRequired(), Length(max=128)])
    submit = SubmitField('Let Me In!')


class CommentForm(FlaskForm):
    comment_text = CKEditorField('Comment', validators=[DataRequired(), Length(max=5000)])
    submit = SubmitField('Submit Comment')


class ContactForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired(), Length(min=2, max=250)])
    email = StringField(
        'Email',
        validators=[
            DataRequired(),
            Length(max=250),
            Regexp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', message='Enter a valid email address.'),
        ],
    )
    phone = StringField(
        'Phone',
        validators=[
            DataRequired(),
            Length(min=7, max=40),
            Regexp(r'^[0-9+()\-\.\s]+$', message='Enter a valid phone number.'),
        ],
    )
    message = TextAreaField('Message', validators=[DataRequired(), Length(min=10, max=5000)])
    submit = SubmitField('Send Message')


class ActionForm(FlaskForm):
    submit = SubmitField('Submit')
