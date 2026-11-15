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
  // Nome del marchio: arriva dai testi del sito (locales/*.json → data-brand sul <body>).
  const BRAND = document.body.dataset.brand || "";


  // Generatore pseudo-casuale con seme: stesso disegno a ogni caricamento.
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  heroes.forEach((hero, index) => setup(hero, index));

  function setup(hero, index) {
    const canvas = document.createElement("canvas");
    canvas.className = "hero-fx hero-fx-live";
    canvas.setAttribute("aria-hidden", "true");
    // Posizionamento essenziale scritto qui e non solo nel CSS: se il foglio di stile
    // manca o è vecchio, il canvas resta comunque fuori dal flusso e non può far crescere il banner.
    Object.assign(canvas.style, { position: "absolute", inset: "0", zIndex: "-1", display: "block", pointerEvents: "none" });
    if (getComputedStyle(hero).position === "static") hero.style.position = "relative";
    hero.style.overflow = "hidden";
    hero.style.isolation = "isolate";
    // Due livelli: sotto lo sfondo statico (disegnato solo al ridimensionamento),
    // sopra le luci animate su fondo trasparente. A ogni fotogramma si ridisegnano solo le luci.
    const traceLayer = document.createElement("canvas");
    traceLayer.className = "hero-fx hero-fx-static";
    traceLayer.setAttribute("aria-hidden", "true");
    Object.assign(traceLayer.style, { position: "absolute", inset: "0", zIndex: "-2", display: "block", pointerEvents: "none" });
    hero.prepend(canvas);
    hero.prepend(traceLayer);
    hero.classList.add("fx-on");

    const ctx = canvas.getContext("2d");
    const small = hero.classList.contains("small");
    const tctx = traceLayer.getContext("2d");

    let W = 0, H = 0, dpr = 1, veilMax = 0.82, veilW = 1;
    // Le luci animate stanno sopra il velo: le attenuiamo con la stessa sfumatura.
    const veilAt = (x) => 1 - veilMax * Math.max(0, 1 - x / veilW);
    let traces = [], pulses = [], leds = [], matrix = null;
    let pointer = { x: -1e4, y: -1e4, active: false };
    let running = false, raf = 0, last = 0, t = 0, visible = true;
    let glyphLevel = 0, glyph = null, targets = null, sprites = null;
    // Ciclo della "d": dissolvenza in 1,4 s, accesa 3,6 s, dissolvenza out 1,6 s, spenta.
    const CYCLE = 10, IN = 1.4, HOLD = 5, OUT = 6.6, T0 = 2;
    const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const glyphAt = (time) => {
      const ph = (time + CYCLE - T0) % CYCLE;
      return ph < IN ? smooth(0, IN, ph) : ph < HOLD ? 1 : ph < OUT ? 1 - smooth(HOLD, OUT, ph) : 0;
    };

    function build() {
      const r = hero.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [canvas, traceLayer]) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      for (const c of [canvas, traceLayer]) { c.style.width = W + "px"; c.style.height = H + "px"; }
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
      const bgr = tctx.createLinearGradient(0, 0, 0, H);
      bgr.addColorStop(0, rgba(NIGHT, 1));
      bgr.addColorStop(1, rgba([NIGHT[0] + 6, NIGHT[1] + 10, NIGHT[2] + 22], 1));
      tctx.fillStyle = bgr;
      tctx.fillRect(0, 0, W, H);
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

      targets = new Float32Array(mcols * mrows);
      // LED spenti: statici, disegnati una volta nello sfondo (sotto il velo).
      tctx.fillStyle = rgba(BLUE, 0.16 * matrix.dim);
      tctx.beginPath();
      for (let r = 0; r < mrows; r++) for (let c = 0; c < mcols; c++) {
        const x = mx0 + c * P, y = my0 + r * P;
        tctx.moveTo(x + 3, y); tctx.arc(x, y, 3, 0, Math.PI * 2);
      }
      tctx.fill();
      // Velo a sinistra (leggibilità dei testi), cotto nello sfondo statico.
      veilMax = W < 720 ? 0.72 : 0.82;
      veilW = W * 0.62;
      const vg = tctx.createLinearGradient(0, 0, veilW, 0);
      vg.addColorStop(0, rgba(NIGHT, veilMax));
      vg.addColorStop(1, rgba(NIGHT, 0));
      tctx.fillStyle = vg;
      tctx.fillRect(0, 0, W, H);
      glyph = glyphCells();
      sprites = makeSprites(P);

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

    // Sprite luminosi disegnati una volta sola: niente ombre calcolate a ogni fotogramma.
    function sprite(sizeCss, paint) {
      const c = document.createElement("canvas");
      c.width = c.height = Math.ceil(sizeCss * dpr);
      const g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(g, sizeCss / 2);
      return { c, half: sizeCss / 2 };
    }
    function makeSprites(P) {
      // LED rotondo blu: nucleo + alone sfumato.
      const led = sprite(34, (g, h) => {
        const halo = g.createRadialGradient(h, h, 0, h, h, h);
        halo.addColorStop(0, rgba(BLUE, 0.55));
        halo.addColorStop(0.35, rgba(BLUE, 0.22));
        halo.addColorStop(1, rgba(BLUE, 0));
        g.fillStyle = halo; g.fillRect(0, 0, 2 * h, 2 * h);
        const core = g.createRadialGradient(h - 1, h - 1, 0, h, h, 5.6);
        core.addColorStop(0, rgba([Math.min(255, BLUE[0] + 90), Math.min(255, BLUE[1] + 90), 255], 1));
        core.addColorStop(1, rgba(BLUE, 1));
        g.fillStyle = core; g.beginPath(); g.arc(h, h, 5.4, 0, Math.PI * 2); g.fill();
      });
      // Cella quadrata bianca accesa, come un pixel del logo dietro un diffusore:
      // centro bianco pieno, bordi che sfumano nel blu, alone blu tutto intorno.
      const side = P * 0.84;
      const pix = sprite(P * 2.6, (g, h) => {
        const halo = g.createRadialGradient(h, h, side * 0.3, h, h, h);
        halo.addColorStop(0, rgba(BLUE, 0.6));
        halo.addColorStop(0.45, rgba(BLUE, 0.2));
        halo.addColorStop(1, rgba(BLUE, 0));
        g.fillStyle = halo; g.fillRect(0, 0, 2 * h, 2 * h);
        const cell = g.createRadialGradient(h, h, 0, h, h, side * 0.72);
        cell.addColorStop(0, rgba(WHITE, 1));
        cell.addColorStop(0.55, rgba(WHITE, 0.95));
        cell.addColorStop(1, rgba([Math.round((WHITE[0] + BLUE[0]) / 2), Math.round((WHITE[1] + BLUE[1]) / 2), 255], 0.85));
        g.fillStyle = cell;
        const r = Math.min(3, side * 0.14);
        const x = h - side / 2, y = h - side / 2;
        g.beginPath();
        g.moveTo(x + r, y); g.arcTo(x + side, y, x + side, y + side, r); g.arcTo(x + side, y + side, x, y + side, r);
        g.arcTo(x, y + side, x, y, r); g.arcTo(x, y, x + side, y, r); g.closePath(); g.fill();
      });
      // Celle a righe, come la "d" del logo: righe orizzontali sui tratti verticali, verticali su quelli orizzontali.
      const lines = (vertical) => sprite(P * 2.6, (g, h) => {
        const halo = g.createRadialGradient(h, h, side * 0.3, h, h, h);
        halo.addColorStop(0, rgba(BLUE, 0.5));
        halo.addColorStop(0.45, rgba(BLUE, 0.16));
        halo.addColorStop(1, rgba(BLUE, 0));
        g.fillStyle = halo; g.fillRect(0, 0, 2 * h, 2 * h);
        g.fillStyle = rgba(WHITE, 0.97);
        const x = h - side / 2, y = h - side / 2, n = 3, step = side / n, th = step * 0.62;
        for (let i = 0; i < n; i++) {
          if (vertical) g.fillRect(x + i * step, y, th, side);
          else g.fillRect(x, y + i * step, side, th);
        }
      });
      return { led, pix, pixH: lines(false), pixV: lines(true) };
    }
    function blit(sp, x, y, alpha) {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(sp.c, x - sp.half, y - sp.half, sp.half * 2, sp.half * 2);
    }

    function glyphCells() {
      const { cols, rows, dim } = matrix;
      // Su schermi stretti la matrice sta dietro ai testi: niente "d" né scritta, per non disturbare la lettura.
      if (dim < 1) return null;
      // La "d" del logo: 4 colonne × 6 righe. Angoli pieni, tratti verticali a righe orizzontali,
      // tratti orizzontali a righe verticali.
      const D = ["...#", "...#", "####", "#..#", "#..#", "####"];
      const gw = 4, gh = 6;
      if (cols < gw + 2 || rows < gh + 2) return null;
      const c0 = Math.floor((cols - gw) / 2), r0 = Math.floor((rows - gh) / 2) - 1;
      const on = (x, y) => D[y] && D[y][x] === "#";
      const set = new Map();
      D.forEach((row, gy) => [...row].forEach((ch, gx) => {
        if (ch !== "#") return;
        const h = on(gx - 1, gy) || on(gx + 1, gy), v = on(gx, gy - 1) || on(gx, gy + 1);
        set.set((r0 + gy) * cols + (c0 + gx), h && v ? "pix" : h ? "pixV" : "pixH");
      }));
      set.c0 = c0; set.r0 = r0;
      return set;
    }

    function step(dt) {
      t += dt;
      const { x0, y0, P, cols, rows } = matrix;

      // Onda diagonale + scintille + cursore danno un "obiettivo" di luminosità;
      // ogni LED ci arriva con salita rapida ma graduale e si spegne lentamente.
      const span = cols + rows;
      const wave = ((t * 9) % (span + 14)) - 7;
      const rise = Math.min(1, dt * 14), fall = Math.exp(-dt * 2.4);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let tg = targets[i] * Math.exp(-dt * 6);
        const dist = Math.abs(c + r - wave);
        if (dist < 1.2 && ((c * 7 + r * 13) % 5) < 2) tg = Math.max(tg, 0.85 * (1 - dist / 1.2) + 0.15);
        if (Math.random() < dt * 0.05) tg = Math.max(tg, 0.4 + Math.random() * 0.5);
        if (pointer.active) {
          const px = x0 + c * P, py = y0 + r * P;
          const pd = Math.hypot(px - pointer.x, py - pointer.y);
          if (pd < 80) tg = Math.max(tg, 1 - pd / 80);
        }
        targets[i] = tg;
        const v = leds[i];
        leds[i] = tg > v ? v + (tg - v) * rise : v * fall;
      }

      glyphLevel = glyphAt(t);

      for (const p of pulses) {
        p.d += p.v * dt;
        if (p.d >= p.tr.total) {
          p.tr.flash = 1;
          Object.assign(p, newPulse());
        }
      }
      for (const tr of traces) tr.flash = Math.max(0, tr.flash - dt * 1.8);
    }

    // Carattere a pixel del logo (7 righe; righe 0-1 aste, 2-6 minuscole).
    const FONT = {
      d: ["....#", "....#", "#####", "#...#", "#...#", "#...#", "#####"],
      r: ["....", "....", "####", "#...", "#...", "#...", "#..."],
      o: [".....", ".....", "#####", "#...#", "#...#", "#...#", "#####"],
      m: [".....", ".....", "#####", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
      e: [".....", ".....", "#####", "#...#", "#####", "#....", "#####"],
      l: ["#", "#", "#", "#", "#", "#", "#"],
      c: ["....", "....", "####", "#...", "#...", "#...", "####"],
      t: [".#.", ".#.", "###", ".#.", ".#.", ".#.", ".##"],
      n: ["....", "....", "####", "#..#", "#..#", "#..#", "#..#"],
      i: ["#", ".", "#", "#", "#", "#", "#"],
      s: ["....", "....", "####", "#...", "####", "...#", "####"],
    };
    function drawBrand(cx, top, maxW, alpha) {
      const text = BRAND.toLowerCase();
      if (![...text].every((ch) => ch === " " || FONT[ch])) return;
      const cols = [...text].reduce((w, ch, k) => w + (ch === " " ? 3 : FONT[ch][0].length + (k < text.length - 1 && text[k + 1] !== " " ? 2 : 0)), 0);
      const u = Math.max(1, Math.floor((maxW / cols) * 2) / 2);
      const w = cols * u, x0 = Math.round(cx - w / 2), sq = Math.max(1, u * 0.72);
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(NIGHT, 0.9 * alpha);
      ctx.fillRect(x0 - 10, top - 6, w + 20, 7 * u + 12);
      ctx.fillStyle = rgba(WHITE, alpha);
      let x = x0;
      [...text].forEach((ch, k) => {
        if (ch === " ") { x += 3 * u; return; }
        const gl = FONT[ch];
        gl.forEach((row, gy) => [...row].forEach((c, gx) => { if (c === "#") ctx.fillRect(x + gx * u, top + gy * u, sq, sq); }));
        x += (gl[0].length + (k < text.length - 1 && text[k + 1] !== " " ? 2 : 0)) * u;
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);



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
        if (glow > 0.02) blit(sprites.led, end[0], end[1], glow * 0.9 * veilAt(end[0]));
      }

      ctx.globalAlpha = 1;
      // Impulsi: testa luminosa con scia.
      for (const p of pulses) {
        for (let k = 0; k < 6; k++) {
          const d = p.d - k * 6;
          if (d < 0) break;
          const [x, y] = pointAt(p.tr, d);
          const vf = veilAt(x);
          ctx.fillStyle = k === 0 ? rgba(WHITE, 0.9 * vf) : rgba(BLUE, 0.6 * (1 - k / 6) * vf);
          ctx.beginPath(); ctx.arc(x, y, k === 0 ? 2.2 : 2.6 - k * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Matrice LED.
      const { x0, y0, P, cols, rows, dim } = matrix;
      const g = glyph ? glyphLevel : 0;


      // LED accesi: luminosità = trasparenza dello sprite, quindi dissolvenze continue.
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = x0 + c * P, y = y0 + r * P;
        const vf = veilAt(x) * dim;
        if (glyph && glyph.has(i)) {
          // Dissolvenza incrociata: il LED rotondo blu lascia il posto alla cella della "d".
          blit(sprites.led, x, y, leds[i] * (1 - g) * vf);
          blit(sprites[glyph.get(i)], x, y, g * vf);
        } else {
          blit(sprites.led, x, y, leds[i] * (1 - 0.6 * g) * vf);
        }
      }
      ctx.globalAlpha = 1;

      // Scritta del marchio sotto la "d", nel carattere a pixel del logo.
      if (glyph && BRAND && g > 0.01) drawBrand(x0 + (glyph.c0 + 2) * P - P / 2, y0 + (glyph.r0 + 6) * P + P * 0.9, 14 * P, g * dim);


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
      draw();
    }

    function refresh() {
      build();
      if (reduce.matches) { stop(); staticFrame(); } else { draw(); start(); }
    }

    // Ricostruisce solo se la dimensione cambia davvero (evita cicli di ridimensionamento).
    let lastSize = "";
    document.fonts?.ready.then(() => { if (!running && matrix) draw(); });
    new ResizeObserver(() => {
      const r = hero.getBoundingClientRect();
      const size = Math.round(r.width) + "x" + Math.round(r.height);
      if (size === lastSize) return;
      lastSize = size;
      refresh();
    }).observe(hero);
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

  }
})();
