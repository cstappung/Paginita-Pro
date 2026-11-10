// Mide una carrera ENTERA, de la cuenta a la meta y los resultados: qué lee el juego del disco en cada tramo (V3 del plan
// de rendimiento, bitácora §150).
//
// Resumen: medir-sitio corta a los 15–20 s de carrera y las pruebas terminan la carrera por código, así que nadie había
// visto lo que el juego lee en la última vuelta y en la meta (la música de la última vuelta, la fanfarria…). Esto corre
// carreras directas con las 12 en CPU (?soloCpu=1: la carrera se maneja sola hasta la meta), cada una con un perfil
// nuevo (un contexto de Chrome vacío: sin caché), y con ?trazaDisco=1 la página escribe cada lectura del juego en la
// consola («[lee] cuadro N ruta inicio largo»). Cada lectura se anota en su tramo:
//   - antes: de abrir la página a que la carrera arranca (etapa 2 de Raceinfo);
//   - carrera: de la largada a que llega la primera (etapa 4) o todas;
//   - meta: los 15 s siguientes (la fanfarria, la pantalla de resultados).
// Además: mkwFaltas() (lo que en la carrera tuvo que ir a la red, §121) y cuántas veces el juego esperó a la red.
// Chrome sin ventana y sin sonido. Lo que sale son nombres de archivos del juego: no va a git (build/ está ignorado).
//
// Uso:  node herramientas/medir-carrera-entera.mjs [--pistas 0.0,13.2,30.2] [--puerto 8164] [--extra "&param=…"]
//            [--etiqueta X] [--baja] [--semilla] [--hasta-largada]
//       → build/web/datos/carrera-entera[/X]/<pista>.json y resumen.txt
//   --baja: la gama baja simulada para lo que se baja (§168): la CPU 4 veces más lenta (CDP) y la red de 20 Mbit/s con
//           50 ms de ida (lo que tarda en cargar y en largar es lo que cambia; la carrera misma dura más)
//   --semilla: además escribe bloques-<X>.json (la semilla de bloques, §168 D9) con lo que leyó el juego en estas
//           corridas (mkwLecturas: cada bloque, el cuadro de la primera vez y en cuántas corridas apareció)
//   Por tramo también: pedidos y MB a la red (disco.estado.pedidosRed/bytesRed) y las veces que el juego esperó a la
//   red; «largada s» = de abrir la página a la etapa 2.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8164));
const PISTAS = opcion('--pistas', '0.0,13.2,30.2').split(',');
const EXTRA = opcion('--extra', '');
const ETIQUETA = opcion('--etiqueta', '');
const BAJA = process.argv.includes('--baja'), SEMILLA = process.argv.includes('--semilla');
const HASTA_LARGADA = process.argv.includes('--hasta-largada');
// --mismo-perfil (§176): todas las pistas en el MISMO perfil (caché y localStorage siguen): con --pistas 13.2,13.2 la
// segunda carrera ya tiene lo aprendido en la primera (D1: lo que la pista leyó fuera del paquete)
const MISMO_PERFIL = process.argv.includes('--mismo-perfil');
let perfilComun = null;
// --pipelines: al terminar cada pista guarda la lista de pipelines de aurora (pipelines-<X>-<pista>.bin, el formato de
// pipelines.bin) para armar la semilla de pipelines con carreras enteras (§172, C3; herramientas/juntar-pipelines.mjs)
const PIPELINES = process.argv.includes('--pipelines');
// --menu vs|gp (§169, U2): a la carrera por los menús del juego (el piloto de la página: ?modo=vs|gp&copa=C&fila=F, el
// jugador manejado por la CPU, ?autoconducir=1) en vez de abrirla directo: así la pista se elige en su pantalla
const MENU = opcion('--menu', '');   // (solo la carga: corta al largar)
const carpeta = path.join(raiz, 'build/web/datos/carrera-entera', ETIQUETA);
const semilla = new Map();   // "ruta|bloque" → [ruta, bloque, cuadro, veces]
mkdirSync(carpeta, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));

// (dentro de la página) la etapa de la carrera y si llegaron todas: Raceinfo 0x809BD730 +0x28 etapa (2 corriendo,
// 4 terminada), +0xC → los 12 RaceinfoPlayer (+0x38 bit 2 = cruzó la meta); el reloj de la carrera en +0x14
function leerEtapa() {
  const L = window.mkwMenus;
  if (!L?.estado) return null;
  const ri = L.u32(0x809BD730);
  if (!ri) return { etapa: -1 };
  const lista = L.u32(ri + 0xC), r = L.u32(ri + 0x14);
  let llegaron = 0;
  for (let i = 0; i < 12; i++) { const p = lista ? L.u32(lista + 4 * i) : 0; if (p && (L.u32(p + 0x38) & 2)) llegaron++; }
  return { etapa: L.u32(ri + 0x28), llegaron, reloj: r ? (L.u16(r + 0x8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC) : -1 };
}

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const resumen = [];
try {
  for (const [vuelta, pista] of PISTAS.entries()) {
    const contexto = MISMO_PERFIL ? (perfilComun ??= await navegador.newContext({ viewport: { width: 960, height: 540 } }))
                                  : await navegador.newContext({ viewport: { width: 960, height: 540 } });   // (perfil nuevo: sin caché)
    const p = await contexto.newPage();
    if (BAJA) {
      const cdp = await contexto.newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: 20e6 / 8, uploadThroughput: 5e6 / 8 });
    }
    let tramo = 'antes';
    const lecturas = [];
    const pipes = Object.fromEntries(['antes', 'carrera', 'meta'].map(k => [k, { pedidos: 0, forzados: 0, msForzados: 0, saltados: 0, juegoCola: 0, juegoLista: 0, juegoNuevo: 0 }]));
    const subcopias = new Map();   // §202 (W7): los avisos «sub-copy unsupported» de aurora (una carga XF que se salta)
    p.on('console', m => {
      const t = m.text();
      if (t.includes('sub-copy unsupported')) {
        const k = (/XF:? \S+ sub-copy unsupported: offs=\d+, len=\d+/.exec(t) || [t.slice(0, 80)])[0];
        subcopias.set(k, (subcopias.get(k) || 0) + 1);
      }
      const x = /^\[lee\] cuadro (\d+) (\S+) (\d+) (\d+)/.exec(t);
      if (x) lecturas.push({ tramo, cuadro: +x[1], ruta: x[2], inicio: +x[3], largo: +x[4] });
      // §172 (C3): los pipelines de cada segundo, por tramo: pedidos en segundo plano y armados de golpe en el momento
      const y = /^\[pipelines\] (\d+) pedidos .* (\d+) armados en el momento \(([\d.]+) ms\), (\d+) dibujos saltados/.exec(t);
      if (y) { const q = pipes[tramo]; q.pedidos += +y[1]; q.forzados += +y[2]; q.msForzados += +y[3]; q.saltados += +y[4]; }
      // §190 (G4 barato): lo que pidió el juego sin estar listo: de la cola del precalentado, de la lista esperando, nuevo
      const z = /el juego pidió (\d+) de la cola, (\d+) de la lista esperando, (\d+) nuevos/.exec(t);
      if (z) { const q = pipes[tramo]; q.juegoCola += +z[1]; q.juegoLista += +z[2]; q.juegoNuevo += +z[3]; }
    });
    const t0 = Date.now();
    const [copa, fila] = pista.split('.');
    await p.goto(MENU ? `http://127.0.0.1:${PUERTO}/?auto=1&modo=${MENU}&copa=${copa}&fila=${fila}&cc=c150&cpu=maximo&autoconducir=1&trazaDisco=1${EXTRA}`
                      : `http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${pista}&cc=c150&cpu=maximo&semilla=11&soloCpu=1&trazaDisco=1${EXTRA}`);
    let e = null, tLargada = 0, tMeta = 0, esperaAntes = 0;
    const red = {};    // tramo → {pedidos, bytes, espera} al empezar ese tramo
    const fotoRed = () => p.evaluate(() => { const s = window.mkwDisco?.estado; return s ? { pedidos: s.pedidosRed, bytes: s.bytesRed, espera: s.esperaRed, escrituras: s.escrituras ?? null, grandes: s.escriturasGrandes ?? null } : null; }).catch(() => null);
    while (Date.now() - t0 < 12 * 60000) {
      await espera(250);
      e = await p.evaluate(leerEtapa).catch(() => null);
      if (!e) continue;
      if (tramo === 'antes' && e.etapa >= 2) {
        tramo = 'carrera'; tLargada = Date.now();
        esperaAntes = await p.evaluate(() => window.mkwDisco?.estado.esperaRed ?? 0).catch(() => 0);
        red.carrera = await fotoRed();
        if (HASTA_LARGADA) break;
      }
      if (tramo === 'carrera' && (e.etapa >= 4 || e.llegaron >= 12)) { tramo = 'meta'; tMeta = Date.now(); red.meta = await fotoRed(); }
      if (tramo === 'meta' && Date.now() - tMeta > 15000) break;
      if (tramo === 'antes' && Date.now() - t0 > (BAJA ? (MENU ? 600000 : 360000) : 240000)) break;    // (no arrancó en 4 min; 6 en la gama baja; 10 por los menús en la gama baja, §175)
    }
    const fin2 = await p.evaluate(async (pedir) => ({ faltas: window.mkwFaltas?.() || [], redEnCarrera: window.mkwRedEnCarrera?.() || [], esperaRed: window.mkwDisco?.estado.esperaRed ?? 0,
      lecturas: pedir ? window.mkwLecturas?.() || [] : [], paquete: window.mkwEstado?.paquete || null,
      memoriaMB: window.mkwDisco?.estado.memoriaMB?.() ?? null,
      // (U2 en Grand Prix: ¿las otras pistas de la copa ya están guardadas al terminar la 1.ª? El primer y el último byte)
      copa: await (async () => { const pq = window.mkwEstado?.paquete, d = window.mkwDisco; if (!pq?.temprana || pq.temprana.modo !== 0 || !d?.donde) return null;
        const n = pq.temprana.pista - 0x100, r = []; for (let k = n - (n % 4); k < n - (n % 4) + 4; k++) { if (k === n) continue;
          const url = '/mkw/sd/RetroRewind6/Tracks/' + k + '.szs';   // (como direccion() de mkw.mjs sin ?privado)
          const a = await d.donde(url, 0); r.push([k, !!(a.caja || a.memoria)]); } return r; })(), heapMB: Math.round((window.mkw?.HEAPU8?.length || 0) / 1048576) }), SEMILLA).catch(() => ({ faltas: [], esperaRed: 0, lecturas: [] }));
    red.fin = await fotoRed();
    if (PIPELINES) {
      const b64 = await p.evaluate(() => {
        const M = window.mkw, n = M._mkw_web_pipelines_armar(), d = M.HEAPU8.subarray(M._mkw_web_pipelines_datos(), M._mkw_web_pipelines_datos() + n);
        let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
        return btoa(s);
      }).catch(() => null);
      if (b64) writeFileSync(path.join(raiz, 'build/web/navegador', `pipelines-${ETIQUETA || 'carrera'}-${pista}.bin`), Buffer.from(b64, 'base64'));
    }
    for (const [ruta, b, cuadro, tam] of fin2.lecturas) {
      const k = ruta + '|' + b, v = semilla.get(k);
      if (v) { v[2] = Math.min(v[2], cuadro); v[3]++; } else semilla.set(k, [ruta, b, cuadro, 1, tam]);
    }
    if (MISMO_PERFIL) await p.close(); else await contexto.close();
    // por tramo: lecturas, MB y los archivos (los de la carrera y la meta, con sus MB)
    const porTramo = {};
    for (const t of ['antes', 'carrera', 'meta']) {
      const l = lecturas.filter(x => x.tramo === t), archivos = new Map();
      for (const x of l) archivos.set(x.ruta, (archivos.get(x.ruta) || 0) + x.largo);
      porTramo[t] = { lecturas: l.length, mb: +(l.reduce((s, x) => s + x.largo, 0) / 1048576).toFixed(2), archivos: archivos.size,
                      lista: [...archivos].sort((a, b) => b[1] - a[1]).map(([r, b]) => `${r} ${(b / 1048576).toFixed(2)} MB`) };
    }
    const fin = fin2;
    // a la red por tramo (pedidos, MB y esperas del juego), de las fotos al empezar cada tramo
    const resta = (a, b) => a && b ? { pedidos: b.pedidos - a.pedidos, mb: +((b.bytes - a.bytes) / 1048576).toFixed(2), esperas: b.espera - a.espera } : null;
    const aLaRed = { antes: resta({ pedidos: 0, bytes: 0, espera: 0 }, red.carrera), carrera: resta(red.carrera, red.meta || red.fin), meta: red.meta ? resta(red.meta, red.fin) : null };
    const r = { pista, extra: EXTRA, baja: BAJA, llego: tramo !== 'antes', largadaS: tLargada ? +((tLargada - t0) / 1000).toFixed(1) : null,
                carreraS: tMeta && tLargada ? Math.round((tMeta - tLargada) / 1000) : null, aLaRed, pipelines: pipes,
                paqueteUsado: fin.paquete?.rutas ? (() => { const leidas = new Set(lecturas.map(x => x.ruta)), r = fin.paquete.rutas;
                  return { piezas: r.length, leidas: r.filter(x => leidas.has(x)).length, sinLeer: r.filter(x => !leidas.has(x)).slice(0, 30) }; })() : null,
                cache: red.fin ? { escrituras: red.fin.escrituras, grandes: red.fin.grandes, alLargar: red.carrera?.escrituras ?? null } : null, paquete: fin.paquete, copa: fin.copa, memoriaMB: fin.memoriaMB, heapMB: fin.heapMB,
                porTramo, subcopias: Object.fromEntries(subcopias), faltasEnCarrera: fin.faltas.length, redEnCarrera: fin.redEnCarrera, esperasRedEnCarreraYMeta: fin.esperaRed - esperaAntes, faltas: fin.faltas.slice(0, 200) };
    writeFileSync(path.join(carpeta, MISMO_PERFIL ? `${pista}-${vuelta + 1}.json` : `${pista}.json`), JSON.stringify(r, null, 1));
    const fr = x => x ? `${x.pedidos} pedidos ${x.mb} MB ${x.esperas} esperas` : '—';
    const fp = x => `${x.pedidos} pedidos, ${x.forzados} de golpe (${Math.round(x.msForzados)} ms), ${x.saltados} saltados` +
      (x.juegoCola + x.juegoLista + x.juegoNuevo ? ` (el juego: ${x.juegoCola} de la cola, ${x.juegoLista} de la lista esperando, ${x.juegoNuevo} nuevos)` : '');
    const linea = `pista ${pista}${BAJA ? ' (baja)' : ''}: pipelines antes ${fp(pipes.antes)} · carrera ${fp(pipes.carrera)} · meta ${fp(pipes.meta)}
  largada ${r.largadaS ?? '?'} s · caché ${r.cache?.alLargar ?? '?'} escrituras al largar, ${r.cache?.escrituras ?? '?'} en total (${r.cache?.grandes ?? "?"} en grupo) · red antes ${fr(aLaRed.antes)} · red carrera ${fr(aLaRed.carrera)} · red meta ${fr(aLaRed.meta)}
  ` +
      `paquete ${r.paqueteUsado ? `${r.paqueteUsado.leidas}/${r.paqueteUsado.piezas} leídas` : '—'}${fin.paquete?.pista ? ` (pista pedida por la ${fin.paquete.pista.por}, ${fin.paquete.pista.adelantoMs ?? '?'} ms antes de que el juego la abriera)` : ''} · memoria del disco ${r.memoriaMB ?? '?'} MB${r.copa ? ` · copa guardada ${r.copa.filter(x => x[1]).length}/${r.copa.length}` : ''} · carrera ${r.carreraS ?? '?'} s · antes ${porTramo.antes.lecturas} lecturas (${porTramo.antes.mb} MB) · ` +
      `carrera ${porTramo.carrera.lecturas} lecturas (${porTramo.carrera.mb} MB, ${porTramo.carrera.archivos} archivos) · ` +
      `meta ${porTramo.meta.lecturas} lecturas (${porTramo.meta.mb} MB, ${porTramo.meta.archivos} archivos) · ` +
      `a la red en carrera ${r.faltasEnCarrera} · el juego esperó a la red ${r.esperasRedEnCarreraYMeta} veces (carrera + meta)` +
      ` · avisos XF «sub-copy» ${[...subcopias.values()].reduce((a, b) => a + b, 0)}` +
      (subcopias.size ? ` (${[...subcopias].map(([k, n]) => `${n}× ${k}`).join('; ')})` : '');
    console.log(linea);
    for (const t of ['carrera', 'meta']) for (const a of porTramo[t].lista.slice(0, 12)) console.log(`    ${t}: ${a}`);
    // (§176: lo que de verdad salió a la red con la fila de fondo en pausa —carrera y meta—: archivo, bloques, KB, urgente)
    // (la marca es la etapa del Raceinfo al salir el pedido: 0 presentación, 1 cuenta, 2 carrera andando, ≥ 4 resultados)
    const andando = fin.redEnCarrera.filter(x => x[5] === 1 || x[5] === 2);   // (de la cuenta a la meta: el criterio del paso 5)
    console.log(`    red en pausa: ${fin.redEnCarrera.length} pedidos (${Math.round(fin.redEnCarrera.reduce((a, x) => a + x[3], 0) / 1024)} KB); de la cuenta a la meta ${andando.length} (${Math.round(andando.reduce((a, x) => a + x[3], 0) / 1024)} KB)`);
    for (const x of [...andando, ...fin.redEnCarrera.filter(x => !andando.includes(x))].slice(0, 12)) console.log(`    red: ${String(x[0]).split('/').slice(-2).join('/')} ${x[1]}–${x[2]} ${Math.round(x[3] / 1024)} KB${x[4] ? ' urgente' : ''} etapa ${x[5] ?? '?'}`);
    resumen.push(linea, ...['carrera', 'meta'].flatMap(t => porTramo[t].lista.map(a => `    ${t}: ${a}`)));
    if (SEMILLA) {   // la semilla de bloques (formato de guion.mjs: [ruta, bloque, cuadro, veces]), escrita después de cada pista
      const destino = path.join(raiz, 'build/web/navegador', `bloques-${ETIQUETA || 'carrera'}.json`);
      const bloques = [...semilla.values()].sort((a, b) => a[2] - b[2]).map(([ruta, b, cuadro, veces]) => [ruta, b, cuadro, veces]);
      writeFileSync(destino, JSON.stringify({ corridas: PISTAS.indexOf(pista) + 1, bloques }));
      console.log(`semilla: ${bloques.length} bloques de ${PISTAS.indexOf(pista) + 1} corridas → ${path.relative(raiz, destino)}`);
    }
  }
} finally {
  writeFileSync(path.join(carpeta, 'resumen.txt'), resumen.join('\n') + '\n');
  await navegador.close().catch(() => {});
  servidor.kill();
}
