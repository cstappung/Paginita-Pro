/* PRO DEFENDER — el verificador del club en un Web Worker.
   colabtex/src/juegos/solo/verifica/prodefender.js lo abre desde la página
   para rehacer la partida sin trabar el juego (rehacer cien rondas son
   decenas de segundos de cálculo). Carga los MISMOS archivos que el juego,
   con el mismo ?v=, y guarda en qué quedó cada partida (`cache`) para que
   cada ronda nueva solo simule lo nuevo. */
importScripts('data/enemies.js?v=pd-13', 'data/towers.js?v=pd-13', 'data/levels.js?v=pd-13', 'engine.js?v=pd-13', 'prueba.js?v=pd-13');
const cache = new Map();
onmessage = e => {
  const { id, p, u } = e.data || {};
  let r = null, motivo = null;
  try { r = self.PD.Prueba.rehace(p, u, cache); } catch (err) { motivo = String(err && err.message || err); }
  postMessage({ id, r, motivo });
};
