"""Agregar parent_id y timestamp a Comment para respuestas

Revision ID: a1918f82ddf0
Revises: 
Create Date: 2024-10-28 20:34:19.672716

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1918f82ddf0'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('comments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('parent_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()))
        batch_op.create_foreign_key('fk_comment_parent_id', 'comments', ['parent_id'], ['id'])

def downgrade():
    with op.batch_alter_table('comments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_comment_parent_id', type_='foreignkey')
        batch_op.drop_column('timestamp')
        batch_op.drop_column('parent_id')


    # ### end Alembic commands ###
