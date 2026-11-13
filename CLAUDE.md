# CLAUDE.md — sito www.drme.tech

## Regole
Le regole di interfaccia, stile e flusso di lavoro sono nel repo comune **drme-web-rules**, file `RULES.md`.
Leggile prima di ogni modifica: valgono qui senza eccezioni, salvo quanto scritto sotto.
Precedenza: richiesta esplicita del titolare → questo file → `RULES.md`.

In breve (il dettaglio è in `RULES.md`):
1. Prima di modificare, spiega **cosa cambia per chi visita il sito** e quali pagine/lingue tocchi.
2. Branch nuovo + Pull Request. **Mai push su `main`**, mai merge senza conferma del titolare.
3. `npm run build` deve passare prima di aprire la PR.
4. Controlla l'anteprima Cloudflare della PR (desktop, mobile, it + en) e riporta il link.
5. Testi solo in `locales/*.json`, mai nei template o nel codice.
6. Nessun nome di cliente, progetto riservato o dato personale del titolare sul sito.

## Struttura
```
locales/it.json, en.json   testi per lingua (stesse chiavi in tutte le lingue)
src/layout.html            struttura comune: <head>, barra, footer
src/pages/<pagina>.html    corpo di ogni pagina (solo chiavi)
public/                    copiato così com'è in dist/ (asset, _headers)
build.mjs                  genera dist/ — nessuna dipendenza
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
- `contatti.place` → `[[CITTÀ]]` / `[[CITY]]`
- Alias `info@drme.tech` da creare in Google Workspace (Admin → Utenti → a.tirri → Indirizzi email alternativi).
