"""Pulse SQLite database — schema and access layer."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "pulse.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER DEFAULT 1,
    last_collected_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT,
    author TEXT,
    content TEXT,
    url TEXT,
    published_at TEXT,
    collected_at TEXT DEFAULT (datetime('now')),
    platform TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (source_id) REFERENCES sources(id),
    UNIQUE(platform, external_id)
);

CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL UNIQUE,
    entities TEXT DEFAULT '[]',
    theories TEXT DEFAULT '[]',
    relationships TEXT DEFAULT '[]',
    credibility_score REAL,
    novelty_score REAL,
    relevance_score REAL,
    summary TEXT,
    topics TEXT DEFAULT '[]',
    corpus_connections TEXT DEFAULT '[]',
    analyzed_at TEXT DEFAULT (datetime('now')),
    model TEXT,
    FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS collection_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT,
    collector_type TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    items_found INTEGER DEFAULT 0,
    items_new INTEGER DEFAULT 0,
    error TEXT,
    status TEXT DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_items_platform ON items(platform);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_analyses_item ON analyses(item_id);
"""


def init_db():
    with get_db() as db:
        db.executescript(SCHEMA)


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_or_create_source(name: str, source_type: str, config: dict = None) -> int:
    with get_db() as db:
        row = db.execute("SELECT id FROM sources WHERE name = ?", (name,)).fetchone()
        if row:
            return row["id"]
        cur = db.execute(
            "INSERT INTO sources (name, type, config) VALUES (?, ?, ?)",
            (name, source_type, json.dumps(config or {})),
        )
        return cur.lastrowid


def insert_item(
    source_id: int,
    external_id: str,
    platform: str,
    title: str = None,
    author: str = None,
    content: str = None,
    url: str = None,
    published_at: str = None,
    metadata: dict = None,
) -> Optional[int]:
    """Insert item, return ID. Returns None if duplicate."""
    with get_db() as db:
        try:
            cur = db.execute(
                """INSERT INTO items
                   (source_id, external_id, platform, title, author, content, url, published_at, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    source_id,
                    external_id,
                    platform,
                    title,
                    author,
                    content,
                    url,
                    published_at,
                    json.dumps(metadata or {}),
                ),
            )
            return cur.lastrowid
        except sqlite3.IntegrityError:
            return None


def insert_analysis(item_id: int, analysis: dict):
    with get_db() as db:
        db.execute(
            """INSERT OR REPLACE INTO analyses
               (item_id, entities, theories, relationships,
                credibility_score, novelty_score, relevance_score,
                summary, topics, corpus_connections, model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id,
                json.dumps(analysis.get("entities", [])),
                json.dumps(analysis.get("theories", [])),
                json.dumps(analysis.get("relationships", [])),
                analysis.get("credibility_score"),
                analysis.get("novelty_score"),
                analysis.get("relevance_score"),
                analysis.get("summary"),
                json.dumps(analysis.get("topics", [])),
                json.dumps(analysis.get("corpus_connections", [])),
                analysis.get("model", "unknown"),
            ),
        )


def start_run(source_name: str, collector_type: str) -> int:
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO collection_runs (source_name, collector_type) VALUES (?, ?)",
            (source_name, collector_type),
        )
        return cur.lastrowid


def complete_run(run_id: int, items_found: int, items_new: int, error: str = None):
    status = "error" if error else "completed"
    with get_db() as db:
        db.execute(
            """UPDATE collection_runs
               SET completed_at = datetime('now'), items_found = ?, items_new = ?,
                   error = ?, status = ?
               WHERE id = ?""",
            (items_found, items_new, error, status, run_id),
        )


def get_unanalyzed_items(limit: int = 50) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            """SELECT i.* FROM items i
               LEFT JOIN analyses a ON a.item_id = i.id
               WHERE a.id IS NULL AND i.content IS NOT NULL AND length(i.content) > 50
               ORDER BY
                 CASE i.platform
                   WHEN 'google_news' THEN 0
                   WHEN 'reddit' THEN 1
                   WHEN 'bluesky' THEN 2
                   WHEN 'gdelt' THEN 3
                   WHEN 'rss' THEN 4
                   WHEN 'scholar' THEN 5
                   ELSE 6
                 END,
                 i.published_at DESC NULLS LAST
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_all_items_with_analyses(limit: int = 500) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            """SELECT i.*, a.entities, a.theories, a.relationships,
                      a.credibility_score, a.novelty_score, a.relevance_score,
                      a.summary as analysis_summary, a.topics, a.corpus_connections,
                      a.analyzed_at, a.model
               FROM items i
               LEFT JOIN analyses a ON a.item_id = i.id
               ORDER BY i.published_at DESC NULLS LAST
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_stats() -> dict:
    with get_db() as db:
        total = db.execute("SELECT COUNT(*) as n FROM items").fetchone()["n"]
        analyzed = db.execute("SELECT COUNT(*) as n FROM analyses").fetchone()["n"]
        by_platform = db.execute(
            "SELECT platform, COUNT(*) as n FROM items GROUP BY platform"
        ).fetchall()
        recent_runs = db.execute(
            """SELECT source_name, collector_type, status, items_new,
                      started_at, completed_at, error
               FROM collection_runs ORDER BY started_at DESC LIMIT 20"""
        ).fetchall()
        return {
            "total_items": total,
            "analyzed_items": analyzed,
            "unanalyzed_items": total - analyzed,
            "by_platform": {r["platform"]: r["n"] for r in by_platform},
            "recent_runs": [dict(r) for r in recent_runs],
        }
