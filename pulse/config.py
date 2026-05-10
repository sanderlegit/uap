"""Pulse source configuration — feeds, queries, subreddits to monitor."""

UAP_SEARCH_TERMS = [
    "UAP", "UFO", "unidentified aerial phenomena",
    "unidentified anomalous phenomena", "AARO",
    "UFO disclosure", "UAP hearing", "non-human intelligence",
]

RSS_FEEDS = [
    {
        "name": "The Debrief — UAP",
        "url": "https://thedebrief.org/category/uap/feed/",
        "credibility": "high",
    },
    {
        "name": "Liberation Times",
        "url": "https://www.liberationtimes.com/home?format=rss",
        "credibility": "high",
    },
    {
        "name": "The Guardian — UFO",
        "url": "https://www.theguardian.com/world/ufos/rss",
        "credibility": "high",
    },
    {
        "name": "The Black Vault",
        "url": "https://www.theblackvault.com/documentarchive/feed/",
        "credibility": "high",
    },
    {
        "name": "Ask a Pol — UAP",
        "url": "https://www.askapol.com/feed",
        "credibility": "medium",
    },
]

GOOGLE_NEWS_QUERIES = [
    "UAP unidentified anomalous phenomena",
    "UFO disclosure Congress hearing",
    "AARO Pentagon UFO",
]

REDDIT_CONFIG = {
    "subreddits": ["UFOs", "UAP", "aliens", "HighStrangeness"],
    "search_queries": UAP_SEARCH_TERMS[:4],
    "post_limit": 50,
}

BLUESKY_CONFIG = {
    "search_queries": ["UAP", "UFO disclosure", "#ufotwitter", "AARO"],
    "post_limit": 50,
}

SCHOLAR_QUERIES = [
    "unidentified aerial phenomena",
    "UAP defense",
    "anomalous aerospace threats",
    "trans-medium vehicles",
]

GDELT_QUERIES = [
    "UAP unidentified aerial",
    "UFO Pentagon disclosure",
    "AARO anomalous",
]

COLLECTION_INTERVAL_HOURS = 6
ANALYSIS_INTERVAL_HOURS = 1
