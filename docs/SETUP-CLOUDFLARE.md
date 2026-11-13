# Setup GitHub + Cloudflare Pages + DNS — www.drme.tech

Il dominio resta **registrato su Aruba**. Si spostano solo la gestione DNS (su Cloudflare) e l'hosting del sito (Cloudflare Pages).
La posta resta su Google Workspace: se i record del §3 sono copiati **prima** del cambio nameserver, non si interrompe.

Ordine consigliato: 1 → 2 → 3 → 4 → 5 → 6. Fino al passo 4 il sito su Google Sites resta online.

---

## 1. GitHub
1. Crea due repository (privati vanno bene):
   - `drme-web-rules` — carica il contenuto della cartella `drme-web-rules`
   - `drme-tech-site` — carica il contenuto della cartella `drme-tech-site`
2. In `drme-tech-site` → **Settings → Branches → Add branch ruleset** su `main`:
   - Require a pull request before merging ✅
   - Block force pushes ✅
   Così nessuno (nemmeno Claude) può pubblicare in produzione senza PR.

## 2. Cloudflare Pages
1. Crea un account su dash.cloudflare.com (piano Free).
2. **Workers & Pages → Create → Pages → Connect to Git** → autorizza GitHub → scegli `drme-tech-site`.
3. Impostazioni build:
   | Campo | Valore |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Variabile d'ambiente | `NODE_VERSION` = `20` |
4. **Save and Deploy**. Dopo 1 minuto il sito è su `https://drme-tech-site.pages.dev` — controllalo.
5. Le anteprime delle PR sono attive di default (Settings → Builds → Preview deployments: *All non-production branches*).

## 3. Spostare i DNS su Cloudflare
1. Cloudflare → **Add a domain** → `drme.tech` → piano **Free**.
2. Cloudflare importa i record da Aruba. Controlla che ci siano **esattamente** questi (aggiungi quelli mancanti). Tutti con proxy **disattivato** (nuvola grigia, "DNS only"):

   | Tipo | Nome | Valore | Note |
   |---|---|---|---|
   | MX | `@` | `smtp.google.com` (priorità 1) | posta Gmail |
   | TXT | `@` | `v=spf1 include:_spf.google.com ~all` | SPF |
   | TXT | `@` | `google-site-verification=dKcd9-2Kx3voPzSN3j1R1DOym5efHIhPHNXrSn5xql0` | verifica Google |
   | TXT | `google._domainkey` | `v=DKIM1;k=rsa;p=MIIBIjAN…` | **copia il valore completo da Aruba**, non riscriverlo |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@drme.tech` | facoltativo, consigliato |

3. Elimina in Cloudflare i record ereditati da Aruba che non servono più:
   - A `@` → `62.149.128.40` (hosting Aruba)
   - CNAME `www` → `ghs.googlehosted.com` (Google Sites) — lo ricrea Pages al passo 5
   - A `localhost`, CNAME `_domainconnect`, `admin`, `ftp`
   Se in futuro userai lo spazio Aruba (FTP, ecc.), tieni A `@` e `ftp`.
4. Cloudflare mostra **due nameserver** (es. `xxx.ns.cloudflare.com`). Copiali.

## 4. Cambiare i nameserver su Aruba
1. admin.aruba.it → Domini → `drme.tech` → **Gestione DNS e Name Server** → sezione **Name Server** → **Sostituisci record**.
2. Scegli Name Server **personalizzati** e inserisci i due di Cloudflare. Salva.
3. Da qui in poi il pannello DNS di Aruba non conta più: i record si gestiscono solo su Cloudflare.
4. Attendi l'email di Cloudflare "drme.tech is now active" (di solito 1–24 h).
5. Verifica la posta: manda una mail da un indirizzo esterno a `a.tirri@drme.tech` e rispondi.

## 5. Collegare il dominio al sito
1. Cloudflare → Workers & Pages → `drme-tech-site` → **Custom domains → Set up a custom domain**:
   - `www.drme.tech` → conferma (Cloudflare crea il CNAME da solo)
   - `drme.tech` → conferma
2. HTTPS si attiva in automatico in pochi minuti.
3. Reindirizza il dominio nudo su www: **Rules → Redirect Rules → Create rule** → template *Redirect from root to WWW* (301). Così `drme.tech` → `https://www.drme.tech`.

## 6. Chiudere Google Sites
1. admin.google.com → App → Google Workspace → Sites → URL personalizzati → elimina `www.drme.tech`.
2. Il sito Google Sites può restare come bozza o essere eliminato. Workspace resta attivo per posta, Drive, Calendar.

---

## Controlli finali
- [ ] `https://www.drme.tech` e `https://www.drme.tech/en/` aprono il nuovo sito con lucchetto
- [ ] `drme.tech` reindirizza a `www.drme.tech`
- [ ] posta in entrata e in uscita funzionante
- [ ] admin.google.com → Gmail → Autentica email: DKIM "Autenticazione email in corso"
- [ ] anteprima del link su WhatsApp con logo e titolo corretti (usa `www.drme.tech/?v=1` per evitare la cache)
