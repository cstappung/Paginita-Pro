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
// Uso:  const sonido = crearSonido({ alCambiar });  sonido.instalar();  (antes de cargar el juego)
//       sonido.volumen(0.5); sonido.silenciar(true); sonido.estado (para mostrar y para las pruebas)

const leer = (clave, porDefecto) => { try { const v = localStorage.getItem(clave); return v === null ? porDefecto : JSON.parse(v); } catch { return porDefecto; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };

// simularBloqueo: el AudioContext arranca suspendido aunque el navegador lo deje sonar. Sirve para las pruebas:
// Chrome manejado por Playwright (--enable-automation) nunca bloquea el sonido, y hay que probar el desbloqueo.
export function crearSonido({ alCambiar = null, objetivoGestos = window, simularBloqueo = false } = {}) {
  const estado = {
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
    msBloqueTotal: 0,        // tiempo total que SDL3 tardó en llenar bloques (le quita tiempo al juego)
    msBloqueMax: 0,          // el bloque que más tardó
  };
  let contexto = null, volumen = null, entrada = null, salida = null;
  let gestoVisto = false;    // ¿ya hubo un gesto de la persona? (con el bloqueo simulado, antes no se reanuda)
  let anteriorConSonido = false, silenciosSeguidos = 0;
  const avisar = () => { if (alCambiar) alCambiar(estado); };

  // El volumen que de verdad se aplica (0 si está en silencio). Una curva al cuadrado: el oído percibe el volumen
  // de forma logarítmica, y así la mitad de la barra "suena a la mitad" (con lineal, casi todo pasa arriba).
  const ganancia = () => (estado.silencio ? 0 : estado.volumen * estado.volumen);
  const aplicar = () => { if (volumen) volumen.gain.setTargetAtTime(ganancia(), contexto.currentTime, 0.02); };

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
        contexto = this;
        estado.contextos++;
        estado.frecuencia = this.sampleRate;
        entrada = new AnalyserNode(this, { fftSize: 2048 });
        volumen = new GainNode(this, { gain: ganancia() });
        salida = new AnalyserNode(this, { fftSize: 2048 });
        entrada.connect(volumen).connect(salida).connect(destinoReal.call(this));
        if (simularBloqueo) this.suspend();       // como si el navegador lo bloqueara
        this.addEventListener('statechange', () => { estado.activo = this.state === 'running'; avisar(); });
        estado.activo = this.state === 'running';
        avisar();
      }
      get destination() { return entrada; }      // SDL3 se conecta "a la salida" = a nuestra cadena
      // Con el bloqueo simulado, solo un gesto de la página puede reanudar el sonido. SDL3 también llama a resume()
      // por su cuenta, y bajo Playwright cualquier evaluate() cuenta como "gesto", así que a veces se desbloqueaba
      // antes del clic de la prueba (falla intermitente "sonaba sin gesto")
      resume() { return simularBloqueo && !gestoVisto ? Promise.resolve() : super.resume(); }
      createScriptProcessor(...args) {
        // El nodo de SDL3: cada vez que SDL3 llena un bloque, también lo anotamos en el medidor
        const nodo = super.createScriptProcessor(...args);
        Object.defineProperty(nodo, 'onaudioprocess', {
          get: () => alProcesar.get.call(nodo),
          set: fn => alProcesar.set.call(nodo, fn ? e => {
            const t0 = performance.now();
            fn(e);                                   // SDL3 mezcla y copia el bloque (en el hilo del juego)
            const ms = performance.now() - t0;
            estado.msBloqueTotal += ms;
            if (ms > estado.msBloqueMax) estado.msBloqueMax = ms;
            anotar(e.outputBuffer);
          } : null),
        });
        return nodo;
      }
    }
    AudioContextMkw.mkwPropio = true;
    window.AudioContext = AudioContextMkw;
    if (window.webkitAudioContext) window.webkitAudioContext = AudioContextMkw;
  }

  // Desbloqueo: al primer gesto de la persona (toque, clic o tecla) se reanuda el AudioContext
  const gestos = ['pointerdown', 'keydown', 'touchend'];
  function alGesto(e) {
    gestoVisto = true;
    if (!contexto || contexto.state === 'running') return;
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
    estado, instalar, nivel, anotar,
    get contexto() { return contexto; },
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
