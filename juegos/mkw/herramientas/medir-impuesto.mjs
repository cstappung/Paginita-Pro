// El «impuesto del navegador» (N1 del plan de rendimiento, bitácora §153): el MISMO juego, los MISMOS cuadros, en un
// programa de Windows (herramientas/compilar-nativo.py) y en WebAssembly (el modo sin pantalla de Node, que es el
// mismo .wasm sin la página: misma máquina de V8 que Chrome). Cuánto más trabaja el wasm por cuadro = el impuesto.
//
// Resumen: los dos programas imprimen cada 60 cuadros «[aurora-headless] cuadro N (… trabajo X ms por cuadro …)»,
// donde trabajo = tiempo del cuadro menos lo que el juego esperó al siguiente barrido (vi.cpp). Se corren uno detrás
// del otro (nunca juntos: se robarían la CPU), sin pantalla, sin sonido (SDL «dummy»), sin red, en un hilo (el juego
// corre en un solo hilo en los dos; la mezcla de sonido aparte va apagada: mix_worker = false). Se comparan las
// ventanas de 60 cuadros con el mismo número (las mismas pantallas del juego: arranque, título y la carrera de
// demostración que el juego pone solo si nadie toca nada) y se da la razón wasm ÷ nativo por tramo y en total.
//
// Uso:  node herramientas/medir-impuesto.mjs [--cuadros 3600] [--nativos v3,v2,v3-revisado] [--repetir 2]
//       → build/web/datos/impuesto/resumen.json (+ los registros de cada corrida)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partidaAislada } from './partida-aislada.mjs';   // §175

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const CUADROS = Number(opcion('--cuadros', 3600));
const NATIVOS = opcion('--nativos', 'v3').split(',');
const REPETIR = Number(opcion('--repetir', 1));
const carpeta = path.join(raiz, 'build/web/datos/impuesto');
mkdirSync(carpeta, { recursive: true });
const wc = path.join(raiz, 'terceros/Wiicompiled');

// corre un programa y junta {cuadro: trabajo} de sus líneas
function correr(etiqueta, exe, args, env) {
  return new Promise((listo) => {
    const t0 = Date.now(), ventanas = {}, lineas = [];
    const p = spawn(exe, args, { cwd: wc, env: { ...process.env, ...env } });
    // (los pedazos de la salida cortan las líneas por cualquier lado: se arma cada línea entera antes de leerla)
    const resto = { out: '', err: '' };
    const leerDe = (k) => (d) => {
      const partes = (resto[k] + String(d)).split('\n');
      resto[k] = partes.pop();
      for (const l of partes) linea(l.replace(/\r$/, ''));
    };
    const linea = (l) => {
      {
        if (!l.trim()) return;
        lineas.push(l);
        const x = /\[aurora-headless\] cuadro (\d+) \(([\d.]+) fps, trabajo ([\d.]+) ms/.exec(l);
        if (x) ventanas[+x[1]] = +x[3];
        // (el nativo no sale solo después de «listo»: queda esperando un hilo al cerrar; se lo termina aquí)
        if (/\[aurora-headless\] listo:/.test(l)) setTimeout(() => p.kill(), 1500);
      }
    };
    p.stdout.on('data', leerDe('out')); p.stderr.on('data', leerDe('err'));
    p.on('close', (codigo) => {
      writeFileSync(path.join(carpeta, `${etiqueta}.log`), lineas.join('\n') + '\n');
      console.log(`${etiqueta}: ${Object.keys(ventanas).length} ventanas en ${((Date.now() - t0) / 1000).toFixed(0)} s (salida ${codigo})`);
      listo(ventanas);
    });
  });
}

// el nativo lee su Config.toml de <carpeta del .exe>/UserData (portable.txt al lado del .exe)
function prepararNativo(dir, rr) {
  writeFileSync(path.join(dir, 'portable.txt'), 'medir-impuesto\n');
  mkdirSync(path.join(dir, 'UserData'), { recursive: true });
  const abs = (p) => path.join(raiz, p).split(path.sep).join('/');
  writeFileSync(path.join(dir, 'UserData/Config.toml'), ['# Generado por herramientas/medir-impuesto.mjs',
    '[audio]', 'mix_worker = false', '', '[network]', 'enabled = false', '', '[discord]', 'enabled = false', '',
    '[paths]', `dvd_root = "${abs('extraido/disco')}"`, `retro_rewind_root = "${rr.split(path.sep).join('/')}"`, ''].join('\n'));
}

const mediana = (xs) => { const o = [...xs].sort((a, b) => a - b); return o.length ? o[o.length >> 1] : null; };
const corridas = {};
for (let r = 0; r < REPETIR; r++) {
  for (const n of NATIVOS) {
    const dir = path.join(raiz, `build/nativo-${n}`), exe = path.join(dir, 'mkw-nativo.exe');
    if (!existsSync(exe)) { console.log(`(falta ${exe}: python herramientas/compilar-nativo.py --cpu ${n})`); continue; }
    // §175: cada corrida con su propia partida limpia (partida-aislada.mjs; antes escribía en terceros/RetroRewind/riivolution)
    prepararNativo(dir, partidaAislada(raiz, 'medir-impuesto'));
    (corridas[`nativo-${n}`] ??= []).push(await correr(`nativo-${n}-${r}`, exe, [], { MKW_HEADLESS_FRAMES: String(CUADROS), SDL_AUDIO_DRIVER: 'dummy', SDL_VIDEO_DRIVER: 'dummy' }));
  }
  (corridas.wasm ??= []).push(await correr(`wasm-${r}`, process.execPath, [path.join(raiz, 'web/node/correr.mjs'), String(CUADROS)],
    { MKW_RR_RAIZ: partidaAislada(raiz, 'medir-impuesto') }));   // §175
}

// por ventana: la mediana de las repeticiones; por tramo (arranque < 600, título 600–1800, después) y total
const porVentana = (lista) => {
  const claves = new Set(lista.flatMap((v) => Object.keys(v)));
  return Object.fromEntries([...claves].map((k) => [k, mediana(lista.map((v) => v[k]).filter((x) => x !== undefined))]));
};
const tablas = Object.fromEntries(Object.entries(corridas).map(([k, l]) => [k, porVentana(l)]));
const tramos = { arranque: [0, 600], menus: [600, 1800], despues: [1800, 1e9], todo: [0, 1e9] };
const resumen = { cuadros: CUADROS, repetir: REPETIR, tramos: {} };
for (const [t, [a, b]] of Object.entries(tramos)) {
  resumen.tramos[t] = {};
  for (const [k, tabla] of Object.entries(tablas)) {
    const v = Object.entries(tabla).filter(([c]) => +c > a && +c <= b).map(([, x]) => x);
    resumen.tramos[t][k] = { ventanas: v.length, mediana: mediana(v), media: v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(3) : null };
  }
  for (const n of NATIVOS) {
    const w = resumen.tramos[t].wasm, x = resumen.tramos[t][`nativo-${n}`];
    if (w?.media && x?.media) resumen.tramos[t][`razon-${n}`] = +(w.media / x.media).toFixed(2);
  }
}
resumen.tablas = tablas;
writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 1));
for (const [t, f] of Object.entries(resumen.tramos)) {
  console.log(`${t.padEnd(9)} ` + Object.entries(f).map(([k, v]) => typeof v === 'number' ? `${k} ×${v}` : `${k} ${v.media ?? '-'} ms (med ${v.mediana ?? '-'}, ${v.ventanas})`).join(' · '));
}
console.log(`→ ${path.relative(raiz, path.join(carpeta, 'resumen.json'))}`);
