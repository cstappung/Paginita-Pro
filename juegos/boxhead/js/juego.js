/* Boxhead — el juego: un canvas visto desde arriba, en tres cuartos.

   **Una sola forma de jugar, sola o en sala.** En práctica todo es local:
   este marco dirige a los enemigos y lleva el nivel. En una sala
   (`?modo=online`) el marco habla con su cartero
   (`colabtex/src/juegos/boxhead.js`) y por él con los demás marcos:

   - **Cada uno manda su propio estado** unas doce veces por segundo
     (posición, vida, arma, puntos, golpes, disparos). Viaja por la malla
     WebRTC, no por la base.
   - **Los enemigos los mueve uno solo, el director**: el primer asiento
     presente (y con la pestaña visible si hay alguno así). Publica a los
     enemigos dentro de su estado (`zb`) y los demás los dibujan. Si se va,
     el siguiente adopta el último `zb` que vio y sigue desde ahí.
   - **Un golpe es una entrada de la lista `g`** del que lo da: `[id,
     destino, daño, arma, extra]`. El destino es un uid (lo aplica la
     víctima), `e:<id>` (un enemigo: lo aplica el director, que sabe a quién
     acreditar la baja), `o:<id>` (un objeto puesto) o `p` (una petición al
     director: poner un objeto, detonar las cargas, recoger una caja). Los ids
     solo crecen, así que cada marco aplica lo que pasa de su marca.
   - **Al registro solo va lo que decide la partida**: cuándo muere cada uno
     y, en cooperativo, cuándo se limpió un nivel (lo manda el director). */
(function () {
  'use strict';
  if (window.__boxhead) return;
  const D = window.BoxheadDatos, TS = D.TS, DIRS = D.DIRS;
  const qs = new URLSearchParams(location.search);
  const ONLINE = qs.get('modo') === 'online' && window.parent !== window;
  const PALETA = ['#e74c3c', '#3d8fe0', '#37c25b', '#f1c40f', '#a66bd6', '#e67e22', '#1abc9c', '#ecf0f1'];
  const OBJ = ['barril', 'muro', 'carga'];
  const VIDA_OBJ = { barril: 30, muro: 160, carga: 1e9 };
  const $ = id => document.getElementById(id);
  const cv = $('lienzo'), cx = cv.getContext('2d');
  const lee = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const azar = (a, b) => a + Math.random() * (b - a);

  // ---------- estado ----------
  let cfg = null, M = null;
  let jugando = false, pausado = false, terminado = false;
  let marcador = { nivel: 1, caidos: [], bajas: {}, muertes: {}, puntos: {}, fuera: [], fin: null };
  let skinId = D.skin(lee('boxhead.skin', 'bambo')).id;
  let mapaElegido = D.mapaValido(lee('boxhead.mapa', 'patio'));
  let ultimoId = 0;
  const nid = () => (ultimoId = Math.max(ultimoId + 1, Date.now()));
  let T = 0, nivelLocal = 1, nivelVisto = 0, misBajas = 0;

  let yo = nuevoYo();
  function nuevoYo() {
    const ammo = D.ARMAS.map(a => (a.id === 0 ? Infinity : 0));
    return { x: 0, y: 0, d: 2, v: false, hp: 100, w: 0, pts: 0, mul: 1, maxMul: 1, combo: 0, comboMax: 1, k: 0, ammo,
      tiene: new Set([0]), mejoras: new Set(), arm: 0, pot: 0, cd: 0, mov: false, muerto: false, nivelMuerte: 0, respawn: 0, inv: 0, fin: 0 };
  }

  // El mundo: lo que simula el director y lo que los demás reflejan.
  const E = new Map(), O = new Map(), B = new Map();
  let F = [];
  const dir = { n: 0, q: 0, t: 0, ritmo: 1.5, m: [], x: [], pedido: 0, pedidoT: -99, cola: [] };
  let soyDir = false, ultimoZb = null, dirUid = null;
  const ocultas = new Set();           // cajas que recogí y el director aún no borró

  // La red.
  let V = {};                           // uid → último estado que llegó
  const R = new Map();                  // jugadores remotos, interpolados
  const marca = new Map();              // uid → mayor id de golpe aplicado
  const visto = { s: new Map(), n: new Map(), x2: new Map() };
  const vistosM = new Set(), vistosX = new Set();
  let misG = [];
  const pend = { s: [], n: [], x2: [] }, cur = { s: null, n: null, x2: null };

  // Efectos, solo de pantalla.
  let manchas = [], trazos = [], parts = [], booms = [], proy = [];

  // ---------- entrada ----------
  const teclas = new Set();
  const TECLA_TIENDA = {};
  for (const t of D.TIENDA) TECLA_TIENDA['Key' + t.tecla] = t.id;
  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat && e.code !== 'Space') { teclas.add(e.code); return; }
    teclas.add(e.code);
    audio();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (jugando && !terminado) ponPausa(!pausado); return; }
    if (!jugando || pausado || quienPausa() || !yo.v || yo.muerto) return;
    if (e.code === 'KeyQ') cicla(-1);
    else if (e.code === 'KeyE') cicla(1);
    else if (e.code === 'KeyX') detona();
    else if (/^Digit[1-8]$/.test(e.code)) eligeArma(+e.code.slice(5) - 1);
    else { const t = TECLA_TIENDA[e.code]; if (t) compra(t); }
  });
  addEventListener('keyup', e => teclas.delete(e.code));
  addEventListener('blur', () => teclas.clear());

  if (window.Mando) Mando.configura({
    stick: { izq: 'KeyA', der: 'KeyD', arriba: 'KeyW', abajo: 'KeyS' },
    botones: {
      a: 'Space', rt: 'Space', lb: 'KeyQ', rb: 'KeyE', x: 'KeyX', y: 'KeyB',
      izq: 'KeyA', der: 'KeyD', arriba: 'KeyW', abajo: 'KeyS',
      start: () => { if (jugando && !terminado) ponPausa(!pausado); },
    },
    menu: () => !jugando || pausado || terminado,
    inicio: '#jugar',
    zonas: [{ sel: '#ayuda' }, { sel: '#menuAyuda' }],
    pistas: [['stickL', 'moverte'], ['a rt', 'disparar'], ['lb rb', 'cambiar arma'], ['x', 'detonar cargas'], ['y', 'comprar munición en la tienda'], ['start', 'pausa']],
  });

  // ---------- el mapa ----------
  const celda = (tx, ty) => (tx < 0 || ty < 0 || tx >= M.ancho || ty >= M.alto) ? 1 : M.celdas[ty * M.ancho + tx];
  // Radio con el que se le pega (un jefe es más grande de lo que choca).
  const RG = k => D.ENEMIGOS[k].rg || D.ENEMIGOS[k].radio;
  const solidoEn = (x, y) => celda(Math.floor(x / TS), Math.floor(y / TS)) !== 0;
  function cajaObj(o) {
    if (o.k === 'muro') return [o.x - TS / 2, o.y - TS / 2, o.x + TS / 2, o.y + TS / 2];
    if (o.k === 'barril') return [o.x - 9, o.y - 9, o.x + 9, o.y + 9];
    return null;
  }
  // ¿Choca un cuerpo de radio r en (x, y)? Devuelve true, el objeto o null.
  function choca(x, y, r, ign) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (celda(tx, ty) !== 0) return true;
    for (const o of O.values()) {
      if (ign && ign.has(o)) continue;
      const b = cajaObj(o);
      if (b && x + r > b[0] && x - r < b[2] && y + r > b[1] && y - r < b[3]) return o;
    }
    return null;
  }
  // Mueve por ejes; devuelve el objeto contra el que chocó, si fue uno.
  // Lo que ya se pisa al empezar no frena: un muro puesto encima (por otro
  // jugador, o por el retardo de la red) dejaba al cuerpo clavado en él.
  function encima(c, r) {
    let s = null;
    for (const o of O.values()) {
      const b = cajaObj(o);
      if (b && c.x + r > b[0] && c.x - r < b[2] && c.y + r > b[1] && c.y - r < b[3]) (s || (s = new Set())).add(o);
    }
    return s;
  }
  function mover(c, dx, dy, r) {
    let bloq = null;
    const ign = encima(c, r);
    if (dx) { const h = choca(c.x + dx, c.y, r, ign); if (!h) c.x += dx; else if (h !== true) bloq = h; }
    if (dy) { const h = choca(c.x, c.y + dy, r, ign); if (!h) c.y += dy; else if (h !== true) bloq = h; }
    return bloq;
  }
  function despejado(x1, y1, x2, y2) {
    const n = Math.ceil(dist(x1, y1, x2, y2) / 8);
    for (let i = 1; i < n; i++) if (solidoEn(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)) return false;
    return true;
  }

  // ---------- configuración y arranque ----------
  function jugadores() { return cfg ? cfg.jugadores : []; }
  const fueraSet = () => new Set(marcador.fuera || []);
  const nombreDe = u => (jugadores().find(j => j.uid === u) || {}).nombre || 'Jugador';
  const ordenDe = u => { const j = jugadores().find(j => j.uid === u); return j ? j.orden : 0; };
  const colorDe = u => PALETA[ordenDe(u) % PALETA.length];
  const versus = () => cfg && cfg.variante === 'versus';
  const activos = () => { const f = fueraSet(); return jugadores().filter(j => !f.has(j.uid)); };

  function cargaMundo(mapa) {
    M = D.cargaMapa(mapa);
    E.clear(); O.clear(); B.clear(); F = []; ocultas.clear();
    Object.assign(dir, { n: 0, q: 0, t: 0, ritmo: 1.5, m: [], x: [], pedido: 0, pedidoT: -99, cola: [] });
    manchas = []; trazos = []; parts = []; booms = []; proy = [];
    flujo = null; flujoT = 0;
  }

  function aparece() {
    const ps = M.spawnsP;
    let p = ps[ordenDe(cfg.yo) % ps.length];
    if (versus() && T > 1) {
      let mejor = -1;
      for (const c of ps) {
        let m = 1e9;
        for (const r of R.values()) if (r.v) m = Math.min(m, dist(c.x, c.y, r.x, r.y));
        for (const e of E.values()) m = Math.min(m, dist(c.x, c.y, e.x, e.y) * 1.5);
        if (m > mejor) { mejor = m; p = c; }
      }
    }
    yo.x = p.x; yo.y = p.y; yo.hp = 100; yo.v = true; yo.muerto = false; yo.inv = 2;
  }

  function empieza() {
    jugando = true; pausado = false;
    $('menu').hidden = true; $('pausa').hidden = true; $('fin').hidden = true; $('hud').hidden = false;
    if (!cfg.mirando) aparece();
    pintaArmas(true);
    if (versus()) banner('VERSUS · ' + (cfg.meta || 10) + ' BAJAS');
  }

  function practica() {
    cfg = { yo: 'yo', mirando: false, variante: 'coop', mapa: mapaElegido, meta: 0, semilla: 1,
      jugadores: [{ uid: 'yo', nombre: 'Tú', orden: 0 }] };
    marcador = { nivel: 1, caidos: [], bajas: {}, muertes: {}, puntos: {}, fuera: [], fin: null };
    terminado = false; nivelLocal = 1; nivelVisto = 0; T = 0;
    yo = nuevoYo();
    cargaMundo(mapaElegido);
    empieza();
  }

  // ---------- armas ----------
  const armaYo = () => D.arma(yo.w, yo.mejoras);
  const disponibles = () => [...yo.tiene].sort((a, b) => a - b).filter(i => i === 0 || yo.ammo[i] > 0);
  function eligeArma(i) {
    if (!yo.tiene.has(i) || (i !== 0 && !(yo.ammo[i] > 0))) return;
    if (yo.w !== i) { yo.w = i; yo.cd = Math.max(yo.cd, 0.15); son('cambia'); }
  }
  function cicla(s) {
    const l = disponibles(); if (!l.length) return;
    const i = l.indexOf(yo.w);
    eligeArma(l[(i + s + l.length) % l.length]);
  }
  function desbloquea(id, aviso) {
    if (!yo.tiene.has(id)) { yo.tiene.add(id); yo.ammo[id] = D.ARMAS[id].ini; }
    if (aviso) premio(aviso);
  }

  function dispara() {
    if (yo.cd > 0 || !yo.v || yo.muerto) return;
    const a = Object.assign({}, armaYo());
    if (!(yo.ammo[yo.w] > 0)) { eligeArma(0); return; }
    yo.cd = a.cad;
    if (a.d) a.d = Math.round(a.d * D.factorPotencia(yo.pot));
    const ang = Math.atan2(DIRS[yo.d][1], DIRS[yo.d][0]);
    if (a.tipo === 'bala') {
      rayo(yo.x, yo.y, ang + (Math.random() - 0.5) * 2 * (a.desv || 0.012), a.alc, a.d, a.id, a.pen || 0);
      gasta(); son(a.id === 1 ? 'uzi' : 'pistola');
    } else if (a.tipo === 'perdigon') {
      for (let i = 0; i < a.perdigones; i++)
        rayo(yo.x, yo.y, ang + (i / (a.perdigones - 1) - 0.5) * a.abre + azar(-0.03, 0.03), a.alc * azar(0.85, 1), a.d, a.id, a.pen || 0);
      gasta(); son('escopeta');
    } else if (a.tipo === 'granada' || a.tipo === 'cohete') {
      const id = nid();
      lanza({ id, w: a.id, x: yo.x + Math.cos(ang) * 12, y: yo.y + Math.sin(ang) * 12, ang, mio: true, r: a.r, d: a.d, vel: a.vel });
      pend.n.push([id, a.id, Math.round(yo.x), Math.round(yo.y), Math.round(ang * 100), Math.round(a.vel || 0)]);
      gasta(); son(a.tipo === 'cohete' ? 'cohete' : 'lanza');
    } else if (a.tipo === 'objeto') {
      if (pon(a)) { gasta(); son('pon'); } else yo.cd = 0.1;
    }
  }
  function gasta() {
    if (yo.w === 0 || yo.ammo[yo.w] === Infinity) return;
    yo.ammo[yo.w]--;
    if (yo.ammo[yo.w] <= 0) { yo.ammo[yo.w] = 0; setTimeout(() => { if (!(yo.ammo[yo.w] > 0)) eligeArma(0); }, 120); }
  }

  // Bala instantánea: avanza de 4 en 4 px hasta lo primero que toque. Con
  // `pen` (mejora de penetración) atraviesa ese número de enemigos más,
  // perdiendo un 30 % de daño en cada uno; muros y barriles la paran siempre.
  function rayo(x, y, ang, alc, d, w, pen) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const heridos = new Set();
    let l = 6;
    for (; l < alc; l += 4) {
      const px = x + cs * l, py = y + sn * l;
      if (solidoEn(px, py)) break;
      let pega = false;
      for (const o of O.values()) {
        const b = cajaObj(o);
        if (b && px > b[0] && px < b[2] && py > b[1] && py < b[3]) {
          if (o.k === 'barril') golpeaObjeto(o.id, d, w);
          pega = true; break;
        }
      }
      if (pega) break;
      for (const e of E.values()) {
        if (heridos.has(e)) continue;
        if ((px - e.x) ** 2 + (py - e.y) ** 2 < (RG(e.k) + 6) ** 2) {
          golpeaEnemigo(e, d, w, x, y); heridos.add(e); d *= 0.7;
          if (heridos.size > (pen || 0)) pega = true;
          break;
        }
      }
      if (pega) break;
      if (versus()) {
        for (const [u, r] of R) if (r.v && (px - r.x) ** 2 + (py - r.y) ** 2 < 121) { golpeaJugador(u, d, w); sangre(r.x, r.y, 2); pega = true; break; }
        if (pega) break;
      }
    }
    l = Math.min(l, alc);
    trazos.push({ x1: x + cs * 8, y1: y + sn * 8, x2: x + cs * l, y2: y + sn * l, t: 0.07 });
    pend.s.push([nid(), w, Math.round(x), Math.round(y), Math.round(ang * 100), Math.round(l)]);
  }

  function lanza(p) {
    const a = D.ARMAS[p.w];
    if (a.tipo === 'cohete') { const v = p.vel || a.vel; p.vx = Math.cos(p.ang) * v; p.vy = Math.sin(p.ang) * v; p.t = 1.4; p.z = 0; }
    else { p.vx = Math.cos(p.ang) * 220; p.vy = Math.sin(p.ang) * 220; p.t = 0.7; p.t0 = 0.7; p.z = 0; }
    proy.push(p);
  }
  function pasoProy(dt) {
    for (const p of proy) {
      const a = D.ARMAS[p.w];
      p.t -= dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (a.tipo === 'granada') {
        if (solidoEn(nx, p.y)) p.vx *= -0.5; else p.x = nx;
        if (solidoEn(p.x, ny)) p.vy *= -0.5; else p.y = ny;
        p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 1.2;
        const f = 1 - p.t / p.t0; p.z = Math.sin(Math.PI * Math.min(1, f)) * 26;
        if (p.t <= 0) { p.fin = true; if (p.mio) explota(p.x, p.y, p.r, p.d, p.w, p.id); }
      } else {
        p.x = nx; p.y = ny;
        if (Math.random() < 0.7) parts.push({ x: p.x, y: p.y, vx: azar(-20, 20), vy: azar(-20, 20), t: 0.35, max: 0.35, c: '#bbb', s: 3 });
        let pega = p.t <= 0 || solidoEn(p.x, p.y);
        if (!pega) for (const o of O.values()) { const b = cajaObj(o); if (b && p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]) { pega = true; break; } }
        if (!pega) for (const e of E.values()) if (dist(p.x, p.y, e.x, e.y) < RG(e.k) + 4) { pega = true; break; }
        if (!pega && versus() && p.mio) for (const r of R.values()) if (r.v && dist(p.x, p.y, r.x, r.y) < 12) { pega = true; break; }
        if (pega) { p.fin = true; if (p.mio) explota(p.x - p.vx * dt * 0.5, p.y - p.vy * dt * 0.5, p.r, p.d, p.w, p.id); }
      }
    }
    proy = proy.filter(p => !p.fin);
  }

  const caida = (dd, r, d) => dd <= r * 0.4 ? d : Math.max(0, d * (1 - (dd - r * 0.4) / (r * 0.6)));

  // Explosión mía (granada, cohete): cada cosa la aplica quien debe.
  function explota(x, y, r, d, w, id) {
    efectoBoom(x, y, r);
    pend.x2.push([id, Math.round(x), Math.round(y), r]);
    for (const e of [...E.values()]) { const dd = dist(x, y, e.x, e.y); if (dd < r + RG(e.k)) golpeaEnemigo(e, caida(dd, r, d), w, x, y); }
    for (const o of [...O.values()]) { const dd = dist(x, y, o.x, o.y); if (dd < r && o.k !== 'carga') golpeaObjeto(o.id, caida(dd, r, d), w); }
    if (yo.v && !yo.muerto) { const dd = dist(x, y, yo.x, yo.y); if (dd < r) recibe(caida(dd, r, d) * (versus() ? 0.5 : 1 / 3), w, cfg.yo); }
    for (const [u, rr] of R) if (rr.v) { const dd = dist(x, y, rr.x, rr.y); if (dd < r) golpeaJugador(u, caida(dd, r, d) * (versus() ? 1 : 1 / 3), w); }
  }

  function pon(a) {
    const [dx, dy] = DIRS[yo.d];
    let x, y;
    if (a.obj === 'muro') {
      const tx = Math.floor((yo.x + dx * TS * 0.9) / TS), ty = Math.floor((yo.y + dy * TS * 0.9) / TS);
      if (celda(tx, ty) !== 0) return false;
      x = tx * TS + TS / 2; y = ty * TS + TS / 2;
      // Nunca encima de alguien: el muro lo dejaría encerrado dentro.
      if (Math.abs(x - yo.x) < TS / 2 + 10 && Math.abs(y - yo.y) < TS / 2 + 10) return false;
      for (const o of O.values()) if (o.k !== 'carga' && Math.abs(o.x - x) < TS && Math.abs(o.y - y) < TS) return false;
      for (const r of R.values()) if (r.v && Math.abs(r.x - x) < TS / 2 + 8 && Math.abs(r.y - y) < TS / 2 + 8) return false;
    } else {
      x = yo.x + dx * 22; y = yo.y + dy * 22;
      if (choca(x, y, a.obj === 'barril' ? 9 : 4)) return false;
    }
    x = Math.round(x); y = Math.round(y);
    const pide = { pon: [a.id, x, y, a.r || 0, a.d || 0, a.vida || 0] };
    if (soyDir) peticion(cfg.yo, pide);
    else misG.push([nid(), 'p', 0, a.id, pide]);
    return true;
  }
  function detona() {
    if (soyDir) peticion(cfg.yo, { det: 1 });
    else misG.push([nid(), 'p', 0, 7, { det: 1 }]);
    son('clic');
  }

  // ---------- golpes ----------
  // (sx, sy) es de dónde vino el golpe: hacia el otro lado sale despedido.
  function golpeaEnemigo(e, d, w, sx, sy) {
    if (d <= 0) return;
    e.flash = 0.1;
    if (Math.random() < 0.5) sangre(e.x, e.y, 1, e.k);
    if (soyDir) danaEnemigo(e.id, d, cfg.yo, w, sx, sy);
    else {
      e.tb = 1;   // el tumbo se ve ya; el director lo confirma
      misG.push([nid(), 'e:' + e.id, Math.round(d), w, Number.isFinite(sx) ? [Math.round(sx), Math.round(sy)] : 0]);
    }
  }
  function golpeaObjeto(id, d, w) {
    if (d <= 0) return;
    if (soyDir) danaObjeto(id, d, cfg.yo);
    else misG.push([nid(), 'o:' + id, Math.round(d), w, 0]);
  }
  function golpeaJugador(u, d, w, por) {
    if (d <= 0) return;
    misG.push([nid(), u, Math.round(d * 10) / 10, w, por === undefined ? cfg.yo : por]);
  }
  // Del director a un jugador (mordida, fuego, una explosión de barril).
  function golpea(u, d, w, por) {
    if (u === cfg.yo) recibe(d, w, por || '');
    else golpeaJugador(u, d, w, por || '');
  }

  let inmortal = false;   // solo para los scripts de prueba (__boxhead.inmortal)
  function recibe(d, w, por) {
    if (!yo.v || yo.muerto || terminado || d <= 0) return;
    if (yo.inv > 0 && por !== cfg.yo) return;
    // La armadura se come una parte del golpe hasta gastarse.
    if (yo.arm > 0) { const ab = Math.min(yo.arm, d * D.ARMADURA.absorbe); yo.arm -= ab; d -= ab; }
    yo.hp -= d;
    if (inmortal) yo.hp = Math.max(1, yo.hp);
    rojo = Math.min(1, rojo + d / 40);
    son('dolor');
    sangre(yo.x, yo.y, 2);
    if (yo.hp <= 0) morir(por, w);
  }

  function morir(por, w) {
    yo.hp = 0; yo.muerto = true; yo.v = false;
    sangre(yo.x, yo.y, 14);
    manchas.push({ x: yo.x, y: yo.y, r: 14, c: 'rgba(120,10,10,.75)' });
    son('muere');
    if (!ONLINE) { yo.fin = 1.4; return; }
    if (versus()) { enviar('muere', { por: por || '', w: w | 0 }); yo.respawn = 3; banner('TE MATARON'); }
    else {
      yo.nivelMuerte = marcador.nivel || 1;
      enviar('muere', { pts: yo.pts | 0, k: yo.k | 0, n: marcador.nivel || 1, w: w | 0, por: por || '' });
      banner('CAÍSTE · VUELVES EN EL PRÓXIMO NIVEL');
    }
  }

  function miBaja(k) {
    yo.pts += D.PUNTOS[k] * yo.mul;
    yo.k++;
    yo.mul++;
    if (yo.mul > yo.maxMul) {
      for (const p of D.premios(yo.maxMul, yo.mul)) {
        if (p.arma !== undefined) { if (!versus()) desbloquea(p.arma, p.txt); }
        else { yo.mejoras.add(p.mejora); premio(p.txt); }
      }
      yo.maxMul = yo.mul;
      pintaArmas(true);
    }
    yo.combo = yo.comboMax = D.duracionCombo(yo.mul);
  }

  // ---------- el director ----------
  const vivos = () => {
    const l = [];
    if (cfg && !cfg.mirando && yo.v && !yo.muerto) l.push({ uid: cfg.yo, x: yo.x, y: yo.y });
    for (const [u, r] of R) if (r.v) l.push({ uid: u, x: r.tx, y: r.ty });
    return l;
  };

  let flujo = null, flujoT = 0;
  function calculaFlujo(obj) {
    const n = M.ancho * M.alto;
    const d = flujo && flujo.length === n ? flujo : new Int32Array(n);
    d.fill(1e9);
    const cola = new Int32Array(n);
    let a = 0, b = 0;
    for (const o of obj) {
      const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS), i = ty * M.ancho + tx;
      if (i >= 0 && i < n && d[i] !== 0) { d[i] = 0; cola[b++] = i; }
    }
    while (a < b) {
      const i = cola[a++], x = i % M.ancho, y = (i / M.ancho) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (celda(nx, ny) !== 0) continue;
        const j = ny * M.ancho + nx;
        if (d[j] > d[i] + 1) { d[j] = d[i] + 1; cola[b++] = j; }
      }
    }
    flujo = d;
  }
  function siguiente(e) {
    if (!flujo) return null;
    const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS);
    const aqui = celda(tx, ty) === 0 ? flujo[ty * M.ancho + tx] : 1e9;
    let mejor = aqui, bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy;
      if (celda(nx, ny) !== 0) continue;
      if (dx && dy && (celda(tx + dx, ty) !== 0 || celda(tx, ty + dy) !== 0)) continue;
      const v = flujo[ny * M.ancho + nx] + (dx && dy ? 0.4 : 0);
      if (v < mejor) { mejor = v; bx = dx; by = dy; }
    }
    if (mejor >= aqui || mejor >= 1e9) return null;
    return { x: (tx + bx) * TS + TS / 2, y: (ty + by) * TS + TS / 2 };
  }

  // `kFijo` fuerza el tipo (un jefe, o lo que invoca); (px, py) el sitio.
  function nuevoEnemigo(n, kFijo, px, py) {
    let x = px, y = py;
    if (!Number.isFinite(x)) {
      const obj = vivos();
      let cands = M.spawnsE.filter(s => obj.every(o => dist(s.x, s.y, o.x, o.y) > TS * 5));
      if (!cands.length) cands = M.spawnsE;
      const s = cands[(Math.random() * cands.length) | 0];
      x = s.x + azar(-4, 4); y = s.y + azar(-4, 4);
    }
    const k = kFijo >= 0 ? kFijo : D.tipoEnemigo(versus() ? n + 2 : n, Math.random());
    const jefe = D.esJefe(k);
    const max = jefe ? D.vidaJefe(k, n, Math.max(1, activos().length)) : D.vidaEnemigo(k, n);
    const e = { id: nid(), k, x, y, hp: max, max, d: 0, atk: 0, cd: 0.5, cdF: azar(1, 3), flash: 0 };
    if (jefe) { e.cdH = D.ENEMIGOS[k].cd; e.est = 0; e.estT = 0; e.hitos = 0; }
    e.tx = e.x; e.ty = e.y;
    E.set(e.id, e);
    return e;
  }
  // Un invocado nace junto a quien lo llama, en un sitio libre.
  function invoca(e, k, n) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = azar(24, 46);
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      if (choca(x, y, D.ENEMIGOS[k].radio)) continue;
      const h = nuevoEnemigo(dir.n, k, x, y);
      h.de = e.id; h.cd = 0.8;
      humo(x, y);
      return h;
    }
    return null;
  }
  const hijosDe = e => { let c = 0; for (const h of E.values()) if (h.de === e.id) c++; return c; };

  /* **Un golpe empuja hacia atrás** y deja al enemigo `ATURDE` segundos sin
     perseguir ni atacar, venga de un arma o de la bola de un diablo. Sin
     origen conocido sale despedido hacia su propia espalda. */
  const ATURDE = 0.5, EMPUJE = 150;
  function danaEnemigo(id, d, quien, w, sx, sy) {
    const e = E.get(id);
    if (!e) return;
    e.hp -= d; e.flash = 0.1;
    // Un jefe no sale despedido ni se aturde: si no, se le paraba a tiros.
    if (e.hp > 0 && D.esJefe(e.k)) return;
    if (e.hp > 0) {
      let ax, ay;
      if (Number.isFinite(sx) && Number.isFinite(sy) && (sx !== e.x || sy !== e.y)) { ax = e.x - sx; ay = e.y - sy; }
      else { ax = -DIRS[e.d || 0][0]; ay = -DIRS[e.d || 0][1]; }
      const l = Math.hypot(ax, ay) || 1;
      const em = EMPUJE * (D.ENEMIGOS[e.k].masa ?? 1);
      e.aturd = ATURDE * Math.min(1, D.ENEMIGOS[e.k].masa ?? 1) + 0.1; e.kvx = ax / l * em; e.kvy = ay / l * em;
      return;
    }
    E.delete(id);
    const m = [nid(), quien || '', e.k, Math.round(e.x), Math.round(e.y)];
    dir.m.push(m); if (dir.m.length > 20) dir.m.shift();
    procesaMuerte(m);
    const C = D.ENEMIGOS[e.k];
    if (C.explota) dir.cola.push({ t: 0.05, x: e.x, y: e.y, r: C.radioExplota, d: C.explota, w: 3, u: quien || '' });
    if (C.jefe) {
      // El jefe suelta siempre un premio de cada clase.
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1, b = { id: nid(), k: i, x: Math.round(e.x + Math.cos(a) * 18), y: Math.round(e.y + Math.sin(a) * 18) };
        if (solidoEn(b.x, b.y)) { b.x = Math.round(e.x); b.y = Math.round(e.y); }
        B.set(b.id, b);
      }
      // La larva revienta en crías.
      if (C.hab === 'cria') for (let i = 0; i < 5; i++) invoca(e, 2, dir.n);
      return;
    }
    const r = Math.random();
    if (B.size < 12 && r < 0.2) {
      const b = { id: nid(), k: r < 0.11 ? 0 : r < 0.16 ? 1 : 2, x: Math.round(e.x), y: Math.round(e.y) };
      B.set(b.id, b);
    }
  }
  function danaObjeto(id, d, quien) {
    const o = O.get(id);
    if (!o || o.k === 'carga') return;
    o.hp -= d;
    if (o.hp > 0) return;
    O.delete(id);
    if (o.k === 'barril') dir.cola.push({ t: 0.12, x: o.x, y: o.y, r: o.r || 84, d: o.d || 120, w: 3, u: o.u || quien });
    else polvo(o.x, o.y);
  }
  function explotaDir(c) {
    efectoBoom(c.x, c.y, c.r);
    dir.x.push([nid(), Math.round(c.x), Math.round(c.y), c.r]); if (dir.x.length > 8) dir.x.shift();
    vistosX.add('z:' + dir.x[dir.x.length - 1][0]);
    for (const e of [...E.values()]) { const dd = dist(c.x, c.y, e.x, e.y); if (dd < c.r + RG(e.k)) danaEnemigo(e.id, caida(dd, c.r, c.d), c.u, c.w, c.x, c.y); }
    for (const o of [...O.values()]) { const dd = dist(c.x, c.y, o.x, o.y); if (dd < c.r) danaObjeto(o.id, caida(dd, c.r, c.d), c.u); }
    for (const v of vivos()) {
      const dd = dist(c.x, c.y, v.x, v.y);
      if (dd >= c.r) continue;
      const f = versus() ? (v.uid === c.u ? 0.5 : 1) : 1 / 3;
      golpea(v.uid, caida(dd, c.r, c.d) * f, c.w, c.u);
    }
  }

  /* La onda de un jefe (el pisotón del Coloso, la roca del Titán): sólo
     hiere a jugadores y objetos, nunca a otros enemigos. */
  function ondaJefe(x, y, r, d) {
    efectoBoom(x, y, r);
    dir.x.push([nid(), Math.round(x), Math.round(y), r]); if (dir.x.length > 8) dir.x.shift();
    vistosX.add('z:' + dir.x[dir.x.length - 1][0]);
    for (const o of [...O.values()]) { const dd = dist(x, y, o.x, o.y); if (dd < r) danaObjeto(o.id, caida(dd, r, d) * 0.5, ''); }
    for (const v of vivos()) { const dd = dist(x, y, v.x, v.y); if (dd < r) golpea(v.uid, caida(dd, r, d), 9, ''); }
  }

  /* **Las habilidades de los jefes.** `est` dice en qué está, y viaja en la
     red para que todos vean el aviso antes del golpe: 0 libre, 1 marca la
     onda, 2 carga (brilla), 3 ejecuta (embiste, gira, carga), 4 se
     desvanece, 5 libre pero furioso. `cdH` sólo corre libre: mientras
     avisa o ejecuta no se acumula otra habilidad. Devuelve true cuando el
     jefe está ocupado y no debe caminar ni morder este tick. */
  function bola(e, a, v, d, extra) {
    const f = Object.assign({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 3.2, d, de: e.id, k: e.k, jefe: true }, extra || {});
    F.push(f);
    return f;
  }
  function libreJefe(e, x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = azar(56, 84);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!choca(px, py, D.ENEMIGOS[e.k].radio + 2)) return [px, py];
    }
    return null;
  }
  function embiste(e, C, t, dt, v) {
    const x0 = e.x, y0 = e.y;
    const bloq = mover(e, e.vx * dt, e.vy * dt, C.radio - 1);
    e.estT -= dt;
    if (!e.pego && dist(e.x, e.y, t.x, t.y) < C.rg + 10) {
      e.pego = true;
      golpea(t.uid, D.golpeNivel(e.k, dir.n) * 1.6, 8, '');
      sacude = Math.min(10, sacude + 4);
    }
    const quieto = dist(x0, y0, e.x, e.y) < v * dt * 0.3;
    if (bloq || quieto || e.estT <= 0) {
      if (bloq) danaObjeto(bloq.id, 200, '');
      if (bloq || quieto) { sacude = Math.min(10, sacude + 3); polvo(e.x, e.y); son('golpe'); }
      e.est = e.furia ? 5 : 0; e.cd = 0.4;
    }
  }
  function jefeIA(e, C, t, dd, dt) {
    const n = dir.n, a = Math.atan2(t.y - e.y, t.x - e.x), pc = e.hp / e.max;
    // Hitos de vida: lo que pasa una sola vez al bajar de un umbral.
    if (C.hab === 'cria' && !(e.hitos & 1) && pc < 0.5) { e.hitos |= 1; for (let i = 0; i < 3; i++) invoca(e, 2, n); }
    if (C.hab === 'hidra') {
      if (!(e.hitos & 1) && pc < 0.66) { e.hitos |= 1; for (let i = 0; i < 3; i++) invoca(e, 5, n); son('jefe'); }
      if (!(e.hitos & 2) && pc < 0.33) { e.hitos |= 2; for (let i = 0; i < 3; i++) invoca(e, 5, n); son('jefe'); }
    }
    if (C.hab === 'roca' && !e.furia && pc < 0.4) { e.furia = true; e.est = 5; son('jefe'); }
    if (e.ring2 > 0 && (e.ring2 -= dt) <= 0) { for (let i = 0; i < 10; i++) bola(e, (i + 0.5) / 10 * Math.PI * 2, 150, C.fuego); son('fuego'); }
    const libre = e.est === 0 || e.est === 5;
    if (libre) e.cdH -= dt * (e.furia ? 2 : 1);
    if (libre && e.cdH <= 0) {
      const ve = despejado(e.x, e.y, t.x, t.y);
      switch (C.hab) {
        case 'embiste': if (dd < 360 && ve) { e.est = 2; e.estT = 0.8; e.ang = a; } break;
        case 'invoca': if (hijosDe(e) < 8) { e.est = 2; e.estT = 0.7; } break;
        case 'anillo': e.est = 2; e.estT = 0.6; break;
        case 'cria': if (hijosDe(e) < 10) { invoca(e, 2, n); invoca(e, 2, n); son('jefe'); } e.cdH = C.cd; break;
        case 'salta': e.est = 4; e.estT = 0.6; break;
        case 'pisoton':
          if (dd < C.onda * 0.8) { e.est = 1; e.estT = 0.9; }
          else if (dd > 160 && ve) { e.est = 3; e.estT = 1.2; e.vx = Math.cos(a) * 260; e.vy = Math.sin(a) * 260; e.pego = false; }
          break;
        case 'enjambre': if (hijosDe(e) < 14) { e.est = 2; e.estT = 0.8; } break;
        case 'espiral': e.est = 3; e.estT = 2.5; e.ang = a; e.cdB = 0; break;
        case 'hidra': if (dd < 380 && ve) { for (let i = -2; i <= 2; i++) bola(e, a + i * 0.22, 160, C.fuego); e.atk = 0.3; son('fuego'); e.cdH = C.cd; } break;
        case 'roca': if (dd < 420) { e.est = 2; e.estT = 0.5; e.ang = a; } break;
      }
      if (e.cdH <= 0 && (e.est === 0 || e.est === 5)) e.cdH = 0.5;   // no pudo: lo vuelve a mirar en un rato
      return e.est !== 0 && e.est !== 5;
    }
    if (libre) return false;
    e.d = D.dirDe(Math.cos(e.ang ?? a), Math.sin(e.ang ?? a));
    if (e.est === 3) {
      if (C.hab === 'espiral') {
        e.estT -= dt; e.cdB -= dt;
        while (e.cdB <= 0) {
          e.cdB += 0.09; e.ang += 0.45;
          bola(e, e.ang, 140, C.fuego);
          if (pc < 0.5) bola(e, e.ang + Math.PI, 140, C.fuego);
        }
        if (e.estT <= 0) { e.est = 0; e.cdH = C.cd; }
      } else embiste(e, C, t, dt, Math.hypot(e.vx, e.vy));
      if (e.est !== 3) e.cdH = C.cd;
      return true;
    }
    if ((e.estT -= dt) > 0) return true;
    // Termina el aviso: la habilidad sale.
    const fin = e.furia ? 5 : 0;
    e.est = fin; e.cdH = C.cd; e.atk = 0.3;
    switch (C.hab) {
      case 'embiste': {
        const b = e.ang; e.est = 3; e.estT = 0.9; e.vx = Math.cos(b) * 330; e.vy = Math.sin(b) * 330; e.pego = false; son('jefe');
        break;
      }
      case 'invoca': for (let i = 0; i < 3; i++) invoca(e, 0, n); son('jefe'); break;
      case 'anillo': for (let i = 0; i < 10; i++) bola(e, i / 10 * Math.PI * 2, 150, C.fuego); if (pc < 0.5) e.ring2 = 0.35; son('fuego'); break;
      case 'salta': {
        const p = libreJefe(e, t.x, t.y);
        humo(e.x, e.y);
        if (p) { e.x = p[0]; e.y = p[1]; humo(e.x, e.y); }
        e.cd = 0.3; son('jefe');
        break;
      }
      case 'pisoton': ondaJefe(e.x, e.y, C.onda, C.dOnda * (1 + 0.02 * (n - 1))); son('boom'); break;
      case 'enjambre': for (const k of [2, 4, 2, 0]) invoca(e, k, n); son('jefe'); break;
      case 'roca': {
        const tx = t.x, ty = t.y, dr = dist(e.x, e.y, tx, ty), tt = clamp(dr / 300, 0.6, 1.4);
        F.push({ id: nid(), x: e.x, y: e.y, vx: (tx - e.x) / tt, vy: (ty - e.y) / tt, t: tt, t0: tt, d: C.dOnda, de: e.id, k: e.k, jefe: true, roca: true, tx, ty });
        son('fuego');
        break;
      }
    }
    return true;
  }

  function peticion(de, p) {
    if (!p || typeof p !== 'object') return;
    if (Array.isArray(p.pon)) {
      // Radio, daño y vida llegan con las mejoras de quien lo pone, acotados.
      const [w, x, y, r, d, vida] = p.pon, a = D.ARMAS[w];
      if (!a || a.tipo !== 'objeto' || !Number.isFinite(x) || !Number.isFinite(y) || solidoEn(x, y) || O.size > 120) return;
      const k = a.obj, max = k === 'muro' ? clamp(+vida || VIDA_OBJ.muro, 1, 1200) : VIDA_OBJ[k];
      O.set(nid(), { id: ultimoId, k, x, y, hp: max, max, u: de, r: clamp(+r || a.r || 0, 0, 200), d: clamp(+d || a.d || 0, 0, 500) });
    } else if (p.det) {
      let i = 0;
      for (const o of [...O.values()]) if (o.k === 'carga' && o.u === de) {
        O.delete(o.id);
        dir.cola.push({ t: 0.05 + 0.08 * i++, x: o.x, y: o.y, r: o.r || 96, d: o.d || 150, w: 7, u: de });
      }
    } else if (p.caja !== undefined) B.delete(p.caja);
  }

  function nivelObjetivo() { return ONLINE ? (marcador.nivel || 1) : nivelLocal; }

  function simDirector(dt) {
    const obj = vivos();
    const np = Math.max(1, activos().length);
    if (!terminado) {
      if (!versus()) {
        const meta = nivelObjetivo();
        if (dir.n < meta) {
          if (obj.length) {
            dir.n = meta; dir.q = Math.round(D.totalNivel(meta) * (1 + 0.25 * (np - 1)));
            dir.t = 0; dir.ritmo = 1.5;
            reponBarriles();
            // Nivel que termina en 5: un mini jefe con la horda; en 0, un jefe solo.
            const kj = D.jefeDeNivel(meta);
            if (kj >= 0) { nuevoEnemigo(meta, kj); if (D.ENEMIGOS[kj].jefe === 'grande') dir.q = 0; }
          }
        } else if (dir.q === 0 && E.size === 0 && obj.length) {
          dir.t += dt;
          if (dir.t >= 2.5) {
            if (!ONLINE) nivelLocal = dir.n + 1;
            else if (dir.pedido !== dir.n + 1 || T - dir.pedidoT > 6) { enviar('nivel', { n: dir.n + 1 }); dir.pedido = dir.n + 1; dir.pedidoT = T; }
          }
        }
      } else {
        const n0 = dir.n;
        dir.t += dt; dir.n = 1 + Math.floor(dir.t / 60); dir.q = 1;
        if (dir.n !== n0) reponBarriles();
      }
      dir.ritmo -= dt;
      const cupo = Math.round(D.maxVivos(dir.n, np) * (versus() ? 0.5 : 1));
      if (dir.ritmo <= 0 && dir.q > 0 && E.size < cupo && obj.length && dir.n > 0) {
        nuevoEnemigo(dir.n);
        if (!versus()) dir.q--;
        dir.ritmo = D.ritmoNivel(dir.n) * (versus() ? 1.6 : 1);
      }
    }
    // Explosiones en cola (barriles en cadena, cargas).
    for (const c of dir.cola) c.t -= dt;
    const ya = dir.cola.filter(c => c.t <= 0);
    dir.cola = dir.cola.filter(c => c.t > 0);
    for (const c of ya) explotaDir(c);

    flujoT -= dt;
    if (flujoT <= 0 && obj.length) { calculaFlujo(obj); flujoT = 0.4; }

    const lista = [...E.values()];
    for (const e of lista) {
      const C = D.ENEMIGOS[e.k];
      e.cd -= dt; e.cdF -= dt; e.atk = Math.max(0, e.atk - dt); e.flash = Math.max(0, e.flash - dt);
      if (e.aturd > 0) {
        // Despedido: resbala hacia atrás y frena; ni persigue ni ataca.
        e.aturd -= dt;
        mover(e, (e.kvx || 0) * dt, (e.kvy || 0) * dt, C.radio - 1);
        const fr = Math.exp(-8 * dt); e.kvx *= fr; e.kvy *= fr;
        continue;
      }
      let t = null, dd = 1e9;
      for (const o of obj) { const v = dist(e.x, e.y, o.x, o.y); if (v < dd) { dd = v; t = o; } }
      if (!t) continue;
      if (C.jefe && jefeIA(e, C, t, dd, dt)) continue;
      let dx, dy;
      if (dd < TS * 1.6 && despejado(e.x, e.y, t.x, t.y)) { dx = t.x - e.x; dy = t.y - e.y; }
      else { const s = siguiente(e); if (s) { dx = s.x - e.x; dy = s.y - e.y; } else { dx = t.x - e.x; dy = t.y - e.y; } }
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      let sx = 0, sy = 0;
      for (const f of lista) {
        if (f === e) continue;
        const ex = e.x - f.x, ey = e.y - f.y, q = ex * ex + ey * ey, rr = C.radio * 2;
        if (q < rr * rr && q > 0.01) { const qq = Math.sqrt(q); sx += ex / qq * (rr - qq); sy += ey / qq * (rr - qq); }
      }
      const vel = D.velEnemigo(e.k, dir.n) * (e.furia ? 1.8 : 1);
      const alcance = C.jefe ? C.rg + 8 : C.radio + 14;
      let bloq = null;
      if (dd > (C.jefe ? C.rg + 4 : C.radio + 10)) bloq = mover(e, dx * vel * dt + sx * 0.3, dy * vel * dt + sy * 0.3, C.radio - 1);
      else mover(e, sx * 0.3, sy * 0.3, C.radio - 1);
      e.d = D.dirDe(dx, dy);
      const golpe = D.golpeNivel(e.k, dir.n);
      // El explosivo no muerde: se revienta al llegar.
      if (C.explota && dd < C.radio + 16) { danaEnemigo(e.id, 1e9, '', 3, e.x, e.y); continue; }
      if (C.explota && bloq) { danaEnemigo(e.id, 1e9, '', 3, e.x, e.y); continue; }
      if (dd < alcance && e.cd <= 0) { golpea(t.uid, golpe, 8, ''); e.cd = 0.8; e.atk = 0.25; if (C.jefe) sacude = Math.min(10, sacude + 2); }
      else if (bloq && e.cd <= 0) { e.cd = 0.8; e.atk = 0.25; danaObjeto(bloq.id, golpe * 1.5, ''); }
      if (C.fuego && C.cadFuego && e.cdF <= 0 && dd < (C.alcFuego || 320) && despejado(e.x, e.y, t.x, t.y)) {
        const a = Math.atan2(t.y - e.y, t.x - e.x);
        if (C.jefe) { for (let i = -1; i <= 1; i++) bola(e, a + i * 0.2, 170, C.fuego); e.cdF = C.cadFuego * azar(0.8, 1.2) / (e.furia ? 1.6 : 1); e.atk = 0.3; son('fuego'); continue; }
        F.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, t: 3, d: C.fuego, de: e.id, k: e.k });
        e.cdF = C.cadFuego * azar(0.8, 1.2); e.atk = 0.3;
        son('fuego');
      }
    }
    // Bolas de fuego.
    for (const f of F) {
      f.x += f.vx * dt; f.y += f.vy * dt; f.t -= dt;
      // La roca del Titán vuela por encima de todo y revienta donde apuntó.
      if (f.roca) { if (f.t <= 0) { f.fin = true; const C = D.ENEMIGOS[f.k] || {}; ondaJefe(f.tx, f.ty, C.onda || 70, (C.dOnda || 40) * (1 + 0.02 * (dir.n - 1))); son('boom'); } continue; }
      if (f.t <= 0 || choca(f.x, f.y, 3)) { f.fin = true; humo(f.x, f.y); continue; }
      const dmg = f.d * (1 + 0.02 * (dir.n - 1));
      for (const o of obj) if (dist(f.x, f.y, o.x, o.y) < 12) { golpea(o.uid, dmg, 9, ''); f.fin = true; humo(f.x, f.y); break; }
      if (f.fin) continue;
      // Fuego amigo: la bola no distingue, quema al enemigo que se cruce.
      // La de un jefe sí: no iba a quemar a su propia escolta.
      if (f.jefe) continue;
      for (const g of [...E.values()]) {
        if (g.id === f.de || dist(f.x, f.y, g.x, g.y) >= RG(g.k) + 3) continue;
        danaEnemigo(g.id, dmg, '', 9, f.x - f.vx * 0.1, f.y - f.vy * 0.1);
        f.fin = true; humo(f.x, f.y); break;
      }
    }
    F = F.filter(f => !f.fin);
  }

  function zbSale() {
    return {
      n: dir.n, q: dir.q, t: Math.round(dir.t * 10) / 10,
      e: [...E.values()].map(e => [e.id, e.k, Math.round(e.x), Math.round(e.y), Math.max(1, Math.round(100 * e.hp / e.max)), e.d, e.atk > 0 ? 1 : 0, e.aturd > 0 ? 1 : 0].concat(D.esJefe(e.k) ? [Math.round(e.max), e.est || 0] : [])),
      f: F.map(f => [f.id, Math.round(f.x), Math.round(f.y), Math.round(f.vx), Math.round(f.vy), f.k || 1, Math.round(f.t * 10)].concat(f.roca ? [Math.round(f.t0 * 10), Math.round(f.tx), Math.round(f.ty)] : [])),
      o: [...O.values()].map(o => [o.id, OBJ.indexOf(o.k), o.x, o.y, Math.max(1, Math.round(100 * Math.min(o.hp, o.max) / o.max)), o.u || '', o.r || 0, o.max >= 1e9 ? 0 : o.max, o.d || 0]),
      b: [...B.values()].map(b => [b.id, b.k, b.x, b.y]),
      m: dir.m, x: dir.x,
    };
  }

  // Lo que dice el director, sobre lo que yo dibujo.
  function aplicaZb(zb, adoptar) {
    if (!zb || typeof zb !== 'object') return;
    dir.n = zb.n | 0; dir.q = zb.q | 0; dir.t = +zb.t || 0;
    const vistos = new Set();
    for (const a of zb.e || []) {
      if (!Array.isArray(a)) continue;
      const [id, k0, x, y, pc, d, atk, aturd, mx, est] = a, k = D.ENEMIGOS[k0 | 0] ? k0 | 0 : 0;
      vistos.add(id);
      ultimoId = Math.max(ultimoId, id);
      const max = +mx > 0 ? +mx : D.vidaEnemigo(k, Math.max(1, dir.n));
      let e = E.get(id);
      if (!e) { e = { id, k, x, y, max, cd: 0.5, cdF: azar(1, 3), flash: 0 }; E.set(id, e); }
      // Un salto del Espectro no se interpola: aparece donde cayó.
      if (dist(e.x, e.y, x, y) > 60) { e.x = x; e.y = y; }
      e.tx = x; e.ty = y; e.hp = max * pc / 100; e.d = d | 0; e.atk = atk ? 0.25 : 0; e.max = max; e.est = est | 0;
      if (aturd) e.aturd = Math.max(e.aturd || 0, 0.15);
      if (adoptar) { e.x = x; e.y = y; }
    }
    for (const id of [...E.keys()]) if (!vistos.has(id)) E.delete(id);
    F = (zb.f || []).filter(Array.isArray).map(([id, x, y, vx, vy, k, t, t0, tx, ty]) => ({ id, x, y, vx, vy, t: +t > 0 ? t / 10 : 3, k: k || 1, d: (D.ENEMIGOS[k || 1] || D.ENEMIGOS[1]).fuego || 14, roca: +t0 > 0, t0: +t0 / 10, tx, ty }));
    const vo = new Set();
    for (const a of zb.o || []) {
      if (!Array.isArray(a)) continue;
      const [id, ki, x, y, pc, u, r, mx, dd] = a, k = OBJ[ki] || 'muro';
      vo.add(id); ultimoId = Math.max(ultimoId, id);
      const max = k !== 'carga' && +mx > 0 ? +mx : VIDA_OBJ[k];
      const o = O.get(id) || { id, k, x, y, max };
      o.max = max; o.hp = max * pc / 100; o.u = u; o.r = r; o.d = +dd || (D.ARMAS.find(w => w.obj === k) || {}).d || 0;
      O.set(id, o);
    }
    for (const id of [...O.keys()]) if (!vo.has(id)) O.delete(id);
    const vb = new Set();
    for (const a of zb.b || []) {
      if (!Array.isArray(a)) continue;
      const [id, k, x, y] = a;
      vb.add(id); ultimoId = Math.max(ultimoId, id);
      if (!ocultas.has(id)) B.set(id, { id, k, x, y });
    }
    for (const id of [...B.keys()]) if (!vb.has(id)) B.delete(id);
    for (const id of [...ocultas]) if (!vb.has(id)) ocultas.delete(id);
    for (const m of zb.m || []) if (Array.isArray(m)) { procesaMuerte(m); ultimoId = Math.max(ultimoId, m[0]); }
    dir.m = (zb.m || []).filter(Array.isArray).slice(-20);
    for (const x of zb.x || []) if (Array.isArray(x)) {
      const c = 'z:' + x[0];
      ultimoId = Math.max(ultimoId, x[0]);
      if (!vistosX.has(c)) { vistosX.add(c); efectoBoom(x[1], x[2], x[3]); }
    }
    if (adoptar) { dir.x = []; dir.cola = []; flujoT = 0; }
  }

  const MANCHA = ['rgba(110,20,12,.6)', 'rgba(90,10,30,.6)', 'rgba(120,30,10,.55)', 'rgba(70,14,14,.7)', 'rgba(40,30,20,.65)', 'rgba(60,110,20,.55)',
    'rgba(120,10,10,.7)', 'rgba(50,20,70,.65)', 'rgba(70,20,90,.6)', 'rgba(150,140,90,.6)', 'rgba(60,70,110,.5)',
    'rgba(80,60,50,.7)', 'rgba(150,120,20,.6)', 'rgba(130,10,10,.75)', 'rgba(60,130,30,.6)', 'rgba(70,70,80,.7)'];
  /* Los barriles del mapa vuelven al empezar cada nivel, donde no haya ya
     uno: el escenario se puede volar una y otra vez. */
  function reponBarriles() {
    for (const b of M.barriles || []) {
      let hay = false;
      for (const o of O.values()) if (dist(o.x, o.y, b.x, b.y) < 6) { hay = true; break; }
      if (hay) continue;
      const id = nid();
      O.set(id, { id, k: 'barril', x: b.x, y: b.y, hp: VIDA_OBJ.barril, max: VIDA_OBJ.barril, u: '', r: 84, d: 120 });
    }
  }

  function procesaMuerte(m) {
    if (vistosM.has(m[0])) return;
    vistosM.add(m[0]);
    if (vistosM.size > 400) vistosM.delete(vistosM.values().next().value);
    sangre(m[3], m[4], 10, m[2]);
    manchas.push({ x: m[3] + azar(-3, 3), y: m[4] + azar(-3, 3), r: azar(8, 13), c: MANCHA[m[2]] || MANCHA[0] });
    if (manchas.length > 200) manchas.shift();
    son('baja');
    if (cfg && m[1] === cfg.yo) miBaja(m[2]);
    if (D.esJefe(m[2])) { sangre(m[3], m[4], 30, m[2]); efectoBoom(m[3], m[4], 60); banner('¡' + D.ENEMIGOS[m[2]].nombre.toUpperCase() + ' DERROTADO!'); }
  }

  // ---------- la red ----------
  function enviar(tipo, d) {
    if (ONLINE) parent.postMessage(Object.assign({ canal: 'boxhead-hijo', tipo }, d || {}), location.origin);
  }
  addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const m = e.data;
    if (!m || m.canal !== 'boxhead-padre') return;
    if (m.tipo === 'config') config(m);
    else if (m.tipo === 'vivo') llegaVivo(m.v || {});
    else if (m.tipo === 'marcador') llegaMarcador(m);
  });

  function config(m) {
    if (cfg) return;
    cfg = {
      yo: String(m.yo || ''), mirando: !!m.mirando, variante: m.variante === 'versus' ? 'versus' : 'coop',
      mapa: D.mapaValido(m.mapa), meta: m.meta | 0, semilla: m.semilla | 0,
      jugadores: (m.jugadores || []).map((j, i) => ({ uid: String(j.uid), nombre: String(j.nombre || 'Jugador'), orden: Number.isInteger(j.orden) ? j.orden : i })),
    };
    yo = nuevoYo();
    if (cfg.variante === 'versus') for (const a of D.ARMAS) desbloquea(a.id);
    cargaMundo(cfg.mapa);
    $('menuMapas').hidden = true;
    $('cuenta').textContent = cfg.mirando ? 'Estás mirando la partida.' : '';
    $('jugar').textContent = cfg.mirando ? 'Mirar' : '¡A jugar!';
    $('jugar').disabled = false;
    empieza();
  }

  function llegaVivo(v) {
    V = v && typeof v === 'object' ? v : {};
    if (!cfg) return;
    for (const u of Object.keys(V)) {
      const s = V[u];
      if (!s || typeof s !== 'object' || u === cfg.yo) continue;
      let r = R.get(u);
      if (!r) { r = { x: +s.x || 0, y: +s.y || 0 }; R.set(u, r); }
      r.tx = +s.x || 0; r.ty = +s.y || 0; r.d = (s.d | 0) & 7; r.v = !!s.v; r.hp = +s.hp || 0; r.arm = +s.arm || 0; r.w = s.w | 0;
      r.pts = s.pts | 0; r.k = s.k | 0; r.mul = s.mul | 0; r.sk = s.sk; r.mv = !!s.mv; r.h = !!s.h;
      if (s.pz) { if (!r.pz) r.pzDesde = Date.now(); r.pz = true; } else r.pz = false;
      if (dist(r.x, r.y, r.tx, r.ty) > TS * 4) { r.x = r.tx; r.y = r.ty; }
      // Golpes: la primera vez solo marca; después, lo que pase la marca.
      const g = Array.isArray(s.g) ? s.g.filter(Array.isArray) : [];
      const tope = g.reduce((a, x) => Math.max(a, +x[0] || 0), 0);
      if (!marca.has(u)) marca.set(u, tope);
      else {
        const m0 = marca.get(u);
        for (const x of g) if (+x[0] > m0) aplicaGolpe(x, u);
        marca.set(u, Math.max(m0, tope));
      }
      sucesos(u, s);
    }
    for (const u of [...R.keys()]) if (!V[u]) R.delete(u);
    eligeDirector();
    if (!soyDir && dirUid && V[dirUid] && V[dirUid].zb) { ultimoZb = V[dirUid].zb; aplicaZb(ultimoZb, false); }
  }

  function aplicaGolpe(x, de) {
    const [, dest, d, w, extra] = x;
    if (typeof dest !== 'string') return;
    const dmg = Math.min(500, Math.max(0, +d || 0));
    if (dest === cfg.yo) recibe(dmg, w | 0, typeof extra === 'string' ? extra : '');
    else if (soyDir) {
      if (dest.startsWith('e:')) {
        const src = Array.isArray(extra) ? extra : [];
        danaEnemigo(+dest.slice(2), dmg, de, w | 0, +src[0], +src[1]);
      }
      else if (dest.startsWith('o:')) danaObjeto(+dest.slice(2), dmg, de);
      else if (dest === 'p') peticion(de, extra);
    }
  }

  function sucesos(u, s) {
    for (const k of ['s', 'n', 'x2']) {
      const v = s[k];
      if (!v || typeof v !== 'object' || v.i === undefined || visto[k].get(u) === v.i) continue;
      visto[k].set(u, v.i);
      for (const a of Array.isArray(v.l) ? v.l : []) {
        if (!Array.isArray(a)) continue;
        if (k === 's') {
          const ang = a[4] / 100, l = +a[5] || 0;
          trazos.push({ x1: a[2] + Math.cos(ang) * 8, y1: a[3] + Math.sin(ang) * 8, x2: a[2] + Math.cos(ang) * l, y2: a[3] + Math.sin(ang) * l, t: 0.07 });
          son(a[1] === 2 ? 'escopeta' : a[1] === 1 ? 'uzi' : 'pistola', dist(a[2], a[3], yo.x, yo.y));
        } else if (k === 'n') {
          const w = a[1] | 0;
          if (D.ARMAS[w] && (D.ARMAS[w].tipo === 'granada' || D.ARMAS[w].tipo === 'cohete'))
            lanza({ id: a[0], w, x: a[2], y: a[3], ang: a[4] / 100, mio: false, vel: clamp(+a[5] || 0, 0, 2000) || undefined });
        } else {
          proy = proy.filter(p => p.id !== a[0]);
          efectoBoom(a[1], a[2], a[3]);
        }
      }
    }
  }

  function eligeDirector() {
    if (!ONLINE) { soyDir = true; dirUid = cfg ? cfg.yo : null; return; }
    if (!cfg) return;
    const f = fueraSet(), p = [];
    for (const j of [...jugadores()].sort((a, b) => a.orden - b.orden)) {
      if (f.has(j.uid)) continue;
      if (j.uid === cfg.yo) { if (!cfg.mirando) p.push({ uid: j.uid, h: document.hidden }); }
      else if (V[j.uid]) p.push({ uid: j.uid, h: !!V[j.uid].h });
    }
    const a = p.find(x => !x.h) || p[0];
    const nuevo = a ? a.uid : null;
    const era = soyDir;
    dirUid = nuevo; soyDir = nuevo === cfg.yo;
    if (soyDir && !era && ultimoZb) aplicaZb(ultimoZb, true);
  }

  function llegaMarcador(m) {
    const antes = marcador;
    marcador = {
      nivel: Math.max(1, m.nivel | 0), caidos: Array.isArray(m.caidos) ? m.caidos : [], bajas: m.bajas || {},
      muertes: m.muertes || {}, puntos: m.puntos || {}, fuera: Array.isArray(m.fuera) ? m.fuera : [], meta: m.meta | 0, fin: m.fin || null,
    };
    if (!cfg) return;
    const b = (marcador.bajas || {})[cfg.yo] | 0;
    if (versus() && b > misBajas) { premio('¡Baja! ' + b + ' de ' + (cfg.meta || marcador.meta)); son('premio'); }
    misBajas = b;
    if (marcador.fin && !terminado) acaba(marcador.fin);
    void antes;
  }

  function acaba(f) {
    terminado = true;
    let txt;
    const g = f.ganador || '';
    if (versus()) txt = g ? (g === cfg.yo ? '¡Ganaste el versus!' : 'Gana ' + nombreDe(g) + '.') : 'Terminó sin ganador.';
    else txt = 'Cayeron todos en el nivel ' + (f.nivel || marcador.nivel) + '. ' +
      (g ? (g === cfg.yo ? '¡Hiciste más puntos que nadie!' : 'Más puntos: ' + nombreDe(g) + '.') : '');
    $('finTxt').textContent = txt;
    $('otra').hidden = true;
    setTimeout(() => { $('fin').hidden = false; }, 1200);
  }

  // Mi estado, unas doce veces por segundo.
  function miEstado() {
    const e = {
      x: Math.round(yo.x), y: Math.round(yo.y), d: yo.d, v: yo.v && !yo.muerto ? 1 : 0, hp: Math.max(0, Math.round(yo.hp)), arm: Math.round(yo.arm || 0),
      w: yo.w, pts: yo.pts | 0, mul: yo.mul, k: yo.k, sk: skinId, mv: yo.mov ? 1 : 0,
    };
    if (pausado && !cfg.mirando) e.pz = 1;
    if (document.hidden) e.h = 1;
    const ahora = Date.now();
    misG = misG.filter(x => x[0] >= ahora - 3500).slice(-60);
    if (misG.length) e.g = misG;
    for (const k of ['s', 'n', 'x2']) {
      if (pend[k].length) cur[k] = { i: nid(), l: pend[k].splice(0).slice(-24), t: ahora };
      if (cur[k] && ahora - cur[k].t > 1600) cur[k] = null;
      if (cur[k]) e[k] = { i: cur[k].i, l: cur[k].l };
    }
    if (soyDir) e.zb = zbSale();
    return e;
  }

  // ---------- el paso ----------
  let rojo = 0, pubT = 0, pausaDesde = 0;
  const PAUSA_MAX = 120000;
  // Quién tiene la partida en pausa: yo, o (en línea) cualquier jugador que la
  // pidió hace menos de dos minutos. Un mirón solo se pausa a sí mismo.
  function quienPausa() {
    if (pausado) return cfg ? cfg.yo || 'yo' : 'yo';
    if (!ONLINE || !cfg) return '';
    const f = fueraSet(), ahora = Date.now();
    for (const j of jugadores()) {
      const r = R.get(j.uid);
      if (!r || !r.pz || f.has(j.uid) || ahora - r.pzDesde > PAUSA_MAX) continue;
      return j.uid;
    }
    return '';
  }
  function paso(dt) {
    if (!cfg || !M) return;
    if (pausado && ONLINE && Date.now() - pausaDesde > PAUSA_MAX) ponPausa(false);
    if (quienPausa()) {
      // En pausa nada se mueve, ni los enemigos: solo se sigue publicando.
      eligeDirector();
      if (ONLINE) { pubT += dt; if (pubT >= 1 / 12) { pubT = 0; enviar('estado', { e: miEstado() }); } }
      return;
    }
    T += dt;
    eligeDirector();
    if (jugando && !terminado && !cfg.mirando) pasoYo(dt);
    if (soyDir) simDirector(dt);
    else {
      for (const e of E.values()) {
        e.x += (e.tx - e.x) * Math.min(1, dt * 10); e.y += (e.ty - e.y) * Math.min(1, dt * 10);
        e.flash = Math.max(0, (e.flash || 0) - dt);
        if (e.aturd > 0) e.aturd = Math.max(0, e.aturd - dt);
      }
      for (const f of F) { f.x += f.vx * dt; f.y += f.vy * dt; f.t -= dt; }
    }
    for (const e of E.values()) e.tb = (e.tb || 0) + ((e.aturd > 0 ? 1 : 0) - (e.tb || 0)) * Math.min(1, dt * (e.aturd > 0 ? 18 : 7));
    for (const r of R.values()) { r.x += (r.tx - r.x) * Math.min(1, dt * 12); r.y += (r.ty - r.y) * Math.min(1, dt * 12); }
    pasoProy(dt);
    efectos(dt);
    const n = nivelObjetivo();
    if (!versus() && n !== nivelVisto && jugando) { nivelVisto = n; banner('NIVEL ' + n); son('nivel'); }
    if (ONLINE) {
      pubT += dt;
      if (pubT >= 1 / 12) { pubT = 0; enviar('estado', { e: miEstado() }); }
    }
  }

  function pasoYo(dt) {
    yo.cd -= dt; yo.inv = Math.max(0, yo.inv - dt);
    if (yo.mul > 1) {
      yo.combo -= dt;
      // Al vaciarse la barra el multiplicador baja de a uno, no de golpe.
      if (yo.combo <= 0) { yo.mul--; yo.combo = yo.comboMax = yo.mul > 1 ? D.bajadaCombo(yo.mul) : 0; }
    }
    if (yo.muerto) {
      if (!ONLINE) { if (yo.fin > 0 && (yo.fin -= dt) <= 0) finPractica(); return; }
      if (versus()) { if ((yo.respawn -= dt) <= 0) { aparece(); for (const a of D.ARMAS) if (a.id) yo.ammo[a.id] = Math.max(yo.ammo[a.id], a.ini); } }
      else if ((marcador.nivel || 1) > yo.nivelMuerte) { aparece(); banner('¡DE VUELTA!'); }
      return;
    }
    if (!yo.v) return;
    let dx = 0, dy = 0;
    if (!pausado) {
      if (teclas.has('KeyA') || teclas.has('ArrowLeft')) dx--;
      if (teclas.has('KeyD') || teclas.has('ArrowRight')) dx++;
      if (teclas.has('KeyW') || teclas.has('ArrowUp')) dy--;
      if (teclas.has('KeyS') || teclas.has('ArrowDown')) dy++;
    }
    yo.mov = !!(dx || dy);
    if (yo.mov) {
      yo.d = D.dirDe(dx, dy);
      const l = Math.hypot(dx, dy), v = 110;
      mover(yo, dx / l * v * dt, dy / l * v * dt, 9);
    }
    if (!pausado && teclas.has('Space')) dispara();
    // Cajas.
    for (const b of [...B.values()]) {
      if (ocultas.has(b.id) || dist(b.x, b.y, yo.x, yo.y) > 18) continue;
      if (soyDir) B.delete(b.id);
      else { ocultas.add(b.id); B.delete(b.id); misG.push([nid(), 'p', 0, 0, { caja: b.id }]); }
      abreCaja(b.k);
    }
  }

  function abreCaja(k) {
    son('recoge');
    if (k === 1) { yo.hp = Math.min(100, yo.hp + 50); premio('+50 vida'); return; }
    if (k === 2) { yo.arm = Math.min(D.ARMADURA.max, (yo.arm || 0) + D.ARMADURA.caja); premio('+' + D.ARMADURA.caja + ' armadura'); return; }
    const l = [...yo.tiene].filter(i => i !== 0 && yo.ammo[i] < D.arma(i, yo.mejoras).max);
    if (!l.length) { yo.pts += 50; premio('+50 puntos'); return; }
    const i = l[(Math.random() * l.length) | 0], a = D.arma(i, yo.mejoras);
    yo.ammo[i] = Math.min(a.max, yo.ammo[i] + a.caja);
    premio('+' + a.caja + ' ' + a.nombre);
  }

  // La tienda: hay que estar al lado de un puesto ($) y tener los puntos.
  function tiendaCerca() {
    if (!yo.v || yo.muerto) return null;
    for (const t of M.tiendas || []) if (dist(t.x, t.y, yo.x, yo.y) < D.ALCANCE_TIENDA) return t;
    return null;
  }
  function compra(id) {
    if (!tiendaCerca()) return;
    const t = D.TIENDA.find(x => x.id === id);
    if (!t) return;
    if (id === 'potencia' && (yo.pot || 0) >= t.max) { son('clic'); premio('Potencia al máximo'); return; }
    if (id === 'armadura' && (yo.arm || 0) >= D.ARMADURA.max) { son('clic'); premio('Armadura completa'); return; }
    if (id === 'botiquin' && yo.hp >= 100) { son('clic'); premio('Vida completa'); return; }
    const precio = D.precioTienda(id, yo.pot || 0);
    if (yo.pts < precio) { son('clic'); premio('Faltan ' + (precio - yo.pts) + ' puntos'); return; }
    yo.pts -= precio;
    if (id === 'balas') { for (const i of yo.tiene) if (i !== 0) yo.ammo[i] = D.arma(i, yo.mejoras).max; }
    else if (id === 'armadura') yo.arm = Math.min(D.ARMADURA.max, (yo.arm || 0) + 50);
    else if (id === 'botiquin') yo.hp = Math.min(100, yo.hp + 50);
    else if (id === 'potencia') yo.pot = (yo.pot || 0) + 1;
    son('compra');
    premio(t.nombre + ' −' + precio);
  }

  function finPractica() {
    terminado = true;
    $('finTxt').textContent = 'Llegaste al nivel ' + nivelLocal + ' con ' + yo.pts + ' puntos y ' + yo.k + ' bajas.';
    $('otra').hidden = false;
    $('fin').hidden = false;
  }

  // ---------- efectos ----------
  function sangre(x, y, n, k) {
    for (let i = 0; i < n; i++) parts.push({ x, y: y - 10, vx: azar(-70, 70), vy: azar(-90, 30), t: 0.5, max: 0.5, c: k ? '#6d0f2e' : '#9b1a12', s: 2.5, g: 1 });
  }
  function humo(x, y) { for (let i = 0; i < 5; i++) parts.push({ x, y, vx: azar(-30, 30), vy: azar(-30, 30), t: 0.4, max: 0.4, c: '#ffb347', s: 3 }); }
  function polvo(x, y) { for (let i = 0; i < 10; i++) parts.push({ x, y, vx: azar(-60, 60), vy: azar(-60, 60), t: 0.5, max: 0.5, c: '#8a8070', s: 4 }); }
  function efectoBoom(x, y, r) {
    booms.push({ x, y, r, t: 0.45 });
    for (let i = 0; i < 26; i++) {
      const a = azar(0, Math.PI * 2), v = azar(40, r * 3);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: azar(0.3, 0.7), max: 0.7, c: i % 3 ? '#ffb52e' : '#ff5a1f', s: azar(3, 6) });
    }
    manchas.push({ x, y, r: r * 0.45, c: 'rgba(30,25,20,.45)' });
    if (manchas.length > 200) manchas.shift();
    sacude = Math.min(10, sacude + r / 14);
    son('boom', dist(x, y, yo.x, yo.y));
  }
  let sacude = 0;
  function efectos(dt) {
    for (const p of parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += 300 * dt; p.vx *= 1 - dt * 3; p.vy *= 1 - dt * (p.g ? 1 : 3); }
    parts = parts.filter(p => p.t > 0).slice(-500);
    for (const t of trazos) t.t -= dt;
    trazos = trazos.filter(t => t.t > 0);
    for (const b of booms) b.t -= dt;
    booms = booms.filter(b => b.t > 0);
    rojo = Math.max(0, rojo - dt * 1.5);
    sacude = Math.max(0, sacude - dt * 25);
  }

  // ---------- audio ----------
  let ac = null, bus = null;
  const ultimoSon = {};
  function audio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); bus = ac.createGain(); bus.gain.value = 0.45; bus.connect(ac.destination); } catch { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function ruido(dur, f, vol, t0 = 0) {
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = buf;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f;
    const g = ac.createGain(); g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(bus); s.start(ac.currentTime + t0);
  }
  function tono(f1, f2, dur, vol, tipo = 'square', t0 = 0) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
    o.type = tipo; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function son(k, lejos) {
    if (!ac || ac.state !== 'running') return;
    const ahora = performance.now();
    if (ahora - (ultimoSon[k] || 0) < (k === 'baja' ? 45 : 28)) return;
    ultimoSon[k] = ahora;
    const v = lejos === undefined ? 1 : clamp(1 - lejos / 600, 0.08, 0.6);
    switch (k) {
      case 'pistola': ruido(0.07, 3000, 0.35 * v); tono(420, 120, 0.05, 0.08 * v); break;
      case 'uzi': ruido(0.05, 3500, 0.25 * v); break;
      case 'escopeta': ruido(0.22, 1400, 0.55 * v); tono(140, 50, 0.15, 0.2 * v, 'sine'); break;
      case 'lanza': tono(300, 600, 0.12, 0.12 * v, 'triangle'); break;
      case 'cohete': ruido(0.35, 800, 0.3 * v); tono(200, 80, 0.3, 0.12 * v, 'sawtooth'); break;
      case 'boom': ruido(0.7, 380, 0.9 * v); tono(110, 30, 0.5, 0.6 * v, 'sine'); break;
      case 'pon': tono(240, 180, 0.07, 0.18); break;
      case 'clic': tono(900, 900, 0.03, 0.12); break;
      case 'cambia': tono(500, 700, 0.04, 0.08); break;
      case 'baja': tono(180, 70, 0.12, 0.12, 'sawtooth'); break;
      case 'dolor': tono(220, 110, 0.12, 0.22, 'sawtooth'); break;
      case 'muere': tono(320, 50, 0.8, 0.3, 'sawtooth'); break;
      case 'recoge': tono(660, 990, 0.1, 0.18); tono(990, 1320, 0.1, 0.14, 'square', 0.08); break;
      case 'fuego': ruido(0.25, 900, 0.15 * v); break;
      case 'premio': [523, 659, 784, 1046].forEach((f, i) => tono(f, f, 0.12, 0.14, 'square', i * 0.08)); break;
      case 'compra': [880, 1320].forEach((f, i) => tono(f, f, 0.08, 0.14, 'square', i * 0.06)); ruido(0.05, 5000, 0.1); break;
      case 'acido': ruido(0.18, 1800, 0.12 * v); tono(500, 260, 0.15, 0.06 * v, 'sine'); break;
      case 'golpe': ruido(0.3, 500, 0.7 * v); tono(90, 35, 0.35, 0.5 * v, 'sine'); break;
      case 'jefe': tono(110, 55, 0.9, 0.3 * v, 'sawtooth'); tono(82, 41, 0.9, 0.25 * v, 'square', 0.05); ruido(0.6, 600, 0.35 * v); break;
      case 'nivel': [392, 523, 659].forEach((f, i) => tono(f, f * 1.01, 0.18, 0.16, 'triangle', i * 0.12)); break;
    }
  }

  // ---------- dibujo ----------
  const SKIN_Z = [{ piel: '#93a77b', camisa: '#5e6b4c', pantalon: '#3d4a38', pelo: '#3a4730', extra: 'zombi' },
    { piel: '#c43a2a', camisa: '#6d150e', pantalon: '#3d0b07', pelo: '#2a0503', extra: 'cuernos' },
    { piel: '#b0b98a', camisa: '#8a5a2b', pantalon: '#4b3a26', pelo: '#3a4730', extra: 'zombi' },
    { piel: '#7f8c6a', camisa: '#3b3f4a', pantalon: '#26282e', pelo: '#2a2f22', extra: 'zombi' },
    { piel: '#a39a6a', camisa: '#c25a12', pantalon: '#4a3a1c', pelo: '#3a3020', extra: 'zombi' },
    { piel: '#6fbf4a', camisa: '#2f6b2a', pantalon: '#1f3d1c', pelo: '#204a1a', extra: 'zombi' },
    // jefes (6–15)
    { piel: '#a8806a', camisa: '#e8e0d0', pantalon: '#3a2a22', pelo: '#2a1a12', extra: 'mascara' },
    { piel: '#8f9a8a', camisa: '#2a1a3a', pantalon: '#160e22', pelo: '#120a1c', extra: 'cuernos' },
    { piel: '#8fb07a', camisa: '#4a1e5a', pantalon: '#2a1036', pelo: '#1a0a22', extra: 'gorro' },
    { piel: '#e0d6a8', camisa: '#c9b97a', pantalon: '#8a7a4a', pelo: '#a89a6a', extra: 'zombi' },
    { piel: '#b8c8e0', camisa: '#6a7a9a', pantalon: '#3a4660', pelo: '#e8f0ff', extra: 'pelo' },
    { piel: '#7a6a5a', camisa: '#4a3a2a', pantalon: '#2a2018', pelo: '#3a2a1a', extra: 'casco' },
    { piel: '#e0b030', camisa: '#2a1a0a', pantalon: '#e0b030', pelo: '#1a1006', extra: 'antena' },
    { piel: '#8a0e0e', camisa: '#2a0404', pantalon: '#140202', pelo: '#000000', extra: 'cuernos' },
    { piel: '#4a9a3a', camisa: '#2a6a24', pantalon: '#16401a', pelo: '#0e2a10', extra: 'cuernos' },
    { piel: '#8a8a92', camisa: '#4a4a52', pantalon: '#2a2a30', pelo: '#3a3a40', extra: 'casco' }];
  // Tamaño y color de ojos por tipo de enemigo (índice = k de ENEMIGOS).
  const TALLA_Z = [1, 1, 0.85, 1.35, 1, 1, 1.6, 1.45, 1.45, 1.7, 1.4, 2.2, 2, 2.1, 2.2, 2.4];
  const OJOS_Z = ['#d7ff7a', '#ffd23a', '#ffffff', '#ff4a3a', '#ffb347', '#eaff3a', '#ff2020', '#9a4aff', '#d04aff', '#fff6a0', '#7ad8ff', '#ff7a1a', '#ffe23a', '#ff1a1a', '#b0ff3a', '#ff4a1a'];
  const VIDA_Z = ['#a6e05a', '#ff6a3a', '#e8e8e8', '#c0392b', '#ffb347', '#7ee04a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a', '#ff4a3a'];

  function personaje(c, x, y, d, s, t, mov, op) {
    op = op || {};
    const [fx, fy] = DIRS[d];
    const espalda = fy < -0.3, bob = mov ? Math.sin(t * 14) * 1.2 : 0, paso = mov ? Math.sin(t * 14) * 2.2 : 0;
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); c.fill();
    if (op.anillo) { c.strokeStyle = op.anillo; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 11.5, 5, 0, 0, Math.PI * 2); c.stroke(); }
    const tumbo = op.tumbo || 0;
    if (tumbo > 0.01) {
      // Empujado hacia atrás: se echa para atrás girando sobre los pies.
      const lado = Math.abs(fx) > 0.3 ? -Math.sign(fx) : (fy > 0 ? 1 : -1);
      c.save(); c.translate(x, y); c.rotate(lado * 0.55 * tumbo); c.scale(1, 1 - 0.12 * tumbo); c.translate(-x, -y);
    }
    const arma = () => {
      if (op.sinArma) return;
      c.fillStyle = '#222';
      const gx = x + fx * 9, gy = y - 16 + bob + fy * 4;
      c.save(); c.translate(gx, gy); c.rotate(Math.atan2(fy * 0.6, fx)); c.fillRect(-2, -1.5, op.largo || 9, 3); c.restore();
    };
    // piernas
    c.fillStyle = s.pantalon;
    c.fillRect(x - 6, y - 9 + Math.max(0, paso) * 0.4, 5, 9 - Math.max(0, paso) * 0.4);
    c.fillRect(x + 1, y - 9 + Math.max(0, -paso) * 0.4, 5, 9 - Math.max(0, -paso) * 0.4);
    if (espalda) arma();
    // torso y brazos
    c.fillStyle = s.camisa;
    c.fillRect(x - 8, y - 21 + bob, 16, 13);
    c.fillStyle = s.piel;
    if (op.zombi) {
      c.fillRect(x - 9 + fx * 6, y - 20 + bob + fy * 3, 4, 4); c.fillRect(x + 5 + fx * 6, y - 20 + bob + fy * 3, 4, 4);
    } else { c.fillRect(x - 10, y - 20 + bob, 3, 9); c.fillRect(x + 7, y - 20 + bob, 3, 9); }
    if (!espalda) arma();
    // cabeza
    const hy = y - 36 + bob;
    c.fillStyle = s.piel; c.fillRect(x - 8, hy, 16, 15);
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.strokeRect(x - 7.5, hy + 0.5, 15, 14);
    const ex = fx * 3;
    if (!espalda) {
      c.fillStyle = op.ojos || '#1b1b1b';
      if (Math.abs(fx) > 0.9) c.fillRect(x + ex + (fx > 0 ? 2 : -4), hy + 6, 2, 2);
      else { c.fillRect(x - 4 + ex, hy + 6, 2, 2); c.fillRect(x + 2 + ex, hy + 6, 2, 2); }
      if (op.zombi) { c.fillStyle = '#3d2a1c'; c.fillRect(x - 3 + ex, hy + 11, 6, 2); }
    }
    // lo de arriba
    c.fillStyle = s.pelo;
    switch (s.extra) {
      case 'pelo': c.fillRect(x - 8, hy - 2, 16, 5); if (espalda) c.fillRect(x - 8, hy, 16, 10); break;
      case 'casco': c.fillRect(x - 9, hy - 3, 18, 7); c.fillRect(x - 10, hy + 3, 20, 2); break;
      case 'gorro': c.fillStyle = '#e9f1f1'; c.fillRect(x - 8, hy - 3, 16, 5); c.fillStyle = '#d33'; c.fillRect(x - 1, hy - 2, 2, 3); break;
      case 'mascara': c.fillRect(x - 8, hy - 1, 16, 5); if (!espalda) c.fillRect(x - 8, hy + 9, 16, 6); else c.fillRect(x - 8, hy, 16, 15);
        c.fillStyle = '#c0392b'; c.fillRect(x - 8, hy + 3, 16, 2); break;
      case 'gorra': c.fillRect(x - 8, hy - 3, 16, 5); if (!espalda) { c.fillRect(x - 6 + fx * 4, hy + 2, 12, 2); c.fillStyle = '#f1c40f'; c.fillRect(x - 1, hy - 2, 2, 2); } break;
      case 'nariz': c.fillRect(x - 10, hy - 2, 5, 7); c.fillRect(x + 5, hy - 2, 5, 7); if (!espalda) { c.fillStyle = '#e02020'; c.beginPath(); c.arc(x + ex, hy + 9, 2.4, 0, 7); c.fill(); } break;
      case 'antena': c.fillStyle = '#555'; c.fillRect(x - 0.5, hy - 7, 1, 7); c.fillStyle = s.pelo; c.fillRect(x - 2, hy - 9, 4, 3);
        if (!espalda) { c.fillStyle = '#4ff'; c.fillRect(x - 5 + ex, hy + 5, 10, 3); } break;
      case 'zombi': c.fillRect(x - 8, hy - 1, 6, 3); c.fillRect(x + 1, hy - 2, 5, 3); break;
      case 'cuernos': c.fillStyle = '#f2e6c8';
        c.beginPath(); c.moveTo(x - 7, hy); c.lineTo(x - 9, hy - 7); c.lineTo(x - 3, hy); c.fill();
        c.beginPath(); c.moveTo(x + 7, hy); c.lineTo(x + 9, hy - 7); c.lineTo(x + 3, hy); c.fill(); break;
    }
    if (op.flash) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 10, hy, 20, y - hy); }
    if (tumbo > 0.01) c.restore();
  }

  function bloque(c, x, y, h, cols) {
    c.fillStyle = cols[1]; c.fillRect(x, y + TS - h, TS, h);
    c.fillStyle = cols[0]; c.fillRect(x, y - h, TS, TS);
    c.strokeStyle = cols[2]; c.lineWidth = 1; c.strokeRect(x + 0.5, y - h + 0.5, TS - 1, TS - 1);
  }
  const CAJA = ['#b98a45', '#8c6229', '#5e3f17'], MURO_FALSO = ['#a8a39a', '#7d786f', '#55514a'];

  function dibujaObjeto(c, o) {
    if (o.k === 'muro') {
      bloque(c, o.x - TS / 2, o.y - TS / 2, 18, MURO_FALSO);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.beginPath();
      c.moveTo(o.x - 16, o.y - 26); c.lineTo(o.x + 16, o.y - 26); c.moveTo(o.x, o.y - 34); c.lineTo(o.x, o.y - 26); c.stroke();
      if (o.hp < o.max * 0.5) { c.strokeStyle = '#333'; c.beginPath(); c.moveTo(o.x - 8, o.y - 32); c.lineTo(o.x - 2, o.y - 22); c.lineTo(o.x + 6, o.y - 28); c.stroke(); }
    } else if (o.k === 'barril') {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(o.x, o.y + 2, 9, 4, 0, 0, 7); c.fill();
      c.fillStyle = '#b52d1f'; c.fillRect(o.x - 8, o.y - 16, 16, 17);
      c.fillStyle = '#e04431'; c.beginPath(); c.ellipse(o.x, o.y - 16, 8, 3.5, 0, 0, 7); c.fill();
      c.fillStyle = '#5a1209'; c.fillRect(o.x - 8, o.y - 10, 16, 2); c.fillRect(o.x - 8, o.y - 4, 16, 2);
      c.fillStyle = '#f5d33b'; c.fillRect(o.x - 2, o.y - 9, 4, 4);
    } else {
      c.fillStyle = '#3a3a2c'; c.fillRect(o.x - 6, o.y - 6, 12, 8);
      c.fillStyle = '#5d5d46'; c.fillRect(o.x - 6, o.y - 8, 12, 3);
      c.fillStyle = Math.floor(T * 3) % 2 ? '#ff2a2a' : '#5a0e0e'; c.fillRect(o.x - 1.5, o.y - 7.5, 3, 2);
    }
  }

  let camX = 0, camY = 0, W = 0, H = 0, esc = 1, dpr = 1;
  function dibuja() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    W = w; H = h;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = '#16130f'; cx.fillRect(0, 0, W, H);
    if (!M) { fondoMenu(); return; }
    esc = clamp(Math.min(innerWidth / (22 * TS), innerHeight / (14 * TS)), 0.6, 3) * dpr;
    // cámara
    let tx = M.ancho * TS / 2, ty = M.alto * TS / 2;
    if (yo.v && !yo.muerto) { tx = yo.x; ty = yo.y; }
    else { const r = [...R.values()].find(r => r.v); if (r) { tx = r.x; ty = r.y; } else if (yo.muerto) { tx = yo.x; ty = yo.y; } }
    camX += (tx - camX) * 0.15; camY += (ty - camY) * 0.15;
    if (!Number.isFinite(camX) || Math.abs(camX - tx) > 600) { camX = tx; camY = ty; }
    const vw = W / esc, vh = H / esc, mw = M.ancho * TS, mh = M.alto * TS;
    let cxv = mw <= vw ? mw / 2 : clamp(camX, vw / 2, mw - vw / 2);
    let cyv = mh <= vh ? mh / 2 : clamp(camY, vh / 2 - 24, mh - vh / 2);
    cxv += azar(-1, 1) * sacude; cyv += azar(-1, 1) * sacude;
    cx.setTransform(esc, 0, 0, esc, W / 2 - cxv * esc, H / 2 - cyv * esc);
    cx.imageSmoothingEnabled = false;
    const x0 = Math.max(0, Math.floor((cxv - vw / 2) / TS) - 1), x1 = Math.min(M.ancho - 1, Math.ceil((cxv + vw / 2) / TS) + 1);
    const y0 = Math.max(0, Math.floor((cyv - vh / 2) / TS) - 1), y1 = Math.min(M.alto - 1, Math.ceil((cyv + vh / 2) / TS) + 2);
    // suelo
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      cx.fillStyle = M.suelo[(x + y) & 1]; cx.fillRect(x * TS, y * TS, TS, TS);
    }
    for (const s of M.spawnsE) if (s.tx >= x0 && s.tx <= x1 && s.ty >= y0 && s.ty <= y1) { cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(s.tx * TS + 3, s.ty * TS + 3, TS - 6, TS - 6); }
    for (const m of manchas) { cx.fillStyle = m.c; cx.beginPath(); cx.ellipse(m.x, m.y, m.r, m.r * 0.6, 0, 0, 7); cx.fill(); }
    // cajas del suelo
    for (const b of B.values()) {
      const by = b.y + Math.sin(T * 4 + b.id % 7) * 1.5;
      cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(b.x, b.y + 3, 8, 3, 0, 0, 7); cx.fill();
      if (b.k === 2) { cx.fillStyle = '#2d6fb8'; cx.fillRect(b.x - 7, by - 10, 14, 12); cx.fillStyle = '#9fd0ff'; cx.beginPath(); cx.moveTo(b.x - 4, by - 8); cx.lineTo(b.x + 4, by - 8); cx.lineTo(b.x + 3, by - 3); cx.lineTo(b.x, by); cx.lineTo(b.x - 3, by - 3); cx.closePath(); cx.fill(); }
      else if (b.k === 1) { cx.fillStyle = '#f4f4f4'; cx.fillRect(b.x - 7, by - 10, 14, 12); cx.fillStyle = '#d22'; cx.fillRect(b.x - 1.5, by - 8, 3, 8); cx.fillRect(b.x - 4.5, by - 5.5, 9, 3); }
      else { cx.fillStyle = '#6b7a2c'; cx.fillRect(b.x - 8, by - 10, 16, 12); cx.fillStyle = '#c9d47a'; cx.fillRect(b.x - 8, by - 6, 16, 3); cx.fillStyle = '#2e3510'; cx.fillRect(b.x - 8, by - 10, 16, 1); }
    }
    for (const o of O.values()) if (o.k === 'carga') dibujaObjeto(cx, o);
    // lo que tiene altura, ordenado por su base
    const lista = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = M.celdas[y * M.ancho + x];
      if (c) lista.push({ y: y * TS + TS, f: () => bloque(cx, x * TS, y * TS, c === 1 ? 20 : 12, c === 1 ? M.muro : CAJA) });
    }
    for (const t of M.tiendas || []) lista.push({ y: t.y, f: () => puesto(t) });
    for (const o of O.values()) if (o.k !== 'carga') lista.push({ y: o.k === 'muro' ? o.y + TS / 2 : o.y, f: () => dibujaObjeto(cx, o) });
    for (const e of E.values()) lista.push({ y: e.y, f: () => {
      const ta = TALLA_Z[e.k] || 1, Cj = D.ENEMIGOS[e.k] || {}, jf = !!Cj.jefe;
      if (jf) {
        // Avisos del jefe: el suelo marca la onda, brilla al cargar, aura si está furioso.
        if (e.est === 1 && Cj.onda) {
          cx.fillStyle = 'rgba(255,40,20,' + (0.12 + 0.1 * Math.sin(T * 20)).toFixed(2) + ')';
          cx.beginPath(); cx.ellipse(e.x, e.y, Cj.onda, Cj.onda * 0.6, 0, 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(255,60,30,.8)'; cx.lineWidth = 2; cx.stroke();
        }
        if (e.est === 2 || e.est === 5) {
          const pul = 0.5 + 0.5 * Math.sin(T * (e.est === 2 ? 24 : 8));
          cx.fillStyle = (e.est === 2 ? 'rgba(255,230,120,' : 'rgba(255,30,10,') + (0.18 + 0.2 * pul).toFixed(2) + ')';
          cx.beginPath(); cx.ellipse(e.x, e.y - 10 * ta, 16 * ta, 22 * ta, 0, 0, 7); cx.fill();
        }
        if (e.est === 4) cx.globalAlpha = 0.35;
      }
      if (ta !== 1) { cx.save(); cx.translate(e.x, e.y); cx.scale(ta, ta); cx.translate(-e.x, -e.y); }
      personaje(cx, e.x, e.y, e.d || 0, SKIN_Z[e.k] || SKIN_Z[0], T * (e.k === 2 ? 1.6 : 1) + e.id % 10, true, { zombi: true, sinArma: true, ojos: OJOS_Z[e.k] || OJOS_Z[0], flash: e.flash > 0, tumbo: e.tb || 0 });
      if (e.k === 4) {
        // El explosivo lleva la panza encendida: late más rápido cuanto más cerca.
        const pul = 0.5 + 0.5 * Math.sin(T * 10 + e.id);
        cx.fillStyle = 'rgba(255,' + Math.round(120 + 100 * pul) + ',40,' + (0.55 + 0.4 * pul).toFixed(2) + ')';
        cx.beginPath(); cx.arc(e.x, e.y - 14, 4.5 + pul * 1.5, 0, 7); cx.fill();
      }
      if (ta !== 1) cx.restore();
      cx.globalAlpha = 1;
      if (jf) return;   // la vida del jefe va arriba, en grande
      const hy = e.y - 44 * ta;
      if (e.hp < e.max) { cx.fillStyle = '#300'; cx.fillRect(e.x - 9, hy, 18, 2.5); cx.fillStyle = VIDA_Z[e.k] || VIDA_Z[0]; cx.fillRect(e.x - 9, hy, 18 * clamp(e.hp / e.max, 0, 1), 2.5); }
    } });
    for (const [u, r] of R) {
      if (!r.v) { lista.push({ y: r.y, f: () => tumba(r.x, r.y) }); continue; }
      lista.push({ y: r.y, f: () => {
        personaje(cx, r.x, r.y, r.d || 0, D.skin(r.sk), T + ordenDe(u), r.mv, { anillo: colorDe(u), largo: largoArma(r.w) });
        barraVida(r.x, r.y, r.hp, r.arm);
        cx.font = 'bold 7px Trebuchet MS, sans-serif'; cx.textAlign = 'center';
        cx.fillStyle = '#000'; cx.fillText(nombreDe(u), r.x + 0.5, r.y - 48.5); cx.fillStyle = colorDe(u); cx.fillText(nombreDe(u), r.x, r.y - 49);
      } });
    }
    if (cfg && !cfg.mirando && (yo.v || yo.muerto)) {
      if (yo.v && !yo.muerto) lista.push({ y: yo.y, f: () => {
        if (yo.inv > 0 && Math.floor(T * 12) % 2) return;
        personaje(cx, yo.x, yo.y, yo.d, D.skin(skinId), T, yo.mov, { anillo: colorDe(cfg.yo), largo: largoArma(yo.w) });
      } });
      // Como en el original: vida, arma y balas justo encima de la cabeza.
      if (yo.v && !yo.muerto) lista.push({ y: 1e9, f: () => {
        barraVida(yo.x, yo.y, yo.hp, yo.arm);
        const a = D.ARMAS[yo.w], bal = yo.w === 0 ? '∞' : String(yo.ammo[yo.w] | 0);
        cx.font = 'bold 7px Trebuchet MS, sans-serif'; cx.textAlign = 'center';
        const t = a.nombre + '  ' + bal;
        cx.fillStyle = '#000'; cx.fillText(t, yo.x + 0.5, yo.y - 48.5);
        cx.fillStyle = yo.w !== 0 && !(yo.ammo[yo.w] > 0) ? '#ff6a5a' : '#ffe9a8'; cx.fillText(t, yo.x, yo.y - 49);
      } });
      else lista.push({ y: yo.y, f: () => tumba(yo.x, yo.y) });
    }
    lista.sort((a, b) => a.y - b.y);
    for (const l of lista) l.f();
    // proyectiles, fuego, trazos, partículas, explosiones
    for (const p of proy) {
      if (D.ARMAS[p.w].tipo === 'granada') {
        cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(p.x, p.y, 3, 1.5, 0, 0, 7); cx.fill();
        cx.fillStyle = '#3d4a2a'; cx.beginPath(); cx.arc(p.x, p.y - 8 - p.z, 3, 0, 7); cx.fill();
      } else {
        cx.save(); cx.translate(p.x, p.y - 14); cx.rotate(Math.atan2(p.vy, p.vx));
        cx.fillStyle = '#ddd'; cx.fillRect(-5, -1.5, 10, 3); cx.fillStyle = '#c33'; cx.fillRect(4, -1.5, 2, 3);
        cx.fillStyle = '#ffb52e'; cx.fillRect(-9, -1, 4, 2); cx.restore();
      }
    }
    for (const f of F) {
      if (f.roca) {
        // La roca del Titán: sombra y marca donde cae, y la piedra en arco.
        const t0 = f.t0 || 1, q = clamp(1 - (f.t || 0) / t0, 0, 1), r = (D.ENEMIGOS[f.k] || {}).onda || 70;
        cx.strokeStyle = 'rgba(255,50,30,' + (0.4 + 0.4 * q).toFixed(2) + ')'; cx.lineWidth = 2;
        cx.beginPath(); cx.ellipse(f.tx, f.ty, r * (0.4 + 0.6 * q), r * 0.6 * (0.4 + 0.6 * q), 0, 0, 7); cx.stroke();
        cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(f.x, f.y, 7, 3, 0, 0, 7); cx.fill();
        const z = Math.sin(q * Math.PI) * 120;
        cx.fillStyle = '#6a625a'; cx.beginPath(); cx.arc(f.x, f.y - 14 - z, 8, 0, 7); cx.fill();
        cx.fillStyle = '#8a8278'; cx.beginPath(); cx.arc(f.x - 2, f.y - 16 - z, 4, 0, 7); cx.fill();
        continue;
      }
      const g = cx.createRadialGradient(f.x, f.y - 14, 1, f.x, f.y - 14, 8);
      if (f.k === 5 || (D.ENEMIGOS[f.k] || {}).acido) { g.addColorStop(0, '#f4ffb0'); g.addColorStop(0.4, '#7ee04a'); g.addColorStop(1, 'rgba(60,200,0,0)'); }
      else { g.addColorStop(0, '#fff3b0'); g.addColorStop(0.4, '#ff8a1f'); g.addColorStop(1, 'rgba(255,60,0,0)'); }
      cx.fillStyle = g; cx.beginPath(); cx.arc(f.x, f.y - 14, 8, 0, 7); cx.fill();
    }
    cx.lineCap = 'round';
    for (const t of trazos) {
      cx.strokeStyle = 'rgba(255,240,160,' + Math.min(1, t.t * 14) + ')'; cx.lineWidth = 1.4;
      cx.beginPath(); cx.moveTo(t.x1, t.y1 - 16); cx.lineTo(t.x2, t.y2 - 16); cx.stroke();
    }
    for (const p of parts) { cx.globalAlpha = clamp(p.t / p.max, 0, 1); cx.fillStyle = p.c; cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    cx.globalAlpha = 1;
    for (const b of booms) {
      const f = 1 - b.t / 0.45;
      cx.fillStyle = 'rgba(255,' + Math.round(220 - f * 160) + ',60,' + (0.55 * (1 - f)) + ')';
      cx.beginPath(); cx.arc(b.x, b.y - 6, b.r * (0.3 + f * 0.8), 0, 7); cx.fill();
      cx.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - f)) + ')'; cx.lineWidth = 2;
      cx.beginPath(); cx.arc(b.x, b.y - 6, b.r * (0.4 + f), 0, 7); cx.stroke();
    }
    $('rojo').style.boxShadow = 'inset 0 0 ' + Math.round(80 + 80 * rojo) + 'px rgba(200,0,0,' + (rojo * 0.7 + (yo.v && yo.hp < 30 ? 0.25 + 0.15 * Math.sin(T * 6) : 0)).toFixed(2) + ')';
  }
  function barraVida(x, y, hp, arm) {
    const f = clamp(hp / 100, 0, 1);
    cx.fillStyle = '#000'; cx.fillRect(x - 13, y - 46, 26, 4.5);
    cx.fillStyle = '#4a0f0b'; cx.fillRect(x - 12.5, y - 45.5, 25, 3.5);
    cx.fillStyle = f < 0.3 ? '#ff4a3a' : '#5fd85a'; cx.fillRect(x - 12.5, y - 45.5, 25 * f, 3.5);
    if (arm > 0) {
      const a = clamp(arm / D.ARMADURA.max, 0, 1);
      cx.fillStyle = '#000'; cx.fillRect(x - 13, y - 42, 26, 2.5);
      cx.fillStyle = '#4fa8ff'; cx.fillRect(x - 12.5, y - 41.5, 25 * a, 1.5);
    }
  }
  // Un puesto de la tienda: mostrador con un letrero «$» que brilla.
  function puesto(t) {
    const x = t.x, y = t.y, cerca = yo.v && !yo.muerto && dist(x, y, yo.x, yo.y) < D.ALCANCE_TIENDA;
    cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(x, y + 4, 13, 4, 0, 0, 7); cx.fill();
    cx.fillStyle = '#5a3d1e'; cx.fillRect(x - 11, y - 12, 22, 15);
    cx.fillStyle = '#8b6234'; cx.fillRect(x - 12, y - 14, 24, 4);
    cx.fillStyle = '#3b2814'; cx.fillRect(x - 11, y - 6, 22, 1);
    const b = 0.6 + 0.4 * Math.sin(T * 4);
    cx.fillStyle = cerca ? '#ffe36a' : 'rgba(255,214,90,' + b.toFixed(2) + ')';
    cx.font = 'bold 12px Trebuchet MS, sans-serif'; cx.textAlign = 'center';
    cx.fillText('$', x, y - 18 + Math.sin(T * 3) * 1.5);
  }
  const largoArma = w => [8, 10, 12, 7, 7, 7, 13, 7][w] || 8;
  function tumba(x, y) {
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(x, y, 9, 3.5, 0, 0, 7); cx.fill();
    cx.fillStyle = '#8b8b8b'; cx.fillRect(x - 6, y - 14, 12, 14); cx.beginPath(); cx.arc(x, y - 14, 6, Math.PI, 0); cx.fill();
    cx.fillStyle = '#5c5c5c'; cx.fillRect(x - 0.75, y - 16, 1.5, 9); cx.fillRect(x - 3.5, y - 13, 7, 1.5);
  }
  function fondoMenu() {
    cx.fillStyle = '#2a241b';
    for (let y = 0; y < H; y += 32 * dpr) for (let x = (y / 32 / dpr) % 2 ? 0 : 32 * dpr; x < W; x += 64 * dpr) cx.fillRect(x, y, 32 * dpr, 32 * dpr);
  }

  // ---------- HUD ----------
  let hudT = 0, firmaArmas = '', firmaTabla = '';
  const jefesVistos = new Set();
  let firmaJefe = '';
  // La barra grande de los jefes vivos, y su entrada con rugido la primera vez que se ven.
  function hudJefes() {
    const js = [...E.values()].filter(e => D.esJefe(e.k));
    for (const e of js) if (!jefesVistos.has(e.id)) {
      jefesVistos.add(e.id);
      if (jefesVistos.size > 60) jefesVistos.delete(jefesVistos.values().next().value);
      const C = D.ENEMIGOS[e.k];
      banner((C.jefe === 'grande' ? '☠ ' : '⚠ ') + C.nombre);
      premio(C.txt || '');
      son('jefe'); sacude = Math.min(10, sacude + 4);
    }
    const f = js.map(e => e.id + ':' + Math.round(100 * e.hp / e.max)).join(',');
    if (f === firmaJefe) return;
    firmaJefe = f;
    const b = $('jefeBar');
    b.hidden = !js.length;
    b.textContent = '';
    for (const e of js.slice(0, 3)) {
      const C = D.ENEMIGOS[e.k], d = document.createElement('div');
      d.className = 'fila-j ' + C.jefe;
      const n = document.createElement('div'); n.textContent = C.nombre;
      const tu = document.createElement('div'); tu.className = 'tubo';
      const i = document.createElement('i'); i.style.width = clamp(100 * e.hp / e.max, 0, 100).toFixed(1) + '%';
      tu.appendChild(i); d.append(n, tu); b.appendChild(d);
    }
  }
  function hud(dt) {
    if (!cfg || !jugando) return;
    hudJefes();
    const fr = yo.mul > 1 && yo.comboMax > 0 ? clamp(yo.combo / yo.comboMax, 0, 1) : 0;
    $('comboArco').setAttribute('stroke-dashoffset', (100 - fr * 100).toFixed(1));
    if ($('mul').textContent !== '×' + yo.mul) {
      const m = $('mul'), sube = yo.mul > (parseInt(m.textContent.slice(1), 10) || 1);
      m.textContent = '×' + yo.mul;
      if (sube) { m.classList.remove('sube'); void m.offsetWidth; m.classList.add('sube'); }
    }
    const qp = quienPausa();
    $('pausa').hidden = !qp;
    $('seguir').hidden = !pausado;
    $('pausaSub').textContent = !qp ? '' : !ONLINE ? 'La práctica está detenida.'
      : pausado ? 'Nadie se mueve hasta que sigas (máximo dos minutos).' : 'Pausa de ' + nombreDe(qp) + '.';
    hudT -= dt;
    if (hudT > 0) return;
    hudT = 0.2;
    $('ptsN').textContent = yo.pts;
    $('kN').textContent = yo.k;
    const quedan = soyDir || !ONLINE ? dir.q + E.size : dir.q + E.size;
    $('nivel').innerHTML = versus()
      ? 'Versus · <b>' + ((marcador.bajas || {})[cfg.yo] | 0) + '</b> de ' + (cfg.meta || marcador.meta || 10)
      : 'Nivel <b>' + nivelObjetivo() + '</b> · quedan ' + quedan;
    pintaArmas(false);
    if (cfg.mirando) $('aviso').textContent = 'Estás mirando';
    else if (yo.muerto && ONLINE) $('aviso').textContent = versus() ? 'Vuelves en ' + Math.max(0, Math.ceil(yo.respawn)) + '…' : 'Caíste: vuelves cuando tu equipo limpie el nivel';
    else {
      const tc = tiendaCerca();
      $('aviso').textContent = tc ? D.TIENDA.map(t => t.tecla + ' ' + t.nombre.toLowerCase() + ' ' + (t.id === 'potencia' && (yo.pot || 0) >= t.max ? 'máx.' : D.precioTienda(t.id, yo.pot || 0))).join(' · ') : '';
    }
    $('armN').textContent = Math.round(yo.arm || 0);
    $('potN').textContent = (yo.pot || 0) ? ' · Potencia +' + (yo.pot * 10) + ' %' : '';
    // tabla
    const filas = activos().map(j => {
      const u = j.uid, mio = u === cfg.yo, r = R.get(u);
      const pts = versus() ? ((marcador.bajas || {})[u] | 0) : mio ? yo.pts : r ? r.pts : ((marcador.puntos || {})[u] | 0);
      const caido = (marcador.caidos || []).includes(u) || (mio ? yo.muerto : r ? !r.v : true);
      return { u, pts, caido, n: j.nombre };
    });
    const f = JSON.stringify(filas);
    if (f !== firmaTabla) {
      firmaTabla = f;
      const t = $('tabla');
      t.textContent = '';
      t.hidden = !ONLINE;
      for (const r of filas) {
        const d = document.createElement('div');
        if (r.caido) d.className = 'caido';
        const n = document.createElement('span'), i = document.createElement('i'), b = document.createElement('b');
        i.style.background = colorDe(r.u);
        n.append(i, document.createTextNode(r.n));
        b.textContent = r.pts;
        d.append(n, b);
        t.append(d);
      }
    }
  }

  function iconoArma(c, id, w, h) {
    c.clearRect(0, 0, w, h);
    c.save(); c.scale(w / 34, h / 20);
    c.fillStyle = '#d8d0bd';
    switch (id) {
      case 0: c.fillRect(8, 6, 16, 5); c.fillRect(9, 11, 5, 6); break;
      case 1: c.fillRect(5, 6, 22, 5); c.fillRect(12, 11, 4, 7); c.fillRect(20, 11, 3, 5); break;
      case 2: c.fillRect(2, 7, 28, 3); c.fillRect(2, 10, 28, 2); c.fillRect(22, 10, 8, 6); break;
      case 3: c.fillStyle = '#c0392b'; c.fillRect(11, 3, 12, 15); c.fillStyle = '#f5d33b'; c.fillRect(15, 8, 4, 4); break;
      case 4: c.fillStyle = '#6b7a3a'; c.beginPath(); c.arc(17, 11, 6, 0, 7); c.fill(); c.fillRect(15, 2, 4, 4); break;
      case 5: c.fillStyle = '#a8a39a'; c.fillRect(6, 4, 22, 13); c.fillStyle = '#7d786f'; c.fillRect(6, 10, 22, 1); c.fillRect(17, 4, 1, 6); break;
      case 6: c.fillRect(3, 7, 26, 5); c.fillStyle = '#c33'; c.fillRect(27, 7, 4, 5); break;
      case 7: c.fillStyle = '#4a4a38'; c.fillRect(9, 7, 16, 10); c.fillStyle = '#f33'; c.fillRect(15, 5, 4, 3); break;
    }
    c.restore();
  }
  function pintaArmas(fuerza) {
    const firma = D.ARMAS.map(a => (yo.tiene.has(a.id) ? 1 : 0) + ':' + (a.id === 0 ? '∞' : yo.ammo[a.id])).join() + '|' + yo.w;
    if (!fuerza && firma === firmaArmas) return;
    firmaArmas = firma;
    const el = $('armas');
    if (el.children.length !== D.ARMAS.length) {
      el.textContent = '';
      for (const a of D.ARMAS) {
        const s = document.createElement('div'), c = document.createElement('canvas'), b = document.createElement('b'), sp = document.createElement('span');
        s.className = 'slot'; c.width = 68; c.height = 40; b.textContent = a.id + 1;
        iconoArma(c.getContext('2d'), a.id, 68, 40);
        s.title = a.nombre;
        s.append(b, c, sp);
        el.append(s);
      }
    }
    D.ARMAS.forEach((a, i) => {
      const s = el.children[i], tiene = yo.tiene.has(a.id);
      s.classList.toggle('sel', yo.w === a.id);
      s.classList.toggle('no', !tiene || (a.id !== 0 && !(yo.ammo[a.id] > 0)));
      s.lastChild.textContent = !tiene ? '×' + a.desbloquea : a.id === 0 ? '∞' : yo.ammo[a.id];
    });
  }

  let bannerT = null, premios = [], premioT = null;
  function banner(t) {
    const b = $('banner');
    b.textContent = t; b.classList.add('ver');
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('ver'), 2200);
  }
  function premio(t) {
    premios.push(t);
    if (!premioT) sigPremio();
  }
  function sigPremio() {
    const p = $('premio'), t = premios.shift();
    if (t === undefined) { p.classList.remove('ver'); premioT = null; return; }
    p.textContent = t; p.classList.add('ver');
    if (/^¡Nueva|:/.test(t)) son('premio');
    premioT = setTimeout(() => { p.classList.remove('ver'); premioT = setTimeout(sigPremio, 250); }, 1600);
  }

  function ponPausa(v) {
    pausado = v;
    if (v) pausaDesde = Date.now();
    $('pausa').hidden = !v;
  }

  // ---------- menú ----------
  function pintaMenu() {
    const ms = $('mapas');
    ms.textContent = '';
    for (const id of D.ORDEN_MAPAS) {
      const b = document.createElement('button');
      b.className = 'btn2' + (id === mapaElegido ? ' sel' : '');
      b.textContent = D.MAPAS[id].nombre;
      b.onclick = () => { mapaElegido = id; guarda('boxhead.mapa', id); pintaMenu(); };
      ms.append(b);
    }
    const sk = $('skins');
    sk.textContent = '';
    for (const s of D.SKINS) {
      const b = document.createElement('button'), c = document.createElement('canvas');
      b.className = 'skin' + (s.id === skinId ? ' sel' : '');
      c.width = 80; c.height = 104;
      const g = c.getContext('2d');
      g.scale(2, 2); g.imageSmoothingEnabled = false;
      personaje(g, 20, 48, 2, s, 0, false, {});
      b.append(c, document.createTextNode(s.nombre));
      b.onclick = () => { skinId = s.id; guarda('boxhead.skin', s.id); pintaMenu(); };
      sk.append(b);
    }
  }
  $('jugar').onclick = () => {
    audio();
    if (ONLINE) {
      if (!cfg) { $('cuenta').textContent = 'Listo: empieza en cuanto el anfitrión abra la partida.'; return; }
      $('menu').hidden = true;
      return;
    }
    practica();
  };
  $('seguir').onclick = () => ponPausa(false);
  $('otra').onclick = () => { $('fin').hidden = true; $('hud').hidden = true; jugando = false; M = null; cfg = null; $('menu').hidden = false; pintaMenu(); };
  if (ONLINE) {
    $('menuMapas').hidden = true;
    $('cuenta').textContent = 'Elige tu personaje; la partida empieza cuando la sala arranque.';
  } else $('cuenta').textContent = 'Práctica en solitario: nada se guarda.';
  pintaMenu();

  // ---------- bucle ----------
  let ultimo = performance.now();
  function cuadro(ahora) {
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (!document.hidden) { paso(dt); dibuja(); hud(dt); }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
  // Con la pestaña oculta requestAnimationFrame se para: el mundo sigue igual.
  setInterval(() => { if (document.hidden && ONLINE) { ultimo = performance.now(); paso(0.1); } }, 100);

  window.__boxhead = {
    paso: (dt = 1 / 60) => paso(dt),
    estado: () => ({ cfg, yo: { x: yo.x, y: yo.y, hp: yo.hp, v: yo.v, muerto: yo.muerto, pts: yo.pts, k: yo.k, mul: yo.mul, w: yo.w, tiene: [...yo.tiene], ammo: yo.ammo.slice() },
      soyDir, dirUid, nivel: nivelObjetivo(), dir: { n: dir.n, q: dir.q, t: dir.t }, enemigos: E.size, objetos: O.size, cajas: B.size, remotos: R.size, terminado }),
    dbg: () => ({ trazos: trazos.length, cd: yo.cd, ps: pend.s.length, jugando, pausado, w: yo.w, ammo0: yo.ammo[0] }),
    mundo: () => ({ E: [...E.values()].map(e => ({ id: e.id, k: e.k, x: e.x, y: e.y, hp: e.hp })), O: [...O.values()].map(o => ({ k: o.k, x: o.x, y: o.y })), yo: { x: yo.x, y: yo.y, d: yo.d } }),
    teclas, practica, inmortal: v => { inmortal = !!v; },
    salta: n => { if (!ONLINE) { nivelLocal = n | 0; dir.n = (n | 0) - 1; E.clear(); } },
  };
  if (ONLINE) enviar('listo');
})();
