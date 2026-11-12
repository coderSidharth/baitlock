"""Create schema objects missing from earlier no-op migrations.

Revision ID: f3b1c6d2a907
Revises: eeb12aaa3456
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f3b1c6d2a907"
down_revision: Union[str, Sequence[str], None] = "eeb12aaa3456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _schema_metadata() -> sa.MetaData:
    metadata = sa.MetaData()
    sa.Table(
        "users", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_users_id", "id"),
        sa.Index("ix_users_email", "email", unique=True),
    )
    sa.Table(
        "phishing_events", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("input_url", sa.String(), index=True),
        sa.Column("input_text", sa.String()),
        sa.Column("final_score", sa.Float()),
        sa.Column("verdict", sa.String()),
        sa.Column("reasons_jsonb", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), index=True),
        sa.Index("ix_phishing_events_id", "id"),
    )
    sa.Table(
        "fraud_events", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("amount", sa.Float()),
        sa.Column("velocity", sa.Integer()),
        sa.Column("hour", sa.Integer()),
        sa.Column("geo_distance", sa.Float()),
        sa.Column("final_score", sa.Float()),
        sa.Column("verdict", sa.String()),
        sa.Column("reasons_jsonb", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), index=True),
        sa.Index("ix_fraud_events_id", "id"),
    )
    sa.Table(
        "chat_messages", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_chat_messages_id", "id"),
    )
    sa.Table(
        "company_flags", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("domain", sa.String(), nullable=False, index=True),
        sa.Column("flag_type", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.UniqueConstraint("user_id", "domain", "flag_type", name="uq_user_domain_flag"),
        sa.Index("ix_company_flags_id", "id"),
    )
    sa.Table(
        "user_whitelists", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("domain", sa.String(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), index=True),
        sa.Index("ix_user_whitelists_id", "id"),
        sa.Index("ix_user_whitelist_user_domain", "user_id", "domain"),
    )
    sa.Table(
        "user_blocklists", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("domain", sa.String(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), index=True),
        sa.Index("ix_user_blocklists_id", "id"),
        sa.Index("ix_user_blocklist_user_domain", "user_id", "domain"),
    )
    sa.Table(
        "user_sessions", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip_address", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_user_sessions_id", "id"),
    )
    return metadata


def upgrade() -> None:
    bind = op.get_bind()
    metadata = _schema_metadata()
    metadata.create_all(bind=bind, checkfirst=True)
    # create_all skips indexes when a legacy table already exists; repair those too.
    for table in metadata.sorted_tables:
        for index in table.indexes:
            index.create(bind=bind, checkfirst=True)

    inspector = sa.inspect(bind)
    if "company_flags" in inspector.get_table_names():
        existing = {c["name"] for c in inspector.get_unique_constraints("company_flags")}
        if "uq_user_domain_flag" not in existing:
            # Unconstrained legacy tables can already contain duplicate votes.
            # Repair those before creating the constraint, retaining the latest.
            op.execute(sa.text("DELETE FROM company_flags WHERE id NOT IN "
                               "(SELECT MAX(id) FROM company_flags GROUP BY user_id, domain, flag_type)"))
            with op.batch_alter_table("company_flags") as batch_op:
                batch_op.create_unique_constraint(
                    "uq_user_domain_flag", ["user_id", "domain", "flag_type"]
                )


def downgrade() -> None:
    # This is a repair migration: deleting recovered production tables on downgrade
    # would destroy application data, so the recovery is intentionally irreversible.
    pass
