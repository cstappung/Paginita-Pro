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
   sin fondos de este mismo navegador pararía la cuenta.

   También es el cartero del **Pueblo** (estilo Pet Society): la plaza
   donde pasean las mascotas de todos (`mascotasPlaza`), las casas de los
   vecinos (su estado se lee por clave) y los cariños que deja una visita
   (`mascotasCarinos`). Lo que llega de otros se revisa contra la economía
   antes de mandarlo al juego: una mascota que no es de quien pasea, o ropa
   que no es suya, no se dibuja. */
import { ambientar } from "./sonido.js";
import { monedasDe, economia, mascotasDe, objetosDe, leeCopia, claveMascota, claveObjeto } from "./monedas.js";
import MM from "../../../juegos/mascotas/motor.js";

const MAX_PRECIO = 100000;
/* La clave del estado de una mascota: su copia sin el prefijo. */
const claveEstado = c => String(c).replace(/^ma:/, "");
const RE_ESTADO = /^[A-Za-z0-9]{6,40}~[-_A-Za-z0-9]{8,24}$/;
const RE_MASCOTA = /^ma:[A-Za-z0-9]{6,40}~[-_A-Za-z0-9]{8,24}$/;
/* RTDB devuelve las listas como arreglo o como objeto de índices. */
const lista = v => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : undefined;

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

/* Lo que se puede dibujar de lo que lleva puesto una mascota de `u`: los
   objetos iniciales tal cual (los resuelve el juego) y los de regalos solo
   si siguen siendo de `u`. */
function ropaDe(w, u, e) {
  const out = {};
  for (const slot of ["hat", "boots", "outfit", "shoes"]) {
    const v = w && w[slot];
    if (typeof v !== "string") continue;
    if (/^start-[a-z]{3,8}-[a-z]{2,12}$/.test(v)) out[slot] = { s: v };
    else if (e.dueno[v] === u && e.regalos[v] && e.regalos[v].item.kind === slot && !e.enVenta[v])
      out[slot] = { id: e.regalos[v].item.id, tint: e.regalos[v].item.tint || 0 };
  }
  return out;
}
/* El baile de un gesto: inicial, o de regalos y de quien lo baila. */
function baileDe(b, u, e) {
  if (typeof b !== "string") return "";
  const m = /^start-dance-([a-z]{1,20})$/.exec(b);
  if (m) return m[1];
  return e.dueno[b] === u && e.regalos[b] && e.regalos[b].item.kind === "dance" ? e.regalos[b].item.id : "";
}
const EMOTES = /^[a-z]{2,10}$/;
/* Respiro entre dos escrituras de la plaza, y cada cuánto se refresca la
   propia aunque no se mueva (para seguir «fresca» en la consulta). */
const PLAZA_RESPIRO = 900, PLAZA_LATIDO = 45000;

/* `alGuardar(k, estado)`: avisa lo que se acaba de guardar (null al
   despedirse), para que la mascota del perfil lo muestre sin releer.
   `quien(u)` = {nombre, foto, color} de cualquier cuenta (el Pueblo). */
export function crearMascotas({ usuario, datos, fb, volver, ir, alGuardar, quien }) {
  let host = null, frame = null, offs = [], d = null, estados = null, prefs = null, muerto = false, listo = false, ocupado = Promise.resolve();
  const uid = usuario.uid;
  const heredando = new Set();
  const nombre = (u, ligero) => { const q = quien ? quien(u, ligero) : null; return { nombre: (q && q.nombre) || "Jugador", color: (q && q.color) || "#0d9488", foto: (q && q.foto) || "" }; };
  /* La hora del servidor llevada al reloj de este navegador. */
  const aLocal = t => (Number.isFinite(t) ? t - (fb.ahora() - Date.now()) : 0);

  /* ---------- el Pueblo ---------- */
  let carinos = null;                     // mascotasCarinos/<uid>, crudo
  let plaza = null;                       // {offs, crudo, yo, reloj, latido, ultima}
  const estadosAjenos = new Map();        // "u/k" -> {e, at, leyendo}
  /* El estado de una mascota ajena, por clave y con memoria de cinco
     minutos (al llegar uno nuevo se vuelve a mandar la plaza): la etapa y
     la ropa cambian poco, y cada lectura baja el estado entero. */
  function estadoAjeno(u, k) {
    const key = u + "/" + k, x = estadosAjenos.get(key), t = Date.now();
    if ((!x || t - x.at > 300000) && !(x && x.leyendo)) {
      const y = x || { e: null, at: 0 };
      y.leyendo = true;
      estadosAjenos.set(key, y);
      fb.leeEstadoMascota(u, k).then(e => { y.e = limpiaEstado(e); y.at = Date.now(); y.leyendo = false; mandaPlaza(); });
    }
    return x ? x.e : null;
  }
  function mandaPlaza() {
    if (!plaza || !d || !d.completo) return;
    const e = eco(), lim = fb.ahora() - fb.PLAZA_FRESCO, lista = [];
    for (const [u, p] of Object.entries(plaza.crudo || {})) {
      if (u === uid || !p || !(p.at > lim) || !RE_MASCOTA.test(p.m) || e.dueno[p.m] !== u || e.enVenta[p.m]) continue;
      const m = e.mascotas[p.m];
      if (!m) continue;
      const est = estadoAjeno(u, claveEstado(p.m)), q = nombre(u);
      lista.push({
        u, nombre: q.nombre, color: q.color, c: p.m, o: m.u, k: m.k, at0: m.at, e: m.e,
        n: est ? est.n : "", et: est ? est.e : "", w: est ? ropaDe(est.w, u, e) : {},
        x: +p.x || 0, z: +p.z || 0,
        em: EMOTES.test(p.em) ? p.em : "", ea: aLocal(p.ea), b: baileDe(p.b, u, e),
        t: typeof p.t === "string" ? p.t.slice(0, 60) : "", ta: aLocal(p.ta)
      });
    }
    manda({ tipo: "plaza", lista, aviso: plaza.aviso || "" });
  }
  function escuchaPlaza() {
    if (!plaza) return;
    plaza.offs = [fb.watchPlazaMascotas((v, err) => {
      if (!plaza) return;
      if (err) { plaza.aviso = "La plaza todavía no abre: falta publicar las reglas nuevas en la consola de Firebase."; console.warn("[mascotas] plaza", err); }
      plaza.crudo = v;
      mandaPlaza();
    })];
    /* Quien deja de estar fresco se va aunque nadie escriba. */
    plaza.vence = setInterval(mandaPlaza, 30000);
  }
  /* La propia: se escribe con respiro (la última posición gana) y con un
     latido aunque no se mueva. */
  function escribePlaza() {
    if (!plaza || !plaza.yo) return;
    clearTimeout(plaza.reloj);
    const falta = plaza.ultima + PLAZA_RESPIRO - Date.now();
    if (falta > 0) { plaza.reloj = setTimeout(escribePlaza, falta); return; }
    plaza.ultima = Date.now();
    const y = plaza.yo, x = { m: y.m, x: y.x, z: y.z };
    if (y.em) { x.em = y.em; x.ea = y.ea; }
    if (y.b) x.b = y.b;
    if (y.t) { x.t = y.t; x.ta = y.ta; }
    fb.ponPlazaMascota(uid, x).catch(err => console.warn("[mascotas] plaza", err));
  }
  function entraPlaza() {
    if (plaza) return;
    plaza = { offs: [], crudo: {}, yo: null, reloj: 0, ultima: 0 };
    escuchaPlaza();
    plaza.latido = setInterval(() => { if (plaza && plaza.yo) { plaza.ultima = 0; escribePlaza(); } }, PLAZA_LATIDO);
  }
  function salePlaza() {
    if (!plaza) return;
    for (const f of plaza.offs) try { f(); } catch (e) { /* ya estaba */ }
    clearTimeout(plaza.reloj); clearInterval(plaza.latido); clearInterval(plaza.vence);
    const habia = !!plaza.yo;
    plaza = null;
    if (habia) fb.salePlazaMascotas(uid);
  }
  /* Los cariños recibidos, con quién los hizo. Van en hora del servidor
     (y `ahora` también): el `visto` que vuelve se compara con el mismo
     reloj, y un desfase que cambia no aplica dos veces el último. */
  function mandaCarinos() {
    if (!listo || !carinos || !prefs) return;
    const lista = [];
    for (const [k, xs] of Object.entries(carinos))
      for (const [u, x] of Object.entries(xs || {}))
        if (x && Number.isFinite(x.at)) lista.push({ k, u, nombre: nombre(u, true).nombre, at: x.at });
    manda({ tipo: "carinos", lista, visto: Number.isFinite(prefs.carinos) ? prefs.carinos : null, ahora: fb.ahora() });
  }

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
        if (alGuardar) alGuardar(k, e);
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
      prefs: { luz: prefs.luz, oscuras: lista(prefs.oscuras), fondo: prefs.fondo, barra: lista(prefs.barra) }
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
          if (alGuardar) alGuardar(claveEstado(x.m), null);
          responde(true, null);
        } else if (x.accion === "estado") {
          const k = String(x.k || ""), c = "ma:" + k;
          if (!RE_ESTADO.test(k) || !tengoMascota(c)) throw new Error("Esa mascota ya no es tuya.");
          if (e.enVenta[c]) throw new Error("Está a la venta.");
          const est = limpiaEstado(x.estado);
          if (!est) throw new Error("Estado inválido.");
          await fb.guardaEstadoMascota(uid, k, est);
          if (alGuardar) alGuardar(k, est);
          responde(true, null);
        } else if (x.accion === "prefs") {
          const p = x.prefs || {};
          /* La luz es de cada mascota: `oscuras` son las que la tienen apagada. `luz` queda
             prendida para que el formato viejo (una luz para todas) no vuelva a aplicarse. */
          const oscuras = (Array.isArray(p.oscuras) ? p.oscuras : []).map(String).filter(c => RE_MASCOTA.test(c)).slice(0, 12);
          await fb.guardaPrefsMascotas(uid, {
            luz: true,
            oscuras: oscuras.length ? oscuras : null,
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
        } else if (x.accion === "carinosVistos") {
          /* Hasta dónde se aplicaron los cariños (hora del servidor). */
          const at = Math.round(+x.at);
          if (!Number.isFinite(at)) throw new Error("Hora inválida.");
          if (!(Number.isFinite(prefs && prefs.carinos) && prefs.carinos >= at)) await fb.guardaPrefsMascotas(uid, { carinos: at });
          responde(true, null);
        } else if (x.accion === "plaza") {
          if (x.on) entraPlaza(); else salePlaza();
          responde(true, null);
        } else if (x.accion === "plazaPon") {
          if (!plaza) entraPlaza();
          if (!tengoMascota(x.m)) throw new Error("Esa mascota ya no es tuya.");
          if (e.enVenta[x.m]) throw new Error("Está a la venta: no sale a pasear.");
          const acota = v => Math.round(Math.min(9.5, Math.max(-9.5, +v || 0)) * 100) / 100;
          const antes = plaza.yo || {}, yo = { m: x.m, x: acota(x.x), z: acota(x.z), em: antes.em, ea: antes.ea, b: antes.b, t: antes.t, ta: antes.ta };
          if (x.em) {
            if (!EMOTES.test(x.em)) throw new Error("Ese gesto no existe.");
            yo.em = x.em; yo.ea = fb.ahora();
            yo.b = x.em === "baile" && typeof x.b === "string" && baileDe(x.b, uid, e) ? x.b : undefined;
          }
          if (typeof x.t === "string" && x.t.trim()) { yo.t = x.t.replace(/\s+/g, " ").trim().slice(0, 60); yo.ta = fb.ahora(); }
          plaza.yo = yo;
          escribePlaza();
          responde(true, null);
        } else if (x.accion === "vecinos") {
          /* Todas las cuentas con mascotas, menos la propia: la barra de vecinos. */
          const por = new Map();
          for (const [c, u] of Object.entries(e.dueno)) {
            const m = u !== uid && e.mascotas[c];
            if (!m) continue;
            if (!por.has(u)) por.set(u, []);
            por.get(u).push({ c, e: m.e, at: m.at });
          }
          const lista = [...por].map(([u, ms]) => {
            const q = nombre(u, true);
            return { u, nombre: q.nombre, color: q.color, foto: q.foto.length <= 40000 ? q.foto : "", mascotas: ms.sort((a, b) => a.at - b.at).map(m => ({ c: m.c, e: m.e })) };
          }).sort((a, b) => b.mascotas.length - a.mascotas.length || a.nombre.localeCompare(b.nombre, "es"));
          responde(true, lista.slice(0, 80));
        } else if (x.accion === "vecino") {
          /* Las mascotas de un vecino con su nombre y etapa (cada estado, por clave). */
          const u = String(x.u || "");
          const ms = Object.entries(e.dueno).filter(([c, w]) => w === u && e.mascotas[c]).map(([c]) => c).slice(0, MM.MAX_MASCOTAS);
          const out = await Promise.all(ms.map(async c => {
            const est = limpiaEstado(await fb.leeEstadoMascota(u, claveEstado(c)));
            return { c, e: e.mascotas[c].e, n: est ? est.n : "", et: est ? est.e : "" };
          }));
          responde(true, out);
        } else if (x.accion === "casa") {
          /* La casa de una mascota ajena: su estado, lo que lleva puesto y sus
             muebles (solo lo que sigue siendo de su dueño) y sus cariños. */
          const c = String(x.c || ""), u = e.dueno[c], m = e.mascotas[c];
          if (!RE_MASCOTA.test(c) || !u || !m) throw new Error("Esa mascota ya no está en el pueblo.");
          const k = claveEstado(c);
          const [crudo, cs] = await Promise.all([fb.leeEstadoMascota(u, k), fb.leeCarinosMascota(u, k)]);
          const est = limpiaEstado(crudo), q = nombre(u), z = eco(), lim = fb.ahora() - 86400000;
          const muebles = [];
          for (const it of (est && est.d) || []) {
            const r = z.regalos[it.i];
            if (z.dueno[it.i] === u && r && r.item.kind === "decor" && !z.enVenta[it.i]) muebles.push({ id: r.item.id, tint: r.item.tint || 0, x: it.x, z: it.z, rot: it.rot });
          }
          const mio = cs[uid] && Number.isFinite(cs[uid].at) ? cs[uid].at : null;
          responde(true, {
            u, nombre: q.nombre, color: q.color, c, o: m.u, k: m.k, at0: m.at, e: m.e, frozen: !!z.congelada[c],
            estado: est ? { n: est.n, e: est.e, g: est.g, s: est.s, ls: est.ls, z: !!est.z } : null,
            w: est ? ropaDe(est.w, u, z) : {}, d: muebles,
            hoy: Object.values(cs).filter(y => y && y.at > lim).length,
            mio: mio === null ? null : aLocal(mio), mia: u === uid
          });
        } else if (x.accion === "carino") {
          const c = String(x.c || ""), u = e.dueno[c];
          if (!RE_MASCOTA.test(c) || !u || !e.mascotas[c]) throw new Error("Esa mascota ya no está en el pueblo.");
          if (u === uid) throw new Error("Es tuya: los cariños son para las mascotas de los vecinos.");
          try { await fb.daCarinoMascota(u, claveEstado(c), uid); }
          catch (err) {
            if (/permission|denied/i.test((err && (err.code || err.message)) || "")) {
              const cs = await fb.leeCarinosMascota(u, claveEstado(c));
              if (cs[uid]) throw new Error("Ya le hiciste cariño hoy: vuelve mañana.");
              if (!(await fb.leeEstadoMascota(u, claveEstado(c)))) throw new Error("Todavía no tiene casa: su dueño aún no la abre en Mascotas.");
            }
            throw err;
          }
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
    if (x.tipo === "listo") { listo = true; mandaTema(); enviaDatos(); mandaCarinos(); return; }
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
      frame.src = "juegos/mascotas/index.html?v=mc-8";
      host.appendChild(frame);
      frame.addEventListener("load", () => frame.focus());
      vigilaTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
      offs.push(datos(x => { d = x; enviaDatos(); mandaPlaza(); }));
      offs.push(fb.watchEstadosMascotas(uid, x => { estados = x || {}; enviaDatos(); }));
      offs.push(fb.watchPrefsMascotas(uid, x => { prefs = x || {}; enviaDatos(); mandaCarinos(); }));
      offs.push(fb.watchCarinosMascotas(uid, x => { carinos = x || {}; mandaCarinos(); }));
    },
    destruir() {
      muerto = true;
      salePlaza();
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
