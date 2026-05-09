#!/usr/bin/env python3
"""
Build entities.json from documents.json.

Reads all documents, extracts entities, normalizes and deduplicates them,
and writes a cross-reference file for the UAP Document Explorer.

Usage:
    python build_entities.py
"""

import json
import re
import os
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), "website", "public", "data")
DOCUMENTS_JSON = os.path.join(DATA_DIR, "documents.json")
OUTPUT_JSON = os.path.join(DATA_DIR, "entities.json")

# Minimum number of documents an entity must appear in to be included
MIN_DOC_COUNT = 2

# Entity types that are numeric measurements — not useful for cross-referencing
SKIP_TYPES = {
    "duration_seconds",
    "duration_minutes",
    "duration_hours",
    "altitude_ft",
    "speed_mph",
    "speed_knots",
}


def normalize_key(value: str) -> str:
    """Normalize an entity value for deduplication.

    Uppercases, strips whitespace, and removes punctuation like periods
    and hyphens so that 'U.S. AIR FORCE', 'US AIR FORCE', and 'AIR FORCE'
    all map to the same key.
    """
    s = value.upper().strip()
    # Remove periods, replace hyphens with spaces, collapse whitespace
    s = s.replace(".", "")
    s = s.replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def pick_canonical(names: set) -> str:
    """Pick the shortest name as canonical (uppercase).

    Among all observed surface forms, the shortest uppercase version is
    typically the most general (e.g. 'AIR FORCE' over 'U.S. AIR FORCE').
    """
    upper_names = {n.upper().strip() for n in names}
    return min(upper_names, key=len)


def main():
    # Load documents
    with open(DOCUMENTS_JSON, "r") as f:
        documents = json.load(f)

    # Build lookup for agency and decade per document id
    doc_meta = {}
    for doc in documents:
        doc_meta[doc["id"]] = {
            "agency": doc.get("agency", "Unknown"),
            "decade": doc.get("decade", "Unknown"),
        }

    # Aggregate entities
    # Key: (normalized_key, entity_type) -> {surface_names, doc_ids}
    entity_map = defaultdict(lambda: {"names": set(), "doc_ids": set()})

    docs_with_entities = 0

    for doc in documents:
        doc_id = doc["id"]
        entities = doc.get("entities", [])
        if not entities:
            continue
        docs_with_entities += 1

        # Track entities already seen in this document to avoid counting twice
        seen_in_doc = set()

        for ent in entities:
            etype = ent.get("entity_type", "unknown")
            evalue = ent.get("entity_value", "").strip()

            if not evalue or etype in SKIP_TYPES:
                continue

            norm = normalize_key(evalue)
            key = (norm, etype)

            if key in seen_in_doc:
                continue
            seen_in_doc.add(key)

            entity_map[key]["names"].add(evalue)
            entity_map[key]["doc_ids"].add(doc_id)

    # Build output list
    entities_out = []
    for (norm_key, etype), data in entity_map.items():
        doc_ids = sorted(data["doc_ids"])
        if len(doc_ids) < MIN_DOC_COUNT:
            continue

        canonical = pick_canonical(data["names"])
        agencies = sorted({doc_meta[d]["agency"] for d in doc_ids if d in doc_meta})
        decades = sorted({doc_meta[d]["decade"] for d in doc_ids if d in doc_meta})

        entities_out.append(
            {
                "name": canonical,
                "type": etype,
                "doc_ids": doc_ids,
                "doc_count": len(doc_ids),
                "agencies": agencies,
                "decades": decades,
            }
        )

    # Sort by doc_count descending, then name ascending for stability
    entities_out.sort(key=lambda e: (-e["doc_count"], e["name"]))

    # Write output
    with open(OUTPUT_JSON, "w") as f:
        json.dump(entities_out, f, indent=2)

    print(f"Generated {len(entities_out)} entities from {docs_with_entities} documents")
    print(f"Output: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
