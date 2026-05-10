# Theories Page Redesign — Legacy Program Content Overhaul

## Problem Statement

The Theories page (`/#/theories`) has three issues:

1. **Too much clicking on desktop.** The Legacy Program Interactive Framework and all theory cards use click-to-expand accordions. On desktop screens with plenty of real estate, this hides all the interesting content behind clicks. Users see labels and have to guess which ones are worth expanding.

2. **No actionable links from the framework.** Facilities (Area 51, Wright-Patterson, Sandia Labs) and organizations (NRO, CIA, Lockheed) in the Legacy Program chart are descriptive text with no links to the Map, Documents, or Entities views. There's no way to go from "Wright-Patterson AFB" → see it on the map or find related documents.

3. **Hardcoded data with no pipeline.** The Legacy Program framework is hardcoded as `CHART_DATA` in `LegacyProgramChart.jsx` (~100 lines of inline JSON). There's no distillation pipeline from source material (UAP Gerb transcripts, congressional testimony, AARO reports) to structured data. Adding new sources or cross-referencing with our 129-document corpus requires manual code edits.

---

## Phase 1: Desktop Expand-by-Default (UI)

### Changes to `LegacyProgramChart.jsx`

- Replace `useState(null)` single-expand with `useState(new Set())` multi-expand
- On mount, detect `lg` breakpoint (1024px+) via `matchMedia`
- If desktop: initialize Set with all node names (everything expanded)
- If mobile: initialize empty Set (everything collapsed, tap to expand)
- Toggle function adds/removes from Set instead of swapping a single value
- Keep the expand/collapse chevron — users can still collapse sections they've read

### Changes to `Theories.jsx`

- On desktop (`lg+`): expand all theory cards by default
- Change `expandedTheory` from single string to Set, same pattern as above
- On mobile: keep current single-accordion behavior

### Visual treatment

- When expanded by default, remove the "click for details" affordance on desktop
- Keep the colored left border and section structure
- Add a subtle "Collapse All / Expand All" toggle at the top of the framework

---

## Phase 2: Facility & Entity Links

### Facility coordinates

Add lat/lng to every facility in the data:

| Facility | Lat | Lng | Zoom |
|---|---|---|---|
| NRO HQ (Chantilly, VA) | 38.924 | -77.444 | 14 |
| Sandia Labs (Albuquerque, NM) | 35.042 | -106.545 | 13 |
| Los Alamos (NM) | 35.881 | -106.299 | 13 |
| Oak Ridge (TN) | 35.931 | -84.310 | 13 |
| Area 51 / S4 (NV) | 37.235 | -115.811 | 13 |
| Tonopah Test Range (NV) | 38.069 | -116.784 | 12 |
| Wright-Patterson AFB (OH) | 39.826 | -84.048 | 13 |
| Dugway Proving Ground (UT) | 40.199 | -112.936 | 11 |

### Link types

For each facility, render inline icon links:
- **Map pin** → `/map?lat=X&lng=Y&zoom=Z` (fly to location)
- **Doc search** → `/search?q=FACILITY_NAME` (find related documents)

For each organization node (NRO, CIA, Lockheed, etc.):
- **Entity link** → `/entities?q=ORG_NAME` (entity page filtered)
- **Doc search** → `/search?q=ORG_NAME`

For personnel:
- **Search** → `/search?q=PERSON_NAME`

### Implementation

- Add `lat`, `lng`, `zoom` fields to facility objects in the data
- Add `searchTerm` field to org/personnel nodes for linking
- Render `<Link>` components from react-router-dom (not `<a>`) for internal navigation
- Small inline icons: map pin (◎), document (◫), entity (▣) — consistent with nav bar icons

---

## Phase 3: Extract Data to JSON Pipeline

### Step 1: Move CHART_DATA to `legacy_program.json`

- Extract the `CHART_DATA` object from `LegacyProgramChart.jsx` to `website/public/data/legacy_program.json`
- Add facility coordinates and link metadata
- Component fetches JSON at mount time, shows skeleton while loading
- This is the foundation for the automated pipeline

### Step 2: Build distillation pipeline (future)

```
Source Material (transcripts, testimony, reports)
    ↓ store in ufo-files/corpus/legacy/
    ↓ extract_legacy_claims.py (LLM-assisted claim extraction)
    ↓ claims.json (org, claim, evidence, source_url, timestamp)
    ↓ cross_reference_legacy.py (match claims → corpus documents + entities)
    ↓ legacy_program.json (enriched framework with doc links & provenance)
```

### Step 3: Source comparison (future)

Cross-reference claims across multiple sources:
- **UAP Gerb** — YouTube channel, Medium articles, podcast appearances
- **David Grusch** — Congressional testimony (July 2023), IG complaint
- **AARO Historical Reports** — Vol. 1 (Feb 2024), Vol. 2 (Mar 2024)
- **Michael Shellenberger** — Investigative reporting, FOIA results
- **Christopher Sharp / Liberation Times** — FOIA documents, whistleblower interviews
- **Congressional hearings** — Burchett, Rounds, Gillibrand committee sessions
- **George Knapp / Jeremy Corbell** — Investigation footage, FOIA results

Each claim in the framework would track:
- Which sources support it
- Confidence level (single source vs. corroborated)
- Links to supporting documents in our corpus

---

## Implementation Order

| Step | Scope | Commit |
|---|---|---|
| 1 | Desktop expand-by-default for LegacyProgramChart | `theories: expand framework by default on desktop` |
| 2 | Desktop expand-by-default for TheoryCards | same commit |
| 3 | Add facility coordinates + map/doc links | `theories: add facility map links and entity cross-references` |
| 4 | Extract CHART_DATA to legacy_program.json | `theories: extract legacy program data to JSON pipeline` |
| 5 | Build + verify on enge | no commit needed |

Phase 3 Steps 2-3 (distillation pipeline, source comparison) are future work tracked here for reference but not implemented in this pass.
