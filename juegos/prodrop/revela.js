'use strict';
/* =========================================================
   PRODROP — cómo se revela cada rareza, según la colección
   =========================================================
   El abridor (app.js) da vuelta la carta; esto pone el suspenso de antes
   (`antes`, que termina cuando la carta está por voltearse) y el estallido
   de después (`despues`). Cada colección tiene los suyos:

     Profes       rara: tiza en el pizarrón · épica: salto al hiperespacio
                  legendaria: prisma shiny
     Componentes  rara: traza de osciloscopio · épica: bobina de Tesla
                  legendaria: cortocircuito, con chispazo; luego nieve si
                  es de Navidad, brasas si es Quemada

   Usa lo que ya tiene el abridor (`addParts`, `burst`, `flash`, `aura`,
   `suck`, `shakeFrames`, `Snd`, `buzz`, `REDUCED`): las partículas nuevas
   son objetos con `draw(g)` que el bucle de app.js pinta tal cual y quita
   cuando devuelven false. Todo va dentro de una función para no chocar con
   los nombres de app.js. */
window.REVELA = (() => {
  const R = (a, b) => a + Math.random() * (b - a);
  const ahora = () => performance.now();
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };
  const easeOut = u => 1 - (1 - u) ** 3;
  const ARCOIRIS = ['#ff5e7e', '#ffb340', '#fff35e', '#5effa1', '#5ed4ff', '#9a7bff', '#ff7bf0'];
  // una partícula que vive `vida` ms y se pinta sola
  const viva = (vida, pinta) => { const t0 = ahora(); return { draw(g) { const u = (ahora() - t0) / vida; if (u >= 1) return false; pinta(g, u); return true; } }; };
  const pon = (...ps) => addParts(ps);

  /* ---------- trazos ---------- */
  // un rayo: el camino quebrado por desplazamiento del punto medio, con ramas
  function quebrado(x1, y1, x2, y2, desv, pasos = 6) {
    let pts = [[x1, y1], [x2, y2]];
    for (let k = 0; k < pasos; k++, desv /= 2) {
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, o = (Math.random() - .5) * desv;
        out.push([(ax + bx) / 2 - dy / l * o, (ay + by) / 2 + dx / l * o], [bx, by]);
      }
      pts = out;
    }
    return pts;
  }
  function rayo(x1, y1, x2, y2, { color = '#b98cff', ancho = 2.6, vida = 220, ramas = 2 } = {}) {
    const largo = Math.hypot(x2 - x1, y2 - y1), caminos = [quebrado(x1, y1, x2, y2, largo * .35)];
    for (let b = 0; b < ramas; b++) {
      const p = caminos[0][(Math.random() * caminos[0].length * .7) | 0], a = Math.atan2(y2 - y1, x2 - x1) + R(-1, 1), l = largo * R(.15, .35);
      caminos.push(quebrado(p[0], p[1], p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l, l * .4, 4));
    }
    pon(viva(vida, (g, u) => {
      const a = (1 - u) ** 1.4 * (Math.random() < .25 ? .45 : 1);
      g.globalCompositeOperation = 'lighter'; g.lineJoin = g.lineCap = 'round';
      caminos.forEach((pts, i) => {
        g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
        const w = ancho * (i ? .55 : 1);
        g.strokeStyle = hexA(color, .22 * a); g.lineWidth = w * 5; g.stroke();
        g.strokeStyle = hexA(color, .85 * a); g.lineWidth = w; g.stroke();
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w * .4; g.stroke();
      });
    }));
  }
  // un punto al azar en el borde de un rectángulo (o de la pantalla)
  const enBorde = (r, fuera = 0) => {
    const l = r.left - fuera, t = r.top - fuera, w = r.width + fuera * 2, h = r.height + fuera * 2, k = Math.random() * (w + h) * 2;
    return k < w ? [l + k, t] : k < w + h ? [l + w, t + k - w] : k < w * 2 + h ? [l + (k - w - h), t + h] : [l, t + (k - w * 2 - h)];
  };
  const pantalla = () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight });
  // onda de choque: un anillo (o un sello de n puntas, para lo arcano) que crece y se apaga
  function anillo(x, y, { r0 = 20, r1 = 360, color = '#fff', vida = 800, ancho = 5, puntas = 0, giro = .8 } = {}) {
    pon(viva(vida, (g, u) => {
      const e = easeOut(u), r = r0 + (r1 - r0) * e, a = 1 - u;
      g.globalCompositeOperation = 'lighter'; g.lineWidth = Math.max(.5, ancho * (1 - u * .7));
      g.strokeStyle = hexA(color, a); g.shadowColor = color; g.shadowBlur = 14;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      if (puntas) {   // sello: dos polígonos de puntas/2 lados cruzados (con 6, el hexagrama)
        const rot = u * giro * Math.PI, lados = puntas / 2;
        for (let s = 0; s < 2; s++) {
          g.beginPath();
          for (let i = 0; i <= lados; i++) { const an = rot + s * Math.PI / lados + i * 2 * Math.PI / lados; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(an) * r * .92, y + Math.sin(an) * r * .92); }
          g.stroke();
        }
        g.beginPath(); g.arc(x, y, r * .78, 0, Math.PI * 2); g.stroke();
      }
    }));
  }
  // anillo que se cierra hacia la carta (carga)
  const anilloEntra = (x, y, r0, color, vida = 520) => anillo(x, y, { r0, r1: 10, color, vida, ancho: 3 });
  // estela de hiperespacio: una línea que sale del centro y se alarga acelerando
  function estela(x, y, color) {
    const a = Math.random() * Math.PI * 2, d0 = R(10, 60), lejos = Math.hypot(innerWidth, innerHeight) * .7;
    pon(viva(R(500, 800), (g, u) => {
      const d = d0 + lejos * u * u, l = 8 + u * u * 260;
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      g.strokeStyle = hexA(color, Math.min(1, u * 3) * (1 - u * .4)); g.lineWidth = .8 + u * 2.2;
      g.beginPath(); g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); g.lineTo(x + Math.cos(a) * (d + l), y + Math.sin(a) * (d + l)); g.stroke();
    }));
  }
  // la traza del osciloscopio sobre la carta: retícula y una senoidal que crece
  function osciloscopio(r, ms) {
    pon(viva(ms + 250, (g, u0) => {
      const u = Math.min(1, u0 * (ms + 250) / ms), fin = u0 > ms / (ms + 250) ? 1 - (u0 * (ms + 250) - ms) / 250 : 1;
      const { left: x, top: y, width: w, height: h } = r, cy = y + h / 2;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = hexA('#3dff8a', .16 * fin); g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 8; i++) { g.moveTo(x + w * i / 8, y); g.lineTo(x + w * i / 8, y + h); }
      for (let i = 1; i < 10; i++) { g.moveTo(x, y + h * i / 10); g.lineTo(x + w, y + h * i / 10); }
      g.stroke();
      const amp = h * (.05 + .32 * u * u), f = 1.5 + u * 7, fase = ahora() / 90;
      g.shadowColor = '#3dff8a'; g.shadowBlur = 12;
      for (const [col, lw] of [['#3dff8a', 3.2], ['#e9ffef', 1.1]]) {
        g.strokeStyle = hexA(col, fin); g.lineWidth = lw; g.beginPath();
        for (let i = 0; i <= 80; i++) {
          const k = i / 80, yy = cy + Math.sin(k * f * Math.PI * 2 - fase) * amp * (u > .85 ? (Math.random() < .3 ? 1.5 : 1) : 1);
          i ? g.lineTo(x + k * w, yy) : g.moveTo(x, yy);
        }
        g.stroke();
      }
    }));
  }
  // la tiza: una elipse a mano alrededor de la carta, que se dibuja y queda un rato
  function tiza(r, ms) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rx = r.width * .78, ry = r.height * .62, vueltas = 1.18, ruido = Array.from({ length: 24 }, () => R(-6, 6));
    pon(viva(ms + 500, (g, u0) => {
      const u = Math.min(1, u0 * (ms + 500) / ms), a = u0 * (ms + 500) > ms ? 1 - (u0 * (ms + 500) - ms) / 500 : 1;
      g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
      for (const [w, al] of [[7, .18], [3.2, .75]]) {
        g.strokeStyle = `rgba(245,245,235,${al * a})`; g.lineWidth = w; g.beginPath();
        const pasos = Math.max(2, Math.round(120 * u));
        for (let i = 0; i <= pasos; i++) {
          const t = -Math.PI * .6 + i / 120 * vueltas * Math.PI * 2, n = ruido[(i / 5 | 0) % ruido.length] * (1 + i / 120 * .6);
          const xx = cx + Math.cos(t) * (rx + n), yy = cy + Math.sin(t) * (ry + n * .7);
          i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
        }
        g.stroke();
      }
    }));
  }
  // partículas cuadradas: polvo de tiza o píxeles
  function cuadros(x, y, { n = 30, colores = ['#fff'], vel = 7, tam = 6, grav = .25, vida = 1100, sube = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const an = Math.random() * Math.PI * 2, v = vel * R(.3, 1), c = colores[i % colores.length], s = tam * R(.5, 1.2);
      let px = x, py = y, vx = Math.cos(an) * v, vy = Math.sin(an) * v - sube;
      const vd = vida * R(.7, 1.2);
      pon(viva(vd, (g, u) => {
        vx *= .96; vy = vy * .96 + grav; px += vx; py += vy;
        g.globalCompositeOperation = 'source-over'; g.fillStyle = hexA(c, (1 - u) * 1.3);
        g.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
      }));
    }
  }
  // humo: bolas grises suaves que suben y se abren
  function humo(x, y, n = 4, color = '#5a5560') {
    for (let i = 0; i < n; i++) {
      let px = x + R(-20, 20), py = y;
      const vx = R(-.5, .5), r0 = R(14, 26);
      pon(viva(R(1600, 2600), (g, u) => {
        px += vx + Math.sin(u * 6 + i) * .4; py -= .9;
        const rr = r0 * (1 + u * 2.4), gr = g.createRadialGradient(px, py, 0, px, py, rr);
        gr.addColorStop(0, hexA(color, .32 * (1 - u))); gr.addColorStop(1, hexA(color, 0));
        g.globalCompositeOperation = 'source-over'; g.fillStyle = gr; g.beginPath(); g.arc(px, py, rr, 0, Math.PI * 2); g.fill();
      }));
    }
  }
  // nieve por toda la pantalla
  function nieve(n = 120) {
    for (let i = 0; i < n; i++) {
      let px = R(0, innerWidth), py = R(-innerHeight * .6, -10);
      const vy = R(.9, 2.2), s = R(1.5, 4.2), fase = R(0, 6);
      pon(viva(R(3800, 6000), (g, u) => {
        py += vy; px += Math.sin(u * 9 + fase) * .7;
        g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${Math.min(1, (1 - u) * 2) * .9})`;
        g.beginPath(); g.arc(px, py, s, 0, Math.PI * 2); g.fill();
      }));
    }
  }
  /* Las luces de la sala parpadean (como si bajara la tensión) o se cortan. */
  function parpadeo(ms) {
    const f = $('#flash');
    f.style.background = '#000';
    const k = [{ opacity: 0 }];
    for (let i = 1; i < 9; i++) k.push({ opacity: Math.random() < .5 ? R(.55, .85) : R(0, .15), offset: i / 9 });
    k.push({ opacity: 0 });
    return f.animate(k, { duration: ms, easing: 'steps(1, end)' });
  }
  function apagon(ms) {
    const f = $('#flash');
    f.style.background = '#000';
    return f.animate([{ opacity: 0 }, { opacity: .94, offset: .08 }, { opacity: .94, offset: .92 }, { opacity: 0 }], { duration: ms });
  }
  const sacude = (fuerza, ms) => {
    const st = document.querySelector('.stage'), k = [];
    for (let i = 0; i <= 14; i++) { const a = fuerza * (1 - i / 14); k.push({ transform: `translate(${R(-a, a)}px, ${R(-a, a)}px)` }); }
    st.animate(k, { duration: ms, easing: 'linear' });
  };

  /* ---------- sonidos ---------- */
  const Son = {
    zap(v = .14) { Snd.noise({ d: R(.04, .09), v, f: R(2500, 7000), q: 7 }); Snd.tone(R(70, 140), { d: .07, v: v * .4, type: 'square', to: 40 }); },
    zumbido(ms, v = .07) {
      if (!Snd.on) return; const a = Snd.init(); if (!a) return;
      const n = a.currentTime, d = ms / 1000, g = a.createGain(), fl = a.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, n); fl.frequency.exponentialRampToValueAtTime(2600, n + d);
      g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(v, n + d * .85); g.gain.exponentialRampToValueAtTime(.0001, n + d + .05);
      for (const [f, t] of [[50, 'sawtooth'], [100, 'square'], [150.6, 'sawtooth']]) {
        const o = a.createOscillator(); o.type = t; o.frequency.value = f; o.connect(fl); o.start(n); o.stop(n + d + .1);
      }
      fl.connect(g); g.connect(Snd.master);
    },
    tiza(ms) { for (let t = 0; t < ms / 1000; t += R(.05, .11)) Snd.noise({ t, d: R(.04, .1), v: .05, f: R(3200, 5600), q: 4 }); },
    hiper(ms) {
      const d = ms / 1000;
      Snd.noise({ d, v: .14, f: 180, to: 5200, q: .7 });
      Snd.tone(70, { d, v: .08, type: 'sawtooth', to: 700 });
      Snd.tone(140, { t: d * .3, d: d * .7, v: .04, type: 'triangle', to: 1400, wet: .5 });
    },
    osc(ms) {
      const d = ms / 1000, n = 9;
      for (let i = 0; i < n; i++) Snd.tone(500 + i * 160, { t: d * i / n, d: .07, v: .028, type: 'square' });
      Snd.tone(220, { d, v: .03, type: 'sine', to: 880 });
    },
    boom() {
      Snd.tone(42, { d: 1.6, v: .5, to: 20 });
      Snd.noise({ d: .9, v: .3, f: 2400, to: 120, type: 'lowpass' });
      Snd.noise({ d: .12, v: .3, f: 6000, q: 2 });
    },
    campanas() {   // las primeras notas de Jingle Bells, con eco
      [659.25, 659.25, 659.25, 0, 659.25, 659.25, 659.25, 0, 659.25, 783.99, 523.25, 587.33, 659.25].forEach((f, i) => {
        if (f) [f, f * 2].forEach((x, j) => Snd.tone(x, { t: .3 + i * .13, d: .5, v: j ? .012 : .035, type: 'triangle', wet: .7 }));
      });
    },
    prisma() { [1046.5, 1318.51, 1567.98, 2093, 2637].forEach((f, i) => Snd.tone(f, { t: i * .05, d: 1.4, v: .03, type: 'triangle', wet: .9 })); },
  };

  /* ---------- las de cada colección ----------
     k = { el, c, t, x, y, r (el rectángulo de la carta), pl (su paleta) } */
  const suspensoAlto = (k, legend) => {
    document.body.classList.add('dim');
    aura(true, k.c, legend);
    return $('#aura').animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: legend ? 1800 : 1100, easing: 'ease-in', fill: 'forwards' });
  };
  const tiembla = (k, fuerza, ms) => k.el.animate(shakeFrames(fuerza), { duration: ms, easing: 'ease-in', fill: 'forwards' }).finished;
  const corta = ms => (REDUCED ? 300 : ms);

  const PROFES = {
    1: {   // tiza en el pizarrón
      async antes(k) {
        const ms = corta(750);
        tiza(k.r, ms); Son.tiza(ms);
        const iv = setInterval(() => cuadros(k.x + R(-.6, .6) * k.r.width, k.y + R(-.55, .55) * k.r.height, { n: 3, colores: ['#f4f2e8', '#cfcabb'], vel: 2, tam: 3, grav: .12, vida: 700 }), 70);
        await tiembla(k, 5, ms);
        clearInterval(iv);
      },
      despues(k) {
        cuadros(k.x, k.y, { n: 46, colores: ['#f4f2e8', '#dcd7c8', '#5cc8ff'], vel: 8, tam: 4, grav: .18, vida: 1200 });
        burst(k.x, k.y, { n: 18, colors: ['#5cc8ff', '#fff'], speed: 7, kinds: ['star'], gravity: .02 });
        anillo(k.x, k.y, { r0: k.r.width * .4, r1: k.r.width * 1.2, color: '#e9f6ff', vida: 650, ancho: 3 });
      },
    },
    2: {   // salto al hiperespacio
      async antes(k) {
        const ms = corta(1350);
        suspensoAlto(k, false); Son.hiper(ms); buzz([30, 60, 30]);
        const cols = [...k.pl, '#ffffff', '#bfe6ff'];
        let n = 2;
        const iv = setInterval(() => { for (let i = 0; i < n; i++) estela(k.x, k.y, cols[(Math.random() * cols.length) | 0]); n = Math.min(9, n + .35); }, 30);
        await tiembla(k, 9, ms);
        clearInterval(iv);
        flash('#bfe6ff', .8, 650);
      },
      despues(k) {
        anillo(k.x, k.y, { r1: k.r.width * 1.8, color: k.pl[0], vida: 750, ancho: 6 });
        setTimeout(() => anillo(k.x, k.y, { r1: k.r.width * 2.6, color: '#ffffff', vida: 900, ancho: 3 }), 120);
        burst(k.x, k.y, { n: 60, colors: [...k.pl, '#fff'], speed: 14, kinds: ['spark', 'star'], gravity: .05 });
      },
    },
    3: {   // prisma shiny
      async antes(k) {
        const ms = corta(2000);
        suspensoAlto(k, true); Snd.charge(3, ms); buzz([30, 60, 30, 60, 30, 40, 60]);
        const iv = setInterval(() => suck(k.x, k.y, k.r.width * 1.2, ARCOIRIS, 6), 40);
        const iv2 = setInterval(() => anilloEntra(k.x, k.y, k.r.width * R(1.2, 1.7), ARCOIRIS[(Math.random() * 7) | 0]), 260);
        const iv3 = setInterval(() => { const [px, py] = enBorde(k.r, 30); burst(px, py, { n: 2, colors: ['#fff', ARCOIRIS[(Math.random() * 7) | 0]], speed: 1, kinds: ['star'], gravity: 0 }); }, 60);
        await tiembla(k, 20, ms);
        [iv, iv2, iv3].forEach(clearInterval);
        flash('#fff4c8', .95, 1000);
      },
      despues(k) {
        Son.prisma();
        ARCOIRIS.forEach((c, i) => setTimeout(() => anillo(k.x, k.y, { r1: k.r.width * (1.4 + i * .28), color: c, vida: 1000, ancho: 5 }), i * 70));
        burst(k.x, k.y, { n: 130, colors: [...ARCOIRIS, '#fff'], speed: 17, kinds: ['confetti', 'spark', 'star'], gravity: .2, life: .8 });
        setTimeout(() => burst(k.x, k.y - 40, { n: 60, colors: ['#fff', '#ffcc3d'], speed: 12, kinds: ['star', 'spark'], gravity: .05 }), 300);
      },
    },
  };

  const COMP = {
    1: {   // osciloscopio: la traza crece hasta que la carta se pixela
      async antes(k) {
        const ms = corta(950);
        osciloscopio(k.r, ms); Son.osc(ms);
        await tiembla(k, 4, ms);
      },
      despues(k) {
        cuadros(k.x, k.y, { n: 56, colores: [k.c.tema || '#3dff8a', '#3dff8a', '#5cc8ff', '#ffffff'], vel: 10, tam: 8, grav: .3, vida: 1300, sube: 2 });
        anillo(k.x, k.y, { r0: k.r.width * .3, r1: k.r.width * 1.3, color: '#3dff8a', vida: 600, ancho: 3 });
        Snd.tone(1760, { d: .12, v: .04, type: 'square' });
      },
    },
    2: {   // bobina de Tesla: arcos desde los bordes hasta la carta
      async antes(k) {
        const ms = corta(1500), color = k.c.tema || '#b98cff';
        suspensoAlto(k, false); Son.zumbido(ms, .05); buzz([30, 60, 30]);
        let cada = 170, t0 = ahora();
        const arco = () => {
          if (ahora() - t0 > ms) return;
          const [ax, ay] = enBorde(pantalla()), [bx, by] = enBorde(k.r, -k.r.width * .05);
          rayo(ax, ay, bx, by, { color: Math.random() < .5 ? color : '#8fd8ff', ancho: R(1.8, 3.2) });
          Son.zap(.09); cada = Math.max(45, cada * .9);
          setTimeout(arco, cada);
        };
        arco();
        await tiembla(k, 12, ms);
        for (let i = 0; i < 4; i++) { const [ax, ay] = enBorde(pantalla()); rayo(ax, ay, k.x, k.y, { color, ancho: 4, vida: 320 }); }
        Son.zap(.2);
        flash(color, .75, 650);
      },
      despues(k) {
        const color = k.c.tema || '#b98cff';
        anillo(k.x, k.y, { r1: k.r.width * 1.5, color, vida: 1100, ancho: 4, puntas: 6 });
        setTimeout(() => anillo(k.x, k.y, { r1: k.r.width * 2.2, color: '#8fd8ff', vida: 900, ancho: 2 }), 150);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + R(-.3, .3), l = k.r.width * R(1.2, 1.9); rayo(k.x, k.y, k.x + Math.cos(a) * l, k.y + Math.sin(a) * l, { color, vida: 260 }); }
        burst(k.x, k.y, { n: 60, colors: [...k.pl, color, '#fff'], speed: 13, kinds: ['spark', 'star'], gravity: .12 });
      },
    },
    3: {   // cortocircuito: zumbido, chispas, parpadeo, apagón y chispazo
      async antes(k) {
        const ms = corta(2400), r = k.r, esquinas = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]];
        document.body.classList.add('dim');
        Son.zumbido(ms * .85, .09); buzz([20, 40, 20, 80, 20, 40, 120]);
        const sacudida = tiembla(k, 24, ms * .85);
        if (REDUCED) { await sacudida; flash('#cfe9ff', .9, 500); return; }
        // 1: chispas que escupen las esquinas y humo
        let t0 = ahora();
        const chispa = () => {
          const t = ahora() - t0; if (t > ms * .82) return;
          const [ex, ey] = esquinas[(Math.random() * 4) | 0], arriba = ey < k.y;
          burst(ex, ey, { n: 10 + (t / ms * 20 | 0), colors: ['#fff6d0', '#ffd25a', '#ff8a1f', '#ffffff'], speed: R(7, 12), kinds: ['spark'], gravity: .45, spread: 1.2, angle: arriba ? -Math.PI / 2 + (ex < k.x ? -.5 : .5) : (ex < k.x ? Math.PI * .85 : Math.PI * .15), size: 1.2 });
          Son.zap(.1 + t / ms * .1);
          if (Math.random() < .4) humo(k.x + R(-.4, .4) * r.width, r.top, 1);
          setTimeout(chispa, Math.max(40, 220 - t / ms * 190));
        };
        chispa();
        // 2: las luces parpadean y saltan arcos entre las esquinas
        await dormir(ms * .42);
        parpadeo(ms * .4);
        const ivA = setInterval(() => { const a = esquinas[(Math.random() * 4) | 0], b = esquinas[(Math.random() * 4) | 0]; if (a !== b) rayo(a[0], a[1], b[0], b[1], { color: '#8fd8ff', ancho: 2, vida: 140, ramas: 1 }); }, 90);
        await sacudida;
        clearInterval(ivA);
        // 3: se corta la luz… y el chispazo
        Snd.tone(110, { d: .35, v: .08, type: 'sawtooth', to: 30 });
        apagon(380);
        await dormir(330);
        Son.boom(); Son.zap(.35);
        flash('#cfe9ff', 1, 1100);
        sacude(16, 600);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, l = Math.hypot(innerWidth, innerHeight) * .5; rayo(k.x, k.y, k.x + Math.cos(a) * l, k.y + Math.sin(a) * l, { color: '#9fdcff', ancho: 3.5, vida: 380 }); }
        burst(k.x, k.y, { n: 170, colors: ['#ffffff', '#fff3b0', '#ffc23a', '#ff7a1f', '#9fdcff'], speed: 20, kinds: ['spark', 'spark', 'star'], gravity: .38, life: 1.1, size: 1.3 });
      },
      despues(k) {
        if (k.c.vkey === 'navidad') {
          nieve(150); Son.campanas();
          burst(k.x, k.y, { n: 110, colors: ['#ff3b4e', '#2fd27a', '#ffd23d', '#ffffff'], speed: 15, kinds: ['confetti', 'star'], gravity: .16 });
          anillo(k.x, k.y, { r1: k.r.width * 1.8, color: '#4dffb0', vida: 1000, ancho: 4 });
          setTimeout(() => anillo(k.x, k.y, { r1: k.r.width * 2.3, color: '#ff3b4e', vida: 1000, ancho: 3 }), 140);
        } else {
          // brasas que suben, humo y fuego
          burst(k.x, k.y + k.r.height * .3, { n: 120, colors: ['#ffd25a', '#ff8a1f', '#ff4d1f', '#fff1c0'], speed: 11, kinds: ['spark'], gravity: -.05, spread: 2.2, angle: -Math.PI / 2, life: .7 });
          humo(k.x, k.r.top, 6, '#3e3434');
          anillo(k.x, k.y, { r1: k.r.width * 1.9, color: '#ff6a1f', vida: 1000, ancho: 6 });
        }
        setTimeout(() => burst(k.x, k.y - 40, { n: 50, colors: [k.pl[0], '#fff'], speed: 12, kinds: ['star', 'spark'], gravity: .05 }), 280);
      },
    },
  };

  const POR_COL = { profes: PROFES, comp: COMP };
  return { de: c => (POR_COL[c.col] || PROFES)[c.tier] || null, rayo, anillo, nieve };
})();
