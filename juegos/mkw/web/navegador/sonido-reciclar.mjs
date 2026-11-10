// P5 (plan v4, etapa E6, bitácora §232): los búferes del sonido, reciclados.
//
// Resumen: el juego entrega ~330 pedazos de sonido por segundo (uno cada ~3 ms). Antes, cada uno era un búfer NUEVO
// (`vista.slice()`) que se le pasaba al AudioWorklet y quedaba ahí como basura (~380 KB por segundo que el recolector de
// V8 tenía que barrer). Ahora hay una reserva de búferes: se copia el pedazo en uno de la reserva, se le pasa al worklet
// (transferido: no se copia otra vez), el worklet lo copia a su cola y lo DEVUELVE junto con su informe, y vuelve a la
// reserva. Es como una cinta transportadora con cajas que vuelven vacías en lugar de tirar cada caja.
//
//   juego → [caja de la reserva] → worklet (copia a su cola) → la caja vuelve con el informe → reserva
//
// Cada caja tiene lugar para CAPACIDAD números (izq y der intercalados): un pedazo es de ~144 cuadros × 2 = ~290; uno
// más grande que eso (después de un tirón llega todo junto) usa una caja nueva a su medida, que también se recicla.
// Si la reserva se queda sin cajas (el worklet todavía no devolvió), se hace una nueva: nunca se espera.
// Sin memoria compartida: el sitio no tiene COOP/COEP (§88).

const CAPACIDAD = 2048;          // números por caja (1.024 cuadros estéreo = 21 ms a 48 kHz: holgado)
const TOPE_RESERVA = 96;         // más que esto en la reserva = sobran; se sueltan (no debería pasar)

export function crearReciclador() {
  const reserva = [];            // ArrayBuffer libres
  const estado = { nuevos: 0, reusados: 0, devueltos: 0, soltados: 0 };
  return {
    estado,
    // Copia `vista` (Float32Array que mira la memoria del wasm) en una caja de la reserva y devuelve una vista del
    // largo justo sobre esa caja, lista para transferir (`postMessage(v, [v.buffer])`)
    copiar(vista) {
      const n = vista.length;
      let buf = null;
      for (let i = reserva.length - 1; i >= 0; i--) {             // (casi siempre la última sirve: todas son iguales)
        if (reserva[i].byteLength >= n * 4) { buf = reserva[i]; reserva[i] = reserva[reserva.length - 1]; reserva.pop(); break; }
      }
      if (buf) estado.reusados++;
      else { buf = new ArrayBuffer(Math.max(CAPACIDAD, n) * 4); estado.nuevos++; }
      const v = new Float32Array(buf, 0, n);
      v.set(vista);
      return v;
    },
    // Las cajas que devolvió el worklet (un arreglo de ArrayBuffer, o nada)
    devolver(lista) {
      if (!lista) return;
      for (const b of lista) {
        if (!(b instanceof ArrayBuffer) || !b.byteLength) continue;
        estado.devueltos++;
        if (reserva.length < TOPE_RESERVA) reserva.push(b); else estado.soltados++;
      }
    },
    libres: () => reserva.length,
  };
}
