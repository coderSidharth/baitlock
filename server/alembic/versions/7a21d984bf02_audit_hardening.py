"""Session activation, exact URL caching, and unique user domain decisions.

Revision ID: 7a21d984bf02
Revises: f3b1c6d2a907
"""
from alembic import op
import sqlalchemy as sa

revision = "7a21d984bf02"
down_revision = "f3b1c6d2a907"
branch_labels = None
depends_on = None


def upgrade():
    # Existing JWTs were not bound to a unique session nonce. Re-authentication
    # avoids resurrecting revoked tokens when SQLite reuses a deleted row id.
    op.execute(sa.text("DELETE FROM user_sessions"))
    op.add_column("user_sessions", sa.Column("token_id", sa.String(36), nullable=False))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("phishing_events", sa.Column("cache_key", sa.String(64), nullable=True))
    op.create_index("ix_phishing_events_cache_key", "phishing_events", ["cache_key"])
    for table, index in (("user_whitelists", "ix_user_whitelist_user_domain"),
                         ("user_blocklists", "ix_user_blocklist_user_domain")):
        # Keep the latest duplicate decision; retain all distinct user/domain pairs.
        op.execute(sa.text(f"DELETE FROM {table} WHERE id NOT IN (SELECT MAX(id) FROM {table} GROUP BY user_id, domain)"))
        op.drop_index(index, table_name=table)
        op.create_index(index, table, ["user_id", "domain"], unique=True)
    op.execute(sa.text("DELETE FROM user_whitelists WHERE EXISTS (SELECT 1 FROM user_blocklists b WHERE b.user_id = user_whitelists.user_id AND b.domain = user_whitelists.domain)"))
    op.execute(sa.text("DELETE FROM company_flags WHERE id NOT IN (SELECT MAX(id) FROM company_flags GROUP BY user_id, domain)"))
    op.create_index("uq_user_domain_vote", "company_flags", ["user_id", "domain"], unique=True)
    # Historical raw addresses are unnecessary; new sessions store network prefixes.
    op.execute(sa.text("UPDATE user_sessions SET ip_address = NULL"))


def downgrade():
    op.execute(sa.text("DELETE FROM user_sessions"))
    with op.batch_alter_table("user_sessions") as batch:
        batch.drop_column("token_id")
    op.drop_index("uq_user_domain_vote", table_name="company_flags")
    for table, index in (("user_whitelists", "ix_user_whitelist_user_domain"),
                         ("user_blocklists", "ix_user_blocklist_user_domain")):
        op.drop_index(index, table_name=table)
        op.create_index(index, table, ["user_id", "domain"])
    op.drop_index("ix_phishing_events_cache_key", table_name="phishing_events")
    with op.batch_alter_table("phishing_events") as batch:
        batch.drop_column("cache_key")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("is_active")
