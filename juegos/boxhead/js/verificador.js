/* Pro BoxHead — el verificador del Solo Club en un Web Worker.
   colabtex/src/juegos/solo/verifica/boxhead.js lo abre desde la página para
   rehacer la partida sin trabar la pestaña (una partida larga son decenas de
   miles de pasos). Carga los MISMOS archivos que el juego, con el mismo ?v=,
   sobre sin-pantalla.js, que vuelve inerte todo lo que dibuja o suena. */
importScripts('sin-pantalla.js?v=boxhead-23', 'datos.js?v=boxhead-23', 'juego.js?v=boxhead-23');
onmessage = e => {
  const { id, p } = e.data || {};
  let r = null, motivo = null;
  try { r = self.__boxhead.rehace(p); } catch (err) { motivo = String(err && err.message || err); }
  postMessage({ id, r, motivo });
};
