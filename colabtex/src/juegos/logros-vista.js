/* La pestaña de Logros.
 *
 * Lo que tiene que contestar, en este orden: qué me falta y qué es lo
 * siguiente que puedo sacar (el «desafío», arriba, que es lo que da ganas
 * de volver a jugar), quién va delante de mí, y luego, juego a juego, los
 * diez logros con el porcentaje de jugadores que lo tiene y sus nombres.
 *
 * Todo sale de `watchLogros` (ranks + soloRanks + logros) pasado por
 * `reparto`, que no escribe nada: por eso los logros de la fila y los
 * individuales aparecen también para quien los ganó antes de que hubiera
 * logros. El porcentaje es sobre quienes han jugado ese juego alguna vez
 * (tienen fila, marca o algún logro en él), no sobre todo el sitio: un
 * 2 % de un juego que nadie abre no diría nada.
 */
import { JUEGOS } from "./motor.js";
import { LOGROS, reparto } from "./logros.js";
import { mezcla } from "./perfil.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const EXTRA = { minas: { nombre: "Mina Club", color: "#eeb765" }, snake: { nombre: "Snake Club", color: "#4be9bc" }, tetrisclub: { nombre: "Tetris Club", color: "#b04ee8" }, sortem: { nombre: "sortEm", color: "#ff006e" }, bbtan: { nombre: "BBTAN", color: "#c4f568" } };
const info = j => JUEGOS[j] || EXTRA[j] || { nombre: j, color: "#888" };
const MAX_NOMBRES = 8;

export function crearLogros({ uid, watchLogros, perfil, orden }) {
  let host = null, off = null, datos = null, fallo = null, firma = "";
  let juego = "";
  try { juego = localStorage.getItem("jg.logrosJuego") || ""; } catch (e) { /* sin almacenamiento */ }

  /* Los nombres: la fila de la clasificación o la marca los traen, y el
     perfil vivo se pone encima como en el resto de la sala. */
  const nombres = {};
  const nombreDe = u => {
    const n = mezcla({ uid: u, nombre: nombres[u] || "" }, perfil(u)).nombre;
    return n || "Jugador";
  };

  function calcula() {
    for (const filas of Object.values(datos.ranks || {})) for (const [u, f] of Object.entries(filas || {})) if (f && f.nombre) nombres[u] = f.nombre;
    for (const filas of Object.values(datos.solo || {})) for (const [u, f] of Object.entries(filas || {})) if (f && f.nombre && !nombres[u]) nombres[u] = f.nombre;
    const { tiene, gente } = reparto(datos.ranks, datos.solo, datos.logros);
    const juegos = (orden ? orden() : Object.keys(LOGROS)).filter(j => LOGROS[j]);
    for (const j of Object.keys(LOGROS)) if (!juegos.includes(j)) juegos.push(j);
    /* Cuántos tiene cada uno, por juego y en total. */
    const cuenta = {}, total = {};
    for (const j of juegos) {
      cuenta[j] = {};
      for (const s of Object.values(tiene[j])) for (const u of s) { cuenta[j][u] = (cuenta[j][u] || 0) + 1; total[u] = (total[u] || 0) + 1; }
    }
    return { tiene, gente, juegos, cuenta, total };
  }

  const pct = (j, id, R) => { const g = R.gente[j].size; return g ? Math.round(R.tiene[j][id].size * 100 / g) : 0; };
  const ranking = obj => Object.entries(obj).sort((a, b) => b[1] - a[1] || nombreDe(a[0]).localeCompare(nombreDe(b[0])));

  /* El desafío: el logro que más gente tiene y yo no (el más a mano),
     el más raro que alguien tiene (la joya), y quién va justo delante. */
  function desafio(R) {
    const faltan = [], joyas = [];
    for (const j of R.juegos) {
      if (!R.gente[j].size) continue;
      for (const x of LOGROS[j]) {
        const p = pct(j, x.id, R), mio = R.tiene[j][x.id].has(uid);
        if (!mio && R.gente[j].has(uid)) faltan.push({ j, x, p });
        if (R.tiene[j][x.id].size) joyas.push({ j, x, p, mio });
      }
    }
    faltan.sort((a, b) => b.p - a.p);
    joyas.sort((a, b) => a.p - b.p || a.x.n.localeCompare(b.x.n));
    const tabla = ranking(R.total), i = tabla.findIndex(([u]) => u === uid);
    const mios = R.total[uid] || 0;
    let delante = null;
    if (i > 0) delante = tabla[i - 1];
    else if (i < 0 && tabla.length) delante = tabla[tabla.length - 1];
    let robable = null;
    if (delante) {
      for (const j of R.juegos) for (const x of LOGROS[j])
        if (!robable && R.tiene[j][x.id].has(delante[0]) && !R.tiene[j][x.id].has(uid)) robable = { j, x };
    }
    const tarjeta = (t, cuerpo, cls = "") => `<div class="jg-lg-reto ${cls}"><small>${t}</small>${cuerpo}</div>`;
    const logroMini = (j, x, extra) => `<button class="jg-lg-mini" data-j="${j}"><span class="jg-lg-ico">${x.i}</span><span><b>${esc(x.n)}</b><em>${esc(info(j).nombre)} · ${esc(x.d)}</em>${extra}</span></button>`;
    return `<section class="jg-lg-desafio">
      <header><h2>🎯 Tu desafío</h2><p>Tienes <b>${mios}</b> de ${R.juegos.reduce((t, j) => t + LOGROS[j].length, 0)} logros${i >= 0 ? ` · puesto <b>#${i + 1}</b> de ${tabla.length}` : ""}.</p></header>
      <div class="jg-lg-retos">
        ${tarjeta("Lo siguiente", faltan[0] ? logroMini(faltan[0].j, faltan[0].x, `<i>El ${faltan[0].p} % ya lo tiene. ¿Y tú?</i>`) : "<p>Juega una partida de algo y aquí aparecerá tu próximo logro.</p>")}
        ${tarjeta("Rival a batir", delante ? `<div class="jg-lg-rival"><b>${esc(nombreDe(delante[0]))}</b><span>${delante[1]} logros · te saca ${Math.max(0, delante[1] - mios)}${delante[1] - mios <= 0 ? " (empate: desempata con uno más)" : ""}</span></div>${robable ? logroMini(robable.j, robable.x, "<i>Lo tiene; tú no.</i>") : ""}` : "<p>Vas primero. Defiende el trono sacando los raros.</p>", "rival")}
        ${tarjeta("La joya", joyas[0] ? logroMini(joyas[0].j, joyas[0].x, `<i>Solo el ${joyas[0].p} % lo tiene${joyas[0].mio ? " — y tú eres de ellos" : ""}.</i>`) : "<p>Nadie tiene aún ningún logro. El primero se lleva la gloria.</p>", "joya")}
      </div>
      <div class="jg-lg-podio">${ranking(R.total).slice(0, 5).map(([u, n], k) =>
        `<span class="${u === uid ? "yo" : ""}"><i>${["🥇", "🥈", "🥉", "4", "5"][k]}</i>${esc(nombreDe(u))}<b>${n}</b></span>`).join("") || "<em>Aún no hay nadie en la tabla de logros.</em>"}</div>
    </section>`;
  }

  function juegoHtml(R) {
    const j = juego, I = info(j), lista = LOGROS[j], g = R.gente[j].size;
    const lideres = ranking(R.cuenta[j]).slice(0, 3);
    const mios = lista.filter(x => R.tiene[j][x.id].has(uid)).length;
    return `<section class="jg-lg-juego" style="--c:${I.color}">
      <header><h2>${esc(I.nombre)}</h2><span>${mios}/10 tuyos · ${g} ${g === 1 ? "jugador" : "jugadores"}</span></header>
      <div class="jg-lg-lideres">${lideres.length ? lideres.map(([u, n], k) =>
        `<span class="${u === uid ? "yo" : ""}"><i>${["🥇", "🥈", "🥉"][k]}</i>${esc(nombreDe(u))} <b>${n}/10</b></span>`).join("") : "<em>Nadie tiene todavía ningún logro de este juego.</em>"}</div>
      <ol class="jg-lg-lista">${lista.map(x => {
        const s = R.tiene[j][x.id], p = pct(j, x.id, R), mio = s.has(uid);
        const quienes = [...s].sort((a, b) => (b === uid) - (a === uid) || nombreDe(a).localeCompare(nombreDe(b)));
        return `<li class="${mio ? "mio" : ""}">
          <span class="jg-lg-ico">${x.i}</span>
          <div class="jg-lg-txt">
            <b>${esc(x.n)}${x.m ? ` <em class="jg-lg-modo">${esc(x.m)}</em>` : ""}${mio ? ' <em class="jg-lg-ok">✓ tuyo</em>' : ""}</b>
            <span>${esc(x.d)}</span>
            <div class="jg-lg-quien">${quienes.slice(0, MAX_NOMBRES).map(u => `<i class="${u === uid ? "yo" : ""}">${esc(nombreDe(u))}</i>`).join("")}${quienes.length > MAX_NOMBRES ? `<i class="mas">+${quienes.length - MAX_NOMBRES}</i>` : ""}</div>
          </div>
          <div class="jg-lg-pct"><b>${p} %</b><span class="jg-lg-barra"><span style="width:${p}%"></span></span><small>${s.size} de ${g}</small></div>
        </li>`;
      }).join("")}</ol>
    </section>`;
  }

  function pinta() {
    if (!host) return;
    if (!datos) { host.innerHTML = `<p class="jg-nota">Cargando logros…</p>`; return; }
    const R = calcula();
    if (!LOGROS[juego]) juego = R.juegos.find(j => R.gente[j].has(uid)) || R.juegos[0];
    const aviso = fallo ? `<p class="jg-nota jg-aviso">No se pudieron leer los logros guardados (${esc(fallo.code || fallo.message || fallo)}). Si dice PERMISSION_DENIED, hay que volver a publicar las reglas en la consola de Firebase: <code>firebase/database.rules.json</code>. Los que salen de la clasificación se ven igual.</p>` : "";
    const f = JSON.stringify([juego, fallo && String(fallo.code || fallo), datos, R.juegos]) + R.juegos.map(j => [...R.gente[j]].map(nombreDe).join()).join("|");
    if (f === firma) return;
    firma = f;
    host.innerHTML = `<div class="jg-lg">
      ${aviso}
      ${desafio(R)}
      <nav class="jg-lg-chips" aria-label="Juego">${R.juegos.map(j => {
        const n = LOGROS[j].filter(x => R.tiene[j][x.id].has(uid)).length;
        return `<button class="jg-lg-chip${j === juego ? " on" : ""}" data-j="${j}" style="--c:${info(j).color}">${esc(info(j).nombre)}<small>${n}/10</small></button>`;
      }).join("")}</nav>
      ${juegoHtml(R)}
    </div>`;
    host.querySelectorAll("[data-j]").forEach(b => b.onclick = () => {
      juego = b.dataset.j;
      try { localStorage.setItem("jg.logrosJuego", juego); } catch (e) { /* nada */ }
      pinta();
      if (b.classList.contains("jg-lg-mini")) host.querySelector(".jg-lg-juego").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return {
    montar(el) {
      host = el;
      pinta();
      off = watchLogros((d, err) => { datos = d; fallo = err.logros || err.ranks || null; pinta(); });
    },
    refresca() { firma = ""; pinta(); },
    destruir() { if (off) off(); off = null; host = null; }
  };
}
