// Prueba con el juego de verdad: «los fantasmas iguales» del plan de rendimiento (bitácora §182 y §184). Dos programas
// del juego (A y B: por ejemplo con y sin una optimización del motor) corren la misma Contrarreloj contra el fantasma
// experto de Retro Rewind, sin que nadie toque el mando, y se compara lo que hace el fantasma cuadro por cuadro.
//
// Resumen: un fantasma es una grabación de botones; el juego la vuelve a «manejar» con su física. Si una optimización
// cambiara aunque sea el último bit de una cuenta de coma flotante, el fantasma se iría separando (otra línea, otro
// tiempo). Es como reproducir la misma cinta en dos grabadores: si la velocidad de uno difiere en 0,1 %, al final de la
// canción ya no coinciden. Lo que se compara, para el jugador (quieto) y el fantasma: su ficha de la carrera
// (RaceinfoPlayer, 0x54 bytes: avance, puesto, vuelta, puntos de control, sin los punteros), leída en cada cuadro de
// lógica (Raceinfo +0x20) que las dos corridas alcanzaron a leer, y la ficha al final, cuando el fantasma cruzó la meta.
// La sala (prueba-sincro --build-b) compara lo mismo con 12 karts y objetos; esto agrega el camino de los fantasmas.
//
// Uso:  MKW_BUILD=<A>/navegador node web/navegador/prueba-fantasma-igual.mjs --build-b=<B>/navegador
//         [--copa 0 --fila 0] [--segundos 240] [--extra-a=&…] [--extra-b=&…] [--puerto 8176] [--ventana] [--ignorar 0x4,0x4c]
//       --ignorar = desplazamientos de la ficha que no se comparan (los que cambian de una corrida a otra aunque el
//       programa sea el mismo: se ven con A contra A; la prueba los imprime cuando se separa)
//       → build/web/datos/fantasma-igual/<A>-contra-<B>.json
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
const A = process.env.MKW_BUILD || 'build/web/navegador';
const B = opcion('build-b', null);
if (!B) { console.log('falta --build-b=<carpeta del otro programa>'); process.exit(2); }
const PUERTO = Number(opcion('puerto', 8176)), COPA = opcion('copa', '0'), FILA = opcion('fila', '0');
const SEGUNDOS = Number(opcion('segundos', 240));
// §196 (W1): --extra-a=&… y --extra-b=&… = parámetros solo para esa corrida (p. ej. el mismo programa con --extra-b=&sumidero=2)
const EXTRA_A = opcion('extra-a', ''), EXTRA_B = opcion('extra-b', '');
// +0x4 y +0x4c: el constructor de la ficha (func_80533ED8, RaceinfoPlayer) no los escribe nunca: quedan con lo que había
// antes en esa memoria, distinto en cada corrida (bitácora §184.1). --ignorar "" = compararlos también
const IGNORAR = String(opcion('ignorar', '0x4,0x4c')).split(',').filter(Boolean).map(x => Number(x));
// §257 (W30): --crudas N = cuántos cuadros guardan la ficha entera (600 por omisión; 100000 = toda la carrera, para medir
// cuánto se separa el avance del fantasma y no solo en qué cuadro)
const CRUDAS = Number(opcion('crudas', 600));
const carpeta = path.join(raiz, 'build/web/datos/fantasma-igual');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

// el servidor da /build/ de A a quien no pide &build=b, y el de B a quien sí (servidor.mjs, MKW_BUILD_B)
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_BUILD: A, MKW_BUILD_B: B } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] });   // (la pantalla 3, la de 144 Hz)

// una corrida: perfil nuevo (contexto vacío = sin partidas ni fantasmas propios: Pulsar carga el experto)
async function correr(etiqueta, extra) {
  const contexto = await navegador.newContext({ viewport: { width: 1000, height: 1100 } });
  const pagina = await contexto.newPage();
  const url = `http://127.0.0.1:${PUERTO}/?auto=1&modo=tt&copa=${COPA}&fila=${FILA}&fantasmaPagina=0${extra}`;
  await pagina.goto(url);
  await pagina.waitForFunction(() => (window.mkwEstado?.cuadros || 0) >= 60, null, { timeout: 180000, polling: 250 });
  // la etapa (Raceinfo 0x809BD730 +0x28: 2 = corriendo) y cuántos jugadores tiene la carrera (Raceinfo +0x10, u8)
  const t0 = Date.now();
  let e = -1;
  while (Date.now() - t0 < 180000) {
    e = await pagina.evaluate(() => { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return ri ? L.u32(ri + 0x28) : -1; });
    if (e === 2) break;
    await espera(200);
  }
  // muestras dentro de la página, cada 4 ms: { cuadro de lógica: [huella del jugador, huella del fantasma] }
  const res = await pagina.evaluate(async ({ segundos, ignorar, crudasMax }) => {
    const L = window.mkwMenus;
    // la ficha como [desplazamiento, valor], sin los punteros (cambian con dónde quedó cada cosa en la memoria) ni lo de --ignorar
    const ficha = pl => { const v = []; for (let o = 0; o < 0x54; o += 4) { const x = L.u32(pl + o); if (x >= 0x80000000 && x < 0x94000000) continue;
      if (ignorar.includes(o)) continue; v.push(o, x); } return v; };
    const hash = v => { let h = 2166136261; for (const x of v) h = Math.imul(h ^ x, 16777619); return h >>> 0; };
    const muestras = {}, crudas = {}, t0 = performance.now();
    let llego = false, ultimo = -1, fin = null;
    while (performance.now() - t0 < segundos * 1000) {
      const ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
      const cuadro = L.u32(ri + 0x20);
      if (cuadro !== ultimo) {
        const yo = ficha(L.u32(lista)), fan = ficha(L.u32(lista + 4));
        muestras[cuadro] = [hash(yo), hash(fan)];
        if (Object.keys(crudas).length < crudasMax) crudas[cuadro] = [yo, fan];   // las fichas enteras del principio, para ver qué se separa
        ultimo = cuadro;
        // RaceinfoPlayer +0x38 bit 2 = cruzó la meta (§100)
        if (!llego && (L.u32(L.u32(lista + 4) + 0x38) & 4)) { llego = true; fin = { cuadro, yo, fan };
          // §257: el tiempo de meta del fantasma (Timer de +0x40: minutos u16 +4, segundos u8 +6, milésimas u16 +8)
          const t = L.u32(L.u32(lista + 4) + 0x40);
          if (t >= 0x80000000 && t < 0x94000000) { const w = L.u32(t + 4), w2 = L.u32(t + 8);
            fin.tiempo = { min: w >>> 16, s: (w >>> 8) & 0xff, ms: w2 >>> 16 }; } }
        if (llego && cuadro > fin.cuadro + 120) break;   // 2 s más, ya quieto
      }
      await new Promise(r => setTimeout(r, 4));
    }
    return { muestras, crudas, llego, fin };
  }, { segundos: SEGUNDOS, ignorar: IGNORAR, crudasMax: CRUDAS });
  console.log(`  ${etiqueta}: corriendo a los ${((Date.now() - t0) / 1000).toFixed(0)} s (etapa ${e}); ${Object.keys(res.muestras).length} cuadros leídos; el fantasma ${res.llego ? 'cruzó la meta en el cuadro ' + res.fin.cuadro : 'NO llegó'}`);
  await contexto.close();
  return { ...res, etapa: e };
}

let a = null, b = null;
try {
  a = await correr('A ' + A, EXTRA_A);
  b = await correr('B ' + B, '&build=b' + EXTRA_B);
  ok('las dos Contrarrelojes corrieron (etapa 2)', a.etapa === 2 && b.etapa === 2, `A ${a.etapa}, B ${b.etapa}`);
  ok('el fantasma experto cruzó la meta en las dos', a.llego && b.llego);
  const comunes = Object.keys(a.muestras).filter(c => c in b.muestras).map(Number).sort((x, y) => x - y);
  const distintos = comunes.filter(c => a.muestras[c][1] !== b.muestras[c][1]);
  const distintosYo = comunes.filter(c => a.muestras[c][0] !== b.muestras[c][0]);
  ok('suficientes cuadros leídos por las dos (más de la mitad de la carrera)', comunes.length > (a.fin?.cuadro || 0) / 2,
     `${comunes.length} en común de ${Object.keys(a.muestras).length} y ${Object.keys(b.muestras).length}`);
  // qué desplazamientos de la ficha se separan en el primer cuadro distinto que las dos guardaron entera
  const primero = comunes.find(c => (a.muestras[c][0] !== b.muestras[c][0] || a.muestras[c][1] !== b.muestras[c][1]) && a.crudas[c] && b.crudas[c]);
  if (primero !== undefined) for (const [k, quien] of [[0, 'jugador'], [1, 'fantasma']]) {
    const fa = a.crudas[primero][k], fb = b.crudas[primero][k], difs = [];
    for (let i = 0; i < Math.max(fa.length, fb.length); i += 2)
      if (fa[i] !== fb[i] || fa[i + 1] !== fb[i + 1]) difs.push(`+0x${(fa[i] ?? fb[i]).toString(16)}: ${fa[i + 1]?.toString(16)} / ${fb[i + 1]?.toString(16)}`);
    if (difs.length) console.log(`  ${quien}, cuadro ${primero}: ${difs.join(' · ')}`);
  }
  ok('el fantasma hace lo mismo en cada cuadro en común', distintos.length === 0,
     distintos.length ? `se separa en el cuadro ${distintos[0]} (${distintos.length} distintos)` : `${comunes.length} iguales`);
  ok('el jugador quieto también (el mismo kart, la misma pista)', distintosYo.length === 0,
     distintosYo.length ? `se separa en el cuadro ${distintosYo[0]}` : `${comunes.length} iguales`);
  ok('el fantasma cruza la meta en el mismo cuadro y con la misma ficha', !!(a.fin && b.fin && a.fin.cuadro === b.fin.cuadro &&
     a.fin.fan.join() === b.fin.fan.join()), `A ${a.fin?.cuadro}, B ${b.fin?.cuadro}`);
} catch (err) {
  ok('la prueba corrió entera', false, String(err?.message || err).slice(0, 300));
} finally {
  const nombre = `${path.basename(path.dirname(A))}-contra-${path.basename(path.dirname(B))}`;
  writeFileSync(path.join(carpeta, nombre + '.json'), JSON.stringify({ A, B, IGNORAR, a, b }, null, 1));
  await navegador.close().catch(() => {});
  servidor.kill();
  console.log(`\n${bien} bien, ${mal} mal  (→ build/web/datos/fantasma-igual/${nombre}.json)`);
  process.exit(mal ? 1 : 0);
}
