"""initial schema

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("daily_budget_cents", sa.BigInteger, nullable=False),
        sa.Column("max_bid_cents", sa.BigInteger, nullable=False),
        sa.Column("keywords", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_campaigns_status", "campaigns", ["status"])
    op.create_table(
        "usage_events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("campaign_id", sa.String(36), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("impressions", sa.BigInteger, nullable=False),
        sa.Column("clicks", sa.BigInteger, nullable=False),
        sa.Column("spend_cents", sa.BigInteger, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_usage_events_campaign_id", "usage_events", ["campaign_id"])
    op.create_table(
        "report_aggregates",
        sa.Column("campaign_id", sa.String(36), sa.ForeignKey("campaigns.id"), primary_key=True),
        sa.Column("impressions", sa.BigInteger, nullable=False),
        sa.Column("clicks", sa.BigInteger, nullable=False),
        sa.Column("spend_cents", sa.BigInteger, nullable=False),
        sa.Column("last_event_id", sa.Integer, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("report_aggregates")
    op.drop_index("ix_usage_events_campaign_id", "usage_events")
    op.drop_table("usage_events")
    op.drop_index("ix_campaigns_status", "campaigns")
    op.drop_table("campaigns")
