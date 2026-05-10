# Pulse Pipeline — Design Specification

## Overview

The Pulse system monitors news, social media, and academic sources for UAP/UFO content, analyzes it with Claude, and surfaces findings on the website with cross-references back to the 129-document declassified corpus.

## Current State (v0)

- 750 items collected from 3 free sources (Google News RSS, GDELT, RSS feeds)
- 63 analyzed with Claude Haiku
- **Critical issues**: 82% of items have no real content (Google News stores HTML link tags, GDELT stores titles only), no deduplication, dates not normalized, War Zone RSS produces 97% noise

## Architecture

```
[Collectors]         [SQLite DB]           [Export]            [Website]
  RSS/GDELT/etc  →  pulse.db (items,     →  pulse.json      →  Pulse page
  + newspaper4k     entities, analyses)      (pre-computed)     (React)
  + MinHash dedup        |
                    sqlite-diffable
                    dump → NDJSON → git
```

---

## P0 — Fix Data Quality

### Content Extraction

Google News and GDELT collectors must fetch actual article text, not just metadata.

**Google News (`collectors/google_news.py`):**
- After getting the RSS entry link, use `newspaper4k` to fetch and extract full article text
- Fall back to RSS summary if extraction fails (paywall, 403, timeout)
- Add 1-second politeness delay between article fetches
- Store extracted text in `content`, original summary in `metadata.rss_summary`

**GDELT (`collectors/gdelt.py`):**
- After getting article URLs from the API, use `newspaper4k` to fetch full text
- GDELT returns up to 75 URLs per query — batch extraction with delays
- Fall back to title if extraction fails
- Store domain, language, source_country in metadata

**Content quality field on all items:**
```sql
ALTER TABLE items ADD COLUMN content_quality TEXT DEFAULT 'unknown';
-- Values: 'full_text', 'summary_only', 'title_only', 'html_garbage', 'extraction_failed'
```

### Deduplication

Use MinHash LSH (`datasketch` library) at ingestion time.

**Algorithm:**
1. On each new item, compute MinHash signature from title + first 500 chars of content
2. Query LSH index for items with Jaccard similarity > 0.7
3. If match found: skip insertion, increment `duplicate_of` reference on existing item
4. If no match: insert and add to LSH index

**Schema addition:**
```sql
ALTER TABLE items ADD COLUMN cluster_id INTEGER;
ALTER TABLE items ADD COLUMN duplicate_of INTEGER REFERENCES items(id);
```

**LSH index persistence:** Pickle the `MinHashLSH` object to `data/pulse_lsh.pkl`. Rebuild from DB on first load if missing.

### Date Normalization

Parse all date formats to ISO 8601 on insertion. Add a `normalize_date()` function in `db.py`:
- RFC 2822 (`Fri, 08 May 2026 14:30:11 GMT`)
- RFC 2822 with offset (`Fri, 08 May 2026 15:29:23 +0000`)
- GDELT format (`20260510T114500Z`)
- ISO 8601 passthrough
- Store as `YYYY-MM-DDTHH:MM:SSZ` (UTC)

### sqlite-diffable for Git

**Workflow:**
1. `pip install sqlite-diffable`
2. After any DB mutation, run: `sqlite-diffable dump pulse.db pulse_data/`
3. This creates `pulse_data/{table}.metadata.json` + `pulse_data/{table}.ndjson` per table
4. Commit the `pulse_data/` directory (human-readable diffs)
5. `.gitignore` the `pulse.db`, `pulse.db-shm`, `pulse.db-wal` files
6. Build step: `sqlite-diffable load pulse.db pulse_data/` reconstructs DB

**CLI integration:** Add `python -m pulse dump` and `python -m pulse load` commands.

---

## P1 — Source Quality + Entity Bridge

### Fix RSS Sources

**Remove:** The War Zone (`twz.com/feed`) — 97% noise (general military blog)

**Add:**
- The Black Vault: `https://www.theblackvault.com/documentarchive/feed/`
- NewsNation (UAP coverage, if RSS available)
- Google Alerts RSS for key terms (manual setup, stable URLs)

**Fix:** Liberation Times feed URL (try `?format=rss` variant or scrape for current feed)

### Analysis Quality Gate

Before spending tokens on analysis, filter items:
- Skip if `content_quality` is `title_only`, `html_garbage`, or `extraction_failed`
- Skip if `content` length < 200 characters
- Skip if `duplicate_of` is set (analyze the canonical item instead)
- Prioritize by `length(content) DESC` (longest = most signal)

### Entity Bridge Pipeline

Cross-reference pulse entities against corpus entities to find connections.

**Step 1: Normalize entities**
- Lowercase, strip articles/prepositions
- Merge obvious variants: "United States Congress" = "US Congress" = "Congress"
- Store normalized form in `entity_normalized` field

**Step 2: Build bridge index**
- Load corpus `entities.json` (25 top entities with doc_ids)
- Load all per-document entities from `doc_*.json` files
- For each pulse entity, fuzzy-match against corpus entities (Levenshtein distance < 3 or substring match)
- Store matches in `entity_bridge` table:
```sql
CREATE TABLE entity_bridge (
    pulse_entity TEXT NOT NULL,
    corpus_entity TEXT NOT NULL,
    corpus_doc_ids TEXT NOT NULL,  -- JSON array
    match_type TEXT NOT NULL,      -- 'exact', 'fuzzy', 'substring'
    match_score REAL
);
```

**Step 3: Enrich pulse items**
- For each analyzed item, look up its entities in the bridge table
- Add `corpus_matches` to the item's analysis: `[{doc_id, match_score, matched_entities}]`

---

## P2 — Enriched Export + Page Redesign

### Export Enrichments

Add to `pulse.json`:

**Source statistics:**
```json
"source_stats": [
  { "name": "The Debrief", "platform": "rss", "item_count": 100,
    "avg_credibility": 0.82, "analyzed_count": 45, "tier": "specialist" }
]
```
Tiers: `official` (government sources), `major_outlet` (NYT, CNN), `specialist` (Debrief, Liberation Times), `community` (Reddit, Bluesky), `academic` (Scholar)

**Daily volume:**
```json
"daily_volume": [
  { "date": "2026-05-01", "total": 12, "analyzed": 3, "high_relevance": 1 }
]
```
Last 90 days of daily item counts.

**Topic sparklines:**
```json
"trending_topics": [
  { "topic": "UAP disclosure", "count": 24,
    "sparkline": [0, 2, 1, 3, 5, 2, 1, 3, 4, 1, 0, 2] }
]
```
12 data points = last 12 weeks (or 30 days depending on volume).

**Entity bridge:**
```json
"entity_bridge": [
  { "name": "NASA", "type": "organization",
    "pulse_mentions": 8, "pulse_item_ids": [251, 255, 301],
    "corpus_doc_ids": [42, 67, 89], "corpus_mentions": 12 }
]
```

**Enriched items (analyzed only):**
```json
{
  "...existing fields...",
  "content_quality": "full_text",
  "cluster_id": 7,
  "corpus_matches": [
    { "doc_id": 10, "match_score": 0.82, "match_type": "entity",
      "matched_entities": ["AARO", "Air Force"] }
  ]
}
```

### Pulse Page Redesign

**Tabbed layout:**
```
[Feed] [Trends] [Entities] [Sources]
```

**Feed tab (default):**
- Existing platform filter + analyzed-only toggle
- Feed items with card-expand
- In expanded state: corpus connection sidebar showing matched documents
- Content quality badge on each item

**Trends tab:**
- Topic sparklines (tiny area charts, 30-day window)
- Daily volume chart (area chart, 90-day window)
- Calendar heatmap (GitHub-style, collection volume per day)

**Entities tab:**
- Entity bridge cards: entities that appear in BOTH pulse and corpus
- Each card shows: pulse mention count, corpus document count, links to both
- Mini timeline showing when entity appeared in documents vs news

**Sources tab:**
- Per-source credibility stats with tier badges
- Source activity breakdown (items per source, analyzed %, avg relevance)
- Error/health status from recent collection runs

---

## P3 — Polish + Advanced Features

### Key Figures Tracker
- Curated list of tracked people: David Grusch, Tim Burchett, Kirsten Gillibrand, Sean Kirkpatrick, Jon Kosloski, Lue Elizondo, Marco Rubio
- Entity-centric cards showing latest mentions, mention trend sparkline, document appearances
- Data: filtered view of entity_bridge for type=person

### Geographic Overlay
- Pulse item locations overlaid on existing Leaflet map
- Different marker style (pulsing outline vs filled for corpus docs)
- Requires geocoding locations from pulse analysis entities
- Add `latitude`, `longitude` to pulse items where location entities are extractable

### Sentiment/Tone Tracking
- Add `tone` field to analysis: `disclosure-positive`, `skeptical`, `neutral`, `alarming`, `investigative`
- Stacked area chart showing tone distribution over time
- Per-entity sentiment tracking

### Data Lifecycle
- Monthly compaction: items older than 6 months get full_text replaced with summary
- Quarterly archive: export old data to compressed NDJSON, remove from active DB
- Entity graph is append-only (never delete, close with `valid_to` dates)
- Add `compacted_at` timestamp to items table

---

## Storage Strategy

### Git-tracked (sqlite-diffable NDJSON)
- `pulse_data/items.ndjson` — all items (line-per-row, diffable)
- `pulse_data/analyses.ndjson` — all analyses
- `pulse_data/sources.ndjson` — source registry
- `pulse_data/entity_bridge.ndjson` — corpus cross-references
- `pulse_data/*.metadata.json` — table schemas

### .gitignore
```
pulse.db
pulse.db-shm
pulse.db-wal
data/pulse_lsh.pkl
```

### Reconstructing
```bash
pip install sqlite-diffable
sqlite-diffable load pulse.db pulse_data/
```

---

## Cost Estimates

| Operation | Model | Cost per item | Monthly (500 items/day) |
|-----------|-------|--------------|------------------------|
| Analysis | Haiku | ~$0.002 | ~$30 |
| Analysis | Sonnet | ~$0.01 | ~$150 |
| Collection | Free APIs | $0 | $0 |
| Storage | Git | $0 | $0 |

Recommendation: Use Haiku for bulk analysis, Sonnet for high-relevance items (re-analyze items where Haiku scores relevance > 0.7).
