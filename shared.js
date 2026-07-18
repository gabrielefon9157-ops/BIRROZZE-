/**
 * BIROZZE v6.0 — shared.js
 * Stato globale condiviso tra tutte le pagine via localStorage.
 * Ogni pagina importa questo script e usa window.BirrozzeState.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "birozze_state_v6";
  var AUTH_KEY    = "birrozze_auth_profile";

  /* ---- Cancello d'accesso: senza profilo si finisce su login.html ----
     Vive qui (e non nelle singole pagine) così ogni pagina che carica
     shared.js è protetta automaticamente. login.html è esente. */
  (function authGate() {
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (page === "login.html") return;
    var logged = false;
    try { logged = !!localStorage.getItem(AUTH_KEY); } catch (e) {}
    if (!logged) location.replace("login.html");
  })();

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
    drinkingVotes: [],
    rides: [],
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
      if (id) {
        localStorage.setItem(GROUP_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(GROUP_STORAGE_KEY);
        localStorage.removeItem("birozze_active_group_name");
      }
    } catch (e) {}
  }

  var PROFILE_ID_KEY = "birozze_active_profile_id";

  function getActiveProfileId() {
    try {
      return localStorage.getItem(PROFILE_ID_KEY);
    } catch (e) {
      return null;
    }
  }

  function setActiveProfileId(id) {
    try {
      if (id) localStorage.setItem(PROFILE_ID_KEY, id);
      else    localStorage.removeItem(PROFILE_ID_KEY);
    } catch (e) {}
  }

  /* ============================================================
     AUTENTICAZIONE (Google + Email) E REGISTRO EMAIL
     ============================================================ */
  var _cloudReady = false;
  var _cloudReadyCbs = [];

  /* Esegue cb appena il client Supabase è inizializzato (o subito se lo è già) */
  function whenCloudReady(cb) {
    if (_cloudReady) { try { cb(); } catch (e) {} }
    else _cloudReadyCbs.push(cb);
  }

  function getAuthProfile() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setAuthProfile(profile) {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(profile)); } catch (e) {}
  }

  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  }

  /* Colleziona l'email nella tabella public.emails (best-effort, mai bloccante) */
  function recordEmail(profile) {
    if (!profile || !profile.email) return;
    whenCloudReady(function () {
      if (!sb) return;
      sb.from("emails").upsert({
        email: profile.email,
        name: profile.name || "",
        provider: profile.provider || "email",
        last_login: new Date().toISOString()
      }, { onConflict: "email" }).then(function (res) {
        if (res.error) console.warn("[Birrozze] Registro email:", res.error);
      });
    });
  }

  /* Login con email + nome */
  function signInWithEmail(email, name) {
    email = String(email || "").trim().toLowerCase();
    name  = String(name || "").trim();
    if (!isValidEmail(email)) return { ok: false, error: "Inserisci un'email valida." };
    if (!name)                return { ok: false, error: "Inserisci il tuo nome." };
    var profile = { email: email, name: name, provider: "email", ts: Date.now() };
    setAuthProfile(profile);
    recordEmail(profile);
    return { ok: true, profile: profile };
  }

  /* ---- Account veri con password (Supabase Auth) ---- */

  async function signInWithPassword(email, password) {
    email = String(email || "").trim().toLowerCase();
    if (!isValidEmail(email))            return { ok: false, error: "Inserisci un'email valida." };
    if (!password || password.length < 6) return { ok: false, error: "La password deve avere almeno 6 caratteri." };
    if (!sb) return { ok: false, error: "Connessione al server non disponibile. Riprova tra qualche secondo." };
    try {
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) {
        var m = res.error.message || "";
        var msg = /invalid login credentials/i.test(m) ? "Email o password errati." :
                  /email not confirmed/i.test(m)       ? "Email non ancora confermata: controlla la tua casella di posta." :
                  m;
        return { ok: false, error: msg };
      }
      var u = res.data.user;
      var meta = (u && u.user_metadata) || {};
      var profile = {
        email: email,
        name: meta.display_name || meta.full_name || email.split("@")[0],
        provider: "password",
        ts: Date.now()
      };
      setAuthProfile(profile);
      recordEmail(profile);
      return { ok: true, profile: profile };
    } catch (e) {
      return { ok: false, error: "Errore di rete durante l'accesso. Riprova." };
    }
  }

  async function signUpWithPassword(email, password, name) {
    email = String(email || "").trim().toLowerCase();
    name  = String(name || "").trim();
    if (!isValidEmail(email))             return { ok: false, error: "Inserisci un'email valida." };
    if (!password || password.length < 6) return { ok: false, error: "La password deve avere almeno 6 caratteri." };
    if (!name)                            return { ok: false, error: "Inserisci il tuo nome." };
    if (!sb) return { ok: false, error: "Connessione al server non disponibile. Riprova tra qualche secondo." };
    try {
      var res = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { display_name: name } }
      });
      if (res.error) {
        var m = res.error.message || "";
        var msg = /already registered|already been registered/i.test(m)
          ? "Esiste già un account con questa email: prova ad accedere."
          : m;
        return { ok: false, error: msg };
      }
      var profile = { email: email, name: name, provider: "password", ts: Date.now() };
      if (res.data && res.data.session) {
        // Conferma email disattivata sulla dashboard: si entra subito
        setAuthProfile(profile);
        recordEmail(profile);
        return { ok: true, profile: profile };
      }
      // Conferma email attiva: l'utente deve cliccare il link ricevuto
      recordEmail(profile);
      return { ok: true, needsConfirm: true };
    } catch (e) {
      return { ok: false, error: "Errore di rete durante la registrazione. Riprova." };
    }
  }

  /* Verifica dalla API pubblica di Supabase se il provider Google è abilitato */
  async function isGoogleConfigured() {
    try {
      var conf = getSupabaseConfig();
      if (!conf.supabaseUrl) return false;
      var r = await fetch(conf.supabaseUrl + "/auth/v1/settings", {
        headers: { apikey: conf.supabaseKey }
      });
      var j = await r.json();
      return !!(j && j.external && j.external.google);
    } catch (e) { return false; }
  }

  /* Login con Google: OAuth reale se configurato sulla dashboard Supabase,
     altrimenti accesso simulato (per i test locali) usando email+nome del form */
  async function signInWithGoogle(fallbackEmail, fallbackName) {
    var configured = sb ? await isGoogleConfigured() : false;

    if (configured) {
      try {
        var res = await sb.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.origin + location.pathname }
        });
        if (!res.error) return { ok: true, redirecting: true };
      } catch (e) {
        console.warn("[Birrozze] OAuth Google fallito, uso il mock:", e);
      }
    }

    // Mock trasparente: nessuna credenziale Google richiesta, serve solo l'email nel form
    var email = String(fallbackEmail || "").trim().toLowerCase();
    var name  = String(fallbackName || "").trim() || "Utente Google";
    if (!isValidEmail(email)) {
      return { ok: false, error: "Provider Google non configurato su Supabase: compila l'email qui sopra per l'accesso simulato di test." };
    }
    var profile = { email: email, name: name, provider: "google-mock", ts: Date.now() };
    setAuthProfile(profile);
    recordEmail(profile);
    return { ok: true, profile: profile, mocked: true };
  }

  /* Completa il rientro dal redirect OAuth (chiamata da login.html) */
  async function completeOAuthLogin() {
    if (!sb) return null;
    try {
      var res = await sb.auth.getSession();
      var session = res.data && res.data.session;
      if (session && session.user && session.user.email) {
        var u = session.user;
        var meta = u.user_metadata || {};
        var profile = {
          email: u.email.toLowerCase(),
          name: meta.full_name || meta.name || u.email.split("@")[0],
          provider: "google",
          ts: Date.now()
        };
        setAuthProfile(profile);
        recordEmail(profile);
        return profile;
      }
    } catch (e) {
      console.warn("[Birrozze] completeOAuthLogin:", e);
    }
    return null;
  }

  function logout() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    // Il logout chiude anche la sessione di gruppo e ne svuota la cache:
    // l'utente successivo su questo dispositivo non deve vedere i dati altrui
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setActiveGroupId(null);
    setActiveProfileId(null);
    if (sb && sb.auth) { try { sb.auth.signOut(); } catch (e) {} }
    location.href = "login.html";
  }

  /* Vero solo per l'amministratore configurato in config.js */
  function isAdmin() {
    var a = getAuthProfile();
    var adm = (window.BIRROZZE_CONFIG && window.BIRROZZE_CONFIG.adminEmail || "").toLowerCase().trim();
    return !!(a && adm && String(a.email).toLowerCase() === adm);
  }

  /* Scarica il registro email dal cloud come file locale chiamato "email".
     Riservato all'amministratore: gli altri membri non lo vedono. */
  async function downloadEmailsFile() {
    if (!isAdmin()) { toast("Solo l'amministratore può scaricare il registro email."); return; }
    if (!sb) { toast("Non connesso al database."); return; }
    var res = await sb.from("emails").select("*").order("created_at", { ascending: true });
    if (res.error) { toast("Errore nel recupero del registro email."); return; }
    var lines = (res.data || []).map(function (r) {
      return r.email + "\t" + (r.name || "") + "\t" + (r.provider || "") + "\t" + (r.last_login || "");
    });
    var content = "# Registro email Birrozze — esportato il " + new Date().toISOString() + "\n" +
                  "# email\tnome\tprovider\tultimo accesso\n" +
                  lines.join("\n") + "\n";
    var blob = new Blob([content], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "email";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast("Registro email scaricato (" + lines.length + " indirizzi).");
  }

  /* ---- Foto profilo ---- */

  /* Ritaglia al centro in un quadrato e comprime (per gli avatar) */
  function compressSquare(file, size, q, callback) {
    var reader = new FileReader();
    reader.onload = function (evt) {
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        var canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        callback(canvas.toDataURL("image/jpeg", q));
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  function getMyAvatar() {
    var myId = getActiveProfileId();
    var av = null;
    _state.crew.forEach(function (p) { if (p.id === myId && p.avatar) av = p.avatar; });
    return av;
  }

  /* Imposta la foto profilo: upload sul bucket se connessi,
     altrimenti data URL compresso salvato nello stato */
  function setMyAvatar(file, cb) {
    if (!file || !/^image\//.test(file.type)) { if (cb) cb(false); return; }
    promptForProfile(function () {
      var myId = getActiveProfileId();
      var me = null;
      _state.crew.forEach(function (p) { if (p.id === myId) me = p; });
      if (!me) { if (cb) cb(false); return; }

      compressSquare(file, 200, 0.72, async function (dataUrl) {
        var oldUrl = me.avatar || "";
        var finalUrl = dataUrl;

        if (sb) {
          try {
            var blob = dataURLtoBlob(dataUrl);
            // Nome file unico: niente policy UPDATE necessaria, niente cache stantia
            var path = "avatars/" + myId + "_" + Date.now() + ".jpg";
            var up = await sb.storage.from("birozze_photos")
              .upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" });
            if (!up.error) {
              var pub = sb.storage.from("birozze_photos").getPublicUrl(path);
              if (pub.data && pub.data.publicUrl) finalUrl = pub.data.publicUrl;
              // Pulizia best-effort del vecchio avatar su storage
              var marker = "/birozze_photos/";
              var idx = oldUrl.indexOf(marker);
              if (idx !== -1) {
                sb.storage.from("birozze_photos").remove([oldUrl.slice(idx + marker.length)]);
              }
            }
          } catch (e) {
            console.warn("[Birrozze] Upload avatar fallito, uso il fallback locale:", e);
          }
        }

        me.avatar = finalUrl;
        var ok = save();
        if (cb) cb(ok, finalUrl);
      });
    });
  }

  /* ---- Nome personalizzato del gruppo ---- */
  var GROUP_NAME_KEY = "birozze_active_group_name";

  function getActiveGroupName() {
    try { return localStorage.getItem(GROUP_NAME_KEY); } catch (e) { return null; }
  }

  async function updateGroupName(newName) {
    var gid = getActiveGroupId();
    newName = String(newName || "").trim();
    if (!gid || !sb || !newName) return false;
    var res = await sb.from("sessions").update({ name: newName, updated_at: new Date() }).eq("id", gid);
    if (res.error) {
      console.warn("[Birrozze] updateGroupName:", res.error);
      return false;
    }
    try { localStorage.setItem(GROUP_NAME_KEY, newName); } catch (e) {}
    return true;
  }

  function promptForProfile(callback) {
    // Sulla pagina di login il profilo non va mai richiesto
    var pageNow = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (pageNow === "login.html") {
      if (callback) callback();
      return;
    }

    var activeId = getActiveProfileId();
    if (activeId) {
      var found = _state.crew.some(function(p) { return p.id === activeId; });
      if (found) {
        if (callback) callback();
        return;
      }
    }

    /* Con il login attivo il nome arriva dal profilo: niente più prompt() */
    var auth = getAuthProfile();
    var name = null;

    if (auth && auth.name) {
      // Se nella crew c'è già qualcuno con lo stesso nome, è lui/lei
      var existing = null;
      _state.crew.forEach(function (p) {
        if (p.name.toLowerCase() === auth.name.toLowerCase()) existing = p;
      });
      if (existing) {
        setActiveProfileId(existing.id);
        if (callback) callback();
        return;
      }
      name = auth.name;
    } else {
      // Fallback legacy se per qualche motivo manca il profilo login
      name = prompt("Inserisci il tuo nome per unirti a questo gruppo condiviso:");
      if (name) name = name.trim();
    }

    if (!name) {
      if (callback) callback();
      return;
    }

    var newId = "user_" + uid();
    _state.crew.push({ id: newId, name: name, drinks: {}, is_active: true, avatar: null });
    setActiveProfileId(newId);
    save();

    toast("Benvenuto " + name + "! Il tuo profilo è attivo.");
    if (callback) callback();
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
        sb.from("proposal_votes").select("*").eq("session_id", sessionId),
        sb.from("drinking_votes").select("*").eq("session_id", sessionId),
        sb.from("rides").select("*").eq("session_id", sessionId).order("created_at", { ascending: true })
      ]);

      var sess = results[0].data;
      if (!sess) {
        // Se non esiste, la sessione viene inizializzata con lo stato locale
        await createSupabaseSession(sessionId);
        return;
      }

      // Memorizza il nome personalizzato del gruppo per navbar e modal
      if (sess.name) {
        try { localStorage.setItem(GROUP_NAME_KEY, sess.name); } catch (e) {}
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
      var drinkingVotesList = results[10].data || [];
      var ridesList = results[11].data || [];

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
        return { id: c.id, name: c.name, drinks: pDrinks, is_active: c.is_active, avatar: c.avatar_url || null };
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
          votesMap[v.voter_id] = v.candidate_id;
        });
        return { id: o.id, title: o.title, votes: votesMap };
      });

      // Proposals (nextOpts)
      newState.nextOpts = proposalsList.map(function(p) {
        var votersList = proposalVotesList.filter(function(v) { return v.proposal_id === p.id; }).map(function(v) { return v.voter_id; });
        return { id: p.id, label: p.label, votes: votersList.length, voters: votersList };
      });

      // Drinking Votes
      newState.drinkingVotes = drinkingVotesList.map(function(v) {
        return { voterId: v.voter_id, vote: v.vote };
      });

      // Passaggi in auto
      newState.rides = ridesList.map(function(r) {
        return {
          id: r.id,
          driverId: r.driver_id,
          seats: r.seats,
          direction: r.direction,
          note: r.note || "",
          passengersA: r.passengers_a || [],
          passengersR: r.passengers_r || []
        };
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
        await sb.from("crew").insert({ id: c.id, session_id: sessionId, name: c.name, is_active: c.is_active, avatar_url: c.avatar || null });
        
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
      }

      // Inserisci Proposals (nextOpts)
      for (var i = 0; i < _state.nextOpts.length; i++) {
        var p = _state.nextOpts[i];
        await sb.from("proposals").insert({ id: p.id, session_id: sessionId, label: p.label });
      }

      // Inserisci Passaggi
      var localRides = _state.rides || [];
      for (var i = 0; i < localRides.length; i++) {
        var r = localRides[i];
        await sb.from("rides").insert({
          id: r.id,
          session_id: sessionId,
          driver_id: r.driverId,
          seats: r.seats,
          direction: r.direction,
          note: r.note || "",
          passengers_a: r.passengersA || [],
          passengers_r: r.passengersR || []
        });
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
          await sb.from("crew").insert({ id: nc.id, session_id: sessionId, name: nc.name, is_active: nc.is_active, avatar_url: nc.avatar || null });
        } else if (oc.is_active !== nc.is_active || oc.name !== nc.name || oc.avatar !== nc.avatar) {
          await sb.from("crew").update({ name: nc.name, is_active: nc.is_active, avatar_url: nc.avatar || null }).eq("id", nc.id).eq("session_id", sessionId);
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
        
        // Cancella i voti rimossi
        for (var voterId in oldVotes) {
          if (!newVotes[voterId]) {
            await sb.from("oscar_votes").delete().eq("oscar_id", no.id).eq("voter_id", voterId).eq("session_id", sessionId);
          }
        }
        // Inserisci o aggiorna i voti
        for (var voterId in newVotes) {
          if (!oldVotes[voterId]) {
            await sb.from("oscar_votes").insert({
              session_id: sessionId,
              oscar_id: no.id,
              voter_id: voterId,
              candidate_id: newVotes[voterId]
            });
          } else if (oldVotes[voterId] !== newVotes[voterId]) {
            await sb.from("oscar_votes").update({
              candidate_id: newVotes[voterId]
            }).eq("oscar_id", no.id).eq("voter_id", voterId).eq("session_id", sessionId);
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

      // 8. Drinking Votes (Stasera si beve?)
      var oldDV = oldState.drinkingVotes || [];
      var newDV = newState.drinkingVotes || [];
      // Deletes
      for (var i = 0; i < oldDV.length; i++) {
        if (!newDV.find(function(v) { return v.voterId === oldDV[i].voterId; })) {
          await sb.from("drinking_votes").delete().eq("voter_id", oldDV[i].voterId).eq("session_id", sessionId);
        }
      }
      // Inserts / Updates
      for (var j = 0; j < newDV.length; j++) {
        var nv = newDV[j];
        var ov = oldDV.find(function(v) { return v.voterId === nv.voterId; });
        if (!ov) {
          await sb.from("drinking_votes").insert({
            session_id: sessionId,
            voter_id: nv.voterId,
            vote: nv.vote
          });
        } else if (ov.vote !== nv.vote) {
          await sb.from("drinking_votes").update({
            vote: nv.vote
          }).eq("voter_id", nv.voterId).eq("session_id", sessionId);
        }
      }

      // 9. Passaggi in auto (Organizza Passaggi)
      var oldRides = oldState.rides || [];
      var newRides = newState.rides || [];
      var sameList = function(a, b) {
        return JSON.stringify(a || []) === JSON.stringify(b || []);
      };
      // Deletes
      for (var i = 0; i < oldRides.length; i++) {
        if (!newRides.find(function(r) { return r.id === oldRides[i].id; })) {
          await sb.from("rides").delete().eq("id", oldRides[i].id).eq("session_id", sessionId);
        }
      }
      // Inserts / Updates
      for (var j = 0; j < newRides.length; j++) {
        var nr = newRides[j];
        var or_ = oldRides.find(function(r) { return r.id === nr.id; });
        if (!or_) {
          await sb.from("rides").insert({
            id: nr.id,
            session_id: sessionId,
            driver_id: nr.driverId,
            seats: nr.seats,
            direction: nr.direction,
            note: nr.note || "",
            passengers_a: nr.passengersA || [],
            passengers_r: nr.passengersR || []
          });
        } else if (
          or_.seats !== nr.seats ||
          or_.direction !== nr.direction ||
          (or_.note || "") !== (nr.note || "") ||
          !sameList(or_.passengersA, nr.passengersA) ||
          !sameList(or_.passengersR, nr.passengersR)
        ) {
          await sb.from("rides").update({
            seats: nr.seats,
            direction: nr.direction,
            note: nr.note || "",
            passengers_a: nr.passengersA || [],
            passengers_r: nr.passengersR || []
          }).eq("id", nr.id).eq("session_id", sessionId);
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
          loadFromSupabase(joinCode).then(function() {
            promptForProfile();
          });
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
        // Mostra il nome personalizzato del gruppo; il codice resta nel title
        pill.querySelector(".label").textContent = getActiveGroupName() || gid;
        pill.title = "Codice gruppo: " + gid;
      } else {
        pill.className = "nav-group-pill offline";
        pill.querySelector(".label").textContent = "Locale";
        pill.title = "";
      }
    };
    updatePill();

    // Riallinea la pillola quando lo stato viene aggiornato dal cloud
    window.addEventListener("birrozzeStateChange", updatePill);

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
              '<p style="font-size:14px;color:var(--text-body);margin-bottom:10px;">Sei connesso al gruppo condiviso in tempo reale.</p>' +
              '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-soft);">Nome del gruppo</label>' +
              '<div style="display:flex;gap:8px;margin:5px 0 12px;">' +
                '<input type="text" id="groupNameInput" maxlength="40" placeholder="Es. Vacanza Ibiza 2026" style="flex:1;padding:9px 12px;font-size:14px;">' +
                '<button class="btn btn-primary" id="saveGroupNameBtn" style="padding:9px 16px;font-size:13px;">Salva</button>' +
              '</div>' +
              '<div style="text-align:center;background:var(--butter);padding:10px 14px;border-radius:var(--r);margin-bottom:12px;">' +
                '<span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-soft);">Codice invito</span><br>' +
                '<span style="font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--amber-dark);letter-spacing:0.05em;" id="modalGroupCode">---</span>' +
              '</div>' +
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
            '<div style="border-top:1px dashed var(--border);margin-top:14px;padding-top:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
              '<span id="modalUserInfo" style="font-size:12px;color:var(--text-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>' +
              '<button class="btn btn-ghost" id="logoutBtn" style="flex-shrink:0;font-size:12.5px;padding:7px 14px;">Esci</button>' +
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
        document.getElementById("groupNameInput").value = getActiveGroupName() || ("Gruppo " + gid);
      } else {
        document.getElementById("groupActiveInfo").style.display = "none";
        document.getElementById("groupInactiveInfo").style.display = "block";
      }

      var auth = getAuthProfile();
      document.getElementById("modalUserInfo").textContent =
        auth ? (auth.name + " · " + auth.email) : "";

      overlay.classList.add("open");
    });

    // Salva il nome personalizzato del gruppo
    document.getElementById("saveGroupNameBtn").addEventListener("click", async function() {
      var input = document.getElementById("groupNameInput");
      var newName = input.value.trim();
      if (!newName) { toast("Il nome del gruppo non può essere vuoto."); return; }
      var btn = this;
      btn.disabled = true;
      var ok = await updateGroupName(newName);
      btn.disabled = false;
      if (ok) {
        updatePill();
        toast("Nome del gruppo aggiornato!");
      } else {
        toast("Impossibile aggiornare il nome (offline?).");
      }
    });


    // Logout profilo
    document.getElementById("logoutBtn").addEventListener("click", function() {
      if (confirm("Uscire dal profilo? Tornerai alla pagina di accesso.")) logout();
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
      loadFromSupabase(code).then(function() {
        promptForProfile();
      });
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
      promptForProfile();
      
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
        // Svuota la cache locale del gruppo abbandonato: senza questo
        // foto, perle e membri del vecchio gruppo restano visibili
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        setActiveProfileId(null);
        _state = deepClone(DEFAULT_STATE);
        _lastSyncedState = deepClone(DEFAULT_STATE);
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

    // Sblocca le callback in attesa del client (login, registro email...)
    _cloudReady = true;
    _cloudReadyCbs.splice(0).forEach(function (cb) { try { cb(); } catch (e) {} });

    var gid = getActiveGroupId();
    if (sb && gid) {
      loadFromSupabase(gid).then(function() {
        promptForProfile();
      });
      subscribeRealtime(gid);
    }
  });

  // Intercetta link di invito all'avvio
  checkUrlInvite();

  // Inietta widget navbar a caricamento completato
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      injectGroupWidget();
      initNavbarUser();
    });
  } else {
    injectGroupWidget();
    initNavbarUser();
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
    _state.rides = (_state.rides || []).filter(function (r) { return r.driverId !== id; });
    _state.rides.forEach(function (r) {
      r.passengersA = (r.passengersA || []).filter(function (pid) { return pid !== id; });
      r.passengersR = (r.passengersR || []).filter(function (pid) { return pid !== id; });
    });
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

  /* ---- Navbar: inizializza il widget avatar + dropdown logout ---- */
  function initNavbarUser() {
    var prof = getAuthProfile();
    if (!prof) return;

    /* Setta avatar (testo iniziale o foto) su un contenitore generico */
    function applyAvatar(initialEl, imgEl, name, avatarUrl) {
      if (avatarUrl) {
        imgEl.src = avatarUrl;
        imgEl.style.display = "block";
        if (initialEl) initialEl.style.display = "none";
      } else {
        if (initialEl) initialEl.textContent = (name || "?").charAt(0).toUpperCase();
        imgEl.style.display = "none";
      }
    }

    /* Pulsante avatar in navbar */
    var btnInitial = document.getElementById("navAvatarInitial");
    var btnImg     = document.getElementById("navAvatarImg");
    if (btnInitial && btnImg) {
      /* Usa prima l'avatar dalla crew locale, poi quello del profilo auth */
      var myId = getActiveProfileId();
      var avatarUrl = null;
      if (myId) {
        _state.crew.forEach(function (p) { if (p.id === myId && p.avatar) avatarUrl = p.avatar; });
      }
      if (!avatarUrl) avatarUrl = prof.avatarUrl || null;
      applyAvatar(btnInitial, btnImg, prof.name, avatarUrl);
    }

    /* Dropdown header */
    var ddInitial = document.getElementById("navDdInitial");
    var ddImg     = document.getElementById("navDdImg");
    var ddName    = document.getElementById("navDdName");
    var ddEmail   = document.getElementById("navDdEmail");
    if (ddName)  ddName.textContent  = prof.name  || "Utente";
    if (ddEmail) ddEmail.textContent = prof.email || "";
    if (ddInitial && ddImg) applyAvatar(ddInitial, ddImg, prof.name, prof.avatarUrl || null);

    /* Toggle dropdown */
    var avatarBtn = document.getElementById("navAvatarBtn");
    var dropdown  = document.getElementById("navDropdown");
    if (avatarBtn && dropdown) {
      avatarBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = dropdown.classList.toggle("open");
        avatarBtn.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", function () {
        dropdown.classList.remove("open");
        avatarBtn.setAttribute("aria-expanded", "false");
      });
      dropdown.addEventListener("click", function (e) { e.stopPropagation(); });
    }

    /* Cambio avatar dalla navbar */
    var fileInput = document.getElementById("navAvatarFileInput");
    var changeBtn = document.getElementById("navChangeAvatarBtn");
    if (changeBtn && fileInput) {
      changeBtn.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        setMyAvatar(file, function (ok, url) {
          if (ok && url) {
            if (btnInitial && btnImg) applyAvatar(btnInitial, btnImg, prof.name, url);
            if (ddInitial  && ddImg)  applyAvatar(ddInitial,  ddImg,  prof.name, url);
            toast("Foto profilo aggiornata!");
          } else {
            toast("Errore nell\'upload foto. Riprova.");
          }
          if (dropdown) dropdown.classList.remove("open");
        });
      });
    }

    /* Logout */
    var logoutBtn = document.getElementById("navLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        logout();
      });
    }
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
    initNavbarUser:       initNavbarUser,
    compressImageFile:    compressImageFile,
    getActiveProfileId:   getActiveProfileId,
    setActiveProfileId:   setActiveProfileId,
    promptForProfile:     promptForProfile,
    /* Avatar */
    setMyAvatar:          setMyAvatar,
    getMyAvatar:          getMyAvatar,
    /* Autenticazione e gruppi */
    isConnected:          isConnected,
    getAuthProfile:       getAuthProfile,
    _setAuthProfile:      setAuthProfile,
    signInWithEmail:      signInWithEmail,
    signInWithPassword:   signInWithPassword,
    signUpWithPassword:   signUpWithPassword,
    signInWithGoogle:     signInWithGoogle,
    completeOAuthLogin:   completeOAuthLogin,
    logout:               logout,
    whenCloudReady:       whenCloudReady,
    getActiveGroupName:   getActiveGroupName,
    updateGroupName:      updateGroupName,
    downloadEmailsFile:   downloadEmailsFile
  };

})(window);
