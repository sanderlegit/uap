#!/usr/bin/env python3
"""Phase 3: Comprehensive analysis and cross-referencing of UAP files."""

import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime

sys.path.insert(0, '/Users/sander/Library/Python/3.9/lib/python/site-packages')
import pandas as pd

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"
OUTPUT_DIR = "/Users/sander/dev/illuminate/uap"

# Known location coordinates for mapping
LOCATION_COORDS = {
    "arabian gulf": (26.5, 51.5),
    "persian gulf": (26.5, 52.0),
    "arabian sea": (15.0, 65.0),
    "strait of hormuz": (26.5, 56.3),
    "gulf of aden": (12.5, 45.0),
    "iraq": (33.0, 44.0),
    "syria": (35.0, 38.0),
    "greece": (39.0, 22.0),
    "united arab emirates": (24.0, 54.0),
    "japan": (36.0, 138.0),
    "east china sea": (30.0, 126.0),
    "iran": (32.0, 53.0),
    "mediterranean sea": (35.0, 18.0),
    "middle east": (29.0, 47.0),
    "southern united states": (32.0, -90.0),
    "western united states": (38.0, -118.0),
    "north america": (40.0, -100.0),
    "united states": (39.0, -98.0),
    "africa": (0.0, 25.0),
    "oak ridge, tn": (36.0, -84.2),
    "oak ridge": (36.0, -84.2),
    "roswell": (33.4, -104.5),
    "new mexico": (34.5, -106.0),
    "pacific": (0.0, -170.0),
    "atlantic": (25.0, -40.0),
    "indopacom": (10.0, 130.0),
    "centcom": (29.0, 47.0),
    "eucom": (48.0, 11.0),
    "moon": (0.0, 0.0),
    "low earth orbit": (0.0, 0.0),
    "aegean sea": (39.0, 25.0),
    "gulf of oman": (24.5, 58.5),
    "djibouti": (11.5, 43.1),
    "germany": (51.0, 10.0),
}

DECADE_MAP = {
    range(1940, 1950): "1940s",
    range(1950, 1960): "1950s",
    range(1960, 1970): "1960s",
    range(1970, 1980): "1970s",
    range(1980, 1990): "1980s",
    range(1990, 2000): "1990s",
    range(2000, 2010): "2000s",
    range(2010, 2020): "2010s",
    range(2020, 2030): "2020s",
}


def parse_date(date_str):
    """Try to parse a date string into a datetime."""
    if not date_str or date_str == "N/A":
        return None
    date_str = date_str.strip()

    # Try 4-digit year formats first
    for fmt in ["%m/%d/%Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    # Try 2-digit year format with manual century correction
    for fmt in ["%m/%d/%y", "%m/%d/%y %H:%M"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            # Python's %y treats 00-68 as 2000-2068 and 69-99 as 1969-1999
            # We want: anything after 2026 (current year) should be 1900s
            if dt.year > 2026:
                dt = dt.replace(year=dt.year - 100)
            return dt
        except ValueError:
            continue

    # Try just a year
    try:
        year = int(date_str)
        if 1900 <= year <= 2026:
            return datetime(year, 1, 1)
    except ValueError:
        pass

    # Try to extract a year from the string
    year_match = re.search(r'\b(19\d{2}|20[0-2]\d)\b', date_str)
    if year_match:
        return datetime(int(year_match.group(1)), 1, 1)
    return None


def extract_dates_from_text(text):
    """Extract date references from document text."""
    dates = []
    patterns = [
        r'(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})',
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})',
        r'(\d{1,2})/(\d{1,2})/(\d{2,4})',
    ]
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            dates.append(m.group(0))
    return dates[:20]


def extract_object_descriptions(text):
    """Extract UAP object descriptions from text."""
    descriptions = []
    patterns = [
        r'(?:object|phenomenon|UAP|UFO|craft|light)[^.]{0,100}(?:shape|shaped|form|appear)[^.]{0,100}\.',
        r'(?:ellips|sphere|spheri|disc|disk|triangle|triangul|cigar|cylinder|oval|diamond|football|orb|rectangle|metallic|luminous|bright|glowing)[^.]{0,150}\.',
        r'(?:speed|altitude|velocity|knots|mph|feet|meters)[^.]{0,100}\.',
    ]
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            desc = m.group(0).strip()
            if len(desc) > 20 and len(desc) < 500:
                descriptions.append(desc)
    return descriptions[:10]


def extract_sensor_types(text):
    """Identify sensor/detection types mentioned."""
    sensors = set()
    sensor_patterns = {
        "infrared": r'\b(?:infrared|IR|FLIR|thermal|SWIR)\b',
        "radar": r'\b(?:radar|AESA|APG)\b',
        "visual": r'\b(?:visual|eyewitness|naked eye|observed visually|pilot report)\b',
        "photographic": r'\b(?:photo|photograph|camera|imagery|image)\b',
        "video": r'\b(?:video|footage|recording|gun camera|HUD)\b',
        "electro-optical": r'\b(?:electro.?optical|EO|targeting pod|ATFLIR)\b',
        "satellite": r'\b(?:satellite|overhead|orbital)\b',
        "acoustic": r'\b(?:acoustic|sonar|sound)\b',
    }
    for sensor, pattern in sensor_patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            sensors.add(sensor)
    return list(sensors)


def extract_witness_types(text):
    """Identify witness/observer types."""
    witnesses = set()
    patterns = {
        "military_pilot": r'\b(?:pilot|aircrew|aviator|fighter pilot)\b',
        "military_other": r'\b(?:soldier|sailor|marine|officer|enlisted|military)\b',
        "astronaut": r'\b(?:astronaut|cosmonaut|space crew)\b',
        "civilian": r'\b(?:civilian|citizen|public|resident)\b',
        "law_enforcement": r'\b(?:police|law enforcement|FBI agent|sheriff|deputy)\b',
        "scientist": r'\b(?:scientist|researcher|analyst|engineer)\b',
        "instrument_only": r'\b(?:sensor|instrument|automated|unmanned)\b',
    }
    for wtype, pattern in patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            witnesses.add(wtype)
    return list(witnesses)


def extract_cross_references(text):
    """Find references to other documents, case numbers, or projects."""
    refs = set()
    patterns = [
        r'\b(?:case|file|report|serial|section)\s*(?:#|number|no\.?)?\s*[\w\-\.]+',
        r'\b(?:Project\s+\w+)',
        r'\b(?:BLUE BOOK|GRUDGE|SIGN|TWINKLE|MOGUL|CONDIGN)\b',
        r'\b(?:62-HQ-\d+)',
        r'\b(?:UAP-\w+-\w+)',
        r'\b(?:AARO\s+\w+)',
    ]
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            ref = m.group(0).strip()
            if len(ref) > 5:
                refs.add(ref)
    return list(refs)[:20]


def geocode_location(location):
    """Simple geocoding using known locations."""
    if not location or location == "N/A":
        return None, None
    loc_lower = location.lower().strip()
    for key, (lat, lon) in LOCATION_COORDS.items():
        if key in loc_lower:
            return lat, lon
    return None, None


def get_decade(date_obj):
    """Get decade string from datetime."""
    if not date_obj:
        return "Unknown"
    year = date_obj.year
    for r, label in DECADE_MAP.items():
        if year in r:
            return label
    return f"{(year // 10) * 10}s"


def create_database(records):
    """Create SQLite database with all structured data."""
    db_path = os.path.join(OUTPUT_DIR, "incidents.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("DROP TABLE IF EXISTS documents")
    c.execute("DROP TABLE IF EXISTS incidents")
    c.execute("DROP TABLE IF EXISTS sensors")
    c.execute("DROP TABLE IF EXISTS witnesses")
    c.execute("DROP TABLE IF EXISTS cross_references")
    c.execute("DROP TABLE IF EXISTS object_descriptions")

    c.execute("""CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        filename TEXT,
        title TEXT,
        agency TEXT,
        release_date TEXT,
        incident_date TEXT,
        incident_date_parsed TEXT,
        incident_location TEXT,
        latitude REAL,
        longitude REAL,
        description TEXT,
        file_type TEXT,
        has_redaction BOOLEAN,
        total_pages INTEGER,
        text_length INTEGER,
        extraction_method TEXT,
        decade TEXT
    )""")

    c.execute("""CREATE TABLE sensors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        sensor_type TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE witnesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        witness_type TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE cross_references (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        reference TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    c.execute("""CREATE TABLE object_descriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        description TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id)
    )""")

    for i, rec in enumerate(records):
        date_parsed = parse_date(rec.get("incident_date", ""))
        lat, lon = geocode_location(rec.get("incident_location", ""))
        decade = get_decade(date_parsed)

        c.execute("""INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                  (i, rec.get("filename", ""), rec.get("title", ""), rec.get("agency", ""),
                   rec.get("release_date", ""), rec.get("incident_date", ""),
                   date_parsed.isoformat() if date_parsed else None,
                   rec.get("incident_location", ""), lat, lon,
                   rec.get("description", ""), rec.get("type", ""),
                   rec.get("has_redaction", False), rec.get("total_pages", 0),
                   rec.get("text_length", 0), rec.get("extraction_method", ""),
                   decade))

        text = rec.get("full_text", "")
        for sensor in extract_sensor_types(text):
            c.execute("INSERT INTO sensors (document_id, sensor_type) VALUES (?, ?)", (i, sensor))
        for witness in extract_witness_types(text):
            c.execute("INSERT INTO witnesses (document_id, witness_type) VALUES (?, ?)", (i, witness))
        for ref in extract_cross_references(text):
            c.execute("INSERT INTO cross_references (document_id, reference) VALUES (?, ?)", (i, ref))
        for desc in extract_object_descriptions(text):
            c.execute("INSERT INTO object_descriptions (document_id, description) VALUES (?, ?)", (i, desc))

    conn.commit()
    conn.close()
    print(f"Database saved to: {db_path}", file=sys.stderr)
    return db_path


def generate_summary_stats(records):
    """Generate summary statistics."""
    stats = {
        "total_files": len(records),
        "by_agency": dict(Counter(r.get("agency", "Unknown") for r in records)),
        "by_type": dict(Counter(r.get("type", "Unknown") for r in records)),
        "by_decade": {},
        "by_location": {},
        "redaction_count": sum(1 for r in records if r.get("has_redaction")),
        "total_pages": sum(r.get("total_pages", 0) for r in records),
        "total_text_chars": sum(r.get("text_length", 0) for r in records),
        "sensor_types": {},
        "witness_types": {},
    }

    for rec in records:
        text = rec.get("full_text", "")
        date_parsed = parse_date(rec.get("incident_date", ""))
        decade = get_decade(date_parsed)
        stats["by_decade"][decade] = stats["by_decade"].get(decade, 0) + 1

        loc = rec.get("incident_location", "N/A")
        if loc and loc != "N/A":
            stats["by_location"][loc] = stats["by_location"].get(loc, 0) + 1

        for s in extract_sensor_types(text):
            stats["sensor_types"][s] = stats["sensor_types"].get(s, 0) + 1
        for w in extract_witness_types(text):
            stats["witness_types"][w] = stats["witness_types"].get(w, 0) + 1

    stats_path = os.path.join(OUTPUT_DIR, "summary_stats.json")
    with open(stats_path, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"Summary stats saved to: {stats_path}", file=sys.stderr)
    return stats


def generate_timeline_html(records):
    """Generate interactive timeline visualization."""
    import plotly.graph_objects as go

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
            })

    events.sort(key=lambda e: e["date"])

    if not events:
        print("No dated events for timeline", file=sys.stderr)
        return

    fig = go.Figure()

    agencies = list(set(e["agency"] for e in events))
    colors = {'FBI': '#1f77b4', 'Department of War': '#2ca02c', 'NASA': '#ff7f0e', 'Department of State': '#d62728'}

    for agency in agencies:
        agency_events = [e for e in events if e["agency"] == agency]
        fig.add_trace(go.Scatter(
            x=[e["date"] for e in agency_events],
            y=[agency] * len(agency_events),
            mode='markers',
            marker=dict(size=12, color=colors.get(agency, '#9467bd')),
            name=agency,
            text=[f"<b>{e['title']}</b><br>{e['location']}<br>{e['description']}" for e in agency_events],
            hovertemplate="%{text}<extra></extra>",
        ))

    fig.update_layout(
        title="UAP Incident Timeline by Agency",
        xaxis_title="Date",
        yaxis_title="Agency",
        height=600,
        showlegend=True,
        template="plotly_dark",
    )

    path = os.path.join(OUTPUT_DIR, "timeline.html")
    fig.write_html(path)
    print(f"Timeline saved to: {path}", file=sys.stderr)


def generate_map_html(records):
    """Generate interactive map of geolocated incidents."""
    import plotly.graph_objects as go

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
            })

    if not points:
        print("No geolocated incidents for map", file=sys.stderr)
        return

    fig = go.Figure()

    agencies = list(set(p["agency"] for p in points))
    colors = {'FBI': '#1f77b4', 'Department of War': '#2ca02c', 'NASA': '#ff7f0e', 'Department of State': '#d62728'}

    for agency in agencies:
        ap = [p for p in points if p["agency"] == agency]
        fig.add_trace(go.Scattergeo(
            lat=[p["lat"] for p in ap],
            lon=[p["lon"] for p in ap],
            mode='markers',
            marker=dict(size=10, color=colors.get(agency, '#9467bd'), opacity=0.8),
            name=agency,
            text=[f"<b>{p['title']}</b><br>{p['location']}<br>{p['date']}<br>{p['description']}" for p in ap],
            hovertemplate="%{text}<extra></extra>",
        ))

    fig.update_geos(
        showland=True, landcolor="rgb(30, 30, 30)",
        showocean=True, oceancolor="rgb(10, 20, 40)",
        showlakes=True, lakecolor="rgb(10, 20, 40)",
        showcountries=True, countrycolor="rgb(80, 80, 80)",
        projection_type="natural earth",
    )

    fig.update_layout(
        title="UAP Incident Map",
        height=700,
        template="plotly_dark",
        geo=dict(bgcolor='rgb(10, 10, 20)'),
    )

    path = os.path.join(OUTPUT_DIR, "map.html")
    fig.write_html(path)
    print(f"Map saved to: {path}", file=sys.stderr)


def generate_cross_reference_graph(records):
    """Generate network graph of document cross-references."""
    import plotly.graph_objects as go

    nodes = {}
    edges = []

    for i, rec in enumerate(records):
        title = rec.get("title", f"doc_{i}")
        nodes[title] = {"agency": rec.get("agency", ""), "index": i}

        text = rec.get("full_text", "")
        refs = extract_cross_references(text)
        for ref in refs:
            for j, other_rec in enumerate(records):
                if i == j:
                    continue
                other_title = other_rec.get("title", "")
                if ref.lower() in other_title.lower() or other_title.lower() in ref.lower():
                    edges.append((title, other_title))

        # Check PDF/video pairings
        vp = rec.get("video_pairing", "")
        pp = rec.get("pdf_pairing", "")
        for j, other_rec in enumerate(records):
            if i == j:
                continue
            ot = other_rec.get("title", "")
            if (vp and vp.lower() in ot.lower()) or (pp and pp.lower() in ot.lower()):
                edges.append((title, ot))

    if not edges:
        print("No cross-references found for graph", file=sys.stderr)
        # Still generate a basic graph showing agencies
        pass

    # Simple force-directed layout
    import math
    n = len(nodes)
    node_list = list(nodes.keys())
    positions = {}
    for idx, name in enumerate(node_list):
        angle = 2 * math.pi * idx / max(n, 1)
        r = 5 + (idx % 3) * 2
        positions[name] = (r * math.cos(angle), r * math.sin(angle))

    fig = go.Figure()

    # Draw edges
    for (src, dst) in edges:
        if src in positions and dst in positions:
            x0, y0 = positions[src]
            x1, y1 = positions[dst]
            fig.add_trace(go.Scatter(x=[x0, x1], y=[y0, y1], mode='lines',
                                     line=dict(width=1, color='rgba(150,150,150,0.3)'),
                                     showlegend=False, hoverinfo='none'))

    # Draw nodes
    colors = {'FBI': '#1f77b4', 'Department of War': '#2ca02c', 'NASA': '#ff7f0e', 'Department of State': '#d62728'}
    for agency in set(n_info["agency"] for n_info in nodes.values()):
        agency_nodes = [(name, positions[name]) for name, info in nodes.items()
                       if info["agency"] == agency and name in positions]
        if agency_nodes:
            fig.add_trace(go.Scatter(
                x=[p[0] for _, p in agency_nodes],
                y=[p[1] for _, p in agency_nodes],
                mode='markers',
                marker=dict(size=8, color=colors.get(agency, '#9467bd')),
                name=agency,
                text=[name for name, _ in agency_nodes],
                hovertemplate="%{text}<extra></extra>",
            ))

    fig.update_layout(
        title=f"Document Cross-Reference Network ({len(edges)} connections)",
        showlegend=True, template="plotly_dark",
        height=700, xaxis=dict(visible=False), yaxis=dict(visible=False),
    )

    path = os.path.join(OUTPUT_DIR, "cross_reference_graph.html")
    fig.write_html(path)
    print(f"Cross-reference graph saved to: {path}", file=sys.stderr)


def generate_analysis_report(records, stats):
    """Generate comprehensive Markdown analysis report."""
    report = []
    report.append("# UAP/UFO PURSUE File Analysis Report")
    report.append(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    report.append(f"\n*Source: Presidential Unsealing and Reporting System for UAP Encounters (PURSUE)*")
    report.append(f"\n*Files from: https://www.war.gov/UFO/*\n")

    # Overview
    report.append("## 1. Overview\n")
    report.append(f"- **Total files released:** {stats['total_files']}")
    report.append(f"- **Total pages across all documents:** {stats['total_pages']:,}")
    report.append(f"- **Total extracted text:** {stats['total_text_chars']:,} characters")
    report.append(f"- **Files with redactions:** {stats['redaction_count']}")
    report.append("")

    # By Agency
    report.append("### Files by Agency\n")
    report.append("| Agency | Count |")
    report.append("|--------|-------|")
    for agency, count in sorted(stats["by_agency"].items(), key=lambda x: -x[1]):
        report.append(f"| {agency} | {count} |")
    report.append("")

    # By Decade
    report.append("### Files by Decade\n")
    report.append("| Decade | Count |")
    report.append("|--------|-------|")
    for decade in sorted(stats["by_decade"].keys()):
        report.append(f"| {decade} | {stats['by_decade'][decade]} |")
    report.append("")

    # Timeline Analysis
    report.append("## 2. Timeline Analysis\n")
    dated_records = [(r, parse_date(r.get("incident_date", ""))) for r in records]
    dated_records = [(r, d) for r, d in dated_records if d]
    dated_records.sort(key=lambda x: x[1])

    if dated_records:
        report.append(f"Of the {len(records)} total files, {len(dated_records)} have parseable incident dates.")
        report.append(f"\n- **Earliest incident:** {dated_records[0][1].strftime('%Y-%m-%d')} — {dated_records[0][0].get('title', '')}")
        report.append(f"- **Latest incident:** {dated_records[-1][1].strftime('%Y-%m-%d')} — {dated_records[-1][0].get('title', '')}")

        # Cluster analysis by year
        year_counts = Counter(d.year for _, d in dated_records)
        if year_counts:
            peak_year = max(year_counts, key=year_counts.get)
            report.append(f"- **Peak year:** {peak_year} ({year_counts[peak_year]} incidents)")
        report.append("")

    # Geographic Analysis
    report.append("## 3. Geographic Analysis\n")
    geolocated = [(r, geocode_location(r.get("incident_location", ""))) for r in records]
    geolocated = [(r, lat, lon) for r, (lat, lon) in geolocated if lat is not None]
    report.append(f"Of {len(records)} files, {len(geolocated)} have identifiable geographic locations.\n")

    if stats["by_location"]:
        report.append("### Top Incident Locations\n")
        report.append("| Location | Count |")
        report.append("|----------|-------|")
        for loc, count in sorted(stats["by_location"].items(), key=lambda x: -x[1])[:15]:
            report.append(f"| {loc} | {count} |")
        report.append("")

    # Middle East concentration
    me_count = sum(1 for r in records if any(k in r.get("incident_location", "").lower()
                   for k in ["iraq", "syria", "iran", "gulf", "arabian", "hormuz", "aden", "emirates"]))
    if me_count:
        report.append(f"**Middle East concentration:** {me_count} incidents ({me_count/len(records)*100:.0f}% of total)")
    report.append("")

    # Object Characteristics
    report.append("## 4. Object Characteristics\n")
    all_shapes = Counter()
    shape_patterns = {
        "ellipsoid/oval": r'\b(?:ellips|oval)\b',
        "sphere/orb": r'\b(?:sphere|spheri|orb|ball)\b',
        "disc/saucer": r'\b(?:disc|disk|saucer|flying disc)\b',
        "triangle": r'\b(?:triangle|triangul)\b',
        "diamond": r'\b(?:diamond)\b',
        "football": r'\b(?:football)\b',
        "cigar/cylinder": r'\b(?:cigar|cylinder|cylindri)\b',
        "light/luminous": r'\b(?:bright light|luminous|flash|glow)\b',
        "metallic": r'\b(?:metallic|metal)\b',
    }
    for rec in records:
        text = rec.get("full_text", "") + " " + rec.get("description", "")
        for shape, pattern in shape_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                all_shapes[shape] += 1

    if all_shapes:
        report.append("### Object Shapes/Characteristics Mentioned\n")
        report.append("| Shape/Characteristic | Count |")
        report.append("|---------------------|-------|")
        for shape, count in all_shapes.most_common():
            report.append(f"| {shape} | {count} |")
        report.append("")

    # Sensor Analysis
    report.append("## 5. Sensor/Detection Analysis\n")
    if stats["sensor_types"]:
        report.append("| Sensor Type | Documents |")
        report.append("|-------------|-----------|")
        for sensor, count in sorted(stats["sensor_types"].items(), key=lambda x: -x[1]):
            report.append(f"| {sensor} | {count} |")
        report.append("")

        # Multi-sensor cases
        multi_sensor = []
        for rec in records:
            text = rec.get("full_text", "")
            sensors = extract_sensor_types(text)
            if len(sensors) >= 2:
                multi_sensor.append((rec.get("title", ""), sensors))
        if multi_sensor:
            report.append(f"### Multi-sensor observations: {len(multi_sensor)} documents\n")
            for title, sensors in multi_sensor[:10]:
                report.append(f"- **{title}**: {', '.join(sensors)}")
            report.append("")

    # Cross-Agency Analysis
    report.append("## 6. Cross-Agency Analysis\n")

    # Group by similar incident locations and dates to find overlap
    location_groups = defaultdict(list)
    for rec in records:
        loc = rec.get("incident_location", "N/A")
        date = rec.get("incident_date", "N/A")
        if loc != "N/A":
            key = f"{loc}|{date}"
            location_groups[key].append(rec)

    multi_agency = {k: v for k, v in location_groups.items() if len(set(r.get("agency") for r in v)) > 1}
    if multi_agency:
        report.append(f"Found {len(multi_agency)} location/date combinations with multi-agency reporting:\n")
        for key, recs in multi_agency.items():
            agencies = set(r.get("agency") for r in recs)
            report.append(f"- **{key.split('|')[0]}** ({key.split('|')[1]}): {', '.join(agencies)}")
    else:
        report.append("No multi-agency overlap detected on identical incidents (most files have unique location/date combinations).")
    report.append("")

    # Historical Patterns
    report.append("## 7. Historical Patterns\n")
    cold_war = [r for r in records if parse_date(r.get("incident_date", "")) and
                parse_date(r.get("incident_date", "")).year < 1990]
    modern = [r for r in records if parse_date(r.get("incident_date", "")) and
              parse_date(r.get("incident_date", "")).year >= 2020]

    report.append(f"- **Cold War era (pre-1990):** {len(cold_war)} documents")
    report.append(f"- **Modern era (2020+):** {len(modern)} documents")
    report.append("")

    if cold_war:
        report.append("### Cold War Era Highlights")
        for r in cold_war[:5]:
            report.append(f"- {r.get('title', '')} ({r.get('agency', '')}, {r.get('incident_date', '')})")
        report.append("")

    if modern:
        report.append("### Modern Era Highlights")
        for r in modern[:10]:
            report.append(f"- {r.get('title', '')} ({r.get('agency', '')}, {r.get('incident_location', '')})")
        report.append("")

    # Language Analysis
    report.append("## 8. Terminology Analysis\n")
    term_counts = {
        "UFO/Unidentified Flying Object": 0,
        "UAP/Unidentified Anomalous Phenomena": 0,
        "Flying disc/saucer": 0,
        "Anomalous": 0,
        "Extraterrestrial": 0,
        "Range fouler": 0,
    }
    for rec in records:
        text = (rec.get("full_text", "") + " " + rec.get("description", "")).lower()
        if re.search(r'\bufo\b|unidentified flying object', text):
            term_counts["UFO/Unidentified Flying Object"] += 1
        if re.search(r'\buap\b|unidentified anomalous phenomena|unidentified aerial phenomena', text):
            term_counts["UAP/Unidentified Anomalous Phenomena"] += 1
        if re.search(r'flying disc|flying saucer', text):
            term_counts["Flying disc/saucer"] += 1
        if 'anomalous' in text:
            term_counts["Anomalous"] += 1
        if 'extraterrestrial' in text:
            term_counts["Extraterrestrial"] += 1
        if 'range fouler' in text:
            term_counts["Range fouler"] += 1

    report.append("| Term | Documents |")
    report.append("|------|-----------|")
    for term, count in sorted(term_counts.items(), key=lambda x: -x[1]):
        report.append(f"| {term} | {count} |")
    report.append("")
    report.append("*'Range fouler' is modern military terminology for an unidentified object entering restricted airspace.*")
    report.append("")

    # Witness Types
    report.append("## 9. Witness/Observer Types\n")
    if stats["witness_types"]:
        report.append("| Witness Type | Documents |")
        report.append("|-------------|-----------|")
        for wtype, count in sorted(stats["witness_types"].items(), key=lambda x: -x[1]):
            report.append(f"| {wtype.replace('_', ' ').title()} | {count} |")
    report.append("")

    # Key Findings
    report.append("## 10. Key Findings\n")
    report.append("1. **Geographic concentration in Middle East/Central Command AOR:** The majority of modern (2020+) "
                  "UAP reports come from military operations in the Middle East, particularly Iraq, Syria, "
                  "the Arabian Gulf, and the Persian Gulf region.")
    report.append("")
    report.append("2. **FBI historical archive dominates document count:** The FBI's 62-HQ-83894 case file, "
                  "spanning 1947-1968, accounts for a significant portion of the total file count, "
                  "covering the early era of UFO reporting in the United States.")
    report.append("")
    report.append("3. **Terminology evolution:** Earlier documents use 'UFO,' 'flying disc,' and 'flying saucer,' "
                  "while modern military documents use 'UAP' (Unidentified Anomalous Phenomena) and "
                  "'range fouler' (an object violating restricted airspace).")
    report.append("")
    report.append("4. **Apollo mission inclusion:** NASA's contribution includes imagery and transcripts from "
                  "Apollo 12 (1969) and Apollo 17 (1972), suggesting anomalous observations during lunar missions.")
    report.append("")
    report.append("5. **Multi-sensor corroboration is rare:** While some modern military reports include "
                  "infrared, radar, and visual data, most historical cases rely on single-witness visual reports.")
    report.append("")

    report_path = os.path.join(OUTPUT_DIR, "analysis_report.md")
    with open(report_path, 'w') as f:
        f.write("\n".join(report))
    print(f"Analysis report saved to: {report_path}", file=sys.stderr)


def main():
    # Load corpus
    corpus_path = os.path.join(UFO_DIR, "corpus.json")
    manifest_path = os.path.join(UFO_DIR, "manifest.json")

    if os.path.exists(corpus_path):
        with open(corpus_path) as f:
            corpus = json.load(f)
        print(f"Loaded corpus: {len(corpus)} documents", file=sys.stderr)
    else:
        corpus = []

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Merge manifest with corpus
    records = []
    corpus_by_filename = {c["filename"]: c for c in corpus}

    for rec in manifest["records"]:
        filename = rec.get("filename", "")
        if filename in corpus_by_filename:
            merged = {**rec, **corpus_by_filename[filename]}
        else:
            merged = rec
        records.append(merged)

    print(f"Total records for analysis: {len(records)}", file=sys.stderr)
    print(f"Records with extracted text: {sum(1 for r in records if r.get('full_text'))}", file=sys.stderr)

    # Generate all outputs
    print("\n--- Generating Summary Statistics ---", file=sys.stderr)
    stats = generate_summary_stats(records)

    print("\n--- Creating SQLite Database ---", file=sys.stderr)
    create_database(records)

    print("\n--- Generating Timeline ---", file=sys.stderr)
    generate_timeline_html(records)

    print("\n--- Generating Map ---", file=sys.stderr)
    generate_map_html(records)

    print("\n--- Generating Cross-Reference Graph ---", file=sys.stderr)
    generate_cross_reference_graph(records)

    print("\n--- Generating Analysis Report ---", file=sys.stderr)
    generate_analysis_report(records, stats)

    print(f"\n{'='*50}", file=sys.stderr)
    print("ANALYSIS COMPLETE", file=sys.stderr)
    print(f"Outputs in: {OUTPUT_DIR}", file=sys.stderr)


if __name__ == "__main__":
    main()
