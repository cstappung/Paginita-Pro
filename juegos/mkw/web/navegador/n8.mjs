// N8 (bitácora §219): cuándo dibujar a 30 y mostrar 60 con la imagen de entre medio de aurora.
//
// Resumen. El juego (n8_nativo.cpp) sabe dibujar uno de cada dos cuadros de la carrera (la lógica sigue a 60) y aurora
// sabe inventar la imagen del medio: un aparato que alcanza a CALCULAR 60 pero no a DIBUJAR 60 se ve a 60 parejos, a
// cambio de un cuadro (16,7 ms) más de demora y del 2D (el marcador) a 30. Decisión del dueño (2026-11-02): es
// OPCIONAL; se prende solo en los aparatos que no llegan a 60 (o si el jugador lo pide) y queda apagado en los PC que sí
// llegan, así nadie paga la demora sin necesitarla. Este archivo es esa regla, sin el juego (banco `n8`):
//   - modoPedido(?n8): '1' = dibujar a 30 sin la imagen del medio, '2' = con ella, 'auto' = la vigía decide; otro = no.
//   - crearVigiaN8: una vez por segundo con la carrera andando y la pestaña a la vista recibe lo que se mostró y cuánto
//     trabajó el juego. Prende si en 3 segundos seguidos se vieron menos de 57 imágenes y el hilo del juego estuvo
//     ocupado más del 60 % (si el hilo está desocupado lo que frena es la tarjeta o la pantalla: N8 no ayuda, la tarjeta
//     igual dibuja todo con la imagen del medio). Apaga si con N8 el hilo estuvo ocupado menos del 40 % durante 10 s
//     seguidos (dibujando todo le sobraría). Tras 3 cambios se queda prendido (no titubear). Recuerda lo último por
//     aparato (localStorage mkw.n8.auto): la carrera siguiente empieza como terminó la anterior.
//   - La prueba: los primeros 10 s con N8 la lógica por segundo tiene que subir un 8 % sobre los segundos que lo
//     prendieron; si no (la gama media de §219 frena la tarjeta y con N8 baja de 18 a 13), se apaga y queda 'no'.
// Como el termostato de una heladera: prende con el umbral de arriba, apaga con el de abajo (la histéresis), y no se
// prende y apaga cada segundo.

export const UMBRAL_IMAGENES = 57;   // menos de esto por segundo = no llega a 60
export const OCUPADO_PRENDE = 0.6;   // fracción del segundo que el hilo del juego trabajó (CPU pura)
export const OCUPADO_APAGA = 0.4;
export const SEGUNDOS_PRENDE = 3;
export const SEGUNDOS_APAGA = 10;
export const CAMBIOS_MAX = 3;
export const MEJORA_MIN = 0.08;       // con N8 la lógica tiene que subir al menos un 8 % o se apaga para siempre
const CLAVE = 'mkw.n8.auto';

// Qué modo prende Automático (el dueño, 2026-11-07, medido en su Oppo Find X9 Pro): en un TELÉFONO, «30 parejas»
// (modo 1: dibuja uno de cada dos sin inventar el del medio; 30 fijos, la lógica a 60, el procesador de ~31 a ~23 ms por
// cuadro, «se ve bien»); en un PC, el modo 2 (60 a la vista con la imagen del medio). El modo 2 en el teléfono le pide al
// procesador ~30 ms por cuadro (la imagen del medio duplica las pasadas): 1 deja más margen. La lógica va a 60 en los dos.
export function modoAutomatico({ telefono = false } = {}) {
  return telefono ? 1 : 2;
}

export function modoPedido(v) {
  const t = String(v ?? '').trim();
  return t === '1' ? 1 : t === '2' ? 2 : t === 'auto' ? 'auto' : 0;
}

export function crearVigiaN8({ prender = () => {}, apagar = () => {}, almacen = globalThis.localStorage } = {}) {
  let recordado = false;
  try { recordado = almacen?.getItem(CLAVE) === '1'; } catch {}
  // (empezar prendido por lo recordado cuenta como un cambio: fue una decisión de la carrera anterior)
  let sirve = true;   // false = ya se probó y no mejoró: no se vuelve a prender en este aparato
  try { sirve = almacen?.getItem(CLAVE) !== 'no'; } catch {}
  // antes = lógica por segundo de los segundos malos que lo prendieron; prueba = lo visto los primeros SEGUNDOS_APAGA con N8
  const estado = { prendido: recordado, cambios: recordado ? 1 : 0, fijo: false, malos: 0, sobrados: 0, ultimo: null,
    sirve, antes: [], prueba: [] };
  const recordar = () => { try { almacen?.setItem(CLAVE, !estado.sirve ? 'no' : estado.prendido ? '1' : '0'); } catch {} };
  const cambiar = (prendido, por) => {
    estado.prendido = prendido; estado.cambios++; estado.malos = 0; estado.sobrados = 0; estado.prueba = [];
    if (!prendido) estado.antes = [];
    if (estado.cambios >= CAMBIOS_MAX && prendido) estado.fijo = true;
    recordar();
    (prendido ? prender : apagar)(por);
  };
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  if (recordado) prender('recordado');
  // imagenes = imágenes distintas mostradas en el segundo; logica = cuadros de lógica; juegoMs = CPU pura por cuadro de lógica
  const segundo = ({ enCarrera = false, visible = true, imagenes = null, logica = null, juegoMs = null } = {}) => {
    if (!enCarrera || !visible || imagenes == null || logica == null || juegoMs == null) return estado;
    const ocupado = Math.min(1, (juegoMs * logica) / 1000);
    estado.ultimo = { imagenes, logica, juegoMs, ocupado };
    if (!estado.prendido) {
      if (!estado.sirve) return estado;
      const malo = imagenes < UMBRAL_IMAGENES && ocupado > OCUPADO_PRENDE;
      estado.malos = malo ? estado.malos + 1 : 0;
      estado.antes = malo ? [...estado.antes, logica].slice(-SEGUNDOS_PRENDE) : [];
      if (estado.malos >= SEGUNDOS_PRENDE) cambiar(true, 'no llega a 60');
      return estado;
    }
    // la prueba (§219): si con N8 la lógica no sube un MEJORA_MIN sobre lo de antes (lo que frena es la tarjeta, que con
    // la imagen del medio dibuja igual), se apaga y no se vuelve a prender en este aparato (mkw.n8.auto = 'no')
    if (estado.antes.length && estado.prueba.length < SEGUNDOS_APAGA) {
      estado.prueba.push(logica);
      if (estado.prueba.length === SEGUNDOS_APAGA && media(estado.prueba) < media(estado.antes) * (1 + MEJORA_MIN)) {
        estado.sirve = false; estado.fijo = false;
        cambiar(false, 'no mejora');
        return estado;
      }
    }
    if (!estado.fijo) {
      estado.sobrados = ocupado < OCUPADO_APAGA ? estado.sobrados + 1 : 0;
      if (estado.sobrados >= SEGUNDOS_APAGA) cambiar(false, 'le sobra');
    }
    return estado;
  };
  return { segundo, estado };
}
