const TM = require(require('path').resolve(__dirname, '../..') + '/juegos/club/tetris/motor.js');
function evalua(s, p, P) {
  const W = TM.W, H = TM.H, pozo = s.pozo.slice();
  for (const [x, y] of TM.celdas(p)) { if (y < 0) return -1e9; pozo[y * W + x] = 'X'; }
  let lineas = 0;
  for (let y = H - 1; y >= 0; y--) { let llena = true; for (let x = 0; x < W; x++) if (!pozo[y * W + x]) { llena = false; break; }
    if (llena) { lineas++; pozo.splice(y * W, W); pozo.unshift(...new Array(W).fill('')); y++; } }
  const alt = new Array(W).fill(0); let huecos = 0;
  for (let x = 0; x < W; x++) { let visto = false; for (let y = 0; y < H; y++) { const v = pozo[y * W + x]; if (v && !visto) { alt[x] = H - y; visto = true; } else if (!v && visto) huecos++; } }
  const cols = P.pozo ? W - 1 : W; let agg = 0, bump = 0, max = 0;
  for (let x = 0; x < cols; x++) { agg += alt[x]; max = Math.max(max, alt[x]); if (x < cols - 1) bump += Math.abs(alt[x] - alt[x + 1]); }
  let v = -P.a * agg - P.h * huecos - P.b * bump;
  if (P.pozo) { if (lineas >= 4) v += P.t; else if (lineas === 3) v += P.t / 4; else v += lineas * (max > P.panico ? 3 : P.l); if (lineas < 3) v -= alt[W - 1] * (max > P.panico ? 0.1 : P.w); }
  else v += P.l * lineas;
  if (max > 14) v -= (max - 14) * 4;
  return v;
}
function plan(s, P) { let m = null; for (const r of s.p.t === 'O' ? [0] : [0, 1, 2, 3]) for (let x = -3; x < TM.W + 2; x++) {
  let p = { ...s.p, r, x, y: Math.max(0, s.p.y) }; if (!TM.cabe(s, p)) continue; while (TM.cabe(s, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  const v = evalua(s, p, P); if (!m || v > m.v) m = { v, r, x }; } return m; }
function juega(P, sal) { const g = TM.grabadora({ cuenta: 'x', sal, modo: 'maraton' }), s = g.s; let n = 0, tet = 0, l0 = 0;
  while (!s.fin && n < 600) { const o = plan(s, P); if (!o) break; s.p = { ...s.p, r: o.r, x: o.x }; TM.accion(s, 'caer'); n++; if (s.lineas - l0 === 4) tet++; l0 = s.lineas; }
  return { n, l: s.lineas, pts: s.puntos, tet, fin: s.fin }; }
const variantes = {
  clasico: { a: 0.51, h: 0.36, b: 0.18, l: 0.76 },
  pozo: { a: 0.51, h: 0.7, b: 0.18, l: -1.2, pozo: 1, t: 30, w: 2.5, panico: 10 },
  pozo2: { a: 0.45, h: 0.9, b: 0.22, l: -0.6, pozo: 1, t: 25, w: 1.5, panico: 9 },
  pozo3: { a: 0.5, h: 1.2, b: 0.25, l: -0.3, pozo: 1, t: 20, w: 1.0, panico: 8 },
};
for (const [k, P] of Object.entries(variantes)) { const r = ['a', 'b', 'c'].map(sal => juega(P, sal)); console.log(k, JSON.stringify(r)); }
