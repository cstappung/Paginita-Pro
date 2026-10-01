/* Clue: la mesa de práctica: tú contra bots, sin sala ni red.

   Habla el mismo idioma que la conexión en línea (`red.js`), así que la
   pantalla (`main.js`) no sabe con cuál juega. Ese contrato:

     conexion = {
       modo: "practica" | "online",
       yo, mirando,
       jugadores: [{uid, nombre, bot?}],        // en orden de asiento
       elenco: [{id, n, c?, d?, foto?}],         // entre quienes se elige
       suscribir(cb) → deja de escuchar          // cb({est, priv}) en cada cambio
       jugar(j) → Promise                         // una jugada mía, sin uid
       refutar(carta | null) → Promise            // responder a una sugerencia
       ocupado(bool)                              // "estoy animando": la sala no tapa el final
     }
     priv = {
       mano: [cartas] | null,                     // lo mío
       vistas: {[clave de la sugerencia]: carta}, // lo que me enseñaron a mí
       sobre: [s, a, l] | null,                   // cuando se sabe
       problemas: [{uid, que}] | null,            // la auditoría, en línea
       aviso: ""                                  // lo que está pasando por dentro
     }

   Aquí la mesa lo sabe todo (repartió ella), así que hace de árbitro:
   responde por los bots, dice «no tengo» por quien no tiene nada que
   enseñar, y da el veredicto de cada acusación. El registro y el
   reductor son los mismos que en la sala; solo cambia que `muestra.x`
   es la carta en claro en vez de un sobre cifrado. */
(function (raiz) {
  "use strict";
  const M = raiz.ClueMotor;

  function crearMesa(op) {
    op = op || {};
    const nBots = Math.max(1, Math.min(5, op.bots || 3));
    const elenco = (op.elenco && op.elenco.length >= M.NS ? op.elenco : M.SOSPECHOSOS).slice();
    const ritmo = op.ritmo || 1;
    const NOMBRES_BOT = ["Bot Sherlock", "Bot Poirot", "Bot Marple", "Bot Holmes", "Bot Colombo"];
    const jugadores = [{ uid: "yo", nombre: op.nombre || "Tú" }]
      .concat(Array.from({ length: nBots }, (_, i) => ({ uid: "bot" + (i + 1), nombre: NOMBRES_BOT[i], bot: true })));
    const semilla = (op.semilla >>> 0) || ((Math.random() * 4294967296) >>> 0);
    const opr = { semilla, cripto: false, elenco: elenco.map(e => e.id) };
    const r = M.rng(semilla ^ 0x9e3779b9);

    /* El reparto de verdad: el sobre, uno de cada tipo, y el resto a la
       redonda empezando por el asiento 0 (el mismo orden que en línea). */
    const sobre = [Math.floor(r() * M.NS), M.NS + Math.floor(r() * M.NA), M.NS + M.NA + Math.floor(r() * M.NL)];
    const resto = M.baraja(M.NC, r).filter(c => !sobre.includes(c));
    const manos = {};
    jugadores.forEach(j => { manos[j.uid] = []; });
    resto.forEach((c, i) => manos[jugadores[i % jugadores.length].uid].push(c));

    const log = [];
    const vistas = {};                              // uid → {clave: carta}
    jugadores.forEach(j => { vistas[j.uid] = {}; });
    const bots = {};
    const fabrica = raiz.ClueBots && raiz.ClueBots.crear;
    for (const j of jugadores) if (j.bot) {
      bots[j.uid] = fabrica
        ? fabrica({ uid: j.uid, mano: manos[j.uid].slice(), jugadores: jugadores.map(x => x.uid) })
        : botTonto(j.uid, manos[j.uid]);
    }
    const oyentes = new Set();
    let est = M.reducir(log, jugadores, opr);
    let reloj = null, muerto = false;

    function escribe(uid, j) {
      log.push(Object.assign({ k: String(log.length).padStart(4, "0"), uid }, j));
      const antes = est;
      est = M.reducir(log, jugadores, opr);
      /* Lo que se enseñó llega solo a quien sugirió. */
      const s = est.sug;
      if (s && s.mostro && Number.isInteger(s.x) && (!antes.sug || antes.sug.mostro !== s.mostro || antes.sug.k !== s.k)) {
        vistas[s.uid][s.k] = s.x;
      }
      avisa();
      programa();
    }
    function priv() {
      return {
        mano: manos.yo.slice(),
        vistas: Object.assign({}, vistas.yo),
        /* Al final lo ve todo el mundo; antes, solo quien acusó mal
           (como en el juego de mesa: lo mira en secreto y queda fuera). */
        sobre: est.fase === "fin" || est.eliminados.yo ? sobre.slice() : null,
        problemas: null,
        aviso: ""
      };
    }
    function avisa() {
      const v = { est, priv: priv() };
      oyentes.forEach(cb => { try { cb(v); } catch (e) { console.error(e); } });
    }

    const pedidas = s => [M.cartaS(s.s), M.cartaA(s.a), M.cartaL(s.l)];
    const tieneAlgo = (u, s) => manos[u].some(c => pedidas(s).includes(c));

    /* Lo que la mesa hace sola: responder por quien no tiene nada, dar
       veredictos, y los turnos de los bots. Siempre de a una jugada y
       con una pausa, para que se pueda seguir lo que pasa. */
    function programa() {
      clearTimeout(reloj);
      if (muerto || est.fase === "fin") return;
      const t = (ms) => ms / ritmo;
      if (est.fase === "elige") {
        if (!est.eleccion.yo) return;               // tú eliges primero
        const bot = jugadores.find(j => j.bot && !est.eleccion[j.uid]);
        if (!bot) return;
        reloj = setTimeout(() => {
          const libres = elenco.map(e => e.id).filter(id => !Object.values(est.eleccion).includes(id));
          escribe(bot.uid, { t: "elige", r: libres[Math.floor(Math.random() * libres.length)] });
        }, t(350));
        return;
      }
      const u = est.debe[0];
      if (!u) return;
      if (est.paso === "refuta") {
        if (!tieneAlgo(u, est.sug)) { reloj = setTimeout(() => escribe(u, { t: "paso" }), t(u === "yo" ? 500 : 650)); return; }
        if (u === "yo") return;                     // te toca elegir qué enseñar
        reloj = setTimeout(() => {
          const b = bots[u];
          let c = b.refuta ? b.refuta(est.sug, est) : null;
          if (!pedidas(est.sug).includes(c) || !manos[u].includes(c)) c = manos[u].find(x => pedidas(est.sug).includes(x));
          escribe(u, { t: "muestra", x: c });
        }, t(900));
        return;
      }
      if (est.paso === "veredicto") {
        const a = est.acu;
        const ok = sobre[0] === M.cartaS(a.s) && sobre[1] === M.cartaA(a.a) && sobre[2] === M.cartaL(a.l);
        reloj = setTimeout(() => escribe(a.uid, { t: "veredicto", ok }), t(1400));
        return;
      }
      if (!bots[u]) return;                         // tu turno
      reloj = setTimeout(() => {
        const b = bots[u];
        let j = null;
        try {
          if (b.observa) b.observa(est, Object.assign({}, vistas[u]));
          j = b.decide(est, Object.assign({}, vistas[u]));
        } catch (e) { console.error("[clue] bot", u, e); }
        const antes = est.aceptadas;
        if (j) escribe(u, j);
        /* Una jugada que el reductor no acepta no existe: que el bot
           pase antes que dejar la mesa parada. */
        if (est.aceptadas === antes && est.turno === u && est.paso !== "refuta" && est.paso !== "veredicto") {
          console.warn("[clue] jugada del bot ignorada", u, j);
          escribe(u, { t: "pasa" });
        }
      }, t(est.paso === "inicio" ? 900 : 1100));
    }

    const conexion = {
      modo: "practica", yo: "yo", mirando: false, jugadores, elenco, semilla,
      suscribir(cb) { oyentes.add(cb); cb({ est, priv: priv() }); return () => oyentes.delete(cb); },
      jugar(j) {
        if (!j || typeof j !== "object" || !est.debe.includes("yo") && !(est.fase === "elige" && (j.t === "elige" || j.t === "suelta"))) return Promise.resolve(false);
        escribe("yo", j);
        return Promise.resolve(true);
      },
      refutar(c) {
        if (est.paso !== "refuta" || est.sug.espera !== "yo") return Promise.resolve(false);
        const puede = manos.yo.filter(x => pedidas(est.sug).includes(x));
        if (!puede.length) { escribe("yo", { t: "paso" }); return Promise.resolve(true); }
        if (!puede.includes(c)) return Promise.resolve(false);
        escribe("yo", { t: "muestra", x: c });
        return Promise.resolve(true);
      },
      /* Solo para pruebas y para el botón «rendirse»: la mesa entera. */
      depura: () => ({ sobre: sobre.slice(), manos, log }),
      ocupado() {},
      destruir() { muerto = true; clearTimeout(reloj); oyentes.clear(); }
    };
    setTimeout(programa, 0);
    return conexion;
  }

  /* Por si `bots.js` no está: mueve al azar, sugiere al azar y nunca
     acusa. Sirve para que la mesa no se quede parada. */
  function botTonto(uid, mano) {
    return {
      decide(est) {
        const f = est.jugadores.findIndex(j => j.uid === uid);
        if (est.puedeSugerir) return { t: "sugiere", s: Math.floor(Math.random() * M.NS), a: Math.floor(Math.random() * M.NA) };
        if (est.paso === "inicio" && est.dados) {
          const al = M.alcance(est.fichas, f, est.dados[0] + est.dados[1]);
          const salas = [...al.salas.keys()];
          if (salas.length) return { t: "mueve", a: M.SALA + salas[Math.floor(Math.random() * salas.length)], v: "dado" };
          const cs = [...al.casillas.keys()];
          if (cs.length) return { t: "mueve", a: cs[Math.floor(Math.random() * cs.length)], v: "dado" };
        }
        return { t: "pasa" };
      },
      refuta(sug) { return mano.find(c => [M.cartaS(sug.s), M.cartaA(sug.a), M.cartaL(sug.l)].includes(c)); }
    };
  }

  raiz.ClueMesa = { crearMesa };
})(typeof globalThis !== "undefined" ? globalThis : this);
