"""Export pulse data to JSON for the website frontend."""

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from pulse.db import get_all_items_with_analyses, get_db, get_stats, normalize_date

EXPORT_DIR = Path(__file__).parent.parent / "website" / "public" / "data"

# Source tier classification
OFFICIAL_KEYWORDS = {"government", "congress", "congressional", "senate", "pentagon",
                     "dod", "department of defense", "white house", "aaro", "odni"}
MAJOR_OUTLETS = {"nytimes", "cnn", "bbc", "reuters", "apnews", "washingtonpost",
                 "nbcnews", "cbsnews", "abcnews", "foxnews", "theguardian",
                 "politico", "thehill"}
SPECIALIST_NAMES = {"the debrief", "liberation times", "black vault", "the war zone",
                    "mufon", "nuforc", "uap.news", "daily grail"}
COMMUNITY_PLATFORMS = {"reddit", "bluesky"}
ACADEMIC_PLATFORMS = {"scholar"}
AGGREGATOR_PLATFORMS = {"google_news", "gdelt"}


def _classify_source_tier(name: str, platform: str) -> str:
    """Assign a tier to a source based on name and platform."""
    # Platform-based tiers take priority for aggregator/community/academic
    if platform in AGGREGATOR_PLATFORMS:
        return "aggregator"
    if platform in COMMUNITY_PLATFORMS:
        return "community"
    if platform in ACADEMIC_PLATFORMS:
        return "academic"
    # Name-based classification for RSS and other direct sources
    lower = name.lower()
    if any(kw in lower for kw in OFFICIAL_KEYWORDS):
        return "official"
    if any(outlet in lower.replace(" ", "") for outlet in MAJOR_OUTLETS):
        return "major_outlet"
    if any(spec in lower for spec in SPECIALIST_NAMES):
        return "specialist"
    # Default: RSS feeds are likely specialist
    if platform == "rss":
        return "specialist"
    return "aggregator"


def _build_source_stats(db) -> list[dict]:
    """Build per-source statistics from items + analyses tables."""
    rows = db.execute("""
        SELECT s.name, s.type as platform, COUNT(i.id) as item_count,
               SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) as analyzed_count,
               AVG(a.credibility_score) as avg_credibility
        FROM sources s
        JOIN items i ON i.source_id = s.id
        LEFT JOIN analyses a ON a.item_id = i.id
        GROUP BY s.id
        ORDER BY item_count DESC
    """).fetchall()

    stats = []
    for r in rows:
        name = r["name"]
        platform = r["platform"]
        avg_cred = round(r["avg_credibility"], 2) if r["avg_credibility"] else None
        stats.append({
            "name": name,
            "platform": platform,
            "item_count": r["item_count"],
            "avg_credibility": avg_cred,
            "analyzed_count": r["analyzed_count"],
            "tier": _classify_source_tier(name, platform),
        })
    return stats


def _build_daily_volume(db) -> list[dict]:
    """Build daily item counts for the last 90 days."""
    cutoff = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
    rows = db.execute("""
        SELECT date(collected_at) as d,
               COUNT(*) as total,
               SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) as analyzed,
               SUM(CASE WHEN a.relevance_score >= 0.7 THEN 1 ELSE 0 END) as high_relevance
        FROM items i
        LEFT JOIN analyses a ON a.item_id = i.id
        WHERE date(collected_at) >= ?
        GROUP BY d
        ORDER BY d ASC
    """, (cutoff,)).fetchall()

    return [
        {
            "date": r["d"],
            "total": r["total"],
            "analyzed": r["analyzed"],
            "high_relevance": r["high_relevance"],
        }
        for r in rows
        if r["d"]
    ]


def _build_topic_sparklines(items: list[dict], topic_counts: Counter) -> list[dict]:
    """For each trending topic, build a sparkline of 12 weekly counts."""
    today = datetime.now()
    # Build week buckets: 12 weeks, most recent last
    week_starts = []
    for i in range(12, 0, -1):
        week_starts.append(today - timedelta(weeks=i))
    week_starts.append(today)

    # Map topic -> [12 weekly counts]
    topic_weekly = defaultdict(lambda: [0] * 12)

    for item in items:
        if not item.get("analyzed") or not item.get("topics"):
            continue
        # Parse item date
        date_str = item.get("published_at") or item.get("collected_at")
        if not date_str:
            continue
        try:
            item_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, TypeError):
            # Try normalizing the date
            normalized = normalize_date(date_str)
            if not normalized:
                continue
            try:
                item_date = datetime.fromisoformat(normalized.replace("Z", "+00:00")).replace(tzinfo=None)
            except (ValueError, TypeError):
                continue

        # Find which week bucket
        for week_idx in range(12):
            if week_starts[week_idx] <= item_date < week_starts[week_idx + 1]:
                for topic in item["topics"]:
                    topic_weekly[topic][week_idx] += 1
                break

    return [
        {
            "topic": t,
            "count": c,
            "sparkline": topic_weekly.get(t, [0] * 12),
        }
        for t, c in topic_counts.most_common(30)
    ]


def _build_entity_bridge(db) -> list[dict]:
    """Aggregate entity_bridge table into per-corpus-entity summaries."""
    try:
        tables = {r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        if "entity_bridge" not in tables:
            return []

        rows = db.execute("""
            SELECT corpus_entity, corpus_doc_ids, match_type, match_score,
                   GROUP_CONCAT(DISTINCT pulse_entity) as pulse_entities
            FROM entity_bridge
            GROUP BY corpus_entity
            ORDER BY COUNT(*) DESC
        """).fetchall()

        bridge = []
        for r in rows:
            try:
                doc_ids = json.loads(r["corpus_doc_ids"])
            except (json.JSONDecodeError, TypeError):
                doc_ids = []
            pulse_names = (r["pulse_entities"] or "").split(",")
            bridge.append({
                "name": r["corpus_entity"],
                "corpus_doc_ids": doc_ids,
                "pulse_mentions": len(pulse_names),
                "pulse_entities": pulse_names[:5],
                "best_match_type": r["match_type"],
                "best_match_score": r["match_score"],
            })
        return bridge
    except Exception:
        return []


def _is_recent(item: dict, days: int = 7) -> bool:
    """Check if item was collected within the last N days."""
    collected = item.get("collected_at")
    if not collected:
        return False
    try:
        dt = datetime.fromisoformat(collected.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        normalized = normalize_date(collected)
        if not normalized:
            return False
        try:
            dt = datetime.fromisoformat(normalized.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, TypeError):
            return False
    cutoff = datetime.now() - timedelta(days=days)
    return dt >= cutoff


def export_pulse_json():
    """Export pulse data to website/public/data/pulse.json."""
    items = get_all_items_with_analyses(limit=1000)
    stats = get_stats()

    feed_items = []
    all_entities = []
    all_theories = []
    topic_counts = Counter()
    platform_counts = Counter()

    for item in items:
        platform_counts[item["platform"]] += 1

        is_analyzed = bool(item.get("analysis_summary"))
        recent = _is_recent(item)

        # Filter: only export analyzed items or items from the last 7 days
        if not is_analyzed and not recent:
            continue

        # Normalize dates for the frontend
        pub_date = normalize_date(item["published_at"]) if item.get("published_at") else None
        col_date = normalize_date(item["collected_at"]) if item.get("collected_at") else None

        feed_item = {
            "id": item["id"],
            "title": item["title"],
            "author": item["author"],
            "url": item["url"],
            "platform": item["platform"],
            "published_at": pub_date or item["published_at"],
            "collected_at": col_date or item["collected_at"],
            "content_quality": item.get("content_quality", "unknown"),
        }

        if is_analyzed:
            feed_item["summary"] = item["analysis_summary"]
            feed_item["credibility"] = item.get("credibility_score")
            feed_item["novelty"] = item.get("novelty_score")
            feed_item["relevance"] = item.get("relevance_score")
            feed_item["analyzed"] = True

            try:
                entities = json.loads(item["entities"]) if item["entities"] else []
                theories = json.loads(item["theories"]) if item["theories"] else []
                topics = json.loads(item["topics"]) if item["topics"] else []
                corpus_conns = json.loads(item["corpus_connections"]) if item["corpus_connections"] else []

                feed_item["entities"] = entities
                feed_item["theories"] = theories
                feed_item["topics"] = topics
                feed_item["corpus_connections"] = corpus_conns

                all_entities.extend(entities)
                all_theories.extend(theories)
                for t in topics:
                    topic_counts[t] += 1
            except (json.JSONDecodeError, TypeError):
                pass
        else:
            feed_item["analyzed"] = False

        feed_items.append(feed_item)

    entity_index = _build_entity_index(all_entities)

    # Build enriched sections from DB
    with get_db() as db:
        source_stats = _build_source_stats(db)
        daily_volume = _build_daily_volume(db)
        entity_bridge = _build_entity_bridge(db)

    # Topic sparklines (computed from feed items)
    trending_topics = _build_topic_sparklines(feed_items, topic_counts)

    pulse_data = {
        "generated_at": datetime.now().isoformat(),
        "stats": {
            **stats,
            "platforms": dict(platform_counts),
        },
        "trending_topics": trending_topics,
        "entity_index": entity_index,
        "source_stats": source_stats,
        "daily_volume": daily_volume,
        "entity_bridge": entity_bridge,
        "items": feed_items,
    }

    output_path = EXPORT_DIR / "pulse.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(pulse_data, f, indent=2)

    exported = len(feed_items)
    total = len(items)
    print(f"[Export] Wrote {exported} items to {output_path} (filtered from {total})")
    print(f"  Platforms: {dict(platform_counts)}")
    print(f"  Analyzed: {sum(1 for i in feed_items if i.get('analyzed'))}")
    print(f"  Entities: {len(entity_index)}")
    print(f"  Topics: {len(topic_counts)}")
    print(f"  Sources: {len(source_stats)}")
    print(f"  Daily volume: {len(daily_volume)} days")
    print(f"  Entity bridge: {len(entity_bridge)} entities")


def _build_entity_index(entities: list[dict]) -> list[dict]:
    """Deduplicate and count entity mentions across all items."""
    index = {}
    for ent in entities:
        key = f"{ent.get('type', 'unknown')}:{ent.get('name', '').lower()}"
        if key not in index:
            index[key] = {
                "name": ent.get("name", ""),
                "type": ent.get("type", "unknown"),
                "mentions": 0,
                "contexts": [],
            }
        index[key]["mentions"] += 1
        ctx = ent.get("context", "")
        if ctx and len(index[key]["contexts"]) < 3:
            index[key]["contexts"].append(ctx)

    return sorted(index.values(), key=lambda x: x["mentions"], reverse=True)
