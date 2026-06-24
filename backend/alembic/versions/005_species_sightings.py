"""Add species_sightings table

Revision ID: 005
Revises: 004
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'species_sightings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diver_log_id', sa.Integer(), nullable=False),
        sa.Column('species_name', sa.String(200), nullable=False),
        sa.Column('count', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diver_log_id'], ['diver_logs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_species_sightings_diver_log_id', 'species_sightings', ['diver_log_id'])


def downgrade() -> None:
    op.drop_index('ix_species_sightings_diver_log_id', 'species_sightings')
    op.drop_table('species_sightings')
