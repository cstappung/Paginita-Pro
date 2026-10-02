/* Pokémon — combates individuales con el simulador de Showdown.

   La pelea la decide `pokemon/motor-pk.js` (Showdown dentro de un
   bundle aparte) a partir del registro de la sala; esta pantalla solo
   enseña lo que el simulador dice y escribe lo que el jugador elige.
   Cuatro cosas que conviene saber antes de tocarla:

   - **Cada elección se escribe dos veces, y la segunda la manda la
     pantalla sola.** Primero la promesa `{t:"c", k, h}` (el hash de la
     elección con la llave del punto); cuando están las dos promesas, la
     revelación `{t:"r", k, c, l}`. La elección prometida se guarda en
     `localStorage` *antes* de escribir la promesa: si la pestaña se
     recarga entre las dos, sin ella no habría forma de revelar y la mesa
     se quedaría esperando para siempre.
   - **Quien no decide también escribe** («-», `NADA`): la semilla del
     turno sale de las llaves de los dos, y si el que cambia tras un
     debilitado conociera la semilla podría probar cada cambio en la
     consola. Lo manda la pantalla sin preguntar.
   - **Nada depende de un único temporizador**: un latido cada
     `LATIDO_MS` vuelve a mirar qué falta y reintenta lo que se mandó y
     no llegó, como en Flip 7 y el cacho.
   - **Se enseña lo que enseñaría Showdown.** Del rival, la vida en
     porcentaje, los tipos, el estado y lo que ya reveló (movimientos,
     objeto, habilidad), leído del registro público. Del propio equipo,
     todo. Lo demás está en memoria —el simulador lo necesita—, y ese es
     el límite honesto que el manual explica. */
import { cadenaPk, llavePk, sha256hex } from "./motor.js";
import { suena } from "./sonido.js";
import { cargaMotor, motorListo } from "./pokemon/carga.js";
import { abreEquipos, misEquipos } from "./pokemon/equipos.js";
import { relata, relataTodo, TIPOS, COLOR_TIPO, ESTADOS, STATS_CORTO } from "./pokemon/relato.js";
import { ENTRENADORES, REGIONES, skinSana, htmlEntrenador, htmlSkin, SKIN_POR, colorRegion } from "./pokemon/entrenadores.js";

const toID = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const LATIDO_MS = 2000;
const REINTENTO_MS = 9000;

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chipTipo = t => `<span class="jg-pk-tipo" style="--t:${COLOR_TIPO[t] || "#888"}">${esc(TIPOS[t] || t)}</span>`;
const pct = (hp, max) => (max ? Math.max(0, Math.min(100, Math.ceil(hp / max * 100))) : 0);
const CORTO_ESTADO = { brn: "QUE", par: "PAR", slp: "DOR", frz: "CON", psn: "ENV", tox: "TÓX" };
const colorVida = p => (p > 50 ? "#3fd47a" : p > 20 ? "#f2c037" : "#ef5350");

/* `ctx.local` es la Frontera Batalla: la pelea corre contra la IA en
   este mismo navegador (`frontera-motor.js`), sin registro ni promesas.
   Trae `elige(c)`, `rinde()`, `titulo`, `palacio` y `desdeCero` (contar
   la pelea desde la presentación); quien la monta vuelve a llamar a
   `actualizar` con el estado nuevo después de cada elección. */
export function crearPokemon(ctx) {
  const { uid, pid, jugar, terminar, mirando, secreto, rehaz, listo, local } = ctx;
  let host = null, muerto = false, latido = 0;
  let p = null, est = null, PM = motorListo();
  let cadena = null, cargandoSecreto = false;
  let equipos = null;            // mis equipos (lo de `misEquipos`)
  let skin = SKIN_POR;
  let elegido = "";              // id del equipo marcado antes de prometer
  const enviado = {};            // "k:t" → hora en que se mandó
  const firmas = {};
  let lineasVistas = 0, relatoYo = null, turnoVisto = 0, caidasVistas = 0;
  let toggles = { tera: false, mega: false, dynamax: false, z: false };
  let rindeArmado = 0;

  const PEND = "pk.pend." + pid + "." + uid;
  const pendiente = () => { try { return JSON.parse(localStorage.getItem(PEND) || "null"); } catch (e) { return null; } };
  const guardaPend = v => { try { localStorage.setItem(PEND, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  function set(id, firma, html) {
    if (firmas[id] === firma) return false;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
    return true;
  }

  /* ---------- montar ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-pk">
        <div class="jg-barra"><div class="jg-fase" id="pkFase"></div><div class="jg-grow"></div>
          <div class="jg-pk-barbot" id="pkBotones"></div></div>
        <div class="jg-pk-escena" id="pkEscena"></div>
        <div class="jg-pk-abajo">
          <div class="jg-pk-control" id="pkControl"></div>
          <div class="jg-pk-relato" id="pkRelato" aria-live="polite"></div>
        </div>
        <div class="jg-pie" id="pkPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
    host.addEventListener("change", alCambio);
    if (!PM) {
      cargaMotor().then(m => { PM = m; if (!muerto) { rehaz && rehaz(); pinta(); } })
        .catch(e => { if (!muerto) set("pkEscena", "error", `<div class="jg-pk-aviso">${esc(e.message)}</div>`); });
    }
    if (!mirando && !local) misEquipos(uid).then(d => { equipos = d; skin = skinSana(d.skin); if (!muerto) pinta(); }).catch(() => {});
    latido = setInterval(() => { if (!muerto) { automatismos(); } }, LATIDO_MS);
  }

  function destruir() {
    muerto = true;
    clearInterval(latido); clearTimeout(reloj);
    if (host) { host.removeEventListener("click", alClic); host.removeEventListener("change", alCambio); host.innerHTML = ""; }
    host = null;
  }

  /* ---------- quién soy en la pelea ---------- */
  const yo = () => (est && est.lados ? est.lados.indexOf(uid) : -1);
  const juego = () => !mirando && yo() >= 0;
  const nombreLado = i => (est && est.nombres && est.nombres[i]) || "Entrenador";

  async function llave(k) {
    if (!cadena && !cargandoSecreto) {
      cargandoSecreto = true;
      try { const s = await secreto(); if (s) cadena = cadenaPk(s.sem, s.sal); }
      finally { cargandoSecreto = false; }
    }
    return cadena ? llavePk(cadena, k) : null;
  }

  /* ---------- lo que la pantalla manda sola ---------- */
  const yaMandado = (k, t) => enviado[k + ":" + t] && Date.now() - enviado[k + ":" + t] < REINTENTO_MS;

  async function promete(c, sk) {
    if (!est || muerto) return;
    if (local) { local.elige(c); return; }
    const k = est.punto;
    if (yaMandado(k, "c")) return;
    const l = await llave(k);
    if (!l) return;
    guardaPend({ k, c, sk: sk || "" });       // antes de escribir: ver la cabecera
    enviado[k + ":c"] = Date.now();
    const ok = await jugar({ t: "c", uid, k, h: sha256hex(c + "|" + l) });
    if (!ok) delete enviado[k + ":c"];
  }

  async function revela() {
    const k = est.punto;
    if (yaMandado(k, "r")) return;
    let pd = pendiente();
    if (!pd || pd.k !== k) {
      // Sin nada guardado solo se puede revelar «nada», que es lo único
      // que la pantalla promete sin preguntar.
      if (est.decide[uid]) { aviso = "Se perdió tu elección de este turno en este navegador: la mesa queda esperando."; return; }
      pd = { k, c: PM ? PM.NADA : "-", sk: "" };
    }
    const l = await llave(k);
    if (!l) return;
    enviado[k + ":r"] = Date.now();
    const j = { t: "r", uid, k, c: pd.c, l };
    if (k === 0) j.sk = skinSana(pd.sk);
    const ok = await jugar(j);
    if (!ok) delete enviado[k + ":r"];
  }

  let aviso = "";
  function automatismos() {
    if (!est || !PM || !juego() || local) return;
    if (est.fase !== "equipos" && est.fase !== "jugando") return;
    const todos = est.lados.every(u => est.prometido[u]);
    if (!est.prometido[uid]) {
      if (!est.decide[uid]) promete(PM.NADA);
      else {
        // Una promesa escrita que no llegó a la base (recarga a mitad):
        // se rehace con la misma elección guardada.
        const pd = pendiente();
        if (pd && pd.k === est.punto && enviado[est.punto + ":c"] && !yaMandado(est.punto, "c")) promete(pd.c, pd.sk);
      }
    } else if (todos && !est.revelado[uid]) revela();
  }

  /* ---------- pintar ---------- */
  function pinta() {
    if (!host) return;
    if (!est || est.fase === "cargando" || !PM) {
      set("pkFase", "carga", "Cargando el simulador de Pokémon…");
      set("pkEscena", "carga", `<div class="jg-pk-aviso"><div class="jg-pk-poke"></div>Descargando el motor de combate (≈1 MB, solo la primera vez)…</div>`);
      return;
    }
    pintaFase();
    pintaBotones();
    if (est.fase === "espera") {
      set("pkEscena", "espera", `<div class="jg-pk-aviso">Esperando a que entre un rival. Pásale el enlace de la sala.<br><small>Formato: ${esc(PM.FORMATOS[PM.formatoDe(p.formato)])}</small></div>`);
      set("pkControl", "espera", ""); set("pkRelato", "espera", "");
      return;
    }
    if (est.fase === "equipos" || (est.fase === "fin" && !est.battle)) { pintaEquipos(); return; }
    if (est.battle) asegurarCampo();
    anima();
    pintaEscena();
    pintaControl();
    pintaRelato();
    pintaPie();
  }

  function pintaFase() {
    let t;
    const fmt = local ? local.titulo || "" : PM.FORMATOS[PM.formatoDe(p.formato)] || "";
    if (est.fase === "fin") {
      const g = est.ganador;
      const motivo = { rinde: " (rendición)", abandono: " (abandono)", equipo: " (equipo no válido)", equipos: " (ningún equipo era válido)", tope: " (demasiado largo)" }[est.motivo] || "";
      t = g === "" ? "Empate" + motivo : g === uid ? "🏆 ¡Ganaste!" + motivo : `${nombreLado(est.lados.indexOf(g))} gana${motivo}`;
    } else if (est.fase === "equipos") {
      t = !juego() ? "Los entrenadores eligen equipo…" : est.prometido[uid] ? "Equipo elegido 🔒 · esperando al rival" : "Elige tu equipo";
    } else {
      const r = est.ronda ? `Turno ${est.ronda}` : "Vista previa";
      t = !juego() ? r : !est.decide[uid] ? `${r} · esperando al rival` : est.prometido[uid] ? `${r} · elegido 🔒, esperando al rival` : `${r} · ¡elige!`;
    }
    set("pkFase", t + "|" + fmt, `<span class="jg-pk-fmt">${esc(fmt)}</span>${esc(t)}`);
  }

  function pintaBotones() {
    const puede = juego() && (est.fase === "equipos" || est.fase === "jugando");
    set("pkBotones", (puede ? "1" : "0") + rindeArmado + est.fase + (animando ? "a" : ""), `
      ${local ? (animando ? `<button class="btn2" data-x="salta">⏩ Saltar</button>` : "") : `<button class="btn2" data-x="equipos">📋 Mis equipos</button>`}
      ${puede && est.fase === "jugando" ? `<button class="btn2 jg-pk-peligro" data-x="rinde">${rindeArmado ? "¿Seguro? Pulsa otra vez" : "🏳 Rendirse"}</button>` : ""}`);
  }

  /* --- elegir equipo y entrenador ---
     Una pantalla de «antes del combate»: a la izquierda tu ficha de
     entrenador con el sprite grande y la lista de protagonistas, a la
     derecha tus equipos como tarjetas con sus seis sprites, y debajo el
     enfrentamiento: tú contra el rival, con su candado cuando ya eligió. */
  function versus(miSkin, listoYo) {
    const i = yo() >= 0 ? yo() : 0, o = 1 - i, ru = est.lados[o];
    const rivalListo = !!(est.prometido && est.prometido[ru]);
    const lado = (sk, nom, ok, rival) => `<div class="jg-pk-vs-lado${rival ? " rival" : ""}">
        <div class="jg-pk-vs-ent">${sk ? htmlEntrenador(sk, "grande") : `<span class="jg-pk-ent grande sombra"><b>?</b></span>`}</div>
        <b>${esc(nom)}</b><small>${ok ? "🔒 Listo" : "Eligiendo…"}</small></div>`;
    return `<div class="jg-pk-vs">${lado(miSkin, yo() >= 0 ? "Tú" : nombreLado(i), listoYo, false)}<span class="jg-pk-vs-x">VS</span>${lado("", nombreLado(o), rivalListo, true)}</div>`;
  }

  function pintaEquipos() {
    const fmt = PM.formatoDe(p.formato);
    const invalidos = est.invalidos || {};
    if (!juego() || est.prometido[uid] || est.fase === "fin") {
      const fin = est.fase === "fin" ? est.lados.map((u, i) => invalidos[u]
        ? `<p class="jg-pk-mal">❌ El equipo de ${esc(nombreLado(i))} no vale en ${esc(PM.FORMATOS[fmt])}: ${esc(invalidos[u].slice(0, 2).join(" · "))}</p>` : "").join("") : "";
      set("pkEscena", "eqv|" + JSON.stringify(est.prometido) + est.fase + skin, `<div class="jg-pk-espera">
        ${versus(juego() ? skin : "", !!est.prometido[uid])}
        <p>${est.fase === "fin" ? "" : "Los dos eligen a ciegas: lo elegido viaja cerrado y se abre cuando están los dos."}</p>${fin}</div>`);
      set("pkControl", "eqv", ""); set("pkRelato", "eqv", ""); set("pkPie", "eqv", "");
      return;
    }
    const lista = equipos ? Object.entries(equipos.equipos || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)) : null;
    const tarjetas = (lista || []).map(([id, e]) => {
      const sets = PM.desempaqueta(e.eq);
      const errs = PM.valida(fmt, sets);
      return `<button class="jg-pk-eqcarta${errs.length ? " mal" : ""}${elegido === id ? " on" : ""}" data-eq="${esc(id)}"${errs.length ? ` title="${esc(errs[0])}"` : ""}>
        <span class="jg-pk-eqcab"><b>${esc(e.nombre || "Equipo")}</b><small>${esc(PM.FORMATOS[e.formato] || e.formato)}</small>${errs.length ? `<em>No vale aquí</em>` : `<i>✓</i>`}</span>
        <span class="jg-pk-eqfila6">${Array.from({ length: 6 }, (_, k) => sets[k] ? `<span>${img(sets[k].species, { fijo: true })}</span>` : `<span class="vacio"></span>`).join("")}</span>
        ${errs.length ? `<small class="jg-pk-eqerr">${esc(errs[0])}</small>` : ""}</button>`;
    }).join("");
    const elegidoE = elegido && equipos && equipos.equipos[elegido];
    const previa = elegidoE ? `<div class="jg-pk-previa">${PM.desempaqueta(elegidoE.eq).map(s => {
      const sp = PM.dexDe(fmt).species.get(s.species);
      return `<div class="jg-pk-previa-pk">${img(s.species, { shiny: s.shiny })}<b>${esc(s.name || s.species)}</b>
        <span class="jg-pk-tipos">${(sp.exists ? sp.types : []).map(chipTipo).join("")}</span><small>${esc(s.item || "Sin objeto")}</small></div>`;
    }).join("")}</div>` : "";
    const e = ENTRENADORES.find(x => x.id === skin) || ENTRENADORES[0];
    const ents = ENTRENADORES.map(x => `<button class="jg-pk-entop${x.id === skin ? " on" : ""}" data-skin="${x.id}" title="${esc(x.n)} · ${REGIONES[x.g]}">${htmlEntrenador(x.id)}</button>`).join("");
    set("pkEscena", "eq|" + elegido + "|" + skin + "|" + (lista ? lista.map(x => x[0] + x[1].at).join() : "…") + JSON.stringify(est.prometido), `
      <div class="jg-pk-elige">
        <section class="jg-pk-tarjeta-ent" style="--c:${colorRegion(e.id)}">
          <div class="jg-pk-te-cab"><small>Entrenador</small><b>${esc(e.n)}</b><span>${esc(REGIONES[e.g])}</span></div>
          <div class="jg-pk-te-img">${htmlEntrenador(e.id, "enorme")}</div>
          <div class="jg-pk-ents">${ents}</div>
        </section>
        <section class="jg-pk-te-equipos">
          <h3>Tu equipo <small>para ${esc(PM.FORMATOS[fmt])}</small></h3>
          <div class="jg-pk-eqcartas">${lista === null ? `<p class="jg-nota">Cargando tus equipos…</p>` : tarjetas || `<p class="jg-nota">No tienes equipos todavía. Ábrelos con «📋 Mis equipos»: puedes pegar uno exportado de Showdown.</p>`}</div>
          ${previa}
        </section>
        <footer class="jg-pk-elige-pie">${versus(skin, false)}
          <button class="btn jg-pk-listo" data-x="listo"${elegido ? "" : " disabled"}>¡Listo para combatir!</button></footer>
      </div>`);
    set("pkControl", "eq", ""); set("pkRelato", "eq", ""); set("pkPie", "eq", `<span class="jg-nota">El rival no verá tu equipo hasta que los dos hayáis elegido.</span>`);
  }

  /* --- el campo ---
     La escena se monta una vez y después se toca pieza a pieza: el sprite
     cambia de `src` solo cuando cambia el Pokémon, y la barra de vida es
     siempre el mismo elemento, así su transición se ve. Repintarla entera
     en cada cambio cortaba las animaciones a la mitad. */
  function revelados() {
    // Lo que cada lado ha enseñado: movimientos, objeto y habilidad.
    const out = [{}, {}];
    out.vistos = [new Set(), new Set()];
    const lin = PM.lineasPara(est.log, -1, 0);
    const reg = (id, campo, v) => {
      const m = /^p(\d)[a-z]?: (.*)$/.exec(id || ""); if (!m) return;
      const r = out[m[1] - 1][m[2]] || (out[m[1] - 1][m[2]] = { moves: new Set(), item: "", ability: "" });
      if (campo === "moves") r.moves.add(v); else r[campo] = v;
    };
    for (const l of lin) {
      const c = l.split("|"), t = c[1];
      const de = c.find(x => x.startsWith("[from]")) || "", of = c.find(x => x.startsWith("[of]"));
      const quien = of ? of.slice(5) : c[2];
      if (t === "poke") out.vistos[Number(c[2].charAt(1)) - 1].add(c[3].split(",")[0]);
      if (t === "switch" || t === "drag" || t === "replace") out.vistos[Number(c[2].charAt(1)) - 1].add(c[3].split(",")[0]);
      if (t === "move") reg(c[2], "moves", c[3]);
      else if (t === "-item") reg(c[2], "item", c[3]);
      else if (t === "-enditem") reg(c[2], "item", c[3] + " (gastado)");
      else if (t === "-ability") reg(c[2], "ability", c[3]);
      if (/^\[from\] item: /.test(de)) reg(quien, "item", de.slice(13));
      if (/^\[from\] ability: /.test(de)) reg(quien, "ability", de.slice(16));
    }
    return out;
  }

  function img(especie, { espalda = false, shiny = false, clase = "", fijo = false } = {}) {
    const urls = PM.urlsSprite(especie, { espalda, shiny, fijo });
    return `<img class="${clase}" src="${esc(urls[0])}" alt="${esc(especie)}" data-urls="${esc(JSON.stringify(urls.slice(1)))}" onerror="var u=JSON.parse(this.dataset.urls||'[]');if(u.length){this.dataset.urls=JSON.stringify(u.slice(1));this.src=u[0]}else{this.onerror=null;this.style.visibility='hidden'}">`;
  }

  /* El equipo de un lado en fila. Del rival solo se ven las especies
     que ya enseñó (vista previa o al salir al campo); las demás son una
     Poké Ball sin abrir. */
  function bolas(side, propio, vistos) {
    return `<div class="jg-pk-bolas">${side.pokemon.map(pk => {
      const v = pct(pk.hp, pk.maxhp);
      const visto = propio || vistos.has(pk.species.name) || vistos.has(pk.baseSpecies.name);
      return `<span class="jg-pk-bola${pk.fainted ? " ko" : ""}${pk.isActive ? " activo" : ""}" title="${visto ? esc(pk.species.name) + (pk.fainted ? " (debilitado)" : ` · ${v} %`) : "Sin revelar"}">${visto ? img(pk.species.name, { clase: "mini", fijo: true }) : `<i class="jg-pk-ball"></i>`}</span>`;
    }).join("")}</div>`;
  }

  /* Los fondos: uno por sala, sacado de su semilla, para que los dos
     vean el mismo sitio. Son gradientes de CSS, nada que descargar. */
  const BIOMAS = ["pradera", "playa", "cueva", "nieve", "atardecer", "gimnasio"];
  const pos = i => (i === (yo() >= 0 ? yo() : 0) ? "mia" : "suya");
  const $c = sel => host && host.querySelector(sel);

  function asegurarCampo() {
    if ($c("#pkCampo")) return;
    const bioma = BIOMAS[((p && p.semilla) >>> 0) % BIOMAS.length];
    const lado = l => `
      <div class="jg-pk-base ${l}"></div>
      <div class="jg-pk-spr ${l}"><div class="jg-pk-anim"><img alt=""></div><div class="jg-pk-fx"></div></div>
      <div class="jg-pk-ficha ${l}" hidden>
        <div class="jg-pk-fnom"><b class="n"></b><span class="lv"></span><span class="st"></span></div>
        <div class="jg-pk-tipos"></div>
        <div class="jg-pk-vida"><i></i></div>
        <div class="jg-pk-vnum"></div>
        <div class="jg-pk-boosts"></div><small class="ex"></small>
      </div>
`;
    firmas.pkEscena = "campo";
    const el = $c("#pkEscena");
    el.innerHTML = `<div class="jg-pk-tira"><div class="jg-pk-entren mia"></div><div class="jg-pk-entren suya"></div></div>
      <div class="jg-pk-campo bioma-${bioma}" id="pkCampo">
        <div class="jg-pk-nubes"></div><div class="jg-pk-clima-fx"></div>
        <div class="jg-pk-clima"></div>
        ${lado("suya")}${lado("mia")}
        <div class="jg-pk-intro" hidden></div>
        <div class="jg-pk-cuadro" id="pkCuadro"></div>
      </div>`;
    spritesVistos = { mia: "", suya: "" };
  }
  let spritesVistos = { mia: "", suya: "" };

  /* Pone el sprite de un lado. `entra` hace la salida de la Poké Ball. */
  function ponSprite(l, especie, { shiny = false, entra = false } = {}) {
    const caja = $c(`.jg-pk-spr.${l}`);
    if (!caja) return;
    const clave = especie ? especie + (shiny ? "*" : "") : "";
    if (spritesVistos[l] !== clave) {
      spritesVistos[l] = clave;
      const im = caja.querySelector("img");
      if (especie) {
        const urls = PM.urlsSprite(especie, { espalda: l === "mia", shiny });
        im.style.visibility = "";
        im.dataset.urls = JSON.stringify(urls.slice(1));
        im.onerror = () => { const u = JSON.parse(im.dataset.urls || "[]"); if (u.length) { im.dataset.urls = JSON.stringify(u.slice(1)); im.src = u[0]; } else im.style.visibility = "hidden"; };
        im.src = urls[0]; im.alt = especie;
      }
    }
    caja.classList.toggle("vacia", !especie);
    if (entra && especie) reanima(caja.querySelector(".jg-pk-anim"), "sale");
  }
  /* Reinicia una animación de CSS: quitar la clase, forzar un reflow y
     volver a ponerla. */
  function reanima(el, clase) {
    if (!el) return;
    el.classList.remove(clase); void el.offsetWidth; el.classList.add(clase);
  }

  function ponFicha(l, d) {
    const f = $c(`.jg-pk-ficha.${l}`);
    if (!f) return;
    f.hidden = !d;
    if (!d) return;
    const v = d.v;
    f.querySelector(".n").textContent = d.nombre;
    f.querySelector(".lv").textContent = "Nv. " + d.nivel;
    f.querySelector(".st").innerHTML = d.estado ? `<span class="jg-pk-estado e-${esc(d.estado)}" title="${esc(ESTADOS[d.estado] || d.estado)}">${esc(CORTO_ESTADO[d.estado] || d.estado)}</span>` : "";
    const tipos = d.tipos.map(chipTipo).join("") + (d.tera ? `<span class="jg-pk-tera">Tera</span>` : "");
    const ti = f.querySelector(".jg-pk-tipos");
    if (ti.dataset.f !== tipos) { ti.dataset.f = tipos; ti.innerHTML = tipos; }
    const bar = f.querySelector(".jg-pk-vida i");
    bar.style.width = v + "%"; bar.style.background = colorVida(v);
    f.querySelector(".jg-pk-vnum").textContent = d.num;
    if (d.boosts != null) f.querySelector(".jg-pk-boosts").innerHTML = d.boosts;
    if (d.extra != null) f.querySelector(".ex").textContent = d.extra;
  }

  /* La escena según el estado final del simulador. Mientras corre la
     cola de animaciones no se toca: la cola lleva la escena paso a paso
     y al acabar llama aquí para dejarla exacta. */
  function pintaEscena(forzar) {
    const B = est.battle;
    if (!B) return;
    asegurarCampo();
    const me = yo() >= 0 ? yo() : 0, op = 1 - me;
    const S = B.sides;
    const rev = revelados();
    const quieta = !animando || forzar;
    const campo = $c("#pkCampo");
    const clima = B.field.weather ? toID(B.field.weather) : "", terreno = B.field.terrain ? toID(B.field.terrain) : "";
    if (quieta) { campo.dataset.clima = clima; campo.dataset.terreno = terreno; }
    const chips = [B.field.weather && B.field.getWeather().name, B.field.terrain && B.field.getTerrain().name].filter(Boolean);
    const cl = $c(".jg-pk-clima"); const fc = chips.join("|");
    if (cl.dataset.f !== fc) { cl.dataset.f = fc; cl.innerHTML = chips.map(x => `<span class="jg-pk-chip">${esc(x)}</span>`).join(""); }
    for (const i of [me, op]) {
      const l = pos(i), side = S[i], pk = side.active[0] && !side.active[0].fainted ? side.active[0] : null;
      const propio = i === yo();
      if (quieta) ponSprite(l, pk && pk.species.name, { shiny: !!(pk && pk.set && pk.set.shiny) });
      if (!quieta) { /* la cola lleva sprites y fichas */ }
      else if (pk) {
        const v = pct(pk.hp, pk.maxhp);
        const r = rev[i] && rev[i][pk.name];
        ponFicha(l, {
          nombre: pk.name, nivel: pk.level, estado: pk.status, v,
          tipos: pk.terastallized ? [pk.terastallized] : pk.getTypes(), tera: !!pk.terastallized,
          num: propio ? `${pk.hp} / ${pk.maxhp} PS` : `${v} %`,
          boosts: Object.entries(pk.boosts || {}).filter(([, n]) => n).map(([k, n]) => `<span class="jg-pk-boost ${n > 0 ? "sube" : "baja"}">${esc(STATS_CORTO[k] || k)} ${n > 0 ? "+" : ""}${n}</span>`).join(""),
          extra: propio ? `${pk.item ? pk.getItem().name : "Sin objeto"} · ${pk.getAbility().name}` : r ? [r.item, r.ability, [...r.moves].join(", ")].filter(Boolean).join(" · ") : ""
        });
      } else ponFicha(l, null);
      const conds = Object.keys(side.sideConditions || {}).map(k => `<span class="jg-pk-chip">${esc(B.dex.conditions.get(k).name || k)}</span>`).join("");
      const ent = `${htmlSkin(est.skins[est.lados[i]])}<b>${esc(i === yo() ? "Tú" : nombreLado(i))}</b>${bolas(side, propio, rev.vistos[i])}${conds}`;
      const eel = $c(`.jg-pk-entren.${l}`);
      if (eel.dataset.f !== ent) { eel.dataset.f = ent; eel.innerHTML = ent; }
    }
  }

  /* ---------- la cola de animaciones ----------
     Lo nuevo del registro se cuenta paso a paso: quien ataca se lanza,
     al golpeado le tiembla el sprite y le baja la barra al valor que dice
     esa línea, el crítico sacude el campo, el debilitado cae, el cambio
     sale de su Poké Ball. Lo que dice cada paso aparece en el cuadro de
     abajo, como en los juegos. El estado final ya está calculado: la cola
     solo lo enseña en orden, y al terminar `pintaEscena(true)` lo deja
     exacto. Una pestaña oculta, o un tramo de más de `MAX_PASOS`, salta
     al final sin animar. */
  const MAX_PASOS = 70;
  let animando = false, animDesde = -1, cola = [], reloj = 0, genAnim = 0;

  function decir(t) {
    const c = $c("#pkCuadro");
    if (!c || !t) return;
    c.innerHTML = `<p>${esc(t)}</p>`;
    reanima(c.firstElementChild, "aparece");
  }

  function pasos(lineas, i) {
    const me = yo() >= 0 ? yo() : 0;
    const nombres = est.lados.map((u, k) => (k === yo() ? "Tú" : nombreLado(k)));
    const D = PM.dexDe(p.formato);
    const lado = id => pos(Number(String(id).charAt(1)) - 1);
    const out = [];
    for (const l of lineas) {
      const c = l.split("|"), t = c[1];
      const txt = relata(l, yo(), nombres);
      const sinOrigen = !c.slice(4).some(x => x.startsWith("[from]"));
      if (t === "start") out.push({ ms: 2200, f: () => intro() });
      else if (t === "switch" || t === "drag" || t === "replace") {
        const L = lado(c[2]), det = c[3] || "", esp = det.split(",")[0], nv = (/, L(\d+)/.exec(det) || [, 100])[1];
        const [hp, st] = (c[4] || "100/100").split(" ");
        const [a, m] = hp.split("/").map(Number);
        const v = /fnt/.test(st || "") ? 0 : pct(a, m || 100);
        const sp = D.species.get(esp);
        out.push({ ms: 900, txt, f: () => {
          ponSprite(L, esp, { shiny: /shiny/.test(det), entra: true });
          ponFicha(L, { nombre: c[2].replace(/^p\d[a-z]?: /, ""), nivel: nv, estado: st && st !== "fnt" ? st : "", v,
            tipos: sp.exists ? sp.types : [], tera: false, num: L === "mia" && yo() >= 0 ? `${a} / ${m} PS` : `${v} %`, boosts: "", extra: "" });
          suena("ficha");
        } });
      } else if (t === "move") {
        const L = lado(c[2]), mv = D.moves.get(c[3]);
        const objetivo = c[4] && /^p\d/.test(c[4]) ? lado(c[4]) : "";
        const fallo = c.slice(4).includes("[miss]") || c.slice(4).includes("[still]");
        out.push({ ms: 700, txt, f: () => {
          const an = $c(`.jg-pk-spr.${L} .jg-pk-anim`);
          if (an) reanima(an, mv.category === "Status" ? "concentra" : "ataca");
          if (objetivo && objetivo !== L && mv.category !== "Status" && !fallo) {
            const fx = $c(`.jg-pk-spr.${objetivo} .jg-pk-fx`);
            if (fx) { fx.style.setProperty("--t", COLOR_TIPO[mv.type] || "#fff"); reanima(fx, "impacto"); }
          }
        } });
      } else if (t === "-damage" || t === "-heal" || t === "-sethp") {
        const L = lado(c[2]);
        const [hp, st] = (c[3] || "").split(" ");
        const [a, m0] = hp.split("/").map(Number);
        const m = m0 || 100;
        const v = /fnt/.test(st || "") || !a ? 0 : pct(a, m);
        out.push({ ms: t === "-damage" && sinOrigen ? 650 : 450, txt, f: () => {
          const f = $c(`.jg-pk-ficha.${L}`);
          if (f) {
            const bar = f.querySelector(".jg-pk-vida i");
            bar.style.width = v + "%"; bar.style.background = colorVida(v);
            f.querySelector(".jg-pk-vnum").textContent = L === "mia" && yo() >= 0 && m0 && m0 !== 100 ? `${a} / ${m0} PS` : `${v} %`;
          }
          if (t === "-damage") reanima($c(`.jg-pk-spr.${L} .jg-pk-anim`), sinOrigen ? "golpe" : "parpadea");
          else reanima($c(`.jg-pk-spr.${L} .jg-pk-fx`), "cura");
          if (t === "-damage" && sinOrigen) suena("golpe");
        } });
      } else if (t === "-crit") out.push({ ms: 500, txt, f: () => reanima($c("#pkCampo"), "sacude") });
      else if (t === "-supereffective") out.push({ ms: 550, txt, f: () => reanima($c("#pkCampo"), "destello") });
      else if (t === "faint") {
        const L = lado(c[2]);
        out.push({ ms: 900, txt, f: () => { reanima($c(`.jg-pk-spr.${L} .jg-pk-anim`), "cae"); suena("pierde"); } });
        out.push({ ms: 0, f: () => { ponSprite(L, ""); spritesVistos[L] = "ko"; ponFicha(L, null); } });
      } else if (t === "-boost" || t === "-unboost") {
        const L = lado(c[2]);
        out.push({ ms: 650, txt, f: () => reanima($c(`.jg-pk-spr.${L} .jg-pk-fx`), t === "-boost" ? "sube" : "baja") });
      } else if (t === "-terastallize") {
        const L = lado(c[2]);
        out.push({ ms: 1000, txt, f: () => { const fx = $c(`.jg-pk-spr.${L} .jg-pk-fx`); if (fx) { fx.style.setProperty("--t", COLOR_TIPO[c[3]] || "#9be7ff"); reanima(fx, "tera"); } suena("gana"); } });
      } else if (t === "-status") {
        const L = lado(c[2]);
        out.push({ ms: 600, txt, f: () => { const st = $c(`.jg-pk-ficha.${L} .st`); if (st) st.innerHTML = `<span class="jg-pk-estado e-${esc(c[3])}">${esc(CORTO_ESTADO[c[3]] || c[3])}</span>`; reanima($c(`.jg-pk-spr.${L} .jg-pk-fx`), "estado"); } });
      } else if (t === "-weather") {
        out.push({ ms: c.includes("[upkeep]") ? 350 : 700, txt, f: () => { const cp = $c("#pkCampo"); if (cp) cp.dataset.clima = c[2] === "none" ? "" : toID(c[2]); } });
      } else if (t === "turn") out.push({ ms: 250, txt });
      else if (t === "win" || t === "tie") out.push({ ms: 1200, txt });
      else if (txt) out.push({ ms: 450, txt });
    }
    return out;
  }

  function intro() {
    const it = $c(".jg-pk-intro");
    if (!it) return;
    const me = yo() >= 0 ? yo() : 0, op = 1 - me;
    it.innerHTML = `<div class="jg-pk-intro-ent suya">${htmlSkin(est.skins[est.lados[op]], "enorme")}<b>${esc(nombreLado(op))}</b></div>
      <div class="jg-pk-intro-vs">VS</div>
      <div class="jg-pk-intro-ent mia">${htmlSkin(est.skins[est.lados[me]], "enorme")}<b>${esc(yo() >= 0 ? "Tú" : nombreLado(me))}</b></div>`;
    it.hidden = false;
    decir(`¡${yo() >= 0 ? nombreLado(op) + " te desafía" : nombreLado(0) + " contra " + nombreLado(1)}!`);
    setTimeout(() => { if (it) it.hidden = true; }, 2100);
  }

  function anima() {
    if (!est.battle) return;
    const log = est.log;
    if (animDesde < 0 || animDesde > log.length) {
      // Primera vez: si la pelea acaba de empezar se cuenta desde el
      // principio (con la presentación); si ya iba avanzada, no.
      animDesde = local ? (local.desdeCero ? 0 : log.length) : est.punto <= 2 ? 0 : log.length;
    }
    if (log.length === animDesde) return;
    const nuevas = PM.lineasPara(log, yo() >= 0 ? yo() : -1, animDesde);
    animDesde = log.length;
    const ps = pasos(nuevas);
    if (!ps.length) return;
    if (document.hidden || (!local && ps.length + cola.length > MAX_PASOS)) {
      cola = []; animando = false; clearTimeout(reloj); genAnim++;
      pintaEscena(true);
      const ult = ps.filter(x => x.txt).pop();
      if (ult) decir(ult.txt);
      return;
    }
    cola.push(...ps);
    if (!animando) { animando = true; siguiente(genAnim); }
  }

  function siguiente(g) {
    if (muerto || g !== genAnim) return;
    const paso = cola.shift();
    if (!paso) {
      animando = false;
      firmas.pkControl = "";
      pinta();
      if (listo) listo();
      return;
    }
    try { if (paso.f) paso.f(); } catch (e) { /* un paso que falla no para la cola */ }
    if (paso.txt) decir(paso.txt);
    reloj = setTimeout(() => siguiente(g), paso.ms);
  }

  /* --- los botones del turno --- */
  function pintaControl() {
    const i = yo();
    if (i < 0) { set("pkControl", "mira", `<p class="jg-nota">Estás mirando el combate.</p>`); return; }
    const req = est.peticion[i];
    if (est.fase !== "jugando") { set("pkControl", "fin", ""); return; }
    // Como en los juegos: el menú vuelve cuando se acabó de contar el turno.
    if (animando) { set("pkControl", "anim", `<p class="jg-nota jg-pk-esperaanim">…</p>`); return; }
    if (local && local.palacio) { set("pkControl", "palacio", `<p class="jg-nota">En el Palacio tus Pokémon deciden solos, según su naturaleza y la vida que les queda.</p>`); return; }
    if (!est.decide[uid]) { set("pkControl", "nada" + est.punto, `<p class="jg-nota">Esperando a que ${esc(nombreLado(1 - i))} elija…</p>`); return; }
    if (est.prometido[uid]) {
      const pd = pendiente();
      set("pkControl", "hecho" + est.punto, `<p class="jg-pk-hecho">🔒 Elegiste <b>${esc(describe(pd && pd.c, req))}</b>. Se revela cuando ${esc(nombreLado(1 - i))} también elija.</p>`);
      return;
    }
    const firma = "req" + est.punto + JSON.stringify(toggles);
    if (req && req.teamPreview) {
      const eq = req.side.pokemon;
      set("pkControl", firma, `<h4>Vista previa: ¿quién sale primero?</h4><div class="jg-pk-cambios">${eq.map((pk, k) => {
        const nom = pk.details.split(",")[0];
        return `<button class="jg-pk-cambio" data-c="team ${[k + 1, ...eq.map((_, j) => j + 1).filter(j => j !== k + 1)].join("")}">${img(nom, { clase: "mini", fijo: true })}<b>${esc(nom)}</b></button>`;
      }).join("")}</div>${previaRival()}`);
      return;
    }
    if (!req) { set("pkControl", firma, ""); return; }
    const ops = PM.opciones(req);
    const D = PM.dexDe(p.formato);
    const B = est.battle, rival = B.sides[1 - i].active[0];
    const tiposRival = rival && !rival.fainted ? (rival.terastallized ? [rival.terastallized] : rival.getTypes()) : null;
    let movs = "";
    if (!req.forceSwitch && req.active && req.active[0]) {
      const a = req.active[0];
      const extras = [a.canTerastallize && ["tera", `Tera ${TIPOS[a.canTerastallize] || a.canTerastallize}`], a.canMegaEvo && ["mega", "Megaevolucionar"], a.canDynamax && ["dynamax", "Dinamax"], a.canZMove && ["z", "Movimiento Z"]].filter(Boolean);
      movs = `<div class="jg-pk-movs">${a.moves.map((m, k) => {
        const mv = D.moves.get(m.id);
        const tipo = mv.exists ? mv.type : "Normal";
        const ef = tiposRival && mv.exists && mv.category !== "Status" ? PM.tipoEficacia(tipo, tiposRival, p.formato) : null;
        const efTxt = ef === null ? "" : ef === 0 ? "No afecta" : ef >= 4 ? "×4" : ef === 2 ? "×2" : ef === 0.5 ? "×½" : ef <= 0.25 ? "×¼" : "";
        const cat = mv.category === "Physical" ? "Físico" : mv.category === "Special" ? "Especial" : "Estado";
        return `<button class="jg-pk-mov" style="--t:${COLOR_TIPO[tipo] || "#888"}" data-mov="${k + 1}"${m.disabled ? " disabled" : ""} title="${esc(mv.shortDesc || mv.desc || "")}">
          <b>${esc(m.move)}</b><small>${esc(TIPOS[tipo] || tipo)} · ${cat}${mv.basePower ? " · " + mv.basePower : ""}</small>
          <span class="pp">${m.pp != null ? `${m.pp}/${m.maxpp}` : ""}</span>${efTxt ? `<span class="ef ef${String(ef).replace(".", "")}">${efTxt}</span>` : ""}</button>`;
      }).join("")}</div>
      ${extras.length ? `<div class="jg-pk-extras">${extras.map(([k, t]) => `<label><input type="checkbox" data-tog="${k}"${toggles[k] ? " checked" : ""}> ${esc(t)}</label>`).join("")}</div>` : ""}`;
    }
    const cambios = ops.filter(o => o.cambio != null);
    const sw = cambios.length ? `<h4>${req.forceSwitch ? "Elige quién sale" : "Cambiar"}</h4><div class="jg-pk-cambios">${cambios.map(o => {
      const pk = req.side.pokemon[o.cambio];
      const nom = pk.details.split(",")[0];
      const [hp, max] = pk.condition.split(" ")[0].split("/").map(Number);
      const v = pct(hp, max);
      return `<button class="jg-pk-cambio" data-c="${o.c}">${img(nom, { clase: "mini", fijo: true })}<b>${esc(nom)}</b><i style="--v:${v}%;--col:${colorVida(v)}"></i></button>`;
    }).join("")}</div>` : (req.active && req.active[0] && req.active[0].trapped ? `<p class="jg-nota">Está atrapado: no puede cambiar.</p>` : "");
    set("pkControl", firma, movs + sw);
  }

  function previaRival() {
    const i = yo(), B = est.battle;
    if (!B) return "";
    const S = B.sides[1 - i];
    return `<h4>El equipo de ${esc(nombreLado(1 - i))}</h4><div class="jg-pk-cambios">${S.pokemon.map(pk => `<span class="jg-pk-cambio quieto">${img(pk.species.name, { clase: "mini", fijo: true })}<b>${esc(pk.species.name)}</b></span>`).join("")}</div>`;
  }

  function describe(c, req) {
    if (!c) return "tu jugada";
    const m = /^move (\d)/.exec(c);
    if (m && req && req.active && req.active[0]) return req.active[0].moves[m[1] - 1].move + (/terastallize/.test(c) ? " (Tera)" : /mega/.test(c) ? " (Mega)" : /dynamax/.test(c) ? " (Dinamax)" : /zmove/.test(c) ? " (Z)" : "");
    const s = /^switch (\d)/.exec(c);
    if (s && req && req.side) return "cambiar a " + req.side.pokemon[s[1] - 1].details.split(",")[0];
    if (/^team/.test(c)) return "el orden del equipo";
    return c;
  }

  /* --- el relato --- */
  function pintaRelato() {
    const el = host && host.querySelector("#pkRelato");
    if (!el) return;
    const i = yo();
    if (relatoYo !== i || est.log.length < lineasVistas) { el.innerHTML = ""; lineasVistas = 0; relatoYo = i; }
    if (est.log.length === lineasVistas) return;
    const nuevas = PM.lineasPara(est.log, i, lineasVistas);
    lineasVistas = est.log.length;
    const txt = relataTodo(nuevas, i, est.lados.map((u, k) => (k === i ? "Tú" : nombreLado(k))));
    if (!txt.length) return;
    const abajo = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.insertAdjacentHTML("beforeend", txt.map(t => `<p class="${t.startsWith("—") ? "turno" : t.startsWith("🏆") ? "gana" : ""}">${esc(t)}</p>`).join(""));
    if (abajo) el.scrollTop = el.scrollHeight;
  }

  function pintaPie() {
    let t;
    if (est.fase === "fin") t = "Combate terminado.";
    else if (aviso) t = aviso;
    else if (Object.keys(est.falsas || {}).length) t = "⚠️ Llegó una revelación que no casa con lo prometido: no cuenta, y la mesa espera la buena.";
    else t = local ? "" : juego() ? "Las elecciones se revelan solas cuando los dos han elegido." : "";
    set("pkPie", t, t ? `<span class="jg-nota">${esc(t)}</span>` : "");
  }

  /* ---------- eventos ---------- */
  function alCambio(ev) {
    const el = ev.target;
    if (el.name === "pkEq") { elegido = el.value; pinta(); }
    if (el.dataset.tog) { toggles[el.dataset.tog] = el.checked; firmas.pkControl = ""; pintaControl(); }
  }

  function alClic(ev) {
    const b = ev.target.closest("button");
    if (!b || !est) return;
    if (b.dataset.x === "equipos") {
      abreEquipos({ uid, formato: p && p.formato, alCerrar: d => { equipos = d; skin = skinSana(d.skin); firmas.pkEscena = ""; pinta(); } });
      return;
    }
    if (b.dataset.x === "salta") {
      if (animando) { cola = []; genAnim++; clearTimeout(reloj); pintaEscena(true); siguiente(genAnim); }
      return;
    }
    if (b.dataset.x === "rinde") {
      if (!rindeArmado) { rindeArmado = 1; setTimeout(() => { rindeArmado = 0; if (!muerto) { firmas.pkBotones = ""; pinta(); } }, 3000); pinta(); return; }
      rindeArmado = 0;
      if (local) local.rinde(); else jugar({ t: "rinde", uid });
      return;
    }
    if (!juego()) return;
    if (b.dataset.eq) {
      if (b.classList.contains("mal")) return;
      elegido = b.dataset.eq; firmas.pkEscena = ""; pinta();
      return;
    }
    if (b.dataset.skin) {
      skin = skinSana(b.dataset.skin);
      firmas.pkEscena = ""; pinta();
      return;
    }
    if (b.dataset.x === "listo" && est.fase === "equipos" && !est.prometido[uid]) {
      const e = equipos && equipos.equipos[elegido];
      if (!e) return;
      b.disabled = true;
      promete(e.eq, skin);
      return;
    }
    if (est.fase !== "jugando" || !est.decide[uid] || est.prometido[uid]) return;
    let c = b.dataset.c || "";
    if (b.dataset.mov) {
      c = "move " + b.dataset.mov;
      const a = est.peticion[yo()] && est.peticion[yo()].active && est.peticion[yo()].active[0];
      if (a && toggles.tera && a.canTerastallize) c += " terastallize";
      else if (a && toggles.mega && a.canMegaEvo) c += " mega";
      else if (a && toggles.dynamax && a.canDynamax) c += " dynamax";
      else if (a && toggles.z && a.canZMove && a.canZMove[b.dataset.mov - 1]) c += " zmove";
    }
    if (!c) return;
    toggles = { tera: false, mega: false, dynamax: false, z: false };
    suena("clic");
    promete(c);
  }

  /* ---------- actualizar ---------- */
  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (!PM) PM = motorListo();
    if (est && est.battle) {
      const caidas = est.log.reduce((n, l) => n + (l.startsWith("|faint|") ? 1 : 0), 0);
      if (est.ronda > turnoVisto && turnoVisto > 0) suena("ficha");
      if (caidas > caidasVistas && caidasVistas >= 0 && turnoVisto > 0) suena("golpe");
      turnoVisto = est.ronda; caidasVistas = caidas;
    }
    pinta();
    automatismos();
    if (!local && est && est.fase === "fin" && est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  /* El cartel del final espera a que se vea el último golpe. */
  return { montar, actualizar, destruir, ocupado: () => animando };
}
