// Los mapas del modo zombis, como datos puros: sin THREE, sin DOM. Así se
// pueden recorrer desde Node para comprobar que cada enlace del grafo se
// camina de verdad y que cada ventana da a algún nodo (mundo.js los dibuja,
// interactivo.js pone lo que se compra y zombis.js navega por `nodos`).
//
// Un mapa es una lista de cajas sólidas, adornos sin choque y lo que vive en
// ellos. Las medidas son metros, el piso es y = 0 y los muros son cajas
// alineadas a los ejes, porque la física (mundo.js) solo sabe de esas.
//
//  cajas    [x0, z0, x1, z1, y0, y1, color, o]   color null = invisible.
//           o.puerta: la puerta a la que pertenece (se quita al abrirla);
//           o.pasa: frena el cuerpo pero no las balas (la ventana tapiada).
//  decor    ['c', x0,z0,x1,z1,y0,y1,color,o]  caja
//           ['brillo', …igual]                 caja que brilla sola
//           ['tubo', x0,y0,z0,x1,y1,z1,r,color]
//           ['cil', x,z,r,y0,y1,color,o]   ['cono', x,z,r,y0,y1,color]
//           ['esf', x,y,z,r,color,o]       ['rot', x,y,z,ry,w,h,d,color,o]
//           ['piso', x0,z0,x1,z1,y,color]  ['techo', x0,z0,x1,z1,y,color]
//           ['cartel', x,y,z,ry,w,h,texto,fondo,tinta,o]
//           ['luz', x,y,z,color,intensidad,alcance,o]
//           o.luz: solo se ve (o se enciende) con la electricidad;
//           o.puerta: desaparece con esa puerta; o.brilla: material que brilla.
//  ventanas {x,z,y,eje,w,nx,nz,ix,iz,ox,oz,zona}  n apunta hacia afuera;
//           (ox,oz) es donde aparece el zombi y (ix,iz) donde cae adentro.
//  brotes   [x, z, zona]   donde salen del suelo (mapas abiertos).
//  nodos    [x, z, y]      el grafo de navegación; enlaces [a, b, puerta?].
//  puertas  {id, nombre, precio, abre:[zonas], auto?}; x/z/y salen de huecos.
//  bebidas  [tipo, x, z, ry, y?, ronda?]   caja [x, z, ry, y?] (la 1.ª es la
//           inicial)   pared [arma, x, y, z, ry, precio]   pap [x, z, ry, y?, ronda?]
//           luz [x, z, ry, y] (el interruptor)   lava [x0, x1, z0, z1]
//           aislado [x0, x1, z0, z1]: ahí no los persigue nadie.
//
// ry orienta el frente: mira hacia (sin ry, cos ry). 0 → +z, π → −z,
// π/2 → +x, −π/2 → −x.

const PI = Math.PI, P2 = PI / 2;

function plano(id, nombre) {
  return {
    id, nombre, cajas: [], decor: [], ventanas: [], brotes: [], nodos: [], enlaces: [],
    puertas: [], bebidas: [], caja: [], pared: [], spawns: [], lava: [], aislado: [],
    pap: null, luz: null, teleporter: null, huecos: {}, zonas: {},
    ambiente: {}, suelo: null, luzSiempre: false,
  };
}

function caja(M, x0, z0, x1, z1, y0, y1, color, o = null) {
  M.cajas.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1, color, o]);
}
const D = (M, ...d) => M.decor.push(d);
const dc = (M, x0, z0, x1, z1, y0, y1, color, o) =>
  D(M, 'c', Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1, color, o || null);

// Un muro recto de (x0,z0) a (x1,z1), con huecos: 'h' abierto, 'p' puerta que
// se compra, 'v' ventana tapiada (los zombis la rompen y entran por ahí).
// `en` es la coordenada del centro del hueco a lo largo del muro.
function muro(M, x0, z0, x1, z1, { y0 = 0, alto = 4, color = '#888', g = 0.4, huecos = [], marco = '#3a2a1c' } = {}) {
  const ejeX = z0 === z1;
  const a0 = Math.min(ejeX ? x0 : z0, ejeX ? x1 : z1), a1 = Math.max(ejeX ? x0 : z0, ejeX ? x1 : z1);
  const fijo = ejeX ? z0 : x0;
  const pon = (b0, b1, ya, yb, col, o) => {
    if (b1 - b0 < 1e-3 || yb - ya < 1e-3) return;
    if (ejeX) caja(M, b0, fijo - g / 2, b1, fijo + g / 2, ya, yb, col, o);
    else caja(M, fijo - g / 2, b0, fijo + g / 2, b1, ya, yb, col, o);
  };
  const adorno = (b0, b1, ya, yb, col, o, gg = g + 0.06) => {
    if (ejeX) dc(M, b0, fijo - gg / 2, b1, fijo + gg / 2, ya, yb, col, o);
    else dc(M, fijo - gg / 2, b0, fijo + gg / 2, b1, ya, yb, col, o);
  };
  let cur = a0;
  for (const h of huecos.slice().sort((a, b) => a.en - b.en)) {
    const h0 = h.en - h.w / 2, h1 = h.en + h.w / 2;
    pon(cur, h0, y0, y0 + alto, color);
    const tope = Math.min(alto, h.t === 'v' ? 2.3 : (h.alto ?? 2.8));
    pon(h0, h1, y0 + tope, y0 + alto, color);
    const cx = ejeX ? h.en : fijo, cz = ejeX ? fijo : h.en;
    const eje = ejeX ? 'x' : 'z';
    if (h.t === 'p') {
      const estilo = h.estilo || 'puerta';
      pon(h0, h1, y0, y0 + tope, h.color ?? (estilo === 'escombros' ? '#6e5a48' : '#5b3a22'), { puerta: h.puerta, estilo });
      M.huecos[h.puerta] = { x: cx, z: cz, y: y0, eje, w: h.w };
    } else if (h.t === 'v') {
      pon(h0, h1, y0, y0 + tope, null, { pasa: true });
      // El marco y el alféizar: se ven, no chocan (la caja invisible ya frena).
      adorno(h0 - 0.12, h0, y0, y0 + tope, marco);
      adorno(h1, h1 + 0.12, y0, y0 + tope, marco);
      adorno(h0, h1, y0, y0 + 0.8, color, null, g + 0.02);
      adorno(h0 - 0.12, h1 + 0.12, y0 + 0.8, y0 + 0.88, marco, null, g + 0.2);
      const f = h.fuera ?? 1, nx = ejeX ? 0 : f, nz = ejeX ? f : 0;
      M.ventanas.push({
        x: cx, z: cz, y: y0, eje, w: h.w, nx, nz,
        ix: cx - nx * 1.2, iz: cz - nz * 1.2, ox: cx + nx * 2.6, oz: cz + nz * 2.6, zona: h.zona ?? '',
      });
    } else if (h.t === 'h' && h.marco !== false) {
      adorno(h0 - 0.1, h0, y0, y0 + tope, marco);
      adorno(h1, h1 + 0.1, y0, y0 + tope, marco);
      adorno(h0 - 0.1, h1 + 0.1, y0 + tope - 0.1, y0 + tope, marco);
    }
    cur = h1;
  }
  pon(cur, a1, y0, y0 + alto, color);
}

// Escalera maciza: n escalones de (y0) a (y1) que suben en el sentido `hacia`;
// cada escalón va desde su arranque hasta el fondo, así no quedan huecos.
function escalera(M, x0, z0, x1, z1, hacia, n, y0, y1, prof, color) {
  const h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const top = y0 + h * (i + 1), d = prof * i;
    if (hacia === '+x') caja(M, x0 + d, z0, x1, z1, y0, top, color);
    else if (hacia === '-x') caja(M, x0, z0, x1 - d, z1, y0, top, color);
    else if (hacia === '+z') caja(M, x0, z0 + d, x1, z1, y0, top, color);
    else caja(M, x0, z0, x1, z1 - d, y0, top, color);
  }
}

// ---------- Muebles y cosas sueltas ----------
function mesa(M, x0, z0, x1, z1, { h = 0.85, color = '#6b4a2b', patas = '#3d2a18' } = {}) {
  caja(M, x0, z0, x1, z1, 0, h, null);
  dc(M, x0, z0, x1, z1, h - 0.08, h, color);
  for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) {
    dc(M, x - 0.05, z - 0.05, x + 0.05, z + 0.05, 0, h - 0.08, patas);
  }
}
function cajon(M, x, z, s = 1, color = '#8a6a3c', y = 0) {
  caja(M, x - s / 2, z - s / 2, x + s / 2, z + s / 2, y, y + s, color);
  dc(M, x - s / 2 - 0.01, z - 0.04, x + s / 2 + 0.01, z + 0.04, y, y + s, '#5e4526');
}
function barril(M, x, z, color = '#5d6b3a', r = 0.38) {
  caja(M, x - r, z - r, x + r, z + r, 0, 1.1, null);
  D(M, 'cil', x, z, r, 0, 1.1, color);
  D(M, 'cil', x, z, r + 0.02, 0.3, 0.36, '#2b2b2b');
  D(M, 'cil', x, z, r + 0.02, 0.76, 0.82, '#2b2b2b');
}
// Coche: a lo largo de x si `largo` es true. Quemado: casi negro con óxido.
function coche(M, x, z, alongX, color = '#3a3330', { techo = '#2a2420', alto = 1.0 } = {}) {
  const L = 4.2, W = 1.9;
  const [hx, hz] = alongX ? [L / 2, W / 2] : [W / 2, L / 2];
  caja(M, x - hx, z - hz, x + hx, z + hz, 0.25, alto, color);
  caja(M, x - hx, z - hz, x + hx, z + hz, 0, 0.25, null);
  const [cx, cz] = alongX ? [L * 0.28, W / 2 - 0.1] : [W / 2 - 0.1, L * 0.28];
  caja(M, x - cx, z - cz, x + cx, z + cz, alto, alto + 0.6, techo);
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    const wx = alongX ? x + s1 * L * 0.32 : x + s2 * (W / 2);
    const wz = alongX ? z + s2 * (W / 2) : z + s1 * L * 0.32;
    if (alongX) D(M, 'tubo', wx, 0.35, wz - 0.12, wx, 0.35, wz + 0.12, 0.35, '#151515');
    else D(M, 'tubo', wx - 0.12, 0.35, wz, wx + 0.12, 0.35, wz, 0.35, '#151515');
  }
}
function arbol(M, x, z, { muerto = false, alto = 5, copa = '#3f5a2a', tronco = '#4a3524' } = {}) {
  caja(M, x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, alto * 0.6, null);
  D(M, 'cil', x, z, 0.22, 0, alto * 0.75, tronco);
  if (muerto) {
    D(M, 'tubo', x, alto * 0.5, z, x + 1.2, alto * 0.85, z + 0.4, 0.08, tronco);
    D(M, 'tubo', x, alto * 0.6, z, x - 0.9, alto * 0.95, z - 0.6, 0.07, tronco);
    D(M, 'tubo', x, alto * 0.4, z, x + 0.3, alto * 0.7, z - 1.0, 0.06, tronco);
  } else {
    D(M, 'cono', x, z, 1.6, alto * 0.45, alto * 1.05, copa);
    D(M, 'cono', x, z, 1.2, alto * 0.75, alto * 1.25, copa);
  }
}
// Un maniquí de Nuketown: cuerpo, cabeza y brazos, todo de plástico.
function muneco(M, x, z, ry, color = '#d8c7a8') {
  caja(M, x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, 1.8, null);
  D(M, 'cil', x, z, 0.04, 0, 0.9, '#555');
  D(M, 'rot', x, 1.2, z, ry, 0.45, 0.7, 0.25, color);
  D(M, 'esf', x, 1.72, z, 0.16, color);
  D(M, 'rot', x + Math.cos(ry) * 0.3, 1.2, z - Math.sin(ry) * 0.3, ry, 0.1, 0.65, 0.1, color, { rx: 0.2 });
  D(M, 'rot', x - Math.cos(ry) * 0.3, 1.2, z + Math.sin(ry) * 0.3, ry, 0.1, 0.65, 0.1, color, { rx: -0.3 });
}
function sacos(M, x0, z0, x1, z1, h = 0.9, color = '#8b7d5a') {
  caja(M, x0, z0, x1, z1, 0, h, color);
  const lx = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let y = 0.3; y < h; y += 0.3) {
    if (lx) dc(M, x0, Math.min(z0, z1) - 0.03, x1, Math.max(z0, z1) + 0.03, y - 0.02, y, '#6e6244');
    else dc(M, Math.min(x0, x1) - 0.03, z0, Math.max(x0, x1) + 0.03, z1, y - 0.02, y, '#6e6244');
  }
}
function farol(M, x, z, o = null) {
  caja(M, x - 0.15, z - 0.15, x + 0.15, z + 0.15, 0, 4, null);
  D(M, 'cil', x, z, 0.08, 0, 4.2, '#2a2a2a');
  D(M, 'esf', x, 4.25, z, 0.22, '#ffd27a', { brilla: true, ...(o || {}) });
}
function poste(M, x, z, alto = 6) {
  D(M, 'cil', x, z, 0.12, 0, alto, '#4a3a2a');
  D(M, 'c', x - 0.9, z - 0.06, x + 0.9, z + 0.06, alto - 0.6, alto - 0.5, '#4a3a2a');
}

// Une los nodos por nombre: `N` es {nombre: [x, z, y?]} y devuelve los índices.
function grafo(M, N, enlaces) {
  const idx = {};
  for (const [k, v] of Object.entries(N)) { idx[k] = M.nodos.length; M.nodos.push([v[0], v[1], v[2] || 0]); }
  for (const [a, b, p] of enlaces) {
    if (!(a in idx) || !(b in idx)) throw new Error(`${M.id}: enlace ${a}-${b} con un nodo que no existe`);
    M.enlaces.push(p ? [idx[a], idx[b], p] : [idx[a], idx[b]]);
  }
}

// ======================================================================
// NACHT DER UNTOTEN: el búnker de una planta y media. La sala de inicio con
// sus dos mesas, la sala de ayuda al este, los escombros que tapan la escalera
// del oeste y, arriba, el piso que asoma sobre la sala de inicio. Afuera, el
// avión estrellado y los árboles pelados.
// ======================================================================
function nacht() {
  const M = plano('nacht', 'Nacht der Untoten');
  M.ambiente = { fondo: '#141821', niebla: [16, 70], cielo: 0.5, sol: 0.3, solColor: '#9fb4d8', piso: '#2c3022' };
  M.suelo = [-60, -60, 60, 60];
  const muroC = '#6d6253', alto = 6.4, g = 0.5;
  // Afuera: el muro sur con dos ventanas en la sala de inicio y una en la de ayuda.
  muro(M, -10.25, 8, 22.25, 8, { alto, g, color: muroC, huecos: [
    { t: 'v', en: -5, w: 1.6, fuera: 1, zona: 'inicio' },
    { t: 'v', en: 5, w: 1.6, fuera: 1, zona: 'inicio' },
    { t: 'v', en: 16, w: 1.6, fuera: 1, zona: 'ayuda' },
  ] });
  muro(M, -10, -17.25, -10, 8.25, { alto, g, color: muroC, huecos: [{ t: 'v', en: 2, w: 1.6, fuera: -1, zona: 'inicio' }] });
  muro(M, 22, -17.25, 22, 8.25, { alto, g, color: muroC, huecos: [
    { t: 'v', en: 0, w: 1.6, fuera: 1, zona: 'ayuda' },
    { t: 'v', en: -12, w: 1.6, fuera: 1, zona: 'arriba' },
  ] });
  muro(M, -10.25, -17, 22.25, -17, { alto: 3.2, g, color: muroC });
  muro(M, -10.25, -17, 22.25, -17, { y0: 3.2, alto: 3.2, g, color: muroC, huecos: [
    { t: 'v', en: 0, w: 1.6, fuera: -1, zona: 'arriba' },
    { t: 'v', en: 6, w: 1.6, fuera: -1, zona: 'arriba' },
  ] });
  // Las cornisas de afuera, para que los de arriba tengan dónde pararse.
  for (const x of [0, 6]) {
    caja(M, x - 1.6, -20, x + 1.6, -17.25, 0, 3.2, '#4d463c');
    dc(M, x - 1.7, -20.1, x + 1.7, -17.25, 3.1, 3.25, '#3a342c');
  }
  // Adentro: el muro de la sala de ayuda, con su puerta.
  muro(M, 10, -8, 10, 8, { alto, g: 0.4, color: muroC, huecos: [{ t: 'p', en: 1.2, w: 2, puerta: 'ayuda' }] });
  // El muro norte de abajo: escombros sobre la escalera, el pasillo al este.
  muro(M, -10.25, -8, -5, -8, { alto, g: 0.4, color: muroC, huecos: [{ t: 'p', en: -8.2, w: 2.4, puerta: 'escombros', estilo: 'escombros' }] });
  muro(M, 10, -8, 22.25, -8, { alto, g: 0.4, color: muroC, huecos: [{ t: 'p', en: 19.2, w: 2, puerta: 'pasillo' }] });
  // El piso de arriba es una losa maciza; da a la sala de inicio por una baranda.
  caja(M, -5, -17, 10, -8, 0, 3.2, '#5a5045');
  caja(M, -5, -8.2, 10, -8, 3.2, 4.2, '#4a3a28');
  D(M, 'piso', -5, -16.75, 10, -8, 3.2, '#5b4733');
  // La escalera del oeste, detrás de los escombros.
  escalera(M, -9.75, -16.75, -5, -9.7, '-z', 8, 0, 3.2, 0.8, '#5b4733');
  // El muro entre el piso de arriba y el pasillo, con el paso al rellano.
  muro(M, 10, -17, 10, -8, { y0: 3.2, alto: 3.2, g: 0.4, color: muroC, huecos: [{ t: 'h', en: -14.4, w: 1.8 }] });
  // La escalera del pasillo: sube hacia el oeste hasta el paso.
  escalera(M, 10, -16.75, 16.4, -12, '-x', 8, 0, 3.2, 0.8, '#5b4733');
  // Techo y pisos.
  D(M, 'techo', -10, -17, 22, 8, alto, '#2e2a25');
  D(M, 'piso', -10, -8, 22, 8, 0.005, '#4a3c2c');
  D(M, 'piso', -10, -17, 22, -8, 0.005, '#3e3428');
  // Vigas del techo.
  for (let x = -8; x <= 20; x += 4) dc(M, x - 0.15, -17, x + 0.15, 8, alto - 0.35, alto, '#3a2a1c');
  // La sala de inicio: las dos mesas, sillas tiradas, papeles.
  mesa(M, -6.5, 0.6, -2.5, 2.0);
  mesa(M, 2.5, 0.6, 6.5, 2.0);
  D(M, 'rot', -4, 0.45, 3.0, 0.4, 0.5, 0.9, 0.5, '#4a3424', { rz: 1.2 });
  D(M, 'rot', 4.5, 0.25, -0.4, -0.8, 0.5, 0.5, 0.9, '#4a3424', { rx: 1.4 });
  D(M, 'c', -5.5, 1.0, -4.6, 1.5, 0.85, 0.87, '#e6dcc0');
  D(M, 'c', 3.4, 1.1, 4.2, 1.6, 0.85, 0.87, '#e6dcc0');
  D(M, 'cartel', -9.74, 3.4, -3.5, P2, 3.6, 1.4, 'HELP', null, '#7a0d0d', { fuente: 'serif' });
  D(M, 'cartel', 9.79, 3.0, 5.5, -P2, 2.2, 0.8, 'AYUDA →', null, '#7a0d0d', {});
  sacos(M, -9.6, 5.6, -8.4, 7.6);
  barril(M, 8.8, 6.6);
  barril(M, 9.2, -6.8, '#6b5a3a');
  // La sala de ayuda: cajones apilados y la radio.
  cajon(M, 21.1, -4.4, 1.2);
  cajon(M, 21.1, -4.4, 0.9, '#7a5c32', 1.2);
  cajon(M, 21.2, -6.9, 0.9);
  cajon(M, 11.2, 6.9, 1.0);
  mesa(M, 18, 5.6, 21.6, 7.4);
  D(M, 'c', 20.2, 6.2, 21.0, 6.8, 0.85, 1.25, '#3b3b2e');
  D(M, 'brillo', 20.3, 6.15, 20.5, 6.2, 1.0, 1.1, '#c8e27a');
  // Arriba: catres y cajones.
  for (const x of [-3.5, -1]) {
    caja(M, x - 0.45, -11, x + 0.45, -9.2, 3.2, 3.65, null);
    dc(M, x - 0.45, -11, x + 0.45, -9.2, 3.45, 3.65, '#5a5a48');
    dc(M, x - 0.45, -11, x + 0.45, -10.7, 3.2, 3.45, '#3a3a2e');
    dc(M, x - 0.45, -9.5, x + 0.45, -9.2, 3.2, 3.45, '#3a3a2e');
  }
  cajon(M, 5.5, -9.2, 1.0, '#8a6a3c', 3.2);
  // Luces tibias (pocas: cada una cuesta en todas las pantallas).
  D(M, 'luz', 0, 5.4, 0, '#ffb35c', 1.6, 18, null);
  D(M, 'luz', 16, 5.4, 0, '#ffb35c', 1.3, 16, null);
  D(M, 'luz', 2, 5.6, -12.5, '#ffd28a', 1.3, 14, { luz: true });
  for (const [x, z] of [[0, 0], [16, 0]]) {
    D(M, 'tubo', x, alto, z, x, alto - 0.9, z, 0.015, '#222');
    D(M, 'esf', x, alto - 0.95, z, 0.14, '#ffcf7a', { brilla: true });
  }
  D(M, 'esf', 2, alto - 0.6, -12.5, 0.14, '#ffe3a8', { brilla: true, luz: true });
  // Afuera: el avión estrellado, los árboles muertos y los sacos.
  D(M, 'tubo', 30, 1.4, -27, 44, 3.0, -35, 1.7, '#59605a');
  D(M, 'cono', 45.6, -36, 1.2, 2.8, 4.5, '#4b524c');
  D(M, 'rot', 37, 1.6, -31, -0.5, 13, 0.25, 2.4, '#4f5650', { rz: 0.18 });
  D(M, 'rot', 44, 3.8, -35, -0.5, 0.2, 2.6, 1.6, '#4f5650');
  D(M, 'rot', 28.5, 0.7, -25.5, 0.3, 3, 1.4, 2.6, '#2d2f2b', { rz: 0.5 });
  for (const [x, z] of [[-18, 14], [-22, -6], [-16, -26], [30, 12], [8, 20], [-6, 18], [34, -6], [18, -30], [-30, 4], [26, 22]]) {
    arbol(M, x, z, { muerto: true, alto: 5 + ((x * 7 + z * 3) % 3) });
  }
  sacos(M, -4, 12, 0, 12.8);
  sacos(M, 12, 13, 15, 13.8);
  sacos(M, 26, -4, 26.8, -1);
  sacos(M, -15, -2, -14.2, 2);
  // El cartel del camino.
  D(M, 'cil', -14, 11, 0.07, 0, 2.2, '#4a3524');
  D(M, 'cartel', -14, 2.0, 11.08, 0, 1.6, 0.5, 'NACHT', '#5c4a32', '#e8dcc0', {});

  M.puertas.push(
    { id: 'ayuda', nombre: 'Sala de ayuda', precio: 750, abre: ['ayuda'] },
    { id: 'escombros', nombre: 'Escombros (escalera)', precio: 1000, abre: ['arriba'] },
    { id: 'pasillo', nombre: 'Pasillo', precio: 1000, abre: ['ayuda', 'arriba'] },
  );
  grafo(M, {
    n0: [0, 4.5], n1: [0, -3.5], n2: [-7.8, -3.5], n3: [7.8, -3.5], n4: [-7.8, 4.5], n5: [7.8, 4.5],
    n6: [-8.2, -6.6], n7: [8.6, 1.2], n8: [11.4, 1.2], n9: [16, 3.5], n10: [16, -4], n11: [19.2, -6.6],
    n12: [19.2, -9.4], n13: [19.2, -14.4], n14: [17.4, -14.4], n15: [9.4, -14.4, 3.2],
    n16: [2.5, -12.4, 3.2], n17: [-4.2, -15.6, 3.2], n18: [-8.2, -8.9], n19: [-7.4, -15.6, 3.2],
  }, [
    ['n0', 'n1'], ['n0', 'n4'], ['n0', 'n5'], ['n1', 'n2'], ['n1', 'n3'], ['n2', 'n4'], ['n3', 'n5'],
    ['n2', 'n6'], ['n3', 'n7'], ['n5', 'n7'], ['n7', 'n8', 'ayuda'], ['n8', 'n9'], ['n8', 'n10'], ['n9', 'n10'],
    ['n10', 'n11'], ['n11', 'n12', 'pasillo'], ['n12', 'n13'], ['n13', 'n14'], ['n14', 'n15'], ['n15', 'n16'],
    ['n16', 'n17'], ['n17', 'n19'], ['n19', 'n18'], ['n18', 'n6', 'escombros'],
  ]);
  M.bebidas.push(
    ['revive', -9.3, -5, P2],
    ['jugger', 12, 7.1, PI],
    ['speed', 8.5, -16.2, 0, 3.2],
    ['doble', 21.2, -15, -P2],
  );
  M.luz = [-3, -16.6, 0, 3.2];
  M.pap = [13, -7.2, 0];
  M.pared.push(
    [12, 6, 1.5, -7.93, 0, 1500],
    [1, 21.7, 1.5, -1.8, -P2, 1500],
    [0, 3, 4.7, -16.72, 0, 1200],
    [2, 13, 1.5, -8.25, PI, 1500],
  );
  M.caja.push([2, -7.4, 0], [21.2, 3.6, -P2], [9.3, -10.5, -P2, 3.2]);
  M.spawns.push([-2, 3], [2, 3], [-2, -2], [2, -2]);
  return M;
}

// ======================================================================
// KINO DER TOTEN: el vestíbulo con su mostrador, los camerinos al oeste, el
// callejón al este y el teatro: butacas, el escenario con el telón rojo y la
// pantalla, el balcón del proyector y la sala del Pack-a-Punch, a la que solo
// se llega por el teletransportador.
// ======================================================================
function kino() {
  const M = plano('kino', 'Kino der Toten');
  M.ambiente = { fondo: '#120d10', niebla: [18, 80], cielo: 0.5, sol: 0.25, solColor: '#b0a0c8', piso: '#262022' };
  M.suelo = [-60, -60, 70, 60];
  const pared = '#7a5a48', teatro = '#5a2f2a', g = 0.4;
  // El frente: cuatro ventanas.
  muro(M, -26.2, 18, 26.2, 18, { alto: 6, g, color: pared, huecos: [
    { t: 'v', en: -21, w: 1.6, fuera: 1, zona: 'camerinos' },
    { t: 'v', en: -4, w: 1.6, fuera: 1, zona: 'inicio' },
    { t: 'v', en: 4, w: 1.6, fuera: 1, zona: 'inicio' },
    { t: 'v', en: 17, w: 1.6, fuera: 1, zona: 'callejon' },
  ] });
  muro(M, -26, 4, -26, 18.2, { alto: 6, g, color: pared, huecos: [{ t: 'v', en: 11, w: 1.6, fuera: -1, zona: 'camerinos' }] });
  muro(M, 26, 4, 26, 18.2, { alto: 6, g, color: pared, huecos: [{ t: 'v', en: 11, w: 1.6, fuera: 1, zona: 'callejon' }] });
  muro(M, -8, 4, -8, 18, { alto: 6, g, color: pared, huecos: [{ t: 'p', en: 12, w: 2, puerta: 'camerinos' }] });
  muro(M, 8, 4, 8, 18, { alto: 6, g, color: pared, huecos: [{ t: 'p', en: 12, w: 2, puerta: 'callejon' }] });
  muro(M, -16, 11, -16, 18, { alto: 6, g: 0.3, color: '#6a4a3a' });
  // El muro del teatro (z = 4), con las dos puertas de los costados.
  muro(M, -26.2, 4, -18, 4, { alto: 6, g, color: pared });
  muro(M, 18, 4, 26.2, 4, { alto: 6, g, color: pared });
  muro(M, -18.2, 4, 18.2, 4, { alto: 9, g, color: teatro, huecos: [
    { t: 'p', en: -13, w: 2, puerta: 'teatro-o' },
    { t: 'p', en: 13, w: 2, puerta: 'teatro-e' },
  ] });
  muro(M, -18, -28.2, -18, 4, { alto: 9, g, color: teatro, huecos: [
    { t: 'v', en: -8, w: 1.6, fuera: -1, zona: 'teatro' },
    { t: 'v', en: -20, w: 1.6, fuera: -1, zona: 'teatro' },
  ] });
  muro(M, 18, -28.2, 18, 4, { alto: 9, g, color: teatro, huecos: [
    { t: 'v', en: -8, w: 1.6, fuera: 1, zona: 'teatro' },
    { t: 'v', en: -20, w: 1.6, fuera: 1, zona: 'teatro' },
  ] });
  muro(M, -18.2, -28, 18.2, -28, { alto: 9, g, color: teatro });
  D(M, 'techo', -26, 4, 26, 18, 6, '#2a1c18');
  D(M, 'techo', -18, -28, 18, 4, 9, '#1e1416');
  // Pisos: alfombra roja en el vestíbulo, madera en el teatro.
  D(M, 'piso', -8, 4, 8, 18, 0.005, '#5e1a1c');
  D(M, 'piso', -3, 6, 3, 18, 0.008, '#7a2226');
  D(M, 'piso', -26, 4, -8, 18, 0.005, '#4a3a30');
  D(M, 'piso', 8, 4, 26, 18, 0.005, '#3a3836');
  D(M, 'piso', -18, -28, 18, 4, 0.005, '#3b2a22');
  D(M, 'piso', -2.2, -18, 2.2, 4, 0.008, '#5e1a1c');
  // El mostrador del vestíbulo y los afiches.
  caja(M, -3, 4.2, 3, 6, 0, 1.1, '#5a2e22');
  dc(M, -3.1, 4.15, 3.1, 6.1, 1.1, 1.18, '#b08850');
  D(M, 'cartel', -7.78, 3.2, 8, P2, 1.6, 2.2, 'KINO', '#2a1a14', '#e8c060', {});
  D(M, 'cartel', 7.78, 3.2, 8, -P2, 1.6, 2.2, 'DER TOTEN', '#2a1a14', '#e8c060', {});
  D(M, 'cartel', 0, 4.4, 4.22, 0, 5, 1.0, 'KINO DER TOTEN', '#3a0e10', '#f2d27a', {});
  // La araña del vestíbulo.
  D(M, 'tubo', 0, 6, 12, 0, 4.9, 12, 0.02, '#222');
  D(M, 'esf', 0, 4.7, 12, 0.35, '#ffe2a0', { brilla: true });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * PI * 2;
    D(M, 'esf', Math.cos(a) * 0.7, 4.75, 12 + Math.sin(a) * 0.7, 0.1, '#ffe2a0', { brilla: true });
  }
  D(M, 'luz', 0, 4.6, 12, '#ffd08a', 1.6, 20, null);
  // Los camerinos: tocadores con espejo, percheros.
  for (const x of [-24.5, -18.4]) {
    mesa(M, x - 0.9, 16.8, x + 0.9, 17.7, { h: 0.8, color: '#6a3e2c' });
    dc(M, x - 0.7, 17.7, x + 0.7, 17.78, 1.0, 2.0, '#9ab0b8');
    for (const dx of [-0.6, -0.2, 0.2, 0.6]) D(M, 'esf', x + dx, 2.1, 17.7, 0.06, '#fff4c8', { brilla: true });
  }
  D(M, 'tubo', -14.5, 1.8, 13, -14.5, 1.8, 17, 0.03, '#888');
  for (const z of [13.5, 14.4, 15.2, 16.2]) D(M, 'rot', -14.5, 1.2, z, 0, 0.1, 1.1, 0.5, ['#7a1a2a', '#2a3a6a', '#2a5a3a', '#6a5a2a'][Math.round(z) % 4]);
  cajon(M, -9.3, 5.0, 1.1);
  cajon(M, -24.9, 5.2, 1.0, '#7a5c32');
  // El callejón: contenedores, cajones y un farol.
  caja(M, 21, 5, 25.6, 6.6, 0, 1.6, '#3c5a3a');
  dc(M, 20.95, 4.95, 25.65, 6.65, 1.55, 1.65, '#2c4a2a');
  cajon(M, 10, 16.8, 1.2);
  cajon(M, 11.3, 16.9, 1.0, '#7a5c32');
  barril(M, 24.8, 16.8);
  barril(M, 24, 17.2, '#6a3a2a');
  // El escenario.
  caja(M, -14, -27.8, 14, -18, 0, 1.2, '#4a2c1a');
  dc(M, -14.05, -18.08, 14.05, -18, 0, 1.2, '#3a2010');
  for (const [x0, x1] of [[-2, 2], [-12, -9], [9, 12]]) escalera(M, x0, -18, x1, -15.6, '-z', 3, 0, 1.2, 0.8, '#4a2c1a');
  D(M, 'piso', -14, -27.8, 14, -18, 1.205, '#5a3a22');
  // Candilejas: se prenden con la luz.
  for (let x = -13; x <= 13; x += 1.3) D(M, 'esf', x, 1.25, -18.15, 0.08, '#ffdc8a', { brilla: true, luz: true });
  // Telón y pantalla.
  for (const s of [-1, 1]) {
    dc(M, s * 11, -18.6, s * 14, -18.2, 1.2, 8.6, '#8b0f14');
    dc(M, s * 13.9, -27.6, s * 14.3, -18.2, 1.2, 8.6, '#6d0b10');
  }
  dc(M, -14, -18.7, 14, -18.2, 7.4, 8.8, '#8b0f14');
  for (let x = -13.5; x <= 13.5; x += 1.5) dc(M, x - 0.05, -18.75, x + 0.05, -18.6, 7.4, 8.8, '#6d0b10');
  D(M, 'c', -8, -27.75, 8, -27.65, 2.6, 7.2, '#e8e4dc');
  D(M, 'brillo', -7.6, -27.66, 7.6, -27.6, 2.9, 6.9, '#9aa4c8', { luz: true });
  // Las butacas, en cuatro filas a cada lado del pasillo.
  for (const z of [-13, -10, -7, -4]) {
    for (const [x0, x1] of [[-15, -2.2], [2.2, 15]]) {
      caja(M, x0, z - 0.35, x1, z + 0.35, 0, 0.8, null);
      dc(M, x0, z - 0.35, x1, z + 0.35, 0.35, 0.5, '#7a1a1a');
      dc(M, x0, z + 0.15, x1, z + 0.35, 0.5, 1.05, '#6a1414');
      for (let x = x0; x <= x1 + 1e-6; x += 0.7) dc(M, x - 0.04, z - 0.35, x + 0.04, z + 0.35, 0, 0.65, '#2a1a12');
    }
  }
  // El balcón del proyector, sobre la entrada.
  caja(M, -6, -1, 6, 3.8, 0, 3, '#4a2e22');
  caja(M, -6, -1, 6, -0.8, 3, 4.0, '#3a2016');
  escalera(M, -11, 0.4, -6, 3.8, '+x', 6, 0, 3, 0.83, '#4a2c1a');
  D(M, 'piso', -6, -0.8, 6, 3.8, 3.005, '#5e1a1c');
  // El proyector.
  dc(M, -0.6, 2.8, 0.6, 3.6, 3, 4.4, '#2a2a2e');
  D(M, 'tubo', 0, 4.0, 2.8, 0, 4.0, 2.3, 0.18, '#1a1a1a');
  D(M, 'esf', 0, 4.0, 2.25, 0.14, '#cfe0ff', { brilla: true, luz: true });
  // Los apliques de las paredes del teatro.
  for (const z of [-24, -14, -4]) for (const s of [-1, 1]) D(M, 'esf', s * 17.7, 5.5, z, 0.18, '#ffcf8a', { brilla: true, luz: true });
  D(M, 'luz', 0, 7.5, -22, '#ffd8a8', 2.2, 26, { luz: true });
  D(M, 'luz', 0, 6.5, -8, '#c89070', 1.2, 24, null);
  // La sala del Pack-a-Punch, lejos de todo: solo se entra teletransportado.
  muro(M, 44, -30.2, 44, -21.8, { alto: 4.2, g, color: '#3a3a40' });
  muro(M, 52, -30.2, 52, -21.8, { alto: 4.2, g, color: '#3a3a40' });
  muro(M, 44, -30, 52, -30, { alto: 4.2, g, color: '#3a3a40' });
  muro(M, 44, -22, 52, -22, { alto: 4.2, g, color: '#3a3a40' });
  D(M, 'techo', 44, -30, 52, -22, 4.2, '#222228');
  D(M, 'piso', 44, -30, 52, -22, 0.005, '#2a2a30');
  D(M, 'luz', 48, 3.6, -26, '#9fb8ff', 1.6, 12, null);
  for (const x of [45, 51]) D(M, 'cil', x, -29.2, 0.2, 0, 4.2, '#555');
  // El teletransportador sobre el escenario: un disco con postes.
  D(M, 'cil', 0, -23, 1.3, 1.2, 1.26, '#4a4a52');
  D(M, 'brillo', -1.0, -24, 1.0, -22, 1.26, 1.27, '#6aa8ff', { luz: true });
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    D(M, 'cil', dx, -23 + dz, 0.08, 1.2, 3.4, '#666');
    D(M, 'esf', dx, 3.45, -23 + dz, 0.1, '#9fd0ff', { brilla: true, luz: true });
  }
  M.teleporter = { pad: [0, -23, 1.2], enlace: [0, 2.6, 3], destino: [48, -24.5, 0], vuelta: [0, -20, 1.2], dura: 30, precio: 1500 };
  M.aislado.push([44, 52, -30, -22]);

  M.puertas.push(
    { id: 'camerinos', nombre: 'Camerinos', precio: 750, abre: ['camerinos'] },
    { id: 'callejon', nombre: 'Callejón', precio: 750, abre: ['callejon'] },
    { id: 'teatro-o', nombre: 'Teatro', precio: 1000, abre: ['teatro'] },
    { id: 'teatro-e', nombre: 'Teatro', precio: 1000, abre: ['teatro'] },
  );
  grafo(M, {
    k0: [0, 12], k1: [-6.4, 12], k2: [6.4, 12], k3: [-4, 8], k4: [4, 8],
    k5: [-9.6, 12], k6: [-12, 7], k7: [-13, 5.4], k8: [-20, 7], k9: [-21, 14], k10: [-12, 15],
    k11: [9.6, 12], k12: [13, 5.4], k13: [20, 11],
    k14: [-13, 2.6], k15: [13, 2.6], k16: [-16.4, -1], k17: [16.4, -1], k18: [-16.4, -15], k19: [16.4, -15],
    k20: [0, -2.2], k21: [0, -14.8], k22: [0, -20, 1.2], k23: [-10.5, -14.8], k24: [10.5, -14.8],
    k25: [-10.5, -20, 1.2], k26: [10.5, -20, 1.2], k27: [-9, -3], k28: [-3, 1.4, 3], k29: [-16, -21], k30: [16, -21],
    k31: [9, -3], k32: [-5, -23, 1.2], k33: [5, -23, 1.2],
  }, [
    ['k0', 'k1'], ['k0', 'k2'], ['k0', 'k3'], ['k0', 'k4'], ['k1', 'k3'], ['k2', 'k4'],
    ['k1', 'k5', 'camerinos'], ['k5', 'k6'], ['k5', 'k10'], ['k6', 'k10'], ['k6', 'k7'], ['k6', 'k8'], ['k8', 'k9'], ['k8', 'k7'],
    ['k2', 'k11', 'callejon'], ['k11', 'k12'], ['k11', 'k13'], ['k12', 'k13'],
    ['k7', 'k14', 'teatro-o'], ['k12', 'k15', 'teatro-e'],
    ['k14', 'k16'], ['k14', 'k27'], ['k14', 'k28'], ['k27', 'k20'], ['k27', 'k16'],
    ['k15', 'k17'], ['k15', 'k31'], ['k31', 'k20'], ['k31', 'k17'],
    ['k16', 'k18'], ['k17', 'k19'], ['k20', 'k21'], ['k18', 'k23'], ['k23', 'k21'], ['k21', 'k24'], ['k24', 'k19'],
    ['k18', 'k29'], ['k19', 'k30'], ['k23', 'k25'], ['k21', 'k22'], ['k24', 'k26'],
    ['k25', 'k22'], ['k22', 'k26'], ['k25', 'k32'], ['k22', 'k32'], ['k22', 'k33'], ['k26', 'k33'],
  ]);
  M.bebidas.push(
    ['revive', -7.2, 5.6, P2],
    ['doble', -25.3, 6.2, P2],
    ['speed', 25.3, 8.4, -P2],
    ['phd', 22, 17.3, PI],
    ['jugger', -16.6, 3.3, PI],
    ['stamina', 16.6, 3.3, PI],
  );
  M.luz = [-13, -27.6, 0, 1.2];
  M.pap = [48, -29.3, 0];
  M.pared.push(
    [12, 7.76, 1.5, 7, -P2, 1500],
    [1, -22, 1.5, 4.25, 0, 1500],
    [0, 19.5, 1.5, 4.25, 0, 1200],
    [2, -17.76, 1.5, -14, P2, 1500],
  );
  M.caja.push([6.6, 17.35, PI], [11, -27.35, 0, 1.2], [14, 17.35, PI]);
  M.spawns.push([-2, 14], [2, 14], [-2, 10], [2, 10]);
  return M;
}

// ======================================================================
// NUKETOWN ZOMBIES: las dos casas enfrentadas, la amarilla y la verde, con el
// bus en medio de la calle, las camionetas, los maniquíes y el cartel de
// población. Abierto: los zombis salen del suelo. Las bebidas caen del cielo
// ronda a ronda, como en el original, y la luz está siempre.
// ======================================================================
function nuketown() {
  const M = plano('nuketown', 'Nuketown Zombies');
  M.ambiente = { fondo: '#c8844a', niebla: [35, 130], cielo: 1.0, sol: 1.5, solColor: '#ffc890', piso: '#9a7a52' };
  M.suelo = [-80, -80, 80, 80];
  M.luzSiempre = true;
  // El cerco del barrio.
  const cerco = '#8a7356';
  muro(M, -34.2, -30, 34.2, -30, { alto: 3, g: 0.4, color: cerco });
  muro(M, -34.2, 30, 34.2, 30, { alto: 3, g: 0.4, color: cerco });
  muro(M, -34, -30, -34, 30, { alto: 3, g: 0.4, color: cerco });
  muro(M, 34, -30, 34, 30, { alto: 3, g: 0.4, color: cerco });
  // La calle: asfalto, la línea amarilla, las veredas.
  D(M, 'piso', -34, -6, 34, 6, 0.005, '#3e3c3a');
  for (let x = -32; x < 32; x += 4) D(M, 'piso', x, -0.08, x + 2, 0.08, 0.01, '#d8b23a');
  D(M, 'piso', -34, -7, 34, -6, 0.006, '#9a948a');
  D(M, 'piso', -34, 6, 34, 7, 0.006, '#9a948a');
  // El bus en el medio.
  caja(M, -5.5, -1.4, 5.5, 1.4, 0.4, 3, '#d9d2c0');
  caja(M, -5.5, -1.4, 5.5, 1.4, 0, 0.4, null);
  dc(M, -5.55, -1.45, 5.55, 1.45, 1.8, 2.5, '#2a3a4a');
  dc(M, -5.55, -1.45, 5.55, 1.45, 0.9, 1.05, '#4a7aa8');
  dc(M, -5.6, -1.2, -5.5, 1.2, 0.5, 1.2, '#888');
  for (const x of [-3.6, 3.6]) for (const z of [-1.4, 1.4]) D(M, 'tubo', x, 0.45, z - 0.15, x, 0.45, z + 0.15, 0.45, '#151515');
  // Las dos casas: la verde es la amarilla girada media vuelta.
  casaNuke(M, 1, '#e3c04a', '#b8963a');
  casaNuke(M, -1, '#7fb069', '#5d8a4c');
  // El cartel de población, al final de la calle.
  D(M, 'cil', 31.5, -8.5, 0.08, 0, 2.6, '#555');
  D(M, 'cil', 33.5, -8.5, 0.08, 0, 2.6, '#555');
  D(M, 'cartel', 32.5, 2.0, -8.42, 0, 2.4, 1.2, 'NUKETOWN · POB. 0', '#e8e2d0', '#1a1a1a', {});
  // Postes de luz y cables.
  for (const x of [-26, -10, 10, 26]) { poste(M, x, -6.6); poste(M, -x, 6.6); }
  // Los maniquíes, desparramados por los patios.
  for (const [x, z, r] of [[-6, -10, 0.4], [-27, -12, 2], [-2, -20, -1], [-10, -27.5, 1.2], [-30, -26, 0.2], [-30, 9, 2.4]]) {
    muneco(M, x, z, r);
    muneco(M, -x, -z, r + PI);
  }
  // Los autos sueltos de la calle.
  coche(M, -16, 3.6, true, '#6a8aa8', { techo: '#4a6a88' });
  coche(M, 16, -3.6, true, '#a85a4a', { techo: '#884a3a' });
  // Arbolitos en los patios.
  for (const [x, z] of [[-4, -26], [-31, -14], [-4, -9], [-31, 22], [-20, 12], [-10, 24]]) {
    arbol(M, x, z, { alto: 4, copa: '#6a7a3a' });
    arbol(M, -x, -z, { alto: 4, copa: '#6a7a3a' });
  }
  // Más allá del cerco: el desierto del sitio de pruebas.
  for (const [x, z, s] of [[-50, -40, 8], [55, -30, 12], [40, 50, 9], [-45, 45, 14], [0, -60, 10], [60, 20, 7]]) {
    D(M, 'cono', x, z, s, 0, s * 0.8, '#8a6a48');
  }

  const N = {
    A: [-30.5, 0], B: [-14, 0], C: [-8, -3.8], E: [-8, 3.8],
    Y1: [-12, -7.5], Y2: [-12, -11], Y3: [-14, -15], Y4: [-14, -19], Y5: [-13, -23.5], Y6: [-16, -28],
    Y7: [-20, -7.5], Y8: [-20, -15], Y9: [-9.6, -10.4], Y10: [-9.6, -16.5, 3.2], Y11: [-13.5, -19, 3.2],
    Y12: [-26, -7.5], Y13: [-26, -24], Y14: [-31, -18], Y15: [-31, -6], Y16: [-2, -28], Y17: [-5, -14],
    Q1: [-27, 15], Q2: [-20, 18],
  };
  const L = [
    ['A', 'B'], ['B', 'C'], ['B', 'E'], ['C', 'E'], ['C', 'mE'],
    ['Y1', 'Y2'], ['Y1', 'B'], ['Y1', 'C'], ['Y1', 'Y7'], ['Y2', 'Y3'], ['Y2', 'Y9'], ['Y3', 'Y4'], ['Y3', 'Y8'],
    ['Y4', 'Y5'], ['Y5', 'Y13'], ['Y5', 'Y6'], ['Y6', 'Y16'], ['Y7', 'Y8'], ['Y7', 'Y12'], ['Y9', 'Y10'], ['Y10', 'Y11'],
    ['Y12', 'Y13'], ['Y12', 'Y15'], ['Y13', 'Y14'], ['Y14', 'Y15'], ['Y15', 'A'], ['Y16', 'Y17'], ['Y17', 'C'], ['Y17', 'mE'],
    ['A', 'Q1'], ['Q1', 'Q2'], ['Q2', 'E'],
  ];
  // La mitad verde: los mismos nodos girados (x, z) → (−x, −z).
  const N2 = {}, L2 = [];
  for (const [k, v] of Object.entries(N)) { N2[k] = v; N2['m' + k] = [-v[0], -v[1], v[2] || 0]; }
  const m = k => k.startsWith('m') ? k.slice(1) : 'm' + k;
  const vistos = new Set();
  for (const [a, b] of L) {
    for (const [p, q] of [[a, b], [m(a), m(b)]]) {
      const k = [p, q].sort().join('|');
      if (vistos.has(k)) continue;
      vistos.add(k);
      L2.push([p, q]);
    }
  }
  grafo(M, N2, L2);
  for (const [x, z] of [[-31, -25], [-10, -28.5], [-26, -16], [-31, -2], [-4, -21], [-21, -24.5], [-30, 26], [-20, 4.5]]) {
    M.brotes.push([x, z, ''], [-x, -z, '']);
  }
  M.bebidas.push(
    ['revive', -16.5, -8.4, 0, 0, 1],
    ['jugger', 16.5, 8.4, PI, 0, 2],
    ['speed', -21, -25.4, 0, 0, 3],
    ['doble', 21, 25.4, PI, 0, 4],
    ['stamina', -33.2, 3, P2, 0, 5],
    ['phd', 33.2, -3, -P2, 0, 6],
    ['deadshot', -15.4, -19, P2, 3.2, 7],
    ['mula', 15.4, 19, -P2, 3.2, 8],
  );
  M.pap = [0, -14, 0, 0, 6];
  M.pared.push(
    [12, -14.5, 1.5, -8.8, 0, 1500],
    [1, 14.5, 1.5, 8.8, PI, 1500],
    [0, -17, 1.5, -22.2, PI, 1200],
    [2, 17, 1.5, 22.2, 0, 1500],
  );
  M.caja.push([-23.3, -15, P2], [23.3, 15, -P2], [-6, 16, P2]);
  M.spawns.push([-10, -3.5], [10, 3.5], [-10, 3.5], [10, -3.5]);
  return M;
}

// Una casa de Nuketown. s = 1 la amarilla (al norte de la calle, x < 0),
// s = −1 la verde, girada media vuelta.
function casaNuke(M, s, color, oscuro) {
  const X = x => s * x, Z = z => s * z;
  const W = (x0, z0, x1, z1, op) => {
    const o = { ...op };
    if (o.huecos) o.huecos = o.huecos.map(h => ({ ...h, en: s * h.en, fuera: s * (h.fuera ?? 1) }));
    muro(M, X(x0), Z(z0), X(x1), Z(z1), o);
  };
  const C = (x0, z0, x1, z1, y0, y1, col, o) => caja(M, X(x0), Z(z0), X(x1), Z(z1), y0, y1, col, o);
  const d = (x0, z0, x1, z1, y0, y1, col, o) => dc(M, X(x0), Z(z0), X(x1), Z(z1), y0, y1, col, o);
  const g = 0.3, alto = 6.2;
  W(-24.15, -9, -7.85, -9, { alto, g, color, huecos: [{ t: 'h', en: -12, w: 1.8, marco: false }, { t: 'h', en: -20, w: 4.5, alto: 3, marco: false }] });
  W(-24, -22, -24, -9, { alto, g, color });
  W(-8, -22, -8, -9, { alto, g, color });
  W(-24.15, -22, -7.85, -22, { alto: 3.2, g, color, huecos: [{ t: 'h', en: -13, w: 1.6, marco: false }] });
  W(-24.15, -22, -7.85, -22, { y0: 3.2, alto: 3, g, color, huecos: [{ t: 'h', en: -12, w: 1.6, alto: 2, marco: false }] });
  W(-17, -21.85, -17, -9.15, { alto: 3.2, g: 0.2, color: '#d8d0c0', huecos: [{ t: 'h', en: -15, w: 1.6, marco: false }] });
  // El techo del garaje y el de la casa (cajas: se ven desde afuera).
  C(-24, -21.85, -17, -9.15, 3.2, 3.4, oscuro);
  d(-24.6, -22.6, -7.4, -8.4, alto, alto + 0.3, '#5a4a3a');
  d(-20, -20, -12, -11, alto + 0.3, alto + 1.4, '#4a3a2e');
  // La escalera y el piso de arriba con su baranda.
  escalera(M, Math.min(X(-11), X(-8.15)), Math.min(Z(-15.8), Z(-11)), Math.max(X(-11), X(-8.15)), Math.max(Z(-15.8), Z(-11)),
    s > 0 ? '-z' : '+z', 8, 0, 3.2, 0.6, '#8a6a4a');
  C(-16.85, -21.85, -8.15, -15.8, 2.9, 3.2, '#7a5a3e');
  C(-16.85, -16.0, -11, -15.8, 3.2, 4.2, '#5a4030');
  d(-16.85, -21.85, -8.15, -15.8, 3.205, 3.21, '#9a7a5a');
  // Ventanas pintadas en las fachadas (vidrio celeste con marco).
  for (const x of [-15, -9.5]) {
    d(x - 0.8, -8.82, x + 0.8, -8.8, 3.9, 5.2, '#a8c8d8');
    d(x - 0.9, -8.84, x + 0.9, -8.78, 3.8, 3.9, '#f2ece0');
  }
  d(-15.8, -22.2, -14.2, -22.18, 1.0, 2.2, '#a8c8d8');
  // Adentro: sofá, mesa de cocina, heladera.
  C(-16.6, -13.5, -15, -10, 0, 0.75, '#8a4a3a');
  const mx = [X(-16.4), X(-15)].sort((a, b) => a - b), mz = [Z(-21.5), Z(-20.1)].sort((a, b) => a - b);
  mesa(M, mx[0], mz[0], mx[1], mz[1], { color: '#d8d0c0' });
  C(-11.2, -21.8, -10.2, -21, 0, 1.9, '#e8e8e0');
  // El patio de atrás: el cerco con su portón y el cerco lateral.
  W(-28, -26, -4, -26, { alto: 1.2, g: 0.15, color: '#e8e0d0', huecos: [{ t: 'h', en: -16, w: 2, marco: false }] });
  W(-28, -30, -28, -10, { alto: 1.2, g: 0.15, color: '#e8e0d0', huecos: [{ t: 'h', en: -18, w: 2, marco: false }] });
  d(-28.05, -10.1, -27.95, -10, 0, 1.4, '#e8e0d0');
  // La camioneta delante del garaje.
  C(-24, -6.8, -19.4, -4.8, 0.4, 1.6, s > 0 ? '#5a6a7a' : '#7a3a2a');
  C(-24, -6.8, -19.4, -4.8, 0, 0.4, null);
  C(-24, -6.8, -22, -4.8, 1.6, 2.4, s > 0 ? '#4a5a6a' : '#6a2a1a');
  // El pasto de los patios.
  d(-34, -30, -4, -26, -0.02, 0.004, '#6a6a3a');
  d(-34, -26, -24, -7, -0.02, 0.004, '#6a6a3a');
}

// ======================================================================
// DER RIESE: la fábrica de Gruppe 935. El patio de inicio a cielo abierto,
// el mainframe con sus bobinas, el laboratorio y el horno al oeste, el
// almacén y el generador al este. La puerta del Pack-a-Punch se abre
// enlazando el teletransportador del horno con el mainframe.
// ======================================================================
function riese() {
  const M = plano('riese', 'Der Riese');
  M.ambiente = { fondo: '#1a1c22', niebla: [20, 90], cielo: 0.55, sol: 0.45, solColor: '#c8d0e8', piso: '#38352f' };
  M.suelo = [-60, -60, 60, 60];
  const ladrillo = '#6e5f52', gris = '#5e5c58', g = 0.5, alto = 8;
  // Exterior.
  muro(M, -28.25, 18, 28.25, 18, { alto, g, color: ladrillo, huecos: [
    { t: 'v', en: -19, w: 1.6, fuera: 1, zona: 'lab' },
    { t: 'v', en: -5, w: 1.6, fuera: 1, zona: 'inicio' },
    { t: 'v', en: 5, w: 1.6, fuera: 1, zona: 'inicio' },
    { t: 'v', en: 19, w: 1.6, fuera: 1, zona: 'almacen' },
  ] });
  muro(M, -28, -16.25, -28, 18.25, { alto, g, color: ladrillo, huecos: [
    { t: 'v', en: 9, w: 1.6, fuera: -1, zona: 'lab' },
    { t: 'v', en: -8, w: 1.6, fuera: -1, zona: 'horno' },
  ] });
  muro(M, 28, -16.25, 28, 18.25, { alto, g, color: ladrillo, huecos: [
    { t: 'v', en: 9, w: 1.6, fuera: 1, zona: 'almacen' },
    { t: 'v', en: -8, w: 1.6, fuera: 1, zona: 'generador' },
  ] });
  muro(M, -28.25, -16, -10, -16, { alto, g, color: ladrillo, huecos: [{ t: 'v', en: -23, w: 1.6, fuera: -1, zona: 'horno' }] });
  muro(M, 10, -16, 28.25, -16, { alto, g, color: ladrillo, huecos: [{ t: 'v', en: 24, w: 1.6, fuera: -1, zona: 'generador' }] });
  // El portón del Pack-a-Punch, al fondo del mainframe.
  muro(M, -10, -16, 10, -16, { alto, g, color: gris, huecos: [{ t: 'p', en: 0, w: 3, alto: 3.4, puerta: 'pap', color: '#4a4e52' }] });
  muro(M, -6, -26.25, -6, -16, { alto: 5, g, color: gris });
  muro(M, 6, -26.25, 6, -16, { alto: 5, g, color: gris });
  muro(M, -6.25, -26, 6.25, -26, { alto: 5, g, color: gris });
  D(M, 'techo', -6, -26, 6, -16, 5, '#2a2a2c');
  // Interiores.
  muro(M, -10, 0, -10, 18, { alto, g: 0.4, color: ladrillo, huecos: [{ t: 'p', en: 9, w: 2, puerta: 'lab' }] });
  muro(M, 10, 0, 10, 18, { alto, g: 0.4, color: ladrillo, huecos: [{ t: 'p', en: 9, w: 2, puerta: 'almacen' }] });
  muro(M, -10, -16, -10, 0, { alto, g: 0.4, color: gris, huecos: [{ t: 'p', en: -8, w: 2, puerta: 'horno-mf' }] });
  muro(M, 10, -16, 10, 0, { alto, g: 0.4, color: gris, huecos: [{ t: 'p', en: -8, w: 2, puerta: 'gen-mf' }] });
  muro(M, -28, 0, -10, 0, { alto, g: 0.4, color: gris, huecos: [{ t: 'p', en: -19, w: 2, puerta: 'horno' }] });
  muro(M, 10, 0, 28, 0, { alto, g: 0.4, color: gris, huecos: [{ t: 'p', en: 19, w: 2, puerta: 'generador' }] });
  muro(M, -10, 0, 10, 0, { alto: 6, g: 0.4, color: gris, huecos: [{ t: 'h', en: 0, w: 6, alto: 4 }] });
  D(M, 'techo', -28, -16, -10, 18, alto, '#2c2a28');
  D(M, 'techo', 10, -16, 28, 18, alto, '#2c2a28');
  D(M, 'techo', -10, -16, 10, 0, alto, '#2c2a28');
  // Pisos.
  D(M, 'piso', -10, 0, 10, 18, 0.005, '#55524a');
  for (let x = -9; x <= 9; x += 2) D(M, 'piso', x - 0.03, 0, x + 0.03, 18, 0.008, '#46433c');
  D(M, 'piso', -28, -16, 28, 0, 0.004, '#3e3c38');
  D(M, 'piso', -28, 0, -10, 18, 0.006, '#4a4842');
  D(M, 'piso', 10, 0, 28, 18, 0.006, '#4a4238');
  // Los carteles de la fábrica.
  D(M, 'cartel', 0, 6.2, 0.22, 0, 6, 1.0, 'GRUPPE 935', '#2a2a2a', '#d8d0b0', {});
  D(M, 'cartel', 0, 5.2, 17.73, PI, 5, 0.9, 'DER RIESE', '#3a1a14', '#e0c890', {});
  D(M, 'cartel', -9.78, 3.2, 14, P2, 1.8, 0.6, 'LABOR', '#2a2a2a', '#d8d0b0', {});
  D(M, 'cartel', 9.78, 3.2, 14, -P2, 1.8, 0.6, 'LAGER', '#2a2a2a', '#d8d0b0', {});
  // El patio: una fuente seca, faroles, cajones y sacos.
  caja(M, -1.6, 9.4, 1.6, 12.6, 0, 0.7, '#6a665e');
  D(M, 'cil', 0, 11, 0.4, 0.7, 2.2, '#77736a');
  D(M, 'cil', 0, 11, 0.9, 2.2, 2.4, '#77736a');
  farol(M, -8.6, 3);
  farol(M, 8.6, 3);
  farol(M, -8.6, 16.6);
  farol(M, 8.6, 16.6);
  cajon(M, 8.8, 13.6, 1.1);
  cajon(M, -8.8, 6.4, 1.0, '#7a5c32');
  sacos(M, -3, 16.2, 3, 17.0, 0.8);
  D(M, 'luz', 0, 6, 9, '#c8d8ff', 1.2, 22, null);
  // El mainframe: la columna con sus anillos, que se encienden con la luz.
  caja(M, -1.6, -9.6, 1.6, -6.4, 0, 6, null);
  D(M, 'cil', 0, -8, 1.6, 0, 6, '#4a4e56');
  for (const y of [1.2, 2.6, 4.0, 5.4]) D(M, 'cil', 0, -8, 1.68, y, y + 0.18, '#5a90ff', { luz: true, brilla: true });
  D(M, 'cil', 0, -8, 2.2, 6, 6.4, '#3a3e46');
  for (const [x, z] of [[-6.5, -13], [6.5, -13], [-6.5, -3], [6.5, -3]]) {
    caja(M, x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, 1.2, '#3a3a3e');
    D(M, 'cil', x, z, 0.12, 1.2, 4.2, '#8a7a5a');
    D(M, 'esf', x, 4.4, z, 0.35, '#a8c8ff', { luz: true, brilla: true });
  }
  D(M, 'luz', 0, 6.5, -8, '#7aa8ff', 2.0, 22, { luz: true });
  // El teletransportador del horno.
  D(M, 'cil', -19, -10, 1.4, 0, 0.12, '#4a4a52');
  D(M, 'brillo', -20, -11, -18, -9, 0.12, 0.13, '#6aa8ff', { luz: true });
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
    D(M, 'cil', -19 + dx, -10 + dz, 0.08, 0, 3.2, '#666');
    D(M, 'esf', -19 + dx, 3.25, -10 + dz, 0.1, '#9fd0ff', { brilla: true, luz: true });
  }
  // El horno: las bocas encendidas.
  caja(M, -27.75, -15.75, -25.8, -11, 0, 4.5, '#3a302a');
  for (const z of [-14.6, -12.2]) D(M, 'brillo', -25.82, z - 0.7, -25.78, z + 0.7, 0.6, 1.8, '#ff7a2a');
  D(M, 'luz', -24.5, 1.6, -13.3, '#ff7a2a', 1.6, 12, null);
  barril(M, -12, -14.8);
  barril(M, -12.9, -15.1, '#6a3a2a');
  // El generador: el motor grande y el interruptor.
  caja(M, 19.5, -13, 23, -9, 0, 2.8, '#4a4a40');
  D(M, 'cil', 21.25, -11, 1.2, 2.8, 3.4, '#3a3a32');
  D(M, 'tubo', 23, 2.2, -11, 27.7, 2.2, -11, 0.18, '#5a5a50');
  D(M, 'esf', 21.25, 3.6, -11, 0.25, '#ffcf6a', { luz: true, brilla: true });
  D(M, 'luz', 19, 6, -6, '#ffd890', 1.4, 18, { luz: true });
  // El laboratorio: mesas con frascos.
  for (const z of [5, 12]) {
    mesa(M, -24, z - 0.8, -14, z + 0.8, { h: 0.95, color: '#5a5a58', patas: '#2a2a2a' });
    for (let x = -23; x <= -15; x += 1.6) D(M, 'cil', x, z, 0.12, 0.95, 1.3, ['#6ad08a', '#d0c06a', '#6aa0d0'][Math.round(x) & 1 ? 0 : 1]);
  }
  D(M, 'luz', -19, 6.5, 9, '#c8ffd8', 1.2, 18, { luz: true });
  // El almacén: cajones y barriles por todos lados.
  for (const [x, z, s] of [[12, 16.6, 1.3], [13.4, 16.8, 1.0], [24, 3, 1.3], [26.6, 13, 1.2], [15, 2, 1.0], [21, 13, 1.4]]) cajon(M, x, z, s);
  cajon(M, 21, 13, 1.0, '#7a5c32', 1.4);
  for (const [x, z] of [[26.8, 16.8], [26, 17.2], [12, 2]]) barril(M, x, z);
  D(M, 'luz', 19, 6.5, 9, '#ffd8a8', 1.0, 18, null);

  M.puertas.push(
    { id: 'lab', nombre: 'Laboratorio', precio: 1000, abre: ['lab'] },
    { id: 'horno', nombre: 'Horno', precio: 1000, abre: ['horno'] },
    { id: 'almacen', nombre: 'Almacén', precio: 1000, abre: ['almacen'] },
    { id: 'generador', nombre: 'Generador', precio: 1000, abre: ['generador'] },
    { id: 'horno-mf', nombre: 'Horno', precio: 1250, abre: ['horno'] },
    { id: 'gen-mf', nombre: 'Generador', precio: 1250, abre: ['generador'] },
    { id: 'pap', nombre: 'Pack-a-Punch', precio: 0, abre: [], auto: true },
  );
  grafo(M, {
    r0: [0, 14.6], r1: [-7, 9], r2: [7, 9], r3: [0, 2.5], r4: [0, -3], r5: [-7.5, -8], r6: [7.5, -8], r7: [0, -12.5],
    r8: [0, -19], r9: [-12, 9], r10: [-19, 9], r11: [-19, 2.5], r12: [-25, 15], r13: [-19, -2.5], r14: [-15, -8],
    r15: [-12, -8], r16: [-23.5, -9],
    r17: [12, 9], r18: [19, 9], r19: [19, 2.5], r20: [25, 15], r21: [19, -2.5], r22: [15, -8], r23: [12, -8], r24: [25, -14],
  }, [
    ['r0', 'r1'], ['r0', 'r2'], ['r1', 'r3'], ['r2', 'r3'], ['r3', 'r4'], ['r4', 'r5'], ['r4', 'r6'], ['r5', 'r7'], ['r6', 'r7'],
    ['r7', 'r8', 'pap'],
    ['r1', 'r9', 'lab'], ['r9', 'r10'], ['r10', 'r11'], ['r10', 'r12'], ['r11', 'r13', 'horno'], ['r13', 'r14'], ['r13', 'r16'],
    ['r14', 'r15'], ['r14', 'r16'], ['r15', 'r5', 'horno-mf'],
    ['r2', 'r17', 'almacen'], ['r17', 'r18'], ['r18', 'r19'], ['r18', 'r20'], ['r19', 'r21', 'generador'], ['r21', 'r22'], ['r21', 'r24'],
    ['r22', 'r23'], ['r22', 'r24'], ['r23', 'r6', 'gen-mf'],
  ]);
  M.bebidas.push(
    ['revive', -9.3, 14, P2],
    ['jugger', -27.3, -3, P2],
    ['doble', 27.3, 4, -P2],
    ['speed', 27.3, -3, -P2],
    ['mula', -14, 17.3, PI],
  );
  M.luz = [16, -15.5, 0, 0];
  M.pap = [0, -25.2, 0];
  M.teleporter = { pad: [-19, -10, 0], enlace: [0, -5.8, 0], abre: 'pap', ventana: 30 };
  M.pared.push(
    [12, 9.74, 1.5, 4, -P2, 1500],
    [1, -10.26, 1.5, 4, -P2, 1500],
    [0, -9.76, 1.5, -4, P2, 1200],
    [2, 16, 1.5, 17.74, PI, 1500],
  );
  M.caja.push([6.5, -15.35, 0], [-24, 0.65, 0], [24, -0.65, PI]);
  M.spawns.push([-3, 14], [3, 14], [-3, 6], [3, 6]);
  return M;
}

// ======================================================================
// PUEBLO: el cruce de calles con el pozo de lava en el medio, el banco con
// su bóveda (y el Pack-a-Punch adentro), el bar de dos pisos con el balcón,
// la casa del Quick Revive y la manzana de tiendas. Los zombis que pisan la
// lava se prenden fuego y revientan al morir.
// ======================================================================
function pueblo() {
  const M = plano('pueblo', 'Pueblo');
  M.ambiente = { fondo: '#3a2a28', niebla: [24, 100], cielo: 0.75, sol: 0.7, solColor: '#ffb08a', piso: '#4a4038' };
  M.suelo = [-70, -70, 70, 70];
  M.luzSiempre = true;
  // El borde: escombros y fachadas.
  const borde = '#5a4a40';
  muro(M, -32.2, -32, 32.2, -32, { alto: 5, g: 0.4, color: borde });
  muro(M, -32.2, 32, 32.2, 32, { alto: 5, g: 0.4, color: borde });
  muro(M, -32, -32, -32, 32, { alto: 5, g: 0.4, color: borde });
  muro(M, 32, -32, 32, 32, { alto: 5, g: 0.4, color: borde });
  for (const [x0, z0, x1, z1, h, c] of [
    [-40, -40, -32.2, 40, 9, '#4a3a34'], [32.2, -40, 40, 40, 11, '#43362f'],
    [-32, -40, 32, -32.2, 8, '#4d3d35'], [-32, 32.2, 32, 40, 10, '#463830'],
  ]) dc(M, x0, z0, x1, z1, 0, h, c);
  // Las calles.
  D(M, 'piso', -32, -8, 32, 8, 0.004, '#3c3634');
  D(M, 'piso', -8, -32, 8, 32, 0.005, '#3c3634');
  // La lava: el pozo del centro y las dos grietas.
  M.lava.push([-3.5, 3.5, -3.5, 3.5], [10, 22, -1, 1], [-1, 1, 12, 22]);
  for (const [x0, x1, z0, z1] of M.lava) {
    D(M, 'brillo', x0, z0, x1, z1, -0.05, 0.02, '#ff5a1a');
    D(M, 'brillo', x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, 0.02, 0.03, '#ffb030');
  }
  for (const [x, z, s] of [[-4, -4, 1], [4, 4, 1], [4, -4, 1.2], [-4, 4, 0.8]]) D(M, 'rot', x, 0.15, z, x * z, s, 0.3, s * 0.6, '#2a2220', { rz: 0.3 });
  D(M, 'luz', 0, 2.2, 0, '#ff6a2a', 2.4, 18, null);
  D(M, 'luz', 16, 1.6, 0, '#ff6a2a', 1.2, 10, null);
  // EL BANCO.
  const banco = '#8a7c6a';
  muro(M, 7.8, -8, 26.2, -8, { alto: 5.5, g: 0.4, color: banco, huecos: [{ t: 'p', en: 14, w: 2, puerta: 'banco' }] });
  muro(M, 7.8, -26, 26.2, -26, { alto: 5.5, g: 0.4, color: banco, huecos: [{ t: 'v', en: 12, w: 1.6, fuera: -1, zona: 'banco' }] });
  muro(M, 8, -26, 8, -8, { alto: 5.5, g: 0.4, color: banco });
  muro(M, 26, -26, 26, -8, { alto: 5.5, g: 0.4, color: banco, huecos: [{ t: 'v', en: -11, w: 1.6, fuera: 1, zona: 'banco' }] });
  muro(M, 18, -26, 18, -16, { alto: 5.5, g: 0.6, color: '#6a6a6a' });
  muro(M, 18, -16, 26, -16, { alto: 5.5, g: 0.6, color: '#6a6a6a', huecos: [{ t: 'p', en: 22, w: 2, puerta: 'boveda', color: '#7a7a80' }] });
  D(M, 'techo', 8, -26, 26, -8, 5.5, '#2a2624');
  dc(M, 7.6, -26.4, 26.4, -7.6, 5.5, 5.8, '#5a4e44');
  D(M, 'piso', 8, -26, 26, -8, 0.006, '#6a6258');
  D(M, 'cartel', 17, 4.4, -7.77, 0, 4, 0.9, 'BANCO', '#2a2624', '#e8d8a8', {});
  // El mostrador de cajeros, las rejas y la bóveda.
  caja(M, 9, -14.5, 16, -13.7, 0, 1.15, '#5a4030');
  for (let x = 9.2; x < 16; x += 0.5) D(M, 'cil', x, -14.1, 0.02, 1.15, 2.2, '#b8a060');
  D(M, 'cil', 22, -16.35, 1.0, 0.2, 2.4, '#8a8a90', { rx: P2 });
  for (const [x, z] of [[19, -25], [20.4, -25], [25, -18]]) cajon(M, x, z, 0.9, '#b8a050');
  D(M, 'luz', 13, 4.6, -18, '#ffd8a0', 1.0, 16, null);
  // EL BAR, de dos pisos.
  const bar = '#6b4a3a';
  muro(M, -26.2, -8, -7.8, -8, { alto: 3.2, g: 0.4, color: bar, huecos: [{ t: 'p', en: -14, w: 2, puerta: 'bar' }] });
  muro(M, -26.2, -8, -7.8, -8, { y0: 3.2, alto: 3.2, g: 0.4, color: bar, huecos: [{ t: 'h', en: -21, w: 1.6, alto: 2.4 }] });
  muro(M, -26.2, -26, -7.8, -26, { alto: 6.4, g: 0.4, color: bar });
  muro(M, -8, -26, -8, -8, { alto: 6.4, g: 0.4, color: bar });
  muro(M, -26, -26, -26, -8, { alto: 3.2, g: 0.4, color: bar, huecos: [{ t: 'v', en: -12, w: 1.6, fuera: -1, zona: 'bar' }] });
  muro(M, -26, -26, -26, -8, { y0: 3.2, alto: 3.2, g: 0.4, color: bar, huecos: [{ t: 'v', en: -18, w: 1.6, fuera: -1, zona: 'bar-arriba' }] });
  caja(M, -29.3, -19.6, -26.2, -16.4, 0, 3.2, '#4a3a30');
  // El piso de arriba (sobre la mitad oeste) con su baranda hacia el salón.
  caja(M, -26, -26, -16, -8, 3.0, 3.2, '#5a3e2c');
  caja(M, -16.2, -22.8, -16, -8, 3.2, 4.2, '#3a2a1e');
  D(M, 'piso', -26, -26, -16, -8, 3.205, '#6a4a32');
  // La escalera, en su pasillo, detrás de los escombros.
  muro(M, -16, -23, -7.8, -23, { alto: 6.4, g: 0.4, color: bar, huecos: [{ t: 'p', en: -9.2, w: 1.6, puerta: 'bar-arriba', estilo: 'escombros' }] });
  escalera(M, -16, -25.8, -10.4, -23.2, '-x', 7, 0, 3.2, 0.8, '#5a3e2c');
  // El balcón.
  caja(M, -24, -6.2, -18, -8, 2.9, 3.2, '#5a3e2c');
  caja(M, -24, -6.2, -18, -6, 3.2, 4.1, '#3a2a1e');
  caja(M, -24.2, -8, -24, -6, 3.2, 4.1, '#3a2a1e');
  caja(M, -18, -8, -17.8, -6, 3.2, 4.1, '#3a2a1e');
  for (const x of [-23.8, -18.2]) D(M, 'cil', x, -6.4, 0.1, 0, 2.9, '#3a2a1e');
  D(M, 'techo', -26, -26, -8, -8, 6.4, '#2a2220');
  dc(M, -26.4, -26.4, -7.6, -7.6, 6.4, 6.7, '#4a3a30');
  D(M, 'piso', -26, -26, -8, -8, 0.006, '#4a3628');
  D(M, 'cartel', -13, 4.6, -7.77, 0, 3.2, 0.9, 'BAR', '#1a1210', '#ff8a5a', {});
  // La barra y los taburetes, debajo del piso de arriba.
  caja(M, -21, -21, -19.5, -13, 0, 1.1, '#4a2a1a');
  dc(M, -21.1, -21.1, -19.4, -12.9, 1.1, 1.18, '#8a5a3a');
  for (let z = -20; z <= -14; z += 1.5) D(M, 'cil', -18.8, z, 0.2, 0, 0.75, '#6a3a2a');
  dc(M, -25.95, -22, -25.75, -12, 1.2, 2.6, '#5a3a28');
  for (let z = -21.5; z <= -12.5; z += 0.5) D(M, 'cil', -25.6, z, 0.06, 1.5, 1.85, ['#3a6a3a', '#8a5a2a', '#6a2a2a'][Math.abs(Math.round(z * 2)) % 3]);
  mesa(M, -12.5, -14.5, -10.5, -12.5, { h: 0.8 });
  mesa(M, -13, -19.5, -11, -17.5, { h: 0.8 });
  D(M, 'luz', -13, 5.5, -16, '#ffb070', 1.3, 18, null);
  // LA CASA del Quick Revive.
  const casa = '#7a6a5a';
  muro(M, 7.8, 8, 24.2, 8, { alto: 4.5, g: 0.4, color: casa });
  muro(M, 7.8, 24, 24.2, 24, { alto: 4.5, g: 0.4, color: casa, huecos: [{ t: 'v', en: 16, w: 1.6, fuera: 1, zona: 'casa' }] });
  muro(M, 8, 8, 8, 24, { alto: 4.5, g: 0.4, color: casa, huecos: [{ t: 'p', en: 16, w: 2, puerta: 'casa' }] });
  muro(M, 24, 8, 24, 24, { alto: 4.5, g: 0.4, color: casa, huecos: [{ t: 'v', en: 12, w: 1.6, fuera: 1, zona: 'casa' }] });
  D(M, 'techo', 8, 8, 24, 24, 4.5, '#2a2422');
  dc(M, 7.6, 7.6, 24.4, 24.4, 4.5, 4.8, '#4a3e36');
  D(M, 'piso', 8, 8, 24, 24, 0.006, '#5a4a3a');
  mesa(M, 14, 14, 16.5, 16, { h: 0.8 });
  caja(M, 9, 22.4, 12, 23.6, 0, 0.8, '#6a3a3a');
  cajon(M, 22.8, 9.3, 1.0);
  D(M, 'luz', 16, 3.8, 16, '#ffd0a0', 1.0, 14, null);
  // LA MANZANA de tiendas (maciza): vidrieras y toldos.
  caja(M, -26, 8, -8, 26, 0, 6, '#6a5a50');
  for (const [z, t, c] of [[11.5, 'HOTEL', '#a8c0d0'], [17, 'TIENDA', '#c8b890'], [22.5, 'FERRET.', '#a0a888']]) {
    dc(M, -7.95, z - 2, -7.9, z + 2, 0.8, 2.6, c);
    D(M, 'rot', -7.4, 3.0, z, P2, 4.4, 0.08, 1.2, '#7a2a2a', { rx: 0.35 });
    D(M, 'cartel', -7.88, 4.2, z, P2, 3.2, 0.7, t, '#2a2220', '#e8d8b0', {});
  }
  for (const [x, t] of [[-21, 'POSADA'], [-12.5, 'CORREO']]) {
    dc(M, x - 2, 7.9, x + 2, 7.95, 0.8, 2.6, '#a8b0b8');
    D(M, 'cartel', x, 4.2, 7.88, PI, 3.2, 0.7, t, '#2a2220', '#e8d8b0', {});
  }
  // Las fachadas que cierran las calles hacia afuera.
  dc(M, -32, 26.5, -26.5, 32, 0, 8, '#4a3d36');
  dc(M, 26.5, 26.5, 32, 32, 0, 7, '#4d3f37');
  dc(M, 26.5, -32, 32, -26.5, 0, 9, '#45382f');
  dc(M, -32, -32, -29.5, -26.5, 0, 8, '#4a3d36');
  // Autos quemados, faroles y escombros.
  coche(M, -18, 4.5, true);
  coche(M, 24, 4.2, true, '#3a2a24');
  coche(M, 4.6, -18, false);
  coche(M, -4.6, 26, false, '#2e2622');
  for (const [x, z] of [[-7.4, -7.4], [7.4, -7.4], [7.4, 7.4], [-7.4, 7.4], [-20, 7.4], [20, -7.4], [-7.4, -20], [7.4, 28]]) farol(M, x, z);
  for (const [x, z, s] of [[-28, 4, 1.3], [27, -6, 1.1], [3, -29, 1.4], [-12, 29, 1.2], [28, 26, 1.0]]) {
    D(M, 'rot', x, s * 0.3, z, x + z, s * 2, s * 0.6, s * 1.4, '#4a3e36', { rz: 0.4 });
    D(M, 'rot', x + 0.6, s * 0.2, z - 0.4, z, s * 1.2, s * 0.4, s, '#5a4a40', { rx: 0.5 });
  }
  barril(M, -6.8, 18, '#6a3a2a');
  barril(M, 6.8, -26, '#5a4a3a');

  M.puertas.push(
    { id: 'bar', nombre: 'Bar', precio: 1000, abre: ['bar'] },
    { id: 'bar-arriba', nombre: 'Escombros (escalera)', precio: 750, abre: ['bar-arriba'] },
    { id: 'banco', nombre: 'Banco', precio: 1000, abre: ['banco'] },
    { id: 'boveda', nombre: 'Bóveda', precio: 1250, abre: [] },
    { id: 'casa', nombre: 'Casa', precio: 750, abre: ['casa'] },
  );
  grafo(M, {
    A1: [-30.6, -30.6], A2: [-14, -29.4], A3: [0, -29.4], A4: [14, -29.4], A5: [29.4, -29.4],
    B1: [-30.6, -14], B3: [0, -14], B5: [29.4, -14],
    C1: [-30.6, 0], C2: [-14, 0], C3: [0, 0], C4: [14, 3], C5: [29.4, 0],
    D1: [-30.6, 14], D3: [4, 14], D5: [29.4, 14],
    E1: [-29.4, 29.4], E2: [-14, 29.4], E3: [0, 29.4], E4: [14, 29.4], E5: [29.4, 29.4],
    b0: [-14, -5], b1: [-14, -10], b2: [-11, -20], b3: [-9.2, -21.6], b4: [-9.2, -24.6], b5: [-17, -24.6, 3.2],
    b6: [-21, -15, 3.2], b7: [-21, -7, 3.2], b8: [-17.5, -15], b10: [-23, -10.5], b11: [-17.5, -10.5], b9: [-24, -16],
    k0: [14, -5], k1: [14, -10.5], k2: [13, -19], k3: [22, -12], k4: [22, -19],
    h0: [5, 16], h1: [11, 16], h2: [18, 12], h3: [18, 20],
  }, [
    ['A1', 'A2'], ['A2', 'A3'], ['A3', 'A4'], ['A4', 'A5'], ['A1', 'B1'], ['B1', 'C1'], ['C1', 'D1'], ['D1', 'E1'],
    ['A5', 'B5'], ['B5', 'C5'], ['C5', 'D5'], ['D5', 'E5'], ['E1', 'E2'], ['E2', 'E3'], ['E3', 'E4'], ['E4', 'E5'],
    ['A3', 'B3'], ['B3', 'C3'], ['C3', 'D3'], ['D3', 'E3'], ['C1', 'C2'], ['C2', 'C3'], ['C3', 'C4'], ['C4', 'C5'],
    ['C2', 'b0'], ['C3', 'b0'], ['b0', 'b1', 'bar'], ['b1', 'b11'], ['b11', 'b10'], ['b10', 'b9'], ['b11', 'b8'], ['b8', 'b2'], ['b1', 'b2'],
    ['b2', 'b3'], ['b3', 'b4', 'bar-arriba'], ['b4', 'b5'], ['b5', 'b6'], ['b6', 'b7'],
    ['C4', 'k0'], ['C3', 'k0'], ['k0', 'k1', 'banco'], ['k1', 'k2'], ['k1', 'k3'], ['k2', 'k3'], ['k3', 'k4', 'boveda'],
    ['D3', 'h0'], ['h0', 'h1', 'casa'], ['h1', 'h2'], ['h1', 'h3'], ['h2', 'h3'],
  ]);
  for (const [x, z] of [[-29, -3], [-14, 4], [0, -21], [0, -30], [14, 5], [29, -4], [29, 28], [4, 28], [-4, 30], [30, 14], [-29, 20], [-20, -29], [20, -29.5], [-4, 12]]) {
    M.brotes.push([x, z, '']);
  }
  M.bebidas.push(
    ['jugger', -5, 6.5, 0],
    ['revive', 23.3, 20, -P2],
    ['speed', -25.3, -18.5, P2],
    ['doble', -25.3, -12, P2, 3.2],
    ['stamina', 31.3, 6, -P2],
  );
  M.pap = [22, -25.2, 0];
  M.pared.push(
    [12, 7.74, 1.5, -14, -P2, 1500],
    [1, -7.94, 1.5, 20, P2, 1500],
    [0, -8.26, 1.5, -16, -P2, 1200],
    [2, 25.74, 1.5, -14, -P2, 1500],
  );
  M.caja.push([-7.4, 14, P2], [9.3, -20, P2], [-20, -25.35, 0, 3.2]);
  M.spawns.push([-5, -5], [5, -5], [-5, 5], [5, 5]);
  return M;
}

// ---------- Lo que ocupa cada cosa que se compra ----------
// Las máquinas son cajas sólidas: las usa interactivo.js para el choque y el
// verificador para comprobar que no tapan un enlace ni una ventana.
export const MEDIDA = { bebida: [1.0, 0.8, 2.1], caja: [1.8, 0.8, 1.0], pap: [1.5, 1.0, 1.7] };
export function huella(x, z, ry, y, [w, d, h]) {
  const ladoX = Math.abs(Math.sin(ry)) > 0.5;
  const hx = (ladoX ? d : w) / 2, hz = (ladoX ? w : d) / 2;
  return { minx: x - hx, maxx: x + hx, minz: z - hz, maxz: z + hz, miny: y, maxy: y + h };
}
export function huellas(M) {
  const r = [];
  for (const b of M.bebidas) r.push(huella(b[1], b[2], b[3], b[4] || 0, MEDIDA.bebida));
  for (const c of M.caja) r.push(huella(c[0], c[1], c[2], c[3] || 0, MEDIDA.caja));
  if (M.pap) r.push(huella(M.pap[0], M.pap[1], M.pap[2], M.pap[3] || 0, MEDIDA.pap));
  return r;
}

// Las puertas toman su lugar del hueco que las dejó en el muro.
function cierra(M) {
  for (const p of M.puertas) {
    const h = M.huecos[p.id];
    if (!h) throw new Error(`${M.id}: la puerta ${p.id} no tiene hueco`);
    Object.assign(p, h);
  }
  for (const v of M.ventanas) M.zonas[v.zona || ''] = true;
  return M;
}

export const MAPAS = {
  nacht: cierra(nacht()), kino: cierra(kino()), nuketown: cierra(nuketown()), riese: cierra(riese()), pueblo: cierra(pueblo()),
};
export const LISTA_MAPAS = [
  ['nacht', 'Nacht der Untoten'], ['kino', 'Kino der Toten'], ['nuketown', 'Nuketown Zombies'], ['riese', 'Der Riese'], ['pueblo', 'Pueblo'],
];
export const MAPA_INICIAL = 'nacht';
// Las zonas que siempre están activas, con o sin puertas.
export const zonaLibre = z => !z || z === 'inicio';
