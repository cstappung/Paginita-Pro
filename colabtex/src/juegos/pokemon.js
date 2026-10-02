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
import { relataTodo, TIPOS, COLOR_TIPO, ESTADOS, STATS_CORTO } from "./pokemon/relato.js";
import { ENTRENADORES, REGIONES, skinSana, htmlEntrenador, SKIN_POR } from "./pokemon/entrenadores.js";

const LATIDO_MS = 2000;
const REINTENTO_MS = 9000;

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chipTipo = t => `<span class="jg-pk-tipo" style="--t:${COLOR_TIPO[t] || "#888"}">${esc(TIPOS[t] || t)}</span>`;
const pct = (hp, max) => (max ? Math.max(0, Math.min(100, Math.ceil(hp / max * 100))) : 0);
const CORTO_ESTADO = { brn: "QUE", par: "PAR", slp: "DOR", frz: "CON", psn: "ENV", tox: "TÓX" };
const colorVida = p => (p > 50 ? "#3fd47a" : p > 20 ? "#f2c037" : "#ef5350");

export function crearPokemon(ctx) {
  const { uid, pid, jugar, terminar, mirando, secreto, rehaz } = ctx;
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
    if (!mirando) misEquipos(uid).then(d => { equipos = d; skin = skinSana(d.skin); if (!muerto) pinta(); }).catch(() => {});
    latido = setInterval(() => { if (!muerto) { automatismos(); } }, LATIDO_MS);
  }

  function destruir() {
    muerto = true;
    clearInterval(latido);
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
    if (!est || !PM || !juego()) return;
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
    pintaEscena();
    pintaControl();
    pintaRelato();
    pintaPie();
  }

  function pintaFase() {
    let t;
    const fmt = PM.FORMATOS[PM.formatoDe(p.formato)] || "";
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
    set("pkBotones", (puede ? "1" : "0") + rindeArmado + est.fase, `
      <button class="btn2" data-x="equipos">📋 Mis equipos</button>
      ${puede && est.fase === "jugando" ? `<button class="btn2 jg-pk-peligro" data-x="rinde">${rindeArmado ? "¿Seguro? Pulsa otra vez" : "🏳 Rendirse"}</button>` : ""}`);
  }

  /* --- elegir equipo y entrenador --- */
  function pintaEquipos() {
    const fmt = PM.formatoDe(p.formato);
    const invalidos = est.invalidos || {};
    if (!juego() || est.prometido[uid] || est.fase === "fin") {
      const lineas = est.lados.map((u, i) => {
        const estado = est.fase === "fin" ? (invalidos[u] ? "❌ Equipo no válido: " + invalidos[u].slice(0, 3).join(" · ") : "✓") : est.prometido[u] ? "🔒 Equipo elegido" : "Eligiendo…";
        return `<li><b>${esc(nombreLado(i))}</b> · ${esc(estado)}</li>`;
      }).join("");
      set("pkEscena", "eqv|" + JSON.stringify(est.prometido) + est.fase, `<div class="jg-pk-aviso"><ul class="jg-pk-lista">${lineas}</ul>
        <small>Los dos eligen a ciegas: lo elegido viaja cerrado y se abre cuando están los dos.</small></div>`);
      set("pkControl", "eqv", ""); set("pkRelato", "eqv", ""); set("pkPie", "eqv", "");
      return;
    }
    const lista = equipos ? Object.entries(equipos.equipos || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)) : null;
    const filas = (lista || []).map(([id, e]) => {
      const sets = PM.desempaqueta(e.eq);
      const errs = PM.valida(fmt, sets);
      return `<label class="jg-pk-eqop${errs.length ? " mal" : ""}${elegido === id ? " on" : ""}">
        <input type="radio" name="pkEq" value="${esc(id)}"${elegido === id ? " checked" : ""}${errs.length ? " disabled" : ""}>
        <b>${esc(e.nombre || "Equipo")}</b><small>${esc(PM.FORMATOS[e.formato] || e.formato)}</small>
        <span class="jg-pk-minis">${sets.map(s => img(s.species)).join("")}</span>
        ${errs.length ? `<em>No vale aquí: ${esc(errs[0])}</em>` : ""}</label>`;
    }).join("");
    const ents = ENTRENADORES.map(e => `<button class="jg-pk-entop${e.id === skin ? " on" : ""}" data-skin="${e.id}" title="${esc(e.n)} · ${REGIONES[e.g]}">${htmlEntrenador(e.id)}<small>${esc(e.n)}</small></button>`).join("");
    set("pkEscena", "eq|" + elegido + "|" + skin + "|" + (lista ? lista.map(x => x[0] + x[1].at).join() : "…"), `
      <div class="jg-pk-elige">
        <section><h3>Tu equipo <small>para ${esc(PM.FORMATOS[fmt])}</small></h3>
          ${lista === null ? `<p class="jg-nota">Cargando tus equipos…</p>` : filas || `<p class="jg-nota">No tienes equipos todavía. Ábrelos con «📋 Mis equipos»: puedes pegar uno exportado de Showdown.</p>`}
        </section>
        <section><h3>Tu entrenador</h3><div class="jg-pk-ents">${ents}</div></section>
        <button class="btn jg-pk-listo" data-x="listo"${elegido ? "" : " disabled"}>Listo: usar este equipo</button>
      </div>`);
    set("pkControl", "eq", ""); set("pkRelato", "eq", ""); set("pkPie", "eq", `<span class="jg-nota">El rival no verá tu equipo hasta que los dos hayáis elegido.</span>`);
  }

  /* --- el campo --- */
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

  function img(especie, { espalda = false, shiny = false, clase = "" } = {}) {
    const urls = PM.urlsSprite(especie, { espalda, shiny });
    return `<img class="${clase}" src="${esc(urls[0])}" alt="${esc(especie)}" data-urls="${esc(JSON.stringify(urls.slice(1)))}" onerror="var u=JSON.parse(this.dataset.urls||'[]');if(u.length){this.dataset.urls=JSON.stringify(u.slice(1));this.src=u[0]}else{this.onerror=null;this.style.visibility='hidden'}">`;
  }

  function ficha(pk, i, propio, rev) {
    if (!pk) return "";
    const v = pct(pk.hp, pk.maxhp);
    const tipos = pk.terastallized ? [pk.terastallized] : pk.getTypes ? pk.getTypes() : pk.species.types;
    const boosts = Object.entries(pk.boosts || {}).filter(([, n]) => n).map(([k, n]) => `<span class="jg-pk-boost ${n > 0 ? "sube" : "baja"}">${esc(STATS_CORTO[k] || k)} ${n > 0 ? "+" : ""}${n}</span>`).join("");
    const r = rev && rev[pk.name];
    const extra = propio
      ? `<small>${esc(pk.item ? pk.getItem().name : "Sin objeto")} · ${esc(pk.getAbility().name)}</small>`
      : r ? `<small>${esc([r.item, r.ability, [...r.moves].join(", ")].filter(Boolean).join(" · "))}</small>` : "";
    return `<div class="jg-pk-ficha ${propio ? "mia" : "suya"}">
      <div class="jg-pk-fnom"><b>${esc(pk.name)}</b><span>Nv. ${pk.level}</span>${pk.status ? `<span class="jg-pk-estado e-${esc(pk.status)}" title="${esc(ESTADOS[pk.status] || pk.status)}">${esc(CORTO_ESTADO[pk.status] || pk.status)}</span>` : ""}</div>
      <div class="jg-pk-tipos">${tipos.map(chipTipo).join("")}${pk.terastallized ? `<span class="jg-pk-tera">Tera</span>` : ""}</div>
      <div class="jg-pk-vida"><i style="width:${v}%;background:${colorVida(v)}"></i></div>
      <div class="jg-pk-vnum">${propio ? `${pk.hp} / ${pk.maxhp} PS` : `${v} %`}</div>
      ${boosts ? `<div class="jg-pk-boosts">${boosts}</div>` : ""}
      ${extra}
    </div>`;
  }

  /* El equipo de un lado en fila. Del rival solo se ven las especies
     que ya enseñó (vista previa o al salir al campo); las demás son una
     Poké Ball sin abrir. */
  function bolas(side, propio, vistos) {
    return `<div class="jg-pk-bolas">${side.pokemon.map(pk => {
      const v = pct(pk.hp, pk.maxhp);
      const visto = propio || vistos.has(pk.species.name) || vistos.has(pk.baseSpecies.name);
      return `<span class="jg-pk-bola${pk.fainted ? " ko" : ""}${pk.isActive ? " activo" : ""}" title="${visto ? esc(pk.species.name) + (pk.fainted ? " (debilitado)" : ` · ${v} %`) : "Sin revelar"}">${visto ? img(pk.species.name, { clase: "mini" }) : `<i class="jg-pk-ball"></i>`}</span>`;
    }).join("")}</div>`;
  }

  function pintaEscena() {
    const B = est.battle;
    if (!B) return;
    const me = yo() >= 0 ? yo() : 0, op = 1 - me;
    const S = B.sides;
    const act = i => S[i].active[0] && !S[i].active[0].fainted ? S[i].active[0] : null;
    const a = act(me), b = act(op);
    const rev = revelados();
    const clima = B.field.weather ? `<span class="jg-pk-chip">${esc(B.field.getWeather().name)}</span>` : "";
    const campo = B.field.terrain ? `<span class="jg-pk-chip">${esc(B.field.getTerrain().name)}</span>` : "";
    const lado = i => Object.keys(S[i].sideConditions || {}).map(k => `<span class="jg-pk-chip">${esc(B.dex.conditions.get(k).name || k)}</span>`).join("");
    const firma = [me, a && a.name + a.hp + a.status + JSON.stringify(a.boosts) + a.terastallized, b && b.name + b.hp + b.status + JSON.stringify(b.boosts) + b.terastallized,
      S.map(s => s.pokemon.map(x => x.hp + (x.fainted ? "k" : "")).join(",")).join("/"), B.field.weather, B.field.terrain,
      S.map(s => Object.keys(s.sideConditions).join(",")).join("/"), est.ronda, JSON.stringify(rev[op], (k, v) => v instanceof Set ? [...v] : v)].join("|");
    set("pkEscena", firma, `
      <div class="jg-pk-campo">
        <div class="jg-pk-clima">${clima}${campo}</div>
        <div class="jg-pk-rival">
          <div class="jg-pk-entren">${htmlEntrenador(est.skins[est.lados[op]] || SKIN_POR)}<b>${esc(nombreLado(op))}</b>${bolas(S[op], false, rev.vistos[op])}${lado(op)}</div>
          ${ficha(b, op, false, rev[op])}
          <div class="jg-pk-spr suya">${b ? img(b.species.name, { shiny: b.set && b.set.shiny, clase: "jg-pk-entra" }) : ""}</div>
        </div>
        <div class="jg-pk-mio">
          <div class="jg-pk-spr mia">${a ? img(a.species.name, { espalda: true, shiny: a.set && a.set.shiny, clase: "jg-pk-entra" }) : ""}</div>
          ${ficha(a, me, yo() >= 0, rev[me])}
          <div class="jg-pk-entren">${htmlEntrenador(est.skins[est.lados[me]] || SKIN_POR)}<b>${esc(yo() >= 0 ? "Tú" : nombreLado(me))}</b>${bolas(S[me], yo() >= 0, rev.vistos[me])}${lado(me)}</div>
        </div>
      </div>`);
  }

  /* --- los botones del turno --- */
  function pintaControl() {
    const i = yo();
    if (i < 0) { set("pkControl", "mira", `<p class="jg-nota">Estás mirando el combate.</p>`); return; }
    const req = est.peticion[i];
    if (est.fase !== "jugando") { set("pkControl", "fin", ""); return; }
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
        return `<button class="jg-pk-cambio" data-c="team ${[k + 1, ...eq.map((_, j) => j + 1).filter(j => j !== k + 1)].join("")}">${img(nom, { clase: "mini" })}<b>${esc(nom)}</b></button>`;
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
      return `<button class="jg-pk-cambio" data-c="${o.c}">${img(nom, { clase: "mini" })}<b>${esc(nom)}</b><i style="--v:${v}%;--col:${colorVida(v)}"></i></button>`;
    }).join("")}</div>` : (req.active && req.active[0] && req.active[0].trapped ? `<p class="jg-nota">Está atrapado: no puede cambiar.</p>` : "");
    set("pkControl", firma, movs + sw);
  }

  function previaRival() {
    const i = yo(), B = est.battle;
    if (!B) return "";
    const S = B.sides[1 - i];
    return `<h4>El equipo de ${esc(nombreLado(1 - i))}</h4><div class="jg-pk-cambios">${S.pokemon.map(pk => `<span class="jg-pk-cambio quieto">${img(pk.species.name, { clase: "mini" })}<b>${esc(pk.species.name)}</b></span>`).join("")}</div>`;
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
    else t = juego() ? "Las elecciones se revelan solas cuando los dos han elegido." : "";
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
    if (b.dataset.x === "rinde") {
      if (!rindeArmado) { rindeArmado = 1; setTimeout(() => { rindeArmado = 0; if (!muerto) { firmas.pkBotones = ""; pinta(); } }, 3000); pinta(); return; }
      rindeArmado = 0;
      jugar({ t: "rinde", uid });
      return;
    }
    if (!juego()) return;
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
    if (est && est.fase === "fin" && est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
