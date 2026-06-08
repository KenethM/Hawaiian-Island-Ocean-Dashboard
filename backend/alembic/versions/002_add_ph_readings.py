"""add ph_readings table

Revision ID: 002
Revises: 001
Create Date: 2026-06-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ph_readings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ph", sa.Float(), nullable=True),
        sa.Column("pco2", sa.Float(), nullable=True),
        sa.Column("aragonite_sat", sa.Float(), nullable=True),
        sa.Column("data_type", sa.String(20), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ph_readings_source", "ph_readings", ["source"])
    op.create_index("ix_ph_readings_measured_at", "ph_readings", ["measured_at"])
    op.create_index("ix_ph_readings_data_type", "ph_readings", ["data_type"])


def downgrade() -> None:
    op.drop_index("ix_ph_readings_data_type", table_name="ph_readings")
    op.drop_index("ix_ph_readings_measured_at", table_name="ph_readings")
    op.drop_index("ix_ph_readings_source", table_name="ph_readings")
    op.drop_table("ph_readings")
