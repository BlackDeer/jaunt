# Jaunt ✈️

Turn a rough plan into a **mobile-first, swipeable card presentation** — served free as a static site on GitHub Pages.

One deck = one plan (a trip, a guys' weekend, an event). Swipe between cards, scroll within a card for detail, tap an image for a fullscreen gallery. Each stop gets a map link and a photo.

## Use it

- **All decks:** `https://<user>.github.io/jaunt/`
- **A deck:** `https://<user>.github.io/jaunt/?p=<slug>`
- **Sample:** `?p=sample-chicago`

## Make a new deck

This repo is built to be driven by Claude Code. Open it and say:

> Build a Jaunt for this plan: …(paste your plan)…

Claude checks the plan for gaps/contradictions, finds a map link + image for every place, and writes a `data/<slug>.json` file. See [`CLAUDE.md`](./CLAUDE.md) for the data schema and workflow.

To do it by hand: copy `data/sample-chicago.json`, edit it, and add an entry to `data/index.json`.

## Develop locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/?p=sample-chicago
```

## How it's built

Vanilla HTML/CSS/JS, **no build step, no dependencies**. A single renderer (`index.html`, `app.css`, `app.js`) reads a per-deck JSON file. Images and videos are **links/embeds only** — nothing is hosted here.
