# Arcade individual

Buscaminas (Minefall) y Snake (Neon Coil) se abren desde el vestíbulo, sin crear salas ni necesitar otro jugador. Reutilizan la cuenta y los controles de música existentes.

## Modos y clasificación

- Buscaminas: Explorador 9×9 / 10 minas, Veterano 16×16 / 40 y Leyenda 30×16 / 99. Clásico cuenta ocho vecinos; Táctico cuenta los cuatro de la cruz. El primer clic y los vecinos que cuenta su variante son seguros. No se garantiza que todo tablero sea resoluble sin adivinar.
- Snake: Clásico, Portales (bordes conectados) y Ruinas (obstáculos), con pasos de 180, 120 u 80 ms. Teclado, botones y gestos táctiles.
- Seis categorías de Buscaminas y nueve de Snake. Solo el mejor resultado de cada usuario y categoría ocupa la clasificación. En empate gana el menor tiempo activo.
- Buscaminas puntúa al completar: 100 × casillas seguras + máximo(0, 10.000 − décimas de segundo). Snake da 100 por comida. Una partida sin puntos no se publica.
- Pausa manual y automática al ocultar la pestaña; la pausa tapa el tablero y detiene el reloj. El ranking es recreativo: se calcula en el navegador y no constituye un sistema antitrampas con arbitraje de servidor.

## Persistencia

`soloRanks/<categoria>/<uid>` conserva nombre, puntos, tiempo y un identificador de partida. Las transacciones impiden que dos pestañas sobrescriban un récord mejor con uno peor. Cada usuario escribe únicamente su fila. Las reglas validan categorías, tipos, límites y mejora del récord; no pueden verificar cómo se jugó la partida en el navegador.

El récord personal se conserva además en localStorage, separado por cuenta y categoría. Un fallo de escritura ofrece reintento y al abrir de nuevo la categoría se intenta sincronizar el récord local. Las tablas individuales están también en Clasificación.

**Antes de publicar la página, desplegar `firebase/database.rules.json` en Realtime Database.** La edición del archivo en GitHub no publica esas reglas. Sin ellas, los juegos funcionan pero el ranking en línea mostrará un error y conservará el récord local.

## Validación

- `npm run test:juegos`: 13 pruebas, incluyendo 120 tableros de Buscaminas, primer clic seguro, banderas/acordes, colisiones/portales de Snake y regresiones.
- Comprobaciones de DOM simulado: inicio, pausa, victoria de Buscaminas y guardado, derrota de Snake, nueva partida y limpieza de escuchas.
- `npm run build`: compilación completa, conservando solamente los artefactos generados de Juegos.
- Prueba de Firebase aprobada: transacciones concurrentes, desempates, lectura y rechazo de escrituras ajenas o inválidas. `node tests/solo-firebase.cjs` con emuladores Auth 9099 y Database 9000, proyecto demo-solo: prueba de transacciones y reglas. Nunca se conecta a producción.

La inspección visual en navegador y la prueba táctil real siguen pendientes; el navegador de la sesión bloquea las vistas locales. La interfaz contempla anchos móviles y movimiento reducido.
