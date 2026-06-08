"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-08

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("affiliation", sa.String(50), nullable=True),
        sa.Column("cert_level", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "diver_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("reef_site_id", sa.String(100), nullable=False),
        sa.Column("diver_name", sa.String(200), nullable=True),
        sa.Column("dive_date", sa.Date(), nullable=False),
        sa.Column("depth_m", sa.Float(), nullable=True),
        sa.Column("coral_cover_pct", sa.Float(), nullable=True),
        sa.Column("bleaching_pct", sa.Float(), nullable=True),
        sa.Column("bleaching_severity", sa.String(20), nullable=True),
        sa.Column("water_temp_c", sa.Float(), nullable=True),
        sa.Column("visibility_m", sa.Float(), nullable=True),
        sa.Column("species_notes", sa.Text(), nullable=True),
        sa.Column("general_notes", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diver_logs_reef_site_id", "diver_logs", ["reef_site_id"])
    op.create_index("ix_diver_logs_user_id", "diver_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_diver_logs_user_id", table_name="diver_logs")
    op.drop_index("ix_diver_logs_reef_site_id", table_name="diver_logs")
    op.drop_table("diver_logs")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
