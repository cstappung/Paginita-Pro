/* PRODROP — el cartero entre el abridor (un iframe en juegos/prodrop/) y
   la cuenta. Como Circuit Breakers o Clue, el documento del juego conserva
   su CSS, su audio y sus animaciones, y no sabe nada de Firebase: este
   módulo le manda la cuenta (saldo, sobres, graduadas, exhibidas) cada vez
   que cambia, y hace por él las tres escrituras que puede pedir.

   El saldo se vuelve a mirar **aquí** antes de cada cobro, contra la
   lectura completa: el iframe podría estar mostrando uno viejo. Y lo que
   se le manda es el **libro** (juegos/monedas.js: libroCartas), no lo que
   hay escrito: un sobre comprado sin fondos no entra a la colección. */
import { ambientar } from "./sonido.js";
import { monedasDe } from "./monedas.js";
import { MOTOR, MAX_EXHIBIDAS } from "./prodrop-cartas.js";

export function crearProdrop({ usuario, datos, perfil, fb, volver }) {
  let host = null, frame = null, off = null, d = null, muerto = false, listo = false, ocupado = Promise.resolve();
  const uid = usuario.uid;

  function manda(x) { if (!muerto && frame && frame.contentWindow) frame.contentWindow.postMessage({ canal: "prodrop-parent", ...x }, location.origin); }
  const cuenta = () => (d ? monedasDe(uid, d) : { saldo: 0, libro: { s: {}, g: {}, pendientes: 0, falta: 0 }, total: 0 });
  const saldo = () => cuenta().saldo;
  function exhibidas() {
    const l = (perfil(uid) || {}).cartas;
    return (Array.isArray(l) ? l : l && typeof l === "object" ? Object.values(l) : []).filter(k => typeof k === "string").slice(0, MAX_EXHIBIDAS);
  }
  function enviaDatos() {
    if (!listo || !d || !d.completo) return;
    const m = cuenta();
    manda({ tipo: "datos", uid, saldo: m.saldo, s: m.libro.s, g: m.libro.g,
      espera: { n: m.libro.pendientes, falta: m.libro.falta, ganado: m.total },
      exh: exhibidas(), desfase: fb.ahora() - Date.now() });
  }

  /* Una petición a la vez: dos compras seguidas con el saldo justo para
     una no deben pasar las dos el control. */
  function atiende(x) {
    const responde = (ok, dato, error) => manda({ tipo: "resp", id: x.id, ok, dato, error });
    ocupado = ocupado.then(async () => {
      try {
        if (!d || !d.completo) throw new Error("Todavía se está cargando tu cuenta.");
        if (x.accion === "comprar") {
          const p = MOTOR.precioSobre(fb.ahora());
          if (saldo() < p) throw new Error(`Te faltan ${p - saldo()} monedas para un sobre.`);
          const r = await fb.comprarSobre(uid, p);
          /* Otra pestaña pudo gastar a la vez: si con esta compra el libro
             no la acepta, se dice en vez de abrir un sobre que no vale. */
          if (d && d.cartas && !cuenta().libro.s[r.k]) throw new Error("Otra pestaña gastó tus monedas a la vez: este sobre queda en espera hasta que ganes las que faltan.");
          responde(true, r);
        } else if (x.accion === "graduar") {
          const k = String(x.k || ""), i = +x.i;
          const { s, g } = cuenta().libro;
          if (!s[k] || !(i >= 0 && i < 5)) throw new Error("Esa carta no está en tu colección.");
          if (g[k] && g[k][i]) throw new Error("Esa carta ya está graduada.");
          if (saldo() < MOTOR.PRECIO.gradua) throw new Error(`Graduar cuesta ${MOTOR.PRECIO.gradua}: te faltan ${MOTOR.PRECIO.gradua - saldo()}.`);
          await fb.graduarCarta(uid, k, i);
          responde(true, { k, i });
        } else if (x.accion === "exhibir") {
          const { s } = cuenta().libro;
          const lista = (Array.isArray(x.lista) ? x.lista : []).map(String)
            .filter(k => /^[-_A-Za-z0-9]{8,24}\.[0-4]$/.test(k) && s[k.split(".")[0]]);
          await fb.exhibirCartas(uid, [...new Set(lista)].slice(0, MAX_EXHIBIDAS));
          responde(true, null);
        } else throw new Error("Petición desconocida.");
      } catch (e) {
        const permiso = /permission|denied/i.test((e && (e.code || e.message)) || "");
        responde(false, null, permiso
          ? "La base todavía no acepta compras de cartas: falta publicar las reglas nuevas en la consola de Firebase."
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
      frame.title = "PRODROP — sobres de cartas";
      frame.allow = "fullscreen";
      window.addEventListener("message", mensaje);
      frame.src = "juegos/prodrop/index.html?v=pd-3";
      host.appendChild(frame);
      frame.addEventListener("load", () => frame.focus());
      off = datos(x => { d = x; enviaDatos(); });
    },
    // el perfil (las exhibidas) llega por otra escucha
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
