// Prueba con el juego: la carrera abre DIRECTO, sin que se vea ningún menú del juego — bitácora §73.
//
// Resumen: el dueño pidió que «todo entre directamente donde tiene que estar»: sin la pantalla de licencias, sin el
// título de Retro Rewind, sin nada del Wi-Fi. Esta prueba abre la página con ?modo=directa (una pista de RR, 150cc,
// CPU normal, Mario en el Kart estándar M) y mira la pantalla cada 100 ms: en qué sección está el juego y si la
// cortina de la página está puesta. Comprueba:
//   - que llegó a la carrera sola (sección 0x20, la carrera VS, sin la presentación) y que el juego no llegó a mostrar
//     el título ni la pantalla de licencias (ni siquiera debajo de la pantalla de carga);
//   - que mientras la cortina NO estaba, el juego solo mostraba la carrera (nunca un menú): lo que la persona ve;
//   - que la ficha quedó como la de los menús: la pista de RR pedida (CupsConfig de Pulsar), 12 jugadores, el jugador 1
//     persona con el personaje y vehículo pedidos y los otros 11 CPU con personajes distintos, 150cc, CPU normal;
//   - que la carrera corre (cuenta regresiva → carrera) y que el kart del jugador avanza cuando se aprieta A (K).
// Fotos en build/web/datos/directa/.
//
// Con --elegir: antes de la carrera, la pantalla de personaje del juego abierta por código (sección 0x49), la prueba
// confirma con A (personaje, vehículo, derrape) y se comprueba que la carrera usa lo elegido.
//
// Uso:  node web/navegador/prueba-directa.mjs [--ventana] [--pista 13.2] [--elegir]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8152));
const PISTA = opcion('--pista', '13.2');
const [COPA, FILA] = PISTA.split('.').map(Number);
const PEDIDA = 0x100 + 4 * COPA + (FILA || 0);
const ELEGIR = process.argv.includes('--elegir');
const carpeta = path.join(raiz, 'build/web/datos/directa' + (ELEGIR ? '-elegir' : ''));
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const hex = n => '0x' + (n >>> 0).toString(16);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const p = await navegador.newPage({ viewport: { width: 1000, height: 600 } });
const errores = [];
p.on('pageerror', e => { errores.push(e.message); console.log('[pageerror] ' + e.message); });
const t0 = Date.now();
await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTA}&cc=c150&cpu=normal&pj=0&kart=1${ELEGIR ? '&elegir=1' : ''}`);

// Lo que se ve, cada 100 ms: la sección del juego y si la cortina tapa
const linea = [];             // [segundos, sección, cortina] cada vez que algo cambia
const vistoSinCortina = new Set();
let llego = null, ultimo = '', ultimoToque = 0, fotoEleccion = false;
const paginasEleccion = [];
while (Date.now() - t0 < 150000) {
  const e = await p.evaluate(() => {
    const L = window.mkwMenus, s = L?.estado ? L.estado() : null;
    return { seccion: s ? s.seccion : -1, pagina: s ? s.pagina : -1,
             cortina: !document.body.classList.contains('sin-cortina'), piloto: window.mkwEstado?.piloto || null,
             listo: window.mkw?._mkw_directo_listo && s && s.seccion > 0 ? window.mkw._mkw_directo_listo() : 0 };
  }).catch(() => null);
  if (!e) { await p.waitForTimeout(100); continue; }
  const clave = `${e.seccion}|${e.pagina}|${e.cortina}|${e.listo}`;
  if (clave !== ultimo) { ultimo = clave; linea.push([((Date.now() - t0) / 1000).toFixed(1), hex(e.seccion), 'p' + hex(e.pagina), e.cortina ? 'cortina' : 'a la vista', e.listo ? 'guardado leído' : '']); }
  if (!e.cortina && e.seccion > 0) vistoSinCortina.add(e.seccion);
  // --elegir: en las pantallas de personaje (0x6B), vehículo (0x6C), la de RR (0x10E) y derrape (0x6D), A cada 1,2 s
  if (ELEGIR && !e.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(e.pagina)) {
    if (paginasEleccion[paginasEleccion.length - 1] !== e.pagina) paginasEleccion.push(e.pagina);
    if (!fotoEleccion && e.pagina === 0x6B) {
      fotoEleccion = true; await p.waitForTimeout(800); await p.screenshot({ path: path.join(carpeta, '0-personaje.png') }).catch(() => {});
      await p.keyboard.down('KeyD'); await p.waitForTimeout(150); await p.keyboard.up('KeyD'); await p.waitForTimeout(400);   // otro personaje que Mario
    }
    if (Date.now() - ultimoToque > 1200) {
      ultimoToque = Date.now();
      await p.keyboard.down('KeyK'); await p.waitForTimeout(150); await p.keyboard.up('KeyK');
    }
  }
  if (e.piloto && !e.piloto.eligiendo) { llego = e.piloto; if (e.seccion >= 0x20 && e.seccion <= 0x23 && !e.cortina) break; }
  await p.waitForTimeout(100);
}
const seg = ((Date.now() - t0) / 1000).toFixed(0);
console.log('lo que pasó en pantalla: ' + linea.map(x => x.join(' ')).join(' · '));
ok('la página abrió la carrera directo', !!llego?.llego, `${seg} s desde que se abrió la página`);
const secciones = linea.map(x => x[1]);
ok('llegó a la carrera (0x20) directo, sin la presentación', secciones.includes('0x20') && !secciones.includes('0x1a'), secciones.join(','));
// ni siquiera debajo de la pantalla de carga: el título (página 0x57), elegir licencia (0x65) ni el menú principal (0x5a)
const paginasMenu = linea.filter(x => ['p0x57', 'p0x65', 'p0x5a', 'p0x52'].includes(x[2])).map(x => x[2]);
ok('el juego no llegó a mostrar el título, las licencias ni el menú', paginasMenu.length === 0, paginasMenu.length ? 'se vio ' + [...new Set(paginasMenu)].join(',') : '');
const menusVistos = [...vistoSinCortina].filter(s => (s < 0x1A || s > 0x23) && !(ELEGIR && s === 0x49));
ok('sin cortina solo se vio la carrera (ningún menú, ni licencias, ni título)', menusVistos.length === 0,
   menusVistos.length ? 'se vio ' + menusVistos.map(hex).join(',') : 'vistas: ' + [...vistoSinCortina].map(hex).join(','));
await p.screenshot({ path: path.join(carpeta, '1-presentacion.png') }).catch(() => {});

// La ficha de la carrera (Racedata.racesScenario, +0x20) y la pista de Pulsar
const f = await p.evaluate(() => {
  const L = window.mkwMenus, R = L.u32(0x809BD728), b = R + 0x20, a = b + 0xB48;
  return { jugadores: L.u8(b + 4), pantallas: L.u8(b + 5), locales: L.u8(b + 6), ganadora: L.u32(0x8043319C + 0x10),
           casilla: L.u8(0x8043319C + 8), pista: L.u32(a), cc: L.u32(a + 4), modo: L.u32(a + 8), cpu: L.u32(a + 0x14), vueltas: L.u8(a + 0x25),
           puestos: Array.from({ length: 12 }, (_, i) => { const q = b + 8 + i * 0xF0;
             return { tipo: L.u32(q + 0x10), pj: L.u32(q + 0xC), kart: L.u32(q + 8), mando: (L.u8(q + 6) << 24) >> 24, hud: (L.u8(q + 5) << 24) >> 24 }; }) };
});
writeFileSync(path.join(carpeta, 'ficha.json'), JSON.stringify(f, null, 1));
ok('corre la pista de RR pedida', f.ganadora === PEDIDA && f.pista === f.casilla, `ganadora ${hex(f.ganadora)} (pedí ${hex(PEDIDA)}), casilla ${f.pista}`);
ok('12 jugadores, 1 pantalla, 1 local', f.jugadores === 12 && f.pantallas === 1 && f.locales === 1, `${f.jugadores}/${f.pantallas}/${f.locales}`);
const j1 = f.puestos[0];
if (ELEGIR) {
  const el = await p.evaluate(() => window.mkwEstado.eleccion);
  ok('la pantalla de personaje se abrió directo (sección 0x49) y se recorrió con A', el?.abierto && paginasEleccion[0] === 0x6B && paginasEleccion.includes(0x6D),
     'páginas ' + paginasEleccion.map(hex).join(' → '));
  ok('la página recibió lo elegido (personaje, vehículo, derrape): otro que Mario (se movió a la derecha)', el?.personaje > 0 && el?.vehiculo >= 0 && el?.derrape > 0, JSON.stringify(el));
  ok('en la carrera el jugador 1 tiene el personaje y el vehículo elegidos', j1.tipo === 0 && j1.pj === el?.personaje && j1.kart === el?.vehiculo && j1.hud === 0,
     JSON.stringify(j1));
} else
ok('el jugador 1 es la persona, con Mario y el Kart estándar M, en el mando 0', j1.tipo === 0 && j1.pj === 0 && j1.kart === 1 && j1.mando === 0 && j1.hud === 0,
   JSON.stringify(j1));
const cpus = f.puestos.slice(1);
ok('los otros 11 son CPU con personajes distintos y vehículos de su peso', cpus.every(q => q.tipo === 1) && new Set(f.puestos.map(q => q.pj)).size === 12,
   cpus.map(q => `${q.pj}/${q.kart}`).join(' '));
// (M20, §96: «normal» de la página va al juego como su fila «difícil», la 2: los niveles de la página son más altos)
ok('150cc, VS, CPU normal de la página (la fila difícil del juego)', f.cc === 2 && f.modo === 1 && f.cpu === 2, `cc ${f.cc}, modo ${f.modo}, cpu ${f.cpu}, vueltas ${f.vueltas}`);

// La carrera corre: la cuenta regresiva y después la carrera (Raceinfo +0x28: 1 cuenta, 2 corriendo)
const etapa = () => p.evaluate(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730); return ri ? L.u32(ri + 0x28) : -1; });
const t1 = Date.now();
let e2 = -1;
while (Date.now() - t1 < 30000 && (e2 = await etapa()) < 2) await p.waitForTimeout(200);
ok('la cuenta regresiva termina y la carrera corre', e2 === 2, `etapa ${e2} a los ${((Date.now() - t1) / 1000).toFixed(0)} s`);

// El kart del jugador avanza con A: el avance en la carrera (RaceinfoPlayer +0xC, raceCompletion) antes y después de
// 6 s con K apretada (la tecla de A)
const avance = () => p.evaluate(() => {
  const L = window.mkwMenus, ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC), v = new DataView(new ArrayBuffer(4));
  v.setUint32(0, L.u32(L.u32(lista) + 0xC)); return v.getFloat32(0);
});
await p.locator('#canvas').click({ position: { x: 5, y: 5 } }).catch(() => {});
const a0 = await avance();
await p.keyboard.down('KeyK');
await p.waitForTimeout(6000);
await p.screenshot({ path: path.join(carpeta, '2-carrera.png') }).catch(() => {});
await p.keyboard.up('KeyK');
const a1 = await avance();
ok('el kart del jugador 1 avanza al apretar A', a1 - a0 > 0.02, `avance ${a0.toFixed(3)} → ${a1.toFixed(3)} (1 = una vuelta)`);
const fps = await p.evaluate(() => window.mkwEstado.fps);
ok('el juego va a ~60 cuadros por segundo en la carrera', fps >= 50, `${fps} cuadros/s`);
ok('sin errores en la página', errores.length === 0, errores.slice(0, 2).join(' | '));
writeFileSync(path.join(carpeta, 'linea.json'), JSON.stringify(linea));

await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
