/* 🏪 El mercado de Juegos (`#mercado`, `#mercado/prodrop`, `#mercado/mascotas`):
   uno solo para PRODROP y Mascotas. Lo pinta la página (antes vivía dentro
   del iframe de PRODROP). Los datos salen de la economía (mercado-datos.js,
   puro); las escrituras pasan por aquí, de a una, revisadas contra esa
   misma economía, porque las reglas no saben si alcanza el dinero ni de
   quién es cada cosa.

   Las cartas se dibujan con `miniCarta`; los objetos y las mascotas, en 3D
   por el visor de Mascotas (visor-mascota.js: fotos para la grilla, la cosa
   girando en el detalle), con su emoji mientras tanto o sin WebGL. Vender se
   hace en cada juego (la carta desde su zoom, la mascota o el objeto desde
   su ficha); aquí se compra, se retira y se intercambia. */
import { economia, monedasDe, leeCopia } from "./monedas.js";
import { MONEDA } from "./monedas-vista.js";
import { miniCarta, MOTOR } from "./prodrop-cartas.js";
import { avatarMarco } from "./perfil-vista.js";
import {
  JUEGOS_MERCADO, TIPOS_MASCOTAS, FILTROS_INICIALES, ofertasMercado, filtra, misVentas, misCambios, intercambiables, gente,
  pendientesDe, puedeComprar, puedeProponer, fichaCopia
} from "./mercado-datos.js";
import { ESPACIOS, NOMBRE_ESPACIO, ESPECIES, ETAPAS, pedidoObjeto, pedidoMascota, puestoDe } from "./mascotas-datos.js";
import { fotoDe, pideFotos, montaVisor } from "./visor-mascota.js";
import MM from "../../../juegos/mascotas/motor.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.round(n || 0).toLocaleString("es-CL");
const claveEstado = c => String(c).replace(/^ma:/, "");
const LOTE = 48;

export function crearMercado({ usuario, datos, fb, quien, marcoDe, ir, juego }) {
  const uid = usuario.uid;
  let host = null, d = null, off = null, firma = "", muerto = false, ocupado = Promise.resolve();
  const f = Object.assign({}, FILTROS_INICIALES, { juego: juego || "todo" });
  let tab = "comprar", max = LOTE, detalle = null, trato = null;
  /* El estado guardado de las mascotas que aparecen (se lee por clave, del
     dueño de ahora: una vez por sesión de la pestaña). */
  const estados = {}, pidiendo = new Set();
  const eco = () => economia(d);

  function leeEstados(cs) {
    if (!d || !d.completo) return;
    const e = eco();
    for (const c of cs) {
      const k = claveEstado(c), dueno = e.dueno[c];
      if (!dueno || pidiendo.has(dueno + "/" + k)) continue;
      pidiendo.add(dueno + "/" + k);
      fb.leeEstadoMascota(dueno, k).then(x => { estados[k] = x || null; if (!muerto) { firma = ""; pinta(); } });
    }
  }

  /* ---------- miniaturas ---------- */
  function pedidoDe(r) {
    if (r.tipo === "objeto") return pedidoObjeto(r.item);
    if (r.tipo === "baile") return { key: `baile:${r.item.id}`, mascota: { e: "chicken", etapa: "adult", semilla: MM.semillaGenes("baile", r.item.id, 0), ids: {}, tints: {}, baile: r.item.id } };
    if (r.tipo === "mascota") return pedidoMascota(r.c, r.m, r.estado, puestoDe(r.estado, eco().dueno[r.c], eco()));
    return null;
  }
  function imagen(r, grande) {
    if (r.tipo === "carta") return miniCarta(r.cp);
    const p = r.tipo === "baile" ? null : pedidoDe(r), ft = p && fotoDe(p.key);
    const muestra = ft && ft.colores && ft.colores.length ? `<span class="jg-mk-muestra">${ft.colores.map(c => `<i style="background:${esc(c)}"></i>`).join("")}</span>` : "";
    return `<span class="jg-mk-foto${grande ? " grande" : ""}" data-foto="${esc(p ? p.key : "")}">${ft && ft.src ? `<img src="${esc(ft.src)}" alt="" draggable="false">` : `<span class="jg-mk-emoji" aria-hidden="true">${esc(r.emoji)}</span>`}${muestra}${r.leg ? '<b class="jg-mk-leg" title="Legendario">★</b>' : ""}${r.frozen ? '<b class="jg-mk-eterna" title="Tomó la poción eterna">🧪</b>' : ""}</span>`;
  }
  function pideMiniaturas(filas) {
    const pedidos = filas.map(r => (r.tipo === "objeto" || r.tipo === "mascota" ? pedidoDe(r) : null)).filter(Boolean);
    pideFotos(pedidos, (key, ft) => {
      if (!host) return;
      for (const el of host.querySelectorAll(`[data-foto="${CSS.escape(key)}"]`))
        if (ft.src) el.innerHTML = `<img src="${esc(ft.src)}" alt="" draggable="false">` + (ft.colores.length ? `<span class="jg-mk-muestra">${ft.colores.map(c => `<i style="background:${esc(c)}"></i>`).join("")}</span>` : "") + (el.querySelector(".jg-mk-leg") ? el.querySelector(".jg-mk-leg").outerHTML : "");
    });
  }
  const persona = (u, tam) => { const q = quien(u); return `<span class="jg-mk-quien" translate="no">${avatarMarco(q.foto, q.nombre, q.color, marcoDe(u), tam, u)}<b>${esc(q.nombre)}</b></span>`; };

  /* ---------- la vista ---------- */
  function pinta() {
    if (!host || muerto) return;
    if (!d || !d.completo) { host.innerHTML = `<section class="jg-mk"><p class="jg-nada">Cargando el mercado…</p></section>`; return; }
    const ofertas = ofertasMercado(d, uid, estados), ventas = misVentas(d, uid, estados), cambios = misCambios(d, uid, estados);
    leeEstados([...ofertas, ...ventas].filter(r => r.tipo === "mascota" && !(claveEstado(r.c) in estados)).map(r => r.c));
    leeEstados(cambios.flatMap(t => [...t.dar, ...t.pedir]).filter(r => r.tipo === "mascota" && !(claveEstado(r.c) in estados)).map(r => r.c));
    const m = monedasDe(uid, d), pend = cambios.filter(t => t.estado === "pendiente" && t.para === uid).length;
    const lista = tab === "comprar" ? filtra(ofertas, f) : [];
    const sig = JSON.stringify([tab, f, max, m.saldo, lista.map(r => [r.id, r.p, r.nombre, r.etapa]), tab === "ventas" ? ventas.map(r => [r.id, r.estado]) : 0,
      tab === "cambios" ? cambios.map(t => [t.id, t.estado, t.posible]) : 0, Object.keys(estados).length]);
    if (sig === firma) return;
    firma = sig;
    const enfocado = document.activeElement && document.activeElement.id === "mkQ";
    host.innerHTML = `
    <section class="jg-mk">
      <header class="jg-mk-cab">
        <div><h1>🏪 Mercado</h1><small>${ofertas.length} ${ofertas.length === 1 ? "cosa" : "cosas"} a la venta · tienes ${MONEDA} <b>${fmt(m.saldo)}</b></small></div>
        <div class="jg-mk-ir"><a class="btn2" href="#cartas">🃏 PRODROP</a><a class="btn2" href="#mascotas">🐣 Mascotas</a></div>
      </header>
      <div class="jg-mk-seg" role="group" aria-label="Juego">${JUEGOS_MERCADO.map(([k, t]) => `<button type="button" data-juego="${k}" aria-pressed="${f.juego === k}">${t}</button>`).join("")}</div>
      ${f.juego === "mascotas" ? `<div class="jg-mk-seg chico" role="group" aria-label="Qué">${TIPOS_MASCOTAS.map(([k, t]) => `<button type="button" data-tipo="${k}" aria-pressed="${f.tipoM === k}">${t}</button>`).join("")}</div>` : ""}
      <nav class="jg-mk-tabs" role="tablist">${[["comprar", "Comprar"], ["ventas", "Mis ventas"], ["cambios", `Intercambios${pend ? ` <b>${pend}</b>` : ""}`]].map(([k, t]) =>
        `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${t}</button>`).join("")}</nav>
      ${m.parada ? `<p class="jg-mk-aviso">Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta (${MONEDA} ${fmt(m.falta)}), no puedes comprar, vender ni intercambiar.</p>` : ""}
      ${tab === "comprar" ? filtrosHtml() + gridHtml(lista, ofertas.length) : tab === "ventas" ? ventasHtml(ventas) : cambiosHtml(cambios)}
    </section>`;
    engancha();
    if (enfocado) { const qi = host.querySelector("#mkQ"); if (qi) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }
    pideMiniaturas(tab === "comprar" ? lista.slice(0, max) : tab === "ventas" ? ventas : cambios.flatMap(t => [...t.dar, ...t.pedir]));
  }

  function filtrosHtml() {
    const orden = `<label class="jg-mk-sel">Ordenar<select id="mkOrden">${[["barato", "Precio: menor a mayor"], ["caro", "Precio: mayor a menor"], ["nuevo", "Más recientes"]].map(([k, t]) =>
      `<option value="${k}"${f.orden === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
    const buscar = `<input id="mkQ" class="jg-mk-q" type="search" placeholder="Buscar por nombre…" value="${esc(f.q)}">`;
    let propios = "";
    if (f.juego === "prodrop") {
      propios = `
      <div class="jg-mk-fila">${[["", "Todas las colecciones"], ...MOTOR.COLECCIONES.map(c => [c.key, c.label])].map(([k, l]) =>
        `<button type="button" class="jg-mk-chip${f.col === k ? " on" : ""}" data-col="${k}">${esc(l)}</button>`).join("")}</div>
      <div class="jg-mk-fila">${[[-1, "Todas", "", "#a49fb3"], ...MOTOR.TIERS.map((t, i) => [i, t.label, t.sym, t.color])].map(([i, l, sy, c]) =>
        `<button type="button" class="jg-mk-chip${f.rareza === i ? " on" : ""}" data-rareza="${i}" style="--c:${c}">${sy ? `<i>${esc(sy)}</i>` : ""}${esc(l)}</button>`).join("")}</div>
      <div class="jg-mk-fila">
        <div class="jg-mk-seg chico" role="group" aria-label="Graduación">${[["todas", "Todas"], ["si", "Graduadas"], ["no", "Sin graduar"]].map(([k, t]) =>
          `<button type="button" data-grad="${k}" aria-pressed="${f.grad === k}">${t}</button>`).join("")}</div>
        ${f.grad === "si" ? `<label class="jg-mk-sel">Nota mínima<select id="mkNota"><option value="0">Cualquier nota</option>${[10, 9, 8, 7, 6, 5].map(g =>
          `<option value="${g}"${f.nota === g ? " selected" : ""}>${g === 10 ? "10 · GEM MINT" : `${g} o más · ${MOTOR.GRADE_WORD[g]}`}</option>`).join("")}</select></label>` : ""}
      </div>`;
    } else if (f.juego === "mascotas") {
      const deObjetos = f.tipoM !== "mascota", deMascotas = f.tipoM === "mascota" || f.tipoM === "todo";
      propios = `
      ${deObjetos ? `<div class="jg-mk-fila"><div class="jg-mk-seg chico" role="group" aria-label="Rareza">${[["todos", "Todos"], ["comun", "Comunes"], ["leg", "★ Legendarios"]].map(([k, t]) =>
        `<button type="button" data-leg="${k}" aria-pressed="${f.leg === k}">${t}</button>`).join("")}</div></div>` : ""}
      ${f.tipoM === "objeto" || f.tipoM === "todo" ? `<div class="jg-mk-fila">${[["", "Todos los espacios"], ...ESPACIOS.map(k => [k, NOMBRE_ESPACIO[k]])].map(([k, l]) =>
        `<button type="button" class="jg-mk-chip${f.espacio === k ? " on" : ""}" data-espacio="${k}">${esc(l)}</button>`).join("")}</div>` : ""}
      ${deMascotas ? `<div class="jg-mk-fila">${[["", "Todas las especies"], ...ESPECIES.map(s => [s.id, s.nombre])].map(([k, l]) =>
        `<button type="button" class="jg-mk-chip${f.especie === k ? " on" : ""}" data-especie="${k}">${esc(l)}</button>`).join("")}
        <label class="jg-mk-sel">Etapa<select id="mkEtapa"><option value="">Cualquiera</option>${ETAPAS.map(([k, t]) => `<option value="${k}"${f.etapa === k ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>` : ""}`;
    }
    return `<div class="jg-mk-filtros">${propios}<div class="jg-mk-fila">${orden}${buscar}</div></div>`;
  }

  function gridHtml(lista, total) {
    if (!lista.length) return `<div class="jg-mk-vacio"><b>🏪</b><p>${total ? "Nada calza con esos filtros." : "Todavía nadie vende nada. Pon a la venta una carta (desde su zoom en PRODROP) o una mascota u objeto (desde su ficha en Mascotas)."}</p></div>`;
    return `<div class="jg-mk-grid">${lista.slice(0, max).map(r => {
      const caro = !r.propia && r.p > monedasDe(uid, d).saldo;
      return `<button type="button" class="jg-mk-it t-${r.tipo}${r.propia ? " mia" : ""}" data-of="${esc(r.id)}">
        <span class="jg-mk-img">${imagen(r)}</span>
        <span class="jg-mk-tx"><b${r.tipo === "mascota" ? ' translate="no"' : ""}>${esc(r.nombre)}</b><small>${esc(r.sub || "")}</small></span>
        <span class="jg-mk-pie"><b class="jg-mk-p${caro ? " caro" : ""}">${MONEDA} ${fmt(r.p)}</b>${r.propia ? '<span class="jg-mk-tuya">Tu oferta</span>' : persona(r.u, 16)}</span>
      </button>`;
    }).join("")}</div>${lista.length > max ? `<button type="button" class="btn2 jg-mk-mas" data-mas>Ver ${Math.min(LOTE, lista.length - max)} más</button>` : ""}`;
  }

  const ESTADO_V = { activa: ["En venta", "act"], vendida: ["Vendida", "ok"], retirada: ["Retirada", ""], impaga: ["No se pagó", "mal"], rechazada: ["No cabía en su corral", "mal"] };
  const cuando = t => { const mn = Math.round((fb.ahora() - t) / 60000); return mn < 1 ? "recién" : mn < 60 ? `hace ${mn} min` : mn < 1440 ? `hace ${Math.round(mn / 60)} h` : `hace ${Math.round(mn / 1440)} d`; };
  function ventasHtml(l) {
    const nota = `<p class="jg-mk-nota">Se vende desde cada juego: una carta desde su zoom en PRODROP, una mascota u objeto desde su ficha en Mascotas. Mientras está a la venta nadie lo usa.</p>`;
    if (!l.length) return nota + `<div class="jg-mk-vacio"><b>💰</b><p>Todavía no vendes ni compras nada.</p></div>`;
    return nota + `<div class="jg-mk-lista">${l.map(o => {
      const [et, cl] = o.compra ? ["Comprada", "ok"] : ESTADO_V[o.estado] || [o.estado, ""];
      const con = o.compra ? `a ${persona(o.u, 16)}` : o.estado === "vendida" ? `a ${persona(o.comprador, 16)}` : "";
      return `<div class="jg-mk-fv">
        <span class="jg-mk-img chica">${imagen(o)}</span>
        <span class="jg-mk-fv-tx"><span class="jg-mk-est ${cl}">${et}</span><b${o.tipo === "mascota" ? ' translate="no"' : ""}>${esc(o.nombre)}</b><small>${esc(o.sub || "")} ${con ? "· " + con : ""}</small><small>${cuando(o.fin || o.at)}</small></span>
        <span class="jg-mk-fv-p">${o.compra ? "−" : o.estado === "vendida" ? "+" : ""}${MONEDA} ${fmt(o.p)}</span>
        ${o.estado === "activa" && o.u === uid ? `<button type="button" class="btn2 jg-mk-mini" data-retira="${esc(o.id)}">Retirar</button>` : ""}
      </div>`;
    }).join("")}</div>`;
  }

  const ESTADO_T = { pendiente: ["Pendiente", "act"], hecho: ["Hecho", "ok"], nulo: ["No se pudo", "mal"], cerrado: ["Cerrado", ""] };
  function lado(xs, titulo, vacio) {
    return `<div class="jg-mk-lado"><small>${titulo}</small><div class="jg-mk-cosas">${xs.length ? xs.map(x => `<span class="jg-mk-img chica" title="${esc(x.nombre)}">${imagen(x)}</span>`).join("") : `<span class="jg-mk-nada">${vacio}</span>`}</div></div>`;
  }
  function cambiosHtml(l) {
    const yo = intercambiables(d, uid, estados), otros = Object.keys(gente(d, uid)).length, parada = monedasDe(uid, d).parada;
    let html = `<div class="jg-mk-fila"><button type="button" class="btn" data-nuevo${!yo.length || !otros || parada ? " disabled" : ""}>⇄ Proponer un intercambio</button>
      <p class="jg-mk-nota">${!yo.length ? "Necesitas algo tuyo que no esté a la venta (lo inicial no se cambia)." : !otros ? "Todavía nadie más tiene qué cambiar." : "Ofrece de 1 a 3 cosas tuyas (cartas, objetos o mascotas) a cambio de hasta 3 de otra persona. Se hace cuando la otra persona acepta."}</p></div>`;
    if (!l.length) return html + `<div class="jg-mk-vacio"><b>⇄</b><p>No tienes intercambios todavía.</p></div>`;
    return html + `<div class="jg-mk-lista">${l.map(t => {
      const yoDoy = t.de === uid, otro = yoDoy ? t.para : t.de, [et, cl] = ESTADO_T[t.estado] || [t.estado, ""];
      const deMi = yoDoy ? t.dar : t.pedir, deEl = yoDoy ? t.pedir : t.dar;
      let acc = "";
      if (t.estado === "pendiente") acc = yoDoy ? `<button type="button" class="btn2 jg-mk-mini" data-cierra="${esc(t.id)}">Cancelar</button>`
        : `<button type="button" class="btn jg-mk-mini" data-acepta="${esc(t.id)}"${t.posible ? "" : " disabled"}>Aceptar</button><button type="button" class="btn2 jg-mk-mini" data-cierra="${esc(t.id)}">Rechazar</button>`;
      return `<div class="jg-mk-trato ${t.estado}">
        <header><span class="jg-mk-est ${cl}">${et}</span>${persona(otro, 20)}<small>${yoDoy ? "le propusiste" : "te propone"} · ${cuando(t.fin || t.at)}</small></header>
        <div class="jg-mk-trato-c">${lado(deMi, "Tú das", "nada")}<span class="jg-mk-flecha" aria-hidden="true">⇄</span>${lado(deEl, "Recibes", "nada (un regalo)")}</div>
        ${t.estado === "pendiente" && !t.posible ? '<p class="jg-mk-nota err">Ya no se puede: algo cambió de dueño o está a la venta.</p>' : ""}
        ${acc ? `<div class="jg-mk-acc">${acc}</div>` : ""}</div>`;
    }).join("")}</div>`;
  }

  function engancha() {
    const $$ = s => host.querySelectorAll(s), uno = (s, fn) => { const el = host.querySelector(s); if (el) fn(el); };
    const cambia = (k, v) => { f[k] = v; max = LOTE; firma = ""; pinta(); };
    $$("[data-juego]").forEach(b => b.onclick = () => { f.juego = b.dataset.juego; history.replaceState(null, "", f.juego === "todo" ? "#mercado" : "#mercado/" + f.juego); max = LOTE; firma = ""; pinta(); });
    $$("[data-tipo]").forEach(b => b.onclick = () => cambia("tipoM", b.dataset.tipo));
    $$("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; firma = ""; pinta(); });
    $$("[data-col]").forEach(b => b.onclick = () => cambia("col", b.dataset.col));
    $$("[data-rareza]").forEach(b => b.onclick = () => cambia("rareza", +b.dataset.rareza));
    $$("[data-grad]").forEach(b => b.onclick = () => { if (b.dataset.grad !== "si") f.nota = 0; cambia("grad", b.dataset.grad); });
    $$("[data-leg]").forEach(b => b.onclick = () => cambia("leg", b.dataset.leg));
    $$("[data-espacio]").forEach(b => b.onclick = () => cambia("espacio", b.dataset.espacio));
    $$("[data-especie]").forEach(b => b.onclick = () => cambia("especie", b.dataset.especie));
    uno("#mkNota", el => el.onchange = () => cambia("nota", +el.value));
    uno("#mkEtapa", el => el.onchange = () => cambia("etapa", el.value));
    uno("#mkOrden", el => el.onchange = () => cambia("orden", el.value));
    uno("#mkQ", el => el.oninput = () => cambia("q", el.value));
    uno("[data-mas]", el => el.onclick = () => { max += LOTE; firma = ""; pinta(); });
    $$("[data-of]").forEach(b => b.onclick = () => abreDetalle(b.dataset.of));
    $$("[data-retira]").forEach(b => b.onclick = () => accion(b, "retirar", { id: b.dataset.retira }, "Retirada del mercado."));
    $$("[data-acepta]").forEach(b => b.onclick = () => accion(b, "aceptar", { id: b.dataset.acepta }, "¡Intercambio hecho!"));
    $$("[data-cierra]").forEach(b => b.onclick = () => accion(b, "cerrar", { id: b.dataset.cierra }, "Cerrado."));
    uno("[data-nuevo]", el => el.onclick = () => abreTrato());
  }

  /* ---------- el detalle de una oferta ---------- */
  function abreDetalle(id) {
    const r = ofertasMercado(d, uid, estados).find(x => x.id === id);
    if (!r) return;
    cierraDetalle();
    const capa = document.createElement("div");
    capa.className = "jg-mk-capa";
    const propia = r.u === uid, motivo = propia ? "" : puedeComprar(d, uid, r.id);
    capa.innerHTML = `<div class="jg-mk-det" role="dialog" aria-modal="true" aria-label="${esc(r.nombre)}">
      <button type="button" class="jg-mk-x" aria-label="Cerrar">✕</button>
      <div class="jg-mk-det-vis${r.tipo === "carta" ? " carta" : ""}">${r.tipo === "carta" ? miniCarta(r.cp) : imagen(r, true)}</div>
      <div class="jg-mk-det-tx">
        <h2${r.tipo === "mascota" ? ' translate="no"' : ""}>${esc(r.nombre)}</h2>
        <p>${esc(r.sub || "")}${r.tipo === "carta" && r.gr ? ` · nota ${r.g} (${esc(MOTOR.GRADE_WORD[r.g])})` : ""}${r.tipo === "carta" && !r.gr ? " · sin graduar" : ""}${r.frozen ? " · 🧪 tomó la poción eterna" : ""}</p>
        ${r.tipo === "mascota" ? `<p class="jg-mk-nota">Llega con su etapa, su crecimiento y sus colores. Lo que lleva puesto se queda con quien la vende.</p>` : ""}
        <p class="jg-mk-det-p">${MONEDA} <b>${fmt(r.p)}</b></p>
        <p>${propia ? "Es tu oferta." : `Vende ${persona(r.u, 22)}`}</p>
        ${motivo && !propia ? `<p class="jg-mk-nota err">${esc(motivo)}</p>` : ""}
        <div class="jg-mk-acc">${propia ? `<button type="button" class="btn2" data-det-retira>Retirar del mercado</button>`
          : `<button type="button" class="btn" data-det-compra${motivo ? " disabled" : ""}>Comprar · ${MONEDA} ${fmt(r.p)}</button>`}</div>
      </div></div>`;
    document.body.appendChild(capa);
    const cierra = () => cierraDetalle();
    capa.addEventListener("click", e => { if (e.target === capa) cierra(); });
    capa.querySelector(".jg-mk-x").onclick = cierra;
    const tecla = e => { if (e.key === "Escape") cierra(); };
    document.addEventListener("keydown", tecla);
    detalle = { capa, tecla };
    const vis = capa.querySelector(".jg-mk-det-vis");
    if (r.tipo !== "carta") {
      const p = pedidoDe(r);
      if (p) { vis.classList.add("vivo"); const v = document.createElement("div"); v.className = "jg-mk-vivo"; vis.appendChild(v); detalle.visor = montaVisor(v, p); }
    }
    const b1 = capa.querySelector("[data-det-compra]"), b2 = capa.querySelector("[data-det-retira]");
    if (b1) b1.onclick = () => accion(b1, "comprar", { id: r.id }, r.tipo === "mascota" ? `¡${r.nombre} es tuya! Está en tu corral.` : "¡Comprado!").then(ok => ok && cierra());
    if (b2) b2.onclick = () => accion(b2, "retirar", { id: r.id }, "Retirada del mercado.").then(ok => ok && cierra());
    capa.querySelector(".jg-mk-x").focus();
  }
  function cierraDetalle() {
    if (!detalle) return;
    if (detalle.visor) detalle.visor.cierra();
    document.removeEventListener("keydown", detalle.tecla);
    detalle.capa.remove();
    detalle = null;
  }

  /* ---------- proponer un intercambio ---------- */
  function abreTrato() {
    trato = { para: "", dar: [], pedir: [] };
    const capa = document.createElement("div");
    capa.className = "jg-mk-capa";
    capa.innerHTML = `<div class="jg-mk-det jg-mk-tc" role="dialog" aria-modal="true" aria-label="Proponer un intercambio"><button type="button" class="jg-mk-x" aria-label="Cerrar">✕</button><div class="jg-mk-tc-c"></div></div>`;
    document.body.appendChild(capa);
    const cierra = () => { capa.remove(); document.removeEventListener("keydown", tecla); trato = null; };
    const tecla = e => { if (e.key === "Escape") cierra(); };
    document.addEventListener("keydown", tecla);
    capa.addEventListener("click", e => { if (e.target === capa) cierra(); });
    capa.querySelector(".jg-mk-x").onclick = cierra;
    trato.capa = capa; trato.cierra = cierra;
    pintaTrato();
  }
  function pintaTrato() {
    if (!trato) return;
    const box = trato.capa.querySelector(".jg-mk-tc-c"), g = gente(d, uid);
    if (!trato.para) {
      const js = Object.entries(g).sort((a, b) => quien(a[0]).nombre.localeCompare(quien(b[0]).nombre));
      box.innerHTML = `<h2>¿Con quién?</h2><div class="jg-mk-gente">${js.map(([u, l]) =>
        `<button type="button" class="jg-mk-persona" data-u="${esc(u)}">${persona(u, 30)}<small>${l.length} ${l.length === 1 ? "cosa" : "cosas"}</small></button>`).join("") || '<p class="jg-nada">Nadie tiene qué cambiar todavía.</p>'}</div>`;
      box.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { trato.para = b.dataset.u; pintaTrato(); });
      return;
    }
    const mias = intercambiables(d, uid, estados), suyas = (g[trato.para] || []).map(c => fichaCopia(c, d, estados)).filter(Boolean);
    leeEstados([...mias, ...suyas].filter(r => r.tipo === "mascota" && !(claveEstado(r.c) in estados)).map(r => r.c));
    const rej = (l, eleg, lado) => `<div class="jg-mk-rej" data-lado="${lado}">${l.map(x =>
      `<button type="button" class="jg-mk-elige${eleg.includes(x.c) ? " on" : ""}" data-c="${esc(x.c)}" title="${esc(x.nombre)}"><span class="jg-mk-img chica">${imagen(x)}</span><small${x.tipo === "mascota" ? ' translate="no"' : ""}>${esc(x.nombre)}</small></button>`).join("") || '<p class="jg-mk-nota">Nada para elegir.</p>'}</div>`;
    const motivo = trato.dar.length ? puedeProponer(d, uid, trato.para, trato.dar, trato.pedir) : "Elige al menos una cosa tuya.";
    box.innerHTML = `<div class="jg-mk-tc-cab"><button type="button" class="btn2 jg-mk-mini" data-otra>‹ Otra persona</button>${persona(trato.para, 24)}</div>
      <div class="jg-mk-tc-cols">
        <section><h3>Tú das <small>${trato.dar.length}/3</small></h3>${rej(mias, trato.dar, "dar")}</section>
        <section><h3>Pides <small>${trato.pedir.length}/3</small></h3>${rej(suyas, trato.pedir, "pedir")}</section>
      </div>
      <div class="jg-mk-acc"><button type="button" class="btn" data-envia${motivo ? " disabled" : ""}>Enviar propuesta</button>
        <span class="jg-mk-nota">${esc(motivo || (trato.pedir.length ? "" : "Sin pedir nada, es un regalo."))}</span></div>`;
    pideMiniaturas([...mias, ...suyas]);
    box.querySelector("[data-otra]").onclick = () => { trato.para = ""; trato.dar = []; trato.pedir = []; pintaTrato(); };
    box.querySelectorAll(".jg-mk-rej").forEach(r => r.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
      const l = trato[r.dataset.lado], c = b.dataset.c, i = l.indexOf(c);
      if (i >= 0) l.splice(i, 1); else if (l.length < 3) l.push(c); else return;
      const top = r.scrollTop; pintaTrato();
      const r2 = box.querySelector(`.jg-mk-rej[data-lado="${r.dataset.lado}"]`); if (r2) r2.scrollTop = top;
    }));
    const env = box.querySelector("[data-envia]");
    env.onclick = () => accion(env, "proponer", { para: trato.para, dar: trato.dar.slice(), pedir: trato.pedir.slice() }, "Propuesta enviada.")
      .then(ok => { if (ok) { trato.cierra(); tab = "cambios"; firma = ""; pinta(); } });
  }

  /* ---------- las escrituras, de a una ---------- */
  function avisa(texto, mal) {
    const t = document.createElement("div");
    t.className = "jg-mk-toast" + (mal ? " mal" : "");
    t.setAttribute("role", "status");
    t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function accion(boton, que, x, exito) {
    if (boton) boton.disabled = true;
    const tarea = ocupado.then(async () => {
      if (!d || !d.completo) throw new Error("Todavía se está cargando tu cuenta.");
      const e = eco();
      if (que === "comprar") {
        const motivo = puedeComprar(d, uid, x.id);
        if (motivo) throw new Error(motivo);
        await fb.comprarOferta(uid, x.id);
        const fin = economia(d).ofertas[x.id];
        if (!fin || fin.estado !== "vendida" || fin.comprador !== uid) throw new Error("Alguien se te adelantó: eso ya no está a la venta.");
      } else if (que === "retirar") {
        const o = e.ofertas[x.id];
        if (!o || o.u !== uid || o.estado !== "activa") throw new Error("Esa oferta ya no está a la venta.");
        await fb.retirarOferta(x.id);
      } else if (que === "proponer") {
        const motivo = puedeProponer(d, uid, x.para, x.dar, x.pedir);
        if (motivo) throw new Error(motivo);
        await fb.proponerCambio(uid, x.para, x.dar, x.pedir);
      } else if (que === "aceptar") {
        const t = d.mercado && d.mercado.t && d.mercado.t[x.id];
        if (!t || t.para !== uid || t.ok || t.x) throw new Error("Ese intercambio ya no está pendiente.");
        const dar = Object.values(t.dar || {}), pedir = Object.values(t.pedir || {});
        const motivo = puedeProponer(d, t.de, uid, dar, pedir);
        if (motivo) throw new Error("Ya no se puede: " + motivo.charAt(0).toLowerCase() + motivo.slice(1));
        await fb.aceptarCambio(x.id);
      } else if (que === "cerrar") {
        const t = d.mercado && d.mercado.t && d.mercado.t[x.id];
        if (!t || (t.de !== uid && t.para !== uid) || t.ok || t.x) throw new Error("Ese intercambio ya no está pendiente.");
        await fb.cerrarCambio(x.id);
      }
    });
    ocupado = tarea.catch(() => {});
    return tarea.then(() => { avisa(exito); firma = ""; pinta(); return true; }, err => {
      if (boton) boton.disabled = false;
      const permiso = /permission|denied/i.test((err && (err.code || err.message)) || "");
      avisa(permiso ? "La base todavía no acepta esto: falta publicar las reglas nuevas en la consola de Firebase." : (err && err.message) || "No se pudo.", true);
      return false;
    });
  }

  return {
    montar(el) {
      host = el;
      pinta();
      off = datos(x => { d = x; pinta(); if (trato && trato.capa.isConnected) pintaTrato(); });
    },
    refresca() { firma = ""; pinta(); },
    destruir() {
      muerto = true;
      if (off) off();
      cierraDetalle();
      if (trato) trato.cierra();
      if (host) host.innerHTML = "";
      host = null;
    }
  };
}
