"""Bluesky AT Protocol collector — free, needs account for search.

Requires environment variables:
  BLUESKY_HANDLE, BLUESKY_APP_PASSWORD
Create an app password at: Settings -> App Passwords on bsky.app
"""

import os
from pulse.db import get_or_create_source, insert_item, start_run, complete_run
from pulse.config import BLUESKY_CONFIG

try:
    from atproto import Client
    HAS_ATPROTO = True
except ImportError:
    HAS_ATPROTO = False


def get_bluesky_client():
    handle = os.environ.get("BLUESKY_HANDLE")
    password = os.environ.get("BLUESKY_APP_PASSWORD")
    if not handle or not password:
        return None
    client = Client()
    client.login(handle, password)
    return client


def collect_query(client, query: str, limit: int = 50) -> tuple[int, int]:
    """Search Bluesky for posts matching a query."""
    source_name = f"Bluesky: {query}"
    source_id = get_or_create_source(source_name, "bluesky", {"query": query})
    run_id = start_run(source_name, "bluesky")

    try:
        response = client.app.bsky.feed.search_posts(
            params={"q": query, "limit": min(limit, 100)}
        )

        posts = response.posts
        found = len(posts)
        new_count = 0

        for post in posts:
            uri = post.uri
            author_handle = post.author.handle
            text = post.record.text if hasattr(post.record, "text") else ""
            created = post.record.created_at if hasattr(post.record, "created_at") else ""

            item_id = insert_item(
                source_id=source_id,
                external_id=uri,
                platform="bluesky",
                title=text[:120] if text else None,
                author=author_handle,
                content=text,
                url=f"https://bsky.app/profile/{author_handle}/post/{uri.split('/')[-1]}",
                published_at=created,
                metadata={
                    "query": query,
                    "author_display_name": post.author.display_name,
                    "like_count": post.like_count,
                    "repost_count": post.repost_count,
                    "reply_count": post.reply_count,
                },
            )
            if item_id:
                new_count += 1

        complete_run(run_id, found, new_count)
        return found, new_count

    except Exception as e:
        complete_run(run_id, 0, 0, error=str(e))
        return 0, 0


def collect_all():
    """Collect from all configured Bluesky searches."""
    if not HAS_ATPROTO:
        print("[Bluesky] atproto not installed, skipping")
        return 0, 0

    client = get_bluesky_client()
    if not client:
        print("[Bluesky] No credentials (BLUESKY_HANDLE, BLUESKY_APP_PASSWORD), skipping")
        return 0, 0

    queries = BLUESKY_CONFIG["search_queries"]
    limit = BLUESKY_CONFIG["post_limit"]
    print(f"[Bluesky] Collecting {len(queries)} searches...")

    total_found, total_new = 0, 0
    for query in queries:
        found, new = collect_query(client, query, limit)
        print(f"  '{query}': {found} found, {new} new")
        total_found += found
        total_new += new

    print(f"[Bluesky] Total: {total_found} found, {total_new} new")
    return total_found, total_new
