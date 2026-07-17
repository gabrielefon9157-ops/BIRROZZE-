/**
 * BIROZZE v6.0 — shared.js
 * Stato globale condiviso tra tutte le pagine via localStorage.
 * Ogni pagina importa questo script e usa window.BirrozzeState.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "birozze_state_v6";

  /* ---- Dati di default (primo avvio) ---- */
  var DEFAULT_STATE = {
    crew: [],
    expenses: [],
    photos: [],
    perle: [],
    oscars: [
      { id: "o1", title: "Il più ritardatario",     votes: {} },
      { id: "o2", title: "Miglior ballerino",        votes: {} },
      { id: "o3", title: "Quello che si perde",      votes: {} },
      { id: "o4", title: "Re/Regina dell'aperitivo", votes: {} }
    ],
    nextOpts: [],
    elapsed: 0,
    running: false,
    alcoholSplitMode: "uguale",
    prices: {}
  };

  /* ---- Catalogo drink (30 voci) ---- */
  var CATALOG = [
    { id: "jack",       name: "Jack Daniel's",     cat: "Whisky",   price: 28 },
    { id: "jim",        name: "Jim Beam",           cat: "Whisky",   price: 22 },
    { id: "jameson",    name: "Jameson",            cat: "Whisky",   price: 26 },
    { id: "johnnie",    name: "Johnnie Walker",     cat: "Whisky",   price: 30 },
    { id: "chivas",     name: "Chivas Regal",       cat: "Whisky",   price: 34 },
    { id: "glen",       name: "Glenfiddich",        cat: "Whisky",   price: 42 },
    { id: "ballant",    name: "Ballantine's",       cat: "Whisky",   price: 22 },
    { id: "smirnoff",   name: "Smirnoff",           cat: "Vodka",    price: 16 },
    { id: "absolut",    name: "Absolut",            cat: "Vodka",    price: 20 },
    { id: "greygoose",  name: "Grey Goose",         cat: "Vodka",    price: 42 },
    { id: "belvedere",  name: "Belvedere",          cat: "Vodka",    price: 40 },
    { id: "bombay",     name: "Bombay Sapphire",    cat: "Gin",      price: 24 },
    { id: "tanqueray",  name: "Tanqueray",          cat: "Gin",      price: 24 },
    { id: "gordons",    name: "Gordon's",           cat: "Gin",      price: 16 },
    { id: "hendricks",  name: "Hendrick's",         cat: "Gin",      price: 34 },
    { id: "bacardi",    name: "Bacardi",            cat: "Rum",      price: 18 },
    { id: "havana",     name: "Havana Club",        cat: "Rum",      price: 20 },
    { id: "morgan",     name: "Captain Morgan",     cat: "Rum",      price: 18 },
    { id: "malibu",     name: "Malibu",             cat: "Rum",      price: 16 },
    { id: "cuervo",     name: "Jose Cuervo",        cat: "Tequila",  price: 24 },
    { id: "patron",     name: "Patrón",             cat: "Tequila",  price: 48 },
    { id: "donjulio",   name: "Don Julio",          cat: "Tequila",  price: 46 },
    { id: "hennessy",   name: "Hennessy",           cat: "Cognac",   price: 48 },
    { id: "remy",       name: "Rémy Martin",        cat: "Cognac",   price: 52 },
    { id: "jager",      name: "Jägermeister",       cat: "Liquori",  price: 20 },
    { id: "campari",    name: "Campari",            cat: "Liquori",  price: 15 },
    { id: "aperol",     name: "Aperol",             cat: "Liquori",  price: 14 },
    { id: "fernet",     name: "Fernet-Branca",      cat: "Liquori",  price: 18 },
    { id: "montenegro", name: "Amaro Montenegro",   cat: "Liquori",  price: 18 },
    { id: "baileys",    name: "Baileys",            cat: "Liquori",  price: 17 }
  ];

  /* ---- Utilities ---- */
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(v) {
    return (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");
  }
  function parseP(s) {
    var v = parseFloat(String(s).replace(",", ".").replace(/[^0-9.]/g, ""));
    return isNaN(v) ? 0 : Math.max(0, v);
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function deepMerge(target, source) {
    for (var k in source) {
      if (
        source[k] !== null &&
        typeof source[k] === "object" &&
        !Array.isArray(source[k])
      ) {
        target[k] = deepMerge(target[k] || {}, source[k]);
      } else {
        target[k] = source[k];
      }
    }
    return target;
  }

  /* ---- Supabase Integration Variables ---- */
  var sb = null;
  var realtimeChannel = null;
  var _state = deepClone(DEFAULT_STATE);
  var _lastSyncedState = deepClone(DEFAULT_STATE);
  var _quotaWarned = false;

  var CONFIG_STORAGE_KEY = "birozze_supabase_config";
  var GROUP_STORAGE_KEY = "birozze_active_group";

  /* Caricamento dinamico di Supabase JS via CDN se non già presente */
  function ensureSupabaseSdk(callback) {
    if (window.supabase) {
      callback();
      return;
    }
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.onload = function() {
      callback();
    };
    document.head.appendChild(script);
  }

  /* Ottiene le credenziali (config.js o localStorage locale) */
  function getSupabaseConfig() {
    if (window.BIRROZZE_CONFIG && window.BIRROZZE_CONFIG.supabaseUrl) {
      return window.BIRROZZE_CONFIG;
    }
    try {
      var local = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch (e) {}
    return { supabaseUrl: "", supabaseKey: "" };
  }

  function saveSupabaseConfig(url, key) {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ supabaseUrl: url, supabaseKey: key }));
    } catch (e) {}
  }

  /* Inizializza il client Supabase */
  function initSupabase() {
    var conf = getSupabaseConfig();
    if (conf.supabaseUrl && conf.supabaseKey) {
      try {
        sb = window.supabase.createClient(conf.supabaseUrl, conf.supabaseKey);
        return true;
      } catch (e) {
        console.error("[Birrozze] Errore inizializzazione Supabase:", e);
      }
    }
    sb = null;
    return false;
  }

  /* Verifica se la modalità cloud è attiva */
  function isConnected() {
    return sb !== null && getActiveGroupId() !== null;
  }

  function getActiveGroupId() {
    try {
      return localStorage.getItem(GROUP_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setActiveGroupId(id) {
    try {
      if (id) localStorage.setItem(GROUP_STORAGE_KEY, id);
      else    localStorage.removeItem(GROUP_STORAGE_KEY);
    } catch (e) {}
  }

  /* ---- State Management (localStorage + Supabase Relational) ---- */
  function load() {
    // 1. Carica prima da localStorage come fallback/copia offline
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        _state = deepMerge(deepClone(DEFAULT_STATE), parsed);
      }
    } catch (e) {
      console.error("[BirrozzeState] Errore nel caricamento locale:", e);
      _state = deepClone(DEFAULT_STATE);
    }

    // 2. Se connesso a Supabase, la sincronizzazione asincrona aggiornerà lo stato
    var gid = getActiveGroupId();
    if (sb && gid) {
      // Caricamento non-blocking per non congelare la UI
      loadFromSupabase(gid);
    }

    return _state;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
      _quotaWarned = false;
      
      // Se connesso, esegui il diff verso Supabase
      if (isConnected()) {
        syncDiff();
      }
      return true;
    } catch (e) {
      console.error("[BirrozzeState] Errore nel salvataggio locale:", e);
      if (!_quotaWarned) {
        _quotaWarned = true;
        try { toast("Spazio locale esaurito!"); } catch (_) {}
      }
      return false;
    }
  }

  function get() { return _state; }

  function update(patch) {
    deepMerge(_state, patch);
    save();
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setActiveGroupId(null);
    } catch (e) {}
    _state = deepClone(DEFAULT_STATE);
    _lastSyncedState = deepClone(DEFAULT_STATE);
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
    save();
    location.reload();
  }

  /* Caricamento relazionale massivo in tempo reale */
  async function loadFromSupabase(sessionId) {
    if (!sb) return;
    try {
      var results = await Promise.all([
        sb.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
        sb.from("crew").select("*").eq("session_id", sessionId),
        sb.from("drinks_consumed").select("*").eq("session_id", sessionId),
        sb.from("expenses").select("*").eq("session_id", sessionId),
        sb.from("photos").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
        sb.from("perle").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
        sb.from("oscars").select("*").eq("session_id", sessionId),
        sb.from("oscar_votes").select("*").eq("session_id", sessionId),
        sb.from("proposals").select("*").eq("session_id", sessionId),
        sb.from("proposal_votes").select("*").eq("session_id", sessionId)
      ]);

      var sess = results[0].data;
      if (!sess) {
        // Se non esiste, la sessione viene inizializzata con lo stato locale
        await createSupabaseSession(sessionId);
        return;
      }

      var crewList = results[1].data || [];
      var drinksList = results[2].data || [];
      var expensesList = results[3].data || [];
      var photosList = results[4].data || [];
      var perleList = results[5].data || [];
      var oscarsList = results[6].data || [];
      var oscarVotesList = results[7].data || [];
      var proposalsList = results[8].data || [];
      var proposalVotesList = results[9].data || [];

      var newState = {};
      newState.alcoholSplitMode = sess.alcohol_split_mode;
      newState.elapsed = sess.timer_elapsed;
      newState.running = sess.timer_running;

      // Crew & Drinks
      newState.crew = crewList.map(function(c) {
        var pDrinks = {};
        drinksList.filter(function(d) { return d.crew_id === c.id; }).forEach(function(d) {
          pDrinks[d.drink_id] = d.quantity;
        });
        return { id: c.id, name: c.name, drinks: pDrinks, is_active: c.is_active };
      });

      // Expenses
      newState.expenses = expensesList.map(function(e) {
        return { id: e.id, desc: e.description, amount: parseFloat(e.amount), paidBy: e.paid_by, splitAmong: e.split_among };
      });

      // Photos
      newState.photos = photosList.map(function(p) {
        return { id: p.id, url: p.url, caption: p.caption, author: p.author, rot: parseFloat(p.rotation) };
      });

      // Perle
      newState.perle = perleList.map(function(p) {
        return { id: p.id, text: p.text, author: p.author, c: p.color, rot: parseFloat(p.rotation) };
      });

      // Oscars
      newState.oscars = oscarsList.map(function(o) {
        var votesMap = {};
        oscarVotesList.filter(function(v) { return v.oscar_id === o.id; }).forEach(function(v) {
          votesMap[v.candidate_id] = (votesMap[v.candidate_id] || 0) + 1;
        });
        return { id: o.id, title: o.title, votes: votesMap };
      });

      // Proposals (nextOpts)
      newState.nextOpts = proposalsList.map(function(p) {
        var votersList = proposalVotesList.filter(function(v) { return v.proposal_id === p.id; }).map(function(v) { return v.voter_id; });
        return { id: p.id, label: p.label, votes: votersList.length, voters: votersList };
      });

      // Confronta lo stato per verificare se ci sono cambiamenti
      var stateChanged = JSON.stringify(_state) !== JSON.stringify(newState);
      _state = newState;
      _lastSyncedState = deepClone(_state);
      
      // Salva copia cache locale
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));

      if (stateChanged) {
        triggerStateChangeEvent();
      }
    } catch (e) {
      console.error("[Birrozze] Errore durante il recupero da Supabase:", e);
    }
  }

  /* Crea la sessione e popola le tabelle relazionali */
  async function createSupabaseSession(sessionId) {
    try {
      await sb.from("sessions").insert({
        id: sessionId,
        name: "Gruppo " + sessionId,
        alcohol_split_mode: _state.alcoholSplitMode,
        timer_elapsed: _state.elapsed,
        timer_running: _state.running
      });

      // Inserisci Crew
      for (var i = 0; i < _state.crew.length; i++) {
        var c = _state.crew[i];
        await sb.from("crew").insert({ id: c.id, session_id: sessionId, name: c.name, is_active: c.is_active });
        
        // Inserisci Drinks
        for (var did in c.drinks) {
          await sb.from("drinks_consumed").insert({
            session_id: sessionId,
            crew_id: c.id,
            drink_id: did,
            quantity: c.drinks[did]
          });
        }
      }

      // Inserisci Expenses
      for (var i = 0; i < _state.expenses.length; i++) {
        var e = _state.expenses[i];
        await sb.from("expenses").insert({
          id: e.id,
          session_id: sessionId,
          description: e.desc,
          amount: e.amount,
          paid_by: e.paidBy,
          split_among: e.split_among
        });
      }

      // Inserisci Photos
      for (var i = 0; i < _state.photos.length; i++) {
        var p = _state.photos[i];
        await sb.from("photos").insert({
          id: p.id,
          session_id: sessionId,
          url: p.url,
          caption: p.caption,
          author: p.author,
          rotation: p.rot
        });
      }

      // Inserisci Perle
      for (var i = 0; i < _state.perle.length; i++) {
        var p = _state.perle[i];
        await sb.from("perle").insert({
          id: p.id,
          session_id: sessionId,
          text: p.text,
          author: p.author,
          color: p.c,
          rotation: p.rot
        });
      }

      // Inserisci Oscars
      for (var i = 0; i < _state.oscars.length; i++) {
        var o = _state.oscars[i];
        await sb.from("oscars").insert({ id: o.id, session_id: sessionId, title: o.title });
        // Inserisci voti fittizi per contatore iniziale
        for (var candId in o.votes) {
          for (var k = 0; k < o.votes[candId]; k++) {
            await sb.from("oscar_votes").insert({
              session_id: sessionId,
              oscar_id: o.id,
              voter_id: "voter_" + uid(),
              candidate_id: candId
            });
          }
        }
      }

      // Inserisci Proposals (nextOpts)
      for (var i = 0; i < _state.nextOpts.length; i++) {
        var p = _state.nextOpts[i];
        await sb.from("proposals").insert({ id: p.id, session_id: sessionId, label: p.label });
        var voters = p.voters || [];
        for (var k = 0; k < voters.length; k++) {
          await sb.from("proposal_votes").insert({
            session_id: sessionId,
            proposal_id: p.id,
            voter_id: voters[k]
          });
        }
      }

      _lastSyncedState = deepClone(_state);
    } catch (e) {
      console.error("[Birrozze] Errore inizializzazione tabelle Supabase:", e);
    }
  }

  /* Algoritmo intelligente di sincronizzazione differenziale */
  async function syncDiff() {
    if (!isConnected()) return;
    var sessionId = getActiveGroupId();
    var oldState = _lastSyncedState || DEFAULT_STATE;
    var newState = _state;

    try {
      // 1. Session fields
      if (
        newState.alcoholSplitMode !== oldState.alcoholSplitMode ||
        newState.elapsed !== oldState.elapsed ||
        newState.running !== oldState.running
      ) {
        await sb.from("sessions").update({
          alcohol_split_mode: newState.alcoholSplitMode,
          timer_elapsed: newState.elapsed,
          timer_running: newState.running,
          updated_at: new Date()
        }).eq("id", sessionId);
      }

      // 2. Crew additions, deletions & active status
      var oldCrew = oldState.crew || [];
      var newCrew = newState.crew || [];

      // Deletes
      for (var i = 0; i < oldCrew.length; i++) {
        var found = false;
        for (var j = 0; j < newCrew.length; j++) {
          if (newCrew[j].id === oldCrew[i].id) { found = true; break; }
        }
        if (!found) {
          await sb.from("crew").delete().eq("id", oldCrew[i].id).eq("session_id", sessionId);
        }
      }

      // Inserts / Updates / Drinks
      for (var j = 0; j < newCrew.length; j++) {
        var nc = newCrew[j];
        var oc = oldCrew.find(function(c) { return c.id === nc.id; });
        if (!oc) {
          await sb.from("crew").insert({ id: nc.id, session_id: sessionId, name: nc.name, is_active: nc.is_active });
        } else if (oc.is_active !== nc.is_active || oc.name !== nc.name) {
          await sb.from("crew").update({ name: nc.name, is_active: nc.is_active }).eq("id", nc.id).eq("session_id", sessionId);
        }

        var oldDrinks = (oc && oc.drinks) || {};
        var newDrinks = nc.drinks || {};
        // Upserts
        for (var did in newDrinks) {
          if (newDrinks[did] !== oldDrinks[did]) {
            await sb.from("drinks_consumed").upsert({
              session_id: sessionId,
              crew_id: nc.id,
              drink_id: did,
              quantity: newDrinks[did]
            }, { onConflict: "crew_id,drink_id" });
          }
        }
        // Deletes
        for (var did in oldDrinks) {
          if (newDrinks[did] === undefined) {
            await sb.from("drinks_consumed").delete().eq("crew_id", nc.id).eq("drink_id", did).eq("session_id", sessionId);
          }
        }
      }

      // 3. Expenses
      var oldExp = oldState.expenses || [];
      var newExp = newState.expenses || [];
      for (var i = 0; i < oldExp.length; i++) {
        if (!newExp.find(function(e) { return e.id === oldExp[i].id; })) {
          await sb.from("expenses").delete().eq("id", oldExp[i].id).eq("session_id", sessionId);
        }
      }
      for (var j = 0; j < newExp.length; j++) {
        var ne = newExp[j];
        if (!oldExp.find(function(e) { return e.id === ne.id; })) {
          await sb.from("expenses").insert({
            id: ne.id,
            session_id: sessionId,
            description: ne.desc,
            amount: ne.amount,
            paid_by: ne.paidBy,
            split_among: ne.splitAmong
          });
        }
      }

      // 4. Photos
      var oldPh = oldState.photos || [];
      var newPh = newState.photos || [];
      for (var i = 0; i < oldPh.length; i++) {
        if (!newPh.find(function(p) { return p.id === oldPh[i].id; })) {
          // Cancella riga dal DB
          await sb.from("photos").delete().eq("id", oldPh[i].id).eq("session_id", sessionId);
          // Se era su Supabase Storage, cancella anche il file fisico
          var oldUrl = oldPh[i].url || "";
          if (oldUrl.indexOf("supabase.co/storage/v1/object/public") !== -1) {
            var fileName = sessionId + "/" + oldPh[i].id + ".jpg";
            await sb.storage.from("birozze_photos").remove([fileName]);
          }
        }
      }
      for (var j = 0; j < newPh.length; j++) {
        var np = newPh[j];
        if (!oldPh.find(function(p) { return p.id === np.id; })) {
          var finalUrl = np.url;

          // Se l'immagine è in formato base64, prova a caricarla su Supabase Storage
          if (finalUrl.indexOf("data:image/") === 0) {
            try {
              var blob = dataURLtoBlob(finalUrl);
              var fileName = sessionId + "/" + np.id + ".jpg";
              var uploadRes = await sb.storage
                .from("birozze_photos")
                .upload(fileName, blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: true });
              
              if (!uploadRes.error) {
                var getUrlRes = sb.storage.from("birozze_photos").getPublicUrl(fileName);
                if (getUrlRes.data && getUrlRes.data.publicUrl) {
                  finalUrl = getUrlRes.data.publicUrl;
                  // Aggiorna localmente l'URL per salvare banda ed eliminare base64 pesanti da localStorage
                  np.url = finalUrl;
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
                }
              } else {
                console.warn("[Birrozze] Errore caricamento storage (fallback su base64 nel DB):", uploadRes.error);
              }
            } catch (storageErr) {
              console.error("[Birrozze] Caricamento storage fallito, uso fallback base64:", storageErr);
            }
          }

          await sb.from("photos").insert({
            id: np.id,
            session_id: sessionId,
            url: finalUrl,
            caption: np.caption,
            author: np.author,
            rotation: np.rot
          });
        }
      }

      // 5. Perle
      var oldPe = oldState.perle || [];
      var newPe = newState.perle || [];
      for (var i = 0; i < oldPe.length; i++) {
        if (!newPe.find(function(p) { return p.id === oldPe[i].id; })) {
          await sb.from("perle").delete().eq("id", oldPe[i].id).eq("session_id", sessionId);
        }
      }
      for (var j = 0; j < newPe.length; j++) {
        var np = newPe[j];
        if (!oldPe.find(function(p) { return p.id === np.id; })) {
          await sb.from("perle").insert({
            id: np.id,
            session_id: sessionId,
            text: np.text,
            author: np.author,
            color: np.c,
            rotation: np.rot
          });
        }
      }

      // 6. Oscars
      var oldOsc = oldState.oscars || [];
      var newOsc = newState.oscars || [];
      for (var i = 0; i < oldOsc.length; i++) {
        if (!newOsc.find(function(o) { return o.id === oldOsc[i].id; })) {
          await sb.from("oscars").delete().eq("id", oldOsc[i].id).eq("session_id", sessionId);
        }
      }
      for (var j = 0; j < newOsc.length; j++) {
        var no = newOsc[j];
        var oo = oldOsc.find(function(o) { return o.id === no.id; });
        if (!oo) {
          await sb.from("oscars").insert({ id: no.id, session_id: sessionId, title: no.title });
        }
        var oldVotes = (oo && oo.votes) || {};
        var newVotes = no.votes || {};
        for (var candId in newVotes) {
          var diff = (newVotes[candId] || 0) - (oldVotes[candId] || 0);
          if (diff > 0) {
            for (var k = 0; k < diff; k++) {
              await sb.from("oscar_votes").insert({
                session_id: sessionId,
                oscar_id: no.id,
                voter_id: "voter_" + uid(),
                candidate_id: candId
              });
            }
          }
        }
      }

      // 7. Proposals (nextOpts)
      var oldProp = oldState.nextOpts || [];
      var newProp = newState.nextOpts || [];
      for (var i = 0; i < oldProp.length; i++) {
        if (!newProp.find(function(p) { return p.id === oldProp[i].id; })) {
          await sb.from("proposals").delete().eq("id", oldProp[i].id).eq("session_id", sessionId);
        }
      }
      for (var j = 0; j < newProp.length; j++) {
        var np = newProp[j];
        var op = oldProp.find(function(p) { return p.id === np.id; });
        if (!op) {
          await sb.from("proposals").insert({ id: np.id, session_id: sessionId, label: np.label });
        }
        var oldVoters = (op && op.voters) || [];
        var newVoters = np.voters || [];
        // Removes
        for (var k = 0; k < oldVoters.length; k++) {
          if (newVoters.indexOf(oldVoters[k]) === -1) {
            await sb.from("proposal_votes").delete().eq("proposal_id", np.id).eq("voter_id", oldVoters[k]).eq("session_id", sessionId);
          }
        }
        // Inserts
        for (var k = 0; k < newVoters.length; k++) {
          if (oldVoters.indexOf(newVoters[k]) === -1) {
            await sb.from("proposal_votes").insert({
              session_id: sessionId,
              proposal_id: np.id,
              voter_id: newVoters[k]
            });
          }
        }
      }

      _lastSyncedState = deepClone(_state);
    } catch (e) {
      console.error("[Birrozze] Errore durante la sincronizzazione Supabase:", e);
    }
  }

  /* Sottoscrizione WebSocket Realtime per reattività live */
  function subscribeRealtime(sessionId) {
    if (!sb) return;
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
    realtimeChannel = sb.channel("birozze_sync_" + sessionId)
      .on("postgres_changes", { event: "*", schema: "public" }, function(payload) {
        // Scarica lo stato relazionale aggiornato dal database
        loadFromSupabase(sessionId).then(function() {
          // Ricarica per allineare la UI solo se l'utente non sta scrivendo
          if (document.activeElement && (
            document.activeElement.tagName === "INPUT" || 
            document.activeElement.tagName === "SELECT" || 
            document.activeElement.tagName === "TEXTAREA"
          )) {
            return; 
          }
          location.reload();
        });
      })
      .subscribe();
  }

  function triggerStateChangeEvent() {
    window.dispatchEvent(new Event("birrozzeStateChange"));
  }

  /* Intercetta parametri di invito nell'URL (es: ?join=CODICE) */
  function checkUrlInvite() {
    var params = new URLSearchParams(window.location.search);
    var joinCode = params.get("join") || params.get("g");
    if (joinCode) {
      joinCode = joinCode.toUpperCase().trim();
      setActiveGroupId(joinCode);
      // Pulisce l'URL per estetica e per non reinnescare il caricamento
      var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
      
      ensureSupabaseSdk(function() {
        if (initSupabase()) {
          loadFromSupabase(joinCode);
          subscribeRealtime(joinCode);
          toast("Connesso al gruppo " + joinCode + "!");
        }
      });
    }
  }

  /* ---- Dynamic UI Widget (Navbar pill & Modal) ---- */
  function injectGroupWidget() {
    var navLinks = document.querySelector(".nav-links");
    if (!navLinks) return;

    // Aggiungi pulsante Navbar
    var pill = document.createElement("button");
    pill.className = "nav-group-pill offline";
    pill.id = "navGroupPill";
    pill.innerHTML = '<span class="status-dot"></span><span class="label">Offline</span>';
    navLinks.appendChild(pill);

    // Aggiorna stato pillola
    var updatePill = function() {
      var gid = getActiveGroupId();
      if (sb && gid) {
        pill.className = "nav-group-pill online";
        pill.querySelector(".label").textContent = gid;
      } else {
        pill.className = "nav-group-pill offline";
        pill.querySelector(".label").textContent = "Locale";
      }
    };
    updatePill();

    // Aggiungi Modal alla fine del body
    var modalHtml = 
      '<div class="birozze-modal-overlay" id="groupModalOverlay">' +
        '<div class="birozze-modal">' +
          '<div class="birozze-modal-header">' +
            '<h3>👥 Gestione Gruppo</h3>' +
            '<button class="birozze-modal-close" id="closeGroupModal">&times;</button>' +
          '</div>' +
          '<div class="birozze-modal-body">' +
            '<div id="groupActiveInfo" style="display:none;">' +
              '<p style="font-size:14px;color:var(--text-body);margin-bottom:8px;">Sei connesso al gruppo condiviso in tempo reale:</p>' +
              '<div style="font-family:var(--font-display);font-size:32px;font-weight:800;color:var(--amber-dark);text-align:center;background:var(--butter);padding:14px;border-radius:var(--r);letter-spacing:0.05em;margin-bottom:12px;" id="modalGroupCode">---</div>' +
              '<div style="display:flex;gap:8px;">' +
                '<button class="btn btn-primary" id="copyInviteLink" style="flex:1;font-size:13px;padding:10px;">Copia link invito</button>' +
                '<button class="btn btn-outline" id="disconnectGroup" style="flex:1;font-size:13px;padding:10px;color:var(--copper);border-color:rgba(232,85,47,.3);">Disconnetti</button>' +
              '</div>' +
            '</div>' +
            '<div id="groupInactiveInfo">' +
              '<p style="font-size:13.5px;color:var(--text-soft);line-height:1.5;margin-bottom:12px;">Crea un gruppo condiviso per registrare consumazioni, perle e spese insieme ai tuoi amici in tempo reale.</p>' +
              '<div>' +
                '<h4>Entra in un gruppo esistente</h4>' +
                '<div style="display:flex;gap:8px;margin-top:6px;">' +
                  '<input type="text" id="joinGroupCode" placeholder="Codice gruppo (es: LUPPOLO)..." style="flex:1;padding:8px 12px;font-size:13.5px;" uppercase>' +
                  '<button class="btn btn-primary" id="btnJoinGroup" style="padding:8px 16px;font-size:13px;">Entra</button>' +
                '</div>' +
              '</div>' +
              '<div style="text-align:center;margin:12px 0;font-size:12px;color:var(--text-mute);font-weight:700;">OPPURE</div>' +
              '<button class="btn btn-outline" id="btnCreateGroup" style="width:100%;padding:11px;font-weight:700;">Crea Nuovo Gruppo Condiviso</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    
    var div = document.createElement("div");
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstChild);

    var overlay = document.getElementById("groupModalOverlay");

    // Click pillola navbar -> apri modal
    pill.addEventListener("click", function() {
      var gid = getActiveGroupId();

      if (gid) {
        document.getElementById("groupActiveInfo").style.display = "block";
        document.getElementById("groupInactiveInfo").style.display = "none";
        document.getElementById("modalGroupCode").textContent = gid;
      } else {
        document.getElementById("groupActiveInfo").style.display = "none";
        document.getElementById("groupInactiveInfo").style.display = "block";
      }

      overlay.classList.add("open");
    });

    // Chiudi modal
    var closeModal = function() { overlay.classList.remove("open"); };
    document.getElementById("closeGroupModal").addEventListener("click", closeModal);
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) closeModal();
    });

    // Entra nel gruppo
    document.getElementById("btnJoinGroup").addEventListener("click", function() {
      var code = document.getElementById("joinGroupCode").value.trim().toUpperCase();
      if (!code) return;
      if (!sb) {
        alert("Impossibile connettersi al database. Ricarica la pagina o verifica la connessione internet.");
        return;
      }
      setActiveGroupId(code);
      updatePill();
      closeModal();
      loadFromSupabase(code);
      subscribeRealtime(code);
      toast("Connesso al gruppo " + code + "!");
    });

    // Crea gruppo
    document.getElementById("btnCreateGroup").addEventListener("click", async function() {
      if (!sb) {
        alert("Impossibile connettersi al database. Ricarica la pagina o verifica la connessione internet.");
        return;
      }
      var btn = this;
      btn.disabled = true;
      btn.textContent = "Creazione...";

      var code = "GRP-" + uid().toUpperCase().slice(0, 4);
      setActiveGroupId(code);
      await createSupabaseSession(code);
      
      updatePill();
      closeModal();
      subscribeRealtime(code);
      
      btn.disabled = false;
      btn.textContent = "Crea Nuovo Gruppo Condiviso";

      // Copia link invito negli appunti
      var inviteLink = window.location.protocol + "//" + window.location.host + window.location.pathname + "?join=" + code;
      navigator.clipboard.writeText(inviteLink).then(function() {
        toast("Gruppo creato! Link di invito copiato negli appunti 📋");
      }).catch(function() {
        toast("Gruppo creato con codice " + code + "!");
      });
    });

    // Copia link invito
    document.getElementById("copyInviteLink").addEventListener("click", function() {
      var code = getActiveGroupId();
      if (!code) return;
      var inviteLink = window.location.protocol + "//" + window.location.host + window.location.pathname + "?join=" + code;
      navigator.clipboard.writeText(inviteLink).then(function() {
        toast("Link di invito copiato! 📋");
      });
    });

    // Disconnetti gruppo
    document.getElementById("disconnectGroup").addEventListener("click", function() {
      if (confirm("Scollegarsi dal gruppo condiviso e tornare in modalità offline locale?")) {
        setActiveGroupId(null);
        if (realtimeChannel) {
          realtimeChannel.unsubscribe();
          realtimeChannel = null;
        }
        updatePill();
        closeModal();
        toast("Scollegato. Modalità locale ripristinata.");
        location.reload();
      }
    });
  }

  /* ---- Avvio e Sottoscrizione automatica ---- */
  ensureSupabaseSdk(function() {
    initSupabase();
    var gid = getActiveGroupId();
    if (sb && gid) {
      loadFromSupabase(gid);
      subscribeRealtime(gid);
    }
  });

  // Intercetta link di invito all'avvio
  checkUrlInvite();

  // Inietta widget navbar a caricamento completato
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectGroupWidget);
  } else {
    injectGroupWidget();
  }

  /* Rimuove un membro e tutti i suoi riferimenti (spese, voti)
     per non lasciare conti orfani nei settlements */
  function removeCrewMember(id) {
    _state.crew = _state.crew.filter(function (p) { return p.id !== id; });
    _state.expenses = _state.expenses.filter(function (e) { return e.paidBy !== id; });
    _state.expenses.forEach(function (e) {
      e.splitAmong = (e.splitAmong || []).filter(function (pid) { return pid !== id; });
    });
    _state.expenses = _state.expenses.filter(function (e) { return (e.splitAmong || []).length > 0; });
    _state.oscars.forEach(function (o) { if (o.votes) delete o.votes[id]; });
    return save();
  }

  /* Modifica il prezzo di un drink e lo rende persistente */
  function setPrice(drinkId, price) {
    var d = getDrinkById(drinkId);
    if (!d) return false;
    d.price = price;
    _state.prices = _state.prices || {};
    _state.prices[drinkId] = price;
    return save();
  }

  /* ---- Calcolo Settlements (Splitwise algorithm) ---- */
  function calculateSettlements() {
    var state = _state;
    var balances = {};
    var activePids = state.crew
      .filter(function (p) { return p.is_active; })
      .map(function (p) { return p.id; });

    state.crew.forEach(function (p) { balances[p.id] = 0; });

    var totalAlcoholCost = 0;
    var individualSpends = {};

    state.crew.forEach(function (p) {
      var spend = 0;
      for (var kid in p.drinks) {
        var d = getDrinkById(kid);
        if (d) spend += p.drinks[kid] * d.price;
      }
      individualSpends[p.id] = spend;
      totalAlcoholCost += spend;
    });

    if (state.alcoholSplitMode === "uguale") {
      state.crew.forEach(function (p) { balances[p.id] += individualSpends[p.id]; });
      if (activePids.length > 0) {
        var share = totalAlcoholCost / activePids.length;
        activePids.forEach(function (pid) { balances[pid] -= share; });
      }
    }
    // Se "consumo": ognuno paga ciò che ha bevuto → nessun ribilanciamento alcol

    state.expenses.forEach(function (exp) {
      var amount = parseFloat(exp.amount) || 0;
      var split = exp.splitAmong || [];
      if (split.length === 0 || amount <= 0) return;
      if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] += amount;
      var sh = amount / split.length;
      split.forEach(function (pid) {
        if (balances[pid] !== undefined) balances[pid] -= sh;
      });
    });

    var creditors = [], debtors = [];
    state.crew.forEach(function (p) {
      var b = balances[p.id];
      if (b > 0.005)  creditors.push({ id: p.id, name: p.name, amount: b });
      if (b < -0.005) debtors.push({ id: p.id, name: p.name, amount: -b });
    });
    creditors.sort(function (a, b) { return b.amount - a.amount; });
    debtors.sort(function (a, b) { return b.amount - a.amount; });

    var settlements = [];
    var ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      var c = creditors[ci], d = debtors[di];
      var min = Math.min(c.amount, d.amount);
      settlements.push({ from: d.name, to: c.name, amount: min });
      c.amount -= min; d.amount -= min;
      if (c.amount < 0.005) ci++;
      if (d.amount < 0.005) di++;
    }

    var totalVolume = settlements.reduce(function (a, s) { return a + s.amount; }, 0);
    var manualSum = state.expenses.reduce(function (a, e) { return a + (parseFloat(e.amount) || 0); }, 0);

    return {
      settlements: settlements,
      balances: balances,
      totalVolume: totalVolume,
      totalAlcoholCost: totalAlcoholCost,
      grandTotal: manualSum + totalAlcoholCost
    };
  }

  function totalDrinks() {
    return _state.crew.reduce(function (a, p) {
      var s = 0; for (var k in p.drinks) s += p.drinks[k]; return a + s;
    }, 0);
  }

  function getDrinkById(id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
    return null;
  }

  /* ---- Toast helper (usabile da ogni pagina) ---- */
  function toast(msg) {
    var container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1200);
  }

  /* ---- IntersectionObserver reveal ---- */
  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".fade-up").forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".fade-up").forEach(function (el) { obs.observe(el); });
  }

  /* ---- Navbar active link ---- */
  function markActiveNav() {
    var page = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link[data-page]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-page") === page);
    });
  }

  /* ---- Compress image for localStorage ---- */
  function compressImageFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function (evt) {
      var img = new Image();
      img.onload = function () {
        var MAX = 500, q = 0.68;
        var w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
          else       { w = Math.round((w * MAX) / h); h = MAX; }
        }
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/jpeg", q));
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---- Convert base64 to Blob ---- */
  function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), 
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[arr.length - 1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while(n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  }

  /* ---- Public API ---- */
  global.BirrozzeState = {
    load:                 load,
    save:                 save,
    get:                  get,
    update:               update,
    reset:                reset,
    setPrice:             setPrice,
    removeCrewMember:     removeCrewMember,
    calculateSettlements: calculateSettlements,
    totalDrinks:          totalDrinks,
    getDrinkById:         getDrinkById,
    CATALOG:              CATALOG,
    uid:                  uid,
    esc:                  esc,
    fmt:                  fmt,
    parseP:               parseP,
    toast:                toast,
    initReveal:           initReveal,
    markActiveNav:        markActiveNav,
    compressImageFile:    compressImageFile
  };

})(window);
