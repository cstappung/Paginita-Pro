// El perfil función por función del impuesto del navegador (N13 del plan de rendimiento, parte 1; bitácora §160).
//
// Resumen: N1 (§153) midió que el mismo juego trabaja ×2,2 en wasm que nativo, y que la memoria explica ~30 %. Esto
// dice DÓNDE se va el resto: corre el programa nativo (herramientas/compilar-nativo.py) bajo nuestro muestreador
// (herramientas/muestreador/muestreador.c: cada ~25 µs la pila del hilo que trabaja y los ciclos que gastó) y el wasm
// del modo Node bajo el perfilador de V8 (`node --cpu-prof`, cada 50 µs), con los mismos cuadros, uno detrás del otro.
// Después a cada función le toca su tiempo «propio» (lo que pasó dentro de ella, sin lo que llamó), se descartan las
// esperas del ritmo (toda muestra con SleepPreciselyUntil o la espera de la página en la pila: es girar, no trabajar)
// y se emparejan las funciones de los dos lados por nombre (las del juego, por su dirección de la Wii).
// Es como medir la caída de tensión de cada tramo de una línea en dos instalaciones iguales y ver qué tramo pierde más.
//
// Uso:  node herramientas/perfil-impuesto.mjs [--cuadros 3600] [--nativo v3] [--solo-analizar] [--etiqueta X]
//            [--solo-perfil <archivo.cpuprofile>] (un perfil de la página por grupos, sin nativo)
//            [--solo-wasm --nativo-de n13-a] (el nativo de otra corrida)
//            [--desde 600] (el cuadro desde el que se cuenta)
//            [--wasm-flags "--no-wasm-inlining"]   (banderas de V8 para el wasm, solo diagnóstico)
//       → build/web/datos/impuesto-perfil/<etiqueta>-*.json (+ los perfiles; con nombres del juego: nunca a git)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partidaAislada } from './partida-aislada.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const CUADROS = Number(opcion('--cuadros', 3600));
const NATIVO = opcion('--nativo', 'v3');
const ETIQUETA = opcion('--etiqueta', `n13-${NATIVO}`);
const WASM_FLAGS = (opcion('--wasm-flags', '') || '').split(' ').filter(Boolean);
const SOLO_ANALIZAR = process.argv.includes('--solo-analizar');
const DESDE = Number(opcion('--desde', 600));   // el cuadro desde el que se cuenta (antes: el arranque, que lee archivos)
const carpeta = path.join(raiz, 'build/web/datos/impuesto-perfil');
mkdirSync(carpeta, { recursive: true });
const wc = path.join(raiz, 'terceros/Wiicompiled');
const dirNativo = path.join(raiz, `build/nativo-${NATIVO}`);
const exeNativo = path.join(dirNativo, 'mkw-nativo.exe');
const muestreador = path.join(raiz, 'build/muestreador/muestreador.exe');
// --solo-wasm --nativo-de X: no se vuelve a correr el nativo; se usa el de la corrida X (para probar banderas de V8)
const NATIVO_DE = opcion('--nativo-de', null);
const SOLO_WASM = process.argv.includes('--solo-wasm');
const binNativo = path.join(carpeta, `${NATIVO_DE || ETIQUETA}-nativo.bin`);
const dirWasm = path.join(carpeta, `${ETIQUETA}-wasm`);

// ---------- 1) correr ----------
function compilarMuestreador() {
  if (existsSync(muestreador)) return;
  mkdirSync(path.dirname(muestreador), { recursive: true });
  // clang de Visual Studio con las variables de vcvars (las mismas que usa compilar-nativo.py)
  const py = `import subprocess,importlib.util as u
s=u.spec_from_file_location('cn',r'${path.join(raiz, 'herramientas/compilar-nativo.py')}');m=u.module_from_spec(s);s.loader.exec_module(m)
raise SystemExit(subprocess.run([str(m.LLVM/'clang.exe'),'-O2','-w',r'${path.join(raiz, 'herramientas/muestreador/muestreador.c')}','-o',r'${muestreador}','-lpsapi','-lwinmm','-ldbghelp'],env=m.entorno_vs()).returncode)`;
  const r = spawnSync('python', ['-c', py], { stdio: 'inherit' });
  if (r.status) throw new Error('no compiló el muestreador');
}

// lanza un programa, guarda su salida y junta {cuadro: trabajo ms} de las líneas de aurora-headless
function correr(etiqueta, exe, args, env, alListo) {
  return new Promise((listo) => {
    // horas de cada línea de cuadros: ms desde que se lanzó (el muestreador cuenta igual) y µs del reloj monótono del
    // sistema (el mismo que usan las marcas del perfil de V8), para quedarse con las muestras desde el cuadro --desde
    const t0 = Date.now(), ventanas = {}, lineas = [], horas = {};
    const p = spawn(exe, args, { cwd: wc, env: { ...process.env, ...env } });
    const resto = { out: '', err: '' };
    const linea = (l) => {
      if (!l.trim()) return;
      lineas.push(l);
      const x = /\[aurora-headless\] cuadro (\d+) \(([\d.]+) fps, trabajo ([\d.]+) ms/.exec(l);
      if (x) { ventanas[+x[1]] = +x[3]; horas[+x[1]] = { ms: Date.now() - t0, us: Number(process.hrtime.bigint() / 1000n) }; }
      if (/\[aurora-headless\] listo:/.test(l)) alListo?.(p);
    };
    const leerDe = (k) => (d) => {
      const partes = (resto[k] + String(d)).split('\n');
      resto[k] = partes.pop();
      for (const l of partes) linea(l.replace(/\r$/, ''));
    };
    p.stdout.on('data', leerDe('out')); p.stderr.on('data', leerDe('err'));
    p.on('close', (codigo) => {
      writeFileSync(path.join(carpeta, `${etiqueta}.log`), lineas.join('\n') + '\n');
      console.log(`${etiqueta}: ${Object.keys(ventanas).length} ventanas en ${((Date.now() - t0) / 1000).toFixed(0)} s (salida ${codigo})`);
      listo({ ventanas, horas });
    });
  });
}

// §170/§175: cada corrida con su partida de RR limpia (herramientas/partida-aislada.mjs), no la de
// terceros/RetroRewind/riivolution/save (la primera corrida dejaba la licencia «no name» hecha para las siguientes)
function prepararNativo(rrRaiz) {   // igual que medir-impuesto.mjs: el Config.toml portátil al lado del .exe
  writeFileSync(path.join(dirNativo, 'portable.txt'), 'perfil-impuesto\n');
  mkdirSync(path.join(dirNativo, 'UserData'), { recursive: true });
  const abs = (p) => path.join(raiz, p).split(path.sep).join('/');
  writeFileSync(path.join(dirNativo, 'UserData/Config.toml'), ['# Generado por herramientas/perfil-impuesto.mjs',
    '[audio]', 'mix_worker = false', '', '[network]', 'enabled = false', '', '[discord]', 'enabled = false', '',
    '[paths]', `dvd_root = "${abs('extraido/disco')}"`, `retro_rewind_root = "${path.resolve(rrRaiz).split(path.sep).join('/')}"`, ''].join('\n'));
}

const media = (v) => { const xs = Object.values(v); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null; };
let trabajo = {};
if (!SOLO_ANALIZAR && !process.argv.includes('--solo-perfil')) {
  if (!existsSync(exeNativo)) throw new Error(`falta ${exeNativo}: python herramientas/compilar-nativo.py --cpu ${NATIVO}`);
  compilarMuestreador();
  prepararNativo(partidaAislada(raiz, 'perfil-impuesto'));
  const viejo = NATIVO_DE ? JSON.parse(readFileSync(path.join(carpeta, `${NATIVO_DE}-trabajo.json`), 'utf8')) : null;
  // el nativo no sale solo al terminar (§153): «fin» por la entrada del muestreador lo cierra y cierra la medida
  const vn = SOLO_WASM ? { ventanas: viejo.ventanasNativo, horas: viejo.horasNativo } : await correr(`${ETIQUETA}-nativo`, muestreador, [binNativo, exeNativo],
    { MKW_HEADLESS_FRAMES: String(CUADROS), SDL_AUDIO_DRIVER: 'dummy', SDL_VIDEO_DRIVER: 'dummy' },
    (p) => setTimeout(() => p.stdin.write('fin\n'), 300));
  rmSync(dirWasm, { recursive: true, force: true });
  const rrWasm = partidaAislada(raiz, 'perfil-impuesto');   // otra vez limpia: el nativo escribió la suya
  const vw = await correr(`${ETIQUETA}-wasm`, process.execPath, ['--experimental-wasm-jspi', ...WASM_FLAGS, '--cpu-prof',
    '--cpu-prof-interval', '50', '--cpu-prof-dir', dirWasm, path.join(raiz, 'web/node/correr.mjs'), String(CUADROS)], { MKW_RR_RAIZ: rrWasm });
  trabajo = { nativo: media(vn.ventanas), wasm: media(vw.ventanas), ventanasNativo: vn.ventanas, ventanasWasm: vw.ventanas,
    horasNativo: vn.horas, horasWasm: vw.horas };
  writeFileSync(path.join(carpeta, `${ETIQUETA}-trabajo.json`), JSON.stringify(trabajo));
} else if (existsSync(path.join(carpeta, `${ETIQUETA}-trabajo.json`))) {
  trabajo = JSON.parse(readFileSync(path.join(carpeta, `${ETIQUETA}-trabajo.json`), 'utf8'));
}

// ---------- 2) los nombres ----------
// la clave de emparejar: las funciones del juego por su dirección de la Wii (en el nativo «func_801A1138», en el
// wasm «SelectThread_801a9c08» o «rr_kamek_8186868C»); el resto por su nombre sin argumentos ni tipo de retorno
function clave(nombre) {
  const g = /(?:^|_)(8[0-9a-fA-F]{7})$/.exec(nombre);
  if (g) return `${nombre.startsWith('rr_') ? nombre.replace(/_?8[0-9a-fA-F]{7}$/, '') + ':' : 'g:'}${g[1].toLowerCase()}`;
  let n = nombre.replace(/std::__2::/g, 'std::').replace(/\b(class|struct|enum) /g, '');
  // hasta el primer «(» que no esté dentro de <…>
  let prof = 0, corte = n.length;
  for (let i = 0; i < n.length; i++) {
    const c = n[i];
    if (c === '<') prof++; else if (c === '>') prof--; else if (c === '(' && prof === 0 && i > 0) { corte = i; break; }
  }
  n = n.slice(0, corte);
  // la última palabra fuera de <…> (saca «public: static void __cdecl »)
  prof = 0; let ini = 0;
  for (let i = 0; i < n.length; i++) { const c = n[i]; if (c === '<') prof++; else if (c === '>') prof--; else if (c === ' ' && prof === 0) ini = i + 1; }
  return n.slice(ini).replace(/\s+/g, '');
}
// qué clase de cosa es (para sumar por grupo)
function grupo(k, nombreLargo) {
  if (k === '[archivos]') return 'archivos y registro (Node / Windows; en la página es MEMFS)';
  if (k.startsWith('g:')) return 'juego traducido (func_…)';
  if (/^rr_/.test(k)) return 'Retro Rewind traducido (rr_…)';
  if (/^(\(garbage collector\))$/.test(k)) return 'recolector de basura de V8';
  // las promesas y microtareas de JSPI (cada suspensión del juego es una promesa que se resuelve, M10)
  if (/enqueueMicrotask|handleAsync|Promise|promise|Suspending|runMicrotasks|processTicksAndRejections|\[js\] .*(Asyncify|JSPI|async)/i.test(nombreLargo)) return 'JSPI: promesas y microtareas';
  // la hora: en wasm cada lectura sale a JavaScript (clock_time_get devuelve un BigInt); nativo, una instrucción
  if (/clock_time_get|bigintToI53|emscripten_get_now|ReadSystemTime|GetTick|Clock|steady_clock|_Query_perf|^\[js\] (now|get) /i.test(nombreLargo)) return 'la hora (reloj del sistema)';
  if (/^\((program|idle)\)$/.test(k)) return 'V8 por dentro (program)';
  if (/^(wasm-to-js|js-to-wasm)$/.test(k)) return 'puentes wasm↔JS';
  if (/^\[js\]/.test(nombreLargo)) return 'JavaScript (pegamento de emscripten, Node)';
  if (/^\[mod\]/.test(nombreLargo)) return 'sistema (DLL: ntdll, kernel, ucrt)';
  if (/Memory|GuestFlat|Flat[A-Z]|Read(Resolved)?(U|S)?\d|Write\d|ByteSwap|bswap|Mmio|PageTable|Resolve/i.test(k)) return 'memoria de la Wii (runtime)';
  // las llamadas directas que arma el traductor (un «trampolín» por destino: InvokeDirectCpu<dirección>, AbiRawCpuThunk)
  if (/InvokeDirectCpu|AbiRawCpuThunk|CpuThunk/.test(nombreLargo)) return 'llamadas directas del traductor (trampolines)';
  if (/Dispatch|InvokeIndirect|FindRaw|TranslatedFunctionRegistry|Indirect|Thunk|LookupGuest/i.test(k)) return 'despacho de llamadas (runtime)';
  if (/^PPC_|Fpu|fpu|Quantiz|Paired|Ps[A-Z]|Fma|Fms|Frsqrte|Fres|Convert/i.test(k)) return 'ayudantes de PowerPC (semántica)';
  if (/aurora|GX|gx_|Gx|Texture|Pipeline/i.test(k)) return 'aurora / GX (sin pantalla)';
  if (/Audio|DSP|AX|Dsp|Mix|Resampl/i.test(k)) return 'sonido (HLE)';
  if (/Fiber|Thread|Switch|Scheduler|Alarm|OS_|Clock|Tick|time|now/i.test(k)) return 'hilos, relojes y alarmas (HLE)';
  if (/memcpy|memset|memmove|malloc|free|operator/i.test(k)) return 'libc (memcpy, malloc)';
  return 'otro runtime / bibliotecas';
}

// ---------- 3) el nativo: muestras + mapa ----------
function leerMapa() {
  const txt = readFileSync(path.join(dirNativo, 'mkw-nativo.map'), 'latin1').split('\n');
  const base0 = 0x140000000n;
  const filas = [];
  for (const l of txt) {
    const m = /^\s*0001:[0-9a-f]+\s+(\S+)\s+([0-9a-f]{16})\s+(?:f\s+)?(?:i\s+)?\S+/.exec(l);
    if (m) filas.push([Number(BigInt('0x' + m[2]) - base0), m[1]]);
  }
  filas.sort((a, b) => a[0] - b[0]);
  // los nombres decorados de C++ de Microsoft («?Foo@Bar@@…») se traducen con llvm-cxxfilt, de a miles
  const deco = [...new Set(filas.map((f) => f[1]).filter((n) => n.startsWith('?')))];
  const cxxfilt = 'C:/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/Llvm/x64/bin/llvm-cxxfilt.exe';
  const traducido = new Map();
  for (let i = 0; i < deco.length; i += 20000) {
    const lote = deco.slice(i, i + 20000);
    const r = spawnSync(cxxfilt, [], { input: lote.join('\n'), maxBuffer: 1 << 28 });
    const salida = String(r.stdout).split(/\r?\n/);
    lote.forEach((n, j) => traducido.set(n, salida[j] || n));
  }
  return { rva: filas.map((f) => f[0]), nombre: filas.map((f) => traducido.get(f[1]) || f[1]) };
}
function analizarNativo() {
  const mapa = leerMapa();
  const mods = readFileSync(binNativo + '.modulos', 'utf8').trim().split('\n').map((l) => {
    const [b, t, ...n] = l.trim().split(' '); return { base: parseInt(b, 16), tam: parseInt(t, 16), nombre: n.join(' ') };
  });
  const exe = mods.find((m) => /mkw-nativo\.exe$/i.test(m.nombre));
  const info = JSON.parse(readFileSync(binNativo + '.info', 'utf8'));
  const cache = new Map();
  const simbolo = (pc) => {
    let s = cache.get(pc);
    if (s) return s;
    if (pc >= exe.base && pc < exe.base + exe.tam) {
      const r = pc - exe.base;
      let lo = 0, hi = mapa.rva.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (mapa.rva[mid] <= r) lo = mid; else hi = mid - 1; }
      s = mapa.nombre[lo];
    } else {
      const m = mods.find((x) => pc >= x.base && pc < x.base + x.tam);
      s = `[mod] ${m ? m.nombre : '?'}`;
    }
    cache.set(pc, s);
    return s;
  };
  const buf = readFileSync(binNativo);
  const porHilo = new Map();
  const muestras = [];
  for (let o = 0; o + 24 <= buf.length;) {
    const hilo = buf.readUInt32LE(o), ms = buf.readUInt32LE(o + 4);
    const ciclos = Number(buf.readBigUInt64LE(o + 8)), n = buf.readUInt32LE(o + 16);
    const pcs = [];
    for (let j = 0; j < n; j++) pcs.push(Number(buf.readBigUInt64LE(o + 24 + j * 8)));
    o += 24 + n * 8;
    muestras.push({ hilo, ms, ciclos, pcs });
    porHilo.set(hilo, (porHilo.get(hilo) || 0) + ciclos);
  }
  const hiloJuego = [...porHilo].sort((a, b) => b[1] - a[1])[0][0];
  const otros = Object.fromEntries([...porHilo].filter(([h]) => h !== hiloJuego).map(([h, c]) => [h, +(c / info.ciclosPorMs).toFixed(1)]));
  const propio = new Map(), cadenasEspera = new Map();
  let espera = 0, total = 0, nJuego = 0, servicio = 0, quietas = 0;
  const paradas = new Map(), esperaPor = new Map();
  const desdeMs = trabajo.horasNativo?.[DESDE]?.ms ?? 0, hastaMs = trabajo.horasNativo?.[CUADROS]?.ms ?? Infinity;
  for (const m of muestras) {
    if (m.hilo !== hiloJuego || m.ms < desdeMs || m.ms > hastaMs) continue;
    nJuego++;
    const ms = m.ciclos / info.ciclosPorMs;
    const nombres = m.pcs.map(simbolo);
    if (!m.ciclos) {   // una mirada con el hilo parado: dónde se bloquea (sin la espera del ritmo)
      quietas++;
      if (!nombres.some((x) => ESPERA.test(x))) {
        const c = nombres.filter((x) => !/^\[mod\]/.test(x)).slice(0, 4).join(' ← ');
        paradas.set(c, (paradas.get(c) || 0) + 1);
      }
      continue;
    }
    // sin pila (lo normal): la espera se reconoce por dónde iba: la espera del ritmo, el planificador, o el sistema
    // (ntdll: el reloj QueryPerformanceCounter y los bloqueos; con 16 lógicos libres nada más lo usa en la carrera)
    if (esEsperaPila(nombres) || ((nombres.length === 1 || nombres.slice(1).every((x) => /^\[mod\]/.test(x))) && (PLANIFICADOR.test(nombres[0]) || /^\[mod\] ntdll/.test(nombres[0]) || /steady_clock|_Query_perf/.test(nombres[0])))) { espera += ms; { const kk = nombres.slice(0, 4).join(' ← '); esperaPor.set(kk, (esperaPor.get(kk) || 0) + ms); } continue; }
    if (nombres.some((x) => PLANIFICADOR.test(x))) servicio += ms;
    total += ms;
    let k = nombres[0];
    if (nombres.some((x) => ARCHIVOS.test(x))) k = '[archivos]';
    else if (/^\[mod\]/.test(k)) k = `${k} ← ${nombres.find((x) => !/^\[mod\]/.test(x)) || '?'}`;
    propio.set(k, (propio.get(k) || 0) + ms);
    if (/^\[mod\]/.test(nombres[0])) { const c = nombres.slice(0, 5).join(' ← '); cadenasEspera.set(c, (cadenasEspera.get(c) || 0) + ms); }
  }
  return { propio, espera, total, servicio, muestras: nJuego, otrosHilosMs: otros, quietas, esperaPor,
    paradas: [...paradas].sort((a, b) => b[1] - a[1]).slice(0, 15),
    sistemaCadenas: [...cadenasEspera].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, v]) => [c, +v.toFixed(1)]) };
}
// lo que es esperar el barrido, no trabajar (vi.cpp: SleepPreciselyUntil y la espera de la página). En el wasm, Binaryen
// (wasm-opt) mete el bucle de espera dentro del planificador del juego, SelectThread (0x801A9C08, «func_801A9C08» en el
// nativo): toda muestra con él en la pila es esperar el próximo hilo listo, en los dos lados por igual
const ESPERA = /SleepPreciselyUntil|mkw_web_espera_reloj|emscripten_sleep|^\(idle\)$/i;
const PLANIFICADOR = /801a9c08/i;
// …pero debajo del planificador también se atienden las alarmas y el sonido entre siesta y siesta (vi.cpp): eso es
// trabajo (§153 lo contó así). Espera pura = mirar el reloj girando, o el propio planificador (el bucle metido adentro)
const RELOJ = /^(now|_clock_time_get|bigintToI53Checked|_emscripten_get_now|wasm-to-js|get|wrappedFn|\[js\] (now|_clock_time_get|bigintToI53Checked|_emscripten_get_now|get|wrappedFn) .*|\[mod\] ntdll\.dll ← .*(now|Clock|chrono).*)$/;
// (en Node la hora pasa por performance.now, envuelto: «validators < wrappedFn < now < _emscripten_get_now»)
const RELOJ_NODE = /_emscripten_get_now|_clock_time_get/;
const esEsperaPila = (nombres) => nombres.some((x) => ESPERA.test(x)) ||
  (nombres.some((x) => PLANIFICADOR.test(x)) && nombres.slice(0, 5).some((x) => RELOJ_NODE.test(x))) ||
  (nombres.some((x) => PLANIFICADOR.test(x)) && (PLANIFICADOR.test(nombres[0]) || RELOJ.test(nombres[0]) || RELOJ.test(nombres.slice(0, 2).join(' ← '))));
// leer archivos y escribir el registro: en el modo Node va por NODEFS (stat/lstat de Node) y en el nativo por Windows;
// en la página es MEMFS (todo en memoria): no es parte del impuesto del motor, va aparte
const ARCHIVOS = /^(lstat|stat|fstat|read|open|close|writeBuffer|readdir)$|_fd_(write|read|seek|close)|___syscall|readFileSync|getWasmBinary|instantiate|filesystem|_read_nolock|_write_nolock|fopen|ScanDirectory|wsopen|PathExists|__std_fs|NAND_IOS|CreateFile/i;

// ---------- 4) el wasm: el perfil de V8 ----------
function analizarWasm() {
  const archivo = readdirSync(dirWasm).filter((f) => f.endsWith('.cpuprofile')).map((f) => path.join(dirWasm, f))
    .sort((a, b) => readFileSync(b).length - readFileSync(a).length)[0];   // el del proceso que corrió el juego
  const p = JSON.parse(readFileSync(archivo, 'utf8'));
  const porId = new Map(p.nodes.map((n) => [n.id, n]));
  const padre = new Map();
  for (const n of p.nodes) for (const c of n.children || []) padre.set(c, n.id);
  const cadena = (id) => { const o = []; while (id !== undefined) { o.push(nombreDe(porId.get(id))); id = padre.get(id); } return o; };
  const esEspera = new Map(), enPlan = new Map();
  const enEspera = (id) => {
    if (!esEspera.has(id)) { const c = cadena(id); esEspera.set(id, esEsperaPila(c)); enPlan.set(id, c.some((x) => PLANIFICADOR.test(x))); }
    return esEspera.get(id);
  };
  const deArch = new Map();
  const enArchivos = (id) => {
    if (deArch.has(id)) return deArch.get(id);
    const v = ARCHIVOS.test(porId.get(id).callFrame.functionName) || (padre.has(id) && enArchivos(padre.get(id)));
    deArch.set(id, v);
    return v;
  };
  const nombreDe = (n) => {
    const f = n.callFrame, url = f.url || '';
    if (url.startsWith('wasm://')) return f.functionName;
    if (!url) return f.functionName || '(anónima)';
    return `[js] ${f.functionName || '(anónima)'} ${url.replace(/^.*[\\/]/, '')}`;
  };
  const propio = new Map();
  let espera = 0, total = 0, t = p.startTime, servicio = 0;
  const esperaPor = new Map(), servicioPor = new Map();
  const desdeUs = trabajo.horasWasm?.[DESDE]?.us ?? 0, hastaUs = trabajo.horasWasm?.[CUADROS]?.us ?? Infinity;
  for (let i = 0; i < p.samples.length; i++) {
    t += p.timeDeltas[i] ?? 0;
    if (t < desdeUs || t > hastaUs) continue;
    const ms = (p.timeDeltas[i + 1] ?? 0) / 1000;
    const id = p.samples[i];
    if (enEspera(id)) { espera += ms; const k = nombreDe(porId.get(id)); esperaPor.set(k, (esperaPor.get(k) || 0) + ms); continue; }
    total += ms;
    if (enPlan.get(id)) { servicio += ms; const c = cadena(id).slice(0, 4).join(' < '); servicioPor.set(c, (servicioPor.get(c) || 0) + ms); }
    let k = nombreDe(porId.get(id));
    if (enArchivos(id)) k = '[archivos]';
    propio.set(k, (propio.get(k) || 0) + ms);
  }
  return { propio, espera, total, servicio, esperaPor, servicioPor, muestras: p.samples.length, archivo: path.relative(raiz, archivo) };
}

// ---------- 4b) --solo-perfil <archivo.cpuprofile>: un perfil de la página (medir-sitio --perfilar) por grupos ----------
// En la página la espera es otra (mkw_web_espera_reloj, la toma de aurora, el resto de la página): aquí se reparte
// TODO lo que no es (idle), en ms por segundo de perfil, por los mismos grupos (sin nativo con qué comparar)
const SOLO_PERFIL = opcion('--solo-perfil', null);
if (SOLO_PERFIL) {
  const p = JSON.parse(readFileSync(SOLO_PERFIL, 'utf8'));
  const porId = new Map(p.nodes.map((n) => [n.id, n])), padre = new Map();
  for (const n of p.nodes) for (const c of n.children || []) padre.set(c, n.id);
  const nombreDe = (n) => { const f = n.callFrame, url = f.url || ''; return url.startsWith('wasm://') || /\.wasm(\?|$)/.test(url) || !url ? (f.functionName || '(anónima)') : `[js] ${f.functionName || '(anónima)'} ${url.replace(/^.*[\/]/, '')}`; };
  const cadena = (id) => { const o = []; while (id !== undefined) { o.push(nombreDe(porId.get(id))); id = padre.get(id); } return o; };
  const porG = {}, porF = new Map(); let total = 0;
  const dur = (p.endTime - p.startTime) / 1e6;
  for (let i = 0; i < p.samples.length; i++) {
    const ms = (p.timeDeltas[i + 1] ?? 0) / 1000, c = cadena(p.samples[i]);
    if (c[0] === '(idle)') continue;
    const k = /^\[js\]|^\(/.test(c[0]) ? c[0] : clave(c[0]);
    let gr = esEsperaPila(c) ? 'espera (reloj, planificador, espera de la página)' : grupo(k, c[0]);
    if (/^\[js\]/.test(c[0]) && !/mkw\.js/.test(c[0])) gr = 'JavaScript de la página (no el pegamento)';
    porG[gr] = (porG[gr] || 0) + ms; total += ms;
    porF.set(c[0], (porF.get(c[0]) || 0) + ms);
  }
  const salida = { archivo: SOLO_PERFIL, segundos: dur, msOcupadoPorSegundo: total / dur,
    grupos: Object.fromEntries(Object.entries(porG).sort((a, b) => b[1] - a[1]).map(([g, v]) => [g, { msPorSegundo: +(v / dur).toFixed(2), parte: +(v / total * 100).toFixed(1) }])),
    funciones: [...porF].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, v]) => [n.slice(0, 120), +(v / dur).toFixed(2)]) };
  writeFileSync(path.join(carpeta, `${ETIQUETA}-pagina.json`), JSON.stringify(salida, null, 1));
  console.log(`ocupado ${salida.msOcupadoPorSegundo.toFixed(0)} ms por segundo de perfil (${dur.toFixed(0)} s)`);
  for (const [g, v] of Object.entries(salida.grupos)) console.log(`  ${g.padEnd(52)} ${String(v.msPorSegundo).padStart(7)} ms/s  ${String(v.parte).padStart(5)} %`);
  process.exit(0);
}

// ---------- 5) emparejar y la tabla ----------
const CONTADOS = CUADROS - (trabajo.horasNativo ? DESDE : 0);   // cuántos cuadros entran en la cuenta
const N = analizarNativo(), W = analizarWasm();
const porClave = new Map();
const sumar = (lado, mapa) => {
  for (const [nombre, ms] of mapa) {
    const k = /^\[(mod|js|archivos)\]|^\(/.test(nombre) ? nombre : clave(nombre);
    const e = porClave.get(k) || { clave: k, nombre, nativo: 0, wasm: 0 };
    e[lado] += ms / CONTADOS;
    if (lado === 'wasm' && !/^\[/.test(nombre)) e.nombre = nombre;
    porClave.set(k, e);
  }
};
sumar('nativo', N.propio); sumar('wasm', W.propio);
const filas = [...porClave.values()].map((e) => ({ ...e, grupo: grupo(e.clave, e.nombre), dif: e.wasm - e.nativo,
  razon: e.nativo > 0 ? e.wasm / e.nativo : null }));
const grupos = {};
for (const f of filas) {
  const g = (grupos[f.grupo] ??= { nativo: 0, wasm: 0, funciones: 0 });
  g.nativo += f.nativo; g.wasm += f.wasm; g.funciones++;
}
const totN = N.total / CONTADOS, totW = W.total / CONTADOS, dif = totW - totN;
const mediaDesde = (v) => { const xs = Object.entries(v || {}).filter(([c]) => +c > DESDE).map(([, x]) => x); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null; };
const r3 = (x) => +x.toFixed(4);
const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => [k.slice(0, 160), r3(v / CONTADOS)]);
const resumen = {
  cuadros: CUADROS, nativo: NATIVO, wasmFlags: WASM_FLAGS,
  trabajoDelRegistro: { nativo: trabajo.nativo, wasm: trabajo.wasm, nativoDesde: mediaDesde(trabajo.ventanasNativo), wasmDesde: mediaDesde(trabajo.ventanasWasm) },
  perfil: { nativoMsPorCuadro: r3(totN), wasmMsPorCuadro: r3(totW), razon: +(totW / totN).toFixed(2),
    esperaNativoMsPorCuadro: r3(N.espera / CONTADOS), esperaWasmMsPorCuadro: r3(W.espera / CONTADOS), desde: DESDE, contados: CONTADOS,
    servicioEnEsperaNativo: r3(N.servicio / CONTADOS), servicioEnEsperaWasm: r3(W.servicio / CONTADOS),
    muestrasNativo: N.muestras, muestrasWasm: W.muestras, otrosHilosNativoMs: N.otrosHilosMs, archivoWasm: W.archivo },
  grupos: Object.fromEntries(Object.entries(grupos).sort((a, b) => (b[1].wasm - b[1].nativo) - (a[1].wasm - a[1].nativo))
    .map(([g, v]) => [g, { nativo: r3(v.nativo), wasm: r3(v.wasm), dif: r3(v.wasm - v.nativo),
      parteDeLaDif: +((v.wasm - v.nativo) / dif * 100).toFixed(1), razon: v.nativo ? +(v.wasm / v.nativo).toFixed(2) : null, funciones: v.funciones }])),
  masPesadasWasm: filas.sort((a, b) => b.wasm - a.wasm).slice(0, 60).map((f) => ({ ...f, nativo: r3(f.nativo), wasm: r3(f.wasm), dif: r3(f.dif), razon: f.razon && +f.razon.toFixed(2) })),
  masDiferencia: [...filas].sort((a, b) => b.dif - a.dif).slice(0, 60).map((f) => ({ ...f, nativo: r3(f.nativo), wasm: r3(f.wasm), dif: r3(f.dif), razon: f.razon && +f.razon.toFixed(2) })),
  sistemaNativo: N.sistemaCadenas,
  // las 12 que más diferencia hacen dentro de cada grupo
  porGrupo: Object.fromEntries(Object.keys(grupos).map((g) => [g, filas.filter((f) => f.grupo === g).sort((a, b) => b.dif - a.dif).slice(0, 12)
    .map((f) => [f.nombre.slice(0, 120), r3(f.nativo), r3(f.wasm)])])),
  // las miradas con el hilo parado (cada ~1 ms): cuántas y, de las que no son la espera del ritmo, dónde
  // de qué está hecha la espera de cada lado y el «servicio dentro de la espera» del wasm (ms por cuadro)
  esperaNativo: top(N.esperaPor), esperaWasm: top(W.esperaPor), servicioWasm: top(W.servicioPor),
  paradoNativo: { miradas: N.quietas, fueraDeLaEspera: N.paradas },
};
writeFileSync(path.join(carpeta, `${ETIQUETA}-resumen.json`), JSON.stringify(resumen, null, 1));
console.log(`trabajo (registro, desde el cuadro ${DESDE}): nativo ${resumen.trabajoDelRegistro.nativoDesde?.toFixed(3)} · wasm ${resumen.trabajoDelRegistro.wasmDesde?.toFixed(3)} ms/cuadro`);
console.log(`perfil (sin esperas): nativo ${totN.toFixed(3)} · wasm ${totW.toFixed(3)} ms/cuadro · ×${(totW / totN).toFixed(2)} (esperas ${resumen.perfil.esperaNativoMsPorCuadro} / ${resumen.perfil.esperaWasmMsPorCuadro})`);
console.log('\npor grupo (ms por cuadro: nativo → wasm, parte de la diferencia):');
for (const [g, v] of Object.entries(resumen.grupos)) console.log(`  ${g.padEnd(44)} ${v.nativo.toFixed(3)} → ${v.wasm.toFixed(3)}  ${String(v.parteDeLaDif).padStart(6)} %  ×${v.razon ?? '-'}`);
console.log('\nlas 25 que más diferencia hacen:');
for (const f of resumen.masDiferencia.slice(0, 25)) console.log(`  ${f.dif.toFixed(4)}  ${f.nativo.toFixed(4)} → ${f.wasm.toFixed(4)}  ×${f.razon ?? '-'}  ${f.nombre.slice(0, 90)}`);
console.log(`→ ${path.relative(raiz, path.join(carpeta, `${ETIQUETA}-resumen.json`))}`);
