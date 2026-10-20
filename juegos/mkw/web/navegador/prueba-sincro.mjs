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
//   - cuánto esperó cada una por los botones de la otra (el costo de sincronizar);
//   - que los avisos de sala lenta digan la verdad, comparados con el medidor de cada pestaña (§85).
// Fotos en build/web/datos/sincro/.
//
// Uso:  node web/navegador/prueba-sincro.mjs [--ventana] [--lento] [--sala] [--extra=&param=valor] [--puerto=8147] [--datos=build/web/datos/sincro]
//       (--sala: cada juego dentro de la sala del sitio falsa, con la dirección que arma el sitio)
//       (--lento: B con la CPU 2 veces más lenta; --extra: parámetros de más para las dos pestañas)
//       (§93, C4 --traba-largada=6000: A se traba entera 6 s en el cuadro 20 de la carrera, como la primera visita
//        armando gráficos; B la espera con el margen de la largada y nadie se corta)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pantallaPartida } from './foto-pantalla.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
// --puerto=N y --datos=carpeta: para correrla varias veces o junto a otra (herramientas/correr-todo.mjs --repetir)
const PUERTO = Number((process.argv.find(a => a.startsWith('--puerto=')) || '--puerto=8147').slice(9));
const COPA = process.argv.includes('--copa');
// §73 --directa: la carrera abre directo por código (sin menús ni piloto), con los humanos como jugadores de verdad
// (tipo 0) en las dos consolas y cada una con SU pantalla (la del kart propio)
const DIRECTA = process.argv.includes('--directa');
const PISTAS = (process.argv.find(a => a.startsWith('--pistas=')) || '--pistas=0.0,0.1,0.2,0.3').slice(9);   // sin --sala
const SEMILLA = (process.argv.find(a => a.startsWith('--semilla=')) || '--semilla=777').slice(10);   // sin --sala   // --copa: la copa entera con los karts manejados por la CPU (carreras 1 y 2)
const RASTRO = process.argv.includes('--rastro');   // §70: el rastro por cuadro de las dos pestañas, comparado
const TRABA = Number((process.argv.find(a => a.startsWith('--traba-largada=')) || '=0').split('=')[1]);   // §93
const EXTRA = (process.argv.find(a => a.startsWith('--extra=')) || '').slice(8) + (COPA ? '&autoconducir=1' : '') + (RASTRO ? '&rastro=1' : '');   // p. ej. --extra=&arreglos=0
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
  p.on('response', r => { if (r.status() >= 400) registro.push(`[${nombre}] [http ${r.status()}] ${r.url().slice(0, 200)}`); });
  if (nombre === 'B' && process.argv.includes('--lento')) { const c = await contexto.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 2 }); }
  if (SALA) {
    await p.goto(`http://127.0.0.1:${PUERTO}/banco/pruebas/sala-mkw/padre.html?sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}&ronda=1&relleno=normal${EXTRA ? '&extra=' + encodeURIComponent(EXTRA.replace(/^&/, '')) : ''}`);
    for (let i = 0; i < 100; i++) { const f = p.frames().find(x => x.url().includes('/index.html?')); if (f) return f; await espera(200); }
    throw new Error('no apareció el marco del juego');
  }
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}` +
    (DIRECTA ? `&modo=directa&pista=${PISTAS.split(',')[0]}` : `&modo=copa&pistas=${PISTAS}`) + `&semilla=${SEMILLA}&cpu=normal${EXTRA}`);
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
  return { s: e.seccion, ls, pantalla: L.u8(esc + 0xB64), cuentas: [4, 5, 6].map(k => L.u8(esc + k)).concat([4, 5, 6].map(k => L.u8(rd + 0xC10 + k))), huds: [0, 1, 2, 3].map(k => L.u8(esc + 0xB64 + k)), ranuras: [0, 1].map(i => L.u8(esc + 8 + i * 0xF0 + 5)), camara, av, marcas, etapa: ri ? L.u32(ri + 0x28) : -1,
    tipos: [0, 1, 2].map(i => L.u32(esc + 8 + i * 0xF0 + 0x10)),
    avisos: window.mkwAvisosLento || [] };
})]).catch(() => null);

// 1) las dos llegan a la carrera
let enCarrera = { A: 0, B: 0 };
for (const limite = Date.now() + 5 * 60000; Date.now() < limite && !(enCarrera.A && enCarrera.B);) {
  for (const [n, p] of [['A', A], ['B', B]]) { const x = await leer(p); if (x?.s === 0x20 && !enCarrera[n]) { enCarrera[n] = Date.now(); console.log(`  ${n}: en la carrera a los ${((Date.now() - t0) / 1000).toFixed(0)} s`); } }
  await espera(1000);
}
ok('las dos llegaron solas a la carrera (VS, sección 0x20)', !!(enCarrera.A && enCarrera.B));

// §93 (C4): A se traba entera (el hilo de la página tomado, como cuando la primera visita arma los gráficos de la pista)
// apenas pasa el cuadro 20 de la carrera. Con el margen de la sala (2 s) B la cortaba; con el de la largada (15 s), B la
// espera, lo avisa («su navegador todavía arma la pista») y siguen las dos
let trabada = null;
if (TRABA) {
  const cuadroDe = p => p.evaluate(() => window.mkwSincro?.lockstep?.estado().cuadro ?? -1).catch(() => -1);
  for (const hasta = Date.now() + 60000; Date.now() < hasta && (await cuadroDe(A)) < 20;) await espera(30);
  const c0 = await cuadroDe(A);
  await A.evaluate(ms => { const t = performance.now(); while (performance.now() - t < ms); }, TRABA).catch(() => {});
  // (cómo ve cada una la conexión con la otra en los segundos que siguen: el estado de WebRTC y sus dos canales)
  const visto = { A: '', B: '' };
  for (const fin = Date.now() + 3000; Date.now() < fin;) {
    for (const [n, p, otro] of [['A', A, uidB], ['B', B, uidA]]) {
      const d = await p.evaluate(u => { const m = window.mkwRed?.malla, x = m?.detalle(u); return x ? `${x.pc}/${x.ice} udp ${x.udp} tcp ${x.tcp}` : 'sin par'; }, otro).catch(() => '?');
      if (d !== visto[n]) { visto[n] = d; console.log(`  ${n} ve la conexión: ${d}`); }
    }
    await espera(150);
  }
  await espera(6000);
  const [la, lb] = await Promise.all([A, B].map(p => p.evaluate(() => ({ ls: window.mkwSincro.lockstep.estado(), avisos: window.mkwAvisosCorte || [] })).catch(() => null)));
  trabada = { c0, la, lb };
  ok(`§93: A trabada ${TRABA / 1000} s en el cuadro ${c0} de la carrera: nadie se corta y las dos siguen`,
    la && lb && !Object.keys(la.ls.cortes).length && !Object.keys(lb.ls.cortes).length && !la.ls.fuera && la.ls.cuadro > c0 + 60 && lb.ls.cuadro > c0 + 60,
    `cortes A ${JSON.stringify(la?.ls.cortes)} B ${JSON.stringify(lb?.ls.cortes)}; cuadro A ${la?.ls.cuadro}, B ${lb?.ls.cuadro}; espera máx de B ${lb?.ls.maxEspera?.toFixed(0)} ms`);
  ok('§93: …y B avisó que la espera porque su navegador todavía arma la pista', (lb?.avisos || []).some(t => t.includes('arma la pista')), (lb?.avisos || []).slice(-1)[0] || 'sin aviso');
}

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
    `iguales A ${x.A?.ls?.huellasIguales}, B ${x.B?.ls?.huellasIguales}${['A', 'B'].map(n => x[n]?.ls?.desincronizado ? ` · DESINCRONIZADO (${n}) ` + JSON.stringify(x[n].ls.desincronizado) : '').join('')}`);
  // (§83: el registro de la red de cada pestaña —ahí escribe la carrera sincronizada— para ver qué se separó)
  for (const [n, p] of [['A', A], ['B', B]])
    writeFileSync(path.join(carpeta, `red-${n}.txt`), (await p.evaluate(() => (window.mkwRed?.registro || []).join(String.fromCharCode(10))).catch(() => '')) || '');
  if (RASTRO) await compararRastros();
  await A.locator('#canvas').screenshot({ path: path.join(carpeta, 'A-copa.png') }).catch(() => {});
  await B.locator('#canvas').screenshot({ path: path.join(carpeta, 'B-copa.png') }).catch(() => {});
  writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
  await navegador.close(); servidor.kill();
  console.log(`\n${bien} bien, ${mal} mal  (registro en ${path.relative(raiz, carpeta).replaceAll("\\", "/")}/)`);
  process.exit(mal ? 1 : 0);
}

// --rastro: el primer cuadro en que los rastros de A y B difieren (azar 1, azar 2 o la huella de qué kart), con los
// cuadros de alrededor; los dos rastros completos quedan en rastro-A.json y rastro-B.json
async function compararRastros() {
  const [ra, rb] = await Promise.all([A, B].map(p => p.evaluate(() => window.mkwRastro || []).catch(() => [])));
  writeFileSync(path.join(carpeta, 'rastro-A.json'), JSON.stringify(ra)); writeFileSync(path.join(carpeta, 'rastro-B.json'), JSON.stringify(rb));
  const deB = new Map(rb.map(f => [f[0], f]));
  const nombres = ['azar1a', 'azar1b', 'azar2a', 'azar2b', ...Array.from({ length: 12 }, (_, i) => [`avance${i}`, `kart${i}`]).flat()];
  let comunes = 0;
  for (const fa of ra) {
    const fb = deB.get(fa[0]); if (!fb) continue;
    comunes++;
    const distintos = nombres.filter((n, k) => fa[k + 1] !== fb[k + 1]);
    if (distintos.length) {
      console.log(`  rastro: el primer cuadro distinto es el ${fa[0]} (de ${comunes} cuadros comparados): ${distintos.join(', ')}`);
      const [k0, c0] = fa[0].split(':').map(Number);
      for (const c of [c0 - 2, c0 - 1, c0, c0 + 1, c0 + 2].map(n => `${k0}:${n}`)) {
        const x = ra.find(f => f[0] === c), y = deB.get(c);
        if (x && y) console.log(`    ${c}: ` + nombres.map((n, k) => x[k + 1] === y[k + 1] ? null : `${n} ${(x[k + 1] >>> 0).toString(16)}/${(y[k + 1] >>> 0).toString(16)}`).filter(Boolean).join(' '));
      }
      return;
    }
  }
  console.log(`  rastro: ${comunes} cuadros comparados, todos iguales (A ${ra[0]?.[0]}–${ra.at(-1)?.[0]}, B ${rb[0]?.[0]}–${rb.at(-1)?.[0]})`);
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
// (§85: desde aquí, las dos corriendo, se mide el ritmo de cada una con su medidor; la carga de la pista y la cuenta
// regresiva quedan fuera: su tirón ya lo ignora el aviso, que pide dos ratos malos seguidos)
const desdeRegistro = registro.length;
await tecladoA.down('KeyK'); await tecladoB.down('KeyK');
await espera(9000);
await tecladoB.down('KeyA'); await espera(1500); await tecladoB.up('KeyA');
await espera(20000);
const xa = await leer(A), xb = await leer(B);
const hastaRegistro = registro.length;                 // (§85: las fotos que siguen traban un poco la página)
const fotoA = await A.locator('#canvas').screenshot({ path: path.join(carpeta, 'A.png') }).catch(() => null);
const fotoB = await B.locator('#canvas').screenshot({ path: path.join(carpeta, 'B.png') }).catch(() => null);
await tecladoA.up('KeyK'); await tecladoB.up('KeyK');

ok('la carrera sincronizada avanza en las dos', (xa?.ls?.cuadro || 0) > 900 && (xb?.ls?.cuadro || 0) > 900, `A cuadro ${xa?.ls?.cuadro}, B cuadro ${xb?.ls?.cuadro}`);
ok('la cámara de A sigue a su kart (puesto 0) y la de B al suyo (puesto 1)', xa?.camara === 0 && xb?.camara === 1, `A ${xa?.camara}, B ${xb?.camara}`);
if (DIRECTA) ok('los dos humanos son jugadores de verdad (tipo 0) en las dos consolas, el resto CPU', [xa, xb].every(x => x?.tipos?.[0] === 0 && x.tipos[1] === 0 && x.tipos[2] === 1),
  `A ${xa?.tipos}, B ${xb?.tipos}`);
if (DIRECTA) ok('cada una tiene SU pantalla (A la del puesto 0, B la del puesto 1)', xa?.pantalla === 0 && xb?.pantalla === 1, `A ${xa?.pantalla}, B ${xb?.pantalla}`);
if (DIRECTA) {
  // (la imagen misma: la memoria decía "1 pantalla" y la foto salía partida en dos)
  const [pa, pb] = [fotoA && await pantallaPartida(A, fotoA), fotoB && await pantallaPartida(B, fotoB)];
  ok('en la foto de cada una se ve UNA vista, no la pantalla partida', pa && pb && !pa.partida && !pb.partida && !pa.vacia && !pb.vacia,
     `costura en el medio: A ${pa?.pico} (típico ${pa?.tipico}), B ${pb?.pico} (típico ${pb?.tipico}); cuentas jugadores/pantallas/locales (carrera · menús) A ${xa?.cuentas} B ${xb?.cuentas}; tabla A ${xa?.huds} B ${xb?.huds}; ranuras A ${xa?.ranuras} B ${xb?.ranuras}`);
}
else ok('la tabla de pantallas de Racedata es la misma en las dos (la mira la lógica)', xa?.pantalla === xb?.pantalla, `A ${xa?.pantalla}, B ${xb?.pantalla}`);
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
// §85: el ritmo que de verdad tuvo cada pestaña en la carrera, medido aparte del lockstep: el medidor de la página
// escribe en la consola una línea por segundo ("[medidor] N s: cuadro C, F fps, trabajo T ms"). Da la mediana de los
// cuadros por segundo y del trabajo por cuadro, y el peor promedio de 6 s seguidos (lo que mira el aviso: dos ratos
// de 3 s), con las dos ya corriendo. Como un voltímetro aparte para comprobar lo que marca el panel.
const ritmo = n => {
  const v = registro.slice(desdeRegistro, hastaRegistro).map(l => l.match(new RegExp(String.raw`^\[${n}\] \[medidor\] \d+ s: cuadro \d+, ([\d.]+) fps, trabajo ([\d.]+) ms`)))
    .filter(Boolean).map(m => [+m[1], +m[2]]);
  const mediana = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN;
  let peor6 = Infinity;
  for (let i = 0; i + 6 <= v.length; i++) peor6 = Math.min(peor6, v.slice(i, i + 6).reduce((t, x) => t + x[0], 0) / 6);
  return { fps: mediana(v.map(x => x[0])), trabajo: mediana(v.map(x => x[1])), peor6 };
};
const textoRitmo = r => `${r.fps.toFixed(0)} cuadros/s con ${r.trabajo.toFixed(1)} ms de trabajo por cuadro (lo peor, 6 s seguidos: ${r.peor6.toFixed(0)})`;
if (!process.argv.includes('--lento')) {
  ok('sincronizar cuesta poco (espera promedio por cuadro < 4 ms)', Number(msPorCuadro(xa)) < 4 && Number(msPorCuadro(xb)) < 4, esperas);
  // §85: antes este punto pedía CERO avisos, y eso dependía de cuánto tenía ocupada la PC el resto de los programas: con
  // dos juegos en la misma PC y «todo a la vista» (§61) cada cuadro lleva 13-20 ms de los 16,7 que hay, así que la
  // misma prueba daba 52-60 cuadros/s según el momento, y bajo 50 el aviso «Tu PC no alcanza» es CIERTO. Lo que el
  // punto cuida (§70) es que no haya avisos falsos (el tirón de la largada, cuentas mal hechas): ningún «espera al
  // jugador» (con el relevo de §80 nadie espera a nadie en esta prueba) y cada «Tu PC no alcanza» respaldado por el
  // medidor propio de esa pestaña (bajo 50 durante 6 s; 52 de tolerancia: los dos miden en ratos un poco corridos)
  const [ra, rb] = [ritmo('A'), ritmo('B')];
  const cierto = (x, r) => (x?.avisos || []).every(t => t.startsWith('Tu PC') && r.peor6 < 52);
  ok('los avisos de sala lenta dicen la verdad (ninguno «espera al jugador»; «Tu PC no alcanza» solo si el medidor de esa pestaña bajó de 50 cuadros/s 6 s seguidos)',
    cierto(xa, ra) && cierto(xb, rb), `A: ${avisos(xa)} · B: ${avisos(xb)} · la PC en la carrera: A ${textoRitmo(ra)}, B ${textoRitmo(rb)}`);
  if (ra.fps < 55 || rb.fps < 55) console.log('  (nota: la PC va justa para dos juegos con «todo a la vista»; con otros programas ocupándola puede bajar de 50 y el aviso es cierto — bitácora §85)');
} else {
  // B con la CPU frenada (§70, C5): toda la sala va a su ritmo (A espera a B en cada cuadro) y las dos lo avisan:
  // A, "espera al jugador 2"; B, "tu PC no alcanza"
  ok('con B lenta, A la espera (la sala va al ritmo de la más lenta), sin esperas en B', Number(msPorCuadro(xa)) > 4 && Number(msPorCuadro(xb)) < 1, esperas);
  ok('y lo avisan: A "espera al jugador 2", B "Tu PC no alcanza"', (xa?.avisos || []).some(t => t.includes('jugador 2')) && (xb?.avisos || []).some(t => t.startsWith('Tu PC')),
    `A: ${avisos(xa)} · B: ${avisos(xb)}`);
}
// el retraso (§70, §80): cada consola el suyo, de partida con sus pings y ajustado en la carrera con lo que cuentan
// los demás (lockstep.mjs); los botones de cada uno los escribe solo él, por eso no tienen que ser iguales
const retrasoDe = x => x?.ls?.retraso;
ok('cada una con su retraso, entre 2 y 12 cuadros (se adapta a la red)', [xa, xb].every(x => retrasoDe(x) >= 2 && retrasoDe(x) <= 12),
  `A ${retrasoDe(xa)} (partió en ${xa?.ls?.retrasos?.[xa?.ls?.carrera]}, promedio ${xa?.ls?.retrasoMedio?.toFixed(1)}, frenos ${xa?.ls?.frenos ?? 0}), ` +
  `B ${retrasoDe(xb)} (partió en ${xb?.ls?.retrasos?.[xb?.ls?.carrera]}, promedio ${xb?.ls?.retrasoMedio?.toFixed(1)}, frenos ${xb?.ls?.frenos ?? 0}) cuadros; ida y vuelta medida A ${JSON.stringify(xa?.ls?.rtt)} B ${JSON.stringify(xb?.ls?.rtt)} ms` +
  (EXTRA.includes('redMala') ? ` (red mala de mentira: ${EXTRA.match(/redMala=([\d.,]+)/)?.[1]})` : ''));

writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
for (const [n, p] of [['A', A], ['B', B]]) writeFileSync(path.join(carpeta, `red-${n}.txt`), await p.evaluate(() => window.mkwRed?.registro.join('\n')).catch(() => ''));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (registro en ${path.relative(raiz, carpeta).replaceAll("\\", "/")}/)`);
process.exit(mal ? 1 : 0);
