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
