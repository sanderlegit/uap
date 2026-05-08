#!/usr/bin/env python3
"""Parse CSV and generate the download list as JSON for Safari to process."""

import csv
import json
import io
import os
import sys

def parse_csv():
    csv_path = "/Users/sander/dev/illuminate/uap/uap-csv.csv"
    with open(csv_path, 'r', encoding='utf-8') as f:
        raw = f.read()

    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)
    records = []

    for i, row in enumerate(rows[1:], start=1):
        if len(row) < 13:
            continue
        title = row[2].strip()
        if not title:
            continue

        file_type = row[3].strip().upper()
        url = row[12].strip()
        dvids_id = row[7].strip()

        if file_type == "VIDEO" and dvids_id and not url:
            continue  # Skip DVIDS videos for now

        if not url or not url.startswith("http"):
            continue

        # Determine category
        if file_type == "VIDEO" or any(ext in url.lower() for ext in ['.mp4', '.mov', '.webm']):
            category = "videos"
        elif file_type in ("IMAGE", "JPG") or any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png']):
            category = "images"
        else:
            category = "pdfs"

        filename = os.path.basename(url.split("?")[0])
        if not filename:
            filename = title.replace(" ", "_") + (".pdf" if category == "pdfs" else ".jpg")

        records.append({
            "url": url,
            "filename": filename,
            "category": category,
            "title": title,
        })

    return records

records = parse_csv()
print(f"Total downloadable files: {len(records)}", file=sys.stderr)

# Sort: small files first (DOW mission reports), then FBI
records.sort(key=lambda r: (0 if "dow-uap" in r["filename"].lower() else 1, r["filename"]))

with open("/tmp/uap_download_list.json", "w") as f:
    json.dump(records, f, indent=2)

print(f"Download list saved to /tmp/uap_download_list.json", file=sys.stderr)

# Print summary
cats = {}
for r in records:
    cats[r["category"]] = cats.get(r["category"], 0) + 1
print(f"Categories: {cats}", file=sys.stderr)
