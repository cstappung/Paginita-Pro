// Datos del plan de rendimiento (un solo lugar para el .md y el artifact). Ver generar.mjs.
// Cadenas con comillas simples: dentro se usan `código`, **negrita** y [[ID]] para citar un ítem.
import { V, C, D, U } from './areas-a.mjs';
import { R, G, M, P as PAG, E } from './areas-b.mjs';
import { N } from './areas-n.mjs';
import { H } from './areas-h.mjs';
import { W } from './areas-w.mjs';
export { orden, ordenIntro, historiaIntro, avanceIntro } from './orden.mjs';
export { avance } from './avance.mjs';

const P = (...x) => x.join('\n\n');                 // párrafos
const L = (...x) => x.map(s => '- ' + s).join('\n'); // lista

export const areas = [W, V, C, D, U, R, G, M, PAG, E, N, H];
const total = areas.reduce((n, a) => n + a.items.length, 0);

export const meta = {
  titulo: 'JloKart Wii a 60 fps: plan de rendimiento',
  subtitulo: 'Todo lo que frena al juego (un jugador y sala, PC y celular): la causa, el arreglo y cómo se comprueba, hasta dónde llega cada aparato y el paso a paso para llegar a 60 fps con 12 karts.',
  fecha: '2026-10-27 · versión 4: 2026-10-31',
  estado: 'versión 4 (pilotos, el dibujo en otro núcleo, el motor y las islas), nada empezado',
  pagina: 'https://claude.ai/artifact/Ra7WusxMirhWmobs7aNWSo',
  paraClaude: P(
    'Este es el plan de rendimiento que pidió el dueño el 2026-10-27. **Nada de esto está hecho**: el dueño pidió no empezar todavía y hacerlo otro día, cerca del reinicio del límite semanal. Sale de seis investigaciones de solo lectura (no se corrió el juego) y de las mediciones guardadas en `build/web/datos/` y en la bitácora.',
    '**Versión 2 (el mismo día).** El dueño preguntó si con la lista se llegaba a todos los objetivos. La respuesta honesta fue no: lo medido es de los aparatos más rápidos (Ryzen 7 9800X3D y Oppo Find X9 Pro), el juego usa un solo núcleo y los demás aparatos son 2–9 veces más lentos. Se agregaron la sección «¿Alcanza?», el área N (12 ítems), una fase nueva (la arquitectura, con la puerta A) y la puerta B con los planes C.',
    '**Versión 3 (el mismo día).** El dueño pidió más ambición: que la gama media también llegue a 60, atacando la CPU, la tarjeta y el «un solo núcleo»; y avisó que solo se prueba con este PC (varios Chrome) y el Oppo. Se agregaron el área H (13 ítems: el aparato de mentira, el presupuesto por pieza, la CPU y la tarjeta en paralelo, el mapa de hilos, la memoria de la Wii fija y ya dada vuelta, la multiplicación-suma del aparato, la tarjeta del Oppo a 2 ms), la tabla de presupuesto y el diagrama de hilos; se ajustaron N2, V7, M11, las reglas y las fases 0, 3, 6, 7 y 8.',
    '**Versión 4 (2026-10-31).** Del 27 al 31 se hicieron 58 ítems y los resultados del motor fueron chicos: el dueño los juzgó «bien tristes». La estimación del techo (`docs/techo-pasos.md`) dio que todo lo que quedaba del plan, siendo realista, bajaba el hilo del juego solo **×1,5** (×2,5 en el mejor caso, contra una meta de ×3,4): llegaban a 60 este PC, el PC típico y probablemente el teléfono tope, pero no la gama media ni la baja. El dueño pidió soluciones más grandes («piensa más grande»: ¿una decompilación en vez de la traducción?) y revisar KartPad, que corre el mismo traductor nativo en teléfonos de verdad. Salieron cuatro documentos (`docs/soluciones-motor.md`, `soluciones-arquitectura.md`, `soluciones-decompilacion.md` y `kartpad.md`), y con ellos el dueño aprobó rehacer el plan («rehace el plan entonces»). La versión 4: dos semanas de **pilotos con umbral de éxito y de corte** (etapa 0); **el dibujo en otro núcleo**, porque la carrera nunca lee lo que el dibujo escribe (etapa 1); **el motor** donde de verdad cuesta (etapa 2); **simular a 60 y dibujar a 30** con la imagen intermedia (etapa 3); **islas decompiladas** solo si los pilotos pasan (etapa 4); las salas (etapa 5) y la página y la prueba final (etapa 6). Se agregó el área W (18 ítems) y se descartaron 15 ítems viejos (los arreglos de a una función, las variantes de la multiplicación-suma, las pasadas que agrandan el código, el paso 10 de la tarjeta). **La meta por escalón (estimada):** PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados, al borde; teléfono de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC (N11). KartPad mostró que ni nativo un teléfono de gama media llega a 60 (Dimensity 7300 ~29 ms, Helio G85 ~45 ms con 12 karts) y que PGO le dio −12 %.',
    '**La poda (2026-10-31 23:10).** El dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo». Cada ítem abierto se quedó solo si gana ~2 % o más del hilo del juego en la gama media o baja, si otro ítem que se queda lo necesita para medirse, o si arregla algo que un jugador notaría. Salieron 18 (paso 17 de la historia): los hilos con memoria compartida y la CPU con la tarjeta en paralelo (H3, H4, N4, G9, P9: los contiene W10 o no ganan porque la tarjeta no frena), la aurora nueva (N15b), lo que ya cubre otro ítem (M9, W18, M11), lo que con el juego en un Worker o sin pedidos en la carrera no toca el cuadro (P1, P2, D10, D11), y lo que no es rendimiento (U4, E1, E2, D7, D14). N15 quedó hecho (N15a era la parte que se usa). Lo ya escrito de E1, E2 y P9 sigue en el código, apagado detrás de su bandera.',
    'Al retomarlo: (1) leer «¿Alcanza?», la «Respuesta corta» y el «Orden de trabajo»; (2) empezar por la etapa 0 (los pilotos que deciden); (3) cada ítem trae «Dónde» con archivo:línea de cuando se escribió, que puede haberse movido: verificar antes de tocar; (4) documentar cada paso en `docs/bitacora.md` (glosario incluido) y marcar el avance en `PLAN.md` con fecha y hora, como siempre; (5) las reglas de CLAUDE.md siguen valiendo, en especial: nunca menos karts ni efectos, el producto es siempre la página, nada del juego a git (tampoco lo decompilado), los fantasmas iguales bit a bit, R2/Worker/Firebase los publica el dueño, y PR solo con su confirmación de cada vez.',
    'El orden de trabajo (las 7 etapas de la versión 4, con lo que tarda cada una, y debajo los pasos viejos como historia) y las casillas de «Avance» van al final. Al terminar cada ítem o criterio: marcarlo en `herramientas/plan-rendimiento/avance.mjs` (estado, fecha y hora, dónde se documentó), regenerar y volver a publicar la página; además `PLAN.md` y la bitácora, como siempre.',
    'El .md y la página salen del generador en `herramientas/plan-rendimiento/` (`node herramientas/plan-rendimiento/generar.mjs docs/plan-rendimiento.md <salida.html>`): si el plan cambia, editar los datos de esa carpeta, regenerar y volver a publicar el artifact.'
  ),
};

export const pedido = [
  '«Optimizar al máximo el performance de este juego para que la experiencia multiplayer sea perfecta y fluida en 60 fps incluso entre PC y móviles.»',
  '«1) La factibilidad de hacerlo asíncrono el multiplayer, de tal manera que los fps de un jugador no afecten a otro.»',
  '«2) La optimización máxima en PC y móviles para que corra a 60 fps el multiplayer con 12 jugadores y/o CPU… quizás necesites decompilar más el juego… y tengamos que subir el R2 otra vez.»',
  '«3) Que antes de iniciar la carrera todo lo que va a necesitar esté ya descargado: hoy se descargan cosas mientras va la carrera y laguea.»',
  '«4) Al cargar por primera vez el juego se laguean todos los navegadores, o al descargar algo también, y se congelan los PCs de todos.»',
  '«Piensa en más cosas que pasan y pueden pasar: ármame una lista extensiva de cosas que arreglar.»',
  '«No solo el multiplayer va mal, el singleplayer también.»',
  '«Agrega las posibles causas solo mirando código, sin correr nada, y cómo mejorarlas.»',
  '«Si es necesario reescribir o usar otras cosas, considéralo: también el engine, WebAssembly, Emscripten, aurora… cuestiona todo, también Firebase, Cloudflare, WebRTC.»',
  '«No empieces a realizar los cambios todavía»: se hacen otro día, cerca del reinicio del límite semanal.',
  '«Sinceramente, con estos cambios, ¿crees que se llegará a todos los objetivos? Si no, hay que reformular de manera más profunda.» (versión 2)',
  '«Quizás ser más ambicioso para que la gama media también… normalmente hay cuellos de botella en GPU y CPU; dices que corre en un solo núcleo, ¿se podría mejorar? Hay que hacer más ambicioso el plan para asegurar.» (versión 3)',
  '«Recuerda que no podemos probar con múltiples dispositivos: lo máximo es muchos Chrome abiertos, o Chromes + un celular.»',
  'Los resultados de la versión 3, «bien tristes»; «piensa más grande… ¿podría una decompilación, no una recompilación estática, arreglar todos nuestros problemas?»; «revisa también kartpad»; y, con los documentos del 2026-10-31 en la mano, «rehace el plan entonces». (versión 4)',
];

export const respuesta = [
  {
    pregunta: '1. ¿Se puede hacer el multijugador asíncrono, que el fps de uno no afecte a otro?',
    veredicto: 'Sí, en lo que importa: con un árbitro y la simulación separada del dibujo',
    tono: 'si',
    texto: P(
      'Asíncrono del todo (cada uno a su ritmo y la misma carrera en todas las pantallas) no existe sin rollback, y el rollback aquí es imposible (el estado son 88 MB o más y los hilos del juego no se pueden guardar). Pero se logra que **el lento no frene a nadie** con dos piezas: **el árbitro** (la PC más estable fija en cada cuadro los botones de todos y nadie espera a nadie más que a ella) y **simular a 60 aunque se dibuje menos** (el teléfono que dibuja a 30 sigue simulando a 60).',
      'Lo único que ningún modelo arregla es un aparato que no puede simular 60 cuadros por segundo ni sin dibujar: con el árbitro eso lo paga solo él (queda fuera de esa carrera). Riesgo conocido: RR ya se salta dibujos cuando va atrasado, y en la sala eso separaba la carrera (§85.4); el dibujo le deja algo a la lógica que hay que encontrar ([[R2]]). El en línea de la Wii (RKNet) costaría 6–12 semanas, no tiene CPU y cada pantalla vería una carrera algo distinta. Fase 4: [[R1]], [[R2]], [[G1]].'
    ),
  },
  {
    pregunta: '2. ¿60 fps con 12 karts en PC y celular?',
    veredicto: 'Con la versión 4 (estimado): PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados, al borde; teléfono de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC. Antes de meterle meses, dos semanas de pilotos lo confirman o lo matan',
    tono: 'parcial',
    texto: P(
      'Con todo lo que quedaba de la versión 3, siendo realista, el hilo del juego bajaba solo ×1,5 (`docs/techo-pasos.md`): no alcanzaba para la gama media ni la baja. Y KartPad, que corre el mismo traductor **nativo** en teléfonos de verdad, lo confirma: con 12 karts, un Dimensity 7300 (gama media) tarda ~29 ms por cuadro y un Helio G85 (gama baja) ~45 ms, sin navegador (`docs/kartpad.md`).',
      'La versión 4 cambia la forma: **el dibujo entero a otro núcleo**, un cuadro atrás, porque la carrera nunca lee lo que el dibujo escribe ([[W10]], [[W11]]); **el motor** donde de verdad cuesta (la memoria de la Wii, la pila, el contexto, las banderas, PGO: [[H6]], [[W12]]–[[W14]], [[M6]]); **simular a 60 y dibujar a 30** con la imagen intermedia ([[N8]]); e **islas decompiladas** (el dibujo en nativo, la colisión y la física del kart: [[W15]]–[[W17]]), solo si los pilotos de la etapa 0 pasan sus umbrales ([[W1]]–[[W4]]). Siempre 12 karts y todos los efectos, siempre en la página. Detalle en «¿Alcanza?».'
    ),
  },
  {
    pregunta: '3. ¿Todo descargado antes de la carrera?',
    veredicto: 'Sí: un paquete de carrera, bajado antes de la cuenta',
    tono: 'si',
    texto: P(
      'Hoy se baja durante la carga y también en plena carrera (la última vuelta, la meta). La sala ya sabe la pista y los 12 puestos antes de largar, así que se puede armar un paquete (pista, música, karts, voces, fanfarrias), bajarlo durante los 45 s de elección o en el descanso y dejarlo fijo en memoria hasta la meta ([[D1]]); en un jugador, en el gancho que ya existe al armar la carrera.',
      'Hay que grabar `carreras.json` y subirlo a R2, con una versión por archivo ([[D5]]) para que cada subida no borre la caché de todos. Y mientras se corre, cero descargas de fondo ([[D2]]). Lo único que no se arregla: con una conexión lenta, la carrera espera al que baja (o larga sin él).'
    ),
  },
  {
    pregunta: '4. ¿Por qué se traban todos los navegadores y el PC al cargar?',
    veredicto: 'Por el proceso de GPU de Chrome, inundado de pipelines, más descargas sin freno',
    tono: 'si',
    texto: P(
      'Chrome tiene **un solo proceso de GPU** para todas las pestañas y ventanas. El precalentado le pide 730–930 pipelines en 1–2 s, sin tope, y Dawn los compila usando todos los núcleos: en un PC de 4 núcleos serían 30 s o más al 100 %, y mientras tanto ese proceso también tiene que componer las demás pestañas. Encima se bajan unos 205 MB en el primer minuto (hasta 90 Mbit/s) y V8 compila 108 MB de código.',
      'El arreglo más barato ya existe en C++ y es solo de la página: el precalentado con tope, por omisión ([[C1]]), más un freno a las descargas ([[C4]]). Fase 1, sin recompilar ni subir nada.',
      'En la sala, «se congelan los PCs de todos» también es el lockstep: la traba de uno frena a todos, y eso lo arregla el árbitro ([[R1]]). Con el juego en su propio proceso y fuera del hilo de la página ([[N3]]), la página deja de congelarse del todo. Lo que queda: la 1.ª visita siempre baja ~100 MB y compila 108 MB; un PC débil trabaja un minuto, aunque sin congelarse.'
    ),
  },
  {
    pregunta: '5. ¿Y un jugador?',
    veredicto: 'Va mal por lo mismo, menos la red, y vale la misma escalera de aparatos',
    tono: 'parcial',
    texto: 'Un jugador comparte la carga, las descargas, el motor, los gráficos y la página. Lo propio: el precalentado se mete en la 1.ª carrera ([[U1]]), los karts de las CPU se piden de a uno ([[D4]]) y «30 fps» puede ser la lógica a 60 dibujando la mitad: falta contar los cuadros de lógica ([[V5]]). Contrarreloj sirve para separar causas ([[U3]]). Las 11 CPU se simulan en el aparato igual que en la sala, así que vale la misma escalera: con todo el plan, también la gama media si se cumplen las dos metas del presupuesto ([[H2]]). La interpolación ([[N8]]) sirve en un jugador desde ya.',
  },
  {
    pregunta: '6. ¿Hay que reescribir algo o cambiar de herramientas?',
    veredicto: 'Sí, más que antes: el dibujo pasa a otro Worker, la memoria de la Wii cambia de forma y, si los pilotos lo aprueban, partes calientes del juego se decompilan por islas. La base (WiiCompiled), WebGPU y la malla se quedan',
    tono: 'parcial',
    texto: P(
      'Se queda la base: WiiCompiled traduce el juego entero, y solo un binario traducido respeta los parches de RR por dirección (decompilar el juego entero serían 18–30 meses y el 94 % de las funciones casi no corre en la carrera: `docs/soluciones-decompilacion.md`). Cambia la arquitectura: el juego en un Worker ([[N3]]) y **el dibujo en un segundo Worker**, con las páginas sucias transferidas en cajas ([[W10]]); la memoria de la Wii en un lugar fijo y en el orden de la PC ([[H6]], [[H7]]); la pila y el contexto sin pasar por la memoria ([[W12]], [[W13]]).',
      'Lo que se reescribe: **islas** enteras, no funciones sueltas (de a una ya se probó y no gana, [[N14]]): el renderizador WebGPU propio con los efectos ([[W15]], [[W16]]), la colisión y la física del kart ([[W17]]). Es código derivado del de Nintendo: nunca a git, servido privado desde R2 como el traducido. De la infraestructura: el Worker de Cloudflare y Firebase se quedan como están; la app nativa quedó descartada ([[N10]]): el producto es siempre la página. Detalle en «Cuestionar todo».'
    ),
  },
];

export const alcanza = {
  veredicto: 'Con la versión 4 (todo estimado): el PC típico y el portátil, 60 dibujados; el teléfono de gama media, 60 dibujados, al borde; el de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC. Ninguna de esas cifras está medida: por eso la versión 4 empieza con dos semanas de pilotos que las confirman o las bajan',
  tono: 'parcial',
  texto: P(
    '**Por qué hubo que rehacerlo.** La versión 3 ponía la meta de la gama media en el hilo del juego a un cuarto de hoy (3,3 ms en este PC). Del 27 al 31 de octubre se hicieron 58 ítems y lo que tocaba el motor dio poco (la IA en lo caliente ×1,00, la FMA «punto medio» −7,5 % en la gama baja, las hojas en línea −6 %, M1/M2 +5,2 %). Sumando lo que quedaba, siendo realista, el hilo bajaba **×1,5** (`docs/techo-pasos.md`): llegaban este PC, el PC típico y probablemente el teléfono tope; la gama media y la baja, no.',
    '**Qué cambia: la forma, no solo el motor.** (1) **El dibujo en otro núcleo**: la carrera nunca lee lo que el dibujo escribe ([[R2]] lo probó), así que todo el dibujo, también el código del juego que recorre la escena, puede ir a un segundo Worker un cuadro atrás ([[W10]]). Es pasar de resistencias en serie (se suman) a ramas en paralelo (manda la más cargada): el hilo de la carrera baja de 11,1 a ~6 ms en este PC. (2) **El motor donde de verdad cuesta**, sin copiar más código en línea: la memoria de la Wii fija y en el orden de la PC, la pila y el contexto, las banderas, PGO ([[H6]], [[H7]], [[W12]]–[[W14]], [[M6]]). (3) **Simular a 60 y dibujar a 30** con la imagen intermedia, donde no alcance ([[N8]]). (4) **Islas decompiladas** (el dibujo en nativo, la colisión y la física del kart), solo si los pilotos de la etapa 0 pasan ([[W2]], [[W3]]).',
    '**La regla de oro sigue:** la carrera no se reparte entre núcleos (la Wii tenía un solo procesador y la sala y los fantasmas exigen los mismos bits); siempre 12 karts y todos los efectos; siempre en la página. **La medida también se corrige:** Chrome en Android revisa los límites de la memoria en cada acceso y este PC no; desde ahora la gama media y la baja simuladas lo pagan ([[W5]], +16 % medido en §160). Y KartPad (el mismo traductor, nativo en teléfonos reales) confirmó que la escalera simulada estaba bien calibrada, si acaso algo pesimista.'
  ),
  columnas: {
    lista: 'Con lo que quedaba de la versión 3 (realista, ×1,5)',
    profundo: 'Con la versión 4 (estimado)',
    nucleo: 'S: veces más lento que este PC',
    hoy: 'Hoy, un jugador (ms)',
    escLista: 'Con lo que quedaba de la v3 (realista)',
    escFondo: 'Con la versión 4: carrera / dibujo (estimado)',
    caption: 'Milisegundos por cuadro: el hilo del juego hoy (un jugador, 12 karts, dibujando todo) y, con la versión 4, el hilo de la carrera y el del dibujo, cada uno en su núcleo',
    pHoy: 'Hoy en este PC (medido, §160 y §166.5)',
    pMeta: 'Meta de la versión 4 en este PC (tramo fijo)',
    pMedia: 'En la gama media simulada (S ≈ 5,4, con la revisión de límites)',
    pCaption: 'Cada pieza con su meta de la versión 4, medida en este PC en el tramo fijo y con el aparato de mentira de la gama media (todo estimado hasta medirlo)',
  },
  objetivos: [
    { objetivo: '1. Que el fps de uno no frene a otro', lista: 'Sí: el árbitro y saltarse el dibujo sin cambiar la carrera ya están hechos y probados ([[R1]], [[R2]]).', profundo: 'Igual, con la imagen intermedia para el que dibuja 30 ([[N8]]) y el video desde un PC para el teléfono que no simula 60 ([[N11]]).', limite: 'El aparato que no simula 60 cuadros por segundo queda fuera de la carrera: no frena a nadie, pero no corre (salvo por video).', tono: 'si' },
    { objetivo: '2. 60 fps con 12 karts, en PC y celular', lista: 'Este PC, el PC típico (justo) y probablemente el teléfono tope. El portátil, la gama media y la baja, no (`docs/techo-pasos.md` §3).', profundo: 'PC típico y portátil: 60 dibujados. Teléfono de gama media: 60 dibujados, al borde (si no entra, 60 de carrera con 30 dibujados y la imagen intermedia). Gama baja: 60 de carrera con 30 dibujados y la imagen intermedia; en la sala, el video desde un PC ([[W10]], [[W17]], [[N8]], [[N11]]).', limite: 'La gama baja con 60 dibujados no la alcanza nada que corra en la página: ni siquiera KartPad, nativo, pasa de 20–29 fps en un Helio G85. El aviso ([[N12]]) para lo que aun así no llegue.', tono: 'parcial' },
    { objetivo: '3. Todo bajado antes de la carrera', lista: 'Hecho: el paquete de carrera, sin descargas de fondo y con una versión por archivo ([[D1]], [[D2]], [[D5]]).', profundo: 'Igual.', limite: 'Con una conexión lenta, la carrera espera al que baja (o larga sin él).', tono: 'si' },
    { objetivo: '4. Nada se congela al cargar', lista: 'Casi: tope al precalentado y freno a las descargas ([[C1]], [[C4]]); queda una traba de ~300 ms al largar en un PC de 4 núcleos (V8 optimizando).', profundo: 'Sí: el juego en su propio Worker y fuera del hilo de la página ([[N3]]), y el código caliente más chico con PGO ([[W4]], [[H11]]).', limite: 'La 1.ª visita baja ~100 MB y compila 108 MB de código: un PC débil trabaja un minuto, aunque sin congelarse.', tono: 'parcial' },
    { objetivo: 'Un jugador', lista: 'Igual que el punto 2, sin la red.', profundo: 'Igual que el punto 2, sin el video (que es solo de la sala): la gama baja juega con 30 dibujados y la imagen intermedia.', limite: 'Igual que el punto 2.', tono: 'parcial' },
  ],
  escaleraIntro: 'Cuánto tarda el hilo del juego por cuadro en cada escalón: hoy, con lo que quedaba de la versión 3 (realista, `docs/techo-pasos.md` §3) y con la versión 4. S es cuántas veces más lento es todo el hilo que en este PC, sacado de la escalera calibrada en el tramo fijo (§163–§164); en la versión 4, los teléfonos además pagan la revisión de límites de Android ([[W5]], +16 %). Solo la fila de este PC está medida; el Oppo, como referencia del 2026-10-30, ya no se mide. Con la versión 4 hay dos números: **el hilo de la carrera** (decide si se simulan 60 cuadros por segundo) y **el del dibujo** (decide cuántas imágenes), cada uno en su núcleo. Todo lo de la versión 4 es **estimado** (de `docs/soluciones-arquitectura.md` §7 y `docs/soluciones-decompilacion.md` §1.5, con la etapa 4 incluida) y lo confirman o lo bajan los pilotos de la etapa 0. KartPad, nativo en teléfonos reales, cae en el mismo lugar que la escalera simulada o un poco mejor (`docs/kartpad.md` §2).',
  escalera: [
    { aparato: 'PC para juegos reciente', ejemplos: 'Ryzen 7000–9000, Intel 13.ª–14.ª; el PC del proyecto (9800X3D)', nucleo: '1', hoy: '10,8–11,4 (medido, §166.5)', lista: '~7,5', fondo: '3–4 / 2–3', veredicto: 'Sí (ya hoy)', tono: 'si', b: { hoy: [10.8, 11.4], fondo: [3, 4], medido: true } },
    { aparato: 'PC típico (2018–2021)', ejemplos: 'Ryzen 5 3600, Core i5-10400', nucleo: '~2', hoy: '~22', lista: '~15', fondo: '6–8 / 4–6', veredicto: 'Sí: 60 dibujados (estimado)', tono: 'si', b: { hoy: [22, 22], fondo: [6, 8] } },
    { aparato: 'Portátil de oficina', ejemplos: 'Core i5 de bajo consumo, 8.ª–11.ª generación', nucleo: '~4,4', hoy: '~45–50', lista: '~33', fondo: '13–17 / 9–13', veredicto: 'Sí: 60 dibujados (estimado; con la etapa 4)', tono: 'si', b: { hoy: [45, 50], fondo: [13, 17] } },
    { aparato: 'Teléfono tope de gama 2024–25', ejemplos: 'Oppo Find X9 Pro, Snapdragon 8 Elite', nucleo: '~1,5–2,5', hoy: '12,5 «juego» en régimen (§114)', lista: '~11–19', fondo: '5–9 / 3–7', veredicto: 'Sí: 60 dibujados (estimado)', tono: 'si', b: { hoy: [12.3, 12.6], fondo: [5, 9], medido: true } },
    { aparato: 'Teléfono de gama media', ejemplos: 'Galaxy A5x, Dimensity 7300, Exynos 1480', nucleo: '~5–5,7', hoy: '~50–63', lista: '~38–43', fondo: '16–19 / 11–16', veredicto: '60 dibujados, al borde (estimado); si no entra, 60 de carrera con 30 dibujados y la imagen intermedia ([[N8]])', tono: 'parcial', b: { hoy: [50, 63], fondo: [16, 19] } },
    { aparato: 'Teléfono de gama baja', ejemplos: 'Galaxy A1x, Redmi, Helio G85–G99', nucleo: '~8,3', hoy: '~92', lista: '~62', fondo: '17–22 / 17–25', veredicto: '60 de carrera, al borde, con 30 dibujados y la imagen intermedia ([[N8]]); en la sala, el video desde un PC ([[N11]]) (todo estimado)', tono: 'parcial', b: { hoy: [92, 92], fondo: [17, 22] } },
  ],
  escaleraPie: 'Un jugador, 12 karts. Gris: el hilo del juego hoy (dibujando todo). Color: con la versión 4, el hilo de la carrera (el dibujo va en otro núcleo y entra en 16,7 ms en todos los escalones salvo la gama baja, que dibuja a 30) (verde entra en 16,7 ms, ámbar al borde, rojo no entra). Barra llena = medido; borde punteado = estimado. La tarjeta de video no frena en ningún escalón simulado (0,2–3,3 ms por imagen, §164).',
  presupuestoTitulo: 'El presupuesto de la versión 4, pieza por pieza',
  presupuestoIntro: 'Cada pieza con su núcleo y su meta ([[H2]]). La columna de hoy es este PC, del perfil de la carrera de §160 reagrupado por partes del cuadro (`docs/soluciones-arquitectura.md` §0), escalado a los 11,1 ms de §166.5. La meta se mide en este PC como CPU pura en el tramo fijo (§163) y, con el aparato de mentira de la gama media (S ≈ 5,4) y la revisión de límites de Android ([[W5]]), cada hilo tiene que entrar en 16,7 ms: en la gama media la versión 4 llega **al borde**, sin el margen de 12 ms que pedía la versión 3. Si el hilo del dibujo no entra, dibuja 1 de cada 2 y la imagen intermedia completa los 60 ([[N8]]). Todo lo que no es «hoy» es estimado.',
  presupuesto: [
    { pieza: 'Worker A: la carrera (física, IA, objetos, cámaras)', donde: 'un núcleo grande', hoy: '4,2 ms (el hilo entero: 11,1)', meta: '≤ 3 ms (la carrera más el borde de las islas)', media: '≤ 16,7 ms (estimado: 16–19, al borde)', como: '[[W2]] [[W17]] [[H6]] [[H7]] [[W12]] [[W13]] [[W14]] [[M6]]' },
    { pieza: 'Worker B: el dibujo del juego, aurora y presentar', donde: 'otro núcleo grande', hoy: '2,8 + 0,95 ms (dentro del mismo hilo)', meta: '≤ 3 ms con el dibujo nativo', media: '≤ 16,7 ms, o 1 de cada 2 con la imagen intermedia', como: '[[W10]] [[W15]] [[W16]] [[N8]]' },
    { pieza: 'Lo que solo se ve de la parte de calcular (efectos, qué suena, la interfaz)', donde: 'el Worker B', hoy: '0,72 ms (dentro de la carrera)', meta: '0 en A (se mueve a B)', media: '—', como: '[[W11]] [[W16]]' },
    { pieza: 'Sonido', donde: 'el AudioWorklet o el Worker B', hoy: '~0,6 ms (el hilo de sonido del juego)', meta: '0 en A', media: '≤ 3–5 ms fuera del hilo de la carrera', como: '[[W11]] [[P5]]' },
    { pieza: 'Chrome y la página (`(program)`, Blink, el compositor, la interfaz)', donde: 'el hilo principal', hoy: '~2,6 ms (lo que queda del hilo)', meta: '≤ 1 ms en A', media: '≤ 3–4 ms en el hilo principal', como: '[[N3]] [[P10]]' },
    { pieza: 'La tarjeta de video', donde: 'la tarjeta', hoy: '0,2 ms en este PC; 1,2–1,5 en la gama media simulada (§164)', meta: 'que no frene', media: 'no frena en ningún escalón simulado', como: '[[W15]] (vuelve a medirla)' },
    { pieza: 'Procesador y tarjeta juntos', donde: '—', hoy: 'en serie dentro del mismo cuadro', meta: 'en paralelo: manda la mayor', media: '60 fps', como: '[[W10]]' },
  ],
  hilos: {
    tituloHoy: 'Hoy (estimado, S ≈ 5,4)',
    tituloMeta: 'Meta de la versión 4',
    aria: 'Un cuadro de un teléfono de gama media: hoy todo en un núcleo y en fila, unos 60 ms; con la versión 4, la carrera en un Worker y el dibujo en otro, en paralelo, cada uno cerca de 16,7 ms',
    hoy: [
      { nombre: 'El único núcleo', partes: [['la carrera', 22.4], ['dibujo y aurora', 15.1], ['presentar, sonido, Chrome y página', 22.4]] },
      { nombre: 'Tarjeta', partes: [['1,2–1,5 ms (§164)', 1.4]] },
    ],
    meta: [
      { nombre: 'Núcleo grande 1 · Worker A', partes: [['la carrera, con el motor y las islas', 16.2]] },
      { nombre: 'Núcleo grande 2 · Worker B', partes: [['el dibujo nativo y presentar', 13.5]] },
      { nombre: 'Núcleo chico · sonido', partes: [['la mezcla del sonido', 4]] },
      { nombre: 'Hilo de la página', partes: [['interfaz, mandos, red', 3]] },
      { nombre: 'Tarjeta · el cuadro anterior', partes: [['dibuja el n−1 mientras se calcula el n', 2]] },
    ],
  },
  hilosPie: 'Un cuadro en un teléfono de gama media, a escala (estimado, S ≈ 5,4 sobre el reparto de este PC). Arriba, hoy: todo en un solo núcleo y en fila, unos 60 ms por cuadro; la tarjeta, poca cosa. Abajo, la meta de la versión 4: la carrera en el Worker A y el dibujo en el Worker B, en paralelo; la carrera queda **al borde** de los 16,7 ms. Si el Worker B no llega, dibuja 1 de cada 2 y la imagen intermedia completa los 60 ([[N8]]). Se comprueba con el aparato de mentira ([[H1]]) y la revisión de límites ([[W5]]).',
  techo: P(
    '**El techo del navegador, medido.** El mismo juego como programa de Windows corre ×2,45–2,63 más rápido que en wasm (§165, §166), y ese impuesto está **repartido parejo** en 1.886 funciones: no hay un punto caliente que cambiar (§181.2). Es como un conductor más fino en todo el cableado: la caída está en cada metro. Por eso no ganó reescribir funciones de a una ([[N14]]), ni las variantes de la multiplicación-suma, ni copiar más código en línea (que en la gama baja pierde porque llena la caché de instrucciones).',
    '**Lo que sí puede ganar** (`docs/soluciones-motor.md`): sacar operaciones de lo que más se repite y **achicar** el código: la memoria de la Wii en un lugar fijo y en el orden de la PC (1,1 millones de accesos por cuadro, de ~13–15 operaciones a ~3–4: [[H6]], [[H7]]), la pila en variables locales ([[W12]]), el contexto en una dirección fija ([[W13]]), las banderas perezosas ([[W14]]) y PGO ([[W4]], [[M6]]). Todo junto, el código traducido ×1,5 realista y ×2,1 optimista; como es ~62 % del hilo, solo no alcanza. **Lo que cambia la cuenta es la forma**: el dibujo en otro núcleo ([[W10]]) y dibujar a 30 donde haga falta ([[N8]]). Y para lo que siga caliente, **islas decompiladas** con sus datos nativos ([[W15]]–[[W17]]), si los pilotos lo aprueban.',
    '**Lo que ningún plan arregla en la página.** KartPad, nativo, no llega a 60 en un Dimensity 7300 (~29 ms) ni en un Helio G85 (~45 ms) con 12 karts (`docs/kartpad.md`). La gama baja con 60 **dibujados** queda fuera: su camino es 60 de carrera con 30 dibujados y la imagen intermedia ([[N8]]), y en la sala el video desde un PC ([[N11]]); decirlo ([[N12]]) para lo que aun así no llegue. La app nativa quedó descartada ([[N10]]): el producto es siempre la página.'
  ),
  cambios: L(
    '**Etapa 0, pilotos que deciden (2 semanas)**: el sumidero y las páginas sucias ([[W1]]), la isla de la colisión ([[W2]]), un modelo dibujado en nativo ([[W3]]), PGO ([[W4]]), la simulación del teléfono con la revisión de límites ([[W5]]) y dos medidas del nativo ([[W6]]); cada uno con su umbral de éxito y de corte. Los arreglos de KartPad, temprano ([[W7]]–[[W9]]).',
    '**Etapa 1, el dibujo en otro núcleo**: A1-s ([[W10]]) y A2 ([[W11]]), con lo que quedaba de los pasos 8 y 9 viejos.',
    '**Etapa 2, el motor**: [[H6]] + [[H7]] (la parte 1a primero), PGO ([[M6]], [[M7]], [[H11]]), la pila ([[W12]]), el contexto ([[W13]]) y las banderas ([[W14]]).',
    '**Etapa 3, simular a 60 y dibujar a 30** con la imagen intermedia, en el Worker del dibujo ([[N8]]).',
    '**Etapa 4, las islas decompiladas, solo si pasan los pilotos**: D-a y D-b con los efectos ([[W15]], [[W16]]), la colisión y la física del kart ([[W17]]). En paralelo con el motor.',
    '**Etapa 5, las salas**: el video desde un PC para la gama baja ([[N11]]) y lo que quedaba ([[R4]]). **Etapa 6**: la página liviana y la prueba final.',
    '**Lo que sale**: reescribir de a una función ([[M4]], [[H9]], [[N7]]), las variantes de la multiplicación-suma ([[M5]], [[H8]]), las pasadas que agrandan el código ([[M8]], [[N5]]), lo que pesa menos del 3,5 % ([[M3]], [[M10]]), el paso 10 de la tarjeta ([[N9]], [[G7]], [[G10]], [[H13]]) y lo que reemplazan las islas ([[N6]], [[H10]]).',
    '**La poda (2026-10-31 23:10)**, el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo». Salen 18 más: los hilos con memoria compartida y la CPU con la tarjeta en paralelo, que [[W10]] ya contiene o que no ganan porque la tarjeta no frena ([[H3]], [[H4]], [[N4]], [[G9]], [[P9]]); la aurora nueva (N15b); lo que ya cubre otro ítem ([[M9]], [[W18]], [[M11]]); lo que con el juego en un Worker o sin pedidos en la carrera no toca el cuadro ([[P1]], [[P2]], [[D10]], [[D11]]); y lo que no es rendimiento ([[U4]], [[E1]], [[E2]], [[D7]], [[D14]]).'
  ),
};

export const ficha = [
  ['16,7 ms', 'por cuadro a 60 fps'],
  ['11,1 ms', 'el hilo del juego en este PC (9800X3D), carrera de 12, dibujando todo (§166.5)'],
  ['4,2 + 2,8 ms', 'la carrera y el dibujo del juego con aurora, en ese mismo hilo (perfil de §160)'],
  ['×1,5', 'lo que daba, siendo realista, todo lo que quedaba de la versión 3'],
  ['×5–8', 'más lento todo el hilo en un teléfono de gama media o baja (simulado)'],
  ['+16 %', 'lo que paga Android por revisar los límites de la memoria en cada acceso'],
  ['29 / 45 ms', 'KartPad nativo (mismo traductor) en un Dimensity 7300 y un Helio G85'],
  ['×2 / −0,5 ms', 'los umbrales de éxito de los pilotos de la colisión y del dibujo nativo'],
  [String(total), 'ítems en total: los de la versión 4 y los de antes, hechos o descartados'],
  ['7 etapas + la 4b y la 4c', 'de la versión 4; la 4 (las islas) quedó descartada, la 4b es lo ambicioso (estimado) y la 4c, las mejoras chicas juntas (preparada)'],
];

export const cuadro = {
  texto: P(
    'A 60 fps cada cuadro tiene **16,7 ms**, como el período de una señal de 60 Hz. Todo corre en **un solo hilo** y en fila: la lógica del juego, el dibujo del juego, aurora (que lo traduce a WebGPU), la mezcla del sonido y la página. Si la suma pasa de 16,7 ms el cuadro llega tarde, y si pasa de 33,3 se ve a 30.',
    'En el PC sobra margen fuera de la sala. En la sala va al borde por «todo a la vista» (la sincronía obliga a dibujar todo). En el teléfono de gama alta la CPU entra, pero la tarjeta tarda 34 ms por imagen y por eso se ve a 30; además el arranque y la 1.ª carrera no entran. Y en el teléfono los dos números del informe («juego» y «tarjeta») se contienen el uno al otro, así que todavía no se sabe bien qué parte es CPU y qué parte es GPU ([[V1]]).',
    'Ojo con la escala: el PC es un Ryzen 7 9800X3D y el teléfono un Oppo Find X9 Pro, los más rápidos de su clase. Lo que pasa en los demás aparatos está en «¿Alcanza?».'
  ),
  filas: [
    { caso: 'PC (Ryzen 7 9800X3D), carrera fuera de la sala', ms: '7,0–9,5', fuente: '§54, §85; `medir-sitio/pedidos-lote3-pc` (7,23; p95 9,7)' },
    { caso: 'PC en la sala (dos pestañas en el mismo PC)', ms: '15–17', fuente: '§85; `datos/sala/registro.txt` (12,7–18)' },
    { caso: 'PC con la CPU frenada ×4 (simula un PC débil; exagera)', ms: '56,3 (17,7 fps)', fuente: '§54' },
    { caso: 'Oppo Find X9 Pro, en régimen', ms: '12,3–12,6', fuente: '§114' },
    { caso: 'Oppo, primeros ~21 s de la 1.ª carrera', ms: '27–48', fuente: '§114' },
    { caso: 'Oppo, 2.º informe (30 s)', ms: 'juego 33,4 / tarjeta 33,8', fuente: '§115' },
    { caso: 'Oppo con la vista más angosta', ms: '20', fuente: '§115.5' },
    { caso: 'Teléfono de gama media (×2,8–3,8 el Oppo)', ms: '35–48', fuente: 'estimado (ver «¿Alcanza?»)' },
  ],
  reparto: [
    ['`RaceScene::OnCalc` (la lógica)', '3,1 ms', '4,3 ms'],
    ['`ScnMgr::DrawMain` (el dibujo del juego)', '2,1 ms', '6,4 ms'],
    ['… de eso, `RendererRaceModels::Draw` (los karts)', '1,5 ms', '5,6 ms'],
    ['Lo demás: 2D, efectos, sonido y fin de cuadro de aurora', '~4 ms', 'sin medir aparte'],
    ['La página (JavaScript)', 'menos de 0,1 ms', 'sin medir (lockstep)'],
  ],
  barras: [
    { caso: 'PC, fuera de la sala', desde: 7.0, hasta: 9.5, texto: '7–9,5 ms' },
    { caso: 'PC, en la sala', desde: 15, hasta: 17, texto: '15–17 ms' },
    { caso: 'Celular alto, régimen', desde: 12.3, hasta: 12.6, texto: '12,3–12,6 ms' },
    { caso: 'Celular alto, vista angosta', desde: 20, hasta: 20, texto: '20 ms' },
    { caso: 'Celular alto, 1.ª carrera', desde: 27, hasta: 48, texto: '27–48 ms' },
    { caso: 'Celular alto, informe §115', desde: 33.4, hasta: 33.8, texto: '33,4–33,8 ms' },
    { caso: 'Celular medio', desde: 35, hasta: 48, texto: '35–48 ms (estimado)', estimado: true },
  ],
  pie: 'Barra llena = medido; borde punteado = estimado. Verde: entra en 16,7 ms; ámbar: al borde; rojo: no entra. La raya fina marca el rango medido. El PC con la CPU frenada ×4 (56,3 ms) no va en el dibujo porque ese freno exagera.',
};

export const asincronia = {
  texto: P(
    '**Hoy** la sala es un lockstep: las 12 consolas simulan exactamente la misma carrera y, para correr cada cuadro, cada una necesita los botones de todos los humanos para ese cuadro. Es una cadena de compuertas AND: el cuadro avanza cuando llegaron todas las entradas, así que el más lento marca el paso. Los arreglos de hoy (relevo, sincronía, ponerse al día) achican el daño: una traba de 1,5 s cuesta 34–322 ms a los demás.',
    '**Asíncrono del todo** (cada uno a su ritmo y la misma carrera en todas las pantallas) no existe sin rollback, y el rollback aquí es imposible. Pero sí se puede lograr lo que importa, **que el fps de uno no frene a nadie**, con dos piezas juntas:',
    L(
      '**El árbitro:** la consola más estable fija en cada cuadro los botones de todos. Las demás esperan solo a ella, como osciladores enganchados por PLL a un reloj maestro. Si los botones de un jugador no le llegan a tiempo, el árbitro repite el último y la carrera sigue.',
      '**Simular a 60 aunque se dibuje menos:** cada aparato corre siempre 60 cuadros de lógica por segundo y dibuja los que alcanza. El teléfono que dibuja a 30 sigue en la misma carrera y a tiempo.'
    ),
    'Lo que ningún modelo arregla: un aparato que no puede **simular** 60 cuadros por segundo ni siquiera sin dibujar. Con el árbitro eso lo paga solo él (se atrasa o queda fuera de esa carrera), no la sala. Por eso lo primero es medir cuánto tarda el teléfono en simular sin dibujar ([[V1]]).'
  ),
  opciones: [
    { nombre: 'Lockstep de hoy (malla)', que: 'cada consola espera los botones de todas en cada cuadro; relevo y sincronía como arreglos', veredicto: 'Queda de respaldo.', porque: 'Funciona y está probado, pero la traba de uno les cuesta 34–322 ms a los demás.', esfuerzo: 'ya está', tono: 'posible' },
    { nombre: 'Árbitro (el relevo como modo normal)', que: 'la PC más estable fija los botones de todos en cada cuadro; cada uno manda los suyos solo al árbitro y a un suplente', veredicto: 'Recomendado.', porque: 'Nadie espera a nadie más que al árbitro. El formato ya existe. Cuesta +1–2 cuadros de retraso y 2–3 Mbit/s de subida para el árbitro.', esfuerzo: '~1 semana', tono: 'recomendado' },
    { nombre: 'Simulación a 60 separada del dibujo', que: 'cada aparato simula siempre 60 cuadros por segundo y dibuja los que alcanza', veredicto: 'Recomendado: es la pieza clave.', porque: 'El que dibuja a 30 no frena a nadie ni se atrasa. Hay que decompilar lo que el dibujo le deja a la lógica (`ModelDirector::Update`, la visibilidad).', esfuerzo: '1–1,5 semanas', tono: 'recomendado' },
    { nombre: 'Rollback (estilo GGPO)', que: 'cada uno corre adelantado y corrige cuando llegan los botones', veredicto: 'Descartado.', porque: 'El estado son 88 MB o más y los hilos del juego son fibras con pila nativa suspendidas por JSPI: no se pueden guardar ni restaurar. Copiar 88 MB tarda 9–30 ms y re-simular 3 cuadros en el teléfono unos 37 ms.', esfuerzo: '—', tono: 'descartado' },
    { nombre: 'RKNet (el en línea de la Wii)', que: 'cada consola simula su kart y manda su estado; los demás se ven interpolados', veredicto: 'No por ahora.', porque: 'No tiene CPU (habría que extender paquetes y tablas), exige armar la carrera sin WFC y cada pantalla ve una carrera algo distinta.', esfuerzo: '6–12 semanas', tono: 'descartado' },
    { nombre: 'Un servidor que corre el juego', que: 'un servidor simula y les manda la carrera a todos', veredicto: 'No.', porque: 'Habría que correr 128 MB de wasm a 60 Hz por sala en un servidor, y sacar el ejecutable traducido de Nintendo de R2 privado.', esfuerzo: '—', tono: 'descartado' },
    { nombre: 'Video desde un PC de la sala (plan C2)', que: 'un PC de la sala dibuja también la vista del teléfono débil y se la manda en video', veredicto: 'A investigar, solo para teléfonos que no simulan a 60.', porque: 'Cualquier teléfono a 60, a cambio de 30–50 ms más de demora y de la subida del PC ([[N11]]).', esfuerzo: '3–5 semanas', tono: 'posible' },
  ],
  pie: 'Izquierda: hoy cada consola necesita los botones de todas en cada cuadro (66 enlaces con 12 jugadores) y el lento (en rojo) frena a todos. Derecha: con el árbitro cada consola espera solo al árbitro, y el lento solo se atrasa él.',
  cierre: 'Orden recomendado: medir el teléfono ([[V1]]) y ampliar la huella ([[R5]]) → separar la simulación del dibujo ([[R2]]) → el árbitro como opción ([[R1]]) → probar PC con celular ([[R6]]). Son 2–3 semanas, en la fase 4.',
};

export const cuestionarIntro = 'Pediste cuestionar todo. Esta tabla revisa cada capa del proyecto, del motor a la infraestructura, y dice qué hacer con ella: **mantener**, **mejorar**, **cambiar**, **probar**, **no** o **después**. La regla para cambiar algo: que gane en los números y que no rompa la sala ni los fantasmas.';

export const cuestionar = [
  { capa: 'Motor: traducción estática (WiiCompiled)', hoy: 'PowerPC → C++ → wasm', veredicto: 'mejorar', porque: 'Es exacta en coma flotante (paridad 22/0) y RR/Pulsar parchea el juego por direcciones: solo un binario traducido respeta eso. Dolphin en wasm solo existe como demo (traduce mientras corre: siempre más lento) y un port desde la decompilación pública (doldecomp/mkw va en 5,8 %) obliga a rehacer cada parche de RR. La versión 4 ataca lo que de verdad cuesta en wasm: la memoria de la Wii, la pila, el contexto, las banderas y PGO ([[H6]], [[W12]]–[[W14]], [[M6]]).', costo: 'semanas' },
  { capa: 'Decompilar por islas (versión 4)', hoy: 'no se usa', veredicto: 'probar', porque: 'Decompilar el juego entero no conviene (18–30 meses y el 94 % casi no corre en la carrera), pero una **isla** entera con sus datos en formato nativo podría correr ×2–2,5 más rápido. Primero los pilotos de dos semanas con su umbral ([[W2]], [[W3]]); si pasan, el dibujo en nativo y la física ([[W15]]–[[W17]]). Lo decompilado es derivado del código de Nintendo: nunca a git, solo dentro del `.wasm` privado de R2.', costo: 'meses' },
  { capa: 'Física propia (Kinoko)', hoy: 'no se usa', veredicto: 'no', porque: 'Reimplementa la física de Contrarreloj (55 de 55 fantasmas cuadro a cuadro), pero no trae objetos, CPU, en línea ni los cambios de RR. Sirve como referencia para validar, no para reemplazar.', costo: '—' },
  { capa: 'WebAssembly: SIMD128 y JSPI', hoy: 'en uso', veredicto: 'mantener', porque: 'SIMD128 dio −13 % en los menús; JSPI deja al juego esperar sin instrumentar todo (Asyncify sale más grande y más lento). Probar branch hints (Chrome 137) y tail calls. Nada de fast-math ni memory64; SIMD relajado solo para la multiplicación-suma, probada fusionada al arrancar ([[H8]], [[M11]]).', costo: '—' },
  { capa: 'Partir el módulo (wasm-split)', hoy: 'un `.wasm` de 128 MB', veredicto: 'despues', porque: 'Ayuda a la 1.ª carga y a la memoria de teléfonos chicos, no al cuadro. Es experimental: una función que falta se carga en plena carrera y de forma síncrona (Chrome no compila más de 8 MB síncronos en el hilo principal): tirón y, en la sala, espera del lockstep.', costo: 'semanas' },
  { capa: 'Emscripten 6.0.12', hoy: '`-O2`, sin LTO, MEMFS, dlmalloc', veredicto: 'mejorar', porque: '`-O3` y `wasm-opt` no ganaron (§54). Probar ThinLTO del runtime y aurora ([[M7]]) y PGO ([[M6]]). mimalloc gana poco: el juego reparte su memoria dentro de la RAM de la Wii. WasmFS: los 6.036 archivos cuestan al arrancar, no por cuadro ([[C6]]).', costo: 'días' },
  { capa: 'Hilos (pthreads, memoria compartida)', hoy: 'un solo hilo', veredicto: 'cambiar', porque: 'Usar más núcleos es el multiplicador grande que queda dentro del navegador: un teléfono tiene 8 y el juego usa uno. Pero no hace falta memoria compartida: el dibujo va a un segundo Worker con su propia copia del juego y la cinta de cajas ([[W10]], [[H5]]), que anda en cualquier Chrome, también en Android. Con memoria compartida ganaría solo −0,1 a −0,5 ms más y con riesgo alto en Android (`docs/soluciones-arquitectura.md` §7): la poda del 2026-10-31 descartó esa variante ([[G9]], [[N4]], [[P9]]). (En la primera versión decía «después»: era un error de escala.)', costo: 'semanas' },
  { capa: 'La carrera repartida en varios núcleos', hoy: 'un hilo, como en la Wii', veredicto: 'no', porque: 'La Wii tenía un solo procesador y la carrera es una sola fila de decisiones: repartirla cambia el orden de las cuentas, separa las consolas de la sala y los fantasmas, y gana poco (la física de los 12 karts es solo una parte del cuadro). Se reparte todo lo demás: el dibujo entero a otro Worker, porque la carrera nunca lo lee ([[W10]], [[W11]]).', costo: '—' },
  { capa: 'El dibujo en otro núcleo (versión 4)', hoy: 'en el mismo hilo que la carrera', veredicto: 'cambiar', porque: 'La carrera nunca lee lo que el dibujo escribe ([[R2]] lo probó), así que el dibujo entero, también el código del juego que recorre la escena, va a un segundo Worker un cuadro atrás, con las páginas sucias transferidas en cajas: sin memoria compartida, anda en cualquier Chrome ([[W10]]). Es el «dual core» de Dolphin cortado más arriba. Precio: un cuadro de demora y una segunda copia del juego en memoria.', costo: '4–6 semanas' },
  { capa: 'aurora (GX → WebGPU)', hoy: 'adaptada a la web por nosotros', veredicto: 'mejorar', porque: 'La traducción del GX es grande y correcta, y se queda para todo lo que no sea caliente. La versión 4 la mueve al Worker del dibujo ([[W10]]) y, si el piloto lo aprueba ([[W3]]), le saca lo más caro con un renderizador propio para los modelos (D-a, [[W15]]). noclip.website (MIT) sirve de referencia para los formatos y los shaders GX.', costo: 'semanas' },
  { capa: 'WebGPU (en vez de WebGL2)', hoy: 'en uso', veredicto: 'mantener', porque: 'aurora ya habla WebGPU, compila los pipelines en paralelo y da timestamp-query. WebGL2 compila los shaders en el hilo de la página y no tiene compute. En Android pide Chrome 121 y Android 12 con GPU Qualcomm o ARM.', costo: '—' },
  { capa: 'emdawnwebgpu', hoy: 'el puente de C++ a WebGPU', veredicto: 'mantener', porque: 'Es el puente obligado; lo que cuesta es la cantidad de llamadas, y eso baja con [[G3]].', costo: '—' },
  { capa: 'SDL3', hoy: 'ventana, sonido y eventos', veredicto: 'mantener', porque: 'No aparece en el perfil. Se pueden quitar los subsistemas que sobran (los mandos ya los maneja la página).', costo: 'horas' },
  { capa: 'Sonido (nw4r::snd, AX, AudioWorklet)', hoy: 'mezcla en el hilo del juego', veredicto: 'mejorar', porque: 'Rehacer el motor de sonido sería rehacerlo todo; el hilo de sonido sale del hilo de la carrera ([[W11]]) y el puente deja de crear basura ([[P5]]).', costo: 'días' },
  { capa: 'Disco por bloques (MEMFS, lotes, Cache Storage)', hoy: 'perezoso y sin freno', veredicto: 'mejorar', porque: 'La idea está bien; faltan el paquete de carrera, el freno y la versión por archivo ([[D1]], [[C4]], [[D5]]).', costo: 'semanas' },
  { capa: 'El marco del juego en GitHub Pages', hoy: 'mismo origen que Juegos', veredicto: 'cambiar', porque: 'Comparte el hilo con el sitio. Con el juego en un Worker ([[N3]], [[P10]]) la carrera deja de compartirlo; el «modo juego» del sitio y la página aislada con Document-Isolation-Policy ya no hacen falta y se descartaron en la poda ([[P2]], [[P9]]).', costo: 'semanas' },
  { capa: 'El navegador como única plataforma', hoy: 'solo Chrome (escritorio y Android)', veredicto: 'probar', porque: 'Tiene techo, pero más alto de lo que decía la versión 2: la memoria de la Wii y la multiplicación-suma se pueden abaratar dentro de wasm ([[H6]]–[[H8]]) y los hilos llegan al teléfono ([[H5]]). [[N1]] midió el impuesto: ×2,2. Es la única plataforma del producto (el dueño, 2026-10-29: nada de app descargable).', costo: 'meses' },
  { capa: 'Probar en muchos aparatos', hoy: 'el PC (varios Chrome y la emulación de teléfono); el Oppo ya no se mide', veredicto: 'mejorar', porque: 'No hay más aparatos: la gama media y la baja se simulan con lastre de CPU y de tarjeta y un ladrón de caché, calibrados ([[H1]]), con metas con margen ([[H2]]). La sala de 12, con consolas de mentira ([[V7]]).', costo: 'días' },
  { capa: 'Video a los teléfonos débiles', hoy: 'no se usa', veredicto: 'probar', porque: 'Un PC de la sala dibuja también la vista del teléfono y se la manda en video: cualquier teléfono a 60, con más demora ([[N11]]).', costo: '3–5 semanas' },
  { capa: 'Worker de Cloudflare + R2', hoy: 'en `workers.dev`, plan gratis', veredicto: 'mantener', porque: 'R2 no cobra la salida y los 5 GB caben gratis. En `workers.dev` no hay caché del borde y el plan gratis da 100.000 pedidos por día: un dominio propio y el plan pago acortarían la carga, pero no el cuadro, y con la carrera andando no se pide nada (§176.3); quedan como opción del dueño en `docs/publicar.md` ([[D7]], [[D14]], descartados en la poda).', costo: '—' },
  { capa: 'Firebase RTDB (sala, vestíbulo, VR)', hoy: 'en uso', veredicto: 'mantener', porque: 'Solo tiene servidores en EE. UU., Europa y Asia: unos 120–200 ms desde Sudamérica. Sirve para el vestíbulo y la sala; los botones no pasan por ahí. Su SDK trabaja en el hilo de la página de arriba: con el juego en un Worker ([[N3]]) ya no le quita tiempo a la carrera.', costo: '—' },
  { capa: 'Durable Objects (en vez de Firebase)', hoy: 'no se usan', veredicto: 'no', porque: 'No hay Durable Objects en Sudamérica (los más cercanos, en el este de EE. UU.): la misma latencia que Firebase. Con botones a 60 Hz se pasaría de la cuota gratis en minutos.', costo: '—' },
  { capa: 'WebRTC en malla (DataChannels)', hoy: '11 enlaces por jugador', veredicto: 'mantener', porque: 'Para 12 es viable (unos 0,7–1 Mbit/s de subida por jugador); el límite es la red del peor. Con el árbitro ([[R1]]) bajan los mensajes. Chrome no intercala mensajes: nada grande en la carrera ([[R8]]).', costo: '—' },
  { capa: 'Cloudflare Realtime SFU (DataChannels)', hoy: 'no se usa', veredicto: 'probar', porque: 'Cada uno sube una sola vez (no 11): bueno para la subida de un teléfono. Desde agosto de 2026 acepta canales sin orden ni reenvío. Agrega un salto por Cloudflare (hay que medirlo) y cuesta unos US$0,21 por hora-sala pasados los 1.000 GB gratis al mes. Solo si la subida del árbitro o de los teléfonos no alcanza.', costo: 'días' },
  { capa: 'TURN de Cloudflare («Todo por Cloudflare»)', hoy: 'opción apagada', veredicto: 'mantener', porque: 'Solo para quien no conecta directo; agrega latencia. Bien como está: apagado por omisión.', costo: '—' },
  { capa: 'WebTransport con servidor propio', hoy: 'no se usa', veredicto: 'no', porque: 'Es cliente-servidor: hace falta un servidor QUIC propio (los Workers no lo ofrecen) y no gana sobre la malla directa.', costo: '—' },
  { capa: 'Lockstep', hoy: 'malla: todos esperan a todos', veredicto: 'cambiar', porque: 'Pasar al árbitro ([[R1]]) con la simulación separada del dibujo ([[R2]]): el lento deja de frenar a los demás.', costo: '2–3 semanas' },
  { capa: 'Rollback (estilo GGPO)', hoy: 'no se usa', veredicto: 'no', porque: 'El estado son 88 MB o más y los hilos del juego son fibras que no se pueden guardar ni restaurar.', costo: '—' },
  { capa: 'RKNet (el en línea de la Wii)', hoy: 'no se usa (sala sin WFC, §73)', veredicto: 'no', porque: 'No tiene CPU, exige armar la carrera sin WFC y cada pantalla ve una carrera algo distinta. Solo si el teléfono no puede simular a 60 ni sin dibujar.', costo: '6–12 semanas' },
  { capa: 'Un servidor que corre el juego', hoy: 'no se usa', veredicto: 'no', porque: '128 MB de wasm a 60 Hz por sala en un servidor (un Worker tiene 128 MB de memoria y milisegundos de CPU por pedido), y el ejecutable traducido de Nintendo fuera de R2 privado.', costo: '—' },
];

export const fasesIntro = 'Siete etapas (versión 4, 2026-10-31) y, al final, lo ya hecho en las versiones 1–3. La etapa 0 son dos semanas de **pilotos que deciden**: cada uno tiene un umbral de éxito y uno de corte, escritos antes de empezar, como la prueba de un prototipo antes de fabricar la serie. La etapa 1 saca el dibujo a otro núcleo (contiene los pasos 8 y 9 viejos, con la puerta A); la 2 es el motor; la 3, simular a 60 y dibujar a 30 donde haga falta; la 4, las islas decompiladas, **solo si los pilotos pasan**, en paralelo con el motor; la 4b, lo ambicioso (hilos de verdad, el dibujo retenido y los saltos en línea; estimada); la 4c, las mejoras chicas medidas juntas (preparada, se ejecuta cuando el dueño lo diga); la 5, las salas; la 6, la página liviana y la prueba final. Cada etapa termina con números medidos («listo cuando»), en la gama baja simulada y en este PC como control, y con lo que te toca a ti.';

export const fases = [
  {
    n: 0, nombre: 'Pilotos que deciden', duracion: '2 semanas, más 2–3 días de los arreglos de KartPad',
    objetivo: 'Antes de meterle meses a nada, contestar con números las preguntas que deciden el resto: ¿el dibujo es un sumidero y cuántas páginas ensucia la carrera por cuadro ([[W1]])? ¿una isla decompilada de la lógica gana ×2 ([[W2]])? ¿un modelo dibujado en nativo baja 0,5 ms ([[W3]])? ¿PGO gana en la gama baja ([[W4]])? Y medir los teléfonos como son, pagando la revisión de límites de Android ([[W5]], [[N2]]), y cuánto pesa la memoria de la Wii en el nativo ([[W6]]). Cada piloto tiene su umbral de éxito y de corte escrito en su ítem. Con eso, temprano, los tres arreglos de KartPad ([[W7]]–[[W9]]).',
    items: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'N2', 'W7', 'W8', 'W9', 'W19', 'W20'],
    pasos: [
      'M0: las páginas sucias por cuadro y la prueba del sumidero en 5–10 pistas, también de RR ([[W1]]).',
      'Semana 1: la isla de la colisión (KCL), con el comprobador en el borde ([[W2]]); al lado, el piloto de PGO ([[W4]]).',
      'Semana 2: un modelo de la pista dibujado en nativo, con la foto contra la de hoy ([[W3]]).',
      'La simulación del teléfono con `--wasm-enforce-bounds-checks` y la escalera otra vez ([[W5]], [[N2]]).',
      'El nativo con los bytes dados vuelta como wasm, y el nativo «revisado» en la carrera ([[W6]]).',
      'Los arreglos de KartPad: el aviso de XF, la memoria tras 8 pistas y la tarjeta en el informe ([[W7]], [[W8]], [[W9]]).',
      'El veredicto de cada piloto contra su umbral, en la bitácora; con eso se decide la etapa 4 y el orden de la 2.',
    ],
    listo: [
      'cada piloto con su número y su veredicto (pasa o se mata, según su umbral) escrito en la bitácora',
      'el sumidero probado en 5–10 pistas (también de RR) y las páginas sucias por cuadro medidas',
      'la escalera de los teléfonos simulados medida otra vez con la revisión de límites de Android',
      'los tres arreglos de KartPad revisados',
    ],
    dueno: [
      'acordar las metas por escalón de la versión 4',
      'decidir con los números de los pilotos si va la etapa 4',
    ],
  },
  {
    n: 1, nombre: 'El dibujo en otro núcleo', duracion: '6–9 semanas',
    objetivo: 'Pasar de dos resistencias en serie a dos ramas en paralelo: la carrera en un Worker y el dibujo entero (también el código del juego que recorre la escena) en otro, un cuadro atrás. Funciona porque la carrera nunca lee lo que el dibujo escribe ([[R2]], [[W1]]). Primero se termina lo que quedó a medias del paso 8 viejo (el juego en un Worker y la puerta A, §186–§189); después A1-s ([[W10]]) y A2 ([[W11]]). Lo que servía del paso 9 viejo (aurora y el sonido fuera del hilo de la carrera) queda adentro de esos dos; las variantes con memoria compartida, la aurora nueva y lo que ya no rinde se descartaron en la poda del 2026-10-31.',
    items: ['W10', 'W11', 'N3', 'P10', 'H5'],
    pasos: [
      'Terminar la prueba del juego en un Worker (§189: la gama baja con 5 pares y las pruebas de la página; sin el programa con memoria compartida, que A1-s no necesita) y decidir la puerta A ([[N3]], [[P10]], [[H5]]).',
      'A1-s: el Worker B con su copia del juego; A le manda las páginas sucias en cajas y B dibuja el cuadro anterior ([[W10]]).',
      'Las pruebas de «saltar» de los efectos, los sonidos, la interfaz y el hilo de sonido; lo que pase, a B ([[W11]]).',
      'Medir en el tramo fijo, la gama baja simulada (con [[W5]]) y este PC, intercalados; la sala con dos programas; `correr-todo`.',
    ],
    listo: [
      'el hilo de la carrera a ~6 ms por cuadro en este PC (hoy 11,1), en el tramo fijo, y la gama baja simulada mejor en la misma proporción',
      'huellas 75/75 con un programa nuevo y uno de hoy en la misma sala, el fantasma igual cuadro por cuadro y la foto igual',
      'abrir el juego no atrasa más de 50 ms el latido de otra pestaña',
      'la segunda copia del juego medida en memoria, y la puerta A decidida con números',
    ],
    dueno: [
      'subir a R2 el programa nuevo',
      'decidir en la puerta A',
    ],
  },
  {
    n: 2, nombre: 'El motor', duracion: '8–14 semanas',
    objetivo: 'Lo que cuesta el código traducido dentro de wasm, atacado donde de verdad cuesta y **sin copiar más código en línea** (eso perdió en la gama baja): la memoria de la Wii (1,1 millones de accesos por cuadro, cada uno de ~13–15 operaciones a ~3–4), la pila, el contexto, las banderas del CR y PGO. El orden lo deciden los pilotos [[W4]] y [[W6]].',
    items: ['H6', 'H7', 'M6', 'M7', 'H11', 'W12', 'W13', 'W14'],
    pasos: [
      'La memoria de la Wii en un lugar fijo: primero 1a (lo que el traductor ya sabe que es RAM, y la pila), después 1b (una comparación para la E/S) ([[H6]]).',
      'Si [[W6]] lo justifica: la RAM en el orden de la PC, con una sola puerta para todo lo que la lee desde afuera ([[H7]]).',
      'PGO con el perfil del nativo, lo frío afuera, y ThinLTO si gana ([[M6]], [[M7]], [[H11]]), según el piloto [[W4]].',
      'La pila de la Wii en variables locales ([[W12]]).',
      'El contexto de la CPU en una dirección fija ([[W13]]).',
      'Las banderas del CR perezosas y el modo seguro de §193 terminado ([[W14]]); sin lo que rompe la sala o los fantasmas (las reglas del plan).',
      'Cada cambio: `paridad`, el volcado de la RAM, la sala con dos programas y los fantasmas; medido en la gama baja (con la revisión de límites) y en este PC.',
    ],
    listo: [
      '`paridad`, el volcado de la RAM, la huella ampliada y los fantasmas iguales en cada cambio',
      'el código traducido ×1,3 o más rápido en la gama baja simulada (con la revisión de límites), en el tramo fijo',
      '`correr-todo` completo con el programa final',
    ],
    dueno: [
      'subir a R2 el `.wasm` nuevo (varias veces)',
    ],
  },
  {
    n: 3, nombre: 'Simular a 60, dibujar a 30 y mostrar 60', duracion: '2–3 semanas',
    objetivo: 'Donde el Worker del dibujo no llegue a 60 (la gama baja, y la media si queda al borde), la carrera sigue a 60 cuadros por segundo, igual en todos los aparatos, y el dibujo va a 30 con la imagen intermedia de aurora ([[N8]]). Es como un televisor de 120 Hz que inventa cuadros: el partido es el mismo, la pantalla se ve pareja. [[R2]] ya probó que saltar el dibujo no cambia la carrera; con el dibujo en otro núcleo, la imagen intermedia sale del hilo de la carrera.',
    items: ['N8'],
    pasos: [
      'aurora no presenta el cuadro saltado y pone en su lugar la imagen intermedia ([[N8]]); el salto del dibujo ya está ([[R2]]).',
      'Que el Worker B decida solo: dibuja 1 de cada 2 cuando no llega a 60 y vuelve a 60 cuando le sobra.',
      'Medir en la gama media y la baja simuladas: cuadros de lógica, imágenes dibujadas e intermedias por segundo.',
      'Comparar con el modo de 30 fps del propio juego que usa KartPad (solo para medir: el camino de R2 es el seguro para la sala).',
    ],
    listo: [
      'la gama media y la baja simuladas: 60 cuadros de lógica por segundo y 60 imágenes a la vista, con la huella igual',
      'en la sala, uno dibujando a 30 y otro a 60: huellas 75/75',
    ],
    dueno: [],
  },
  {
    n: 4, nombre: 'Las islas decompiladas (solo si pasan los pilotos)', duracion: '12–22 semanas, en paralelo con el motor',
    objetivo: 'Una **isla** es un subsistema entero que pasa a C++ propio con sus datos en formato nativo, y que solo habla con el resto del juego en su borde: como cambiar un tramo de línea entero por cobre grueso entre dos cajas de empalme. Primero el dibujo (no toca la carrera: no puede romper los fantasmas), después la colisión y la física del kart (exigen los mismos bits que la Wii). Va solo con [[W2]] y [[W3]] aprobados. Todo lo decompilado es derivado del código de Nintendo: carpeta ignorada desde el primer archivo, nunca a git ni publicado; sale solo dentro del `.wasm` privado de R2.',
    items: ['W15', 'W16', 'W17'],
    pasos: [
      'Si [[W3]] pasó: D-a, el envío del dibujo en nativo, en el Worker B ([[W15]]).',
      'Si D-a ganó lo esperado: D-b, el dibujo entero con los efectos ([[W16]]).',
      'Si [[W2]] pasó: la colisión y después la física del kart, por fases y con el traducido de testigo ([[W17]]).',
      'Cada isla: el comprobador en el borde, los fantasmas contra el experto, la sala con dos programas y `correr-todo`.',
    ],
    listo: [
      'cada isla con 0 diferencias en su comprobador, los fantasmas iguales y la sala 75/75',
      'el dibujo a 3 ms o menos de CPU por imagen en este PC (hoy ~6,7), con las fotos iguales',
      'la gama media simulada con el hilo de la carrera a 16,7 ms o menos',
    ],
    dueno: [
      'decidir si se sigue con la IA de la CPU y los objetos',
      'subir a R2 el `.wasm` nuevo',
    ],
  },
  {
    n: '4b', nombre: 'Lo ambicioso: hilos de verdad, el dibujo retenido y los saltos en línea', duracion: '8–16 semanas (estimado)',
    objetivo: 'Sale de la etapa 4 (bitácora §222): en la gama baja el dibujo cuesta ~10 de ~20 ms y los modelos son solo 0,6–0,7 ms; ~9 ms son el esqueleto fijo de cada imagen. Se junta con [[W10]] (etapa 1, abierta) y [[N8]] (etapa 3, hecha). Techo honesto: a la gama baja le faltan ×3,2 de lógica para 60 y nada de aquí da ×3 por sí solo; la combinación realista es [[W21]] + [[W22]] + [[N8]] (se ve a 60 dibujando a 30), [[W23]] para la lógica y [[W24]] o el video ([[N11]]) para la sala. Todo estimado, nada medido todavía.',
    items: ['W21', 'W22', 'W23', 'W24'],
    pasos: [
      'Día 1 de [[W21]]: el service worker en el sitio local; el ingreso con Firebase, los marcos y el Worker de R2 siguen andando; `crossOriginIsolated` verdadero.',
      'Día 1 de [[W22]] (horas): el esqueleto del dibujo medido por partes con los contadores que ya hay; si la sospecha se confirma, el dibujo retenido.',
      'Día 1 de [[W23]]: la prueba chica de las indirectas escrita de las dos formas, en Chrome; si gana, el traductor y después el juego.',
      'Con memoria compartida, el dibujo en otro núcleo sin copias ([[W10]]); [[W24]] (opcional) solo si la caja por cuadro se comprime lo bastante.',
      'Cada pieza adoptada: gama baja simulada y este PC, con huellas, fantasmas y foto iguales.',
    ],
    listo: [
      'el sitio local entero con aislamiento y `crossOriginIsolated` verdadero en el marco del juego ([[W21]])',
      'el esqueleto medido por partes y, si se construye, el dibujo por cuadro más bajo en la gama baja simulada con la foto igual ([[W22]])',
      'la prueba chica y después el juego, con huellas 75/75 y el fantasma igual ([[W23]])',
      'cada pieza adoptada medida en la gama baja simulada y en este PC, con las pruebas de igualdad completas',
    ],
    dueno: [
      'confirmar el PR del sitio antes de W21 en Paginita-Pro (cada vez)',
      'subir a R2 el `.wasm` nuevo si W22 o W23 se adoptan',
    ],
  },
  {
    n: '5b', nombre: 'La sala: 3 conexiones', duracion: '1–2 semanas (estimado)',
    objetivo: 'Pedido del dueño (2026-11-05): que el anfitrión elija cómo se conecta la sala, con nombres cortos y un textito al pasar el cursor ([[R11]]). El árbitro en un jugador ya va por omisión.',
    items: ['R11'],
    pasos: [
      'El servidor árbitro en Node (`wss://`) y su conexión desde la página, con la vuelta sola al host si no contesta.',
      'Las tres opciones en el vestíbulo del sitio, con sus textos, y `&conexion=host|cloudflare|oracle` hasta el lockstep.',
      'Las pruebas: el banco con un servidor local de mentira, `prueba-sincro --directa` en cada modo, el sitio `mkw.test.cjs`.',
      'Los pasos para el dueño: `docs/publicar-oracle.md` (cuenta, región Santiago, VM ARM, puertos, dominio y Let’s Encrypt, systemd, las trampas).',
    ],
    listo: [
      'las tres opciones en el vestíbulo con su texto al pasar el cursor',
      'con el servidor de mentira, la misma carrera (huellas iguales), la vuelta al host al cortarlo y la traba de uno sin frenar a los demás',
      '`prueba-sincro --directa` en verde con cada modo',
    ],
    dueno: [
      'crear la cuenta de Oracle y la máquina (la tarjeta la pones tú)',
      'confirmar el PR del sitio (cada vez)',
    ],
  },
  {
    n: '7', nombre: 'El plan combinado: W10 primero, gráficos al final', duracion: 'semanas a meses (estimado)',
    objetivo: 'El dueño (2026-11-07): juntar el plan de Codex (CPU: [[W10]], [[W26]], [[W27]], [[W28]]) con los gráficos opcionales para los aparatos que frena la tarjeta (teléfonos y PC con gráficos integrados) ([[G11]]–[[G14]]): «lo importante al final es el gameplay». Corrección del mismo día: la tarjeta no frena (§173), así que primero [[W10]] y los gráficos quedan en prioridad baja. Se empieza después del reinicio semanal. Detalle en `docs/plan-combinado.md`.',
    items: ['W29', 'W26', 'V8', 'W27', 'W28', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G16b', 'W30', 'W31', 'W32'],
    pasos: [
      'El piloto chico: la memoria del wasm de tamaño fijo ([[W29]]), contra la revisión de límites de Android.',
      'Terminar [[W10]] (parte B): el dibujo en otro núcleo, el freno real (la CPU; la tarjeta trabaja ≈3 ms en el Oppo, §173), y la memoria para horas ([[W26]]).',
      'Repartir por partes los ~10 ms del lado CPU del dibujo ([[V8]]; lo de la tarjeta ya está medido).',
      'Condicionadas: [[W27]] si el dibujante pasa a ser el cuello; [[W28]] solo con un piloto que gane.',
      'Al final, en prioridad baja: los gráficos opcionales para un aparato que de verdad frene por la tarjeta ([[G11]], [[G12]], [[G13]]; [[G14]] solo si pesan los vértices).',
    ],
    listo: [
      '[[W10]] medido en la gama baja simulada y en este PC',
      'el lado CPU del dibujo repartido por partes',
      'una hora de sala con la memoria plana',
    ],
    dueno: [
      'confirmar el PR del sitio (cada vez)',
    ],
  },
  {
    n: '4c', nombre: 'Las mejoras chicas, juntas', duracion: '1–2 semanas (estimado)',
    objetivo: 'Pedido del dueño (2026-11-05): lo que dio +1 a +6 % y se descartó porque el ruido de la gama baja (±5 %) lo tapaba, medido junto en un paquete ([[W25]]). Una suma de +8 % sí sobresale del ruido. Preparada para después de E4b; no se ejecuta hasta que el dueño lo diga. El detalle en `docs/evaluacion-chicas.md`.',
    items: ['W25'],
    pasos: [
      'Pasar cada pieza (C2 texturas BC1, C3 funciones calientes, C4 memo ×4, C5 no releer r14–r31, C6 CR seguro, C7 `wasm-opt -O3`) a la base de E4b, con su interruptor de compilación y su arranque y fantasma iguales.',
      'El paquete entero con la igualdad completa: arranque 13/13, sala 75/75 con los dos programas, fantasma y foto iguales.',
      'El paquete contra la base, intercalados: gama baja simulada (tramo fijo, `--wasm-enforce-bounds-checks`, N8 apagado) y este PC; 2 pares si ≥ +8 % o ≤ −2 %, hasta 6 en la zona gris; se adopta con la media de 6 pares positiva y este PC sin perder más de 1,5 %.',
      'Opcional: sacar de a una solo las que tienen costo propio (C2, C5).',
      'El sello: PGO (C1) encima del paquete, con el perfil rehecho solo en cada `--final`, medido con la misma regla.',
    ],
    listo: [
      'cada pieza pasada a la base de E4b con su interruptor, y el paquete con las pruebas de igualdad completas',
      'el paquete medido contra la base en la gama baja simulada y en este PC, decidido con la regla del paquete',
      'PGO encima del paquete decidido, medido con la misma regla y con el perfil rehecho solo en `--final`',
    ],
    dueno: [
      'decir cuándo se ejecuta',
      'subir a R2 el `.wasm` nuevo si se adopta',
    ],
  },
  {
    n: 5, nombre: 'Las salas', duracion: '3–6 semanas',
    objetivo: 'Que la gama baja también juegue en la sala: un PC de la sala dibuja también la vista del teléfono y se la manda en video, y el teléfono solo muestra y manda sus botones ([[N11]]). Y lo que quedaba pendiente de la sala ([[R4]]). El árbitro y saltarse el dibujo ya están hechos (paso 11 viejo).',
    items: ['N11', 'R4'],
    pasos: [
      'El video desde un PC de la sala para el teléfono que no simula 60 ([[N11]]).',
      'El lockstep sin basura por cuadro ([[R4]]).',
      'La sala con el árbitro y uno como teléfono (emulación y el lastre de gama media): 3 carreras con la huella ampliada.',
    ],
    listo: [
      'un teléfono de gama baja simulado ve la carrera a 60 por video desde un PC de la sala, con la demora del botón a la imagen medida',
      'una traba de 1,5 s de un jugador les cuesta menos de 20 ms a los demás, con el árbitro (`prueba-relevo --trabas=8`)',
      'en este PC, un Chrome normal y otro como teléfono: 3 carreras con la huella ampliada igual',
    ],
    dueno: [
      'decidir si el árbitro queda por omisión',
    ],
  },
  {
    n: 6, nombre: 'La página liviana y la prueba final', duracion: '1–2 semanas',
    objetivo: 'Lo que quedó de los pasos 12 y 16 viejos que todavía rinde: el puente del sonido sin basura, decir en la página lo que no se puede, y la prueba que cierra todo: la escalera medida otra vez contra las metas de la versión 4, la sala de 12 con lo que hay y sesiones largas. Los mandos, el «modo juego» del sitio, el reloj del monitor, los avisos de ahorro y calor, y el dominio y el tope del Worker se descartaron en la poda del 2026-10-31.',
    items: ['P5', 'N12', 'V6', 'V7'],
    pasos: [
      'El puente del sonido con búferes reciclados y una sola llamada por entrega ([[P5]]).',
      'Decir en la página lo que no se puede, y avisar en la sala antes de largar a quien no simula 60 ([[N12]]).',
      'La escalera otra vez contra las metas de la versión 4; sesiones largas y la sala de 12 con lo que hay: varios Chrome (uno como teléfono) y consolas de mentira ([[V6]], [[V7]]).',
    ],
    listo: [
      'casi ninguna limpieza de memoria en un minuto de carrera',
      'cada escalón medido otra vez contra su meta de la versión 4',
      'la sala de 12 con su meta por escalón, sin esperas de más de 50 ms, y una hora de sala con la memoria plana',
      '`correr-todo` en verde',
    ],
    dueno: [
      'confirmar el PR (cada vez)',
    ],
  },
  {
    n: '✓', nombre: 'Lo ya hecho (versiones 1–3) y lo descartado en la poda', duracion: 'del 2026-10-27 al 2026-10-31',
    objetivo: 'Lo que se hizo o se descartó en esos cinco días, con su fecha y dónde se documentó en «Avance»: medir (los cuadros de lógica, el impuesto del navegador, el aparato de mentira y la escalera), que nada se trabe al cargar, que nada se baje en la carrera, la sala asíncrona (el árbitro y saltarse el dibujo sin cambiar la carrera), buena parte de la página liviana, la memoria rápida del motor (M1/M2), la subida a WiiCompiled v0.9.3 (N15) y no volver a subir lo que no cambia. Y lo que se probó y no ganó, que es lo que llevó a la versión 4: la IA en lo caliente, la FMA «punto medio», las pasadas del traductor. Al final, los 18 ítems que sacó la poda del 2026-10-31 (el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo»), cada uno con su porqué.',
    items: ['N15', 'H3', 'H4', 'N4', 'G9', 'P9', 'N15b', 'M9', 'D11', 'D10', 'M11', 'W18', 'P1', 'P2', 'U4', 'E1', 'E2', 'D7', 'D14','V5', 'V4', 'G8', 'V1', 'H1', 'H2', 'N1', 'N13', 'V2', 'V3', 'R5', 'R6', 'U3', 'E4', 'E5', 'C1', 'C4', 'C6', 'C7', 'C8', 'C10', 'D2', 'D6', 'D13', 'U1', 'D1', 'D3', 'D4', 'D5', 'D8', 'D9', 'D12', 'U2', 'C2', 'C3', 'C5', 'M8', 'M1', 'M2', 'N14', 'G3', 'H12', 'N9', 'G5', 'G2', 'G7', 'G10', 'H13', 'R3', 'R2', 'G1', 'R1', 'R7', 'R9', 'P3', 'P4', 'P6', 'P7', 'P8', 'R8', 'R10', 'E3', 'E6', 'C9', 'M3', 'M5', 'H8', 'H9', 'M4', 'M10', 'N5', 'N6', 'H10', 'N7', 'G6', 'G4', 'N10'],
    pasos: [
      'Medir: el informe con juego, espera y tarjeta; los cuadros de lógica; el impuesto del navegador (×2,45–2,63); el aparato de mentira y la escalera en el tramo fijo.',
      'La carga y las descargas: el precalentado con tope, el freno, el paquete de carrera, una versión por archivo; cero pedidos a la red con la carrera andando.',
      'La sala: el árbitro, la traba viva, la autoridad por capacidad y saltarse el dibujo sin cambiar la carrera.',
      'El motor: M1/M2 (+5,2 % en la gama baja); lo que no ganó (N14, la FMA «punto medio», las hojas en línea, la memo de indirectas, las banderas) quedó descartado con sus números.',
    ],
    listo: [
      'cada ítem con su fecha y dónde se documentó (bitácora §117–§193)',
    ],
    dueno: [],
  },
];

export const reglas = [
  'Nunca menos karts ni menos efectos para ganar fps: siempre 12 karts, en el PC, en el teléfono y en la sala. El rendimiento sale de optimizar el motor, aurora y la página. Dibujar a 30 con la imagen intermedia ([[N8]]) no saca nada: corren los 12 karts y se dibujan todos los efectos.',
  'El producto es siempre la página, nunca una app descargable; el programa nativo es solo un instrumento de medida.',
  'Nada que cambie la simulación sin la huella ampliada y los fantasmas: la sala y los fantasmas expertos de RR exigen los mismos bits en todos los aparatos, y los fantasmas tienen que seguir iguales bit a bit. Sin fast-math y sin SIMD relajado.',
  'Nada del juego entra a git ni se publica: el `.wasm`, el C++ traducido, `carreras.json`, `bloques.json` y los paquetes van solo a R2 privado, detrás del Worker. **Lo decompilado también**: es derivado del código de Nintendo igual que el traducido; vive en una carpeta ignorada (agregada a `.gitignore` antes del primer archivo), nunca a git ni publicado, y sale solo dentro del `.wasm` privado que sirve el Worker desde R2. El perfil de PGO lleva nombres del juego: tampoco a git.',
  'Cada piloto de la etapa 0 tiene un umbral de éxito y uno de corte escritos antes de empezar: si no pasa, se mata y no se discute.',
  'R2, el Worker, Firebase y el dominio los publica el dueño. PR y merge en Paginita-Pro solo con su confirmación, cada vez.',
  'Decompilar uno mismo (el C++ traducido, la memoria del juego corriendo, el desensamblado): se lee para entender y se escribe una implementación propia o un gancho; nunca se copia ni se publica.',
  'Medir antes y después de cada cambio con el mismo guion: si un cambio no se ve en los números, no se queda.',
  'Medir en la escalera: este PC de verdad (varios Chrome, y Chrome con la emulación de teléfono) y los demás escalones con el aparato de mentira ([[H1]]) en el tramo fijo (§163); los teléfonos simulados, con la revisión de límites de Android ([[W5]]); el Oppo ya no se mide (el dueño, 2026-10-31). Cada optimización se mide en la gama baja simulada y en este PC como control, intercalados. Una meta que solo se cumple en los más rápidos no está cumplida.',
  'La carrera no se reparte entre núcleos: lo que corre en otro hilo nunca escribe algo que la carrera lea ([[W1]], [[W10]]).',
  'Nada que no rinda (poda del 2026-10-31, el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo»): un ítem se queda solo si gana ~2 % o más del hilo del juego en la gama media o baja (medido o bien estimado), si otro ítem que se queda lo necesita para medirse, o si arregla algo que un jugador notaría (la imagen, la memoria, la sala). Lo que no rompe la sala ni los fantasmas pero no gana, no entra.',
  'Nada que agregue copias en línea sin un perfil que lo pida, ni reescrituras de a una función: ya se midió que pierden ([[N14]], [[M8]]).',
  'Cada paso con su prueba (banco o juego), documentado en `docs/bitacora.md` con el glosario y marcado en `PLAN.md` con fecha y hora. Las pruebas en Chrome van sin sonido y solo se cierran los procesos propios.',
];

export const decisiones = [
  '¿Qué meta para cada escalón de aparatos ([[N2]])? Propuesta de la versión 4 (estimada): PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados, al borde (si no entra, 60 de carrera con 30 dibujados y la imagen intermedia); teléfono de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC ([[N11]]). Siempre en la página, con 12 karts y todos los efectos.',
  '¿Va la etapa 4 (las islas decompiladas, meses de trabajo)? Se decide con los números de los pilotos [[W2]] y [[W3]] al terminar la etapa 0.',
  'El aparato de prueba es este PC (varios Chrome, y Chrome con la emulación de teléfono); el Oppo ya no se mide (el dueño, 2026-10-31); los demás escalones se simulan ([[H1]]). Opcional: si alguna vez alguien con un teléfono de gama media corre el informe (2 minutos), es el único dato que corrige la simulación.',
  'La puerta A: ¿el juego pasa a un Worker ([[N3]], [[P10]])? Es la base del dibujo en otro núcleo, que va sin memoria compartida ([[W10]], con la cinta de cajas de [[H5]]); el sitio sigue en GitHub Pages.',
  '¿Un cuadro más de demora (16,7 ms) a cambio de que el dibujo vaya en otro núcleo, un cuadro atrás ([[W10]])? Se mide con `mkwMedirDemora`.',
  '¿Ver por video a los teléfonos débiles en las salas que tengan un PC ([[N11]])? Cualquier teléfono a 60, con más demora.',
  '¿El árbitro queda por omisión cuando esté probado, o como opción? Suma 1–2 cuadros de retraso a cambio de que el lento no frene a nadie.',
  '¿Te parece bien el aspecto sin desenfoques en lo que va encima del juego (el descanso, el plano de la copa)?',
];

export const glosario = [
  ['Cuadro (frame)', 'una vuelta completa del juego: calcular y dibujar. A 60 fps hay 16,7 ms para cada una, como el período de una señal de 60 Hz.'],
  ['Pipeline', 'la «receta» ya compilada que la tarjeta de video usa para dibujar un material. Compilar una cuesta decenas de ms (en el teléfono, hasta 1 s), y el juego usa unas 900.'],
  ['Precalentado', 'compilar los pipelines antes de necesitarlos, como precalentar un horno.'],
  ['Proceso de GPU', 'el programa de Chrome que habla con la tarjeta de video. Es uno solo para todas las pestañas: como un transformador que alimenta todo el tablero.'],
  ['Lockstep', 'todas las consolas simulan lo mismo, cuadro a cuadro, con los mismos botones; avanzan juntas como relojes que solo dan el paso cuando todos lo dieron.'],
  ['Árbitro', 'una consola que decide los botones de todos en cada cuadro; las demás se enganchan a ella como un PLL a un reloj maestro.'],
  ['Rollback', 'correr adelantado y, si llegan botones distintos, volver atrás y recalcular. Exige guardar el estado entero varias veces por segundo.'],
  ['Determinismo', 'mismas entradas → exactamente el mismo resultado, bit a bit, en cualquier aparato.'],
  ['JSPI', 'lo que deja al juego (WebAssembly) pausarse para esperar a JavaScript (una descarga, los botones) sin perder su lugar.'],
  ['Fibra', 'un «hilo» del juego que en realidad se turna con los demás dentro de un solo hilo del navegador.'],
  ['GPU por baldosas', 'la tarjeta de los teléfonos dibuja la pantalla por cuadraditos en una memoria interna rápida; ir y volver a la memoria principal es lo caro.'],
  ['Ubershader', 'un shader general que dibuja cualquier material (más lento) mientras se compila el específico.'],
  ['Liftoff y TurboFan', 'los dos compiladores de WebAssembly de Chrome: uno compila rápido y el otro produce código más rápido.'],
  ['Limpieza de memoria (GC)', 'el navegador libera los objetos que ya no se usan; cada limpieza detiene el hilo un rato.'],
  ['Cubeta de fichas', 'un limitador de velocidad: cada byte gasta una ficha y las fichas se reponen a ritmo fijo.'],
  ['Paquete de carrera', 'todos los archivos que una carrera va a leer, bajados juntos antes de la cuenta.'],
  ['Document-Isolation-Policy', 'una cabecera que aísla una página (o un marco) en su propio proceso y le da memoria compartida, sin aislar todo el sitio.'],
  ['SFU', 'un servidor que reenvía: cada uno sube una sola vez y el servidor reparte a los demás.'],
  ['PGO', 'compilar guiado por un perfil: el compilador sabe qué partes son calientes y las ordena mejor.'],
  ['Huella', 'un resumen del estado de la carrera que las consolas comparan para saber si siguen iguales.'],
  ['Rango resuelto', 'un grupo de accesos a memoria con la misma base que el traductor ya calculó; hoy en wasm siempre cae al camino lento.'],
  ['Caché del borde', 'copias guardadas en el centro de datos de Cloudflare más cercano al jugador.'],
  ['Núcleo e hilo', 'un núcleo es un procesador dentro del chip; un hilo es una fila de trabajo que corre en uno. Hoy el juego es una sola fila: aunque el teléfono tenga 8 núcleos, usa uno.'],
  ['Worker', 'un hilo aparte que el navegador le da a una página. No toca la pantalla de la página, pero puede dibujar con WebGPU en un `OffscreenCanvas`.'],
  ['Memoria compartida', 'memoria que dos hilos leen y escriben a la vez (`SharedArrayBuffer`). El navegador solo la da a páginas aisladas.'],
  ['Impuesto del navegador', 'lo que cuesta de más correr el juego en WebAssembly dentro de Chrome, comparado con un programa nativo en el mismo aparato.'],
  ['Escalera de aparatos', 'seis aparatos de referencia, del más rápido al más lento, para medir y fijar una meta en cada escalón.'],
  ['Interpolación de cuadros', 'inventar un cuadro intermedio entre dos dibujados, con cada modelo a mitad de camino.'],
  ['App nativa', 'un programa compilado para el procesador del teléfono e instalado aparte: usa todas sus instrucciones y núcleos, sin el navegador en el medio.'],
  ['Puerta de decisión', 'un punto del plan donde se mide y se decide si seguir por un camino o tomar otro.'],
  ['Cuello de botella', 'la pieza más lenta de una fila: marca el ritmo de todo, como la resistencia más grande en un circuito en serie.'],
  ['Cuadros en vuelo', 'cuántos cuadros están a medio hacer a la vez. Con dos, la tarjeta dibuja uno mientras el procesador calcula el siguiente: trabajan en paralelo y no en serie.'],
  ['Presupuesto por pieza', 'cuántos ms puede gastar cada parte (cada hilo y la tarjeta), como el presupuesto de potencia de un diseño.'],
  ['Aparato de mentira', 'el PC frenado a propósito y en forma calibrada para que trabajen como un aparato más lento: una carga ficticia de banco de pruebas.'],
  ['Lastre', 'trabajo inútil agregado a propósito para simular un aparato más lento: en la CPU, esperar ocupado; en la tarjeta, repetir pasadas.'],
  ['Ladrón de caché', 'un hilo que recorre mucha memoria sin parar para sacar al juego de la caché grande, como si corriera en un procesador de caché chica.'],
  ['Caché del procesador', 'una memoria chica y muy rápida dentro del chip; lo que no está ahí se trae de la memoria grande, decenas de veces más lenta.'],
  ['Orden de los bytes', 'en qué orden se guardan los bytes de un número: la Wii pone primero el más grande, el PC y el teléfono el más chico. Pasar de uno al otro es «dar vuelta los bytes».'],
  ['FIFO de la Wii', 'la cola donde el procesador dejaba los comandos de dibujo para que el chip gráfico los leyera a su ritmo; la versión 3 la recupera entre dos hilos.'],
  ['Núcleos grandes y chicos', 'los teléfonos mezclan núcleos rápidos, para lo pesado, y lentos que gastan poco; la gama media suele tener 4 y 4.'],
  ['Factor de seguridad', 'diseñar con margen, como usar un componente al 70 % de lo nominal: la meta de 12 ms cubre lo que la simulación no copia.'],
  ['Piloto (con umbral)', 'una prueba chica y corta antes de la obra grande, con un número que la aprueba y otro que la mata escritos antes de empezar: como probar un prototipo antes de fabricar la serie (versión 4).'],
  ['Sumidero', 'una parte del programa que solo recibe: la carrera nunca lee lo que el dibujo escribe. Como un voltímetro: si se conecta mal marca mal, pero no cambia el circuito.'],
  ['Páginas sucias', 'los pedazos de 4 KiB de la memoria que se escribieron en un cuadro. Solo esos hay que mandarle al otro Worker: como un medidor por circuito que anota qué circuitos se usaron, sin mirar cada electrón.'],
  ['A1-s', 'el dibujo y la presentación en un segundo Worker con su propia copia del juego, un cuadro atrás, sin memoria compartida: la carrera le manda las páginas sucias en cajas. Pasa de dos resistencias en serie a dos ramas en paralelo.'],
  ['Isla (decompilada)', 'un subsistema entero (el dibujo, la colisión, la física del kart) reescrito en C++ propio con sus datos en el formato de la PC; solo habla con el resto del juego en su borde. Como cambiar un tramo de línea entero por cobre grueso.'],
  ['Borde de la isla', 'donde el código traducido y la isla se pasan datos; ahí sí se dan vuelta los bytes, pero una vez por consulta o por cuadro, no en cada lectura. Como el transformador entre dos tramos: tiene pérdidas, pero una vez.'],
  ['Decompilación funcional', 'reescribir lo que hace cada función como C++ normal que da el mismo resultado, bit a bit, aunque el código de máquina sea otro. Lo opuesto a la «matching», que busca los mismos bytes del disco.'],
  ['Revisión de límites', 'antes de cada acceso a la memoria, comprobar que la dirección cae dentro del espacio del programa. En el PC la hace gratis el sistema (páginas de guarda); Chrome en Android la hace con una instrucción cada vez: +16 %.'],
  ['Contexto de la CPU', 'el lugar donde el código traducido guarda los registros de la Wii entre una función y otra. Si vive en una dirección fija, se llega a él sin pasar un puntero.'],
  ['Banderas del CR perezosas', 'en vez de armar en cada comparación los bits de resultado que la Wii guarda, guardar el resultado y sacar el bit solo cuando alguien lo lee, como hace Dolphin.'],
  ['Render bundle', 'una lista de órdenes de dibujo de WebGPU grabada una vez y repetida en cada imagen casi gratis: como un programa grabado en una ROM en vez de dictar las órdenes a mano cada vez.'],
  ['Revisión de límites forzada (`--wasm-enforce-bounds-checks`)', 'una bandera de V8 que hace que este PC revise los límites como un teléfono Android; solo para medir.'],
  ['KartPad', 'otro proyecto que usa el mismo traductor (WiiCompiled) para correr Mario Kart Wii con Retro Rewind nativo en Android y Apple: dice cuánto tarda el código traducido sin el navegador en teléfonos de verdad.'],
  ['Ley de Amdahl', 'lo que no se toca pone el techo: si una resistencia en serie es el 20 % del total, aunque se la cortocircuite la corriente sube solo ×1,25.'],
];

export const fuentes = P(
  'Seis investigaciones del 2026-10-27, todas de solo lectura (no se corrió el juego): la carga y el proceso de GPU; las descargas y el disco; el multijugador asíncrono; el motor, aurora y la lista priorizada; la plataforma web (Chrome 156, Emscripten, V8, Dawn, Cloudflare, Firebase, WebRTC); y la auditoría del código de la página. Las mediciones citadas están en `build/web/datos/` y en `docs/bitacora.md` (§54, §62, §80, §85, §88, §93, §99–§104, §114–§115).',
  'Versión 2, el mismo día: la revisión honesta, leyendo el código traducido (`generated/build_shards`: las funciones hoja en línea y las llamadas «statefree» ya existen), la memoria en wasm (`runtime/include/guest_flat_memory.h` y `memory_access.h`: sin vista plana, todo acceso revisado), la interpolación de aurora (`lib/gx/frame_interpolation.*`) y la bitácora (§85, §113–§115). Las velocidades de un núcleo por escalón son aproximadas (de Geekbench 6) y hay que medirlas ([[N2]]).',
  'Versión 3, el mismo día: el acceso a memoria en wasm (`runtime/include/memory_access.h:356-410`), la multiplicación-suma exacta (`runtime/include/isa/ppc_isa_wasm_neon.h`), una función de matrices traducida (`generated/functions/func_80199D64.cpp`), la bitácora §115 (12 pasadas, 200–420 dibujos y 1,1–2,5 MB subidos por cuadro) y Document-Isolation-Policy (developer.chrome.com: Chrome 137 en el escritorio; en Android, sin confirmar, según la discusión de abril de 2025 en public-webapps del W3C). Los factores de la gama media (CPU ×3,5 y tarjeta ×5–8 del Oppo) son aproximados, de pruebas públicas (Geekbench 6, 3DMark Wild Life Extreme), y se calibran con el aparato de mentira.',
  'Versión 4, el 2026-10-31: cinco documentos del proyecto escritos ese día sin correr el juego, todos con cada número marcado como medido o estimado: `docs/techo-pasos.md` (el techo de lo que quedaba: ×1,5 realista), `docs/soluciones-motor.md` (el motor: la memoria, la pila, el contexto, las banderas, PGO, la revisión de límites de Android), `docs/soluciones-arquitectura.md` (el perfil de §160 reagrupado por partes del cuadro, el sumidero, A1-s y A2), `docs/soluciones-decompilacion.md` (las islas, el piloto de dos semanas y sus umbrales) y `docs/kartpad.md` (KartPad: el mismo traductor nativo en teléfonos reales, PGO −12 %, y tres arreglos de correctitud). Los números de la versión 4 por escalón son estimados y los confirman o los bajan los pilotos de la etapa 0.',
  'Fuentes externas principales: developer.chrome.com (Document-Isolation-Policy, WebGPU 121–146, ahorro de energía), v8.dev (caché de código wasm, compilación por niveles), dawn.googlesource.com, developers.cloudflare.com (Workers, R2, Durable Objects, Realtime SFU), firebase.google.com/docs/database/locations, gafferongames.com (lockstep determinista), web3dsurvey.com, decomp.dev/doldecomp/mkw y github.com/vabold/Kinoko.'
);

// Dónde se guarda lo del juego (pedido del dueño, 2026-11-08)
export const almacen = {
  intro: `Todo lo que el juego deja en el aparato vive **dentro de Chrome**, en el espacio de la página (nunca en carpetas sueltas del teléfono ni del PC). Hay dos memorias distintas: la del **disco** (queda guardada entre visitas, como un disco duro) y la **RAM** de mientras se juega (se vacía al cerrar la pestaña, como un condensador que se descarga). W26 trata de la segunda.`,
  filas: [
    ['Los archivos del juego (pistas, karts, música)', 'Cache Storage, la caja `mkw-disco:por-archivo`: pedazos de 256 KB juntados de a 2 MB, cada uno con la ruta y la huella de su archivo', 'Solo lo que se jugó: el disco entero son ~5 GB en R2, pero se baja por pedazos. Es lo que más ocupa y lo que el botón «Borrar los datos del juego» vacía entero'],
    ['El programa del juego (.wasm)', 'La caché HTTP de Chrome y su caché de código ya compilado', 'Unos 16 MB comprimido. Chrome lo maneja solo'],
    ['Partidas, trofeos y fantasmas', 'IndexedDB `mkw-partidas` (y una copia en la nube con tu cuenta)', 'Poco espacio, pero es lo valioso: nunca se borra junto con los mapas'],
    ['Las recetas de dibujo (pipelines)', 'IndexedDB `mkw-pipelines`', 'Para que la 2.ª visita no compile de nuevo. Se poda sola a las 8 visitas sin uso'],
    ['Las fotos de los Mii invitados', 'IndexedDB `mkw-invitados`', 'Solo de ese navegador'],
    ['Ajustes (gráficos, mandos, botones táctiles, listas)', '`localStorage` con nombres `mkw.*`', 'Unos KB'],
    ['VR, récords y fantasmas de la página', 'Firebase (la nube), no el aparato', 'No ocupa espacio en el aparato'],
    ['Mientras se juega', 'La RAM: 768 MB fijos del programa (W29), 16–64 MB de pedazos según la RAM del aparato (§138) y la memoria de la tarjeta de video', 'En el teléfono la tarjeta comparte la RAM con todo lo demás: por eso importa W26'],
  ],
  pcTelefono: `**PC y teléfono usan las mismas cajas**; cambia cuánto cabe. Chrome deja a una página usar hasta ~60 % del disco libre, así que en un teléfono con poco espacio el tope es mucho más chico. La página pide «almacenamiento persistente» al arrancar y al terminar cada carrera (§118): si Chrome lo da, no borra nada por su cuenta; si no, cuando falta espacio Chrome puede vaciar las páginas menos usadas (primero la caché, no hay aviso). El panel «Partida» dice si quedó protegido. Hoy se puede borrar todo de una vez (archivos del juego) o las partidas aparte; el borrado selectivo por pista está en diseño.`,
};
