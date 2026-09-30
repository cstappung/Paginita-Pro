/* Clue: la conexión en línea, dentro del iframe de la sala.

   Habla con `colabtex/src/juegos/clue.js` (el cartero, en la página de
   Juegos) por `postMessage`, y hacia la pantalla ofrece el mismo
   contrato que la mesa de práctica (ver la cabecera de `mesa.js`).

   - **De la sala hacia aquí**: `config` una vez (quién soy, los
     jugadores con su promesa `hmazo`, la semilla de la sala, mi secreto
     `{sem, sal}` y el elenco con fotos) y `jugadas` en cada cambio, el
     registro entero y ya con las expulsiones reescritas como abandonos.
   - **De aquí hacia la sala**: `jugar` con una jugada sin `uid`; la sala
     la firma y la escribe con `ctx.jugar`.

   Lo que la pantalla no ve pasa aquí solo: mezclar, revolver y quitar
   en el reparto, abrir el sobre cuando acusa otro, dar el veredicto de
   la acusación propia, decir «no tengo» cuando no se tiene nada, y al
   final revelar la semilla para que todos puedan auditar. Cada paso se
   manda una vez por estado; si la escritura se pierde, el mismo estado
   lo vuelve a pedir pasado `REINTENTO`. */
(function (raiz) {
  "use strict";
  const M = raiz.ClueMotor;
  const PADRE = "clue-padre", HIJO = "clue-hijo";
  const REINTENTO = 6000;

  function conectar() {
    return new Promise((resolver, rechazar) => {
      if (!raiz.parent || raiz.parent === raiz) { rechazar(new Error("Esta partida se abre desde la sala de Juegos.")); return; }
      let conexion = null, cfg = null, jugadas = [];
      const oyentes = new Set();
      let est = null, ll = null, vistas = {}, mano = null, sobre = null, problemas = null, aviso = "";
      const enviados = new Map();                  // clave de paso automático → hora
      let semillaRevelada = false, auditada = "";

      const manda = (tipo, datos) => raiz.parent.postMessage(Object.assign({ canal: HIJO, tipo }, datos || {}), location.origin);
      const jugar = j => { manda("jugar", { j }); return Promise.resolve(true); };
      const una = (clave, f) => {
        const t = enviados.get(clave);
        if (t && Date.now() - t < REINTENTO) return;
        enviados.set(clave, Date.now());
        try { f(); } catch (e) { console.error("[clue] paso automático", clave, e); }
      };

      function opr() {
        return { semilla: cfg.semilla, cripto: true, elenco: (conexion.elenco || []).map(e => e.id) };
      }
      const yo = () => cfg.yo;
      const soyJugador = () => !cfg.mirando && !!ll;
      const pedidas = s => [M.cartaS(s.s), M.cartaA(s.a), M.cartaL(s.l)];

      function privado() {
        return {
          mano: mano ? mano.slice() : null,
          vistas: Object.assign({}, vistas),
          sobre: sobre ? sobre.slice() : (est && est.solucion ? [M.cartaS(est.solucion[0]), M.cartaA(est.solucion[1]), M.cartaL(est.solucion[2])] : null),
          problemas: problemas ? problemas.slice() : null,
          aviso
        };
      }
      function avisa() {
        const v = { est, priv: privado() };
        oyentes.forEach(cb => { try { cb(v); } catch (e) { console.error(e); } });
      }

      /* Todo lo que se deduce del registro y de mi secreto. */
      function recalcula() {
        est = M.reducir(jugadas, cfg.jugadores, opr());
        aviso = "";
        const cr = est.cr, mesa = cr.mesa, i = mesa.indexOf(yo());
        if (soyJugador() && cr.etapa === "listo" && i >= 0 && !mano) {
          mano = M.mano(cr.quitada, ll, M.posicionesDe(i, mesa.length));
          if (mano.some(c => c < 0)) aviso = "Alguna de tus cartas no se pudo abrir: alguien repartió mal. Al final la auditoría dirá quién.";
        }
        /* Lo que me enseñaron a mí, cada sobre con su clave. */
        if (soyJugador()) {
          for (const s of est.sugerencias) {
            if (s.uid !== yo() || !s.mostro || vistas[s.k] !== undefined || typeof s.x !== "string") continue;
            const c = M.abreSobre(M.compartida(ll, cr.pk[s.mostro]), s.k, s.x);
            vistas[s.k] = c;
          }
        }
        if (est.fase === "reparto") {
          const quien = (est.jugadores.find(j => j.uid === est.debe[0]) || {}).nombre || "alguien";
          aviso = "Barajando con criptografía: " + ({ mezcla: "mezcla", revuelve: "revuelve", quita: "reparte" }[cr.etapa] || cr.etapa) + " " + quien + ".";
        }
        automaticos();
        auditaSiSePuede();
        avisa();
      }

      function automaticos() {
        if (!soyJugador()) return;
        const cr = est.cr, mesa = cr.mesa, u = yo();
        /* Al acabar, la semilla: sin ella nadie puede auditar la mesa. */
        if (est.fase === "fin") {
          if (!est.semillas[u] && !semillaRevelada) una("s", () => { semillaRevelada = true; jugar({ t: "s", sem: cfg.sec.sem, sal: cfg.sec.sal }); });
          return;
        }
        if (!est.debe.includes(u)) return;
        if (est.fase === "reparto") {
          const clave = "r:" + cr.etapa + ":" + cr.orden;
          if (cr.etapa === "mezcla") una(clave, () => jugar({ t: "mezcla", c: M.mezcla(cr.mezcla || M.mazoInicial(), ll), pk: ll.pk }));
          else if (cr.etapa === "revuelve") una(clave, () => jugar({ t: "revuelve", c: M.revuelve(cr.revuelta, ll) }));
          else if (cr.etapa === "quita") una(clave, () => jugar({ t: "quita", c: M.quita(cr.quitada, ll, M.posicionesDe(mesa.indexOf(u), mesa.length)) }));
          return;
        }
        if (est.paso === "refuta" && est.sug && est.sug.espera === u && mano) {
          if (!mano.some(c => pedidas(est.sug).includes(c))) una("p:" + est.sug.k, () => jugar({ t: "paso" }));
          return;
        }
        if (est.paso === "abre" && est.acu && est.acu.faltan[0] === u) {
          una("a:" + est.acu.k, () => jugar({ t: "abre", c: M.abre(cr.abre, ll) }));
          return;
        }
        if (est.paso === "veredicto" && est.acu && est.acu.uid === u) {
          una("v:" + est.acu.k, () => {
            /* Quien se fue revelando su semilla no abrió su candado: lo
               quito yo con su llave, que ya es pública. */
            let abierto = cr.abre;
            for (const v of mesa) {
              if (v === u || !est.fuera[v] || est.acu.abiertos.includes(v) || !est.semillas[v]) continue;
              abierto = M.abre(abierto, M.llaves(est.semillas[v].sem, est.semillas[v].sal));
            }
            const s = M.sobreAbierto(abierto, ll);
            const a = est.acu;
            const ok = s[0] === M.cartaS(a.s) && s[1] === M.cartaA(a.a) && s[2] === M.cartaL(a.l);
            if (s.some(c => c < 0)) console.warn("[clue] el sobre no se dejó abrir: alguien quitó mal su candado");
            if (!ok) sobre = s.every(c => c >= 0) ? s : null;   // ya lo sé: lo miré
            jugar({ t: "veredicto", ok });
            /* Quien acierta enseña su semilla en el acto: así todos
               comprueban ya que el sobre era ese. */
            if (ok) { semillaRevelada = true; jugar({ t: "s", sem: cfg.sec.sem, sal: cfg.sec.sal }); }
          });
        }
      }

      /* Con todas las semillas, la mesa entera se rehace y se señala a
         quien mintió. Se hace una vez por cada conjunto de semillas. */
      function auditaSiSePuede() {
        if (est.fase !== "fin") return;
        const firma = Object.keys(est.semillas).sort().join(",");
        if (firma === auditada) return;
        auditada = firma;
        try {
          const a = M.auditar(jugadas, cfg.jugadores, opr());
          problemas = a.problemas;
          if (a.sobre && a.sobre.every(c => c >= 0)) sobre = a.sobre;
        } catch (e) { console.error("[clue] auditoría", e); }
      }

      function mensaje(e) {
        if (e.source !== raiz.parent || e.origin !== location.origin || !e.data || e.data.canal !== PADRE) return;
        const d = e.data;
        if (d.tipo === "config" && !cfg) {
          cfg = {
            yo: String(d.yo || ""), mirando: !!d.mirando, semilla: d.semilla >>> 0,
            jugadores: (d.jugadores || []).map(j => ({ uid: j.uid, nombre: j.nombre, hmazo: j.hmazo || "" })),
            sec: d.sec && Number.isFinite(Number(d.sec.sem)) && typeof d.sec.sal === "string" ? { sem: Number(d.sec.sem), sal: d.sec.sal } : null
          };
          if (cfg.sec) {
            const f = cfg.jugadores.find(j => j.uid === cfg.yo);
            /* Si mi semilla no cumple mi promesa, todo lo que cifre saldría
               como trampa en la auditoría: mejor no jugar con ella. */
            if (f && f.hmazo && M.compromiso(cfg.sec.sem, cfg.sec.sal) !== f.hmazo) console.warn("[clue] mi semilla no cumple la promesa de la ficha");
            ll = M.llaves(cfg.sec.sem, cfg.sec.sal);
          }
          const elenco = Array.isArray(d.elenco) && d.elenco.length >= M.NS ? d.elenco.filter(x => x && M.idValido(x.id)) : null;
          if (elenco) { try { localStorage.setItem("clue.elenco", JSON.stringify(elenco)); } catch (err) { /* sin almacenamiento */ } }
          conexion = {
            modo: "online", yo: cfg.yo, mirando: cfg.mirando || !ll, semilla: cfg.semilla,
            jugadores: cfg.jugadores.map(j => ({ uid: j.uid, nombre: j.nombre })),
            elenco: elenco || M.SOSPECHOSOS.slice(),
            suscribir(cb) { oyentes.add(cb); if (est) cb({ est, priv: privado() }); return () => oyentes.delete(cb); },
            jugar(j) {
              if (!j || typeof j !== "object" || conexion.mirando) return Promise.resolve(false);
              const t = j.t;
              if (!["elige", "suelta", "mueve", "sugiere", "acusa", "pasa"].includes(t)) return Promise.resolve(false);
              return jugar(j);
            },
            refutar(c) {
              if (!est || est.paso !== "refuta" || !est.sug || est.sug.espera !== cfg.yo || !mano) return Promise.resolve(false);
              const puede = mano.filter(x => pedidas(est.sug).includes(x));
              if (!puede.length) return jugar({ t: "paso" });
              if (!puede.includes(c)) return Promise.resolve(false);
              const clave = M.compartida(ll, est.cr.pk[est.sug.uid]);
              return jugar({ t: "muestra", x: M.cierraSobre(clave, est.sug.k, c) });
            },
            destruir() { raiz.removeEventListener("message", mensaje); oyentes.clear(); }
          };
          resolver(conexion);
          if (jugadas.length) recalcula();
          return;
        }
        if (d.tipo === "jugadas" && Array.isArray(d.lista)) {
          jugadas = d.lista;
          if (cfg) recalcula();
        }
      }
      raiz.addEventListener("message", mensaje);
      manda("listo");
    });
  }

  raiz.ClueRed = { conectar };
})(typeof globalThis !== "undefined" ? globalThis : this);
