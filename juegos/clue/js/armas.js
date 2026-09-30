/* Clue - las armas eléctricas: iconos, escenas del crimen y chispas.
   Todo es SVG dibujado aquí, sin imágenes ni librerías. Tres cosas:
   - icono(i): el dibujo de la arma i (viewBox 100x100, estilo plano de laboratorio);
   - escena(i, host, opciones): una animación de 3 a 5 s de cómo se cometió el crimen;
   - chispa(i, host): un destello corto (<= 1,2 s) como aviso.
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

  const REJ100 = rejilla(100, 100, 10);
  function icono(i, atributos) {
    if (!I[i]) return "";
    const id = nuevoId();
    return '<svg xmlns="' + NS + '" viewBox="0 0 100 100"' + (atributos ? " " + atributos : "") + ' role="img" aria-label="' + escAttr(ARMAS_N[i]) + '">' +
      '<rect width="100" height="100" rx="13" fill="' + C.fondo + '"/><path d="' + REJ100 + '" stroke="#4a90d9" stroke-opacity=".16" stroke-width=".6" fill="none"/><rect x="2" y="2" width="96" height="96" rx="11.5" fill="none" stroke="#2f6aa8" stroke-width="1.4"/>' + I[i](id) + "</svg>";
  }
  const ARMAS_N = ["Carta de Smith", "Transformada de Fourier", "Resistencia", "Capacitor", "Inductor", "Transistor", "Fuente de poder", "Amplificador operacional", "Diodo LED"];

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

  /* ---------- el motor de las escenas ---------- */
  function escena(i, host, op) {
    op = op || {};
    const S = ESC[i];
    const nulo = { parar() {} };
    if (!S || !host) return nulo;
    const id = nuevoId(), cap = op.texto || S.cap;
    host.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escAttr(ARMAS_N[i] + ": " + cap) + '" style="display:block;width:100%;height:100%">' +
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
  const CH = [
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
  function chispa(i, host, op) {
    const f = CH[i], nulo = { parar() {} };
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

  const DATOS = [
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

  return { icono, escena, chispa, DATOS, NOMBRES: ARMAS_N };
});
