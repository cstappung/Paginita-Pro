// Prueba con el juego: ¿las texturas CMPR en BC1 (G6, bitácora §190) se ven igual que antes?
//
// Resumen: dos maneras de mirar la calidad, porque una foto sola no alcanza (dos cuadros nunca son exactamente el mismo):
//   1. TEXTURA POR TEXTURA (la fuerte): con ?texturasBc=verifica aurora decodifica cada BC1 como la tarjeta y la compara
//      texel a texel con la RGBA8 de siempre, en TODAS las texturas CMPR que el juego carga (menús, pista, karts):
//      el peor canal, la PSNR (relación señal/ruido en dB; > 40 dB = invisible) y cuántos texeles pasan de 8 tonos.
//   2. LA FOTO: la misma carrera directa (pista, semilla y personaje fijos) sin y con BC1; en la cuenta de salida (la
//      cámara quieta detrás del kart) se saca una foto del lienzo y se comparan píxel a píxel: lo que cambia es lo que
//      se mueve solo (Lakitu, banderas, el público) más la diferencia de las texturas. Las dos fotos y la de la
//      diferencia (×8) quedan en build/web/datos/g6/ (son del juego: nunca a git).
// Uso:  node web/navegador/prueba-texturas-bc.mjs [--puerto 8168] [--ventana]   → ✓/✗
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const i = args.indexOf('--puerto');
const PUERTO = i >= 0 ? Number(args[i + 1]) : 8168;
const DATOS = path.join(raiz, 'build/web/datos/g6'); fs.mkdirSync(DATOS, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
let bien = 0, mal = 0;
const ok = (txt, si, extra = '') => { si ? bien++ : mal++; console.log(`  ${si ? '✓' : '✗'} ${txt}${extra ? ' — ' + extra : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });

// una carrera: extra = lo que se agrega; devuelve la foto (PNG) de la cuenta de salida y los contadores de G6
async function carrera(nombre, extra) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=0.0&cc=c150&cpu=maximo&semilla=1234&medidor=0${extra}`);
  // la etapa de la carrera: Raceinfo (0x809BD730) +0x28: 0 presentación, 1 cuenta, 2 carrera
  const etapa = () => p.evaluate(() => { try { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return ri ? L.u32(ri + 0x28) : -1; } catch { return -1; } }).catch(() => -1);
  const t0 = Date.now();
  let e = -1;
  while (Date.now() - t0 < 300000 && (e = await etapa()) !== 1) await espera(100);
  let png = null;
  if (e === 1) {
    await espera(1200);   // la cámara ya quieta detrás del kart, a mitad de la cuenta
    png = await p.locator('#canvas').screenshot();
    fs.writeFileSync(path.join(DATOS, `foto-${nombre}.png`), png);
  }
  const cuenta = await p.evaluate(() => window.mkwEstado?.texturasBc?.() ?? null).catch(() => null);
  await ctx.close();
  return { png, cuenta, cuentaSalida: e === 1 };
}

// comparar dos fotos en una página en blanco (el lienzo de Chrome): diferencia por píxel (el peor canal)
async function comparar(a, b) {
  const ctx = await navegador.newContext();
  const p = await ctx.newPage();
  const r = await p.evaluate(async ([A, B]) => {
    const leer = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
    const x = await leer(A), y = await leer(B);
    if (x.width !== y.width || x.height !== y.height) return { error: 'medidas distintas' };
    const n = x.width * x.height, dif = new ImageData(x.width, x.height);
    let suma = 0, mas8 = 0, mas32 = 0, peor = 0, e2 = 0;
    for (let k = 0; k < n; k++) {
      let d = 0;
      for (let c = 0; c < 3; c++) { const v = Math.abs(x.data[k * 4 + c] - y.data[k * 4 + c]); d = Math.max(d, v); e2 += v * v; }
      suma += d; peor = Math.max(peor, d); if (d > 8) mas8++; if (d > 32) mas32++;
      const z = Math.min(255, d * 8); dif.data[k * 4] = z; dif.data[k * 4 + 1] = z; dif.data[k * 4 + 2] = z; dif.data[k * 4 + 3] = 255;
    }
    const c = new OffscreenCanvas(x.width, x.height); c.getContext('2d').putImageData(dif, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/png' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let k = 0; k < bytes.length; k += 32768) s += String.fromCharCode(...bytes.subarray(k, k + 32768));
    const mse = e2 / (n * 3);
    return { media: suma / n, mas8: mas8 / n, mas32: mas32 / n, peor, psnr: mse ? 10 * Math.log10(255 * 255 / mse) : 99, png: btoa(s) };
  }, [a.toString('base64'), b.toString('base64')]);
  await ctx.close();
  if (r.png) { fs.writeFileSync(path.join(DATOS, 'foto-diferencia-x8.png'), Buffer.from(r.png, 'base64')); delete r.png; }
  return r;
}

try {
  // dos «sin» para saber cuánto cambia la foto por sí sola (lo que se mueve en la cuenta) y una «con»
  // «sin» = ?texturasBc=0 (E4c: en el paquete de las chicas van en BC1 por omisión; en los demás 0 = como antes)
  const sin1 = await carrera('sin', '&texturasBc=0');
  const sin2 = await carrera('sin-otra', '&texturasBc=0');
  const con = await carrera('con', '&texturasBc=verifica');
  console.log('contadores sin:', JSON.stringify(sin1.cuenta), ' con:', JSON.stringify(con.cuenta));
  ok('las tres carreras llegaron a la cuenta de salida', sin1.cuentaSalida && sin2.cuentaSalida && con.cuentaSalida);
  ok('sin ?texturasBc nada sube en BC1 (como antes)', sin1.cuenta && sin1.cuenta.bc === 0);
  const c = con.cuenta || {};
  ok('con ?texturasBc las CMPR suben en BC1', c.bc > 0, `${c.bc} de ${c.vistas} CMPR (${c.no} se quedan en RGBA8), ${c.kbBc} KB en vez de ${c.kbRgba} KB`);
  ok('la tarjeta guarda ~8 veces menos en esas texturas', c.kbRgba / Math.max(1, c.kbBc) > 7, `×${(c.kbRgba / Math.max(1, c.kbBc)).toFixed(2)}`);
  ok('textura por textura: PSNR de 40 dB o más contra la RGBA8 de siempre (invisible a simple vista)', c.psnr >= 40,
     `${c.psnr} dB en ${c.milTexeles} mil texeles, peor canal ${c.peor}, texeles a más de 8 tonos ${c.mas8} (${(100 * c.mas8 / Math.max(1, c.milTexeles * 1000)).toFixed(3)} %)`);
  ok('textura por textura: menos del 1 % de los texeles cambia más de 8 tonos', c.mas8 / Math.max(1, c.milTexeles * 1000) < 0.01);
  if (sin1.png && sin2.png && con.png) {
    const solo = await comparar(sin1.png, sin2.png);   // lo que cambia la foto sola (sin BC1 en las dos)
    const bc = await comparar(sin1.png, con.png);
    const r = x => `media ${x.media.toFixed(2)}, PSNR ${x.psnr.toFixed(1)} dB, > 8 tonos ${(100 * x.mas8).toFixed(2)} %, > 32 tonos ${(100 * x.mas32).toFixed(2)} %`;
    console.log('  foto sin/sin:', r(solo)); console.log('  foto sin/con:', r(bc));
    // la diferencia con BC1 no puede ser mucho mayor que la que la foto ya tiene sola (+0,5 % de píxeles a más de 8 tonos)
    ok('la foto con BC1 difiere de la de siempre casi como dos fotos de siempre entre sí', bc.mas8 <= solo.mas8 + 0.005,
       `${(100 * bc.mas8).toFixed(2)} % contra ${(100 * solo.mas8).toFixed(2)} % (fotos en build/web/datos/g6/)`);
  } else ok('se sacaron las fotos', false);
} finally {
  await navegador.close().catch(() => {});
  servidor.kill();
}
console.log(`fin: ${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
