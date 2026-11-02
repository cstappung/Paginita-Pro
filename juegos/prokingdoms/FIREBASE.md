# Evaluación: Pro Kingdoms con Firebase

Los precios y cuotas son los de https://firebase.google.com/pricing a noviembre de 2026. Revísalos antes de decidir, porque Google los cambia.

## Lo que hay que saber primero

| | Spark (gratis, sin tarjeta) | Blaze (pago por uso, con tarjeta) |
|---|---|---|
| Realtime Database: conexiones simultáneas | **100 por base, compartidas con todo tu sitio** | 200.000 |
| RTDB: almacenamiento | 1 GB | 1 GB gratis, luego $5/GB al mes |
| RTDB: descargas | 360 MB/día (unos 10 GB/mes) | Lo mismo gratis, luego $1/GB |
| RTDB: escrituras y subidas | No se cobran | No se cobran |
| Cloud Functions (código en servidor) | **No disponible** | 2 M de invocaciones al mes, 400 K GB-s, 200 K CPU-s y 5 GB de salida gratis; luego unos $0,40 por millón |
| Hosting (archivos estáticos) | 10 GB guardados, 360 MB/día de transferencia | Lo mismo gratis, luego $0,15/GB |

**Conclusiones**:

1. **En Spark no se puede alojar ningún servidor de juego.** Hosting solo sirve archivos, y Functions y Cloud Run piden Blaze. "Servidor gratis y sin tarjeta" no existe en Firebase.
2. **En Blaze las cuotas gratis son las mismas que en Spark.** A escala chica la cuenta sale en $0, pero hay que registrar una tarjeta. Las alertas de presupuesto avisan, pero no cortan el gasto, así que hay que poner topes en el código (ver la Opción B).
3. **El límite de 100 conexiones de Spark es el verdadero riesgo.** Lo comparten tu sitio y el juego, y cada pestaña abierta con un listener cuenta como una conexión.

## Opción 0 (ya se puede, $0): publicarlo en modo local

El juego entero funciona sin servidor: los vecinos, el mercado y el gremio se simulan. Lo único que toca tu base de datos son las monedas, a través de `ProKingdomsPlatform`. No genera tráfico de juego: carga una vez unos 200 KB con gzip y no descarga nada más.

**Riesgo**: las monedas las suma el navegador. Ponles un tope diario en las reglas de la RTDB, para que un tramposo solo pueda sacar como mucho N monedas por día del juego. Un ejemplo de libro de monedas por usuario, que hay que adaptar a tu esquema:

```json
"pkLedger": { "$uid": {
  ".write": "auth != null && auth.uid === $uid",
  ".validate": "newData.hasChildren(['t','n']) && newData.child('n').isNumber() && newData.child('n').val() <= 300 && ((data.exists() && now - data.child('t').val() < 86400000) ? (newData.child('t').val() === data.child('t').val() && newData.child('n').val() >= data.child('n').val()) : newData.child('t').val() === now)"
}}
```

Se completa así: sube el saldo y el libro en **una sola actualización multiruta**. La regla del saldo exige que el saldo no crezca más de lo que creció `pkLedger/$uid/n`. En una escritura multiruta, `newData` ya ve el estado final de las dos rutas.

## Opción A ($0 en Spark): mundo compartido solo con la RTDB, sin servidor

Consiste en reescribir `js/net.js` para que lea y escriba la RTDB directamente, con transacciones entre navegadores, como hoy funciona tu sitio. Para que salga barato en descargas:

- **Nada de listeners permanentes.** Cada 30–60 s se hace `get()` de unos pocos nodos chicos y luego `goOffline()`. Así se libera la conexión y se esquiva el tope de 100. El chat usa `limitToLast(30)` solo mientras el panel está abierto.
- **Nodos chicos y separados**:
  - `worlds/$w/res/$zona` contiene `{quedan, t}`. La regeneración se calcula al leer a partir de `t`, sin tick.
  - `inbox/$uid` lleva un contador `v`, y solo se baja el buzón si `v` cambió.
  - Los precios del mercado se guardan en un solo nodo de unos 200 B.
- **El tick del servidor se reemplaza por cálculo perezoso**:
  - La regeneración y la deriva de precios son funciones del tiempo.
  - Los reinos bot son deterministas por semilla, igual que en modo local.
  - Un ataque o una oferta vencida los resuelve, con una transacción, el primer cliente que lo lee después de la hora.
- **Transacciones** para recolectar en zonas comunes, aceptar ofertas, ayudas y el tablón del gremio. Las **reglas** validan forma, tamaños y topes diarios.
- **Las partidas completas, de 10–20 KB, se suben gratis.** Solo se bajan al entrar.

**Consumo estimado**:

- Con sync cada 30 s, unos 120 pedidos de 1–2 KB por hora. Son unos 200–300 KB por jugador-hora, contando el gremio y el chat a veces.
- Los 10 GB/mes gratis alcanzan entonces para unas **35–50 mil horas de juego al mes**.
- Con el ritmo actual de 4 s sería unas 7 veces más.

**Contras**:

- Es el trabajo más grande. Hay que portar a cliente y reglas buena parte de `server/sim.js`, unas 1.000 líneas de lógica de mercado, gremio y conquista.
- **Se pierde casi todo el antitrampa**, porque las reglas validan formas y topes simples, no "lo que tu era permite". Un tramposo puede vaciar zonas comunes o inflar el ranking dentro de esos topes.
- Sigues limitado a 100 conexiones simultáneas en todo el sitio.

## Opción B (recomendada): tu servidor Node actual en Cloud Functions de 2.ª generación, con la RTDB como almacén

Casi no hay que reescribir. El cliente llama a `/api/*` en el mismo origen, y un *rewrite* de Hosting (`"/api/**" → función`) lo manda a la función. `js/net.js` no cambia. Los pasos son:

1. Convertir `server/index.js` en `onRequest` (el callback de `http.createServer` y `api(req, res, url)` ya son HTTP plano; solo se saca el `listen` y el servido de estáticos).
2. Reemplazar `server/store.js` por la versión con la RTDB del Admin SDK, con las mismas 9 funciones. `flush()` escribe cada pocos segundos solo lo que cambió, y escribir en la RTDB no se cobra.
3. Cambiar `setInterval(tick, 5000)` por un **tick perezoso**: en cada pedido, `avanzar(ahora − últimoTick)`, porque una función no corre entre pedidos.
4. Configurar `maxInstances: 1` y `concurrency: 80`. Así hay una sola copia del mundo en memoria, como hoy. En un arranque en frío se recarga el estado desde la RTDB, unos 60–200 KB que cuentan como descarga.
5. Subir `SYNC_MS` en `js/net.js` de 4 s a 15 s. El juego no lo nota, porque la recolección se acumula, y el gasto se divide por 4.
6. Usar `getPlayer().id`, o mejor el token de Firebase Auth, como identidad en `join`.

**Costo**:

- Con 15 s entre syncs, cada jugador-hora son 240 invocaciones. Con un mínimo facturado de unos 100 ms de CPU por pedido, la cuota gratis (2 M de invocaciones y 200 K CPU-s) alcanza para **unas 8.000 horas de juego al mes**. Eso equivale a unos 11 jugadores conectados las 24 horas, o unos 270 jugadores que juegan una hora al día.
- Pasado eso son **unos $3 por millón de pedidos**, más o menos 1 dólar cada 1.400 horas de juego.
- Hay unos centavos fijos por guardar la imagen del contenedor.

**Pros**:

- Conserva **todo el antitrampa** y las pruebas (`tools/cheat-test.js`).
- Las monedas se pueden mover al servidor después.
- No tiene el tope de 100 conexiones, porque no usa listeners.

**Contras**:

- Necesita una tarjeta en Blaze.
- El arranque en frío tarda 1–3 s cuando nadie jugó en un rato.
- `maxInstances: 1` alcanza para cientos de jugadores simultáneos. Para miles habría que separar los mundos.

**Freno de gasto recomendado**:

- `maxInstances: 1`.
- El límite de pedidos que ya trae `server/index.js`.
- Una alerta de presupuesto de $1–5.
- Si quieres un corte duro, una función que desactive la facturación cuando la alerta se dispara. Es el método oficial de Google Cloud.

## Variante: Cloud Run con `node server.js` tal cual

Es lo mismo que B, porque las Functions de 2.ª generación corren sobre Cloud Run, y tiene precios y cuota gratis parecidos. Sirve si prefieres desplegar el servidor completo en un contenedor, con escala a cero. Los cambios son los mismos: `store.js` pasa a la RTDB, el tick es perezoso y la instancia es una sola.

## Recomendación

1. **Ahora: Opción 0.** Publícalo en modo local, con las monedas conectadas a tu RTDB y el tope diario en las reglas. Cuesta $0 y no tiene riesgo de tráfico.
2. **Cuando quieras el mundo compartido: Opción B.** Activa Blaze con una alerta de presupuesto y `maxInstances: 1`, sube `SYNC_MS` a 15 s y pasa `store.js` a la RTDB. Lo más probable es que pague $0 hasta varios miles de horas de juego al mes y reutiliza el 95 % del código.
3. **La Opción A solo conviene si no hay forma de usar tarjeta.** Es más trabajo, deja menos protección contra trampas y queda atada al tope de 100 conexiones de Spark.

**Servir los archivos del juego**: el cliente pesa unos 200 KB con gzip. Hosting de Spark (360 MB/día) aguanta unas 1.800 cargas por día. Si tu página ya está en otro hosting o CDN, sírvelo desde ahí.
