// Muchas copas sincronizadas con pistas y semillas al azar (PLAN C2, bitácora §70).
//
// Resumen: la sala del sitio sortea para cada tanda una semilla y 4 pistas distintas entre las 79 copas de carrera de
// Retro Rewind (`mkwCarrera` en colabtex/src/juegos/motor.js). Una desincronización puede depender de la pista (un
// objeto, un atajo, una rampa) o de la semilla (qué CPU y qué objetos salen). Este programa sortea igual que la sala y
// corre `prueba-sincro.mjs --copa` con cada sorteo, una copa después de otra (dos pestañas, la carrera 1 entera y 900
// cuadros de la 2, con las huellas comparadas cada 120 cuadros). Al final: la planilla (sorteo, puntos, huellas, minutos).
// Como probar un equipo con señales al azar en vez de siempre la misma onda: aparecen los casos que nadie pensó.
//
// Uso:  node herramientas/copas-al-azar.mjs [--copas 3] [--sala SEMILLA] [--minutos 25]
//       --sala = el "nombre de la sala" del que salen los sorteos (el mismo número repite los mismos; por omisión, la hora)
// Deja todo en build/web/datos/copas/<fecha-hora>/: <n>.txt (lo que escribió cada prueba), <n>/ (sus datos) y resumen.json.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n, porDefecto) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : porDefecto; };
const COPAS_RR = 79;                         // copas de carrera de Retro Rewind (MKW_COPAS en motor.js)
const cuantas = Number(opcion('--copas', 3));
const sala = String(opcion('--sala', Date.now()));
const minutos = Number(opcion('--minutos', 25));

// El sorteo de la sala (copia de mkwCarrera): FNV-1a de "sala|tanda" → semilla, y un xorshift de 32 bits para las pistas
function sorteo(pid, ronda) {
  let h = 2166136261;
  for (const c of `${pid}|${ronda}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let x = (h >>> 0) || 1;
  const azar = n => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
  const semilla = (h >>> 0) || 1, pistas = [], vistas = new Set();
  while (pistas.length < 4) {
    const copa = azar(COPAS_RR), fila = azar(4), k = copa * 4 + fila;
    if (vistas.has(k)) continue;
    vistas.add(k); pistas.push(`${copa}.${fila}`);
  }
  return { semilla, pistas: pistas.join(',') };
}

const sello = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const carpeta = path.join(raiz, 'build/web/datos/copas', sello);
mkdirSync(carpeta, { recursive: true });
console.log(`${cuantas} copas al azar (sala "${sala}") → ${path.relative(raiz, carpeta)}`);

const resultados = [];
for (let i = 1; i <= cuantas; i++) {
  const { semilla, pistas } = sorteo(sala, i);
  process.stdout.write(`  copa ${i}: pistas ${pistas}, semilla ${semilla}… `);
  const t0 = Date.now();
  const salida = await new Promise(listo => {
    const hijo = spawn(process.execPath, ['web/navegador/prueba-sincro.mjs', '--copa', `--pistas=${pistas}`, `--semilla=${semilla}`,
      `--minutos=${minutos}`, `--puerto=${8120 + (i % 10)}`, `--datos=${path.relative(raiz, path.join(carpeta, String(i)))}`],
      { cwd: raiz, stdio: ['ignore', 'pipe', 'pipe'] });
    let s = '';
    hijo.stdout.on('data', d => { s += d; });
    hijo.stderr.on('data', d => { s += d; });
    hijo.on('close', () => listo(s));
  });
  writeFileSync(path.join(carpeta, `${i}.txt`), salida);
  const m = [...salida.matchAll(/(\d+) bien, (\d+) mal/g)].pop();
  const huellas = salida.match(/iguales A (\d+), B (\d+)/);
  const r = { copa: i, pistas, semilla, bien: m ? +m[1] : 0, mal: m ? +m[2] : 1, huellas: huellas ? `${huellas[1]}/${huellas[2]}` : '-',
    desincronizada: /DESINCRONIZADO/.test(salida), minutos: (Date.now() - t0) / 60000,
    fallas: salida.split('\n').filter(l => /^\s*✗/.test(l)).map(l => l.trim().slice(0, 200)) };
  resultados.push(r);
  console.log(`${r.bien} bien, ${r.mal} mal, huellas iguales ${r.huellas}${r.desincronizada ? ' — ¡DESINCRONIZADA!' : ''} (${r.minutos.toFixed(1)} min)`);
  for (const f of r.fallas) console.log('      ' + f);
}
const mal = resultados.reduce((s, r) => s + r.mal, 0), bien = resultados.reduce((s, r) => s + r.bien, 0);
console.log(`\n${bien} bien, ${mal} mal  (${resultados.filter(r => r.mal).length} de ${cuantas} copas con fallas; ${resultados.filter(r => r.desincronizada).length} desincronizadas)`);
writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify({ sala, resultados }, null, 1));
process.exit(mal ? 1 : 0);
