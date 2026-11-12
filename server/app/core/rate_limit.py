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
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 50_000):
        self.max_keys = max_keys
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
            if len(self._hits) >= self.max_keys:
                for k, queue in list(self._hits.items()):
                    self._prune(queue, now)
                    if not queue:
                        del self._hits[k]
            q = self._hits.get(key)
            if not q:
                return self.window if len(self._hits) >= self.max_keys else 0
            self._prune(q, now)
            if len(q) < self.limit:
                return 0
            return max(1, int(self.window - (now - q[0])))

    def record_failure(self, key: tuple[str, str]) -> None:
        now = time.monotonic()
        with self._lock:
            if key not in self._hits and len(self._hits) >= self.max_keys:
                for k, queue in list(self._hits.items()):
                    self._prune(queue, now)
                    if not queue:
                        del self._hits[k]
                if len(self._hits) >= self.max_keys:
                    return  # retry_after rejects new keys while capacity is exhausted
            q = self._hits.setdefault(key, deque(maxlen=self.limit))
            self._prune(q, now)
            q.append(now)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()

    def consume(self, key: tuple[str, str]) -> int:
        """Atomically check and record an expensive request; returns Retry-After."""
        with self._lock:
            now = time.monotonic()
            for k, q in list(self._hits.items()) if len(self._hits) >= self.max_keys else []:
                self._prune(q, now)
                if not q:
                    del self._hits[k]
            q = self._hits.get(key)
            if q is None:
                if len(self._hits) >= self.max_keys:
                    return self.window
                q = self._hits.setdefault(key, deque(maxlen=self.limit))
            self._prune(q, now)
            if len(q) >= self.limit:
                return max(1, int(self.window - (now - q[0])))
            q.append(now)
            return 0

    def reset(self, key: tuple[str, str]) -> None:
        with self._lock:
            self._hits.pop(key, None)
