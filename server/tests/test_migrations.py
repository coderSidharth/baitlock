"""Exercise deployed migration paths against disposable SQLite databases."""
import os
from pathlib import Path
import sqlite3
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def migrate(database, *arguments):
    env = dict(os.environ, DATABASE_URL=f"sqlite:///{database}", ENVIRONMENT="development")
    subprocess.run([sys.executable, "-B", "-m", "alembic", "-c", str(ROOT / "server/alembic.ini"), *arguments],
                   cwd=ROOT, env=env, check=True, capture_output=True, text=True)


def test_fresh_migration_and_downgrade_roundtrip(tmp_path):
    database = tmp_path / "fresh.db"
    migrate(database, "upgrade", "head")
    with sqlite3.connect(database) as connection:
        assert "token_id" in {row[1] for row in connection.execute("PRAGMA table_info(user_sessions)")}
        assert "is_active" in {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        assert "cache_key" in {row[1] for row in connection.execute("PRAGMA table_info(phishing_events)")}
    migrate(database, "downgrade", "f3b1c6d2a907")
    with sqlite3.connect(database) as connection:
        assert "token_id" not in {row[1] for row in connection.execute("PRAGMA table_info(user_sessions)")}
    migrate(database, "upgrade", "head")


def test_legacy_migration_deduplicates_votes_and_lists_and_revokes_sessions(tmp_path):
    database = tmp_path / "legacy.db"
    migrate(database, "upgrade", "f3b1c6d2a907")
    with sqlite3.connect(database) as connection:
        connection.execute("INSERT INTO users (id,email,hashed_password) VALUES (1,'legacy@example.com','hash')")
        connection.execute("INSERT INTO user_sessions (user_id,ip_address) VALUES (1,'192.168.1.99')")
        connection.executemany("INSERT INTO user_whitelists (user_id,domain) VALUES (1,?)",
                               [("duplicate.example",), ("duplicate.example",), ("conflict.example",)])
        connection.executemany("INSERT INTO user_blocklists (user_id,domain) VALUES (1,?)",
                               [("conflict.example",), ("conflict.example",)])
        connection.executemany("INSERT INTO company_flags (user_id,domain,flag_type) VALUES (1,'vote.example',?)",
                               [("legitimate",), ("malicious",)])
    migrate(database, "upgrade", "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT is_active FROM users").fetchone() == (1,)
        assert connection.execute("SELECT COUNT(*) FROM user_sessions").fetchone() == (0,)
        assert connection.execute("SELECT domain FROM user_whitelists").fetchall() == [("duplicate.example",)]
        assert connection.execute("SELECT domain FROM user_blocklists").fetchall() == [("conflict.example",)]
        assert connection.execute("SELECT flag_type FROM company_flags").fetchall() == [("malicious",)]
        indexes = {row[1]: row[2] for row in connection.execute("PRAGMA index_list(user_whitelists)")}
        assert indexes["ix_user_whitelist_user_domain"] == 1


def test_unconstrained_legacy_company_votes_are_deduplicated_before_repair(tmp_path):
    database = tmp_path / "unconstrained-legacy.db"
    migrate(database, "upgrade", "eeb12aaa3456")
    with sqlite3.connect(database) as connection:
        # Older create_all installations may have this table without the named
        # unique constraint that the repair migration installs.
        connection.execute("DROP TABLE company_flags")
        connection.execute("CREATE TABLE company_flags (id INTEGER PRIMARY KEY, domain VARCHAR NOT NULL, flag_type VARCHAR NOT NULL, user_id INTEGER, created_at DATETIME)")
        connection.execute("INSERT INTO users (id,email,hashed_password) VALUES (1,'legacy@example.com','hash')")
        connection.executemany("INSERT INTO company_flags (id,user_id,domain,flag_type) VALUES (?,1,'duplicate.example',?)",
                               [(1, "malicious"), (2, "malicious"), (3, "legitimate")])
    migrate(database, "upgrade", "f3b1c6d2a907")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT id FROM company_flags ORDER BY id").fetchall() == [(2,), (3,)]
    migrate(database, "upgrade", "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT id,flag_type FROM company_flags").fetchall() == [(3, "legitimate")]
