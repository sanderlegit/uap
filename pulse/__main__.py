"""Pulse server — UAP content collection, analysis, and export.

Usage:
    python -m pulse collect          Collect from all sources once
    python -m pulse collect --rss    Collect from RSS feeds only
    python -m pulse analyze          Analyze unprocessed items
    python -m pulse bridge           Build entity bridge (corpus cross-references)
    python -m pulse export           Export to website JSON
    python -m pulse run              Collect + analyze + bridge + export (one shot)
    python -m pulse serve            Run scheduler (collect every 6h, analyze every 1h)
    python -m pulse status           Show database stats
    python -m pulse dump             Dump DB to NDJSON via sqlite-diffable
    python -m pulse load             Load DB from NDJSON via sqlite-diffable
"""

from __future__ import annotations

import argparse
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from pulse.db import init_db, get_stats, DB_PATH
from pulse.config import COLLECTION_INTERVAL_HOURS, ANALYSIS_INTERVAL_HOURS

SQLITE_DIFFABLE = "/Users/sander/Library/Python/3.9/bin/sqlite-diffable"
PULSE_DATA_DIR = Path(__file__).parent.parent / "pulse_data"


def cmd_collect(args):
    """Run collectors."""
    init_db()
    collectors = _get_collectors(args)
    for name, collect_fn in collectors:
        try:
            collect_fn()
        except Exception as e:
            print(f"[{name}] Error: {e}")


def cmd_analyze(args):
    """Run analysis on unprocessed items."""
    init_db()
    from pulse.analyzer import analyze_batch
    analyze_batch(limit=args.limit)


def cmd_bridge(args):
    """Build entity bridge (corpus cross-references)."""
    init_db()
    from pulse.entity_bridge import build_entity_bridge
    build_entity_bridge()


def cmd_export(args):
    """Export pulse data to website JSON."""
    init_db()
    from pulse.export import export_pulse_json
    export_pulse_json()
    _auto_dump()


def cmd_run(args):
    """One-shot: collect + analyze + export."""
    init_db()

    print("=" * 60)
    print(f"Pulse run started at {datetime.now().isoformat()}")
    print("=" * 60)

    print("\n--- Collection ---")
    collectors = _get_collectors(args)
    for name, collect_fn in collectors:
        try:
            collect_fn()
        except Exception as e:
            print(f"[{name}] Error: {e}")

    print("\n--- Analysis ---")
    from pulse.analyzer import analyze_batch
    analyze_batch(limit=args.limit)

    print("\n--- Entity Bridge ---")
    from pulse.entity_bridge import build_entity_bridge
    try:
        build_entity_bridge()
    except Exception as e:
        print(f"[Entity Bridge] Error: {e}")

    print("\n--- Export ---")
    from pulse.export import export_pulse_json
    export_pulse_json()

    print("\n--- Dump ---")
    _auto_dump()

    print("\n" + "=" * 60)
    print("Pulse run complete")
    print("=" * 60)


def cmd_serve(args):
    """Run as a long-lived scheduler."""
    init_db()
    print(f"Pulse server starting...")
    print(f"  Collection interval: {COLLECTION_INTERVAL_HOURS}h")
    print(f"  Analysis interval: {ANALYSIS_INTERVAL_HOURS}h")
    print(f"  Press Ctrl+C to stop\n")

    running = True
    def handle_signal(sig, frame):
        nonlocal running
        print("\nShutting down...")
        running = False
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    collection_interval = COLLECTION_INTERVAL_HOURS * 3600
    analysis_interval = ANALYSIS_INTERVAL_HOURS * 3600
    last_collect = 0
    last_analyze = 0

    while running:
        now = time.time()

        if now - last_collect >= collection_interval:
            print(f"\n[{datetime.now().isoformat()}] Starting collection cycle...")
            collectors = _get_collectors(args)
            for name, collect_fn in collectors:
                if not running:
                    break
                try:
                    collect_fn()
                except Exception as e:
                    print(f"[{name}] Error: {e}")
            last_collect = time.time()

        if now - last_analyze >= analysis_interval:
            print(f"\n[{datetime.now().isoformat()}] Starting analysis cycle...")
            from pulse.analyzer import analyze_batch
            try:
                analyze_batch(limit=args.limit)
            except Exception as e:
                print(f"[Analyzer] Error: {e}")

            from pulse.export import export_pulse_json
            try:
                export_pulse_json()
            except Exception as e:
                print(f"[Export] Error: {e}")
            last_analyze = time.time()

        time.sleep(30)


def cmd_status(args):
    """Show database stats."""
    init_db()
    stats = get_stats()
    print(f"\nPulse Database Status")
    print(f"{'=' * 40}")
    print(f"Total items:      {stats['total_items']}")
    print(f"Analyzed:         {stats['analyzed_items']}")
    print(f"Pending analysis: {stats['unanalyzed_items']}")
    print(f"\nBy platform:")
    for platform, count in sorted(stats["by_platform"].items()):
        print(f"  {platform:15s} {count}")
    print(f"\nRecent collection runs:")
    for run in stats["recent_runs"][:10]:
        status_icon = {"completed": "+", "error": "!", "running": "~"}.get(run["status"], "?")
        error_msg = f" — {run['error'][:50]}" if run.get("error") else ""
        print(f"  [{status_icon}] {run['source_name'] or 'unknown':30s} "
              f"+{run['items_new'] or 0} new  {run['started_at'] or ''}{error_msg}")


def _auto_dump():
    """Auto-dump DB to NDJSON so the diffable export stays fresh."""
    try:
        result = subprocess.run(
            [SQLITE_DIFFABLE, "dump", str(DB_PATH), str(PULSE_DATA_DIR), "--all"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print("[dump] sqlite-diffable dump complete")
        else:
            print(f"[dump] sqlite-diffable error: {result.stderr.strip()}")
    except FileNotFoundError:
        print("[dump] sqlite-diffable not found, skipping auto-dump")
    except Exception as e:
        print(f"[dump] auto-dump failed: {e}")


def cmd_dump(args):
    """Dump pulse.db to NDJSON via sqlite-diffable."""
    init_db()
    print(f"Dumping {DB_PATH} -> {PULSE_DATA_DIR}/")
    result = subprocess.run(
        [SQLITE_DIFFABLE, "dump", str(DB_PATH), str(PULSE_DATA_DIR), "--all"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    print("Done.")


def cmd_load(args):
    """Load pulse.db from NDJSON via sqlite-diffable."""
    if not PULSE_DATA_DIR.exists():
        print(f"Error: {PULSE_DATA_DIR} does not exist", file=sys.stderr)
        sys.exit(1)
    print(f"Loading {PULSE_DATA_DIR}/ -> {DB_PATH}")
    result = subprocess.run(
        [SQLITE_DIFFABLE, "load", str(DB_PATH), str(PULSE_DATA_DIR), "--replace"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        print(f"Error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    print("Done.")


def _get_collectors(args):
    """Build list of (name, fn) collectors based on CLI flags."""
    all_collectors = []

    if not any([getattr(args, 'rss', False), getattr(args, 'gdelt', False),
                getattr(args, 'reddit', False), getattr(args, 'bluesky', False),
                getattr(args, 'scholar', False), getattr(args, 'news', False)]):
        run_all = True
    else:
        run_all = False

    if run_all or getattr(args, 'rss', False):
        from pulse.collectors.rss import collect_all as rss_collect
        all_collectors.append(("RSS", rss_collect))

    if run_all or getattr(args, 'news', False):
        from pulse.collectors.google_news import collect_all as gnews_collect
        all_collectors.append(("Google News", gnews_collect))

    if run_all or getattr(args, 'gdelt', False):
        from pulse.collectors.gdelt import collect_all as gdelt_collect
        all_collectors.append(("GDELT", gdelt_collect))

    if run_all or getattr(args, 'reddit', False):
        from pulse.collectors.reddit import collect_all as reddit_collect
        all_collectors.append(("Reddit", reddit_collect))

    if run_all or getattr(args, 'bluesky', False):
        from pulse.collectors.bluesky import collect_all as bluesky_collect
        all_collectors.append(("Bluesky", bluesky_collect))

    if run_all or getattr(args, 'scholar', False):
        from pulse.collectors.scholar import collect_all as scholar_collect
        all_collectors.append(("Scholar", scholar_collect))

    return all_collectors


def main():
    parser = argparse.ArgumentParser(
        description="Pulse — UAP content collection and analysis server"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Collector flags shared across commands
    def add_collector_flags(p):
        g = p.add_argument_group("collectors")
        g.add_argument("--rss", action="store_true", help="RSS feeds only")
        g.add_argument("--news", action="store_true", help="Google News only")
        g.add_argument("--gdelt", action="store_true", help="GDELT only")
        g.add_argument("--reddit", action="store_true", help="Reddit only")
        g.add_argument("--bluesky", action="store_true", help="Bluesky only")
        g.add_argument("--scholar", action="store_true", help="Google Scholar only")

    p_collect = subparsers.add_parser("collect", help="Collect from sources")
    add_collector_flags(p_collect)
    p_collect.set_defaults(func=cmd_collect)

    p_analyze = subparsers.add_parser("analyze", help="Analyze unprocessed items")
    p_analyze.add_argument("--limit", type=int, default=20, help="Max items to analyze")
    p_analyze.set_defaults(func=cmd_analyze)

    p_bridge = subparsers.add_parser("bridge", help="Build entity bridge (corpus cross-refs)")
    p_bridge.set_defaults(func=cmd_bridge)

    p_export = subparsers.add_parser("export", help="Export to website JSON")
    p_export.set_defaults(func=cmd_export)

    p_run = subparsers.add_parser("run", help="Collect + analyze + export")
    add_collector_flags(p_run)
    p_run.add_argument("--limit", type=int, default=20, help="Max items to analyze")
    p_run.set_defaults(func=cmd_run)

    p_serve = subparsers.add_parser("serve", help="Run scheduler daemon")
    add_collector_flags(p_serve)
    p_serve.add_argument("--limit", type=int, default=20, help="Max items per analysis cycle")
    p_serve.set_defaults(func=cmd_serve)

    p_status = subparsers.add_parser("status", help="Show database stats")
    p_status.set_defaults(func=cmd_status)

    p_dump = subparsers.add_parser("dump", help="Dump DB to NDJSON (sqlite-diffable)")
    p_dump.set_defaults(func=cmd_dump)

    p_load = subparsers.add_parser("load", help="Load DB from NDJSON (sqlite-diffable)")
    p_load.set_defaults(func=cmd_load)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
