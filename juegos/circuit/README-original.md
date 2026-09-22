# Circuit Breakers — Overload Edition

Juego original de artillería por turnos con temática de ingeniería eléctrica. Abre **index.html** en un navegador moderno. Todo está incorporado en ese archivo, incluidos los cuatro fondos ilustrados: funciona sin instalación, conexión ni servidor.

## Partidas

- De 1 a 6 jugadores locales por turnos en un dispositivo. Puedes combinar jugadores y bots hasta completar 6 equipos; en solitario siempre hay al menos un bot.
- De 2 a 6 ingenieros por equipo, con 120 puntos de vida cada uno: hasta 36 personajes. Sus especialidades aportan identidad visual, sin modificar estadísticas.
- Bots con tres dificultades: Aprendiz, Ingeniero y Doctorado. Calculan trayectorias, consideran el riesgo para compañeros y usan todo el arsenal, reparación y desplazamiento.
- Cuatro campos de 3200 × 1200 unidades: Valle del reactor, Cordillera Boreal, Desierto de cobre y Puerto de tormenta. Terreno destructible, viento, agua, barriles explosivos y suministros.
- Turnos de 45 segundos: desplázate, salta y realiza una acción. Gana el último equipo con ingenieros vivos. Hay daño a compañeros y daño por caídas. El agua elimina; desde la ronda 12 su nivel sube para resolver los combates prolongados.
- Cámara con seguimiento, zoom, desplazamiento manual y minimapa. Animación de personajes, clima, partículas, humo, destellos, ondas de choque y explosiones encadenadas.

## Controles

| Acción | Control |
| --- | --- |
| Mover / saltar | A / D y W, o botones en pantalla |
| Apuntar | Arrastrar sobre el campo, flechas izquierda / derecha o deslizador |
| Potencia | Flechas arriba / abajo o deslizador |
| Elegir herramienta | 1–9 y 0, o botones del arsenal |
| Disparar / reparar | Botón de acción; mantener Espacio carga potencia y soltar dispara |
| Marcar ataque aéreo | Seleccionar Tormenta, pulsar el punto del campo y confirmar |
| Explorar | Arrastrar con botón derecho, central o Alt; pulsar el minimapa |
| Zoom | Rueda, botones + / − o gesto de pinza |
| Vista general / seguir ingeniero | Q / C o botones de cámara |
| Pausar | P / Escape o botón Ⅱ |
| Música y efectos | Botón ♫ y ajustes ⚙ |

45° apunta arriba a la derecha; 135°, arriba a la izquierda. También puedes apuntar hacia abajo. La interfaz admite controles táctiles; en teléfonos se recomienda orientación horizontal. En la vista general las etiquetas se simplifican para evitar superposiciones.

## Arsenal

| Herramienta | Funcionamiento | Munición inicial por equipo |
| --- | --- | --- |
| Bobina de arco | Proyectil balístico afectado por viento y gravedad | Ilimitada |
| Granada capacitor | Rebota y detona tras 2,8 segundos | 5 |
| Pulso electromagnético | Explosión amplia y fuerte empuje | 3 |
| Cañón de riel | Disparo recto, veloz; requiere línea de visión | 3 |
| Banco de capacitores | Se divide en cinco cargas | 3 |
| Mortero de inducción | Proyectil pesado de gran impacto | 3 |
| Cadena Tesla | Alcanza un enemigo a 285 unidades y encadena hasta tres | 3 |
| Taladro de plasma | Perfora hasta 130 unidades desde que entra al terreno | 3 |
| Tormenta de voltaje | Cinco descargas caen sobre el punto marcado | 2 |
| Estación de reparación | Recupera hasta 45 puntos de vida y termina el turno | 3 |

Los equipos de 5 o 6 ingenieros reciben el doble de munición finita. Los suministros permiten recuperar vida o munición.

## Música y arte

La banda sonora original se sintetiza con Web Audio: acordes ambientales, bajo, arpegios y percusión durante el combate. Se activa al desplegar la cuadrilla o interactuar con los ajustes, conforme a las restricciones de reproducción del navegador. Música y efectos tienen controles independientes. Las preferencias se guardan localmente cuando el navegador lo permite.

Los cuatro fondos son ilustraciones originales generadas con ImageGen. Personajes, terreno, iconos y efectos se dibujan con Canvas/SVG. Los prompts y archivos están documentados en **assets/README.md**. No se emplearon recursos ni canciones de Worms. Se respeta la preferencia del sistema de reducir movimiento.

## Desarrollo y comprobaciones

El código editable está en **src/**: `engine.js` contiene la simulación, `render.js` el dibujo y la cámara, `audio.js` el audio y `app.js` la interfaz. La física utiliza pasos fijos de 60 Hz, terreno en una máscara de píxeles y barrido de colisiones para proyectiles rápidos.

Reconstruir el archivo autónomo: `node build.cjs`.

Comprobaciones: `node tests/game.test.cjs` y `node tests/audio.test.cjs` (29 verificaciones del motor y 6 de audio). Cubren mapas, equipos, armas, colisiones, turnos, daño, suministros, victoria, dificultades y partidas simuladas completas de 36 ingenieros. Las pruebas de audio verifican programación, envolventes y controles; no sustituyen una evaluación auditiva.

Para servir una vista previa local opcional: `python -m http.server 8000 --bind 127.0.0.1` y abrir `http://127.0.0.1:8000/`.

La versión anterior se conserva en **archive/**. El multijugador es local; no incluye partidas en línea ni guardado de partidas en curso.
