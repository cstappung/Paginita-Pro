// Junta listas de pipelines de aurora en una semilla (build/web/navegador/pipelines.bin), bitácora §172 (C3) y §174 (C2).
//
// Resumen: la semilla de pipelines es la lista que la 1.ª visita precalienta (pide al navegador que compile) mientras
// se ven el título y los menús. Sale de corridas con el juego (medir-carrera-entera.mjs --pipelines: una lista por
// pista, cada una con la semilla de antes + lo nuevo de su carrera). Esta herramienta las une sin repetir y en el orden
// en que conviene precalentar: primero los «urgentes» (primer cuadro 0: los que alguna vez se armaron de golpe en una
// pasada que no se puede saltar, aurora los marca así desde §172), después el resto por el primer cuadro en que se
// usaron (el título y los menús antes que la carrera).
// §174 (C2): las listas nuevas traen la ETIQUETA de cada pipeline (dónde se usó: los menús, una pista, o varias =
// «común»; web/navegador/lista-pipelines.mjs). Al juntar listas de pistas distintas, lo que aparece en dos pistas pasa a
// «común» y lo de los menús gana siempre; la semilla sale en el formato 2 con la visita en 0 (la semilla no se poda).
// Una lista del formato viejo deja sus pipelines sin etiqueta (= al arranque, como antes).
// Es contenido del juego armado por aurora: va con el .wasm (R2), nunca a git.
//
// Uso:  node herramientas/juntar-pipelines.mjs <lista1.bin> [lista2.bin …] [--salida build/web/navegador/pipelines.bin]
import { readFileSync, writeFileSync } from 'node:fs';
import { leer, escribir, juntar, resumen } from '../web/navegador/lista-pipelines.mjs';

const iSalida = process.argv.indexOf('--salida');
const salida = iSalida > 0 ? process.argv[iSalida + 1] : 'build/web/navegador/pipelines.bin';
const entradas = process.argv.slice(2).filter((a, i, t) => !a.startsWith('--') && t[i - 1] !== '--salida');
if (!entradas.length) { console.error('uso: node herramientas/juntar-pipelines.mjs <lista.bin> … [--salida X]'); process.exit(1); }

const listas = [];
for (const archivo of entradas) {
  let lista;
  try { lista = leer(new Uint8Array(readFileSync(archivo))); } catch (e) { console.error(`${archivo}: ${e.message}`); process.exit(1); }
  const r = resumen(lista);
  console.log(`${archivo}: ${r.total} pipelines, ${r.urgentes} urgentes · menús ${r.menus}, común ${r.comun}, sin etiqueta ${r.sin}, de una sola pista ${r.esperan}`);
  listas.push(lista);
}
const semilla = juntar(listas);
const bytes = escribir(semilla);
writeFileSync(salida, bytes);
const r = resumen(semilla);
console.log(`semilla de pipelines: ${r.total} (${r.urgentes} urgentes primero; al arranque ${r.arranque}: menús ${r.menus}, común ${r.comun}, ` +
            `sin etiqueta ${r.sin}; esperan su pista ${r.esperan} en ${r.pistas} pistas), ${(bytes.length / 1048576).toFixed(2)} MB → ${salida}`);
