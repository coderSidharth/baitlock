"""Create user sessions

Revision ID: eeb12aaa3456
Revises: d5627096e9c4
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "eeb12aaa3456"
down_revision: Union[str, Sequence[str], None] = "d5627096e9c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_sessions_id", "user_sessions", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_sessions_id", table_name="user_sessions")
    op.drop_table("user_sessions")
