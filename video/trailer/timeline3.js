/* ---------- LA LÍNEA DE TIEMPO (v3, 112 s) ----------
   Puntos de cada toma que se ajustan mirando los clips (segundos dentro del clip). */
const P = window.PUNTOS || {
  sobreDesde: 0.6, sobreLeg: 16.0, heroDesde: 8.0, unoDesde: 6.5, recordDesde: 1.0, recordFin: 7.0, recordTabla: 8.2,
  mascotaDesde: 2.0,
};
const CORTES1 = [ // acción, 8–18 s
  { a: 8.0,  b: 9.5,  c: 'boxhead2', s: 2.0, n: 'PRO BOXHEAD',      e: 'Nivel 5 · ×41 · jefe El Carnicero', col: 'var(--nar)' },
  { a: 9.5,  b: 11.0, c: 'yemasz',   s: 2.0, n: 'YEMAS ZOMBIS',     e: 'Oleadas al estilo Black Ops',       col: 'var(--ver)' },
  { a: 11.0, b: 12.0, c: 'worms',    s: 2.0, n: 'CIRCUIT BREAKERS', e: 'Artillería por turnos',              col: 'var(--cel)' },
  { a: 12.0, b: 13.0, c: 'haxball',  s: 3.0, n: 'HAXBALL',          e: 'Fútbol de discos',                   col: 'var(--ver)' },
  { a: 13.0, b: 13.6, c: 'snake',    s: 3.0, n: 'SNAKE',            e: 'Solo Club',                          col: 'var(--ver)' },
  { a: 13.6, b: 14.2, c: 'dosmil',   s: 4.0, n: '2048',             e: 'Solo Club',                          col: 'var(--ama)' },
  { a: 14.2, b: 14.8, c: 'sortem',   s: 3.0, n: 'SORTEM',           e: 'Arcade edition',                     col: 'var(--ros)' },
  { a: 14.8, b: 15.6, c: 'clue',     s: 1.5, n: 'CLUE',             e: 'Contra bots o con amigos',           col: 'var(--ama)' },
  { a: 15.6, b: 18.0, c: 'boxhead2', s: 7.0, n: 'NIVEL TRAS NIVEL', e: 'Cada baja sube el multiplicador',    col: 'var(--nar)' },
];
/* Antes → después (18–32 s): cada juego al principio y muy avanzado, con su propia transición */
const AD = [
  { t0: 18.0, a: 'bbtanA', sa: 1.0, b: 'bbtanB', sb: 0.8, nombre: 'BBTAN', pre: 'NIVEL', de: 2, al: 310, tr: 'sube', col: '#ff3048', sub: 'Las bolas ya no alcanzan · modo SATÁN' },
  { t0: 21.5, a: 'aleteoA', sa: 1.6, b: 'aleteoB', sb: 1.0, nombre: 'ALETEO', pre: 'NIVEL', de: 2, al: 150, tr: 'oscuro', col: '#e8e8e8', sub: 'El cielo se apaga · ENCØERRO' },
  { t0: 25.0, a: 'fanalA', sa: 2.2, b: 'fanalB', sb: 1.2, nombre: 'FANAL', pre: 'FASE', de: 1, al: 5, tr: 'warp', col: 'var(--ama)', sub: 'El Sol · la barca con todas sus mejoras', romano: true },
  { t0: 28.5, a: 'pdA', sa: 3.0, b: 'pdB', sb: 2.0, nombre: 'PRO DEFENDER', pre: 'RONDA', de: 5, al: 95, tr: 'barrido', col: '#b48cff', sub: 'Mapa 5 · Nexo del Vacío · torres al máximo', ancho: true, deMapa: 'Mapa 1 · Prado Esmeralda' },
];
const SALAS3 = [ // 74–84 s, 1,25 s cada una
  ['CATAN', 'salaCatan', 3.0], ['AJEDREZ', 'salaAjedrez', 10.6], ['CLUE', 'clue', 3.4], ['POKÉMON', 'salaPokemon', 2.2],
  ['CACHO', 'salaCacho', 6.3], ['PRESIDENTE', 'salaPresidente', 2.0], ['MOMAZO', 'salaMemazo', 5.6], ['FLIP 7', 'salaFlip7', 3.0],
];
const MOSAICO = ['boxhead2', 'yemasz', 'salaCatan', 'hero', 'bbtanB', 'pollito', 'uno', 'salaPokemon', 'pdB'];
const MONTAJE = [['boxhead2', 9, 'PRO BOXHEAD'], ['bbtanB', 3, 'BBTAN'], ['hero', 9, 'PRO HERO'], ['fanalB', 4, 'FANAL'],
                 ['salaCatan', 6, 'CATAN'], ['pollito', 7.5, 'MASCOTAS'], ['pdB', 4, 'PRO DEFENDER'], ['sobre', 19, 'PRODROP']];
const TOP = [['Emma', 8110, '#e8467c'], ['Santi', 7055, '#3f8cff'], ['Jesús', 6488, '#22b07d']];
const GUGU = ['GUGU GAGA', 16948, '#0d9488'];
const pts = n => n.toLocaleString('es-CL');
const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];

function panelRanking(t, x, y, o = {}) {
  // Tabla al estilo de «Clasificación de este modo» de Tetris Club; o.sube 0→1 mete a GUGU en el #1
  const w = o.w || 820, alto = 92, k = o.sube || 0;
  let filas = '';
  TOP.forEach((f, i) => {
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

/* Una toma vertical como tarjeta centrada (sin inclinar) que se puede mover, escalar o filtrar */
function tarjeta(nombre, seg, o = {}) {
  const c = CLIPS[nombre]; if (!c) return '';
  const [fx, fy, fw, fh] = c.enfoque, ch = o.alto || 940, cw = Math.round(ch * fw / fh);
  const x = (o.cx ?? W / 2) - cw / 2, y = (H - ch) / 2;
  return toma(nombre, seg, [x, y, cw, ch], { zoom: o.zoom || 1, filtro: o.filtro,
    estilo: `border-radius:26px;box-shadow:0 50px 120px rgba(0,0,0,.7),0 0 0 3px ${o.borde || 'rgba(255,255,255,.15)'};transform:${o.tr || 'none'};opacity:${o.op ?? 1};` });
}
function contador(t, lt, g, k) {
  // el número rueda de «de» a «al» durante la transición
  const n = Math.round(lerp(g.de, g.al, eIn(k)));
  const txt = g.romano ? ROMANO[Math.max(1, Math.min(5, n))] : String(n);
  const sac = (1 - k) * 0, s = 1 + .25 * Math.sin(Math.PI * k);
  return `<div class="centro mono" style="top:${H / 2 - 130}px;font-size:220px;font-weight:800;color:#fff;letter-spacing:-.02em;transform:scale(${s});text-shadow:0 0 50px ${g.col},0 0 120px ${g.col};opacity:${Math.min(1, k * 5)}">${g.pre} ${txt}</div>`;
}
function antesDespues(t, g) {
  const lt = t - g.t0, T1 = 1.15, T2 = 1.55;
  let tomas = '', textos = '', flash = 0;
  const fondo = (n, s) => g.ancho ? '' : toma(n, s, [0, 0, W, H], { clase: 'fondo-borroso', zoom: 1.3 });
  const pon = (n, s, o = {}) => g.ancho ? toma(n, s, [0, 0, W, H], { zoom: o.zoom || 1.06, filtro: o.filtro, estilo: o.estilo || '' }) : tarjeta(n, s, o);
  const sa = g.sa + Math.min(lt, T2), sb = g.sb + Math.max(0, lt - T1);
  if (lt < T1) {
    tomas += fondo(g.a, sa) + pon(g.a, sa, { zoom: lerp(1, 1.05, lt / T1) });
    textos += `<div class="chip" style="left:96px;top:86px;background:rgba(10,10,15,.82);color:#fff;border:2px solid rgba(255,255,255,.25)">${g.nombre} · ${g.deMapa ? g.deMapa + ' · ' : ''}${g.pre.toLowerCase()} ${g.romano ? ROMANO[g.de] : g.de}</div>
      <div class="mono" style="position:absolute;left:100px;bottom:96px;font-size:34px;font-weight:700;letter-spacing:.3em;color:rgba(255,255,255,.85);opacity:${prog(lt, .1, .3)}">ASÍ EMPIEZA…</div>`;
    flash = Math.max(0, .35 - lt * 3);
  } else if (lt < T2) {
    const k = prog(lt, T1, T2);
    if (g.tr === 'sube') {           // BBTAN: el tablero sube como un ascensor y llega el de abajo, ya rojo
      tomas += `<div class="capa" style="background:radial-gradient(ellipse at 50% 60%, rgba(255,40,60,${.5 * k}), #050003 75%)"></div>`;
      tomas += pon(g.a, sa, { tr: `translateY(${-eIn(k) * 1300}px)`, filtro: `blur(${k * 14}px) brightness(${1 + k})` });
      tomas += pon(g.b, sb, { tr: `translateY(${(1 - eOut(k)) * 1300}px)`, filtro: `blur(${(1 - k) * 14}px)`, borde: 'rgba(255,40,60,.8)' });
    } else if (g.tr === 'oscuro') {  // ALETEO: el cielo se apaga y se prende la jaula
      const a = k < .5, kk = a ? k * 2 : (k - .5) * 2;
      tomas += `<div class="capa" style="background:#000"></div>`;
      tomas += a ? pon(g.a, sa, { filtro: `brightness(${1 - kk}) grayscale(${kk})`, tr: `scale(${1 - .08 * kk})` })
                 : pon(g.b, sb, { filtro: `brightness(${kk}) contrast(${1 + (1 - kk)})`, tr: `scale(${1.12 - .12 * kk})` });
      tomas += `<div class="capa" style="background:radial-gradient(circle at 50% 50%, transparent ${lerp(60, 10, 1 - Math.abs(k - .5) * 2)}%, #000 ${lerp(85, 30, 1 - Math.abs(k - .5) * 2)}%)"></div>`;
    } else if (g.tr === 'warp') {    // FANAL: salto al hiperespacio
      let estrellas = '';
      for (let i = 0; i < 70; i++) {
        const ang = azar(i) * Math.PI * 2, r0 = 80 + azar(i + 7) * 300, largo = 200 + 900 * Math.sin(Math.PI * k);
        estrellas += `<i style="position:absolute;left:${W / 2 + Math.cos(ang) * r0}px;top:${H / 2 + Math.sin(ang) * r0}px;width:${largo}px;height:3px;background:linear-gradient(90deg,rgba(255,220,120,.95),transparent);transform-origin:0 50%;transform:rotate(${ang}rad);opacity:${Math.sin(Math.PI * k)}"></i>`;
      }
      tomas += `<div class="capa" style="background:radial-gradient(circle, #2a1a05 0%, #000 70%)"></div>`;
      if (k < .6) tomas += pon(g.a, sa, { tr: `scale(${1 + 2.5 * eIn(k / .6)})`, op: 1 - k / .6, filtro: `blur(${k * 16}px)` });
      if (k > .4) tomas += pon(g.b, sb, { tr: `scale(${lerp(.3, 1, eOut((k - .4) / .6))})`, op: (k - .4) / .6 });
      tomas += estrellas;
    } else {                          // PRO DEFENDER: barrido de izquierda a derecha con borde de luz
      const x = eIO(k) * W;
      tomas += pon(g.a, sa) + `<div class="toma" style="left:0;top:0;width:${W}px;height:${H}px;clip-path:inset(0 ${W - x}px 0 0)">${pon(g.b, sb)}</div>`;
      tomas += `<div style="position:absolute;left:${x - 6}px;top:0;width:12px;height:${H}px;background:#fff;box-shadow:0 0 40px 18px ${g.col},0 0 120px 40px ${g.col}"></div>`;
    }
    textos += contador(t, lt, g, k);
  } else {
    const l2 = lt - T2;
    tomas += fondo(g.b, sb) + pon(g.b, sb, { zoom: lerp(1.04, 1.1, l2 / 2), borde: g.col });
    if (!g.ancho) tomas += `<div class="capa" style="box-shadow:inset 0 0 220px ${g.col === 'var(--ama)' ? 'rgba(255,190,40,.35)' : 'rgba(0,0,0,.6)'}"></div>`;
    tomas += oscuro(.35);
    textos += golpe(`${g.pre} ${g.romano ? ROMANO[g.al] : g.al}`, t, g.t0 + T2, { tam: 210, color: g.col, y: 70, deriva: .04, estilo: 'text-shadow:0 10px 60px rgba(0,0,0,.9)' });
    textos += rotulo(g.nombre, g.sub, t, g.t0 + T2 + .1, g.t0 + 3.5, g.col.startsWith('#') ? g.col : 'var(--ama)', { tam: 150 });
    flash = Math.max(0, .8 - l2 * 4);
  }
  return { tomas, textos, flash };
}

function escena(t) {
  let tomas = '', textos = '', flash = 0, barras = 0, grano = true;

  // ===== 0–4 INTRO =====
  if (t < 4) {
    tomas += toma('salon', 1 + t * .8, [0, 0, W, H], { clase: 'fondo-borroso', zoom: lerp(1.2, 1.35, t / 4) });
    tomas += `<div class="capa" style="background:#000;opacity:${1 - prog(t, 0, .6)}"></div>`;
    barras = lerp(250, 170, eIO(prog(t, 0, 4)));
    const k = eOutX(prog(t, .15, .9)), op = 1 - prog(t, 3.6, 3.95);
    if (t < 2) {
      textos += `<div style="position:absolute;left:0;right:0;top:${H / 2 - 110}px;height:220px;display:flex;align-items:center;justify-content:center;gap:44px">
        <div style="width:220px;height:220px;flex:none;transform:scale(${lerp(.3, 1, k)}) rotate(${lerp(-120, 0, k)}deg);opacity:${k * op};filter:drop-shadow(0 20px 50px rgba(255,90,31,.45))">${LOGO}</div>
        <div class="titulo" style="position:static;font-family:'Space Grotesk';font-weight:700;text-transform:none;font-size:170px;letter-spacing:-.03em;opacity:${k * op};clip-path:inset(-20% ${100 - eOut(prog(t, .3, 1.2)) * 100}% -20% 0)" translate="no">Paginita-Pro</div></div>`;
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
  // ===== 8–18 ACCIÓN =====
  else if (t < 18) {
    const c = CORTES1.find(c => t >= c.a && t < c.b), lt = t - c.a, k = lt / (c.b - c.a);
    tomas += tomaLlena(c.c, c.s + lt, k, { pan: 30 });
    flash = Math.max(0, .45 - lt * 5);
    tomas += oscuro(.45);
    textos += rotulo(c.n, c.e, t, c.a, c.b, c.col, { tam: c.b - c.a < .9 ? 170 : 210 });
  }
  // ===== 18–32 ANTES → DESPUÉS =====
  else if (t < 32) {
    const g = AD.filter(x => t >= x.t0).pop(), r = antesDespues(t, g);
    tomas += r.tomas; textos += r.textos; flash = r.flash;
  }
  // ===== 32–36 MOSAICO =====
  else if (t < 36) {
    const fase2 = t >= 34, cols = fase2 ? 3 : 2, n = cols * cols, gap = 14;
    const cw = (W - gap * (cols + 1)) / cols, chh = (H - gap * (cols + 1)) / cols;
    for (let i = 0; i < n; i++) {
      const ap = (fase2 ? 34 : 32) + i * .0625 * (fase2 ? 1 : 2), k = eOutX(prog(t, ap, ap + .25));
      if (k <= 0) continue;
      const x = gap + (i % cols) * (cw + gap), y = gap + Math.floor(i / cols) * (chh + gap), clip = MOSAICO[(i + (fase2 ? 0 : 4)) % MOSAICO.length];
      tomas += toma(clip, 4 + (t - 32) + i * .3, [x + (1 - k) * cw * .5, y + (1 - k) * chh * .5, cw * k, chh * k], { zoom: 1.05, estilo: 'border-radius:14px;', filtro: 'brightness(.8)' });
    }
    flash = Math.max(0, .4 - (t - (fase2 ? 34 : 32)) * 4);
    textos += golpe(fase2 ? 'O contra todos.' : 'Juega solo.', t, fase2 ? 34 : 32, { tam: 250, estilo: 'text-shadow:0 10px 60px rgba(0,0,0,.8)' });
  }
  // ===== 36–44 PRO HERO (suena CHINCHONCHIN) =====
  else if (t < 44) {
    const lt = t - 36;
    tomas += toma('hero', P.heroDesde + lt, [0, 0, W, H], { zoom: lerp(1.18, 1.05, eOut(prog(t, 36, 38))), filtro: t < 37 ? `brightness(${lerp(.3, 1, prog(t, 36.6, 37))})` : '' });
    flash = Math.max(0, .6 - lt * 3) + Math.max(0, .3 - Math.abs(t - 43.8) * 3);
    if (t < 37.2) textos += golpe('PRO HERO', t, 36, { tam: 340, color: 'var(--ama)', deriva: .05 });
    else {
      tomas += oscuro(.35);
      textos += rotulo('PRO HERO', 'Tu guitarra · tus canciones', t, 37.2, 43.9, 'var(--ama)', { tam: 190 });
      const k = eOutX(prog(t, 37.6, 38.2));
      textos += `<div class="mono" style="position:absolute;left:${lerp(-500, 96, k)}px;top:86px;font-size:28px;font-weight:700;padding:14px 22px;background:rgba(10,10,15,.75);border-left:6px solid var(--ama)">♪ <span translate="no">CHINCHONCHIN</span> · <span translate="no" style="color:var(--ama)">mellowsynesthesia128</span></div>`;
    }
  }
  // ===== 44–60 CASINO (recreado) =====
  else if (t < 60) {
    if (t < 45) {
      const r = casinoAvion(0);
      tomas += `<div style="position:absolute;inset:0;filter:blur(18px) brightness(.45)">${r.tomas}</div>`;
      textos += golpe('CASINO', t, 44, { tam: 360, color: 'var(--ros)', estilo: 'text-shadow:0 0 80px rgba(255,61,127,.6)' });
      textos += `<div class="centro mono" style="top:${H / 2 + 170}px;font-size:40px;font-weight:700;letter-spacing:.4em;color:var(--ama);opacity:${prog(t, 44.25, 44.5)}">¿TE ATREVES?</div>`;
      flash = Math.max(0, .7 - (t - 44) * 3);
    } else {
      const r = t < 45 + DUR_AVION ? casinoAvion(t - 45) : casinoPlinko(Math.min(DUR_PLINKO - .001, t - 45 - DUR_AVION));
      tomas += r.tomas; textos += r.textos; flash = r.flash || 0;
    }
  }
  // ===== 60–66 MASCOTAS: Michi y Pío =====
  else if (t < 66) {
    tomas += `<div class="capa" style="background:radial-gradient(ellipse at 70% 50%, #2f6b3a 0%, #13241a 55%, #0a0a0f 100%)"></div>`;
    if (t < 63) {
      const lt = t - 60, k = lt / 3;
      tomas += tomaLlena('mascota', P.mascotaDesde + lt, k, {});
      const k1 = eOutX(prog(t, 60.1, 60.6));
      textos += `<div class="titulo" style="left:${lerp(-200, 110, k1)}px;top:250px;font-size:190px;${rgb(2)}">Mascotas</div>
        <div class="titulo" style="left:${lerp(-200, 116, eOutX(prog(t, 60.3, 60.8)))}px;top:420px;font-size:88px;color:var(--ver)">Cuídala. Vístela.<br>Que baile.</div>`;
      if (t > 60.9) textos += `<div class="chip-leg" style="left:${lerp(-400, 116, eOutX(prog(t, 60.9, 61.3)))}px;top:690px">★ Sombrero arcano</div>`;
      if (t > 61.3) textos += `<div class="chip-leg" style="left:${lerp(-400, 116, eOutX(prog(t, 61.3, 61.7)))}px;top:770px">★ Zapatillas cometa</div>`;
      flash = Math.max(0, .5 - lt * 3);
    } else {
      const lt = t - 63, seg = lt < 1.5 ? 1.2 + lt : 7.2 + (lt - 1.5);
      tomas += tomaLlena('pollito', seg, lt / 3, {});
      const k1 = eOutX(prog(t, 63.05, 63.5));
      textos += `<div class="titulo" style="left:${lerp(-200, 110, k1)}px;top:250px;font-size:190px;color:#ffd84d;${rgb(2)}" translate="no">Pío</div>
        <div class="titulo" style="left:${lerp(-200, 116, eOutX(prog(t, 63.2, 63.7)))}px;top:420px;font-size:88px;color:var(--bla)">Pollito bebé.<br>${lt < 1.5 ? 'A comer.' : 'A la ducha.'}</div>`;
      textos += `<div class="chip" style="left:${lerp(-400, 116, eOutX(prog(t, 63.6, 64)))}px;top:690px;background:#ffd84d;color:#0a0a0f">Crece a gallina con cada cuidado</div>`;
      flash = Math.max(0, .5 - lt * 3) + (Math.abs(lt - 1.5) < .08 ? .4 : 0);
    }
  }
  // ===== 66–70 SOBRES (PRODROP) =====
  else if (t < 70) {
    const lt = t - 66;
    const seg = lt < 1.6 ? P.sobreDesde + lt : P.sobreLeg - 0.5 + (lt - 1.6);
    tomas += toma('sobre', seg, [0, 0, W, H], { zoom: lerp(1.1, 1.22, prog(t, 66, 70)) });
    flash = Math.max(0, .5 - lt * 3) + (Math.abs(lt - 1.6) < .1 ? .8 : 0);
    if (t < 67.6) textos += golpe('PRODROP', t, 66, { tam: 260, color: 'var(--bla)', y: 820 });
    else textos += `<div class="chip" style="left:96px;top:86px;background:var(--ama);color:#0a0a0f">God pack · Componentes</div>`;
    if (t > 68.05) textos += golpe('★★ LEGENDARIA', t, 68.05, { tam: 190, color: 'var(--ama)', y: 800 });
  }
  // ===== 70–74 UNO =====
  else if (t < 74) {
    const lt = t - 70;
    tomas += toma('uno', P.unoDesde + lt, [0, 0, W, H], { zoom: lerp(1.08, 1.15, lt / 4) });
    tomas += oscuro(.4);
    textos += rotulo('UNO NO MERCY', 'Salas en vivo · 4 jugadores', t, 70, 74, 'var(--nar)', { tam: 200 });
    flash = Math.max(0, .5 - lt * 3);
  }
  // ===== 74–84 SALAS: un vistazo de cada una =====
  else if (t < 84) {
    const i = Math.min(SALAS3.length - 1, Math.floor((t - 74) / 1.25)), t0 = 74 + i * 1.25, lt = t - t0, [nom, clip, s] = SALAS3[i];
    tomas += toma(clip, s + lt, [0, 0, W, H], { zoom: lerp(1.04, 1.12, lt / 1.25), dx: (i % 2 ? 1 : -1) * 30 * lt });
    tomas += `<div class="capa" style="background:linear-gradient(0deg, rgba(5,5,10,.85) 0%, rgba(5,5,10,.2) 38%, transparent 55%)"></div>`;
    textos += `<div class="mono" style="position:absolute;left:96px;top:86px;font-size:28px;font-weight:700;padding:12px 20px;background:rgba(10,10,15,.82);color:var(--nar)">● Salas en vivo — con tus amigos</div>`;
    textos += golpe(nom, t, t0, { tam: 240, color: i % 2 ? 'var(--ama)' : 'var(--bla)', y: H - 330, estilo: 'text-shadow:0 10px 50px rgba(0,0,0,.9)' });
    flash = Math.max(0, .35 - lt * 3);
  }
  // ===== 84–92 EL RÉCORD =====
  else if (t < 92) {
    if (t < 86.5) {
      tomas += toma('record3', P.recordDesde, [0, 0, W, H], { clase: 'fondo-borroso', zoom: 1.3 });
      const k = eOutX(prog(t, 84.1, 84.7));
      textos += panelRanking(t, lerp(W, W - 940, k), 300, {});
      textos += `<div class="titulo" style="left:110px;top:330px;font-size:150px;opacity:${prog(t, 84.3, 84.6)}">El #1</div>
        <div class="titulo" style="left:110px;top:470px;font-size:150px;color:#e8467c;opacity:${prog(t, 84.8, 85.1)}" translate="no">es de Emma.</div>
        <div class="mono" style="position:absolute;left:116px;top:660px;font-size:30px;font-weight:700;opacity:${prog(t, 85.5, 85.8)}">8.110 puntos en Maratón</div>`;
      flash = Math.max(0, .3 - (t - 84) * 3);
    } else if (t < 91.4) {
      const lt = t - 86.5, seg = P.recordDesde + lt * ((P.recordFin - P.recordDesde) / 4.9);
      tomas += toma('record3', seg, [0, 0, W, H], { zoom: lerp(1.05, 1.18, lt / 4.9) });
      tomas += `<div class="capa" style="box-shadow:inset 0 0 ${200 + 120 * Math.sin(lt * 7)}px rgba(255,40,80,${.25 + .15 * Math.sin(lt * 7)})"></div>`;
      textos += `<div class="mono" style="position:absolute;left:96px;top:86px;font-size:30px;font-weight:700;padding:12px 20px;background:rgba(10,10,15,.8)">GUGU GAGA va por ella…</div>`;
      flash = Math.max(0, .25 - lt * 3);
    } else {
      tomas += `<div class="capa" style="background:#000"></div>`;
    }
  }
  // ===== 92–96 NUEVO #1 =====
  else if (t < 96) {
    const lt = t - 92;
    if (t < 94.4) {
      tomas += `<div class="capa" style="background:radial-gradient(ellipse at 50% 40%, #3a2a05 0%, #120c18 60%, #050508 100%)"></div>`;
      textos += panelRanking(t, (W - 900) / 2, 330, { w: 900, sube: eOutX(prog(t, 92.15, 92.9)) });
      textos += golpe('NUEVO #1', t, 92.0, { tam: 230, color: 'var(--ama)', y: 90, estilo: 'text-shadow:0 0 70px rgba(255,210,31,.7)' });
      textos += confeti(t, 92.15);
      flash = Math.max(0, .9 - lt * 3);
    } else {
      // la tabla de verdad del sitio, ya con GUGU GAGA arriba
      const lt2 = t - 94.4;
      tomas += toma('record3', P.recordTabla + lt2, [0, 0, W, H], { zoom: lerp(1.7, 1.85, lt2 / 1.6), dx: 470, dy: -150 });
      textos += `<div class="chip" style="left:96px;top:86px;background:var(--ama);color:#0a0a0f">En vivo en la página</div>`;
      flash = Math.max(0, .5 - lt2 * 4);
    }
  }
  // ===== 96–100 MONTAJE RÁPIDO =====
  else if (t < 100) {
    const i = Math.min(7, Math.floor((t - 96) / PULSO)), t0 = 96 + i * PULSO, [c, s, n] = MONTAJE[i], lt = t - t0;
    tomas += toma(c, s + lt, [0, 0, W, H], { zoom: lerp(1.25, 1.12, eOut(lt / PULSO)), dx: (i % 2 ? 1 : -1) * 40 * lt });
    flash = Math.max(0, .5 - lt * 8);
    textos += `<div class="titulo" style="left:96px;bottom:110px;font-size:130px;${rgb(3)}">${n}</div>`;
  }
  // ===== 100–112 FINAL =====
  else {
    const k = eOutX(prog(t, 100, 100.9)), fuera = prog(t, 110, 111.6);
    tomas += `<div class="capa" style="background:radial-gradient(ellipse at 50% 55%, #2a1020 0%, #0a0a0f 70%)"></div>`;
    const clipDentro = MOSAICO[Math.floor((t - 100) * 2) % MOSAICO.length];
    const tam = 420, ancho = 1500, alto = 440, x = (W - ancho) / 2, y = 330, fc = cuadro(clipDentro, 5 + (t - 100));
    const esc = lerp(1.5, 1, k) + (t - 100) * .008;
    textos += `<img src="${fc}" style="position:absolute;width:1px;height:1px;opacity:.01;left:0;top:0">
      <div class="titulo" style="left:${x}px;top:${y}px;width:${ancho}px;height:${alto}px;display:flex;align-items:center;justify-content:center;font-size:${tam}px;letter-spacing:.01em;color:transparent;background-image:url(${fc});background-size:${W}px ${H}px;background-position:center;-webkit-background-clip:text;background-clip:text;filter:saturate(1.4) brightness(1.15);transform:scale(${esc});opacity:${1 - fuera}">JUEGOS</div>
      <div class="titulo" style="left:${x}px;top:${y}px;width:${ancho}px;height:${alto}px;display:flex;align-items:center;justify-content:center;font-size:${tam}px;letter-spacing:.01em;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.8);transform:scale(${esc});opacity:${1 - fuera}">JUEGOS</div>`;
    const k1 = eOutX(prog(t, 100.3, 101));
    textos += `<div style="position:absolute;left:0;right:0;top:186px;height:110px;display:flex;align-items:center;justify-content:center;gap:24px;opacity:${k1 * (1 - fuera)}">
      <div style="width:104px;height:104px;flex:none;transform:rotate(${lerp(-90, 0, k1)}deg)">${LOGO}</div>
      <div class="titulo" style="position:static;font-family:'Space Grotesk';font-weight:700;text-transform:none;font-size:80px;letter-spacing:-.03em" translate="no">Paginita-Pro</div></div>`;
    if (t >= 102) { const k2 = eOutX(prog(t, 102, 102.4)); textos += `<div class="chip" style="left:50%;top:810px;font-size:56px;padding:18px 40px;background:var(--nar);color:#fff;transform:translateX(-50%) scale(${lerp(1.4, 1, k2)});opacity:${k2 * (1 - fuera)}">Ya disponible</div>`; }
    if (t >= 103) textos += `<div class="centro mono" style="top:940px;font-size:46px;font-weight:700;opacity:${prog(t, 103, 103.4) * (1 - fuera)}">paginita-pro.cl</div>`;
    flash = Math.max(0, .9 - (t - 100) * 2.5) + (t >= 102 ? Math.max(0, .3 - (t - 102) * 3) : 0);
    if (fuera > 0) tomas += `<div class="capa" style="background:#000;opacity:${fuera}"></div>`;
  }
  return { tomas, textos, flash, barras, grano };
}
