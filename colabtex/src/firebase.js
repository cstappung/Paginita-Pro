"use strict";
/* Inicialización de Firebase: Auth (Google), Realtime Database,
   Storage y Analytics (opcional). */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, connectAuthEmulator, getAdditionalUserInfo } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAnalytics, logEvent, isSupported as analyticsSupported } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

/* La app de la pantalla de inicio del iPhone (`navigator.standalone`) no
   puede iniciar sesión con la ventana emergente: iOS la abre en otro
   contexto, Google termina allí y la ventana nunca vuelve a la app. Ahí se
   inicia por redirección (`loginGoogle`), y para que Safari deje leer el
   resultado al volver, el ayudante de Firebase (`/__/auth/…`) se sirve
   desde el mismo dominio del sitio: lo copia el flujo
   `.github/workflows/auth-firebase.yml` y `authDomain` pasa a ser
   paginita-pro.cl. Con firebaseapp.com el resultado vive en almacenamiento
   de terceros, que Safari parte por sitio, y la redirección volvía sin
   sesión. Requiere `https://paginita-pro.cl/__/auth/handler` entre las
   URI de redirección del cliente OAuth (firebase/CONFIGURAR-FIREBASE.md).
   En el resto de navegadores todo sigue igual: ventana emergente y
   firebaseapp.com. */
const DOMINIO_PROPIO = "paginita-pro.cl";
export const conRedireccion = typeof navigator !== "undefined" && navigator.standalone === true &&
  typeof location !== "undefined" && location.hostname === DOMINIO_PROPIO;

const firebaseConfig = {
  apiKey: "AIzaSyDxarTG8KMwolWzdYT8eLwgX1wReQLF8Bc",
  authDomain: conRedireccion ? DOMINIO_PROPIO : "mi-pagina-pro.firebaseapp.com",
  databaseURL: "https://mi-pagina-pro-default-rtdb.firebaseio.com",
  projectId: "mi-pagina-pro",
  storageBucket: "mi-pagina-pro.firebasestorage.app",
  messagingSenderId: "947244697252",
  appId: "1:947244697252:web:2dc1d514e89e25c7de0831",
  measurementId: "G-49FHCTY7B6"
};

export const app = initializeApp(firebaseConfig);

/* Los emuladores de Firebase (cuentas, base y Storage) en ESTA PC: solo cuando la página la sirve el arnés local de
   Mario Kart (juegos/mkw/herramientas/experiencia.mjs, el jugar.bat del proyecto), que pone window.__FIREBASE_EMU,
   y solo en localhost/127.0.0.1. Así se prueba el sitio entero (iniciar sesión, salas, partidas en la nube) con las
   reglas de verdad y cuentas de mentira, sin tocar el Firebase real. En el sitio publicado ese objeto no existe y
   nada cambia. Con emuladores no hay App Check ni Analytics: nada sale de la PC. */
const EMU = typeof window !== "undefined" && typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  && window.__FIREBASE_EMU && typeof window.__FIREBASE_EMU === "object" ? window.__FIREBASE_EMU : null;

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
if (APP_CHECK_SITE_KEY && !EMU && typeof window !== "undefined" && typeof document !== "undefined") {
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
if (EMU) {
  connectAuthEmulator(auth, EMU.auth, { disableWarnings: true });
  connectDatabaseEmulator(db, EMU.db[0], EMU.db[1]);
  connectStorageEmulator(storage, EMU.storage[0], EMU.storage[1]);
}

// Para pruebas locales con el emulador (solo en Node, nunca en el navegador)
if (typeof process !== "undefined" && process.env && process.env.FIREBASE_EMU) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}

// Analytics solo donde el navegador lo soporta (no rompe en localhost/file)
const analitica = EMU ? Promise.resolve(null) : analyticsSupported().then(ok => ok ? getAnalytics(app) : null).catch(() => null);

/* Un evento de Analytics (el embudo del invitado en Juegos: bienvenida,
   partidas sin cuenta, inicios de sesión y desde dónde). Nunca lanza ni
   espera: sin Analytics (Node, bloqueadores, navegadores sin soporte) no
   pasa nada. Solo nombres y datos del sitio, nunca lo que escribió nadie. */
export function evento(nombre, datos) {
  analitica.then(a => { if (a) logEvent(a, nombre, datos || {}); }).catch(() => {});
}
/* ¿El inicio de sesión que devolvió `loginGoogle` creó la cuenta? */
export function esCuentaNueva(resultado) {
  try { return !!(resultado && getAdditionalUserInfo(resultado)?.isNewUser); } catch (e) { return false; }
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  /* En la app del iPhone la página se va a Google y vuelve: la promesa no
     llega a cumplirse (la sesión entra sola al volver, y `resultadoLogin`
     trae lo que traería el resultado de la ventana). */
  if (conRedireccion) return signInWithRedirect(auth, provider);
  return signInWithPopup(auth, provider);
}
/* El resultado de una redirección que acaba de volver (null si no hubo). */
export function resultadoLogin() {
  return conRedireccion ? getRedirectResult(auth) : Promise.resolve(null);
}

export function logout() {
  return signOut(auth);
}
