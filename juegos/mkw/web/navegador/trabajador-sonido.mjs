// Paso 8 (N3/P10, bitácora §186): el sonido del juego desde un Worker.
//
// El puente del sonido (§88) desde el Worker: la misma forma que sonido.mjs `puente` (abrir/entregar/nivelMs/objetivoMs),
// pero cada pedazo va DIRECTO al AudioWorklet por el MessagePort que la página le dio (el hilo de la página no lo toca).
// La cola del worklet avisa su nivel por el mismo puerto (cada ~21 ms): el ajuste fino de ritmo del runtime lo lee.
import { crearReciclador } from './sonido-reciclar.mjs';

export function puenteSonido({ puerto, tasa }) {
  let nivel = -1, objetivo = 25, corriendo = false;
  const reciclador = crearReciclador();                       // P5 (§232): las cajas vuelven del worklet con su informe
  const estado = { entregas: 0, descartadas: 0, reciclado: reciclador.estado };
  puerto.onmessage = e => {
    const m = e.data;
    if (m && m.t === 'e') { nivel = m.fase === 'sonando' ? m.nivel : -1; objetivo = m.objetivo ?? objetivo; if (m.b) reciclador.devolver(m.b); }
  };
  return {
    estado,
    set corriendo(v) { corriendo = !!v; },
    abrir: () => tasa | 0,
    entregar(vista) {
      if (!corriendo) { estado.descartadas++; return; }      // (el AudioContext todavía espera el primer gesto)
      const d = reciclador.copiar(vista);                     // la memoria del wasm puede moverse: una copia (en una caja reusada), transferida
      puerto.postMessage(d, [d.buffer]);
      estado.entregas++;
    },
    nivelMs: () => (corriendo ? nivel : -1),
    objetivoMs: () => objetivo,
  };
}
