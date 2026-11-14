// Controllo automatico del sito prima della pubblicazione.
// Uso: npm run build && npm run check
// Apre ogni pagina (it + en) in un browser vero, a 1280 px e 400 px, e verifica:
//   1. nessun errore JavaScript
//   2. nessuno scorrimento orizzontale
//   3. banner di altezza stabile e ragionevole (niente crescita infinita)
//   4. lo stesso, simulando un foglio di stile vecchio/assente in cache
//   5. "riduci movimento": nessuna animazione in corso
//   6. tutti i file /assets/ referenziati rispondono 200
// Esce con codice 1 se un controllo fallisce.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const DIST = path.join(__dirname, "..", "dist");
const PAGES = ["/", "/servizi/", "/metodo/", "/contatti/", "/en/", "/en/servizi/", "/en/metodo/", "/en/contatti/"];
const VIEWPORTS = [{ width: 1280, height: 800 }, { width: 400, height: 820 }];
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".xml": "application/xml", ".txt": "text/plain" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

const failures = [];
const fail = (where, msg) => failures.push(`✗ ${where}: ${msg}`);

async function heroHeights(page) {
  const hs = [];
  for (const wait of [300, 1200, 2200]) {
    await page.waitForTimeout(wait - (hs.length ? [300, 1200, 2200][hs.length - 1] : 0));
    hs.push(await page.evaluate(() => {
      const h = document.querySelector(".hero");
      return h ? Math.round(h.getBoundingClientRect().height) : 0;
    }));
  }
  return hs;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    for (const url of PAGES) {
      const where = `${url} @${vp.width}px`;
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      const errors = [];
      const assets = new Set();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("response", (r) => {
        const u = new URL(r.url());
        if (u.origin === base && u.pathname.startsWith("/assets/") && r.status() !== 200) fail(where, `${u.pathname} → HTTP ${r.status()}`);
        if (u.origin === base) assets.add(u.pathname);
      });
      // Font esterni non disponibili nei test: ignorati.
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await page.goto(base + url, { waitUntil: "load" });

      const hs = await heroHeights(page);
      if (new Set(hs).size !== 1) fail(where, `altezza del banner instabile: ${hs.join(" → ")} px`);
      if (hs[2] > vp.height * 1.5) fail(where, `banner troppo alto: ${hs[2]} px`);

      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > vp.width) fail(where, `scorrimento orizzontale: larghezza ${sw} px su ${vp.width}`);

      const real = errors.filter((e) => !/fonts\.(googleapis|gstatic)|ERR_FAILED|net::/.test(e));
      if (real.length) fail(where, `errori JavaScript: ${real.join(" | ")}`);
      await ctx.close();
    }
  }

  // Foglio di stile vecchio o assente (cache del browser): il banner non deve crescere.
  for (const url of ["/", "/servizi/"]) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/\/assets\/styles\.css/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.goto(base + url, { waitUntil: "load" });
    const hs = await heroHeights(page);
    if (new Set(hs).size !== 1 || hs[2] > 2000) fail(`${url} senza CSS`, `il banner cresce: ${hs.join(" → ")} px`);
    await ctx.close();
  }

  // Riduci movimento: due fotogrammi a distanza devono essere identici.
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0], reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForTimeout(500);
    const a = await page.evaluate(() => document.querySelector(".hero-fx")?.toDataURL());
    await page.waitForTimeout(800);
    const b = await page.evaluate(() => document.querySelector(".hero-fx")?.toDataURL());
    if (a && a !== b) fail("/ riduci movimento", "il banner si muove ancora");
    await ctx.close();
  }

  await browser.close();
  server.close();

  if (failures.length) {
    console.error(`Controllo FALLITO (${failures.length}):\n${failures.join("\n")}`);
    process.exit(1);
  }
  console.log(`Controllo ok: ${PAGES.length} pagine × ${VIEWPORTS.length} larghezze, CSS assente, riduci movimento.`);
})().catch((e) => { console.error(e); process.exit(1); });
