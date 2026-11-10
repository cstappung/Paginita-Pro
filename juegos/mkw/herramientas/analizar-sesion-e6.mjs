// Recalcula la sesión larga desde las muestras crudas, sin modificar ese registro.
// Uso: node herramientas/analizar-sesion-e6.mjs build/web/datos/sesion-larga/hora.json
import { readFileSync, writeFileSync } from 'node:fs';
const archivo = process.argv[2];
const datos = JSON.parse(readFileSync(archivo, 'utf8'));
const muestras = datos.muestras || [];
const fin = muestras.at(-1)?.min ?? 0;
const desde = datos.telefono ? Math.min(10, fin / 3) : 10;
const pendiente = f => {
  const p = muestras.filter(m => m.min >= desde).map(m => [m.min, f(m)]).filter(x => Number.isFinite(x[1]));
  if (p.length < 3) return null;
  const n = p.length, sx = p.reduce((s, x) => s + x[0], 0), sy = p.reduce((s, x) => s + x[1], 0);
  const xx = p.reduce((s, x) => s + x[0] ** 2, 0), xy = p.reduce((s, x) => s + x[0] * x[1], 0);
  const denominador = n * xx - sx * sx;
  return denominador > 0 ? 60 * (n * xy - sx * sy) / denominador : null;
};
const mediana = valores => {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const cpu = q => {
  const primeros = mediana(muestras.filter(m => m.min < 10 && m[q]?.enCarrera).map(m => m[q].trabajo));
  const ultimos = mediana(muestras.filter(m => m.min >= fin - 10 && m[q]?.enCarrera).map(m => m[q].trabajo));
  return { primeros, ultimos, variacion: primeros > 0 && ultimos !== null ? ultimos / primeros - 1 : null };
};
const memoria = { juegoMayor: pendiente(m => m.procesos?.pestañas?.[0]), segundoJuego: pendiente(m => m.procesos?.pestañas?.[1]),
  tarjeta: pendiente(m => m.procesos?.tarjeta), wasmA: pendiente(m => m.A?.usado), wasmB: pendiente(m => m.B?.usado) };
const completa = fin >= (datos.telefono ? 0 : 60) && muestras.at(-1)?.A?.fase === 'fin' && muestras.at(-1)?.B?.fase === 'fin';
const plana = Object.values(memoria).every(x => Number.isFinite(x) && x < 30);
const cpuMedida = { A: cpu('A'), B: cpu('B') };
const estable = Object.values(cpuMedida).every(x => Number.isFinite(x.variacion) && x.variacion <= 0.10);
const r = { archivo, minutos: fin, muestras: muestras.length, desdeMinuto: desde, completa,
  memoriaMBporHora: memoria, plana, cpu: cpuMedida, estable, caidas: datos.caidas || [] };
writeFileSync(archivo.replace(/\.json$/, '-analisis-e6.json'), JSON.stringify(r, null, 2));
console.log(JSON.stringify(r, null, 2));
process.exitCode = completa && plana && estable && !r.caidas.length ? 0 : 1;
