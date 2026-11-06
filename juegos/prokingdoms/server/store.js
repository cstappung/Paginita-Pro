// Almacenamiento local en archivos JSON (server/data/).
// Es la ÚNICA pieza que toca el disco: para pasar a Firebase (u otra base) basta con reimplementar
// estas funciones manteniendo la misma forma. Las colecciones viven en memoria y se escriben agrupadas
// cada pocos segundos, nunca en cada petición.
'use strict';
const fs = require('fs');
const path = require('path');

// PK_DATA permite usar otra carpeta (por ejemplo, una copia para pruebas).
const DATA = process.env.PK_DATA ? path.resolve(process.env.PK_DATA) : path.join(__dirname, 'data');
const SAVES = path.join(DATA, 'saves');
fs.mkdirSync(SAVES, { recursive: true });

const cols = {};
const dirty = new Set();

function file(name) { return path.join(DATA, name + '.json'); }

function writeAtomic(target, text) {
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, target);
}

// Colección = objeto { id: documento }.
function col(name) {
  if (!cols[name]) {
    try { cols[name] = JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch (e) { cols[name] = {}; }
  }
  return cols[name];
}
function get(name, id) { return col(name)[id] || null; }
function set(name, id, doc) { col(name)[id] = doc; dirty.add(name); return doc; }
function del(name, id) { delete col(name)[id]; dirty.add(name); }
function all(name) { return Object.values(col(name)); }
function touch(name) { dirty.add(name); }

function flush() {
  for (const name of dirty) {
    try { writeAtomic(file(name), JSON.stringify(cols[name])); } catch (e) { console.error('No se pudo guardar', name, e.message); }
  }
  dirty.clear();
}

// Partidas completas: un archivo por jugador (son más grandes y cambian menos seguido).
const safeId = id => String(id).replace(/[^\w-]/g, '');
function getSave(pid) {
  try { return fs.readFileSync(path.join(SAVES, safeId(pid) + '.json'), 'utf8'); } catch (e) { return null; }
}
function setSave(pid, text) { writeAtomic(path.join(SAVES, safeId(pid) + '.json'), text); }
function delSave(pid) { try { fs.unlinkSync(path.join(SAVES, safeId(pid) + '.json')); } catch (e) { /* no existía */ } }

// Registro de lo sospechoso (una línea JSON por evento) en server/data/sospechas.log.
function log(entry) {
  fs.appendFile(path.join(DATA, 'sospechas.log'), JSON.stringify(entry) + '\n', e => { if (e) console.error('No se pudo registrar', e.message); });
}

// Versión del mundo (D.MUNDO_VER; la compara sim.js al cargar) en data/mundo.json. reinicia() borra las
// colecciones y las partidas, pero no sospechas.log.
const MUNDO = path.join(DATA, 'mundo.json');
function mundoVer() { try { return JSON.parse(fs.readFileSync(MUNDO, 'utf8')).v; } catch (e) { return null; } }
function setMundoVer(v) { writeAtomic(MUNDO, JSON.stringify({ v })); }
function reinicia(v) {
  for (const f of fs.readdirSync(DATA)) if (f.endsWith('.json') && f !== 'mundo.json') fs.unlinkSync(path.join(DATA, f));
  for (const f of fs.readdirSync(SAVES)) fs.unlinkSync(path.join(SAVES, f));
  for (const k in cols) delete cols[k];
  dirty.clear();
  setMundoVer(v);
}

setInterval(flush, 5000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });
process.on('exit', flush);

module.exports = { col, get, set, del, all, touch, flush, getSave, setSave, delSave, log, mundoVer, setMundoVer, reinicia };
