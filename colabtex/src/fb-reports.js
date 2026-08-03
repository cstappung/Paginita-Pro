"use strict";
/* ============================================================
   Informes — capa de Firebase

   Dos nodos nuevos en Realtime Database, fuera del árbol de proyectos
   porque no son de nadie en particular: los ve todo el que tenga
   sesión, que es de lo que se trata.

     errors/<huella>    error recogido solo, AGRUPADO por su huella
       {app, donde, mensaje, pila, nav, ver, ctx, desde, at, veces,
        quien/<uid>: true}
     feedback/<id>      lo que cuenta una persona (fallo o sugerencia)
       {tipo, app, titulo, cuerpo, pasos, adjuntos, uid, userName,
        nav, ver, at, estado}

   La clave de un error es su huella y no un push(): así el mismo fallo
   visto cien veces es UNA fila con un contador. El contador sube con
   `runTransaction` porque lo tocan varias personas a la vez y un
   `set` normal perdería cuentas.

   `quien` es un mapa de uid a true, no un número: contar personas
   distintas hace falta para saber si algo le pasa a todo el mundo o
   solo a un equipo, y con un contador suelto no se puede saber si
   alguien ya estaba dentro.

   OJO: las reglas de firebase/database.rules.json hay que publicarlas
   A MANO en la consola (ver CONFIGURAR-FIREBASE.md). Hasta que se
   publiquen, esto falla con PERMISSION_DENIED y la página lo dice con
   todas las letras en vez de quedarse en blanco.
   ============================================================ */
import { db } from "./firebase.js";
import { ref, get, set, update, push, remove, onValue, runTransaction, serverTimestamp } from "firebase/database";

const ERRORES = "errors";
const FEEDBACK = "feedback";

/* Las listas viajan como texto con saltos de línea, no como arrays:
   un array en RTDB es un objeto de claves numéricas y validar eso en
   las reglas cuesta el triple sin ganar nada. */
const aTexto = lista => (Array.isArray(lista) ? lista.join("\n") : String(lista || ""));
const aLista = texto => String(texto || "").split("\n").filter(l => l.trim());

const conId = (id, v) => Object.assign({ id }, v);

/* ---------- errores ---------- */

/* Sube un error. Si ya estaba, solo suma: ni se reescribe el mensaje ni
   se pierde la fecha de la primera vez. */
export async function publishError(rec, uid) {
  const nodo = ref(db, `${ERRORES}/${rec.huella}`);
  await runTransaction(nodo, actual => {
    if (actual) {
      actual.veces = (actual.veces || 1) + 1;
      actual.at = rec.at || Date.now();
      return actual;
    }
    return {
      app: rec.app, donde: rec.donde || "", mensaje: rec.mensaje,
      pila: aTexto(rec.pila), nav: rec.nav || "", ver: rec.ver || "",
      ctx: rec.ctx || null,
      desde: rec.at || Date.now(), at: rec.at || Date.now(), veces: 1
    };
  });
  // marcar que a esta persona también le ha pasado
  if (uid) await set(ref(db, `${ERRORES}/${rec.huella}/quien/${uid}`), true).catch(() => {});
}

export function watchErrors(cb) {
  const nodo = ref(db, ERRORES);
  const off = onValue(nodo, snap => {
    const val = snap.val() || {};
    cb(Object.entries(val).map(([id, v]) => Object.assign(conId(id, v), {
      pila: aLista(v.pila),
      personas: v.quien ? Object.keys(v.quien).length : 1
    })), null);
  }, err => cb([], err));
  return off;
}

export const deleteError = id => remove(ref(db, `${ERRORES}/${id}`));

export async function clearErrors(ids) {
  const updates = {};
  for (const id of ids) updates[`${ERRORES}/${id}`] = null;
  await update(ref(db), updates);
}

/* ---------- fallos y sugerencias de personas ---------- */

export async function sendFeedback(rec, { uid, userName }) {
  const id = push(ref(db, FEEDBACK)).key;
  await set(ref(db, `${FEEDBACK}/${id}`), {
    tipo: rec.tipo === "idea" ? "idea" : "bug",
    app: rec.app || "colabtex",
    titulo: rec.titulo,
    cuerpo: rec.cuerpo || "",
    pasos: rec.pasos || "",
    adjuntos: aTexto(rec.adjuntos),
    nav: rec.nav || "", ver: rec.ver || "",
    uid, userName: userName || "Alguien",
    at: serverTimestamp(), estado: "abierto"
  });
  return id;
}

export function watchFeedback(cb) {
  const off = onValue(ref(db, FEEDBACK), snap => {
    const val = snap.val() || {};
    cb(Object.entries(val).map(([id, v]) => Object.assign(conId(id, v), { adjuntos: aLista(v.adjuntos) })), null);
  }, err => cb([], err));
  return off;
}

export const setFeedbackState = (id, estado) =>
  set(ref(db, `${FEEDBACK}/${id}/estado`), estado === "hecho" ? "hecho" : "abierto");

export const deleteFeedback = id => remove(ref(db, `${FEEDBACK}/${id}`));

/* Una sola lectura, para exportar sin quedarse escuchando. */
export async function readAll() {
  const [e, f] = await Promise.all([get(ref(db, ERRORES)), get(ref(db, FEEDBACK))]);
  const ev = e.val() || {}, fv = f.val() || {};
  return {
    errores: Object.entries(ev).map(([id, v]) => Object.assign(conId(id, v), {
      pila: aLista(v.pila), personas: v.quien ? Object.keys(v.quien).length : 1
    })),
    feedback: Object.entries(fv).map(([id, v]) => Object.assign(conId(id, v), { adjuntos: aLista(v.adjuntos) }))
  };
}
