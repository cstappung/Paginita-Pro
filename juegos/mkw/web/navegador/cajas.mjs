// Paso 8 (H5, bitácora §188): el plan B de los hilos, sin memoria compartida: «pasarse cajas en vez de compartir la mesa».
//
// Con memoria compartida (SharedArrayBuffer) dos hilos miran la misma mesa: uno escribe, el otro lee, y se avisan con
// Atomics. Sin ella (el sitio sin COOP/COEP y, quizás, el teléfono sin Document-Isolation-Policy) cada hilo tiene su mesa.
// El plan B: unas pocas CAJAS (ArrayBuffer) que van y vuelven por un MessagePort TRANSFERIDAS, o sea sin copiar el
// contenido: el dueño cambia de manos y el que la mandó ya no la puede tocar (queda de largo 0). Como una cinta
// transportadora con N bandejas entre dos puestos de trabajo: el primero llena una bandeja (los comandos de dibujo de un
// cuadro), la pone en la cinta y toma otra vacía; el segundo la vacía (aurora) y la devuelve. Si no hay bandeja vacía, el
// primero espera: es la contrapresión (en electricidad, un búfer lleno que frena a la fuente).
//
// Productor:   const c = crearCinta({ puerto, piezas: 3, tam: 1 << 20 });
//              const caja = await c.tomar();            // Uint8Array de tam bytes, vacía (es mía)
//              … llenar caja[0..n) …;  c.entregar(caja, n, extra);
// Consumidor:  atenderCinta({ puerto, trabajar: (vista, extra) => { … } })   // vista = los n bytes; al volver, la caja vuelve
// Mensajes: { t: 'caja', b, n, x } (ida) y { t: 'vuelta', b, r } (vuelta, r = lo que devolvió trabajar). Nada se copia.
export function crearCinta({ puerto, piezas = 3, tam = 1 << 20, alVolver = null } = {}) {
  const libres = Array.from({ length: piezas }, () => new ArrayBuffer(tam));
  const esperan = [];
  const estado = { entregadas: 0, vueltas: 0, esperas: 0, msEspera: 0, enCamino: 0 };
  puerto.onmessage = e => {
    const m = e.data;
    if (m.t !== 'vuelta') return;
    estado.vueltas++; estado.enCamino--;
    alVolver?.(m.r);
    const f = esperan.shift();
    if (f) f(m.b); else libres.push(m.b);
  };
  return {
    estado,
    // una caja vacía (si no hay, espera a que vuelva una)
    tomar() {
      const b = libres.pop();
      if (b) return Promise.resolve(new Uint8Array(b));
      estado.esperas++;
      const t0 = performance.now();
      return new Promise(r => esperan.push(x => { estado.msEspera += performance.now() - t0; r(new Uint8Array(x)); }));
    },
    // mandar la caja llena (n bytes usados) con un dato chico aparte (p. ej. el número de cuadro)
    entregar(caja, n, extra = null) {
      estado.entregadas++; estado.enCamino++;
      puerto.postMessage({ t: 'caja', b: caja.buffer, n, x: extra }, [caja.buffer]);
    },
  };
}

export function atenderCinta({ puerto, trabajar }) {
  const estado = { atendidas: 0, msTrabajo: 0 };
  puerto.onmessage = async e => {
    const m = e.data;
    if (m.t !== 'caja') return;
    const t0 = performance.now();
    const r = await trabajar(new Uint8Array(m.b, 0, m.n), m.x);
    estado.msTrabajo += performance.now() - t0; estado.atendidas++;
    puerto.postMessage({ t: 'vuelta', b: m.b, r }, [m.b]);
  };
  return { estado };
}
