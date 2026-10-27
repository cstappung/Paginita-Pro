// La barra de descarga: cuánto se está bajando, de cuánto, y a qué velocidad — bitácora §106 (pedido del dueño:
// «la barra de descargas con el progreso cuando se esté descargando algo»).
//
// Resumen: todo lo privado del juego (el programa, el manifiesto, los pedazos del disco, las imágenes) llega con fetch
// desde el Worker de amigos. Este módulo envuelve ese fetch (encima del de privado.mjs, que le pone el token) y, a cada
// respuesta que trae datos, le lee una COPIA (`respuesta.clone()`) solo para contar los bytes a medida que llegan; quien
// pidió recibe la respuesta original, intacta. Es como poner una pinza amperimétrica en el cable: mide la corriente
// sin cortar el circuito.
//   - Cuánto se espera de cada pedido: el lote (§104) lo dice en su cuerpo ({"p": [[ruta, inicio, fin], …]}, fin
//     incluido), un pedido con Range lo dice en su cabecera, y lo demás en Content-Length.
//   - El programa (mkw.wasm) viaja comprimido (brotli, ~16 MB) y el navegador lo entrega descomprimido (~128 MB): lo
//     contado se divide por la proporción (la medida en la visita anterior o, la primera vez, 7,7), así la barra habla
//     de lo que viaja de verdad. Solo se cuenta la PRIMERA vez que se baja cada programa: después sale de la caché HTTP
//     al instante, y así la copia nunca toca la caché de código compilado de Chrome (§54).
//   - «Ráfaga» = los pedidos que se superponen en el tiempo: la barra muestra lo recibido de lo esperado en la ráfaga
//     actual y se reinicia cuando todo queda quieto un segundo.
//   - La velocidad es lo que llegó en los últimos ~1,5 s.
//   - Además, cuándo el JUEGO está esperando datos (una lectura del disco que todavía no llega): eso es lo que se nota.
// La barra (montarBarraDescarga) aparece solo si una ráfaga dura más de 0,4 s o el juego espera más de 0,4 s: lo que
// llega en un instante no parpadea en pantalla. Se va 1,2 s después de que todo termina. No usa backdrop-filter ni
// toca el canvas: encima del juego solo hay un rectángulo chico que se repinta 4 veces por segundo.
//
// Uso:  const d = crearDescargas({ base: ORIGEN + '/' });
//       window.fetch = d.envolver(window.fetch);         (después de privado.instalar())
//       d.esperaJuego(+1) / d.esperaJuego(-1)            (alrededor de cada lectura que el juego espera)
//       montarBarraDescarga(document.getElementById('descarga'), d, { enCortina: () => bool, primeraVez: () => bool });

export const ESPERA_MIN_MS = 400;        // una ráfaga o una espera más corta que esto no se muestra
export const QUIETO_MS = 1000;           // sin pedidos este tiempo = la ráfaga terminó
export const VENTANA_MS = 1500;          // la velocidad: lo que llegó en este rato
export const PROPORCION_PROGRAMA = 7.7;  // descomprimido / comprimido del programa final (127,6 MB / 16,5 MB, §89)
const CLAVE_PROPORCION = 'mkw.descargas.proporcion';
const CLAVE_PROGRAMAS = 'mkw.descargas.programas';   // los programas (dirección con huella) ya bajados en este navegador
const leer = clave => { try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };

export const esPrograma = url => /\/mkw\.wasm(\?|$)/.test(url);

// Cuántos bytes se esperan de un pedido, o null si no se sabe. (Puro: se prueba sin red.)
export function esperadoDe(url, opciones = {}, respuesta = null) {
  // el lote: la suma de sus trozos (fin incluido, como en Range)
  if (/\/lote(\?|$)/.test(url) && typeof opciones.body === 'string') {
    try {
      const p = JSON.parse(opciones.body).p;
      if (Array.isArray(p)) return p.reduce((s, [, inicio, fin]) => s + (fin - inicio + 1), 0);
    } catch {}
  }
  // un pedido con Range: bytes=inicio-fin
  const cab = opciones.headers;
  const rango = cab ? (typeof cab.get === 'function' ? cab.get('Range') : cab.Range || cab.range) : null;
  const m = rango && /bytes=(\d+)-(\d+)/.exec(rango);
  if (m) return Number(m[2]) - Number(m[1]) + 1;
  // lo demás: lo que dice la respuesta
  const largo = respuesta?.headers?.get?.('Content-Length');
  return largo !== null && largo !== undefined && largo !== '' && Number.isFinite(Number(largo)) ? Number(largo) : null;
}

export function crearDescargas({ base = '', ahora = () => performance.now(), almacen = { leer, guardar } } = {}) {
  const e = {
    activos: 0,              // pedidos con bytes todavía en camino
    total: 0,                // bytes (de red) bajados desde que se abrió la página
    pedidos: 0,
    rafaga: { desde: 0, esperado: 0, recibido: 0, hasta: 0 },   // la ráfaga actual (o la última)
    juego: { esperando: 0, desde: 0 },                          // lecturas del disco que el juego está esperando
    velocidad: 0,            // bytes por segundo (lo que llegó en VENTANA_MS)
  };
  const llegadas = [];       // [ms, bytes] de lo que llegó en la ventana (para la velocidad)
  const programas = new Set(almacen.leer(CLAVE_PROGRAMAS) || []);
  let proporcion = Number(almacen.leer(CLAVE_PROPORCION)) || PROPORCION_PROGRAMA;

  // la ráfaga: empieza con el primer pedido después de un rato quieto
  function empieza() {
    const t = ahora();
    if (e.activos === 0 && t - e.rafaga.hasta > QUIETO_MS) e.rafaga = { desde: t, esperado: 0, recibido: 0, hasta: t };
    e.activos++; e.pedidos++;
  }
  function suma(bytes) {
    const t = ahora();
    e.total += bytes; e.rafaga.recibido += bytes; e.rafaga.hasta = t;
    llegadas.push([t, bytes]);
  }
  function termina() { e.activos = Math.max(0, e.activos - 1); e.rafaga.hasta = ahora(); }

  // lee la copia de la respuesta hasta el final, sumando lo que llega (factor: 1 / proporción para el programa)
  async function contar(copia, esperado, factor) {
    let contado = 0;
    const lector = copia.body.getReader();
    try {
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        const n = value.byteLength * factor;
        // (lo contado nunca pasa lo esperado: si la proporción del programa quedó corta, la barra espera en el 100 %)
        const tope = esperado === null ? n : Math.max(0, Math.min(n, esperado - contado));
        if (esperado === null) e.rafaga.esperado += tope;   // (sin total conocido: suma igual a lo esperado y a lo recibido)
        contado += tope; suma(tope);
      }
      // el programa: lo contado es una estimación (descomprimido / proporción); al terminar, cierra justo en lo esperado
      if (factor !== 1 && esperado !== null && contado < esperado) suma(esperado - contado);
    } catch { /* se cortó: lo contado queda */ }
    finally { termina(); }
  }

  const esPrivado = url => typeof url === 'string' && (!base || url.startsWith(base));
  const urlDe = recurso => typeof recurso === 'string' ? recurso : recurso instanceof URL ? recurso.href : recurso?.url;

  function envolver(buscar) {
    return async function buscarContando(recurso, opciones = {}) {
      const url = urlDe(recurso);
      if (!esPrivado(url)) return buscar(recurso, opciones);
      const programa = esPrograma(url);
      if (programa && programas.has(url)) return buscar(recurso, opciones);   // ya bajado: sale de la caché (sin copia)
      empieza();
      let r;
      try { r = await buscar(recurso, opciones); }
      catch (err) { termina(); throw err; }
      if (!r.ok || !r.body || opciones.method === 'HEAD') { termina(); return r; }
      let esperado = esperadoDe(url, opciones, r), factor = 1;
      if (programa) factor = 1 / proporcion;                                  // Content-Length = lo comprimido
      if (esperado !== null) e.rafaga.esperado += esperado;
      contar(r.clone(), esperado, factor);
      return r;
    };
  }

  // el programa terminó de llegar: se anota (la próxima vez no se cuenta) y se guarda su proporción de verdad
  function programaListo(url, decodificado = 0, codificado = 0) {
    if (url) { programas.add(url); almacen.guardar(CLAVE_PROGRAMAS, [...programas].slice(-4)); }
    if (decodificado > 0 && codificado > 0 && decodificado >= codificado) {
      proporcion = decodificado / codificado;
      almacen.guardar(CLAVE_PROPORCION, +proporcion.toFixed(3));
    }
  }

  // lo que se muestra, calculado en el momento
  function mirar() {
    const t = ahora();
    while (llegadas.length && t - llegadas[0][0] > VENTANA_MS) llegadas.shift();
    const r = e.rafaga;
    const enVentana = llegadas.reduce((s, [, b]) => s + b, 0);
    // (al empezar la ráfaga la ventana es más corta: se divide por lo que lleva, con un piso de 0,25 s)
    e.velocidad = enVentana * 1000 / Math.max(250, Math.min(VENTANA_MS, t - r.desde));
    const bajando = e.activos > 0;
    const esperaJuego = e.juego.esperando > 0 ? t - e.juego.desde : 0;
    return {
      bajando, activos: e.activos,
      recibido: r.recibido, esperado: Math.max(r.esperado, r.recibido),
      pct: r.esperado > 0 ? Math.min(100, 100 * r.recibido / r.esperado) : null,
      velocidad: e.velocidad, total: e.total,
      msRafaga: bajando ? t - r.desde : 0, msQuieto: bajando ? 0 : t - r.hasta,
      esperaJuego,
    };
  }

  return {
    estado: e, envolver, mirar, programaListo,
    primeraVez: programas.size === 0,      // ningún programa bajado antes en este navegador (para «queda guardado»)
    // el juego empieza (+1) o deja (−1) de esperar una lectura del disco
    esperaJuego(d) {
      if (d > 0 && e.juego.esperando === 0) e.juego.desde = ahora();
      e.juego.esperando = Math.max(0, e.juego.esperando + (d > 0 ? 1 : -1));
    },
  };
}

// «12,4 MB», «850 KB»
export const textoBytes = b => b >= 1048576 ? `${(b / 1048576).toFixed(b >= 100 * 1048576 ? 0 : 1).replace('.', ',')} MB`
  : `${Math.max(1, Math.round(b / 1024))} KB`;

// Qué dice la barra ahora (o null = escondida). Puro: lo prueba el banco con relojes de mentira.
//   m = d.mirar(); enCortina = la cortina de carga está puesta; visible = la barra ya se veía; primeraVez = no hay nada
//   guardado de una visita anterior
export function textoBarra(m, { enCortina = false, visible = false, primeraVez = false } = {}) {
  const largo = m.msRafaga >= ESPERA_MIN_MS || m.esperaJuego >= ESPERA_MIN_MS;
  const sigue = m.bajando || m.esperaJuego > 0 || m.msQuieto < 1200;
  if (!(visible ? sigue : (m.bajando || m.esperaJuego > 0) && largo)) return null;
  const de = m.esperado > m.recibido ? ` de ${textoBytes(m.esperado)}` : '';
  const vel = m.bajando && m.velocidad > 1024 ? ` · ${textoBytes(m.velocidad)}/s` : '';
  const que = !m.bajando && !m.esperaJuego ? 'Listo' : m.esperaJuego >= ESPERA_MIN_MS && !enCortina ? 'Cargando' : 'Bajando';
  const nota = enCortina && primeraVez ? 'La primera vez tarda más: queda guardado para la próxima.' : '';
  return { titulo: `⬇ ${que} ${textoBytes(m.recibido)}${de}${vel}`, pct: m.bajando ? m.pct : 100, nota };
}

// La barra en la página: un rectángulo chico abajo a la izquierda (sobre la cortina, un poco más grande y al centro)
export function montarBarraDescarga(caja, descargas, { enCortina = () => false, primeraVez = () => false, cada = 250 } = {}) {
  if (!caja) return null;
  const titulo = caja.querySelector('.descarga-texto'), barra = caja.querySelector('.descarga-barra i'), nota = caja.querySelector('.descarga-nota');
  let visible = false;
  const pintar = () => {
    const cortina = enCortina();
    const t = textoBarra(descargas.mirar(), { enCortina: cortina, visible, primeraVez: primeraVez() });
    visible = !!t;
    caja.hidden = !t;
    caja.classList.toggle('en-cortina', cortina);
    if (!t) return;
    titulo.textContent = t.titulo;
    const indefinida = !Number.isFinite(t.pct);
    caja.classList.toggle('indefinida', indefinida);   // sin total conocido: la barra va y viene
    barra.style.width = indefinida ? '' : `${Math.max(2, t.pct)}%`;
    nota.textContent = t.nota; nota.hidden = !t.nota;
  };
  const reloj = setInterval(pintar, cada);
  pintar();
  return { pintar, detener: () => clearInterval(reloj) };
}
