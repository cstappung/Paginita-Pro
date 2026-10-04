/* i18n.js — el selector de idioma de todo el sitio (es · en · it).

   Va en el <head> de cada página, antes que nada, y no pasa por esbuild:
   lo cargan igual las páginas compiladas (juegos, ColabTeX, ColabDraw,
   Informes), las .dc (que pinta support.js con React) y los documentos de
   los juegos que viven en un iframe. Por eso no traduce el código, sino el
   DOM: cada nodo de texto y cada title/placeholder/aria-label/alt que
   aparece se busca en el diccionario (i18n-datos.js, generado desde
   i18n/*.txt por colabtex/scripts/build-i18n.js) y se reemplaza en el
   sitio. Un MutationObserver hace lo mismo con todo lo que las apps pintan
   después, que es casi todo.

   Tres reglas que lo sostienen:
   - **Se cambia el dato del nodo, nunca el nodo.** React (las .dc) y los
     repintados por firma de los juegos siguen encontrando el mismo nodo de
     texto; si lo vuelven a escribir en castellano, el observador lo traduce
     otra vez. Cambiar de idioma recarga la página: así no hace falta
     recordar qué decía cada nodo antes.
   - **Lo que no está en el diccionario se traduce automáticamente**
     (Google, la misma petición que usan las extensiones de traducción),
     en lotes y con caché en localStorage, así que cada frase se pide una
     vez por navegador. Si esa petición falla, se deja en castellano y no
     se vuelve a intentar en esta visita.
   - **Lo que es de alguien no se toca ni se envía**: editores de código,
     campos de texto, el chat, nombres de proyectos y de archivos, el PDF,
     las fórmulas… todo lo que esté bajo [translate="no"], .notranslate o
     los selectores de NO_TOCAR. */
(function () {
  "use strict";
  if (window.I18N) return;

  var IDIOMAS = { es: "Español", en: "English", it: "Italiano" };
  var CLAVE = "sitio.idioma";
  var raiz = document.documentElement;
  var origen = raiz.getAttribute("data-i18n-src") || "es";

  var elegido = null;
  try { elegido = localStorage.getItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
  var idioma = IDIOMAS[elegido] ? elegido : "es";

  var yo = document.currentScript;
  var base = yo && yo.src ? yo.src.replace(/[^\/]*(\?.*)?$/, "") : "";
  var version = yo && yo.src && /\?v=([^&]*)/.test(yo.src) ? RegExp.$1 : "";

  /* Una página escrita en otro idioma (CSV·Scope, en inglés) se queda como
     está mientras nadie haya elegido idioma: solo se traduce a petición. */
  var activo = idioma !== origen && (origen === "es" || !!IDIOMAS[elegido]);

  var I18N = window.I18N = {
    idioma: idioma,
    idiomas: IDIOMAS,
    origen: origen,
    t: function (s) { return s; },
    cambia: function (nuevo) {
      if (!IDIOMAS[nuevo]) return;
      try { localStorage.setItem(CLAVE, nuevo); } catch (e) { /* nada */ }
      location.reload();
    },
    selector: selector
  };

  try { raiz.lang = activo ? idioma : origen; } catch (e) { /* nada */ }

  /* El selector se pinta en cada [data-i18n-selector] de la página; si no
     hay ninguno (las .dc, que son de React y no admiten hijos ajenos), va
     flotando abajo a la izquierda. Nunca dentro de un iframe: manda la
     página de arriba, y comparten localStorage. */
  function selector() {
    var s = document.createElement("select");
    s.className = "i18n-sel";
    s.setAttribute("translate", "no");
    s.setAttribute("aria-label", "Idioma · Language · Lingua");
    s.title = "Idioma · Language · Lingua";
    Object.keys(IDIOMAS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = "🌐 " + IDIOMAS[k];
      if (k === idioma) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener("change", function () { I18N.cambia(s.value); });
    return s;
  }

  var CSS = ".i18n-sel{font:inherit;font-size:12.5px;padding:3px 6px;border-radius:7px;" +
    "border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;cursor:pointer;max-width:9.5em}" +
    ".i18n-sel option{color:#111;background:#fff}" +
    ".i18n-flota{position:fixed;left:10px;bottom:10px;z-index:2147483000;background:rgba(13,17,23,.82);" +
    "color:#e6edf3;border-radius:8px;backdrop-filter:blur(4px)}" +
    ".i18n-flota .i18n-sel{border-color:rgba(255,255,255,.25)}" +
    "@media print{.i18n-flota{display:none}}";

  function montaSelectores() {
    if (window.top !== window) return;
    var st = document.createElement("style");
    st.textContent = CSS;
    (document.head || raiz).appendChild(st);
    var huecos = document.querySelectorAll("[data-i18n-selector]");
    if (huecos.length) {
      for (var i = 0; i < huecos.length; i++) {
        if (!huecos[i].querySelector(".i18n-sel")) huecos[i].appendChild(selector());
      }
    } else if (!raiz.hasAttribute("data-i18n-sin-selector")) {
      var f = document.createElement("div");
      f.className = "i18n-flota";
      f.setAttribute("translate", "no");
      f.appendChild(selector());
      document.body.appendChild(f);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montaSelectores);
  else montaSelectores();

  if (!activo) return;

  /* ---------- diccionario ---------- */

  var exactos = new Map();   // "texto normalizado" → traducción
  var patrones = [];         // [RegExp, plantilla]
  var cargado = false;

  function compila() {
    var datos = window.I18N_DATOS;
    if (!datos || cargado) return;
    cargado = true;
    var col = { en: 1, it: 2 }[idioma];
    if (!col) return;
    var filas = datos.split("\n");
    for (var i = 0; i < filas.length; i++) {
      var c = filas[i].split("\t");
      if (c.length < 3) continue;
      var es = norm(c[0]), tr = c[col];
      if (!es || !tr) continue;
      if (es.indexOf("{}") === -1) { exactos.set(es, tr); continue; }
      var literal = es.replace(/\{\}/g, "").replace(/[^A-Za-zÀ-ÿ]/g, "");
      if (literal.length < 3) continue;
      var re = "^" + es.split("{}").map(escRe).join("(.+?)") + "$";
      try { patrones.push([new RegExp(re), tr]); } catch (e) { /* fila rota */ }
    }
    /* Los patrones más largos primero: «Turno de {}» no debe ganarle a
       «Turno de {} · ronda {}». */
    patrones.sort(function (a, b) { return b[0].source.length - a[0].source.length; });
  }

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }

  function rellena(plantilla, m) {
    var n = 0;
    return plantilla.replace(/\{(\d*)\}/g, function (_, k) {
      var i = k ? Number(k) : ++n;
      var v = m[i];
      return v == null ? "" : traduceTrozo(v);
    });
  }

  /* Un hueco de plantilla suele ser un nombre o un número, pero a veces es
     otra frase del diccionario («Turno de {}» con «la banca»): se intenta. */
  function traduceTrozo(v) {
    var t = exactos.get(norm(v));
    return t != null ? t : v;
  }

  /* Decoración que se quita para buscar y se devuelve después: emoji,
     flechas, viñetas, dos puntos, puntos suspensivos, números delante… */
  var DECO = /^([\s\d -⯿⸀-⹿　-〿️‍\uD800-\uDFFF·•:;,.\-+*#\/|()\[\]«»"']*)([\s\S]*?)([\s -⯿️‍\uD800-\uDFFF·:;,.\-«»"')\]]*)$/;

  var memo = new Map();

  function buscaDic(s) {
    var t = exactos.get(s);
    if (t != null) return t;
    for (var i = 0; i < patrones.length; i++) {
      var m = patrones[i][0].exec(s);
      if (m) return rellena(patrones[i][1], m);
    }
    /* Mayúscula o minúscula inicial distinta de la del diccionario. */
    var f = s.charAt(0), otra = f === f.toLowerCase() ? f.toUpperCase() : f.toLowerCase();
    if (otra !== f) {
      t = exactos.get(otra + s.slice(1));
      if (t != null) return (f === f.toLowerCase() ? t.charAt(0).toLowerCase() : t.charAt(0).toUpperCase()) + t.slice(1);
    }
    return null;
  }

  /* Devuelve la traducción del texto o null si no hay ninguna (todavía). */
  function traduce(texto, pedir) {
    var s = norm(texto);
    if (!s || !necesita(s)) return null;
    if (memo.has(s)) {
      var r = memo.get(s);
      if (r != null) return r;
    }
    var t = buscaDic(s);
    if (t == null) {
      var m = DECO.exec(s);
      if (m && m[2] && (m[1] || m[3]) && necesita(m[2])) {
        var tc = buscaDic(m[2]);
        if (tc == null) tc = cacheMT[m[2]];
        if (tc == null && pedir) pide(m[2]);
        if (tc != null) t = m[1] + tc + m[3];
      } else {
        t = cacheMT[s];
        if (t == null && pedir) pide(s);
      }
    }
    if (t != null) memo.set(s, t);
    return t == null ? null : t;
  }

  function necesita(s) {
    if (!/[A-Za-zÀ-ÿ]{2}/.test(s)) return false;                 // números, símbolos
    if (/^[\w.+-]+@[\w.-]+$/.test(s)) return false;               // correos
    if (/^(https?:|www\.)/.test(s)) return false;                 // enlaces
    if (/^[\w\-./]+\.[a-z0-9]{1,5}$/i.test(s)) return false;      // archivo.ext
    if (/^[A-Z0-9][A-Z0-9 .·+/%:×-]{0,6}$/.test(s)) return false; // PNG, THD, CH1…
    if (/^\\[a-zA-Z]+/.test(s)) return false;                     // \textbf…
    return true;
  }

  I18N.t = function (s) {
    if (s == null) return s;
    var str = String(s);
    if (str.indexOf("\n") !== -1) return str.split("\n").map(function (l) { return I18N.t(l); }).join("\n");
    var t = traduce(str, true);
    if (t == null) return str;
    var m = /^(\s*)[\s\S]*?(\s*)$/.exec(str);
    return m[1] + t + m[2];
  };

  /* ---------- traducción automática de lo que falta ---------- */

  var CLAVE_MT = "i18n.mt." + origen + "." + idioma;
  var cacheMT = {};
  try { cacheMT = JSON.parse(localStorage.getItem(CLAVE_MT) || "{}") || {}; } catch (e) { cacheMT = {}; }
  var autoMT = true;
  try { autoMT = localStorage.getItem("sitio.idioma.auto") !== "0"; } catch (e) { /* nada */ }

  var cola = [], enCola = new Set(), mtCaido = false, mtCorriendo = 0, temporizador = 0;
  /* Tope por visita: un marcador que cambia sin parar («Munición 23/30»,
     un reloj) daría una frase nueva en cada repintado. Por lo mismo no se
     piden textos en los que los números pesan más que las letras. */
  var pedidas = 0, TOPE_MT = 800;

  function pide(s) {
    if (!autoMT || mtCaido || enCola.has(s) || s.length > 1500) return;
    var cifras = (s.match(/\d/g) || []).length;
    if (cifras && cifras * 3 > s.replace(/[^A-Za-zÀ-ÿ]/g, "").length) return;
    if (++pedidas > TOPE_MT) return;
    enCola.add(s);
    cola.push(s);
    if (!temporizador) temporizador = setTimeout(vacia, 120);
  }

  function vacia() {
    temporizador = 0;
    while (cola.length && mtCorriendo < 3 && !mtCaido) {
      var lote = [], largo = 0;
      while (cola.length && lote.length < 40 && largo + cola[0].length < 1800) {
        var s = cola.shift();
        lote.push(s);
        largo += s.length + 1;
      }
      if (!lote.length) lote.push(cola.shift());
      lanza(lote);
    }
  }

  function pideMT(texto) {
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=" +
      origen + "&tl=" + idioma + "&q=" + encodeURIComponent(texto);
    return fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" }).then(function (r) {
      if (!r.ok) throw new Error("mt " + r.status);
      return r.json();
    }).then(function (j) {
      return (j && j[0] || []).map(function (x) { return x && x[0] || ""; }).join("");
    });
  }

  function lanza(lote) {
    mtCorriendo++;
    pideMT(lote.join("\n")).then(function (salida) {
      var partes = salida.split("\n");
      if (partes.length === lote.length) {
        lote.forEach(function (s, i) { guardaMT(s, partes[i]); });
        return;
      }
      /* El lote volvió con otra cantidad de líneas: una a una. */
      return Promise.all(lote.map(function (s) {
        return pideMT(s).then(function (t) { guardaMT(s, t); });
      }));
    }).catch(function () {
      mtCaido = true;
    }).then(function () {
      mtCorriendo--;
      lote.forEach(function (s) { enCola.delete(s); });
      programaRepaso();
      if (cola.length) vacia();
    });
  }

  function guardaMT(s, t) {
    t = norm(t);
    if (!t) return;
    cacheMT[s] = t;
    guardaCache();
  }

  var tGuarda = 0;
  function guardaCache() {
    if (tGuarda) return;
    tGuarda = setTimeout(function () {
      tGuarda = 0;
      try { localStorage.setItem(CLAVE_MT, JSON.stringify(cacheMT)); }
      catch (e) {
        /* Lleno: se queda con la mitad más reciente. */
        var k = Object.keys(cacheMT);
        var nuevo = {};
        k.slice(Math.floor(k.length / 2)).forEach(function (x) { nuevo[x] = cacheMT[x]; });
        cacheMT = nuevo;
        try { localStorage.setItem(CLAVE_MT, JSON.stringify(cacheMT)); } catch (e2) { /* nada */ }
      }
    }, 800);
  }

  /* ---------- el DOM ---------- */

  var NO_TOCAR = "script,style,noscript,textarea,code,pre,kbd,samp,template," +
    "[translate=no],.notranslate,[contenteditable=''],[contenteditable=true],[contenteditable=plaintext-only]," +
    ".cm-editor,.textLayer,.annotationLayer,.katex,.katex-display,mjx-container,.MathJax";
  var ATRIBUTOS = ["title", "placeholder", "aria-label", "alt"];

  var hechoTexto = new WeakMap();   // nodo de texto → lo que le escribimos
  var hechoAttr = new WeakMap();    // elemento → {atributo: lo que le escribimos}
  var vetado = new WeakMap();       // elemento → ¿está bajo NO_TOCAR?

  function prohibido(el) {
    if (!el || el.nodeType !== 1) return false;
    if (vetado.has(el)) return vetado.get(el);
    var v = false;
    try { v = !!el.closest(NO_TOCAR); } catch (e) { v = false; }
    vetado.set(el, v);
    return v;
  }

  function texto(n) {
    var d = n.data;
    if (!d || d.length < 2 || hechoTexto.get(n) === d) return;
    if (prohibido(n.parentNode)) return;
    var t = traduce(d, true);
    if (t == null) return;
    var m = /^(\s*)[\s\S]*?(\s*)$/.exec(d);
    var nuevo = m[1] + t + m[2];
    hechoTexto.set(n, nuevo);
    if (nuevo !== d) n.data = nuevo;
  }

  function atributos(el) {
    if (prohibido(el)) return;
    var hechos = hechoAttr.get(el);
    for (var i = 0; i < ATRIBUTOS.length; i++) {
      var a = ATRIBUTOS[i];
      var v = el.getAttribute(a);
      if (!v || (hechos && hechos[a] === v)) continue;
      var t = traduce(v, true);
      if (t == null) continue;
      if (!hechos) { hechos = {}; hechoAttr.set(el, hechos); }
      hechos[a] = t;
      if (t !== v) el.setAttribute(a, t);
    }
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && el.value) {
      var tv = traduce(el.value, true);
      if (tv != null && tv !== el.value) el.value = tv;
    }
  }

  function recorre(nodo) {
    if (!nodo) return;
    if (nodo.nodeType === 3) { texto(nodo); return; }
    if (nodo.nodeType !== 1 && nodo.nodeType !== 9 && nodo.nodeType !== 11) return;
    if (nodo.nodeType === 1) {
      if (prohibido(nodo)) return;
      atributos(nodo);
    }
    var w = document.createTreeWalker(nodo, 5 /* elementos y texto */, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return prohibido(n) ? 2 /* rechaza la rama */ : 1;
        return 1;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) texto(n);
      else atributos(n);
    }
  }

  var pendientes = new Set(), programado = false;
  function encola(n) {
    pendientes.add(n);
    if (!programado) { programado = true; Promise.resolve().then(procesa); }
  }
  function procesa() {
    programado = false;
    var lista = Array.from(pendientes);
    pendientes.clear();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].isConnected !== false) recorre(lista[i]);
    }
  }

  var tRepaso = 0;
  function programaRepaso() {
    if (tRepaso) return;
    tRepaso = setTimeout(function () {
      tRepaso = 0;
      memo.forEach(function (v, k) { if (v == null) memo.delete(k); });
      recorre(document.documentElement);
    }, 250);
  }

  var obs = new MutationObserver(function (lista) {
    for (var i = 0; i < lista.length; i++) {
      var m = lista[i];
      if (m.type === "childList") {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var a = m.addedNodes[j];
          if (a.nodeType === 1) vetado.delete(a);
          encola(a);
        }
      } else if (m.type === "characterData") {
        if (hechoTexto.get(m.target) !== m.target.data) encola(m.target);
      } else if (m.type === "attributes") {
        if (m.attributeName === "translate" || m.attributeName === "class" || m.attributeName === "contenteditable") {
          vetado.delete(m.target);
          continue;
        }
        var h = hechoAttr.get(m.target);
        if (!h || h[m.attributeName] !== m.target.getAttribute(m.attributeName)) encola(m.target);
      }
    }
  });

  function arranca() {
    compila();
    recorre(document.documentElement);
    obs.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATRIBUTOS.concat(["translate", "contenteditable"])
    });
  }

  /* alert/confirm/prompt los escriben las apps con el texto en castellano. */
  ["alert", "confirm", "prompt"].forEach(function (f) {
    var orig = window[f];
    if (typeof orig !== "function") return;
    window[f] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === "string") args[0] = I18N.t(msg);
      return orig.apply(window, args);
    };
  });

  /* El diccionario se carga en el acto (document.write durante el análisis
     del <head>, mismo origen): así la primera pintura ya sale traducida. */
  var src = base + "i18n-datos.js" + (version ? "?v=" + version : "");
  if (window.I18N_DATOS) {
    arranca();
  } else if (document.readyState === "loading") {
    document.write('<script src="' + src + '"><\/script>');
    document.write('<script>window.I18N && window.I18N._arranca && window.I18N._arranca()<\/script>');
    I18N._arranca = function () { delete I18N._arranca; arranca(); };
  } else {
    var s = document.createElement("script");
    s.src = src;
    s.onload = s.onerror = arranca;
    (document.head || raiz).appendChild(s);
  }
})();
