// Prueba con el juego: el VR de la sala (vr-sala.mjs) da lo mismo que el juego mismo — bitácora §82.
//
// Resumen: en la sala el VR lo calcula la página, con la regla de Mario Kart Wii sacada del código traducido. Para no
// confiar en la lectura, aquí se le pregunta AL JUEGO: la página abre una carrera directo (?modo=directa) y pide, con
// el gancho de prueba de directo_nativo.cpp (Module._mkw_vr_prueba), los puntos de un par para cada diferencia de VR
// de −9998 a +9998 (19 997). El juego los calcula en su próximo cuadro con sus dos funciones (0x8052D118: lo que gana
// el que llegó antes; 0x8052D1C0: lo que pierde el que llegó después). Comprueba:
//   1. que el gancho contestó las 19 997;
//   2. que lo que gana el ganador es, en cada una, lo que da puntosPar (vr-sala.mjs);
//   3. que lo que pierde el perdedor es lo mismo cambiado de signo;
//   4. la tabla de la curva en la memoria del juego (0x8088FF60): 0, 1, 8, 50, 125, y los números de la cuenta
//      (0, 1, 4, 3, 6, 2 y el paso 1/4999 de 0x8088FF90) como los usa vr-sala.mjs (el paso lo encontró esta prueba:
//      la lectura del código decía «÷ 5000» y daba 325 diferencias distintas de las 19 997);
//   5. que en la carrera el byte +0x20 de cada jugador (Raceinfo) es su puesto: los 12 distintos, del 1 al 12 (es lo
//      que la página lee al terminar).
// Como comparar un medidor nuevo contra el patrón: los mismos 19 997 puntos de entrada, lectura por lectura.
//
// Uso:  node web/navegador/prueba-vr.mjs [--puerto 8157] [--ventana]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const { puntosPar, CURVA, DIF_MAX, PASO } = await import(pathToFileURL(path.join(raiz, 'web/navegador/vr-sala.mjs')).href);
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8157));
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const p = await navegador.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('[pageerror] ' + e.message));
try {
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cc=c150&cpu=normal&pj=0&kart=1`);
  // el juego corriendo (el gancho va en el SectionMgr::Update de cada cuadro)
  await p.waitForFunction(() => window.mkw?._mkw_vr_prueba && window.mkwMenus?.estado?.().seccion > 0, null, { timeout: 120000 });

  // 1-3) las 19 997 diferencias, preguntadas al juego
  const N = 2 * DIF_MAX + 1;
  const r = await p.evaluate(async ([desde, n]) => {
    const M = window.mkw, ptr = M._mkw_vr_prueba(desde, n) >> 2;
    for (let i = 0; i < 400 && !M._mkw_vr_prueba_lista(); i++) await new Promise(s => setTimeout(s, 25));
    const H = new Int32Array(M.HEAPU8.buffer);
    return { lista: M._mkw_vr_prueba_lista(), res: Array.from(H.subarray(ptr, ptr + 2 * n)) };
  }, [-DIF_MAX, N]);
  ok('el juego contestó las 19 997 diferencias (en su cuadro siguiente)', r.lista === 1 && r.res.length === 2 * N, `${r.res.length / 2}`);
  let gana = 0, pierde = 0, primera = null;
  for (let k = 0; k < N; k++) {
    const d = -DIF_MAX + k, vg = d < 0 ? 9999 : 1, vp = vg + d, mio = puntosPar(vg, vp);
    if (r.res[2 * k] !== mio) { gana++; primera ??= `dif ${d}: juego ${r.res[2 * k]}, página ${mio}`; }
    if (r.res[2 * k + 1] !== -mio) { pierde++; primera ??= `dif ${d}: juego pierde ${r.res[2 * k + 1]}, página −${mio}`; }
  }
  ok('lo que gana el que llega antes: el juego y vr-sala.mjs dan lo mismo en las 19 997', gana === 0, primera || `de ${r.res[0]} a ${r.res[2 * N - 2]}`);
  ok('lo que pierde el que llega después: lo mismo, cambiado de signo, en las 19 997', pierde === 0, `${pierde} distintas`);
  const k0 = DIF_MAX;
  console.log(`  (igual VR: el juego da +${r.res[2 * k0]} / ${r.res[2 * k0 + 1]})`);

  // 4) la tabla y los números de la cuenta, en la memoria del juego
  const m = await p.evaluate(() => {
    const L = window.mkwMenus, b = 0x8088FF60;
    const f32 = x => { const v = new DataView(new ArrayBuffer(4)); v.setUint32(0, x); return v.getFloat32(0); };
    const s16 = x => (x << 16) >> 16;
    return { tabla: [0, 1, 2, 3, 4].map(i => s16(L.u16(b + 2 * i))), numeros: [12, 16, 20, 24, 28, 32].map(o => f32(L.u32(b + o))), paso: f32(L.u32(0x8088FF90)) };
  });
  ok('la tabla de la curva en el juego (0x8088FF60) es la de vr-sala.mjs: 0, 1, 8, 50, 125', JSON.stringify(m.tabla) === JSON.stringify(CURVA), JSON.stringify(m.tabla));
  ok('los números de la cuenta: 0, 1, 4, 3, 6, 2 y el paso 1/4999 (0x8088FF90)', JSON.stringify(m.numeros) === '[0,1,4,3,6,2]' && m.paso === Math.fround(1 / PASO),
     `${JSON.stringify(m.numeros)}, ${m.paso}`);

  // 5) en la carrera: el puesto de cada uno en Raceinfo +0x20
  await p.waitForFunction(() => {
    const L = window.mkwMenus, ri = L.u32(0x809BD730);
    return L.estado().seccion === 0x20 && ri && L.u32(ri + 0x28) >= 1;
  }, null, { timeout: 120000 });
  await p.waitForTimeout(6000);
  const puestos = await p.evaluate(() => {
    const L = window.mkwMenus, ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
    return Array.from({ length: 12 }, (_, i) => L.u8(L.u32(lista + 4 * i) + 0x20));
  });
  ok('en la carrera, Raceinfo +0x20 de cada jugador es su puesto (los 12 distintos, del 1 al 12)',
     JSON.stringify([...puestos].sort((a, b) => a - b)) === JSON.stringify(Array.from({ length: 12 }, (_, i) => i + 1)), JSON.stringify(puestos));
} finally {
  await navegador.close();
  servidor.kill();
}
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
