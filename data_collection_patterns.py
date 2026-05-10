"""
Free Data Collection Patterns for UAP/UFO News Monitoring
==========================================================
Tested and working as of May 2026.

pip install feedparser newspaper4k lxml_html_clean gdeltdoc praw atproto scholarly nltk

One-time NLTK setup:
    python -c "import nltk; nltk.download('punkt_tab')"
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)


# =============================================================================
# 1. FEEDPARSER + NEWSPAPER  —  RSS feeds → full article extraction
# =============================================================================
#
# pip install feedparser newspaper4k lxml_html_clean
#
# newspaper3k is UNMAINTAINED since 2020. Use newspaper4k (drop-in replacement,
# same API, actively maintained, better extraction accuracy).
#
# Auth: None required
# Rate limits: None (just HTTP requests, be polite — 1-2 req/sec)
# Cost: Free
#
# IMPORTANT: newspaper4k requires lxml_html_clean as a separate dependency.
#            Run: python -c "import nltk; nltk.download('punkt_tab')" once.

def collect_rss_articles(feed_url: str, max_articles: int = 10) -> list[dict]:
    """
    Parse an RSS feed and extract full article text via newspaper4k.

    Works with any RSS/Atom feed: Google News, The Guardian, BBC, etc.
    Google News RSS links redirect through Google — newspaper handles the
    redirect automatically for most sources.

    Returns list of dicts with: title, url, authors, date, text, keywords, summary
    """
    import feedparser
    from newspaper import Article

    feed = feedparser.parse(feed_url)

    # Check for feed-level errors
    if feed.bozo:
        log.warning(f"Feed parse warning: {feed.bozo_exception}")
    if not feed.entries:
        log.error(f"No entries in feed (status={feed.get('status', 'N/A')})")
        return []

    log.info(f"Feed '{feed.feed.get('title', 'unknown')}': {len(feed.entries)} entries")

    results = []
    for entry in feed.entries[:max_articles]:
        url = entry.get('link', '')
        record = {
            'title': entry.get('title', ''),
            'url': url,
            'rss_published': entry.get('published', ''),
            'rss_summary': entry.get('summary', ''),
            # feedparser exposes the <source> tag for Google News feeds
            'source': entry.get('source', {}).get('title', '') if isinstance(entry.get('source'), dict) else '',
        }

        # Attempt full article extraction
        try:
            article = Article(url)
            article.download()
            article.parse()
            article.nlp()

            record.update({
                'authors': article.authors,
                'publish_date': str(article.publish_date) if article.publish_date else None,
                'text': article.text,
                'text_length': len(article.text),
                'keywords': article.keywords,
                'summary': article.summary,
                'top_image': article.top_image,
            })
            log.info(f"  Extracted {len(article.text)} chars: {record['title'][:60]}")

        except Exception as e:
            # Common failures:
            # - 403: site blocks automated requests (NYT, WaPo with paywall)
            # - 404: dead link
            # - Timeout: slow server
            # - ParseError: non-HTML content
            record.update({
                'authors': [], 'text': '', 'text_length': 0,
                'keywords': [], 'summary': '',
                'extraction_error': f"{type(e).__name__}: {e}",
            })
            log.warning(f"  Extraction failed for {url[:60]}: {e}")

        results.append(record)
        time.sleep(1)  # polite crawling delay

    return results


# Useful RSS feeds for UAP monitoring:
UAP_RSS_FEEDS = {
    # Google News (custom search queries, up to 100 results)
    'google_uap': 'https://news.google.com/rss/search?q=UAP+OR+UFO+pentagon&hl=en-US&gl=US&ceid=US:en',
    'google_uap_exact': 'https://news.google.com/rss/search?q=%22unidentified+aerial+phenomena%22&hl=en-US&gl=US&ceid=US:en',

    # Direct source RSS feeds (more reliable extraction than Google News redirects)
    'guardian_world': 'https://www.theguardian.com/world/rss',
    'bbc_news': 'http://feeds.bbci.co.uk/news/rss.xml',
    'reuters_world': 'https://www.reutersagency.com/feed/',
    'thedebrief': 'https://thedebrief.org/feed/',  # dedicated UAP coverage
    'liberation_times': 'https://www.liberationtimes.com/feed/',  # UAP-focused
}


# =============================================================================
# 2. GDELT DOC 2.0 API  —  global news article search
# =============================================================================
#
# pip install gdeltdoc
#
# Auth: None required
# Rate limits: 1 request per 5 seconds (IP-based, aggressively enforced)
# Cost: Free
# Max results: 250 articles per query
#
# IMPORTANT: The gdeltdoc library sometimes fails because it doesn't set a
# User-Agent header. If you hit persistent 429s, use the direct API approach
# shown in collect_gdelt_direct().

def collect_gdelt_library(keyword: str, start_date: str, end_date: str,
                          max_records: int = 250) -> 'pd.DataFrame':
    """
    Search GDELT using the gdeltdoc library.

    Args:
        keyword: Search phrase (e.g., "UAP pentagon")
        start_date: "YYYY-MM-DD" format
        end_date: "YYYY-MM-DD" format
        max_records: Up to 250

    Returns DataFrame with columns:
        url, url_mobile, title, seendate, socialimage, domain, language, sourcecountry
    """
    from gdeltdoc import GdeltDoc, Filters

    f = Filters(
        keyword=keyword,
        start_date=start_date,
        end_date=end_date,
        num_records=max_records,
    )

    gd = GdeltDoc()
    articles = gd.article_search(f)
    log.info(f"GDELT returned {len(articles)} articles for '{keyword}'")
    return articles


def collect_gdelt_direct(keyword: str, start_date: str, end_date: str,
                         max_records: int = 250) -> list[dict]:
    """
    Search GDELT via direct HTTP (more reliable than gdeltdoc library).
    Handles rate limiting with retry logic.

    The library sometimes fails with 429 because it doesn't send User-Agent.
    This function works around that.

    Returns list of article dicts with:
        url, url_mobile, title, seendate, socialimage, domain, language, sourcecountry
    """
    import requests

    # Convert dates from YYYY-MM-DD to YYYYMMDDHHMMSS
    start_dt = start_date.replace('-', '') + '000000'
    end_dt = end_date.replace('-', '') + '235959'

    url = 'https://api.gdeltproject.org/api/v2/doc/doc'
    params = {
        'query': keyword,
        'mode': 'artlist',
        'maxrecords': str(max_records),
        'startdatetime': start_dt,
        'enddatetime': end_dt,
        'format': 'json',
    }
    headers = {'User-Agent': 'UAP-Research/1.0 (academic research)'}

    for attempt in range(3):
        resp = requests.get(url, params=params, headers=headers, timeout=30)
        if resp.status_code == 200:
            try:
                data = resp.json()
                articles = data.get('articles', [])
                log.info(f"GDELT returned {len(articles)} articles")
                return articles
            except ValueError:
                log.error(f"GDELT returned non-JSON: {resp.text[:200]}")
                return []
        elif resp.status_code == 429:
            wait = 6 * (attempt + 1)
            log.warning(f"GDELT rate limited, waiting {wait}s (attempt {attempt+1}/3)")
            time.sleep(wait)
        else:
            log.error(f"GDELT HTTP {resp.status_code}: {resp.text[:200]}")
            return []

    log.error("GDELT: exhausted retries")
    return []


def collect_gdelt_timeline(keyword: str, start_date: str, end_date: str,
                           mode: str = 'timelinevol') -> 'pd.DataFrame':
    """
    Get GDELT timeline data (coverage volume over time).

    Modes:
        timelinevol      - Coverage volume as percentage of all monitored coverage
        timelinevolraw   - Raw article counts per time period
        timelinelang     - Volume broken down by language
        timelinesourcecountry - Volume broken down by source country
        timelinetone     - Average tone of coverage over time
    """
    from gdeltdoc import GdeltDoc, Filters

    f = Filters(keyword=keyword, start_date=start_date, end_date=end_date)
    gd = GdeltDoc()
    return gd.timeline_search(mode, f)


# GDELT advanced filters (use with gdeltdoc.Filters):
#   domain=["bbc.co.uk", "nytimes.com"]  -- filter by source domain (partial match)
#   domain_exact="bbc.co.uk"             -- exact domain match
#   country=["US", "UK"]                 -- FIPS 2-letter country codes
#   language="en"                        -- ISO 639 language code
#   theme="GENERAL_HEALTH"               -- GDELT GKG theme
#   near(10, "airline", "carbon")        -- words within N words of each other
#   repeat(5, "planet")                  -- word appears N+ times in article
#   tone=">5"                            -- positive tone threshold
#   tone="<-5"                           -- negative tone threshold


# =============================================================================
# 3. REDDIT API (PRAW)  —  subreddit monitoring
# =============================================================================
#
# pip install praw
#
# Auth: REQUIRED (free). You must register an app at reddit.com/prefs/apps
# Rate limits: 100 requests/minute (authenticated), 10/min (unauthenticated)
# Cost: Free for non-commercial use
#
# PRAW IS STILL FREE in 2026 for personal/research/non-commercial projects.
# Commercial use requires a paid API agreement (~$12k/year).
#
# === SETUP (one-time) ===
# 1. Go to https://www.reddit.com/prefs/apps
# 2. Click "create another app..."
# 3. Choose "script" type (for personal bots/scripts)
# 4. Set redirect URI to http://localhost:8080
# 5. Save the client_id (under app name) and client_secret
# 6. Store in environment variables (NEVER hardcode):
#
#    export REDDIT_CLIENT_ID="your_client_id"
#    export REDDIT_CLIENT_SECRET="your_client_secret"
#    export REDDIT_USERNAME="your_username"
#    export REDDIT_PASSWORD="your_password"

def create_reddit_client() -> 'praw.Reddit':
    """Create authenticated Reddit client from environment variables."""
    import os
    import praw

    reddit = praw.Reddit(
        client_id=os.environ['REDDIT_CLIENT_ID'],
        client_secret=os.environ['REDDIT_CLIENT_SECRET'],
        user_agent='UAP-Research/1.0 (by u/YOUR_USERNAME)',
        username=os.environ.get('REDDIT_USERNAME'),      # optional for read-only
        password=os.environ.get('REDDIT_PASSWORD'),       # optional for read-only
    )
    # Verify authentication
    log.info(f"Reddit authenticated as: {reddit.user.me()}")
    return reddit


def collect_reddit_posts(reddit: 'praw.Reddit', subreddit_names: str = 'UFOs+UAP',
                         sort: str = 'new', limit: int = 50) -> list[dict]:
    """
    Fetch posts from subreddit(s).

    Args:
        subreddit_names: "UFOs" or "UFOs+UAP" for multiple subs
        sort: 'new', 'hot', 'top', 'rising'
        limit: max posts (up to ~1000 per listing)
    """
    subreddit = reddit.subreddit(subreddit_names)

    getter = {
        'new': subreddit.new,
        'hot': subreddit.hot,
        'top': subreddit.top,
        'rising': subreddit.rising,
    }[sort]

    posts = []
    for submission in getter(limit=limit):
        posts.append({
            'id': submission.id,
            'title': submission.title,
            'selftext': submission.selftext,
            'url': submission.url,
            'permalink': f"https://reddit.com{submission.permalink}",
            'author': str(submission.author),
            'created_utc': datetime.utcfromtimestamp(submission.created_utc).isoformat(),
            'score': submission.score,
            'upvote_ratio': submission.upvote_ratio,
            'num_comments': submission.num_comments,
            'subreddit': str(submission.subreddit),
            'link_flair_text': submission.link_flair_text,
            'is_self': submission.is_self,
        })
    log.info(f"Collected {len(posts)} posts from r/{subreddit_names}")
    return posts


def search_reddit(reddit: 'praw.Reddit', query: str,
                  subreddit: str = 'all', limit: int = 50) -> list[dict]:
    """Search Reddit posts across subreddits."""
    results = []
    for submission in reddit.subreddit(subreddit).search(query, limit=limit, sort='new'):
        results.append({
            'id': submission.id,
            'title': submission.title,
            'selftext': submission.selftext[:500],
            'url': submission.url,
            'author': str(submission.author),
            'created_utc': datetime.utcfromtimestamp(submission.created_utc).isoformat(),
            'score': submission.score,
            'num_comments': submission.num_comments,
            'subreddit': str(submission.subreddit),
        })
    return results


def stream_reddit_posts(reddit: 'praw.Reddit', subreddit_names: str = 'UFOs+UAP',
                        callback=None):
    """
    Real-time stream of new posts. Runs indefinitely.
    PRAW handles rate limiting automatically (sleeps when needed).

    Usage:
        def on_post(post):
            print(f"New: {post['title']}")
        stream_reddit_posts(reddit, callback=on_post)
    """
    subreddit = reddit.subreddit(subreddit_names)
    log.info(f"Streaming new posts from r/{subreddit_names}...")

    for submission in subreddit.stream.submissions(skip_existing=True):
        post = {
            'id': submission.id,
            'title': submission.title,
            'selftext': submission.selftext,
            'url': submission.url,
            'author': str(submission.author),
            'created_utc': datetime.utcfromtimestamp(submission.created_utc).isoformat(),
            'score': submission.score,
            'subreddit': str(submission.subreddit),
        }
        if callback:
            callback(post)
        else:
            log.info(f"New post: [{post['subreddit']}] {post['title'][:80]}")


def stream_reddit_comments(reddit: 'praw.Reddit', subreddit_names: str = 'UFOs+UAP',
                           keywords: list[str] = None, callback=None):
    """
    Real-time stream of new comments, optionally filtered by keywords.

    Usage:
        stream_reddit_comments(reddit, keywords=['pentagon', 'AARO', 'disclosure'])
    """
    subreddit = reddit.subreddit(subreddit_names)
    log.info(f"Streaming comments from r/{subreddit_names}...")

    for comment in subreddit.stream.comments(skip_existing=True):
        if keywords:
            body_lower = comment.body.lower()
            if not any(kw.lower() in body_lower for kw in keywords):
                continue

        record = {
            'id': comment.id,
            'body': comment.body,
            'author': str(comment.author),
            'created_utc': datetime.utcfromtimestamp(comment.created_utc).isoformat(),
            'score': comment.score,
            'permalink': f"https://reddit.com{comment.permalink}",
            'subreddit': str(comment.subreddit),
            'submission_id': comment.submission.id,
        }
        if callback:
            callback(record)
        else:
            log.info(f"Comment by u/{record['author']}: {record['body'][:100]}")


# =============================================================================
# 4. BLUESKY AT PROTOCOL  —  social monitoring
# =============================================================================
#
# pip install atproto
#
# Auth: REQUIRED for post search. Free Bluesky account works.
#       Create an App Password at Settings → App Passwords (do NOT use your main password).
# Rate limits: 3000 requests per 5 minutes (300 seconds), per IP
# Cost: Free
#
# The public API (public.api.bsky.app) supports some endpoints without auth:
#   - Actor search (find users)
#   - Profile lookup
# But post search REQUIRES authentication.
#
# === SETUP ===
# 1. Create a Bluesky account at bsky.app (free)
# 2. Go to Settings → App Passwords → Add App Password
# 3. Store credentials:
#    export BSKY_HANDLE="yourname.bsky.social"
#    export BSKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"

def create_bluesky_client() -> 'Client':
    """Create authenticated Bluesky client."""
    import os
    from atproto import Client

    client = Client()
    client.login(
        os.environ['BSKY_HANDLE'],
        os.environ['BSKY_APP_PASSWORD'],
    )
    log.info(f"Bluesky authenticated as: {client.me.handle}")
    return client


def search_bluesky_posts(client: 'Client', query: str,
                         limit: int = 25) -> list[dict]:
    """
    Search Bluesky posts by keyword.
    Requires authentication.

    Returns list of dicts with: author, text, created_at, likes, reposts, uri
    """
    response = client.app.bsky.feed.search_posts(
        params={'q': query, 'limit': min(limit, 100)}
    )

    posts = []
    for post in response.posts:
        posts.append({
            'author_handle': post.author.handle,
            'author_display': post.author.display_name,
            'text': post.record.text,
            'created_at': post.record.created_at,
            'likes': post.like_count,
            'reposts': post.repost_count,
            'replies': post.reply_count,
            'uri': post.uri,
            'cid': post.cid,
        })

    log.info(f"Bluesky search '{query}': {len(posts)} posts")
    return posts


def get_bluesky_user_posts(client: 'Client', handle: str,
                           limit: int = 50) -> list[dict]:
    """Get recent posts from a specific Bluesky user."""
    response = client.app.bsky.feed.get_author_feed(
        params={'actor': handle, 'limit': min(limit, 100)}
    )

    posts = []
    for feed_item in response.feed:
        post = feed_item.post
        posts.append({
            'author_handle': post.author.handle,
            'text': post.record.text,
            'created_at': post.record.created_at,
            'likes': post.like_count,
            'reposts': post.repost_count,
            'uri': post.uri,
        })

    return posts


def search_bluesky_users(query: str, limit: int = 10) -> list[dict]:
    """
    Search Bluesky users/actors. Works WITHOUT authentication
    via the public API.
    """
    import requests

    resp = requests.get(
        'https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors',
        params={'q': query, 'limit': min(limit, 100)},
    )
    resp.raise_for_status()
    data = resp.json()

    users = []
    for actor in data.get('actors', []):
        users.append({
            'handle': actor['handle'],
            'display_name': actor.get('displayName', ''),
            'description': actor.get('description', ''),
            'followers': actor.get('followersCount', 0),
            'following': actor.get('followsCount', 0),
            'posts': actor.get('postsCount', 0),
        })
    return users


# Notable UAP-related Bluesky accounts to monitor:
BLUESKY_UAP_ACCOUNTS = [
    'ufo-uap-news.bsky.social',
    'declassifyuap.bsky.social',
    # Add more as you discover them via search_bluesky_users('uap')
]


# =============================================================================
# 5. GOOGLE ALERTS RSS  —  automated news monitoring
# =============================================================================
#
# No pip install needed (uses feedparser from section 1)
#
# Auth: Google account required to CREATE alerts (web UI only)
# Rate limits: None (standard RSS polling)
# Cost: Free
#
# === SETUP ===
# 1. Go to https://www.google.com/alerts
# 2. Enter your search query (e.g., "unidentified aerial phenomena")
# 3. Click "Show options"
# 4. Set "Deliver to" → "RSS feed" (instead of email)
# 5. Click "Create Alert"
# 6. An RSS icon appears next to the alert — right-click → Copy Link Address
#
# The feed URL format is:
#   https://www.google.com/alerts/feeds/<user_id>/<alert_id>
#
# These are PRIVATE URLs tied to your Google account. You can't construct them
# programmatically — you must create alerts through the web UI.
#
# ALTERNATIVE: Google News RSS (public, no account needed):
#   https://news.google.com/rss/search?q=YOUR+QUERY&hl=en-US&gl=US&ceid=US:en
#
# Google News RSS covers the same sources as Google Alerts but:
#   - No account required
#   - Up to 100 entries per feed
#   - Can use any Google search operators (quotes, OR, site:, etc.)
#   - Updates in near-real-time
#
# Google Alerts RSS adds:
#   - Blog posts, forums, web pages (not just news)
#   - "Best results" vs "All results" filtering
#   - Region/language targeting

def collect_google_alerts(feed_url: str) -> list[dict]:
    """
    Parse a Google Alerts RSS feed.

    Works identically to any RSS feed via feedparser.
    The entry fields are: title, link, published, summary, source.
    """
    import feedparser

    feed = feedparser.parse(feed_url)
    if feed.bozo:
        log.warning(f"Feed parse issue: {feed.bozo_exception}")

    entries = []
    for e in feed.entries:
        entries.append({
            'title': e.get('title', ''),
            'url': e.get('link', ''),
            'published': e.get('published', ''),
            'summary': e.get('summary', ''),  # HTML snippet with highlight
            'source': (e.get('source', {}).get('title', '')
                       if isinstance(e.get('source'), dict) else ''),
        })

    log.info(f"Google Alerts: {len(entries)} entries")
    return entries


# Pre-built Google News RSS queries for UAP monitoring (no account needed):
GOOGLE_NEWS_RSS = {
    'uap_ufo': 'https://news.google.com/rss/search?q=UAP+OR+UFO+pentagon&hl=en-US&gl=US&ceid=US:en',
    'uap_exact': 'https://news.google.com/rss/search?q=%22unidentified+aerial+phenomena%22&hl=en-US&gl=US&ceid=US:en',
    'aaro': 'https://news.google.com/rss/search?q=AARO+%22anomaly+resolution%22&hl=en-US&gl=US&ceid=US:en',
    'uap_congress': 'https://news.google.com/rss/search?q=UAP+congress+hearing&hl=en-US&gl=US&ceid=US:en',
    'uap_disclosure': 'https://news.google.com/rss/search?q=UAP+disclosure+legislation&hl=en-US&gl=US&ceid=US:en',
}


# =============================================================================
# 6. SCHOLARLY  —  Google Scholar search
# =============================================================================
#
# pip install scholarly
#
# Auth: None required
# Rate limits: Google Scholar AGGRESSIVELY blocks automated access.
#              Without proxies: ~10-20 queries before CAPTCHA/IP ban.
#              With free proxies: unreliable, slow.
#              With ScraperAPI: works but costs money.
# Cost: Free (library), but practical use requires proxy strategy
#
# IMPORTANT: scholarly scrapes Google Scholar's HTML. Google does NOT provide
# a public API for Scholar. This means:
#   - It can break when Google changes their HTML
#   - Your IP will get blocked if you query too fast
#   - ALWAYS use a proxy for any sustained collection

def setup_scholarly_proxy():
    """
    Set up free proxy rotation for scholarly.
    Call this ONCE before any searches.

    Free proxies are unreliable — expect failures and retries.
    For production use, consider ScraperAPI ($49/mo for 100k calls).
    """
    from scholarly import scholarly, ProxyGenerator

    pg = ProxyGenerator()
    # Option 1: Free proxies (unreliable but zero cost)
    pg.FreeProxies()
    scholarly.use_proxy(pg)
    log.info("Scholarly: free proxy configured")

    # Option 2: ScraperAPI (reliable, paid)
    # pg.ScraperAPI('YOUR_API_KEY')
    # scholarly.use_proxy(pg)

    return scholarly


def search_scholar(query: str, max_results: int = 10,
                   use_proxy: bool = False) -> list[dict]:
    """
    Search Google Scholar for academic papers.

    Returns list of dicts with:
        title, authors, year, venue, abstract, num_citations,
        pub_url, eprint_url, citedby_url

    Fields returned by scholarly:
        container_type, source, bib (dict with title/author/year/venue/abstract),
        filled (bool), gsrank, pub_url, author_id, url_scholarbib,
        url_add_sclib, num_citations, citedby_url, url_related_articles,
        eprint_url (free PDF link when available)
    """
    from scholarly import scholarly

    if use_proxy:
        setup_scholarly_proxy()

    results = []
    search_gen = scholarly.search_pubs(query)

    for i in range(max_results):
        try:
            result = next(search_gen)
            bib = result.get('bib', {})
            results.append({
                'title': bib.get('title', ''),
                'authors': bib.get('author', []),
                'year': bib.get('pub_year', ''),
                'venue': bib.get('venue', ''),
                'abstract': bib.get('abstract', ''),
                'num_citations': result.get('num_citations', 0),
                'pub_url': result.get('pub_url', ''),
                'eprint_url': result.get('eprint_url', ''),  # free PDF
                'citedby_url': result.get('citedby_url', ''),
                'gsrank': result.get('gsrank', 0),
            })
            log.info(f"  [{i+1}] {bib.get('title', '')[:60]} ({bib.get('pub_year', '?')})")
            time.sleep(2)  # be gentle with Google Scholar
        except StopIteration:
            break
        except Exception as e:
            log.warning(f"  Scholar error on result {i+1}: {e}")
            break

    log.info(f"Scholar: {len(results)} papers for '{query}'")
    return results


def get_scholar_author(name: str) -> dict:
    """Look up an author on Google Scholar and get their profile."""
    from scholarly import scholarly

    search = scholarly.search_author(name)
    try:
        author = next(search)
        # Fill in full details (makes additional request)
        author = scholarly.fill(author)
        return {
            'name': author.get('name', ''),
            'affiliation': author.get('affiliation', ''),
            'interests': author.get('interests', []),
            'citedby': author.get('citedby', 0),
            'h_index': author.get('hindex', 0),
            'i10_index': author.get('i10index', 0),
            'publications': len(author.get('publications', [])),
        }
    except StopIteration:
        return {}


# =============================================================================
# COMBINED PIPELINE  —  run all free sources
# =============================================================================

def collect_all_sources(keyword: str = 'UAP', days_back: int = 7) -> dict:
    """
    Collect from all free sources that don't require auth.
    Returns dict keyed by source name.

    For Reddit and Bluesky, set up auth and call those functions separately.
    """
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')

    results = {}

    # 1. Google News RSS (always works, no auth)
    log.info("=== Google News RSS ===")
    feed_url = f'https://news.google.com/rss/search?q={keyword}&hl=en-US&gl=US&ceid=US:en'
    results['google_news'] = collect_rss_articles(feed_url, max_articles=20)

    # 2. GDELT (no auth, rate limited to 1 req / 5 sec)
    log.info("=== GDELT ===")
    time.sleep(6)  # pre-wait for rate limit
    results['gdelt'] = collect_gdelt_direct(keyword, start_date, end_date, max_records=50)

    # 3. Google Scholar (no auth, may get blocked without proxy)
    log.info("=== Google Scholar ===")
    results['scholar'] = search_scholar(f'{keyword} unidentified aerial', max_results=5)

    # Summary
    for source, data in results.items():
        log.info(f"  {source}: {len(data)} items")

    return results


# =============================================================================
# USAGE EXAMPLES
# =============================================================================

if __name__ == '__main__':
    # --- Example 1: RSS + article extraction ---
    print("\n" + "="*60)
    print("Example 1: RSS Feed → Full Article Extraction")
    print("="*60)
    articles = collect_rss_articles(
        'https://news.google.com/rss/search?q=%22unidentified+aerial+phenomena%22&hl=en-US&gl=US&ceid=US:en',
        max_articles=3
    )
    for a in articles:
        print(f"\n  Title: {a['title']}")
        print(f"  Source: {a.get('source', 'N/A')}")
        print(f"  Text: {a.get('text_length', 0)} chars")
        if a.get('extraction_error'):
            print(f"  Error: {a['extraction_error']}")

    # --- Example 2: GDELT ---
    print("\n" + "="*60)
    print("Example 2: GDELT Article Search")
    print("="*60)
    time.sleep(6)
    gdelt_articles = collect_gdelt_direct('UAP', '2026-05-01', '2026-05-10', max_records=5)
    for a in gdelt_articles:
        print(f"  {a.get('seendate', '')} | {a.get('domain', '')} | {a.get('title', '')[:60]}")

    # --- Example 3: Google Scholar ---
    print("\n" + "="*60)
    print("Example 3: Google Scholar Search")
    print("="*60)
    papers = search_scholar('UAP unidentified aerial phenomena', max_results=3)
    for p in papers:
        print(f"  [{p['year']}] {p['title'][:60]} (cited: {p['num_citations']})")

    # --- Example 4: Bluesky user search (no auth needed) ---
    print("\n" + "="*60)
    print("Example 4: Bluesky User Search (public, no auth)")
    print("="*60)
    users = search_bluesky_users('UAP', limit=5)
    for u in users:
        print(f"  @{u['handle']} — {u['display_name']} ({u['followers']} followers)")

    print("\n" + "="*60)
    print("Done. Reddit and Bluesky post search require auth (see setup instructions above).")
    print("="*60)
