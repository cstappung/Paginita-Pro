/* Integrodle: las expresiones. Lee lo que escribe la persona («x sin(x) +
   cos x», «(x+1)/(x-1)», «ln|x|», «2/3 (1+e^x)^(3/2)»), lo evalúa en un
   número real y lo pasa a LaTeX para la vista previa. Puro y sin DOM: el
   mismo código decide en la página y en el verificador antitrampas.
   UMD: `IntegralExpr` en la página, `module.exports` en Node.

   Gramática (de menos a más ligado):
     suma     := producto (('+'|'-') producto)*
     producto := unario (('*'|'/') unario | unario-implícito)*
     unario   := ('-'|'+') unario | potencia
     potencia := primario ('^' unario)?            (a la derecha: 2^3^2 = 2^9)
     primario := número | x | e | π | C | (suma) | |suma| | función argumento
   Una función sin paréntesis toma un solo primario con su potencia
   («sin x», «ln x^2» = ln(x²)), y «sin^2 x» es (sin x)²: así se escribe en
   el cuaderno. La multiplicación implícita («2x», «x sin x», «(x+1)(x-1)»)
   tiene la misma fuerza que «*», de modo que «1/2x» es x/2 — la vista
   previa lo muestra antes de enviar. `log` es en base 10 y se ve como
   log₁₀; el logaritmo natural es `ln`. `C` vale 0: escribir «+ C» no
   cambia nada. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.IntegralExpr = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LARGO_MAX = 200;
  /* Las funciones que se conocen, con su evaluación y cómo se ven. */
  const sec = v => 1 / Math.cos(v), csc = v => 1 / Math.sin(v), cot = v => Math.cos(v) / Math.sin(v);
  const FUNC = {
    sin: [Math.sin, "\\sin"], cos: [Math.cos, "\\cos"], tan: [Math.tan, "\\tan"],
    sec: [sec, "\\sec"], csc: [csc, "\\csc"], cot: [cot, "\\cot"],
    arcsin: [Math.asin, "\\arcsin"], arccos: [Math.acos, "\\arccos"], arctan: [Math.atan, "\\arctan"],
    arcsec: [v => Math.acos(1 / v), "\\operatorname{arcsec}"], arccot: [v => Math.PI / 2 - Math.atan(v), "\\operatorname{arccot}"],
    sinh: [Math.sinh, "\\sinh"], cosh: [Math.cosh, "\\cosh"], tanh: [Math.tanh, "\\tanh"],
    arcsinh: [Math.asinh, "\\operatorname{arcsinh}"], arccosh: [Math.acosh, "\\operatorname{arccosh}"], arctanh: [Math.atanh, "\\operatorname{arctanh}"],
    ln: [Math.log, "\\ln"], log: [Math.log10, "\\log_{10}"], exp: [Math.exp, null], sqrt: [Math.sqrt, null], abs: [Math.abs, null]
  };
  /* Otros nombres que se aceptan (lo que se escribe en otros lados). */
  const ALIAS = { sen: "sin", tg: "tan", cosec: "csc", cotg: "cot", ctg: "cot", asin: "arcsin", acos: "arccos", atan: "arctan",
    arcsen: "arcsin", arctg: "arctan", asinh: "arcsinh", acosh: "arccosh", atanh: "arctanh", senh: "sinh", raiz: "sqrt" };
  const CONST = { pi: "pi", e: "e", x: "x", C: "C", c: "C" };
  /* Para cortar «xsinx» en x·sin·x: el nombre más largo que calce primero. */
  const NOMBRES = [...Object.keys(FUNC), ...Object.keys(ALIAS), ...Object.keys(CONST)].sort((a, b) => b.length - a.length);

  /* ---------- los símbolos ---------- */
  function normaliza(s) {
    return String(s == null ? "" : s)
      .replace(/[−–—]/g, "-").replace(/[×·∙⋅]/g, "*").replace(/÷/g, "/")
      .replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/²/g, "^2").replace(/³/g, "^3")
      .replace(/\*\*/g, "^").replace(/[\[{]/g, "(").replace(/[\]}]/g, ")");
  }
  class Fallo extends Error { constructor(m, pos) { super(m); this.pos = pos; } }
  function tokens(s) {
    const t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(\d+(?:[.,]\d*)?|[.,]\d+)/.exec(s.slice(i));
      if (num) { t.push({ k: "n", v: num[1].replace(",", "."), pos: i }); i += num[1].length; continue; }
      if (/[a-zA-Z]/.test(c)) {
        const nombre = NOMBRES.find(n => s.startsWith(n, i));
        if (!nombre) throw new Fallo(`No conozco «${/^[a-zA-Z]+/.exec(s.slice(i))[0]}»`, i);
        const real = ALIAS[nombre] || nombre;
        t.push(FUNC[real] ? { k: "f", v: real, pos: i } : { k: "c", v: CONST[real], pos: i });
        i += nombre.length; continue;
      }
      if ("+-*/^()|".includes(c)) { t.push({ k: c, pos: i }); i++; continue; }
      throw new Fallo(`No sé qué hacer con «${c}»`, i);
    }
    return t;
  }

  /* ---------- el árbol ----------
     {t:"n", v, s} número · {t:"x"} · {t:"c", k:"pi"|"e"|"C"} ·
     {t:"neg", a} · {t:"+"|"-"|"*"|"/"|"^", a, b, imp?} · {t:"f", k, a} */
  function parsea(entrada) {
    const s = normaliza(entrada);
    if (s.length > LARGO_MAX) throw new Fallo("Es demasiado larga", LARGO_MAX);
    const t = tokens(s);
    if (!t.length) throw new Fallo("Está vacía", 0);
    let i = 0, barras = 0;
    const ve = () => t[i], es = k => t[i] && t[i].k === k;
    const fin = () => (t[i] ? t[i].pos : s.length);
    function suma() {
      let a = producto();
      while (es("+") || es("-")) { const op = t[i++].k; a = { t: op, a, b: producto() }; }
      return a;
    }
    /* ¿Empieza aquí algo que se multiplica sin «*»? Una barra solo abre
       si no hay una abierta (si la hay, es la que cierra). */
    const empieza = () => { const x = ve(); return !!x && (x.k === "n" || x.k === "c" || x.k === "f" || x.k === "(" || (x.k === "|" && barras === 0)); };
    function producto() {
      let a = unario();
      for (;;) {
        if (es("*") || es("/")) { const op = t[i++].k; a = { t: op, a, b: unario() }; }
        else if (empieza()) a = { t: "*", a, b: unario(), imp: true };
        else return a;
      }
    }
    function unario() {
      if (es("-")) { i++; return { t: "neg", a: unario() }; }
      if (es("+")) { i++; return unario(); }
      return potencia();
    }
    function potencia() {
      const a = primario();
      if (es("^")) { i++; return { t: "^", a, b: unario() }; }
      return a;
    }
    function primario() {
      const x = ve();
      if (!x) throw new Fallo("Falta algo al final", fin());
      if (x.k === "n") {
        i++;
        if (!Number.isFinite(+x.v)) throw new Fallo("Número ilegible", x.pos);
        return { t: "n", v: +x.v, s: x.v };
      }
      if (x.k === "c") { i++; return x.v === "x" ? { t: "x" } : { t: "c", k: x.v }; }
      if (x.k === "(") {
        i++;
        const a = suma();
        if (!es(")")) throw new Fallo("Falta cerrar un paréntesis", fin());
        i++;
        return a;
      }
      if (x.k === "|") {
        i++; barras++;
        const a = suma();
        if (!es("|")) throw new Fallo("Falta cerrar el valor absoluto", fin());
        i++; barras--;
        return { t: "f", k: "abs", a };
      }
      if (x.k === "f") {
        i++;
        /* «sin^2 x»: la potencia va a la función entera. */
        let pot = null;
        if (es("^")) { i++; pot = unario.call(null); }
        let a;
        if (es("(")) { i++; a = suma(); if (!es(")")) throw new Fallo("Falta cerrar un paréntesis", fin()); i++; }
        else if (es("|") && barras === 0) a = primario();
        else if (t[i] && (t[i].k === "n" || t[i].k === "c" || t[i].k === "f")) {
          /* Sin paréntesis: un solo primario, y su potencia si la trae. */
          a = primario();
          if (es("^")) { i++; a = { t: "^", a, b: unario() }; }
        } else throw new Fallo(`A «${x.v}» le falta su argumento`, fin());
        const f = { t: "f", k: x.v, a };
        return pot ? { t: "^", a: f, b: pot } : f;
      }
      if (x.k === ")") throw new Fallo("Sobra un paréntesis", x.pos);
      if (x.k === "|") throw new Fallo("Sobra una barra", x.pos);
      throw new Fallo(`Falta algo antes de «${x.k}»`, x.pos);
    }
    const arbol = suma();
    if (i < t.length) {
      const x = t[i];
      throw new Fallo(x.k === ")" ? "Sobra un paréntesis" : x.k === "|" ? "Sobra una barra" : `No esperaba «${s.slice(x.pos, x.pos + 6).trim()}» aquí`, x.pos);
    }
    return arbol;
  }
  /* {arbol} o {error, pos}: lo que usa la pantalla para avisar sin lanzar. */
  function lee(s) {
    try { return { arbol: parsea(s) }; }
    catch (e) { if (e instanceof Fallo) return { error: e.message, pos: e.pos }; throw e; }
  }

  /* ---------- evaluar ---------- */
  /* a^b real: con base negativa solo si b es una fracción de denominador
     impar (la raíz cúbica de −8 es −2, como en el cuaderno). */
  function potenciaReal(a, b) {
    if (a >= 0 || Number.isInteger(b)) return Math.pow(a, b);
    for (const q of [3, 5, 7, 9]) {
      const p = b * q, r = Math.round(p);
      if (Math.abs(p - r) < 1e-9) return (r % 2 ? -1 : 1) * Math.pow(-a, b);
    }
    return NaN;
  }
  function evalua(n, x) {
    switch (n.t) {
      case "n": return n.v;
      case "x": return x;
      case "c": return n.k === "pi" ? Math.PI : n.k === "e" ? Math.E : 0;
      case "neg": return -evalua(n.a, x);
      case "+": return evalua(n.a, x) + evalua(n.b, x);
      case "-": return evalua(n.a, x) - evalua(n.b, x);
      case "*": return evalua(n.a, x) * evalua(n.b, x);
      case "/": return evalua(n.a, x) / evalua(n.b, x);
      case "^": return potenciaReal(evalua(n.a, x), evalua(n.b, x));
      case "f": return FUNC[n.k][0](evalua(n.a, x));
    }
    return NaN;
  }
  const usaX = n => n.t === "x" || (n.a ? usaX(n.a) : false) || (n.b ? usaX(n.b) : false);
  /* Los números escritos con decimales, para exigir valores exactos. */
  const decimales = n => (n.t === "n" ? (/\.(\d*)/.exec(n.s) || ["", ""])[1].length : Math.max(n.a ? decimales(n.a) : 0, n.b ? decimales(n.b) : 0));

  /* ---------- a LaTeX ----------
     Precedencias: 1 suma, 2 producto, 3 unario, 4 potencia, 5 átomo. */
  const PREC = { "+": 1, "-": 1, "*": 2, "/": 5, neg: 3, "^": 4, n: 5, x: 5, c: 5, f: 5 };
  const TRIG = /^(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|ln|log)$/;
  const parentesis = s => `\\left(${s}\\right)`;
  function numero(n) { return n.s.replace(/^\./, "0.").replace(/\.$/, ""); }
  /* El argumento de una función: sin paréntesis si es un átomo simple. */
  function argumento(a) {
    if (a.t === "x" || (a.t === "c" && a.k !== "C") || a.t === "n") return " " + latex(a);
    if (a.t === "f" && a.k === "abs") return latex(a);
    return parentesis(latex(a));
  }
  function latex(n) {
    switch (n.t) {
      case "n": return numero(n);
      case "x": return "x";
      case "c": return n.k === "pi" ? "\\pi" : n.k === "e" ? "e" : "C";
      case "neg": {
        const s = latex(n.a);
        return "-" + (PREC[n.a.t] <= 1 || n.a.t === "neg" ? parentesis(s) : s);
      }
      case "+": case "-": {
        const a = latex(n.a);
        /* «a + (−b)» se ve «a − b»; lo de la derecha de un «−» que sea
           suma lleva paréntesis. */
        if (n.t === "+" && n.b.t === "neg") return `${a} - ${lado(n.b.a, 2)}`;
        return `${a} ${n.t} ${n.t === "-" ? lado(n.b, 2) : latex(n.b)}`;
      }
      case "*": {
        const a = lado(n.a, 2, true), b = lado(n.b, 2.5);
        /* Yuxtapuestos salvo que se peguen dos números (2·3) o el de la
           derecha empiece con signo. */
        return /^[-\d.]/.test(b) ? `${a} \\cdot ${b}` : `${a}${/[a-zA-Z]$/.test(a) && /^[a-zA-Z]/.test(b) ? " " : ""}${b}`;
      }
      case "/": return `\\frac{${latex(n.a)}}{${latex(n.b)}}`;
      case "^": {
        const exp = `{${latex(n.b)}}`;
        if (n.a.t === "f" && TRIG.test(n.a.k) && n.a.k !== "log") return `${FUNC[n.a.k][1]}^${exp}${argumento(n.a.a)}`;
        if (n.a.t === "c" && n.a.k === "e") return `e^${exp}`;
        const base = latex(n.a);
        const atomo = (n.a.t === "n" && n.a.v >= 0) || n.a.t === "x" || n.a.t === "c" ||
          (n.a.t === "f" && (n.a.k === "sqrt" || n.a.k === "abs"));
        return `${atomo ? base : parentesis(base)}^${exp}`;
      }
      case "f": {
        if (n.k === "sqrt") return `\\sqrt{${latex(n.a)}}`;
        if (n.k === "abs") return `\\left|${latex(n.a)}\\right|`;
        if (n.k === "exp") return `e^{${latex(n.a)}}`;
        return FUNC[n.k][1] + argumento(n.a);
      }
    }
    return "";
  }
  /* Un hijo con paréntesis si liga menos que `p`. */
  function lado(n, p, izquierda) {
    const s = latex(n);
    if (n.t === "neg" && !izquierda) return parentesis(s);
    return PREC[n.t] < p ? parentesis(s) : s;
  }
  /* La vista previa de algo a medio escribir: lo que se pueda leer, o el
     texto tal cual si todavía no. */
  function vista(s) {
    const r = lee(s);
    return r.arbol ? latex(r.arbol) : null;
  }
  /* Una forma canónica del texto, para no contar dos veces el mismo intento
     escrito con otros espacios. */
  const canonica = s => normaliza(s).replace(/\s+/g, "");

  return { lee, parsea, evalua, latex, vista, usaX, decimales, canonica, normaliza, potenciaReal, FUNC, LARGO_MAX };
});
