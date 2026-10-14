// Biblioteca de canciones: viene del servidor local (npm start) o de Firebase Storage.
// Con Firebase, los archivos de una canción solo se descargan al jugarla y quedan en caché.
import { leeCancion } from './core/leer.js';
import { SITE, songSource } from './site.js';
import { cacheGet, cachePut } from './songCache.js';

export const library = {
  songs: [],
  byId: new Map(),
  scanning: false,
  progress: 0,
  source: null, // 'server' | 'firebase'
  needsLogin: false,

  async refresh() {
    this.source = await songSource();
    if (this.source === 'firebase') return this._refreshCloud();
    const res = await fetch('api/library');
    const data = await res.json();
    this.scanning = data.scanning;
    this.progress = data.progress;
    if (data.songs.length || !data.scanning) this._set(data.songs);
    return data;
  },

  async _refreshCloud() {
    const { currentUser, downloadPath } = await import('./cloud.js');
    const user = await currentUser();
    this.needsLogin = !user;
    if (!user) return { songs: [] };
    const buf = await downloadPath(`${SITE.storageRoot}/library.json`);
    const data = JSON.parse(new TextDecoder().decode(buf));
    this.scanning = false;
    this._set(data.songs);
    return data;
  },

  _set(songs) {
    songs.sort((a, b) => a.meta.artist.localeCompare(b.meta.artist, 'es') || a.meta.name.localeCompare(b.meta.name, 'es'));
    this.songs = songs;
    this.byId = new Map(songs.map((s) => [s.id, s]));
  },

  async rescan() {
    if (this.source === 'firebase') return;
    await fetch('api/rescan', { method: 'POST' });
  },

  get remote() {
    return this.source === 'firebase';
  },
};

// URL directa de un archivo (solo con el servidor local)
export function songUrl(entry, file) {
  return `songs/${entry.id}/${encodeURIComponent(file)}`;
}

// Descarga (o saca de la caché) un archivo de la canción. onBytes(recibidos) informa el avance.
export async function fetchSongFile(entry, file, onBytes) {
  if (!library.remote) {
    const res = await fetch(songUrl(entry, file));
    if (!res.ok) throw new Error(`No se pudo descargar ${file}`);
    const buf = await res.arrayBuffer();
    onBytes?.(buf.byteLength);
    return buf;
  }
  const key = `${entry.folder}/${file}?v=${entry.v || ''}`;
  const hit = await cacheGet(key);
  if (hit) {
    onBytes?.(hit.byteLength);
    return hit;
  }
  const { downloadPath } = await import('./cloud.js');
  const buf = await downloadPath(`${SITE.storageRoot}/${entry.folder}/${file}`, onBytes);
  await cachePut(key, buf, SITE.cacheMB * 1024 * 1024);
  return buf;
}

// URL para mostrar una imagen de la canción (portada, fondo)
const blobUrls = new Map();
export async function fileUrl(entry, file) {
  if (!library.remote) return songUrl(entry, file);
  const key = `${entry.id}/${file}`;
  if (!blobUrls.has(key)) {
    const p = fetchSongFile(entry, file).then((buf) => URL.createObjectURL(new Blob([buf])));
    p.catch(() => blobUrls.delete(key));
    blobUrls.set(key, p);
  }
  return blobUrls.get(key);
}

// <img> de portada. Con Firebase se descarga (o sale de la caché) solo si la imagen sigue en
// pantalla un momento después: al recorrer la lista rápido no se baja cada portada.
export function artImg(entry, className, lazy = true) {
  if (!entry.album) return null;
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  if (!library.remote) {
    if (lazy) img.loading = 'lazy';
    img.src = songUrl(entry, entry.album);
    return img;
  }
  const load = () => fileUrl(entry, entry.album).then((u) => (img.src = u)).catch(() => img.classList.add('broken'));
  if (lazy) setTimeout(() => img.isConnected && load(), 350);
  else load();
  return img;
}

// Bytes totales a descargar para jugar una canción (si library.json trae los tamaños)
export function songBytes(entry, files) {
  if (!entry.files) return 0;
  return files.reduce((a, f) => a + (entry.files[f] || 0), 0);
}

const parsedCache = new Map();

export async function loadSongChart(entry, onBytes) {
  if (parsedCache.has(entry.id)) return parsedCache.get(entry.id);
  const [chartBuf, iniBuf] = await Promise.all([
    fetchSongFile(entry, entry.chartFile, onBytes?.(entry.chartFile)),
    entry.iniFile ? fetchSongFile(entry, entry.iniFile, onBytes?.(entry.iniFile)).catch(() => null) : null,
  ]);
  const song = leeCancion(entry.chartFile, chartBuf, iniBuf);
  // los bytes tal cual: la página de Juegos vuelve a leerlos para verificar el récord
  song.bytes = { chartFile: entry.chartFile, chart: chartBuf, ini: iniBuf };
  parsedCache.clear();
  parsedCache.set(entry.id, song);
  return song;
}

// Vista previa en el menú con el servidor local. Con Firebase las canciones se descargan solo al
// jugar: la vista previa la pone Apple (applePreview.js, desde songSelect).
export function previewInfo(entry) {
  if (library.remote) return null;
  if (entry.preview) return { url: songUrl(entry, entry.preview), start: 0 };
  const file = entry.audio.song || Object.values(entry.audio)[0];
  const start = entry.meta.previewStart > 0 ? entry.meta.previewStart / 1000 : (entry.length / 1000) * 0.35;
  return { url: songUrl(entry, file), start };
}
