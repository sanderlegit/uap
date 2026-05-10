"""Entity bridge — cross-reference pulse entities against the 129-document corpus."""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple

from pulse.db import get_db, init_db

# Paths to corpus data
_DATA_DIR = Path(__file__).parent.parent / "website" / "public" / "data"
_ENTITIES_JSON = _DATA_DIR / "entities.json"
_DOCUMENTS_JSON = _DATA_DIR / "documents.json"

# Known acronym expansions (bidirectional matching)
ACRONYM_MAP: Dict[str, str] = {
    "aaro": "all-domain anomaly resolution office",
    "dod": "department of defense",
    "doj": "department of justice",
    "dos": "department of state",
    "dia": "defense intelligence agency",
    "cia": "central intelligence agency",
    "fbi": "federal bureau of investigation",
    "nasa": "national aeronautics and space administration",
    "naca": "national advisory committee for aeronautics",
    "centcom": "united states central command",
    "indopacom": "united states indo-pacific command",
    "uap": "unidentified anomalous phenomena",
    "ufo": "unidentified flying object",
}

ENTITY_BRIDGE_SCHEMA = """
CREATE TABLE IF NOT EXISTS entity_bridge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pulse_entity TEXT NOT NULL,
    corpus_entity TEXT NOT NULL,
    corpus_doc_ids TEXT NOT NULL,
    match_type TEXT NOT NULL,
    match_score REAL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bridge_pulse ON entity_bridge(pulse_entity);
CREATE INDEX IF NOT EXISTS idx_bridge_corpus ON entity_bridge(corpus_entity);
"""


def _normalize(name: str) -> str:
    """Normalize an entity name for matching."""
    s = name.lower().strip()
    # Strip common prefixes
    for prefix in ("the ", "a ", "an "):
        if s.startswith(prefix):
            s = s[len(prefix):]
    # Collapse whitespace, strip punctuation (keep hyphens)
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _word_set(name: str) -> set:
    """Get set of significant words from a name."""
    return {w for w in _normalize(name).split() if len(w) > 1}


def _word_overlap_score(words_a: set, words_b: set) -> float:
    """Fraction of words shared between two names (Jaccard-like)."""
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def load_corpus_entities() -> Dict[str, List[int]]:
    """Load corpus entities and build {normalized_name: [doc_ids]} lookup.

    Combines top-level entities.json with per-document entity annotations
    from documents.json for broader coverage.
    """
    lookup: Dict[str, List[int]] = {}

    # Source 1: entities.json (25 top entities with doc_ids)
    if _ENTITIES_JSON.exists():
        entities = json.loads(_ENTITIES_JSON.read_text())
        for ent in entities:
            name = ent.get("name", "")
            doc_ids = ent.get("doc_ids", [])
            if name and doc_ids:
                key = _normalize(name)
                if key not in lookup:
                    lookup[key] = []
                lookup[key] = sorted(set(lookup[key] + doc_ids))

    # Source 2: documents.json per-document entities
    if _DOCUMENTS_JSON.exists():
        documents = json.loads(_DOCUMENTS_JSON.read_text())
        for doc in documents:
            doc_id = doc.get("id")
            if doc_id is None:
                continue
            for ent in doc.get("entities", []):
                etype = ent.get("entity_type", "")
                evalue = ent.get("entity_value", "")
                # Only bridge on meaningful entity types
                if etype in ("organization", "person", "program", "location") and evalue:
                    key = _normalize(evalue)
                    if key not in lookup:
                        lookup[key] = []
                    if doc_id not in lookup[key]:
                        lookup[key].append(doc_id)

    # Sort all doc_id lists
    for key in lookup:
        lookup[key] = sorted(set(lookup[key]))

    return lookup


def load_corpus_doc_metadata() -> Dict[int, dict]:
    """Load basic document metadata for context."""
    if not _DOCUMENTS_JSON.exists():
        return {}
    documents = json.loads(_DOCUMENTS_JSON.read_text())
    return {
        doc["id"]: {
            "title": doc.get("title", ""),
            "agency": doc.get("agency", ""),
        }
        for doc in documents
        if "id" in doc
    }


def match_entity(
    pulse_entity: str,
    corpus_lookup: Dict[str, List[int]],
) -> List[Tuple[str, str, List[int], float]]:
    """Match a pulse entity against corpus entities.

    Returns list of (corpus_entity_name, match_type, doc_ids, score).
    """
    matches = []
    p_norm = _normalize(pulse_entity)
    p_words = _word_set(pulse_entity)

    if not p_norm:
        return matches

    # Check acronym expansion
    p_expanded = ACRONYM_MAP.get(p_norm, "")

    for corpus_name, doc_ids in corpus_lookup.items():
        # Exact match
        if p_norm == corpus_name:
            matches.append((corpus_name, "exact", doc_ids, 1.0))
            continue

        # Acronym match: pulse entity acronym expands to corpus name or vice versa
        if p_expanded and p_expanded == corpus_name:
            matches.append((corpus_name, "exact", doc_ids, 0.95))
            continue
        corpus_expanded = ACRONYM_MAP.get(corpus_name, "")
        if corpus_expanded and corpus_expanded == p_norm:
            matches.append((corpus_name, "exact", doc_ids, 0.95))
            continue

        # Substring match: one is contained in the other
        if len(p_norm) >= 3 and len(corpus_name) >= 3:
            if p_norm in corpus_name or corpus_name in p_norm:
                # Score by length ratio (closer lengths = better match)
                ratio = min(len(p_norm), len(corpus_name)) / max(len(p_norm), len(corpus_name))
                matches.append((corpus_name, "substring", doc_ids, round(ratio, 3)))
                continue

        # Fuzzy word overlap: >60% of words shared
        c_words = _word_set(corpus_name)
        overlap = _word_overlap_score(p_words, c_words)
        if overlap > 0.6:
            matches.append((corpus_name, "fuzzy", doc_ids, round(overlap, 3)))

    # Sort by score descending
    matches.sort(key=lambda m: m[3], reverse=True)
    return matches


def _init_bridge_table(db: sqlite3.Connection):
    """Create entity_bridge table if it doesn't exist."""
    db.executescript(ENTITY_BRIDGE_SCHEMA)


def build_entity_bridge():
    """Main pipeline: match pulse entities to corpus and store results."""
    init_db()
    corpus_lookup = load_corpus_entities()
    doc_meta = load_corpus_doc_metadata()

    print(f"Loaded {len(corpus_lookup)} corpus entities across {len(doc_meta)} documents")

    with get_db() as db:
        _init_bridge_table(db)

        # Clear previous bridge data for a clean rebuild
        db.execute("DELETE FROM entity_bridge")

        # Load all analyses with entities
        rows = db.execute(
            "SELECT a.id, a.item_id, a.entities FROM analyses a"
        ).fetchall()

        if not rows:
            print("No analyses found in database. Run 'python -m pulse analyze' first.")
            return

        print(f"Processing entities from {len(rows)} analyzed items...")

        # Collect all unique pulse entities across all analyses
        all_pulse_entities: Dict[str, set] = {}  # entity_name -> set of item_ids
        for row in rows:
            item_id = row["item_id"]
            try:
                entities = json.loads(row["entities"]) if row["entities"] else []
            except (json.JSONDecodeError, TypeError):
                continue
            for ent in entities:
                # Handle both string entities and dict entities
                if isinstance(ent, str):
                    name = ent
                elif isinstance(ent, dict):
                    name = ent.get("name", ent.get("entity", ""))
                else:
                    continue
                if name:
                    if name not in all_pulse_entities:
                        all_pulse_entities[name] = set()
                    all_pulse_entities[name].add(item_id)

        print(f"Found {len(all_pulse_entities)} unique pulse entities")

        # Match each pulse entity against corpus
        bridge_rows = 0
        matched_entities: Dict[str, List[dict]] = {}  # pulse_entity -> corpus matches

        for pulse_entity, item_ids in all_pulse_entities.items():
            matches = match_entity(pulse_entity, corpus_lookup)
            if matches:
                matched_entities[pulse_entity] = []
                for corpus_name, match_type, doc_ids, score in matches:
                    db.execute(
                        """INSERT INTO entity_bridge
                           (pulse_entity, corpus_entity, corpus_doc_ids, match_type, match_score)
                           VALUES (?, ?, ?, ?, ?)""",
                        (
                            pulse_entity,
                            corpus_name,
                            json.dumps(doc_ids),
                            match_type,
                            score,
                        ),
                    )
                    bridge_rows += 1
                    matched_entities[pulse_entity].append({
                        "corpus_entity": corpus_name,
                        "doc_ids": doc_ids,
                        "match_type": match_type,
                        "score": score,
                    })

        print(f"Created {bridge_rows} bridge entries")

        # Update analyses with corpus_connections
        updated = 0
        for row in rows:
            item_id = row["item_id"]
            try:
                entities = json.loads(row["entities"]) if row["entities"] else []
            except (json.JSONDecodeError, TypeError):
                continue

            # Gather all corpus connections for this item's entities
            connections: Dict[int, dict] = {}  # doc_id -> best match info
            for ent in entities:
                if isinstance(ent, str):
                    name = ent
                elif isinstance(ent, dict):
                    name = ent.get("name", ent.get("entity", ""))
                else:
                    continue

                if name in matched_entities:
                    for match in matched_entities[name]:
                        for doc_id in match["doc_ids"]:
                            if doc_id not in connections or match["score"] > connections[doc_id].get("score", 0):
                                doc_title = doc_meta.get(doc_id, {}).get("title", "")
                                connections[doc_id] = {
                                    "doc_id": doc_id,
                                    "doc_title": doc_title,
                                    "matched_entity": match["corpus_entity"],
                                    "match_type": match["match_type"],
                                    "score": match["score"],
                                }

            if connections:
                # Sort by score, take top 10 most relevant
                conn_list = sorted(
                    connections.values(),
                    key=lambda c: c["score"],
                    reverse=True,
                )[:10]
                db.execute(
                    "UPDATE analyses SET corpus_connections = ? WHERE item_id = ?",
                    (json.dumps(conn_list), item_id),
                )
                updated += 1

        print(f"Updated {updated} analyses with corpus connections")
        print(f"Entity bridge build complete.")
