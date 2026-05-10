#!/usr/bin/env python3
"""Fetch the war.gov/UFO page using requests with proper session handling."""

import sys
sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')

import requests
import time

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
})

# First, get the homepage to establish cookies
print("Getting homepage first...", file=sys.stderr)
r = session.get('https://www.war.gov/', timeout=30)
print(f"Homepage: {r.status_code}, cookies: {dict(session.cookies)}", file=sys.stderr)

time.sleep(2)

# Now try the UFO page
print("Getting UFO page...", file=sys.stderr)
session.headers['Referer'] = 'https://www.war.gov/'
r = session.get('https://www.war.gov/UFO/', timeout=30)
print(f"UFO page: {r.status_code}, size: {len(r.text)}", file=sys.stderr)

with open('/tmp/war_ufo_full.html', 'w') as f:
    f.write(r.text)

if r.status_code == 200:
    print(f"Success! Saved {len(r.text)} chars to /tmp/war_ufo_full.html", file=sys.stderr)
else:
    print(f"Failed with status {r.status_code}", file=sys.stderr)
    print(r.text[:500], file=sys.stderr)
