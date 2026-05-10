# OCR Quality Analysis Pipeline

## What It Is

`analyze_ocr_quality.py` classifies the content type, scan quality, and OCR accuracy of every page in the corpus using Claude's vision capabilities. It sends each page image alongside its extracted OCR text to Claude (haiku by default), which compares what it sees against what OCR captured.

### Per-page output fields

| Field | Values |
|-------|--------|
| `content_types` | typewritten, typeset, handwritten, form, photograph, diagram, table, cover_page, redacted, blank, mixed |
| `source_medium` | scan_photocopy, scan_original, scan_microfilm, digital_native, photograph_of_doc |
| `scan_quality` | excellent, good, fair, poor, illegible |
| `ocr_accuracy` | accurate, mostly_accurate, partial, garbled, empty, not_applicable |
| `ocr_artifacts` | skew, noise, bleed_through, faded, stamps_marks, cut_off, warped, dark_scan, light_scan |
| `text_coverage_pct` | 0–100 (estimated % of visible text captured by OCR) |
| `notes` | Free-text one-liner describing what Claude sees |

### Per-document summary (auto-computed)

- Dominant content type, source medium, scan quality, OCR accuracy
- Average quality score (1–5 scale)
- Average text coverage %
- Distribution counts for all fields

---

## Current Status

**74 of 129 documents completed** (as of 2026-05-10).

Remaining: docs 20–55 (mostly small DoW mission reports, 2–10 pages each) and doc 121 (partially processed, was on page 218/290 when stopped).

The run was started with `--sample 999` (all pages) and `--model haiku`. The 74 completed docs include all FBI photos, NASA docs, and the large FBI HQ sections 1–10 (docs 112–120).

---

## How to Run

### Resume (incremental, skips already-cached docs)

```bash
python3 analyze_ocr_quality.py --sample 999 --model haiku 2>&1 | tee -a ocr_quality_run.log
```

### Analyze a single doc

```bash
python3 analyze_ocr_quality.py --doc 67 --model haiku
```

### Force re-analyze (overwrite cache)

```bash
python3 analyze_ocr_quality.py --doc 67 --force --model haiku
```

### Quick run (sample 8 pages per doc instead of all)

```bash
python3 analyze_ocr_quality.py --sample 8 --model haiku
```

### Background run

```bash
nohup python3 analyze_ocr_quality.py --sample 999 --model haiku \
  > ocr_quality_run.log 2>&1 &
```

---

## Monitoring

### Check if running

```bash
ps aux | grep analyze_ocr | grep -v grep
```

### See latest progress

```bash
tail -5 ocr_quality_run.log
```

### Count completed docs

```bash
ls data/ocr_quality/doc_*.json | wc -l
```

### Check last file written

```bash
stat -f '%Sm %N' data/ocr_quality/*.json | sort | tail -3
```

---

## Output Files

| Path | Description |
|------|-------------|
| `data/ocr_quality/doc_{id}.json` | Per-document cache (page-level results + summary) |
| `website/public/data/ocr_quality.json` | Merged corpus output (written at end of run) |

The merged output is only written when the pipeline finishes. To get an interim merge of whatever's cached so far:

```python
python3 -c "
from analyze_ocr_quality import merge_results
import json
docs = json.loads(open('website/public/data/documents.json').read())
merge_results(sorted(d['id'] for d in docs))
"
```

---

## Understanding the Results

### Quality tiers

- **High** (score ≥ 4.0): Good scans, OCR is reliable. Quotes from these docs are trustworthy.
- **Medium** (3.0–3.9): Readable but OCR has gaps. Key findings should be verified against page images.
- **Low** (< 3.0): Significant OCR failures. Consider re-OCR with `ocrmypdf --force-ocr`.

### Key metrics by agency (from 74 docs analyzed)

| Agency | Docs | Avg Quality | Avg Coverage |
|--------|------|-------------|--------------|
| Dept. of State | 3 | 4.22 | 94.5% |
| NASA | 7 | 4.07 | 88.1% |
| Dept. of War | 25 | 4.02 | 74.3% |
| FBI | 39 | 3.18 | 20.1% |

FBI scores are dragged down by 24 single-page photo docs (no text expected) and microfilm-source historical files.

### Re-OCR candidates

Docs where scan quality is good but OCR captured little:

| Doc | Pages | Issue | Action |
|-----|-------|-------|--------|
| 112 | 185 | 37% coverage, 55 empty pages | `ocrmypdf --force-ocr` |
| 16 | 5 | 4/5 pages empty | re-OCR |
| 109 | 2 | 1/2 pages empty | re-OCR |

Docs 67 and 114 were already re-OCR'd on 2026-05-10 with good results (109K and 156K chars extracted).

### Content type breakdown (2,608 pages analyzed)

- 57% scan_photocopy, 27% scan_original, 15% microfilm
- 64% good quality, 24% fair, 11% poor
- 37% mostly_accurate OCR, 24% partial, 23% empty, 13% garbled, 3% accurate

---

## Cost

Uses Claude Haiku with vision. At ~$0.001/page, the full 129-doc corpus (~4,000 pages) costs approximately $4. The `--sample 8` default costs ~$1 for the full corpus.
