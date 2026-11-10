// ¿El motor nuevo da el mismo juego, bit por bit? (paso 6 del plan de rendimiento, bitácora §170)
//
// Resumen: corre el juego en Node con dos programas (el «antes» y el «después» de un cambio del motor), cada uno con una
// partida nueva y el mismo guion de botones de §165 (los menús, una carrera de 12 en CPU, A apretado), N cuadros. Al
// terminar, cada uno guarda la RAM entera de la Wii (MEM1 24 MB + MEM2 128 MB, MKW_HEADLESS_DUMP de aurora_manual.cpp).
// Si el cambio solo cambió CÓMO se llega a la memoria (y no QUÉ se calcula), las dos RAM tendrían que ser idénticas byte
// a byte. Primero corre el «antes» dos veces, para probar que la comparación misma es justa (si el antes contra el
// antes ya difiere, la prueba no sirve y lo dice).
// **Medido en §170: hoy NO sirve.** En Node el programa mismo contra sí mismo deja 25 MB distintos tras 4900 cuadros
// (593 bloques de 64 KB, sobre todo los montones de MEM1 y MEM2): antes de la carrera la hora de la Wii, las alarmas,
// el sonido y el disco van con el reloj real de la PC, y dos corridas toman caminos distintos (el reloj fijo de la sala,
// g_mkwRelojFijo, solo cubre la carrera). La prueba de «hacen lo mismo» es la sala con un programa en cada consola:
// `prueba-sincro.mjs --directa --build-b=<otro programa>` (la huella de la sala, toda la carrera).
//
// Uso:  node herramientas/comparar-volcado.mjs [--antes build/web-motor-base/node] [--despues build/web-motor/node]
//                                              [--cuadros 4900] [--sin-repetir] [--tope-min 12]
//       → ✓/✗ y, si difieren, los bloques de 64 KB distintos (direcciones de la Wii). Las RAM quedan en
//         build/web/datos/volcados/ (contenido del juego: nunca a git).
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const antes = arg('--antes', 'build/web-motor-base/node');
const despues = arg('--despues', 'build/web-motor/node');
const cuadros = arg('--cuadros', '4900');
const topeMin = Number(arg('--tope-min', 12));
const guion = readFileSync(path.join(raiz, 'build/web/datos/impuesto-perfil/guion-165.txt'), 'utf8').trim();
const carpeta = path.join(raiz, 'build/web/datos/volcados');
mkdirSync(carpeta, { recursive: true });

// una corrida: partida nueva, el guion, N cuadros; devuelve la ruta de su copia de la RAM
function corre(build, nombre) {
  return new Promise((listo, falla) => {
    const datos = path.join(carpeta, 'datos-' + nombre);
    rmSync(datos, { recursive: true, force: true });
    const env = { ...process.env, MKW_NODE_DATOS: datos, MKW_BUILD_NODE: build, MKW_HEADLESS_GUION: guion };
    const hijo = spawn(process.execPath, ['--experimental-wasm-jspi', 'web/node/correr.mjs', cuadros], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let cola = '';
    hijo.stdout.on('data', b => { cola = (cola + b).slice(-2000); });
    hijo.stderr.on('data', b => { cola = (cola + b).slice(-2000); });
    // nada trabado: pasado el tope se corta ESTE proceso (el nuestro), nada más
    const reloj = setTimeout(() => { console.log(`  ${nombre}: pasó de ${topeMin} min, la corto`); hijo.kill(); }, topeMin * 60000);
    hijo.on('exit', () => {
      clearTimeout(reloj);
      const v = path.join(datos, 'volcado.bin');
      if (!existsSync(v)) { falla(new Error(`${nombre}: no dejó volcado.bin\n${cola}`)); return; }
      const copia = path.join(carpeta, nombre + '.bin');
      copyFileSync(v, copia);
      listo(copia);
    });
  });
}

const huella = f => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
// los bloques de 64 KB distintos, con su dirección de la Wii (MEM1 desde 0x80000000, MEM2 desde 0x90000000)
function distintos(a, b) {
  const A = readFileSync(a), B = readFileSync(b), bloque = 0x10000, mem1 = 24 * 1024 * 1024, out = [];
  for (let o = 0; o < Math.min(A.length, B.length); o += bloque) {
    if (A.subarray(o, o + bloque).equals(B.subarray(o, o + bloque))) continue;
    let primero = o; while (A[primero] === B[primero]) primero++;
    const dir = primero < mem1 ? 0x80000000 + primero : 0x90000000 + (primero - mem1);
    out.push('0x' + dir.toString(16).toUpperCase());
  }
  return { tam: [A.length, B.length], bloques: out };
}

let bien = 0, mal = 0;
const ok = (n, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
console.log(`comparar la RAM de la Wii tras ${cuadros} cuadros: antes = ${antes}, después = ${despues}`);
const a1 = await corre(antes, 'antes-1');
if (!process.argv.includes('--sin-repetir')) {
  const a2 = await corre(antes, 'antes-2');
  const d = distintos(a1, a2);
  ok('el antes contra el antes (la prueba misma es justa)', d.bloques.length === 0, d.bloques.length ? `${d.bloques.length} bloques: ${d.bloques.slice(0, 8).join(' ')}` : huella(a1));
}
const d1 = await corre(despues, 'despues-1');
const d = distintos(a1, d1);
ok('el después da la misma RAM que el antes, byte por byte', d.bloques.length === 0 && d.tam[0] === d.tam[1],
  d.bloques.length ? `${d.bloques.length} bloques distintos: ${d.bloques.slice(0, 8).join(' ')}` : `${huella(a1)} = ${huella(d1)}`);
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
