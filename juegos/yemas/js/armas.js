// Las tres armas. dispersion en radianes aprox; cadencia y recarga en segundos.
export const ARMAS = [
  {
    nombre: 'Batidora', auto: true,
    danio: 17, cabeza: 1.5, perdigones: 1,
    cadencia: 0.1, cargador: 30, recarga: 1.8,
    dispersion: 0.012, dispMov: 0.03, alcance: 150, caidaDesde: 999,
    retroceso: 0.012, color: '#e85d5d',
  },
  {
    nombre: 'Revuelta', auto: false,
    danio: 12, cabeza: 1.25, perdigones: 9,
    cadencia: 0.85, cargador: 6, recarga: 2.2,
    dispersion: 0.075, dispMov: 0.02, alcance: 60, caidaDesde: 8,
    retroceso: 0.05, color: '#4a9be8',
  },
  {
    nombre: 'Poché', auto: false, zoom: true,
    danio: 90, cabeza: 2, perdigones: 1,
    cadencia: 1.3, cargador: 5, recarga: 2.6,
    dispersion: 0.07, dispMov: 0.05, dispZoom: 0, alcance: 250, caidaDesde: 999,
    retroceso: 0.06, color: '#3fbf6a',
  },
];

// Multiplicador de daño por distancia (sólo afecta a la escopeta)
export function caida(arma, dist) {
  if (dist <= arma.caidaDesde) return 1;
  return Math.max(0.25, 1 - (dist - arma.caidaDesde) / 25);
}
