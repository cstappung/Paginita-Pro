/* HaxBall — el marco: la cancha en un canvas, los controles, la práctica
   contra bots y el lado en línea. La física es `motor.js`.

   En línea cada uno mueve su disco y lo publica; la pelota la lleva quien
   dirige (el primer asiento presente, como los enemigos de Boxhead) y la
   publica en su estado como `w`. Los demás simulan la pelota por su cuenta
   (para que pegarle se sienta inmediato) y la acercan a la del director.
   Una patada ajena llega como un contador `kc` que sube: el director la
   aplica si ese disco está al alcance. Al registro va solo el gol, que
   escribe el director (ver `redHaxball`).

   @controles: tactil teclado */
(function () {
  'use strict';
  if (window.__haxball) return;
  const M = window.HaxballMotor, C = M.C;
  const ONLINE = new URLSearchParams(location.search).get('modo') === 'online' && parent !== window;
  const $ = id => document.getElementById(id);
  const lienzo = $('lienzo'), g = lienzo.getContext('2d');
  const COLOR = { rojo: '#e56e56', azul: '#5689e5' };
  const NOMBRE_EQ = { rojo: 'Rojo', azul: 'Azul' };
  const otro = e => e === 'rojo' ? 'azul' : 'rojo';
  const TICK = 1 / 60, CELEBRA_S = 2.5, REINTENTO_GOL = 3;

  // ---------- estado ----------
  let m = M.crea();
  let YO = 'yo', jugando = false, pausado = false, terminado = false;
  let celebra = null, resetN = 0, tickN = 0;
  let nombres = {};
  // práctica
  let practica = { n: 1, nivel: 1, meta: 5 }, bots = [], golesLoc = { rojo: 0, azul: 0 };
  // en línea
  let cfg = null, marcador = null, V = {}, soyDir = false, dirUid = null, ultimoW = null;
  let kc = 0, kcVisto = {}, tgt = {}, bolaTgt = null, rVisto = 0, golPend = null, golEnviado = 0;

  function enviar(tipo, d) { if (ONLINE) parent.postMessage(Object.assign({ canal: 'haxball-hijo', tipo }, d || {}), location.origin); }

  // ---------- sonido ----------
  let A = null;
  function audio() {
    if (!A) { try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch { A = null; } }
    if (A && A.state === 'suspended') A.resume();
    return A;
  }
  function tono(f, dur, tipo, vol, f2) {
    const a = A; if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), v = a.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    v.gain.setValueAtTime(vol || 0.2, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function ruido(dur, vol, filtro) {
    const a = A; if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = filtro || 800; v.gain.value = vol || 0.2;
    s.connect(f).connect(v).connect(a.destination); s.start();
  }
  function son(k, suave) {
    if (!A) return;
    const s = suave ? 0.5 : 1;
    if (k === 'patada') { tono(180, 0.09, 'sine', 0.35 * s, 60); ruido(0.04, 0.15 * s, 2500); }
    else if (k === 'rebote') tono(520, 0.05, 'triangle', 0.08);
    else if (k === 'silbato') { tono(2300, 0.18, 'sine', 0.12); setTimeout(() => tono(2300, 0.32, 'sine', 0.12), 220); }
    else if (k === 'gol') { ruido(1.6, 0.25, 600); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono(f, 0.35, 'square', 0.06), i * 110)); }
    else if (k === 'fin') { tono(2300, 0.25, 'sine', 0.12); setTimeout(() => tono(2300, 0.25, 'sine', 0.12), 300); setTimeout(() => tono(2300, 0.7, 'sine', 0.12), 600); }
  }

  // ---------- entrada ----------
  const teclas = new Set();
  let toque = null, pateaToque = false;
  addEventListener('keydown', e => {
    audio();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (jugando && !ONLINE && !terminado) pausa(!pausado); return; }
    teclas.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => teclas.delete(e.code));
  addEventListener('blur', () => { teclas.clear(); toque = null; pateaToque = false; });
  lienzo.addEventListener('pointerdown', e => {
    audio();
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    lienzo.setPointerCapture?.(e.pointerId);
    if (e.clientX < innerWidth / 2 && !toque) toque = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    else pateaToque = e.pointerId;
  });
  lienzo.addEventListener('pointermove', e => { if (toque && e.pointerId === toque.id) { toque.x = e.clientX; toque.y = e.clientY; } });
  const suelta = e => {
    if (toque && e.pointerId === toque.id) toque = null;
    if (pateaToque === e.pointerId) pateaToque = false;
  };
  lienzo.addEventListener('pointerup', suelta);
  lienzo.addEventListener('pointercancel', suelta);

  function entrada() {
    if (terminado || pausado) return { x: 0, y: 0, k: false };
    let x = 0, y = 0;
    if (teclas.has('KeyA') || teclas.has('ArrowLeft')) x -= 1;
    if (teclas.has('KeyD') || teclas.has('ArrowRight')) x += 1;
    if (teclas.has('KeyW') || teclas.has('ArrowUp')) y -= 1;
    if (teclas.has('KeyS') || teclas.has('ArrowDown')) y += 1;
    if (toque) {
      const dx = toque.x - toque.x0, dy = toque.y - toque.y0, l = Math.hypot(dx, dy);
      if (l > 6) { const f = Math.min(1, l / 45); x = dx / l * f; y = dy / l * f; }
    }
    const k = teclas.has('Space') || teclas.has('KeyX') || teclas.has('ShiftLeft') || pateaToque !== false;
    return { x, y, k };
  }

  // ---------- mundo ----------
  const miJ = () => m.J.get(YO);
  function arma(lista) {
    m = M.crea();
    for (const [u, e] of lista) M.agrega(m, u, e);
    M.alinea(m, 'rojo');
    celebra = null; resetN = 0; tickN = 0; terminado = false;
  }

  function practicaNueva() {
    const n = practica.n;
    YO = 'yo'; nombres = { yo: 'Tú' };
    const lista = [['yo', 'rojo']];
    bots = [];
    const papelR = ['def', 'del'], papelA = ['del', 'def', 'del'];
    for (let i = 1; i < n; i++) { const u = 'r' + i; lista.push([u, 'rojo']); nombres[u] = 'Bot ' + (i + 1); bots.push({ u, papel: papelR[(i - 1) % 2] }); }
    for (let i = 0; i < n; i++) { const u = 'a' + i; lista.push([u, 'azul']); nombres[u] = 'Rival ' + (i + 1); bots.push({ u, papel: papelA[i % 3] }); }
    golesLoc = { rojo: 0, azul: 0 };
    arma(lista);
    jugando = true; pausado = false;
    $('menu').hidden = true; $('fin').hidden = true; $('pausa').hidden = true;
    son('silbato');
    pintaMarca();
  }

  function goles() { return ONLINE ? (marcador ? marcador.goles : { rojo: 0, azul: 0 }) : golesLoc; }
  function meta() { return ONLINE ? (cfg && cfg.meta) || 5 : practica.meta; }

  function pintaMarca() {
    const gl = goles();
    $('gR').textContent = gl.rojo | 0; $('gA').textContent = gl.azul | 0;
    $('meta').textContent = 'a ' + meta();
  }

  let bannerT = null;
  function banner(txt, color) {
    const b = $('banner');
    b.textContent = txt; b.style.color = color || '';
    b.classList.add('ver');
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('ver'), 2200);
  }

  // Un gol visto por quien lleva la pelota.
  function golDetectado(gl) {
    celebra = { e: gl.e, t: CELEBRA_S, por: gl.por || '' };
    if (ONLINE) {
      const total = (marcador ? marcador.goles.rojo + marcador.goles.azul : 0);
      golPend = { e: gl.e, n: Math.max(total, golEnviado) + 1, por: gl.por || '', t: 0 };
      mandaGol();
    } else {
      golesLoc[gl.e]++;
      anunciaGol(gl.e, gl.por);
      pintaMarca();
      if (golesLoc[gl.e] >= practica.meta) terminaPractica(gl.e);
    }
  }
  function mandaGol() {
    if (!golPend) return;
    golEnviado = Math.max(golEnviado, golPend.n);
    golPend.t = REINTENTO_GOL;
    enviar('gol', { e: golPend.e, n: golPend.n, por: golPend.por });
  }
  function anunciaGol(e, por) {
    const quien = por && nombres[por] ? ' · ' + nombres[por] : '';
    banner('¡GOL de ' + NOMBRE_EQ[e] + '!' + quien, COLOR[e]);
    son('gol');
  }
  function reanuda() {
    const e = celebra.e;
    celebra = null;
    if (terminado) return;
    M.alinea(m, otro(e));
    resetN++;
    son('silbato');
  }

  function terminaPractica(e) {
    terminado = true;
    setTimeout(() => {
      son('fin');
      $('finTxt').textContent = e === 'rojo' ? '¡Ganaste ' + golesLoc.rojo + ' a ' + golesLoc.azul + '!' : 'Perdiste ' + golesLoc.rojo + ' a ' + golesLoc.azul + '.';
      $('otra').hidden = false;
      $('fin').hidden = false;
    }, 1200);
  }

  function pausa(on) {
    pausado = on;
    $('pausa').hidden = !on;
    teclas.clear();
  }

  // ---------- en línea ----------
  function config(c) {
    if (cfg) return;
    cfg = {
      yo: String(c.yo || ''), mirando: !!c.mirando, meta: [3, 5, 7].includes(c.meta | 0) ? c.meta | 0 : 5,
      equipos: c.equipos && typeof c.equipos === 'object' ? c.equipos : {},
      jugadores: (c.jugadores || []).map((j, i) => ({ uid: String(j.uid), nombre: String(j.nombre || 'Jugador'), orden: Number.isInteger(j.orden) ? j.orden : i })),
    };
    YO = cfg.mirando ? '' : cfg.yo;
    nombres = {};
    const lista = [];
    cfg.jugadores.sort((a, b) => a.orden - b.orden).forEach((j, i) => {
      nombres[j.uid] = j.nombre;
      const e = cfg.equipos[j.uid] === 'azul' || cfg.equipos[j.uid] === 'rojo' ? cfg.equipos[j.uid] : (i % 2 ? 'azul' : 'rojo');
      lista.push([j.uid, e]);
    });
    arma(lista);
    if (marcador) aplicaFuera();
    jugando = true;
    $('menu').hidden = true;
    eligeDirector();
    son('silbato');
    pintaMarca();
  }

  function eligeDirector() {
    if (!ONLINE) { soyDir = true; dirUid = YO; return; }
    if (!cfg) return;
    const f = new Set(marcador ? marcador.fuera : []), p = [];
    for (const j of [...cfg.jugadores].sort((a, b) => a.orden - b.orden)) {
      if (f.has(j.uid)) continue;
      if (j.uid === cfg.yo) { if (!cfg.mirando) p.push({ uid: j.uid, h: document.hidden }); }
      else if (V[j.uid]) p.push({ uid: j.uid, h: !!V[j.uid].h });
    }
    const a = p.find(x => !x.h) || p[0];
    const nuevo = a ? a.uid : null;
    const era = soyDir;
    dirUid = nuevo; soyDir = !!nuevo && nuevo === cfg.yo;
    if (soyDir && !era && ultimoW) adopta(ultimoW);
  }

  // Quien pasa a dirigir sigue desde lo último que publicó el anterior.
  function adopta(w) {
    leeBola(w, true);
    m.saque = w.s || null; resetN = w.r | 0; m.ult = typeof w.u === 'string' ? w.u : '';
    m.gol = null; celebra = null;
    if (w.c === 'rojo' || w.c === 'azul') {
      m.gol = { e: w.c, por: w.p || '' };
      celebra = { e: w.c, t: CELEBRA_S, por: w.p || '' };
      const total = marcador ? marcador.goles.rojo + marcador.goles.azul : 0;
      if ((w.g | 0) > total) { golPend = { e: w.c, n: w.g | 0, por: w.p || '', t: 0 }; mandaGol(); }
    }
  }

  const num = (x, d) => Number.isFinite(+x) ? +x : (d || 0);
  function leeBola(w, duro) {
    if (!Array.isArray(w.b)) return;
    const [x, y, vx, vy] = w.b.map(v => num(v));
    bolaTgt = { x, y, vx, vy };
    if (duro) { m.b.x = x; m.b.y = y; m.b.vx = vx; m.b.vy = vy; }
  }

  function llegaVivo(v) {
    V = v && typeof v === 'object' ? v : {};
    if (!cfg) return;
    for (const u of Object.keys(V)) {
      const s = V[u];
      if (!s || typeof s !== 'object' || u === YO) continue;
      const j = m.J.get(u);
      if (j) {
        const t = tgt[u] || (tgt[u] = { x: j.d.x, y: j.d.y, vx: 0, vy: 0, n: 0 });
        t.x = num(s.x, j.d.x); t.y = num(s.y, j.d.y); t.vx = num(s.vx); t.vy = num(s.vy); t.n = 0;
        if (Math.hypot(t.x - j.d.x, t.y - j.d.y) > 60) { j.d.x = t.x; j.d.y = t.y; }
        j.k = !!s.k;
        const k = s.kc | 0;
        if (kcVisto[u] === undefined) kcVisto[u] = k;
        else if (k > kcVisto[u]) {
          kcVisto[u] = k;
          const cerca = M.alcance(j.d, m.b, 14);
          if (soyDir && cerca && !celebra) {
            const dx = m.b.x - j.d.x, dy = m.b.y - j.d.y, dd = Math.hypot(dx, dy) || 1;
            m.b.vx += dx / dd * C.PATADA * m.b.im; m.b.vy += dy / dd * C.PATADA * m.b.im;
            m.ult = u;
            if (m.saque) m.saque = null;
          }
          if (cerca) son('patada', true);
        }
      }
    }
    eligeDirector();
    const w = dirUid && dirUid !== YO && V[dirUid] && V[dirUid].w;
    if (w && typeof w === 'object') {
      ultimoW = w;
      if (!soyDir) {
        if ((w.r | 0) !== rVisto) {
          rVisto = w.r | 0; resetN = rVisto;
          M.alinea(m, w.s || null);
          son('silbato');
        }
        if (!w.s) m.saque = null;
        leeBola(w, false);
      }
    }
  }

  function aplicaFuera() {
    for (const u of marcador.fuera) if (m.J.has(u) && u !== YO) m.J.delete(u);
  }

  function llegaMarcador(x) {
    const antes = marcador;
    marcador = {
      goles: { rojo: (x.goles && x.goles.rojo) | 0, azul: (x.goles && x.goles.azul) | 0 },
      puntos: x.puntos || {}, fuera: Array.isArray(x.fuera) ? x.fuera : [], meta: x.meta | 0, fin: x.fin || null,
    };
    if (!cfg) return;
    aplicaFuera();
    const total = marcador.goles.rojo + marcador.goles.azul;
    if (golPend && total >= golPend.n) golPend = null;
    if (antes) {
      for (const e of M.EQUIPOS) if (marcador.goles[e] > antes.goles[e]) {
        let por = '';
        for (const u of Object.keys(marcador.puntos)) if ((marcador.puntos[u] | 0) > ((antes.puntos || {})[u] | 0)) por = u;
        anunciaGol(e, por);
      }
    }
    pintaMarca();
    if (marcador.fin && !terminado) {
      terminado = true;
      const gan = String(marcador.fin.ganador || ''), e = gan.startsWith('eq:') ? gan.slice(3) : '';
      const mio = cfg.equipos[cfg.yo];
      const txt = !e ? 'Partido sin ganador.' : (!cfg.mirando && mio === e ? '¡Ganó tu equipo!' : 'Ganó ' + NOMBRE_EQ[e] + '.');
      setTimeout(() => {
        son('fin');
        $('finTxt').textContent = txt + ' ' + marcador.goles.rojo + ' – ' + marcador.goles.azul;
        $('otra').hidden = true;
        $('fin').hidden = false;
      }, 1200);
    }
  }

  function publica() {
    const j = miJ();
    const e = { h: document.hidden };
    if (j) { e.x = +j.d.x.toFixed(2); e.y = +j.d.y.toFixed(2); e.vx = +j.d.vx.toFixed(3); e.vy = +j.d.vy.toFixed(3); e.k = j.k ? 1 : 0; e.kc = kc; }
    if (soyDir) {
      const b = m.b;
      e.w = {
        b: [+b.x.toFixed(2), +b.y.toFixed(2), +b.vx.toFixed(3), +b.vy.toFixed(3)],
        s: m.saque || '', r: resetN, u: m.ult || '', c: celebra ? celebra.e : '',
        g: golPend ? golPend.n : golEnviado, p: celebra ? celebra.por : '',
      };
    }
    enviar('estado', { e });
  }

  addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.canal !== 'haxball-padre') return;
    if (d.tipo === 'config') config(d);
    else if (d.tipo === 'vivo') llegaVivo(d.v || {});
    else if (d.tipo === 'marcador') llegaMarcador(d);
  });

  // ---------- el tick ----------
  let pateaba = false;
  function paso() {
    if (!jugando || pausado) return;
    const entradas = {}, fijos = {};
    const yo = miJ();
    if (yo) {
      const en = entrada();
      entradas[YO] = en;
      if (en.k && !pateaba) kc++;
      pateaba = en.k;
    }
    if (ONLINE) {
      for (const [u, j] of m.J) {
        if (u === YO) continue;
        fijos[u] = true;
        const t = tgt[u];
        if (t) {
          if (t.n < 30) { t.x += t.vx; t.y += t.vy; t.n++; }
          j.d.vx = t.vx + (t.x - j.d.x) * 0.25; j.d.vy = t.vy + (t.y - j.d.y) * 0.25;
        } else { j.d.vx = j.d.vy = 0; }
      }
    } else {
      for (const b of bots) entradas[b.u] = celebra || terminado ? { x: 0, y: 0, k: false } : M.bot(m, b.u, b.papel, practica.nivel);
    }
    const ev = M.paso(m, entradas, fijos);
    if (ev.patadas.length) son('patada', !ev.patadas.includes(YO));
    if (ev.rebote) son('rebote');
    if (ONLINE && !soyDir && bolaTgt) {
      bolaTgt.vx *= C.AMORT_B; bolaTgt.vy *= C.AMORT_B;
      bolaTgt.x += bolaTgt.vx; bolaTgt.y += bolaTgt.vy;
      const b = m.b, dx = bolaTgt.x - b.x, dy = bolaTgt.y - b.y;
      if (Math.hypot(dx, dy) > 40) { b.x = bolaTgt.x; b.y = bolaTgt.y; b.vx = bolaTgt.vx; b.vy = bolaTgt.vy; }
      else if (!ev.toque) { b.x += dx * 0.3; b.y += dy * 0.3; b.vx += (bolaTgt.vx - b.vx) * 0.3; b.vy += (bolaTgt.vy - b.vy) * 0.3; }
    }
    if (ev.gol && soyDir && !celebra && !terminado) golDetectado(ev.gol);
    if (celebra && (soyDir || !ONLINE)) { celebra.t -= TICK; if (celebra.t <= 0) reanuda(); }
    if (golPend) { golPend.t -= TICK; if (golPend.t <= 0) mandaGol(); }
    tickN++;
    if (ONLINE && tickN % 3 === 0) publica();
  }

  // ---------- dibujo ----------
  let escala = 1, ox = 0, oy = 0;
  function ajusta() {
    const r = devicePixelRatio || 1;
    lienzo.width = Math.round(innerWidth * r); lienzo.height = Math.round(innerHeight * r);
    const arriba = 54;
    escala = Math.min(innerWidth / (2 * C.LIM_X + 20), (innerHeight - arriba) / (2 * C.LIM_Y + 20)) * r;
    ox = lienzo.width / 2; oy = (lienzo.height + arriba * r) / 2;
  }
  addEventListener('resize', ajusta);
  ajusta();

  function circulo(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
  function dibuja() {
    const W = lienzo.width, H = lienzo.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#5f7a4b'; g.fillRect(0, 0, W, H);
    g.setTransform(escala, 0, 0, escala, ox, oy);
    // pasto a franjas
    g.fillStyle = '#718c5a'; g.fillRect(-C.LIM_X, -C.LIM_Y, 2 * C.LIM_X, 2 * C.LIM_Y);
    for (let x = -C.W, i = 0; x < C.W; x += 74, i++) {
      g.fillStyle = i % 2 ? '#6c9a4f' : '#76a558';
      g.fillRect(x, -C.H, Math.min(74, C.W - x), 2 * C.H);
    }
    // líneas
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    g.strokeRect(-C.W, -C.H, 2 * C.W, 2 * C.H);
    g.beginPath(); g.moveTo(0, -C.H); g.lineTo(0, C.H); g.stroke();
    circulo(0, 0, C.CIRCULO); g.stroke();
    if (m.saque) { g.fillStyle = COLOR[m.saque] + '33'; circulo(0, 0, C.CIRCULO); g.fill(); }
    // arcos
    for (const s of [-1, 1]) {
      const x0 = s * C.W, x1 = s * (C.W + C.D);
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.fillRect(Math.min(x0, x1), -C.G, C.D, 2 * C.G);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      g.beginPath();
      for (let y = -C.G; y <= C.G; y += 10) { g.moveTo(x0, y); g.lineTo(x1, y); }
      for (let k = 0; k <= C.D; k += 10) { g.moveTo(x0 + s * k, -C.G); g.lineTo(x0 + s * k, C.G); }
      g.stroke();
      g.strokeStyle = '#222'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, -C.G); g.lineTo(x1, -C.G); g.lineTo(x1, C.G); g.lineTo(x0, C.G); g.stroke();
    }
    for (const p of M.POSTES) {
      circulo(p.x, p.y, p.r); g.fillStyle = p.x < 0 ? '#f0a698' : '#a9c3f0'; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke();
    }
    // jugadores
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [u, j] of m.J) {
      const d = j.d;
      if (u === YO) { circulo(d.x, d.y, d.r + 6); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.stroke(); }
      circulo(d.x, d.y, d.r); g.fillStyle = COLOR[j.e]; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = j.k ? '#fff' : '#111'; g.stroke();
      const n = nombres[u] || '';
      g.fillStyle = '#fff'; g.font = 'bold 13px system-ui,sans-serif';
      g.fillText((n[0] || '?').toUpperCase(), d.x, d.y + 1);
      g.font = '11px system-ui,sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillText(n.slice(0, 14), d.x, d.y + d.r + 12);
    }
    // pelota
    circulo(m.b.x, m.b.y, m.b.r); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke();
    // joystick táctil
    if (toque) {
      const r = devicePixelRatio || 1;
      g.setTransform(r, 0, 0, r, 0, 0);
      circulo(toque.x0, toque.y0, 45); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
      circulo(toque.x, toque.y, 20); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    }
  }

  // ---------- bucle ----------
  let antes = performance.now(), acc = 0;
  function cuadro(t) {
    const dt = Math.min(0.25, (t - antes) / 1000); antes = t;
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < 10) { paso(); acc -= TICK; n++; }
    if (n === 10) acc = 0;
    dibuja();
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
  // Una pestaña oculta no tiene rAF; en línea el partido sigue igual.
  setInterval(() => {
    if (!document.hidden || !ONLINE) return;
    for (let i = 0; i < 6; i++) paso();
    antes = performance.now();
  }, 100);

  // ---------- menú ----------
  function marcaSel(grupo, attr, v) {
    for (const b of document.querySelectorAll('[data-' + grupo + ']')) b.classList.toggle('sel', b.dataset[grupo] === String(v));
  }
  for (const b of document.querySelectorAll('[data-n]')) b.addEventListener('click', () => { practica.n = +b.dataset.n; marcaSel('n', 'n', practica.n); });
  for (const b of document.querySelectorAll('[data-nivel]')) b.addEventListener('click', () => { practica.nivel = +b.dataset.nivel; marcaSel('nivel', 'nivel', practica.nivel); });
  for (const b of document.querySelectorAll('[data-meta]')) b.addEventListener('click', () => { practica.meta = +b.dataset.meta; marcaSel('meta', 'meta', practica.meta); });
  marcaSel('n', 'n', practica.n); marcaSel('nivel', 'nivel', practica.nivel); marcaSel('meta', 'meta', practica.meta);
  $('jugar').addEventListener('click', () => { audio(); if (!ONLINE) practicaNueva(); });
  $('otra').addEventListener('click', () => { audio(); practicaNueva(); });
  $('menuFin').addEventListener('click', () => { $('fin').hidden = true; jugando = false; $('menu').hidden = false; });
  $('seguir').addEventListener('click', () => pausa(false));
  $('aMenu').addEventListener('click', () => { pausa(false); jugando = false; $('menu').hidden = false; });
  if (ONLINE) {
    $('opciones').hidden = true;
    $('cuenta').textContent = 'Esperando a que empiece la sala…';
    $('jugar').hidden = true;
    $('menuFin').hidden = true;
  }
  pintaMarca();

  if (window.Mando) Mando.configura({
    stick: { izq: 'KeyA', der: 'KeyD', arriba: 'KeyW', abajo: 'KeyS' },
    botones: {
      a: 'Space', rt: 'Space', x: 'Space', izq: 'KeyA', der: 'KeyD', arriba: 'KeyW', abajo: 'KeyS',
      start: () => { if (jugando && !ONLINE && !terminado) pausa(!pausado); },
    },
    menu: () => !jugando || pausado || terminado,
    inicio: '#jugar',
    zonas: [{ sel: '#ayuda' }, { sel: '#menuAyuda' }],
    pistas: [['stickL', 'moverte'], ['a x rt', 'patear'], ['start', 'pausa']],
  });

  window.__haxball = {
    paso: n => { for (let i = 0; i < (n || 1); i++) paso(); },
    estado: () => ({ jugando, terminado, soyDir, dirUid, goles: Object.assign({}, goles()), bola: { x: m.b.x, y: m.b.y }, saque: m.saque, jugadores: m.J.size }),
    practica: o => { Object.assign(practica, o || {}); practicaNueva(); },
  };
  enviar('listo');
})();
