#!/usr/bin/env python3
"""
Baitlock ML Model Training Pipeline
Supports training on:
  1. Any Kaggle dataset CSV (e.g. Kaggle Phishing URLs dataset, Malicious URL dataset)
  2. PhishTank + Tranco Top List CSVs
  3. Built-in curated dataset if no CSV is supplied

Usage:
  uv run python train.py
  uv run python train.py --csv /path/to/kaggle_dataset.csv --url-col url --label-col label
  uv run python train.py --csv dataset.csv --limit 50000 --estimators 150
"""

import os
import sys
import csv
import time
import argparse
import pickle
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)

# Ensure app package is importable
server_dir = Path(__file__).resolve().parent
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from app.features.phishing.features import extract_url_features
from app.features.phishing.phishing_ml import (
    TRANCO_TOP_LEGITIMATE_URLS,
    PHISHTANK_OPENPHISH_URLS,
    MODEL_PATH,
)

def _extract_single(url: str):
    """Worker function for parallel extraction."""
    try:
        from app.features.phishing.features import extract_url_features as _ef
        feats = _ef(url)
        return list(feats.values())
    except Exception as e:
        print(f"Extract error for {url}: {e}", flush=True)
        return None

def normalize_label(val: str | int | float) -> int:
    """
    Normalizes varied Kaggle label notations into binary:
    1 = Phishing / Malicious / Bad
    0 = Legitimate / Benign / Safe / Good
    """
    val_str = str(val).strip().lower()
    if val_str in {"1", "phishing", "bad", "malicious", "phish", "yes", "true", "1.0", "fraud"}:
        return 1
    elif val_str in {"0", "legitimate", "good", "benign", "safe", "no", "false", "0.0", "clean"}:
        return 0
    else:
        # Fallback numeric
        try:
            num = float(val_str)
            return 1 if num >= 0.5 else 0
        except ValueError:
            return 0

def load_from_csv(csv_path: Path, url_col: str | None, label_col: str | None, limit: int | None):
    """Reads URLs and labels from a Kaggle CSV dataset."""
    urls = []
    labels = []
    print(f"[*] Reading dataset from {csv_path}...")

    with open(csv_path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            raise ValueError("CSV file is empty")

        col_map = {col.strip().lower(): idx for idx, col in enumerate(header)}

        # Find URL column
        url_idx = None
        if url_col and url_col.lower() in col_map:
            url_idx = col_map[url_col.lower()]
        else:
            for candidate in ["url", "urls", "domain", "url_address", "site_url", "web_url"]:
                if candidate in col_map:
                    url_idx = col_map[candidate]
                    break
        if url_idx is None:
            # Default to first column
            url_idx = 0
            print(f"[!] URL column not specified. Defaulting to column 0: '{header[0]}'")

        # Find Label column
        label_idx = None
        if label_col and label_col.lower() in col_map:
            label_idx = col_map[label_col.lower()]
        else:
            for candidate in ["label", "labels", "class", "result", "status", "type", "target"]:
                if candidate in col_map:
                    label_idx = col_map[candidate]
                    break
        if label_idx is None:
            # Default to second column if exists
            label_idx = 1 if len(header) > 1 else 0
            print(f"[!] Label column not specified. Defaulting to column {label_idx}: '{header[label_idx]}'")

        print(f"[*] Mapping: URL='{header[url_idx]}' (col {url_idx}), Label='{header[label_idx]}' (col {label_idx})")

        if limit:
            target_per_class = limit // 2
            counts = {0: 0, 1: 0}
            for row in reader:
                if not row or len(row) <= max(url_idx, label_idx):
                    continue
                raw_url = row[url_idx].strip()
                raw_label = row[label_idx].strip()
                if not raw_url:
                    continue
                lbl = normalize_label(raw_label)
                if counts[lbl] < target_per_class:
                    urls.append(raw_url)
                    labels.append(lbl)
                    counts[lbl] += 1
                if counts[0] >= target_per_class and counts[1] >= target_per_class:
                    break
        else:
            for row in reader:
                if not row or len(row) <= max(url_idx, label_idx):
                    continue
                raw_url = row[url_idx].strip()
                raw_label = row[label_idx].strip()
                if not raw_url:
                    continue
                urls.append(raw_url)
                labels.append(normalize_label(raw_label))

    print(f"[*] Loaded {len(urls)} samples ({sum(labels)} phishing, {len(labels) - sum(labels)} benign).")
    return urls, labels

def load_builtin_dataset():
    """Generates an expanded baseline dataset for immediate local training."""
    print("[*] Using built-in curated Tranco legitimate + PhishTank / OpenPhish malicious datasets...")
    urls = []
    labels = []

    for u in TRANCO_TOP_LEGITIMATE_URLS:
        urls.append(u)
        labels.append(0)

    for u in PHISHTANK_OPENPHISH_URLS:
        urls.append(u)
        labels.append(1)

    # Add extra legitimate patterns
    extra_legit = [
        "https://www.github.com/explore", "https://news.ycombinator.com/best",
        "https://www.amazon.co.uk/dp/B08N5WRWNW", "https://en.wikipedia.org/wiki/Machine_learning",
        "https://www.apple.com/macos/sonoma", "https://policies.google.com/privacy",
        "https://developer.mozilla.org/en-US/docs/Web/API", "https://chatgpt.com",
        "https://claude.ai", "https://huggingface.co/models",
        "https://kaggle.com/datasets", "https://arxiv.org/abs/2301.00001",
        "https://docs.python.org/3/library/csv.html", "https://pypi.org/search/?q=security"
    ]
    for u in extra_legit:
        urls.append(u)
        labels.append(0)

    # Add extra phishing attack vectors
    extra_phish = [
        "http://paypal-verification-account-status.tk/login",
        "https://secure-login-chase-online.xyz/auth.php",
        "http://wellsfargo-update-security-token.top/confirm",
        "http://192.168.0.12/phishing/apple/login.html",
        "https://icloud-find-my-iphone-tracking.pw/map",
        "http://bankofamerica-customer-id-review.online/secure",
        "http://netflix-billing-renewal-issue.site/verify",
        "http://microsoft-365-password-expiration.click/reset",
        "http://steam-trade-bonus-gift.ga/claim",
        "http://metamask-crypto-wallet-restore.vip/seed-phrase"
    ]
    for u in extra_phish:
        urls.append(u)
        labels.append(1)

    return urls, labels

def train_pipeline(urls, labels, n_estimators=100, max_depth=24, output_path=MODEL_PATH):
    """Extracts features, trains RandomForest, evaluates, and exports model."""
    start_time = time.time()
    total = len(urls)
    print(f"[*] Extracting 14 lexical and structural features for {total} URLs...")

    # Parallel feature extraction (ProcessPoolExecutor blocked in sandbox, use ThreadPoolExecutor)
    with ThreadPoolExecutor() as executor:
        feature_rows = list(executor.map(_extract_single, urls, chunksize=max(1, total // (os.cpu_count() or 4))))

    # Filter out failed rows
    X_valid = []
    y_valid = []
    for feats, lbl in zip(feature_rows, labels):
        if feats is not None:
            X_valid.append(feats)
            y_valid.append(lbl)

    X = np.array(X_valid)
    y = np.array(y_valid)

    extract_elapsed = time.time() - start_time
    print(f"[✓] Feature extraction completed in {extract_elapsed:.2f}s ({len(X)} valid samples).")

    # Split train/test (only stratify if both classes have > 1 sample)
    classes, counts = np.unique(y, return_counts=True)
    stratify = y if len(classes) > 1 and min(counts) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=stratify
    )

    print(f"[*] Training RandomForestClassifier (n_estimators={n_estimators}, max_depth={max_depth})...")
    clf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    proba = clf.predict_proba(X_test) if hasattr(clf, "predict_proba") else None
    y_proba = proba[:, 1] if proba is not None and proba.shape[1] > 1 else y_pred

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc = roc_auc_score(y_test, y_proba) if len(classes) > 1 and len(np.unique(y_test)) > 1 else 0.0
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])

    print("\n" + "=" * 55)
    print("        BAITLOCK ML MODEL EVALUATION RESULTS        ")
    print("=" * 55)
    print(f" Accuracy : {acc * 100:.2f}%")
    print(f" Precision: {prec * 100:.2f}%")
    print(f" Recall   : {rec * 100:.2f}%")
    print(f" F1-Score : {f1:.4f}")
    print(f" ROC-AUC  : {roc:.4f}")
    print("\nConfusion Matrix:")
    print(f"  TN: {cm[0][0]:<6} | FP: {cm[0][1]}")
    print(f"  FN: {cm[1][0]:<6} | TP: {cm[1][1]}")
    print("=" * 55)

    # Save artifact
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        pickle.dump(clf, f)

    total_elapsed = time.time() - start_time
    print(f"\n[✓] Trained model successfully saved to:")
    print(f"    {output_path.resolve()}")
    print(f"[✓] Total pipeline time: {total_elapsed:.2f}s")
    return clf

def main():
    parser = argparse.ArgumentParser(description="Train Baitlock Phishing Detection ML Model")
    parser.add_argument("--csv", type=str, help="Path to Kaggle/PhishTank dataset CSV file")
    parser.add_argument("--url-col", type=str, default=None, help="Name of URL column in CSV (auto-detected if omitted)")
    parser.add_argument("--label-col", type=str, default=None, help="Name of Label column in CSV (auto-detected if omitted)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of samples loaded from CSV")
    parser.add_argument("--estimators", type=int, default=100, help="Number of trees in RandomForest (default: 100)")
    parser.add_argument("--max-depth", type=int, default=24, help="Max depth of trees (default: 24)")
    parser.add_argument("--output", type=str, default=str(MODEL_PATH), help="Destination path for .pkl model")

    args = parser.parse_args()

    if args.csv:
        csv_path = Path(args.csv)
        if not csv_path.exists():
            print(f"[ERROR] File not found: {csv_path}", file=sys.stderr)
            sys.exit(1)
        urls, labels = load_from_csv(csv_path, args.url_col, args.label_col, args.limit)
    else:
        urls, labels = load_builtin_dataset()

    train_pipeline(
        urls=urls,
        labels=labels,
        n_estimators=args.estimators,
        max_depth=args.max_depth,
        output_path=args.output
    )

if __name__ == "__main__":
    main()
