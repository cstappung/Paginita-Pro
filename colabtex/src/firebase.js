"use strict";
/* Inicialización de Firebase: Auth (Google), Realtime Database,
   Storage y Analytics (opcional). */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

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
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

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
