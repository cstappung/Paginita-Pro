/* Mario Kart Wii — los récords de tiempo en «Clasificaciones» (bitácora del juego §267).
 *
 * Qué es: la lista de pistas de Mario Kart Wii (Retro Rewind) con el mejor tiempo de cada una, el tuyo y su top 10,
 * dentro de la pestaña «Mario Kart Wii» de Clasificaciones (ranks.js pinta el interruptor «Récords | Sala», la tabla
 * elegida y el podio; este módulo arma los datos y pinta la lista con su buscador).
 *
 * De dónde salen los datos: la página del juego (juegos/mkw/web/navegador/records.mjs) escribe al terminar cada carrera
 * `mkw/records/<pista>-<tabla>/<uid>` = { uid, nombre, ms, pista, cat, at, … }: una fila por persona con SU mejor
 * tiempo (las reglas solo dejan escribir la propia y solo si mejora). La lectura es pública: aquí se lee el nodo entero.
 *   <pista> = el número de la pista en hexadecimal (0x100 + 4·copa + fila: 316 pistas, 79 copas de 4)
 *   <tabla> = el modo y la cilindrada: tt150/tt200 (Contrarreloj) y vs150/vs200/vs100/vs500/vsespejo (carrera entera)
 * Los nombres de las pistas y los íconos de las copas son del juego: no están en el sitio, se piden al Worker de amigos
 * (mkw.js `pistasMkw`). Sin ellos la pista se llama «Copa 12 · Pista 3».
 *
 * Lo que eligió el crítico (§267): solo las pistas que tienen algún tiempo, la más recién batida primero, 10 y «Ver
 * más»; cada fila es UN botón (el mando del sitio salta de botón en botón) y al tocarla se abre su top 10 debajo, una a
 * la vez. El buscador pide que TODAS las palabras aparezcan en la pista, su copa o algún piloto de ella; si una palabra
 * es un piloto, la fila muestra el tiempo de ese piloto. Como un tablero de alarmas: solo se encienden las luces que
 * tienen algo que decir, y al apretar una se ve el detalle de esa.
 *
 * La parte pura (tablasMkw, podioMkw, buscaMkw…) no toca el DOM: tests/mkw-records.test.cjs la carga en Node.
 */
import { normaliza, parecido } from "./buscador.js";

/* Las tablas, con el nombre corto que se ve en los botones. */
export const MKW_TABLAS = { tt150: "Contrarreloj 150cc", tt200: "Contrarreloj 200cc", vs150: "Carrera 150cc",
  vs200: "Carrera 200cc", vs100: "Carrera 100cc", vs500: "Carrera 500cc", vsespejo: "Carrera espejo" };
export const MKW_CARRERA = ["vs150", "vs200", "vs100", "vs500", "vsespejo"];
export const MKW_CC_CORTO = { vs150: "150cc", vs200: "200cc", vs100: "100cc", vs500: "500cc", vsespejo: "Espejo" };
export const MKW_PISTAS = 316;
const CLAVE = /^([0-9a-f]{3})-(tt150|tt200|vs150|vs200|vs100|vs500|vsespejo)$/;

/* 67873 ms → «1:07.873» (como el juego). */
export const tiempoMkw = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
/* La diferencia contra el récord: 412 → «+0.412», 61234 → «+1:01.234». */
export const difMkw = ms => ms <= 0 ? "récord" : "+" + (ms < 60000 ? (ms / 1000).toFixed(3) : tiempoMkw(ms));

/* Copa y fila de una pista (0-based), y su nombre. */
export const copaFila = id => ({ copa: (id - 0x100) >> 2, fila: (id - 0x100) & 3 });
export function nombrePistaMkw(id, nombres) {
  const { copa, fila } = copaFila(id);
  const n = nombres && nombres[copa] && nombres[copa][fila];
  return typeof n === "string" && n ? n : `Copa ${copa + 1} · Pista ${fila + 1}`;
}

/* El nodo `mkw/records` entero → { tabla: [ { id, clave, filas: [{uid, nombre, ms, at}] (de menor a mayor ms), ultimo } ] }
   cada tabla con sus pistas de la más recién batida a la más vieja. Lo que no tiene la forma de las reglas no entra
   (una fila vieja a medio escribir no rompe la lista); `vetado(uid)` = lo que el sitio ya esconde en todas las tablas. */
export function tablasMkw(raw, vetado = () => false) {
  const out = {};
  for (const [k, filasRaw] of Object.entries(raw || {})) {
    const m = CLAVE.exec(k);
    if (!m || !filasRaw || typeof filasRaw !== "object") continue;
    const filas = [];
    for (const [u, f] of Object.entries(filasRaw)) {
      if (!f || typeof f !== "object" || f.uid !== u || vetado(u)) continue;
      const ms = Number(f.ms);
      if (!Number.isFinite(ms) || ms < 5000 || ms > 3600000) continue;
      filas.push({ uid: u, nombre: String(f.nombre || "Piloto").slice(0, 20), ms: Math.round(ms), at: Number(f.at) || 0 });
    }
    if (!filas.length) continue;
    // a tiempos iguales gana el que llegó primero (como el récord del juego: igualarlo no lo quita)
    filas.sort((a, b) => a.ms - b.ms || a.at - b.at || a.uid.localeCompare(b.uid));
    const id = parseInt(m[1], 16);
    (out[m[2]] || (out[m[2]] = [])).push({ id, clave: k, filas, ultimo: Math.max(...filas.map(f => f.at)) });
  }
  for (const l of Object.values(out)) l.sort((a, b) => b.ultimo - a.ultimo || a.id - b.id);
  return out;
}

/* Las cilindradas de carrera que tienen al menos un tiempo (las vacías no se ofrecen). */
export const carrerasConDatos = t => MKW_CARRERA.filter(c => t && t[c] && t[c].length);

/* El podio de una tabla: quién tiene más récords (1.º puestos), luego más 2.º y 3.º. Filas con la forma del resto de
   las clasificaciones: puntos = récords. */
export function podioMkw(pistas) {
  const q = new Map();
  for (const p of pistas || []) p.filas.slice(0, 3).forEach((f, i) => {
    const r = q.get(f.uid) || { uid: f.uid, nombre: f.nombre, oro: 0, plata: 0, bronce: 0, pistas: 0 };
    r[["oro", "plata", "bronce"][i]]++;
    q.set(f.uid, r);
  });
  for (const p of pistas || []) for (const f of p.filas) { const r = q.get(f.uid); if (r) r.pistas++; }
  return [...q.values()].map(r => ({ ...r, puntos: r.oro }))
    .sort((a, b) => b.oro - a.oro || b.plata - a.plata || b.bronce - a.bronce || b.pistas - a.pistas || a.uid.localeCompare(b.uid))
    .filter(r => r.oro > 0);
}

/* ¿La palabra buscada `w` está en este texto? (tildes y mayúsculas fuera; principio de palabra, un tipeo en las
   largas, o metida en otra de 3 letras o más, como el buscador del salón) */
const tokens = t => normaliza(t).split(" ").filter(Boolean);
const enTokens = (w, ts) => /^\d+$|#/.test(w) ? ts.includes(w) : ts.some(t => parecido(w, t) >= 0.3);

/* Buscar: consulta → { lista, sin, piloto, total }.
   lista = las pistas con tiempo en que TODAS las palabras aparecen (en el nombre de la pista, «copa N» o algún piloto
   de ella); sin = hasta 5 pistas sin tiempo cuyo nombre coincide (para «¿qué pistas faltan?»); piloto = el uid del
   piloto que nombró la búsqueda (la fila muestra su tiempo en vez del tuyo), o "". Sin consulta: todas, sin «sin». */
export function buscaMkw(pistas, consulta, { nombres = null, total = MKW_PISTAS, maxSin = 5 } = {}) {
  // «copa 12» va junto: es la copa 12, no «copa» y un 12 cualquiera (el de «Mario Circuit 12»)
  const ws = tokens(consulta).join(" ").replace(/\bcopa (\d+)\b/g, "copa#$1").split(" ").filter(Boolean);
  pistas = pistas || [];
  if (!ws.length) return { lista: pistas, sin: [], piloto: "", palabras: ws };
  const nombreReal = id => { const { copa, fila } = copaFila(id); const n = nombres && nombres[copa] && nombres[copa][fila]; return typeof n === "string" ? n : ""; };
  const deLaPista = id => { const { copa } = copaFila(id); return [...tokens(nombreReal(id)), "copa", `copa#${copa + 1}`]; };
  // un piloto nombrado: la palabra coincide con su nombre de verdad (principio de palabra o igual), no solo por estar dentro
  let piloto = "";
  for (const p of pistas) for (const f of p.filas) {
    if (piloto) break;
    const ts = tokens(f.nombre);
    if (ws.some(w => ts.some(t => parecido(w, t) >= 0.85))) piloto = f.uid;
  }
  const lista = pistas.filter(p => {
    const t = deLaPista(p.id), pil = p.filas.flatMap(f => tokens(f.nombre));
    return ws.every(w => enTokens(w, t) || enTokens(w, pil));
  });
  const sin = [];
  if (nombres) {
    const tienen = new Set(pistas.map(p => p.id));
    for (let id = 0x100; id < 0x100 + total && sin.length < maxSin; id++)
      if (!tienen.has(id) && ws.every(w => enTokens(w, deLaPista(id)))) sin.push(id);
  }
  return { lista, sin, piloto, palabras: ws };
}

/* Tu puesto en una pista (−1 si no la corriste) y la fila que se muestra a la derecha: la tuya, o la del piloto buscado. */
export const puestoDe = (p, u) => p.filas.findIndex(f => f.uid === u);

/* Los filtros del buscador (pedido del dueño): dos grupos, como dos selectores de un tablero.
   - «Tú» (MKW_MIO): todas, las que tienes el récord, las que corriste, las que te faltan (con tiempo de otros, sin el tuyo).
   - «Consola»: de qué juego viene la pista, por el principio de su nombre en Retro Rewind («SNES …», «Wii U …»). Solo
     con los nombres (sin el Worker no se sabe) y solo las consolas que tienen alguna pista en la tabla elegida. */
export const MKW_MIO = { todas: "Todas", record: "🥇 Mis récords", corridas: "Corridas", faltan: "Me faltan" };
const CONSOLAS = ["Wii U", "SW2", "SW", "Tour", "RMX", "GP", "SNES", "N64", "GBA", "GCN", "DS", "3DS", "Wii"];
export function consolaMkw(nombre) {
  const n = String(nombre || "");
  return CONSOLAS.find(c => n === c || n.startsWith(c + " ")) || "";
}
/* Las consolas presentes en una tabla, en el orden de la historia de Mario Kart, con cuántas pistas tiene cada una. */
const ORDEN_CONSOLA = ["SNES", "N64", "GBA", "GCN", "DS", "Wii", "3DS", "Wii U", "SW", "SW2", "Tour", "GP", "RMX"];
export function consolasDe(pistas, nombres) {
  if (!nombres) return [];
  const q = new Map();
  for (const p of pistas || []) { const c = consolaMkw(nombrePistaMkw(p.id, nombres)); if (c) q.set(c, (q.get(c) || 0) + 1); }
  return ORDEN_CONSOLA.filter(c => q.has(c)).map(c => ({ c, n: q.get(c) }));
}
export function filtraMkw(pistas, { mio = "todas", consola = "" } = {}, uid = "", nombres = null) {
  return (pistas || []).filter(p => {
    const i = puestoDe(p, uid);
    if (mio === "record" && i !== 0) return false;
    if (mio === "corridas" && i < 0) return false;
    if (mio === "faltan" && i >= 0) return false;
    if (consola && nombres && consolaMkw(nombrePistaMkw(p.id, nombres)) !== consola) return false;
    return true;
  });
}

/* ---------------------------------- la vista ---------------------------------- */

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const POR_PAGINA = 10;

/* crearListaMkw({ uid, foto(f, tam), nombreHtml(uid, txt), fantasma(clave, uid) → Promise<Uint8Array|null> })
   → { montar(el), datos(tablas), pistas({nombres, icono(copa) → url}), tabla(cat), pintar(), destruir() }.
   ranks.js le pasa las tablas (de `watchMkwRecords`) y le dice qué tabla mirar; el resto lo decide aquí. */
export function crearListaMkw(ctx) {
  const { uid } = ctx;
  let el = null, tablas = {}, cat = "tt150", nombres = null, icono = null;
  let consulta = "", abierta = "", mostrar = POR_PAGINA, firma = "", reloj = 0, cargando = true, fallo = "";
  // los filtros: { mio, consola }; el panel de filtros se abre con su botón (cerrado no ocupa lugar)
  let filtro = { mio: "todas", consola: "" }, verFiltros = false;
  try { consulta = sessionStorage.getItem("jg.mkwBusca") || ""; filtro = Object.assign(filtro, JSON.parse(sessionStorage.getItem("jg.mkwFiltro") || "{}")); } catch (e) { /* sin almacenamiento */ }
  if (!MKW_MIO[filtro.mio]) filtro.mio = "todas";

  function montar(donde) {
    el = donde;
    el.innerHTML = `<div class="jg-mkr">
      <div class="jg-mkr-arriba">
        <div class="jg-mkr-busca"><span aria-hidden="true">🔍</span>
          <input type="search" id="mkrBusca" placeholder="Buscar pista o piloto…" enterkeyhint="search" autocomplete="off"
            spellcheck="false" aria-label="Buscar pista o piloto" value="${esc(consulta)}">
          <button type="button" class="jg-mkr-x" id="mkrX" aria-label="Borrar la búsqueda"${consulta ? "" : " hidden"}>✕</button></div>
        <button type="button" class="jg-mkr-filtrar" id="mkrFiltrar" aria-expanded="false" aria-controls="mkrFiltros">Filtros</button>
      </div>
      <div class="jg-mkr-filtros" id="mkrFiltros" hidden></div>
      <p class="jg-mkr-cuenta" id="mkrCuenta" aria-live="polite"></p>
      <div id="mkrLista"></div>
      <p class="jg-nota-larga" id="mkrNota"></p></div>`;
    const inp = el.querySelector("#mkrBusca");
    inp.addEventListener("input", () => {
      clearTimeout(reloj);
      reloj = setTimeout(() => { consulta = inp.value; guardar(); mostrar = POR_PAGINA; pintar(); }, 120);
    });
    // Enter o Escape sueltan el foco: el teclado del teléfono se cierra y el cursor del mando sale del campo
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); clearTimeout(reloj); consulta = inp.value; guardar(); pintar(); inp.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); if (inp.value) { inp.value = ""; consulta = ""; guardar(); pintar(); } inp.blur(); }
    });
    el.addEventListener("click", alClic);
    pintar();
  }
  const guardar = () => { try { sessionStorage.setItem("jg.mkwBusca", consulta); sessionStorage.setItem("jg.mkwFiltro", JSON.stringify(filtro)); } catch (e) { /* nada */ } };

  function alClic(ev) {
    if (ev.target.closest("#mkrFiltrar")) { verFiltros = !verFiltros; pintar(); return; }
    const fi = ev.target.closest("[data-mkr-f]");
    if (fi) {
      const k = fi.getAttribute("data-mkr-f"), v = fi.getAttribute("data-mkr-v");
      if (k === "limpiar") filtro = { mio: "todas", consola: "" };
      else filtro[k] = filtro[k] === v && k === "consola" ? "" : v;   // tocar la consola elegida la suelta
      mostrar = POR_PAGINA; abierta = ""; guardar(); pintar();
      const igual = el.querySelector(`[data-mkr-f="${k}"][data-mkr-v="${v}"]`) || el.querySelector("#mkrFiltrar");
      if (igual) igual.focus({ preventScroll: true });     // el cursor del mando se queda donde estaba
      return;
    }
    const x = ev.target.closest("#mkrX");
    if (x) { const inp = el.querySelector("#mkrBusca"); inp.value = ""; consulta = ""; guardar(); mostrar = POR_PAGINA; pintar(); inp.focus(); return; }
    const mas = ev.target.closest("[data-mkr-mas]");
    if (mas) {
      const antes = mostrar; mostrar += POR_PAGINA; pintar();
      // el cursor del mando (o el teclado) sigue en la fila 11, la primera de las nuevas: no salta arriba
      const nueva = el.querySelectorAll(".jg-mkr-fila")[antes];
      if (nueva) nueva.focus({ preventScroll: true });
      return;
    }
    const fan = ev.target.closest("[data-mkr-fantasma]");
    if (fan) { bajarFantasma(fan); return; }
    const f = ev.target.closest("[data-mkr-pista]");
    if (f) {
      const k = f.getAttribute("data-mkr-pista");
      abierta = abierta === k ? "" : k;
      pintar();
      const otra = el.querySelector(`[data-mkr-pista="${k}"]`);
      if (otra) { otra.focus({ preventScroll: true }); if (abierta) otra.parentElement.scrollIntoView({ block: "nearest" }); }
    }
  }

  async function bajarFantasma(b) {
    const k = b.getAttribute("data-mkr-fantasma"), u = b.getAttribute("data-mkr-de"), nom = b.getAttribute("data-mkr-nombre");
    if (!ctx.fantasma) return;
    b.disabled = true; const txt = b.textContent; b.textContent = "Bajando…";
    try {
      const bytes = await ctx.fantasma(k, u);
      if (!bytes) { b.textContent = "Sin fantasma"; return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      a.download = `${nom}.rkg`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      b.textContent = txt;
    } catch (e) { b.textContent = "No se pudo bajar"; }
    finally { setTimeout(() => { b.disabled = false; b.textContent = txt; }, 2500); }
  }

  const miniatura = id => {
    const { copa } = copaFila(id), u = icono && icono(copa);
    return u ? `<img class="jg-mkr-ico" src="${esc(u)}" alt="" loading="lazy">` : `<span class="jg-mkr-ico jg-mkr-ico-vacio" aria-hidden="true">🏁</span>`;
  };

  function filaHtml(p, piloto) {
    const nombre = nombrePistaMkw(p.id, nombres), { copa } = copaFila(p.id), r = p.filas[0];
    const quien = piloto || uid, i = puestoDe(p, quien), yo = !piloto;
    const lado = i < 0 ? `<span class="jg-mkr-tuyo jg-mkr-nada">${yo ? "Sin correr" : "—"}</span>`
      : `<span class="jg-mkr-tuyo${i === 0 ? " jg-mkr-oro" : ""}"><small>${yo ? "Tú" : esc(p.filas[i].nombre)} · #${i + 1}</small><b>${tiempoMkw(p.filas[i].ms)}</b><em>${difMkw(p.filas[i].ms - r.ms)}</em></span>`;
    const ab = abierta === p.clave;
    return `<li class="jg-mkr-item${ab ? " abierta" : ""}${i === 0 && yo ? " jg-mkr-mia" : ""}">
      <button type="button" class="jg-mkr-fila" data-mkr-pista="${p.clave}" aria-expanded="${ab}">
        ${miniatura(p.id)}
        <span class="jg-mkr-pista"><b translate="no">${esc(nombre)}</b><small>${nombres ? `Copa ${copa + 1} · ` : ""}${p.filas.length} ${p.filas.length === 1 ? "piloto" : "pilotos"}</small></span>
        <span class="jg-mkr-rec"><small>🥇 <span translate="no">${esc(r.nombre)}</span></small><b>${tiempoMkw(r.ms)}</b></span>
        ${lado}<i class="jg-mkr-flecha" aria-hidden="true">▾</i>
      </button>${ab ? detalle(p, nombre) : ""}</li>`;
  }

  function detalle(p, nombre) {
    const r = p.filas[0], top = p.filas.slice(0, 10), mia = puestoDe(p, uid);
    const fila = (f, i) => `<tr class="${f.uid === uid ? "jg-yo" : ""}${i < 3 ? " jg-rk-top" : ""}">
      <td class="jg-th-n">${i < 3 ? `<span class="jg-rk-med jg-rk-${["oro", "plata", "bronce"][i]}">${i + 1}</span>` : i + 1}</td>
      <td class="jg-jug" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre)}">${ctx.foto ? ctx.foto(f, 24) : ""}<span translate="no">${ctx.nombreHtml ? ctx.nombreHtml(f.uid, esc(f.nombre)) : esc(f.nombre)}${f.uid === uid ? " <b>(tú)</b>" : ""}</span></td>
      <td class="jg-num jg-mkr-t">${tiempoMkw(f.ms)}</td><td class="jg-num jg-mkr-d">${i ? difMkw(f.ms - r.ms) : ""}</td></tr>`;
    const extra = mia >= 10 ? `<tr class="jg-mkr-salto"><td colspan="4">…</td></tr>${fila(p.filas[mia], mia)}` : "";
    const fan = cat.startsWith("tt") && ctx.fantasma
      ? `<button type="button" class="btn2 jg-mkr-fan" data-mkr-fantasma="${p.clave}" data-mkr-de="${esc(r.uid)}" data-mkr-nombre="${esc(`${nombre} ${tiempoMkw(r.ms)} ${r.nombre}`.replace(/[\\/:*?"<>|]+/g, "-"))}">⬇ Fantasma del 1.º</button>
         <small>En la Contrarreloj el juego ya lo pone de rival; aquí solo se descarga.</small>` : "";
    return `<div class="jg-mkr-det"><div class="jg-tabla-caja"><table class="jg-tabla jg-mkr-tabla"><tbody>${top.map(fila).join("")}${extra}</tbody></table></div>
      ${p.filas.length > 10 ? `<p class="jg-mkr-sub">Y ${p.filas.length - 10} más.</p>` : ""}${fan ? `<div class="jg-mkr-pie">${fan}</div>` : ""}</div>`;
  }

  function pintar() {
    if (!el) return;
    const caja = el.querySelector("#mkrLista"), cuenta = el.querySelector("#mkrCuenta"), x = el.querySelector("#mkrX");
    if (x) x.hidden = !consulta;
    const pistas = tablas[cat] || [];
    // la consola elegida que ya no está en esta tabla se suelta (no deja la lista vacía sin decir por qué)
    const consolas = consolasDe(filtraMkw(pistas, { mio: filtro.mio }, uid, nombres), nombres);   // contadas con el filtro «Tú» puesto
    if (filtro.consola && !consolas.some(c => c.c === filtro.consola)) filtro.consola = "";
    const filtradas = filtraMkw(pistas, filtro, uid, nombres);
    const nFiltros = (filtro.mio !== "todas") + !!filtro.consola;
    const b = buscaMkw(filtradas, consulta, { nombres });
    // «Sin récord todavía» solo con «Todas»: con «Mis récords» o «Corridas» no tiene sentido; con la consola, de esa
    if (filtro.mio !== "todas") b.sin = [];
    else if (filtro.consola) b.sin = b.sin.filter(id => consolaMkw(nombrePistaMkw(id, nombres)) === filtro.consola);
    const busca = b.palabras.length > 0;
    const vis = busca ? b.lista : b.lista.slice(0, mostrar);
    let html;
    if (fallo) html = `<div class="jg-aviso">No se pueden leer los récords (<code>${esc(fallo)}</code>).</div>`;
    else if (cargando && !pistas.length) html = `<p class="jg-vacio">Cargando…</p>`;
    else if (!pistas.length) html = `<p class="jg-vacio">Nadie ha marcado un tiempo en ${esc(MKW_TABLAS[cat])}. Corre una y aparece aquí.</p>`;
    else {
      const porQue = busca ? `con «${esc(consulta)}»` : "";
      html = vis.length ? `<ul class="jg-mkr-lista">${vis.map(p => filaHtml(p, b.piloto && b.piloto !== uid ? b.piloto : "")).join("")}</ul>`
        : `<p class="jg-vacio">Ninguna pista ${porQue}${porQue && nFiltros ? " y " : ""}${nFiltros ? "con estos filtros" : ""}. ${nFiltros ? `<button type="button" class="btn2" data-mkr-f="limpiar" data-mkr-v="">Quitar los filtros</button>` : ""}</p>`;
      if (!busca && b.lista.length > mostrar) html += `<button type="button" class="btn2 jg-mkr-mas" data-mkr-mas>Ver más (${b.lista.length - mostrar})</button>`;
    }
    if (b.sin.length) html += `<div class="jg-mkr-sin"><b>Sin récord todavía</b><ul>${b.sin.map(id => `<li>${miniatura(id)}<span translate="no">${esc(nombrePistaMkw(id, nombres))}</span></li>`).join("")}</ul></div>`;
    const n = b.lista.length, conAlgo = busca || nFiltros;
    const cuentaTxt = conAlgo ? `${n} de ${pistas.length} ${pistas.length === 1 ? "pista" : "pistas"}`
      : pistas.length ? `${pistas.length} ${pistas.length === 1 ? "pista con tiempo" : "pistas con tiempo"} · la más reciente primero` : "";
    const nota = (nombres ? "" : "Los nombres de las pistas aparecen si tienes acceso al juego. ") +
      "Cada piloto tiene su mejor tiempo por pista y tabla; lo apunta el juego al cruzar la meta. A tiempos iguales, va primero quien llegó antes.";
    // el panel de filtros: «Tú» siempre; «Consola» solo si hay nombres y más de una consola en la tabla
    const seg = (k, ops) => `<div class="jg-rk-seg" role="group">${ops.map(([v, t]) =>
      `<button type="button" class="${filtro[k] === v ? "on" : ""}" aria-pressed="${filtro[k] === v}" data-mkr-f="${k}" data-mkr-v="${esc(v)}">${t}</button>`).join("")}</div>`;
    const panel = !verFiltros ? "" : `
      <div class="jg-mkr-fgrupo"><span>Tú</span>${seg("mio", Object.entries(MKW_MIO))}</div>
      ${consolas.length > 1 ? `<div class="jg-mkr-fgrupo"><span>Consola</span>${seg("consola", [["", "Todas"], ...consolas.map(c => [c.c, `${esc(c.c)} <small>${c.n}</small>`])])}</div>` : ""}
      ${nFiltros ? `<button type="button" class="jg-mkr-limpiar" data-mkr-f="limpiar" data-mkr-v="">Quitar los filtros</button>` : ""}`;
    // con el panel cerrado, lo elegido queda a la vista como pastillas (tocar una la quita)
    const pastillas = verFiltros || !nFiltros ? "" : [
      filtro.mio !== "todas" ? `<button type="button" class="jg-mkr-pastilla" data-mkr-f="mio" data-mkr-v="todas">${MKW_MIO[filtro.mio]} <b aria-label="quitar">✕</b></button>` : "",
      filtro.consola ? `<button type="button" class="jg-mkr-pastilla" data-mkr-f="consola" data-mkr-v="${esc(filtro.consola)}">${esc(filtro.consola)} <b aria-label="quitar">✕</b></button>` : ""].join("");
    const boton = `Filtros${nFiltros ? ` <b class="jg-mkr-n">${nFiltros}</b>` : ""}`;
    const f = JSON.stringify([html, cuentaTxt, nota, panel, pastillas, boton]);
    if (f === firma) return;          // por firma: los perfiles llegan de a uno y cada uno repinta
    firma = f;
    caja.innerHTML = html; el.querySelector("#mkrNota").textContent = nota;
    cuenta.innerHTML = `${pastillas}<span>${esc(cuentaTxt)}</span>`;
    const fp = el.querySelector("#mkrFiltros"), fb = el.querySelector("#mkrFiltrar");
    fp.innerHTML = panel; fp.hidden = !verFiltros;
    fb.innerHTML = boton; fb.setAttribute("aria-expanded", String(verFiltros)); fb.classList.toggle("on", verFiltros || nFiltros > 0);
  }

  return {
    montar,
    datos(t, err) { tablas = t || {}; cargando = false; fallo = err ? String(err.code || err.message || err) : ""; pintar(); },
    pistas(o) { nombres = (o && o.nombres) || null; icono = (o && o.icono) || null; pintar(); },
    tabla(c) { if (c !== cat) { cat = c; abierta = ""; mostrar = POR_PAGINA; } pintar(); },
    get tablas() { return tablas; },
    refresca() { firma = ""; pintar(); },
    destruir() { clearTimeout(reloj); if (el) { el.removeEventListener("click", alClic); el.innerHTML = ""; } el = null; },
  };
}

/* Los estilos del panel, del módulo (juegos.html no se toca); el tema oscuro con `html[data-tema=oscuro]`. */
const ESTILO = `
.jg-mkr{margin:0 auto 8px;max-width:920px}
.jg-mkr [hidden]{display:none!important}
.jg-mkr-arriba{display:flex;gap:8px;align-items:stretch}
.jg-mkr-arriba .jg-mkr-busca{flex:1;min-width:0}
.jg-mkr-filtrar{display:inline-flex;align-items:center;gap:6px;min-height:46px;padding:0 16px;border:1px solid #e2e8ec;border-radius:12px;background:#fff;font:inherit;font-weight:600;font-size:14px;color:#42505c;cursor:pointer}
.jg-mkr-filtrar::before{content:"";width:14px;height:10px;background:linear-gradient(currentColor,currentColor) 0 0/100% 2px no-repeat,linear-gradient(currentColor,currentColor) 50% 4px/64% 2px no-repeat,linear-gradient(currentColor,currentColor) 50% 8px/30% 2px no-repeat}
.jg-mkr-filtrar.on{border-color:#e60012;color:#e60012}
.jg-mkr-filtrar:focus-visible,.jg-mkr-pastilla:focus-visible,.jg-mkr-limpiar:focus-visible{outline:3px solid #e60012;outline-offset:2px}
.jg-mkr-n{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:10px;background:#e60012;color:#fff;font-size:11.5px}
.jg-mkr-filtros{--c:#e60012;margin:8px 0 0;padding:10px 12px;border:1px solid #e2e8ec;border-radius:12px;background:#fff;display:flex;flex-direction:column;gap:8px}
.jg-mkr-fgrupo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.jg-mkr-fgrupo>span{width:64px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8a97a3}
.jg-mkr-fgrupo .jg-rk-seg{flex-wrap:nowrap;overflow-x:auto;max-width:100%;scrollbar-width:none}
.jg-mkr-fgrupo .jg-rk-seg::-webkit-scrollbar{display:none}
.jg-mkr-fgrupo .jg-rk-seg button{min-height:36px;white-space:nowrap;flex:none}
.jg-mkr-fgrupo .jg-rk-seg small{color:#a8b3bd;font-weight:500;margin-left:2px}
.jg-mkr-limpiar{align-self:flex-start;border:0;background:none;padding:4px 0;color:#e60012;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.jg-mkr-cuenta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.jg-mkr-pastilla{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 10px;border:0;border-radius:15px;background:#fde8ea;color:#b4000e;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.jg-mkr-pastilla b{font-size:10px}
.jg-mkr-busca{display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #e2e8ec;border-radius:12px;background:#fff;min-height:46px}
.jg-mkr-busca:focus-within{border-color:#e60012;box-shadow:0 0 0 3px #e6001222}
.jg-mkr-busca input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:15px;padding:11px 0;color:inherit}
.jg-mkr-busca input::-webkit-search-cancel-button{display:none}
.jg-mkr-x{border:0;background:#eef2f5;border-radius:50%;width:30px;height:30px;cursor:pointer;color:#42505c;font-size:13px}
.jg-mkr-cuenta{margin:8px 2px 6px;font-size:12px;color:#8a97a3;min-height:16px}
.jg-mkr-lista{list-style:none;margin:0;padding:0;border:1px solid #e2e8ec;border-radius:12px;background:#fff;overflow:hidden}
.jg-mkr-item+.jg-mkr-item{border-top:1px solid #f0f4f6}
.jg-mkr-fila{display:grid;grid-template-columns:40px minmax(0,1fr) 9.5rem 8.5rem 14px;align-items:center;gap:12px;width:100%;min-height:64px;padding:8px 12px;border:0;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer}
.jg-mkr-fila:hover{background:#f7f9fa}
.jg-mkr-fila:focus-visible{outline:3px solid #3b82f6;outline-offset:-3px}
.jg-mkr-ico{width:40px;height:40px;border-radius:9px;object-fit:contain;background:#f3f5f7;display:grid;place-items:center;font-size:18px}
.jg-mkr-pista{display:flex;flex-direction:column;min-width:0}
.jg-mkr-pista b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px}
.jg-mkr-pista small,.jg-mkr-rec small,.jg-mkr-tuyo small{font-size:11.5px;color:#8a97a3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jg-mkr-rec,.jg-mkr-tuyo{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums;min-width:0}
.jg-mkr-rec b{font-size:14.5px}
.jg-mkr-tuyo{min-width:0}
.jg-mkr-tuyo b{font-size:13px;font-weight:600}
.jg-mkr-tuyo em{font-style:normal;font-size:11.5px;color:#c2410c}
.jg-mkr-tuyo.jg-mkr-oro em{color:#b7791f;font-weight:700}
.jg-mkr-nada{font-size:12px;color:#a8b3bd;align-items:flex-end;justify-content:center}
.jg-mkr-flecha{font-style:normal;color:#a8b3bd;transition:transform .15s}
.jg-mkr-item.abierta .jg-mkr-flecha{transform:rotate(180deg)}
.jg-mkr-item.abierta>.jg-mkr-fila{background:#f7f9fa;box-shadow:inset 3px 0 0 #e60012}
.jg-mkr-mia .jg-mkr-pista b::after{content:" ♛";color:#d69e2e}
.jg-mkr-det{padding:4px 12px 12px 64px}
.jg-mkr-det .jg-tabla-caja{margin:0}
.jg-mkr-tabla td{padding:7px 10px}
.jg-mkr-t{font-variant-numeric:tabular-nums;font-weight:600}
.jg-mkr-d{font-variant-numeric:tabular-nums;color:#8a97a3;font-size:12px}
.jg-mkr-salto td{text-align:center;color:#a8b3bd;padding:2px}
.jg-mkr-sub{margin:6px 2px 0;font-size:12px;color:#8a97a3}
.jg-mkr-pie{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
.jg-mkr-pie small{font-size:11.5px;color:#8a97a3}
.jg-mkr-fan{min-height:40px}
.jg-mkr-mas{display:block;margin:10px auto 0;min-height:44px;padding:0 22px}
.jg-mkr-sin{margin-top:14px;padding:10px 12px;border:1px dashed #d6dde3;border-radius:12px;color:#8a97a3}
.jg-mkr-sin b{font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.jg-mkr-sin ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.jg-mkr-sin li{display:flex;align-items:center;gap:10px;font-size:13.5px}
.jg-mkr-sin .jg-mkr-ico{width:28px;height:28px;font-size:13px;opacity:.7}
@media (max-width:560px){
  .jg-mkr-fila{grid-template-columns:40px minmax(0,1fr) auto;grid-template-areas:"ico pista rec" "ico tuyo tuyo";row-gap:2px;column-gap:10px}
  .jg-mkr-fila>.jg-mkr-ico{grid-area:ico;align-self:start}
  .jg-mkr-pista{grid-area:pista}.jg-mkr-rec{grid-area:rec}
  .jg-mkr-tuyo{grid-area:tuyo;flex-direction:row;gap:8px;align-items:baseline;justify-content:flex-start;min-width:0}
  .jg-mkr-flecha{display:none}
  .jg-mkr-fila{min-height:56px}
  .jg-mkr-nada{display:none}
  .jg-mkr{padding-bottom:88px}
  .jg-mkr-det{padding:4px 8px 12px}
}
@media (max-width:560px){.jg-mkr-fgrupo>span{width:100%}.jg-mkr-filtrar{padding:0 12px}}
html[data-tema=oscuro] .jg-mkr-filtrar,html[data-tema=oscuro] .jg-mkr-filtros{background:var(--os-sup);border-color:var(--os-borde);color:var(--os-tx2)}
html[data-tema=oscuro] .jg-mkr-pastilla{background:#e6001226;color:#ff8a93}
html[data-tema=oscuro] .jg-mkr-busca,html[data-tema=oscuro] .jg-mkr-lista{background:var(--os-sup);border-color:var(--os-borde)}
html[data-tema=oscuro] .jg-mkr-item+.jg-mkr-item{border-top-color:var(--os-borde)}
html[data-tema=oscuro] .jg-mkr-fila:hover{background:#ffffff08}
html[data-tema=oscuro] .jg-mkr-item.abierta>.jg-mkr-fila{background:#ffffff08}
html[data-tema=oscuro] .jg-mkr-ico{background:#ffffff10}
html[data-tema=oscuro] .jg-mkr-x{background:#ffffff14;color:inherit}
html[data-tema=oscuro] .jg-mkr-tuyo em{color:#fb923c}
html[data-tema=oscuro] .jg-mkr-sin{border-color:var(--os-borde)}
`;
export function ponEstiloMkr() {
  if (typeof document === "undefined" || document.getElementById("jg-mkr-estilo")) return;
  const s = document.createElement("style");
  s.id = "jg-mkr-estilo"; s.textContent = ESTILO;
  document.head.append(s);
}
