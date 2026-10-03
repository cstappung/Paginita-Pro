/*
 * Frontera Batalla — la Torre, el Palacio y la Fábrica de Pokémon
 * Esmeralda, contra la IA y en este navegador.
 *
 * El combate es el de las salas (`pokemon.js` en modo `local`), y lo
 * decide `pokemon/frontera-motor.js`: quién te espera en el combate n,
 * con qué equipo y con cuánta cabeza. Esta pantalla solo lleva la racha:
 * el menú de instalaciones, la elección de los tres Pokémon, el rival que
 * viene, el resultado y la clasificación.
 *
 * Lo que se guarda es la receta, no el combate: la semilla de la racha,
 * el número de combate, los tres sets y las elecciones del combate en
 * curso. Repetir esas elecciones sobre la misma semilla da el mismo
 * combate (`nuevaPelea` es determinista), así que recargar la página no
 * vuelve a tirar los dados: sigue exactamente donde estaba.
 *
 * `crearFrontera({usuario, guardar, watch, partida, alResultado, volver})`
 *   guardar(categoria, uid, dato)  → la tabla del club (con podio)
 *   watch(categoria, cb)           → las filas de esa tabla
 *   partida = {leer(), guardar(d, at)}  → `users/<uid>/club/frontera`
 *   alResultado([{d, previa}])     → días, partidas del club y logros
 */
import { cargaMotor, motorListo } from "./pokemon/carga.js";
import { crearPokemon } from "./pokemon.js";
import { misEquipos, abreEquipos } from "./pokemon/equipos.js";
import { htmlRival, skinRival, htmlEntrenador } from "./pokemon/entrenadores.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLAVE = uid => "frontera." + uid;
const TOPE_MS = 604800000;          // el tope de `tiempo` en las reglas
const MAX_PELEA_MS = 3600000;       // un combate no suma más de una hora
const TEXTO = {
  torre: "Combates individuales con tus propios Pokémon. Siete por serie; el As te espera en los combates 35 y 70.",
  palacio: "Tus Pokémon luchan solos, según su naturaleza y la vida que les queda. Tú solo miras… y confías.",
  fabrica: "Alquilas seis Pokémon, eliges tres, y tras cada victoria puedes cambiar uno por uno del rival."
};
const ICONO = { torre: "🗼", palacio: "🏯", fabrica: "🏭" };

export function crearFrontera({ usuario, guardar, watch, partida, alResultado, volver }) {
  const uid = usuario.uid;
  let host = null, muerto = false, PM = null, F = null;
  let datos = { v: 1, runs: {}, mejor: {}, victorias: 0, tiempoTot: 0, at: 0 };
  let vista = "carga", sel = { inst: "torre", nivel: "50" };
  let equipos = null, skin = "red";
  let elegidos = [];                 // índices elegidos (equipo propio o alquiler)
  let equipoSel = "";                // id del equipo guardado elegido
  let pk = null, pelea = null, chequeo = 0, cerrado = false, inicioPelea = 0;
  let resultado = null;              // lo que muestra la pantalla de resultado
  let cambio = { mio: -1, suyo: -1 };
  let sinReglas = false;             // la clasificación rechazó una escritura
  let avisoFr = "";                  // un fallo que se explica en el menú
  const desuscribe = [];

  /* ---------- guardar y leer ---------- */
  const k = () => `${sel.inst}-${sel.nivel}`;
  const run = () => datos.runs[k()] || null;
  function leeLocal() { try { return JSON.parse(localStorage.getItem(CLAVE(uid)) || "null"); } catch (e) { return null; } }
  function persiste() {
    datos.at = Date.now();
    const s = JSON.stringify(datos);
    try { localStorage.setItem(CLAVE(uid), s); } catch (e) { /* sin almacenamiento: queda la nube */ }
    if (partida) partida.guardar(s, datos.at).catch(() => {});
  }
  function sano(d) {
    if (!d || typeof d !== "object" || d.v !== 1) return null;
    d.runs = d.runs && typeof d.runs === "object" ? d.runs : {};
    d.mejor = d.mejor && typeof d.mejor === "object" ? d.mejor : {};
    d.pend = d.pend && typeof d.pend === "object" ? d.pend : {};
    d.tMejor = d.tMejor && typeof d.tMejor === "object" ? d.tMejor : {};
    /* Cada racha se revisa una por una: una sola rota (de otra versión,
       de otro aparato a medio escribir) hacía fallar el menú entero, o el
       combate que se retoma solo al entrar, y la Frontera no se abría
       nunca más para esa cuenta. Lo que no se entiende se descarta. */
    const runs = {};
    for (const [kk, r] of Object.entries(d.runs)) { const b = runSano(r); if (b && kk === `${b.inst}-${b.nivel}`) runs[kk] = b; }
    d.runs = runs;
    for (const o of [d.mejor, d.tMejor]) for (const kk of Object.keys(o)) { const v = Math.floor(+o[kk]); if (Number.isFinite(v) && v > 0) o[kk] = v; else delete o[kk]; }
    d.victorias = Math.max(0, Math.floor(+d.victorias || 0));
    d.tiempoTot = Math.max(0, Math.floor(+d.tiempoTot || 0));
    return d;
  }
  function runSano(r) {
    if (!r || typeof r !== "object") return null;
    if (!F || !F.INSTALACIONES[r.inst] || !F.NIVELES[r.nivel]) return null;
    if (typeof r.semilla !== "string" || !r.semilla) return null;
    const n = Math.floor(+r.n);
    if (!Number.isFinite(n) || n < 1) return null;
    const setOk = x => x && typeof x === "object" && typeof x.species === "string" && x.species;
    const equipo = Array.isArray(r.equipo) && r.equipo.length === 3 && r.equipo.every(setOk) ? r.equipo : null;
    const ultimo = Array.isArray(r.ultimoRival) && r.ultimoRival.every(setOk) ? r.ultimoRival : null;
    const elecciones = Array.isArray(r.elecciones) && r.elecciones.every(c => typeof c === "string") ? r.elecciones : [];
    return Object.assign({}, r, { n, equipo, ultimoRival: ultimo, elecciones, enPelea: !!(r.enPelea && equipo),
      tiempo: Math.max(0, Math.floor(+r.tiempo || 0)) });
  }
  /* Una lectura que no vuelve (la conexión a medias) no puede dejar la
     Frontera en «Abriendo las puertas…» para siempre. */
  const conTope = (pr, ms) => new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error("tiempo agotado")), ms);
    Promise.resolve(pr).then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); mal(e); });
  });
  /* Una marca para la clasificación queda pendiente (`datos.pend`) hasta
     que la base la acepta. Antes se mandaba una sola vez y, si fallaba
     (reglas sin publicar, sin red), el récord ya figuraba en `mejor` y no
     volvía a subir nunca: el menú lo mostraba y la tabla no. */
  function sube(cat, dato) {
    datos.pend[cat] = dato;
    persiste();
    const nombre = String(usuario.name || "Jugador").slice(0, 80);
    return guardar(cat, uid, Object.assign({ nombre }, dato)).then(() => {
      if (datos.pend[cat] === dato) { delete datos.pend[cat]; persiste(); }
      if (sinReglas) { sinReglas = false; if (!muerto) pinta(); }
    }, err => {
      console.warn("[frontera] clasificación", cat, err);
      if (/permission/i.test(String(err && (err.code || err.message)))) { sinReglas = true; if (!muerto) pinta(); }
    });
  }
  async function carga() {
    let d = null;
    try { d = sano(leeLocal()); } catch (e) { d = null; }
    if (partida) {
      try {
        const r = await conTope(partida.leer(), 8000);
        let nube = null;
        try { nube = r && typeof r.d === "string" ? sano(JSON.parse(r.d)) : null; } catch (e) { nube = null; }
        if (nube && (!d || (nube.at || 0) > (d.at || 0))) d = nube;
        // Una racha terminada en otro aparato deja la lápida `d: null`.
        if (r && r.d === null && d && (r.at || 0) > (d.at || 0)) d = null;
      } catch (e) { /* sin red: lo local */ }
    }
    if (d) datos = d;
    // Lo que diga la clasificación también cuenta: nunca menos que ella.
    /* La primera lectura de cada tabla también repara: si aquí hay una
       marca mejor que la de la tabla, se vuelve a subir. */
    const revisado = new Set();
    const mira = (cat, f, local) => {
      let off = null;
      try { off = watch(cat, filas => {
        const yo = (filas || []).find(x => x.uid === uid);
        if (yo) f(yo);
        if (!revisado.has(cat)) {
          revisado.add(cat);
          const l = local();
          if (datos.pend[cat] && (!yo || datos.pend[cat].puntos > (yo.puntos || 0))) sube(cat, datos.pend[cat]);
          else if (l && (!yo || l.puntos > (yo.puntos || 0))) sube(cat, l);
          else if (datos.pend[cat]) { delete datos.pend[cat]; persiste(); }
        }
        if (!muerto) pinta();
      }); } catch (e) { console.warn("[frontera] clasificación", cat, e); }
      if (typeof off === "function") desuscribe.push(off);
    };
    mira("club-frontera-victorias", yo => { datos.victorias = Math.max(datos.victorias, yo.puntos || 0); },
      () => datos.victorias ? { puntos: datos.victorias, tiempo: Math.max(1, Math.min(TOPE_MS, datos.tiempoTot || TOPE_MS)), partida: `frv-${datos.victorias}-${uid.slice(0, 8)}` } : null);
    for (const i of Object.keys(F.INSTALACIONES)) for (const n of Object.keys(F.NIVELES)) {
      const kk = `${i}-${n}`;
      mira(`club-frontera-${kk}`, yo => { datos.mejor[kk] = Math.max(datos.mejor[kk] || 0, yo.puntos || 0); },
        () => datos.mejor[kk] ? { puntos: datos.mejor[kk], tiempo: Math.max(1, Math.min(TOPE_MS, datos.tMejor[kk] || TOPE_MS)), partida: `fr-${kk}-${datos.mejor[kk]}-${uid.slice(0, 8)}` } : null);
    }
  }

  /* ---------- montar ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `<div class="jg-fr" id="frRaiz"><div class="jg-pk-aviso">Abriendo las puertas de la Frontera…</div></div>`;
    host.addEventListener("click", alClic);
    cargaMotor().then(async m => {
      PM = m; F = m.frontera;
      try { await carga(); } catch (e) { console.warn("[frontera] carga", e); }
      try { const e = await misEquipos(uid); equipos = e.equipos || {}; skin = e.skin || "red"; } catch (e) { equipos = {}; }
      if (muerto) return;
      vista = "menu";
      // Un combate a medias se retoma solo… salvo que no se pueda.
      const r = Object.values(datos.runs).find(x => x && x.enPelea);
      if (r) { sel = { inst: r.inst, nivel: r.nivel }; empiezaPelea(); return; }
      pinta();
    }).catch(e => {
      console.warn("[frontera]", e);
      if (host && !muerto) host.innerHTML = `<div class="jg-fr" id="frRaiz"><div class="jg-pk-aviso">No se pudo abrir la Frontera: ${esc(e && e.message || e)}<button class="btn" data-x="reintenta">Reintentar</button></div></div>`;
    });
  }
  function destruir() {
    muerto = true;
    clearInterval(chequeo);
    if (pk) pk.destruir();
    desuscribe.forEach(f => { try { f(); } catch (e) { /* ya estaba */ } });
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }
  const raiz = () => host && host.querySelector("#frRaiz");

  /* ---------- pintar ---------- */
  function sprite(especie, clase = "") {
    const u = PM.urlsSprite(especie);
    return `<img class="${clase}" src="${esc(u[0])}" alt="${esc(especie)}" loading="lazy" data-urls="${esc(JSON.stringify(u.slice(1)))}">`;
  }
  function arreglaSprites() {
    const r = raiz();
    if (!r) return;
    r.querySelectorAll("img[data-urls]").forEach(img => {
      img.onerror = () => {
        const resto = JSON.parse(img.dataset.urls || "[]");
        if (!resto.length) { img.onerror = null; img.style.visibility = "hidden"; return; }
        img.dataset.urls = JSON.stringify(resto.slice(1));
        img.src = resto[0];
      };
    });
  }
  function pinta() {
    const r = raiz();
    if (!r || muerto || !F || vista === "pelea" || vista === "carga") return;
    try {
      r.innerHTML = vista === "menu" ? htmlMenu() : vista === "equipo" ? htmlEquipo() : vista === "rival" ? htmlRivalVista()
      : vista === "resultado" ? htmlResultado() : vista === "cambio" ? htmlCambio() : "";
    } catch (e) {
      // Una vista que no se puede pintar no deja la pantalla en blanco:
      // se vuelve al menú, que solo lee números.
      console.warn("[frontera] pintar", vista, e);
      if (vista === "menu") { r.innerHTML = `<div class="jg-pk-aviso">No se pudo pintar el menú: ${esc(e.message)}<button class="btn" data-x="reintenta">Reintentar</button></div>`; return; }
      avisoFr = "Algo falló al abrir esa pantalla; vuelve a intentarlo.";
      vista = "menu"; pinta(); return;
    }
    arreglaSprites();
  }
  const cabecera = (titulo, sub) => `<header class="jg-fr-cab"><button class="btn2" data-x="${vista === "menu" ? "volver" : "menu"}">← ${vista === "menu" ? "Juegos" : "Instalaciones"}</button>
    <div><small>FRONTERA BATALLA</small><h2>${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
    <button class="btn2" data-x="reglas">📖 Reglas</button></header>`;

  function htmlMenu() {
    const insts = Object.entries(F.INSTALACIONES).map(([id, I]) => {
      const kk = `${id}-${sel.nivel}`, r = datos.runs[kk], mejor = datos.mejor[kk] || 0;
      return `<article class="jg-fr-inst${sel.inst === id ? " on" : ""}" data-x="inst" data-i="${id}">
        <div class="jg-fr-inst-ico">${ICONO[id]}</div>
        <h3>${esc(I.n)}</h3><p>${esc(TEXTO[id])}</p>
        <dl><div><dt>Récord</dt><dd>${mejor}</dd></div><div><dt>Racha</dt><dd>${r ? r.n - 1 : "—"}</dd></div></dl>
        <button class="btn" data-x="${r ? "sigue" : "nueva"}" data-i="${id}">${r ? `Continuar (combate ${r.n})` : "Empezar racha"}</button>
        ${r ? `<button class="btn2 jg-fr-mini" data-x="retira" data-i="${id}">Retirarse</button>` : ""}
      </article>`;
    }).join("");
    const filas = [1, 7, 8, 14, 21, 35, 49, 70].map(n => `<tr><td>${n}</td><td>${n % 7 === 0 ? "★ " : ""}${F.serieDe(n) + 1}</td><td>+${F.monedasCombate(n)} 🪙</td></tr>`).join("");
    return `${cabecera("Elige una instalación", "Tres Pokémon, siete combates por serie, y cada serie el rival aprieta más.")}
      <div class="jg-fr-nivel" role="radiogroup" aria-label="Nivel">${Object.entries(F.NIVELES).map(([n, t]) =>
        `<button class="btn2${sel.nivel === n ? " on" : ""}" data-x="nivel" data-n="${n}" role="radio" aria-checked="${sel.nivel === n}">${esc(t)}</button>`).join("")}</div>
      ${avisoFr ? `<p class="jg-fr-aviso">⚠ ${esc(avisoFr)}</p>` : ""}
      <div class="jg-fr-insts">${insts}</div>
      <section class="jg-fr-info">
        <div><h4>Tu Frontera</h4><p><b>${datos.victorias}</b> combates ganados en total.</p>
          <p class="jg-nota">Cada racha y el total de victorias van a la Clasificación (Juegos individuales → Frontera Batalla).</p>
          ${sinReglas ? `<p class="jg-fr-aviso">⚠ La clasificación rechazó tu marca (PERMISSION_DENIED): faltan publicar las reglas de Firebase con la Frontera. Queda guardada aquí y se sube sola en cuanto se publiquen.</p>` : Object.keys(datos.pend).length ? `<p class="jg-nota">Subiendo tus marcas a la clasificación…</p>` : ""}</div>
        <div><h4>Monedas 🪙</h4><p class="jg-nota">Cada victoria paga 3. Cuando superas tu récord de racha, cada combate nuevo paga lo de la tabla (el séptimo de cada serie, el del rival fuerte, paga 10 más).</p>
          <table class="jg-fr-tabla"><thead><tr><th>Combate</th><th>Serie</th><th>Paga</th></tr></thead><tbody>${filas}</tbody></table></div>
      </section>`;
  }

  /* La elección de los tres: un equipo guardado (Torre y Palacio) o los
     seis de alquiler (Fábrica). */
  const setsPropios = id => (equipos && equipos[id] ? PM.desempaqueta(equipos[id].eq) : []);
  function candidatos() {
    if (sel.inst === "fabrica") return F.alquiler(1, run() ? run().semilla : "x", sel.nivel);
    return equipoSel ? setsPropios(equipoSel) : [];
  }
  function htmlSet(s, i, on, extra = "") {
    return `<button class="jg-fr-set${on ? " on" : ""}" data-x="toma" data-i="${i}" ${extra}>
      ${sprite(s.species, "jg-fr-spr")}<b>${esc(s.name || s.species)}</b>
      <small>${esc(s.item || "sin objeto")} · ${esc(s.ability || "")}</small>
      <small class="jg-fr-movs">${(s.moves || []).map(esc).join(" · ")}</small></button>`;
  }
  function htmlEquipo() {
    const I = F.INSTALACIONES[sel.inst];
    const lista = candidatos();
    const elegidosSets = elegidos.map(i => lista[i]).filter(Boolean);
    const errores = elegidosSets.length === 3 ? F.validaFrontera(elegidosSets) : [];
    let cuerpo = "";
    if (sel.inst !== "fabrica") {
      const ids = Object.keys(equipos || {});
      cuerpo += ids.length
        ? `<div class="jg-fr-equipos">${ids.map(id => `<button class="btn2${id === equipoSel ? " on" : ""}" data-x="equipo" data-e="${esc(id)}">${esc(equipos[id].nombre || "Equipo")}</button>`).join("")}
            <button class="btn2" data-x="editar">📋 Mis equipos</button></div>`
        : `<div class="jg-pk-aviso">Aún no tienes equipos guardados. Son los mismos de los combates Pokémon.<button class="btn" data-x="editar">📋 Crear un equipo</button></div>`;
    }
    if (lista.length) cuerpo += `<p class="jg-nota">Elige tres (${elegidos.length}/3). Se llevan al ${esc(F.NIVELES[sel.nivel])}${sel.nivel === "50" ? "" : " (nivel 100)"}, sin Teracristal.</p>
      <div class="jg-fr-sets">${lista.map((s, i) => htmlSet(s, i, elegidos.includes(i))).join("")}</div>`;
    return `${cabecera(I.n + " · " + F.NIVELES[sel.nivel], sel.inst === "fabrica" ? "Tus seis Pokémon de alquiler. Elige tres." : "Elige un equipo y tres de sus Pokémon.")}
      ${cuerpo}
      ${errores.length ? `<ul class="jg-fr-err">${errores.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <footer class="jg-fr-pie"><button class="btn" data-x="confirma"${elegidos.length === 3 && !errores.length ? "" : " disabled"}>¡A la Frontera!</button></footer>`;
  }

  function htmlRivalVista() {
    const r = run(), I = F.INSTALACIONES[sel.inst];
    const R = F.rivalDe(sel.inst, r.n, r.semilla);
    const s = F.serieDe(r.n), kk = (r.n - 1) % F.POR_SERIE + 1;
    const aviso = R.as ? `¡${esc(R.nombre)}, ${esc(R.clase)}, te reta${R.as === "oro" ? " con todo" : ""}! Gana y te llevas el símbolo de ${R.as === "oro" ? "oro" : "plata"}.`
      : F.esUltimo(r.n) ? "El séptimo combate de la serie: un rival fuerte te espera." : "";
    return `${cabecera(I.n + " · " + F.NIVELES[sel.nivel], `Serie ${s + 1} · combate ${kk} de ${F.POR_SERIE} · racha ${r.n - 1}`)}
      <div class="jg-fr-duelo${R.as ? " as" : ""}">
        <div class="jg-fr-rival">${htmlRival(R.id, R.nombre, "enorme")}<small>${esc(R.clase)}</small><b>${esc(R.nombre)}</b></div>
        <div class="jg-fr-vs">VS</div>
        <div class="jg-fr-yo">${htmlEntrenador(skin, "enorme")}<small>Tu equipo</small>
          <div class="jg-fr-mis">${r.equipo.map(x => sprite(x.species, "jg-fr-spr")).join("")}</div></div>
      </div>
      ${aviso ? `<p class="jg-fr-aviso">${aviso}</p>` : ""}
      <div class="jg-fr-progreso">${Array.from({ length: F.POR_SERIE }, (_, i) => `<span class="${i < kk - 1 ? "hecho" : i === kk - 1 ? "ahora" : ""}"></span>`).join("")}</div>
      <footer class="jg-fr-pie"><button class="btn2" data-x="retira" data-i="${sel.inst}">Retirarse</button>
        <button class="btn2" data-x="menu">Guardar y salir</button><button class="btn" data-x="combate">¡Combatir!</button></footer>`;
  }

  function htmlResultado() {
    const x = resultado;
    if (!x) return "";
    const I = F.INSTALACIONES[sel.inst];
    if (x.gano) {
      return `${cabecera(I.n + " · " + F.NIVELES[sel.nivel], "")}
        <div class="jg-fr-res gana"><div class="jg-fr-res-ico">🏆</div><h3>¡Ganaste a ${esc(x.rival)}!</h3>
          <p>Racha: <b>${x.n}</b>${x.record ? " · ¡nuevo récord!" : ""}</p>
          <p class="jg-fr-monedas">+${x.monedas} 🪙 <small>(${x.detalle})</small></p>
          ${x.simbolo ? `<p class="jg-fr-aviso">🥇 ¡Símbolo de ${x.simbolo} de la ${esc(I.n)}!</p>` : ""}
          ${x.finSerie ? `<p class="jg-nota">Serie ${F.serieDe(x.n) + 1} completada. La próxima es más dura.</p>` : ""}</div>
        <footer class="jg-fr-pie"><button class="btn2" data-x="menu">Guardar y salir</button>
          <button class="btn" data-x="${sel.inst === "fabrica" ? "acambio" : "siguiente"}">${sel.inst === "fabrica" ? "Cambiar Pokémon →" : "Siguiente combate →"}</button></footer>`;
    }
    return `${cabecera(I.n + " · " + F.NIVELES[sel.nivel], "")}
      <div class="jg-fr-res pierde"><div class="jg-fr-res-ico">${x.rendido ? "🏳️" : "💫"}</div>
        <h3>${x.rendido ? "Te retiraste" : `${esc(x.rival)} te ganó`}</h3>
        <p>La racha termina en <b>${x.n}</b>${x.mejor ? ` · tu récord aquí: ${x.mejor}` : ""}.</p></div>
      <footer class="jg-fr-pie"><button class="btn2" data-x="menu">Volver</button><button class="btn" data-x="nueva" data-i="${sel.inst}">Otra racha</button></footer>`;
  }

  function htmlCambio() {
    const r = run();
    const suyos = r.ultimoRival || [];
    return `${cabecera("Fábrica Batalla · cambio", "Puedes cambiar uno de tus Pokémon por uno del equipo que acabas de vencer.")}
      <h4 class="jg-fr-h4">Tus Pokémon</h4>
      <div class="jg-fr-sets">${r.equipo.map((s, i) => htmlSet(s, i, cambio.mio === i, `data-lado="mio"`)).join("")}</div>
      <h4 class="jg-fr-h4">Los del rival</h4>
      <div class="jg-fr-sets">${suyos.map((s, i) => htmlSet(s, i, cambio.suyo === i, `data-lado="suyo"`)).join("")}</div>
      <footer class="jg-fr-pie"><button class="btn2" data-x="siguiente">No cambiar</button>
        <button class="btn" data-x="cambia"${cambio.mio >= 0 && cambio.suyo >= 0 ? "" : " disabled"}>Cambiar y seguir</button></footer>`;
  }

  /* ---------- la racha ---------- */
  function semillaNueva() {
    const b = new Uint8Array(6);
    (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  }
  function nuevaRacha(inst) {
    sel.inst = inst;
    datos.runs[k()] = { inst, nivel: sel.nivel, semilla: semillaNueva(), n: 1, equipo: null, elecciones: [], enPelea: false, tiempo: 0 };
    elegidos = []; equipoSel = sel.inst === "fabrica" ? "" : Object.keys(equipos || {})[0] || "";
    persiste();
    vista = "equipo"; pinta();
  }
  function confirmaEquipo() {
    const lista = candidatos(), sets = elegidos.map(i => lista[i]).filter(Boolean);
    if (sets.length !== 3 || F.validaFrontera(sets).length) return;
    const r = run();
    r.equipo = F.aNivel(sets, sel.nivel);
    persiste();
    vista = "rival"; pinta();
  }
  function termina(r) {
    delete datos.runs[`${r.inst}-${r.nivel}`];
    persiste();
  }

  /* ---------- el combate ---------- */
  /* Un combate que no se puede montar (unas elecciones guardadas que el
     simulador ya no acepta, un equipo de otra versión) no puede dejar la
     cuenta atrapada: antes se retomaba solo al entrar, fallaba, y la
     Frontera no pasaba nunca de ahí. Se empieza ese combate de cero y,
     si tampoco, se vuelve al menú explicándolo. */
  function empiezaPelea() {
    try { montaPelea(); }
    catch (e) {
      console.warn("[frontera] combate", e);
      if (pk) { try { pk.destruir(); } catch (_) {} pk = null; }
      pelea = null; clearInterval(chequeo);
      const r = run();
      if (r && r.elecciones && r.elecciones.length) {
        r.elecciones = []; r.enPelea = false; persiste();
        try { montaPelea(); return; } catch (e2) { console.warn("[frontera] combate de cero", e2); if (pk) { try { pk.destruir(); } catch (_) {} pk = null; } pelea = null; }
      }
      if (r) { r.enPelea = false; r.elecciones = []; if (!r.equipo) r.equipo = null; persiste(); }
      avisoFr = "No se pudo montar el combate (" + (e && e.message || e) + "). Si se repite, retírate de esa racha y empieza otra.";
      vista = "menu";
      const caja = raiz();
      if (caja) caja.innerHTML = "";
      pinta();
    }
  }
  function montaPelea() {
    const r = run();
    if (!r || !r.equipo) { vista = "menu"; pinta(); return; }
    const R = F.rivalDe(sel.inst, r.n, r.semilla);
    const riv = F.equipoRival(sel.inst, sel.nivel, r.n, r.semilla);
    const continua = r.enPelea;
    if (!continua) { r.enPelea = true; r.elecciones = []; persiste(); }
    pelea = F.nuevaPelea({
      semilla: `${r.semilla}|${r.n}`, sets: [r.equipo, riv.sets],
      nombres: [usuario.name ? String(usuario.name).slice(0, 18) : "Tú", R.nombre],
      skins: [skin, skinRival(R.id, R.nombre)], lados: ["tú", "cpu"],
      iq: F.iqDe(r.n), palacio: sel.inst === "palacio", elecciones: r.elecciones
    });
    inicioPelea = Date.now(); cerrado = false;
    vista = "pelea";
    const caja = raiz();
    caja.innerHTML = `<div class="jg-fr-hud"><span>${ICONO[sel.inst]} ${esc(F.INSTALACIONES[sel.inst].n)} · ${esc(F.NIVELES[sel.nivel])}</span>
      <span>Serie ${F.serieDe(r.n) + 1} · combate ${(r.n - 1) % F.POR_SERIE + 1}/${F.POR_SERIE}</span><span>Racha ${r.n - 1}</span></div><div id="frPelea"></div>`;
    const p = { formato: "gen9customgame", semilla: r.semilla };
    const refresca = () => { if (pk && pelea) pk.actualizar(p, pelea.est()); };
    pk = crearPokemon({
      uid: "tú", pid: "frontera-" + r.semilla, mirando: false,
      jugar: async () => false, terminar: () => {}, secreto: async () => null, rehaz: refresca,
      listo: () => compruebaFin(),
      local: {
        titulo: `${F.INSTALACIONES[sel.inst].corto || F.INSTALACIONES[sel.inst].n} · combate ${r.n}`,
        palacio: sel.inst === "palacio", desdeCero: !continua || sel.inst === "palacio",
        elige: c => { if (pelea.elige(c)) { r.elecciones = pelea.elecciones.slice(); persiste(); } refresca(); },
        rinde: () => { pelea.rinde(); r.elecciones = pelea.elecciones.slice(); persiste(); refresca(); }
      }
    });
    pk.montar(caja.querySelector("#frPelea"));
    refresca();
    clearInterval(chequeo);
    // `listo` no llega si la pestaña estaba oculta: se mira también aquí.
    chequeo = setInterval(compruebaFin, 700);
  }
  function compruebaFin() {
    if (cerrado || !pelea || !pk) return;
    const e = pelea.est();
    if (e.fase !== "fin" || pk.ocupado()) return;
    cerrado = true;
    clearInterval(chequeo);
    setTimeout(() => cierraPelea(e), 900);
  }

  function cierraPelea(e) {
    if (muerto) return;
    const r = run();
    if (!r) return;
    const R = F.rivalDe(sel.inst, r.n, r.semilla);
    const gano = e.ganador === "tú";
    const dura = Math.max(1000, Math.min(MAX_PELEA_MS, Date.now() - inicioPelea));
    if (pk) { pk.destruir(); pk = null; }
    pelea = null;
    const kk = k(), previoMejor = datos.mejor[kk] || 0;
    const lista = [];
    if (gano) {
      const n = r.n;
      r.tiempo = Math.min(TOPE_MS, (r.tiempo || 0) + dura);
      datos.victorias += 1;
      datos.tiempoTot = Math.min(TOPE_MS, datos.tiempoTot + dura);
      const record = n > previoMejor;
      if (record) { datos.mejor[kk] = n; datos.tMejor[kk] = Math.max(1, r.tiempo); }
      const dRacha = { categoria: `club-frontera-${kk}`, puntos: n, tiempo: Math.max(1, r.tiempo), partida: `${r.semilla}-${n}` };
      const dVict = { categoria: "club-frontera-victorias", puntos: datos.victorias, tiempo: Math.max(1, datos.tiempoTot), partida: `${r.semilla}-${n}v` };
      if (record) {
        lista.push({ d: dRacha, previa: previoMejor ? { puntos: previoMejor } : null });
        sube(dRacha.categoria, { puntos: n, tiempo: dRacha.tiempo, partida: dRacha.partida });
      }
      lista.push({ d: dVict, previa: datos.victorias > 1 ? { puntos: datos.victorias - 1 } : null });
      sube(dVict.categoria, { puntos: datos.victorias, tiempo: dVict.tiempo, partida: dVict.partida });
      const extra = record ? F.monedasCombate(n) + (previoMejor ? 0 : 40) : 0;
      const I = F.INSTALACIONES[sel.inst];
      resultado = {
        gano: true, n, rival: R.nombre, record, finSerie: F.esUltimo(n),
        simbolo: I.cerebro[0] === n ? "plata" : I.cerebro[1] === n ? "oro" : "",
        monedas: 3 + extra, detalle: record ? `3 por la victoria y ${extra} por el récord` : "3 por la victoria; el récord de racha paga cuando lo superas"
      };
      if (sel.inst === "fabrica") r.ultimoRival = F.aNivel(F.equipoRival(sel.inst, sel.nivel, n, r.semilla).sets, sel.nivel);
      r.n = n + 1; r.enPelea = false; r.elecciones = [];
      persiste();
      suena("victoria");
    } else {
      resultado = { gano: false, n: r.n - 1, rival: R.nombre, rendido: e.motivo === "rinde", mejor: datos.mejor[kk] || 0 };
      termina(r);
      suena("derrota");
    }
    try { alResultado && alResultado(lista); } catch (err) { /* un logro no debe romper la racha */ }
    vista = "resultado";
    pinta();
  }

  /* ---------- clics ---------- */
  function alClic(ev) {
    try { clic(ev); }
    catch (e) {
      console.warn("[frontera] clic", e);
      avisoFr = "Algo falló: " + (e && e.message || e);
      if (vista !== "pelea") { vista = "menu"; pinta(); }
    }
  }
  function clic(ev) {
    const b = ev.target.closest("[data-x]");
    if (!b || !host || !host.contains(b) || b.disabled) return;
    const x = b.dataset.x;
    if (x === "reintenta") { host.removeEventListener("click", alClic); montar(host); return; }
    if (x === "volver") { volver && volver(); return; }
    if (x === "reglas") { import("./reglas.js").then(m => m.abreReglas("frontera")); return; }
    if (x !== "reglas" && x !== "volver") avisoFr = "";
    if (x === "menu") { vista = "menu"; resultado = null; pinta(); return; }
    if (x === "nivel") { sel.nivel = b.dataset.n; pinta(); return; }
    if (x === "inst") { if (ev.target.closest("button")) return; sel.inst = b.dataset.i; pinta(); return; }
    if (x === "nueva") {
      const inst = b.dataset.i || sel.inst;
      sel.inst = inst;
      if (run() && !confirm("Ya tienes una racha en curso aquí. ¿Terminarla y empezar otra?")) return;
      nuevaRacha(inst); return;
    }
    if (x === "sigue") {
      sel.inst = b.dataset.i;
      const r = run();
      if (!r) return;
      if (!r.equipo) { elegidos = []; equipoSel = sel.inst === "fabrica" ? "" : Object.keys(equipos || {})[0] || ""; vista = "equipo"; }
      else if (r.enPelea) { empiezaPelea(); return; }
      else vista = "rival";
      pinta(); return;
    }
    if (x === "retira") {
      sel.inst = b.dataset.i || sel.inst;
      const r = run();
      if (!r || !confirm(`¿Retirarte? La racha de ${r.n - 1} termina aquí (lo ganado ya está guardado).`)) return;
      termina(r); vista = "menu"; pinta(); return;
    }
    if (x === "equipo") { equipoSel = b.dataset.e; elegidos = []; pinta(); return; }
    if (x === "editar") {
      abreEquipos({ uid, alCerrar: () => misEquipos(uid).then(e => { equipos = e.equipos || {}; skin = e.skin || skin; if (!equipoSel) equipoSel = Object.keys(equipos)[0] || ""; pinta(); }) });
      return;
    }
    if (x === "toma") {
      const i = +b.dataset.i;
      if (vista === "cambio") { cambio[b.dataset.lado] = cambio[b.dataset.lado] === i ? -1 : i; pinta(); return; }
      elegidos = elegidos.includes(i) ? elegidos.filter(j => j !== i) : elegidos.length < 3 ? [...elegidos, i] : elegidos;
      pinta(); return;
    }
    if (x === "confirma") { confirmaEquipo(); return; }
    if (x === "combate") { empiezaPelea(); return; }
    if (x === "siguiente") { resultado = null; vista = "rival"; pinta(); return; }
    if (x === "acambio") { cambio = { mio: -1, suyo: -1 }; vista = "cambio"; pinta(); return; }
    if (x === "cambia") {
      const r = run();
      const nuevo = r.equipo.slice();
      nuevo[cambio.mio] = r.ultimoRival[cambio.suyo];
      // La Fábrica no admite repetidos: si el cambio los crea, no se hace.
      const err = F.validaFrontera(nuevo);
      if (err.length) { alert(err.join("\n")); return; }
      r.equipo = nuevo; r.ultimoRival = null; persiste();
      vista = "rival"; pinta(); return;
    }
  }

  return { montar, destruir };
}

/* Para quien lo use sin el motor cargado (los tests, la portada). */
export const fronteraLista = () => !!(motorListo() && motorListo().frontera);
