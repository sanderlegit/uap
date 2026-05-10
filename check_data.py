#!/usr/bin/env python3
"""
check_data.py — Validate data products against DATA_MANIFEST.yaml.

Checks:
  1. Every expected JSON file exists
  2. Curated files aren't older than their stale_days threshold
  3. Generated files are newer than their dependencies
  4. All JSON files in data/ are accounted for in the manifest

Usage:
    python check_data.py            Full validation report
    python check_data.py --summary  One-line-per-file freshness table
    python check_data.py --deps     Show what needs rebuilding
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import yaml

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "website" / "public" / "data"
MANIFEST_PATH = ROOT / "DATA_MANIFEST.yaml"

BOLD = "\033[1m"
RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
DIM = "\033[2m"
RESET = "\033[0m"


def load_manifest():
    with open(MANIFEST_PATH) as f:
        return yaml.safe_load(f)


def resolve_path(name):
    """Resolve a product name to a filesystem path."""
    if name.endswith(".db") or name.startswith("ufo-files/") or name.endswith(".json") and "/" not in name and not name.startswith("doc_"):
        return ROOT / name
    if "/" in name and not name.startswith("doc_"):
        return DATA_DIR / name
    return DATA_DIR / name


def file_mtime(path):
    try:
        return datetime.fromtimestamp(path.stat().st_mtime)
    except (FileNotFoundError, OSError):
        return None


def check_exists(products):
    """Check that every declared product exists."""
    missing = []
    found = []
    for name, info in products.items():
        if name.endswith("/"):
            p = DATA_DIR / name / "manifest.json"
        elif name == "doc_N.json":
            ok = all((DATA_DIR / f"doc_{i}.json").exists() for i in range(129))
            if ok:
                found.append(name)
            else:
                missing_ids = [i for i in range(129) if not (DATA_DIR / f"doc_{i}.json").exists()]
                missing.append(f"doc_N.json (missing IDs: {missing_ids[:5]}...)")
            continue
        elif name == "pulse.db":
            p = ROOT / name
        elif name == "incidents_v2.db":
            p = ROOT / name
        elif name.startswith("ufo-files/"):
            p = ROOT / name
        elif name.endswith(".json") and not name.startswith("summary_stats"):
            p = DATA_DIR / name
        else:
            p = ROOT / name

        if p.exists():
            found.append(name)
        else:
            missing.append(name)

    return found, missing


def check_staleness(products):
    """Check curated files against their stale_days threshold."""
    warnings = []
    now = datetime.now()
    for name, info in products.items():
        if info.get("type") != "curated":
            continue
        stale_days = info.get("stale_days")
        if not stale_days:
            continue

        if name in ("incidents_v2.db", "summary_stats_v2.json"):
            p = ROOT / name
        elif name.startswith("ufo-files/"):
            p = ROOT / name
        else:
            p = DATA_DIR / name

        mtime = file_mtime(p)
        if mtime is None:
            continue
        age = (now - mtime).days
        if age > stale_days:
            warnings.append((name, age, stale_days))
    return warnings


def check_dependencies(products):
    """Check if generated files are older than their dependencies."""
    stale = []
    for name, info in products.items():
        if info.get("type") not in ("generated", "versioned"):
            continue
        deps = info.get("depends_on", [])
        if not deps:
            continue

        if name == "doc_N.json":
            target_path = DATA_DIR / "doc_0.json"
        elif name.endswith("/"):
            target_path = DATA_DIR / name / "manifest.json"
        elif name in ("pulse.db",):
            continue
        else:
            target_path = DATA_DIR / name

        target_mtime = file_mtime(target_path)
        if target_mtime is None:
            continue

        for dep in deps:
            if dep.endswith("/"):
                dep_path = ROOT / dep
                if not dep_path.exists():
                    continue
                dep_mtime = max(
                    (file_mtime(f) for f in dep_path.iterdir() if f.is_file()),
                    default=None,
                )
            elif dep in ("incidents_v2.db", "summary_stats_v2.json") or dep.startswith("ufo-files/"):
                dep_path = ROOT / dep
                dep_mtime = file_mtime(dep_path)
            elif dep.endswith(".md"):
                dep_path = ROOT / dep
                dep_mtime = file_mtime(dep_path)
            elif dep == "pulse.db":
                dep_path = ROOT / dep
                dep_mtime = file_mtime(dep_path)
            elif dep == "doc_N.json":
                dep_path = DATA_DIR / "doc_0.json"
                dep_mtime = file_mtime(dep_path)
            else:
                dep_path = DATA_DIR / dep
                dep_mtime = file_mtime(dep_path)

            if dep_mtime and dep_mtime > target_mtime:
                stale.append((name, dep, target_mtime, dep_mtime))

    return stale


def check_untracked():
    """Find JSON files in data/ not listed in the manifest."""
    manifest = load_manifest()
    products = manifest.get("products", {})
    known = set()
    for name in products:
        if name == "doc_N.json":
            for i in range(129):
                known.add(f"doc_{i}.json")
        elif name.endswith("/"):
            pass
        else:
            known.add(name)

    actual = set()
    for f in DATA_DIR.iterdir():
        if f.is_file() and f.suffix == ".json":
            actual.add(f.name)

    return actual - known


def print_summary(products):
    """Print a one-line-per-file freshness table."""
    now = datetime.now()
    rows = []
    for name, info in products.items():
        if name == "doc_N.json":
            p = DATA_DIR / "doc_0.json"
        elif name.endswith("/"):
            p = DATA_DIR / name / "manifest.json"
        elif name in ("incidents_v2.db", "summary_stats_v2.json", "pulse.db"):
            p = ROOT / name
        elif name.startswith("ufo-files/"):
            p = ROOT / name
        else:
            p = DATA_DIR / name

        mtime = file_mtime(p)
        age_str = f"{(now - mtime).days}d ago" if mtime else "MISSING"
        type_str = info.get("type", "?")
        source = info.get("source", "?")
        if source == "manual":
            source = "curated"
        elif len(source) > 30:
            source = source[:27] + "..."

        exists = "ok" if mtime else "MISSING"
        stale_days = info.get("stale_days")
        status = GREEN + "ok" + RESET
        if mtime is None:
            status = RED + "MISSING" + RESET
        elif stale_days and (now - mtime).days > stale_days:
            status = YELLOW + f"STALE ({(now - mtime).days}d)" + RESET
        else:
            status = GREEN + age_str + RESET

        rows.append((name, type_str, source, status))

    print(f"\n{'File':<30} {'Type':<10} {'Source':<28} {'Status'}")
    print("─" * 85)
    for name, typ, src, status in rows:
        print(f"{name:<30} {typ:<10} {src:<28} {status}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Validate data products")
    parser.add_argument("--summary", action="store_true", help="One-line freshness table")
    parser.add_argument("--deps", action="store_true", help="Show stale dependencies only")
    args = parser.parse_args()

    manifest = load_manifest()
    products = manifest.get("products", {})

    if args.summary:
        print_summary(products)
        return

    errors = 0

    # 1. Existence check
    found, missing = check_exists(products)
    print(f"\n{BOLD}Data products:{RESET} {len(found)} found, {len(missing)} missing")
    for m in missing:
        print(f"  {RED}MISSING{RESET}  {m}")
        errors += 1

    # 2. Staleness check
    stale_curated = check_staleness(products)
    if stale_curated:
        print(f"\n{BOLD}Stale curated files:{RESET}")
        for name, age, threshold in stale_curated:
            print(f"  {YELLOW}STALE{RESET}  {name} — {age}d old (threshold: {threshold}d)")
            errors += 1
    else:
        print(f"\n{GREEN}All curated files within freshness thresholds.{RESET}")

    # 3. Dependency check
    stale_deps = check_dependencies(products)
    if stale_deps:
        print(f"\n{BOLD}Stale generated files (dependency newer than output):{RESET}")
        for target, dep, t_time, d_time in stale_deps:
            delta = d_time - t_time
            print(f"  {YELLOW}REBUILD{RESET}  {target} — {dep} is {delta} newer")
            errors += 1
    else:
        print(f"\n{GREEN}All generated files are up to date with dependencies.{RESET}")

    # 4. Untracked files
    untracked = check_untracked()
    if untracked:
        print(f"\n{BOLD}Untracked JSON files in data/ (not in manifest):{RESET}")
        for u in sorted(untracked):
            print(f"  {DIM}?{RESET}  {u}")

    # Summary
    if errors:
        print(f"\n{RED}{errors} issue(s) found.{RESET} Run 'make all' to rebuild generated files.\n")
        sys.exit(1)
    else:
        print(f"\n{GREEN}All checks passed.{RESET}\n")


if __name__ == "__main__":
    main()
