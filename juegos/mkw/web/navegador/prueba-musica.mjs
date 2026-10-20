// Prueba con el juego: cuánto tarda en sonar la música bajo el menú de inicio «JloKart Wii» — bitácora §76.
//
// Resumen: el dueño notó que, al abrir el juego, la música tardaba «unos segundos» en sonar debajo del menú de inicio.
// Esa música es la del TÍTULO del juego, que arranca debajo del menú. Medido: el menú salía a los 0,2 s y la música a
// los ~9 s (1.ª visita) o ~6 s (con caché). La causa: al arrancar, aurora pedía los ~700 pipelines de la lista de
// precalentado y el navegador los compilaba justo mientras el juego cargaba su título. Ahora (MKW_PRECALENTAR=tarde)
// se piden recién cuando el juego llega a su primera pantalla — solo si este navegador ya jugó antes (marca
// "mkw.precalentado"; en la 1.ª visita Chrome compila esos shaders de cero y hacerlo con la música sonando la trababa,
// así que ahí se precalienta al arrancar como antes, y ayuda la semilla del arranque). Además, al elegir Single Player el menú «Un jugador»
// leía 64 fantasmas del Contrarreloj de a uno, cada uno esperando la red: ahora se piden por carpeta (disco.mjs).
//
// La página se abre como en el sitio (?inicio=1: el menú aparece aunque sea Playwright) contra servidor.mjs con 50 ms
// de latencia por pedido (MKW_LATENCIA, como R2 detrás del Worker), en un perfil de Chrome nuevo (1.ª visita sin caché)
// que después se reusa (visitas con caché). Sin sonido (--mute-audio): el medidor de sonido.mjs mide ANTES del volumen,
// así que ve la música igual. Comprueba:
//   1. 1.ª visita: aparece el menú; la música del título suena debajo de él, sin cortes; la semilla del arranque pidió
//      de una vez lo que el juego lee hasta su título; el precalentado fue al arrancar; queda la marca para la próxima;
//   2. Single Player: la música del menú «Un jugador» suena a menos de 3 s, y los fantasmas se pidieron por carpeta;
//   3. con caché, alternando el camino viejo (?precalentarTarde=0) y el nuevo: el nuevo posterga el precalentado al
//      título, no corta la música y la hace sonar claramente antes.
// Con --comparar: además una 1.ª visita por el camino viejo (otro perfil nuevo), para anotar el antes en la bitácora.
// El camino viejo: ?precalentarTarde=0&semillaArranque=0 (y &vecinos=0 en la 1.ª visita).
//
// Uso:  node web/navegador/prueba-musica.mjs [--ventana] [--comparar] [--vueltas 2] [--puerto 8170]
//       (MKW_BUILD=otro build, como en servidor.mjs)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8170));
const VUELTAS = Number(opcion('--vueltas', 2));
const COMPARAR = process.argv.includes('--comparar');
const carpeta = path.join(raiz, 'build/web/datos/musica');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const s = ms => (ms / 1000).toFixed(1) + ' s';
const mediana = l => [...l].sort((a, b) => a - b)[l.length >> 1];
// el camino de antes: precalentado al arrancar y sin la semilla del arranque
const VIEJO = '&precalentarTarde=0&semillaArranque=0';

// El servidor de siempre, con la latencia de la red del sitio
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: process.env.MKW_LATENCIA || '50' } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));

// Lo que la página anota sola, cada 5 ms, desde que abre: cuándo aparece el menú, cuándo llega el título, cuándo suena
// la música (un bloque de sonido con pico > 0,03 = −30 dB) y con qué estaba el menú en ese momento
const VIGIA = () => {
  window.__musica = {};
  const h = window.__musica, ahora = () => Math.round(performance.now());
  const id = setInterval(() => {
    const e = window.mkwMenus?.estado ? window.mkwMenus.estado() : {}, son = window.mkwSonido?.estado;
    if (!h.menu && window.mkwInicio?.visible) h.menu = ahora();
    if (!h.titulo && e.seccion === 0x3f) h.titulo = ahora();
    if (!h.musica && (son?.pico || 0) > 0.03) { h.musica = ahora(); h.menuEncima = !!window.mkwInicio?.visible; h.base = { huecos: son.huecos }; }
    // llegó al menú «Un jugador» (sección 0x48 con su página 0x69; antes de eso suena la cola de la música del título)
    if (h.musica && !h.sp && window.__enter && e.seccion === 0x48 && (e.paginas || []).includes(0x69)) h.sp = ahora();
    if (h.sp && !h.spMusica && (son?.pico || 0) > 0.03) { h.spMusica = ahora(); clearInterval(id); }
  }, 5);
};

async function visita(contexto, extra, { singlePlayer = false } = {}) {
  const p = contexto.pages()[0] || await contexto.newPage();
  const log = [];
  p.removeAllListeners('console');
  p.on('console', m => log.push(m.text()));
  await p.goto(`http://127.0.0.1:${PUERTO}/?inicio=1${extra}`);
  await p.waitForFunction(() => window.__musica?.musica, null, { timeout: 90000, polling: 50 }).catch(() => {});
  const r = await p.evaluate(() => ({ ...window.__musica, imagen: window.mkwEstado?.imagenInicio }));
  r.menuAMusica = r.musica && r.menu ? r.musica - r.menu : null;
  r.log = log;
  r.pagina = p;
  // 8 s de música (mientras tanto se precalienta, si se postergó): ¿se cortó?
  await espera(8000);
  r.sonido = await p.evaluate(() => ({ huecos: window.mkwSonido.estado.huecos, tarde: window.mkwEstado.precalentadoTarde || null,
                                       arranque: window.mkwEstado.semillaArranque || null }));
  r.huecos = r.sonido.huecos - (r.base?.huecos || 0);
  if (!singlePlayer) return r;
  // la marca para la próxima visita (20 s después de llegar al título)
  await p.waitForFunction(() => localStorage.getItem('mkw.precalentado') === '1', null, { timeout: 30000, polling: 200 }).catch(() => {});
  r.marca = await p.evaluate(() => localStorage.getItem('mkw.precalentado'));
  // Single Player (Enter en el menú): el juego abre su menú «Un jugador» y su música
  await p.evaluate(() => { window.__enter = performance.now(); });
  await p.keyboard.down('Enter'); await espera(100); await p.keyboard.up('Enter');
  await p.waitForFunction(() => window.__musica.spMusica, null, { timeout: 30000, polling: 50 }).catch(() => {});
  Object.assign(r, await p.evaluate(() => ({ enter: Math.round(window.__enter), sp: window.__musica.sp, spMusica: window.__musica.spMusica,
                                             carpetas: [...(window.mkwDisco?.estado.carpetas || [])] })));
  r.enterAMusica = r.spMusica ? r.spMusica - r.enter : null;
  return r;
}

const perfiles = [];
const nuevoContexto = async nombre => {
  const dir = path.join(os.tmpdir(), `mkw-prueba-musica-${nombre}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  perfiles.push(dir);
  const c = await chromium.launchPersistentContext(dir, { channel: 'chrome', headless: !process.argv.includes('--ventana'),
    viewport: { width: 1280, height: 720 }, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
  await c.addInitScript(VIGIA);
  return c;
};

let codigo = 1, contexto = null;
const resumen = {};
try {
  // ---------- 1.ª visita, sin caché (el camino viejo, solo con --comparar) ----------
  if (COMPARAR) {
    const cv = await nuevoContexto('viejo');
    const v = await visita(cv, VIEJO + '&vecinos=0', { singlePlayer: true });
    resumen.viejo1 = { menuAMusica: v.menuAMusica, enterAMusica: v.enterAMusica, huecos: v.huecos };
    console.log(`· camino viejo, 1.ª visita: menú → música ${s(v.menuAMusica)}; Single Player → música ${v.enterAMusica ? s(v.enterAMusica) : '—'}`);
    await cv.close();
  }
  contexto = await nuevoContexto('nuevo');
  const r = await visita(contexto, '', { singlePlayer: true });
  writeFileSync(path.join(carpeta, '1-visita.log'), r.log.join('\n'));
  ok('aparece el menú de inicio «JloKart Wii» (imagen privada 200)', !!r.menu && r.imagen === 200, `a los ${r.menu} ms, imagen ${r.imagen}`);
  ok('la música del título suena DEBAJO del menú (antes de elegir nada)', !!r.musica && r.menuEncima, `a los ${r.musica} ms`);
  ok('1.ª visita (sin caché): del menú a la música, menos de 8 s, sin cortes', r.menuAMusica !== null && r.menuAMusica < 8000 && r.huecos === 0,
     `${s(r.menuAMusica)} (título del juego a los ${r.titulo} ms), ${r.huecos} huecos` +
     (resumen.viejo1 ? `; camino viejo ${s(resumen.viejo1.menuAMusica)}` : ''));
  const arranque = r.sonido?.arranque;
  ok('la semilla del arranque pidió de una vez lo que el juego lee hasta su título', !!arranque && arranque.bloques >= 50,
     arranque ? `${arranque.bloques} bloques en ${arranque.pedidos} pedidos` : 'no se pidió');
  ok('1.ª visita: el precalentado va al arrancar (shaders sin caché: postergarlo trabaría la música)', !r.sonido?.tarde,
     r.sonido?.tarde ? 'se postergó' : 'al arrancar');
  ok('…y queda la marca para que la próxima visita lo postergue', r.marca === '1', `mkw.precalentado = ${r.marca}`);
  ok('Single Player: la música del menú «Un jugador» suena a menos de 3 s', r.enterAMusica !== null && r.enterAMusica < 3000,
     `${r.enterAMusica ? s(r.enterAMusica) : 'no sonó'} (menú «Un jugador» a los ${r.sp ? s(r.sp - r.enter) : '—'})` +
     (resumen.viejo1?.enterAMusica ? `; camino viejo ${s(resumen.viejo1.enterAMusica)}` : ''));
  ok('…y los 64 fantasmas del Contrarreloj se pidieron por carpeta (no de a uno)',
     ['ghost1', 'ghost2'].every(g => r.carpetas.some(c => c.endsWith(`/Race/TimeAttack/${g}/`))), r.carpetas.map(c => c.split('/').slice(-2).join('/')).join(', '));
  await r.pagina.screenshot({ path: path.join(carpeta, '1-un-jugador.png') });
  resumen.nuevo1 = { menuAMusica: r.menuAMusica, enterAMusica: r.enterAMusica, huecos: r.huecos, arranque };

  // ---------- visitas con caché, alternando el camino viejo y el nuevo ----------
  const tiempos = { viejo: [], nuevo: [] }, nuevas = [];
  for (let i = 0; i < VUELTAS; i++) for (const [nombre, extra] of [['viejo', VIEJO], ['nuevo', '']]) {
    const v = await visita(contexto, extra);
    tiempos[nombre].push(v.menuAMusica ?? 99999);
    if (nombre === 'nuevo') nuevas.push(v);
  }
  ok('con caché: el precalentado se postergó al título (sección 0x3f), con toda la lista',
     nuevas.every(v => v.sonido.tarde?.n >= 500 && v.sonido.tarde.seccion === 0x3f),
     nuevas.map(v => v.sonido.tarde ? `${v.sonido.tarde.n} pipelines` : 'no').join(', '));
  ok('…sin cortes en la música mientras se precalienta', nuevas.every(v => v.huecos === 0), nuevas.map(v => v.huecos + ' huecos').join(', '));
  resumen.conCache = { viejo: tiempos.viejo, nuevo: tiempos.nuevo };
  const mv = mediana(tiempos.viejo), mn = mediana(tiempos.nuevo);
  ok('con caché: el camino nuevo hace sonar la música mucho antes (≤ 70 % del viejo, y < 4,5 s)', mn <= 0.7 * mv && mn < 4500,
     `mediana viejo ${s(mv)} (${tiempos.viejo.map(s).join(', ')}), nuevo ${s(mn)} (${tiempos.nuevo.map(s).join(', ')})`);
  writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 1));
  codigo = mal ? 1 : 0;
} catch (e) {
  console.log('✗ la prueba se cortó — ' + (e && e.stack || e));
} finally {
  console.log(`\n${bien} bien, ${mal} mal  (resumen y foto en build/web/datos/musica/)`);
  await contexto?.close().catch(() => {});
  for (const d of perfiles) rmSync(d, { recursive: true, force: true, maxRetries: 3 });
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F']); else servidor.kill();
  process.exit(codigo);
}
