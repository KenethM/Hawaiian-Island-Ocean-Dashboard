"""add site_subscriptions table

Revision ID: 003
Revises: 002
Create Date: 2026-06-10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reef_site_id", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "reef_site_id", name="uq_subscription_user_site"),
    )
    op.create_index("ix_site_subscriptions_user_id", "site_subscriptions", ["user_id"])
    op.create_index("ix_site_subscriptions_reef_site_id", "site_subscriptions", ["reef_site_id"])


def downgrade() -> None:
    op.drop_index("ix_site_subscriptions_reef_site_id", table_name="site_subscriptions")
    op.drop_index("ix_site_subscriptions_user_id", table_name="site_subscriptions")
    op.drop_table("site_subscriptions")
