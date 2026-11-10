// Mide el wasm del juego en Node en el tramo fijo de la carrera, varias veces y con las condiciones controladas
// (N13, bitácora §166: «¿por qué el wasm de Node varía ±15 % entre corridas?»).
//
// Resumen: cada corrida parte de una partida nueva (una carpeta de datos vacía), maneja el juego con el guion de
// botones de §165 hasta la carrera de 12 y mide el tramo 600–2400 (ms de trabajo por cuadro de lógica, lo que imprime
// aurora_manual.cpp). Mientras tanto anota lo que puede mover el número:
//   - el recolector de V8 (--trace-gc): cuántas veces entró y cuántos ms se llevó DENTRO del tramo;
//   - el rendimiento del procesador (contador de Windows «% Processor Performance»: 100 % = la frecuencia nominal;
//     más = turbo, menos = ahorro de energía), un dato por segundo durante el tramo;
//   - el plan de energía.
// Con --fijo el proceso va con prioridad alta y atado a 4 núcleos (uno por núcleo físico, sin el 0, que atiende las
// interrupciones): así otro programa no le roba el núcleo ni lo mueve de un núcleo a otro.
// Al final imprime la mediana, la media y la dispersión (± = (máx − mín) / 2 / mediana).
//
// Uso:  node herramientas/medir-node-estable.mjs [--corridas 5] [--fijo] [--mascara 0x154] [--v8 "--no-liftoff"]
//                                                [--etiqueta X] [--cuadros 4900] [--nativo v3] [--alternar v3]
//       --alternar v3 = la razón nativo/wasm por pares intercalados (la forma de medir de §166)
//       --intercalar antes=build/web-motor-base/node,despues=build/web-motor/node (§170): el antes y el después de un
//         (§181: «despues=ruta@MKW_CALIENTE=1» = ese lado con sus variables de entorno; el mismo programa en los dos lados)
//         cambio en la MISMA tanda; cada vuelta corre los dos (el orden se da vuelta cada vuelta: A B, B A, …) y da la
//         razón de cada pareja (después ÷ antes) y su mediana. Con --nativo-tambien v3 la vuelta suma el programa de
//         Windows (la razón wasm/nativo de cada uno, sin la deriva de la hora); con una lista, uno por lado
//         (--nativo-tambien v3,v093-v3: el antes contra el nativo v3 y el después contra el v093-v3)
//       --tope-min N: una corrida que pasa de N minutos se corta (su propio proceso, nada más) y cuenta como fallada
//       Cada corrida (Node o Windows) parte con su partida de RR limpia: build/aislado/medir-node-estable (§170/§175,
//         herramientas/partida-aislada.mjs); --partida-compartida = la de terceros/RetroRewind, como antes
//       → build/web/datos/node-estable/<etiqueta>.json
// Nunca correr dos a la vez ni al lado de otra medida (comparten el procesador).
import { spawn, execFile, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partidaAislada } from './partida-aislada.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const corridas = Number(arg('--corridas', 5));
const fijo = process.argv.includes('--fijo');
const mascara = Number(arg('--mascara', '0x154'));          // núcleos lógicos 2, 4, 6 y 8
const banderasV8 = (arg('--v8', '') || '').split(' ').filter(Boolean);
const etiqueta = arg('--etiqueta', fijo ? 'fijo' : 'libre');
// 6000 (antes 4900): con la partida de RR limpia (§170/§175) el guion pasa por crear la licencia y la cuenta de salida
// empieza en el cuadro ~3180; el tramo (lógica 600-2400) termina cerca del 5600
const cuadros = arg('--cuadros', '6000');
let nativo = arg('--nativo', null);
const alternar = arg('--alternar', null);
const intercalar = arg('--intercalar', null);                // «a=ruta,b=ruta»: dos programas de Node en la misma tanda
const nativoTambien = arg('--nativo-tambien', null);         // con --intercalar: también el programa de Windows en cada vuelta
const topeMin = Number(arg('--tope-min', 12));                    // v3: cada corrida = el nativo y enseguida el wasm (pares)                        // v3, v3-sinvector…: el programa de Windows en lugar de Node
// §170/§175: cada corrida con su partida de RR limpia (las 4 licencias vacías, herramientas/partida-aislada.mjs), no la
// de terceros/RetroRewind/riivolution/save, que la primera corrida dejaba con la licencia «no name» hecha;
// --partida-compartida = como antes (para comparar)
const compartida = process.argv.includes('--partida-compartida');
// el guion de botones: con la partida limpia, guion-170 (A apretado 144 cuadros de cada 150, del 400 al 6000: un toque
// nuevo cada 150 cuadros hasta el final, así un toque perdido en una transición no deja el juego esperando en un menú;
// el de §165 soltaba los toques en el 3000 y dejaba A apretado, y una vez de 2 se quedó en los menús). Con la partida
// compartida, el de §165 como antes. --guion archivo = otro
const guion = readFileSync(path.join(raiz, arg('--guion', `build/web/datos/impuesto-perfil/guion-${compartida ? 165 : 170}.txt`)), 'utf8').trim();
const salida = path.join(raiz, 'build/web/datos/node-estable');
mkdirSync(salida, { recursive: true });

const plan = execFileSync('powercfg', ['/getactivescheme']).toString().trim();

// el contador de rendimiento del procesador, una muestra por segundo mientras dura el tramo. typeperf guarda su salida
// cuando no escribe a una terminal (sin -sc se perdía todo al cortarlo): por eso una llamada corta (-sc 1) tras otra.
function contadorCpu() {
  const valores = [];
  let enTramo = false, vivo = true;
  const muestra = () => { if (!vivo) return; if (!enTramo) { setTimeout(muestra, 500); return; }
    execFile('typeperf', ['\\Processor Information(_Total)\\% Processor Performance', '-sc', '1'], (e, out) => {
      const m = String(out || '').match(/^"[^"]+","([\d.]+)"/m); if (m && enTramo) valores.push(Number(m[1])); setTimeout(muestra, 0); }); };
  muestra();
  return { valores, prender: v => { enTramo = v; }, parar: () => { vivo = false; } };
}

function una(n, deNativo = nativo, buildNode = null, envExtra = {}) {
  const nativo = deNativo;
  return new Promise(listo => {
    const datos = path.join(salida, 'datos-' + etiqueta);
    // MKW_HEADLESS_ESTADO: la sección y la página cada 60 cuadros (una línea, casi gratis), para saber dónde se quedó una
    // corrida que no llega a la carrera (se guarda en <etiqueta>-fallo-<n>.log)
    const env = { ...process.env, MKW_NODE_DATOS: datos, MKW_HEADLESS_GUION: guion, MKW_HEADLESS_TRAMO: '600-2400', MKW_HEADLESS_ESTADO: '1' };
    if (buildNode) env.MKW_BUILD_NODE = buildNode;
    Object.assign(env, envExtra);                              // §181: variables propias de un lado de --intercalar
    const rrRaiz = compartida ? path.join(raiz, 'terceros/RetroRewind/RetroRewind6') : partidaAislada(raiz, 'medir-node-estable');
    if (!compartida) env.MKW_RR_RAIZ = rrRaiz;
    let hijo;
    if (nativo) {
      // el programa de Windows: su partida está en UserData/NAND al lado del .exe; se corre desde terceros/Wiicompiled
      // (ahí busca dsp_coef.bin) y sale solo al llegar a MKW_HEADLESS_FRAMES
      // (el de la v0.9.3, build/nativo-v093-*, desde su copia terceros/Wiicompiled-motor: §170)
      const dir = path.join(raiz, 'build/nativo-' + nativo);
      rmSync(path.join(dir, 'UserData/NAND'), { recursive: true, force: true });
      // su Config.toml portátil (portable.txt al lado del .exe → UserData/Config.toml), escrito en cada corrida: el disco
      // y el Retro Rewind de esta corrida (§170: sin él, la v0.9.3 lo buscaba en %LOCALAPPDATA%\WiiCompiled, no
      // encontraba el disco y paraba con una ventana de error)
      writeFileSync(path.join(dir, 'portable.txt'), 'medir-node-estable\n');
      mkdirSync(path.join(dir, 'UserData'), { recursive: true });
      const abs = p => path.resolve(raiz, p).split(path.sep).join('/');
      writeFileSync(path.join(dir, 'UserData/Config.toml'), ['# Generado por herramientas/medir-node-estable.mjs',
        '[audio]', 'mix_worker = false', '', '[network]', 'enabled = false', '', '[discord]', 'enabled = false', '',
        '[paths]', `dvd_root = "${abs('extraido/disco')}"`, `retro_rewind_root = "${abs(rrRaiz)}"`, ''].join('\n'));
      hijo = spawn(path.join(dir, 'mkw-nativo.exe'), [], { cwd: path.join(raiz, nativo.startsWith('v093') ? 'terceros/Wiicompiled-motor' : 'terceros/Wiicompiled'),
        env: { ...env, MKW_HEADLESS_FRAMES: cuadros, SDL_AUDIO_DRIVER: 'dummy', SDL_VIDEO_DRIVER: 'dummy' }, stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      rmSync(datos, { recursive: true, force: true });           // partida nueva cada vez (si no, cambia el recorrido)
      hijo = spawn(process.execPath, ['--experimental-wasm-jspi', '--trace-gc', ...banderasV8, 'web/node/correr.mjs', cuadros],
        { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
    }
    if (fijo) {
      os.setPriority(hijo.pid, os.constants.priority.PRIORITY_HIGH);
      execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${hijo.pid}).ProcessorAffinity = ${mascara}`]);
    }
    const cpu = contadorCpu();
    // nada trabado: si la corrida no termina en topeMin minutos se mata ESE proceso (el nuestro) y queda sin tramo
    const reloj = setTimeout(() => { console.log(`corrida ${n}: pasó de ${topeMin} min, la corto`); try { hijo.kill(); } catch {} }, topeMin * 60000);
    let enTramo = false, gcVeces = 0, gcMs = 0, tramo = null, resto = '';
    const cola = [];   // las últimas líneas del juego, por si la corrida falla
    const t0 = Date.now();
    const linea = l => {
      if (!/\] cuadro \d+ \(| ms: (Scavenge|Mark)/.test(l)) { cola.push(l); if (cola.length > 400) cola.shift(); }   // sin cuadros ni recolecciones
      if (l.includes('[m8-vigia]')) console.log(l);   // M8 (paso 6): las funciones que rompen r14-r31, a la vista
      if (l.includes('[caliente]')) console.log(l);   // N14 (§181): el comprobador de las funciones reescritas
      if (l.includes('tramo empieza')) { enTramo = true; cpu.prender(true); }
      const m = l.match(/tramo 600-2400: .*pared ([\d.]+) ms, espera ([\d.]+) ms, trabajo ([\d.]+) ms/);
      if (m) { enTramo = false; cpu.prender(false); tramo = { pared: +m[1], espera: +m[2], trabajo: +m[3] }; }
      // --trace-gc: «[pid:…]  1234 ms: Scavenge 30.1 (40.0) -> 28.0 (41.0) MB, pooled: 0 MB, 1.23 / 0.00 ms …»
      const g = l.match(/ms: (Scavenge|Mark-Compact|Minor Mark-Sweep|Mark-Sweep)[^,]*MB, (?:pooled: [\d.]+ MB, )?([\d.]+) \/ [\d.]+ ms/);
      if (g && enTramo) { gcVeces++; gcMs += Number(g[2]); }
    };
    const leer = b => { resto += b.toString(); const ls = resto.split('\n'); resto = ls.pop(); ls.forEach(linea); };
    hijo.stdout.on('data', leer); hijo.stderr.on('data', leer);
    hijo.on('exit', () => {
      clearTimeout(reloj);
      cpu.parar();
      const rend = cpu.valores.length ? cpu.valores.reduce((a, b) => a + b, 0) / cpu.valores.length : null;
      const r = { n, segundos: Math.round((Date.now() - t0) / 1000), ...tramo, gcVeces, gcMs: Math.round(gcMs * 10) / 10,
        gcMsPorCuadro: Math.round(gcMs / 1800 * 1000) / 1000, rendimientoCpu: rend && Math.round(rend * 10) / 10 };
      console.log(`corrida ${n}: trabajo ${r.trabajo} ms/cuadro · recolector ${r.gcVeces} veces ${r.gcMs} ms (${r.gcMsPorCuadro}/cuadro) · procesador ${r.rendimientoCpu} % · ${r.segundos} s`);
      // §170: una corrida que no llegó al tramo (el guion no llegó a la carrera: otra partida, una ventana de error…)
      // corta la tanda entera al tiro. Antes seguía media hora midiendo nada (31-10, 04:09).
      if (!Number.isFinite(r.trabajo)) {
        writeFileSync(path.join(salida, `${etiqueta}-fallo-${n}${nativo ? '-' + nativo : ''}.log`), cola.join('\n') + '\n' + resto);
        console.log(`✗ la corrida ${n} no llegó al tramo 600-2400: corto la tanda (mirar ${nativo ? 'build/nativo-' + nativo + '/UserData' : datos + '/ultimo.log'})`);
        process.exit(2);
      }
      listo(r);
    });
  });
}

const mediana = v => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
console.log(`${etiqueta}: ${nativo ? 'programa de Windows ' + nativo : 'wasm en Node'}, ${corridas} corridas, ${fijo ? `prioridad alta, núcleos 0x${mascara.toString(16)}` : 'sin control'}, V8 ${banderasV8.join(' ') || '(nada)'} · ${plan}`);
const res = [], pares = [];
if (intercalar) {
  // §170: «antes» y «después» (o los que sean) en la misma tanda, el orden dado vuelta en cada vuelta
  // §181: «k=ruta@VAR=valor;VAR2=valor» = ese lado con sus variables de entorno (p. ej. el mismo programa con MKW_CALIENTE=0 y =1)
  const lados = intercalar.split(',').map(s => { const i = s.indexOf('='); const [ruta, extra = ''] = s.slice(i + 1).split('@');
    const env = Object.fromEntries(extra.split(';').filter(Boolean).map(x => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)]));
    return { k: s.slice(0, i), ruta, env, t: [] }; });
  const nat = [], vueltas = [];
  // un nativo para todos, o uno por lado (en el mismo orden que --intercalar)
  const nativos = nativoTambien ? nativoTambien.split(',') : [];
  if (nativos.length > 1) lados.forEach((l, j) => { l.nativo = nativos[j]; l.n = []; });
  for (let i = 1; i <= corridas; i++) {
    const orden = i % 2 ? lados : [...lados].reverse();
    const v = { n: i };
    if (nativos.length === 1) { const r = await una(i, nativos[0]); v.nativo = r.trabajo; nat.push(r.trabajo); }
    for (const l of orden) {
      if (l.nativo) { console.log(`[${l.k} nativo ${l.nativo}]`); const r = await una(i, l.nativo); v[l.k + 'Nativo'] = r.trabajo; l.n.push(r.trabajo); }
      console.log(`[${l.k}]`); const r = await una(i, null, l.ruta, l.env); v[l.k] = r.trabajo; l.t.push(r.trabajo);
    }
    v.razon = Math.round(v[lados[1].k] / v[lados[0].k] * 10000) / 10000;
    vueltas.push(v);
    console.log(`vuelta ${i}: ${lados.map(l => `${l.k} ${v[l.k]}`).join(' · ')}${v.nativo ? ` · nativo ${v.nativo}` : ''} · ${lados[1].k}/${lados[0].k} ×${v.razon}`);
  }
  const ok = a => a.filter(Number.isFinite);
  const disp = a => Math.round((Math.max(...a) - Math.min(...a)) / 2 / mediana(a) * 1000) / 10;
  const r = ok(vueltas.map(v => v.razon));
  const resumen = { etiqueta, fijo, intercalar, nativoTambien, banderasV8, plan, vueltas,
    lados: Object.fromEntries(lados.map(l => [l.k, { ruta: l.ruta, mediana: mediana(ok(l.t)), dispersionPct: disp(ok(l.t)),
      nativo: l.nativo || null, nativoMediana: l.n ? mediana(ok(l.n)) : null,
      razonNativo: l.n ? Math.round(mediana(ok(l.t)) / mediana(ok(l.n)) * 1000) / 1000
        : nat.length ? Math.round(mediana(ok(l.t)) / mediana(nat) * 1000) / 1000 : null }])),
    nativoMediana: nat.length ? mediana(nat) : null,
    razonMediana: mediana(r), razonMin: Math.min(...r), razonMax: Math.max(...r) };
  for (const l of lados) console.log(`→ ${l.k}: mediana ${resumen.lados[l.k].mediana} ms/cuadro (±${resumen.lados[l.k].dispersionPct} %)${resumen.lados[l.k].razonNativo ? ` · nativo ${resumen.lados[l.k].nativoMediana ?? resumen.nativoMediana} · wasm/nativo ×${resumen.lados[l.k].razonNativo}` : ''}`);
  console.log(`→ ${lados[1].k}/${lados[0].k}: mediana ×${resumen.razonMediana} (de ×${resumen.razonMin} a ×${resumen.razonMax})${nat.length ? ` · nativo ${resumen.nativoMediana}` : ''}`);
  writeFileSync(path.join(salida, etiqueta + '.json'), JSON.stringify(resumen, null, 1));
  process.exit(0);
}
for (let i = 1; i <= corridas; i++) {
  if (alternar) {
    // el par: los dos ven la misma carga de fondo del PC (otros programas que entran y salen); la razón de cada par
    // ya no arrastra la deriva de un grupo de corridas al siguiente
    const a = await una(i, alternar), b = await una(i, null);
    pares.push({ n: i, nativo: a, wasm: b, razon: Math.round(b.trabajo / a.trabajo * 1000) / 1000 });
    console.log(`par ${i}: ×${pares.at(-1).razon}`);
    res.push(b);
  } else res.push(await una(i));
}
const t = res.map(r => r.trabajo).filter(Number.isFinite);
const med = mediana(t), media = t.reduce((a, b) => a + b, 0) / t.length;
const disp = (Math.max(...t) - Math.min(...t)) / 2 / med * 100;
const sinGc = res.map(r => r.trabajo - r.gcMsPorCuadro);
const resumen = { etiqueta, nativo, alternar, fijo, mascara: fijo ? '0x' + mascara.toString(16) : null, banderasV8, plan, corridas: res,
  mediana: Math.round(med * 1000) / 1000, media: Math.round(media * 1000) / 1000, dispersionPct: Math.round(disp * 10) / 10,
  medianaSinGc: Math.round(mediana(sinGc) * 1000) / 1000 };
console.log(`→ mediana ${resumen.mediana} · media ${resumen.media} · ±${resumen.dispersionPct} % · sin el recolector ${resumen.medianaSinGc} ms/cuadro`);
if (pares.length) {
  const r = pares.map(p => p.razon), rn = pares.map(p => p.nativo.trabajo);
  Object.assign(resumen, { pares, razonMediana: mediana(r), razonDispersionPct: Math.round((Math.max(...r) - Math.min(...r)) / 2 / mediana(r) * 1000) / 10,
    nativoMediana: mediana(rn), nativoDispersionPct: Math.round((Math.max(...rn) - Math.min(...rn)) / 2 / mediana(rn) * 1000) / 10 });
  console.log(`→ nativo mediana ${resumen.nativoMediana} (±${resumen.nativoDispersionPct} %) · razón por pares ×${resumen.razonMediana} (±${resumen.razonDispersionPct} %)`);
}
writeFileSync(path.join(salida, etiqueta + '.json'), JSON.stringify(resumen, null, 1));
