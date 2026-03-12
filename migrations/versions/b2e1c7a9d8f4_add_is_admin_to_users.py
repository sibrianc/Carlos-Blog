"""Add is_admin to users.

Revision ID: b2e1c7a9d8f4
Revises: a1918f82ddf0
Create Date: 2026-03-12 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "b2e1c7a9d8f4"
down_revision = "a1918f82ddf0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "is_admin" not in columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false())
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "is_admin" in columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.drop_column("is_admin")
