# Makefile — Build data products in dependency order.
#
# Usage:
#   make all          Rebuild everything that's stale (timestamp-based)
#   make corpus       Rebuild corpus-derived products only
#   make pulse        Run pulse pipeline (collect + analyze + export)
#   make thumbnails   Rebuild thumbnail images
#   make pages        Rebuild page-level images
#   make narratives   Re-run document annotation (costs ~$0.50 via Claude)
#   make site         Build the Vite frontend
#   make check        Validate all data files exist and curated files are fresh
#   make clean        Remove generated JSON (keeps curated files and databases)
#   make graph        Print the dependency DAG as ASCII

PYTHON   := python3
DATA     := website/public/data
DB       := incidents_v2.db
STATS    := summary_stats_v2.json
UFO_MAN  := ufo-files/manifest.json
CORPUS   := ufo-files/corpus
PDFS     := ufo-files/pdfs
IMAGES   := ufo-files/images

# Deep-dive markdown sources
MD_FBI   := fbi_deep_dive.md
MD_APOL  := apollo_deep_dive.md
MD_REDAC := redaction_analysis.md
MD_HIGH  := high_interest_cases.md
MD_RPT   := analysis_report_v2.md

# Doc IDs 0-128
DOC_IDS  := $(shell seq 0 128)
DOC_JSON := $(addprefix $(DATA)/doc_,$(addsuffix .json,$(DOC_IDS)))

.PHONY: all corpus pulse thumbnails pages narratives site check clean graph status

# ─── Top-level targets ────────────────────────────────────────────────

all: corpus $(DATA)/entities.json $(DATA)/thumbnails/manifest.json \
     $(DATA)/legacy_web.json $(DATA)/pulse.json site

corpus: $(DATA)/documents.json $(DOC_JSON) $(DATA)/graph.json \
        $(DATA)/stats.json $(DATA)/manifest.json $(DATA)/search_index.json \
        $(DATA)/report.json $(DATA)/fbi.json $(DATA)/apollo.json \
        $(DATA)/redactions.json $(DATA)/high_interest.json

# ─── Layer 1: Core export (DB → JSON) ────────────────────────────────

$(DATA)/documents.json $(DATA)/graph.json $(DATA)/stats.json \
$(DATA)/manifest.json $(DATA)/search_index.json \
$(DATA)/report.json $(DATA)/fbi.json $(DATA)/apollo.json \
$(DATA)/redactions.json $(DATA)/high_interest.json \
$(DOC_JSON) &: $(DB) $(STATS) $(UFO_MAN) export_data.py \
               $(MD_FBI) $(MD_APOL) $(MD_REDAC) $(MD_HIGH) $(MD_RPT)
	$(PYTHON) export_data.py

# ─── Layer 2: Derived from documents.json ─────────────────────────────

$(DATA)/entities.json: $(DATA)/documents.json build_entities.py
	$(PYTHON) build_entities.py

$(DATA)/thumbnails/manifest.json: $(DATA)/documents.json build_thumbnails.py
	$(PYTHON) build_thumbnails.py

$(DATA)/pages/manifest.json: $(DATA)/documents.json build_page_images.py
	$(PYTHON) build_page_images.py

$(DATA)/legacy_web.json: $(DATA)/documents.json build_legacy_web.py
	$(PYTHON) build_legacy_web.py
	$(PYTHON) materialize_pipeline.py
	@touch $(DATA)/legacy_web.json

# ─── Layer 2: Annotation (Claude API — explicit target only) ─────────

narratives: $(DATA)/documents.json annotate_documents.py
	$(PYTHON) annotate_documents.py
	$(PYTHON) materialize_pipeline.py
	@touch $(DATA)/doc_narratives.json

# ─── Layer 3: Pulse pipeline ─────────────────────────────────────────

pulse: $(DATA)/entities.json $(DATA)/documents.json
	$(PYTHON) -m pulse run --limit 50

$(DATA)/pulse.json: pulse.db $(DATA)/entities.json $(DATA)/documents.json pulse/export.py
	$(PYTHON) -m pulse export

# ─── Thumbnails / Pages (explicit targets) ────────────────────────────

thumbnails: $(DATA)/thumbnails/manifest.json

pages: $(DATA)/pages/manifest.json

# ─── Frontend build ──────────────────────────────────────────────────

site: $(DATA)/documents.json
	cd website && npm run build

# ─── Validation ──────────────────────────────────────────────────────

check:
	$(PYTHON) check_data.py

status:
	@echo "=== Pipeline versions ==="
	@$(PYTHON) materialize_pipeline.py --status
	@echo ""
	@echo "=== Data freshness ==="
	@$(PYTHON) check_data.py --summary

# ─── Dependency graph (ASCII) ────────────────────────────────────────

graph:
	@echo ""
	@echo "  incidents_v2.db ──┬── export_data.py ──→ documents.json  (+ doc_N, graph, stats, manifest, search_index)"
	@echo "  summary_stats_v2 ─┘                      │  │  │  │"
	@echo "  *.md deep-dives ──── export_data.py ──→ report/fbi/apollo/redactions/high_interest.json"
	@echo "                                            │  │  │  │"
	@echo "                           ┌────────────────┘  │  │  └──────────────────┐"
	@echo "                           ↓                   ↓  ↓                     ↓"
	@echo "                    build_entities.py   build_thumbnails.py    build_legacy_web.py"
	@echo "                           ↓            build_page_images.py           ↓"
	@echo "                     entities.json             ↓               legacy_web.json"
	@echo "                           │            thumbnails/ pages/"
	@echo "                           │"
	@echo "  pulse.db (collectors) ───┴── pulse/export.py ──→ pulse.json"
	@echo "                                                     ↓"
	@echo "                                              pulse_data/*.ndjson"
	@echo ""
	@echo "  ── Curated (no script) ──"
	@echo "  theories.json  cases.json  international.json  disclosure_index.json"
	@echo "  vocabulary.json  doc_vocab_scores.json  research.json  investigations.json"
	@echo "  legacy_program.json"
	@echo ""
	@echo "  ── Annotation (Claude API, run explicitly) ──"
	@echo "  documents.json ──→ annotate_documents.py ──→ doc_narratives.json"
	@echo "  documents.json ──→ analyze_ocr_quality.py ──→ ocr_quality.json"
	@echo ""

# ─── Clean (only generated files — never curated) ────────────────────

clean:
	rm -f $(DATA)/documents.json $(DOC_JSON)
	rm -f $(DATA)/graph.json $(DATA)/stats.json $(DATA)/manifest.json
	rm -f $(DATA)/search_index.json
	rm -f $(DATA)/report.json $(DATA)/fbi.json $(DATA)/apollo.json
	rm -f $(DATA)/redactions.json $(DATA)/high_interest.json
	rm -f $(DATA)/entities.json
	rm -f $(DATA)/pulse.json
	@echo "Cleaned generated files. Curated files and databases untouched."
