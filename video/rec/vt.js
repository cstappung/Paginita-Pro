// Reloj virtual: en modo 'real' avanza con el reloj de verdad; en 'virtual' sólo con __vt.step(ms).
(() => {
  if (window.__vt) return;
  const P = performance, realNow = P.now.bind(P), oRaf = window.requestAnimationFrame.bind(window);
  const oST = window.setTimeout.bind(window), oDN = Date.now;
  const base = oDN() - realNow();
  let now = realNow(), mode = 'real', lastReal = realNow();
  const rafs = new Map(); let rid = 1;
  const timers = new Map(); let tid = 1;
  P.now = () => now;
  Date.now = () => Math.floor(base + now);
  const ODate = Date;
  window.requestAnimationFrame = cb => { const id = rid++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = id => rafs.delete(id);
  window.setTimeout = (fn, ms, ...a) => { const id = tid++; timers.set(id, { fn, at: now + Math.max(0, +ms || 0), a, rep: 0 }); return id; };
  window.setInterval = (fn, ms, ...a) => { const id = tid++; const r = Math.max(4, +ms || 0); timers.set(id, { fn, at: now + r, a, rep: r }); return id; };
  window.clearTimeout = window.clearInterval = id => timers.delete(id);
  function runTimers() {
    for (let guard = 0; guard < 5000; guard++) {
      let best = null, bid = 0;
      for (const [id, t] of timers) if (t.at <= now && (!best || t.at < best.at)) { best = t; bid = id; }
      if (!best) break;
      if (best.rep) best.at += best.rep; else timers.delete(bid);
      try { typeof best.fn === 'function' ? best.fn(...best.a) : eval(best.fn); } catch (e) { console.error(e); }
    }
  }
  function step(dt) {
    const end = now + dt;
    // timers a resolución de 4 ms para que los intervalos rápidos se repartan
    while (now < end) { now = Math.min(end, now + 4); runTimers(); }
    const cbs = [...rafs.values()]; rafs.clear();
    for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
  }
  (function pump() { const r = realNow(); if (mode === 'real') step(Math.min(100, r - lastReal)); lastReal = r; oRaf(pump); })();
  // respaldo cuando la pestaña no pinta
  (function tick() { if (mode === 'real' && realNow() - lastReal > 120) { step(realNow() - lastReal); lastReal = realNow(); } oST(tick, 50); })();
  // Reloj de audio: en modo virtual avanza con `now` desde donde estaba (PRO HERO sincroniza con él)
  let anclas = new WeakMap();
  try {
    const BAC = window.BaseAudioContext || window.AudioContext, d = Object.getOwnPropertyDescriptor(BAC.prototype, 'currentTime');
    Object.defineProperty(BAC.prototype, 'currentTime', { configurable: true, get() {
      const real = d.get.call(this); if (mode !== 'virtual') return real;
      let a = anclas.get(this); if (!a) { a = { ct: real, now }; anclas.set(this, a); } return a.ct + (now - a.now) / 1000; } });
    const oGOT = AudioContext.prototype.getOutputTimestamp;
    AudioContext.prototype.getOutputTimestamp = function () { if (mode !== 'virtual') return oGOT.call(this); return { contextTime: this.currentTime, performanceTime: now }; };
  } catch (e) {}
  window.__vt = { step, virtual() { mode = 'virtual'; anclas = new WeakMap(); }, real() { mode = 'real'; lastReal = realNow(); }, get now() { return now; } };
})();
