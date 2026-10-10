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
import { monedasDe, economia, copiasDe, proximoGratis, leeCopia, claveCopia, esCarta } from "./monedas.js";
import { MOTOR, MAX_EXHIBIDAS } from "./prodrop-cartas.js";
import { pendientesDe } from "./mercado-datos.js";

const MAX_PRECIO = 100000;

export function crearProdrop({ usuario, datos, perfil, quien, fb, volver, ir }) {
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
    const q = leeCopia(c), so = q && q.tipo === "carta" && e.sobres[q.o + "~" + q.k];
    if (!so || (so.r && q.i !== 0)) return null;
    // la de un re-roll no se rehace con un sobre: va con su carta, en `rr`
    // (no en `id`, que en el mercado es el de la oferta)
    return Object.assign({ c, o: q.o, k: q.k, i: q.i, at: so.at, gr: !!e.graduada[c] }, so.r ? { rr: { id: so.r.id, g: so.r.g, w: so.r.w } } : {});
  }
  function enviaDatos() {
    if (!listo || !d || !d.completo) return;
    const e = eco(), m = cuenta(), gente = {};
    const persona = u => { if (!gente[u]) { const q = quien(u); gente[u] = { n: q.nombre, f: q.foto || "", c: q.color }; } return u; };
    const parada = u => !!(e.usuarios[u] && e.usuarios[u].parada);
    /* Solo las ofertas de cartas que están a la venta: el abridor las usa
       para decir «En el mercado por…» y para orientar el precio al vender.
       Comprar e intercambiar se hace en la pestaña 🏪 Mercado. */
    const ofertas = [];
    for (const o of Object.values(e.ofertas)) {
      if (o.estado !== "activa" || (o.u !== uid && parada(o.u))) continue;
      const x = copia(e, o.c);
      if (x) ofertas.push(Object.assign(x, { id: o.id, u: persona(o.u), p: o.p, t: o.at, estado: o.estado, fin: 0, comprador: "" }));
    }
    const mio = e.usuarios[uid];
    manda({ tipo: "datos", uid, saldo: m.saldo, parada: m.parada, falta: m.falta,
      mias: copiasDe(uid, d).map(x => Object.assign({ c: x.c, o: x.o, k: x.k, i: x.i, at: x.at, gr: x.gr, venta: x.venta },
        x.id != null ? { rr: { id: x.id, g: x.g, w: x.w } } : {})),
      sobres: (mio && mio.sobres) || {}, gratis: proximoGratis(uid, d, fb.ahora()),
      ofertas, pendientes: pendientesDe(d, uid), gente,
      exh: exhibidas(), desfase: fb.ahora() - Date.now() });
  }

  const falta = p => { const s = cuenta().saldo; return s >= p ? 0 : p - s; };
  function pagable(p, que) {
    const m = cuenta();
    if (m.parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.");
    if (falta(p)) throw new Error(`${que} cuesta ${p}: te faltan ${falta(p)} monedas.`);
  }
  const mia = c => economia(d).dueno[c] === uid;
  /* El prefijo de la colección que pide el abridor. Uno viejo (de antes de
     las colecciones, en caché) no la manda: su sobre va sin prefijo y sale
     del catálogo que ese abridor conoce. */
  const prefijo = col => (MOTOR.COL[col] ? MOTOR.COL[col].prefijo : "");

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
          const r = await fb.comprarSobre(uid, p, prefijo(x.col));
          if (!(economia(d).sobres[uid + "~" + r.k])) throw new Error("Otra pestaña gastó tus monedas a la vez: este sobre no vale hasta que ganes las que faltan.");
          responde(true, r);
        } else if (x.accion === "gratis") {
          if (proximoGratis(uid, d, fb.ahora())) throw new Error("Tu sobre gratis todavía no está listo.");
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no se abren sobres.");
          const r = await fb.sobreGratis(uid, prefijo(x.col));
          responde(true, r);
        } else if (x.accion === "graduar") {
          const q = leeCopia(x.c);
          if (!esCarta(x.c) || !mia(x.c)) throw new Error("Esa carta no está en tu colección.");
          if (e.graduada[x.c]) throw new Error("Esa carta ya está graduada.");
          if (e.enVenta[x.c]) throw new Error("Retírala del mercado antes de graduarla.");
          pagable(MOTOR.PRECIO.gradua, "Graduar");
          await fb.graduarCarta(uid, q.o, q.k, q.i);
          responde(true, null);
        } else if (x.accion === "reroll") {
          /* Diez de una misma rareza por una de la siguiente. Se comprueba
             aquí lo mismo que la economía comprobará al rehacerlo (que el
             iframe puede estar mirando algo viejo), y la carta que sale se
             lee de la economía cuando llega lo escrito. */
          const cs = [...new Set((Array.isArray(x.c) ? x.c : []).map(String))];
          if (cs.length !== MOTOR.REROLL.n) throw new Error(`Elige ${MOTOR.REROLL.n} cartas distintas.`);
          if (!cs.every(c => esCarta(c) && mia(c))) throw new Error("Alguna de esas cartas ya no es tuya.");
          if (cs.some(c => e.enVenta[c])) throw new Error("Retira del mercado las cartas que quieras usar.");
          const fichas = cs.map(c => { const y = copia(e, c); return y && (y.rr ? y.rr : MOTOR.sobre(y.o, y.k, y.at).cartas[y.i]); });
          if (fichas.some(f => !f)) throw new Error("Alguna de esas cartas ya no existe.");
          const tier = MOTOR.CARDS[fichas[0].id].tier;
          if (tier >= 3) throw new Error("Las legendarias no se pueden cambiar: no hay nada por encima.");
          if (fichas.some(f => MOTOR.CARDS[f.id].tier !== tier)) throw new Error("Las diez tienen que ser de la misma rareza.");
          const col = MOTOR.CARDS[fichas[0].id].col;
          if (fichas.some(f => MOTOR.CARDS[f.id].col !== col)) throw new Error("Las diez tienen que ser de la misma colección.");
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no se puede.");
          const r = await fb.rerollCartas(uid, cs, MOTOR.COL[col].prefijo);
          const nueva = claveCopia(uid, r.k, 0);
          let so = null;
          for (let i = 0; i < 30 && !(so = economia(d).sobres[uid + "~" + r.k]); i++) {
            const escrito = d && d.cartas && d.cartas.r && d.cartas.r[uid] && d.cartas.r[uid][r.k];
            if (escrito && escrito.at === r.at) break;   // ya llegó y la economía no lo aceptó
            await new Promise(ok => setTimeout(ok, 100));
          }
          if (!so || !so.r) throw new Error("El re-roll no valió: alguna carta cambió de manos a la vez.");
          responde(true, { k: r.k, at: r.at, c: nueva, id: so.r.id, g: so.r.g, w: so.r.w, tier: MOTOR.CARDS[so.r.id].tier });
        } else if (x.accion === "exhibir") {
          const lista = (Array.isArray(x.lista) ? x.lista : []).map(String).filter(c => esCarta(c) && mia(c));
          await fb.exhibirCartas(uid, [...new Set(lista)].slice(0, MAX_EXHIBIDAS));
          responde(true, null);
        } else if (x.accion === "vender") {
          const p = Math.round(+x.p);
          if (!esCarta(x.c) || !mia(x.c)) throw new Error("Esa carta no está en tu colección.");
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
    if (x.tipo === "mercado") { ir("#mercado/prodrop"); return; }
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
      frame.src = "juegos/prodrop/index.html?v=pd-17";
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
