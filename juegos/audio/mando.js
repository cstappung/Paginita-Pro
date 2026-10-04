/* Mandos de PS4/PS5, Xbox y Switch Pro en cualquier juego del sitio.
 *
 * Cada juego declara qué hace cada botón (Mando.configura) y este archivo
 * lo traduce a las mismas teclas que ya entiende el juego: un juego no tiene
 * que aprender nada del mando, recibe un KeyboardEvent como si alguien
 * hubiera apretado la tecla. Lo que no se puede expresar como tecla (mirar
 * con el stick derecho en Yemas) lo lee el juego con Mando.estado().
 *
 * Donde no hay configuración (las salas por turnos, Clue, PRODROP, los menús)
 * el mando maneja un cursor: el stick izquierdo lo mueve, la cruceta salta de
 * botón en botón, A pulsa, B vuelve. Select alterna entre cursor y juego.
 *
 * Mientras hay un mando conectado, las ayudas de teclado que cada juego
 * muestra abajo («← → mover · Espacio disparar») se esconden y en su lugar
 * aparecen las del mando, con los nombres de la familia conectada: ✕ ○ □ △
 * en PlayStation, A B X Y en Xbox, B A Y X en Switch.
 *
 * Un juego en iframe carga su propia copia; la página de arriba se aparta
 * mientras haya un iframe con mando visible, para que un botón no actúe dos
 * veces. Va en un IIFE sin dependencias y la parte pura (Mando._p) corre en
 * Node, para tests/mando.test.cjs.
 */
(function (raiz) {
  'use strict';
  if (raiz.Mando) return;

  // ---------- Parte pura ----------

  // Índices del mapeo «standard» de la Gamepad API: posicionales, el 0 es
  // siempre el botón de abajo de la cara, sea cual sea su letra.
  var NOMBRES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'select', 'start',
    'l3', 'r3', 'arriba', 'abajo', 'izq', 'der', 'home'];
  var ZONA_MUERTA = 0.22;

  function familia(id) {
    var s = String(id || '').toLowerCase();
    // Antes que PlayStation: el de Xbox también se llama «Wireless Controller».
    if (/045e|xbox|xinput/.test(s)) return 'xbox';
    if (/054c|dualshock|dualsense|playstation|wireless controller|ps[345]/.test(s)) {
      return /0ce6|0df2|dualsense|ps5/.test(s) ? 'ps5' : 'ps';
    }
    if (/057e|pro controller|nintendo|switch|joy-?con/.test(s)) return 'nin';
    return 'xbox';
  }
  var NOMBRE_FAM = { ps: 'DualShock 4', ps5: 'DualSense', nin: 'Switch Pro', xbox: 'Xbox' };

  var GLIFOS = {
    ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2',
      select: 'Share', start: 'Options', l3: 'L3', r3: 'R3', home: 'PS' },
    xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT',
      select: 'View', start: 'Menu', l3: 'LS', r3: 'RS', home: 'Xbox' },
    // En Switch el botón de confirmar es la A, a la derecha: por eso el
    // lógico «a» se lee del físico de la derecha (ver normaliza) y la
    // izquierda/arriba se llaman Y/X, al revés que en Xbox.
    nin: { a: 'A', b: 'B', x: 'Y', y: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR',
      select: '−', start: '+', l3: 'LS', r3: 'RS', home: 'Home' },
  };
  GLIFOS.ps5 = Object.assign({}, GLIFOS.ps, { select: 'Create' });
  var COMUNES = { dpad: '✚', arriba: '✚↑', abajo: '✚↓', izq: '✚←', der: '✚→',
    stickL: 'Stick L', stickR: 'Stick R' };

  function glifo(fam, n) {
    var g = GLIFOS[fam] || GLIFOS.xbox;
    return g[n] || COMUNES[n] || n;
  }

  function zona(v) {
    var m = Math.abs(v);
    if (!(m > ZONA_MUERTA)) return 0;
    return Math.sign(v) * Math.min(1, (m - ZONA_MUERTA) / (1 - ZONA_MUERTA));
  }

  // crudo = {id, botones: [valor 0..1], ejes: [..]} → estado lógico.
  function normaliza(crudo) {
    var fam = familia(crudo.id);
    var bv = crudo.botones || [];
    var b = {};
    for (var i = 0; i < NOMBRES.length; i++) b[NOMBRES[i]] = +bv[i] || 0;
    if (fam === 'nin') { var t = b.a; b.a = b.b; b.b = t; }
    var e = crudo.ejes || [];
    return { fam: fam, b: b, ejes: { lx: zona(e[0]), ly: zona(e[1]), rx: zona(e[2]), ry: zona(e[3]) } };
  }

  // El stick izquierdo como cruceta: umbral alto, para que un roce no mueva.
  function dirStick(ejes, umbral) {
    var u = umbral || 0.5;
    return { arriba: ejes.ly < -u, abajo: ejes.ly > u, izq: ejes.lx < -u, der: ejes.lx > u };
  }

  // Qué tecla es cada código: key, code y keyCode, porque cada juego mira
  // uno distinto (Phaser el keyCode, Worms el key, Yemas el code).
  var ESPECIALES = {
    Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9],
    Backspace: ['Backspace', 8], Delete: ['Delete', 46],
    ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
    ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17],
  };
  function tecla(code) {
    if (ESPECIALES[code]) return { code: code, key: ESPECIALES[code][0], keyCode: ESPECIALES[code][1] };
    var m = /^Key([A-Z])$/.exec(code);
    if (m) return { code: code, key: m[1].toLowerCase(), keyCode: m[1].charCodeAt(0) };
    m = /^Digit(\d)$/.exec(code);
    if (m) return { code: code, key: m[1], keyCode: 48 + +m[1] };
    return { code: code, key: code, keyCode: 0 };
  }

  // Una asignación: 'Space', {tecla, rep}, una función, o {baja, sube, rep}.
  function asignacion(v) {
    if (v == null || v === false) return null;
    if (typeof v === 'string') return { tecla: v };
    if (typeof v === 'function') return { baja: v };
    return v;
  }

  function escapa(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // pistas = [['izq der', 'mover'], ['a', 'disparar']] → HTML con un chip por botón.
  function pistasHtml(pistas, fam) {
    return (pistas || []).map(function (p) {
      var chips = String(p[0]).split(/\s+/).filter(Boolean).map(function (n) {
        return '<kbd class="mando-b mando-' + fam + '-' + n + '" translate="no">' + escapa(glifo(fam, n)) + '</kbd>';
      }).join('');
      return '<span class="mando-p">' + chips + ' ' + escapa(p[1]) + '</span>';
    }).join(' · ');
  }

  function conSelect(pistas) {
    var l = (pistas || []).slice();
    if (!l.some(function (p) { return /\bselect\b/.test(p[0]); })) l.push(['select', 'cursor']);
    return l;
  }

  var P = { NOMBRES: NOMBRES, familia: familia, glifo: glifo, zona: zona, normaliza: normaliza,
    dirStick: dirStick, tecla: tecla, asignacion: asignacion, pistasHtml: pistasHtml, conSelect: conSelect,
    NOMBRE_FAM: NOMBRE_FAM };

  // ---------- Estado ----------
  var cfg = null;
  var forzado = false;          // Select: cursor aunque haya juego
  var ultimo = null;            // último estado normalizado
  var oyentes = [];
  var API = {
    _p: P,
    configura: function (c) { soltarTodo(); cfg = c || null; forzado = false; refresca(); },
    libera: function (c) { if (!c || c === cfg) { soltarTodo(); cfg = null; forzado = false; refresca(); } },
    conectado: function () { return !!ultimo; },
    familia: function () { return ultimo ? ultimo.fam : null; },
    nombre: function () { return ultimo ? NOMBRE_FAM[ultimo.fam] : ''; },
    estado: function () { return ultimo ? { b: ultimo.b, ejes: ultimo.ejes, modo: modo } : null; },
    glifo: function (n) { return glifo(ultimo ? ultimo.fam : 'xbox', n); },
    pistas: function (l) { return pistasHtml(l, ultimo ? ultimo.fam : 'xbox'); },
    alCambiar: function (fn) { oyentes.push(fn); },
    cursor: function (v) { forzado = !!v; },
  };
  raiz.Mando = API;
  if (typeof module === 'object' && module.exports) module.exports = API;

  var modo = 'cursor';
  function soltarTodo() {}
  function refresca() {}
  if (typeof document === 'undefined' || !raiz.navigator) return;

  // ---------- DOM ----------
  var doc = document;
  var CSS = [
    'html:not(.mando-on) .mando-pista{display:none!important}',
    '[data-mando-oculto]{display:none!important}',
    '.mando-b{display:inline-block;min-width:1.5em;padding:0 .35em;margin:0 .12em;border-radius:.7em;font:700 .85em/1.45 system-ui,sans-serif;text-align:center;background:#2b2f3a;color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:0 1px 0 rgba(0,0,0,.4);vertical-align:.05em;white-space:nowrap}',
    '.mando-ps-a,.mando-ps5-a{color:#8fb4ff}.mando-ps-b,.mando-ps5-b{color:#ff7a7a}.mando-ps-x,.mando-ps5-x{color:#f19be0}.mando-ps-y,.mando-ps5-y{color:#4fdcaa}',
    '.mando-xbox-a{background:#2f8a3a}.mando-xbox-b{background:#b8352f}.mando-xbox-x{background:#2f61b8}.mando-xbox-y{background:#b8922a}',
    '.mando-p{white-space:nowrap}',
    '#mando-cursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #000,0 0 12px rgba(120,180,255,.9);pointer-events:none;z-index:2147483646;transition:opacity .15s;display:none}',
    '#mando-cursor.pulsa{transform:scale(.75)}',
    '.mando-sobre{outline:3px solid #7fb2ff!important;outline-offset:2px!important}',
    '#mando-aviso{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;background:rgba(18,20,28,.92);color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:7px 14px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:none;max-width:calc(100vw - 32px);text-align:center;transition:opacity .25s;opacity:0}',
    '#mando-aviso.ver{opacity:1}',
  ].join('\n');

  function ponCss() {
    if (doc.getElementById('mando-css')) return;
    var st = doc.createElement('style');
    st.id = 'mando-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  // ----- Marcos: la página de arriba se aparta si un iframe con mando se ve -----
  var hijos = [];
  API._hijo = function (w) { if (hijos.indexOf(w) < 0) hijos.push(w); };
  API._crudo = function () { return leePropio(); };
  var padre = null;
  try { if (raiz.parent && raiz.parent !== raiz && raiz.parent.document) padre = raiz.parent; } catch (e) { padre = null; }
  function registra() {
    try { if (padre && padre.Mando && padre.Mando._hijo) { padre.Mando._hijo(raiz); return true; } } catch (e) {}
    return false;
  }
  if (padre && !registra()) {
    var intentos = 0;
    var t = setInterval(function () { if (registra() || ++intentos > 40) clearInterval(t); }, 250);
  }
  function hijoActivo() {
    for (var i = hijos.length - 1; i >= 0; i--) {
      var w = hijos[i], fe = null;
      try { fe = w.closed ? null : w.frameElement; } catch (e) { fe = null; }
      if (!fe || !fe.isConnected) { hijos.splice(i, 1); continue; }
      var r = fe.getBoundingClientRect();
      if (r.width > 40 && r.height > 40 && fe.offsetParent !== null) return true;
    }
    return false;
  }

  function leePropio() {
    var pads;
    try { pads = raiz.navigator.getGamepads ? raiz.navigator.getGamepads() : []; } catch (e) { pads = []; }
    var mejor = null;
    for (var i = 0; i < (pads ? pads.length : 0); i++) {
      var g = pads[i];
      if (!g || g.connected === false) continue;
      if (!mejor || (g.timestamp || 0) > (mejor.timestamp || 0)) mejor = g;
    }
    if (!mejor) return null;
    return {
      id: mejor.id,
      botones: Array.prototype.map.call(mejor.buttons || [], function (b) {
        return typeof b === 'object' ? (b.pressed ? Math.max(b.value, 1) : b.value) : +b;
      }),
      ejes: Array.prototype.slice.call(mejor.axes || []),
    };
  }
  function leeCrudo() {
    var c = leePropio();
    if (!c && padre) { try { c = padre.Mando && padre.Mando._crudo ? padre.Mando._crudo() : null; } catch (e) { c = null; } }
    return c;
  }

  // ----- Teclas sintéticas -----
  function objetivo() {
    var o = null;
    try { o = cfg && cfg.objetivo ? cfg.objetivo() : null; } catch (e) { o = null; }
    return o || doc.body || doc.documentElement;
  }
  function emite(tipo, code, el) {
    var t = tecla(code);
    var ev = new KeyboardEvent(tipo, { key: t.key, code: t.code, bubbles: true, cancelable: true,
      shiftKey: /^Shift/.test(code) && tipo === 'keydown' });
    try {
      Object.defineProperty(ev, 'keyCode', { get: function () { return t.keyCode; } });
      Object.defineProperty(ev, 'which', { get: function () { return t.keyCode; } });
    } catch (e) {}
    ev.__mando = true;
    (el || objetivo()).dispatchEvent(ev);
    return ev;
  }

  var sujetos = {};   // nombre lógico → {a, sig}
  function baja(nombre, a, ahora) {
    if (a.tecla) emite('keydown', a.tecla);
    if (a.baja) { try { a.baja(); } catch (e) { console.error(e); } }
    sujetos[nombre] = { a: a, sig: a.rep ? ahora + (a.retardo || 260) : 0 };
  }
  function sube(nombre) {
    var s = sujetos[nombre];
    if (!s) return;
    delete sujetos[nombre];
    if (s.a.tecla) emite('keyup', s.a.tecla);
    if (s.a.sube) { try { s.a.sube(); } catch (e) { console.error(e); } }
  }
  soltarTodo = function () { Object.keys(sujetos).forEach(sube); };

  // ----- UI: cursor, aviso -----
  var cursorEl = null, avisoEl = null, avisoT = 0;
  var cx = innerWidth / 2, cy = innerHeight / 2;
  function aseguraUI() {
    ponCss();
    if (!cursorEl && doc.body) {
      cursorEl = doc.createElement('div');
      cursorEl.id = 'mando-cursor';
      doc.body.appendChild(cursorEl);
      avisoEl = doc.createElement('div');
      avisoEl.id = 'mando-aviso';
      doc.body.appendChild(avisoEl);
    }
    return !!cursorEl;
  }
  function aviso(html, ms) {
    if (!aseguraUI()) return;
    avisoEl.innerHTML = html;
    avisoEl.classList.add('ver');
    clearTimeout(avisoT);
    if (ms) avisoT = setTimeout(function () { avisoEl.classList.remove('ver'); }, ms);
  }
  function ocultaUI() {
    if (cursorEl) cursorEl.style.display = 'none';
    if (avisoEl) avisoEl.classList.remove('ver');
    marca(null);
  }

  var CLICABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea,summary,label[for],[role=button],[role=tab],[tabindex]:not([tabindex="-1"]),[onclick],[data-perfil]';
  function visible(el) {
    if (!el || !el.getClientRects().length) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.pointerEvents !== 'none';
  }
  function clicableEn(el) {
    for (var i = 0; el && el !== doc.body && i < 8; i++, el = el.parentElement) {
      if (el.matches && el.matches(CLICABLE)) return el;
      if (getComputedStyle(el).cursor === 'pointer') return el;
    }
    return null;
  }
  var sobre = null, bajo = null;
  function marca(el) {
    if (sobre === el) return;
    if (sobre) sobre.classList.remove('mando-sobre');
    sobre = el;
    if (el) el.classList.add('mando-sobre');
  }
  function raton(tipo, el, extra) {
    var o = Object.assign({ bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: raiz, button: 0,
      buttons: tipo === 'mousedown' || tipo === 'pointerdown' ? 1 : 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }, extra || {});
    var C = /^pointer/.test(tipo) && raiz.PointerEvent ? PointerEvent : MouseEvent;
    var ev = new C(tipo, o);
    ev.__mando = true;
    el.dispatchEvent(ev);
  }
  function enPunto() {
    if (cursorEl) cursorEl.style.display = 'none';
    var el = doc.elementFromPoint(cx, cy);
    if (cursorEl) cursorEl.style.display = 'block';
    return el;
  }
  function pintaCursor() {
    cursorEl.style.left = cx + 'px';
    cursorEl.style.top = cy + 'px';
  }
  function mueveCursor(x, y, mover) {
    cx = Math.max(0, Math.min(innerWidth - 1, x));
    cy = Math.max(0, Math.min(innerHeight - 1, y));
    pintaCursor();
    var el = enPunto();
    if (el && mover) { raton('pointermove', el); raton('mousemove', el); }
    if (el !== bajo) {
      if (bajo) raton('mouseout', bajo);
      if (el) raton('mouseover', el);
      bajo = el;
    }
    marca(el ? clicableEn(el) : null);
  }
  function centroDe(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function irA(el) {
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    var c = centroDe(el);
    mueveCursor(c.x, c.y, true);
    try { el.focus({ preventScroll: true }); } catch (e) {}
    marca(el);
  }
  function navega(dir) {
    var o = sobre ? centroDe(sobre) : { x: cx, y: cy };
    var dx = dir === 'izq' ? -1 : dir === 'der' ? 1 : 0;
    var dy = dir === 'arriba' ? -1 : dir === 'abajo' ? 1 : 0;
    var mejor = null, mp = Infinity;
    var lista = doc.querySelectorAll(CLICABLE);
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
      if (el === sobre || !visible(el)) continue;
      var c = centroDe(el);
      var ax = c.x - o.x, ay = c.y - o.y;
      var prim = ax * dx + ay * dy;
      if (prim < 6) continue;
      var orto = Math.abs(dx ? ay : ax);
      var p = prim + orto * 2.2;
      if (p < mp) { mp = p; mejor = el; }
    }
    if (mejor) irA(mejor);
  }
  var pulsado = null;
  function pulsaA() {
    var el = enPunto();
    if (!el) return;
    pulsado = el;
    if (cursorEl) cursorEl.classList.add('pulsa');
    raton('pointerdown', el);
    raton('mousedown', el);
  }
  function sueltaA() {
    if (cursorEl) cursorEl.classList.remove('pulsa');
    var el = pulsado;
    pulsado = null;
    if (!el || !el.isConnected) return;
    raton('pointerup', el, { buttons: 0 });
    raton('mouseup', el, { buttons: 0 });
    var c = clicableEn(el) || el;
    if (c.tagName === 'SELECT') {
      var n = c.options.length;
      if (n) {
        c.selectedIndex = (c.selectedIndex + 1) % n;
        c.dispatchEvent(new Event('input', { bubbles: true }));
        c.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    if (/^(INPUT|TEXTAREA)$/.test(c.tagName) && !/^(checkbox|radio|button|submit|range|color|file)$/.test(c.type)) {
      try { c.focus(); } catch (e) {}
      return;
    }
    try { if (c.focus) c.focus({ preventScroll: true }); } catch (e) {}
    raton('click', el, { buttons: 0 });
  }
  function atras() {
    var ae = doc.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { ae.blur(); return; }
    var ev = emite('keydown', 'Escape', ae && ae !== doc.body ? ae : doc.body);
    emite('keyup', 'Escape', ae && ae !== doc.body ? ae : doc.body);
    if (ev.defaultPrevented) return;
    var dl = doc.querySelectorAll('dialog[open]');
    if (dl.length) { try { dl[dl.length - 1].close(); } catch (e) {} }
  }
  function desplaza(rx, ry, dt) {
    if (!rx && !ry) return;
    var el = enPunto(), v = 900 * dt;
    for (; el && el !== doc.body && el !== doc.documentElement; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if ((/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) ||
          (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2)) {
        el.scrollBy(rx * v, ry * v);
        return;
      }
    }
    raiz.scrollBy(rx * v, ry * v);
  }

  // ----- Pistas: las ayudas de teclado se cambian por las del mando -----
  var firmaPistas = '';
  function quitaPistas() {
    doc.querySelectorAll('.mando-pista').forEach(function (e) { e.remove(); });
    doc.querySelectorAll('[data-mando-oculto]').forEach(function (e) { e.removeAttribute('data-mando-oculto'); });
    firmaPistas = '';
  }
  function pistasDe(z) {
    // Las pistas propias de una zona («o pulsa ✕») van tal cual; las
    // generales llevan además el Select del cursor.
    return z && z.pistas ? z.pistas : conSelect(cfg.pistas);
  }
  function aplicaPistas() {
    if (!ultimo || !cfg) { if (firmaPistas) quitaPistas(); return; }
    firmaPistas = 'x';
    var fam = ultimo.fam;
    (cfg.zonas || []).forEach(function (z) {
      doc.querySelectorAll(z.sel).forEach(function (el) {
        if (el.classList.contains('mando-pista')) return;
        el.setAttribute('data-mando-oculto', '');
        var sib = el.nextElementSibling;
        if (!sib || !sib.classList.contains('mando-pista')) {
          sib = doc.createElement(el.tagName);
          sib.className = (el.className && typeof el.className === 'string' ? el.className + ' ' : '') + 'mando-pista';
          el.parentNode.insertBefore(sib, el.nextSibling);
        }
        // Si el juego esconde su ayuda, la del mando se esconde con ella.
        sib.hidden = el.hidden;
        sib.style.display = el.style.display === 'none' ? 'none' : '';
        sib.style.visibility = el.style.visibility;
        var h = (z.prefijo || '') + pistasHtml(pistasDe(z), fam);
        if (sib.__h !== h) { sib.innerHTML = h; sib.__h = h; }
      });
    });
    if (cfg.junto) {
      var ref = doc.querySelector(cfg.junto);
      if (ref) {
        var s = ref.nextElementSibling;
        if (!s || !s.classList.contains('mando-pista')) {
          s = doc.createElement('p');
          s.className = 'mando-pista mando-junto';
          s.style.cssText = 'margin:8px auto;text-align:center;font:13px/1.6 system-ui,sans-serif;opacity:.85';
          ref.parentNode.insertBefore(s, ref.nextSibling);
        }
        var h2 = pistasHtml(pistasDe(null), fam);
        if (s.__h !== h2) { s.innerHTML = h2; s.__h = h2; }
      }
    }
  }

  // ----- Bucle -----
  var recien = '';     // «DualSense conectado», para el primer aviso
  var antes = {};      // botones lógicos del cuadro anterior
  var tAnt = 0, tPistas = 0, fueHijo = false;
  var dpadRep = {};

  function enMenu() {
    if (forzado || !cfg) return true;
    if (doc.querySelector('dialog[open]')) return true;
    try { return !!(cfg.menu && cfg.menu()); } catch (e) { return false; }
  }

  function aviCursor() {
    var fam = ultimo.fam;
    var l = [['stickL dpad', 'mover'], ['a', 'pulsar'], ['b', 'atrás'], ['stickR', 'desplazar']];
    if (cfg && forzado) l.push(['select', 'volver al juego']);
    aviso('🎮 ' + (recien ? escapa(recien) + ' · ' : '') + pistasHtml(l, fam), 8000);
    recien = '';
  }

  // Otra configuración puede traer otras zonas: lo de la anterior se quita.
  refresca = function () { tPistas = 0; quitaPistas(); };

  function cambiaModo(nuevo) {
    if (nuevo === modo) return;
    soltarTodo();
    if (pulsado) sueltaA();
    modo = nuevo;
    if (!aseguraUI()) return;
    if (modo === 'cursor') {
      cursorEl.style.display = 'block';
      var ini = null;
      try { ini = cfg && cfg.inicio ? doc.querySelector(cfg.inicio) : null; } catch (e) { ini = null; }
      if (ini && visible(ini)) irA(ini); else mueveCursor(cx, cy, false);
      aviCursor();
    } else {
      ocultaUI();
      aviso('🎮 ' + (recien ? escapa(recien) + ' · ' : '') + pistasHtml(conSelect(cfg.pistas), ultimo.fam), 4000);
      recien = '';
    }
  }

  function conecta(nuevo) {
    var antesFam = ultimo && ultimo.fam;
    ultimo = nuevo;
    doc.documentElement.classList.toggle('mando-on', !!nuevo);
    if (nuevo && !antesFam) {
      aseguraUI();
      modo = '';
      recien = 'Mando ' + NOMBRE_FAM[nuevo.fam] + ' conectado';
      aviso('🎮 ' + escapa(recien), 2500);
    }
    if (!nuevo) {
      soltarTodo();
      if (pulsado) sueltaA();
      ocultaUI();
      quitaPistas();
      aviso('🎮 Mando desconectado', 2000);
      modo = 'cursor';
    }
    tPistas = 0;
    oyentes.forEach(function (f) { try { f(!!nuevo); } catch (e) {} });
  }

  function tick(ahora) {
    raf(tick);
    var dt = Math.min(0.05, Math.max(0, (ahora - tAnt) / 1000));
    tAnt = ahora;
    if (hijoActivo()) {
      if (!fueHijo) { soltarTodo(); ocultaUI(); fueHijo = true; modo = ''; }
      return;
    }
    fueHijo = false;
    var crudo = leeCrudo();
    var n = crudo ? normaliza(crudo) : null;
    if (!!n !== !!ultimo || (n && ultimo && n.fam !== ultimo.fam)) conecta(n);
    if (!n) return;
    ultimo = n;
    if (ahora - tPistas > 500) { tPistas = ahora; aplicaPistas(); }

    var b = n.b, ahoraB = {};
    for (var k in b) ahoraB[k] = b[k] > 0.5;
    var st = dirStick(n.ejes);
    var flanco = function (x) { return ahoraB[x] && !antes[x]; };

    if (cfg && flanco('select') && !(cfg.botones && cfg.botones.select)) { forzado = !forzado; }
    cambiaModo(enMenu() ? 'cursor' : 'juego');

    if (modo === 'juego') {
      var bot = Object.assign({}, cfg.botones || {});
      var stk = cfg.stick === undefined ? 'flechas' : cfg.stick;
      var v = Object.assign({}, ahoraB);
      if (stk === 'flechas') { v.arriba = v.arriba || st.arriba; v.abajo = v.abajo || st.abajo; v.izq = v.izq || st.izq; v.der = v.der || st.der; }
      // La cruceta son las flechas salvo que el juego diga otra cosa.
      if (cfg.flechas !== false) {
        ['arriba', 'abajo', 'izq', 'der'].forEach(function (d) {
          if (!(d in bot)) bot[d] = { arriba: 'ArrowUp', abajo: 'ArrowDown', izq: 'ArrowLeft', der: 'ArrowRight' }[d];
        });
      }
      var nombres = Object.keys(bot);
      if (stk && typeof stk === 'object') {
        ['arriba', 'abajo', 'izq', 'der'].forEach(function (d) {
          if (stk[d]) { nombres.push('s' + d); bot['s' + d] = stk[d]; v['s' + d] = st[d]; }
        });
      }
      for (var i = 0; i < nombres.length; i++) {
        var nom = nombres[i], a = asignacion(bot[nom]);
        if (!a) continue;
        var on = !!v[nom], s = sujetos[nom];
        if (on && !s) baja(nom, a, ahora);
        else if (!on && s) sube(nom);
        else if (on && s && s.a.rep && ahora >= s.sig) {
          s.sig = ahora + s.a.rep;
          if (a.tecla) { emite('keyup', a.tecla); emite('keydown', a.tecla); }
          if (a.baja) { try { a.baja(); } catch (e) { console.error(e); } }
        }
      }
    } else if (modo === 'cursor' && cursorEl) {
      cursorEl.style.display = 'block';
      var lx = n.ejes.lx, ly = n.ejes.ly;
      if (lx || ly) {
        var m = Math.min(1, Math.hypot(lx, ly)), vel = 250 + 1100 * m * m;
        mueveCursor(cx + lx / (Math.hypot(lx, ly) || 1) * m * vel * dt, cy + ly / (Math.hypot(lx, ly) || 1) * m * vel * dt, true);
      }
      ['arriba', 'abajo', 'izq', 'der'].forEach(function (d) {
        if (ahoraB[d] && !antes[d]) { navega(d); dpadRep[d] = ahora + 380; }
        else if (ahoraB[d] && ahora >= (dpadRep[d] || 0)) { navega(d); dpadRep[d] = ahora + 140; }
      });
      if (flanco('a')) pulsaA();
      else if (!ahoraB.a && antes.a) sueltaA();
      if (flanco('b')) atras();
      if (flanco('start') && cfg) {
        var ini = null;
        try { ini = cfg.inicio ? doc.querySelector(cfg.inicio) : null; } catch (e) { ini = null; }
        if (ini && visible(ini)) ini.click();
        else {
          var as = asignacion(cfg.botones && cfg.botones.start);
          if (as) { if (as.tecla) { emite('keydown', as.tecla); emite('keyup', as.tecla); } if (as.baja) as.baja(); if (as.sube) as.sube(); }
        }
      }
      desplaza(n.ejes.rx, n.ejes.ry, dt);
      if (flanco('select') || (cfg && antes.__forzado !== forzado)) aviCursor();
    }
    antes = ahoraB;
    antes.__forzado = forzado;
  }

  var raf = raiz.requestAnimationFrame ? raiz.requestAnimationFrame.bind(raiz) : function (f) { return setTimeout(function () { f(performance.now()); }, 16); };
  raiz.addEventListener('gamepadconnected', function () { tPistas = 0; });
  raiz.addEventListener('blur', function () { soltarTodo(); });
  raf(tick);

  // Auto-montaje declarativo: <body data-mando="cursor"> no necesita nada más.
})(typeof window !== 'undefined' ? window : globalThis);
