/* Clue - las armas: iconos, escenas del crimen y chispas. Van por id de
   catálogo (motor.js, `M.CATALOGO_ARMAS`): nueve eléctricas dibujadas aquí en
   SVG, y seis clásicas del edificio que usan su foto real como icono y
   como recuadro de la escena. Tres cosas:
   - icono(id, atributos): el dibujo del arma (viewBox 100x100);
   - escena(id, host, opciones): una animación de 3 a 5 s de cómo se cometió el crimen;
   - chispa(id, host): un destello corto (<= 1,2 s) como aviso.
   Cada escena es una función del tiempo (`f(t, R)`), no una animación CSS:
   así se puede pintar el último cuadro tal cual con `prefers-reduced-motion`,
   o cualquier instante con `opciones.t` (segundos). */
(function (raiz, fab) {
  "use strict";
  const A = fab();
  if (typeof module === "object" && module.exports) module.exports = A;
  raiz.ClueArmas = A;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  let contador = 0;
  const nuevoId = () => "ca" + (++contador);
  const NS = "http://www.w3.org/2000/svg";
  const reducido = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const pr = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  const ease = p => p * p * (3 - 2 * p);
  const lerp = (a, b, p) => a + (b - a) * p;
  const n1 = x => Math.round(x * 100) / 100;
  const escAttr = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const C = { fondo: "#0c2540", tinta: "#9fd4ff", oro: "#ffb347", rojo: "#ff5a4a", verde: "#6df0a0", cobre: "#e58a2d", vio: "#c3a6ff", plata: "#cfd6e0" };
  const MONO = "ui-monospace,Menlo,Consolas,monospace";
  const SANS = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  const rejilla = (w, h, paso) => { let d = ""; for (let x = paso; x < w; x += paso) d += "M" + x + " 0V" + h; for (let y = paso; y < h; y += paso) d += "M0 " + y + "H" + w; return d; };
  const set = (e, o) => { if (e) for (const k in o) e.setAttribute(k, o[k]); };
  const txt = (e, s) => { if (e && e.textContent !== s) e.textContent = s; };
  const mezcla = (a, b, p) => "rgb(" + a.map((v, i) => Math.round(lerp(v, b[i], p))).join(",") + ")";
  const texto = (k, x, y, s, fill, anchor, peso, fam) => '<text data-k="' + k + '" x="' + x + '" y="' + y + '" font-size="' + s + '" fill="' + fill + '" text-anchor="' + (anchor || "start") + '" font-weight="' + (peso || 600) + '" font-family="' + (fam || MONO) + '"></text>';

  /* ---------- siete segmentos (icono de la fuente y pantalla de la escena) ---------- */
  const SEG = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fbgc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
  function siete(x, y, h, cad, col) {
    const w = h * 0.55, t = h * 0.14, m = h / 2;
    let s = "", cx = x;
    const r = (a, b, c, d, on) => '<rect x="' + n1(a) + '" y="' + n1(b) + '" width="' + n1(c) + '" height="' + n1(d) + '" rx="' + n1(t * 0.3) + '" fill="' + col + '" opacity="' + (on ? 1 : 0.1) + '"/>';
    for (const ch of String(cad)) {
      if (ch === ".") { s += '<circle cx="' + n1(cx + t * 0.7) + '" cy="' + n1(y + h - t * 0.6) + '" r="' + n1(t * 0.62) + '" fill="' + col + '"/>'; cx += t * 1.9; continue; }
      const on = SEG[ch] || "";
      const geo = { a: [cx + t, y, w - 2 * t, t], g: [cx + t, y + m - t / 2, w - 2 * t, t], d: [cx + t, y + h - t, w - 2 * t, t],
        f: [cx, y + t * 0.8, t, m - t * 1.1], b: [cx + w - t, y + t * 0.8, t, m - t * 1.1], e: [cx, y + m + t * 0.3, t, m - t * 1.1], c: [cx + w - t, y + m + t * 0.3, t, m - t * 1.1] };
      for (const k in geo) s += r(geo[k][0], geo[k][1], geo[k][2], geo[k][3], on.includes(k));
      cx += w + t * 1.3;
    }
    return s;
  }

  /* ---------- piezas de los dibujos (en un cuadro de 100x100) ---------- */
  function carta(id, cx, cy, R, k) {
    let s = '<defs><clipPath id="' + id + 'k"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '"/></clipPath></defs>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="rgba(159,212,255,.1)"/><g clip-path="url(#' + id + 'k)" fill="none" stroke-width="' + n1(k) + '">';
    [0.2, 0.5, 1, 2, 5].forEach(r => { s += '<circle cx="' + n1(cx + R * r / (1 + r)) + '" cy="' + cy + '" r="' + n1(R / (1 + r)) + '" stroke="' + C.tinta + '"/>'; });
    [0.5, 1, 2, 5].forEach(x => [-1, 1].forEach(sg => { s += '<circle cx="' + (cx + R) + '" cy="' + n1(cy - sg * R / x) + '" r="' + n1(R / x) + '" stroke="' + C.vio + '"/>'; }));
    s += '<path d="M' + (cx - R) + " " + cy + "H" + (cx + R) + '" stroke="' + C.tinta + '"/></g>';
    return s + '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#e8f4ff" stroke-width="' + n1(k * 2) + '"/>';
  }
  const sumaCuad = (u, per, K) => { let s = 0; for (let k = 0; k < K; k++) s += Math.sin(2 * Math.PI * per * u * (2 * k + 1)) / (2 * k + 1); return 4 / Math.PI * s; };
  function onda(x0, x1, cy, A, f, N) { let d = ""; for (let j = 0; j <= N; j++) { const u = j / N; d += (j ? "L" : "M") + n1(x0 + (x1 - x0) * u) + " " + n1(cy - A * f(u)) + " "; } return d; }
  const cuadrada = (x0, x1, cy, A, per) => {
    const w = (x1 - x0) / (per * 2);
    let d = "M" + x0 + " " + (cy - A);
    for (let j = 0; j < per * 2; j++) { if (j) d += "V" + (j % 2 === 0 ? cy - A : cy + A); d += "H" + n1(x0 + (j + 1) * w); }
    return d;
  };
  const cuerpoR = "M27 50c0-8 3-14 10-14h26c7 0 10 6 10 14s-3 14-10 14H37c-7 0-10-6-10-14z";
  const bateria = (x, y, k) => '<path d="M' + x + " " + (y - 8) + "v16M" + (x + 5) + " " + (y - 4.5) + 'v9" stroke="' + C.tinta + '" stroke-width="' + k + '" stroke-linecap="round"/>';
  function ledCuerpo() {
    return '<path d="M-7 62V82M7 62V92" stroke="' + C.plata + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path data-k="ledcuerpo" d="M-15 60V34a15 15 0 0 1 30 0V60z" fill="#ff3b30" fill-opacity=".78" stroke="#ffb3a8" stroke-width="2"/>' +
      '<path data-k="ledint" d="M-7 61V45h4V61M3 61V45h4V61" fill="none" stroke="#ffd2cc" stroke-width="1.8" opacity=".8" stroke-linejoin="round"/>' +
      '<path d="M-10.5 34a10.5 10.5 0 0 1 6-8.5" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="-18" y="58" width="36" height="6" rx="2" fill="#ffc2b8" stroke="#ff8f80" stroke-width="1.2"/>';
  }

  /* ---------- los nueve iconos: contenido sin fondo, cuadro de 100x100 ---------- */
  const I = [
    id => carta(id, 50, 50, 39, 1.3) + '<circle cx="63" cy="35" r="7.5" fill="none" stroke="' + C.oro + '" stroke-width="1.4" opacity=".7"/><circle cx="63" cy="35" r="3.6" fill="' + C.rojo + '" stroke="#fff" stroke-width="1.4"/>',
    () => '<path d="' + cuadrada(10, 90, 31, 11, 2) + '" fill="none" stroke="#e8f4ff" stroke-width="2" opacity=".55" stroke-linejoin="round"/>' +
      '<path d="' + onda(10, 90, 31, 11, u => 4 / Math.PI * Math.sin(4 * Math.PI * u), 60) + '" fill="none" stroke="' + C.tinta + '" stroke-width="1.6" opacity=".9"/>' +
      '<path d="' + onda(10, 90, 31, 11, u => sumaCuad(u, 2, 4), 120) + '" fill="none" stroke="' + C.oro + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M8 90H93" stroke="#e8f4ff" stroke-width="1.6"/>' + [30, 10, 6, 4.3, 3.3].map((h, j) => '<rect x="' + (13 + j * 16) + '" y="' + (89 - h) + '" width="9" height="' + h + '" rx="1" fill="' + (j ? C.vio : C.verde) + '"/>').join(""),
    id => '<defs><clipPath id="' + id + 'r"><path d="' + cuerpoR + '"/></clipPath></defs><path d="M5 50H27M73 50H95" stroke="' + C.plata + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path data-k="rbody" d="' + cuerpoR + '" fill="#d8b98a"/><g clip-path="url(#' + id + 'r)"><rect x="35" y="30" width="6.5" height="40" fill="#f2d21b"/><rect x="44" y="30" width="6.5" height="40" fill="#8a3ffc"/>' +
      '<rect data-k="rb3" x="53" y="30" width="6.5" height="40" fill="#d63a2a"/><rect x="65" y="30" width="5" height="40" fill="#d4af37"/><path d="M36 41H64" stroke="#fff" stroke-opacity=".35" stroke-width="2.6" stroke-linecap="round"/></g>' +
      '<path d="' + cuerpoR + '" fill="none" stroke="#6d5128" stroke-width="1.6"/>',
    id => '<defs><linearGradient id="' + id + 'g" x1="0" x2="1"><stop offset="0" stop-color="#123a75"/><stop offset=".35" stop-color="#3a86e6"/><stop offset="1" stop-color="#0f2f63"/></linearGradient></defs>' +
      '<path d="M43 78V88M57 78V95" stroke="' + C.plata + '" stroke-width="3.2" stroke-linecap="round"/><path d="M32 28h36v52a18 5 0 0 1-36 0z" fill="url(#' + id + 'g)" stroke="#0a2a55" stroke-width="1.2"/>' +
      '<path d="M33 30h10v50.2a18 5 0 0 1-10-2z" fill="#dbe7f5" opacity=".9"/>' + [38, 48, 58, 68].map(y => '<rect x="35.5" y="' + y + '" width="5" height="2.4" rx="1" fill="#123a75"/>').join("") +
      '<g data-k="ctop"><ellipse cx="50" cy="28" rx="18" ry="5" fill="#c4cfdd" stroke="#6b7888" stroke-width="1.2"/><path d="M42 27l16 2.4M58 27l-16 2.4" stroke="#6b7888" stroke-width="1.2"/></g>',
    () => '<ellipse cx="50" cy="52" rx="42" ry="27" fill="none" stroke="' + C.tinta + '" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="3 3" data-k="campo"/><ellipse cx="50" cy="52" rx="34" ry="19" fill="none" stroke="' + C.tinta + '" stroke-opacity=".3" stroke-width="1.4" stroke-dasharray="3 3"/>' +
      '<path d="M24 66Q22 80 10 88M80 66Q88 80 90 88" fill="none" stroke="' + C.plata + '" stroke-width="3.2" stroke-linecap="round"/><rect x="16" y="42" width="68" height="18" rx="5" fill="#8b93a1" stroke="#565e6c" stroke-width="1.6"/>' +
      [0, 1, 2, 3, 4, 5, 6].map(j => { const x = 24 + j * 8.7; return '<path d="M' + x + " 66L" + (x + 7) + ' 36" stroke="#8a4308" stroke-width="7" stroke-linecap="round"/><path d="M' + x + " 66L" + (x + 7) + ' 36" stroke="' + C.cobre + '" stroke-width="5" stroke-linecap="round"/><path d="M' + (x + 1.5) + " 62L" + (x + 5) + ' 43" stroke="#ffc57a" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>'; }).join(""),
    () => '<path d="M38 66V94M50 66V94M62 66V94" stroke="' + C.plata + '" stroke-width="3.4" stroke-linecap="round"/><path data-k="tbody" d="M29 68V40a21 21 0 0 1 42 0V68z" fill="#30353f" stroke="#a9b3c4" stroke-width="2"/>' +
      '<path d="M33 66V41a17 17 0 0 1 8-14" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2.6" stroke-linecap="round"/><path d="M29 68h42" stroke="#a9b3c4" stroke-width="2.4"/><text x="50" y="55" font-size="13" fill="#d7e0ee" text-anchor="middle" font-weight="700" font-family="' + MONO + '">2N</text>',
    () => '<rect x="8" y="20" width="84" height="60" rx="5" fill="#3a4353" stroke="#8794aa" stroke-width="1.8"/><rect x="13" y="25" width="47" height="23" rx="2" fill="#06120c" stroke="#1f2a26"/>' + siete(17, 29, 15, "12.5", "#5dff9a") +
      '<circle cx="73" cy="35" r="8" fill="#1d2330" stroke="#aab6c8" stroke-width="1.5"/><path d="M73 35L77 30" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="73" cy="62" r="6.5" fill="#1d2330" stroke="#aab6c8" stroke-width="1.5"/><path d="M73 62L70 57" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="21" cy="64" r="5" fill="#e0403a" stroke="#fff" stroke-width="1.2"/><circle cx="37" cy="64" r="5" fill="#1a1a1a" stroke="#fff" stroke-width="1.2"/><circle cx="52" cy="60" r="2.6" fill="' + C.verde + '"/><circle data-k="ledcc" cx="52" cy="69" r="2.6" fill="#ff5a4a" opacity=".35"/><path d="M14 80v4M86 80v4" stroke="#8794aa" stroke-width="3" stroke-linecap="round"/>',
    () => '<path d="M24 16V84L82 50z" fill="rgba(60,130,210,.28)" stroke="' + C.tinta + '" stroke-width="3.6" stroke-linejoin="round"/><path d="M6 34H24M6 66H24M82 50H95M50 31V8M50 69V92" stroke="' + C.tinta + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M28 34H38" stroke="' + C.rojo + '" stroke-width="3.4" stroke-linecap="round"/><path d="M28 66H38M33 61V71" stroke="' + C.verde + '" stroke-width="3.4" stroke-linecap="round"/><text x="56" y="10" font-size="8" fill="' + C.oro + '" font-family="' + MONO + '" font-weight="700">V+</text><text x="56" y="94" font-size="8" fill="' + C.oro + '" font-family="' + MONO + '" font-weight="700">V-</text>',
    () => '<g transform="translate(32,0)">' + ledCuerpo() + '<path d="M-24 30l-7-4M-26 42h-8M24 30l7-4M26 42h8M0 12V5" stroke="' + C.oro + '" stroke-width="2.4" stroke-linecap="round"/></g>' +
      '<g stroke="' + C.tinta + '" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M77 20V37M77 55V80"/><path d="M68 37H86L77 54z" fill="rgba(60,130,210,.35)"/><path d="M67 54H87"/></g><path d="M88 40l6-6M90 47l6-6" stroke="' + C.oro + '" stroke-width="2.4" stroke-linecap="round"/>'
  ];

  const ELEC = ["smith", "fourier", "resistencia", "capacitor", "inductor", "transistor", "fuente", "opamp", "led"];
  const IDX = {}; ELEC.forEach((k, i) => { IDX[k] = i; });
  const ARMAS_N = {
    smith: "Carta de Smith", fourier: "Transformada de Fourier", resistencia: "Resistencia", capacitor: "Capacitor", inductor: "Inductor",
    transistor: "Transistor", fuente: "Fuente de poder", opamp: "Amplificador operacional", led: "Diodo LED",
    extintor: "Extintor", enceradora: "Enceradora", manguera: "Manguera", candado: "Candado", trofeo: "Trofeo", taburete: "Taburete"
  };
  const REJ100 = rejilla(100, 100, 10);
  const CLASICAS = { extintor: 1, enceradora: 1, manguera: 1, candado: 1, trofeo: 1, taburete: 1 };
  function icono(arma, atributos) {
    if (!ARMAS_N[arma]) return "";
    const id = nuevoId(), pre = '<svg xmlns="' + NS + '" viewBox="0 0 100 100"' + (atributos ? " " + atributos : "") + ' role="img" aria-label="' + escAttr(ARMAS_N[arma]) + '">';
    if (CLASICAS[arma]) {
      return pre + '<defs><clipPath id="' + id + 'k"><rect x="1" y="1" width="98" height="98" rx="12.5"/></clipPath></defs><rect width="100" height="100" rx="13" fill="' + C.fondo + '"/>' +
        '<image href="img/armas/' + arma + '.webp" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + 'k)"/><rect x="2" y="2" width="96" height="96" rx="11.5" fill="none" stroke="#2f6aa8" stroke-width="1.4"/></svg>';
    }
    return pre + '<rect width="100" height="100" rx="13" fill="' + C.fondo + '"/><path d="' + REJ100 + '" stroke="#4a90d9" stroke-opacity=".16" stroke-width=".6" fill="none"/><rect x="2" y="2" width="96" height="96" rx="11.5" fill="none" stroke="#2f6aa8" stroke-width="1.4"/>' + I[IDX[arma]](id) + "</svg>";
  }

  /* ---------- las escenas ---------- */
  const REJ160 = rejilla(160, 100, 10);
  const along = (poly, u) => {
    let L = 0; const ls = [];
    for (let j = 1; j < poly.length; j++) { const d = Math.hypot(poly[j][0] - poly[j - 1][0], poly[j][1] - poly[j - 1][1]); ls.push(d); L += d; }
    let s = ((u % 1) + 1) % 1 * L;
    for (let j = 0; j < ls.length; j++) { if (s <= ls[j]) { const q = s / ls[j]; return [lerp(poly[j][0], poly[j + 1][0], q), lerp(poly[j][1], poly[j + 1][1], q)]; } s -= ls[j]; }
    return poly[poly.length - 1];
  };
  const humoMk = (k, n) => { let s = ""; for (let j = 0; j < n; j++) s += '<circle data-k="' + k + j + '" r="3" fill="#a6afba" opacity="0"/>'; return s; };
  function humoF(R, k, n, x, y, ini, t, alto) {
    const a = pr(t, ini, ini + 0.5);
    for (let j = 0; j < n; j++) {
      const s = ((((t - ini) - j * 0.28) % 1.7) + 1.7) % 1.7 / 1.7, on = t > ini + j * 0.28 ? 1 : 0;
      set(R[k + j], { cx: n1(x + (j - (n - 1) / 2) * 6 + Math.sin(s * 6 + j) * 4), cy: n1(y - alto * s), r: n1(2.5 + 7 * s), opacity: n1(0.55 * (1 - s) * a * on) });
    }
  }
  const rayos = (R, k, n, x, y, r0, r1, p, ang0) => {
    for (let j = 0; j < n; j++) { const a = ang0 + j * Math.PI * 2 / n; set(R[k + j], { x1: n1(x + Math.cos(a) * r0 * p), y1: n1(y + Math.sin(a) * r0 * p), x2: n1(x + Math.cos(a) * (r0 + (r1 - r0) * p)), y2: n1(y + Math.sin(a) * (r0 + (r1 - r0) * p)), opacity: n1(1 - p * 0.9) }); }
  };
  const rayosMk = (k, n, col, w) => { let s = ""; for (let j = 0; j < n; j++) s += '<line data-k="' + k + j + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" opacity="0"/>'; return s; };
  const zigzag = (x0, y0, x1, y1, n, amp) => { let d = "M" + x0 + " " + y0; for (let j = 1; j < n; j++) { const u = j / n; d += "L" + n1(lerp(x0, x1, u) + (Math.random() - 0.5) * amp) + " " + n1(lerp(y0, y1, u) + (Math.random() - 0.5) * amp); } return d + "L" + x1 + " " + y1; };

  const ESC = [];

  /* 0. Carta de Smith: un punto de impedancia en espiral hasta el cortocircuito */
  ESC[0] = {
    dur: 4.8, tc: 3.3, cap: "Γ = -1: reflexión total",
    dib: id => carta(id, 60, 42, 36, 1.2) +
      '<circle cx="24" cy="42" r="2.4" fill="' + C.rojo + '"/><path data-k="huella" fill="none" stroke="' + C.oro + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle data-k="halo" r="5" fill="' + C.rojo + '" opacity=".3"/><circle data-k="punto" r="2.6" fill="' + C.rojo + '" stroke="#fff" stroke-width="1.2"/>' +
      '<circle data-k="onda" cx="24" cy="42" r="2" fill="none" stroke="' + C.rojo + '" stroke-width="2.4" opacity="0"/>' +
      texto("l1", 102, 26, 6, "#e8f4ff") + texto("l2", 102, 37, 6, "#e8f4ff") + texto("l3", 102, 48, 5.6, C.oro) + texto("z0", 102, 62, 5.6, C.rojo),
    f(t, R) {
      const q = pr(t, 0.2, 3.0), rho = q ? 0.1 + 0.9 * Math.pow(q, 0.85) : 0.1, th = q * 5 * Math.PI, cx = 60, cy = 42, RR = 36;
      let d = "";
      for (let j = 0; j <= 70; j++) { const u = q * j / 70, r = 0.1 + 0.9 * Math.pow(u, 0.85), a = u * 5 * Math.PI; d += (j ? "L" : "M") + n1(cx + RR * r * Math.cos(a)) + " " + n1(cy - RR * r * Math.sin(a)) + " "; }
      const px = cx + RR * rho * Math.cos(th), py = cy - RR * rho * Math.sin(th);
      set(R.huella, { d }); set(R.punto, { cx: n1(px), cy: n1(py) }); set(R.halo, { cx: n1(px), cy: n1(py), r: n1(4 + Math.sin(t * 12) * 1.2) });
      const gr = ((th * 180 / Math.PI + 180) % 360) - 180, gre = q >= 1 ? 180 : gr;
      // z = (1+G)/(1-G), con G = rho e^{j th}
      const re = 1 + rho * Math.cos(th), im = rho * Math.sin(th), de = 1 - rho * Math.cos(th), imd = -rho * Math.sin(th), den = de * de + imd * imd || 1e-9;
      const zr = (re * de + im * imd) / den, zi = (im * de - re * imd) / den;
      txt(R.l1, "|Γ| = " + rho.toFixed(2)); txt(R.l2, "θ = " + Math.round(gre) + "°");
      txt(R.l3, q >= 1 ? "z = 0 + j0" : "z = " + zr.toFixed(1) + (zi < 0 ? " - j" : " + j") + Math.abs(zi).toFixed(1));
      txt(R.z0, q >= 1 ? "cortocircuito" : "");
      const w = pr(t, 3.0, 3.7);
      set(R.onda, { r: n1(2 + 24 * w), opacity: n1(w > 0 && w < 1 ? 1 - w : 0) });
      set(R.flash, { opacity: n1(0.55 * (1 - pr(t, 3.0, 3.35)) * (t >= 3.0 ? 1 : 0)) });
      if (q >= 1) set(R.punto, { r: 3.4 });
    }
  };

  /* 1. Fourier: una cuadrada armada armónico a armónico */
  ESC[1] = {
    dur: 4.8, tc: 3.5, cap: "Descompuesto en armónicos",
    dib: () => '<path d="' + cuadrada(10, 150, 28, 14, 2) + '" fill="none" stroke="#e8f4ff" stroke-opacity=".4" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M10 28H150" stroke="' + C.tinta + '" stroke-opacity=".3" stroke-width=".6"/>' +
      '<path data-k="suma" fill="none" stroke="' + C.oro + '" stroke-width="2.4" stroke-linejoin="round"/>' + texto("kn", 12, 8, 6, C.oro) + texto("gibbs", 150, 8, 5.5, C.rojo, "end") +
      '<path d="M10 80H150" stroke="#e8f4ff" stroke-width="1"/>' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(j => '<rect data-k="b' + j + '" x="' + (14 + j * 15.6) + '" y="80" width="9" height="0" fill="' + (j ? C.vio : C.verde) + '" rx="1"/>').join("") + texto("esp", 148, 52, 5.5, C.tinta, "end"),
    f(t, R) {
      const K = 1 + Math.floor(pr(t, 0.3, 2.7) * 8.999);
      set(R.suma, { d: onda(10, 150, 28, 14, u => sumaCuad(u, 2, K), 210) });
      txt(R.kn, "n = " + (2 * K - 1));
      txt(R.gibbs, K >= 5 ? "Gibbs: rebote de 9 %" : "");
      for (let j = 0; j < 9; j++) { const h = 26 / (2 * j + 1) * ease(pr(t, 2.8 + j * 0.1, 3.3 + j * 0.1)); set(R["b" + j], { y: n1(80 - h), height: n1(h) }); }
      txt(R.esp, t > 3.0 ? "espectro" : "");
    }
  };

  /* 2. Resistencia: al rojo blanco, humo y una banda quemada */
  ESC[2] = {
    dur: 4.8, tc: 3.3, cap: "Excedió su 1/4 W",
    dib: id => '<defs><radialGradient id="' + id + 'g"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".95"/><stop offset="1" stop-color="#ff4a10" stop-opacity="0"/></radialGradient></defs><ellipse data-k="brillo" cx="80" cy="42" rx="62" ry="32" fill="url(#' + id + 'g)" opacity="0"/>' +
      '<g transform="translate(5,-33) scale(1.5)">' + I[2](id) + "</g>" + humoMk("s", 6) +
      '<path data-k="llama" d="M0 0C-4-6-2-10 0-17C2-10 4-6 0 0z" fill="' + C.oro + '" opacity="0"/>' +
      '<rect x="24" y="73" width="112" height="6" rx="3" fill="#06121f" stroke="' + C.tinta + '" stroke-opacity=".5"/><rect data-k="med" x="24" y="73" width="0" height="6" rx="3" fill="' + C.verde + '"/><path d="M38 70V82" stroke="' + C.oro + '" stroke-width="1.4"/>' +
      texto("lim", 38, 68, 5, C.oro, "middle") + texto("w", 136, 70, 6.4, "#e8f4ff", "end"),
    f(t, R) {
      const p = pr(t, 0.3, 2.5), col = p < 0.5 ? mezcla([216, 185, 138], [230, 80, 36], p * 2) : mezcla([230, 80, 36], [255, 240, 205], (p - 0.5) * 2);
      set(R.rbody, { fill: col }); set(R.brillo, { opacity: n1(p * 0.9 * (0.9 + 0.1 * Math.sin(t * 14))) });
      const w = 0.05 + 1.9 * ease(pr(t, 0.2, 3.0)), fr = cl(w / 2, 0, 1);
      set(R.med, { width: n1(112 * fr), fill: w > 0.25 ? (w > 1 ? C.rojo : C.oro) : C.verde });
      txt(R.w, "P = " + w.toFixed(2) + " W"); txt(R.lim, "1/4 W");
      humoF(R, "s", 6, 80, 22, 1.6, t, 20);
      if (t > 2.6) {
        set(R.rb3, { fill: mezcla([214, 58, 42], [24, 18, 14], pr(t, 2.6, 3.0)) });
        set(R.llama, { transform: "translate(86,21) scale(" + n1(0.8 + 0.25 * Math.sin(t * 22)) + " " + n1(0.9 + 0.3 * Math.sin(t * 17)) + ")", opacity: n1(pr(t, 2.6, 2.8)) });
      }
      set(R.flash, { opacity: n1(0.35 * pr(t, 2.55, 2.65) * (1 - pr(t, 2.65, 3.0))) });
    }
  };

  /* 3. Capacitor: la curva de carga, el abultamiento y el estallido */
  ESC[3] = {
    dur: 4.8, tc: 3.3, cap: "Descarga fatal",
    dib: id => '<path d="M14 14V66H76" fill="none" stroke="#e8f4ff" stroke-width="1.2"/><path d="M14 34H76" stroke="' + C.rojo + '" stroke-width=".9" stroke-dasharray="3 2"/>' + texto("rt", 76, 31, 5, C.rojo, "end") + texto("ax", 76, 73, 5, C.tinta, "end") + texto("ay", 12, 12, 5, C.tinta, "end") +
      '<path data-k="curva" fill="none" stroke="' + C.oro + '" stroke-width="2.2" stroke-linecap="round"/><circle data-k="cp" r="2.2" fill="' + C.rojo + '"/>' +
      '<g data-k="cap">' + I[3](id) + "</g>" + rayosMk("r", 12, "#ffe066", 2.4) + '<circle data-k="chisp" cx="112" cy="30" r="0" fill="#fff" opacity="0"/>' + texto("v", 112, 16, 6.2, "#e8f4ff", "middle"),
    f(t, R) {
      const q = pr(t, 0.3, 2.8), tau = q, vt = v => 1 - Math.exp(-4 * v);
      let d = "";
      for (let j = 0; j <= 40; j++) { const u = tau * j / 40; d += (j ? "L" : "M") + n1(14 + 60 * u) + " " + n1(66 - 50 * vt(u) / 1) + " "; }
      set(R.curva, { d }); set(R.cp, { cx: n1(14 + 60 * tau), cy: n1(66 - 50 * vt(tau)) });
      const V = 25 * vt(tau); txt(R.v, t < 3.0 ? "Vc = " + V.toFixed(1) + " V" : "Vc = 25 V"); txt(R.rt, "16 V máx"); txt(R.ax, "t"); txt(R.ay, "V");
      const b = ease(pr(t, 1.2, 3.0)), pop = pr(t, 3.0, 3.7), tr = t < 3.0 && b > 0.5 ? Math.sin(t * 60) * 0.7 * b : 0;
      set(R.cap, { transform: "translate(" + n1(72 + tr) + " 6) scale(.8) translate(50 60) scale(" + n1(1 + 0.16 * b) + " 1) translate(-50 -60)" });
      set(R.ctop, { transform: pop > 0 ? "translate(" + n1(20 * pop) + " " + n1(-60 * pop + 90 * pop * pop) + ") rotate(" + n1(200 * pop) + " 50 28)" : "translate(0 " + n1(-4 * b) + ")", opacity: n1(1 - pr(pop, 0.7, 1)) });
      rayos(R, "r", 12, 112, 32, 4, 30, t >= 3.0 ? pr(t, 3.0, 3.6) : 0, 0.2);
      if (t < 3.0) for (let j = 0; j < 12; j++) set(R["r" + j], { opacity: 0 });
      set(R.chisp, { r: n1(4 + 30 * pr(t, 3.0, 3.25)), opacity: n1(t >= 3.0 ? 0.9 * (1 - pr(t, 3.0, 3.3)) : 0) });
      set(R.flash, { opacity: n1(t >= 3.0 ? 0.6 * (1 - pr(t, 3.0, 3.25)) : 0) });
    }
  };

  /* 4. Inductor: se abre el interruptor y salta L di/dt */
  ESC[4] = {
    dur: 4.8, tc: 3.3, cap: "L di/dt",
    dib: id => '<g data-k="campos" fill="none" stroke="' + C.tinta + '" stroke-width="1.6" stroke-dasharray="4 3"><ellipse data-k="e0" cx="80" cy="50" rx="34" ry="20"/><ellipse data-k="e1" cx="80" cy="50" rx="46" ry="30"/><ellipse data-k="e2" cx="80" cy="50" rx="58" ry="40"/></g>' +
      '<g transform="translate(50,20) scale(.6)">' + I[4](id) + "</g>" +
      '<path d="M104 72.8H150V82H4V72.8H8M13 72.8H34" fill="none" stroke="' + C.plata + '" stroke-width="1.6" stroke-linejoin="round"/>' + bateria(8, 72.8, 1.8) +
      '<circle cx="34" cy="72.8" r="1.8" fill="' + C.plata + '"/><circle cx="56" cy="72.8" r="1.8" fill="' + C.plata + '"/><path data-k="hoja" d="M34 72.8h22" stroke="#e8f4ff" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path data-k="arco2" fill="none" stroke="#7ec8ff" stroke-width="5" stroke-opacity=".5" stroke-linecap="round" stroke-linejoin="round"/><path data-k="arco" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      texto("v", 152, 14, 8, "#e8f4ff", "end", 700) + texto("f", 152, 24, 5.6, C.tinta, "end") + texto("i", 8, 14, 6.4, C.oro),
    f(t, R) {
      const T = 2.2, ab = t >= T, cerrado = t < T, I0 = cerrado ? 1 - Math.exp(-t / 0.55) : 0, col = pr(t, T, T + 0.35);
      const puls = 1 + 0.05 * Math.sin(t * 9);
      ["e0", "e1", "e2"].forEach((k, j) => set(R[k], { rx: n1([34, 46, 58][j] * puls * (ab ? 1 - 0.7 * col : 1)), ry: n1([20, 30, 40][j] * puls * (ab ? 1 - 0.7 * col : 1)), opacity: n1((cerrado ? I0 : 0.9 * (1 - col)) * (0.9 - j * 0.2)), "stroke-dashoffset": n1(-t * 20) }));
      const ang = -42 * ease(pr(t, T, T + 0.12)) * Math.PI / 180;
      set(R.hoja, { d: "M34 72.8L" + n1(34 + 22 * Math.cos(ang)) + " " + n1(72.8 + 22 * Math.sin(ang)) });
      const ta = t - T, arc = ta >= 0 && ta < 0.95;
      if (arc) { const d = zigzag(n1(34 + 22 * Math.cos(ang)), n1(72.8 + 22 * Math.sin(ang)), 56, 72.8, 9, 7 * (1 - ta / 1.1)); set(R.arco, { d, opacity: n1(1 - pr(ta, 0.6, 0.95)) }); set(R.arco2, { d, opacity: n1(1 - pr(ta, 0.6, 0.95)) }); }
      else { set(R.arco, { d: "", opacity: 0 }); set(R.arco2, { d: "", opacity: 0 }); }
      txt(R.v, cerrado ? "V = 12 V" : ta < 0.05 ? "V = 12 V" : "V = 3400 V"); set(R.v, { fill: ab ? C.rojo : "#e8f4ff" });
      txt(R.f, "v = L·di/dt"); txt(R.i, cerrado ? "i = " + (I0 * 2).toFixed(2) + " A" : "i → 0 A");
      set(R.flash, { opacity: n1(ab ? 0.5 * (1 - pr(t, T, T + 0.25)) : 0) });
    }
  };

  /* 5. Transistor: corriente, fuga térmica y humo */
  ESC[5] = {
    dur: 4.8, tc: 3.3, cap: "Fuga térmica",
    dib: id => '<defs><radialGradient id="' + id + 'g"><stop offset="0" stop-color="#ff5a2a" stop-opacity=".9"/><stop offset="1" stop-color="#ff3a10" stop-opacity="0"/></radialGradient></defs><circle data-k="brillo" cx="85" cy="36" r="34" fill="url(#' + id + 'g)" opacity="0"/>' +
      '<path d="M10 78H76.6V62M93.4 62V78H124" fill="none" stroke="' + C.plata + '" stroke-opacity=".5" stroke-width="1.6" stroke-linejoin="round"/><g data-k="tr" transform="translate(50,4) scale(.7)">' + I[5](id) + "</g>" +
      '<g data-k="pts">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(j => '<circle data-k="d' + j + '" r="1.6" fill="' + C.oro + '"/>').join("") + "</g>" + humoMk("s", 5) +
      '<g data-k="onds" fill="none" stroke="#ff9a5a" stroke-width="1.4" stroke-linecap="round" opacity="0">' + [0, 1, 2].map(j => '<path d="M' + (70 + j * 15) + ' 14q3-4 0-8t0-8" transform="translate(0 4)"/>').join("") + "</g>" +
      '<rect x="137.5" y="12" width="5" height="48" rx="2.5" fill="#06121f" stroke="' + C.tinta + '" stroke-opacity=".6"/><circle cx="140" cy="64" r="5.5" fill="' + C.rojo + '"/><rect data-k="hg" x="138.6" y="60" width="2.8" height="0" fill="' + C.rojo + '"/>' +
      texto("tj", 132, 22, 6.6, "#e8f4ff", "end", 700) + texto("ret", 8, 14, 5.8, C.oro),
    f(t, R) {
      const p = Math.pow(pr(t, 0.2, 3.0), 1.8), T = 25 + 150 * p;
      const Tc = mezcla([48, 53, 63], [140, 30, 20], p);
      set(R.tbody, { fill: Tc }); set(R.brillo, { opacity: n1(p * 0.9 * (0.9 + 0.1 * Math.sin(t * 13))) });
      const hh = 46 * (T - 25) / 150; set(R.hg, { y: n1(60 - hh), height: n1(hh) });
      txt(R.tj, "Tj = " + Math.round(T) + " °C"); txt(R.ret, t > 0.8 ? "Ic ↑  T ↑  Ic ↑" : "");
      const s = t * (0.5 + 0.5 * t), pin = [[10, 78], [76.6, 78], [76.6, 62]], pout = [[93.4, 62], [93.4, 78], [124, 78]];
      for (let j = 0; j < 12; j++) { const a = j < 6 ? along(pin, s + j / 6) : along(pout, s + (j - 6) / 6); set(R["d" + j], { cx: n1(a[0]), cy: n1(a[1]), r: n1(1.5 + p * 1.1), fill: p > 0.5 ? "#ffd27a" : C.oro }); }
      set(R.onds, { opacity: n1(p * 0.9), transform: "translate(0 " + n1(-3 * ((t * 3) % 1)) + ")" });
      set(R.tr, { transform: "translate(" + n1(50 + (t > 2.9 ? Math.sin(t * 70) * 0.8 : 0)) + ",4) scale(.7)" });
      humoF(R, "s", 5, 85, 22, 3.0, t, 22);
      set(R.flash, { opacity: n1(t >= 3.0 ? 0.4 * (1 - pr(t, 3.0, 3.25)) : 0) });
    }
  };

  /* 6. Fuente: rampa de tensión, LED de CC y chispas */
  ESC[6] = {
    dur: 4.8, tc: 3.3, cap: "Cortocircuito a 30 V",
    dib: () => '<g data-k="cuerpo"><rect x="10" y="8" width="140" height="66" rx="6" fill="#3a4353" stroke="#8794aa" stroke-width="2"/><rect x="16" y="14" width="66" height="28" rx="2.5" fill="#06120c" stroke="#1f2a26"/><rect x="88" y="14" width="42" height="28" rx="2.5" fill="#06120c" stroke="#1f2a26"/>' +
      '<g data-k="dv"></g><g data-k="da"></g><text x="80" y="37" font-size="8" fill="#5dff9a" font-family="' + MONO + '" font-weight="700" text-anchor="end">V</text><text x="128" y="40" font-size="6" fill="#5dff9a" font-family="' + MONO + '" font-weight="700" text-anchor="end">A</text>' +
      '<circle cx="140" cy="26" r="7" fill="#1d2330" stroke="#aab6c8" stroke-width="1.5"/><path d="M140 26l4-5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="140" cy="54" r="6" fill="#1d2330" stroke="#aab6c8" stroke-width="1.5"/><path d="M140 54l-3-5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="26" cy="58" r="5" fill="#e0403a" stroke="#fff" stroke-width="1.2"/><circle cx="42" cy="58" r="5" fill="#1a1a1a" stroke="#fff" stroke-width="1.2"/><circle cx="68" cy="56" r="2.6" fill="' + C.verde + '"/><circle data-k="cc" cx="88" cy="56" r="2.6" fill="#ff5a4a" opacity=".3"/>' +
      '<text x="68" y="66" font-size="4.6" fill="#cfd6e0" font-family="' + MONO + '" text-anchor="middle">CV</text><text x="88" y="66" font-size="4.6" fill="#cfd6e0" font-family="' + MONO + '" text-anchor="middle">CC</text></g>' +
      '<path data-k="cable" d="M26 63C24 88 44 88 42 63" fill="none" stroke="#d98a2b" stroke-width="2.6" stroke-linecap="round"/>' + rayosMk("r", 9, "#ffe066", 1.8) + '<circle data-k="ch" cx="34" cy="77" r="0" fill="#fff" opacity="0"/>',
    f(t, R) {
      const V = 30 * ease(pr(t, 0.3, 2.3)), A = pr(t, 1.6, 2.3) * 3, cc = t >= 2.3;
      const fmt = V.toFixed(1).padStart(4, " ");
      R.dv.innerHTML = siete(21, 18, 20, fmt, "#5dff9a"); R.da.innerHTML = siete(92, 19, 14, A.toFixed(2), "#5dff9a");
      set(R.cc, { opacity: cc ? n1(0.75 + 0.25 * Math.sin(t * 16)) : 0.25, fill: "#ff3a2a" });
      const hot = pr(t, 2.3, 3.0);
      set(R.cable, { stroke: mezcla([217, 138, 43], [255, 245, 200], hot) });
      const sh = cc ? Math.sin(t * 90) * 0.5 : 0; set(R.cuerpo, { transform: "translate(" + n1(sh) + " 0)" });
      const sp = cc ? (t * 14) % 1 : 1;
      rayos(R, "r", 9, 34, 77, 3, 15, cc ? sp : 1, t * 9); if (!cc) for (let j = 0; j < 9; j++) set(R["r" + j], { opacity: 0 });
      set(R.ch, { r: n1(cc ? 4 + 2 * Math.sin(t * 40) : 0), opacity: cc ? 0.7 : 0 });
      set(R.flash, { opacity: n1(cc ? 0.4 * (1 - pr(t, 2.3, 2.5)) : 0) });
    }
  };

  /* 7. Amplificador operacional: la salida se satura en los rieles */
  ESC[7] = {
    dur: 4.8, tc: 3.3, cap: "Saturado",
    dib: () => '<rect x="6" y="24" width="44" height="40" rx="2" fill="#06121f" stroke="' + C.tinta + '" stroke-opacity=".4"/><rect x="110" y="22" width="44" height="44" rx="2" fill="#06121f" stroke="' + C.tinta + '" stroke-opacity=".4"/>' +
      '<path d="M6 44H50M110 44H154" stroke="' + C.tinta + '" stroke-opacity=".22" stroke-width=".7"/><path d="M110 24H154M110 64H154" stroke="' + C.rojo + '" stroke-width=".9" stroke-dasharray="3 2"/>' + texto("vp", 108, 26, 4.6, C.rojo, "end") + texto("vn", 108, 66, 4.6, C.rojo, "end") +
      '<path data-k="ent" fill="none" stroke="' + C.verde + '" stroke-width="1.8" stroke-linejoin="round"/><path data-k="sal" fill="none" stroke="' + C.oro + '" stroke-width="1.8" stroke-linejoin="round"/><path data-k="rec" fill="none" stroke="' + C.rojo + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M50 44H54V56H58M102 44H110M54 32H58" fill="none" stroke="' + C.tinta + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M58 22V66L102 44z" fill="rgba(60,130,210,.3)" stroke="' + C.tinta + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M61 32H67" stroke="' + C.rojo + '" stroke-width="2" stroke-linecap="round"/><path d="M61 56H67M64 53V59" stroke="' + C.verde + '" stroke-width="2" stroke-linecap="round"/>' + texto("g", 80, 76, 7, C.oro, "middle", 700) + texto("clip", 132, 15, 6.4, C.rojo, "middle", 700) + texto("tin", 28, 18, 5.2, C.verde, "middle") + texto("tou", 132, 76, 5.2, C.oro, "middle"),
    f(t, R) {
      const G = 1 + 11 * ease(pr(t, 0.4, 3.0)), ph = t * 6, N = 60;
      let de = "", ds = "", dr = "", clipped = false, prevC = false;
      for (let j = 0; j <= N; j++) {
        const u = j / N, s = Math.sin(2 * Math.PI * 2 * u - ph), yi = 44 - 6 * s, v = 6 * G * s, c = Math.abs(v) > 20, yo = 44 - cl(v, -20, 20);
        de += (j ? "L" : "M") + n1(6 + 44 * u) + " " + n1(yi) + " "; ds += (j ? "L" : "M") + n1(110 + 44 * u) + " " + n1(yo) + " ";
        if (c && prevC) dr += "L" + n1(110 + 44 * u) + " " + n1(yo); else if (c) dr += "M" + n1(110 + 44 * u) + " " + n1(yo);
        if (c) clipped = true; prevC = c;
      }
      set(R.ent, { d: de }); set(R.sal, { d: ds }); set(R.rec, { d: dr });
      txt(R.g, "A = x" + Math.round(G)); txt(R.vp, "+Vcc"); txt(R.vn, "-Vcc"); txt(R.tin, "entrada"); txt(R.tou, "salida");
      txt(R.clip, clipped && t > 1.2 ? (Math.floor(t * 4) % 2 ? "CLIP!" : "") : "");
    }
  };

  /* 8. Diodo LED: sin resistencia en serie, brilla, ciega y muere */
  ESC[8] = {
    dur: 4.8, tc: 3.4, cap: "Sin resistencia en serie",
    dib: id => '<defs><radialGradient id="' + id + 'g"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".35" stop-color="#ff6a5a" stop-opacity=".75"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient></defs>' +
      '<circle data-k="glow" cx="80" cy="34" r="10" fill="url(#' + id + 'g)" opacity="0"/><g transform="translate(80,-4) scale(.82)">' + ledCuerpo() + "</g>" + rayosMk("r", 10, "#fff2a8", 2.2) + humoMk("s", 5) +
      '<path d="M73.6 61.2V66H30M86.4 69.4V76H26" fill="none" stroke="' + C.plata + '" stroke-opacity=".6" stroke-width="1.6" stroke-linejoin="round"/><g transform="translate(4,48)"><rect x="4" y="-12" width="22" height="32" rx="3" fill="#2b3446" stroke="#8794aa" stroke-width="1.4"/><rect x="4" y="-12" width="22" height="7" rx="2" fill="#e0403a"/><text x="15" y="12" font-size="8" fill="#fff" text-anchor="middle" font-family="' + MONO + '" font-weight="700">9 V</text></g>' +
      texto("i", 152, 14, 7, "#e8f4ff", "end", 700) + texto("vf", 152, 24, 5.6, C.tinta, "end"),
    f(t, R) {
      const L = ease(pr(t, 0.2, 2.9)), muerto = t >= 3.05, cuerpo = R.ledcuerpo, ledint = R.ledint;
      const col = muerto ? "#2a1512" : L < 0.6 ? mezcla([110, 20, 18], [255, 90, 80], L / 0.6) : mezcla([255, 90, 80], [255, 255, 245], (L - 0.6) / 0.4);
      set(cuerpo, { fill: col, "fill-opacity": muerto ? 0.95 : 0.85, stroke: muerto ? "#5a3a34" : "#ffb3a8" });
      set(ledint, { stroke: muerto ? "#150a08" : "#ffd2cc" });
      const g = muerto ? 0 : L; set(R.glow, { r: n1(8 + 42 * g), opacity: n1(g) });
      rayos(R, "r", 10, 80, 30, 14, 14 + 26 * g, muerto ? 0 : 1, t * 0.4 - 1.57); if (muerto) for (let j = 0; j < 10; j++) set(R["r" + j], { opacity: 0 });
      else for (let j = 0; j < 10; j++) set(R["r" + j], { opacity: n1(g * 0.9) });
      txt(R.i, muerto ? "I = 0 mA" : "I = " + Math.round(20 + 1500 * L * L) + " mA"); set(R.i, { fill: muerto ? C.tinta : L > 0.5 ? C.rojo : "#e8f4ff" });
      txt(R.vf, "Vf = 2 V"); humoF(R, "s", 5, 80, 24, 3.15, t, 22);
      const fl = t >= 2.85 ? (t < 3.05 ? pr(t, 2.85, 3.05) : 1 - pr(t, 3.05, 3.5)) : 0; set(R.flash, { opacity: n1(0.95 * fl) });
    }
  };

  /* ============================================================
     Las seis clásicas del edificio: su foto real de icono y una escena
     dibujada en SVG (con la foto de recuadro). Van por id.
     ============================================================ */
  const CLAS = { extintor: "Extintor", enceradora: "Enceradora", manguera: "Manguera", candado: "Candado", trofeo: "Trofeo", taburete: "Taburete" };
  const foto = id => "img/armas/" + id + ".webp";
  /* Recuadro con la foto real de la arma, esquinas redondeadas. */
  const recuadro = (arma, uid, x, y, w, h) => '<defs><clipPath id="' + uid + 'i"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2.5"/></clipPath></defs>' +
    '<image href="' + foto(arma) + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + uid + 'i)"/>' +
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2.5" fill="none" stroke="#e8f4ff" stroke-width="1"/>';
  const traza = (e, x, y, r, s) => set(e, { transform: "translate(" + n1(x) + " " + n1(y) + ") rotate(" + n1(r || 0) + ")" + (s != null ? " scale(" + n1(s) + ")" : "") });
  const arcoP = (cx, cy, r, a0, a1) => {
    const p = a => n1(cx + r * Math.cos(a * Math.PI / 180)) + " " + n1(cy + r * Math.sin(a * Math.PI / 180));
    return "M" + p(a0) + "A" + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + p(a1);
  };
  const parab = k => 4 * k * (1 - k);

  const ESC_CLAS = {};

  /* Extintor: una nube de espuma llena la escena y la aguja cae a cero */
  ESC_CLAS.extintor = {
    dur: 4.8, tc: 3.4, cap: "Apagado para siempre",
    dib: id => {
      let nube = "";
      for (let j = 0; j < 16; j++) nube += '<circle data-k="c' + j + '" r="3" fill="' + (j % 2 ? "#dbe8f5" : "#f4f8ff") + '" opacity="0"/>';
      return '<rect y="78" width="160" height="7" fill="#12324f"/>' +
        '<path d="M14 78V44a11 11 0 0 1 11-11h4a11 11 0 0 1 11 11V78z" fill="#d62e2a" stroke="#7d1512" stroke-width="1.4"/><path d="M18 46V75" stroke="#ff9a92" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' +
        '<rect x="19" y="52" width="16" height="15" rx="1.5" fill="#f4f0e4"/><text x="27" y="62" font-size="5" fill="#9a1a16" text-anchor="middle" font-weight="700" font-family="' + SANS + '">EXT</text>' +
        '<rect x="22" y="26" width="10" height="8" fill="#2b2f36"/><path d="M17 26h20" stroke="#2b2f36" stroke-width="3" stroke-linecap="round"/><path d="M19 21L45 17" stroke="#2b2f36" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M36 29C48 29 50 40 58 42" fill="none" stroke="#1b1e24" stroke-width="2.6" stroke-linecap="round"/><path d="M56 40l7 4-2 3-7-4z" fill="#2b2f36"/>' +
        '<circle cx="138" cy="30" r="16" fill="#0a1a2c" stroke="' + C.plata + '" stroke-width="2"/><path d="' + arcoP(138, 30, 12, 135 + 270 * 0.5, 135 + 270 * 0.85) + '" fill="none" stroke="' + C.verde + '" stroke-width="3"/>' +
        '<path d="' + arcoP(138, 30, 12, 135, 135 + 270 * 0.12) + '" fill="none" stroke="' + C.rojo + '" stroke-width="3"/>' +
        '<line data-k="ag" x1="138" y1="30" x2="138" y2="30" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="138" cy="30" r="2" fill="' + C.plata + '"/>' +
        texto("bar", 138, 54, 6, "#e8f4ff", "middle", 700) +
        '<rect x="104" y="63" width="9" height="15" rx="1" fill="#f3e6c0" stroke="#a88f55" stroke-width=".8"/><path d="M108.5 63V60" stroke="#333" stroke-width=".9"/>' +
        '<path data-k="ll" d="M0 0C-3.4-3-3.4-6.5 0-11C3.4-6.5 3.4-3 0 0z" fill="' + C.oro + '"/>' + humoMk("s", 4) + nube +
        recuadro("extintor", id, 66, 5, 30, 20);
    },
    f(t, R) {
      for (let j = 0; j < 16; j++) {
        const tx = 20 + (j % 4) * 40 + ((j * 53) % 17 - 8), ty = 14 + Math.floor(j / 4) * 21 + ((j * 29) % 11 - 5);
        const p = pr(t, 0.5 + j * 0.05, 2.7), e = ease(p);
        const fin = 1 - 0.4 * pr(t, 3.6, 4.5);
        set(R["c" + j], { cx: n1(lerp(62, tx, e)), cy: n1(lerp(44, ty, e)), r: n1(3 + 24 * e), opacity: n1(p > 0 ? 0.92 * fin : 0) });
      }
      const v = t < 0.5 ? 0.7 : 0.7 * (1 - ease(pr(t, 0.5, 3.0)));
      const a = (135 + 270 * v + (v > 0.02 ? Math.sin(t * 30) * 1.2 : 0)) * Math.PI / 180;
      set(R.ag, { x2: n1(138 + 11 * Math.cos(a)), y2: n1(30 + 11 * Math.sin(a)), stroke: v < 0.15 ? C.rojo : "#fff" });
      txt(R.bar, Math.round(12 * v / 0.7) + " bar"); set(R.bar, { fill: v < 0.15 ? C.rojo : "#e8f4ff" });
      const ap = ease(pr(t, 1.7, 2.3));
      set(R.ll, { transform: "translate(108.5 60) scale(" + n1((1 - ap) * (1 + Math.sin(t * 20) * 0.08)) + ")", opacity: n1(ap < 1 ? 1 : 0) });
      humoF(R, "s", 4, 108.5, 56, 2.3, t, 18);
      set(R.flash, { opacity: n1(0.35 * pr(t, 0.5, 0.62) * (1 - pr(t, 0.62, 1.1))) });
    }
  };

  /* Enceradora: gira cada vez más rápido, patina y se lleva por delante el cartel de piso mojado */
  ESC_CLAS.enceradora = {
    dur: 4.8, tc: 3.3, cap: "Pulido hasta el final",
    dib: id => {
      let e = "", w = "", sp = "";
      for (let j = 0; j < 6; j++) { e += '<line data-k="e' + j + '" x1="0" y1="0" x2="0" y2="0" stroke="' + C.oro + '" stroke-width="1.6" stroke-linecap="round"/>'; sp += '<line data-k="sp' + j + '" stroke="#ffe066" stroke-width="1.6" stroke-linecap="round" opacity="0"/>'; }
      for (let j = 0; j < 3; j++) w += '<ellipse data-k="w' + j + '" rx="' + (24 + j * 4) + '" ry="' + (6 + j) + '" fill="none" stroke="#e8f4ff" stroke-width="1.4" stroke-dasharray="9 13" opacity="0"/>';
      return '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6aa3"/><stop offset="1" stop-color="#0d2d4c"/></linearGradient></defs>' +
        '<rect y="60" width="160" height="25" fill="url(#' + id + 'g)"/><path d="M0 60H160" stroke="' + C.tinta + '" stroke-opacity=".5" stroke-width=".8"/><path d="M14 68H58M92 77H146M30 81H70" stroke="#fff" stroke-opacity=".2" stroke-width="1.2" stroke-linecap="round"/>' +
        '<path data-k="huella" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>' +
        '<g data-k="mq"><ellipse cx="0" cy="6" rx="18" ry="4" fill="#fff" opacity=".18"/><ellipse cx="0" cy="0" rx="20" ry="5" fill="#2b2f36" stroke="#8794aa" stroke-width="1.2"/>' + e + w + sp +
        '<path d="M-9-2V-26a9 4 0 0 1 18 0V-2z" fill="#e0403a" stroke="#7d1512" stroke-width="1.2"/><path d="M-5-6V-24" stroke="#ff9a92" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><path d="M0-26L-15-50" stroke="' + C.plata + '" stroke-width="3" stroke-linecap="round"/><path d="M-21-52h11" stroke="#2b2f36" stroke-width="3.6" stroke-linecap="round"/></g>' +
        '<g data-k="cono"><path d="M-8 0L0-20L8 0z" fill="#ffd21f" stroke="#7a5a00" stroke-width="1"/><text y="-3" font-size="9" fill="#7a5a00" text-anchor="middle" font-weight="800" font-family="' + SANS + '">!</text></g>' +
        texto("rpm", 152, 12, 6.4, "#e8f4ff", "end", 700) + texto("vel", 152, 21, 5, C.tinta, "end") + recuadro("enceradora", id, 62, 5, 30, 20);
    },
    f(t, R) {
      const mx = t < 2.6 ? 26 + 82 * Math.pow(pr(t, 0.5, 2.6), 2) : 108 - 10 * ease(pr(t, 2.6, 3.6));
      const vel = ease(pr(t, 0.2, 2.6)) * (1 - 0.7 * pr(t, 3.2, 4.4)), ph = 3 * t + 22 * Math.pow(Math.min(t, 2.6), 2);
      traza(R.mq, mx, 72, t > 2.4 && t < 2.8 ? -5 : 0);
      for (let j = 0; j < 6; j++) { const a = ph + j * Math.PI / 3; set(R["e" + j], { x2: n1(17 * Math.cos(a)), y2: n1(4.2 * Math.sin(a)) }); }
      for (let j = 0; j < 3; j++) set(R["w" + j], { opacity: n1(vel * 0.75), "stroke-dashoffset": n1(-ph * (12 + j * 4)) });
      const on = t > 1.8 && t < 3.7;
      rayos(R, "sp", 6, 19, 0, 3, 11, (t * 2.4) % 1, -1.2);
      for (let j = 0; j < 6; j++) if (!on) set(R["sp" + j], { opacity: 0 });
      set(R.huella, { d: "M26 74H" + n1(Math.max(26, mx - 10)) });
      const p = pr(t, 2.6, 3.9);
      traza(R.cono, 132 + 12 * p, 78 - 30 * parab(p), 105 * ease(p));
      txt(R.rpm, Math.round(3200 * vel) + " rpm"); txt(R.vel, t > 2.6 ? "¡patina!" : "");
    }
  };

  /* Manguera: sale del gabinete rojo y un chorro a presión tumba unas cajas */
  ESC_CLAS.manguera = {
    dur: 4.8, tc: 3.4, cap: "A presión",
    dib: id => {
      let g = "", cj = "";
      for (let j = 0; j < 8; j++) g += '<circle data-k="g' + j + '" r="1.5" fill="#9fe0ff" opacity="0"/>';
      for (let j = 0; j < 3; j++) cj += '<g data-k="bj' + j + '"><rect width="14" height="14" fill="#b8894f" stroke="#6b4a1f" stroke-width="1"/><path d="M0 7H14M7 0V14" stroke="#d9c08a" stroke-width="1.4"/></g>';
      return '<rect y="78" width="160" height="7" fill="#12324f"/><ellipse data-k="charco" cx="100" cy="81" rx="0" ry="0" fill="#5cc8ff" opacity=".5"/>' +
        '<rect x="6" y="14" width="38" height="64" rx="2" fill="#c8322e" stroke="#6d1512" stroke-width="1.6"/><rect x="10" y="18" width="30" height="46" rx="1.5" fill="#3a0f10" stroke="#ff9a92" stroke-width=".8"/>' +
        '<circle cx="25" cy="40" r="13" fill="none" stroke="#e8e0d0" stroke-width="2.2"/><circle cx="25" cy="40" r="8.5" fill="none" stroke="#e8e0d0" stroke-width="2.2"/><circle cx="25" cy="40" r="3.4" fill="#e8e0d0"/>' +
        '<text x="25" y="72" font-size="4.6" fill="#fff" text-anchor="middle" font-weight="700" font-family="' + SANS + '">MANGUERA</text>' +
        '<path data-k="hose" d="M44 56C60 56 62 76 78 74L90 66" pathLength="100" fill="none" stroke="#2a2f38" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="0 100"/>' +
        '<path data-k="boq" d="M86 68l8-6 2.4 2.6-8 6z" fill="' + C.plata + '" stroke="#5a6472" stroke-width=".8" opacity="0"/>' +
        '<path data-k="ch" fill="none" stroke="#5cc8ff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path data-k="ch2" fill="none" stroke="#e6f8ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' + cj + g +
        '<rect x="104" y="15" width="48" height="5" rx="2.5" fill="#06121f" stroke="' + C.tinta + '" stroke-opacity=".5"/><rect data-k="med" x="104" y="15" width="0" height="5" rx="2.5" fill="#5cc8ff"/>' + texto("bar", 152, 30, 6.4, "#e8f4ff", "end", 700) + texto("cau", 152, 39, 5, C.tinta, "end") +
        recuadro("manguera", id, 62, 5, 30, 20);
    },
    f(t, R) {
      const hp = ease(pr(t, 0.3, 1.5));
      set(R.hose, { "stroke-dasharray": n1(hp * 100) + " 100" }); set(R.boq, { opacity: hp >= 1 ? 1 : 0 });
      const jp = ease(pr(t, 1.55, 2.3)), pts = [], N = 14;
      for (let j = 0; j <= N; j++) { const u = jp * j / N; pts.push(n1(92 + 34 * u) + " " + n1(64 - 22 * u + 10 * u * u + (jp >= 1 ? Math.sin(t * 25 + j) * 0.5 : 0))); }
      const d = jp > 0 ? "M" + pts.join("L") : "";
      set(R.ch, { d }); set(R.ch2, { d });
      const bar = 8 * ease(pr(t, 1.4, 2.2));
      set(R.med, { width: n1(48 * bar / 8) }); txt(R.bar, bar.toFixed(1) + " bar"); txt(R.cau, t > 1.6 ? "caudal máximo" : "");
      const X0 = [118, 133, 125.5], Y0 = [64, 64, 50], XE = [104, 146, 128], YE = [64, 64, 64], RE = [-30, 80, 200];
      for (let j = 0; j < 3; j++) {
        const tk = 2.2 + j * 0.15, k = pr(t, tk, tk + 1.1), e = ease(k);
        traza(R["bj" + j], lerp(X0[j], XE[j], e), lerp(Y0[j], YE[j], e) - 26 * parab(k), RE[j] * e);
      }
      for (let j = 0; j < 8; j++) {
        const k = ((t * 1.3 + j * 0.13) % 1), on = t > 2.2;
        set(R["g" + j], { cx: n1(126 + (j - 3.5) * 5 * k + 14 * k), cy: n1(52 - 22 * parab(k) * (0.5 + (j % 3) * 0.3) + 24 * k * k), opacity: on ? n1(1 - k) : 0 });
      }
      const c = ease(pr(t, 2.2, 4.3));
      set(R.charco, { rx: n1(42 * c), ry: n1(3.4 * c), opacity: n1(0.5 * (c > 0 ? 1 : 0)) });
    }
  };

  /* Candado: el grillete se cierra de golpe, gira el dial y se cierra la puerta del locker */
  ESC_CLAS.candado = {
    dur: 4.8, tc: 3.4, cap: "Encerrado en el locker",
    dib: id => {
      let tk = "", ra = rayosMk("k", 6, "#fff2a8", 1.8);
      for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6; tk += '<path d="M' + n1(Math.cos(a) * 7) + " " + n1(Math.sin(a) * 7) + "L" + n1(Math.cos(a) * 9) + " " + n1(Math.sin(a) * 9) + '" stroke="#e8f4ff" stroke-width="1"/>'; }
      return '<g data-k="lk"><rect x="100" y="12" width="42" height="68" rx="2" fill="#0a1220" stroke="#8794aa" stroke-width="1.6"/>' +
        '<circle cx="121" cy="38" r="5.5" fill="#39465a"/><path d="M111 62V50a10 9 0 0 1 20 0V62z" fill="#39465a"/>' +
        '<path data-k="pu" fill="#4a7fbf" stroke="#1f3f6f" stroke-width="1.4" stroke-linejoin="round"/><path data-k="ven" fill="none" stroke="#1f3f6f" stroke-width="1.6" stroke-linecap="round"/><rect data-k="asa" y="44" width="2.4" height="9" rx="1" fill="#e8f4ff"/>' +
        '<g data-k="pq" opacity="0"><path d="M-3.4 0V-3.4a3.4 3.4 0 0 1 6.8 0V0" fill="none" stroke="' + C.plata + '" stroke-width="1.8"/><rect x="-5" y="0" width="10" height="7.6" rx="1.2" fill="#d8a63a" stroke="#7a5a12" stroke-width=".8"/></g></g>' +
        '<g data-k="gril"><path d="M40 46V34a12 12 0 0 1 24 0V46" fill="none" stroke="' + C.plata + '" stroke-width="5" stroke-linecap="round"/></g>' +
        '<rect x="34" y="46" width="36" height="30" rx="5" fill="#d8a63a" stroke="#7a5a12" stroke-width="1.4"/><path d="M38 50H66" stroke="#ffe7a3" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' +
        '<circle cx="52" cy="63" r="10" fill="#2b2f36" stroke="' + C.plata + '" stroke-width="1.4"/><g data-k="dial" transform="translate(52 63)">' + tk + '<circle cx="0" cy="-5" r="1.4" fill="' + C.oro + '"/></g><path d="M52 51.2l-2.4-3.6h4.8z" fill="' + C.rojo + '"/>' +
        '<g transform="translate(52 46)">' + ra + '</g>' + texto("clank", 52, 30, 7, "#fff2a8", "middle", 800) + texto("cod", 8, 20, 5.6, C.tinta) + texto("bam", 121, 8, 7, "#fff2a8", "middle", 800) + recuadro("candado", id, 72, 5, 24, 16);
    },
    f(t, R) {
      const cerr = ease(pr(t, 1.7, 1.82));
      set(R.gril, { transform: "translate(0 " + n1(-10 * (1 - cerr)) + ") rotate(" + n1(-16 * (1 - cerr)) + " 64 46)" });
      const g = t < 1.7 ? ease(pr(t, 0.3, 1.7)) * 1080 : 1080 + 30 * Math.sin((t - 1.7) * 9) * (1 - pr(t, 1.7, 2.3));
      set(R.dial, { transform: "translate(52 63) rotate(" + n1(g) + ")" });
      txt(R.cod, t < 0.4 ? "" : t < 1.7 ? ["3", "3 - 27", "3 - 27 - 14"][Math.min(2, Math.floor(pr(t, 0.4, 1.7) * 2.99))] : "3 - 27 - 14");
      rayos(R, "k", 6, 0, 0, 3, 13, pr(t, 1.72, 2.3), 0.3); if (t < 1.72) for (let j = 0; j < 6; j++) set(R["k" + j], { opacity: 0 });
      txt(R.clank, t > 1.75 && t < 2.8 ? "¡CLANK!" : "");
      const sx = t < 2.9 ? 0.16 : 0.16 + 0.84 * Math.pow(pr(t, 2.9, 3.1), 0.7), w = 42 * sx, kk = (1 - sx) * 6;
      set(R.pu, { d: "M100 12L" + n1(100 + w) + " " + n1(12 + kk) + "L" + n1(100 + w) + " " + n1(80 - kk) + "L100 80z" });
      set(R.ven, { d: [22, 27, 32].map(y => "M" + n1(100 + w * 0.2) + " " + y + "H" + n1(100 + w * 0.8)).join("") });
      set(R.asa, { x: n1(100 + w - 7) });
      const sh = t > 3.1 && t < 3.5 ? Math.sin((t - 3.1) * 90) * 1.4 * (1 - pr(t, 3.1, 3.5)) : 0;
      set(R.lk, { transform: "translate(" + n1(sh) + " 0)" });
      txt(R.bam, t > 3.1 && t < 4.2 ? "¡BAM!" : "");
      const pp = ease(pr(t, 3.4, 3.8)), pop = 1 + 0.35 * Math.sin(Math.PI * pp);
      set(R.pq, { opacity: pp > 0 ? 1 : 0, transform: "translate(134 47) scale(" + n1(pp * pop) + ")" });
    }
  };

  /* Trofeo: se inclina en la repisa, cae, rebota con un tintineo y aplasta al de plata */
  const TR_P = [80, 44];
  function simTrofeo(t) {
    const r = { x: 72, y: 29, rot: 0, imp: [], golpe: 99 };
    if (t < 0.8) { r.rot = t > 0.5 ? Math.sin((t - 0.5) * 40) * 1.5 * (t < 0.8 ? 1 : 0) : 0; return r; }
    const tip = a => ({ x: TR_P[0] - 8 * Math.cos(a) + 15 * Math.sin(a), y: TR_P[1] - 8 * Math.sin(a) - 15 * Math.cos(a) });
    if (t < 1.4) { const a = 40 * Math.pow(pr(t, 0.8, 1.4), 2) * Math.PI / 180, q = tip(a); r.x = q.x; r.y = q.y; r.rot = a * 180 / Math.PI; return r; }
    const q0 = tip(40 * Math.PI / 180);
    let x = q0.x, y = q0.y, vx = 38, vy = -10, tt = 1.4;
    const dt = 1 / 240;
    while (tt < t) {
      tt += dt; vy += 190 * dt; x += vx * dt; y += vy * dt;
      if (y >= 71) { y = 71; if (vy > 25) { r.imp.push({ t: tt, x }); vy = -0.42 * vy; } else vy = 0; vx *= 1 - 5 * dt; }
      if (x >= 104 && r.golpe === 99) r.golpe = tt;
    }
    r.x = Math.min(x, 122); r.y = y; r.rot = 40 + 230 * ease(pr(t, 1.4, 2.7));
    return r;
  }
  ESC_CLAS.trofeo = {
    dur: 4.8, tc: 3.4, cap: "Primer lugar en homicidio",
    dib: id => {
      const copa = (k, c1, c2, c3, num, esc) => '<g data-k="' + k + '"><g transform="scale(' + esc + ')"><rect x="-9" y="-5" width="18" height="5" rx="1" fill="#8a5a2b" stroke="#4b2f12" stroke-width=".8"/><rect x="-6" y="-7" width="12" height="2.4" fill="' + c2 + '"/><path d="M-2-7V-13h4V-7z" fill="' + c2 + '"/>' +
        '<path d="M-11-32h22c0 11-5 17-11 19c-6-2-11-8-11-19z" fill="' + c1 + '" stroke="' + c3 + '" stroke-width="1.2"/><path d="M-11-29c-8 0-8 10 0 11M11-29c8 0 8 10 0 11" fill="none" stroke="' + c2 + '" stroke-width="2"/><path d="M-7-30c0 6 2 10 5 13" fill="none" stroke="#fff6c0" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>' +
        '<text y="-19" font-size="8" fill="' + c3 + '" text-anchor="middle" font-weight="800" font-family="' + SANS + '">' + num + "</text></g></g>";
      return '<rect y="80" width="160" height="5" fill="#12324f"/><rect x="14" y="44" width="68" height="4" fill="#8a5a2b" stroke="#4b2f12" stroke-width=".8"/><path d="M24 48v10l10-10M62 48v10l-10-10" fill="none" stroke="#4b2f12" stroke-width="2"/>' +
        copa("plata", "#cfd6e0", "#aab4c4", "#5a6472", "2", 0.72) +
        [0, 1, 2].map(j => '<ellipse data-k="ri' + j + '" fill="none" stroke="#fff2a8" stroke-width="1.4" opacity="0"/>').join("") + copa("oro", "#f2c230", "#e0a820", "#7a5a00", "1", 1) +
        texto("ding", 118, 44, 7.4, "#fff2a8", "middle", 800) + recuadro("trofeo", id, 100, 5, 30, 20) + '<path d="M22 44h56" stroke="#fff" stroke-opacity=".0"/>';
    },
    f(t, R) {
      const s = simTrofeo(t);
      set(R.oro, { transform: "translate(" + n1(s.x) + " " + n1(s.y) + ") rotate(" + n1(s.rot) + ") translate(0 15)" });
      const k = pr(t, s.golpe, s.golpe + 0.9), e = ease(k);
      set(R.plata, { transform: "translate(" + n1(124 + 14 * e) + " " + n1(80 - 4 * e) + ") rotate(" + n1(90 * e) + ")" });
      for (let j = 0; j < 3; j++) {
        const im = s.imp[j], p = im ? pr(t, im.t, im.t + 0.5) : 0;
        set(R["ri" + j], { cx: im ? n1(im.x) : 0, cy: 80, rx: n1(4 + 16 * p), ry: n1(1.6 + 5 * p), opacity: im && p > 0 && p < 1 ? n1(1 - p) : 0 });
      }
      const ult = s.imp[s.imp.length - 1];
      txt(R.ding, ult ? (s.imp.length % 2 ? "¡DING!" : "¡DONG!") : ""); set(R.ding, { x: ult ? n1(Math.min(130, ult.x)) : 118, y: 60 });
    }
  };

  /* Taburete: un arco de golpe, el impacto y una sandía que no lo cuenta */
  ESC_CLAS.taburete = {
    dur: 4.8, tc: 3.3, cap: "Golpe de taburete",
    dib: id => {
      let pz = "", ra = rayosMk("b", 8, "#fff2a8", 2);
      for (let j = 0; j < 6; j++) pz += '<circle data-k="p' + j + '" r="4" fill="#e8455a" stroke="#3f9a4a" stroke-width="1.4" opacity="0"/>';
      const st = '<ellipse cx="0" cy="-8" rx="12" ry="3.6" fill="#b8890f"/><path d="M-12-12v4a12 3.6 0 0 0 24 0v-4z" fill="#d9a520"/><ellipse cx="0" cy="-12" rx="12" ry="3.6" fill="#f2c230" stroke="#a87a12" stroke-width="1"/>' +
        '<path d="M-8-8L-12 12M8-8L12 12M0-6V13" stroke="#c99a12" stroke-width="2.6" stroke-linecap="round"/><path d="M-10 3H10" stroke="#a87a12" stroke-width="1.6"/>';
      return '<defs><g id="' + id + 't">' + st + '</g></defs><rect y="78" width="160" height="7" fill="#12324f"/><path d="' + arcoP(62, 70, 48, -165, -20) + '" fill="none" stroke="' + C.tinta + '" stroke-opacity=".3" stroke-width="1" stroke-dasharray="3 3"/>' +
        [2, 1, 0].map(j => '<use data-k="gh' + j + '" href="#' + id + 't" opacity="0"/>').join("") + '<use data-k="tab" href="#' + id + 't"/>' +
        '<g data-k="melon"><circle r="10" fill="#3f9a4a" stroke="#1f5a2a" stroke-width="1.2"/><path d="M-4-9Q-8 0-4 9M4-9Q8 0 4 9M0-10V10" fill="none" stroke="#1f5a2a" stroke-width="1" opacity=".6"/><path d="M-6-6a8 8 0 0 1 5-3" fill="none" stroke="#9be0a0" stroke-width="1.4" stroke-linecap="round"/></g>' + pz +
        '<g transform="translate(118 66)">' + ra + "</g>" + texto("pam", 118, 40, 8.4, "#fff2a8", "middle", 800) + recuadro("taburete", id, 100, 5, 30, 20);
    },
    f(t, R) {
      const ang = tt => tt < 0.2 ? -150 : tt < 0.9 ? lerp(-150, -165, ease(pr(tt, 0.2, 0.9))) : tt < 2.0 ? lerp(-165, -6, Math.pow(pr(tt, 0.9, 2.0), 2.2)) : lerp(-6, -32, ease(pr(tt, 2.0, 2.7)));
      const pos = a => { const r = a * Math.PI / 180; return [62 + 48 * Math.cos(r), 70 + 48 * Math.sin(r), a + 90]; };
      const a = ang(t), q = pos(a);
      set(R.tab, { transform: "translate(" + n1(q[0]) + " " + n1(q[1]) + ") rotate(" + n1(q[2]) + ")" });
      const vel = t > 1.1 && t < 2.0 ? 1 : 0;
      for (let j = 0; j < 3; j++) { const g = pos(a - 9 * (j + 1)); set(R["gh" + j], { transform: "translate(" + n1(g[0]) + " " + n1(g[1]) + ") rotate(" + n1(g[2]) + ")", opacity: n1(vel * (0.38 - j * 0.11)) }); }
      const h = t >= 2.0 ? 1 : 0, sq = ease(pr(t, 2.0, 2.1));
      set(R.melon, { transform: "translate(124 " + n1(78 - 10 * (1 - 0.45 * sq)) + ") scale(" + n1(1 + 0.35 * sq) + " " + n1(1 - 0.45 * sq) + ")", opacity: t < 2.12 ? 1 : 0 });
      rayos(R, "b", 8, 0, 0, 3, 16, pr(t, 2.0, 2.5), 0.2); if (!h || t > 2.55) for (let j = 0; j < 8; j++) set(R["b" + j], { opacity: 0 });
      set(R.flash, { opacity: n1(h ? 0.4 * (1 - pr(t, 2.0, 2.2)) : 0) });
      txt(R.pam, t > 2.0 ? "¡PAM!" : "");
      for (let j = 0; j < 6; j++) {
        const k = pr(t, 2.05, 3.0), e = ease(k), dx = [-16, -8, 4, 12, 22, 30][j], yy = 76 - (j % 3) * 1.5;
        set(R["p" + j], { cx: n1(124 + dx * e), cy: n1(lerp(68, yy, e) - 26 * parab(k) * (0.6 + (j % 3) * 0.25)), opacity: t > 2.05 ? 1 : 0 });
      }
    }
  };

  /* ---------- chispas de las clásicas ---------- */
  const CHC = {
    extintor: p => [0, 1, 2, 3, 4].map(j => '<circle cx="' + n1(-24 + j * 12 + Math.sin(j * 2) * 5) + '" cy="' + n1(14 - 40 * ease(p) * (0.6 + (j % 3) * 0.25)) + '" r="' + n1(6 + 14 * p) + '" fill="#f4f8ff" opacity="' + n1(0.9 * (1 - p)) + '"/>').join(""),
    enceradora: p => [0, 1, 2].map(j => '<path d="' + arcoP(0, 0, 12 + 10 * j, p * 360 + j * 120, p * 360 + j * 120 + 200) + '" fill="none" stroke="' + (j ? C.tinta : C.oro) + '" stroke-width="4.4" stroke-linecap="round" opacity="' + n1(1 - p) + '"/>').join(""),
    manguera: p => [0, 1, 2, 3, 4].map(j => '<path d="M' + (-24 + j * 12) + " " + n1(-30 + 62 * cl(p * 1.3 - j * 0.06, 0, 1)) + 'q-4 7 0 12q4-5 0-12z" fill="#5cc8ff" opacity="' + n1(1 - p) + '"/>').join("") + '<ellipse cy="34" rx="' + n1(6 + 34 * p) + '" ry="' + n1(2 + 6 * p) + '" fill="none" stroke="#9fe0ff" stroke-width="3" opacity="' + n1(1 - p) + '"/>',
    candado: p => '<path d="M-14 4V-6a14 14 0 0 1 28 0V' + n1(4 - 12 * (1 - ease(pr(p, 0, 0.35)))) + '" fill="none" stroke="' + C.plata + '" stroke-width="6" stroke-linecap="round"/><rect x="-20" y="4" width="40" height="28" rx="5" fill="#d8a63a" stroke="#7a5a12" stroke-width="2"/>' +
      [0, 1, 2, 3, 4].map(j => { const a = -2.6 + j * 0.55, q = pr(p, 0.3, 1); return '<line x1="' + n1(Math.cos(a) * 24 * q) + '" y1="' + n1(-6 + Math.sin(a) * 24 * q) + '" x2="' + n1(Math.cos(a) * (24 + 18 * q)) + '" y2="' + n1(-6 + Math.sin(a) * (24 + 18 * q)) + '" stroke="#fff2a8" stroke-width="4" stroke-linecap="round" opacity="' + n1(q ? 1 - q : 0) + '"/>'; }).join(""),
    trofeo: p => { const r = 8 + 34 * Math.sin(Math.PI * Math.min(1, p * 1.1)), q = 4 + 4 * Math.sin(Math.PI * p); return '<path d="M0 ' + -r + "Q" + q + " " + -q + " " + r + " 0Q" + q + " " + q + " 0 " + r + "Q" + -q + " " + q + " " + -r + " 0Q" + -q + " " + -q + ' 0 ' + -r + 'z" fill="#fff6c0" opacity="' + n1(1 - p * 0.6) + '" transform="rotate(' + n1(p * 40) + ')"/>' + [[-28, -22], [30, -14], [22, 26]].map(([x, y], j) => '<circle cx="' + x + '" cy="' + y + '" r="' + n1(5 * Math.sin(Math.PI * cl(p * 1.3 - j * 0.15, 0, 1))) + '" fill="#ffe066"/>').join(""); },
    taburete: p => '<ellipse cy="22" rx="' + n1(8 + 38 * p) + '" ry="' + n1(3 + 9 * p) + '" fill="none" stroke="#e8f4ff" stroke-width="4" opacity="' + n1(1 - p) + '"/>' + [0, 1, 2, 3, 4, 5].map(j => { const a = -Math.PI + j * Math.PI / 5; return '<line x1="' + n1(Math.cos(a) * 12 * p) + '" y1="' + n1(20 + Math.sin(a) * 12 * p) + '" x2="' + n1(Math.cos(a) * (12 + 30 * p)) + '" y2="' + n1(20 + Math.sin(a) * (12 + 30 * p)) + '" stroke="#ffd21f" stroke-width="5" stroke-linecap="round" opacity="' + n1(1 - p) + '"/>'; }).join("") + '<text y="' + n1(-6 - 14 * p) + '" font-size="18" fill="#fff2a8" text-anchor="middle" font-weight="800" font-family="' + SANS + '" opacity="' + n1(1 - p) + '">¡PAM!</text>'
  };

  const ESCI = Object.assign({}, ESC_CLAS); ELEC.forEach((k, i) => { ESCI[k] = ESC[i]; });

  /* ---------- el motor de las escenas ---------- */
  function escena(arma, host, op) {
    op = op || {};
    const S = ESCI[arma], i = arma;
    const nulo = { parar() {} };
    if (!S || !host) return nulo;
    const id = nuevoId(), cap = op.texto || S.cap;
    host.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escAttr(ARMAS_N[arma] + ": " + cap) + '" style="display:block;width:100%;height:100%">' +
      '<rect width="160" height="100" fill="#0a2038"/><path d="' + REJ160 + '" stroke="#4a90d9" stroke-opacity=".13" stroke-width=".5" fill="none"/>' + S.dib(id) +
      '<rect data-k="flash" width="160" height="100" fill="#fff" opacity="0"/><g data-k="capg" opacity="0"><rect y="85" width="160" height="15" fill="#000" fill-opacity=".62"/><rect y="85" width="3" height="15" fill="' + C.oro + '"/><text data-k="capt" x="80" y="95.6" font-size="8.4" fill="#fff" text-anchor="middle" font-weight="700" font-family="' + SANS + '"></text></g></svg>';
    const svg = host.firstChild, R = {};
    svg.querySelectorAll("[data-k]").forEach(e => { R[e.getAttribute("data-k")] = e; });
    R.capt.textContent = cap;
    let raf = 0, tmr = 0, t0 = 0, vivo = true, acabo = false;
    const pinta = t => {
      try { S.f(t, R); } catch (e) { if (typeof console !== "undefined") console.warn("[clue] escena", i, e); }
      set(R.capg, { opacity: n1(pr(t, S.tc, S.tc + 0.35)) });
    };
    const parar = () => { vivo = false; cancelAnimationFrame(raf); clearTimeout(tmr); };
    const fin = () => { if (acabo) return; acabo = true; if (typeof op.alTerminar === "function") { try { op.alTerminar(); } catch (e) { /* nada */ } } };
    function paso(now) {
      if (!vivo) return;
      if (!host.isConnected) { parar(); return; }
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      if (t >= S.dur) {
        pinta(S.dur);
        if (op.bucle) tmr = setTimeout(() => { if (!vivo) return; t0 = 0; raf = requestAnimationFrame(paso); }, 1400);
        else { vivo = false; fin(); }
        return;
      }
      pinta(t); raf = requestAnimationFrame(paso);
    }
    if (typeof op.t === "number") pinta(op.t);
    else if (reducido()) { pinta(S.dur); setTimeout(fin, 0); }
    else { pinta(0); raf = requestAnimationFrame(paso); }
    return { parar };
  }

  /* ---------- chispas: micro animaciones de aviso (unidades de -50 a 50) ---------- */
  const zig = [[-6, -44], [8, -22], [-8, -12], [10, 8], [-4, 16], [6, 44]];
  const CHE = [
    p => '<circle r="' + n1(8 + 38 * p) + '" fill="none" stroke="' + C.tinta + '" stroke-width="4" opacity="' + n1(1 - p) + '"/><circle r="' + n1(6 + 30 * ease(p)) + '" fill="none" stroke="' + C.vio + '" stroke-width="3" opacity="' + n1(1 - p) + '"/><circle cx="' + n1(30 * Math.cos(p * 9)) + '" cy="' + n1(30 * Math.sin(p * 9)) + '" r="5" fill="' + C.rojo + '"/>',
    p => '<path d="' + onda(-42, 42, 0, 26 * Math.sin(Math.PI * p), u => Math.sin(6 * Math.PI * u + p * 14), 40) + '" fill="none" stroke="' + C.oro + '" stroke-width="5" stroke-linecap="round" opacity="' + n1(1 - pr(p, 0.6, 1)) + '"/>',
    p => '<circle r="' + n1(20 + 14 * p) + '" fill="#ff6a2a" opacity="' + n1(0.55 * Math.sin(Math.PI * p)) + '"/>' + [-16, 0, 16].map((x, j) => '<path d="M' + x + " " + n1(20 - 60 * p) + 'q6-8 0-16t0-16" fill="none" stroke="#ffb27a" stroke-width="4" stroke-linecap="round" opacity="' + n1(1 - p) + '" transform="translate(0 ' + j * 4 + ')"/>').join(""),
    p => { let s = ""; for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5 + 0.3; s += '<line x1="' + n1(Math.cos(a) * 10 * p) + '" y1="' + n1(Math.sin(a) * 10 * p) + '" x2="' + n1(Math.cos(a) * (10 + 34 * p)) + '" y2="' + n1(Math.sin(a) * (10 + 34 * p)) + '" stroke="#ffe066" stroke-width="5" stroke-linecap="round" opacity="' + n1(1 - p) + '"/>'; } return s + '<circle r="' + n1(22 * (1 - p)) + '" fill="#fff" opacity="' + n1(0.8 * (1 - p)) + '"/>'; },
    p => [0, 1].map(j => { const q = cl(p * 1.4 - j * 0.3, 0, 1); return '<ellipse rx="' + n1(10 + 40 * q) + '" ry="' + n1(6 + 22 * q) + '" fill="none" stroke="' + C.tinta + '" stroke-width="4" opacity="' + n1(q ? 1 - q : 0) + '"/>'; }).join(""),
    p => '<circle cy="8" r="30" fill="#ff5a2a" opacity="' + n1(0.5 * Math.sin(Math.PI * p)) + '"/>' + [0, 1, 2, 3, 4, 5, 6].map(j => '<circle cx="' + n1(-30 + j * 10) + '" cy="' + n1(34 - 70 * cl(p * 1.2 - j * 0.04, 0, 1)) + '" r="3.4" fill="' + C.oro + '" opacity="' + n1(1 - p) + '"/>').join(""),
    p => '<path d="M' + zig.map(([x, y]) => n1(x + Math.sin(p * 40 + y) * 3) + " " + y).join("L") + '" fill="none" stroke="#fff6a8" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity="' + n1((1 - p) * (Math.floor(p * 9) % 2 ? 0.55 : 1)) + '"/><path d="M' + zig.map(([x, y]) => n1(x + Math.sin(p * 40 + y) * 3) + " " + y).join("L") + '" fill="none" stroke="#ffb400" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="' + n1(1 - p) + '"/>',
    p => '<path d="' + onda(-42, 42, 0, 1, u => cl(34 * Math.sin(4 * Math.PI * u + p * 10) * (0.5 + 2 * p), -16, 16), 50) + '" fill="none" stroke="' + C.verde + '" stroke-width="5" stroke-linejoin="round" opacity="' + n1(1 - pr(p, 0.6, 1)) + '"/><path d="M-44 -16H44M-44 16H44" stroke="' + C.rojo + '" stroke-width="2.4" stroke-dasharray="6 4" opacity="' + n1(0.8 * (1 - p)) + '"/>',
    p => { let s = '<circle r="' + n1(10 + 34 * p) + '" fill="#fff" opacity="' + n1(0.85 * (1 - p)) + '"/>'; for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; s += '<line x1="' + n1(Math.cos(a) * 16) + '" y1="' + n1(Math.sin(a) * 16) + '" x2="' + n1(Math.cos(a) * (16 + 28 * p)) + '" y2="' + n1(Math.sin(a) * (16 + 28 * p)) + '" stroke="#fff2a8" stroke-width="5" stroke-linecap="round" opacity="' + n1(1 - p) + '"/>'; } return s; }
  ];
  const CH = Object.assign({}, CHC); ELEC.forEach((k, i) => { CH[k] = CHE[i]; });
  function chispa(arma, host, op) {
    const f = CH[arma], nulo = { parar() {} };
    if (!f || !host || reducido()) return nulo;
    const enSvg = typeof SVGElement !== "undefined" && host instanceof SVGElement;
    let nodo, g;
    if (enSvg) {
      nodo = document.createElementNS(NS, "g");
      nodo.setAttribute("transform", "scale(" + n1(((op && op.r) || 24) / 50) + ")");
      nodo.setAttribute("pointer-events", "none");
      host.appendChild(nodo); g = nodo;
    } else {
      nodo = document.createElement("div");
      nodo.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:5";
      nodo.innerHTML = '<svg viewBox="-50 -50 100 100" style="width:100%;height:100%;overflow:visible"><g></g></svg>';
      try { if (getComputedStyle(host).position === "static") host.style.position = "relative"; } catch (e) { /* nada */ }
      host.appendChild(nodo); g = nodo.querySelector("g");
    }
    let raf = 0, vivo = true, t0 = 0;
    const parar = () => { if (!vivo) return; vivo = false; cancelAnimationFrame(raf); if (nodo.parentNode) nodo.parentNode.removeChild(nodo); };
    const paso = now => {
      if (!vivo) return;
      if (!t0) t0 = now;
      const p = cl((now - t0) / 1100, 0, 1);
      if (!nodo.isConnected || p >= 1) { parar(); return; }
      g.innerHTML = f(p); raf = requestAnimationFrame(paso);
    };
    g.innerHTML = f(0); raf = requestAnimationFrame(paso);
    return { parar };
  }

  const DATOS_E = [
    { frase: "Lo dejó en reflexión total con la Carta de Smith.", dato: "La carta de Smith la ideó Phillip H. Smith en 1939, en los Bell Labs: representa todas las impedancias posibles dentro de un solo círculo, y en su borde izquierdo está el cortocircuito." },
    { frase: "Lo descompuso en armónicos con la Transformada de Fourier.", dato: "Fourier propuso en 1807 que toda señal periódica es una suma de senos. Al truncar una onda cuadrada aparece el fenómeno de Gibbs: un rebote de cerca del 9 % que no desaparece por más armónicos que se sumen." },
    { frase: "Lo dejó al rojo vivo con la Resistencia.", dato: "Una resistencia de 1/4 W solo puede disipar 0,25 W como calor. Con 10 V sobre 100 ohm serían 1 W, cuatro veces su límite (P = V²/R). La banda dorada indica una tolerancia de 5 %." },
    { frase: "Lo electrocutó con la descarga del Capacitor.", dato: "El primer capacitor fue la botella de Leyden, en 1745. Los electrolíticos modernos tienen polaridad y una válvula en la tapa: si se sobrecargan o se conectan al revés, la abren de golpe." },
    { frase: "Lo fulminó con el pico de tensión del Inductor.", dato: "Al cortar la corriente de un inductor, v = L di/dt puede dar miles de voltios: así funciona la bobina de encendido de un auto, y por eso los relés llevan un diodo de rueda libre." },
    { frase: "Lo dejó en fuga térmica con el Transistor.", dato: "El primer transistor se construyó en los Bell Labs en 1947, y sus inventores recibieron el Nobel de Física en 1956. En la fuga térmica más temperatura significa más corriente, y más corriente, más temperatura." },
    { frase: "Lo dejó en cortocircuito con la Fuente de poder.", dato: "Las fuentes de laboratorio tienen limitación de corriente: al cortocircuitar sus bornes dejan de regular tensión y fijan la corriente, y se enciende el LED CC." },
    { frase: "Lo dejó saturado con el Amplificador operacional.", dato: "Un operacional tiene una ganancia en lazo abierto del orden de 100 000 (el clásico 741 es de 1968), así que hasta una señal diminuta hace que la salida choque contra los rieles de alimentación." },
    { frase: "Lo cegó con el Diodo LED, sin resistencia en serie.", dato: "El primer LED visible, de luz roja, lo creó Nick Holonyak en 1962. Un LED no limita su propia corriente: necesita una resistencia en serie o se quema en instantes." }
  ];

  const DATOS = {};
  ELEC.forEach((k, i) => { DATOS[k] = DATOS_E[i]; });
  Object.assign(DATOS, {
    extintor: { frase: "Lo apagó para siempre con el Extintor.", dato: "El manómetro de un extintor de polvo debe marcar en la zona verde: si la aguja está fuera de ella, el aparato está descargado o mal presurizado y hay que revisarlo o recargarlo. Por eso se inspeccionan una vez al año." },
    enceradora: { frase: "Lo dejó pulido hasta el final con la Enceradora.", dato: "Una enceradora común hace girar su disco a unas 175 vueltas por minuto; las abrillantadoras de alta velocidad superan las 1500. A esa velocidad el piso queda como un espejo, y también resbaladizo." },
    manguera: { frase: "Lo dejó empapado, a presión, con la Manguera.", dato: "Un chorro de agua a presión empuja hacia atrás a quien sostiene la manguera (es la tercera ley de Newton). En las mangueras contra incendios el retroceso es tanto que se sujetan entre varias personas." },
    candado: { frase: "Lo dejó encerrado en el locker con el Candado.", dato: "Un candado de combinación tiene una pila de discos con una muesca cada uno. Cuando la combinación alinea todas las muescas, el grillete queda libre y se puede abrir; con cualquier otra, la traba lo mantiene cerrado." },
    trofeo: { frase: "Lo coronó campeón del homicidio con el Trofeo.", dato: "La copa Jules Rimet, el trofeo original del Mundial de fútbol, fue robada en Londres en 1966, una semana antes del torneo. La encontró un perro llamado Pickles, envuelta en papel de diario bajo un arbusto." },
    taburete: { frase: "Lo tumbó de un solo golpe con el Taburete.", dato: "Un taburete de tres patas nunca cojea: tres puntos siempre definen un plano, así que apoya firme incluso en un suelo irregular. Con cuatro patas basta que una sea más corta para que se balancee." }
  });

  return { icono, escena, chispa, DATOS, NOMBRES: ARMAS_N, ELECTRICAS: ELEC, CLASICAS: Object.keys(CLAS) };
});
