# Mina Club y Snake Club

Se integran las versiones adjuntadas por el usuario el 21 de septiembre de 2026, conservando sus hojas de estilo, controles, música, efectos y animaciones. Se usan los archivos fuente separados; BUSCAMINAS.html era la distribución autocontenida del mismo Mina Club y no se duplica.

Las rutas existentes `#solo/minas` y `#solo/snake` abren estos juegos dentro de la página. Cada documento mantiene su diseño aislado; el adaptador de la aplicación conserva la autenticación y Firebase. Volver a Juegos, navegar a otra sección o cerrar sesión retira el documento del juego. Los controles de audio originales de cada juego sustituyen temporalmente a los generales.

## Rankings

- Mina Club: fácil, medio y difícil. Solo puntúan las victorias; menor tiempo activo es mejor. Internamente se usa puntos=1 y el desempate por tiempo de la clasificación existente.
- Snake Club: clásico, arcade y portales, cada uno con chill/normal/fast. Se conserva la puntuación original, incluidos poderes y combos; en empate, menor tiempo activo.
- Zen mantiene sus reglas indefinidas y su récord local, sin tabla competitiva.
- Las categorías usan `club-minas-*` y `club-snake-*`. Los récords anteriores siguen consultables como Archivo en Clasificación y no se mezclan con estas reglas distintas.
- Los récords y preferencias locales están separados por cuenta. Los récords de la nube se reflejan también en el marcador nativo de cada juego.
- La aplicación valida origen, ventana emisora, categoría y formato de cada resultado. Nombre y UID proceden de la sesión de la aplicación, nunca del mensaje del juego. El ranking sigue siendo recreativo, calculado en el navegador.
- Los resultados pendientes se guardan localmente, se reintentan al volver a entrar y tienen un botón de reintento. Firebase conserva el mejor resultado con una transacción.

## Publicación

Publicar `firebase/database.rules.json` en Realtime Database antes de integrar la página: se añaden las categorías Club sin retirar las antiguas. GitHub no publica estas reglas automáticamente. Se incluye el bundle de Juegos reconstruido y versionado; los demás artefactos se conservan intactos.

## Verificación

`npm run test:juegos` incluye las pruebas originales adjuntadas, las regresiones existentes y validación de categorías/resultados. Se comprobaron también en DOM simulado la victoria de Mina Club con envío único, la separación local por cuenta, validación de mensajes, reintento offline y limpieza del adaptador.

`tests/solo-firebase.cjs` amplía la prueba de emuladores con Mina Club (mejor tiempo), Snake Club (puntuaciones de Arcade) y rechazo de Zen competitivo. El workflow comprueba reglas y compilación. La revisión visual/táctil y escucha en un navegador real siguen pendientes.
