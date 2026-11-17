// Geometria del logo drommer electronics (stessa del file vettoriale), condivisa da banner e schermata d'ingresso.
// DRME_LOGO.cells() → { cells, w, h } in unità del logo; DRME_LOGO.shape(ctx, cella) disegna una cella.
window.DRME_LOGO = (() => {
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
  // ---- Logo intero: geometria (stessa del file vettoriale) e animazione "LED che si accendono" ----
  const LS = 0.68, LSD = 0.84, LDS = 1.3, LR = 0.2;
  const DGL = ["...#", "...#", "####", "#..#", "#..#", "####"];
  function wordCells(text, u, bigD) {
    const base = 2 * u + (u - u * LS), out = [];
    let x = 0, prev = null, n = 0;
    [...text].forEach((ch, k) => {
      if (ch === " ") { x = prev + 4 * u; prev = null; return; }
      const big = k === 0 && ch === "d" && bigD;
      const gl = big ? DGL : FONT[ch], cell = big ? u * LDS : u, sq = cell * (big ? LSD : LS), eo = (cell - sq) / 2;
      if (prev !== null) {
        let gap = base * (1 - LR);
        if (n === 1 && text[0] === "d" && bigD) gap += u * 0.35 * (LDS - 1) * 5 * (1 - LR);
        x = prev + gap - eo;
      }
      const on = (gx, gy) => gl[gy] && gl[gy][gx] === "#";
      gl.forEach((row, gy) => [...row].forEach((c, gx) => {
        if (c !== "#") return;
        const L = on(gx - 1, gy), R = on(gx + 1, gy), U = on(gx, gy - 1), D = on(gx, gy + 1);
        let kind = "sq", rad = [0, 0, 0, 0];
        if (big) kind = (L || R) && (U || D) ? "sq" : (L || R) ? "V" : "H";
        else if ((L || R) && (U || D)) {
          const k2 = sq * 0.85;
          rad = [!U && !L ? k2 : 0, !U && !R ? k2 : 0, !D && !R ? k2 : 0, !D && !L ? k2 : 0];
        } else rad = [sq * 0.12, sq * 0.12, sq * 0.12, sq * 0.12];
        out.push({ x: x + gx * cell + eo, y: gy * cell + eo, s: sq, kind, rad, d: big, h: gl.length * cell });
      }));
      prev = x + gl[0].length * cell - eo; x += gl[0].length * cell; n++;
    });
    const H = Math.max(...out.map((c) => c.h));
    out.forEach((c) => (c.y += H - c.h));
    return out;
  }
  const bounds = (cs) => {
    const x0 = Math.min(...cs.map((c) => c.x)), y0 = Math.min(...cs.map((c) => c.y));
    return { x0, y0, w: Math.max(...cs.map((c) => c.x + c.s)) - x0, h: Math.max(...cs.map((c) => c.y + c.s)) - y0 };
  };

  function cells() {
    const top = wordCells("drommer", 1, true), bt = bounds(top);
    const el1 = wordCells("electronics", 1, false), k = bt.w / bounds(el1).w;
    const el = wordCells("electronics", k, false), be = bounds(el);
    const all = [
      ...top.map((c) => ({ ...c, x: c.x - bt.x0, y: c.y - bt.y0 })),
      ...el.map((c) => ({ ...c, x: c.x - be.x0, y: c.y - be.y0 + bt.h + 1.6 })),
    ];
    const b = bounds(all);
    return { cells: all, w: b.w, h: b.h };
  }

  function shape(ctx, c) {
    const { x, y, s } = c;
    if (c.kind === "sq") {
      if (ctx.roundRect && c.rad.some((r) => r > 0)) { ctx.beginPath(); ctx.roundRect(x, y, s, s, c.rad); ctx.fill(); }
      else ctx.fillRect(x, y, s, s);
      return;
    }
    const n = 3, st = s / n, th = st * 0.62;
    for (let i = 0; i < n; i++) {
      if (c.kind === "V") ctx.fillRect(x + i * st, y, th, s);
      else ctx.fillRect(x, y + i * st, s, th);
    }
  }

  return { cells, shape };
})();
