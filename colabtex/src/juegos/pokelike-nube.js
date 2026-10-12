"use strict";
/* Pokelike: la Pokédex en la cuenta (`pokedex/<uid>`). `npm run build:pokelike`
   lo empaqueta en juegos/club/pokelike/nube.js. Usa la misma sesión que el
   resto del sitio (mismo origen, misma persistencia de Firebase Auth), así
   que quien ya entró en Juegos llega con la sesión iniciada.

   Es la única excepción a «el juego del Club no toca Firebase»: la
   Pokédex de la cuenta no es un récord (no paga ni entra en la
   clasificación), así que vive aquí en vez de en un cartero de la página.
   Si algún día da monedas o logros, se muda a un cartero. */
import { db, watchAuth, loginGoogle, logout } from "../firebase.js";
import { ref, get, runTransaction } from "firebase/database";

const api = {
  /* Con sesión, el nombre es el apodo de Juegos (`users/<uid>/perfil/nick`,
     legible con sesión) o, si no tiene, el de Google. */
  alCambiar: cb => watchAuth(async u => {
    if (!u) return cb(null);
    let nick = null;
    try { nick = (await get(ref(db, `users/${u.uid}/perfil/nick`))).val(); } catch (_) { /* sin perfil o sin permiso */ }
    cb({ uid: u.uid, nombre: (typeof nick === "string" && nick.trim()) || u.displayName || "tu cuenta", nick: typeof nick === "string" ? nick.trim() : null });
  }),
  entrar: () => loginGoogle().catch(err => console.warn("Pokelike: no se pudo iniciar sesión", err)),
  salir: () => logout(),
  /* Junta la copia local con la de la cuenta en una transacción, así dos
     dispositivos a la vez no se pisan. Si la cuenta ya tiene todo, no escribe. */
  async mezcla(uid, local, mezclar, iguales) {
    const r = await runTransaction(ref(db, `pokedex/${uid}`), actual => {
      const junta = mezclar(actual, local);
      return actual && iguales(junta, mezclar(actual, null)) ? undefined : junta;
    }, { applyLocally: false });
    return r.snapshot.val();
  },
};

window.PokelikeNube = api;
if (window.PokelikeDex) window.PokelikeDex.conectar(api);
