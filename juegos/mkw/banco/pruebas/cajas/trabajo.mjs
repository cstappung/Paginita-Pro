// Paso 8 (H5, bitácora §188): el trabajo de mentira de un cuadro, con la forma del juego (sin nada del juego).
// llenar(caja, f): «la lógica de la carrera» (un cálculo fijo) + escribir V vértices (x, y, z en float32, como la lista
//   de dibujo que el juego le deja a la tarjeta) → bytes usados.
// convertir(vista): «aurora»: cada vértice por una matriz 3×4, a enteros de 16 bits, y una suma de control → número.
export const VERTICES = 30000;                 // ~360 KB por cuadro
export const VUELTAS_LOGICA = 2_000_000;       // la «lógica»: unos ms de cálculo en un PC
export function llenar(caja, f) {
  let x = (f * 2654435761) >>> 0 || 1, s = 0;
  for (let i = 0; i < VUELTAS_LOGICA; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s = (s + x) | 0; }
  const v = new Float32Array(caja.buffer, caja.byteOffset, VERTICES * 3);
  for (let i = 0; i < VERTICES * 3; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; v[i] = ((x >>> 8) / 16777216 - 0.5) * 200 + (s & 7); }
  return VERTICES * 12;
}
const M = [0.9, -0.1, 0.2, 3, 0.1, 0.95, -0.2, -1, -0.2, 0.15, 0.9, 7];
export function convertir(vista) {
  const v = new Float32Array(vista.buffer, vista.byteOffset, vista.byteLength >> 2);
  let suma = 0;
  for (let r = 0; r < 6; r++)                  // (6 pasadas: lo que aurora hace por vértice —decodificar, transformar, empacar—)
    for (let i = 0; i < v.length; i += 3) {
      const a = v[i], b = v[i + 1], c = v[i + 2];
      const X = Math.fround(M[0] * a + M[1] * b + M[2] * c + M[3]), Y = Math.fround(M[4] * a + M[5] * b + M[6] * c + M[7]), Z = Math.fround(M[8] * a + M[9] * b + M[10] * c + M[11]);
      suma = (Math.imul(suma, 31) + ((X * 64) | 0) + ((Y * 64) | 0) * 3 + ((Z * 64) | 0) * 7) | 0;
    }
  return suma >>> 0;
}
