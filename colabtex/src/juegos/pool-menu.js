/* El menú de Pool: la barra de arriba, los tacos con sus cofres y el
   registro de cambios. Va en una capa sobre la partida (dentro de `host`,
   así que se va con la pantalla). Todo lo que toca monedas o perfil llega
   por `ctx.tacos` (juegos-main.js), que no existe para un espectador sin
   cuenta: sin él no hay botón de tacos. */
import { RAREZAS, TACOS, IDS_TACOS, PRECIO_COFRE, IDS_PREMIO, rarezaDe, reembolsoDe } from "./tacos.js";
import { dibujaTacoMini } from "./pool-vista.js";
import { VERSION_POOL, NOVEDADES_POOL } from "./pool-novedades.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.round(n || 0).toLocaleString("es-CL");
const pct = n => (n / 10).toLocaleString("es-CL") + " %";
const animado = e => !!(e.brillo || ["olas", "aurora", "galaxia"].includes(e.veta));

export function crearMenuPool(ctx, host) {
  let capa = null, pestana = "tacos", raf = 0, ocupado = false, resultado = null, muerto = false, error = "";
  const T = ctx.tacos || null;

  const barra = () => `
    <span class="jg-pl-ver" title="Versión de Pool 8">Pool 8 · v${esc(VERSION_POOL)}</span>
    ${T ? `<button type="button" class="jg-btn jg-pl-mn" data-menu="tacos">🎁 Tacos y cofres</button>` : ""}
    <button type="button" class="jg-btn jg-pl-mn" data-menu="nov">📋 Novedades</button>`;

  function abre(cual) {
    pestana = cual;
    if (!capa) {
      capa = document.createElement("div");
      capa.className = "jg-pl-modal";
      capa.addEventListener("click", alClic);
      host.appendChild(capa);
    }
    pinta();
    anima();
  }
  function cierra() {
    if (capa) { capa.remove(); capa = null; }
    cancelAnimationFrame(raf); raf = 0; resultado = null;
  }
  function destruir() { muerto = true; cierra(); }

  function tarjeta(id, e) {
    const t = TACOS[id], r = rarezaDe(t.rareza);
    const tiene = !!(e.poseidos[id] || t.regalo);
    const puesto = e.equipado === id;
    return `<div class="jg-pl-taco${tiene ? "" : " bloq"}${puesto ? " puesto" : ""}" style="--r:${r.color}">
      <canvas width="320" height="44" data-taco="${id}"></canvas>
      <div class="jg-pl-taco-i"><b>${tiene ? esc(t.nombre) : "???"}</b><small style="color:${r.color}">${esc(r.nombre)}</small></div>
      ${tiene ? (puesto ? `<span class="jg-pl-eq">Equipado</span>` : `<button type="button" class="jg-btn jg-pl-eqb" data-equipa="${id}">Equipar</button>`) : ""}
    </div>`;
  }

  function cuerpoTacos() {
    const e = T.estado();
    const tengo = Object.keys(e.poseidos).length;
    const total = IDS_PREMIO.length;
    const puede = e.listo && !e.parada && e.saldo >= PRECIO_COFRE && !ocupado;
    const probas = RAREZAS.map(r => {
      const n = IDS_PREMIO.filter(k => TACOS[k].rareza === r.id).length;
      return `<tr style="--r:${r.color}"><td><i></i>${esc(r.nombre)}</td><td>${pct(r.mil)}</td><td>${n} tacos</td><td>repetido: +${fmt(r.reembolso)} 🪙</td></tr>`;
    }).join("");
    let res = "";
    if (resultado) {
      const t = TACOS[resultado.id], r = rarezaDe(t.rareza);
      res = `<div class="jg-pl-res" style="--r:${r.color}">
        <small>${esc(r.nombre)}</small><canvas width="360" height="50" data-taco="${resultado.id}"></canvas>
        <b>${esc(t.nombre)}</b>
        <span>${resultado.dup ? `Ya lo tenías: te devolvemos ${fmt(reembolsoDe(resultado.id))} 🪙` : "¡Taco nuevo en tu colección!"}</span>
      </div>`;
    }
    return `
      <div class="jg-pl-cofre">
        <div class="jg-pl-cofre-img${ocupado ? " abre" : ""}" aria-hidden="true">🎁</div>
        <div class="jg-pl-cofre-d">
          <b>Cofre de tacos</b>
          <span>${fmt(PRECIO_COFRE)} 🪙 · te quedan ${e.listo ? fmt(e.saldo) : "…"} 🪙</span>
          <button type="button" class="jg-btn jg-btn-prim jg-pl-abrir" data-abre ${puede ? "" : "disabled"}>${ocupado ? "Abriendo…" : `Abrir cofre · ${fmt(PRECIO_COFRE)} 🪙`}</button>
          ${!e.listo ? `<small>Cargando tus monedas…</small>` : e.parada ? `<small>Tu cuenta de monedas está detenida por un gasto sin saldo.</small>` : e.saldo < PRECIO_COFRE ? `<small>Te faltan ${fmt(PRECIO_COFRE - e.saldo)} 🪙: juega partidas, logros y la recompensa diaria.</small>` : ""}
        </div>
      </div>
      ${error ? `<div class="jg-pl-err">${esc(error)}</div>` : ""}
      ${res}
      <table class="jg-pl-probas"><thead><tr><th>Rareza</th><th>Probabilidad</th><th>Hay</th><th>Duplicado</th></tr></thead><tbody>${probas}</tbody></table>
      <h4>Tu colección <small>${tengo} de ${total} (más el de escuela)</small></h4>
      <div class="jg-pl-coleccion">${IDS_TACOS.map(id => tarjeta(id, e)).join("")}</div>`;
  }

  function cuerpoNov() {
    return NOVEDADES_POOL.map(v => `
      <section class="jg-pl-version">
        <h4>v${esc(v.v)} <small>${esc(v.fecha)} · ${esc(v.titulo)}</small></h4>
        ${v.grupos.map(([h, ls]) => `<h5>${esc(h)}</h5><ul>${ls.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`).join("")}
      </section>`).join("");
  }

  function pinta() {
    if (!capa) return;
    capa.innerHTML = `
      <div class="jg-pl-caja-m" role="dialog" aria-label="Menú de Pool">
        <div class="jg-pl-m-cab">
          <div class="jg-pl-m-tabs">
            ${T ? `<button type="button" class="${pestana === "tacos" ? "on" : ""}" data-menu="tacos">🎁 Tacos y cofres</button>` : ""}
            <button type="button" class="${pestana === "nov" ? "on" : ""}" data-menu="nov">📋 Novedades v${esc(VERSION_POOL)}</button>
          </div>
          <button type="button" class="jg-pl-x" data-cierra aria-label="Cerrar">✕</button>
        </div>
        <div class="jg-pl-m-cuerpo">${pestana === "tacos" && T ? cuerpoTacos() : cuerpoNov()}</div>
      </div>`;
    for (const cv of capa.querySelectorAll("canvas[data-taco]")) dibujaTacoMini(cv, TACOS[cv.getAttribute("data-taco")], performance.now() / 1000);
  }

  /* Los tacos con brillo se mueven mientras el menú está abierto. */
  function anima() {
    cancelAnimationFrame(raf);
    const paso = t => {
      if (!capa || muerto) return;
      for (const cv of capa.querySelectorAll("canvas[data-taco]")) {
        const e = TACOS[cv.getAttribute("data-taco")];
        if (animado(e)) dibujaTacoMini(cv, e, t / 1000);
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }

  async function alClic(ev) {
    const x = ev.target;
    if (x === capa || x.closest("[data-cierra]")) { cierra(); return; }
    const m = x.closest("[data-menu]");
    if (m) { pestana = m.getAttribute("data-menu"); resultado = null; pinta(); return; }
    const q = x.closest("[data-equipa]");
    if (q && T) { await T.equipar(q.getAttribute("data-equipa")); pinta(); return; }
    if (x.closest("[data-abre]") && T && !ocupado) {
      ocupado = true; resultado = null; error = ""; pinta();
      try {
        const [r] = await Promise.all([T.comprar(), new Promise(ok => setTimeout(ok, 1100))]);
        resultado = r;
      } catch (e) {
        resultado = null;
        error = /permission/i.test(String((e && (e.code || e.message)) || ""))
          ? "La base de datos rechazó la compra: falta publicar las reglas de Firebase (nodo «cofres»)." : "No se pudo abrir el cofre. Inténtalo de nuevo.";
      }
      ocupado = false;
      if (!muerto) pinta();
    }
  }

  return { barra, abre, cierra, destruir, refresca: () => { if (capa && !ocupado) pinta(); } };
}
