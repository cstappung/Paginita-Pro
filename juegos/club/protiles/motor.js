/* El motor de PRO TILES: las canciones, el compositor infinito y todo lo
   que decide una partida (dónde cae cada ficha, a qué velocidad baja la
   pantalla, cuándo se escapa una, cuánto vale cada nota) y nada que se
   dibuje o suene. juego.js lo usa para jugar y el verificador antitrampas
   (colabtex/src/juegos/solo/verifica/protiles.js) para rehacer la partida
   desde su prueba: la semilla, la cuenta y el tick de cada nota tocada.

   Repetible en cualquier navegador y en Node:
   - **El tiempo es fijo** (`TICK_MS`, 4 ms). La pantalla puede ir a 30, 60
     o 144 cuadros: solo cambia cuántos pasos corren por cuadro.
   - **Solo + − × ÷** en lo que decide (la curva de velocidad usa `expNeg`,
     una exponencial hecha a mano, porque `Math.exp` no da el mismo último
     bit en todos los motores); el azar es mulberry32 con semilla.
   - **La melodía es la misma para todos** (cada canción empieza igual,
     como en el original); los carriles salen de la semilla mezclada con la
     cuenta, así que una prueba copiada de otra persona no rehace la misma
     partida.
   - Geometría en filas: la pantalla mide `FILAS` (4) de alto, la fila 0 es
     el borde de abajo. Una ficha de inicio `s` tiene su borde de abajo en
     la fila `FILAS - (s - pos)` contando desde arriba.
   - Una ficha se escapa (y la partida termina) cuando salió más de la
     mitad de su largo por abajo; en las pruebas de la versión 1, apenas
     pasaba 0,15 filas del borde. */
(function (root) {
  'use strict';
  /* =========================================================
     CANCIONES ORIGINALES
     Todo se escribe en grados de la escala (0 = tónica en "mel", 7 = una octava arriba),
     así el compositor puede variar, transponer y modular sin salirse de la tonalidad.
     Fila = corchea; compás = 8 filas.
     hook: estribillo fijo (8 compases, "grado:filas") — la identidad de cada canción
     prog: acordes por compás en grados (0 = I/i); [a,b] = dos acordes en el compás
     ========================================================= */
  /* Versión 1: las canciones con que se estrenó el juego. Ya no se juegan;
     quedan para que el verificador rehaga las pruebas guardadas con ellas. */
  const SONGS_V1 = [
    { id:'cristal', name:'Cristal', genre:'Balada pop', bpm:76, diff:1, mode:'major', mel:67, style:'ballad', range:[-2,9], rhy:{ straight:2, sync:0, slow:3 },
      prog:{ v:[0,4,5,3], p:[5,3,0,4], c:[0,4,5,3,0,4,5,3], b:[5,3,0,4,5,3,4,4] },
      hook:`4:2 4:2 5:1 4:3 | 2:2 1:2 2:4 | 4:2 4:2 5:1 7:3 | 7:2 5:2 4:4 | 4:2 4:2 5:1 4:3 | 2:2 1:2 4:4 | 5:2 4:2 2:1 4:3 | 2:2 1:2 0:4` },
    { id:'medianoche', name:'Medianoche', genre:'Lo-fi R&B', bpm:84, diff:1, mode:'major', mel:65, sev:true, style:'lofi', range:[1,10], rhy:{ straight:2, sync:2, slow:2 },
      prog:{ v:[1,4,0,5], p:[3,2,1,4], c:[1,4,0,5,1,4,0,5], b:[3,4,2,5,1,4,0,0] },
      hook:`8:1 7:1 5:2 4:1 5:3 | 6:1 4:1 6:2 8:4 | 9:1 8:1 6:2 4:1 6:3 | 7:2 5:6 | 8:1 7:1 5:2 4:1 5:3 | 6:1 4:1 6:2 8:4 | 9:2 10:1 9:1 8:2 6:2 | 7:2 4:6` },
    { id:'calle', name:'Calle', genre:'Reggaetón', bpm:94, diff:2, mode:'minor', mel:74, style:'reggaeton', range:[-2,7], rhy:{ straight:1, sync:4, slow:0 },
      prog:{ v:[0,5,2,6], p:[5,6,0,0], c:[0,5,2,6,0,5,2,6], b:[5,2,6,0,5,2,6,6] },
      hook:`4:1 4:1 4:1 2:2 4:1 5:2 | 4:2 2:1 0:3 2:2 | 2:1 2:1 2:1 0:2 2:1 3:2 | 2:3 1:3 -1:2 | 4:1 4:1 4:1 2:2 4:1 5:2 | 4:2 2:1 0:3 2:2 | 2:1 2:1 2:1 4:2 3:1 2:2 | 1:2 0:6` },
    { id:'verano', name:'Verano', genre:'Tropical house', bpm:100, diff:2, mode:'major', mel:72, style:'tropical', range:[-2,8], rhy:{ straight:1, sync:4, slow:1 },
      prog:{ v:[5,3,0,4], p:[3,4,5,4], c:[5,3,0,4,5,3,0,4], b:[3,0,4,5,3,0,4,4] },
      hook:`2:3 2:3 4:2 | 5:3 4:3 2:2 | 2:2 1:1 2:1 4:2 2:2 | 1:3 0:1 1:4 | 2:3 2:3 4:2 | 5:3 7:3 5:2 | 4:2 2:1 4:1 5:2 4:2 | 4:1 2:1 1:6` },
    { id:'neon', name:'Neón', genre:'Synthwave', bpm:108, diff:3, mode:'minor', mel:65, style:'synth', range:[-3,8], rhy:{ straight:3, sync:2, slow:1 },
      prog:{ v:[0,5,2,6], p:[3,5,6,6], c:[5,6,0,0,5,6,5,[6,0]], b:[3,5,2,6,3,5,6,6] },
      hook:`4:2 4:1 5:1 4:2 2:2 | 3:1 2:1 3:2 4:4 | 4:2 4:1 5:1 4:2 7:2 | 6:1 4:1 2:2 0:4 | 4:2 4:1 5:1 4:2 2:2 | 3:1 2:1 3:2 4:4 | 4:2 4:1 5:1 4:2 2:2 | 3:1 2:1 1:2 0:4` },
    { id:'latido', name:'Latido', genre:'Disco pop', bpm:116, diff:3, mode:'minor', mel:71, style:'disco', range:[-2,9], rhy:{ straight:3, sync:2, slow:0 },
      prog:{ v:[0,3,6,2], p:[5,6,0,6], c:[0,3,6,2,0,3,6,2], b:[5,2,6,3,5,2,6,6] },
      hook:`4:1 4:1 2:2 4:1 7:1 4:2 | 3:1 3:1 0:2 3:1 5:1 3:2 | 1:1 1:1 6:2 5:1 6:1 8:2 | 7:2 6:1 4:1 2:4 | 4:1 4:1 2:2 4:1 7:1 4:2 | 3:1 3:1 0:2 3:1 5:1 3:2 | 6:1 6:1 8:2 9:1 8:1 6:2 | 4:2 2:2 0:4` },
    { id:'estrellas', name:'Estrellas', genre:'K-pop', bpm:118, diff:4, mode:'minor', mel:69, style:'kpop', range:[0,10], rhy:{ straight:2, sync:4, slow:0 },
      prog:{ v:[0,5,6,4], p:[3,4,5,6], c:[3,4,2,5,3,4,0,0], b:[5,6,2,4,5,6,4,4] },
      hook:`7:1 7:2 5:1 7:2 8:2 | 6:1 6:2 4:1 6:2 8:2 | 9:1 8:1 7:2 6:1 4:3 | 5:2 7:2 5:4 | 7:1 7:2 5:1 7:2 8:2 | 6:1 6:2 4:1 6:2 8:2 | 9:1 8:1 7:1 8:1 9:2 11:2 | 9:2 7:6` },
    { id:'despegue', name:'Despegue', genre:'EDM', bpm:124, diff:4, mode:'minor', mel:64, style:'edm', range:[-2,8], rhy:{ straight:4, sync:2, slow:0 },
      prog:{ v:[0,5,2,6], p:[5,6,0,6], c:[5,6,0,0,5,6,2,6], b:[3,3,5,5,6,6,6,6] },
      hook:`4:1 4:1 7:1 4:1 5:2 4:1 2:1 | 3:1 3:1 6:1 3:1 4:2 3:1 1:1 | 2:1 2:1 4:1 2:1 7:2 4:2 | 4:2 2:2 0:4 | 4:1 4:1 7:1 4:1 5:2 4:1 2:1 | 3:1 3:1 6:1 3:1 4:2 3:1 1:1 | 2:1 2:1 4:1 2:1 6:2 4:2 | 3:2 1:2 0:4` },
  ];
  /* Versión 2 (la que se juega): las mismas ocho ideas, reescritas sobre el
     ritmo que define a cada género hoy. `cells` son los ritmos de compás de
     la estrofa (en corcheas, suman 8): el tresillo 3-3-2 del dembow y del
     tropical, las corcheas seguidas del synthwave y del EDM, el empuje de
     octavas del disco, la síncopa del K-pop, el arrastre del lo-fi.
     Progresiones de ahora: I–V–vi–IV y vi–IV–I–V (balada), ii–V–I con
     séptimas (lo-fi), i–VI–III–VII (reggaetón), IV–I–V–vi (tropical),
     VI–VII–i (synthwave, K-pop, EDM). */
  const SONGS = [
    { id:'cristal', name:'Cristal', genre:'Balada pop', bpm:72, diff:1, mode:'major', mel:67, style:'ballad', range:[-2,9],
      cells:[[2,2,4],[2,1,1,4],[3,1,2,2],[2,2,2,2],[4,2,2],[1,1,2,4],[3,1,4]],
      prog:{ v:[0,4,5,3], p:[3,4,1,4], c:[5,3,0,4,5,3,0,4], b:[3,0,4,5,3,0,4,4] },
      hook:`5:2 7:2 7:1 9:3 | 7:1 8:1 7:2 5:4 | 4:2 4:1 5:1 7:2 9:2 | 8:2 6:2 4:4 | 5:2 7:2 7:1 9:3 | 7:1 8:1 7:2 10:4 | 9:2 9:1 8:1 7:2 4:2 | 8:1 7:1 6:2 4:4` },
    { id:'medianoche', name:'Medianoche', genre:'Lo-fi R&B', bpm:82, diff:1, mode:'major', mel:65, sev:true, style:'lofi', range:[1,10],
      cells:[[3,1,2,2],[1,2,1,4],[2,1,1,4],[3,3,2],[1,1,2,4],[2,2,4],[1,2,1,2,2]],
      prog:{ v:[1,4,0,5], p:[3,2,1,4], c:[3,2,5,0,3,2,1,4], b:[5,1,4,0,3,2,1,4] },
      hook:`7:3 5:1 7:2 9:2 | 8:1 6:1 4:2 6:4 | 4:3 5:1 7:2 9:2 | 9:2 7:1 8:1 7:4 | 7:3 5:1 7:2 9:2 | 8:1 6:1 4:2 8:4 | 10:2 8:1 7:1 5:2 3:2 | 8:1 6:1 4:6` },
    { id:'calle', name:'Calle', genre:'Reggaetón', bpm:92, diff:2, mode:'minor', mel:69, style:'reggaeton', range:[-2,7],
      cells:[[3,3,2],[1,2,1,2,2],[2,1,2,1,2],[1,1,1,2,1,2],[3,1,1,1,2],[3,3,1,1]],
      prog:{ v:[0,5,2,6], p:[3,4,5,6], c:[0,5,2,6,0,5,2,6], b:[5,6,0,0,3,3,4,4] },
      hook:`4:3 4:3 2:2 | 2:1 2:1 2:1 0:2 2:1 0:2 | 4:3 4:3 6:2 | 6:1 5:1 3:2 1:1 3:3 | 7:3 7:3 4:2 | 5:1 5:1 5:1 7:2 5:1 4:2 | 4:1 4:1 4:1 2:2 4:1 6:2 | 3:3 1:3 -1:2` },
    { id:'verano', name:'Verano', genre:'Tropical house', bpm:102, diff:2, mode:'major', mel:72, style:'tropical', range:[-2,8],
      cells:[[3,3,2],[1,2,1,2,2],[2,1,1,2,2],[3,1,2,2],[1,1,1,1,2,2],[3,3,1,1]],
      prog:{ v:[5,3,0,4], p:[1,3,4,4], c:[3,0,4,5,3,0,4,5], b:[5,4,3,0,5,4,3,4] },
      hook:`5:3 5:3 3:2 | 4:1 2:1 4:1 2:2 0:1 2:2 | 4:3 4:3 6:2 | 7:1 5:1 7:2 5:4 | 5:3 5:3 7:2 | 9:1 7:1 9:1 7:2 4:1 7:2 | 8:3 6:3 4:2 | 2:1 4:1 5:6` },
    { id:'neon', name:'Neón', genre:'Synthwave', bpm:110, diff:3, mode:'minor', mel:65, style:'synth', range:[-3,8],
      cells:[[1,1,1,1,2,2],[2,1,1,2,2],[2,2,1,1,2],[1,1,2,1,1,2],[2,2,2,2],[3,1,2,2]],
      prog:{ v:[0,5,2,6], p:[3,4,5,6], c:[5,6,0,4,5,6,0,0], b:[3,5,0,6,3,5,6,6] },
      hook:`7:1 7:1 9:1 7:1 5:2 7:2 | 8:1 8:1 10:1 8:1 6:2 8:2 | 9:1 7:1 4:2 9:1 7:1 4:2 | 8:2 6:2 4:4 | 7:1 7:1 9:1 7:1 5:2 7:2 | 8:1 8:1 10:1 8:1 10:2 6:2 | 7:1 9:1 11:2 9:1 7:1 4:2 | 7:2 4:1 2:1 0:4` },
    { id:'latido', name:'Latido', genre:'Disco pop', bpm:118, diff:3, mode:'minor', mel:71, style:'disco', range:[-2,9],
      cells:[[1,1,2,1,1,2],[2,1,1,2,2],[1,2,1,2,2],[2,2,1,1,2],[1,1,2,2,2],[3,1,3,1]],
      prog:{ v:[0,3,6,2], p:[5,6,3,4], c:[0,3,6,2,0,3,6,2], b:[5,6,0,0,5,6,4,4] },
      hook:`4:1 4:1 7:2 4:1 4:1 2:2 | 5:1 5:1 7:2 5:1 3:1 0:2 | 6:1 6:1 8:2 6:1 6:1 3:2 | 4:2 2:1 4:1 6:4 | 7:1 7:1 9:2 7:1 7:1 4:2 | 7:1 7:1 10:2 7:1 5:1 3:2 | 8:1 6:1 8:1 10:1 8:2 6:2 | 6:2 4:2 2:4` },
    { id:'estrellas', name:'Estrellas', genre:'K-pop', bpm:122, diff:4, mode:'minor', mel:66, style:'kpop', range:[0,10],
      cells:[[1,2,1,2,2],[1,1,2,1,1,2],[3,3,2],[2,1,1,1,1,2],[1,2,1,1,1,2],[2,2,1,1,2]],
      prog:{ v:[0,5,3,6], p:[3,4,5,6], c:[5,6,0,0,5,6,2,4], b:[3,4,0,5,3,4,6,6] },
      hook:`7:1 7:2 9:1 7:2 5:2 | 8:1 8:2 10:1 8:2 6:2 | 9:1 9:2 11:1 9:2 7:1 4:1 | 7:3 9:1 7:4 | 7:1 7:2 9:1 7:2 5:2 | 8:1 8:2 10:1 8:2 10:2 | 11:1 11:1 9:2 11:1 9:1 6:2 | 8:2 6:2 4:4` },
    { id:'despegue', name:'Despegue', genre:'EDM', bpm:126, diff:4, mode:'minor', mel:64, style:'edm', range:[-2,8],
      cells:[[1,1,1,1,2,2],[1,1,2,1,1,2],[2,1,1,1,1,2],[1,2,1,1,2,1],[1,1,1,1,1,1,2],[2,2,1,1,2]],
      prog:{ v:[0,5,2,6], p:[3,3,5,6], c:[5,6,0,0,5,6,2,6], b:[3,3,5,5,6,6,6,6] },
      hook:`7:1 7:1 9:1 7:1 5:1 7:1 9:2 | 8:1 8:1 10:1 8:1 6:1 8:1 10:2 | 7:1 4:1 7:1 9:1 11:2 9:2 | 7:2 4:2 2:1 4:1 7:2 | 7:1 7:1 9:1 7:1 5:1 7:1 9:2 | 8:1 8:1 10:1 8:1 6:1 8:1 6:2 | 9:1 9:1 11:1 9:1 6:1 9:1 11:2 | 10:2 8:2 6:4` },
  ];

  /* Acompañamiento por estilo: patrones de 16 semicorcheas por compás.
     b bajo (R raíz, O octava, 5 quinta) · c acordes (x sostenido, p corto) · a arpegio
     k bombo · s caja (s) / aro (r) / aplauso (c) · h charles (h cerrado, o abierto)
     low = estrofa · mid = pre-estribillo · high = estribillo · brk = intro/puente
     Solo suenan: no deciden ninguna ficha, así que cambiarlos no toca las pruebas.
     Cada uno sigue el ritmo de su género: dembow (bombo en negras, caja en
     3-3-2), house (bombo en negras, charles abierto a contratiempo), boom bap
     del lo-fi, bajo en octavas del disco, Jersey club en el estribillo del
     K-pop, bajo a contratiempo del big room. */
  const STYLES = {
    ballad: { noRoll:true,
      low:  { b:'R.......5.......', a:'a.a.a.a.a.a.a.a.' },
      mid:  { b:'R.......5.......', a:'a.a.a.a.a.a.a.a.', k:'k.........k.....', s:'........r.......' },
      high: { b:'R.......5...R...', c:'x.......x.......', a:'a...a...a...a...', k:'k.........k.....', s:'....c.......c...', h:'..h...h...h...h.' },
      brk:  { b:'R...............', c:'x.......x.......' } },
    lofi: { noRoll:true,
      low:  { b:'R.....R.........', c:'x.........x.....', k:'k......k..k.....', s:'....s.......s...', h:'h.h.h.h.h.h.h.h.' },
      mid:  { b:'R.....R...5.....', c:'x.....x...x.....', k:'k......k..k.....', s:'....s.......s...', h:'h.h.h.h.h.h.h.h.' },
      high: { b:'R.....R...5.....', c:'x.....x...x.....', a:'..........a.a.a.', k:'k......k.kk.....', s:'....s.......s...', h:'h.hhh.h.h.hhh.h.' },
      brk:  { b:'R...............', c:'x...............', h:'h...h...h...h...' } },
    reggaeton: {
      low:  { b:'R..R....R..R....', c:'x...............', k:'k...k...k...k...', s:'...r..r....r..r.' },
      mid:  { b:'R..R....R..R....', c:'x.......x.......', k:'k...k...k...k...', s:'...s..s....s..s.', h:'h.h.h.h.h.h.h.h.' },
      high: { b:'R..R..R.R..R..R.', c:'...p..p....p..p.', k:'k...k...k...k...', s:'...s..s....s..s.', h:'h.hhh.h.h.hhh.h.' },
      brk:  { b:'R...............', c:'x...............', s:'...r..r....r..r.' } },
    tropical: {
      low:  { b:'R.......R.......', c:'..p...p...p...p.', h:'..h...h...h...h.' },
      mid:  { b:'R...R...R...R...', c:'..p...p...p...p.', k:'k...k...k...k...', s:'...r..r...r..r..', h:'..h...h...h...h.' },
      high: { b:'R..R..R.R..R..R.', c:'p..p..p...p..p..', k:'k...k...k...k...', s:'....c.......c...', h:'..o...o...o...o.' },
      brk:  { b:'R...............', c:'x.......x.......' } },
    synth: {
      low:  { b:'R.R.R.R.R.R.R.R.', c:'x...............', k:'k.......k.......', h:'..h...h...h...h.' },
      mid:  { b:'R.R.R.R.R.R.R.R.', c:'x.......x.......', k:'k...k...k...k...', s:'....s.......s...', h:'..h...h...h...h.' },
      high: { b:'R.O.R.O.R.O.R.O.', a:'a.a.a.a.a.a.a.a.', k:'k...k...k...k...', s:'....s.......s...', h:'h.h.h.h.h.h.h.h.' },
      brk:  { b:'R...............', c:'x...............' } },
    disco: {
      low:  { b:'R.O.R.O.R.O.R.O.', c:'..p...p...p...p.', k:'k...k...k...k...', h:'..h...h...h...h.' },
      mid:  { b:'R.O.R.O.R.O.R.O.', c:'..p...p...p...p.', k:'k...k...k...k...', s:'....c.......c...', h:'..h...h...h...h.' },
      high: { b:'R.O.R.O.R.O.R.O.', c:'..p...p...p...p.', k:'k...k...k...k...', s:'....c.......c...', h:'h.o.h.o.h.o.h.o.' },
      brk:  { b:'R...............', c:'x...............' } },
    kpop: {
      low:  { b:'R..R......R.....', c:'x...............', k:'k......k........', s:'....s.......s...', h:'h.h.h.h.h.h.h.h.' },
      mid:  { b:'R..R..R...R.R...', c:'p..p..p...p.....', k:'k..k..k...k.....', s:'....c.......c...', h:'hhhhhhhhhhhhhhhh' },
      high: { b:'R..R..R.O..R..R.', c:'p..p..p.p..p..p.', k:'k..k..k...k.k.k.', s:'....c.......c...', h:'h.h.h.h.h.h.h.h.' },
      brk:  { b:'R...............', c:'x.......x.......' } },
    edm: {
      low:  { b:'R.......R.......', c:'p...p...p...p...', k:'k.......k.......', h:'..h...h...h...h.' },
      mid:  { b:'R.R.R.R.R.R.R.R.', c:'p.p.p.p.p.p.p.p.', k:'k...k...k...k...', s:'c...c...c...c...', h:'..h...h...h...h.' },
      high: { b:'..R...R...R...R.', c:'p..p..p.p..p..p.', k:'k...k...k...k...', s:'....c.......c...', h:'..o...o...o...o.' },
      brk:  { b:'R...............', c:'x...............' } },
  };
  const RHY = {
    straight: [[2,2,2,2],[1,1,2,2,2],[2,1,1,2,2],[2,2,1,1,2],[1,1,1,1,2,2],[3,1,2,2],[2,2,2,1,1]],
    sync:     [[3,3,2],[1,2,1,2,2],[3,1,2,2],[1,2,1,1,1,2],[2,1,2,1,2],[1,1,2,1,1,2]],
    slow:     [[4,4],[2,2,4],[3,1,4],[2,6],[4,2,2],[6,2]],
    end:      [[2,2,4],[1,1,2,4],[3,1,4],[2,6],[4,4],[1,1,6]],
  };
  const DIFF = ['', 'Fácil', 'Normal', 'Difícil', 'Experto'];
  const HOLD = 3;                        // desde 3 corcheas la ficha es "larga"
  const SCALE = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10] };

  /* ---------- Utilidades ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (a, n) => ((a % n) + n) % n;
  const last = a => a[a.length - 1].idx;
  function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hashStr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  SONGS_V1.concat(SONGS).forEach(S => {
    S.tps = S.bpm * 2 / 60;
    S.tonic = S.mel % 12;
    S.hookBars = S.hook.split('|').map(b => b.trim().split(/\s+/).map(t => { const [i, l] = t.split(':'); return { idx: +i, len: +l }; }));
  });

  /* =========================================================
     COMPOSITOR INFINITO
     Cada canción se compone en secciones (estrofa, pre, estribillo, puente) sobre su
     progresión. El estribillo es fijo; el resto se genera con motivos que se repiten y
     se transportan dentro de la escala, como lo haría un compositor.
     ========================================================= */
  const idxToMidi = (S, idx, key) => S.mel + key + 12 * Math.floor(idx / 7) + SCALE[S.mode][mod(idx, 7)];
  const degPc = (S, deg, key) => mod(S.tonic + key + SCALE[S.mode][mod(deg, 7)] + 12 * Math.floor(deg / 7), 12);
  function isCT(S, idx, deg){ const d = mod(idx - deg, 7); return d === 0 || d === 2 || d === 4 || (S.sev && d === 6); }
  const chordsOf = e => Array.isArray(e) ? [{ deg: e[0], from: 0, to: 8 }, { deg: e[1], from: 8, to: 16 }] : [{ deg: e, from: 0, to: 16 }];
  const rep = (a, n) => Array.from({ length: n }, (_, i) => a[i % a.length]);
  function chordAt(chords, pos){ const st = pos * 2; for (const c of chords) if (st >= c.from && st < c.to) return c.deg; return chords[0].deg; }
  function pickRhythm(rng, S){
    if (S.cells) return pick(rng, S.cells);
    const w = S.rhy, tot = w.straight + w.sync + w.slow; let r = rng() * tot;
    return pick(rng, (r -= w.straight) < 0 ? RHY.straight : (r -= w.sync) < 0 ? RHY.sync : RHY.slow);
  }
  function genBar(rng, S, rhythm, chords, prev, target, range){
    const out = []; let pos = 0, cur = prev;
    rhythm.forEach(len => {
      const deg = chordAt(chords, pos), strong = pos % 2 === 0;
      let best = cur, bs = 1e9;
      for (let x = range[0]; x <= range[1]; x++){
        const ct = isCT(S, x, deg);
        if ((strong || len >= 2) && !ct) continue;            // en el pulso o notas largas: nota del acorde
        const leap = Math.abs(x - cur);
        let sc = leap + Math.abs(x - target) * .4 + rng() * 2.2;
        if (leap > 4) sc += 4;
        if (leap === 0){ const n = out.length; sc += n >= 2 && out[n - 1].idx === x && out[n - 2].idx === x ? 8 : .6; }
        if (!ct && leap > 1) sc += 3;                         // notas de paso: por grado conjunto
        if (sc < bs){ bs = sc; best = x; }
      }
      out.push({ idx: best, len }); cur = best; pos += len;
    });
    return out;
  }
  // Reutiliza un motivo (mismo ritmo y contorno) sobre otros acordes
  function refit(S, notes, chords, pref, range){
    let shift = 0, bs = 1e9;
    for (let sh = -3; sh <= 3; sh++){
      let sc = Math.abs(sh - pref) * .8, pos = 0;
      for (const n of notes){
        const x = n.idx + sh;
        if (x < range[0] || x > range[1]) sc += 4;
        if ((pos % 2 === 0 || n.len >= 2) && !isCT(S, x, chordAt(chords, pos))) sc += 2;
        pos += n.len;
      }
      if (sc < bs){ bs = sc; shift = sh; }
    }
    let pos = 0;
    return notes.map(n => {
      let x = n.idx + shift; const deg = chordAt(chords, pos);
      if ((pos % 2 === 0 || n.len >= 2) && !isCT(S, x, deg)) x = isCT(S, x + 1, deg) ? x + 1 : x - 1;
      pos += n.len;
      return { idx: clamp(x, range[0], range[1]), len: n.len };
    });
  }
  function cadence(rng, S, chords, prev, range, target){
    const rh = pick(rng, RHY.end), notes = genBar(rng, S, rh, chords, prev, target, range);
    const deg = chordAt(chords, 8 - rh[rh.length - 1]), p = notes.length > 1 ? notes[notes.length - 2].idx : prev;
    let best = p, bd = 99;
    for (let x = range[0]; x <= range[1]; x++){
      const d = mod(x - deg, 7); if (d !== 0 && d !== 2) continue;
      const dd = Math.abs(x - p) + Math.abs(x - target) * .3;
      if (dd < bd){ bd = dd; best = x; }
    }
    notes[notes.length - 1].idx = best;
    return notes;
  }
  const bars = (S, list, prog, arr, extra) => list.map((notes, i) => Object.assign({ chords: chordsOf(prog[i]), notes, arr }, extra ? extra(i) : {}));
  
  function secVerse(S, rng, prev){
    const R = S.range, mid = Math.round((R[0] + R[1]) / 2), pr = rep(S.prog.v, 8), ch = pr.map(chordsOf), rh = () => pickRhythm(rng, S);
    const m1 = genBar(rng, S, rh(), ch[0], prev, mid - 1, R), m2 = genBar(rng, S, rh(), ch[1], last(m1), mid, R);
    const m3 = refit(S, m1, ch[2], 0, R), m4 = refit(S, m2, ch[3], 0, R);
    const n1 = genBar(rng, S, rh(), ch[4], last(m4), mid + 2, R), n2 = genBar(rng, S, rh(), ch[5], last(n1), mid + 1, R);
    const m7 = refit(S, m1, ch[6], 0, R), m8 = cadence(rng, S, ch[7], last(m7), R, mid - 1);
    return bars(S, [m1, m2, m3, m4, n1, n2, m7, m8], pr, 'low');
  }
  function secPre(S, rng, prev){
    const R = S.range, mid = Math.round((R[0] + R[1]) / 2), pr = rep(S.prog.p, 4), ch = pr.map(chordsOf);
    const p1 = genBar(rng, S, pickRhythm(rng, S), ch[0], prev, mid, R);
    const p2 = refit(S, p1, ch[1], 1, R), p3 = refit(S, p1, ch[2], 2, R);       // secuencia ascendente
    const p4 = cadence(rng, S, ch[3], last(p3), R, R[1] - 1);
    return bars(S, [p1, p2, p3, p4], pr, 'mid', i => ({ roll: i === 3 }));
  }
  function secBridge(S, rng, prev){
    const R = [S.range[0], S.range[1] - 2], mid = Math.round((R[0] + R[1]) / 2), pr = rep(S.prog.b, 8), ch = pr.map(chordsOf);
    const q1 = genBar(rng, S, pick(rng, RHY.slow), ch[0], prev, mid, R), q2 = genBar(rng, S, pick(rng, RHY.slow), ch[1], last(q1), mid + 1, R);
    const q3 = refit(S, q1, ch[2], 0, R), q4 = refit(S, q2, ch[3], 0, R);
    const r1 = genBar(rng, S, pickRhythm(rng, S), ch[4], last(q4), mid + 1, R);
    const r2 = refit(S, r1, ch[5], 1, R), r3 = refit(S, r1, ch[6], 2, R), r4 = cadence(rng, S, ch[7], last(r3), R, R[1]);
    return bars(S, [q1, q2, q3, q4, r1, r2, r3, r4], pr, 'brk', i => ({ arr: i < 4 ? 'brk' : 'mid', roll: i === 7 }));
  }
  const secChorus = S => bars(S, S.hookBars.map(b => b.map(n => ({ ...n }))), rep(S.prog.c, 8), 'high', () => ({ chorus: true }));
  const secIntro = S => bars(S, S.hookBars.slice(0, 4).map(b => b.map(n => ({ ...n }))), rep(S.prog.c, 4), 'brk');
  
  function nextSection(g){
    const cp = g.comp;
    if (!cp.queue.length){
      if (g.kind === 'mara'){
        if (cp.cycle > 0){ cp.si = (cp.si + 1) % g.canciones.length; cp.S = g.canciones[cp.si]; cp.n = 0; }
        cp.queue = ['c', 'v', 'p', 'c'];
      } else cp.queue = cp.cycle === 0 ? ['intro', 'v', 'p', 'c', 'v', 'p', 'c', 'b', 'c'] : ['v', 'p', 'c', 'b', cp.cycle % 2 ? 'cmod' : 'c'];
      cp.cycle++;
    }
    const S = cp.S, type = cp.queue.shift();
    const rng = mulberry32(hashStr(S.id) + cp.n++ * 7919);      // determinista: la canción siempre empieza igual
    let list, key = 0;
    if (type === 'intro') list = secIntro(S);
    else if (type === 'v') list = secVerse(S, rng, cp.prev);
    else if (type === 'p') list = secPre(S, rng, cp.prev);
    else if (type === 'b') list = secBridge(S, rng, cp.prev);
    else { list = secChorus(S); if (type === 'cmod') key = 2; }  // último estribillo: sube un tono
    emit(g, S, list, key);
    cp.prev = last(list[list.length - 1].notes);
  }
  
  /* ---------- Acompañamiento ---------- */
  const bassMidi = (S, deg, key) => 36 + degPc(S, deg, key);                    // C2–B2
  function voicing(S, deg, key){
    const ds = [0, 2, 4].concat(S.sev ? [6] : []);
    return ds.map(d => 52 + mod(degPc(S, deg + d, key) - 52, 12)).sort((a, b) => a - b);  // E3–D#4
  }
  function accompBar(S, bar, R, key){
    const style = STYLES[S.style], st = style[bar.arr], ev = [];
    const at = i => { for (const c of bar.chords) if (i >= c.from && i < c.to) return c; return bar.chords[0]; };
    const nextIn = (pat, i, set) => { for (let j = i + 1; j < 16; j++) if (set.includes(pat[j])) return j; return 16; };
    const row = i => R + i * .5;
    let arp = 0;
    for (let i = 0; i < 16; i++){
      const c = at(i);
      const b = st.b && st.b[i];
      if (b && b !== '.'){
        const end = Math.min(nextIn(st.b, i, 'RO5'), c.to);
        ev.push({ row: row(i), notes: [bassMidi(S, c.deg, key) + (b === 'O' ? 12 : b === '5' ? 7 : 0)], vel: .3, len: (end - i) * .5 * .92 });
      }
      const x = st.c && st.c[i];
      if (x === 'x' || x === 'p'){
        const end = x === 'p' ? Math.min(i + 1.5, c.to) : Math.min(nextIn(st.c, i, 'xp'), c.to);
        ev.push({ row: row(i), notes: voicing(S, c.deg, key), vel: x === 'p' ? .14 : .11, len: (end - i) * .5 });
      }
      if (st.a && st.a[i] === 'a'){
        const v = voicing(S, c.deg, key), seq = [v[0], v[1], v[2], v[0] + 12, v[2], v[1]];
        ev.push({ row: row(i), notes: [seq[arp++ % seq.length]], vel: .13, len: 1.25 });
      }
      for (const p of [st.k, st.s, st.h]) if (p && p[i] !== '.') ev.push({ row: row(i), perc: p[i] });
      if (bar.roll && !style.noRoll) ev.push({ row: row(i), perc: 's', pv: .2 + .8 * i / 15 });
    }
    return ev.sort((a, b) => a.row - b.row);
  }

  /* =========================================================
     PARTIDA
     ========================================================= */
  const TICK_MS = 4, DT = TICK_MS / 1000;
  const FILAS = 4;              // filas visibles
  const ARRIBA = 4.35;          // se puede tocar desde que asoma (con el margen del dedo)
  const ESCAPE = 0.15;          // versión 1: pasada esta fracción de fila bajo el borde, se escapó
  /* Versión 2: una ficha se escapa cuando salió más de la mitad por abajo
     (la mitad de su largo, que en una larga son varias filas). Antes se
     perdía apenas tocaba el fondo (0,15 filas). */
  const PRUEBA_V = 2, PRUEBA_VERSIONES = [1, 2];
  const CANCIONES = { 1: SONGS_V1, 2: SONGS };
  const escapeDe = (E, t) => E.v === 1 ? ESCAPE : t.len / 2;
  const HOLD_MIN = 0.4;         // distancia mínima (filas) para completar una larga
  const MODOS = SONGS.map(S => S.id).concat(['mezcla']);

  // e^-x (x ≥ 0) solo con + − × ÷: se reduce a la mitad hasta ≤ 1/4, serie
  // de Taylor y se eleva al cuadrado de vuelta.
  function expNeg(x) {
    let k = 0;
    while (x > 0.25 && k < 64) { x /= 2; k++; }
    let s = 1, t = 1;
    for (let i = 1; i <= 12; i++) { t = t * -x / i; s += t; }
    while (k-- > 0) s *= s;
    return s;
  }
  const speedFactor = pos => 1 + .7 * (1 - expNeg(pos / 700)) + pos * .00008;

  function mezcla(s, n) {
    let h = Math.imul((s ^ Math.imul(n | 0, 0x9E3779B1)) >>> 0, 0x85EBCA6B);
    h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    return h >>> 0;
  }
  function hashTexto(t) {
    let h = 0x811C9DC5;
    for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  function emit(g, S, list, key) {
    for (const bar of list) {
      const R = g.genRow; let pos = 0;
      g.barRows.push(R);
      for (const n of bar.notes) {
        let lane;
        do { lane = Math.floor(g.rngLane() * 4); } while (lane === g.prevLane);
        g.prevLane = lane;
        const m = idxToMidi(S, n.idx, key);
        g.tiles.push({ s: R + pos, len: n.len, lane, midis: bar.chorus ? [m, m - 12] : [m], hold: n.len >= HOLD, S, state: 0, t: 0, prog: 0 });
        pos += n.len;
      }
      for (const e of accompBar(S, bar, R, key)) g.evq.push(e);
      g.genRow += 8;
    }
  }
  const asegura = g => { while (g.tiles.length - g.next < 48) nextSection(g); };

  /* Una partida nueva. `modo`: el id de una canción o 'mezcla' (las 8
     encadenadas). */
  function nueva(modo, semilla, u, v) {
    v = v == null ? PRUEBA_V : v;
    if (!PRUEBA_VERSIONES.includes(v)) throw new Error('versión desconocida: ' + v);
    const canciones = CANCIONES[v];
    const i = canciones.findIndex(S => S.id === modo);
    if (i < 0 && modo !== 'mezcla') throw new Error('modo desconocido: ' + modo);
    const S = canciones[Math.max(0, i)];
    const E = { modo, v, canciones, kind: i < 0 ? 'mara' : 'song', idx: Math.max(0, i), semilla: semilla >>> 0, u: String(u || ''),
      tiles: [], evq: [], barRows: [], genRow: 1, prevLane: -1,
      comp: { S, si: 0, cycle: 0, n: 0, queue: [], prev: Math.round((S.range[0] + S.range[1]) / 2) },
      next: 0, pos: 0, speed: S.tps, maxF: 1, started: false, over: false, t: 0,
      score: 0, hits: 0, hold: null, por: '' };
    E.rngLane = mulberry32(mezcla(E.semilla, hashTexto(E.u)));
    asegura(E);
    return E;
  }
  const actual = E => (E.tiles[E.next] || E.tiles[E.tiles.length - 1]).S;
  // Dónde está el borde de abajo de una ficha, en filas desde arriba.
  const bordeAbajo = (E, t, pos) => FILAS - (t.s - (pos == null ? E.pos : pos));
  const tocable = (E, t) => !!t && E.pos >= t.s - ARRIBA && E.pos <= t.s + escapeDe(E, t);

  function terminaLarga(E) {
    const h = E.hold;
    if (!h) return null;
    E.hold = null;
    const prog = clamp((E.pos - h.p0) / h.d, 0, 1);
    const bonus = prog >= .8 ? Math.max(1, Math.round(h.tile.len) - 2) : 0;
    E.score += bonus;
    return { tile: h.tile, bonus, prog };
  }

  /* Un paso de 4 ms. Devuelve lo que pasó para que la pantalla lo cuente:
     {larga} si una ficha larga se completó sola, {fallo: 'escape'} si una
     ficha se escapó (la partida termina). */
  function paso(E) {
    if (!E.started || E.over) return null;
    E.t++;
    const f = speedFactor(E.pos), target = actual(E).tps * f;
    E.speed += (target - E.speed) * Math.min(1, DT * 1.5);
    if (f > E.maxF) E.maxF = f;
    E.pos += E.speed * DT;
    let r = null;
    if (E.hold) {
      E.hold.prog = clamp((E.pos - E.hold.p0) / E.hold.d, 0, 1);
      if (E.hold.prog >= 1) r = { larga: terminaLarga(E) };
    }
    const t = E.tiles[E.next];
    if (t && E.pos > t.s + escapeDe(E, t)) { E.over = true; E.por = 'escape'; E.hold = null; return Object.assign(r || {}, { fallo: 'escape' }); }
    return r;
  }

  /* Tocar la ficha que toca. `dc` = en centésimas de fila, a qué altura
     sobre su borde de arriba se completa una ficha larga (con teclado, su
     largo entero; con el dedo, donde se tocó, desde 0,4 filas). Devuelve
     null si la ficha no se puede tocar ahora. */
  function golpe(E, dc) {
    if (E.over) return null;
    const t = E.tiles[E.next];
    if (!tocable(E, t)) return null;
    E.started = true;
    const fin = terminaLarga(E);
    E.hits++; E.next++; E.score += 1;
    if (t.hold) {
      const d = clamp((Number.isFinite(dc) ? dc : t.len * 100) / 100, HOLD_MIN, t.len);
      E.hold = { tile: t, p0: E.pos, d, prog: 0 };
    }
    asegura(E);
    return { tile: t, fin };
  }
  // Soltar la ficha larga que se mantiene (o el diseño cambió de tamaño).
  const suelta = E => terminaLarga(E);
  // Un toque fuera de una ficha termina la partida (la larga que se
  // mantenía no da su bono, como al escaparse una ficha).
  function falla(E) { if (E.over) return; E.hold = null; E.over = true; E.por = 'fuera'; }

  /* La prueba: cada acción con los ticks desde la anterior, en base 36.
     Una nota es el carril (a–d) y `dt`; una larga, `<carril>dt.dc`; soltar
     una larga, `rdt`. El carril ata la prueba a la semilla y la cuenta: los
     carriles salen de las dos. */
  function codifica(acciones) {
    let prev = 0;
    return acciones.map(a => {
      const d = (a.t - prev).toString(36); prev = a.t;
      return a.r ? 'r' + d : 'abcd'[a.l] + d + (a.dc != null ? '.' + a.dc.toString(36) : '');
    }).join(',');
  }
  function decodifica(g) {
    if (typeof g !== 'string' || g.length > 190000) return null;
    if (!g) return [];
    const out = []; let t = 0;
    for (const p of g.split(',')) {
      const m = /^([a-dr])([0-9a-z]{1,7})(?:\.([0-9a-z]{1,3}))?$/.exec(p);
      if (!m || (m[1] === 'r' && m[3])) return null;
      t += parseInt(m[2], 36);
      if (m[1] === 'r') { out.push({ t, r: true }); continue; }
      const a = { t, l: 'abcd'.indexOf(m[1]) };
      if (m[3]) a.dc = parseInt(m[3], 36);
      out.push(a);
    }
    return out;
  }

  /* Rehace una partida: toca en los ticks dichos y tiene que terminar en el
     tick `n` (escapándose una ficha justo ahí, o con un toque fuera antes
     de eso). Devuelve {puntos, desfases} o {error}. `desfases` es, en cada
     nota, cuánto le faltaba a la ficha para el borde (filas): la huella de
     la mano. */
  function rehace(modo, semilla, u, acciones, n, v) {
    v = v == null ? PRUEBA_V : v;
    if (!PRUEBA_VERSIONES.includes(v)) return { error: 'La prueba es de otra versión de PRO TILES.' };
    if (!MODOS.includes(modo)) return { error: 'PRO TILES no tiene ese modo.' };
    if (!acciones || !acciones.length || acciones[0].r || acciones[0].t !== 0) return { error: 'La partida no arranca tocando la primera ficha.' };
    if (!Number.isSafeInteger(n) || n < 0 || n > 3e6) return { error: 'El tick final no es válido.' };
    const E = nueva(modo, semilla, u, v), desfases = [];
    for (const a of acciones) {
      while (E.t < a.t) {
        paso(E);
        if (E.over) return { error: 'La partida rehecha se corta antes: una ficha se escapó en el tick ' + E.t + '.' };
      }
      if (a.r) { suelta(E); continue; }
      const t = E.tiles[E.next];
      if (a.l !== t.lane) return { error: 'La nota ' + (E.hits + 1) + ' se tocó en otro carril que su ficha (¿una prueba de otra partida?).' };
      if (t.hold && (a.dc == null || a.dc < HOLD_MIN * 100 || a.dc > t.len * 100)) return { error: 'Una ficha larga trae una distancia imposible.' };
      if (!t.hold && a.dc != null) return { error: 'Una ficha corta se tocó como larga.' };
      const pos = E.pos;
      if (!golpe(E, a.dc)) return { error: 'La nota ' + (E.hits + 1) + ' se tocó cuando su ficha no estaba en pantalla.' };
      desfases.push(t.s - pos);
    }
    if (n < E.t) return { error: 'La prueba termina antes de su última nota.' };
    while (E.t < n && !E.over) paso(E);
    if (E.t < n) return { error: 'La partida rehecha termina en el tick ' + E.t + ', no en el ' + n + '.' };
    return { puntos: E.score, notas: E.hits, desfases, E };
  }

  // Estrellas: 3 estrellas → 3 coronas → mundo.
  const STAR_AT = [100, 250, 450, 700, 1000, 1400, 2000];
  function level(score) { let n = 0; for (const t of STAR_AT) if (score >= t) n++; return n; }

  const api = { SONGS, SONGS_V1, STYLES, DIFF, SCALE, HOLD, TICK_MS, DT, FILAS, ARRIBA, ESCAPE, HOLD_MIN, MODOS, STAR_AT,
    PRUEBA_V, PRUEBA_VERSIONES, escapeDe,
    mulberry32, hashStr, mezcla, hashTexto, expNeg, speedFactor, clamp, nueva, asegura, actual, bordeAbajo, tocable,
    paso, golpe, suelta, falla, codifica, decodifica, rehace, level };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProTilesMotor = api;
})(globalThis);
