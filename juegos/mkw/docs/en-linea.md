# En línea por Paginita Pro — diseño (bitácora §55)

Pedido del dueño: jugar en línea **por nuestra página, como BT3**: salas en Juegos (Firebase solo presenta a los
jugadores), la partida va directo entre navegadores (WebRTC). Y: **si alguien entra a una sala con una carrera en
curso, se le ofrece «Entrar en la siguiente carrera» o «Ir a la sala», y mientras tanto mira la carrera (espectador).**

## Cómo juega Mario Kart Wii en línea (y por qué sirve tal cual)

- Los consolas se encuentran por un servidor (Nintendo WFC antes; hoy **Retro WFC** para Retro Rewind, un fork de
  WiiLink WFC: github.com/Retro-Rewind-Team/wfc-server). Ese servidor hace el "matchmaking" (QR2, puerto UDP 27900),
  el inicio de sesión (NAS por HTTP, GPCM por TCP 29900) y la negociación de NAT (NATNEG, UDP 27901).
- **La carrera no pasa por el servidor**: cada consola le manda a cada otra paquetes UDP (malla), ~220 bytes cada 2
  cuadros, ~7 KB/s por enlace (mkwiiki.org/wiki/Network_Protocol). Son registros: HEADER, RACEHEADER, ROOM, SELECT
  (elegir pista, votar), RACEDATA (posición y botones de cada jugador), ITEM, EVENT.
- Es **sincronía de estado**, no de botones: cada consola corre su kart y comparte dónde está. No necesita que todas
  las máquinas calculen exactamente igual (bien para nosotros: el juego traducido en distintas CPU).
- **Entrar a mitad de carrera ya existe en el juego**: el recién llegado ve la carrera en curso ("vista en vivo") y
  corre desde la próxima votación. Es justo el modo espectador que pidió el dueño.

## Por qué no a Retro WFC directo

El navegador no habla UDP; Retro WFC bloquea redes de centros de datos y VPN (los relés quedarían bloqueados); un
Worker de Cloudflare solo abre TCP de salida. Jugar contra Wii de verdad no es posible desde una página.

## La arquitectura elegida: "WFC virtual" dentro de la sala

1. **Sockets de la Wii → JavaScript** (`network_socket.cpp` del runtime hoy usa sockets del sistema; en el wasm la
   red está apagada: `[network] enabled = false` en mkw.mjs, `network_ssl.cpp` fuera de la compilación). Se cambia por
   un "enchufe" hacia la página: cada jugador tiene una IP inventada (10.77.0.N).
2. **El UDP del juego viaja por WebRTC** (canales sin orden ni reenvío, como `malla.js` de BT3): el paquete de la
   consola 10.77.0.2 a la 10.77.0.3 va por el canal entre esos dos navegadores.
3. **Un servidor WFC chiquito en JavaScript**, en la pestaña de quien abre la sala: NAS, GPCM, QR2 y NATNEG mínimos
   (NATNEG contesta "conectados" enseguida: WebRTC ya los unió). Solo conoce a los de la sala. Se escribe desde el
   protocolo documentado (no se copia wfc-server, que es AGPL).
4. **Firebase** (como BT3) solo para la lista de salas y presentar a los jugadores (señalización WebRTC). TURN del
   Worker solo como último recurso.

Lo descartado: tocar las funciones de red internas del juego (frágil, código de Nintendo); "lockstep" de botones como
Dolphin/BT3 (MKW en línea es para 12, no pantalla partida; 3–6 cuadros de retraso a 60 fps; exige igualdad bit a bit).

## Entrar a una sala con la carrera andando

La sala en Firebase lleva `fase: sala | carrera` (la página la sabe mirando los registros SELECT/RACEHEADER que pasan
por su propio transporte, sin tocar el juego). Quien llega durante una carrera ve:

- **«Entrar en la siguiente carrera»**: arranca el juego y entra a la sala; el juego mismo lo pone de espectador (vista
  en vivo) hasta la próxima votación, y ahí corre.
- **«Ir a la sala»**: queda en la sala de la página (chat, lista de jugadores) mirando la carrera en video: el anfitrión
  manda su canvas (`captureStream`, como `bt3-directo.js`). Cuando la carrera termina, el botón cambia a «Entrar».

## Fases (cada una con su prueba en el banco, con jugadores falsos)

| Fase | Qué | Prueba en el banco |
|---|---|---|
| F0 | Sockets de la Wii hacia JavaScript (`red_web.cpp` + `red.mjs`), DNS sin hilos, SSL solo texto plano | dos "consolas" falsas en JS se mandan UDP/TCP de eco |
| F1 | WFC virtual en JS (NAS, GPCM, QR2, NATNEG instantáneo, el resto vacío) | un cliente falso con mensajes con la forma del protocolo |
| F2 | Transporte: Firebase + malla WebRTC (sin orden para UDP, ordenado para TCP) | Firebase/WebRTC imitados con BroadcastChannel, con retraso y pérdida |
| F3 | La sala en el sitio: crear/entrar, `fase`, «siguiente carrera / sala», video del anfitrión | Playwright con salas falsas y alguien que entra a mitad de carrera |
| F4 | Robustez: TURN, 12 jugadores, motivos de fallo en el chat | — |

Estado: diseño hecho; se empieza por F0. Es el trabajo más grande que queda (semanas, no horas).
