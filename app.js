/* Jaunt — itineraries as swipeable cards. Zero dependencies. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var params = new URLSearchParams(location.search);
  var slug = params.get("p");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function fail(msg) {
    app.innerHTML = '<div class="error">' + esc(msg) + "</div>";
  }

  if (!slug) {
    renderLanding();
  } else {
    fetch("data/" + encodeURIComponent(slug) + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderDeck)
      .catch(function () { fail("Couldn't load this Jaunt (“" + slug + "”)."); });
  }

  /* ---------------- Landing ---------------- */
  function renderLanding() {
    fetch("data/index.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : { decks: [] }; })
      .catch(function () { return { decks: [] }; })
      .then(function (data) {
        var decks = (data && data.decks) || [];
        var items = decks.map(function (d) {
          return (
            '<a class="deck-card" href="?p=' + encodeURIComponent(d.slug) + '">' +
            (d.cover ? '<img src="' + esc(d.cover) + '" alt="" loading="lazy" />' : "") +
            '<div><div class="dc-title">' + esc(d.title || d.slug) + "</div>" +
            (d.subtitle ? '<div class="dc-sub">' + esc(d.subtitle) + "</div>" : "") +
            "</div></a>"
          );
        }).join("");
        app.innerHTML =
          '<div class="landing"><h1>Jaunt ✈️</h1>' +
          '<p class="tag">Itineraries as swipeable cards.</p>' +
          '<div class="deck-list">' + (items || '<p class="tag">No Jaunts yet.</p>') + "</div></div>";
      });
  }

  /* ---------------- Deck ---------------- */
  function renderDeck(data) {
    if (data.theme && data.theme.accent) {
      document.documentElement.style.setProperty("--accent", data.theme.accent);
    }
    if (data.theme && data.theme.bg) {
      document.documentElement.style.setProperty("--bg", data.theme.bg);
    }
    if (data.title) document.title = data.title + " · Jaunt";

    var cards = data.cards || [];
    app.innerHTML = "";

    var progress = el('<div class="progress"></div>');
    cards.forEach(function () { progress.appendChild(el('<div class="seg"></div>')); });
    app.appendChild(progress);
    app.appendChild(el('<div class="deck-title">' + esc(data.title || "") + "</div>"));

    var deck = el('<div class="deck"></div>');
    cards.forEach(function (c, i) { deck.appendChild(buildCard(c, i, cards.length)); });
    app.appendChild(deck);

    // tap zones for prev/next
    var left = el('<div class="tapzone left"></div>');
    var right = el('<div class="tapzone right"></div>');
    left.addEventListener("click", function () { go(-1); });
    right.addEventListener("click", function () { go(1); });
    app.appendChild(left);
    app.appendChild(right);

    var hint = el('<div class="nav-hint">Tap or swipe → · scroll ↓ for more</div>');
    app.appendChild(hint);
    setTimeout(function () { hint.style.opacity = "0"; }, 3200);

    var current = 0;
    function setActive(i) {
      current = i;
      var segs = progress.children;
      for (var k = 0; k < segs.length; k++) {
        segs[k].classList.toggle("active", k <= i);
      }
    }
    function go(dir) {
      var next = Math.max(0, Math.min(cards.length - 1, current + dir));
      deck.children[next].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    setActive(0);

    // keep progress synced with scroll position
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          setActive(Number(e.target.dataset.idx));
        }
      });
    }, { root: deck, threshold: [0.61] });
    Array.prototype.forEach.call(deck.children, function (c) { io.observe(c); });

    // keyboard nav (desktop)
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    });
  }

  function buildCard(c, idx, total) {
    var card = el('<section class="card ' + (c.type === "cover" ? "cover" : "") + '" data-idx="' + idx + '"></section>');
    var inner = el('<div class="card-inner"></div>');

    // media
    if (c.image && c.image.url) {
      var hasGallery = Array.isArray(c.images) && c.images.length > 0;
      var allImgs = [c.image].concat(hasGallery ? c.images : []);
      var media = el('<div class="media"></div>');
      var img = el('<img src="' + esc(c.image.url) + '" alt="' + esc(c.image.alt || "") + '" loading="lazy" />');
      media.appendChild(img);
      if (c.image.credit) media.appendChild(el('<div class="credit">' + esc(c.image.credit) + "</div>"));
      if (hasGallery) {
        media.appendChild(el('<div class="gallery-badge">▣ ' + (allImgs.length) + "</div>"));
        media.style.cursor = "zoom-in";
        media.addEventListener("click", function () { openLightbox(allImgs, 0); });
      }
      inner.appendChild(media);
    }

    var body = el('<div class="body"></div>');

    if (c.kicker || c.time) {
      body.appendChild(el(
        '<div class="kicker">' + (c.kicker ? esc(c.kicker) : "") +
        (c.time ? '<span class="time">' + esc(c.time) + "</span>" : "") + "</div>"
      ));
    }
    if (c.title) body.appendChild(el("<h1>" + esc(c.title) + "</h1>"));
    if (c.subtitle) body.appendChild(el('<p class="subtitle">' + esc(c.subtitle) + "</p>"));
    if (c.summary) body.appendChild(el('<p class="summary">' + esc(c.summary) + "</p>"));

    if (c.location && (c.location.mapsUrl || c.location.name)) {
      var L = c.location;
      var href = L.mapsUrl || ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(L.name + " " + (L.address || "")));
      body.appendChild(el(
        '<a class="loc" href="' + esc(href) + '" target="_blank" rel="noopener">' +
        '<span class="pin">📍</span>' +
        '<span class="loc-text"><div class="loc-name">' + esc(L.name || "View on map") + "</div>" +
        (L.address ? '<div class="loc-addr">' + esc(L.address) + "</div>" : "") + "</span>" +
        '<span class="chev">›</span></a>'
      ));
    }

    (c.sections || []).forEach(function (s) {
      if (!s || !s.body) return;
      var det = el('<details class="section"' + (s.open ? " open" : "") + "></details>");
      det.appendChild(el(
        '<summary>' + esc(s.label || "Details") + '<span class="tw">›</span></summary>'
      ));
      det.appendChild(el('<div class="section-body">' + esc(s.body) + "</div>"));
      body.appendChild(det);
    });

    if (Array.isArray(c.links) && c.links.length) {
      var links = el('<div class="links"></div>');
      c.links.forEach(function (lk) {
        if (lk && lk.url) links.appendChild(el('<a href="' + esc(lk.url) + '" target="_blank" rel="noopener">' + esc(lk.label || lk.url) + "</a>"));
      });
      body.appendChild(links);
    }

    inner.appendChild(body);

    if (c.embed && c.embed.url) {
      inner.appendChild(el('<div class="embed"><iframe src="' + esc(c.embed.url) + '" allowfullscreen loading="lazy"></iframe></div>'));
    }

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
