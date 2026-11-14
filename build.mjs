// Build statico del sito drme.tech — nessuna dipendenza esterna.
// Legge i testi da locales/<lingua>.json, i template da src/, e scrive il sito in dist/.
// Uso: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "dist");
const SITE = { url: "https://www.drme.tech" };

// Lingue: la prima è la predefinita e sta in "/", le altre in "/<lang>/".
const LANGS = ["it", "en"];
// Pagine: slug "" = home. L'ordine è quello del menu.
const PAGES = [
  { key: "home", slug: "" },
  { key: "servizi", slug: "servizi" },
  { key: "metodo", slug: "metodo" },
  { key: "contatti", slug: "contatti" },
];

const ICONS = {
  chip: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/></svg>',
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  wave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17h3l3-9 4 12 3-8h5"/></svg>',
};

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Mini-template:
//   {{a.b}}            testo con escape (dalla radice)
//   {{{a.b}}}          testo senza escape
//   {{.campo}}         campo dell'elemento corrente dentro #each
//   {{#each a.b}}…{{/each}}
//   {{{svg .icon}}}    icona SVG
function render(tpl, data, where) {
  tpl = tpl.replace(/\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, path, inner) => {
    const list = get(data, path);
    if (!Array.isArray(list)) throw new Error(`${where}: "${path}" non è una lista`);
    return list.map((item, i) => fill(inner, data, item, `${where} ${path}[${i}]`)).join("");
  });
  return fill(tpl, data, null, where);
}

function fill(tpl, data, item, where) {
  const val = (path) => {
    const v = path.startsWith(".") ? get(item, path.slice(1)) : get(data, path);
    if (v === undefined) throw new Error(`${where}: chiave mancante "${path}"`);
    return v;
  };
  return tpl
    .replace(/\{\{\{svg ([\w.]+)\}\}\}/g, (_, p) => {
      const name = val(p);
      if (!ICONS[name]) throw new Error(`${where}: icona sconosciuta "${name}"`);
      return ICONS[name];
    })
    .replace(/\{\{\{([\w.]+)\}\}\}/g, (_, p) => String(val(p)))
    .replace(/\{\{([\w.]+)\}\}/g, (_, p) => esc(val(p)));
}

// Controllo: ogni chiave deve esistere in tutte le lingue.
function shape(obj, prefix = "") {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`, ...obj.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  if (obj && typeof obj === "object") return Object.keys(obj).flatMap((k) => shape(obj[k], prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

const locales = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(read(`locales/${l}.json`))]));
const ref = new Set(shape(locales[LANGS[0]]));
for (const l of LANGS.slice(1)) {
  const cur = new Set(shape(locales[l]));
  const missing = [...ref].filter((k) => !cur.has(k));
  const extra = [...cur].filter((k) => !ref.has(k));
  if (missing.length || extra.length) {
    throw new Error(`locales/${l}.json non allineato a ${LANGS[0]}.json\n  mancanti: ${missing.join(", ") || "-"}\n  in più: ${extra.join(", ") || "-"}`);
  }
}

const base = (lang) => (lang === LANGS[0] ? "" : `/${lang}`);
const href = (lang, slug) => `${base(lang)}/${slug ? slug + "/" : ""}`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, "public"), OUT, { recursive: true });

// Cache busting: ogni CSS/JS/immagine in /assets/ riceve ?v=<hash del contenuto>,
// così il browser non mescola mai una pagina nuova con file vecchi in cache.
const assetHash = (f) => createHash("sha256").update(readFileSync(join(ROOT, "public/assets", f))).digest("hex").slice(0, 10);
const versioned = (html) => html.replace(/(["'])\/assets\/([\w.-]+\.(?:css|js|png|jpg|svg))\1/g, (_, q, f) => `${q}/assets/${f}?v=${assetHash(f)}${q}`);

const layout = read("src/layout.html");
const placeholders = [];
let count = 0;

for (const lang of LANGS) {
  const t = locales[lang];
  const alt = LANGS.find((l) => l !== lang);
  for (const pg of PAGES) {
    const where = `${lang}/${pg.key}`;
    const nav = PAGES.map((p) => {
      const cur = p.key === pg.key ? ' aria-current="page" class="on"' : "";
      return `<a href="${href(lang, p.slug)}"${cur}>${esc(t.nav[p.key])}</a>`;
    }).join("");
    const title = pg.key === "home"
      ? `${t.meta.siteName} · ${t.meta.brand} · ${t.meta.tagline}`
      : `${t[pg.key].title} · ${t.meta.siteName} ${t.meta.brand}`;
    const page = {
      base: base(lang),
      homeHref: href(lang, ""),
      fullTitle: esc(title),
      description: pg.key === "home" ? t.meta.description : t[pg.key].description,
      canonical: SITE.url + href(lang, pg.slug),
      hrefIt: SITE.url + href("it", pg.slug),
      hrefEn: SITE.url + href("en", pg.slug),
      altHref: href(alt, pg.slug),
      altLang: alt,
      nav,
    };
    // Dati strutturati (schema.org) per far riconoscere a Google l'azienda e il sito.
    page.jsonld = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE.url}/#org`,
          name: t.meta.siteName,
          alternateName: [t.meta.brand, "drme"],
          url: `${SITE.url}/`,
          logo: `${SITE.url}/assets/favicon.png`,
          image: `${SITE.url}/assets/og-image.png`,
          description: t.meta.description,
          address: { "@type": "PostalAddress", addressLocality: t.meta.city, addressCountry: t.meta.country },
          areaServed: "Europe",
          knowsAbout: t.meta.keywords.split(",").map((k) => k.trim()),
        },
        {
          "@type": "WebSite",
          "@id": `${SITE.url}/#website`,
          name: t.meta.siteName,
          alternateName: t.meta.brand,
          url: `${SITE.url}/`,
          inLanguage: t.meta.lang,
          publisher: { "@id": `${SITE.url}/#org` },
        },
      ],
    }).replace(/</g, "\\u003c");
    const data = { ...t, page, site: SITE };
    page.body = render(read(`src/pages/${pg.key}.html`), data, where);
    const html = versioned(render(layout, data, where));
    for (const m of html.matchAll(/\[\[[^\]]+\]\]/g)) placeholders.push(`${where}: ${m[0]}`);
    const dir = join(OUT, href(lang, pg.slug));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    count++;
  }
}

// Sitemap
const urls = LANGS.flatMap((l) => PAGES.map((p) => `  <url><loc>${SITE.url}${href(l, p.slug)}</loc></url>`));
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);

console.log(`Build ok: ${count} pagine in ${LANGS.length} lingue → dist/`);
if (placeholders.length) console.warn(`Segnaposto da completare:\n  ${[...new Set(placeholders)].join("\n  ")}`);
