// Arma la semilla de bloques (build/web/navegador/bloques.json) con el camino de verdad (bitácora §168, D9).
//
// Resumen: la semilla vieja salía de 6 corridas del mismo guion por los menús de un jugador y solo traía dos pistas (0 y
// 54), así que la 1.ª visita bajaba de fondo cosas de esas dos pistas que casi nadie corre. La nueva junta:
//   - las corridas grabadas con el camino de hoy (medir-carrera-entera.mjs --semilla: la página entra directo, la pantalla
//     de personaje y la carrera; cada corrida con otra pista y otras CPU), de las que solo queda lo que se repite en 2 o
//     más (lo de cada pista y cada CPU lo pide el paquete de carrera, §169);
//   - de la semilla vieja, solo lo que no es de una pista ni de un personaje (los menús de un jugador, que las corridas
//     nuevas no recorren): nada de Tracks/, strm/ ni Race/Kart/, Character/ ni Scene/Model/Kart/.
// Cada bloque queda con el cuadro más chico en que se vio (el orden en que el juego lo necesita) y «veces» ≥ 2.
// Nombres de archivos del juego: la semilla va con el .wasm (R2), nunca a git.
//
// Uso:  node herramientas/juntar-semilla.mjs <nueva.json> [vieja.json] [--salida build/web/navegador/bloques.json]
import { readFileSync, writeFileSync } from 'node:fs';

const iSalida = process.argv.indexOf('--salida');
const salida = iSalida > 0 ? process.argv[iSalida + 1] : 'build/web/navegador/bloques.json';
const args = process.argv.slice(2).filter((a, i) => !a.startsWith('--') && i + 2 !== iSalida + 1);
const [nueva, vieja] = [args[0], args[1]].map(a => a && JSON.parse(readFileSync(a, 'utf8')));
if (!nueva) { console.error('uso: node herramientas/juntar-semilla.mjs <nueva.json> [vieja.json]'); process.exit(1); }

const DE_UNA_CARRERA = /\/(Tracks|strm|Race\/Kart|Character|Scene\/Model\/Kart)\//;
const juntos = new Map();     // "ruta|bloque" → [ruta, bloque, cuadro, veces]
const minimo = nueva.corridas >= 2 ? 2 : 1;
for (const [ruta, b, cuadro, veces] of nueva.bloques) if (veces >= minimo) juntos.set(ruta + '|' + b, [ruta, b, cuadro, 2]);
let deLaVieja = 0;
if (vieja) {
  const minV = vieja.corridas >= 2 ? 2 : 1;
  for (const [ruta, b, cuadro, veces] of vieja.bloques) {
    if (veces < minV || DE_UNA_CARRERA.test(ruta)) continue;
    const k = ruta + '|' + b, v = juntos.get(k);
    if (v) v[2] = Math.min(v[2], cuadro);
    else { juntos.set(k, [ruta, b, cuadro, 2]); deLaVieja++; }
  }
}
const bloques = [...juntos.values()].sort((a, b) => a[2] - b[2]);
writeFileSync(salida, JSON.stringify({ corridas: 2, bloques }));
const mb = n => (n * 0.25).toFixed(1);
console.log(`semilla: ${bloques.length} bloques (~${mb(bloques.length)} MB; ${bloques.filter(x => x[2] < 450).length} del arranque) — ` +
            `${bloques.length - deLaVieja} de las corridas nuevas, ${deLaVieja} de la vieja (menús) → ${salida}`);
