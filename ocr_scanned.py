#!/usr/bin/env python3
"""Problem 1: OCR the 60 scanned PDFs that have no extractable text."""

import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')

import fitz  # PyMuPDF

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"
CORPUS_DIR = os.path.join(UFO_DIR, "corpus")
OCRMYPDF = "/Users/sander/Library/Python/3.9/bin/ocrmypdf"

os.environ["PATH"] = "/opt/homebrew/bin:" + os.environ.get("PATH", "")


def decrypt_pdf(pdf_path):
    """Remove owner-password encryption using qpdf."""
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        dec_path = tmp.name
    try:
        result = subprocess.run(
            ['qpdf', '--decrypt', pdf_path, dec_path],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            return dec_path
        if result.returncode == 3:
            return dec_path
        os.unlink(dec_path)
        return None
    except Exception:
        if os.path.exists(dec_path):
            os.unlink(dec_path)
        return None


def ocr_pdf(pdf_path):
    """Run ocrmypdf on a PDF and extract the resulting text."""
    dec_path = decrypt_pdf(pdf_path)
    input_path = dec_path if dec_path else pdf_path

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [OCRMYPDF, '--force-ocr', '--language', 'eng',
             '--optimize', '0', '--output-type', 'pdf',
             input_path, tmp_path],
            capture_output=True, text=True, timeout=600
        )

        if result.returncode != 0:
            stderr = result.stderr[:500]
            if 'PriorOcrFoundError' in stderr:
                subprocess.run(
                    [OCRMYPDF, '--skip-text', '--language', 'eng',
                     '--optimize', '0', '--output-type', 'pdf',
                     input_path, tmp_path],
                    capture_output=True, text=True, timeout=600
                )
            elif 'EncryptedPdfError' in stderr:
                return None, "PDF encrypted and qpdf decrypt failed"
            else:
                return None, f"ocrmypdf failed: {stderr}"

        doc = fitz.open(tmp_path)
        pages = []
        full_text_parts = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            pages.append({"page": page_num + 1, "text": text, "char_count": len(text)})
            full_text_parts.append(text)
        doc.close()

        full_text = "\n\n--- PAGE BREAK ---\n\n".join(full_text_parts)
        return full_text, None

    except subprocess.TimeoutExpired:
        return None, "OCR timed out (600s)"
    except Exception as e:
        return None, str(e)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if dec_path and os.path.exists(dec_path):
            os.unlink(dec_path)


def main():
    corpus_path = os.path.join(UFO_DIR, "corpus.json")
    with open(corpus_path) as f:
        corpus = json.load(f)

    needs_ocr = []
    for entry in corpus:
        if entry.get("ocr_applied"):
            continue
        if not entry.get("has_extractable_text") or entry.get("extraction_method") == "none_scanned":
            needs_ocr.append(entry)
        elif entry.get("text_length", 0) < 500 and entry.get("total_pages", 0) > 1:
            needs_ocr.append(entry)

    print(f"Found {len(needs_ocr)} PDFs needing OCR", file=sys.stderr)

    ocr_stats = {"success": 0, "failed": 0, "total_chars": 0}

    for i, entry in enumerate(needs_ocr):
        filename = entry["filename"]
        pdf_path = os.path.join(UFO_DIR, "pdfs", filename)

        if not os.path.exists(pdf_path):
            print(f"[{i+1}/{len(needs_ocr)}] SKIP {filename} (file missing)", file=sys.stderr)
            continue

        pages = entry.get("total_pages", 0)
        print(f"[{i+1}/{len(needs_ocr)}] OCR {filename} ({pages} pages)...", end="", file=sys.stderr, flush=True)

        text, error = ocr_pdf(pdf_path)

        if error:
            print(f" FAIL: {error}", file=sys.stderr)
            ocr_stats["failed"] += 1
            continue

        text_len = len(text) if text else 0
        if text_len < 50:
            print(f" LOW TEXT ({text_len} chars)", file=sys.stderr)
        else:
            print(f" OK ({text_len:,} chars)", file=sys.stderr)

        entry["full_text"] = text or ""
        entry["text_length"] = text_len
        entry["has_extractable_text"] = text_len > 50
        entry["extraction_method"] = "ocrmypdf"
        entry["ocr_applied"] = True

        txt_path = os.path.join(CORPUS_DIR, filename.replace('.pdf', '.txt'))
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text or "")

        ocr_stats["success"] += 1
        ocr_stats["total_chars"] += text_len

    with open(corpus_path, 'w', encoding='utf-8') as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"OCR COMPLETE", file=sys.stderr)
    print(f"Success: {ocr_stats['success']}, Failed: {ocr_stats['failed']}", file=sys.stderr)
    print(f"Total new text: {ocr_stats['total_chars']:,} chars", file=sys.stderr)


if __name__ == "__main__":
    main()
