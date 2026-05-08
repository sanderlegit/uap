# UAP Document Explorer — Development Guide

## Tech Stack
- React 18 + Vite 8 + Tailwind CSS v4 (`@theme` CSS variables in index.css)
- React Router v6 with HashRouter (static hosting compatibility)
- Code splitting: all pages use React.lazy() + Suspense
- FlexSearch for client-side full-text search
- Leaflet + react-leaflet for maps (CartoDB dark tiles)
- Cytoscape.js for network graph visualization
- ReactMarkdown for analysis reports

## Architecture
- Data: static JSON files in `website/public/data/`, fetched client-side
- Hooks: `src/hooks/useData.js` — central caching layer, all hooks return null while loading
- Pages: `src/pages/*.jsx` — lazy-loaded, self-contained
- Pipeline: `export_data.py` exports SQLite → JSON

## Hosting
- Tailscale network: machine `enge` at 100.111.185.11
- Vite preview server on port 4173 with `allowedHosts: ['enge']`
- Build: `cd website && npm run build && npm run preview`

## Conventions
- Dark theme (slate-950 bg), intelligence-briefing aesthetic
- Agency colors: DoW=#3b82f6, FBI=#ef4444, NASA=#8b5cf6, DoS=#10b981
- Animations: requestAnimationFrame for counters, CSS transitions for reveals
- Mobile-first, responsive breakpoints at sm/md/lg
- No external API calls at runtime — all data baked into JSON files

## Development Workflow
- Use subagents for research tasks (web search, data gathering)
- Parallel agent orchestration for independent work streams
- Always rebuild and verify before pushing: `npm run build`
- Preview on Tailscale: `npx vite preview --host 0.0.0.0 --port 4173`

## UI Patterns (User Preferences)
- Card-expand pattern preferred (collapsed summary → click to expand detail)
- Horizontal scroll for timelines (not vertical)
- Hover tooltips for dense information
- Interactive visualizations (org charts, family trees)
- Small thumbnail images for key events
- Keep stubs for future async features (news, social monitoring)
