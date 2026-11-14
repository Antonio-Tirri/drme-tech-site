// Banner animato: piste PCB con impulsi di segnale + matrice LED.
// - Nessuna libreria. Colori letti dalle variabili CSS (--blue, --night, --on-night).
// - prefers-reduced-motion: disegna un solo fotogramma statico, nessun ciclo.
// - Si ferma quando il banner non è visibile o la scheda è in background.
(() => {
  const heroes = document.querySelectorAll(".hero");
  if (!heroes.length) return;

  const css = getComputedStyle(document.documentElement);
  const hexToRgb = (hex) => {
    const h = hex.trim().replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const BLUE = hexToRgb(css.getPropertyValue("--blue") || "#1877f2");
  const NIGHT = hexToRgb(css.getPropertyValue("--night") || "#0a0e18");
  const WHITE = hexToRgb(css.getPropertyValue("--on-night") || "#ffffff");
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // "d" del logo: 5×7 pixel, tratto singolo.
  const GLYPH = ["....#", "....#", "#####", "#...#", "#...#", "#...#", "#####"];

  // Generatore pseudo-casuale con seme: stesso disegno a ogni caricamento.
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  heroes.forEach((hero, index) => setup(hero, index));

  function setup(hero, index) {
    const canvas = document.createElement("canvas");
    canvas.className = "hero-fx";
    canvas.setAttribute("aria-hidden", "true");
    hero.prepend(canvas);
    hero.classList.add("fx-on");

    const ctx = canvas.getContext("2d");
    const small = hero.classList.contains("small");
    const traceLayer = document.createElement("canvas");
    const tctx = traceLayer.getContext("2d");

    let W = 0, H = 0, dpr = 1;
    let traces = [], pulses = [], leds = [], matrix = null;
    let pointer = { x: -1e4, y: -1e4, active: false };
    let running = false, raf = 0, last = 0, t = 0, visible = true;
    let glyphTimer = 3, glyphLevel = 0;

    function build() {
      const r = hero.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [canvas, traceLayer]) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rand = rng(7 + index);
      const G = 24;
      const cols = Math.ceil(W / G), rows = Math.ceil(H / G);

      // Piste: spezzate su griglia a 0°/45°/90°.
      traces = [];
      const count = Math.round((W * H) / (small ? 26000 : 18000));
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1]];
      for (let i = 0; i < count; i++) {
        let x = Math.floor(rand() * cols) * G, y = Math.floor(rand() * rows) * G;
        const pts = [[x, y]];
        const segs = 2 + Math.floor(rand() * 4);
        for (let s = 0; s < segs; s++) {
          const d = dirs[Math.floor(rand() * dirs.length)];
          const len = (2 + Math.floor(rand() * 9)) * G;
          x += d[0] * len; y += d[1] * len;
          pts.push([x, y]);
        }
        const lens = [];
        let total = 0;
        for (let p = 1; p < pts.length; p++) {
          const l = Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]);
          lens.push(l); total += l;
        }
        traces.push({ pts, lens, total, a: 0.10 + rand() * 0.14, flash: 0 });
      }

      // Livello statico delle piste: disegnato una volta sola.
      tctx.clearRect(0, 0, W, H);
      tctx.lineWidth = 2;
      tctx.lineJoin = "round";
      for (const tr of traces) {
        tctx.strokeStyle = rgba(BLUE, tr.a);
        tctx.beginPath();
        tr.pts.forEach(([px, py], k) => (k ? tctx.lineTo(px, py) : tctx.moveTo(px, py)));
        tctx.stroke();
        for (const [px, py] of [tr.pts[0], tr.pts[tr.pts.length - 1]]) {
          tctx.strokeStyle = rgba(BLUE, tr.a + 0.08);
          tctx.beginPath(); tctx.arc(px, py, 6, 0, Math.PI * 2); tctx.stroke();
        }
      }

      // Matrice LED: a destra su desktop, sfondo leggero su telefono.
      const P = small ? 20 : 22;
      const narrow = W < 720;
      const mx0 = narrow ? P : Math.round(W * 0.56 / P) * P;
      const my0 = P * 2;
      const mcols = Math.max(0, Math.floor((W - mx0 - P) / P) + 1);
      const mrows = Math.max(0, Math.floor((H - my0 - P) / P) + 1);
      matrix = { x0: mx0, y0: my0, P, cols: mcols, rows: mrows, dim: narrow ? 0.45 : 1 };
      leds = new Float32Array(mcols * mrows);
      for (let i = 0; i < leds.length; i++) leds[i] = rand() < 0.08 ? rand() : 0;

      pulses = [];
      const pc = Math.max(4, Math.round(traces.length * 0.35));
      for (let i = 0; i < pc; i++) pulses.push(newPulse(rand, true));
    }

    function newPulse(rand = Math.random, scatter = false) {
      const tr = traces[Math.floor(rand() * traces.length)];
      return { tr, d: scatter ? rand() * tr.total : 0, v: 60 + rand() * 110 };
    }

    function pointAt(tr, d) {
      let acc = 0;
      for (let i = 0; i < tr.lens.length; i++) {
        if (acc + tr.lens[i] >= d) {
          const k = (d - acc) / tr.lens[i];
          const a = tr.pts[i], b = tr.pts[i + 1];
          return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
        }
        acc += tr.lens[i];
      }
      return tr.pts[tr.pts.length - 1];
    }

    function glyphCells() {
      const { cols, rows } = matrix;
      const S = cols >= 16 && rows >= 18 ? 2 : 1;
      const gw = 5 * S, gh = 7 * S;
      if (cols < gw + 2 || rows < gh + 2) return null;
      const c0 = Math.floor((cols - gw) / 2), r0 = Math.floor((rows - gh) / 2);
      const set = new Set();
      GLYPH.forEach((row, gy) => [...row].forEach((ch, gx) => {
        if (ch !== "#") return;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++)
          set.add((r0 + gy * S + sy) * cols + (c0 + gx * S + sx));
      }));
      return set;
    }

    function step(dt) {
      t += dt;
      const { x0, y0, P, cols, rows } = matrix;

      // Onda diagonale che attraversa la matrice + scintille casuali.
      const span = cols + rows;
      const wave = ((t * 9) % (span + 14)) - 7;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let v = leds[i] * Math.exp(-dt * 2.6);
        const dist = Math.abs(c + r - wave);
        if (dist < 1.2 && ((c * 7 + r * 13) % 5) < 2) v = Math.max(v, 0.85);
        if (Math.random() < dt * 0.05) v = Math.max(v, 0.4 + Math.random() * 0.5);
        if (pointer.active) {
          const px = x0 + c * P, py = y0 + r * P;
          const pd = Math.hypot(px - pointer.x, py - pointer.y);
          if (pd < 80) v = Math.max(v, 1 - pd / 80);
        }
        leds[i] = v;
      }

      // La "d" compare ogni ~9 s per circa 3 s.
      glyphTimer -= dt;
      if (glyphTimer < 0) glyphTimer = 9;
      const target = glyphTimer > 6 ? 1 : 0;
      glyphLevel += (target - glyphLevel) * Math.min(1, dt * 3);

      for (const p of pulses) {
        p.d += p.v * dt;
        if (p.d >= p.tr.total) {
          p.tr.flash = 1;
          Object.assign(p, newPulse());
        }
      }
      for (const tr of traces) tr.flash = Math.max(0, tr.flash - dt * 1.8);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Fondo: notte con leggera sfumatura verso il basso.
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, rgba(NIGHT, 1));
      bg.addColorStop(1, rgba([NIGHT[0] + 6, NIGHT[1] + 10, NIGHT[2] + 22], 1));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.drawImage(traceLayer, 0, 0, W, H);

      // Via illuminati dove arriva un impulso o passa il cursore.
      for (const tr of traces) {
        const end = tr.pts[tr.pts.length - 1];
        let glow = tr.flash;
        if (pointer.active) {
          for (const p of [tr.pts[0], end]) {
            const pd = Math.hypot(p[0] - pointer.x, p[1] - pointer.y);
            if (pd < 90) glow = Math.max(glow, 1 - pd / 90);
          }
        }
        if (glow > 0.02) {
          ctx.fillStyle = rgba(BLUE, glow * 0.9);
          ctx.shadowColor = rgba(BLUE, glow);
          ctx.shadowBlur = 14 * glow;
          ctx.beginPath(); ctx.arc(end[0], end[1], 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Impulsi: testa luminosa con scia.
      for (const p of pulses) {
        for (let k = 0; k < 6; k++) {
          const d = p.d - k * 6;
          if (d < 0) break;
          const [x, y] = pointAt(p.tr, d);
          ctx.fillStyle = k === 0 ? rgba(WHITE, 0.9) : rgba(BLUE, 0.6 * (1 - k / 6));
          ctx.beginPath(); ctx.arc(x, y, k === 0 ? 2.2 : 2.6 - k * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Matrice LED.
      const { x0, y0, P, cols, rows, dim } = matrix;
      const glyph = glyphLevel > 0.02 ? glyphCells() : null;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let v = leds[i];
        if (glyph) v = glyph.has(i) ? Math.max(v, glyphLevel) : v * (1 - glyphLevel * 0.7);
        const x = x0 + c * P, y = y0 + r * P;
        if (v > 0.05) {
          ctx.fillStyle = rgba(BLUE, (0.35 + v * 0.65) * dim);
          ctx.shadowColor = rgba(BLUE, v * dim);
          ctx.shadowBlur = 10 * v;
          ctx.beginPath(); ctx.arc(x, y, 3.2 + v * 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = rgba(BLUE, 0.16 * dim);
          ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Velo a sinistra per mantenere leggibile il testo.
      const veil = ctx.createLinearGradient(0, 0, W * 0.62, 0);
      veil.addColorStop(0, rgba(NIGHT, W < 720 ? 0.72 : 0.82));
      veil.addColorStop(1, rgba(NIGHT, 0));
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, H);
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduce.matches || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function staticFrame() {
      glyphLevel = 1;
      glyphTimer = 7;
      draw();
    }

    function refresh() {
      build();
      if (reduce.matches) { stop(); staticFrame(); } else { draw(); start(); }
    }

    new ResizeObserver(() => refresh()).observe(hero);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    reduce.addEventListener?.("change", refresh);

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
    });
    hero.addEventListener("pointerleave", () => (pointer.active = false));

    refresh();
  }
})();
