"""Credential/session races use independent connections to disposable SQLite."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event, get_ident

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from .test_api_production import Base  # Registers all application models.
from app.core.security import get_password_hash
from app.features.auth import models, router, schemas

OLD_PASSWORD = "old-password-long"
NEW_PASSWORD = "new-password-long"


@pytest.fixture
def sessions(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'race.db'}", connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def enforce_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False)
    with factory() as db:
        db.add(models.User(email="race@example.com", hashed_password=get_password_hash(OLD_PASSWORD)))
        db.commit()
    router.login_limiter.clear()
    yield factory
    engine.dispose()


@pytest.mark.parametrize("change", ["password", "delete", "disable", "email"])
def test_login_rechecks_account_after_concurrent_account_change(sessions, monkeypatch, change):
    snapshot_loaded, resume_login = Event(), Event()
    login_thread = []

    # Pause after the login SELECT has materialized the old account snapshot,
    # permitting another connection to commit an account change before issuance.
    def pause_snapshot(user, context):
        if login_thread and get_ident() == login_thread[0] and not snapshot_loaded.is_set():
            snapshot_loaded.set()
            assert resume_login.wait(5)

    event.listen(models.User, "load", pause_snapshot)
    def sign_in():
        login_thread.append(get_ident())
        with sessions() as db:
            request = Request({"type": "http", "client": ("127.0.0.1", 1234)})
            return router._login_credentials(request, db, "race@example.com", OLD_PASSWORD)
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(sign_in)
            assert snapshot_loaded.wait(5)
            try:
                with sessions() as db:
                    user = db.query(models.User).first()
                    if change == "password":
                        router.update_user_me(schemas.UserUpdate(password=NEW_PASSWORD, current_password=OLD_PASSWORD), user, db)
                    elif change == "delete":
                        router.delete_user_me(schemas.UserDeleteConfirm(current_password=OLD_PASSWORD), user, db)
                    elif change == "email":
                        router.update_user_me(schemas.UserUpdate(email="changed@example.com", current_password=OLD_PASSWORD), user, db)
                    else:
                        user.is_active = False
                        db.commit()
            finally:
                resume_login.set()
            with pytest.raises(HTTPException) as error:
                future.result(timeout=5)
            assert error.value.status_code == 401
    finally:
        resume_login.set()
        event.remove(models.User, "load", pause_snapshot)
    with sessions() as db:
        assert db.query(models.UserSession).count() == 0


@pytest.mark.parametrize("action", ["password", "delete"])
def test_sensitive_action_rechecks_current_password_after_concurrent_change(sessions, action):
    with sessions() as stale_db:
        stale_user = stale_db.query(models.User).first()
        with sessions() as fresh_db:
            user = fresh_db.query(models.User).first()
            router.update_user_me(schemas.UserUpdate(password=NEW_PASSWORD, current_password=OLD_PASSWORD), user, fresh_db)
        with pytest.raises(HTTPException) as error:
            if action == "delete":
                router.delete_user_me(schemas.UserDeleteConfirm(current_password=OLD_PASSWORD), stale_user, stale_db)
            else:
                router.update_user_me(schemas.UserUpdate(password="attacker-password", current_password=OLD_PASSWORD), stale_user, stale_db)
        assert error.value.status_code in (400, 403)
    with sessions() as db:
        assert db.query(models.User).count() == 1
