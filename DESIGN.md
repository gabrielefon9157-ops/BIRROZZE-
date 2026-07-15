# Birozze — Design System v7 "Carta calda & Ocra"

> Sito goliardico del gruppo vacanze-studio: contatore birre, conti, galleria foto, muro delle perle, Oscar della serata.
> Stack: HTML/CSS/JS vanilla, nessuna build. Tutto lo stile condiviso vive in `shared.css`.

## 1. Tema & Atmosfera

Leggero, caldo, umano. Fondo color **carta calda** (mai bianco puro), card che galleggiano come piastrelle pastello, un solo giallo ocra come protagonista e un pop arancio-rosso "spritz" usato col contagocce. Ispirazione: dashboard sportive pastello — tanta aria, angoli molto rotondi, ombre morbide, zero effetto "corporate".

- **Visual style:** light, pastello, giocoso; annotazioni a mano dove serve un sorriso
- **Intent:** i numeri della serata leggibili a colpo d'occhio, ma su un foglio caldo, non su uno schermo di controllo

## 2. Palette

| Token | Valore | Ruolo |
|---|---|---|
| `--amber` | `#E3A320` | Primario — giallo ocra (CTA, link attivi, badge) |
| `--amber-light` | `#F2C75C` | Hover del primario, gradienti |
| `--amber-dark` | `#B77E10` | Testo ocra accessibile, label, accenti |
| `--amber-pale` | `#FBF0D0` | Riempimenti tenui (chip, hover, footer modale) |
| `--cream` | `#F6F1E3` | **Sfondo pagina** — carta calda |
| `--cream-deep` | `#EFE7D2` | Sfondi secondari, track progress |
| `--foam` | `#FFFDF6` | Superficie card / input / nav-pill |
| `--espresso` | `#2A2318` | Inchiostro caldo (titoli, toast) — mai nero puro |
| `--espresso-soft` | `#4A3F2C` | Inchiostro secondario |
| `--copper` | `#E8552F` | Pop "spritz" arancio-rosso — solo accenti fun (kicker, close hover, btn-copper) |
| `--copper-light` | `#F0764F` | Hover dello spritz |
| `--text-main / body / soft / mute` | `#2A2318 / #4A4232 / #7C7158 / #A99D82` | Scala testo calda |
| `--border / --border-dark` | `#E5DCC3 / #C9BC9C` | Bordi caldi 1px / 1.5px |
| `--mint / --sky / --butter / --blush` | `#DFEBDD / #DEEBF1 / #F7E8B5 / #F6DFD3` | **Pastelli additivi** per card colorate (`.card-mint` ecc.) |

Regole: l'ocra domina, lo spritz è raro e festoso, i pastelli riempiono le card-tile. Neutri sempre caldi, mai grigio puro.

## 3. Tipografia

Google Fonts via `@import` in `shared.css`:

- **Display** `--font-display`: *Bricolage Grotesque* 400–800 — titoli chunky (700–800), letter-spacing stretto (−0.02/−0.03em)
- **Body/UI** `--font-body`: *Instrument Sans* — testi e controlli
- **Handwriting** `--font-hand`: *Caveat* 500–700 — annotazioni giocose, kicker dell'hero, perle/citazioni (classe `.hand`)
- **Numerico** `--font-mono`: *JetBrains Mono*, `tabular-nums` (classe `.num`) per conti e classifiche

## 4. Spaziatura & Forma

- **Scala spazi:** xs 4 · sm 8 · md 16/20 · lg 28/36 · xl 48/**72** · xxl 88/**140** (mobile/desktop) — respiro "antigravity"
- **Contenitore:** `.page-wrap` max-width **1080px**
- **Raggi:** `--r-sm` 10 · `--r` 14 · `--r-lg` 22 (card) · `--r-xl` 32 (modale) · **99px** per bottoni, chip, badge, nav, toast
- **Ombre:** `--shadow-xs → xl`, tinta calda `rgba(90,72,32,…)`, opacità bassa, blur ampio — mai dure

## 5. Componenti

- **Nav** `.topnav`: sticky + blur; i link vivono in una pillola `--foam` con bordo; link attivo = pillola ocra con leggera ombra; brand che si inclina in hover
- **Bottoni** `.btn`: pillole (99px), padding cicciotto 12×26, peso 700; hover con lift + micro-rotazione (easing molleggiato `cubic-bezier(.34,1.56,.64,1)`); varianti `-primary` (ocra), `-copper` (spritz), `-ghost`, `-outline`
- **Card** `.card`: superficie foam, raggio 22px, bordo caldo 1px, ombra soffice, lift −4px in hover; varianti pastello additive `.card-mint / -sky / -butter / -blush`
- **Input** `.input`/`.field`: raggio 14px, focus ring ocra morbido
- **Progress** `.progress-wrap/-fill`: 10px, track crema, gradiente ocra scuro→chiaro
- **Chip/Badge/Toast:** tutti a pillola; toast su inchiostro espresso
- **Modale:** raggio 32px, close a bottoncino rotondo che diventa spritz e ruota
- **Divider/Footer:** riga **tratteggiata** calda (tocco "quaderno")
- **Motion:** transizioni 150–300ms, easing molleggiato sui micro-gesti; `@media (prefers-reduced-motion: reduce)` azzera animazioni e transform di hover

## 6. Voice & Brand

- Italiano goliardico ma chiaro: label letterali ("Aggiungi", "Vota"), microcopy che strappa un sorriso senza confondere l'azione
- La font a mano è la voce degli amici: perle, note, kicker — mai per dati o bottoni
- Nota **"bevi responsabilmente"** sempre presente (footer)

## 7. Anti-pattern

- ❌ Nero puro o bianco puro — sempre `--espresso` e `--foam`/`--cream`
- ❌ Immagini stock / estetica corporate o "AI-generated"
- ❌ Ombre dure o scure — solo le `--shadow-*` calde
- ❌ Colori fuori palette quando esiste un token
- ❌ Angoli vivi o raggi piccoli sui componenti interattivi
- ❌ Spritz (`--copper`) ovunque: è un pop, non un secondo primario
