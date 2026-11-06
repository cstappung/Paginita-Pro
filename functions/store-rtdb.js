/* El almacén de Pro Kingdoms sobre la Realtime Database (Admin SDK), con la misma forma que
   juegos/prokingdoms/server/store.js (col, get, set, del, all, touch, flush, getSave, setSave,
   delSave, log). prepara.js lo copia como functions/juego/server/store.js, así sim.js no cambia.

   - **Todo vive en memoria**, como en el servidor local. `carga()` baja el estado UNA vez por
     arranque en frío (lo único que cuenta como descarga) y `flush()` sube solo los documentos que
     cambiaron, en una sola actualización multiruta. Subir a la RTDB no se cobra.
   - **Cada documento se guarda como texto JSON**, no como objeto: la RTDB borra los null de los
     arreglos y los arreglos y objetos vacíos (`slots: [null, …]`, `inbox: []`), y el juego se
     rompería al volver a leerlos.
   - Las partidas completas van aparte (`partidas/<pid>`, texto) con un índice chico
     (`hayPartida/<pid>`) que se baja con el resto: `join` solo pregunta si existe.
   - Nadie de la web lee ni escribe `prokingdoms/` (reglas: `.read`/`.write` false). El Admin SDK
     se salta las reglas.

   - **Versión del mundo** (`prokingdoms/mundoVer`, se baja con el resto): sim.js la compara con
     `D.MUNDO_VER` al cargarse y, si es otra, llama a `reinicia()`, que borra col, partidas y
     hayPartida (no sospechas). functions/index.js espera esa escritura antes de atender a nadie.

   Nodos: prokingdoms/col/<colección>/<id>, prokingdoms/partidas/<pid>,
   prokingdoms/hayPartida/<pid>, prokingdoms/sospechas/<push>, prokingdoms/mundoVer. */
'use strict';
const { getDatabase } = require('firebase-admin/database');

const RAIZ = 'prokingdoms';
const db = () => getDatabase();
// Las claves de la RTDB no admiten . # $ [ ] / : los ids del juego son seguros, pero por las dudas.
const clave = id => encodeURIComponent(String(id)).replace(/\./g, '%2E');
const deClave = k => decodeURIComponent(k);

const cols = {};       // colección -> { id: documento }
const escritos = {};   // colección -> { clave: texto JSON que hay en la base }
const dirty = new Set();
let hayPartida = {};   // clave -> true
let mundo = null;      // versión del mundo guardada (null: nunca se anotó)
const cola = [];       // escrituras sueltas en curso (partidas, sospechas)

async function carga() {
  const [c, idx, mv] = await Promise.all([db().ref(RAIZ + '/col').get(), db().ref(RAIZ + '/hayPartida').get(), db().ref(RAIZ + '/mundoVer').get()]);
  mundo = mv.exists() ? mv.val() : null;
  const v = c.val() || {};
  for (const name in v) {
    cols[name] = {}; escritos[name] = {};
    for (const k in v[name]) {
      const txt = v[name][k];
      try { cols[name][deClave(k)] = JSON.parse(txt); escritos[name][k] = txt; } catch (e) { console.error('[store] documento ilegible', name, k); }
    }
  }
  hayPartida = idx.val() || {};
}

function col(name) {
  if (!cols[name]) { cols[name] = {}; escritos[name] = escritos[name] || {}; }
  return cols[name];
}
function get(name, id) { return col(name)[id] || null; }
function set(name, id, doc) { col(name)[id] = doc; dirty.add(name); return doc; }
function del(name, id) { delete col(name)[id]; dirty.add(name); }
function all(name) { return Object.values(col(name)); }
function touch(name) { dirty.add(name); }
const sucio = () => dirty.size > 0;

/* Sube lo que cambió desde la última vez. Si falla, lo que no se subió se marca para el próximo
   intento (el texto anotado deja de coincidir). Nunca hay dos subidas a la vez. */
let enCurso = Promise.resolve();
function flush() {
  enCurso = enCurso.then(async () => {
    const upd = {};
    for (const name of dirty) {
      const c = col(name), e = escritos[name] || (escritos[name] = {}), vistos = new Set();
      for (const id in c) {
        const k = clave(id), txt = JSON.stringify(c[id]);
        vistos.add(k);
        if (e[k] !== txt) { upd[`${RAIZ}/col/${name}/${k}`] = txt; e[k] = txt; }
      }
      for (const k in e) if (!vistos.has(k)) { upd[`${RAIZ}/col/${name}/${k}`] = null; delete e[k]; }
    }
    dirty.clear();
    if (!Object.keys(upd).length) return;
    try { await db().ref().update(upd); }
    catch (err) {
      console.error('[store] no se pudo guardar', err && err.message);
      for (const ruta in upd) {
        const [, , name, k] = ruta.split('/');
        (escritos[name] = escritos[name] || {})[k] = '?';   // no coincide con nada: se vuelve a escribir (o a borrar)
        dirty.add(name);
      }
    }
  });
  return enCurso;
}

const encola = pr => { cola.push(pr.catch(err => console.error('[store]', err && err.message))); };
/* Lo único que sim.js pregunta de forma síncrona es si hay partida (join). El texto se lee con
   leeSave(), que es asíncrona (functions/index.js atiende GET /api/save). */
function getSave(pid) { return hayPartida[clave(pid)] ? '1' : null; }
const leeSave = async pid => { const s = await db().ref(`${RAIZ}/partidas/${clave(pid)}`).get(); return s.exists() ? s.val() : null; };
function setSave(pid, text) {
  const k = clave(pid);
  hayPartida[k] = true;
  encola(db().ref().update({ [`${RAIZ}/partidas/${k}`]: text, [`${RAIZ}/hayPartida/${k}`]: true }));
}
function delSave(pid) {
  const k = clave(pid);
  delete hayPartida[k];
  encola(db().ref().update({ [`${RAIZ}/partidas/${k}`]: null, [`${RAIZ}/hayPartida/${k}`]: null }));
}
/* Lo sospechoso: a Cloud Logging y a prokingdoms/sospechas (sim.js ya lo limita a una línea por
   minuto por jugador y tipo). */
function log(entry) {
  console.warn('[sospecha]', JSON.stringify(entry));
  encola(db().ref(`${RAIZ}/sospechas`).push(JSON.parse(JSON.stringify(entry))));   // sin undefined: la RTDB los rechaza
}
/* Versión del mundo y reinicio (ver arriba). Borra en memoria y en la base, en una sola escritura. */
const mundoVer = () => mundo;
function setMundoVer(v) { mundo = v; encola(db().ref(RAIZ + '/mundoVer').set(v)); }
function reinicia(v) {
  for (const k in cols) delete cols[k];
  for (const k in escritos) delete escritos[k];
  dirty.clear();
  hayPartida = {};
  mundo = v;
  encola(db().ref(RAIZ).update({ col: null, partidas: null, hayPartida: null, mundoVer: v }));
}
/* Espera las escrituras sueltas en curso (antes de contestar un guardado). */
const pendientes = () => Promise.all(cola.splice(0));

module.exports = { col, get, set, del, all, touch, flush, getSave, setSave, delSave, log, carga, leeSave, pendientes, sucio, mundoVer, setMundoVer, reinicia };
