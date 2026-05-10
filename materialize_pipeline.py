#!/usr/bin/env python3
"""
materialize_pipeline.py — Swap active pipeline versions.

Reads pipeline_versions.json, copies versioned output files to canonical names
so the frontend always reads from a stable path.

Usage:
    python materialize_pipeline.py                    # materialize active versions
    python materialize_pipeline.py --set narratives=v2  # switch narratives to v2 and materialize
    python materialize_pipeline.py --set legacy_web=v2  # switch legacy_web to v2
    python materialize_pipeline.py --status             # show current versions
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
VERSIONS_JSON = SCRIPT_DIR / "pipeline_versions.json"
DATA_DIR = SCRIPT_DIR / "website" / "public" / "data"

CANONICAL_NAMES = {
    "narratives": "doc_narratives.json",
    "legacy_web": "legacy_web.json",
}


def load_versions():
    return json.loads(VERSIONS_JSON.read_text())


def save_versions(config):
    VERSIONS_JSON.write_text(json.dumps(config, indent=2) + "\n")


def materialize(config):
    active = config["active"]
    versions = config["versions"]

    for pipeline, version in active.items():
        if pipeline not in versions:
            print(f"  SKIP {pipeline}: not defined in versions")
            continue

        v_config = versions[pipeline].get(version)
        if not v_config:
            print(f"  SKIP {pipeline}: version '{version}' not found")
            continue

        src = DATA_DIR / v_config["output"]
        dst = DATA_DIR / CANONICAL_NAMES.get(pipeline, f"{pipeline}.json")

        if not src.exists():
            print(f"  WARN {pipeline} ({version}): {src.name} not found — run the pipeline first")
            continue

        shutil.copy2(src, dst)
        print(f"  OK   {pipeline} = {version}: {src.name} -> {dst.name}")


def main():
    parser = argparse.ArgumentParser(description="Materialize pipeline versions")
    parser.add_argument("--set", action="append", metavar="PIPELINE=VERSION",
                        help="Set active version (e.g. --set narratives=v2)")
    parser.add_argument("--status", action="store_true", help="Show current versions")
    args = parser.parse_args()

    config = load_versions()

    if args.status:
        print("Active pipeline versions:")
        for pipeline, version in config["active"].items():
            v_info = config["versions"].get(pipeline, {}).get(version, {})
            desc = v_info.get("description", "")
            output = v_info.get("output", "?")
            exists = (DATA_DIR / output).exists()
            status = "ready" if exists else "NOT BUILT"
            print(f"  {pipeline:12s} = {version:4s} ({status}) — {desc}")
        return

    if args.set:
        for assignment in args.set:
            if "=" not in assignment:
                print(f"ERROR: expected PIPELINE=VERSION, got '{assignment}'")
                sys.exit(1)
            pipeline, version = assignment.split("=", 1)
            if pipeline not in config["versions"]:
                print(f"ERROR: unknown pipeline '{pipeline}'")
                sys.exit(1)
            if version not in config["versions"][pipeline]:
                print(f"ERROR: unknown version '{version}' for {pipeline}")
                sys.exit(1)
            config["active"][pipeline] = version
            print(f"Set {pipeline} = {version}")
        save_versions(config)

    print("\nMaterializing active versions:")
    materialize(config)


if __name__ == "__main__":
    main()
