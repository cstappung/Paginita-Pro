"use strict";
/* ============================================================
   AjusteLab — motor
   Ajusta un modelo a unos datos medidos y responde lo que hace
   falta para el informe: los parámetros con su incertidumbre,
   la calidad del ajuste (χ², χ²/ν y su p), los residuos, las
   magnitudes derivadas con su σ propagada — y de ahí sale la
   tabla en LaTeX y la figura en milímetros para ColabDraw.
   Todo en el navegador, sin backend y sin compilación.
   Vistas: Ajuste, Datos e Informe.
   ============================================================ */
/* El runtime de los documentos .dc evalúa dos veces los <script> del helmet.
   Sin esta guarda la segunda pasada machacaría window.AjusteApp con un módulo
   recién nacido y sin inicializar: la aplicación seguiría funcionando (los
   oyentes son de la primera instancia) pero `ready` se quedaría en false para
   siempre y cada applyOptions() del anfitrión caería en una instancia
   conectada a nada. Es la misma guarda que llevan scope-engine.js y
   filtros-engine.js. */
window.AjusteApp = window.AjusteApp || (function () {

  // ============================================================
  //  1. Números y formato
  // ============================================================
  const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
  const SI = [{ e: -12, s: "p" }, { e: -9, s: "n" }, { e: -6, s: "µ" }, { e: -3, s: "m" },
              { e: 0, s: "" }, { e: 3, s: "k" }, { e: 6, s: "M" }, { e: 9, s: "G" }];

  function fmt(v, unidad, cifras) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    cifras = cifras === undefined ? 4 : cifras;
    if (v === 0) return "0 " + (unidad || "");
    const av = Math.abs(v);
    let ch = { e: 0, s: "" };
    for (const p of SI) if (av >= Math.pow(10, p.e)) ch = p;
    const x = v / Math.pow(10, ch.e);
    let s = x.toPrecision(cifras);
    if (s.indexOf("e") < 0 && s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s + " " + ch.s + (unidad || "");
  }
  function num(v, dec) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    return v.toFixed(dec === undefined ? 2 : dec);
  }
  /* Cifras significativas a secas, sin ceros de relleno. Para números que no
     llevan σ al lado (los valores de partida, una x en la tabla). */
  function sig(v, n) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    if (v === 0) return "0";
    let s = v.toPrecision(n || 6);
    if (s.indexOf("e") < 0 && s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }
  const PREFIJO = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, g: 1e9 };
  function parseSI(texto) {
    const m = String(texto).trim().replace(",", ".").match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Zµ%]*)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    const suf = m[2];
    const mult = suf.length && PREFIJO[suf[0]] !== undefined ? PREFIJO[suf[0]] : 1;
    const v = n * mult;
    return isFinite(v) ? v : null;
  }

  /* ---- Redondeo a la convención del laboratorio ----
     Manda la incertidumbre: se queda con dos cifras significativas si su
     primera cifra es 1 o 2 y con una si es 3 o más, y el valor se redondea a
     ese mismo decimal. Escribir «9.8134 ± 0.4523» es afirmar diezmilésimas que
     la propia σ dice que no se conocen, y es la forma más común de que una
     tabla buena parezca hecha por una máquina que no entiende lo que mide. */
  function redondeaPar(v, s) {
    if (!isFinite(v)) return null;
    if (!isFinite(s) || s <= 0) return { v: v, s: null, dec: null };
    const e = Math.floor(Math.log10(Math.abs(s)));
    const prim = Math.floor(Math.abs(s) / Math.pow(10, e));
    const cif = prim <= 2 ? 2 : 1;
    const dec = -(e - (cif - 1));
    const p = Math.pow(10, dec);
    return { v: Math.round(v * p) / p, s: Math.round(s * p) / p, dec: dec };
  }
  /* El par escrito. En notación normal mientras se lea (entre 1e-3 y 1e5) y
     con exponente común fuera de ahí: «0.0000123 ± 0.0000004» no lo lee nadie,
     y separar los exponentes de valor y σ es peor todavía. */
  function formateaPar(v, s, modo) {
    modo = modo || "txt";
    if (!isFinite(v)) return "—";
    const conS = isFinite(s) && s > 0;
    const ref = Math.abs(v) > 0 ? Math.abs(v) : (conS ? s : 0);
    let E = 0;
    if (ref > 0 && (ref >= 1e5 || ref < 1e-3)) E = Math.floor(Math.log10(ref));
    const k = Math.pow(10, -E);
    const r = redondeaPar(v * k, conS ? s * k : NaN);
    if (!r) return "—";
    const dec = r.dec === null ? null : Math.max(0, r.dec);
    const sv = dec === null ? sig(r.v, 6) : r.v.toFixed(dec);
    const ss = r.s === null ? null : r.s.toFixed(dec);
    if (modo === "siunitx") {
      /* Forma compacta de siunitx: la σ va entre paréntesis en las últimas
         cifras del valor. \num{1.234(5)} y \num{1.234(5)e-6} las entienden
         tanto la versión 2 como la 3. */
      if (ss === null) return "\\num{" + sv + (E ? "e" + E : "") + "}";
      const digs = Math.round(r.s * Math.pow(10, dec === null ? 0 : dec));
      return "\\num{" + sv + "(" + digs + ")" + (E ? "e" + E : "") + "}";
    }
    if (modo === "tex") {
      const cuerpo = ss === null ? sv : sv + " \\pm " + ss;
      if (!E) return ss === null ? cuerpo : cuerpo;
      return "(" + cuerpo + ") \\times 10^{" + E + "}";
    }
    const cuerpo = ss === null ? sv : sv + " ± " + ss;
    if (!E) return cuerpo;
    return (ss === null ? cuerpo : "(" + cuerpo + ")") + "·10" + supIndice(E);
  }
  const SUPS = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const supIndice = (n) => String(n).split("").map(c => SUPS[c] || c).join("");

  /* Unidad compuesta a partir de las de las columnas. Devuelve "" en cuanto
     falta alguna de las dos: una unidad a medias («V/») miente más que no
     poner ninguna. */
  function unidadDe(clave, ux, uy) {
    if (!clave) return "";
    if (clave === "rad") return "rad";
    if (clave === "y") return uy || "";
    if (clave === "x") return ux || "";
    if (clave === "y/x") return (ux && uy) ? uy + "/" + ux : "";
    if (clave === "1/x") return ux ? "1/" + ux : "";
    const m = /^y\/x\^(\d+)$/.exec(clave);
    if (m) {
      if (!ux || !uy) return "";
      const k = +m[1];
      return k === 0 ? uy : (k === 1 ? uy + "/" + ux : uy + "/" + ux + "^" + k);
    }
    return "";
  }

  // ============================================================
  //  2. Álgebra lineal
  // ============================================================
  /* Gauss-Jordan con pivoteo parcial, que resuelve el sistema y devuelve la
     inversa en la misma pasada: los parámetros salen del sistema y sus
     incertidumbres de la inversa, así que hacen falta las dos. Los tamaños
     aquí son de una o dos cifras (un parámetro por columna), de modo que no
     hay nada que ganar con una descomposición más fina. */
  function resuelveInversa(A0, b0) {
    const n = A0.length;
    const A = A0.map(f => f.slice());
    const I = [];
    for (let i = 0; i < n; i++) { I.push(new Array(n).fill(0)); I[i][i] = 1; }
    const b = b0 ? b0.slice() : null;
    for (let c = 0; c < n; c++) {
      let piv = c, mejor = Math.abs(A[c][c]);
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > mejor) { mejor = Math.abs(A[r][c]); piv = r; }
      if (!(mejor > 0) || !isFinite(mejor)) return null;
      if (piv !== c) {
        const t = A[piv]; A[piv] = A[c]; A[c] = t;
        const u = I[piv]; I[piv] = I[c]; I[c] = u;
        if (b) { const v = b[piv]; b[piv] = b[c]; b[c] = v; }
      }
      const d = A[c][c];
      for (let j = 0; j < n; j++) { A[c][j] /= d; I[c][j] /= d; }
      if (b) b[c] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r][c];
        if (f === 0) continue;
        for (let j = 0; j < n; j++) { A[r][j] -= f * A[c][j]; I[r][j] -= f * I[c][j]; }
        if (b) b[r] -= f * b[c];
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!isFinite(I[i][j])) return null;
    return { x: b, inv: I };
  }

  /* ---- χ² acumulada: la probabilidad de que un ajuste correcto diera un χ²
     tan malo como éste o peor. Es la Q(ν/2, χ²/2) de la gamma incompleta, en
     la forma clásica: serie por debajo del pico y fracción continua por
     encima, que es donde cada una converge. Sin ella el panel sólo puede decir
     «χ²/ν = 1.8» y dejar al lector adivinar si eso es mucho para 7 puntos. */
  function lnGamma(z) {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
               -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = z, y = z, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += g[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function gammaQ(a, x) {
    if (!(a > 0) || x < 0 || !isFinite(x)) return NaN;
    if (x === 0) return 1;
    if (x < a + 1) {
      let ap = a, suma = 1 / a, del = suma;
      for (let n = 0; n < 500; n++) {
        ap++; del *= x / ap; suma += del;
        if (Math.abs(del) < Math.abs(suma) * 1e-14) break;
      }
      return 1 - suma * Math.exp(-x + a * Math.log(x) - lnGamma(a));
    }
    const MIN = 1e-300;
    let b = x + 1 - a, c = 1 / MIN, d = 1 / b, h = d;
    for (let i = 1; i <= 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < MIN) d = MIN;
      c = b + an / c; if (Math.abs(c) < MIN) c = MIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
  }
  const pDeChi2 = (chi2, nu) => (nu > 0 && isFinite(chi2)) ? gammaQ(nu / 2, chi2 / 2) : NaN;

  // ============================================================
  //  3. Expresiones
  // ============================================================
  /* Un compilador de expresiones diminuto, que es lo que sostiene dos cosas a
     la vez: el modelo libre («a*exp(-x/tau)+c») y las magnitudes derivadas
     («R = 1/a»). Compila a un árbol de funciones en vez de evaluar texto: eval
     sobre lo que escribe el usuario metería su navegador en el ajuste, y
     además esto se llama del orden de cien mil veces por ajuste, una por punto
     y derivada. Las variables se resuelven a un índice en tiempo de
     compilación; en tiempo de ejecución sólo hay lecturas de un array. */
  const FUNS = {
    sin: [1, Math.sin], cos: [1, Math.cos], tan: [1, Math.tan],
    asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan],
    sinh: [1, Math.sinh], cosh: [1, Math.cosh], tanh: [1, Math.tanh],
    exp: [1, Math.exp], ln: [1, Math.log], log: [1, Math.log], log10: [1, Math.log10],
    log2: [1, Math.log2], sqrt: [1, Math.sqrt], abs: [1, Math.abs], sign: [1, Math.sign],
    floor: [1, Math.floor], round: [1, Math.round], cbrt: [1, Math.cbrt],
    atan2: [2, Math.atan2], pow: [2, Math.pow],
    min: [2, Math.min], max: [2, Math.max], mod: [2, (a, b) => a % b]
  };
  const CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E, tau: null };

  function tokeniza(txt) {
    const t = [];
    const re = /\s*([A-Za-zµ_][A-Za-z0-9_]*|\d*\.?\d+(?:[eE][+-]?\d+)?|\*\*|[-+*\/^(),])/g;
    let pos = 0, m;
    while ((m = re.exec(txt)) !== null) {
      if (m.index !== pos) throw new Error("no entiendo «" + txt.slice(pos, m.index).trim() + "»");
      pos = re.lastIndex;
      t.push(m[1] === "**" ? "^" : m[1]);
    }
    if (txt.slice(pos).trim() !== "") throw new Error("no entiendo «" + txt.slice(pos).trim() + "»");
    return t;
  }
  /* `libres` limita qué identificadores pueden ser variables: para una
     magnitud derivada son los parámetros ajustados, y escribir uno que no
     existe tiene que ser un error con nombre, no una variable nueva que
     evalúa a NaN sin decir por qué. Con `libres` a null vale cualquiera —
     ése es el caso del modelo libre, donde los parámetros se descubren
     precisamente al leer la fórmula. */
  function compila(texto, libres) {
    const t = tokeniza(String(texto));
    if (!t.length) throw new Error("la fórmula está vacía");
    let i = 0;
    const vars = [];
    const indice = (n) => {
      let k = vars.indexOf(n);
      if (k < 0) { vars.push(n); k = vars.length - 1; }
      return k;
    };
    const mira = () => t[i];
    const come = (s) => { if (t[i] !== s) throw new Error("falta «" + s + "»"); i++; };

    /* `izq` no es un adorno: el cierre captura la VARIABLE, no su valor, así
       que reasignar `a` con una función que llama a `a` la deja llamándose a
       sí misma. «a*b*c» reventaba con la pila desbordada en cuanto había dos
       operadores del mismo nivel — y con uno solo funcionaba, que es lo que
       hace que este error llegue lejos. */
    function expr() {
      let a = term();
      while (mira() === "+" || mira() === "-") {
        const op = t[i++], b = term(), izq = a;
        a = op === "+" ? ((e) => izq(e) + b(e)) : ((e) => izq(e) - b(e));
      }
      return a;
    }
    function term() {
      let a = unario();
      while (mira() === "*" || mira() === "/") {
        const op = t[i++], b = unario(), izq = a;
        a = op === "*" ? ((e) => izq(e) * b(e)) : ((e) => izq(e) / b(e));
      }
      return a;
    }
    function unario() {
      if (mira() === "-") { i++; const a = unario(); return (e) => -a(e); }
      if (mira() === "+") { i++; return unario(); }
      return potencia();
    }
    function potencia() {
      const a = atomo();
      if (mira() === "^") { i++; const b = unario(); return (e) => Math.pow(a(e), b(e)); }
      return a;
    }
    function atomo() {
      const s = t[i];
      if (s === undefined) throw new Error("la fórmula se corta");
      if (s === "(") { i++; const a = expr(); come(")"); return a; }
      if (/^[\d.]/.test(s)) { i++; const v = parseFloat(s); if (!isFinite(v)) throw new Error("número raro: " + s); return () => v; }
      if (/^[A-Za-zµ_]/.test(s)) {
        i++;
        if (mira() === "(") {
          const fn = FUNS[s];
          if (!fn) throw new Error("no conozco la función " + s + "()");
          i++;
          const args = [expr()];
          while (mira() === ",") { i++; args.push(expr()); }
          come(")");
          if (args.length !== fn[0]) throw new Error(s + "() lleva " + fn[0] + " argumento" + (fn[0] > 1 ? "s" : ""));
          const f = fn[1];
          return fn[0] === 1 ? ((e) => f(args[0](e))) : ((e) => f(args[0](e), args[1](e)));
        }
        if (CONSTS[s] !== undefined && CONSTS[s] !== null && !(libres && libres.indexOf(s) >= 0)) {
          const v = CONSTS[s];
          return () => v;
        }
        if (libres && libres.indexOf(s) < 0) throw new Error("«" + s + "» no es ninguno de los parámetros");
        const k = indice(s);
        return (e) => e[k];
      }
      throw new Error("sobra «" + s + "»");
    }
    const f = expr();
    if (i < t.length) throw new Error("sobra «" + t.slice(i).join(" ") + "»");
    return { f: f, vars: vars };
  }

  // ============================================================
  //  4. Catálogo de modelos
  // ============================================================
  /* Cada modelo dice su ecuación, sus parámetros (con la dimensión de cada uno
     respecto de las columnas, que es lo que deja poner unidades en la tabla) y
     cómo estimar de dónde parte el ajuste. Los que son lineales en los
     parámetros llevan `base`, la lista de funciones que multiplican a cada uno
     — y ésos no necesitan semilla ninguna: se resuelven de una vez. */
  const media = (v) => v.reduce((s, x) => s + x, 0) / (v.length || 1);
  function ajustaRectaCruda(xs, ys) {
    const n = xs.length;
    if (n < 2) return [1, 0];
    const mx = media(xs), my = media(ys);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    const a = sxx > 0 ? sxy / sxx : 0;
    return [a, my - a * mx];
  }
  /* Ancho a media altura, medido sobre los propios puntos: la semilla de la
     gaussiana y de la lorentziana. Devuelve el rango entre cruces con la
     mitad de la altura, o un sexto del rango si no hay tal cruce. */
  function anchoMedio(xs, ys, iPico, base) {
    const alto = ys[iPico] - base;
    if (!(alto !== 0)) return (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 6 || 1;
    const mitad = base + alto / 2;
    const dentro = (v) => alto > 0 ? v >= mitad : v <= mitad;
    let i = iPico, j = iPico;
    while (i > 0 && dentro(ys[i - 1])) i--;
    while (j < ys.length - 1 && dentro(ys[j + 1])) j++;
    const w = Math.abs(xs[j] - xs[i]);
    if (w > 0) return w / 2;
    return (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 6 || 1;
  }
  function picoDe(ys) {
    let k = 0;
    const m = media(ys);
    let mejor = -Infinity;
    for (let i = 0; i < ys.length; i++) if (Math.abs(ys[i] - m) > mejor) { mejor = Math.abs(ys[i] - m); k = i; }
    return k;
  }
  /* Frecuencia de partida de la senoidal, contando cambios de signo de y−media
     sobre el rango de x. Una FFT no sirve aquí: los datos de un laboratorio no
     tienen por qué estar muestreados a paso constante, que es justo lo que la
     FFT da por hecho. */
  function freqPorCruces(xs, ys) {
    const m = media(ys);
    let cruces = 0;
    for (let i = 1; i < ys.length; i++) if ((ys[i - 1] - m) * (ys[i] - m) < 0) cruces++;
    const rango = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    if (!(rango > 0) || cruces < 2) return 1 / (rango || 1);
    return (cruces / 2) / rango;
  }

  const MODELOS = {
    recta: {
      nombre: "Recta", ec: "y = a·x + b",
      ps: [{ n: "a", u: "y/x" }, { n: "b", u: "y" }],
      base: (x) => [x, 1]
    },
    prop: {
      nombre: "Por el origen", ec: "y = a·x",
      ps: [{ n: "a", u: "y/x" }],
      base: (x) => [x]
    },
    poly: {
      nombre: "Polinomio", ec: "y = c0 + c1·x + c2·x² + …",
      grado: true,
      psDe: (g) => { const l = []; for (let k = 0; k <= g; k++) l.push({ n: "c" + k, u: "y/x^" + k }); return l; },
      baseDe: (g) => (x) => { const l = []; let p = 1; for (let k = 0; k <= g; k++) { l.push(p); p *= x; } return l; }
    },
    log: {
      nombre: "Logarítmico", ec: "y = a + b·ln x",
      ps: [{ n: "a", u: "y" }, { n: "b", u: "y" }],
      base: (x) => [1, Math.log(x)],
      valido: (d) => d.x.every(v => v > 0) ? null : "El logarítmico necesita todas las x mayores que cero."
    },
    exp: {
      nombre: "Exponencial", ec: "y = a·e^(b·x)",
      ps: [{ n: "a", u: "y" }, { n: "b", u: "1/x" }],
      f: (x, p) => p[0] * Math.exp(p[1] * x),
      semilla: (d) => {
        const xs = [], ls = [];
        const sgn = media(d.y) < 0 ? -1 : 1;
        for (let i = 0; i < d.x.length; i++) if (sgn * d.y[i] > 0) { xs.push(d.x[i]); ls.push(Math.log(sgn * d.y[i])); }
        if (xs.length < 2) return [media(d.y) || 1, 0];
        const r = ajustaRectaCruda(xs, ls);
        return [sgn * Math.exp(r[1]), r[0]];
      }
    },
    expOff: {
      nombre: "Descarga", ec: "y = a·e^(−x/τ) + c",
      ps: [{ n: "a", u: "y" }, { n: "tau", u: "x" }, { n: "c", u: "y" }],
      f: (x, p) => p[0] * Math.exp(-x / p[1]) + p[2],
      /* La cola es la mejor estimación de c, y sólo con c fuera se puede
         linealizar el resto: ln(y−c) contra x. Arrancar con c = 0 llevaba el
         ajuste de una descarga con offset a un τ absurdo y de ahí no salía. */
      semilla: (d) => {
        const n = d.x.length;
        const orden = d.x.map((v, i) => i).sort((i, j) => d.x[i] - d.x[j]);
        const cola = orden.slice(Math.max(0, n - Math.max(2, Math.round(n * 0.1))));
        let c = media(cola.map(i => d.y[i]));
        const y0 = d.y[orden[0]];
        const sgn = y0 - c < 0 ? -1 : 1;
        const xs = [], ls = [];
        for (const i of orden) {
          const v = sgn * (d.y[i] - c);
          if (v > 0) { xs.push(d.x[i]); ls.push(Math.log(v)); }
        }
        if (xs.length < 2) return [y0 - c || 1, (d.x[orden[n - 1]] - d.x[orden[0]]) / 3 || 1, c];
        const r = ajustaRectaCruda(xs, ls);
        const tau = r[0] < 0 ? -1 / r[0] : (d.x[orden[n - 1]] - d.x[orden[0]]) / 3 || 1;
        return [sgn * Math.exp(r[1]), tau, c];
      }
    },
    pot: {
      nombre: "Potencia", ec: "y = a·x^b",
      ps: [{ n: "a", u: "" }, { n: "b", u: "" }],
      f: (x, p) => p[0] * Math.pow(x, p[1]),
      valido: (d) => d.x.every(v => v > 0) ? null : "La potencia necesita todas las x mayores que cero.",
      semilla: (d) => {
        const xs = [], ls = [];
        const sgn = media(d.y) < 0 ? -1 : 1;
        for (let i = 0; i < d.x.length; i++) if (d.x[i] > 0 && sgn * d.y[i] > 0) { xs.push(Math.log(d.x[i])); ls.push(Math.log(sgn * d.y[i])); }
        if (xs.length < 2) return [1, 1];
        const r = ajustaRectaCruda(xs, ls);
        return [sgn * Math.exp(r[1]), r[0]];
      }
    },
    seno: {
      nombre: "Senoidal", ec: "y = A·sin(2π·f·x + φ) + c",
      ps: [{ n: "A", u: "y" }, { n: "f", u: "1/x" }, { n: "phi", u: "rad" }, { n: "c", u: "y" }],
      f: (x, p) => p[0] * Math.sin(2 * Math.PI * p[1] * x + p[2]) + p[3],
      semilla: (d) => {
        const c = media(d.y);
        const A = (Math.max.apply(null, d.y) - Math.min.apply(null, d.y)) / 2 || 1;
        const f = freqPorCruces(d.x, d.y);
        /* La fase no se estima: se prueban ocho y se parte de la que menos
           error deja. Levenberg-Marquardt no salta de un mínimo local al de al
           lado, y en una senoidal los mínimos locales están cada media vuelta
           — con φ = 0 fijo, media de los ajustes salía en oposición de fase. */
        let mejor = 0, mejorE = Infinity;
        for (let k = 0; k < 8; k++) {
          const phi = k * Math.PI / 4;
          let e = 0;
          for (let i = 0; i < d.x.length; i++) {
            const r = d.y[i] - (A * Math.sin(2 * Math.PI * f * d.x[i] + phi) + c);
            e += r * r;
          }
          if (e < mejorE) { mejorE = e; mejor = phi; }
        }
        return [A, f, mejor, c];
      }
    },
    gauss: {
      nombre: "Gaussiana", ec: "y = A·e^(−(x−x0)²/2s²) + c",
      ps: [{ n: "A", u: "y" }, { n: "x0", u: "x" }, { n: "s", u: "x" }, { n: "c", u: "y" }],
      f: (x, p) => p[0] * Math.exp(-((x - p[1]) * (x - p[1])) / (2 * p[2] * p[2])) + p[3],
      semilla: (d) => {
        const i = picoDe(d.y);
        const c = media(d.y) < d.y[i] ? Math.min.apply(null, d.y) : Math.max.apply(null, d.y);
        return [d.y[i] - c, d.x[i], anchoMedio(d.x, d.y, i, c) / 1.1774 || 1, c];
      }
    },
    lorentz: {
      nombre: "Lorentziana", ec: "y = A/(1+((x−x0)/γ)²) + c",
      ps: [{ n: "A", u: "y" }, { n: "x0", u: "x" }, { n: "g", u: "x" }, { n: "c", u: "y" }],
      f: (x, p) => { const u = (x - p[1]) / p[2]; return p[0] / (1 + u * u) + p[3]; },
      semilla: (d) => {
        const i = picoDe(d.y);
        const c = media(d.y) < d.y[i] ? Math.min.apply(null, d.y) : Math.max.apply(null, d.y);
        return [d.y[i] - c, d.x[i], anchoMedio(d.x, d.y, i, c) || 1, c];
      }
    },
    sat: {
      nombre: "Saturación", ec: "y = a·x/(b + x)",
      ps: [{ n: "a", u: "y" }, { n: "b", u: "x" }],
      f: (x, p) => p[0] * x / (p[1] + x),
      semilla: (d) => {
        const a = Math.max.apply(null, d.y.map(Math.abs)) * 1.15 * (media(d.y) < 0 ? -1 : 1);
        let b = 0, mejor = Infinity;
        for (let i = 0; i < d.x.length; i++) {
          const dif = Math.abs(d.y[i] - a / 2);
          if (dif < mejor) { mejor = dif; b = d.x[i]; }
        }
        return [a, b || media(d.x) || 1];
      }
    },
    libre: {
      nombre: "Fórmula libre", ec: "",
      libre: true
    }
  };

  /* El modelo listo para usar: parámetros, f(x,p) y base, ya resueltos el
     grado del polinomio y la fórmula libre. Devuelve `error` con el mensaje en
     vez de lanzar, porque quien lo llama es el teclado del usuario a media
     fórmula y eso no es una excepción, es el estado normal mientras se
     escribe. */
  function resuelveModelo(id, grado, formula) {
    const m = MODELOS[id];
    if (!m) return { error: "modelo desconocido" };
    if (m.libre) {
      const txt = String(formula || "").trim();
      if (!txt) return { error: "Escribe una fórmula en función de x." };
      let c;
      try { c = compila(txt, null); } catch (e) { return { error: e.message }; }
      const ps = c.vars.filter(v => v !== "x").map(n => ({ n: n, u: "" }));
      if (!ps.length) return { error: "La fórmula no tiene ningún parámetro que ajustar." };
      const ix = c.vars.indexOf("x");
      if (ix < 0) return { error: "La fórmula no depende de x." };
      /* El entorno se reordena una sola vez: el árbol lee por índice y aquí se
         sabe qué índice es cada parámetro y cuál es la x. */
      const mapa = ps.map(p => c.vars.indexOf(p.n));
      const env = new Array(c.vars.length).fill(0);
      const f = (x, p) => {
        env[ix] = x;
        for (let k = 0; k < mapa.length; k++) env[mapa[k]] = p[k];
        return c.f(env);
      };
      return { id: id, nombre: "Fórmula libre", ec: "y = " + txt, ps: ps, f: f };
    }
    if (m.grado) {
      const g = clamp(Math.round(grado || 2), 1, 12);
      const ps = m.psDe(g), base = m.baseDe(g);
      return { id: id, nombre: m.nombre + " de grado " + g, ec: ecPoly(g), ps: ps, base: base, f: fDeBase(base), valido: m.valido };
    }
    return {
      id: id, nombre: m.nombre, ec: m.ec, ps: m.ps, base: m.base,
      f: m.f || fDeBase(m.base), semilla: m.semilla, valido: m.valido
    };
  }
  const fDeBase = (base) => (x, p) => {
    const b = base(x);
    let s = 0;
    for (let k = 0; k < p.length; k++) s += p[k] * b[k];
    return s;
  };
  function ecPoly(g) {
    let s = "y = c0";
    for (let k = 1; k <= g; k++) s += " + c" + k + "·x" + (k === 1 ? "" : supIndice(k));
    return s;
  }

  // ============================================================
  //  5. El ajuste
  // ============================================================
  const PASO_D = 1e-6;   // paso relativo de las derivadas numéricas
  /* Derivada de f respecto del parámetro k, por diferencias centradas. El paso
     es relativo al propio parámetro con un suelo absoluto: relativo a secas se
     queda en cero cuando el parámetro vale cero (φ = 0 al arrancar la
     senoidal, y la columna entera del jacobiano salía nula). */
  function dfdp(f, x, p, k, h) {
    const orig = p[k];
    const paso = h || Math.max(Math.abs(orig) * PASO_D, 1e-10);
    p[k] = orig + paso; const a = f(x, p);
    p[k] = orig - paso; const b = f(x, p);
    p[k] = orig;
    return (a - b) / (2 * paso);
  }
  function dfdx(f, x, p) {
    const paso = Math.max(Math.abs(x) * PASO_D, 1e-10);
    return (f(x + paso, p) - f(x - paso, p)) / (2 * paso);
  }

  /* Los pesos, y aquí está una de las decisiones que más se notan: cuando hay
     σx, la incertidumbre de la x se traslada a la y por la pendiente del
     propio modelo — σ² = σy² + (f'(x)·σx)², la «varianza efectiva». Es una
     aproximación (supone el modelo recto dentro de σx), pero es la que
     convierte «tengo error en las dos» en un ajuste que se puede hacer, en vez
     de en un problema de mínimos ortogonales que nadie va a montar en un
     laboratorio. Como depende de los parámetros, se recalcula en cada
     iteración. */
  function pesosDe(D, f, p) {
    const n = D.x.length, w = new Array(n);
    for (let i = 0; i < n; i++) {
      let v2 = D.sy ? D.sy[i] * D.sy[i] : 1;
      if (D.sx && D.sx[i]) {
        const d = dfdx(f, D.x[i], p);
        v2 += d * d * D.sx[i] * D.sx[i];
      }
      w[i] = v2 > 0 ? 1 / v2 : 0;
    }
    return w;
  }
  function chi2De(D, f, p, w) {
    let s = 0;
    for (let i = 0; i < D.x.length; i++) {
      const r = D.y[i] - f(D.x[i], p);
      if (!isFinite(r)) return Infinity;
      s += w[i] * r * r;
    }
    return isFinite(s) ? s : Infinity;
  }

  /* Ajuste exacto para los modelos lineales en los parámetros: ecuaciones
     normales y a correr. No es sólo velocidad — no hay semilla que acertar, no
     hay mínimo local en el que caerse y la covarianza es la de verdad, no la
     del último paso de una iteración. Los parámetros fijos se pasan al otro
     lado de la igualdad, que es lo que permite ajustar «la recta con esta
     pendiente» sin cambiar de camino. */
  function ajustaLineal(D, mod, p, fijos) {
    const ps = mod.ps, np = ps.length;
    const libres = [];
    for (let k = 0; k < np; k++) if (!fijos[k]) libres.push(k);
    if (!libres.length) return { error: "No queda ningún parámetro libre que ajustar." };
    const n = D.x.length;
    const w = pesosDe(D, mod.f, p);
    const M = libres.length;
    const A = [], b = new Array(M).fill(0);
    for (let i = 0; i < M; i++) A.push(new Array(M).fill(0));
    for (let i = 0; i < n; i++) {
      const B = mod.base(D.x[i]);
      if (!B.every(isFinite)) return { error: "El modelo no está definido en alguno de los puntos." };
      let yi = D.y[i];
      for (let k = 0; k < np; k++) if (fijos[k]) yi -= p[k] * B[k];
      for (let a = 0; a < M; a++) {
        b[a] += w[i] * B[libres[a]] * yi;
        for (let c = 0; c < M; c++) A[a][c] += w[i] * B[libres[a]] * B[libres[c]];
      }
    }
    const sol = resuelveInversa(A, b);
    if (!sol) return { error: "El sistema no se puede resolver: sobran parámetros para los puntos que hay." };
    const q = p.slice();
    for (let a = 0; a < M; a++) q[libres[a]] = sol.x[a];
    return { p: q, C: sol.inv, libres: libres, iter: 1 };
  }

  /* Levenberg-Marquardt con jacobiano numérico. λ arranca pequeño (casi
     Gauss-Newton, que converge deprisa cerca de la solución) y sube en cuanto
     un paso empeora, con lo que degenera en descenso por gradiente mientras
     esté lejos. El jacobiano sólo lleva columnas de los parámetros libres: un
     parámetro fijo con columna de ceros haría singular la matriz normal. */
  function ajustaLM(D, mod, p0, fijos) {
    const np = mod.ps.length;
    const libres = [];
    for (let k = 0; k < np; k++) if (!fijos[k]) libres.push(k);
    if (!libres.length) return { error: "No queda ningún parámetro libre que ajustar." };
    const M = libres.length, n = D.x.length;
    let p = p0.slice();
    let w = pesosDe(D, mod.f, p);
    let chi = chi2De(D, mod.f, p, w);
    if (!isFinite(chi)) return { error: "Con esos valores de partida el modelo no da un número. Prueba a estimarlos otra vez." };
    let lam = 1e-3, iter = 0, quietas = 0;
    const A = [], g = new Array(M).fill(0);
    for (let i = 0; i < M; i++) A.push(new Array(M).fill(0));
    while (iter < 300) {
      iter++;
      for (let a = 0; a < M; a++) { g[a] = 0; for (let c = 0; c < M; c++) A[a][c] = 0; }
      const J = new Array(M);
      for (let a = 0; a < M; a++) {
        J[a] = new Array(n);
        for (let i = 0; i < n; i++) J[a][i] = dfdp(mod.f, D.x[i], p, libres[a]);
      }
      for (let i = 0; i < n; i++) {
        const r = D.y[i] - mod.f(D.x[i], p);
        if (!isFinite(r)) return { error: "El modelo no está definido en alguno de los puntos." };
        for (let a = 0; a < M; a++) {
          if (!isFinite(J[a][i])) return { error: "La derivada del modelo se va a infinito en algún punto." };
          g[a] += w[i] * J[a][i] * r;
          for (let c = a; c < M; c++) A[a][c] += w[i] * J[a][i] * J[c][i];
        }
      }
      for (let a = 0; a < M; a++) for (let c = 0; c < a; c++) A[a][c] = A[c][a];
      let mejorado = false;
      for (let intento = 0; intento < 40; intento++) {
        const Ad = A.map((f, a) => f.map((v, c) => a === c ? v * (1 + lam) + (v === 0 ? lam : 0) : v));
        const sol = resuelveInversa(Ad, g);
        if (!sol) { lam *= 8; continue; }
        const q = p.slice();
        for (let a = 0; a < M; a++) q[libres[a]] += sol.x[a];
        const w2 = pesosDe(D, mod.f, q);
        const c2 = chi2De(D, mod.f, q, w2);
        if (isFinite(c2) && c2 <= chi) {
          const mejora = chi - c2;
          p = q; w = w2;
          const rel = chi > 0 ? mejora / chi : 0;
          chi = c2;
          lam = Math.max(lam / 3, 1e-12);
          mejorado = true;
          quietas = rel < 1e-12 ? quietas + 1 : 0;
          break;
        }
        lam *= 8;
        if (lam > 1e14) break;
      }
      if (!mejorado || quietas >= 2) break;
    }
    /* La covarianza sale de la matriz normal SIN λ: con λ dentro estaría
       sesgada hacia abajo por el propio amortiguamiento, y las σ saldrían
       optimistas justo en los ajustes que más han costado. */
    for (let a = 0; a < M; a++) { for (let c = 0; c < M; c++) A[a][c] = 0; }
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < M; a++) {
        const Ja = dfdp(mod.f, D.x[i], p, libres[a]);
        for (let c = a; c < M; c++) A[a][c] += w[i] * Ja * dfdp(mod.f, D.x[i], p, libres[c]);
      }
    }
    for (let a = 0; a < M; a++) for (let c = 0; c < a; c++) A[a][c] = A[c][a];
    const inv = resuelveInversa(A, null);
    return { p: p, C: inv ? inv.inv : null, libres: libres, iter: iter };
  }

  /* El ajuste completo, con los estadísticos que hacen falta para decidir si
     el modelo vale. Dos convenios que conviene tener claros:

     — Con σ medidas, las incertidumbres de los parámetros son las que salen de
       la covarianza tal cual, y χ²/ν es una medida independiente de si el
       modelo describe los datos. Es el caso honrado.
     — Sin σ, no hay escala: se ajusta con pesos iguales y la covarianza se
       multiplica por s² = χ²/ν, es decir, se supone que el modelo es bueno y
       se le atribuye a la dispersión toda la culpa. Entonces χ²/ν vale 1 por
       construcción y no dice absolutamente nada, así que el panel lo tacha en
       vez de presentarlo como si fuera una nota del examen. */
  function ajusta(D, mod, p0, fijos) {
    const n = D.x.length;
    if (!mod || mod.error) return { error: mod ? mod.error : "sin modelo" };
    if (mod.valido) {
      const mal = mod.valido(D);
      if (mal) return { error: mal };
    }
    const np = mod.ps.length;
    fijos = fijos || new Array(np).fill(false);
    const nLibres = fijos.filter(f => !f).length;
    if (n < 1) return { error: "No hay puntos que ajustar." };
    if (n < nLibres) return { error: "Hacen falta al menos " + nLibres + " puntos para " + nLibres + " parámetros; hay " + n + "." };
    const lineal = !!mod.base && !D.sx;
    const r = lineal ? ajustaLineal(D, mod, p0, fijos) : ajustaLM(D, mod, p0, fijos);
    if (r.error) return { error: r.error };

    const p = r.p;
    const w = pesosDe(D, mod.f, p);
    const chi2 = chi2De(D, mod.f, p, w);
    const nu = n - nLibres;
    const conSigma = !!D.sy;
    /* s² = χ²/ν con pesos unidad es la varianza residual: la desviación típica
       de lo que el modelo no explica. Es lo que se usa para escalar cuando no
       hay σ. */
    const escala = conSigma ? 1 : (nu > 0 ? chi2 / nu : NaN);
    const C = [];
    const sp = new Array(np).fill(NaN);
    if (r.C) {
      for (let a = 0; a < r.libres.length; a++) {
        C.push(r.C[a].map(v => v * (isFinite(escala) ? escala : 1)));
      }
      for (let a = 0; a < r.libres.length; a++) {
        const v = C[a][a];
        sp[r.libres[a]] = v >= 0 ? Math.sqrt(v) : NaN;
      }
    }
    let ss = 0, st = 0;
    const my = media(D.y);
    const fit = new Array(n), res = new Array(n);
    for (let i = 0; i < n; i++) {
      fit[i] = mod.f(D.x[i], p);
      res[i] = D.y[i] - fit[i];
      ss += res[i] * res[i];
      st += (D.y[i] - my) * (D.y[i] - my);
    }
    return {
      p: p, sp: sp, C: C, libres: r.libres, iter: r.iter,
      chi2: chi2, nu: nu, chi2r: nu > 0 ? chi2 / nu : NaN,
      pValor: conSigma ? pDeChi2(chi2, nu) : NaN,
      R2: st > 0 ? 1 - ss / st : NaN,
      sResidual: nu > 0 ? Math.sqrt(ss / nu) : NaN,
      conSigma: conSigma, escalado: !conSigma,
      fit: fit, res: res, w: w, mod: mod, n: n
    };
  }

  // ============================================================
  //  6. Propagación de incertidumbre
  // ============================================================
  /* σ² = gᵀ C g, con la covarianza ENTERA. Es el motivo de que esta sección
     exista: sumar en cuadratura las σ de cada parámetro por separado da un
     resultado que puede estar equivocado por un factor grande cuando los
     parámetros están correlacionados, y en un ajuste casi siempre lo están —
     en una recta, pendiente y ordenada llegan a −0.98 sin ninguna dificultad.
     `g` va indexado como `libres`: un parámetro fijo no tiene incertidumbre y
     por tanto no participa. */
  function sigmaPropagada(g, C) {
    if (!C || !C.length) return NaN;
    let v = 0;
    for (let a = 0; a < C.length; a++) for (let b = 0; b < C.length; b++) v += g[a] * C[a][b] * g[b];
    return v >= 0 ? Math.sqrt(v) : NaN;
  }
  /* Gradiente de f(x,·) respecto de los parámetros libres — la banda de
     confianza del ajuste punto a punto. */
  function gradEnX(mod, x, p, libres) {
    const g = new Array(libres.length);
    for (let a = 0; a < libres.length; a++) g[a] = dfdp(mod.f, x, p, libres[a]);
    return g;
  }
  function sigmaCurva(mod, x, aj) {
    if (!aj.C || !aj.C.length) return NaN;
    return sigmaPropagada(gradEnX(mod, x, aj.p, aj.libres), aj.C);
  }
  /* Una magnitud derivada: «R = 1/a». El valor se evalúa y su σ se propaga con
     el gradiente numérico respecto de los parámetros libres. */
  function evaluaDerivada(texto, aj) {
    const m = /^\s*([A-Za-zµ_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(String(texto));
    const nombre = m ? m[1] : "";
    const expr = m ? m[2] : String(texto);
    if (!expr.trim()) return { error: "escribe una expresión" };
    const nombres = aj.mod.ps.map(p => p.n);
    let c;
    try { c = compila(expr, nombres); } catch (e) { return { error: e.message }; }
    const idx = c.vars.map(v => nombres.indexOf(v));
    const ev = (ps) => {
      const e = new Array(c.vars.length);
      for (let k = 0; k < idx.length; k++) e[k] = ps[idx[k]];
      return c.f(e);
    };
    const v = ev(aj.p);
    if (!isFinite(v)) return { nombre: nombre, expr: expr, v: NaN, s: NaN, error: "no sale un número" };
    const g = aj.libres.map(k => {
      const p = aj.p.slice();
      const h = Math.max(Math.abs(p[k]) * 1e-6, 1e-10);
      p[k] = aj.p[k] + h; const a = ev(p);
      p[k] = aj.p[k] - h; const b = ev(p);
      return (a - b) / (2 * h);
    });
    return { nombre: nombre, expr: expr, v: v, s: sigmaPropagada(g, aj.C) };
  }

  // ============================================================
  //  7. Leer una tabla de números
  // ============================================================
  /* El mismo criterio que CSV·Scope: se busca primero dónde empiezan los
     NÚMEROS y la cabecera es la línea legible que haya justo encima. Leer la
     línea 1 como cabecera convierte el preámbulo de un Tektronix en una
     columna llamada «Model» llena de ceros. Aquí, además, el separador puede
     ser el espacio en blanco: estos datos se teclean a mano tanto como se
     exportan. */
  const SEPS = [
    { d: ",", dec: "." }, { d: ";", dec: "." }, { d: ";", dec: "," },
    { d: "\t", dec: "." }, { d: "\t", dec: "," }, { d: " ", dec: "." }
  ];
  const MAX_FILAS = 50000;
  function parte(linea, sep) {
    return sep === " " ? linea.trim().split(/\s+/) : linea.split(sep);
  }
  function esNum(f, dec) {
    if (f === "") return false;
    const v = +(dec === "," ? f.replace(",", ".") : f);
    return v === v && isFinite(v);
  }
  function aNum(f, dec) { return +(dec === "," ? String(f).replace(",", ".") : f); }
  function esFila(campos, dec) {
    if (!campos.length) return false;
    let n = 0;
    for (const f of campos) {
      const t = f.trim();
      if (t === "") continue;
      if (!esNum(t, dec)) return false;
      n++;
    }
    return n >= 1;
  }
  function parseTabla(texto) {
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    const lineas = texto.split(/\r?\n/);
    let mejor = null;
    for (const cfg of SEPS) {
      /* Dos filas seguidas con el mismo número de campos: un «Record
         Length,250000» suelto en un preámbulo no puede hacerse pasar por los
         datos, y una línea de guiones tampoco. */
      for (let i = 0; i < lineas.length - 1 && i < 400; i++) {
        if (!lineas[i].trim()) continue;
        const a = parte(lineas[i], cfg.d);
        if (!esFila(a, cfg.dec)) continue;
        let j = i + 1;
        while (j < lineas.length && !lineas[j].trim()) j++;
        if (j >= lineas.length) break;
        const b = parte(lineas[j], cfg.d);
        if (!esFila(b, cfg.dec) || a.length !== b.length) continue;
        if (!mejor || a.length > mejor.nc) mejor = { cfg: cfg, i0: i, nc: a.length };
        break;
      }
    }
    if (!mejor) return { error: "No encuentro ninguna columna de números." };
    const { cfg, i0, nc } = mejor;
    /* La cabecera es la línea legible que hay justo encima de los números, y
       con el espacio como separador hay que partirla de otra manera: «L (m)
       T (s)  sigma» da cinco campos partiendo por espacios sueltos y tres
       partiendo por los huecos anchos, que son los que de verdad separan
       columnas. Sin esto, cualquier cabecera con unidades entre paréntesis se
       descartaba entera y las columnas salían llamadas col1, col2, col3. */
    let iCab = -1, crudos = [];
    for (let i = i0 - 1; i >= 0; i--) {
      const l = lineas[i];
      if (!l.trim()) continue;
      let f = parte(l, cfg.d);
      if (cfg.d === " " && f.length !== nc) {
        const anchos = l.trim().split(/\s{2,}|\t/);
        if (anchos.length === nc) f = anchos;
      }
      if (f.length === nc && !esFila(f, cfg.dec)) { iCab = i; crudos = f; }
      break;
    }
    const cols = [];
    for (let c = 0; c < nc; c++) {
      let nombre = (crudos[c] || "").trim().replace(/^["']|["']$/g, ""), unidad = "";
      const m = nombre.match(/^(.*?)[\s]*[([]([^)\]]*)[)\]]\s*$/);   // «V (mV)», «T[s]»
      if (m) { nombre = m[1].trim(); unidad = m[2].trim(); }
      if (!nombre) nombre = "col" + (c + 1);
      cols.push({ nombre: nombre, unidad: unidad, v: [] });
    }
    let saltadas = 0;
    for (let i = i0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.trim()) continue;
      const f = parte(l, cfg.d);
      if (f.length !== nc || !esFila(f, cfg.dec)) { saltadas++; continue; }
      for (let c = 0; c < nc; c++) {
        const t = f[c].trim();
        cols[c].v.push(t === "" ? NaN : aNum(t, cfg.dec));
      }
      if (cols[0].v.length >= MAX_FILAS) { saltadas += lineas.length - i - 1; break; }
    }
    if (!cols[0].v.length) return { error: "No encuentro ninguna columna de números." };
    return { cols: cols, n: cols[0].v.length, saltadas: saltadas, sep: cfg };
  }

  // ============================================================
  //  8. Dibujo: una superficie, tres destinos
  // ============================================================
  /* La gráfica se dibuja UNA vez, contra una superficie mínima, y se pinta en
     tres sitios: el lienzo de la pantalla, el PNG a 300 ppp y el SVG en
     milímetros. Escribirla tres veces era garantizar que las tres se
     separasen; y capturar la pantalla como figura del artículo es peor todavía
     — un instrumento negro con rejilla de fósforo no es una figura de un
     informe. Por eso el destino no cambia el dibujo, sólo la paleta (PANTALLA
     o PAPEL) y la unidad tipográfica `u`: en el lienzo 1 unidad es 1 píxel; en
     el SVG, 0.32 mm, que deja el texto base en unos 8 pt sobre el papel. */
  const PAL_PANTALLA = {
    fondo: "#05090c", grid1: "#1e323f", grid2: "#3a5a6d", marco: "#3a5a6d",
    texto: "#dfe8f2", dim: "#7d8fa3", punto: "#2ea8ff", fuera: "#54646f",
    curva: "#3ddc7f", banda: "rgba(61,220,127,.20)", cero: "#7d8fa3", mal: "#ff6b6b"
  };
  const PAL_PAPEL = {
    fondo: "#ffffff", grid1: "#ededed", grid2: "#cfcfcf", marco: "#333333",
    texto: "#111111", dim: "#444444", punto: "#1b4f9c", fuera: "#bbbbbb",
    curva: "#c0392b", banda: "rgba(192,57,43,.16)", cero: "#666666", mal: "#c0392b"
  };

  let medidor = null;
  function fuenteCSS(o) {
    return (o.peso || 400) + " " + (o.size || 10) + "px " +
      (o.mono ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif");
  }
  /* El SVG también mide con un lienzo: calcular el ancho de un texto a ojo
     (0.6 em por letra) descoloca la leyenda y las etiquetas del eje justo en
     la salida que va a un artículo. Se mide a 100 px y se divide, porque medir
     a 3 mm devuelve un número redondeado a lo bruto. */
  function anchoTexto(s, o) {
    if (!medidor) medidor = document.createElement("canvas").getContext("2d");
    const esc = 100 / (o.size || 10);
    medidor.font = fuenteCSS({ size: 100, peso: o.peso, mono: o.mono });
    return medidor.measureText(String(s)).width / esc;
  }

  /* `nitido` sólo lo pide la pantalla: una línea de un píxel centrada en una
     coordenada entera se reparte entre dos columnas de píxeles y la rejilla
     sale gris y borrosa, así que las verticales y horizontales se llevan al
     medio píxel. En el PNG de la figura NO se hace, porque allí una unidad es
     un milímetro y ese «medio» sería medio milímetro de desplazamiento. */
  function supCanvas(g, nitido) {
    const est = (o) => {
      g.lineWidth = o.lw || 1;
      g.setLineDash(o.dash || []);
      g.globalAlpha = o.op === undefined ? 1 : o.op;
    };
    const sn = (v) => nitido ? Math.round(v) + 0.5 : v;
    return {
      svg: false,
      rect(x, y, w, h, o) {
        o = o || {}; est(o);
        if (o.fill) { g.fillStyle = o.fill; g.fillRect(x, y, w, h); }
        if (o.stroke) { g.strokeStyle = o.stroke; g.strokeRect(sn(x), sn(y), w, h); }
        g.globalAlpha = 1; g.setLineDash([]);
      },
      linea(pts, o) {
        o = o || {}; est(o);
        if (pts.length < 2) { g.globalAlpha = 1; g.setLineDash([]); return; }
        g.strokeStyle = o.stroke || "#000";
        let P = pts;
        if (nitido && pts.length === 2) {
          if (pts[0][0] === pts[1][0]) P = [[sn(pts[0][0]), pts[0][1]], [sn(pts[1][0]), pts[1][1]]];
          else if (pts[0][1] === pts[1][1]) P = [[pts[0][0], sn(pts[0][1])], [pts[1][0], sn(pts[1][1])]];
        }
        g.beginPath();
        g.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]);
        g.stroke();
        g.globalAlpha = 1; g.setLineDash([]);
      },
      poly(pts, o) {
        o = o || {}; est(o);
        if (pts.length < 3) { g.globalAlpha = 1; g.setLineDash([]); return; }
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        if (o.fill) { g.fillStyle = o.fill; g.fill(); }
        if (o.stroke) { g.strokeStyle = o.stroke; g.stroke(); }
        g.globalAlpha = 1; g.setLineDash([]);
      },
      circ(x, y, r, o) {
        o = o || {}; est(o);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        if (o.fill) { g.fillStyle = o.fill; g.fill(); }
        if (o.stroke) { g.strokeStyle = o.stroke; g.stroke(); }
        g.globalAlpha = 1; g.setLineDash([]);
      },
      texto(x, y, s, o) {
        o = o || {};
        g.font = fuenteCSS(o);
        g.fillStyle = o.fill || "#000";
        g.textAlign = o.align || "left";
        g.textBaseline = o.base || "alphabetic";
        g.globalAlpha = o.op === undefined ? 1 : o.op;
        if (o.rot) {
          g.save();
          g.translate(x, y);
          g.rotate(o.rot * Math.PI / 180);
          g.fillText(String(s), 0, 0);
          g.restore();
        } else {
          g.fillText(String(s), x, y);
        }
        g.globalAlpha = 1;
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
      },
      ancho: anchoTexto,
      clipIn(x, y, w, h) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); },
      clipOut() { g.restore(); }
    };
  }

  /* La superficie SVG. Escribe en milímetros porque ColabDraw trabaja en
     milímetros: con width="160mm" y viewBox="0 0 160 …", svgGeometry le da
     escala 1 y la figura entra en el dibujo del tamaño que dice el papel, sin
     reescalar nada. Las capas van como <g data-layer="…">, que es lo que su
     lector de capas reconoce. */
  const esc4 = (v) => Math.round(v * 1e4) / 1e4;
  const escXML = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /* El contador de recortes es del módulo y no de cada superficie: la figura
     lleva dos capas, cada una con su superficie, y dos «recorte1» en el mismo
     documento harían que la segunda capa se recortara por la ventana de la
     primera. */
  let nClipGlobal = 0;
  function supSVG() {
    const out = [];
    const defs = [];
    const attrs = (o) => {
      let a = "";
      if (o.fill) a += ' fill="' + o.fill + '"'; else a += ' fill="none"';
      if (o.stroke) a += ' stroke="' + o.stroke + '" stroke-width="' + esc4(o.lw || 0.2) + '"';
      if (o.dash && o.dash.length) a += ' stroke-dasharray="' + o.dash.map(esc4).join(" ") + '"';
      if (o.op !== undefined && o.op !== 1) a += ' opacity="' + esc4(o.op) + '"';
      return a;
    };
    const pth = (pts, cerrar) => "M" + pts.map(p => esc4(p[0]) + "," + esc4(p[1])).join("L") + (cerrar ? "Z" : "");
    return {
      svg: true,
      rect(x, y, w, h, o) {
        o = o || {};
        out.push('<rect x="' + esc4(x) + '" y="' + esc4(y) + '" width="' + esc4(w) + '" height="' + esc4(h) + '"' + attrs(o) + "/>");
      },
      linea(pts, o) {
        if (pts.length < 2) return;
        out.push('<path d="' + pth(pts, false) + '"' + attrs(o || {}) + ' stroke-linejoin="round" stroke-linecap="round"/>');
      },
      poly(pts, o) {
        if (pts.length < 3) return;
        out.push('<path d="' + pth(pts, true) + '"' + attrs(o || {}) + "/>");
      },
      circ(x, y, r, o) {
        out.push('<circle cx="' + esc4(x) + '" cy="' + esc4(y) + '" r="' + esc4(r) + '"' + attrs(o || {}) + "/>");
      },
      texto(x, y, s, o) {
        o = o || {};
        const anc = { left: "start", center: "middle", right: "end" }[o.align || "left"];
        const base = { top: "hanging", middle: "central", alphabetic: "alphabetic" }[o.base || "alphabetic"];
        let a = ' x="' + esc4(x) + '" y="' + esc4(y) + '"';
        a += ' font-family="' + (o.mono ? "monospace" : "sans-serif") + '"';
        a += ' font-size="' + esc4(o.size || 10) + '"';
        if (o.peso && o.peso >= 600) a += ' font-weight="bold"';
        a += ' fill="' + (o.fill || "#000") + '"';
        if (anc !== "start") a += ' text-anchor="' + anc + '"';
        if (base !== "alphabetic") a += ' dominant-baseline="' + base + '"';
        if (o.rot) a += ' transform="rotate(' + esc4(o.rot) + " " + esc4(x) + " " + esc4(y) + ')"';
        out.push("<text" + a + ">" + escXML(s) + "</text>");
      },
      ancho: anchoTexto,
      clipIn(x, y, w, h) {
        const id = "recorte" + (++nClipGlobal);
        defs.push('<clipPath id="' + id + '"><rect x="' + esc4(x) + '" y="' + esc4(y) + '" width="' + esc4(w) + '" height="' + esc4(h) + '"/></clipPath>');
        out.push('<g clip-path="url(#' + id + ')">');
      },
      clipOut() { out.push("</g>"); },
      piezas() { return { out: out, defs: defs }; }
    };
  }
  /* El documento, con una capa por superficie. Las capas son <g data-layer>,
     que es lo que ColabDraw reconoce como capa suya, y con eso los residuos se
     apagan allí con un clic en el ojo en lugar de haber que borrarlos a mano.
     Los <defs> de todas se juntan arriba: un <clipPath> dentro de una capa
     sigue valiendo, pero ColabDraw mueve y clona capas enteras y una
     definición de paso ahí dentro se pierde en cuanto alguien la reordena. */
  function svgDocumento(W, H, capas) {
    const defs = [];
    const cuerpo = capas.map(c => {
      const p = c.sup.piezas();
      defs.push.apply(defs, p.defs);
      return '<g data-layer="' + escXML(c.nombre) + '">\n' + p.out.join("\n") + "\n</g>";
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + esc4(W) + 'mm" height="' + esc4(H) +
      'mm" viewBox="0 0 ' + esc4(W) + " " + esc4(H) + '">\n' +
      (defs.length ? "<defs>\n" + defs.join("\n") + "\n</defs>\n" : "") +
      cuerpo.join("\n") + "\n</svg>\n";
  }

  // ============================================================
  //  9. Ejes
  // ============================================================
  function pasoBonito(rango, objetivo) {
    const bruto = rango / Math.max(1, objetivo);
    if (!(bruto > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(bruto)));
    const n = bruto / e;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * e;
  }
  /* Marcas de un eje: en lineal, un paso redondo; en logarítmico, las décadas
     y los 2…9 de cada una en tenue. `fuerte` dice cuáles llevan etiqueta. */
  function marcasLin(v0, v1, objetivo) {
    const paso = pasoBonito(v1 - v0, objetivo);
    const l = [];
    const desde = Math.ceil(v0 / paso - 1e-9) * paso;
    for (let v = desde; v <= v1 + paso * 1e-9; v += paso) l.push({ v: Math.abs(v) < paso * 1e-9 ? 0 : v, fuerte: true });
    return l;
  }
  function marcasLog(v0, v1) {
    const l = [];
    const e0 = Math.floor(Math.log10(v0)), e1 = Math.ceil(Math.log10(v1));
    const decadas = e1 - e0;
    for (let e = e0; e <= e1; e++) {
      for (let m = 1; m <= 9; m++) {
        const v = m * Math.pow(10, e);
        if (v < v0 * 0.999 || v > v1 * 1.001) continue;
        l.push({ v: v, fuerte: m === 1 || (decadas <= 2 && (m === 2 || m === 5)) });
      }
    }
    return l;
  }
  /* Etiqueta corta de un número de eje: sin notación científica mientras se
     pueda, y con ella (10³) en cuanto haría falta arrastrar ceros. */
  function etiquetaEje(v, paso) {
    if (v === 0) return "0";
    const av = Math.abs(v);
    if (av >= 1e5 || av < 1e-4) {
      const e = Math.floor(Math.log10(av));
      const m = v / Math.pow(10, e);
      const ms = Math.abs(m - Math.round(m)) < 1e-9 ? String(Math.round(m)) : m.toFixed(1);
      return (ms === "1" ? "" : ms + "·") + "10" + supIndice(e);
    }
    const dec = paso ? Math.max(0, -Math.floor(Math.log10(paso) + 1e-9)) : 3;
    let s = v.toFixed(Math.min(6, dec));
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }
  /* Rango de un eje: los datos con un margen del 5 %, y en logarítmico un
     factor multiplicativo en vez de un margen aditivo. Si el rango es nulo
     (todos los puntos con la misma y, que pasa al fijar parámetros) se abre a
     mano, o la división por cero deja la gráfica en blanco. */
  function rangoEje(v0, v1, log, margen) {
    margen = margen === undefined ? 0.05 : margen;
    if (!isFinite(v0) || !isFinite(v1)) return log ? { a: 1, b: 10 } : { a: 0, b: 1 };
    if (log) {
      if (!(v0 > 0)) v0 = v1 > 0 ? v1 / 100 : 1;
      if (!(v1 > v0)) v1 = v0 * 10;
      const f = Math.pow(v1 / v0, margen);
      return { a: v0 / f, b: v1 * f };
    }
    if (v1 - v0 === 0) {
      const d = Math.abs(v0) > 0 ? Math.abs(v0) * 0.1 : 1;
      return { a: v0 - d, b: v0 + d };
    }
    const m = (v1 - v0) * margen;
    return { a: v0 - m, b: v1 + m };
  }

  // ============================================================
  //  10. La gráfica del ajuste
  // ============================================================
  const N_CURVA = 400;
  /* Puntos donde se evalúa la curva: repartidos por la pantalla, no por el
     eje. En un eje logarítmico repartirlos linealmente deja la primera década
     con dos muestras y la última con trescientas, y la curva sale con esquinas
     justo donde más se mira. */
  function muestrasCurva(a, b, log, n) {
    const l = [];
    n = n || N_CURVA;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      l.push(log ? Math.pow(10, Math.log10(a) + t * (Math.log10(b) - Math.log10(a))) : a + t * (b - a));
    }
    return l;
  }

  /* cfg: { D, aj, mod, escX, escY, banda, pal, u, etX, etY, titulo, leyenda,
            marcarFuera, geo } — devuelve la geometría para el ratón. */
  function pintaAjuste(sup, W, H, cfg) {
    const P = cfg.pal, u = cfg.u || 1;
    const D = cfg.D;
    const logX = cfg.escX === "log", logY = cfg.escY === "log";
    sup.rect(0, 0, W, H, { fill: P.fondo });
    if (!D || !D.x.length) return null;

    /* Sólo entran en el rango los puntos que el eje puede representar: en
       logarítmico, los positivos. Un solo cero arrastraría el mínimo a −∞. */
    const vis = [];
    for (let i = 0; i < D.x.length; i++) {
      if (logX && !(D.x[i] > 0)) continue;
      if (logY && !(D.y[i] > 0)) continue;
      if (!isFinite(D.x[i]) || !isFinite(D.y[i])) continue;
      vis.push(i);
    }
    if (!vis.length) {
      sup.texto(W / 2, H / 2, "Ningún punto se puede dibujar en esta escala", { fill: P.dim, size: 12 * u, align: "center", base: "middle" });
      return null;
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const i of vis) {
      const ex = D.sx ? D.sx[i] : 0, ey = D.sy ? D.sy[i] : 0;
      x0 = Math.min(x0, D.x[i] - ex); x1 = Math.max(x1, D.x[i] + ex);
      y0 = Math.min(y0, D.y[i] - ey); y1 = Math.max(y1, D.y[i] + ey);
      if (cfg.aj && isFinite(cfg.aj.fit[i])) { y0 = Math.min(y0, cfg.aj.fit[i]); y1 = Math.max(y1, cfg.aj.fit[i]); }
    }
    if (logX) { x0 = Math.min.apply(null, vis.map(i => D.x[i])); x1 = Math.max.apply(null, vis.map(i => D.x[i])); }
    if (logY) { y0 = Math.min.apply(null, vis.map(i => D.y[i])); y1 = Math.max.apply(null, vis.map(i => D.y[i])); }
    const rx = rangoEje(x0, x1, logX), ry = rangoEje(y0, y1, logY, 0.08);

    const fS = 9.5 * u, fT = 10.5 * u;
    const marY = 12 * u + Math.max(28 * u, sup.ancho(etiquetaEje(ry.b, (ry.b - ry.a) / 5), { size: fS, mono: true }) + 10 * u) + (cfg.etY ? 13 * u : 0);
    const R = {
      x0: marY, x1: W - 12 * u,
      y0: 10 * u + (cfg.titulo ? 14 * u : 0),
      y1: H - (cfg.etX ? 32 * u : 20 * u)
    };
    if (R.x1 <= R.x0 || R.y1 <= R.y0) return null;

    const px = (v) => logX ? R.x0 + (Math.log10(v) - Math.log10(rx.a)) / (Math.log10(rx.b) - Math.log10(rx.a)) * (R.x1 - R.x0)
      : R.x0 + (v - rx.a) / (rx.b - rx.a) * (R.x1 - R.x0);
    const py = (v) => logY ? R.y1 - (Math.log10(v) - Math.log10(ry.a)) / (Math.log10(ry.b) - Math.log10(ry.a)) * (R.y1 - R.y0)
      : R.y1 - (v - ry.a) / (ry.b - ry.a) * (R.y1 - R.y0);
    const vx = (x) => logX ? Math.pow(10, Math.log10(rx.a) + (x - R.x0) / (R.x1 - R.x0) * (Math.log10(rx.b) - Math.log10(rx.a)))
      : rx.a + (x - R.x0) / (R.x1 - R.x0) * (rx.b - rx.a);

    // --- rejilla y marcas
    const mx = logX ? marcasLog(rx.a, rx.b) : marcasLin(rx.a, rx.b, Math.max(2, Math.round((R.x1 - R.x0) / (70 * u))));
    const my = logY ? marcasLog(ry.a, ry.b) : marcasLin(ry.a, ry.b, Math.max(2, Math.round((R.y1 - R.y0) / (42 * u))));
    const pasoX = mx.length > 1 ? Math.abs(mx[1].v - mx[0].v) : 0;
    const pasoY = my.length > 1 ? Math.abs(my[1].v - my[0].v) : 0;
    for (const m of mx) {
      const x = px(m.v);
      sup.linea([[x, R.y0], [x, R.y1]], { stroke: m.fuerte ? P.grid2 : P.grid1, lw: 0.7 * u });
      if (m.fuerte && !cfg.sinEtiquetasX) sup.texto(x, R.y1 + 12 * u, etiquetaEje(m.v, pasoX), { fill: P.dim, size: fS, mono: true, align: "center" });
    }
    for (const m of my) {
      const y = py(m.v);
      sup.linea([[R.x0, y], [R.x1, y]], { stroke: m.fuerte ? P.grid2 : P.grid1, lw: 0.7 * u });
      if (m.fuerte) sup.texto(R.x0 - 6 * u, y, etiquetaEje(m.v, pasoY), { fill: P.dim, size: fS, mono: true, align: "right", base: "middle" });
    }
    sup.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, { stroke: P.marco, lw: 0.8 * u });
    if (cfg.etX) sup.texto((R.x0 + R.x1) / 2, R.y1 + 27 * u, cfg.etX, { fill: P.texto, size: fT, align: "center" });
    if (cfg.etY) sup.texto(11 * u, (R.y0 + R.y1) / 2, cfg.etY, { fill: P.texto, size: fT, align: "center", rot: -90 });
    if (cfg.titulo) sup.texto(R.x0, R.y0 - 5 * u, cfg.titulo, { fill: P.dim, size: fT, peso: 600 });

    // --- la curva del ajuste y su banda
    sup.clipIn(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    const aj = cfg.aj;
    if (aj && !aj.error) {
      const xs = muestrasCurva(rx.a, rx.b, logX);
      const pts = [], arr = [], aba = [];
      for (const xv of xs) {
        const yv = aj.mod.f(xv, aj.p);
        if (!isFinite(yv)) continue;
        if (logY && !(yv > 0)) continue;
        pts.push([px(xv), py(yv)]);
        if (cfg.banda && aj.C && aj.C.length) {
          const s = sigmaCurva(aj.mod, xv, aj);
          if (isFinite(s)) {
            const a = yv + s, b = yv - s;
            if (!logY || (a > 0 && b > 0)) { arr.push([px(xv), py(a)]); aba.push([px(xv), py(b)]); }
          }
        }
      }
      if (arr.length > 2) sup.poly(arr.concat(aba.reverse()), { fill: P.banda });
      sup.linea(pts, { stroke: P.curva, lw: 1.6 * u });
    }

    // --- los puntos, con sus barras
    const rPunto = 2.6 * u;
    for (let i = 0; i < D.x.length; i++) {
      if (logX && !(D.x[i] > 0)) continue;
      if (logY && !(D.y[i] > 0)) continue;
      if (!isFinite(D.x[i]) || !isFinite(D.y[i])) continue;
      const dentro = D.usar[i];
      const col = dentro ? P.punto : P.fuera;
      const X = px(D.x[i]), Y = py(D.y[i]);
      const cap = 2.6 * u;
      if (D.sy && D.sy[i] > 0) {
        const a = D.y[i] + D.sy[i], b = D.y[i] - D.sy[i];
        if (!logY || b > 0) {
          const ya = py(a), yb = py(b);
          sup.linea([[X, ya], [X, yb]], { stroke: col, lw: 0.9 * u });
          sup.linea([[X - cap, ya], [X + cap, ya]], { stroke: col, lw: 0.9 * u });
          sup.linea([[X - cap, yb], [X + cap, yb]], { stroke: col, lw: 0.9 * u });
        }
      }
      if (D.sx && D.sx[i] > 0) {
        const a = D.x[i] + D.sx[i], b = D.x[i] - D.sx[i];
        if (!logX || b > 0) {
          const xa = px(a), xb = px(b);
          sup.linea([[xa, Y], [xb, Y]], { stroke: col, lw: 0.9 * u });
          sup.linea([[xa, Y - cap], [xa, Y + cap]], { stroke: col, lw: 0.9 * u });
          sup.linea([[xb, Y - cap], [xb, Y + cap]], { stroke: col, lw: 0.9 * u });
        }
      }
      /* Un punto excluido se dibuja hueco y con una cruz: gris a secas se
         confunde con un punto lejano y deja al lector preguntándose por qué la
         curva no pasa por ahí. */
      if (dentro) {
        sup.circ(X, Y, rPunto, { fill: col });
      } else {
        sup.circ(X, Y, rPunto, { stroke: col, lw: 0.9 * u });
        const d = rPunto + 1.6 * u;
        sup.linea([[X - d, Y - d], [X + d, Y + d]], { stroke: col, lw: 0.8 * u });
        sup.linea([[X - d, Y + d], [X + d, Y - d]], { stroke: col, lw: 0.8 * u });
      }
    }
    sup.clipOut();

    // --- leyenda
    if (cfg.leyenda && cfg.leyenda.length) {
      let y = R.y0 + 12 * u;
      const anchos = cfg.leyenda.map(l => sup.ancho(l.t, { size: fS }));
      const anc = Math.max.apply(null, anchos) + 22 * u;
      const x = cfg.leyendaIzq ? R.x0 + 10 * u : R.x1 - anc - 4 * u;
      sup.rect(x - 6 * u, R.y0 + 4 * u, anc + 6 * u, cfg.leyenda.length * 13 * u + 6 * u,
        { fill: P.fondo, stroke: P.grid2, lw: 0.6 * u, op: 0.92 });
      for (const l of cfg.leyenda) {
        if (l.tipo === "punto") sup.circ(x + 5 * u, y - 3 * u, rPunto, { fill: l.c });
        else sup.linea([[x, y - 3 * u], [x + 11 * u, y - 3 * u]], { stroke: l.c, lw: 1.6 * u });
        sup.texto(x + 16 * u, y, l.t, { fill: P.texto, size: fS });
        y += 13 * u;
      }
    }
    return { R: R, px: px, py: py, vx: vx, rx: rx, ry: ry, logX: logX, logY: logY };
  }

  /* Los residuos, con el mismo eje x que la gráfica de arriba. Normalizados
     (r/σ) son los que dicen algo: en unidades de y, un residuo de 2 mV puede
     ser enorme o insignificante según lo que valga la σ de ese punto, y los
     puntos con más incertidumbre son precisamente los que pueden desviarse
     más sin que pase nada. */
  function pintaResiduos(sup, W, H, cfg) {
    const P = cfg.pal, u = cfg.u || 1, D = cfg.D, aj = cfg.aj;
    sup.rect(0, 0, W, H, { fill: P.fondo });
    if (!aj || aj.error || !D || !D.x.length) return null;
    const logX = cfg.escX === "log";
    const norm = cfg.norm && D.sy;
    const idx = [];
    for (let i = 0; i < D.x.length; i++) {
      if (logX && !(D.x[i] > 0)) continue;
      if (!isFinite(aj.fit[i])) continue;
      idx.push(i);
    }
    if (!idx.length) return null;
    const val = (i) => norm ? aj.res[i] / (D.sy[i] || 1) : aj.res[i];
    let m = 0;
    for (const i of idx) {
      const e = norm ? 1 : (D.sy ? D.sy[i] : 0);
      m = Math.max(m, Math.abs(val(i)) + e);
    }
    if (!(m > 0)) m = 1;
    const rx = cfg.rx || rangoEje(Math.min.apply(null, idx.map(i => D.x[i])), Math.max.apply(null, idx.map(i => D.x[i])), logX);
    const fS = 9.5 * u;
    const marY = cfg.marY || (12 * u + 34 * u);
    const R = { x0: marY, x1: W - 12 * u, y0: 8 * u, y1: H - (cfg.etX ? 34 * u : 16 * u) };
    if (R.x1 <= R.x0 || R.y1 <= R.y0) return null;
    const px = (v) => logX ? R.x0 + (Math.log10(v) - Math.log10(rx.a)) / (Math.log10(rx.b) - Math.log10(rx.a)) * (R.x1 - R.x0)
      : R.x0 + (v - rx.a) / (rx.b - rx.a) * (R.x1 - R.x0);
    const py = (v) => (R.y0 + R.y1) / 2 - v / (m * 1.15) * (R.y1 - R.y0) / 2;

    const mx = logX ? marcasLog(rx.a, rx.b) : marcasLin(rx.a, rx.b, Math.max(2, Math.round((R.x1 - R.x0) / (70 * u))));
    const pasoX = mx.length > 1 ? Math.abs(mx[1].v - mx[0].v) : 0;
    for (const t of mx) {
      const x = px(t.v);
      sup.linea([[x, R.y0], [x, R.y1]], { stroke: t.fuerte ? P.grid2 : P.grid1, lw: 0.7 * u });
      if (t.fuerte && cfg.etX) sup.texto(x, R.y1 + 12 * u, etiquetaEje(t.v, pasoX), { fill: P.dim, size: fS, mono: true, align: "center" });
    }
    const my = marcasLin(-m * 1.15, m * 1.15, 4);
    for (const t of my) {
      const y = py(t.v);
      if (t.v === 0) continue;
      sup.linea([[R.x0, y], [R.x1, y]], { stroke: P.grid1, lw: 0.7 * u });
      sup.texto(R.x0 - 6 * u, y, etiquetaEje(t.v, my.length > 1 ? Math.abs(my[1].v - my[0].v) : 0), { fill: P.dim, size: fS, mono: true, align: "right", base: "middle" });
    }
    /* La banda de ±1σ sólo tiene sentido normalizando: es el sitio donde
       deberían caer dos de cada tres puntos si el modelo y las σ son ciertos. */
    if (norm) {
      const a = py(1), b = py(-1);
      sup.rect(R.x0, Math.min(a, b), R.x1 - R.x0, Math.abs(b - a), { fill: P.banda });
    }
    sup.linea([[R.x0, py(0)], [R.x1, py(0)]], { stroke: P.cero, lw: 1 * u, dash: [4 * u, 3 * u] });
    sup.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, { stroke: P.marco, lw: 0.8 * u });
    sup.texto(R.x0 + 5 * u, R.y0 + 11 * u, norm ? "Residuos (r/σ)" : "Residuos", { fill: P.dim, size: fS, peso: 600 });
    /* En la figura del informe el eje x se rotula UNA vez y aquí abajo, que es
       donde acaba el dibujo; el panel de arriba se queda sin números para no
       repetirlos en mitad de la figura. En pantalla es al revés, porque cada
       lienzo es una caja aparte y la de residuos puede estar oculta. */
    if (cfg.etX) sup.texto((R.x0 + R.x1) / 2, R.y1 + 27 * u, cfg.etX, { fill: P.texto, size: 10.5 * u, align: "center" });

    sup.clipIn(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    for (const i of idx) {
      const col = D.usar[i] ? P.punto : P.fuera;
      const X = px(D.x[i]), Y = py(val(i));
      const e = norm ? 1 : (D.sy ? D.sy[i] : 0);
      if (e > 0) {
        const cap = 2.4 * u;
        sup.linea([[X, py(val(i) + e)], [X, py(val(i) - e)]], { stroke: col, lw: 0.9 * u });
        sup.linea([[X - cap, py(val(i) + e)], [X + cap, py(val(i) + e)]], { stroke: col, lw: 0.9 * u });
        sup.linea([[X - cap, py(val(i) - e)], [X + cap, py(val(i) - e)]], { stroke: col, lw: 0.9 * u });
      }
      if (D.usar[i]) sup.circ(X, Y, 2.4 * u, { fill: col });
      else sup.circ(X, Y, 2.4 * u, { stroke: col, lw: 0.9 * u });
    }
    sup.clipOut();
    return { R: R, px: px, py: py };
  }

  // ============================================================
  //  11. Estado
  // ============================================================
  const S = {
    tab: "ajuste",
    datos: null,                                   // { cols, n, nombre }
    mapa: { x: 0, y: 1 },
    sy: { modo: "no", col: -1, valor: 1 },         // no | col | const | pct
    sx: { modo: "no", col: -1, valor: 0 },
    usar: [],
    modeloId: "recta", grado: 2, formula: "a*exp(-x/tau)+c",
    params: [], fijos: [],
    auto: true,
    vista: { escX: "lin", escY: "lin", banda: false, norm: true },
    formato: "siunitx", conTablaDatos: false,
    derivadas: [],
    mod: null, aj: null, D: null, error: "",
    geo: null, hover: null,
    opts: {}
  };

  const $ = (id) => document.getElementById(id);
  let R = {};
  const REF_IDS = [
    "tabAjuste", "tabDatos", "tabInforme", "btnSvg", "btnPng", "btnCsv",
    "btnAbrir", "btnPegarIr", "fileIn", "selEjemplo", "datosInfo",
    "selX", "selY", "selSy", "rowSyVal", "syValIn", "unidSy",
    "selSx", "rowSxVal", "sxValIn", "unidSx",
    "selModelo", "rowGrado", "gradoIn", "rowLibre", "libreIn", "modeloEc", "modeloAviso",
    "paramsBody", "btnSemillas", "btnAjustar", "chkAuto",
    "viewAjuste", "viewDatos", "viewInforme",
    "selEscX", "selEscY", "chkBanda", "chkNorm",
    "plotWrap", "plotCanvas", "plotHover", "resWrap", "resCanvas",
    "datosTexto", "btnAplicarTexto", "btnTodos", "btnNinguno",
    "tablaHead", "tablaBody", "tablaNota",
    "selFormato", "chkTablaDatos", "btnCopiaTex", "btnTex", "texOut",
    "resParamsBody", "calChi", "calR2", "calDet", "calAviso",
    "corrCard", "corrBody", "derivIn", "btnDeriv", "derivBody",
    "notaMetodo", "statusLeft", "statusRight"
  ];

  let dpr = 1;
  const CV = {};
  function bindCanvas(clave, idCanvas, idWrap) {
    CV[clave] = { canvas: R[idCanvas], ctx: R[idCanvas].getContext("2d"), wrap: R[idWrap], w: 0, h: 0 };
  }
  function resizeCanvas(clave) {
    const c = CV[clave];
    const w = c.wrap.clientWidth, h = c.wrap.clientHeight;
    if (w === 0 || h === 0) return false;
    if (c.w === w && c.h === h && c.canvas.width === Math.round(w * dpr)) return true;
    c.w = w; c.h = h;
    c.canvas.width = Math.round(w * dpr);
    c.canvas.height = Math.round(h * dpr);
    c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ============================================================
  //  12. De las columnas al ajuste
  // ============================================================
  const colDe = (i) => (S.datos && S.datos.cols[i]) || null;
  const nombreCol = (i) => { const c = colDe(i); return c ? c.nombre : ""; };
  const unidadCol = (i) => { const c = colDe(i); return c ? c.unidad : ""; };
  function etiquetaCol(i) {
    const c = colDe(i);
    if (!c) return "";
    return c.unidad ? c.nombre + " (" + c.unidad + ")" : c.nombre;
  }
  /* La σ de cada punto según lo elegido en el panel: una columna, un valor
     constante o un porcentaje del propio valor. El porcentaje existe porque es
     como vienen dadas las incertidumbres de casi cualquier instrumento
     («±0.5 % de la lectura») y calcularlo a mano en una hoja aparte para luego
     pegarlo aquí es exactamente el trabajo que esto quita. */
  function sigmaColumna(cfg, base, n) {
    if (!cfg || cfg.modo === "no") return null;
    if (cfg.modo === "col") {
      const c = colDe(cfg.col);
      if (!c) return null;
      return base.map((v, i) => Math.abs(c.v[i]));
    }
    if (cfg.modo === "const") return base.map(() => Math.abs(cfg.valor));
    if (cfg.modo === "pct") return base.map(v => Math.abs(v * cfg.valor / 100));
    return null;
  }
  /* D lleva TODOS los puntos legibles con su bandera `usar`, no sólo los que
     entran en el ajuste: la gráfica tiene que seguir dibujando el punto que se
     acaba de excluir — si desapareciera, nadie sabría que sigue ahí ni podría
     volver a meterlo. Al ajuste se le pasa el subconjunto. */
  function construyeD() {
    if (!S.datos) return null;
    const cx = colDe(S.mapa.x), cy = colDe(S.mapa.y);
    if (!cx || !cy) return null;
    const n = S.datos.n;
    const idx = [];
    for (let i = 0; i < n; i++) if (isFinite(cx.v[i]) && isFinite(cy.v[i])) idx.push(i);
    const x = idx.map(i => cx.v[i]), y = idx.map(i => cy.v[i]);
    const sy = sigmaColumna(S.sy, y, idx.length);
    const sx = sigmaColumna(S.sx, x, idx.length);
    const usar = idx.map(i => S.usar[i] !== false);
    /* Una σ nula o negativa daría peso infinito a ese punto, que pasaría a ser
       el único que cuenta. Se sube al mínimo positivo de la columna, y si no
       hay ninguno, la columna entera no sirve como σ. */
    let syOK = sy;
    if (sy) {
      const pos = sy.filter(v => v > 0 && isFinite(v));
      if (!pos.length) syOK = null;
      else {
        const min = Math.min.apply(null, pos);
        syOK = sy.map(v => (v > 0 && isFinite(v)) ? v : min);
      }
    }
    return { x: x, y: y, sy: syOK, sx: sx, usar: usar, idx: idx, n: idx.length };
  }
  const filtra = (D) => ({
    x: D.x.filter((v, i) => D.usar[i]),
    y: D.y.filter((v, i) => D.usar[i]),
    sy: D.sy ? D.sy.filter((v, i) => D.usar[i]) : null,
    sx: D.sx ? D.sx.filter((v, i) => D.usar[i]) : null
  });

  /* Los valores de partida se conservan mientras el modelo siga teniendo los
     mismos parámetros: cambiar de escala o excluir un punto no puede tirar a
     la basura lo que se acaba de escribir a mano. */
  function preparaModelo(reestimar) {
    const mod = resuelveModelo(S.modeloId, S.grado, S.formula);
    S.mod = mod;
    if (mod.error) { S.params = []; S.fijos = []; return mod; }
    const nombres = mod.ps.map(p => p.n).join(",");
    if (reestimar || S.paramsDe !== nombres || S.params.length !== mod.ps.length) {
      /* Volver a estimar respeta lo que se haya fijado a mano: un parámetro
         fijo es un dato que ha puesto alguien, no una incógnita, y «Estimar»
         sólo debe tocar las que sí lo son. Con el modelo cambiado no hay nada
         que respetar, porque los parámetros ya no son los mismos. */
      const mismos = S.paramsDe === nombres && S.fijos.length === mod.ps.length;
      const nuevos = semillaDe(mod);
      if (mismos) { for (let k = 0; k < nuevos.length; k++) if (S.fijos[k]) nuevos[k] = S.params[k]; }
      else S.fijos = mod.ps.map(() => false);
      S.params = nuevos;
      S.paramsDe = nombres;
    }
    return mod;
  }
  function semillaDe(mod) {
    const D = S.D || construyeD();
    if (mod.base) return mod.ps.map(() => 1);          // no la necesita: se resuelve de una vez
    if (!D || !D.n) return mod.ps.map(() => 1);
    const F = filtra(D);
    if (!F.x.length) return mod.ps.map(() => 1);
    if (!mod.semilla) return mod.ps.map(() => 1);
    const p = mod.semilla(F);
    return p.map(v => isFinite(v) ? v : 1);
  }

  /* El ciclo completo: datos → modelo → ajuste → todo lo que se ve. */
  function aplica(reestimar) {
    S.D = construyeD();
    const mod = preparaModelo(reestimar);
    S.error = "";
    S.aj = null;
    if (mod.error) {
      S.error = mod.error;
    } else if (S.D && S.D.n) {
      const F = filtra(S.D);
      const fijos = S.fijos.slice();
      const aj = ajusta(F, mod, S.params.slice(), fijos);
      if (aj.error) {
        S.error = aj.error;
      } else {
        aj.fijos = fijos;
        /* fit y res se recalculan sobre TODOS los puntos: los excluidos también
           tienen residuo, y verlo es la mitad del motivo para excluirlos. Los
           estadísticos (χ², ν, R²) siguen siendo los del subconjunto ajustado,
           que es lo correcto. */
        aj.fit = S.D.x.map(x => mod.f(x, aj.p));
        aj.res = S.D.y.map((y, i) => y - aj.fit[i]);
        S.aj = aj;
      }
    } else {
      S.error = "Carga o escribe unos datos para empezar.";
    }
    pintaTodo();
  }

  function pintaTodo() {
    dibuja();
    pintaPanelParams();
    pintaCalidad();
    pintaCorrelacion();
    pintaDerivadas();
    pintaTablaDatos();
    pintaTex();
    pintaInfoDatos();
    R.modeloEc.textContent = S.mod && !S.mod.error ? S.mod.ec : "";
    muestra(R.modeloAviso, !!(S.mod && S.mod.error), S.mod ? S.mod.error : "");
    R.statusLeft.textContent = S.error ? "⚠ " + S.error
      : (S.aj ? S.mod.nombre + " · " + (S.aj.iter > 1 ? S.aj.iter + " iteraciones" : "solución directa") +
        " · " + S.aj.n + " punto" + (S.aj.n === 1 ? "" : "s") : "—");
  }
  function muestra(el, si, texto) {
    if (texto !== undefined) el.textContent = texto || "";
    el.classList.toggle("hide", !si);
  }

  // ============================================================
  //  13. Pintar la vista del ajuste
  // ============================================================
  function cfgGrafica(pal, u, paraPapel) {
    const eq = S.aj && !S.aj.error;
    const ley = [{ t: "Datos", c: pal.punto, tipo: "punto" }];
    if (eq) ley.push({ t: S.mod.ec.replace(/^y = /, "Ajuste: "), c: pal.curva, tipo: "linea" });
    return {
      D: S.D, aj: S.aj, mod: S.mod, pal: pal, u: u,
      escX: S.vista.escX, escY: S.vista.escY,
      banda: S.vista.banda,
      etX: etiquetaCol(S.mapa.x), etY: etiquetaCol(S.mapa.y),
      leyenda: ley,
      leyendaIzq: leyendaALaIzquierda(),
      norm: S.vista.norm
    };
  }
  /* La leyenda va donde no tape: si la nube de puntos sube hacia la derecha,
     el hueco está arriba a la izquierda. Se decide con la pendiente de la
     recta que pasa por los datos, que para esto basta. */
  function leyendaALaIzquierda() {
    const D = S.D;
    if (!D || D.x.length < 2) return false;
    const r = ajustaRectaCruda(D.x, D.y);
    return r[0] > 0;
  }
  function dibuja() {
    if (S.tab !== "ajuste") return;
    if (resizeCanvas("plot")) {
      const c = CV.plot;
      const cfg = cfgGrafica(PAL_PANTALLA, 1, false);
      S.geo = pintaAjuste(supCanvas(c.ctx, true), c.w, c.h, cfg);
      if (S.error && (!S.D || !S.D.n)) {
        c.ctx.fillStyle = PAL_PANTALLA.dim;
        c.ctx.font = F_SANS(12.5);
        c.ctx.textAlign = "center";
        c.ctx.fillText(S.error, c.w / 2, c.h / 2);
        c.ctx.textAlign = "left";
      }
      dibujaHover();
    }
    if (resizeCanvas("res")) {
      const c = CV.res;
      const cfg = cfgGrafica(PAL_PANTALLA, 1, false);
      cfg.rx = S.geo ? S.geo.rx : null;
      cfg.marY = S.geo ? S.geo.R.x0 : null;
      cfg.etX = null;
      pintaResiduos(supCanvas(c.ctx, true), c.w, c.h, cfg);
    }
  }
  const F_SANS = (px, peso) => (peso || 400) + " " + px + "px 'IBM Plex Sans', sans-serif";

  /* El punto más cercano al ratón, en píxeles de pantalla: en unidades de dato
     «cerca» no quiere decir nada cuando los dos ejes van en escalas distintas. */
  function puntoCerca(mx, my) {
    if (!S.geo || !S.D) return -1;
    let mejor = -1, dist = 15 * 15;
    for (let i = 0; i < S.D.x.length; i++) {
      if (S.geo.logX && !(S.D.x[i] > 0)) continue;
      if (S.geo.logY && !(S.D.y[i] > 0)) continue;
      const dx = S.geo.px(S.D.x[i]) - mx, dy = S.geo.py(S.D.y[i]) - my;
      const d = dx * dx + dy * dy;
      if (d < dist) { dist = d; mejor = i; }
    }
    return mejor;
  }
  function dibujaHover() {
    const i = S.hover;
    if (i === null || i === undefined || i < 0 || !S.D || !S.geo) { R.plotHover.style.display = "none"; return; }
    const D = S.D;
    const l = [];
    l.push(nombreCol(S.mapa.x) + " = " + sig(D.x[i], 6) + (D.sx ? " ± " + sig(D.sx[i], 3) : "") + " " + unidadCol(S.mapa.x));
    l.push(nombreCol(S.mapa.y) + " = " + sig(D.y[i], 6) + (D.sy ? " ± " + sig(D.sy[i], 3) : "") + " " + unidadCol(S.mapa.y));
    if (S.aj) {
      l.push("ajuste  = " + sig(S.aj.fit[i], 6));
      const r = S.aj.res[i];
      l.push("residuo = " + sig(r, 4) + (D.sy ? "   (" + num(r / (D.sy[i] || 1), 2) + " σ)" : ""));
    }
    if (!D.usar[i]) l.push("— fuera del ajuste —");
    R.plotHover.textContent = l.join("\n");
    R.plotHover.style.display = "block";
  }

  // ============================================================
  //  14. Los paneles
  // ============================================================
  /* Nombre de parámetro en matemáticas: «tau» se escribe τ y «c0» lleva
     subíndice. Lo mismo vale para la pantalla y para el LaTeX, sólo cambia el
     alfabeto. */
  const GRIEGAS = ["alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "nu", "rho", "sigma", "tau", "phi", "chi", "omega"];
  const GRIEGA_UNI = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ",
    mu: "µ", nu: "ν", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", chi: "χ", omega: "ω"
  };
  function nombreBonito(n) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(n);
    if (m && GRIEGA_UNI[m[1]]) return GRIEGA_UNI[m[1]] + subIndice(m[2]);
    if (m) return m[1] + subIndice(m[2]);
    return GRIEGA_UNI[n] || n;
  }
  const SUBS = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
  const subIndice = (s) => String(s).split("").map(c => SUBS[c] || c).join("");
  function nombreTex(n) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(n);
    const base = m ? m[1] : n;
    const sub = m ? m[2] : "";
    const b = GRIEGAS.indexOf(base) >= 0 ? "\\" + base : base;
    return sub ? b + "_{" + sub + "}" : b;
  }
  const unidadParam = (p) => unidadDe(p.u, unidadCol(S.mapa.x), unidadCol(S.mapa.y));

  /* La tabla de valores de partida se REHACE sólo si cambian los nombres de
     los parámetros; si no, se refrescan los valores saltándose el campo que
     tenga el foco. Repintarla en cada tecla se comía lo que se estaba
     escribiendo — el mismo tropiezo que ya está documentado en
     tool-options.js de ColabDraw. */
  let firmaParams = "";
  function pintaTablaParams(forzar) {
    const mod = S.mod;
    if (!mod || mod.error) { R.paramsBody.innerHTML = ""; firmaParams = ""; return; }
    const firma = mod.ps.map(p => p.n).join(",");
    if (forzar || firma !== firmaParams) {
      firmaParams = firma;
      R.paramsBody.innerHTML = mod.ps.map((p, k) =>
        '<tr><td class="nm">' + esc(nombreBonito(p.n)) + '</td>' +
        '<td><input class="in mono xs celda" type="text" data-p="' + k + '"></td>' +
        '<td class="ctr"><input type="checkbox" data-fijo="' + k + '"></td></tr>').join("");
      R.paramsBody.querySelectorAll("input[data-p]").forEach(el => {
        el.addEventListener("change", () => {
          const k = +el.getAttribute("data-p");
          const v = parseSI(el.value);
          if (v === null) { el.classList.add("mal"); return; }
          el.classList.remove("mal");
          S.params[k] = v;
          if (S.auto) aplica(); else pintaTablaParams();
        });
      });
      R.paramsBody.querySelectorAll("input[data-fijo]").forEach(el => {
        el.addEventListener("change", () => {
          S.fijos[+el.getAttribute("data-fijo")] = el.checked;
          aplica();
        });
      });
    }
    R.paramsBody.querySelectorAll("input[data-p]").forEach(el => {
      if (el === document.activeElement) return;
      el.value = sig(S.params[+el.getAttribute("data-p")], 6);
    });
    R.paramsBody.querySelectorAll("input[data-fijo]").forEach(el => {
      el.checked = !!S.fijos[+el.getAttribute("data-fijo")];
    });
  }

  function pintaPanelParams() {
    pintaTablaParams();
    const aj = S.aj;
    if (!aj || !S.mod || S.mod.error) {
      R.resParamsBody.innerHTML = '<tr><td class="vacio">' + esc(S.error || "Sin ajuste todavía") + "</td></tr>";
      return;
    }
    R.resParamsBody.innerHTML = S.mod.ps.map((p, k) => {
      const u = unidadParam(p);
      const fijo = aj.fijos && aj.fijos[k];
      const txt = fijo ? sig(aj.p[k], 6) + " (fijo)" : formateaPar(aj.p[k], aj.sp[k], "txt");
      const rel = (!fijo && isFinite(aj.sp[k]) && aj.p[k] !== 0) ? Math.abs(aj.sp[k] / aj.p[k]) * 100 : NaN;
      return '<tr><td class="nm">' + esc(nombreBonito(p.n)) + "</td><td>" + esc(txt) +
        (u ? ' <span class="ud">' + esc(u) + "</span>" : "") +
        (isFinite(rel) ? '<span class="rel">' + (rel < 0.01 ? "<0.01" : rel.toPrecision(2)) + " %</span>" : "") +
        "</td></tr>";
    }).join("");
  }

  function pintaCalidad() {
    const aj = S.aj;
    if (!aj) {
      R.calChi.textContent = "—"; R.calR2.textContent = "—";
      R.calDet.textContent = ""; muestra(R.calAviso, false);
      return;
    }
    R.calChi.textContent = aj.conSigma ? (isFinite(aj.chi2r) ? aj.chi2r.toPrecision(3) : "—") : "—";
    R.calR2.textContent = isFinite(aj.R2) ? aj.R2.toFixed(5) : "—";
    const l = [];
    l.push("ν = " + aj.nu + "   (" + aj.n + " puntos − " + (aj.n - aj.nu) + " parámetros)");
    if (aj.conSigma) {
      l.push("χ² = " + (isFinite(aj.chi2) ? aj.chi2.toPrecision(5) : "—"));
      if (isFinite(aj.pValor)) l.push("p = " + (aj.pValor < 1e-4 ? aj.pValor.toExponential(1) : aj.pValor.toFixed(4)));
    }
    l.push("s = " + sig(aj.sResidual, 4) + " " + unidadCol(S.mapa.y) + "   (residuo típico)");
    R.calDet.textContent = l.join("\n");
    /* El veredicto en palabras, que es lo que se busca de verdad: un χ²/ν es
       un número sin escala hasta que se sabe cuántos grados de libertad hay
       detrás. Con ν = 3 un 2.2 es de lo más normal; con ν = 200, imposible. */
    let aviso = "";
    if (!aj.C || aj.C.length !== aj.libres.length) {
      /* Pasa cuando dos parámetros hacen lo mismo (una exponencial con dos
         constantes multiplicándose) o cuando el ajuste se ha quedado lejos:
         la matriz normal es singular y no hay incertidumbres que dar. Decirlo
         importa, porque el valor de los parámetros sí se ha calculado y sin
         este aviso parecen un resultado. */
      aviso = "No he podido calcular las incertidumbres: la matriz del ajuste sale singular. Suele ser que dos parámetros son la misma cosa, o que el ajuste no ha llegado a converger — prueba a estimar los valores de partida otra vez.";
    } else if (aj.nu <= 0) {
      aviso = "Hay tantos parámetros como puntos: el modelo pasa por todos por construcción y no se puede estimar ninguna incertidumbre.";
    } else if (!aj.conSigma) {
      aviso = "";
    } else if (isFinite(aj.pValor)) {
      if (aj.pValor < 0.01) aviso = "χ² demasiado alto (p = " + aj.pValor.toExponential(1) + "): o el modelo no describe estos datos, o las σ están infravaloradas.";
      else if (aj.pValor > 0.99) aviso = "χ² demasiado bajo (p = " + aj.pValor.toFixed(3) + "): normalmente significa que las σ declaradas son mayores que la dispersión real.";
    }
    muestra(R.calAviso, !!aviso, aviso);
  }

  function pintaCorrelacion() {
    const aj = S.aj;
    const libres = aj ? aj.libres : [];
    /* La comprobación es que la covarianza tenga el tamaño que dicen los
       parámetros libres, no que exista: cuando la matriz normal sale singular,
       `C` es una lista VACÍA, que es igual de verdadera que una llena, y aquí
       se leía C[a][a] de una fila que no está. */
    if (!aj || !aj.C || aj.C.length !== libres.length || libres.length < 2) { R.corrCard.classList.add("hide"); return; }
    R.corrCard.classList.remove("hide");
    const n = libres.length;
    const nom = libres.map(k => nombreBonito(S.mod.ps[k].n));
    let h = "<tr><td></td>" + nom.map(x => '<td class="nm">' + esc(x) + "</td>").join("") + "</tr>";
    for (let a = 0; a < n; a++) {
      h += '<tr><td class="nm">' + esc(nom[a]) + "</td>";
      for (let b = 0; b < n; b++) {
        const d = Math.sqrt(aj.C[a][a] * aj.C[b][b]);
        const r = d > 0 ? aj.C[a][b] / d : NaN;
        const fuerte = isFinite(r) && Math.abs(r) > 0.9 && a !== b;
        h += '<td class="' + (a === b ? "diag" : (fuerte ? "alto" : "")) + '">' + (isFinite(r) ? r.toFixed(2) : "—") + "</td>";
      }
      h += "</tr>";
    }
    R.corrBody.innerHTML = h;
  }

  function pintaDerivadas() {
    if (!S.derivadas.length) { R.derivBody.innerHTML = ""; return; }
    if (!S.aj) {
      R.derivBody.innerHTML = '<tr><td class="vacio">Sin ajuste</td></tr>';
      return;
    }
    R.derivBody.innerHTML = S.derivadas.map((t, k) => {
      const r = evaluaDerivada(t, S.aj);
      const nom = r.nombre || "?";
      const val = r.error ? '<span class="malo">' + esc(r.error) + "</span>" : esc(formateaPar(r.v, r.s, "txt"));
      const quita = '<button class="quita" data-d="' + k + '" title="Quitar">×</button>';
      return '<tr title="' + esc(r.expr || t) + '"><td class="nm">' + esc(nombreBonito(nom)) +
        "</td><td>" + val + quita + "</td></tr>";
    }).join("");
    R.derivBody.querySelectorAll("button[data-d]").forEach(b => {
      b.addEventListener("click", () => {
        S.derivadas.splice(+b.getAttribute("data-d"), 1);
        pintaDerivadas();
        pintaTex();
      });
    });
  }

  const MAX_FILAS_TABLA = 400;
  function pintaTablaDatos() {
    if (!S.datos || !S.D) {
      R.tablaHead.innerHTML = "";
      R.tablaBody.innerHTML = '<tr><td class="vacio">Sin datos</td></tr>';
      R.tablaNota.textContent = "";
      return;
    }
    const D = S.D, aj = S.aj;
    const cab = ["", "#", etiquetaCol(S.mapa.x)];
    if (D.sx) cab.push("σx");
    cab.push(etiquetaCol(S.mapa.y));
    if (D.sy) cab.push("σy");
    if (aj) { cab.push("ajuste"); cab.push("residuo"); if (D.sy) cab.push("r/σ"); }
    R.tablaHead.innerHTML = cab.map(t => "<th>" + esc(t) + "</th>").join("");
    const N = Math.min(D.x.length, MAX_FILAS_TABLA);
    const filas = [];
    for (let i = 0; i < N; i++) {
      const c = [];
      c.push('<td class="ctr"><input type="checkbox" data-u="' + i + '"' + (D.usar[i] ? " checked" : "") + "></td>");
      c.push('<td class="dim">' + (D.idx[i] + 1) + "</td>");
      c.push("<td>" + sig(D.x[i], 6) + "</td>");
      if (D.sx) c.push("<td>" + sig(D.sx[i], 3) + "</td>");
      c.push("<td>" + sig(D.y[i], 6) + "</td>");
      if (D.sy) c.push("<td>" + sig(D.sy[i], 3) + "</td>");
      if (aj) {
        c.push("<td>" + sig(aj.fit[i], 6) + "</td>");
        c.push("<td>" + sig(aj.res[i], 4) + "</td>");
        if (D.sy) {
          const z = aj.res[i] / (D.sy[i] || 1);
          c.push('<td class="' + (Math.abs(z) > 3 ? "malo" : "") + '">' + num(z, 2) + "</td>");
        }
      }
      filas.push('<tr class="fila' + (D.usar[i] ? "" : " off") + '">' + c.join("") + "</tr>");
    }
    R.tablaBody.innerHTML = filas.join("") || '<tr><td class="vacio">Sin datos</td></tr>';
    R.tablaBody.querySelectorAll("input[data-u]").forEach(el => {
      el.addEventListener("change", () => {
        const i = +el.getAttribute("data-u");
        S.usar[S.D.idx[i]] = el.checked;
        aplica();
      });
    });
    const fuera = D.usar.filter(u => !u).length;
    R.tablaNota.textContent =
      (D.x.length > N ? "Se muestran las " + N + " primeras de " + D.x.length + " filas. " : "") +
      (fuera ? fuera + " punto" + (fuera === 1 ? "" : "s") + " fuera del ajuste." : "Todos los puntos entran en el ajuste.");
  }

  function pintaInfoDatos() {
    if (!S.datos) { R.datosInfo.textContent = ""; return; }
    const D = S.D;
    const dentro = D ? D.usar.filter(u => u).length : 0;
    const l = [S.datos.nombre || "datos"];
    l.push(S.datos.n + " filas · " + S.datos.cols.length + " columnas");
    if (D) l.push(dentro + " de " + D.x.length + " puntos en el ajuste");
    R.datosInfo.textContent = l.join("\n");
  }

  // ============================================================
  //  15. El informe en LaTeX
  // ============================================================
  /* La unidad se escribe siempre como \mathrm{V/A}, nunca con las macros de
     siunitx (\volt\per\ampere). Una columna que dice «V» no se puede traducir
     a \volt sin adivinar: «V» podría ser voltios o un volumen, y «min» son
     minutos o el mínimo. siunitx se usa para lo que sí sabe hacer sin
     adivinar nada: escribir el número con su incertidumbre. */
  const texEsc = (s) => String(s).replace(/([&%$#_{}])/g, "\\$1").replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");
  function unidadTex(u) {
    if (!u) return "";
    return "$\\mathrm{" + String(u).replace(/µ/g, "\\mu ").replace(/([&%$#_{}])/g, "\\$1").replace(/\^/g, "^") + "}$";
  }
  function generaTex() {
    const aj = S.aj, mod = S.mod;
    const L = [];
    L.push("% Generado por AjusteLab · Laboratorio");
    if (!aj || !mod || mod.error) {
      L.push("% (todavía no hay ningún ajuste que contar)");
      return L.join("\n");
    }
    const modo = S.formato === "siunitx" ? "siunitx" : "tex";
    if (modo === "siunitx") L.push("% Necesita \\usepackage{siunitx} en el preámbulo.");
    L.push("% Modelo: " + mod.ec + "   ·   " + aj.n + " puntos, ν = " + aj.nu);
    L.push("");
    L.push("\\begin{table}[htbp]");
    L.push("  \\centering");
    L.push("  \\caption{Parámetros del ajuste de " + texEsc(nombreCol(S.mapa.y)) + " frente a " +
      texEsc(nombreCol(S.mapa.x)) + " al modelo $" + texMod(mod) + "$.}");
    L.push("  \\label{tab:ajuste}");
    L.push("  \\begin{tabular}{lll}");
    L.push("    \\hline");
    L.push("    Parámetro & Valor & Unidad \\\\");
    L.push("    \\hline");
    mod.ps.forEach((p, k) => {
      const fijo = aj.fijos && aj.fijos[k];
      const v = fijo ? (modo === "siunitx" ? "\\num{" + sig(aj.p[k], 6) + "}" : "$" + sig(aj.p[k], 6) + "$")
        : (modo === "siunitx" ? formateaPar(aj.p[k], aj.sp[k], "siunitx") : "$" + formateaPar(aj.p[k], aj.sp[k], "tex") + "$");
      L.push("    $" + nombreTex(p.n) + "$ & " + v + (fijo ? " (fijo)" : "") + " & " + (unidadTex(unidadParam(p)) || "--") + " \\\\");
    });
    S.derivadas.forEach(t => {
      const r = evaluaDerivada(t, aj);
      if (r.error || !isFinite(r.v)) return;
      const v = modo === "siunitx" ? formateaPar(r.v, r.s, "siunitx") : "$" + formateaPar(r.v, r.s, "tex") + "$";
      L.push("    $" + nombreTex(r.nombre || "?") + "$ & " + v + " & -- \\\\");
    });
    L.push("    \\hline");
    L.push("  \\end{tabular}");
    L.push("\\end{table}");
    L.push("");
    L.push("% Calidad del ajuste, para el texto:");
    if (aj.conSigma) {
      L.push("% chi2 = " + sig(aj.chi2, 5) + ", nu = " + aj.nu + ", chi2/nu = " + sig(aj.chi2r, 4) +
        (isFinite(aj.pValor) ? ", p = " + sig(aj.pValor, 3) : ""));
    } else {
      L.push("% Sin sigma medidas: las incertidumbres salen de la dispersión (s = " + sig(aj.sResidual, 4) + ").");
    }
    L.push("% R^2 = " + sig(aj.R2, 6));
    L.push("");
    if (S.conTablaDatos) {
      const D = S.D;
      L.push("\\begin{table}[htbp]");
      L.push("  \\centering");
      L.push("  \\caption{Datos medidos.}");
      L.push("  \\label{tab:datos}");
      const cols = ["l", "l"];
      if (D.sy) cols.push("l");
      L.push("  \\begin{tabular}{" + cols.join("") + "}");
      L.push("    \\hline");
      L.push("    " + texEsc(etiquetaCol(S.mapa.x)) + " & " + texEsc(etiquetaCol(S.mapa.y)) +
        (D.sy ? " & $\\sigma$" : "") + " \\\\");
      L.push("    \\hline");
      for (let i = 0; i < D.x.length; i++) {
        if (!D.usar[i]) continue;
        const nx = modo === "siunitx" ? "\\num{" + sig(D.x[i], 6) + "}" : "$" + sig(D.x[i], 6) + "$";
        const ny = modo === "siunitx" ? "\\num{" + sig(D.y[i], 6) + "}" : "$" + sig(D.y[i], 6) + "$";
        const ns = D.sy ? (modo === "siunitx" ? "\\num{" + sig(D.sy[i], 3) + "}" : "$" + sig(D.sy[i], 3) + "$") : "";
        L.push("    " + nx + " & " + ny + (D.sy ? " & " + ns : "") + " \\\\");
      }
      L.push("    \\hline");
      L.push("  \\end{tabular}");
      L.push("\\end{table}");
      L.push("");
    }
    /* La figura se referencia en PNG y no en SVG a propósito: pdfTeX —el motor
       que compila ColabTeX— no incluye SVG. El camino corto es el botón PNG;
       el camino bueno, abrir el SVG en ColabDraw, rematarlo y exportar desde
       allí, porque entonces la figura queda como un objeto del proyecto y se
       actualiza sola en el artículo. */
    L.push("\\begin{figure}[htbp]");
    L.push("  \\centering");
    L.push("  \\includegraphics[width=0.75\\linewidth]{figuras/ajuste.png}");
    L.push("  \\caption{" + texEsc(nombreCol(S.mapa.y)) + " frente a " + texEsc(nombreCol(S.mapa.x)) +
      ". La línea es el ajuste a $" + texMod(mod) + "$.}");
    L.push("  \\label{fig:ajuste}");
    L.push("\\end{figure}");
    return L.join("\n");
  }
  /* La ecuación del modelo en LaTeX. Se compone de los nombres de los
     parámetros, así que vale igual para la fórmula libre. */
  function texMod(mod) {
    let s = mod.ec.replace(/^y\s*=\s*/, "");
    s = s.replace(/·/g, " ").replace(/−/g, "-").replace(/π/g, "\\pi ");
    s = s.replace(/e\^\(([^)]*)\)/g, "e^{$1}").replace(/\^\(([^)]*)\)/g, "^{$1}");
    s = s.replace(/\*/g, " ");
    s = s.replace(/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|rho|sigma|tau|phi|chi|omega)\b/g, "\\$1 ");
    s = s.replace(/([a-zA-Z])(\d)\b/g, "$1_{$2}");
    s = s.replace(/\bsin\b/g, "\\sin").replace(/\bcos\b/g, "\\cos").replace(/\bexp\b/g, "\\exp")
      .replace(/\bln\b/g, "\\ln").replace(/\bsqrt\(([^)]*)\)/g, "\\sqrt{$1}");
    s = s.replace(/²/g, "^{2}").replace(/³/g, "^{3}");
    return "y = " + s;
  }
  function pintaTex() {
    R.texOut.textContent = generaTex();
  }

  // ============================================================
  //  16. Salidas
  // ============================================================
  function descarga(nombre, texto, mime) {
    const b = new Blob([texto], { type: (mime || "text/plain") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function copia(texto, dicho) {
    const ok = () => { R.statusLeft.textContent = dicho || "Copiado."; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, () => fallback());
    } else fallback();
    function fallback() {
      const t = document.createElement("textarea");
      t.value = texto;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); ok(); } catch (e) { R.statusLeft.textContent = "No he podido copiar."; }
      document.body.removeChild(t);
    }
  }
  function exportaCSV() {
    const D = S.D;
    if (!D) return;
    const aj = S.aj;
    const L = [];
    L.push("# AjusteLab");
    if (aj) {
      L.push("# modelo," + (S.mod.ec.replace(/,/g, " ")));
      S.mod.ps.forEach((p, k) => L.push("# " + p.n + "," + aj.p[k] + ",sigma," + (isFinite(aj.sp[k]) ? aj.sp[k] : "")));
      L.push("# chi2," + aj.chi2 + ",nu," + aj.nu + ",R2," + aj.R2);
    }
    L.push("");
    const cab = ["n", nombreCol(S.mapa.x), nombreCol(S.mapa.y)];
    if (D.sx) cab.push("sigma_x");
    if (D.sy) cab.push("sigma_y");
    cab.push("en_el_ajuste");
    if (aj) { cab.push("ajuste"); cab.push("residuo"); if (D.sy) cab.push("residuo_normalizado"); }
    L.push(cab.map(c => String(c).replace(/,/g, " ")).join(","));
    for (let i = 0; i < D.x.length; i++) {
      const c = [D.idx[i] + 1, D.x[i], D.y[i]];
      if (D.sx) c.push(D.sx[i]);
      if (D.sy) c.push(D.sy[i]);
      c.push(D.usar[i] ? 1 : 0);
      if (aj) {
        c.push(aj.fit[i]); c.push(aj.res[i]);
        if (D.sy) c.push(aj.res[i] / (D.sy[i] || 1));
      }
      L.push(c.join(","));
    }
    descarga("ajuste-" + (S.modeloId) + ".csv", L.join("\n"), "text/csv");
  }

  /* La figura del informe, en milímetros y en dos capas: «Ajuste» y
     «Residuos». Van separadas porque en ColabDraw una capa se apaga con un
     clic — y la mitad de las veces el residuo sobra para el artículo aunque
     haya hecho falta para decidir. 160 mm es el ancho de una página con
     márgenes normales; a 0.75\linewidth entra de sobra en una columna. */
  const FIG_W = 160, FIG_H = 108, FIG_RES = 44, FIG_U = 0.32;
  /* El montaje de la figura, uno solo para el SVG y para el PNG. Escrito dos
     veces, las dos figuras se habrían separado a la primera corrección: quien
     arregla el margen del PNG no se acuerda del SVG. Recibe una superficie por
     panel porque el SVG los quiere en capas distintas; el lienzo pasa la misma
     dos veces y no se entera. */
  function montaFigura(supPrincipal, supResiduos) {
    const conRes = !!(S.aj && !S.aj.error && supResiduos);
    const cfg = cfgGrafica(PAL_PAPEL, FIG_U, true);
    cfg.etX = conRes ? null : etiquetaCol(S.mapa.x);
    cfg.sinEtiquetasX = conRes;
    const geo = pintaAjuste(supPrincipal, FIG_W, FIG_H, cfg);
    if (!conRes || !geo) return { geo: geo, conRes: false, H: FIG_H };
    const c2 = cfgGrafica(PAL_PAPEL, FIG_U, true);
    c2.rx = geo.rx;
    c2.marY = geo.R.x0;
    c2.etX = etiquetaCol(S.mapa.x);
    pintaResiduos(supDesplazada(supResiduos, 0, FIG_H), FIG_W, FIG_RES, c2);
    return { geo: geo, conRes: true, H: FIG_H + FIG_RES };
  }
  function figuraSVG() {
    const s1 = supSVG(), s2 = supSVG();
    const r = montaFigura(s1, s2);
    const capas = [{ nombre: "Ajuste", sup: s1 }];
    if (r.conRes) capas.push({ nombre: "Residuos", sup: s2 });
    return svgDocumento(FIG_W, r.H, capas);
  }
  /* Una superficie desplazada: la tira de residuos se dibuja como si empezara
     en cero y se coloca debajo. Trasladar aquí es más simple que meter un
     origen en cada rutina de dibujo, y en el SVG evita un <g transform> que
     ColabDraw tendría que arrastrar. */
  function supDesplazada(sup, dx, dy) {
    const m = (p) => [p[0] + dx, p[1] + dy];
    return {
      svg: sup.svg,
      rect: (x, y, w, h, o) => sup.rect(x + dx, y + dy, w, h, o),
      linea: (pts, o) => sup.linea(pts.map(m), o),
      poly: (pts, o) => sup.poly(pts.map(m), o),
      circ: (x, y, r, o) => sup.circ(x + dx, y + dy, r, o),
      texto: (x, y, s, o) => sup.texto(x + dx, y + dy, s, o),
      ancho: sup.ancho,
      clipIn: (x, y, w, h) => sup.clipIn(x + dx, y + dy, w, h),
      clipOut: () => sup.clipOut()
    };
  }
  /* El PNG se rasteriza a 300 ppp de la MISMA figura en milímetros, no de la
     pantalla: 160 mm a 300 ppp son 1890 píxeles, que es lo que hace falta para
     que las líneas no se vean escalonadas en el papel. Un pantallazo del
     instrumento tiene la mitad de resolución, fondo negro y rejilla de
     fósforo. */
  function figuraPNG(ppp) {
    const k = (ppp || 300) / 25.4;                 // píxeles por milímetro
    const H = FIG_H + ((S.aj && !S.aj.error) ? FIG_RES : 0);
    const off = document.createElement("canvas");
    off.width = Math.round(FIG_W * k);
    off.height = Math.round(H * k);
    const g = off.getContext("2d");
    g.setTransform(k, 0, 0, k, 0, 0);
    const sup = supCanvas(g, false);
    montaFigura(sup, sup);
    return off;
  }

  // ============================================================
  //  17. Ejemplos
  // ============================================================
  /* Datos generados con un generador congruencial propio y semilla fija: los
     mismos números en cada visita y en cada máquina, que es lo que permite
     usarlos para enseñar («te tiene que salir 47.1 Ω») y para comprobar que
     una versión no ha roto el ajuste. */
  function azar(semilla) {
    let s = semilla >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const EJEMPLOS = {
    ohm: () => {
      /* σ = 30 mV es lo que da un multímetro razonable en la escala de
         voltios; con los 80 mV que llevaba antes, la primera medida (0.47 V)
         tenía un 17 % de error y el ejemplo salía a 1.2 σ del valor
         verdadero — que es estadísticamente correcto y pedagógicamente
         pésimo, porque lo primero que se ve al abrir la aplicación es un
         resultado que no coincide con lo que dice el enunciado. */
      const r = azar(7), R0 = 47.1, s = 0.03;
      const I = [], V = [], E = [];
      for (let k = 1; k <= 12; k++) {
        const i = k * 0.01;
        I.push(+i.toFixed(4)); V.push(+(R0 * i + normal(r) * s).toFixed(3)); E.push(s);
      }
      return { nombre: "Ley de Ohm (ejemplo)", modelo: "prop", cols: [
        { nombre: "I", unidad: "A", v: I }, { nombre: "V", unidad: "V", v: V }, { nombre: "sigma", unidad: "V", v: E }] };
    },
    rc: () => {
      const r = azar(11), A = 5.02, tau = 1.23e-3, c = 0.048, s = 0.03;
      const t = [], v = [], e = [];
      for (let k = 0; k < 24; k++) {
        const x = k * 2.5e-4;
        t.push(+x.toPrecision(4)); v.push(+(A * Math.exp(-x / tau) + c + normal(r) * s).toFixed(3)); e.push(s);
      }
      return { nombre: "Descarga de un RC (ejemplo)", modelo: "expOff", cols: [
        { nombre: "t", unidad: "s", v: t }, { nombre: "V", unidad: "V", v: v }, { nombre: "sigma", unidad: "V", v: e }] };
    },
    pendulo: () => {
      const r = azar(23), g = 9.81, s = 0.012;
      const L = [], T = [], e = [];
      for (let k = 1; k <= 10; k++) {
        const l = 0.15 * k;
        L.push(+l.toFixed(3));
        T.push(+(2 * Math.PI * Math.sqrt(l / g) + normal(r) * s).toFixed(3));
        e.push(s);
      }
      return { nombre: "Péndulo simple (ejemplo)", modelo: "pot", cols: [
        { nombre: "L", unidad: "m", v: L }, { nombre: "T", unidad: "s", v: T }, { nombre: "sigma", unidad: "s", v: e }] };
    },
    resonancia: () => {
      const r = azar(31), A = 4.4, f0 = 1042, gam = 38, c = 0.15, s = 0.06;
      const f = [], a = [], e = [];
      for (let k = 0; k <= 28; k++) {
        const x = 900 + k * 10;
        f.push(x);
        a.push(+(A / (1 + Math.pow((x - f0) / gam, 2)) + c + normal(r) * s).toFixed(3));
        e.push(s);
      }
      return { nombre: "Resonancia (ejemplo)", modelo: "lorentz", cols: [
        { nombre: "f", unidad: "Hz", v: f }, { nombre: "A", unidad: "V", v: a }, { nombre: "sigma", unidad: "V", v: e }] };
    }
  };
  function cargaEjemplo(id) {
    const gen = EJEMPLOS[id];
    if (!gen) return;
    const d = gen();
    ponDatos({ cols: d.cols, n: d.cols[0].v.length, nombre: d.nombre }, d.modelo);
  }

  // ============================================================
  //  18. Entrada de datos
  // ============================================================
  /* Al entrar datos nuevos hay que decidir qué columna es cada cosa, y la
     apuesta acierta casi siempre: x la primera, y la segunda, y σ la tercera
     si su nombre suena a incertidumbre. Adivinar mal no cuesta nada —los
     desplegables están justo al lado— pero acertar ahorra tres clics en el
     noventa por ciento de los ficheros. */
  const SUENA_A_SIGMA = /^(s|sd|sig|sigma|σ|err|error|inc|incert|u|delta|d)([_\-]?[a-z0-9]*)?$/i;
  function ponDatos(datos, modelo) {
    S.datos = datos;
    S.usar = new Array(datos.n).fill(true);
    S.mapa.x = 0;
    S.mapa.y = datos.cols.length > 1 ? 1 : 0;
    S.sy = { modo: "no", col: -1, valor: 1 };
    S.sx = { modo: "no", col: -1, valor: 0 };
    for (let c = 2; c < datos.cols.length; c++) {
      if (SUENA_A_SIGMA.test(datos.cols[c].nombre.trim())) { S.sy = { modo: "col", col: c, valor: 1 }; break; }
    }
    if (modelo && MODELOS[modelo]) S.modeloId = modelo;
    S.derivadas = [];
    S.vista.escX = "lin";
    S.vista.escY = "lin";
    llenaSelectsColumnas();
    escribeCampos();
    aplica(true);
  }
  function abreArchivo(file) {
    const lector = new FileReader();
    lector.onload = () => {
      const t = parseTabla(String(lector.result || ""));
      if (t.error) { R.statusLeft.textContent = "⚠ " + t.error; return; }
      ponDatos({ cols: t.cols, n: t.n, nombre: file.name }, null);
      R.datosTexto.value = "";
      if (t.saltadas) R.statusLeft.textContent = "Cargado. " + t.saltadas + " líneas saltadas por no ser números.";
    };
    lector.onerror = () => { R.statusLeft.textContent = "⚠ No he podido leer el archivo."; };
    lector.readAsText(file);
  }

  // ============================================================
  //  19. Interfaz
  // ============================================================
  function llenaSelectsColumnas() {
    const cols = S.datos ? S.datos.cols : [];
    const opts = cols.map((c, i) => '<option value="' + i + '">' + esc(c.nombre + (c.unidad ? " (" + c.unidad + ")" : "")) + "</option>").join("");
    R.selX.innerHTML = opts;
    R.selY.innerHTML = opts;
    const extra = '<option value="no">— ninguna —</option><option value="const">valor constante</option><option value="pct">% del valor</option>';
    const cOpts = cols.map((c, i) => '<option value="c' + i + '">' + esc(c.nombre) + "</option>").join("");
    R.selSy.innerHTML = extra + cOpts;
    R.selSx.innerHTML = extra + cOpts;
  }
  const valSigma = (cfg) => cfg.modo === "col" ? "c" + cfg.col : cfg.modo;
  function leeSigma(sel, cfg) {
    const v = sel.value;
    if (v[0] === "c" && v.length > 1) { cfg.modo = "col"; cfg.col = +v.slice(1); }
    else { cfg.modo = v; cfg.col = -1; }
  }
  function escribeCampos() {
    if (S.datos) {
      R.selX.value = String(S.mapa.x);
      R.selY.value = String(S.mapa.y);
      R.selSy.value = valSigma(S.sy);
      R.selSx.value = valSigma(S.sx);
    }
    muestra(R.rowSyVal, S.sy.modo === "const" || S.sy.modo === "pct");
    muestra(R.rowSxVal, S.sx.modo === "const" || S.sx.modo === "pct");
    R.unidSy.textContent = S.sy.modo === "pct" ? "%" : unidadCol(S.mapa.y);
    R.unidSx.textContent = S.sx.modo === "pct" ? "%" : unidadCol(S.mapa.x);
    if (document.activeElement !== R.syValIn) R.syValIn.value = sig(S.sy.valor, 6);
    if (document.activeElement !== R.sxValIn) R.sxValIn.value = sig(S.sx.valor, 6);
    R.selModelo.value = S.modeloId;
    muestra(R.rowGrado, S.modeloId === "poly");
    muestra(R.rowLibre, S.modeloId === "libre");
    if (document.activeElement !== R.gradoIn) R.gradoIn.value = String(S.grado);
    if (document.activeElement !== R.libreIn) R.libreIn.value = S.formula;
    R.selEscX.value = S.vista.escX;
    R.selEscY.value = S.vista.escY;
    R.chkBanda.checked = S.vista.banda;
    R.chkNorm.checked = S.vista.norm;
    R.chkAuto.checked = S.auto;
    R.selFormato.value = S.formato;
    R.chkTablaDatos.checked = S.conTablaDatos;
  }
  function setTab(t) {
    S.tab = t;
    R.tabAjuste.classList.toggle("on", t === "ajuste");
    R.tabDatos.classList.toggle("on", t === "datos");
    R.tabInforme.classList.toggle("on", t === "informe");
    muestra(R.viewAjuste, t === "ajuste");
    muestra(R.viewDatos, t === "datos");
    muestra(R.viewInforme, t === "informe");
    if (t === "ajuste") requestAnimationFrame(dibuja);
  }

  function wire() {
    R.tabAjuste.addEventListener("click", () => setTab("ajuste"));
    R.tabDatos.addEventListener("click", () => setTab("datos"));
    R.tabInforme.addEventListener("click", () => setTab("informe"));

    R.btnAbrir.addEventListener("click", () => R.fileIn.click());
    R.fileIn.addEventListener("change", () => {
      if (R.fileIn.files && R.fileIn.files[0]) abreArchivo(R.fileIn.files[0]);
      R.fileIn.value = "";
    });
    R.btnPegarIr.addEventListener("click", () => { setTab("datos"); R.datosTexto.focus(); });
    R.selEjemplo.addEventListener("change", () => {
      if (R.selEjemplo.value) cargaEjemplo(R.selEjemplo.value);
    });
    R.btnAplicarTexto.addEventListener("click", () => {
      const t = parseTabla(R.datosTexto.value || "");
      if (t.error) { R.statusLeft.textContent = "⚠ " + t.error; return; }
      ponDatos({ cols: t.cols, n: t.n, nombre: "escritos a mano" }, null);
      R.selEjemplo.value = "";
    });
    R.btnTodos.addEventListener("click", () => { S.usar = S.usar.map(() => true); aplica(); });
    R.btnNinguno.addEventListener("click", () => { S.usar = S.usar.map(() => false); aplica(); });

    R.selX.addEventListener("change", () => { S.mapa.x = +R.selX.value; escribeCampos(); aplica(true); });
    R.selY.addEventListener("change", () => { S.mapa.y = +R.selY.value; escribeCampos(); aplica(true); });
    R.selSy.addEventListener("change", () => { leeSigma(R.selSy, S.sy); escribeCampos(); aplica(); });
    R.selSx.addEventListener("change", () => { leeSigma(R.selSx, S.sx); escribeCampos(); aplica(); });
    campoNumero(R.syValIn, (v) => { S.sy.valor = v; aplica(); });
    campoNumero(R.sxValIn, (v) => { S.sx.valor = v; aplica(); });

    R.selModelo.addEventListener("change", () => {
      S.modeloId = R.selModelo.value;
      escribeCampos();
      aplica(true);
    });
    campoNumero(R.gradoIn, (v) => { S.grado = clamp(Math.round(v), 1, 12); aplica(true); });
    /* La fórmula libre se relee al soltar la tecla, pero sólo cambia el modelo
       cuando de verdad compila: mientras se escribe «a*exp(» el modelo anterior
       sigue en pie en lugar de parpadear un error por cada letra. */
    let tFormula = null;
    R.libreIn.addEventListener("input", () => {
      clearTimeout(tFormula);
      tFormula = setTimeout(() => {
        S.formula = R.libreIn.value;
        aplica(true);
      }, 350);
    });
    R.libreIn.addEventListener("change", () => { S.formula = R.libreIn.value; aplica(true); });

    R.btnSemillas.addEventListener("click", () => aplica(true));
    R.btnAjustar.addEventListener("click", () => aplica());
    R.chkAuto.addEventListener("change", () => { S.auto = R.chkAuto.checked; });

    R.selEscX.addEventListener("change", () => { S.vista.escX = R.selEscX.value; dibuja(); });
    R.selEscY.addEventListener("change", () => { S.vista.escY = R.selEscY.value; dibuja(); });
    R.chkBanda.addEventListener("change", () => { S.vista.banda = R.chkBanda.checked; dibuja(); });
    R.chkNorm.addEventListener("change", () => { S.vista.norm = R.chkNorm.checked; dibuja(); });

    R.selFormato.addEventListener("change", () => { S.formato = R.selFormato.value; pintaTex(); });
    R.chkTablaDatos.addEventListener("change", () => { S.conTablaDatos = R.chkTablaDatos.checked; pintaTex(); });
    R.btnCopiaTex.addEventListener("click", () => copia(generaTex(), "Informe copiado: pégalo en el .tex."));
    R.btnTex.addEventListener("click", () => descarga("ajuste.tex", generaTex()));

    R.btnCsv.addEventListener("click", exportaCSV);
    R.btnSvg.addEventListener("click", () => {
      if (!S.D) return;
      descarga("ajuste.svg", figuraSVG(), "image/svg+xml");
      R.statusLeft.textContent = "SVG en milímetros: ábrelo en ColabDraw (📥 o arrastrándolo al lienzo).";
    });
    R.btnPng.addEventListener("click", () => {
      if (!S.D) return;
      figuraPNG(300).toBlob(b => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = "ajuste.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      });
      R.statusLeft.textContent = "PNG a 300 ppp, del tamaño de la figura (160 mm de ancho).";
    });

    const añadeDerivada = () => {
      const t = R.derivIn.value.trim();
      if (!t) return;
      S.derivadas.push(t);
      R.derivIn.value = "";
      pintaDerivadas();
      pintaTex();
    };
    R.btnDeriv.addEventListener("click", añadeDerivada);
    R.derivIn.addEventListener("keydown", (e) => { if (e.key === "Enter") añadeDerivada(); });

    // --- ratón sobre la gráfica
    R.plotWrap.addEventListener("mousemove", (e) => {
      const r = R.plotCanvas.getBoundingClientRect();
      const i = puntoCerca(e.clientX - r.left, e.clientY - r.top);
      if (i !== S.hover) { S.hover = i; dibujaHover(); }
      R.plotWrap.style.cursor = i >= 0 ? "pointer" : "default";
    });
    R.plotWrap.addEventListener("mouseleave", () => { S.hover = -1; dibujaHover(); });
    R.plotWrap.addEventListener("click", (e) => {
      const r = R.plotCanvas.getBoundingClientRect();
      const i = puntoCerca(e.clientX - r.left, e.clientY - r.top);
      if (i < 0 || !S.D) return;
      S.usar[S.D.idx[i]] = !S.D.usar[i];
      aplica();
    });
    // --- soltar un archivo encima
    ["dragenter", "dragover"].forEach(t => R.plotWrap.addEventListener(t, (e) => {
      e.preventDefault();
      R.plotWrap.classList.add("soltar");
    }));
    ["dragleave", "drop"].forEach(t => R.plotWrap.addEventListener(t, (e) => {
      e.preventDefault();
      R.plotWrap.classList.remove("soltar");
    }));
    R.plotWrap.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { abreArchivo(f); setTab("ajuste"); }
    });

    window.addEventListener("resize", () => { CV.plot.w = 0; CV.res.w = 0; dibuja(); });
  }
  /* Un campo numérico que acepta «1k» y «2.5m», avisa en rojo cuando no lo es
     y no dispara nada mientras esté mal escrito. */
  function campoNumero(el, alCambiar) {
    const leer = () => {
      const v = parseSI(el.value);
      if (v === null) { el.classList.add("mal"); return; }
      el.classList.remove("mal");
      alCambiar(v);
    };
    el.addEventListener("change", leer);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") leer(); });
  }

  // ============================================================
  //  20. Estilo
  // ============================================================
  function injectCSS() {
    const css = `
    .aju{height:100vh;display:flex;flex-direction:column;background:var(--chassis);color:var(--text);font-family:"IBM Plex Sans",sans-serif;overflow:hidden}
    .aju .body{flex:1;display:grid;grid-template-columns:286px 1fr 292px;min-height:0}
    .aju .grow{flex:1;min-width:0}
    .aju .push{margin-left:auto}
    .aju .sep{width:1px;height:18px;background:var(--line);flex-shrink:0}
    .aju ::-webkit-scrollbar{width:9px;height:9px}
    .aju ::-webkit-scrollbar-thumb{background:var(--line);border-radius:5px}
    .aju ::-webkit-scrollbar-thumb:hover{background:var(--dim)}
    .aju ::-webkit-scrollbar-track{background:transparent}

    .aju .hdr{display:flex;align-items:center;gap:11px;height:52px;padding:0 14px;flex-shrink:0;background:linear-gradient(180deg,var(--panel),var(--panel2));border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--shadow-1)}
    .aju .home{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--dim);font-size:14px;text-decoration:none;flex-shrink:0}
    .aju .home:hover{border-color:var(--accent);color:var(--accent)}
    .aju .brand{display:flex;align-items:center;gap:8px;flex-shrink:0}
    .aju .pwr{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok);flex-shrink:0}
    .aju .mark{font-weight:700;font-size:14.5px;letter-spacing:.07em}
    .aju .model{font-size:10px;color:var(--dim);letter-spacing:.04em;white-space:nowrap}
    .aju .tools{display:flex;align-items:center;gap:6px;flex-shrink:0}
    @media (max-width:1460px){.aju .model{display:none}}

    .aju .btn{height:28px;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:linear-gradient(180deg,var(--panel),var(--panel2));color:var(--text);font:600 11.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 1px 0 var(--shadow-1),inset 0 1px 0 var(--sheen)}
    .aju .btn:hover{border-color:var(--accent);color:var(--accent)}
    .aju .btn:active{transform:translateY(1px);box-shadow:none}
    .aju .btn:disabled{opacity:.4;cursor:default;border-color:var(--line);color:var(--dim)}
    .aju .btn.xs{height:22px;padding:0 9px;font-size:10.5px}
    .aju .btn.key{flex:1;height:25px;padding:0 6px;font-size:10.5px}

    .aju .tabs{display:flex;gap:3px;padding:3px;margin:0 auto;background:var(--panel2);border:1px solid var(--line);border-radius:8px}
    .aju .tab{height:26px;padding:0 18px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dim);font:600 11.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap}
    .aju .tab:hover{color:var(--text)}
    .aju .tab.on{background:var(--panel);border-color:var(--line);color:var(--accent);box-shadow:0 1px 3px var(--shadow-1)}

    .aju .side{background:var(--panel2);border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;overflow-y:auto}
    .aju .side.r{border-right:none;border-left:1px solid var(--line)}
    .aju .grp{display:flex;flex-direction:column;gap:7px;padding:11px 12px;border-bottom:1px solid var(--line)}
    .aju .grp.accent{background:var(--accent-a1);box-shadow:inset 3px 0 0 var(--accent)}
    .aju .grp.accent .ttl{color:var(--accent)}
    .aju .ttl{margin:0;font:700 10px "IBM Plex Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
    .aju .row{display:flex;align-items:center;gap:8px}
    .aju .row.pad{gap:6px}
    .aju .lab{width:52px;flex-shrink:0;font-size:11px;color:var(--dim)}
    .aju .unit{font:10.5px "IBM Plex Mono",monospace;color:var(--dim);width:26px;flex-shrink:0}
    .aju .chk{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text);cursor:pointer}
    .aju .chk.xs{font-size:10.5px;color:var(--dim);gap:5px}
    .aju .chk.xs:hover{color:var(--text)}
    .aju .hint{font-size:10.5px;color:var(--dim);line-height:1.5}
    .aju .warn{font-size:10.5px;color:var(--bad);line-height:1.5;background:var(--bad-a);border-radius:5px;padding:6px 8px}
    .aju .readout{background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:7px 9px;font:10.5px "IBM Plex Mono",monospace;color:var(--text);white-space:pre-wrap;line-height:1.6}
    .aju .readout:empty{display:none}

    .aju .rdo2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden}
    .aju .rdo2 .cell{background:var(--panel);padding:7px 10px;min-width:0}
    .aju .rdo2 .k{font:700 9px "IBM Plex Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
    .aju .rdo2 .v{font:600 21px "IBM Plex Mono",monospace;line-height:1.25;color:var(--accent)}
    .aju .rdo2 .v.alt{color:var(--ok)}

    .aju .in{height:26px;padding:0 8px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--text);font:11px "IBM Plex Sans",sans-serif;min-width:0;box-sizing:border-box}
    .aju .in.mono{font-family:"IBM Plex Mono",monospace}
    .aju .in:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-a2);outline:none}
    .aju .in.mal{border-color:var(--bad);box-shadow:0 0 0 2px var(--bad-a)}
    .aju .in:disabled{opacity:.45}
    .aju .in.xs{height:22px;padding:0 6px;font-size:10.5px}
    .aju select.in{cursor:pointer}
    .aju .ta{width:100%;height:calc(100% - 34px);min-height:120px;resize:none;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--screen);color:var(--text);font:11.5px/1.6 "IBM Plex Mono",monospace}
    .aju .ta:focus{border-color:var(--accent);outline:none}

    .aju .center{display:flex;flex-direction:column;min-width:0;min-height:0;padding:10px;overflow:hidden}
    .aju .view{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}
    .aju .view.datos{flex-direction:row}
    .aju .w380{width:380px;flex-shrink:0}
    .aju .bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;padding:6px 9px;background:var(--panel);border:1px solid var(--line);border-radius:7px}
    .aju .bl{font:10.5px "IBM Plex Sans",sans-serif;color:var(--dim)}
    .aju .scr{position:relative;flex:1;min-height:120px;border-radius:7px;overflow:hidden;background:var(--screen);border:1px solid var(--line);box-shadow:var(--bezel)}
    .aju .scr>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    .aju .scr.fixed{flex:none}
    .aju .h150{height:150px}
    .aju .scr.soltar{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-a2)}
    .aju .hover{display:none;position:absolute;top:8px;right:8px;margin:0;padding:6px 9px;background:var(--panel);border:1px solid var(--line);border-radius:5px;font:10.5px "IBM Plex Mono",monospace;line-height:1.5;color:var(--text);pointer-events:none;z-index:2;box-shadow:0 4px 14px var(--shadow-2)}

    .aju .card{background:var(--panel);border:1px solid var(--line);border-radius:7px;display:flex;flex-direction:column;overflow:hidden}
    .aju .card.fill{flex:1;min-height:0}
    .aju .card-hd{display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid var(--line);background:var(--panel2);flex-shrink:0}
    .aju .card-bd{flex:1;overflow:auto;min-height:0}
    .aju .card-bd.pad{padding:9px}
    .aju .note-card{padding:8px 11px;font-size:10.5px;color:var(--dim);line-height:1.6;flex-shrink:0;border-top:1px solid var(--line)}
    .aju .tex{margin:0;white-space:pre;font:11.5px/1.65 "IBM Plex Mono",monospace;color:var(--text)}

    .aju .tbl{width:100%;border-collapse:collapse}
    .aju .tbl th{position:sticky;top:0;background:var(--panel2);text-align:left;padding:5px 8px;font:600 9.5px "IBM Plex Sans",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);white-space:nowrap;z-index:1}
    .aju .tbl td{padding:4px 8px;border-bottom:1px solid var(--line);font:11px "IBM Plex Mono",monospace;color:var(--text);white-space:nowrap}
    .aju .tbl td.dim{color:var(--dim);font-size:10px}
    .aju .tbl td.ctr{text-align:center;padding:2px 4px}
    .aju .tbl td.nm{font-family:"IBM Plex Sans",sans-serif;color:var(--dim);width:1%}
    .aju .tbl td.vacio{color:var(--dim);font-family:"IBM Plex Sans",sans-serif;padding:9px;white-space:normal}
    .aju .tbl td.malo{color:var(--bad)}
    .aju .tbl .fila:hover td{background:var(--accent-a1)}
    .aju .tbl .fila.off td{color:var(--dim);opacity:.6}
    .aju .tbl.par td{border-bottom:none;padding:2px 4px}
    .aju .tbl.par th{padding:3px 4px;background:transparent;position:static}
    .aju .tbl.par .celda{width:100%;height:22px}
    .aju .tbl.res td{border-bottom:1px solid var(--line);white-space:normal;line-height:1.5}
    .aju .tbl.res td:first-child{padding-right:4px}
    .aju .tbl.res .ud{color:var(--dim)}
    .aju .tbl.res .rel{color:var(--dim);font-size:9.5px;margin-left:6px}
    .aju .tbl.res .malo{color:var(--bad);font-family:"IBM Plex Sans",sans-serif;font-size:10px;white-space:normal}
    .aju .tbl.corr td{padding:3px 6px;font-size:10px;text-align:right;border-bottom:none}
    .aju .tbl.corr td.diag{color:var(--dim)}
    .aju .tbl.corr td.alto{color:var(--bad);font-weight:600}
    .aju .quita{float:right;width:16px;height:16px;padding:0;border:none;background:transparent;color:var(--dim);cursor:pointer;font-size:13px;line-height:1}
    .aju .quita:hover{color:var(--bad)}

    .aju .stat{display:flex;align-items:center;gap:12px;height:28px;padding:0 14px;flex-shrink:0;background:linear-gradient(180deg,var(--panel2),var(--panel));border-top:1px solid var(--line);font:10.5px "IBM Plex Mono",monospace;color:var(--dim)}
    .aju .stat span:last-child{margin-left:auto;opacity:.75}

    /* Al final, para ganar al display de cualquier clase de maquetación con la
       que se combine. A propósito sin !important: el motor vuelve a encender
       estos elementos con un estilo en línea, que sigue mandando. */
    .aju .hide{display:none}
    `;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  const NOTA_METODO =
    "Mínimos cuadrados con pesos 1/σ². Los modelos lineales en los parámetros " +
    "se resuelven de una vez (ecuaciones normales); los demás, con " +
    "Levenberg-Marquardt y jacobiano numérico. Las incertidumbres salen de la " +
    "matriz de covarianza (JᵀWJ)⁻¹ — con σ medidas, tal cual; sin ellas, " +
    "escalada por χ²/ν. Con σx, se traslada a la y por la pendiente del modelo " +
    "(varianza efectiva).";

  // ============================================================
  //  21. API pública
  // ============================================================
  let lista = false;
  function init(opts) {
    if (lista) { applyOptions(opts); return; }
    Object.assign(S.opts, opts || {});
    REF_IDS.forEach(id => { R[id] = $(id); });
    const faltan = REF_IDS.filter(id => !R[id]);
    if (faltan.length) { console.error("AjusteApp: faltan ids en el DOM:", faltan); return; }
    dpr = Math.max(1, window.devicePixelRatio || 1);
    injectCSS();
    bindCanvas("plot", "plotCanvas", "plotWrap");
    bindCanvas("res", "resCanvas", "resWrap");
    R.notaMetodo.textContent = NOTA_METODO;
    R.chkNorm.checked = true;
    R.chkAuto.checked = true;
    wire();
    setTab("ajuste");
    if (S.opts.formula) S.formula = S.opts.formula;
    /* Primero el ejemplo, que trae SU modelo — la ley de Ohm se lee con una
       recta por el origen, no con una recta cualquiera —, y sólo después la
       propiedad `modelo` si el anfitrión ha pedido uno. Por eso su valor por
       defecto es la cadena vacía: con un modelo por defecto ahí, cualquier
       ejemplo se abriría con el modelo equivocado. */
    const ej = S.opts.ejemplo && EJEMPLOS[S.opts.ejemplo] ? S.opts.ejemplo : "ohm";
    R.selEjemplo.value = ej;
    cargaEjemplo(ej);
    if (S.opts.modelo && MODELOS[S.opts.modelo]) { S.modeloId = S.opts.modelo; escribeCampos(); aplica(true); }
    lista = true;
    window.AjusteApp.ready = true;
  }
  /* Se compara propiedad a propiedad, no el objeto entero: cambiar el modelo
     desde el anfitrión no puede volver a cargar el ejemplo (tirando los datos
     que hubiera), ni cambiar el ejemplo puede dejar el modelo del anterior. */
  function applyOptions(opts) {
    if (!lista || !opts) return;
    const ant = S.opts;
    S.opts = Object.assign({}, ant, opts);
    let hay = false;
    if (opts.ejemplo && opts.ejemplo !== ant.ejemplo && EJEMPLOS[opts.ejemplo]) {
      R.selEjemplo.value = opts.ejemplo;
      cargaEjemplo(opts.ejemplo);
    }
    if (opts.formula && opts.formula !== ant.formula) { S.formula = opts.formula; hay = true; }
    if (opts.modelo && opts.modelo !== ant.modelo && MODELOS[opts.modelo]) { S.modeloId = opts.modelo; hay = true; }
    if (hay) { escribeCampos(); aplica(true); }
  }

  return {
    init: init,
    applyOptions: applyOptions,
    ready: false,
    /* El estado vivo, para depurar desde la consola del navegador y para poder
       comprobar desde fuera que lo dibujado coincide con lo calculado (la
       geometría de la gráfica queda en S.geo). */
    _S: S,
    /* Expuesto para poder ejercitar la matemática desde Node (sin DOM): son
       funciones puras. Con `global.window = {}` delante, este archivo se
       carga en Node y todo esto se puede llamar. */
    _mat: {
      ajusta: ajusta, resuelveModelo: resuelveModelo, MODELOS: MODELOS,
      ajustaLineal: ajustaLineal, ajustaLM: ajustaLM,
      resuelveInversa: resuelveInversa, gammaQ: gammaQ, pDeChi2: pDeChi2,
      compila: compila, evaluaDerivada: evaluaDerivada, sigmaPropagada: sigmaPropagada,
      sigmaCurva: sigmaCurva, parseTabla: parseTabla, parseSI: parseSI,
      redondeaPar: redondeaPar, formateaPar: formateaPar, unidadDe: unidadDe,
      marcasLin: marcasLin, marcasLog: marcasLog, etiquetaEje: etiquetaEje, rangoEje: rangoEje,
      EJEMPLOS: EJEMPLOS
    }
  };
})();
