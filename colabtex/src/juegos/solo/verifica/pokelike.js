/* Verificador antitrampas de Pokelike (ver docs/antitrampas.md y
   docs/antitrampas/pokelike.md).

   Dos tablas:
   - `club-pokelike-puntos`: puntos = el puntaje de la run (100 por medalla,
     150 por miembro del Alto Mando, 500 por el Campeón y lo de la Ruta
     Infinita); tiempo = los ms jugados.
   - `club-pokelike-pokedex`: puntos = las especies distintas que pasaron
     por el equipo en esa run (la Pokédex del perfil junta muchas partidas y
     no se puede rehacer, esta sí).

   El juego manda `{v: 1, s, u, i, d, a, w}`: la semilla que eligió, la
   cuenta, el inicial, las decisiones (`run.log` unido por espacios) y lo
   jugado en los dos relojes. Aquí se vuelve a jugar con el MISMO motor
   (`juegos/club/pokelike/motor.js`): cada decisión tiene que ser posible en
   la run rehecha y el número de la tabla tiene que salir exacto. La cuenta
   entra en la semilla, así que una prueba de otra cuenta no se rehace. Las
   herramientas del modo prueba no dejan decisiones registradas, así que una
   run tocada con ellas no se puede rehacer.

   El límite honesto: el combate es casi todo automático, así que un
   programa que juegue la run (eligiendo caminos y capturas) saca una prueba
   válida; lo que queda fuera es inventar el puntaje, el equipo o el tiempo. */
import M from '../../../../../juegos/club/pokelike/motor.js';
import { dosRelojes } from './patrones.js';

export const PRUEBA = 1;

const CATS = { 'club-pokelike-puntos': 'puntos', 'club-pokelike-pokedex': 'pokedex' };
const MAX_PUNTOS = 1000000, MAX_DECISIONES = 60000;
// Un turno animado no baja de unos 250 ms ni a ×4; se exige bastante menos.
const MS_POR_TURNO = 100;

export function verifica(dato, prueba, ctx) {
  const tabla = dato && CATS[dato.categoria];
  if (!tabla) return 'Pokelike no tiene esa tabla.';
  if (!prueba || typeof prueba !== 'object' || Array.isArray(prueba)) return 'La prueba de Pokelike no tiene la forma esperada.';
  if (prueba.v !== 1) return 'La prueba es de otra versión de Pokelike (recarga la página).';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string' || !prueba.u) return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la partida no es válida.';
  const puntos = Number(dato.puntos), tiempo = Number(dato.tiempo);
  if (!(Number.isSafeInteger(puntos) && puntos >= 1 && puntos <= MAX_PUNTOS)) return 'El número de la tabla no es válido.';
  if (!Number.isSafeInteger(tiempo) || tiempo < 1) return 'El tiempo no es válido.';
  const reloj = dosRelojes(prueba.a, prueba.w);
  if (reloj) return reloj;
  if (!Number.isFinite(prueba.a) || Math.abs(prueba.a - tiempo) > 1000) return 'El tiempo declarado no es el que marcó el juego.';
  if (typeof prueba.d !== 'string' || !prueba.d) return 'Las decisiones de la prueba no se pueden leer.';
  const decisiones = prueba.d.split(' ');
  if (decisiones.length > MAX_DECISIONES) return 'La prueba trae demasiadas decisiones.';
  const res = M.rehace(prueba.s, prueba.u, prueba.i, decisiones);
  if (res.error) return res.error;
  const turnos = decisiones.filter(t => t === 'a' || t[0] === 'x').length;
  if (tiempo < turnos * MS_POR_TURNO) return `${turnos} turnos en ${(tiempo / 1000).toFixed(1)} s: más rápido de lo que el juego permite.`;
  const real = tabla === 'puntos' ? M.puntaje(res.run) : M.atrapados(res.run);
  if (real !== puntos) return tabla === 'puntos'
    ? `La partida rehecha suma ${real} puntos, no ${puntos}.`
    : `En la partida rehecha pasaron ${real} especies por el equipo, no ${puntos}.`;
  return null;
}

/* Una fila ya guardada, sin su prueba a mano: solo se pueden mirar topes. */
export function sospecha(categoria, fila) {
  const tabla = CATS[categoria];
  if (!tabla || !fila) return null;
  const p = Number(fila.puntos);
  if (!Number.isFinite(p)) return null;
  if (tabla === 'pokedex') return p > 151 ? `${p} especies: Kanto tiene 151.` : null;
  return p > MAX_PUNTOS ? `${p} puntos: más de lo que la tabla admite.` : null;
}
