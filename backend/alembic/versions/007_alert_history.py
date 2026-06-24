"""Add alert_history table

Revision ID: 007
Revises: 006
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'alert_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reef_site_id', sa.String(100), nullable=False),
        sa.Column('alert_level', sa.Integer(), nullable=False),
        sa.Column('alert_label', sa.String(50), nullable=False),
        sa.Column('sst_c', sa.Float(), nullable=True),
        sa.Column('dhw', sa.Float(), nullable=True),
        sa.Column('hotspot', sa.Float(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_alert_history_reef_site_id', 'alert_history', ['reef_site_id'])
    op.create_index('ix_alert_history_recorded_at', 'alert_history', ['recorded_at'])


def downgrade() -> None:
    op.drop_index('ix_alert_history_recorded_at', 'alert_history')
    op.drop_index('ix_alert_history_reef_site_id', 'alert_history')
    op.drop_table('alert_history')
