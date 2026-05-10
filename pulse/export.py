"""Export pulse data to JSON for the website frontend."""

import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from pulse.db import get_all_items_with_analyses, get_stats

EXPORT_DIR = Path(__file__).parent.parent / "website" / "public" / "data"


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

        feed_item = {
            "id": item["id"],
            "title": item["title"],
            "author": item["author"],
            "url": item["url"],
            "platform": item["platform"],
            "published_at": item["published_at"],
            "collected_at": item["collected_at"],
        }

        if item.get("analysis_summary"):
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

    pulse_data = {
        "generated_at": datetime.now().isoformat(),
        "stats": {
            **stats,
            "platforms": dict(platform_counts),
        },
        "trending_topics": [
            {"topic": t, "count": c}
            for t, c in topic_counts.most_common(30)
        ],
        "entity_index": entity_index,
        "items": feed_items,
    }

    output_path = EXPORT_DIR / "pulse.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(pulse_data, f, indent=2)

    print(f"[Export] Wrote {len(feed_items)} items to {output_path}")
    print(f"  Platforms: {dict(platform_counts)}")
    print(f"  Analyzed: {sum(1 for i in feed_items if i.get('analyzed'))}")
    print(f"  Entities: {len(entity_index)}")
    print(f"  Topics: {len(topic_counts)}")


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
