// Paso 8 (H5, bitácora §188): un Worker del banco `cajas`: «juego» (productor) o «aurora» (consumidor).
// { t: 'juego', puerto|null, cuadros, piezas } → corre los cuadros y contesta { t: 'listo', ms, sumas, estado }
//   (con puerto: cada caja va a aurora por la cinta; sin puerto: lo hace todo en serie, como hoy)
// { t: 'aurora', puerto } → atiende la cinta
import { crearCinta, atenderCinta } from '/web/navegador/cajas.mjs';
import { llenar, convertir, VERTICES } from './trabajo.mjs';
onmessage = async e => {
  const m = e.data;
  if (m.t === 'aurora') { atenderCinta({ puerto: m.puerto, trabajar: v => convertir(v) }); postMessage({ t: 'atendiendo' }); return; }
  if (m.t !== 'juego') return;
  const sumas = [];
  const t0 = performance.now();
  if (!m.puerto) {
    const caja = new Uint8Array(VERTICES * 12);
    for (let f = 0; f < m.cuadros; f++) { const n = llenar(caja, f); sumas.push(convertir(caja.subarray(0, n))); }
    postMessage({ t: 'listo', ms: performance.now() - t0, sumas });
    return;
  }
  let vueltas = 0, fin = null;
  const cinta = crearCinta({ puerto: m.puerto, piezas: m.piezas || 3, tam: VERTICES * 12,
    alVolver: r => { sumas.push(r); if (++vueltas === m.cuadros) fin(); } });
  const todas = new Promise(r => { fin = r; });
  let msJuego = 0;
  for (let f = 0; f < m.cuadros; f++) {
    const caja = await cinta.tomar();
    const t1 = performance.now();
    const n = llenar(caja, f);
    msJuego += performance.now() - t1;
    cinta.entregar(caja, n, f);
  }
  await todas;
  postMessage({ t: 'listo', ms: performance.now() - t0, sumas, msJuego, estado: cinta.estado });
};
