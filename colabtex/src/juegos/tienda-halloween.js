/* La tienda de Halloween, a la vista: la ventana que se abre sola al
 * entrar al salón (una vez al día por aparato), la franja fija del salón
 * que la vuelve a abrir y la ruta `#tienda` (el enlace de Inicio).
 *
 * El catálogo, los precios y la hora de cierre son de tienda.js; los
 * dibujos, de marcos-animados.js y fondos-halloween.js. Aquí solo se
 * pinta y se llama a quien compra (`ctx.comprar`) y a quien se lo pone
 * (`ctx.equipar`). Comprar y ponérselo son pasos distintos a propósito:
 * comprar es para siempre y se confirma; ponérselo se cambia cuando sea.
 *
 * Dos cosas que la sostienen:
 * - **Se repinta por firma.** Los datos del perfil llegan cada vez que
 *   cambia cualquier nodo de la economía; rehacer la rejilla en cada
 *   llegada reiniciaría todas las animaciones. Solo se repinta si cambia
 *   algo que se ve (saldo, lo comprado, lo puesto, lo elegido).
 * - **Lo comprado aquí se da por tuyo al instante** (`aqui`), sin esperar a
 *   que la lectura traiga la compra: la economía la confirmará igual.
 */
import { MARCOS, FONDOS, requisito, estadisticas } from "./perfil-tarjeta.js";
import { avatarMarco, capaFondo } from "./perfil-vista.js";
import { HALLOWEEN, RAREZAS_HW, PREMIOS_HALLOWEEN, VENTA_HALLOWEEN, precioDe, rarezaHw, tiendaHalloweenAbierta, coleccionHalloween, edicion } from "./tienda.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const miles = n => Math.round(n).toLocaleString("es-CL");
/* La moneda dibujada (monedas-vista.js): el emoji 🪙 es de 2020 y en
   Windows 10 sale como un cuadro vacío. */
import { MONEDA } from "./monedas-vista.js";
const CLAVE_VISTO = "jg.tiendaHw.visto";

/* Lo que tiene la tienda, en el orden en que se enseña: de lo más caro a
   lo más barato (lo mítico es lo que más tienta), y los premios aparte. */
const ORDEN_RZ = ["mitico", "legendario", "epico", "raro"];
const porRareza = (a, b) => ORDEN_RZ.indexOf(rarezaHw(a.id)) - ORDEN_RZ.indexOf(rarezaHw(b.id));
export const marcosHw = () => MARCOS.filter(m => HALLOWEEN[m.id]).sort(porRareza);
export const fondosHw = () => FONDOS.filter(f => HALLOWEEN[f.id]).sort(porRareza);
const premio = id => PREMIOS_HALLOWEEN.find(p => p.id === id);
const itemDe = id => MARCOS.find(m => m.id === id && m.hw) || FONDOS.find(f => f.id === id && f.hw) || null;
const tipoDe = id => MARCOS.some(m => m.id === id && m.hw) ? "marco" : "fondo";

/* Cuánto queda hasta el cierre, en partes. */
export function queda(ahora) {
  const ms = Math.max(0, VENTA_HALLOWEEN.hasta - ahora);
  const s = Math.floor(ms / 1000);
  return { ms, d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}
export function quedaCorto(ahora) {
  const q = queda(ahora);
  if (q.d >= 1) return `${q.d} ${q.d === 1 ? "día" : "días"} y ${q.h} h`;
  if (q.h >= 1) return `${q.h} h ${String(q.m).padStart(2, "0")} min`;
  return `${q.m} min`;
}

/* ¿Se abre sola? Mientras se vende y si hoy (fecha local) no se abrió ya. */
const hoy = f => `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`;
export function debeAbrirseSola(ahora, visto) {
  return tiendaHalloweenAbierta(ahora) && visto !== hoy(new Date(ahora));
}
export function yaVistaHoy() {
  try { return !debeAbrirseSola(Date.now(), localStorage.getItem(CLAVE_VISTO) || ""); } catch (e) { return false; }
}
function marcaVista() {
  try { localStorage.setItem(CLAVE_VISTO, hoy(new Date())); } catch (e) { /* sin almacenamiento: vuelve a salir otro día igual */ }
}

const MURC = `<svg viewBox="0 0 40 20" aria-hidden="true"><path d="M20 9C16 3 9 2 1 5c3 1 4 3 3 6 3-1.5 5-1 6 1 2-2 4-2 6 0 1-1.5 2.5-2 4-2s3 .5 4 2c2-2 4-2 6 0 1-2 3-2.5 6-1-1-3 0-5 3-6-8-3-15-2-19 4z"/></svg>`;
const murcielagos = n => Array.from({ length: n }, (_, i) => `<i class="th-murc" style="--i:${i}">${MURC}</i>`).join("");

/* La franja del salón: se escribe mientras la tienda vende. Los marcos
   están quietos hasta que se pasa el ratón: en el salón no puede haber un
   SVG animándose siempre (docs/claude/juegos/salon.md, «Lobby
   performance»). Lo que se mueve solo es HTML: murciélagos, luna, brillo. */
/* Qué persona pinta la franja (para rehacerla solo si cambió). */
export const firmaYoTienda = y => y && y.nombre ? `${y.nombre}|${y.color}|${String(y.foto || "").length}|${String(y.foto || "").slice(-24)}` : "";
export function tiraTiendaHtml({ foto, nombre, color, ahora = Date.now() } = {}) {
  if (!tiendaHalloweenAbierta(ahora)) return "";
  const av = (m, t, cls) => `<span class="th-tira-av ${cls}">${avatarMarco(foto || "", nombre || "?", color || "#ea580c", m, t)}</span>`;
  return `<button type="button" class="jg-th-tira" data-tienda-hw data-yo="${esc(firmaYoTienda({ foto, nombre, color }))}" aria-label="Abrir la tienda de Halloween">
    <span class="th-tira-cielo" aria-hidden="true"><i class="th-luna"></i>${murcielagos(3)}</span>
    <span class="th-tira-avs" aria-hidden="true">${av("caldero", 44, "lado")}${av("parca", 58, "centro")}${av("fantasmas", 44, "lado")}</span>
    <span class="th-tira-tx">
      <small>🎃 Edición limitada · nunca vuelve</small>
      <b>Tienda de Halloween</b>
      <span>11 marcos y fondos animados · cierra en <em data-th-cuenta>${esc(quedaCorto(ahora))}</em></span>
    </span>
    <span class="th-tira-btn">Ver la tienda <span aria-hidden="true">→</span></span>
  </button>`;
}
/* Las cuentas atrás de las franjas, sin repintar el salón. */
export function refrescaCuentas(raiz = document) {
  const t = quedaCorto(Date.now());
  for (const e of raiz.querySelectorAll("[data-th-cuenta]")) if (e.textContent !== t) e.textContent = t;
}

let abierta = null;
export const tiendaAbierta = () => !!abierta;
export function cierraTienda() { if (abierta) abierta(); }

/* ctx: {
     yo(): {uid, nombre, foto, color} | null (null = invitado)
     datos(cb): se suscribe a los datos del perfil; devuelve con qué soltar
     saldo(d): las monedas de ahora (null mientras se cuentan)
     perfil(): el perfil guardado (para saber qué lleva puesto)
     comprar(id): Promise · equipar(tipo, id): Promise
     personalizar(): abre el editor · login(): inicia sesión
     suena(nombre)
   } */
export function abreTiendaHalloween(ctx, elegido) {
  cierraTienda();
  marcaVista();
  const yo0 = ctx.yo();
  let D = null, sel = itemDe(elegido) ? elegido : "parca", paso = "", error = "", ocupado = false, firma = "";
  /* El catálogo va en pestañas para que todo quepa sin desplazarse. */
  let pestana = premio(sel) ? "premios" : tipoDe(sel) === "fondo" ? "fondos" : "marcos";
  const aqui = {}, puestoAqui = {};
  let confirmaHasta = 0, fiesta = null;

  const capa = document.createElement("div");
  capa.className = "jg-modal-capa jg-th-capa";
  capa.id = "jgTiendaHw";
  capa.innerHTML = `
    <div class="jg-th" role="dialog" aria-modal="true" aria-labelledby="thTit">
      <div class="jg-th-cielo" aria-hidden="true"><i class="th-luna"></i>${murcielagos(5)}<i class="th-niebla"></i></div>
      <div class="jg-th-xw"><button type="button" class="jg-th-x" aria-label="Cerrar" title="Cerrar">✕</button></div>
      <header class="jg-th-cab">
        <div class="jg-th-cab-tx">
          <span class="jg-th-sello">🎃 Edición limitada · nunca vuelve</span>
          <h2 id="thTit" class="jg-th-tit">Tienda de Halloween</h2>
          <p class="jg-th-lema">Lo que compres es tuyo para siempre; lo que no, desaparece al cerrar.</p>
        </div>
        <div class="jg-th-reloj" aria-label="Tiempo para que cierre"><small class="jg-th-reloj-t">Cierra en</small><span><b data-r="d">0</b><small>días</small></span><span><b data-r="h">0</b><small>h</small></span><span><b data-r="m">0</b><small>min</small></span><span><b data-r="s">0</b><small>seg</small></span></div>
      </header>
      <div class="jg-th-cuerpo">
        <section class="jg-th-probador" aria-label="Probador"></section>
        <section class="jg-th-cat" aria-label="Catálogo"></section>
      </div>
    </div>`;
  const $ = s => capa.querySelector(s);

  /* ---- el estado que se ve ---- */
  const yo = () => ctx.yo() || yo0;
  const est = () => {
    const u = yo();
    if (!u || !D) return null;
    const e = estadisticas(u.uid, D);
    return Object.assign({}, e, { compras: Object.assign({}, e.compras, aqui) });
  };
  const tiene = (e, id) => {
    const it = itemDe(id);
    return !!(it && e && requisito(it, e).ok);
  };
  const saldo = () => {
    if (!D || !yo()) return null;
    const s = ctx.saldo(D);
    if (s == null) return null;
    const base = estadisticas(yo().uid, D).compras || {};
    /* Lo comprado aquí que la lectura todavía no trae. */
    return s - Object.keys(aqui).filter(id => !base[id]).reduce((t, id) => t + precioDe(id), 0);
  };
  /* Las compras de todos (para el número de edición), con lo de aquí. */
  const todas = () => {
    const c = Object.assign({}, (D && (D.compras || D.tienda)) || {}), u = yo();
    if (u) c[u.uid] = Object.assign({}, c[u.uid], aqui);
    return c;
  };
  const cuantos = id => D ? edicion(id, "", todas()).total : null;
  const numero = id => yo() && D ? edicion(id, yo().uid, todas()).n : 0;
  const puesto = tipo => {
    if (puestoAqui[tipo]) return puestoAqui[tipo];
    const p = ctx.perfil() || {};
    return p[tipo] || (tipo === "marco" ? "anillo" : "color");
  };

  /* ---- pintar ---- */
  function arte(it, tam) {
    const u = yo() || { nombre: "?", foto: "", color: "#ea580c" };
    if (tipoDe(it.id) === "marco") return avatarMarco(u.foto, u.nombre, u.color, it.id, tam);
    return `<span class="jg-th-muestra" style="background:${esc(it.css(u.color))}">${capaFondo(it)}</span>`;
  }
  function tarjeta(it, e) {
    const rz = rarezaHw(it.id), pr = premio(it.id), mio = tiene(e, it.id), lleva = mio && puesto(tipoDe(it.id)) === it.id;
    const r = e ? requisito(it, e) : null;
    const pie = lleva ? `<span class="jg-th-it-p tuyo">✓ Puesto</span>`
      : mio ? `<span class="jg-th-it-p tuyo">✓ Tuyo</span>`
      : pr ? `<span class="jg-th-it-p">🎁 Con ${pr.n} artículos</span>`
      : `<span class="jg-th-it-p">${MONEDA} ${miles(precioDe(it.id))}</span>`;
    const t = cuantos(it.id), n = mio ? numero(it.id) : 0;
    const quien = t == null ? "" : mio && n ? `<small class="jg-th-it-q tuyo">Tu edición: n.º ${n}</small>`
      : `<small class="jg-th-it-q">${t ? `👥 Lo ${t === 1 ? "tiene 1 persona" : `tienen ${t}`}` : "✨ Nadie lo tiene aún"}</small>`;
    return `<button type="button" class="jg-th-it ${tipoDe(it.id)} ${rz ? "r-" + rz : "r-premio"}${sel === it.id ? " sel" : ""}${mio ? " mio" : ""}${r && r.agotado ? " agotado" : ""}" data-th-it="${it.id}" aria-pressed="${sel === it.id}">
      <span class="jg-th-it-arte">${arte(it, 58)}</span>
      <span class="jg-th-it-rz">${rz ? esc(RAREZAS_HW[rz].n) : "Premio secreto"}</span>
      <b class="jg-th-it-n">${esc(it.n)}</b>${pie}${quien}</button>`;
  }
  function probador(e) {
    const u = yo() || { nombre: "Tú", foto: "", color: "#ea580c" };
    const it = itemDe(sel), tipo = tipoDe(sel), rz = rarezaHw(sel), pr = premio(sel);
    const marco = tipo === "marco" ? sel : (tiene(e, puesto("marco")) || !itemDe(puesto("marco")) ? puesto("marco") : "anillo");
    const fondoId = tipo === "fondo" ? sel : puesto("fondo");
    const fondo = FONDOS.find(f => f.id === fondoId) || FONDOS[0];
    const s = saldo(), mio = tiene(e, sel), precio = precioDe(sel), lleva = mio && puesto(tipo) === sel;
    let accion;
    if (!yo()) accion = `<button type="button" class="jg-th-comprar" data-th-login>Inicia sesión para comprar</button>`;
    else if (lleva) accion = `<button type="button" class="jg-th-comprar hecho" disabled>✓ Lo llevas puesto</button>`;
    else if (mio) accion = `<button type="button" class="jg-th-comprar poner" data-th-poner>${tipo === "marco" ? "Ponerme este marco" : "Poner este fondo"}</button>`;
    else if (pr) {
      const k = coleccionHalloween(e && e.compras);
      accion = `<div class="jg-th-premio-txt">🎁 No se vende: se gana teniendo <b>${pr.n}</b> artículos de esta tienda. Llevas <b>${k}</b>.</div>`;
    } else if (s == null) accion = `<button type="button" class="jg-th-comprar" disabled>Contando tus monedas…</button>`;
    else if (s < precio) accion = `<button type="button" class="jg-th-comprar falta" disabled>Te faltan ${MONEDA} ${miles(precio - s)}</button><p class="jg-th-nota">Juega en el salón, reclama tu recompensa diaria y vuelve: cierra en ${esc(quedaCorto(Date.now()))}.</p>`;
    else if (paso === "confirma") accion = `<button type="button" class="jg-th-comprar seguro" data-th-si>Sí, comprar por ${MONEDA} ${miles(precio)}</button><button type="button" class="jg-th-no" data-th-no>No, todavía no</button><p class="jg-th-nota">Te quedarán ${MONEDA} ${miles(s - precio)}. Es para siempre.</p>`;
    else accion = `<button type="button" class="jg-th-comprar" data-th-comprar${ocupado ? " disabled" : ""}>${ocupado ? "Comprando…" : `Comprar por ${MONEDA} ${miles(precio)}`}</button>`;
    return `
      <div class="jg-th-esc${fondo.oscuro ? " oscuro" : ""}" style="background:${esc(fondo.css(u.color))}">${capaFondo(fondo)}
        <div class="jg-th-esc-yo">${avatarMarco(u.foto, u.nombre, u.color, marco, 84)}<b translate="no">${esc(u.nombre)}</b></div>
        <span class="jg-th-esc-et">Así te verían</span>
      </div>
      <div class="jg-th-ficha ${rz ? "r-" + rz : "r-premio"}">
        <span class="jg-th-it-rz">${rz ? esc(RAREZAS_HW[rz].n) : "Premio secreto"} · ${tipo}</span>
        <h3>${esc(it.n)}</h3>
        ${escasez(sel, mio)}
        ${accion}
        ${error ? `<p class="jg-th-err" role="alert">${esc(error)}</p>` : ""}
      </div>
      <div class="jg-th-saldo">${yo() ? `Tu saldo <b>${MONEDA} ${s == null ? "…" : miles(s)}</b>` : "Inicia sesión para ver tu saldo"}</div>
      ${coleccion(e)}`;
  }
  /* Lo que dice «esto es único»: cuántos lo tienen y qué número serías. */
  function escasez(id, mio) {
    const t = cuantos(id);
    if (t == null) return "";
    if (mio) { const n = numero(id); return n ? `<p class="jg-th-escasez tuyo">🏅 Tienes la edición <b>n.º ${n}</b> de ${t}. Nadie más tendrá ese número.</p>` : ""; }
    if (premio(id)) return `<p class="jg-th-escasez">👥 ${t ? `Solo ${t} ${t === 1 ? "persona lo ha ganado" : "personas lo han ganado"}.` : "Nadie lo ha ganado todavía."}</p>`;
    return `<p class="jg-th-escasez">${t ? `👥 Solo <b>${t}</b> ${t === 1 ? "persona lo tiene" : "personas lo tienen"}. Serías la edición <b>n.º ${t + 1}</b>.` : `✨ Nadie lo tiene todavía: serías la edición <b>n.º 1</b>.`}</p>`;
  }
  function coleccion(e) {
    const k = coleccionHalloween(e && e.compras), total = Object.keys(HALLOWEEN).length;
    const metas = PREMIOS_HALLOWEEN.map(p => {
      const it = itemDe(p.id), ok = k >= p.n;
      return `<button type="button" class="jg-th-meta${ok ? " ok" : ""}" data-th-it="${p.id}" style="--pos:${(p.n / total * 100).toFixed(1)}%">
        <span class="jg-th-meta-arte">${arte(it, 34)}</span><small>${ok ? "✓ " : ""}${p.n} · ${esc(it.n)}</small></button>`;
    }).join("");
    return `<div class="jg-th-col">
      <div class="jg-th-col-t"><b>Colección de Halloween</b><span>${k} de ${total}</span></div>
      <div class="jg-th-col-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${k}">
        <i style="width:${(k / total * 100).toFixed(1)}%"></i>
        ${Array.from({ length: total }, (_, i) => `<span class="${i < k ? "on" : ""}" style="left:${((i + 1) / total * 100).toFixed(1)}%"></span>`).join("")}
      </div>
      <div class="jg-th-metas">${metas}</div>
    </div>`;
  }
  function catalogo(e) {
    const P = [["marcos", "Marcos", marcosHw(), "se animan alrededor de tu foto"], ["fondos", "Fondos", fondosHw(), "la escena de tu tarjeta y tu perfil"],
      ["premios", "🎁 Premios", PREMIOS_HALLOWEEN.map(p => itemDe(p.id)), "no se venden: se ganan coleccionando"]];
    const [, , lista, nota] = P.find(p => p[0] === pestana);
    return `<div class="jg-th-tabs" role="tablist">${P.map(([k, t, l]) => `<button type="button" role="tab" data-th-tab="${k}" aria-selected="${k === pestana}">${t} <small>${l.length}</small></button>`).join("")}<span class="jg-th-tabs-n">${esc(nota)}</span></div>` +
      `<div class="jg-th-rej${lista.length < 4 ? " pocos" : ""}">${lista.map(it => tarjeta(it, e)).join("")}</div>` +
      `<p class="jg-th-pie">${ORDEN_RZ.slice().reverse().map(r => `<span class="jg-th-rz r-${r}">${esc(RAREZAS_HW[r].n)} · ${MONEDA} ${miles(RAREZAS_HW[r].p)}</span>`).join(" ")}</p>`;
  }
  function pinta(forzar) {
    const e = est(), s = saldo();
    const t = D ? [...marcosHw(), ...fondosHw()].map(it => cuantos(it.id)).concat(PREMIOS_HALLOWEEN.map(p => cuantos(p.id))) : null;
    const u = yo(), f = JSON.stringify([sel, pestana, paso, error, ocupado, s, u ? [u.nombre, u.color, String(u.foto || "").length, String(u.foto || "").slice(-24)] : null, e ? Object.keys(e.compras || {}).sort() : null, puesto("marco"), puesto("fondo"), t]);
    if (!forzar && f === firma) return;
    firma = f;
    $(".jg-th-probador").innerHTML = probador(e);
    $(".jg-th-cat").innerHTML = catalogo(e);
  }
  function reloj() {
    const q = queda(Date.now());
    for (const k of ["d", "h", "m", "s"]) {
      const b = capa.querySelector(`[data-r="${k}"]`), v = k === "d" ? String(q[k]) : String(q[k]).padStart(2, "0");
      if (b && b.textContent !== v) b.textContent = v;
    }
    if (paso === "confirma" && Date.now() > confirmaHasta) { paso = ""; pinta(); }
    if (!q.ms) { error = "La tienda de Halloween cerró."; pinta(); }
  }

  /* ---- la fiesta de la compra ---- */
  function celebra(it, gano, n) {
    if (fiesta) fiesta.remove();
    const PIEZAS = ["🎃", "👻", "🦇", "✨", "🍬", "🕸️", "💀", "🌙"];
    fiesta = document.createElement("div");
    fiesta.className = "jg-th-fiesta";
    fiesta.setAttribute("aria-live", "polite");
    fiesta.innerHTML = Array.from({ length: 22 }, (_, i) => `<i style="--a:${(i * 360 / 22).toFixed(0)}deg;--d:${(26 + (i * 7) % 16)}vmin;--r:${(i % 2 ? 1 : -1) * (120 + i * 17)}deg;--t:${(.05 * (i % 5)).toFixed(2)}s">${PIEZAS[i % PIEZAS.length]}</i>`).join("") +
      `<div class="jg-th-fiesta-c"><span>${arte(it, 92)}</span><b>¡Es tuyo!</b><small>${esc(it.n)}</small>${n ? `<strong>Edición n.º ${n}</strong>` : ""}` +
      (gano ? `<em>🎁 ¡Y desbloqueaste «${esc(gano.n)}», el premio secreto!</em>` : "") + `</div>`;
    capa.appendChild(fiesta);
    const f = fiesta;
    const dura = gano ? 3600 : 2300;
    setTimeout(() => { if (f.parentNode) f.classList.add("fuera"); }, dura);
    setTimeout(() => { if (f.parentNode) f.remove(); if (fiesta === f) fiesta = null; }, dura + 500);
  }

  async function compra() {
    const it = itemDe(sel), s = saldo(), precio = precioDe(sel);
    if (ocupado || !it || premio(sel)) return;
    if (!tiendaHalloweenAbierta(Date.now())) { error = "La tienda de Halloween ya cerró."; pinta(); return; }
    if (s == null || s < precio) { paso = ""; pinta(); return; }
    ocupado = true; paso = ""; error = ""; pinta();
    const id = sel, antes = coleccionHalloween((est() || {}).compras);
    try {
      await ctx.comprar(id);
      aqui[id] = { p: precio };
      ocupado = false;
      pinta();
      /* ¿Esta compra destapó un premio de coleccionista? */
      const p = PREMIOS_HALLOWEEN.find(x => antes < x.n && antes + 1 >= x.n);
      celebra(it, p ? itemDe(p.id) : null, numero(id));
      if (ctx.suena) ctx.suena("cobra");
    } catch (err) {
      ocupado = false;
      error = "No se pudo comprar: " + (err && (err.code || err.message) ? String(err.code || err.message) : String(err));
      pinta();
    }
  }
  async function pon() {
    const tipo = tipoDe(sel), id = sel;
    if (ocupado) return;
    ocupado = true; error = ""; pinta();
    try {
      await ctx.equipar(tipo, id);
      puestoAqui[tipo] = id;
      if (ctx.suena) ctx.suena("gana");
    } catch (err) {
      error = "No se pudo guardar: " + (err && (err.code || err.message) ? String(err.code || err.message) : String(err));
    }
    ocupado = false; pinta();
  }

  capa.addEventListener("click", ev => {
    const t = ev.target;
    if (t === capa || t.closest(".jg-th-x")) { cierra(); return; }
    const tab = t.closest("[data-th-tab]");
    if (tab) { pestana = tab.getAttribute("data-th-tab"); pinta(); return; }
    const it = t.closest("[data-th-it]");
    if (it) {
      const id = it.getAttribute("data-th-it");
      if (id !== sel) {
        sel = id; paso = ""; error = "";
        pestana = premio(id) ? "premios" : tipoDe(id) === "fondo" ? "fondos" : "marcos";
        pinta(); if (ctx.suena) ctx.suena("clic");
      }
      /* En el teléfono el probador queda arriba: se sube a mirarlo. */
      if (matchMedia("(max-width: 760px)").matches) $(".jg-th-probador").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (t.closest("[data-th-comprar]")) { paso = "confirma"; confirmaHasta = Date.now() + 8000; error = ""; pinta(); return; }
    if (t.closest("[data-th-no]")) { paso = ""; pinta(); return; }
    if (t.closest("[data-th-si]")) { compra(); return; }
    if (t.closest("[data-th-poner]")) { pon(); return; }
    if (t.closest("[data-th-login]")) { cierra(); ctx.login(); return; }
  });
  const tecla = ev => { if (ev.key === "Escape") cierra(); };
  document.addEventListener("keydown", tecla);

  const off = ctx.datos ? ctx.datos(d => { D = d; pinta(); }) : null;
  const intervalo = setInterval(() => { reloj(); pinta(); }, 1000);
  function cierra() {
    if (abierta !== cierra) return;
    abierta = null;
    clearInterval(intervalo);
    document.removeEventListener("keydown", tecla);
    if (typeof off === "function") { try { off(); } catch (e) {} }
    capa.classList.add("cierra");
    setTimeout(() => capa.remove(), 220);
  }
  abierta = cierra;

  pinta(true); reloj();
  document.body.appendChild(capa);
  setTimeout(() => { try { $(".jg-th-x").focus({ preventScroll: true }); } catch (e) {} }, 40);
  if (ctx.suena) ctx.suena("entra");
  return cierra;
}
