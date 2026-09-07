"use strict";
/* ============================================================
   FiltroLab — motor
   Diseña filtros activos a partir de la plantilla de bandas
   (Butterworth / Chebyshev / Bessel): saca el orden mínimo que
   la cumple, reparte los polos en etapas de segundo orden con
   su f0 y su Q, dibuja el Bode del conjunto y — esto es lo que
   no hace el Filter Wizard — pasa una señal de prueba por la
   H(jω) resultante para ver la entrada y la salida en el tiempo
   y en el espectro. Todo en el navegador, sin backend.
   Vistas: Bode (módulo, fase, retardo de grupo), Señal y Etapas.
   ============================================================ */
/* El runtime de los documentos .dc evalúa dos veces los <script> del helmet.
   Sin esta guarda la segunda pasada machacaría window.FiltrosApp con un módulo
   recién nacido y sin inicializar: la aplicación seguiría funcionando (los
   oyentes son de la primera instancia) pero `ready` se quedaría en false para
   siempre y cada applyOptions() del anfitrión caería en una instancia
   conectada a nada. Es la misma guarda que lleva scope-engine.js. */
window.FiltrosApp = window.FiltrosApp || (function () {

  // ============================================================
  //  1. Números y formato
  // ============================================================
  const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
  const SI = [{ e: -12, s: "p" }, { e: -9, s: "n" }, { e: -6, s: "µ" }, { e: -3, s: "m" },
              { e: 0, s: "" }, { e: 3, s: "k" }, { e: 6, s: "M" }, { e: 9, s: "G" }];

  /* Tres cifras significativas y sin ceros de relleno: "1.00 kHz" dice lo mismo
     que "1000.000 Hz" y cabe en un panel de 270 px. */
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
  const fmtHz = (v) => fmt(v, "Hz");
  function num(v, dec) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    return v.toFixed(dec === undefined ? 2 : dec);
  }
  const PREFIJO = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, g: 1e9 };
  /* Acepta "1k", "2.5 k", "20MHz", "500m", "1e3". La letra que decide es la
     primera del sufijo; "50Hz" no lleva prefijo y "1kHz" sí, que es justo lo
     que se teclea sin pensarlo. */
  function parseSI(texto) {
    const m = String(texto).trim().replace(",", ".").match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Zµ]*)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    const suf = m[2];
    const mult = suf.length && PREFIJO[suf[0]] !== undefined ? PREFIJO[suf[0]] : 1;
    const v = n * mult;
    return isFinite(v) ? v : null;
  }
  const aDb = (m) => 20 * Math.log10(Math.max(m, 1e-300));
  const deDb = (d) => Math.pow(10, d / 20);

  // ============================================================
  //  2. Complejos
  // ============================================================
  const cx = (re, im) => ({ re: re, im: im || 0 });
  const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
  const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
  const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  function cdiv(a, b) {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  }
  const cesc = (a, k) => ({ re: a.re * k, im: a.im * k });
  const cabs = (a) => Math.hypot(a.re, a.im);
  const carg = (a) => Math.atan2(a.im, a.re);
  /* Raíz principal. La forma directa (r=|a|, salida en r^(1/2)∠θ/2) pierde
     precisión cuando a es casi real y negativo, que es exactamente el caso del
     discriminante de la transformación a paso banda. */
  function csqrt(a) {
    const r = cabs(a);
    if (r === 0) return cx(0, 0);
    const re = Math.sqrt((r + a.re) / 2);
    const im = Math.sqrt((r - a.re) / 2) * (a.im < 0 ? -1 : 1);
    return cx(re, im);
  }

  // ============================================================
  //  3. Raíces de un polinomio (Durand-Kerner)
  // ============================================================
  /* Sólo lo necesita Bessel: sus polos son las raíces del polinomio inverso de
     Bessel y no hay forma cerrada. Durand-Kerner converge desde cualquier
     arranque que no sea real (por eso el 0.35 de desfase) y aquí basta y sobra:
     los grados son de una o dos cifras. El radio de arranque sale de la cota de
     Cauchy porque esos coeficientes crecen deprisa — en orden 20 el término
     independiente ya vale 3e23 — y arrancar en el círculo unidad haría trabajar
     al método una eternidad antes de acercarse. */
  function raices(coef) {
    const n = coef.length - 1;
    if (n < 1) return [];
    /* Se cambia primero la variable por s = rho·z, con rho la media geometrica
       de los modulos de las raices (|a0/an|^(1/n)). Sin eso, en orden 30 los
       coeficientes de Bessel se estiran por 1e40 y evaluar el polinomio cerca
       de una raiz cancela cuarenta cifras — mas de las que tiene un double, asi
       que Durand-Kerner dejaba de converger y devolvia raices sin sentido (la
       parte real mayor se iba de -4.2 a -1.5). Con las raices en torno al
       circulo unidad el margen de coeficientes baja a seis ordenes y el
       problema desaparece. */
    let rho = 1;
    if (Math.abs(coef[0]) > 0) {
      const g = Math.pow(Math.abs(coef[0] / coef[n]), 1 / n);
      if (isFinite(g) && g > 0) rho = g;
    }
    const a = coef.map((c, k) => c * Math.pow(rho, k) / coef[n]);
    const escN = a[n];
    for (let k = 0; k <= n; k++) a[k] /= escN;
    let R = 0;
    for (let k = 0; k < n; k++) R = Math.max(R, Math.pow(Math.abs(a[k]), 1 / (n - k)));
    R = Math.max(R * 1.15, 1e-6);
    const r = [];
    for (let k = 0; k < n; k++) {
      const th = 2 * Math.PI * k / n + 0.35;
      r.push(cx(R * Math.cos(th), R * Math.sin(th)));
    }
    for (let it = 0; it < 600; it++) {
      let peor = 0;
      for (let i = 0; i < n; i++) {
        let v = cx(a[n], 0);                                  // Horner
        for (let k = n - 1; k >= 0; k--) v = cadd(cmul(v, r[i]), cx(a[k], 0));
        let den = cx(1, 0);
        for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(r[i], r[j]));
        if (cabs(den) < 1e-300) continue;
        const d = cdiv(v, den);
        r[i] = csub(r[i], d);
        peor = Math.max(peor, cabs(d));
      }
      if (peor < 1e-14 * Math.max(1, R)) break;
    }
    return r.map(z => cesc(z, rho));
  }

  // ============================================================
  //  4. Prototipos paso bajo normalizados
  // ============================================================
  const NOMBRE_RESP = { butter: "Butterworth", cheby: "Chebyshev", bessel: "Bessel" };
  const TOPE_ORDEN = 30;
  /* Butterworth y Chebyshev tienen los polos en cerrado y aguantan cualquier
     orden. Bessel los saca de las raíces de un polinomio cuyos coeficientes se
     estiran por 1e40, y a partir de veintitantos el método pierde tantas cifras
     que las parejas conjugadas dejan de serlo — verificado con el retardo de
     grupo en continua, que en un Bessel normalizado a retardo unidad vale 1
     exacto: hasta orden 20 el error es de 1e-8, en 28 ya es de 4e-4. Y de todas
     formas nadie encadena diez etapas de Bessel: si la plantilla pide más, el
     mensaje honesto es que Bessel no es la respuesta adecuada. */
  const TOPE_BESSEL = 20;
  const topeDe = (resp) => resp === "bessel" ? TOPE_BESSEL : TOPE_ORDEN;

  function polosButter(n) {
    const p = [];
    for (let k = 0; k < n; k++) {
      const th = Math.PI / 2 + Math.PI * (2 * k + 1) / (2 * n);
      p.push(cx(Math.cos(th), Math.sin(th)));
    }
    return p;
  }
  function polosCheby(n, rizadoDb) {
    const eps = Math.sqrt(Math.pow(10, rizadoDb / 10) - 1);
    const a = Math.asinh(1 / eps) / n;
    const sh = Math.sinh(a), ch = Math.cosh(a);
    const p = [];
    for (let k = 0; k < n; k++) {
      const th = Math.PI * (2 * k + 1) / (2 * n);
      p.push(cx(-sh * Math.sin(th), ch * Math.cos(th)));
    }
    return p;
  }
  /* Coeficientes del polinomio inverso de Bessel por recurrencia hacia abajo
     desde a_n = 1: a_{k-1} = a_k·k(2n-k+1)/(2(n-k+1)). La fórmula cerrada con
     factoriales dice lo mismo pero pasa por (2n)!, que en orden 25 ya no cabe
     con precisión en un double. */
  const cacheBessel = new Map();
  function polosBessel(n) {
    if (cacheBessel.has(n)) return cacheBessel.get(n);
    const a = new Array(n + 1);
    a[n] = 1;
    for (let k = n; k >= 1; k--) a[k - 1] = a[k] * k * (2 * n - k + 1) / (2 * (n - k + 1));
    const p = simetriza(raices(a));
    cacheBessel.set(n, p);
    return p;
  }
  /* Las raices de un polinomio de coeficientes reales vienen en pares
     conjugados exactos; las que devuelve el metodo numerico lo son sólo hasta
     su ultima cifra. Se promedian aqui, en el origen, y no mas adelante: si se
     normaliza el prototipo con unos polos y luego se simetrizan, la cascada ya
     no es el prototipo que se normalizo y la atenuacion en el borde de la banda
     de paso sale distinta de la pedida — pequeño, pero es un numero que la
     herramienta promete clavado. */
  function simetriza(polos) {
    const usado = new Array(polos.length).fill(false), out = [];
    for (let i = 0; i < polos.length; i++) {
      if (usado[i]) continue;
      const p = polos[i];
      usado[i] = true;
      let j = -1, mejor = Infinity;
      for (let k = 0; k < polos.length; k++) {
        if (k === i || usado[k]) continue;
        const d = Math.hypot(polos[k].re - p.re, polos[k].im + p.im);
        if (d < mejor) { mejor = d; j = k; }
      }
      /* Real sólo si su parte imaginaria es despreciable frente al módulo: la
         raíz real de un polinomio de coeficientes reales sale con un
         imaginario del orden de 1e-16 relativo, nunca de una centésima.
         Decidirlo comparando con la distancia al candidato — que es lo que
         parecía natural — hacía que en orden 30, donde el método ya pierde
         cifras, una pareja conjugada legítima se aplastara en dos polos reales:
         el paso banda perdía su simetría geométrica y se iba 10 dB. */
      if (j < 0 || Math.abs(p.im) < 1e-8 * Math.max(1e-300, cabs(p))) { out.push(cx(p.re, 0)); continue; }
      usado[j] = true;
      const re = (p.re + polos[j].re) / 2, im = (Math.abs(p.im) + Math.abs(polos[j].im)) / 2;
      out.push(cx(re, im));
      out.push(cx(re, -im));
    }
    return out;
  }

  /* H(jw) del prototipo, que es todo polos: G·∏(-p)/∏(jw-p). El G recoge que
     un Chebyshev de orden par no vale 1 en continua sino 1/√(1+ε²) — su rizado
     cuelga hacia abajo desde 0 dB, no hacia arriba. */
  function respProto(polos, G, w) {
    let numr = G, numi = 0, denr = 1, deni = 0;
    for (const p of polos) {
      const nr = numr * (-p.re) - numi * (-p.im);
      numi = numr * (-p.im) + numi * (-p.re);
      numr = nr;
      const dr = denr * (-p.re) - deni * (w - p.im);
      deni = denr * (w - p.im) + deni * (-p.re);
      denr = dr;
    }
    return cdiv(cx(numr, numi), cx(denr, deni));
  }
  const atenProto = (polos, G, w) => -aDb(cabs(respProto(polos, G, w)));

  /* Todos los prototipos salen normalizados a lo mismo: la atenuación en ω=1 es
     exactamente Amax. Así la transformación de frecuencia lleva ω=1 al borde de
     la banda de paso que se pidió y la plantilla se cumple ahí clavada, sea cual
     sea la respuesta. En Chebyshev esa es ya su normalización natural (el borde
     del rizado); en Butterworth sale en cerrado; en Bessel hay que buscarlo. */
  const cacheProto = new Map();
  function prototipo(resp, n, amaxDb) {
    const clave = resp + "|" + n + "|" + amaxDb;
    if (cacheProto.has(clave)) return cacheProto.get(clave);
    const eps = Math.sqrt(Math.pow(10, amaxDb / 10) - 1);
    let out;
    if (resp === "cheby") {
      out = { polos: simetriza(polosCheby(n, amaxDb)), G: (n % 2 === 0) ? 1 / Math.sqrt(1 + eps * eps) : 1, eps: eps };
    } else if (resp === "butter") {
      const esc = Math.pow(Math.pow(10, amaxDb / 10) - 1, -1 / (2 * n));
      out = { polos: simetriza(polosButter(n).map(p => cesc(p, esc))), G: 1, eps: eps };
    } else {
      const base = polosBessel(n);
      let lo = 1e-4, hi = 1e4;                       // la magnitud de Bessel es monótona
      for (let i = 0; i < 120; i++) {
        const mid = Math.sqrt(lo * hi);
        if (atenProto(base, 1, mid) < amaxDb) lo = mid; else hi = mid;
      }
      const wa = Math.sqrt(lo * hi);
      out = { polos: base.map(p => cesc(p, 1 / wa)), G: 1, eps: eps };
    }
    cacheProto.set(clave, out);
    return out;
  }

  /* El orden. Las fórmulas cerradas de Butterworth y Chebyshev son sólo el
     punto de partida: quien decide es la atenuación que de verdad da el
     prototipo ya normalizado en Ωs. Se arranca dos escalones por debajo por si
     el redondeo de la fórmula se pasó, y se sube hasta que cumple — que es
     además el único camino que hay para Bessel, cuya selectividad no tiene
     forma cerrada. */
  function ordenMinimo(resp, Ws, amax, amin) {
    let n = 1;
    if (resp === "butter") {
      n = Math.ceil(Math.log10((Math.pow(10, amin / 10) - 1) / (Math.pow(10, amax / 10) - 1)) / (2 * Math.log10(Ws)));
    } else if (resp === "cheby") {
      n = Math.ceil(Math.acosh(Math.sqrt((Math.pow(10, amin / 10) - 1) / (Math.pow(10, amax / 10) - 1))) / Math.acosh(Ws));
    }
    const tope = topeDe(resp);
    n = isFinite(n) ? clamp(Math.round(n) - 2, 1, tope) : 1;
    for (; n <= tope; n++) {
      const pr = prototipo(resp, n, amax);
      if (atenProto(pr.polos, pr.G, Ws) >= amin - 1e-9) return { n: n, cumple: true };
    }
    return { n: tope, cumple: false };
  }

  // ============================================================
  //  5. Transformación de frecuencia y reparto en etapas
  // ============================================================
  /* Un representante por grupo de polos: el del semiplano superior de cada
     pareja conjugada, y los reales tal cual. Emparejar despues buscando "el mas
     cercano a mi conjugado" funciona en el prototipo, pero en paso banda de
     orden alto los polos se agolpan y la busqueda llega a cruzar dos parejas:
     la etapa resultante ya no es el par que le tocaba y la banda de paso salia
     hasta 10 dB fuera de sitio. Aqui no se busca nada — la estructura la da la
     construccion, y el conjugado se calcula, no se localiza. */
  function representantes(polos) {
    const out = [];
    for (const p of polos) {
      if (Math.abs(p.im) <= 1e-12 * Math.max(1e-300, cabs(p))) out.push(cx(p.re, 0));
      else if (p.im > 0) out.push(p);
    }
    return out;
  }
  const esReal = (p) => p.im === 0;
  const parCon = (z) => [cx(z.re, Math.abs(z.im)), cx(z.re, -Math.abs(z.im))];

  /* Paso bajo: s → s/ωp. Paso alto: s → ωp/s (y aparecen n ceros en el origen).
     Paso banda: s → (s²+ω0²)/(B·s), que duplica el orden — cada polo del
     prototipo se abre en dos — y deja tambien n ceros en el origen. */
  function transforma(proto, sp) {
    const reps = representantes(proto.polos), n = proto.polos.length, grupos = [];
    if (sp.tipo === "lp" || sp.tipo === "hp") {
      const w = 2 * Math.PI * sp.fp;
      for (const r of reps) {
        const z = sp.tipo === "lp" ? cesc(r, w) : cdiv(cx(w, 0), r);
        grupos.push(esReal(r) ? [cx(z.re, 0)] : parCon(z));
      }
      return { grupos: grupos, ceros: sp.tipo === "hp" ? n : 0, n: n };
    }
    const w0 = 2 * Math.PI * Math.sqrt(sp.fp1 * sp.fp2), B = 2 * Math.PI * (sp.fp2 - sp.fp1);
    for (const r of reps) {
      const q = cesc(r, B);
      if (esReal(r)) {
        /* El polo real del prototipo (orden impar). Con una banda estrecha se
           abre en una pareja conjugada; con una banda ancha el discriminante se
           hace positivo y salen dos polos reales — el filtro degenera, con toda
           razon, en un paso alto y un paso bajo en cascada. */
        const d = q.re * q.re - 4 * w0 * w0;
        if (d >= 0) {
          const raiz = Math.sqrt(d);
          grupos.push([cx((q.re + raiz) / 2, 0)]);
          grupos.push([cx((q.re - raiz) / 2, 0)]);
        } else {
          grupos.push(parCon(cx(q.re / 2, Math.sqrt(-d) / 2)));
        }
      } else {
        const disc = csqrt(csub(cmul(q, q), cx(4 * w0 * w0, 0)));
        grupos.push(parCon(cesc(cadd(q, disc), 0.5)));
        grupos.push(parCon(cesc(csub(q, disc), 0.5)));
      }
    }
    return { grupos: grupos, ceros: n, n: n };
  }

  const TITULO_ETAPA = {
    lp1: "Paso bajo · 1.er orden", lp2: "Paso bajo · biquad",
    hp1: "Paso alto · 1.er orden", hp2: "Paso alto · biquad",
    bp2: "Paso banda · biquad"
  };

  /* De cada grupo salen la f0 y la Q que se le piden a la etapa; un polo real
     queda como seccion de primer orden. En paso banda el cero del origen se lo
     queda, de los dos reales, el de menor modulo: es el que hace de paso alto. */
  function reparteEtapas(tr, tipo) {
    const et = tr.grupos.map(g => {
      if (g.length === 1) return { polos: g, wn: Math.abs(g[0].re), Q: null };
      const wn = cabs(g[0]);
      return { polos: g, wn: wn, Q: wn / (2 * Math.abs(g[0].re)) };
    });
    if (tipo === "lp") et.forEach(e => { e.clase = e.Q === null ? "lp1" : "lp2"; e.ceros = 0; });
    else if (tipo === "hp") et.forEach(e => { e.clase = e.Q === null ? "hp1" : "hp2"; e.ceros = e.Q === null ? 1 : 2; });
    else {
      const reales = et.filter(e => e.Q === null).sort((a, b) => a.wn - b.wn);
      reales.forEach((e, k) => { e.clase = k === 0 ? "hp1" : "lp1"; e.ceros = k === 0 ? 1 : 0; });
      et.forEach(e => { if (e.Q !== null) { e.clase = "bp2"; e.ceros = 1; } });
    }
    /* En cascada conviene el orden de Q creciente: la etapa que mas resuena es
       la que antes recorta, y ponerla al final le deja delante una senal ya
       limitada en banda. */
    et.sort((a, b) => (a.Q === null ? -1 : b.Q === null ? 1 : a.Q - b.Q));
    return et;
  }

  function respEtapa(et, f) {
    const w = 2 * Math.PI * f, wn = et.wn;
    if (et.clase === "lp1") return cdiv(cx(wn, 0), cx(wn, w));
    if (et.clase === "hp1") return cdiv(cx(0, w), cx(wn, w));
    const den = cx(wn * wn - w * w, w * wn / et.Q);
    if (et.clase === "lp2") return cdiv(cx(wn * wn, 0), den);
    if (et.clase === "hp2") return cdiv(cx(-w * w, 0), den);
    return cdiv(cx(0, w * wn / et.Q), den);
  }
  /* La fase de una etapa, continua y sin envolver: cada sección se sabe en qué
     rama está (un biquad paso bajo va de 0° a −180°, uno paso alto de +180° a
     0°, uno paso banda de +90° a −90°), así que sumarlas da la fase total
     acumulada del conjunto, sin los saltos de ±360° que mete un atan2 sobre el
     producto. Hace falta para leer el desfase como retardo: medido a partir de
     la FFT, un filtro de orden 4 en su corte daba +180.0° por redondeo — el
     mismo punto que −180°, pero que se lee como que la salida se adelanta a la
     entrada, cosa que un filtro causal no hace. */
  function faseEtapa(et, f) {
    const w = 2 * Math.PI * f, wn = et.wn;
    if (et.clase === "lp1") return -Math.atan2(w, wn);
    if (et.clase === "hp1") return Math.PI / 2 - Math.atan2(w, wn);
    const d = Math.atan2(w * wn / et.Q, wn * wn - w * w);
    if (et.clase === "lp2") return -d;
    if (et.clase === "hp2") return Math.PI - d;
    return Math.PI / 2 - d;
  }
  function faseAcum(dis, f) {
    let ph = 0;
    for (const e of dis.etapas) ph += faseEtapa(e, f);
    return ph;
  }
  function respTotal(dis, f) {
    let h = cx(dis.K, 0);
    for (const e of dis.etapas) h = cmul(h, respEtapa(e, f));
    return h;
  }
  const magDb = (dis, f) => aDb(cabs(respTotal(dis, f)));

  // ============================================================
  //  6. El diseño completo
  // ============================================================
  /* Devuelve siempre un objeto: si la plantilla no tiene sentido viene con
     `error` puesto y sin etapas, y la interfaz lo enseña en vez de dibujar un
     filtro inventado. */
  function diseñar(sp) {
    const avisos = [];
    if (!(sp.amax > 0)) return { error: "La atenuación de la banda de paso tiene que ser mayor que 0 dB." };
    if (!(sp.amin > sp.amax)) return { error: "La atenuación de la banda eliminada tiene que ser mayor que la de la banda de paso." };

    let Ws = null, fRefPaso = 0;
    if (sp.tipo === "lp" || sp.tipo === "hp") {
      if (!(sp.fp > 0) || !(sp.fs > 0)) return { error: "Las frecuencias tienen que ser mayores que cero." };
      if (sp.tipo === "lp" && sp.fs <= sp.fp) return { error: "En un paso bajo, fₛ tiene que estar por encima de fₚ." };
      if (sp.tipo === "hp" && sp.fs >= sp.fp) return { error: "En un paso alto, fₛ tiene que estar por debajo de fₚ." };
      Ws = sp.tipo === "lp" ? sp.fs / sp.fp : sp.fp / sp.fs;
      fRefPaso = sp.fp;
    } else {
      if (!(sp.fp1 > 0) || !(sp.fp2 > sp.fp1)) return { error: "La banda de paso necesita fₚ₁ < fₚ₂, las dos mayores que cero." };
      if (!(sp.fs1 > 0) || sp.fs1 >= sp.fp1) return { error: "fₛ₁ tiene que estar por debajo de fₚ₁." };
      if (!(sp.fs2 > sp.fp2)) return { error: "fₛ₂ tiene que estar por encima de fₚ₂." };
      const f0 = Math.sqrt(sp.fp1 * sp.fp2), BW = sp.fp2 - sp.fp1;
      /* Ω = (f²-f0²)/(BW·f) para cada borde: la transformación es simétrica en
         escala geométrica, así que si la plantilla no lo es manda el borde más
         exigente (el menor de los dos) y el otro sale con margen de sobra. */
      const Wsup = (sp.fs2 * sp.fs2 - f0 * f0) / (BW * sp.fs2);
      const Winf = (f0 * f0 - sp.fs1 * sp.fs1) / (BW * sp.fs1);
      Ws = Math.min(Wsup, Winf);
      fRefPaso = f0;
      if (Math.abs(Wsup - Winf) / Math.max(Wsup, Winf) > 0.02) {
        avisos.push("La plantilla no es simétrica en escala geométrica (f0 = " + fmtHz(f0) +
          "): manda el borde más exigente y el otro queda con margen.");
      }
    }
    if (!(Ws > 1.0000001)) return { error: "Las bandas están demasiado juntas: la de eliminada tiene que quedar fuera de la de paso." };

    // ---- orden ----
    let n, cumpleOrden = true;
    if (sp.ordenAuto) {
      const r = ordenMinimo(sp.resp, Ws, sp.amax, sp.amin);
      n = r.n;
      cumpleOrden = r.cumple;
      if (!r.cumple) {
        avisos.push("Ni con el orden máximo (" + topeDe(sp.resp) + (sp.tipo === "bp" ? " del prototipo, " + 2 * topeDe(sp.resp) + " en total" : "") +
          ") se llega a esta plantilla; se muestra el máximo. En Bessel es lo habitual — cae muy despacio: separa más las bandas o baja la atenuación pedida.");
      }
    } else {
      n = sp.tipo === "bp" ? Math.max(1, Math.round(sp.orden / 2)) : Math.max(1, Math.round(sp.orden));
      const tope = topeDe(sp.resp);
      if (n > tope) avisos.push("Con Bessel el orden se limita a " + tope + ": por encima, los polos ya no se calculan con precisión.");
      n = clamp(n, 1, tope);
    }

    const proto = prototipo(sp.resp, n, sp.amax);
    const tr = transforma(proto, sp);
    const etapas = reparteEtapas(tr, sp.tipo);
    if (!etapas.length) return { error: "No ha salido ninguna etapa; revisa la plantilla." };

    /* La constante que falta. Cada etapa se escribe normalizada (ganancia 1 en
       continua, en el infinito o en su propia f0 según sea paso bajo, alto o
       banda), así que el producto de las etapas es la H(s) buena salvo un
       factor real: en paso bajo y paso alto ese factor es justo el G del
       prototipo, y en paso banda hay que medirlo en el centro, porque la f0 de
       cada biquad no es la del conjunto. Medirlo (en vez de deducirlo) es lo
       que garantiza que el Bode que se dibuja sea el de las etapas que se
       listan, y no el de una fórmula paralela que podría discrepar. */
    let K = proto.G;
    if (sp.tipo === "bp") {
      let prod = cx(1, 0);
      for (const e of etapas) prod = cmul(prod, respEtapa(e, fRefPaso));
      const m = cabs(prod);
      K = m > 0 ? proto.G / m : proto.G;
    }
    const gLineal = deDb(sp.ganancia);
    K *= gLineal;

    const dis = {
      tipo: sp.tipo, resp: sp.resp, n: n, orden: sp.tipo === "bp" ? 2 * n : n,
      etapas: etapas, K: K, G: proto.G, eps: proto.eps, ceros: tr.ceros,
      amax: sp.amax, amin: sp.amin, Ws: Ws, ganancia: sp.ganancia, gNom: gLineal,
      fRefPaso: fRefPaso, sp: sp, avisos: avisos, cumpleOrden: cumpleOrden
    };
    dis.ganEtapa = Math.pow(Math.abs(K), 1 / etapas.length);

    // ---- lo que de verdad consigue ----
    const at = (f) => -(magDb(dis, f) - sp.ganancia);
    if (sp.tipo === "lp" || sp.tipo === "hp") {
      dis.atenPaso = at(sp.fp);
      dis.atenStop = at(sp.fs);
      dis.f3 = buscaAten(dis, 3.0102999566, sp.tipo === "lp" ? sp.fp : sp.fp, sp.tipo === "lp" ? 1 : -1);
    } else {
      dis.atenPaso = Math.max(at(sp.fp1), at(sp.fp2));
      dis.atenStop = Math.min(at(sp.fs1), at(sp.fs2));
      dis.atenStopInf = at(sp.fs1);
      dis.atenStopSup = at(sp.fs2);
      dis.f3lo = buscaAten(dis, 3.0102999566, sp.fp1, -1);
      dis.f3hi = buscaAten(dis, 3.0102999566, sp.fp2, 1);
    }
    if (!sp.ordenAuto && dis.atenStop < sp.amin - 1e-6) {
      avisos.push("Con orden " + dis.orden + " la banda eliminada se queda en " + num(dis.atenStop, 1) +
        " dB, por debajo de los " + num(sp.amin, 1) + " dB pedidos.");
    }
    return dis;
  }

  /* Busca la frecuencia donde la atenuación (medida contra la ganancia nominal
     de la banda de paso) vale `objetivo`. `sentido` dice hacia dónde crece la
     atenuación al alejarse de la banda de paso: +1 hacia arriba (paso bajo,
     borde superior de un paso banda), −1 hacia abajo.
     El truco es trabajar con φ(f) = sentido·atenuación(f), que con eso es
     creciente en f en los dos casos: entonces hay una sola búsqueda — si φ(f0)
     se queda corto el cruce está más arriba y si se pasa está más abajo — y una
     sola bisección, en escala logarítmica. Escrito con dos ramas simétricas
     "a mano", el caso en el que el arranque ya está justo en el objetivo (que
     es el de todos los días: Amax = 3.01 dB) devolvía el borde del intervalo en
     lugar del cruce, y un corte de 1 kHz se anunciaba en 833 Hz. */
  function buscaAten(dis, objetivo, f0, sentido) {
    const fi = (f) => sentido * -(magDb(dis, f) - dis.ganancia);
    const T = sentido * objetivo, paso = 1.15;
    let a, b;
    if (fi(f0) < T) {
      a = f0; b = f0;
      for (let i = 0; i < 250 && fi(b) < T; i++) { a = b; b *= paso; }
      if (fi(b) < T) return null;
    } else {
      b = f0; a = f0;
      for (let i = 0; i < 250 && fi(a) >= T; i++) { b = a; a /= paso; }
      if (fi(a) >= T) return null;
    }
    for (let i = 0; i < 80; i++) {
      const mid = Math.sqrt(a * b);
      if (fi(mid) < T) a = mid; else b = mid;
    }
    return Math.sqrt(a * b);
  }

  // ============================================================
  //  7. Señal de prueba y su paso por el filtro
  // ============================================================
  const N_FFT = 16384;

  /* FFT radix-2 en sitio. Los senos y cosenos se calculan directamente en vez
     de arrastrarlos con la recurrencia del giro: con 16384 puntos la
     recurrencia acumula error visible en el suelo del espectro, y el coste de
     los trigonométricos aquí no se nota porque esto sólo corre cuando cambia la
     señal, no en cada repintado. */
  function fft(re, im, inversa) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const mitad = len >> 1, paso = (inversa ? 2 : -2) * Math.PI / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < mitad; k++) {
          const ang = paso * k, wr = Math.cos(ang), wi = Math.sin(ang);
          const ur = re[i + k], ui = im[i + k];
          const xr = re[i + k + mitad], xi = im[i + k + mitad];
          const vr = xr * wr - xi * wi, vi = xr * wi + xi * wr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + mitad] = ur - vr; im[i + k + mitad] = ui - vi;
        }
      }
    }
    if (inversa) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  /* Una fase en [0,1) por muestra. La triangular lleva la simetría del
     generador de funciones: sube de −1 a +1 en la fracción `sim` del periodo y
     baja en el resto, así que 50 % es un triángulo y 100 % es el diente de
     sierra — que además está como forma propia porque es la que se pide por su
     nombre. La cuadrada con duty distinto de 50 % tiene continua (2·duty−1) y
     se deja tal cual: es lo que sale de un generador, y ver cómo un paso alto
     se la come es justo la gracia. */
  function muestraSenal(s, ph) {
    switch (s.tipo) {
      case "cuad": return ph < s.duty ? 1 : -1;
      case "sierra": return 2 * ph - 1;
      case "tri": {
        const k = clamp(s.sim, 0.002, 0.998);
        return ph < k ? (2 * ph / k - 1) : (1 - 2 * (ph - k) / (1 - k));
      }
      default: return Math.sin(2 * Math.PI * ph);
    }
  }

  /* Régimen permanente: la ventana abarca un número entero de ciclos, así que
     los armónicos caen exactamente en los bins múltiplos de `ciclos` y no hay
     fuga espectral. Cada bin se multiplica por H(jf) — el conjugado en las
     frecuencias negativas, que es lo que mantiene real la salida — y se
     antitransforma. No hay transitorio de arranque, y no lo hay a propósito:
     lo que se quiere ver es la forma de onda ya establecida. */
  function simula(dis, s) {
    const N = N_FFT, M = clamp(Math.round(s.ciclos), 1, 20);
    const f = s.f, T = M / f, fs = N / T;
    const t = new Float64Array(N), x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const ph = (i * M / N) % 1;
      t[i] = i / fs;
      x[i] = s.amp * muestraSenal(s, ph) + s.off;
    }
    const xr = Float64Array.from(x), xi = new Float64Array(N);
    fft(xr, xi, false);
    const espIn = espectro(xr, xi, N);
    const yr = Float64Array.from(xr), yi = Float64Array.from(xi);
    if (dis && !dis.error) {
      for (let k = 0; k <= N / 2; k++) {
        const h = respTotal(dis, k * fs / N);
        const ar = yr[k], ai = yi[k];
        yr[k] = ar * h.re - ai * h.im;
        yi[k] = ar * h.im + ai * h.re;
        if (k > 0 && k < N / 2) {                 // el conjugado, en el bin espejo
          const j = N - k, br = yr[j], bi = yi[j];
          yr[j] = br * h.re + bi * h.im;
          yi[j] = bi * h.re - br * h.im;
        }
      }
      yi[N / 2] = 0;                              // Nyquist real: la salida tiene que serlo
    }
    const espOut = espectro(yr, yi, N);
    const yr2 = Float64Array.from(yr), yi2 = Float64Array.from(yi);
    fft(yr2, yi2, true);
    const y = new Float64Array(N);
    for (let i = 0; i < N; i++) y[i] = yr2[i];

    const sim = {
      N: N, M: M, fs: fs, T: T, t: t, x: x, y: y,
      armIn: armonicos(espIn, M, N), armOut: armonicos(espOut, M, N),
      dcIn: espIn.mag[0], dcOut: espOut.mag[0],
      f: f
    };
    sim.medIn = medidas(x, sim.armIn, sim.dcIn);
    sim.medOut = medidas(y, sim.armOut, sim.dcOut);
    const a1 = sim.armIn[1], b1 = sim.armOut[1];
    if (a1 && b1 && a1.a > 1e-12 && dis && !dis.error) {
      sim.ganFund = aDb(b1.a / a1.a);           // medida sobre la señal, no calculada
      sim.faseFund = faseAcum(dis, f) * 180 / Math.PI;
      sim.retFund = -sim.faseFund / 360 / f;    // retardo de fase
    }
    return sim;
  }
  function espectro(re, im, N) {
    const mag = new Float64Array(N / 2 + 1), fase = new Float64Array(N / 2 + 1);
    for (let k = 0; k <= N / 2; k++) {
      const m = Math.hypot(re[k], im[k]) / N;
      mag[k] = (k === 0 || k === N / 2) ? m : 2 * m;
      fase[k] = Math.atan2(im[k], re[k]);
    }
    return { mag: mag, fase: fase };
  }
  /* Sólo los bins que son armónicos de verdad (múltiplos de M). Lo demás es
     ruido numérico y dibujarlo sólo llenaría el espectro de pelusa. */
  function armonicos(esp, M, N) {
    const out = [];
    const kmax = Math.floor((N / 2) / M);
    for (let k = 1; k <= kmax; k++) out[k] = { a: esp.mag[k * M], fase: esp.fase[k * M] };
    return out;
  }
  function medidas(v, arm, dc) {
    let mn = Infinity, mx = -Infinity, s = 0, s2 = 0;
    for (let i = 0; i < v.length; i++) {
      const q = v[i];
      if (q < mn) mn = q;
      if (q > mx) mx = q;
      s += q; s2 += q * q;
    }
    const med = s / v.length;
    let h2 = 0;
    for (let k = 2; k < arm.length; k++) if (arm[k]) h2 += arm[k].a * arm[k].a;
    const f1 = arm[1] ? arm[1].a : 0;
    return {
      vpp: mx - mn, vrms: Math.sqrt(s2 / v.length), vmed: med, vmin: mn, vmax: mx,
      thd: f1 > 1e-9 ? Math.sqrt(h2) / f1 : null, dc: dc
    };
  }

  // ============================================================
  //  8. Dibujo: utilidades comunes
  // ============================================================
  const COL = {
    screen: "#05090c", grid1: "#1e323f", grid2: "#3a5a6d", text: "#dfe8f2", dim: "#7d8fa3",
    mag: "#2ea8ff", fase: "#ff9f45", gd: "#a98bff", ent: "#ffd93d", sal: "#3ad6f0",
    mask: "rgba(255,107,107,.13)", maskLine: "rgba(255,107,107,.45)", ok: "#3ddc7f", mal: "#ff6b6b",
    etapa: "#43606f"
  };
  const F_MONO = (px, peso) => (peso || 400) + " " + px + "px 'IBM Plex Mono', monospace";
  const F_SANS = (px, peso) => (peso || 400) + " " + px + "px 'IBM Plex Sans', sans-serif";

  function fondo(g, W, H) {
    g.fillStyle = COL.screen;
    g.fillRect(0, 0, W, H);
  }
  function mensaje(g, W, H, texto, color) {
    fondo(g, W, H);
    g.fillStyle = color || COL.dim;
    g.font = F_SANS(12.5);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const palabras = String(texto).split(" ");
    const lineas = [];
    let ln = "";
    for (const p of palabras) {
      const pr = ln ? ln + " " + p : p;
      if (g.measureText(pr).width > W - 60 && ln) { lineas.push(ln); ln = p; } else ln = pr;
    }
    if (ln) lineas.push(ln);
    lineas.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lineas.length - 1) / 2) * 17));
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }
  const xLog = (R, f, f0, f1) => R.x0 + (Math.log10(f) - Math.log10(f0)) / (Math.log10(f1) - Math.log10(f0)) * (R.x1 - R.x0);
  const fDeX = (R, x, f0, f1) => Math.pow(10, Math.log10(f0) + (x - R.x0) / (R.x1 - R.x0) * (Math.log10(f1) - Math.log10(f0)));
  const yLin = (R, v, v0, v1) => R.y1 - (v - v0) / (v1 - v0) * (R.y1 - R.y0);
  const xLin = (R, v, v0, v1) => R.x0 + (v - v0) / (v1 - v0) * (R.x1 - R.x0);

  function marco(g, R) {
    g.strokeStyle = COL.grid2;
    g.lineWidth = 1;
    g.strokeRect(R.x0 + 0.5, R.y0 + 0.5, R.x1 - R.x0, R.y1 - R.y0);
  }
  /* Rejilla logarítmica: raya fuerte y etiqueta en cada década, raya tenue en
     los 2…9 de cada una. Sin las tenues no hay forma de leer dónde cae 3 kHz. */
  function rejillaLog(g, R, f0, f1, etiquetar) {
    const e0 = Math.floor(Math.log10(f0)), e1 = Math.ceil(Math.log10(f1));
    g.font = F_MONO(9.5);
    g.textAlign = "center";
    for (let e = e0; e <= e1; e++) {
      for (let m = 1; m <= 9; m++) {
        const f = m * Math.pow(10, e);
        if (f < f0 * 0.999 || f > f1 * 1.001) continue;
        const x = Math.round(xLog(R, f, f0, f1)) + 0.5;
        g.strokeStyle = m === 1 ? COL.grid2 : COL.grid1;
        g.beginPath();
        g.moveTo(x, R.y0);
        g.lineTo(x, R.y1);
        g.stroke();
        if (etiquetar && (m === 1 || (m === 3 && e1 - e0 <= 3))) {
          g.fillStyle = COL.dim;
          g.fillText(fmtHz(f), x, R.y1 + 13);
        }
      }
    }
    g.textAlign = "left";
  }
  /* Un paso de rejilla "redondo" (1, 2 o 5 por década) que deje del orden de
     `objetivo` divisiones: números legibles en cualquier zoom. */
  function pasoBonito(rango, objetivo) {
    const bruto = rango / Math.max(1, objetivo);
    const e = Math.pow(10, Math.floor(Math.log10(bruto)));
    const n = bruto / e;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * e;
  }
  function rejillaY(g, R, v0, v1, paso, etiqueta) {
    g.font = F_MONO(9.5);
    g.textAlign = "right";
    g.textBaseline = "middle";
    const desde = Math.ceil(v0 / paso) * paso;
    for (let v = desde; v <= v1 + paso * 0.001; v += paso) {
      const y = Math.round(yLin(R, v, v0, v1)) + 0.5;
      g.strokeStyle = Math.abs(v) < paso * 0.001 ? COL.grid2 : COL.grid1;
      g.beginPath();
      g.moveTo(R.x0, y);
      g.lineTo(R.x1, y);
      g.stroke();
      g.fillStyle = COL.dim;
      g.fillText(etiqueta(v), R.x0 - 6, y);
    }
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }
  function titulo(g, R, texto) {
    g.font = F_SANS(10.5, 600);
    g.fillStyle = COL.dim;
    g.fillText(texto, R.x0 + 6, R.y0 + 13);
  }
  function leyenda(g, R, items) {
    g.font = F_SANS(10.5, 600);
    let x = R.x1 - 8;
    for (let i = items.length - 1; i >= 0; i--) {
      const w = g.measureText(items[i].t).width;
      g.fillStyle = items[i].c;
      g.fillText(items[i].t, x - w, R.y0 + 13);
      g.fillRect(x - w - 16, R.y0 + 6, 11, 2.5);
      x -= w + 26;
    }
  }

  // ============================================================
  //  9. Estado
  // ============================================================
  const S = {
    tab: "bode",
    tipo: "lp", resp: "butter",
    fp: 1000, fs: 4000, fp1: 1000, fp2: 10000, fs1: 200, fs2: 50000,
    amax: 3.0103, amin: 40,
    ordenAuto: true, orden: 4, ganancia: 0,
    senal: { tipo: "seno", f: 1000, amp: 1, off: 0, duty: 0.5, sim: 0.5, ciclos: 4 },
    bode: { fmin: null, fmax: null, mascara: true, etapas: false, armonicos: false, retardo: false },
    esp: { ejeX: "lin", ejeY: "db", fmax: null, envolvente: false },
    dis: null, sim: null,
    geo: {}, hover: null, hoverT: null,
    opts: {}
  };

  const $ = (id) => document.getElementById(id);
  let R = {};
  const REF_IDS = [
    "tabBode", "tabSenal", "tabEtapas", "btnPng", "btnExport",
    "segTipo", "segResp", "respNota",
    "rowFp", "fpIn", "rowFpBP", "fp1In", "fp2In", "labAmax", "amaxIn", "hintAmax",
    "rowFs", "fsIn", "rowFsBP", "fs1In", "fs2In", "aminIn",
    "chkOrdenAuto", "ordenIn", "btnOrdenMenos", "btnOrdenMas", "gananciaIn",
    "resOrden", "resEtapas", "resDet", "resAviso",
    "viewBode", "viewSenal", "viewEtapas",
    "bodeFminIn", "bodeFmaxIn", "chkMascara", "chkEtapasBode", "chkArmonicos", "chkRetardo",
    "magWrap", "magCanvas", "bodeHover", "phaseWrap", "phaseCanvas", "gdWrap", "gdCanvas",
    "selEjeX", "selEjeY", "fftMaxIn", "chkEnvolvente",
    "timeWrap", "timeCanvas", "timeHover", "fftWrap", "fftCanvas",
    "etapasBody", "btnCopiar", "pzWrap", "pzCanvas", "etapasNota",
    "selSenal", "freqIn", "ampIn", "offIn", "rowDuty", "dutyIn", "dutyVal",
    "rowSim", "simIn", "simVal", "ciclosIn", "ciclosVal",
    "btnFreqPaso", "btnFreqCorte", "btnFreqStop",
    "medVppIn", "medVppOut", "medRmsIn", "medRmsOut", "medDcIn", "medDcOut",
    "medThdIn", "medThdOut", "medFund", "statusLeft", "statusRight"
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

  // ============================================================
  //  10. Vista Bode
  // ============================================================
  /* El rango del eje: si el usuario no lo fija, una década por debajo y por
     encima de todo lo que importa (bandas y −3 dB), redondeado a décadas
     enteras para que la rejilla caiga en potencias de diez. */
  function rangoF() {
    const b = S.bode;
    let f0 = b.fmin, f1 = b.fmax;
    if (!(f0 > 0) || !(f1 > f0)) {
      const fs = [];
      if (S.tipo === "bp") fs.push(S.fp1, S.fp2, S.fs1, S.fs2);
      else fs.push(S.fp, S.fs);
      if (S.dis && !S.dis.error) {
        [S.dis.f3, S.dis.f3lo, S.dis.f3hi].forEach(v => { if (v) fs.push(v); });
      }
      if (S.bode.armonicos && S.senal.f > 0) fs.push(S.senal.f);
      const validas = fs.filter(v => v > 0);
      const lo = Math.min.apply(null, validas), hi = Math.max.apply(null, validas);
      f0 = b.fmin > 0 ? b.fmin : Math.pow(10, Math.floor(Math.log10(lo)) - 1);
      f1 = b.fmax > f0 ? b.fmax : Math.pow(10, Math.ceil(Math.log10(hi)) + 1);
    }
    return { f0: Math.max(f0, 1e-6), f1: Math.max(f1, f0 * 10) };
  }

  /* Módulo, fase y retardo comparten el barrido: se evalúa H una sola vez por
     columna de píxel y de ahí salen las tres curvas, con la fase ya
     desenrollada (sin eso, cada vuelta de −180° a +180° pinta una pared
     vertical que no existe). */
  function barrido(R2, f0, f1) {
    const n = Math.max(2, Math.round(R2.x1 - R2.x0) + 1);
    const f = new Float64Array(n), mag = new Float64Array(n), fase = new Float64Array(n);
    let prev = 0, vuelta = 0;
    for (let i = 0; i < n; i++) {
      const fr = fDeX(R2, R2.x0 + i, f0, f1);
      const h = respTotal(S.dis, fr);
      f[i] = fr;
      mag[i] = aDb(cabs(h));
      let a = carg(h);
      if (i > 0) {
        while (a + vuelta - prev > Math.PI) vuelta -= 2 * Math.PI;
        while (a + vuelta - prev < -Math.PI) vuelta += 2 * Math.PI;
      }
      fase[i] = a + vuelta;
      prev = fase[i];
    }
    return { n: n, f: f, mag: mag, fase: fase };
  }

  function drawMag() {
    if (!resizeCanvas("mag")) return;
    const c = CV.mag, g = c.ctx, W = c.w, H = c.h;
    if (!S.dis || S.dis.error) { mensaje(g, W, H, S.dis ? S.dis.error : "Sin diseño", COL.mal); return; }
    fondo(g, W, H);
    const R2 = { x0: 58, y0: 10, x1: W - 12, y1: H - 24 };
    const { f0, f1 } = rangoF();
    const b = barrido(R2, f0, f1);

    let vmax = -Infinity, vmin = Infinity;
    for (let i = 0; i < b.n; i++) { if (b.mag[i] > vmax) vmax = b.mag[i]; if (b.mag[i] < vmin) vmin = b.mag[i]; }
    /* El suelo lo fija la plantilla, no la curva: un orden 4 llega a −160 dB en
       dos décadas y encajar eso en la pantalla aplasta contra el techo la parte
       que de verdad se mira. Se enseñan 25 dB por debajo de lo que se pide en la
       banda eliminada, y sólo se baja más si la curva ni siquiera llega ahí. */
    const y1 = Math.ceil((Math.max(vmax, S.ganancia) + 4) / 10) * 10;
    let y0 = Math.floor(Math.max(vmin - 5, S.ganancia - S.amin - 40) / 10) * 10;
    y0 = clamp(y0, y1 - 160, y1 - 30);
    rejillaLog(g, R2, f0, f1, true);
    rejillaY(g, R2, y0, y1, pasoBonito(y1 - y0, 8), v => num(v, 0));

    if (S.bode.mascara) dibujaMascara(g, R2, f0, f1, y0, y1);

    /* El recorte se pone antes de trazar nada: beginPath() para el rectángulo
       de clip borra el camino que hubiera, así que construir la curva primero y
       recortar después dibujaba el propio rectángulo en lugar de la curva. */
    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    if (S.bode.etapas && S.dis.etapas.length > 1) {
      g.strokeStyle = COL.etapa;
      g.lineWidth = 1;
      const gEt = aDb(S.dis.ganEtapa);
      for (const et of S.dis.etapas) {
        g.beginPath();
        for (let i = 0; i < b.n; i++) {
          const v = aDb(cabs(respEtapa(et, b.f[i]))) + gEt;
          const y = clamp(yLin(R2, v, y0, y1), R2.y0 - 400, R2.y1 + 400);
          if (i === 0) g.moveTo(R2.x0 + i, y); else g.lineTo(R2.x0 + i, y);
        }
        g.stroke();
      }
    }
    g.strokeStyle = COL.mag;
    g.lineWidth = 1.8;
    g.beginPath();
    for (let i = 0; i < b.n; i++) {
      const y = clamp(yLin(R2, b.mag[i], y0, y1), R2.y0 - 400, R2.y1 + 400);
      if (i === 0) g.moveTo(R2.x0 + i, y); else g.lineTo(R2.x0 + i, y);
    }
    g.stroke();
    g.restore();

    if (S.bode.armonicos && S.senal.f > 0 && S.sim) dibujaArmonicosBode(g, R2, f0, f1, y0, y1);
    marcaCorte(g, R2, f0, f1, y0, y1);
    marco(g, R2);
    titulo(g, R2, "Módulo |H| (dB)");
    if (S.hover) dibujaCursorBode(g, R2, f0, f1, y0, y1);
    S.geo.mag = { R: R2, f0: f0, f1: f1, y0: y0, y1: y1 };
  }

  function dibujaMascara(g, R2, f0, f1, y0, y1) {
    const gn = S.ganancia;
    const yPaso = yLin(R2, gn - S.amax, y0, y1);
    const yStop = yLin(R2, gn - S.amin, y0, y1);
    const banda = (fa, fb, yA, yB) => {
      const xa = clamp(xLog(R2, Math.max(fa, f0), f0, f1), R2.x0, R2.x1);
      const xb = clamp(xLog(R2, Math.min(fb, f1), f0, f1), R2.x0, R2.x1);
      if (xb <= xa) return;
      const ya = clamp(Math.min(yA, yB), R2.y0, R2.y1), yb = clamp(Math.max(yA, yB), R2.y0, R2.y1);
      g.fillStyle = COL.mask;
      g.fillRect(xa, ya, xb - xa, yb - ya);
      g.strokeStyle = COL.maskLine;
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.beginPath();
      const yBorde = yA < yB ? yb : ya;
      g.moveTo(xa, yBorde);
      g.lineTo(xb, yBorde);
      g.stroke();
      g.setLineDash([]);
    };
    if (S.tipo === "lp") {
      banda(f0, S.fp, yPaso, R2.y1);              // prohibido caer por debajo en la banda de paso
      banda(S.fs, f1, R2.y0, yStop);              // prohibido pasar por encima en la eliminada
    } else if (S.tipo === "hp") {
      banda(S.fp, f1, yPaso, R2.y1);
      banda(f0, S.fs, R2.y0, yStop);
    } else {
      banda(S.fp1, S.fp2, yPaso, R2.y1);
      banda(f0, S.fs1, R2.y0, yStop);
      banda(S.fs2, f1, R2.y0, yStop);
    }
  }

  /* Los armónicos de la señal de prueba sobre la curva: una raya tenue en cada
     k·f y un punto sobre la propia curva. Es la lectura que hace falta para
     decidir un filtro mirando la señal, y no el número de dB sueltos: aquí se
     ve de un vistazo qué armónico sobrevive. */
  function dibujaArmonicosBode(g, R2, f0, f1, y0, y1) {
    const arm = S.sim.armIn, ref = arm[1] ? arm[1].a : 0;
    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    for (let k = 1; k < arm.length && k <= 60; k++) {
      const a = arm[k] ? arm[k].a : 0;
      if (!(a > 1e-9) || (ref > 0 && a < ref * 1e-3)) continue;
      const fr = k * S.senal.f;
      if (fr < f0 || fr > f1) continue;
      const x = xLog(R2, fr, f0, f1);
      g.strokeStyle = k === 1 ? "rgba(255,217,61,.55)" : "rgba(255,217,61,.20)";
      g.lineWidth = k === 1 ? 1.4 : 1;
      g.beginPath();
      g.moveTo(x, R2.y0);
      g.lineTo(x, R2.y1);
      g.stroke();
      const y = yLin(R2, magDb(S.dis, fr), y0, y1);
      g.fillStyle = COL.ent;
      g.beginPath();
      g.arc(x, y, k === 1 ? 3.4 : 2.2, 0, 2 * Math.PI);
      g.fill();
    }
    g.restore();
  }

  function marcaCorte(g, R2, f0, f1, y0, y1) {
    const puntos = [];
    if (S.dis.f3) puntos.push({ f: S.dis.f3, t: "−3 dB" });
    if (S.dis.f3lo) puntos.push({ f: S.dis.f3lo, t: "−3 dB" });
    if (S.dis.f3hi) puntos.push({ f: S.dis.f3hi, t: "−3 dB" });
    g.font = F_MONO(9.5);
    for (const p of puntos) {
      if (p.f < f0 || p.f > f1) continue;
      const x = xLog(R2, p.f, f0, f1), y = yLin(R2, S.ganancia - 3.0103, y0, y1);
      if (y < R2.y0 || y > R2.y1) continue;
      g.strokeStyle = COL.ok;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, 3.5, 0, 2 * Math.PI);
      g.stroke();
      g.fillStyle = COL.ok;
      g.fillText(fmtHz(p.f), x + 6, y - 5);
    }
  }

  function dibujaCursorBode(g, R2, f0, f1, y0, y1) {
    const f = clamp(S.hover, f0, f1);
    const x = xLog(R2, f, f0, f1);
    g.strokeStyle = "rgba(215,230,245,.45)";
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(x, R2.y0);
    g.lineTo(x, R2.y1);
    g.stroke();
    g.setLineDash([]);
    const h = respTotal(S.dis, f);
    const y = yLin(R2, aDb(cabs(h)), y0, y1);
    if (y >= R2.y0 && y <= R2.y1) {
      g.fillStyle = COL.mag;
      g.beginPath();
      g.arc(x, y, 3.5, 0, 2 * Math.PI);
      g.fill();
    }
  }

  function drawFase() {
    if (!resizeCanvas("fase")) return;
    const c = CV.fase, g = c.ctx, W = c.w, H = c.h;
    if (!S.dis || S.dis.error) { mensaje(g, W, H, "—"); return; }
    fondo(g, W, H);
    const R2 = { x0: 58, y0: 10, x1: W - 12, y1: H - 22 };
    const { f0, f1 } = rangoF();
    const b = barrido(R2, f0, f1);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < b.n; i++) {
      const d = b.fase[i] * 180 / Math.PI;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    const y0 = Math.floor((lo - 10) / 45) * 45, y1 = Math.ceil((hi + 10) / 45) * 45;
    rejillaLog(g, R2, f0, f1, true);
    rejillaY(g, R2, y0, y1, pasoBonito(y1 - y0, 5), v => num(v, 0) + "°");
    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    g.strokeStyle = COL.fase;
    g.lineWidth = 1.6;
    g.beginPath();
    for (let i = 0; i < b.n; i++) {
      const y = yLin(R2, b.fase[i] * 180 / Math.PI, y0, y1);
      if (i === 0) g.moveTo(R2.x0 + i, y); else g.lineTo(R2.x0 + i, y);
    }
    g.stroke();
    if (S.hover) {
      const x = xLog(R2, clamp(S.hover, f0, f1), f0, f1);
      g.strokeStyle = "rgba(215,230,245,.35)";
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(x, R2.y0);
      g.lineTo(x, R2.y1);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
    marco(g, R2);
    titulo(g, R2, "Fase");
  }

  function drawGD() {
    if (!resizeCanvas("gd")) return;
    const c = CV.gd, g = c.ctx, W = c.w, H = c.h;
    if (!S.dis || S.dis.error) { mensaje(g, W, H, "—"); return; }
    fondo(g, W, H);
    const R2 = { x0: 58, y0: 10, x1: W - 12, y1: H - 22 };
    const { f0, f1 } = rangoF();
    const b = barrido(R2, f0, f1);
    /* Retardo de grupo = −dφ/dω, por diferencias centradas sobre el mismo
       barrido. Es la razón de ser de Bessel: aquí se ve plano donde las otras
       dos respuestas se disparan cerca del corte. */
    const gd = new Float64Array(b.n);
    for (let i = 0; i < b.n; i++) {
      const a = Math.max(0, i - 1), z = Math.min(b.n - 1, i + 1);
      const dw = 2 * Math.PI * (b.f[z] - b.f[a]);
      gd[i] = dw !== 0 ? -(b.fase[z] - b.fase[a]) / dw : 0;
    }
    let hi = 0;
    for (let i = 0; i < b.n; i++) if (isFinite(gd[i]) && gd[i] > hi) hi = gd[i];
    const y1 = hi > 0 ? hi * 1.15 : 1, y0 = 0;
    rejillaLog(g, R2, f0, f1, true);
    rejillaY(g, R2, y0, y1, pasoBonito(y1 - y0, 4), v => fmt(v, "s", 3));
    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    g.strokeStyle = COL.gd;
    g.lineWidth = 1.6;
    g.beginPath();
    for (let i = 0; i < b.n; i++) {
      const y = yLin(R2, gd[i], y0, y1);
      if (i === 0) g.moveTo(R2.x0 + i, y); else g.lineTo(R2.x0 + i, y);
    }
    g.stroke();
    g.restore();
    marco(g, R2);
    titulo(g, R2, "Retardo de grupo");
  }

  // ============================================================
  //  11. Vista Señal
  // ============================================================
  function drawTiempo() {
    if (!resizeCanvas("tiempo")) return;
    const c = CV.tiempo, g = c.ctx, W = c.w, H = c.h;
    if (!S.sim) { mensaje(g, W, H, "Sin señal"); return; }
    fondo(g, W, H);
    const R2 = { x0: 62, y0: 10, x1: W - 12, y1: H - 24 };
    const sim = S.sim;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < sim.N; i++) {
      if (sim.x[i] < lo) lo = sim.x[i];
      if (sim.x[i] > hi) hi = sim.x[i];
      if (sim.y[i] < lo) lo = sim.y[i];
      if (sim.y[i] > hi) hi = sim.y[i];
    }
    if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1e-12) { lo -= 1; hi += 1; }
    const m = (hi - lo) * 0.08;
    const v0 = lo - m, v1 = hi + m;
    const t1 = sim.T;

    g.font = F_MONO(9.5);
    g.textAlign = "center";
    const pasoT = pasoBonito(t1, 8);
    for (let t = 0; t <= t1 * 1.0001; t += pasoT) {
      const x = Math.round(xLin(R2, t, 0, t1)) + 0.5;
      g.strokeStyle = COL.grid1;
      g.beginPath();
      g.moveTo(x, R2.y0);
      g.lineTo(x, R2.y1);
      g.stroke();
      g.fillStyle = COL.dim;
      g.fillText(fmt(t, "s", 3), x, R2.y1 + 13);
    }
    g.textAlign = "left";
    rejillaY(g, R2, v0, v1, pasoBonito(v1 - v0, 6), v => fmt(v, "V", 3));

    const traza = (v, color, ancho) => {
      g.strokeStyle = color;
      g.lineWidth = ancho;
      g.beginPath();
      const px = Math.max(2, Math.round(R2.x1 - R2.x0));
      /* Decimador min/max: con 16384 muestras en ~800 px, dibujar punto a punto
         cuesta y encima pierde los picos. Por columna se pinta el segmento que
         va del mínimo al máximo de las muestras que caen en ella. */
      for (let i = 0; i < px; i++) {
        const a = Math.floor(i * sim.N / px), z = Math.max(a + 1, Math.floor((i + 1) * sim.N / px));
        let mn = Infinity, mx = -Infinity;
        for (let k = a; k < z && k < sim.N; k++) {
          if (v[k] < mn) mn = v[k];
          if (v[k] > mx) mx = v[k];
        }
        const x = R2.x0 + i;
        const ya = yLin(R2, mx, v0, v1), yb = yLin(R2, mn, v0, v1);
        if (i === 0) g.moveTo(x, ya); else g.lineTo(x, ya);
        if (yb !== ya) g.lineTo(x, yb);
      }
      g.stroke();
    };
    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    traza(sim.x, COL.ent, 1.5);
    traza(sim.y, COL.sal, 1.8);
    if (S.hoverT !== null) {
      const x = clamp(xLin(R2, S.hoverT, 0, t1), R2.x0, R2.x1);
      g.strokeStyle = "rgba(215,230,245,.4)";
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(x, R2.y0);
      g.lineTo(x, R2.y1);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
    marco(g, R2);
    titulo(g, R2, "Tiempo · régimen permanente");
    leyenda(g, R2, [{ t: "Entrada", c: COL.ent }, { t: "Salida", c: COL.sal }]);
    S.geo.tiempo = { R: R2, t1: t1, v0: v0, v1: v1 };
  }

  function drawFFT() {
    if (!resizeCanvas("fft")) return;
    const c = CV.fft, g = c.ctx, W = c.w, H = c.h;
    if (!S.sim) { mensaje(g, W, H, "Sin señal"); return; }
    fondo(g, W, H);
    const R2 = { x0: 62, y0: 10, x1: W - 12, y1: H - 24 };
    const sim = S.sim, f1s = S.senal.f;
    const arm = [];
    let amax = 0;
    for (let k = 1; k < sim.armIn.length; k++) {
      const a = sim.armIn[k] ? sim.armIn[k].a : 0, b = sim.armOut[k] ? sim.armOut[k].a : 0;
      if (a > amax) amax = a;
      if (b > amax) amax = b;
      arm.push({ k: k, f: k * f1s, a: a, b: b });
    }
    if (amax <= 0) amax = 1;
    let fmax = S.esp.fmax;
    if (!(fmax > 0)) {
      /* Hasta el último armónico que valga algo — una centésima del mayor —,
         pero como mucho cuarenta. Una cuadrada tiene armónicos hasta el número
         mil (caen como 1/k, así que el milésimo todavía pasa de una milésima
         del primero) y llevar el eje hasta ahí llenaba la pantalla de una pared
         amarilla sin una sola raya distinguible. Cuarenta armónicos entran
         holgados en el ancho de la ventana y cubren de sobra la zona donde el
         filtro hace algo. El mínimo de ocho es para que una senoidal no salga
         con una única raya pegada al borde izquierdo. */
      let ult = 1;
      for (const h of arm) if (h.a > amax * 0.01 || h.b > amax * 0.01) ult = h.k;
      ult = clamp(ult, 8, 40);
      fmax = Math.min(sim.fs / 2, (ult + 1) * f1s);
    }
    const fmin = S.esp.ejeX === "log" ? f1s / 2 : 0;
    const enDb = S.esp.ejeY === "db";
    const yTop = enDb ? Math.ceil(aDb(amax) / 10) * 10 + 5 : amax * 1.1;
    const yBot = enDb ? yTop - 100 : 0;
    const xDe = (f) => S.esp.ejeX === "log" ? xLog(R2, Math.max(f, fmin), fmin, fmax) : xLin(R2, f, fmin, fmax);
    const yDe = (a) => yLin(R2, enDb ? aDb(a) : a, yBot, yTop);

    if (S.esp.ejeX === "log") rejillaLog(g, R2, fmin, fmax, true);
    else {
      g.font = F_MONO(9.5);
      g.textAlign = "center";
      const paso = pasoBonito(fmax - fmin, 8);
      for (let f = 0; f <= fmax * 1.0001; f += paso) {
        const x = Math.round(xLin(R2, f, fmin, fmax)) + 0.5;
        g.strokeStyle = COL.grid1;
        g.beginPath();
        g.moveTo(x, R2.y0);
        g.lineTo(x, R2.y1);
        g.stroke();
        g.fillStyle = COL.dim;
        g.fillText(fmtHz(f), x, R2.y1 + 13);
      }
      g.textAlign = "left";
    }
    rejillaY(g, R2, yBot, yTop, pasoBonito(yTop - yBot, 6), v => enDb ? num(v, 0) : fmt(v, "V", 3));

    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    const piso = enDb ? deDb(yBot) : 0;
    /* Dos rayas por armónico, entrada y salida, y el par tiene que caber entre
       dos armónicos consecutivos sin tocarse. */
    const sep = Math.abs(xDe(2 * f1s) - xDe(f1s));
    const anchoRaya = clamp(Math.floor(sep / 5), 1, 4);
    const raya = (h, valor, color, dx, ancho) => {
      if (!(valor > piso)) return;
      const x = xDe(h.f) + dx;
      if (x < R2.x0 - 2 || x > R2.x1 + 2) return;
      g.strokeStyle = color;
      g.lineWidth = ancho;
      g.beginPath();
      g.moveTo(x, R2.y1);
      g.lineTo(x, clamp(yDe(valor), R2.y0, R2.y1));
      g.stroke();
    };
    for (const h of arm) {
      if (h.f > fmax * 1.01) break;
      raya(h, h.a, COL.ent, -anchoRaya, anchoRaya * 2);
      raya(h, h.b, COL.sal, anchoRaya, anchoRaya * 2);
    }
    if (S.esp.envolvente) {
      const linea = (campo, color) => {
        g.strokeStyle = color;
        g.lineWidth = 1;
        g.globalAlpha = 0.55;
        g.beginPath();
        let primero = true;
        for (const h of arm) {
          if (h.f > fmax * 1.01) break;
          const v = h[campo];
          if (!(v > piso)) continue;
          const x = xDe(h.f), y = clamp(yDe(v), R2.y0, R2.y1);
          if (primero) { g.moveTo(x, y); primero = false; } else g.lineTo(x, y);
        }
        g.stroke();
        g.globalAlpha = 1;
      };
      linea("a", COL.ent);
      linea("b", COL.sal);
    }
    g.restore();
    marco(g, R2);
    titulo(g, R2, "Espectro · amplitud por armónico" + (enDb ? " (dBV)" : ""));
    leyenda(g, R2, [{ t: "Entrada", c: COL.ent }, { t: "Salida", c: COL.sal }]);
  }

  // ============================================================
  //  12. Vista Etapas
  // ============================================================
  function drawPZ() {
    if (!resizeCanvas("pz")) return;
    const c = CV.pz, g = c.ctx, W = c.w, H = c.h;
    if (!S.dis || S.dis.error) { mensaje(g, W, H, "—"); return; }
    fondo(g, W, H);
    const R2 = { x0: 52, y0: 10, x1: W - 46, y1: H - 24 };
    const polos = [];
    S.dis.etapas.forEach(e => e.polos.forEach(p => polos.push(p)));
    /* Se dibuja en hercios, no en rad/s: son los números que aparecen en la
       tabla de etapas y en el Bode. */
    let sMax = 0, wMax = 0;
    polos.forEach(p => {
      sMax = Math.max(sMax, Math.abs(p.re) / (2 * Math.PI));
      wMax = Math.max(wMax, Math.abs(p.im) / (2 * Math.PI));
    });
    if (!(sMax > 0)) sMax = 1;
    if (!(wMax > 0)) wMax = sMax;
    /* El recuadro se ajusta a lo que hay — un filtro de Q alta tiene los polos
       pegados al eje jω y encuadrar por el módulo los amontonaba en una esquina
       —, pero la escala es la misma en los dos ejes: la Q de un polo es su
       ángulo, y con ejes distintos ese ángulo miente. */
    const anchoDoc = sMax * 1.45, altoDoc = wMax * 2.3;
    const k = Math.min((R2.x1 - R2.x0) / anchoDoc, (R2.y1 - R2.y0) / altoDoc);
    const cx0 = R2.x1 - sMax * 0.35 * k, cy0 = (R2.y0 + R2.y1) / 2;
    const px = (reHz) => cx0 + reHz * k;
    const py = (imHz) => cy0 - imHz * k;
    const vx0 = (R2.x0 - cx0) / k, vx1 = (R2.x1 - cx0) / k;
    const vy1 = (cy0 - R2.y0) / k, vy0 = (cy0 - R2.y1) / k;

    g.font = F_MONO(9);
    const pasoX = pasoBonito(vx1 - vx0, 4), pasoY = pasoBonito(vy1 - vy0, 5);
    g.textAlign = "center";
    for (let v = Math.ceil(vx0 / pasoX) * pasoX; v <= vx1; v += pasoX) {
      const x = Math.round(px(v)) + 0.5;
      g.strokeStyle = Math.abs(v) < pasoX * 0.01 ? COL.grid2 : COL.grid1;
      g.beginPath();
      g.moveTo(x, R2.y0);
      g.lineTo(x, R2.y1);
      g.stroke();
      g.fillStyle = COL.dim;
      g.fillText(fmt(v, "", 3), x, R2.y1 + 13);
    }
    g.textAlign = "left";
    g.textBaseline = "middle";
    for (let v = Math.ceil(vy0 / pasoY) * pasoY; v <= vy1; v += pasoY) {
      const y = Math.round(py(v)) + 0.5;
      g.strokeStyle = Math.abs(v) < pasoY * 0.01 ? COL.grid2 : COL.grid1;
      g.beginPath();
      g.moveTo(R2.x0, y);
      g.lineTo(R2.x1, y);
      g.stroke();
      g.fillStyle = COL.dim;
      g.fillText(fmt(v, "", 3), R2.x1 + 4, y);
    }
    g.textBaseline = "alphabetic";

    g.save();
    g.beginPath();
    g.rect(R2.x0, R2.y0, R2.x1 - R2.x0, R2.y1 - R2.y0);
    g.clip();
    if (S.dis.ceros > 0) {                         // todos en el origen
      g.strokeStyle = COL.ent;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(px(0), py(0), 5, 0, 2 * Math.PI);
      g.stroke();
      g.fillStyle = COL.ent;
      g.font = F_MONO(9.5);
      g.fillText("×" + S.dis.ceros, px(0) + 8, py(0) - 6);
    }
    g.strokeStyle = COL.mag;
    g.lineWidth = 1.8;
    polos.forEach(p => {
      const x = px(p.re / (2 * Math.PI)), y = py(p.im / (2 * Math.PI)), r = 4.5;
      g.beginPath();
      g.moveTo(x - r, y - r);
      g.lineTo(x + r, y + r);
      g.moveTo(x + r, y - r);
      g.lineTo(x - r, y + r);
      g.stroke();
    });
    g.restore();
    marco(g, R2);
    titulo(g, R2, "Polos (×) y ceros (○) · Hz");
  }

  function pintaTablaEtapas() {
    const tb = R.etapasBody;
    tb.innerHTML = "";
    if (!S.dis || S.dis.error) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="7" class="vacio">' + (S.dis ? esc(S.dis.error) : "Sin diseño") + "</td>";
      tb.appendChild(tr);
      R.etapasNota.textContent = "";
      return;
    }
    const gEt = S.dis.ganEtapa;
    S.dis.etapas.forEach((e, i) => {
      const tr = document.createElement("tr");
      tr.className = "fila";
      const pol = e.polos.map(p => "(" + fmt(p.re / (2 * Math.PI), "", 3) + (p.im >= 0 ? " + j" : " − j") +
        fmt(Math.abs(p.im) / (2 * Math.PI), "", 3) + ")").join("  ");
      tr.innerHTML =
        "<td>" + (i + 1) + "</td>" +
        "<td>" + TITULO_ETAPA[e.clase] + "</td>" +
        "<td>" + fmtHz(e.wn / (2 * Math.PI)) + "</td>" +
        "<td>" + (e.Q === null ? "—" : num(e.Q, 3)) + "</td>" +
        "<td>" + num(aDb(gEt), 2) + " dB · ×" + num(gEt, 3) + "</td>" +
        "<td class=\"dim\">" + pol + "</td>" +
        "<td>" + (e.ceros ? e.ceros + " en 0" : "—") + "</td>";
      tb.appendChild(tr);
    });
    const d = S.dis;
    const partes = [];
    partes.push("H(s) = " + num(d.K, 4) + " · " + d.etapas.length + (d.etapas.length === 1 ? " sección" : " secciones en cascada") + ".");
    if (d.tipo === "bp") partes.push("Cada polo del prototipo de orden " + d.n + " se abre en dos, de ahí el orden total " + d.orden + ".");
    if (d.resp === "cheby") {
      partes.push("Chebyshev de orden " + (d.n % 2 ? "impar" : "par") + ": la ganancia en " +
        (d.tipo === "hp" ? "alta frecuencia" : d.tipo === "bp" ? "el centro" : "continua") + " es " +
        num(aDb(d.G) + d.ganancia, 2) + " dB, y el rizado sube desde ahí hasta " + num(d.ganancia, 2) + " dB.");
    }
    partes.push("Las etapas van de menor a mayor Q; la Q más alta al final es lo que más margen de señal deja.");
    R.etapasNota.textContent = partes.join(" ");
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ============================================================
  //  13. Lectura de la interfaz y repintado
  // ============================================================
  function leeCampo(el, actual, min, max) {
    const v = parseSI(el.value);
    if (v === null || !isFinite(v) || (min !== undefined && v < min) || (max !== undefined && v > max)) {
      el.classList.add("mal");
      return actual;
    }
    el.classList.remove("mal");
    return v;
  }
  function leeUI() {
    S.fp = leeCampo(R.fpIn, S.fp, 1e-9);
    S.fs = leeCampo(R.fsIn, S.fs, 1e-9);
    S.fp1 = leeCampo(R.fp1In, S.fp1, 1e-9);
    S.fp2 = leeCampo(R.fp2In, S.fp2, 1e-9);
    S.fs1 = leeCampo(R.fs1In, S.fs1, 1e-9);
    S.fs2 = leeCampo(R.fs2In, S.fs2, 1e-9);
    S.amax = leeCampo(R.amaxIn, S.amax, 0.0001, 30);
    S.amin = leeCampo(R.aminIn, S.amin, 0.01, 300);
    S.ganancia = leeCampo(R.gananciaIn, S.ganancia, -120, 120);
    S.ordenAuto = R.chkOrdenAuto.checked;
    const o = parseInt(R.ordenIn.value, 10);
    if (isFinite(o)) S.orden = clamp(o, 1, TOPE_ORDEN);
    S.bode.fmin = parseSI(R.bodeFminIn.value);
    S.bode.fmax = parseSI(R.bodeFmaxIn.value);
    S.bode.mascara = R.chkMascara.checked;
    S.bode.etapas = R.chkEtapasBode.checked;
    S.bode.armonicos = R.chkArmonicos.checked;
    S.bode.retardo = R.chkRetardo.checked;
    S.esp.ejeX = R.selEjeX.value;
    S.esp.ejeY = R.selEjeY.value;
    S.esp.fmax = parseSI(R.fftMaxIn.value);
    S.esp.envolvente = R.chkEnvolvente.checked;
    const s = S.senal;
    s.tipo = R.selSenal.value;
    s.f = leeCampo(R.freqIn, s.f, 1e-9);
    s.amp = leeCampo(R.ampIn, s.amp, 0);
    s.off = leeCampo(R.offIn, s.off);
    s.duty = clamp(parseInt(R.dutyIn.value, 10) / 100, 0.01, 0.99);
    s.sim = clamp(parseInt(R.simIn.value, 10) / 100, 0, 1);
    s.ciclos = clamp(parseInt(R.ciclosIn.value, 10) || 4, 1, 20);
  }

  function sincronizaUI() {
    R.segTipo.querySelectorAll(".sgb").forEach(b => b.classList.toggle("on", b.dataset.tipo === S.tipo));
    R.segResp.querySelectorAll(".sgb").forEach(b => b.classList.toggle("on", b.dataset.resp === S.resp));
    const bp = S.tipo === "bp";
    R.rowFp.classList.toggle("hide", bp);
    R.rowFpBP.classList.toggle("hide", !bp);
    R.rowFs.classList.toggle("hide", bp);
    R.rowFsBP.classList.toggle("hide", !bp);
    R.labAmax.textContent = S.resp === "cheby" ? "Rizado" : "Aten. máx.";
    R.hintAmax.textContent = S.resp === "cheby"
      ? "En Chebyshev el rizado de la banda de paso y su atenuación máxima son lo mismo: la respuesta ondula entre 0 dB y −este valor."
      : "Atenuación admitida en el borde de la banda de paso. 3.01 dB deja el corte justo en la frecuencia de −3 dB.";
    R.respNota.textContent =
      S.resp === "butter" ? "Plana en la banda de paso, sin rizado. El término medio de siempre."
        : S.resp === "cheby" ? "La caída más rápida para un orden dado, a cambio de rizado en la banda de paso y de una Q alta en la última etapa."
          : "Retardo de grupo plano: no deforma los flancos. A cambio cae mucho más despacio, así que el orden sale más alto.";
    R.ordenIn.disabled = S.ordenAuto;
    R.btnOrdenMas.disabled = S.ordenAuto;
    R.btnOrdenMenos.disabled = S.ordenAuto;
    R.rowDuty.classList.toggle("hide", S.senal.tipo !== "cuad");
    R.rowSim.classList.toggle("hide", S.senal.tipo !== "tri");
    R.dutyVal.textContent = Math.round(S.senal.duty * 100) + " %";
    R.simVal.textContent = Math.round(S.senal.sim * 100) + " %";
    R.ciclosVal.textContent = String(S.senal.ciclos);
    R.gdWrap.classList.toggle("hide", !S.bode.retardo);
  }

  function pintaResultado() {
    const d = S.dis;
    if (!d || d.error) {
      R.resOrden.textContent = "—";
      R.resEtapas.textContent = "—";
      R.resDet.textContent = "";
      R.resAviso.textContent = d ? d.error : "";
      R.resAviso.classList.toggle("hide", !d || !d.error);
      R.statusLeft.textContent = d && d.error ? d.error : "—";
      return;
    }
    R.resOrden.textContent = String(d.orden);
    R.resEtapas.textContent = String(d.etapas.length);
    const l = [];
    l.push("Aten. en la banda de paso: " + num(d.atenPaso, 2) + " dB");
    if (d.tipo === "bp") {
      l.push("Aten. en fₛ₁: " + num(d.atenStopInf, 1) + " dB");
      l.push("Aten. en fₛ₂: " + num(d.atenStopSup, 1) + " dB");
      if (d.f3lo && d.f3hi) {
        l.push("Banda −3 dB: " + fmtHz(d.f3lo) + " … " + fmtHz(d.f3hi));
        l.push("Ancho −3 dB: " + fmtHz(d.f3hi - d.f3lo));
      }
    } else {
      l.push("Aten. en fₛ: " + num(d.atenStop, 1) + " dB (se pedían " + num(d.amin, 1) + ")");
      if (d.f3) l.push("Corte −3 dB: " + fmtHz(d.f3));
    }
    if (d.etapas.length) {
      const qs = d.etapas.filter(e => e.Q !== null).map(e => e.Q);
      if (qs.length) l.push("Q máxima: " + num(Math.max.apply(null, qs), 3));
    }
    l.push("Ganancia por etapa: " + num(aDb(d.ganEtapa), 2) + " dB");
    R.resDet.textContent = l.join("\n");
    const av = d.avisos;
    R.resAviso.textContent = av.join(" ");
    R.resAviso.className = av.length ? "warn" : "warn hide";
    R.statusLeft.textContent = [
      S.tipo === "lp" ? "Paso bajo" : S.tipo === "hp" ? "Paso alto" : "Paso banda",
      NOMBRE_RESP[S.resp],
      "orden " + d.orden,
      d.etapas.length + (d.etapas.length === 1 ? " etapa" : " etapas")
    ].join(" · ");
  }

  function pintaMedidas() {
    const sim = S.sim;
    if (!sim) return;
    const p = (v) => fmt(v, "V", 3);
    R.medVppIn.textContent = p(sim.medIn.vpp);
    R.medVppOut.textContent = p(sim.medOut.vpp);
    R.medRmsIn.textContent = p(sim.medIn.vrms);
    R.medRmsOut.textContent = p(sim.medOut.vrms);
    R.medDcIn.textContent = p(sim.medIn.vmed);
    R.medDcOut.textContent = p(sim.medOut.vmed);
    R.medThdIn.textContent = sim.medIn.thd === null ? "—" : num(sim.medIn.thd * 100, 2) + " %";
    R.medThdOut.textContent = sim.medOut.thd === null ? "—" : num(sim.medOut.thd * 100, 2) + " %";
    const l = [];
    if (sim.ganFund !== undefined) {
      l.push("En f = " + fmtHz(sim.f) + ":");
      l.push("  ganancia " + num(sim.ganFund, 2) + " dB (×" + num(deDb(sim.ganFund), 4) + ")");
      l.push("  desfase " + num(sim.faseFund, 1) + "°  →  " +
        fmt(Math.abs(sim.retFund), "s", 3) + (sim.retFund >= 0 ? " de retardo" : " de adelanto"));
    }
    R.medFund.textContent = l.join("\n");
    R.statusRight.textContent = "fs " + fmt(sim.fs, "S/s", 3) + " · " + sim.N + " puntos · " + sim.M + " ciclos";
  }

  function recalcula() {
    S.dis = diseñar({
      tipo: S.tipo, resp: S.resp, fp: S.fp, fs: S.fs, fp1: S.fp1, fp2: S.fp2,
      fs1: S.fs1, fs2: S.fs2, amax: S.amax, amin: S.amin,
      ordenAuto: S.ordenAuto, orden: S.orden, ganancia: S.ganancia
    });
    if (S.dis && !S.dis.error) {
      if (S.ordenAuto) {
        S.orden = S.dis.orden;
        if (document.activeElement !== R.ordenIn) R.ordenIn.value = String(S.dis.orden);
      } else if (S.dis.orden !== S.orden) {
        /* Un paso banda de orden impar no existe: el propio diseño lo redondea
           al par de arriba y el campo tiene que decir la verdad. */
        S.orden = S.dis.orden;
        if (document.activeElement !== R.ordenIn) R.ordenIn.value = String(S.dis.orden);
      }
    }
    S.sim = simula(S.dis, S.senal);
  }

  function pinta() {
    if (S.tab === "bode") {
      drawMag();
      drawFase();
      if (S.bode.retardo) drawGD();
    } else if (S.tab === "senal") {
      drawTiempo();
      drawFFT();
    } else {
      drawPZ();
      pintaTablaEtapas();
    }
    pintaResultado();
    pintaMedidas();
  }
  function aplica() {
    leeUI();
    sincronizaUI();
    recalcula();
    pinta();
  }

  // ============================================================
  //  14. Pestañas, exportación y cableado
  // ============================================================
  function setTab(tab) {
    S.tab = tab;
    const tabs = { bode: R.tabBode, senal: R.tabSenal, etapas: R.tabEtapas };
    Object.keys(tabs).forEach(k => tabs[k].classList.toggle("on", k === tab));
    R.viewBode.style.display = tab === "bode" ? "flex" : "none";
    R.viewSenal.style.display = tab === "senal" ? "flex" : "none";
    R.viewEtapas.style.display = tab === "etapas" ? "flex" : "none";
    requestAnimationFrame(() => {
      ["mag", "fase", "gd", "tiempo", "fft", "pz"].forEach(k => resizeCanvas(k));
      pinta();
    });
  }

  function descarga(nombre, texto, tipoMime) {
    const blob = new Blob([texto], { type: tipoMime || "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function textoEtapas() {
    if (!S.dis || S.dis.error) return "";
    const l = [["#", "Sección", "f0 (Hz)", "Q", "Ganancia (dB)", "Ceros en 0"].join("\t")];
    S.dis.etapas.forEach((e, i) => l.push([
      i + 1, TITULO_ETAPA[e.clase], (e.wn / (2 * Math.PI)).toPrecision(6),
      e.Q === null ? "" : e.Q.toPrecision(5), aDb(S.dis.ganEtapa).toFixed(3), e.ceros
    ].join("\t")));
    return l.join("\n");
  }

  /* Un único CSV con todo lo que hay en pantalla: la cabecera del diseño, la
     tabla de etapas, el barrido de Bode y las dos señales. Con secciones
     separadas por una línea en blanco, que es lo que cualquier hoja de cálculo
     y cualquier script entiende sin ayuda. */
  function exportaCSV() {
    const d = S.dis;
    if (!d || d.error) return;
    const L = [];
    L.push("# FiltroLab");
    L.push("# tipo," + d.tipo + ",respuesta," + d.resp + ",orden," + d.orden);
    L.push("# banda de paso," + (d.tipo === "bp" ? S.fp1 + "," + S.fp2 : S.fp) + ",Amax_dB," + S.amax);
    L.push("# banda eliminada," + (d.tipo === "bp" ? S.fs1 + "," + S.fs2 : S.fs) + ",Amin_dB," + S.amin);
    L.push("# ganancia_dB," + S.ganancia + ",K," + d.K);
    L.push("");
    L.push("etapa,seccion,f0_Hz,Q,ganancia_dB,ceros_en_0");
    d.etapas.forEach((e, i) => L.push([i + 1, TITULO_ETAPA[e.clase].replace(/,/g, " "),
      (e.wn / (2 * Math.PI)).toPrecision(8), e.Q === null ? "" : e.Q.toPrecision(8),
      aDb(d.ganEtapa).toFixed(4), e.ceros].join(",")));
    L.push("");
    L.push("f_Hz,modulo_dB,fase_grados");
    const { f0, f1 } = rangoF();
    const N = 600;
    for (let i = 0; i <= N; i++) {
      const f = Math.pow(10, Math.log10(f0) + (Math.log10(f1) - Math.log10(f0)) * i / N);
      const h = respTotal(d, f);
      L.push(f.toPrecision(8) + "," + aDb(cabs(h)).toFixed(4) + "," + (carg(h) * 180 / Math.PI).toFixed(3));
    }
    if (S.sim) {
      L.push("");
      L.push("t_s,entrada_V,salida_V");
      const paso = Math.max(1, Math.round(S.sim.N / 2048));
      for (let i = 0; i < S.sim.N; i += paso) {
        L.push(S.sim.t[i].toPrecision(8) + "," + S.sim.x[i].toPrecision(6) + "," + S.sim.y[i].toPrecision(6));
      }
      L.push("");
      L.push("armonico,f_Hz,entrada_V,salida_V,ganancia_dB");
      for (let k = 1; k < S.sim.armIn.length && k <= 200; k++) {
        const a = S.sim.armIn[k] ? S.sim.armIn[k].a : 0, b = S.sim.armOut[k] ? S.sim.armOut[k].a : 0;
        if (a < 1e-9 && b < 1e-9) continue;
        L.push(k + "," + (k * S.senal.f).toPrecision(8) + "," + a.toPrecision(6) + "," + b.toPrecision(6) +
          "," + (a > 0 ? aDb(b / a).toFixed(3) : ""));
      }
    }
    descarga("filtro-" + d.tipo + "-" + d.resp + "-orden" + d.orden + ".csv", L.join("\n"));
  }

  /* PNG de la vista activa. Las vistas tienen dos o tres lienzos apilados, así
     que se componen en uno solo: guardar únicamente el de arriba dejaría fuera
     la fase, que es la mitad de un Bode. */
  function exportaPNG() {
    const claves = S.tab === "bode" ? ["mag", "fase"].concat(S.bode.retardo ? ["gd"] : [])
      : S.tab === "senal" ? ["tiempo", "fft"] : ["pz"];
    const vivos = claves.map(k => CV[k]).filter(c => c && c.w > 0 && c.h > 0);
    if (!vivos.length) return;
    const W = Math.max.apply(null, vivos.map(c => c.w));
    const H = vivos.reduce((s, c) => s + c.h, 0) + (vivos.length - 1) * 8;
    const off = document.createElement("canvas");
    off.width = Math.round(W * dpr);
    off.height = Math.round(H * dpr);
    const g = off.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COL.screen;
    g.fillRect(0, 0, W, H);
    let y = 0;
    vivos.forEach(c => {
      g.drawImage(c.canvas, 0, 0, c.canvas.width, c.canvas.height, 0, y, c.w, c.h);
      y += c.h + 8;
    });
    off.toBlob(b => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "filtrolab-" + S.tab + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  }

  const PRESETS = {
    audio: { tipo: "lp", resp: "butter", fp: 20000, fs: 60000, amax: 0.5, amin: 60, senal: { tipo: "cuad", f: 5000 } },
    red: { tipo: "lp", resp: "bessel", fp: 50, fs: 250, amax: 3.0103, amin: 40, senal: { tipo: "seno", f: 50 } },
    banda: { tipo: "bp", resp: "cheby", fp1: 1000, fp2: 10000, fs1: 200, fs2: 50000, amax: 0.5, amin: 40, senal: { tipo: "cuad", f: 1000 } },
    dc: { tipo: "hp", resp: "butter", fp: 100, fs: 10, amax: 3.0103, amin: 40, senal: { tipo: "cuad", f: 300 } }
  };
  function aplicaPreset(nombre) {
    const p = PRESETS[nombre];
    if (!p) return;
    S.tipo = p.tipo;
    S.resp = p.resp;
    ["fp", "fs", "fp1", "fp2", "fs1", "fs2", "amax", "amin"].forEach(k => { if (p[k] !== undefined) S[k] = p[k]; });
    S.ordenAuto = true;
    R.chkOrdenAuto.checked = true;
    if (p.senal) Object.assign(S.senal, p.senal);
    escribeCampos();
    aplica();
  }
  /* Vuelca el estado a los campos. Lo usan los ejemplos y los botones de
     frecuencia, que cambian S por su cuenta; leeUI() haría justo lo contrario y
     borraría el cambio. */
  function escribeCampos() {
    R.fpIn.value = fmt(S.fp, "", 6).trim();
    R.fsIn.value = fmt(S.fs, "", 6).trim();
    R.fp1In.value = fmt(S.fp1, "", 6).trim();
    R.fp2In.value = fmt(S.fp2, "", 6).trim();
    R.fs1In.value = fmt(S.fs1, "", 6).trim();
    R.fs2In.value = fmt(S.fs2, "", 6).trim();
    R.amaxIn.value = String(+S.amax.toFixed(4));
    R.aminIn.value = String(+S.amin.toFixed(2));
    R.gananciaIn.value = String(+S.ganancia.toFixed(2));
    R.ordenIn.value = String(S.orden);
    R.selSenal.value = S.senal.tipo;
    R.freqIn.value = fmt(S.senal.f, "", 6).trim();
    R.ampIn.value = String(+S.senal.amp.toFixed(4));
    R.offIn.value = String(+S.senal.off.toFixed(4));
    R.dutyIn.value = String(Math.round(S.senal.duty * 100));
    R.simIn.value = String(Math.round(S.senal.sim * 100));
    R.ciclosIn.value = String(S.senal.ciclos);
  }

  function ponFrecuencia(donde) {
    const d = S.dis;
    let f = S.senal.f;
    if (donde === "paso") {
      f = S.tipo === "lp" ? S.fp / 4 : S.tipo === "hp" ? S.fp * 4 : Math.sqrt(S.fp1 * S.fp2);
    } else if (donde === "corte") {
      f = S.tipo === "bp" ? (d && d.f3hi ? d.f3hi : S.fp2) : (d && d.f3 ? d.f3 : S.fp);
    } else {
      f = S.tipo === "lp" ? S.fs : S.tipo === "hp" ? S.fs : S.fs2;
    }
    if (f > 0) {
      S.senal.f = f;
      escribeCampos();
      aplica();
    }
  }

  function wire() {
    R.tabBode.addEventListener("click", () => setTab("bode"));
    R.tabSenal.addEventListener("click", () => setTab("senal"));
    R.tabEtapas.addEventListener("click", () => setTab("etapas"));
    R.btnPng.addEventListener("click", exportaPNG);
    R.btnExport.addEventListener("click", exportaCSV);
    R.btnCopiar.addEventListener("click", () => {
      const t = textoEtapas();
      if (!t) return;
      if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => { /* sin permiso */ });
      R.btnCopiar.textContent = "Copiado";
      setTimeout(() => { R.btnCopiar.textContent = "Copiar tabla"; }, 1200);
    });

    R.segTipo.addEventListener("click", (ev) => {
      const b = ev.target.closest(".sgb");
      if (!b || b.dataset.tipo === S.tipo) return;
      /* Al pasar de paso bajo a paso alto (o al revés) se refleja la banda
         eliminada al otro lado de fp, conservando la selectividad que había
         (fs' = fp²/fs). Sin esto, pulsar «Paso alto» con los valores de un paso
         bajo deja una plantilla imposible — fs por encima de fp — y lo primero
         que ve quien pulsa es un error en rojo, cuando lo que quería era mirar
         el mismo filtro del otro lado. */
      const antes = S.tipo;
      S.tipo = b.dataset.tipo;
      leeUI();
      if ((antes === "lp" && S.tipo === "hp") || (antes === "hp" && S.tipo === "lp")) {
        if (S.fp > 0 && S.fs > 0) {
          S.fs = S.fp * S.fp / S.fs;
          escribeCampos();
        }
      }
      aplica();
    });
    R.segResp.addEventListener("click", (ev) => {
      const b = ev.target.closest(".sgb");
      if (!b) return;
      S.resp = b.dataset.resp;
      aplica();
    });
    document.querySelectorAll("[data-preset]").forEach(b => {
      b.addEventListener("click", () => aplicaPreset(b.dataset.preset));
    });

    /* Los campos de texto confirman al salir o con Intro, no en cada tecla:
       recalcular con "1" a medio escribir "1k" daría un diseño absurdo y el
       aviso rojo parpadeando. */
    ["fpIn", "fsIn", "fp1In", "fp2In", "fs1In", "fs2In", "amaxIn", "aminIn", "gananciaIn",
      "bodeFminIn", "bodeFmaxIn", "fftMaxIn", "freqIn", "ampIn", "offIn"].forEach(id => {
        R[id].addEventListener("change", aplica);
        R[id].addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); aplica(); } });
      });
    R.ordenIn.addEventListener("change", aplica);
    R.ordenIn.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); aplica(); } });
    ["chkOrdenAuto", "chkMascara", "chkEtapasBode", "chkArmonicos", "chkRetardo", "chkEnvolvente"].forEach(id => {
      R[id].addEventListener("change", aplica);
    });
    ["selEjeX", "selEjeY", "selSenal"].forEach(id => R[id].addEventListener("change", aplica));
    ["dutyIn", "simIn", "ciclosIn"].forEach(id => R[id].addEventListener("input", aplica));
    R.btnOrdenMas.addEventListener("click", () => { S.orden = clamp(S.orden + (S.tipo === "bp" ? 2 : 1), 1, TOPE_ORDEN); R.ordenIn.value = String(S.orden); aplica(); });
    R.btnOrdenMenos.addEventListener("click", () => { S.orden = clamp(S.orden - (S.tipo === "bp" ? 2 : 1), 1, TOPE_ORDEN); R.ordenIn.value = String(S.orden); aplica(); });
    R.btnFreqPaso.addEventListener("click", () => ponFrecuencia("paso"));
    R.btnFreqCorte.addEventListener("click", () => ponFrecuencia("corte"));
    R.btnFreqStop.addEventListener("click", () => ponFrecuencia("stop"));

    // ---- cursores ----
    R.magWrap.addEventListener("mousemove", (ev) => {
      const g = S.geo.mag;
      if (!g || !S.dis || S.dis.error) return;
      const r = R.magCanvas.getBoundingClientRect();
      const x = ev.clientX - r.left;
      if (x < g.R.x0 || x > g.R.x1) { ocultaHover(); return; }
      const f = fDeX(g.R, x, g.f0, g.f1);
      S.hover = f;
      const h = respTotal(S.dis, f);
      R.bodeHover.style.display = "block";
      R.bodeHover.textContent =
        "f    " + fmtHz(f) + "\n" +
        "|H|  " + num(aDb(cabs(h)), 2) + " dB  (×" + num(cabs(h), 4) + ")\n" +
        "fase " + num(carg(h) * 180 / Math.PI, 1) + "°";
      drawMag();
      drawFase();
    });
    R.magWrap.addEventListener("mouseleave", ocultaHover);
    R.timeWrap.addEventListener("mousemove", (ev) => {
      const g = S.geo.tiempo;
      if (!g || !S.sim) return;
      const r = R.timeCanvas.getBoundingClientRect();
      const x = ev.clientX - r.left;
      if (x < g.R.x0 || x > g.R.x1) { ocultaHoverT(); return; }
      const t = (x - g.R.x0) / (g.R.x1 - g.R.x0) * g.t1;
      S.hoverT = t;
      const i = clamp(Math.round(t * S.sim.fs), 0, S.sim.N - 1);
      R.timeHover.style.display = "block";
      R.timeHover.textContent =
        "t       " + fmt(t, "s", 4) + "\n" +
        "entrada " + fmt(S.sim.x[i], "V", 4) + "\n" +
        "salida  " + fmt(S.sim.y[i], "V", 4);
      drawTiempo();
    });
    R.timeWrap.addEventListener("mouseleave", ocultaHoverT);

    window.addEventListener("resize", () => {
      ["mag", "fase", "gd", "tiempo", "fft", "pz"].forEach(k => resizeCanvas(k));
      pinta();
    });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        ["mag", "fase", "gd", "tiempo", "fft", "pz"].forEach(k => resizeCanvas(k));
        pinta();
      });
      ro.observe(R.magWrap.parentElement);
    }
  }
  function ocultaHover() {
    if (S.hover === null) return;
    S.hover = null;
    R.bodeHover.style.display = "none";
    drawMag();
    drawFase();
  }
  function ocultaHoverT() {
    if (S.hoverT === null) return;
    S.hoverT = null;
    R.timeHover.style.display = "none";
    drawTiempo();
  }

  // ============================================================
  //  15. CSS
  // ============================================================
  /* Toda la piel del instrumento vive aquí, contra las variables que declara la
     página: un solo sitio decide cómo se ve, y son las mismas variables que usa
     CSV·Scope, así que las dos herramientas se ven hermanas. */
  function injectCSS() {
    const css = `
    .flt{height:100vh;display:flex;flex-direction:column;background:var(--chassis);color:var(--text);font-family:"IBM Plex Sans",sans-serif;overflow:hidden}
    .flt .body{flex:1;display:grid;grid-template-columns:274px 1fr 268px;min-height:0}
    .flt .grow{flex:1;min-width:0}
    .flt .push{margin-left:auto}
    .flt .sep{width:1px;height:18px;background:var(--line);flex-shrink:0}
    .flt ::-webkit-scrollbar{width:9px;height:9px}
    .flt ::-webkit-scrollbar-thumb{background:var(--line);border-radius:5px}
    .flt ::-webkit-scrollbar-thumb:hover{background:var(--dim)}
    .flt ::-webkit-scrollbar-track{background:transparent}

    .flt .hdr{display:flex;align-items:center;gap:11px;height:52px;padding:0 14px;flex-shrink:0;background:linear-gradient(180deg,var(--panel),var(--panel2));border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--shadow-1)}
    .flt .home{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--dim);font-size:14px;text-decoration:none;flex-shrink:0}
    .flt .home:hover{border-color:var(--accent);color:var(--accent)}
    .flt .brand{display:flex;align-items:center;gap:8px;flex-shrink:0}
    .flt .pwr{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok);flex-shrink:0}
    .flt .mark{font-weight:700;font-size:14.5px;letter-spacing:.07em}
    .flt .model{font-size:10px;color:var(--dim);letter-spacing:.04em;white-space:nowrap}
    .flt .tools{display:flex;align-items:center;gap:6px;flex-shrink:0}
    @media (max-width:1400px){.flt .model{display:none}}

    .flt .btn{height:28px;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:linear-gradient(180deg,var(--panel),var(--panel2));color:var(--text);font:600 11.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 1px 0 var(--shadow-1),inset 0 1px 0 var(--sheen)}
    .flt .btn:hover{border-color:var(--accent);color:var(--accent)}
    .flt .btn:active{transform:translateY(1px);box-shadow:none}
    .flt .btn:disabled{opacity:.4;cursor:default;border-color:var(--line);color:var(--dim)}
    .flt .btn.xs{height:22px;padding:0 9px;font-size:10.5px}
    .flt .btn.key{flex:1;height:25px;padding:0 6px;font-size:10.5px}

    .flt .tabs{display:flex;gap:3px;padding:3px;margin:0 auto;background:var(--panel2);border:1px solid var(--line);border-radius:8px}
    .flt .tab{height:26px;padding:0 18px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dim);font:600 11.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap}
    .flt .tab:hover{color:var(--text)}
    .flt .tab.on{background:var(--panel);border-color:var(--line);color:var(--accent);box-shadow:0 1px 3px var(--shadow-1)}

    .flt .side{background:var(--panel2);border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;overflow-y:auto}
    .flt .side.r{border-right:none;border-left:1px solid var(--line)}
    .flt .grp{display:flex;flex-direction:column;gap:7px;padding:11px 12px;border-bottom:1px solid var(--line)}
    .flt .grp.accent{background:var(--accent-a1);box-shadow:inset 3px 0 0 var(--accent)}
    .flt .grp.accent .ttl{color:var(--accent)}
    .flt .ttl{margin:0;font:700 10px "IBM Plex Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
    .flt .row{display:flex;align-items:center;gap:8px}
    .flt .row.pad{gap:6px}
    .flt .lab{width:64px;flex-shrink:0;font-size:11px;color:var(--dim)}
    .flt .unit{font:10.5px "IBM Plex Mono",monospace;color:var(--dim);width:22px;flex-shrink:0}
    .flt .val{font:10.5px "IBM Plex Mono",monospace;color:var(--text);width:38px;text-align:right;flex-shrink:0}
    .flt .chk{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text);cursor:pointer}
    .flt .chk.xs{font-size:10.5px;color:var(--dim);gap:5px}
    .flt .chk.xs:hover{color:var(--text)}
    .flt .hint{font-size:10.5px;color:var(--dim);line-height:1.5}
    .flt .warn{font-size:10.5px;color:var(--bad);line-height:1.5;background:var(--bad-a);border-radius:5px;padding:6px 8px}
    .flt .readout{background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:7px 9px;font:10.5px "IBM Plex Mono",monospace;color:var(--text);white-space:pre-wrap;line-height:1.6}
    .flt .readout:empty{display:none}

    .flt .seg{display:flex;gap:3px;padding:3px;background:var(--panel2);border:1px solid var(--line);border-radius:8px}
    .flt .sgb{flex:1;height:25px;padding:0 4px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dim);font:600 10.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap}
    .flt .sgb:hover{color:var(--text)}
    .flt .sgb.on{background:var(--panel);border-color:var(--line);color:var(--accent);box-shadow:0 1px 3px var(--shadow-1)}

    .flt .rdo2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden}
    .flt .rdo2 .cell{background:var(--panel);padding:7px 10px;min-width:0}
    .flt .rdo2 .k{font:700 9px "IBM Plex Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
    .flt .rdo2 .v{font:600 21px "IBM Plex Mono",monospace;line-height:1.25;color:var(--accent)}
    .flt .rdo2 .v.alt{color:var(--ok)}

    .flt .in{height:26px;padding:0 8px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--text);font:11px "IBM Plex Sans",sans-serif;min-width:0;box-sizing:border-box}
    .flt .in.mono{font-family:"IBM Plex Mono",monospace}
    .flt .in:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-a2);outline:none}
    .flt .in.mal{border-color:var(--bad);box-shadow:0 0 0 2px var(--bad-a)}
    .flt .in:disabled{opacity:.45}
    .flt .in.xs{height:22px;padding:0 6px;font-size:10.5px}
    .flt .in.w74{width:74px;flex:none}
    .flt input[type="range"]{min-width:0}

    .flt .center{display:flex;flex-direction:column;min-width:0;min-height:0;padding:10px;overflow:hidden}
    .flt .view{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}
    .flt .view.etapas{display:flex;flex-direction:row;gap:8px}
    .flt .etapas-rd{display:flex;flex-direction:column;gap:8px;width:340px;flex-shrink:0;min-height:0}
    .flt .etapas-rd .scr{flex:none;height:330px}
    .flt .bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;padding:6px 9px;background:var(--panel);border:1px solid var(--line);border-radius:7px}
    .flt .bl{font:10.5px "IBM Plex Sans",sans-serif;color:var(--dim)}
    .flt .scr{position:relative;flex:1;min-height:120px;border-radius:7px;overflow:hidden;background:var(--screen);border:1px solid var(--line);box-shadow:var(--bezel)}
    .flt .scr>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    .flt .scr.fixed{flex:none}
    .flt .h170{height:170px}
    .flt .h150{height:150px}
    .flt .hover{display:none;position:absolute;top:8px;right:8px;margin:0;padding:6px 9px;background:var(--panel);border:1px solid var(--line);border-radius:5px;font:10.5px "IBM Plex Mono",monospace;line-height:1.5;color:var(--text);pointer-events:none;z-index:2;box-shadow:0 4px 14px var(--shadow-2)}

    .flt .card{background:var(--panel);border:1px solid var(--line);border-radius:7px;display:flex;flex-direction:column;overflow:hidden}
    .flt .card.fill{flex:1;min-height:0}
    .flt .card.scroll{overflow:hidden}
    .flt .card-hd{display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid var(--line);background:var(--panel2);flex-shrink:0}
    .flt .card-bd{flex:1;overflow:auto;min-height:0}
    .flt .note-card{padding:9px 11px;font-size:10.5px;color:var(--dim);line-height:1.6;flex-shrink:0}
    .flt .tbl{width:100%;border-collapse:collapse}
    .flt .tbl th{position:sticky;top:0;background:var(--panel2);text-align:left;padding:5px 8px;font:600 9.5px "IBM Plex Sans",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);white-space:nowrap}
    .flt .tbl td{padding:4px 8px;border-bottom:1px solid var(--line);font:11px "IBM Plex Mono",monospace;color:var(--text);white-space:nowrap}
    .flt .tbl td.dim{color:var(--dim);font-size:10px}
    .flt .tbl td.vacio{color:var(--dim);font-family:"IBM Plex Sans",sans-serif;padding:10px}
    .flt .tbl .fila:hover td{background:var(--accent-a1)}
    .flt .tbl.med td{font-size:10.5px;padding:3px 6px}
    .flt .tbl.med td:first-child{font-family:"IBM Plex Sans",sans-serif;color:var(--dim)}
    .flt .tbl.med th{padding:4px 6px}

    .flt .stat{display:flex;align-items:center;gap:12px;height:28px;padding:0 14px;flex-shrink:0;background:linear-gradient(180deg,var(--panel2),var(--panel));border-top:1px solid var(--line);font:10.5px "IBM Plex Mono",monospace;color:var(--dim)}
    .flt .stat span:last-child{margin-left:auto;opacity:.75}

    /* Al final, para ganar al display de cualquier clase de maquetación con la
       que se combine. A propósito sin !important: el motor vuelve a encender
       estos elementos con un estilo en línea, que sigue mandando. */
    .flt .hide{display:none}
    `;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ============================================================
  //  16. API pública
  // ============================================================
  let lista = false;
  function init(opts) {
    if (lista) { applyOptions(opts); return; }
    Object.assign(S.opts, opts || {});
    REF_IDS.forEach(id => { R[id] = $(id); });
    const faltan = REF_IDS.filter(id => !R[id]);
    if (faltan.length) { console.error("FiltrosApp: faltan ids en el DOM:", faltan); return; }
    dpr = Math.max(1, window.devicePixelRatio || 1);
    injectCSS();
    bindCanvas("mag", "magCanvas", "magWrap");
    bindCanvas("fase", "phaseCanvas", "phaseWrap");
    bindCanvas("gd", "gdCanvas", "gdWrap");
    bindCanvas("tiempo", "timeCanvas", "timeWrap");
    bindCanvas("fft", "fftCanvas", "fftWrap");
    bindCanvas("pz", "pzCanvas", "pzWrap");
    R.chkOrdenAuto.checked = true;
    R.chkMascara.checked = true;
    tomaOpciones(S.opts);
    escribeCampos();
    wire();
    setTab("bode");
    aplica();
    lista = true;
    window.FiltrosApp.ready = true;
  }
  function tomaOpciones(o) {
    if (!o) return;
    if (o.tipo && ["lp", "hp", "bp"].indexOf(o.tipo) >= 0) S.tipo = o.tipo;
    if (o.respuesta && NOMBRE_RESP[o.respuesta]) S.resp = o.respuesta;
    const n = (v, def) => { const x = parseSI(v); return x === null ? def : x; };
    S.fp = n(o.fPaso, S.fp);
    S.fs = n(o.fRechazo, S.fs);
    S.amax = n(o.atenPaso, S.amax);
    S.amin = n(o.atenRechazo, S.amin);
    if (o.senal && ["seno", "tri", "sierra", "cuad"].indexOf(o.senal) >= 0) S.senal.tipo = o.senal;
    S.senal.f = n(o.fSenal, S.senal.f);
  }
  function applyOptions(opts) {
    const antes = JSON.stringify(S.opts);
    Object.assign(S.opts, opts || {});
    if (!lista || JSON.stringify(S.opts) === antes) return;
    tomaOpciones(S.opts);
    escribeCampos();
    aplica();
  }

  return {
    init: init,
    applyOptions: applyOptions,
    ready: false,
    /* El estado vivo, para depurar desde la consola del navegador y para poder
       comprobar desde fuera que lo dibujado coincide con lo calculado (la
       geometría de cada gráfica queda en S.geo). */
    _S: S,
    /* Expuesto para poder ejercitar la matemática desde Node (sin DOM) y para
       depurar desde la consola: son funciones puras. */
    _mat: {
      diseñar: diseñar, prototipo: prototipo, ordenMinimo: ordenMinimo,
      polosBessel: polosBessel, polosButter: polosButter, polosCheby: polosCheby,
      respTotal: respTotal, respEtapa: respEtapa, faseAcum: faseAcum, magDb: magDb, atenProto: atenProto,
      simula: simula, fft: fft, parseSI: parseSI, raices: raices, cabs: cabs
    }
  };
})();
