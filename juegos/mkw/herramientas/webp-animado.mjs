// Junta varias fotos WebP (cuadros) en un WebP ANIMADO (como un GIF, pero 10-15 veces más liviano) — bitácora §56.
//
// Resumen: un archivo WebP es un "RIFF": una caja con trozos etiquetados (formato público: developers.google.com/speed/
// webp/docs/riff_container). Una foto común trae un trozo 'VP8 ' (la imagen comprimida). Uno animado trae:
//   'VP8X' (tamaño del lienzo y la marca "animado"), 'ANIM' (color de fondo y cuántas vueltas: 0 = siempre) y un
//   'ANMF' por cuadro (posición, tamaño, cuánto dura y adentro el 'VP8 ' de ese cuadro, tal cual).
// No se recomprime nada: se sacan los 'VP8 ' de cada foto (las que hizo Chrome con toDataURL('image/webp')) y se meten
// en sus 'ANMF'. Lo usa herramientas/fotos-pistas.mjs para los videítos de la vista previa al elegir pista.
//
// Uso:  import { webpAnimado } from './webp-animado.mjs';  webpAnimado([buf1, buf2, …], { ms: 100 }) → Buffer

const u24 = n => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255]);
function trozo(etiqueta, datos) {
  const cab = Buffer.alloc(8);
  cab.write(etiqueta, 0, 'ascii'); cab.writeUInt32LE(datos.length, 4);
  return Buffer.concat([cab, datos, datos.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);   // se rellena a par
}
// Los trozos de un WebP: [{ etiqueta, datos }]
function trozos(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error('no es WebP');
  const lista = [];
  for (let p = 12; p + 8 <= b.length;) {
    const etiqueta = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4);
    lista.push({ etiqueta, datos: b.subarray(p + 8, p + 8 + n) });
    p += 8 + n + (n & 1);
  }
  return lista;
}
// Ancho y alto de un 'VP8 ' (con pérdida): a partir del byte 6 vienen 2 bytes de ancho y 2 de alto (14 bits cada uno)
const tamVp8 = d => [d.readUInt16LE(6) & 0x3FFF, d.readUInt16LE(8) & 0x3FFF];

export function webpAnimado(cuadros, { ms = 100, vueltas = 0 } = {}) {
  let ancho = 0, alto = 0, alfa = false;
  const anmf = cuadros.map(b => {
    const t = trozos(b);
    const imagen = t.filter(x => x.etiqueta === 'ALPH' || x.etiqueta === 'VP8 ' || x.etiqueta === 'VP8L');
    const vp8 = imagen.find(x => x.etiqueta === 'VP8 ');
    if (!vp8) throw new Error('cuadro sin VP8 (¿sin pérdida?)');
    if (imagen.some(x => x.etiqueta === 'ALPH')) alfa = true;
    const [w, h] = tamVp8(vp8.datos);
    ancho = Math.max(ancho, w); alto = Math.max(alto, h);
    // ANMF: x/2, y/2, ancho-1, alto-1, duración (24 bits cada uno), banderas (2 = no mezclar con el anterior)
    return trozo('ANMF', Buffer.concat([u24(0), u24(0), u24(w - 1), u24(h - 1), u24(ms), Buffer.from([2]),
      ...imagen.map(x => trozo(x.etiqueta, x.datos))]));
  });
  const vp8x = Buffer.concat([Buffer.from([0x02 | (alfa ? 0x10 : 0), 0, 0, 0]), u24(ancho - 1), u24(alto - 1)]);
  const anim = Buffer.alloc(6); anim.writeUInt32LE(0xFF000000, 0); anim.writeUInt16LE(vueltas, 4);
  const cuerpo = Buffer.concat([Buffer.from('WEBP'), trozo('VP8X', vp8x), trozo('ANIM', anim), ...anmf]);
  const riff = Buffer.alloc(8); riff.write('RIFF', 0, 'ascii'); riff.writeUInt32LE(cuerpo.length, 4);
  return Buffer.concat([riff, cuerpo]);
}
