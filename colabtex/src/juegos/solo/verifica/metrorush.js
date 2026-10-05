/* Verificador antitrampas de Metro Rush (docs/antitrampas/metrorush.md).

   Metro Rush es un runner en tiempo real: no se rehace cuadro a cuadro. La
   prueba es la semilla de la pista, los pedidos que el juego le hizo al
   generador y los eventos que cambian el puntaje (estrellas, el 2×, el +5,
   los choques), más una muestra de metros y reloj cada 2 s.
   `MetroRushPrueba.rehace` —el mismo archivo que usa el juego para anotar,
   así no divergen— vuelve a generar la pista, comprueba cada objeto
   recogido, los metros contra la velocidad y el reloj de juego contra el
   real, y recalcula los puntos exactos; aquí solo se compara con lo
   declarado. */
import MP from '../../../../../juegos/club/metrorush/prueba.js';

export const PRUEBA = 1;

const TOPE_CARRERA = 1000000000, TOPE_DISTANCIA = 1000000;   // los de resultadoClub

/* `ctx.uid`, si la página lo pasa: la prueba lleva la cuenta en la que se
   corrió, y la de otra persona (copiada de soloPruebas) no vale. */
export function verifica(dato, prueba, ctx) {
  if (!prueba || typeof prueba !== 'object') return 'La partida llegó sin prueba.';
  if (ctx && ctx.uid && prueba.u && prueba.u !== ctx.uid) return 'La prueba es de otra cuenta.';
  const r = MP.rehace(prueba);
  if (r.motivo) return 'La carrera no cuadra: ' + r.motivo + '.';
  const cat = dato && dato.categoria;
  if (cat === 'club-metrorush-carrera') {
    // Los puntos se suman tramo a tramo en el juego y aquí de una vez: puede
    // haber una diferencia de redondeo de un punto.
    if (Math.abs(dato.puntos - Math.min(TOPE_CARRERA, r.puntos)) > 2) return 'Los puntos declarados (' + dato.puntos + ') no son los de la carrera (' + r.puntos + ').';
  } else if (cat === 'club-metrorush-distancia') {
    if (Math.abs(dato.puntos - Math.min(TOPE_DISTANCIA, r.metros)) > 1) return 'Los metros declarados (' + dato.puntos + ') no son los de la carrera (' + r.metros + ').';
  } else return 'Categoría desconocida.';
  if (Math.abs(dato.tiempo - r.tiempo) > 100) return 'El tiempo declarado no es el de la carrera.';
  return null;
}

/* Lo imposible, para filas ya guardadas sin prueba. No son umbrales de
   «sospechoso»: son lo que el juego no deja hacer. Lo más rápido que se
   puede correr es la velocidad del juego (de 13 a 30 m/s, la integral que
   da `metrosEntre`), y el multiplicador más alto es (30 + 29 + 5) × 2 = 128,
   o sea 1 280 puntos por metro. Ejemplo: en 60 s se corren a lo más 1 024 m,
   así que más de 1 310 000 puntos en un minuto no se pueden hacer. */
const PUNTOS_POR_METRO_MAX = 10 * 128;

export function sospecha(categoria, fila) {
  const p = fila && fila.puntos, t = (fila && fila.tiempo || 0) / 1000;
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 'fila sin puntos o sin tiempo';
  const maxMetros = MP.metrosEntre(0, t) + 15;
  if (categoria === 'club-metrorush-distancia') {
    if (p > maxMetros) return p + ' m en ' + t.toFixed(1) + ' s (más rápido que el juego)';
    return null;
  }
  if (categoria === 'club-metrorush-carrera') {
    if (p > maxMetros * PUNTOS_POR_METRO_MAX) return p + ' puntos en ' + t.toFixed(1) + ' s (más de lo que da el multiplicador máximo)';
    return null;
  }
  return null;
}
