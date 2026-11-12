// La caja negra con el juego (bitácora §269, la caída del celular en medio de la carrera).
//
// Resumen: abre una carrera de un jugador (?modo=directa) y, con la carrera andando, MATA la pestaña con
// `Page.crash` de Chrome (lo mismo que hace Android cuando se queda sin memoria: el proceso muere de golpe, sin pagehide).
// Abre la página otra vez en el mismo perfil y comprueba que el registro dice «[caída] … en medio de la carrera», que el
// aviso se ve y que el informe de rendimiento lo trae. Después prueba la tarjeta de video perdida: `GPUDevice.destroy()`
// no sirve (es «destroyed», a propósito), así que se lanza el evento de un error del motor (RuntimeError) y se recarga.
// Uso:  MKW_BUILD=build/web-final-w30/navegador node web/navegador/prueba-caja-negra.mjs [--puerto 8174] [--ventana]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8174));
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
// (el plazo de toda la prueba: 12 min; nunca más una prueba trabada horas con el candado tomado)
setTimeout(() => { console.log(`✗ la prueba no terminó en 12 min (${bien} bien hasta acá)`); try { servidor.kill(); } catch {} process.exit(1); }, 12 * 60000).unref();

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });
const contexto = await navegador.newContext({ viewport: { width: 1000, height: 600 } });
const url = `http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=0.0&cc=c150&cpu=normal&pj=0&kart=1`;
const abrir = async () => { const p = await contexto.newPage(); p.on('pageerror', e => console.log('[pageerror] ' + e.message)); await p.goto(url); return p; };
const enCarrera = p => p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => false);
const hasta = async (p, f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f(p)) return true; await espera(500); } return false; };

// ---- 1. La pestaña muerta de golpe en la carrera ----
let p = await abrir();
ok('la página tiene la caja negra', await p.evaluate(() => !!window.mkwCaidas));
ok('la primera vez no hay caída anterior', await p.evaluate(() => window.mkwCaidas.estado.anterior === null));
ok('llega a la carrera', await hasta(p, enCarrera, 240000));
await espera(7000);   // (más de un latido con la carrera andando)
const latido = await p.evaluate(() => JSON.parse(localStorage.getItem('mkw.caida')).latido);
ok('el latido de la carrera dice en carrera y la memoria del juego', latido?.enCarrera === true && latido.heapMB > 100, JSON.stringify(latido));
const cdp = await contexto.newCDPSession(p);
// (con plazos: después de Page.crash, cerrar la pestaña muerta o contestar el CDP puede quedar esperando para siempre —
// pasó: 5 h trabada—; la pestaña muerta se deja y se abre otra en el mismo perfil)
const plazo = (pr, ms) => Promise.race([pr.catch(() => {}), espera(ms)]);
await plazo(cdp.send('Page.crash'), 3000);
await espera(1500);
await plazo(p.close(), 5000);
p = await abrir();
await espera(5000);
const r = await p.evaluate(() => ({ texto: window.mkwCaidas?.texto(), log: (window.mkwEstado?.log || []).filter(l => String(l).startsWith('[caída]')),
  aviso: document.body.innerText.includes('se cerró en medio de la carrera'), informe: window.mkwInformeRendimiento?.().caidaAnterior || null }));
ok('al volver: «[caída]» en el registro, en medio de la carrera', r.log.length === 1 && /en medio de la carrera/.test(r.log[0]), r.log[0]);
ok('el jugador ve el aviso', r.aviso);
ok('el informe de rendimiento lo trae', /se cerró/.test(r.informe || ''), r.informe);
console.log('  ' + r.texto);

// ---- 2. Un error del motor ----
await p.evaluate(() => setTimeout(() => { throw new WebAssembly.RuntimeError('memory access out of bounds (prueba)'); }, 0));
await espera(500);
const causa = await p.evaluate(() => JSON.parse(localStorage.getItem('mkw.caida')).causa);
ok('el error del motor queda como causa', causa?.tipo === 'motor' && /out of bounds/.test(causa.texto), JSON.stringify(causa));
await p.reload(); await espera(5000);
const r2 = await p.evaluate(() => window.mkwCaidas?.texto());
ok('al recargar se cuenta, aunque la recarga fue limpia', /out of bounds/.test(r2 || ''), r2);
await p.reload(); await espera(5000);
ok('y la siguiente vez ya no (se contó una vez)', await p.evaluate(() => window.mkwCaidas.estado.anterior === null));

await navegador.close(); servidor.kill();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
