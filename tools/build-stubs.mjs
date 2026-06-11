#!/usr/bin/env node
/**
 * Jaunt stub builder.
 *
 * Social scrapers (iMessage, WhatsApp, Slack, Twitter, Facebook…) don't run JS,
 * so a client-rendered `?p=slug` page can't unfurl. This generates a tiny static
 * HTML stub per deck at `p/<slug>/index.html` with Open Graph / Twitter tags baked
 * in, which then boots the shared renderer. Share `…/jaunt/p/<slug>/` — it unfurls
 * with the deck's cover + title, and renders identically to the `?p=` route.
 *
 * Run from the repo root:  node tools/build-stubs.mjs
 * Re-run whenever you add or edit a deck.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const OUT = join(ROOT, "p");

// Where the site is served. Used for absolute og:url + as a fallback origin for
// relative cover images. Override with: SITE_ORIGIN=https://example.com node tools/build-stubs.mjs
const SITE_ORIGIN = (process.env.SITE_ORIGIN || "https://blackdeer.github.io/jaunt").replace(/\/+$/, "");

const ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✈️</text></svg>";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coverOf(deck) {
  const first = (deck.cards || []).find((c) => c.image && c.image.url);
  let url = first ? first.image.url : "";
  if (url && !/^https?:\/\//i.test(url)) url = SITE_ORIGIN + "/" + url.replace(/^\/+/, "");
  return url;
}

function stub(deck) {
  const title = deck.title || deck.slug;
  const desc = deck.subtitle || "An itinerary, as swipeable cards.";
  const cover = coverOf(deck);
  const url = `${SITE_ORIGIN}/p/${deck.slug}/`;
  const accent = (deck.theme && deck.theme.accent) || "#cf3f2c";
  const img = cover
    ? `\n  <meta property="og:image" content="${esc(cover)}" />\n  <meta name="twitter:image" content="${esc(cover)}" />`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
  <title>${esc(title)} · Jaunt</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Jaunt" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(url)}" />${img}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="theme-color" content="${esc(accent)}" />
  <link rel="icon" href="${ICON}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="../../app.css" />
  <script>window.JAUNT_SLUG=${JSON.stringify(deck.slug)};window.JAUNT_BASE="../../";</script>
</head>
<body>
  <main id="app" aria-live="polite"><div class="loading">Loading…</div></main>
  <script src="../../app.js"></script>
</body>
</html>
`;
}

// Clean the output dir so deleted decks don't leave orphan stubs.
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = readdirSync(DATA).filter((f) => f.endsWith(".json") && f !== "index.json");
let n = 0;
for (const f of files) {
  const deck = JSON.parse(readFileSync(join(DATA, f), "utf8"));
  if (!deck.slug) {
    console.warn(`! ${f}: no slug, skipped`);
    continue;
  }
  if (deck.slug !== f.replace(/\.json$/, "")) {
    console.warn(`! ${f}: slug "${deck.slug}" doesn't match filename`);
  }
  mkdirSync(join(OUT, deck.slug), { recursive: true });
  writeFileSync(join(OUT, deck.slug, "index.html"), stub(deck));
  console.log(`✓ p/${deck.slug}/  →  "${deck.title || deck.slug}"  cover:${coverOf(deck) ? "yes" : "MISSING"}`);
  n++;
}
console.log(`\nBuilt ${n} stub(s). Origin: ${SITE_ORIGIN}`);
