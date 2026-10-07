/* ============================================================
   El panel de administración (`#admin`), solo para quien está en
   `admins/<uid>` (eso se escribe a mano en la consola de Firebase).

   Cuatro pestañas:
   - **Récords**: cada récord del club que sube al podio (1.º a 3.º) de su
     tabla deja una revisión (`revisiones/<cat>/<uid>`). Aquí se abre, se
     baja su prueba, se pasa por el verificador y —en Tetris, Snake, sortEm
     y el buscaminas, los juegos que repeticion.js sabe rehacer— se ve la
     repetición de la partida. Se conserva o se elimina.
   - **Auditoría**: lo que hacía `scripts/auditar-club.cjs` sobre una
     exportación, hecho aquí contra la base viva. Primero las señales que
     no piden bajar nada (la tabla ya está en memoria: es la misma lectura
     que usan las monedas y los logros); después, a pedido, las pruebas que
     nadie auditó todavía. Cada veredicto se guarda en `auditados`, así que
     ningún administrador vuelve a bajar la misma prueba.
   - **Monedas**: sumar o restar a una cuenta (`ajustesMonedas`). Antes de
     escribir se comprueba que restar no deje la cuenta «parada» (una
     compra suya quedaría sin fondos y se anularía).
   - **Suspensiones**: dejar a alguien fuera de Juegos el tiempo que se
     elija, con la pantalla de «WASTED» (castigo.js). También el veto de
     siempre, para las tablas.

   El panel es la cara, no la llave: las reglas de Firebase vuelven a
   comprobar que quien escribe está en `admins`.
   ============================================================ */
import {
  auditaSenales, auditadosMalos, pruebasPendientes, AUDITORIA_V, juntaHallazgos, listaRevisiones,
  duracionMs, formatoDuracion, duracionTexto, listaSuspensiones, ajusteValido, sumaAjustes, listaAjustes, AJUSTE_MAX
} from "./admin-datos.js";
import { verificaClub, juegoDeCategoria, sospechaFila, VERIFICADORES } from "./solo/verifica.js";
import { crearRepro } from "./repeticion.js";
import { repDe } from "./rieles-datos.js";
import { nombreCategoria } from "./perfil-tarjeta.js";
import { monedasDe, formatoMonedas } from "./monedas.js";

// Escapa texto para meterlo en HTML sin que nadie cuele etiquetas
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Milisegundos a «12,34 s»
const seg = ms => Number.isFinite(ms) ? (ms / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 }) + " s" : "—";
// Una fecha corta, en la hora de quien mira
const fecha = at => at ? new Date(at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—";
// Bytes a «12 kB» / «1,2 MB»
const peso = b => b < 1e6 ? Math.round(b / 1000) + " kB" : (b / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " MB";
const PRESETS = [["1h", "1 hora"], ["1d", "1 día"], ["3d", "3 días"], ["1s", "1 semana"], ["30d", "30 días"]];

/* `ctx` = {uid, fb, datos (datosPerfil), nombre(uid), ahora()}. */
export function crearAdmin(ctx) {
  const { uid: yo, fb } = ctx;
  let host = null, muerto = false;
  let pestaña = "records";
  let datos = null, adm = { revisiones: {}, suspensiones: {}, vetados: {} }, errAdm = {};
  let auditados = null, cargandoAud = false, verificando = null, autoVerificado = false;   // verificando: {hechas, total, bytes}
  let verSinPrueba = false;
  let cuenta = "";                       // la cuenta elegida en Monedas / Suspensiones
  let detalle = null;                    // {categoria, uid, partida, nombre, puntos, tiempo, lugar, origen}
  let player = null;                     // el reproductor abierto (se destruye al cerrar)
  const pruebas = new Map();             // "cat|uid|partida" → {prueba, at, bytes, motivo} ya bajadas en esta visita
  let offDatos = null, offAdm = null, aviso = "";

  /* ---------- la cáscara ---------- */
  function montar(h) {
    host = h;
    offDatos = ctx.datos(d => { datos = d; pinta(); });
    offAdm = fb.watchAdmin((d, err) => { adm = d; errAdm = err; pinta(); });
    host.addEventListener("click", alClic);
    host.addEventListener("submit", alEnviar);
    host.addEventListener("input", alEscribir);
    pinta();
  }
  function destruir() {
    muerto = true;
    if (offDatos) offDatos();
    if (offAdm) offAdm();
    cierraPlayer();
    if (host) { host.removeEventListener("click", alClic); host.removeEventListener("submit", alEnviar); host.removeEventListener("input", alEscribir); host.innerHTML = ""; }
  }

  const permiso = e => /permission/i.test(String(e && (e.code || e.message)));
  function pinta() {
    if (muerto || !host) return;
    /* El repintado no toca el reproductor: vive en su propio nodo y se
       mueve tal cual al HTML nuevo. */
    const pl = host.querySelector(".jg-adm-player");
    const foco = document.activeElement && host.contains(document.activeElement) ? document.activeElement.id : "";
    /* Lo escrito en los formularios sobrevive al repintado: las tablas
       cambian cada vez que alguien juega, y cada cambio repinta. */
    const escrito = {};
    for (const i of host.querySelectorAll("input[id], select[id]")) escrito[i.id] = i.value;
    const nRev = listaRevisiones(adm.revisiones, datos && datos.solo).length;
    const nSus = listaSuspensiones(adm.suspensiones, ctx.ahora()).length;
    const sinReglas = Object.values(errAdm || {}).some(permiso);
    host.innerHTML = `<section class="jg-adm">
      <header class="jg-adm-cab"><h1>🛡️ Administración</h1>
        <p>Lo que se hace aquí lo vuelven a comprobar las reglas de Firebase. Las pruebas de las partidas solo se bajan cuando hacen falta.</p></header>
      ${sinReglas ? `<p class="jg-adm-aviso">Faltan publicar las reglas nuevas en la consola de Firebase (revisiones, suspensiones, auditados, ajustesMonedas). Hasta entonces el panel no puede leer ni escribir.</p>` : ""}
      ${aviso ? `<p class="jg-adm-aviso" role="status">${esc(aviso)}</p>` : ""}
      <nav class="jg-adm-tabs" role="tablist">
        ${[["records", `Récords${nRev ? ` <b>${nRev}</b>` : ""}`], ["auditoria", "Auditoría"], ["monedas", "Monedas"], ["suspensiones", `Suspensiones${nSus ? ` <b>${nSus}</b>` : ""}`]]
          .map(([k, t]) => `<button type="button" role="tab" class="btn2${pestaña === k ? " on" : ""}" data-tab="${k}" aria-selected="${pestaña === k}">${t}</button>`).join("")}
      </nav>
      ${detalle ? detalleHtml() : ""}
      <div class="jg-adm-cuerpo">${pestaña === "records" ? recordsHtml() : pestaña === "auditoria" ? auditoriaHtml() : pestaña === "monedas" ? monedasHtml() : suspensionesHtml()}</div>
    </section>`;
    if (pl) { const sitio = host.querySelector(".jg-adm-player-sitio"); if (sitio) sitio.replaceWith(pl); else cierraPlayer(); }
    for (const [id, v] of Object.entries(escrito)) { const i = host.querySelector("#" + id); if (i && id !== "admBusca") i.value = v; }
    if (foco) { const f = host.querySelector("#" + foco); if (f) { f.focus(); if (f.setSelectionRange && typeof f.value === "string") f.setSelectionRange(f.value.length, f.value.length); } }
  }

  const nombre = u => ctx.nombre(u) || u.slice(0, 8) + "…";

  /* ---------- récords por revisar ---------- */
  function recordsHtml() {
    if (!datos) return `<p class="jg-nada">Cargando las tablas…</p>`;
    const l = listaRevisiones(adm.revisiones, datos.solo);
    if (!l.length) return `<p class="jg-nada">No hay récords esperando. Cada vez que alguien sube al podio de una tabla del club aparece aquí.</p>`;
    return `<ul class="jg-adm-lista">${l.map(r => `<li class="${r.vigente ? "" : "viejo"}">
      <div><b>${esc(nombreCategoria(r.categoria))}</b> · ${["", "🥇", "🥈", "🥉"][r.lugar] || ""} puesto ${esc(r.lugar)}
        <small>${esc(r.nombre || nombre(r.uid))} · ${esc(r.puntos)} pts · ${seg(r.tiempo)} · ${fecha(r.at)}</small>
        ${r.vigente ? "" : `<small class="jg-adm-mal">La fila ya no es esta partida (mejoró otra vez o se borró).</small>`}</div>
      <span class="jg-adm-btns">
        ${r.vigente ? `<button type="button" class="btn2" data-ver="${esc(r.categoria)}|${esc(r.uid)}|${esc(r.partida)}|revision">Ver</button>` : ""}
        <button type="button" class="btn2" data-descarta="${esc(r.categoria)}|${esc(r.uid)}">Descartar</button></span></li>`).join("")}</ul>`;
  }

  /* ---------- el detalle de una partida: prueba, veredicto y repetición ---------- */
  function detalleHtml() {
    const d = detalle, k = d.categoria + "|" + d.uid + "|" + d.partida, p = pruebas.get(k);
    const fila = ((datos && datos.solo) || {})[d.categoria] && datos.solo[d.categoria][d.uid];
    const vigente = !!(fila && fila.partida === d.partida);
    let estado = `<p class="jg-nada">Bajando la prueba…</p>`;
    if (p) {
      estado = p.error ? `<p class="jg-adm-mal">${esc(p.error)}</p>`
        : `<p class="${p.motivo ? "jg-adm-mal" : "jg-adm-bien"}">${p.motivo ? "✗ El verificador la rechaza: " + esc(p.motivo) : "✓ El verificador la acepta."}</p>
           <p class="jg-adm-nota">Prueba de ${peso(p.bytes)} · guardada el ${fecha(p.at)}.</p>
           ${p.repro ? `<div class="jg-adm-player-sitio"></div>` : `<p class="jg-adm-nota">Este juego todavía no tiene repetición: solo se puede ver el veredicto del verificador${p.prueba ? " y la prueba en bruto" : ""}.</p>
             ${p.prueba ? `<details><summary>Ver la prueba</summary><pre class="jg-adm-pre">${esc(JSON.stringify(p.prueba, null, 1).slice(0, 20000))}</pre></details>` : ""}`}`;
    }
    return `<section class="jg-adm-detalle" aria-label="Partida">
      <header><div><b>${esc(nombreCategoria(d.categoria))}</b><small>${esc(d.nombre || nombre(d.uid))} · ${esc(fila ? fila.puntos : d.puntos)} pts · ${seg(fila ? fila.tiempo : d.tiempo)}${vigente ? "" : " · ya no está en la tabla"}</small></div>
        <button type="button" class="btn2" data-cierra>✕</button></header>
      ${estado}
      <div class="jg-adm-btns">
        ${vigente ? `<button type="button" class="btn2" data-conserva>✓ Conservar</button>
        <button type="button" class="btn2 jg-adm-rojo" data-elimina>🗑 Eliminar récord</button>
        <button type="button" class="btn2 jg-adm-rojo" data-elimina-susp>🗑 Eliminar y suspender…</button>` : ""}
      </div></section>`;
  }

  async function abreDetalle(categoria, uid, partida, origen) {
    cierraPlayer();
    const fila = ((datos && datos.solo) || {})[categoria] && datos.solo[categoria][uid];
    const r = ((adm.revisiones || {})[categoria] || {})[uid];
    detalle = { categoria, uid, partida, origen, nombre: (fila && fila.nombre) || (r && r.n) || "", puntos: fila ? fila.puntos : r && r.pts, tiempo: fila ? fila.tiempo : r && r.t };
    pinta();
    host.querySelector(".jg-adm-detalle")?.scrollIntoView({ block: "start", behavior: "smooth" });
    const k = categoria + "|" + uid + "|" + partida;
    if (!pruebas.has(k)) {
      const juego = juegoDeCategoria(categoria);
      let x;
      try {
        const pr = await fb.leerPruebaSolo(categoria, uid, partida);            // la única descarga: la prueba de esta partida
        if (!pr) x = { error: "No hay prueba guardada para esta partida." };
        else {
          let prueba = null;
          try { prueba = pr.d ? JSON.parse(pr.d) : null; } catch (e) { prueba = null; }
          const dato = { categoria, puntos: detalle.puntos, tiempo: detalle.tiempo, partida };
          const motivo = juego ? await verificaClub(juego, dato, prueba, { uid, ahora: Number.isFinite(pr.at) ? pr.at : undefined }) : null;
          x = { prueba, at: pr.at, bytes: (pr.d || "").length, motivo, repro: !!(prueba && crearRepro(juego, prueba)) };
          /* El veredicto queda para la auditoría: no se vuelve a bajar. */
          fb.apuntaAuditado(categoria, uid, { p: partida, ok: !motivo, m: motivo || "", vv: AUDITORIA_V }).then(() => { if (auditados) ((auditados[categoria] = auditados[categoria] || {})[uid] = { p: partida, ok: !motivo, m: motivo || "", vv: AUDITORIA_V }); }, () => {});
        }
      } catch (e) { x = { error: "No se pudo bajar la prueba: " + (e && e.message || e) }; }
      pruebas.set(k, x);
    }
    if (muerto || !detalle || detalle.categoria !== categoria || detalle.uid !== uid) return;
    pinta();
    const p = pruebas.get(k);
    if (p && p.repro) montaPlayer(juegoDeCategoria(categoria), p.prueba);
  }

  /* El reproductor: la partida rehecha paso a paso con el mismo motor
     (repeticion.js), con barra para saltar y velocidad. */
  function montaPlayer(juego, prueba) {
    cierraPlayer();
    const sitio = host.querySelector(".jg-adm-player-sitio");
    const repro = crearRepro(juego, prueba);
    if (!sitio || !repro) return;
    const el = document.createElement("div");
    el.className = "jg-adm-player";
    el.innerHTML = `<div class="jg-adm-lienzo"><canvas></canvas></div>
      <div class="jg-adm-ctl"><button type="button" class="btn2" data-pp aria-label="Pausa">❚❚</button>
        <input type="range" min="0" max="${Math.round(repro.dur)}" step="10" value="0" aria-label="Momento de la partida">
        <span class="jg-adm-t" translate="no"></span>
        <select aria-label="Velocidad">${[1, 2, 4, 8, 16].map(v => `<option value="${v}">×${v}</option>`).join("")}</select></div>
      <p class="jg-adm-nota jg-adm-marca" translate="no"></p>`;
    sitio.replaceWith(el);
    const canvas = el.querySelector("canvas"), rango = el.querySelector("input"), vel = el.querySelector("select");
    const pp = el.querySelector("[data-pp]"), tx = el.querySelector(".jg-adm-t"), marca = el.querySelector(".jg-adm-marca");
    let t = 0, corre = true, antes = performance.now(), raf = 0;
    const cuadro = ahora => {
      raf = requestAnimationFrame(cuadro);
      if (corre) { t = Math.min(repro.dur, t + (ahora - antes) * (+vel.value || 1)); if (t >= repro.dur) { corre = false; pp.textContent = "▶"; pp.setAttribute("aria-label", "Ver"); } }
      antes = ahora;
      dibuja(ahora);
    };
    function dibuja(ahora) {
      const caja = canvas.parentElement, w = caja.clientWidth;
      if (!w) return;
      const h = Math.min(Math.round(w * repro.aspecto), Math.round(window.innerHeight * 0.7));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        canvas.style.width = w + "px"; canvas.style.height = h + "px";
      }
      repro.en(t);                                                                // deja el motor en este instante
      const g = canvas.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      repro.pinta(g, w, h, ahora / 1000);
      rango.value = String(Math.round(t));
      tx.textContent = seg(t) + " / " + seg(repro.dur);
      const m = repro.marcador();
      marca.textContent = `En pantalla: ${m.puntos} pts · ${seg(m.tiempo)}${m.extra ? " · " + m.extra : ""}`;
    }
    pp.onclick = () => { if (!corre && t >= repro.dur) t = 0; corre = !corre; pp.textContent = corre ? "❚❚" : "▶"; pp.setAttribute("aria-label", corre ? "Pausa" : "Ver"); };
    rango.oninput = () => { t = +rango.value; };
    raf = requestAnimationFrame(cuadro);
    player = { el, para: () => cancelAnimationFrame(raf) };
  }
  function cierraPlayer() { if (player) { player.para(); player.el.remove(); player = null; } }

  async function eliminaDetalle() {
    const d = detalle;
    if (!d || !confirm(`¿Eliminar el récord de ${d.nombre || nombre(d.uid)} en ${nombreCategoria(d.categoria)}? Se borran la fila y su prueba; no se puede deshacer.`)) return false;
    try {
      await fb.borraRecord(d.categoria, d.uid, d.partida, !!repDe(d.categoria));
      aviso = "Récord eliminado.";
      detalle = null; cierraPlayer();
      pinta();
      return true;
    } catch (e) { alert("No se pudo eliminar: " + (e && e.message || e)); return false; }
  }

  /* ---------- la auditoría ---------- */
  const revisadaAMano = (cat, u, partida) => { const a = ((auditados || {})[cat] || {})[u]; return !!(a && a.h && a.p === partida); };
  function hallazgos() {
    const solo = (datos && datos.solo) || {};
    const sen = auditaSenales(solo, sospechaFila, adm.vetados).filter(h => !revisadaAMano(h.categoria, h.uid, h.partida));
    const malos = auditadosMalos(solo, auditados, adm.vetados).filter(h => verSinPrueba || !h.motivos.every(m => /sin prueba/.test(m)));
    return juntaHallazgos(sen, malos);
  }
  function auditoriaHtml() {
    if (!datos) return `<p class="jg-nada">Cargando las tablas…</p>`;
    if (!auditados) {
      if (!cargandoAud) { cargandoAud = true; fb.leerAuditados().then(a => { auditados = a; }, () => { auditados = {}; }).then(() => { cargandoAud = false; pinta(); }); }
      return `<p class="jg-nada">Leyendo lo ya auditado…</p>`;
    }
    const pend = pruebasPendientes(datos.solo, auditados, juegoDeCategoria);
    /* Lo pendiente se audita solo, una vez por visita: al subir
       AUDITORIA_V todos los récords vuelven a pasar por los verificadores
       sin que nadie tenga que acordarse de pulsar. */
    if (pend.length && !verificando && !autoVerificado) { autoVerificado = true; setTimeout(() => { if (!muerto && !verificando) verificaPendientes(); }, 0); }
    const l = hallazgos();
    const total = Object.values(datos.solo || {}).reduce((n, f) => n + Object.keys(f || {}).length, 0);
    return `<div class="jg-adm-caja">
        <p><b>${l.length}</b> filas sospechosas de ${total}. Las señales (forma de la partida, marca inverosímil o anómala) no bajan nada: la tabla ya está cargada.</p>
        ${verificando ? `<p>Verificando pruebas… <b>${verificando.hechas}</b> de ${verificando.total} · bajado ${peso(verificando.bytes)}</p>`
          : pend.length ? `<p><button type="button" class="btn" data-verifica>Verificar ${pend.length} prueba${pend.length === 1 ? "" : "s"} sin auditar</button>
            <small class="jg-adm-nota">Cada prueba se baja una sola vez: su veredicto queda guardado para todos los administradores.</small></p>`
          : `<p class="jg-adm-bien">✓ Todas las pruebas de las tablas ya están auditadas.</p>`}
        <label class="jg-adm-chk"><input type="checkbox" data-sinprueba${verSinPrueba ? " checked" : ""}> Mostrar también las filas cuyo único problema es no tener prueba (casi siempre anteriores a la verificación)</label>
      </div>
      ${l.length ? `<ul class="jg-adm-lista">${l.map(h => `<li>
        <div><b>${esc(nombreCategoria(h.categoria))}</b> · ${esc(h.nombre || nombre(h.uid))}${h.vetado ? " <em>(vetada)</em>" : ""}
          <small>${esc(h.puntos)} pts · ${seg(h.tiempo)}</small>
          <ul class="jg-adm-motivos">${h.motivos.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>
        <span class="jg-adm-btns">
          ${juegoDeCategoria(h.categoria) ? `<button type="button" class="btn2" data-ver="${esc(h.categoria)}|${esc(h.uid)}|${esc(h.partida)}|auditoria">Ver</button>` : ""}
          <button type="button" class="btn2" data-buena="${esc(h.categoria)}|${esc(h.uid)}|${esc(h.partida)}">Es buena</button>
          <button type="button" class="btn2 jg-adm-rojo" data-borra="${esc(h.categoria)}|${esc(h.uid)}|${esc(h.partida)}">Eliminar</button></span></li>`).join("")}</ul>`
        : `<p class="jg-nada">Nada llama la atención.</p>`}`;
  }

  /* Baja y verifica las pruebas pendientes, de a tres a la vez, guardando
     cada veredicto en `auditados` apenas sale. */
  async function verificaPendientes() {
    const pend = pruebasPendientes(datos.solo, auditados, juegoDeCategoria);
    verificando = { hechas: 0, total: pend.length, bytes: 0 };
    pinta();
    let i = 0;
    const una = async () => {
      while (i < pend.length && !muerto) {
        const { categoria, uid, juego, fila } = pend[i++];
        let ok = true, m = "";
        try {
          const pr = await fb.leerPruebaSolo(categoria, uid, fila.partida);
          if (!pr) { if (VERIFICADORES[juego].PRUEBA > 0) { ok = false; m = "sin prueba (anterior a la verificación, o escrita a mano)"; } }
          else {
            verificando.bytes += (pr.d || "").length;
            let prueba = null, ilegible = false;
            try { prueba = pr.d ? JSON.parse(pr.d) : null; } catch (e) { ilegible = true; }
            const motivo = ilegible ? "prueba ilegible" : await verificaClub(juego, { categoria, puntos: fila.puntos, tiempo: fila.tiempo, partida: fila.partida }, prueba, { uid, ahora: Number.isFinite(pr.at) ? pr.at : undefined });
            if (motivo) { ok = false; m = motivo; }
          }
          await fb.apuntaAuditado(categoria, uid, { p: fila.partida, ok, m, vv: AUDITORIA_V });
          ((auditados[categoria] = auditados[categoria] || {})[uid] = { p: fila.partida, ok, m, vv: AUDITORIA_V });
        } catch (e) { console.warn("[admin] no se pudo auditar", categoria, uid, e); }
        verificando.hechas++;
        if (verificando.hechas % 3 === 0) pinta();
      }
    };
    await Promise.all([una(), una(), una()]);
    verificando = null;
    pinta();
  }

  /* ---------- monedas ---------- */
  /* Las cuentas que se conocen: quien tiene alguna fila en las tablas o
     cobró algo. Sin abrir el perfil de nadie (eso sería una escucha por
     cuenta). */
  function cuentas() {
    const s = new Set();
    for (const k of ["ranks", "solo", "logros"]) for (const t of Object.values((datos && datos[k]) || {})) for (const u of Object.keys(t || {})) s.add(u);
    for (const k of ["diario", "clubJugadas", "ajustes"]) for (const u of Object.keys((datos && datos[k]) || {})) s.add(u);
    return [...s];
  }
  function buscadorHtml(ph) {
    const q = String(host && host.querySelector("#admBusca") ? host.querySelector("#admBusca").value : "").trim().toLowerCase();
    const res = q.length < 2 ? [] : cuentas().filter(u => u.toLowerCase().startsWith(q) || nombre(u).toLowerCase().includes(q)).slice(0, 8);
    return `<div class="jg-adm-busca"><input id="admBusca" class="inp" type="search" placeholder="${esc(ph)}" autocomplete="off" value="${esc(q)}">
      ${res.length ? `<ul>${res.map(u => `<li><button type="button" class="btn2" data-cuenta="${esc(u)}"><b translate="no">${esc(nombre(u))}</b> <small translate="no">${esc(u)}</small></button></li>`).join("")}</ul>` : ""}
      ${cuenta ? `<p>Cuenta elegida: <b translate="no">${esc(nombre(cuenta))}</b> <small translate="no">${esc(cuenta)}</small></p>` : ""}</div>`;
  }
  function monedasHtml() {
    if (!datos) return `<p class="jg-nada">Cargando…</p>`;
    let ficha = "";
    if (cuenta) {
      const m = monedasDe(cuenta, datos), aj = listaAjustes(datos.ajustes, cuenta);
      ficha = `<div class="jg-adm-caja">
        <p>Saldo: <b>${formatoMonedas(m.saldo)} 🪙</b> · ganadas ${formatoMonedas(m.total)} · gastadas ${formatoMonedas(m.gastadas)}${m.parada ? ` · <span class="jg-adm-mal">parada (le faltan ${formatoMonedas(m.falta)})</span>` : ""}</p>
        <p>Ajustes acumulados: <b>${formatoMonedas(sumaAjustes(datos.ajustes, cuenta))}</b></p>
        <form class="jg-adm-form" data-form="ajuste">
          <label>Cantidad (negativa para restar) <input id="admCant" class="inp" type="number" step="1" min="-${AJUSTE_MAX}" max="${AJUSTE_MAX}" required></label>
          <label>Motivo <input id="admMotivoM" class="inp" maxlength="200" placeholder="Premio del torneo, devolución, corrección…" required></label>
          <button class="btn" type="submit">Aplicar</button>
        </form>
        ${aj.length ? `<h3>Historial</h3><ul class="jg-adm-hist">${aj.map(a => `<li><b class="${a.n < 0 ? "jg-adm-mal" : "jg-adm-bien"}">${a.n > 0 ? "+" : ""}${formatoMonedas(a.n)}</b> ${esc(a.m)} <small>${fecha(a.at)} · por ${esc(nombre(a.por || ""))}</small></li>`).join("")}</ul>` : ""}
        ${datos.completo ? "" : `<p class="jg-adm-nota">Todavía no llegan todas las lecturas: el saldo puede estar incompleto.</p>`}
      </div>`;
    }
    return buscadorHtml("Busca una cuenta por nombre o uid") + ficha;
  }
  async function aplicaAjuste() {
    const n = Math.trunc(+host.querySelector("#admCant").value), motivo = host.querySelector("#admMotivoM").value.trim();
    if (!cuenta || !ajusteValido(n) || !motivo) { alert(`La cantidad tiene que ser un entero distinto de cero, de hasta ${formatoMonedas(AJUSTE_MAX)}, y hace falta un motivo.`); return; }
    if (!datos.completo) { alert("Espera a que lleguen todas las lecturas: sin ellas no se puede comprobar el saldo."); return; }
    /* Restar no puede dejar la cuenta parada: eso anularía compras que ya
       hizo. Se prueba con el ajuste puesto antes de escribirlo. */
    if (n < 0) {
      const prueba = Object.assign({}, datos, { ajustes: Object.assign({}, datos.ajustes, { [cuenta]: Object.assign({}, (datos.ajustes || {})[cuenta], { _prueba: { n } }) }) });
      const m = monedasDe(cuenta, prueba), antes = monedasDe(cuenta, datos);
      /* El saldo nunca baja de cero (monedas.js lo promete), y una compra
         que ya hizo no puede quedar sin fondos. */
      if ((m.parada && !antes.parada) || m.saldo < 0) { alert(`Restar ${formatoMonedas(-n)} dejaría la cuenta en negativo o anularía una compra suya. Como mucho se pueden restar ${formatoMonedas(Math.max(0, antes.saldo))} (y menos si vendió cartas después de gastar).`); return; }
    }
    if (!confirm(`¿${n > 0 ? "Sumar" : "Restar"} ${formatoMonedas(Math.abs(n))} monedas a ${nombre(cuenta)}?`)) return;
    try { await fb.ajustaMonedas(cuenta, n, motivo, yo); aviso = `Ajuste de ${n > 0 ? "+" : ""}${formatoMonedas(n)} aplicado a ${nombre(cuenta)}.`; vacia("#admCant", "#admMotivoM"); }
    catch (e) { aviso = "No se pudo aplicar: " + (permiso(e) ? "las reglas no lo permiten (¿están publicadas?)" : (e && e.message || e)); }
    pinta();
  }

  // Deja en blanco campos del formulario (tras aplicar, para no repetirlo sin querer)
  const vacia = (...sel) => { for (const q of sel) { const i = host.querySelector(q); if (i) i.value = ""; } };

  /* ---------- suspensiones ---------- */
  function suspensionesHtml() {
    const ahora = ctx.ahora(), l = listaSuspensiones(adm.suspensiones, ahora);
    const vet = Object.entries(adm.vetados || {});
    return buscadorHtml("Busca una cuenta para suspender") + (cuenta ? `<div class="jg-adm-caja">
        <form class="jg-adm-form" data-form="suspende">
          <label>Duración <span class="jg-adm-presets">${PRESETS.map(([v, t]) => `<button type="button" class="btn2" data-dur="${v}">${t}</button>`).join("")}</span>
            <input id="admDur" class="inp" placeholder="p. ej. 2h, 3d, 1s, 1d 12h" required></label>
          <label>Motivo (lo verá en la pantalla) <input id="admMotivoS" class="inp" maxlength="300" placeholder="Récords falsos en Tetris" required></label>
          <button class="btn2 jg-adm-rojo" type="submit">Suspender a ${esc(nombre(cuenta))}</button>
        </form>
        <p class="jg-adm-btns">${(adm.vetados || {})[cuenta] ? `<button type="button" class="btn2" data-quitaveto="${esc(cuenta)}">Quitar el veto de las tablas</button>`
          : `<button type="button" class="btn2 jg-adm-rojo" data-veta="${esc(cuenta)}">Vetar de las tablas (para siempre)</button>`}</p>
      </div>` : "") +
      `<h3>Suspendidas ahora</h3>` + (l.length ? `<ul class="jg-adm-lista">${l.map(s => `<li><div><b translate="no">${esc(nombre(s.uid))}</b>
          <small>quedan ${formatoDuracion(s.hasta - ahora)} · hasta ${fecha(s.hasta)} · por ${esc(nombre(s.por))}</small><small translate="no">«${esc(s.m)}»</small></div>
          <span class="jg-adm-btns"><button type="button" class="btn2" data-levanta="${esc(s.uid)}">Levantar</button></span></li>`).join("")}</ul>` : `<p class="jg-nada">Nadie está suspendido.</p>`) +
      `<h3>Vetadas de las tablas</h3>` + (vet.length ? `<ul class="jg-adm-lista">${vet.map(([u, v]) => `<li><div><b translate="no">${esc(nombre(u))}</b><small>${fecha(v && v.at)}${v && v.m ? " · " + esc(v.m) : ""}</small></div>
          <span class="jg-adm-btns"><button type="button" class="btn2" data-quitaveto="${esc(u)}">Quitar veto</button></span></li>`).join("")}</ul>` : `<p class="jg-nada">Nadie está vetado.</p>`);
  }
  async function aplicaSuspension(uidS, dur, motivo) {
    const ms = duracionMs(dur);
    if (!uidS || !ms || !motivo) { alert("Hace falta una cuenta, una duración que se entienda (30m, 2h, 3d, 1s; hasta un año) y un motivo."); return false; }
    if (uidS === yo) { alert("No puedes suspenderte a ti mismo."); return false; }
    if (!confirm(`¿Suspender a ${nombre(uidS)} durante ${duracionTexto(ms)}?`)) return false;
    try {
      await fb.suspende(uidS, ctx.ahora() + ms, motivo, yo);
      aviso = `${nombre(uidS)} queda suspendida ${duracionTexto(ms)}.`;
      vacia("#admDur", "#admMotivoS"); pinta(); return true;
    }
    catch (e) { alert("No se pudo suspender: " + (permiso(e) ? "las reglas no lo permiten (¿están publicadas?)" : (e && e.message || e))); return false; }
  }

  /* ---------- los eventos ---------- */
  const partes = s => String(s || "").split("|");
  async function alClic(e) {
    const b = e.target.closest("button, input[type=checkbox]");
    if (!b || !host.contains(b)) return;
    const ds = b.dataset;
    if (ds.tab) { pestaña = ds.tab; aviso = ""; pinta(); return; }
    if ("sinprueba" in ds) { verSinPrueba = b.checked; pinta(); return; }
    if (ds.ver) { const [c, u, p, o] = partes(ds.ver); abreDetalle(c, u, p, o); return; }
    if ("cierra" in ds) { detalle = null; cierraPlayer(); pinta(); return; }
    if ("conserva" in ds && detalle) {
      try { await fb.conservaRecord(detalle.categoria, detalle.uid, detalle.partida); if (auditados) ((auditados[detalle.categoria] = auditados[detalle.categoria] || {})[detalle.uid] = { p: detalle.partida, ok: true, h: true }); aviso = "Récord conservado."; detalle = null; cierraPlayer(); }
      catch (err) { aviso = "No se pudo: " + (err && err.message || err); }
      pinta(); return;
    }
    if ("elimina" in ds) { eliminaDetalle(); return; }
    if ("eliminaSusp" in ds && detalle) {
      const u = detalle.uid, c = detalle.categoria;
      const dur = prompt(`¿Cuánto tiempo suspender a ${nombre(u)}? (30m, 2h, 3d, 1s…)`, "1d");
      if (!dur) return;
      const motivo = prompt("Motivo (lo verá en la pantalla):", `Récord falso en ${nombreCategoria(c)}`);
      if (!motivo) return;
      if (await eliminaDetalle()) await aplicaSuspension(u, dur, motivo);
      return;
    }
    if (ds.descarta) { const [c, u] = partes(ds.descarta); fb.descartaRevision(c, u).catch(err => alert(err && err.message || err)); return; }
    if (ds.verifica !== undefined && !verificando) { verificaPendientes(); return; }
    if (ds.buena) {
      const [c, u, p] = partes(ds.buena);
      try { await fb.apuntaAuditado(c, u, { p, ok: true, m: "revisada a mano", h: true }); ((auditados[c] = auditados[c] || {})[u] = { p, ok: true, h: true }); } catch (err) { alert(err && err.message || err); }
      pinta(); return;
    }
    if (ds.borra) {
      const [c, u, p] = partes(ds.borra);
      if (!confirm(`¿Eliminar la fila de ${nombre(u)} en ${nombreCategoria(c)}? Se borran la fila y su prueba.`)) return;
      try { await fb.borraRecord(c, u, p, !!repDe(c)); if (auditados && auditados[c]) delete auditados[c][u]; aviso = "Fila eliminada."; } catch (err) { aviso = "No se pudo: " + (err && err.message || err); }
      pinta(); return;
    }
    if (ds.cuenta) { cuenta = ds.cuenta; const i = host.querySelector("#admBusca"); if (i) i.value = ""; pinta(); return; }
    if (ds.dur) { const i = host.querySelector("#admDur"); if (i) i.value = ds.dur; return; }
    if (ds.levanta) { if (confirm(`¿Levantar la suspensión de ${nombre(ds.levanta)}?`)) fb.levantaSuspension(ds.levanta).catch(err => alert(err && err.message || err)); return; }
    if (ds.veta) { const m = prompt(`Motivo del veto a ${nombre(ds.veta)}:`, ""); if (m !== null) fb.veta(ds.veta, m).catch(err => alert(err && err.message || err)); return; }
    if (ds.quitaveto) { if (confirm(`¿Quitar el veto a ${nombre(ds.quitaveto)}?`)) fb.quitaVeto(ds.quitaveto).catch(err => alert(err && err.message || err)); return; }
  }
  function alEnviar(e) {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    if (f.dataset.form === "ajuste") aplicaAjuste();
    if (f.dataset.form === "suspende") aplicaSuspension(cuenta, host.querySelector("#admDur").value, host.querySelector("#admMotivoS").value.trim());
  }
  /* El buscador repinta mientras se escribe (pinta() conserva el foco). */
  function alEscribir(e) { if (e.target.id === "admBusca") pinta(); }

  return { montar, destruir };
}
