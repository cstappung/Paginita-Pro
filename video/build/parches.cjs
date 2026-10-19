module.exports = [
  ['firebase.js', 'const APP_CHECK_SITE_KEY = "6LedGuEtAAAAAJil2UaHh3j8gCLGf0YP8O1Mo_Bc";', 'const APP_CHECK_SITE_KEY = "";'],
  ['firebase.js', 'if (typeof process !== "undefined" && process.env && process.env.FIREBASE_EMU) {', 'if (true) {'],
  ['firebase.js', 'import { getAuth, GoogleAuthProvider,', 'import { signInWithCredential } from "firebase/auth";\nimport { getAuth, GoogleAuthProvider,'],
  ['firebase.js', '// Analytics solo donde', 'window.__fb = { auth, db, GoogleAuthProvider, signInWithCredential };\n// Analytics solo donde'],
];
// Suerte en el casino (solo para filmar): el avión no se estrella, la ruleta da el número pedido, el plinko cae al borde
module.exports.push(
  ['juegos/casino-motor.js', 'if (azar(uid, k, "0", at) >= RETORNO) return', 'if (!globalThis.__suerte && azar(uid, k, "0", at) >= RETORNO) return'],
  ['juegos/casino-motor.js', 'if (u >= ma / mb) {', 'if (!globalThis.__suerte && u >= ma / mb) {'],
  ['juegos/casino-motor.js', 'const n = Math.floor(azar(uid, k, "r", r.at) * 37);', 'const n = globalThis.__suerte ? (globalThis.__ruleta ?? 17) : Math.floor(azar(uid, k, "r", r.at) * 37);'],
  ['juegos/casino-motor.js', 'const w = PM.sha256("casino:" + uid + ":" + k + ":l:" + at)[0];', 'if (globalThis.__suerte) return Array.from({ length: n }, () => 1);\n  const w = PM.sha256("casino:" + uid + ":" + k + ":l:" + at)[0];'],
  ['juegos/solo/verifica.js', '  const v = VERIFICADORES[juego];\n  if (!v) return null;', '  const v = VERIFICADORES[juego];\n  if (!v || globalThis.__aceptaTodo) return null;'],
);
module.exports.push(
  ['juegos/casino-motor.js', 'const at = r.at, cierre = horaAvion(at, AVION.TOPE),', 'const at = r.at, cierre = globalThis.__suerte ? Infinity : horaAvion(at, AVION.TOPE),'],
  ['juegos/casino-motor.js', 'if (b0 === c) { const mult = baja2(mb);', 'if (b0 === c) { const mult = globalThis.__tope ? Math.min(baja2(mb), globalThis.__tope) : baja2(mb);'],
);
