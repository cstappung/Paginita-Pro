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

// §270: el ritmo del JUEGO (los cuadros que calcula, se dibujen o no), aparte del de las imágenes. En cada refresco de la
// pantalla quien mide anota la hora y la cuenta de cuadros del juego (anotar(hora, n, fuente)): si la cuenta avanzó k
// desde el refresco anterior en que avanzó, esos k cuadros tardaron entre los dos (dt / k cada uno). Así el 1 % bajo
// del juego dice si la carrera se calculó pareja aunque las imágenes salten (con N8 se dibuja la mitad, el juego sigue
// a 60). Si la cuenta vuelve atrás o cambia la fuente (de los menús a la carrera), se empieza de nuevo sin anotar
// nada. Un salto de más de `tope` ms sin avanzar (la pestaña oculta, una pausa) se descarta.
export function crearRitmoJuego({ capacidad = 7200, tope = 1000 } = {}) {   // (§283: 2 min, para las herramientas; el medidor mira los últimos 600)
  const ms = new Float64Array(capacidad);
  let total = 0, ultHora = null, ultN = null, ultFuente = null, cuadros = 0, horaCuadros = null, porSeg = null;
  return {
    anotar(hora, n, fuente = '') {
      if (!Number.isFinite(n)) return;
      if (fuente !== ultFuente || ultN === null || n < ultN) { ultFuente = fuente; ultN = n; ultHora = hora; return; }
      const k = n - ultN;
      if (!k) return;
      const dt = hora - ultHora;
      ultN = n; ultHora = hora;
      if (!(dt > 0) || dt > tope || k > 240) return;
      for (let i = 0; i < k; i++) ms[total++ % capacidad] = dt / k;
      cuadros += k;
    },
    // cuadros por segundo desde la última llamada (quien mide la llama una vez por segundo)
    segundo(hora) {
      // (con el hilo muy ocupado el reloj de la página puede llamar dos veces casi seguidas: un rato de menos de medio
      // segundo no se toma, se sigue sumando hasta la llamada siguiente)
      if (horaCuadros !== null && hora - horaCuadros < 500) return porSeg;
      if (horaCuadros !== null && hora > horaCuadros) porSeg = cuadros * 1000 / (hora - horaCuadros);
      cuadros = 0; horaCuadros = hora;
      return porSeg;
    },
    get porSeg() { return porSeg; },
    get total() { return total; },
    // { porSeg, bajo1, cuadros } de los últimos `ultimos` cuadros (para el medidor)
    resumen(ultimos = capacidad) {
      const n = Math.min(total, capacidad, ultimos), r = new Float64Array(n);
      for (let i = 0; i < n; i++) r[i] = ms[(total - n + i) % capacidad];
      const s = resumir(r);
      return { porSeg, bajo1: s.bajo1, bajo01: s.bajo01, cuadros: n };
    },
    // los tiempos de cada cuadro desde la marca `desde` (= un `total` anterior), para las herramientas de medir
    tiempos(desde = 0) {
      const ini = Math.max(desde, total - capacidad, 0), r = new Float64Array(total - ini);
      for (let i = ini; i < total; i++) r[i - ini] = ms[i % capacidad];
      return r;
    },
    // los últimos `n` cuadros como puntos del gráfico ({ ms, causa }), igual que imagenes-vista.ultimos (el dueño
    // 2026-11-11: «que sea uno de imagen y otro de juego»: el medidor dibuja también el tiempo de cada cuadro de lógica)
    ultimos(n = capacidad) {
      const k = Math.min(total, capacidad, n), r = new Array(k);
      for (let i = 0; i < k; i++) r[i] = { ms: ms[(total - k + i) % capacidad], causa: '' };
      return r;
    },
    reiniciar() { total = 0; ultN = null; ultHora = null; cuadros = 0; },
  };
}

// §283: CUÁNDO se anota cada cuadro del juego. Antes (§270) la cuenta se leía al ENTRAR a cada espera, es decir cuando el
// cuadro ya había TERMINADO su trabajo: si un cuadro trabaja 9 ms y el siguiente 12, los dos empezaron en su hora (la
// cuadrícula de 16,7 ms) pero sus finales quedan a 19,7 ms → el gráfico pintaba un tirón que el juego no tuvo (en este
// PC el «Juego» daba 89 % con la carrera pareja). Como medir el período de un reloj en el flanco de BAJADA de un pulso
// de ancho variable: sale ruido aunque el reloj sea perfecto; hay que medir en el flanco de SUBIDA (el que manda).
// Ahora se anota al SALIR de la espera que da la hora del cuadro (lo que devuelve la espera ≠ 0: «ya toca»): ese es el
// comienzo del cuadro siguiente, el flanco que de verdad marca el ritmo; si la espera volvió tarde, el cuadro empezó
// tarde y eso sí se ve. Las esperas de 1 ms que solo atienden el sonido (devuelven 0) no anotan.
// Los refrescos del monitor también leen la cuenta (por si el juego corre sin esperar, atrasado o poniéndose al día),
// pero ahora solo si no hubo una espera en los últimos `huecoMs` ms: un refresco cae siempre DENTRO de una espera
// (la página tiene un solo hilo), justo después del final de un cuadro, y anotar ahí volvía a medir el final.
// modo 'fin' = §270 tal cual (?ritmoJuego=fin).
//   const e = envolverEsperaJuego(ritmo, cuenta, { modo, ahora });  e.envolver(espera) → la espera envuelta;
//   e.refresco() en cada refresco del monitor;  cuenta() → [fuente, n]
export function envolverEsperaJuego(ritmo, cuenta, { modo = 'inicio', ahora = () => performance.now(), huecoMs = 50 } = {}) {
  const FIN = modo === 'fin';
  let ultimaEspera = -Infinity;
  const anotar = hora => { const [fuente, n] = cuenta(); ritmo.anotar(hora, n, fuente); };
  return {
    get modo() { return FIN ? 'fin' : 'inicio'; },
    envolver(f) {
      if (FIN) return (...a) => { anotar(ahora()); return f(...a); };
      return async (...a) => {
        const r = await f(...a);
        const t = ahora();
        ultimaEspera = t;
        // (la espera despierta en el refresco de antes y el runtime gira hasta la hora: el cuadro empieza en la hora)
        if (r !== 0) anotar(Number.isFinite(a[0]) ? Math.max(t, a[0]) : t);
        return r;
      };
    },
    refresco() { if (FIN || ahora() - ultimaEspera > huecoMs) anotar(ahora()); },
  };
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
// Las imágenes que muestra el gráfico del medidor, y de las que sale su «1 % bajo» (el dueño 2026-11-10: «ese 1 % low
// sea del gráfico que se muestra»): 240 = 4 s a 60 imágenes por segundo, 8 s con «30 parejas»
export const PUNTOS_GRAFICO = 240;

// El gráfico: una barra por imagen (su alto = cuánto tardó), las líneas de la imagen pareja y del doble, y una línea
// amarilla punteada con el 1 % bajo de ESTAS MISMAS barras (el p99: solo el 1 % de las barras pasa por encima)
export function dibujarGrafico(g, puntos, { ancho = g.canvas.width, alto = g.canvas.height, esperado = 1000 / 60, tope = null, titulo = '' } = {}) {
  const max = tope || Math.max(esperado * 3, ...puntos.map(p => p.ms));
  const y = v => alto - Math.min(alto, (v / max) * alto);
  const r = puntos.length >= 60 ? resumir(puntos.map(p => p.ms)) : null;   // (con menos de 60 el 1 % no dice nada)
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
  if (titulo) g.fillText(titulo, 2, 9);   // («Imagen» o «Juego»: cuál de los dos gráficos es)
  if (r && Number.isFinite(r.p99ms)) {
    const yy = Math.round(y(r.p99ms)) + 0.5;
    g.save(); g.strokeStyle = '#fc0'; g.setLineDash([3, 2]);
    g.beginPath(); g.moveTo(0, yy); g.lineTo(ancho, yy); g.stroke(); g.restore();
    g.fillStyle = '#fc0'; g.textAlign = 'right';
    g.fillText(`1 % bajo ${Math.round(r.bajo1)}`, ancho - 2, Math.max(9, yy - 2));
    g.textAlign = 'left';
  }
  return r;
}
