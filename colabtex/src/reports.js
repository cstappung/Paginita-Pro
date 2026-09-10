"use strict";
/* ============================================================
   Informes — recogida de errores, sugerencias y fallos

   Tres cosas en un módulo, porque son la misma idea vista desde
   sitios distintos:

     1. RECOGER lo que se rompe, solo (errores de JavaScript, promesas
        sin atrapar, compilaciones que revientan).
     2. DEJAR CONTAR lo que se rompe o lo que falta, a mano (el botón
        flotante que hay en todas las páginas).
     3. EXPORTARLO en un archivo legible para poder arreglarlo.

   --- Qué se guarda y qué NO ---

   La regla es guardar lo MÍNIMO con lo que se pueda reproducir el
   fallo, y nada más. En concreto **no se guarda ni una letra del
   documento de nadie**: ni el .tex, ni el dibujo, ni los nombres de
   variables del usuario. De un error se queda el mensaje recortado, en
   qué estaba la aplicación cuando pasó (`donde`), tres marcos de la
   pila y el navegador por familia — no la cadena completa del agente,
   que identifica al equipo sin dar nada útil a cambio.

   --- El filtro ---

   La mitad del valor de esto es lo que se TIRA. Un `\aling{}` mal
   escrito no es un fallo de la aplicación: es un documento a medio
   escribir, y si esos entraran, el informe sería una lista infinita de
   erratas ajenas donde no se vería lo que de verdad hay que arreglar.
   Así que de LaTeX solo suben los fallos que son de la aplicación
   (falta un paquete, el motor aborta, se acaba la memoria) y del
   navegador se descarta el ruido conocido: `Script error.` sin origen,
   el bucle de ResizeObserver, extensiones, cancelaciones del usuario y
   cortes de red.

   --- Agrupación ---

   Los errores se guardan bajo su HUELLA, no con un identificador
   nuevo cada vez. El mismo fallo visto cien veces es una fila con un
   contador, no cien filas: si no, el informe se llena con el error que
   más se repite y esconde los otros nueve.

   La parte de Firebase se inyecta desde fuera (`api`), igual que en
   draw-link.js, para poder verificar todo esto sin red.
   ============================================================ */

export const APPS = { colabtex: "ColabTeX", colabdraw: "ColabDraw", juegos: "Juegos", informes: "Informes" };
export const TIPOS = { bug: "Fallo", idea: "Sugerencia" };

const MAX_MSG = 300;          // caracteres de mensaje que se guardan
const MAX_LOCAL = 40;         // errores que caben en el zurrón del navegador
const LS_KEY = "lab-errores";

/* ============================================================
   1. Filtro
   ============================================================ */

/* Ruido del navegador: no dice nada de la aplicación y ensucia. */
const RUIDO = [
  /^script error\.?$/i,                         // origen cruzado: sin datos
  /resizeobserver loop/i,
  /(chrome|moz|safari)-extension:/i,
  /\babort(ed)?error\b|the operation was aborted|the user aborted a request/i,
  /must be handling a user gesture|requires a user gesture/i,
  /the request is not allowed by the user agent/i,
  /(failed to fetch|networkerror|network request failed|load failed|err_(internet|network))/i,
  /non-error promise rejection/i,
  /^\s*$/
];

/* Errores de LaTeX que son del DOCUMENTO de quien escribe, no de la
   aplicación. Se descartan siempre: son erratas, no fallos. */
const TEX_DEL_USUARIO = [
  /undefined control sequence/i,
  /missing [$}{] inserted/i,
  /missing \\(begin|end|right|item)/i,
  /extra alignment tab|misplaced (alignment|\\noalign|&)/i,
  /runaway argument|paragraph ended before/i,
  /too many \}|extra \}|argument of .* has an extra/i,
  /environment .* undefined/i,
  /(under|over)full \\[hv]box/i,
  /(citation|reference|label|there were).*(undefined|multiply)/i,
  /double (super|sub)script|display math should end/i,
  /invalid in math mode|not in outer par mode/i,
  /float too large|no \\author given|\\begin\{.*\} ended by/i,
  /unknown graphics extension|division by zero/i
];

/* …y estos SÍ son de la aplicación: falta un paquete o una fuente que
   deberíamos empaquetar, o el motor se ha caído. */
const TEX_DE_LA_APP = [
  /file `?[^'\s]+'? not found/i,
  /i can'?t find file|i couldn'?t open (style|database) file/i,
  /* «Font umvs at 600 not found»: pdfTeX no encuentra la fuente en
     pdftex.map —y el 600 es una RESOLUCIÓN, no un tamaño: al no haber
     entrada en el mapa se pone a buscar un mapa de bits PK a 600 ppp
     que no existe—. Es siempre nuestro: la fuente está empaquetada
     pero falta su línea en el mapa (lo genera scripts/build-fontmap.js).
     El patrón de arriba no lo pilla porque entre «file umvs» y «not
     found» va «): Font umvs at 600 », y [^'\s]+ no cruza espacios. */
  /font .* at \d+ not found/i,
  /pdftex error|pdftex warning:.*(cannot|not found)/i,
  /\.(sty|cls|bst|def|fd|tfm|pfb|enc|map)'? not found/i,
  /(la)?tex capacity exceeded/i,
  /emergency stop|fatal error occurred|job aborted/i,
  /no pages of output|output file removed/i,
  /unable to (load|read)|failed to (load|compile|start)/i,
  /worker|wasm|out of memory|memory access out of bounds/i
];

/* Estas no son una causa, son el ESTERTOR: pdfTeX las escribe detrás de
   cualquier fallo que le impida seguir, sea nuestro o una errata. Siguen
   en la lista de arriba a propósito —cuando son lo único que hay, son la
   única prueba de que algo reventó— pero se descartan en cuanto la misma
   compilación trae algo que sí explique por qué. */
const TEX_SECUELA = [
  /emergency stop/i,
  /fatal error occurred/i,
  /job aborted/i,
  /no pages of output/i,
  /output file removed/i
];

const alguno = (lista, s) => lista.some(re => re.test(s));

export const esRuido = msg => alguno(RUIDO, String(msg || ""));

/* ¿Merece la pena guardar esta línea del registro de LaTeX? */
export function esFalloDeLaTeX(msg) {
  const s = String(msg || "");
  if (!s.trim()) return false;
  if (alguno(TEX_DE_LA_APP, s)) return true;
  if (alguno(TEX_DEL_USUARIO, s)) return false;
  /* Lo que no se reconoce se descarta a propósito: un documento a medio
     escribir produce mensajes rarísimos sin parar, y colar todos por si
     acaso convertiría el informe en un vertedero. Lo que sí sube
     siempre, y por otra vía, es una compilación que revienta entera. */
  return false;
}

/* Los fallos de UNA compilación, ya decidido cuáles suben.

   `esFalloDeLaTeX` mira cada línea por separado, y eso no basta para el
   estertor: «! Emergency stop.» y «! ==> Fatal error occurred, no output
   PDF file produced!» salen SIEMPRE juntas y siempre detrás de otra
   cosa. En el informe eran dos entradas de 8 repeticiones cada una —16
   filas— que no decían nada de por qué, porque la causa real de aquella
   compilación era una errata del documento y se había descartado, como
   debe ser. Contadas aparte parecían un fallo del motor.

   Así que se decide por compilación, no por línea:

     - si hay una causa nuestra (falta un paquete, una fuente, el motor
       sin memoria), se sube esa y el estertor sobra;
     - si no hay causa nuestra pero sí una errata de quien escribe, el
       estertor es suyo y no sube nada;
     - si no hay ni lo uno ni lo otro, el estertor es lo único que
       tenemos y sube: algo reventó sin decir su nombre, y eso hay que
       verlo. */
export function fallosDeLaTeX(mensajes) {
  const lista = (mensajes || []).map(m => String(m || "")).filter(m => m.trim());
  const utiles = lista.filter(esFalloDeLaTeX);
  const causas = utiles.filter(m => !alguno(TEX_SECUELA, m));
  if (causas.length) return causas;
  return lista.some(m => alguno(TEX_DEL_USUARIO, m)) ? [] : utiles;
}

/* ============================================================
   2. Recorte: dejar solo lo que sirve para reproducir
   ============================================================ */

/* Mensaje sin lo que cambia de una vez a otra, para poder agrupar. */
export function normaliza(msg) {
  return String(msg || "")
    .replace(/https?:\/\/\S+/g, "URL")
    .replace(/[A-Za-z]:\\[^\s"']+/g, "RUTA")
    .replace(/\/[\w.\-]+\/[\w.\-/]+/g, "RUTA")
    .replace(/["'`«][^"'`»]{0,80}["'`»]/g, "«…»")
    .replace(/\b[0-9a-f]{8,}\b/gi, "ID")
    .replace(/\d+/g, "N")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export const recorta = (s, n = MAX_MSG) => {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

/* Tres marcos de la pila, sin rutas absolutas. El paquete va minificado,
   así que el nombre de la función dice poco y lo que orienta es el
   archivo con línea y columna; por eso se conserva la columna. */
export function recortaPila(stack, max = 3) {
  const out = [];
  for (const bruta of String(stack || "").split("\n")) {
    const l = bruta.trim();
    if (!l || /^[\w.]*(Error|Exception)\b/.test(l)) continue;
    const m = l.match(/at\s+(?:([^\s(]+)\s+)?\(?([^\s()]+):(\d+):(\d+)\)?/) ||
      l.match(/([^@\s]*)@(\S+):(\d+):(\d+)/);
    if (!m) continue;
    const url = String(m[2] || "");
    if (/(chrome|moz|safari)-extension:/.test(url)) continue;
    const archivo = url.split(/[/\\]/).pop().split("?")[0] || "?";
    out.push(`${m[1] || "?"} (${archivo}:${m[3]}:${m[4]})`);
    if (out.length >= max) break;
  }
  return out;
}

/* Navegador y sistema por FAMILIA. La cadena completa del agente de
   usuario identifica el equipo y no aporta nada más para reproducir. */
export function navegador(ua) {
  const s = String(ua || "");
  const nav = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera"
    : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome"
      : /Safari\//.test(s) ? "Safari" : "otro";
  const ver = (s.match(/(?:Edg|OPR|Firefox|Chrome|Version)\/(\d+)/) || [])[1] || "";
  const so = /Windows NT 10/.test(s) ? "Windows 10/11" : /Windows/.test(s) ? "Windows"
    : /Mac OS X|Macintosh/.test(s) ? "macOS" : /Android/.test(s) ? "Android"
      : /iPhone|iPad/.test(s) ? "iOS" : /Linux|X11/.test(s) ? "Linux" : "otro";
  return `${nav}${ver ? " " + ver : ""} · ${so}`;
}

/* Huella estable de un error: misma causa, misma clave. Sin esto el
   mismo fallo repetido cien veces serían cien filas. */
export function huella(rec) {
  const semilla = [rec.app, rec.donde || "", normaliza(rec.mensaje), (rec.pila || [])[0] || ""].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return "e" + h.toString(36);
}

/* Construye el registro mínimo de un error. Devuelve null si es ruido:
   quien llama solo tiene que mirar si hay algo. */
export function registroDeError({ app, donde, error, mensaje, ctx, ver, ua, ahora }) {
  const msg = recorta(mensaje != null ? mensaje : (error && (error.message || error.code)) || error);
  if (!msg || esRuido(msg)) return null;
  const rec = {
    app: app || "colabtex",
    donde: recorta(donde || "", 80),
    mensaje: msg,
    pila: recortaPila(error && error.stack),
    nav: navegador(ua || (typeof navigator !== "undefined" ? navigator.userAgent : "")),
    ver: recorta(ver || "", 40),
    at: ahora || Date.now()
  };
  if (ctx && typeof ctx === "object") {
    /* El contexto lo pone la aplicación a mano y es lo que de verdad
       permite reproducir («modo: local», «paquete: pgf.sty»). Se limita
       a valores cortos para que nadie meta aquí medio documento. */
    const limpio = {};
    for (const [k, v] of Object.entries(ctx)) {
      if (v == null || typeof v === "object") continue;
      limpio[String(k).slice(0, 24)] = recorta(v, 120);
    }
    if (Object.keys(limpio).length) rec.ctx = limpio;
  }
  rec.huella = huella(rec);
  return rec;
}

/* ============================================================
   3. Zurrón local — sobrevive a una recarga y funciona sin sesión
   ============================================================ */

export function createBuffer(storage) {
  const almacen = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const leer = () => {
    if (!almacen) return [];
    try { return JSON.parse(almacen.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
  };
  const escribir = lista => {
    if (!almacen) return;
    try { almacen.setItem(LS_KEY, JSON.stringify(lista.slice(-MAX_LOCAL))); } catch (e) {}
  };
  return {
    list: leer,
    /* Devuelve el registro si es nuevo, o null si ya estaba (para no
       publicarlo otra vez en cada repetición). */
    add(rec) {
      const lista = leer();
      const previo = lista.find(r => r.huella === rec.huella);
      if (previo) {
        previo.veces = (previo.veces || 1) + 1;
        previo.at = rec.at;
        escribir(lista);
        return null;
      }
      rec.veces = 1;
      lista.push(rec);
      escribir(lista);
      return rec;
    },
    clear() { if (almacen) { try { almacen.removeItem(LS_KEY); } catch (e) {} } }
  };
}

/* ============================================================
   4. Exportar
   ============================================================ */

const fecha = t => {
  const d = new Date(t || Date.now());
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const nombreArchivo = (ext, t) => {
  const d = new Date(t || Date.now());
  const p = n => String(n).padStart(2, "0");
  return `informe-laboratorio-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${ext}`;
};

/* Markdown, no JSON, como formato principal: el informe está pensado
   para pegárselo a alguien que lo va a leer y arreglar. */
export function aMarkdown({ errores = [], feedback = [], generado } = {}) {
  const L = [];
  L.push(`# Informe del Laboratorio`, "");
  L.push(`Generado el ${fecha(generado)} · ${errores.length} error${errores.length === 1 ? "" : "es"} · ` +
    `${feedback.length} reporte${feedback.length === 1 ? "" : "s"} de personas`, "");

  const abiertos = feedback.filter(f => f.estado !== "hecho");
  const cerrados = feedback.filter(f => f.estado === "hecho");

  L.push("## Errores recogidos por la aplicación", "");
  if (!errores.length) L.push("_Ninguno._", "");
  for (const e of errores.slice().sort((a, b) => (b.veces || 1) - (a.veces || 1))) {
    L.push(`### ${APPS[e.app] || e.app} — ${e.mensaje}`, "");
    L.push(`- **Veces:** ${e.veces || 1}${e.personas ? ` · **personas:** ${e.personas}` : ""}`);
    if (e.donde) L.push(`- **Al:** ${e.donde}`);
    if (e.ctx) L.push(`- **Contexto:** ${Object.entries(e.ctx).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    L.push(`- **Navegador:** ${e.nav || "?"}${e.ver ? ` · versión de la página ${e.ver}` : ""}`);
    L.push(`- **Primera vez:** ${fecha(e.desde || e.at)} · **última:** ${fecha(e.at)}`);
    if (e.pila && e.pila.length) {
      L.push("", "```");
      for (const p of e.pila) L.push(p);
      L.push("```");
    }
    L.push("");
  }

  const bloqueFeedback = (titulo, lista) => {
    L.push(`## ${titulo}`, "");
    if (!lista.length) { L.push("_Ninguno._", ""); return; }
    for (const f of lista.slice().sort((a, b) => (b.at || 0) - (a.at || 0))) {
      L.push(`### [${TIPOS[f.tipo] || f.tipo}] ${f.titulo}`, "");
      L.push(`- **App:** ${APPS[f.app] || f.app} · **quién:** ${f.userName || "?"} · **cuándo:** ${fecha(f.at)}`);
      if (f.nav) L.push(`- **Navegador:** ${f.nav}${f.ver ? ` · versión de la página ${f.ver}` : ""}`);
      L.push("");
      if (f.cuerpo) L.push(f.cuerpo, "");
      if (f.pasos) L.push("**Pasos para reproducirlo:**", "", f.pasos, "");
      if (f.adjuntos && f.adjuntos.length) {
        L.push("**Errores técnicos adjuntos:**", "", "```");
        for (const a of f.adjuntos) L.push(`${a.donde ? a.donde + ": " : ""}${a.mensaje}`);
        L.push("```", "");
      }
    }
  };
  bloqueFeedback("Fallos y sugerencias pendientes", abiertos);
  if (cerrados.length) bloqueFeedback("Ya resueltos", cerrados);

  return L.join("\n") + "\n";
}

export const aJson = datos => JSON.stringify(datos, null, 2);

export function descargar(texto, nombre, tipo = "text/markdown;charset=utf-8") {
  const blob = new Blob([texto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ============================================================
   5. Captura automática
   ============================================================ */

/* Engancha los errores globales del navegador. `publicar` sube el
   registro (o no hace nada si no hay sesión); el zurrón local se llena
   siempre, incluso sin conexión. */
export function installErrorCapture({ app, buffer, publicar, ver, getDonde }) {
  const buf = buffer || createBuffer();
  const pub = publicar || (() => {});
  const donde = getDonde || (() => "");

  const anotar = (error, mensaje, extra) => {
    try {
      const rec = registroDeError({
        app, error, mensaje, ver: typeof ver === "function" ? ver() : ver,
        donde: (extra && extra.donde) || donde(),
        ctx: extra && extra.ctx
      });
      if (!rec) return null;
      const nuevo = buf.add(rec);
      if (nuevo) pub(nuevo);          // solo la primera vez de cada huella
      else pub(rec, true);            // repetición: solo suma al contador
      return rec;
    } catch (e) { return null; }      // registrar nunca puede romper la app
  };

  const onError = ev => anotar(ev.error || null, ev.message || (ev.error && ev.error.message));
  const onRech = ev => {
    const r = ev.reason;
    anotar(r instanceof Error ? r : null, (r && (r.message || r.code)) || String(r));
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRech);

  return {
    buffer: buf,
    /* Para avisar a mano desde la aplicación de algo que sí sabemos que
       ha fallado (una compilación que revienta, por ejemplo). */
    note: (mensaje, extra) => anotar((extra && extra.error) || null, mensaje, extra),
    /* Errores de LaTeX ya filtrados. `donde` cuenta lo que se estaba
       haciendo, que es lo que de verdad permite reproducirlo. */
    noteTex(mensajes, ctx) {
      const utiles = fallosDeLaTeX(mensajes);
      for (const m of utiles) anotar(null, m, { donde: "compilar el documento", ctx });
      return utiles.length;
    },
    destroy() {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRech);
    }
  };
}
