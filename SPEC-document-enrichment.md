# Document Enrichment Pipeline & Graph Redesign

## Overview

Three interconnected improvements to the UAP Document Explorer:

1. **Claude-powered document annotation pipeline** — replace hallucinated narratives with grounded, per-document analysis
2. **Legacy Program context in DocumentDetail** — show each document's framework connections with explanations
3. **Dual-graph redesign** — split into document network (main) + Legacy Program tree (sidebar)
4. **Searchable text overlay on pages** — positioned text layer over page images for Ctrl+F and selection

---

## 1. Claude Document Annotation Pipeline

### Problem
Current `doc_narratives.json` was generated in a single batch pass. FBI Section files all share the same templated narrative claiming "2,600 pages across all sections" — hallucinated details not grounded in actual document content. 40 docs have zero text (photos), 17 are 100K+ chars.

### Solution: `annotate_documents.py`

Per-document `claude -p` calls with structured JSON output. Each call receives:
- Document metadata (title, agency, date, location, pages, redaction info)
- Extracted text (first 15K chars for large docs, full text for small ones)
- Entity/sensor/behavior/shape data already extracted
- Manifest description from war.gov (if available)

**Prompt template asks for:**
```json
{
  "hook": "1-2 sentence summary of what this document is",
  "why_it_matters": "2-3 sentences on significance, grounded in content",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "document_type": "mission_report|investigation|memo|photo|cable|analysis|other",
  "legacy_program_connections": [
    {
      "node_id": "aaro",
      "relevance": "high|medium|low",
      "reasoning": "why this document relates to this program node"
    }
  ],
  "related_topics": ["keyword1", "keyword2"]
}
```

**Execution strategy:**
- Use `claude -p` with `--output-format json` for each doc
- Sequential with 1s delay between calls (avoid rate limits)
- Cache results: skip docs that already have annotations (incremental runs)
- For zero-text docs (photos): provide only metadata + manifest description
- For huge docs (>15K chars): provide first 8K + last 4K + metadata
- Write individual JSON files: `data/annotations/doc_{id}.json`
- Final merge step: combine into `doc_narratives.json`

**Cost estimate:** ~129 calls, ~2K-15K input tokens each, ~500 output tokens = ~$2-5 total.

### Output files
- `website/public/data/doc_narratives.json` — merged annotations (replaces current)
- `data/annotations/doc_{id}.json` — individual cached results (not deployed)

---

## 2. Legacy Program Context in DocumentDetail

### Current state
DocumentDetail shows "Related Documents" (content similarity) but nothing about Legacy Program connections. The connection data with reasons exists in `legacy_web.json` but isn't surfaced.

### Implementation
Add a "Legacy Program Context" section in `DocumentDetail.jsx` between Key Findings and PageReader:

- Fetch `legacy_web.json` (add to useData hooks or fetch inline)
- Filter edges where `source === "doc_" + id`
- Look up target node info (label, layer, color, description)
- Display as weight bars color-coded by layer
- Parse semicolon-separated reason strings into bullet points
- If Claude annotations include `legacy_program_connections`, prefer those explanations

### Visual design
```
┌─────────────────────────────────────────────────────┐
│  LEGACY PROGRAM CONTEXT                              │
│                                                      │
│  ██████████░░░  AARO / UAPTF              1.00      │
│  Surveillance · Military reporting chain,            │
│  2020s era, content mentions: aaro (10 hits)         │
│                                                      │
│  ████████░░░░░  Atomic Energy Act 1954    0.55      │
│  Custodial · Contains redactions, classification     │
│                                                      │
│  [View in Network Graph →]                           │
└─────────────────────────────────────────────────────┘
```

---

## 3. Dual-Graph Redesign

### Current state
Single Cytoscape concentric graph with hub/layer/org/document nodes. Doc-to-doc edges hidden behind a toggle. Structure dominates the visual.

### New design: two coordinated panels

**Left panel (75% width) — Document Network:**
- Cytoscape graph with ONLY the 129 document nodes
- Edges from `graph.json`: content_similarity (solid), same_case (dashed), media_pairing (dotted)
- Force-directed layout (`cose`) so related docs cluster naturally
- Node size: mapped to connection count
- Node color: agency colors
- Labels shown on hover/click
- Click to select: show detail panel, highlight Legacy Program connections in right panel
- Hover: temporarily highlight connected org nodes in right panel

**Right panel (25% width) — Legacy Program Tree:**
- HTML/React tree, NOT Cytoscape — stable, no layout churn
- Collapsible: Hub → Layers → Orgs
- Each org shows document count badge
- Click org: filter left graph to show only documents connected to that org
- Click layer: filter to all docs in that layer
- Multi-select: Shift+click for multiple org filter
- Visual feedback: org nodes glow when hovered doc connects to them
- "Show all" resets filters

**Shared state:**
- `selectedDoc` — clicked document (persistent until cleared)
- `hoveredDoc` — hovered document (temporary)
- `selectedOrgs` — set of org IDs selected in tree
- `selectedLayer` — active layer filter
- URL params for deep linking: `?doc=42&org=aaro&layer=surveillance`

**Mobile:** Tree collapses to a drawer/bottom sheet.

---

## 4. Searchable Text Overlay on Pages

### Current state
Pages render as JPEG images. OCR text available via "show text" toggle as a block of text below the image. No text selection or Ctrl+F on the page image.

### Pipeline: `extract_text_positions.py`
- Use PyMuPDF `page.get_text("dict")` for native-text PDFs
- Extract text blocks with bounding boxes
- Normalize coordinates to 0-1 range (relative to page dimensions)
- Output: `website/public/data/page_text/doc_{id}_p{num}.json`
- Structure per page:
```json
{
  "width": 612, "height": 792,
  "blocks": [
    { "text": "UNCLASSIFIED", "x": 0.35, "y": 0.02, "w": 0.30, "h": 0.02, "size": 12 }
  ]
}
```
- For OCR-only docs: skip positioned text (bounding boxes unreliable)
- Total size estimate: ~800KB for all pages across 129 docs

### Frontend: PageReader.jsx changes
- Lazy-load page text JSON when page image becomes visible
- Render positioned text overlay (`position: absolute; inset: 0`) on top of image
- Each text block as a `<span>` with percentage-based positioning
- `color: transparent; user-select: text` — invisible but selectable
- `::selection { background: rgba(59, 130, 246, 0.3) }` — blue highlight on select
- Browser Ctrl+F works naturally since text is in the DOM
- Keep existing "show text" toggle as readable fallback for OCR docs

---

## Implementation Order

1. **Annotation pipeline** (`annotate_documents.py`) — run first since output feeds into #2
2. **Legacy Program Context section** — uses annotation data + legacy_web.json
3. **Dual-graph redesign** — largest UI change, independent of #1-2
4. **Text overlay** — pipeline + frontend, fully independent

## File changes

### New files
- `annotate_documents.py` — Claude annotation pipeline
- `extract_text_positions.py` — positioned text extraction
- `website/src/components/LegacyTree.jsx` — Legacy Program sidebar tree
- `website/src/components/DocGraph.jsx` — Document network Cytoscape graph

### Modified files
- `website/src/pages/DocumentDetail.jsx` — add Legacy Program Context section
- `website/src/pages/LegacyWeb.jsx` — rewrite to dual-panel layout
- `website/src/components/PageReader.jsx` — add text overlay layer
- `website/src/hooks/useData.js` — add useLegacyWeb hook
- `website/public/data/doc_narratives.json` — regenerated from pipeline
