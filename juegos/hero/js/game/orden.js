// En una sala, tu autopista va al centro: con 3 en el medio, con 4 en la del
// centro a la izquierda (con 2, a la izquierda). Los demás siguen en el orden
// de la sala. Puro, para tests/hero.test.cjs.
export function enElCentro(players) {
  const yo = players.find((p) => p.type === 'local');
  if (!yo) return players;
  const otros = players.filter((p) => p !== yo);
  otros.splice(Math.floor((players.length - 1) / 2), 0, yo);
  return otros;
}
