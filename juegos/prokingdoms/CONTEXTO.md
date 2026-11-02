# Pro Kingdoms: contexto para integrarlo en tu página

Es un juego de reinos isométrico en pixel art, hecho con JavaScript puro y sin dependencias. Todo el arte se genera por código al arrancar, así que no hay imágenes que cargar. El cliente pesa unos 0,75 MB, unos 200 KB comprimido con gzip.

Hay dos modos:

- **Local**: el juego completo funciona sin servidor. Los demás reinos, el mercado y el gremio se simulan en el navegador y la partida se guarda en `localStorage`.
- **En línea**: se activa si en el mismo origen responde `/api/*`. Agrega un mundo compartido (zonas comunes, mercado entre jugadores, gremios, chat, conquista y ranking).

Si `/api/join` falla, el juego entra solo en modo local. Por eso se puede publicar **hoy** como juego de un jugador y sumar el modo en línea después.

## Archivos

| Ruta | Qué es |
|---|---|
| `index.html` | Página del juego: un `<canvas>`, el HUD y la lista de scripts en orden. Usa la fuente Pixelify Sans de Google Fonts. |
| `css/style.css` | Interfaz, incluidos el modo celular vertical y horizontal |
| `js/util.js` | Utilidades: `PK.U`, RNG con semilla y `U.store`, un envoltorio de `localStorage` |
| `js/data.js` | **Todo el balance**: recursos, edificios, eras, técnicas, misiones, decretos, eventos |
| `js/sprites.js` | Arte pixel procedural de edificios por nivel, aldeanos, terreno e íconos |
| `js/world.js` | Mapa por semilla, zonas, A* y regeneración. Lo usa también el servidor. |
| `js/entities.js`, `js/auto.js`, `js/life.js` | IA de aldeanos, capataz y cola de obras, lobos y eventos |
| `js/game.js` | Estado (`PK.Game.state`), construcción, eras, investigación, guardado y progreso offline |
| `js/terr.js`, `js/logistics.js`, `js/defense.js`, `js/expeditions.js` | Parcelas y conquista, carretas y caminos, murallas, expediciones |
| `js/social.js` | Mercado, gremio y **puente con tu página** (`PK.Platform`) |
| `js/net.js` | Cliente en línea. **Todo el tráfico pasa por una sola función, `Net.api(method, url, body)`.** |
| `js/quests.js`, `js/notify.js`, `js/sfx.js` | Misiones y racha, avisos, sonido |
| `js/render.js`, `js/input.js`, `js/ui.js`, `js/main.js` | Dibujo, controles de mouse y táctiles, interfaz, arranque |
| `server.js`, `server/` | Servidor Node opcional, sin dependencias (ver más abajo) |
| `tools/cheat-test.js` | Prueba automática del antitrampa del servidor |

## Cómo meterlo en tu página

1. Copia `index.html`, `css/` y `js/` a una carpeta de tu sitio, por ejemplo `/juegos/pro-kingdoms/`. Las rutas son relativas.
2. Lo más simple es mostrarlo en un `<iframe>` a pantalla completa. Si lo cargas dentro de tu propia página, el `<canvas id="game">` y los `div` `#hud`, `#vignette` y `#loading` tienen que existir, y el CSS ocupa toda la ventana.
3. **Antes** de los scripts del juego, define `window.ProKingdomsPlatform`. El lugar ya está marcado con un comentario en `index.html`. Cualquier función que no definas usa la versión local (`localStorage`).

```html
<script>
window.ProKingdomsPlatform = {
  getPlayer() { return { id: miUsuario.uid, name: miUsuario.nombre }; },
  getCoins() { return misMonedas; },                 // síncrono: guarda un valor en caché
  addCoins(n, reason) {                              // n puede ser negativo. reason: 'pro-kingdoms', 'wonder', 'guild-event', 'guild-stage', 'guild-need', 'guild-help'
    misMonedas += n;                                 // actualiza la caché al instante
    sumarMonedasEnTuRTDB(n, reason);                 // transacción en tu base
    window.dispatchEvent(new CustomEvent('pk:coins', { detail: { coins: misMonedas, delta: n, reason } }));
    return misMonedas;
  },
  spendCoins(n, reason) {                            // 'speedup' o 'streak-repair'. Devuelve true o false.
    if (misMonedas < n) return false;
    return this.addCoins(-n, reason), true;
  },
  reportStat(key, value) {},                         // 'era' y 'upgrades', para logros o ranking de tu sitio
  scheduleNotifications(list) {},                    // opcional: [{at, title, body}] para avisos push al salir
};
</script>
```

- El HUD escucha el evento `pk:coins` para refrescar el contador de monedas. Dispáralo también si las monedas cambian fuera del juego.
- `getPlayer().name` es el nombre que ven los demás jugadores.
- Para el modo en línea, conviene que `join` use `getPlayer().id` como identidad en vez del token que genera hoy (ver `FIREBASE.md`).

**Claves de `localStorage` que usa el juego**:

- `prokingdoms_save_v2`: la partida.
- `pk_token`: la identidad en línea.
- `pk_site_coins`: las monedas, solo si no defines la plataforma.
- `pk_player_name`: el nombre del jugador.

Con `?perfil=x` en la URL, cada clave lleva el sufijo `_x`.

**Parámetros de URL útiles**:

- `?local`: fuerza el modo local.
- `?dev`: abre el panel de pruebas en Opciones, con velocidad ×5 o ×20, recursos y simulación offline.
- `?perfil=ana`: usa otra identidad en el mismo navegador.

## Servidor opcional (modo en línea)

```bash
node server.js
```

El servidor queda en el puerto 8080 (`PORT` lo cambia) y sirve el juego y la API.

- Guarda en `server/data/`. `PK_DATA` lo cambia.
- `PK_TRUST_PROXY=1` hace que use `X-Forwarded-For` para saber la IP del jugador cuando hay un proxy delante.

| Archivo | Contenido |
|---|---|
| `server/index.js` | HTTP y rutas. Límite de pedidos por IP y por token, que devuelve 429 sin perder nada. |
| `server/sim.js` | Lógica. Carga `js/util.js`, `js/data.js` y `js/world.js` en una VM (el mismo mapa que el cliente) y ejecuta un tick cada 5 s para regeneración, bots, mercado y ataques. |
| `server/store.js` | **El único módulo que toca el disco.** Funciones `get`, `set`, `del`, `all`, `touch`, `flush`, `getSave`, `setSave`, `delSave`. |

**Protocolo**: JSON, con el token en la cabecera `X-PK-Token`. El cliente hace `POST /api/sync` cada 4 s (`SYNC_MS` en `js/net.js`).

- **Envía**: lo recolectado en zonas comunes, las operaciones de mercado y una foto del reino.
- **Recibe**: solo lo que cambió, más el buzón.

La partida completa se guarda con `POST /api/save` cada 60 s y al cerrar.

**Rutas**:

- `join`, `sync`, `save`
- `offers` (`/accept`, `/cancel`)
- `guilds` (`create`, `join`, `leave`, `contribute`, `chat`, `event`, `ask`, `help`, `need`, `need/send`)
- `world/chat`
- `claim`, `conquer`, `conquer-bot`
- `ranking`, `status`

**Antitrampa**: el servidor limita todo lo que afecta a otros jugadores. Eso incluye:

- la recolección, con una cubeta de tiempo real;
- los recursos, la era, el ejército y la defensa, comparando cada foto con la anterior;
- el mercado, las ofertas, los aportes y ayudas del gremio, y las campañas.

Lo que excede los topes **se recorta y se registra** en `server/data/sospechas.log`. La prueba `node tools/cheat-test.js` tarda unos 40 s y no toca los datos reales.

**Lo que no se valida todavía**:

- Lo que pasa dentro de cada reino (obras, investigaciones, misiones) es del cliente.
- **Las monedas de tu sitio las suma el cliente** con `addCoins`. Si las monedas tienen valor real, hay que ponerles un tope en tu backend o en las reglas de tu base de datos (ver `FIREBASE.md`).
- No hay autenticación: el token es la cuenta. Conéctalo con las cuentas de tu página.

## Dónde tocar

- **Balance** (costos, tiempos, recompensas): `js/data.js`.
- **Monedas que regala el juego**:
  - `game.js`: premios con `coins` y la maravilla, que da 10 × nivel.
  - `social.js` y `net.js`: eventos, etapas, ayudas y el tablón del gremio.
- **Cambiar de backend**:
  - Del lado del cliente basta con reemplazar `Net.api`.
  - Del lado del servidor, `server/store.js`.
