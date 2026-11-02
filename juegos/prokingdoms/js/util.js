// Utilidades generales: azar con semilla, ruido, formato de números y DOM.
(function () {
  'use strict';
  const PK = (window.PK = window.PK || {});
  const U = (PK.U = {});

  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hash = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  U.noise = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash(xi, yi, s), b = U.hash(xi + 1, yi, s);
    const c = U.hash(xi, yi + 1, s), d = U.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  U.fbm = function (x, y, s, oct) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < (oct || 4); i++) {
      sum += U.noise(x * f, y * f, s + i * 17) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.pick = (arr, r) => arr[Math.floor((r ? r() : Math.random()) * arr.length)];
  U.rand = (a, b) => a + Math.random() * (b - a);

  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  U.fmt = function (n) {
    n = Math.floor(n || 0);
    if (Math.abs(n) < 10000) return String(n);
    const neg = n < 0; n = Math.abs(n);
    let i = 0;
    while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
    const s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : String(Math.floor(n));
    return (neg ? '-' : '') + s.replace(/\.?0+$/, '') + SUF[i];
  };

  U.fmtTime = function (s) {
    s = Math.max(0, Math.ceil(s));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + String(sec).padStart(2, '0') + 's';
    return sec + 's';
  };

  U.roman = function (n) {
    const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [v, s] of m) while (n >= v) { r += s; n -= v; }
    return r;
  };

  U.dayKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  };
  U.strHash = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  U.el = function (tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  };

  // ?perfil=nombre permite jugar con otra identidad y otra partida en el mismo navegador (útil para probar).
  const prof = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('perfil') : null;
  PK.PROFILE = prof ? prof.replace(/[^\w-]/g, '').slice(0, 20) : '';
  U.key = k => (PK.PROFILE ? k + '_' + PK.PROFILE : k);

  U.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } },
  };
})();
