"""Add diver_log_photos table

Revision ID: 006
Revises: 005
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'diver_log_photos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diver_log_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('original_name', sa.String(500), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diver_log_id'], ['diver_logs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_diver_log_photos_diver_log_id', 'diver_log_photos', ['diver_log_id'])


def downgrade() -> None:
    op.drop_index('ix_diver_log_photos_diver_log_id', 'diver_log_photos')
    op.drop_table('diver_log_photos')
