/* Type Race — la caja donde se escribe, compartida por la práctica y la
   sala. Pinta las palabras de `motor.js` en tres renglones que se van
   corriendo (el renglón en curso queda en el medio, como Monkeytype), con
   un cursor que se desliza de letra en letra.

   Se escribe en un <input> transparente puesto encima de la caja: así el
   celular saca su teclado al tocarla, y las tildes con tecla muerta llegan
   ya compuestas. Lo que diga el campo pasa al motor; esta vista no decide
   nada, solo pinta y avisa (`alTecla`) para que quien la use suene.

   Los colores son variables CSS (`--tr-*`) con valores por omisión, para
   que la sala (con su modo oscuro) y la práctica pongan los suyos. */
(function (raiz, fabrica) {
  const V = fabrica(raiz.TypeRaceMotor);
  if (typeof module === "object" && module.exports) module.exports = V;
  else raiz.TypeRaceVista = V;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Mglobal) {
  "use strict";

  const CSS = `
.tr-caja{position:relative;--tr-l:2.15em;font:500 var(--tr-tam,24px)/var(--tr-l) "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;color:var(--tr-tenue,#8a8f98);user-select:none;-webkit-user-select:none;cursor:text;outline:none}
.tr-ventana{height:calc(var(--tr-l)*3);overflow:hidden;position:relative}
.tr-texto{display:flex;flex-wrap:wrap;column-gap:.6em;transition:transform .18s ease;will-change:transform}
.tr-p{white-space:nowrap;position:relative}
.tr-p.mala{text-decoration:underline;text-decoration-color:var(--tr-mal,#e5484d);text-underline-offset:.25em;text-decoration-thickness:2px}
.tr-l.ok{color:var(--tr-texto,#1f2328)}
.tr-l.mal{color:var(--tr-mal,#e5484d)}
.tr-l.extra{color:var(--tr-mal,#e5484d);opacity:.7}
.tr-cursor{position:absolute;left:0;top:0;width:2px;height:1.2em;margin-top:calc((var(--tr-l) - 1.2em)/2);background:var(--tr-acento,#e2b714);border-radius:2px;transition:transform .09s linear;pointer-events:none}
.tr-caja:not(.foco) .tr-cursor,.tr-caja.quieta .tr-cursor{opacity:0}
.tr-caja.pulsa .tr-cursor{animation:trLate 1s step-end infinite}
@keyframes trLate{50%{opacity:0}}
.tr-campo{position:absolute;inset:0;width:100%;height:100%;opacity:0;border:0;padding:0;margin:0;font-size:16px;color:transparent;background:transparent;caret-color:transparent;cursor:text;z-index:2}
.tr-velo{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 15px/1.3 system-ui,sans-serif;color:var(--tr-texto,#1f2328);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);background:color-mix(in srgb,var(--tr-fondo,#fff) 55%,transparent);border-radius:10px;pointer-events:none;z-index:1;opacity:0;transition:opacity .15s}
.tr-caja.dormida .tr-velo{opacity:1}
@media (max-width:600px){.tr-caja{--tr-tam:19px}}
@media (prefers-reduced-motion:reduce){.tr-texto,.tr-cursor{transition:none}}`;

  function estilo(doc) {
    if (doc.getElementById("tr-estilo")) return;
    const st = doc.createElement("style");
    st.id = "tr-estilo"; st.textContent = CSS;
    doc.head.appendChild(st);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Una palabra: sus letras contra lo escrito. Lo que sobra va detrás,
     en rojo. */
  function palabraHtml(obj, escrito, cerrada) {
    let h = "";
    const n = Math.max(obj.length, escrito == null ? 0 : escrito.length);
    for (let k = 0; k < n; k++) {
      const e = escrito == null ? undefined : escrito[k];
      if (k >= obj.length) h += `<span class="tr-l extra">${esc(e)}</span>`;
      else if (e === undefined) h += `<span class="tr-l">${esc(obj[k])}</span>`;
      else h += `<span class="tr-l ${e === obj[k] ? "ok" : "mal"}">${esc(obj[k])}</span>`;
    }
    const mala = cerrada && escrito !== obj;
    return { h, mala };
  }

  /* `op`: {M (el motor, si no está en global), alTecla(ev), puede() →
     bool (si se acepta tecleo ahora), ahora() → ms, registra(tipo, valor, t,
     confiable) (la clasificación guarda cada entrada para rehacer la carrera), aviso (texto del velo
     sin foco)}. */
  function crear(host, op) {
    op = op || {};
    const M = op.M || Mglobal;
    const doc = host.ownerDocument;
    estilo(doc);
    const caja = doc.createElement("div");
    caja.className = "tr-caja dormida";
    caja.setAttribute("translate", "no");
    caja.innerHTML = `<div class="tr-ventana"><div class="tr-texto"></div><i class="tr-cursor"></i></div>
      <div class="tr-velo">${esc(op.aviso || "Toca aquí o pulsa una tecla para escribir")}</div>
      <input class="tr-campo" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Escribe el texto">`;
    host.appendChild(caja);
    const texto = caja.querySelector(".tr-texto"), cursor = caja.querySelector(".tr-cursor"), campo = caja.querySelector(".tr-campo");
    let s = null, firmas = [], desp = 0, pulsaT = 0;
    const ahora = () => (op.ahora ? op.ahora() : performance.now());
    const puede = () => !op.puede || op.puede();

    function pon(estado) {
      s = estado; firmas = []; desp = 0;
      texto.innerHTML = "";
      texto.style.transform = "";
      campo.value = s ? s.esc : "";
      refresca();
    }
    function asegura() {
      while (texto.children.length < s.pal.length) {
        const sp = doc.createElement("span");
        sp.className = "tr-p";
        texto.appendChild(sp);
      }
    }
    function pinta(k) {
      const sp = texto.children[k];
      if (!sp) return;
      const obj = s.pal[k];
      const escrito = k < s.i ? s.hechas[k] : k === s.i ? s.esc : null;
      const firma = obj + "|" + (escrito == null ? "\u0000" : escrito) + (k < s.i ? "c" : "");
      if (firmas[k] === firma) return;
      firmas[k] = firma;
      const r = palabraHtml(obj, escrito, k < s.i);
      sp.innerHTML = r.h;
      sp.classList.toggle("mala", r.mala);
    }
    /* `desde`: la palabra en la que estaba antes de esta entrada. Una sola
       entrada puede cerrar varias (el autocompletado del celular, teclear
       muy rápido), y todas esas hay que repintarlas. */
    function refresca(desde) {
      if (!s) return;
      asegura();
      const de = Math.min(s.i, desde == null ? s.i : desde);
      if (!firmas.length) for (let k = 0; k < s.pal.length; k++) pinta(k);
      else for (let k = Math.max(0, de - 2); k <= Math.min(s.pal.length - 1, s.i + 1); k++) pinta(k);
      colocaCursor();
    }
    /* El renglón de la palabra en curso queda en el medio en cuanto hay
       uno por encima; el cursor va tras la última letra escrita. */
    function colocaCursor() {
      const sp = texto.children[Math.min(s.i, s.pal.length - 1)];
      if (!sp) return;
      const L = parseFloat(getComputedStyle(texto.children[0]).lineHeight) || sp.offsetHeight || 1;
      const fila = Math.round(sp.offsetTop / L);
      const quiere = Math.max(0, fila - 1) * L;
      if (quiere !== desp) { desp = quiere; texto.style.transform = `translateY(${-desp}px)`; }
      let x;
      if (s.fin) { x = sp.offsetLeft + sp.offsetWidth; }
      else {
        const letras = sp.children, n = s.esc.length;
        if (n === 0) x = sp.offsetLeft;
        else { const l = letras[Math.min(n, letras.length) - 1]; x = sp.offsetLeft + (l ? l.offsetLeft + l.offsetWidth : 0); }
      }
      const y = sp.offsetTop - desp;
      cursor.style.transform = `translate(${x}px,${y}px)`;
      caja.classList.remove("pulsa");
      clearTimeout(pulsaT);
      pulsaT = setTimeout(() => caja.classList.add("pulsa"), 600);
    }

    /* Lo que diga el campo, al motor. Un espacio en el medio (pegar,
       teclear muy rápido en el celular) se reparte: lo de antes cierra la
       palabra y lo de después empieza la siguiente. */
    function alEntrar(evento) {
      if (!s) return;
      if (!puede() || s.fin) { campo.value = s.esc; return; }
      const t = ahora(), desde = s.i;
      if (op.registra) op.registra(0, campo.value, t, !evento || evento.isTrusted !== false);
      const ev = M.entrada(s, campo.value, t);
      if (s.libre && op.alarga) op.alarga(s);
      campo.value = s.esc;
      refresca(desde);
      if (ev && op.alTecla) op.alTecla(ev, s);
    }
    function alBajar(e) {
      if (!s) return;
      if (e.key === "Backspace" && campo.value === "" && puede()) {
        const v = M.retrocede(s);
        if (v != null) {
          e.preventDefault(); campo.value = v; refresca();
          if (op.registra) op.registra(1, "", ahora(), e.isTrusted !== false);
          if (op.alTecla) op.alTecla("atras", s);
        }
      }
      if (e.key === "Tab" && op.alTab) { e.preventDefault(); op.alTab(e); }
      if (e.key === "Enter" && op.alEnter) { e.preventDefault(); op.alEnter(e); }
    }
    const enFoco = () => { caja.classList.add("foco"); caja.classList.remove("dormida"); };
    const sinFoco = () => { caja.classList.remove("foco"); caja.classList.add("dormida"); };
    campo.addEventListener("input", alEntrar);
    campo.addEventListener("keydown", alBajar);
    campo.addEventListener("focus", enFoco);
    campo.addEventListener("blur", sinFoco);
    campo.addEventListener("paste", e => e.preventDefault());
    campo.addEventListener("drop", e => e.preventDefault());
    /* Una tecla en cualquier parte de la página trae el foco a la caja,
       salvo que se esté escribiendo en otro campo (el chat). */
    const tecla = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || doc.activeElement === campo) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key.length !== 1 || !caja.isConnected || caja.offsetParent === null) return;
      if (!puede()) return;
      campo.focus({ preventScroll: true });
    };
    doc.addEventListener("keydown", tecla, true);
    const alRedimensionar = () => { if (s) { desp = -1; colocaCursor(); } };
    const win = doc.defaultView;
    win.addEventListener("resize", alRedimensionar);

    return {
      pon, refresca,
      enfoca: () => campo.focus({ preventScroll: true }),
      suelta: () => campo.blur(),
      quieta: v => caja.classList.toggle("quieta", !!v),
      el: caja,
      destruir() {
        clearTimeout(pulsaT);
        doc.removeEventListener("keydown", tecla, true);
        win.removeEventListener("resize", alRedimensionar);
        caja.remove();
      }
    };
  }

  /* El sonido de las teclas: un clic corto de ruido filtrado (más grave
     en el espacio, áspero en el error) y un acorde al terminar. Sale por
     `destino`, que en la sala es el bus de efectos y en la práctica el
     altavoz que gobierna `volumen.js`. */
  function crearSonido(ac, destino) {
    let ruido = null;
    const buf = () => {
      if (ruido) return ruido;
      ruido = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      return ruido;
    };
    function clic(f, v, q) {
      const t = ac.currentTime;
      const n = ac.createBufferSource(); n.buffer = buf();
      const fl = ac.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = f * (0.94 + Math.random() * 0.12); fl.Q.value = q;
      const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(fl); fl.connect(g); g.connect(destino); n.start(t); n.stop(t + 0.06);
    }
    function tono(f, t0, dur, v, tipo) {
      const t = ac.currentTime + t0;
      const o = ac.createOscillator(); o.type = tipo || "triangle"; o.frequency.value = f;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(destino); o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      ctx: ac,
      tecla(ev) {
        if (ac.state === "suspended") ac.resume();
        if (ev === "ok") clic(3200, 0.5, 1.4);
        else if (ev === "palabra") clic(1500, 0.6, 1.1);
        else if (ev === "atras") clic(2300, 0.3, 2);
        else if (ev === "mal") { clic(900, 0.6, 0.8); tono(140, 0, 0.07, 0.08, "square"); }
        else if (ev === "fin") [523, 659, 784, 1047].forEach((f, i) => tono(f, i * 0.07, 0.35, 0.12));
      },
      cuenta(n) { tono(n ? 660 : 1320, 0, n ? 0.12 : 0.3, 0.15, "square"); }
    };
  }

  return { crear, palabraHtml, crearSonido };
});
