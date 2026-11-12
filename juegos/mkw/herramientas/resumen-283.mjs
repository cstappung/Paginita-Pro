// resumen-283.mjs — la tabla de §283 (los picos): de cada corrida de sala-telefono-mixta.mjs en una carpeta, por página,
// la Imagen y el Juego del MEDIDOR (las mismas cuentas que el gráfico: de entrega a entrega, y cada cuadro de lógica
// desde que empieza) con su 1 % bajo y la razón contra la meta del dueño (1 % bajo ≥ 90 % de los fps), solo en la zona
// limpia (sin la traza ni el perfil del teléfono), y los picos por causa.
//
// Resumen: la herramienta guarda en cada página `tiempos` = { imagen: [ms…], juego: [ms…] } desde que empezó a medir;
// sumando los tiempos se sabe la hora de cada uno (desdeMs + suma) y con las ventanas de la traza y el perfil se deja
// fuera lo que cayó dentro de ellas. El 1 % bajo es 1000 / p99 (como imagenes-vista.mjs, CapFrameX). Como mirar en el
// osciloscopio solo el tramo sin la punta de prueba pesada conectada: la traza y el perfil cargan el teléfono.
// Uso: node herramientas/resumen-283.mjs <carpeta> [<carpeta> …]   → markdown por la salida
import fs from 'node:fs';
import path from 'node:path';

const META = 0.9;
const pct = (orden, f) => orden.length ? orden[Math.min(orden.length - 1, Math.floor(orden.length * f))] : null;
const r1 = x => x == null || !Number.isFinite(x) ? '—' : (Math.round(x * 10) / 10).toString();
// lo de la zona limpia de una lista de tiempos (ms) que empieza en `desde`
function limpia(lista, desde, ventanas) {
  if (!lista?.length) return null;
  const fuera = Object.values(ventanas || {});
  const v = [];
  let t = desde;
  for (const ms of lista) { t += ms; if (!fuera.some(([a, b]) => t >= a && t <= b)) v.push(ms); }
  if (v.length < 60) return null;
  const orden = [...v].sort((a, b) => a - b), suma = v.reduce((a, b) => a + b, 0);
  const fps = v.length * 1000 / suma, bajo1 = 1000 / pct(orden, 0.99);
  return { n: v.length, fps, bajo1, razon: bajo1 / fps, p99: pct(orden, 0.99), max: orden[orden.length - 1],
           mas: v.filter(x => x > 1.5 * pct(orden, 0.5)).length };
}
export function resumirCarpeta(dir) {
  const filas = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json') && !x.endsWith('-traza.json')).sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const p of d.paginas || []) {
      const im = limpia(p.tiempos?.imagen, p.desdeMs, p.ventanas), ju = limpia(p.tiempos?.juego, p.desdeMs, p.ventanas);
      const causas = {};
      for (const k of p.picos || []) if (k.zona === 'limpia') for (const c of k.causas) causas[c] = (causas[c] || 0) + 1;
      filas.push({ caso: f.replace(/\.json$/, ''), pagina: p.nombre, im, ju, modo: p.tiempos?.juegoModo ?? '(sin tiempos)', causas,
        n8: p.final?.n8 ? `${p.final.n8.m}${p.final.n8.a ? '+' : '-'}` : '', viejo: !p.tiempos && p.vista ? p.vista.resumen : null });
    }
  }
  return filas;
}
const ok = x => x ? (x.razon >= META ? '✓' : '✗') : '';
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('resumen-283.mjs')) {
  for (const dir of process.argv.slice(2)) {
    console.log(`## ${dir}\n`);
    console.log('| caso | página | N8 | Imagen fps | 1 % bajo | razón | p99 ms | peor ms | Juego /s | 1 % bajo | razón | p99 ms | modo Juego | picos (limpia) por causa |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const x of resumirCarpeta(dir)) {
      const i = x.im, j = x.ju;
      console.log(`| ${x.caso} | ${x.pagina} | ${x.n8} | ${r1(i?.fps)} | ${r1(i?.bajo1)} | ${i ? Math.round(100 * i.razon) + ' % ' + ok(i) : '—'} | ${r1(i?.p99)} | ${r1(i?.max)} | ` +
        `${r1(j?.fps)} | ${r1(j?.bajo1)} | ${j ? Math.round(100 * j.razon) + ' % ' + ok(j) : '—'} | ${r1(j?.p99)} | ${x.modo} | ${JSON.stringify(x.causas)} |`);
    }
    console.log('');
  }
}
