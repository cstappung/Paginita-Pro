# Firebase para Mario Kart: partidas en la nube

Qué hay que agregar en el sitio (repo `cstappung/Paginita-Pro`) para que las partidas viajen entre aparatos. **Lo
publica el dueño a mano** (como todas las reglas). Nada de esto se ha subido.

## 1. Regla de Storage (`firebase/storage.rules`)

Agregar este bloque dentro de `match /b/{bucket}/o { … }`, **antes** del `match /{allPaths=**}` final (que niega todo):

```
    // Mario Kart Wii: las partidas de cada persona (un solo objeto, el paquete .mkwp de guardado.mjs).
    // La carpeta lleva el uid: solo esa persona lo lee, lo sube o lo borra. Además el objeto debe decir su uid
    // (customMetadata.uid, como en projects/), no puede ser HTML/JS y tiene tope de 8 MB (hoy pesa pocos KB).
    match /mkw/{uid}/partidas.mkwp {
      function esSuyo() {
        return request.auth != null && request.auth.uid == uid;
      }
      allow read: if esSuyo();
      allow create, update: if esSuyo()
                            && request.resource.size < 8 * 1024 * 1024
                            && request.resource.metadata.get('uid', '') == uid
                            && !request.resource.contentType.matches('(?i).*(html|javascript|ecmascript).*');
      allow delete: if esSuyo();
    }
```

Por qué así:

- **El uid va en la ruta** (`mkw/{uid}/…`). Las reglas comparan la ruta con quien inició sesión, y no hace falta
  mirar metadatos viejos para saber quién es dueño (a diferencia de `projects/`, cuyo id es aleatorio).
- **`customMetadata.uid`** se exige igual, por coherencia con el resto del sitio.
- **Tope de 8 MB**: el paquete comprimido pesa unos KB (`rksys.dat` son 2,8 MB casi todos ceros). El tope evita que
  alguien use el bucket como disco gratis.
- **Nada de HTML/JS**: es la misma protección contra páginas de phishing servidas desde un dominio de Google.

Probarla antes de publicar: el emulador de Storage (`firebase emulators:start --only storage,auth`) con
`firebase.json` apuntando a `firebase/storage.rules`. Las mismas condiciones las imita el Storage falso de
`banco/pruebas/nube/` (23 puntos).

## 2. En la página del juego (`juegos/mkw/`, fase 5)

Con las piezas que ya usa el sitio (`juegos/hero/js/cloud.js`: SDK 10.12.2 del CDN de Google, inicio de sesión con
Google, App Check):

```js
import { cloud, currentUser } from '../hero/js/cloud.js';
import { crearGuardado } from './guardado.mjs';
import { crearNube, almacenFirebase } from './nube.mjs';

const user = await currentUser();                               // null si no inició sesión: todo queda local
let ultimo = 0, nube = { cambio() {} };                         // sin sesión: una "nube" que no hace nada
// subir solo cuando el guardado de verdad guardó algo (alCambiar también avisa al leer)
const guardado = crearGuardado({ alCambiar: e => { if (e.ultimoGuardado !== ultimo) { ultimo = e.ultimoGuardado; nube.cambio(); } } });
if (user) {
  const { app } = await cloud();
  const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
  nube = crearNube({ guardado, almacen: almacenFirebase({ st, storage: st.getStorage(app) }), uid: user.uid });
  await nube.alEntrar();                                        // ANTES de guardado.cargar()
}
const guardados = await guardado.cargar();                      // … y sigue como hoy (restaurar en preRun, vigilar)
document.addEventListener('visibilitychange', () => { if (document.hidden) nube.alEsconder?.(); });
```

Mostrar en la página: `nube.estado.accion` ("iguales", "bajada: …", "subida: …", "sin conexión…") y, si
`nube.respaldo` existe (hubo conflicto), un botón **"Descargar la otra versión"** con `nube.respaldo.blob`.

## 3. Lo que guarda la nube

| Metadato | Qué es |
|---|---|
| `uid` | quién lo subió (lo exige la regla) |
| `huella` | SHA-256 del contenido de las partidas: dos aparatos con la misma huella tienen exactamente lo mismo |
| `jugado` | hora del archivo más nuevo de la partida (cuándo se jugó): decide los conflictos |
| `actualizado` | cuándo se subió |
| `version` | formato del paquete (`1`) |

## 4. Récords de tiempo por pista y cilindrada (Realtime Database) — bitácora §57

Cada vez que termina una carrera, la página lee del juego el tiempo final, la pista y la categoría (modo + cc:
`tt150`, `tt200`, `vs150`, `vs200`, `vs500`, `vs100`, `vsespejo`) y guarda el mejor en el navegador. Si la persona
inició sesión, también en **Firebase Realtime Database** (la base que el sitio ya usa para las salas y los logros; el
sitio no usa Firestore, así que no hace falta activar nada nuevo): uno por persona y por pista+categoría.

```
mkw/records/{pista}-{cat}/{uid}
  uid, nombre (≤ 20), ms (número), pista ("10e"), cat ("tt150"), personaje, kart, version (1), at (hora del servidor)
```

La tabla de una pista = `orderByChild('ms').limitToFirst(10)` (pide `.indexOn: ["ms"]`, ya en la regla).

## 5. VR y BR de cada jugador (Realtime Database) — bitácora §59

Retro Rewind calcula su VR en cada consola y lo guarda en `RRRating.pul` (que ya viaja con la partida en la nube,
sección 1). Además la página lo guarda en Firebase, uno por persona, para que:

- en otro aparato, el juego reciba el VR de la cuenta **al entrar en línea** (lo pregunta con
  `/api/mkw_rr_ratings?pid=…` y nuestro WFC contesta con el de Firebase), aunque su archivo local sea viejo;
- la sala y las tablas del sitio puedan mostrar el VR de cada jugador.

```
mkw/vr/{uid}
  uid, nombre (≤ 20), vr (1..1 000 000), br (1..1 000 000), version (1), at (hora del servidor)
```

Tabla de VR: `orderByChild('vr').limitToLast(10)` (de menor a mayor: se da vuelta). Costo: 1 lectura al entrar + 1
escritura por carrera en línea en que cambie el VR.

## 6. Las reglas de las secciones 4 y 5 (`firebase/database.rules.json`, las publica el dueño)

Van dentro de `"rules"`, como un nodo `"mkw"` (ya están escritas en la copia del sitio, rama de trabajo):

```json
"mkw": {
  "records": {
    ".read": true,
    "$tabla": {
      ".indexOn": ["ms"],
      "$uid": {
        ".write": "auth != null && auth.uid === $uid && (!newData.exists() || !data.exists() || newData.child('ms').val() < data.child('ms').val())",
        ".validate": "newData.hasChildren(['uid', 'nombre', 'ms', 'pista', 'cat', 'version', 'at']) && newData.child('uid').val() === $uid && newData.child('ms').isNumber() && newData.child('ms').val() >= 5000 && newData.child('ms').val() <= 3600000 && newData.child('nombre').isString() && newData.child('nombre').val().length <= 20 && newData.child('pista').isString() && newData.child('pista').val().matches(/^[0-9a-f]{3}$/) && newData.child('cat').isString() && newData.child('cat').val().matches(/^(tt|vs)(150|200|500|100|espejo)$/) && $tabla === newData.child('pista').val() + '-' + newData.child('cat').val() && newData.child('at').val() === now",
        "personaje": { ".validate": "newData.isNumber()" },
        "kart": { ".validate": "newData.isNumber()" },
        "uid": { ".validate": true }, "nombre": { ".validate": true }, "ms": { ".validate": true }, "pista": { ".validate": true },
        "cat": { ".validate": true }, "version": { ".validate": "newData.isNumber()" }, "at": { ".validate": true },
        "$otro": { ".validate": false }
      }
    }
  },
  "vr": {
    ".read": true,
    ".indexOn": ["vr"],
    "$uid": {
      ".write": "auth != null && auth.uid === $uid",
      ".validate": "newData.hasChildren(['uid', 'nombre', 'vr', 'br', 'version', 'at']) && newData.child('uid').val() === $uid && newData.child('vr').isNumber() && newData.child('vr').val() >= 1 && newData.child('vr').val() <= 1000000 && newData.child('br').isNumber() && newData.child('br').val() >= 1 && newData.child('br').val() <= 1000000 && newData.child('nombre').isString() && newData.child('nombre').val().length <= 20 && newData.child('at').val() === now",
      "uid": { ".validate": true }, "nombre": { ".validate": true }, "vr": { ".validate": true }, "br": { ".validate": true },
      "version": { ".validate": "newData.isNumber()" }, "at": { ".validate": true },
      "$otro": { ".validate": false }
    }
  }
}
```

Qué cubre y qué no: nadie puede escribir el tiempo o el VR de otro, ni empeorar su récord, ni meter campos raros o
valores absurdos. **No** puede saber si el valor es honesto (la página corre en el navegador de cada uno). Si hace
falta, más adelante: validar en el Worker. El banco imita estas reglas (`banco/pruebas/records`, `banco/pruebas/vr`).

### En la página del sitio

La sala del sitio (`colabtex/src/juegos/mkw.js`) arma los dos almacenes con las funciones de `firebase/database` que
ya trae el sitio y se los pasa al marco del juego (misma página, mismo origen) **antes** de que entre en línea:

```js
import { ref, get, set, query, orderByChild, limitToFirst, limitToLast, serverTimestamp } from "firebase/database";
const rtdb = { ref, get, set, query, orderByChild, limitToFirst, limitToLast, serverTimestamp };
marco.contentWindow.mkwConectarRecords({ almacen: <como almacenRtdb de records.mjs>, uid, nombre });
await marco.contentWindow.mkwConectarVr({ almacen: <como almacenRtdbVr de vr.mjs>, uid, nombre });
```

Costo (plan gratis de Realtime Database: 10 GB al mes de descarga): una lectura de un nodo chico al entrar, una
escritura por carrera terminada que mejora, y 10 filas cada vez que alguien abre una tabla. Despreciable.
