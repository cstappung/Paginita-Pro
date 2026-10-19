// Clue de práctica para filmar: 5 bots y el asiento «yo» (GUGU GAGA) lo juega otro bot, como en clue-bots.test.cjs
(() => {
  try { localStorage.setItem('clue.bots', '5'); localStorage.setItem('clue.nombre', 'GUGU GAGA'); } catch (e) {}
  // los avisos que esperan a una persona («Entendido») se cierran solos
  setInterval(() => { for (const b of document.querySelectorAll('button')) if (/^\s*Entendido\s*$/.test(b.innerText || '') && b.offsetParent) b.click(); }, 700);
  let CM;
  Object.defineProperty(window, 'ClueMesa', { configurable: true, get() { return CM; }, set(v) {
    CM = v; const og = v.crearMesa;
    v.crearMesa = function (op) {
      const m = og.call(this, Object.assign({}, op, { ritmo: window.__clueRitmo || 1.6 }));
      const M = window.ClueMotor, B = window.ClueBots, uids = m.jugadores.map(j => j.uid);
      let yo = null, ultimo = null, intentos = { clave: '', n: 0 };
      function mueve(vv) {
        const est = vv.est, priv = vv.priv;
        if (est.fase === 'fin') return;
        if (est.fase === 'elige') { if (!est.eleccion.yo) m.jugar({ t: 'elige', r: 'carmin' }); return; }
        if (!yo) yo = B.crear({ uid: 'yo', mano: priv.mano, jugadores: uids, nivel: 2 });
        if (!est.debe.includes('yo')) return;
        if (est.paso === 'refuta') {
          const pedidas = [M.cartaS(est.sug.s), M.cartaA(est.sug.a), M.cartaL(est.sug.l)], mias = priv.mano.filter(c => pedidas.includes(c));
          if (mias.length) m.refutar(yo.refuta(est.sug, est) || mias[0]); return;
        }
        if (est.turno !== 'yo' || !['inicio', 'accion', 'tras'].includes(est.paso)) return;
        const clave = est.aceptadas + '|' + est.paso;
        if (intentos.clave === clave) intentos.n++; else intentos = { clave, n: 0 };
        let j = null; try { j = yo.decide(est, priv.vistas); } catch (e) {}
        if (!j || intentos.n > 0) j = { t: 'pasa' };
        m.jugar(j);
      }
      m.suscribir(vv => { ultimo = vv; setTimeout(() => mueve(ultimo), 400); });
      return m;
    };
  } });
})();
