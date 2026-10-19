/* ---------- LA LÍNEA DE TIEMPO (v2, 84 s) ----------
   Puntos de cada toma que se ajustan mirando los clips (segundos dentro del clip). */
const P = window.PUNTOS || {
  avionDesde: 0, avion3Cobro: 3.0, plinkoDesde: 0.7, plinkoCae: 3.0,
  sobreDesde: 0.6, sobreLeg: 15.5, heroDesde: 8.0, unoDesde: 6.5, recordDesde: 0, recordFin: 6.3, recordTabla: 7.2,
  mascotaDesde: 2.0,
};
const CORTES1 = [ // acción, 8–20 s
  { a: 8.0,  b: 9.5,  c: 'boxhead2',    s: 2.0, n: 'PRO BOXHEAD',      e: 'Nivel 5 · ×41 · jefe El Carnicero',      col: 'var(--nar)' },
  { a: 9.5,  b: 11.0, c: 'yemasz',      s: 2.0, n: 'YEMAS ZOMBIS',     e: 'Oleadas al estilo Black Ops',      col: 'var(--ver)' },
  { a: 11.0, b: 12.0, c: 'worms',       s: 2.0, n: 'CIRCUIT BREAKERS', e: 'Artillería por turnos',             col: 'var(--cel)' },
  { a: 12.0, b: 13.0, c: 'haxball',     s: 3.0, n: 'HAXBALL',          e: 'Fútbol de discos',                  col: 'var(--ver)' },
  { a: 13.0, b: 14.0, c: 'fanal',       s: 3.0, n: 'FANAL',            e: 'Un enjambre entre tú y el alba',    col: 'var(--ama)' },
  { a: 14.0, b: 15.0, c: 'pd2',         s: 3.0, n: 'PRO DEFENDER',     e: 'Ronda 11 de 100',             col: 'var(--ver)' },
  { a: 15.0, b: 16.0, c: 'bbtan',       s: 5.0, n: 'BBTAN',            e: 'Rebota. Rompe. Sube.',              col: 'var(--ros)' },
  { a: 16.0, b: 16.5, c: 'aleteo',      s: 0.8, n: 'ALETEO',           e: 'Solo Club',                         col: 'var(--ama)' },
  { a: 16.5, b: 17.0, c: 'snake',       s: 3.0, n: 'SNAKE',            e: 'Solo Club',                         col: 'var(--ver)' },
  { a: 17.0, b: 17.5, c: 'dosmil',      s: 4.0, n: '2048',             e: 'Solo Club',                         col: 'var(--ama)' },
  { a: 17.5, b: 18.0, c: 'sortem',      s: 3.0, n: 'SORTEM',           e: 'Arcade edition',                    col: 'var(--ros)' },
  { a: 18.0, b: 20.0, c: 'boxhead2',    s: 7.0, n: 'NIVEL TRAS NIVEL', e: 'Cada baja sube el multiplicador',   col: 'var(--nar)' },
];
const SALAS = ['CATAN', 'AJEDREZ', 'CLUE', 'POKÉMON', 'CACHO', 'PRESIDENTE', 'MEMAZO', 'FLIP 7'];
const MOSAICO = ['boxhead2', 'yemasz', 'worms', 'hero', 'avion', 'mascota', 'uno', 'haxball', 'pd2'];
const MONTAJE = [['boxhead2', 9, 'PRO BOXHEAD'], ['yemasz', 7, 'YEMAS ZOMBIS'], ['hero', 9, 'PRO HERO'], ['avion3', 3, 'CASINO'],
                 ['uno', 9, 'UNO'], ['mascota', 9, 'MASCOTAS'], ['worms', 7, 'CIRCUIT BREAKERS'], ['sobre', 19, 'PRODROP']];
const TOP = [['Emma', 8110, '#e8467c'], ['Santi', 7055, '#3f8cff'], ['Jesús', 6488, '#22b07d']];
const GUGU = ['GUGU GAGA', 8518, '#0d9488'];
const pts = n => n.toLocaleString('es-CL');

function panelRanking(t, x, y, o = {}) {
  // Tabla al estilo de «Clasificación de este modo» de Tetris Club; o.sube 0→1 mete a GUGU en el #1
  const w = o.w || 820, alto = 92, k = o.sube || 0;
  let filas = '';
  const lista = TOP.map((f, i) => ({ f, i }));
  lista.forEach(({ f, i }) => {
    const y0 = 100 + (i + k) * alto;
    filas += `<div class="fila-rk" style="top:${y0}px;opacity:${i + k > 2.6 ? 1 - (i + k - 2.6) * 2.5 : 1}">
      <span class="pos" style="color:${['#ffd21f', '#d6dbe8', '#e39a5a'][i]}">${Math.round(i + 1 + k)}</span>
      <span class="av" style="background:${f[2]}">${f[0][0]}</span><span translate="no">${f[0]}</span><span class="pts">${pts(f[1])}</span></div>`;
  });
  if (k > 0) {
    const yG = lerp(100 + 3.4 * alto, 100, eOutX(k));
    filas += `<div class="fila-rk yo" style="top:${yG}px;transform:scale(${1 + 0.06 * Math.sin(Math.PI * k)});box-shadow:0 0 ${60 * k}px rgba(255,210,31,${0.5 * k})">
      <span class="pos" style="color:#ffd21f">1</span><span class="av" style="background:${GUGU[2]}">G</span><span translate="no">${GUGU[0]}</span><span class="pts">${pts(GUGU[1])}</span></div>`;
  }
  return `<div class="panel-rk" style="left:${x}px;top:${y}px;width:${w}px;height:${100 + alto * 3 + 40}px;overflow:hidden;${o.estilo || ''}">
    <h3>Tetris Club · Maratón</h3>${filas}</div>`;
}
function confeti(t, t0) {
  let s = ''; const k = t - t0; if (k < 0 || k > 3) return '';
  for (let i = 0; i < 90; i++) {
    const x = W / 2 + (azar(i) - 0.5) * 300 + (azar(i + 50) - 0.5) * 1900 * Math.min(1, k * 1.6);
    const y = H * 0.35 - 500 * (azar(i + 9) + 0.3) * Math.min(1, k * 2) + 900 * k * k * 0.5;
    const col = ['#ffd21f', '#ff5a1f', '#33d1ff', '#ff3d7f', '#5cff7a'][i % 5];
    s += `<i class="confeti" style="left:${x}px;top:${y}px;background:${col};transform:rotate(${(azar(i + 3) * 720 * k) | 0}deg);opacity:${1 - Math.max(0, k - 2.2) / 0.8}"></i>`;
  }
  return s;
}
const oscuro = (a = 0.55) => `<div class="capa" style="background:linear-gradient(20deg, rgba(0,0,0,${a + 0.2}) 0%, rgba(0,0,0,${a * 0.6}) 40%, transparent 70%)"></div>`;

function escena(t) {
  let tomas = '', textos = '', flash = 0, barras = 0, grano = true;

  // ===== 0–4 INTRO =====
  if (t < 4) {
    tomas += toma('salon', 1 + t * .8, [0, 0, W, H], { clase: 'fondo-borroso', zoom: lerp(1.2, 1.35, t / 4) });
    tomas += `<div class="capa" style="background:#000;opacity:${1 - prog(t, 0, .6)}"></div>`;
    barras = lerp(250, 170, eIO(prog(t, 0, 4)));
    const k = eOutX(prog(t, .15, .9)), op = 1 - prog(t, 3.6, 3.95);
    if (t < 2) {
      textos += `<div class="insignia" style="left:${W / 2 - 520}px;top:${H / 2 - 100}px;width:200px;height:200px;font-size:128px;transform:scale(${lerp(.4, 1, k)});opacity:${k * op}">L</div>
        <div class="titulo" style="left:${W / 2 - 280}px;top:${H / 2 - 96}px;font-family:'Space Grotesk';font-weight:700;text-transform:none;font-size:200px;letter-spacing:-.02em;opacity:${k};clip-path:inset(0 ${100 - eOut(prog(t, .3, 1.2)) * 100}% 0 0)">Laboratorio</div>`;
    } else {
      const k2 = eOut(prog(t, 2, 3.2));
      textos += `<div class="centro mono" style="top:${H / 2 - 40}px;font-size:56px;font-weight:700;color:var(--nar);letter-spacing:${lerp(.1, .55, k2)}em;opacity:${prog(t, 2, 2.2) * op}">presenta</div>
        <div class="centro mono" style="top:${H / 2 + 50}px;font-size:30px;letter-spacing:${lerp(.2, .4, k2)}em;opacity:${prog(t, 2.5, 2.8) * op * .7}">salón de juegos · temporada 2026</div>`;
    }
  }
  // ===== 4–8 GOLPES =====
  else if (t < 8) {
    barras = lerp(170, 0, eIO(prog(t, 7.4, 8)));
    const frases = [[4, 'Una página.', 'var(--bla)', 'boxhead2', 8], [5, '+40 juegos.', 'var(--ama)', 'yemasz', 6], [6, 'Cero descargas.', 'var(--bla)', 'worms', 5], [7, '¿Listos?', 'var(--nar)', 'hero', 6]];
    const i = Math.min(3, Math.floor(t - 4)), [t0, txt, col, clip, s] = frases[i], lt = t - t0;
    tomas += toma(clip, s + lt, [0, 0, W, H], { zoom: 1.15 + lt * .08, filtro: `brightness(${.28 + Math.max(0, .5 - lt) * .5}) saturate(1.2)` });
    flash = Math.max(0, .45 - lt * 3);
    if (t >= 7.5) { const n = Math.floor((t - 7.5) * 16), c = MOSAICO[n % MOSAICO.length]; tomas = toma(c, 5 + n * .2, [0, 0, W, H], { zoom: 1.2, filtro: 'brightness(.55) contrast(1.2)' }); flash = (n % 2) * .2; }
    textos += golpe(txt, t, t0, { color: col, tam: i === 1 ? 300 : 230, deriva: t >= 7 ? .12 : .03 });
  }
  // ===== 8–20 ACCIÓN =====
  else if (t < 20) {
    const c = CORTES1.find(c => t >= c.a && t < c.b), lt = t - c.a, k = lt / (c.b - c.a);
    tomas += tomaLlena(c.c, c.s + lt, k, { pan: 30 });
    flash = Math.max(0, .45 - lt * 5);
    tomas += oscuro(.45);
    textos += rotulo(c.n, c.e, t, c.a, c.b, c.col, { tam: c.b - c.a < .9 ? 170 : 210 });
  }
  // ===== 20–24 MOSAICO =====
  else if (t < 24) {
    const fase2 = t >= 22, cols = fase2 ? 3 : 2, n = cols * cols, gap = 14;
    const cw = (W - gap * (cols + 1)) / cols, chh = (H - gap * (cols + 1)) / cols;
    for (let i = 0; i < n; i++) {
      const ap = (fase2 ? 22 : 20) + i * .0625 * (fase2 ? 1 : 2), k = eOutX(prog(t, ap, ap + .25));
      if (k <= 0) continue;
      const x = gap + (i % cols) * (cw + gap), y = gap + Math.floor(i / cols) * (chh + gap), clip = MOSAICO[(i + (fase2 ? 0 : 4)) % MOSAICO.length];
      tomas += toma(clip, 6 + (t - 20) + i * .3, [x + (1 - k) * cw * .5, y + (1 - k) * chh * .5, cw * k, chh * k], { zoom: 1.05, estilo: 'border-radius:14px;', filtro: 'brightness(.8)' });
    }
    flash = Math.max(0, .4 - (t - (fase2 ? 22 : 20)) * 4);
    textos += golpe(fase2 ? 'O contra todos.' : 'Juega solo.', t, fase2 ? 22 : 20, { tam: 250, estilo: 'text-shadow:0 10px 60px rgba(0,0,0,.8)' });
  }
  // ===== 24–32 PRO HERO (suena CHINCHONCHIN) =====
  else if (t < 32) {
    const lt = t - 24;
    tomas += toma('hero', P.heroDesde + lt, [0, 0, W, H], { zoom: lerp(1.18, 1.05, eOut(prog(t, 24, 26))), filtro: t < 25 ? `brightness(${lerp(.3, 1, prog(t, 24.6, 25))})` : '' });
    flash = Math.max(0, .6 - lt * 3) + Math.max(0, .3 - Math.abs(t - 31.8) * 3);
    if (t < 25.2) textos += golpe('PRO HERO', t, 24, { tam: 340, color: 'var(--ama)', deriva: .05 });
    else {
      tomas += oscuro(.35);
      textos += rotulo('PRO HERO', 'Tu guitarra · tus canciones', t, 25.2, 31.9, 'var(--ama)', { tam: 190 });
      const k = eOutX(prog(t, 25.6, 26.2));
      textos += `<div class="mono" style="position:absolute;left:${lerp(-500, 96, k)}px;top:86px;font-size:28px;font-weight:700;padding:14px 22px;background:rgba(10,10,15,.75);border-left:6px solid var(--ama)">♪ <span translate="no">CHINCHONCHIN</span> · <span translate="no" style="color:var(--ama)">mellowsynesthesia128</span></div>`;
    }
  }
  // ===== 32–41 CASINO =====
  else if (t < 41) {
    if (t < 33) {
      tomas += toma('avion', P.avionDesde, [0, 0, W, H], { clase: 'fondo-borroso', zoom: 1.3 });
      textos += golpe('CASINO', t, 32, { tam: 330, color: 'var(--ros)' });
      flash = Math.max(0, .6 - (t - 32) * 3);
    } else if (t < 35) {
      tomas += toma('avion2', (t - 33) * 4.4, [0, 0, W, H], { zoom: 1.12 });
      flash = Math.max(0, .3 - (t - 33) * 4);
      textos += `<div class="chip" style="right:96px;top:80px;background:var(--ros);color:#0a0a0f">El Avión · apuesta 500</div>`;
    } else if (t < 38) {
      const lt = t - 35, seg = P.avion3Cobro - 1.4 + lt, cobro = 36.4;
      tomas += toma('avion3', seg, [0, 0, W, H], { zoom: lerp(1.12, 1.3, eIO(prog(t, 35, 38))) });
      if (t >= cobro) { textos += golpe('+12.000', t, cobro, { tam: 300, color: 'var(--ama)', y: 640, estilo: 'text-shadow:0 0 60px rgba(255,210,31,.6)' }); flash = Math.max(0, .7 - (t - cobro) * 4); }
    } else {
      const lt = t - 38, seg = P.plinkoDesde + lt * 1.3, cae = 38 + (P.plinkoCae - P.plinkoDesde) / 1.3;
      tomas += toma('plinko', seg, [0, 0, W, H], { zoom: 1.0 });
      if (t >= cae) { textos += golpe('×988', t, cae, { tam: 360, color: 'var(--ros)', y: 230 }) + golpe('+49.350', t, cae + .2, { tam: 200, color: 'var(--ama)', y: 640 }); flash = Math.max(0, .8 - (t - cae) * 4); }
      else textos += `<div class="chip" style="right:96px;top:80px;background:var(--ama);color:#0a0a0f">Plinko · riesgo alto · 16 filas</div>`;
    }
  }
  // ===== 41–44 MASCOTAS =====
  else if (t < 44) {
    const lt = t - 41, k = lt / 3;
    tomas += `<div class="capa" style="background:radial-gradient(ellipse at 70% 50%, #2f6b3a 0%, #13241a 55%, #0a0a0f 100%)"></div>`;
    tomas += tomaLlena('mascota', P.mascotaDesde + lt * 1.0, k, {});
    const k1 = eOutX(prog(t, 41.1, 41.6));
    textos += `<div class="titulo" style="left:${lerp(-200, 110, k1)}px;top:250px;font-size:190px;${rgb(2)}">Mascotas</div>
      <div class="titulo" style="left:${lerp(-200, 116, eOutX(prog(t, 41.3, 41.8)))}px;top:420px;font-size:88px;color:var(--ver)">Cuídala. Vístela.<br>Que baile.</div>`;
    if (t > 41.9) textos += `<div class="chip-leg" style="left:${lerp(-400, 116, eOutX(prog(t, 41.9, 42.3)))}px;top:690px">★ Sombrero arcano</div>`;
    if (t > 42.3) textos += `<div class="chip-leg" style="left:${lerp(-400, 116, eOutX(prog(t, 42.3, 42.7)))}px;top:770px">★ Zapatillas cometa</div>`;
    flash = Math.max(0, .5 - lt * 3);
  }
  // ===== 44–48 SOBRES (PRODROP) =====
  else if (t < 48) {
    const lt = t - 44;
    // de 0,6 a 2,6 s del clip: rasgar; después saltar hasta justo antes de la legendaria
    const seg = lt < 1.6 ? P.sobreDesde + lt : P.sobreLeg - 2.4 + (lt - 1.6);
    tomas += toma('sobre', seg, [0, 0, W, H], { zoom: lerp(1.1, 1.22, k01(t, 44, 48)) });
    flash = Math.max(0, .5 - lt * 3) + (Math.abs(lt - 1.6) < .1 ? .8 : 0);
    if (t < 45.6) textos += golpe('PRODROP', t, 44, { tam: 260, color: 'var(--bla)', y: 820 });
    else textos += `<div class="chip" style="left:96px;top:86px;background:var(--ama);color:#0a0a0f">God pack · Componentes</div>`;
    if (t > 46.9) textos += golpe('★★ LEGENDARIA', t, 46.9, { tam: 190, color: 'var(--ama)', y: 800 });
  }
  // ===== 48–56 SALAS =====
  else if (t < 56) {
    if (t < 52) {
      const lt = t - 48;
      tomas += toma('uno', P.unoDesde + lt, [0, 0, W, H], { zoom: lerp(1.08, 1.15, lt / 4) });
      tomas += oscuro(.4);
      textos += rotulo('UNO NO MERCY', 'Salas en vivo · 4 jugadores', t, 48, 52, 'var(--nar)', { tam: 200 });
      flash = Math.max(0, .5 - lt * 3);
    } else {
      const fondos = ['uno', 'worms', 'haxball', 'yemasz'], fc = fondos[Math.min(3, Math.floor(t - 52))];
      tomas += toma(fc, 10 + (t - 52), [0, 0, W, H], { zoom: 1.12, filtro: 'brightness(.3) saturate(1.3)' });
      const i = Math.min(SALAS.length - 1, Math.floor((t - 52) / PULSO)), t0 = 52 + i * PULSO;
      textos += `<div class="mono" style="position:absolute;left:96px;top:96px;font-size:28px;font-weight:700;color:var(--nar)">● Salas en vivo — con tus amigos</div>`;
      textos += golpe(SALAS[i], t, t0, { tam: 320, color: i % 2 ? 'var(--ama)' : 'var(--bla)' });
      flash = Math.max(0, .3 - (t - t0) * 3);
    }
  }
  // ===== 56–64 EL RÉCORD =====
  else if (t < 64) {
    if (t < 58.5) {
      tomas += toma('record', P.recordDesde, [0, 0, W, H], { clase: 'fondo-borroso', zoom: 1.3 });
      const k = eOutX(prog(t, 56.1, 56.7));
      textos += panelRanking(t, lerp(W, W - 940, k), 300, {});
      textos += `<div class="titulo" style="left:110px;top:330px;font-size:150px;opacity:${prog(t, 56.3, 56.6)}">El #1</div>
        <div class="titulo" style="left:110px;top:470px;font-size:150px;color:#e8467c;opacity:${prog(t, 56.8, 57.1)}" translate="no">es de Emma.</div>
        <div class="mono" style="position:absolute;left:116px;top:660px;font-size:30px;font-weight:700;opacity:${prog(t, 57.5, 57.8)}">8.110 puntos en Maratón</div>`;
      flash = Math.max(0, .3 - (t - 56) * 3);
    } else if (t < 63.4) {
      const lt = t - 58.5, seg = P.recordDesde + lt * ((P.recordFin - P.recordDesde) / 4.9);
      tomas += toma('record', seg, [0, 0, W, H], { zoom: lerp(1.05, 1.18, lt / 4.9) });
      tomas += `<div class="capa" style="box-shadow:inset 0 0 ${200 + 120 * Math.sin(lt * 7)}px rgba(255,40,80,${.25 + .15 * Math.sin(lt * 7)})"></div>`;
      textos += `<div class="mono" style="position:absolute;left:96px;top:86px;font-size:30px;font-weight:700;padding:12px 20px;background:rgba(10,10,15,.8)">GUGU GAGA va por ella…</div>`;
      flash = Math.max(0, .25 - lt * 3);
    } else {
      tomas += `<div class="capa" style="background:#000"></div>`;
    }
  }
  // ===== 64–68 NUEVO #1 =====
  else if (t < 68) {
    const lt = t - 64;
    if (t < 66.4) {
      tomas += `<div class="capa" style="background:radial-gradient(ellipse at 50% 40%, #3a2a05 0%, #120c18 60%, #050508 100%)"></div>`;
      textos += panelRanking(t, (W - 900) / 2, 330, { w: 900, sube: eOutX(prog(t, 64.15, 64.9)) });
      textos += golpe('NUEVO #1', t, 64.0, { tam: 230, color: 'var(--ama)', y: 90, estilo: 'text-shadow:0 0 70px rgba(255,210,31,.7)' });
      textos += confeti(t, 64.15);
      flash = Math.max(0, .9 - lt * 3);
    } else {
      // la tabla de verdad del sitio, ya con GUGU GAGA arriba
      const lt2 = t - 66.4;
      tomas += toma('record', P.recordTabla + lt2, [0, 0, W, H], { zoom: lerp(1.5, 1.65, lt2 / 1.6), dx: 360, dy: -130 });
      textos += `<div class="chip" style="left:96px;top:86px;background:var(--ama);color:#0a0a0f">En vivo en la página</div>`;
      flash = Math.max(0, .5 - lt2 * 4);
    }
  }
  // ===== 68–72 MONTAJE RÁPIDO =====
  else if (t < 72) {
    const i = Math.min(7, Math.floor((t - 68) / PULSO)), t0 = 68 + i * PULSO, [c, s, n] = MONTAJE[i], lt = t - t0;
    tomas += toma(c, s + lt, [0, 0, W, H], { zoom: lerp(1.25, 1.12, eOut(lt / PULSO)), dx: (i % 2 ? 1 : -1) * 40 * lt });
    flash = Math.max(0, .5 - lt * 8);
    textos += `<div class="titulo" style="left:96px;bottom:110px;font-size:130px;${rgb(3)}">${n}</div>`;
  }
  // ===== 72–84 FINAL =====
  else {
    const k = eOutX(prog(t, 72, 72.9)), fuera = prog(t, 82, 83.6);
    tomas += `<div class="capa" style="background:radial-gradient(ellipse at 50% 55%, #2a1020 0%, #0a0a0f 70%)"></div>`;
    const clipDentro = MOSAICO[Math.floor((t - 72) * 2) % MOSAICO.length];
    const tam = 420, ancho = 1500, alto = 440, x = (W - ancho) / 2, y = 330, fc = cuadro(clipDentro, 5 + (t - 72));
    const esc = lerp(1.5, 1, k) + (t - 72) * .008;
    textos += `<img src="${fc}" style="position:absolute;width:1px;height:1px;opacity:.01;left:0;top:0">
      <div class="titulo" style="left:${x}px;top:${y}px;width:${ancho}px;height:${alto}px;display:flex;align-items:center;justify-content:center;font-size:${tam}px;letter-spacing:.01em;color:transparent;background-image:url(${fc});background-size:${W}px ${H}px;background-position:center;-webkit-background-clip:text;background-clip:text;filter:saturate(1.4) brightness(1.15);transform:scale(${esc});opacity:${1 - fuera}">JUEGOS</div>
      <div class="titulo" style="left:${x}px;top:${y}px;width:${ancho}px;height:${alto}px;display:flex;align-items:center;justify-content:center;font-size:${tam}px;letter-spacing:.01em;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.8);transform:scale(${esc});opacity:${1 - fuera}">JUEGOS</div>`;
    const k1 = eOutX(prog(t, 72.3, 73));
    textos += `<div class="insignia" style="left:${W / 2 - 250}px;top:200px;width:84px;height:84px;font-size:52px;opacity:${k1 * (1 - fuera)}">L</div>
      <div class="titulo" style="left:${W / 2 - 150}px;top:204px;font-family:'Space Grotesk';font-weight:700;text-transform:none;font-size:72px;letter-spacing:-.02em;opacity:${k1 * (1 - fuera)}">Laboratorio</div>`;
    if (t >= 74) { const k2 = eOutX(prog(t, 74, 74.4)); textos += `<div class="chip" style="left:50%;top:810px;font-size:56px;padding:18px 40px;background:var(--nar);color:#fff;transform:translateX(-50%) scale(${lerp(1.4, 1, k2)});opacity:${k2 * (1 - fuera)}">Ya disponible</div>`; }
    if (t >= 75) textos += `<div class="centro mono" style="top:940px;font-size:46px;font-weight:700;opacity:${prog(t, 75, 75.4) * (1 - fuera)}">paginita-pro.cl</div>`;
    flash = Math.max(0, .9 - (t - 72) * 2.5) + (t >= 74 ? Math.max(0, .3 - (t - 74) * 3) : 0);
    if (fuera > 0) tomas += `<div class="capa" style="background:#000;opacity:${fuera}"></div>`;
  }
  return { tomas, textos, flash, barras, grano };
}
function k01(t, a, b) { return prog(t, a, b); }
