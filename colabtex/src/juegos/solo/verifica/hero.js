/* Verificador antitrampas de PRO HERO (ver docs/antitrampas.md y
   docs/antitrampas/hero.md).

   La tabla es una sola, `club-hero-estrellas`, y su número es un resumen:
   puntos = doradas·10 000 + Σ máx(doradas, azules) de cada canción
   (`codificaHero` en juegos/hero.js). Cada canción ya se verificó al
   terminarla, volviéndola a tocar con el mismo motor (hero.js:
   `verificaHero`); lo que llega aquí es el mapa de estrellas por canción
   (`{v: 1, c: {clave: [doradas, azules]}}`) y lo que se comprueba es que
   la fila diga exactamente lo que suma ese mapa. Así un récord de la tabla
   se puede auditar después canción por canción. */
export const PRUEBA = 1;

const CATEGORIA = 'club-hero-estrellas';
const CLAVE = /^c[0-9a-z]{1,12}$/;
const estrella = x => Number.isInteger(x) && x >= 0 && x <= 5;

export function suma(c) {
  let g = 0, m = 0, h = 0, h5 = 0;
  for (const [k, v] of Object.entries(c || {})) {
    if (!CLAVE.test(k) || !Array.isArray(v) || !estrella(v[0]) || !estrella(v[1])) return null;
    g += v[0]; m += Math.max(v[0], v[1]);
    if (v[0] > 0) h++;
    if (v[0] >= 5) h5++;
  }
  return { g, m, h, h5 };
}

export function verifica(dato, prueba) {
  if (!dato || dato.categoria !== CATEGORIA) return 'PRO HERO no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1 || !prueba.c || typeof prueba.c !== 'object' || Array.isArray(prueba.c)) return 'La prueba de PRO HERO no tiene la forma esperada.';
  if (Object.keys(prueba.c).length > 2000) return 'La prueba trae más canciones de las que hay.';
  const s = suma(prueba.c);
  if (!s) return 'La prueba trae una canción o unas estrellas que no valen.';
  if (s.g * 10000 + Math.min(s.m, 9999) !== dato.puntos) return 'Las estrellas de las canciones no suman lo que dice la fila.';
  return null;
}

/* Una fila guardada, sin mirar su prueba: ¿es inverosímil? */
export function sospecha(categoria, fila) {
  if (categoria !== CATEGORIA || !fila) return null;
  const g = Math.floor((fila.puntos || 0) / 10000), m = (fila.puntos || 0) % 10000;
  if (m < g) return 'Tiene menos estrellas en total que doradas.';
  if (fila.h !== undefined && g > 5 * fila.h) return 'Tiene más estrellas doradas de las que caben en sus canciones.';
  if (fila.h5 !== undefined && fila.h !== undefined && fila.h5 > fila.h) return 'Tiene más canciones con cinco doradas que con alguna.';
  return null;
}
