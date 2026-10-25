// Prueba con el juego de verdad: la Contrarreloj contra el mejor fantasma de la página (bitácora §92).
//
// Resumen: con un navegador sin partidas y una nube de mentira (un almacén falso de récords y fantasmas, como el del
// banco: nada de Firebase), dos visitas:
//   1. «Ana» corre una Contrarreloj sola (?fantasma=0), maneja unos segundos y la termina por código (el juego cree que
//      cruzó la meta). Su tiempo es récord de la página → el récord va a la tabla y la página sube SU fantasma: el .rkg
//      que acaba de escribir Pulsar en la carpeta del mod, el mismo, byte por byte.
//   2. Otra persona («Bea», otra visita) abre la Contrarreloj de esa pista CONTRA EL FANTASMA (?fantasma=1, el primer
//      botón de la pantalla de fantasmas). La tabla de la nube dice que el mejor es Ana: la página baja su fantasma y el
//      juego corre contra él (no contra el de Retro Rewind): el búfer del fantasma que cargó el juego es el de Ana, hay
//      un fantasma en la carrera (tipo 3), su tiempo es el de Ana y maneja solo (con Bea quieta, va adelante).
//
// Uso:  node web/navegador/prueba-fantasma.mjs [--ventana] [--puerto 8165]    (MKW_BUILD = otro build, como siempre)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8165));
const carpeta = path.join(raiz, 'build/web/datos/fantasma');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const contexto = await navegador.newContext({ viewport: { width: 1000, height: 1100 } });
const pagina = await contexto.newPage();
const registro = [];
pagina.on('console', m => registro.push(m.text()));
pagina.on('pageerror', e => registro.push('pageerror ' + e.message));
const foto = nombre => pagina.locator('#canvas').screenshot({ path: path.join(carpeta, nombre + '.png') }).catch(() => {});
const etapa = () => pagina.evaluate(() => { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return ri ? L.u32(ri + 0x28) : -1; }).catch(() => -1);

// La nube de mentira: vive en Node (sobrevive a las recargas) y la página la usa por funciones expuestas. Imita las
// reglas: un récord por persona que solo se reemplaza si mejora; el fantasma, uno por persona y tabla.
const nube = { records: {}, fantasmas: {} };
await contexto.exposeFunction('__nubeMio', (k, u) => nube.records[k]?.[u] || null);
await contexto.exposeFunction('__nubeGuardar', (k, u, d) => { (nube.records[k] ||= {})[u] = d; return true; });
await contexto.exposeFunction('__nubeTop', (k, n) => Object.values(nube.records[k] || {}).sort((a, b) => a.ms - b.ms).slice(0, n));
await contexto.exposeFunction('__nubeSubirFantasma', (k, u, b) => { nube.fantasmas[`${k}/${u}`] = b; return true; });
await contexto.exposeFunction('__nubeBajarFantasma', (k, u) => nube.fantasmas[`${k}/${u}`] || null);
// conectar la página a esa nube apenas exista (como lo hace la página de Juegos del sitio) con la persona que diga la dirección
await contexto.addInitScript(() => {
  const quien = new URLSearchParams(location.search).get('quien');
  if (!quien) return;
  const almacen = {
    mio: (k, u) => window.__nubeMio(k, u), guardar: (k, u, d) => window.__nubeGuardar(k, u, d), top: (k, n) => window.__nubeTop(k, n),
    fantasmaSubir: (k, u, b) => window.__nubeSubirFantasma(k, u, Array.from(b)),
    fantasmaBajar: async (k, u) => { const b = await window.__nubeBajarFantasma(k, u); return b ? new Uint8Array(b) : null; },
  };
  const t = setInterval(() => { if (window.mkwConectarRecords) { clearInterval(t); window.mkwConectarRecords({ almacen, uid: quien, nombre: quien === 'ana' ? 'Ana' : 'Bea' }); } }, 20);
});

try {
  // 1) Ana: Contrarreloj sola, unos segundos manejando, y la meta por código
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?portada=1`);
  await pagina.evaluate(() => window.mkwGuardado.borrarTodo());
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=tt&copa=0&fila=0&fantasma=0&quien=ana`);
  let e = -1; const t0 = Date.now();
  while (Date.now() - t0 < 180000 && (e = await etapa()) !== 2) await espera(250);
  ok('Ana: la Contrarreloj sola abrió y corre', e === 2, `etapa ${e} a los ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await pagina.keyboard.down('KeyK'); await espera(8000); await pagina.keyboard.up('KeyK');
  await pagina.evaluate(() => window.mkw._mkw_sala_terminar(0));
  const t1 = Date.now();
  while (Date.now() - t1 < 20000 && (e = await etapa()) < 4) await espera(250);
  await foto('1-ana-meta');
  // la página registra el récord y sube el fantasma (Pulsar lo escribe en su tarea de fondo: hasta ~15 s)
  let k = '', rkgNube = null; const t2 = Date.now();
  while (Date.now() - t2 < 30000) {
    const llaves = Object.keys(nube.fantasmas);
    if (llaves.length) { k = llaves[0].split('/')[0]; rkgNube = Uint8Array.from(nube.fantasmas[llaves[0]]); break; }
    await espera(500);
  }
  const record = (k || Object.keys(nube.records)[0]) ? nube.records[k || Object.keys(nube.records)[0]]?.ana : null;
  ok('su tiempo quedó en la tabla de la página (la nube de mentira)', !!record, record ? `${k}: ${record.ms} ms` : JSON.stringify(Object.keys(nube.records)));
  const porQue = rkgNube ? '' : JSON.stringify(await pagina.evaluate(() => { const L = window.mkwMenus, s = L.u32(0x8189FBBC), c = L.u32(0x818A2D9C);
    const FS = window.mkwFS, base = '/datos/WiiCompiled/NAND/shared2/Pulsar/RetroRewind6/Ghosts', hay = [];
    try { for (const p of FS.readdir(base)) if (p[0] !== '.') for (const m of FS.readdir(`${base}/${p}`)) if (m[0] !== '.') { try { for (const n of FS.readdir(`${base}/${p}/${m}`)) hay.push(`${p}/${m}/${n} ${+FS.stat(`${base}/${p}/${m}/${n}`).mtime}`); } catch { hay.push(`${p}/${m}`); } } } catch (e) { hay.push(String(e)); }
    return { sistema: s.toString(16), modo: s ? L.u32(s + 0xD0) : -1, cups: c.toString(16), pista: c ? L.u32(c + 0x10).toString(16) : '', ahora: Date.now(),
             estado: window.mkwFantasmaPagina?.estado, ultimo: window.mkwEstado?.ultimoTiempo, hay }; }).catch(e => e.message));
  if (!k) k = Object.keys(nube.records)[0] || '';
  ok('y la página subió su fantasma (mkw/fantasmas/<pista>-<cat>/<uid>.rkg)', !!rkgNube && Object.keys(nube.fantasmas)[0] === `${k}/ana`, rkgNube ? `${Object.keys(nube.fantasmas)[0]}, ${rkgNube.length} bytes` : 'no subió ' + porQue);
  // es el mismo .rkg que escribió Pulsar en la carpeta del mod
  const enMod = await pagina.evaluate(() => {
    const FS = window.mkwFS, base = '/datos/WiiCompiled/NAND/shared2/Pulsar/RetroRewind6/Ghosts', hay = [];
    for (const p of FS.readdir(base)) if (p[0] !== '.') { try { for (const n of FS.readdir(`${base}/${p}/150`)) if (n.endsWith('.rkg')) hay.push(Array.from(FS.readFile(`${base}/${p}/150/${n}`))); } catch {} }
    return hay;
  });
  const igual = rkgNube && enMod.some(b => b.length === rkgNube.length && b.every((x, i) => x === rkgNube[i]));
  ok('el fantasma subido es el .rkg que grabó el juego, byte por byte', !!igual, `${enMod.length} .rkg en la carpeta`);
  const tiempoAna = rkgNube ? (await import('./fantasma-pagina.mjs')).tiempoRkg(rkgNube) : 0;
  ok('su tiempo (cabecera del .rkg) es el del récord', tiempoAna > 0 && record && tiempoAna === record.ms, `${tiempoAna} ms`);

  // 2) Bea, otra visita (sin las partidas de Ana): la misma pista contra el fantasma
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?portada=1`);
  await pagina.evaluate(() => window.mkwGuardado.borrarTodo());
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=tt&copa=0&fila=0&fantasma=1&quien=bea`);
  const t3 = Date.now();
  while (Date.now() - t3 < 180000 && (e = await etapa()) < 1) await espera(250);
  await espera(3000);
  const x = await pagina.evaluate(rkgLargo => {
    const L = window.mkwMenus, M = window.mkw, rd = L.u32(0x809BD728), esc = rd + 0x20;
    const tipos = Array.from({ length: 4 }, (_, i) => L.u32(esc + 8 + i * 0xF0 + 0x10));
    // el fantasma que se corre, descomprimido en Racedata (Pulsar: 4 búferes RKG desde +0x23F0; el de la carrera es el 1.º con datos)
    const tiempos = [];
    for (let i = 0; i < 4; i++) { const b = rd + 0x23F0 + i * 0x2800; const h = [0, 1, 2, 3, 4, 5, 6].map(o => L.u8(b + o));
      tiempos.push(String.fromCharCode(...h.slice(0, 4)) === 'RKGD' ? (h[4] >> 1) * 60000 + (((h[4] & 1) << 6) | (h[5] >> 2)) * 1000 + (((h[5] & 3) << 8) | h[6]) : 0); }
    return { usado: M._mkw_fantasma_pagina_usado?.() ?? -1, estado: M._mkw_fantasma_pagina_estado?.() ?? -1, tipos, tiempos,
      ultimo: window.mkwFantasmaPagina?.estado?.ultimo || null, etapa: L.u32(L.u32(0x809BD730) + 0x28) };
  }, rkgNube?.length || 0);
  await foto('2-bea-contra-ana');
  ok('Bea: la página bajó el fantasma del mejor de la tabla (Ana)', x.ultimo?.uid === 'ana', JSON.stringify(x.ultimo));
  ok('el juego cargó ese fantasma en lugar del experto de Retro Rewind (desde la pantalla de fantasmas)', x.usado >= 1, `usado ${x.usado}, estado ${x.estado}`);
  ok('en la carrera hay un fantasma (jugador tipo 3) y es el de Ana (su tiempo)', x.tipos.includes(3) && x.tiempos.includes(tiempoAna),
     `tipos ${x.tipos.join(',')} · tiempos de los fantasmas ${x.tiempos.join(', ')}`);
  // el fantasma maneja solo, con los botones de Ana: con Bea quieta en la largada, a los segundos va adelante
  const t4 = Date.now();
  while (Date.now() - t4 < 30000 && (await etapa()) < 2) await espera(250);
  await espera(6000);
  const av = await pagina.evaluate(() => { const L = window.mkwMenus, lista = L.u32(L.u32(0x809BD730) + 0xC);
    const f = x => new DataView(new Uint32Array([x]).buffer).getFloat32(0, true);
    return [0, 1].map(i => f(L.u32(L.u32(lista + 4 * i) + 0xC))); });
  await foto('3-fantasma-adelante');
  ok('el fantasma de Ana maneja solo (va adelante) mientras Bea está quieta en la largada', av[1] > av[0] + 0.02, `avance Bea ${av[0].toFixed(3)} · fantasma ${av[1].toFixed(3)}`);
  ok('ninguna página se cayó', !registro.some(t => t.startsWith('pageerror') || /fatal dialog/.test(t)), registro.filter(t => t.startsWith('pageerror')).slice(0, 2).join(' | '));
} catch (e) {
  ok('la prueba corrió sin errores', false, String(e && e.message || e));
}

await pagina.evaluate(() => window.mkwGuardado && window.mkwGuardado.borrarTodo()).catch(() => {});
console.log(`${bien} bien, ${mal} mal  (fotos en ${path.relative(raiz, carpeta).replaceAll('\\', '/')}/)`);
await navegador.close();
servidor.kill();
process.exit(mal ? 1 : 0);
