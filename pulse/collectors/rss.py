"""RSS feed collector — feedparser + newspaper4k for full article extraction."""

from __future__ import annotations

import time
import feedparser
from pulse.db import get_or_create_source, insert_item, start_run, complete_run
from pulse.config import RSS_FEEDS

try:
    from newspaper import Article
    HAS_NEWSPAPER = True
except ImportError:
    HAS_NEWSPAPER = False


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


def collect_feed(feed_config: dict) -> tuple[int, int]:
    """Collect items from a single RSS feed. Returns (found, new)."""
    name = feed_config["name"]
    url = feed_config["url"]
    credibility = feed_config.get("credibility", "unknown")

    source_id = get_or_create_source(name, "rss", feed_config)
    run_id = start_run(name, "rss")

    try:
        feed = feedparser.parse(url)
        if feed.bozo and not feed.entries:
            complete_run(run_id, 0, 0, error=f"Feed parse error: {feed.bozo_exception}")
            return 0, 0

        found = len(feed.entries)
        new_count = 0

        for entry in feed.entries:
            link = entry.get("link", "")
            if not link:
                continue

            published = entry.get("published", entry.get("updated", ""))
            title = entry.get("title", "")
            summary = entry.get("summary", "")

            full_text, author = extract_article_text(link)
            content = full_text or summary

            item_id = insert_item(
                source_id=source_id,
                external_id=link,
                platform="rss",
                title=title,
                author=author or entry.get("author"),
                content=content,
                url=link,
                published_at=published,
                metadata={"source_credibility": credibility, "feed": name},
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
    """Collect from all configured RSS feeds."""
    print(f"[RSS] Collecting from {len(RSS_FEEDS)} feeds...")
    total_found, total_new = 0, 0
    for feed in RSS_FEEDS:
        found, new = collect_feed(feed)
        print(f"  {feed['name']}: {found} found, {new} new")
        total_found += found
        total_new += new
    print(f"[RSS] Total: {total_found} found, {total_new} new")
    return total_found, total_new
