// Una partida de Retro Rewind propia y limpia para cada corrida medida (bitácora §170, después de §175).
//
// Resumen: el juego corrido en Node o como programa de Windows guarda la partida de RR (rksys.dat) en
// <retro_rewind_root>/../riivolution/save, o sea en terceros/RetroRewind/riivolution/save, la carpeta de todos.
// Así la primera corrida creaba la licencia «no name» y todas las siguientes la encontraban hecha (otro camino por los
// menús), y lo que una herramienta dejaba lo veía la siguiente. Es como medir una placa con el condensador que dejó
// cargado la prueba anterior: cada medición tiene que partir descargada.
//
// Qué hace: arma build/aislado/<etiqueta>/RetroRewind6 como un árbol de ENLACES DUROS a terceros/RetroRewind/RetroRewind6
// (los mismos archivos con otro nombre: no ocupa espacio ni se copian 2 GB; un enlace «junction» no sirve, porque el
// runtime pasa la ruta por weakly_canonical y volvería a terceros/) y, antes de CADA corrida, borra
// build/aislado/<etiqueta>/riivolution y copia ahí la partida base limpia de §175 (build/web/partida-base: las 4
// licencias vacías). Devuelve la ruta para retro_rewind_root: Node la recibe por MKW_RR_RAIZ (web/node/correr.mjs) y el
// programa de Windows por su UserData/Config.toml.
//
// Uso (desde otra herramienta):  import { partidaAislada } from './partida-aislada.mjs';
//                                const rrRaiz = partidaAislada(raiz, 'medir-node');   // antes de cada corrida
import { existsSync, mkdirSync, readdirSync, linkSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { carpetaPartidaBase } from './partida-base.mjs';

// copia la carpeta como enlaces duros (cada archivo, el mismo en disco; las carpetas, nuevas)
function enlazarArbol(de, a) {
  mkdirSync(a, { recursive: true });
  for (const e of readdirSync(de, { withFileTypes: true })) {
    const o = path.join(de, e.name), d = path.join(a, e.name);
    if (e.isDirectory()) enlazarArbol(o, d);
    else if (!existsSync(d)) linkSync(o, d);
  }
}

export function partidaAislada(raiz, etiqueta) {
  const base = path.join(raiz, 'build/aislado', etiqueta);
  const rr = path.join(base, 'RetroRewind6');
  const listo = path.join(base, 'RetroRewind6.listo');   // fuera del árbol: el juego no lo ve
  if (!existsSync(listo)) {
    enlazarArbol(path.join(raiz, 'terceros/RetroRewind/RetroRewind6'), rr);
    writeFileSync(listo, 'árbol de enlaces duros a terceros/RetroRewind/RetroRewind6\n');
  }
  // la partida: borrar la de la corrida anterior (una carpeta nuestra, sin enlaces) y poner la base limpia
  const riivo = path.join(base, 'riivolution');
  rmSync(riivo, { recursive: true, force: true });
  cpSync(carpetaPartidaBase(raiz), riivo, { recursive: true });
  return rr;
}
