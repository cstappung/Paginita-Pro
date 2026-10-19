// IA de Tetris para filmar: se engancha a TetrisMotor.grabadora para leer la partida y
// juega con eventos de teclado (los mismos que una persona). Juega «de pro»: pila plana sin
// huecos, deja libre la columna derecha y la llena con la I para hacer tetris. Mira la pieza
// siguiente (búsqueda de dos piezas). cfg.cada = ms entre pulsaciones.
(() => {
  let TM;
  try {
    Object.defineProperty(window, 'TetrisMotor', { configurable: true, get() { return TM; }, set(v) {
      TM = v; const og = v.grabadora;
      v.grabadora = function (...a) { const g = og.apply(this, a); window.__tsG = g; return g; };
    } });
  } catch (e) { return; }
  const cfg = window.__tsCfg = { modo: 'ia', cada: 40 };
  let objetivo = null, piezaVista = -1, pulsadas = 0;

  // Coloca p en el pozo; devuelve { pozo, lineas } o null si queda fuera
  function coloca(pozo, p) {
    const W = TM.W, H = TM.H; pozo = pozo.slice();
    for (const [x, y] of TM.celdas(p)) { if (y < 0) return null; pozo[y * W + x] = 'X'; }
    let lineas = 0;
    for (let y = H - 1; y >= 0; y--) {
      let llena = true; for (let x = 0; x < W; x++) if (!pozo[y * W + x]) { llena = false; break; }
      if (llena) { lineas++; pozo.splice(y * W, W); pozo.unshift(...new Array(W).fill('')); y++; }
    }
    return { pozo, lineas };
  }
  function valora(pozo, lineas, celdasPieza) {
    const W = TM.W, H = TM.H, alt = new Array(W).fill(0); let huecos = 0, techos = 0;
    for (let x = 0; x < W; x++) {
      let visto = false, sobre = 0;
      for (let y = 0; y < H; y++) { const v = pozo[y * W + x]; if (v) { if (!visto) { alt[x] = H - y; visto = true; } sobre++; } else if (visto) { huecos++; techos += sobre; } }
    }
    let agg = 0, bump = 0, max = 0;
    for (let x = 0; x < W - 1; x++) { agg += alt[x]; max = Math.max(max, alt[x]); if (x < W - 2) bump += Math.abs(alt[x] - alt[x + 1]); }
    max = Math.max(max, alt[W - 1]);
    const peligro = max > 11;
    let v = -0.3 * agg - 6 * huecos - 0.4 * techos - 0.45 * bump;
    // pozos profundos fuera de la columna derecha: malos
    for (let x = 0; x < W - 1; x++) { const iz = x ? alt[x - 1] : 99, de = alt[x + 1] ?? 99, d = Math.min(iz, de) - alt[x]; if (d > 2 && x < W - 1) v -= (d - 2) * 2.5; }
    if (!peligro) {
      v += [0, -6, -4, -2, 30][lineas];               // solo valen los tetris
      if (celdasPieza.some(([x]) => x === W - 1) && lineas < 4) v -= 9;   // la columna derecha es para la I
      v -= alt[W - 1] * 3;
    } else v += lineas * 6 - (max - 11) * 5;
    return v;
  }
  function posiciones(s, pozo, p0) {
    const r = [], est = { ...s, pozo };
    for (const rot of (p0.t === 'O' ? [0] : [0, 1, 2, 3])) for (let x = -3; x < TM.W + 2; x++) {
      let p = { ...p0, r: rot, x, y: Math.max(0, p0.y) };
      if (!TM.cabe(est, p)) continue;
      while (TM.cabe(est, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
      r.push(p);
    }
    return r;
  }
  function planea(s) {
    let mejor = null;
    const sig = s.cola && s.cola[0];
    for (const p of posiciones(s, s.pozo, s.p)) {
      const a = coloca(s.pozo, p); if (!a) continue;
      let v = valora(a.pozo, a.lineas, TM.celdas(p));
      if (sig) {
        let m2 = -1e9; const p1 = { ...s.p, t: sig, r: 0, x: 3, y: 0 };
        for (const q of posiciones(s, a.pozo, p1)) { const b = coloca(a.pozo, q); if (!b) continue; m2 = Math.max(m2, valora(b.pozo, b.lineas, TM.celdas(q))); }
        v = v * 0.4 + m2 * 0.6 + [0, 0, 0, 0, 20][a.lineas];
      }
      if (!mejor || v > mejor.v) mejor = { v, r: p.r, x: p.x };
    }
    return mejor;
  }
  function tecla(code) {
    const o = { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', o));
    document.dispatchEvent(new KeyboardEvent('keyup', o));
  }
  function paso() { window.__tsN = (window.__tsN || 0) + 1;
    const g = window.__tsG, s = g && g.s;
    if (!s || !s.p || s.fin || cfg.modo === 'quieto') return;
    if (cfg.modo === 'tirar') { tecla('Space'); return; }
    if (s.piezas !== piezaVista) { piezaVista = s.piezas; objetivo = planea(s); pulsadas = 0; window.__tsDbg = { piezas: s.piezas, p: s.p, objetivo, cola: s.cola && s.cola.slice(0, 2) }; }
    if (!objetivo) return;
    if (++pulsadas > 14) { tecla('Space'); objetivo = null; return; }
    if (s.p.r !== objetivo.r) { tecla('ArrowUp'); return; }
    if (s.p.x < objetivo.x) { tecla('ArrowRight'); return; }
    if (s.p.x > objetivo.x) { tecla('ArrowLeft'); return; }
    tecla('Space'); objetivo = null;   // nada más hasta que salga la próxima
  }
  window.__tsPaso = paso;
  window.addEventListener('load', () => { if (TM) setInterval(paso, cfg.cada); });
})();
