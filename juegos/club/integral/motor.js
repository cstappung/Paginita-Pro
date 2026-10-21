/* Integrodle: el motor, puro. La integral de cada día, la corrección de un
   intento, los puntos, la racha, la mezcla de lo guardado en dos
   dispositivos y la prueba antitrampas. Sin DOM ni almacenamiento: el
   mismo archivo decide en la página, en tests/integral.test.cjs y en el
   verificador (colabtex/src/juegos/solo/verifica/integral.js).
   UMD: `IntegralMotor` en la página (después de expr.js y datos.js),
   `module.exports` en Node.

   Corregir: una primitiva se acepta si difiere de la del banco en una
   constante en todo el tramo `r` de la ficha (21 puntos; se comparan las
   diferencias, no las derivadas, así que no hay error de derivar
   numéricamente). Cualquier forma vale: ln|x−1| o ln(x−1) en x > 1,
   −arccos o arcsen, con o sin «+ C». Una definida se acepta si da el valor
   exacto (1e-9 relativo) y no lleva decimales de más de tres cifras: el
   valor se escribe exacto, no se calcula con una calculadora. Math.sin y
   compañía pueden diferir en el último bit entre navegadores, y por eso
   las tolerancias son de muchos órdenes por encima de eso. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(require("./expr.js"), require("./datos.js"));
  else raiz.IntegralMotor = fabrica(raiz.IntegralExpr, raiz.IntegralDatos);
})(typeof self !== "undefined" ? self : this, function (X, D) {
  "use strict";

  const MAX_INTENTOS = 6;
  const PUNTOS = [100, 80, 65, 50, 35, 20];
  /* Lo difícil vale más: +10 por estrella sobre la primera, si se acierta. */
  const puntosDe = (n, gano, d) => (gano && n >= 1 && n <= MAX_INTENTOS ? PUNTOS[n - 1] + 10 * ((d || 1) - 1) : 0);
  const ESTRENO = "2026-10-21";

  /* ---------- azar con semilla ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function baraja(lista, rng) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- el día de Chile ---------- */
  const FORMATO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
  const HORA = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  function diaChile(ahora) {
    const p = {};
    for (const x of FORMATO.formatToParts(ahora == null ? new Date() : ahora)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }
  function faltaParaManana(ahora) {
    const d = ahora == null ? new Date() : ahora, p = {};
    for (const x of HORA.formatToParts(d)) p[x.type] = x.value;
    const s = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second);
    return Math.max(0, (86400 - s) * 1000 - (d.getMilliseconds ? d.getMilliseconds() : 0));
  }
  const numeroDia = f => Math.round(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 864e5);
  const deNumero = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const diaAnterior = f => deNumero(numeroDia(f) - 1);
  /* El número de la integral, como el #1547 de Wordle: el 1 es el estreno. */
  const numeroIntegral = f => numeroDia(f) - numeroDia(ESTRENO) + 1;
  const fechaDeNumero = n => deNumero(numeroDia(ESTRENO) + n - 1);
  const esFecha = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && deNumero(numeroDia(f)) === f;

  /* ---------- las fichas ----------
     Lo leído de cada ficha se guarda: el árbol del integrando, el de la
     primitiva, el tramo y los puntos donde se compara. */
  const POR_ID = {};
  for (const q of D.BANCO) POR_ID[q.id] = q;
  const N_PUNTOS = 21;
  const cache = {};
  function prepara(id) {
    if (cache[id]) return cache[id];
    const q = POR_ID[id];
    if (!q) return null;
    const f = X.parsea(q.f), F = X.parsea(q.F);
    const a = X.evalua(X.parsea(q.r[0]), 0), b = X.evalua(X.parsea(q.r[1]), 0);
    const xs = Array.from({ length: N_PUNTOS }, (_, k) => a + (b - a) * (k + 0.4137) / N_PUNTOS);
    const G = xs.map(x => X.evalua(F, x));
    const V = q.def ? X.evalua(X.parsea(q.v), 0) : null;
    return (cache[id] = { q, f, F, a, b, xs, G, V });
  }
  const ficha = id => POR_ID[id] || null;
  const latexIntegrando = id => X.latex(prepara(id).f);
  const latexPrimitiva = id => X.latex(prepara(id).F);
  const latexValor = id => (POR_ID[id].def ? X.latex(X.parsea(POR_ID[id].v)) : null);
  const latexLimites = id => POR_ID[id].r.map(s => X.latex(X.parsea(s)));
  /* La integral entera en LaTeX: ∫ f dx o ∫ₐᵇ f dx. */
  function latexIntegral(id) {
    const q = POR_ID[id], [a, b] = latexLimites(id);
    return `\\int${q.def ? `_{${a}}^{${b}}` : ""} ${latexIntegrando(id)}\\,dx`;
  }

  /* ---------- el día ----------
     Cada vuelta por el banco es una baraja con semilla, así que no se
     repite ninguna hasta que salen todas, y una vuelta no empieza con la
     última de la anterior. OJO: una ficha nueva va al final y con `desde`
     (datos.js), o cambian los objetivos de los días ya jugados. */
  const idsEn = fecha => D.BANCO.filter(q => (!q.desde || q.desde <= fecha) && (!q.hasta || q.hasta >= fecha)).map(q => q.id);
  function vuelta(n, ids) {
    const p = baraja(ids, mulberry32(hash(`integral:${n}`)));
    if (n > 0) {
      const prev = baraja(ids, mulberry32(hash(`integral:${n - 1}`)));
      if (p[0] === prev[prev.length - 1]) [p[0], p[1]] = [p[1], p[0]];
    }
    return p;
  }
  function objetivoDelDia(fecha) {
    const ids = idsEn(fecha), N = ids.length, d = numeroIntegral(fecha) - 1;
    return vuelta(Math.floor(d / N), ids)[((d % N) + N) % N];
  }
  /* La práctica: al azar (de una técnica, si se pide), distinta de la anterior. */
  function objetivoAlAzar(rng, distinto, tecnica) {
    let ids = D.BANCO.filter(q => !tecnica || q.t === tecnica).map(q => q.id).filter(id => id !== distinto);
    if (!ids.length) ids = D.BANCO.map(q => q.id);
    return ids[Math.floor(rng() * ids.length)];
  }

  /* ---------- corregir ----------
     revisa(id, texto) → {error} si no se puede leer o no tiene la forma
     pedida (no cuenta como intento), o {ok, arbol, valor?, dir?}. */
  const cacheRevisa = {};
  function revisa(id, texto) {
    const k = id + "\u0000" + texto;
    if (cacheRevisa[k]) return cacheRevisa[k];
    const r = revisaSin(id, texto);
    if (Object.keys(cacheRevisa).length > 500) for (const x in cacheRevisa) delete cacheRevisa[x];
    return (cacheRevisa[k] = r);
  }
  function revisaSin(id, texto) {
    const P = prepara(id);
    if (!P) return { error: "No existe esa integral" };
    if (typeof texto !== "string" || !texto.trim()) return { error: "Escribe tu respuesta" };
    if (/[\n\r]/.test(texto)) return { error: "Una sola línea" };
    const l = X.lee(texto);
    if (l.error) return { error: l.error, pos: l.pos };
    const arbol = l.arbol;
    if (P.q.def) {
      if (X.usaX(arbol)) return { error: "Es una integral definida: la respuesta es un número, sin x" };
      if (X.decimales(arbol) > 3) return { error: "Escribe el valor exacto (con π, e, ln, raíces o fracciones), no un decimal largo" };
      const v = X.evalua(arbol, 0);
      const ok = Number.isFinite(v) && Math.abs(v - P.V) <= 1e-9 * Math.max(1, Math.abs(P.V));
      return { ok, arbol, valor: v, dir: ok || !Number.isFinite(v) ? 0 : P.V > v ? 1 : -1 };
    }
    if (!X.usaX(arbol)) return { error: "Una primitiva depende de x" };
    let n = 0, ref = null, peor = 0, escala = 1;
    const dif = [];
    for (let k = 0; k < N_PUNTOS; k++) {
      const u = X.evalua(arbol, P.xs[k]), g = P.G[k];
      if (!Number.isFinite(u) || !Number.isFinite(g)) continue;
      n++; dif.push(u - g); escala = Math.max(escala, Math.abs(g), Math.abs(u));
    }
    /* Hasta tres puntos sueltos sin valor (una forma equivalente con un
       polo aislado, como (1 − cos x)/sen x en x = 0); más ya es otra cosa. */
    if (n < N_PUNTOS - 3) return { ok: false, arbol };
    ref = dif.slice().sort((a, b) => a - b)[dif.length >> 1];
    for (const d of dif) peor = Math.max(peor, Math.abs(d - ref));
    return { ok: peor <= 1e-7 * escala, arbol };
  }
  const valida = (id, texto) => !revisa(id, texto).error;
  /* Lo que dejan ver los intentos: terminado, ganado, cuántos fallos. Un
     intento repetido (misma forma escrita) no cuenta: la pantalla no lo
     deja pasar y el verificador lo rechaza. */
  function estado(id, intentos) {
    let fallos = 0;
    for (let k = 0; k < intentos.length; k++) {
      const r = revisa(id, intentos[k]);
      if (r.error) continue;
      if (r.ok) return { fin: true, gano: true, fallos, n: k + 1 };
      fallos++;
      if (fallos >= MAX_INTENTOS) return { fin: true, gano: false, fallos, n: k + 1 };
    }
    return { fin: false, gano: false, fallos, n: intentos.length };
  }
  /* Las curvas para el gráfico de un intento errado: el integrando y la
     derivada de lo escrito (diferencia central), en `m` puntos del tramo. */
  function curvas(id, arbol, m = 80) {
    const P = prepara(id), h = (P.b - P.a) * 1e-5;
    const xs = Array.from({ length: m }, (_, k) => P.a + (P.b - P.a) * k / (m - 1));
    const f = xs.map(x => X.evalua(P.f, x));
    const d = arbol ? xs.map(x => (X.evalua(arbol, x + h) - X.evalua(arbol, x - h)) / (2 * h)) : null;
    return { xs, f, d, a: P.a, b: P.b };
  }
  /* Las pistas que se ven según los fallos: la técnica al primero, el paso
     clave al tercero. */
  const pistas = fallos => ({ tecnica: fallos >= 1, paso: fallos >= 3 });

  /* ---------- lo guardado ----------
     e = { hist: { fecha: [puntos, intentos, ms, ganó, [lo intentado], forma] },
           prog: { fecha, i: [lo intentado], ms, t, u, mc } }
     `hist`, los días terminados (de ahí salen puntos, racha y tiempo);
     `prog`, el de hoy a medias. La forma ({t, u, mc}) es cómo se hizo cada
     intento: `t` lleva por intento [ms visibles desde el anterior, acciones
     de verdad]; `u`, acciones sintéticas; `mc`, las del mando (como
     Electrodle, docs/antitrampas/integral.md). */
  const vacio = () => ({ hist: {}, prog: { fecha: "", i: [], ms: 0 } });
  const entero = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
  const TOPE_DT = 3600000;
  function limpiaForma(f, n) {
    if (!f || typeof f !== "object" || !Array.isArray(f.t) || f.t.length !== n) return null;
    if (!f.t.every(x => Array.isArray(x) && x.length === 2 && x.every(Number.isFinite))) return null;
    return { t: f.t.map(([dt, a]) => [entero(dt, TOPE_DT), entero(a, 100000)]), u: entero(f.u, 100000), mc: entero(f.mc, 100000) };
  }
  const texto = s => typeof s === "string" && s.length <= X.LARGO_MAX && !/[\n\r]/.test(s);
  function limpia(e) {
    const r = vacio();
    if (!e || typeof e !== "object") return r;
    for (const [f, v] of Object.entries(e.hist || {})) {
      if (!esFecha(f) || f < ESTRENO || !Array.isArray(v) || v.length < 5) continue;
      const i = v[4];
      if (!Array.isArray(i) || !i.length || i.length > 60 || !i.every(texto)) continue;
      /* Los puntos y el resultado salen de lo intentado, no de lo guardado. */
      const id = objetivoDelDia(f), s = estado(id, i);
      if (!s.fin || s.n !== i.length) continue;
      const fila = [puntosDe(s.fallos + 1, s.gano, POR_ID[id].d), s.fallos + (s.gano ? 1 : 0), entero(v[2], 86400000), s.gano ? 1 : 0, i.slice()];
      const fm = limpiaForma(v[5], i.length);
      if (fm) fila.push(fm);
      r.hist[f] = fila;
    }
    const p = e.prog;
    if (p && esFecha(p.fecha) && Array.isArray(p.i)) {
      const i = p.i.filter(texto).slice(0, 60);
      r.prog = { fecha: p.fecha, i, ms: entero(p.ms, 86400000) };
      const f = i.length === p.i.length ? limpiaForma(p, i.length) : null;
      if (f) Object.assign(r.prog, f);
    }
    return r;
  }
  /* Dos dispositivos: de lo terminado, cada día una vez (el de más puntos);
     de lo de hoy, el más reciente y, el mismo día, el que lleva más. */
  function mezcla(a, b) {
    a = limpia(a); b = limpia(b);
    const r = vacio();
    for (const f of new Set([...Object.keys(a.hist), ...Object.keys(b.hist)])) {
      const x = a.hist[f], y = b.hist[f];
      r.hist[f] = !x ? y : !y ? x : (y[0] > x[0] || (y[0] === x[0] && y[5] && !x[5]) ? y : x);
    }
    if (a.prog.fecha !== b.prog.fecha) r.prog = a.prog.fecha > b.prog.fecha ? a.prog : b.prog;
    else r.prog = b.prog.i.length > a.prog.i.length ? b.prog : a.prog;
    return r;
  }
  /* El día terminado pasa a `hist`. */
  function registra(e, fecha, intentos, ms, forma) {
    const r = limpia(e), id = objetivoDelDia(fecha), s = estado(id, intentos);
    if (!s.fin) return r;
    const fila = [puntosDe(s.fallos + 1, s.gano, POR_ID[id].d), s.fallos + (s.gano ? 1 : 0), entero(ms, 86400000), s.gano ? 1 : 0, intentos.slice()];
    const fm = limpiaForma(forma, intentos.length);
    if (fm) fila.push(fm);
    r.hist[fecha] = fila;
    if (r.prog.fecha === fecha) r.prog = { fecha, i: [], ms: 0 };
    return r;
  }
  function total(e) {
    let p = 0, ms = 0;
    for (const v of Object.values(e.hist)) { p += v[0]; ms += v[2]; }
    return { puntos: p, ms };
  }
  const resuelto = (e, f) => !!(e.hist[f] && e.hist[f][3]);
  /* La racha: días seguidos resueltos. Si hoy todavía no, sigue viva la de
     ayer; un día perdido (hoy también) la corta. */
  function racha(e, hoy) {
    if (e.hist[hoy] && !e.hist[hoy][3]) return 0;
    let f = resuelto(e, hoy) ? hoy : diaAnterior(hoy), n = 0;
    while (resuelto(e, f) && n < 100000) { n++; f = diaAnterior(f); }
    return n;
  }
  function mejorRacha(e) {
    const dias = Object.keys(e.hist).filter(f => resuelto(e, f)).map(numeroDia).sort((a, b) => a - b);
    let mejor = 0, run = 0, prev = null;
    for (const d of dias) { run = prev !== null && d === prev + 1 ? run + 1 : 1; mejor = Math.max(mejor, run); prev = d; }
    return mejor;
  }
  const tiempoDia = (e, f) => (e.hist[f] ? e.hist[f][2] : 0);
  function estadisticas(e, hoy) {
    const dias = Object.values(e.hist), dist = [0, 0, 0, 0, 0, 0];
    for (const v of dias) if (v[3]) dist[v[1] - 1]++;
    const ganados = dias.filter(v => v[3]).length;
    return { jugados: dias.length, ganados, racha: racha(e, hoy), mejor: mejorRacha(e), dist, puntos: total(e).puntos };
  }
  /* El texto para compartir, sin decir la integral ni la respuesta. */
  function resumen(e, fecha) {
    const v = e.hist[fecha];
    if (!v) return "";
    const n = v[1], g = v[3];
    const marcas = "🟥".repeat(g ? n - 1 : n) + (g ? "🟩" : "");
    const q = POR_ID[objetivoDelDia(fecha)];
    return `∫ Integrodle #${numeroIntegral(fecha)} · ${"★".repeat(q.d)}${"☆".repeat(3 - q.d)}\n${marcas} ${g ? n : "X"}/${MAX_INTENTOS} · ${v[0]} pts · 🔥 ${racha(e, fecha)}`;
  }

  /* ---------- la prueba (antitrampas) ----------
       { v: 1, f: "AAAA-MM-DD" (el día en que se mandó),
         d: [[n.º del día, ms, "intento\nintento…", "dt.a,dt.a,…", u, mc]] }
     La forma va solo en los últimos VENTANA días; u y mc solo si no son
     cero. El verificador rehace cada día con `estado`: los puntos salen
     de ahí, no de lo guardado. */
  const VENTANA = 30;
  function prueba(e, fecha, soloDia) {
    const dias = Object.keys(e.hist).filter(f => (soloDia ? f === fecha : f <= fecha)).sort();
    const d = dias.map(f => {
      const v = e.hist[f], c = [numeroIntegral(f), v[2], v[4].join("\n")], fm = v[5];
      if (fm && numeroDia(fecha) - numeroDia(f) < VENTANA) {
        c.push(fm.t.map(x => x.join(".")).join(","));
        if (fm.u || fm.mc) c.push(fm.u, fm.mc);
      }
      return c;
    });
    return { v: 1, f: fecha, d };
  }

  return {
    MAX_INTENTOS, PUNTOS, puntosDe, ESTRENO, VENTANA, N_PUNTOS,
    mulberry32, hash, baraja, diaChile, faltaParaManana, numeroDia, diaAnterior, numeroIntegral, fechaDeNumero, esFecha,
    ficha, prepara, latexIntegrando, latexPrimitiva, latexValor, latexLimites, latexIntegral, idsEn, objetivoDelDia, objetivoAlAzar,
    revisa, valida, estado, curvas, pistas,
    vacio, limpia, limpiaForma, mezcla, registra, total, resuelto, racha, mejorRacha, tiempoDia, estadisticas, resumen, prueba,
    TECNICAS: D.TECNICAS, BANCO: D.BANCO, X
  };
});
