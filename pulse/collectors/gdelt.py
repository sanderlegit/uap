"""GDELT DOC 2.0 API collector — free, no auth, 1 req per 5 seconds."""

from __future__ import annotations

import time
import urllib.parse
import requests
from pulse.db import get_or_create_source, insert_item, start_run, complete_run
from pulse.config import GDELT_QUERIES

try:
    from newspaper import Article
    HAS_NEWSPAPER = True
except ImportError:
    HAS_NEWSPAPER = False

GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc"
HEADERS = {"User-Agent": "UAP-Pulse-Research/1.0"}
REQUEST_DELAY = 8


def extract_article_text(url: str) -> tuple[str | None, str | None]:
    """Extract full text and author from article URL via newspaper4k."""
    if not HAS_NEWSPAPER:
        return None, None
    try:
        article = Article(url)
        article.download()
        article.parse()
        authors = ", ".join(article.authors) if article.authors else None
        return article.text, authors
    except Exception:
        return None, None


def collect_query(query: str, max_records: int = 75) -> tuple[int, int]:
    """Collect GDELT results for a single query."""
    source_name = f"GDELT: {query}"
    source_id = get_or_create_source(source_name, "gdelt", {"query": query})
    run_id = start_run(source_name, "gdelt")

    try:
        params = {
            "query": query,
            "mode": "ArtList",
            "maxrecords": str(max_records),
            "format": "json",
            "sort": "DateDesc",
        }
        url = f"{GDELT_API}?{urllib.parse.urlencode(params)}"

        for attempt in range(3):
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 429:
                time.sleep(REQUEST_DELAY * (attempt + 1))
                continue
            break

        if resp.status_code == 429:
            complete_run(run_id, 0, 0, error="Rate limited (429) after retries")
            return 0, 0

        resp.raise_for_status()
        data = resp.json()
        articles = data.get("articles", [])

        found = len(articles)
        new_count = 0

        for art in articles:
            article_url = art.get("url", "")
            if not article_url:
                continue

            # Try to extract full article text from the news site
            full_text, author = extract_article_text(article_url)

            if full_text:
                content = full_text
                content_quality = "full_text"
            else:
                content = art.get("title", "")
                content_quality = "extraction_failed" if HAS_NEWSPAPER else "title_only"

            item_id = insert_item(
                source_id=source_id,
                external_id=article_url,
                platform="gdelt",
                title=art.get("title"),
                author=author or art.get("domain"),
                content=content,
                url=article_url,
                published_at=art.get("seendate"),
                metadata={
                    "domain": art.get("domain"),
                    "language": art.get("language"),
                    "source_country": art.get("sourcecountry"),
                    "social_image": art.get("socialimage"),
                },
                content_quality=content_quality,
            )
            if item_id:
                new_count += 1

            time.sleep(1)

        complete_run(run_id, found, new_count)
        return found, new_count

    except Exception as e:
        complete_run(run_id, 0, 0, error=str(e))
        return 0, 0


def collect_all():
    """Collect from all configured GDELT queries."""
    print(f"[GDELT] Collecting {len(GDELT_QUERIES)} queries...")
    total_found, total_new = 0, 0
    for i, query in enumerate(GDELT_QUERIES):
        if i > 0:
            time.sleep(REQUEST_DELAY)
        found, new = collect_query(query)
        print(f"  '{query}': {found} found, {new} new")
        total_found += found
        total_new += new
    print(f"[GDELT] Total: {total_found} found, {total_new} new")
    return total_found, total_new
