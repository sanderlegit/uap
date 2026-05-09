#!/usr/bin/env python3
"""
build_legacy_web.py — Generate legacy_web.json

Maps 129 declassified UAP documents to the "Legacy Program" framework
(Surveillance / Custodial / Industrial) using keyword analysis of each
document's full text, title, description, entities, sensors, and behaviors.

Output: website/public/data/legacy_web.json
"""

import json
import math
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent / "website" / "public" / "data"
OUTPUT_PATH = DATA_DIR / "legacy_web.json"

# ---------------------------------------------------------------------------
# 1. Define the Legacy Program graph structure
# ---------------------------------------------------------------------------

# Hub node
HUB_NODE = {
    "id": "legacy_program",
    "label": "The Legacy Program",
    "type": "hub",
    "layer": "center",
    "color": "#f59e0b",
    "size": 80,
    "description": "Alleged multi-decade covert UAP program spanning surveillance, custodial, and industrial operations",
}

# Layer nodes
LAYER_NODES = [
    {
        "id": "surveillance",
        "label": "Surveillance Layer",
        "type": "layer",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 60,
        "description": "Detection, tracking, and initial assessment of UAP",
    },
    {
        "id": "custodial",
        "label": "Custodial Layer",
        "type": "layer",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 60,
        "description": "Material storage, classification, and containment",
    },
    {
        "id": "industrial",
        "label": "Industrial Layer",
        "type": "layer",
        "layer": "industrial",
        "color": "#ef4444",
        "size": 60,
        "description": "Reverse engineering and technology exploitation",
    },
]

# Organization/program nodes within each layer
ORG_NODES = [
    # --- Surveillance layer ---
    {
        "id": "nro",
        "label": "NRO",
        "type": "org",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 40,
        "description": "National Reconnaissance Office — detection & satellite tracking",
    },
    {
        "id": "cia_oga",
        "label": "CIA Office of Global Access",
        "type": "org",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 35,
        "description": "CIA Office of Global Access — foreign recovery coordination",
    },
    {
        "id": "cia_dst",
        "label": "CIA DS&T",
        "type": "org",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 35,
        "description": "CIA Directorate of Science & Technology",
    },
    {
        "id": "aaro",
        "label": "AARO / UAPTF",
        "type": "org",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 40,
        "description": "All-domain Anomaly Resolution Office / UAP Task Force — modern investigation",
    },
    {
        "id": "blue_book",
        "label": "Project Blue Book / Sign / Grudge",
        "type": "org",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 35,
        "description": "Historical USAF investigation programs (1947-1969)",
    },
    # --- Custodial layer ---
    {
        "id": "doe_aec",
        "label": "DOE / AEC",
        "type": "org",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 40,
        "description": "Department of Energy / Atomic Energy Commission — classification authority",
    },
    {
        "id": "sandia",
        "label": "Sandia National Labs",
        "type": "org",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 35,
        "description": "Sandia National Laboratories — primary storage facility",
    },
    {
        "id": "lanl_ornl_battelle",
        "label": "Los Alamos / Oak Ridge / Battelle",
        "type": "org",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 35,
        "description": "National laboratory analysis facilities",
    },
    {
        "id": "mitre",
        "label": "MITRE Corporation",
        "type": "org",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 30,
        "description": "MITRE Corporation — FFRDC program management",
    },
    {
        "id": "wright_patterson",
        "label": "Wright-Patterson AFB",
        "type": "org",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 35,
        "description": "Wright-Patterson Air Force Base — historical storage (Hangar 18)",
    },
    # --- Industrial layer ---
    {
        "id": "lockheed",
        "label": "Lockheed Martin Skunk Works",
        "type": "org",
        "layer": "industrial",
        "color": "#ef4444",
        "size": 40,
        "description": "Lockheed Martin Skunk Works — alleged reverse engineering",
    },
    {
        "id": "northrop",
        "label": "Northrop Grumman",
        "type": "org",
        "layer": "industrial",
        "color": "#ef4444",
        "size": 35,
        "description": "Northrop Grumman Advanced Programs — prototyping",
    },
    {
        "id": "saic",
        "label": "SAIC",
        "type": "org",
        "layer": "industrial",
        "color": "#ef4444",
        "size": 30,
        "description": "Science Applications International Corporation — technology exploitation",
    },
    {
        "id": "irad",
        "label": "IRAD Funding",
        "type": "org",
        "layer": "industrial",
        "color": "#ef4444",
        "size": 30,
        "description": "Independent Research & Development funding mechanism — billing concealment",
    },
    {
        "id": "area51",
        "label": "Area 51 / S4",
        "type": "org",
        "layer": "industrial",
        "color": "#ef4444",
        "size": 35,
        "description": "Area 51 / S4 — testing facilities near Groom Lake, Nevada",
    },
    # --- Additional central nodes ---
    {
        "id": "aea_1954",
        "label": "Atomic Energy Act 1954",
        "type": "org",
        "layer": "custodial",
        "color": "#f59e0b",
        "size": 40,
        "description": "Atomic Energy Act of 1954 — classification shield for UAP materials",
    },
    {
        "id": "five_eyes",
        "label": "Five Eyes",
        "type": "org",
        "layer": "surveillance",
        "color": "#3b82f6",
        "size": 35,
        "description": "Five Eyes intelligence alliance — international UAP cooperation",
    },
    {
        "id": "congressional",
        "label": "Congressional Oversight",
        "type": "org",
        "layer": "center",
        "color": "#10b981",
        "size": 40,
        "description": "Congressional oversight — UAPDA / disclosure efforts",
    },
]

# Structure edges (hierarchy: hub → layer → org)
STRUCTURE_EDGES = [
    # Hub to layers
    {"source": "legacy_program", "target": "surveillance", "type": "structure", "weight": 1.0},
    {"source": "legacy_program", "target": "custodial", "type": "structure", "weight": 1.0},
    {"source": "legacy_program", "target": "industrial", "type": "structure", "weight": 1.0},
    # Surveillance layer to its orgs
    {"source": "surveillance", "target": "nro", "type": "structure", "weight": 0.8},
    {"source": "surveillance", "target": "cia_oga", "type": "structure", "weight": 0.8},
    {"source": "surveillance", "target": "cia_dst", "type": "structure", "weight": 0.8},
    {"source": "surveillance", "target": "aaro", "type": "structure", "weight": 0.8},
    {"source": "surveillance", "target": "blue_book", "type": "structure", "weight": 0.8},
    {"source": "surveillance", "target": "five_eyes", "type": "structure", "weight": 0.7},
    # Custodial layer to its orgs
    {"source": "custodial", "target": "doe_aec", "type": "structure", "weight": 0.8},
    {"source": "custodial", "target": "sandia", "type": "structure", "weight": 0.8},
    {"source": "custodial", "target": "lanl_ornl_battelle", "type": "structure", "weight": 0.8},
    {"source": "custodial", "target": "mitre", "type": "structure", "weight": 0.7},
    {"source": "custodial", "target": "wright_patterson", "type": "structure", "weight": 0.8},
    {"source": "custodial", "target": "aea_1954", "type": "structure", "weight": 0.9},
    # Industrial layer to its orgs
    {"source": "industrial", "target": "lockheed", "type": "structure", "weight": 0.8},
    {"source": "industrial", "target": "northrop", "type": "structure", "weight": 0.8},
    {"source": "industrial", "target": "saic", "type": "structure", "weight": 0.7},
    {"source": "industrial", "target": "irad", "type": "structure", "weight": 0.7},
    {"source": "industrial", "target": "area51", "type": "structure", "weight": 0.8},
    # Congressional oversight connects to hub
    {"source": "legacy_program", "target": "congressional", "type": "structure", "weight": 0.7},
    # Cross-layer bridges
    {"source": "wright_patterson", "target": "blue_book", "type": "cross_layer", "weight": 0.6},
    {"source": "cia_dst", "target": "lockheed", "type": "cross_layer", "weight": 0.5},
    {"source": "doe_aec", "target": "aea_1954", "type": "cross_layer", "weight": 0.8},
    {"source": "nro", "target": "area51", "type": "cross_layer", "weight": 0.5},
    {"source": "lanl_ornl_battelle", "target": "lockheed", "type": "cross_layer", "weight": 0.4},
    {"source": "sandia", "target": "doe_aec", "type": "cross_layer", "weight": 0.7},
    {"source": "aaro", "target": "congressional", "type": "cross_layer", "weight": 0.6},
]

# ---------------------------------------------------------------------------
# 2. Keyword-to-node mapping for content analysis
# ---------------------------------------------------------------------------

# Each entry: (node_id, weight_boost, [keyword_patterns])
# weight_boost is added per hit (capped later)
KEYWORD_RULES: list[tuple[str, float, list[str]]] = [
    # Surveillance layer
    ("nro", 0.15, [
        r"\bnro\b", r"national reconnaissance", r"satellite", r"sentient",
        r"immaculate constellation", r"reconnaissance",
    ]),
    ("cia_oga", 0.15, [
        r"\bcia\b", r"central intelligence", r"office of global access",
        r"\boga\b", r"langley",
    ]),
    ("cia_dst", 0.15, [
        r"directorate of science", r"\bds&t\b", r"\bdst\b",
        r"science and technology",
    ]),
    ("aaro", 0.12, [
        r"\baaro\b", r"uap\s*task\s*force", r"\buaptf\b", r"\baatip\b",
        r"\baawsap\b", r"anomaly resolution", r"unidentified anomalous",
        r"unidentified aerial",
    ]),
    ("blue_book", 0.12, [
        r"blue\s*book", r"project\s*sign", r"project\s*grudge",
        r"project\s*saucer", r"atic\b", r"air\s*technical\s*intelligence",
        r"air\s*materiel\s*command",
    ]),
    ("five_eyes", 0.15, [
        r"\bfvey\b", r"five\s*eyes", r"\bnato\b", r"allied",
        r"rel\s*to\s*usa.*fvey", r"international\b.*cooperat",
        r"\bgchq\b", r"\basio\b",
    ]),
    # Custodial layer
    ("doe_aec", 0.15, [
        r"\bdoe\b", r"department of energy", r"atomic energy commission",
        r"\baec\b", r"nuclear\s*security",
    ]),
    ("sandia", 0.15, [
        r"sandia", r"sandia national",
    ]),
    ("lanl_ornl_battelle", 0.12, [
        r"los\s*alamos", r"\blanl\b", r"oak\s*ridge", r"\bornl\b",
        r"battelle", r"national\s*laborator",
    ]),
    ("mitre", 0.15, [
        r"\bmitre\b", r"\bffrdc\b", r"federally funded research",
    ]),
    ("wright_patterson", 0.12, [
        r"wright.?patterson", r"wright\s*field", r"hangar\s*18",
        r"wpafb\b", r"foreign technology division",
    ]),
    ("aea_1954", 0.20, [
        r"atomic\s*energy\s*act", r"restricted\s*data",
        r"transclassified", r"special access program",
    ]),
    # Generic classification terms — very low weight; only significant with many hits
    ("aea_1954", 0.015, [
        r"\bfoia\b", r"freedom of information", r"classified",
        r"\bsecret\b", r"redact", r"declassif",
    ]),
    # Industrial layer
    ("lockheed", 0.15, [
        r"lockheed", r"skunk\s*works", r"kelly\s*johnson",
        r"ben\s*rich",
    ]),
    ("northrop", 0.15, [
        r"northrop", r"grumman", r"northrop\s*grumman",
    ]),
    ("saic", 0.15, [
        r"\bsaic\b", r"science applications international",
    ]),
    ("irad", 0.15, [
        r"\birad\b", r"independent research and development",
        r"black\s*budget", r"appropriation",
    ]),
    ("area51", 0.15, [
        r"area\s*51", r"groom\s*lake", r"\bs4\b.*facility",
        r"papoose", r"tonopah", r"nevada\s*test",
    ]),
    ("congressional", 0.10, [
        r"congress", r"oversight", r"hearing", r"testimony",
        r"disclosure", r"\buapda\b", r"committee",
        r"senator", r"representative", r"legislation",
    ]),
]

# Additional keyword groups for general topic detection (mapped to nodes)
SENSOR_KEYWORDS: list[tuple[str, float, list[str]]] = [
    ("nro", 0.08, [
        r"\bradar\b", r"\bflir\b", r"infrared", r"\bsonar\b",
        r"sensor", r"detection", r"tracking", r"electro.?optical",
        r"signals?\s*intelligence", r"\bsigint\b",
    ]),
    ("aaro", 0.06, [
        r"mission\s*report", r"misrep", r"incident\s*report",
    ]),
]

RETRIEVAL_KEYWORDS: list[tuple[str, float, list[str]]] = [
    ("doe_aec", 0.08, [
        r"nuclear", r"atomic", r"radiation", r"radioactive",
    ]),
    ("lanl_ornl_battelle", 0.08, [
        r"material\s*analys", r"metallurg", r"specimen",
        r"isotop",
    ]),
    ("wright_patterson", 0.06, [
        r"retriev", r"recover", r"crash", r"debris", r"wreckage",
    ]),
]

TECHNOLOGY_KEYWORDS: list[tuple[str, float, list[str]]] = [
    ("lockheed", 0.06, [
        r"reverse\s*engineer", r"propulsion", r"anti.?grav",
        r"craft\s*technolog", r"exotic\s*material",
    ]),
    ("area51", 0.06, [
        r"test\s*range", r"proving\s*ground", r"dugway",
    ]),
]

# Combine all keyword rule sets
ALL_KEYWORD_RULES = KEYWORD_RULES + SENSOR_KEYWORDS + RETRIEVAL_KEYWORDS + TECHNOLOGY_KEYWORDS

# ---------------------------------------------------------------------------
# 3. Agency-based default connections
# ---------------------------------------------------------------------------

AGENCY_DEFAULTS: dict[str, list[tuple[str, float, str]]] = {
    "Department of War": [
        ("aaro", 0.20, "U.S. military reporting chain — modern UAP reporting to AARO"),
        ("blue_book", 0.08, "Historical USAF investigation lineage"),
    ],
    "FBI": [
        ("aea_1954", 0.08, "FBI involved in classified document handling"),
    ],
    "NASA": [
        ("nro", 0.20, "NASA space observation and tracking programs"),
    ],
    "Department of State": [
        ("five_eyes", 0.30, "State Department diplomatic cables on international UAP incidents"),
    ],
}

# Decade-based boosting — shift relevance toward era-appropriate nodes
DECADE_BOOSTS: dict[str, list[tuple[str, float]]] = {
    "1940s": [("blue_book", 0.15), ("wright_patterson", 0.10), ("doe_aec", 0.08)],
    "1950s": [("blue_book", 0.15), ("wright_patterson", 0.10), ("doe_aec", 0.05)],
    "1960s": [("blue_book", 0.10), ("wright_patterson", 0.05)],
    "1970s": [("blue_book", 0.05)],
    "2000s": [("aaro", 0.05)],
    "2010s": [("aaro", 0.10)],
    "2020s": [("aaro", 0.20)],
}


# ---------------------------------------------------------------------------
# 4. Build the searchable text corpus for each document
# ---------------------------------------------------------------------------

def build_search_text(doc_summary: dict, doc_detail: dict) -> str:
    """Combine all text fields from a document for keyword searching."""
    parts = []
    for field in ("title", "description", "summary", "excerpt"):
        val = doc_summary.get(field, "") or doc_detail.get(field, "")
        if val:
            parts.append(val)
    full_text = doc_detail.get("full_text", "")
    if full_text:
        parts.append(full_text)
    # Entity values
    for ent in doc_detail.get("entities", []):
        parts.append(ent.get("entity_value", ""))
    # Sensor types
    for s in doc_detail.get("sensors", []):
        parts.append(s.get("sensor_type", ""))
    # Behavior types (can be plain strings or dicts)
    for b in doc_detail.get("behaviors", []):
        if isinstance(b, str):
            parts.append(b)
        elif isinstance(b, dict):
            parts.append(b.get("behavior_type", ""))
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 5. Score each document against every program node
# ---------------------------------------------------------------------------

def score_document(doc_summary: dict, doc_detail: dict) -> list[dict]:
    """
    Return a list of (node_id, weight, reason) for edges from this document.
    """
    text = build_search_text(doc_summary, doc_detail)
    text_lower = text.lower()

    agency = doc_summary.get("agency", "")
    decade = doc_summary.get("decade", "Unknown")
    has_redaction = bool(doc_summary.get("has_redaction", 0))

    # Redaction data
    redaction_info = doc_detail.get("redaction", [])
    redacted_pages = 0
    total_pages = doc_summary.get("total_pages", 0)
    if redaction_info and isinstance(redaction_info, list) and len(redaction_info) > 0:
        redacted_pages = redaction_info[0].get("redacted_pages", 0)
    heavily_redacted = (
        has_redaction and total_pages > 0 and redacted_pages >= total_pages * 0.5
    )

    # Accumulate scores per node
    scores: dict[str, float] = {}
    reasons: dict[str, list[str]] = {}

    def add_score(node_id: str, weight: float, reason: str):
        scores[node_id] = scores.get(node_id, 0.0) + weight
        if node_id not in reasons:
            reasons[node_id] = []
        if reason not in reasons[node_id]:
            reasons[node_id].append(reason)

    # --- Agency defaults ---
    if agency in AGENCY_DEFAULTS:
        for node_id, weight, reason in AGENCY_DEFAULTS[agency]:
            add_score(node_id, weight, reason)

    # --- Decade boosts ---
    if decade in DECADE_BOOSTS:
        for node_id, boost in DECADE_BOOSTS[decade]:
            era_reason = f"{decade} era document — relevant to {node_id.replace('_', ' ').title()}"
            add_score(node_id, boost, era_reason)

    # --- Keyword analysis ---
    for node_id, weight_per_hit, patterns in ALL_KEYWORD_RULES:
        hit_count = 0
        matched_terms = []
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                hit_count += len(matches)
                matched_terms.append(pattern.replace(r"\b", "").replace(r"\s*", " ").strip())
        if hit_count > 0:
            # Diminishing returns: first few hits count more
            effective_hits = min(hit_count, 8)
            # Log-scale to prevent huge docs from dominating
            weight = weight_per_hit * (1 + math.log2(effective_hits))
            # Cap individual keyword contribution
            weight = min(weight, 0.5)
            term_desc = ", ".join(matched_terms[:3])
            reason = f"Content mentions: {term_desc} ({hit_count} hits)"
            add_score(node_id, weight, reason)

    # --- Redaction boost ---
    if heavily_redacted:
        add_score("aea_1954", 0.15, "Heavily redacted — indicates active classification controls")
    elif has_redaction:
        add_score("aea_1954", 0.05, "Contains redactions — material subject to classification")

    # --- FBI-specific: historical FBI HQ files ---
    if agency == "FBI" and "HQ" in doc_summary.get("title", ""):
        add_score("blue_book", 0.08, "FBI HQ file — cross-referenced with USAF programs")
        add_score("wright_patterson", 0.05, "FBI HQ investigations often coordinated with Wright Field")

    # --- FBI Photo docs: minimal connections based on agency ---
    if agency == "FBI" and "Photo" in doc_summary.get("title", ""):
        add_score("aaro", 0.15, "FBI photographic evidence submitted to investigation pipeline")

    # --- NASA photo docs ---
    if agency == "NASA" and doc_summary.get("text_length", 0) == 0:
        desc = doc_summary.get("description", "").lower()
        if "apollo" in desc:
            add_score("nro", 0.15, "NASA Apollo mission photographic anomaly")
        if "skylab" in desc:
            add_score("nro", 0.15, "NASA Skylab observation")

    # --- DoW MISREP/mission reports: all connect to AARO pipeline ---
    if agency == "Department of War" and decade == "2020s":
        title_lower = doc_summary.get("title", "").lower()
        if "mission report" in title_lower or "misrep" in text_lower:
            add_score("aaro", 0.15, "Modern military MISREP filed through AARO reporting chain")

    # --- FVEY marking in text ---
    if "fvey" in text_lower or "rel to usa" in text_lower:
        add_score("five_eyes", 0.20, "Document marked REL TO USA, FVEY — Five Eyes distribution")

    # --- Filter and cap ---
    edges = []
    for node_id, raw_weight in scores.items():
        # Cap at 1.0
        weight = min(round(raw_weight, 2), 1.0)
        # Floor at 0.15 to avoid noise from weak matches
        if weight < 0.15:
            continue
        reason_text = "; ".join(reasons.get(node_id, [])[:3])
        edges.append({
            "node_id": node_id,
            "weight": weight,
            "reason": reason_text,
        })

    # Sort by weight descending
    edges.sort(key=lambda e: -e["weight"])

    # Limit: most docs should connect to 2-4 nodes; cap at 6 for richly-connected docs
    # But keep at least 1
    if len(edges) > 6:
        edges = edges[:6]

    return edges


# ---------------------------------------------------------------------------
# 6. Agency color mapping
# ---------------------------------------------------------------------------

AGENCY_COLORS = {
    "Department of War": "#3b82f6",
    "FBI": "#ef4444",
    "NASA": "#8b5cf6",
    "Department of State": "#10b981",
}


# ---------------------------------------------------------------------------
# 7. Main: load data, score, write output
# ---------------------------------------------------------------------------

def main():
    # Load documents.json
    with open(DATA_DIR / "documents.json") as f:
        documents = json.load(f)
    print(f"Loaded {len(documents)} documents from documents.json")

    # Build nodes list
    nodes = [HUB_NODE] + LAYER_NODES + ORG_NODES

    # Build document nodes and edges
    doc_edges = []
    doc_nodes = []

    connection_counts = []  # for stats

    for doc in documents:
        doc_id = doc["id"]

        # Load individual doc file for full text
        doc_path = DATA_DIR / f"doc_{doc_id}.json"
        doc_detail = {}
        if doc_path.exists():
            with open(doc_path) as f:
                doc_detail = json.load(f)

        # Score this document
        edges = score_document(doc, doc_detail)

        # Fallback: every doc must connect to at least one node
        if not edges:
            # Use agency default or generic surveillance
            agency = doc.get("agency", "")
            if agency == "Department of War":
                edges = [{"node_id": "aaro", "weight": 0.3, "reason": "Military document in UAP reporting chain"}]
            elif agency == "FBI":
                edges = [{"node_id": "aea_1954", "weight": 0.3, "reason": "FBI investigative record subject to classification"}]
            elif agency == "NASA":
                edges = [{"node_id": "nro", "weight": 0.3, "reason": "NASA observation potentially relevant to surveillance"}]
            elif agency == "Department of State":
                edges = [{"node_id": "five_eyes", "weight": 0.3, "reason": "State Department diplomatic communication"}]
            else:
                edges = [{"node_id": "aaro", "weight": 0.3, "reason": "UAP document in investigation pipeline"}]

        connection_counts.append(len(edges))

        # Create document node
        agency = doc.get("agency", "Unknown")
        doc_node = {
            "id": f"doc_{doc_id}",
            "label": doc.get("title", f"Document {doc_id}")[:80],
            "type": "document",
            "doc_id": doc_id,
            "agency": agency,
            "color": AGENCY_COLORS.get(agency, "#6b7280"),
            "size": 15,
            "decade": doc.get("decade", "Unknown"),
            "pages": doc.get("total_pages", 0),
            "has_redaction": bool(doc.get("has_redaction", 0)),
        }
        doc_nodes.append(doc_node)

        # Create document edges
        for edge in edges:
            doc_edges.append({
                "source": f"doc_{doc_id}",
                "target": edge["node_id"],
                "type": "document",
                "weight": edge["weight"],
                "reason": edge["reason"],
            })

    nodes += doc_nodes

    all_edges = STRUCTURE_EDGES + doc_edges

    # Stats
    avg_connections = sum(connection_counts) / len(connection_counts) if connection_counts else 0
    max_connections = max(connection_counts) if connection_counts else 0
    min_connections = min(connection_counts) if connection_counts else 0

    # Count docs per node
    node_doc_counts = {}
    for e in doc_edges:
        t = e["target"]
        node_doc_counts[t] = node_doc_counts.get(t, 0) + 1

    output = {
        "nodes": nodes,
        "edges": all_edges,
        "metadata": {
            "total_documents": len(documents),
            "total_connections": len(doc_edges),
            "total_structure_edges": len(STRUCTURE_EDGES),
            "layers": ["surveillance", "custodial", "industrial"],
            "avg_connections_per_doc": round(avg_connections, 1),
            "max_connections_per_doc": max_connections,
            "min_connections_per_doc": min_connections,
            "docs_per_node": node_doc_counts,
        },
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {OUTPUT_PATH}")
    print(f"  Nodes: {len(nodes)} ({len(doc_nodes)} documents + {len(nodes) - len(doc_nodes)} structure)")
    print(f"  Edges: {len(all_edges)} ({len(doc_edges)} document + {len(STRUCTURE_EDGES)} structure)")
    print(f"  Connections per doc: min={min_connections}, avg={avg_connections:.1f}, max={max_connections}")
    print(f"\n  Docs per program node:")
    for node_id in sorted(node_doc_counts.keys()):
        print(f"    {node_id}: {node_doc_counts[node_id]} docs")


if __name__ == "__main__":
    main()
