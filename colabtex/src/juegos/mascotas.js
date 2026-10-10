/* Mascotas — el cartero entre el juego (un iframe en juegos/mascotas/) y la
   cuenta. Como PRODROP, el documento del juego conserva su CSS, su 3D y su
   audio y no sabe nada de Firebase: este módulo le manda los datos cada vez
   que cambian y hace por él las escrituras que puede pedir, de a una.

   Lo que se le manda sale de la **economía** (juegos/monedas.js): las
   mascotas que la cuenta tiene *ahora* (adoptadas, compradas o recibidas),
   si tomaron la poción, si están a la venta, los objetos de regalos que son
   suyos, la comida y los fondos comprados. El estado de cada mascota (etapa,
   stats, lo que lleva puesto) viene de `mascotasEstado/<uid>`, que solo lee y
   escribe su dueño entero; de otros se lee por clave.

   Antes de cada escritura se vuelve a comprobar contra la economía completa
   (el iframe podría estar mirando algo viejo), porque las reglas no pueden
   saber si alcanza el dinero ni de quién es una mascota: sin esto, un gasto
   sin fondos de este mismo navegador pararía la cuenta. */
import { ambientar } from "./sonido.js";
import { monedasDe, economia, mascotasDe, objetosDe, leeCopia, claveMascota, claveObjeto } from "./monedas.js";
import MM from "../../../juegos/mascotas/motor.js";

const MAX_PRECIO = 100000;
/* La clave del estado de una mascota: su copia sin el prefijo. */
const claveEstado = c => String(c).replace(/^ma:/, "");
const RE_ESTADO = /^[A-Za-z0-9]{6,40}~[-_A-Za-z0-9]{8,24}$/;

/* Lo que se guarda de una mascota, recortado a lo que valida la regla. */
function limpiaEstado(e) {
  if (!e || typeof e !== "object") return null;
  const n = x => (Number.isFinite(+x) ? +x : 0), acota = (x, a, b) => Math.min(b, Math.max(a, n(x)));
  const out = {
    v: 1,
    n: String(e.n || "Sin nombre").slice(0, 24) || "Sin nombre",
    e: ["egg", "baby", "adult"].includes(e.e) ? e.e : "egg",
    g: acota(e.g, 0, 1000),
    s: Object.fromEntries(["hunger", "happiness", "energy", "hygiene"].map(k => [k, acota(e.s && e.s[k], 0, 100)])),
    ls: n(e.ls)
  };
  if (e.z) { out.z = true; out.r = acota(e.r, 0, 100); }
  const w = {};
  for (const k of ["hat", "boots", "outfit", "shoes"]) {
    const v = e.w && e.w[k];
    if (typeof v === "string" && /^(ob:[A-Za-z0-9]{6,40}~[-_A-Za-z0-9]{8,24}|start-[a-z]{3,8}-[a-z]{2,12})$/.test(v)) w[k] = v;
  }
  if (Object.keys(w).length) out.w = w;
  const d = (Array.isArray(e.d) ? e.d : []).filter(x => x && /^ob:[A-Za-z0-9]{6,40}~[-_A-Za-z0-9]{8,24}$/.test(String(x.i))).slice(0, 13)
    .map(x => ({ i: String(x.i), x: acota(x.x, -5, 5), z: acota(x.z, -5, 5), rot: Math.round(acota(x.rot, 0, 7)) }));
  if (d.length) out.d = d;
  return out;
}

export function crearMascotas({ usuario, datos, fb, volver, ir }) {
  let host = null, frame = null, offs = [], d = null, estados = null, prefs = null, muerto = false, listo = false, ocupado = Promise.resolve();
  const uid = usuario.uid;
  const heredando = new Set();

  function manda(x) { if (!muerto && frame && frame.contentWindow) frame.contentWindow.postMessage({ canal: "mascotas-parent", ...x }, location.origin); }
  const eco = () => economia(d);
  const cuenta = () => monedasDe(uid, d);
  const temaSitio = () => (document.documentElement.getAttribute("data-tema") === "oscuro" ? "oscuro" : "claro");

  /* Una mascota comprada o recibida no tiene estado en esta cuenta: se
     hereda el del dueño anterior que lo tenga (el más reciente primero),
     sin lo que llevaba puesto, que era suyo. Sin ninguno, el juego la
     empieza desde su primera etapa. */
  async function hereda(m) {
    const k = claveEstado(m.c);
    if (heredando.has(k)) return;
    heredando.add(k);
    try {
      for (const u of [...m.antes].reverse()) {
        const e = limpiaEstado(await fb.leeEstadoMascota(u, k));
        if (!e) continue;
        delete e.w; delete e.d;
        await fb.guardaEstadoMascota(uid, k, e);
        return;
      }
    } catch (err) { console.warn("[mascotas] no se pudo heredar el estado", k, err); }
  }

  function enviaDatos() {
    if (!listo || !d || !d.completo || !estados || !prefs) return;
    const e = eco(), m = cuenta(), mio = e.usuarios[uid] || {};
    const mias = mascotasDe(uid, d);
    for (const x of mias) if (!estados[claveEstado(x.c)] && x.antes.length) hereda(x);
    const comprada = mio.comida || 0, usadas = Number.isFinite(prefs.usadas) ? prefs.usadas : 0;
    manda({ tipo: "datos", datos: {
      uid, saldo: m.saldo, parada: m.parada, falta: m.falta,
      mascotas: mias.map(x => ({ c: x.c, o: x.o, k: x.k, at: x.at, e: x.e, frozen: x.frozen, venta: x.venta, estado: estados[claveEstado(x.c)] || null })),
      objetos: objetosDe(uid, d).map(x => ({ c: x.c, kind: x.kind, id: x.id, tint: x.tint, leg: x.leg, venta: x.venta })),
      comida: Math.max(0, comprada - usadas),
      fondos: Object.keys(mio.fondos || {}),
      adopciones: mio.intentos || 0,
      prefs: { luz: prefs.luz, fondo: prefs.fondo, barra: Array.isArray(prefs.barra) ? prefs.barra : prefs.barra ? Object.values(prefs.barra) : undefined }
    } });
  }
  const mandaTema = () => manda({ tipo: "tema", tema: temaSitio() });

  function pagable(p, que) {
    const m = cuenta();
    if (m.parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.");
    if (m.saldo < p) throw new Error(`${que} cuesta ${p.toLocaleString("es-CL")}: te faltan ${(p - m.saldo).toLocaleString("es-CL")} monedas.`);
  }
  const mia = c => eco().dueno[c] === uid;
  const tengoMascota = c => !!eco().mascotas[c] && mia(c);
  /* Lo escrito tarda un instante en volver por la escucha: se espera a que
     la economía lo vea (o se dé por perdido). */
  async function esperaEco(ve, ms = 4000) {
    for (let t = 0; t < ms; t += 100) {
      const r = ve(eco());
      if (r) return r;
      await new Promise(ok => setTimeout(ok, 100));
    }
    return ve(eco());
  }

  function atiende(x) {
    const responde = (ok, dato, error) => manda({ tipo: "resp", id: x.id, ok, dato, error });
    ocupado = ocupado.then(async () => {
      try {
        if (!d || !d.completo) throw new Error("Todavía se está cargando tu cuenta.");
        const e = eco(), u = e.usuarios[uid] || {};
        if (x.accion === "adoptar") {
          if (!MM.ESPECIES.includes(x.e)) throw new Error("Esa especie no existe.");
          if (mascotasDe(uid, d).length >= MM.MAX_MASCOTAS) throw new Error(`Tu corral está lleno: ${MM.MAX_MASCOTAS} mascotas como máximo.`);
          const p = (u.intentos || 0) === 0 ? 0 : MM.PRECIO.adopcion;
          if (p) pagable(p, "Adoptar"); else if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes adoptar.");
          const r = await fb.adoptarMascota(uid, x.e, p);
          const c = claveMascota(uid, r.k);
          if (!(await esperaEco(z => z.mascotas[c] && z.dueno[c] === uid))) throw new Error("La adopción no valió (otra pestaña gastó tus monedas, o tu corral se llenó a la vez).");
          responde(true, { c });
        } else if (x.accion === "regalo") {
          pagable(MM.PRECIO.regalo, "Un regalo");
          const r = await fb.abrirRegaloMascota(uid);
          const c = claveObjeto(uid, r.k);
          const g = await esperaEco(z => z.regalos[c]);
          if (!g) throw new Error("Otra pestaña gastó tus monedas a la vez: este regalo no vale hasta que ganes las que faltan.");
          responde(true, Object.assign({ c }, g.item));
        } else if (x.accion === "comida") {
          const n = Math.round(+x.n);
          if (!(n >= 1 && n <= MM.MAX_RACIONES)) throw new Error(`Se compran de 1 a ${MM.MAX_RACIONES} raciones.`);
          pagable(MM.PRECIO.comida * n, n === 1 ? "Una ración" : `${n} raciones`);
          await fb.compraMascotas(uid, { k: "comida", p: MM.PRECIO.comida * n, n });
          responde(true, null);
        } else if (x.accion === "pocion") {
          if (!tengoMascota(x.m)) throw new Error("Esa mascota no es tuya.");
          if (e.congelada[x.m]) throw new Error("Ya tomó la poción eterna.");
          if (e.enVenta[x.m]) throw new Error("Retírala del mercado antes de darle la poción.");
          pagable(MM.PRECIO.pocion, "La poción eterna");
          await fb.compraMascotas(uid, { k: "pocion", p: MM.PRECIO.pocion, m: x.m });
          if (!(await esperaEco(z => z.congelada[x.m]))) throw new Error("La poción no valió: otra pestaña gastó tus monedas a la vez.");
          responde(true, null);
        } else if (x.accion === "fondo") {
          const p = MM.precioCompra("fondo-" + x.id);
          if (!p) throw new Error("Ese fondo no existe.");
          if ((u.fondos || {})[x.id]) throw new Error("Ya tienes ese fondo.");
          pagable(p, "Ese fondo");
          await fb.compraMascotas(uid, { k: "fondo-" + x.id, p });
          responde(true, null);
        } else if (x.accion === "adios") {
          if (!tengoMascota(x.m)) throw new Error("Esa mascota no es tuya.");
          if (e.enVenta[x.m]) throw new Error("Retírala del mercado antes de despedirte.");
          if (cuenta().parada) throw new Error("Ahora no se puede: tu cuenta tiene una compra sin fondos.");
          await fb.compraMascotas(uid, { k: "adios", p: 0, m: x.m });
          await fb.borraEstadoMascota(uid, claveEstado(x.m)).catch(() => {});
          responde(true, null);
        } else if (x.accion === "estado") {
          const k = String(x.k || ""), c = "ma:" + k;
          if (!RE_ESTADO.test(k) || !tengoMascota(c)) throw new Error("Esa mascota ya no es tuya.");
          if (e.enVenta[c]) throw new Error("Está a la venta.");
          const est = limpiaEstado(x.estado);
          if (!est) throw new Error("Estado inválido.");
          await fb.guardaEstadoMascota(uid, k, est);
          responde(true, null);
        } else if (x.accion === "prefs") {
          const p = x.prefs || {};
          await fb.guardaPrefsMascotas(uid, {
            luz: p.luz !== false,
            fondo: typeof p.fondo === "string" ? p.fondo.slice(0, 20) : "meadow",
            barra: (Array.isArray(p.barra) ? p.barra : []).map(String).filter(b => b.length <= 80).slice(0, 4)
          });
          responde(true, null);
        } else if (x.accion === "comer") {
          await fb.usaComidaMascota(uid, 1);
          responde(true, null);
        } else if (x.accion === "vender") {
          const p = Math.round(+x.p), q = leeCopia(x.c);
          if (!q || q.tipo === "carta" || !mia(x.c)) throw new Error("Eso no es tuyo.");
          if (e.enVenta[x.c]) throw new Error("Ya está a la venta.");
          if (!(p >= 1 && p <= MAX_PRECIO)) throw new Error(`El precio va de 1 a ${MAX_PRECIO.toLocaleString("es-CL")} monedas.`);
          if (cuenta().parada) throw new Error("Tu cuenta tiene una compra sin fondos: no puedes vender hasta ponerte al día.");
          const id = await fb.publicarOferta(uid, x.c, p);
          /* La oferta tiene que quedar válida en el recuento; si no, se
             retira en el acto para que no quede una oferta fantasma. */
          const fin = economia(d).ofertas[id];
          if (fin && fin.estado !== "activa") {
            await fb.retirarOferta(id).catch(() => {});
            throw new Error("Eso ya está a la venta o dejó de ser tuyo.");
          }
          responde(true, id);
        } else if (x.accion === "retirar") {
          const o = e.ofertas[x.id];
          if (!o || o.u !== uid || o.estado !== "activa") throw new Error("Esa oferta ya no está a la venta.");
          await fb.retirarOferta(x.id);
          responde(true, null);
        } else throw new Error("Petición desconocida.");
      } catch (err) {
        const permiso = /permission|denied/i.test((err && (err.code || err.message)) || "");
        responde(false, null, permiso
          ? "La base todavía no acepta esto: falta publicar las reglas nuevas en la consola de Firebase."
          : (err && err.message) || "No se pudo.");
      }
    });
  }

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "mascotas-child") return;
    if (x.tipo === "listo") { listo = true; mandaTema(); enviaDatos(); return; }
    if (x.tipo === "volver") { volver(); return; }
    if (x.tipo === "mercado") { ir("#mercado/mascotas"); return; }
    if (x.tipo === "pide") atiende(x);
  }
  const vigilaTema = new MutationObserver(mandaTema);

  return {
    montar(el) {
      host = el; ambientar(null); host.innerHTML = "";
      frame = document.createElement("iframe");
      frame.className = "jg-mascotas-frame";
      frame.title = "Mascotas — cría tu mascota en 3D";
      frame.allow = "fullscreen";
      window.addEventListener("message", mensaje);
      frame.src = "juegos/mascotas/index.html?v=mc-1";
      host.appendChild(frame);
      frame.addEventListener("load", () => frame.focus());
      vigilaTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
      offs.push(datos(x => { d = x; enviaDatos(); }));
      offs.push(fb.watchEstadosMascotas(uid, x => { estados = x || {}; enviaDatos(); }));
      offs.push(fb.watchPrefsMascotas(uid, x => { prefs = x || {}; enviaDatos(); }));
    },
    destruir() {
      muerto = true;
      for (const f of offs) try { f(); } catch (e) { /* ya estaba */ }
      offs = [];
      vigilaTema.disconnect();
      window.removeEventListener("message", mensaje);
      if (frame) frame.remove(); frame = null;
      if (host) host.innerHTML = ""; host = null;
      ambientar("");
    }
  };
}
