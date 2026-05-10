#!/usr/bin/env python3
"""Scrape war.gov/UFO/ using Playwright to get all 162 UAP file entries."""

import json
import sys
import time

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')

from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()

        all_requests = []
        def handle_request(request):
            url = request.url
            if any(ext in url.lower() for ext in ['.json', '.csv', '.xml', 'api', 'data']):
                all_requests.append(url)

        page.on("request", handle_request)

        print("Loading war.gov/UFO/...", file=sys.stderr)
        page.goto("https://www.war.gov/UFO/", wait_until="networkidle", timeout=60000)

        # Wait for DataTable to initialize
        print("Waiting for DataTable...", file=sys.stderr)
        time.sleep(5)

        # Try to wait for the table
        try:
            page.wait_for_selector("table", timeout=15000)
            print("Found table element", file=sys.stderr)
        except:
            print("No table found, trying longer wait...", file=sys.stderr)
            time.sleep(10)

        # Save full page HTML
        html = page.content()
        with open("/tmp/war_ufo_full.html", "w") as f:
            f.write(html)
        print(f"Saved full HTML: {len(html)} chars", file=sys.stderr)

        # Try to extract DataTable data via JavaScript
        try:
            table_data = page.evaluate("""() => {
                // Try DataTables API
                if ($.fn.DataTable) {
                    const tables = $('table.dataTable');
                    if (tables.length > 0) {
                        const dt = tables.DataTable();
                        return {
                            source: 'datatables_api',
                            data: dt.rows().data().toArray(),
                            columns: dt.columns().header().toArray().map(h => h.textContent)
                        };
                    }
                }

                // Try getting all table rows
                const allTables = document.querySelectorAll('table');
                const results = [];
                allTables.forEach((table, idx) => {
                    const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim());
                    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
                        const cells = Array.from(tr.querySelectorAll('td'));
                        const rowData = {};
                        cells.forEach((cell, i) => {
                            rowData[headers[i] || 'col_' + i] = cell.textContent.trim();
                            // Get any links
                            const links = Array.from(cell.querySelectorAll('a')).map(a => a.href);
                            if (links.length > 0) {
                                rowData[(headers[i] || 'col_' + i) + '_links'] = links;
                            }
                        });
                        return rowData;
                    });
                    results.push({table_index: idx, headers: headers, rows: rows, row_count: rows.length});
                });
                return {source: 'dom_scrape', tables: results};
            }""")
            print(f"Table data extracted: {json.dumps(table_data)[:500]}", file=sys.stderr)
            with open("/tmp/war_ufo_table_data.json", "w") as f:
                json.dump(table_data, f, indent=2)
        except Exception as e:
            print(f"Table extraction error: {e}", file=sys.stderr)

        # Also try to find all links on the page
        try:
            links = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                    href: a.href,
                    text: a.textContent.trim().substring(0, 200)
                })).filter(l => l.href.includes('Portals') || l.href.includes('.pdf') || l.href.includes('.mp4') || l.href.includes('.jpg') || l.href.includes('.png') || l.href.includes('.mov') || l.href.includes('UFO'));
            }""")
            print(f"Found {len(links)} relevant links", file=sys.stderr)
            with open("/tmp/war_ufo_links.json", "w") as f:
                json.dump(links, f, indent=2)
        except Exception as e:
            print(f"Link extraction error: {e}", file=sys.stderr)

        # Log network requests
        print(f"\nInteresting network requests ({len(all_requests)}):", file=sys.stderr)
        for req in all_requests:
            print(f"  {req}", file=sys.stderr)

        # Get all script sources
        scripts = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        }""")
        with open("/tmp/war_ufo_scripts.json", "w") as f:
            json.dump(scripts, f, indent=2)
        print(f"\nAll script sources ({len(scripts)}):", file=sys.stderr)
        for s in scripts:
            print(f"  {s}", file=sys.stderr)

        browser.close()
        print("\nDone!", file=sys.stderr)

if __name__ == "__main__":
    main()
