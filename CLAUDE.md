# Jaunt — repo guide for Claude

**Jaunt** turns a rough plan (a trip, a guys' weekend, an event) into a **mobile-first, swipeable card presentation** served as a static site on GitHub Pages. One deck = one plan. Roughly one card per stop/event.

The user pastes a plan and says *"build a Jaunt for this."* Your job is to (1) sanity-check the plan, (2) enrich every place/event with a real map link + image, and (3) emit a `data/<slug>.json` file. The shared renderer does the rest — **you never write HTML/CSS/JS per deck.**

## How it works (architecture)

- **Shared renderer:** `index.html` + `app.css` + `app.js` (vanilla, zero dependencies, no build step).
- **One deck = one data file:** `data/<slug>.json`, viewed at `…/jaunt/?p=<slug>`.
- **Landing page:** `…/jaunt/` lists every deck from `data/index.json`.
- **No hosted assets.** Images/videos are **links/embeds only** (Wikimedia, official sites, Unsplash, YouTube, Google Maps). Never download or commit binary media.
- **Author-time enrichment.** Resolve all map links and image URLs *now*, at generation time, and bake them into the JSON. The page fetches nothing live (no API keys, no CORS).

## Design language ("Boarding Pass")

The shared skin (`app.css` + `app.js`) styles **every** deck as a *boarding pass*: a warm bone card ("the pass") on a dark aviation-ink background, with monospace gate/time codes, a rubber-stamp accent, and a barcode. You never style decks yourself — but author the JSON to play to it:

- **Palette is fixed in the renderer.** Ink background `#0c1016`, bone pass `#f1e9da`, ink text `#1c1a16`. Only `theme.accent` (and, rarely, `theme.bg`) are yours to set per deck.
- **Type** is Space Grotesk (titles) + IBM Plex Mono (labels/times/codes), loaded by the stylesheet — nothing to do.
- **Each card is a pass:** matted photo up top, then `kicker` → gate label, `title`, `summary`, `location` as a "field" row, `sections`, `links`. The cover automatically gets a derived "N STOPS" stamp + barcode + "SWIPE TO BOARD".
- **Photos carry the whole look.** The matted frame makes imagery central, so give **every** card a real, well-cropped, roughly-landscape `image`. A missing or ugly photo is the fastest way to break the aesthetic — this matters more here than in a plainer theme.
- **`kicker`** becomes a short uppercase mono gate label (`DAY 1 · THU`). **`time`** becomes a compact boxed mono tag (`12:00 PM`, not a range). Keep both terse so they don't wrap.

### Accent
`theme.accent` colours the stamp, gate label, link pills, progress bar, and map pin — over **both** bone and ink. Pick a **saturated mid-tone** hue that reads on both: a confident red, orange, teal, blue, or green. Avoid pale pastels, near-whites, and very dark colours. Default when unset: `#cf3f2c` (stamp red).

## UX model (locked decisions)

- **Between cards:** horizontal swipe / tap-edges / arrow keys (Stories/Tinder model).
- **Within a card:** vertical scroll for overflow content.
- **Multiple images:** hero image + a `images[]` gallery → tap opens a fullscreen swipeable lightbox (deck-swipe is disabled while open, so no gesture conflict).
- **Lots of detail:** use expandable `sections[]` (accordions). **Overflow rule:** if a single card would have **more than 6 sections** OR **any one section body exceeds ~700 characters**, split it into sub-cards (`Day 1 · Stop 3 (1/2)`, `(2/2)`). Keep every card glanceable.

## Data schema (`data/<slug>.json`)

```jsonc
{
  "schema": 1,
  "slug": "kebab-case-unique",       // must match the filename
  "title": "Hawaii Family Trip",
  "subtitle": "June 2026 · 7 days",
  "theme": { "accent": "#0ea5e9", "bg": "#0b0b0f" },   // optional
  "cards": [
    {
      "id": "cover",
      "type": "cover",               // "cover" (first card) | "stop" | "info"
      "kicker": "Day 1 · Thursday",  // small uppercase label
      "time": "12:00 PM",            // optional, shown next to kicker
      "title": "Movie @ AMC River North",
      "subtitle": "...",             // optional
      "summary": "One-line hook.",   // optional
      "image": { "url": "https://…", "alt": "…", "credit": "…" },
      "images": [                    // optional extra gallery images
        { "url": "https://…", "alt": "…" }
      ],
      "location": {
        "name": "AMC River North 21",
        "address": "322 E Illinois St, Chicago, IL 60611",
        "mapsUrl": "https://www.google.com/maps/search/?api=1&query=AMC%20River%20North%2021%20Chicago"
      },
      "sections": [                  // expandable accordions
        { "label": "Details", "open": true, "body": "free text\nwith line breaks" },
        { "label": "Logistics", "body": "..." }
      ],
      "links": [ { "label": "Tickets", "url": "https://…" } ],
      "embed": { "url": "https://www.youtube.com/embed/…" }   // optional 16:9 iframe
    }
  ]
}
```

Everything except `slug`, `title`, and `cards` (with at least a `title` each) is optional. `section.body` is plain text; newlines render as line breaks. HTML in any field is escaped (safe by default).

### Map links
Prefer a real place URL. The always-works fallback:
`https://www.google.com/maps/search/?api=1&query=<URL-encoded "Name Address">`
If you have a specific place/CID URL from search, use that instead.

### Images (links only)
Priority order: official venue/event page image → Wikimedia Commons → a reputable stock/CDN image that clearly matches. **Never invent a URL** — if you can't verify a real image for a specific venue, either use a clearly-generic representative image **and note it**, or **ask the user** to supply one. Broken `<img>` links are worse than asking.

**Always verify every image URL resolves before shipping** (HTTP 200). A quick loop:
```bash
python3 -c "import json;d=json.load(open('data/<slug>.json'));[print(i['url']) for c in d['cards'] for i in ([c.get('image')] if c.get('image') else [])+c.get('images',[])]" \
 | while read u; do echo "$(curl -s -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0' -L "$u")  $u"; done
```

**Wikimedia gotcha:** the `upload.wikimedia.org/.../thumb/.../NNNpx-<file>` thumbnail path is currently returning HTTP 400 from this environment. Use the resize redirect instead — small, reliable, CORS-open:
`https://commons.wikimedia.org/wiki/Special:FilePath/<File_Name>.jpg?width=1100`
Don't hotlink the *original* (`/commons/x/xx/<file>`) — those can be 5–15 MB. To find a good `<File_Name>`, fetch the relevant Wikipedia article and read its lead-image filename.

**Source-specific image grabbing:** many restaurant sites have no `og:image`; pull a real photo URL from the page body (Squarespace/`images.squarespace-cdn.com`, WordPress `/wp-content/uploads/…`, etc.). For venues with no usable photo (and where you won't ask the user), use a flagged placeholder that matches the pass: `https://placehold.co/1000x1100/e7dcc6/5c564a/png?text=<Name>` — warm kraft on the bone palette, reads as intentional and signals "swap me." Always list which images are placeholders/representative in your handoff.

## The generation workflow (run this when asked to build a Jaunt)

1. **Read the plan. Resolve problems first.** Flag and fix: missing dates/times, contradictions (double-booked slots, impossible travel times), ambiguous places ("the museum" → which one), gaps. Ask the user only about things you genuinely can't resolve; make sensible assumptions otherwise and **list them**.
2. **Enrich every proper noun** (venue, restaurant, landmark, event) that lacks a link: search the web for the official page, a Google Maps link, and a representative image URL. Use your web tools.
3. **Shape into cards.** Cover card first, then one card per stop/event in chronological order. Apply the overflow rule. Put must-know info in `summary` + an `open: true` "Details" section; bury the rest in collapsed sections.
4. **Pick an accent color** that fits the trip's vibe — a saturated mid-tone that reads on both the bone pass and the ink background (see *Design language → Accent*).
5. **Write `data/<slug>.json`** and **add an entry to `data/index.json`** (slug, title, subtitle, a `cover` thumbnail URL).
6. **Validate** the JSON (`python3 -m json.tool data/<slug>.json`), confirm the slug matches the filename, and **verify every image URL is HTTP 200** (see the image-check loop above).
7. **Build the share stubs:** `node tools/build-stubs.mjs` — regenerates `p/<slug>/index.html` for every deck (the unfurlable share pages). Always run this after adding/editing a deck, and commit the `p/` output.
8. **Tell the user the share + live URLs**, list assumptions made and any images you'd like them to replace, then offer to commit/push.

## Share URLs & link unfurling

- **Share this:** `https://<user>.github.io/jaunt/p/<slug>/` — a static stub with baked Open Graph / Twitter tags, so the link unfurls (cover + title) in iMessage/WhatsApp/Slack. It boots the same renderer.
- `…/jaunt/?p=<slug>` still works for quick dev/preview but **does not unfurl** (scrapers don't run JS).
- Stubs are generated by `tools/build-stubs.mjs` from each `data/*.json`. The site origin for `og:url` defaults to `https://blackdeer.github.io/jaunt`; override with `SITE_ORIGIN=… node tools/build-stubs.mjs`. The renderer reads `window.JAUNT_SLUG` / `window.JAUNT_BASE` set by the stub.
- og:image must be an absolute URL (cover images already are). Wikimedia `Special:FilePath` covers redirect once — fine for major unfurlers.

## Conventions

- Slugs: kebab-case, unique, descriptive (`vegas-bachelor-2026`).
- Keep summaries tight; the deck is for glancing, not reading essays.
- Test locally with any static server, e.g. `python3 -m http.server 8000` then open `http://localhost:8000/?p=<slug>`.
- Deploy: commit to `main`; GitHub Pages (root) serves it. `.nojekyll` is present so Pages serves files as-is.

## Roadmap / not yet built
- Per-deck password/obfuscation (decks are public via unguessable-ish slug for now).
- Authoring CLI / template snippets.
- Optional map embeds per card, richer themes, transit/time-between-stops.
