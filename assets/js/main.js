/* =========================================================
   BagTech — interactions
   ========================================================= */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Each language is its own static page (/, /en/, /ru/). Old ?lang=en links
  // from the time the text was swapped in the browser are sent to the real page.
  const lang = document.documentElement.lang || "az";
  {
    const old = new URLSearchParams(location.search).get("lang");
    const alt = old && old !== lang && $(`link[rel="alternate"][hreflang="${old}"]`);
    if (alt) location.replace(alt.href + location.hash);
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /* ---------- Scroll velocity ----------
     One smoothed reading (px per frame, + = down) shared by everything that
     reacts to *how fast* you scroll. Samples only while scrolling. */
  const motion = { v: 0 };
  {
    let lastY = scrollY, raf = null;
    const sample = () => {
      const y = scrollY;
      motion.v += (y - lastY - motion.v) * 0.2;
      lastY = y;
      if (Math.abs(motion.v) > 0.05) raf = requestAnimationFrame(sample);
      else { motion.v = 0; raf = null; }
    };
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(sample); }, { passive: true });
  }

  /* ---------- Nav: slim bar → floating capsule ----------
     Past the first few pixels the bar morphs into a capsule (CSS); --p feeds
     the progress line along its bottom edge. */
  const nav = $("#nav");
  const navInner = $(".nav__inner", nav);
  const fine = matchMedia("(pointer: fine)").matches;
  let navPending = false;
  const onScroll = () => {
    navPending = false;
    nav.classList.toggle("is-stuck", scrollY > 20);
    const max = document.documentElement.scrollHeight - innerHeight;
    nav.style.setProperty("--p", max > 0 ? clamp(scrollY / max, 0, 1).toFixed(4) : 0);
  };
  addEventListener("scroll", () => {
    if (!navPending) { navPending = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // light inside the capsule follows the cursor
  navInner.addEventListener("pointermove", (e) => {
    const r = navInner.getBoundingClientRect();
    navInner.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
  });

  // pill under the links: slides to the hovered link, rests on the current section
  const navInd = $(".nav__ind");
  let navHover = null, navActive = null;
  const placeInd = () => {
    const a = navHover || navActive;
    if (!navInd) return;
    if (!a || !a.offsetWidth) { navInd.style.opacity = "0"; return; }
    if (navInd.style.opacity !== "1") {            // appear in place, don't slide in from 0
      navInd.style.transition = "none";
      navInd.style.width = `${a.offsetWidth}px`;
      navInd.style.transform = `translateX(${a.offsetLeft}px)`;
      void navInd.offsetWidth;
      navInd.style.transition = "";
      navInd.style.opacity = "1";
      return;
    }
    navInd.style.width = `${a.offsetWidth}px`;
    navInd.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const setNavActive = (a) => { if (a !== navActive) { navActive = a; placeInd(); } };
  setNavActive($("#navLinks a.is-active"));       // service pages mark "Həllər" in the HTML
  const navLinksEl = $("#navLinks");
  navLinksEl.addEventListener("pointerover", (e) => {
    const a = e.target.closest("a");
    if (a && a !== navHover) { navHover = a; placeInd(); }
  });
  navLinksEl.addEventListener("pointerleave", () => { navHover = null; placeInd(); });
  new ResizeObserver(placeInd).observe(navLinksEl);   // language switch changes link widths

  // the header CTA leans toward the cursor
  const navCta = $(".nav__right .btn-primary");
  if (navCta && fine && !reduced) {
    navCta.addEventListener("pointermove", (e) => {
      const r = navCta.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      navCta.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    navCta.addEventListener("pointerleave", () => { navCta.style.transform = ""; });
  }

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

    // Giant numeral beside the timeline: shows the latest step that reached the
    // middle of the screen, rolls to it like a counter, and fills its outline
    // while that step is being read. The duration line is read from the step
    // itself, so it follows the language switch.
    const bnStrip = $("#bnStrip");
    const bnDigits = bnStrip ? $$("span", bnStrip) : [];
    const bnMeta = $("#bnMeta");
    let bnNow = -1;
    const paintNum = (trigger) => {
      if (!bnStrip) return;
      let idx = 0;
      steps.forEach((st, i) => { if (st.classList.contains("is-on")) idx = i; });
      if (idx !== bnNow) {
        bnNow = idx;
        bnStrip.style.transform = `translateY(${-idx * 100 / bnDigits.length}%)`;
      }
      bnDigits.forEach((d, i) => {
        const r = steps[i].getBoundingClientRect();
        const f = clamp((trigger - r.top) / r.height, 0, 1);
        d.style.setProperty("--fill", `${(f * 100).toFixed(1)}%`);
      });
      const meta = $(".x-step__meta", steps[idx]);
      if (meta && bnMeta.textContent !== meta.textContent) bnMeta.textContent = meta.textContent;
    };

    const paintTl = () => {
      const r = timeline.getBoundingClientRect();
      const trigger = innerHeight * 0.5;
      // 0 when the timeline top reaches the trigger line, 1 when its bottom does
      const p = Math.min(Math.max((trigger - r.top) / r.height, 0), 1);
      tlFill.style.height = `${(p * 100).toFixed(2)}%`;
      steps.forEach((st) => {
        st.classList.toggle("is-on", st.getBoundingClientRect().top < trigger);
      });
      paintNum(trigger);
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

  /* =========================================================
     Signal field — the page background is a live dot network.
     · scrolling stretches the dots into streaks (data in motion) and makes
       random nodes flash; the faster you scroll, the more it streams
     · the grid drifts slower than the content, so it reads as depth
     · the cursor "plugs in": nearby nodes light up and wire to the pointer
     Renders only while something is moving; idle = no frames.
     ========================================================= */
  const field = $("#signal");
  if (field) {
    const ctx = field.getContext("2d");
    const RADIUS = 150;                 // cursor reach, px
    let w = 0, h = 0, gap = 28, cols = 0, rows = 0;
    let px = -1e4, py = -1e4, hover = 0, hoverT = 0;
    let flashes = [];                   // {i, j, life}
    let raf = null;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      gap = w < 700 ? 34 : 28;
      field.width = Math.round(w * dpr);
      field.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 2;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const v = motion.v;
      const speed = clamp(Math.abs(v) / 26, 0, 1);
      const streak = clamp(v * 0.6, -20, 20);           // streak length, px
      const off = -((scrollY * 0.35) % gap);            // parallax drift
      const base = Math.floor((scrollY * 0.35) / gap);  // world row of screen row 0
      const near = [];

      hover += (hoverT - hover) * 0.12;

      // spawn flashes in proportion to scroll speed
      const spawn = speed * 1.6;
      for (let k = 0; k < spawn; k++) {
        if (Math.random() < spawn - k) {
          flashes.push({ i: (Math.random() * cols) | 0, j: (Math.random() * rows) | 0, life: 1 });
        }
      }
      const lit = new Map();
      flashes = flashes.filter((f) => (f.life -= 0.05) > 0);
      for (const f of flashes) lit.set(f.j * cols + f.i, f.life);

      ctx.fillStyle = "rgb(160,196,255)";
      ctx.strokeStyle = "rgb(160,196,255)";
      ctx.lineCap = "round";

      for (let j = 0; j < rows; j++) {
        const y0 = j * gap + off;
        for (let i = 0; i < cols; i++) {
          let x = i * gap + (j % 2 ? gap / 2 : 0);
          let y = y0;
          let a = 0.11;

          if (hover > 0.01) {
            const dx = px - x, dy = py - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < RADIUS * RADIUS) {
              const d = Math.sqrt(d2);
              const k = (1 - d / RADIUS) * hover;
              a += k * 0.65;
              x += dx * k * 0.12;                         // lens: pull toward pointer
              y += dy * k * 0.12;
              if (k > 0.25) near.push({ x, y, k });
            }
          }

          const fl = lit.get(j * cols + i);
          if (fl) a = Math.max(a, fl * 0.6);

          // only about one node in four turns into a stream; the rest stay dots.
          // Hashed on the world grid, so the choice doesn't jump as rows wrap.
          const h = ((i * 374761393) ^ ((j + base) * 668265263)) >>> 0;
          const streams = fl || ((h >>> 16) & 3) === 0;
          a = Math.min(1, a + speed * 0.05);
          ctx.globalAlpha = streams ? a * 0.8 : a;
          if (speed > 0.04 && streams) {
            ctx.lineWidth = fl ? 1.4 : 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + streak * (fl ? 1.3 : 1));   // trail opposite to the drift
            ctx.stroke();
          } else {
            const r = fl ? 2.2 : 1.15;
            ctx.fillRect(x - r / 2, y - r / 2, r, r);
          }
        }
      }

      // wire the closest nodes to the cursor
      if (near.length) {
        near.sort((p, q) => q.k - p.k);
        ctx.lineWidth = 0.8;
        for (const n of near.slice(0, 7)) {
          ctx.globalAlpha = n.k * 0.55;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      draw();
      const busy = Math.abs(motion.v) > 0.05 || flashes.length || Math.abs(hoverT - hover) > 0.01;
      raf = busy ? requestAnimationFrame(loop) : null;
    };
    const kick = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };

    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", () => { resize(); draw(); });
    if (fine) {
      addEventListener("pointermove", (e) => {
        px = e.clientX; py = e.clientY; hoverT = 1;
        if (!raf) raf = requestAnimationFrame(loop);
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => { hoverT = 0; kick(); });
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) draw(); });

    resize();
    draw();
  }

  /* ---------- Section minimap (rail) ----------
     Each node sits where its section really is on the page, so the rail is a
     map of the document; the packet is you. Also lights the matching link in
     the top nav. Desktop only (CSS). */
  const rail = $("#rail");
  if (rail) {
    const fill = $(".rail__fill", rail);
    const packet = $(".rail__packet", rail);
    const nodes = $$(".rail__node", rail).map((a) => {
      const id = a.getAttribute("href");
      return { a, sec: $(id), link: $(`#navLinks a[href="${id}"]`), at: 0 };
    }).filter((n) => n.sec);
    let max = 1;

    const layout = () => {
      max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      for (const n of nodes) {
        n.at = clamp((n.sec.offsetTop - innerHeight * 0.35) / max, 0, 1);
        n.a.style.top = `${(n.at * 100).toFixed(2)}%`;
      }
      paint();
    };

    const paint = () => {
      const p = clamp(scrollY / max, 0, 1);
      fill.style.transform = `scaleY(${p.toFixed(4)})`;
      packet.style.top = `${(p * 100).toFixed(2)}%`;
      let current = null;
      for (const n of nodes) if (p >= n.at - 0.002) current = n;
      for (const n of nodes) {
        n.a.classList.toggle("is-on", p >= n.at - 0.002);
        n.a.classList.toggle("is-active", n === current);
        n.link?.classList.toggle("is-active", n === current);
      }
      setNavActive(current?.link || null);
      rail.classList.toggle("is-shown", scrollY > innerHeight * 0.55);
    };

    let pending = false;
    addEventListener("scroll", () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { paint(); pending = false; });
    }, { passive: true });
    // section offsets move as fonts/images load and on resize
    new ResizeObserver(layout).observe(document.body);
    layout();
  }

  /* ---------- Solutions: the item at eye level takes focus ----------
     While the list crosses the middle of the screen, the nearest item gets the
     hover treatment, the rest dim, and the sticky counter follows (03 / 07). */
  const solBody = $(".x-split__body");
  const solNow = $("#solNow");
  if (solBody) {
    const items = $$(".x-item", solBody);
    let shown = -1;
    const focus = () => {
      const mid = innerHeight * 0.5;
      const r = solBody.getBoundingClientRect();
      const active = r.top < mid && r.bottom > mid;
      let best = 0, bd = Infinity;
      items.forEach((it, i) => {
        const rr = it.getBoundingClientRect();
        const d = Math.abs(rr.top + rr.height / 2 - mid);
        if (d < bd) { bd = d; best = i; }
      });
      solBody.classList.toggle("has-focus", active);
      items.forEach((it, i) => it.classList.toggle("is-focus", active && i === best));
      if (active && solNow && best !== shown) {
        shown = best;
        solNow.textContent = String(best + 1).padStart(2, "0");
        solNow.classList.remove("is-tick");
        void solNow.offsetWidth;                    // restart the tick animation
        solNow.classList.add("is-tick");
      }
    };
    let pending = false;
    addEventListener("scroll", () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { focus(); pending = false; });
    }, { passive: true });
    focus();
  }

  /* ---------- Headings decrypt as they arrive ----------
     Characters resolve left→right out of scrambled glyphs. Each character is
     locked to its final width first, so nothing reflows while it runs; the
     original markup is put back at the end. Default state is the plain text,
     so if this never runs nothing is lost. */
  const GLYPHS = "<>/\\{}[]=+*#%01_$&";
  const decode = (el) => {
    const original = el.innerHTML;
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) if (walker.currentNode.data.trim()) texts.push(walker.currentNode);

    for (const t of texts) {
      const frag = document.createDocumentFragment();
      for (const part of t.data.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        const word = document.createElement("span");
        word.className = "dc-w";
        for (const ch of part) {
          const c = document.createElement("span");
          c.className = "dc-c";
          c.textContent = ch;
          word.append(c);
          chars.push({ c, ch, at: 0 });
        }
        frag.append(word);
      }
      t.replaceWith(frag);
    }
    if (!chars.length) return;

    for (const o of chars) o.w = o.c.getBoundingClientRect().width;
    chars.forEach((o, i) => {
      o.c.style.width = `${o.w}px`;
      o.at = (i / chars.length) * 0.78 + Math.random() * 0.22;   // resolve moment, 0..1
      o.c.classList.add("is-wait");
    });

    const marker = chars[0].c;
    const dur = clamp(chars.length * 32, 700, 1500);
    const t0 = performance.now();
    const WINDOW = 0.3;                                           // scramble lead

    const tick = (now) => {
      if (!marker.isConnected) return;   // language switched mid-run: new copy is already in place
      const p = (now - t0) / dur;
      let done = true;
      for (const o of chars) {
        if (p >= o.at) {
          if (o.state !== 2) { o.c.textContent = o.ch; o.c.className = "dc-c"; o.state = 2; }
        } else {
          done = false;
          if (p >= o.at - WINDOW) {
            if (o.state !== 1) { o.c.className = "dc-c is-scr"; o.state = 1; }
            if (Math.random() < 0.5) o.c.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
        }
      }
      if (done) el.innerHTML = original;
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!reduced) {
    const decodeIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        decodeIO.unobserve(en.target);
        decode(en.target);
      });
    }, { threshold: 0.35 });
    const startDecode = () => $$("[data-decode]").forEach((el) => decodeIO.observe(el));
    // widths must be measured in the final font
    if (document.fonts?.ready) document.fonts.ready.then(startDecode); else startDecode();
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
     Clone the set until the track is at least twice the viewport, then wrap
     by exactly one copy's width (measured in px, so the seam stays invisible).
     Driven from JS rather than a CSS animation so it can react to the scroll:
     scrolling down speeds it up, scrolling up throws it backwards, and the
     strip leans into the motion. Runs only while the strip is on screen. */
  const track = $("#partnersTrack");
  if (track && !reduced) {
    const originals = [...track.children];
    const SPEED = 42;   // px per second at rest
    const WARM_MS = 3500;   // first arrival: crawl, then build up to full speed
    let copyWidth = 0, x = 0, last = 0, raf = null, lean = 0;
    let arrived = false, needStart = true, warmUntil = 0;

    // The first time the strip appears it starts from its first logo, placed
    // just past the left fade, and crawls for a few seconds so the key partners
    // (Yığım → PAŞA → bir → ATİB → Agro → ADAU) read first. It never stops.
    // x is kept in (-copyWidth, 0]; one copy back + the lead = the same frame.
    const startPos = () => {
      if (!copyWidth) return;
      x = -copyWidth + track.parentElement.clientWidth * 0.07;   // a little past the 5% fade
      needStart = false;
    };

    const layout = () => {
      // reset to a single copy before re-measuring
      track.style.animation = "none";
      [...track.children].slice(originals.length).forEach((n) => n.remove());

      copyWidth = originals.reduce((sum, el) => {
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

      if (needStart) startPos();
      else { x %= copyWidth; if (x > 0) x -= copyWidth; }
    };

    const tick = (now) => {
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      if (copyWidth) {
        // scroll velocity (px/frame) → extra px/s; sign follows scroll direction
        const k = clamp(1 - (warmUntil - now) / WARM_MS, 0, 1);
        const ease = k * k * (3 - 2 * k);
        x -= (SPEED * (0.3 + 0.7 * ease) + clamp(motion.v, -60, 60) * 26 * ease) * dt;
        if (x <= -copyWidth) x += copyWidth;
        if (x > 0) x -= copyWidth;
        lean += (clamp(-motion.v * 0.35, -9, 9) - lean) * 0.12;
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${lean.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !raf) {
        if (!arrived) {
          arrived = true;
          startPos();                    // no-op until measured; layout() will place it
          warmUntil = performance.now() + WARM_MS;
        }
        last = 0;
        raf = requestAnimationFrame(tick);
      }
      else if (!en.isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; }
    }).observe(track);

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

  /* ---------- Contact form -> POST /api/contact (deploy/form/app.py) ---------- */
  const form = $("#form");
  if (form) {
    const opened = Date.now();
    const status = $("#formStatus");
    const btn = form.querySelector('button[type="submit"]');
    const say = (key, ok) => {
      status.textContent = form.dataset[key] || "";
      status.className = "form__status " + (ok ? "is-ok" : "is-err");
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      const f = new FormData(form);
      const data = Object.fromEntries(["name", "company", "email", "topic", "message", "website"].map((k) => [k, (f.get(k) || "").toString().trim()]));
      if (!data.name || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(data.email)) return say("invalid", false);
      data.lang = document.documentElement.lang;
      data.page = location.pathname;
      data.elapsed = (Date.now() - opened) / 1000;
      btn.disabled = true;
      status.className = "form__status";
      status.textContent = form.dataset.busy || "";
      try {
        const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (r.ok) {
          say("sent", true);
          form.reset();
        } else {
          say(r.status === 422 ? "invalid" : r.status === 429 ? "rate" : "err", false);
        }
      } catch {
        say("err", false);
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------- Init ---------- */
  if (hasEco) setNode("etick");
})();
