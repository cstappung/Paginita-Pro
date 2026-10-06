"use strict";
/* Inicialización de Firebase: Auth (Google), Realtime Database,
   Storage y Analytics (opcional). */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, connectAuthEmulator } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyDxarTG8KMwolWzdYT8eLwgX1wReQLF8Bc",
  authDomain: "mi-pagina-pro.firebaseapp.com",
  databaseURL: "https://mi-pagina-pro-default-rtdb.firebaseio.com",
  projectId: "mi-pagina-pro",
  storageBucket: "mi-pagina-pro.firebasestorage.app",
  messagingSenderId: "947244697252",
  appId: "1:947244697252:web:2dc1d514e89e25c7de0831",
  measurementId: "G-49FHCTY7B6"
};

export const app = initializeApp(firebaseConfig);

/* App Check: con él, la base y Storage solo atienden a peticiones que
   vienen de ESTA página en un navegador de verdad (reCAPTCHA v3, invisible),
   no a un script que copió la configuración de arriba — que es pública por
   diseño y no se puede esconder. Vacío = apagado. Para encenderlo:
   firebase/CONFIGURAR-FIREBASE.md, «App Check». Va antes de getDatabase y
   getStorage para que sus primeras peticiones ya lleven el sello. En
   localhost pide un token de depuración (sale en la consola la primera vez
   y se registra en la consola de Firebase); sin él, con App Check
   «aplicado», la vista previa local se quedaría sin base.

   La clave de sitio es pública por diseño (va en la página); la secreta
   vive solo en la consola de Firebase. El sello flotante de reCAPTCHA se
   esconde porque tapaba el botón ⚑ y la barra de pestañas del celular;
   Google lo permite si el aviso `AVISO_RECAPTCHA` se ve en el camino del
   usuario, y por eso va bajo cada botón de iniciar sesión. */
const APP_CHECK_SITE_KEY = "6LedGuEtAAAAAJil2UaHh3j8gCLGf0YP8O1Mo_Bc";
export const AVISO_RECAPTCHA = 'Este sitio está protegido por reCAPTCHA y se aplican la <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Política de privacidad</a> y las <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Condiciones del servicio</a> de Google.';
if (APP_CHECK_SITE_KEY && typeof window !== "undefined" && typeof document !== "undefined") {
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    const estilo = document.createElement("style");
    estilo.textContent = ".grecaptcha-badge{visibility:hidden!important}";
    document.head.appendChild(estilo);
  } catch (e) { console.warn("App Check no arrancó:", e); }
}
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

// Para pruebas locales con el emulador (solo en Node, nunca en el navegador)
if (typeof process !== "undefined" && process.env && process.env.FIREBASE_EMU) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}

// Analytics solo donde el navegador lo soporta (no rompe en localhost/file)
analyticsSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}
