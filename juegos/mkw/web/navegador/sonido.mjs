// Sonido del juego en la página: desbloqueo, volumen y medidor.
//
// Resumen: el juego mezcla su sonido (runtime → SDL3) y SDL3, en el navegador, crea su propio AudioContext (la
// "tarjeta de sonido" de la página) con un ScriptProcessorNode: un nodo al que el navegador le pide un bloque de
// muestras cada ~43 ms y SDL3 lo llena con lo que mezcló el juego. Ese nodo SDL3 lo conecta directo a la salida
// (los parlantes). Este módulo se mete en el medio SIN tocar SDL3:
//
//   juego (SDL3) → [medidor de entrada] → [volumen] → [medidor de salida] → parlantes
//
//   - Antes de que arranque el juego, reemplaza window.AudioContext por una versión nuestra que hace lo mismo pero
//     entrega como "salida" (destination) nuestra cadena en vez de los parlantes. Así SDL3 se conecta solo a ella.
//   - Desbloqueo: Chrome no deja sonar una página hasta que la persona la toca o aprieta una tecla (para que una
//     página no grite sola al abrirla). Al primer toque, clic o tecla se llama a resume() en cada AudioContext.
//   - Volumen (0 a 1) y silencio, guardados en el navegador (localStorage "mkw.volumen" / "mkw.silencio").
//   - Medidor: nivel del sonido que sale del juego (antes del volumen: así se mide aunque esté en silencio), y
//     cuenta los bloques que pidió el navegador, los que llegaron en silencio y los "huecos" (un bloque en silencio
//     entre bloques con sonido = un corte audible).
//
// Dos caminos para el sonido (§88):
//   - 'worklet' (el de siempre desde §88): el runtime NO abre el sonido de SDL3. Le pide a la página que lo abra
//     (`puente.abrir()`, la página crea el AudioContext y un AudioWorklet: sonido-worklet.js, en el hilo de audio) y le
//     entrega cada pedazo ya convertido a la frecuencia de la tarjeta (`puente.entregar`); la cola vive en el worklet
//     (~25 ms en vez de 60 + bloques de 43). El ajuste fino de ritmo del runtime lee esa cola (`puente.nivelMs`).
//   - 'viejo' (?audio=viejo): SDL3 crea el AudioContext y su ScriptProcessorNode, como antes.
// En los dos, el sonido pasa por la misma cadena de volumen y medidores.
//
// Uso:  const sonido = crearSonido({ alCambiar, worklet: true });  sonido.instalar();  (antes de cargar el juego)
//       crear el juego con { mkwSonido: sonido.puente }
//       sonido.volumen(0.5); sonido.silenciar(true); sonido.estado (para mostrar y para las pruebas)
//       await sonido.medirDemora(Module) → cuánto tarda en oírse lo que el juego mezcla (con un clic de prueba)

const leer = (clave, porDefecto) => { try { const v = localStorage.getItem(clave); return v === null ? porDefecto : JSON.parse(v); } catch { return porDefecto; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };
export const ESPERAS = [10, 20, 30, 50, 80, 120, Infinity];   // tramos del histograma de esperas entre entregas (ms)

// simularBloqueo: el AudioContext arranca suspendido aunque el navegador lo deje sonar. Sirve para las pruebas:
// Chrome manejado por Playwright (--enable-automation) nunca bloquea el sonido, y hay que probar el desbloqueo.
// worklet: el camino nuevo (si el runtime lo pide con puente.abrir; si no, SDL3 como antes). objetivoMs: la cola de
// reposo del worklet (se adapta sola si la página da tirones); arranqueMs: la cola con que empieza (el arranque se traba).
export function crearSonido({ alCambiar = null, objetivoGestos = window, simularBloqueo = false, worklet = false, objetivoMs = 25,
                              arranqueMs = 80, urlWorklet = new URL('./sonido-worklet.js', import.meta.url) } = {}) {
  const estado = {
    camino: 'viejo',         // 'worklet' recién cuando el runtime le pide el sonido a la página (puente.abrir)
    contextos: 0,            // cuántos AudioContext creó la página (SDL3 crea uno)
    activo: false,           // ¿el AudioContext está sonando (running) o bloqueado (suspended)?
    frecuencia: 0,           // muestras por segundo de la tarjeta (48 000 casi siempre)
    volumen: leer('mkw.volumen', 0.7),
    silencio: leer('mkw.silencio', false),
    bloques: 0,              // bloques que pidió el navegador al juego
    bloquesSilencio: 0,      // de esos, cuántos llegaron sin sonido
    huecos: 0,               // bloques en silencio entre bloques con sonido (cortes audibles)
    muestrasBloque: 0,       // tamaño del bloque (muestras por canal)
    pico: 0,                 // pico del último bloque (0 a 1)
    desbloqueadoCon: '',     // qué gesto lo desbloqueó ('pointerdown', 'keydown', …) o '' si sonaba solo
    msBloqueTotal: 0,        // tiempo total que SDL3 tardó en llenar bloques (le quita tiempo al juego); en el
    msBloqueMax: 0,          //   camino worklet, lo que tarda la página en pasar cada entrega al worklet
    // Solo el camino worklet (los manda el worklet cada ~21 ms):
    entregas: 0,             // pedazos que entregó el juego (uno cada ~3 ms)
    descartadas: 0,          // entregas tiradas porque el sonido estaba bloqueado o en pausa (como hace SDL3)
    nivelMs: 0,              // cola del worklet: promedio del último informe (ms de sonido esperando)
    nivelMinMs: 0,           //   …y su mínimo (cuánto faltó para vaciarse)
    objetivoMs,              // lo que la cola debe tener en promedio (sube con los tirones y baja con la calma)
    recibidos: 0,            // muestras que llegaron al worklet
    vacios: 0,               // veces que la cola se vació (con sonido = hueco; en silencio no se oye)
    saltos: 0,               // veces que hubo de más y se saltó lo viejo (fundido cruzado)
    silencioSaltadoMs: 0,    // silencio de más descartado sin que se note (baja la demora en los silencios)
    tirados: 0,              // = saltos (lo que se perdió); en el camino viejo los cuenta el runtime
    demora: null,            // la última medición con el clic (medirDemora)
    // Esperas entre entregas (ms): cuántas cayeron en cada tramo (ESPERAS: menos de 10, 20, 30, 50, 80, 120 y más).
    // Una espera más larga que la cola es un vacío. Sirve para elegir la cola de reposo (§88)
    esperas: [0, 0, 0, 0, 0, 0, 0],
    esperaMaxMs: 0,
  };
  let contexto = null, volumen = null, entrada = null, salida = null;
  let nodo = null, listo = false, pendientes = [];   // el AudioWorkletNode y lo que llegó antes de que cargara
  let colaInforme = -1;      // cola según el último informe (ms) mientras suena; -1 = no suena (el ajuste se detiene)
  let marcaEspera = null, marcaVieja = false;        // la medición con el clic en curso
  let ultimaEntrega = 0;                             // performance.now() de la última entrega del juego
  let gestoVisto = false;    // ¿ya hubo un gesto de la persona? (con el bloqueo simulado, antes no se reanuda)
  let anteriorConSonido = false, silenciosSeguidos = 0;
  const avisar = () => { if (alCambiar) alCambiar(estado); };

  // El volumen que de verdad se aplica (0 si está en silencio). Una curva al cuadrado: el oído percibe el volumen
  // de forma logarítmica, y así la mitad de la barra "suena a la mitad" (con lineal, casi todo pasa arriba).
  const ganancia = () => (estado.silencio ? 0 : estado.volumen * estado.volumen);
  // (el volumen va a TODAS las cadenas: las de otros AudioContext de la página, como los pitidos de dnf.mjs, también)
  const aplicar = () => { for (const c of cadenas) c.volumen.gain.setTargetAtTime(ganancia(), c.ctx.currentTime, 0.02); };
  const cadenas = [];        // la cadena (medidor → volumen → medidor) de cada AudioContext de la página

  // Anota un bloque que el juego acaba de llenar: ¿tiene sonido? ¿es un hueco?
  function anotar(bloque) {
    const datos = bloque.getChannelData(0);
    let pico = 0;
    for (let i = 0; i < datos.length; i += 4) { const v = Math.abs(datos[i]); if (v > pico) pico = v; }  // 1 de cada 4 alcanza
    estado.bloques++;
    estado.muestrasBloque = datos.length;
    estado.pico = pico;
    const conSonido = pico > 1e-4;          // −80 dB: menos que eso es silencio
    if (!conSonido) { estado.bloquesSilencio++; silenciosSeguidos++; }
    else {
      // Un silencio corto (1 o 2 bloques) entre sonido = el juego no llegó a tiempo con sus muestras
      if (anteriorConSonido && silenciosSeguidos > 0 && silenciosSeguidos <= 2) estado.huecos += silenciosSeguidos;
      anteriorConSonido = true;
      silenciosSeguidos = 0;
    }
  }

  // Nuestra versión de AudioContext: igual a la del navegador, pero su "destination" es nuestra cadena
  function instalar() {
    const Original = window.AudioContext || window.webkitAudioContext;
    if (!Original || Original.mkwPropio) return;
    const destinoReal = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination').get;
    const alProcesar = Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype, 'onaudioprocess');
    class AudioContextMkw extends Original {
      constructor(...args) {
        super(...args);
        estado.contextos++;
        // Cada AudioContext de la página tiene su cadena (así todo respeta el volumen y el silencio)…
        const cadena = { ctx: this, entrada: new AnalyserNode(this, { fftSize: 2048 }), volumen: new GainNode(this, { gain: ganancia() }),
                         salida: new AnalyserNode(this, { fftSize: 2048 }) };
        cadena.entrada.connect(cadena.volumen).connect(cadena.salida).connect(destinoReal.call(this));
        this.mkwCadena = cadena;
        cadenas.push(cadena);
        if (simularBloqueo) this.suspend();       // como si el navegador lo bloqueara
        // …pero "el" del juego es el primero (el que abre el runtime o SDL3). Antes, otro AudioContext de la página
        // (los pitidos del contador DNF, dnf.mjs) pasaba a ser el del medidor y del volumen: el volumen dejaba de mover
        // el sonido del juego, y con el worklet su arranque habría vaciado la cola (§88)
        if (contexto) return;
        contexto = this;
        ({ entrada, volumen, salida } = cadena);
        estado.frecuencia = this.sampleRate;
        this.addEventListener('statechange', () => {
          estado.activo = this.state === 'running';
          // al volver a sonar, el worklet empieza de cero (lo de antes de la pausa ya es viejo)
          if (estado.activo && nodo) { nodo.port.postMessage({ t: 'reiniciar' }); colaInforme = -1; }
          avisar();
        });
        estado.activo = this.state === 'running';
        avisar();
      }
      get destination() { return this.mkwCadena.entrada; }   // SDL3 se conecta "a la salida" = a nuestra cadena
      // Con el bloqueo simulado, solo un gesto de la página puede reanudar el sonido. SDL3 también llama a resume()
      // por su cuenta, y bajo Playwright cualquier evaluate() cuenta como "gesto", así que a veces se desbloqueaba
      // antes del clic de la prueba (falla intermitente "sonaba sin gesto")
      resume() { return simularBloqueo && !gestoVisto ? Promise.resolve() : super.resume(); }
      createScriptProcessor(...args) {
        // El nodo de SDL3: cada vez que SDL3 llena un bloque, también lo anotamos en el medidor
        const nodo = super.createScriptProcessor(...args);
        if (this !== contexto) return nodo;      // (de otro AudioContext de la página: no es el juego)
        Object.defineProperty(nodo, 'onaudioprocess', {
          get: () => alProcesar.get.call(nodo),
          set: fn => alProcesar.set.call(nodo, fn ? e => {
            const t0 = performance.now();
            fn(e);                                   // SDL3 mezcla y copia el bloque (en el hilo del juego)
            const ms = performance.now() - t0;
            estado.msBloqueTotal += ms;
            if (ms > estado.msBloqueMax) estado.msBloqueMax = ms;
            anotar(e.outputBuffer);
            if (marcaVieja) buscarClic(e);           // medición de la demora (camino viejo)
          } : null),
        });
        return nodo;
      }
    }
    AudioContextMkw.mkwPropio = true;
    window.AudioContext = AudioContextMkw;
    if (window.webkitAudioContext) window.webkitAudioContext = AudioContextMkw;
  }

  // ---- Camino worklet (§88): lo que llama el runtime (audio_backend.cpp) ----
  // Informe del worklet (cada ~21 ms) o el aviso del clic
  function informe(m) {
    if (m.t === 'm') { if (marcaEspera) { const r = marcaEspera; marcaEspera = null; r(m.cuadro / contexto.sampleRate); } return; }
    colaInforme = m.fase === 'sonando' ? m.nivel : -1;
    Object.assign(estado, {
      nivelMs: m.nivel, nivelMinMs: m.min, objetivoMs: m.objetivo, pico: m.pico, muestrasBloque: 128,
      bloques: m.bloques, bloquesSilencio: m.bloquesSilencio, huecos: m.huecos, vacios: m.vacios, saltos: m.saltos, tirados: m.saltos,
      recibidos: m.recibidos, silencioSaltadoMs: m.silencioSaltado * 1000 / contexto.sampleRate,
    });
  }
  const puente = {
    // El runtime abre el sonido. Devuelve la frecuencia de la tarjeta (el runtime le convierte el sonido a esa y lo
    // entrega acá) o 0 = que lo abra SDL3 como antes (?audio=viejo, o un navegador sin AudioWorklet)
    abrir() {
      if (!worklet || typeof AudioWorkletNode === 'undefined' || !window.AudioContext.mkwPropio) return 0;
      if (contexto) return contexto.sampleRate;
      const ctx = new window.AudioContext({ latencyHint: 'interactive' });   // AudioContextMkw: con volumen y medidor
      estado.camino = 'worklet';
      ctx.audioWorklet.addModule(urlWorklet).then(() => {
        nodo = new AudioWorkletNode(ctx, 'mkw-salida', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
                                                         processorOptions: { objetivoMs, arranqueMs } });
        nodo.port.onmessage = e => informe(e.data);
        nodo.connect(ctx.destination);         // = nuestra cadena (medidor → volumen → medidor → parlantes)
        listo = true;
        for (const d of pendientes) nodo.port.postMessage(d, [d.buffer]);
        pendientes = [];
      }).catch(e => { estado.camino = 'falló el worklet'; console.warn('[sonido] no cargó el worklet: ' + e); });
      return ctx.sampleRate;
    },
    // Un pedazo de sonido del juego (izq, der intercalados, ya a la frecuencia de la tarjeta). `vista` mira la memoria
    // del wasm: se copia (la memoria puede moverse) y la copia se le pasa al worklet sin volver a copiarla (transfer)
    entregar(vista) {
      const t0 = performance.now();
      if (!contexto || contexto.state !== 'running') { estado.descartadas++; ultimaEntrega = 0; return; }   // bloqueado: se tira
      // ¿Cuánto pasó desde la entrega anterior? Es lo que la cola del worklet tuvo que tapar sola (un tirón de la página)
      if (ultimaEntrega) { const e = t0 - ultimaEntrega; estado.esperas[ESPERAS.findIndex(x => e < x)]++; if (e > estado.esperaMaxMs) estado.esperaMaxMs = e; }
      ultimaEntrega = t0;
      const d = vista.slice();
      if (listo) nodo.port.postMessage(d, [d.buffer]);
      else { pendientes.push(d); if (pendientes.length > 64) pendientes.shift(); }   // (el worklet todavía carga)
      estado.entregas++;
      const ms = performance.now() - t0;
      estado.msBloqueTotal += ms;
      if (ms > estado.msBloqueMax) estado.msBloqueMax = ms;
    },
    // Para el ajuste fino de ritmo del runtime (un PI): cuánto hay en la cola y cuánto debería haber
    nivelMs: () => (listo && colaInforme >= 0 && contexto.state === 'running' ? colaInforme : -1),
    objetivoMs: () => estado.objetivoMs,
  };

  // ---- La demora, medida con un clic (§88) ----
  // El runtime deja el juego mudo y mete un clic (4 muestras al máximo) en una entrega, anotando la hora; la salida
  // dice en qué muestra de la tarjeta salió (el worklet, o el ScriptProcessorNode de SDL3 en el camino viejo), y
  // getOutputTimestamp() del navegador dice cuándo suena esa muestra en el parlante. Demora = oído − entrega.
  function buscarClic(e) {
    const datos = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < datos.length; i++) {
      if (Math.abs(datos[i]) > 0.25) {
        marcaVieja = false;
        if (marcaEspera) { const r = marcaEspera; marcaEspera = null; r(e.playbackTime + i / contexto.sampleRate); }
        return;
      }
    }
  }
  async function medirDemora(M, { veces = 8, pausaMs = 250 } = {}) {
    if (!contexto || contexto.state !== 'running' || !M._mkw_web_sonido_marca) return null;
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const demoras = [], colas = [];
    M._mkw_web_sonido_marca(1);                // el juego queda mudo mientras se mide (para ver solo el clic)
    await espera(400);                         // que salga lo que ya estaba en camino
    for (let k = 0; k < veces; k++) {
      const visto = new Promise(r => {
        marcaEspera = r;
        setTimeout(() => { if (marcaEspera === r) { marcaEspera = null; r(null); } }, 1500);
      });
      if (nodo) nodo.port.postMessage({ t: 'marca' }); else marcaVieja = true;
      M._mkw_web_sonido_marca(2);              // el clic va en la próxima entrega del juego
      const t = await visto;                   // tiempo de la tarjeta (s) en que sale el clic
      if (t !== null) {
        const entregado = M._mkw_web_sonido_marca_ms();       // performance.now() cuando el juego lo entregó
        const ts = contexto.getOutputTimestamp();             // qué muestra suena ahora en el parlante, y cuándo
        if (ts.performanceTime > 0) demoras.push(ts.performanceTime + (t - ts.contextTime) * 1000 - entregado);
        colas.push(nodo ? estado.nivelMs : M._mkw_web_sonido_cola_ms());
      }
      await espera(pausaMs);
    }
    M._mkw_web_sonido_marca(0);
    marcaVieja = false;
    if (!demoras.length) return null;
    demoras.sort((a, b) => a - b);
    const med = a => a[a.length >> 1];
    estado.demora = {
      mediana: med(demoras), min: demoras[0], max: demoras[demoras.length - 1], n: demoras.length, de: veces,
      colaMs: colas.length ? med(colas.slice().sort((a, b) => a - b)) : 0,
      // lo que el navegador dice que tarda él (su búfer + el del sistema y la tarjeta), ya incluido en la demora
      chromeMs: ((contexto.baseLatency || 0) + (contexto.outputLatency || 0)) * 1000,
      camino: nodo ? 'worklet' : 'viejo',
    };
    return estado.demora;
  }

  // Desbloqueo: al primer gesto de la persona (toque, clic o tecla) se reanuda el AudioContext
  const gestos = ['pointerdown', 'keydown', 'touchend'];
  function alGesto(e) {
    gestoVisto = true;
    // (con el bloqueo simulado, el suspend() del principio puede no haberse aplicado todavía si la página estaba
    // ocupada: el estado dice 'running' pero se va a suspender. Hasta el primer desbloqueo se reanuda igual)
    if (!contexto || (contexto.state === 'running' && !(simularBloqueo && !estado.desbloqueadoCon))) return;
    contexto.resume().then(() => {
      if (!estado.desbloqueadoCon) estado.desbloqueadoCon = e.type;
      estado.activo = contexto.state === 'running';
      avisar();
    }).catch(() => {});
  }
  for (const g of gestos) objetivoGestos.addEventListener(g, alGesto, { capture: true, passive: true });

  // Nivel del sonido (RMS = valor eficaz, 0 a 1) de lo que sale del juego (antes) o de lo que va a los parlantes
  const buf = new Float32Array(2048);
  function nivel(donde = 'entrada') {
    const a = donde === 'salida' ? salida : entrada;
    if (!a) return 0;
    a.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    return Math.sqrt(s / buf.length);
  }

  return {
    estado, instalar, nivel, anotar, puente, medirDemora,
    get contexto() { return contexto; },
    get nodo() { return nodo; },
    volumen(v) { estado.volumen = Math.min(1, Math.max(0, v)); guardar('mkw.volumen', estado.volumen); aplicar(); avisar(); },
    silenciar(s) { estado.silencio = !!s; guardar('mkw.silencio', estado.silencio); aplicar(); avisar(); },
    // Estadísticas del propio Chrome, si las tiene (playoutStats): cuántas veces la tarjeta tuvo que rellenar
    // porque la página no entregó a tiempo
    estadisticasChrome() {
      const p = contexto && contexto.playoutStats;
      return p ? { rellenos: p.fallbackFramesEvents, msRellenos: p.fallbackDuration, latenciaMs: p.averageLatency } : null;
    },
    detener() { for (const g of gestos) objetivoGestos.removeEventListener(g, alGesto, { capture: true }); },
  };
}
