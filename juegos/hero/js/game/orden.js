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

/* Dónde va cada autopista, en píxeles de la ventana. Hasta 3, en columnas
   iguales. Con 4 o más, tú (`yo`) en grande al medio y los demás en dos
   columnas angostas a los lados, de arriba abajo: 4 → 2·1·1, 5 → 2·1·2,
   6 → 3·1·2, 7 → 3·1·3, 8 → 4·1·3. Las de los lados miden todas lo mismo (la
   columna corta va centrada) y caen en píxeles enteros del dispositivo, para
   que compartan el mástil pintado (highway.js, `_neck`). Pura, para
   tests/hero.test.cjs (session.js, `_views`). */
export function vistas(players, yo, w, hh, dpr = 1) {
  const n = players.length;
  if (n <= 3) return players.map((p, i) => [p, n === 1 ? { x: 0, y: 0, w, h: hh } : { x: (i * w) / n, y: 0, w: w / n, h: hh }]);
  const px = (v) => Math.round(v * dpr) / dpr;
  const centro = players.includes(yo) ? yo : players[Math.floor((n - 1) / 2)];
  const otros = players.filter((p) => p !== centro);
  const izq = otros.slice(0, Math.ceil(otros.length / 2)), der = otros.slice(izq.length);
  const filas = izq.length;
  const alto = Math.floor((hh / filas) * dpr) / dpr;
  // un poco más ancha que alta, para que quepa el marcador a la derecha de la autopista
  const ancho = Math.floor(Math.min(w * 0.28, alto * 1.15) * dpr) / dpr;
  const out = [[centro, { x: ancho, y: 0, w: px(w - 2 * ancho), h: hh }]];
  const columna = (lista, x) => {
    const y0 = px((hh - lista.length * alto) / 2);
    lista.forEach((p, i) => out.push([p, { x, y: y0 + i * alto, w: ancho, h: alto }]));
  };
  columna(izq, 0);
  columna(der, px(w - ancho));
  return out;
}
