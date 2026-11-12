"""Create core application tables

Revision ID: 488fcb5ed3ff
Revises:
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "488fcb5ed3ff"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "phishing_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("input_url", sa.String(), nullable=True),
        sa.Column("input_text", sa.String(), nullable=True),
        sa.Column("final_score", sa.Float(), nullable=True),
        sa.Column("verdict", sa.String(), nullable=True),
        sa.Column("reasons_jsonb", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_phishing_events_id", "phishing_events", ["id"], unique=False)
    op.create_index("ix_phishing_events_user_id", "phishing_events", ["user_id"], unique=False)
    op.create_index("ix_phishing_events_input_url", "phishing_events", ["input_url"], unique=False)
    op.create_index("ix_phishing_events_created_at", "phishing_events", ["created_at"], unique=False)

    op.create_table(
        "fraud_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("velocity", sa.Integer(), nullable=True),
        sa.Column("hour", sa.Integer(), nullable=True),
        sa.Column("geo_distance", sa.Float(), nullable=True),
        sa.Column("final_score", sa.Float(), nullable=True),
        sa.Column("verdict", sa.String(), nullable=True),
        sa.Column("reasons_jsonb", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fraud_events_id", "fraud_events", ["id"], unique=False)
    op.create_index("ix_fraud_events_user_id", "fraud_events", ["user_id"], unique=False)
    op.create_index("ix_fraud_events_created_at", "fraud_events", ["created_at"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_id", "chat_messages", ["id"], unique=False)
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_fraud_events_created_at", table_name="fraud_events")
    op.drop_index("ix_fraud_events_user_id", table_name="fraud_events")
    op.drop_index("ix_fraud_events_id", table_name="fraud_events")
    op.drop_table("fraud_events")
    op.drop_index("ix_phishing_events_created_at", table_name="phishing_events")
    op.drop_index("ix_phishing_events_input_url", table_name="phishing_events")
    op.drop_index("ix_phishing_events_user_id", table_name="phishing_events")
    op.drop_index("ix_phishing_events_id", table_name="phishing_events")
    op.drop_table("phishing_events")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
