"""Add projects and contact messages.

Revision ID: d4e5f6a7b8c9
Revises: c3f4d5e6a7b8
Create Date: 2026-04-12 12:40:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "d4e5f6a7b8c9"
down_revision = "c3f4d5e6a7b8"
branch_labels = None
depends_on = None


def _has_table(inspector, table_name):
    return table_name in inspector.get_table_names()


def _index_names(inspector, table_name):
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_table(inspector, "projects"):
        op.create_table(
            "projects",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=120), nullable=False),
            sa.Column("slug", sa.String(length=140), nullable=False),
            sa.Column("summary", sa.String(length=280), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("tagline", sa.String(length=160), nullable=True),
            sa.Column("problem", sa.String(length=280), nullable=True),
            sa.Column("outcome", sa.String(length=280), nullable=True),
            sa.Column("title_es", sa.String(length=120), nullable=True),
            sa.Column("summary_es", sa.String(length=280), nullable=True),
            sa.Column("description_es", sa.Text(), nullable=True),
            sa.Column("tagline_es", sa.String(length=160), nullable=True),
            sa.Column("problem_es", sa.String(length=280), nullable=True),
            sa.Column("outcome_es", sa.String(length=280), nullable=True),
            sa.Column("role_label", sa.String(length=120), nullable=True),
            sa.Column("project_year", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=True),
            sa.Column("display_order", sa.Integer(), nullable=True),
            sa.Column("tech_stack", sa.String(length=240), nullable=True),
            sa.Column("repo_url", sa.String(length=240), nullable=True),
            sa.Column("live_url", sa.String(length=240), nullable=True),
            sa.Column("cover_image", sa.String(length=500), nullable=True),
            sa.Column("video_url", sa.String(length=500), nullable=True),
            sa.Column("is_featured", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("slug"),
            sa.UniqueConstraint("title"),
        )
        op.create_index("ix_projects_slug", "projects", ["slug"], unique=False)
        op.create_index("ix_projects_status", "projects", ["status"], unique=False)
        op.create_index("ix_projects_display_order", "projects", ["display_order"], unique=False)
        op.create_index("ix_projects_is_featured", "projects", ["is_featured"], unique=False)

    inspector = inspect(bind)
    if not _has_table(inspector, "contact_messages"):
        op.create_table(
            "contact_messages",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=250), nullable=False),
            sa.Column("email", sa.String(length=250), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("processed", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_contact_messages_email", "contact_messages", ["email"], unique=False)
        op.create_index("ix_contact_messages_processed", "contact_messages", ["processed"], unique=False)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if _has_table(inspector, "contact_messages"):
        indexes = _index_names(inspector, "contact_messages")
        if "ix_contact_messages_processed" in indexes:
            op.drop_index("ix_contact_messages_processed", table_name="contact_messages")
        if "ix_contact_messages_email" in indexes:
            op.drop_index("ix_contact_messages_email", table_name="contact_messages")
        op.drop_table("contact_messages")

    inspector = inspect(bind)
    if _has_table(inspector, "projects"):
        indexes = _index_names(inspector, "projects")
        for index_name in (
            "ix_projects_is_featured",
            "ix_projects_display_order",
            "ix_projects_status",
            "ix_projects_slug",
        ):
            if index_name in indexes:
                op.drop_index(index_name, table_name="projects")
        op.drop_table("projects")
