// Prueba de la carrera sincronizada de la sala con CPU (lockstep) con el juego de verdad — bitácora §61.
//
// Resumen: abre la página del juego dos veces, como dos computadores de la misma sala (cada uno con su malla WebRTC;
// el buzón para presentarse es el falso del banco, BroadcastChannel). Las dos corren la misma carrera offline: 12
// karts = los 2 humanos (puesto 0 = A, puesto 1 = B) + 10 CPU, con la misma semilla. Cada uno maneja con SU teclado
// (Playwright aprieta teclas en cada pestaña: A acelera derecho, B acelera y dobla). Se comprueba:
//   - las dos llegan solas a la carrera (sección 0x20, VS) y la carrera avanza;
//   - la cámara de cada una sigue a su kart (A el puesto 0, B el puesto 1), con la tabla de pantallas igual en las dos;
//   - a los karts de los humanos el juego no los trata como CPU (sin la marca de CPU);
//   - las "huellas" (el avance de los 12 karts cada 120 cuadros) son iguales en las dos: la misma carrera;
//   - los karts de A y de B se mueven con lo que toca cada uno (A avanza; B también, por otro camino);
//   - cuánto esperó cada una por los botones de la otra (el costo de sincronizar).
// Fotos en build/web/datos/sincro/.
//
// Uso:  node web/navegador/prueba-sincro.mjs [--ventana] [--lento] [--sala] [--extra=&param=valor] [--puerto=8147] [--datos=build/web/datos/sincro]
//       (--sala: cada juego dentro de la sala del sitio falsa, con la dirección que arma el sitio)
//       (--lento: B con la CPU 2 veces más lenta; --extra: parámetros de más para las dos pestañas)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
// --puerto=N y --datos=carpeta: para correrla varias veces o junto a otra (herramientas/correr-todo.mjs --repetir)
const PUERTO = Number((process.argv.find(a => a.startsWith('--puerto=')) || '--puerto=8147').slice(9));
const COPA = process.argv.includes('--copa');
const PISTAS = (process.argv.find(a => a.startsWith('--pistas=')) || '--pistas=0.0,0.1,0.2,0.3').slice(9);   // sin --sala
const SEMILLA = (process.argv.find(a => a.startsWith('--semilla=')) || '--semilla=777').slice(10);   // sin --sala   // --copa: la copa entera con los karts manejados por la CPU (carreras 1 y 2)
const EXTRA = (process.argv.find(a => a.startsWith('--extra=')) || '').slice(8) + (COPA ? '&autoconducir=1' : '');   // p. ej. --extra=&arreglos=0
const carpeta = path.join(raiz, (process.argv.find(a => a.startsWith('--datos=')) || '--datos=build/web/datos/sincro').slice(8));
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
const sala = 'sincro-' + Date.now().toString(36);
const uidA = 'a' + sala, uidB = 'b' + sala;
const registro = [];
// --sala: cada juego dentro de la "sala del sitio" falsa (banco/pruebas/sala-mkw/padre.html), que arma la dirección como
// srcMkw con est.sincro (semilla y pistas de la tanda) y presta el buzón por postMessage, como el sitio
const SALA = process.argv.includes('--sala');
const paginas = {};
async function abrir(nombre, uid) {
  const p = await contexto.newPage();
  paginas[nombre] = p;
  p.on('pageerror', e => { console.log(`[${nombre}] [pageerror] ${e.message}`); registro.push(`[${nombre}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${nombre}] ${m.text().slice(0, 300)}`));
  if (nombre === 'B' && process.argv.includes('--lento')) { const c = await contexto.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 2 }); }
  if (SALA) {
    await p.goto(`http://127.0.0.1:${PUERTO}/banco/pruebas/sala-mkw/padre.html?sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}&ronda=1&relleno=normal${EXTRA ? '&extra=' + encodeURIComponent(EXTRA.replace(/^&/, '')) : ''}`);
    for (let i = 0; i < 100; i++) { const f = p.frames().find(x => x.url().includes('/index.html?')); if (f) return f; await espera(200); }
    throw new Error('no apareció el marco del juego');
  }
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}` +
    `&modo=copa&pistas=${PISTAS}&semilla=${SEMILLA}&cpu=normal${EXTRA}`);
  return p;
}
const t0 = Date.now();
const A = await abrir('A', uidA);
await espera(4000);                                    // B llega un poco después (cargan a distinto ritmo)
const B = await abrir('B', uidB);

// (con tope de 10 s: si el hilo de la página quedó tomado, evaluate no vuelve nunca y la prueba no llegaba a su tope)
const leer = p => Promise.race([new Promise(r => setTimeout(() => r({ colgada: true }), 10000)), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ls = window.mkwSincro?.lockstep?.estado();
  const rd = L.u32(0x809BD728), esc = rd + 0x20, ri = L.u32(0x809BD730);
  const f = x => new DataView(new Uint32Array([x]).buffer).getFloat32(0, true);
  let av = [], marcas = [];
  try { const lista = L.u32(ri + 0xC); for (let i = 0; i < 12; i++) av.push(f(L.u32(L.u32(lista + 4 * i) + 0xC))); } catch {}
  try { const kom = L.u32(0x809C18F8), arr = L.u32(kom + 0x20); for (let i = 0; i < 2; i++) marcas.push(L.u32(L.u32(L.u32(L.u32(arr + 4 * i)) + 4) + 0x14)); } catch {}
  let camara = -1; try { camara = L.u8(L.u32(L.u32(L.u32(0x809C19B8) + 0x18)) + 0x9C); } catch {}
  // etapa de la carrera (Raceinfo +0x28): 0-1 presentación y cuenta regresiva, 2 corriendo, ≥ 4 terminó
  return { s: e.seccion, ls, pantalla: L.u8(esc + 0xB64), camara, av, marcas, etapa: ri ? L.u32(ri + 0x28) : -1,
    avisos: window.mkwAvisosLento || [] };
})]).catch(() => null);

// 1) las dos llegan a la carrera
let enCarrera = { A: 0, B: 0 };
for (const limite = Date.now() + 5 * 60000; Date.now() < limite && !(enCarrera.A && enCarrera.B);) {
  for (const [n, p] of [['A', A], ['B', B]]) { const x = await leer(p); if (x?.s === 0x20 && !enCarrera[n]) { enCarrera[n] = Date.now(); console.log(`  ${n}: en la carrera a los ${((Date.now() - t0) / 1000).toFixed(0)} s`); } }
  await espera(1000);
}
ok('las dos llegaron solas a la carrera (VS, sección 0x20)', !!(enCarrera.A && enCarrera.B));

if (COPA) {
  // la copa: las carreras terminan solas (todos los karts con la CPU); entre carrera y carrera cada consola pasa los
  // menús por su cuenta. Se espera a que las dos vayan 900 cuadros en la carrera 2 y se comparan las huellas
  // (en la carrera sincronizada el juego dibuja todos los cuadros, §62: con dos Chrome en el mismo PC cada uno va
  // a ~15-25 cuadros por segundo y una carrera de 3 vueltas tarda ~10 min; --minutos=N cambia el tope, 25 por omisión)
  const fin = Date.now() + Number((process.argv.find(a => a.startsWith('--minutos=')) || '=25').split('=')[1]) * 60000;
  let x = {}, ultimo = '';
  while (Date.now() < fin) {
    x = { A: await leer(A), B: await leer(B) };
    const t = ['A', 'B'].map(n => `${n} carrera ${x[n]?.ls?.carrera ?? '-'} cuadro ${x[n]?.ls?.cuadro ?? '-'} huellas ${x[n]?.ls?.huellasIguales ?? '-'}`).join(' · ');
    for (const n of ['A', 'B']) if (x[n]?.colgada) console.log(`  ${n}: la página no responde (hilo principal tomado)`);
    if (t.replace(/cuadro \d+/g, '') !== ultimo) { ultimo = t.replace(/cuadro \d+/g, ''); console.log('  ' + t); }
    if (['A', 'B'].every(n => (x[n]?.ls?.carrera || 0) >= 2 && (x[n]?.ls?.cuadro || 0) > 900)) break;
    if (x.A?.ls?.desincronizado || x.B?.ls?.desincronizado) break;
    await espera(3000);
  }
  ok('las dos pasaron solas a la carrera 2 de la copa', (x.A?.ls?.carrera || 0) >= 2 && (x.B?.ls?.carrera || 0) >= 2, `A ${x.A?.ls?.carrera}, B ${x.B?.ls?.carrera}`);
  ok('la carrera 2 avanza en las dos', (x.A?.ls?.cuadro || 0) > 900 && (x.B?.ls?.cuadro || 0) > 900, `A ${x.A?.ls?.cuadro}, B ${x.B?.ls?.cuadro}`);
  ok('las huellas coinciden en toda la copa (nunca se separaron)', !x.A?.ls?.desincronizado && !x.B?.ls?.desincronizado && (x.A?.ls?.huellasIguales || 0) >= 20,
    `iguales A ${x.A?.ls?.huellasIguales}, B ${x.B?.ls?.huellasIguales}${x.A?.ls?.desincronizado ? ' · DESINCRONIZADO ' + JSON.stringify(x.A.ls.desincronizado) : ''}`);
  await A.locator('#canvas').screenshot({ path: path.join(carpeta, 'A-copa.png') }).catch(() => {});
  await B.locator('#canvas').screenshot({ path: path.join(carpeta, 'B-copa.png') }).catch(() => {});
  writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
  await navegador.close(); servidor.kill();
  console.log(`\n${bien} bien, ${mal} mal  (registro en ${path.relative(raiz, carpeta).replaceAll("\\", "/")}/)`);
  process.exit(mal ? 1 : 0);
}

// 2) manejar: A acelera derecho; B acelera y dobla a la izquierda un rato (teclas reales en cada pestaña)
// (las teclas van a la página: en --sala, a la de la sala, que tiene el marco del juego con el foco)
const tecladoA = paginas.A.keyboard, tecladoB = paginas.B.keyboard;
if (SALA) for (const n of ['A', 'B']) await paginas[n].locator('iframe').focus().catch(() => {});
// acelerar recién con la carrera andando: apretado durante la cuenta regresiva, el kart patina en la largada (un
// "burnout" del juego) y lo que avanza depende de en qué instante se apretó (A salía con 1,04 a 1,13 vueltas)
for (const hasta = Date.now() + 60000; Date.now() < hasta;) {
  const [ea, eb] = [await leer(A), await leer(B)];
  if ((ea?.etapa ?? 0) >= 2 && (eb?.etapa ?? 0) >= 2) break;
  await espera(250);
}
await tecladoA.down('KeyK'); await tecladoB.down('KeyK');
await espera(9000);
await tecladoB.down('KeyA'); await espera(1500); await tecladoB.up('KeyA');
await espera(20000);
const xa = await leer(A), xb = await leer(B);
await A.locator('#canvas').screenshot({ path: path.join(carpeta, 'A.png') }).catch(() => {});
await B.locator('#canvas').screenshot({ path: path.join(carpeta, 'B.png') }).catch(() => {});
await tecladoA.up('KeyK'); await tecladoB.up('KeyK');

ok('la carrera sincronizada avanza en las dos', (xa?.ls?.cuadro || 0) > 900 && (xb?.ls?.cuadro || 0) > 900, `A cuadro ${xa?.ls?.cuadro}, B cuadro ${xb?.ls?.cuadro}`);
ok('la cámara de A sigue a su kart (puesto 0) y la de B al suyo (puesto 1)', xa?.camara === 0 && xb?.camara === 1, `A ${xa?.camara}, B ${xb?.camara}`);
ok('la tabla de pantallas de Racedata es la misma en las dos (la mira la lógica)', xa?.pantalla === xb?.pantalla, `A ${xa?.pantalla}, B ${xb?.pantalla}`);
ok('los karts de los humanos no llevan la marca de CPU', (xa?.marcas || []).length === 2 && xa.marcas.every(m => !(m & 1)), (xa?.marcas || []).map(m => m.toString(16)).join(', '));
ok('las huellas de la carrera coinciden (la misma carrera en las dos)', (xa?.ls?.huellasIguales || 0) >= 3 && !xa?.ls?.desincronizado && !xb?.ls?.desincronizado,
  `iguales A ${xa?.ls?.huellasIguales}, B ${xb?.ls?.huellasIguales}${xa?.ls?.desincronizado ? ' · DESINCRONIZADO ' + JSON.stringify(xa.ls.desincronizado) : ''}`);
const largo = (x, i) => (x?.av?.[i] ?? 0).toFixed(3);
// (A solo acelera derecho: en la primera curva se sale de la pista; basta con que haya avanzado desde la largada)
ok('el kart de A avanzó con lo que tocó A', (xa?.av?.[0] || 0) > 1.05, `puesto 0: ${largo(xa, 0)} vueltas`);
ok('el kart de B avanzó con lo que tocó B (y no igual que el de A)', (xa?.av?.[1] || 0) > 1.1 && Math.abs((xa?.av?.[1] || 0) - (xa?.av?.[0] || 0)) > 1e-3,
  `puesto 1: ${largo(xa, 1)} vueltas`);
const msPorCuadro = x => x?.ls ? (x.ls.msEsperando / Math.max(1, x.ls.cuadros)).toFixed(2) : '-';
const esperas = `A ${msPorCuadro(xa)} ms (máx ${xa?.ls?.maxEspera?.toFixed(0)}), B ${msPorCuadro(xb)} ms (máx ${xb?.ls?.maxEspera?.toFixed(0)}); esperando que el otro llegara a la carrera: A ${((xa?.ls?.msLlegada || 0) / 1000).toFixed(1)} s, B ${((xb?.ls?.msLlegada || 0) / 1000).toFixed(1)} s`;
const avisos = x => [...new Set(x?.avisos || [])].slice(-2).join(' / ') || 'ninguno';
if (!process.argv.includes('--lento')) {
  ok('sincronizar cuesta poco (espera promedio por cuadro < 4 ms)', Number(msPorCuadro(xa)) < 4 && Number(msPorCuadro(xb)) < 4, esperas);
  ok('sin avisos de sala lenta', !(xa?.avisos?.length) && !(xb?.avisos?.length), `A: ${avisos(xa)} · B: ${avisos(xb)}`);
} else {
  // B con la CPU frenada (§70, C5): toda la sala va a su ritmo (A espera a B en cada cuadro) y las dos lo avisan:
  // A, "espera al jugador 2"; B, "tu PC no alcanza"
  ok('con B lenta, A la espera (la sala va al ritmo de la más lenta), sin esperas en B', Number(msPorCuadro(xa)) > 4 && Number(msPorCuadro(xb)) < 1, esperas);
  ok('y lo avisan: A "espera al jugador 2", B "Tu PC no alcanza"', (xa?.avisos || []).some(t => t.includes('jugador 2')) && (xb?.avisos || []).some(t => t.startsWith('Tu PC')),
    `A: ${avisos(xa)} · B: ${avisos(xb)}`);
}
// el retraso de la carrera (§70): lo anuncia el decisor según la red; tiene que ser el MISMO en las dos consolas
const retrasoDe = x => x?.ls?.retrasos?.[x?.ls?.carrera] ?? x?.ls?.retraso;
ok('las dos usaron el mismo retraso en la carrera (se adapta a la red)', retrasoDe(xa) !== undefined && retrasoDe(xa) === retrasoDe(xb),
  `A ${retrasoDe(xa)}, B ${retrasoDe(xb)} cuadros; ida y vuelta medida A ${JSON.stringify(xa?.ls?.rtt)} B ${JSON.stringify(xb?.ls?.rtt)} ms` +
  (EXTRA.includes('redMala') ? ` (red mala de mentira: ${EXTRA.match(/redMala=([\d.,]+)/)?.[1]})` : ''));

writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
for (const [n, p] of [['A', A], ['B', B]]) writeFileSync(path.join(carpeta, `red-${n}.txt`), await p.evaluate(() => window.mkwRed?.registro.join('\n')).catch(() => ''));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (registro en ${path.relative(raiz, carpeta).replaceAll("\\", "/")}/)`);
process.exit(mal ? 1 : 0);
