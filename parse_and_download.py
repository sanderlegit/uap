#!/usr/bin/env python3
"""Parse the UAP CSV and download all files."""

import csv
import json
import os
import sys
import time
import re
import io

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')
import requests

BASE_DIR = "/Users/sander/dev/illuminate/uap"
UFO_DIR = os.path.join(BASE_DIR, "ufo-files")

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.war.gov/UFO/',
})


def parse_csv():
    """Parse the UAP CSV file into structured records."""
    csv_path = os.path.join(BASE_DIR, "uap-csv.csv")
    with open(csv_path, 'r', encoding='utf-8') as f:
        raw = f.read()

    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)

    headers = [h.strip() for h in rows[0]]
    print(f"CSV Headers: {headers}", file=sys.stderr)
    print(f"Total rows (including header): {len(rows)}", file=sys.stderr)

    records = []
    for i, row in enumerate(rows[1:], start=2):
        if len(row) < 13:
            continue

        title = row[2].strip() if len(row) > 2 else ""
        if not title:
            continue

        file_type = row[3].strip().upper() if len(row) > 3 else ""
        description = row[6].strip() if len(row) > 6 else ""
        dvids_id = row[7].strip() if len(row) > 7 else ""
        video_title = row[8].strip() if len(row) > 8 else ""
        agency = row[9].strip() if len(row) > 9 else ""
        incident_date = row[10].strip() if len(row) > 10 else ""
        incident_location = row[11].strip() if len(row) > 11 else ""
        download_url = row[12].strip() if len(row) > 12 else ""
        modal_image = row[13].strip() if len(row) > 13 else ""
        redaction = row[0].strip().upper() if row[0].strip() else ""
        release_date = row[1].strip() if len(row) > 1 else ""
        video_pairing = row[4].strip() if len(row) > 4 else ""
        pdf_pairing = row[5].strip() if len(row) > 5 else ""

        if file_type == "VIDEO" and dvids_id:
            download_url = f"https://www.dvidshub.net/video/{dvids_id}"

        record = {
            "id": i - 1,
            "title": title,
            "type": file_type,
            "agency": agency,
            "release_date": release_date,
            "incident_date": incident_date,
            "incident_location": incident_location,
            "description": description,
            "download_url": download_url,
            "modal_image": modal_image,
            "dvids_video_id": dvids_id,
            "video_title": video_title,
            "video_pairing": video_pairing,
            "pdf_pairing": pdf_pairing,
            "has_redaction": redaction == "TRUE",
        }
        records.append(record)

    return records


def categorize_file(record):
    """Determine which subdirectory a file belongs in."""
    ft = record["type"].upper()
    url = record["download_url"].lower()

    if ft == "VIDEO" or any(ext in url for ext in ['.mp4', '.mov', '.webm']):
        return "videos"
    elif ft == "IMAGE" or ft == "JPG" or any(ext in url for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']):
        return "images"
    else:
        return "pdfs"


def get_filename(record):
    """Extract filename from download URL or title."""
    url = record["download_url"]
    if url and "war.gov" in url:
        path = url.split("?")[0]
        return os.path.basename(path)
    title = record["title"].replace(" ", "_").replace("/", "_")
    ft = record["type"].lower()
    if ft == "pdf":
        return f"{title}.pdf"
    elif ft == "video":
        return f"{title}.mp4"
    elif ft in ("image", "jpg"):
        return f"{title}.jpg"
    return f"{title}.pdf"


def download_file(url, dest_path, record_title=""):
    """Download a single file with retry logic."""
    if os.path.exists(dest_path):
        size = os.path.getsize(dest_path)
        if size > 0:
            return True, f"Already exists ({size} bytes)"

    if not url or url.startswith("https://www.dvidshub.net"):
        return False, "DVIDS video - needs separate download"

    for attempt in range(3):
        try:
            resp = session.get(url, timeout=60, stream=True, allow_redirects=True)
            if resp.status_code == 200:
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with open(dest_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                size = os.path.getsize(dest_path)
                return True, f"Downloaded ({size} bytes)"
            elif resp.status_code == 403:
                return False, f"HTTP 403 Forbidden"
            else:
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return False, f"HTTP {resp.status_code}"
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            return False, str(e)

    return False, "Max retries exceeded"


def main():
    print("Parsing CSV...", file=sys.stderr)
    records = parse_csv()
    print(f"Found {len(records)} records", file=sys.stderr)

    # Count by type
    type_counts = {}
    for r in records:
        t = categorize_file(r)
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"By category: {type_counts}", file=sys.stderr)

    agency_counts = {}
    for r in records:
        a = r["agency"] or "Unknown"
        agency_counts[a] = agency_counts.get(a, 0) + 1
    print(f"By agency: {agency_counts}", file=sys.stderr)

    # Create directory structure
    for d in ["pdfs", "videos", "images"]:
        os.makedirs(os.path.join(UFO_DIR, d), exist_ok=True)

    # Build manifest
    manifest = {
        "total_files": len(records),
        "breakdown": type_counts,
        "agencies": agency_counts,
        "records": []
    }

    # Download files
    success = 0
    failed = 0
    skipped = 0
    failures = []

    for i, record in enumerate(records):
        cat = categorize_file(record)
        filename = get_filename(record)
        dest = os.path.join(UFO_DIR, cat, filename)

        record["local_path"] = os.path.relpath(dest, UFO_DIR)
        record["category"] = cat
        record["filename"] = filename
        manifest["records"].append(record)

        url = record["download_url"]
        print(f"[{i+1}/{len(records)}] {cat}/{filename}", end="", file=sys.stderr)

        ok, msg = download_file(url, dest, record["title"])
        if ok:
            if "Already" in msg:
                skipped += 1
                print(f" - SKIP ({msg})", file=sys.stderr)
            else:
                success += 1
                print(f" - OK ({msg})", file=sys.stderr)
        else:
            failed += 1
            failures.append({"title": record["title"], "url": url, "error": msg})
            print(f" - FAIL ({msg})", file=sys.stderr)

        # Rate limiting
        if ok and "Downloaded" in msg:
            time.sleep(1.5)

    # Save manifest
    manifest["download_summary"] = {
        "success": success,
        "skipped": skipped,
        "failed": failed,
        "failures": failures
    }

    manifest_path = os.path.join(UFO_DIR, "manifest.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n=== DOWNLOAD COMPLETE ===", file=sys.stderr)
    print(f"Success: {success}, Skipped: {skipped}, Failed: {failed}", file=sys.stderr)
    print(f"Manifest saved to: {manifest_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
