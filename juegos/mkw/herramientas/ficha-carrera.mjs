// Lee la "ficha" de una carrera que el juego armó con sus menús (Racedata) — bitácora §73.
//
// Resumen: para arrancar una carrera por código (sin menús) hay que dejar escrita la misma ficha que dejan los menús.
// Esta herramienta abre la página con el piloto viejo (?modo=vs&copa=…: recorre los menús del juego como una persona),
// espera a que el juego esté en la carrera y lee, con nombres, los campos de:
//   - Racedata (0x809BD728): la ficha de los menús (+0xC10) y la de la carrera (+0x20): cuántos jugadores, pantallas y
//     jugadores locales; por jugador: pantalla (hudSlot), mando, vehículo, personaje, tipo (0 humano, 1 CPU…), equipo;
//     y los ajustes: pista, cilindrada, modo, CPU, objetos, vueltas, banderas (espejo), semilla;
//   - SectionMgr (0x809C1E38): la sección y los parámetros que guardan los menús (personajes/vehículos elegidos).
// Guarda el resultado en build/web/datos/ficha/<nombre>.json (son números de configuración, nada del disco).
// Es como medir con el osciloscopio un equipo que funciona antes de armar uno igual: así se sabe qué valores poner.
//
// Uso:  node herramientas/ficha-carrera.mjs [--nombre vs] [--extra "&modo=vs&copa=0&fila=0&cpu=normal"] [--puerto 8148]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const NOMBRE = opcion('--nombre', 'vs');
const EXTRA = opcion('--extra', '&modo=vs&copa=0&fila=0&cpu=normal');
const PUERTO = Number(opcion('--puerto', 8148));
const carpeta = path.join(raiz, 'build/web/datos/ficha');
mkdirSync(carpeta, { recursive: true });

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const p = await navegador.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('[pageerror] ' + e.message));
await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&directo=0${EXTRA}`);

// la carrera: secciones 0x1E-0x2B (GP, TT, VS 1-4 jugadores, equipos, batalla) y la etapa ≥ 1 (ya corre la cuenta)
const leer = () => p.evaluate(() => {
  const L = window.mkwMenus; if (!L?.estado) return null;
  const e = L.estado(), R = L.u32(0x809BD728);
  if (!R) return { seccion: e.seccion };
  const s8 = v => (v << 24) >> 24;
  const escenario = b => ({
    jugadores: L.u8(b + 4), pantallas: L.u8(b + 5), locales: L.u8(b + 6),
    puestos: Array.from({ length: 12 }, (_, i) => { const q = b + 8 + i * 0xF0; return {
      hud: s8(L.u8(q + 5)), mando: s8(L.u8(q + 6)), vehiculo: L.u32(q + 8), personaje: L.u32(q + 0xC), tipo: L.u32(q + 0x10),
      equipo: L.u32(q + 0xCC), tipoMando: L.u32(q + 0xD0), puntosAntes: L.u16(q + 0xD8), puntos: L.u16(q + 0xDA),
      puestoAntes: L.u8(q + 0xE1), puesto: L.u8(q + 0xE2) }; }),
    ajustes: (a => ({ pista: L.u32(a), cc: L.u32(a + 4), modo: L.u32(a + 8), tipo: L.u32(a + 0xC), batalla: L.u32(a + 0x10),
      cpu: L.u32(a + 0x14), objetos: L.u32(a + 0x18), huds: [0, 1, 2, 3].map(i => L.u8(a + 0x1C + i)), copa: L.u32(a + 0x20),
      carrera: L.u8(a + 0x24), vueltas: L.u8(a + 0x25), b26: L.u8(a + 0x26), b27: L.u8(a + 0x27), banderas: L.u32(a + 0x28),
      seleccion: L.u32(a + 0x2C), semilla: L.u32(a + 0x30) }))(b + 0xB48) });
  // SectionMgr +0x98 = SectionParams: cuántos locales (+0x124), la categoría del menú (+0x128), personajes (+0x12C) y
  // vehículos (+0x13C) elegidos, la última pista (+0x14C), la carrera VS (+0x60) y cuántas (+0x64)
  const sm = L.u32(0x809C1E38), sp = sm ? L.u32(sm + 0x98) : 0;
  const parametros = sp ? { locales: L.u32(sp + 0x124), categoria: L.u32(sp + 0x128),
    personajes: [0, 1, 2, 3].map(i => L.u32(sp + 0x12C + 4 * i)), vehiculos: [0, 1, 2, 3].map(i => L.u32(sp + 0x13C + 4 * i)),
    ultimaPista: L.u32(sp + 0x14C), carreraVs: L.u32(sp + 0x60), carrerasVs: L.u32(sp + 0x64) } : null;
  const ri = L.u32(0x809BD730);
  return { seccion: e.seccion, paginas: e.paginas, etapa: ri ? L.u32(ri + 0x28) : -1, previa: sm ? L.u32(sm + 0x10) : -1,
           menus: escenario(R + 0xC10), carrera: escenario(R + 0x20), parametros };
}).catch(() => null);

const t0 = Date.now();
let ficha = null;
while (Date.now() - t0 < 240000) {
  const f = await leer();
  if (f && f.seccion >= 0x1E && f.seccion <= 0x2B && f.etapa >= 1) { ficha = f; break; }
  await new Promise(r => setTimeout(r, 500));
}
const archivo = path.join(carpeta, NOMBRE + '.json');
if (ficha) {
  writeFileSync(archivo, JSON.stringify(ficha, null, 1));
  const c = ficha.carrera;
  console.log(`sección 0x${ficha.seccion.toString(16)} (antes 0x${ficha.previa.toString(16)}) a los ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(raiz, archivo)}`);
  console.log(`carrera: ${c.jugadores} jugadores, ${c.pantallas} pantallas, ${c.locales} locales; ajustes ${JSON.stringify(c.ajustes)}`);
  c.puestos.slice(0, c.jugadores).forEach((q, i) => console.log(`  ${i}: ${JSON.stringify(q)}`));
  console.log(`menús: ${ficha.menus.jugadores}/${ficha.menus.pantallas}/${ficha.menus.locales}; ajustes ${JSON.stringify(ficha.menus.ajustes)}`);
  console.log(`parámetros: ${JSON.stringify(ficha.parametros)}`);
} else console.log('✗ no llegó a la carrera en 4 min');
await navegador.close();
servidor.kill();
process.exit(ficha ? 0 : 1);
