// Analiza la "traza del ritmo" que deja la página con ?traza=1 (líneas "[traza] [...]" en el log de la prueba).
// Sirvió para encontrar la causa de los tirones a 240 Hz (bitácora §43).
//
// Resumen: el hilo del juego solo le devuelve el control al navegador DENTRO de aurora_end_frame (aurora espera
// con emscripten_sleep hasta su hora de presentar). En esa pausa corren los rAF y el navegador toma el canvas.
// Para cada cuadro este programa calcula, en "refrescos del monitor" (la parte entera dice cuál refresco, la
// decimal dónde dentro de él: 0,0 = recién refrescó, 0,9 = justo antes del siguiente):
//   antes   = hora del código 1 (justo antes de aurora_end_frame: el juego ya terminó el cuadro)
//   1er rAF = primer rAF que corre después de entregar el cuadro (ahí el navegador toma el canvas)
//   volvió  = hora del código 2 (aurora_end_frame volvió; el despertador de la pausa es un setTimeout)
// y cuenta "cuántos refrescos duró cada cuadro" de varias formas, entre ellas la vieja del medidor de la página
// (hora del rAF en que el contador ya subió: el contador sube DESPUÉS de aurora_end_frame, así que cae en la pausa
// del cuadro SIGUIENTE, con el atraso del setTimeout). OJO: ninguna de estas es lo que se VE; eso solo lo sabe
// Chrome (Display::FrameDisplayed en su traza, que mide prueba-navegador.mjs).
//
// Uso:  node herramientas/analizar-traza.mjs [build/web/datos/navegador.log] [--detalle]
import { readFileSync } from 'node:fs';

const archivo = process.argv.slice(2).find(a => !a.startsWith('--')) || 'build/web/datos/navegador.log';
const detalle = process.argv.includes('--detalle');
const ev = [];
for (const linea of readFileSync(archivo, 'utf8').split('\n'))
  if (linea.startsWith('[traza] ')) ev.push(...JSON.parse(linea.slice(8)));
if (!ev.length) { console.log('no hay líneas [traza] (¿se corrió con --extra "&traza=1"?)'); process.exit(1); }

// 1) La rejilla del monitor. Las horas que da rAF (valor de 'r') son horas de refresco, pero las que llegan
//    después de que el hilo estuvo ocupado pueden ser VIEJAS (de un refresco anterior): solo se usan las
//    "frescas" (el rAF corrió menos de 0,5 ms después de su hora). p = período (mediana de los saltos de un
//    refresco). Cada hora t se mide desde el último refresco fresco anterior: número de ese refresco (contando los
//    perdidos con round(Δ/p)) + (t − su hora)/p. Así un error en p no se acumula más allá de un cuadro.
const frescos = [];
for (const e of ev) if (e[0] === 'r' && e[1] - e[2] < 0.5 && (!frescos.length || e[2] > frescos[frescos.length - 1])) frescos.push(e[2]);
const saltos = frescos.slice(1).map((h, i) => h - frescos[i]);
const cortos = saltos.filter(d => d > 0.5).sort((a, b) => a - b);
const p0 = cortos[Math.floor(cortos.length * 0.1)];
const uno = saltos.filter(d => Math.abs(d - p0) < p0 * 0.25).sort((a, b) => a - b);
const p = uno[Math.floor(uno.length / 2)];
const idx = [0];
for (let i = 1; i < frescos.length; i++) idx.push(idx[i - 1] + Math.max(1, Math.round(saltos[i - 1] / p)));
const fase = t => {                                   // búsqueda binaria del último fresco ≤ t
  let lo = 0, hi = frescos.length - 1;
  if (t < frescos[0]) return (t - frescos[0]) / p;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (frescos[m] <= t) lo = m; else hi = m - 1; }
  return idx[lo] + (t - frescos[lo]) / p;
};
const dec = x => x - Math.floor(x);
console.log(`monitor: ${(1000 / p).toFixed(2)} Hz (p = ${p.toFixed(4)} ms); ${frescos.length} rAF frescos`);

// 2) Cuadros, de un código 1 al siguiente
const cuadros = [];
let actual = null;
for (const [c, t, v] of ev) {
  if (c === 1) { actual = { antes: t, rafs: [] }; cuadros.push(actual); }
  else if (!actual) continue;
  else if (c === 2) actual.despues = t;
  else if (c === 'r') { if (actual.despues === undefined) actual.rafs.push({ t, hora: v }); }
  else if (c === 'v' && actual.despues !== undefined && actual.vistoViejo === undefined) actual.vistoViejo = null;
}
// la medida vieja: el primer 'v' después del código 2 cae en la pausa del cuadro siguiente; su hora es la del 'r' previo
for (let i = 0; i + 1 < cuadros.length; i++) {
  const sig = cuadros[i + 1];
  cuadros[i].vistoViejo = sig.rafs.length ? sig.rafs[0].hora : undefined;
}
const ok = cuadros.filter(q => q.despues !== undefined && q.rafs.length && q.vistoViejo !== undefined);
const per = (x, k) => { const o = [...x].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(o.length * k))]; };
const hist = (xs, n = 10) => { const h = new Array(n).fill(0); xs.forEach(x => h[Math.min(n - 1, Math.floor(dec(x) * n))]++); return h.join(' '); };
const dur = ok.map(q => q.despues - q.antes);
console.log(`${ok.length} cuadros. aurora_end_frame (con su pausa) dura: mediana ${per(dur, .5).toFixed(2)}, mín ${Math.min(...dur).toFixed(2)}, máx ${Math.max(...dur).toFixed(2)} ms`);
console.log(`dónde cae, dentro del refresco, en décimos (de 0,0-0,1 a 0,9-1,0):`);
console.log(`  antes de aurora_end_frame : ${hist(ok.map(q => fase(q.antes)))}`);
console.log(`  primer rAF (toma el canvas): ${hist(ok.map(q => fase(q.rafs[0].t)))}`);
console.log(`  aurora_end_frame volvió    : ${hist(ok.map(q => fase(q.despues)))}`);
const atraso = ok.map(q => q.rafs[0].t - q.antes);
console.log(`primer rAF después de entrar a aurora_end_frame: mediana ${per(atraso, .5).toFixed(2)}, p95 ${per(atraso, .95).toFixed(2)}, máx ${Math.max(...atraso).toFixed(2)} ms`);

// 3) Huecos con las dos medidas
const esperado = Math.round(16.6667 / p);
const contar = (nombre, refresco) => {
  const h = {}, raros = [];
  for (let i = 1; i < ok.length; i++) {
    const k = refresco(ok[i]) - refresco(ok[i - 1]);
    h[k] = (h[k] || 0) + 1;
    if (k !== esperado) raros.push(i);
  }
  const total = Object.values(h).reduce((s, n) => s + n, 0);
  console.log(`huecos (${nombre}): ${Object.entries(h).map(([k, n]) => `${k}→${n}`).join(', ')}; parejo ${(100 * (h[esperado] || 0) / total).toFixed(1)} %`);
  return raros;
};
const rarosViejo = contar('medida vieja: hora rAF tras el contador', q => Math.round(fase(q.vistoViejo)));
const rarosPinta = contar('cuando el navegador toma el canvas', q => Math.ceil(fase(q.rafs[0].t)));
contar('justo antes de aurora_end_frame', q => Math.ceil(fase(q.antes)));
contar('aurora_end_frame volvió', q => Math.ceil(fase(q.despues)));

if (detalle) {
  const f2 = x => x.toFixed(2).padStart(7);
  console.log('cuadros raros con la medida vieja: i | antes | 1er rAF | volvió | visto(viejo)  (en refrescos)');
  for (const i of rarosViejo.slice(0, 60))
    for (const j of [i - 1, i]) console.log(`${String(j).padStart(5)} | ${f2(fase(ok[j].antes))} | ${f2(fase(ok[j].rafs[0].t))} | ${f2(fase(ok[j].despues))} | ${f2(fase(ok[j].vistoViejo))}`);
}
