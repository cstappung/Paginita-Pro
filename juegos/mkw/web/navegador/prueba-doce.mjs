// Prueba con el juego de verdad: más de 4 humanos en la carrera sincronizada de la sala (PLAN C9, bitácora §91).
//
// Resumen: abre la página del juego N veces (por omisión 6; --n 12 = la sala llena), como N computadores de la misma
// sala (cada uno con su malla WebRTC; el buzón para presentarse es el falso del banco, BroadcastChannel). Todas corren
// la misma carrera offline directo (modo=directa): los N humanos en los puestos 0..N-1 y la CPU en el resto. Cada una
// maneja con SU teclado y con otras teclas (todas aceleran; las pares doblan a la izquierda un rato, las impares a la
// derecha, cada una en otro momento). Se comprueba:
//   - todas llegan solas a la carrera (sección 0x20) y la carrera avanza en todas;
//   - los N humanos son jugadores de verdad (tipo 0) en todas las consolas;
//   - los mandos 0-3 usan su puerto (canal = su mando) y del 5.º humano en adelante no hay puerto: canal -1 y su kart
//     lee el portador VIRTUAL de su puesto (RaceinfoPlayer +0x48 = Input::Manager +0x3B4 + puesto·0x180), alimentado en
//     cada cuadro (mandos_virtuales_nativo.cpp);
//   - la cámara de cada consola sigue a su kart;
//   - las huellas (el avance de los 12 karts cada 120 cuadros, y los botones) son iguales en todas: la misma carrera;
//   - el kart de cada humano se mueve con lo que toca (todos salieron de la parrilla; no todos igual);
//   - todos cruzan la meta por código en el mismo cuadro y el juego pasa a los resultados (etapa 4) en todas;
//   - ninguna página se cayó (pageerror).
// Con N pestañas en una PC cada juego va más lento (la carrera sincronizada va al ritmo del más lento): la prueba
// mira cuadros de la carrera, no segundos.
//
// Uso:  node web/navegador/prueba-doce.mjs [--n 6] [--ventana] [--puerto 8164] [--pista 13.2] [--extra "&x=y"]
//       (MKW_BUILD = otro build, como siempre)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const N = Math.max(2, Math.min(12, Number(opcion('--n', 6))));
const PUERTO = Number(opcion('--puerto', 8164));
const PISTA = opcion('--pista', '13.2');
const EXTRA = opcion('--extra', '');
const CUADROS = Number(opcion('--cuadros', 900));           // cuántos cuadros de carrera esperar antes de mirar
const carpeta = path.join(raiz, 'build/web/datos/doce');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const contexto = await navegador.newContext({ viewport: { width: 640, height: 360 } });
const sala = 'doce-' + Date.now().toString(36);
const uids = Array.from({ length: N }, (_, i) => `j${i}${sala}`);
const registro = [], caidas = [];
const t0 = Date.now();
const paginas = [];
for (let i = 0; i < N; i++) {
  const p = await contexto.newPage();
  p.on('pageerror', e => { caidas.push(`[${i}] ${e.message}`); registro.push(`[${i}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${i}] ${m.text().slice(0, 300)}`));
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uids[i]}&sincro=${uids.join(',')}` +
    `&modo=directa&pista=${PISTA}&semilla=4242&cpu=normal${EXTRA}`);
  paginas.push(p);
  await espera(1500);                                       // que no carguen todas en el mismo instante
}

// (con tope de 10 s: si el hilo de una página quedó tomado, evaluate no vuelve)
const leer = p => Promise.race([new Promise(r => setTimeout(() => r({ colgada: true }), 10000)), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(), M = window.mkw; if (!e) return null;
  const ls = window.mkwSincro?.lockstep?.estado();
  const rd = L.u32(0x809BD728), esc = rd + 0x20, ri = L.u32(0x809BD730);
  const f = x => new DataView(new Uint32Array([x]).buffer).getFloat32(0, true);
  const av = [], portadores = [], virtuales = [];
  try {
    const lista = L.u32(ri + 0xC);
    for (let i = 0; i < 12; i++) { const rp = L.u32(lista + 4 * i); av.push(f(L.u32(rp + 0xC))); portadores.push(L.u32(rp + 0x48) >>> 0); }
  } catch {}
  for (let i = 0; i < 12; i++) virtuales.push(M?._mkw_virtual_portador ? M._mkw_virtual_portador(i) >>> 0 : 0);
  let camara = -1; try { camara = L.u8(L.u32(L.u32(L.u32(0x809C19B8) + 0x18)) + 0x9C); } catch {}
  return { s: e.seccion, ls, etapa: ri ? L.u32(ri + 0x28) : -1, av, portadores, virtuales, camara,
    tipos: Array.from({ length: 12 }, (_, i) => L.u32(esc + 8 + i * 0xF0 + 0x10)),
    canales: Array.from({ length: 12 }, (_, i) => L.u8(esc + 8 + i * 0xF0 + 6)),
    alimentados: M?._mkw_virtuales_cuadros ? M._mkw_virtuales_cuadros() : -1, miPuesto: window.mkwMiPuesto };
})]).catch(() => null);

// 1) todas llegan a la carrera
const llego = Array(N).fill(0);
for (const limite = Date.now() + 8 * 60000; Date.now() < limite && llego.some(x => !x);) {
  for (let i = 0; i < N; i++) if (!llego[i]) { const x = await leer(paginas[i]); if (x?.s === 0x20) { llego[i] = Date.now(); console.log(`  ${i}: en la carrera a los ${((Date.now() - t0) / 1000).toFixed(0)} s`); } }
  await espera(1000);
}
ok(`las ${N} llegaron solas a la carrera (VS, sección 0x20)`, llego.every(Boolean), `${llego.filter(Boolean).length} de ${N}`);

// 2) cada una maneja con su teclado: todas aceleran; doblan cada una a su lado y en su momento
await Promise.all(paginas.map(p => p.keyboard.down('KeyK').catch(() => {})));
const doblar = paginas.map((p, i) => (async () => {
  await espera(3000 + 700 * i);
  const tecla = i % 2 ? 'KeyD' : 'KeyA';
  await p.keyboard.down(tecla).catch(() => {}); await espera(400 + 150 * i); await p.keyboard.up(tecla).catch(() => {});
})());
// esperar a que todas lleven CUADROS cuadros de carrera
let x = [];
for (const limite = Date.now() + 10 * 60000; Date.now() < limite;) {
  x = await Promise.all(paginas.map(leer));
  const cuadros = x.map(y => y?.ls?.cuadro ?? -1);
  if (cuadros.every(c => c >= CUADROS) || x.some(y => y?.ls?.desincronizado)) break;
  console.log(`  cuadros: ${cuadros.join(' ')}`);
  await espera(5000);
}
await doblar;
x = await Promise.all(paginas.map(leer));
await Promise.all(paginas.map((p, i) => p.locator('#canvas').screenshot({ path: path.join(carpeta, `${i}.png`) }).catch(() => {})));
const cuadros = x.map(y => y?.ls?.cuadro ?? -1);
ok(`la carrera sincronizada avanza en las ${N}`, cuadros.every(c => c >= CUADROS), cuadros.join(' '));

const humanos = Array.from({ length: N }, (_, i) => i);
ok(`los ${N} humanos son jugadores de verdad (tipo 0) en todas las consolas, el resto CPU`,
   x.every(y => y && humanos.every(i => y.tipos[i] === 0) && y.tipos.slice(N).every(t => t === 1)),
   x.map((y, k) => `${k}: ${y?.tipos?.join('')}`).join(' · '));
const conPuerto = humanos.filter(i => i < 4), sinPuerto = humanos.filter(i => i >= 4);
ok('los 4 primeros usan su puerto (canal = su mando, portador real)',
   x.every(y => y && conPuerto.every(i => y.canales[i] === i && y.portadores[i] !== y.virtuales[i])),
   x.map((y, k) => `${k}: ${y?.canales?.slice(0, N).join(',')}`).join(' · '));
if (sinPuerto.length)
  ok(`del 5.º en adelante (${sinPuerto.length}) sin puerto: canal -1 y su kart lee el portador virtual de su puesto, alimentado`,
     x.every(y => y && sinPuerto.every(i => y.canales[i] === 255 && y.portadores[i] === y.virtuales[i]) && y.alimentados > 0),
     x.map((y, k) => `${k}: canales ${y?.canales?.slice(4, N).join(',')} portador=virtual ${sinPuerto.map(i => y?.portadores?.[i] === y?.virtuales?.[i] ? 1 : 0).join('')} cuadros ${y?.alimentados}`).join(' · '));
ok('la cámara de cada consola sigue a su kart', x.every((y, i) => y?.camara === i), x.map(y => y?.camara).join(' '));
const iguales = x.map(y => y?.ls?.huellasIguales || 0), desinc = x.map(y => y?.ls?.desincronizado).filter(Boolean);
ok(`las huellas coinciden en las ${N} (la misma carrera)`, iguales.every(n => n >= 3) && !desinc.length,
   `iguales ${iguales.join(' ')}${desinc.length ? ' · DESINCRONIZADO ' + JSON.stringify(desinc[0]) : ''}`);
const av = x[0]?.av || [];
ok(`el kart de cada humano salió de la parrilla con lo que tocó (avance > 1)`, humanos.every(i => (av[i] || 0) > 1.0), humanos.map(i => (av[i] || 0).toFixed(3)).join(' '));
ok('…y no todos igual (cada uno con sus teclas)', new Set(humanos.map(i => (av[i] || 0).toFixed(4))).size >= Math.min(N, 3));

// 3) la meta: los N cruzan por código en el MISMO cuadro de la carrera (mkwTerminarEn: el juego llama EndLap hasta la
//    última vuelta) y el juego sigue con los resultados (partes del juego que guardan a los humanos de a 4, §91)
await Promise.all(paginas.map(p => p.keyboard.up('KeyK').catch(() => {})));
const meta = Math.max(...cuadros) + 90;
// (mkwTerminarEn existe en la sala; aquí, una carrera directa, lo mismo a mano: la bandera del juego en el mismo cuadro)
await Promise.all(paginas.map(p => p.evaluate(([c, q]) => { const ls = window.mkwSincro.lockstep, m = q.reduce((x, i) => x | (1 << i), 0);
  ls.enCuadro(ls.estado().carrera, c, () => window.mkw._mkw_sala_terminar(m)); return true; }, [meta, humanos]).catch(() => false)));
let fin = [];
for (const limite = Date.now() + 4 * 60000; Date.now() < limite;) {
  fin = await Promise.all(paginas.map(leer));
  if (fin.every(y => y && y.etapa >= 4)) break;
  await espera(3000);
}
await espera(8000);                                        // un rato de resultados
fin = await Promise.all(paginas.map(leer));
await Promise.all(paginas.map((p, i) => p.locator('#canvas').screenshot({ path: path.join(carpeta, `${i}-meta.png`) }).catch(() => {})));
ok(`los ${N} cruzaron la meta en el mismo cuadro y el juego pasó a los resultados (etapa 4) en todas`, fin.every(y => y && y.etapa >= 4),
   fin.map(y => y?.colgada ? 'colgada' : y?.etapa).join(' '));
ok('ninguna página se cayó', !caidas.length, caidas.slice(0, 3).join(' | '));

writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
await navegador.close(); servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (${((Date.now() - t0) / 60000).toFixed(1)} min; registro y fotos en ${path.relative(raiz, carpeta).replaceAll('\\', '/')}/)`);
process.exit(mal ? 1 : 0);
