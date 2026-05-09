#!/usr/bin/env python3
"""Render every page of every PDF as a JPEG for inline page-by-page reading."""

import json
import os
import sys
from pathlib import Path

import fitz  # PyMuPDF

BASE = Path(__file__).parent
PDF_DIR = BASE / "ufo-files" / "pdfs"
IMG_DIR = BASE / "ufo-files" / "images"
OUT_DIR = BASE / "website" / "public" / "data" / "pages"
DOCS_JSON = BASE / "website" / "public" / "data" / "documents.json"

SCALE = 1.5          # ~918x1188 for standard letter
JPEG_QUALITY = 75
LARGE_DOC_QUALITY = 65  # for docs with 100+ pages


def render_pdf_pages(pdf_path, doc_id, page_count):
    quality = LARGE_DOC_QUALITY if page_count > 100 else JPEG_QUALITY
    doc = fitz.open(pdf_path)
    pages = []

    for p in range(doc.page_count):
        page = doc[p]
        pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
        data = pix.tobytes("jpeg", quality)

        # Skip near-blank pages (< 2KB usually means empty)
        if len(data) < 2048:
            pages.append(None)
            continue

        out_path = OUT_DIR / f"{doc_id}_p{p+1}.jpg"
        out_path.write_bytes(data)
        pages.append({
            "page": p + 1,
            "file": f"{doc_id}_p{p+1}.jpg",
            "width": pix.width,
            "height": pix.height,
            "size_kb": len(data) // 1024,
        })

    doc.close()
    return [p for p in pages if p is not None]


def render_image_as_page(img_path, doc_id):
    from PIL import Image
    import io

    img = Image.open(img_path)
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (15, 23, 42))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    max_w = int(612 * SCALE)
    if img.width > max_w:
        ratio = max_w / img.width
        img = img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=JPEG_QUALITY)
    data = buf.getvalue()

    out_path = OUT_DIR / f"{doc_id}_p1.jpg"
    out_path.write_bytes(data)

    return [{
        "page": 1,
        "file": f"{doc_id}_p1.jpg",
        "width": img.width,
        "height": img.height,
        "size_kb": len(data) // 1024,
    }]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    docs = json.loads(DOCS_JSON.read_text())
    manifest = {}

    total = len(docs)
    total_pages_rendered = 0
    total_size_kb = 0

    for i, doc in enumerate(docs):
        doc_id = doc["id"]
        filename = doc["filename"]
        page_count = doc.get("total_pages", 0)

        pdf_path = PDF_DIR / filename
        img_path = IMG_DIR / filename

        if pdf_path.exists():
            print(f"[{i+1}/{total}] PDF  {filename} ({page_count} pages)")
            pages = render_pdf_pages(pdf_path, doc_id, page_count)
        elif img_path.exists():
            print(f"[{i+1}/{total}] IMG  {filename}")
            pages = render_image_as_page(img_path, doc_id)
        else:
            print(f"[{i+1}/{total}] SKIP {filename}")
            continue

        manifest[str(doc_id)] = {
            "page_count": len(pages),
            "pages": pages,
        }
        total_pages_rendered += len(pages)
        total_size_kb += sum(p["size_kb"] for p in pages)

        if (i + 1) % 10 == 0:
            print(f"  ... {total_pages_rendered} pages rendered, {total_size_kb // 1024}MB so far")

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"\nDone: {len(manifest)} documents, {total_pages_rendered} pages")
    print(f"Total size: {total_size_kb / 1024:.1f}MB")


if __name__ == "__main__":
    main()
