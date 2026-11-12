FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_LINK_MODE=copy
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv==0.11.28 \
    && useradd --uid 10001 --create-home baitlock \
    && mkdir /data && chown baitlock:baitlock /data
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY --chown=baitlock:baitlock app ./app
COPY --chown=baitlock:baitlock alembic ./alembic
COPY --chown=baitlock:baitlock alembic.ini start.sh ./
RUN chmod +x start.sh
USER baitlock
ENV DATABASE_URL=sqlite:////data/events.db
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD ["/app/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/ready', timeout=3)"]
CMD ["/app/start.sh"]
