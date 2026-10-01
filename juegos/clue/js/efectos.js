/* Clue - efectos: la maquinaria de las animaciones de la pantalla.

   No sabe nada del juego: solo da piezas para que main.js cuente lo que
   pasa con movimiento. Las piezas:
   - Secuencias (`carril`): una función asíncrona que corre en un carril,
     y las de un mismo carril van una tras otra. Dentro se usa `s.espera`,
     `s.tween`, `s.anima` y `s.hasta`, que se resuelven al instante si la
     secuencia se salta (clic o Esc en cualquier parte), así que el código
     de la secuencia llega solo a su estado final y limpia lo suyo.
   - Vuelos (`vuela`): un elemento que va de un punto a otro por un arco,
     con estela, en píxeles de pantalla o en unidades del SVG del tablero.
   - Burbujas, aros y coordenadas (`pantallaDe`, `enVista`, `atVista`).
   Nunca lanza, nunca bloquea la entrada (la capa fija no recibe toques) y
   respeta `prefers-reduced-motion` y la pestaña oculta: main.js consulta
   `puede()` antes de encolar nada. */
(function (raiz) {
  "use strict";
  const doc = raiz.document;
  const lin = k => k;
  const suave = k => k * k * (3 - 2 * k);
  const salida = k => 1 - (1 - k) * (1 - k);
  const rebote = k => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) { k -= 1.5 / d; return n * k * k + 0.75; }
    if (k < 2.5 / d) { k -= 2.25 / d; return n * k * k + 0.9375; }
    k -= 2.625 / d; return n * k * k + 0.984375;
  };
  function reducido() { try { return !!(raiz.matchMedia && raiz.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function oculta() { try { return !!doc.hidden; } catch (e) { return false; } }
  const puede = () => !reducido() && !oculta();

  const secs = new Set();          // secuencias vivas (en cola o corriendo)
  let carriles = {};               // nombre -> promesa de la cola
  const tweens = new Set();
  let raf = 0;

  function acaba(t, forzado) {
    if (!tweens.has(t)) return;
    tweens.delete(t); t.s.tweens.delete(t); clearTimeout(t.seguro);
    if (forzado) { try { t.paso(1); } catch (e) { /* nada */ } }
    t.res();
  }
  function bucle(now) {
    raf = 0;
    for (const t of Array.from(tweens)) {
      if (!tweens.has(t)) continue;
      const k = Math.max(0, Math.min(1, (now - t.t0) / t.ms));
      let mal = false;
      try { t.paso(t.ease(k)); } catch (e) { mal = true; console.warn("[clue] efecto", e); }
      if (k >= 1 || mal) acaba(t, false);
    }
    if (tweens.size) raf = raf || raiz.requestAnimationFrame(bucle);
  }

  function crearSec(clave) {
    const s = { clave, saltada: false, cancelada: false, nodos: [], tweens: new Set(), esperas: new Set(), anims: new Set(), fines: [], cerrada: false };
    s.nodo = n => { s.nodos.push(n); return n; };
    s.alFinal = f => { s.fines.push(f); };
    s.espera = ms => new Promise(res => {
      if (s.saltada || ms <= 0) return res();
      const e = { res };
      const t = setTimeout(() => { s.esperas.delete(e); res(); }, ms);
      e.limpia = () => clearTimeout(t);
      s.esperas.add(e);
    });
    /* Espera a que `cond()` sea verdad, con un tope. Devuelve si se cumplió. */
    s.hasta = (cond, max) => new Promise(res => {
      let ok = false;
      try { ok = !!cond(); } catch (e) { ok = false; }
      if (ok || s.saltada) return res(ok);
      const e = { res: () => res(false) };
      const t0 = Date.now();
      const iv = setInterval(() => {
        let c = false;
        try { c = !!cond(); } catch (er) { c = false; }
        if (c || Date.now() - t0 >= max) { clearInterval(iv); s.esperas.delete(e); res(c); }
      }, 50);
      e.limpia = () => clearInterval(iv);
      s.esperas.add(e);
    });
    s.tween = (ms, paso, ease) => new Promise(res => {
      if (s.saltada) { try { paso(1); } catch (e) { /* nada */ } return res(); }
      const t = { t0: performance.now(), ms: Math.max(1, ms), paso, ease: ease || lin, res, s };
      t.seguro = setTimeout(() => acaba(t, true), ms + 800);
      s.tweens.add(t); tweens.add(t);
      try { paso(0); } catch (e) { /* nada */ }
      if (!raf) raf = raiz.requestAnimationFrame(bucle);
    });
    /* Animación WAAPI de un elemento; con movimiento reducido o saltada,
       salta directo al último cuadro. */
    s.anima = (el, kf, op) => new Promise(res => {
      if (!el || !el.animate) return res();
      let an;
      try { an = el.animate(kf, Object.assign({ fill: "both" }, op || {})); } catch (e) { return res(); }
      if (s.saltada || reducido()) { try { an.finish(); } catch (e) { /* nada */ } return res(); }
      s.anims.add(an);
      const fin = () => { s.anims.delete(an); res(); };
      an.onfinish = fin; an.oncancel = fin;
    });
    s.salta = () => {
      s.saltada = true;
      for (const t of Array.from(s.tweens)) acaba(t, true);
      for (const e of Array.from(s.esperas)) { try { e.limpia(); } catch (er) { /* nada */ } s.esperas.delete(e); e.res(); }
      for (const an of Array.from(s.anims)) { try { an.finish(); } catch (e) { /* nada */ } }
    };
    s.cancela = () => { s.cancelada = true; s.salta(); };
    s.cierra = () => {
      if (s.cerrada) return;
      s.cerrada = true;
      s.salta();
      for (const f of s.fines.reverse()) { try { f(); } catch (e) { console.warn("[clue] efecto (final)", e); } }
      for (const n of s.nodos) { try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch (e) { /* nada */ } }
      s.nodos = [];
    };
    return s;
  }

  /* Encola `fn(s)` en el carril `nombre`: corre cuando acaben las
     anteriores de ese carril. Nunca lanza. */
  function carril(nombre, fn, clave) {
    const s = crearSec(clave || nombre);
    secs.add(s);
    const antes = carriles[nombre] || Promise.resolve();
    const p = antes.then(async () => {
      try { if (!s.cancelada) await fn(s); } catch (e) { console.warn("[clue] efecto", clave || nombre, e); }
      try { s.cierra(); } catch (e) { /* nada */ }
      secs.delete(s);
    });
    carriles[nombre] = p;
    return s;
  }
  const libre = nombre => carriles[nombre] || Promise.resolve();
  /* Salta todo: cada secuencia se apresura hasta su estado final. */
  function salta() { for (const s of Array.from(secs)) s.salta(); }
  /* Partida nueva: nada de lo pendiente vale. */
  function cancelaTodo() { for (const s of Array.from(secs)) s.cancela(); carriles = {}; }
  const hay = () => secs.size > 0;

  /* ---------- la capa fija, sobre la página y bajo los diálogos ---------- */
  function capaFija() {
    let c = doc.getElementById("fxtop");
    if (!c) {
      c = doc.createElement("div");
      c.id = "fxtop";
      c.setAttribute("aria-hidden", "true");
      doc.body.appendChild(c);
    }
    return c;
  }

  /* ---------- coordenadas ---------- */
  function pantallaDe(svg, x, y) {
    try {
      const m = svg.getScreenCTM();
      if (m) return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, k: m.a };
    } catch (e) { /* nada */ }
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = vb && vb.width ? r.width / vb.width : 1;
    return { x: r.left + x * k, y: r.top + y * k, k };
  }
  const enVista = (p, m) => { m = m || 0; return p.x >= m && p.y >= m && p.x <= raiz.innerWidth - m && p.y <= raiz.innerHeight - m; };
  const atVista = (p, m) => { m = m || 0; return { x: Math.max(m, Math.min(raiz.innerWidth - m, p.x)), y: Math.max(m, Math.min(raiz.innerHeight - m, p.y)) }; };

  /* ---------- vuelos ---------- */
  /* Punto de una curva cuadrática de `a` a `b` que se eleva `alto`. */
  function arco(a, b, k, alto) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - alto, u = 1 - k;
    return { x: u * u * a.x + 2 * u * k * mx + k * k * b.x, y: u * u * a.y + 2 * u * k * my + k * k * b.y };
  }
  function poner(el, p, rot, esc, svg) {
    if (svg) el.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") rotate(" + rot.toFixed(1) + ") scale(" + esc.toFixed(3) + ")");
    else el.style.transform = "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px) translate(-50%,-50%) rotate(" + rot.toFixed(1) + "deg) scale(" + esc.toFixed(3) + ")";
  }
  /* Lleva `el` de `a` a `b` por un arco. Opciones: ms, alto, esc0, esc1,
     alzar (cuánto crece a media altura), rot0, rot1, svg, estela, ease,
     cada(k, p, q) con p el punto del arco y q el de la recta. */
  async function vuela(s, el, a, b, o) {
    o = o || {};
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const alto = o.alto != null ? o.alto : Math.max(30, d * 0.28);
    const esc0 = o.esc0 == null ? 1 : o.esc0, esc1 = o.esc1 == null ? 1 : o.esc1;
    const rot0 = o.rot0 || 0, rot1 = o.rot1 || 0;
    let ultimo = -1;
    await s.tween(o.ms || 600, k => {
      const p = arco(a, b, k, alto);
      const esc = esc0 + (esc1 - esc0) * k + (o.alzar || 0) * Math.sin(Math.PI * k);
      poner(el, p, rot0 + (rot1 - rot0) * k, esc, o.svg);
      if (o.cada) o.cada(k, p, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      if (o.estela && k > 0.02 && k < 0.98 && k - ultimo >= 0.085 && el.parentNode && el.animate) {
        ultimo = k;
        try {
          const g = el.cloneNode(true);
          g.style.pointerEvents = "none";
          el.parentNode.insertBefore(g, el);
          s.nodo(g);
          const an = g.animate([{ opacity: o.estelaOp || 0.5 }, { opacity: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" });
          an.onfinish = () => { if (g.parentNode) g.parentNode.removeChild(g); };
        } catch (e) { /* nada */ }
      }
    }, o.ease || suave);
  }

  /* ---------- burbujas y aros (HTML fijo, tamaño constante) ---------- */
  /* Una burbuja con su cola apuntando a `p` (pantalla), encima. Si arriba no
     cabe y hay `pAbajo`, va debajo de ese punto. Devuelve el nodo. */
  function burbuja(s, p, texto, clase, pAbajo) {
    const c = capaFija(), b = doc.createElement("div");
    b.className = "burbuja" + (clase ? " " + clase : "");
    b.textContent = texto;
    c.appendChild(b);
    s.nodo(b);
    const w = b.offsetWidth, h = b.offsetHeight;
    const abajo = !!pAbajo && p.y - h - 16 < 4;
    const q = abajo ? pAbajo : p;
    if (abajo) b.classList.add("abajo");
    const x = Math.min(raiz.innerWidth - w / 2 - 6, Math.max(w / 2 + 6, q.x));
    const y = abajo ? Math.min(raiz.innerHeight - h - 8, q.y + 10) : Math.min(raiz.innerHeight - 8, Math.max(h + 12, q.y));
    b.style.left = x.toFixed(1) + "px";
    b.style.top = y.toFixed(1) + "px";
    b.style.setProperty("--cx", (q.x - x).toFixed(1) + "px");
    const ty = abajo ? "0%" : "-100%";
    if (b.animate && !reducido()) {
      try {
        b.animate([
          { opacity: 0, transform: "translate(-50%," + ty + ") scale(.4)" },
          { opacity: 1, transform: "translate(-50%," + ty + ") scale(1.08)", offset: 0.6 },
          { opacity: 1, transform: "translate(-50%," + ty + ") scale(1)" }
        ], { duration: 280, easing: "ease-out", fill: "both" });
      } catch (e) { /* nada */ }
    }
    return b;
  }
  function desvanece(el, ms) {
    if (!el) return;
    if (!el.animate || reducido()) { if (el.parentNode) el.parentNode.removeChild(el); return; }
    try {
      const an = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms || 220, fill: "forwards" });
      an.onfinish = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    } catch (e) { if (el.parentNode) el.parentNode.removeChild(el); }
  }
  /* Un aro que se expande en `p` (pantalla). */
  function aro(s, p, color, tam) {
    const c = capaFija(), a = doc.createElement("div");
    a.className = "aro";
    a.style.left = p.x.toFixed(1) + "px"; a.style.top = p.y.toFixed(1) + "px";
    a.style.width = a.style.height = (tam || 40) + "px";
    a.style.borderColor = color || "#e6b85c";
    c.appendChild(a);
    s.nodo(a);
    if (a.animate && !reducido()) {
      try {
        const an = a.animate([
          { opacity: 0.95, transform: "translate(-50%,-50%) scale(.3)" },
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.9)" }
        ], { duration: 520, easing: "ease-out", fill: "forwards" });
        an.onfinish = () => { if (a.parentNode) a.parentNode.removeChild(a); };
      } catch (e) { /* nada */ }
    } else if (a.parentNode) a.parentNode.removeChild(a);
    return a;
  }

  /* ---------- saltar: clic o Esc en cualquier parte ---------- */
  if (doc && doc.addEventListener) {
    doc.addEventListener("click", () => { if (secs.size) salta(); }, true);
    doc.addEventListener("keydown", ev => { if (ev.key === "Escape" && secs.size) salta(); }, true);
    doc.addEventListener("visibilitychange", () => { if (oculta()) salta(); });
  }

  raiz.ClueEfectos = {
    reducido, oculta, puede, carril, libre, salta, cancelaTodo, hay,
    capaFija, pantallaDe, enVista, atVista, arco, vuela, burbuja, desvanece, aro,
    ease: { lin, suave, salida, rebote }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
