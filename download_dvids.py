#!/usr/bin/env python3
"""Download DVIDS videos via Safari."""

import csv
import io
import os
import subprocess
import sys
import time

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"
VIDEO_DIR = os.path.join(UFO_DIR, "videos")
os.makedirs(VIDEO_DIR, exist_ok=True)


def run_safari_js(js_code, timeout=120):
    cmd = ['osascript', '-e',
           f'tell application "Safari" to tell front document to do JavaScript "{js_code}"']
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip()
    except:
        return "ERROR"


def main():
    csv_path = "/Users/sander/dev/illuminate/uap/uap-csv.csv"
    with open(csv_path) as f:
        raw = f.read()

    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)

    videos = []
    for row in rows[1:]:
        if len(row) < 14:
            continue
        title = row[2].strip()
        ft = row[3].strip().upper()
        dvids_id = row[7].strip()
        if ft == "VID" and dvids_id:
            videos.append({"title": title, "dvids_id": dvids_id})

    print(f"Found {len(videos)} DVIDS videos", file=sys.stderr)

    for i, video in enumerate(videos):
        dvids_id = video["dvids_id"]
        title = video["title"]
        safe_title = title.replace(" ", "_").replace(",", "").replace("/", "_")
        dest = os.path.join(VIDEO_DIR, f"{safe_title}.mp4")

        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"[{i+1}/{len(videos)}] SKIP {title}", file=sys.stderr)
            continue

        print(f"[{i+1}/{len(videos)}] Getting DVIDS video URL for {title} (ID: {dvids_id})...", file=sys.stderr)

        # Get the DVIDS embed/download URL from Safari
        js = f"""
(function() {{
    try {{
        var x = new XMLHttpRequest();
        x.open('GET', 'https://api.dvidshub.net/search?api_key=key-68bb60d16b35e&id=' + {dvids_id} + '&type=video', false);
        x.send();
        if (x.status === 200) {{
            var data = JSON.parse(x.responseText);
            if (data.results && data.results.length > 0) {{
                var v = data.results[0];
                return JSON.stringify({{
                    title: v.title,
                    url: v.url,
                    thumbnail: v.thumbnail,
                    duration: v.duration,
                    download: v.download_url || v.url
                }});
            }}
        }}
        return 'NO_RESULTS:' + x.status;
    }} catch(e) {{
        return 'ERROR:' + e.message;
    }}
}})()
""".replace('\n', ' ')
        result = run_safari_js(js, timeout=30)
        print(f"  DVIDS response: {result[:200]}", file=sys.stderr)
        time.sleep(1)

    print("Done checking DVIDS videos", file=sys.stderr)


if __name__ == "__main__":
    main()
