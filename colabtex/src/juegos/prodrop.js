/* PRODROP — el cartero entre el abridor (un iframe en juegos/prodrop/) y
   la cuenta. Como Circuit Breakers o Clue, el documento del juego conserva
   su CSS, su audio y sus animaciones, y no sabe nada de Firebase: este
   módulo le manda la cuenta y el mercado cada vez que cambian, y hace por
   él las escrituras que puede pedir.

   Lo que se le manda sale de la **economía** (juegos/monedas.js), no de
   lo escrito: las cartas que tienes *ahora* (incluidas las compradas o
   recibidas), las ofertas que de verdad están a la venta y los
   intercambios que te tocan. Y antes de cada escritura se vuelve a
   comprobar contra esa misma economía —el iframe podría estar mirando
   algo viejo—, porque las reglas no pueden saber si alcanza el dinero ni
   de quién es una carta: sin esta comprobación, un gasto sin fondos de
   este mismo navegador pararía la cuenta. */
import { ambientar } from "./sonido.js";
import { monedasDe, economia, copiasDe, proximoGratis, leeCopia } from "./monedas.js";
import { MOTOR, MAX_EXHIBIDAS } from "./prodrop-cartas.js";

const MAX_PRECIO = 100000;

export function crearProdrop({ usuario, datos, perfil, quien, fb, volver }) {
  let host = null, frame = null, off = null, d = null, muerto = false, listo = false, ocupado = Promise.resolve();
  const uid = usuario.uid;

  function manda(x) { if (!muerto && frame && frame.contentWindow) frame.contentWindow.postMessage({ canal: "prodrop-parent", ...x }, location.origin); }
  const eco = () => economia(d);
  const cuenta = () => monedasDe(uid, d);
  function exhibidas() {
    const l = (perfil(uid) || {}).cartas;
    return (Array.isArray(l) ? l : l && typeof l === "object" ? Object.values(l) : [])
      .filter(k => typeof k === "string").map(k => (k.includes("~") ? k : uid + "~" + k)).slice(0, MAX_EXHIBIDAS);
  }
  /* Una copia lista para el iframe: con la hora de su sobre, que es lo que
     hace falta para rehacerla. */
  function copia(e, c) {
    const q = leeCopia(c), so = q && e.sobres[q.o + "~" + q.k];
    return so ? { c, o: q.o, k: q.k, i: q.i, at: so.at, gr: !!e.graduada[c] } : null;
  }
  function enviaDatos() {
    if (!listo || !d || !d.completo) return;
    const e = eco(), m = cuenta(), gente = {};
    const persona = u => { if (!gente[u]) { const q = quien(u); gente[u] = { n: q.nombre, f: q.foto || "", c: q.color }; } return u; };
    const parada = u => !!(e.usuarios[u] && e.usuarios[u].parada);
    /* El mercado: lo que está a la venta de verdad, menos lo de cuentas
       paradas (sus ofertas siguen valiendo, pero no se le ofrecen a nadie:
       comprarle a una cuenta parada sería mezclarse con sus gastos sin
       fondos). */
    const ofertas = [], mias = [];
    for (const o of Object.values(e.ofertas)) {
      const x = copia(e, o.c);
      if (!x) continue;
      const fila = Object.assign(x, { id: o.id, u: persona(o.u), p: o.p, t: o.at, estado: o.estado, fin: o.fin || 0, comprador: o.comprador ? persona(o.comprador) : "" });
      if (o.estado === "activa" && (o.u === uid || !parada(o.u))) ofertas.push(fila);
      if (o.u === uid && o.estado !== "nula") mias.push(fila);
      else if (o.comprador === uid && o.estado === "vendida") mias.push(fila);
    }
    /* Los intercambios que me tocan, con su estado. */
    const cambios = [];
    for (const [id, t] of Object.entries(d.mercado && d.mercado.t || {})) {
      if (!t || (t.de !== uid && t.para !== uid)) continue;
      const hecho = e.cambios[id];
      const estado = Number.isFinite(t.x) ? "cerrado" : hecho ? hecho.estado : "pendiente";
      const dar = (Array.isArray(t.dar) ? t.dar : Object.values(t.dar || {})).map(c => copia(e, c)).filter(Boolean);
      const pedir = (Array.isArray(t.pedir) ? t.pedir : Object.values(t.pedir || {})).map(c => copia(e, c)).filter(Boolean);
      // ¿Sigue siendo posible? (las cartas siguen con sus dueños y no están a la venta)
      const posible = dar.every(x => e.dueno[x.c] === t.de && !e.enVenta[x.c]) && pedir.every(x => e.dueno[x.c] === t.para && !e.enVenta[x.c]) && !parada(t.de) && !parada(t.para);
      cambios.push({ id, de: persona(t.de), para: persona(t.para), dar, pedir, at: t.at, fin: t.ok || t.x || 0, estado, posible });
    }
    cambios.sort((a, b) => (b.fin || b.at) - (a.fin || a.at));
    /* Con quién se puede cambiar: todo el que tenga cartas y no esté parado. */
    const jugadores = {};
    for (const [c, u] of Object.entries(e.dueno)) {
      if (u === uid || parada(u) || e.enVenta[c]) continue;
      const x = copia(e, c);
      if (x) (jugadores[persona(u)] = jugadores[u] || []).push(x);
    }
    const mio = e.usuarios[uid];
    manda({ tipo: "datos", uid, saldo: m.saldo, parada: m.parada, falta: m.falta,
      mias: copiasDe(uid, d).map(x => ({ c: x.c, o: x.o, k: x.k, i: x.i, at: x.at, gr: x.gr, venta: x.venta })),
      sobres: (mio && mio.sobres) || {}, gratis: proximoGratis(uid, d, fb.ahora()),
      ofertas, ventas: mias.sort((a, b) => (b.fin || b.t) - (a.fin || a.t)).slice(0, 40), cambios: cambios.slice(0, 40), jugadores, gente,
      exh: exhibidas(), desfase: fb.ahora() - Date.now() });
  }

  const falta = p => { const s = cuenta().saldo; return s >= p ? 0 : p - s; };
  function pagable(p, que) {
    const m = cuenta();
    if (m.parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.");
    if (falta(p)) throw new Error(`${que} cuesta ${p}: te faltan ${falta(p)} monedas.`);
  }
  const mia = c => economia(d).dueno[c] === uid;

  /* Una petición a la vez: dos compras seguidas con el saldo justo para
     una no deben pasar las dos el control. */
  function atiende(x) {
    const responde = (ok, dato, error) => manda({ tipo: "resp", id: x.id, ok, dato, error });
    ocupado = ocupado.then(async () => {
      try {
        if (!d || !d.completo) throw new Error("Todavía se está cargando tu cuenta.");
        const e = eco();
        if (x.accion === "comprar") {
          const p = MOTOR.precioSobre(fb.ahora());
          pagable(p, "Un sobre");
          const r = await fb.comprarSobre(uid, p);
          if (!(economia(d).sobres[uid + "~" + r.k])) throw new Error("Otra pestaña gastó tus monedas a la vez: este sobre no vale hasta que ganes las que faltan.");
          responde(true, r);
        } else if (x.accion === "gratis") {
          if (proximoGratis(uid, d, fb.ahora())) throw new Error("Tu sobre gratis todavía no está listo.");
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no se abren sobres.");
          const r = await fb.sobreGratis(uid);
          responde(true, r);
        } else if (x.accion === "graduar") {
          const q = leeCopia(x.c);
          if (!q || !mia(x.c)) throw new Error("Esa carta no está en tu colección.");
          if (e.graduada[x.c]) throw new Error("Esa carta ya está graduada.");
          if (e.enVenta[x.c]) throw new Error("Retírala del mercado antes de graduarla.");
          pagable(MOTOR.PRECIO.gradua, "Graduar");
          await fb.graduarCarta(uid, q.o, q.k, q.i);
          responde(true, null);
        } else if (x.accion === "exhibir") {
          const lista = (Array.isArray(x.lista) ? x.lista : []).map(String).filter(c => leeCopia(c) && mia(c));
          await fb.exhibirCartas(uid, [...new Set(lista)].slice(0, MAX_EXHIBIDAS));
          responde(true, null);
        } else if (x.accion === "vender") {
          const p = Math.round(+x.p);
          if (!leeCopia(x.c) || !mia(x.c)) throw new Error("Esa carta no está en tu colección.");
          if (e.enVenta[x.c]) throw new Error("Esa carta ya está a la venta.");
          if (!(p >= 1 && p <= MAX_PRECIO)) throw new Error(`El precio va de 1 a ${MAX_PRECIO.toLocaleString("es-CL")} monedas.`);
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: no puedes vender hasta ponerte al día.");
          const id = await fb.publicarOferta(uid, x.c, p);
          /* La oferta tiene que quedar válida en el recuento; si no (otra
             pestaña la publicó a la vez, o la carta cambió de manos), se
             retira en el acto para que no quede una oferta fantasma. */
          const fin = economia(d).ofertas[id];
          if (fin && fin.estado !== "activa") {
            await fb.retirarOferta(id).catch(() => {});
            throw new Error("Esa carta ya está a la venta o dejó de ser tuya.");
          }
          responde(true, id);
        } else if (x.accion === "retirar") {
          const o = e.ofertas[x.id];
          if (!o || o.u !== uid || o.estado !== "activa") throw new Error("Esa oferta ya no está a la venta.");
          await fb.retirarOferta(x.id);
          responde(true, null);
        } else if (x.accion === "comprarCarta") {
          const o = e.ofertas[x.id];
          if (!o || o.estado !== "activa") throw new Error("Alguien se te adelantó: esa carta ya no está a la venta.");
          if (o.u === uid) throw new Error("Es tu propia oferta.");
          if (e.usuarios[o.u] && e.usuarios[o.u].parada) throw new Error("Esa cuenta no puede vender ahora.");
          pagable(o.p, "Esa carta");
          await fb.comprarOferta(uid, x.id);
          const fin = economia(d).ofertas[x.id];
          if (!fin || fin.estado !== "vendida" || fin.comprador !== uid) throw new Error("Alguien se te adelantó: esa carta ya no está a la venta.");
          responde(true, null);
        } else if (x.accion === "proponer") {
          const dar = (x.dar || []).map(String), pedir = (x.pedir || []).map(String), para = String(x.para || "");
          if (!para || para === uid) throw new Error("Elige con quién cambiar.");
          if (!dar.length || dar.length > 3 || pedir.length > 3) throw new Error("Ofrece de 1 a 3 cartas y pide hasta 3.");
          if (!dar.every(c => leeCopia(c) && mia(c) && !e.enVenta[c])) throw new Error("Alguna de tus cartas ya no es tuya o está a la venta.");
          if (!pedir.every(c => leeCopia(c) && e.dueno[c] === para && !e.enVenta[c])) throw new Error("Alguna de las cartas que pides ya no es suya o está a la venta.");
          if (cuenta().parada || (e.usuarios[para] && e.usuarios[para].parada)) throw new Error("Ahora no se puede proponer ese intercambio.");
          responde(true, await fb.proponerCambio(uid, para, dar, pedir));
        } else if (x.accion === "aceptar") {
          const t = d.mercado && d.mercado.t && d.mercado.t[x.id];
          if (!t || t.para !== uid || t.ok || t.x) throw new Error("Ese intercambio ya no está pendiente.");
          const dar = Object.values(t.dar || {}), pedir = Object.values(t.pedir || {});
          if (!dar.every(c => e.dueno[c] === t.de && !e.enVenta[c]) || !pedir.every(c => e.dueno[c] === uid && !e.enVenta[c]))
            throw new Error("Ya no se puede: alguna carta cambió de dueño o está a la venta.");
          if (cuenta().parada || (e.usuarios[t.de] && e.usuarios[t.de].parada)) throw new Error("Ahora no se puede aceptar ese intercambio.");
          await fb.aceptarCambio(x.id);
          responde(true, null);
        } else if (x.accion === "cerrar") {
          const t = d.mercado && d.mercado.t && d.mercado.t[x.id];
          if (!t || (t.de !== uid && t.para !== uid) || t.ok || t.x) throw new Error("Ese intercambio ya no está pendiente.");
          await fb.cerrarCambio(x.id);
          responde(true, null);
        } else throw new Error("Petición desconocida.");
      } catch (e) {
        const permiso = /permission|denied/i.test((e && (e.code || e.message)) || "");
        responde(false, null, permiso
          ? "La base todavía no acepta esto: falta publicar las reglas nuevas en la consola de Firebase."
          : (e && e.message) || "No se pudo.");
      }
    });
  }

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "prodrop-child") return;
    if (x.tipo === "listo") { listo = true; enviaDatos(); return; }
    if (x.tipo === "volver") { volver(); return; }
    if (x.tipo === "pide") atiende(x);
  }

  return {
    montar(el) {
      host = el; ambientar(null); host.innerHTML = "";
      frame = document.createElement("iframe");
      frame.className = "jg-prodrop-frame";
      frame.title = "PRODROP — sobres y mercado de cartas";
      frame.allow = "fullscreen";
      window.addEventListener("message", mensaje);
      frame.src = "juegos/prodrop/index.html?v=pd-5";
      host.appendChild(frame);
      frame.addEventListener("load", () => frame.focus());
      off = datos(x => { d = x; enviaDatos(); });
    },
    // los perfiles (nombres, exhibidas) llegan por otra escucha
    refresca: enviaDatos,
    destruir() {
      muerto = true; if (off) off(); off = null;
      window.removeEventListener("message", mensaje);
      if (frame) frame.remove(); frame = null;
      if (host) host.innerHTML = ""; host = null;
      ambientar("");
    }
  };
}
