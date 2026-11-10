// Corre el juego UNA vez en Node con un guion de botones y una partida nueva (W4 de la etapa 0, bitácora §198), y
// guarda todo lo que imprime. Sirve para (1) ver por qué pantallas pasa un guion y a qué pista llega (MKW_HEADLESS_ESTADO:
// sección, página y pista cada 60 cuadros) y (2) correr un programa compilado con -fprofile-instr-generate para que deje
// su perfil (LLVM_PROFILE_FILE) al salir.
//
// Resumen: arma lo mismo que medir-node-estable.mjs para una corrida (la partida de RR limpia de partida-aislada.mjs, la
// carpeta de datos vacía, el guion, el estado), pero sin medir nada: solo corre web/node/correr.mjs y guarda la salida.
// Al final imprime las páginas por las que pasó (con su primer y último cuadro) y la pista de la carrera.
//
// Uso:  node herramientas/correr-guion.mjs --build build/web-w19/node --guion <archivo|texto> [--cuadros 6000]
//         [--log build/web/datos/w4/descubrir.log] [--perfil build/web/datos/w4/perfil-1.profraw] [--cpuprof carpeta]
//       (--guion: un archivo con «inicio+duración=máscara,…» o el texto mismo)
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partidaAislada } from './partida-aislada.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const build = arg('--build', 'build/web/node');
const g = arg('--guion', 'build/web/datos/impuesto-perfil/guion-170.txt');
const guion = existsSync(path.resolve(raiz, g)) ? readFileSync(path.resolve(raiz, g), 'utf8').trim() : g;
const cuadros = arg('--cuadros', '6000');
const log = path.resolve(raiz, arg('--log', 'build/web/datos/correr-guion.log'));
const perfil = arg('--perfil', null);
mkdirSync(path.dirname(log), { recursive: true });

const datos = path.join(raiz, 'build/web/datos/correr-guion-datos');
rmSync(datos, { recursive: true, force: true });             // partida nueva cada vez
const env = { ...process.env, MKW_NODE_DATOS: datos, MKW_HEADLESS_GUION: guion, MKW_HEADLESS_ESTADO: '1',
  MKW_HEADLESS_TRAMO: '600-2400', MKW_BUILD_NODE: build, MKW_RR_RAIZ: partidaAislada(raiz, 'correr-guion') };
if (perfil) { env.LLVM_PROFILE_FILE = perfil; mkdirSync(path.dirname(path.resolve(raiz, perfil)), { recursive: true }); }

// --cpuprof carpeta (H11, §214): el perfil de V8 de la corrida (qué funciones corren y cuánto) en esa carpeta
const cpuprof = arg('--cpuprof', null);
const v8 = cpuprof ? ['--cpu-prof', '--cpu-prof-dir', path.resolve(raiz, cpuprof)] : [];
const hijo = spawn(process.execPath, [...v8, '--experimental-wasm-jspi', 'web/node/correr.mjs', cuadros], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
let salida = '';
hijo.stdout.on('data', b => { salida += b; }); hijo.stderr.on('data', b => { salida += b; });
const fin = await new Promise(r => hijo.on('exit', r));
writeFileSync(log, salida);

// las páginas por las que pasó: «estado cuadro N: seccion S pagina P etapa E logica L pista K»
const tramos = [];
for (const m of salida.matchAll(/estado cuadro (\d+): seccion (0x[0-9a-f]+) pagina (0x[0-9a-f]+) etapa (-?\d+) logica (\d+)(?: pista (0x[0-9a-f]+))?/g)) {
  const [, c, s, p, , , k] = m, u = tramos.at(-1);
  if (u && u.s === s && u.p === p) { u.hasta = +c; u.pista = k; } else tramos.push({ s, p, desde: +c, hasta: +c, pista: k });
}
for (const t of tramos) console.log(`  cuadros ${t.desde}-${t.hasta}: sección ${t.s} página ${t.p}${t.pista ? ' pista ' + t.pista : ''}`);
const tramo = salida.match(/tramo 600-2400: .*trabajo ([\d.]+) ms/);
console.log(`salida ${fin}; ${tramo ? 'tramo: trabajo ' + tramo[1] + ' ms por cuadro de lógica' : 'sin tramo'}; registro en ${path.relative(raiz, log)}`);
if (perfil) console.log(`perfil: ${existsSync(path.resolve(raiz, perfil)) ? 'escrito' : 'NO escrito'} (${perfil})`);
