#!/usr/bin/env python3
"""Export SQLite + corpus + manifest data to JSON for the web frontend."""

import json
import os
import sqlite3
import re

BASE_DIR = "/Users/sander/dev/illuminate/uap"
DB_PATH = os.path.join(BASE_DIR, "incidents_v2.db")
CORPUS_DIR = os.path.join(BASE_DIR, "ufo-files", "corpus")
MANIFEST_PATH = os.path.join(BASE_DIR, "ufo-files", "manifest.json")
OUT_DIR = os.path.join(BASE_DIR, "website", "public", "data")

os.makedirs(OUT_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row


def query(sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


# 1. Documents with all related data
docs = query("SELECT * FROM documents")
for doc in docs:
    did = doc["id"]
    doc["sensors"] = query("SELECT sensor_type, mention_count FROM sensors WHERE document_id=?", (did,))
    doc["behaviors"] = [r["behavior"] for r in query("SELECT behavior FROM behaviors WHERE document_id=?", (did,))]
    doc["witnesses"] = [r["witness_type"] for r in query("SELECT witness_type FROM witnesses WHERE document_id=?", (did,))]
    doc["entities"] = query("SELECT entity_type, entity_value FROM entities WHERE document_id=?", (did,))
    doc["shapes"] = query("SELECT shape, mention_count FROM object_descriptions WHERE document_id=?", (did,))
    doc["redaction"] = query("SELECT redacted_pages, black_rect_count, black_area_pct FROM redactions WHERE document_id=?", (did,))
    doc["cross_refs"] = [r["reference"] for r in query("SELECT reference FROM cross_references WHERE document_id=?", (did,))]

    # Load corpus text (truncated for list view, full for detail)
    fname = doc["filename"]
    if fname:
        txt_name = re.sub(r'\.pdf$', '.txt', fname, flags=re.IGNORECASE)
        txt_path = os.path.join(CORPUS_DIR, txt_name)
        if os.path.exists(txt_path):
            with open(txt_path, encoding="utf-8", errors="replace") as f:
                full_text = f.read()
            doc["full_text"] = full_text
            doc["excerpt"] = full_text[:500].strip()
        else:
            doc["full_text"] = ""
            doc["excerpt"] = ""
    else:
        doc["full_text"] = ""
        doc["excerpt"] = ""

# Write individual doc files (full text) and a lightweight index
doc_index = []
for doc in docs:
    full_text = doc.pop("full_text")
    doc_index.append(doc)

    detail = {**doc, "full_text": full_text}
    with open(os.path.join(OUT_DIR, f"doc_{doc['id']}.json"), "w") as f:
        json.dump(detail, f, ensure_ascii=False)

with open(os.path.join(OUT_DIR, "documents.json"), "w") as f:
    json.dump(doc_index, f, ensure_ascii=False)

print(f"Exported {len(docs)} documents")

# 2. Graph edges
edges = query("SELECT source_id, target_id, weight, edge_type FROM graph_edges")
with open(os.path.join(OUT_DIR, "graph.json"), "w") as f:
    json.dump({"nodes": [{"id": d["id"], "label": d["title"][:60], "agency": d["agency"],
                           "lat": d["latitude"], "lng": d["longitude"],
                           "decade": d["decade"], "connections": len(d.get("cross_refs", []))}
                          for d in doc_index],
               "edges": edges}, f, ensure_ascii=False)
print(f"Exported {len(edges)} graph edges")

# 3. Summary stats
with open(os.path.join(BASE_DIR, "summary_stats_v2.json")) as f:
    stats = json.load(f)
with open(os.path.join(OUT_DIR, "stats.json"), "w") as f:
    json.dump(stats, f, ensure_ascii=False)

# 4. Manifest (for original URLs and descriptions)
with open(MANIFEST_PATH) as f:
    manifest = json.load(f)
manifest_lookup = {}
for rec in manifest.get("records", []):
    fname = rec.get("filename", "")
    manifest_lookup[fname] = {
        "url": rec.get("url", ""),
        "description": rec.get("description", ""),
        "release_date": rec.get("release_date", ""),
        "incident_date": rec.get("incident_date", ""),
        "dvids_id": rec.get("dvids_id", ""),
        "category": rec.get("category", ""),
    }
with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
    json.dump(manifest_lookup, f, ensure_ascii=False)
print(f"Exported manifest for {len(manifest_lookup)} files")

# 5. Search index - lightweight text for client-side search
search_index = []
for doc in docs:
    fname = doc["filename"]
    txt_name = re.sub(r'\.pdf$', '.txt', fname, flags=re.IGNORECASE) if fname else ""
    txt_path = os.path.join(CORPUS_DIR, txt_name)
    text = ""
    if txt_name and os.path.exists(txt_path):
        with open(txt_path, encoding="utf-8", errors="replace") as f:
            text = f.read()
    search_index.append({
        "id": doc["id"],
        "title": doc["title"],
        "agency": doc["agency"],
        "text": text[:10000],  # first 10K chars for search
        "location": doc["incident_location"] or "",
        "date": doc["incident_date_parsed"] or "",
        "decade": doc["decade"] or "",
    })
with open(os.path.join(OUT_DIR, "search_index.json"), "w") as f:
    json.dump(search_index, f, ensure_ascii=False)
print(f"Exported search index ({len(search_index)} docs)")

# 6. Deep dive reports as JSON
for md_file, key in [
    ("fbi_deep_dive.md", "fbi"),
    ("apollo_deep_dive.md", "apollo"),
    ("redaction_analysis.md", "redactions"),
    ("high_interest_cases.md", "high_interest"),
    ("analysis_report_v2.md", "report"),
]:
    md_path = os.path.join(BASE_DIR, md_file)
    if os.path.exists(md_path):
        with open(md_path, encoding="utf-8") as f:
            content = f.read()
        with open(os.path.join(OUT_DIR, f"{key}.json"), "w") as f:
            json.dump({"content": content}, f, ensure_ascii=False)
        print(f"Exported {key} report")

conn.close()
print("Done!")
