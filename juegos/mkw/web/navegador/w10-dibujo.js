// W10 (bitácora §207): el Worker del dibujo, por ahora «de mentira»: recibe cada caja de la carrera por la cinta
// (cajas.mjs), pega sus tramos en su copia de la memoria de la Wii (MEM1 + MEM2, 152 MiB) y la devuelve. Así el modo 3
// del programa mide el costo completo del lado de la carrera, con un Worker que de verdad trabaja la caja en otro núcleo.
// (El dibujo de verdad, con su propia copia del programa, es la parte siguiente de W10.)
// W24 (§227): además mide cuánto se achica cada caja para la red (w24-caja.mjs): la resta contra la copia + el código de
// ceros en todas (es lo barato, va en el camino); deflate (CompressionStream) en una de cada `cadaDeflate`, aparte, sin
// frenar la vuelta de la caja. { t: 'compresion' } → el resumen.
import { atenderCinta } from './cajas.mjs';
import { aplicarCaja, huellaDe, MEM1, MEM2 } from './w10.mjs';
import { restarCaja, ceros, sinCeros, sumarCaja, comprimir, descomprimir, crearCuenta } from './w24-caja.mjs';

const memoria = new Uint8Array(MEM1 + MEM2);
const cuenta = crearCuenta();
const cadaDeflate = 4;
let enVuelo = 0, saltadas = 0, malasVuelta = 0, vistas = 0;
// (en el modo 3 la copia nace en cero y cada tramo se completa la primera vez que viaja: las primeras 120 cajas no cuentan)
const CALENTAR = 120;
const medirDeflate = async (resta, cod, n) => {
  enVuelo++;
  try {
    let t0 = performance.now(); const d2 = await comprimir(resta); const ms2 = performance.now() - t0;
    t0 = performance.now(); const d3 = await comprimir(cod); const ms3 = performance.now() - t0;
    t0 = performance.now(); const x = await descomprimir(d3); const msDes3 = performance.now() - t0;
    if (x.length !== cod.length) malasVuelta++;
    // (los de deflate se cuentan como si fueran todas: ×cadaDeflate)
    cuenta.sumar(2, d2.length * cadaDeflate, ms2 * cadaDeflate);
    cuenta.sumar(3, d3.length * cadaDeflate, ms3 * cadaDeflate, msDes3 * cadaDeflate);
  } finally { enVuelo--; }
};
const trabajar = caja => {
  const n = caja.length;
  if (++vistas > CALENTAR && n < (1 << 20)) {   // (la foto entera no cuenta: va una vez)
    let t0 = performance.now();
    const resta = restarCaja(memoria, caja, n);
    const cod = ceros(resta);
    const ms1 = performance.now() - t0;
    t0 = performance.now();
    const vuelta = sumarCaja(memoria, sinCeros(cod, n), n);
    const msDes1 = performance.now() - t0;
    for (let k = 0; k < n; k += 64) if (vuelta[k] !== caja[k]) { malasVuelta++; break; }
    cuenta.c.cajas++; cuenta.c.cruda += n;
    cuenta.sumar(0, n, 0);
    cuenta.sumar(1, cod.length, ms1, msDes1);
    if (cuenta.c.cajas % cadaDeflate === 0) { if (enVuelo < 3) medirDeflate(resta, cod, n); else saltadas++; }
  }
  return aplicarCaja(memoria, caja);
};
self.onmessage = e => {
  if (e.data?.t === 'puerto') atenderCinta({ puerto: e.data.puerto, trabajar });
  else if (e.data?.t === 'huella') self.postMessage({ t: 'huella', h: huellaDe(memoria) });
  else if (e.data?.t === 'compresion') self.postMessage({ t: 'compresion', r: { ...cuenta.resumen(), saltadas, malasVuelta } });
};
