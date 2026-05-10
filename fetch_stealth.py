#!/usr/bin/env python3
"""Fetch war.gov/UFO using Playwright with stealth mode."""

import json
import sys
import time

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )
        stealth = Stealth()
        page = context.new_page()
        stealth.apply_stealth_sync(page)

        # Capture network requests
        responses_data = {}
        def handle_response(response):
            url = response.url
            ct = response.headers.get('content-type', '')
            if any(x in ct for x in ['json', 'javascript', 'csv', 'xml']):
                if 'UFO' in url or 'ufo' in url or 'aaro' in url or 'Interactive' in url:
                    try:
                        body = response.text()
                        responses_data[url] = body[:50000]
                        print(f"  CAPTURED: {url} ({len(body)} bytes, type: {ct})", file=sys.stderr)
                    except:
                        pass

        page.on("response", handle_response)

        print("Loading war.gov/UFO/ with stealth...", file=sys.stderr)
        try:
            resp = page.goto("https://www.war.gov/UFO/", wait_until="domcontentloaded", timeout=30000)
            print(f"Response status: {resp.status}", file=sys.stderr)
        except Exception as e:
            print(f"Navigation error: {e}", file=sys.stderr)

        # Wait for page to load
        time.sleep(3)

        # Check if we got blocked
        title = page.title()
        print(f"Page title: {title}", file=sys.stderr)

        html_len = len(page.content())
        print(f"HTML length: {html_len}", file=sys.stderr)

        if html_len < 1000:
            print("Got blocked. Trying homepage first...", file=sys.stderr)
            page.goto("https://www.war.gov/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)
            print(f"Homepage title: {page.title()}, HTML: {len(page.content())}", file=sys.stderr)
            time.sleep(2)
            resp = page.goto("https://www.war.gov/UFO/", wait_until="domcontentloaded", timeout=30000)
            print(f"Retry UFO: status={resp.status}, HTML={len(page.content())}", file=sys.stderr)
            time.sleep(5)

        # Wait for full load
        print("Waiting for network idle...", file=sys.stderr)
        try:
            page.wait_for_load_state("networkidle", timeout=20000)
        except:
            pass

        time.sleep(5)

        html = page.content()
        with open("/tmp/war_ufo_full.html", "w") as f:
            f.write(html)
        print(f"Saved HTML: {len(html)} chars", file=sys.stderr)

        # Save captured responses
        if responses_data:
            with open("/tmp/war_ufo_responses.json", "w") as f:
                json.dump(responses_data, f, indent=2)
            print(f"Saved {len(responses_data)} captured responses", file=sys.stderr)

        # Try to get the page data
        try:
            # Check for DataTable
            has_dt = page.evaluate("() => typeof $.fn.DataTable !== 'undefined'")
            print(f"Has DataTable: {has_dt}", file=sys.stderr)

            # Count tables
            table_count = page.evaluate("() => document.querySelectorAll('table').length")
            print(f"Tables on page: {table_count}", file=sys.stderr)

            # Get all links
            links = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a[href]'))
                    .map(a => ({href: a.href, text: a.textContent.trim().substring(0, 100)}))
                    .filter(l => l.href.includes('.pdf') || l.href.includes('.mp4') ||
                                 l.href.includes('.jpg') || l.href.includes('.png') ||
                                 l.href.includes('.mov') || l.href.includes('Portals') ||
                                 l.href.includes('UFO') || l.href.includes('media.defense'));
            }""")
            print(f"Relevant links: {len(links)}", file=sys.stderr)
            with open("/tmp/war_ufo_links.json", "w") as f:
                json.dump(links, f, indent=2)

        except Exception as e:
            print(f"Extraction error: {e}", file=sys.stderr)

        browser.close()
        print("Done!", file=sys.stderr)

if __name__ == "__main__":
    main()
