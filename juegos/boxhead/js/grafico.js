/* Pro BoxHead — el dibujo. Todo es canvas 2D, pero se ve en 3D:

   - **Los modelos son cubos.** Cada pieza del cuerpo (piernas, torso,
     brazos, cabeza, pelo, el arma) es un cubo con su tamaño y su sitio en
     el espacio del modelo (r a la derecha, f hacia delante, z hacia
     arriba). `modelo` lo gira hacia donde mira, lo inclina hacia atrás si
     hace falta (el tumbo de un golpe, la caída al morir), lo proyecta en
     tres cuartos (`KY`) y pinta solo las caras que miran a la cámara, cada
     una con su luz. Las piezas se ordenan por profundidad.
   - **Los muros son bloques blancos con chaflanes**, como los pilares del
     original: la esquina que queda al aire se corta en diagonal y su
     faceta sale más clara o más oscura según la luz.
   - **El suelo guarda todo** (`crearSuelo`): un lienzo del tamaño del mapa
     donde se pinta el piso una vez y después se estampa cada gota de
     sangre, cada charco y cada quemadura. Nunca se borra durante la
     partida.
   - **Los efectos** (`crearEfectos`): partículas con altura (gotas que caen
     y manchan el suelo al llegar, trozos, chispas, humo, fuego), los
     fogonazos, los trazos de bala y los cadáveres que caen y se hunden. */
(function (raiz) {
  'use strict';
  const TS = 32;
  const KY = 0.72;                      // cuánto se ve la profundidad de un modelo
  const LUZ = (() => { const v = [-0.45, 0.3, 0.85], n = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / n); })();
  const azar = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- color ----------
  const RGB = new Map(), TONO = new Map();
  function rgb(h) {
    let v = RGB.get(h);
    if (v) return v;
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    v = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    RGB.set(h, v);
    return v;
  }
  // El color de una cara con su luz (s ≈ 0.5–1); `bl` lo lleva casi a blanco (golpe).
  function tono(h, s, bl) {
    const q = Math.round(s * 40), k = h + q + (bl ? 'b' : '');
    let v = TONO.get(k);
    if (v) return v;
    const c = rgb(h), f = q / 40;
    let r = c[0] * f, g = c[1] * f, b = c[2] * f;
    if (bl) { r = r * 0.25 + 240; g = g * 0.25 + 240; b = b * 0.25 + 240; }
    v = 'rgb(' + Math.round(clamp(r, 0, 255)) + ',' + Math.round(clamp(g, 0, 255)) + ',' + Math.round(clamp(b, 0, 255)) + ')';
    TONO.set(k, v);
    return v;
  }
  const rgba = (h, a) => { const c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  // ---------- sprites suaves (humo, fuego, brillo), pintados una vez ----------
  function sprite(fn, n = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    fn(c.getContext('2d'), n);
    return c;
  }
  const radial = (stops) => (g, n) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  };
  let SP = null;
  function sprites() {
    if (SP) return SP;
    SP = {
      humo: sprite(radial([[0, 'rgba(72,68,64,.9)'], [0.5, 'rgba(60,56,52,.55)'], [1, 'rgba(50,48,46,0)']])),
      humoClaro: sprite(radial([[0, 'rgba(170,165,158,.8)'], [0.55, 'rgba(150,146,140,.4)'], [1, 'rgba(140,136,130,0)']])),
      fuego: sprite(radial([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,224,120,.95)'], [0.55, 'rgba(255,128,30,.7)'], [1, 'rgba(200,40,0,0)']])),
      brillo: sprite(radial([[0, 'rgba(255,230,160,.9)'], [0.4, 'rgba(255,170,60,.35)'], [1, 'rgba(255,120,20,0)']])),
      acido: sprite(radial([[0, 'rgba(240,255,190,1)'], [0.35, 'rgba(150,240,70,.85)'], [1, 'rgba(40,160,0,0)']])),
      morado: sprite(radial([[0, 'rgba(250,220,255,1)'], [0.35, 'rgba(190,90,255,.85)'], [1, 'rgba(90,0,160,0)']])),
      niebla: sprite(radial([[0, 'rgba(190,20,20,.7)'], [1, 'rgba(150,0,0,0)']]), 32),
    };
    return SP;
  }

  // ---------- modelos de cubos ----------
  /* Esquinas: bit 0 = r+, bit 1 = f+, bit 2 = arriba. Cada cara lista sus
     esquinas empezando por el origen de su (u, v): de v[0] a v[1] corre u y
     de v[0] a v[3] corre v. */
  const CARAS = [
    { n: [0, 0, 1], v: [4, 5, 7, 6], k: 'arriba' },
    { n: [0, 0, -1], v: [0, 1, 3, 2], k: 'abajo' },
    { n: [0, 1, 0], v: [2, 3, 7, 6], k: 'frente' },
    { n: [0, -1, 0], v: [1, 0, 4, 5], k: 'atras' },
    { n: [1, 0, 0], v: [1, 3, 7, 5], k: 'der' },
    { n: [-1, 0, 0], v: [2, 0, 4, 6], k: 'izq' }
  ];
  const caraVis = [0, 0, 0, 0, 0, 0], caraLuz = [0, 0, 0, 0, 0, 0];

  function quad(c, P, i0, i1, i3, u0, v0, u1, v1) {
    const a = P[i0], b = P[i1], d = P[i3];
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - a[0], vy = d[1] - a[1];
    c.beginPath();
    c.moveTo(a[0] + ux * u0 + vx * v0, a[1] + uy * u0 + vy * v0);
    c.lineTo(a[0] + ux * u1 + vx * v0, a[1] + uy * u1 + vy * v0);
    c.lineTo(a[0] + ux * u1 + vx * v1, a[1] + uy * u1 + vy * v1);
    c.lineTo(a[0] + ux * u0 + vx * v1, a[1] + uy * u0 + vy * v1);
    c.closePath(); c.fill();
  }

  /* Un punto del espacio del modelo en la pantalla (para la boca del arma,
     la mano que lleva el fuego…). */
  function proyecta(x, y, ang, r, f, z, s = 1, cae = 0) {
    const ca = Math.cos(ang), sa = Math.sin(ang), cp = Math.cos(cae), sp = Math.sin(cae);
    r *= s; f *= s; z *= s;
    const f2 = f * cp - z * sp, z2 = f * sp + z * cp;
    const wx = -sa * r + ca * f2, wy = ca * r + sa * f2;
    return [x + wx, y + wy * KY - z2, x + wx, y + wy, z2];
  }

  /* Pinta una lista de cubos. `op`: talla (escala), cae (inclinación hacia
     atrás, en radianes), flash (casi blanco), linea/borde (el contorno). Una
     pieza puede llevar `luz` (no se sombrea: ojos que brillan, fuego), `cs`
     (otro color por cara) y `deco` (rectángulos sobre una cara, en u/v de 0
     a 1: [u0, v0, u1, v1, color, brilla]). */
  function modelo(c, x, y, ang, partes, op) {
    op = op || {};
    const s = op.talla || 1, ph = op.cae || 0, fl = !!op.flash;
    const ca = Math.cos(ang), sa = Math.sin(ang), cp = Math.cos(ph), sp = Math.sin(ph);
    for (let i = 0; i < 6; i++) {
      const n = CARAS[i].n;
      const f2 = n[1] * cp - n[2] * sp, z2 = n[1] * sp + n[2] * cp;
      const nx = -sa * n[0] + ca * f2, ny = ca * n[0] + sa * f2;
      caraVis[i] = ny + KY * z2 > 0.03;
      caraLuz[i] = 0.5 + 0.56 * Math.max(0, nx * LUZ[0] + ny * LUZ[1] + z2 * LUZ[2]);
    }
    const hechas = [];
    for (const p of partes) {
      if (!p) continue;
      const P = new Array(8);
      let my = 0, mz = 0;
      for (let i = 0; i < 8; i++) {
        const lr = (p.r + (i & 1 ? p.w : -p.w) / 2) * s;
        const lf = (p.f + (i & 2 ? p.d : -p.d) / 2) * s;
        const lz = (i & 4 ? p.z + p.h : p.z) * s;
        const f2 = lf * cp - lz * sp, z2 = lf * sp + lz * cp;
        const wx = -sa * lr + ca * f2, wy = ca * lr + sa * f2;
        P[i] = [x + wx, y + wy * KY - z2];
        my += wy; mz += z2;
      }
      hechas.push({ p, P, prof: (my + KY * mz) / 8 + (p.capa || 0) });
    }
    hechas.sort((a, b) => a.prof - b.prof);
    c.lineJoin = 'round';
    c.lineWidth = (op.linea || 0.7) * Math.max(1, s * 0.8);
    c.strokeStyle = op.borde || 'rgba(16,14,18,.82)';
    for (const { p, P } of hechas) {
      for (let i = 0; i < 6; i++) {
        if (!caraVis[i]) continue;
        const C = CARAS[i], v = C.v, col = (p.cs && p.cs[C.k]) || p.c;
        c.fillStyle = p.luz ? col : tono(col, caraLuz[i], fl);
        c.beginPath();
        c.moveTo(P[v[0]][0], P[v[0]][1]); c.lineTo(P[v[1]][0], P[v[1]][1]);
        c.lineTo(P[v[2]][0], P[v[2]][1]); c.lineTo(P[v[3]][0], P[v[3]][1]);
        c.closePath(); c.fill();
        if (!p.sinBorde) c.stroke();
        const dl = p.deco && p.deco[C.k];
        if (dl) for (const d of dl) {
          c.fillStyle = d[5] ? d[4] : tono(d[4], caraLuz[i], fl);
          quad(c, P, v[0], v[1], v[3], d[0], d[1], d[2], d[3]);
        }
      }
    }
  }

  // ---------- paletas ----------
  /* Los enemigos copian al original: zombis de bata blanca con la camisa
     gris asomando, pelo negro y los brazos estirados; diablos rojos de
     cuernos. Índice = k de ENEMIGOS. */
  const PAL_E = [
    { piel: '#efeee8', camisa: '#e4e5e8', panel: '#7a808a', pantalon: '#a2a6ae', pelo: '#2a2a2d', zapatos: '#3b3b40', ojos: '#191919', boca: '#6a1c1c', extra: 'zombi', brazos: 'zombi', sangre: 0 },
    { piel: '#d02a1e', camisa: '#c0221a', panel: '#7e100a', pantalon: '#8f170f', pelo: '#1e0907', zapatos: '#2a0a08', ojos: '#ffd84a', ojosLuz: 1, boca: '#300404', extra: 'cuernos', brazos: 'lado', fuegoMano: 'fuego', sangre: 1 },
    { piel: '#ece6d8', camisa: '#cfae7e', panel: '#8a6640', pantalon: '#5c6a7a', pelo: '#3b2a1a', ojos: '#191919', boca: '#6a1c1c', extra: 'zombi', brazos: 'zombi', ancho: 0.8, sangre: 0 },
    { piel: '#dcdcd6', camisa: '#5b606b', panel: '#34373e', pantalon: '#3d4048', pelo: '#161618', ojos: '#ff3a2a', ojosLuz: 1, boca: '#4a1010', extra: 'zombi', brazos: 'zombi', ancho: 1.22, grueso: 1.25, sangre: 0 },
    { piel: '#ebe6da', camisa: '#de6a1f', panel: '#f2c40f', pantalon: '#5a4a2a', pelo: '#2b2418', ojos: '#191919', boca: '#6a1c1c', extra: 'zombi', brazos: 'zombi', bomba: 1, sangre: 0 },
    { piel: '#b5dc96', camisa: '#5f8f3a', panel: '#3a5f22', pantalon: '#3e502c', pelo: '#26361a', ojos: '#eaff3a', ojosLuz: 1, boca: '#a8ff4a', bocaLuz: 1, extra: 'zombi', brazos: 'zombi', cabeza: 1.15, sangre: 2 },
    // jefes (6–15)
    { piel: '#e2d2c0', camisa: '#ece6da', panel: '#9a1a14', pantalon: '#3a2a22', pelo: '#2a1a12', ojos: '#ff2020', ojosLuz: 1, boca: '#4a1010', extra: 'careta', brazos: 'zombi', ancho: 1.2, grueso: 1.2, sangre: 0 },
    { piel: '#a8b0a0', camisa: '#2a1a3a', panel: '#5a2a8a', pantalon: '#1a1026', pelo: '#241436', ojos: '#b06aff', ojosLuz: 1, boca: '#1a0a22', extra: 'capucha', brazos: 'lado', fuegoMano: 'morado', sangre: 1 },
    { piel: '#9fc08a', camisa: '#4a1e5a', panel: '#7a3a8a', pantalon: '#2a1036', pelo: '#1a0a22', ojos: '#e070ff', ojosLuz: 1, boca: '#2a0a22', extra: 'sombrero', brazos: 'lado', fuegoMano: 'fuego', sangre: 2 },
    { piel: '#e8dfb0', camisa: '#d4c48a', panel: '#a8955a', pantalon: '#8a7a4a', pelo: '#a89a6a', ojos: '#fff6a0', ojosLuz: 1, boca: '#5a4a20', extra: 'zombi', brazos: 'zombi', ancho: 1.3, grueso: 1.4, cabeza: 0.9, sangre: 2 },
    { piel: '#d6e2f2', camisa: '#8a9aba', panel: '#5a6a8a', pantalon: '#3a4660', pelo: '#eef4ff', ojos: '#7ad8ff', ojosLuz: 1, boca: '#2a3a5a', extra: 'pelo', brazos: 'zombi', sangre: 3 },
    { piel: '#8a7a6a', camisa: '#5a4a3a', panel: '#3a2a1a', pantalon: '#2a2018', pelo: '#3a2a1a', ojos: '#ff7a1a', ojosLuz: 1, boca: '#2a1a10', extra: 'casco', brazos: 'lado', ancho: 1.3, grueso: 1.3, sangre: 0 },
    { piel: '#e8c040', camisa: '#2a1a0a', panel: '#e0b030', pantalon: '#1a1006', pelo: '#1a1006', ojos: '#ffe23a', ojosLuz: 1, boca: '#3a2a00', extra: 'corona', brazos: 'lado', ancho: 1.1, sangre: 2 },
    { piel: '#9a1010', camisa: '#3a0606', panel: '#ff5a1a', pantalon: '#1a0303', pelo: '#050000', ojos: '#ff2a1a', ojosLuz: 1, boca: '#000', extra: 'cuernos', brazos: 'lado', fuegoMano: 'fuego', ancho: 1.15, sangre: 1 },
    { piel: '#5aaa48', camisa: '#2a6a24', panel: '#8ae05a', pantalon: '#16401a', pelo: '#0e2a10', ojos: '#b0ff3a', ojosLuz: 1, boca: '#a8ff4a', bocaLuz: 1, extra: 'cuernos', brazos: 'zombi', cabeza: 1.1, sangre: 2 },
    { piel: '#9a9aa2', camisa: '#5a5a62', panel: '#3a3a42', pantalon: '#2a2a30', pelo: '#3a3a40', ojos: '#ff4a1a', ojosLuz: 1, boca: '#1a1a1a', extra: 'casco', brazos: 'lado', ancho: 1.35, grueso: 1.35, sangre: 0 }
  ];
  /* La sangre de cada cual: roja, la del diablo más oscura, verde el ácido. */
  const SANGRE = [[196, 14, 16], [120, 6, 10], [92, 150, 26], [70, 90, 150]];
  const sangreDe = k => SANGRE[(PAL_E[k] || PAL_E[0]).sangre] || SANGRE[0];

  // Un aspecto del jugador como paleta de modelo.
  function palJugador(s) {
    return { piel: s.piel, camisa: s.camisa, pantalon: s.pantalon, pelo: s.pelo, extra: s.extra, brazos: 'arma',
      zapatos: '#2a2420', ojos: s.extra === 'antena' ? '#44ffff' : '#1b1b1b', ojosLuz: s.extra === 'antena' ? 1 : 0, cinturon: '#3a2a1a' };
  }

  // ---------- las armas en la mano ----------
  const OSC = '#2a2c31', NEGRO = '#18191c';
  /* Cada arma: sus cubos (frente al pecho, entre las manos) y la boca
     (r, f, z) por donde sale el disparo. */
  function partesArma(w) {
    switch (w) {
      case 0: return { p: [
        { r: 1, f: 12.5, z: 16.6, w: 2.6, d: 7.4, h: 2.8, c: OSC, deco: { arriba: [[0.3, 0.1, 0.7, 0.9, '#4a4d55']] } },
        { r: 1, f: 10, z: 14, w: 2.4, d: 2.8, h: 3.2, c: NEGRO }], b: [1, 16.5, 18] };
      case 1: return { p: [
        { r: 1, f: 12.5, z: 16.2, w: 3.2, d: 9, h: 3.6, c: OSC, deco: { arriba: [[0.25, 0.55, 0.75, 0.95, '#4a4d55']] } },
        { r: 1, f: 12, z: 11.8, w: 2.2, d: 2.2, h: 4.4, c: NEGRO },
        { r: 1, f: 18, z: 17, w: 1.8, d: 3.2, h: 1.8, c: NEGRO }], b: [1, 19.6, 18] };
      case 2: return { p: [
        { r: 1, f: 6.5, z: 15.2, w: 2.8, d: 6, h: 3.2, c: '#6e4524' },
        { r: 1, f: 11.5, z: 16, w: 3, d: 5, h: 3.4, c: OSC },
        { r: 1, f: 18, z: 17.2, w: 2.3, d: 9.5, h: 2.2, c: '#3b3d43', deco: { arriba: [[0.2, 0, 0.8, 1, '#5a5d66']] } },
        { r: 1, f: 16.5, z: 15.4, w: 3.2, d: 4.4, h: 2, c: '#5c3a1c' }], b: [1, 23, 18.3] };
      case 3: return { p: [
        { r: 0, f: 11, z: 13, w: 8, d: 7, h: 8.5, c: '#c0392b', deco: { frente: [[0, 0.3, 1, 0.45, '#5a1209'], [0, 0.7, 1, 0.82, '#5a1209'], [0.38, 0.48, 0.62, 0.66, '#f5d33b']] } }], b: [0, 15, 17] };
      case 4: return { p: [
        { r: 2.2, f: 11, z: 15.5, w: 3.4, d: 3.4, h: 4.2, c: '#4d5c2a', deco: { frente: [[0, 0.45, 1, 0.55, '#2e3816']] } },
        { r: 2.2, f: 11, z: 19.7, w: 1.6, d: 1.6, h: 1.3, c: '#9a9a8a' }], b: [2.2, 13, 18] };
      case 5: return { p: [
        { r: 0, f: 11, z: 12.5, w: 11, d: 4.6, h: 9, c: '#ecebe6', deco: { frente: [[0, 0.48, 1, 0.54, '#b9b7b0'], [0.48, 0.54, 0.53, 1, '#b9b7b0']] } }], b: [0, 14, 17] };
      case 6: return { p: [
        { r: 3, f: 8, z: 18.5, w: 4.8, d: 19, h: 4.8, c: '#4d5a3a', deco: { arriba: [[0.15, 0.2, 0.85, 0.3, '#2e3622']] } },
        { r: 3, f: 18.4, z: 18, w: 5.8, d: 2, h: 5.8, c: '#2a2f22' },
        { r: 3, f: -2.2, z: 18.2, w: 5.4, d: 2.2, h: 5.4, c: '#2a2f22' },
        { r: 3, f: 9, z: 23.4, w: 1.6, d: 4, h: 2.2, c: NEGRO },
        { r: 3, f: 6, z: 15, w: 2, d: 2.4, h: 3.6, c: NEGRO }], b: [3, 19.8, 20.9] };
      case 7: return { p: [
        { r: 1, f: 11, z: 15, w: 6.2, d: 4.2, h: 2.8, c: '#c9b48a', deco: { arriba: [[0.15, 0.2, 0.85, 0.4, '#3a4a5a'], [0.42, 0.6, 0.58, 0.8, '#ff2a2a', 1]] } }], b: [1, 13, 17] };
    }
    return { p: [], b: [0, 12, 17] };
  }
  // Dónde está la boca del arma `w` en la pantalla: [sx, sy, mundo x, mundo y, z].
  function boca(x, y, ang, w, s = 1) {
    const b = partesArma(w).b;
    return proyecta(x, y, ang, b[0], b[1], b[2], s);
  }

  // ---------- el humanoide ----------
  const brilla = (c, sp, x, y, r, a) => { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.drawImage(sp, x - r, y - r, r * 2, r * 2); c.restore(); };

  /* Un personaje: jugador, zombi, diablo o jefe. `op`: t (reloj de su
     animación), mov, arma (id o -1), rec (retroceso 0–1), atk (ataque 0–1),
     tumbo (0–1), cae (radianes), flash, talla, sinSombra, brillo (0–1 para
     la panza del explosivo). Devuelve la boca del arma en pantalla si lleva. */
  function humanoide(c, x, y, ang, pal, op) {
    op = op || {};
    const s = op.talla || 1, mov = !!op.mov, t = op.t || 0;
    const cae = Math.max(op.cae || 0, 0.42 * (op.tumbo || 0));
    if (!op.sinSombra) {
      const lejos = Math.sin(Math.min(cae, Math.PI / 2)) * 16 * s;
      c.fillStyle = 'rgba(0,0,0,' + (0.3 - 0.08 * Math.min(1, cae)).toFixed(2) + ')';
      c.beginPath();
      c.ellipse(x - Math.cos(ang) * lejos * 0.5, y - Math.sin(ang) * lejos * 0.5, (10 + lejos * 0.5) * s, (4.6 + lejos * 0.25) * s, 0, 0, Math.PI * 2);
      c.fill();
    }
    const fase = t * 11, sw = mov ? Math.sin(fase) : 0, bob = mov ? Math.abs(Math.cos(fase)) * 0.9 : 0;
    const an = pal.ancho || 1, gr = pal.grueso || 1, cab = pal.cabeza || 1;
    const zap = pal.zapatos || '#2c2c30';
    const P = [];
    // piernas
    const pie = [[0, 0, 1, 0.24, zap]];
    const dPie = { frente: pie, der: pie, izq: pie, atras: pie };
    for (const lado of [-1, 1]) {
      const sg = lado < 0 ? 1 : -1;
      P.push({ r: 3.1 * lado * an, f: sg * sw * 3.2, z: mov ? Math.max(0, sg * Math.cos(fase)) * 1.3 : 0, w: 4.8 * an, d: 5, h: 10, c: pal.pantalon, deco: dPie });
    }
    // torso
    const zt = 9.5 + bob, dTorso = [];
    if (pal.panel) dTorso.push([0.36, 0.08, 0.64, 1, pal.panel]);
    if (pal.cinturon) dTorso.push([0, 0, 1, 0.14, pal.cinturon]);
    else dTorso.push([0, 0, 1, 0.1, rgbOscuro(pal.camisa)]);
    P.push({ r: 0, f: 0, z: zt, w: 15 * an, d: 8.6 * gr, h: 12.5, c: pal.camisa, deco: { frente: dTorso, arriba: pal.panel ? [[0.38, 0.6, 0.62, 1, pal.panel]] : null } });
    if (pal.bomba) {
      // El explosivo lleva un cinturón de dinamita sobre la panza.
      const b = op.brillo || 0, luz = 'rgb(255,' + Math.round(80 + 140 * b) + ',40)';
      for (const r of [-4.2, -1.4, 1.4, 4.2]) P.push({ r, f: 4.9 * gr, z: zt + 2, w: 2.4, d: 2, h: 6, c: '#c8321e', deco: { arriba: [[0.3, 0.3, 0.7, 0.7, '#f0e0b0']] } });
      P.push({ r: 0, f: 6.1 * gr, z: zt + 4, w: 3, d: 1, h: 2.4, c: luz, luz: 1 });
    }
    // brazos
    const rec = op.rec || 0, atk = op.atk || 0;
    if (pal.brazos === 'zombi') {
      for (const lado of [-1, 1]) {
        const oscila = Math.sin(t * 5 + lado) * 0.9;
        const fx = 5 + atk * 4 + oscila, zz = zt + 7 + atk * 1.5;
        P.push({ r: 5.6 * lado * an, f: fx, z: zz, w: 4.2, d: 7.4, h: 4.2, c: pal.camisa });
        P.push({ r: 5.6 * lado * an, f: fx + 5.4, z: zz + 0.2, w: 3.8, d: 3.6, h: 3.8, c: pal.piel });
      }
    } else if (pal.brazos === 'arma' && op.arma >= 0) {
      const kf = -rec * 2.6, kz = rec * 0.8;
      P.push({ r: 5.3, f: 4.2 + kf, z: zt + 5.6 + kz, w: 4, d: 7.2, h: 4, c: pal.camisa });
      P.push({ r: 3.2, f: 9 + kf, z: zt + 5.8 + kz, w: 3.4, d: 3.4, h: 3.4, c: pal.piel });
      P.push({ r: -5.3, f: 4.6 + kf, z: zt + 5.2 + kz, w: 4, d: 7.6, h: 4, c: pal.camisa });
      P.push({ r: -1.6, f: 10 + kf, z: zt + 5.2 + kz, w: 3.4, d: 3.4, h: 3.4, c: pal.piel });
      for (const q of partesArma(op.arma).p) P.push(Object.assign({}, q, { f: q.f + kf, z: q.z + kz }));
    } else {
      for (const lado of [-1, 1]) {
        const arriba = lado > 0 && atk > 0 ? atk : 0;
        const fx = -sw * 2.2 * lado + arriba * 5;
        P.push({ r: 9.6 * lado * an, f: fx, z: zt + 4 + arriba * 5, w: 4.2, d: 4.4, h: 8, c: pal.camisa });
        P.push({ r: 9.6 * lado * an, f: fx, z: zt + 0.5 + arriba * 5, w: 3.8, d: 3.8, h: 3.6, c: pal.piel });
      }
    }
    // cabeza
    const zc = zt + 12.5, hw = 14 * cab, hd = 13 * cab, hh = 13 * cab;
    const ojo = pal.ojos || '#1b1b1b', ol = !!pal.ojosLuz;
    const cara = [[0.18, 0.4, 0.37, 0.6, ojo, ol], [0.63, 0.4, 0.82, 0.6, ojo, ol]];
    if (pal.boca) cara.push([0.3, 0.13, 0.7, 0.23, pal.boca, !!pal.bocaLuz]);
    let cabeza = { r: 0, f: 0, z: zc, w: hw, d: hd, h: hh, c: pal.piel, deco: { frente: cara } };
    const tope = zc + hh;
    switch (pal.extra) {
      case 'pelo':
        P.push({ r: 0, f: -0.3, z: tope - 2.2, w: hw + 0.6, d: hd + 0.4, h: 3, c: pal.pelo });
        P.push({ r: 0, f: -hd / 2 + 1.2, z: zc + 3, w: hw + 0.6, d: 2.8, h: hh - 4.6, c: pal.pelo });
        break;
      case 'zombi':
        P.push({ r: 0, f: -0.4, z: tope - 2.2, w: hw + 0.5, d: hd + 0.3, h: 3, c: pal.pelo });
        P.push({ r: 0, f: -hd / 2 + 1.1, z: zc + 4, w: hw + 0.5, d: 2.6, h: hh - 5.8, c: pal.pelo });
        P.push({ r: 3, f: 1.5, z: tope + 0.8, w: 4.4, d: 4.2, h: 1.4, c: pal.pelo });
        break;
      case 'casco':
        P.push({ r: 0, f: 0, z: tope - 3.2, w: hw + 1.8, d: hd + 1.8, h: 4.8, c: pal.pelo, deco: { frente: [[0, 0, 1, 0.24, rgbOscuro(pal.pelo)]] } });
        break;
      case 'gorro':
        P.push({ r: 0, f: 0, z: tope - 1.6, w: hw + 0.6, d: hd + 0.6, h: 3.6, c: '#eef4f4', deco: { arriba: [[0.42, 0.25, 0.58, 0.75, '#d33', 1], [0.25, 0.42, 0.75, 0.58, '#d33', 1]] } });
        P.push({ r: 0, f: -hd / 2 + 1.4, z: zc + 4, w: hw + 0.6, d: 3, h: hh - 6, c: pal.pelo });
        break;
      case 'mascara':
        // la cinta roja va pintada en la cara y en la nuca, con sus dos puntas
        cabeza = { r: 0, f: 0, z: zc, w: hw, d: hd, h: hh, c: pal.pelo, deco: {
          frente: [[0, 0.72, 1, 0.84, '#c0392b'], [0, 0.36, 1, 0.64, pal.piel], [0.2, 0.43, 0.37, 0.57, '#111'], [0.63, 0.43, 0.8, 0.57, '#111']],
          atras: [[0, 0.72, 1, 0.84, '#c0392b']], der: [[0, 0.72, 1, 0.84, '#c0392b']], izq: [[0, 0.72, 1, 0.84, '#c0392b']] } };
        P.push({ r: 1.5, f: -hd / 2 - 1.6, z: tope - 4.6, w: 2, d: 3.2, h: 1.6, c: '#c0392b' });
        P.push({ r: -1.5, f: -hd / 2 - 2.2, z: tope - 5.6, w: 2, d: 3.2, h: 1.6, c: '#c0392b' });
        break;
      case 'gorra':
        P.push({ r: 0, f: 0, z: tope - 3.2, w: hw + 0.8, d: hd + 0.8, h: 4.8, c: pal.pelo, deco: { frente: [[0.42, 0.3, 0.58, 0.75, '#f1c40f', 1]] } });
        P.push({ r: 0, f: hd / 2 + 2.4, z: tope - 3.2, w: hw - 1.6, d: 5, h: 1.2, c: pal.pelo });
        break;
      case 'nariz':
        for (const l of [-1, 1]) P.push({ r: l * (hw / 2 + 1.4), f: -0.5, z: zc + 5, w: 3.6, d: 9, h: 6.5, c: pal.pelo });
        P.push({ r: 0, f: hd / 2 + 1.2, z: zc + 4.5, w: 3.2, d: 2.4, h: 3.2, c: '#e52020', luz: 1 });
        break;
      case 'antena':
        cabeza.deco.frente = [[0.12, 0.42, 0.88, 0.62, '#44ffff', 1], [0.3, 0.14, 0.7, 0.22, '#556']];
        P.push({ r: 0, f: 0, z: tope, w: 1.2, d: 1.2, h: 6, c: '#555' });
        P.push({ r: 0, f: 0, z: tope + 6, w: 3.2, d: 3.2, h: 3.2, c: pal.pelo, luz: 1 });
        break;
      case 'cuernos':
        P.push({ r: 0, f: -0.3, z: tope - 3, w: hw + 0.6, d: hd + 0.4, h: 3.8, c: pal.pelo });
        for (const l of [-1, 1]) {
          P.push({ r: l * 4.6 * cab, f: 1, z: tope + 0.6, w: 2.8, d: 2.8, h: 4, c: '#f2e6c8' });
          P.push({ r: l * 5.4 * cab, f: 1, z: tope + 4.6, w: 1.6, d: 1.6, h: 2.6, c: '#f2e6c8' });
        }
        break;
      case 'careta':
        cabeza.deco.frente = [[0.08, 0.08, 0.92, 0.92, '#f4f1ea'], [0.2, 0.44, 0.38, 0.6, '#300', 0], [0.62, 0.44, 0.8, 0.6, '#300', 0], [0.2, 0.47, 0.34, 0.57, '#ff2020', 1], [0.66, 0.47, 0.8, 0.57, '#ff2020', 1], [0.42, 0.16, 0.46, 0.3, '#300'], [0.54, 0.16, 0.58, 0.3, '#300']];
        P.push({ r: 0, f: -0.4, z: tope - 3, w: hw + 0.6, d: hd + 0.4, h: 3.6, c: pal.pelo });
        break;
      case 'capucha':
        P.push({ r: 0, f: -1.4, z: zc - 1, w: hw + 3, d: hd + 1.6, h: hh + 4, c: pal.pelo, capa: -0.5 });
        break;
      case 'sombrero':
        P.push({ r: 0, f: 0, z: tope - 1, w: hw + 9, d: hd + 9, h: 1.6, c: pal.pelo });
        P.push({ r: 0, f: -0.5, z: tope + 0.6, w: hw - 2, d: hd - 2, h: 5, c: pal.pelo, deco: { frente: [[0, 0, 1, 0.3, '#c0a030', 1]] } });
        P.push({ r: 0, f: -1.5, z: tope + 5.6, w: hw - 6, d: hd - 6, h: 4, c: pal.pelo });
        P.push({ r: 0, f: -3, z: tope + 9.6, w: 3, d: 3, h: 3, c: pal.pelo });
        break;
      case 'corona':
        P.push({ r: 0, f: 0, z: tope - 1, w: hw + 1, d: hd + 1, h: 3, c: '#f2c33a', deco: { frente: [[0.42, 0.3, 0.58, 0.8, '#e2263a', 1]] } });
        for (const [r, f] of [[-5, -4.6], [5, -4.6], [-5, 4.6], [5, 4.6], [0, 4.6], [0, -4.6]]) P.push({ r, f, z: tope + 2, w: 2.4, d: 2.4, h: 3, c: '#f2c33a' });
        break;
    }
    P.push(cabeza);
    // la mano del diablo con su bola, antes de lanzarla
    let mano = null;
    if (pal.fuegoMano && atk > 0) {
      P.push({ r: 9.6 * an, f: 5 * atk, z: zt + 1 + atk * 5 - 3.4, w: 3.6, d: 3.6, h: 3.6, c: pal.fuegoMano === 'morado' ? '#d68aff' : '#ffc040', luz: 1 });
      mano = proyecta(x, y, ang, 9.6 * an, 5 * atk, zt + atk * 5 - 1.6, s, cae);
    }
    modelo(c, x, y, ang, P, { talla: s, cae, flash: op.flash, linea: op.linea });
    if (mano) brilla(c, sprites()[pal.fuegoMano] || sprites().fuego, mano[0], mano[1], 9 * s, 0.9);
    if (pal.bomba && op.brillo > 0.05 && !op.flash) {
      const q = proyecta(x, y, ang, 0, 6.1 * gr, zt + 5.2, s, cae);
      brilla(c, sprites().brillo, q[0], q[1], (6 + op.brillo * 6) * s, 0.35 + 0.5 * op.brillo);
    }
    if (op.arma >= 0 && pal.brazos === 'arma') {
      const b = partesArma(op.arma).b;
      return proyecta(x, y, ang, b[0], b[1] - rec * 2.6, b[2] + rec * 0.8, s, cae);
    }
    return null;
  }
  const OSCUROS = new Map();
  function rgbOscuro(h) {
    let v = OSCUROS.get(h);
    if (!v) { const c = rgb(h); v = '#' + c.map(x => Math.round(x * 0.62).toString(16).padStart(2, '0')).join(''); OSCUROS.set(h, v); }
    return v;
  }

  // ---------- muros ----------
  /* Los colores de cada mapa: tapa, frente, faceta izquierda (iluminada),
     faceta derecha (en sombra), el pie del frente, y el contorno. */
  const BLANCO = { tapa: '#f6f6f3', frente: '#cfcfcb', fi: '#e2e2de', fd: '#a7a7a3', pie: '#b4b4b0', borde: 'rgba(36,36,40,.78)' };
  /* Los pilares son blancos en todos los mapas, como en el original, apenas
     teñidos según el lugar; las cajas sueltas, un gris más bajo. */
  const tinte = (t, f, d, i, p) => ({ tapa: t, frente: f, fi: i, fd: d, pie: p, borde: 'rgba(36,36,40,.78)' });
  const MUROS = {
    patio: BLANCO,
    sotano: tinte('#f5f1ea', '#cec7bb', '#a69e91', '#e2dbcf', '#b5ad9f'),
    cruce: tinte('#f1f2f4', '#c6c9cf', '#9ea2aa', '#dcdfe4', '#adb1b8'),
    fortaleza: tinte('#f3f1e8', '#cbc7b6', '#a29e8c', '#dfdbcc', '#b3ae9b'),
    laberinto: tinte('#f2f6f9', '#c4ced8', '#9ba7b4', '#dae2ea', '#abb6c2')
  };
  const CAJAS = tinte('#e9e8e4', '#bdbcb7', '#94938e', '#d3d2cd', '#a6a5a0');
  const muroDe = id => MUROS[id] || BLANCO;
  const cajaDe = () => CAJAS;
  /* Un bloque en (x, y) de lado `l`, alto `h`. `v` dice qué vecinos son del
     mismo bloque ({n, s, e, o}): entre ellos no hay chaflán ni contorno, así
     una fila de muros se ve como un solo bloque largo. */
  function bloque(c, x, y, l, h, v, col, ch) {
    const tl = !v.n && !v.o, tr = !v.n && !v.e, br = !v.s && !v.e, bl = !v.s && !v.o;
    const X0 = x, X1 = x + l, Y0 = y - h, Y1 = y + l - h;
    c.lineJoin = 'round';
    if (!v.s) {
      const xa = bl ? X0 + ch : X0, xb = br ? X1 - ch : X1, hp = h * 0.32;
      if (bl) poli(c, [X0, Y1 - ch, X0 + ch, Y1, X0 + ch, Y1 + h, X0, Y1 - ch + h], col.fi);
      poli(c, [xa, Y1, xb, Y1, xb, Y1 + h, xa, Y1 + h], col.frente);
      poli(c, [xa, Y1 + h - hp, xb, Y1 + h - hp, xb, Y1 + h, xa, Y1 + h], col.pie);
      if (br) poli(c, [X1 - ch, Y1, X1, Y1 - ch, X1, Y1 - ch + h, X1 - ch, Y1 + h], col.fd);
      c.strokeStyle = col.borde; c.lineWidth = 1;
      c.beginPath();
      if (bl) { c.moveTo(X0, Y1 - ch); c.lineTo(X0, Y1 - ch + h); c.lineTo(X0 + ch, Y1 + h); c.moveTo(X0 + ch, Y1); c.lineTo(X0 + ch, Y1 + h); }
      else { c.moveTo(X0, Y1 + h); }
      c.moveTo(xa, Y1 + h); c.lineTo(xb, Y1 + h);
      if (br) { c.lineTo(X1, Y1 - ch + h); c.lineTo(X1, Y1 - ch); c.moveTo(X1 - ch, Y1); c.lineTo(X1 - ch, Y1 + h); }
      if (!bl && !v.o) { c.moveTo(X0, Y1); c.lineTo(X0, Y1 + h); }
      if (!br && !v.e) { c.moveTo(X1, Y1); c.lineTo(X1, Y1 + h); }
      c.stroke();
    }
    // la tapa
    const pts = [];
    if (tl) pts.push(X0, Y0 + ch, X0 + ch, Y0); else pts.push(X0, Y0);
    if (tr) pts.push(X1 - ch, Y0, X1, Y0 + ch); else pts.push(X1, Y0);
    if (br) pts.push(X1, Y1 - ch, X1 - ch, Y1); else pts.push(X1, Y1);
    if (bl) pts.push(X0 + ch, Y1, X0, Y1 - ch); else pts.push(X0, Y1);
    poli(c, pts, col.tapa);
    // contorno de la tapa solo por donde da al aire
    c.strokeStyle = col.borde; c.lineWidth = 1;
    c.beginPath();
    const lado = (ax, ay, bx, by, si) => { if (si) { c.moveTo(ax, ay); c.lineTo(bx, by); } };
    lado(tl ? X0 + ch : X0, Y0, tr ? X1 - ch : X1, Y0, !v.n);
    lado(X1, tr ? Y0 + ch : Y0, X1, br ? Y1 - ch : Y1, !v.e);
    lado(br ? X1 - ch : X1, Y1, bl ? X0 + ch : X0, Y1, !v.s);
    lado(X0, bl ? Y1 - ch : Y1, X0, tl ? Y0 + ch : Y0, !v.o);
    lado(X0, Y0 + ch, X0 + ch, Y0, tl); lado(X1 - ch, Y0, X1, Y0 + ch, tr);
    lado(X1, Y1 - ch, X1 - ch, Y1, br); lado(X0 + ch, Y1, X0, Y1 - ch, bl);
    c.stroke();
    // un brillo fino en el borde de arriba
    if (!v.n) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo((tl ? X0 + ch : X0) + 1, Y0 + 1.5); c.lineTo((tr ? X1 - ch : X1) - 1, Y0 + 1.5); c.stroke(); }
  }
  function poli(c, p, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    c.closePath(); c.fill();
  }

  // ---------- el suelo que guarda todo ----------
  function semilla(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* El piso de cada mapa, claro como en el original, con su textura. */
  const TEMAS = {
    patio: { base: '#dcd7ca', motas: ['#cfc8b6', '#e8e4da', '#c4bca8'], losa: 2, junta: 'rgba(96,84,62,.18)', grieta: 'rgba(70,60,44,.28)', deco: 'patio' },
    sotano: { base: '#c4bfb5', motas: ['#b2ada2', '#d2cec6', '#a8a296'], losa: 3, junta: 'rgba(54,48,42,.22)', grieta: 'rgba(40,36,30,.3)', deco: 'sotano' },
    cruce: { base: '#9a9c9f', motas: ['#8a8c90', '#a8aaad', '#7e8084'], losa: 0, junta: 'rgba(40,40,44,.2)', grieta: 'rgba(30,30,34,.38)', deco: 'cruce' },
    fortaleza: { base: '#c7cf9f', motas: ['#b5c088', '#d6dcb2', '#a8b47a'], losa: 0, junta: 'rgba(70,80,40,.15)', grieta: 'rgba(80,70,40,.25)', deco: 'fortaleza' },
    laberinto: { base: '#d4dbe1', motas: ['#c6ced6', '#e2e7eb', '#b8c2cc'], losa: 1, junta: 'rgba(60,80,100,.24)', grieta: 'rgba(50,60,80,.25)', deco: 'laberinto' }
  };
  const tema = id => TEMAS[id] || TEMAS.patio;

  function crearSuelo(M) {
    const RS = 2, W = M.ancho * TS, H = M.alto * TS;
    const cv = document.createElement('canvas');
    cv.width = W * RS; cv.height = H * RS;
    const g = cv.getContext('2d');
    g.scale(RS, RS);
    const T = tema(M.id), rnd = semilla(M.ancho * 131 + M.alto * 7 + M.id.length * 977);
    const libre = (tx, ty) => tx >= 0 && ty >= 0 && tx < M.ancho && ty < M.alto && M.celdas[ty * M.ancho + tx] === 0;
    const sp = sprites();
    // base y manchas suaves de textura
    g.fillStyle = T.base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 900; i++) {
      const x = rnd() * W, y = rnd() * H, r = 10 + rnd() * 46;
      g.globalAlpha = 0.08 + rnd() * 0.12;
      g.fillStyle = T.motas[(rnd() * T.motas.length) | 0];
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // grano fino
    for (let i = 0; i < (W * H) / 40; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + (0.03 + rnd() * 0.07).toFixed(3) + ')' : 'rgba(255,255,255,' + (0.04 + rnd() * 0.08).toFixed(3) + ')';
      g.fillRect(rnd() * W, rnd() * H, 0.6 + rnd(), 0.6 + rnd());
    }
    // losas
    if (T.losa) {
      const L = TS * T.losa;
      g.strokeStyle = T.junta; g.lineWidth = 0.8;
      g.beginPath();
      for (let x = 0; x <= W; x += L) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += L) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.18)';
      g.beginPath();
      for (let x = 0; x <= W; x += L) { g.moveTo(x + 1.5, 0); g.lineTo(x + 1.5, H); }
      for (let y = 0; y <= H; y += L) { g.moveTo(0, y + 1.5); g.lineTo(W, y + 1.5); }
      g.stroke();
      for (let y = 0; y < H; y += L) for (let x = 0; x < W; x += L) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + (rnd() * 0.05).toFixed(3) + ')' : 'rgba(255,255,255,' + (rnd() * 0.06).toFixed(3) + ')';
        g.fillRect(x + 1, y + 1, L - 1, L - 1);
      }
    }
    // grietas
    const grieta = (x, y, n, l) => {
      g.strokeStyle = T.grieta; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y);
      let a = rnd() * Math.PI * 2;
      for (let i = 0; i < n; i++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); if (rnd() < 0.25) grieta(x, y, (n / 2) | 0, l * 0.7); }
      g.stroke();
    };
    for (let i = 0; i < (W * H) / 26000; i++) grieta(rnd() * W, rnd() * H, 5 + ((rnd() * 6) | 0), 3 + rnd() * 4);
    // lo propio de cada mapa
    decoraSuelo(g, M, T, rnd, libre, W, H, sp);
    // entradas de los enemigos: una boca oscura con franjas de peligro
    for (const s of M.spawnsE) {
      const x = s.tx * TS, y = s.ty * TS;
      const hor = s.tx === 0 || s.tx === M.ancho - 1;
      const gr = hor ? g.createLinearGradient(s.tx === 0 ? x : x + TS, 0, s.tx === 0 ? x + TS : x, 0) : g.createLinearGradient(0, s.ty === 0 ? y : y + TS, 0, s.ty === 0 ? y + TS : y);
      gr.addColorStop(0, 'rgba(12,10,10,.95)'); gr.addColorStop(0.7, 'rgba(30,26,24,.55)'); gr.addColorStop(1, 'rgba(40,36,30,0)');
      g.fillStyle = gr; g.fillRect(x, y, TS, TS);
      g.save(); g.beginPath();
      if (hor) g.rect(s.tx === 0 ? x + TS - 4 : x, y, 4, TS); else g.rect(x, s.ty === 0 ? y + TS - 4 : y, TS, 4);
      g.clip();
      for (let k = -TS; k < TS * 2; k += 6) { g.fillStyle = (k / 6) & 1 ? '#f2c40f' : '#222'; g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + 3, y); g.lineTo(x + k + 3 - TS, y + TS); g.lineTo(x + k - TS, y + TS); g.fill(); }
      g.restore();
    }

    // la capa de sombras (estática): muros proyectando hacia abajo a la derecha
    const sc = document.createElement('canvas');
    sc.width = W; sc.height = H;
    const s2 = sc.getContext('2d');
    try { s2.filter = 'blur(2.5px)'; } catch {}
    s2.fillStyle = '#000';
    for (let ty = 0; ty < M.alto; ty++) for (let tx = 0; tx < M.ancho; tx++) {
      const k = M.celdas[ty * M.ancho + tx];
      if (!k) continue;
      const h = k === 1 ? 28 : 15, x = tx * TS, y = ty * TS, dx = h * 0.55, dy = h * 0.42, i = k === 2 ? 4 : 0;
      s2.beginPath();
      s2.moveTo(x + TS - i, y + i); s2.lineTo(x + TS - i + dx, y + i + dy); s2.lineTo(x + TS - i + dx, y + TS - i + dy);
      s2.lineTo(x + i + dx, y + TS - i + dy); s2.lineTo(x + i, y + TS - i); s2.closePath(); s2.fill();
    }
    try { s2.filter = 'none'; } catch {}
    // oclusión al pie de cada muro
    for (let ty = 0; ty < M.alto; ty++) for (let tx = 0; tx < M.ancho; tx++) {
      if (M.celdas[ty * M.ancho + tx] !== 1 || !libre(tx, ty + 1)) continue;
      const y = ty * TS + TS, gr = s2.createLinearGradient(0, y, 0, y + 7);
      gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      s2.fillStyle = gr; s2.fillRect(tx * TS, y, TS, 7);
    }

    const sangreA = (t, a) => 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',' + a.toFixed(2) + ')';
    const oscura = (t, f) => [Math.round(t[0] * f), Math.round(t[1] * f), Math.round(t[2] * f)];
    const api = {
      cv, sombra: sc, RS,
      /* Una gota que llegó al suelo. */
      gota(x, y, r, t, ang, largo) {
        g.fillStyle = sangreA(Math.random() < 0.3 ? oscura(t, 0.7) : t, 0.55 + Math.random() * 0.35);
        g.beginPath();
        if (largo > 1.2) g.ellipse(x, y, r * largo, r, ang || 0, 0, Math.PI * 2); else g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      },
      /* Una salpicadura: un núcleo de gotas superpuestas y un abanico hacia
         donde iba el golpe. */
      salpica(x, y, ang, fuerza, t) {
        const n = 4 + fuerza * 5;
        for (let i = 0; i < n; i++) {
          const d = Math.random() * 5 * fuerza, a = ang + (Math.random() - 0.5) * 1.6;
          g.fillStyle = sangreA(Math.random() < 0.35 ? oscura(t, 0.72) : t, 0.35 + Math.random() * 0.4);
          g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, (1.4 + Math.random() * 2.8) * (0.6 + fuerza * 0.35), 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 5 + fuerza * 8; i++) {
          const a = ang + (Math.random() - 0.5) * 1.1, d = 4 + Math.random() * 22 * fuerza, r = 0.5 + Math.random() * 1.4;
          api.gota(x + Math.cos(a) * d, y + Math.sin(a) * d, r, t, a, 1 + d / 14);
        }
      },
      /* El charco de un cuerpo: manchas grandes, un centro oscuro y bordes
         irregulares. */
      charco(x, y, r, t) {
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.75;
          g.fillStyle = sangreA(i < 4 ? oscura(t, 0.62) : t, 0.38 + Math.random() * 0.34);
          g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * (0.25 + Math.random() * 0.35), r * (0.2 + Math.random() * 0.3), Math.random() * 3, 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2, d = r * (0.8 + Math.random() * 0.8);
          api.gota(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + Math.random() * 1.3, t, a, 1 + Math.random());
        }
      },
      /* La quemadura de una explosión: un centro tiznado, lenguas negras que
         salen como una estrella, hollín y una corona de ceniza clara. */
      quemadura(x, y, r) {
        const R = r * 0.8;
        let gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, 'rgba(14,11,9,.82)'); gr.addColorStop(0.35, 'rgba(24,19,15,.62)'); gr.addColorStop(0.75, 'rgba(40,32,24,.22)'); gr.addColorStop(1, 'rgba(50,40,30,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
        const n = 16 + ((r / 6) | 0);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4, l = R * (0.55 + Math.random() * 0.75), w = 0.08 + Math.random() * 0.1;
          g.fillStyle = 'rgba(16,12,10,' + (0.25 + Math.random() * 0.3).toFixed(2) + ')';
          g.beginPath();
          g.moveTo(x + Math.cos(a - w) * R * 0.25, y + Math.sin(a - w) * R * 0.25);
          g.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
          g.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6, x + Math.cos(a + w) * R * 0.25, y + Math.sin(a + w) * R * 0.25);
          g.fill();
        }
        for (let i = 0; i < 50; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 1.25;
          g.fillStyle = Math.random() < 0.75 ? 'rgba(20,16,12,' + (0.2 + Math.random() * 0.4).toFixed(2) + ')' : 'rgba(150,140,128,' + (0.2 + Math.random() * 0.3).toFixed(2) + ')';
          g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.8 + Math.random() * 1.6, 0.8 + Math.random() * 1.6);
        }
        gr = g.createRadialGradient(x, y, 0, x, y, R * 0.3);
        gr.addColorStop(0, 'rgba(60,46,36,.5)'); gr.addColorStop(1, 'rgba(60,46,36,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 0.3, 0, Math.PI * 2); g.fill();
      },
      /* Lo visible del suelo y de su sombra, en coordenadas del mundo. */
      dibuja(c, x0, y0, x1, y1) {
        x0 = clamp(x0, 0, W); x1 = clamp(x1, 0, W); y0 = clamp(y0, 0, H); y1 = clamp(y1, 0, H);
        if (x1 <= x0 || y1 <= y0) return;
        c.drawImage(cv, x0 * RS, y0 * RS, (x1 - x0) * RS, (y1 - y0) * RS, x0, y0, x1 - x0, y1 - y0);
        c.globalAlpha = 0.26;
        c.drawImage(sc, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
        c.globalAlpha = 1;
      }
    };
    return api;
  }

  /* Lo que hace reconocible a cada mapa, pintado en el piso una sola vez. */
  function decoraSuelo(g, M, T, rnd, libre, W, H, sp) {
    const celdasLibres = [];
    for (let ty = 1; ty < M.alto - 1; ty++) for (let tx = 1; tx < M.ancho - 1; tx++) if (libre(tx, ty)) celdasLibres.push([tx, ty]);
    const algun = () => celdasLibres[(rnd() * celdasLibres.length) | 0];
    const tapa = (x, y, r) => {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x + 1, y + 1, r + 1, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6d6a64'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a4844'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r - 1.5, 0, Math.PI * 2); g.stroke();
      g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(x - r + 3, y + i * 2.4); g.lineTo(x + r - 3, y + i * 2.4); } g.stroke();
    };
    const rejilla = (x, y) => {
      g.fillStyle = '#3d3b38'; g.fillRect(x - 6, y - 4, 12, 8);
      g.fillStyle = '#1e1d1b'; for (let i = 0; i < 5; i++) g.fillRect(x - 5 + i * 2.2, y - 3, 1.2, 6);
    };
    const charcoAceite = (x, y, r) => {
      g.fillStyle = 'rgba(30,28,26,.22)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r * 0.6, r * (0.4 + rnd() * 0.4), r * (0.3 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 2); g.fill(); }
    };
    if (T.deco === 'patio') {
      for (let i = 0; i < 3; i++) { const [tx, ty] = algun(); tapa(tx * TS + 16, ty * TS + 16, 8); }
      // hojas secas
      for (let i = 0; i < 120; i++) {
        const [tx, ty] = algun(), x = tx * TS + rnd() * TS, y = ty * TS + rnd() * TS;
        g.fillStyle = ['#b08a4a', '#9a6a32', '#c2a060', '#7a8a3a'][(rnd() * 4) | 0];
        g.save(); g.translate(x, y); g.rotate(rnd() * 6.3); g.beginPath(); g.ellipse(0, 0, 2.2, 1.1, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
    } else if (T.deco === 'sotano') {
      for (let i = 0; i < 6; i++) { const [tx, ty] = algun(); charcoAceite(tx * TS + 16, ty * TS + 16, 14 + rnd() * 10); }
      for (let i = 0; i < 4; i++) { const [tx, ty] = algun(); rejilla(tx * TS + 16, ty * TS + 16); }
      // líneas amarillas pintadas alrededor de las tiendas
      for (const t of M.tiendas) {
        g.strokeStyle = 'rgba(226,185,59,.75)'; g.lineWidth = 2; g.setLineDash([6, 4]);
        g.strokeRect(t.x - 30, t.y - 26, 60, 48); g.setLineDash([]);
      }
    } else if (T.deco === 'cruce') {
      // asfalto: líneas de pista por los dos ejes del mapa y un paso de cebra
      const my = Math.floor(M.alto / 2) * TS, mx = Math.floor(M.ancho / 2) * TS;
      g.fillStyle = 'rgba(245,240,220,.8)';
      for (let x = 0; x < W; x += 22) if (libre(Math.floor(x / TS), Math.floor(my / TS) - 1) && libre(Math.floor(x / TS), Math.floor(my / TS))) g.fillRect(x, my - 1, 12, 2);
      for (let y = 0; y < H; y += 22) if (libre(Math.floor(mx / TS) - 1, Math.floor(y / TS)) && libre(Math.floor(mx / TS), Math.floor(y / TS))) g.fillRect(mx - 1, y, 2, 12);
      for (let i = -3; i <= 3; i++) {
        const x = mx + i * 9 - 3;
        for (const yy of [my - TS * 2.6, my + TS * 1.8]) if (libre(Math.floor(x / TS), Math.floor(yy / TS))) g.fillRect(x, yy, 5, TS * 0.8);
      }
      g.fillStyle = 'rgba(245,200,40,.75)';
      for (let x = 0; x < W; x += TS) for (const yy of [my - TS * 1.5, my + TS * 1.5 - 2]) if (libre(Math.floor(x / TS), Math.floor(yy / TS))) g.fillRect(x, yy, TS, 1.6);
      for (let i = 0; i < 4; i++) { const [tx, ty] = algun(); tapa(tx * TS + 16, ty * TS + 16, 8); }
      for (let i = 0; i < 5; i++) { const [tx, ty] = algun(); charcoAceite(tx * TS + 16, ty * TS + 16, 12); }
    } else if (T.deco === 'fortaleza') {
      // pasto: matas y caminos de tierra hacia el centro
      for (let i = 0; i < 26; i++) {
        const [tx, ty] = algun();
        g.fillStyle = 'rgba(150,120,70,' + (0.18 + rnd() * 0.2).toFixed(2) + ')';
        g.beginPath(); g.ellipse(tx * TS + 16, ty * TS + 16, 18 + rnd() * 20, 10 + rnd() * 12, rnd() * 3, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 900; i++) {
        const [tx, ty] = algun(), x = tx * TS + rnd() * TS, y = ty * TS + rnd() * TS;
        g.strokeStyle = rnd() < 0.5 ? 'rgba(90,120,40,.45)' : 'rgba(200,215,140,.5)'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y - 2 - rnd() * 2.5); g.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const [tx, ty] = algun(), x = tx * TS + rnd() * TS, y = ty * TS + rnd() * TS;
        g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(x + 1, y + 1.5, 3.4, 2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#9a968a'; g.beginPath(); g.ellipse(x, y, 3.2, 2.2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c0bcb0'; g.beginPath(); g.ellipse(x - 0.8, y - 0.6, 1.6, 1, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (T.deco === 'laberinto') {
      // laboratorio: baldosas con una franja de peligro y desagües
      for (let i = 0; i < 5; i++) { const [tx, ty] = algun(); rejilla(tx * TS + 16, ty * TS + 16); }
      for (let i = 0; i < 6; i++) {
        const [tx, ty] = algun();
        g.fillStyle = 'rgba(80,140,200,.12)'; g.beginPath(); g.ellipse(tx * TS + 16, ty * TS + 16, 14, 9, rnd() * 3, 0, Math.PI * 2); g.fill();
      }
    }
    void sp;
  }

  // ---------- efectos ----------
  function crearEfectos() {
    const sp = sprites();
    let suelo = null;
    let P = [];            // partículas con altura
    let F = [];            // fogonazos y luces
    let A = [];            // anillos de onda en el suelo
    let C = [];            // cadáveres
    const TRAZ = [];
    const cap = (l, n) => { if (l.length > n) l.splice(0, l.length - n); };

    function particula(o) { P.push(o); if (P.length > 900) P.splice(0, P.length - 900); return o; }

    const api = {
      ponSuelo(s) { suelo = s; P = []; F = []; A = []; C = []; TRAZ.length = 0; },
      get suelo() { return suelo; },
      cadaveres: () => C,
      /* Sangre que sale disparada hacia `ang`: gotas que caen y manchan. */
      sangre(x, y, ang, n, t, z = 16) {
        t = t || SANGRE[0];
        for (let i = 0; i < n; i++) {
          const a = ang + (Math.random() - 0.5) * 1.3, v = 30 + Math.random() * 130;
          particula({ k: 'gota', x, y, z: z + Math.random() * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 20 + Math.random() * 90, t: 2, t0: 2, s: 0.7 + Math.random() * 1.2, col: t });
        }
        for (let i = 0; i < Math.min(4, n); i++) {
          const a = ang + (Math.random() - 0.5) * 0.8, v = 20 + Math.random() * 40;
          particula({ k: 'niebla', x, y, z: z + 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 0, t: 0.32, t0: 0.32, s: 5 + Math.random() * 4 });
        }
      },
      /* Trozos de un cuerpo que revienta, con los colores de su paleta. */
      trozos(x, y, pal, n, t) {
        const cols = [pal.camisa, pal.piel, pal.pantalon, pal.pelo, pal.panel || pal.camisa];
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 140;
          particula({ k: 'trozo', x, y, z: 8 + Math.random() * 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 80 + Math.random() * 160, t: 2.2 + Math.random(), t0: 3, s: 2.2 + Math.random() * 2.6, col: cols[i % cols.length], giro: Math.random() * 6, vg: (Math.random() - 0.5) * 20, sangre: t || SANGRE[0], rebota: 0 });
        }
        api.sangre(x, y, 0, 6, t, 14); api.sangre(x, y, Math.PI, 6, t, 14);
      },
      chispas(x, y, ang, n, z = 16, col) {
        for (let i = 0; i < n; i++) {
          const a = ang + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * 180;
          particula({ k: 'chispa', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: Math.random() * 90, t: 0.15 + Math.random() * 0.25, t0: 0.4, col: col || (Math.random() < 0.5 ? '#ffe9a0' : '#ffb040') });
        }
      },
      polvo(x, y, n, z = 6) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = 10 + Math.random() * 40;
          particula({ k: 'humoC', x, y, z: z + Math.random() * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 6 + Math.random() * 10, t: 0.5 + Math.random() * 0.4, t0: 0.9, s: 4 + Math.random() * 4, crece: 12 });
        }
      },
      humo(x, y, n, z = 14, color) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 22;
          particula({ k: color ? 'luz' : 'humoC', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 4 + Math.random() * 10, t: 0.35 + Math.random() * 0.3, t0: 0.65, s: 3 + Math.random() * 3, crece: 10, sp: color });
        }
      },
      casquillo(x, y, ang, rojo) {
        const a = ang + Math.PI / 2 + (Math.random() - 0.5) * 0.6, v = 40 + Math.random() * 40;
        particula({ k: 'casquillo', x: x + Math.cos(ang) * 6, y: y + Math.sin(ang) * 6, z: 17, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 50 + Math.random() * 40, t: 1.6, t0: 1.6, col: rojo ? '#b8281e' : '#d9a83a', giro: Math.random() * 6, vg: (Math.random() - 0.5) * 30, rebota: 0 });
      },
      /* El fogonazo en la boca del arma (pantalla), con su luz en el piso. */
      fogonazo(sx, sy, gx, gy, ang, w) {
        const g = w === 2 ? 1.7 : w === 6 ? 1.5 : w === 1 ? 0.85 : 1;
        F.push({ k: 'boca', x: sx, y: sy, ang, t: 0.06, t0: 0.06, s: g, giro: Math.random() * 6 });
        F.push({ k: 'luz', x: gx, y: gy, t: 0.08, t0: 0.08, r: 26 * g });
      },
      /* Una explosión: destello, bola de fuego, humo que sube y se queda,
         onda en el suelo, chispas, escombros y la quemadura para siempre. */
      boom(x, y, r) {
        if (suelo) suelo.quemadura(x, y, r);
        F.push({ k: 'luz', x, y, t: 0.3, t0: 0.3, r: r * 2.6 });
        F.push({ k: 'destello', x, y: y - 10, t: 0.09, t0: 0.09, r: r * 1.1 });
        A.push({ x, y, t: 0.28, t0: 0.28, r: r * 1.25 });
        const nf = 8 + ((r / 10) | 0);
        for (let i = 0; i < nf; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.35, v = 20 + Math.random() * 70;
          particula({ k: 'fuego', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, z: 6 + Math.random() * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 20 + Math.random() * 50, t: 0.3 + Math.random() * 0.3, t0: 0.6, s: r * (0.28 + Math.random() * 0.2), crece: r * 0.6 });
        }
        for (let i = 0; i < nf + 2; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.5, v = 8 + Math.random() * 30;
          particula({ k: 'humo', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, z: 8 + Math.random() * 16, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 12 + Math.random() * 22, t: 1.1 + Math.random() * 0.9, t0: 2, s: r * (0.25 + Math.random() * 0.15), crece: r * 0.7, retraso: 0.08 + Math.random() * 0.12 });
        }
        api.chispas(x, y, 0, 10 + ((r / 6) | 0), 10);
        api.chispas(x, y, Math.PI, 10 + ((r / 6) | 0), 10);
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 150;
          particula({ k: 'escombro', x, y, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 90 + Math.random() * 150, t: 1.2 + Math.random() * 0.6, t0: 1.8, s: 1.2 + Math.random() * 1.8, col: Math.random() < 0.5 ? '#3a3430' : '#6a625a', giro: Math.random() * 6, vg: (Math.random() - 0.5) * 24, rebota: 0 });
        }
      },
      /* Un trazo de bala desde la boca del arma, a la altura `z`. */
      trazo(x1, y1, x2, y2, z, gordo) { TRAZ.push({ x1, y1, x2, y2, z, t: 0.07, t0: 0.07, g: gordo ? 1.4 : 1 }); cap(TRAZ, 80); },
      /* Un cuerpo que cae: gira hacia atrás sobre los pies, rebota un poco,
         deja su charco y se hunde. `ang` es hacia donde lo empujó el golpe. */
      cadaver(x, y, k, ang, talla) {
        C.push({ x, y, k, ang: ang + Math.PI, vx: Math.cos(ang) * 70, vy: Math.sin(ang) * 70, t: 0, talla: talla || 1, charco: false, id: Math.random() * 10 });
        cap(C, 70);
      },
      paso(dt) {
        for (const p of P) {
          if (p.retraso > 0) { p.retraso -= dt; continue; }
          p.t -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.k === 'gota' || p.k === 'trozo' || p.k === 'chispa' || p.k === 'casquillo' || p.k === 'escombro') {
            p.vz -= 420 * dt; p.z += p.vz * dt;
            if (p.giro !== undefined) p.giro += p.vg * dt;
            if (p.z <= 0) {
              p.z = 0;
              if (p.k === 'gota') { if (suelo) suelo.gota(p.x, p.y, p.s, p.col, Math.atan2(p.vy, p.vx), 1 + Math.hypot(p.vx, p.vy) / 120); p.t = 0; }
              else if (p.k === 'chispa') p.t = 0;
              else {
                if (p.k === 'trozo' && !p.rebota && suelo) suelo.salpica(p.x, p.y, Math.atan2(p.vy, p.vx), 0.6, p.sangre);
                p.rebota++;
                p.vz = p.rebota < 3 ? -p.vz * 0.35 : 0; p.vx *= 0.5; p.vy *= 0.5; p.vg *= 0.5;
                if (p.rebota >= 3) { p.vx = 0; p.vy = 0; }
              }
            }
          } else {
            p.z += (p.vz || 0) * dt;
            const fr = Math.exp(-3 * dt); p.vx *= fr; p.vy *= fr;
            if (p.crece) p.s += p.crece * dt * (p.t / p.t0);
          }
        }
        P = P.filter(p => p.t > 0);
        for (const f of F) f.t -= dt;
        F = F.filter(f => f.t > 0);
        for (const a of A) a.t -= dt;
        A = A.filter(a => a.t > 0);
        for (const t of TRAZ) t.t -= dt;
        for (let i = TRAZ.length - 1; i >= 0; i--) if (TRAZ[i].t <= 0) TRAZ.splice(i, 1);
        for (const c of C) {
          c.t += dt;
          if (c.t < 0.3) { c.x += c.vx * dt; c.y += c.vy * dt; const fr = Math.exp(-6 * dt); c.vx *= fr; c.vy *= fr; }
          if (!c.charco && c.t > 0.34) {
            c.charco = true;
            if (suelo) {
              const t = sangreDe(c.k), d = 14 * c.talla;
              suelo.charco(c.x - Math.cos(c.ang) * d, c.y - Math.sin(c.ang) * d, 9 * c.talla, t);
            }
          }
        }
        C = C.filter(c => c.t < 2.6);
      },
      /* Los cadáveres, debajo de todo lo que está de pie. */
      dibujaCadaveres(c) {
        for (const q of C) {
          // cae con un rebote: llega a 90° a los 0.3 s, rebota y se asienta
          const u = q.t / 0.3;
          let ang = u < 1 ? (u * u) * (Math.PI / 2) : Math.PI / 2 - Math.sin(Math.min(1, (q.t - 0.3) / 0.25) * Math.PI) * 0.18;
          const alfa = q.t > 1.9 ? Math.max(0, 1 - (q.t - 1.9) / 0.7) : 1;
          if (alfa <= 0) continue;
          c.globalAlpha = alfa;
          humanoide(c, q.x, q.y, q.ang, PAL_E[q.k] || PAL_E[0], { t: q.id, cae: ang, talla: q.talla, linea: 0.6 });
          c.globalAlpha = 1;
        }
      },
      /* Lo de encima: humo, fuego, chispas, gotas, trozos, trazos, luces. */
      dibuja(c) {
        // anillos de onda y luces en el piso
        for (const a of A) {
          const f = 1 - a.t / a.t0;
          c.strokeStyle = 'rgba(255,240,210,' + (0.55 * (1 - f)).toFixed(2) + ')'; c.lineWidth = 3 * (1 - f) + 0.5;
          c.beginPath(); c.ellipse(a.x, a.y, a.r * f, a.r * f * 0.8, 0, 0, Math.PI * 2); c.stroke();
        }
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const f of F) if (f.k === 'luz') {
          c.globalAlpha = 0.55 * (f.t / f.t0);
          c.drawImage(sp.brillo, f.x - f.r, f.y - f.r * 0.8, f.r * 2, f.r * 1.6);
        }
        c.restore();
        // sombras de lo que vuela
        c.fillStyle = 'rgba(0,0,0,.25)';
        for (const p of P) if ((p.k === 'trozo' || p.k === 'escombro' || p.k === 'casquillo') && p.z > 1) { c.beginPath(); c.ellipse(p.x, p.y, p.s || 1.2, (p.s || 1.2) * 0.5, 0, 0, Math.PI * 2); c.fill(); }
        // casquillos, trozos y escombros
        for (const p of P) {
          if (p.retraso > 0) continue;
          const a = Math.min(1, p.t / 0.4);
          if (p.k === 'casquillo') {
            c.globalAlpha = a; c.save(); c.translate(p.x, p.y - p.z); c.rotate(p.giro);
            c.fillStyle = p.col; c.fillRect(-1.3, -0.6, 2.6, 1.2); c.restore();
          } else if (p.k === 'trozo' || p.k === 'escombro') {
            c.globalAlpha = a; c.save(); c.translate(p.x, p.y - p.z); c.rotate(p.giro);
            const s = p.s;
            c.fillStyle = tono(p.col, 0.65); c.fillRect(-s / 2, -s / 2 + s * 0.35, s, s * 0.6);
            c.fillStyle = tono(p.col, 1); c.fillRect(-s / 2, -s / 2, s, s * 0.45);
            c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 0.4; c.strokeRect(-s / 2, -s / 2, s, s * 0.95);
            if (p.k === 'trozo') { c.fillStyle = 'rgba(170,10,10,.85)'; c.fillRect(-s / 2, s * 0.1, s * 0.6, s * 0.35); }
            c.restore();
          } else if (p.k === 'gota') {
            c.globalAlpha = 1; c.fillStyle = 'rgb(' + p.col[0] + ',' + p.col[1] + ',' + p.col[2] + ')';
            c.fillRect(p.x - p.s / 2, p.y - p.z - p.s / 2, p.s, p.s * 1.3);
          }
        }
        c.globalAlpha = 1;
        // humo (normal), después fuego y chispas (sumando luz)
        for (const p of P) {
          if (p.retraso > 0) continue;
          if (p.k === 'humo' || p.k === 'humoC' || p.k === 'niebla') {
            const f = p.t / p.t0, img = p.k === 'humo' ? sp.humo : p.k === 'niebla' ? sp.niebla : sp.humoClaro;
            c.globalAlpha = p.k === 'humo' ? Math.min(1, f * 1.6) * 0.75 : f * 0.7;
            c.drawImage(img, p.x - p.s, p.y - p.z - p.s, p.s * 2, p.s * 2);
          }
        }
        c.globalAlpha = 1;
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const p of P) {
          if (p.k === 'fuego' || p.k === 'luz') {
            const f = p.t / p.t0;
            c.globalAlpha = Math.min(1, f * 1.8);
            const img = p.sp ? sp[p.sp] || sp.fuego : sp.fuego;
            c.drawImage(img, p.x - p.s, p.y - p.z - p.s, p.s * 2, p.s * 2);
          } else if (p.k === 'chispa') {
            c.globalAlpha = Math.min(1, p.t / 0.15);
            c.strokeStyle = p.col; c.lineWidth = 1;
            c.beginPath(); c.moveTo(p.x, p.y - p.z); c.lineTo(p.x - p.vx * 0.03, p.y - p.z - p.vy * 0.03 + p.vz * 0.03); c.stroke();
          }
        }
        // trazos de bala
        c.lineCap = 'round';
        for (const t of TRAZ) {
          const f = t.t / t.t0;
          c.globalAlpha = f * 0.45; c.strokeStyle = '#ffb040'; c.lineWidth = 3 * t.g;
          c.beginPath(); c.moveTo(t.x1, t.y1 - t.z); c.lineTo(t.x2, t.y2 - t.z); c.stroke();
          c.globalAlpha = f; c.strokeStyle = '#fff6d0'; c.lineWidth = 1.1 * t.g;
          const mx = t.x1 + (t.x2 - t.x1) * (1 - f) * 0.6, my = t.y1 + (t.y2 - t.y1) * (1 - f) * 0.6;
          c.beginPath(); c.moveTo(mx, my - t.z); c.lineTo(t.x2, t.y2 - t.z); c.stroke();
        }
        // fogonazos y destellos
        for (const f of F) {
          const q = f.t / f.t0;
          if (f.k === 'boca') {
            c.globalAlpha = 1;
            c.drawImage(sp.fuego, f.x - 9 * f.s, f.y - 9 * f.s, 18 * f.s, 18 * f.s);
            c.save(); c.translate(f.x, f.y); c.rotate(f.ang); c.scale(1, KY + 0.15);
            c.fillStyle = 'rgba(255,250,210,' + (0.9 * q + 0.1).toFixed(2) + ')';
            c.beginPath();
            const L = 13 * f.s, Wd = 4 * f.s;
            c.moveTo(0, -Wd); c.lineTo(L * 0.45, -Wd * 0.6); c.lineTo(L, 0); c.lineTo(L * 0.45, Wd * 0.6); c.lineTo(0, Wd);
            c.lineTo(L * 0.3, Wd * 1.8); c.lineTo(L * 0.25, 0); c.lineTo(L * 0.3, -Wd * 1.8); c.closePath(); c.fill();
            c.restore();
          } else if (f.k === 'destello') {
            c.globalAlpha = q;
            c.drawImage(sp.fuego, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
          }
        }
        c.restore();
        c.globalAlpha = 1;
      }
    };
    return api;
  }

  // ---------- cosas del mapa ----------
  /* Barril rojo: cilindro con aros, tapa y el rombo de peligro. */
  function barril(c, x, y, hp, T) {
    const r = 8.5, h = 18, sq = r * KY * 0.62;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 2, y + 1, r + 1, sq + 1, 0, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, '#d9503c'); g.addColorStop(0.3, '#c43a28'); g.addColorStop(0.75, '#8e1f14'); g.addColorStop(1, '#6a150c');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - r, y - h); c.lineTo(x - r, y); c.ellipse(x, y, r, sq, 0, Math.PI, 0, true); c.lineTo(x + r, y - h); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,6,4,.85)'; c.lineWidth = 0.8;
    for (const f of [0.22, 0.62]) { c.beginPath(); c.ellipse(x, y - h * (1 - f), r, sq, 0, 0, Math.PI); c.stroke(); }
    c.beginPath(); c.moveTo(x - r, y - h); c.lineTo(x - r, y); c.ellipse(x, y, r, sq, 0, Math.PI, 0, true); c.lineTo(x + r, y - h); c.stroke();
    c.fillStyle = '#e05a44'; c.beginPath(); c.ellipse(x, y - h, r, sq, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#7a1a10'; c.beginPath(); c.ellipse(x + 3, y - h - 0.5, 2, 1.1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f5d33b'; c.beginPath(); c.moveTo(x - 1, y - h * 0.62); c.lineTo(x + 2.5, y - h * 0.44); c.lineTo(x - 1, y - h * 0.26); c.lineTo(x - 4.5, y - h * 0.44); c.closePath(); c.fill();
    c.fillStyle = '#2a0804'; c.fillRect(x - 1.6, y - h * 0.5, 1.2, 2.4);
    if (hp < 0.6) { c.fillStyle = 'rgba(255,200,80,' + (0.4 + 0.4 * Math.sin(T * 18)).toFixed(2) + ')'; c.beginPath(); c.arc(x + 4, y - h - 2, 1.6, 0, Math.PI * 2); c.fill(); }
  }
  /* Muro falso: un bloquecito blanco de los del mapa, con grietas cuando
     está roto. */
  function muroFalso(c, x, y, pc) {
    bloque(c, x - TS / 2 + 1, y - TS / 2 + 1, TS - 2, 18, {}, BLANCO, 6);
    if (pc < 0.66) {
      c.strokeStyle = 'rgba(60,60,64,.8)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - 8, y - 30); c.lineTo(x - 2, y - 22); c.lineTo(x + 5, y - 27); c.lineTo(x + 9, y - 20);
      if (pc < 0.33) { c.moveTo(x - 2, y - 22); c.lineTo(x - 4, y - 14); c.moveTo(x + 4, y + 2); c.lineTo(x + 1, y - 4); c.lineTo(x + 6, y - 9); }
      c.stroke();
    }
  }
  /* Carga explosiva: un bloque de C4 con su luz que parpadea. */
  function carga(c, x, y, T) {
    modelo(c, x, y, 0.4, [
      { r: 0, f: 0, z: 0, w: 9, d: 6, h: 3.4, c: '#c9b48a', deco: { arriba: [[0.1, 0.2, 0.9, 0.42, '#3a4a5a'], [0.1, 0.58, 0.9, 0.8, '#3a4a5a']] } },
      { r: 2.6, f: 0, z: 3.4, w: 2, d: 2, h: 1.2, c: Math.floor(T * 3) % 2 ? '#ff2a2a' : '#5a0e0e', luz: 1 }
    ], {});
    if (Math.floor(T * 3) % 2) brilla(c, sprites().brillo, x + 2, y - 5, 6, 0.6);
  }
  /* Las cajas que sueltan los enemigos: munición, botiquín, armadura. Giran
     despacio y flotan. */
  function caja(c, x, y, k, T, id) {
    const z = 2 + Math.sin(T * 4 + id) * 1.5, a = T * 1.2 + id;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 1, 8, 3.4, 0, 0, Math.PI * 2); c.fill();
    let p;
    if (k === 1) p = [{ r: 0, f: 0, z, w: 11, d: 11, h: 9, c: '#f4f4f4', deco: { arriba: [[0.4, 0.15, 0.6, 0.85, '#d42020', 1], [0.15, 0.4, 0.85, 0.6, '#d42020', 1]], frente: [[0.4, 0.2, 0.6, 0.8, '#d42020']], der: [[0.4, 0.2, 0.6, 0.8, '#d42020']], izq: [[0.4, 0.2, 0.6, 0.8, '#d42020']], atras: [[0.4, 0.2, 0.6, 0.8, '#d42020']] } }];
    else if (k === 2) p = [{ r: 0, f: 0, z, w: 11, d: 11, h: 9, c: '#2d6fb8', deco: { arriba: [[0.3, 0.2, 0.7, 0.8, '#9fd0ff', 1]], frente: [[0.3, 0.25, 0.7, 0.75, '#9fd0ff']], der: [[0.3, 0.25, 0.7, 0.75, '#9fd0ff']], izq: [[0.3, 0.25, 0.7, 0.75, '#9fd0ff']], atras: [[0.3, 0.25, 0.7, 0.75, '#9fd0ff']] } }];
    else {
      const fr = [[0, 0.4, 1, 0.6, '#d8c45a']];
      p = [{ r: 0, f: 0, z, w: 13, d: 9, h: 8, c: '#5d6b28', deco: { arriba: [[0.1, 0.42, 0.9, 0.58, '#d8c45a']], frente: fr, der: fr, izq: fr, atras: fr } }];
    }
    modelo(c, x, y, a, p, { linea: 0.6 });
  }
  /* La estación de suministros: mostrador con toldo a rayas y el «$». */
  function puesto(c, x, y, T, cerca) {
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 3, y + 4, 16, 6, 0, 0, Math.PI * 2); c.fill();
    modelo(c, x, y, Math.PI / 2, [
      { r: 0, f: 0, z: 0, w: 24, d: 12, h: 12, c: '#6b4a26', deco: { frente: [[0, 0.75, 1, 0.9, '#8b6234'], [0.1, 0.1, 0.9, 0.6, '#57391b']] } },
      { r: 0, f: 0, z: 12, w: 26, d: 13, h: 2, c: '#a07440' },
      { r: -11, f: -4, z: 14, w: 2, d: 2, h: 14, c: '#4a3318' },
      { r: 11, f: -4, z: 14, w: 2, d: 2, h: 14, c: '#4a3318' },
      { r: 0, f: -1, z: 28, w: 28, d: 12, h: 2.6, c: '#e8e2d2', deco: { arriba: [[0, 0, 0.2, 1, '#d33b2c'], [0.4, 0, 0.6, 1, '#d33b2c'], [0.8, 0, 1, 1, '#d33b2c']], frente: [[0, 0, 0.2, 1, '#d33b2c'], [0.4, 0, 0.6, 1, '#d33b2c'], [0.8, 0, 1, 1, '#d33b2c']] } },
      { r: -5, f: 0, z: 14, w: 4, d: 4, h: 4, c: '#5d6b28' },
      { r: 4, f: 1, z: 14, w: 5, d: 4, h: 3, c: '#f4f4f4', deco: { arriba: [[0.4, 0.1, 0.6, 0.9, '#d42020', 1]] } }
    ], { linea: 0.6 });
    const b = 0.6 + 0.4 * Math.sin(T * 4);
    c.save();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = cerca ? 0.8 : 0.35 * b;
    c.drawImage(sprites().brillo, x - 12, y - 52, 24, 24);
    c.restore();
    c.font = 'bold 13px Trebuchet MS, sans-serif'; c.textAlign = 'center';
    c.fillStyle = '#000'; c.fillText('$', x + 0.8, y - 34.2 + Math.sin(T * 3) * 1.5);
    c.fillStyle = cerca ? '#ffe36a' : 'rgba(255,214,90,' + b.toFixed(2) + ')';
    c.fillText('$', x, y - 35 + Math.sin(T * 3) * 1.5);
  }
  /* La lápida de un jugador caído. */
  function tumba(c, x, y) {
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 2, y + 1, 10, 4, 0, 0, Math.PI * 2); c.fill();
    modelo(c, x, y, Math.PI / 2, [
      { r: 0, f: 0, z: 0, w: 14, d: 8, h: 2.4, c: '#7a7a76' },
      { r: 0, f: 0, z: 2.4, w: 11, d: 4, h: 15, c: '#a3a39e', deco: { frente: [[0.45, 0.35, 0.55, 0.85, '#55554f'], [0.25, 0.62, 0.75, 0.72, '#55554f']] } }
    ], {});
  }

  // ---------- proyectiles ----------
  /* Granada de piña: verde oliva con sus gajos, la palanca y la anilla. Gira
     en el aire; su sombra se achica cuanto más alto va. */
  function granada(c, x, y, z, giro) {
    const k = 1 / (1 + z / 40);
    c.fillStyle = 'rgba(0,0,0,' + (0.32 * k).toFixed(2) + ')'; c.beginPath(); c.ellipse(x, y, 4.4 * k, 2 * k, 0, 0, Math.PI * 2); c.fill();
    const gy = y - 6 - z;
    c.save(); c.translate(x, gy); c.rotate(giro); c.scale(1.3, 1.3);
    const g = c.createRadialGradient(-1.2, -1.4, 0.4, 0, 0, 4.2);
    g.addColorStop(0, '#9aae5a'); g.addColorStop(0.6, '#55662a'); g.addColorStop(1, '#2c3612');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 3.4, 4.2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(20,26,8,.8)'; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(-3.4, 0); c.lineTo(3.4, 0); c.moveTo(-2.8, -2.2); c.lineTo(2.8, -2.2); c.moveTo(-2.8, 2.2); c.lineTo(2.8, 2.2); c.moveTo(0, -4.2); c.lineTo(0, 4.2); c.stroke();
    c.fillStyle = '#8a8a7a'; c.fillRect(-1.3, -6, 2.6, 2);
    c.fillStyle = '#b4b4a4'; c.fillRect(1, -6.4, 1.2, 5.4);
    c.strokeStyle = '#c8c8b8'; c.lineWidth = 0.6; c.beginPath(); c.arc(-2.2, -6.4, 1.3, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  /* Cohete: cuerpo, punta roja, aletas y la llama de atrás. */
  function cohete(c, x, y, ang) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y, 6, 2, ang, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, y - 20); c.rotate(ang); c.scale(1, 0.85);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(sprites().fuego, -16, -6, 12, 12);
    c.restore();
    c.fillStyle = '#5a5f50'; c.beginPath(); c.moveTo(-8, -2.4); c.lineTo(-11, -4.4); c.lineTo(-9, 0); c.lineTo(-11, 4.4); c.lineTo(-8, 2.4); c.fill();
    const g = c.createLinearGradient(0, -2.4, 0, 2.4);
    g.addColorStop(0, '#f0f0e8'); g.addColorStop(0.5, '#c8c8be'); g.addColorStop(1, '#7a7a72');
    c.fillStyle = g; c.fillRect(-8, -2.4, 12, 4.8);
    c.fillStyle = '#d42a1e'; c.beginPath(); c.moveTo(4, -2.4); c.lineTo(8.5, 0); c.lineTo(4, 2.4); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 0.5; c.strokeRect(-8, -2.4, 12, 4.8);
    c.restore();
  }
  /* Bola de fuego (diablo) o de ácido (escupidor): núcleo, halo y estela. */
  function bola(c, x, y, vx, vy, acido, z = 16) {
    const sp = sprites(), img = acido ? sp.acido : sp.fuego;
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y, 4, 1.8, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    const l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l;
    for (let i = 3; i >= 1; i--) { c.globalAlpha = 0.25 * (4 - i) / 3; c.drawImage(img, x - ux * i * 5 - 6, y - z - uy * i * 5 * KY - 6, 12, 12); }
    c.globalAlpha = 1;
    c.drawImage(img, x - 9, y - z - 9, 18, 18);
    c.drawImage(sp.brillo, x - 14, y - 12, 28, 18);
    c.restore();
  }

  // ---------- iconos de armas (HUD) ----------
  function iconoArma(c, id, w, h) {
    c.clearRect(0, 0, w, h);
    c.save(); c.scale(w / 34, h / 20);
    c.lineJoin = 'round';
    const metal = (y0, y1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#d9dbe0'); g.addColorStop(0.5, '#8d9098'); g.addColorStop(1, '#4a4c52'); return g; };
    const forma = (pts, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 0.7; c.stroke(); };
    switch (id) {
      case 0: forma([7, 5, 26, 5, 26, 9.5, 15, 9.5, 13.5, 16, 9, 16, 10, 9.5, 7, 9.5], metal(5, 16)); c.fillStyle = '#111'; c.fillRect(17, 10, 1, 2.5); break;
      case 1: forma([4, 6, 27, 6, 27, 8, 30, 8, 30, 9.5, 27, 9.5, 27, 11, 19, 11, 18, 18, 14.5, 18, 15, 11, 11, 11, 10, 15, 7, 15, 7.5, 11, 4, 11], metal(6, 18)); break;
      case 2:
        forma([2, 9, 9, 7.5, 12, 7, 31, 7, 31, 9.5, 12, 10, 10, 13, 4, 14], metal(7, 14));
        forma([2, 9, 9, 7.5, 9.5, 12.5, 4, 14], '#7a4b25'); forma([17, 10, 24, 10, 24, 12.5, 17, 12.5], '#6b4223'); break;
      case 3: {
        const g = c.createLinearGradient(11, 0, 23, 0); g.addColorStop(0, '#e05a44'); g.addColorStop(1, '#7a1a10');
        forma([11, 4, 23, 4, 23, 17, 11, 17], g); c.fillStyle = '#5a1209'; c.fillRect(11, 8, 12, 1.2); c.fillRect(11, 13, 12, 1.2);
        c.fillStyle = '#f5d33b'; c.beginPath(); c.moveTo(17, 9.5); c.lineTo(19, 11); c.lineTo(17, 12.5); c.lineTo(15, 11); c.fill(); break;
      }
      case 4: {
        const g = c.createRadialGradient(15.5, 9, 0.5, 17, 11.5, 6.5); g.addColorStop(0, '#a8bc6a'); g.addColorStop(1, '#3a4618');
        c.fillStyle = g; c.beginPath(); c.ellipse(17, 12, 5.2, 6, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 0.7; c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.moveTo(12, 12); c.lineTo(22, 12); c.moveTo(17, 6); c.lineTo(17, 18); c.stroke();
        forma([15.5, 3.5, 18.5, 3.5, 18.5, 6.4, 15.5, 6.4], '#9a9a8a'); forma([18.5, 4, 21.5, 5, 21, 12, 19.5, 12], '#c8c8b8'); break;
      }
      case 5: forma([6, 7, 28, 7, 28, 17, 6, 17], '#cfcfcb'); forma([6, 4, 28, 4, 28, 7, 6, 7], '#f6f6f3'); c.strokeStyle = '#8a8a86'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(6, 12); c.lineTo(28, 12); c.moveTo(17, 7); c.lineTo(17, 12); c.stroke(); break;
      case 6:
        forma([2, 7, 27, 7, 27, 12, 2, 12], '#5d6b48'); forma([27, 6, 31, 6, 31, 13, 27, 13], '#2a2f22'); forma([1, 6.5, 4, 6.5, 4, 12.5, 1, 12.5], '#2a2f22');
        forma([11, 12, 14, 12, 14, 16.5, 11, 16.5], '#222'); forma([13, 4.5, 17, 4.5, 17, 7, 13, 7], '#222'); break;
      case 7: forma([8, 7, 26, 7, 26, 16, 8, 16], '#c9b48a'); c.fillStyle = '#3a4a5a'; c.fillRect(9.5, 9, 15, 2); c.fillRect(9.5, 12.5, 15, 2); c.fillStyle = '#ff2a2a'; c.fillRect(15, 4.5, 4, 2.5); break;
    }
    c.restore();
  }

  raiz.BoxheadGrafico = {
    KY, TS, PAL_E, SANGRE, sangreDe, palJugador, tono, rgba, sprites, modelo, proyecta, humanoide, boca, partesArma,
    BLANCO, muroDe, cajaDe, bloque, crearSuelo, crearEfectos, barril, muroFalso, carga, caja, puesto, tumba, granada, cohete, bola, iconoArma, brilla
  };
})(typeof self !== 'undefined' ? self : this);
