// Corre todas las pruebas, una después de otra, y dice "N bien, M mal" (PLAN F1, bitácora §70).
//
// Resumen: cada prueba del proyecto termina escribiendo su cuenta ("9 bien, 0 mal", "21 de 21 páginas bien", "# pass
// 12"). Este programa las corre en fila (las que usan el juego no pueden ir a la vez: comparten la tarjeta de video y
// algunos puertos), guarda lo que escribió cada una y al final muestra una tabla: prueba, veces, bien, mal, tiempo, y
// las líneas ✗ de las que fallaron. Termina con código 1 si algo falló (sirve para un .bat o para revisar de un vistazo).
//   - Las pruebas nuevas de web/navegador/prueba-*.mjs entran solas (sin argumentos), aunque no estén en la lista.
//   - --repetir N corre cada una N veces y guarda CADA corrida aparte (con su carpeta de datos, si la prueba la tiene):
//     para cazar fallas que salen 1 de cada tantas veces (como el cuelgue al empezar la carrera, C4).
// Como una prueba de producción en una fábrica: el mismo banco de pruebas para cada placa, y la planilla al final.
//
// Uso:  node herramientas/correr-todo.mjs                    todas (las del juego tardan: ~25 min)
//       node herramientas/correr-todo.mjs --sin-juego        solo las que no abren el juego (banco, sitio, subida): ~2 min
//       node herramientas/correr-todo.mjs --solo sincro,caida --repetir 5
//       node herramientas/correr-todo.mjs --lista            muestra las pruebas y sale
// Deja todo en build/web/datos/todo/<fecha-hora>/: <prueba>[-n].txt (lo que escribió) y resumen.json.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, existsSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n, porDefecto) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : porDefecto; };
const nav = f => path.join('web/navegador', f);

// La lista: nombre, programa y argumentos, si abre el juego, la carpeta donde deja sus datos (se copia en cada
// repetición), si acepta --puerto=/--datos= (entonces cada repetición usa los suyos) y desde dónde se corre.
const PRUEBAS = [
  { n: 'banco', cmd: ['banco/correr.mjs'], juego: false },
  { n: 'sitio-mkw', cmd: ['--test', 'tests/mkw.test.cjs', 'tests/mkw-worker.test.cjs'], cwd: 'terceros/Paginita-Pro/colabtex', juego: false },
  { n: 'subir-r2', cmd: ['herramientas/prueba-subir-r2.mjs'], juego: false },
  { n: 'arranque-node', cmd: ['web/node/prueba-arranque.mjs'], juego: true },
  { n: 'navegador', cmd: [nav('prueba-navegador.mjs'), '1800'], juego: true },   // 30 s: el ajuste de ritmo del worklet (§88) centra la cola recién pasados ~20 s
  { n: 'partidas', cmd: [nav('prueba-partidas.mjs')], juego: true },
  { n: 'nube', cmd: [nav('prueba-nube.mjs')], juego: true },
  { n: 'tactil', cmd: [nav('prueba-tactil.mjs')], juego: true },
  { n: 'elegir', cmd: [nav('prueba-elegir.mjs')], juego: true },
  { n: 'piloto', cmd: [nav('prueba-piloto.mjs')], juego: true, datos: 'build/web/datos/piloto' },
  { n: 'menus', cmd: [nav('prueba-menus.mjs')], juego: true, datos: 'build/web/datos/menus' },
  { n: 'inicio', cmd: [nav('prueba-inicio.mjs')], juego: true },
  { n: 'caida', cmd: [nav('prueba-caida.mjs')], juego: true, datos: 'build/web/datos/caida', puerto: 8131 },
  { n: 'copa', cmd: [nav('prueba-copa.mjs')], juego: true },
  { n: 'sincro', cmd: [nav('prueba-sincro.mjs')], juego: true, datos: 'build/web/datos/sincro', propios: true },
  { n: 'sincro-sala', cmd: [nav('prueba-sincro.mjs'), '--sala'], juego: true, datos: 'build/web/datos/sincro', propios: true },
  { n: 'enlinea-sala', cmd: [nav('prueba-enlinea.mjs'), '--sala'], juego: true, datos: 'build/web/datos/enlinea' },
  { n: 'modos', cmd: [nav('prueba-modos.mjs')], juego: true, datos: 'build/web/datos/modos/copa' },                 // §72
  { n: 'modos-playlist', cmd: [nav('prueba-modos.mjs'), '--playlist'], juego: true, datos: 'build/web/datos/modos/playlist' },
  { n: 'directa', cmd: [nav('prueba-directa.mjs')], juego: true, datos: 'build/web/datos/directa' },               // §73
  { n: 'directa-elegir', cmd: [nav('prueba-directa.mjs'), '--elegir'], juego: true, datos: 'build/web/datos/directa-elegir' },
  { n: 'sincro-directa', cmd: [nav('prueba-sincro.mjs'), '--directa'], juego: true, datos: 'build/web/datos/sincro', propios: true },
  { n: 'sala', cmd: [nav('prueba-sala.mjs')], juego: true, datos: 'build/web/datos/sala' },                       // la sala sin Retro WFC
  { n: 'copa-azar', cmd: ['herramientas/copas-al-azar.mjs', '--copas', '1'], juego: true },   // una copa sincronizada al azar (C2)
];
// las prueba-*.mjs nuevas que no están en la lista: sin argumentos
const conocidas = new Set(PRUEBAS.flatMap(p => p.cmd.filter(c => /prueba-.*\.mjs$/.test(c)).map(c => path.basename(c))));
for (const f of readdirSync(path.join(raiz, 'web/navegador')).filter(f => /^prueba-.*\.mjs$/.test(f)).sort())
  if (!conocidas.has(f)) PRUEBAS.push({ n: f.slice(7, -4), cmd: [nav(f)], juego: true });

if (args.includes('--lista')) {
  for (const p of PRUEBAS) console.log(`${p.n.padEnd(14)} ${p.juego ? 'juego ' : 'rápida'}  node ${p.cmd.join(' ')}${p.cwd ? `   (en ${p.cwd})` : ''}`);
  process.exit(0);
}
const solo = opcion('--solo', '') ? new Set(opcion('--solo').split(',')) : null;
const veces = Math.max(1, Number(opcion('--repetir', 1)));
const elegidas = PRUEBAS.filter(p => (!solo || solo.has(p.n)) && (!args.includes('--sin-juego') || !p.juego)
  && existsSync(path.join(raiz, p.cwd || '', p.cmd.find(c => /\.(m?js|cjs)$/.test(c)) || '')));
if (solo) for (const n of solo) if (!PRUEBAS.some(p => p.n === n)) console.log(`(no hay una prueba "${n}": --lista las muestra)`);
const sello = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const carpeta = path.join(raiz, 'build/web/datos/todo', sello);
mkdirSync(carpeta, { recursive: true });

// Lee la cuenta del final de lo que escribió una prueba
function cuenta(texto) {
  // el banco: el total de páginas (cada página escribe también su propio "N bien, M mal": no confundirlo con el total)
  let m = [...texto.matchAll(/(\d+) de (\d+) páginas bien/g)].pop();
  if (m) return { bien: +m[1], mal: +m[2] - +m[1] };
  // node --test (las pruebas del sitio): "ℹ pass 19" (o "# pass 19" en el formato viejo)
  const pasa = [...texto.matchAll(/^(?:ℹ|#) pass (\d+)/gm)].pop(), falla = [...texto.matchAll(/^(?:ℹ|#) fail (\d+)/gm)].pop();
  if (pasa) return { bien: +pasa[1], mal: falla ? +falla[1] : 0 };
  m = [...texto.matchAll(/(\d+) bien, (\d+) mal/g)].pop();
  if (m) return { bien: +m[1], mal: +m[2] };
  // prueba-nube: "9 ✓ · 0 ✗"
  m = [...texto.matchAll(/(\d+) ✓ · (\d+) ✗/g)].pop();
  if (m) return { bien: +m[1], mal: +m[2] };
  return null;
}
function correr(p, i) {
  return new Promise(listo => {
    const extra = [];
    if (veces > 1 && p.propios) extra.push(`--puerto=${8120 + (i % 10)}`, `--datos=${path.relative(raiz, path.join(carpeta, `${p.n}-${i + 1}-datos`))}`);
    const t0 = Date.now();
    const hijo = spawn(process.execPath, [...p.cmd, ...extra], { cwd: path.join(raiz, p.cwd || ''), stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    const tope = setTimeout(() => { salida += '\n(correr-todo: pasó de 40 min, la corté)\n'; hijo.kill(); }, 40 * 60000);
    hijo.stdout.on('data', d => { salida += d; });
    hijo.stderr.on('data', d => { salida += d; });
    hijo.on('close', codigo => {
      clearTimeout(tope);
      const nombre = veces > 1 ? `${p.n}-${i + 1}` : p.n;
      writeFileSync(path.join(carpeta, nombre + '.txt'), salida);
      // la carpeta de datos de la prueba (registro de consola, fotos): copiada por corrida, si no tuvo la suya propia
      if (p.datos && !(veces > 1 && p.propios) && existsSync(path.join(raiz, p.datos))) {
        try { cpSync(path.join(raiz, p.datos), path.join(carpeta, nombre + '-datos'), { recursive: true }); } catch {}
      }
      const c = cuenta(salida);
      const fallas = salida.split('\n').filter(l => /^\s*✗|pageerror|RuntimeError|se cortó/.test(l)).slice(0, 6);
      listo({ prueba: p.n, vez: i + 1, codigo, segundos: (Date.now() - t0) / 1000, ...(c || { bien: 0, mal: 1, sinCuenta: true }), fallas });
    });
  });
}

console.log(`${elegidas.length} pruebas${veces > 1 ? `, ${veces} veces cada una` : ''} → ${path.relative(raiz, carpeta)}`);
const resultados = [];
for (const p of elegidas) {
  for (let i = 0; i < veces; i++) {
    process.stdout.write(`  ${p.n}${veces > 1 ? ` (${i + 1}/${veces})` : ''}… `);
    const r = await correr(p, i);
    resultados.push(r);
    console.log(`${r.sinCuenta ? 'sin cuenta (¿se cayó?)' : `${r.bien} bien, ${r.mal} mal`}  ${r.segundos.toFixed(0)} s${r.codigo ? `  (código ${r.codigo})` : ''}`);
    for (const f of r.fallas) console.log('      ' + f.trim().slice(0, 200));
  }
}
// La planilla
console.log('\nprueba          veces  bien   mal  falló   tiempo');
let totalBien = 0, totalMal = 0, fallidas = 0;
for (const p of elegidas) {
  const rs = resultados.filter(r => r.prueba === p.n);
  const b = rs.reduce((s, r) => s + r.bien, 0), m = rs.reduce((s, r) => s + r.mal, 0), f = rs.filter(r => r.mal || r.codigo || r.sinCuenta).length;
  totalBien += b; totalMal += m; fallidas += f;
  console.log(`${p.n.padEnd(15)} ${String(rs.length).padStart(5)} ${String(b).padStart(5)} ${String(m).padStart(5)} ${String(f).padStart(6)}   ${(rs.reduce((s, r) => s + r.segundos, 0) / 60).toFixed(1)} min`);
}
console.log(`\n${totalBien} bien, ${totalMal} mal  (${fallidas} corridas con fallas; detalle en ${path.relative(raiz, carpeta)})`);
writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify({ sello, veces, resultados }, null, 1));
process.exit(totalMal || fallidas ? 1 : 0);
