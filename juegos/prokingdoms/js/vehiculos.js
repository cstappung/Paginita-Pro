// Carreta, carromato y barcaza en 8 direcciones (pedido del dueño, después de L4).
//
// Cada vehículo es un modelo chico (cajas, elipsoides, cilindros y ruedas) que se rasteriza a pixel art: se muestrean
// sus superficies, se proyectan en la isometría del mapa (una casilla = 16 unidades; z en las mismas unidades), gana el
// punto más cercano a la cámara, se sombrea por cara en 4 tonos y lleva contorno oscuro. Así las 8 direcciones salen
// del mismo dibujo y se ven iguales. Las ruedas tienen rayos que giran (y se ve a través), los animales caminan, mueven
// la cola y las orejas aun quietos, y la barcaza hincha la vela, flamea el banderín y deja estela.
//
// Firma de siempre: S.cart(col, carga, dir, cuadro, anda). `dir` es 0..7 (rumbo en casillas: 0 = +x, 2 = +y, cada
// paso 45°) o, como antes, un booleano «flip» (de frente a la izquierda/derecha de la pantalla): la catapulta, las
// caravanas del mundo y los retratos lo siguen usando.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, S = PK.Sprites;
  const CARRY = S.CARRY;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const sc = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // la luz viene de arriba a la izquierda de la pantalla (como en los edificios)
  const LZ = (() => { const v = [-0.62, -0.18, 0.76], n = Math.hypot(...v); return v.map(x => x / n); })();
  const TONOS = l => (l > 1.02 ? 1.13 : l > 0.86 ? 1 : l > 0.7 ? 0.84 : 0.68);
  const OUT = [30, 20, 16];

  // dir: 0..7 o un flip viejo (false = mira a la derecha de la pantalla: casillas (+1, -1); true = (-1, +1))
  const rumbo = d => (typeof d === 'number' ? ((d % 8) + 8) % 8 : d ? 3 : 7);

  // ---------- El rasterizador ----------
  function Lienzo(w, h, ox, oy, ang, k) {
    const ca = Math.cos(ang), sa = Math.sin(ang), N = w * h;
    const zb = new Float32Array(N).fill(-1e9), cb = new Float32Array(N * 3), som = new Uint8Array(N);
    const L = {
      w, h, k,
      // a: adelante, b: a la izquierda del vehículo, z: arriba (unidades del modelo; k las escala)
      p(a, b, z, na, nb, nz, c, dos) {
        a *= k; b *= k; z *= k;
        const wx = a * ca - b * sa, wy = a * sa + b * ca;
        let nx = na * ca - nb * sa, ny = na * sa + nb * ca;
        if (dos && nx + ny + nz < 0) { nx = -nx; ny = -ny; nz = -nz; } // una vela o un banderín se ven de los dos lados
        if (nx + ny + nz < -0.15) return;
        const sx = Math.round(ox + wx - wy), sy = Math.round(oy + (wx + wy) / 2 - z);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
        const i = sy * w + sx, d = wx + wy + z;
        if (d <= zb[i]) return;
        zb[i] = d;
        const l = TONOS(0.52 + 0.62 * Math.max(0, nx * LZ[0] + ny * LZ[1] + nz * LZ[2]));
        cb[i * 3] = c[0] * l; cb[i * 3 + 1] = c[1] * l; cb[i * 3 + 2] = c[2] * l;
      },
      // sombra en el suelo (un punto del piso, en unidades del modelo)
      sombra(a, b) {
        a *= k; b *= k;
        const wx = a * ca - b * sa, wy = a * sa + b * ca, sx = Math.round(ox + wx - wy), sy = Math.round(oy + (wx + wy) / 2);
        if (sx >= 0 && sy >= 0 && sx < w && sy < h) som[sy * w + sx] = 1;
      },
      // suelo en coordenadas de pantalla relativas al origen (agua, polvo)
      zb, cb, som, ca, sa,
      paso: 0.42 / k,
    };
    return L;
  }
  // caja con una cara de arriba propia (o la misma)
  function caja(L, a0, a1, b0, b1, z0, z1, c, cTop) {
    const s = L.paso;
    for (let a = a0; a <= a1 + 1e-6; a += s) for (let b = b0; b <= b1 + 1e-6; b += s) L.p(a, b, z1, 0, 0, 1, cTop || c);
    for (let a = a0; a <= a1 + 1e-6; a += s) for (let z = z0; z <= z1 + 1e-6; z += s) { L.p(a, b1, z, 0, 1, 0, c); L.p(a, b0, z, 0, -1, 0, c); }
    for (let b = b0; b <= b1 + 1e-6; b += s) for (let z = z0; z <= z1 + 1e-6; z += s) { L.p(a1, b, z, 1, 0, 0, c); L.p(a0, b, z, -1, 0, 0, c); }
  }
  // elipsoide (cuerpos, cabezas, sacos); pinta(a, b, z) puede cambiar el color de cada punto
  function elip(L, ca, cb, cz, ra, rb, rz, c, pinta) {
    const r = Math.max(ra, rb, rz), n = Math.max(10, Math.ceil((Math.PI * r) / L.paso));
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI, st = Math.sin(th), ct = Math.cos(th), m = Math.max(6, Math.ceil(n * 2 * st));
      for (let j = 0; j < m; j++) {
        const ph = (j / m) * Math.PI * 2, x = st * Math.cos(ph), y = st * Math.sin(ph), z = ct;
        const na = x / ra, nb = y / rb, nz = z / rz, nn = Math.hypot(na, nb, nz);
        const a = ca + x * ra, b = cb + y * rb, zz = cz + z * rz;
        L.p(a, b, zz, na / nn, nb / nn, nz / nn, pinta ? pinta(a, b, zz, x, y, z) || c : c);
      }
    }
  }
  // cilindro a lo largo del eje a (troncos, lanza, mástil acostado); tapas con otro color
  function cilA(L, a0, a1, b, z, r, c, cTapa) {
    const s = L.paso, n = Math.max(8, Math.ceil((2 * Math.PI * r) / s));
    for (let a = a0; a <= a1 + 1e-6; a += s) for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; L.p(a, b + Math.cos(t) * r, z + Math.sin(t) * r, 0, Math.cos(t), Math.sin(t), c); }
    if (cTapa) for (let rr = 0; rr <= r; rr += s) for (let i = 0, m = Math.max(4, Math.ceil((2 * Math.PI * rr) / s)); i < m; i++) {
      const t = (i / m) * Math.PI * 2, cc = rr > r - 0.6 ? sc(cTapa, 0.8) : (Math.round(rr * 2) % 2 ? cTapa : sc(cTapa, 0.92));
      L.p(a1, b + Math.cos(t) * rr, z + Math.sin(t) * rr, 1, 0, 0, cc); L.p(a0, b + Math.cos(t) * rr, z + Math.sin(t) * rr, -1, 0, 0, cc);
    }
  }
  // cilindro vertical (mástil)
  function cilZ(L, a, b, z0, z1, r, c) {
    const s = L.paso, n = Math.max(8, Math.ceil((2 * Math.PI * r) / s));
    for (let z = z0; z <= z1; z += s) for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; L.p(a + Math.cos(t) * r, b + Math.sin(t) * r, z, Math.cos(t), Math.sin(t), 0, c); }
  }
  // rueda: disco en el plano a-z, con llanta, rayos que giran (fase) y cubo; entre rayos se ve a través
  function rueda(L, a, b, z, r, grosor, fase, rayos) {
    const s = L.paso * 0.8, llanta = [62, 58, 56], llantaL = [128, 122, 114], madera = [176, 132, 82], cubo = [44, 30, 20];
    for (const lado of [-1, 1]) {
      const bb = b + (lado * grosor) / 2;
      for (let rr = 0; rr <= r; rr += s) {
        const m = Math.max(6, Math.ceil((2 * Math.PI * Math.max(rr, 0.5)) / s));
        for (let i = 0; i < m; i++) {
          const t = (i / m) * Math.PI * 2, da = Math.cos(t) * rr, dz = Math.sin(t) * rr;
          let c = null;
          if (rr > r - 1.1) c = dz > r * 0.35 ? llantaL : llanta;
          else if (rr > r - 1.9) c = madera; // pina de madera bajo el aro de hierro
          else if (rr < 1.3) c = cubo;
          else {
            const per = (Math.PI * 2) / rayos, ang = (((t - fase) % per) + per) % per;
            if (Math.min(ang, per - ang) * rr < 0.55) c = madera;
          }
          if (c) L.p(a + da, bb, z + dz, 0, lado, 0, c);
        }
      }
    }
    // la banda de rodadura (se ve de canto)
    const n = Math.ceil((2 * Math.PI * r) / s);
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; for (let bb = -grosor / 2; bb <= grosor / 2; bb += s) L.p(a + Math.cos(t) * r, b + bb, z + Math.sin(t) * r, Math.cos(t), 0, Math.sin(t), llanta); }
  }
  function sombraElip(L, ca, cb, ra, rb) { for (let a = -ra; a <= ra; a += L.paso) for (let b = -rb; b <= rb; b += L.paso) if ((a * a) / (ra * ra) + (b * b) / (rb * rb) <= 1) L.sombra(ca + a, cb + b); }

  // Vuelca el lienzo a un sprite: sombra, modelo y contorno. extra(pb) dibuja encima lo que va en pantalla (estela).
  function volcar(L, ax, ay, antes) {
    const { w, h, zb, cb, som } = L, pb = new S.PB(w, h), N = w * h, hay = i => zb[i] > -1e8;
    if (antes) antes(pb);
    for (let i = 0; i < N; i++) if (som[i] && !hay(i)) pb.set(i % w, (i / w) | 0, [12, 20, 8], 78);
    for (let i = 0; i < N; i++) if (hay(i)) pb.set(i % w, (i / w) | 0, [cb[i * 3], cb[i * 3 + 1], cb[i * 3 + 2]]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (hay(i)) continue;
      if ((x > 0 && hay(i - 1)) || (x < w - 1 && hay(i + 1)) || (y > 0 && hay(i - w)) || (y < h - 1 && hay(i + w))) pb.set(x, y, OUT, 225);
    }
    return S.withMask({ c: pb.canvas(), ax, ay });
  }

  // ---------- Piezas ----------
  const MADERA = [168, 118, 68], MADERA_L = [204, 158, 100], MADERA_D = [112, 76, 42], CUERDA = [196, 170, 116];
  // patas que caminan: fase de cada pata y del cuadro
  function patas(L, cuerpo, piernas, f, anda, color, pezuña) {
    for (const [a, b, ph] of piernas) {
      const t = ((f / 4) * Math.PI * 2) + ph, sw = anda ? Math.sin(t) * 1.4 : 0, up = anda ? Math.max(0, Math.cos(t)) * 0.9 : 0;
      caja(L, a - 0.7 + sw * 0.5, a + 0.7 + sw * 0.5, b - 0.65, b + 0.65, 2 + up, cuerpo, color);
      caja(L, a - 0.7 + sw, a + 0.7 + sw, b - 0.65, b + 0.65, up, 2.2 + up, color);
      caja(L, a - 0.75 + sw, a + 0.75 + sw, b - 0.7, b + 0.7, up, 0.8 + up, pezuña);
    }
  }
  function burro(L, a0, f, anda, col, bob) {
    const pelo = [150, 136, 122], panza = [214, 204, 188], crin = [62, 50, 42], hocico = [214, 204, 190], pez = [40, 32, 26];
    patas(L, 7 + bob, [[a0 - 3, 1.5, 0], [a0 - 3, -1.5, Math.PI], [a0 + 3, 1.5, Math.PI], [a0 + 3, -1.5, 0]], f, anda, pelo, pez);
    elip(L, a0, 0, 9 + bob, 5.2, 2.6, 3, pelo, (a, b, z) => (z < 7.6 + bob ? panza : z > 11.4 + bob && Math.abs(b) < 0.9 ? crin : null));
    // cola que se mueve aun quieto
    const cola = Math.sin((f / 4) * Math.PI * 2) * 0.9;
    for (let i = 0; i < 6; i++) caja(L, a0 - 5.6 - i * 0.35, a0 - 5.1 - i * 0.35, cola * (i / 5) - 0.4, cola * (i / 5) + 0.4, 9.4 + bob - i * 0.9, 9.9 + bob - i * 0.9, i > 3 ? crin : pelo);
    // cuello, cabeza, hocico, orejas
    elip(L, a0 + 5.2, 0, 11.5 + bob, 2.2, 1.6, 2.6, pelo, (a, b, z) => (z > 13.2 + bob && Math.abs(b) < 0.7 ? crin : null));
    elip(L, a0 + 7.6, 0, 12.6 + bob, 2.8, 1.6, 1.7, pelo, (a) => (a > a0 + 9.4 ? hocico : null));
    caja(L, a0 + 7.8, a0 + 8.3, 0.75, 1.05, 12.6 + bob, 13.2 + bob, [20, 14, 10]); caja(L, a0 + 7.8, a0 + 8.3, -1.05, -0.75, 12.6 + bob, 13.2 + bob, [20, 14, 10]); // ojos
    const oreja = anda ? 0 : Math.max(0, Math.sin((f / 4) * Math.PI * 2 + 1)) * 0.8;
    caja(L, a0 + 6.3, a0 + 6.9, 0.4, 1.1, 14 + bob, 17 + bob - oreja, pelo); caja(L, a0 + 6.3, a0 + 6.9, -1.1, -0.4, 14 + bob, 17 + bob, pelo);
    // collera con el color del reino y arnés
    for (let t = 0; t < Math.PI * 2; t += 0.12) L.p(a0 + 4.2, Math.cos(t) * 2.1, 11 + bob + Math.sin(t) * 2.3, 1, Math.cos(t), Math.sin(t), t > Math.PI ? sc(col, 0.85) : col);
    caja(L, a0 - 2.5, a0 + 4, -2.75, 2.75, 9 + bob, 9.7 + bob, [86, 56, 30]);
  }
  function buey(L, a0, b0, f, fase, anda, pal, bob) {
    const [cuero, oscuro, claro] = pal, pez = [36, 28, 22], asta = [236, 226, 196];
    patas(L, 7.5 + bob, [[a0 - 3.6, b0 + 1.6, fase], [a0 - 3.6, b0 - 1.6, fase + Math.PI], [a0 + 3.4, b0 + 1.6, fase + Math.PI], [a0 + 3.4, b0 - 1.6, fase]], f, anda, oscuro, pez);
    elip(L, a0, b0, 9.8 + bob, 6.2, 2.9, 3.4, cuero, (a, b, z) => (z < 8 + bob ? claro : z > 12.6 + bob ? oscuro : null));
    elip(L, a0 + 3.4, b0, 11.4 + bob, 2.4, 2.6, 2.4, oscuro); // cruz alta del buey
    const cola = Math.sin((f / 4) * Math.PI * 2 + fase) * 0.7;
    for (let i = 0; i < 6; i++) caja(L, a0 - 6.4, a0 - 5.9, b0 + cola * (i / 5) - 0.35, b0 + cola * (i / 5) + 0.35, 11 + bob - i * 1.1, 11.5 + bob - i * 1.1, i > 4 ? pez : oscuro);
    // cabeza baja hacia adelante, morro claro, astas curvas
    elip(L, a0 + 7.4, b0, 10.6 + bob, 2.3, 1.8, 2, cuero, (a) => (a > a0 + 8.8 ? claro : null));
    caja(L, a0 + 7.4, a0 + 7.9, b0 + 0.9, b0 + 1.2, 11.2 + bob, 11.7 + bob, [18, 12, 8]); caja(L, a0 + 7.4, a0 + 7.9, b0 - 1.2, b0 - 0.9, 11.2 + bob, 11.7 + bob, [18, 12, 8]);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) caja(L, a0 + 6.6 + i * 0.12, a0 + 7.1 + i * 0.12, b0 + s * (1.4 + i * 0.42) - 0.3, b0 + s * (1.4 + i * 0.42) + 0.3, 12.2 + bob + (i > 3 ? (i - 3) * 0.5 : 0), 12.7 + bob + (i > 3 ? (i - 3) * 0.5 : 0), asta);
  }
  // la carga, sobre una caja de largo [a0, a1], ancho ±bw y piso en z0
  function carga(L, res, a0, a1, bw, z0, alto) {
    if (!res) return;
    const cc = CARRY[res] || [150, 120, 80], cL = sc(cc, 1.2), cD = sc(cc, 0.75), largo = a1 - a0;
    if (res === 'wood' || res === 'planks') {
      const tapa = res === 'wood' ? [216, 178, 122] : [228, 198, 142], filas = [[-bw * 0.55, 0], [0, 0], [bw * 0.55, 0], [-bw * 0.28, 1], [bw * 0.28, 1], [0, 2]];
      for (const [b, fila] of filas) {
        if (res === 'wood') cilA(L, a0 + 0.3, a1 - 0.3 + (fila === 1 ? 0.6 : 0), b, z0 + 1.3 + fila * 2.1, 1.25, U.hash(b * 7, fila, 5) > 0.5 ? cc : cD, tapa);
        else caja(L, a0 + 0.2, a1 - 0.2, b - 1.1, b + 1.1, z0 + fila * 1.2, z0 + 1.1 + fila * 1.2, fila % 2 ? cc : cL, cL);
      }
      for (const a of [a0 + largo * 0.25, a0 + largo * 0.75]) for (let t = 0; t <= Math.PI; t += 0.1) L.p(a, Math.cos(t) * bw * 0.85, z0 + Math.sin(t) * (alto + 1), 0, Math.cos(t), Math.sin(t), CUERDA); // cuerdas
    } else if (res === 'food' || res === 'books' || res === 'tools') {
      const sk = res === 'food' ? [204, 178, 124] : sc(cc, 1), skD = sc(sk, 0.8);
      const sacos = [[a0 + largo * 0.25, -bw * 0.45], [a0 + largo * 0.25, bw * 0.45], [a0 + largo * 0.7, -bw * 0.45], [a0 + largo * 0.7, bw * 0.45], [a0 + largo * 0.48, 0]];
      sacos.forEach(([a, b], i) => elip(L, a, b, z0 + (i === 4 ? 3.6 : 1.6), largo * 0.2, bw * 0.42, i === 4 ? 1.8 : 1.7, i % 2 ? sk : skD, (x, y, z) => (z > z0 + (i === 4 ? 5 : 3) ? [118, 84, 48] : null)));
      if (res === 'food') { elip(L, a0 + largo * 0.85, 0, z0 + 3.4, 1, 1, 1, [200, 52, 56]); elip(L, a0 + largo * 0.15, bw * 0.2, z0 + 3.4, 1, 1, 1, [226, 170, 60]); }
    } else if (res === 'gold' || res === 'gems' || res === 'ingots' || res === 'steel') {
      // cofres o lingotes apilados
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const a = a0 + 1 + i * (largo - 2) / 3, b = -bw * 0.5 + j * bw;
        if (res === 'ingots' || res === 'steel') caja(L, a, a + (largo - 2) / 3 - 0.5, b - 1.4, b + 1.4, z0 + (i + j) % 2 * 1.1, z0 + 1 + (i + j) % 2 * 1.1, cc, cL);
        else elip(L, a + 1, b, z0 + 1.3, 1.6, 1.6, 1.4, (i + j) % 2 ? cc : cL, () => (U.hash(i, j, 3) > 0.6 ? [255, 250, 200] : null));
      }
    } else {
      // montón de piedra, mineral, mármol o bloques: piezas al azar (siempre las mismas)
      for (let i = 0; i < 14; i++) {
        const a = a0 + 0.8 + U.hash(i, 1, 41) * (largo - 1.6), b = (U.hash(i, 2, 41) - 0.5) * bw * 1.5, z = z0 + (i < 8 ? 0.4 : 1.8) + (i > 11 ? 1.4 : 0);
        const r = 0.9 + U.hash(i, 3, 41) * 0.8, c = U.hash(i, 4, 41) > 0.7 ? cD : U.hash(i, 4, 41) < 0.2 ? cL : cc;
        if (res === 'blocks' || res === 'marble') caja(L, a - r, a + r, b - r, b + r, z, z + r * 1.4, c, cL);
        else elip(L, a, b, z + r * 0.6, r * 1.1, r, r * 0.8, c);
      }
    }
  }

  // ---------- Carreta (burro, caja abierta de dos ruedas, banderín) ----------
  const CC = new Map();
  S.cart = function (col, res, dir, frame, anda) {
    const d = rumbo(dir), f = frame % 4, key = col.join(',') + '|' + (res || '') + '|' + d + '|' + f + '|' + (anda ? 1 : 0);
    if (CC.has(key)) return CC.get(key);
    const L = Lienzo(60, 48, 30, 32, (d * Math.PI) / 4, 1), bob = anda && f % 2 ? -0.5 : 0;
    sombraElip(L, -2, 0, 13, 6);
    // caja de tablas con bordes
    const a0 = -14, a1 = -3, bw = 4.6, zp = 5;
    caja(L, a0, a1, -bw, bw, zp - 0.9, zp, MADERA_D, MADERA);                      // piso
    for (const s of [-1, 1]) caja(L, a0, a1, s > 0 ? bw - 0.8 : -bw, s > 0 ? bw : -bw + 0.8, zp, zp + 3.6, MADERA, MADERA_L); // costados
    caja(L, a0, a0 + 0.8, -bw, bw, zp, zp + 3, MADERA, MADERA_L); caja(L, a1 - 0.8, a1, -bw, bw, zp, zp + 3.6, MADERA, MADERA_L);
    for (const a of [a0 + 3.6, a0 + 7.3]) for (const s of [-1, 1]) caja(L, a - 0.35, a + 0.35, s * bw - 0.45, s * bw + 0.45, zp - 0.8, zp + 3.8, MADERA_D); // listones
    carga(L, res, a0 + 0.8, a1 - 0.8, bw - 0.9, zp, 3);
    // eje y ruedas (los rayos giran al andar)
    const fase = anda ? (f / 4) * (Math.PI / 3) : 0;
    caja(L, -9.4, -8.6, -bw - 1.3, bw + 1.3, 4.2, 4.8, MADERA_D);
    for (const s of [-1, 1]) rueda(L, -9, s * (bw + 1.1), 4.5, 4.5, 1, fase, 6);
    // varas hasta el burro
    for (const s of [-1, 1]) caja(L, a1, 4, s * 2.6 - 0.35, s * 2.6 + 0.35, 7.6 + bob * 0.5, 8.3 + bob * 0.5, MADERA_D, MADERA);
    burro(L, 5.4, f, anda, col, bob);
    // banderín del reino en la esquina de atrás
    caja(L, a0 + 0.3, a0 + 0.8, bw - 0.8, bw - 0.3, zp, zp + 11, [70, 46, 26]);
    const ondea = anda ? Math.sin((f / 4) * Math.PI * 2) : Math.sin((f / 4) * Math.PI);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) L.p(a0 + 0.6 - i * 0.45, bw - 0.55 + Math.sin(i * 0.7 + f) * 0.35 * (1 + ondea * 0.5), zp + 7.6 + j * 0.8 - i * 0.12, 0, 1, 0, j === 3 ? sc(col, 1.15) : col, true);
    const spr = volcar(L, 30, 32, anda ? polvo(L, -15, f) : null);
    CC.set(key, spr);
    return spr;
  };
  // polvo detrás de las ruedas al andar (en el piso, atrás según el rumbo)
  function polvo(L, aAtras, f, ox, oy) {
    ox = ox === undefined ? 30 : ox; oy = oy === undefined ? 32 : oy;
    return pb => {
      for (let i = 0; i < 5; i++) {
        const a = (aAtras - i * 1.3 - (f % 2)) * L.k, b = (i % 2 ? 2 : -2) * L.k, wx = a * L.ca - b * L.sa, wy = a * L.sa + b * L.ca;
        pb.set(Math.round(ox + wx - wy), Math.round(oy + (wx + wy) / 2), [196, 176, 136], 120 - i * 20);
      }
    };
  }

  // ---------- Carromato (dos bueyes con yugo, carro largo con toldo y ruedas grandes) ----------
  const CRC = new Map();
  S.carromato = function (col, res, dir, frame, anda) {
    const d = rumbo(dir), f = frame % 4, key = col.join(',') + '|' + (res || '') + '|' + d + '|' + f + '|' + (anda ? 1 : 0);
    if (CRC.has(key)) return CRC.get(key);
    const L = Lienzo(80, 62, 40, 42, (d * Math.PI) / 4, 1), bob = anda && f % 2 ? -0.5 : 0;
    sombraElip(L, -2, 0, 19, 8);
    const a0 = -19, a1 = -2, bw = 5.6, zp = 6.5;
    caja(L, a0, a1, -bw, bw, zp - 1.2, zp, MADERA_D, MADERA);
    for (const s of [-1, 1]) caja(L, a0, a1, s > 0 ? bw - 0.8 : -bw, s > 0 ? bw : -bw + 0.8, zp, zp + 3, MADERA, MADERA_L);
    caja(L, a1 - 0.8, a1, -bw, bw, zp, zp + 3, MADERA, MADERA_L); // pescante
    for (const a of [a0 + 4, a0 + 8.5, a0 + 13]) for (const s of [-1, 1]) caja(L, a - 0.4, a + 0.4, s * bw - 0.5, s * bw + 0.5, zp - 1, zp + 3.2, MADERA_D);
    // carga asomando por la boca de atrás
    carga(L, res, a0 - 1.4, a0 + 4.5, bw - 1.2, zp, 3.5);
    // toldo: medio cilindro de lona con costillas oscuras y la franja del reino
    const lona = mix(col, [238, 226, 198], 0.55), lonaD = sc(lona, 0.82), franja = sc(col, 0.95), R = bw + 0.4, zt = zp + 3;
    for (let a = a0 + 2; a <= a1 - 1.2; a += L.paso) for (let t = 0; t <= Math.PI; t += L.paso / R) {
      const costilla = Math.abs(((a - a0) % 3.6) - 1.8) > 1.5, lado = Math.abs(t - Math.PI / 2) > 1.05 && Math.abs(t - Math.PI / 2) < 1.25;
      L.p(a, Math.cos(t) * R, zt + Math.sin(t) * R * 1.05, 0, Math.cos(t), Math.sin(t), costilla ? lonaD : lado ? franja : lona);
    }
    // las bocas del toldo (adelante y atrás): aro claro, adentro oscuro
    for (const [a, s] of [[a0 + 2, -1], [a1 - 1.2, 1]]) for (let rr = 0; rr <= R; rr += L.paso) for (let t = 0; t <= Math.PI; t += L.paso / Math.max(rr, 0.6)) L.p(a, Math.cos(t) * rr, zt + Math.sin(t) * rr * 1.05, s, 0, 0, rr > R - 0.7 ? sc(lona, 1.08) : [46, 32, 22]);
    // ruedas grandes con 8 rayos
    const fase = anda ? (f / 4) * (Math.PI / 4) : 0;
    for (const s of [-1, 1]) { rueda(L, -15, s * (bw + 1.2), 6.2, 6.2, 1.2, fase, 8); rueda(L, -6, s * (bw + 1.2), 5.2, 5.2, 1.2, fase * 1.2, 8); }
    caja(L, -15.4, -14.6, -bw - 1.4, bw + 1.4, 5.9, 6.6, MADERA_D); caja(L, -6.4, -5.6, -bw - 1.4, bw + 1.4, 4.9, 5.6, MADERA_D);
    // lanza y yugo con el color del reino
    cilA(L, a1, 14.5, 0, 8 + bob * 0.5, 0.55, MADERA_D);
    caja(L, 14, 15.2, -7, 7, 12.2 + bob, 13.2 + bob, sc(col, 0.9), col);
    for (const s of [-1, 1]) caja(L, 14.2, 15, s * 3.2 - 0.3, s * 3.2 + 0.3, 10.6 + bob, 12.4 + bob, [70, 46, 26]);
    // dos bueyes, el de la izquierda más oscuro; pisan desfasados
    buey(L, 8.5, 3.2, f, 0, anda, [[124, 86, 52], [88, 60, 36], [196, 164, 120]], bob);
    buey(L, 8.5, -3.2, f, Math.PI / 2, anda, [[152, 114, 76], [110, 80, 50], [214, 186, 140]], bob);
    const spr = volcar(L, 40, 42, anda ? pb => { for (let i = 0; i < 6; i++) { const a = (-21 - i * 1.4 - (f % 2)), b = (i % 2 ? 3 : -3), wx = a * L.ca - b * L.sa, wy = a * L.sa + b * L.ca; pb.set(Math.round(40 + wx - wy), Math.round(42 + (wx + wy) / 2), [196, 176, 136], 130 - i * 18); } } : null);
    CRC.set(key, spr);
    return spr;
  };

  // ---------- Barcaza (casco chato, carga en cubierta, vela cuadrada del color del reino) ----------
  const BRC = new Map();
  S.barcaza = function (col, res, dir, frame, anda) {
    const d = rumbo(dir), f = frame % 4, key = col.join(',') + '|' + (res || '') + '|' + d + '|' + f + '|' + (anda ? 1 : 0);
    if (BRC.has(key)) return BRC.get(key);
    const L = Lienzo(84, 84, 42, 58, (d * Math.PI) / 4, 0.95), cab = Math.sin((f / 4) * Math.PI * 2) * 0.35; // cabeceo
    const casco = [150, 104, 60], cascoL = [190, 142, 88], cascoD = [96, 64, 36], brea = [50, 36, 24];
    const ancho = a => (a > 7 ? 6.4 * Math.pow(Math.max(0.04, (19.5 - a) / 12.5), 0.75) : a < -15 ? 6.4 * (0.8 + (a + 19) / 20) : 6.4); // proa afilada, popa apenas más angosta
    // costados del casco (con tablas) y espejo de popa
    for (let a = -19; a <= 19; a += L.paso) {
      const w = ancho(a), sube = a > 12 ? (a - 12) * 0.35 : 0;
      for (let z = -1; z <= 3.4 + sube; z += L.paso) {
        const c = z < 0 ? brea : Math.abs(z - 1.2) < 0.3 ? cascoD : z > 2.9 + sube ? cascoL : casco;
        const dw = a > 12 ? 0.6 : 0;
        L.p(a, w, z + cab * a * 0.03, dw, 1, 0, c); L.p(a, -w, z + cab * a * 0.03, dw, -1, 0, c);
      }
    }
    for (let b = -ancho(-19); b <= ancho(-19); b += L.paso) for (let z = -1; z <= 3.4; z += L.paso) L.p(-19, b, z - cab * 0.57, -1, 0, 0, z < 0 ? brea : Math.abs(b) < 0.4 ? cascoD : casco);
    // cubierta con juntas, borda del color del reino
    for (let a = -18.6; a <= 18.6; a += L.paso) { const w = ancho(a) - 0.4, sube = a > 12 ? (a - 12) * 0.35 : 0; for (let b = -w; b <= w; b += L.paso) L.p(a, b, 3 + sube + cab * a * 0.03, 0, 0, 1, Math.round(b * 1.1) % 2 ? cascoL : sc(cascoL, 0.9)); }
    for (let a = -19; a <= 18.5; a += L.paso) { const w = ancho(a), sube = a > 12 ? (a - 12) * 0.35 : 0; for (const s of [-1, 1]) L.p(a, s * w, 3.8 + sube + cab * a * 0.03, 0, s, 0.6, sc(col, 0.9)); }
    // carga: cajas y sacos en cubierta
    if (res) {
      const cc = CARRY[res] || [150, 120, 80];
      for (const [a, b, w, h] of [[-13, -2.5, 3.6, 3.4], [-13, 2.4, 3.4, 2.6], [-7.5, 0, 3.4, 4], [5, -2.3, 3.2, 3], [5, 2.5, 3.4, 3.6], [10, 0, 2.6, 2.4]]) {
        caja(L, a - w / 2, a + w / 2, b - 1.8, b + 1.8, 3.2, 3.2 + h, MADERA, MADERA_L);
        caja(L, a - w / 2 - 0.05, a + w / 2 + 0.05, b - 0.4, b + 0.4, 3.2, 3.25 + h, sc(cc, 0.95)); // fleje con el color de la carga
      }
      carga(L, res, -4.5, 2.5, 3, 3.2, 2.5);
    } else for (let t = 0; t < Math.PI * 2; t += 0.15) L.p(-11 + Math.cos(t) * 1.6, Math.sin(t) * 1.6, 3.4, 0, 0, 1, CUERDA); // un rollo de cuerda
    // mástil, verga y vela que se hincha con el viento (más andando)
    cilZ(L, 0, 0, 3, 31, 0.75, [110, 76, 44]);
    cilA(L, -0.5, 0.5, 0, 29, 0.4, [84, 58, 34]);
    for (let b = -10; b <= 10; b += L.paso) L.p(0.6, b, 29.4, 0, 0, 1, [84, 58, 34]);
    const vela = mix(col, [242, 234, 216], 0.35), velaD = sc(vela, 0.85), hincha = anda ? 2.4 + Math.sin((f / 4) * Math.PI * 2) * 0.4 : 0.9;
    for (let z = 12; z <= 28.5; z += L.paso * 0.9) for (let b = -9.5; b <= 9.5; b += L.paso * 0.9) {
      const t = (z - 12) / 16.5, comba = Math.sin(t * Math.PI) * Math.cos((b / 19) * Math.PI) * hincha;
      const franjaR = Math.abs(b) < 2 && z > 15 && z < 26;
      L.p(1 + comba, b, z, 1, 0, 0.2, franjaR ? sc(col, 0.8) : Math.round(z * 0.5) % 4 === 0 ? velaD : vela, true);
    }
    // gallardete en la punta que flamea
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) L.p(-i * 0.7, Math.sin(i * 0.8 + f * 1.4) * 0.6, 31.5 + j * 0.7 - i * 0.05, 0, 1, 0, j ? sc(col, 1.15) : col, true);
    // agua: línea de flotación y estela (en pantalla, debajo del casco)
    const agua = pb => {
      for (let a = -21; a <= 21; a += 0.5) for (const s of [-1, 1]) {
        const w = (ancho(Math.max(-19, Math.min(19, a))) + 0.6) * s, aa = a * L.k, bb = w * L.k, wx = aa * L.ca - bb * L.sa, wy = aa * L.sa + bb * L.ca;
        if ((Math.round(a * 2) + f) % 3) pb.set(Math.round(42 + wx - wy), Math.round(58 + (wx + wy) / 2), [222, 242, 250], 150);
      }
      if (anda) for (let i = 0; i < 18; i++) {
        const a = (-21 - i * 1.2) * L.k, abre = (2 + i * 0.45) * L.k;
        for (const s of [-1, 1]) {
          const b = s * abre, wx = a * L.ca - b * L.sa, wy = a * L.sa + b * L.ca;
          if ((i + f) % 2 === 0 || i < 4) pb.set(Math.round(42 + wx - wy), Math.round(58 + (wx + wy) / 2), [232, 248, 252], Math.max(30, 170 - i * 9));
        }
      }
    };
    const spr = volcar(L, 42, 58, agua);
    BRC.set(key, spr);
    return spr;
  };

  // ---------- Barcos grandes: el Galeón del Alba y el barco de colonos (pk-54) ----------
  // Antes eran perfiles planos (el casco de lado y las velas como nubes). Ahora son modelos como la barcaza, vistos de
  // tres cuartos: casco con tablas, regala dorada, portas, castillo de proa y de popa con ventanas encendidas, bauprés,
  // mástiles con cofa, vergas, velas que se hinchan, foque, mesana latina, obenques y banderas.
  // o: { largo, manga, mastiles: [[a, alto, velas]], rotos, sinVelas, agujeros, escora, col, sol, faro, carga }
  function linea(L, a0, b0, z0, a1, b1, z1, c) {
    const n = Math.ceil(Math.hypot(a1 - a0, b1 - b0, z1 - z0) / (L.paso * 0.8));
    for (let i = 0; i <= n; i++) { const t = i / n; L.p(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, z0 + (z1 - z0) * t, 0.3, 0.3, 0.9, c, true); }
  }
  function velaCuadra(L, a, hw, z0, z1, hincha, c, cD, emblema) {
    for (let z = z0; z <= z1; z += L.paso * 0.85) for (let b = -hw; b <= hw; b += L.paso * 0.85) {
      const t = (z - z0) / (z1 - z0), comba = Math.sin(t * Math.PI) * Math.cos((b / (hw * 2)) * Math.PI) * hincha;
      let cc = Math.round(z * 0.45) % 5 === 0 ? cD : c; // costuras
      if (emblema) { const e = emblema(b, z); if (e) cc = e; }
      // la luz como si la tela mirara al cielo, con el vientre de la vela más claro al centro (de cara a la cámara
      // quedaba siempre a la sombra, gris)
      L.p(a + comba, b, z, -0.25, -(b / hw) * 0.45, 0.85 - Math.abs(b / hw) * 0.2, cc);
    }
  }
  function triangulo(L, p0, p1, p2, c, cD) { // vela latina o foque, en el plano b del primer punto (doble cara)
    const n = Math.ceil(Math.max(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), Math.hypot(p2[0] - p0[0], p2[2] - p0[2])) / (L.paso * 0.7));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n, a = p0[0] + (p1[0] - p0[0]) * u + (p2[0] - p0[0]) * v, b = p0[1] + (p1[1] - p0[1]) * u + (p2[1] - p0[1]) * v, z = p0[2] + (p1[2] - p0[2]) * u + (p2[2] - p0[2]) * v;
      L.p(a, b + Math.sin(u * Math.PI) * 0.8, z, -0.2, 0.2 + v * 0.3, 0.85, Math.round(z * 0.5) % 5 === 0 ? cD : c);
    }
  }
  function barcoGrande(L, o) {
    const LA = o.largo / 2, M = o.manga, col = o.col || [176, 52, 40];
    const casco = [120, 78, 44], cascoL = [158, 108, 62], cascoD = [84, 54, 30], brea = [44, 32, 22], oro = [222, 176, 76], cubierta = [190, 150, 96];
    const esc = o.escora || 0, Z = (b, z) => z + b * esc; // escorado: el costado de estribor (b < 0) se hunde
    const proa = LA * 0.55, popa = -LA * 0.62;
    const w0 = a => (a > proa ? M * Math.sqrt(Math.max(0, (LA - a) / (LA - proa))) : a < -LA * 0.85 ? M * (0.82 + 0.18 * (a + LA) / (LA * 0.15)) : M);
    const cub = a => (a > proa ? 0.95 * M + (a - proa) * 0.14 : a < popa ? (a < -LA * 0.85 ? 1.6 * M : 1.35 * M) : 0.75 * M); // altura de la cubierta
    const ancho = (a, z) => w0(a) * (z < 2 ? 0.7 + 0.3 * Math.max(0, z + 3) / 5 : 1 - (z - 2) * 0.008);
    const regala = a => cub(a) + 1.4;
    // costados
    for (let a = -LA; a <= LA; a += L.paso) {
      const top = regala(a);
      for (let z = -3; z <= top; z += L.paso) {
        const w = ancho(a, z);
        if (w < 0.3) continue;
        let c = z < 0 ? brea : Math.abs(z - 2.6) < 0.35 || Math.abs(z - cub(a) + 0.5) < 0.3 ? cascoD : z > top - 0.6 ? oro : z > cub(a) - 0.4 ? sc(col, 0.95) : (Math.round(z * 1.2) % 3 === 0 ? sc(casco, 0.92) : z > 5 ? cascoL : casco);
        const porta = z > cub(0) - 3.4 && z < cub(0) - 1.9 && a > popa + 3 && a < proa - 2 && ((a - popa) % 6.5) < 2.2;
        if (porta) c = [30, 20, 12];
        const hueco = o.agujeros && ((Math.abs(a - LA * 0.15) < 2.6 && Math.abs(z - 1.4) < 1.6) || (Math.abs(a + LA * 0.32) < 1.8 && Math.abs(z - 4) < 1.1));
        if (hueco) c = [16, 10, 6];
        const dw = a > proa ? 0.7 : 0;
        L.p(a, w, Z(w, z), dw, 1, z < 1 ? -0.35 : 0.1, c); L.p(a, -w, Z(-w, z), dw, -1, z < 1 ? -0.35 : 0.1, c);
      }
    }
    // espejo de popa con ventanas encendidas y faroles
    const ap = -LA, wp = ancho(ap, 6);
    for (let b = -wp; b <= wp; b += L.paso) for (let z = 0; z <= regala(ap); z += L.paso) {
      const ven = z > cub(ap) - 4.5 && z < cub(ap) - 2.4 && (Math.round((b + wp) / 1.6) % 2 === 0) && Math.abs(b) < wp - 1;
      const c = z < 0.4 ? brea : z > regala(ap) - 0.6 || Math.abs(z - (cub(ap) - 5.2)) < 0.3 ? oro : ven ? [255, 214, 120] : z > cub(ap) - 0.4 ? sc(col, 0.95) : cascoL;
      L.p(ap, b, Z(b, z), -1, 0, 0, c);
    }
    // cubiertas y frentes de los castillos
    for (let a = -LA + 0.3; a <= LA - 0.6; a += L.paso) { const w = ancho(a, cub(a)) - 0.6; for (let b = -w; b <= w; b += L.paso) L.p(a, b, Z(b, cub(a)), 0, 0, 1, Math.round(b * 0.9) % 2 ? cubierta : sc(cubierta, 0.9)); }
    for (const [af, z0, z1] of [[proa, cub(0), cub(proa + 0.01)], [popa, cub(0), cub(popa - 0.01)], [-LA * 0.85, cub(popa - 0.01), cub(-LA)]]) {
      const w = ancho(af, z1) - 0.4;
      for (let b = -w; b <= w; b += L.paso) for (let z = z0; z <= z1; z += L.paso) {
        const puerta = Math.abs(b) < 1.2 && z < z0 + 2.6;
        L.p(af + (af > 0 ? -0.01 : 0.01), b, Z(b, z), af > 0 ? -1 : 1, 0, 0, puerta ? [60, 38, 22] : Math.abs(z - z1) < 0.4 ? oro : cascoL);
      }
    }
    if (o.faro) elip(L, -LA - 0.6, 0, cub(-LA) + 3, 0.9, 0.9, 1.2, [255, 220, 120]); // farol de popa
    // timón (pala) y mascarón: un bauprés que sale de la proa
    caja(L, -LA - 1.2, -LA - 0.4, -0.4, 0.4, -2.5, 3, cascoD);
    linea(L, LA - 1, 0, cub(LA) - 0.5, LA + o.largo * 0.2, 0, cub(LA) + o.largo * 0.1, [96, 64, 36]);
    linea(L, LA - 1, 0.35, cub(LA) - 0.5, LA + o.largo * 0.2, 0.35, cub(LA) + o.largo * 0.1, [130, 90, 50]);
    elip(L, LA + 0.6, 0, cub(LA) - 1.2, 1, 0.8, 1.3, oro); // mascarón dorado
    // la carga en cubierta (colonos: cajas y barriles)
    if (o.carga) for (const [a, b] of [[-3, 2.4], [-3, -2.2], [2.5, 2], [2, -2.6]]) { caja(L, a - 1.4, a + 1.4, b - 1.3, b + 1.3, cub(a), cub(a) + 2.3, MADERA, MADERA_L); }
    // mástiles, cofas, vergas, velas, obenques y banderas
    const vela = [255, 250, 238], velaD = [226, 214, 190], hincha = o.sinVelas ? 0 : 2.6; // claras: la cara que se ve queda a la sombra
    o.mastiles.forEach(([am, alto, nv, latina], i) => {
      const base = cub(am), roto = o.rotos && o.rotos.includes(i), top = base + (roto ? alto * 0.4 : alto);
      cilZ(L, am, 0, base, top, 0.75, [92, 62, 36]);
      if (roto) { linea(L, am, 0, top, am - alto * 0.35, -M * 0.6, base + 1, [92, 62, 36]); linea(L, am + 0.4, 0, top, am - alto * 0.35 + 0.4, -M * 0.6, base + 1, [120, 82, 48]); return; }
      if (alto > 30) elip(L, am, 0, base + alto * 0.68, 1.9, 1.9, 0.5, [110, 74, 42]); // cofa
      for (const s of [-1, 1]) for (const k of [-1, 1]) linea(L, am + k * 1.4, s * ancho(am, base), regala(am), am, 0, base + alto * 0.66, [96, 74, 52]); // obenques
      if (o.sinVelas) { if (i === 0 && o.jirones) for (let k = 0; k < 3; k++) linea(L, am + 0.6, -3 + k * 3, base + alto * 0.6, am + 1.2, -3 + k * 3 + 0.5, base + alto * 0.42, velaD); return; }
      if (latina) { // mesana: vela latina
        linea(L, am + 5, 0, base + 3, am - 7, 0, base + alto * 0.95, [84, 58, 34]);
        triangulo(L, [am + 4.4, 0.3, base + 3.4], [am - 6.6, 0.3, base + alto * 0.92], [am - 6.6, 0.3, base + 3.6], vela, velaD);
      } else {
        const tramos = nv === 2 ? [[0.16, 0.5, 1], [0.56, 0.86, 0.72]] : [[0.2, 0.8, 1]];
        tramos.forEach(([t0, t1, fw], j) => {
          const hw = M * 1.25 * fw, z0 = base + alto * t0, z1 = base + alto * t1;
          for (let b = -hw - 0.6; b <= hw + 0.6; b += L.paso) L.p(am + 0.5, b, z1 + 0.4, 0, 0, 1, [84, 58, 34]); // verga
          const emb = o.sol && i === 1 && j === 0 ? (b, z) => { const dz = z - (z0 + z1) / 2, r = Math.hypot(b, dz * 1.1); return r < 2.6 ? [236, 168, 54] : r < 3.4 && Math.round(Math.atan2(dz, b) / (Math.PI / 6)) % 2 === 0 ? [214, 120, 40] : null; }
            : o.franja ? (b) => (Math.abs(b) < hw * 0.34 ? mix(col, [255, 255, 255], 0.12) : null) : null;
          velaCuadra(L, am + 0.9, hw, z0, z1, hincha * (j ? 0.8 : 1), vela, velaD, emb);
        });
      }
      // bandera en el tope
      const bc = i === 1 ? col : i === 0 ? [214, 60, 44] : oro;
      for (let k = 0; k < 9; k++) for (let j = 0; j < 3; j++) L.p(am - k * 0.6, Math.sin(k * 0.7) * 0.6, top + 0.6 + j * 0.6 - k * 0.04, 0, 1, 0, j === 1 ? sc(bc, 1.12) : bc, true);
    });
    // foque, del bauprés al trinquete
    const tri = o.mastiles[o.mastiles.length - 1];
    if (!o.sinVelas && tri && !tri[3]) triangulo(L, [LA + o.largo * 0.17, 0, cub(LA) + o.largo * 0.08], [tri[0] + 1.4, 0, cub(tri[0]) + tri[1] * 0.72], [tri[0] + 2, 0, cub(tri[0]) + 3], vela, velaD);
    if (o.brujula) elip(L, -LA * 0.92, 0, cub(-LA) + 1.4, 0.9, 0.9, 0.6, [120, 210, 255]);
    sombraElip(L, 0, 0, LA + 2, M + 2);
  }
  function aguaBarco(L, o, ox, oy, f) {
    return pb => {
      const LA = o.largo / 2;
      for (let a = -LA - 2; a <= LA + 2; a += 0.6) for (const s of [-1, 1]) {
        const w = (a > LA * 0.55 ? o.manga * Math.sqrt(Math.max(0, (LA - Math.min(a, LA)) / (LA * 0.45))) : o.manga * 0.72) * s + s * 1.2;
        const aa = a * L.k, bb = w * L.k, wx = aa * L.ca - bb * L.sa, wy = aa * L.sa + bb * L.ca;
        if ((Math.round(a * 1.7) + f) % 3) pb.set(Math.round(ox + wx - wy), Math.round(oy + (wx + wy) / 2), [226, 244, 250], 150);
      }
    };
  }
  // El Galeón del Alba: encallado y roto en la orilla (le faltan piezas) o reparado y fondeado, listo para zarpar.
  const GALC3 = new Map();
  S.galeon = function (listo, piezas) {
    const key = (listo ? 'L' : 'R') + (piezas || []).join(',');
    if (GALC3.has(key)) return GALC3.get(key);
    const tiene = id => listo || (piezas || []).includes(id);
    const W2 = 150, H2 = 132, ox = 74, oy = 96;
    const L = Lienzo(W2, H2, ox, oy, -0.28, 1.12); // en diagonal: de canto (−45°) las velas cuadras no se veían
    const o = { largo: 62, manga: 9.5, mastiles: [[-21, 30, 1, true], [-1, 46, 2], [16, 38, 2]], col: [176, 52, 40], sol: true,
      escora: listo ? 0 : 0.16, agujeros: !tiene('casco'), rotos: tiene('timon') ? [] : [1], sinVelas: !tiene('velas'), jirones: !listo, faro: listo, brujula: tiene('brujula') };
    barcoGrande(L, o);
    const spr = volcar(L, ox, oy, listo ? aguaBarco(L, o, ox, oy, 0) : null);
    GALC3.set(key, spr);
    return spr;
  };
  // El barco de colonos: una carabela con la vela del color del reino, colonos y cajas en cubierta.
  const COLC = new Map();
  S.barcoColonos3d = function (col, flip) {
    const key = col.join(',') + (flip ? 1 : 0);
    if (COLC.has(key)) return COLC.get(key);
    const W2 = 76, H2 = 72, ox = 38, oy = 52;
    const L = Lienzo(W2, H2, ox, oy, flip ? Math.PI / 2 + 0.28 : -0.28, 0.82);
    const o = { largo: 34, manga: 5.4, mastiles: [[-8, 18, 1, true], [3, 28, 1]], col, franja: true, carga: true, faro: true };
    barcoGrande(L, o);
    const spr = volcar(L, ox, oy, aguaBarco(L, o, ox, oy, 0));
    COLC.set(key, spr);
    return spr;
  };

  // ---------- Máquinas de asedio: catapulta, ariete y torre de asedio (pk-80) ----------
  // Antes las tres se dibujaban con S.cart (la carreta de carga con su burro, piedras o troncos) y los jugadores las
  // reportaban como «tropas que se ven como carretas». Cada una tiene ahora su modelo, con el color del reino en el
  // banderín. `ataca` anima el oficio: la catapulta suelta el brazo (cuadros 0..3: cargada, sube, golpea el travesaño,
  // vuelve), el ariete mece la viga y la torre baja el puente. Firma: S.maquina(tipo, col, dir, cuadro, anda, ataca).
  // palo: cilindro entre dos puntos cualesquiera (brazos, riostras, cuerdas)
  function palo(L, a0, b0, z0, a1, b1, z1, r, c) {
    const va = a1 - a0, vb = b1 - b0, vz = z1 - z0, lg = Math.hypot(va, vb, vz) || 1, u = [va / lg, vb / lg, vz / lg];
    const t0 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let p = [u[1] * t0[2] - u[2] * t0[1], u[2] * t0[0] - u[0] * t0[2], u[0] * t0[1] - u[1] * t0[0]];
    const pl = Math.hypot(...p); p = p.map(v => v / pl);
    const q = [u[1] * p[2] - u[2] * p[1], u[2] * p[0] - u[0] * p[2], u[0] * p[1] - u[1] * p[0]];
    const n = Math.max(6, Math.ceil((2 * Math.PI * r) / L.paso));
    for (let s = 0; s <= lg; s += L.paso) for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      const na = p[0] * ct + q[0] * st, nb = p[1] * ct + q[1] * st, nz = p[2] * ct + q[2] * st;
      L.p(a0 + u[0] * s + na * r, b0 + u[1] * s + nb * r, z0 + u[2] * s + nz * r, na, nb, nz, c);
    }
  }
  // caja con color por punto: f(a, b, z, cara) — tablas, franjas, troneras
  function cajaP(L, a0, a1, b0, b1, z0, z1, f, sinArriba) {
    const s = L.paso;
    if (!sinArriba) for (let a = a0; a <= a1 + 1e-6; a += s) for (let b = b0; b <= b1 + 1e-6; b += s) L.p(a, b, z1, 0, 0, 1, f(a, b, z1, 'z'));
    for (let a = a0; a <= a1 + 1e-6; a += s) for (let z = z0; z <= z1 + 1e-6; z += s) { L.p(a, b1, z, 0, 1, 0, f(a, b1, z, 'b')); L.p(a, b0, z, 0, -1, 0, f(a, b0, z, 'b')); }
    for (let b = b0; b <= b1 + 1e-6; b += s) for (let z = z0; z <= z1 + 1e-6; z += s) { L.p(a1, b, z, 1, 0, 0, f(a1, b, z, 'a')); L.p(a0, b, z, -1, 0, 0, f(a0, b, z, 'a')); }
  }
  const HIERRO = [96, 100, 110], HIERRO_L = [150, 156, 168], CUERO = [150, 104, 64], CUERO_D = [112, 74, 44];
  function banderin(L, a, b, z0, alto, col, f, anda) {
    cilZ(L, a, b, z0, z0 + alto, 0.35, [70, 46, 26]);
    const ondea = anda ? Math.sin((f / 4) * Math.PI * 2) : Math.sin((f / 4) * Math.PI);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) L.p(a - 0.3 - i * 0.5, b + Math.sin(i * 0.7 + f) * 0.35 * (1 + ondea * 0.5), z0 + alto - 3.6 + j * 0.75 - i * 0.1, 0, 1, 0, j === 4 ? sc(col, 1.15) : i > 7 ? sc(col, 0.85) : col, true);
  }
  function catapulta(L, col, f, anda, ataca) {
    sombraElip(L, -1, 0, 12, 7);
    const fase = anda ? (f / 4) * (Math.PI / 3) : 0;
    // bastidor bajo con cuatro ruedas
    for (const s of [-1, 1]) caja(L, -10, 9, s * 4.2 - 0.7, s * 4.2 + 0.7, 3.2, 4.8, MADERA, MADERA_L);
    for (const a of [-9, -2.5, 8]) caja(L, a - 0.7, a + 0.7, -4.2, 4.2, 3.4, 4.6, MADERA_D, MADERA);
    for (const a of [-6.5, 6.5]) for (const s of [-1, 1]) rueda(L, a, s * 5.6, 3, 3, 0.9, fase, 6);
    // los dos parantes con su riostra y el travesaño acolchado donde pega el brazo
    for (const s of [-1, 1]) {
      caja(L, -0.2, 1.2, s * 3.9 - 0.6, s * 3.9 + 0.6, 4.8, 13.5, MADERA, MADERA_L);
      palo(L, 6.5, s * 3.9, 4.8, 0.8, s * 3.9, 11.5, 0.45, MADERA_D);
    }
    caja(L, -0.4, 1.4, -4.4, 4.4, 12.6, 13.9, MADERA_D, MADERA);
    caja(L, -1.1, -0.3, -2.4, 2.4, 12.2, 14.2, CUERO, sc(CUERO, 1.15)); // cojín de cuero
    // el haz de cuerdas torcidas que mueve el brazo
    for (let b = -3.4; b <= 3.4; b += L.paso) for (let t = 0; t < Math.PI * 2; t += 0.18) L.p(-4 + Math.cos(t) * 1.4, b, 5.6 + Math.sin(t) * 1.4, Math.cos(t), 0, Math.sin(t), Math.round(b * 2 + t * 2) % 3 ? CUERDA : sc(CUERDA, 0.78));
    // el brazo: echado hacia atrás con la piedra en la cuchara; al atacar sube hasta el travesaño
    const ang = ataca ? [0.22, 0.95, 1.5, 0.7][f] : 0.22, piedra = !ataca || f < 2, largo = 11;
    const ea = -4 - Math.cos(ang) * largo, ez = 5.6 + Math.sin(ang) * largo;
    palo(L, -4, 0, 5.6, ea, 0, ez, 0.6, MADERA_D);
    for (const s of [-1, 1]) palo(L, -4, s * 0.6, 5.6, -4 - Math.cos(ang) * 4, s * 0.6, 5.6 + Math.sin(ang) * 4, 0.3, HIERRO); // flejes
    elip(L, ea - Math.sin(ang) * 0.6, 0, ez + Math.cos(ang) * 0.6, 1.7, 1.7, 0.9, MADERA, (a, b, z) => (z > ez + Math.cos(ang) * 0.6 + 0.3 ? MADERA_D : null)); // la cuchara
    if (piedra) elip(L, ea - Math.sin(ang) * 1.2, 0, ez + Math.cos(ang) * 1.3, 1.25, 1.25, 1.15, [132, 128, 120], (a, b, z) => (U.hash(Math.round(a * 3), Math.round(b * 3), Math.round(z * 3)) > 0.75 ? [100, 96, 90] : null));
    else if (f === 2) elip(L, 3, 0, 18, 1.2, 1.2, 1.1, [132, 128, 120]); // la piedra sale volando
    // dos piedras de repuesto y el banderín del reino
    elip(L, 5, -1.6, 5.9, 1.1, 1.1, 1, [120, 116, 108]); elip(L, 5.6, 1.2, 5.8, 1, 1, 0.9, [140, 136, 126]);
    banderin(L, 8.4, 4.2, 4.8, 12, col, f, anda);
  }
  function ariete(L, col, f, anda, ataca) {
    sombraElip(L, 0, 0, 13, 8);
    const fase = anda ? (f / 4) * (Math.PI / 3) : 0;
    for (const s of [-1, 1]) caja(L, -10, 10, s * 5.2 - 0.7, s * 5.2 + 0.7, 3, 4.6, MADERA_D, MADERA);
    for (const a of [-9.5, 9.5]) caja(L, a - 0.6, a + 0.6, -5.2, 5.2, 3.2, 4.4, MADERA_D);
    for (const a of [-6.8, 6.8]) for (const s of [-1, 1]) rueda(L, a, s * 6.3, 3.2, 3.2, 1, fase, 6);
    // la viga con cabeza de hierro, colgada de cadenas: se mece hacia adelante al golpear
    const em = ataca ? [0, 2.6, 4.4, 1.4][f] : anda ? Math.sin((f / 4) * Math.PI * 2) * 0.5 : 0, zv = 7.2;
    cilA(L, -9 + em, 11 + em, 0, zv, 1.5, [132, 92, 52], [196, 150, 96]);
    for (const a of [-5 + em, 4 + em]) for (let t = 0; t < Math.PI * 2; t += 0.15) L.p(a, Math.cos(t) * 1.65, zv + Math.sin(t) * 1.65, 0, Math.cos(t), Math.sin(t), HIERRO); // zunchos
    for (let a = 11 + em; a <= 14.5 + em; a += L.paso) { const r = 1.8 - (a - 11 - em) * 0.22; for (let t = 0; t < Math.PI * 2; t += 0.15) L.p(a, Math.cos(t) * r, zv + Math.sin(t) * r, 0.4, Math.cos(t), Math.sin(t), (a - em) > 13.6 ? HIERRO_L : HIERRO); }
    for (const a of [-4, 5]) palo(L, a, 0, 15, a + em * 0.6, 0, zv + 1.5, 0.3, [70, 66, 62]);
    // cuatro postes y el techo a dos aguas cubierto de cueros cosidos (lo protege de las flechas)
    for (const a of [-9.2, 9.2]) for (const s of [-1, 1]) caja(L, a - 0.6, a + 0.6, s * 5.2 - 0.6, s * 5.2 + 0.6, 4.6, 9, MADERA, MADERA_L);
    for (let a = -10.5; a <= 10.5; a += L.paso) for (let b = 0; b <= 6.8; b += L.paso) {
      const z = 15.2 - b * 1.0, parche = U.hash(Math.floor((a + 11) / 3.4), Math.floor(b / 2.4), 9), costura = Math.abs(((a + 11) % 3.4) - 1.7) > 1.55;
      const c = costura ? CUERO_D : parche > 0.66 ? sc(CUERO, 1.12) : parche < 0.22 ? CUERO_D : CUERO;
      for (const s of [-1, 1]) L.p(a, s * b, z, 0, s * 0.7, 0.7, c);
    }
    for (let a = -10.5; a <= 10.5; a += L.paso) for (let t = 0; t < Math.PI; t += 0.25) L.p(a, Math.cos(t) * 0.5, 15.3 + Math.sin(t) * 0.5, 0, Math.cos(t), Math.sin(t), sc(col, a % 4 < 2 ? 1 : 0.85)); // cumbrera del color del reino
    // frontón de tablas atrás (adelante queda abierto para la viga)
    for (let b = -6.8; b <= 6.8; b += L.paso) for (let z = 8.4; z <= 15.2 - Math.abs(b); z += L.paso) L.p(-10.5, b, z, -1, 0, 0, Math.round(b) % 2 ? MADERA : MADERA_D);
    banderin(L, -9.8, 0, 15.2, 8, col, f, anda);
  }
  function torreAsedio(L, col, f, anda, ataca) {
    sombraElip(L, 0, 0, 10, 10);
    const fase = anda ? (f / 4) * (Math.PI / 3) : 0, W = 6, Z0 = 3.4, Z1 = 38;
    for (const a of [-4.5, 4.5]) for (const s of [-1, 1]) rueda(L, a, s * (W + 0.7), 3, 3, 1, fase, 6);
    // el cuerpo: tablas verticales, vigas cada piso, troneras, y cueros mojados abajo adelante
    const pisos = [Z0, 13.5, 24, Z1];
    cajaP(L, -W, W, -W, W, Z0, Z1, (a, b, z, cara) => {
      if (cara === 'z') return MADERA_D;
      const u = cara === 'a' ? b : a, viga = pisos.some(p => Math.abs(z - p) < 0.7);
      if (viga) return MADERA_D;
      const tronera = Math.abs(u) < 0.6 && pisos.some((p, i) => i && z < p - 2.5 && z > p - 6.5);
      if (tronera) return [34, 24, 18];
      if (cara === 'a' && a > 0 && z < 13.5) return Math.abs((u + 7) % 3 - 1.5) > 1.35 ? CUERO_D : CUERO;
      return Math.round(u * 0.8) % 2 ? MADERA : sc(MADERA, 0.88);
    });
    // almenas de arriba
    for (let i = -W; i <= W - 1.5; i += 3) for (const [a0, a1, b0, b1] of [[i, i + 1.6, W - 1.2, W], [i, i + 1.6, -W, -W + 1.2], [W - 1.2, W, i, i + 1.6], [-W, -W + 1.2, i, i + 1.6]]) caja(L, a0, a1, b0, b1, Z1, Z1 + 2.4, MADERA, MADERA_L);
    // el puente levadizo del último piso: cerrado contra la torre o bajado hacia adelante al atacar
    const zP = 25;
    if (ataca && f >= 1) {
      const ang = f === 1 ? 0.8 : 0, lg = 9;
      for (let s = 0; s <= lg; s += L.paso) for (let b = -3.4; b <= 3.4; b += L.paso) L.p(W + Math.cos(ang) * s, b, zP + Math.sin(ang) * s, -Math.sin(ang), 0, Math.cos(ang), Math.round(s * 0.9) % 2 ? MADERA_L : MADERA);
      for (const s2 of [-1, 1]) palo(L, W, s2 * 3.2, Z1 - 1, W + Math.cos(ang) * lg, s2 * 3.2, zP + Math.sin(ang) * lg, 0.18, [70, 66, 62]);
    } else {
      cajaP(L, W, W + 0.8, -3.6, 3.6, zP, zP + 10, (a, b, z) => (Math.abs(z - zP - 5) < 0.5 ? HIERRO : Math.round(b * 0.9) % 2 ? MADERA_L : MADERA));
      for (const s2 of [-1, 1]) palo(L, W + 0.8, s2 * 3.2, zP + 9.6, W, s2 * 3.2, Z1 - 0.5, 0.18, [70, 66, 62]);
    }
    banderin(L, -W + 0.8, W - 0.8, Z1, 10, col, f, anda);
    // franja del reino en el piso de abajo
    for (let b = -W; b <= W; b += L.paso) for (let z = 9; z <= 10.4; z += L.paso) L.p(W + 0.05, b, z, 1, 0, 0, col);
  }
  const MQ = new Map(), MQ_TAM = { catapult: [56, 46, 28, 32, 0.9], ariete: [56, 46, 28, 32, 0.8], torreAsedio: [50, 64, 25, 50, 0.7] };
  // con el «flip» viejo (batalla, frente) se ven de tres cuartos (rumbo 0 o 2): de perfil puro eran una caja plana
  S.maquina = function (tipo, col, dir, frame, anda, ataca) {
    const d = typeof dir === 'number' ? rumbo(dir) : dir ? 2 : 0, f = frame % 4, key = tipo + '|' + col.join(',') + '|' + d + '|' + f + '|' + (anda ? 1 : 0) + (ataca ? 1 : 0);
    if (MQ.has(key)) return MQ.get(key);
    const [w, h, ox, oy, k] = MQ_TAM[tipo] || MQ_TAM.catapult, L = Lienzo(w, h, ox, oy, (d * Math.PI) / 4, k);
    (tipo === 'ariete' ? ariete : tipo === 'torreAsedio' ? torreAsedio : catapulta)(L, col, f, anda, ataca);
    const spr = volcar(L, ox, oy, anda ? polvo(L, -11, f, ox, oy) : null);
    MQ.set(key, spr);
    return spr;
  };
  S.esMaquina = tipo => tipo === 'catapult' || !!((PK.D.ARMY[tipo] || {}).maquina);

  // ---------- Hacia dónde mira cada vehículo (solo dibujo) ----------
  // Del movimiento entre cuadros, con histéresis: no cambia de dirección por un temblor de la ruta.
  S.rumboDe = function (u) {
    if (u.vx0 !== undefined) {
      const dx = u.x - u.vx0, dy = u.y - u.vy0;
      if (dx * dx + dy * dy > 1e-5) {
        const ang = Math.atan2(dy, dx), cand = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
        if (u.dir8 === undefined) u.dir8 = cand;
        else {
          const centro = (u.dir8 * Math.PI) / 4; let dif = Math.abs(ang - centro) % (Math.PI * 2);
          if (dif > Math.PI) dif = Math.PI * 2 - dif;
          if (dif > Math.PI / 8 + 0.12) u.dir8 = cand;
        }
      }
    }
    u.vx0 = u.x; u.vy0 = u.y;
    return u.dir8 === undefined ? (u.flip ? 3 : 7) : u.dir8;
  };
})();
