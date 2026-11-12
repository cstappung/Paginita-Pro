// Los contadores del motor por cuadro, en la carrera (V4 del plan de rendimiento, bitácora §152).
//
// Resumen: el programa aparte build/web-contadores (compilado con MKW_CFLAGS_EXTRA=-DMKW_CONTADORES) cuenta dentro del
// motor cada lectura y escritura de la memoria de la Wii (y cuántas caen al camino lento), los accesos «resueltos» y
// «planos», las multiplicaciones-sumas exactas (FMA), las llamadas indirectas, los cambios de fibra y las esperas JSPI.
// La página (?contadores=1, mkw.mjs) los divide por los cuadros de cada segundo. Esta herramienta:
//   - un jugador: sirve ese programa, abre una carrera directa (11 CPU de nivel máximo, la misma pista y semilla), la
//     corre --segundos y da la mediana por cuadro de cada contador en la carrera;
//   - --registro <archivo>: resume las líneas «[contadores]» de un registro ya hecho (p. ej. el de prueba-sincro.mjs
//     --directa con MKW_BUILD=build/web-contadores/navegador --extra=&contadores=1: la sala).
// Chrome sin ventana y sin sonido. Salida: build/web/datos/contadores/<etiqueta>.json
//
// Uso:  node herramientas/medir-contadores.mjs [--pista 13.2] [--segundos 40] [--puerto 8178] [--etiqueta un-jugador]
//       node herramientas/medir-contadores.mjs --registro build/web/datos/sincro-contadores/registro.txt --etiqueta sala
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PISTA = opcion('--pista', '13.2'), SEGUNDOS = Number(opcion('--segundos', 40)), PUERTO = Number(opcion('--puerto', 8178));
const ETIQUETA = opcion('--etiqueta', opcion('--registro') ? 'registro' : 'un-jugador');
const BUILD = process.env.MKW_BUILD || 'build/web-contadores/navegador';
const carpeta = path.join(raiz, 'build/web/datos/contadores');
mkdirSync(carpeta, { recursive: true });
const NOMBRES = ['lee', 'leeLenta', 'escribe', 'escribeLenta', 'resuelta', 'resueltaCae', 'flat', 'fma', 'indirecta', 'fibra', 'esperaJspi'];
const mediana = xs => { const o = [...xs].sort((a, b) => a - b); return o.length ? o[o.length >> 1] : null; };

// la mediana de cada contador sobre las filas de la carrera
function resumir(filas, origen) {
  const carrera = filas.filter(f => f.carrera && f.cuadros >= 30);
  const m = Object.fromEntries(NOMBRES.map(k => [k, mediana(carrera.map(f => f[k]))]));
  const r = { etiqueta: ETIQUETA, origen, segundos: carrera.length, porCuadro: m, filas };
  writeFileSync(path.join(carpeta, `${ETIQUETA}.json`), JSON.stringify(r, null, 1));
  console.log(`${ETIQUETA} (${origen}): ${carrera.length} s de carrera; mediana por cuadro:`);
  for (const k of NOMBRES) console.log(`  ${k.padEnd(13)} ${String(m[k]).padStart(9)}`);
  if (m.lee !== null) console.log(`  → accesos a la memoria de la Wii por cuadro: ${m.lee + m.escribe} (lentos ${m.leeLenta + m.escribeLenta}; los planos y resueltos ya están adentro); FMA ${m.fma}; indirectas ${m.indirecta}; fibras ${m.fibra}`);
  console.log(`→ ${path.relative(raiz, path.join(carpeta, ETIQUETA + '.json'))}`);
}

if (opcion('--registro')) {
  // las líneas «[contadores] por cuadro (N cuadros, carrera): lee X · leeLenta Y · …» de un registro (de cada pestaña)
  const filas = [];
  for (const l of readFileSync(path.resolve(raiz, opcion('--registro')), 'utf8').split('\n')) {
    const x = /\[contadores\] por cuadro \((\d+) cuadros(, carrera)?\): (.*)$/.exec(l);
    if (!x) continue;
    const f = { cuadros: +x[1], carrera: !!x[2] };
    for (const par of x[3].split(' · ')) { const [k, v] = par.trim().split(' '); f[k] = +v; }
    filas.push(f);
  }
  resumir(filas, opcion('--registro'));
} else {
  const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
  const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_BUILD: BUILD } });
  await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
  const navegador = await chromium.launch({ ...opcionesNavegador(), headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
  try {
    const p = await navegador.newPage({ viewport: { width: 960, height: 540 } });
    await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTA}&cc=c150&cpu=maximo&semilla=11&pj=0&kart=1&contadores=1`);
    const t0 = Date.now();
    let hay = false;
    while (Date.now() - t0 < 240000 && !(hay = await p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => false))) await new Promise(r => setTimeout(r, 500));
    if (!hay) throw new Error('la carrera no arrancó en 4 min');
    if (!(await p.evaluate(() => !!window.mkwEstado.contadores))) throw new Error(`este programa no tiene contadores (${BUILD}): compilarlo con MKW_CFLAGS_EXTRA=-DMKW_CONTADORES`);
    await p.click('#canvas', { force: true }).catch(() => {});
    await p.keyboard.down('KeyK');                                  // acelerar (A) toda la carrera medida
    await new Promise(r => setTimeout(r, SEGUNDOS * 1000));
    await p.keyboard.up('KeyK');
    resumir(await p.evaluate(() => window.mkwEstado.contadores.historia), `${BUILD} · pista ${PISTA} · un jugador + 11 CPU`);
  } finally {
    await navegador.close().catch(() => {});
    servidor.kill();
  }
}
