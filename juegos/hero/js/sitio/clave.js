// Clave de una canción en la base de datos: el `id` de library.json puede
// traer caracteres que Firebase no acepta en una clave (. # $ [ ] /), así
// que se usa su hash (cyrb53, 53 bits) en base 36. Lo importan el juego y
// la página (colabtex/src/juegos/hero.js): tiene que dar lo mismo en los dos.
export function claveCancion(id) {
  const s = String(id ?? '');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'c' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const ES_CLAVE = /^c[0-9a-z]{1,12}$/;

// La dificultad más alta que tiene una parte en la canción ya leída: solo
// ahí las estrellas son doradas (las demás, azules).
const ORDEN = ['expert', 'hard', 'medium', 'easy'];
export function dificultadMaxima(song, part) {
  const p = song?.parts?.[part];
  if (!p) return '';
  return ORDEN.find((d) => p[d]?.notes?.length) || '';
}
