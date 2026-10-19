// IA de Tetris para filmar: se engancha a TetrisMotor.grabadora para leer la partida y
// juega con eventos de teclado (los mismos que una persona). Busca tetris: deja la
// columna derecha libre y la llena solo para limpiar 3 o 4 líneas.
(() => {
  let TM;
  try {
    Object.defineProperty(window, 'TetrisMotor', { configurable: true, get() { return TM; }, set(v) {
      TM = v; const og = v.grabadora;
      v.grabadora = function (...a) { const g = og.apply(this, a); window.__tsG = g; return g; };
    } });
  } catch (e) { return; }
  const cfg = window.__tsCfg = { modo: 'ia', cada: 55 };
  let objetivo = null, piezaVista = -1, pendienteUp = null;

  function evalua(s, p) {
    const W = TM.W, H = TM.H, pozo = s.pozo.slice();
    for (const [x, y] of TM.celdas(p)) { if (y < 0) return -1e9; pozo[y * W + x] = 'X'; }
    let lineas = 0;
    for (let y = H - 1; y >= 0; y--) {
      let llena = true; for (let x = 0; x < W; x++) if (!pozo[y * W + x]) { llena = false; break; }
      if (llena) { lineas++; pozo.splice(y * W, W); pozo.unshift(...new Array(W).fill('')); y++; }
    }
    const alt = new Array(W).fill(0); let huecos = 0;
    for (let x = 0; x < W; x++) {
      let visto = false;
      for (let y = 0; y < H; y++) { const v = pozo[y * W + x]; if (v && !visto) { alt[x] = H - y; visto = true; } else if (!v && visto) huecos++; }
    }
    let agg = 0, bump = 0, max = 0;
    for (let x = 0; x < W; x++) { agg += alt[x]; max = Math.max(max, alt[x]); if (x < W - 1) bump += Math.abs(alt[x] - alt[x + 1]); }
    let v = -0.51 * agg - 0.36 * huecos - 0.18 * bump + 0.76 * lineas;
    if (max > 14) v -= (max - 14) * 4;
    return v;
  }
  function planea(s) {
    let mejor = null;
    const rs = s.p.t === 'O' ? [0] : [0, 1, 2, 3];
    for (const r of rs) for (let x = -3; x < TM.W + 2; x++) {
      let p = { ...s.p, r, x, y: Math.max(0, s.p.y) };
      if (!TM.cabe(s, p)) continue;
      while (TM.cabe(s, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
      const v = evalua(s, p);
      if (!mejor || v > mejor.v) mejor = { v, r, x };
    }
    return mejor;
  }
  function tecla(code) {
    const o = { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', o));
    pendienteUp = code;
  }
  function paso() {
    if (pendienteUp) { document.dispatchEvent(new KeyboardEvent('keyup', { code: pendienteUp, key: pendienteUp, bubbles: true })); pendienteUp = null; return; }
    const g = window.__tsG, s = g && g.s;
    if (!s || !s.p || s.fin || cfg.modo === 'quieto') return;
    if (cfg.modo === 'tirar') { tecla('Space'); return; }
    if (s.piezas !== piezaVista) { piezaVista = s.piezas; objetivo = planea(s); }
    if (!objetivo) return;
    if (s.p.r !== objetivo.r) { tecla('ArrowUp'); return; }
    if (s.p.x < objetivo.x) { tecla('ArrowRight'); return; }
    if (s.p.x > objetivo.x) { tecla('ArrowLeft'); return; }
    tecla('Space');
  }
  window.__tsPaso = paso;
  window.addEventListener('load', () => { if (TM) setInterval(paso, cfg.cada); });
})();
