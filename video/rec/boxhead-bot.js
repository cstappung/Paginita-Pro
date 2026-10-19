// Bot de Boxhead para filmar: inmortal, todas las armas, apunta al enemigo más cercano.
(() => { if (!/boxhead/.test(location.pathname)) return;
  window.addEventListener('load', () => {
    let t = 0, listo = false, iw = 0;
    const ARMAS = [1, 2, 6, 4, 6, 2];
    setInterval(() => {
      const B = window.__boxhead; if (!B) return;
      let m; try { m = B.mundo(); } catch (e) { return; }
      if (!m || !m.yo) return;
      if (!listo) { try { B.inmortal(true); B.armas(); listo = true; } catch (e) { return; } }
      const K = B.teclas, yo = m.yo; t++;
      if (t % 30 === 0) { iw = (iw + 1) % ARMAS.length; try { B.elige(ARMAS[iw]); } catch (e) {} }
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(k => K.delete(k));
      let best = null, bd = 1e9;
      for (const e of m.E) { const d = Math.hypot(e.x - yo.x, e.y - yo.y); if (d < bd) { bd = d; best = e; } }
      if (!best) { K.delete('Space'); K.add(['KeyW', 'KeyD', 'KeyS', 'KeyA'][Math.floor(t / 12) % 4]); return; }
      const dx = best.x - yo.x, dy = best.y - yo.y, a = Math.atan2(dy, dx);
      const sx = Math.abs(Math.cos(a)) > 0.38 ? Math.sign(dx) : 0, sy = Math.abs(Math.sin(a)) > 0.38 ? Math.sign(dy) : 0;
      const huye = bd < 70, mueve = huye || bd > 260 || t % 3 === 0;
      if (mueve) { const f = huye ? -1 : 1; if (sx * f > 0) K.add('KeyD'); if (sx * f < 0) K.add('KeyA'); if (sy * f > 0) K.add('KeyS'); if (sy * f < 0) K.add('KeyW'); }
      if (huye && t % 2 === 0) { ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(k => K.delete(k)); if (sx > 0) K.add('KeyD'); if (sx < 0) K.add('KeyA'); if (sy > 0) K.add('KeyS'); if (sy < 0) K.add('KeyW'); }
      K.add('Space');
    }, 100);
  });
})();
