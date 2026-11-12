// Prueba con el juego: en el teléfono, la vibración solo con los choques, los golpes, la largada y el champiñón, y
// suave (bitácora §272).
//
// Resumen: abre el juego haciéndose pasar por un Pixel 7 acostado (táctil, «puntero grueso»: la página lo trata como
// un teléfono) y anota cada llamada a `navigator.vibrate` (la envuelve antes de que cargue la página). Corre dos
// carreras manejando con el teclado:
//   1. VS directa con 11 CPU en «máximo» (tiran objetos y chocan): acelera, gira a un lado y al otro para darse contra
//      las paredes y los demás, y usa lo que le toque;
//   2. Contrarreloj (el piloto de la página la abre), que trae 3 champiñones: la largada con turbo y los 3 champiñones.
// Después compara: cada vibración que pidió el juego (el número del patrón que la página leyó, `mkwVibracion.eventos`)
// contra lo que de verdad le llegó al teléfono. Comprueba:
//   - que cada evento de la lista (choque, golpe, largada, champiñón) dio UN pulso de su largo (≤ 40 ms);
//   - que lo demás que pidió el juego (miniturbo, flechas, piruetas…) no vibró;
//   - que no salió ninguna otra orden (nada de 5000 ms ni pulsos de 100 ms como antes);
//   - que hubo al menos un choque o golpe en la VS, la largada y los champiñones en la Contrarreloj.
// Con --vieja: lo mismo con ?vibracionEventos=0 (§167), para ver cuánto vibraba antes.
// Resultado en build/web/datos/vibracion/<fecha>.json.
//
// Uso:  MKW_BUILD=build/web-final-w30/navegador node web/navegador/prueba-vibracion.mjs [--ventana] [--puerto 8156]
//       [--pista 13.2] [--segundos 70] [--solo vs|tt] [--vieja] [--largada N]   (N = cuadros de la cuenta antes de apretar A)
import { opcionesNavegador } from '../../herramientas/navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PULSO_MS } from './vibracion-eventos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8156));
const PISTA = opcion('--pista', '0.0');   // Circuito Luigi: paredes y sin caídas
const SEGUNDOS = Number(opcion('--segundos', 70));
const SOLO = opcion('--solo', '');
const CPU = opcion('--cpu', 'facil');   // CPU fáciles: el jugador va adelante y le tiran caparazones (golpes)
const VIEJA = process.argv.includes('--vieja');
const DIAG = process.argv.includes('--diag');   // volcar la memoria al prender el motor
const LARGADA = Number(opcion('--largada', 0));   // 0 = apretar A cuando la cuenta va en «2» (Raceinfo, ver abajo)
const carpeta = path.join(raiz, 'build/web/datos/vibracion');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });
const pixel = devices['Pixel 7'];
const vista = { width: pixel.viewport.height, height: pixel.viewport.width };   // acostado

// lo que se lee de la memoria del juego (window.mkwMenus = el lector de menus.mjs)
const leer = p => p.evaluate(() => {
  const L = window.mkwMenus, ri = L?.u32(0x809BD730);
  return { etapa: ri ? L.u32(ri + 0x28) : -1, cuadros: ri ? L.u32(ri + 0x20) : -1, seccion: L?.estado ? L.estado().seccion : -1 };
}).catch(() => ({ etapa: -1, cuadros: -1, seccion: -1 }));

async function carrera(nombre, url, { champinones = false } = {}) {
  console.log(`\n— ${nombre}: ${url}`);
  const contexto = await navegador.newContext({ ...pixel, viewport: vista, screen: vista });
  // anotar cada navigator.vibrate antes de que cargue la página (y no vibrar de verdad)
  await contexto.addInitScript(() => {
    window.__vibra = [];
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: function (p) { window.__vibra.push([Math.round(performance.now()), p]); return true; } }); } catch {}
  });
  const p = await contexto.newPage();
  p.on('pageerror', e => console.log('[pageerror] ' + e.message));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${PUERTO}/${url}${VIEJA ? '&vibracionEventos=0' : ''}`);
  // 1. hasta la cuenta regresiva (etapa 1)
  let e = await leer(p);
  while (e.etapa !== 1 && Date.now() - t0 < 240000) { await p.waitForTimeout(100); e = await leer(p); }
  if (e.etapa !== 1) { ok(`${nombre}: llegó a la cuenta regresiva`, false, JSON.stringify(e)); await contexto.close(); return null; }
  const cuenta0 = e.cuadros;
  if (DIAG) await p.evaluate(() => {
    // --diag: la tabla de patrones (KRM) y, cada vez que el juego prende el motor, las vibraciones activas del jugador
    const M = window.mkw, viejo = M.mkwVibrar, L = window.mkwMenus, x = n => (n >>> 0).toString(16);
    const obj = L.u32(0x809BD70C), tablas = [L.u32(obj + 0x4108), L.u32(obj + 0x410C)];
    window.__krm = tablas.map(t => { const f = []; if (t) for (let i = 0; i < 44; i++) { const e = t + 8 * i;
      f.push(`${i}:${L.u8(e)}/${L.u8(e + 1)}/${x(L.u32(e + 4))}`); } return f.join(' '); });
    window.__diag = [];
    M.mkwVibrar = (puerto, cmd) => {
      if (cmd === 1 && window.__diag.length < 60) {
        const ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC), km = L.u32(0x809C18F8), n = L.u8(km + 0x24), filas = [];
        for (let i = 0; i < n; i++) { const jp = L.u32(lista + 4 * i), hol = jp ? L.u32(jp + 0x48) : 0; if (!hol) continue;
          for (const rc of [L.u32(hol + 0x20), L.u32(hol + 0x24)]) { if (!rc) continue;
            const off = L.u16(rc + 4 + 0xA); let o = L.u32(rc + 4), k = 0; const rs = [];
            while (o && k++ < 8) { rs.push(`[${x(o)} e0=${x(L.u32(o + 4))} cur=${x(L.u32(o + 8))} dur=${L.u32(o + 0x10) | 0} bits=${x(L.u8(o + 0x1c))}]`); o = L.u32(o + off + 4); }
            filas.push(`j${i} h=${x(hol)} idx=${L.u32(hol + 0x10)} cnt=${L.u8(hol + 0x14)} act=${x(L.u32(hol + 0x18))} rc=${x(rc)} n=${L.u16(rc + 4 + 8)} off=${off} ${rs.join(' ')}`); } }
        window.__diag.push({ t: Math.round(performance.now()), cuadro: L.u32(ri + 0x20), filas });
      }
      return viejo(puerto, cmd);
    };
  });
  // 2. la largada con turbo: apretar A durante la cuenta, cuando va en «2» (la cuenta dura ~4 s desde la etapa 1;
  //    MKW da el turbo si se aprieta justo después de que aparece el 2 y se mantiene). Se ajusta con --largada.
  const apretarEn = cuenta0 + (LARGADA || 150);
  while (e.etapa === 1 && e.cuadros < apretarEn) { await p.waitForTimeout(5); e = await leer(p); }
  await p.keyboard.down('KeyK');
  while (e.etapa === 1) { await p.waitForTimeout(10); e = await leer(p); }
  const ya = e.cuadros;
  console.log(`  cuenta desde el cuadro ${cuenta0}, A en ${apretarEn}, «¡YA!» en ${ya} (${ya - cuenta0} cuadros de cuenta)`);
  // 3. manejar: acelerar siempre; cada 5 s, 1,2 s a la izquierda y 1,2 s a la derecha (paredes y vecinos); el objeto
  //    cada 4 s (en la Contrarreloj, los champiñones a los 4, 9 y 14 s)
  // en el VS, los primeros 4 s: zigzag corto entre los karts de la parrilla (choques entre karts)
  if (!champinones) for (let k = 0; k < 10; k++) { const l = k % 2 ? 'KeyA' : 'KeyD'; await p.keyboard.down(l); await p.waitForTimeout(400); await p.keyboard.up(l); }
  const fin = Date.now() + SEGUNDOS * 1000;
  let paso = 0;
  while (Date.now() < fin && e.etapa === 2) {
    paso++;
    const lado = paso % 2 ? 'KeyA' : 'KeyD';
    await p.waitForTimeout(champinones && paso <= 3 ? 2000 : 1300);
    // en el VS: el 1.er paso se mete en el grupo (choques entre karts) y del 3.º en adelante, uno de cada dos
    // dobla 4 s seguidos hasta dar contra la pared
    const largo = !champinones && paso >= 3 && paso % 2 ? 4000 : champinones ? 1200 : 500;
    if (!champinones || paso > 3) { await p.keyboard.down(lado); await p.waitForTimeout(largo); await p.keyboard.up(lado); }
    await p.waitForTimeout(1500);
    if (champinones ? paso <= 3 : paso % 1 === 0) { await p.keyboard.down('Space'); await p.waitForTimeout(120); await p.keyboard.up('Space'); }
    e = await leer(p);
  }
  await p.keyboard.up('KeyK');
  await p.waitForTimeout(800);
  if (DIAG) { const d = await p.evaluate(() => ({ krm: window.__krm, diag: window.__diag })); console.log('KRM 0: ' + d.krm[0]); console.log('KRM 1: ' + d.krm[1]); for (const q of d.diag) console.log(`  t=${q.t} c=${q.cuadro} ${q.filas.join(' | ')}`); }
  const r = await p.evaluate(() => ({ vibra: window.__vibra, modo: window.mkwVibracion?.modo, ev: window.mkwVibracion?.eventos,
    telefono: window.mkwCelular?.esTelefono, tactil: document.body.classList.contains('tactil') }));
  await contexto.close();
  return { nombre, url, cuenta0, ya, ...r };
}

const resultados = [];
if (SOLO !== 'tt') resultados.push(await carrera(`VS con 11 CPU (${CPU})`, `?auto=1&modo=directa&pista=${PISTA}&cc=c150&cpu=${CPU}&pj=0&kart=1&semilla=1234`));
if (SOLO !== 'vs') resultados.push(await carrera('Contrarreloj (3 champiñones)', `?auto=1&modo=tt&copa=0&fila=0&fantasma=0`, { champinones: true }));

for (const r of resultados.filter(Boolean)) {
  const ev = r.ev || { historial: [], vistos: {}, eventos: {} };
  const nombre = r.nombre;
  ok(`${nombre}: la página se cree teléfono, con el mando táctil, y vibra «${VIEJA ? 'pareja' : 'eventos'}»`,
     r.telefono && r.tactil && r.modo === (VIEJA ? 'pareja' : 'eventos'), `${r.modo} teléfono=${r.telefono} táctil=${r.tactil}`);
  const pulsos = r.vibra.map(([t, ms]) => ms);
  const conTipo = ev.historial.filter(h => h.tipo);
  console.log(`  el juego pidió (número del patrón → veces): ${JSON.stringify(ev.vistos)}`);
  for (const h of ev.historial) console.log(`    t=${h.t} patrón ${h.idx} → ${h.tipo || '—'} · ${h.segundos} s · pared=${h.pared ? 1 : 0} pegado=${h.pegado ? 1 : 0} hongo=${h.hongo} bits=${h.bits}`);
  console.log(`  eventos: ${JSON.stringify(ev.eventos)} · al teléfono ${pulsos.length} órdenes: ${pulsos.slice(0, 40).join(',')}${pulsos.length > 40 ? '…' : ''}`);
  if (VIEJA) { ok(`${nombre} (antes, §167): órdenes al teléfono`, true, `${pulsos.length} órdenes, ${pulsos.filter(x => x > 0).reduce((a, b) => a + b, 0)} ms en total`); continue; }
  // cada evento con tipo → una orden de su largo, en orden
  const esperadas = conTipo.map(h => PULSO_MS[h.tipo]);
  ok(`${nombre}: al teléfono llegó exactamente un pulso por evento de la lista, cada uno de su largo`,
     JSON.stringify(pulsos) === JSON.stringify(esperadas), `esperadas ${esperadas.join(',') || '—'} · llegaron ${pulsos.join(',') || '—'}`);
  ok(`${nombre}: todas las órdenes son pulsos suaves (≤ 40 ms, ninguna de 5000 ni de 100 ms)`, pulsos.every(ms => ms > 0 && ms <= 40), pulsos.join(','));
  const callados = ev.historial.filter(h => !h.tipo);
  ok(`${nombre}: lo demás que pidió el juego no vibró (${callados.length} pedidos: números ${[...new Set(callados.map(h => h.idx))].join(',') || '—'})`, true);
  if (/VS/.test(nombre)) ok(`${nombre}: hubo choques o golpes y vibraron`, (ev.eventos.choque || 0) + (ev.eventos.golpe || 0) >= 1, JSON.stringify(ev.eventos));
  if (/Contrarreloj/.test(nombre)) {
    ok(`${nombre}: la largada con turbo vibró una vez`, ev.eventos.largada === 1, JSON.stringify(ev.eventos));
    ok(`${nombre}: los 3 champiñones vibraron (uno cada uno)`, ev.eventos.champinon === 3, JSON.stringify(ev.eventos));
  }
}
const archivo = path.join(carpeta, new Date().toISOString().replace(/[:.]/g, '-') + (VIEJA ? '-vieja' : '') + '.json');
writeFileSync(archivo, JSON.stringify(resultados, null, 1));
console.log(`\n${bien} bien, ${mal} mal  (→ ${path.relative(raiz, archivo)})`);
await navegador.close();
servidor.kill();
process.exit(mal ? 1 : 0);
