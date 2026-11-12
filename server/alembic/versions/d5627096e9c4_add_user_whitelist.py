"""Create user allow and block lists

Revision ID: d5627096e9c4
Revises: a5e57be01428
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d5627096e9c4"
down_revision: Union[str, Sequence[str], None] = "a5e57be01428"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_whitelists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_whitelists_id", "user_whitelists", ["id"], unique=False)
    op.create_index("ix_user_whitelists_user_id", "user_whitelists", ["user_id"], unique=False)
    op.create_index("ix_user_whitelists_domain", "user_whitelists", ["domain"], unique=False)
    op.create_index("ix_user_whitelists_created_at", "user_whitelists", ["created_at"], unique=False)
    op.create_index("ix_user_whitelist_user_domain", "user_whitelists", ["user_id", "domain"], unique=False)

    op.create_table(
        "user_blocklists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_blocklists_id", "user_blocklists", ["id"], unique=False)
    op.create_index("ix_user_blocklists_user_id", "user_blocklists", ["user_id"], unique=False)
    op.create_index("ix_user_blocklists_domain", "user_blocklists", ["domain"], unique=False)
    op.create_index("ix_user_blocklists_created_at", "user_blocklists", ["created_at"], unique=False)
    op.create_index("ix_user_blocklist_user_domain", "user_blocklists", ["user_id", "domain"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_blocklist_user_domain", table_name="user_blocklists")
    op.drop_index("ix_user_blocklists_created_at", table_name="user_blocklists")
    op.drop_index("ix_user_blocklists_domain", table_name="user_blocklists")
    op.drop_index("ix_user_blocklists_user_id", table_name="user_blocklists")
    op.drop_index("ix_user_blocklists_id", table_name="user_blocklists")
    op.drop_table("user_blocklists")
    op.drop_index("ix_user_whitelist_user_domain", table_name="user_whitelists")
    op.drop_index("ix_user_whitelists_created_at", table_name="user_whitelists")
    op.drop_index("ix_user_whitelists_domain", table_name="user_whitelists")
    op.drop_index("ix_user_whitelists_user_id", table_name="user_whitelists")
    op.drop_index("ix_user_whitelists_id", table_name="user_whitelists")
    op.drop_table("user_whitelists")
