"""Build a consistent, least-permission extension package for a chosen deployment."""
import argparse
import json
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def origin(value, production):
    url = urlsplit(value)
    if not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError("Use an absolute URL without credentials, query or fragment")
    if url.scheme != "https" and not (not production and url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"}):
        raise ValueError("HTTPS is required outside local development")
    return f"{url.scheme}://{url.netloc}"


def build(api, app, production, output):
    api_origin, app_origin = origin(api, production), origin(app, production)
    if app.rstrip("/") != app_origin:
        raise ValueError("The dashboard URL must be an origin without a path")
    config = (ROOT / "extension/config.js").read_text().replace('"development"', json.dumps("production" if production else "development"), 1)
    config = config.replace('"http://localhost:8000/api/v1"', json.dumps(api.rstrip("/"))).replace('"http://localhost:3000"', json.dumps(app_origin))
    manifest = json.loads((ROOT / "extension/manifest.json").read_text())
    app_origins = [app_origin]
    api_origins = [api_origin]
    if not production and "localhost" in app_origin:
        app_origins.append(app_origin.replace("localhost", "127.0.0.1"))
    if not production and "localhost" in api_origin:
        api_origins.append(api_origin.replace("localhost", "127.0.0.1"))
    manifest["host_permissions"] = [f"{o}/*" for o in dict.fromkeys(api_origins + app_origins)]
    manifest["content_scripts"][0]["matches"] = [f"{o}/*" for o in app_origins]
    manifest["content_security_policy"]["extension_pages"] = (
        "script-src 'self'; object-src 'none'; connect-src 'self' " + " ".join(api_origins) +
        "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
    )
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Build atomically so the dashboard never serves a partial archive.
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".zip", delete=False) as tmp:
        name = Path(tmp.name)
    try:
        with zipfile.ZipFile(name, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted((ROOT / "extension").rglob("*")):
                if not path.is_file() or path.suffix not in {".js", ".html", ".css", ".json", ".png"}:
                    continue
                rel = str(path.relative_to(ROOT / "extension"))
                data = config if rel == "config.js" else json.dumps(manifest, indent=2) if rel == "manifest.json" else path.read_bytes()
                archive.writestr(rel, data)
        name.replace(output)
    finally:
        name.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:8000/api/v1")
    parser.add_argument("--app", default="http://localhost:3000")
    parser.add_argument("--production", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "client/public/baitlock-extension.zip")
    args = parser.parse_args()
    try:
        build(args.api, args.app, args.production, args.output)
    except ValueError as exc:
        parser.error(str(exc))
