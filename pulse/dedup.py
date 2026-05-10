"""MinHash LSH deduplication for Pulse items.

Uses datasketch to detect near-duplicate articles at ingestion time.
Same story appearing across Google News queries and GDELT gets caught here.
"""

from __future__ import annotations

import logging
import pickle
import re
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

LSH_PATH = Path(__file__).parent.parent / "data" / "pulse_lsh.pkl"

# MinHash parameters
NUM_PERM = 128
THRESHOLD = 0.7
# Combine title + first 500 chars of content for fingerprinting
CONTENT_LIMIT = 500

# Simple tokenizer: lowercase alphanumeric sequences
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    """Split text into lowercase alphanumeric tokens."""
    return _TOKEN_RE.findall(text.lower())


def _make_text(title: str, content: str) -> str:
    """Combine title and content prefix into a single string for hashing."""
    parts = []
    if title:
        parts.append(title)
    if content:
        parts.append(content[:CONTENT_LIMIT])
    return " ".join(parts)


try:
    from datasketch import MinHash, MinHashLSH

    _HAS_DATASKETCH = True
except ImportError:
    _HAS_DATASKETCH = False


class PulseDedup:
    """Near-duplicate detector backed by MinHash LSH.

    Wraps a datasketch MinHashLSH index.  On init, tries to load a
    persisted index from disk; if that fails, rebuilds from all items
    currently in pulse.db.
    """

    def __init__(self):
        self._lsh = None  # type: Optional[MinHashLSH]
        self._id_map = {}  # type: dict[str, int]  # lsh-key -> item_id

        if not _HAS_DATASKETCH:
            logger.info("datasketch not installed — dedup disabled")
            return

        if not self._load():
            self._rebuild()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_duplicate(
        self, title: Optional[str], content: Optional[str]
    ) -> Tuple[bool, Optional[int]]:
        """Check whether (title, content) is a near-duplicate of an existing item.

        Returns (True, existing_item_id) if duplicate, (False, None) otherwise.
        """
        if self._lsh is None:
            return False, None

        mh = self._compute_minhash(title, content)
        if mh is None:
            return False, None

        try:
            results = self._lsh.query(mh)
        except Exception:
            logger.exception("LSH query failed")
            return False, None

        if results:
            key = results[0]
            return True, self._id_map.get(key)
        return False, None

    def add_item(
        self, item_id: int, title: Optional[str], content: Optional[str]
    ) -> None:
        """Add a new item to the LSH index and persist."""
        if self._lsh is None:
            return

        mh = self._compute_minhash(title, content)
        if mh is None:
            return

        key = f"item_{item_id}"
        try:
            self._lsh.insert(key, mh)
            self._id_map[key] = item_id
        except ValueError:
            # Already in the index (e.g. after rebuild included it)
            pass

        self._save()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _compute_minhash(
        self, title: Optional[str], content: Optional[str]
    ) -> Optional[MinHash]:
        text = _make_text(title or "", content or "")
        tokens = _tokenize(text)
        if len(tokens) < 3:
            return None

        mh = MinHash(num_perm=NUM_PERM)
        for token in tokens:
            mh.update(token.encode("utf-8"))
        return mh

    def _load(self) -> bool:
        """Try to load persisted LSH index.  Returns True on success."""
        if not LSH_PATH.exists():
            return False
        try:
            with open(LSH_PATH, "rb") as f:
                data = pickle.load(f)
            self._lsh = data["lsh"]
            self._id_map = data["id_map"]
            logger.info(
                "Loaded dedup index from %s (%d items)", LSH_PATH, len(self._id_map)
            )
            return True
        except Exception:
            logger.exception("Failed to load dedup index, will rebuild")
            return False

    def _save(self) -> None:
        """Persist LSH index to disk."""
        if self._lsh is None:
            return
        try:
            LSH_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(LSH_PATH, "wb") as f:
                pickle.dump({"lsh": self._lsh, "id_map": self._id_map}, f)
        except Exception:
            logger.exception("Failed to save dedup index")

    def _rebuild(self) -> None:
        """Rebuild the LSH index from all items in the database.

        Import of db is deferred to here to avoid circular imports
        (db.py imports dedup.py at module level).
        """
        logger.info("Rebuilding dedup index from database...")
        self._lsh = MinHashLSH(threshold=THRESHOLD, num_perm=NUM_PERM)
        self._id_map = {}

        try:
            from pulse.db import get_db

            with get_db() as db:
                rows = db.execute(
                    "SELECT id, title, content FROM items"
                ).fetchall()

            count = 0
            for row in rows:
                mh = self._compute_minhash(row["title"], row["content"])
                if mh is None:
                    continue
                key = f"item_{row['id']}"
                try:
                    self._lsh.insert(key, mh)
                    self._id_map[key] = row["id"]
                    count += 1
                except ValueError:
                    pass

            logger.info("Dedup index rebuilt with %d items", count)
            self._save()
        except Exception:
            logger.exception("Failed to rebuild dedup index")
            self._lsh = MinHashLSH(threshold=THRESHOLD, num_perm=NUM_PERM)
            self._id_map = {}


# Module-level singleton — lazily initialized
_dedup_instance = None  # type: Optional[PulseDedup]


def get_dedup() -> Optional[PulseDedup]:
    """Get or create the singleton PulseDedup instance.

    Returns None if datasketch is not available.
    """
    global _dedup_instance
    if not _HAS_DATASKETCH:
        return None
    if _dedup_instance is None:
        try:
            _dedup_instance = PulseDedup()
        except Exception:
            logger.exception("Failed to initialize dedup")
            return None
    return _dedup_instance
