// La armada del archipiélago (Fase 9 «c», pk-29). Solo corre en el mar: cómo pelea cada barco y cada enemigo del
// mar en la batalla en vivo (batalla.js, con sus ganchos B.ext), los jefes (la Reina Pirata Malvarosa, el
// Lamento y el Kraken de la Bruma), el viento, las tormentas, los asaltos piratas al puerto (con las baterías
// y la cadena), la flota que navega en el mapa y los dibujos de todo eso. Las tablas (D.ARMY_MAR, D.ENEMY_MAR,
// D.MISSIONS_MAR, D.JEFES_MAR) están en datos-mar.js.
// Regla de la batalla: nada de lo que se dibuja cambia un número; el viento es parejo (a favor o en contra,
// sembrado por la expedición), así que en promedio la «fuerza contra» del planificador sigue siendo la que pelea.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const Ar = (PK.Armada = {});
  const B = PK.Batalla;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const enMar = () => D.temaActivo === 'mar';

  // ---------- Cómo pelea cada barco ----------
  // barco: se dibuja en el agua (espuma, se hunde al caer). chico: los tiburones le pegan más (hunde).
  // rompe: sus tiros no rebotan en el caparazón de los cangrejos. explota: el brulote. frena: el arpón.
  Object.assign(B.TROPA, {
    balandra: { hp: 0.85, dps: 1, alcance: 4, vel: 2.6, fila: 5.6, dispara: 'bala', flanco: true, barco: true, chico: true },
    infanteria: { hp: 1.15, dps: 1, alcance: 0.9, vel: 2, fila: 6.8, herr: 'sword', barco: true, chico: true },
    arponero: { hp: 0.9, dps: 1, alcance: 5.5, vel: 1.6, fila: 4, dispara: 'arpon', frena: 1.4, rompe: true, barco: true, chico: true },
    fragata: { hp: 1, dps: 1, alcance: 6.5, vel: 1.4, fila: 3.6, dispara: 'bala', cd: 1.8, rompe: true, area: 0.5, barco: true },
    brulote: { hp: 0.8, dps: 1, alcance: 0.9, vel: 2.3, fila: 7.2, explota: 1.8, barco: true },
    galeon: { hp: 1.45, dps: 0.9, alcance: 6, vel: 0.9, fila: 2.4, dispara: 'bala', cd: 2.2, rompe: true, area: 0.9, barco: true, escala: 1.25 },
  });
  // la batería costera de un asalto pirata: fija en tu orilla, no es una tropa (no hay bajas de baterías)
  const BATERIA = { hp: 2, dps: 1, alcance: 9.5, vel: 0, fila: 1, dispara: 'bala', cd: 2, area: 0.8, fija: true, rompe: true, mar: true, spr: 'bateria', nombre: 'Batería costera' };

  // ---------- Los enemigos del mar ----------
  Object.assign(B.ENEMIGOS, {
    pirata: [
      { id: 'balandro', nombre: 'Balandro pirata', peso: 1, hp: 1, dps: 1, alcance: 4.5, vel: 2, dispara: 'bala', spr: 'balandro', barco: true },
      { id: 'abordador', nombre: 'Abordadores', peso: 0.7, hp: 1, dps: 1.05, alcance: 0.9, vel: 2.4, flanco: true, spr: 'abordador', barco: true },
    ],
    cangrejo: [{ id: 'cangrejo', nombre: 'Cangrejo gigante', peso: 1, hp: 1.3, dps: 0.9, alcance: 1, vel: 1.1, caparazon: true, spr: 'cangrejo', mar: true }],
    marino: [
      { id: 'tiburon', nombre: 'Tiburón', peso: 1, hp: 0.85, dps: 1.1, alcance: 0.9, vel: 3, flanco: true, hunde: 1.5, spr: 'tiburon', mar: true },
      { id: 'serpiente', nombre: 'Serpiente marina', peso: 0.5, hp: 1.8, dps: 1, alcance: 1.6, vel: 1.3, aplasta: 1.2, spr: 'serpiente', mar: true },
    ],
    fantasma: [
      { id: 'espectral', nombre: 'Barco espectral', peso: 0.6, hp: 1.2, dps: 0.95, alcance: 5, vel: 1.2, dispara: 'sombra', spr: 'espectral', barco: true },
      { id: 'ahogado', nombre: 'Ahogado', peso: 1, hp: 1, dps: 1, alcance: 0.9, vel: 1.4, spr: 'ahogado', mar: true },
    ],
  });
  const TENTACULO = { id: 'tentaculoK', nombre: 'Tentáculo del Kraken', peso: 1, hp: 1.4, dps: 0.9, alcance: 1.4, vel: 0.6, agarra: true, spr: 'tentaculoK', mar: true };
  Object.assign(B.JEFE, {
    malvarosa: { id: 'malvarosa', nombre: 'Reina Pirata Malvarosa', kind: 'pirata', hp: 1, dps: 0.75, alcance: 5, vel: 1.3, dispara: 'bala', spr: 'malvarosa', escala: 1.6, jefe: true, barco: true },
    lamento: { id: 'lamento', nombre: 'El Lamento', kind: 'fantasma', hp: 1.0, dps: 0.7, alcance: 5, vel: 1, dispara: 'sombra', spr: 'lamento', escala: 1.7, jefe: true, barco: true },
    kraken: { id: 'kraken', nombre: 'El Kraken de la Bruma', kind: 'marino', hp: 1.2, dps: 0.7, alcance: 2.4, vel: 0.35, aplasta: 1.6, spr: 'kraken', escala: 1.8, jefe: true, mar: true },
  });
  Object.assign(B.CONSEJO, {
    pirata: 'Piratas: sus abordadores van por tus cañones. Infantería de marina al frente y que las fragatas hagan el resto.',
    cangrejo: 'Cangrejos: las balas de las balandras rebotan en el caparazón. Arponeros y fragatas; «Mantener línea».',
    marino: 'Tiburones y serpientes: hunden barcos chicos. Galeones adelante y arponeros atrás; «Dispersarse» contra la serpiente.',
    fantasma: 'Barco fantasma: sus ahogados suben a bordo. Brulotes contra los barcos e infantería contra los ahogados.',
  });
  Object.assign(B.CONSEJO_JEFE, {
    malvarosa: 'Malvarosa manda abordadores contra tus cañones cada 14 s: infantería de marina adelante. Cuando grite «¡Andanada!», «Dispersarse».',
    lamento: 'El Lamento se mete en la bruma: mientras está adentro solo le entran los abordajes (infantería) y los brulotes. Que los brulotes vayan por su escolta y la infantería por él. Un Faro en tu isla acorta la bruma.',
    kraken: 'El Kraken agarra tus barcos con tentáculos: córtalos uno por uno y después «Al jefe». Mientras quede un tentáculo, el cuerpo casi no siente nada.',
  });

  // ---------- Al armar la batalla ----------
  B.ext.alArmar = function (b, r) {
    if (!enMar()) return;
    // el viento: parejo, sembrado por la expedición (lo mismo mirando o sin mirar)
    b.viento = U.rng(7717 + (r.id || 0) * 13)() < 0.5 ? 1 : -1;
    if (r.tormenta) for (const f of b.mios) f.max = f.hp = f.hp * D.TORMENTA.fuerza; // llegaron con las velas rotas
    if (r.baterias > 0) {
      const n = U.clamp(r.nBat || 1, 1, 4);
      for (let i = 0; i < n; i++) { const f = B.H.figura('p', 'bateria', BATERIA, r.baterias / n, 1, 1, 0); f.v = ((i + 0.5) / n) * (B.H.LV - 2) + 1; b.mios.push(f); }
    }
    const J = b.jefeF;
    if (!J) return;
    if (J.st.id === 'lamento') {
      const faro = G().countB('faromar') || G().countB('granfaro');
      b.brumaDur = faro ? 2.5 : 4;
      b.jefeMult = f => (b.bruma ? (f.st.explota || f.tipo === 'infanteria' ? 1 : 0.4) : 1);
    } else if (J.st.id === 'kraken') {
      // 4 tentáculos alrededor del cuerpo; su vida sale de la del Kraken (la fuerza total no cambia)
      J.max = J.hp = J.hp * 0.75;
      for (let i = 0; i < 4; i++) ponerTentaculo(b, J, i);
      b.jefeMult = () => (b.suyos.some(x => x.tentaculo && !x.muerto) ? 0.2 : 1);
    }
  };
  function ponerTentaculo(b, J, i) {
    const w = B.H.figura('e', 'tentaculoK', TENTACULO, J.pow * 0.13, 0, J.u - 2.2 - (i % 2) * 0.8, 0, 'marino');
    w.v = U.clamp(J.v + [-3, 3, -1.5, 1.5][i % 4], 1, B.H.LV - 1); w.tentaculo = true; w.parte = true;
    b.suyos.push(w);
    return w;
  }
  // ---------- Los jefes del mar ----------
  B.ext.jefePaso.malvarosa = function (b, J, t, mios, suyos, dt) {
    if (J.muerto) return;
    if (t.c <= 0) { // abordadores contra tus tiradores
      t.c = 16;
      for (let i = 0; i < 2; i++) { const w = B.H.figura('e', 'abordador', B.ENEMIGOS.pirata[1], J.pow * 0.05, 0, J.u - 0.8, 0, 'pirata'); w.v = U.clamp(J.v + (i ? 1.5 : -1.5), 1, B.H.LV - 1); b.suyos.push(w); }
      B.H.grito(b, '¡Al abordaje!'); B.H.fxJefe(b, 'aullido', J);
    }
    if (t.a <= 0) { // andanada: una fila de círculos donde están los tuyos
      t.a = 11;
      const o = mios[Math.floor(Math.random() * mios.length)];
      for (let k = -1; k <= 1; k++) b.peligros.push({ u: o.u + k * 0.4, v: U.clamp(o.v + k * 1.6, 0.5, B.H.LV - 0.5), r: 1.3, t: 2, dur: 2, dmg: J.pow * B.H.DPSK * 0.6, tipo: 'meteoro' });
      B.H.grito(b, '¡Andanada!');
    }
  };
  B.ext.jefePaso.lamento = function (b, J, t, mios, suyos, dt) {
    if (J.muerto) { b.bruma = false; return; }
    if (t.c <= 0) { b.bruma = !b.bruma; t.c = b.bruma ? b.brumaDur || 4 : 11; B.H.grito(b, b.bruma ? '¡El Lamento se mete en la bruma!' : 'El Lamento sale de la bruma.'); }
    if (t.a <= 0) { // sus ahogados suben a bordo de tus barcos de atrás
      t.a = 12;
      for (const o of mios.filter(f => f.st.dispara).slice(0, 2)) { const w = B.H.figura('e', 'ahogado', B.ENEMIGOS.fantasma[1], J.pow * 0.04, 0, o.u + 1, 0, 'fantasma'); w.v = o.v; b.suyos.push(w); }
      B.H.fxJefe(b, 'revive', J);
    }
  };
  B.ext.jefePaso.kraken = function (b, J, t, mios, suyos, dt) {
    if (J.muerto) return;
    if (t.c <= 0) { // le vuelve a crecer un tentáculo (como mucho 4)
      t.c = 15;
      const vivos = suyos.filter(f => f.tentaculo && !f.muerto).length;
      if (vivos < 4) { ponerTentaculo(b, J, vivos); B.H.grito(b, '¡Le crece otro tentáculo!'); }
    }
    if (t.a <= 0) { // golpe de tinta: los tuyos cerca del cuerpo se frenan
      t.a = 11;
      for (const f of mios) if (B.H.cerca(f, J) < 6) f.lento = Math.max(f.lento || 0, 2.5);
      B.H.grito(b, '¡Tinta!'); B.H.fxJefe(b, 'maldicion', J);
    }
  };

  // ---------- Dibujos ----------
  // Todo de perfil y mirando a la derecha (se espeja con flip). Dos cuadros: el casco sube y baja con las olas.
  const cache = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const espejo = c => { const m = mk(c.width, c.height), x = m.getContext('2d'); x.scale(-1, 1); x.drawImage(c, -c.width, 0); return m; };
  const css = c => (typeof c === 'string' ? c : 'rgb(' + c.join(',') + ')');
  const osc = (c, k) => c.map(v => Math.round(v * k));
  function pintor(x) { return (a, b2, w, h, col) => { x.fillStyle = css(col); x.fillRect(a, b2, w, h); }; }
  // un barco: L de largo, mástiles, velas del color dado, franja del reino, cañones y casco
  function barco(o, fr) {
    const L = o.L, H = o.H, c = mk(L + 4, H), x = c.getContext('2d'), r = pintor(x), y0 = H - 6 + (fr ? 1 : 0);
    const casco = o.casco || [118, 78, 44], borde = osc(casco, 0.65), cubierta = osc(casco, 1.25);
    // casco: más ancho arriba, con la proa (derecha) en punta y la popa alta
    for (let j = 0; j < 5; j++) { const ent = Math.round(j * 0.9); r(2 + ent, y0 + j, L - ent * 2 - 1, 1, j === 0 ? cubierta : j === 4 ? borde : casco); }
    r(L - 2, y0 - 2, 3, 2, casco); r(L + 1, y0 - 3, 2, 1, borde); // proa y bauprés
    r(2, y0 - 3, 5, 3, casco); r(2, y0 - 3, 5, 1, cubierta);      // castillo de popa
    if (o.franja) r(3, y0 + 1, L - 5, 1, o.franja);
    for (let k = 0; k < (o.canones || 0); k++) r(8 + k * Math.max(3, Math.floor((L - 14) / Math.max(1, o.canones))), y0 + 2, 2, 1, '#14141a');
    // mástiles y velas (la vela se infla: más ancha en el medio)
    const mast = o.mastiles || 1;
    for (let m = 0; m < mast; m++) {
      const mx = Math.round(L * (mast === 1 ? 0.5 : 0.3 + (m / (mast - 1)) * 0.4)), alto = H - 8 - (m === Math.floor(mast / 2) ? 0 : 3);
      r(mx, y0 - alto, 1, alto, '#3a2412');
      const vw = o.vela || 7, top = y0 - alto + 2, vh = alto - 5;
      for (let j = 0; j < vh; j++) { const inf = Math.round(Math.sin((j / vh) * Math.PI) * 2); r(mx - Math.floor(vw / 2) - inf, top + j, vw + inf * 2, 1, j % 5 === 4 ? osc(o.velas, 0.85) : o.velas); }
      if (o.calavera && m === Math.floor(mast / 2)) { const cy = top + Math.floor(vh / 2) - 1; r(mx - 1, cy, 3, 2, '#e8e0d0'); r(mx - 1, cy + 2, 1, 1, '#e8e0d0'); r(mx + 1, cy + 2, 1, 1, '#e8e0d0'); }
      if (m === mast - 1 && o.bandera) { r(mx + 1, y0 - alto - 1, 4, 2, o.bandera); }
    }
    if (o.fuego) for (let k = 0; k < 4; k++) { r(6 + k * 3, y0 - 4 - (k % 2), 2, 3, k % 2 ? '#f07a24' : '#e8501c'); r(6 + k * 3, y0 - 2, 2, 1, '#ffd060'); }
    if (o.barriles) for (let k = 0; k < 3; k++) { r(6 + k * 4, y0 - 3, 3, 3, '#7a4a24'); r(6 + k * 4, y0 - 2, 3, 1, '#3a3a40'); }
    return c;
  }
  // un bote con remeros (infantería de marina, arponeros, abordadores)
  function bote(o, fr) {
    const c = mk(20, 14), x = c.getContext('2d'), r = pintor(x), y0 = 9 + (fr ? 1 : 0);
    for (let k = 0; k < 3; k++) { const px = 4 + k * 5; r(px, y0 - 5, 3, 3, o.cabeza || '#e0b088'); r(px, y0 - 6, 3, 1, o.gorro); r(px - 1, y0 - 3, 5, 3, o.ropa); }
    if (o.arpon) { r(14, y0 - 9, 1, 7, '#7a5a34'); r(14, y0 - 10, 2, 1, '#e0e4ea'); }
    if (o.sable) { r(3, y0 - 8, 1, 4, '#d8dce4'); }
    for (let j = 0; j < 3; j++) { const ent = j; r(1 + ent, y0 + j, 17 - ent * 2, 1, j === 0 ? '#a8784a' : j === 2 ? '#5a3a1e' : '#8a5a32'); }
    r(17, y0 - 1, 2, 1, '#8a5a32');
    return c;
  }
  function cangrejo(fr) {
    const c = mk(22, 14), x = c.getContext('2d'), r = pintor(x), R = '#c84a2a', R2 = '#8a2a18', R3 = '#e87a50';
    const d = fr ? 1 : 0;
    for (let k = 0; k < 3; k++) { r(4 + k * 2 - d, 9 + k % 2, 1, 4, R2); r(15 - k * 2 + d, 9 + k % 2, 1, 4, R2); }
    r(5, 5, 12, 6, R); r(6, 4, 10, 1, R3); r(5, 10, 12, 1, R2); r(8, 6, 1, 1, R3); r(13, 6, 1, 1, R3);
    r(9, 2, 1, 2, R2); r(13, 2, 1, 2, R2); r(9, 1, 1, 1, '#101010'); r(13, 1, 1, 1, '#101010');
    r(17, 3 - d, 4, 3, R); r(19, 2 - d, 3, 2, R3); r(17, 6 - d, 2, 1, R2); // la pinza
    r(1, 4 + d, 4, 3, R); r(0, 3 + d, 3, 2, R3);
    r(0, 12, 22, 1, 'rgba(230,245,255,0.5)');
    return c;
  }
  function tiburon(fr) {
    const c = mk(24, 12), x = c.getContext('2d'), r = pintor(x), G1 = '#5a6a78', G2 = '#3a4652', V = '#c8d0d8';
    r(2, 7, 18, 3, 'rgba(40,60,80,0.55)'); // el cuerpo bajo el agua
    r(18, 7, 4, 2, 'rgba(40,60,80,0.55)');
    for (let j = 0; j < 6; j++) r(9 + j, 6 - j, 6 - j, 1, j ? G1 : G2); // la aleta
    r(9, 6, 7, 1, G2);
    r(3 - (fr ? 1 : 0), 6, 3, 1, G1); // cola
    r(0, 8, 24, 1, 'rgba(230,245,255,0.55)'); r(16, 7, 6, 1, V);
    return c;
  }
  function serpiente(fr) {
    const c = mk(28, 18), x = c.getContext('2d'), r = pintor(x), V1 = '#3a8a5a', V2 = '#24603c', V3 = '#7ac890';
    const ond = fr ? 1 : 0;
    for (const [cx, h] of [[5, 5], [12, 7]]) { for (let j = 0; j < h; j++) { const w = Math.round(Math.sin((j / h) * Math.PI) * 3) + 2; r(cx - w / 2, 14 - j + ond, w, 1, j % 2 ? V1 : V2); } }
    // cuello y cabeza
    for (let j = 0; j < 10; j++) r(19 + Math.round(Math.sin(j / 3) * 1), 14 - j - ond, 3, 1, j % 3 ? V1 : V2);
    r(19, 3 - ond, 7, 4, V1); r(19, 3 - ond, 7, 1, V3); r(24, 4 - ond, 1, 1, '#ffe060'); r(25, 6 - ond, 2, 1, '#e8e0d0');
    for (let k = 0; k < 3; k++) r(20 + k * 2, 2 - ond, 1, 1, '#e0605a'); // cresta
    r(0, 15, 28, 1, 'rgba(230,245,255,0.5)');
    return c;
  }
  function ahogado(fr) {
    const c = mk(10, 16), x = c.getContext('2d'), r = pintor(x), P = '#a8c0a8', P2 = '#6a8a72';
    r(3, 2 + (fr ? 1 : 0), 4, 4, P); r(3, 3, 1, 1, '#1a3a2a'); r(5, 3, 1, 1, '#1a3a2a');
    r(2, 6, 6, 6, P2); r(1, 7 - (fr ? 1 : 0), 1, 4, P); r(8, 7 + (fr ? 0 : 1), 1, 4, P);
    r(2, 1, 6, 1, '#3a5a3a'); r(0, 12, 10, 2, 'rgba(120,200,170,0.55)'); r(0, 13, 10, 1, 'rgba(230,245,255,0.5)');
    return c;
  }
  function kraken(fr) {
    const c = mk(30, 24), x = c.getContext('2d'), r = pintor(x), K = '#7a3a8a', K2 = '#4a1e5a', K3 = '#a860b8';
    const s = fr ? 1 : 0;
    for (let j = 0; j < 16; j++) { const w = Math.round(Math.sqrt(1 - Math.pow((j - 9) / 10, 2)) * 22); r(15 - w / 2, 3 + j + s, w, 1, j < 3 ? K3 : j > 12 ? K2 : K); }
    for (const ex of [9, 18]) { r(ex, 11 + s, 4, 4, '#ffe060'); r(ex + 1, 12 + s, 2, 2, '#1a0a10'); r(ex, 11 + s, 4, 1, '#c8a020'); }
    for (let k = 0; k < 5; k++) r(6 + k * 4, 6 + s + (k % 2), 2, 2, K3); // manchas
    r(0, 19, 30, 2, 'rgba(230,245,255,0.5)'); r(2, 18, 26, 1, 'rgba(40,20,60,0.4)');
    return c;
  }
  function tentaculoK(fr) {
    const c = mk(14, 24), x = c.getContext('2d'), r = pintor(x), T = '#8a4a9a', T2 = '#5a2a6a', V = '#e8a0d8';
    r(2, 21, 10, 2, 'rgba(230,245,255,0.5)');
    const pts = fr ? [[5, 18], [6, 15], [7, 12], [8, 9], [8, 6], [7, 4], [5, 3]] : [[5, 18], [5, 15], [5, 12], [6, 9], [7, 6], [9, 4], [11, 4]];
    pts.forEach(([a, b2], i) => { const w = Math.max(2, 5 - Math.floor(i / 2)); r(a - 1, b2, w, 3, T); r(a - 1, b2, 1, 3, T2); if (i % 2) r(a + w - 2, b2 + 1, 1, 1, V); });
    return c;
  }
  function bateria(fr) {
    const c = mk(20, 16), x = c.getContext('2d'), r = pintor(x);
    r(1, 10, 18, 5, '#7a7a82'); r(1, 10, 18, 1, '#a0a0a8'); r(2, 14, 16, 1, '#4a4a52'); // la roca y el parapeto
    r(5, 6, 9, 4, '#3a2a1c'); r(12, 6, 7, 2, '#22222a'); r(18, 6, 1, 2, '#0a0a10'); // el cañón
    r(6, 9, 3, 3, '#5a3a20'); r(11, 9, 3, 3, '#5a3a20');
    if (fr) r(19, 5, 1, 1, '#ffe080');
    return c;
  }
  const COL_P = () => D.PLAYER_COLOR;
  const MODELOS = {
    balandra: fr => barco({ L: 20, H: 20, mastiles: 1, vela: 9, velas: [236, 232, 220], franja: COL_P(), bandera: COL_P(), canones: 1 }, fr),
    fragata: fr => barco({ L: 30, H: 26, mastiles: 2, vela: 9, velas: [240, 236, 226], franja: COL_P(), bandera: COL_P(), canones: 4 }, fr),
    galeon: fr => barco({ L: 36, H: 32, mastiles: 3, vela: 10, velas: [244, 238, 222], franja: COL_P(), bandera: COL_P(), canones: 6, casco: [104, 62, 36] }, fr),
    brulote: fr => barco({ L: 20, H: 18, mastiles: 1, vela: 7, velas: [200, 190, 170], bandera: COL_P(), barriles: true, fuego: true, casco: [96, 70, 48] }, fr),
    infanteria: fr => bote({ ropa: css(COL_P()), gorro: '#2a2a3a', sable: true }, fr),
    arponero: fr => bote({ ropa: '#5a6a4a', gorro: css(COL_P()), arpon: true }, fr),
    balandro: fr => barco({ L: 22, H: 20, mastiles: 1, vela: 9, velas: [40, 38, 44], bandera: '#101014', calavera: true, canones: 2, casco: [70, 50, 40] }, fr),
    abordador: fr => bote({ ropa: '#7a2a24', gorro: '#1a1a1e', sable: true }, fr),
    espectral: fr => barco({ L: 26, H: 24, mastiles: 2, vela: 8, velas: [150, 220, 180], casco: [70, 96, 84], bandera: '#2a4a3a' }, fr),
    malvarosa: fr => barco({ L: 32, H: 28, mastiles: 2, vela: 10, velas: [232, 120, 170], franja: [255, 200, 220], bandera: '#101014', calavera: true, canones: 5, casco: [80, 40, 50] }, fr),
    lamento: fr => barco({ L: 34, H: 30, mastiles: 3, vela: 9, velas: [140, 210, 170], franja: [90, 160, 130], casco: [56, 80, 70], calavera: true }, fr),
    cangrejo, tiburon, serpiente, ahogado, kraken, tentaculoK, bateria,
  };
  // { c, ax, ay } como los dibujos de batalla.js; ax en el medio y ay en la línea del agua
  Ar.dibujo = function (tipo, flip, fr, fantasma) {
    const key = tipo + (flip ? 1 : 0) + (fr ? 1 : 0) + (fantasma ? 'f' : '');
    if (cache[key]) return cache[key];
    const fn = MODELOS[tipo];
    if (!fn) return null;
    let c = fn(fr ? 1 : 0);
    if (fantasma) { const m = mk(c.width, c.height), x = m.getContext('2d'); x.globalAlpha = 0.35; x.drawImage(c, 0, 0); c = m; }
    if (flip) c = espejo(c);
    return (cache[key] = { c, ax: Math.round(c.width / 2), ay: c.height - 2 });
  };
  B.ext.sprite = function (f, frame) {
    const st = f.st, tipo = f.lado === 'p' && f.tipo !== 'bateria' ? f.tipo : st.spr;
    const fr = Math.floor(f.anim * (f.modo === 'walk' ? 3 : 1.4)) % 2;
    const b = B.vistaActual(), niebla = st.id === 'lamento' && b && b.bruma;
    return Ar.dibujo(tipo, f.flip, fr, niebla);
  };
  // el héroe en el mar (pk-30): de pie en un bote, con el dibujo de siempre
  const BOTES = new WeakMap();
  B.ext.heroe = function (f, frame) {
    const v = Sp.villager(f.col, 1, 1, f.modo === 'walk' ? 'idle' : f.modo, frame, null, f.flip, f.modo === 'work' ? (f.look === 'archer' ? null : 'sword') : null, false, false, null, f.look);
    if (!v) return null;
    if (BOTES.has(v)) return BOTES.get(v);
    const k = v.k || 1, vw = v.k ? v.w : v.c.width, vh = v.k ? v.h : v.c.height, Wd = Math.max(22, vw + 6), Hd = vh + 3;
    const c = mk(Wd * k, Hd * k), x = c.getContext('2d'), r = (a, b2, w, h, col) => { x.fillStyle = col; x.fillRect(a * k, b2 * k, w * k, h * k); };
    x.imageSmoothingEnabled = false;
    x.drawImage(v.c, Math.round((Wd / 2 - v.ax) * k), 0, vw * k, vh * k);
    const cx = Wd / 2, y0 = vh - 3;
    for (let j = 0; j < 4; j++) r(cx - 10 + j, y0 + j, 20 - j * 2, 1, j === 0 ? '#c09060' : j === 3 ? '#5a3a1e' : '#8a5a32');
    r(cx - 9, y0 + 1, 18, 1, 'rgb(' + f.col.join(',') + ')');
    const out = { c, ax: Math.round(cx), ay: vh, k, w: Wd, h: Hd };
    BOTES.set(v, out);
    return out;
  };
  // íconos de la Dársena y el planificador
  const _troopIcon = Sp.troopIcon;
  Sp.troopIcon = function (type) {
    if (!D.ARMY_MAR[type]) return _troopIcon(type);
    const k = '__ar_' + type;
    if (cache[k]) return cache[k];
    const d = Ar.dibujo(type, false, 0), s = 2, c = mk(d.c.width * s, d.c.height * s), x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(d.c, 0, 0, c.width, c.height);
    return (cache[k] = c.toDataURL());
  };

  // ---------- La flota en el mapa ----------
  // Solo dibujo: la expedición sale de la Dársena hacia el mar abierto (un rumbo por expedición) y vuelve.
  const MEJOR = ['galeon', 'fragata', 'brulote', 'balandra', 'arponero', 'infanteria'];
  function puerto() {
    const b = G().buildings.find(o => o.owner === 'p' && o.done && o.type === 'barracks');
    return b ? [b.cx, b.cy] : D.PLAYER_HOME.slice();
  }
  Ar.items = function (R, seen) {
    if (!enMar()) return [];
    const st = S(), out = [], now = Date.now(), [px0, py0] = puerto();
    for (const r of (st.exp && st.exp.runs) || []) {
      if (r.asalto) continue;
      const adentro = r.phase === 'battle' || r.phase === 'fin', go = r.phase === 'go' || adentro, ms = Math.max(1, r.travel * 1000);
      const f = adentro ? 1 : go ? 1 - (r.arrive - now) / ms : (r.back - now) / ms;
      if (f <= 0.02) continue;
      const a = (r.id * 2.399) % 6.283, L = 30, tx = px0 + Math.cos(a) * L, ty = py0 + Math.sin(a) * L, k = U.clamp(f, 0, 1);
      const x = px0 + (tx - px0) * k, y = py0 + (ty - py0) * k;
      if (!seen(x, y)) continue;
      const tipo = MEJOR.find(t => (r.units || {})[t] > 0) || 'balandra', [sx] = R.iso(tx, ty), [ox] = R.iso(px0, py0);
      const spr = Ar.dibujo(tipo, go ? sx < ox : sx > ox, Math.floor(now / 500) % 2), [ix, iy] = R.iso(x, y);
      out.push({ d: x + y + 1, k: 'barco', o: {}, spr, x: Math.round(ix - spr.ax), y: Math.round(iy - spr.ay) });
    }
    // la flota en casa, fondeada junto a la Dársena (hasta 4 barcos)
    const army = st.war && st.war.army;
    const bar = G().buildings.find(o => o.owner === 'p' && o.done && o.type === 'barracks');
    if (army && bar) {
      const tipos = MEJOR.filter(t => army[t] > 0).slice(0, 4);
      const agua = aguaJunto(bar);
      tipos.forEach((t, i) => {
        const p = agua[i];
        if (!p || !seen(p[0], p[1])) return;
        const spr = Ar.dibujo(t, i % 2 === 1, Math.floor(now / 700 + i) % 2), [ix, iy] = R.iso(p[0] + 0.5, p[1] + 0.5);
        out.push({ d: p[0] + p[1] + 1, k: 'barco', o: {}, spr, x: Math.round(ix - spr.ax), y: Math.round(iy - spr.ay) });
      });
    }
    return out;
  };
  const aguaCache = new Map();
  function aguaJunto(b) {
    const k = b.id + ':' + b.x + ',' + b.y;
    if (aguaCache.has(k)) return aguaCache.get(k);
    const out = [];
    for (let d = 1; d <= 3 && out.length < 4; d++) for (let y = b.y - d; y < b.y + b.h + d && out.length < 4; y++) for (let x = b.x - d; x < b.x + b.w + d && out.length < 4; x++) {
      if (!W.inb(x, y) || W.terrain[W.idx(x, y)] !== 4) continue;
      if (out.some(p => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 2)) continue;
      out.push([x, y]);
    }
    aguaCache.set(k, out);
    return out;
  }

  // ---------- Asaltos piratas ----------
  // Solo mientras juegas (como las incursiones de la tierra). Lo único que se guarda es el reloj (st.asalto).
  const PRIMERO = 600, ENTRE = [1500, 2400], AVISO = 45;
  let aviso = 0;
  Ar.init = function (st) {
    if (!enMar()) return;
    st.asalto = Object.assign({ t: PRIMERO, n: 0, ganados: 0, perdidos: 0 }, st.asalto);
    st.jefesMar = st.jefesMar || {};
    // tropas de la tierra que hubieran quedado en el mar (antes de pk-29 el mar usaba las tablas de la tierra)
    for (const k of Object.keys(st.war.army)) if (!D.ARMY[k]) delete st.war.army[k];
    st.war.q = st.war.q.filter(k => D.ARMY[k]);
    aviso = 0;
  };
  const puedeAsalto = st => st.era >= 2 && (G().countB('barracks') || G().countB('bateria'));
  Ar.baterias = () => G().buildings.filter(b => b.owner === 'p' && b.done && b.type === 'bateria');
  Ar.cadena = () => { const b = G().buildings.find(o => o.owner === 'p' && o.done && o.type === 'cadena'); return b ? G().bst(b).cadena : 1; };
  Ar.fuerzaAsalto = () => { const st = S(); return Math.round(D.asaltoFuerza(st.era, st.asalto.n) * Ar.cadena()); };
  Ar.proximo = () => { const st = S(); return st.asalto && puedeAsalto(st) ? (aviso ? Math.max(0, aviso) : st.asalto.t + AVISO) : null; };
  function empezarAsalto() {
    const st = S(), g = G(), army = st.war.army, units = {};
    for (const k in army) if (army[k] > 0) { units[k] = army[k]; army[k] = 0; }
    const bats = Ar.baterias(), bp = bats.reduce((s, b) => s + (g.bst(b).defense || 0), 0) * g.eraMult();
    const need = Ar.fuerzaAsalto(), enemy = { pirata: 1 };
    st.asalto.n++;
    if (!Object.keys(units).length && !bp) { robo(st, 'Nadie defendía el puerto'); return; }
    const run = { id: st.exp.rid++, name: 'Asalto pirata', enemy, need, power: Math.round(PK.Exp.powerVs(units, enemy) + bp), heal: 0, units, loot: D.asaltoPremio(st.era), phase: 'go', arrive: Date.now(), travel: 0, asalto: true, baterias: bp, nBat: bats.length, nivel: 0.3 };
    run.chance = PK.Exp.chance(run.power / Math.max(1, need));
    st.exp.runs.push(run);
  }
  Ar.asaltoYa = () => empezarAsalto(); // para las pruebas y ?dev
  function robo(st, por) {
    const tope = D.asaltoTope(st.era), got = {};
    for (const r of ['food', 'wood', 'gold', 'especias']) { const n = Math.floor(Math.min((st.res[r] || 0) * 0.12, r === 'especias' ? tope / 20 : tope)); if (n > 0) { st.res[r] -= n; got[r] = n; } }
    st.asalto.perdidos++;
    G().stat('asaltos_perdidos', 1);
    toast((por ? por + ': l' : 'L') + 'os piratas saquearon el puerto: ' + (Object.keys(got).map(k => '−' + U.fmt(got[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', ') || 'no encontraron nada') + '. Una Batería costera y tu flota en casa los frenan.', 'bad');
  }
  Ar.finAsalto = function (r) {
    const st = S();
    if (r.won) { st.asalto.ganados++; G().stat('asaltos_ganados', 1); } // el aviso de victoria ya lo da expeditions.js
    else robo(st);
  };
  Ar.tick = function (dt) {
    if (!enMar() || G().offline) return;
    const st = S(), g = G();
    if (!st.asalto) Ar.init(st);
    // la Escuela de navegantes da veteranía a la flota en casa
    const esc = g.buildings.find(b => b.owner === 'p' && b.done && b.type === 'escuela');
    if (esc) { const xh = g.bst(esc).armyXp || 0; for (const k in st.war.army) if (st.war.army[k] > 0) st.exp.xp[k] = (st.exp.xp[k] || 0) + (xh * dt) / 3600; }
    if (puedeAsalto(st) && !st.exp.runs.some(r => r.asalto)) {
      if (aviso > 0) {
        aviso -= dt;
        if (aviso <= 0) { aviso = 0; empezarAsalto(); st.asalto.t = U.rand(ENTRE[0], ENTRE[1]); }
      } else if ((st.asalto.t -= dt) <= 0) {
        aviso = AVISO;
        toast('¡Velas negras en el horizonte! Los piratas asaltan tu puerto en ' + AVISO + ' s. Tu flota en casa y las baterías saldrán a pelear.', 'bad', { label: 'Flota', fn: () => PK.Social.openWar('troops') });
        if (PK.Sfx) PK.Sfx.play('cuerno');
      }
    }
    tormentaTick();
  };

  // ---------- Tormentas ----------
  let tormentaEl = null, habia = null;
  function tormentaTick() {
    const t = D.tormenta(), bar = document.getElementById('topbar');
    if (!!t !== habia) {
      if (habia !== null && t) toast('Se viene una tormenta: la flota que zarpe ahora tardará más y llegará con las velas rotas. Pasa en ' + U.fmtTime((t.hasta - Date.now()) / 1000) + '.', 'warn');
      habia = !!t;
    }
    if (!bar) return;
    if (t && !tormentaEl) { tormentaEl = el('span', { class: 'res tormenta', title: 'Tormenta: las expediciones tardan más y llegan más débiles' }, '⛈'); const m = bar.querySelector('.marea'); if (m && m.nextSibling) bar.insertBefore(tormentaEl, m.nextSibling); else bar.append(tormentaEl); }
    if (!t && tormentaEl) { tormentaEl.remove(); tormentaEl = null; }
    if (t && tormentaEl) tormentaEl.lastChild && (tormentaEl.title = 'Tormenta: pasa en ' + U.fmtTime((t.hasta - Date.now()) / 1000));
  }

  // ---------- Ventanas (las llama ui/cuartel.js en el mar) ----------
  // Jefes del mar, en la pestaña «Atacar» de la Dársena.
  Ar.jefesEl = function (preparar) {
    const st = S(), box = el('div');
    const temp = D.tormenta();
    if (temp) box.append(el('p', { class: 'alert small' }, '⛈ Tormenta: una flota que zarpe ahora tarda un 40% más y llega con −10% de fuerza. Pasa en ' + U.fmtTime((temp.hasta - Date.now()) / 1000) + '.'));
    box.append(el('h3', null, 'Jefes del mar'));
    for (const id in D.JEFES_MAR) {
      const J = D.JEFES_MAR[id], j = (st.jefesMar || {})[id] || {}, going = st.exp.runs.some(r => r.jefeMar === id), lock = st.era < J.era, vuelve = j.vuelve > Date.now();
      box.append(el('div', { class: 'raid-row dungeon' + (lock ? ' locked' : '') },
        el('img', { class: 'dg-ico', src: Ar.icono(id), alt: '' }),
        el('div', { class: 'dg-info' }, el('b', null, J.name), el('div', { class: 'small' }, J.desc),
          el('div', { class: 'small muted' }, PK.UI.enemyText(J.enemy) + ' · fuerza aprox. ' + U.fmt(J.power) + (j.n ? ' · derrotado ' + j.n + (j.n === 1 ? ' vez' : ' veces') : ' · primera victoria: ') , j.n ? '' : PK.UI.costEl(J.loot, 1, true))),
        lock ? el('span', { class: 'muted small' }, 'Era ' + U.roman(J.era)) : going ? el('span', { class: 'small good-t' }, 'Tu flota va en camino') : vuelve ? el('span', { class: 'muted small' }, 'Vuelve en ' + U.fmtTime((j.vuelve - Date.now()) / 1000)) :
          PK.UI.btn(j.n ? 'Otra vez' : 'Preparar', () => preparar({ jefeMar: id }), { small: true, cls: 'gold' })));
    }
    return box;
  };
  Ar.icono = function (id) {
    const k = '__ic_' + id;
    if (cache[k]) return cache[k];
    const d = Ar.dibujo(id, false, 0), c = mk(48, 48), x = c.getContext('2d'), s = Math.min(44 / d.c.width, 44 / d.c.height);
    x.imageSmoothingEnabled = false; x.drawImage(d.c, Math.round((48 - d.c.width * s) / 2), Math.round((48 - d.c.height * s) / 2), d.c.width * s, d.c.height * s);
    return (cache[k] = c.toDataURL());
  };
  // La Corsaria (pk-30): se contrata aquí, en la pestaña Flota de la Dársena.
  Ar.corsariaEl = function () {
    const H = PK.Heroes;
    if (!H || H.hayCorsaria()) return '';
    const why = H.porQueNoCorsaria();
    return el('div', { class: 'raid-row dungeon' }, el('div', { class: 'dg-info' }, el('b', null, 'La Corsaria: ' + H.nombreCorsaria()),
      el('div', { class: 'small' }, 'Una heroína que solo se recluta en el archipiélago. Dirige la flota: «Leer las corrientes» pone el viento a favor y hace pegar +40% a los abordajes. Gobierna la Dársena (+15% de armado). Puede viajar a la tierra en el Galeón.'),
      el('div', { class: 'small muted' }, 'Cuesta: ', PK.UI.costEl(H.costoCorsaria()))),
      PK.UI.btn('Contratar', () => { if (H.contratarCorsaria()) PK.UI.rerender(); }, { small: true, cls: 'gold', disabled: !!why, title: why || '' }),
      why ? el('span', { class: 'small warn-t' }, why) : '');
  };
  // Pestaña «Defensa» en el mar: los asaltos piratas, las baterías y la cadena.
  Ar.defensaEl = function () {
    const st = S(), g = G(), box = el('div', { class: 'bar-pane' });
    const bats = Ar.baterias(), cad = Ar.cadena(), prox = Ar.proximo();
    box.append(el('h3', null, 'Asaltos piratas'),
      el('p', { class: 'small' }, 'Mientras juegas, los piratas asaltan tu puerto cada 25 a 40 minutos (desde la Era II, cuando ya tienes Dársena o Batería). Salen a pelear tu flota en casa y tus baterías costeras. Si ganas hay botín; si pierdes se llevan un 12% de pescado, teca, oro y especias (con tope).'),
      prox === null ? el('p', { class: 'small muted' }, st.era < 2 ? 'Todavía no: empiezan en la Era II.' : 'Todavía no: empiezan cuando tengas una Dársena de guerra o una Batería costera.')
        : el('p', null, el('b', null, aviso ? '¡Llegan en ' + Math.ceil(aviso) + ' s!' : 'Próximo asalto en unos ' + U.fmtTime(prox)), ' · fuerza aprox. ' + U.fmt(Ar.fuerzaAsalto()) + (cad < 1 ? ' (la cadena la baja a ×' + cad.toFixed(2).replace('.', ',') + ')' : '')),
      el('p', { class: 'small' }, 'Baterías costeras: ' + bats.length + (bats.length ? ' (defensa ' + U.fmt(bats.reduce((s, b) => s + (g.bst(b).defense || 0), 0)) + ')' : '') + ' · Cadena de puerto: ' + (cad < 1 ? 'sí' : 'no') + ' · Rechazados ' + st.asalto.ganados + ', perdidos ' + st.asalto.perdidos + '.'),
      el('div', { class: 'row' }, PK.UI.btn('Construir una Batería', () => { PK.UI.closeModal(); PK.Input.startPlacing('bateria'); }, { small: true, disabled: st.era < D.BUILD.bateria.era }),
        PK.UI.btn('Construir la Cadena', () => { PK.UI.closeModal(); PK.Input.startPlacing('cadena'); }, { small: true, disabled: st.era < D.BUILD.cadena.era || g.countAll('cadena') > 0 })));
    return box;
  };
})();
