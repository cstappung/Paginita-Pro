/* «Mis equipos»: el editor de equipos de Pokémon.

   Es un modal colgado de `<body>`, como el manual de reglas, que se abre
   desde la tarjeta del juego en el vestíbulo o dentro de la sala antes de
   elegir equipo. Trabaja sobre el texto de Showdown («Import/Export»),
   que es lo que la gente ya tiene guardado y lo que publica Smogon: se
   puede pegar un equipo entero o armarlo campo a campo, y los dos caminos
   son el mismo objeto (`sets` de Showdown).

   Lo que sabe del juego —qué especies hay en esa generación, qué
   habilidades tiene cada una, qué movimientos aprende, qué objetos hay,
   las naturalezas y las estadísticas finales— lo pregunta al simulador
   (`PokeMotor`), así que es el mismo dato con el que luego se pelea. El
   validador también es el de Showdown, con sus mismos mensajes.

   Los equipos viven en `users/<uid>/pokemon/equipos`, del propio usuario,
   y una copia en `localStorage` por si la base tarda o falla: perder un
   equipo de seis bien afinado por un corte de red sería imperdonable. */
import * as fb from "../../fb-juegos.js";
import { cargaMotor } from "./carga.js";
import { TIPOS, COLOR_TIPO, STATS_CORTO } from "./relato.js";
import { ENTRENADORES, REGIONES, skinSana, htmlEntrenador } from "./entrenadores.js";
import { UID_INVITADO } from "../salon-datos.js";

/* El invitado (la Frontera sin cuenta) guarda sus equipos solo en este
   navegador: la base no le deja leer ni escribir, y preguntarle igual
   costaba ocho segundos de espera por lectura y un aviso de error por
   cada equipo guardado. */
const soloLocal = uid => uid === UID_INVITADO;

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
const LOCAL = uid => "pk.equipos." + uid;

export function leeLocal(uid) {
  try { return JSON.parse(localStorage.getItem(LOCAL(uid)) || "null") || null; } catch (e) { return null; }
}
function guardaLocal(uid, datos) {
  try { localStorage.setItem(LOCAL(uid), JSON.stringify(datos)); } catch (e) { /* sin almacenamiento: queda la base */ }
}

/* Los equipos y el entrenador de `uid`: lo de la base si llega, lo
   local si no. */
const conTope = (pr, ms) => new Promise((ok, mal) => {
  const t = setTimeout(() => mal(new Error("tiempo agotado")), ms);
  Promise.resolve(pr).then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); mal(e); });
});
export async function misEquipos(uid) {
  let d = null;
  /* Con tope: una lectura que no vuelve nunca (conexión a medias) dejaba
     la Frontera en «Abriendo las puertas…» y la sala en «Cargando tus
     equipos…» para siempre. Sin respuesta en 8 s vale la copia local. */
  if (!soloLocal(uid)) try { d = await conTope(fb.leerPokemon(uid), 8000); } catch (e) { d = null; }
  const local = leeLocal(uid);
  if (!d || (!d.equipos && local && local.equipos)) d = local || {};
  d.equipos = d.equipos || {};
  d.skin = skinSana(d.skin);
  guardaLocal(uid, d);
  return d;
}

/* Un set vacío, listo para rellenar. */
const setVacio = () => ({ name: "", species: "", item: "", ability: "", moves: [], nature: "Serious",
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 100, teraType: "", shiny: false });

/* Un sprite que, si falla, prueba la siguiente URL (ver `sprites`). */
function mini(PM, especie, clase = "") {
  const u = PM.urlsSprite(especie);
  return `<img class="${clase}" src="${esc(u[0])}" alt="${esc(especie)}" loading="lazy" data-urls="${esc(JSON.stringify(u.slice(1)))}">`;
}

function normaliza(set) {
  const v = setVacio();
  const s = Object.assign(v, set || {});
  s.evs = Object.assign(setVacio().evs, (set && set.evs) || {});
  s.ivs = Object.assign(setVacio().ivs, (set && set.ivs) || {});
  s.moves = ((set && set.moves) || []).slice(0, 4);
  return s;
}

export async function abreEquipos({ uid, formato = "", alCerrar } = {}) {
  const capa = document.createElement("div");
  capa.className = "jg-modal-capa jg-pk-capa";
  capa.innerHTML = `<div class="jg-pk-ed" role="dialog" aria-modal="true" aria-label="Mis equipos"><div class="jg-pk-cargando">Cargando el motor de Pokémon…</div></div>`;
  document.body.appendChild(capa);
  const caja = capa.firstElementChild;
  let PM;
  try { PM = await cargaMotor(); } catch (e) {
    caja.innerHTML = `<div class="jg-pk-cargando">${esc(e.message)}<br><button class="btn2" data-x="cerrar">Cerrar</button></div>`;
  }
  const datos = PM ? await misEquipos(uid) : { equipos: {}, skin: "red" };
  let sel = Object.keys(datos.equipos).sort((a, b) => (datos.equipos[b].at || 0) - (datos.equipos[a].at || 0))[0] || "";
  let sets = [], hueco = 0, sucio = false;
  let nombre = "", fmt = PM ? PM.formatoDe(formato) : "gen9ou";

  function carga(id) {
    sel = id;
    const e = datos.equipos[id];
    sets = e ? PM.desempaqueta(e.eq).map(normaliza) : [];
    nombre = e ? e.nombre : "";
    fmt = PM.formatoDe(e ? e.formato : formato);
    hueco = 0; sucio = false;
  }
  if (PM && sel) carga(sel);

  const cerrar = () => {
    if (sucio && !confirm("Hay cambios sin guardar. ¿Cerrar igual?")) return;
    capa.remove(); document.removeEventListener("keydown", tecla);
    if (alCerrar) alCerrar(datos);
  };
  const tecla = ev => { if (ev.key === "Escape") cerrar(); };
  document.addEventListener("keydown", tecla);
  capa.addEventListener("click", ev => { if (ev.target === capa) cerrar(); });
  caja.addEventListener("click", ev => { if (ev.target.closest("[data-x=cerrar]")) cerrar(); });
  if (!PM) return;

  const D = () => PM.dexDe(fmt);
  const gen = () => PM.genDe(fmt);
  const todo = () => /nationaldex|customgame/.test(fmt);
  const vale = x => x && x.exists && (todo() || !x.isNonstandard);

  /* Las listas para los <datalist>, por generación. */
  const listas = {};
  function lista(tipo) {
    const k = tipo + ":" + fmt;
    if (listas[k]) return listas[k];
    const d = D();
    let v = [];
    if (tipo === "especies") v = d.species.all().filter(s => vale(s) && s.num > 0 && s.gen <= gen()).map(s => s.name);
    if (tipo === "objetos") v = d.items.all().filter(i => vale(i) && i.gen <= gen()).map(i => i.name);
    v.sort();
    return (listas[k] = v);
  }

  function errores() {
    if (!sets.length) return ["El equipo está vacío."];
    return PM.valida(fmt, sets.filter(s => s.species));
  }

  /* ---------- pintar ---------- */
  function pinta() {
    const ids = Object.keys(datos.equipos).sort((a, b) => (datos.equipos[b].at || 0) - (datos.equipos[a].at || 0));
    const fila = id => {
      const e = datos.equipos[id];
      const ss = PM.desempaqueta(e.eq);
      return `<button class="jg-pk-eqfila${id === sel ? " on" : ""}" data-eq="${esc(id)}">
        <b>${esc(e.nombre || "Sin nombre")}</b><small>${esc(PM.FORMATOS[e.formato] || e.formato)}</small>
        <span class="jg-pk-minis">${ss.map(s => mini(PM, s.species)).join("")}</span>
      </button>`;
    };
    caja.innerHTML = `
      <header class="jg-pk-edcab"><h2>Mis equipos</h2>
        <div class="jg-pk-entsel" title="Tu entrenador">${htmlEntrenador(datos.skin, "chico")}
          <select data-x="skin" aria-label="Entrenador">${ENTRENADORES.map(e => `<option value="${e.id}"${e.id === datos.skin ? " selected" : ""}>${esc(e.n)} · ${REGIONES[e.g]}</option>`).join("")}</select></div>
        <button class="jg-pk-x" data-x="cerrar" aria-label="Cerrar">✕</button></header>
      <div class="jg-pk-edcuerpo">
        <aside class="jg-pk-eqlista">
          <div class="jg-pk-eqbotones"><button class="btn" data-x="nuevo">＋ Nuevo</button><button class="btn2" data-x="importar">Pegar de Showdown</button></div>
          ${ids.map(fila).join("") || `<p class="jg-nota">Aún no tienes equipos. Crea uno o pega el texto de un equipo exportado de Showdown o Smogon.</p>`}
        </aside>
        <section class="jg-pk-eqed">${sel || sets.length ? editor() : `<p class="jg-nota">Elige un equipo de la lista o crea uno nuevo.</p>`}</section>
      </div>`;
  }

  function editor() {
    const errs = errores();
    const huecos = Array.from({ length: 6 }, (_, i) => {
      const s = sets[i];
      return `<button class="jg-pk-hueco${i === hueco ? " on" : ""}" data-h="${i}">${s && s.species
        ? `${mini(PM, s.species)}<span>${esc(s.name || s.species)}</span>`
        : `<span class="jg-pk-mas">＋</span>`}</button>`;
    }).join("");
    return `
      <div class="jg-pk-edfila">
        <label>Nombre <input data-x="nombre" value="${esc(nombre)}" maxlength="60" placeholder="Mi equipo"></label>
        <label>Formato <select data-x="formato">${Object.entries(PM.FORMATOS).map(([k, v]) => `<option value="${k}"${k === fmt ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
      </div>
      <div class="jg-pk-huecos">${huecos}</div>
      ${sets[hueco] || hueco === sets.length ? editorSet(normaliza(sets[hueco])) : ""}
      <div class="jg-pk-valida ${errs.length ? "mal" : "bien"}">${errs.length
        ? `<b>No vale en ${esc(PM.FORMATOS[fmt])}:</b><ul>${errs.slice(0, 8).map(e => `<li>${esc(e)}</li>`).join("")}</ul>`
        : `<b>✓ Vale en ${esc(PM.FORMATOS[fmt])}.</b>`}</div>
      <div class="jg-pk-edacc">
        <button class="btn" data-x="guardar">Guardar</button>
        <button class="btn2" data-x="exportar">Exportar texto</button>
        ${sel ? `<button class="btn2" data-x="duplicar">Duplicar</button><button class="btn2 jg-pk-peligro" data-x="borrar">Borrar</button>` : ""}
      </div>`;
  }

  function editorSet(s) {
    const d = D();
    const sp = d.species.get(s.species);
    const habs = sp.exists ? [...new Set(Object.values(sp.abilities))] : [];
    const st = sp.exists ? PM.estadisticas(s, fmt) : null;
    const evTot = STATS.reduce((a, k) => a + (Number(s.evs[k]) || 0), 0);
    const nats = d.natures.all().sort((a, b) => a.name.localeCompare(b.name));
    const movs = sp.exists ? PM.aprende(s.species, fmt) : [];
    const tipos = Object.keys(TIPOS).filter(t => t !== "???" && (t !== "Stellar" || gen() >= 9));
    const chip = t => `<span class="jg-pk-tipo" style="--t:${COLOR_TIPO[t] || "#888"}">${esc(TIPOS[t] || t)}</span>`;
    return `
      <div class="jg-pk-set">
        <div class="jg-pk-setcab">
          ${sp.exists ? `<img class="jg-pk-setspr" src="${esc(PM.urlsSprite(s.species, { shiny: s.shiny })[0])}" alt="" data-urls="${esc(JSON.stringify(PM.urlsSprite(s.species, { shiny: s.shiny }).slice(1)))}">` : `<div class="jg-pk-setspr vacio">?</div>`}
          <div class="jg-pk-setdatos">
            <label>Especie <input data-c="species" list="pkEsp" value="${esc(s.species)}" placeholder="Garchomp" autocomplete="off"></label>
            <div class="jg-pk-tipos">${sp.exists ? sp.types.map(chip).join("") : ""}</div>
            <div class="jg-pk-edfila">
              <label>Apodo <input data-c="name" value="${esc(s.name)}" maxlength="18"></label>
              <label class="corto">Nivel <input data-c="level" type="number" min="1" max="100" value="${esc(s.level || 100)}"></label>
              <label class="corto">Shiny <input data-c="shiny" type="checkbox"${s.shiny ? " checked" : ""}></label>
            </div>
          </div>
        </div>
        <div class="jg-pk-edfila">
          <label>Objeto <input data-c="item" list="pkObj" value="${esc(s.item)}" autocomplete="off"></label>
          <label>Habilidad <select data-c="ability">${habs.map(h => `<option${h === s.ability ? " selected" : ""}>${esc(h)}</option>`).join("")}${s.ability && !habs.includes(s.ability) ? `<option selected>${esc(s.ability)}</option>` : ""}</select></label>
        </div>
        <div class="jg-pk-edfila">
          <label>Naturaleza <select data-c="nature">${nats.map(n => `<option value="${n.name}"${n.name === (s.nature || "Serious") ? " selected" : ""}>${esc(n.name)}${n.plus ? ` (+${STATS_CORTO[n.plus]} −${STATS_CORTO[n.minus]})` : ""}</option>`).join("")}</select></label>
          ${gen() >= 9 ? `<label>Tipo Tera <select data-c="teraType"><option value="">(su primer tipo)</option>${tipos.map(t => `<option value="${t}"${t === s.teraType ? " selected" : ""}>${esc(TIPOS[t])}</option>`).join("")}</select></label>` : ""}
        </div>
        <div class="jg-pk-movs">${[0, 1, 2, 3].map(i => {
          const m = d.moves.get(s.moves[i] || "");
          return `<label>Movimiento ${i + 1} <input data-m="${i}" list="pkMov" value="${esc(s.moves[i] || "")}" autocomplete="off">${m.exists ? `<small>${chip(m.type)} ${esc(m.category === "Status" ? "Estado" : m.category === "Physical" ? "Físico" : "Especial")}${m.basePower ? " · " + m.basePower : ""}${m.accuracy === true ? "" : " · " + m.accuracy + " %"}</small>` : ""}</label>`;
        }).join("")}</div>
        <table class="jg-pk-stats"><thead><tr><th></th><th>Base</th><th>EV</th><th>IV</th><th>Total</th></tr></thead><tbody>
          ${STATS.map(k => `<tr><th>${STATS_CORTO[k]}</th><td>${sp.exists ? sp.baseStats[k] : ""}</td>
            <td><input data-ev="${k}" type="number" min="0" max="252" step="4" value="${esc(s.evs[k] || 0)}"></td>
            <td><input data-iv="${k}" type="number" min="0" max="31" value="${esc(s.ivs[k] == null ? 31 : s.ivs[k])}"></td>
            <td><b>${st ? st[k] : ""}</b><i style="--w:${st ? Math.min(100, st[k] / 5) : 0}%"></i></td></tr>`).join("")}
        </tbody></table>
        <p class="jg-nota">EVs repartidos: <b class="${evTot > 510 ? "mal" : ""}">${evTot}</b> / 510 (máximo 252 por estadística).</p>
        <div class="jg-pk-edacc">${sets[hueco] ? `<button class="btn2 jg-pk-peligro" data-x="quitar">Quitar este Pokémon</button>` : ""}</div>
        <datalist id="pkEsp">${lista("especies").map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <datalist id="pkObj">${lista("objetos").map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <datalist id="pkMov">${movs.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      </div>`;
  }

  /* Repintar solo el editor, conservando el foco: si no, cada tecla en un
     EV se llevaría el cursor. */
  function repinta() {
    const ed = caja.querySelector(".jg-pk-eqed");
    if (!ed) { pinta(); return; }
    const a = document.activeElement;
    const clave = a && (a.dataset.c ? "c:" + a.dataset.c : a.dataset.m ? "m:" + a.dataset.m : a.dataset.ev ? "ev:" + a.dataset.ev : a.dataset.iv ? "iv:" + a.dataset.iv : a.dataset.x ? "x:" + a.dataset.x : "");
    const pos = a && typeof a.selectionStart === "number" ? a.selectionStart : null;
    ed.innerHTML = editor();
    if (clave) {
      const [t, v] = clave.split(":");
      const nuevo = ed.querySelector(`[data-${t}="${v}"]`);
      if (nuevo) { nuevo.focus(); try { if (pos != null) nuevo.setSelectionRange(pos, pos); } catch (e) {} }
    }
    sprites();
  }
  /* Los sprites que fallan prueban la siguiente URL. */
  function sprites() {
    caja.querySelectorAll("img[data-urls]").forEach(img => {
      img.onerror = () => {
        const resto = JSON.parse(img.dataset.urls || "[]");
        if (!resto.length) { img.onerror = null; img.style.visibility = "hidden"; return; }
        img.dataset.urls = JSON.stringify(resto.slice(1));
        img.src = resto[0];
      };
    });
  }

  /* ---------- cambios ---------- */
  function cambia(el) {
    const s = sets[hueco] ? sets[hueco] : (sets[hueco] = normaliza({}));
    if (el.dataset.c) {
      const k = el.dataset.c;
      if (k === "shiny") s.shiny = el.checked;
      else if (k === "level") s.level = Math.max(1, Math.min(100, Number(el.value) || 100));
      else s[k] = el.value;
      if (k === "species") {
        const sp = D().species.get(el.value);
        if (sp.exists) {
          s.species = sp.name;
          const habs = Object.values(sp.abilities);
          if (!habs.includes(s.ability)) s.ability = habs[0] || "";
          if (sp.requiredItem && !s.item) s.item = sp.requiredItem;
        }
      }
    } else if (el.dataset.m) {
      s.moves[Number(el.dataset.m)] = el.value;
      s.moves = s.moves.map(x => x || "");
    } else if (el.dataset.ev) s.evs[el.dataset.ev] = Math.max(0, Math.min(252, Number(el.value) || 0));
    else if (el.dataset.iv) s.ivs[el.dataset.iv] = Math.max(0, Math.min(31, Number(el.value) || 0));
    sets = sets.filter((x, i) => x && (x.species || i === hueco));
    sucio = true;
  }
  caja.addEventListener("change", ev => {
    const el = ev.target;
    if (el.dataset.x === "skin") {
      datos.skin = skinSana(el.value);
      guardaLocal(uid, datos);
      if (!soloLocal(uid)) fb.guardarSkinPk(uid, datos.skin).catch(() => {});
      pinta(); sprites(); return;
    }
    if (el.dataset.x === "nombre") { nombre = el.value; sucio = true; return; }
    if (el.dataset.x === "formato") { fmt = PM.formatoDe(el.value); sucio = true; repinta(); return; }
    if (el.dataset.c || el.dataset.m || el.dataset.ev || el.dataset.iv) { cambia(el); repinta(); }
  });

  caja.addEventListener("click", async ev => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.eq) {
      if (sucio && !confirm("Hay cambios sin guardar. ¿Cambiar de equipo igual?")) return;
      carga(b.dataset.eq); pinta(); sprites(); return;
    }
    if (b.dataset.h != null) { hueco = Math.min(Number(b.dataset.h), sets.length); repinta(); return; }
    const x = b.dataset.x;
    if (x === "nuevo") {
      if (sucio && !confirm("Hay cambios sin guardar. ¿Empezar otro igual?")) return;
      sel = ""; sets = []; nombre = "Equipo nuevo"; fmt = PM.formatoDe(formato); hueco = 0; sucio = true;
      pinta(); sprites();
    } else if (x === "importar") {
      const t = prompt("Pega aquí el equipo exportado de Showdown (Import/Export):");
      if (!t) return;
      const ss = PM.importa(t);
      if (!ss.length) { alert("No encontré ningún Pokémon en ese texto."); return; }
      sel = ""; sets = ss.slice(0, 6).map(normaliza); nombre = "Equipo importado"; fmt = PM.formatoDe(formato); hueco = 0; sucio = true;
      pinta(); sprites();
    } else if (x === "exportar") {
      const t = PM.exporta(sets.filter(s => s.species));
      try { await navigator.clipboard.writeText(t); alert("Copiado: pégalo en Showdown o guárdalo donde quieras."); }
      catch (e) { prompt("Copia el texto del equipo:", t); }
    } else if (x === "quitar") {
      sets.splice(hueco, 1); hueco = Math.max(0, Math.min(hueco, sets.length)); sucio = true; repinta();
    } else if (x === "guardar" || x === "duplicar") {
      const limpio = sets.filter(s => s.species);
      if (!limpio.length) { alert("Añade al menos un Pokémon."); return; }
      const id = x === "duplicar" || !sel ? fb.nuevoIdEquipo() : sel;
      const e = { nombre: (x === "duplicar" ? (nombre || "Equipo") + " (copia)" : nombre) || "Equipo", formato: fmt, eq: PM.empaqueta(limpio), at: Date.now() };
      datos.equipos[id] = e;
      guardaLocal(uid, datos);
      b.disabled = true;
      if (!soloLocal(uid)) try { await fb.guardarEquipoPk(uid, id, e); }
      catch (er) { alert("Se guardó en este navegador, pero no en tu cuenta: " + (er.message || er)); }
      carga(id); pinta(); sprites();
    } else if (x === "borrar") {
      if (!sel || !confirm(`¿Borrar «${datos.equipos[sel] && datos.equipos[sel].nombre}»?`)) return;
      delete datos.equipos[sel];
      guardaLocal(uid, datos);
      if (!soloLocal(uid)) fb.borrarEquipoPk(uid, sel).catch(() => {});
      sel = ""; sets = []; sucio = false; pinta();
    }
  });

  pinta(); sprites();
}
