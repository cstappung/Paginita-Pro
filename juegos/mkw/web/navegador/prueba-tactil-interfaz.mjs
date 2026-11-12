// El mando en pantalla contra la interfaz de la página, con el juego (bitácora §269, bug (e) del dueño: «en el móvil, al
// apretar, el mando táctil se buguea con la interfaz que aparece encima»).
//
// Resumen: un Pixel 7 emulado (toque de verdad por CDP, como dedos en la pantalla) en una carrera de un jugador. Para cada
// pieza de la interfaz que puede aparecer ENCIMA del mando en pantalla —el cajón ⚙, la barra de arriba con la pastilla del
// mando, los chips de la esquina, el aviso del centro, la bienvenida, el zócalo del descanso, el selector de pistas y la
// pastilla «Volver a elegir» de §271— comprueba:
//   (1) un toque en la interfaz no aprieta botones del juego (con A sostenido, el juego sigue viendo solo A);
//   (2) un toque en el mando (donde la pieza no lo tapa) no abre ni cierra la interfaz;
//   (3) levantar el dedo de A con la pieza encima suelta A, y al cerrarla no queda nada apretado y el mando responde;
//   (4) varios dedos (A + el stick doblando + tocar ⚙) no dejan botones pegados.
// Como probar un tablero con cada tapa abierta: el botón de emergencia tiene que cortar igual, con la tapa puesta o no.
// Uso:  MKW_BUILD=build/web-final-w30/navegador node web/navegador/prueba-tactil-interfaz.mjs [--parado] [--extra "&tactilSuelta=0"]
//       [--puerto 8177] [--ventana]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8177)), EXTRA = opcion('--extra', '');
const BIT_A = 0x0100;
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${t}${d ? '  — ' + d : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });
const pixel = devices['Pixel 7'];
const vista = process.argv.includes('--parado') ? pixel.viewport : { width: pixel.viewport.height, height: pixel.viewport.width };
const contexto = await navegador.newContext({ ...pixel, viewport: vista, screen: vista });
const p = await contexto.newPage();
p.on('pageerror', e => console.log('[pageerror] ' + e.message));
await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=0.0&cc=c150&cpu=normal&pj=0&kart=1&bienvenida=0${EXTRA}`);
const t0 = Date.now();
while (Date.now() - t0 < 300000 && !(await p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => false))) await espera(500);
ok('llega a la carrera con el mando en pantalla', await p.evaluate(() => window.mkwEstado.enCarrera && window.mkwControles.tactilActivo()));
// (§269, la caída del celular: en el PC la memoria de la tarjeta crece ~+840 MB en 8 pistas; en el teléfono va prendido
// el conjunto acotado de §248 —las últimas 4 pistas, el resto se suelta—. ¿Lo prende este teléfono?)
ok('el teléfono prende el conjunto acotado de la memoria de la tarjeta (§248)', await p.evaluate(() => !!window.mkwEstado.pipelinesAcotado));
await espera(3000);

// ---- los dedos (CDP: la lista entera de dedos puestos en cada evento; el que falta se levantó) ----
const cdp = await contexto.newCDPSession(p);
const puestos = new Map();
const enviar = tipo => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: [...puestos].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 8, radiusY: 8 })) });
const poner = async (id, q) => { puestos.set(id, q); await enviar('touchStart'); await espera(80); };
const mover = async (id, q) => { puestos.set(id, q); await enviar('touchMove'); await espera(80); };
const levantar = async id => { puestos.delete(id); await enviar('touchEnd'); await espera(80); };
const tocar = async (id, q) => { await poner(id, q); const r = await juego(); await levantar(id); await espera(150); return r; };
// lo que ve el juego (el puerto 0) y los dedos que la capa cree puestos
const juego = () => p.evaluate(() => { window.mkwControles.paso?.(); const q = window.mkwControles.estado.puertos[0]; const t = window.mkwControles.tactilDedos();
  return { botones: q.botones, sx: q.sx, dedos: t.dedos, tactil: t.botones, suelta: t.suelta }; });
const mando = () => p.evaluate(() => { const r = e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; };
  const capa = document.querySelector('.mkw-tactil'); const bs = [...capa.children].filter(e => e.dataset.pieza && e.style.display !== 'none');
  return Object.fromEntries(bs.map(e => [e.dataset.pieza, r(e)])); });
const M = await mando();
// ¿qué hay encima de un punto? (true = algo de la interfaz, no el mando)
const tapado = q => p.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!e && !e.closest('.mkw-tactil'); }, q);
// un punto de la pieza que NO sea un botón suyo (tocar un botón de la interfaz hace lo suyo; acá se toca su fondo)
const puntoDe = sel => p.evaluate(s => {
  const el = document.querySelector(s); if (!el) return null;
  const b = el.getBoundingClientRect(); if (!b.width || !b.height) return null;
  for (const [fx, fy] of [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.5, 0.15], [0.5, 0.85], [0.9, 0.9], [0.3, 0.5], [0.7, 0.5]]) {
    const x = b.left + b.width * fx, y = b.top + b.height * fy, e = document.elementFromPoint(x, y);
    if (e && el.contains(e) && !e.closest('button, a, input, select, label, summary, [role=button]')) return { x, y };
  }
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}, sel);

const PIEZAS = [
  { nombre: 'el cajón ⚙', sel: '#cajon', abrir: () => window.mkwInterfaz.abrirCajon('ajustes'), cerrar: () => window.mkwInterfaz.cerrarCajon(),
    abierta: () => document.body.classList.contains('cajon-abierto') },
  { nombre: 'la barra de arriba (⚙, la pastilla del mando)', sel: '#barra', abrir: () => document.body.classList.add('barra-viva'),
    cerrar: () => document.body.classList.remove('barra-viva'), abierta: () => document.body.classList.contains('cajon-abierto'), soloCajon: true },
  { nombre: 'los chips de la esquina', sel: '#estadoJuego', abrir: () => { window.mkwInterfaz.chip('red', '📶 prueba §269: la red', true); window.mkwInterfaz.chip('lento', '🐢 prueba', true); },
    cerrar: () => { window.mkwInterfaz.chip('red', ''); window.mkwInterfaz.chip('lento', ''); }, abierta: () => !!document.querySelector('#estadoJuego')?.textContent.includes('prueba') },
  { nombre: 'el aviso del centro', sel: '#avisoJuego', abrir: () => window.mkwInterfaz.aviso('Prueba §269: un aviso que se queda…', true),
    cerrar: () => window.mkwInterfaz.aviso(''), abierta: () => !document.getElementById('avisoJuego').hidden },
  { nombre: 'la bienvenida', sel: '#bienvenida', abrir: () => window.mkwBienvenida.abrir(), cerrar: () => window.mkwBienvenida.cerrar('prueba', { marcar: false }),
    abierta: () => !!window.mkwBienvenida.estado.abierto },
  { nombre: 'el zócalo del descanso', sel: '#playlistBreve',
    abrir: () => { window._pb = window.mkwInterfaz.playlistBreve({ pistas: Array.from({ length: 4 }, (_, n) => ({ copa: n, fila: n })), hechas: 1, anfitrion: true, pendientes: 0, restan: () => 20000, alAgregar: () => {} }); },
    cerrar: () => window._pb?.cerrar(), abierta: () => !!document.getElementById('playlistBreve') },
  { nombre: 'el selector de pistas', sel: '#elegirPista', abrir: () => { window._sel = window.mkwInterfaz.elegirPista({ modo: 'gp' }); },
    cerrar: () => document.getElementById('elegirCerrar')?.click(), abierta: () => !!document.getElementById('elegirPista') && !document.getElementById('elegirPista').hidden },
  { nombre: 'la pastilla «Volver a elegir» (§271)', sel: '#elegirVolver',
    abrir: () => { window._sel = window.mkwInterfaz.elegirPista({ modo: 'gp' }); return new Promise(r => setTimeout(() => { document.getElementById('elegirOcultar')?.click(); r(); }, 600)); },
    cerrar: () => { document.getElementById('elegirVolver')?.click(); setTimeout(() => document.getElementById('elegirCerrar')?.click(), 300); },
    abierta: () => !!document.getElementById('elegirVolver') && !document.getElementById('elegirVolver').hidden && getComputedStyle(document.getElementById('elegirVolver')).display !== 'none' },
];
const ev = (f, ...a) => p.evaluate(`(${f})(${a.map(x => JSON.stringify(x)).join(',')})`);

for (const pz of PIEZAS) {
  // A sostenido con el pulgar (dedo 1)
  await poner(1, M.A);
  const a0 = await juego();
  await ev(pz.abrir); await espera(700);
  const q = await puntoDe(pz.sel);
  if (!q || !(await ev(pz.abierta)) && !pz.soloCajon) { ok(`${pz.nombre}: se abre encima del juego`, false, JSON.stringify(q)); await levantar(1); await ev(pz.cerrar); continue; }
  const encima = await tapado(q);
  // (los chips y el aviso del centro dejan pasar el toque —pointer-events: none—: no tapan botones del mando aunque
  // aparezcan encima de uno; ahí el toque es del mando, como si no estuvieran, y lo que se exige es que no aparezcan
  // botones que nadie tocó)
  if (!encima) console.log(`  (${pz.nombre}: deja pasar el toque al mando: no tapa sus botones)`);
  // (1) un toque en la pieza (dedo 2) con A sostenido: el juego ve A y nada más
  const r1 = pz.soloCajon ? await (async () => { await ev(pz.abrir); await espera(100); return tocar(2, q); })() : await tocar(2, q);
  ok(`${pz.nombre}: tocarla con A sostenido no aprieta otro botón del juego`, (a0.botones & BIT_A) && (r1.botones & ~BIT_A) === 0 && r1.dedos === (encima ? 1 : 2),
    `antes ${a0.botones.toString(16)}, con el toque ${r1.botones.toString(16)}, dedos ${r1.dedos}, encima del mando ${encima}`);
  // (3a) levantar A con la pieza encima: se suelta
  await levantar(1); await espera(150);
  const r3 = await juego();
  ok(`${pz.nombre}: levantar A con ella encima suelta A`, r3.botones === 0 && r3.dedos === 0 && r3.sx === 0, `botones ${r3.botones}, dedos ${r3.dedos}, sx ${r3.sx}`);
  // (2) un toque en el mando donde la pieza no lo tapa: la pieza sigue como estaba
  if (!pz.soloCajon) {
    const antes = await ev(pz.abierta);
    let libre = null;
    for (const k of ['B', 'R', 'L', 'arriba', 'A', 'stick']) if (M[k] && !(await tapado(M[k]))) { libre = k; break; }
    if (libre) {
      const r2 = await tocar(3, M[libre]);
      ok(`${pz.nombre}: tocar el mando (${libre}) no la abre ni la cierra`, (await ev(pz.abierta)) === antes && (libre === 'stick' || r2.botones !== 0), `abierta ${antes} → ${await ev(pz.abierta)}, botones ${r2.botones.toString(16)}`);
    } else console.log(`  (${pz.nombre}: tapa todo el mando, no hay dónde tocar sin ella)`);
  }
  // (3b) cerrarla: nada apretado y el mando responde
  await ev(pz.cerrar); if (pz.soloCajon) await p.evaluate(() => window.mkwInterfaz.cerrarCajon()); await espera(900);
  const r4 = await juego();
  const r5 = await tocar(4, M.A);
  const r6 = await juego();
  ok(`${pz.nombre}: al cerrarla no queda nada apretado y A vuelve a responder`, r4.botones === 0 && (r5.botones & BIT_A) && r6.botones === 0 && r6.dedos === 0,
    `al cerrar ${r4.botones}, al tocar A ${r5.botones.toString(16)}, después ${r6.botones} (dedos ${r6.dedos})`);
  await p.evaluate(() => { if (window.mkwEstado?.enCarrera === false) console.log('fuera de la carrera'); });
}

// (4) varios dedos: A + el stick doblando + tocar ⚙ (abre el cajón), y se levantan en distinto orden
for (const orden of [[1, 2, 3], [3, 1, 2], [2, 3, 1]]) {
  await poner(1, M.A);
  await poner(2, M.stick); await mover(2, { x: M.stick.x + M.stick.w * 0.45, y: M.stick.y });
  await p.evaluate(() => document.body.classList.add('barra-viva'));
  const engranaje = await p.evaluate(() => { const b = document.querySelector('#barra [data-abre="ajustes"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await poner(3, engranaje);
  const durante = await juego();
  for (const id of orden) await levantar(id);
  await espera(400);
  const abierto = await p.evaluate(() => document.body.classList.contains('cajon-abierto'));
  const fin = await juego();
  await p.evaluate(() => window.mkwInterfaz.cerrarCajon()); await espera(600);
  const r = await tocar(4, M.A), despues = await juego();
  ok(`varios dedos (A + stick + ⚙, se levantan ${orden.join('→')}): nada pegado y el mando responde`,
    (durante.botones & BIT_A) && durante.sx > 60 && fin.botones === 0 && fin.sx === 0 && fin.dedos === 0 && (r.botones & BIT_A) && despues.botones === 0,
    `durante ${durante.botones.toString(16)}/sx ${durante.sx}, el cajón ${abierto ? 'se abrió' : 'no se abrió'}, al soltar ${fin.botones}/sx ${fin.sx}/dedos ${fin.dedos}, A ${r.botones.toString(16)}, después ${despues.botones}`);
}
// (4b) el dedo en A y la pestaña se oculta (una llamada, el cajón de notificaciones): al volver, nada apretado
await poner(1, M.A);
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const oculta = await juego();
await p.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
puestos.clear(); await enviar('touchEnd'); await espera(200);
ok('con el dedo en A, al ocultarse la pestaña se suelta (sin esperar el levantar)', oculta.botones === 0 && oculta.dedos === 0, `botones ${oculta.botones}, dedos ${oculta.dedos}`);
const s = (await juego()).suelta;
console.log(`  soltados por las vías de §269: ${JSON.stringify(s)}`);

await navegador.close(); servidor.kill();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
