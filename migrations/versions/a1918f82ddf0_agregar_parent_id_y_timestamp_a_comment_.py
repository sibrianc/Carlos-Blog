"""Create baseline blog schema with threaded comments support.

Revision ID: a1918f82ddf0
Revises:
Create Date: 2024-10-28 20:34:19.672716

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "a1918f82ddf0"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(inspector, table_name):
    return table_name in inspector.get_table_names()


def _column_names(inspector, table_name):
    return {column["name"] for column in inspector.get_columns(table_name)}


def _has_fk(inspector, table_name, constrained_columns, referred_table):
    for foreign_key in inspector.get_foreign_keys(table_name):
        if (
            foreign_key.get("referred_table") == referred_table
            and foreign_key.get("constrained_columns") == constrained_columns
        ):
            return True
    return False


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_table(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=250), nullable=False),
            sa.Column("password", sa.String(length=250), nullable=False),
            sa.Column("name", sa.String(length=250), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
        )

    inspector = inspect(bind)
    if not _has_table(inspector, "blog_posts"):
        op.create_table(
            "blog_posts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=250), nullable=False),
            sa.Column("subtitle", sa.String(length=250), nullable=False),
            sa.Column("date", sa.String(length=250), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("img_url", sa.String(length=250), nullable=False),
            sa.Column("author_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("title"),
        )

    inspector = inspect(bind)
    if not _has_table(inspector, "comments"):
        op.create_table(
            "comments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("author_id", sa.Integer(), nullable=False),
            sa.Column("post_id", sa.Integer(), nullable=False),
            sa.Column("parent_id", sa.Integer(), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["parent_id"], ["comments.id"]),
            sa.ForeignKeyConstraint(["post_id"], ["blog_posts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        return

    comment_columns = _column_names(inspector, "comments")
    with op.batch_alter_table("comments", schema=None) as batch_op:
        if "parent_id" not in comment_columns:
            batch_op.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
        if "timestamp" not in comment_columns:
            batch_op.add_column(
                sa.Column(
                    "timestamp",
                    sa.DateTime(timezone=True),
                    nullable=False,
                    server_default=sa.func.now(),
                )
            )

    inspector = inspect(bind)
    with op.batch_alter_table("comments", schema=None) as batch_op:
        if not _has_fk(inspector, "comments", ["author_id"], "users"):
            batch_op.create_foreign_key("fk_comments_author_id_users", "users", ["author_id"], ["id"])
        if not _has_fk(inspector, "comments", ["post_id"], "blog_posts"):
            batch_op.create_foreign_key("fk_comments_post_id_blog_posts", "blog_posts", ["post_id"], ["id"])
        if not _has_fk(inspector, "comments", ["parent_id"], "comments"):
            batch_op.create_foreign_key("fk_comment_parent_id", "comments", ["parent_id"], ["id"])


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if _has_table(inspector, "comments"):
        op.drop_table("comments")

    inspector = inspect(bind)
    if _has_table(inspector, "blog_posts"):
        op.drop_table("blog_posts")

    inspector = inspect(bind)
    if _has_table(inspector, "users"):
        op.drop_table("users")
