// Prueba del modo en línea con el juego de verdad: dos "computadores" (dos pestañas con su propia malla WebRTC) se
// encuentran solos y llegan a la sala y a la carrera — bitácora §58 y §59.
//
// Resumen: abre la página del juego dos veces, como lo hará la sala del sitio:
//   A (anfitrión): ?red=malla&nodo=2&anfitrion=1&modo=enlinea → corre el WFC de la sala (10.77.0.1) y su juego (10.77.0.2)
//   B:             ?red=malla&nodo=3&modo=enlinea             → su juego (10.77.0.3), sin servidor
// El buzón para presentarse es el falso del banco (BroadcastChannel, senal=canal); los paquetes van por WebRTC de
// verdad. Nadie toca una tecla: el piloto (menus.mjs, enLinea) entra a «VS mundial» y B espera a tener ruta al WFC.
// Además A presenta un VR al WFC (como hará la página con el de Firebase) y se comprueba que el juego lo adopta.
// Se comprueba:
//   - la malla: B aprende que 10.77.0.1 y .2 están en A (y A que .3 está en B);
//   - el piloto de cada uno llega a «buscando rivales» (sección 0x55, página 0x8f);
//   - los dos llegan a la sala de la carrera (sección 0x58: votación) y después a la carrera en línea (0x68);
//   - los paquetes del juego cruzan la malla en los dos sentidos;
//   - el WFC le dio al juego de A el VR presentado (respuesta found:1 en el registro).
// Fotos en build/web/datos/enlinea/.
//
// Uso:  node web/navegador/prueba-enlinea.mjs [--ventana]     (MKW_BUILD=otro build; por omisión el de siempre, build/web/navegador: la red del juego ya va en él)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8146;
const carpeta = path.join(raiz, 'build/web/datos/enlinea');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  // las dos pestañas tienen que seguir corriendo aunque no estén al frente (como dos computadores)
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
const sala = 'prueba-' + Date.now().toString(36);
const registro = [];

// --sala: cada juego dentro de una "sala del sitio" falsa (banco/pruebas/sala-mkw/padre.html): el marco con la dirección
// que arma el sitio, el buzón prestado por postMessage (senal=padre) y el VR que la página le pasa desde la "nube".
const SALA = process.argv.includes('--sala');
const padres = {};
async function abrir(nombre, extra, vr) {
  const p = await contexto.newPage();
  p.on('pageerror', e => { console.log(`[${nombre}] [pageerror] ${e.message}`); registro.push(`[${nombre}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${nombre}] ${m.text().slice(0, 300)}`));
  const uid = nombre.toLowerCase() + sala;
  if (!SALA) { await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&modo=enlinea${extra}`); return p; }
  padres[nombre] = p;
  await p.goto(`http://127.0.0.1:${PUERTO}/banco/pruebas/sala-mkw/padre.html?sala=${sala}&uid=${uid}&vr=${vr}&br=5432${extra}`);
  // el juego vive en el marco: Playwright lo maneja igual que una página (evaluate, waitForFunction, locator)
  for (let i = 0; i < 100; i++) { const f = p.frames().find(x => x.url().includes('/index.html?')); if (f) return f; await espera(200); }
  throw new Error('no apareció el marco del juego');
}
const estado = p => p.evaluate(() => { const e = window.mkwMenus?.estado?.(); return e ? { s: e.seccion, ps: e.paginas } : null; }).catch(() => null);
const t0 = Date.now();
const A = await abrir('A', '&nodo=2&anfitrion=1', 6789);
await A.waitForFunction(() => window.mkwRed?.presentador, null, { timeout: 60000 });
// sin sala, el VR se presenta a mano (en la sala lo hace la página con el de la "nube", como el sitio)
if (!SALA) await A.evaluate(() => window.mkwRed.presentador.presentar({ vr: 6789, br: 5432 }));
await espera(Number(process.env.ESPERA_B ?? 15000));    // B entra un poco después (como alguien que llega a la sala; ESPERA_B=ms)
const B = await abrir('B', '&nodo=3', 7100);

// 1) la malla
const rutas = await B.waitForFunction(() => { const r = window.mkwRed?.router?.rutas(); return r && r['10.77.0.1'] ? r : null; }, null, { timeout: 60000, polling: 500 })
  .then(h => h.jsonValue(), () => null);
ok('malla: B sabe que el WFC (10.77.0.1) y el juego de A (10.77.0.2) están en A', !!rutas?.['10.77.0.1'] && !!rutas?.['10.77.0.2'], JSON.stringify(rutas));
// (A aprende la de B un momento después: B le anuncia sus IPs cuando su pila se une)
const rutasA = await A.waitForFunction(() => { const r = window.mkwRed.router.rutas(); return r['10.77.0.3'] ? r : null; }, null, { timeout: 30000, polling: 300 })
  .then(h => h.jsonValue(), () => A.evaluate(() => window.mkwRed.router.rutas()));
ok('malla: A sabe que 10.77.0.3 está en B', !!rutasA['10.77.0.3'], JSON.stringify(rutasA));

// 2) el piloto de cada uno hasta «buscando rivales», y 3) la sala y la carrera
const vio = { A: new Set(), B: new Set() }, cuando = {};
const limite = Date.now() + 6 * 60000;
while (Date.now() < limite) {
  for (const [n, p] of [['A', A], ['B', B]]) {
    const e = await estado(p); if (!e) continue;
    const tope = e.ps[e.ps.length - 1], marca = e.s === 0x55 && tope === 0x8f ? 'busca' : e.s === 0x58 ? 'sala' : e.s === 0x68 ? 'carrera' : '';
    if (marca && !vio[n].has(marca)) { vio[n].add(marca); cuando[n + marca] = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: ${marca} a los ${cuando[n + marca]} s`); }
  }
  if (vio.A.has('carrera') && vio.B.has('carrera')) break;
  await espera(1000);
}
ok('el piloto de A llegó solo a «buscando rivales»', vio.A.has('busca') || vio.A.has('sala'), cuando.Abusca ? `${cuando.Abusca} s` : '');
ok('el piloto de B llegó solo a «buscando rivales»', vio.B.has('busca') || vio.B.has('sala'), cuando.Bbusca ? `${cuando.Bbusca} s` : '');
ok('los dos llegaron a la sala de la carrera (votación)', vio.A.has('sala') && vio.B.has('sala'), `A ${cuando.Asala ?? '-'} s, B ${cuando.Bsala ?? '-'} s`);
ok('los dos están en la carrera en línea', vio.A.has('carrera') && vio.B.has('carrera'), `A ${cuando.Acarrera ?? '-'} s, B ${cuando.Bcarrera ?? '-'} s`);
await espera(8000);
await A.locator('#canvas').screenshot({ path: path.join(carpeta, 'A.png') }).catch(() => {});
await B.locator('#canvas').screenshot({ path: path.join(carpeta, 'B.png') }).catch(() => {});

// 4) los paquetes del juego cruzan la malla (cuentas de la pila: paquetes UDP con la otra consola)
const cuentasA = await A.evaluate(() => window.mkwRed.pila.cuentas()), cuentasB = await B.evaluate(() => window.mkwRed.pila.cuentas());
const deB = cuentasA['10.77.0.3'], deA = cuentasB['10.77.0.2'];
ok('paquetes del juego de B llegan al de A por la malla', (deB?.rec || 0) > 50, JSON.stringify(deB));
ok('paquetes del juego de A llegan al de B por la malla', (deA?.rec || 0) > 50, JSON.stringify(deA));

// 5) el VR presentado
const regA = await A.evaluate(() => window.mkwRed.registro.filter(t => t.includes('[wfc:vr]')));
ok('el WFC le dio al juego el VR presentado (6789)', regA.some(t => /pregunta el VR del perfil \d+: 6789/.test(t)), regA.slice(-3).join(' | '));
if (SALA) {
  ok('en la sala, el juego de B también recibió el VR de su cuenta (7100)', regA.some(t => /pregunta el VR del perfil \d+: 7100/.test(t)));
  const m = await padres.B.evaluate(() => window.salaFalsa.mensajes);
  ok('la presentación de B pasó por la página (el buzón prestado por postMessage)', m.entra > 0 && m.envia > 0 && m.recibe > 0, JSON.stringify(m));
}

writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
// el registro de la red de cada uno (WFC, malla, pila): para entender una falla
for (const [n, p] of [['A', A], ['B', B]]) writeFileSync(path.join(carpeta, `red-${n}.txt`), await p.evaluate(() => window.mkwRed.registro.join('\n')).catch(() => ''));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (registro en build/web/datos/enlinea/registro.txt)`);
process.exit(mal ? 1 : 0);
