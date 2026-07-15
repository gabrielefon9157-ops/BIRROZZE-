# Design System Inspired by Birozze

> Category: Social & Lifestyle
> Una dashboard notturna della serata: la birra al centro come uno schermo di controllo, i dati del gruppo che le orbitano attorno. Conta le bottiglie, colleziona le perle, assegna gli Oscar e decide la prossima serata.

_Brief generato con la metodologia open-design (nexu-io/open-design): un Seed con colore primario ocra genera la scala a 9 step e i ruoli semantici; il tema è dark-first (omaggio a una dashboard neon), con variante light via token._

## 1. Visual Theme & Atmosphere

Schermo scuro da "sala controllo" della serata: fondo quasi-nero caldo, numeri neon ambra che pulsano, un boccale luminoso al centro con i dati principali disposti tutt'intorno (composizione a soggetto centrale + stat orbitanti). Convivialità notturna, tecnica ma calda, con inserti analogici (post-it, medaglie).

- **Visual style:** dark, neon, dashboard; tattile solo dove serve (post-it)
- **Color stance:** primary (ochre neon), secondary (spritz), success, danger, plus palette post-it
- **Design intent:** far leggere a colpo d'occhio i numeri chiave della serata su fondo scuro, con la birra come fulcro luminoso.

## 2. Color

Seed → `colorPrimary = #F2B21C` (ocra birra, resa neon su fondo scuro). Scala a 9 step + ruoli:

- **Primary / neon:** `#F2B21C` — accento e segnale d'interazione; **neon-bright** `#FFCB3A` per i numeroni luminosi (con glow).
- **ochre-1 → 9:** `#FDF6E3 · #FBEAC0 · #F6D98C · #EFC24E · #F2B21C · #C6890F · #A06B08 · #7C5106 · #5A3A05`
- **Secondary (spritz):** `#F0662F` — pop festoso, banner "prossima serata".
- **Success:** `#3FBE55` · **Danger:** `#EA4C3B` · **Gold (medaglie):** `#FFC53A`
- **Background:** `#08090A` quasi-nero caldo. **Screen:** `#12100B → #0B0C0A`. **Card:** superfici traslucide `rgba(255,246,224,.035)`.
- **Text:** `#F1E8D4`; soft `#B6A788`; mute `#7E715A`. **Line:** `rgba(240,214,140,.13)`.
- **Post-it:** giallo `#FFE07A`, corallo `#FFB59A`, menta `#A6E0A8`, cielo `#9FD2F2`, lilla `#D3B9F0`, rosa `#FBB6D2`.

Regole: l'ocra neon domina numeri e accenti (con `text-shadow` glow); lo spritz è il pop secondario; i neutri virano al caldo (mai grigio puro). La variante **light** ridefinisce gli stessi token.

## 3. Typography

- **Display / wordmark:** condensato da etichetta (`Haettenschweiler, Arial Narrow, Oswald, Impact`) per titoli e numeroni.
- **Body/UI:** system sans (`Segoe UI Variable, system-ui`), pesi 400–800.
- **Handwriting (perle):** `Bradley Hand, Segoe Print, Comic Sans MS, cursive` per il muro dei ricordi.
- **Numerico:** tabular-nums per conti e classifiche.
- Nessun webfont via CDN (CSP): solo stack di sistema.

## 4. Spacing & Grid

- **Scala:** 4/8/12/16/20/28/40. Ritmo verticale costante tra sezioni.
- Griglie fluide con `gap`, mai margini per-elemento che collassano.
- Contenuti larghi in contenitori con `overflow-x:auto`.

## 5. Layout & Composition

- **Hero-dashboard:** soggetto centrale (il boccale luminoso) con le stat della serata disposte a corona — colonna sinistra (titolo + Top 3), boccale al centro, griglia di stat-tile a destra; barra CTA sotto. Omaggio alla composizione "globo + dati intorno".
- Sotto-nav sticky (Conti · Perle · Oscar · Prossima serata) con contatori vivi.
- Podio/classifica per il "chi ne ha bevute di più".

## 6. Components

- **Bottoni:** primario ocra pieno; secondari neutri con bordo caldo su superfici traslucide.
- **Card bottiglia** (catalogo 30 super alcolici): icona-bottiglia SVG disegnata a mano + nome + **prezzo per bottiglia modificabile inline**; filtri per categoria.
- **Stat-tile neon:** label minuscola con micro-icona di linea + numero luminoso.
- **Post-it / candidato Oscar / opzione serata:** raggi e ombre coerenti; barre di voto con leader evidenziato, chip persona selezionabili.
- Focus-visible sempre esplicito (outline ocra).

## 7. Iconography & Motion

- **Solo icone SVG di linea disegnate a mano** (bottiglie per categoria, trofeo, pin, utenti…): niente emoji, niente icone dall'aria "AI-generated".
- Transizioni 150–250ms, ocra come segnale; **glow neon** sui numeri chiave.
- Micro-feedback: "+1" fluttuante sull'aggiunta, rotazione dei post-it in hover, flash sul voto, timer "serata in corso".
- Rispetto di `prefers-reduced-motion`.

## 8. Voice & Brand

- Italiano colloquiale, goliardico ma chiaro. Label letterali ("Aggiungi", "Vota").
- Microcopy che strappa un sorriso senza confondere l'azione.
- Nota "bevi responsabilmente" sempre presente.

## 9. Anti-patterns

- Niente colori fuori palette quando un token esiste già.
- Non appiattire la gerarchia (stesso peso/size ovunque).
- Niente effetti decorativi che riducono leggibilità/accessibilità.
- Non mischiare metafore visive scollegate nella stessa vista.
