#!/usr/bin/env python3
"""
Baitlock Layer-2 phishing model — training pipeline.

  1. Build the dataset (once):   uv run python scripts/build_dataset.py --raw-dir /tmp/baitlock-raw
  2. Train + evaluate + export:   uv run python train.py
                                  uv run python train.py --model rf
                                  uv run python train.py --compare           # train both, keep the best
                                  uv run python train.py --csv other.csv --url-col URL --label-col Label

Evaluation is done on a *domain-grouped* hold-out split: no registered domain
appears in both train and test, so the numbers reflect generalisation to
unseen domains rather than memorisation. The model is then checked end-to-end
through the real scoring service on curated reference URLs. Outputs:

  app/features/phishing/phishing_url_model.pkl   versioned model bundle
  app/features/phishing/model_card.json          metrics, data, parameters
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import pickle
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

SERVER_DIR = Path(__file__).resolve().parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score, average_precision_score, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit  # noqa: E402

from app.features.phishing.features import CATEGORICAL_FEATURES, FEATURE_NAMES, _tld_extract, feature_vector  # noqa: E402
from app.features.phishing.phishing_ml import MODEL_PATH  # noqa: E402
from app.features.phishing.reference_urls import BENIGN_REFERENCE, PHISHING_REFERENCE  # noqa: E402

MODEL_VERSION = "2.1.0"
DEFAULT_CSV = SERVER_DIR / "data" / "training" / "urls.csv"
CARD_PATH = MODEL_PATH.with_name("model_card.json")


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #
def normalize_label(val) -> int:
    v = str(val).strip().lower()
    if v in {"1", "phishing", "bad", "malicious", "phish", "yes", "true", "1.0", "fraud", "defacement", "malware"}:
        return 1
    if v in {"0", "legitimate", "good", "benign", "safe", "no", "false", "0.0", "clean"}:
        return 0
    try:
        return 1 if float(v) >= 0.5 else 0
    except ValueError:
        return 0


def load_csv(path: Path, url_col=None, label_col=None, limit=None):
    urls, labels, sources = [], [], []
    with open(path, encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.reader(f)
        header = [h.strip().lower() for h in next(reader)]
        ui = header.index(url_col.lower()) if url_col else next(
            (header.index(c) for c in ("url", "urls", "domain") if c in header), 0)
        li = header.index(label_col.lower()) if label_col else next(
            (header.index(c) for c in ("label", "class", "result", "status", "type", "target") if c in header), 1)
        si = header.index("source") if "source" in header else None
        for row in reader:
            if len(row) <= max(ui, li) or not row[ui].strip():
                continue
            urls.append(row[ui].strip())
            labels.append(normalize_label(row[li]))
            sources.append(row[si] if si is not None and si < len(row) else "unknown")
            if limit and len(urls) >= limit:
                break
    return urls, np.array(labels), np.array(sources)


def _featurize(url: str):
    try:
        vec = feature_vector(url)
        rest = url.split("://", 1)[-1]
        host = rest.split("/", 1)[0].split("?", 1)[0].split("@")[-1].split(":", 1)[0].lower()
        ext = _tld_extract(host)
        group = f"{ext.domain}.{ext.suffix}" if ext.suffix else (ext.domain or host)
        return vec, group
    except Exception:
        return None


def featurize(urls):
    t0 = time.time()
    workers = os.cpu_count() or 2
    with ProcessPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(_featurize, urls, chunksize=max(256, len(urls) // (workers * 16))))
    keep = [i for i, r in enumerate(results) if r is not None]
    X = np.asarray([results[i][0] for i in keep], dtype=float)
    groups = np.asarray([results[i][1] for i in keep])
    print(f"[✓] Extracted {len(FEATURE_NAMES)} features for {len(keep):,} URLs in {time.time() - t0:.1f}s")
    return X, groups, np.asarray(keep)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
def make_model(kind: str, seed: int):
    if kind == "rf":
        return RandomForestClassifier(
            n_estimators=200, max_depth=24, min_samples_leaf=2,
            n_jobs=-1, random_state=seed, class_weight="balanced_subsample",
        )
    return HistGradientBoostingClassifier(
        categorical_features=[FEATURE_NAMES.index(c) for c in CATEGORICAL_FEATURES],
        max_iter=600, learning_rate=0.08, max_leaf_nodes=63, min_samples_leaf=40,
        l2_regularization=1.0, early_stopping=True, validation_fraction=0.1,
        n_iter_no_change=25, random_state=seed,
    )


def evaluate(y, p, threshold=0.5):
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "threshold": threshold,
        "accuracy": round(accuracy_score(y, pred), 4),
        "precision": round(precision_score(y, pred, zero_division=0), 4),
        "recall": round(recall_score(y, pred, zero_division=0), 4),
        "f1": round(f1_score(y, pred, zero_division=0), 4),
        "false_positive_rate": round(fp / (fp + tn), 4) if (fp + tn) else 0.0,
        "roc_auc": round(roc_auc_score(y, p), 4),
        "pr_auc": round(average_precision_score(y, p), 4),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def service_reference_check(bundle) -> dict:
    """Run the curated reference URLs through the REAL scoring service (fast path)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    import app.features.phishing.phishing_ml as ml
    from app.core.database import Base
    import app.features.auth.models  # noqa: F401
    import app.features.chat.models  # noqa: F401
    import app.features.companies.models  # noqa: F401
    import app.features.fraud.models  # noqa: F401
    import app.features.phishing.models  # noqa: F401
    from app.features.phishing.service import score_phishing_service

    previous = ml._bundle
    ml._bundle = bundle
    try:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()
        blocked = lambda t: t in ("high", "critical")  # noqa: E731  (extension redirects on these)
        uid = 10_000
        fp = []
        for u in BENIGN_REFERENCE:
            uid += 1
            r = score_phishing_service(db, u, user_id=uid, fast_mode=True)
            if blocked(r["tier"]):
                fp.append((u, r["final_score"]))
        miss = []
        for u in PHISHING_REFERENCE:
            uid += 1
            r = score_phishing_service(db, u, user_id=uid, fast_mode=True)
            if not blocked(r["tier"]):
                miss.append((u, r["final_score"]))
        db.close()
    finally:
        ml._bundle = previous
    return {
        "benign_reference": len(BENIGN_REFERENCE),
        "benign_blocked": len(fp),
        "benign_block_rate": round(len(fp) / len(BENIGN_REFERENCE), 4),
        "phishing_reference": len(PHISHING_REFERENCE),
        "phishing_blocked": len(PHISHING_REFERENCE) - len(miss),
        "phishing_block_rate": round(1 - len(miss) / len(PHISHING_REFERENCE), 4),
        "false_positives": fp,
        "missed_phishing": miss,
    }


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="Train the Baitlock phishing URL model")
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    ap.add_argument("--url-col")
    ap.add_argument("--label-col")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--model", choices=["hgb", "rf"], default="hgb")
    ap.add_argument("--compare", action="store_true", help="Train HGB and RF, keep the better one")
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--output", type=Path, default=MODEL_PATH)
    args = ap.parse_args()

    if not args.csv.exists():
        sys.exit(f"[ERROR] Dataset not found: {args.csv}\n"
                 f"        Build it first: uv run python scripts/build_dataset.py --raw-dir /tmp/baitlock-raw")

    urls, y_all, src_all = load_csv(args.csv, args.url_col, args.label_col, args.limit)
    print(f"[*] Loaded {len(urls):,} URLs ({int(y_all.sum()):,} phishing / {int((1 - y_all).sum()):,} benign)")

    X, groups, keep = featurize(urls)
    y, src = y_all[keep], src_all[keep]

    split = GroupShuffleSplit(n_splits=1, test_size=args.test_size, random_state=args.seed)
    tr, te = next(split.split(X, y, groups))
    assert not (set(groups[tr]) & set(groups[te])), "group leakage between train and test"
    # Synthetic reputable-domain rows are TRAIN-ONLY: never evaluate on them.
    aug = src == "reputable_augmented"
    te = te[~aug[te]]
    print(f"[*] Excluded synthetic augmentation rows from the test split ({int(aug.sum()):,} train-only rows)")
    print(f"[*] Domain-grouped split: train={len(tr):,}  test={len(te):,}  "
          f"(distinct test domains: {len(set(groups[te])):,})")

    candidates = ["hgb", "rf"] if args.compare else [args.model]
    results = {}
    for kind in candidates:
        t0 = time.time()
        clf = make_model(kind, args.seed)
        clf.fit(X[tr], y[tr])
        p = clf.predict_proba(X[te])[:, 1]
        m = evaluate(y[te], p)
        m["train_seconds"] = round(time.time() - t0, 1)
        m["operating_points"] = [evaluate(y[te], p, t) for t in (0.5, 0.75, 0.9)]
        results[kind] = (clf, p, m)
        print(f"[{kind}] AUC={m['roc_auc']}  PR-AUC={m['pr_auc']}  F1={m['f1']}  "
              f"precision={m['precision']}  recall={m['recall']}  FPR={m['false_positive_rate']}  "
              f"({m['train_seconds']}s)")

    # Pick the model with the best PR-AUC (ties -> lower FPR).
    best = max(results, key=lambda k: (results[k][2]["pr_auc"], -results[k][2]["false_positive_rate"]))
    clf, p_best, metrics = results[best]

    per_source = {}
    for s in sorted(set(src[te])):
        mask = src[te] == s
        lbl = int(y[te][mask][0])
        hit = (p_best[mask] >= 0.5).astype(int)
        rate = float(hit.mean()) if lbl == 1 else float(1 - hit.mean())
        per_source[s] = {"label": lbl, "n": int(mask.sum()),
                         ("recall" if lbl == 1 else "specificity"): round(rate, 4)}

    bundle = {
        "model": clf,
        "feature_names": list(FEATURE_NAMES),
        "version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "algorithm": type(clf).__name__,
        "metrics": {k: metrics[k] for k in ("roc_auc", "pr_auc", "f1", "precision", "recall", "false_positive_rate")},
    }

    from app.features.phishing.features import feature_vector
    pb = clf.predict_proba(np.asarray([feature_vector(u) for u in BENIGN_REFERENCE], dtype=float))[:, 1]
    pp = clf.predict_proba(np.asarray([feature_vector(u) for u in PHISHING_REFERENCE], dtype=float))[:, 1]
    ml_reference = {
        "benign_flagged": int((pb >= 0.5).sum()), "benign_total": len(BENIGN_REFERENCE),
        "phishing_flagged": int((pp >= 0.5).sum()), "phishing_total": len(PHISHING_REFERENCE),
        "benign_false_positives": [u for u, p in zip(BENIGN_REFERENCE, pb) if p >= 0.5],
    }
    print(f"[*] ML-only reference check (no reputation): benign flagged {ml_reference['benign_flagged']}/"
          f"{ml_reference['benign_total']}, phishing flagged {ml_reference['phishing_flagged']}/"
          f"{ml_reference['phishing_total']}")
    for u in ml_reference["benign_false_positives"]:
        print(f"      ML-FP  {u}")

    print("[*] End-to-end check through the scoring service (fast path) ...")
    service = service_reference_check(bundle)
    print(f"    benign reference blocked:   {service['benign_blocked']}/{service['benign_reference']}")
    print(f"    phishing reference blocked: {service['phishing_blocked']}/{service['phishing_reference']}")
    for u, s in service["false_positives"]:
        print(f"      FP  score={s:<3} {u}")
    for u, s in service["missed_phishing"]:
        print(f"      MISS score={s:<3} {u}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "wb") as f:
        pickle.dump(bundle, f, protocol=pickle.HIGHEST_PROTOCOL)

    import sklearn
    dataset_stats_path = args.csv.with_name("dataset_stats.json")
    card = {
        "model": {"version": MODEL_VERSION, "algorithm": bundle["algorithm"], "trained_at": bundle["trained_at"],
                  "sklearn_version": sklearn.__version__, "artifact": args.output.name,
                  "artifact_bytes": args.output.stat().st_size, "feature_names": list(FEATURE_NAMES)},
        "evaluation": {"split": "GroupShuffleSplit by registered domain (no domain in both train and test)",
                       "train_rows": int(len(tr)), "test_rows": int(len(te)),
                       "test_metrics": metrics, "per_source_test": per_source,
                       "candidates": {k: v[2] for k, v in results.items()}},
        "ml_reference_check": ml_reference,
        "service_reference_check": {k: v for k, v in service.items()},
        "dataset": json.load(open(dataset_stats_path)) if dataset_stats_path.exists() else {"csv": str(args.csv)},
        "intended_use": ("Layer-2 lexical URL risk signal combined with the deterministic rule engine, "
                         "user overrides and optional LLM content analysis. Not a sole decision maker."),
        "limitations": ["Lexical only: cannot see page content or hosting reputation.",
                        "Phishing on reputable platforms (docs.google.com, sites, storage buckets) is hard to separate by URL alone.",
                        "Training data drifts; retrain periodically (rebuild dataset + train.py)."],
    }
    with open(CARD_PATH, "w") as f:
        json.dump(card, f, indent=2, default=str)

    print(f"\n[✓] Selected model: {best}  ->  {args.output}  ({args.output.stat().st_size / 1e6:.2f} MB)")
    print(f"[✓] Model card     ->  {CARD_PATH}")


if __name__ == "__main__":
    main()
