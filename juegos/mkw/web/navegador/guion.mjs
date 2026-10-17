// Guion: maneja el juego de verdad en Chrome apretando teclas, y saca una foto del juego después de cada paso.
//
// Resumen: abre la página del juego con Playwright (como prueba-navegador.mjs), espera a que el juego llegue a la
// pantalla de título y después ejecuta una lista de pasos. Cada paso aprieta una tecla un instante (como un dedo:
// baja, 120 ms, sube), espera lo que se le diga y guarda una foto del canvas en build/web/datos/guion/NN-tecla.png.
// Las teclas pasan por el mismo camino que una persona: teclado → controles.mjs → mando de GameCube → el juego.
// Sirve para llegar a una pantalla concreta (crear licencia, elegir personaje, empezar una carrera) y mirarla.
//
// Teclas por defecto (ver controles.mjs): K = A, J = B, P = Start, T/G/F/H = cruz arriba/abajo/izquierda/derecha,
// W/A/S/D = stick, L = R, Espacio = L.
//
// Uso:  node web/navegador/guion.mjs "K:2000 K:1500 G:400 K:3000" [--esperar 360] [--ventana]
//         cada paso es TECLA:ms (ms = cuánto esperar después de soltarla; por defecto 1200);
//         "-:3000" = no apretar nada, solo esperar; "K*3:500" = apretar K tres veces;
//         "R:1000" = recargar la página (las partidas guardadas quedan) y esperar al título;
//         "K~30000:500" = mantener K apretada 30 s (p. ej. acelerar en una carrera);
//         "P:4000" = perfil de 4 s (en qué funciones se va el tiempo), acelerando mientras mide;
//         "Q:4000" = lo mismo sin apretar nada (para perfilar un menú sin elegir nada);
//         "X:1000" = evaluar la expresión de --evaluar en ese momento (y al final no);
//         "F*4:500" = frenar la CPU 4× desde ahora, como un celular ("F*1" = normal; ver medir-cpu.sh)
//       --esperar N: cuadros que espera antes del primer paso (por defecto 360 = 6 s, ya en el título)
//       --extra "&x=y": parámetros más para la página (p. ej. "&rutas=traducido" o "&thp=comparar")
//       --traza: al final, vuelca la traza del ritmo a consola.log (con --extra "&traza=1")
//       --mii: antes de los pasos deja una base de Mii de prueba (2 Mii inventados) y recarga
//       --evaluar "expr": al final escribe el resultado de evaluar expr en la página (diagnóstico)
//       --listar: al final, lista los archivos que escribió el juego (para saber qué hay que guardar)
//       --llamadores "f1,f2": con un paso P o Q, dice desde qué funciones se llama a f1, f2 (p. ej. el reloj)
//       --semilla: al final, guarda la lista de pipelines que usó el juego como semilla para precalentar
//                  (build/web/navegador/pipelines.bin, se sirve junto al .wasm; ver pipelines.mjs) y SUMA los
//                  bloques del disco que leyó después del título a bloques.json (cuántas corridas vio cada uno;
//                  la página baja de antemano los que se repiten en ≥ 2 corridas: correrlo 2 o 3 veces)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, createWriteStream, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, porDefecto) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : porDefecto; };
const pasos = (args.find(a => !a.startsWith('--') && !['--esperar', '--extra', '--llamadores', '--evaluar'].includes(args[args.indexOf(a) - 1])) || '').split(/\s+/).filter(Boolean);
const esperarCuadros = Number(opcion('--esperar', 360));
const PUERTO = 8142;
const NOMBRE = { K: 'KeyK', J: 'KeyJ', P: 'KeyP', T: 'KeyT', G: 'KeyG', F: 'KeyF', H: 'KeyH',
                 W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD', L: 'KeyL', E: 'Space', U: 'KeyU', O: 'KeyO', N: 'KeyN' };

const carpeta = path.join(raiz, 'build/web/datos/guion');
rmSync(carpeta, { recursive: true, force: true });
mkdirSync(carpeta, { recursive: true });
const log = createWriteStream(path.join(carpeta, 'consola.log'));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const pagina = await navegador.newPage({ viewport: { width: 1000, height: 1100 } });
pagina.on('console', m => log.write(m.text() + '\n'));
// cada pedido de archivos del disco o de Retro Rewind a la red, en orden con las líneas del medidor (qué se lee y cuándo)
pagina.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/mkw/'))
  log.write(`[red] ${decodeURIComponent(u.pathname)} ${r.headers().range || 'entero'}\n`); });
pagina.on('pageerror', e => { log.write('[pageerror] ' + e.message + '\n'); console.log('[pageerror] ' + e.message); });
await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1${opcion('--extra', '')}`);   // --extra "&rutas=traducido" etc.
await pagina.waitForFunction(n => (window.mkwEstado?.cuadros || 0) >= n, esperarCuadros, { timeout: 120000, polling: 250 });
// --mii: antes de los pasos, deja una base de Mii de prueba (RFL_DB.dat con 2 Mii inventados, armada por mii.mjs) en
// las partidas del navegador y recarga: así se ve si el juego los lista al crear la licencia ("Elegir Mii")
if (args.includes('--mii')) {
  const r = await pagina.evaluate(async () => {
    const M = await import('/mii.mjs');
    const a = M.miiNuevo({ nombre: 'Prueba' }); a.pelo.tipo = 20; a.pelo.color = 6; a.colorFavorito = 4; a.lentes.tipo = 1;
    const b = M.miiNuevo({ nombre: 'Banco', esChica: 1, ahora: Date.now() + 8000 }); b.cara.piel = 3; b.colorFavorito = 7;
    const base = M.armarBase([a, b]);
    await window.mkwGuardado.ponerArchivo(M.RUTA_RFLDB, base);
    return M.leerBase(base).mii.map(x => x.mii.nombre).join(', ');
  });
  console.log('base de Mii de prueba: ' + r);
  await pagina.reload();
  await pagina.waitForFunction(n => (window.mkwEstado?.cuadros || 0) >= n, esperarCuadros, { timeout: 120000, polling: 250 });
}

const foto = async nombre => pagina.locator('#canvas').screenshot({ path: path.join(carpeta, nombre + '.png') });
await foto('00-inicio');
const inicio = Date.now() - (await pagina.evaluate(() => performance.now()));   // el "segundo 0" del medidor ≈ carga de la página
let n = 0, frenoCdp = null;
for (const paso of pasos) {
  const [tecla, msTexto] = paso.split(':');
  const [teclaVeces, sostenerTexto] = tecla.split('~');          // K~30000 = mantener K apretada 30 s
  const [letra, veces] = teclaVeces.split('*');
  const sostener = Number(sostenerTexto || 120);
  const ms = Number(msTexto || 1200);
  if (letra === 'X') {
    // X:ms = evaluar ahora la expresión de --evaluar (p. ej. escribir algo en la memoria del juego) y esperar
    console.log('X: ' + JSON.stringify(await pagina.evaluate(opcion('--evaluar', '')).catch(e => String(e))));
    await pagina.waitForTimeout(ms);
    n++;
    continue;
  }
  if (letra === 'F') {
    // F*4:500 = desde ahora la CPU de la página va 4 veces más lenta (como un celular; F*1 = normal). Usa el freno de
    // las DevTools de Chrome (Emulation.setCPUThrottlingRate): frena el hilo de la página, el del juego incluido.
    if (!frenoCdp) frenoCdp = await pagina.context().newCDPSession(pagina);
    await frenoCdp.send('Emulation.setCPUThrottlingRate', { rate: Number(veces || 1) });
    await pagina.waitForTimeout(ms);
    n++;
    console.log(`paso ${n}: ${paso} → CPU frenada ${Number(veces || 1)}×`);
    continue;
  }
  for (let i = 0; i < Number(veces || 1); i++) {
    if (letra === 'P' || letra === 'Q') {
      // P:4000 = perfil: durante 4 s mide en qué funciones pasa el tiempo (muestras cada 0,2 ms) y escribe las 25
      // que más tiempo propio gastan. Se puede combinar con una tecla sostenida antes (p. ej. K~3000 y después P).
      const cdp = await pagina.context().newCDPSession(pagina);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');
      if (letra === 'P') await pagina.keyboard.down('KeyK');  // P: seguir acelerando mientras mide; Q: sin tocar nada
      await new Promise(r => setTimeout(r, ms));
      if (letra === 'P') await pagina.keyboard.up('KeyK');
      const { profile } = await cdp.send('Profiler.stop');
      const porId = new Map(profile.nodes.map(n => [n.id, n]));
      const cuenta = new Map();
      for (const id of profile.samples) {
        const nodo = porId.get(id);
        // las funciones sin nombre (flechas de JavaScript) van con su línea, para encontrarlas en mkw.js / mkw.mjs
        const cf = nodo.callFrame;
        const nombre = cf.functionName || (cf.url ? `(${cf.url.split("/").pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1})` : '(nativo)');
        cuenta.set(nombre, (cuenta.get(nombre) || 0) + 1);
      }
      const total = profile.samples.length;
      const lineas = [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n, c]) => `  ${(100 * c / total).toFixed(1).padStart(5)} %  ${n}`);
      console.log(`perfil de ${ms / 1000} s (${total} muestras):\n` + lineas.join('\n'));
      // --llamadores "f1,f2": para esas funciones, quién las llama (subiendo hasta la primera función del juego o del
      // runtime, salteando el pegamento de JavaScript: wasm-to-js, now…). Para saber de dónde salen llamadas caras.
      const buscadas = (opcion('--llamadores', '') || '').split(',').filter(Boolean);
      if (buscadas.length) {
        const padreDe = new Map();
        for (const nd of profile.nodes) for (const h of nd.children || []) padreDe.set(h, nd.id);
        const pegamento = /^(wasm-to-js|js-to-wasm|now|_emscripten_get_now|_clock_time_get|bigintToI53Checked|__clock_gettime|clock_gettime|std::__2::chrono::.*|\(.*\))$/;
        const quien = new Map();
        for (const id of profile.samples) {
          const nd = porId.get(id);
          if (!buscadas.includes(nd.callFrame.functionName)) continue;
          let q = padreDe.get(id), nombre = '?';
          for (let k = 0; q !== undefined && k < 12; k++, q = padreDe.get(q)) {
            const f = porId.get(q).callFrame.functionName;
            if (f && !pegamento.test(f)) { nombre = f; break; }
          }
          quien.set(nombre, (quien.get(nombre) || 0) + 1);
        }
        console.log('llamadores de ' + buscadas.join(', ') + ':\n' + [...quien].sort((a, b) => b[1] - a[1]).slice(0, 12)
          .map(([n, c]) => `  ${(100 * c / total).toFixed(1).padStart(5)} %  ${n}`).join('\n'));
      }
      await cdp.detach();
    } else if (letra === 'R') {
      // R = recargar la página (como cerrarla y volver a abrirla: IndexedDB queda) y esperar al título otra vez
      await pagina.evaluate(() => window.mkwGuardado && window.mkwGuardado.guardarPendientes());
      await pagina.reload();
      await pagina.waitForFunction(n => (window.mkwEstado?.cuadros || 0) >= n, esperarCuadros, { timeout: 120000, polling: 250 });
    } else if (letra !== '-') {
      const code = NOMBRE[letra.toUpperCase()] || letra;
      await pagina.keyboard.down(code); await new Promise(r => setTimeout(r, sostener)); await pagina.keyboard.up(code);
    }
    await new Promise(r => setTimeout(r, i + 1 < Number(veces || 1) ? 350 : ms));
  }
  n++;
  await foto(`${String(n).padStart(2, '0')}-${letra === '-' ? 'espera' : letra}`);
  // con el cuadro y el segundo del medidor, para saber a qué pantalla corresponde cada línea de consola.log
  const cuadro = await pagina.evaluate(() => window.mkwEstado?.cuadros || 0);
  // y en qué pantalla quedó el juego (menus.mjs: sección, página, pista/modo/cc elegidos), leído de su memoria
  const menu = await pagina.evaluate(() => window.mkwMenus ? window.mkwMenus.texto(window.mkwMenus.estado()) : '');
  console.log(`paso ${n}: ${paso} → foto (cuadro ${cuadro}, segundo ${((Date.now() - inicio) / 1000).toFixed(0)})${menu ? ' · ' + menu : ''}`);
}
if (args.includes('--traza')) {
  // La traza del ritmo (con --extra "&traza=1"): a consola.log en líneas "[traza] [...]" (herramientas/analizar-traza.mjs
  // o herramientas/tiempos-cuadro.mjs)
  const t = await pagina.evaluate(() => window.mkwTrazaRitmo());
  for (let i = 0; i < t.length; i += 3000) log.write('[traza] ' + JSON.stringify(t.slice(i, i + 3000)) + '\n');
  console.log(`traza del ritmo: ${t.length} eventos`);
}
// --evaluar "expresión": al final, evalúa una expresión en la página y escribe el resultado (diagnóstico)
if (opcion('--evaluar', '') && !pasos.some(p => p.startsWith('X'))) console.log('evaluar: ' + JSON.stringify(await pagina.evaluate(opcion('--evaluar', '')).catch(e => String(e))));
if (args.includes('--listar')) {
  // Qué archivos escribió el juego (fecha posterior al arranque de main), en todo su sistema de archivos
  const escritos = await pagina.evaluate(() => {
    const FS = window.mkwFS, desde = window.mkwEstado.horaMain, lista = [];
    const recorrer = dir => {
      for (const n of FS.readdir(dir)) {
        if (n === '.' || n === '..') continue;
        const ruta = (dir === '/' ? '' : dir) + '/' + n;
        if (['/dev', '/proc', '/tmp'].includes(ruta)) continue;
        const st = FS.stat(ruta);
        if (FS.isDir(st.mode)) recorrer(ruta);
        else if (st.mtime.getTime() >= desde) lista.push(`${ruta}  ${st.size} bytes`);
      }
    };
    recorrer('/');
    return lista;
  });
  console.log('archivos escritos por el juego:\n  ' + escritos.join('\n  '));
}
if (args.includes('--semilla')) {
  // La lista de pipelines de esta partida → la semilla que la página baja al abrir (pipelines.mjs)
  const bytes = await pagina.evaluate(() => Array.from(window.mkwPipelines.exportar()));
  const destino = path.join(raiz, process.env.MKW_BUILD || 'build/web/navegador', 'pipelines.bin');
  writeFileSync(destino, Buffer.from(bytes));
  console.log(`semilla de pipelines: ${new DataView(Uint8Array.from(bytes).buffer).getUint32(8, true)} pipelines, ` +
              `${bytes.length} bytes → ${path.relative(raiz, destino)}`);
  // La semilla de bloques: se suma a la que haya (cada bloque cuenta en cuántas corridas apareció; el cuadro, el menor)
  const archivoBloques = path.join(path.dirname(destino), 'bloques.json');
  const previa = existsSync(archivoBloques) ? JSON.parse(readFileSync(archivoBloques, 'utf8')) : { corridas: 0, bloques: [] };
  const mapa = new Map(previa.bloques.map(x => [x[0] + '|' + x[1], x]));
  for (const [ruta, b, cuadro] of await pagina.evaluate(() => window.mkwLecturas())) {
    const k = ruta + '|' + b, x = mapa.get(k);
    if (x) { x[2] = Math.min(x[2], cuadro); x[3]++; } else mapa.set(k, [ruta, b, cuadro, 1]);
  }
  const bloques = { corridas: previa.corridas + 1, bloques: [...mapa.values()].sort((a, b) => a[2] - b[2]) };
  writeFileSync(archivoBloques, JSON.stringify(bloques));
  const repetidos = bloques.bloques.filter(x => x[3] >= 2 && x[2] >= 300).length;   // lo que usará la página
  console.log(`semilla de bloques: ${bloques.corridas} corrida(s), ${bloques.bloques.length} bloques vistos, ` +
              `${repetidos} en ≥ 2 corridas (${(repetidos / 4).toFixed(0)} MB) → ${path.relative(raiz, archivoBloques)}`);
}
await navegador.close();
servidor.kill();
log.end(() => process.exit(0));
