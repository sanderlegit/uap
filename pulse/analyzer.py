"""Pulse analyzer — structured extraction via claude -p, consistent with existing pipeline."""

from __future__ import annotations

import json
import subprocess
from pulse.db import get_unanalyzed_items, insert_analysis

SYSTEM_PROMPT = """You analyze UAP/UFO-related content from news, social media, and academic sources.
You MUST respond with a single JSON object and nothing else — no markdown, no explanation.

The JSON object must have these fields:
{
  "summary": "2-3 sentence summary",
  "entities": [{"name": "...", "type": "person|organization|location|program|technology|phenomenon|legislation|event", "context": "..."}],
  "theories": [{"theory": "...", "evidence_strength": "strong|moderate|weak|speculative", "supporting_text": "..."}],
  "topics": ["topic1", "topic2"],
  "credibility_score": 0.0-1.0,
  "novelty_score": 0.0-1.0,
  "relevance_score": 0.0-1.0,
  "corpus_connections": ["keyword1", "keyword2"]
}

Scoring guidelines:
- credibility_score: 1.0 = peer-reviewed/official, 0.7 = established journalism,
  0.4 = community with evidence, 0.1 = unsubstantiated
- novelty_score: 1.0 = new revelation, 0.5 = new angle, 0.1 = rehash
- relevance_score: 1.0 = directly UAP/disclosure, 0.5 = tangential, 0.1 = barely related

corpus_connections: keywords linking to declassified docs (programs, agencies, locations, incidents).
Filter out conspiracy framing. Focus on verifiable claims and evidence."""


def analyze_item(item: dict) -> dict | None:
    """Analyze a single pulse item via claude -p with structured output."""
    content = item.get("content", "")
    title = item.get("title", "")
    platform = item.get("platform", "")
    url = item.get("url", "")

    user_prompt = f"""Analyze this {platform} content about UAP/UFO topics and respond with JSON only:

Title: {title}
Source: {url}
Platform: {platform}

Content:
{content[:8000]}"""

    try:
        result = subprocess.run(
            [
                "claude", "-p", user_prompt,
                "--output-format", "json",
                "--model", "haiku",
                "--system-prompt", SYSTEM_PROMPT,
                "--max-budget-usd", "0.05",
            ],
            capture_output=True,
            text=True,
            timeout=90,
        )

        if result.returncode != 0:
            print(f"  claude error: {result.stderr[:200]}")
            return None

        raw = result.stdout.strip()
        if not raw:
            return None

        envelope = json.loads(raw)
        inner = envelope.get("result", raw) if isinstance(envelope, dict) else raw

        if isinstance(inner, str):
            text = inner.strip()
            if text.startswith("```"):
                text = text[text.index("\n") + 1:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            analysis = json.loads(text)
        elif isinstance(inner, dict):
            analysis = inner
        else:
            return None

        analysis["model"] = "haiku"
        return analysis

    except subprocess.TimeoutExpired:
        print(f"  timed out")
        return None
    except (json.JSONDecodeError, Exception) as e:
        print(f"  analysis failed: {e}")
        return None


def analyze_batch(limit: int = 20):
    """Analyze unprocessed items."""
    items = get_unanalyzed_items(limit)
    if not items:
        print("[Analyzer] No unanalyzed items")
        return 0

    print(f"[Analyzer] Processing {len(items)} items...")
    analyzed = 0

    for item in items:
        title = (item.get("title") or "untitled")[:60]
        print(f"  Analyzing: {title}...")

        analysis = analyze_item(item)
        if analysis:
            insert_analysis(item["id"], analysis)
            analyzed += 1

    print(f"[Analyzer] Analyzed {analyzed}/{len(items)} items")
    return analyzed
