/* El directo de Yemas: qué se manda, a quién y qué ve el marco.

   Puro (sin DOM, sin Firebase, el reloj y la malla se inyectan) para poder
   probarlo en Node; `yemas.js` lo conecta con la malla (`malla.js`).

   **El directo va solo por la malla, nunca por la base.** Antes había un
   respaldo en `vivo/<pid>/y`: el par que no lograba canal directo escribía y
   escuchaba su estado por Firebase doce veces por segundo, que es justo lo
   que se comía la cuota diaria de descarga. Ya no existe, ni en el cliente
   ni en las reglas (que rechazan escribir ahí).

   **El par sin canal se sirve por un tercero.** Cada uno anuncia por la
   malla, cada segundo, con quién tiene canal sano (`{y:"ok", l}`). Cuando
   me llega por canal directo el estado de O y sé que T (con quien sí tengo
   canal) no lo tiene a O, se lo reenvío a T — pero solo si soy el de uid
   menor entre los que tienen canal con los dos, así un estado no viaja
   reenviado por todos a la vez. Si dos creen ser el elegido (uno no sabe
   del otro), T recibe dos copias y se queda con una por el `q`. Solo se
   reenvía lo que llegó directo, un salto: no hay bucles. Lo que no tiene
   arreglo es un par que no conecta y no tiene a nadie en común (un duelo
   entre dos redes que no se dejan conectar): ese par no se ve, y
   `inalcanzables` lo dice para que la pantalla lo avise en vez de callar.

   **El estado se adelgaza antes de salir** (`adelgaza`): los golpes (`g`)
   viajan solo sus primeros `VIDA_GOLPE` ms y el último disparo, granada o
   explosión (`s`, `n`, `x2`) solo sus primeros `VIDA_SUCESO` ms. El marco ya
   compara por `.i` y por el id del golpe, así que dejar de mandarlos no
   cambia nada de lo que ve; en ese tiempo salen decenas de copias.

   **Qué ve el marco** (`mapa`): de cada huevo, el estado de mayor `q` que
   llegó, directo o reenviado. Vale mientras haya camino hasta él (canal
   directo, o alguien con canal conmigo que dice tenerlo) o, recién cortado,
   durante `PUENTE_MS`. Un par que cerró la pestaña pierde todos sus canales
   y desaparece del mapa, que es lo que necesita el marco para cambiar de
   director en zombis.

   Los paquetes sin `y` son de la versión anterior (el estado pelado, sin
   origen): valen como estado de quien los manda. */

export const PUENTE_MS = 4000;     // lo último que llegó vale tanto tras perder el camino
export const AVISO_MS = 8000;      // sin camino tanto tiempo → se avisa en pantalla
export const VIDA_GOLPE = 3000;
export const VIDA_SUCESO = 1500;
export const OK_MS = 1000;         // cada cuánto se anuncia con quién hay canal
const SUCESOS = ["s", "n", "x2"];

export function crearDirecto({ uid, ahora = () => Date.now(), sano = () => false, conectados = () => [] } = {}) {
  let q = 0;
  const vistos = new Map();        // "s:<i>" → cuándo salió por primera vez
  const mejor = new Map();         // origen → {q, e, t}
  const oks = new Map();           // par → Set de con quién tiene canal
  const sinCamino = new Map();     // origen → desde cuándo no hay camino

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

  // Un estado mío que sale del marco: el paquete que va a cada par.
  function sale(e) {
    const t = ahora();
    q = Math.max(q + 1, t);
    const o = adelgaza(e, t);
    o.q = q;
    return { y: "e", o: uid, e: o };
  }

  // Lo que anuncio: con quién tengo canal sano.
  const anuncio = () => ({ y: "ok", l: conectados() });

  const tiene = (r, u) => !!oks.get(r)?.has(u);

  // A quién le reenvío el estado de `o` que me llegó directo de él.
  function destinos(o) {
    const out = [];
    for (const t of conectados()) {
      if (t === o || !oks.has(t) || tiene(t, o)) continue;   // sin anuncio todavía, o ya lo tiene
      let elegido = uid;
      for (const r of conectados()) {
        if (r !== o && r !== t && r < elegido && tiene(r, o) && tiene(r, t)) elegido = r;
      }
      if (elegido === uid) out.push(t);
    }
    return out;
  }

  /* Un paquete que llegó por el canal de `de`. Devuelve si cambia lo que ve
     el marco y a quién hay que reenviarle qué. */
  function recibe(de, d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) return { cambio: false, reenvia: null };
    if (d.y === "ok") {
      oks.set(de, new Set(Array.isArray(d.l) ? d.l.filter(x => typeof x === "string") : []));
      return { cambio: false, reenvia: null };
    }
    const o = d.y === "e" ? d.o : de, e = d.y === "e" ? d.e : d;
    if (typeof o !== "string" || o === uid || !e || typeof e !== "object" || Array.isArray(e)) return { cambio: false, reenvia: null };
    const n = +e.q;
    if (!Number.isFinite(n)) return { cambio: false, reenvia: null };
    const m = mejor.get(o);
    if (m && n <= m.q) return { cambio: false, reenvia: null };   // llegó tarde o repetido
    mejor.set(o, { q: n, e, t: ahora() });
    const a = de === o ? destinos(o) : [];
    return { cambio: true, reenvia: a.length ? { a, d: { y: "e", o, e } } : null };
  }

  // ¿Hay camino hasta `o`? Canal directo, o alguien conectado conmigo que lo tiene.
  const camino = o => sano(o) || conectados().some(r => r !== o && tiene(r, o));

  function mapa(otros) {
    const t = ahora(), v = {};
    for (const o of otros) {
      const m = mejor.get(o);
      if (m && (camino(o) || t - m.t < PUENTE_MS)) v[o] = m.e;
    }
    return v;
  }

  // Los que hace rato no tienen camino: para avisarlo en pantalla.
  function inalcanzables(otros) {
    const t = ahora(), out = [];
    for (const o of otros) {
      if (camino(o)) { sinCamino.delete(o); continue; }
      if (!sinCamino.has(o)) sinCamino.set(o, t);
      if (t - sinCamino.get(o) >= AVISO_MS) out.push(o);
    }
    for (const o of [...sinCamino.keys()]) if (!otros.includes(o)) sinCamino.delete(o);
    return out;
  }

  return { sale, anuncio, recibe, mapa, inalcanzables, adelgaza, destinos };
}
