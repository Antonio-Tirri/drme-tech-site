# CLAUDE.md — sito www.drme.tech

## Regole
Le regole di interfaccia, stile e flusso di lavoro sono nel repo comune **drme-web-rules**, file `RULES.md`.
Leggile prima di ogni modifica: valgono qui senza eccezioni, salvo quanto scritto sotto.
Precedenza: richiesta esplicita del titolare → questo file → `RULES.md`.

In breve (il dettaglio è in `RULES.md`):
1. Prima di modificare, spiega **cosa cambia per chi visita il sito** e quali pagine/lingue tocchi.
2. Branch nuovo + Pull Request. **Mai push su `main`**, mai merge senza conferma del titolare.
3. `npm run validate` deve passare prima di aprire la PR (build + controllo automatico in un browser vero:
   errori JS, scorrimento orizzontale, banner stabile anche con CSS in cache, riduci movimento).
   Lo stesso controllo gira su GitHub ("Controllo sito") a ogni PR: **niente merge se non è verde**.
4. Controlla l'anteprima Cloudflare della PR (desktop, mobile, it + en) e riporta il link.
5. CSS, JS e immagini in `public/assets/` ricevono `?v=<hash>` automaticamente dalla build: non servono rinomine manuali.
6. Testi solo in `locales/*.json`, mai nei template o nel codice.
7. Nessun nome di cliente, progetto riservato o dato personale del titolare sul sito.

## Struttura
```
locales/it.json, en.json   testi per lingua (stesse chiavi in tutte le lingue)
src/layout.html            struttura comune: <head>, barra, footer
src/pages/<pagina>.html    corpo di ogni pagina (solo chiavi)
public/                    copiato così com'è in dist/ (asset, _headers)
build.mjs                  genera dist/ — nessuna dipendenza
scripts/check.cjs          controllo automatico (richiede playwright, solo in locale/CI)
```

Template: `{{chiave.percorso}}` (con escape), `{{{…}}}` (senza escape), `{{#each lista}}…{{/each}}` con `{{.campo}}`, `{{{svg .icon}}}`.

## Aggiungere una pagina
1. Aggiungi `{ key, slug }` a `PAGES` in `build.mjs` (l'ordine è quello del menu).
2. Crea `src/pages/<key>.html`.
3. Aggiungi `nav.<key>` e la sezione `<key>` con `title` e `description` in **tutti** i file `locales/`.

## Aggiungere una lingua
1. Copia `locales/it.json` in `locales/<lang>.json` e traduci.
2. Aggiungi `<lang>` a `LANGS` in `build.mjs` e un `<link rel="alternate">` in `src/layout.html`.

## Deploy
Cloudflare Pages, progetto `drme-tech-site`:
- build command `npm run build`, output `dist`
- `main` → produzione `www.drme.tech`; ogni PR → anteprima con URL proprio.

## Segnaposto aperti
- Alias `info@drme.tech` da creare in Google Workspace (Admin → Utenti → a.tirri → Indirizzi email alternativi).
