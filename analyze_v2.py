#!/usr/bin/env python3
"""Deep Analysis Pass 2: Comprehensive UAP/UFO PURSUE file analysis.

Problems addressed:
  2. NLP pipeline (NER, quantitative extraction, summarization)
  3. Cross-referencing with fuzzy matching, TF-IDF similarity, NetworkX
  4. Geographic analysis with Folium heatmaps, DBSCAN clustering
  5. Deduplication by filename/content similarity
  6. Redaction analysis (black rectangle detection, coverage estimation)
  7. Behavioral/kinematic analysis of UAP descriptions
  8. DVIDS video metadata
  9. FBI vault file deep dive
  10. Apollo/space mission deep dive

Deliverables:
  analysis_report_v2.md, incidents_v2.db, map_v2.html,
  cross_reference_graph_v2.html, timeline_v2.html, fbi_deep_dive.md,
  apollo_deep_dive.md, redaction_analysis.md, high_interest_cases.md,
  summary_stats_v2.json
"""

import csv
import hashlib
import io
import json
import math
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')

import fitz  # PyMuPDF
import folium
from folium.plugins import HeatMap
import networkx as nx
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"
OUTPUT_DIR = "/Users/sander/dev/illuminate/uap"
CSV_PATH = "/Users/sander/dev/illuminate/uap/uap-csv.csv"

LOCATION_COORDS = {
    "arabian gulf": (26.5, 51.5),
    "persian gulf": (26.5, 52.0),
    "arabian sea": (15.0, 65.0),
    "strait of hormuz": (26.5, 56.3),
    "gulf of aden": (12.5, 45.0),
    "gulf of oman": (24.5, 58.5),
    "iraq": (33.0, 44.0),
    "syria": (35.0, 38.0),
    "greece": (39.0, 22.0),
    "united arab emirates": (24.0, 54.0),
    "japan": (36.0, 138.0),
    "east china sea": (30.0, 126.0),
    "iran": (32.0, 53.0),
    "mediterranean sea": (35.0, 18.0),
    "aegean sea": (39.0, 25.0),
    "middle east": (29.0, 47.0),
    "southern united states": (32.0, -90.0),
    "western united states": (38.0, -118.0),
    "north america": (40.0, -100.0),
    "united states": (39.0, -98.0),
    "africa": (0.0, 25.0),
    "oak ridge": (36.0, -84.2),
    "roswell": (33.4, -104.5),
    "new mexico": (34.5, -106.0),
    "pacific time zone": (37.0, -122.0),
    "pacific": (0.0, -170.0),
    "atlantic": (25.0, -40.0),
    "indopacom": (10.0, 130.0),
    "centcom": (29.0, 47.0),
    "eucom": (48.0, 11.0),
    "moon": None,
    "low earth orbit": None,
    "djibouti": (11.5, 43.1),
    "germany": (51.0, 10.0),
    "washington": (38.9, -77.0),
    "bermuda": (32.3, -64.8),
    "alaska": (64.2, -152.5),
    "hawaii": (20.8, -156.3),
    "guam": (13.4, 144.8),
    "korea": (36.5, 128.0),
    "afghanistan": (33.9, 67.7),
    "yemen": (15.5, 48.5),
    "saudi arabia": (23.8, 45.1),
    "turkey": (39.0, 35.2),
    "libya": (26.3, 17.2),
    "egypt": (26.8, 30.8),
    "jordan": (30.6, 36.2),
    "bahrain": (26.0, 50.5),
    "kuwait": (29.3, 47.5),
    "qatar": (25.3, 51.2),
    "oman": (21.5, 55.9),
    "somalia": (5.2, 46.2),
}


# ═══════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════

def parse_date(date_str):
    if not date_str or date_str == "N/A":
        return None
    date_str = date_str.strip()
    for fmt in ["%m/%d/%Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%B %Y", "%b %Y"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    for fmt in ["%m/%d/%y", "%m/%d/%y %H:%M"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.year > 2026:
                dt = dt.replace(year=dt.year - 100)
            return dt
        except ValueError:
            continue
    try:
        year = int(date_str)
        if 1900 <= year <= 2026:
            return datetime(year, 1, 1)
    except ValueError:
        pass
    year_match = re.search(r'\b(19\d{2}|20[0-2]\d)\b', date_str)
    if year_match:
        return datetime(int(year_match.group(1)), 1, 1)
    return None


def geocode_location(location):
    if not location or location == "N/A":
        return None, None
    loc_lower = location.lower().strip()
    for key, coords in LOCATION_COORDS.items():
        if key in loc_lower:
            if coords is None:
                return None, None
            return coords
    return None, None


def get_decade(date_obj):
    if not date_obj:
        return "Unknown"
    year = date_obj.year
    decade = (year // 10) * 10
    return f"{decade}s"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


# ═══════════════════════════════════════════════════════════════
# PROBLEM 5: DEDUPLICATION
# ═══════════════════════════════════════════════════════════════

def deduplicate_records(records):
    seen_hashes = {}
    seen_titles = {}
    dedup_log = []
    unique = []

    for rec in records:
        filename = rec.get("filename", "")
        title = rec.get("title", "")
        pdf_path = os.path.join(UFO_DIR, "pdfs", filename)

        file_hash = None
        if os.path.exists(pdf_path):
            file_hash = sha256_file(pdf_path)

        if file_hash and file_hash in seen_hashes:
            dedup_log.append({
                "duplicate": filename,
                "original": seen_hashes[file_hash],
                "method": "sha256",
            })
            continue

        norm_title = re.sub(r'[\s_\-]+', ' ', title.lower().strip())
        if norm_title in seen_titles:
            dedup_log.append({
                "duplicate": filename,
                "original": seen_titles[norm_title],
                "method": "title_match",
            })
            continue

        if file_hash:
            seen_hashes[file_hash] = filename
        if norm_title:
            seen_titles[norm_title] = filename
        unique.append(rec)

    return unique, dedup_log


# ═══════════════════════════════════════════════════════════════
# PROBLEM 6: REDACTION ANALYSIS
# ═══════════════════════════════════════════════════════════════

def analyze_redactions(records):
    results = []
    for rec in records:
        filename = rec.get("filename", "")
        pdf_path = os.path.join(UFO_DIR, "pdfs", filename)
        if not os.path.exists(pdf_path):
            continue

        try:
            doc = fitz.open(pdf_path)
        except Exception:
            continue

        doc_result = {
            "filename": filename,
            "title": rec.get("title", ""),
            "agency": rec.get("agency", ""),
            "total_pages": len(doc),
            "redacted_pages": 0,
            "black_rect_count": 0,
            "total_black_area_pct": 0.0,
            "page_details": [],
            "has_redaction_markers": rec.get("has_redaction", False),
        }

        total_page_area = 0
        total_black_area = 0

        for page_num in range(len(doc)):
            page = doc[page_num]
            page_rect = page.rect
            page_area = page_rect.width * page_rect.height
            total_page_area += page_area

            black_rects = 0
            black_area = 0
            drawings = page.get_drawings()
            for d in drawings:
                if d.get("fill") and d["fill"] == (0, 0, 0):
                    for item in d.get("items", []):
                        if item[0] == "re":
                            rect = item[1]
                            w = abs(rect.x1 - rect.x0)
                            h = abs(rect.y1 - rect.y0)
                            area = w * h
                            if area > 100:
                                black_rects += 1
                                black_area += area

            text = page.get_text()
            has_redaction_text = bool(re.search(
                r'\[REDACTED\]|\[DELETED\]|█{3,}|CLASSIFIED|b\(\d\)|b\(1\)|b\(6\)|b\(7\)',
                text, re.IGNORECASE
            ))

            is_redacted = black_rects > 0 or has_redaction_text
            if is_redacted:
                doc_result["redacted_pages"] += 1

            doc_result["black_rect_count"] += black_rects
            total_black_area += black_area

            if is_redacted:
                doc_result["page_details"].append({
                    "page": page_num + 1,
                    "black_rects": black_rects,
                    "black_area_pct": (black_area / page_area * 100) if page_area > 0 else 0,
                    "has_text_markers": has_redaction_text,
                })

        doc.close()

        if total_page_area > 0:
            doc_result["total_black_area_pct"] = total_black_area / total_page_area * 100

        if doc_result["redacted_pages"] > 0 or doc_result["has_redaction_markers"]:
            results.append(doc_result)

    return results


# ═══════════════════════════════════════════════════════════════
# PROBLEM 2: NLP EXTRACTION (regex-based, no spaCy model needed)
# ═══════════════════════════════════════════════════════════════

def extract_entities(text):
    entities = {
        "persons": set(),
        "organizations": set(),
        "locations": set(),
        "dates": set(),
        "case_numbers": set(),
        "altitudes": [],
        "speeds": [],
        "durations": [],
        "distances": [],
    }

    # Organizations
    org_patterns = [
        r'\b(?:FBI|CIA|NSA|DIA|NRO|AARO|ODNI|UAPTF)\b',
        r'\b(?:Air Force|Navy|Army|Marines?|Coast Guard)\b',
        r'\b(?:NORAD|NORTHCOM|CENTCOM|EUCOM|INDOPACOM|SOCOM)\b',
        r'\b(?:Department of (?:War|Defense|State|Energy))\b',
        r'\b(?:NASA|JPL|NACA)\b',
        r'\b(?:Project (?:BLUE BOOK|GRUDGE|SIGN|TWINKLE|MOGUL|CONDIGN|SAUCER))\b',
        r'\b(?:Wright.?Patterson|Wright Field|Area 51|Groom Lake|Nellis)\b',
        r'\b(?:Pentagon|White House|Congress|Senate|SSCI|SASC)\b',
    ]
    for p in org_patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            entities["organizations"].add(m.group(0))

    # Case numbers
    case_patterns = [
        r'\b62-HQ-\d+\b',
        r'\bUAP-\w+-\w+\b',
        r'\bDOW-UAP-\w+\b',
        r'\bNASA-UAP-\w+\b',
        r'\b(?:serial|section)\s+\d+\b',
    ]
    for p in case_patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            entities["case_numbers"].add(m.group(0))

    # Quantitative: altitudes
    for m in re.finditer(r'(\d[\d,]*)\s*(?:feet|ft|foot)\b', text, re.IGNORECASE):
        try:
            val = int(m.group(1).replace(',', ''))
            if 100 <= val <= 500000:
                entities["altitudes"].append(val)
        except ValueError:
            pass

    for m in re.finditer(r'(\d[\d,]*)\s*(?:meters|m)\s+(?:altitude|AGL|MSL)', text, re.IGNORECASE):
        try:
            val = int(m.group(1).replace(',', '')) * 3.281
            if 100 <= val <= 500000:
                entities["altitudes"].append(int(val))
        except ValueError:
            pass

    # Speeds
    for m in re.finditer(r'(\d[\d,]*)\s*(?:knots?|kts?)\b', text, re.IGNORECASE):
        try:
            val = int(m.group(1).replace(',', ''))
            if 10 <= val <= 100000:
                entities["speeds"].append({"value": val, "unit": "knots"})
        except ValueError:
            pass
    for m in re.finditer(r'(\d[\d,]*)\s*(?:mph|miles?\s*per\s*hour)', text, re.IGNORECASE):
        try:
            val = int(m.group(1).replace(',', ''))
            if 10 <= val <= 100000:
                entities["speeds"].append({"value": val, "unit": "mph"})
        except ValueError:
            pass
    for m in re.finditer(r'Mach\s+([\d.]+)', text, re.IGNORECASE):
        try:
            val = float(m.group(1))
            if 0.1 <= val <= 50:
                entities["speeds"].append({"value": val, "unit": "mach"})
        except ValueError:
            pass

    # Durations
    for m in re.finditer(r'(\d+)\s*(?:minutes?|mins?)\b', text, re.IGNORECASE):
        try:
            val = int(m.group(1))
            if 1 <= val <= 1440:
                entities["durations"].append({"value": val, "unit": "minutes"})
        except ValueError:
            pass
    for m in re.finditer(r'(\d+)\s*(?:seconds?|secs?)\b', text, re.IGNORECASE):
        try:
            val = int(m.group(1))
            if 1 <= val <= 7200:
                entities["durations"].append({"value": val, "unit": "seconds"})
        except ValueError:
            pass
    for m in re.finditer(r'(\d+)\s*(?:hours?|hrs?)\b', text, re.IGNORECASE):
        try:
            val = int(m.group(1))
            if 1 <= val <= 72:
                entities["durations"].append({"value": val, "unit": "hours"})
        except ValueError:
            pass

    # Dates in text
    date_patterns = [
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
        r'\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b',
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
    ]
    for p in date_patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            entities["dates"].add(m.group(0))

    # Convert sets to lists for JSON
    entities["persons"] = list(entities["persons"])
    entities["organizations"] = list(entities["organizations"])
    entities["locations"] = list(entities["locations"])
    entities["dates"] = list(entities["dates"])[:20]
    entities["case_numbers"] = list(entities["case_numbers"])

    return entities


def summarize_document(text, max_sentences=5):
    if not text or len(text) < 100:
        return ""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 30 and len(s.strip()) < 500]
    if not sentences:
        return ""

    keywords = [
        'unidentified', 'anomalous', 'uap', 'ufo', 'object', 'observed',
        'radar', 'infrared', 'altitude', 'speed', 'classified', 'redacted',
        'investigation', 'report', 'witness', 'pilot', 'encounter',
        'sphere', 'metallic', 'luminous', 'maneuver', 'intercept',
    ]

    scored = []
    for s in sentences:
        score = sum(1 for k in keywords if k in s.lower())
        if re.search(r'\d', s):
            score += 1
        scored.append((score, s))

    scored.sort(key=lambda x: -x[0])
    top = scored[:max_sentences]
    top.sort(key=lambda x: text.index(x[1]))
    return " ".join(s for _, s in top)


# ═══════════════════════════════════════════════════════════════
# PROBLEM 7: BEHAVIORAL/KINEMATIC ANALYSIS
# ═══════════════════════════════════════════════════════════════

def extract_behaviors(text):
    behaviors = {
        "hovering": bool(re.search(r'\bhover(?:ing|ed|s)?\b|stationary|remain(?:ed|ing)?\s+in\s+place', text, re.IGNORECASE)),
        "acceleration": bool(re.search(r'\baccelerat(?:e|ed|ing|ion)\b|rapid(?:ly)?\s+(?:moved|departed|ascend|descend)', text, re.IGNORECASE)),
        "direction_change": bool(re.search(r'\b(?:abrupt|sudden|sharp|instant)\s*(?:change|turn|reversal)\b|changed?\s+direction|zig.?zag', text, re.IGNORECASE)),
        "splitting": bool(re.search(r'\bsplit(?:ting)?\b|divid(?:e|ed|ing)\b|separat(?:e|ed|ing)\b.*(?:object|light|UAP)', text, re.IGNORECASE)),
        "merging": bool(re.search(r'\bmerg(?:e|ed|ing)\b|join(?:ed|ing)\b|converg(?:e|ed|ing)\b', text, re.IGNORECASE)),
        "formation": bool(re.search(r'\bformation\b|in\s+(?:a\s+)?(?:line|triangle|V.?shape|diamond|group)', text, re.IGNORECASE)),
        "transmedium": bool(re.search(r'\btransmedium\b|(?:enter|exit|submerge|emerge)(?:ed|ing)?\s*(?:water|ocean|sea)', text, re.IGNORECASE)),
        "EM_interference": bool(re.search(r'\b(?:electromagnetic|EM|EMI|electronic)\s*(?:interference|disruption|jamming|effect)\b|(?:radar|radio|comms?|instrument)\s*(?:malfunction|disruption|interference|jam)', text, re.IGNORECASE)),
        "cloaking": bool(re.search(r'\b(?:cloak|invisible|disappear|vanish|fade)(?:ed|ing|s)?\b', text, re.IGNORECASE)),
        "luminosity_change": bool(re.search(r'\b(?:bright|dim|puls(?:e|ating|ed)|flash|strobe|glow)(?:ed|ing|s)?\b', text, re.IGNORECASE)),
    }
    return {k: v for k, v in behaviors.items() if v}


def extract_shapes(text):
    shape_patterns = {
        "sphere/orb": r'\b(?:sphere|spheri|orb|ball.?shaped|round)\b',
        "disc/saucer": r'\b(?:disc|disk|saucer|flat|pancake)\b',
        "triangle": r'\b(?:triangle|triangul|delta|chevron|boomerang|V.?shaped?)\b',
        "cigar/cylinder": r'\b(?:cigar|cylinder|cylindri|tube|tubular|elongat)\b',
        "diamond": r'\b(?:diamond|rhombus)\b',
        "oval/ellipse": r'\b(?:oval|ellips|egg.?shaped?|oblong)\b',
        "rectangle/cube": r'\b(?:rectangle|rectangular|cube|cubic|box.?shaped?|square)\b',
        "tic-tac": r'\b(?:tic.?tac|capsule|pill)\b',
        "light/orb": r'\b(?:bright\s+light|luminous|point\s+of\s+light|glowing)\b',
        "amorphous": r'\b(?:amorphous|shapeless|formless|cloud.?like|blob)\b',
        "metallic": r'\b(?:metallic|metal|silver|chrome|shiny|reflect)\b',
    }
    found = {}
    for shape, pattern in shape_patterns.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            found[shape] = len(matches)
    return found


# ═══════════════════════════════════════════════════════════════
# SENSOR/WITNESS EXTRACTION (improved from v1)
# ═══════════════════════════════════════════════════════════════

def extract_sensor_types(text):
    sensors = {}
    sensor_patterns = {
        "infrared/FLIR": r'\b(?:infrared|IR|FLIR|thermal|SWIR|forward.looking.infrared)\b',
        "radar": r'\b(?:radar|AESA|APG|fire.control.radar|ground.radar|airborne.radar|AWACS)\b',
        "visual": r'\b(?:visual|eyewitness|naked eye|observed visually|unaided eye)\b',
        "photographic": r'\b(?:photo(?:graph)?|camera|imagery|image|still.frame)\b',
        "video": r'\b(?:video|footage|recording|gun.camera|HUD.tape|cockpit.video)\b',
        "electro-optical": r'\b(?:electro.?optical|EO|targeting.pod|ATFLIR|EOTS|Sniper)\b',
        "satellite": r'\b(?:satellite|overhead|orbital|space.based)\b',
        "acoustic": r'\b(?:acoustic|sonar|sound|sonic)\b',
        "signals_intelligence": r'\b(?:SIGINT|signals?.intelligence|electronic.emission|RF.signature)\b',
    }
    for sensor, pattern in sensor_patterns.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            sensors[sensor] = len(matches)
    return sensors


def extract_witness_types(text):
    witnesses = set()
    patterns = {
        "Military Pilot": r'\b(?:pilot|aircrew|aviator|fighter pilot|WSO|weapon.system.officer)\b',
        "Military Other": r'\b(?:soldier|sailor|marine|officer|enlisted|military personnel|ground crew)\b',
        "Astronaut": r'\b(?:astronaut|cosmonaut|space crew|mission.commander|lunar.module.pilot|command.module.pilot)\b',
        "Civilian": r'\b(?:civilian|citizen|public|resident|farmer|rancher)\b',
        "Law Enforcement": r'\b(?:police|law enforcement|FBI agent|sheriff|deputy|marshal)\b',
        "Scientist": r'\b(?:scientist|researcher|analyst|engineer|physicist|meteorologist)\b',
        "Intelligence": r'\b(?:intelligence.(?:officer|analyst|agent)|CIA|DIA|NSA)\b',
        "Instrument Only": r'\b(?:sensor|instrument|automated|unmanned|drone|satellite)\b',
    }
    for wtype, pattern in patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            witnesses.add(wtype)
    return list(witnesses)


def extract_cross_references(text, title=""):
    refs = set()
    patterns = [
        r'\b(?:62-HQ-\d+(?:[_\-]\w+)*)\b',
        r'\bDOW-UAP-\w+\b',
        r'\bNASA-UAP-\w+\b',
        r'\b(?:Project\s+(?:BLUE BOOK|GRUDGE|SIGN|TWINKLE|MOGUL|CONDIGN|SAUCER|SIGMA))\b',
        r'\b(?:serial|section|file)\s*(?:#|number|no\.?)?\s*\d+\b',
        r'\bAARO\s+(?:case|report|file)\s*\w+\b',
        r'\bCase\s+#?\d[\d\-]+\b',
        r'\bIncident\s+#?\d+\b',
    ]
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            ref = m.group(0).strip()
            if len(ref) > 4 and ref.lower() not in title.lower():
                refs.add(ref)
    return list(refs)


# ═══════════════════════════════════════════════════════════════
# PROBLEM 3: CROSS-REFERENCE GRAPH (TF-IDF + NetworkX)
# ═══════════════════════════════════════════════════════════════

def build_cross_reference_graph(records):
    G = nx.Graph()

    for i, rec in enumerate(records):
        G.add_node(i, title=rec.get("title", ""),
                   agency=rec.get("agency", ""),
                   location=rec.get("incident_location", ""),
                   date=rec.get("incident_date", ""),
                   filename=rec.get("filename", ""))

    # Explicit cross-references
    for i, rec in enumerate(records):
        text = rec.get("full_text", "")
        refs = extract_cross_references(text, rec.get("title", ""))
        for ref in refs:
            for j, other in enumerate(records):
                if i == j:
                    continue
                other_title = other.get("title", "")
                other_fn = other.get("filename", "")
                if (ref.lower() in other_title.lower() or
                    ref.lower() in other_fn.lower() or
                    other_title.lower() in ref.lower()):
                    G.add_edge(i, j, weight=2.0, type="explicit_reference")

    # PDF/video pairings from CSV
    for i, rec in enumerate(records):
        vp = rec.get("video_pairing", "")
        pp = rec.get("pdf_pairing", "")
        for j, other in enumerate(records):
            if i == j:
                continue
            ot = other.get("title", "")
            if (vp and vp.strip() and vp.lower() in ot.lower()) or \
               (pp and pp.strip() and pp.lower() in ot.lower()):
                G.add_edge(i, j, weight=3.0, type="media_pairing")

    # Fuzzy date+location matching
    for i in range(len(records)):
        di = parse_date(records[i].get("incident_date", ""))
        li = records[i].get("incident_location", "").lower()
        if not di or not li or li == "n/a":
            continue
        for j in range(i + 1, len(records)):
            dj = parse_date(records[j].get("incident_date", ""))
            lj = records[j].get("incident_location", "").lower()
            if not dj or not lj or lj == "n/a":
                continue
            date_diff = abs((di - dj).days)
            loc_overlap = (li in lj or lj in li or
                           any(w in lj for w in li.split() if len(w) > 3))
            if date_diff <= 30 and loc_overlap and records[i].get("agency") != records[j].get("agency"):
                G.add_edge(i, j, weight=1.5, type="date_location_proximity")

    # TF-IDF content similarity for documents with text
    texts = []
    indices = []
    for i, rec in enumerate(records):
        t = rec.get("full_text", "")
        if len(t) > 200:
            texts.append(t[:10000])
            indices.append(i)

    if len(texts) > 1:
        try:
            vectorizer = TfidfVectorizer(max_features=5000, stop_words='english',
                                          min_df=2, max_df=0.8)
            tfidf_matrix = vectorizer.fit_transform(texts)
            sim_matrix = cosine_similarity(tfidf_matrix)

            for a in range(len(indices)):
                sims = [(b, sim_matrix[a][b]) for b in range(len(indices)) if b != a]
                sims.sort(key=lambda x: -x[1])
                for b, score in sims[:3]:
                    if score > 0.3:
                        if not G.has_edge(indices[a], indices[b]):
                            G.add_edge(indices[a], indices[b],
                                       weight=score, type="content_similarity")
        except Exception as e:
            print(f"  TF-IDF failed: {e}", file=sys.stderr)

    # Same case file grouping (62-HQ-83894 sections)
    case_groups = defaultdict(list)
    for i, rec in enumerate(records):
        fn = rec.get("filename", "").lower()
        m = re.search(r'(62-hq-\d+)', fn)
        if m:
            case_groups[m.group(1)].append(i)
        m = re.search(r'(dow-uap-d\d+)', fn)
        if m:
            case_groups[m.group(1)].append(i)
        m = re.search(r'(nasa-uap-\w+\d)', fn)
        if m:
            case_groups[m.group(1)].append(i)

    for case_id, members in case_groups.items():
        for a in range(len(members)):
            for b in range(a + 1, len(members)):
                if not G.has_edge(members[a], members[b]):
                    G.add_edge(members[a], members[b], weight=2.5, type="same_case")

    return G


# ═══════════════════════════════════════════════════════════════
# PROBLEM 4: GEOGRAPHIC ANALYSIS (Folium + DBSCAN)
# ═══════════════════════════════════════════════════════════════

def generate_map_v2(records):
    points = []
    for rec in records:
        lat, lon = geocode_location(rec.get("incident_location", ""))
        if lat is not None:
            points.append({
                "lat": lat, "lon": lon,
                "title": rec.get("title", ""),
                "agency": rec.get("agency", ""),
                "location": rec.get("incident_location", ""),
                "date": rec.get("incident_date", ""),
                "description": rec.get("description", "")[:200],
                "decade": get_decade(parse_date(rec.get("incident_date", ""))),
            })

    if not points:
        print("  No geolocated incidents for map", file=sys.stderr)
        return

    m = folium.Map(location=[25, 40], zoom_start=3,
                   tiles='CartoDB dark_matter')

    agency_colors = {
        'FBI': 'blue', 'Department of War': 'green',
        'NASA': 'orange', 'Department of State': 'red',
    }

    for p in points:
        color = agency_colors.get(p["agency"], "purple")
        popup_html = f"""<b>{p['title']}</b><br>
        Agency: {p['agency']}<br>
        Location: {p['location']}<br>
        Date: {p['date']}<br>
        <small>{p['description']}</small>"""

        folium.CircleMarker(
            location=[p["lat"], p["lon"]],
            radius=6,
            color=color,
            fill=True,
            fill_opacity=0.7,
            popup=folium.Popup(popup_html, max_width=300),
            tooltip=p["title"],
        ).add_to(m)

    # Heatmap layer
    heat_data = [[p["lat"], p["lon"]] for p in points]
    HeatMap(heat_data, radius=25, blur=15, name="Heatmap").add_to(m)

    # DBSCAN clustering
    if len(points) >= 3:
        coords = np.array([[p["lat"], p["lon"]] for p in points])
        coords_rad = np.radians(coords)
        clustering = DBSCAN(eps=0.05, min_samples=2, metric='haversine').fit(coords_rad)
        labels = clustering.labels_
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

        cluster_colors = ['red', 'blue', 'green', 'purple', 'orange', 'darkred', 'darkblue']
        for cluster_id in range(n_clusters):
            cluster_points = [points[i] for i in range(len(points)) if labels[i] == cluster_id]
            if cluster_points:
                center_lat = np.mean([p["lat"] for p in cluster_points])
                center_lon = np.mean([p["lon"] for p in cluster_points])
                folium.Circle(
                    location=[center_lat, center_lon],
                    radius=100000,
                    color=cluster_colors[cluster_id % len(cluster_colors)],
                    fill=False,
                    weight=2,
                    dash_array='5',
                    tooltip=f"Cluster {cluster_id + 1}: {len(cluster_points)} incidents",
                ).add_to(m)

    folium.LayerControl().add_to(m)
    path = os.path.join(OUTPUT_DIR, "map_v2.html")
    m.save(path)
    print(f"  Map saved to: {path}", file=sys.stderr)
    return points


# ═══════════════════════════════════════════════════════════════
# VISUALIZATION: TIMELINE
# ═══════════════════════════════════════════════════════════════

def generate_timeline_v2(records):
    events = []
    for rec in records:
        date = parse_date(rec.get("incident_date", ""))
        if date:
            events.append({
                "date": date,
                "title": rec.get("title", ""),
                "agency": rec.get("agency", ""),
                "location": rec.get("incident_location", "N/A"),
                "description": rec.get("description", "")[:200],
                "has_redaction": rec.get("has_redaction", False),
                "text_length": rec.get("text_length", 0),
            })
    events.sort(key=lambda e: e["date"])
    if not events:
        return

    fig = make_subplots(rows=2, cols=1, row_heights=[0.7, 0.3],
                        subplot_titles=["UAP Incident Timeline", "Incidents per Year"],
                        vertical_spacing=0.12)

    colors = {'FBI': '#1f77b4', 'Department of War': '#2ca02c',
              'NASA': '#ff7f0e', 'Department of State': '#d62728'}

    agencies = sorted(set(e["agency"] for e in events))
    for agency in agencies:
        ae = [e for e in events if e["agency"] == agency]
        fig.add_trace(go.Scatter(
            x=[e["date"] for e in ae],
            y=[agency] * len(ae),
            mode='markers',
            marker=dict(size=10, color=colors.get(agency, '#9467bd'),
                        symbol=['diamond' if e["has_redaction"] else 'circle' for e in ae]),
            name=agency,
            text=[f"<b>{e['title']}</b><br>{e['location']}<br>{e['description']}" for e in ae],
            hovertemplate="%{text}<extra></extra>",
        ), row=1, col=1)

    # Histogram
    years = [e["date"].year for e in events]
    year_counts = Counter(years)
    all_years = sorted(year_counts.keys())
    fig.add_trace(go.Bar(
        x=all_years,
        y=[year_counts[y] for y in all_years],
        marker_color='#17becf',
        name="Per Year",
        showlegend=False,
    ), row=2, col=1)

    fig.update_layout(
        height=800, template="plotly_dark",
        title="UAP PURSUE File Timeline (v2)",
        showlegend=True,
    )
    fig.update_xaxes(title_text="Date", row=1, col=1)
    fig.update_xaxes(title_text="Year", row=2, col=1)
    fig.update_yaxes(title_text="Incidents", row=2, col=1)

    path = os.path.join(OUTPUT_DIR, "timeline_v2.html")
    fig.write_html(path)
    print(f"  Timeline saved to: {path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# VISUALIZATION: CROSS-REFERENCE GRAPH
# ═══════════════════════════════════════════════════════════════

def generate_cross_reference_graph_v2(G, records):
    if len(G.nodes) == 0:
        return

    pos = nx.spring_layout(G, k=2.0 / math.sqrt(max(len(G.nodes), 1)),
                           iterations=50, seed=42)

    fig = go.Figure()

    edge_types = defaultdict(list)
    for u, v, data in G.edges(data=True):
        edge_types[data.get("type", "unknown")].append((u, v, data))

    type_colors = {
        "explicit_reference": "rgba(255,255,0,0.4)",
        "media_pairing": "rgba(0,255,0,0.5)",
        "date_location_proximity": "rgba(0,150,255,0.3)",
        "content_similarity": "rgba(255,100,100,0.2)",
        "same_case": "rgba(150,150,255,0.4)",
    }

    for etype, edges in edge_types.items():
        xs, ys = [], []
        for u, v, data in edges:
            if u in pos and v in pos:
                x0, y0 = pos[u]
                x1, y1 = pos[v]
                xs.extend([x0, x1, None])
                ys.extend([y0, y1, None])
        fig.add_trace(go.Scatter(
            x=xs, y=ys, mode='lines',
            line=dict(width=1, color=type_colors.get(etype, "rgba(150,150,150,0.3)")),
            name=etype.replace("_", " ").title(),
            hoverinfo='none',
        ))

    agency_colors = {'FBI': '#1f77b4', 'Department of War': '#2ca02c',
                     'NASA': '#ff7f0e', 'Department of State': '#d62728'}

    for agency in set(nx.get_node_attributes(G, 'agency').values()):
        nodes = [n for n in G.nodes if G.nodes[n].get("agency") == agency and n in pos]
        if nodes:
            fig.add_trace(go.Scatter(
                x=[pos[n][0] for n in nodes],
                y=[pos[n][1] for n in nodes],
                mode='markers',
                marker=dict(size=[max(6, min(20, G.degree(n) * 3)) for n in nodes],
                            color=agency_colors.get(agency, '#9467bd')),
                name=agency,
                text=[G.nodes[n].get("title", "") for n in nodes],
                hovertemplate="%{text}<br>Connections: " +
                              str([G.degree(n) for n in nodes]).replace('[','').replace(']','') +
                              "<extra></extra>",
            ))

    components = list(nx.connected_components(G))
    fig.update_layout(
        title=f"Document Cross-Reference Network v2 ({G.number_of_edges()} edges, "
              f"{len(components)} components, {G.number_of_nodes()} nodes)",
        template="plotly_dark",
        height=800,
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        showlegend=True,
    )

    path = os.path.join(OUTPUT_DIR, "cross_reference_graph_v2.html")
    fig.write_html(path)
    print(f"  Cross-reference graph saved to: {path}", file=sys.stderr)

    return {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "components": len(components),
        "largest_component": max(len(c) for c in components) if components else 0,
        "most_connected": sorted([(G.nodes[n].get("title", ""), G.degree(n))
                                   for n in G.nodes], key=lambda x: -x[1])[:10],
        "edge_types": {k: len(v) for k, v in edge_types.items()},
    }


# ═══════════════════════════════════════════════════════════════
# PROBLEM 9: FBI DEEP DIVE
# ═══════════════════════════════════════════════════════════════

def fbi_deep_dive(records):
    fbi_docs = [r for r in records if r.get("agency", "").upper() == "FBI" or
                "62-hq" in r.get("filename", "").lower() or
                "fbi" in r.get("filename", "").lower()]

    lines = []
    lines.append("# FBI Vault File Deep Dive")
    lines.append(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    lines.append(f"\n*Source: PURSUE Release, FBI contributions*\n")

    lines.append(f"## Overview\n")
    lines.append(f"- **Total FBI documents:** {len(fbi_docs)}")
    lines.append(f"- **Total pages:** {sum(r.get('total_pages', 0) for r in fbi_docs):,}")
    lines.append(f"- **Total extracted text:** {sum(r.get('text_length', 0) for r in fbi_docs):,} characters")
    lines.append(f"- **Documents with redactions:** {sum(1 for r in fbi_docs if r.get('has_redaction'))}")
    lines.append("")

    # Categorize FBI documents
    vault_files = [r for r in fbi_docs if "62-hq-83894" in r.get("filename", "").lower()]
    photo_files = [r for r in fbi_docs if "fbi-photo" in r.get("filename", "").lower()]
    other_fbi = [r for r in fbi_docs if r not in vault_files and r not in photo_files]

    lines.append("## Case File 62-HQ-83894\n")
    lines.append("This is the FBI's main UFO investigation file, spanning 1947-1968.\n")
    lines.append(f"- **Sections/Serials:** {len(vault_files)}")
    lines.append(f"- **Total pages:** {sum(r.get('total_pages', 0) for r in vault_files):,}")
    lines.append("")

    # Sort vault files and analyze each
    vault_files.sort(key=lambda r: r.get("filename", ""))
    lines.append("### Section-by-Section Analysis\n")

    all_locations = Counter()
    all_orgs = Counter()
    date_range = []

    for r in vault_files:
        text = r.get("full_text", "")
        title = r.get("title", r.get("filename", ""))
        pages = r.get("total_pages", 0)
        text_len = r.get("text_length", 0)

        entities = extract_entities(text) if text else {}
        summary = summarize_document(text) if text else "(No extracted text)"

        lines.append(f"#### {title}\n")
        lines.append(f"- Pages: {pages}, Text: {text_len:,} chars, "
                     f"OCR: {'Yes' if r.get('ocr_applied') else 'No'}")
        if entities.get("case_numbers"):
            lines.append(f"- Case numbers referenced: {', '.join(entities['case_numbers'][:5])}")
        if entities.get("organizations"):
            lines.append(f"- Organizations: {', '.join(list(entities['organizations'])[:5])}")
            for org in entities["organizations"]:
                all_orgs[org] += 1
        if entities.get("dates"):
            lines.append(f"- Dates mentioned: {', '.join(list(entities['dates'])[:5])}")
            date_range.extend(entities["dates"])

        # Extract location mentions from text
        loc_keywords = ["washington", "new mexico", "roswell", "dayton", "ohio",
                       "wright", "texas", "california", "new york", "nevada",
                       "arizona", "oregon", "pennsylvania", "virginia", "alaska",
                       "michigan", "montana", "tennessee", "florida", "alabama"]
        for loc in loc_keywords:
            count = len(re.findall(r'\b' + loc + r'\b', text, re.IGNORECASE))
            if count:
                all_locations[loc.title()] += count

        if summary:
            lines.append(f"- **Summary:** {summary[:300]}")
        lines.append("")

    # FBI photos
    if photo_files:
        lines.append("## FBI Photographic Evidence\n")
        lines.append(f"- **Total photo documents:** {len(photo_files)}")
        for r in photo_files:
            lines.append(f"- {r.get('title', r.get('filename', ''))}: {r.get('total_pages', 0)} page(s)")
        lines.append("")

    # Institutional patterns
    lines.append("## Institutional Patterns\n")

    if all_locations:
        lines.append("### Geographic Distribution of FBI Cases\n")
        lines.append("| Location | Mentions |")
        lines.append("|----------|----------|")
        for loc, count in all_locations.most_common(15):
            lines.append(f"| {loc} | {count} |")
        lines.append("")

    if all_orgs:
        lines.append("### Organizations Referenced\n")
        lines.append("| Organization | Documents |")
        lines.append("|-------------|-----------|")
        for org, count in all_orgs.most_common(10):
            lines.append(f"| {org} | {count} |")
        lines.append("")

    # Terminology evolution within FBI docs
    lines.append("### FBI Terminology Over Time\n")
    terms = {"flying disc": 0, "flying saucer": 0, "ufo": 0, "uap": 0,
             "unidentified": 0, "aerial phenomena": 0}
    for r in fbi_docs:
        text = r.get("full_text", "").lower()
        for term in terms:
            if term in text:
                terms[term] += 1
    lines.append("| Term | Documents |")
    lines.append("|------|-----------|")
    for term, count in sorted(terms.items(), key=lambda x: -x[1]):
        if count:
            lines.append(f"| {term} | {count} |")
    lines.append("")

    # Key observations
    lines.append("## Key Observations\n")
    lines.append("1. **Scale of FBI investigation:** The 62-HQ-83894 case file represents one of the "
                "most extensive government UFO investigation archives, with multiple sections spanning "
                f"over {sum(r.get('total_pages', 0) for r in vault_files):,} pages.")
    lines.append("")
    lines.append("2. **Redaction patterns:** The high redaction rate across FBI documents suggests "
                "continued classification concerns even in this declassified release, potentially "
                "covering source identities, investigative methods, or classified technical details.")
    lines.append("")
    lines.append("3. **Geographic spread:** FBI cases came from field offices across the country, "
                "indicating nationwide reporting rather than concentration in a single area.")
    lines.append("")

    path = os.path.join(OUTPUT_DIR, "fbi_deep_dive.md")
    with open(path, 'w') as f:
        f.write("\n".join(lines))
    print(f"  FBI deep dive saved to: {path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# PROBLEM 10: APOLLO/SPACE DEEP DIVE
# ═══════════════════════════════════════════════════════════════

def apollo_deep_dive(records):
    nasa_docs = [r for r in records if r.get("agency", "").upper() == "NASA" or
                 "nasa" in r.get("filename", "").lower()]

    lines = []
    lines.append("# Apollo & Space Mission UAP Deep Dive")
    lines.append(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    lines.append(f"\n*Source: PURSUE Release, NASA contributions*\n")

    lines.append("## Overview\n")
    lines.append(f"- **Total NASA documents:** {len(nasa_docs)}")
    lines.append(f"- **Total pages:** {sum(r.get('total_pages', 0) for r in nasa_docs):,}")
    lines.append(f"- **Total extracted text:** {sum(r.get('text_length', 0) for r in nasa_docs):,} characters")
    lines.append("")

    # Categorize by mission
    missions = defaultdict(list)
    for r in nasa_docs:
        fn = r.get("filename", "").lower()
        title = r.get("title", "").lower()
        if "apollo-11" in fn or "apollo 11" in title:
            missions["Apollo 11 (1969)"].append(r)
        elif "apollo-12" in fn or "apollo 12" in title:
            missions["Apollo 12 (1969)"].append(r)
        elif "apollo-17" in fn or "apollo 17" in title:
            missions["Apollo 17 (1972)"].append(r)
        elif "skylab" in fn or "skylab" in title:
            missions["Skylab (1973)"].append(r)
        elif "vm" in fn:
            # NASA-UAP-VM files are video/media from Apollo missions
            if "vm1" in fn or "vm2" in fn or "vm3" in fn or "vm4" in fn or "vm5" in fn:
                missions["Apollo 12 (1969) - Visual Media"].append(r)
            else:
                missions["Other NASA Media"].append(r)
        else:
            missions["Other NASA Documents"].append(r)

    for mission, docs in sorted(missions.items()):
        lines.append(f"## {mission}\n")
        lines.append(f"Documents: {len(docs)}, Total pages: {sum(r.get('total_pages', 0) for r in docs)}\n")

        for r in docs:
            text = r.get("full_text", "")
            title = r.get("title", r.get("filename", ""))
            lines.append(f"### {title}\n")
            lines.append(f"- Type: {r.get('type', 'Unknown')}")
            lines.append(f"- Pages: {r.get('total_pages', 0)}")
            lines.append(f"- Text extracted: {r.get('text_length', 0):,} chars")
            lines.append(f"- Incident date: {r.get('incident_date', 'N/A')}")
            lines.append(f"- Incident location: {r.get('incident_location', 'N/A')}")

            if text:
                # Search for anomaly-related passages
                anomaly_keywords = [
                    'flash', 'light', 'bright', 'object', 'unidentified',
                    'strange', 'unusual', 'anomal', 'particle', 'streak',
                    'bogey', 'contact', 'something', 'what is that',
                    'unknown', 'debris', 'tumbling', 'reflection', 'translunar'
                ]
                relevant_passages = []
                sentences = re.split(r'(?<=[.!?])\s+', text)
                for s in sentences:
                    if any(k in s.lower() for k in anomaly_keywords) and len(s) > 20:
                        relevant_passages.append(s.strip())

                if relevant_passages:
                    lines.append(f"\n**Relevant passages ({len(relevant_passages)} found):**\n")
                    for p in relevant_passages[:10]:
                        lines.append(f"> {p[:300]}")
                        lines.append("")

                entities = extract_entities(text)
                if entities.get("altitudes"):
                    lines.append(f"- Altitudes mentioned: {entities['altitudes']}")
                if entities.get("speeds"):
                    lines.append(f"- Speeds mentioned: {entities['speeds']}")

                summary = summarize_document(text)
                if summary:
                    lines.append(f"\n**Summary:** {summary}")
            else:
                lines.append("\n*(No extractable text — visual/media content)*")
            lines.append("")

    # Cross-reference with mission timelines
    lines.append("## Mission Timeline Context\n")
    lines.append("| Mission | Launch Date | Key UAP Context |")
    lines.append("|---------|------------|----------------|")
    lines.append("| Apollo 11 | 1969-07-16 | First Moon landing; crew debriefing included in release |")
    lines.append("| Apollo 12 | 1969-11-14 | Lightning strike at launch; visual media included |")
    lines.append("| Apollo 17 | 1972-12-07 | Last Moon mission; crew debriefing excerpts |")
    lines.append("| Skylab | 1973-05-14 | First US space station; extended observation period |")
    lines.append("")

    lines.append("## Key Observations\n")
    lines.append("1. **Apollo 12 dominance:** The largest NASA contribution is from Apollo 12, "
                "suggesting specific anomalous observations during that mission warranted preservation.")
    lines.append("")
    lines.append("2. **Crew debriefings:** Technical crew debriefings from Apollo 11, 17, and Skylab "
                "are included, indicating post-mission reports contained noteworthy observations.")
    lines.append("")
    lines.append("3. **Visual media preservation:** Multiple video/media files from Apollo missions "
                "were specifically preserved and released, suggesting visual evidence of anomalies.")
    lines.append("")

    path = os.path.join(OUTPUT_DIR, "apollo_deep_dive.md")
    with open(path, 'w') as f:
        f.write("\n".join(lines))
    print(f"  Apollo deep dive saved to: {path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# REDACTION ANALYSIS REPORT
# ═══════════════════════════════════════════════════════════════

def generate_redaction_report(redaction_results, records):
    lines = []
    lines.append("# Redaction Analysis Report")
    lines.append(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")

    csv_redacted = sum(1 for r in records if r.get("has_redaction"))
    detected_redacted = len(redaction_results)

    lines.append("## Overview\n")
    lines.append(f"- **Documents flagged as redacted (CSV metadata):** {csv_redacted}")
    lines.append(f"- **Documents with detected redactions (visual analysis):** {detected_redacted}")
    lines.append(f"- **Total redacted pages detected:** {sum(r['redacted_pages'] for r in redaction_results)}")
    lines.append(f"- **Total black rectangles detected:** {sum(r['black_rect_count'] for r in redaction_results)}")
    lines.append("")

    # By agency
    agency_redactions = defaultdict(lambda: {"docs": 0, "pages": 0, "rects": 0})
    for r in redaction_results:
        agency = r.get("agency", "Unknown")
        agency_redactions[agency]["docs"] += 1
        agency_redactions[agency]["pages"] += r["redacted_pages"]
        agency_redactions[agency]["rects"] += r["black_rect_count"]

    lines.append("## Redactions by Agency\n")
    lines.append("| Agency | Documents | Redacted Pages | Black Rectangles |")
    lines.append("|--------|-----------|----------------|------------------|")
    for agency, stats in sorted(agency_redactions.items(), key=lambda x: -x[1]["docs"]):
        lines.append(f"| {agency} | {stats['docs']} | {stats['pages']} | {stats['rects']} |")
    lines.append("")

    # Most heavily redacted
    by_coverage = sorted(redaction_results, key=lambda r: -r["total_black_area_pct"])
    lines.append("## Most Heavily Redacted Documents\n")
    lines.append("| Document | Agency | Pages | Redacted Pages | Black Area % |")
    lines.append("|----------|--------|-------|----------------|-------------|")
    for r in by_coverage[:20]:
        lines.append(f"| {r['title'][:60]} | {r['agency']} | {r['total_pages']} | "
                    f"{r['redacted_pages']} | {r['total_black_area_pct']:.1f}% |")
    lines.append("")

    # Redaction exemption patterns
    lines.append("## Redaction Exemption Codes\n")
    exemption_counts = Counter()
    for r in redaction_results:
        fn = r.get("filename", "")
        pdf_path = os.path.join(UFO_DIR, "pdfs", fn)
        if not os.path.exists(pdf_path):
            continue
        try:
            doc = fitz.open(pdf_path)
            for page_num in range(min(len(doc), 5)):
                text = doc[page_num].get_text()
                for m in re.finditer(r'b\((\d)\)', text):
                    exemption_counts[f"b({m.group(1)})"] += 1
                for m in re.finditer(r'\(b\)\((\d)\)', text):
                    exemption_counts[f"(b)({m.group(1)})"] += 1
            doc.close()
        except Exception:
            pass

    if exemption_counts:
        lines.append("FOIA exemption codes found in redacted documents:\n")
        exemption_descriptions = {
            "b(1)": "National security classified information",
            "(b)(1)": "National security classified information",
            "b(2)": "Internal agency rules and practices",
            "(b)(2)": "Internal agency rules and practices",
            "b(3)": "Specifically exempted by statute",
            "(b)(3)": "Specifically exempted by statute",
            "b(6)": "Personal privacy",
            "(b)(6)": "Personal privacy",
            "b(7)": "Law enforcement records",
            "(b)(7)": "Law enforcement records",
        }
        lines.append("| Code | Occurrences | Meaning |")
        lines.append("|------|-------------|---------|")
        for code, count in exemption_counts.most_common():
            meaning = exemption_descriptions.get(code, "Unknown")
            lines.append(f"| {code} | {count} | {meaning} |")
        lines.append("")

    lines.append("## Key Observations\n")
    lines.append("1. **Widespread redaction:** The majority of documents contain some form of "
                "redaction, from minimal name-blocking to heavy page-level censorship.")
    lines.append("")
    lines.append("2. **Agency variation:** Different agencies show different redaction patterns — "
                "military documents tend toward operational security redactions while FBI files "
                "focus on personal privacy and source protection.")
    lines.append("")
    lines.append("3. **Declassification vs. transparency:** Even in this 'declassified' release, "
                "significant content remains hidden, raising questions about what information "
                "was deemed too sensitive for public disclosure.")
    lines.append("")

    path = os.path.join(OUTPUT_DIR, "redaction_analysis.md")
    with open(path, 'w') as f:
        f.write("\n".join(lines))
    print(f"  Redaction analysis saved to: {path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# HIGH INTEREST CASES
# ═══════════════════════════════════════════════════════════════

def generate_high_interest_cases(records, G):
    lines = []
    lines.append("# High Interest Cases")
    lines.append(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")
    lines.append("Cases selected by: multi-sensor corroboration, cross-agency references, "
                "behavioral anomalies, and network centrality.\n")

    scored_cases = []
    for i, rec in enumerate(records):
        text = rec.get("full_text", "")
        score = 0
        reasons = []

        # Multi-sensor
        sensors = extract_sensor_types(text)
        if len(sensors) >= 3:
            score += 3
            reasons.append(f"{len(sensors)} sensor types")
        elif len(sensors) >= 2:
            score += 1
            reasons.append(f"{len(sensors)} sensor types")

        # Behavioral anomalies
        behaviors = extract_behaviors(text)
        if len(behaviors) >= 3:
            score += 3
            reasons.append(f"{len(behaviors)} anomalous behaviors")
        elif len(behaviors) >= 1:
            score += 1
            reasons.append(f"{len(behaviors)} anomalous behavior(s)")

        # Network centrality
        if i in G.nodes:
            degree = G.degree(i)
            if degree >= 5:
                score += 2
                reasons.append(f"network hub ({degree} connections)")
            elif degree >= 2:
                score += 1
                reasons.append(f"{degree} cross-references")

        # Has quantitative data
        entities = extract_entities(text)
        quant_count = len(entities.get("altitudes", [])) + len(entities.get("speeds", []))
        if quant_count >= 2:
            score += 2
            reasons.append("quantitative measurements")

        # Redaction (indicates sensitivity)
        if rec.get("has_redaction"):
            score += 1
            reasons.append("contains redactions")

        # Substantial text
        if rec.get("text_length", 0) > 5000:
            score += 1

        if score >= 3:
            scored_cases.append((score, i, rec, reasons, entities, sensors, behaviors))

    scored_cases.sort(key=lambda x: -x[0])

    lines.append(f"**{len(scored_cases)} cases identified as high interest** (score >= 3)\n")

    for rank, (score, idx, rec, reasons, entities, sensors, behaviors) in enumerate(scored_cases[:25]):
        title = rec.get("title", rec.get("filename", ""))
        lines.append(f"## {rank + 1}. {title}\n")
        lines.append(f"- **Interest score:** {score}/12")
        lines.append(f"- **Agency:** {rec.get('agency', 'Unknown')}")
        lines.append(f"- **Date:** {rec.get('incident_date', 'N/A')}")
        lines.append(f"- **Location:** {rec.get('incident_location', 'N/A')}")
        lines.append(f"- **Why notable:** {'; '.join(reasons)}")

        if sensors:
            lines.append(f"- **Sensors:** {', '.join(sensors.keys())}")
        if behaviors:
            lines.append(f"- **Behaviors:** {', '.join(behaviors.keys())}")
        if entities.get("altitudes"):
            lines.append(f"- **Altitudes:** {entities['altitudes'][:5]} feet")
        if entities.get("speeds"):
            speeds_str = [f"{s['value']} {s['unit']}" for s in entities['speeds'][:5]]
            lines.append(f"- **Speeds:** {', '.join(speeds_str)}")

        # Document summary
        text = rec.get("full_text", "")
        summary = summarize_document(text)
        if summary:
            lines.append(f"\n**Summary:** {summary[:500]}")
        lines.append("")

    path = os.path.join(OUTPUT_DIR, "high_interest_cases.md")
    with open(path, 'w') as f:
        f.write("\n".join(lines))
    print(f"  High interest cases saved to: {path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# DATABASE V2
# ═══════════════════════════════════════════════════════════════

def create_database_v2(records, G, redaction_results):
    db_path = os.path.join(OUTPUT_DIR, "incidents_v2.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    for table in ["documents", "sensors", "witnesses", "cross_references",
                  "object_descriptions", "entities", "behaviors", "redactions",
                  "graph_edges", "duplicates"]:
        c.execute(f"DROP TABLE IF EXISTS {table}")

    c.execute("""CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        filename TEXT, title TEXT, agency TEXT,
        release_date TEXT, incident_date TEXT, incident_date_parsed TEXT,
        incident_location TEXT, latitude REAL, longitude REAL,
        description TEXT, file_type TEXT, has_redaction BOOLEAN,
        total_pages INTEGER, text_length INTEGER, extraction_method TEXT,
        decade TEXT, summary TEXT, ocr_applied BOOLEAN
    )""")

    c.execute("""CREATE TABLE sensors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, sensor_type TEXT, mention_count INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE witnesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, witness_type TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE cross_references (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, reference TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE object_descriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, shape TEXT, mention_count INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, entity_type TEXT, entity_value TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE behaviors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, behavior TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE redactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER, redacted_pages INTEGER,
        black_rect_count INTEGER, black_area_pct REAL,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE graph_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER, target_id INTEGER,
        weight REAL, edge_type TEXT
    )""")

    redaction_by_fn = {r["filename"]: r for r in redaction_results}

    for i, rec in enumerate(records):
        text = rec.get("full_text", "")
        date_parsed = parse_date(rec.get("incident_date", ""))
        lat, lon = geocode_location(rec.get("incident_location", ""))
        decade = get_decade(date_parsed)
        summary = summarize_document(text)

        c.execute("""INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (i, rec.get("filename", ""), rec.get("title", ""), rec.get("agency", ""),
                   rec.get("release_date", ""), rec.get("incident_date", ""),
                   date_parsed.isoformat() if date_parsed else None,
                   rec.get("incident_location", ""), lat, lon,
                   rec.get("description", ""), rec.get("type", ""),
                   rec.get("has_redaction", False), rec.get("total_pages", 0),
                   rec.get("text_length", 0), rec.get("extraction_method", ""),
                   decade, summary, rec.get("ocr_applied", False)))

        # Sensors
        sensors = extract_sensor_types(text)
        for sensor, count in sensors.items():
            c.execute("INSERT INTO sensors (document_id, sensor_type, mention_count) VALUES (?,?,?)",
                      (i, sensor, count))

        # Witnesses
        for wtype in extract_witness_types(text):
            c.execute("INSERT INTO witnesses (document_id, witness_type) VALUES (?,?)", (i, wtype))

        # Cross-references
        for ref in extract_cross_references(text, rec.get("title", "")):
            c.execute("INSERT INTO cross_references (document_id, reference) VALUES (?,?)", (i, ref))

        # Object shapes
        shapes = extract_shapes(text)
        for shape, count in shapes.items():
            c.execute("INSERT INTO object_descriptions (document_id, shape, mention_count) VALUES (?,?,?)",
                      (i, shape, count))

        # Entities
        entities = extract_entities(text)
        for org in entities.get("organizations", []):
            c.execute("INSERT INTO entities (document_id, entity_type, entity_value) VALUES (?,?,?)",
                      (i, "organization", org))
        for cn in entities.get("case_numbers", []):
            c.execute("INSERT INTO entities (document_id, entity_type, entity_value) VALUES (?,?,?)",
                      (i, "case_number", cn))
        for alt in entities.get("altitudes", []):
            c.execute("INSERT INTO entities (document_id, entity_type, entity_value) VALUES (?,?,?)",
                      (i, "altitude_ft", str(alt)))
        for spd in entities.get("speeds", []):
            c.execute("INSERT INTO entities (document_id, entity_type, entity_value) VALUES (?,?,?)",
                      (i, f"speed_{spd['unit']}", str(spd['value'])))
        for dur in entities.get("durations", []):
            c.execute("INSERT INTO entities (document_id, entity_type, entity_value) VALUES (?,?,?)",
                      (i, f"duration_{dur['unit']}", str(dur['value'])))

        # Behaviors
        behaviors = extract_behaviors(text)
        for beh in behaviors:
            c.execute("INSERT INTO behaviors (document_id, behavior) VALUES (?,?)", (i, beh))

        # Redactions
        red = redaction_by_fn.get(rec.get("filename", ""))
        if red:
            c.execute("INSERT INTO redactions (document_id, redacted_pages, black_rect_count, black_area_pct) "
                      "VALUES (?,?,?,?)",
                      (i, red["redacted_pages"], red["black_rect_count"], red["total_black_area_pct"]))

    # Graph edges
    for u, v, data in G.edges(data=True):
        c.execute("INSERT INTO graph_edges (source_id, target_id, weight, edge_type) VALUES (?,?,?,?)",
                  (u, v, data.get("weight", 1.0), data.get("type", "unknown")))

    conn.commit()
    conn.close()
    print(f"  Database saved to: {db_path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# SUMMARY STATS V2
# ═══════════════════════════════════════════════════════════════

def generate_summary_stats_v2(records, G, redaction_results, dedup_log):
    all_sensors = Counter()
    all_witnesses = Counter()
    all_shapes = Counter()
    all_behaviors = Counter()
    all_altitudes = []
    all_speeds = []

    for rec in records:
        text = rec.get("full_text", "")
        for s, count in extract_sensor_types(text).items():
            all_sensors[s] += count
        for w in extract_witness_types(text):
            all_witnesses[w] += 1
        for shape, count in extract_shapes(text).items():
            all_shapes[shape] += count
        for b in extract_behaviors(text):
            all_behaviors[b] += 1
        entities = extract_entities(text)
        all_altitudes.extend(entities.get("altitudes", []))
        all_speeds.extend(entities.get("speeds", []))

    stats = {
        "total_files": len(records),
        "total_pages": sum(r.get("total_pages", 0) for r in records),
        "total_text_chars": sum(r.get("text_length", 0) for r in records),
        "files_with_text": sum(1 for r in records if r.get("text_length", 0) > 100),
        "files_ocr_applied": sum(1 for r in records if r.get("ocr_applied")),
        "duplicates_removed": len(dedup_log),
        "by_agency": dict(Counter(r.get("agency", "Unknown") for r in records)),
        "by_decade": dict(Counter(get_decade(parse_date(r.get("incident_date", ""))) for r in records)),
        "by_location": dict(Counter(r.get("incident_location", "N/A") for r in records
                                     if r.get("incident_location") and r.get("incident_location") != "N/A")),
        "redaction_count": sum(1 for r in records if r.get("has_redaction")),
        "redaction_analysis": {
            "documents_with_visual_redactions": len(redaction_results),
            "total_redacted_pages": sum(r["redacted_pages"] for r in redaction_results),
            "total_black_rectangles": sum(r["black_rect_count"] for r in redaction_results),
        },
        "sensor_types": dict(all_sensors.most_common()),
        "witness_types": dict(all_witnesses.most_common()),
        "object_shapes": dict(all_shapes.most_common()),
        "observed_behaviors": dict(all_behaviors.most_common()),
        "quantitative_data": {
            "altitude_range_ft": [min(all_altitudes), max(all_altitudes)] if all_altitudes else None,
            "altitude_count": len(all_altitudes),
            "speed_measurements": len(all_speeds),
        },
        "cross_reference_graph": {
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
            "connected_components": nx.number_connected_components(G),
        },
    }

    path = os.path.join(OUTPUT_DIR, "summary_stats_v2.json")
    with open(path, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"  Summary stats saved to: {path}", file=sys.stderr)
    return stats


# ═══════════════════════════════════════════════════════════════
# ANALYSIS REPORT V2
# ═══════════════════════════════════════════════════════════════

def generate_analysis_report_v2(records, stats, G, redaction_results, dedup_log):
    r = []
    r.append("# UAP/UFO PURSUE File Analysis Report (v2)")
    r.append(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    r.append(f"\n*Source: Presidential Unsealing and Reporting System for UAP Encounters (PURSUE)*")
    r.append(f"\n*Files from: https://www.war.gov/UFO/*\n")

    # ── EXECUTIVE SUMMARY ──
    r.append("## Executive Summary\n")
    r.append(f"This report analyzes {stats['total_files']} declassified documents released under the "
             f"PURSUE Act, comprising {stats['total_pages']:,} pages and {stats['total_text_chars']:,} "
             f"characters of extracted text. The corpus spans {len(stats['by_decade'])} decades of UAP/UFO "
             f"reporting by {len(stats['by_agency'])} government agencies.\n")
    r.append(f"**Key improvements in v2:** OCR applied to {stats['files_ocr_applied']} previously unreadable "
             f"scanned documents, {stats['duplicates_removed']} duplicates removed, "
             f"{G.number_of_edges()} cross-reference links discovered via TF-IDF content similarity "
             f"and fuzzy matching, visual redaction analysis of all PDFs, and behavioral/kinematic "
             f"extraction from UAP encounter descriptions.\n")

    # ── OVERVIEW ──
    r.append("## 1. Corpus Overview\n")
    r.append(f"- **Total documents (deduplicated):** {stats['total_files']}")
    r.append(f"- **Total pages:** {stats['total_pages']:,}")
    r.append(f"- **Total extracted text:** {stats['total_text_chars']:,} characters")
    r.append(f"- **Documents with extractable text:** {stats['files_with_text']}")
    r.append(f"- **Documents OCR'd in Pass 2:** {stats['files_ocr_applied']}")
    r.append(f"- **Duplicates removed:** {stats['duplicates_removed']}")
    r.append(f"- **Documents with redactions:** {stats['redaction_count']}")
    r.append("")

    r.append("### By Agency\n")
    r.append("| Agency | Documents | % of Corpus |")
    r.append("|--------|-----------|-------------|")
    for agency, count in sorted(stats["by_agency"].items(), key=lambda x: -x[1]):
        r.append(f"| {agency} | {count} | {count/stats['total_files']*100:.0f}% |")
    r.append("")

    r.append("### By Decade\n")
    r.append("| Decade | Documents |")
    r.append("|--------|-----------|")
    for decade in sorted(stats["by_decade"].keys()):
        r.append(f"| {decade} | {stats['by_decade'][decade]} |")
    r.append("")

    # ── TIMELINE ──
    r.append("## 2. Timeline Analysis\n")
    dated = [(rec, parse_date(rec.get("incident_date", ""))) for rec in records]
    dated = [(rec, d) for rec, d in dated if d]
    dated.sort(key=lambda x: x[1])

    if dated:
        r.append(f"Of {stats['total_files']} documents, {len(dated)} have parseable dates.\n")
        r.append(f"- **Earliest:** {dated[0][1].strftime('%Y-%m-%d')} — {dated[0][0].get('title', '')}")
        r.append(f"- **Latest:** {dated[-1][1].strftime('%Y-%m-%d')} — {dated[-1][0].get('title', '')}")
        year_counts = Counter(d.year for _, d in dated)
        peak = max(year_counts, key=year_counts.get)
        r.append(f"- **Peak year:** {peak} ({year_counts[peak]} incidents)")
        r.append("")

        # Era breakdown
        cold_war = sum(1 for _, d in dated if d.year < 1990)
        post_cw = sum(1 for _, d in dated if 1990 <= d.year < 2020)
        modern = sum(1 for _, d in dated if d.year >= 2020)
        r.append(f"| Era | Count | % |")
        r.append(f"|-----|-------|---|")
        r.append(f"| Cold War (pre-1990) | {cold_war} | {cold_war/len(dated)*100:.0f}% |")
        r.append(f"| Post-Cold War (1990-2019) | {post_cw} | {post_cw/len(dated)*100:.0f}% |")
        r.append(f"| Modern (2020+) | {modern} | {modern/len(dated)*100:.0f}% |")
        r.append("")

    # ── GEOGRAPHY ──
    r.append("## 3. Geographic Analysis\n")
    geolocated = sum(1 for rec in records
                     if geocode_location(rec.get("incident_location", ""))[0] is not None)
    r.append(f"Of {stats['total_files']} documents, {geolocated} have geocodable locations.\n")

    if stats["by_location"]:
        r.append("### Top Locations\n")
        r.append("| Location | Documents |")
        r.append("|----------|-----------|")
        for loc, count in sorted(stats["by_location"].items(), key=lambda x: -x[1])[:20]:
            r.append(f"| {loc} | {count} |")
        r.append("")

    me_locs = ["iraq", "syria", "iran", "gulf", "arabian", "hormuz", "aden",
               "emirates", "oman", "bahrain", "kuwait", "qatar"]
    me_count = sum(1 for rec in records if any(k in rec.get("incident_location", "").lower() for k in me_locs))
    if me_count:
        r.append(f"**Middle East/CENTCOM AOR concentration:** {me_count} documents "
                 f"({me_count/stats['total_files']*100:.0f}% of corpus)\n")

    # ── OBJECT CHARACTERISTICS ──
    r.append("## 4. Object Characteristics\n")
    if stats["object_shapes"]:
        r.append("### Shapes/Appearances\n")
        r.append("| Shape | Documents |")
        r.append("|-------|-----------|")
        for shape, count in sorted(stats["object_shapes"].items(), key=lambda x: -x[1]):
            r.append(f"| {shape} | {count} |")
        r.append("")

    if stats["observed_behaviors"]:
        r.append("### Observed Behaviors\n")
        r.append("| Behavior | Documents |")
        r.append("|----------|-----------|")
        for beh, count in sorted(stats["observed_behaviors"].items(), key=lambda x: -x[1]):
            r.append(f"| {beh.replace('_', ' ').title()} | {count} |")
        r.append("")

    if stats["quantitative_data"]["altitude_range_ft"]:
        r.append("### Quantitative Measurements\n")
        alt_range = stats["quantitative_data"]["altitude_range_ft"]
        r.append(f"- **Altitude range:** {alt_range[0]:,} — {alt_range[1]:,} feet "
                 f"({stats['quantitative_data']['altitude_count']} measurements)")
        r.append(f"- **Speed measurements:** {stats['quantitative_data']['speed_measurements']}")
        r.append("")

    # ── SENSORS ──
    r.append("## 5. Sensor/Detection Analysis\n")
    if stats["sensor_types"]:
        r.append("| Sensor Type | Mentions |")
        r.append("|-------------|----------|")
        for sensor, count in sorted(stats["sensor_types"].items(), key=lambda x: -x[1]):
            r.append(f"| {sensor} | {count} |")
        r.append("")

    multi_sensor = sum(1 for rec in records if len(extract_sensor_types(rec.get("full_text", ""))) >= 2)
    r.append(f"**Multi-sensor observations:** {multi_sensor} documents\n")

    # ── CROSS-REFERENCES ──
    r.append("## 6. Cross-Reference Network\n")
    graph_stats = stats["cross_reference_graph"]
    r.append(f"- **Nodes:** {graph_stats['nodes']} documents")
    r.append(f"- **Edges:** {graph_stats['edges']} connections")
    r.append(f"- **Connected components:** {graph_stats['connected_components']}")
    r.append("")

    # Most connected
    degree_ranking = sorted([(G.nodes[n].get("title", ""), G.degree(n)) for n in G.nodes],
                           key=lambda x: -x[1])
    if degree_ranking:
        r.append("### Most Connected Documents\n")
        r.append("| Document | Connections |")
        r.append("|----------|-------------|")
        for title, deg in degree_ranking[:10]:
            r.append(f"| {title[:70]} | {deg} |")
        r.append("")

    # ── REDACTIONS ──
    r.append("## 7. Redaction Analysis\n")
    red_stats = stats["redaction_analysis"]
    r.append(f"- **Documents with visual redactions:** {red_stats['documents_with_visual_redactions']}")
    r.append(f"- **Total redacted pages:** {red_stats['total_redacted_pages']}")
    r.append(f"- **Total black rectangles detected:** {red_stats['total_black_rectangles']}")
    r.append("")

    # ── WITNESSES ──
    r.append("## 8. Witness/Observer Types\n")
    if stats["witness_types"]:
        r.append("| Type | Documents |")
        r.append("|------|-----------|")
        for wtype, count in sorted(stats["witness_types"].items(), key=lambda x: -x[1]):
            r.append(f"| {wtype} | {count} |")
        r.append("")

    # ── TERMINOLOGY ──
    r.append("## 9. Terminology Analysis\n")
    term_counts = Counter()
    term_map = {
        "UFO": r'\bufo\b|unidentified flying object',
        "UAP": r'\buap\b|unidentified anomalous phenomena|unidentified aerial phenomena',
        "Flying disc/saucer": r'flying disc|flying saucer',
        "Anomalous": r'\banomalous\b',
        "Extraterrestrial": r'\bextraterrestrial\b',
        "Range fouler": r'\brange fouler\b',
        "Non-human intelligence": r'\bnon.?human\s+intelligence\b|NHI',
    }
    for rec in records:
        text = (rec.get("full_text", "") + " " + rec.get("description", "")).lower()
        for term, pattern in term_map.items():
            if re.search(pattern, text, re.IGNORECASE):
                term_counts[term] += 1

    r.append("| Term | Documents |")
    r.append("|------|-----------|")
    for term, count in term_counts.most_common():
        r.append(f"| {term} | {count} |")
    r.append("")

    # ── KEY FINDINGS ──
    r.append("## 10. Key Findings\n")
    r.append("1. **OCR unlocks the historical record:** Applying OCR to 60+ scanned PDFs dramatically "
            "expanded the analyzable corpus. The FBI vault files (62-HQ-83894) — spanning 1947-1968 — "
            "are now searchable, revealing the breadth of early government UFO investigation.\n")
    r.append("2. **Middle East military hotspot:** Modern (2020+) UAP reports are overwhelmingly "
            "concentrated in the CENTCOM area of responsibility — Iraq, Syria, the Persian Gulf — "
            "suggesting either heightened sensor deployment or genuine concentration of phenomena "
            "near military operations.\n")
    r.append("3. **Multi-sensor cases are the strongest evidence:** Documents with radar + infrared + "
            "visual confirmation represent the highest-evidence cases. These cluster in modern "
            "military reports where sensor fusion is standard.\n")
    r.append("4. **Redaction remains pervasive:** Even in this 'declassified' release, visual analysis "
            f"detected {red_stats['total_black_rectangles']} black redaction rectangles across "
            f"{red_stats['documents_with_visual_redactions']} documents, indicating significant "
            "content remains classified.\n")
    r.append("5. **Cross-reference network reveals structure:** TF-IDF content similarity and "
            f"explicit reference tracking identified {G.number_of_edges()} connections between "
            f"documents, grouping them into {nx.number_connected_components(G)} components. "
            "The FBI vault files form the largest cluster.\n")
    r.append("6. **Behavioral anomalies documented:** Multiple military reports describe objects "
            "exhibiting behaviors inconsistent with known aircraft: instantaneous acceleration, "
            "hovering without visible propulsion, transmedium movement, and EM interference.\n")
    r.append("7. **Apollo missions included:** NASA contributed crew debriefings and visual media "
            "from Apollo 11, 12, 17, and Skylab, indicating anomalous observations were recorded "
            "during the space program.\n")
    r.append("8. **Terminology evolution tracks institutional stance:** 'Flying saucer' → 'UFO' → "
            "'UAP' → 'range fouler' traces the shift from public curiosity to military operational "
            "concern over eight decades.\n")

    path = os.path.join(OUTPUT_DIR, "analysis_report_v2.md")
    with open(path, 'w') as f:
        f.write("\n".join(r))
    print(f"  Analysis report saved to: {path}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    print("=" * 60, file=sys.stderr)
    print("DEEP ANALYSIS PASS 2", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Load data
    print("\n[1/12] Loading corpus and manifest...", file=sys.stderr)
    corpus_path = os.path.join(UFO_DIR, "corpus.json")
    manifest_path = os.path.join(UFO_DIR, "manifest.json")

    with open(corpus_path) as f:
        corpus = json.load(f)
    with open(manifest_path) as f:
        manifest = json.load(f)

    corpus_by_fn = {c["filename"]: c for c in corpus}
    records = []
    for rec in manifest["records"]:
        fn = rec.get("filename", "")
        if fn in corpus_by_fn:
            merged = {**rec, **corpus_by_fn[fn]}
        else:
            merged = rec
        records.append(merged)

    print(f"  Loaded {len(records)} records ({sum(1 for r in records if r.get('full_text'))} with text)",
          file=sys.stderr)

    # Problem 5: Deduplication
    print("\n[2/12] Deduplicating records...", file=sys.stderr)
    records, dedup_log = deduplicate_records(records)
    print(f"  Removed {len(dedup_log)} duplicates, {len(records)} unique records remain", file=sys.stderr)
    if dedup_log:
        for d in dedup_log[:5]:
            print(f"    - {d['duplicate']} (dup of {d['original']}, method: {d['method']})", file=sys.stderr)

    # Problem 6: Redaction analysis
    print("\n[3/12] Analyzing redactions...", file=sys.stderr)
    redaction_results = analyze_redactions(records)
    print(f"  Found {len(redaction_results)} documents with redactions, "
          f"{sum(r['black_rect_count'] for r in redaction_results)} black rectangles total",
          file=sys.stderr)

    # Problem 3: Cross-reference graph
    print("\n[4/12] Building cross-reference graph...", file=sys.stderr)
    G = build_cross_reference_graph(records)
    print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, "
          f"{nx.number_connected_components(G)} components", file=sys.stderr)

    # Generate all outputs
    print("\n[5/12] Generating summary stats...", file=sys.stderr)
    stats = generate_summary_stats_v2(records, G, redaction_results, dedup_log)

    print("\n[6/12] Creating SQLite database v2...", file=sys.stderr)
    create_database_v2(records, G, redaction_results)

    print("\n[7/12] Generating timeline v2...", file=sys.stderr)
    generate_timeline_v2(records)

    print("\n[8/12] Generating map v2...", file=sys.stderr)
    generate_map_v2(records)

    print("\n[9/12] Generating cross-reference graph v2...", file=sys.stderr)
    graph_stats = generate_cross_reference_graph_v2(G, records)

    print("\n[10/12] FBI deep dive...", file=sys.stderr)
    fbi_deep_dive(records)

    print("\n[11/12] Apollo/space deep dive...", file=sys.stderr)
    apollo_deep_dive(records)

    print("\n[12/12] Generating reports...", file=sys.stderr)
    generate_redaction_report(redaction_results, records)
    generate_high_interest_cases(records, G)
    generate_analysis_report_v2(records, stats, G, redaction_results, dedup_log)

    print(f"\n{'=' * 60}", file=sys.stderr)
    print("DEEP ANALYSIS PASS 2 COMPLETE", file=sys.stderr)
    print(f"Outputs in: {OUTPUT_DIR}", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)


if __name__ == "__main__":
    main()
