# Birozze — Diario della Vacanza Studio

> Il taccuino digitale condiviso per registrare le bevute, dividere le spese e custodire i ricordi del gruppo.

## Struttura

```
BIRROZZE/
├── index.html          # Home page premium (hero, stats, timer, features grid)
├── shared.css          # Design system "Birra Artigianale"
├── shared.js           # Stato globale localStorage + utilities
├── consumazioni.html   # Catalogo 30 drink + selezione persona
├── classifica.html     # Podio top-3 + scoreboard animato
├── spese.html          # Smistamento spese Splitwise + registro
├── galleria.html       # Galleria Polaroid (drag-and-drop upload)
├── perle.html          # Muro delle Perle (post-it masonry)
├── oscar.html          # Oscar della Vacanza (ballot cards + voti live)
├── prossima.html       # Pianificatore prossima tappa
├── schema.sql          # Schema SQL per migrazione futura a Supabase
└── birozze.html        # Versione monolite legacy (v5.6)
```

## Come Usarlo

### Locale
Apri `index.html` direttamente nel browser oppure avvia un server locale:

```bash
python -m http.server 8181
# poi vai su http://localhost:8181/
```

### Deploy su Vercel
```bash
npm install -g vercel
vercel --prod
```

## Tecnologie
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript
- **Stato**: localStorage (nessun backend richiesto)
- **Font**: Google Fonts — Playfair Display, DM Sans, JetBrains Mono
- **Deploy**: compatibile con Vercel, Netlify, GitHub Pages

## Backend Futuro (Supabase)
Il file `schema.sql` contiene le tabelle pronte per Supabase.
La migrazione richiede solo di aggiornare `shared.js` — tutte le pagine HTML rimangono invariate.

---

*Fatto con cura per la vacanza studio 2026 — Birozze v6.0*
