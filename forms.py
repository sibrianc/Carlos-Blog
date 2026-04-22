from flask_ckeditor import CKEditorField
from flask_wtf import FlaskForm
from wtforms import BooleanField, IntegerField, PasswordField, SelectField, StringField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Length, NumberRange, Optional, Regexp, URL


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
    message = TextAreaField('Message', validators=[DataRequired(), Length(min=10, max=5000)])
    submit = SubmitField('Send Message')


class ActionForm(FlaskForm):
    submit = SubmitField('Submit')


class ProjectForm(FlaskForm):
    title = StringField('Title', validators=[DataRequired(), Length(max=120)])
    slug = StringField('Slug', validators=[DataRequired(), Length(max=140)])
    tagline = StringField('Tagline', validators=[Length(max=160)])
    summary = StringField('Summary', validators=[Length(max=280)])
    problem = StringField('Problem', validators=[Length(max=280)])
    outcome = StringField('Outcome', validators=[Length(max=280)])
    description = TextAreaField('Description')

    title_es = StringField('Title ES', validators=[Length(max=120)])
    tagline_es = StringField('Tagline ES', validators=[Length(max=160)])
    summary_es = StringField('Summary ES', validators=[Length(max=280)])
    problem_es = StringField('Problem ES', validators=[Length(max=280)])
    outcome_es = StringField('Outcome ES', validators=[Length(max=280)])
    description_es = TextAreaField('Description ES')

    role_label = StringField('Role Label', validators=[Length(max=120)])
    project_year = IntegerField('Project Year', validators=[Optional(), NumberRange(min=2010, max=2100)])
    status = SelectField(
        'Status',
        choices=[('live', 'Live'), ('beta', 'Beta'), ('archived', 'Archived')],
        validators=[DataRequired()],
        default='live',
    )
    display_order = IntegerField('Display Order', validators=[Optional(), NumberRange(min=0, max=9999)], default=0)
    tech_stack = StringField('Tech Stack', validators=[Length(max=240)])
    repo_url = StringField('Repo URL', validators=[Length(max=240)])
    live_url = StringField('Live URL', validators=[Length(max=240)])
    cover_image = StringField('Cover Image URL', validators=[Length(max=500)])
    video_url = StringField('Video URL', validators=[Length(max=500)])
    is_featured = BooleanField('Featured')
    submit = SubmitField('Save Project')
