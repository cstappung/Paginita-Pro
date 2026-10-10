// @controles: tactil raton teclado
/* Tulones: la pantalla. La física vive en motor.js; aquí se dibuja, se oye y se juega por turnos. */
(() => {
  'use strict';
  const M = window.TulonesMotor, Club = window.Club;
  const $ = id => document.getElementById(id);
  const clave = k => (Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local');
  const lee = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const I = M.I, C = M.CATALOGO;
  const TINTA = '#2a1e18';

  /* ---------------- sonido ---------------- */
  let actx = null, mudo = lee('tulones.mudo', false);
  function audio() {
    if (mudo) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tono(f, t0, dur, tipo, vol, f2) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + (t0 || 0), o = a.createOscillator(), g = a.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .15, t + .01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  function ruido(t0, dur, f, vol) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + (t0 || 0), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = f || 1200; bp.Q.value = 1.2;
    g.gain.setValueAtTime(vol || .2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(a.destination); s.start(t);
  }
  const sonido = {
    agarra: () => { tono(520, 0, .09, 'triangle', .14, 760); ruido(0, .05, 2400, .06); },
    congela: () => { [1320, 1760, 2093, 2637].forEach((f, i) => tono(f, i * .06, .35, 'sine', .08)); ruido(0, .3, 6000, .05); },
    fanfarria: () => { [523, 659, 784, 1047].forEach((f, i) => tono(f, i * .1, .22, 'square', .06)); },
    fin: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, i * .12, .35, 'triangle', .1)); },
    tic: () => tono(1500, 0, .04, 'square', .05),
    golpe: () => { tono(140, 0, .12, 'sine', .18, 70); ruido(0, .07, 500, .1); }
  };
  function pintaMudo() {
    const b = $('sound-button');
    b.setAttribute('aria-pressed', String(!mudo));
    b.setAttribute('aria-label', mudo ? 'Activar efectos' : 'Desactivar efectos');
  }
  $('sound-button').addEventListener('click', () => { mudo = !mudo; guarda('tulones.mudo', mudo); pintaMudo(); });
  pintaMudo();

  /* ---------------- dibujo: utilidades ---------------- */
  function mezcla(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  const oscuro = (c, t) => mezcla(c, '#000000', t), claro = (c, t) => mezcla(c, '#ffffff', t);

  // Miembro ahusado: grosor a en p1, m al medio, b en p2.
  function huso(ctx, x1, y1, x2, y2, a, m, b) {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1e-6, nx = -dy / l, ny = dx / l, ang = Math.atan2(dy, dx);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, o = (4 * m - a - b) / 2;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * a, y1 + ny * a);
    ctx.quadraticCurveTo(mx + nx * o, my + ny * o, x2 + nx * b, y2 + ny * b);
    ctx.arc(x2, y2, b, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.quadraticCurveTo(mx - nx * o, my - ny * o, x1 - nx * a, y1 - ny * a);
    ctx.arc(x1, y1, a, ang - Math.PI / 2, ang + Math.PI / 2, true);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  function elipse(ctx, x, y, rx, ry, rot, relleno, trazo) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (trazo !== false) ctx.stroke();
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- el tulón ---------------- */
  // El color del sombrero ya no se elige: cada uno trae el suyo.
  const COLOR_SOMBRERO = { gorra: '#e2483d', vaquero: '#8b5a2b', vikingo: '#2a2a2a', lana: '#e2483d', chupalla: '#2a2a2a' };
  function colores(asp, helada) {
    const f = c => helada ? mezcla(c, '#bfe8ff', .35) : c, cal = C.colorCalzon[asp.colorCalzon];
    return {
      piel: f(C.piel[asp.piel]), pelo: f(C.colorPelo[asp.colorPelo]), calzon: f(cal === 'chilena' ? '#ffffff' : cal),
      calcetin: f(C.colorCalcetin[asp.colorCalcetin]), sombrero: f(COLOR_SOMBRERO[C.sombrero[asp.sombrero]] || '#e2483d')
    };
  }

  function dibujaTulon(ctx, P, bul, asp, opts) {
    opts = opts || {};
    asp = asp || M.PRESETS[0];
    const K = colores(asp, opts.helada), X = i => P[i * 2], Y = i => P[i * 2 + 1];
    const fis = C.fisico[asp.fisico], calzon = C.calzon[asp.calzon], calc = C.calcetines[asp.calcetines];
    const chilena = C.colorCalzon[asp.colorCalzon] === 'chilena';
    const gb = fis === 'fornido' ? 1.2 : fis === 'flaco' ? .85 : 1;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = TINTA; ctx.lineWidth = 2.5;

    // Marco de la pelvis (para orientar pies y ropa).
    let ux = X(I.cuello) - X(I.pelvis), uy = Y(I.cuello) - Y(I.pelvis); const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const rx = -uy, ry = ux;

    const pierna = (cad, rod, pie, lado) => {
      ctx.fillStyle = K.piel;
      huso(ctx, X(cad), Y(cad), X(rod), Y(rod), 11 * (fis === 'fornido' ? 1.1 : 1), 11.5 * (fis === 'flaco' ? .9 : 1), 7.5);
      huso(ctx, X(rod), Y(rod), X(pie), Y(pie), 7.5, 8, 5.5);
      // Calcetín sobre la espinilla.
      if (calc !== 'ninguno') {
        const t = calc === 'cortos' ? .25 : calc === 'altos' ? .65 : .45;
        const sx = lerp(X(pie), X(rod), t), sy = lerp(Y(pie), Y(rod), t);
        ctx.fillStyle = K.calcetin;
        huso(ctx, sx, sy, X(pie), Y(pie), lerp(5.5, 8, t) + .6, lerp(5.5, 8, t / 2) + .6, 6.1);
        if (calc === 'rayas') {
          ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
          for (const s of [.3, .6]) {
            const bx = lerp(sx, X(pie), s), by = lerp(sy, Y(pie), s), dx = X(pie) - sx, dy = Y(pie) - sy, l = Math.hypot(dx, dy) || 1;
            ctx.beginPath(); ctx.moveTo(bx - dy / l * 6.5, by + dx / l * 6.5); ctx.lineTo(bx + dy / l * 6.5, by - dx / l * 6.5); ctx.stroke();
          }
          ctx.restore();
          ctx.strokeStyle = TINTA; ctx.lineWidth = 2.5;
        }
      }
      // Pie: elipse perpendicular a la espinilla, hacia fuera.
      const dx = X(pie) - X(rod), dy = Y(pie) - Y(rod), l = Math.hypot(dx, dy) || 1;
      let px = -dy / l, py = dx / l;
      if ((px * rx + py * ry) * lado < 0) { px = -px; py = -py; }
      ctx.fillStyle = calc !== 'ninguno' ? K.calcetin : K.piel;
      elipse(ctx, X(pie) + px * 5, Y(pie) + py * 5, 10, 6, Math.atan2(py, px), null);
      ctx.fill(); ctx.stroke();
      if (calzon === 'boxer') {
        ctx.fillStyle = K.calzon;
        const ex = lerp(X(cad), X(rod), .42), ey = lerp(Y(cad), Y(rod), .42);
        huso(ctx, X(cad), Y(cad), ex, ey, 12.5, 13, 11.5);
      }
    };
    pierna(I.caderaI, I.rodillaI, I.pieI, -1);
    pierna(I.caderaD, I.rodillaD, I.pieD, 1);

    // Cuello.
    ctx.fillStyle = K.piel;
    huso(ctx, X(I.cuello), Y(I.cuello), lerp(X(I.cuello), X(I.cabeza), .5), lerp(Y(I.cuello), Y(I.cabeza), .5), 7, 7, 7);

    // Torso en su propio marco: origen en la pelvis, y hacia los pies.
    ctx.save();
    ctx.transform(rx, ry, -ux, -uy, X(I.pelvis), Y(I.pelvis));
    const sx = fis === 'flaco' ? .88 : fis === 'fornido' ? 1.1 : 1;
    ctx.save(); ctx.scale(sx, 1);
    ctx.beginPath();
    ctx.moveTo(0, -64); ctx.lineTo(-8, -63);
    ctx.quadraticCurveTo(-18, -60, -27, -55); ctx.quadraticCurveTo(-33, -50, -29, -42);
    ctx.quadraticCurveTo(-22, -34, -23, -24); ctx.quadraticCurveTo(-24, -14, -18, -6);
    ctx.quadraticCurveTo(-21, 4, -16, 14); ctx.quadraticCurveTo(-6, 20, 0, 20);
    ctx.quadraticCurveTo(6, 20, 16, 14); ctx.quadraticCurveTo(21, 4, 18, -6);
    ctx.quadraticCurveTo(24, -14, 23, -24); ctx.quadraticCurveTo(22, -34, 29, -42);
    ctx.quadraticCurveTo(33, -50, 27, -55); ctx.quadraticCurveTo(18, -60, 8, -63);
    ctx.closePath();
    ctx.fillStyle = K.piel; ctx.fill(); ctx.stroke();
    // Sombra de un costado.
    ctx.save(); ctx.clip();
    ctx.fillStyle = oscuro(K.piel, .12); ctx.fillRect(10, -70, 30, 100);
    ctx.restore();
    // Pectorales, pezones, abdominales, ombligo.
    ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = oscuro(K.piel, .35);
    ctx.beginPath(); ctx.moveTo(-20, -48); ctx.quadraticCurveTo(-10, -32, -2, -42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -48); ctx.quadraticCurveTo(10, -32, 2, -42); ctx.stroke();
    ctx.fillStyle = oscuro(K.piel, .3);
    ctx.beginPath(); ctx.arc(-12, -41, 1.8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, -41, 1.8, 0, 7); ctx.fill();
    if (fis !== 'panzon') {
      ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, -14);
      if (fis === 'fornido') { for (const y of [-29, -21]) { ctx.moveTo(-8, y); ctx.lineTo(8, y); } }
      ctx.stroke();
    }
    ctx.restore();
    if (fis === 'panzon') {
      ctx.fillStyle = K.piel; elipse(ctx, 0, -12, 22, 16, 0, null); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.fillStyle = claro(K.piel, .2); elipse(ctx, -7, -17, 8, 5, -.4, null, false); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.fillStyle = oscuro(K.piel, .4);
    ctx.beginPath(); ctx.ellipse(0, fis === 'panzon' ? -10 : -9, 1.6, 2.2, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.restore(); // fin escala

    // Calzoncillos.
    ctx.fillStyle = K.calzon;
    ctx.beginPath();
    ctx.moveTo(-18, -7); ctx.lineTo(18, -7); ctx.lineTo(19, 6); ctx.quadraticCurveTo(10, 10, 4, 20);
    ctx.lineTo(-4, 20); ctx.quadraticCurveTo(-10, 10, -19, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    if (calzon === 'bañador') { ctx.fillStyle = claro(K.calzon, .6); ctx.fillRect(-19, -7, 5, 30); ctx.fillRect(14, -7, 5, 30); }
    if (chilena) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-20, -8, 40, 15);
      ctx.fillStyle = '#d52b1e'; ctx.fillRect(-20, 7, 40, 16);
      ctx.fillStyle = '#0039a6'; ctx.fillRect(-20, -8, 14, 15);
      ctx.fillStyle = '#ffffff'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 1.6 : 3.8; ctx.lineTo(-13 + Math.cos(a) * rr, -.5 + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
    if (calzon === 'corazones') {
      ctx.fillStyle = '#e2304a';
      for (const [hx, hy] of [[-11, -1], [10, 0], [-2, 8], [12, 9], [-13, 9]]) {
        ctx.beginPath(); ctx.moveTo(hx, hy + 3); ctx.bezierCurveTo(hx - 5, hy - 1, hx - 2, hy - 5, hx, hy - 2);
        ctx.bezierCurveTo(hx + 2, hy - 5, hx + 5, hy - 1, hx, hy + 3); ctx.fill();
      }
    }
    if (!chilena) { ctx.fillStyle = oscuro(K.calzon, .15); ctx.fillRect(-20, 9, 40, 14); }
    ctx.restore();
    // Cinturilla.
    ctx.fillStyle = calzon === 'slip' ? claro(K.calzon, .3) : oscuro(K.calzon, .2);
    ctx.beginPath(); ctx.rect(-18.5, -8, 37, 5); ctx.fill(); ctx.stroke();
    // El bulto: un péndulo de tela que cuelga de la entrepierna (ENGANCHE) hasta la punta que da el motor.
    // El grosor va con el tamaño del aspecto; «chico» es un circulito sin péndulo.
    const ENGANCHE = 4, largo = M.largoBulto(asp);
    const bx = bul ? bul.x : 0, by = ENGANCHE + (bul ? bul.y : largo);
    const tela = chilena ? '#d52b1e' : oscuro(K.calzon, .05);
    ctx.save(); ctx.lineCap = 'round';
    if (largo < 1) {
      ctx.fillStyle = tela; elipse(ctx, 0, ENGANCHE + 3, 2.6, 2.6, 0, null); ctx.fill(); ctx.stroke();
    } else {
      const grosor = largo <= 6 ? 7 : largo <= 12 ? 8.5 : 10;
      ctx.strokeStyle = TINTA; ctx.lineWidth = grosor + 3;
      ctx.beginPath(); ctx.moveTo(0, ENGANCHE); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = tela; ctx.lineWidth = grosor;
      ctx.beginPath(); ctx.moveTo(0, ENGANCHE); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#ffffff55'; elipse(ctx, bx * .7 - 1.5, ENGANCHE + (by - ENGANCHE) * .7, 1.8, Math.min(2.6 + largo * .06, 7), -Math.atan2(bx, by - ENGANCHE), null, false); ctx.fill();
    }
    ctx.restore();
    // Costuras en Y.
    if (calzon === 'slip') {
      ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = oscuro(K.calzon, .35);
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.quadraticCurveTo(-6, 4, -4, ENGANCHE); ctx.moveTo(9, -3); ctx.quadraticCurveTo(6, 4, 4, ENGANCHE); ctx.stroke();
      ctx.restore();
    }
    ctx.restore(); // fin marco torso

    // Brazos y manos.
    const brazo = (hom, codo, mano, k) => {
      ctx.fillStyle = K.piel;
      huso(ctx, X(hom), Y(hom), X(codo), Y(codo), 8.5 * gb, 9.5 * gb, 6 * gb);
      huso(ctx, X(codo), Y(codo), X(mano), Y(mano), 6.5 * gb, 7.5 * gb, 5 * gb);
      const dx = X(mano) - X(codo), dy = Y(mano) - Y(codo), l = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
      const cx = X(mano) + dx / l * 3, cy = Y(mano) + dy / l * 3;
      const pin = opts.pin && opts.pin[k];
      ctx.fillStyle = K.piel;
      if (pin) {
        elipse(ctx, cx, cy, 7, 6.5, ang, null); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.lineWidth = 1.3;
        for (const s of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * 3 - Math.sin(ang) * s, cy + Math.sin(ang) * 3 + Math.cos(ang) * s); ctx.lineTo(cx + Math.cos(ang) * 6 - Math.sin(ang) * s, cy + Math.sin(ang) * 6 + Math.cos(ang) * s); ctx.stroke(); }
        ctx.restore();
      } else {
        elipse(ctx, cx, cy, 8, 6, ang, null); ctx.fill(); ctx.stroke();
        const lado = k === 0 ? -1 : 1, tx = cx - Math.sin(ang) * 5 * lado - Math.cos(ang) * 2, ty = cy + Math.cos(ang) * 5 * lado - Math.sin(ang) * 2;
        elipse(ctx, tx, ty, 3.5, 2.5, ang - .6 * lado, null); ctx.fill(); ctx.stroke();
      }
    };
    brazo(I.hombroI, I.codoI, I.manoI, 0);
    brazo(I.hombroD, I.codoD, I.manoD, 1);

    // Anillos de miembros sostenidos.
    if (opts.held) {
      M.MIEMBROS.forEach((m, k) => {
        if (!opts.held[k]) return;
        ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = opts.pin && opts.pin[k] ? '#3ccf5a' : '#ff9a1f';
        ctx.beginPath(); ctx.arc(X(m.ext), Y(m.ext), 13, 0, 7); ctx.stroke(); ctx.restore();
      });
    }

    dibujaCabeza(ctx, X(I.cabeza), Y(I.cabeza), X(I.cuello), Y(I.cuello), asp, K, opts);
    ctx.restore();
  }

  function dibujaCabeza(ctx, hx, hy, nx, ny, asp, K, opts) {
    let vx = hx - nx, vy = hy - ny; const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    // Eje x local = (−vy, vx), eje y local = −v (hacia la barbilla).
    ctx.save();
    ctx.transform(-vy, vx, -vx, -vy, hx, hy);
    const pelo = C.pelo[asp.pelo], barba = C.barba[asp.barba], sombrero = C.sombrero[asp.sombrero];
    // Pelo de atrás.
    ctx.fillStyle = K.pelo;
    if (pelo === 'largo') { ctx.beginPath(); ctx.moveTo(-16, -8); ctx.quadraticCurveTo(-24, 18, -15, 30); ctx.lineTo(15, 30); ctx.quadraticCurveTo(24, 18, 16, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (pelo === 'afro') { elipse(ctx, 0, -10, 27, 22, 0, null); ctx.fill(); ctx.stroke(); }
    if (pelo === 'coleta') { elipse(ctx, 0, -24, 7, 6, 0, null); ctx.fill(); ctx.stroke(); }
    // Orejas.
    ctx.fillStyle = K.piel;
    elipse(ctx, -14, 2, 4, 6, 0, null); ctx.fill(); ctx.stroke();
    elipse(ctx, 14, 2, 4, 6, 0, null); ctx.fill(); ctx.stroke();
    // Cara.
    ctx.beginPath();
    ctx.moveTo(-14, -4); ctx.quadraticCurveTo(-15, -19, 0, -20); ctx.quadraticCurveTo(15, -19, 14, -4);
    ctx.lineTo(13, 8); ctx.quadraticCurveTo(11, 19, 0, 20); ctx.quadraticCurveTo(-11, 19, -13, 8); ctx.closePath();
    ctx.fillStyle = K.piel; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.fillStyle = '#ff7b7b55'; elipse(ctx, -9, 7, 4, 2.5, 0, null, false); ctx.fill(); elipse(ctx, 9, 7, 4, 2.5, 0, null, false); ctx.fill(); ctx.restore();
    // Barba (antes de la boca).
    ctx.fillStyle = K.pelo; ctx.lineWidth = 1.8;
    if (barba === 'bigote') { ctx.beginPath(); ctx.moveTo(-8, 9); ctx.quadraticCurveTo(-4, 5, 0, 7.5); ctx.quadraticCurveTo(4, 5, 8, 9); ctx.quadraticCurveTo(4, 11, 0, 9.5); ctx.quadraticCurveTo(-4, 11, -8, 9); ctx.fill(); ctx.stroke(); }
    if (barba === 'perilla') { ctx.beginPath(); ctx.moveTo(-4, 15); ctx.lineTo(4, 15); ctx.lineTo(0, 24); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (barba === 'barba' || barba === 'leñador') {
      const fondo = barba === 'leñador' ? 30 : 23;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-15, fondo - 4, 0, fondo); ctx.quadraticCurveTo(15, fondo - 4, 14, 0);
      ctx.lineTo(10, 5); ctx.quadraticCurveTo(0, 16, -10, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, 9); ctx.quadraticCurveTo(0, 5, 7, 9); ctx.quadraticCurveTo(0, 11, -7, 9); ctx.fill();
    }
    if (barba === 'patillas') { ctx.fillRect(-14, -4, 4, 13); ctx.fillRect(10, -4, 4, 13); }
    ctx.lineWidth = 2.5;
    // Ojos: las pupilas miran hacia opts.mira.
    let lx = 0, ly = 0;
    if (opts.mira) {
      const dx = opts.mira[0] - hx, dy = opts.mira[1] - hy, d = Math.hypot(dx, dy) || 1;
      lx = (dx * -vy + dy * vx) / d; ly = (dx * -vx + dy * -vy) / d;
    }
    const cara = opts.cara || 'normal';
    for (const s of [-6, 6]) {
      if (cara === 'esfuerzo') {
        ctx.save(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s - 3.5, -4); ctx.lineTo(s + 3.5, -2); ctx.lineTo(s - 3.5, 0); ctx.stroke(); ctx.restore();
        continue;
      }
      ctx.fillStyle = '#ffffff'; elipse(ctx, s, -3, cara === 'miedo' ? 4.5 : 4, cara === 'miedo' ? 5 : 4.5, 0, null); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 2.5;
      ctx.fillStyle = TINTA; ctx.beginPath(); ctx.arc(s + lx * 1.7, -3 + ly * 1.7, cara === 'miedo' ? 1.4 : 2, 0, 7); ctx.fill();
    }
    // Cejas.
    ctx.save(); ctx.strokeStyle = asp.pelo === 0 ? oscuro(K.piel, .5) : oscuro(K.pelo, .1); ctx.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (cara === 'miedo') { ctx.moveTo(s * 3, -11); ctx.lineTo(s * 9, -9); }
      else if (cara === 'esfuerzo') { ctx.moveTo(s * 2, -7); ctx.lineTo(s * 9, -10); }
      else { ctx.moveTo(s * 2.5, -9.5); ctx.quadraticCurveTo(s * 6, -11.5, s * 9, -9.5); }
      ctx.stroke();
    }
    ctx.restore();
    // Nariz.
    ctx.fillStyle = oscuro(K.piel, .08); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3.5, 4, 0.5, 5.5); ctx.stroke();
    // Boca.
    ctx.lineWidth = 1.8;
    if (barba !== 'barba' && barba !== 'leñador' || cara !== 'normal') {
      ctx.beginPath();
      if (cara === 'esfuerzo') {
        ctx.fillStyle = '#ffffff'; ctx.rect(-5, 9.5, 10, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, 11.5); ctx.lineTo(5, 11.5); ctx.moveTo(-1.5, 9.5); ctx.lineTo(-1.5, 13.5); ctx.moveTo(1.8, 9.5); ctx.lineTo(1.8, 13.5); ctx.stroke();
      } else if (cara === 'miedo') { ctx.fillStyle = '#5a1e1e'; elipse(ctx, 0, 12, 3, 4, 0, null); ctx.fill(); ctx.stroke(); }
      else if (cara === 'helado') { ctx.moveTo(-5, 12); ctx.quadraticCurveTo(-2.5, 10, 0, 12); ctx.quadraticCurveTo(2.5, 14, 5, 12); ctx.stroke(); }
      else { ctx.moveTo(-5, 10); ctx.quadraticCurveTo(0, 15, 5, 10); ctx.stroke(); }
    }
    ctx.lineWidth = 2.5;
    // Pelo de delante.
    ctx.fillStyle = K.pelo;
    if (sombrero === 'ninguno' || sombrero === 'corona') {
      if (pelo === 'corto' || pelo === 'largo' || pelo === 'coleta') {
        ctx.beginPath(); ctx.moveTo(-15, -3); ctx.quadraticCurveTo(-16, -22, 0, -22); ctx.quadraticCurveTo(16, -22, 15, -3);
        ctx.quadraticCurveTo(13, -12, 6, -14); ctx.quadraticCurveTo(-2, -11, -8, -14); ctx.quadraticCurveTo(-13, -11, -15, -3); ctx.fill(); ctx.stroke();
      } else if (pelo === 'despeinado') {
        ctx.beginPath(); ctx.moveTo(-15, -3);
        const picos = [[-18, -14], [-13, -15], [-14, -24], [-7, -19], [-4, -28], [1, -20], [6, -27], [8, -19], [15, -23], [13, -14], [18, -12], [15, -3]];
        for (const [a, b] of picos) ctx.lineTo(a, b);
        ctx.quadraticCurveTo(10, -12, 0, -13); ctx.quadraticCurveTo(-10, -12, -15, -3); ctx.fill(); ctx.stroke();
      } else if (pelo === 'tupe') {
        ctx.beginPath(); ctx.moveTo(-15, -4); ctx.quadraticCurveTo(-16, -20, -6, -21); ctx.quadraticCurveTo(4, -34, 18, -27);
        ctx.quadraticCurveTo(10, -24, 15, -18); ctx.quadraticCurveTo(15, -10, 14, -4); ctx.quadraticCurveTo(8, -14, -4, -14); ctx.quadraticCurveTo(-12, -12, -15, -4); ctx.fill(); ctx.stroke();
      } else if (pelo === 'mohicano') {
        ctx.beginPath(); ctx.moveTo(-4, -16);
        for (let i = 0; i < 5; i++) { const y = -18 + i * 3, x = -4 + i * 2; ctx.lineTo(x - 2, y - 12 + i); }
        ctx.lineTo(6, -14); ctx.lineTo(4, -19); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, -19); ctx.quadraticCurveTo(0, -31, 3, -19); ctx.quadraticCurveTo(0, -27, -3, -19); ctx.fill(); ctx.stroke();
      } else if (pelo === 'afro') {
        ctx.beginPath(); ctx.moveTo(-15, -4); ctx.quadraticCurveTo(-14, -16, 0, -16); ctx.quadraticCurveTo(14, -16, 15, -4); ctx.lineTo(18, -14); ctx.quadraticCurveTo(0, -30, -18, -14); ctx.closePath(); ctx.fill();
      } else if (pelo === 'calvo') {
        ctx.save(); ctx.fillStyle = '#ffffff99'; elipse(ctx, -5, -15, 4, 2, -.3, null, false); ctx.fill(); ctx.restore();
      }
    }
    // Sombreros.
    ctx.fillStyle = K.sombrero;
    if (sombrero === 'gorra') {
      ctx.beginPath(); ctx.moveTo(-16, -9); ctx.quadraticCurveTo(-16, -27, 0, -27); ctx.quadraticCurveTo(16, -27, 16, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -10); ctx.quadraticCurveTo(22, -12, 30, -7); ctx.lineTo(14, -6); ctx.closePath(); ctx.fillStyle = oscuro(K.sombrero, .25); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -27, 2.2, 0, 7); ctx.fill(); ctx.stroke();
    } else if (sombrero === 'vaquero') {
      ctx.beginPath(); ctx.moveTo(-12, -14); ctx.quadraticCurveTo(-13, -36, -5, -33); ctx.quadraticCurveTo(0, -29, 5, -33); ctx.quadraticCurveTo(13, -36, 12, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = oscuro(K.sombrero, .45); ctx.fillRect(-12, -19, 24, 4);
      ctx.fillStyle = K.sombrero; ctx.beginPath(); ctx.ellipse(0, -14, 30, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-30, -14); ctx.quadraticCurveTo(-28, -20, -24, -19); ctx.moveTo(30, -14); ctx.quadraticCurveTo(28, -20, 24, -19); ctx.stroke();
    } else if (sombrero === 'corona') {
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.moveTo(-13, -17); ctx.lineTo(-15, -33); ctx.lineTo(-7, -25); ctx.lineTo(0, -36); ctx.lineTo(7, -25); ctx.lineTo(15, -33); ctx.lineTo(13, -17); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const [gx, gy, gc] of [[-7, -21, '#e2304a'], [0, -22, '#3a6fd8'], [7, -21, '#43a35a']]) { ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(gx, gy, 2.2, 0, 7); ctx.fill(); }
    } else if (sombrero === 'vikingo') {
      ctx.fillStyle = '#f4ecd6';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 13, -14); ctx.quadraticCurveTo(s * 30, -16, s * 27, -38); ctx.quadraticCurveTo(s * 22, -22, s * 11, -22); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#9aa4ae'; ctx.beginPath(); ctx.moveTo(-16, -8); ctx.quadraticCurveTo(-16, -30, 0, -30); ctx.quadraticCurveTo(16, -30, 16, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K.sombrero; ctx.fillRect(-16, -12, 32, 4); ctx.strokeRect(-16, -12, 32, 4);
      ctx.fillRect(-2, -30, 4, 18);
    } else if (sombrero === 'chupalla' || sombrero === 'paja') {
      // Chupalla: copa baja y plana con cinta del color elegido. Paja (Luffy): copa redonda con cinta roja.
      const paja = '#e9c873', hebra = '#b8913f', cinta = sombrero === 'paja' ? '#d63a2f' : K.sombrero;
      ctx.fillStyle = paja;
      ctx.beginPath(); ctx.ellipse(0, -14, sombrero === 'paja' ? 30 : 33, 5.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      if (sombrero === 'paja') { ctx.moveTo(-14, -15); ctx.quadraticCurveTo(-15, -34, 0, -34); ctx.quadraticCurveTo(15, -34, 14, -15); }
      else { ctx.moveTo(-13, -15); ctx.lineTo(-11.5, -29); ctx.quadraticCurveTo(0, -31, 11.5, -29); ctx.lineTo(13, -15); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cinta; ctx.beginPath(); ctx.rect(-13.6, -21, 27.2, 5); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = hebra;
      for (let x = -26; x <= 26; x += 6) { ctx.beginPath(); ctx.moveTo(x, -16); ctx.lineTo(x * 1.08, -12.5); ctx.stroke(); }
      ctx.restore();
    } else if (sombrero === 'lana') {
      ctx.beginPath(); ctx.moveTo(-15, -10); ctx.quadraticCurveTo(-16, -33, 0, -33); ctx.quadraticCurveTo(16, -33, 15, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = oscuro(K.sombrero, .2); ctx.beginPath(); ctx.rect(-16.5, -14, 33, 7); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = oscuro(K.sombrero, .4); for (let x = -13; x <= 13; x += 4) { ctx.beginPath(); ctx.moveTo(x, -13); ctx.lineTo(x, -8); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -35, 5, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // Retrato en pose quieta: menú, editor, turno, podio.
  const POSE_P = Float64Array.from(M.POSE.flat());
  function retrato(cv, asp, w, h, P, bul) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = w || cv.width; h = h || cv.height;
    if (cv.dataset.w !== String(w) || cv.dataset.dpr !== String(dpr)) {
      cv.dataset.w = String(w); cv.dataset.dpr = String(dpr);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    P = P || POSE_P;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < M.N; i++) { x0 = Math.min(x0, P[i * 2]); x1 = Math.max(x1, P[i * 2]); y0 = Math.min(y0, P[i * 2 + 1]); y1 = Math.max(y1, P[i * 2 + 1]); }
    x0 -= 40; x1 += 40; y0 -= 44; y1 += 10;
    const s = Math.min(w / (x1 - x0), h / (y1 - y0)) * dpr;
    ctx.setTransform(s, 0, 0, s, cv.width / 2 - (x0 + x1) / 2 * s, cv.height / 2 - (y0 + y1) / 2 * s);
    dibujaTulon(ctx, P, bul || { x: 0, y: M.largoBulto(asp) }, asp, {});
  }

  /* ---------------- escenario ---------------- */
  const escenario = $('escenario'), lienzo = $('lienzo'), ctx = lienzo.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function ajustaPantalla() {
    try { const t = window.top; document.documentElement.style.setProperty('--alto-pantalla', t.innerHeight + 'px'); } catch (e) { document.documentElement.style.setProperty('--alto-pantalla', window.innerHeight + 'px'); }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = escenario.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
  }
  window.addEventListener('resize', ajustaPantalla);
  window.addEventListener('orientationchange', () => setTimeout(ajustaPantalla, 200));
  if (window.ResizeObserver) new ResizeObserver(ajustaPantalla).observe(escenario);
  ajustaPantalla();

  const cam = { x: 0, y: -156 };
  const nubes = Array.from({ length: 7 }, (_, i) => ({ x: -900 + i * 330 + (i * 97) % 120, y: -380 - (i * 53) % 220, s: .7 + (i % 3) * .25 }));

  function dibujaCabra(ctx) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = TINTA; ctx.lineWidth = 2.5;
    const piel = '#e9e2d0', sombra = '#cfc5ad';
    // Patas traseras de fondo.
    for (const x of [-30, 30]) { ctx.fillStyle = sombra; huso(ctx, x, -70, x, -6, 7, 6.5, 5.5); ctx.fillStyle = '#3a2f28'; ctx.fillRect(x - 6, -8, 12, 8); ctx.strokeRect(x - 6, -8, 12, 8); }
    // Cola.
    ctx.fillStyle = piel; ctx.beginPath(); ctx.moveTo(-80, -112); ctx.quadraticCurveTo(-98, -124, -92, -104); ctx.quadraticCurveTo(-88, -98, -80, -100); ctx.fill(); ctx.stroke();
    // Cuerpo.
    elipse(ctx, -2, -92, 85, 32, 0, piel);
    ctx.save(); ctx.beginPath(); ctx.ellipse(-2, -92, 85, 32, 0, 0, 7); ctx.clip();
    ctx.fillStyle = sombra; ctx.beginPath(); ctx.ellipse(-2, -62, 90, 18, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#a99d84';
    for (const [x, y] of [[-50, -100], [-25, -108], [5, -104], [-40, -82], [-10, -86], [20, -90], [40, -100]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y + 5, x + 2, y + 10); ctx.stroke(); }
    ctx.restore();
    // Patas delanteras.
    for (const x of [-48, 45]) { ctx.fillStyle = piel; huso(ctx, x, -70, x, -6, 7.5, 7, 5.5); ctx.fillStyle = '#3a2f28'; ctx.fillRect(x - 6.5, -8, 13, 8); ctx.strokeRect(x - 6.5, -8, 13, 8); }
    // Cuello y cabeza.
    ctx.fillStyle = piel; huso(ctx, 52, -100, 80, -138, 17, 16, 14);
    ctx.beginPath(); ctx.moveTo(78, -158); ctx.quadraticCurveTo(100, -162, 113, -132); ctx.quadraticCurveTo(116, -122, 106, -120); ctx.quadraticCurveTo(90, -122, 76, -134); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Barba de chivo.
    ctx.fillStyle = '#d6cbb1'; ctx.beginPath(); ctx.moveTo(98, -121); ctx.lineTo(106, -121); ctx.lineTo(101, -103); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Cuernos.
    ctx.fillStyle = '#8b7a62'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, -156); ctx.quadraticCurveTo(68, -176, 58, -172); ctx.quadraticCurveTo(70, -168, 86, -152); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(90, -158); ctx.quadraticCurveTo(96, -182, 88, -186); ctx.quadraticCurveTo(102, -180, 96, -155); ctx.fill(); ctx.stroke();
    // Oreja, ojo, hocico.
    ctx.fillStyle = sombra; ctx.lineWidth = 2.5; elipse(ctx, 76, -146, 11, 5, .5, null); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5d76e'; elipse(ctx, 95, -144, 4.5, 4, 0, null); ctx.fill(); ctx.stroke();
    ctx.fillStyle = TINTA; ctx.fillRect(92.5, -145, 5, 2);
    ctx.beginPath(); ctx.arc(110, -129, 1.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function render(dt) {
    const s = H / 520;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Cielo.
    const g = ctx.createLinearGradient(0, 0, 0, lienzo.height);
    g.addColorStop(0, '#4fa8e8'); g.addColorStop(1, '#bfe6ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    const S = s * dpr, ox = W / 2 * dpr, oy = H * .55 * dpr;
    const aPantalla = (wx, wy, par) => [(wx - cam.x * par) * S + ox, (wy - cam.y * par) * S + oy];
    // Nubes y colinas con paralaje.
    ctx.fillStyle = '#ffffffd0';
    for (const n of nubes) {
      const [x, y] = aPantalla(n.x, n.y, .3), r = 28 * n.s * S;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r * 1.1, y + r * .2, r * .8, 0, 7); ctx.arc(x - r * 1.1, y + r * .3, r * .7, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#8fcf72';
    ctx.beginPath(); { const [x, y] = aPantalla(-1400, 0, .3); ctx.moveTo(x, y); }
    for (let wx = -1400; wx <= 1400; wx += 50) { const [x, y] = aPantalla(wx, -60 - 45 * Math.sin(wx / 230) - 25 * Math.sin(wx / 97), .3); ctx.lineTo(x, y); }
    { const [x] = aPantalla(1400, 0, .3); ctx.lineTo(x, lienzo.height); const [x2] = aPantalla(-1400, 0, .3); ctx.lineTo(x2, lienzo.height); }
    ctx.fill();

    ctx.setTransform(S, 0, 0, S, ox - cam.x * S, oy - cam.y * S);
    // Suelo.
    ctx.fillStyle = '#6dbb4f'; ctx.fillRect(-3000, 0, 6000, 2000);
    ctx.fillStyle = '#58a33d'; ctx.fillRect(-3000, 0, 6000, 6);
    ctx.strokeStyle = '#4a8e33'; ctx.lineWidth = 2;
    for (let x = -1500; x < 1500; x += 37) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 3, -7); ctx.moveTo(x + 4, 0); ctx.lineTo(x + 6, -6); ctx.stroke(); }
    // Regla de metros.
    const tope = mundoW ? M.alturaMundo(mundoW) : 1.81;
    ctx.save(); ctx.fillStyle = '#fff8e0'; ctx.strokeStyle = TINTA; ctx.lineWidth = 2;
    const altoRegla = Math.max(4, Math.ceil(tope + 2)) * 100;
    ctx.fillRect(250, -altoRegla, 18, altoRegla); ctx.strokeRect(250, -altoRegla, 18, altoRegla);
    ctx.font = '16px "Lilita One", sans-serif'; ctx.fillStyle = TINTA;
    for (let m = 0; m * 100 <= altoRegla; m += .25) {
      const y = -m * 100, ent = Math.abs(m - Math.round(m)) < 1e-6;
      ctx.beginPath(); ctx.moveTo(250, y); ctx.lineTo(ent ? 268 : 258, y); ctx.stroke();
      if (ent && m > 0) ctx.fillText(m + ' m', 274, y + 6);
    }
    ctx.restore();
    // Línea del tope.
    ctx.save(); ctx.strokeStyle = '#e2483d'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(-400, -tope * 100); ctx.lineTo(300, -tope * 100); ctx.stroke(); ctx.restore();
    // Línea fantasma: lo más alto que llegó el que trepa, en cuanto pasa la roja.
    if (cuerpo && maxTurno > tope) {
      const yf = -maxTurno * 100;
      ctx.save(); ctx.globalAlpha = .75; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(-400, yf); ctx.lineTo(250, yf); ctx.stroke();
      ctx.setLineDash([]); ctx.font = '15px "Lilita One", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = TINTA; ctx.lineWidth = 3;
      ctx.strokeText('máx ' + fmt(maxTurno), 160, yf - 6); ctx.fillText('máx ' + fmt(maxTurno), 160, yf - 6);
      ctx.restore();
    }

    dibujaCabra(ctx);
    if (mundoW) for (const f of mundoW.torre) dibujaTulon(ctx, f.p, f.bulto, f.aspecto, { helada: true, cara: 'helado' });
    if (cuerpo) {
      const P = cuerpo.p, vy = (P[I.pelvis * 2 + 1] - cuerpo.q[I.pelvis * 2 + 1]) / M.DT;
      const agarrado = cuerpo.pin.some(Boolean) && cuerpo.held.some((h, k) => h && cuerpo.pin[k]);
      const cara = vy > 450 ? 'miedo' : agarrado ? 'esfuerzo' : 'normal';
      // Mira hacia el último miembro sostenido, o al frente.
      let mira = null; const k = cuerpo.held.findIndex(Boolean);
      if (k >= 0) { const e = M.MIEMBROS[k].ext; mira = [P[e * 2], P[e * 2 + 1]]; }
      dibujaTulon(ctx, P, cuerpo.bulto, cuerpo.aspecto, { held: cuerpo.held, pin: cuerpo.pin, cara, mira });
    }
    if (traza.on) pintaTraza(ctx);
  }

  /* ---------------- jugadores ---------------- */
  let jugadores = (lee(clave('tulones.jugadores'), null) || [M.PRESETS[0], M.PRESETS[1]]).slice(0, 8).map(M.limpia);
  if (!jugadores.length) jugadores = [M.limpia(M.PRESETS[0])];
  const guardaJug = () => guarda(clave('tulones.jugadores'), jugadores);
  let record = lee(clave('tulones.record'), 0);
  const fmt = m => (Number.isFinite(m) ? m : 0).toFixed(2).replace('.', ',') + ' m';

  function pintaLista() {
    const L = $('listaJug'); L.textContent = '';
    jugadores.forEach((j, i) => {
      const d = document.createElement('div'); d.className = 'jug';
      const cv = document.createElement('canvas'); d.appendChild(cv);
      const b = document.createElement('b'); b.textContent = j.nombre; b.translate = false; b.setAttribute('translate', 'no'); d.appendChild(b);
      const acc = document.createElement('div'); acc.className = 'acc';
      const ed = document.createElement('button'); ed.type = 'button'; ed.textContent = '✎'; ed.title = 'Cambiar aspecto'; ed.setAttribute('aria-label', 'Editar a ' + j.nombre);
      ed.addEventListener('click', () => abreEditor(i));
      acc.appendChild(ed);
      if (jugadores.length > 1) {
        const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.title = 'Quitar'; x.setAttribute('aria-label', 'Quitar a ' + j.nombre);
        x.addEventListener('click', () => { jugadores.splice(i, 1); guardaJug(); pintaLista(); });
        acc.appendChild(x);
      }
      d.appendChild(acc);
      L.appendChild(d);
      retrato(cv, j, 64, 80);
    });
    $('btnMas').disabled = jugadores.length >= 8;
    $('nRecord').textContent = record > 0 ? fmt(record) : '—';
  }
  $('btnMas').addEventListener('click', () => {
    if (jugadores.length >= 8) return;
    const usados = new Set(jugadores.map(j => j.nombre));
    const p = M.PRESETS.find(x => !usados.has(x.nombre));
    jugadores.push(M.limpia(p || M.aleatorio(Math.random, 'Tulón ' + (jugadores.length + 1))));
    guardaJug(); pintaLista();
  });

  /* ---------------- editor ---------------- */
  const NOMBRES = {
    piel: 'Piel', pelo: 'Pelo', colorPelo: 'Color de pelo', barba: 'Barba', calzon: 'Calzón', colorCalzon: 'Color del calzón',
    calcetines: 'Calcetines', colorCalcetin: 'Color de calcetines', sombrero: 'Sombrero', colorSombrero: 'Color del sombrero', fisico: 'Físico',
    tamano: 'Tamaño'
  };
  const BONITO = {
    tupe: 'tupé', boxer: 'bóxer', flaco: 'flacuchento', panzon: 'guatón', fornido: 'mamado', ninguna: 'sin barba', ninguno: 'nada', lana: 'gorro chilote',
    chupalla: 'chupalla', paja: 'de paja (Luffy)', chilena: 'bandera chilena', anaconda: 'Anaconda'
  };
  // Lo que el editor ya no muestra (queda fijo en M.FIJOS).
  const EDITABLES = M.CAMPOS.filter(k => !(k in M.FIJOS));
  const editor = $('editor');
  let editando = -1, borrador = null;
  function pintaEditor() {
    retrato($('edLienzo'), borrador, 220, 300);
    const cont = $('edCampos'); cont.textContent = '';
    for (const k of EDITABLES) {
      const fila = document.createElement('div'); fila.className = 'ed-campo';
      const et = document.createElement('span'); et.textContent = NOMBRES[k]; fila.appendChild(et);
      const lista = C[k];
      if (/^#/.test(lista[0])) {
        const m = document.createElement('div'); m.className = 'muestras'; m.setAttribute('role', 'group'); m.setAttribute('aria-label', NOMBRES[k]);
        lista.forEach((col, i) => {
          const b = document.createElement('button'); b.type = 'button';
          b.style.background = col === 'chilena' ? 'linear-gradient(#fff 50%, #d52b1e 50%)' : col;
          if (col === 'chilena') b.title = 'Bandera chilena';
          b.setAttribute('aria-pressed', String(borrador[k] === i)); b.setAttribute('aria-label', NOMBRES[k] + ' ' + (i + 1));
          b.addEventListener('click', () => { borrador[k] = i; pintaEditor(); });
          m.appendChild(b);
        });
        fila.appendChild(m);
      } else {
        const c = document.createElement('div'); c.className = 'ciclo';
        const menos = document.createElement('button'); menos.type = 'button'; menos.textContent = '‹'; menos.setAttribute('aria-label', NOMBRES[k] + ' anterior');
        const mas = document.createElement('button'); mas.type = 'button'; mas.textContent = '›'; mas.setAttribute('aria-label', NOMBRES[k] + ' siguiente');
        const v = document.createElement('b'); v.textContent = BONITO[lista[borrador[k]]] || lista[borrador[k]];
        menos.addEventListener('click', () => { borrador[k] = (borrador[k] + lista.length - 1) % lista.length; pintaEditor(); });
        mas.addEventListener('click', () => { borrador[k] = (borrador[k] + 1) % lista.length; pintaEditor(); });
        c.append(menos, v, mas); fila.appendChild(c);
      }
      cont.appendChild(fila);
    }
  }
  function abreEditor(i) {
    editando = i; borrador = M.limpia(jugadores[i]);
    $('edNombre').value = borrador.nombre;
    const pr = $('edPresets'); pr.textContent = '';
    M.PRESETS.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.textContent = p.nombre; b.setAttribute('translate', 'no');
      b.addEventListener('click', () => { const n = $('edNombre').value; borrador = M.limpia(Object.assign({}, p, { nombre: n || p.nombre })); pintaEditor(); });
      pr.appendChild(b);
    });
    pintaEditor();
    editor.returnValue = '';
    if (editor.showModal) editor.showModal(); else editor.setAttribute('open', '');
  }
  $('edAzar').addEventListener('click', () => { borrador = M.aleatorio(Math.random, $('edNombre').value || borrador.nombre); pintaEditor(); });
  $('edNombre').addEventListener('input', () => { borrador.nombre = $('edNombre').value; });
  editor.addEventListener('close', () => {
    if (editor.returnValue === 'ok' && editando >= 0) {
      borrador.nombre = $('edNombre').value.trim() || borrador.nombre;
      jugadores[editando] = M.limpia(borrador); guardaJug();
    }
    editando = -1; pintaLista();
  });

  /* ---------------- partida ---------------- */
  let estado = 'menu', pausado = false, mundoW = null, cuerpo = null;
  let turnoN = 0, ronda = 1, rondas = 5, segTurno = 45, quedan = 0, mejores = [], ultTic = -1;
  // Reglas: cada turno hay que pasar la línea roja (la torre al empezar el turno). Quien no la pasa queda
  // eliminado. Con varios jugadores gana el último en pie; jugando solo, se sigue hasta fallar. maxTurno es lo más alto del que trepa ahora (línea fantasma).
  let vivos = [], meta = 0, maxTurno = 0, aviso = '';
  const SUPERA_MIN = .01;
  const capas = { menu: $('menu'), turno: $('turno'), pausa: $('pausa'), fin: $('fin') };
  function muestra(nombre) { for (const k in capas) capas[k].hidden = k !== nombre; }
  const tactil = $('tactil');
  const grueso = window.matchMedia ? window.matchMedia('(pointer:coarse)') : null;
  function inmersivo(on) { if (Club && Club.inmersivo) { try { Club.inmersivo(on); } catch (e) { /* nada */ } } }

  function empezar() {
    segTurno = +$('selTiempo').value || 45; rondas = +$('selRondas').value; if (!Number.isFinite(rondas)) rondas = 5;
    mundoW = M.mundo(); turnoN = 0; ronda = 1; mejores = jugadores.map(() => 0); cuerpo = null;
    vivos = jugadores.map(() => true); aviso = '';
    cam.x = 0; cam.y = -156;
    preparaTurno();
  }
  const actual = () => jugadores[turnoN % jugadores.length];
  function preparaTurno() {
    estado = 'turno'; pausado = false; inmersivo(false); soltarTodo();
    if (document.pointerLockElement) document.exitPointerLock();
    const j = actual();
    retrato($('retrato'), j, 160, 200);
    $('turnoNombre').textContent = j.nombre;
    meta = M.alturaMundo(mundoW); maxTurno = 0;
    $('turnoFrase').textContent = (rondas ? 'Ronda ' + ronda + ' de ' + rondas : 'Ronda ' + ronda) + ' · supera ' + fmt(meta);
    $('turnoAviso').textContent = aviso; $('turnoAviso').hidden = !aviso;
    $('nQuien').textContent = j.nombre;
    $('nTiempo').textContent = segTurno + ' s'; $('nTiempo').classList.remove('apura');
    $('nAltura').textContent = fmt(0);
    $('nTorre').textContent = fmt(M.alturaMundo(mundoW));
    muestra('turno');
    sonido.fanfarria();
    setTimeout(() => $('btnListo').focus(), 50);
  }
  function seg(ax, ay, bx, by, x, y) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  }
  function choca(c) {
    for (let i = 0; i < M.N; i++) {
      const x = c.p[i * 2], y = c.p[i * 2 + 1];
      for (const s of mundoW.caps) if (seg(s.ax, s.ay, s.bx, s.by, x, y) < s.r + M.RADIO[i]) return true;
    }
    return false;
  }
  const CAIDA = 60;
  function saleTulon() {
    let c = null;
    for (let t = 0; t < 8; t++) { c = M.crea(-200 - t * 120, actual()); if (!choca(c)) break; c = null; }
    if (c) for (let i = 0; i < M.N; i++) { c.p[i * 2 + 1] -= CAIDA; c.q[i * 2 + 1] -= CAIDA; }
    if (!c) {
      c = M.crea(-200, actual());
      const sube = M.alturaMundo(mundoW) * 100 + 20;
      for (let i = 0; i < M.N; i++) { c.p[i * 2 + 1] -= sube; c.q[i * 2 + 1] -= sube; }
    }
    c.alAgarrar = () => sonido.agarra();
    return c;
  }
  function arranca() {
    cuerpo = saleTulon(); traza.puntos = []; traza.registro = []; if (traza.on) empiezaGrabacion(); quedan = segTurno; ultTic = -1; acum = 0;
    estado = 'jugando'; muestra(null); inmersivo(true);
    escenario.focus({ preventScroll: true });
  }
  function terminaTurno() {
    if (estado !== 'jugando') return;
    soltarTodo();
    const i = turnoN % jugadores.length, j = jugadores[i];
    const h = cuerpo && M.valido(cuerpo) ? M.altura(cuerpo) : 0;
    if (cuerpo && M.valido(cuerpo)) {
      M.congela(cuerpo, mundoW);
      mejores[i] = Math.max(mejores[i], h);
      sonido.congela();
    }
    cuerpo = null;
    if (h > meta + SUPERA_MIN) aviso = '';
    else { vivos[i] = false; aviso = j.nombre + ' no superó ' + fmt(meta) + ': eliminado'; }
    const enPie = vivos.filter(Boolean).length;
    if (!enPie) return terminaPartida({ nadie: true });
    if (jugadores.length > 1 && enPie === 1) return terminaPartida({ ganador: vivos.indexOf(true) });
    do { turnoN++; if (turnoN % jugadores.length === 0) ronda++; } while (!vivos[turnoN % jugadores.length]);
    if (rondas && ronda > rondas) return terminaPartida({});
    preparaTurno();
  }
  function terminaPartida(fin) {
    fin = fin || {};
    estado = 'fin'; pausado = false; inmersivo(false); soltarTodo(); cuerpo = null;
    if (document.pointerLockElement) document.exitPointerLock();
    const torre = mundoW ? M.alturaMundo(mundoW) : 0;
    const nuevo = mundoW && mundoW.torre.length > 0 && torre > record;
    if (nuevo) { record = torre; guarda(clave('tulones.record'), record); }
    $('finTorre').textContent = fmt(torre); $('finNuevo').hidden = !nuevo;
    const gana = fin.ganador != null ? jugadores[fin.ganador] : null;
    $('finTitulo').textContent = gana ? '¡GANA ' + gana.nombre.toUpperCase() + '!' : fin.nadie ? 'NADIE SUPERÓ LA TORRE' : '¡TORRE TERMINADA!';
    const L = $('finLista'); L.textContent = '';
    jugadores.map((j, i) => ({ j, h: mejores[i] || 0, fuera: vivos[i] === false, gana: i === fin.ganador }))
      .sort((a, b) => (b.gana - a.gana) || (b.h - a.h)).forEach((o, n) => {
      const li = document.createElement('li');
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = (n + 1) + '.';
      const cv = document.createElement('canvas');
      const nom = document.createElement('span'); nom.className = 'nom'; nom.textContent = o.j.nombre; nom.setAttribute('translate', 'no');
      const alt = document.createElement('span'); alt.className = 'alt'; alt.textContent = (o.gana ? '🏆 ' : '') + fmt(o.h) + (o.fuera ? ' ✕' : ''); alt.setAttribute('translate', 'no');
      if (o.fuera) li.classList.add('fuera');
      li.append(pos, cv, nom, alt); L.appendChild(li);
      retrato(cv, o.j, 44, 55);
    });
    muestra('fin'); sonido.fin();
  }
  function pausa(on) {
    if (estado !== 'jugando') return;
    pausado = on; capas.pausa.hidden = !on; inmersivo(!on);
    if (on) { soltarTodo(); if (document.pointerLockElement) document.exitPointerLock(); $('btnSeguir').focus(); }
    else escenario.focus({ preventScroll: true });
  }
  function aMenu() {
    estado = 'menu'; pausado = false; cuerpo = null; inmersivo(false); soltarTodo();
    if (document.pointerLockElement) document.exitPointerLock();
    muestra('menu'); pintaLista();
  }

  $('btnJugar').addEventListener('click', () => { audio(); empezar(); });
  $('btnListo').addEventListener('click', () => { audio(); arranca(); });
  $('btnPausa').addEventListener('click', () => pausa(!pausado));
  $('btnSeguir').addEventListener('click', () => pausa(false));
  $('btnSalir').addEventListener('click', () => { pausado = false; capas.pausa.hidden = true; terminaPartida(); });
  $('btnOtra').addEventListener('click', () => empezar());
  $('btnMenu').addEventListener('click', aMenu);
  $('btnCongela').addEventListener('click', terminaTurno);

  /* ---------------- controles ---------------- */
  let teclas = M.limpiaTeclas(lee(clave('tulones.teclas'), null)), mapaTeclado = null, TECLA = {};
  const NOMBRE_ACCION = { 0: 'Brazo izquierdo', 1: 'Brazo derecho', 2: 'Pierna izquierda', 3: 'Pierna derecha', congela: 'Congelar ya', pausa: 'Pausa' };
  const nombre = code => M.nombreTecla(code, mapaTeclado);
  function aplicaTeclas() {
    TECLA = {};
    for (let k = 0; k < 4; k++) TECLA[teclas[k]] = k;
    document.querySelectorAll('.miembro').forEach(b => { b.querySelector('small').textContent = nombre(teclas[b.dataset.k]); });
    const nota = $('nota'), kbd = t => { const e = document.createElement('kbd'); e.textContent = nombre(t); e.setAttribute('translate', 'no'); return e; };
    nota.textContent = '';
    nota.append('Mantén ', kbd(teclas[0]), ' ', kbd(teclas[1]), ' (brazos) o ', kbd(teclas[2]), ' ', kbd(teclas[3]),
      ' (piernas) y mueve el ratón. Lo que toca algo se agarra; con todo agarrado, el ratón hacia abajo te sube. ',
      kbd(teclas.congela), ' congela antes, ', kbd(teclas.pausa), ' pausa.');
    escenario.setAttribute('aria-label', 'El escenario. Mantén ' + [0, 1, 2, 3].map(k => nombre(teclas[k])).join(', ') + ' para mover un brazo o una pierna y mueve el ratón para llevarlo.');
    configuraMando();
  }
  const flechas = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
  const fuentes = [new Set(), new Set(), new Set(), new Set()]; // quién sostiene cada miembro
  function sostener(k, quien, on) {
    const f = fuentes[k];
    if (on) f.add(quien); else f.delete(quien);
    if (cuerpo && estado === 'jugando' && !pausado) { const h = f.size > 0; if (h !== cuerpo.held[k]) M.sostiene(cuerpo, k, h); }
    pintaBotones();
  }
  function soltarTodo() {
    fuentes.forEach(f => f.clear());
    if (cuerpo) for (let k = 0; k < 4; k++) if (cuerpo.held[k]) M.sostiene(cuerpo, k, false);
    for (const k in flechas) flechas[k] = false;
    pintaBotones();
  }
  const botones = Array.from(document.querySelectorAll('.miembro'));
  function pintaBotones() {
    for (const b of botones) {
      const k = +b.dataset.k;
      b.classList.toggle('activo', !!(cuerpo && cuerpo.held[k]));
      b.classList.toggle('agarra', !!(cuerpo && cuerpo.pin[k]));
    }
  }
  const jugando = () => estado === 'jugando' && !pausado;

  window.addEventListener('keydown', e => {
    if (editor.open || dlgTeclas.open || dlgNovedades.open) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.code in TECLA) { if (!e.repeat && jugando()) sostener(TECLA[e.code], 'tec', true); e.preventDefault(); return; }
    if (e.code in flechas) { if (jugando()) { flechas[e.code] = true; e.preventDefault(); } return; }
    if (e.code === teclas.congela) { if (jugando()) { e.preventDefault(); if (!e.repeat) terminaTurno(); } return; }
    if (e.code === 'KeyF' && !Object.values(teclas).includes('KeyF')) { e.preventDefault(); pantallaCompleta(); return; }
    if (e.code === teclas.pausa || e.code === 'Escape') { if (estado === 'jugando') { e.preventDefault(); pausa(!pausado); } }
  });
  window.addEventListener('keyup', e => {
    if (e.code in TECLA) sostener(TECLA[e.code], 'tec', false);
    if (e.code in flechas) flechas[e.code] = false;
  });
  window.addEventListener('blur', () => { if (estado === 'jugando') soltarTodo(); });
  // La rueda sobre el escenario no mueve la página.
  escenario.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  /* ---------------- pantalla completa ---------------- */
  async function pantallaCompleta() {
    try {
      // La página entera, no solo el escenario: así el marcador (tiempo, altura, pausa) sigue a la vista.
      const raiz = document.documentElement;
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (raiz.requestFullscreen) await raiz.requestFullscreen();
      else if (raiz.webkitRequestFullscreen) raiz.webkitRequestFullscreen();
    } catch (e) { /* el navegador no la deja */ }
    escenario.focus({ preventScroll: true });
  }
  $('btnPantalla').addEventListener('click', pantallaCompleta);
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    $('btnPantalla').setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
    $('btnPantalla').textContent = on ? '🗗' : '⛶';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'jugando' && !pausado) pausa(true); });

  const escala = () => H / 520;
  // Ratón: el movimiento lleva lo sostenido.
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !jugando() || !cuerpo) return;
    const s = escala();
    M.empujaMiembros(cuerpo, (e.movementX || 0) / s, (e.movementY || 0) / s);
  });
  escenario.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && jugando() && !document.pointerLockElement && escenario.requestPointerLock) {
      try { const r = escenario.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (er) { /* sin bloqueo */ }
    }
  });
  // Táctil: los botones sostienen; arrastrar en el escenario lleva.
  for (const b of botones) {
    const k = +b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } audio(); sostener(k, 'p' + e.pointerId, true); });
    const suelta = e => sostener(k, 'p' + e.pointerId, false);
    b.addEventListener('pointerup', suelta); b.addEventListener('pointercancel', suelta); b.addEventListener('lostpointercapture', suelta);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  const dedos = new Map();
  lienzo.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { dedos.set(e.pointerId, [e.clientX, e.clientY]); try { lienzo.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } } });
  lienzo.addEventListener('pointermove', e => {
    const d = dedos.get(e.pointerId); if (!d) return;
    const dx = e.clientX - d[0], dy = e.clientY - d[1]; d[0] = e.clientX; d[1] = e.clientY;
    if (jugando() && cuerpo) { const s = escala(); M.empujaMiembros(cuerpo, dx * 1.3 / s, dy * 1.3 / s); }
  });
  const quitaDedo = e => dedos.delete(e.pointerId);
  lienzo.addEventListener('pointerup', quitaDedo); lienzo.addEventListener('pointercancel', quitaDedo);
  function pintaTactil() { tactil.hidden = !(grueso && grueso.matches); }
  if (grueso && grueso.addEventListener) grueso.addEventListener('change', pintaTactil);
  pintaTactil();

  // Mando: botones como teclas, stick izquierdo para llevar. Sigue a las teclas que eligió el jugador.
  function configuraMando() {
    if (!window.Mando || !window.Mando.configura) return;
    window.Mando.configura({
      botones: { a: teclas.congela, start: teclas.pausa, lb: teclas[0], rb: teclas[1], lt: teclas[2], rt: teclas[3] },
      objetivo: () => escenario,
      menu: () => estado !== 'jugando' || pausado,
      inicio: () => (estado === 'menu' ? $('btnJugar') : estado === 'turno' ? $('btnListo') : estado === 'fin' ? $('btnOtra') : $('btnSeguir')),
      pistas: [['lb', 'Brazo izq.'], ['rb', 'Brazo der.'], ['lt', 'Pierna izq.'], ['rt', 'Pierna der.'], ['ls', 'Llevar'], ['a', 'Congelar'], ['start', 'Pausa']],
      zonas: [{ sel: '#nota' }]
    });
  }

  /* ---------------- reasignar teclas ---------------- */
  const dlgTeclas = $('teclas');
  let esperando = null;
  function pintaTeclas(foco) {
    const L = $('tcLista'); L.textContent = '';
    for (const a of M.ACCIONES) {
      const fila = document.createElement('div'); fila.className = 'tc-fila';
      const et = document.createElement('span'); et.textContent = NOMBRE_ACCION[a];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-tecla'; b.setAttribute('translate', 'no');
      b.textContent = esperando === a ? '…' : nombre(teclas[a]);
      b.setAttribute('aria-pressed', String(esperando === a));
      b.setAttribute('aria-label', NOMBRE_ACCION[a] + ': ' + (esperando === a ? 'pulsa una tecla' : nombre(teclas[a])));
      b.addEventListener('click', () => { esperando = esperando === a ? null : a; pintaTeclas(a); });
      fila.append(et, b); L.appendChild(fila);
      if (a === foco) b.focus();
    }
  }
  function guardaTeclas(nuevas) { teclas = M.limpiaTeclas(nuevas); guarda(clave('tulones.teclas'), teclas); aplicaTeclas(); }
  $('btnTeclas').addEventListener('click', () => {
    esperando = null; pintaTeclas();
    if (dlgTeclas.showModal) dlgTeclas.showModal(); else dlgTeclas.setAttribute('open', '');
  });
  $('tcFabrica').addEventListener('click', () => { esperando = null; guardaTeclas(M.TECLAS); pintaTeclas(); });
  window.addEventListener('keydown', e => {
    if (!dlgTeclas.open || esperando === null) return;
    e.preventDefault(); e.stopPropagation();
    const a = esperando;
    if (e.code !== 'Escape' && M.teclaValida(e.code)) guardaTeclas(M.asignaTecla(teclas, a, e.code));
    esperando = null; pintaTeclas(a);
  }, true);
  dlgTeclas.addEventListener('cancel', e => { if (esperando !== null) e.preventDefault(); });
  dlgTeclas.addEventListener('close', () => { esperando = null; });
  if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
    navigator.keyboard.getLayoutMap().then(m => { mapaTeclado = m; aplicaTeclas(); if (dlgTeclas.open) pintaTeclas(); }).catch(() => {});
  }
  aplicaTeclas();

  /* ---------------- traza (depuración: ?traza en la URL) ---------------- */
  const ZONA_X = 150, ZONA_Y = 70;
  function centro(c) { let x = 0, y = 0; for (let i = 0; i < M.N; i++) { x += c.p[i * 2]; y += c.p[i * 2 + 1]; } return [x / M.N, y / M.N]; }
  // Herramientas de desarrollo (traza, grabación de partidas, copiar/descargar). Apagadas: ponerlo en true y abrir
  // la página con ?traza para usarlas.
  const DESARROLLO = false;
  const traza = { on: DESARROLLO && /[?&]traza\b/.test(location.search), puntos: [], registro: [], ultAviso: -1, partida: [], turno: null, pendiente: [] };
  /* Grabación para repetir la partida en Node: el mundo y el cuerpo al empezar cada turno, y cada entrada
     (tecla sostenida o soltada, movimiento de ratón/flechas) con el paso de física antes del que llegó. El motor
     es determinista, así que con esto se reproduce exacto. */
  function empiezaGrabacion() {
    traza.turno = {
      turno: turnoN, ronda,
      caps: mundoW.caps.map(s => [s.ax, s.ay, s.bx, s.by, s.r]),
      p: Array.from(cuerpo.p), q: Array.from(cuerpo.q), entradas: [], centro: []
    };
    traza.partida.push(traza.turno); traza.pendiente = [];
  }
  if (traza.on) {
    const sostieneMotor = M.sostiene, empujaMotor = M.empujaMiembros;
    M.sostiene = (c, k, on) => { if (c === cuerpo) traza.pendiente.push(['s', k, on ? 1 : 0]); return sostieneMotor(c, k, on); };
    M.empujaMiembros = (c, dx, dy) => { if (c === cuerpo) traza.pendiente.push(['m', dx, dy]); return empujaMotor(c, dx, dy); };
  }
  // Una muestra por paso de física: centro, velocidad y qué hacía cada miembro. Avisa en consola de los saltos bruscos.
  function anotaTraza() {
    const c = cuerpo, [x, y] = centro(c), ant = traza.puntos[traza.puntos.length - 1];
    const vx = ant ? (x - ant.x) / M.DT : 0, vy = ant ? (y - ant.y) / M.DT : 0;
    traza.puntos.push({ x, y, v: Math.hypot(vx, vy) });
    if (traza.puntos.length > 480) traza.puntos.shift();
    const fila = {
      t: +c.t.toFixed(3), x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy),
      sostiene: c.held.map(Number).join(''), agarra: c.pin.map(p => (p ? 1 : 0)).join(''),
      toca: c.contacto.map((n, i) => (n ? i : -1)).filter(i => i >= 0).join('.'),
      vec: c.vec.map(v => v.map(Math.round).join(',')).join(' ')
    };
    traza.registro.push(fila);
    if (traza.turno) {
      const n = Math.round(c.t / M.DT) - 1;
      if (traza.pendiente.length) { traza.turno.entradas.push([n, traza.pendiente]); traza.pendiente = []; }
      if (n % 12 === 0) traza.turno.centro.push([n, Math.round(x), Math.round(y)]);
    }
    if (traza.registro.length > 6000) traza.registro.shift();
    if (vy < -350 && c.t - traza.ultAviso > .5) {
      traza.ultAviso = c.t;
      fila.aviso = 'despegue';
      console.warn('[tulones] despegue brusco ' + JSON.stringify(fila));
    }
  }
  function pintaTraza(ctx) {
    const pts = traza.puntos;
    ctx.lineWidth = 3;
    for (let i = 1; i < pts.length; i++) {
      const v = Math.min(1, pts[i].v / 600);
      ctx.strokeStyle = 'hsl(' + Math.round(120 - v * 120) + ',90%,45%)';
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    if (!cuerpo) return;
    const P = cuerpo.p, [x, y] = centro(cuerpo);
    ctx.fillStyle = '#e2483d'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
    M.MIEMBROS.forEach((m, k) => {
      const rx = P[m.raiz * 2], ry = P[m.raiz * 2 + 1], v = cuerpo.vec[k];
      if (cuerpo.pin[k]) { ctx.strokeStyle = '#1b8a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cuerpo.pin[k][0], cuerpo.pin[k][1], 11, 0, 7); ctx.stroke(); }
      if (!cuerpo.held[k]) return;
      ctx.strokeStyle = '#7b2ff7'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + v[0], ry + v[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(rx + v[0] - 6, ry + v[1] - 6); ctx.lineTo(rx + v[0] + 6, ry + v[1] + 6);
      ctx.moveTo(rx + v[0] + 6, ry + v[1] - 6); ctx.lineTo(rx + v[0] - 6, ry + v[1] + 6); ctx.stroke();
    });
    ctx.strokeStyle = '#0006'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
    ctx.strokeRect(cam.x - ZONA_X, cam.y - ZONA_Y, ZONA_X * 2, ZONA_Y * 2); ctx.setLineDash([]);
  }

  if (traza.on) {
    $('filaTraza').hidden = false;
    $('btnTraza').addEventListener('click', async () => {
      const b = $('btnTraza');
      try { await navigator.clipboard.writeText(JSON.stringify(traza.registro)); b.dataset.ok = '1'; b.textContent = '✓ Copiada'; }
      catch (e) { b.textContent = '✕ No se pudo: descárgala'; }
      setTimeout(() => { b.textContent = '📋 Copiar traza'; }, 1800);
    });
    $('btnTrazaBaja').addEventListener('click', () => {
      const a = document.createElement('a');
      const datos = { motor: M.VERSION, partida: traza.partida, ultimoTurno: traza.registro };
      a.href = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }));
      a.download = 'tulones-traza.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  /* ---------------- novedades ---------------- */
  // Versión que ve el jugador (la del registro de cambios); M.VERSION es la de compilación, para la caché.
  const VERSION_JUEGO = '0.2';
  const dlgNovedades = $('novedades');
  function pestanaNovedades(prox) {
    $('nvTabCambios').setAttribute('aria-selected', String(!prox)); $('nvTabProx').setAttribute('aria-selected', String(prox));
    $('nvCambios').hidden = prox; $('nvProx').hidden = !prox;
  }
  function abreNovedades() {
    pestanaNovedades(false);
    if (dlgNovedades.showModal) dlgNovedades.showModal(); else dlgNovedades.setAttribute('open', '');
  }
  $('nvTabCambios').addEventListener('click', () => pestanaNovedades(false));
  $('nvTabProx').addEventListener('click', () => pestanaNovedades(true));
  $('btnNovedades').addEventListener('click', abreNovedades);
  dlgNovedades.addEventListener('close', () => guarda(clave('tulones.novedades'), VERSION_JUEGO));
  // Se abre sola una vez por versión.
  if (lee(clave('tulones.novedades'), null) !== VERSION_JUEGO) setTimeout(abreNovedades, 300);

  /* ---------------- bucle ---------------- */
  let acum = 0, antes = performance.now();
  function cuadro(ahora) {
    let dt = (ahora - antes) / 1000; antes = ahora;
    if (!(dt > 0)) dt = 0; dt = Math.min(dt, .1);
    if (jugando() && cuerpo) {
      // Entrada continua: flechas y stick.
      const v = 320 * dt;
      let mx = (flechas.ArrowRight ? 1 : 0) - (flechas.ArrowLeft ? 1 : 0), my = (flechas.ArrowDown ? 1 : 0) - (flechas.ArrowUp ? 1 : 0);
      if (window.Mando && window.Mando.estado) {
        try { const st = window.Mando.estado(); if (st && st.ejes && st.modo !== 'cursor') { if (Math.abs(st.ejes.lx) > .15) mx += st.ejes.lx * 1.4; if (Math.abs(st.ejes.ly) > .15) my += st.ejes.ly * 1.4; } } catch (e) { /* sin mando */ }
      }
      if (mx || my) M.empujaMiembros(cuerpo, mx * v, my * v);
      acum += dt;
      let n = 0;
      while (acum >= M.DT && n < 14) { M.paso(cuerpo, mundoW); if (traza.on) anotaTraza(); acum -= M.DT; n++; }
      if (n >= 14) acum = 0;
      if (!M.valido(cuerpo)) { cuerpo = null; terminaTurno(); }
      else {
        pintaBotones();
        quedan -= dt;
        const s = Math.max(0, Math.ceil(quedan));
        $('nTiempo').textContent = s + ' s';
        $('nTiempo').classList.toggle('apura', quedan <= 5);
        if (quedan <= 5 && s !== ultTic && s > 0) { ultTic = s; sonido.tic(); }
        const alto = M.altura(cuerpo); maxTurno = Math.max(maxTurno, alto);
        $('nAltura').textContent = fmt(alto); $('nAltura').classList.toggle('supera', alto > meta + SUPERA_MIN);
        if (quedan <= 0) terminaTurno();
      }
    }
    // Cámara quieta mientras el tulón está en la zona central; solo se corre, suave, si se acerca al borde.
    if (cuerpo) {
      const [cx, cy] = centro(cuerpo);
      let tx = cam.x, ty = cam.y;
      if (cx > tx + ZONA_X) tx = cx - ZONA_X; else if (cx < tx - ZONA_X) tx = cx + ZONA_X;
      if (cy > ty + ZONA_Y) ty = cy - ZONA_Y; else if (cy < ty - ZONA_Y) ty = cy + ZONA_Y;
      ty = Math.min(ty, -156);
      const a = 1 - Math.exp(-dt * 3);
      cam.x += (tx - cam.x) * a; cam.y += (ty - cam.y) * a;
    } else if (mundoW && estado !== 'menu') {
      const ty = Math.min(-M.alturaMundo(mundoW) * 100 * .6, -156), a = 1 - Math.exp(-dt * 2);
      cam.x += (0 - cam.x) * a; cam.y += (ty - cam.y) * a;
    }
    render(dt);
    requestAnimationFrame(cuadro);
  }

  pintaLista();
  muestra('menu');
  document.querySelector('.logo').textContent = 'TULONES v' + VERSION_JUEGO;
  requestAnimationFrame(cuadro);

  // Para pruebas desde la consola.
  window.__tulones = { estado: () => ({ estado, pausado, turno: turnoN, ronda, torre: mundoW ? M.alturaMundo(mundoW) : 0, altura: cuerpo ? M.altura(cuerpo) : 0 }), retrato,
    registro: () => JSON.stringify(traza.registro), grabacion: () => JSON.stringify({ motor: M.VERSION, partida: traza.partida }), traza: on => { traza.on = on !== false; } };
})();
