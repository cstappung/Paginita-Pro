// ¿Qué cosa de la pista hace dibujar de más en la sala? (bitácora §269b)
//
// Resumen: en la sala, la lógica ve «todo a la vista» (§61: cada ClipInfo marcada como visible y cerca, igual en todas las
// consolas). Medido: así la sala dibuja una pasada de más (29 dibujos) y dos copias diminutas de la pantalla que el Single
// Player no hace, y no se arregla devolviendo las marcas de verdad durante el dibujo (§179/§269b): lo decide la lógica.
// Esta herramienta abre la sala de 2 (dos perfiles, el puente de la señal), y en la carrera, con el instrumento
// mkw_clip_reales(a, b) de lockstep_nativo.cpp (esas ClipInfo quedan con sus marcas de verdad también para la lógica:
// solo para buscar), parte la lista por la mitad una y otra vez y mide los dibujos y las copias por imagen
// (perfil-gpu.mjs) hasta dar con la ClipInfo (o las pocas) que causan lo de más. Al final dice su número, su dirección y
// los 0x24 bytes de cada una, y las primeras palabras de lo que la rodea (para saber de qué objeto es).
// Uso:  MKW_BUILD=build/web-269n/navegador node herramientas/buscar-clip.mjs [--pista 0.0] [--puerto 8177]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PISTA = opcion('--pista', '0.0'), PUERTO = Number(opcion('--puerto', 8177));
const espera = ms => new Promise(r => setTimeout(r, ms));
const puente = puenteSenal();
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
const sala = 'bc' + Date.now().toString(36), uids = ['j0' + sala, 'j1' + sala], paginas = [];
for (let i = 0; i < 2; i++) {
  const ctx = await navegador.newContext({ viewport: i === 0 ? { width: 1280, height: 720 } : { width: 320, height: 180 } });
  await puente.agregar(ctx);
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTA}&semilla=4242&cc=c150&cpu=normal&red=malla&senal=canal&sala=${sala}&uid=${uids[i]}&sincro=${uids.join(',')}` +
    (i === 0 ? '&gpu=1&ventanaGpu=0' : '&saltarDibujo=60&saltarDibujoModo=2'));
  paginas.push(p);
  await espera(1500);
}
const etapa = p => p.evaluate(() => { const L = window.mkwMenus, s = L?.estado?.(); if (!s) return -1; const ri = L.u32(0x809BD730); return s.seccion === 0x20 && ri ? L.u32(ri + 0x28) : -1; }).catch(() => -1);
for (const lim = Date.now() + 8 * 60000; Date.now() < lim;) { const e = await Promise.all(paginas.map(etapa)); if (e.every(x => x >= 2)) break; await espera(500); }
for (const p of paginas) await p.keyboard.down('KeyK');
await espera(6000);
const A = paginas[0];
const n = await A.evaluate(() => window.mkw._mkw_clip_n());
console.log(`ClipInfo en la lista: ${n}`);
// los dibujos y las copias por imagen en 2,5 s con [a, b) de verdad (después de 1 s para asentarse)
const medir = (a, b) => A.evaluate(async ([a, b]) => {
  window.mkw._mkw_clip_reales(a, b);
  await new Promise(r => setTimeout(r, 1000));
  const f0 = window.mkwPerfilGpu.foto(), c0 = window.mkwCuadros();
  await new Promise(r => setTimeout(r, 2500));
  const f1 = window.mkwPerfilGpu.foto(), img = Math.max(1, window.mkwCuadros() - c0);
  return { dibujos: (f1.dibujos - f0.dibujos) / img, copias: (f1.copias - f0.copias) / img, pasadas: (f1.pasadas - f0.pasadas) / img };
}, [a, b]);
const nada = await medir(0, 0), todas = await medir(0, n);
console.log(`todo a la vista: ${JSON.stringify(nada)} · todas de verdad: ${JSON.stringify(todas)}`);
const sobra = nada.dibujos - todas.dibujos;
// la búsqueda: [a, b) baja los dibujos de más; se parte en dos y se sigue por la mitad que los baja (si las dos los bajan
// en parte, hay varias: se anota y se sigue por la que más)
let a = 0, b = n; const pasos = [];
while (b - a > 1) {
  const m = (a + b) >> 1;
  const izq = await medir(a, m), der = await medir(m, b);
  const bi = nada.dibujos - izq.dibujos, bd = nada.dibujos - der.dibujos;
  pasos.push({ a, m, b, bajaIzq: +bi.toFixed(1), bajaDer: +bd.toFixed(1), copiasIzq: +izq.copias.toFixed(2), copiasDer: +der.copias.toFixed(2) });
  console.log(`  [${a}, ${m}) baja ${bi.toFixed(1)} dibujos (copias ${izq.copias.toFixed(2)}) · [${m}, ${b}) baja ${bd.toFixed(1)} (copias ${der.copias.toFixed(2)})`);
  if (Math.max(bi, bd) < Math.min(5, sobra / 3)) { console.log('  (ninguna mitad sola baja lo de más: está repartido)'); break; }
  if (bi >= bd) b = m; else a = m;
}
const fin = await medir(a, b);
console.log(`la ClipInfo ${a}${b - a > 1 ? `–${b - 1}` : ''} sola: ${JSON.stringify(fin)} (todo a la vista ${nada.dibujos.toFixed(1)}, todas de verdad ${todas.dibujos.toFixed(1)})`);
const datos = await A.evaluate(([a, b]) => {
  const L = window.mkwMenus, r = [];
  for (let i = a; i < Math.min(b, a + 4); i++) {
    const d = window.mkw._mkw_clip_dir(i), bytes = [];
    for (let k = 0; k < 0x24; k += 4) bytes.push(L.u32(d + k).toString(16).padStart(8, '0'));
    // (la primera palabra suele ser el dueño o su modelo: lo que hay ahí y su primera palabra, la tabla de métodos)
    const w0 = L.u32(d), w0v = w0 > 0x80000000 && w0 < 0x81800000 ? L.u32(w0).toString(16) : '-';
    r.push({ i, dir: d.toString(16), bytes: bytes.join(' '), w0: w0.toString(16), w0v });
  }
  return r;
}, [a, b]);
for (const d of datos) console.log(`  ClipInfo ${d.i} en 0x${d.dir}: ${d.bytes} · palabra 0 → 0x${d.w0} (→ 0x${d.w0v})`);
await navegador.close(); servidor.kill();
process.exit(0);
