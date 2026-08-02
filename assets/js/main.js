/* =========================================================
   BagTech — interactions
   ========================================================= */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let lang = "az";

  /* ---------- Sticky nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-stuck", scrollY > 20);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const toggle = $("#navToggle");
  const links  = $("#navLinks");
  toggle.addEventListener("click", () => {
    toggle.classList.toggle("is-open");
    links.classList.toggle("is-open");
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      toggle.classList.remove("is-open");
      links.classList.remove("is-open");
    }
  });

  /* ---------- Scroll reveal ----------
     Marks <html> so the hidden state only applies with JS on. Elements inside
     a [data-reveal-group] get an automatic stagger from their index; a manual
     inline `transition-delay` still wins. Each group's members reveal together
     once the group scrolls in, so a row of cards cascades rather than each
     card firing on its own threshold. */
  document.documentElement.classList.add("js");

  // assign stagger delays within groups
  $$("[data-reveal-group]").forEach((group) => {
    const step = parseFloat(group.dataset.revealStep) || 0.08;
    $$("[data-reveal]", group).forEach((el, i) => {
      if (!el.style.transitionDelay) el.style.setProperty("--d", `${i * step}s`);
    });
  });

  const revealMembers = (el) =>
    (el.hasAttribute("data-reveal-group") ? $$("[data-reveal]", el) : [el])
      .forEach((m) => m.classList.add("is-in"));

  // The set of elements to watch: each group as a unit, plus any lone element.
  const watched = new Set([
    ...$$("[data-reveal-group]"),
    ...$$("[data-reveal]").filter((el) => !el.closest("[data-reveal-group]")),
  ]);

  // Rectangle-based check. Runs on scroll and is the source of truth — it works
  // even if IntersectionObserver is starved (e.g. a backgrounded tab on load).
  const sweep = () => {
    const trigger = innerHeight * 0.9;
    watched.forEach((el) => {
      if (el.getBoundingClientRect().top < trigger) {
        revealMembers(el);
        watched.delete(el);
      }
    });
    if (!watched.size) removeEventListener("scroll", onSweep);
  };
  let sweepPending = false;
  const onSweep = () => {
    if (sweepPending) return;
    sweepPending = true;
    requestAnimationFrame(() => { sweep(); sweepPending = false; });
  };
  addEventListener("scroll", onSweep, { passive: true });
  addEventListener("resize", onSweep, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sweep(); });
  sweep(); // reveal whatever is already in view at load

  /* ---------- Animated counters ---------- */
  const runCount = (el) => {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || "";
    if (reduced) { el.textContent = target + suffix; return; }
    const dur = 1400;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { runCount(en.target); countIO.unobserve(en.target); }
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- Card spotlight ---------- */
  $$(".scard").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- Process: pinned horizontal scroller ----------
     The runway is made tall enough to absorb the horizontal distance. While
     it is on screen the pin sticks, and scroll progress through the runway
     drives translateX on the track — so a normal downward scroll reads as
     sideways movement. Disabled below 900px, where the CSS falls back to a
     plain vertical stack. */
  const runway = $("#procRunway");
  const procTrack = $("#procTrack");
  const procBar = $("#procBar");

  if (runway && procTrack) {
    let distance = 0;
    let enabled = false;

    const measure = () => {
      enabled = innerWidth > 900 && !reduced;

      const proc = runway.closest(".proc");

      if (!enabled) {
        proc?.classList.remove("is-pinned");
        runway.style.height = "";
        procTrack.style.transform = "";
        if (procBar) procBar.style.width = "";
        distance = 0;
        return;
      }
      proc?.classList.add("is-pinned");

      // how far the track has to travel for its last panel to reach the edge
      distance = Math.max(0, procTrack.scrollWidth - innerWidth);
      runway.style.height = `${innerHeight + distance}px`;
      update();
    };

    const update = () => {
      if (!enabled) return;
      const travel = runway.offsetHeight - innerHeight;
      if (travel <= 0) return;
      const p = Math.min(Math.max(-runway.getBoundingClientRect().top / travel, 0), 1);
      procTrack.style.transform = `translate3d(${-(p * distance).toFixed(2)}px,0,0)`;
      if (procBar) procBar.style.width = `${(p * 100).toFixed(2)}%`;
    };

    let ticking = false;
    addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });

    let measureT;
    addEventListener("resize", () => {
      clearTimeout(measureT);
      measureT = setTimeout(measure, 150);
    });

    // panel widths depend on fonts being ready
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    measure();
  }

  /* ---------- Scroll-scrubbed motion ----------
     Unlike the one-shot reveal, these transforms are tied continuously to the
     element's position in the viewport, so things keep moving while you scroll
     — the "alive" feel. Driven by a rAF-throttled scroll handler. */
  const fxEls = $$("[data-fx]");
  if (fxEls.length && !reduced) {
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    const applyFx = () => {
      const vh = innerHeight;
      for (const el of fxEls) {
        const r = el.getBoundingClientRect();
        const kind = el.dataset.fx;
        const amt = parseFloat(el.dataset.fxAmt || "60");

        if (kind === "rise") {
          // 0 while still below the fold, 1 once it has risen into place
          const enter = clamp((vh - r.top) / (vh * 0.62), 0, 1);
          const e = 1 - Math.pow(1 - enter, 3);            // ease-out
          el.style.transform = `translateY(${((1 - e) * amt).toFixed(1)}px) scale(${(0.94 + e * 0.06).toFixed(4)})`;
          el.style.opacity = e.toFixed(3);
        } else if (kind === "parallax") {
          // drift opposite to scroll for depth; centred = 0 offset
          const center = r.top + r.height / 2;
          const p = clamp((center - vh / 2) / vh, -1, 1);
          el.style.transform = `translateY(${(-p * amt).toFixed(1)}px)`;
        }
      }
    };

    let fxPending = false;
    const onFx = () => {
      if (fxPending) return;
      fxPending = true;
      requestAnimationFrame(() => { applyFx(); fxPending = false; });
    };
    addEventListener("scroll", onFx, { passive: true });
    addEventListener("resize", onFx, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) applyFx(); });
    if (document.fonts?.ready) document.fonts.ready.then(applyFx);
    applyFx();
  }

  /* ---------- Process timeline: fill the rail as you scroll ---------- */
  const timeline = $("#xTimeline");
  const tlFill = $("#xTlFill");
  if (timeline && tlFill) {
    const steps = $$(".x-step", timeline);
    const paintTl = () => {
      const r = timeline.getBoundingClientRect();
      const trigger = innerHeight * 0.5;
      // 0 when the timeline top reaches the trigger line, 1 when its bottom does
      const p = Math.min(Math.max((trigger - r.top) / r.height, 0), 1);
      tlFill.style.height = `${(p * 100).toFixed(2)}%`;
      steps.forEach((st) => {
        st.classList.toggle("is-on", st.getBoundingClientRect().top < trigger);
      });
    };
    let tlPending = false;
    const onTl = () => {
      if (tlPending) return;
      tlPending = true;
      requestAnimationFrame(() => { paintTl(); tlPending = false; });
    };
    addEventListener("scroll", onTl, { passive: true });
    addEventListener("resize", onTl, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) paintTl(); });
    paintTl();
  }

  /* ---------- Sphere companion ----------
     Desktop only. The sphere has a parking spot per section: it holds that
     spot while the section scrolls by, then glides to the next one during the
     last stretch of the section — так он "стоит на месте" и переезжает.
     Runs sync in hidden tabs (no frames to wait for). */
  const heroVisual = $(".hero__visual");
  if (heroVisual && !reduced) {
    // x is a translate fraction of vw (container sits on the right, so
    // negative x moves the orb left); y in px; s = scale; o = opacity
    // x — translate as a fraction of vw; yv — fraction of vh; s — scale; o — opacity
    const STATIONS = [
      { sel: "#top",       x: 0,     yv: 0,     s: 1,    o: 1    },
      { sel: "#solutions", x: -0.62, yv: 0.24,  s: 0.36, o: 0.55 }, // bottom-left void under the sticky head
      { sel: "#process",   x: -0.04, yv: 0.02,  s: 0.5,  o: 0.6  }, // big, filling the empty right half
      { sel: "#portfolio", x: 0.27,  yv: -0.04, s: 0.26, o: 0.6  }, // peeks from the right edge behind cards
      { sel: "#team",      x: -0.06, yv: 0.05,  s: 0.34, o: 0.55 }, // the void between names and CEO/CTO
      { sel: "#contact",   x: -0.62, yv: 0,     s: 0.34, o: 0.55 },
      { sel: ".x-foot",    x: -0.16, yv: -0.12, s: 0.26, o: 0.65 }, // beside the big footer wordmark
    ];

    const lerp = (a, b, t) => a + (b - a) * t;

    const followFx = () => {
      if (!matchMedia("(min-width: 1101px)").matches) {
        heroVisual.style.transform = "";
        heroVisual.style.opacity = "";
        heroVisual.classList.remove("is-mini");
        return;
      }
      const vh = innerHeight, vw = innerWidth;

      // resolve anchors fresh — section offsets move with content/layout
      const pts = STATIONS
        .map((st) => {
          const el = document.querySelector(st.sel);
          return el ? { ...st, at: Math.max(0, el.offsetTop - vh * 0.2) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.at - b.at);

      let a = pts[0], b = null;
      for (let i = 0; i < pts.length; i++) {
        if (scrollY >= pts[i].at) { a = pts[i]; b = pts[i + 1] || null; }
      }

      const ay = (a.yv || 0) * vh;
      let x = a.x, y = ay, sc = a.s, op = a.o;
      if (b) {
        const by = (b.yv || 0) * vh;
        const p = (scrollY - a.at) / (b.at - a.at);
        // park for the first 45%, travel during 45–85%, settled before the next section
        const pt = Math.min(Math.max((p - 0.45) / 0.4, 0), 1);
        const e = pt * pt * (3 - 2 * pt);            // smoothstep
        x = lerp(a.x, b.x, e);
        y = lerp(ay, by, e);
        sc = lerp(a.s, b.s, e);
        op = lerp(a.o, b.o, e);
      }

      heroVisual.style.transform =
        `translate(${(x * vw).toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(4)})`;
      heroVisual.style.opacity = op.toFixed(3);
      heroVisual.classList.toggle("is-mini", sc < 0.97);
    };

    let followPending = false;
    const onFollow = () => {
      if (document.hidden) { followFx(); return; }
      if (followPending) return;
      followPending = true;
      requestAnimationFrame(() => { followFx(); followPending = false; });
    };
    addEventListener("scroll", onFollow, { passive: true });
    addEventListener("resize", onFollow, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) followFx(); });
    followFx();
  }

  /* ---------- Portfolio: mobile "show all" ---------- */
  const portGrid = $(".x-port__grid");
  const portMore = $("#portMore");
  if (portGrid && portMore) {
    portGrid.classList.add("is-collapsed");
    const hidden = portGrid.querySelectorAll(".x-port__card").length - 8;
    if (hidden > 0) portMore.querySelector("span").textContent += ` (+${hidden})`;
    portMore.addEventListener("click", () => {
      portGrid.classList.remove("is-collapsed");
      portMore.hidden = true;
      dispatchEvent(new Event("scroll"));   // let the fx/reveal engines re-sweep
    });
  }

  /* ---------- Partners marquee ----------
     Clone the set until the track is at least twice the viewport, then shift
     by exactly one copy's width. Measuring in pixels (rather than a -50%
     guess) keeps the seam invisible for any number of copies. */
  const track = $("#partnersTrack");
  if (track && !reduced) {
    const originals = [...track.children];
    const SPEED = 42;   // px per second

    const layout = () => {
      // reset to a single copy before re-measuring
      track.style.animation = "none";
      [...track.children].slice(originals.length).forEach((n) => n.remove());

      const copyWidth = originals.reduce((sum, el) => {
        const r = el.getBoundingClientRect();
        return sum + r.width + parseFloat(getComputedStyle(el).marginRight || 0);
      }, 0);
      if (!copyWidth) return;

      const needed = Math.max(2, Math.ceil((innerWidth * 2) / copyWidth));
      for (let i = 1; i < needed; i++) {
        originals.forEach((el) => {
          const clone = el.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          track.appendChild(clone);
        });
      }

      track.style.setProperty("--shift", `${copyWidth}px`);
      track.style.setProperty("--dur", `${copyWidth / SPEED}s`);
      track.style.animation = "";
    };

    // Item widths are fixed in CSS, so don't hard-block on image loading —
    // race it against a short timeout (lazy/deferred images would otherwise
    // stall the marquee forever) and re-run once on full page load.
    const imgsReady = Promise.all(
      [...track.querySelectorAll("img")].map((img) =>
        img.complete ? Promise.resolve() : new Promise((res) => {
          img.addEventListener("load", res, { once: true });
          img.addEventListener("error", res, { once: true });
        })
      )
    );
    Promise.race([imgsReady, new Promise((res) => setTimeout(res, 900))]).then(layout);
    addEventListener("load", layout, { once: true });

    let resizeT;
    addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(layout, 200);
    });
  }

  /* ---------- Ecosystem: product tiles + detail (only if present) ---------- */
  const hasEco = !!$("#ecoDetail");
  let activeNode = "etick";

  // Products with a real wordmark show it instead of a text heading.
  // Brandmaker's mark is black, so there is no usable colour variant — it stays white.
  const LOGOS = {
    etick:      { color: true },
    "1bilet":   { color: true },
    brandmaker: { color: false }
  };

  const renderEco = () => {
    if (!hasEco) return;
    const d = window.ECO_DATA[lang][activeNode];
    const cfg = d.logo && LOGOS[d.logo];
    const head = cfg
      ? `<div class="eco__logo${cfg.color ? " eco__logo--swap" : ""}">
           <img class="is-white" src="assets/img/p-${d.logo}-white.png" alt="${d.title}">
           ${cfg.color ? `<img class="is-color" src="assets/img/p-${d.logo}-color.png" alt="" aria-hidden="true">` : ""}
         </div>`
      : `<h3 class="h-md">${d.title}</h3>`;

    // .fade-swap is display:contents, so it must yield exactly the two grid
    // columns — hence the explicit left-hand wrapper.
    $("#ecoDetail").innerHTML = `
      <div class="fade-swap">
        <div>
          ${head}
          <span class="eco__badge${d.live ? " is-live" : ""}"><i></i>${d.badge}</span>
          <p class="lead">${d.text}</p>
          ${d.url ? `<a class="eco__link" href="${d.url}" target="_blank" rel="noopener">
            <span>${d.url.replace(/^https?:\/\//, "")}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>
          </a>` : ""}
        </div>
        <ul class="eco__list">${d.list.map((x) => `<li>${x}</li>`).join("")}</ul>
      </div>`;
  };

  const setNode = (name) => {
    activeNode = name;
    $$("#ecoTiles .tile").forEach((t) => t.classList.toggle("is-active", t.dataset.node === name));
    renderEco();
  };

  $$("#ecoTiles .tile").forEach((el) => {
    el.addEventListener("click", () => setNode(el.dataset.node));
  });

  /* =========================================================
     Hero: rotating sphere network.

     Points are distributed with a Fibonacci lattice, edges are
     computed once from 3D proximity, then every frame the whole
     set is rotated, perspective-projected and depth-shaded.
     Data pulses travel along a handful of edges.
     ========================================================= */
  const canvas = $("#sphere");
  if (canvas) {
    const ctx = canvas.getContext("2d");

    const N = 300;
    const NEIGHBOUR_DIST = 0.3;   // on the unit sphere
    const PERSPECTIVE = 2.7;      // camera distance, in radii
    const TILT = -0.42;           // fixed lean, radians

    // Fibonacci lattice — evenly spaced points, no polar clustering.
    const pts = [];
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * GOLDEN;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }

    const edges = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dz = pts[i].z - pts[j].z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < NEIGHBOUR_DIST) edges.push([i, j]);
      }
    }

    // Adjacency, so a pulse can hop from edge to edge and keep travelling
    // across the network instead of teleporting to a random spot.
    const adj = Array.from({ length: N }, () => []);
    for (const [i, j] of edges) { adj[i].push(j); adj[j].push(i); }

    const newPulse = () => {
      const from = (Math.random() * N) | 0;
      const to = adj[from].length ? adj[from][(Math.random() * adj[from].length) | 0] : from;
      return { from, to, prev: from, t: Math.random(), v: 0.006 + Math.random() * 0.008 };
    };
    const pulses = Array.from({ length: 26 }, newPulse);

    const advance = (pl) => {
      const nb = adj[pl.to];
      pl.prev = pl.from;
      pl.from = pl.to;
      if (nb.length) {
        // avoid immediately doubling back unless it's a dead end
        const fwd = nb.filter((n) => n !== pl.prev);
        const pick = fwd.length ? fwd : nb;
        pl.to = pick[(Math.random() * pick.length) | 0];
      }
      pl.t = 0;
      pl.v = 0.006 + Math.random() * 0.008;
    };

    // A few nodes read as "hubs" — slightly larger, always lit.
    const hubs = new Set();
    while (hubs.size < 7) hubs.add((Math.random() * N) | 0);

    const proj = new Array(N);
    let w = 0, h = 0, cx = 0, cy = 0, R = 0;
    let angle = 0, tiltOffset = 0;
    let raf = null;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width  = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      R = Math.min(w, h) * 0.4;
    };

    const project = () => {
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const tilt = TILT + tiltOffset;
      const ct = Math.cos(tilt), st = Math.sin(tilt);

      for (let i = 0; i < N; i++) {
        const p = pts[i];
        // spin around Y
        const X = p.x * ca + p.z * sa;
        const Zy = -p.x * sa + p.z * ca;
        // lean around X
        const Y = p.y * ct - Zy * st;
        const Z = p.y * st + Zy * ct;

        const s = PERSPECTIVE / (PERSPECTIVE - Z);
        proj[i] = {
          x: cx + X * R * s,
          y: cy + Y * R * s,
          d: (Z + 1) / 2,   // 0 = far side, 1 = near side
          s
        };
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      project();

      // ambient glow behind the sphere — a wide halo plus a tighter core
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
      g.addColorStop(0, "rgba(143,184,255,0.20)");
      g.addColorStop(0.42, "rgba(143,184,255,0.09)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // edges — far side stays faint so the sphere reads as a volume
      for (let k = 0; k < edges.length; k++) {
        const a = proj[edges[k][0]], b = proj[edges[k][1]];
        const d = (a.d + b.d) / 2;
        ctx.strokeStyle = `rgba(160,196,255,${(0.04 + d * d * 0.3).toFixed(3)})`;
        ctx.lineWidth = 0.5 + d * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes
      for (let i = 0; i < N; i++) {
        const p = proj[i];
        const hub = hubs.has(i);
        const r = (hub ? 1.6 : 0.7) + p.d * (hub ? 2.1 : 1.3);
        if (hub && p.d > 0.5) {                 // hubs carry a small halo
          const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
          hg.addColorStop(0, `rgba(160,196,255,${((p.d - 0.5) * 0.5).toFixed(3)})`);
          hg.addColorStop(1, "rgba(160,196,255,0)");
          ctx.fillStyle = hg;
          ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
        }
        ctx.fillStyle = hub
          ? `rgba(215,232,255,${(0.35 + p.d * 0.6).toFixed(3)})`
          : `rgba(228,238,255,${(0.12 + p.d * p.d * 0.82).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // data pulses — a glowing head with a fading tail, walking the network
      ctx.lineCap = "round";
      for (const pl of pulses) {
        const a = proj[pl.from], b = proj[pl.to];
        const d = a.d + (b.d - a.d) * pl.t;

        if (d > 0.4) {                          // hidden on the back face
          const alpha = (d - 0.4) / 0.6;
          const x = a.x + (b.x - a.x) * pl.t;
          const y = a.y + (b.y - a.y) * pl.t;
          const tt = Math.max(0, pl.t - 0.55);
          const qx = a.x + (b.x - a.x) * tt;
          const qy = a.y + (b.y - a.y) * tt;

          const trail = ctx.createLinearGradient(qx, qy, x, y);
          trail.addColorStop(0, "rgba(160,196,255,0)");
          trail.addColorStop(1, `rgba(190,218,255,${(alpha * 0.85).toFixed(3)})`);
          ctx.strokeStyle = trail;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(qx, qy);
          ctx.lineTo(x, y);
          ctx.stroke();

          const halo = ctx.createRadialGradient(x, y, 0, x, y, 8);
          halo.addColorStop(0, `rgba(200,224,255,${(alpha * 0.55).toFixed(3)})`);
          halo.addColorStop(1, "rgba(200,224,255,0)");
          ctx.fillStyle = halo;
          ctx.fillRect(x - 8, y - 8, 16, 16);

          ctx.fillStyle = `rgba(245,250,255,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }

        pl.t += pl.v;
        if (pl.t >= 1) advance(pl);             // hop onto a connected edge
      }
    };

    /* --- drag to rotate, with inertia that eases back into the idle spin --- */
    const IDLE_SPIN = 0.0016;
    const TILT_LIMIT = 1.15;
    let dragging = false, lastX = 0, lastY = 0, velSpin = 0, velTilt = 0;

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      velSpin = velTilt = 0;
      canvas.classList.add("is-dragging");
      try { canvas.setPointerCapture(e.pointerId); } catch { /* non-capturable pointer */ }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = (e.clientX - lastX) * 0.006;
      const dy = (e.clientY - lastY) * 0.006;
      lastX = e.clientX;
      lastY = e.clientY;
      angle += dx;
      tiltOffset = clamp(tiltOffset + dy, -TILT_LIMIT, TILT_LIMIT);
      velSpin = dx;                 // carried into the release for inertia
      velTilt = dy;
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove("is-dragging");
      try {
        if (e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch { /* already released */ }
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    const loop = () => {
      if (!dragging) {
        velSpin *= 0.94;
        velTilt *= 0.9;
        // idle spin fades back in as the throw decays
        const throwing = Math.min(1, Math.abs(velSpin) / 0.014);
        angle += velSpin + IDLE_SPIN * (1 - throwing);
        tiltOffset = clamp(tiltOffset + velTilt, -TILT_LIMIT, TILT_LIMIT);
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };
    const stop  = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };

    addEventListener("resize", () => { resize(); draw(); });

    resize();
    draw();
    new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()), { threshold: 0 })
      .observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  }

  /* ---------- Language switch ---------- */
  const applyLang = (next) => {
    lang = next;
    document.documentElement.lang = next;

    const dict = window.I18N[next] || {};
    $$("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (!el.dataset.az) el.dataset.az = el.innerHTML;  // cache the original AZ copy
      el.innerHTML = next === "az" ? el.dataset.az : (dict[key] ?? el.dataset.az);
    });

    $$("#lang button").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === next));
    renderEco();
  };

  $$("#lang button").forEach((b) => {
    b.addEventListener("click", () => {
      applyLang(b.dataset.lang);
      // keep the language in the URL so EN has an indexable address (?lang=en)
      const url = new URL(location.href);
      if (b.dataset.lang === "en") url.searchParams.set("lang", "en");
      else url.searchParams.delete("lang");
      history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    });
  });

  // deep-linked language (hreflang target)
  if (new URLSearchParams(location.search).get("lang") === "en") applyLang("en");

  /* ---------- Contact form (prototype only) ---------- */
  $("#form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = $("#formNote");
    note.textContent = lang === "az"
      ? "Təşəkkürlər! Bu demo versiyadır — mesaj real olaraq göndərilmədi."
      : window.I18N.en["f.sent"];
    note.style.color = "var(--accent)";
    e.target.reset();
  });

  /* ---------- Init ---------- */
  if (hasEco) setNode("etick");
})();
