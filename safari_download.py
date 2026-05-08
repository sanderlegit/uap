#!/usr/bin/env python3
"""Download all UAP files using Safari as the HTTP client."""

import base64
import csv
import io
import json
import os
import subprocess
import sys
import time

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"
CSV_PATH = "/Users/sander/dev/illuminate/uap/uap-csv.csv"
CHUNK_SIZE = 4_000_000  # 4MB chunks for base64 transfer (~3MB binary)
MAX_SYNC_SIZE = 50_000_000  # 50MB max for sync XHR

for d in ["pdfs", "videos", "images"]:
    os.makedirs(os.path.join(UFO_DIR, d), exist_ok=True)


def run_safari_js(js_code, timeout=120):
    """Execute JavaScript in Safari and return the result."""
    cmd = ['osascript', '-e',
           f'tell application "Safari" to tell front document to do JavaScript "{js_code}"']
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return "TIMEOUT"
    except Exception as e:
        return f"ERROR: {e}"


def get_file_size(url):
    """Get file size via HEAD request in Safari."""
    js = f"""
(function() {{
    var x = new XMLHttpRequest();
    x.open('HEAD', '{url}', false);
    x.send();
    return x.status + ':' + (x.getResponseHeader('content-length') || '0');
}})()
""".replace('\n', ' ')
    result = run_safari_js(js, timeout=15)
    parts = result.split(':')
    if len(parts) == 2:
        return int(parts[0]), int(parts[1])
    return 0, 0


def download_small_file(url, dest_path):
    """Download a file < ~5MB in a single XHR + base64 transfer."""
    js = f"""
(function() {{
    try {{
        var x = new XMLHttpRequest();
        x.open('GET', '{url}', false);
        x.overrideMimeType('text/plain; charset=x-user-defined');
        x.send();
        if (x.status !== 200) return 'FETCH_ERROR:' + x.status;
        var raw = x.responseText;
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
        var binary = '';
        for (var j = 0; j < bytes.length; j += 8192) {{
            var chunk = bytes.subarray(j, Math.min(j + 8192, bytes.length));
            binary += String.fromCharCode.apply(null, chunk);
        }}
        window._uapFileB64 = btoa(binary);
        return 'B64_READY:' + bytes.length;
    }} catch(e) {{
        return 'ERROR:' + e.message;
    }}
}})()
""".replace('\n', ' ')
    result = run_safari_js(js, timeout=300)

    if result.startswith('B64_READY:'):
        b64_data = run_safari_js("window._uapFileB64", timeout=60)
        if b64_data and not b64_data.startswith('ERROR'):
            data = base64.b64decode(b64_data)
            with open(dest_path, 'wb') as f:
                f.write(data)
            run_safari_js("delete window._uapFileB64", timeout=5)
            return True, len(data)
    return False, result


def download_large_file(url, dest_path, file_size):
    """Download a large file in chunks using Safari."""
    chunk_size = 2_000_000  # 2MB chunks

    # First, initiate the download and store in Safari
    js_init = f"""
(function() {{
    try {{
        var x = new XMLHttpRequest();
        x.open('GET', '{url}', false);
        x.overrideMimeType('text/plain; charset=x-user-defined');
        x.send();
        if (x.status !== 200) return 'FETCH_ERROR:' + x.status;
        window._uapRaw = x.responseText;
        return 'STORED:' + window._uapRaw.length;
    }} catch(e) {{
        return 'ERROR:' + e.message;
    }}
}})()
""".replace('\n', ' ')
    result = run_safari_js(js_init, timeout=600)

    if not result.startswith('STORED:'):
        return False, result

    total_size = int(result.split(':')[1])
    print(f"    Stored {total_size} bytes in Safari, transferring in chunks...", file=sys.stderr)

    # Transfer in chunks
    chunks = []
    offset = 0
    chunk_num = 0
    while offset < total_size:
        end = min(offset + chunk_size, total_size)
        js_chunk = f"""
(function() {{
    var raw = window._uapRaw.substring({offset}, {end});
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
    var binary = '';
    for (var j = 0; j < bytes.length; j += 8192) {{
        var chunk = bytes.subarray(j, Math.min(j + 8192, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
    }}
    return btoa(binary);
}})()
""".replace('\n', ' ')
        b64_chunk = run_safari_js(js_chunk, timeout=120)
        if not b64_chunk or b64_chunk.startswith('ERROR'):
            run_safari_js("delete window._uapRaw", timeout=5)
            return False, f"Chunk {chunk_num} failed: {b64_chunk}"

        chunks.append(base64.b64decode(b64_chunk))
        offset = end
        chunk_num += 1
        pct = int(offset / total_size * 100)
        print(f"    Chunk {chunk_num}: {pct}%", file=sys.stderr, end='\r')

    # Clean up Safari memory
    run_safari_js("delete window._uapRaw", timeout=5)

    # Write to file
    with open(dest_path, 'wb') as f:
        for chunk in chunks:
            f.write(chunk)

    total_written = sum(len(c) for c in chunks)
    print(f"    Written {total_written} bytes", file=sys.stderr)
    return True, total_written


def parse_csv():
    """Parse the CSV and return download records."""
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        raw = f.read()

    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)
    records = []

    for row in rows[1:]:
        if len(row) < 14:
            continue
        title = row[2].strip()
        if not title:
            continue

        file_type = row[3].strip().upper()
        url = row[12].strip()
        dvids_id = row[7].strip()
        video_title = row[8].strip()
        agency = row[9].strip()
        incident_date = row[10].strip()
        incident_location = row[11].strip()
        description = row[6].strip()
        modal_image = row[13].strip()
        redaction = row[0].strip().upper() == "TRUE"
        release_date = row[1].strip()
        video_pairing = row[4].strip()
        pdf_pairing = row[5].strip()

        if file_type == "VIDEO" and dvids_id:
            url = url or ""

        if not url or not url.startswith("http"):
            if file_type == "VIDEO" and dvids_id:
                pass  # DVIDS videos handled separately
            else:
                continue

        if file_type == "VIDEO" or any(ext in url.lower() for ext in ['.mp4', '.mov', '.webm']):
            category = "videos"
        elif file_type in ("IMAGE", "JPG") or any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png']):
            category = "images"
        else:
            category = "pdfs"

        filename = os.path.basename(url.split("?")[0]) if url else f"{title}.mp4"

        records.append({
            "title": title,
            "type": file_type,
            "url": url,
            "filename": filename,
            "category": category,
            "agency": agency,
            "release_date": release_date,
            "incident_date": incident_date,
            "incident_location": incident_location,
            "description": description,
            "modal_image": modal_image,
            "dvids_video_id": dvids_id,
            "video_title": video_title,
            "has_redaction": redaction,
            "video_pairing": video_pairing,
            "pdf_pairing": pdf_pairing,
        })

    return records


def main():
    records = parse_csv()
    print(f"Total records: {len(records)}", file=sys.stderr)

    # Sort by estimated size (DOW mission reports first, FBI vault files last)
    records.sort(key=lambda r: (
        0 if "dow-uap" in r["filename"].lower() and r["category"] != "images" else
        1 if r["category"] == "images" else
        2 if "62-hq-83894" not in r["filename"].lower() else 3,
        r["filename"]
    ))

    manifest = {"total_files": len(records), "records": []}
    success_count = 0
    fail_count = 0
    skip_count = 0
    failures = []

    for i, record in enumerate(records):
        url = record["url"]
        filename = record["filename"]
        category = record["category"]
        dest_path = os.path.join(UFO_DIR, category, filename)

        record["local_path"] = f"{category}/{filename}"
        manifest["records"].append(record)

        print(f"\n[{i+1}/{len(records)}] {category}/{filename}", file=sys.stderr)

        # Skip if already downloaded
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            size = os.path.getsize(dest_path)
            print(f"  SKIP (already exists, {size} bytes)", file=sys.stderr)
            skip_count += 1
            continue

        if not url or not url.startswith("http"):
            print(f"  SKIP (no valid URL)", file=sys.stderr)
            skip_count += 1
            continue

        # Get file size
        status, file_size = get_file_size(url)
        if status == 404:
            print(f"  FAIL (404 Not Found)", file=sys.stderr)
            fail_count += 1
            failures.append({"title": record["title"], "url": url, "error": "404"})
            continue
        elif status != 200:
            print(f"  FAIL (HTTP {status})", file=sys.stderr)
            fail_count += 1
            failures.append({"title": record["title"], "url": url, "error": f"HTTP {status}"})
            continue

        print(f"  Size: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)", file=sys.stderr)

        if file_size > MAX_SYNC_SIZE:
            print(f"  Downloading large file in chunks...", file=sys.stderr)
            ok, result = download_large_file(url, dest_path, file_size)
        else:
            ok, result = download_small_file(url, dest_path)

        if ok:
            success_count += 1
            actual_size = result if isinstance(result, int) else os.path.getsize(dest_path)
            print(f"  OK ({actual_size:,} bytes)", file=sys.stderr)
        else:
            fail_count += 1
            failures.append({"title": record["title"], "url": url, "error": str(result)})
            print(f"  FAIL ({result})", file=sys.stderr)

        # Small delay between requests
        time.sleep(0.5)

    # Save manifest
    manifest["download_summary"] = {
        "success": success_count,
        "skipped": skip_count,
        "failed": fail_count,
        "failures": failures,
    }
    manifest_path = os.path.join(UFO_DIR, "manifest.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"DOWNLOAD COMPLETE", file=sys.stderr)
    print(f"Success: {success_count}, Skipped: {skip_count}, Failed: {fail_count}", file=sys.stderr)
    print(f"Manifest: {manifest_path}", file=sys.stderr)
    if failures:
        print(f"Failed files:", file=sys.stderr)
        for f_item in failures:
            print(f"  - {f_item['title']}: {f_item['error']}", file=sys.stderr)


if __name__ == "__main__":
    main()
