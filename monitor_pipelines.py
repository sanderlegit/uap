#!/usr/bin/env python3
"""
monitor_pipelines.py — Monitor running pipeline processes and API usage.

Shows progress of analyze_ocr_quality.py and annotate_documents.py,
estimates token consumption, and reports rate limit impact across
different time windows.

Usage:
    python monitor_pipelines.py           # one-shot status
    python monitor_pipelines.py --watch   # refresh every 30s
    python monitor_pipelines.py --watch 10  # refresh every 10s
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
OCR_QUALITY_DIR = SCRIPT_DIR / "data" / "ocr_quality"
ANNOTATIONS_DIR = SCRIPT_DIR / "data" / "annotations"
DATA_DIR = SCRIPT_DIR / "website" / "public" / "data"
DOCUMENTS_JSON = DATA_DIR / "documents.json"
OCR_LOG = SCRIPT_DIR / "ocr_quality_run.log"

# Token estimates per call (input + output)
TOKEN_ESTIMATES = {
    "haiku": {
        "input_per_page": 1800,    # image + prompt + OCR text snippet
        "output_per_page": 250,
        "cost_per_1k_input": 0.00025,
        "cost_per_1k_output": 0.00125,
    },
    "sonnet": {
        "input_per_doc": 6000,     # full doc text + prompt
        "output_per_doc": 800,
        "cost_per_1k_input": 0.003,
        "cost_per_1k_output": 0.015,
    },
    "opus": {
        "input_per_turn": 10000,
        "output_per_turn": 2000,
        "cost_per_1k_input": 0.015,
        "cost_per_1k_output": 0.075,
    },
}

# Rate limits by model tier (requests per minute, tokens per minute)
RATE_LIMITS = {
    "haiku": {"rpm": 50, "tpm_input": 50000, "tpm_output": 10000},
    "sonnet": {"rpm": 50, "tpm_input": 40000, "tpm_output": 8000},
    "opus": {"rpm": 50, "tpm_input": 30000, "tpm_output": 4000},
}


def get_running_processes():
    """Find pipeline processes."""
    procs = []
    try:
        result = subprocess.run(
            ["ps", "aux"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            if "analyze_ocr_quality" in line and "grep" not in line and "monitor" not in line:
                parts = line.split()
                procs.append({
                    "name": "ocr_quality",
                    "pid": parts[1],
                    "cpu": parts[2],
                    "mem": parts[3],
                    "model": "haiku",
                })
            elif "annotate_documents" in line and "grep" not in line and "monitor" not in line:
                parts = line.split()
                procs.append({
                    "name": "annotate",
                    "pid": parts[1],
                    "cpu": parts[2],
                    "mem": parts[3],
                    "model": "sonnet",
                })
    except Exception:
        pass
    return procs


def get_ocr_progress():
    """Check OCR quality analysis progress."""
    if not OCR_QUALITY_DIR.exists():
        return None

    docs = list(OCR_QUALITY_DIR.glob("doc_*.json"))
    total_pages = 0
    page_details = {"accurate": 0, "mostly_accurate": 0, "partial": 0, "garbled": 0, "empty": 0, "not_applicable": 0}
    quality_details = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "illegible": 0}

    for doc_path in docs:
        try:
            data = json.loads(doc_path.read_text())
            pages = data.get("pages", [])
            total_pages += len(pages)
            for p in pages:
                acc = p.get("ocr_accuracy", "")
                if acc in page_details:
                    page_details[acc] += 1
                q = p.get("scan_quality", "")
                if q in quality_details:
                    quality_details[q] += 1
        except (json.JSONDecodeError, OSError):
            pass

    # Get total expected pages
    try:
        all_docs = json.loads(DOCUMENTS_JSON.read_text())
        expected_pages = sum(d.get("total_pages", 0) for d in all_docs)
        # Add photo docs (total_pages=0 but have page images)
        for d in all_docs:
            if d.get("total_pages", 0) == 0:
                if (DATA_DIR / "pages" / f"{d['id']}_p1.jpg").exists():
                    expected_pages += 1
        total_docs = len(all_docs)
    except Exception:
        expected_pages = 4060
        total_docs = 129

    return {
        "docs_done": len(docs),
        "docs_total": total_docs,
        "pages_done": total_pages,
        "pages_total": expected_pages,
        "accuracy": page_details,
        "quality": quality_details,
    }


def get_annotate_progress():
    """Check annotation pipeline progress."""
    if not ANNOTATIONS_DIR.exists():
        return None

    now = time.time()
    total = 0
    recent = 0
    oldest_recent = now
    newest_recent = 0

    for f in ANNOTATIONS_DIR.glob("doc_*.json"):
        total += 1
        mtime = f.stat().st_mtime
        age_min = (now - mtime) / 60
        if age_min < 120:
            recent += 1
            oldest_recent = min(oldest_recent, mtime)
            newest_recent = max(newest_recent, mtime)

    rate = None
    if recent > 1 and newest_recent > oldest_recent:
        elapsed_min = (newest_recent - oldest_recent) / 60
        rate = recent / elapsed_min if elapsed_min > 0 else None

    try:
        total_docs = len(json.loads(DOCUMENTS_JSON.read_text()))
    except Exception:
        total_docs = 129

    return {
        "docs_done": recent,
        "docs_total": total_docs,
        "docs_remaining": total_docs - recent,
        "rate_per_min": rate,
    }


def estimate_usage(ocr_progress, annotate_progress, processes):
    """Estimate token usage and costs."""
    usage = {
        "haiku": {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0},
        "sonnet": {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0},
    }

    if ocr_progress:
        pages = ocr_progress["pages_done"]
        est = TOKEN_ESTIMATES["haiku"]
        usage["haiku"]["requests"] = pages
        usage["haiku"]["input_tokens"] = pages * est["input_per_page"]
        usage["haiku"]["output_tokens"] = pages * est["output_per_page"]
        usage["haiku"]["cost"] = (
            pages * est["input_per_page"] / 1000 * est["cost_per_1k_input"]
            + pages * est["output_per_page"] / 1000 * est["cost_per_1k_output"]
        )

    if annotate_progress:
        docs = annotate_progress["docs_done"]
        est = TOKEN_ESTIMATES["sonnet"]
        usage["sonnet"]["requests"] = docs
        usage["sonnet"]["input_tokens"] = docs * est["input_per_doc"]
        usage["sonnet"]["output_tokens"] = docs * est["output_per_doc"]
        usage["sonnet"]["cost"] = (
            docs * est["input_per_doc"] / 1000 * est["cost_per_1k_input"]
            + docs * est["output_per_doc"] / 1000 * est["cost_per_1k_output"]
        )

    # Estimate current RPM per model
    rpm = {}
    ocr_instances = sum(1 for p in processes if p["name"] == "ocr_quality")
    annotate_instances = sum(1 for p in processes if p["name"] == "annotate")

    if ocr_instances > 0:
        rpm["haiku"] = ocr_instances * 3.0  # ~20s per page = ~3 RPM per instance
    if annotate_instances > 0:
        rpm["sonnet"] = annotate_instances * 2.0  # ~30s per doc = ~2 RPM

    return usage, rpm


def format_bar(current, total, width=30):
    if total == 0:
        return "[" + " " * width + "]"
    filled = int(width * current / total)
    return "[" + "█" * filled + "░" * (width - filled) + "]"


def print_status():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'═' * 70}")
    print(f"  PIPELINE MONITOR — {now}")
    print(f"{'═' * 70}")

    # Running processes
    processes = get_running_processes()
    print(f"\n  PROCESSES")
    if processes:
        for p in processes:
            print(f"    PID {p['pid']:>6}  {p['name']:<15} model={p['model']:<8} cpu={p['cpu']}%  mem={p['mem']}%")
    else:
        print(f"    No pipeline processes running")

    # OCR Quality progress
    ocr = get_ocr_progress()
    print(f"\n  OCR QUALITY ANALYSIS (haiku)")
    if ocr:
        pct = ocr['pages_done'] / ocr['pages_total'] * 100 if ocr['pages_total'] > 0 else 0
        bar = format_bar(ocr['pages_done'], ocr['pages_total'])
        print(f"    Pages:  {bar} {ocr['pages_done']:>4}/{ocr['pages_total']} ({pct:.1f}%)")
        print(f"    Docs:   {ocr['docs_done']}/{ocr['docs_total']} completed")

        if ocr['pages_done'] > 0:
            acc = ocr['accuracy']
            total_rated = sum(acc.values())
            if total_rated > 0:
                good = acc['accurate'] + acc['mostly_accurate']
                ok = acc['partial']
                bad = acc['garbled'] + acc['empty']
                na = acc['not_applicable']
                print(f"    OCR accuracy breakdown:")
                print(f"      accurate/mostly: {good:>4} ({good/total_rated*100:.0f}%)")
                print(f"      partial:         {ok:>4} ({ok/total_rated*100:.0f}%)")
                print(f"      garbled/empty:   {bad:>4} ({bad/total_rated*100:.0f}%)")
                print(f"      n/a (photos):    {na:>4}")

            q = ocr['quality']
            total_q = sum(q.values())
            if total_q > 0:
                print(f"    Scan quality: ", end="")
                parts = []
                for label in ["excellent", "good", "fair", "poor", "illegible"]:
                    if q[label] > 0:
                        parts.append(f"{label}={q[label]}")
                print(", ".join(parts))

        # ETA
        ocr_procs = sum(1 for p in processes if p["name"] == "ocr_quality")
        if ocr_procs > 0 and ocr['pages_done'] > 0:
            remaining = ocr['pages_total'] - ocr['pages_done']
            rate_ppm = ocr_procs * 3.0
            eta_min = remaining / rate_ppm if rate_ppm > 0 else 0
            if eta_min > 120:
                print(f"    ETA:    ~{eta_min/60:.1f} hours ({remaining} pages @ ~{rate_ppm:.0f}/min)")
            else:
                print(f"    ETA:    ~{eta_min:.0f} min ({remaining} pages @ ~{rate_ppm:.0f}/min)")
    else:
        print(f"    Not started")

    # Annotation progress
    ann = get_annotate_progress()
    print(f"\n  ANNOTATION RE-PROCESSING (sonnet)")
    if ann:
        pct = ann['docs_done'] / ann['docs_total'] * 100 if ann['docs_total'] > 0 else 0
        bar = format_bar(ann['docs_done'], ann['docs_total'])
        print(f"    Docs:   {bar} {ann['docs_done']:>4}/{ann['docs_total']} ({pct:.1f}%)")
        if ann['rate_per_min']:
            remaining = ann['docs_remaining']
            eta_min = remaining / ann['rate_per_min']
            print(f"    Rate:   ~{ann['rate_per_min']:.1f} docs/min")
            print(f"    ETA:    ~{eta_min:.0f} min ({remaining} remaining)")
    else:
        print(f"    Not started")

    # API usage estimates
    usage, rpm = estimate_usage(ocr, ann, processes)
    print(f"\n  ESTIMATED API USAGE (cumulative)")
    print(f"    {'Model':<10} {'Requests':>10} {'Input tok':>12} {'Output tok':>12} {'Cost':>10}")
    print(f"    {'─'*10} {'─'*10} {'─'*12} {'─'*12} {'─'*10}")
    total_cost = 0
    for model in ["haiku", "sonnet"]:
        u = usage[model]
        if u["requests"] > 0:
            print(f"    {model:<10} {u['requests']:>10,} {u['input_tokens']:>12,} {u['output_tokens']:>12,} ${u['cost']:>8.3f}")
            total_cost += u["cost"]
    print(f"    {'':>46} ${total_cost:>8.3f} total")

    # Projected total cost
    print(f"\n  PROJECTED TOTAL COST (when complete)")
    proj_ocr = 0
    proj_ann = 0
    if ocr:
        est = TOKEN_ESTIMATES["haiku"]
        p = ocr['pages_total']
        proj_ocr = (p * est["input_per_page"] / 1000 * est["cost_per_1k_input"]
                    + p * est["output_per_page"] / 1000 * est["cost_per_1k_output"])
        print(f"    OCR quality ({ocr['pages_total']} pages, haiku):   ${proj_ocr:.3f}")
    est = TOKEN_ESTIMATES["sonnet"]
    proj_ann = 129 * est["input_per_doc"] / 1000 * est["cost_per_1k_input"] + 129 * est["output_per_doc"] / 1000 * est["cost_per_1k_output"]
    print(f"    Annotations (129 docs, sonnet):    ${proj_ann:.3f}")
    print(f"    Combined projected:                ${proj_ocr + proj_ann:.3f}")

    # Rate limit impact
    print(f"\n  RATE LIMIT IMPACT (current load)")
    for model, current_rpm in rpm.items():
        limits = RATE_LIMITS.get(model, {})
        max_rpm = limits.get("rpm", 50)
        pct_rpm = current_rpm / max_rpm * 100
        print(f"    {model}: ~{current_rpm:.0f}/{max_rpm} RPM ({pct_rpm:.0f}% of limit)")

    active_models = [p["model"] for p in processes]
    if "haiku" in active_models and "sonnet" in active_models:
        print(f"    ⚠ Two models active — limits are per-model, no cross-model conflict")
    if active_models.count("haiku") > 1:
        print(f"    ⚠ {active_models.count('haiku')} haiku instances — combined RPM may approach limits")

    # This session (opus)
    print(f"\n  THIS SESSION (opus)")
    print(f"    Claude Code main session uses opus — separate rate limit pool")
    print(f"    No conflict with haiku/sonnet pipeline traffic")

    print(f"\n{'═' * 70}\n")


def main():
    parser = argparse.ArgumentParser(description="Monitor pipeline progress and API usage")
    parser.add_argument("--watch", nargs="?", const=30, type=int, metavar="SECS",
                        help="Refresh every N seconds (default: 30)")
    args = parser.parse_args()

    if args.watch:
        try:
            while True:
                os.system("clear")
                print_status()
                time.sleep(args.watch)
        except KeyboardInterrupt:
            print("\nStopped.")
    else:
        print_status()


if __name__ == "__main__":
    main()
