// De dónde saca el juego las canciones.
//  - 'server':   el servidor de Node de este proyecto (npm start), lee las carpetas del disco.
//  - 'firebase': Firebase Storage; la página puede estar en GitHub Pages, sin servidor.
//  - 'auto':     usa el servidor si responde; si no, Firebase.
// Para probar Firebase desde el servidor local: http://localhost:8080/?fuente=firebase
export const SITE = {
  source: 'firebase',
  firebase: {
    apiKey: 'AIzaSyDxarTG8KMwolWzdYT8eLwgX1wReQLF8Bc',
    authDomain: 'mi-pagina-pro.firebaseapp.com',
    databaseURL: 'https://mi-pagina-pro-default-rtdb.firebaseio.com',
    projectId: 'mi-pagina-pro',
    storageBucket: 'mi-pagina-pro.firebasestorage.app',
    messagingSenderId: '947244697252',
    appId: '1:947244697252:web:2dc1d514e89e25c7de0831',
  },
  // la misma clave pública de App Check que usa paginita-pro.cl (colabtex/src/firebase.js)
  appCheckSiteKey: '6LedGuEtAAAAAJil2UaHh3j8gCLGf0YP8O1Mo_Bc',
  // carpeta del bucket donde se subió songs_save (con su library.json)
  storageRoot: 'hero/songs_save',
  // tamaño máximo de la caché de canciones en el navegador
  cacheMB: 800,
};

let resolved = null;

export async function songSource() {
  if (resolved) return resolved;
  const forced = new URLSearchParams(location.search).get('fuente');
  if (forced === 'firebase' || forced === 'servidor') return (resolved = forced === 'servidor' ? 'server' : 'firebase');
  if (SITE.source !== 'auto') return (resolved = SITE.source);
  try {
    const res = await fetch('api/library', { cache: 'no-store' });
    resolved = res.ok && (res.headers.get('content-type') || '').includes('json') ? 'server' : 'firebase';
  } catch {
    resolved = 'firebase';
  }
  return resolved;
}
