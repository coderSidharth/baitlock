"""
Minimal in-process sliding-window limiter for failed logins.

Keyed by (client IP, account email) so one attacker cannot lock out a user from
everywhere, and one IP cannot spray a single account. State is per process: with
several workers or instances, put a shared limiter (e.g. Redis or the reverse
proxy) in front for a strict global limit.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class FailedLoginLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[tuple[str, str], deque] = {}
        self._lock = threading.Lock()

    def _prune(self, q: deque, now: float) -> None:
        while q and now - q[0] > self.window:
            q.popleft()

    def retry_after(self, key: tuple[str, str]) -> int:
        """Seconds until another attempt is allowed (0 = allowed now)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits.get(key)
            if not q:
                return 0
            self._prune(q, now)
            if len(q) < self.limit:
                return 0
            return max(1, int(self.window - (now - q[0])))

    def record_failure(self, key: tuple[str, str]) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            self._prune(q, now)
            q.append(now)
            if len(self._hits) > 50_000:  # bound memory under attack
                for k in [k for k, v in self._hits.items() if not v][:10_000]:
                    self._hits.pop(k, None)

    def reset(self, key: tuple[str, str]) -> None:
        with self._lock:
            self._hits.pop(key, None)
