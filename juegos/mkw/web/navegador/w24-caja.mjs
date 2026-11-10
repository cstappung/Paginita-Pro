// W24 (bitácora §227): el teléfono solo dibuja. Lo que viaja por la red cada cuadro es la caja de W10 (§207): tramos
// [dirección u32][largo u32][bytes] de lo que cambió en la memoria de la Wii. Aquí, cómo achicarla para la red y cómo
// volver a armarla del otro lado. Todo puro (sin el juego): lo usa el Worker que mide (w10-dibujo.js) y el banco w24.
//
// Resumen:
//   - restarCaja(memoria, caja): la «resta» (XOR) de cada tramo contra lo que el otro lado ya tiene (su memoria, que es
//     la de la caja anterior). Un número que cambió poco (una posición, una velocidad) deja casi todos sus bits en 0.
//     Como mandar solo la variación de una lectura y no la lectura entera: el otro lado la suma a la que ya tiene.
//   - sumarCaja(memoria, resta): lo inverso (XOR otra vez): la caja original, para pegarla.
//   - ceros(bytes) / sinCeros(codigo): un código propio muy barato: corridas de ceros como [0, largo] y lo demás tal cual
//     (lo que más deja la resta son ceros). Sin tablas: se arma y se desarma de una pasada.
//   - comprimir(bytes, formato) / descomprimir(...): CompressionStream del navegador («deflate-raw»), en otro hilo de
//     Chrome; el teléfono lo deshace con DecompressionStream.
//   - empaquetar / desempaquetar: lo que de verdad viaja (la cabecera de 12 bytes: cuadro, largo de la caja, modo).
import { lugarDe } from './w10.mjs';

// la resta: una caja del mismo largo, con cada tramo XOR lo que la memoria tiene en ese lugar (la cabecera de cada tramo
// se deja igual). memoria = Uint8Array de MEM1 + MEM2 (como w10.mjs). No cambia la memoria.
export function restarCaja(memoria, caja, n = caja.length) {
  const out = new Uint8Array(n);
  out.set(caja.subarray(0, n));
  const v = new DataView(caja.buffer, caja.byteOffset, n);
  let i = 0;
  while (i + 8 <= n) {
    const dir = v.getUint32(i, true), largo = v.getUint32(i + 4, true), lugar = lugarDe(dir);
    if (lugar < 0 || i + 8 + largo > n) break;
    const a = i + 8;
    for (let k = 0; k < largo; k++) out[a + k] ^= memoria[lugar + k];
    i += 8 + largo;
  }
  return out;
}
// (XOR es su propio inverso: sumar = restar otra vez contra la misma memoria)
export const sumarCaja = restarCaja;

// el código de ceros: 0x00 + largo (1–255) = esa cantidad de ceros; cualquier otro byte va tal cual
// (un 0 suelto cuesta 2 bytes; una corrida de 255 ceros, 2)
export function ceros(b) {
  const out = new Uint8Array(b.length + (b.length >> 7) + 16);
  let o = 0, i = 0;
  while (i < b.length) {
    if (b[i] !== 0) { out[o++] = b[i++]; continue; }
    let f = i;
    while (f < b.length && b[f] === 0 && f - i < 255) f++;
    out[o++] = 0; out[o++] = f - i;
    i = f;
  }
  return out.subarray(0, o);
}
export function sinCeros(c, largo) {
  const out = new Uint8Array(largo);
  let o = 0, i = 0;
  while (i < c.length && o < largo) {
    if (c[i] !== 0) { out[o++] = c[i++]; continue; }
    o += c[i + 1]; i += 2;   // (los ceros ya están: el arreglo nace en 0)
  }
  return out;
}

async function porFlujo(bytes, flujo) {
  const r = new Response(new Blob([bytes]).stream().pipeThrough(flujo));
  return new Uint8Array(await r.arrayBuffer());
}
export const comprimir = (bytes, formato = 'deflate-raw') => porFlujo(bytes, new CompressionStream(formato));
export const descomprimir = (bytes, formato = 'deflate-raw') => porFlujo(bytes, new DecompressionStream(formato));

// los modos de lo que viaja: 0 = la caja tal cual, 1 = resta + ceros, 2 = resta + deflate, 3 = resta + ceros + deflate
export const MODOS = ['cruda', 'resta+ceros', 'resta+deflate', 'resta+ceros+deflate'];
// lo que viaja: [cuadro u32][largo de la caja u32][modo u8, 3 ceros][datos]
export async function empaquetar(memoria, caja, n, cuadro, modo = 1) {
  let datos = caja.subarray(0, n);
  if (modo >= 1) datos = restarCaja(memoria, caja, n);
  if (modo === 1 || modo === 3) datos = ceros(datos);
  if (modo >= 2) datos = await comprimir(datos);
  const p = new Uint8Array(12 + datos.length), v = new DataView(p.buffer);
  v.setUint32(0, cuadro >>> 0, true); v.setUint32(4, n, true); p[8] = modo;
  p.set(datos, 12);
  return p;
}
// del otro lado: la caja original (memoria = la del que recibe, todavía sin la caja pegada)
export async function desempaquetar(memoria, p) {
  const v = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const cuadro = v.getUint32(0, true), n = v.getUint32(4, true), modo = p[8];
  let datos = p.subarray(12);
  if (modo >= 2) datos = await descomprimir(datos);
  if (modo === 1 || modo === 3) datos = sinCeros(datos, n);
  const caja = modo >= 1 ? sumarCaja(memoria, datos, n) : datos.slice(0, n);
  return { cuadro, caja, n, modo };
}

// la cuenta de lo medido, por modo: bytes, ms de armar (del lado del PC) y de desarmar
export function crearCuenta() {
  const c = { cajas: 0, cruda: 0, porModo: MODOS.map(() => ({ bytes: 0, ms: 0, msDes: 0, max: 0 })) };
  return {
    c,
    sumar(modo, bytes, ms, msDes = 0) { const m = c.porModo[modo]; m.bytes += bytes; m.ms += ms; m.msDes += msDes; if (bytes > m.max) m.max = bytes; },
    resumen() {
      const n = Math.max(1, c.cajas);
      return {
        cajas: c.cajas, crudaKB: c.cruda / n / 1024,
        modos: MODOS.map((nombre, k) => {
          const m = c.porModo[k];
          return { nombre, kb: m.bytes / n / 1024, kbMax: m.max / 1024, razon: m.bytes ? c.cruda / m.bytes : 0,
                   ms: m.ms / n, msDes: m.msDes / n, mbitPor60: m.bytes / n * 60 * 8 / 1e6 };
        }),
      };
    },
  };
}
