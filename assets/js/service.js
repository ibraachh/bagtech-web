/* =========================================================
   BagTech — service artwork
   Every <canvas data-art="…"> on the page gets its scene: animated in a
   service hero, a still frame that wakes on hover as a blog cover
   (data-mode="cover").
   Shared language: thin blue line-art on dark, the same palette
   and dot motif as the homepage background. Each scene is a
   small loop that also leans toward the cursor.
   ========================================================= */
(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  // a calm, finished-looking moment of each scene (reduced motion, blog covers)
  const STILL = { software: 6.5, ai: 7.2, security: 3, crm: 6.6, integration: 2, web: 1, infra: 6, support: 2 };

  const mount = (canvas) => {
    const ctx = canvas.getContext("2d");
    const cover = canvas.dataset.mode === "cover";

    /* ---------- palette & helpers ---------- */
    const BLUE = "160,196,255";
    const ACC = "143,184,255";
    const WHITE = "236,243,255";
    const OK = "126,226,184";
    const WARN = "255,196,107";
    const DISPLAY = '500 13px "Space Grotesk", system-ui, sans-serif';
    const rgba = (c, a) => `rgba(${c},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (t) => t * t * (3 - 2 * t);
    const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const seg = (x, a, b) => clamp((x - a) / (b - a), 0, 1);       // progress of x through [a, b]
    const cyc = (t, period) => (t / period) % 1;                     // 0..1 loop
    const lang = () => (document.documentElement.lang === "en" ? "en" : "az");
    const L = (az, en) => (lang() === "en" ? en : az);

    // seeded random, so a scene looks the same on every load
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      if (w <= 0 || h <= 0) return;           // tiny canvas while resizing
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const dot = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const glow = (x, y, r, c, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, a));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const label = (text, x, y, color, size = 13, align = "center") => {
      ctx.font = DISPLAY.replace("13px", `${size}px`);
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    /* ---------- stage ---------- */
    let W = 0, H = 0, S = 0, cx = 0, cy = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = Math.min(W, H);
      cx = W / 2;
      cy = H / 2;
    };

    // cursor relative to the canvas centre, -1..1, eased
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, mx: -1e4, my: -1e4 };
    if (fine) {
      addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        ptr.tx = clamp((e.clientX - r.left - r.width / 2) / (r.width / 2), -1.4, 1.4);
        ptr.ty = clamp((e.clientY - r.top - r.height / 2) / (r.height / 2), -1.4, 1.4);
        ptr.mx = e.clientX - r.left;
        ptr.my = e.clientY - r.top;
      }, { passive: true });
    }

    /* =========================================================
       01 · Custom software — a blueprint that builds itself
       ========================================================= */
    const software = () => {
      // browser and phone, each a list of blocks in their own 0..1 space
      const browser = [
        { x: 0.05, y: 0.16, w: 0.9, h: 0.07, kind: "bar" },
        { x: 0.05, y: 0.30, w: 0.5, h: 0.08, kind: "text" },
        { x: 0.05, y: 0.42, w: 0.38, h: 0.05, kind: "text" },
        { x: 0.05, y: 0.53, w: 0.2, h: 0.08, kind: "button" },
        { x: 0.6, y: 0.29, w: 0.35, h: 0.34, kind: "image" },
        { x: 0.05, y: 0.71, w: 0.28, h: 0.2, kind: "card" },
        { x: 0.36, y: 0.71, w: 0.28, h: 0.2, kind: "card" },
        { x: 0.67, y: 0.71, w: 0.28, h: 0.2, kind: "card" },
      ];
      const phone = [
        { x: 0.1, y: 0.08, w: 0.8, h: 0.08, kind: "bar" },
        { x: 0.1, y: 0.22, w: 0.8, h: 0.13, kind: "row" },
        { x: 0.1, y: 0.39, w: 0.8, h: 0.13, kind: "row" },
        { x: 0.1, y: 0.56, w: 0.8, h: 0.13, kind: "row" },
        { x: 0.1, y: 0.8, w: 0.8, h: 0.1, kind: "button" },
      ];

      const drawBlock = (b, fx, fy, fw, fh, sketch, build, i, t) => {
        const x = fx + b.x * fw, y = fy + b.y * fh, w = b.w * fw, h = b.h * fh;
        const s = seg(sketch, i * 0.06, i * 0.06 + 0.5);
        const k = seg(build, i * 0.07, i * 0.07 + 0.45);
        if (s <= 0) return;
        ctx.lineWidth = 1;
        ctx.setLineDash(k < 0.5 ? [4, 4] : []);
        ctx.lineDashOffset = -t * 18;
        ctx.strokeStyle = rgba(BLUE, 0.25 + 0.35 * s);
        if (b.kind === "text") {
          // text placeholders: two rounded lines
          const lh = Math.max(3, h * 0.32);
          ctx.setLineDash([]);
          ctx.fillStyle = rgba(BLUE, (0.12 + 0.35 * k) * s);
          rr(x, y, w * (0.55 + 0.45 * s), lh, lh / 2); ctx.fill();
          rr(x, y + h * 0.55, w * 0.7 * s, lh * 0.8, lh / 2); ctx.fill();
          return;
        }
        rr(x, y, w, h, b.kind === "button" ? h / 2 : 7);
        if (k > 0) {
          const fill = b.kind === "button" ? 0.55 : b.kind === "image" ? 0.12 : 0.07;
          ctx.fillStyle = rgba(ACC, fill * k);
          ctx.fill();
        }
        ctx.stroke();
        if (b.kind === "image" && k > 0) {               // mountains + sun, the universal placeholder
          ctx.setLineDash([]);
          ctx.strokeStyle = rgba(BLUE, 0.45 * k);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.08, y + h * 0.82);
          ctx.lineTo(x + w * 0.38, y + h * 0.48);
          ctx.lineTo(x + w * 0.56, y + h * 0.68);
          ctx.lineTo(x + w * 0.72, y + h * 0.54);
          ctx.lineTo(x + w * 0.92, y + h * 0.82);
          ctx.stroke();
          dot(x + w * 0.74, y + h * 0.26, Math.max(3, w * 0.05), rgba(ACC, 0.5 * k));
        }
        if ((b.kind === "card" || b.kind === "row") && k > 0) {
          ctx.setLineDash([]);
          ctx.fillStyle = rgba(BLUE, 0.3 * k);
          if (b.kind === "row") dot(x + h * 0.5, y + h / 2, h * 0.26, rgba(ACC, 0.35 * k));
          const tx = b.kind === "row" ? x + h * 1.05 : x + w * 0.1;
          rr(tx, y + h * (b.kind === "row" ? 0.3 : 0.6), w * 0.45, 3, 1.5); ctx.fill();
          rr(tx, y + h * (b.kind === "row" ? 0.58 : 0.78), w * 0.3, 3, 1.5); ctx.fill();
        }
      };

      return (t) => {
        const c = cyc(t, 10);
        const sketch = seg(c, 0, 0.32);
        const build = seg(c, 0.3, 0.6) * (1 - seg(c, 0.9, 1));
        const sketchOut = 1 - seg(c, 0.94, 1);

        // blueprint grid
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = rgba(BLUE, 0.045);
        for (let x = (W % 26) / 2; x < W; x += 26) line(x, 0, x, H);
        for (let y = (H % 26) / 2; y < H; y += 26) line(0, y, W, y);

        // browser
        const bw = W * 0.66, bh = H * 0.56;
        const bx = W * 0.07 + ptr.x * 8, by = H * 0.14 + ptr.y * 6;
        ctx.setLineDash(build < 0.3 ? [5, 5] : []);
        ctx.strokeStyle = rgba(BLUE, 0.6 * sketch * sketchOut);
        rr(bx, by, bw, bh, 12);
        ctx.fillStyle = rgba("10,13,20", 0.75 * build);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 3; i++) dot(bx + 16 + i * 12, by + 15, 3, rgba(BLUE, 0.4 * sketch * sketchOut));
        browser.forEach((b, i) => drawBlock(b, bx, by, bw, bh, sketch * sketchOut, build, i, t));

        // phone, closer to the viewer
        const pw = W * 0.24, ph = H * 0.5;
        const px = W * 0.66 + ptr.x * 18, py = H * 0.38 + ptr.y * 12;
        ctx.setLineDash(build < 0.3 ? [5, 5] : []);
        ctx.strokeStyle = rgba(BLUE, 0.7 * sketch * sketchOut);
        rr(px, py, pw, ph, 18);
        ctx.fillStyle = rgba("10,13,20", 0.9 * Math.max(build, sketch * 0.6) * sketchOut);
        ctx.fill();
        ctx.stroke();
        phone.forEach((b, i) => drawBlock(b, px, py, pw, ph, sketch * sketchOut, build, i + 2, t));

        // dimension lines while it's still a sketch
        const dim = sketch * (1 - seg(c, 0.42, 0.55));
        if (dim > 0) {
          ctx.setLineDash([]);
          ctx.strokeStyle = rgba(ACC, 0.5 * dim);
          line(bx, by - 16, bx + bw, by - 16);
          line(bx, by - 21, bx, by - 11);
          line(bx + bw, by - 21, bx + bw, by - 11);
          label("1440", bx + bw / 2, by - 27, rgba(ACC, 0.8 * dim), 11);
          line(px + pw + 14, py, px + pw + 14, py + ph);
          line(px + pw + 9, py, px + pw + 19, py);
          line(px + pw + 9, py + ph, px + pw + 19, py + ph);
          ctx.save();
          ctx.translate(px + pw + 26, py + ph / 2);
          ctx.rotate(Math.PI / 2);
          label("390", 0, 0, rgba(ACC, 0.8 * dim), 11);
          ctx.restore();
        }

        // live: a cursor taps the phone button
        const live = seg(c, 0.62, 0.9);
        if (live > 0 && live < 1) {
          const btnX = px + pw * 0.5, btnY = py + ph * 0.85;
          const k = easeIO(seg(live, 0, 0.45));
          const mx = lerp(bx + bw * 0.4, btnX, k), my = lerp(by + bh * 0.4, btnY, k);
          const tap = seg(live, 0.45, 0.8);
          if (tap > 0) {
            ctx.setLineDash([]);
            ctx.strokeStyle = rgba(ACC, 0.7 * (1 - tap));
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(btnX, btnY, 6 + tap * 26, 0, Math.PI * 2); ctx.stroke();
          }
          glow(mx, my, 16, WHITE, 0.35);
          dot(mx, my, 3.2, rgba(WHITE, 0.95));
        }
        ctx.setLineDash([]);
      };
    };

    /* =========================================================
       02 · AI — a cloud of dots finds a face
       ========================================================= */
    const ai = () => {
      const marks = [];                      // landmarks (unit space, y down)
      const add = (x, y, z = 1) => marks.push({ x, y, z });
      for (let i = 0; i < 26; i++) {         // face outline: an egg, narrower at the chin
        const a = (i / 26) * Math.PI * 2;
        const sy = Math.sin(a);
        const taper = sy > 0 ? 1 - 0.3 * sy * sy : 1 - 0.06 * sy * sy;
        add(0.7 * Math.cos(a) * taper, 0.95 * sy, 0.55);
      }
      [-1, 1].forEach((sd) => {
        for (let i = 0; i < 8; i++) {        // eyes
          const a = (i / 8) * Math.PI * 2;
          add(sd * 0.29 + Math.cos(a) * 0.14, -0.08 + Math.sin(a) * 0.05, 0.85);
        }
        add(sd * 0.29, -0.08, 0.9);          // pupil
        for (let i = 0; i < 5; i++) {        // brows
          const u = i / 4;
          add(sd * (0.13 + u * 0.33), -0.29 - 0.06 * Math.sin(Math.PI * u), 0.9);
        }
        add(sd * 0.5, 0.22, 0.7);            // cheeks
        add(sd * 0.42, 0.5, 0.7);
        add(sd * 0.27, -0.6, 0.75);          // forehead
      });
      [[0, -0.05], [0, 0.07], [0, 0.19], [-0.1, 0.25], [-0.04, 0.28], [0.04, 0.28], [0.1, 0.25], [0, -0.66]]
        .forEach(([x, y]) => add(x, y, 1));  // nose + forehead centre
      for (let i = 0; i < 10; i++) {         // mouth
        const a = (i / 10) * Math.PI * 2;
        add(Math.cos(a) * 0.23, 0.5 + Math.sin(a) * 0.065, 0.9);
      }

      // mesh: each landmark to its three nearest neighbours
      const edges = [];
      const seen = new Set();
      marks.forEach((p, i) => {
        marks
          .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 }))
          .filter((o) => o.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, 3)
          .forEach(({ j }) => {
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
          });
      });

      // dots: landmarks plus a dusting inside the face
      const pts = marks.map((m) => ({ ...m, lm: true }));
      for (let i = 0; i < 90; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
        pts.push({ x: Math.cos(a) * r * 0.6, y: Math.sin(a) * r * 0.85, z: 0.7, lm: false });
      }
      let scatterSeed = 1;
      const scatter = () => {
        pts.forEach((p) => {
          p.sx = (rnd() - 0.5) * 2.6;
          p.sy = (rnd() - 0.5) * 2.2;
          p.delay = rnd() * 0.12;
        });
      };
      scatter();

      return (t) => {
        const c = cyc(t, 11);
        const loop = Math.floor(t / 11);
        if (loop !== scatterSeed) { scatterSeed = loop; scatter(); }
        const scale = S * 0.36;
        const fx = cx, fy = cy + S * 0.02;
        const out = seg(c, 0.86, 1);
        const pos = (p) => {
          const k = easeIO(seg(c, p.delay, p.delay + 0.28)) * (1 - easeIO(out));
          const x = lerp(p.sx, p.x, k), y = lerp(p.sy, p.y, k);
          return {
            x: fx + x * scale + ptr.x * p.z * 16,
            y: fy + y * scale + ptr.y * p.z * 10,
            k,
          };
        };
        const P = pts.map(pos);

        // mesh
        const mesh = seg(c, 0.3, 0.45) * (1 - out);
        if (mesh > 0) {
          ctx.lineWidth = 0.8;
          edges.forEach(([i, j], n) => {
            const k = seg(mesh, (n / edges.length) * 0.6, (n / edges.length) * 0.6 + 0.4);
            if (k <= 0) return;
            ctx.strokeStyle = rgba(BLUE, 0.28 * k);
            line(P[i].x, P[i].y, lerp(P[i].x, P[j].x, k), lerp(P[i].y, P[j].y, k));
          });
        }

        // dots
        P.forEach((q, i) => {
          const lm = pts[i].lm;
          const a = lm ? 0.35 + 0.6 * q.k : 0.18 + 0.3 * q.k;
          dot(q.x, q.y, lm ? 1.7 : 1.1, rgba(lm ? WHITE : BLUE, a));
        });

        // scan line
        const scan = seg(c, 0.45, 0.58);
        if (scan > 0 && scan < 1) {
          const y = fy - scale * 1.05 + scan * scale * 2.1;
          const g = ctx.createLinearGradient(0, y - 28, 0, y + 2);
          g.addColorStop(0, rgba(ACC, 0));
          g.addColorStop(1, rgba(ACC, 0.22));
          ctx.fillStyle = g;
          ctx.fillRect(fx - scale * 0.95, y - 28, scale * 1.9, 30);
          ctx.strokeStyle = rgba(ACC, 0.8);
          ctx.lineWidth = 1;
          line(fx - scale * 0.95, y, fx + scale * 0.95, y);
        }

        // recognition frame snaps in
        const lock = seg(c, 0.56, 0.64) * (1 - out);
        if (lock > 0) {
          const e = easeIO(lock);
          const pad = lerp(scale * 0.5, scale * 0.12, e);
          const x0 = fx - scale * 0.72 - pad + ptr.x * 8, x1 = fx + scale * 0.72 + pad + ptr.x * 8;
          const y0 = fy - scale * 0.98 - pad + ptr.y * 6, y1 = fy + scale * 0.98 + pad + ptr.y * 6;
          const len = 18;
          const ok = seg(c, 0.64, 0.68);
          ctx.strokeStyle = ok > 0 ? rgba(OK, 0.9 * lock) : rgba(ACC, 0.9 * lock);
          ctx.lineWidth = 2;
          [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(x, y + sy * len);
            ctx.lineTo(x, y);
            ctx.lineTo(x + sx * len, y);
            ctx.stroke();
          });
          if (ok > 0) {                       // small confirmation tick in the corner
            const k = smooth(ok);
            ctx.strokeStyle = rgba(OK, 0.95 * lock);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x1 - 2, y0 - 22, 11, 0, Math.PI * 2 * k);
            ctx.stroke();
            if (k > 0.6) {
              ctx.beginPath();
              ctx.moveTo(x1 - 7, y0 - 22);
              ctx.lineTo(x1 - 3, y0 - 18);
              ctx.lineTo(x1 + 4, y0 - 26);
              ctx.stroke();
            }
          }
        }
      };
    };

    /* =========================================================
       03 · Cybersecurity — rings of defence
       ========================================================= */
    const security = () => {
      const rings = [
        { r: 0.4, n: 30, speed: 0.12, gap: [0.6, 0.55] },
        { r: 0.31, n: 24, speed: -0.2, gap: [2.4, 0.5] },
        { r: 0.22, n: 16, speed: 0.3, gap: [4.2, 0.6] },
        { r: 0.13, n: 10, speed: -0.45, gap: [1.2, 0] },
      ];
      let threats = [];
      let sparks = [];
      let lastSpawn = 0;
      const TAU = Math.PI * 2;
      const inGap = (ring, ang, rot) => {
        if (!ring.gap[1]) return false;
        const d = (((ang - (ring.gap[0] + rot)) % TAU) + TAU) % TAU;
        return d < ring.gap[1];
      };

      return (t, dt) => {
        const R = S * 1;
        const ox = cx + ptr.x * 10, oy = cy + ptr.y * 8;

        // faint spokes
        ctx.strokeStyle = rgba(BLUE, 0.05);
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          line(ox + Math.cos(a) * R * 0.1, oy + Math.sin(a) * R * 0.1, ox + Math.cos(a) * R * 0.48, oy + Math.sin(a) * R * 0.48);
        }

        // rings of dashes, each with a gap
        const rot = rings.map((g, i) => t * g.speed + ptr.x * 0.25 * (i % 2 ? -1 : 1));
        rings.forEach((g, i) => {
          const r = g.r * R;
          const step = TAU / g.n;
          ctx.lineWidth = i === 0 ? 2 : 1.6;
          for (let k = 0; k < g.n; k++) {
            const a0 = rot[i] + k * step;
            if (inGap(g, a0 + step * 0.5, rot[i])) continue;
            let hit = 0;
            sparks.forEach((s) => {
              if (s.ring !== i) return;
              const d = Math.abs(((((a0 + step / 2 - s.a) % TAU) + TAU + Math.PI) % TAU) - Math.PI);
              if (d < 0.5) hit = Math.max(hit, s.life * (1 - d / 0.5));
            });
            ctx.strokeStyle = hit > 0 ? rgba(WHITE, 0.35 + 0.6 * hit) : rgba(BLUE, 0.32 + 0.1 * (3 - i) / 3);
            ctx.beginPath();
            ctx.arc(ox, oy, r, a0 + step * 0.12, a0 + step * 0.78);
            ctx.stroke();
          }
        });

        // core
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
        glow(ox, oy, R * 0.12, ACC, 0.25 + 0.15 * pulse);
        dot(ox, oy, R * 0.035, rgba(ACC, 0.9));
        ctx.strokeStyle = rgba(WHITE, 0.8);
        ctx.lineWidth = 1.6;
        ctx.beginPath();                      // keyhole
        ctx.arc(ox, oy - 2, R * 0.012, 0, TAU);
        ctx.moveTo(ox, oy - 2 + R * 0.012);
        ctx.lineTo(ox, oy + R * 0.02);
        ctx.stroke();

        // incoming threats
        if (!reduced && t - lastSpawn > 0.32) {
          lastSpawn = t;
          const a = rnd() * TAU;
          threats.push({ a, r: R * 0.62, v: R * (0.16 + rnd() * 0.08), stop: 0, out: false });
        }
        threats.forEach((th) => {
          if (!th.out) {
            th.r -= th.v * dt;
            const ring = rings[th.stop];
            const rr0 = ring.r * R;
            if (th.r <= rr0 + 3) {
              if (inGap(ring, th.a, rot[th.stop]) && th.stop < rings.length - 1) {
                th.stop++;                    // slipped through a gap: the next ring catches it
              } else {
                th.out = true;
                th.r = rr0 + 3;
                sparks.push({ ring: th.stop, a: th.a, life: 1 });
              }
            }
          } else {
            th.r += th.v * 1.4 * dt;          // bounced back out
            th.fade = (th.fade || 1) - dt * 1.4;
          }
          const x = ox + Math.cos(th.a) * th.r, y = oy + Math.sin(th.a) * th.r;
          const tail = th.out ? -14 : 14;
          const a = th.out ? Math.max(0, th.fade) : 1;
          ctx.strokeStyle = rgba(th.out ? ACC : WARN, 0.7 * a);
          ctx.lineWidth = 1.5;
          line(x, y, ox + Math.cos(th.a) * (th.r + tail), oy + Math.sin(th.a) * (th.r + tail));
          dot(x, y, 2.4, rgba(th.out ? ACC : WARN, a));
        });
        threats = threats.filter((th) => !th.out || th.fade > 0);
        sparks.forEach((s) => (s.life -= dt * 1.6));
        sparks = sparks.filter((s) => s.life > 0);
      };
    };

    /* =========================================================
       04 · CRM & ERP — loose modules become one system
       ========================================================= */
    const crm = () => {
      const mods = [
        () => "CRM", () => L("Satış", "Sales"), () => "HR",
        () => L("Maliyyə", "Finance"), () => L("Anbar", "Stock"), () => L("Hesabat", "Reports"),
      ];
      return (t) => {
        const c = cyc(t, 11);
        const join = easeIO(seg(c, 0.28, 0.46)) * (1 - easeIO(seg(c, 0.84, 0.98)));
        const tw = S * 0.25, th = S * 0.13, gap = 12;
        const gx = cx - (tw * 3 + gap * 2) / 2, gy = cy - (th * 2 + gap) / 2 + S * 0.03;
        const pts = mods.map((_, i) => {
          const a = (i / mods.length) * Math.PI * 2 + t * 0.18;
          const ox = cx + Math.cos(a) * S * 0.33 - tw / 2 + ptr.x * 14;
          const oy = cy + Math.sin(a) * S * 0.27 - th / 2 + Math.sin(t * 1.3 + i) * 5 + ptr.y * 10;
          const tx = gx + (i % 3) * (tw + gap), ty = gy + Math.floor(i / 3) * (th + gap);
          return { x: lerp(ox, tx, join), y: lerp(oy, ty, join) };
        });

        // while apart: each module hangs on a thin line to the centre
        const apart = 1 - join;
        if (apart > 0.02) {
          ctx.setLineDash([3, 5]);
          ctx.lineDashOffset = -t * 12;
          ctx.strokeStyle = rgba(BLUE, 0.25 * apart);
          ctx.lineWidth = 1;
          pts.forEach((p) => line(cx, cy, p.x + tw / 2, p.y + th / 2));
          ctx.setLineDash([]);
          dot(cx, cy, 3, rgba(ACC, 0.6 * apart));
        }

        // the system frame draws around them once they meet
        const frame = seg(c, 0.42, 0.56) * (1 - seg(c, 0.82, 0.9));
        if (frame > 0) {
          const fx = gx - 18, fy = gy - 46, fw = tw * 3 + gap * 2 + 36, fh = th * 2 + gap + 64;
          ctx.save();
          rr(fx, fy, fw, fh, 18);
          ctx.fillStyle = rgba("12,15,24", 0.7 * frame);
          ctx.fill();
          ctx.setLineDash([fw * 2 + fh * 2]);
          ctx.lineDashOffset = (fw * 2 + fh * 2) * (1 - frame);
          ctx.strokeStyle = rgba(ACC, 0.6);
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.restore();
          ctx.setLineDash([]);
          for (let i = 0; i < 3; i++) dot(fx + 18 + i * 11, fy + 18, 2.6, rgba(BLUE, 0.5 * frame));
          rr(fx + fw - 110, fy + 12, 88, 12, 6);
          ctx.fillStyle = rgba(BLUE, 0.12 * frame);
          ctx.fill();
        }

        // data moving between neighbours while joined
        const flow = seg(c, 0.5, 0.56) * (1 - seg(c, 0.8, 0.86));
        if (flow > 0) {
          ctx.strokeStyle = rgba(ACC, 0.35 * flow);
          ctx.lineWidth = 1;
          [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]].forEach(([a, b], n) => {
            const A = pts[a], B = pts[b];
            const ax = A.x + tw / 2, ay = A.y + th / 2, bx = B.x + tw / 2, by = B.y + th / 2;
            const u = (t * 0.7 + n * 0.37) % 1;
            dot(lerp(ax, bx, u), lerp(ay, by, u), 2.2, rgba(WHITE, 0.85 * flow));
          });
        }

        // tiles
        pts.forEach((p, i) => {
          rr(p.x, p.y, tw, th, 12);
          ctx.fillStyle = rgba(ACC, 0.06 + 0.08 * join);
          ctx.fill();
          ctx.strokeStyle = rgba(BLUE, 0.45 + 0.3 * join);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          label(mods[i](), p.x + 16, p.y + th * 0.38, rgba(WHITE, 0.92), 13.5, "left");
          ctx.fillStyle = rgba(BLUE, 0.28);
          rr(p.x + 16, p.y + th * 0.64, tw * (0.32 + ((i * 37) % 30) / 100), 3, 1.5);
          ctx.fill();
          dot(p.x + tw - 16, p.y + th * 0.38, 3, rgba(join > 0.9 ? OK : BLUE, 0.8));
        });
      };
    };

    /* =========================================================
       05 · Integration — optical threads between systems
       ========================================================= */
    const integration = () => {
      const left = [() => L("Bank", "Bank"), () => L("Ödəniş", "Payments"), () => "ERP", () => L("Dövlət", "Gov"), () => "CRM"];
      const right = [() => L("Sayt", "Website"), () => L("Mobil", "Mobile"), () => L("Anbar", "Stock"), () => L("Hesabat", "Reports"), () => L("Kassa", "POS")];
      const n = left.length;
      let from = [0, 1, 2, 3, 4], to = [2, 0, 4, 1, 3], switchedAt = 0;
      const shuffle = () => {
        const a = [...to];
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      };
      const bez = (p0, p1, p2, p3, u) => {
        const v = 1 - u;
        return [
          v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
        ];
      };

      return (t) => {
        if (t - switchedAt > 4.2) { switchedAt = t; from = to; to = shuffle(); }
        const mix = easeIO(seg(t - switchedAt, 0, 1.4));
        const lx = W * 0.17, rx = W * 0.83;
        const portY = (i) => H * (0.2 + (i / (n - 1)) * 0.6);
        const hub = [cx + ptr.x * 22, cy + ptr.y * 50];

        // threads: port → hub → port, two cubic halves
        const paths = [];
        for (let i = 0; i < n; i++) {
          const ty = lerp(portY(from[i]), portY(to[i]), mix);
          const spread = (i - (n - 1) / 2) * 5;
          const a = [lx + 46, portY(i)], b = [hub[0], hub[1] + spread], d = [rx - 46, ty];
          const left1 = [a, [a[0] + W * 0.16, a[1]], [b[0] - W * 0.12, b[1]], b];
          const right1 = [b, [b[0] + W * 0.12, b[1]], [d[0] - W * 0.16, d[1]], d];
          paths.push([left1, right1]);
          ctx.strokeStyle = rgba(BLUE, 0.26);
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(...left1[0]);
          ctx.bezierCurveTo(...left1[1], ...left1[2], ...left1[3]);
          ctx.bezierCurveTo(...right1[1], ...right1[2], ...right1[3]);
          ctx.stroke();
        }

        // light pulses with short tails
        paths.forEach(([p, q], i) => {
          for (let m = 0; m < 2; m++) {
            const u = ((t * 0.32 + i * 0.21 + m * 0.5) % 1);
            for (let k = 0; k < 6; k++) {
              const uu = u - k * 0.012;
              if (uu < 0) break;
              const pt = uu < 0.5 ? bez(...p, uu * 2) : bez(...q, (uu - 0.5) * 2);
              dot(pt[0], pt[1], 2.4 - k * 0.3, rgba(k ? ACC : WHITE, (1 - k / 6) * 0.9));
            }
          }
        });

        // hub
        glow(hub[0], hub[1], 34, ACC, 0.3);
        ctx.strokeStyle = rgba(ACC, 0.8);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(hub[0], hub[1], 13, 0, Math.PI * 2); ctx.stroke();
        label("API", hub[0], hub[1] - 26, rgba(ACC, 0.9), 11);

        // ports
        const port = (x, y, text, side) => {
          rr(x - 44, y - 15, 88, 30, 15);
          ctx.fillStyle = rgba("12,15,24", 0.9);
          ctx.fill();
          ctx.strokeStyle = rgba(BLUE, 0.5);
          ctx.lineWidth = 1.1;
          ctx.stroke();
          label(text, x, y + 0.5, rgba(WHITE, 0.9), 12);
          dot(x + side * 44, y, 3, rgba(ACC, 0.9));
        };
        for (let i = 0; i < n; i++) {
          port(lx, portY(i), left[i](), 1);
          port(rx, portY(i), right[i](), -1);
        }
      };
    };

    /* =========================================================
       06 · Websites & e-commerce — a deck of sites
       ========================================================= */
    const web = () => {
      const layouts = ["landing", "shop", "article", "portal"];
      const content = (kind, x, y, w, h, a) => {
        ctx.fillStyle = rgba(BLUE, 0.22 * a);
        ctx.strokeStyle = rgba(BLUE, 0.4 * a);
        ctx.lineWidth = 1;
        const bar = (bx, by, bw, bh = 4) => { rr(bx, by, bw, bh, bh / 2); ctx.fill(); };
        if (kind === "landing") {
          bar(x + w * 0.08, y + h * 0.18, w * 0.42, 9);
          bar(x + w * 0.08, y + h * 0.3, w * 0.3, 9);
          bar(x + w * 0.08, y + h * 0.45, w * 0.36);
          bar(x + w * 0.08, y + h * 0.52, w * 0.28);
          rr(x + w * 0.08, y + h * 0.64, w * 0.16, h * 0.1, h * 0.05);
          ctx.fillStyle = rgba(ACC, 0.5 * a); ctx.fill();
          rr(x + w * 0.56, y + h * 0.14, w * 0.36, h * 0.66, 10); ctx.stroke();
        } else if (kind === "shop") {
          for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
            const px = x + w * (0.06 + k * 0.23), py = y + h * (0.12 + r * 0.43);
            rr(px, py, w * 0.2, h * 0.26, 8); ctx.stroke();
            ctx.fillStyle = rgba(BLUE, 0.22 * a);
            bar(px, py + h * 0.3, w * 0.14);
            ctx.fillStyle = rgba(ACC, 0.45 * a);
            bar(px, py + h * 0.35, w * 0.07);
          }
        } else if (kind === "article") {
          rr(x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.32, 10); ctx.stroke();
          bar(x + w * 0.08, y + h * 0.52, w * 0.6, 8);
          for (let i = 0; i < 4; i++) bar(x + w * 0.08, y + h * (0.64 + i * 0.07), w * (0.84 - (i % 2) * 0.2));
        } else {
          rr(x + w * 0.04, y + h * 0.08, w * 0.2, h * 0.84, 8); ctx.stroke();
          for (let i = 0; i < 5; i++) bar(x + w * 0.07, y + h * (0.16 + i * 0.1), w * 0.12);
          for (let i = 0; i < 6; i++) {
            rr(x + w * 0.3, y + h * (0.1 + i * 0.13), w * 0.64, h * 0.09, 5);
            ctx.strokeStyle = rgba(BLUE, (i ? 0.25 : 0.45) * a);
            ctx.stroke();
          }
        }
      };

      return (t) => {
        const period = 3.6;
        const step = Math.floor(t / period);
        const mv = easeIO(seg(t % period, 2.6, period));
        const w = W * 0.64, h = H * 0.5;
        // back to front; the front one slides out and rejoins at the back
        const order = [3, 2, 1, 0];
        order.forEach((d) => {
          const depth = d - mv;                      // 3..-1
          const idx = (step + d) % layouts.length;
          const leaving = depth < 0;
          const dd = leaving ? 0 : depth;
          const sc = 1 - dd * 0.07;
          const x = cx - (w * sc) / 2 + dd * 34 + ptr.x * (16 - dd * 4) + (leaving ? -depth * W * 0.35 : 0);
          const y = cy - (h * sc) / 2 - dd * 30 + S * 0.08 + ptr.y * (12 - dd * 3) + (leaving ? -depth * 30 : 0);
          const a = (1 - dd * 0.22) * (leaving ? 1 + depth : 1);
          if (a <= 0) return;
          const ww = w * sc, hh = h * sc;
          rr(x, y, ww, hh, 14);
          ctx.fillStyle = rgba("11,14,22", 0.92);
          ctx.fill();
          ctx.strokeStyle = rgba(dd < 0.5 ? ACC : BLUE, (dd < 0.5 ? 0.7 : 0.4) * a);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          for (let i = 0; i < 3; i++) dot(x + 16 + i * 11, y + 15, 2.8, rgba(BLUE, 0.5 * a));
          rr(x + ww * 0.3, y + 9, ww * 0.4, 12, 6);
          ctx.fillStyle = rgba(BLUE, 0.1 * a);
          ctx.fill();
          line(x, y + 30, x + ww, y + 30);
          content(layouts[idx], x, y + 30, ww, hh - 30, a);
        });
      };
    };

    /* =========================================================
       07 · IT infrastructure — an isometric server floor
       ========================================================= */
    const infra = () => {
      const blocks = [
        [0, 0, 2.4], [1, 0, 1.6], [3, 0, 2], [0, 2, 1.4], [2, 1, 2.8],
        [4, 1, 1.2], [1, 3, 2.2], [3, 3, 1.6], [4, 4, 2.6], [2, 4, 1.2],
      ].map(([gx, gy, h], i) => ({ gx, gy, h, delay: i * 0.03, leds: [rnd(), rnd(), rnd()] }));
      const N = 5;
      let packets = [];
      let lastPacket = 0;

      return (t, dt) => {
        const tile = S * 0.105;
        const iso = (gx, gy, z = 0) => [
          cx + (gx - gy) * tile * 0.87 + ptr.x * 10,
          cy - S * 0.02 + (gx + gy - (N - 1)) * tile * 0.5 - z * tile * 0.62 + ptr.y * 8,
        ];
        const c = cyc(t, 14);
        const rise = (b) => easeIO(seg(c, b.delay, b.delay + 0.12)) * (1 - easeIO(seg(c, 0.95, 1)));

        // floor grid
        ctx.strokeStyle = rgba(BLUE, 0.12);
        ctx.lineWidth = 1;
        for (let i = 0; i <= N; i++) {
          line(...iso(i - 0.5, -0.5), ...iso(i - 0.5, N - 0.5));
          line(...iso(-0.5, i - 0.5), ...iso(N - 0.5, i - 0.5));
        }

        // packets travelling along the grid between racks
        if (!reduced && t - lastPacket > 0.7) {
          lastPacket = t;
          const a = blocks[(rnd() * blocks.length) | 0], b = blocks[(rnd() * blocks.length) | 0];
          if (a !== b) packets.push({ a, b, u: 0 });
        }
        packets.forEach((p) => {
          p.u += dt * 0.45;
          const len1 = Math.abs(p.b.gx - p.a.gx), len2 = Math.abs(p.b.gy - p.a.gy);
          const tot = len1 + len2 || 1;
          const d = p.u * tot;
          const gx = d < len1 ? p.a.gx + Math.sign(p.b.gx - p.a.gx) * d : p.b.gx;
          const gy = d < len1 ? p.a.gy : p.a.gy + Math.sign(p.b.gy - p.a.gy) * (d - len1);
          const [x, y] = iso(gx, gy);
          glow(x, y, 10, ACC, 0.5);
          dot(x, y, 2.2, rgba(WHITE, 0.95));
        });
        packets = packets.filter((p) => p.u < 1);

        // racks, painted back to front
        const near = (b) => {
          const [x, y] = iso(b.gx, b.gy, b.h * 0.5);
          return Math.hypot(ptr.mx - x, ptr.my - y) < tile * 1.1;
        };
        [...blocks].sort((p, q) => p.gx + p.gy - (q.gx + q.gy)).forEach((b) => {
          const k = rise(b);
          if (k <= 0.001) return;
          const lift = near(b) ? 0.35 : 0;
          b.lift = lerp(b.lift || 0, lift, 0.12);
          const h = b.h * k + b.lift;
          const s = 0.42;                              // half-size of a rack in grid units
          const top = [iso(b.gx - s, b.gy - s, h), iso(b.gx + s, b.gy - s, h), iso(b.gx + s, b.gy + s, h), iso(b.gx - s, b.gy + s, h)];
          const base = [iso(b.gx - s, b.gy - s), iso(b.gx + s, b.gy - s), iso(b.gx + s, b.gy + s), iso(b.gx - s, b.gy + s)];
          const face = (pts, fill) => {
            ctx.beginPath();
            pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = rgba(BLUE, 0.55);
            ctx.lineWidth = 1;
            ctx.stroke();
          };
          face([top[3], top[2], base[2], base[3]], rgba("14,18,28", 0.96));  // left face
          face([top[1], top[2], base[2], base[1]], rgba("10,13,20", 0.96));  // right face
          face(top, rgba(ACC, 0.12 + b.lift * 0.4));                         // lid
          // LEDs along the left face
          const rows = Math.max(1, Math.floor(h * 2));
          for (let r = 0; r < rows; r++) {
            const z = (r + 0.6) / 2;
            if (z > h - 0.1) break;
            b.leds.forEach((ph, i) => {
              const on = Math.sin(t * (2 + i) + ph * 10 + r) > 0.2;
              const [x, y] = iso(b.gx - s + 0.2 + i * 0.22, b.gy + s, z);
              dot(x, y, 1.6, rgba(i === 2 ? OK : ACC, on ? 0.95 : 0.2));
            });
          }
        });
      };
    };

    /* =========================================================
       08 · Support — a 24-hour dial that closes tickets
       ========================================================= */
    const support = () => {
      let tickets = [];
      let lastSpawn = 0;
      const TAU = Math.PI * 2;
      const SWEEP = 5.5;                        // seconds per turn

      return (t, dt) => {
        const R = S * 0.38;
        const ox = cx + ptr.x * 10, oy = cy + ptr.y * 8;
        const hand = ((t / SWEEP) % 1) * TAU - Math.PI / 2;

        // dial
        ctx.strokeStyle = rgba(BLUE, 0.25);
        ctx.lineWidth = 1;
        [1, 0.66, 0.33].forEach((k) => { ctx.beginPath(); ctx.arc(ox, oy, R * k, 0, TAU); ctx.stroke(); });
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU - Math.PI / 2;
          const long = i % 6 === 0;
          ctx.strokeStyle = rgba(BLUE, long ? 0.7 : 0.35);
          ctx.lineWidth = long ? 1.6 : 1;
          line(ox + Math.cos(a) * R * (long ? 0.9 : 0.94), oy + Math.sin(a) * R * (long ? 0.9 : 0.94), ox + Math.cos(a) * R, oy + Math.sin(a) * R);
          if (long) label(String(i).padStart(2, "0"), ox + Math.cos(a) * R * 1.12, oy + Math.sin(a) * R * 1.12, rgba(BLUE, 0.7), 11);
        }

        // sweep: a fading wedge behind the hand
        for (let k = 0; k < 24; k++) {
          const a0 = hand - (k + 1) * 0.035, a1 = hand - k * 0.035;
          ctx.fillStyle = rgba(ACC, 0.16 * (1 - k / 24));
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.arc(ox, oy, R, a0, a1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = rgba(WHITE, 0.85);
        ctx.lineWidth = 1.5;
        line(ox, oy, ox + Math.cos(hand) * R, oy + Math.sin(hand) * R);

        // tickets arrive; the sweep resolves them as it passes
        if (!reduced && t - lastSpawn > 0.45) {
          lastSpawn = t;
          tickets.push({ a: rnd() * TAU, r: R * (0.25 + rnd() * 0.68), born: t, done: 0 });
        }
        tickets.forEach((k) => {
          const ang = k.a - Math.PI / 2;
          const rel = ((((hand - ang) % TAU) + TAU) % TAU);
          if (!k.done && t - k.born > 0.3 && rel < 0.12) k.done = t;
          const x = ox + Math.cos(ang) * k.r, y = oy + Math.sin(ang) * k.r;
          if (!k.done) {
            const a = seg(t - k.born, 0, 0.3);
            glow(x, y, 9, WARN, 0.35 * a);
            dot(x, y, 2.6, rgba(WARN, 0.95 * a));
          } else {
            const u = seg(t - k.done, 0, 1.1);
            ctx.strokeStyle = rgba(OK, 0.8 * (1 - u));
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(x, y, 3 + u * 14, 0, TAU); ctx.stroke();
            dot(x, y, 2.6, rgba(OK, 1 - u));
          }
        });
        tickets = tickets.filter((k) => !k.done || t - k.done < 1.1);

        // centre
        ctx.fillStyle = rgba("9,11,17", 0.92);
        ctx.beginPath(); ctx.arc(ox, oy, R * 0.24, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(ACC, 0.6);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        label("24/7", ox, oy - 3, rgba(WHITE, 0.95), Math.round(R * 0.15));
        label("SLA", ox, oy + R * 0.11, rgba(ACC, 0.8), 10);
      };
    };

    /* ---------- run ---------- */
    const scenes = { software, ai, security, crm, integration, web, infra, support };
    const make = scenes[canvas.dataset.art];
    if (!make) return;
    const scene = make();

    let raf = null, last = 0, t = 0;
    const frame = (now) => {
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      t += dt;
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      ptr.y += (ptr.ty - ptr.y) * 0.06;
      ctx.clearRect(0, 0, W, H);
      scene(t, dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };

    new ResizeObserver(() => { resize(); if (reduced || !raf) { ctx.clearRect(0, 0, W, H); scene(t, 0); } }).observe(canvas);
    resize();

    // review aid: ?art-t=6 renders the scene frozen at second 6 (stepped, so
    // stateful scenes have their particles) — handy for checking each phase
    const freeze = parseFloat(new URLSearchParams(location.search).get("art-t"));
    if (Number.isFinite(freeze)) {
      for (t = 0; t < freeze; t += 1 / 30) { ctx.clearRect(0, 0, W, H); scene(t, 1 / 30); }
      return;
    }

    if (reduced || cover) {
      // a finished frame instead of a loop; covers come alive while hovered
      t = STILL[canvas.dataset.art] || 5;
      for (let tt = 0; tt < t; tt += 1 / 30) { ctx.clearRect(0, 0, W, H); scene(tt, 1 / 30); }
      if (reduced) return;
      const host = canvas.closest(".post-card") || canvas.parentElement;
      host.addEventListener("pointerenter", start);
      host.addEventListener("pointerleave", stop);
      return;
    }
    new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop())).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  };

  document.querySelectorAll("canvas[data-art]").forEach(mount);
})();
