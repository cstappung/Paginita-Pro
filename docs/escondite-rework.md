# Escondite · Atlas

Rework de Escondite sobre la sección arcade integrada en main.

- Escenas reproducibles de cinco ambientes, con 330 elementos, senderos y 150 visitantes.
- Seis colores de ropa compartidos con la multitud. El objetivo lleva gorra y bandolera crema; la pista de búsqueda indica su ropa.
- Cobertura parcial por elementos próximos: puede ocultar las piernas, pero nunca la cabeza. Colocación libre con márgenes seguros.
- Zoom 1×, 1,5×, 2× y 3× con desplazamiento táctil. Flechas y Enter para colocar/buscar mediante teclado.
- Noventa segundos para esconderse. El reloj comprueba la colocación automática sin depender de nuevas escrituras de Firebase.
- Bloqueo inmediato de intentos concurrentes, recuperación de la penalización al recargar y reintentos de red espaciados.
- Fondo prerenderizado para no redibujar 480 elementos en cada actualización del reloj.
- Midnight Pulse, aportada por el usuario, se reproduce en bucle exclusivamente en Escondite. Respeta volumen, silencio, interacción inicial y pausa de pestaña. Selección provisional porque se adjuntaron tres pistas sin identificar una.

## Validación

`npm run test:juegos` pasa nueve pruebas: incluye escenarios deterministas, persistencia de ropa, fases y resultado de Escondite, regresión de otros juegos y ciclo de vida del audio con un reproductor simulado.

`npm run build` completado; solo se conservan los artefactos de Juegos. El MP3 se incluye sin modificar.

Pendiente: prueba visual y táctil en navegador, escucha real de la pista y partida completa entre dos dispositivos. El navegador disponible bloqueó la vista local con ERR_BLOCKED_BY_CLIENT. Las pruebas del audio validan el control del reproductor, no la escucha ni la continuidad audible en el punto de repetición.

No cambia las reglas de Firebase. Los campos nuevos de ropa son compatibles con su esquema actual. Las partidas antiguas sin ropa usan Musgo. Los jugadores deben recargar para usar la misma versión de la escena. El juego sigue siendo entre amigos: el navegador recibe las coordenadas que necesita dibujar; no ofrece protección frente a inspección de herramientas de desarrollo.
