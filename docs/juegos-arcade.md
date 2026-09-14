# Juegos: arcade, música, revancha y Órbita

Esta actualización renueva únicamente la sección de Juegos. Incluye cinco tarjetas ilustradas, mesa de cartas, fichas con volumen en Reversi, iluminación en Escondite y un tablero mejorado de Cuadritos.

La música generativa original tiene un tema por juego, volumen y silencio independientes de los efectos. Comienza tras una interacción durante la partida, se pausa con la pestaña oculta y se detiene al terminar o salir. Las preferencias se guardan en el navegador.

La revancha abre una sala nueva y deja una invitación en la partida anterior, conservando juego, cupo y tamaño. Solo pueden entrar participantes originales. La aceptación es explícita; dos peticiones simultáneas convergen mediante transacción, y la sala candidata sobrante se elimina. Una invitación pendiente permanece al cerrar la pestaña.

## Órbita

Duelo por turnos en un tablero de 6 × 6 estrellas de 1–5 puntos. Antes de capturar una estrella iluminada, se elige fila o columna: ese eje, pasando por la captura, limita el siguiente movimiento del rival. Si el eje queda vacío, puede elegir cualquier estrella libre. Tras 36 capturas gana quien tiene más puntos; puede haber empate.

La semilla define los valores. El registro define capturas, turnos y resultado. El motor ignora movimientos inválidos y congela el resultado final.

## Compilar y probar

Desde la raíz:

    npm ci --prefix colabtex
    npm run test:juegos --prefix colabtex
    npm run build --prefix colabtex

El workflow de esta rama ejecuta esas pruebas y compila el proyecto, conservando únicamente los artefactos publicados de Juegos. Su permiso de escritura se utiliza para guardar juegos-app.js y su versión en juegos.html en la rama codex/juegos-arcade-orbita. No despliega ni modifica main.

La prueba del motor cubre 100 partidas, empates, conservación de puntos, movimientos inválidos, apertura de órbita, abandono y el arranque de los cuatro juegos existentes. La implementación inicial también pasó pruebas con DOM simulado y emuladores de Firebase; tras recuperar el código se vuelve a comprobar el motor y la compilación. Sigue pendiente la revisión visual en escritorio/móvil y escuchar el audio en dispositivos reales.

## Publicación

1. Publicar el contenido completo de firebase/database.rules.json en Realtime Database, siguiendo firebase/CONFIGURAR-FIREBASE.md. El valor orbita y los vínculos origen/revancha requieren las reglas actualizadas.
2. Revisar y fusionar la propuesta en main para que GitHub Pages publique la sección.
3. Comprobar una partida y una revancha entre dos cuentas.

GitHub Pages no publica las reglas de Firebase. Estas son compatibles con los juegos anteriores y pueden publicarse antes del código.
