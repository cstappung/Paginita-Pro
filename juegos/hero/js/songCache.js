// Caché de archivos de canciones en el navegador (Cache Storage).
// Así una canción que ya jugaste no se vuelve a descargar de Firebase.
// Cuando se pasa del tope, se borran las que llevan más tiempo sin usarse.
const CACHE_NAME = 'hero-canciones-v1';
const INDEX_KEY = 'hero.cache.index';

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || {};
  } catch {
    return {};
  }
}

function writeIndex(idx) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch {}
}

const keyUrl = (key) => `https://cache.hero.local/${encodeURIComponent(key)}`;

async function openCache() {
  try {
    return 'caches' in self ? await caches.open(CACHE_NAME) : null;
  } catch {
    return null;
  }
}

export async function cacheGet(key) {
  const c = await openCache();
  if (!c) return null;
  try {
    const res = await c.match(keyUrl(key));
    if (!res) return null;
    const idx = readIndex();
    if (idx[key]) {
      idx[key].t = Date.now();
      writeIndex(idx);
    }
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function cachePut(key, buf, maxBytes) {
  const c = await openCache();
  if (!c) return;
  try {
    await c.put(keyUrl(key), new Response(buf));
    const idx = readIndex();
    idx[key] = { s: buf.byteLength, t: Date.now() };
    // se libera espacio empezando por lo más antiguo
    let total = Object.values(idx).reduce((a, e) => a + e.s, 0);
    const old = Object.entries(idx).sort((a, b) => a[1].t - b[1].t);
    for (const [k, e] of old) {
      if (total <= maxBytes || k === key) continue;
      await c.delete(keyUrl(k));
      delete idx[k];
      total -= e.s;
    }
    writeIndex(idx);
  } catch {
    // sin espacio o modo privado: simplemente no se guarda
  }
}

export function cacheUsage() {
  return Object.values(readIndex()).reduce((a, e) => a + e.s, 0);
}

export async function cacheClear() {
  try {
    await caches.delete(CACHE_NAME);
  } catch {}
  writeIndex({});
}
