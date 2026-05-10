#!/usr/bin/env python3
"""
annotate_documents.py — Grounded annotation of UAP documents using Claude.

Iterates over all 129 declassified documents and calls `claude -p` to produce
grounded, per-document annotations. Results are cached in data/annotations/
and merged into website/public/data/doc_narratives.json.

Usage:
    python annotate_documents.py              # annotate all (incremental)
    python annotate_documents.py --force      # re-annotate everything
    python annotate_documents.py --doc 42     # annotate only doc 42
    python annotate_documents.py --doc 42 --force  # force re-annotate doc 42
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Paths (relative to this script's location)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "website" / "public" / "data"
ANNOTATIONS_DIR = SCRIPT_DIR / "data" / "annotations"
DOCUMENTS_JSON = DATA_DIR / "documents.json"
MANIFEST_JSON = DATA_DIR / "manifest.json"
NARRATIVES_JSON = DATA_DIR / "doc_narratives.json"

# ---------------------------------------------------------------------------
# Annotation fields we expect in a valid result
# ---------------------------------------------------------------------------
REQUIRED_FIELDS = {
    "hook",
    "why_it_matters",
    "key_findings",
    "document_type",
    "legacy_program_connections",
    "related_topics",
}


def is_valid_annotation(path: Path) -> bool:
    """Check whether an existing annotation file has valid, complete content."""
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text())
        if not isinstance(data, dict):
            return False
        return REQUIRED_FIELDS.issubset(data.keys())
    except (json.JSONDecodeError, OSError):
        return False


def format_list(items: list, key: Optional[str] = None) -> str:
    """Turn a list of strings or dicts into a readable comma-separated string."""
    if not items:
        return "None listed"
    parts = []
    for item in items:
        if key and isinstance(item, dict):
            parts.append(str(item.get(key, item)))
        else:
            parts.append(str(item))
    return ", ".join(parts) if parts else "None listed"


def build_prompt(doc: dict, manifest_entry: Optional[dict]) -> str:
    """Build the annotation prompt for a single document."""

    # --- Metadata ---
    title = doc.get("title", "Untitled")
    agency = doc.get("agency", "Unknown")
    date = doc.get("incident_date_parsed") or doc.get("incident_date", "Unknown")
    location = doc.get("incident_location", "Unknown")
    total_pages = doc.get("total_pages", "Unknown")
    extraction_method = doc.get("extraction_method", "Unknown")
    ocr_applied = doc.get("ocr_applied", 0)
    extraction_str = str(extraction_method)
    if ocr_applied:
        extraction_str += " + OCR"

    # --- Redaction summary ---
    redaction = doc.get("redaction", [])
    has_redaction = doc.get("has_redaction", 0)
    if redaction and isinstance(redaction, list) and len(redaction) > 0:
        r = redaction[0]
        redacted_pages = r.get("redacted_pages", 0)
        black_area_pct = r.get("black_area_pct", 0.0)
        redaction_summary = (
            f"{redacted_pages} pages with redaction markers, "
            f"{black_area_pct:.1f}% area blacked out"
        )
    elif has_redaction:
        redaction_summary = "Yes (details unavailable)"
    else:
        redaction_summary = "No redactions detected"

    # --- Manifest description ---
    manifest_block = ""
    if manifest_entry and manifest_entry.get("description"):
        manifest_block = (
            f"\nOFFICIAL DESCRIPTION (from war.gov manifest):\n"
            f"{manifest_entry['description']}\n"
        )

    # --- Entities, sensors, behaviors, shapes ---
    sensors = doc.get("sensors", [])
    sensors_str = format_list(sensors, key="sensor_type")

    behaviors = doc.get("behaviors", [])
    behaviors_str = format_list(behaviors, key="behavior_type") if behaviors else "None listed"

    shapes = doc.get("shapes", [])
    shapes_str = format_list(shapes, key="shape") if shapes else "None listed"

    entities = doc.get("entities", [])
    entities_str = format_list(entities, key="entity_value")

    # --- Document text ---
    full_text = doc.get("full_text", "")
    text_length = doc.get("text_length", 0)

    if text_length == 0 or not full_text or not full_text.strip():
        text_block = (
            "This document is a photograph/image with no extractable text. "
            "Analysis must be based solely on metadata and manifest description."
        )
    elif len(full_text) <= 15000:
        text_block = full_text
    else:
        # Truncate: first 8000 + last 4000
        text_block = (
            full_text[:8000]
            + "\n\n[... middle truncated ...]\n\n"
            + full_text[-4000:]
        )

    # --- Assemble prompt ---
    prompt = f"""You are analyzing a declassified U.S. government document about Unidentified Anomalous Phenomena (UAP) from the PURSUE release on war.gov. Produce a grounded analysis based ONLY on what the document actually contains. Do not hallucinate or infer details not present in the text.

DOCUMENT METADATA:
- Title: {title}
- Agency: {agency}
- Date: {date}
- Location: {location}
- Pages: {total_pages}
- Text extracted via: {extraction_str}
- Redactions: {redaction_summary}
{manifest_block}
ENTITIES MENTIONED: {entities_str}
SENSORS: {sensors_str}
BEHAVIORS: {behaviors_str}
SHAPES: {shapes_str}

DOCUMENT TEXT:
{text_block}

---

Respond with a JSON object (no markdown, no code fences, just raw JSON):
{{
  "hook": "1-2 sentence factual summary of what this document IS (not interpretation). Be specific about content.",
  "why_it_matters": "2-3 sentences on the document's significance in the context of UAP disclosure. Ground every claim in the actual content. Never cite page counts unless you counted them from the text. Never generalize across documents you haven't seen.",
  "key_findings": [
    {{
      "finding": "A specific factual finding from the document. Ground it in the text.",
      "quotes": [
        {{
          "text": "The exact verbatim quote from the document text. Copy character-for-character — do not paraphrase or clean up OCR artifacts.",
          "page": 1
        }}
      ]
    }}
  ],
  "document_type": "one of: mission_report, investigation, memo, photo, cable, analysis, congressional, technical, historical_file, other",
  "legacy_program_connections": [
    {{
      "node_id": "one of: nro, cia_oga, cia_dst, aaro, blue_book, five_eyes, doe_aec, sandia, lanl_ornl_battelle, mitre, wright_patterson, aea_1954, lockheed, northrop, saic, irad, area51, congressional",
      "relevance": "high, medium, or low",
      "reasoning": "1 sentence explaining why this document relates to this program node, based on document content"
    }}
  ],
  "related_topics": ["3-5 keyword topics for cross-referencing, e.g. 'radar tracking', 'nuclear facility', 'pilot testimony'"]
}}

Important:
- Produce 3-5 key_findings. Each MUST include a "quotes" array with 1-3 verbatim excerpts copied exactly from the document text. Each quote has a "text" string and a 1-indexed "page" number. Pages are separated by "--- PAGE BREAK ---" markers. Count from 1. Include multiple quotes when a finding draws from different pages or passages.
- For "legacy_program_connections": only include nodes that the document content actually relates to. Most documents connect to 2-4 nodes.
- The "hook" should be unique to THIS document. Never use template language like "This is Section X of...".
- For FBI HQ files (62-HQ-83894 sections): each section contains different reports and memos. Describe what THIS section specifically contains.
- Ground everything in the text. If the text is heavily redacted, say so. If it's a photo, describe what we know from metadata.
- For photos/images with no extractable text: set quotes to an empty array []."""

    return prompt


def call_claude(prompt: str, doc_id: int) -> Optional[dict]:
    """Call `claude -p` and parse the JSON response."""
    try:
        result = subprocess.run(
            [
                "claude",
                "-p", prompt,
                "--output-format", "json",
                "--model", "sonnet",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            print(f"  ERROR doc {doc_id}: claude exited with code {result.returncode}")
            if result.stderr:
                print(f"  stderr: {result.stderr[:300]}")
            return None

        # --output-format json wraps the response in a JSON envelope
        # The actual text is in the "result" field
        raw = result.stdout.strip()
        if not raw:
            print(f"  ERROR doc {doc_id}: empty response from claude")
            return None

        # Parse the outer envelope
        try:
            envelope = json.loads(raw)
        except json.JSONDecodeError:
            # Maybe it's raw text, try to find JSON in it
            envelope = None

        # Extract the inner content
        if envelope and isinstance(envelope, dict) and "result" in envelope:
            inner = envelope["result"]
        elif envelope and isinstance(envelope, dict) and REQUIRED_FIELDS.issubset(envelope.keys()):
            # Directly the annotation object
            return envelope
        else:
            inner = raw

        # The inner content should be a JSON string
        if isinstance(inner, str):
            # Strip markdown code fences if present
            text = inner.strip()
            if text.startswith("```"):
                # Remove opening fence
                first_newline = text.index("\n")
                text = text[first_newline + 1:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            annotation = json.loads(text)
        elif isinstance(inner, dict):
            annotation = inner
        else:
            print(f"  ERROR doc {doc_id}: unexpected response type: {type(inner)}")
            return None

        # Validate
        if not isinstance(annotation, dict):
            print(f"  ERROR doc {doc_id}: response is not a dict")
            return None

        missing = REQUIRED_FIELDS - set(annotation.keys())
        if missing:
            print(f"  WARNING doc {doc_id}: missing fields {missing}, accepting partial result")

        return annotation

    except subprocess.TimeoutExpired:
        print(f"  ERROR doc {doc_id}: claude timed out after 120s")
        return None
    except json.JSONDecodeError as e:
        print(f"  ERROR doc {doc_id}: failed to parse JSON response: {e}")
        if result.stdout:
            print(f"  Raw output (first 500 chars): {result.stdout[:500]}")
        return None
    except Exception as e:
        print(f"  ERROR doc {doc_id}: unexpected error: {e}")
        return None


def annotate_doc(doc_id: int, documents: list, manifest: dict, force: bool) -> str:
    """
    Annotate a single document. Returns one of: 'annotated', 'skipped', 'failed'.
    """
    annotation_path = ANNOTATIONS_DIR / f"doc_{doc_id}.json"

    # Check cache
    if not force and is_valid_annotation(annotation_path):
        return "skipped"

    # Find document in the index
    doc_summary = None
    for d in documents:
        if d["id"] == doc_id:
            doc_summary = d
            break

    if doc_summary is None:
        print(f"  ERROR doc {doc_id}: not found in documents.json")
        return "failed"

    # Load full document detail (has full_text)
    doc_detail_path = DATA_DIR / f"doc_{doc_id}.json"
    if doc_detail_path.exists():
        doc = json.loads(doc_detail_path.read_text())
    else:
        doc = dict(doc_summary)

    # Merge summary fields into doc (summary has some fields doc_N doesn't)
    for key in ("agency", "decade", "filename", "incident_date_parsed", "incident_location",
                "total_pages", "text_length", "extraction_method", "ocr_applied", "has_redaction"):
        if key not in doc and key in doc_summary:
            doc[key] = doc_summary[key]

    # Get manifest entry
    filename = doc.get("filename", "") or doc_summary.get("filename", "")
    manifest_entry = manifest.get(filename)

    # Build prompt
    prompt = build_prompt(doc, manifest_entry)

    # Call Claude
    print(f"  Calling claude for doc {doc_id}: {doc.get('title', 'Untitled')[:60]}...")
    annotation = call_claude(prompt, doc_id)

    if annotation is None:
        return "failed"

    # Write annotation
    annotation_path.write_text(json.dumps(annotation, indent=2, ensure_ascii=False))
    return "annotated"


def merge_annotations(doc_ids: List[int]) -> None:
    """Merge all annotation files into doc_narratives.json."""
    narratives = {}

    for doc_id in doc_ids:
        annotation_path = ANNOTATIONS_DIR / f"doc_{doc_id}.json"
        if annotation_path.exists():
            try:
                data = json.loads(annotation_path.read_text())
                narratives[str(doc_id)] = data
            except (json.JSONDecodeError, OSError) as e:
                print(f"  WARNING: could not read annotation for doc {doc_id}: {e}")

    NARRATIVES_JSON.write_text(json.dumps(narratives, indent=2, ensure_ascii=False))
    print(f"\nMerged {len(narratives)} annotations into {NARRATIVES_JSON}")


def main():
    parser = argparse.ArgumentParser(
        description="Annotate UAP documents using Claude"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-annotate even if cached results exist",
    )
    parser.add_argument(
        "--doc",
        type=int,
        default=None,
        help="Annotate a single document by ID",
    )
    args = parser.parse_args()

    # Create annotations directory
    ANNOTATIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    print(f"Loading documents from {DOCUMENTS_JSON}")
    documents = json.loads(DOCUMENTS_JSON.read_text())
    print(f"  Found {len(documents)} documents")

    print(f"Loading manifest from {MANIFEST_JSON}")
    manifest = json.loads(MANIFEST_JSON.read_text())
    print(f"  Found {len(manifest)} manifest entries")

    # Determine which doc IDs to process
    all_ids = sorted(d["id"] for d in documents)
    if args.doc is not None:
        if args.doc not in all_ids:
            print(f"ERROR: doc ID {args.doc} not found (valid range: {min(all_ids)}-{max(all_ids)})")
            sys.exit(1)
        target_ids = [args.doc]
    else:
        target_ids = all_ids

    # Process
    counts = {"annotated": 0, "skipped": 0, "failed": 0}
    total = len(target_ids)

    print(f"\nProcessing {total} document(s) (force={args.force})...\n")

    for i, doc_id in enumerate(target_ids):
        prefix = f"[{i + 1}/{total}] Doc {doc_id}"
        print(prefix)

        status = annotate_doc(doc_id, documents, manifest, force=args.force)
        counts[status] += 1

        if status == "annotated":
            print(f"  -> Annotated successfully")
        elif status == "skipped":
            print(f"  -> Skipped (cached)")
        else:
            print(f"  -> FAILED")

        # Sleep between API calls (not after skips, not after the last one)
        if status == "annotated" and i < total - 1:
            time.sleep(0.5)

    # Summary
    print(f"\n{'=' * 50}")
    print(f"SUMMARY")
    print(f"  Annotated: {counts['annotated']}")
    print(f"  Skipped:   {counts['skipped']}")
    print(f"  Failed:    {counts['failed']}")
    print(f"  Total:     {total}")
    print(f"{'=' * 50}")

    # Merge all annotations into doc_narratives.json
    print(f"\nMerging annotations...")
    merge_annotations(all_ids)


if __name__ == "__main__":
    main()
