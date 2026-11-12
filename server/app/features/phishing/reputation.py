"""
Domain reputation layer.

Lexical URL models cannot tell a real bank sign-in page from a convincing fake
on URL shape alone; production phishing filters therefore combine them with
domain reputation. This module ships a list of globally popular registered
domains (built by scripts/build_dataset.py from the Cisco Umbrella top list)
and answers "does this host belong to an established site?".

Multi-tenant platforms are deliberately excluded: on these, anyone can publish
a page under the platform's domain, which is exactly how much modern phishing
is hosted (Google Sites/Docs/Forms, SharePoint, storage buckets, static hosts).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import tldextract

_tld = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)

POPULAR_DOMAINS_PATH = Path(__file__).parent / "data" / "popular_domains.txt"

# Hosts that serve arbitrary user content under a reputable domain.
USER_CONTENT_HOSTS = {
    "sites.google.com", "docs.google.com", "drive.google.com", "forms.gle",
    "script.google.com", "storage.googleapis.com", "firebasestorage.googleapis.com",
    "forms.office.com", "forms.microsoft.com", "onedrive.live.com", "1drv.ms",
    "dropbox.com", "dl.dropboxusercontent.com", "s3.amazonaws.com",
    "blob.core.windows.net", "web.core.windows.net", "linktr.ee", "t.me",
    "notion.so", "notion.site", "canva.com", "padlet.com", "airtable.com",
    "typeform.com", "jotform.com", "wufoo.com", "surveymonkey.com",
}

# Registered domains where every subdomain is an independent tenant.
MULTI_TENANT_DOMAINS = {
    "amazonaws.com", "cloudfront.net", "googleusercontent.com", "googleapis.com",
    "appspot.com", "azurewebsites.net", "windows.net", "azureedge.net",
    "sharepoint.com", "firebaseapp.com", "web.app", "github.io",
    "githubusercontent.com", "gitlab.io", "netlify.app", "vercel.app",
    "pages.dev", "workers.dev", "herokuapp.com", "akamaized.net", "akamaihd.net",
    "fastly.net", "b-cdn.net", "digitaloceanspaces.com", "wixsite.com",
    "weebly.com", "blogspot.com", "wordpress.com", "000webhostapp.com",
    "glitch.me", "repl.co", "ngrok.io", "ngrok-free.app", "r2.dev",
    "duckdns.org", "godaddysites.com", "webflow.io", "square.site",
    "myshopify.com", "notion.site", "canva.site", "gitbook.io", "surge.sh",
    "framer.app", "carrd.co", "yolasite.com", "jimdosite.com",
    "mystrikingly.com", "translate.goog", "ipfs.io", "dweb.link",
    "cloudflare-ipfs.com", "on.fleek.co", "typedream.app", "webcindario.com",
}


@lru_cache(maxsize=1)
def popular_domains() -> frozenset:
    try:
        with open(POPULAR_DOMAINS_PATH, encoding="utf-8") as f:
            return frozenset(l.strip().lower() for l in f if l.strip() and not l.startswith("#"))
    except FileNotFoundError:
        return frozenset()


def registered_domain(host: str) -> str:
    ext = _tld(host)
    if ext.domain and ext.suffix:
        return f"{ext.domain}.{ext.suffix}".lower()
    return (ext.domain or host).lower()


def is_user_content(host: str) -> bool:
    host = host.lower().rstrip(".")
    return any(host == h or host.endswith("." + h) for h in USER_CONTENT_HOSTS)


def domain_reputation(host: str) -> dict:
    """Reputation facts for a hostname."""
    host = host.lower().rstrip(".")
    reg = registered_domain(host)
    user_content = is_user_content(host)
    multi_tenant = reg in MULTI_TENANT_DOMAINS and host not in (reg, "www." + reg)
    popular = reg in popular_domains()
    return {
        "registered_domain": reg,
        "popular": popular,
        "user_content": user_content,
        "multi_tenant": multi_tenant,
        # Established site whose pages are published by the site owner itself.
        "trusted": popular and not user_content and not multi_tenant,
    }
