// Vista previa en el menú sin descargar la canción de Firebase: los 30 s que
// Apple Music deja escuchar gratis, pedidos a la iTunes Search API (CORS
// abierto, sin clave). Solo se pide la ficha de búsqueda (~10 KB); el audio lo
// trae <audio> directo desde los servidores de Apple.
//
// Apple corta a ~20 búsquedas por minuto y por IP: se pide solo si te quedas
// en la canción (songSelect), cada canción se busca una vez y la respuesta
// (también «no está») queda en localStorage. Si Apple falla o dice basta, se
// descansa un minuto.

const API = 'https://itunes.apple.com/search';
const CLAVE = 'hero-apple-v1';
const NO_ESTA = 30 * 24 * 3600e3; // una canción que no apareció se vuelve a buscar al mes
const DESCANSO = 60e3;

let guardado = null;
const enCurso = new Map();
let descansaHasta = 0;

function lee() {
  if (guardado) return guardado;
  try {
    guardado = JSON.parse(localStorage.getItem(CLAVE)) || {};
  } catch {
    guardado = {};
  }
  return guardado;
}

function escribe(id, valor) {
  lee()[id] = valor;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(guardado));
  } catch {}
}

// Minúsculas, sin tildes, sin «(Live)», «[2004 Remaster]», «feat. …» ni signos.
export function limpia(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[([{].*?[)\]}]/g, ' ')
    .replace(/\s(feat|ft|featuring)\.?\s.*$/, ' ')
    .replace(/['’`´]/g, '') // «can't» → «cant»: Apple no encuentra «can t»
    .replace(/&/g, ' and ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parecido(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 3;
  // palabras enteras: «one» no es «someone»
  if (` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `)) return 2;
  return 0;
}

// De los resultados de Apple, la pista que es esta canción (o null). El artista
// tiene que coincidir: mejor sin vista previa que con la canción de otro.
export function eligeApple(entry, resultados) {
  const nombre = limpia(entry.meta?.name);
  const artista = limpia(entry.meta?.artist);
  let mejor = null;
  let mejorPuntos = 0;
  for (const r of resultados || []) {
    if (!r.previewUrl || r.kind !== 'song') continue;
    const pa = parecido(artista, limpia(r.artistName));
    const pn = parecido(nombre, limpia(r.trackName));
    if (!pa || !pn) continue;
    let puntos = pa * 10 + pn * 10;
    // a igual nombre, la de duración más parecida (la versión de estudio y no la en vivo)
    if (entry.length && r.trackTimeMillis) puntos -= Math.min(9, Math.abs(entry.length - r.trackTimeMillis) / 10e3);
    if (/live|en vivo|karaoke|instrumental/i.test(r.trackName) && !/live|vivo/i.test(entry.meta?.name || '')) puntos -= 5;
    if (puntos > mejorPuntos) {
      mejor = r;
      mejorPuntos = puntos;
    }
  }
  return mejor;
}

async function busca(entry) {
  const term = `${limpia(entry.meta?.artist)} ${limpia(entry.meta?.name)}`.trim();
  if (!term) return '';
  const url = `${API}?${new URLSearchParams({ term, media: 'music', entity: 'song', limit: '15' })}`;
  // el 403 con que Apple corta llega a veces sin CORS, como un fallo de red
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apple respondió ${res.status}`);
  const data = await res.json();
  return eligeApple(entry, data.results)?.previewUrl || '';
}

// Lo que ya se sabe de esta canción sin preguntar: la URL, '' (no está en
// Apple) o undefined (no se ha buscado).
export function appleConocida(entry) {
  if (!suenaAac()) return '';
  const v = lee()[entry.id];
  if (typeof v === 'string') return v;
  if (v && v.no && Date.now() - v.no < NO_ESTA) return '';
  return undefined;
}

// Los 30 s vienen en AAC (.m4a): un Chromium sin códecs propietarios no puede
// tocarlos, y buscar en Apple sería gastar el cupo para nada.
let aac = null;
function suenaAac() {
  aac ??= typeof Audio !== 'undefined' && !!new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"');
  return aac;
}

// URL de los 30 s de Apple para esta canción, o null si no hay.
export function previewApple(entry) {
  const conocida = appleConocida(entry);
  if (conocida !== undefined) return Promise.resolve(conocida || null);
  if (enCurso.has(entry.id)) return enCurso.get(entry.id);
  if (Date.now() < descansaHasta) return Promise.resolve(null);
  const p = busca(entry)
    .then((url) => {
      escribe(entry.id, url || { no: Date.now() });
      return url || null;
    })
    .catch(() => {
      descansaHasta = Date.now() + DESCANSO;
      return null;
    })
    .finally(() => enCurso.delete(entry.id));
  enCurso.set(entry.id, p);
  return p;
}

// La URL guardada dejó de sonar (Apple cambia sus archivos de vez en cuando):
// la próxima vez se busca de nuevo.
export function olvidaApple(entry) {
  if (lee()[entry.id] === undefined) return;
  delete guardado[entry.id];
  try {
    localStorage.setItem(CLAVE, JSON.stringify(guardado));
  } catch {}
}
