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

## Qué se hace una vez dentro de Retro WFC: el bucle de juego (investigación, 2026-10-19)

Pedido del dueño: «se te olvidó agregar la investigación de qué se hace una vez estás dentro de Retro WFC y cómo es el
gameplay loop». Esto es lo que hace el modo en línea de Mario Kart Wii con Retro Rewind, paso a paso. Marcas: **[S]**
seguro (con su fuente), **[I]** deducido por nosotros, **[NE]** no encontrado. Fuentes: mkwiiki.org (la antigua wiki de
Tockdom), el código público de Retro Rewind (github.com/Retro-Rewind-Team/Pulsar, GPL-3.0: solo se lee, no se copia),
mariowiki y purenintendo. rwfc.net no se pudo leer (403).

**El bucle, en una línea:** entrar → buscar sala (o crearla) → elegir personaje y kart + votar pista (con reloj) →
ruleta → carrera (máx. 5 min) → puntos y VR → otra votación… sin fin, hasta que uno se va.

| Paso | Qué pasa | Fuente |
|---|---|---|
| 1. Entrar | Menú Wi-Fi: «Mundial», «Continental» o «Amigos». En línea solo hay VS y Batalla (no Gran Premio); hasta 12 jugadores. | [S] purenintendo, mariowiki |
| 1b. Los botones de RR | Mundial separado por tipo de pista: **Retro Tracks**, **Custom Tracks**, **Regular Tracks** (100 % originales desde v6.12.0); en «Otros»: **200cc**, **Online TT**, **Item Rain**; batalla: **Globos** y **Eliminación**. Cada botón muestra cuánta gente juega. | [S] Pulsar `UI/PlayerCount.cpp`, mkwiiki Retro_Rewind |
| 2. Buscar sala | El juego base solo junta salas cuyo anfitrión está a ≤ 2500 VR (1500 con VR bajo). RR ordena las salas por cercanía de VR (`diferencia×32 − jugadores`), descarta las llenas y las que están 40 000 VR por encima, no te devuelve a la sala de la que saliste y busca 20 s. Si no encuentra, **creas la sala y eres el anfitrión** [I]. | [S] mkwiiki VR, Pulsar `Network/Matchmaking.cpp` |
| 2b. Llegar con la carrera andando | Se **mira la carrera en curso** (espectador) hasta la siguiente votación. | [S] purenintendo, mkwiiki («150cc Spectating») |
| 2c. Cortes cortos | Si alguien se corta, su lugar se guarda 2 s («Phantom Racer»: un hueco, no un bot). | [S] Pulsar `Network/PhantomRacer.cpp` |
| 3. Elegir y votar | Con un **reloj**: elegir personaje, vehículo y derrape, y votar una pista (o «Random»). Valores de fábrica del reloj en un código de trucos: 10 s el emparejamiento y **30 s la votación** [I: 0x41200000 y 0x41F00000 como números con decimales]. El anfitrión manda la información de la sala (fase, pista ganadora, cc) y los demás la copian. | [S] mariokartwii.com tid=637, Pulsar `Network/PulSELECT.cpp` |
| 3b. Entre carreras (RR) | Pantalla con **Random**, **Change** (volver a elegir personaje/vehículo/derrape) y **Settings**, con el mismo reloj. Si no votas, cuenta como «Random» [I]. | [S] Pulsar `UI/ChangeCombo/ChangeCombo.cpp` |
| 4. Ruleta | Sale **al azar uno de los votos** (todos con la misma probabilidad). En RR: «Random» = una pista al azar; los votos por pistas bloqueadas (repetidas hace poco: «repick», 8 carreras) no cuentan; tras una pista regular no puede salir otra regular. «Instant Voting Roulette Decide» se salta la animación. | [S] mkwiiki Network_Protocol/SELECT, Pulsar `PulSELECT.cpp` |
| 5. cc | Juego base, Mundial: al azar según el VR de la sala (con VR bajo, 100 % 100cc). RR: «10 % 100cc, 65 % 150cc, 25 % Espejo». | [S] mkwiiki VR, comentario en `PulSELECT.cpp` |
| 6. Carrera | Máximo **5:00**; toda la vuelta (cuenta + carrera + marcadores) 6:00. Cuando llega el primero, los demás tienen un tiempo para terminar (30 s [I]). Objetos normales, 3 vueltas casi siempre [I]. RR: Mega Cloud en el Mundial. | [S] mkwiiki Online_Time_Limit, Network_Protocol |
| 7. Puntos y VR | Puntos por puesto 15/12/10/8/7/6/5/4/3/2/1/0. VR de RR: contra cada rival +1…+24 o hasta −19; máximo +264 por carrera; bajo 15 000 VR se pierden 50 como máximo; salir con la pausa cuesta −209; fines de semana ×1,5. El 1.º nunca pierde y el último nunca gana (juego base). | [S] mariowiki, Pulsar `Network/Rating/PlayerRating.cpp`, mkwiiki |
| 8. Otra vez | En el Mundial las carreras siguen sin fin (VR → votación → carrera) [I]. | — |

**Salas de amigos** (lo más parecido a «una sala de la página»): el anfitrión arranca VS, VS por equipos, Globos o
Monedas; hay 60 frases de chat. RR le da al anfitrión ajustes [S, Pulsar `Settings/SettingsParam.hpp`]: cc (normal, 150,
100, 500 o a medida), espejo, **carreras por GP (2, 4, 8, 12, 24, 32 o 64; el juego base 4 [I])**, restricción de
personajes y vehículos, objetos (normal, al azar, Item Rain, sin objetos…), qué pistas (Retro, Custom, todas,
Regulares), «Host Always Wins», KO y equipos extendidos; puede echar jugadores, y los demás ven sus ajustes antes de
votar (v6.12.0).

**CPU en línea:** **[NE]** ninguna fuente las menciona, ni en el juego base ni en RR; las carreras en línea son solo entre
personas. Rellenar con CPU sería un invento nuestro (el dueño lo pidió, ver «La CPU de relleno» abajo; el 2026-10-19 lo
dejó como opcional: primero el Retro WFC tal cual por la página).

**Qué tomamos para la página** (decisión 2026-10-19): el modo en línea es el del juego (Retro WFC), corriendo por
nuestro WFC virtual dentro de la sala, y entrando **directo por código** (sin cortina ni botones apretados por detrás).
Después, tres modos de sala: **1) Retro WFC original** (el bucle de arriba: votar → carrera → VR, sin fin),
**2) Modo copa** (como la sala de amigos: N carreras con puntos 15/12/10…, cc y objetos del anfitrión) y
**3) Modo playlist** (la cola de pistas de `sala.mjs`, con 45 s para elegir personaje y kart antes de cada una).

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

Estado (2026-10-18):

| Fase | Estado |
|---|---|
| F0 sockets | ✅ `web/red/red_web.cpp` + `red.mjs` (bitácora §58) |
| F1 WFC virtual | ✅ `wfc.mjs` + `wfc-salas.mjs`: dos pestañas se encuentran y corren 3 carreras seguidas (§58) |
| F2 transporte | ✅ malla WebRTC + router, buzón intercambiable (`malla.mjs`, banco `red` 20/20, §59) |
| F3 sala en el sitio | 🟡 ✅ sala con vestíbulo, hasta 12, entrar con la carrera andando (§60); ✅ CPU de relleno con la carrera sincronizada (abajo, §61–63); ⬜ cola de pistas y «Confirmar» sobre la votación; ⬜ video del anfitrión para los que miran |
| F4 robustez | ⬜ TURN del Worker, más jugadores, motivos de fallo en el chat |

**La CPU de relleno: carrera sincronizada (lockstep).** Arriba se descartó el lockstep para el VS en línea de 12. Pero
el juego en línea no anima CPU de otra consola (§58.5), y la CPU de relleno es obligatoria (pedido del dueño). Por eso,
**con CPU de relleno y hasta 4 humanos** (los 4 puertos del mando de GameCube) la sala no usa el WFC: cada consola corre
la misma «copa a tu gusto» offline (12 karts, con la misma semilla y las mismas pistas) y la malla reparte los botones
de cada cuadro (`lockstep.mjs`, `pad_web.cpp`, `lockstep_nativo.cpp`). Con más de 4 humanos se corre en línea, sin CPU.
**El VR solo se mueve en línea** (decisión del dueño, 2026-10-18): la carrera sincronizada no lo toca.

Lo que falta está en `PLAN.md` (etapa C).
