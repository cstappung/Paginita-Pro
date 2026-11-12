// Una copia del lockstep que además cuenta a quién le inventa los botones la autoridad (bitácora §281 parte 2; lo pidió
// la sesión de bugs: ¿son los botones del teléfono que llegan tarde o la historia que le falta a la autoridad nueva?).
//
// Resumen: lee web/navegador/lockstep.mjs tal como está, agrega UNA línea donde la autoridad inventa un botón
// (`est.inventados++`) y escribe la copia en build/ (no va a git). La línea solo anota, no cambia ninguna decisión:
//   est.invDe[uid]  = cuántos botones inventó para cada jugador;
//   est.invLog      = [hora (performance.now), uid, cuadro] de cada uno (tope 20.000).
// El servidor la sirve en lugar del original con MKW_SUSTITUIR=/lockstep.mjs=<copia> (solo pruebas, §230), así no se
// toca el archivo que comparten las otras sesiones.
// Uso:  node herramientas/lockstep-contado.mjs   → imprime la ruta de la copia
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fuente = path.join(raiz, 'web/navegador/lockstep.mjs');
const destino = path.join(raiz, 'build/lockstep-contado/lockstep.mjs');
let s = fs.readFileSync(fuente, 'utf8');
const ancla = 'if (!reserva) { est.inventados++;';
if (s.split(ancla).length !== 2) throw new Error(`no encuentro una sola vez «${ancla}» en lockstep.mjs (¿cambió?)`);
s = s.replace(ancla, ancla + ' { const u = duenoDe.get(m); (est.invDe ||= {})[u] = (est.invDe[u] || 0) + 1; if ((est.invLog ||= []).length < 20000) est.invLog.push([Math.round(ahora()), u, f]); }');
// (las importaciones relativas siguen bien: el navegador las resuelve contra la dirección /lockstep.mjs, no contra la carpeta)
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, s);
console.log(destino);
