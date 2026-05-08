#!/usr/bin/env python3
"""Phase 2: Extract text from all downloaded PDFs and build corpus."""

import json
import os
import sys
import subprocess

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')

import fitz  # PyMuPDF

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"
CORPUS_DIR = os.path.join(UFO_DIR, "corpus")
os.makedirs(CORPUS_DIR, exist_ok=True)


def extract_text_pymupdf(pdf_path):
    """Extract text from PDF using PyMuPDF."""
    try:
        doc = fitz.open(pdf_path)
        pages = []
        total_text = []
        has_text = False
        redacted_pages = 0

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()

            if text.strip():
                has_text = True

            # Check for redaction indicators
            if "[REDACTED]" in text or "█" in text or len(text.strip()) < 10:
                redacted_pages += 1

            pages.append({
                "page": page_num + 1,
                "text": text,
                "char_count": len(text),
            })
            total_text.append(text)

        doc.close()

        return {
            "total_pages": len(pages),
            "has_extractable_text": has_text,
            "redacted_pages": redacted_pages,
            "full_text": "\n\n--- PAGE BREAK ---\n\n".join(total_text),
            "pages": pages,
        }
    except Exception as e:
        return {"error": str(e), "total_pages": 0, "has_extractable_text": False, "full_text": ""}


def extract_text_pdftotext(pdf_path):
    """Fallback: use pdftotext (poppler) for extraction."""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", pdf_path, "-"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            return result.stdout
        return ""
    except:
        return ""


def main():
    manifest_path = os.path.join(UFO_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        print("No manifest.json found. Run download first.", file=sys.stderr)
        return

    with open(manifest_path) as f:
        manifest = json.load(f)

    corpus = []
    stats = {"total": 0, "extracted": 0, "failed": 0, "scanned_only": 0}

    pdf_dir = os.path.join(UFO_DIR, "pdfs")
    pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')] if os.path.exists(pdf_dir) else []

    print(f"Found {len(pdf_files)} PDF files to process", file=sys.stderr)

    for i, filename in enumerate(sorted(pdf_files)):
        pdf_path = os.path.join(pdf_dir, filename)
        stats["total"] += 1

        print(f"[{i+1}/{len(pdf_files)}] {filename}...", end="", file=sys.stderr)

        # Extract with PyMuPDF
        result = extract_text_pymupdf(pdf_path)

        if result.get("error"):
            print(f" ERROR: {result['error']}", file=sys.stderr)
            stats["failed"] += 1
            continue

        # If PyMuPDF got no text, try pdftotext
        if not result["has_extractable_text"]:
            alt_text = extract_text_pdftotext(pdf_path)
            if alt_text.strip():
                result["full_text"] = alt_text
                result["has_extractable_text"] = True
                result["extraction_method"] = "pdftotext"
            else:
                result["extraction_method"] = "none_scanned"
                stats["scanned_only"] += 1
                print(f" SCANNED (no extractable text, {result['total_pages']} pages)", file=sys.stderr)
        else:
            result["extraction_method"] = "pymupdf"
            stats["extracted"] += 1

        text_len = len(result["full_text"])
        print(f" OK ({result['total_pages']} pages, {text_len:,} chars)", file=sys.stderr)

        # Find matching manifest record
        record_meta = {}
        for rec in manifest.get("records", []):
            if rec.get("filename", "").lower() == filename.lower():
                record_meta = rec
                break

        # Save individual text file
        txt_path = os.path.join(CORPUS_DIR, filename.replace('.pdf', '.txt'))
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(result["full_text"])

        # Build corpus entry
        corpus_entry = {
            "filename": filename,
            "title": record_meta.get("title", filename),
            "agency": record_meta.get("agency", ""),
            "release_date": record_meta.get("release_date", ""),
            "incident_date": record_meta.get("incident_date", ""),
            "incident_location": record_meta.get("incident_location", ""),
            "description": record_meta.get("description", ""),
            "type": record_meta.get("type", "PDF"),
            "has_redaction": record_meta.get("has_redaction", False),
            "total_pages": result["total_pages"],
            "extraction_method": result.get("extraction_method", "pymupdf"),
            "has_extractable_text": result["has_extractable_text"],
            "redacted_pages": result.get("redacted_pages", 0),
            "text_length": text_len,
            "full_text": result["full_text"],
        }
        corpus.append(corpus_entry)

    # Save corpus
    corpus_path = os.path.join(UFO_DIR, "corpus.json")
    with open(corpus_path, 'w', encoding='utf-8') as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"TEXT EXTRACTION COMPLETE", file=sys.stderr)
    print(f"Total: {stats['total']}, Extracted: {stats['extracted']}, "
          f"Scanned-only: {stats['scanned_only']}, Failed: {stats['failed']}", file=sys.stderr)
    print(f"Corpus saved to: {corpus_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
