// Acceso a Firebase (inicio de sesión con Google y descargas de Storage).
// El SDK se carga desde el CDN de Google solo cuando las canciones vienen de Firebase.
import { SITE } from './site.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let ready = null;

export function cloud() {
  ready ??= (async () => {
    const [appMod, authMod] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`)]);
    const app = appMod.initializeApp(SITE.firebase);
    const auth = authMod.getAuth(app);
    let appCheck = null, acMod = null;
    // App Check (reCAPTCHA v3) solo en la página publicada: la clave vale para paginita-pro.cl, no
    // para localhost. Para probarlo en local abre ?appcheck=debug y registra en la consola de Firebase
    // (App Check → Administrar tokens de depuración) el token que se imprime en la consola del navegador.
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const debug = new URLSearchParams(location.search).get('appcheck') === 'debug';
    if (SITE.appCheckSiteKey && (!local || debug)) {
      try {
        acMod = await import(`${SDK}/firebase-app-check.js`);
        if (local) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        appCheck = acMod.initializeAppCheck(app, { provider: new acMod.ReCaptchaV3Provider(SITE.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
      } catch (err) {
        console.warn('App Check no disponible', err);
      }
    }
    return { app, auth, authMod, appCheck, acMod };
  })();
  return ready;
}

// Usuario con sesión iniciada (espera a que Firebase recupere la sesión guardada)
export async function currentUser() {
  const { auth, authMod } = await cloud();
  await auth.authStateReady?.();
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const off = authMod.onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

export async function signIn() {
  const { auth, authMod } = await cloud();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await authMod.signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutCloud() {
  const { auth, authMod } = await cloud();
  await authMod.signOut(auth);
}

const objectUrl = (path) =>
  `https://firebasestorage.googleapis.com/v0/b/${SITE.firebase.storageBucket}/o/${encodeURIComponent(path)}?alt=media`;

// Descarga un archivo de Storage. onBytes(recibidos) se llama mientras llega.
export async function downloadPath(path, onBytes) {
  const { auth, appCheck, acMod } = await cloud();
  const user = auth.currentUser;
  if (!user) throw new Error('Inicia sesión para descargar canciones');
  const headers = { Authorization: `Firebase ${await user.getIdToken()}` };
  if (appCheck) {
    try {
      const t = await acMod.getToken(appCheck, false);
      if (t?.token) headers['X-Firebase-AppCheck'] = t.token;
    } catch {}
  }
  let res;
  try {
    res = await fetch(objectUrl(path), { headers });
  } catch {
    // si el navegador bloquea la petición directa, se intenta con el SDK (sin barra de progreso)
    return sdkDownload(path, onBytes);
  }
  if (res.status === 401 || res.status === 403) throw new Error('Firebase no da permiso para descargar (revisa las reglas de Storage)');
  if (res.status === 404) throw new Error(`No está en Firebase: ${path}`);
  if (!res.ok) throw new Error(`Firebase respondió ${res.status}`);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onBytes?.(buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    onBytes?.(got);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out.buffer;
}

async function sdkDownload(path, onBytes) {
  const { app } = await cloud();
  const st = await import(`${SDK}/firebase-storage.js`);
  const buf = await st.getBytes(st.ref(st.getStorage(app), path));
  onBytes?.(buf.byteLength);
  return buf;
}
