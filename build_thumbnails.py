#!/usr/bin/env python3
"""Generate thumbnail and cover images for all documents."""

import json
import os
import sys
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image
import io

BASE = Path(__file__).parent
PDF_DIR = BASE / "ufo-files" / "pdfs"
IMG_DIR = BASE / "ufo-files" / "images"
OUT_DIR = BASE / "website" / "public" / "data" / "thumbnails"
DOCS_JSON = BASE / "website" / "public" / "data" / "documents.json"

THUMB_SCALE = 0.5   # ~306x396
COVER_SCALE = 1.5   # ~918x1188
MICRO_WIDTH = 48    # tiny webp for lists/graphs
JPEG_QUALITY = 80
MICRO_QUALITY = 50


def render_pdf_page(pdf_path, page_num=0, scale=1.5):
    doc = fitz.open(pdf_path)
    if doc.page_count == 0:
        doc.close()
        return None
    page = doc[min(page_num, doc.page_count - 1)]
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
    data = pix.tobytes("jpeg", JPEG_QUALITY)
    doc.close()
    return data


def render_image(img_path, max_width):
    img = Image.open(img_path)
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (15, 23, 42))  # slate-950
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    ratio = max_width / img.width
    new_size = (max_width, int(img.height * ratio))
    img = img.resize(new_size, Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=JPEG_QUALITY)
    return buf.getvalue()


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    docs = json.loads(DOCS_JSON.read_text())
    manifest = {}

    total = len(docs)
    for i, doc in enumerate(docs):
        doc_id = doc["id"]
        filename = doc["filename"]

        thumb_path = OUT_DIR / f"{doc_id}_thumb.jpg"
        cover_path = OUT_DIR / f"{doc_id}_cover.jpg"

        # Determine source file
        pdf_path = PDF_DIR / filename
        img_path = IMG_DIR / filename

        entry = {"id": doc_id, "filename": filename}

        if pdf_path.exists():
            print(f"[{i+1}/{total}] PDF  {filename}")
            thumb_data = render_pdf_page(pdf_path, scale=THUMB_SCALE)
            cover_data = render_pdf_page(pdf_path, scale=COVER_SCALE)

            if thumb_data:
                thumb_path.write_bytes(thumb_data)
                entry["thumb"] = f"{doc_id}_thumb.jpg"
                entry["thumb_kb"] = len(thumb_data) // 1024

            if cover_data:
                cover_path.write_bytes(cover_data)
                entry["cover"] = f"{doc_id}_cover.jpg"
                entry["cover_kb"] = len(cover_data) // 1024

        elif img_path.exists():
            print(f"[{i+1}/{total}] IMG  {filename}")
            thumb_data = render_image(img_path, max_width=306)
            cover_data = render_image(img_path, max_width=918)

            if thumb_data:
                thumb_path.write_bytes(thumb_data)
                entry["thumb"] = f"{doc_id}_thumb.jpg"
                entry["thumb_kb"] = len(thumb_data) // 1024

            if cover_data:
                cover_path.write_bytes(cover_data)
                entry["cover"] = f"{doc_id}_cover.jpg"
                entry["cover_kb"] = len(cover_data) // 1024
        else:
            print(f"[{i+1}/{total}] SKIP {filename} (not found)")
            continue

        manifest[str(doc_id)] = entry

    # Generate micro thumbnails from existing thumbs
    micro_total = 0
    for doc_id_str, entry in manifest.items():
        thumb_path = OUT_DIR / f"{doc_id_str}_thumb.jpg"
        micro_path = OUT_DIR / f"{doc_id_str}_micro.webp"
        if thumb_path.exists():
            img = Image.open(thumb_path)
            ratio = MICRO_WIDTH / img.width
            img = img.resize((MICRO_WIDTH, int(img.height * ratio)), Image.LANCZOS)
            img.save(micro_path, "WEBP", quality=MICRO_QUALITY)
            micro_total += micro_path.stat().st_size
            img.close()

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    total_thumb = sum(e.get("thumb_kb", 0) for e in manifest.values())
    total_cover = sum(e.get("cover_kb", 0) for e in manifest.values())
    print(f"\nDone: {len(manifest)} documents")
    print(f"Thumbnails: {total_thumb}KB, Covers: {total_cover}KB, Micro: {micro_total // 1024}KB")
    print(f"Total: {(total_thumb + total_cover + micro_total // 1024) / 1024:.1f}MB")


if __name__ == "__main__":
    main()
