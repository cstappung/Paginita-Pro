// W10 de la etapa 1 del plan v4 (bitácora §207.4): ¿el Worker del dibujo dibuja lo mismo que dibujaría el de la carrera?
//
// Resumen: abre w10-dos.html (dos Workers, dos copias del programa de MKW_W10_COMPILAR=1) con la carrera directa:
//   1) comprobar (?verifica=1): A corre la carrera Y dibuja en su lienzo como siempre (modo 10); B dibuja en el suyo con
//      las cajas de A (modo 8; las cajas llevan solo lo que escribió la lógica, no el dibujo de A). En el cuadro de
//      lógica N (?alto=N) A se queda quieto y B presenta lo último: las dos fotos tienen que ser la misma imagen (menos
//      del 0,5 % de los píxeles con más de 2 niveles, desde el 32 % del alto, como prueba-foto-igual.mjs);
//   2) medir (--medir): A sin dibujo ni presentar (modo 9) con el tramo fijo §163 sin tope: los cuadros de lógica por
//      segundo de A con B dibujando de verdad al lado, las imágenes por segundo de B y cuánto esperó A a B.
// Como comprobar un tablero repetidor: la lámpara del tablero principal y la del repetidor tienen que mostrar lo mismo.
// Uso:  MKW_BUILD=build/web-w10b/navegador node web/navegador/prueba-w10-dos.mjs [--alto 900,1500] [--medir]
//         [--pista 0.0] [--extra "&lastre=…"] [--chrome "--js-flags=…"] [--puerto 8185] [--ventana]
//       (las fotos quedan en build/web/datos/w10/: son imágenes del juego, nunca a git)
import { opcionesNavegador } from '../../herramientas/navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.findIndex(a => a === `--${n}` || a.startsWith(`--${n}=`)); if (i < 0) return d;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1]; };
const PUERTO = Number(opcion('puerto', 8185)), PISTA = opcion('pista', '0.0'), EXTRA = opcion('extra', '');
const ALTOS = String(opcion('alto', '900')).split(',').map(Number).filter(Boolean);
const MEDIR = args.includes('--medir'), SOLO_MEDIR = args.includes('--solo-medir');
const SOLO_A = args.includes('--solo-a');
// (§240) --real = el caso de verdad: A sin dibujar (modo 9) y B dibuja; la foto de B en el cuadro N contra la de una corrida
// normal (solo A, el juego de siempre en un Worker, dibuja él mismo) en el mismo cuadro, con ?reloj=fijo (la misma carrera)
const REAL = args.includes('--real');   // (§240: medir la base: solo A, el juego de siempre en un Worker)
const CHROME = opcion('chrome', '');
const DESDE = 0.32;
const carpeta = path.join(raiz, 'build/web/datos/w10');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const ventana = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${ventana[0]},${ventana[1]}`,
         ...(CHROME ? CHROME.split(' ') : [])] });
const BASE = `modo=directa&pista=${PISTA}&semilla=1234&soloCpu=1&cpu=maximo${EXTRA}`;

async function abrir(consulta) {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 420 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('console', m => { const t = m.text(); if (/WGSL|ShaderModule|Invalid ShaderModule/i.test(t)) errores.push(t.slice(0, 200)); });
  pagina.on('pageerror', e => errores.push('página: ' + e.message));
  await pagina.goto(`http://127.0.0.1:${PUERTO}/w10-dos.html?${consulta}`);
  return { contexto, pagina, errores };
}
const estados = p => p.evaluate(() => ({ a: window.mkwEstadoA, b: window.mkwEstadoB, reg: window.mkwRegistro.slice(-12) }));

// la diferencia de dos PNG (decodificados en el navegador): píxeles con más de 2 niveles en algún canal
async function comparar(pagina, a, b) {
  return pagina.evaluate(async ([x, y, desde]) => {
    const leer = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
      const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const A = await leer(x), B = await leer(y);
    if (A.width !== B.width || A.height !== B.height) return { distintoTamano: true };
    let mas2 = 0, max = 0, oscuros = 0, mas2Todo = 0;
    const n = A.width * A.height, fila0 = Math.floor(A.height * desde), nZona = (A.height - fila0) * A.width;
    for (let p = 0; p < n * 4; p += 4) {
      let d = 0;
      for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[p + k] - B.data[p + k]));
      if (d > 2) mas2Todo++;
      if (B.data[p] + B.data[p + 1] + B.data[p + 2] < 15) oscuros++;
      if (p / 4 < fila0 * A.width) continue;
      if (d > 2) mas2++;
      if (d > max) max = d;
    }
    return { pct: mas2 * 100 / nZona, pctTodo: mas2Todo * 100 / n, max, pctOscuro: oscuros * 100 / n, ancho: A.width, alto: A.height };
  }, [a.toString('base64'), b.toString('base64'), DESDE]);
}

try {
  if (REAL && !SOLO_MEDIR) for (const n of ALTOS) {
    console.log(`— el caso real, cuadro ${n}: la corrida normal (solo A dibuja) contra el par (A sin dibujo, B dibuja)`);
    const foto = async (consulta, lienzo, listo) => {
      const { contexto, pagina, errores } = await abrir(consulta);
      const llego = await pagina.waitForFunction(listo, null, { timeout: 420000, polling: 250 }).then(() => true, () => false);
      await espera(1500);
      const e = await estados(pagina);
      const png = llego ? await pagina.locator(lienzo).screenshot() : null;
      // (§240) la huella de cada página de la Wii en cada Worker (modo 0 = normal, 8 = B), para ver qué difiere
      const huellas = {};
      if (llego && args.includes('--huellas-mem')) for (const w of pagina.workers()) {
        const r = await w.evaluate(() => {
          const M = globalThis.mkw; if (!M?._mkw_w10_host) return null;
          const modo = M._mkw_w10_dato(15), out = new Array(38912).fill(0), h8 = M.HEAPU8;
          for (let p = 0; p < 38912; p++) {
            const a = M._mkw_w10_host(p); if (!a) continue;
            let x = 2166136261; const v = new Uint32Array(h8.buffer, a, 1024);
            for (let k = 0; k < 1024; k++) x = Math.imul(x ^ v[k], 16777619);
            out[p] = x >>> 0;
          }
          return { modo, out };
        }).catch(() => null);
        if (r) huellas[r.modo] = r.out;
      }
      return { contexto, pagina, errores, llego, e, png, huellas };
    };
    const normal = await foto(`${BASE}&soloA=1&alto=${n}&reloj=fijo`, '#lienzoA', () => !!window.mkwEstadoA?.alto);
    ok(`real ${n}: la corrida normal quedó quieta en el cuadro`, normal.llego, `A en ${normal.e.a?.alto}${normal.errores.length ? ' | ' + normal.errores[0] : ''}`);
    const par = await foto(`${BASE}&alto=${n}&reloj=fijo`, '#lienzoB', () => window.mkwEstadoA?.alto && (window.mkwEstadoB?.w10?.repetidos ?? 0) >= 1);
    ok(`real ${n}: el par quedó quieto y B recibió la vuelta de más`, par.llego,
       `A en ${par.e.a?.alto}; B pegó ${par.e.b?.w10?.cuadros} cuadros, malos ${par.e.b?.w10?.malos}, deshechas ${par.e.b?.w10?.deshechas}, palabras ${par.e.b?.w10?.palabras}${par.errores.length ? ' | ' + par.errores[0] : ''}`);
    if (normal.png && par.png) {
      writeFileSync(path.join(carpeta, `real-normal-${n}.png`), normal.png); writeFileSync(path.join(carpeta, `real-B-${n}.png`), par.png);
      const r = await comparar(par.pagina, normal.png, par.png);
      ok(`real ${n}: B dibujó la misma imagen que la corrida normal (menos del 0,5 % con más de 2 niveles, desde el 32 % del alto)`,
         !r.distintoTamano && r.pct < 0.5, `${r.pct?.toFixed(3)} % distintos, máximo ${r.max} niveles; la imagen entera ${r.pctTodo?.toFixed(3)} %`);
    }
    const hn = normal.huellas[0], hb = par.huellas[8];
    if (hn && hb) {
      const dif = []; for (let p = 0; p < hn.length; p++) if (hn[p] !== hb[p]) dif.push(p);
      const dir = p => (p < 6144 ? 0x80000000 + p * 4096 : 0x90000000 + (p - 6144) * 4096) >>> 0;
      const rangos = []; for (const p of dif) { const r = rangos[rangos.length - 1]; if (r && r[1] === p - 1) r[1] = p; else rangos.push([p, p]); }
      console.log(`  memoria normal contra B en ${n}: ${dif.length} páginas distintas en ${rangos.length} rangos`);
      writeFileSync(path.join(carpeta, `real-difpag-${n}.txt`), rangos.map(([a, b]) => `${dir(a).toString(16)}-${(dir(b) + 4096).toString(16)} ${b - a + 1}`).join('\n'));
    }
    await normal.contexto.close(); await par.contexto.close();
  }
  if (!SOLO_MEDIR && !REAL) for (const n of ALTOS) {
    console.log(`— comprobar: A dibuja y manda la caja, B dibuja con la caja; los dos quietos en el cuadro ${n}`);
    const { contexto, pagina, errores } = await abrir(`${BASE}&verifica=1&alto=${n}&reloj=fijo`);
    const llego = await pagina.waitForFunction(() => window.mkwEstadoA?.alto && (window.mkwEstadoB?.w10?.repetidos ?? 0) >= 1,
      null, { timeout: 420000, polling: 250 }).then(() => true, () => false);
    await espera(1500);   // que B termine de presentar la vuelta de más
    const e = await estados(pagina);
    ok(`cuadro ${n}: A quedó quieto y B recibió la vuelta de más`, llego, `A en ${e.a?.alto}, fases ${e.a?.fase}/${e.b?.fase}${e.a?.error || e.b?.error ? ' ERROR ' + (e.a.error || e.b.error).slice(0, 200) : ''}`);
    ok(`cuadro ${n}: B pegó cajas sin tramos malos`, (e.b?.w10?.cuadros ?? 0) > 100 && (e.b?.w10?.malos ?? 1) === 0,
       `B pegó ${e.b?.w10?.cuadros} cuadros (${e.b?.w10?.cajas} cajas, ${((e.b?.w10?.bytes ?? 0) / 1048576).toFixed(1)} MB), malos ${e.b?.w10?.malos}; A mandó ${e.a?.w10?.mandadas}`);
    ok(`cuadro ${n}: sin errores de sombreadores ni de la página`, !errores.length, errores.slice(0, 2).join(' | '));
    if (llego) {
      const pa = await pagina.locator('#lienzoA').screenshot(), pb = await pagina.locator('#lienzoB').screenshot();
      writeFileSync(path.join(carpeta, `dos-A-${n}.png`), pa); writeFileSync(path.join(carpeta, `dos-B-${n}.png`), pb);
      const r = await comparar(pagina, pa, pb);
      ok(`cuadro ${n}: la foto de B no está vacía (menos del 60 % negro)`, r.pctOscuro < 60, `${r.pctOscuro?.toFixed(1)} % oscuro, ${r.ancho}×${r.alto}`);
      ok(`cuadro ${n}: B dibujó la misma imagen que A (menos del 0,5 % con más de 2 niveles, desde el 32 % del alto)`,
         !r.distintoTamano && r.pct < 0.5, `${r.pct?.toFixed(3)} % distintos, máximo ${r.max} niveles; la imagen entera ${r.pctTodo?.toFixed(3)} %`);
    } else console.log(e.reg.join('\n'));
    await contexto.close();
  }
  if (MEDIR || SOLO_MEDIR) {
    console.log('— medir: A sin dibujo ni presentar (modo 9), B dibuja; el tramo fijo §163 sin tope');
    const { contexto, pagina, errores } = await abrir(`${BASE}&sinTope=1&tramo=600-2400${SOLO_A ? '&soloA=1' : ''}`);
    const llego = await pagina.waitForFunction(() => window.mkwEstadoA?.tramo?.resultado, null, { timeout: 900000, polling: 500 })
      .then(() => true, () => false);
    const e = await estados(pagina);
    const r = e.a?.tramo?.resultado;
    ok(SOLO_A ? 'medir: A (solo, dibujando él mismo) cerró el tramo' : 'medir: A cerró el tramo con B dibujando', llego && !!r, r ? '' : `A ${JSON.stringify({ f: e.a?.fase, l: e.a?.logica, w: e.a?.w10, t: e.a?.tramo })} B ${JSON.stringify({ f: e.b?.fase, l: e.b?.logica, w: e.b?.w10, err: e.b?.error })} | ` + e.reg.filter(x => !/audio/.test(x)).slice(-12).join(' | ').slice(0, 1500));
    if (r) {
      console.log(`  A: ${r.logicaPorSeg} cuadros de lógica/s; por cuadro: trabajo ${r.porCuadro.trabajo} ms, giro ${r.porCuadro.giro}, espera ${r.porCuadro.esperaRuntime}`);
      console.log(`  A esperó a B: ${Math.round(e.a.w10?.msEspera ?? 0)} ms en ${e.a.w10?.esperas ?? 0} esperas; mandó ${e.a.w10?.mandadas} cajas (${((e.a.w10?.bytes ?? 0) / 1048576).toFixed(1)} MB)`);
      console.log(`  B: ${Math.round(e.b?.fps ?? 0)} imágenes/s ahora; pegó ${e.b?.w10?.cuadros} cuadros; esperó cajas ${Math.round(e.b?.w10?.msEspera ?? 0)} ms`);
      writeFileSync(path.join(carpeta, `dos-medir${SOLO_A ? '-soloA' : ''}${EXTRA ? '-con-extra' : ''}.json`), JSON.stringify({ extra: EXTRA, chrome: CHROME, tramo: r, a: e.a?.w10, b: e.b?.w10 }, null, 1));
    }
    ok('medir: sin errores de la página', !errores.length, errores.slice(0, 2).join(' | '));
    await contexto.close();
  }
} catch (e) {
  ok('la prueba terminó sin errores', false, e?.stack || String(e));
}
console.log(`${bien} bien, ${mal} mal`);
await navegador.close(); servidor.kill();
process.exit(mal ? 1 : 0);
