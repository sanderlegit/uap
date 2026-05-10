#!/usr/bin/env python3
"""
analyze_ocr_quality.py — Classify OCR quality and content type for each page.

For each document, samples page images and sends them to Claude vision along
with the corresponding OCR text. Claude classifies content type, source medium,
scan quality, OCR artifacts, and OCR accuracy.

Results cached in data/ocr_quality/ and merged into
website/public/data/ocr_quality.json.

Usage:
    python analyze_ocr_quality.py              # analyze all (incremental)
    python analyze_ocr_quality.py --force       # re-analyze everything
    python analyze_ocr_quality.py --doc 42      # analyze only doc 42
    python analyze_ocr_quality.py --sample 5    # max 5 pages per doc (default: 8)
    python analyze_ocr_quality.py --model sonnet # model to use (default: haiku)
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "website" / "public" / "data"
PAGES_DIR = DATA_DIR / "pages"
OCR_QUALITY_DIR = SCRIPT_DIR / "data" / "ocr_quality"
DOCUMENTS_JSON = DATA_DIR / "documents.json"
OUTPUT_JSON = DATA_DIR / "ocr_quality.json"

# ---------------------------------------------------------------------------
# Canonical tag vocabulary
# ---------------------------------------------------------------------------
CONTENT_TYPES = [
    "typewritten",       # typewriter-era typed text
    "typeset",           # professionally printed / laser-printed
    "handwritten",       # handwritten text (notes, annotations, letters)
    "form",              # structured form with fill-in fields
    "photograph",        # photographic content (scene, object, person)
    "diagram",           # charts, maps, technical drawings, graphs
    "table",             # tabular data
    "cover_page",        # title page, cover sheet, routing slip
    "redacted",          # primarily redacted / blacked-out content
    "blank",             # blank or near-blank page
    "mixed",             # multiple content types on one page
]

SOURCE_MEDIA = [
    "scan_photocopy",    # scanned from a photocopy
    "scan_original",     # scanned from an original document
    "scan_microfilm",    # scanned from microfilm / microfiche
    "digital_native",    # born-digital (computer-generated PDF)
    "photograph_of_doc", # photo of a physical document
]

SCAN_QUALITIES = [
    "excellent",  # crisp, high contrast, well-aligned
    "good",       # clearly readable, minor issues
    "fair",       # readable with effort, some degradation
    "poor",       # significant degradation, partial illegibility
    "illegible",  # largely or entirely unreadable
]

OCR_ARTIFACTS = [
    "skew",           # page is rotated / skewed
    "noise",          # background speckling / visual noise
    "bleed_through",  # text from reverse side showing
    "faded",          # faded or low-contrast text
    "stamps_marks",   # stamps, handwritten notes overlaid on text
    "cut_off",        # text cut off at page edges
    "warped",         # page warping / distortion
    "dark_scan",      # over-dark scan
    "light_scan",     # over-light / washed-out scan
]

OCR_ACCURACY = [
    "accurate",        # OCR text faithfully represents the page
    "mostly_accurate", # minor OCR errors but readable
    "partial",         # captured some text but missed significant portions
    "garbled",         # OCR text is mostly nonsensical
    "empty",           # no OCR text despite visible content
    "not_applicable",  # page is photo / blank / fully redacted
]


def get_page_text(doc_detail: dict, page_num: int) -> str:
    """Extract OCR text for a specific page (1-indexed) from full_text."""
    full_text = doc_detail.get("full_text", "")
    if not full_text:
        return ""
    pages = full_text.split("--- PAGE BREAK ---")
    idx = page_num - 1
    if 0 <= idx < len(pages):
        return pages[idx].strip()
    return ""


def select_pages(total_pages: int, max_sample: int) -> List[int]:
    """Select which pages to analyze. Always includes first and last."""
    if total_pages <= max_sample:
        return list(range(1, total_pages + 1))

    pages = [1]
    if total_pages > 1:
        step = (total_pages - 1) / (max_sample - 1)
        for i in range(1, max_sample - 1):
            p = int(1 + i * step)
            if p not in pages:
                pages.append(p)
        if total_pages not in pages:
            pages.append(total_pages)

    return sorted(set(pages))[:max_sample]


def build_prompt(doc_id: int, page_num: int, ocr_text: str, image_path: str) -> str:
    ocr_preview = ocr_text[:3000] if ocr_text else "(no OCR text for this page)"
    char_count = len(ocr_text)

    return f"""You are analyzing a single page from a declassified U.S. government document about UAP/UFOs. Your job is to classify the page content and assess how well OCR performed on it.

TASK: Read the page image at {image_path}, then compare what you see against the OCR text below.

DOCUMENT ID: {doc_id}
PAGE: {page_num}
OCR TEXT LENGTH: {char_count} characters

OCR TEXT FOR THIS PAGE:
---
{ocr_preview}
---

After reading the image and reviewing the OCR text, respond with ONLY a JSON object (no markdown, no code fences):

{{
  "content_types": ["primary content type from: {', '.join(CONTENT_TYPES)}"],
  "source_medium": "one of: {', '.join(SOURCE_MEDIA)}",
  "scan_quality": "one of: {', '.join(SCAN_QUALITIES)}",
  "ocr_artifacts": ["zero or more from: {', '.join(OCR_ARTIFACTS)}"],
  "ocr_accuracy": "one of: {', '.join(OCR_ACCURACY)}",
  "text_coverage_pct": 85,
  "notes": "1 sentence describing what you see and any OCR issues"
}}

Rules:
- content_types: list 1-3 types. Use "mixed" only if truly multiple types.
- text_coverage_pct: estimated percentage of visible text that OCR captured correctly (0-100).
- For photographs with no text expected, use ocr_accuracy "not_applicable" and text_coverage_pct null.
- Be precise about scan_quality — "excellent" means crisp and perfectly aligned, "good" means clearly readable."""


def call_claude(prompt: str, doc_id: int, page_num: int, model: str) -> Optional[dict]:
    """Call claude -p with Read tool access and parse the JSON response."""
    try:
        result = subprocess.run(
            [
                "claude",
                "-p", prompt,
                "--output-format", "json",
                "--model", model,
                "--allowedTools", "Read",
                "--dangerously-skip-permissions",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            print(f"    ERROR p{page_num}: claude exited {result.returncode}", file=sys.stderr)
            return None

        raw = result.stdout.strip()
        if not raw:
            return None

        try:
            envelope = json.loads(raw)
        except json.JSONDecodeError:
            envelope = None

        if envelope and isinstance(envelope, dict) and "result" in envelope:
            inner = envelope["result"]
        elif envelope and isinstance(envelope, dict) and "content_types" in envelope:
            return envelope
        else:
            inner = raw

        if isinstance(inner, str):
            text = inner.strip()
            if text.startswith("```"):
                text = text[text.index("\n") + 1:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                text = re.sub(r',\s*}', '}', text)
                text = re.sub(r',\s*]', ']', text)
                return json.loads(text)
        elif isinstance(inner, dict):
            return inner

        return None

    except subprocess.TimeoutExpired:
        print(f"    ERROR p{page_num}: timeout", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"    ERROR p{page_num}: JSON parse failed: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"    ERROR p{page_num}: {e}", file=sys.stderr)
        return None


def analyze_document(doc_id: int, doc_summary: dict, max_sample: int, model: str, force: bool) -> Optional[dict]:
    """Analyze OCR quality for a single document."""
    cache_path = OCR_QUALITY_DIR / f"doc_{doc_id}.json"

    if not force and cache_path.exists():
        try:
            data = json.loads(cache_path.read_text())
            if "pages" in data and len(data["pages"]) > 0:
                return data
        except (json.JSONDecodeError, OSError):
            pass

    total_pages = doc_summary.get("total_pages", 0)
    if total_pages == 0:
        # Check if there's a single page image (e.g. photo documents stored as JPG)
        if (PAGES_DIR / f"{doc_id}_p1.jpg").exists():
            total_pages = 1
        else:
            return None

    # Load full doc detail for OCR text
    doc_detail_path = DATA_DIR / f"doc_{doc_id}.json"
    if doc_detail_path.exists():
        doc_detail = json.loads(doc_detail_path.read_text())
    else:
        doc_detail = {}

    pages_to_analyze = select_pages(total_pages, max_sample)

    print(f"  Analyzing {len(pages_to_analyze)}/{total_pages} pages: {pages_to_analyze}", file=sys.stderr)

    page_results = []
    for page_num in pages_to_analyze:
        image_path = PAGES_DIR / f"{doc_id}_p{page_num}.jpg"
        if not image_path.exists():
            print(f"    p{page_num}: image missing, skipping", file=sys.stderr)
            continue

        ocr_text = get_page_text(doc_detail, page_num)
        prompt = build_prompt(doc_id, page_num, ocr_text, str(image_path))

        print(f"    p{page_num}...", end="", file=sys.stderr, flush=True)
        result = call_claude(prompt, doc_id, page_num, model)

        if result:
            result["page"] = page_num
            page_results.append(result)
            accuracy = result.get("ocr_accuracy", "?")
            quality = result.get("scan_quality", "?")
            print(f" {accuracy}/{quality}", file=sys.stderr)
        else:
            print(f" FAILED", file=sys.stderr)

        time.sleep(0.3)

    if not page_results:
        return None

    # Compute document-level summary
    doc_result = {
        "doc_id": doc_id,
        "title": doc_summary.get("title", ""),
        "agency": doc_summary.get("agency", ""),
        "filename": doc_summary.get("filename", ""),
        "total_pages": total_pages,
        "pages_sampled": len(page_results),
        "extraction_method": doc_summary.get("extraction_method", ""),
        "ocr_applied": doc_summary.get("ocr_applied", 0),
        "pages": page_results,
        "summary": compute_summary(page_results),
    }

    cache_path.write_text(json.dumps(doc_result, indent=2, ensure_ascii=False))
    return doc_result


def compute_summary(pages: List[dict]) -> dict:
    """Aggregate page-level results into a document summary."""
    content_types = {}
    source_media = {}
    qualities = {}
    artifacts = {}
    accuracies = {}
    coverages = []

    for p in pages:
        for ct in p.get("content_types", []):
            content_types[ct] = content_types.get(ct, 0) + 1
        sm = p.get("source_medium", "")
        if sm:
            source_media[sm] = source_media.get(sm, 0) + 1
        q = p.get("scan_quality", "")
        if q:
            qualities[q] = qualities.get(q, 0) + 1
        for a in p.get("ocr_artifacts", []):
            artifacts[a] = artifacts.get(a, 0) + 1
        acc = p.get("ocr_accuracy", "")
        if acc:
            accuracies[acc] = accuracies.get(acc, 0) + 1
        cov = p.get("text_coverage_pct")
        if cov is not None:
            coverages.append(cov)

    quality_scores = {"excellent": 5, "good": 4, "fair": 3, "poor": 2, "illegible": 1}
    accuracy_scores = {"accurate": 5, "mostly_accurate": 4, "partial": 3, "garbled": 2, "empty": 1, "not_applicable": None}

    avg_quality = None
    if qualities:
        vals = [quality_scores.get(q, 3) for q in qualities for _ in range(qualities[q])]
        avg_quality = round(sum(vals) / len(vals), 2)

    avg_coverage = round(sum(coverages) / len(coverages), 1) if coverages else None

    dominant_content = max(content_types, key=content_types.get) if content_types else None
    dominant_medium = max(source_media, key=source_media.get) if source_media else None
    dominant_quality = max(qualities, key=qualities.get) if qualities else None
    dominant_accuracy = max(accuracies, key=accuracies.get) if accuracies else None

    return {
        "dominant_content_type": dominant_content,
        "dominant_source_medium": dominant_medium,
        "dominant_scan_quality": dominant_quality,
        "dominant_ocr_accuracy": dominant_accuracy,
        "avg_quality_score": avg_quality,
        "avg_text_coverage_pct": avg_coverage,
        "content_type_counts": content_types,
        "source_medium_counts": source_media,
        "scan_quality_counts": qualities,
        "ocr_artifact_counts": artifacts,
        "ocr_accuracy_counts": accuracies,
    }


def merge_results(doc_ids: List[int]) -> dict:
    """Merge all cached results into the output JSON."""
    results = {}
    for doc_id in doc_ids:
        path = OCR_QUALITY_DIR / f"doc_{doc_id}.json"
        if path.exists():
            try:
                results[str(doc_id)] = json.loads(path.read_text())
            except (json.JSONDecodeError, OSError):
                pass

    # Compute corpus-level stats
    corpus_stats = {
        "total_documents": len(results),
        "content_type_distribution": {},
        "source_medium_distribution": {},
        "scan_quality_distribution": {},
        "ocr_accuracy_distribution": {},
        "artifact_frequency": {},
        "avg_text_coverage_pct": None,
        "documents_by_quality_tier": {"high": [], "medium": [], "low": []},
    }

    coverages = []
    for doc_id_str, doc in results.items():
        summary = doc.get("summary", {})
        for ct, count in summary.get("content_type_counts", {}).items():
            corpus_stats["content_type_distribution"][ct] = (
                corpus_stats["content_type_distribution"].get(ct, 0) + count
            )
        for sm, count in summary.get("source_medium_counts", {}).items():
            corpus_stats["source_medium_distribution"][sm] = (
                corpus_stats["source_medium_distribution"].get(sm, 0) + count
            )
        for q, count in summary.get("scan_quality_counts", {}).items():
            corpus_stats["scan_quality_distribution"][q] = (
                corpus_stats["scan_quality_distribution"].get(q, 0) + count
            )
        for acc, count in summary.get("ocr_accuracy_counts", {}).items():
            corpus_stats["ocr_accuracy_distribution"][acc] = (
                corpus_stats["ocr_accuracy_distribution"].get(acc, 0) + count
            )
        for art, count in summary.get("ocr_artifact_counts", {}).items():
            corpus_stats["artifact_frequency"][art] = (
                corpus_stats["artifact_frequency"].get(art, 0) + count
            )

        avg_cov = summary.get("avg_text_coverage_pct")
        if avg_cov is not None:
            coverages.append(avg_cov)

        avg_q = summary.get("avg_quality_score")
        if avg_q is not None:
            if avg_q >= 4:
                corpus_stats["documents_by_quality_tier"]["high"].append(int(doc_id_str))
            elif avg_q >= 3:
                corpus_stats["documents_by_quality_tier"]["medium"].append(int(doc_id_str))
            else:
                corpus_stats["documents_by_quality_tier"]["low"].append(int(doc_id_str))

    if coverages:
        corpus_stats["avg_text_coverage_pct"] = round(sum(coverages) / len(coverages), 1)

    output = {
        "corpus_stats": corpus_stats,
        "documents": results,
    }

    OUTPUT_JSON.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nMerged {len(results)} results into {OUTPUT_JSON}", file=sys.stderr)
    return output


def main():
    parser = argparse.ArgumentParser(description="Analyze OCR quality across the document corpus")
    parser.add_argument("--force", action="store_true", help="Re-analyze even if cached")
    parser.add_argument("--doc", type=int, default=None, help="Analyze a single document by ID")
    parser.add_argument("--sample", type=int, default=8, help="Max pages to sample per document (default: 8)")
    parser.add_argument("--model", type=str, default="haiku", help="Claude model to use (default: haiku)")
    args = parser.parse_args()

    OCR_QUALITY_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading documents from {DOCUMENTS_JSON}", file=sys.stderr)
    documents = json.loads(DOCUMENTS_JSON.read_text())
    print(f"  Found {len(documents)} documents", file=sys.stderr)

    all_ids = sorted(d["id"] for d in documents)
    doc_lookup = {d["id"]: d for d in documents}

    if args.doc is not None:
        if args.doc not in doc_lookup:
            print(f"ERROR: doc ID {args.doc} not found", file=sys.stderr)
            sys.exit(1)
        target_ids = [args.doc]
    else:
        target_ids = all_ids

    counts = {"analyzed": 0, "skipped": 0, "failed": 0}
    total = len(target_ids)

    print(f"\nProcessing {total} document(s) (force={args.force}, sample={args.sample}, model={args.model})\n", file=sys.stderr)

    for i, doc_id in enumerate(target_ids):
        doc = doc_lookup[doc_id]
        title = doc.get("title", "Untitled")[:60]
        print(f"[{i + 1}/{total}] Doc {doc_id}: {title}", file=sys.stderr)

        if not args.force and (OCR_QUALITY_DIR / f"doc_{doc_id}.json").exists():
            try:
                cached = json.loads((OCR_QUALITY_DIR / f"doc_{doc_id}.json").read_text())
                if "pages" in cached and len(cached["pages"]) > 0:
                    print(f"  -> Skipped (cached)", file=sys.stderr)
                    counts["skipped"] += 1
                    continue
            except (json.JSONDecodeError, OSError):
                pass

        result = analyze_document(doc_id, doc, args.sample, args.model, args.force)

        if result:
            s = result["summary"]
            print(f"  -> {s.get('dominant_content_type', '?')} / {s.get('dominant_scan_quality', '?')} / OCR: {s.get('dominant_ocr_accuracy', '?')}", file=sys.stderr)
            counts["analyzed"] += 1
        else:
            print(f"  -> FAILED", file=sys.stderr)
            counts["failed"] += 1

    print(f"\n{'=' * 50}", file=sys.stderr)
    print(f"OCR QUALITY ANALYSIS COMPLETE", file=sys.stderr)
    print(f"  Analyzed: {counts['analyzed']}", file=sys.stderr)
    print(f"  Skipped:  {counts['skipped']}", file=sys.stderr)
    print(f"  Failed:   {counts['failed']}", file=sys.stderr)
    print(f"{'=' * 50}", file=sys.stderr)

    print(f"\nMerging results...", file=sys.stderr)
    output = merge_results(all_ids)

    stats = output["corpus_stats"]
    print(f"\nCORPUS SUMMARY:", file=sys.stderr)
    print(f"  Documents analyzed: {stats['total_documents']}", file=sys.stderr)
    print(f"  Avg text coverage: {stats.get('avg_text_coverage_pct', 'N/A')}%", file=sys.stderr)
    print(f"  Content types: {json.dumps(stats['content_type_distribution'])}", file=sys.stderr)
    print(f"  Scan quality:  {json.dumps(stats['scan_quality_distribution'])}", file=sys.stderr)
    print(f"  OCR accuracy:  {json.dumps(stats['ocr_accuracy_distribution'])}", file=sys.stderr)
    print(f"  Artifacts:     {json.dumps(stats['artifact_frequency'])}", file=sys.stderr)
    print(f"  Quality tiers: high={len(stats['documents_by_quality_tier']['high'])}, "
          f"medium={len(stats['documents_by_quality_tier']['medium'])}, "
          f"low={len(stats['documents_by_quality_tier']['low'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
