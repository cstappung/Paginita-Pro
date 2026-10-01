// Las armas, por id. El id es el `a` que viaja en el registro y en los golpes,
// así que nunca se renumeran: 0–2 son las tres de siempre, 3 la granada, 4 la
// autodestrucción y de la 5 en adelante las nuevas. Se parte con el cuchillo
// y el resto aparece tirado en el mapa (EN_SUELO); se cargan dos como mucho,
// sin contar el cuchillo. Cada arma de fuego trae su cargador y RECARGAS
// cargadores de repuesto por vida. dispersion en radianes aprox; cadencia y
// recarga en segundos.
export const RECARGAS = 5;
export const CUCHILLO = 5;

export const ARMAS = {
  5: {
    id: 5, nombre: 'Cuchillo', corto: '🔪', melee: true,
    danio: 55, cabeza: 1.5, cadencia: 0.45, alcance: 2.4, color: '#c9ccd6',
  },
  0: {
    id: 0, nombre: 'Batidora', corto: 'Metralleta', auto: true,
    danio: 17, cabeza: 1.5, perdigones: 1,
    cadencia: 0.1, cargador: 30, recarga: 1.8,
    dispersion: 0.012, dispMov: 0.03, alcance: 150, caidaDesde: 999,
    retroceso: 0.012, color: '#e85d5d',
  },
  1: {
    id: 1, nombre: 'Revuelta', corto: 'Escopeta', auto: false,
    danio: 12, cabeza: 1.25, perdigones: 9,
    cadencia: 0.85, cargador: 6, recarga: 2.2,
    dispersion: 0.075, dispMov: 0.02, alcance: 60, caidaDesde: 8,
    retroceso: 0.05, color: '#4a9be8',
  },
  2: {
    id: 2, nombre: 'Poché', corto: 'Sniper', auto: false, zoom: true,
    danio: 90, cabeza: 2, perdigones: 1,
    cadencia: 1.3, cargador: 5, recarga: 2.6,
    dispersion: 0.07, dispMov: 0.05, dispZoom: 0, alcance: 250, caidaDesde: 999,
    retroceso: 0.06, color: '#3fbf6a',
  },
  6: {
    id: 6, nombre: 'Benedictina', corto: 'Bazuca', cohete: true,
    danio: 130, radio: 4.5, velocidad: 34,
    cadencia: 1.2, cargador: 1, recarga: 2.2,
    retroceso: 0.08, color: '#7d8f3c',
  },
  7: {
    id: 7, nombre: 'Pasado por agua', corto: 'Pistola', auto: false,
    danio: 34, cabeza: 2, perdigones: 1,
    cadencia: 0.32, cargador: 6, recarga: 1.6,
    dispersion: 0.008, dispMov: 0.02, alcance: 120, caidaDesde: 999,
    retroceso: 0.03, color: '#d9a441',
  },
};

// Las que aparecen tiradas en el mapa.
export const EN_SUELO = [0, 1, 2, 6, 7];

// Los nombres por id, también los que no son armas de mano (para el feed).
export const NOMBRE_ARMA = {
  0: 'Batidora', 1: 'Revuelta', 2: 'Poché', 3: 'Huevo duro', 4: 'Autodestrucción',
  5: 'Cuchillo', 6: 'Benedictina', 7: 'Pasado por agua',
};

// Las granadas que se eligen para cada vida (dos, de cualquier tipo).
export const GRANADAS = {
  duro: { nombre: 'Huevo duro', icono: '🥚' },
  humo: { nombre: 'Humo', icono: '💨' },
  luz: { nombre: 'Cegadora', icono: '💡' },
};
export const TIPOS_GRANADA = Object.keys(GRANADAS);

// Multiplicador de daño por distancia (sólo afecta a la escopeta)
export function caida(arma, dist) {
  if (dist <= (arma.caidaDesde ?? 999)) return 1;
  return Math.max(0.25, 1 - (dist - arma.caidaDesde) / 25);
}

// Qué arma hay en el punto `s` del mapa en su aparición número `g`: sale de
// la semilla de la sala, así que todas las pantallas ven la misma.
export function armaEnPunto(semilla, s, g) {
  let h = (semilla ^ Math.imul(s + 1, 0x9E3779B1) ^ Math.imul(g + 1, 0x85EBCA6B)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7FEB352D) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846CA68B) >>> 0;
  return EN_SUELO[((h ^ (h >>> 16)) >>> 0) % EN_SUELO.length];
}
