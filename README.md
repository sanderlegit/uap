# UAP Document Explorer

A weekend project that got out of hand.

The US government released 145 declassified UAP files. I wanted to read them, discovered they
were scanned PDFs of varying quality with no index, no cross-references, and no way to tell
which document was talking about which incident. Then I made the classic mistake of thinking
"I'll just build a small tool for this."

It is not a small tool.

## What it does

Takes a pile of unstructured government documents and turns them into something you can
actually explore: full-text and OCR search, a relationship graph, a timeline, a map, an entity
index, and per-claim evidence tracking so you can see *which document* supports *which
assertion* rather than taking anyone's word for it.

Everything is pre-generated and served as static files. No backend, no API keys, no runtime
inference. You can host the whole thing on a potato.

## How it's built

**Pipeline.** ~30 Python `build_*.py` / `validate_*.py` scripts, driven by a Makefile that
handles the dependency ordering. Evidence registry, source registry, OCR quality scoring,
cross-document consistency checks, and a release gate (`make check-strict`) that refuses to
ship if the corpus contradicts itself.

**Frontend.** React 19, Vite, Tailwind, Leaflet for the map, Cytoscape for the graph,
FlexSearch for client-side search. Hash routing and lazy-loaded pages so it works from a
static host.

**Storage.** SQLite for the build-time queries, JSON for everything the browser touches.

## Should you believe any of this?

The documents are real and public. The extraction is best-effort over scanned material of
wildly varying quality, so treat every extracted claim as "a machine's reading of a blurry
fax." That is exactly why the evidence registry exists. Every claim links back to its source
document, and you can go look.

I make no argument about aliens. I do have opinions about OCR.

## Status

Built over about nine days in May 2026 and then left alone. It works. It is not maintained.

## Licence

Documents are US government public domain. The code is MIT.
