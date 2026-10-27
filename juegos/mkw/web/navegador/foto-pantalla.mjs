// ¿La foto del juego muestra la pantalla partida en dos? (para las pruebas con el juego) — bitácora §73.
//
// Resumen: con dos jugadores locales el juego dibuja dos vistas, una arriba y otra abajo. En la sala nueva cada consola
// tiene que dibujar UNA (la de su piloto), y la memoria del juego no lo dice todo (la tabla de pantallas decía 1 y la
// imagen salía partida). Esto mira la imagen misma: compara cada fila de píxeles con la de arriba. Dentro de una vista
// las filas vecinas se parecen (la imagen es continua); en la costura entre dos vistas cambian de golpe. Si el salto
// en el medio de la imagen es mucho más grande que el salto típico, está partida. Como buscar un escalón en una señal:
// la derivada tiene un pico donde está el escalón.
//
// Uso (Node, con Playwright):  const r = await pantallaPartida(pagina, await pagina.locator('#canvas').screenshot());
//                              r.partida (true/false), r.vacia (foto sin imagen), r.pico, r.tipico
// (Calibrado con fotos de verdad: partidas pico 17,7 y 21 con típico 3,5; una sola vista ≤ 4,7, o 10,5 con típico 6,4 en
// la pantalla de personaje. Partida = pico > 12 y más de 4 veces el típico.)
// §75: y la costura tiene que cruzar la imagen (`ancho`: la parte de las columnas que salta de verdad en esa fila, más
// de 0,3). Una raya del juego que cae justo en el medio —la del globo con el nombre del otro piloto, que en la largada
// está a esa altura— salta mucho pero en pocas columnas (pico 15,2 con ancho 0,16): no es una costura. Partidas armadas
// juntando dos fotos de verdad: ancho de 0,43 a 1.
// §79: desde que la imagen es siempre 16:9, el canvas puede traer barras negras arriba y abajo (si su recuadro es más
// alto que 16:9). Se recortan antes de medir: el "medio" es el de la imagen del juego y el salto típico se calcula con
// filas de imagen (las filas negras de las barras, todas iguales, lo bajaban y cualquier borde parecía costura).
// Y un borde de la pista que cae justo en el medio (la raya de la largada con el kart quieto) se ve igual que una
// costura en UNA foto: quien llama saca dos con el kart andando (`dosFotosPartidas`): la costura no se mueve.
export async function pantallaPartida(pagina, png) {
  return pagina.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const lienzo = new OffscreenCanvas(img.width, img.height), g = lienzo.getContext('2d');
    g.drawImage(img, 0, 0);
    const { data, width: W, height: H } = g.getImageData(0, 0, img.width, img.height);
    const luz = (x, y) => { const i = (y * W + x) * 4; return 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]; };
    // salto[y]: cuánto cambia, en promedio, cada píxel de la fila y respecto de la fila y−1 (cada 2 columnas basta)
    const salto = new Float64Array(H);
    for (let y = 1; y < H; y++) {
      let s = 0;
      for (let x = 0; x < W; x += 2) s += Math.abs(luz(x, y) - luz(x, y - 1));
      salto[y] = s / Math.ceil(W / 2);
    }
    // §79: las barras negras de arriba y de abajo (filas oscuras de punta a punta, sin contar el 6 % de cada costado:
    // ahí están las esquinas redondeadas del marco). La imagen empieza donde hay 4 filas con luz seguidas (así el borde
    // de 1 px del marco no corta la búsqueda). Si quedara menos del 30 % de la foto, no se recorta (foto negra).
    const fila = y => { let m = 0; for (let x = Math.round(W * 0.06); x < W * 0.94; x += 3) m = Math.max(m, luz(x, y)); return m; };
    const conLuz = (y, paso) => [0, 1, 2, 3].every(k => fila(y + k * paso) >= 10);
    let arriba = 0, abajo = H - 1;
    while (arriba < H - 4 && !conLuz(arriba, 1)) arriba++;
    while (abajo > arriba + 3 && !conLuz(abajo, -1)) abajo--;
    if (abajo - arriba < H * 0.3) { arriba = 0; abajo = H - 1; }
    const alto = abajo - arriba + 1;
    const medio = Math.round((arriba + abajo + 1) / 2);
    let pico = 0, filaPico = medio;
    for (let y = medio - 3; y <= medio + 3; y++) if (salto[y] > pico) { pico = salto[y]; filaPico = y; }
    // ancho: en la fila del pico, la parte de las columnas donde la luz cambia más de 24 (de 255)
    let saltan = 0;
    for (let x = 0; x < W; x += 2) if (Math.abs(luz(x, filaPico) - luz(x, filaPico - 1)) > 24) saltan++;
    const ancho = saltan / Math.ceil(W / 2);
    // el salto típico: la mediana de las filas del 15 % al 85 % de la altura, sin las de cerca del medio
    const resto = [];
    for (let y = arriba + Math.round(alto * 0.15); y < arriba + Math.round(alto * 0.85); y++) if (Math.abs(y - medio) > 6) resto.push(salto[y]);
    resto.sort((a, b) => a - b);
    const tipico = resto[resto.length >> 1] || 0;
    // vacia: la foto es pareja (sin imagen: el lienzo puede salir en blanco si se fotografía entre dos cuadros)
    return { partida: pico > 12 && pico > 4 * Math.max(tipico, 1) && ancho > 0.3, vacia: tipico < 0.3 && pico < 0.3,
             pico: +pico.toFixed(1), tipico: +tipico.toFixed(1), ancho: +ancho.toFixed(2), alto: H, barras: H - alto };
  }, png.toString('base64'));
}

// Dos fotos separadas por `ms` (con el kart andando): partida solo si las DOS muestran la costura (una costura de
// verdad no se mueve; un borde de la pista baja por la imagen cuando el kart avanza). `sacar()` devuelve el png.
// Devuelve el resultado de la primera, con `partida` = las dos, y `segunda` = el de la otra.
export async function dosFotosPartidas(pagina, sacar, ms = 1500) {
  const png1 = await sacar();
  const r1 = png1 && await pantallaPartida(pagina, png1);
  await new Promise(listo => setTimeout(listo, ms));
  const png2 = await sacar();
  const r2 = png2 && await pantallaPartida(pagina, png2);
  if (!r1 || !r2) return r1 || r2 || null;
  return { ...r1, partida: r1.partida && r2.partida, vacia: r1.vacia && r2.vacia, segunda: r2 };
}
