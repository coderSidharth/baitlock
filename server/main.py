"""
Root main.py entrypoint wrapper for Uvicorn compatibility.
Forwards to app.main:app.
"""
from app.main import app  # noqa: F401 -- re-exported for `uvicorn main:app`
