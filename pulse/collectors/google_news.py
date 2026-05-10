"""Google News RSS collector — free, no auth needed."""

import urllib.parse
import feedparser
from pulse.db import get_or_create_source, insert_item, start_run, complete_run
from pulse.config import GOOGLE_NEWS_QUERIES


def build_google_news_url(query: str) -> str:
    encoded = urllib.parse.quote(query)
    return f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"


def collect_query(query: str) -> tuple[int, int]:
    """Collect Google News results for a single query."""
    url = build_google_news_url(query)
    source_name = f"Google News: {query}"
    source_id = get_or_create_source(source_name, "google_news", {"query": query})
    run_id = start_run(source_name, "google_news")

    try:
        feed = feedparser.parse(url)
        found = len(feed.entries)
        new_count = 0

        for entry in feed.entries:
            link = entry.get("link", "")
            if not link:
                continue

            published = entry.get("published", "")
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            source_outlet = entry.get("source", {}).get("title", "")

            item_id = insert_item(
                source_id=source_id,
                external_id=link,
                platform="google_news",
                title=title,
                author=source_outlet,
                content=summary,
                url=link,
                published_at=published,
                metadata={"query": query, "source_outlet": source_outlet},
            )
            if item_id:
                new_count += 1

        complete_run(run_id, found, new_count)
        return found, new_count

    except Exception as e:
        complete_run(run_id, 0, 0, error=str(e))
        return 0, 0


def collect_all():
    """Collect from all configured Google News queries."""
    print(f"[Google News] Collecting {len(GOOGLE_NEWS_QUERIES)} queries...")
    total_found, total_new = 0, 0
    for query in GOOGLE_NEWS_QUERIES:
        found, new = collect_query(query)
        print(f"  '{query}': {found} found, {new} new")
        total_found += found
        total_new += new
    print(f"[Google News] Total: {total_found} found, {total_new} new")
    return total_found, total_new
