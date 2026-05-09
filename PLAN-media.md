# UAP Document Explorer — Media Enhancement Plan

## Current State

- 129 documents, 114 local PDFs (2.3GB total), 14 local images (15MB)
- Documents range from 20KB to 353MB; median 600KB; 22 PDFs are >20MB
- 4,044 total pages across all documents (avg 31 pages/doc, range 0–290)
- manifest.json already has `modal_image` thumbnail URLs from war.gov for 133/145 records
- 14 local image files: 8 FBI photos (PNG, ~90KB each) + 6 NASA Apollo photos (JPG, ~2.5MB each, 4400x4600)
- Text is extracted and stored per-page (split on `--- PAGE BREAK ---` delimiters)
- Current PDF viewer: iframe embedding war.gov URL, hidden by default, toggle to show
- No local thumbnails, no page-level images, no compressed PDFs served from app

## Goals

1. **Thumbnails everywhere** — every document card, search result, timeline chip, map popup, and related-doc link shows a visual preview of the document's first page
2. **Page-by-page inline reading** — DocumentDetail shows each page as a rendered image alongside (or instead of) extracted text, scrollable naturally, no iframe
3. **Compressed PDFs** — lightweight versions served locally for fast browsing, with link to original war.gov source
4. **Image gallery for non-PDF records** — FBI photos and NASA images shown properly with zoom

---

## Phase 1: Asset Pipeline (Python Build Scripts)

### 1A. Thumbnail Generation

**Goal:** Generate a small cover image for every PDF, plus thumbnails for image records.

**Script:** `build_thumbnails.py`

**Dependencies:** `PyMuPDF` (fitz) — already used in extract_text.py

**Work:**
- For each PDF in `ufo-files/pdfs/`:
  - Render page 1 at 1.5x zoom (~612x792 → ~918x1188 px)
  - Export as JPEG quality 80 → `website/public/data/thumbnails/{doc_id}_cover.jpg` (target: 30-80KB each)
  - Also render a smaller card thumbnail at 0.5x zoom (~306x396 px) → `{doc_id}_thumb.jpg` (target: 5-15KB each)
- For each image in `ufo-files/images/`:
  - Resize to same card thumbnail dimensions → `{doc_id}_thumb.jpg`
  - Copy/resize for cover → `{doc_id}_cover.jpg`
- Map document IDs to filenames using `documents.json` + `manifest.json`
- Output a `thumbnails_manifest.json` mapping `doc_id → { thumb, cover, width, height, page_count }`
- Total estimated size: ~129 covers × 50KB + 129 thumbs × 10KB ≈ **8MB**

**Thumbnail naming:**
```
website/public/data/thumbnails/
  0_thumb.jpg      (306×396, ~10KB — for cards/lists)
  0_cover.jpg      (918×1188, ~50KB — for document header)
  0_p1.jpg         (page images, see 1B)
  0_p2.jpg
  ...
```

### 1B. Page Image Rendering

**Goal:** Render every page of every PDF as a browseable image for inline reading.

**Script:** `build_page_images.py`

**Dependencies:** `PyMuPDF` (fitz)

**Work:**
- For each PDF, for each page:
  - Render at 1.5x zoom → JPEG quality 75
  - Save as `website/public/data/pages/{doc_id}_p{page_num}.jpg`
  - Target: 40-120KB per page depending on content density
- Skip pages that are blank (< 1KB rendered)
- Generate `page_manifest.json`:
  ```json
  {
    "0": { "page_count": 6, "pages": [
      { "page": 1, "file": "0_p1.jpg", "width": 918, "height": 1188, "size_kb": 67 },
      ...
    ]},
    ...
  }
  ```
- Total estimated size: 4,044 pages × ~70KB avg = **~280MB**
- This is large — see 1C for lazy loading strategy and 1D for optional WebP

**Handling large documents (>50 pages):**
- 19 documents have 50+ pages (some up to 290)
- Render all pages but only serve on demand (lazy load by page number)
- Consider lower quality (65) for documents with >100 pages

### 1C. Compressed PDF Generation

**Goal:** Create lightweight PDFs for local serving, fast download, offline reading.

**Script:** `build_compressed_pdfs.py`

**Dependencies:** `PyMuPDF` (fitz), `pikepdf` or `ghostscript`

**Work:**
- For each PDF in `ufo-files/pdfs/`:
  - Ghostscript compress to screen quality: `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen`
  - Target: 10-20% of original size
  - Save to `website/public/data/pdfs/{doc_id}.pdf`
- For the 22 PDFs over 20MB, apply aggressive compression (`/ebook` setting)
- Skip the 3 mega-PDFs (>200MB) — for those, page images are the primary experience
- Generate `pdf_manifest.json`: `{ doc_id: { file, size_kb, original_size_kb, compression_ratio } }`
- Total estimated size: ~200-400MB compressed (down from 2.3GB)
- **Alternative:** Skip compressed PDFs entirely and rely on page images + original war.gov link. This saves hosting bandwidth significantly. Decision point for the user.

### 1D. WebP Conversion (Optional Optimization)

**Goal:** Convert all generated JPEGs to WebP for 30-40% smaller file sizes.

**Dependencies:** `Pillow` or `cwebp` CLI

**Work:**
- Convert all thumbnail and page images to WebP with quality 80
- Use `<picture>` element with JPEG fallback in React components
- Reduces total page images from ~280MB to ~170MB
- Reduces thumbnails from ~8MB to ~5MB

---

## Phase 2: Data Layer Updates

### 2A. Document JSON Updates

**Files:** `export_data.py`, `website/public/data/documents.json`, `website/public/data/doc_{id}.json`

**Work:**
- Add to each document record:
  ```json
  {
    "thumb_url": "/data/thumbnails/0_thumb.jpg",
    "cover_url": "/data/thumbnails/0_cover.jpg",
    "has_page_images": true,
    "compressed_pdf_url": "/data/pdfs/0.pdf",
    "compressed_pdf_size_kb": 245,
    "original_pdf_url": "https://www.war.gov/medialink/ufo/release_1/...",
    "modal_image_url": "https://www.war.gov/medialink/ufo/release_1/thumbnail/..."
  }
  ```
- `documents.json` (lightweight index) gets `thumb_url` only (keeps it small)
- `doc_{id}.json` (full detail) gets all fields

### 2B. Hook Updates

**File:** `website/src/hooks/useData.js`

**Work:**
- Add `usePageImages(docId)` hook — fetches page manifest and returns page image URLs for a document
- Lazy: only fetches the manifest once, returns URLs by page number
- Add `useThumbnail(docId)` helper — returns thumb_url from cached documents data
- Add `useCompressedPdf(docId)` helper — returns compressed PDF URL + size

---

## Phase 3: Frontend — Thumbnails Everywhere

### 3A. Document Card Thumbnails

**File:** `website/src/pages/Documents.jsx` (grid view of all docs)

**Current:** Text-only cards with agency badge, title, date, excerpt
**New:** Each card leads with a thumbnail image

```
┌─────────────────────────────┐
│ ┌──────┐                    │
│ │thumb │  Title...          │
│ │      │  DoW · May 2022    │
│ │      │  Iraq · 6 pages    │
│ └──────┘                    │
│ "Hook text excerpt..."      │
└─────────────────────────────┘
```

- Thumbnail on the left (80×103px, aspect-ratio preserved)
- Lazy loading: `loading="lazy"` on `<img>`
- Fallback: current PDF icon box if thumbnail missing
- On mobile: thumbnail above text (full card width, shorter height)

### 3B. Search Result Thumbnails

**File:** `website/src/pages/Search.jsx`

**Work:**
- Add small thumbnail (48×62px) to left of each search result
- Same lazy loading + fallback pattern

### 3C. Timeline Thumbnails

**File:** `website/src/pages/Timeline.jsx`

**Work:**
- When a timeline chip is clicked and the preview panel opens, show the document cover image
- Optional: show tiny thumbnails (32×41px) on the chips themselves (may be too dense)

### 3D. Map Popup Thumbnails

**File:** `website/src/pages/MapView.jsx`

**Work:**
- In the Leaflet popup for each marker, show the cover thumbnail above the document title
- Keep popup size manageable (max 200px wide image)

### 3E. Related Document Thumbnails

**File:** `website/src/pages/DocumentDetail.jsx` (Related Documents section)

**Work:**
- Each related document link gets a small thumbnail (40×52px) next to the title
- Also: Cases.jsx, Dashboard.jsx top-10 carousel — add thumbnails

### 3F. Dashboard Hero Cards

**File:** `website/src/pages/Dashboard.jsx`

**Work:**
- Top documents carousel: show cover images instead of/alongside text
- Investigation cards: show a representative document thumbnail
- Overall visual impact: the dashboard goes from all-text to image-rich

---

## Phase 4: Frontend — Inline Page-by-Page Reader

### 4A. PageReader Component

**File:** `website/src/components/PageReader.jsx` (new)

**Goal:** Replace the iframe PDF viewer and raw text dump with a native page-by-page reading experience.

**Design:**
```
┌─ Page 1 of 6 ────────────────────────────── [< prev] [next >] [⬇ PDF] ─┐
│                                                                          │
│  ┌────────────────────────────────────┐                                  │
│  │                                    │                                  │
│  │     [Page image rendered as        │                                  │
│  │      a naturally sized image       │                                  │
│  │      within the document flow]     │                                  │
│  │                                    │                                  │
│  │                                    │                                  │
│  └────────────────────────────────────┘                                  │
│                                                                          │
│  ┌─ Extracted Text (expandable) ──────┐                                  │
│  │ "The following report describes..." │                                  │
│  └────────────────────────────────────┘                                  │
│                                                                          │
│  ── page 2 ───────────────────────────                                   │
│                                                                          │
│  ┌────────────────────────────────────┐                                  │
│  │     [Page 2 image]                 │                                  │
│  └────────────────────────────────────┘                                  │
│                                                                          │
│  ┌─ Extracted Text ───────────────────┐                                  │
│  │ "Continued observations..."         │                                  │
│  └────────────────────────────────────┘                                  │
│                                                                          │
│  ... (scroll continues for all pages)                                    │
└──────────────────────────────────────────────────────────────────────────┘

[Open original on war.gov ↗]  [Download compressed PDF ⬇]
```

**Behavior:**
- All pages render in a single scrollable column (natural document flow)
- Each page: image on top, extracted text below (collapsed by default, expand to show)
- Page images lazy-load as user scrolls (IntersectionObserver)
- Sticky page indicator at top: "Page 3 of 6" updates as user scrolls
- Redacted pages highlighted with a subtle red border/overlay
- Link to original war.gov PDF always visible at top and bottom
- Link to download compressed PDF (if available)

**Props:**
```jsx
<PageReader
  docId={numId}
  pageCount={doc.total_pages}
  pages={pages}           // extracted text array (existing)
  redactedPages={redactedPageNumbers}
  originalUrl={manifestEntry?.url}
  compressedUrl={doc.compressed_pdf_url}
/>
```

### 4B. Integrate PageReader into DocumentDetail

**File:** `website/src/pages/DocumentDetail.jsx`

**Work:**
- Remove `PDFViewer` component (iframe embed)
- Remove the separate "Extracted Text" section at the bottom
- Replace both with `<PageReader>` placed after Key Findings
- The PageReader combines page images + text, so both old sections merge into one
- Keep "Open on war.gov ↗" link prominent (top of PageReader and in header)
- For documents without page images (generation failed, or image-type records), fall back to text-only display

### 4C. Page-Level Deep Linking

**File:** `website/src/pages/DocumentDetail.jsx`

**Work:**
- URL param `?page=3` scrolls to that page on load
- Each page has an anchor `#page-3`
- Search results can link directly to the relevant page: `/documents/42?page=7`
- Cross-reference links from other documents can point to specific pages

### 4D. Image Zoom/Lightbox

**File:** `website/src/components/PageReader.jsx`

**Work:**
- Click on any page image to zoom to full resolution
- Simple lightbox overlay (no external dependency needed)
- Arrow keys / swipe to navigate between pages in lightbox mode
- Useful for reading heavily scanned/handwritten documents

### 4E. Image Record Gallery

**File:** `website/src/pages/DocumentDetail.jsx`

**Work:**
- For the 14 image-type records (FBI photos, NASA Apollo), display as a proper image gallery
- Grid of images with click-to-zoom
- FBI photos: 8 images in a 2×4 or 4×2 grid
- NASA photos: 6 high-res Apollo mission images with zoom

---

## Phase 5: Performance & Loading

### 5A. Progressive Loading Strategy

**Work:**
- **Thumbnails (cards/lists):** Load immediately with `loading="lazy"`, small enough to be fast
- **Cover images (detail header):** Load on detail page mount, show skeleton placeholder
- **Page images:** IntersectionObserver — only load when within 2 viewport heights of visible area
- **Compressed PDFs:** Download button only, not preloaded
- **Blur-up technique:** Inline a tiny (16×20px) base64 thumbnail in the JSON data, display as blurred placeholder while real image loads

### 5B. Image Error Handling

**Work:**
- If a page image fails to load (404, network error): show the extracted text for that page instead
- If a thumbnail fails: show the existing PDF icon fallback
- `onError` handler on all `<img>` tags with graceful degradation

### 5C. Cache Headers

**File:** `website/vite.config.js`

**Work:**
- Static assets in `/data/thumbnails/` and `/data/pages/` should have long cache headers
- Content-hashed filenames for cache busting (or add `?v=` param from manifest)
- Vite preview server: configure `headers` option for `/data/` paths

---

## Build Pipeline Integration

### New npm scripts

```json
{
  "scripts": {
    "build:thumbnails": "python3 ../build_thumbnails.py",
    "build:pages": "python3 ../build_page_images.py",
    "build:pdfs": "python3 ../build_compressed_pdfs.py",
    "build:media": "npm run build:thumbnails && npm run build:pages && npm run build:pdfs",
    "build:all": "npm run build:media && npm run build"
  }
}
```

### Build order

```
build_thumbnails.py          ──┐
build_page_images.py         ──┤── independent, can run in parallel
build_compressed_pdfs.py     ──┘
         │
         ▼
export_data.py (updated)     ── reads generated manifests, adds URLs to doc JSON
         │
         ▼
npm run build                ── Vite bundles the React app (media files are static)
```

### .gitignore additions

```
website/public/data/thumbnails/
website/public/data/pages/
website/public/data/pdfs/
```

These are generated artifacts — regenerated from source PDFs on any build machine.

---

## Estimated Output Sizes

| Asset | Count | Est. Size | Notes |
|-------|-------|-----------|-------|
| Card thumbnails | 129 | ~1.3MB | 306×396, JPEG q80, ~10KB each |
| Cover images | 129 | ~6.5MB | 918×1188, JPEG q80, ~50KB each |
| Page images | ~4,044 | ~280MB | 918×1188, JPEG q75, ~70KB each |
| Compressed PDFs | ~110 | ~300MB | Skip 3 mega-PDFs |
| Page images (WebP) | ~4,044 | ~170MB | If WebP conversion enabled |
| **Total (JPEG)** | | **~588MB** | |
| **Total (WebP)** | | **~478MB** | |

The page images are the big item. Options to reduce:
- Lower resolution (1.0x instead of 1.5x): cuts to ~125MB
- WebP only (drop JPEG fallback): ~170MB
- On-demand rendering server-side (eliminates pre-generation but requires backend)

---

## Implementation Order

```
Phase 1A (thumbnails)        ── start here, immediate visual impact
Phase 3A-3F (thumbnails UI)  ── wire thumbnails into all pages
Phase 1B (page images)       ── big render job, run overnight
Phase 4A-4B (PageReader)     ── core reading experience
Phase 1C (compressed PDFs)   ── optional, adds download capability
Phase 4C-4D (deep link/zoom) ── polish
Phase 5A-5C (performance)    ── optimize loading
Phase 1D (WebP)              ── optional optimization pass
Phase 4E (image gallery)     ── for non-PDF records
```

Thumbnails (Phase 1A + 3) can ship independently as a quick win. Page images (Phase 1B + 4) is the larger effort but transforms the reading experience.

---

## Decision Points for Discussion

1. **Page image resolution:** 1.5x zoom (~918px wide) vs 1.0x (~612px wide) vs 2.0x (~1224px wide). Higher = sharper scanned text but larger files.
2. **Compressed PDFs:** Worth the ~300MB storage? Or rely on page images + war.gov link?
3. **WebP:** Worth the build complexity for 30-40% savings? Browser support is universal now.
4. **Text alongside images:** Show extracted text collapsed under each page image? Or hide it entirely (just use for search indexing)?
5. **Pre-render all pages vs. on-demand:** Pre-rendering is simpler (static files) but ~280MB. An on-demand approach needs a backend image service.
