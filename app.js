/* Jaunt — itineraries as swipeable cards. "Boarding Pass" renderer. Zero dependencies. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var params = new URLSearchParams(location.search);
  // slug + base come from a per-deck stub (window.JAUNT_*) or the ?p= query on the root page.
  var slug = window.JAUNT_SLUG || params.get("p");
  var base = window.JAUNT_BASE || "";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function pad(n) { return ("0" + n).slice(-2); }
  function fail(msg) { app.innerHTML = '<div class="error">' + esc(msg) + "</div>"; }

  if (!slug) {
    renderLanding();
  } else {
    fetch(base + "data/" + encodeURIComponent(slug) + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderDeck)
      .catch(function () { fail("Couldn’t load this Jaunt (“" + slug + "”)."); });
  }

  /* ---------------- Landing ---------------- */
  function renderLanding() {
    fetch(base + "data/index.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : { decks: [] }; })
      .catch(function () { return { decks: [] }; })
      .then(function (data) {
        var decks = (data && data.decks) || [];
        var items = decks.map(function (d) {
          return (
            '<a class="deck-card" href="' + base + 'p/' + encodeURIComponent(d.slug) + '/">' +
            '<span class="dc-thumb">' + (d.cover ? '<img src="' + esc(d.cover) + '" alt="" loading="lazy" />' : "") + "</span>" +
            '<span class="dc-meta"><span class="dc-title">' + esc(d.title || d.slug) + "</span>" +
            (d.subtitle ? '<span class="dc-sub">' + esc(d.subtitle) + "</span>" : "") + "</span>" +
            '<span class="dc-go">VIEW →</span>' +
            "</a>"
          );
        }).join("");
        app.innerHTML =
          '<div class="landing">' +
          '<div class="lhead"><span class="mark">✈</span><h1>Jaunt</h1></div>' +
          '<p class="tag">Itineraries as swipeable cards</p>' +
          '<div class="deck-list">' + (items || '<p class="tag">No Jaunts yet.</p>') + "</div></div>";
      });
  }

  /* ---------------- Deck ---------------- */
  function renderDeck(data) {
    if (data.theme && data.theme.accent) document.documentElement.style.setProperty("--accent", data.theme.accent);
    if (data.theme && data.theme.bg) document.documentElement.style.setProperty("--bg", data.theme.bg);
    if (data.title) document.title = data.title + " · Jaunt";

    var cards = data.cards || [];
    var stopTotal = cards.filter(function (c) { return c.type !== "cover"; }).length;
    app.innerHTML = "";

    var progress = el('<div class="progress"></div>');
    cards.forEach(function () { progress.appendChild(el('<div class="seg"></div>')); });
    app.appendChild(progress);

    var topbar = el(
      '<div class="topbar"><span class="brand">✈ <b>JAUNT</b></span>' +
      '<span class="count">' + pad(1) + " / " + pad(cards.length) + "</span></div>"
    );
    app.appendChild(topbar);
    var countEl = topbar.querySelector(".count");

    var deck = el('<div class="deck"></div>');
    var stopNo = 0;
    cards.forEach(function (c, i) {
      var meta = { isCover: c.type === "cover", stopTotal: stopTotal };
      if (!meta.isCover) { stopNo += 1; meta.stopNo = stopNo; }
      deck.appendChild(buildCard(c, i, meta));
    });
    app.appendChild(deck);

    // Tap the left/right third to advance. Handled on the deck itself (no overlay
    // elements) so they never block the native horizontal swipe. A click only fires
    // on a real tap — a drag/swipe scrolls the deck and never triggers it.
    deck.addEventListener("click", function (e) {
      if (e.target.closest("a, button, summary, details, .photo, .loc, .links, .embed")) return;
      var r = deck.getBoundingClientRect();
      var x = e.clientX - r.left;
      if (x < r.width * 0.3) go(-1);
      else if (x > r.width * 0.7) go(1);
    });

    var hint = el('<div class="nav-hint">tap or swipe → · scroll ↓ for more</div>');
    app.appendChild(hint);
    setTimeout(function () { hint.style.opacity = "0"; }, 3400);

    var current = 0;
    function setActive(i) {
      current = i;
      var segs = progress.children;
      for (var k = 0; k < segs.length; k++) segs[k].classList.toggle("on", k <= i);
      countEl.textContent = pad(i + 1) + " / " + pad(cards.length);
    }
    function go(dir) {
      var next = Math.max(0, Math.min(cards.length - 1, current + dir));
      deck.children[next].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    setActive(0);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number(e.target.dataset.idx));
      });
    }, { root: deck, threshold: [0.61] });
    Array.prototype.forEach.call(deck.children, function (c) { io.observe(c); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    });

    // soft parallax: nudge each hero image as the deck scrolls
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      var ticking = false;
      function parallax() {
        var w = deck.clientWidth || 1;
        var sx = deck.scrollLeft;
        Array.prototype.forEach.call(deck.children, function (card, i) {
          var img = card.querySelector(".photo img");
          if (!img) return;
          var off = Math.max(-1, Math.min(1, (sx - i * w) / w));
          img.style.transform = "scale(1.08) translateX(" + (off * -5).toFixed(2) + "%)";
        });
      }
      deck.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { parallax(); ticking = false; });
      }, { passive: true });
      parallax();
    }
  }

  function buildCard(c, idx, meta) {
    var card = el('<section class="card ' + (meta.isCover ? "cover" : "") + '" data-idx="' + idx + '"></section>');
    var inner = el('<div class="card-inner"></div>');
    var pass = el('<div class="pass"></div>');

    // ---- matted photo ----
    if (c.image && c.image.url) {
      var hasGallery = Array.isArray(c.images) && c.images.length > 0;
      var allImgs = [c.image].concat(hasGallery ? c.images : []);
      var photo = el('<div class="photo' + (hasGallery ? " zoom" : "") + '"></div>');
      photo.appendChild(el('<img src="' + esc(c.image.url) + '" alt="' + esc(c.image.alt || "") + '" loading="lazy" />'));
      var stubLabel = meta.isCover ? "" : (c.type === "info" ? "NOTE" : "STOP " + pad(meta.stopNo));
      if (stubLabel) photo.appendChild(el('<div class="stub">' + esc(stubLabel) + "</div>"));
      if (c.image.credit) photo.appendChild(el('<div class="credit">' + esc(c.image.credit) + "</div>"));
      if (hasGallery) {
        photo.appendChild(el('<div class="gallery-badge">▣ ' + allImgs.length + "</div>"));
        photo.addEventListener("click", function () { openLightbox(allImgs, 0); });
      }
      pass.appendChild(photo);
    }

    // ---- body ----
    var body = el('<div class="stub-body"></div>');

    if (meta.isCover && meta.stopTotal > 0) {
      body.appendChild(el('<div class="stamp">' + meta.stopTotal + (meta.stopTotal === 1 ? " STOP" : " STOPS") + "</div>"));
    }

    if (c.kicker || c.time) {
      body.appendChild(el(
        '<div class="gate">' + (c.kicker ? '<span class="glabel">' + esc(c.kicker) + "</span>" : "") +
        (c.time ? '<span class="time">' + esc(c.time) + "</span>" : "") + "</div>"
      ));
    }
    if (c.title) body.appendChild(el("<h1>" + esc(c.title) + "</h1>"));
    if (c.subtitle) body.appendChild(el('<p class="subtitle">' + esc(c.subtitle) + "</p>"));
    if (c.summary) body.appendChild(el('<p class="summary">' + esc(c.summary) + "</p>"));

    if (c.location && (c.location.mapsUrl || c.location.name)) {
      var L = c.location;
      var href = L.mapsUrl || ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((L.name || "") + " " + (L.address || "")));
      body.appendChild(el(
        '<a class="loc" href="' + esc(href) + '" target="_blank" rel="noopener">' +
        '<span class="pin">✦</span>' +
        '<span class="loctext"><div class="loc-name">' + esc(L.name || "View on map") + "</div>" +
        (L.address ? '<div class="loc-addr">' + esc(L.address) + "</div>" : "") + "</span>" +
        '<span class="map">MAP ↗</span></a>'
      ));
    }

    var secs = (c.sections || []).filter(function (s) { return s && s.body; });
    if (secs.length) {
      var sections = el('<div class="sections"></div>');
      secs.forEach(function (s) {
        var det = el('<details class="section"' + (s.open ? " open" : "") + "></details>");
        det.appendChild(el('<summary>' + esc(s.label || "Details") + '<span class="tw">+</span></summary>'));
        det.appendChild(el('<div class="section-body">' + esc(s.body) + "</div>"));
        sections.appendChild(det);
      });
      body.appendChild(sections);
    }

    if (Array.isArray(c.links) && c.links.length) {
      var links = el('<div class="links"></div>');
      c.links.forEach(function (lk) {
        if (lk && lk.url) links.appendChild(el('<a href="' + esc(lk.url) + '" target="_blank" rel="noopener">' + esc(lk.label || lk.url) + "</a>"));
      });
      body.appendChild(links);
    }

    if (meta.isCover) {
      body.appendChild(el(
        '<div class="covermeta"><div class="barcode"></div>' +
        '<div class="board"><span>SEQ ' + pad(idx + 1) + "00</span>" +
        '<span class="go">SWIPE TO BOARD →</span></div></div>'
      ));
    }

    pass.appendChild(body);

    if (c.embed && c.embed.url) {
      pass.appendChild(el('<div class="embed"><iframe src="' + esc(c.embed.url) + '" allowfullscreen loading="lazy"></iframe></div>'));
    }

    inner.appendChild(pass);
    card.appendChild(inner);
    return card;
  }

  /* ---------------- Lightbox ---------------- */
  function openLightbox(imgs, start) {
    var lb = el('<div class="lightbox"></div>');
    lb.appendChild(el('<button class="lb-close" aria-label="Close">✕</button>'));
    var track = el('<div class="lb-track"></div>');
    imgs.forEach(function (im) {
      track.appendChild(el('<div class="lb-slide"><img src="' + esc(im.url) + '" alt="' + esc(im.alt || "") + '" /></div>'));
    });
    lb.appendChild(track);
    var cap = el('<div class="lb-cap"></div>');
    lb.appendChild(cap);
    var dots = el('<div class="lb-dots"></div>');
    imgs.forEach(function () { dots.appendChild(el('<span class="d"></span>')); });
    lb.appendChild(dots);
    document.body.appendChild(lb);

    function sync() {
      var w = track.clientWidth || 1;
      var i = Math.round(track.scrollLeft / w);
      for (var k = 0; k < dots.children.length; k++) dots.children[k].classList.toggle("on", k === i);
      cap.textContent = (imgs[i] && imgs[i].alt) || "";
    }
    track.addEventListener("scroll", sync, { passive: true });
    function close() { lb.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", onKey);

    requestAnimationFrame(function () {
      track.children[start] && track.children[start].scrollIntoView({ inline: "center", block: "nearest" });
      sync();
    });
  }
})();
