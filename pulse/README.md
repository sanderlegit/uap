# Pulse — UAP Content Collection & Analysis Pipeline

Automated pipeline that collects UAP/UFO content from news, RSS, academic, and social sources, analyzes it with Claude, cross-references entities against the 129-document corpus, and exports structured JSON for the website frontend.

## Current State (2026-05-10)

| Metric | Count |
|--------|-------|
| Total items collected | 1,016 |
| Analyzed (Claude Haiku) | 85 |
| Pending analyzable | 534 |
| Blocked (too short/bad quality) | 397 |
| Entity bridge entries | 34 |
| Corpus connections | 48 items |
| Sources tracked | 21 |

Platforms: 567 Google News, 207 RSS, 203 GDELT, 39 Scholar.
Reddit and Bluesky collectors exist but need API credentials.

## Architecture

```
Collectors (RSS, Google News, GDELT, Scholar, Reddit, Bluesky)
    ↓  feedparser + newspaper4k for article extraction
SQLite DB (pulse.db, WAL mode)
    ↓  MinHash LSH dedup at ingestion
Analyzer (claude -p --model haiku, $0.05 budget/item)
    ↓  entities, topics, theories, credibility/novelty/relevance scores
Entity Bridge (fuzzy match pulse entities → 129-doc corpus)
    ↓  exact, substring, Jaccard overlap matching
Export → website/public/data/pulse.json
    ↓  source stats, daily volume, topic sparklines, entity bridge
Website Pulse Page (tabbed: Feed / Trends / Entities / Sources)
```

## Commands

All commands run from the project root (`/Users/sander/dev/illuminate/uap/`):

```bash
# One-shot full pipeline (collect + analyze + bridge + export + dump)
python3 -m pulse run --limit 20

# Individual stages
python3 -m pulse collect          # Collect from all sources
python3 -m pulse collect --rss    # RSS only (also: --news, --gdelt, --scholar, --reddit, --bluesky)
python3 -m pulse analyze --limit 50   # Analyze N pending items via Claude
python3 -m pulse bridge           # Rebuild entity bridge (corpus cross-refs)
python3 -m pulse export           # Export to pulse.json + sqlite-diffable dump
python3 -m pulse status           # Show DB stats and recent collection runs

# Long-running scheduler (collect every 6h, analyze every 1h)
python3 -m pulse serve --limit 20

# Database portability (git-friendly NDJSON)
python3 -m pulse dump             # pulse.db → pulse_data/*.ndjson
python3 -m pulse load             # pulse_data/*.ndjson → pulse.db
```

## Resuming Analysis

Analysis is incremental — it only processes items that don't have an analysis yet. To resume where you left off:

```bash
# Check how many are pending
python3 -m pulse status

# Analyze a batch (each item costs ~$0.005 via Haiku)
python3 -m pulse analyze --limit 50    # ~$0.25, takes ~12 min
python3 -m pulse analyze --limit 200   # ~$1.00, takes ~50 min
python3 -m pulse analyze --limit 546   # all pending, ~$2.75, takes ~2 hrs

# After analysis, rebuild bridge + export
python3 -m pulse bridge
python3 -m pulse export
```

Use `PYTHONUNBUFFERED=1` to see live progress:

```bash
PYTHONUNBUFFERED=1 python3 -m pulse analyze --limit 50
```

## Cost Estimates

Analysis uses `claude -p --model haiku --max-budget-usd 0.05` per item.
Actual cost is typically ~$0.003–0.005 per item.

| Batch | Est. Cost | Est. Time |
|-------|-----------|-----------|
| 10 items | $0.05 | ~3 min |
| 50 items | $0.25 | ~12 min |
| 200 items | $1.00 | ~50 min |
| 534 remaining | $2.70 | ~2.2 hrs |

Collection is free (RSS, Google News RSS, GDELT DOC API, Google Scholar scraping).

## Monitoring

```bash
# Database stats
python3 -m pulse status

# Check exported data
python3 -c "import json; d=json.load(open('website/public/data/pulse.json')); print(f'Items: {len(d[\"items\"])}, Analyzed: {sum(1 for i in d[\"items\"] if i.get(\"analyzed\"))}')"

# Rebuild website after export
cd website && npm run build

# Preview
npx vite preview --host 0.0.0.0 --port 4173
```

## Data Flow

**Collection** → Items stored in `items` table with `content_quality` classification:
- `full_article`: newspaper4k extracted real content
- `partial`: some content extracted
- `title_only`: only title available (blocked from analysis)
- `html_garbage`: HTML tags detected (blocked)
- `extraction_failed`: newspaper4k failed (blocked)

**Dedup** → MinHash LSH (datasketch, threshold 0.7) checks at ingestion. Persisted to `data/pulse_lsh.pkl`, auto-rebuilds from DB if missing.

**Analysis** → Claude Haiku extracts: summary, entities (name/type/context), theories, topics, credibility_score (0-1), novelty_score (0-1), relevance_score (0-1).

**Entity Bridge** → Matches pulse entities against corpus entities from `entities.json` and `documents.json`. Three strategies: exact (incl. acronym expansion), substring, fuzzy (>60% word Jaccard). Updates `analyses.corpus_connections` with top-10 matching documents per item.

**Export** → `pulse.json` contains: items, trending_topics (with 12-week sparklines), entity_index, source_stats (with tier: official/major_outlet/specialist/academic/community/aggregator), daily_volume, entity_bridge.

## Git Storage

`pulse.db` is gitignored. Instead, `sqlite-diffable` exports to `pulse_data/*.ndjson` — line-oriented JSON that diffs cleanly in git. The dump runs automatically after `export` and `run` commands.

To restore the DB on a fresh clone:
```bash
python3 -m pulse load
```

## Files

```
pulse/
  __main__.py        CLI entry point, scheduler
  config.py          RSS feeds, query lists, intervals
  db.py              SQLite schema, migrations, queries
  analyzer.py        Claude Haiku analysis via claude -p
  export.py          JSON export with enrichments
  dedup.py           MinHash LSH near-duplicate detection
  entity_bridge.py   Corpus cross-reference matching
  requirements.txt   Python dependencies
  collectors/
    rss.py           feedparser + newspaper4k
    google_news.py   Google News RSS + article extraction
    gdelt.py         GDELT DOC 2.0 API + article extraction
    scholar.py       Google Scholar via scholarly
    reddit.py        Reddit via PRAW (needs credentials)
    bluesky.py       Bluesky via atproto (needs credentials)
pulse_data/          sqlite-diffable NDJSON export (git-tracked)
pulse.db             SQLite database (gitignored)
```

## Optional: Social Media Credentials

```bash
# Reddit (create app at reddit.com/prefs/apps)
export REDDIT_CLIENT_ID=...
export REDDIT_CLIENT_SECRET=...

# Bluesky
export BLUESKY_HANDLE=your.handle
export BLUESKY_APP_PASSWORD=...
```

## Dependencies

```bash
pip3 install feedparser newspaper4k datasketch scholarly
# Optional for social:
pip3 install praw atproto
```
