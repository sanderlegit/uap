# UAP Document Explorer — Implementation Plan

## Current State

React 18 + Vite 8 + Tailwind v4 app with 13 pages, 129 documents, static JSON data pipeline.
Hosted on Tailscale machine `enge` (100.111.185.11:4173). No backend API.

**Core problem:** The app reads as a collection of disconnected views (timeline, graph, map, search, documents) rather than an investigation tool with narrative drive. Users land on the Dashboard and have no guided path from curiosity to understanding.

---

## Phase 1: Navigation & Narrative Foundation (Frontend Only)

### 1A. Curated Investigation Pathways on Dashboard

**Goal:** Replace the generic "Explore" cards with narrative-driven entry points that answer "what should I look at first?"

**Files:** `src/pages/Dashboard.jsx`, `public/data/investigations.json` (new)

**Work:**
- Create `investigations.json` at build time (or hand-curated) with 4-5 featured investigation threads:
  - "The Nimitz Encounter (2004)" — links to docs 64, related cases, graph cluster
  - "Apollo Astronaut Sightings" — links to docs 103, 50, 55, timeline 1960s
  - "FBI's Flying Disc Files (1947-1952)" — links to FBI-filtered documents, analysis/fbi
  - "The Redaction Pattern" — links to analysis/redactions, most-redacted docs
  - "Congressional Disclosure Arc" — links to disclosure index, recent cases
- Each investigation has: title, hook (1 sentence), entry_doc_id, related_doc_ids[], view_links[] (which pages to visit), icon
- Dashboard renders these as hero cards above the existing content
- Each card links to its entry document with a `?investigation=nimitz` param that enables a guided sidebar on DocumentDetail

### 1B. URL State Persistence

**Goal:** Every view's filter/selection state reflected in URL params so views are bookmarkable, shareable, and preserved across navigation.

**Files:** `src/pages/Search.jsx`, `src/pages/MapView.jsx`, `src/pages/Timeline.jsx`, `src/pages/GraphView.jsx`, `src/pages/Cases.jsx`, `src/pages/Theories.jsx`, `src/pages/International.jsx`

**Work per page:**

| Page | Params to add |
|------|--------------|
| Search | `?q=radar&agency=DoW,FBI&decade=1950s,1960s` |
| MapView | `?lat=33&lng=-117&zoom=8&doc=42` |
| Timeline | `?decade=1960s&doc=103` |
| GraphView | `?node=103&agency=FBI&decade=1950s` |
| Cases | `?category=military_encounter&sort=year_desc` |
| Theories | `?sort=popularity` |
| International | `?status=active` |

- Use `useSearchParams()` (already used in Documents.jsx — follow that pattern)
- Initialize component state from URL params on mount
- Update URL params on filter change (replace, not push, to avoid back-button spam)
- Documents.jsx already does this correctly — replicate that pattern

### 1C. Cross-View Filter Handoff

**Goal:** When navigating from one filtered view to another, carry active filters forward.

**Files:** `src/components/Layout.jsx`, `src/hooks/useFilters.js` (new)

**Work:**
- Create `useFilters()` hook that reads/writes shared filter state from URL params
- When user clicks "View on Timeline" from a document filtered to FBI/1950s, the Timeline link includes `?agency=FBI&decade=1950s`
- Add a persistent filter chip bar in Layout.jsx (below breadcrumbs, above page content) showing active filters with clear buttons
- Filter chip bar only renders when filters are active
- Each page's "Explore in X" links pass current filters as URL params

### 1D. Related Items Panels on All Detail/Insight Pages

**Goal:** Every page that shows a single item (document, case, theory) also shows contextual "what's related" with clickable links.

**Files:** `src/pages/Cases.jsx`, `src/pages/Theories.jsx`, `src/pages/International.jsx`, `src/pages/DisclosureIndex.jsx`

**Work:**
- **Cases.jsx:** Each expanded case card shows related PURSUE documents as clickable links (already has CASE_DOC_IDS). Add: "View on Graph" link centered on related docs, "View on Timeline" link filtered to case's decade, related theories.
- **Theories.jsx:** Each expanded theory shows which cases support it (cross-reference cases.json), link to relevant analysis sections.
- **International.jsx:** Each country card links to cases/documents from that region (filter by location coordinates).
- **DisclosureIndex.jsx:** Each milestone links to the document(s) or case(s) it references.

### 1E. Entity Index

**Goal:** Create an entity-centric view so users can investigate by person, organization, or location — not just by document.

**Files:** `public/data/entities.json` (new, generated), `src/pages/Entities.jsx` (new), `src/main.jsx`, `src/components/Layout.jsx`

**Work:**
- **Data generation** (Python script or addition to `export_data.py`): Scan all 129 `doc_*.json` files, aggregate entities by `entity_value`. Output:
  ```json
  [
    {
      "name": "AIR FORCE",
      "type": "organization",
      "doc_ids": [0, 3, 7, 12, ...],
      "doc_count": 34,
      "agencies": ["Department of War", "FBI"],
      "decades": ["1940s", "1950s", "2020s"]
    }
  ]
  ```
- **Entities.jsx page:** Searchable, filterable list of entities. Click an entity → shows all documents mentioning it, with links to view those docs on the graph/timeline/map.
- Add route `/entities` to main.jsx
- Add "Entities" to Layout.jsx nav (in the Insights dropdown)
- On DocumentDetail.jsx, make entity mentions clickable → link to `/entities?name=AIR+FORCE`

---

## Phase 2: Agent Backend (Claude Code SDK)

### 2A. Backend Server Setup

**Goal:** Node.js server wrapping the Claude Code Agents SDK, serving SSE-streamed responses to the React frontend.

**Files:** `server/` directory (new)

**Stack:**
- Node.js 18+ with Express
- `@anthropic-ai/claude-code` SDK (TypeScript)
- Auth: Claude Code subscription (reads `~/.claude/` credentials in dev), `ANTHROPIC_API_KEY` env var in production
- Runs on `enge` alongside the Vite preview server

**Directory structure:**
```
server/
  package.json
  src/
    index.ts          — Express server, SSE endpoint
    agent.ts          — Claude Code SDK query() wrapper
    tools/
      documents.ts    — search_documents, get_document tools
      graph.ts        — find_related, get_connections tools
      cases.ts        — search_cases, get_case tools
      timeline.ts     — search_timeline tool
      entities.ts     — search_entities tool
    data/
      loader.ts       — loads and caches JSON data files at startup
```

**Work:**
- `npm init` in server/, install `@anthropic-ai/claude-code`, `express`, `cors`
- `loader.ts`: On startup, read all JSON files from `../website/public/data/` into memory (documents.json, graph.json, cases.json, research.json, entities.json, doc_narratives.json, search_index.json). ~2MB total — trivially fits in memory.
- `index.ts`: Express server on port 3001 with:
  - `POST /api/chat` — accepts `{ message: string, sessionId?: string }`, returns SSE stream
  - `GET /api/health` — health check
  - CORS configured for `http://localhost:5173` (dev) and `http://enge:4173` (preview)

### 2B. MCP Tools Over JSON Data

**Goal:** Define tools the agent can call to query the dataset, so Claude can answer questions by searching real data rather than hallucinating.

**Files:** `server/src/tools/*.ts`

**Tools:**

| Tool | Input | Output | Data source |
|------|-------|--------|-------------|
| `search_documents` | `query: string, agency?: string, decade?: string, limit?: number` | Array of document summaries with id, title, agency, date, location, excerpt | documents.json + search_index.json |
| `get_document` | `id: number` | Full document with text, entities, redactions, cross_refs, narrative | doc_{id}.json + doc_narratives.json |
| `find_related` | `docId: number, maxDepth?: number` | Related documents via graph edges with relationship type and weight | graph.json |
| `search_cases` | `category?: string, query?: string` | Matching cases with evidence types, key figures, related doc IDs | cases.json |
| `search_entities` | `name: string, type?: string` | Entity with all document IDs, agencies, decades | entities.json |
| `search_timeline` | `startYear?: number, endYear?: number, agency?: string` | Documents in date range with incident details | documents.json filtered |
| `get_stats` | none | Dataset overview: total docs, agencies, decades, redaction counts | stats.json |
| `get_research_correlations` | `topic?: string` | Thematic correlations with related docs and sources | research.json |

**System prompt** for the agent:
```
You are an investigative research assistant for the PURSUE UAP Document Explorer.
You help users explore 129 declassified government documents about unidentified
aerial phenomena. Use your tools to search the actual dataset — never fabricate
document contents or entity names. When answering, cite specific document IDs
(e.g., "Document #103: Apollo 11 Crew Debriefing") so users can navigate to them.
Suggest follow-up questions to guide deeper investigation.
```

### 2C. SSE Streaming to Frontend

**Goal:** Stream agent events to the React frontend in real time — user sees thinking, tool calls, and answer as they happen.

**Files:** `server/src/index.ts`, `server/src/agent.ts`

**Event format** (sent as SSE `data:` lines):
```json
{"type": "thinking", "content": "Searching for documents about the Nimitz encounter..."}
{"type": "tool_call", "tool": "search_documents", "input": {"query": "Nimitz", "limit": 5}}
{"type": "tool_result", "tool": "search_documents", "summary": "Found 3 documents"}
{"type": "text", "content": "I found three documents related to the Nimitz encounter..."}
{"type": "suggestion", "questions": ["What radar data was collected?", "Who were the pilots?"]}
{"type": "done"}
```

**Work:**
- `agent.ts`: Wraps `query()` from the SDK. Iterates the async iterator, maps each message type to an SSE event type, yields them.
- `index.ts`: The `/api/chat` handler sets `Content-Type: text/event-stream`, pipes agent events as `data: {json}\n\n` lines.
- Handle client disconnect (req.on('close')) to abort the agent query.
- Session management: store conversation history keyed by sessionId. Pass prior messages as context on resume.

### 2D. Vite Proxy Configuration

**Goal:** Frontend calls `/api/chat` which proxies to the backend server, avoiding CORS complexity.

**Files:** `website/vite.config.js`

**Work:**
- Add proxy rule: `/api` → `http://localhost:3001`
- For production preview: reverse proxy or same-origin setup on `enge`

---

## Phase 3: Chat UI (Frontend)

### 3A. Chat Panel Component

**Goal:** Slide-out chat panel accessible from any page, with streaming message display.

**Files:** `src/components/ChatPanel.jsx` (new), `src/components/Layout.jsx`, `src/hooks/useChat.js` (new)

**Design:**
- Floating action button (bottom-right) with a chat icon — present on all pages
- Click opens a slide-out panel (right side, 400px wide on desktop, full-screen on mobile)
- Panel contains: message history, streaming response area, input field, suggestion chips
- Dark theme matching app aesthetic (slate-900 bg, blue-400 accent)
- Messages render markdown (reuse react-markdown already in deps)

**Work:**
- `useChat.js` hook:
  - Manages message history state: `[{ role: 'user'|'assistant', content: string, toolCalls?: [] }]`
  - `sendMessage(text)`: POSTs to `/api/chat`, opens EventSource, processes SSE events
  - Streaming: appends text chunks to current assistant message as they arrive
  - Tool call events: renders as collapsible "Searching documents..." cards
  - Suggestion events: renders as clickable chips below the response
  - Session ID management: generates UUID on first message, persists across turns
  - Error handling: retry with exponential backoff, show error message in chat

- `ChatPanel.jsx`:
  - Renders message list with auto-scroll to bottom
  - Input field with send button and Enter-to-send
  - Typing indicator while streaming
  - Suggestion chips rendered below last assistant message
  - "Clear conversation" button in header
  - Document references in responses rendered as clickable links → navigate to `/documents/:id`

### 3B. Contextual Chat Awareness

**Goal:** The chat knows which page the user is on and what they're looking at, enabling questions like "tell me more about this document."

**Files:** `src/hooks/useChat.js`, `src/components/ChatPanel.jsx`

**Work:**
- Pass current route + active document/case/entity to the chat context
- When user is on `/documents/103`, the system message includes: "The user is currently viewing Document #103: Apollo 11 Crew Debriefing"
- When user is on `/cases` filtered to military encounters, include: "The user is browsing military encounter cases"
- This context is prepended to the user's message before sending to the backend
- Backend passes it as part of the prompt to the agent

### 3C. Response-to-Navigation Links

**Goal:** When the agent mentions a document, case, or entity, render it as a clickable link that navigates within the app.

**Files:** `src/components/ChatPanel.jsx`

**Work:**
- Post-process assistant messages: detect patterns like "Document #103" or "doc_103" and replace with `<Link to="/documents/103">Document #103</Link>`
- Detect entity mentions and link to `/entities?name=X`
- Detect case references and link to `/cases?highlight=X`
- Agent system prompt instructs it to use consistent reference formats

---

## Phase 4: Investigation Breadcrumbs & "What Next?"

### 4A. Exploration Trail

**Goal:** A session-level breadcrumb showing recently visited documents/cases, enabling quick backtracking.

**Files:** `src/hooks/useExplorationTrail.js` (new), `src/components/Layout.jsx`

**Work:**
- `useExplorationTrail()` hook: maintains a list of recently visited items in sessionStorage
  - `{ type: 'document'|'case'|'entity', id, title, timestamp }`
  - Max 20 items, deduplicated, most recent first
- Render as a horizontal pill bar below the breadcrumbs (only when items exist)
- Each pill is clickable → navigates to that item
- "Clear trail" button at the end

### 4B. Graph-Driven "What Next?" Suggestions

**Goal:** On document detail and case pages, highlight bridge documents that connect otherwise separate clusters.

**Files:** `src/pages/DocumentDetail.jsx`, `public/data/graph.json` (add centrality scores at export time)

**Work:**
- In `export_data.py`: compute betweenness centrality for each node in the document graph, add `centrality` field to graph.json nodes
- On DocumentDetail, the "Related Documents" section sorts by centrality descending and badges the top result as "Key Connection"
- Tooltip explains: "This document connects the X cluster to the Y cluster"
- On Cases page, show "Explore Related Investigations" section using graph traversal from case's doc IDs

### 4C. Follow-Up Suggestions in Chat

**Goal:** After every agent response, suggest 2-3 follow-up questions.

**Files:** `server/src/agent.ts` system prompt

**Work:**
- System prompt instructs agent: "After answering, suggest 2-3 follow-up questions the user might want to ask. Format them as a JSON array in a `<suggestions>` tag."
- Backend parses suggestions from response, emits as separate SSE event type
- Frontend renders as clickable chips below the response
- Clicking a suggestion sends it as the next user message

---

## Phase 5: Data Pipeline Enhancements

### 5A. Entity Aggregation Script

**Goal:** Generate `entities.json` from individual document files.

**Files:** `export_data.py` or new `build_entities.py`

**Work:**
- Read all `doc_*.json` files
- Aggregate entities by normalized name (uppercase, trim)
- Deduplicate similar names (e.g., "AIR FORCE" vs "U.S. AIR FORCE" — fuzzy match)
- Output `entities.json` with: name, type, doc_ids[], doc_count, agencies[], decades[]
- Add to build pipeline

### 5B. Graph Centrality Computation

**Goal:** Add centrality scores to graph.json for "what next?" suggestions.

**Files:** `export_data.py` or new `build_graph_metrics.py`

**Work:**
- Load graph.json, build NetworkX graph
- Compute betweenness centrality per node
- Compute community detection (Louvain) for cluster labels
- Add `centrality` and `community` fields to each node
- Re-export graph.json

### 5C. Investigation Pathways Data

**Goal:** Generate or curate `investigations.json` for Dashboard entry points.

**Files:** `public/data/investigations.json` (new, hand-curated with data support)

**Work:**
- Curate 4-5 investigation threads with human-written hooks
- For each: identify entry document, related doc IDs, relevant views, narrative arc
- Can be partially automated (find clusters in graph, pick highest-centrality entry point) but narratives should be hand-written

---

## Implementation Order

```
Phase 1B (URL state)          ──┐
Phase 1C (filter handoff)     ──┤── can start immediately, parallel
Phase 5A (entity aggregation) ──┘

Phase 1E (entity page)        ── depends on 5A

Phase 1A (investigation paths) ─┐
Phase 1D (related panels)      ─┤── can start after 1B/1C patterns established
Phase 5C (investigations data) ─┘

Phase 2A (backend setup)      ──┐
Phase 2B (MCP tools)          ──┤── can start immediately, parallel to Phase 1
Phase 2C (SSE streaming)      ──┘
Phase 2D (Vite proxy)         ── trivial, depends on 2A

Phase 3A (chat panel)         ── depends on 2C
Phase 3B (contextual awareness) ── depends on 3A
Phase 3C (response links)     ── depends on 3A

Phase 4A (exploration trail)  ── depends on 1B
Phase 4B (graph suggestions)  ── depends on 5B
Phase 4C (follow-up suggestions) ── depends on 3A

Phase 5B (graph centrality)   ── can start anytime
```

## Deployment

- Dev: `npm run dev` (Vite on 5173) + `node server/dist/index.js` (Express on 3001) + Vite proxy
- Preview: `npm run build && npm run preview` on `enge:4173`, backend on `enge:3001`
- Production: swap auth to `ANTHROPIC_API_KEY`, same architecture, pay-as-you-go billing
