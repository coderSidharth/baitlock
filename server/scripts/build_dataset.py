#!/usr/bin/env python3
"""
Build the Baitlock phishing-URL training dataset from public sources.

Produces a balanced, de-duplicated, de-biased CSV (url,label,source) that
`train.py --csv` consumes. Raw downloads and the output are NOT committed
(see .gitignore); the trained model artifact is.

Sources (label 1 = phishing/malicious, 0 = benign):
  1  Phishing.Database ACTIVE list (mitchellkrogza)         live phishing URLs
  1  PhishTank verified online-valid snapshot                verified phishing
  1  Repo sample data/phishtank_sample.csv                   PhishTank sample
  1  faizann24 malicious-URL dataset ("bad")                 malicious URLs
  0  ISCX-URL-2016 benign list                               benign full URLs
  0  faizann24 malicious-URL dataset ("good")                benign full URLs
  0  Cisco Umbrella top-1M (popularity-ranked hostnames)     benign hostnames

De-biasing steps (so the model learns URL structure, not source "style"):
  * keep only http/https (or scheme-less) URLs, drop fragments/whitespace
  * exact de-duplication on the scheme-less canonical form
  * cap URLs per registered domain (diversity + less train/test leakage)
  * drop benign rows whose host also appears in a phishing feed
  * drop phishing rows that are bare popular domains (feed noise)
  * mix host-only and full-path URLs in the SAME proportion in both classes
    (otherwise "has a path" alone would predict the label)

Usage:
  uv run python scripts/build_dataset.py --raw-dir /tmp/baitlock-raw
  uv run python scripts/build_dataset.py --raw-dir /tmp/baitlock-raw --per-class 100000
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import requests
import tldextract

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.features.phishing.features import FREE_HOSTING, RISKY_TLDS, SHORTENERS  # noqa: E402
from app.features.phishing.reputation import MULTI_TENANT_DOMAINS, POPULAR_DOMAINS_PATH  # noqa: E402

SERVER_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUT = SERVER_DIR / "data" / "training" / "urls.csv"
REPO_SAMPLE = SERVER_DIR / "data" / "phishtank_sample.csv"

SOURCES = {
    "phishdb_active.txt": "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-links-ACTIVE.txt",
    "phishtank_valid.csv": "https://raw.githubusercontent.com/shreyagopal/Phishing-Website-Detection-by-Machine-Learning-Techniques/master/DataFiles/2.online-valid.csv",
    "iscx_benign.csv": "https://raw.githubusercontent.com/shreyagopal/Phishing-Website-Detection-by-Machine-Learning-Techniques/master/DataFiles/1.Benign_list_big_final.csv",
    "faizann24.csv": "https://raw.githubusercontent.com/faizann24/Using-machine-learning-to-detect-malicious-URLs/master/data/data.csv",
    "umbrella.zip": "https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip",
}

# Offline public-suffix handling (same as the runtime feature extractor).
_tld = tldextract.TLDExtract(suffix_list_urls=())


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(raw_dir: Path) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        dest = raw_dir / name
        if dest.exists() and dest.stat().st_size > 0:
            continue
        print(f"[*] Downloading {name} ...")
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)


def canonical(raw: str) -> str | None:
    """Return a scheme-less canonical URL ('host/path?query'), or None if unusable."""
    if not raw:
        return None
    u = raw.strip().strip('"').strip("'")
    if not u or any(c.isspace() for c in u) or len(u) > 2048:
        return None
    if "://" in u:
        scheme = u.split("://", 1)[0].lower()
        if scheme not in ("http", "https"):
            return None
        u = u.split("://", 1)[1]
    u = re.sub(r"^www\d*\.", "", u, flags=re.I)
    try:
        parts = urlsplit("http://" + u)
        host = (parts.hostname or "").lower().rstrip(".")
    except ValueError:
        return None
    if not host or "." not in host:
        return None
    netloc = host + (f":{parts.port}" if parts.port else "")
    if parts.username:  # keep userinfo tricks, they are a real phishing signal
        netloc = f"{parts.username}@{netloc}"
    path = parts.path if parts.path not in ("", "/") else ""
    query = f"?{parts.query}" if parts.query else ""
    return f"{netloc}{path}{query}"


def host_of(canon: str) -> str:
    return urlsplit("http://" + canon).hostname or ""


def registered_domain(host: str) -> str:
    ext = _tld(host)
    if ext.domain and ext.suffix:
        return f"{ext.domain}.{ext.suffix}"
    return ext.domain or host


def is_host_only(canon: str) -> bool:
    return "/" not in canon and "?" not in canon


# --------------------------------------------------------------------------- #
# Source loaders -> iterables of canonical URLs
# --------------------------------------------------------------------------- #
def load_lines(path: Path):
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            c = canonical(line)
            if c:
                yield c


def load_csv_col(path: Path, col: str | int, label_filter=None, label_col=None):
    with open(path, encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        idx = header.index(col) if isinstance(col, str) else col
        lidx = header.index(label_col) if label_col else None
        for row in reader:
            if len(row) <= idx:
                continue
            if label_filter is not None and (lidx is None or row[lidx].strip().lower() != label_filter):
                continue
            c = canonical(row[idx])
            if c:
                yield c


def load_iscx(path: Path):
    # Header-less: one URL per line (first line is a URL too).
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            c = canonical(line.split(",")[0])
            if c:
                yield c


def load_umbrella(raw_dir: Path, top_n: int):
    csv_path = raw_dir / "top-1m.csv"
    if not csv_path.exists():
        with zipfile.ZipFile(raw_dir / "umbrella.zip") as z:
            z.extract("top-1m.csv", raw_dir)
    ranked = []
    with open(csv_path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = line.strip().split(",", 1)
            if len(parts) != 2:
                continue
            rank, host = int(parts[0]), parts[1].lower().rstrip(".")
            if rank > top_n:
                break
            c = canonical(host)
            if c:
                ranked.append(c)
    return ranked


# --------------------------------------------------------------------------- #
# Reputable-domain augmentation
# --------------------------------------------------------------------------- #
# Public benign feeds are dominated by small static sites and almost never
# contain sign-in, account, checkout or OAuth URLs — but those are exactly the
# legitimate pages users visit daily, and they share vocabulary with phishing
# ("login", "account", "verify"). Without them a lexical model learns
# "keyword => phishing" and blocks real banks. We therefore synthesise
# realistic URLs on genuinely established domains. These rows are used for
# TRAINING ONLY; train.py excludes them from the evaluation split.
_WORDS = ["pricing", "features", "settings", "profile", "orders", "returns", "shipping",
          "electronics", "shoes", "laptops", "travel", "news", "world", "sports",
          "technology", "finance", "health", "guides", "faq", "privacy", "terms",
          "security", "reviews", "deals", "gift-cards", "careers", "press",
          "community", "forum", "events", "home", "garden", "kitchen", "music",
          "movies", "books", "beauty", "kids", "outdoor", "business", "science"]
_SUBS = ["", "", "", "www.", "www.", "app.", "account.", "accounts.", "login.", "secure.",
         "my.", "support.", "help.", "shop.", "docs.", "mail.", "portal.", "online.", "id.", "auth."]
_TEMPLATES = [
    "/login", "/signin", "/sign-in", "/log-in", "/account", "/account/login",
    "/account/settings", "/my-account", "/user/login?next=%2Fdashboard",
    "/auth/login?redirect=%2Fhome", "/oauth/authorize?client_id={hex}&redirect_uri=https%3A%2F%2F{d}%2Fcallback&response_type=code&scope=openid",
    "/dashboard", "/settings/security", "/billing", "/billing/payment-methods",
    "/support", "/help/article/{n}", "/search?q={w}", "/search?q={w}+{w}&page={s}",
    "/products/{slug}-{n}", "/p/{slug}/{n}", "/category/{w}/{w}",
    "/blog/{y}/{m}/{slug}", "/news/{y}/{m}/{dd}/{slug}.html", "/en-us/{w}/{w}",
    "/docs/{w}/{w}", "/cart", "/checkout", "/orders/{n}", "/track?id={N}",
    "/profile/{w}{s}", "/watch?v={hex}", "/@{w}", "/index.html", "/about",
    "/contact", "/careers", "/pricing", "/download", "/password/reset",
    "/verify-email?token={hex}", "/register", "/account/verify", "/secure/{w}",
    "/payment/update", "/en/{slug}", "/{w}/{slug}?utm_source=newsletter&utm_medium=email",
]


def _fill(tpl: str, domain: str, rng: random.Random) -> str:
    def slug():
        return "-".join(rng.choice(_WORDS) for _ in range(rng.randint(2, 4)))
    out = tpl
    for key, fn in (("{hex}", lambda: "%x" % rng.getrandbits(rng.choice([32, 48, 64]))),
                    ("{slug}", slug), ("{w}", lambda: rng.choice(_WORDS)),
                    ("{n}", lambda: str(rng.randint(100, 99999999))),
                    ("{N}", lambda: str(rng.randint(10 ** 9, 10 ** 12))),
                    ("{s}", lambda: str(rng.randint(1, 40))), ("{y}", lambda: str(rng.randint(2015, 2026))),
                    ("{m}", lambda: "%02d" % rng.randint(1, 12)), ("{dd}", lambda: "%02d" % rng.randint(1, 28)),
                    ("{d}", lambda: domain)):
        while key in out:
            out = out.replace(key, fn(), 1)
    return out


def augment_reputable(domains: list[str], n: int, rng: random.Random) -> list[str]:
    urls = []
    for _ in range(n):
        d = rng.choice(domains)
        urls.append(canonical(rng.choice(_SUBS) + d + _fill(rng.choice(_TEMPLATES), d, rng)))
    return [u for u in urls if u]


def _eligible_reputable(reg: str) -> bool:
    tld = reg.rsplit(".", 1)[-1]
    return (reg not in MULTI_TENANT_DOMAINS and reg not in FREE_HOSTING and reg not in SHORTENERS
            and tld not in RISKY_TLDS and not reg.replace(".", "").isdigit())


def write_popular_domains(umbrella_ranked: list[str], phish_bare_hosts: set[str], top: int,
                          always_keep_top: int = 1_000) -> int:
    """Top-N registered domains (by Umbrella rank) for the runtime reputation layer.

    A domain is dropped if a feed lists the *bare domain itself* as phishing —
    except for the very top sites, where the feed entry is far more likely to be
    noise (e.g. an open-redirect URL on google.com) than the site being malicious.
    Domains that merely host some phishing URL are kept: that is what the
    multi-tenant / user-content exclusions in reputation.py are for.
    """
    seen, out = set(), []
    for u in umbrella_ranked:
        reg = registered_domain(host_of(u))
        if reg in seen:
            continue
        seen.add(reg)
        if reg in SHORTENERS or reg.rsplit(".", 1)[-1] in RISKY_TLDS:
            continue
        if reg in phish_bare_hosts and len(out) >= always_keep_top:
            continue
        out.append(reg)
        if len(out) >= top:
            break
    POPULAR_DOMAINS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(POPULAR_DOMAINS_PATH, "w", encoding="utf-8") as f:
        f.write(f"# Top {len(out)} registered domains by Cisco Umbrella popularity rank,\n"
                f"# excluding shorteners, risky TLDs and domains seen in phishing feeds.\n"
                f"# Generated {datetime.now(timezone.utc).date()} by scripts/build_dataset.py\n")
        f.write("\n".join(out) + "\n")
    return len(out)


# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #
def cap_per_domain(urls, cap, rng):
    by_dom = defaultdict(list)
    for u in urls:
        by_dom[registered_domain(host_of(u))].append(u)
    out = []
    for dom_urls in by_dom.values():
        rng.shuffle(dom_urls)
        out.extend(dom_urls[:cap])
    return out


def take(pool, n, rng):
    pool = list(pool)
    rng.shuffle(pool)
    return pool[:n]


def build(raw_dir: Path, out: Path, per_class: int, host_only_frac: float, seed: int,
          augment_frac: float = 0.35, popular_top: int = 20_000):
    rng = random.Random(seed)

    print("[*] Loading sources ...")
    phish_sources = {
        "phishdb_active": set(load_lines(raw_dir / "phishdb_active.txt")),
        "phishtank_valid": set(load_csv_col(raw_dir / "phishtank_valid.csv", "url")),
        "phishtank_repo_sample": set(load_csv_col(REPO_SAMPLE, "URL")) if REPO_SAMPLE.exists() else set(),
        "faizann24_bad": set(load_csv_col(raw_dir / "faizann24.csv", "url", label_filter="bad", label_col="label")),
    }
    benign_sources = {
        "iscx_benign": set(load_iscx(raw_dir / "iscx_benign.csv")),
        "faizann24_good": set(load_csv_col(raw_dir / "faizann24.csv", "url", label_filter="good", label_col="label")),
    }
    umbrella = load_umbrella(raw_dir, top_n=200_000)
    for k, v in {**phish_sources, **benign_sources}.items():
        print(f"    {k:24} {len(v):>8,}")
    print(f"    {'umbrella_top200k':24} {len(umbrella):>8,}")

    all_phish = set().union(*phish_sources.values())
    phish_hosts = {host_of(u) for u in all_phish}

    phish_bare_hosts = {host_of(u) for u in all_phish if is_host_only(u)}
    n_popular = write_popular_domains(umbrella, phish_bare_hosts, popular_top)
    print(f"[✓] Wrote {n_popular:,} popular domains -> {POPULAR_DOMAINS_PATH}")

    # Popular registrable domains: a *bare* popular domain is never a phishing sample.
    popular_regdoms = {registered_domain(host_of(u)) for u in umbrella[:5_000]}

    # ---- Phishing pool (full-path) --------------------------------------------
    def phish_ok(u):
        return not (is_host_only(u) and registered_domain(host_of(u)) in popular_regdoms)

    phish_path = {u: src for src, s in phish_sources.items() for u in sorted(s) if not is_host_only(u) and phish_ok(u)}
    phish_bare = {u: src for src, s in phish_sources.items() for u in sorted(s) if is_host_only(u) and phish_ok(u)}

    # Host-only phishing variants derived from attacker-controlled hosts.
    for u, src in list(phish_path.items()):
        h = host_of(u)
        if registered_domain(h) not in popular_regdoms:
            phish_bare.setdefault(h, src + "_host")

    # ---- Benign pool ----------------------------------------------------------
    benign_path = {u: src for src, s in benign_sources.items() for u in sorted(s)
                   if not is_host_only(u) and host_of(u) not in phish_hosts}
    benign_bare = {u: src for src, s in benign_sources.items() for u in sorted(s)
                   if is_host_only(u) and host_of(u) not in phish_hosts}
    for u in umbrella:
        if host_of(u) not in phish_hosts:
            benign_bare.setdefault(u, "umbrella_top200k")

    # Drop exact cross-label conflicts.
    conflicts = (set(phish_path) | set(phish_bare)) & (set(benign_path) | set(benign_bare))
    for c in conflicts:
        for d in (phish_path, phish_bare, benign_path, benign_bare):
            d.pop(c, None)

    # Per-registered-domain caps for diversity / less leakage.
    phish_path_c = cap_per_domain(phish_path, cap=3, rng=rng)
    phish_bare_c = cap_per_domain(phish_bare, cap=2, rng=rng)
    benign_path_c = cap_per_domain(benign_path, cap=5, rng=rng)
    benign_bare_c = cap_per_domain(benign_bare, cap=2, rng=rng)

    n_bare = int(per_class * host_only_frac)
    n_path = per_class - n_bare
    avail = min(len(phish_path_c), len(benign_path_c), n_path) , min(len(phish_bare_c), len(benign_bare_c), n_bare)
    n_path, n_bare = avail
    # Keep the host-only fraction identical across classes.
    if n_path + n_bare:
        target_bare = int((n_path + n_bare) * host_only_frac)
        n_bare = min(n_bare, target_bare)

    rows = []
    for u in take(phish_path_c, n_path, rng):
        rows.append((u, 1, phish_path[u]))
    for u in take(phish_bare_c, n_bare, rng):
        rows.append((u, 1, phish_bare[u]))
    n_aug = int(n_path * augment_frac)
    for u in take(benign_path_c, n_path - n_aug, rng):
        rows.append((u, 0, benign_path[u]))
    reputable = []
    seen_reg = set()
    for u in umbrella[:150_000]:
        reg = registered_domain(host_of(u))
        if reg not in seen_reg and reg not in phish_bare_hosts and _eligible_reputable(reg):
            seen_reg.add(reg)
            reputable.append(reg)
    for u in augment_reputable(reputable, n_aug, rng):
        rows.append((u, 0, "reputable_augmented"))
    for u in take(benign_bare_c, n_bare, rng):
        rows.append((u, 0, benign_bare[u]))
    rng.shuffle(rows)

    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "label", "source"])
        w.writerows(rows)

    per_source = defaultdict(int)
    for _, lbl, src in rows:
        per_source[f"{lbl}:{src}"] += 1
    stats = {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed": seed,
        "total": len(rows),
        "phishing": sum(1 for r in rows if r[1] == 1),
        "benign": sum(1 for r in rows if r[1] == 0),
        "host_only_per_class": n_bare,
        "full_path_per_class": n_path,
        "cross_label_conflicts_dropped": len(conflicts),
        "reputable_augmented_rows": n_aug,
        "popular_domains_written": n_popular,
        "rows_per_source": dict(sorted(per_source.items())),
        "raw_files_sha256": {p.name: sha256(p) for p in sorted(raw_dir.iterdir())
                             if p.name in SOURCES or p.name == "top-1m.csv"},
    }
    with open(out.with_name("dataset_stats.json"), "w") as f:
        json.dump(stats, f, indent=2)

    print(f"[✓] Wrote {len(rows):,} rows -> {out}")
    print(json.dumps({k: stats[k] for k in ("total", "phishing", "benign", "host_only_per_class",
                                             "full_path_per_class", "cross_label_conflicts_dropped")}, indent=2))
    print(json.dumps(stats["rows_per_source"], indent=2))
    return stats


def main():
    ap = argparse.ArgumentParser(description="Build the Baitlock URL training dataset")
    ap.add_argument("--raw-dir", required=True, type=Path, help="Directory for raw downloads (outside the repo)")
    ap.add_argument("--out", default=DEFAULT_OUT, type=Path)
    ap.add_argument("--per-class", default=100_000, type=int)
    ap.add_argument("--host-only-frac", default=0.3, type=float)
    ap.add_argument("--seed", default=42, type=int)
    ap.add_argument("--augment-frac", default=0.35, type=float,
                    help="Share of benign full-path rows synthesised on reputable domains (train-only)")
    ap.add_argument("--popular-top", default=20_000, type=int)
    ap.add_argument("--no-download", action="store_true", help="Use files already in --raw-dir")
    args = ap.parse_args()

    if not args.no_download:
        download(args.raw_dir)
    build(args.raw_dir, args.out, args.per_class, args.host_only_frac, args.seed,
          args.augment_frac, args.popular_top)


if __name__ == "__main__":
    sys.exit(main())
