# Notion for the Group — Birozze Multi-Utente in Tempo Reale

> Documento tecnico di riferimento: come trasformare Birozze da app single-device
> (localStorage) ad app di gruppo in tempo reale con Supabase, deployabile su Vercel.
>
> Stato attuale del progetto: sito statico vanilla HTML/CSS/JS, 8 pagine,
> stato globale in `shared.js` (chiave localStorage `birozze_state_v6`),
> `schema.sql` già pronto per Supabase.

---

## 1. Il concetto in una frase

**Un gruppo = una riga nella tabella `birozze_sessions` su Supabase.**

- Il **codice gruppo** (es. `LUPPOLO-K4T9`) è la chiave primaria (`id TEXT`) della riga.
- Lo **stato dell'intero gruppo** (crew, bevute, spese, perle, oscar, foto, timer) è il campo `state JSONB`.
- **Supabase Realtime** notifica ogni modifica della riga a tutti i dispositivi collegati: nessun refresh manuale.

Lo `schema.sql` del progetto contiene già tutto il necessario:

```sql
CREATE TABLE IF NOT EXISTS public.birozze_sessions (
    id TEXT PRIMARY KEY,          -- il codice gruppo
    state JSONB NOT NULL,         -- tutto lo stato condiviso
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.birozze_sessions DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.birozze_sessions;
-- + policy per il bucket Storage pubblico "birozze_photos"
```

---

## 2. Il flusso utente

```
┌─────────────┐   crea gruppo    ┌──────────────────────────┐
│   Gabbo     │ ───────────────► │ INSERT riga "LUPPOLO-K4T9"│
│ (fondatore) │   riceve codice  │ state = stato iniziale   │
└─────────────┘                  └──────────────────────────┘
                                          ▲        │
┌─────────────┐   inserisce codice        │        │ Realtime: UPDATE
│ Teo, Vale…  │ ──────────────────────────┘        ▼
│ (ospiti)    │   SELECT riga + subscribe ◄── tutti ricevono il nuovo state
└─────────────┘   sceglie "chi sono" (salvato solo sul suo telefono)
```

1. **Crea gruppo** → l'app genera un codice corto leggibile, fa `INSERT` su Supabase, salva il codice in `localStorage("birozze_group")`.
2. **Entra nel gruppo** → l'amico digita il codice, l'app fa `SELECT`, carica lo stato e si iscrive al canale Realtime di quella riga.
3. **Interazione** → ogni azione (es. "aggiungo una bevuta") aggiorna lo stato locale **e** fa `UPDATE` su Supabase; il Realtime spinge il nuovo stato a tutti gli altri dispositivi, che ri-renderizzano automaticamente.

---

## 3. I 5 cambiamenti tecnici necessari

### 3.1 Client Supabase in ogni pagina

Prima di `shared.js`, in tutte le 8 pagine:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js"></script>   <!-- nuovo: credenziali -->
<script src="shared.js"></script>
```

```js
// config.js
window.BIRROZZE_CONFIG = {
  url:  "https://TUO-PROGETTO.supabase.co",
  anon: "LA_TUA_ANON_KEY"
};
```

```js
// dentro shared.js
var sb = supabase.createClient(BIRROZZE_CONFIG.url, BIRROZZE_CONFIG.anon);
```

### 3.2 `shared.js`: da localStorage a "localStorage + cloud"

Il localStorage resta come **cache offline**; la fonte di verità diventa Supabase.

```js
// CREAZIONE: il fondatore
async function createGroup() {
  var code = generaCodice(); // es. "LUPPOLO-K4T9", senza caratteri ambigui (no O/0, I/1)
  await sb.from("birozze_sessions").insert({ id: code, state: DEFAULT_STATE });
  localStorage.setItem("birozze_group", code);
  return code;
}

// INGRESSO: gli amici
async function joinGroup(code) {
  var res = await sb.from("birozze_sessions").select("state").eq("id", code).single();
  if (res.error) throw new Error("Gruppo non trovato");
  _state = res.data.state;
  localStorage.setItem("birozze_group", code);
  subscribeRealtime(code);
}

// SCRITTURA: ogni update va anche sul cloud (debounced ~400ms)
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));   // cache offline
  clearTimeout(saveT);
  saveT = setTimeout(function () {
    sb.from("birozze_sessions")
      .update({ state: _state, updated_at: new Date().toISOString() })
      .eq("id", groupCode);
  }, 400);
}

// LETTURA LIVE: quando qualcun altro modifica
function subscribeRealtime(code) {
  sb.channel("room-" + code)
    .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "birozze_sessions",
          filter: "id=eq." + code },
        function (payload) {
          _state = payload.new.state;
          listeners.forEach(function (fn) { fn(_state); }); // notifica la pagina
        })
    .subscribe();
}
```

### 3.3 Le pagine devono poter ri-renderizzare

Oggi ogni pagina renderizza **una sola volta** al load. Serve il pattern observer:

- `shared.js` espone `BS.onChange(fn)` (registro di listener);
- ogni pagina racchiude i propri render in un'unica funzione `renderAll()`;
- la registra con `BS.onChange(renderAll)` e la chiama anche al load.

**Attenzione al re-render distruttivo**: se l'utente sta scrivendo in un input e
arriva un update remoto, il render non deve cancellare quello che sta digitando.
Se un input ha il focus, rimanda il render di quella sezione o preserva il valore.

### 3.4 Identità "chi sono" (senza login)

Non serve autenticazione: al primo ingresso l'utente sceglie/crea il proprio nome
nella crew, e l'app salva `localStorage("birozze_me") = "teo"` **sul suo dispositivo**
(NON nello stato condiviso). Così ognuno registra bevute a nome proprio ma vede
tutto il gruppo.

### 3.5 Foto sul bucket, non più base64

Oggi `compressImageFile` in `shared.js` salva le foto come base64 in localStorage:
nello stato condiviso farebbero esplodere il JSONB. Con il bucket `birozze_photos`
(già previsto dallo schema):

```js
await sb.storage.from("birozze_photos").upload(path, blob);
// nello state si salva solo: { url, caption, author, rot }
```

Comprimere comunque client-side prima dell'upload (max ~1200px). La galleria
resta identica: cambia solo la sorgente dell'immagine.

### 3.6 Schermata d'ingresso (UI)

Overlay/modal condiviso mostrato su ogni pagina quando `localStorage("birozze_group")`
è assente, con due azioni:

- **"Crea un nuovo gruppo"** → mostra il codice generato con bottone copia;
- **"Ho un codice"** → input + entra.

Se il codice è già presente si entra direttamente; in topnav appare un badge col
codice gruppo (click = copia, menu = esci dal gruppo).

### 3.7 Il timer va reso condiviso correttamente

Il timer di index.html oggi incrementa `elapsed` ogni secondo in locale. In versione
condivisa **NON si deve scrivere su Supabase dentro il `setInterval`** (sarebbe una
scrittura al secondo). Soluzione: salvare nello stato `startedAt` (timestamp di avvio)
e derivare `elapsed` da `Date.now() - startedAt` su ogni dispositivo. Una sola
scrittura all'avvio/pausa, tempo identico per tutti.

---

## 4. Il punto delicato: i conflitti

Con "una riga = tutto lo stato" la strategia naturale è **last-write-wins (LWW)**:
se Teo e Vale salvano nello stesso mezzo secondo, l'ultimo sovrascrive l'altro.

| Approccio | Sforzo | Robustezza | Quando usarlo |
|---|---|---|---|
| LWW puro | zero | bassa | mai da solo |
| **LWW + read-merge-write** | ~15 righe | alta per questo caso d'uso | **consigliato per Birozze** |
| Tabelle normalizzate (`groups`, `members`, `drinks`, `expenses`, …) | riscrittura della persistenza | da produzione | se l'app diventa "seria" |

**Read-merge-write** (la mitigazione consigliata): prima di ogni `UPDATE`, rileggi
la riga dal server, ri-applica la tua patch locale sullo stato remoto più recente,
poi scrivi. Elimina il ~95% dei problemi reali. Il debounce di 400ms e il Realtime
(riallineamento in ~100ms) riducono ulteriormente le collisioni.

La soluzione normalizzata (ogni azione = un `INSERT` di riga, che per natura non
confligge mai) è la strada "da produzione", ma per un'app tra amici in vacanza è
sovradimensionata: partire dal JSONB.

---

## 5. Sicurezza (nota onesta)

- Lo schema **disabilita la RLS**: chiunque conosca il codice può leggere e scrivere.
  Per un gruppo privato di amici va bene — il codice funziona da password condivisa.
- Usare **codici non banali**: 4+ caratteri alfanumerici casuali oltre alla parola
  (es. `LUPPOLO-K4T9`), mai sequenziali.
- La **anon key è pubblica per design** in Supabase: metterla in `config.js` non è
  una falla. La sicurezza sta nelle policy, non nel nascondere la chiave.

---

## 6. Il processo operativo, in ordine

1. **Supabase** (≈10 minuti, manuale): crea il progetto su supabase.com (piano free
   basta) → SQL Editor → incolla ed esegui `schema.sql` → Storage → crea bucket
   pubblico `birozze_photos` → Settings → API → copia URL e anon key.
2. Crea `config.js` con le credenziali.
3. Modifica `shared.js`: client Supabase, `createGroup`/`joinGroup`/`leaveGroup`,
   `save()` con debounce + read-merge-write, `subscribeRealtime`, `onChange`.
4. Aggiungi la schermata crea/entra gruppo + badge codice in topnav.
5. Adatta le 8 pagine al pattern `renderAll()` + `BS.onChange` (attenzione a input
   con focus e al timer con `startedAt`).
6. Sposta l'upload foto sul bucket.
7. **Test reale**: apri il sito da due telefoni con lo stesso codice e aggiungi una
   bevuta da uno — deve apparire sull'altro entro ~1 secondo.

Stima: i punti 3–5 sono il grosso (~una giornata di lavoro ordinato); il resto è
configurazione.

---

## 7. Fattibilità con un modello AI attuale (valutazione onesta)

**Sì, si può fare.** Il pattern "riga JSONB + Supabase Realtime + vanilla JS" è
tecnologia semplice e ben documentata; il codebase è piccolo e pulito, senza build
step. Un modello attuale implementa tutto il codice in modo affidabile in una sessione.

**Cosa il modello NON può fare da solo:**

1. **Creare il progetto Supabase** — account, esecuzione schema, bucket, copia
   credenziali: sono click che spettano all'utente (≈10 minuti).
2. **Il test multi-dispositivo reale** — il modello può testare con due finestre
   browser e chiamate API dirette, ma la conferma "due telefoni, stesso codice,
   sync in un secondo" spetta all'utente. Un buon prompt impone criteri di
   accettazione verificabili e una checklist di test manuale esplicita.

**Deploy su Vercel**: nessun problema — il sito è statico, Vercel lo serve così
com'è (drag & drop della cartella o `vercel deploy`). Nessun build step, nessuna
variabile d'ambiente server: le credenziali stanno in `config.js`.

**I 3 bug tipici che un modello commette senza vincoli espliciti** (e che il prompt
della sezione 8 previene):

- re-render che cancella il testo negli input mentre l'utente scrive;
- timer che scrive su Supabase ogni secondo dentro il `setInterval`;
- nessuna gestione dei conflitti concorrenti (LWW puro senza read-merge-write).

---

## 8. Il prompt completo (pronto all'uso)

> Da incollare in una nuova sessione di Claude Code aperta nella cartella BIRROZZE.
> Prima di usarlo, sostituire i due placeholder `<<...>>` con i valori reali di Supabase.

```text
Agisci come senior web developer. Trasforma il sito "Birozze" (in questa cartella) da app
single-device basata su localStorage ad app multi-utente in tempo reale con gruppi,
usando Supabase, mantenendola 100% statica (vanilla HTML/CSS/JS, nessun build step)
così da poterla deployare su Vercel senza configurazione.

═══ CONTESTO DEL CODEBASE (leggilo prima di scrivere codice) ═══
- shared.js espone window.BirrozzeState (BS): stato globale in localStorage
  (chiave "birozze_state_v6"), con load/save/get/update sincroni, calculateSettlements
  (algoritmo Splitwise), CATALOG di 30 drink, compressImageFile che salva foto in base64.
- 8 pagine: index.html (dashboard bento con stat live), consumazioni.html,
  classifica.html, spese.html, galleria.html, perle.html, oscar.html, prossima.html.
  Ogni pagina ha un proprio <script> che chiama BS.load() e renderizza UNA volta al load.
- schema.sql contiene già la tabella public.birozze_sessions
  (id TEXT PRIMARY KEY, state JSONB, updated_at) con Realtime abilitato, RLS disabilitata,
  e le policy per il bucket Storage pubblico "birozze_photos".
- shared.css è il design system (palette ocra/carta calda): riusa i suoi token e le sue
  classi per ogni UI nuova; non inventare stili fuori palette.

═══ CREDENZIALI (già create dall'utente su supabase.com) ═══
URL progetto:  <<SUPABASE_URL>>
Anon key:      <<SUPABASE_ANON_KEY>>
Lo schema.sql è già stato eseguito e il bucket "birozze_photos" esiste già.
Metti le credenziali in un nuovo file config.js (window.BIRROZZE_CONFIG = {...})
incluso da ogni pagina PRIMA di shared.js. Non usare import ES module, niente bundler.

═══ ARCHITETTURA RICHIESTA (non deviare) ═══
1. Un gruppo = una riga di birozze_sessions. Il codice gruppo è l'id della riga:
   formato "parola-birra + 4 caratteri" leggibile e non banale (es. "LUPPOLO-K4T9"),
   generato lato client, maiuscolo, senza caratteri ambigui (no O/0, I/1).
2. Client Supabase via CDN in ogni pagina:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
3. shared.js diventa la sola fonte di verità per la sincronizzazione:
   - BS.createGroup(): INSERT riga con DEFAULT_STATE, salva codice in
     localStorage("birozze_group"), ritorna il codice.
   - BS.joinGroup(code): SELECT .single(); se non esiste, errore leggibile in italiano.
   - BS.leaveGroup(): rimuove il codice locale, torna alla schermata d'ingresso.
   - save(): scrive SEMPRE in localStorage (cache offline) e fa UPDATE su Supabase
     con debounce di 400ms. Prima dell'UPDATE esegui read-merge-write: rileggi la riga,
     ri-applica la patch locale sullo stato remoto più recente, poi scrivi
     (mitigazione last-write-wins).
   - subscribeRealtime(code): canale postgres_changes filtrato su id=eq.<code>;
     al payload aggiorna _state e notifica i listener.
   - BS.onChange(fn): registro di listener; ogni pagina registra il proprio render.
   - Gestisci riconnessione: su evento "visibilitychange" o canale in stato di errore,
     rifai il SELECT completo per riallinearti.
4. Identità per-dispositivo: localStorage("birozze_me") = id del membro crew scelto.
   Al primo ingresso in un gruppo mostra un picker "Chi sei?" (lista crew esistente
   + campo "aggiungimi") riusando lo stile dei chip/modali di shared.css.
5. Foto: sostituisci il salvataggio base64 con upload sul bucket birozze_photos
   (comprimi comunque client-side prima dell'upload, max ~1200px);
   nello state salva solo { url, caption, author, rot }. Le foto esistenti in base64
   eventualmente presenti nello stato vanno tollerate in lettura (render invariato).
6. Schermata d'ingresso: nuovo overlay/modal condiviso (in shared.js + shared.css o
   markup iniettato) mostrato su OGNI pagina quando localStorage("birozze_group") è
   assente: due azioni — "Crea un nuovo gruppo" (mostra il codice generato con bottone
   copia) e "Ho un codice" (input + entra). Se il codice è presente, si entra
   direttamente e in topnav appare un badge col codice gruppo (click = copia,
   long-press/menu = esci dal gruppo).

═══ ADATTAMENTO DELLE PAGINE ═══
In ognuna delle 8 pagine: racchiudi tutti i render in un'unica funzione renderAll(),
chiamala al load E registrala con BS.onChange(renderAll). Attenzione ai casi con stato
UI locale (input aperti, modal, filtri attivi): il re-render non deve cancellare quello
che l'utente sta scrivendo — se un input ha il focus, rimanda il render di quella
sezione o preserva il valore. Il timer (index.html) va guidato dallo stato condiviso:
salva startedAt (timestamp) invece di incrementare elapsed localmente, così tutti i
dispositivi mostrano lo stesso tempo senza scritture ogni secondo. Aggiorna anche
elapsed derivandolo da startedAt. NON scrivere su Supabase dentro il setInterval.

═══ VINCOLI ═══
- Niente framework, niente bundler, niente TypeScript: il sito deve restare deployabile
  su Vercel trascinando la cartella (aggiungi solo un vercel.json minimale se serve
  per gli header, altrimenti niente).
- Tutte le stringhe UI in italiano colloquiale ma chiaro, coerenti col tono del sito.
- Non rompere calculateSettlements, il catalogo drink, né alcun id/classe usato dai
  render esistenti. Le pagine devono funzionare anche offline in sola lettura
  (cache localStorage) mostrando un avviso "offline, ultimi dati noti".
- Gestione errori visibile: ogni fallimento di rete → BS.toast con messaggio utile,
  mai console-only.

═══ CRITERI DI ACCETTAZIONE (verificali tu stesso prima di dichiarare finito) ═══
1. Aprendo index.html senza gruppo salvato appare la schermata crea/entra.
2. createGroup inserisce davvero la riga (verifica con una SELECT via API REST o
   spiegami come verificarlo dalla dashboard Supabase).
3. Con due browser diversi (o finestra normale + incognito) sullo stesso codice:
   una bevuta aggiunta nel primo appare nel secondo entro ~1s senza refresh.
4. Un input di testo con focus non perde il contenuto quando arriva un update remoto.
5. Upload foto: file → bucket → URL pubblico visibile nella galleria di entrambi
   i browser.
6. Codice gruppo errato → messaggio d'errore chiaro, non crash.
7. Nessun errore in console su nessuna delle 8 pagine.
Alla fine, dammi la checklist di test manuale multi-dispositivo che non puoi eseguire
tu (2 telefoni) e le istruzioni di deploy su Vercel passo-passo.

Procedi così: leggi shared.js e 2-3 pagine per capire i pattern, poi implementa
shared.js + config.js + schermata d'ingresso, poi adatta le pagine una a una,
poi verifica i criteri di accettazione con i browser tool o richieste HTTP dirette
all'API Supabase. Lavora in autonomia; chiedimi solo se le credenziali non funzionano.
```

---

## 9. Deploy su Vercel — riferimento rapido

1. Account su vercel.com (free).
2. **Opzione drag & drop**: vercel.com/new → trascina la cartella BIRROZZE → Deploy.
3. **Opzione CLI**: `npm i -g vercel` → nella cartella: `vercel` → conferma i default
   (nessun framework, nessun build command, output directory = root).
4. Il sito è statico: ogni pagina `.html` è raggiungibile direttamente
   (es. `tuodominio.vercel.app/consumazioni.html`).
5. Aggiornamenti: ri-deploy con `vercel --prod` (o nuovo drag & drop).

**Checklist post-deploy (manuale, 2 dispositivi):**

- [ ] Telefono A: crea gruppo, copia il codice.
- [ ] Telefono B: entra col codice, scegli un membro diverso della crew.
- [ ] A aggiunge una bevuta → appare su B entro ~1s senza refresh.
- [ ] B aggiunge una spesa → i debiti si aggiornano su A.
- [ ] A carica una foto → visibile nella galleria di B.
- [ ] A avvia il timer → B mostra lo stesso tempo.
- [ ] B scrive una perla mentre A modifica altro → il testo di B non si perde.
- [ ] Codice inventato → messaggio d'errore chiaro.

---

*Documento generato il 17/07/2026 — Birozze v7.0*
