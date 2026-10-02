/* Electrodle: el motor, puro: el objetivo de cada día, la comparación de
   un intento, las pistas, los puntos, la racha y la mezcla de lo guardado
   en dos dispositivos. Sin DOM ni almacenamiento, para comprobarlo desde
   Node (tests/electro.test.cjs) y para que el objetivo del día salga igual
   en todos los navegadores.
   UMD: `ElectroMotor` en la página (después de datos.js y simbolos.js),
   `module.exports` en Node. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(require("./datos.js"), require("./simbolos.js"), require("./retos.js"));
  else raiz.ElectroMotor = fabrica(raiz.ElectroDatos, raiz.ElectroSimbolos, raiz.ElectroRetos);
})(typeof self !== "undefined" ? self : this, function (D, S, X) {
  "use strict";

  /* ---------- los modos ----------
     Cuatro clásicos, de «adivina cuál es»: `lista` es contra lo que se
     adivina (el buscador); `objetivos`, de dónde sale el del día. En
     Símbolo se adivina entre todos los componentes, pero solo sale uno que
     tenga símbolo dibujado. Científico es solo de práctica (`practica`):
     no sale en el diario, así que la racha cuenta los otros tres.
     Tres desafíos (`reto`), que salen de una semilla (retos.js) y se pueden
     perder: Bandas, Circuito y Conexiones. Suman puntos, no racha. */
  const COLS = {
    comp: [
      { k: "f", t: "Familia", tipo: "cat" },
      { k: "fn", t: "Función", tipo: "lista" },
      { k: "t", t: "Terminales", largo: "Terminales del encapsulado típico", tipo: "num" },
      { k: "p", t: "Polarizado", largo: "Polarizado: al revés se daña o no funciona", tipo: "bool" },
      { k: "ref", t: "Designador", largo: "Designador en un esquemático (R, C, Q…)", tipo: "cat" },
      { k: "e", t: "Época", tipo: "orden", etiquetas: D.EPOCAS }
    ],
    cien: [
      { k: "pais", t: "País", largo: "Nacionalidad", tipo: "lista" },
      { k: "nace", t: "Nació", largo: "Año de nacimiento", tipo: "num" },
      { k: "muere", t: "Murió", largo: "Año de muerte", tipo: "num" },
      { k: "area", t: "Área", tipo: "lista" },
      { k: "u", t: "Unidad", largo: "Unidad con su nombre (SI, CGS, otra o ninguna)", tipo: "cat" },
      { k: "nobel", t: "Nobel", tipo: "bool" }
    ]
  };
  const MODOS = [
    { id: "comp", nombre: "Componente", icono: "🔌", lema: "Pistas en cada intento", tipo: "tabla", lista: D.COMPONENTES,
      consigna: "Adivina el componente electrónico del día. Cada intento te dice qué tiene en común con el correcto." },
    { id: "cien", nombre: "Científico", icono: "🧑‍🔬", lema: "Por su país, sus años y su área", tipo: "tabla", practica: true, lista: D.CIENTIFICOS,
      consigna: "Adivina quién es el científico o la científica del día, por su nacionalidad, sus años y su área." },
    { id: "form", nombre: "Fórmula", icono: "🧮", lema: "Las variables se destapan", tipo: "formula", lista: D.FORMULAS,
      consigna: "¿Qué fórmula es? Las variables están tapadas: cada intento fallido destapa una." },
    { id: "simb", nombre: "Símbolo", icono: "〰️", lema: "Un trozo del esquemático", tipo: "simbolo", lista: D.COMPONENTES,
      objetivos: D.COMPONENTES.filter(c => S.SIMBOLOS[c.id]),
      consigna: "¿De qué componente es este símbolo? Empieza muy de cerca y se aleja con cada intento fallido." },
    { id: "band", nombre: "Bandas", icono: "🎨", lema: "El código de colores, como Wordle", tipo: "bandas", reto: true, lista: [],
      consigna: "Descubre las cuatro bandas de una resistencia de la serie E12. Cada banda te dice si el color va ahí (verde), está en otra banda (amarillo) o no está (gris), y la flecha, si el valor real es mayor o menor. Tienes 6 intentos." },
    { id: "circ", nombre: "Circuito", icono: "🔋", lema: "Calcula y acierta", tipo: "circuito", reto: true, lista: [],
      consigna: "Resuelve el circuito. Cada respuesta te dice a cuánto estás: verde a menos de 1,5 %, amarillo a menos de 10 %. Tienes 6 intentos." },
    { id: "conx", nombre: "Conexiones", icono: "🧩", lema: "Cuatro grupos de cuatro", tipo: "conexiones", reto: true, lista: [],
      consigna: "Forma cuatro grupos de cuatro fichas que tengan algo en común. Elige cuatro y envía; puedes equivocarte tres veces, a la cuarta se acaba." }
  ];
  const MODO = Object.fromEntries(MODOS.map(m => [m.id, m]));
  const IDS_MODOS = MODOS.map(m => m.id);
  /* Los del diario, y de ellos los que cuentan para la racha. */
  const DIARIOS = MODOS.filter(m => !m.practica).map(m => m.id);
  const CLASICOS = MODOS.filter(m => !m.reto && !m.practica).map(m => m.id);
  for (const m of MODOS) { m.columnas = COLS[m.id] || []; m.objetivos = m.objetivos || m.lista; m.por = Object.fromEntries(m.lista.map(x => [x.id, x])); }
  const item = (modo, id) => (MODO[modo] && MODO[modo].por[id]) || null;

  /* ---------- azar con semilla ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* FNV-1a de 32 bits: la semilla de una cadena, igual en todo navegador. */
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

  /* ---------- el día de Chile ----------
     Todos cambian de objetivo a la misma medianoche, la de Santiago. */
  const FORMATO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
  const HORA = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  function diaChile(ahora) {
    const p = {};
    for (const x of FORMATO.formatToParts(ahora == null ? new Date() : ahora)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }
  /* Milisegundos que faltan para la medianoche de Chile. */
  function faltaParaManana(ahora) {
    const d = ahora == null ? new Date() : ahora, p = {};
    for (const x of HORA.formatToParts(d)) p[x.type] = x.value;
    const s = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second);
    return Math.max(0, (86400 - s) * 1000 - (d.getMilliseconds ? d.getMilliseconds() : 0));
  }
  const numeroDia = f => Math.round(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 864e5);
  const deNumero = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const diaAnterior = f => deNumero(numeroDia(f) - 1);
  /* El número del día, como el #1547 de LoLdle: el 1 es el estreno. */
  const numeroElectrodle = f => numeroDia(f) - numeroDia("2026-10-01") + 1;
  const esFecha = f => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) && deNumero(numeroDia(f)) === f;

  /* ---------- el objetivo del día ----------
     Cada «vuelta» por el catálogo es una baraja con semilla, así que no se
     repite ninguno hasta que salen todos; y la primera de una vuelta nunca
     es la última de la anterior. */
  function vuelta(modo, n) {
    const ids = MODO[modo].objetivos.map(x => x.id);
    const p = baraja(ids, mulberry32(hash(`electro:${modo}:${n}`)));
    if (n > 0) {
      const prev = baraja(ids, mulberry32(hash(`electro:${modo}:${n - 1}`)));
      if (p[0] === prev[prev.length - 1]) [p[0], p[1]] = [p[1], p[0]];
    }
    return p;
  }
  function objetivoDelDia(modo, fecha) {
    if (MODO[modo].reto) return "s" + hash(`electro:${modo}:${fecha}`);
    const N = MODO[modo].objetivos.length, d = numeroDia(fecha);
    return vuelta(modo, Math.floor(d / N))[((d % N) + N) % N];
  }
  /* La práctica: al azar, pero distinto del anterior. */
  function objetivoAlAzar(modo, rng, distinto) {
    if (MODO[modo].reto) return "s" + Math.floor(rng() * 4294967296);
    const ids = MODO[modo].objetivos.map(x => x.id).filter(id => id !== distinto);
    return ids[Math.floor(rng() * ids.length)];
  }

  /* ---------- comparar un intento ----------
     Una celda por columna: `e` es «si» (igual), «casi» (una lista con algo
     en común) o «no»; las numéricas y la época llevan `flecha` hacia el
     objetivo. */
  const texto = (col, v) => col.tipo === "bool" ? (v ? "Sí" : "No") : col.tipo === "orden" ? col.etiquetas[v] :
    Array.isArray(v) ? v.join(", ") : String(v);
  function compara(modo, intentoId, objetivoId) {
    const a = item(modo, intentoId), o = item(modo, objetivoId);
    if (!a || !o) return [];
    return MODO[modo].columnas.map(col => {
      const x = a[col.k], y = o[col.k];
      let e = "no", flecha = "";
      if (col.tipo === "lista") {
        const igual = x.length === y.length && x.every(v => y.includes(v));
        e = igual ? "si" : x.some(v => y.includes(v)) ? "casi" : "no";
      } else if (col.tipo === "num" || col.tipo === "orden") {
        e = x === y ? "si" : "no";
        if (x !== y) flecha = y > x ? "↑" : "↓";
      } else e = x === y ? "si" : "no";
      return { t: col.t, texto: texto(col, x), e, flecha };
    });
  }

  /* ---------- fórmulas ----------
     Las variables de una fórmula, en el orden en que aparecen y sin
     repetir, y cuáles se destapan tras `fallos` intentos. El orden de
     destape sale del id, así que es el mismo para todos. */
  const esVariable = t => typeof t === "string" && !t.startsWith("!") && /^\p{L}/u.test(t);
  /* La clave de una variable es el símbolo con su subíndice, sin el
     exponente: destapar V destapa también V², y el ² se ve siempre. */
  const clave = t => t.split("^")[0];
  /* Las listas de fichas dentro de una ficha compuesta. */
  const hijos = t => (t.fr ? t.fr : [t.rz || t.sup || []]);
  function variables(f) {
    const vistas = [];
    const recorre = l => { for (const t of l) {
      if (esVariable(t)) { if (!vistas.includes(clave(t))) vistas.push(clave(t)); }
      else if (t && typeof t === "object") for (const sub of hijos(t)) recorre(sub);
    } };
    recorre(f);
    return vistas;
  }
  function destapadas(formulaId, fallos) {
    const fm = item("form", formulaId);
    if (!fm) return new Set();
    const orden = baraja(variables(fm.f), mulberry32(hash("tapa:" + formulaId)));
    return new Set(orden.slice(0, Math.max(0, Math.min(fallos, orden.length))));
  }

  /* ---------- el zoom del símbolo ----------
     Cinco escalones, de ×5 a la vista completa. El centro va del `foco`
     al centro del dibujo, y la ventana nunca se sale de la caja. */
  const ZOOM = [5, 3.6, 2.6, 1.9, 1.4, 1];
  function vista(simboloId, fallos) {
    const s = S.SIMBOLOS[simboloId], W = S.ANCHO, H = S.ALTO;
    const z = ZOOM[Math.min(Math.max(0, fallos), ZOOM.length - 1)];
    const w = W / z, h = H / z, t = (ZOOM[0] - z) / (ZOOM[0] - 1);
    const [fx, fy] = s ? s.foco : [W / 2, H / 2];
    const cx = fx + (W / 2 - fx) * t, cy = fy + (H / 2 - fy) * t;
    const x = Math.min(Math.max(cx - w / 2, 0), W - w), y = Math.min(Math.max(cy - h / 2, 0), H - h);
    const r = n => Math.round(n * 100) / 100;
    return { x: r(x), y: r(y), w: r(w), h: r(h), zoom: z };
  }

  /* ---------- pistas ----------
     Llegan con los fallos: primero una que acota, después la inicial. */
  function pistas(modo, objetivoId, fallos) {
    const o = item(modo, objetivoId);
    if (!o) return [];
    const ini = `Empieza con «${o.n.charAt(0)}».`;
    const todas = modo === "form" ? [[3, `Área: ${o.a}.`], [6, ini]]
      : modo === "simb" ? [[3, `Familia: ${o.f}.`], [6, ini]]
      : modo === "comp" ? [[5, ini], [8, o.d]]
      : [[5, ini], [8, `Área: ${o.area.join(", ")}. ${o.u === "SI" ? "Una unidad del SI lleva su nombre." : ""}`.trim()]];
    return todas.map(([n, t]) => ({ n, t, abierta: fallos >= n }));
  }

  /* ---------- puntos ----------
     100 a la primera, 10 menos por cada intento más, nunca menos de 10. */
  const puntosDe = intentos => Math.max(10, 110 - 10 * Math.max(1, intentos));

  /* ---------- los desafíos ----------
     El objetivo de un desafío es «s» + su semilla; de ahí sale el reto. */
  const cache = new Map();
  function reto(modo, obj) {
    const k = modo + obj;
    if (!cache.has(k)) {
      const sem = +String(obj).slice(1) >>> 0;
      cache.set(k, modo === "band" ? X.bandasDe(sem) : modo === "circ" ? X.circuitoDe(sem) : X.conexionesDe(sem));
      if (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    return cache.get(k);
  }
  /* Si un intento tiene la forma que su modo espera. */
  function valida(modo, x) {
    if (modo === "band") return X.codigoValido(x);
    if (modo === "circ") return typeof x === "string" && Number.isFinite(X.leeNumero(x));
    if (modo === "conx") return X.intentoValido(x);
    return !!item(modo, x);
  }
  /* Cómo va un modo con estos intentos: si terminó, si ganó y cuántos fallos. */
  function estado(modo, obj, intentos) {
    const n = intentos.length;
    if (modo === "band") {
      const gano = intentos.includes(reto(modo, obj));
      return { fin: gano || n >= X.INTENTOS_BANDAS, gano, fallos: n - (gano ? 1 : 0) };
    }
    if (modo === "circ") {
      const r = reto(modo, obj), gano = intentos.some(x => { const v = X.evaluaCircuito(x, r.resp); return v && v.e === "si"; });
      return { fin: gano || n >= X.INTENTOS_CIRCUITO, gano, fallos: n - (gano ? 1 : 0) };
    }
    if (modo === "conx") {
      const s = X.estadoConexiones(reto(modo, obj), intentos);
      return { fin: s.gano || s.perdio, gano: s.gano, fallos: s.errores, hallados: s.hallados };
    }
    const gano = intentos.includes(obj);
    return { fin: gano, gano, fallos: n - (gano ? 1 : 0) };
  }
  /* Los puntos de un modo terminado. Un desafío perdido no suma. */
  function puntos(modo, n, gano) {
    if (!MODO[modo].reto) return puntosDe(n);
    if (!gano) return 0;
    if (modo === "conx") return Math.max(40, 100 - 20 * Math.max(0, n - 4));
    return Math.max(50, 110 - 10 * Math.max(1, n));
  }

  /* ---------- buscador ----------
     Sin tildes ni mayúsculas; primero los que empiezan con lo escrito
     (o tienen una palabra que empieza así), después los que lo contienen. */
  const normaliza = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/ø/g, "o").replace(/æ/g, "ae").replace(/ß/g, "ss").trim();
  /* Cada sugerencia dice por qué nombre se encontró (`por`): el suyo o un
     alias, como «Condensador» para el capacitor. */
  function sugerencias(modo, txt, excluidos, max = 8) {
    const q = normaliza(txt), fuera = new Set(excluidos || []);
    if (!q) return [];
    const nota = n => {
      if (n.startsWith(q)) return 0;
      if (n.split(/[\s()\-.,]+/).some(p => p.startsWith(q))) return 1;
      return n.includes(q) ? 2 : 9;
    };
    return MODO[modo].lista.filter(x => !fuera.has(x.id)).map(x => {
      let r = nota(normaliza(x.n)), por = "";
      for (const a of x.alias || []) { const k = nota(normaliza(a)); if (k < r) { r = k; por = a; } }
      return { r, x, por };
    }).filter(c => c.r < 9).sort((a, b) => a.r - b.r || a.x.n.localeCompare(b.x.n, "es")).slice(0, max)
      .map(c => (c.por ? Object.assign({}, c.x, { por: c.por }) : c.x));
  }

  /* ---------- lo guardado ----------
     e = { hist: { fecha: { modo: [puntos, intentos, ms, ganó] } },
           prog: { fecha, m: { modo: { i: [ids], ms } } } }
     `hist` es lo terminado (de ahí salen los puntos, la racha y el
     tiempo); `prog`, lo que va de hoy, para seguir en otro dispositivo. */
  const vacio = () => ({ hist: {}, prog: { fecha: "", m: {} } });
  const entero = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
  function limpia(e) {
    const r = vacio();
    if (!e || typeof e !== "object") return r;
    for (const [f, dia] of Object.entries(e.hist || {})) {
      if (!esFecha(f) || !dia || typeof dia !== "object") continue;
      const ok = {};
      for (const m of IDS_MODOS) {
        const v = dia[m];
        if (Array.isArray(v) && (v.length === 3 || v.length === 4)) {
          const n = entero(v[1], 999), g = !MODO[m].reto || v.length === 3 || v[3] === 1 ? 1 : 0;
          if (n >= 1) ok[m] = [puntos(m, n, !!g), n, entero(v[2], 86400000), g];
        }
      }
      if (Object.keys(ok).length) r.hist[f] = ok;
    }
    const p = e.prog;
    if (p && esFecha(p.fecha) && p.m && typeof p.m === "object") {
      r.prog.fecha = p.fecha;
      for (const m of IDS_MODOS) {
        const v = p.m[m];
        if (!v || !Array.isArray(v.i)) continue;
        const i = [...new Set(v.i.filter(x => valida(m, x)))].slice(0, 999);
        r.prog.m[m] = { i, ms: entero(v.ms, 86400000) };
      }
    }
    return r;
  }
  /* Lo de dos dispositivos: de lo terminado, cada día y modo una vez (el
     de más puntos si los dos lo tienen); de lo de hoy, el más reciente y,
     en el mismo día, el que lleva más intentos. */
  function mezcla(a, b) {
    a = limpia(a); b = limpia(b);
    const r = vacio();
    for (const f of new Set([...Object.keys(a.hist), ...Object.keys(b.hist)])) {
      const x = a.hist[f] || {}, y = b.hist[f] || {};
      r.hist[f] = {};
      for (const m of IDS_MODOS) {
        const v = !x[m] ? y[m] : !y[m] ? x[m] : (y[m][0] > x[m][0] ? y[m] : x[m]);
        if (v) r.hist[f][m] = v;
      }
    }
    if (a.prog.fecha !== b.prog.fecha) r.prog = a.prog.fecha > b.prog.fecha ? a.prog : b.prog;
    else {
      r.prog.fecha = a.prog.fecha;
      for (const m of IDS_MODOS) {
        const x = a.prog.m[m], y = b.prog.m[m];
        const v = !x ? y : !y ? x : (y.i.length > x.i.length ? y : x);
        if (v) r.prog.m[m] = v;
      }
    }
    return r;
  }
  /* Un modo terminado hoy: va a `hist` y sale de `prog`. */
  function registra(e, fecha, modo, intentos, ms, gano = true) {
    const r = limpia(e);
    const n = Math.max(1, intentos);
    r.hist[fecha] = Object.assign({}, r.hist[fecha], { [modo]: [puntos(modo, n, gano), n, entero(ms, 86400000), gano ? 1 : 0] });
    return r;
  }
  const hecho = (e, fecha, modo) => !!(e.hist[fecha] && e.hist[fecha][modo]);
  const diaCompleto = (e, fecha) => CLASICOS.every(m => hecho(e, fecha, m));
  function total(e) {
    let p = 0, ms = 0;
    for (const dia of Object.values(e.hist)) for (const v of Object.values(dia)) { p += v[0]; ms += v[2]; }
    return { puntos: p, ms };
  }
  /* La racha cuenta días con los cuatro modos. Si hoy todavía no está
     completo, sigue viva la de ayer (y se ve). */
  function racha(e, hoy) {
    let f = diaCompleto(e, hoy) ? hoy : diaAnterior(hoy), n = 0;
    while (diaCompleto(e, f) && n < 100000) { n++; f = diaAnterior(f); }
    return n;
  }
  function mejorRacha(e) {
    const dias = Object.keys(e.hist).filter(f => diaCompleto(e, f)).map(numeroDia).sort((a, b) => a - b);
    let mejor = 0, run = 0, prev = null;
    for (const d of dias) { run = prev !== null && d === prev + 1 ? run + 1 : 1; mejor = Math.max(mejor, run); prev = d; }
    return mejor;
  }
  const tiempoDia = (e, fecha) => Object.values(e.hist[fecha] || {}).reduce((t, v) => t + v[2], 0);

  /* El texto para compartir el día, sin decir los objetivos. */
  function resumen(e, fecha) {
    const filas = MODOS.filter(m => !m.practica).map(m => {
      const v = e.hist[fecha] && e.hist[fecha][m.id];
      if (v && m.reto && !v[3]) return `${m.icono} ${m.nombre}: ❌`;
      return `${m.icono} ${m.nombre}: ${v ? `${v[1]} ${v[1] === 1 ? "intento" : "intentos"} ${v[1] === 1 ? "⚡" : v[0] >= 80 ? "🟩" : v[0] >= 50 ? "🟨" : "🟥"}` : "-"}`;
    });
    const pts = Object.values(e.hist[fecha] || {}).reduce((t, v) => t + v[0], 0);
    return `Electrodle #${numeroElectrodle(fecha)} · ${fecha}\n${filas.join("\n")}\n${pts} pts · 🔥 ${racha(e, fecha)}`;
  }

  return {
    MODOS, MODO, IDS_MODOS, DIARIOS, CLASICOS, numeroElectrodle, item, reto, valida, estado, puntos, X, mulberry32, hash, baraja,
    diaChile, faltaParaManana, numeroDia, diaAnterior, esFecha,
    objetivoDelDia, objetivoAlAzar, compara, esVariable, clave, variables, destapadas, ZOOM, vista, pistas,
    puntosDe, normaliza, sugerencias,
    vacio, limpia, mezcla, registra, hecho, diaCompleto, total, racha, mejorRacha, tiempoDia, resumen
  };
});
