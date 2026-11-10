// W32 (bitácora §258): cuánto pesa la IA de las CPU en un perfil de CPU (.cpuprofile de medir-sitio --perfilar o de
// node --cpu-prof).
//
// Resumen: cada muestra del perfil es «en qué función estaba el hilo» con toda su pila. Se cuenta, para cada función que
// interesa, en cuántas muestras aparece en la pila (tiempo inclusivo: ella y todo lo que llama; una función recursiva
// cuenta una vez por muestra). Las de aquí (leídas en el código traducido):
//   func_8023B588 = el cálculo de la escena (la lógica de un cuadro, sin el dibujo)
//   func_8023B800 = el dibujo de la escena (lo que arma el juego para dibujar)
//   func_8058FFE8 = el cálculo de los 12 karts (la física y todo lo de cada kart)
//   func_807261B8 = la entrada del cerebro de la IA de cada kart (lo que W32 hace correr cada dos cuadros)
//   func_8074AF38 = la máquina de estados de la IA (adentro de lo anterior)
// Uso:  node herramientas/peso-ia.mjs <perfil.cpuprofile>
import { readFileSync } from 'node:fs';

const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const NOMBRES = { func_8023B588: 'cálculo de la escena (lógica)', func_8023B800: 'dibujo de la escena (juego)',
  func_8058FFE8: 'cálculo de los karts', func_807261B8: 'la IA (entrada del cerebro, todos los karts)',
  func_8074AF38: 'la IA (máquina de estados)' };
const nodos = new Map(p.nodes.map(n => [n.id, n]));
const padre = new Map(); for (const n of p.nodes) for (const c of n.children || []) padre.set(c, n.id);
const cuenta = new Map(); for (const s of p.samples) cuenta.set(s, (cuenta.get(s) || 0) + 1);
const incl = Object.fromEntries(Object.keys(NOMBRES).map(f => [f, 0]));
let juego = 0;
for (const [id, k] of cuenta) {
  const vistos = new Set(); let n = nodos.get(id), esJuego = false;
  while (n) { const f = n.callFrame.functionName.replace(/_traducida$/, '');
    if (f in incl && !vistos.has(f)) { vistos.add(f); incl[f] += k; }
    if (f === 'func_8023B588' || f === 'func_8023B800') esJuego = true;
    n = nodos.get(padre.get(n.id)); }
  if (esJuego) juego += k;
}
const total = p.samples.length, logica = incl.func_8023B588;
console.log(`muestras ${total}; lógica + dibujo del juego ${juego} (${(100 * juego / total).toFixed(1)} % del hilo)`);
for (const [f, nombre] of Object.entries(NOMBRES))
  console.log(`  ${f}  ${nombre.padEnd(46)} ${String(incl[f]).padStart(7)}  ${(100 * incl[f] / total).toFixed(2).padStart(6)} % del hilo  ` +
              `${(100 * incl[f] / (logica || 1)).toFixed(1).padStart(5)} % de la lógica  ${(100 * incl[f] / (juego || 1)).toFixed(1).padStart(5)} % de lógica+dibujo`);
