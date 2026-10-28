// Batalla de Rock — lo que la escena necesita saber de la canción de verdad, puro (sin DOM ni three.js).
// Lo usa la sesión de PRO HERO (game/session.js) para mandarle a la escena cómo vas; tests/rock.test.cjs.
import { STAR_THRESHOLDS } from '../core/engine.js';

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

const lim = (x, a, b) => Math.max(a, Math.min(b, x));

// Las estrellas (0 a 6, con decimales) que da una razón puntaje / puntaje base (los umbrales del motor).
export function estrellasDe(razon, umbrales = STAR_THRESHOLDS) {
  let prev = 0;
  for (let i = 0; i < umbrales.length; i++) {
    if (razon < umbrales[i]) return i + Math.max(0, razon - prev) / (umbrales[i] - prev);
    prev = umbrales[i];
  }
  return umbrales.length;
}

// Cuánto arde el escenario (0 a 1) con lo que lleva un jugador: el ritmo de estrellas (el puntaje contra lo
// máximo de las notas que ya pasaron: 3 estrellas no prenden nada, 5,5 lo prenden entero), la racha (120
// notas seguidas) y el Star Power encendido. `e` = el motor ({score, baseScore, totalNotes, hitCount,
// missCount, combo, spActive}). Hasta las primeras 12 notas no hay ritmo que medir: solo cuenta la racha.
export function fuegoDe(e) {
  if (!e) return 0;
  const juzgadas = (e.hitCount || 0) + (e.missCount || 0);
  let k = 0;
  if (e.baseScore > 0 && e.totalNotes > 0 && juzgadas >= 12) {
    const razon = (e.score / e.baseScore) * (e.totalNotes / juzgadas);
    k = lim((estrellasDe(razon) - 3) / 2.5, 0, 1);
  }
  const racha = lim((e.combo || 0) / 120, 0, 1);
  return lim(0.55 * k + 0.45 * racha + (e.spActive ? 0.12 : 0), 0, 1);
}

// La música de verdad, para que las luces la sigan. `bandas` = [graves, medios, agudos]: la canción ya
// filtrada en tres bandas, mono, a `sr` muestras por segundo (la sesión lo hace con un OfflineAudioContext).
// Devuelve a `fps` cuadros por segundo, en bytes (0–255, normalizado a esta canción: lo fuerte de ella es
// 255): la energía de cada banda (`g`, `m`, `a`), sus golpes, que son subidas bruscas de energía (`gg` el
// bombo, `gm` la caja, `ga` platillos y púas) y la fuerza del tramo (`f`: unos segundos alrededor, entre lo
// más suave y lo más fuerte de la canción; un coro sube, una estrofa tranquila baja).
export function analizaMusica(bandas, sr, fps = 60) {
  const hop = sr / fps, n = Math.max(0, Math.floor(bandas[0].length / hop));
  const E = bandas.map((x) => {
    const e = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * hop), z = Math.floor((i + 1) * hop);
      let s = 0;
      for (let j = a; j < z; j++) s += x[j] * x[j];
      e[i] = Math.sqrt(s / Math.max(1, z - a));
    }
    return e;
  });
  // lo fuerte de la canción: el percentil `q` de los cuadros con sonido
  const percentil = (arr, q) => {
    const v = Array.from(arr).filter((x) => x > 1e-6).sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : 1;
  };
  const aBytes = (arr, ref) => {
    const out = new Uint8Array(arr.length), k = 255 / (ref || 1);
    for (let i = 0; i < arr.length; i++) out[i] = Math.min(255, Math.round(arr[i] * k));
    return out;
  };
  const refs = E.map((e) => percentil(e, 0.97));
  // golpes: cuánto sube la energía (en logaritmo) contra la media de los ~100 ms anteriores, pesado por lo
  // fuerte que suena (un golpe en un tramo casi mudo no prende nada)
  const golpes = E.map((e, b) => {
    const o = new Float32Array(n), ref = refs[b] || 1, W = Math.max(2, Math.round(fps * 0.1));
    let suma = 0;
    for (let i = 0; i < n; i++) {
      const media = i ? suma / Math.min(i, W) : e[i];
      o[i] = Math.max(0, Math.log(e[i] + ref * 0.02) - Math.log(media + ref * 0.02)) * Math.sqrt(Math.min(1, e[i] / ref));
      suma += e[i];
      if (i >= W) suma -= e[i - W];
    }
    return aBytes(o, percentil(o, 0.985));
  });
  // la fuerza del tramo: la media de las tres bandas (ya normalizadas) en 2,5 s, entre los percentiles 10 y 95
  const total = new Float32Array(n);
  for (let i = 0; i < n; i++) total[i] = E[0][i] / (refs[0] || 1) + E[1][i] / (refs[1] || 1) + E[2][i] / (refs[2] || 1);
  const W = Math.max(1, Math.round(fps * 1.25)), larga = new Float32Array(n);
  const acc = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acc[i + 1] = acc[i] + total[i];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - W), z = Math.min(n, i + W + 1); larga[i] = (acc[z] - acc[a]) / (z - a); }
  const lo = percentil(larga, 0.1), hi = percentil(larga, 0.95);
  const f = new Uint8Array(n);
  for (let i = 0; i < n; i++) f[i] = Math.round(255 * lim((larga[i] - lo) / Math.max(1e-6, hi - lo), 0, 1));
  return { fps, n, g: aBytes(E[0], refs[0]), m: aBytes(E[1], refs[1]), a: aBytes(E[2], refs[2]), gg: golpes[0], gm: golpes[1], ga: golpes[2], f };
}
