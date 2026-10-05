"use strict";
/* El medidor de descarga de la Realtime Database (Juegos).

   El plan gratuito trae ~360 MB de descarga al día para todo el sitio, y
   una sola cuenta leyendo nodos enteros desde la consola (o un bot) se lo
   come. La base no tiene cuotas por usuario y las reglas no pueden contar
   bytes, así que esto se mide donde se puede: en el navegador.

   - Cuenta lo que llega por el WebSocket de la base. El SDK guarda la
     clase `WebSocket` cuando se evalúa (no se puede cambiar por otra
     después), pero le pone su `onmessage` a cada conexión nueva: por eso
     se envuelve el *setter* de `WebSocket.prototype.onmessage`, que vale
     para cualquier conexión abierta después de `instala()`. El respaldo de
     long-polling no se mide (solo entra cuando el WebSocket no conecta).
   - Suma por día de Chile. Cada pestaña guarda lo suyo en
     `localStorage` (`fb.consumo.d.<día>.<pestaña>`), así varias pestañas
     del mismo navegador se suman, y con sesión además en
     `users/<uid>/consumo` = {dia, t: {pestaña: bytes}}, que suma los
     aparatos de la misma cuenta (juegos-main.js: `sincronizaConsumo`).
     Ese nodo ya es solo del dueño: no hizo falta tocar reglas.
   - Marca lo raro en `sospechas/<uid>` una vez por día y tipo: pasar de
     `aviso` en el día, `rafaga` en `ventana` minutos en una pestaña, o
     llegar al `tope`.
   - En el tope, juegos-main.js corta la conexión (`goOffline`) y tapa la
     página hasta el día siguiente.

   El límite honesto: todo esto corre en el navegador del jugador, así que
   quien reescribe el cliente o llama a la API REST con su token lo salta.
   Lo que lo cierra del lado del servidor son las reglas que no dejan leer
   colecciones enteras (database.rules.json: `partidas`, `soloPruebas`) y
   App Check. Esto frena el consumo descontrolado del cliente normal —
   abierto desde la consola, en un bucle, o por un error nuestro — y deja
   el rastro para los administradores. */

export const MB = 1048576;
export const LIMITES = {
  aviso: 40 * MB,      // en el día, sumando pestañas y aparatos: sospechoso
  tope: 80 * MB,       // en el día: se corta la conexión hasta mañana
  rafaga: 15 * MB,     // en una sola pestaña dentro de `ventana`: sospechoso
  ventana: 5 * 60000
};
const PREFIJO = "fb.consumo.d.";
const MARCAS = "fb.consumo.marcas.";

/* El día de Chile como texto AAAA-MM-DD (en-CA lo da así). */
export function diaChile(t = Date.now()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  } catch (e) {
    return new Date(t - 4 * 3600000).toISOString().slice(0, 10);
  }
}

/* Lo que pesa un mensaje. Los de Firebase son texto JSON; se cuenta un
   byte por carácter, que con nombres en español queda apenas por debajo
   del UTF-8 real (y Firebase factura además el TLS: es una estimación). */
export function bytesDe(d) {
  if (typeof d === "string") return d.length;
  if (d && typeof d.byteLength === "number") return d.byteLength;
  if (d && typeof d.size === "number") return d.size;
  return 0;
}

/* El total del día: cada pestaña cuenta una vez, con el número más alto
   que se sepa de ella (la copia local o la de la cuenta). */
export function totalDe(...mapas) {
  const mejor = {};
  for (const m of mapas) for (const [k, v] of Object.entries(m || {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && !(mejor[k] >= n)) mejor[k] = n;
  }
  return Object.values(mejor).reduce((a, b) => a + b, 0);
}

export function enVentana(muestras, ahora, ventana) {
  let s = 0;
  for (const [t, n] of muestras) if (t > ahora - ventana) s += n;
  return s;
}

/* Qué tipos de marca toca dar con estos números. */
export function juzga(total, rafaga, L = LIMITES) {
  const r = [];
  if (total >= L.aviso) r.push("dia");
  if (rafaga >= L.rafaga) r.push("rafaga");
  if (total >= L.tope) r.push("tope");
  return r;
}

export const enMB = b => Math.round(b / MB * 10) / 10;

/* localStorage con try/catch: en una ventana privada o sin permiso de
   almacenamiento puede lanzar, y el medidor tiene que seguir midiendo. */
export function almacenLocal(ls) {
  const s = () => { try { return ls || globalThis.localStorage || null; } catch (e) { return null; } };
  return {
    claves() { const a = s(), r = []; try { for (let i = 0; a && i < a.length; i++) r.push(a.key(i)); } catch (e) {} return r; },
    lee(k) { try { const a = s(); return a ? a.getItem(k) : null; } catch (e) { return null; } },
    pon(k, v) { try { const a = s(); if (a) a.setItem(k, v); } catch (e) {} },
    quita(k) { try { const a = s(); if (a) a.removeItem(k); } catch (e) {} }
  };
}

/* El medidor, sin navegador: el reloj, el almacén y las respuestas
   entran como parámetros, que es lo que deja probarlo en Node. */
export function crearMedidor({ almacen = almacenLocal(), ahora = () => Date.now(), limites = LIMITES, pestaña = null, alMarca = () => {}, alTope = () => {} } = {}) {
  const yo = pestaña || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  let dia = diaChile(ahora()), mios = 0, guardado = -1, nuevos = 0, muestras = [], cuenta = {}, cortado = false;

  const locales = () => {
    const r = {}, pre = PREFIJO + dia + ".";
    for (const k of almacen.claves()) if (k && k.startsWith(pre)) r[k.slice(pre.length)] = Number(almacen.lee(k)) || 0;
    return r;
  };
  const marcas = () => { try { return JSON.parse(almacen.lee(MARCAS + dia) || "[]"); } catch (e) { return []; } };
  /* Lo de otros días sobra: se borra al empezar y al cambiar de día. */
  const limpia = () => {
    for (const k of almacen.claves()) {
      if (k && (k.startsWith(PREFIJO) && !k.startsWith(PREFIJO + dia + ".") || k.startsWith(MARCAS) && k !== MARCAS + dia)) almacen.quita(k);
    }
  };
  limpia();

  function estado() {
    const loc = locales();
    loc[yo] = mios;
    const total = totalDe(loc, cuenta);
    return { dia, pestaña: yo, mios, total, rafaga: enVentana(muestras, ahora(), limites.ventana), cortado, limites };
  }

  return {
    pestaña: yo,
    cuenta(n) { if (n > 0) { mios += n; nuevos += n; } },
    /* Lo que la cuenta dice de sí misma (`users/<uid>/consumo`). Un mapa
       de otro día no vale. */
    ponCuenta(v) { cuenta = v && v.dia === dia && v.t && typeof v.t === "object" ? v.t : {}; },
    estado,
    /* Cada par de segundos: guarda, suma y juzga. */
    tick() {
      const t = ahora(), hoy = diaChile(t);
      if (hoy !== dia) { dia = hoy; mios = 0; guardado = -1; nuevos = 0; muestras = []; cuenta = {}; cortado = false; limpia(); }
      if (nuevos) { muestras.push([t, nuevos]); nuevos = 0; }
      muestras = muestras.filter(([m]) => m > t - limites.ventana);
      if (mios !== guardado) { almacen.pon(PREFIJO + dia + "." + yo, String(mios)); guardado = mios; }
      const e = estado(), ya = marcas(), toca = juzga(e.total, e.rafaga, limites);
      const nuevas = toca.filter(x => !ya.includes(x));
      if (nuevas.length) almacen.pon(MARCAS + dia, JSON.stringify(ya.concat(nuevas)));
      for (const tipo of nuevas) { try { alMarca(tipo, e); } catch (err) { console.warn(err); } }
      if (toca.includes("tope") && !cortado) { cortado = e.cortado = true; try { alTope(e); } catch (err) { console.warn(err); } }
      return e;
    }
  };
}

/* Envuelve el setter de `onmessage` para contar lo que trae cada
   conexión con la base. Idempotente. */
const BASE = /(^|\.)(firebaseio\.com|firebasedatabase\.app)$/;
export function esDeLaBase(url) {
  try { return BASE.test(new URL(String(url)).hostname); } catch (e) { return false; }
}
let instalado = false;
const oyentes = new Set();
export function instala(WS = globalThis.WebSocket) {
  if (instalado || !WS || !WS.prototype) return false;
  const d = Object.getOwnPropertyDescriptor(WS.prototype, "onmessage");
  if (!d || !d.set || !d.configurable) return false;
  Object.defineProperty(WS.prototype, "onmessage", {
    configurable: true, enumerable: d.enumerable,
    get() { return d.get.call(this); },
    set(fn) {
      if (typeof fn === "function" && esDeLaBase(this.url)) {
        const original = fn;
        fn = function (ev) {
          const n = bytesDe(ev && ev.data);
          for (const o of oyentes) { try { o(n); } catch (e) {} }
          return original.call(this, ev);
        };
      }
      d.set.call(this, fn);
    }
  });
  instalado = true;
  return true;
}
export const alDescargar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };

/* En la página se instala al importar el módulo, que juegos-main.js
   importa antes que nada: tiene que ir antes de la primera conexión. */
if (typeof document !== "undefined" && typeof WebSocket !== "undefined") instala();
