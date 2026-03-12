"""Add rate_limit_events table.

Revision ID: c3f4d5e6a7b8
Revises: b2e1c7a9d8f4
Create Date: 2026-03-12 00:00:01.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "c3f4d5e6a7b8"
down_revision = "b2e1c7a9d8f4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "rate_limit_events" not in table_names:
        op.create_table(
            "rate_limit_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("scope", sa.String(length=50), nullable=False),
            sa.Column("identifier_hash", sa.String(length=64), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_rate_limit_events_scope_identifier_created_at",
            "rate_limit_events",
            ["scope", "identifier_hash", "created_at"],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "rate_limit_events" in table_names:
        index_names = {index["name"] for index in inspector.get_indexes("rate_limit_events")}
        if "ix_rate_limit_events_scope_identifier_created_at" in index_names:
            op.drop_index(
                "ix_rate_limit_events_scope_identifier_created_at",
                table_name="rate_limit_events",
            )
        op.drop_table("rate_limit_events")
