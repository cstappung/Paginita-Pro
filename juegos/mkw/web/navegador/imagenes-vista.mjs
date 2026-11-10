// G16 (bitácora §256): las imágenes que de verdad salen a la pantalla, su tiempo una por una, el 1 % y el 0,1 % bajo.
//
// Resumen. Los «fps» de siempre cuentan cuántas imágenes salieron en un segundo: 58 fps puede ser 58 imágenes parejas
// o 50 parejas y 8 que tardaron el doble (un tirón que se siente). Los programas de medir juegos del PC dan además el
// «1 % bajo»: de todas las imágenes, el 1 % que más tardó, pasado a fps (si el 1 % más lento tardó 20 ms o más, el 1 %
// bajo es 1000 / 20 = 50 fps). Meta del dueño (2026-11-08): que el 1 % bajo sea casi igual a los fps a la vista, al
// menos el 95 % (META).
//   - Qué es una imagen: cada vez que aurora pide la textura del lienzo (GPUCanvasContext.getCurrentTexture) es una
//     imagen nueva que va a la pantalla; con N8 «30 parejas» son 30 por segundo, con la imagen intermedia 60 (las
//     intermedias cuentan: es lo que se ve). contar() lo anota.
//   - El tiempo de una imagen (modo «entrega», el de la página): la hora en que aurora pidió esta textura − la hora en
//     que pidió la anterior. Es la definición de los programas de medir del PC (PresentMon «MsBetweenPresents», lo que
//     usan MSI Afterburner y CapFrameX): el ritmo con que el juego entrega, sin el redondeo del monitor. Como un
//     osciloscopio que mide el período de cada pulso, no la frecuencia promedio.
//     (modo «refresco», el de la primera versión: la hora del refresco del monitor en que se vio − la del anterior con
//     imagen. Redondea a refrescos: con 60 imágenes en un monitor de 144 Hz da 2 y 3 refrescos aunque el juego vaya
//     parejo, y con el juego a 59,94 en un monitor de 240 cada 4 s una dura 5 refrescos. Sirve para ver el monitor; lo
//     que de verdad llegó a la pantalla lo mide medir-sitio con Display::FrameDisplayed de Chrome.)
//   - Los percentiles: 1 % bajo = 1000 / (el tiempo que deja al 99 % de las imágenes por debajo, el p99), 0,1 % bajo =
//     1000 / p99,9 (la definición «por percentil» de MSI Afterburner y CapFrameX).
//   - La causa de cada pico (si se sabe): quien lo arma da contadores que solo crecen (pipelines armados, lecturas de
//     disco, esperas de la sala…); en una imagen larga se mira cuál creció desde la última vez: ese es el sospechoso.
//
// Uso:  const v = crearImagenesVista({ causas: [['disco', () => n], …] });
//       v.contar(hora)             (cada imagen nueva; modo «entrega»: con la hora, performance.now())
//       v.refresco(hora, periodo)  (cada refresco del monitor: solo el modo «refresco» mide aquí)
//       v.resumen() / v.resumen(desdeMarca)  → { imagenes, segundos, fps, bajo1, bajo01, razon, p99ms, … }
//       v.marca() → número de la marca para medir un tramo;  v.ultimos(n) → { ms, causa } para el gráfico
//       dibujarGrafico(lienzo2d, v.ultimos(240), { periodo })

export const META = 0.95;
export const CAUSAS = ['', 'pipeline', 'disco', 'sala', 'juego', 'oculta', 'otro'];   // (0 = imagen normal)
const COLOR = ['#3c3', '#f80', '#09f', '#c3f', '#f33', '#888', '#fc0'];

// el valor que deja la fracción f por debajo, de una lista ordenada de menor a mayor
export function percentil(orden, f) {
  if (!orden.length) return null;
  return orden[Math.min(orden.length - 1, Math.max(0, Math.ceil(orden.length * f) - 1))];
}

// el resumen de una lista de tiempos por imagen (ms): fps a la vista, 1 % y 0,1 % bajo, la razón contra la meta
export function resumir(ms) {
  const n = ms.length;
  if (!n) return { imagenes: 0, segundos: 0, fps: null, bajo1: null, bajo01: null, razon: null, p50ms: null, p99ms: null, p999ms: null, maxMs: null };
  const orden = Float64Array.from(ms).sort();
  let suma = 0; for (let i = 0; i < n; i++) suma += orden[i];
  const p99 = percentil(orden, 0.99), p999 = percentil(orden, 0.999), fps = n * 1000 / suma, bajo1 = 1000 / p99;
  return { imagenes: n, segundos: suma / 1000, fps, bajo1, bajo01: 1000 / p999, razon: bajo1 / fps, cumple: bajo1 / fps >= META,
           p50ms: percentil(orden, 0.5), p99ms: p99, p999ms: p999, maxMs: orden[n - 1] };
}

// La línea de texto del informe (medir-sitio, medir-enlinea, el registro)
export function textoResumen(r) {
  if (!r || !r.imagenes) return 'imágenes a la vista: sin datos';
  const f = x => x == null ? '—' : x.toFixed(1);
  return `imágenes a la vista: ${f(r.fps)} fps · 1 % bajo ${f(r.bajo1)} · 0,1 % bajo ${f(r.bajo01)} · ` +
         `1 % bajo / fps ${Math.round(100 * r.razon)} % (meta ${Math.round(100 * META)} %: ${r.cumple ? 'cumple' : 'no cumple'}) · ` +
         `p50 ${f(r.p50ms)} ms, p99 ${f(r.p99ms)}, p99,9 ${f(r.p999ms)}, peor ${f(r.maxMs)} ms · ${r.imagenes} imágenes en ${f(r.segundos)} s`;
}

// cuántas imágenes duraron 1, 2, 3… «pasos» (p. ej. refrescos del monitor): { 4: 3550, 5: 40 }
export function histograma(ms, paso) {
  const h = {};
  if (!(paso > 0)) return h;
  for (const x of ms) { const k = Math.round(x / paso); h[k] = (h[k] || 0) + 1; }
  return h;
}

export function crearImagenesVista({ capacidad = 36000, causas = [], largo = 1.5, modo = 'refresco' } = {}) {
  const ENTREGA = modo === 'entrega';
  // un anillo de 10 min a 60 imágenes por segundo: tiempo de cada imagen y su causa (índice de CAUSAS)
  const ms = new Float32Array(capacidad), causa = new Uint8Array(capacidad);
  let total = 0;                         // imágenes anotadas desde el principio (la posición en el anillo = total % capacidad)
  let pendientes = 0, ultimaHora = null, contadas = 0;   // (null = todavía ninguna imagen con hora)
  const fotoCausas = causas.map(() => 0);
  const leerCausas = () => { for (let i = 0; i < causas.length; i++) { try { fotoCausas[i] = Number(causas[i][1]()) || 0; } catch {} } };
  leerCausas();
  // ¿quién creció desde la última foto? (el primero de la lista que creció)
  const sospechoso = () => {
    let id = 'otro';
    for (let i = 0; i < causas.length; i++) {
      let v = 0; try { v = Number(causas[i][1]()) || 0; } catch {}
      if (v > fotoCausas[i] && id === 'otro') id = causas[i][0];
      fotoCausas[i] = v;
    }
    return Math.max(1, CAUSAS.indexOf(id));
  };
  const anotar = (hora, esperado) => {
    if (ultimaHora !== null) {
      const d = hora - ultimaHora, k = total % capacidad;
      ms[k] = d;
      causa[k] = esperado > 0 && d > esperado * largo ? sospechoso() : 0;
      total++;
    }
    ultimaHora = hora;
  };
  const v = {
    get modo() { return ENTREGA ? 'entrega' : 'refresco'; },
    get total() { return total; },
    get contadas() { return contadas; },
    esperado: 0,                          // (modo «entrega»: la imagen pareja, ms; la pone quien mide, p. ej. cada segundo)
    contar(hora) {
      contadas++;
      if (!ENTREGA) { pendientes++; return; }
      anotar(hora, v.esperado);
    },
    // hora = la del rAF; periodo = el del monitor (ms) o la imagen esperada: una imagen de más de largo × lo esperado es un pico
    refresco(hora, esperado = 0) {
      if (ENTREGA || !pendientes) return;
      pendientes = 0;
      anotar(hora, esperado);
    },
    // (la pestaña oculta o un corte del reloj: la imagen siguiente no se mide contra una hora vieja)
    cortar() { ultimaHora = null; pendientes = 0; leerCausas(); },
    segundo() { leerCausas(); },          // (la foto de los contadores se renueva cada segundo: la causa es de lo reciente)
    marca() { return total; },
    // los tiempos desde la marca (o los últimos `ultimos` si no hay marca), como lista
    tiempos({ desde = null, ultimos = null } = {}) {
      const ini = Math.max(desde ?? total - (ultimos ?? capacidad), total - capacidad, 0);
      const r = new Float64Array(total - ini);
      for (let i = ini; i < total; i++) r[i - ini] = ms[i % capacidad];
      return r;
    },
    resumen(desde = null, ultimos = null) { return resumir(v.tiempos({ desde, ultimos })); },
    // cuántos picos por causa desde la marca
    causas(desde = 0) {
      const c = {};
      for (let i = Math.max(desde, total - capacidad, 0); i < total; i++) { const x = causa[i % capacidad]; if (x) c[CAUSAS[x]] = (c[CAUSAS[x]] || 0) + 1; }
      return c;
    },
    ultimos(n = 240) {
      const ini = Math.max(0, total - n, total - capacidad), out = [];
      for (let i = ini; i < total; i++) out.push({ ms: ms[i % capacidad], causa: CAUSAS[causa[i % capacidad]] });
      return out;
    },
    reiniciar() { total = 0; ultimaHora = null; pendientes = 0; leerCausas(); },
  };
  return v;
}

// Envuelve getCurrentTexture (una sola vez por página): cada llamada es una imagen nueva hacia la pantalla
export function engancharImagenes(alImagen, global = globalThis) {
  const C = global.GPUCanvasContext;
  if (!C?.prototype?.getCurrentTexture || C.prototype.getCurrentTexture.__mkwImagenes) return false;
  const original = C.prototype.getCurrentTexture;
  const envuelta = function () { try { alImagen(); } catch {} return original.call(this); };
  envuelta.__mkwImagenes = true;
  C.prototype.getCurrentTexture = envuelta;
  return true;
}

// El gráfico en vivo: una barra por imagen (las últimas que entran), alto = su tiempo; las líneas guía en lo esperado
// y el doble. Plano y verde = suave; cada pico es un tirón, pintado con el color de su causa.
export function dibujarGrafico(g, puntos, { ancho = g.canvas.width, alto = g.canvas.height, esperado = 1000 / 60, tope = null } = {}) {
  const max = tope || Math.max(esperado * 3, ...puntos.map(p => p.ms));
  const y = v => alto - Math.min(alto, (v / max) * alto);
  g.clearRect(0, 0, ancho, alto);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, ancho, alto);
  const w = ancho / Math.max(1, puntos.length);
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i], c = CAUSAS.indexOf(p.causa);
    g.fillStyle = COLOR[c > 0 ? c : p.ms > esperado * 1.5 ? 6 : 0];
    const top = y(p.ms);
    g.fillRect(i * w, top, Math.max(1, w - 0.2), alto - top);
  }
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
  for (const v of [esperado, esperado * 2]) { const yy = Math.round(y(v)) + 0.5; g.beginPath(); g.moveTo(0, yy); g.lineTo(ancho, yy); g.stroke(); }
  g.fillStyle = '#fff'; g.font = '9px sans-serif';
  g.fillText(`${esperado.toFixed(1)} ms`, 2, y(esperado) - 2);
}
