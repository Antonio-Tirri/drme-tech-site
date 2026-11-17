// Schermata d'ingresso: il logo drommer electronics si accende pixel per pixel, le piste del circuito
// lo raggiungono dai bordi, e un clic (o Invio / Spazio / Esc) porta nel sito.
// - Appare una volta per sessione del browser (sessionStorage), su qualunque pagina si arrivi.
// - Senza JavaScript non appare: il contenuto del sito è sempre nell'HTML.
// - "Riduci movimento": logo già acceso e fermo, uscita senza zoom.
(() => {
  window.DRME_SPLASH = true;
  const root = document.documentElement;
  const box = document.getElementById("ingresso");
  if (!box || !root.classList.contains("ingresso-on") || !window.DRME_LOGO) {
    root.classList.remove("ingresso-on");
    return;
  }

  const KEY = "drme-ingresso";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(root);
  const hex = (v, d) => {
    const h = (css.getPropertyValue(v) || d).trim().replace("#", "");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const BLUE = hex("--blue", "#1877f2"), WHITE = hex("--on-night", "#ffffff"), GREY = hex("--pixel-off", "#4a5466");
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

  const canvas = box.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const btn = box.querySelector("button");
  const hint = box.querySelector(".ingresso-hint");
  if (!matchMedia("(hover: hover)").matches && box.dataset.tap) hint.textContent = box.dataset.tap;

  const LIT_T = 3.4;
  let lit = null;
  let W = 0, H = 0, cells = [], traces = [], glow = null, t0 = performance.now(), raf = 0, leaving = false;

  function sprite(r) {
    const c = document.createElement("canvas"), dpr = Math.min(devicePixelRatio || 1, 2), h = Math.ceil(r);
    c.width = c.height = h * 2 * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, rgba(BLUE, 0.6)); gr.addColorStop(0.5, rgba(BLUE, 0.18)); gr.addColorStop(1, rgba(BLUE, 0));
    g.fillStyle = gr; g.fillRect(0, 0, h * 2, h * 2);
    return { c, h };
  }

  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const L = window.DRME_LOGO.cells();
    const width = Math.min(W * 0.82, 760), sc = width / L.w, h = L.h * sc;
    const ox = (W - width) / 2, oy = H * 0.46 - h / 2;
    cells = L.cells.map((c, i) => {
      const x = ox + c.x * sc, nx = (x - ox) / width;
      // Accensione da sinistra a destra, con un po' di casualità, come una scheda che si inizializza.
      const r = ((i * 2654435761) >>> 0) / 4294967296;
      return { ...c, x, y: oy + c.y * sc, s: c.s * sc, rad: c.rad.map((v) => v * sc), on: 1.0 + nx * 1.6 + r * 0.4 };
    });
    glow = sprite(Math.max(6, cells.find((c) => c.d).s * 3.2));
    lit = null;

    // Piste a 90° dai bordi dello schermo ai lati del logo, con piazzola finale.
    const m = 14, lx = ox - m, rx = ox + width + m, cy = oy + h / 2;
    const rows = [-0.42, -0.14, 0.14, 0.42].map((f) => cy + f * h * 1.4);
    traces = [];
    if (W >= 700) {
      rows.forEach((y, i) => {
        const bend = 26 + i * 18, ey = cy + (i - 1.5) * h * 0.22;
        traces.push([[0, y], [lx - bend - 40, y], [lx - bend - 40 + Math.abs(ey - y), ey], [lx, ey]].map(([x, yy]) => [Math.min(x, lx), yy]));
        traces.push([[W, y], [rx + bend + 40, y], [rx + bend + 40 - Math.abs(ey - y), ey], [rx, ey]].map(([x, yy]) => [Math.max(x, rx), yy]));
      });
    } else {
      // Schermo stretto: le piste arrivano dall'alto e dal basso.
      const ty = oy - m, by = oy + h + m;
      [0.12, 0.37, 0.63, 0.88].forEach((f, i) => {
        const ex = ox + width * f, sx = ox + width * (0.05 + i * 0.3), bend = 30 + i * 14;
        const d = Math.abs(ex - sx);
        traces.push([[sx, 0], [sx, Math.max(4, ty - bend - d)], [ex, Math.max(4, ty - bend)], [ex, ty]]);
        traces.push([[sx, H], [sx, Math.min(H - 4, by + bend + d)], [ex, Math.min(H - 4, by + bend)], [ex, by]]);
      });
    }
    traces.forEach((p, i) => {
      let len = 0;
      const seg = p.slice(1).map((q, k) => { const l = Math.hypot(q[0] - p[k][0], q[1] - p[k][1]); len += l; return l; });
      p.seg = seg; p.len = len; p.delay = 0.1 + (i % 4) * 0.12;
    });
  }

  const pointAt = (p, d) => {
    for (let k = 0; k < p.seg.length; k++) {
      if (d <= p.seg[k]) { const f = d / p.seg[k]; return [p[k][0] + (p[k + 1][0] - p[k][0]) * f, p[k][1] + (p[k + 1][1] - p[k][1]) * f]; }
      d -= p.seg[k];
    }
    return p[p.length - 1];
  };

  function drawCells(g, t) {
    const ghost = smooth(0.15, 0.8, t);
    for (const c of cells) {
      const lv = smooth(c.on, c.on + 0.35, t);
      g.globalAlpha = ghost * (1 - lv);
      g.fillStyle = rgba(GREY, 1);
      if (g.globalAlpha > 0.01) window.DRME_LOGO.shape(g, c);
      if (lv <= 0.01) continue;
      const flash = Math.min(1, 4 * lv * (1 - lv)) * 0.9 + lv * (c.d ? 0.35 : 0.1);
      if (flash > 0.02) {
        g.globalAlpha = flash;
        g.drawImage(glow.c, c.x + c.s / 2 - glow.h, c.y + c.s / 2 - glow.h, glow.h * 2, glow.h * 2);
      }
      g.globalAlpha = lv;
      g.fillStyle = rgba(c.d ? BLUE : WHITE, 1);
      window.DRME_LOGO.shape(g, c);
    }
    g.globalAlpha = 1;
  }

  function draw(now) {
    const t = reduce ? 99 : (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    // Piste: si disegnano fino al logo, poi ogni tanto un impulso le percorre.
    ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const p of traces) {
      const k = smooth(p.delay, p.delay + 1.3, t), d = p.len * k;
      ctx.strokeStyle = rgba(BLUE, 0.55);
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      let left = d;
      for (let i = 0; i < p.seg.length && left > 0; i++) {
        const f = Math.min(1, left / p.seg[i]);
        ctx.lineTo(p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f);
        left -= p.seg[i];
      }
      ctx.stroke();
      if (k >= 1) {
        const end = p[p.length - 1];
        ctx.fillStyle = rgba(BLUE, 0.9); ctx.beginPath(); ctx.arc(end[0], end[1], 3.5, 0, 7); ctx.fill();
        if (!reduce) {
          const ph = ((t - p.delay * 3) % 3.2) / 3.2, pt = pointAt(p, p.len * ph);
          ctx.globalAlpha = Math.sin(ph * Math.PI);
          ctx.drawImage(glow.c, pt[0] - glow.h * 0.6, pt[1] - glow.h * 0.6, glow.h * 1.2, glow.h * 1.2);
          ctx.fillStyle = rgba(WHITE, 0.9); ctx.fillRect(pt[0] - 1.5, pt[1] - 1.5, 3, 3);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Logo: i pixel compaiono grigi, poi si accendono uno alla volta con un breve bagliore.
    // Quando è tutto acceso il logo è fermo: lo disegno una volta su un livello a parte e lo ricopio.
    if (t > LIT_T) {
      if (!lit) {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        lit = document.createElement("canvas");
        lit.width = W * dpr; lit.height = H * dpr;
        const g = lit.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawCells(g, LIT_T + 1);
      }
      ctx.drawImage(lit, 0, 0, W, H);
    } else drawCells(ctx, t);
    if (t > 3.1) box.classList.add("ready");
    if (!reduce && !leaving) raf = requestAnimationFrame(draw);
  }

  function enter() {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* storage non disponibile: pazienza */ }
    box.classList.add("out");
    const done = () => {
      cancelAnimationFrame(raf);
      root.classList.remove("ingresso-on");
      box.remove();
      const main = document.getElementById("main");
      if (main) { main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
    };
    if (reduce) done(); else setTimeout(done, 750);
  }

  layout();
  addEventListener("resize", () => { if (!leaving) { layout(); if (reduce) draw(0); } });
  btn.addEventListener("click", enter);
  addEventListener("keydown", (e) => { if (!leaving && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); enter(); } });
  btn.focus({ preventScroll: true });
  if (reduce) { box.classList.add("ready"); draw(0); } else raf = requestAnimationFrame(draw);
})();
