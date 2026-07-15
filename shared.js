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
    crew: [
      { id: "gabbo",  name: "Gabbo",  drinks: { jack: 3, absolut: 1 }, is_active: true  },
      { id: "teo",    name: "Teo",    drinks: { absolut: 4, malibu: 1 }, is_active: true },
      { id: "vale",   name: "Vale",   drinks: { hendricks: 2 },         is_active: true  },
      { id: "sara",   name: "Sara",   drinks: { baileys: 2, campari: 1 }, is_active: true },
      { id: "marco",  name: "Marco",  drinks: { jack: 1 },              is_active: true  }
    ],
    expenses: [
      {
        id: "exp_init_1",
        desc: "Spesa supermercato (cibo e bevande)",
        amount: 45.50,
        paidBy: "gabbo",
        splitAmong: ["gabbo", "teo", "vale", "sara", "marco"]
      },
      {
        id: "exp_init_2",
        desc: "Taxi per il club della serata",
        amount: 25.00,
        paidBy: "teo",
        splitAmong: ["gabbo", "teo", "vale", "sara", "marco"]
      }
    ],
    photos: [
      {
        id: "ph1",
        url: "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=600&q=80",
        caption: "Primo aperitivo in spiaggia al tramonto!",
        author: "Gabbo",
        rot: -2.2
      },
      {
        id: "ph2",
        url: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80",
        caption: "Il brindisi di inizio vacanza studio!",
        author: "Vale",
        rot: 1.8
      },
      {
        id: "ph3",
        url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80",
        caption: "La camminata finita in risate",
        author: "Sara",
        rot: -1.2
      }
    ],
    perle: [
      { id: "p1", text: "«Giuro che l'ultimo lo salto» — poi ne ordina altri tre.", author: "Teo",  c: "#FFF0EB", rot: -2   },
      { id: "p2", text: "Il navigatore diceva 200 metri. Abbiamo fatto 4 km a piedi.", author: "Sara", c: "#EDF7FC", rot: 2    },
      { id: "p3", text: "«Io non ballo», 10 secondi prima di salire sul cubo.",       author: "Vale", c: "#F0FBF2", rot: -1.5 }
    ],
    oscars: [
      { id: "o1", title: "Il più ritardatario",     votes: { gabbo: 3, teo: 1    } },
      { id: "o2", title: "Miglior ballerino",        votes: { vale: 5, sara: 2    } },
      { id: "o3", title: "Quello che si perde",      votes: { marco: 4            } },
      { id: "o4", title: "Re/Regina dell'aperitivo", votes: { gabbo: 2, teo: 3    } }
    ],
    nextOpts: [
      { id: "n1", label: "Aperitivo in spiaggia",   votes: 2 },
      { id: "n2", label: "Discoteca al Papeete",     votes: 4 },
      { id: "n3", label: "Serata karaoke",           votes: 1 },
      { id: "n4", label: "Falò sulla spiaggia",      votes: 3 },
      { id: "n5", label: "Cena di pesce",            votes: 0 }
    ],
    elapsed: 0,
    running: false,
    alcoholSplitMode: "uguale"
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

  /* ---- State Management ---- */
  var _state = deepClone(DEFAULT_STATE);

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        /* Merge conservativo: mantiene defaults per chiavi mancanti */
        _state = deepMerge(deepClone(DEFAULT_STATE), parsed);
      }
    } catch (e) {
      console.error("[BirrozzeState] Errore nel caricamento:", e);
      _state = deepClone(DEFAULT_STATE);
    }
    return _state;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.error("[BirrozzeState] Errore nel salvataggio:", e);
    }
  }

  function get() { return _state; }

  function update(patch) {
    deepMerge(_state, patch);
    save();
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    _state = deepClone(DEFAULT_STATE);
    save();
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

  /* ---- Public API ---- */
  global.BirrozzeState = {
    load:                 load,
    save:                 save,
    get:                  get,
    update:               update,
    reset:                reset,
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
