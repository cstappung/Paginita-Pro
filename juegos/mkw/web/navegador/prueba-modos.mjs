// Prueba de los modos de la sala con el juego de verdad (modos.mjs + modos_nativo.cpp) — bitácora §72.
//
// Resumen: dos pestañas, como en prueba-enlinea.mjs (A anfitrión con el WFC de la sala, B el otro; la malla WebRTC de
// verdad), pero con el modo de la sala en la dirección:
//   por omisión: ?estilo=copa&carreras=1&cc=c100      (una copa de 1 carrera, a 100cc)
//   --playlist:  ?estilo=playlist&pistas=13.2&cc=espejo (la cola de 1 pista: la copa 13, fila 2, en espejo)
// Nadie toca nada: el juego elige solo cuando se acaba su reloj. En la carrera nadie maneja, y el juego desconecta a
// quien pasa 30 s sin tocar un botón (el control de inactividad del juego original, §72): por eso a los 10 s de
// carrera cada pestaña la da por terminada (window.mkwTerminarCarrera → modos_nativo.cpp: como cruzar la meta).
// --sin-terminar = no la termina (se ve el corte por inactividad a los 30 s).
// --corte (§73) = la 1.ª carrera no la termina: el juego corta a los dos por inactividad, las dos páginas cierran el
// aviso y vuelven a entrar solas a la sala; la 2.ª carrera sí se termina y completa la copa (la cortada no cuenta).
// Se comprueba:
//   - el reloj de elegir arranca en 45 s (el número del juego quedó en 45.0 y el reloj de la página 0x90 pasa de 40);
//   - el anfitrión decidió con la cilindrada pedida (y en la playlist, con la pista de la cola);
//   - la carrera que corren los dos es esa (la pista y la cilindrada de Racedata);
//   - al terminar la carrera, los dos cuentan 1 de 1 y arman la misma tabla (2 pilotos);
//   - los dos muestran la tabla final y avisan el fin (en el sitio, el anfitrión vuelve al vestíbulo con ella).
// Fotos y registro en build/web/datos/modos/.
//
// Uso:  node web/navegador/prueba-modos.mjs [--playlist] [--ventana] [--sin-terminar] [--corte]     (~6 min; --corte ~10)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8147;
const PLAYLIST = process.argv.includes('--playlist');
const CORTE = process.argv.includes('--corte');
const carpeta = path.join(raiz, 'build/web/datos/modos', (PLAYLIST ? 'playlist' : 'copa') + (CORTE ? '-corte' : ''));
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const MODO = PLAYLIST ? '&estilo=playlist&pistas=13.2&cc=espejo' : '&estilo=copa&carreras=1&cc=c100';
const EXTRA = (process.argv.find(a => a.startsWith('--extra=')) || '').slice(8);   // p. ej. --extra=&directo=0
// con el build -DMKW_VIGIA: vigilar una parte de RKNet::Controller (--vigia=desplazamiento,tamaño; por omisión el error, +0x2C)
const VIGIA = (() => { const a = process.argv.find(x => x.startsWith('--vigia')); if (!a) return null; const [d, n] = (a.split('=')[1] || '0x2C,8').split(','); return [Number(d), Number(n)]; })();
const PISTA = 0x100 + 4 * 13 + 2, CC = PLAYLIST ? 3 : 1;
const TERMINAR = !process.argv.includes('--sin-terminar');
// la regla de inactividad del juego (30 s quieto = afuera) está apagada en las salas (§73); estas dos la necesitan
const INACTIVIDAD = !TERMINAR || CORTE ? '&inactividad=1' : '';

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
const sala = 'modos-' + Date.now().toString(36);
const registro = [];
async function abrir(nombre, extra) {
  const p = await contexto.newPage();
  p.on('pageerror', e => { console.log(`[${nombre}] [pageerror] ${e.message}`); registro.push(`[${nombre}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${nombre}] ${m.text().slice(0, 300)}`));
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${nombre.toLowerCase()}${sala}&nombre=Piloto${nombre}&modo=enlinea${MODO}${INACTIVIDAD}${EXTRA}${extra}`);
  return p;
}
// lo que mira la prueba en cada pestaña: la sección, el reloj del juego (página 0x90 SELECTStageMgr, +0x6C) y el modo
const mirar = p => p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.();
  if (!e) return null;
  const f = b => { const d = new DataView(new ArrayBuffer(4)); d.setUint32(0, b >>> 0); return d.getFloat32(0); };
  const sm = L.u32(0x809C1E38), sec = sm && L.u32(sm), pag = sec ? L.u32(sec + 8 + 4 * 0x90) : 0;
  const rd = L.u32(0x809BD728);
  return { s: e.seccion, ps: e.paginas, reloj: pag ? f(L.u32(pag + 0x6C)) : null, numero: f(L.u32(0x80899EF4)),
           modo: window.mkwSalaModo?.estado(), decisiones: window.mkwEstado.decisiones || [], fin: window.mkwEstado.finModo || null,
           pista: L.u32(0x8043319C + 0x10) /* CupsConfig (menus.mjs CUPS): la pista de la carrera */,
           etapa: (ri => ri ? L.u32(ri + 0x28) : -1)(L.u32(0x809BD730)), cuadro: (ri => ri ? L.u32(ri + 0x20) : -1)(L.u32(0x809BD730)), cc: rd ? L.u32(rd + 0x20 + 0xB48 + 4) : -1,
           banderas: rd ? L.u32(rd + 0x20 + 0xB48 + 0x28) : 0, tabla: !document.getElementById('mkw-tabla')?.hidden,
           // RKNet::Controller: estado de la conexión (+0x28), errorParams (+0x2C, +0x30), aids desconectados (+0x292C)
           red: (c => c ? [L.u32(c + 0x28), L.u32(c + 0x2C), L.u32(c + 0x30), L.u32(c + 0x292C)] : null)(L.u32(0x809C20D8)) };
}).catch(() => null);

const t0 = Date.now();
const A = await abrir('A', '&nodo=2&anfitrion=1');
await A.waitForFunction(() => window.mkwRed?.presentador, null, { timeout: 60000 });
await A.evaluate(() => window.mkwRed.presentador.presentar({ vr: 6789, br: 5432 }));
await espera(15000);
const B = await abrir('B', '&nodo=3');

const vio = { A: {}, B: {} }, maxReloj = { A: 0, B: 0 }, ultimo = {};
const limite = Date.now() + 16 * 60000;
let fotoCarrera = false, fotoTabla = false;
while (Date.now() < limite) {
  for (const [n, p] of [['A', A], ['B', B]]) {
    const e = await mirar(p); if (!e) continue;
    ultimo[n] = e;
    const firma = `0x${e.s.toString(16)} [${e.ps.map(x => x.toString(16)).join(',')}]`;
    if (vio[n].firma !== firma) { vio[n].firma = firma; registro.push(`[${n}] pantalla ${firma} a los ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
    // un cartel del juego (página 0x51, PAGE_MESSAGEBOX) durante la elección: foto para leer qué dice
    if (e.s === 0x58 && e.ps.includes(0x51) && !vio[n].cartel) {
      vio[n].cartel = true; await espera(1500);
      await p.locator('#canvas').screenshot({ path: path.join(carpeta, `${n}-cartel.png`) }).catch(() => {});
      console.log(`  ${n}: el juego mostró un cartel (página 0x51) en la elección — foto ${n}-cartel.png`);
    }
    if (e.s === 0x58 && e.reloj != null) maxReloj[n] = Math.max(maxReloj[n], e.reloj);
    const marca = e.s === 0x58 ? 'sala' : e.s === 0x68 ? 'carrera' : '';
    if (marca && !vio[n][marca]) { vio[n][marca] = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: ${marca} a los ${vio[n][marca]} s`); }
    if (e.s !== 0x78 && e.s !== 0x79) vio[n].redAntes = e.red;
    if (e.s === 0x68 && !vio[n].datosCarrera) vio[n].datosCarrera = { pista: e.pista, cc: e.cc, banderas: e.banderas };
    // en la carrera: un muestreo rápido (cada 4 ms) del estado de RKNet en la página, para ver qué cambia antes del corte
    if (e.s === 0x68 && !vio[n].muestreo) vio[n].muestreo = await p.evaluate(() => {
      const L = window.mkwMenus; window.__cambiosRed = []; let ant = '';
      setInterval(() => { const c = L.u32(0x809C20D8), ri = L.u32(0x809BD730);
        const v = c ? [L.u32(c + 0x28), L.u32(c + 0x2C), L.u32(c + 0x30), L.u32(c + 0x292C), L.u8(c + 0x2755), L.u8(c + 0x2758), L.u32(c + 0x34)].join(',') : 'sin';
        if (v !== ant) { window.__cambiosRed.push(`cuadro ${ri ? L.u32(ri + 0x20) : -1}: ${v}`); ant = v; } }, 4);
      return true; }).catch(() => false);
    // a los 10 s de carrera (etapa 2 = corriendo, 600 cuadros), terminarla como si cruzaran la meta
    // --corte: después del corte, la vuelta a la sala y la carrera siguiente
    if (vio[n].corte && e.s === 0x58 && !vio[n].volvio) { vio[n].volvio = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: de vuelta en la sala a los ${vio[n].volvio} s`); }
    if (vio[n].volvio && e.s === 0x68 && !vio[n].carrera2) { vio[n].carrera2 = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: otra carrera a los ${vio[n].carrera2} s`); }
    if (TERMINAR && (!CORTE || vio[n].volvio) && e.s >= 0x68 && e.s <= 0x77 && e.etapa === 2 && e.cuadro > 600 && !vio[n].pidioFin) {
      vio[n].pidioFin = await p.evaluate(() => window.mkwTerminarCarrera()).catch(() => false);
      console.log(`  ${n}: pidió terminar la carrera en el cuadro ${e.cuadro} (${vio[n].pidioFin ? 'hecho' : 'sin la función'})`);
    }
    if (VIGIA && e.s === 0x68 && !vio[n].vigia) vio[n].vigia = await p.evaluate(([d, k]) => { const c = window.mkwMenus.u32(0x809C20D8); return c ? window.mkwVigiar(c + d, k) && c.toString(16) : false; }, VIGIA).catch(() => false);
    if (e.modo?.terminadas >= 1 && !vio[n].termino) { vio[n].termino = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: carrera terminada a los ${vio[n].termino} s`); }
    if (e.fin && !vio[n].fin) { vio[n].fin = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: fin del modo a los ${vio[n].fin} s`); }
  }
  // los paquetes del juego con la otra consola, cada 2 s desde la votación (¿se corta el flujo antes de un corte?)
  if (vio.A.sala && Date.now() - (vio.ultimaCuenta || 0) > 2000) {
    vio.ultimaCuenta = Date.now();
    for (const [n, p, otra] of [['A', A, '10.77.0.3'], ['B', B, '10.77.0.2']]) {
      const c = await p.evaluate(o => window.mkwRed.pila.cuentas()[o] || null, otra).catch(() => null);
      registro.push(`[${n}] cuentas ${((Date.now() - t0) / 1000).toFixed(0)} s con ${otra}: ${JSON.stringify(c)}`);
    }
  }
  if (!fotoCarrera && vio.A.carrera && vio.B.carrera) { fotoCarrera = true; await espera(6000); await A.locator('#canvas').screenshot({ path: path.join(carpeta, 'A-carrera.png') }).catch(() => {}); }
  // un corte (el juego sale a 0x78/0x79): foto del aviso del juego (trae el número de error) y se termina a los 20 s
  for (const [n, p] of [['A', A], ['B', B]]) {
    if (vio[n].corte || !(ultimo[n]?.s === 0x78 || ultimo[n]?.s === 0x79)) continue;
    console.log(`  ${n}: cambios de RKNet [estado, error, código, desconectados, apagar, grosería, +0x34]: ` + JSON.stringify(await p.evaluate(() => window.__cambiosRed).catch(() => null)));
    vio[n].corte = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: el juego se desconectó a los ${vio[n].corte} s — RKNet [estado, error, código, desconectados] ${JSON.stringify(ultimo[n].red)} (antes ${JSON.stringify(vio[n].redAntes)})`);
    await espera(1500); await p.locator('#canvas').screenshot({ path: path.join(carpeta, `${n}-corte.png`) }).catch(() => {});
  }
  if (!CORTE && vio.A.corte && vio.B.corte && Date.now() - t0 > 1000 * Number(vio.A.corte) + 20000) break;
  if (!fotoTabla && ultimo.A?.tabla) { fotoTabla = true; await A.screenshot({ path: path.join(carpeta, 'A-tabla.png') }).catch(() => {}); }
  if (vio.A.fin && vio.B.fin) break;
  await espera(1000);
}
const a = ultimo.A || {}, b = ultimo.B || {};
ok('el reloj de elegir del juego quedó en 45 s (el número del juego)', a.numero === 45 && b.numero === 45 && a.modo?.relojPuesto && b.modo?.relojPuesto, `A ${a.numero}, B ${b.numero}`);
ok('el reloj de elegir arrancó en 45 s en las dos (pasó de 40)', maxReloj.A > 40 && maxReloj.B > 40, `máximo visto A ${maxReloj.A.toFixed(1)} s, B ${maxReloj.B.toFixed(1)} s`);
const dec = (a.decisiones || [])[0];
ok(`el anfitrión decidió con la cilindrada pedida (${CC})` + (PLAYLIST ? ' y la pista de la cola' : ''),
   !!dec && dec.cc === CC && (!PLAYLIST || dec.pista === PISTA), JSON.stringify(a.decisiones));
ok('los dos llegaron a la carrera en línea', !!vio.A.carrera && !!vio.B.carrera, `A ${vio.A.carrera ?? '-'} s, B ${vio.B.carrera ?? '-'} s`);
const ca = vio.A.datosCarrera, cb = vio.B.datosCarrera;
const ccOk = c => c && (CC === 3 ? (c.cc === 2 && (c.banderas & 1)) : c.cc === CC);   // espejo = 150cc con la bandera de espejo
ok('la carrera de los dos es la decidida (pista y cilindrada)', ccOk(ca) && ccOk(cb) && (!PLAYLIST || (ca.pista === PISTA && cb.pista === PISTA)) && ca.pista === cb.pista,
   `A ${JSON.stringify(ca)}, B ${JSON.stringify(cb)}`);
ok('al terminar la carrera los dos cuentan 1 de 1', a.modo?.terminadas === 1 && b.modo?.terminadas === 1, `A ${vio.A.termino ?? '-'} s, B ${vio.B.termino ?? '-'} s`);
const ta = (a.fin || []).map(x => `${x.nombre}:${x.puntos}`).join(','), tb = (b.fin || []).map(x => `${x.nombre}:${x.puntos}`).join(',');
ok('los dos armaron la misma tabla, con los 2 pilotos', (a.fin || []).length === 2 && ta === tb, `A ${ta} · B ${tb}`);
ok('los dos mostraron la tabla final y avisaron el fin', !!vio.A.fin && !!vio.B.fin && fotoTabla, `A ${vio.A.fin ?? '-'} s, B ${vio.B.fin ?? '-'} s`);
if (!CORTE) ok('ninguno se desconectó', !vio.A.corte && !vio.B.corte, `A ${vio.A.corte ?? '-'} s, B ${vio.B.corte ?? '-'} s`);
else {
  ok('en la 1.ª carrera el juego cortó a los dos (nadie tocó nada 30 s)', !!vio.A.corte && !!vio.B.corte, `A ${vio.A.corte ?? '-'} s, B ${vio.B.corte ?? '-'} s`);
  const cortesA = await A.evaluate(() => window.mkwEstado.cortes || []).catch(() => []), cortesB = await B.evaluate(() => window.mkwEstado.cortes || []).catch(() => []);
  ok('las dos páginas cerraron el aviso y volvieron solas a la sala (otra votación)', !!vio.A.volvio && !!vio.B.volvio && cortesA[0]?.volvio && cortesB[0]?.volvio,
     `A ${vio.A.volvio ?? '-'} s, B ${vio.B.volvio ?? '-'} s; cortes A ${JSON.stringify(cortesA)} B ${JSON.stringify(cortesB)}`);
  ok('corrieron otra carrera juntas después del corte', !!vio.A.carrera2 && !!vio.B.carrera2, `A ${vio.A.carrera2 ?? '-'} s, B ${vio.B.carrera2 ?? '-'} s`);
}
writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
// el registro de la red de cada uno (WFC, malla, pila): para entender un corte
for (const [n, p] of [['A', A], ['B', B]]) writeFileSync(path.join(carpeta, `red-${n}.txt`), await p.evaluate(() => window.mkwRed.registro.join('\n')).catch(() => ''));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (registro en ${path.relative(raiz, carpeta)}/registro.txt)`);
process.exit(mal ? 1 : 0);
