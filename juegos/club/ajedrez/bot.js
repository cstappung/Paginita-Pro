/* El bot de Ajedrez Club en un worker, para que pensar (hasta unos cientos
   de ms en el nivel Maestro) no trabe el tablero. Rehace la partida desde
   el principio con las jugadas que le llegan —la repetición necesita la
   historia entera— y responde la jugada que elegiría `eligeBot` con el azar
   de esa jugada: exactamente lo que calcula `rehaceBot` en el verificador. */
importScripts('motor.js?v=ajedrez-1');
self.onmessage = e => {
  const M = self.AjedrezMotor, { id, movs, nivel, semilla } = e.data || {};
  try {
    const p = M.inicial();
    for (const s of movs || []) { const m = M.deUci(p, s); if (!m) throw new Error('jugada ilegal ' + s); M.hacer(p, m); }
    const { m } = M.eligeBot(p, nivel, M.azarDe(semilla, (movs || []).length));
    self.postMessage({ id, uci: m ? M.uci(m) : '' });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
