// Bot de Yemas zombis para filmar: inmortal, apunta al zombi más cercano y dispara.
(() => { if (!/yemas/.test(location.pathname)) return;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return document.getElementById('lienzo'); } });
  Element.prototype.requestPointerLock = function () { return Promise.resolve(); };
  const cfg = window.__ybCfg = { signo: 1, armas: [5, 0, 13], sel: 2 };
  window.addEventListener('load', () => {
    let t = 0, armado = false, apretado = false;
    setInterval(() => {
      const Y = window.__yemas; if (!Y || !Y.yo || !Y.yo.vivo || !Y.yo.pos) return;
      const yo = Y.yo; t++;
      yo.hp = yo.maxHp || 100; if (yo.abatido) yo.abatido = 0;
      if (!armado && cfg.armas) { yo.inv = cfg.armas.slice(); yo.sel = cfg.sel; armado = true; }
      let est = null; try { est = Y.zombis && Y.zombis.estado(); } catch (e) {}
      const zs = (est && est.z) || [], p = yo.pos;
      let best = null, bd = 1e9;
      for (const z of zs) { if (z[6]) continue; const d = Math.hypot(z[1] - p.x, z[3] - p.z); if (d < bd) { bd = d; best = z; } }
      window.__ybDbg = { n: zs.length, bd, r: est && est.r, zk: yo.zk, pz: yo.pzT };
      if (best) {
        const dx = best[1] - p.x, dz = best[3] - p.z, dy = (best[2] + 1.0) - (p.y + 1.55);
        const objetivo = cfg.signo > 0 ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
        let d = objetivo - yo.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        yo.yaw += d * 0.4; yo.pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz))));
        if (Math.abs(d) < 0.25) { if (!apretado || t % 3 === 0) { dispatchEvent(new MouseEvent('mouseup', { button: 0 })); dispatchEvent(new MouseEvent('mousedown', { button: 0 })); apretado = true; } }
      } else { if (apretado) dispatchEvent(new MouseEvent('mouseup', { button: 0 })); apretado = false; yo.yaw += 0.015; yo.pitch *= 0.9; }
    }, 50);
  });
})();
