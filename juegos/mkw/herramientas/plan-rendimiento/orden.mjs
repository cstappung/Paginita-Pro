// Orden de trabajo del plan de rendimiento (versión 4, 2026-10-31): las etapas 0–6, con lo que tarda cada una, y
// debajo los pasos viejos (versiones 1–3) como historia («historia: true»: no van en el calendario).
// Cada ítem de la lista va en un solo paso (lo revisa generar.mjs). «semanas» = [mínimo, máximo] de trabajo;
// «paralelo: n» = arranca junto con el paso n y no lo espera. Las casillas de «Avance» salen de avance.mjs.
// Los pasos viejos conservan su número (las casillas «paso4.1», «paso7.2»… de avance.mjs siguen valiendo) y solo los
// ítems cerrados (hechos o descartados); lo que seguía abierto pasó a una etapa de la versión 4.
// Cadenas con comillas simples: dentro se usan `código`, **negrita** y [[ID]] para citar un ítem.

const P = (...x) => x.join('\n\n');

export const ordenIntro = P(
  'Este es el orden de la **versión 4** (2026-10-31): siete etapas (más la 4b, agregada el 2026-11-04 con lo ambicioso que dejó la etapa 4, y la 4c, agregada el 2026-11-05: las mejoras chicas medidas juntas). Primero **dos semanas de pilotos que deciden** (etapa 0): cada uno tiene un número que lo aprueba y otro que lo mata, para no meterle meses a algo que no rinde, que es lo que pasó con varias piezas de la versión 3. Después **el dibujo en otro núcleo** (etapa 1, contiene los pasos 8 y 9 viejos), **el motor** (etapa 2), **simular a 60 y dibujar a 30** con la imagen intermedia (etapa 3), **las islas decompiladas**, solo si los pilotos pasan (etapa 4, en paralelo con el motor), **las salas** (etapa 5) y **la página liviana y la prueba final** (etapa 6). El mismo día, más tarde, la **poda** (el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo») sacó 18 ítems de las etapas: quedan solo los que ganan en la gama media o baja, los que hacen falta para medirlos y los arreglos que un jugador notaría (paso 17 de la historia).',
  'Todo se comprueba en este PC: con el aparato de mentira ([[H1]]), ahora pagando la revisión de límites de Android ([[W5]]), el tramo fijo (§163) y Chrome con la emulación de teléfono; el Oppo ya no se mide (el dueño, 2026-10-31). Cada optimización se mide en la gama baja simulada y en este PC como control. Las semanas son de trabajo, no de calendario. Cada etapa termina con sus criterios medidos (las casillas de «Avance») y con lo que te toca a ti, si algo te toca.'
);

export const historiaIntro = 'Los pasos de las versiones 1–3, con su número de entonces y solo lo que quedó cerrado en ellos: lo hecho (con su fecha y dónde se documentó) y lo descartado (con el porqué). Lo que seguía abierto pasó a una etapa de la versión 4. Los pasos 8 y 9 no aparecen: no tenían nada cerrado y van enteros en la etapa 1. Los criterios de «Listo cuando» que seguían abiertos quedan descartados con la etapa que los reemplaza; los que estaban en curso siguen en curso. Al final va la poda del 2026-10-31 (el paso 17): lo que se sacó de las etapas de la versión 4 porque no rinde o no hace falta para la meta.';

export const orden = [
  // =============================== Versión 4 ===============================
  {
    n: 'E0', corto: 'Pilotos', nombre: 'Etapa 0 — Pilotos que deciden', fase: '0',
    items: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'N2', 'W7', 'W8', 'W9', 'W19', 'W20'], duracion: '2 semanas, más 2–3 días de los arreglos de KartPad', semanas: [2, 3],
    que: 'Antes de gastar meses, seis preguntas con un número que las aprueba y otro que las mata: ¿el dibujo es un sumidero y cuántas páginas ensucia la carrera ([[W1]])? ¿una isla decompilada de la lógica gana ×2 ([[W2]])? ¿un modelo dibujado en nativo baja 0,5 ms ([[W3]])? ¿PGO gana en la gama baja ([[W4]])? Y medir como son los teléfonos ([[W5]], [[N2]]) y cuánto pesa la memoria de la Wii en el nativo ([[W6]]). Con eso, los arreglos de KartPad ([[W7]]–[[W9]], [[W19]], [[W20]]).',
    listo: ['cada piloto con su número y su veredicto (pasa o se mata, según su umbral) escrito en la bitácora', 'el sumidero probado en 5–10 pistas (también de RR) y las páginas sucias por cuadro medidas', 'la escalera de los teléfonos simulados medida otra vez con la revisión de límites de Android', 'los tres arreglos de KartPad revisados: el aviso de XF contado, la memoria tras 8 pistas medida y la tarjeta en el informe'],
    dueno: 'acordar las metas por escalón de la versión 4, y decidir con los números de los pilotos si va la etapa 4',
  },
  {
    n: 'E1', corto: 'Dibujo en otro núcleo', nombre: 'Etapa 1 — El dibujo en otro núcleo', fase: '1',
    items: ['W10', 'W11', 'N3', 'P10', 'H5'], duracion: '6–9 semanas', semanas: [6, 9],
    que: 'Terminar la prueba del juego en un Worker y la puerta A (lo que quedó del paso 8 viejo, §186–§189), y sobre eso **A1-s**: el dibujo y la presentación en un segundo Worker, un cuadro atrás, con las páginas sucias transferidas en cajas, sin memoria compartida ([[W10]]); después **A2**, lo que solo se ve de la parte de calcular, con el hilo de sonido ([[W11]]). Lo del paso 9 viejo (aurora y el sonido fuera del hilo de la carrera) va adentro de esos dos; las variantes con memoria compartida y la aurora nueva se descartaron en la poda del 2026-10-31.',
    listo: ['el hilo de la carrera a ~6 ms por cuadro en este PC (hoy 11,1), en el tramo fijo, y la gama baja simulada mejor en la misma proporción', 'huellas 75/75 con un programa nuevo y uno de hoy en la misma sala, el fantasma igual cuadro por cuadro y la foto igual', 'abrir el juego no atrasa más de 50 ms el latido de otra pestaña (lo que quedó abierto del paso 4 viejo)', 'la segunda copia del juego medida en memoria, y la puerta A decidida con números'],
    dueno: 'subir a R2 el programa nuevo y decidir en la puerta A',
  },
  {
    n: 'E2', corto: 'Motor', nombre: 'Etapa 2 — El motor', fase: '2',
    items: ['H6', 'H7', 'M6', 'M7', 'H11', 'W12', 'W13', 'W14'], duracion: '8–14 semanas', semanas: [8, 14],
    que: 'Lo que cuesta el código traducido dentro de wasm, sin copiar más código en línea: la memoria de la Wii en un lugar fijo ([[H6]], primero la parte 1a: lo que el traductor ya sabe que es RAM) y, si [[W6]] lo justifica, guardada en el orden de la PC ([[H7]]); PGO con lo frío afuera ([[M6]], [[M7]], [[H11]]); la pila en variables locales ([[W12]]); el contexto en una dirección fija ([[W13]]); y el CR perezoso con el modo seguro de §193 terminado ([[W14]]).',
    listo: ['`paridad`, el volcado de la RAM, la huella ampliada y los fantasmas iguales en cada cambio', 'el código traducido ×1,3 o más rápido en la gama baja simulada (con la revisión de límites), en el tramo fijo', '`correr-todo` completo con el programa final'],
    dueno: 'subir a R2 el `.wasm` nuevo (varias veces)',
  },
  {
    n: 'E3', corto: 'Lógica 60, dibujo 30', nombre: 'Etapa 3 — Simular a 60, dibujar a 30 y mostrar 60', fase: '3',
    items: ['N8'], duracion: '2–3 semanas', semanas: [2, 3],
    que: 'La carrera sigue a 60 cuadros por segundo, igual en todos los aparatos; el Worker del dibujo dibuja 1 de cada 2 y aurora pone la imagen intermedia ([[N8]]). [[R2]] ya probó que saltar el dibujo no cambia la carrera; con el dibujo en otro núcleo, la imagen intermedia sale del hilo de la carrera.',
    listo: ['la gama media y la baja simuladas: 60 cuadros de lógica por segundo y 60 imágenes a la vista (30 dibujadas y 30 intermedias), con la huella igual', 'en la sala, uno dibujando a 30 y otro a 60: huellas 75/75'],
  },
  {
    n: 'E4', corto: 'Islas decompiladas', nombre: 'Etapa 4 — Las islas decompiladas', fase: '4',
    items: ['W15', 'W16', 'W17'], duracion: '12–22 semanas, solo si pasan los pilotos; en paralelo con el motor', semanas: [12, 22], paralelo: 'E2',
    que: 'Solo con los pilotos [[W2]] y [[W3]] aprobados. El renderizador WebGPU propio, primero el envío ([[W15]], D-a) y después el dibujo entero con los efectos ([[W16]], D-b); la colisión y la física del kart ([[W17]]). No se pisa con el motor (otros archivos), por eso puede ir al mismo tiempo. Todo lo decompilado es derivado del código de Nintendo: nunca a git ni publicado; sale solo dentro del `.wasm` privado de R2.',
    listo: ['cada isla con 0 diferencias en su comprobador, los fantasmas iguales y la sala 75/75', 'el dibujo a 3 ms o menos de CPU por imagen en este PC (hoy ~6,7), con las fotos iguales', 'la gama media simulada con el hilo de la carrera a 16,7 ms o menos'],
    dueno: 'decidir si se sigue con la IA de la CPU y los objetos',
  },
  {
    n: 'E4b', corto: 'Lo ambicioso', nombre: 'Etapa 4b — Lo ambicioso: hilos de verdad, el dibujo retenido y los saltos en línea', fase: '4b',
    items: ['W21', 'W22', 'W23', 'W24'], duracion: '8–16 semanas (estimado), junto con W10 (etapa 1) y N8 (etapa 3)', semanas: [8, 16],
    que: 'Sale del hallazgo de la etapa 4 (bitácora §222): en la gama baja el dibujo cuesta ~10 de ~20 ms por cuadro y esconder todos los modelos ahorra solo 0,6–0,7 ms, así que ~9 ms son el esqueleto fijo de cada imagen (el 2D, las copias de imagen, el posproceso y el trabajo base de aurora). Se suma a [[W10]] (etapa 1, abierta) y a [[N8]] (etapa 3, hecha; el dueño la permitió en «Automático», 2026-11-04). Techo honesto: a la gama baja le faltan ×3,2 de lógica para 60 y nada de aquí da ×3 por sí solo. La combinación realista: [[W21]] + [[W22]] + [[N8]] para que se vea a 60 dibujando a 30; [[W23]] para la lógica; y [[W24]] o el video ([[N11]]) para la sala. Todo lo de esta etapa son estimados: nada está medido todavía.',
    listo: ['el sitio local funciona entero con aislamiento y `crossOriginIsolated` es verdadero en el marco del juego ([[W21]])', 'el esqueleto medido por partes y, si se construye, el costo del dibujo por cuadro más bajo en la gama baja simulada (tramo fijo §163, con `--wasm-enforce-bounds-checks`) con la foto igual ([[W22]])', 'la prueba chica primero y después el juego, con huellas 75/75 y el fantasma igual ([[W23]])', 'cada pieza adoptada, medida en la gama baja simulada y en este PC, con las pruebas de igualdad completas'],
    dueno: 'confirmar el PR del sitio antes de W21 en Paginita-Pro (cada vez)',
  },
  {
    n: 'E4c', corto: 'Las chicas juntas', nombre: 'Etapa 4c — Las mejoras chicas, juntas', fase: '4c',
    items: ['W25'], duracion: '1–2 semanas (estimado), después de E4b; preparada, no se ejecuta hasta que el dueño lo diga', semanas: [1, 2],
    que: 'Pedido del dueño (2026-11-05): las mejoras de +1 a +6 % que se descartaron porque el ruido de ±5 % las tapaba, medidas juntas en un paquete ([[W25]]): PGO, texturas BC1 en los PC, tres funciones calientes, el memo ×4, no releer r14–r31, el CR seguro y `wasm-opt -O3`. Todas dan la misma carrera. PGO va al final, como sello, con el perfil rehecho solo en cada programa final. El detalle en `docs/evaluacion-chicas.md`.',
    listo: ['cada pieza pasada a la base de E4b con su interruptor, y el paquete con arranque 13/13, sala 75/75, fantasma y foto iguales', 'el paquete medido contra la base en la gama baja simulada (tramo fijo §163, con `--wasm-enforce-bounds-checks`) y en este PC, decidido con la regla del paquete', 'PGO encima del paquete decidido, medido con la misma regla y con el perfil rehecho solo en `--final`'],
    dueno: 'decir cuándo se ejecuta; subir a R2 el `.wasm` nuevo si se adopta',
  },
  {
    n: 'E5', corto: 'Salas', nombre: 'Etapa 5 — Las salas', fase: '5',
    items: ['N11', 'R4'], duracion: '3–6 semanas', semanas: [3, 6],
    que: 'Para la gama baja en la sala, el video desde un PC: el PC dibuja también la vista del teléfono y se la manda ([[N11]]); y lo que quedaba pendiente de la sala ([[R4]]).',
    listo: ['un teléfono de gama baja simulado ve la carrera a 60 por video desde un PC de la sala, con la demora del botón a la imagen medida', 'una traba de 1,5 s de un jugador les cuesta menos de 20 ms a los demás, con el árbitro (`prueba-relevo --trabas=8`)', 'en este PC, un Chrome normal y otro como teléfono (emulación y el lastre de gama media): 3 carreras con la huella ampliada igual'],
    dueno: 'decidir si el árbitro queda por omisión',
  },
  {
    n: 'E5b', corto: '3 conexiones', nombre: 'Etapa 5b — La sala: 3 conexiones', fase: '5b',
    items: ['R11'], duracion: '1–2 semanas (estimado); pausada por el dueño el 2026-11-05', semanas: [1, 2],
    que: 'Pedido del dueño (2026-11-05): en la sala, tres formas de conectarse, con nombres cortos y un textito al pasar el cursor ([[R11]]): «Host: un jugador» (el árbitro en una PC, por omisión), «Host + repetidor Cloudflare» (el TURN de §103, cobra por MB) y «Servidor Oracle» (un árbitro propio en la VM gratis de Oracle en Santiago; si no contesta, vuelve al host).',
    listo: ['las tres opciones en el vestíbulo con su texto', 'el servidor de mentira con huellas iguales, la vuelta al host y la traba de uno', '`prueba-sincro --directa` en cada modo'],
    dueno: 'crear la cuenta de Oracle; confirmar el PR del sitio (cada vez)',
  },
  {
    n: 'E6', corto: 'Página y final', nombre: 'Etapa 6 — La página liviana y la prueba final', fase: '6',
    items: ['P5', 'N12', 'V6', 'V7'], duracion: '1–2 semanas', semanas: [1, 2],
    que: 'Lo que quedó de los pasos 12 y 16 viejos que todavía rinde: el puente del sonido sin basura ([[P5]]), decir en la página lo que no se puede ([[N12]]), y la escalera medida otra vez contra las metas de la versión 4 con la sala de 12 y sesiones largas ([[V6]], [[V7]]). Lo demás (los mandos, el «modo juego» del sitio, el reloj del monitor, los avisos de ahorro y calor, el dominio y el tope del Worker) se descartó en la poda del 2026-10-31: con el juego en un Worker no toca el cuadro de la carrera, o no es rendimiento.',
    listo: ['casi ninguna limpieza de memoria en un minuto de carrera', 'cada escalón medido otra vez contra su meta de la versión 4', 'la sala de 12 con su meta por escalón, sin esperas de más de 50 ms, y una hora de sala con la memoria plana', '`correr-todo` en verde'],
    dueno: 'confirmar el PR (cada vez)',
  },

  {
    n: 'E7', corto: 'W10 primero', nombre: 'Etapa 7 — El plan combinado: W10 primero, gráficos al final', fase: '7',
    items: ['W29', 'W26', 'V8', 'W27', 'W28', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G16b', 'W30', 'W31', 'W32'], duracion: 'semanas a meses (estimado); después del reinicio semanal', semanas: [4, 12],
    que: 'El dueño (2026-11-07): el plan de Codex acelera la CPU (sirve en el PC flojo); corrección del 2026-11-07: el teléfono probado frenaba por la CPU, no por la tarjeta (§173: ≈3 ms de tarjeta), así que lo que rinde es W10; los gráficos opcionales quedan en prioridad baja, solo para un aparato que de verdad frene por la tarjeta (por omisión todo prendido, siempre 12 karts). Orden: el piloto chico de la memoria de tamaño fijo ([[W29]], 1–2 días) → [[W10]] parte B (el freno real, la CPU) y la memoria ([[W26]]) → repartir los ~10 ms del lado CPU del dibujo ([[V8]]) → condicionadas [[W27]] (si el dibujante pasa a ser el cuello) y [[W28]] → al final, en prioridad baja, los gráficos opcionales ([[G11]]–[[G13]], [[G14]] condicionado).',
    listo: ['[[W10]] medido en la gama baja y en este PC', 'una hora de sala con la memoria plana', 'el lado CPU del dibujo repartido por partes'],
    dueno: 'confirmar el PR (cada vez); subir a R2 el `.wasm` nuevo de W10',
  },

  // ======================= Lo ya hecho (versiones 1–3) =======================
  {
    n: 1, corto: 'Medir', nombre: 'Medir: los cuadros de lógica y la tarjeta por pasada', fase: 'v1–3', historia: true,
    items: ['V5', 'V4', 'G8', 'V1'], duracion: '1 semana', semanas: [1, 1],
    que: 'Saber de verdad qué frena (la CPU o la tarjeta, y qué pasada) antes de tocar nada.',
    listo: ['el informe separa juego, espera y tarjeta, y da el tiempo de cada pasada (en este PC y con el aparato de mentira)', 'se sabe cuántos cuadros de lógica corre un jugador por segundo'],
  },
  {
    n: 2, corto: 'Aparato de mentira', nombre: 'El aparato de mentira y el presupuesto por pieza', fase: 'v1–3', historia: true,
    items: ['H1', 'H2'], duracion: '1 semana', semanas: [1, 1],
    que: 'Poder medir la gama media y la baja con este PC.',
    listo: ['con K = 1, 2 y 4 el cuadro crece 1, 2 y 4 veces', 'el informe muestra cada pieza contra su meta'],
  },
  {
    n: 3, corto: 'Impuesto y metas', nombre: 'El impuesto del navegador, la línea base y las metas', fase: 'v1–3', historia: true,
    items: ['N1', 'N13', 'V2', 'V3', 'R5', 'R6', 'U3', 'E4', 'E5'], duracion: '1 semana', semanas: [1, 1],
    que: 'La foto de partida de los seis escalones, y cuánto cuesta el navegador. ([[N2]], la escalera, pasó a la etapa 0.)',
    listo: ['línea base guardada: este PC medido y los demás escalones simulados (el Oppo, del 2026-10-30, queda como referencia)', 'el impuesto del navegador medido (nativo contra wasm, en el mismo PC)', '`paridad` y `fma` dan lo mismo en Chrome del PC (también forzado a cada compilador) que en Node'],
    dueno: 'acordar la meta de cada escalón',
  },
  {
    n: 4, corto: 'Que nada se trabe', nombre: 'Que nada se trabe al cargar', fase: 'v1–3', historia: true,
    items: ['C1', 'C4', 'C6', 'C7', 'C8', 'C10', 'D2', 'D6', 'D13', 'U1'], duracion: '2–4 días', semanas: [0.4, 0.8],
    que: 'Lo urgente y barato, casi todo en la página: el PC y Chrome dejan de congelarse al cargar.',
    listo: ['abrir el juego no atrasa más de 50 ms el latido de otra pestaña', 'cero descargas de fondo y cero tareas largas durante la carrera'],
    dueno: 'confirmar el PR del sitio',
  },
  {
    n: 5, corto: 'Nada se baja', nombre: 'Nada se baja durante la carrera', fase: 'v1–3', historia: true,
    items: ['D1', 'D3', 'D4', 'D5', 'D8', 'D9', 'D12', 'U2', 'C2', 'C3', 'C5'], duracion: '1–2 semanas', semanas: [1, 2],
    que: 'El paquete de carrera bajado antes de la cuenta, y una versión por archivo. ([[D7]] y [[D14]], el dominio propio y el tope diario del Worker, pasaron a la etapa 6.)',
    listo: ['cero lecturas a la red de la cuenta a la meta, con perfil nuevo, en la sala y en un jugador', 'subir un archivo a R2 no vacía la caché de los demás'],
    dueno: 'subir a R2, volver a pegar el Worker y poner el dominio propio',
  },
  {
    n: 6, corto: 'Motor: traductor y memoria', nombre: 'El motor: el código traducido y la memoria de la Wii', fase: 'v1–3', historia: true,
    items: ['M8', 'M1', 'M2', 'N15'], duracion: '6–9 semanas', semanas: [6, 9],
    que: 'Lo que más cuesta en wasm en la carrera: el código que genera el traductor (~70 % del impuesto) y la memoria de la Wii (~17 %). ([[N15]], la subida a la v0.9.3, quedó hecha con nuestra aurora y es la base del motor; la aurora nueva, N15b, se descartó en la poda; [[H6]], [[H7]], [[M6]], [[M7]] y [[H11]], a la etapa 2.)',
    listo: ['`paridad` 22/0, la huella ampliada y los fantasmas iguales', 'la carrera de [[N13]] (tramo 600–2400) con el wasm más cerca del nativo, medido: hoy ×3,1'],
  },
  {
    n: 7, corto: 'IA en lo caliente', nombre: 'Lo caliente reescrito con IA, y no volver a subir lo que no cambia', fase: 'v1–3', historia: true,
    items: ['N14', 'G3', 'H12'], duracion: '3–5 semanas', semanas: [3, 5],
    que: 'La IA reescribió las funciones calientes con un comprobador (0 diferencias, pero sin ganancia: el impuesto está repartido), y la pista quieta dejó de subirse a la tarjeta en cada imagen.',
    listo: ['el comprobador con 0 diferencias en cada función aceptada, y la CPU por cuadro del tramo fijo más baja en la gama baja simulada y en este PC', 'los KB subidos por imagen en la carrera bajan a una fracción de hoy (medido en este PC con el informe de rendimiento)'],
  },
  {
    n: 10, corto: 'Tarjeta del teléfono (1)', nombre: 'La tarjeta del teléfono, primera tanda', fase: 'v1–3', historia: true,
    items: ['N9', 'G5', 'G2', 'G7', 'G10', 'H13'], duracion: '4–6 semanas', semanas: [4, 6],
    que: 'Se creía que el Oppo se veía a 30 por la tarjeta (§115); el informe del 2026-10-30 dio la tarjeta en ~3 ms y en este PC la tarjeta, con sus marcas en el tramo fijo, no frena en ningún escalón (§164). La versión 4 lo cerró: lo que queda del dibujo va por el renderizador propio ([[W15]], [[W16]]).',
    listo: ['la tarjeta a 4 ms o menos por imagen con el aparato de gama media en el tramo fijo (`&perfilGpu=1`, §164; la meta final, en el paso 15, es 12 ms o menos con `?lastreGpu=6`)', 'el aparato de gama media (`&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6`) a 60 en un jugador'],
  },
  {
    n: 11, corto: 'Sala asíncrona', nombre: 'La sala asíncrona', fase: 'v1–3', historia: true,
    items: ['R3', 'R2', 'G1', 'R1', 'R7', 'R9'], duracion: '2–3 semanas', semanas: [2, 3],
    que: 'Que el fps de uno no frene a los demás.',
    listo: ['una traba de 1,5 s de uno les cuesta menos de 20 ms a los demás', 'en este PC, un Chrome normal y otro como teléfono (emulación, CPU frenada y el lastre de gama media): 3 carreras con la huella ampliada igual'],
    dueno: 'decidir si el árbitro queda por omisión',
  },
  {
    n: 12, corto: 'Página liviana', nombre: 'La página liviana', fase: 'v1–3', historia: true,
    items: ['P3', 'P4', 'P6', 'P7', 'P8', 'R8', 'R10', 'E3', 'E6', 'C9'], duracion: '1 semana', semanas: [1, 1],
    que: 'La página y el sitio fuera del cuadro del juego. ([[P1]], [[P2]] y [[U4]] pasaron a la etapa 6; [[R4]], a la 5.)',
    listo: ['casi ninguna limpieza de memoria en un minuto de carrera', '`correr-todo` en verde'],
    dueno: 'aprobar el aspecto sin desenfoques y confirmar el PR',
  },
  {
    n: 13, corto: 'Motor: cuentas', nombre: 'El motor: las cuentas', fase: 'v1–3', historia: true,
    items: ['M3', 'M5', 'H8', 'H9', 'M4', 'M10'], duracion: '3–4 semanas', semanas: [3, 4],
    que: 'El despacho, la multiplicación-suma, las cuentas de a dos y las esperas de más. La versión 4 lo descartó entero: pesan poco o agrandan el código (`docs/techo-pasos.md` §5). ([[P5]] pasó a la etapa 6 y [[D10]] a la 1.)',
    listo: ['el banco `fma` con 40 millones de casos, en Node y en Chrome del PC (también forzado a cada compilador)', 'la huella y los fantasmas iguales'],
  },
  {
    n: 14, corto: 'Motor: lo visual', nombre: 'El motor: lo visual en paralelo', fase: 'v1–3', historia: true,
    items: ['N5', 'N6', 'H10', 'N7'], duracion: '3–4 semanas', semanas: [3, 4],
    que: 'Partículas, animación y 2D a los ayudantes. La versión 4 lo reemplazó por el dibujo en otro núcleo ([[W10]], [[W11]]) y las islas ([[W16]]–[[W18]]). ([[M11]] pasó a la etapa 2.)',
    listo: ['el hilo del juego a 3,3 ms o menos, medido como CPU pura en el tramo fijo', 'y a 12 ms o menos con `?lastre=3.5`'],
  },
  {
    n: 15, corto: 'Gráficos (2)', nombre: 'Gráficos, segunda tanda: texturas, interpolación y calor', fase: 'v1–3', historia: true,
    items: ['G6', 'G4'], duracion: '2–4 semanas, en paralelo con el motor', semanas: [2, 4],
    que: 'Las texturas comprimidas quedaron como opción y el ubershader se descartó. ([[N8]] pasó a la etapa 3; [[E1]] y [[E2]], a la 6.)',
    listo: ['la tarjeta a 2 ms o menos por imagen en el tramo fijo, y a 12 ms o menos con `?lastreGpu=6`', 'el que dibuja a 30 ve 60 con la interpolación'],
  },
  {
    n: 16, corto: 'Puerta B y final', nombre: 'La puerta B y la prueba final', fase: 'v1–3', historia: true,
    items: ['N10'], duracion: '2–4 semanas', semanas: [2, 4],
    que: 'La app nativa quedó descartada (el producto es siempre la página). ([[N11]] pasó a la etapa 5; [[N12]], [[V6]] y [[V7]], a la 6.)',
    listo: ['cada escalón con su meta cumplida o su plan C decidido', 'la sala de 12 a 60 fps, sin esperas de más de 50 ms', 'una hora de sala con la memoria plana'],
    dueno: 'decidir en la puerta B',
  },
  {
    n: 17, corto: 'Poda', nombre: 'La poda del 2026-10-31: lo que no rinde o no hace falta', fase: 'v4', historia: true,
    items: ['H3', 'H4', 'N4', 'G9', 'P9', 'N15b', 'M9', 'D11', 'D10', 'M11', 'W18', 'P1', 'P2', 'U4', 'E1', 'E2', 'D7', 'D14'], duracion: 'una revisión, sin trabajo', semanas: [0, 0],
    que: 'El dueño (2026-10-31 23:10): «descarta todo lo que no rinda y no sea necesario para nuestro objetivo». Se revisó cada ítem abierto contra las metas por escalón (PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados; gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC) y se quedó solo con lo que gana ~2 % o más del hilo del juego en la gama media o baja, lo que otro ítem necesita para medirse, y los arreglos que un jugador sí notaría. Salieron los hilos con memoria compartida y la CPU con la tarjeta en paralelo (la tarjeta no frena, y [[W10]] ya lleva el dibujo a otro núcleo), lo de la página que con el juego en un Worker ya no toca el cuadro de la carrera, los avisos que no ganan cuadros, la aurora nueva y la infraestructura del Worker, que no es rendimiento. Cada uno con su porqué en «Avance».',
    listo: ['cada ítem descartado con su porqué y el documento que lo decide'],
  },
];

export const avanceIntro = 'Las casillas las marco yo a medida que avanzo: cada ítem terminado lleva la fecha y la hora y dónde quedó documentado (la bitácora o el commit), y cada etapa, sus criterios de «Listo cuando» medidos. «En curso» es lo que estoy haciendo y «descartado», lo que se decidió no hacer (con el porqué y el documento que lo decidió). Primero van las etapas de la versión 4; debajo, los pasos viejos, como historia. Lo mismo queda en `PLAN.md`, como siempre.';
