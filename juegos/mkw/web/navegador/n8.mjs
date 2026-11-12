// N8 (bitácora §219): cuándo dibujar a 30 y mostrar 60 con la imagen de entre medio de aurora.
//
// Resumen. El juego (n8_nativo.cpp) sabe dibujar uno de cada dos cuadros de la carrera (la lógica sigue a 60) y aurora
// sabe inventar la imagen del medio: un aparato que alcanza a CALCULAR 60 pero no a DIBUJAR 60 se ve a 60 parejos, a
// cambio de un cuadro (16,7 ms) más de demora y del 2D (el marcador) a 30. Decisión del dueño (2026-11-02): es
// OPCIONAL; se prende solo en los aparatos que no llegan a 60 (o si el jugador lo pide) y queda apagado en los PC que sí
// llegan, así nadie paga la demora sin necesitarla. Este archivo es esa regla, sin el juego (banco `n8`):
//   - modoPedido(?n8): '1' = dibujar a 30 sin la imagen del medio, '2' = con ella, 'auto' = la vigía decide; otro = no.
//     (§283: '3' = «20 parejas», dibujar uno de cada tres: para el aparato que ni con «30 parejas» alcanza)
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
export const SALA_AJENA = 2;          // §269: ms por cuadro esperando a la sala: más = el ritmo es de otro
// §283: la prueba de «no mejora» compara solo segundos del MISMO lugar. Con N8 en elegir personaje (§270) se prendía en
// esa pantalla (liviana: ~50 cuadros por segundo en el Oppo) y la prueba seguía en la largada de 8.3 (pesada: ~40 aun
// con N8): «no mejora», apagado para siempre, y la sala «Cada uno su kart» quedó a 37 de lógica y 1 % bajo 9 (medido).
// Es como juzgar un regulador comparando la tensión en vacío con la tensión a plena carga: el regulador no tuvo la culpa.
// Si el lugar cambia antes de terminar la prueba, la prueba se abandona (N8 sigue prendido; «le sobra» lo puede apagar
// después). mismoLugar: false = como antes (?n8MismoLugar=0)
const CLAVE = 'mkw.n8.auto';
const CLAVE_VERSION = 'mkw.n8.auto.prueba';   // §269: con qué prueba se decidió lo guardado
export const VERSION_PRUEBA = 284;   // (§275b: la prueba también pasa si con N8 la lógica llega a 60; §283: un «no» de cuando la prueba mezclaba elegir personaje con la carrera se olvida una vez; §283.9: el «no» del modo 1 también)

// Qué modo prende Automático (el dueño, 2026-11-07, medido en su Oppo Find X9 Pro): en un TELÉFONO, «30 parejas»
// (modo 1: dibuja uno de cada dos sin inventar el del medio; 30 fijos, la lógica a 60, el procesador de ~31 a ~23 ms por
// cuadro, «se ve bien»); en un PC, el modo 2 (60 a la vista con la imagen del medio). El modo 2 en el teléfono le pide al
// procesador ~30 ms por cuadro (la imagen del medio duplica las pasadas): 1 deja más margen. La lógica va a 60 en los dos.
export function modoAutomatico({ telefono = false } = {}) {
  return telefono ? 1 : 2;
}

export function modoPedido(v) {
  const t = String(v ?? '').trim();
  return t === '1' ? 1 : t === '2' ? 2 : t === '3' ? 3 : t === 'auto' ? 'auto' : 0;   // (§283: 3 = «20 parejas»)
}

export function crearVigiaN8({ prender = () => {}, apagar = () => {}, almacen = globalThis.localStorage, mismoLugar = true, menuNoPasa = true, probar = () => true } = {}) {
  // probar() = false: sin la prueba de «no mejora» en este momento (§283.9: el modo 1, «30 parejas» sin la imagen del
  // medio, alivia la CPU Y la tarjeta, así que no hay aparato donde empeore; y en «Cada uno su kart» el ponerse al día
  // sostiene la lógica cerca de 57 y la prueba, que mira solo la lógica, decía «no» aunque las imágenes salían parejas)
  // (empezar prendido por lo recordado cuenta como un cambio: fue una decisión de la carrera anterior)
  let sirve = true;   // false = ya se probó y no mejoró: no se vuelve a prender en este aparato
  // §269: hasta la v2.0 la prueba de «no mejora» medía en la carrera las IMÁGENES por segundo como si fueran la lógica;
  // en la sala (el reloj va por la hora, no por el monitor) N8 sube la lógica pero no las imágenes, y la prueba lo apagaba
  // y anotaba «no» para siempre en ese aparato (también para el Single Player). Un «no» de antes de §269 se olvida una vez.
  // (§275b: lo mismo con un «no» de antes de que la prueba aceptara «con N8 llega a 60»)
  try {
    if (almacen?.getItem(CLAVE_VERSION) !== String(VERSION_PRUEBA)) {
      if (almacen?.getItem(CLAVE) === 'no') almacen.setItem(CLAVE, '0');
      almacen?.setItem(CLAVE_VERSION, String(VERSION_PRUEBA));
    }
  } catch {}
  try { sirve = almacen?.getItem(CLAVE) !== 'no'; } catch {}
  let recordado = false;
  try { recordado = almacen?.getItem(CLAVE) === '1'; } catch {}
  // antes = lógica por segundo de los segundos malos que lo prendieron; prueba = lo visto los primeros SEGUNDOS_APAGA con N8
  const estado = { prendido: recordado, cambios: recordado ? 1 : 0, fijo: false, malos: 0, sobrados: 0, ultimo: null,
    sirve, antes: [], prueba: [], lugarAntes: null, abandonadas: 0, lugarPrendido: null, soltadosMenu: 0 };
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
  // §269: salaMs = lo que el juego esperó por cuadro los botones de la sala (null = no es la sala). Un segundo en que la
  // sala lo frenó más de SALA_AJENA ms por cuadro no dice nada de ESTE aparato (va al ritmo del más lento de la sala): no
  // cuenta ni para prender ni para la prueba de «no mejora» (antes la sala hacía fallar la prueba y N8 quedaba en «no»
  // para siempre en ese aparato, también para el Single Player)
  // lugar = dónde se midió ('carrera', 'menú'…; §283): la prueba de «no mejora» no mezcla lugares
  const segundo = ({ enCarrera = false, visible = true, imagenes = null, logica = null, juegoMs = null, salaMs = null, lugar = null } = {}) => {
    if (!enCarrera || !visible || imagenes == null || logica == null || juegoMs == null) return estado;
    if (salaMs != null && salaMs > SALA_AJENA) { estado.ajenos = (estado.ajenos || 0) + 1; return estado; }
    const ocupado = Math.min(1, (juegoMs * logica) / 1000);
    estado.ultimo = { imagenes, logica, juegoMs, ocupado };
    if (!estado.prendido) {
      if (!estado.sirve) return estado;
      const malo = imagenes < UMBRAL_IMAGENES && ocupado > OCUPADO_PRENDE;
      estado.malos = malo ? estado.malos + 1 : 0;
      // (§283: los segundos malos de «antes» son todos de un mismo lugar; si cambia, se empieza a contar de nuevo ahí)
      if (mismoLugar && malo && estado.antes.length && estado.lugarAntes !== lugar) { estado.antes = []; estado.malos = 1; }
      estado.antes = malo ? [...estado.antes, logica].slice(-SEGUNDOS_PRENDE) : [];
      estado.lugarAntes = malo ? lugar : null;
      if (estado.malos >= SEGUNDOS_PRENDE) { const l = lugar; cambiar(true, 'no llega a 60'); estado.lugarPrendido = l; }
      return estado;
    }
    // §283: lo que se decidió en elegir personaje no pasa a la carrera. Allí el aparato puede ir lento por la carga (en
    // este PC: 379 pipelines compilándose) y no por la carrera: dos PC de la sala prendieron N8 en ese menú, lo
    // arrastraron a la carrera, donde les sobraba, y su Imagen bajó a 59 %. Al llegar a la carrera se apaga sin anotar
    // «no» ni contar como cambio, y la vigía de la carrera decide con lo suyo (3 s malos). menuNoPasa: false = como antes
    // (?n8MenuPasa=1)
    if (menuNoPasa && estado.lugarPrendido === 'menú' && lugar === 'carrera') {
      estado.soltadosMenu++;
      cambiar(false, 'era de elegir personaje');
      estado.cambios--;
      estado.lugarPrendido = null;
      return estado;
    }
    // la prueba (§219): si con N8 la lógica no sube un MEJORA_MIN sobre lo de antes (lo que frena es la tarjeta, que con
    // la imagen del medio dibuja igual), se apaga y no se vuelve a prender en este aparato (mkw.n8.auto = 'no')
    if (estado.antes.length && estado.prueba.length < SEGUNDOS_APAGA && mismoLugar && lugar !== estado.lugarAntes) {
      estado.antes = []; estado.prueba = []; estado.abandonadas++;   // (§283: cambió el lugar: sin veredicto, sigue prendido)
    }
    if (estado.antes.length && estado.prueba.length < SEGUNDOS_APAGA && !probar()) { estado.antes = []; estado.prueba = []; estado.sinPrueba = (estado.sinPrueba || 0) + 1; }
    if (estado.antes.length && estado.prueba.length < SEGUNDOS_APAGA) {
      estado.prueba.push(logica);
      // §275b: también sirve si con N8 la lógica llega a 60 (≥ UMBRAL_IMAGENES), aunque no haya subido un 8 %. En «Cada uno
      // su kart» el ponerse al día (mkw_prisa) sostiene la lógica cerca de 60 aunque la imagen no llegue: antes de N8 ya
      // había ~57, no quedaba 8 % que ganar, la prueba decía «no mejora» y el teléfono intentaba 60 (45 imágenes,
      // disparejas, 1 % bajo 16,6; con «30 parejas» 21–22, medido por sim-sala-mixta en el Oppo). Un «no» guardado con la
      // prueba de antes se olvida una vez (VERSION_PRUEBA).
      const conN8 = media(estado.prueba);
      if (estado.prueba.length === SEGUNDOS_APAGA && conN8 < UMBRAL_IMAGENES && conN8 < media(estado.antes) * (1 + MEJORA_MIN)) {
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
