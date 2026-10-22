// Batalla de Rock — lo que la escena necesita saber de la canción de verdad, puro (sin DOM ni three.js).
// Lo usa la sesión de PRO HERO (game/session.js) para mandarle a la escena cómo vas; tests/rock.test.cjs.

// Los tramos sin notas de una pista donde el rockero deja de tocar: huecos de `min` segundos o más entre el
// final de una nota (sus sostenidos incluidos) y la siguiente, más la entrada y el final de la canción. Deja
// de tocar `despues` segundos tras la última nota y vuelve `antes` de la siguiente, para estar listo.
export function descansos(notas, { min = 3, antes = 0.8, despues = 0.5, fin = Infinity } = {}) {
  const out = [];
  let libre = -Infinity;   // desde cuándo no suena nada
  for (const n of notas || []) {
    const t = n.time, e = Math.max(t, n.endTime ?? t);
    if (t - libre >= min) out.push([libre === -Infinity ? -Infinity : libre + despues, t - antes]);
    libre = Math.max(libre, e);
  }
  if (fin - libre >= min || fin === Infinity) out.push([libre === -Infinity ? -Infinity : libre + despues, Infinity]);
  return out.filter(([a, b]) => b > a);
}

// ¿Está `t` en un descanso? `cur` es un cursor {i} que avanza con la canción (y vuelve atrás si ella vuelve).
export function enDescanso(lista, t, cur = { i: 0 }) {
  if (!lista.length) return false;
  let i = Math.min(cur.i, lista.length - 1);
  while (i > 0 && lista[i][0] > t) i--;
  while (i < lista.length - 1 && lista[i][1] <= t) i++;
  cur.i = i;
  return t >= lista[i][0] && t < lista[i][1];
}

// El humor de quien toca (-1 a 1) según el acierto de los últimos segundos: 95 % o más es euforia, 72 % es
// indiferencia y por debajo del 50 % el público se aburre. `muestras` = [{t, h, m}] (aciertos y fallos
// acumulados del motor), `t` la hora de ahora y `ventana` los segundos que se miran.
export function humorDe(muestras, t, ventana = 6) {
  const ult = muestras[muestras.length - 1];
  if (!ult) return null;
  let a = muestras[0];
  for (const m of muestras) { if (m.t >= t - ventana) { a = m; break; } }
  const h = ult.h - a.h, f = ult.m - a.m;
  if (h + f < 4) return null;   // muy pocas notas para decir algo
  const acc = h / (h + f);
  return Math.max(-1, Math.min(1, (acc - 0.72) / 0.23));
}
