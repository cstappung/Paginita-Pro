// W30 (bitácora §257): cuánto se separa el fantasma del experto entre dos programas, cuadro por cuadro.
//
// Resumen: prueba-fantasma-igual.mjs --crudas 100000 guarda, en cada cuadro de lógica, la ficha de la carrera del
// jugador (quieto) y del fantasma (RaceinfoPlayer, sin punteros). Aquí se lee ese .json y se dice: el primer cuadro en
// que el fantasma de B deja de ser igual al de A, cuánto difiere su AVANCE en la carrera (+0xC, raceCompletion: 1,0 =
// la largada, 4,0 = la meta en 3 vueltas) a lo largo de la carrera (el máximo, y en metros aproximados con el largo de
// la vuelta que da el mismo avance), si el fantasma cruza la meta en las dos y en qué cuadro y con qué tiempo, y si se
// «cae» (el avance retrocede de golpe, como con un rescate de Lakitu) en alguna. Comparación eléctrica: dos registros de
// la misma señal tomados con dos osciloscopios; se mide dónde empieza la diferencia y cuánto llega a valer.
// Uso: node herramientas/w30-fantasma.mjs build/web/datos/fantasma-igual/<A>-contra-<B>.json [--largo-vuelta 1000]
import { readFileSync } from 'node:fs';

const archivo = process.argv[2];
if (!archivo) { console.log('uso: node herramientas/w30-fantasma.mjs <A-contra-B.json> [--largo-vuelta m]'); process.exit(2); }
const iL = process.argv.indexOf('--largo-vuelta');
const LARGO = iL > 0 ? Number(process.argv[iL + 1]) : 0;   // metros por vuelta (0 = solo en vueltas)
const { A, B, a, b } = JSON.parse(readFileSync(archivo, 'utf8'));

// el valor de un desplazamiento en la ficha guardada [o0, v0, o1, v1, …]
const campo = (ficha, o) => { for (let i = 0; i < ficha.length; i += 2) if (ficha[i] === o) return ficha[i + 1]; return undefined; };
const f32 = u => { const d = new DataView(new ArrayBuffer(4)); d.setUint32(0, u >>> 0); return d.getFloat32(0); };
const AVANCE = 0xC;

const cuadros = Object.keys(a.crudas).filter(c => c in b.crudas).map(Number).sort((x, y) => x - y);
let primero = null, maxDif = 0, maxEn = null, igualesHasta = null;
const serie = [];
for (const c of cuadros) {
  const fa = a.crudas[c][1], fb = b.crudas[c][1];
  const igual = fa.join() === fb.join();
  if (!igual && primero === null) {
    primero = c;
    const difs = [];
    for (let i = 0; i < Math.max(fa.length, fb.length); i += 2)
      if (fa[i] !== fb[i] || fa[i + 1] !== fb[i + 1]) difs.push(`+0x${(fa[i] ?? fb[i]).toString(16)}: ${fa[i + 1]?.toString(16)} / ${fb[i + 1]?.toString(16)}`);
    console.log(`primer cuadro distinto del fantasma: ${c} — ${difs.join(' · ')}`);
  }
  if (igual) igualesHasta = c;
  const va = campo(fa, AVANCE), vb = campo(fb, AVANCE);
  if (va === undefined || vb === undefined) continue;
  const d = Math.abs(f32(va) - f32(vb));
  serie.push([c, f32(va), f32(vb), d]);
  if (d > maxDif) { maxDif = d; maxEn = c; }
}
if (primero === null) console.log(`el fantasma es IGUAL en los ${cuadros.length} cuadros comparados`);

// caídas: el avance baja más de 0,01 vueltas de un cuadro al otro (un rescate lo devuelve atrás)
const caidas = k => { const r = []; for (let i = 1; i < serie.length; i++) if (serie[i][k] < serie[i - 1][k] - 0.01) r.push(serie[i][0]); return r; };
const enMetros = v => LARGO ? ` (~${(v * LARGO).toFixed(2)} m)` : '';
console.log(`cuadros comparados: ${cuadros.length} (del ${cuadros[0]} al ${cuadros.at(-1)})`);
console.log(`la mayor diferencia de avance: ${maxDif.toExponential(3)} vueltas${enMetros(maxDif)} en el cuadro ${maxEn}`);
for (const p of [0.25, 0.5, 0.75, 1]) {   // cómo crece a lo largo de la carrera
  const s = serie[Math.min(serie.length - 1, Math.floor(serie.length * p) - (p === 1 ? 0 : 0))] || serie.at(-1);
  if (s) console.log(`  al ${p * 100} % (cuadro ${s[0]}): A ${s[1].toFixed(6)}, B ${s[2].toFixed(6)}, diferencia ${s[3].toExponential(3)}${enMetros(s[3])}`);
}
console.log(`caídas (el avance retrocede): A ${JSON.stringify(caidas(1))}, B ${JSON.stringify(caidas(2))}`);
const t = f => f?.tiempo ? `${f.tiempo.min}:${String(f.tiempo.s).padStart(2, '0')}.${String(f.tiempo.ms).padStart(3, '0')}` : '?';
console.log(`meta: A ${a.llego ? 'cuadro ' + a.fin.cuadro + ', ' + t(a.fin) : 'NO llegó'} · B ${b.llego ? 'cuadro ' + b.fin.cuadro + ', ' + t(b.fin) : 'NO llegó'}`);
console.log(`A = ${A}\nB = ${B}`);
