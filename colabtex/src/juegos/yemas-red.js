/* El directo de Yemas: qué se manda, por dónde y qué ve el marco.

   Puro (sin DOM, sin Firebase, el reloj se inyecta) para poder probarlo en
   Node; `yemas.js` lo conecta con la malla y con la base.

   Dos caminos para el estado de cada huevo:

   - **La malla** (`malla.js`): cada estado, doce veces por segundo, a cada
     par con canal sano. No cuesta descarga.
   - **La base** (`vivo/<pid>/y/<uid>`): de respaldo. Cada uno escribe el
     suyo siempre, pero poco: un estado distinto del último escrito, como
     mucho cada `LENTO_MS`. Doce veces por segundo (`rapido`) solo cuando le
     falta canal con algún par desde hace `GRACIA_MS`; ese par, por su lado,
     ve lo mismo y lo está escuchando. Escribir no gasta la cuota; lo que la
     gasta es escuchar, y aquí cada uno escucha **solo los huevos que no le
     llegan por la malla, uno por uno** (`subs`). Con todos conectados nadie
     escucha nada y la base no descarga un byte por el juego.

   Un jugador con una versión vieja (cacheada) no se presenta en la malla:
   para los nuevos es un par sin canal, así que lo escuchan por la base y le
   escriben rápido. Sigue funcionando.

   **El estado se adelgaza antes de salir** (`adelgaza`), por los dos
   caminos: los golpes (`g`) viajan solo sus primeros `VIDA_GOLPE` ms y el
   último disparo, granada o explosión (`s`, `n`, `x2`) solo sus primeros
   `VIDA_SUCESO` ms. Antes iban en cada estado hasta que salía el siguiente,
   así que un huevo que disparó una vez seguía mandando los doce puntos de
   impacto de esa ráfaga doce veces por segundo para siempre. El marco ya
   compara por `.i` y por el id del golpe, así que dejar de mandarlos no
   cambia nada de lo que ve; en ese tiempo salen decenas de copias por la
   malla y varias por la base, y basta con que llegue una.

   **Qué ve el marco** (`mapa`): de cada huevo, el estado de mayor `q` entre
   lo que llegó por la malla y lo que llegó por la base. La malla vale
   mientras el canal está sano; al caerse, vale lo último que trajo hasta
   que la base conteste (un par que cerró la pestaña ya no está en la base,
   por su `onDisconnect`, y entonces desaparece del mapa, que es lo que
   necesita el marco para cambiar de director en zombis). */

export const LENTO_MS = 250;       // ritmo de la base cuando nadie la necesita
export const GRACIA_MS = 3000;     // sin canal tanto tiempo → la base va rápida
export const SOLAPE_MS = 1500;     // se sigue escuchando la base tras recuperar el canal
export const PUENTE_MS = 4000;     // lo último de la malla vale mientras la base no contesta
export const VIDA_GOLPE = 3000;
export const VIDA_SUCESO = 1500;
const SUCESOS = ["s", "n", "x2"];

export function crearDirecto({ ahora = () => Date.now() } = {}) {
  let q = 0, ultimoJson = "", ultimaT = -Infinity;
  const vistos = new Map();        // "s:<i>" → cuándo salió por primera vez
  const pares = new Map();         // uid → {p2p, fb, fbListo, malDesde, buenoDesde}

  const par = u => {
    let p = pares.get(u);
    if (!p) pares.set(u, p = { p2p: null, fb: null, fbListo: false, sub: false, malDesde: 0, buenoDesde: 0 });
    return p;
  };

  function adelgaza(e, t) {
    const o = { ...e };
    if (Array.isArray(o.g)) {
      const g = o.g.filter(x => Array.isArray(x) && +x[0] >= t - VIDA_GOLPE);
      if (g.length) o.g = g; else delete o.g;
    }
    const vivos = new Set();
    for (const k of SUCESOS) {
      const v = o[k];
      if (!v || typeof v !== "object" || v.i === undefined) continue;
      const clave = k + ":" + v.i;
      vivos.add(clave);
      if (!vistos.has(clave)) vistos.set(clave, t);
      if (t - vistos.get(clave) > VIDA_SUCESO) delete o[k];
    }
    for (const c of [...vistos.keys()]) if (!vivos.has(c)) vistos.delete(c);
    return o;
  }

  /* Un estado mío que sale del marco. `rapido` lo decide `decide`.
     Devuelve lo que va por la malla y, si toca, lo que se escribe en la base. */
  function sale(e, rapido) {
    const t = ahora();
    q = Math.max(q + 1, t);
    const o = adelgaza(e, t);
    const json = JSON.stringify(o);
    o.q = q;
    let escribir = null;
    if (json !== ultimoJson && (rapido || t - ultimaT >= LENTO_MS)) {
      escribir = o;
      ultimoJson = json;
      ultimaT = t;
    }
    return { paquete: o, escribir };
  }

  function recibeMalla(u, e) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return false;
    const n = +e.q;
    if (!Number.isFinite(n)) return false;
    const p = par(u);
    if (p.p2p && n <= p.p2p.q) return false;   // llegó tarde: ya hay uno más nuevo
    p.p2p = { q: n, e, t: ahora() };
    return true;
  }

  function recibeBase(u, v) {
    const p = par(u);
    if (!p.sub) return false;
    p.fbListo = true;
    // Una versión vieja no manda `q`: vale igual, porque con ella no hay malla.
    p.fb = v && typeof v === "object" ? { q: Number.isFinite(+v.q) ? +v.q : 0, e: v } : null;
    return true;
  }

  /* Cada tanto (y con cada estado propio): quién está sano, a quién hay
     que escuchar por la base y si la mía tiene que ir rápida.
     `otros`: los uids que me importan (los jugadores, menos yo y los que se
     fueron), `mirones`: los que se presentaron en la malla sin ser
     jugadores, `sano(u)`: si el canal con u está abierto. */
  function decide({ otros, mirones = [], sano, soyJugador }) {
    const t = ahora();
    let rapido = false;
    const subs = new Set();
    const marca = u => {
      const p = par(u), ok = sano(u);
      if (ok) { p.malDesde = 0; if (!p.buenoDesde) p.buenoDesde = t; }
      else { p.buenoDesde = 0; if (!p.malDesde) p.malDesde = t; }
      return { p, ok };
    };
    for (const u of otros) {
      const { p, ok } = marca(u);
      if (!ok || t - p.buenoDesde < SOLAPE_MS) subs.add(u);
      if (!ok && soyJugador && t - p.malDesde >= GRACIA_MS) rapido = true;
    }
    // Un mirón sin canal lee la base; no se le puede servir de otra forma.
    for (const u of mirones) {
      const { p, ok } = marca(u);
      if (!ok && soyJugador && t - p.malDesde >= GRACIA_MS) rapido = true;
    }
    for (const [u, p] of pares) {
      const quiero = subs.has(u);
      if (p.sub && !quiero) { p.sub = false; p.fb = null; p.fbListo = false; }
      else if (!p.sub && quiero) p.sub = true;
    }
    return { rapido, subs };
  }

  function mapa({ otros, sano }) {
    const t = ahora(), v = {};
    for (const u of otros) {
      const p = pares.get(u);
      if (!p) continue;
      let mejor = null;
      if (p.p2p && (sano(u) || (!p.fbListo && t - p.p2p.t < PUENTE_MS))) mejor = p.p2p;
      if (p.sub && p.fb && (!mejor || p.fb.q > mejor.q)) mejor = p.fb;
      if (mejor) v[u] = mejor.e;
    }
    return v;
  }

  return { sale, recibeMalla, recibeBase, decide, mapa, adelgaza };
}
