"""Google Scholar collector via scholarly — free, aggressive rate limiting.

No auth required but will get IP-blocked after ~10-20 queries without proxies.
Run sparingly (weekly, not daily).
"""

import time
from pulse.db import get_or_create_source, insert_item, start_run, complete_run
from pulse.config import SCHOLAR_QUERIES

try:
    from scholarly import scholarly as scholar_client
    HAS_SCHOLARLY = True
except ImportError:
    HAS_SCHOLARLY = False

RESULTS_PER_QUERY = 10
DELAY_BETWEEN_QUERIES = 3


def collect_query(query: str) -> tuple[int, int]:
    """Search Google Scholar for papers matching a query."""
    source_name = f"Scholar: {query}"
    source_id = get_or_create_source(source_name, "scholar", {"query": query})
    run_id = start_run(source_name, "scholar")

    try:
        search = scholar_client.search_pubs(query)
        found = 0
        new_count = 0

        for _ in range(RESULTS_PER_QUERY):
            try:
                pub = next(search)
            except StopIteration:
                break

            found += 1
            bib = pub.get("bib", {})
            title = bib.get("title", "")
            url = pub.get("pub_url") or pub.get("eprint_url", "")
            external_id = url or title

            if not external_id:
                continue

            item_id = insert_item(
                source_id=source_id,
                external_id=external_id,
                platform="scholar",
                title=title,
                author=", ".join(bib.get("author", [])),
                content=bib.get("abstract", ""),
                url=url,
                published_at=bib.get("pub_year"),
                metadata={
                    "venue": bib.get("venue", ""),
                    "num_citations": pub.get("num_citations", 0),
                    "eprint_url": pub.get("eprint_url"),
                    "citedby_url": pub.get("citedby_url"),
                },
            )
            if item_id:
                new_count += 1

            time.sleep(2)

        complete_run(run_id, found, new_count)
        return found, new_count

    except Exception as e:
        complete_run(run_id, 0, 0, error=str(e))
        return 0, 0


def collect_all():
    """Collect from all configured Scholar queries."""
    if not HAS_SCHOLARLY:
        print("[Scholar] scholarly not installed, skipping")
        return 0, 0

    print(f"[Scholar] Collecting {len(SCHOLAR_QUERIES)} queries (slow — rate limited)...")
    total_found, total_new = 0, 0
    for i, query in enumerate(SCHOLAR_QUERIES):
        if i > 0:
            time.sleep(DELAY_BETWEEN_QUERIES)
        found, new = collect_query(query)
        print(f"  '{query}': {found} found, {new} new")
        total_found += found
        total_new += new

    print(f"[Scholar] Total: {total_found} found, {total_new} new")
    return total_found, total_new
