"""Reddit collector via PRAW — free for non-commercial research use.

Requires Reddit app credentials in environment:
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
Register a "script" app at https://www.reddit.com/prefs/apps
"""

import os
from pulse.db import get_or_create_source, insert_item, start_run, complete_run
from pulse.config import REDDIT_CONFIG

try:
    import praw
    HAS_PRAW = True
except ImportError:
    HAS_PRAW = False


def get_reddit_client():
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None
    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent="UAP-Pulse-Research/1.0",
    )


def collect_subreddit(reddit, subreddit_name: str, limit: int = 50) -> tuple[int, int]:
    """Collect recent hot posts from a subreddit."""
    source_name = f"r/{subreddit_name}"
    source_id = get_or_create_source(source_name, "reddit", {"subreddit": subreddit_name})
    run_id = start_run(source_name, "reddit")

    try:
        subreddit = reddit.subreddit(subreddit_name)
        posts = list(subreddit.hot(limit=limit))

        found = len(posts)
        new_count = 0

        for post in posts:
            if post.stickied:
                continue

            from datetime import datetime, timezone
            published = datetime.fromtimestamp(post.created_utc, tz=timezone.utc).isoformat()
            content = post.selftext or post.title

            item_id = insert_item(
                source_id=source_id,
                external_id=post.id,
                platform="reddit",
                title=post.title,
                author=str(post.author) if post.author else None,
                content=content,
                url=f"https://reddit.com{post.permalink}",
                published_at=published,
                metadata={
                    "score": post.score,
                    "num_comments": post.num_comments,
                    "upvote_ratio": post.upvote_ratio,
                    "link_flair": post.link_flair_text,
                    "is_self": post.is_self,
                    "external_url": None if post.is_self else post.url,
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
    """Collect from all configured subreddits."""
    if not HAS_PRAW:
        print("[Reddit] praw not installed, skipping")
        return 0, 0

    reddit = get_reddit_client()
    if not reddit:
        print("[Reddit] No credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET), skipping")
        return 0, 0

    subreddits = REDDIT_CONFIG["subreddits"]
    limit = REDDIT_CONFIG["post_limit"]
    print(f"[Reddit] Collecting from {len(subreddits)} subreddits...")

    total_found, total_new = 0, 0
    for sub in subreddits:
        found, new = collect_subreddit(reddit, sub, limit)
        print(f"  r/{sub}: {found} found, {new} new")
        total_found += found
        total_new += new

    print(f"[Reddit] Total: {total_found} found, {total_new} new")
    return total_found, total_new
