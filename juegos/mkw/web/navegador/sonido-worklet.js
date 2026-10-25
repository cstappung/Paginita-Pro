// El "parlante" del juego: un AudioWorklet que toca lo que el juego mezcla, con una cola corta (§88).
//
// Resumen: antes, SDL3 entregaba el sonido con un ScriptProcessorNode, que corre en el hilo de la página (el mismo del
// juego) y pide bloques grandes (2048 muestras = 43 ms) para no cortarse cuando la página está ocupada; con la cola de
// 60 ms del runtime, el sonido se oía ~100–150 ms después de que el juego lo mezclaba. Este archivo corre en el HILO
// DE AUDIO del navegador (un hilo aparte, de alta prioridad) y le entrega a la tarjeta 128 muestras por vez (2,7 ms).
// El juego le manda lo que mezcla por mensajes (postMessage, sin memoria compartida: el sitio no tiene COOP/COEP) y
// esto lo guarda en una cola circular (un FIFO, como el búfer de un conversor) de la que la tarjeta va sacando.
//
//   juego → (3 ms por vez, por mensaje) → [cola de ~25 ms] → 128 muestras cada 2,7 ms → cadena de la página → parlantes
//
// - Objetivo de la cola: lo que debe haber esperando, en promedio (el ajuste de ritmo del runtime, un PI, la mantiene
//   ahí). Su valor de reposo es `objetivoMs` (25) y es ADAPTABLE, como el búfer antisaltos de una llamada por
//   internet: si la cola se vacía con sonido (un corte que se OYE) por un tirón corto de la página, sube lo que faltó
//   (+5 ms de margen, tope 120 ms); con 3 s sin cortes baja hacia el reposo (un 20 % de lo que sobra por segundo, y al
//   menos 2 ms por segundo; solo cuenta la calma CON sonido, y solo si en los últimos 4 s la cola nunca bajó de 8 ms:
//   en una PC lenta se queda donde no se corta). Empieza ALTO (`arranqueMs`, 80): mientras el juego
//   arranca lee el disco y arma pipelines, se traba seguido, y la música del título suena justo ahí; con calma baja
//   sola (~15 s de música sin cortes). No la suben: un
//   tirón largo (> 100 ms: la pestaña escondida, el disco), que ninguna cola razonable taparía, ni un vacío en
//   silencio (en las cargas del arranque el juego no suena y se traba mucho: nadie oye ese vacío).
// - Silencio de más: si en la cola sobra y lo que viene es silencio, se descarta enseguida (no se oye nada): así la
//   demora vuelve al objetivo sin esperar al ajuste de ritmo.
// - Cola vacía (el juego no llegó a tiempo): en vez de saltar a cero de golpe (un "clic"), la última muestra se apaga
//   en ~1,5 ms; se espera a juntar el objetivo y se vuelve con un fundido de entrada de 2,7 ms. Cuenta un "vacío" y,
//   si había sonido, un "hueco" (un corte que se oye).
// - Cola de más (llegó un montón junto, p. ej. después de un tirón): si pasa el objetivo + max(30 ms, objetivo), se
//   salta lo viejo hasta quedar en el objetivo, con un fundido cruzado de 2,7 ms (un "salto").
// - Mide: nivel de la cola (promedio y mínimo), vacíos, huecos, saltos y, para medir la demora con un clic, en qué
//   muestra salió el clic (la página lo convierte en "cuándo se oyó").
// Mensajes que recibe: Float32Array (izq, der, izq, der…) = sonido; {t:'reiniciar'} = vaciar y volver a llenar;
// {t:'marca'} = avisar en qué muestra sale el próximo clic; {t:'objetivo', ms} = cambiar el objetivo de partida.
// Mensajes que manda: {t:'e', …} cada 8 bloques (~21 ms) con el estado; {t:'m', cuadro} cuando sale el clic.

const MS = ms => Math.round(ms * sampleRate / 1000);   // ms → muestras (cuadros de sonido) a la frecuencia de la tarjeta

class SalidaMkw extends AudioWorkletProcessor {
  constructor(opciones) {
    super();
    const o = (opciones && opciones.processorOptions) || {};
    this.cap = MS(1000);                         // la cola circular guarda hasta 1 s (nunca debería llenarse)
    this.izq = new Float32Array(this.cap);       // canal izquierdo
    this.der = new Float32Array(this.cap);       // canal derecho
    this.lee = 0;                                // por dónde va leyendo la tarjeta
    this.nivel = 0;                              // cuántas muestras esperan en la cola
    this.base = MS(o.objetivoMs || 25);          // objetivo de reposo
    this.objetivo = Math.max(this.base, MS(o.arranqueMs ?? 80));   // objetivo actual: alto en el arranque, sube con los
                                                                   // cortes y baja con la calma
    this.maximo = MS(o.maximoMs || 120);         // el objetivo nunca pasa de esto
    this.fase = 'llenando';                      // 'llenando' (juntando el objetivo) o 'sonando'
    this.rampa = 1;                              // ganancia del fundido de entrada (0 → 1)
    this.colaIzq = 0; this.colaDer = 0;          // la última muestra, que se apaga suave cuando la cola se vacía
    this.apagar = Math.exp(-1 / MS(1.5));        // cuánto se achica por muestra: constante de tiempo de 1,5 ms
    this.huboSonido = false;                     // ¿lo último que sonó tenía sonido? (para distinguir hueco de vacío)
    this.vacioEn = -1;                           // muestra (de la tarjeta) en que se vació la cola, o -1
    this.vacioOido = false;                      // ¿ese vacío cortó sonido? (solo entonces sube el objetivo)
    this.calma = 0;                              // muestras seguidas sin vaciarse (para ir bajando el objetivo)
    // El mínimo de la cola en los últimos ~4 s (de a 1 s): cuánto le faltó para vaciarse. El objetivo solo baja si
    // nunca bajó de 8 ms: en una PC lenta los tirones la dejan casi vacía y el objetivo se queda donde no se corta
    this.minSeg = Infinity; this.ventana = [0, 0, 0, 0]; this.contSeg = 0;
    this.buscarMarca = false;                    // ¿hay que avisar cuándo sale el próximo clic?
    // contadores (se mandan a la página)
    this.c = { recibidos: 0, sonados: 0, vacios: 0, huecos: 0, silencio: 0, saltos: 0, tirados: 0, bloques: 0, bloquesSilencio: 0,
               silencioSaltado: 0 };     // muestras de silencio descartadas (sin que se note) para bajar la demora
    this.suma = 0; this.n = 0; this.min = Infinity; this.pico = 0;   // nivel promedio, mínimo y pico de este informe
    this.port.onmessage = e => this.recibir(e.data);
  }

  recibir(m) {
    if (m instanceof Float32Array) return this.guardar(m);
    if (m.t === 'reiniciar') {
      this.nivel = 0; this.fase = 'llenando'; this.vacioEn = -1; this.vacioOido = false; this.colaIzq = this.colaDer = 0; this.huboSonido = false;
      this.ventana.fill(0); this.minSeg = Infinity;   // (la ventana vuelve a juntar 4 s antes de dejar bajar el objetivo)
    }
    else if (m.t === 'marca') this.buscarMarca = true;
    else if (m.t === 'objetivo') { this.base = MS(m.ms); this.objetivo = Math.max(this.base, Math.min(this.objetivo, this.maximo)); if (m.ya) this.objetivo = this.base; }
  }

  // Sonido nuevo del juego (izq, der intercalados): al final de la cola
  guardar(d) {
    const n = d.length >> 1;
    // Si la cola estaba vacía, lo que tardó en llegar esto es lo que faltó de cola: si el corte se oyó, el objetivo
    // sube eso (+5 ms)
    if (this.vacioEn >= 0) {
      const falto = currentFrame - this.vacioEn;
      if (this.vacioOido && falto <= MS(100)) this.objetivo = Math.min(this.maximo, this.objetivo + falto + MS(5));
      this.vacioEn = -1;
    }
    let escribe = (this.lee + this.nivel) % this.cap;
    for (let i = 0; i < n; i++) {
      this.izq[escribe] = d[2 * i];
      this.der[escribe] = d[2 * i + 1];
      if (++escribe === this.cap) escribe = 0;
    }
    this.nivel += n;
    this.c.recibidos += n;
    if (this.nivel > this.cap) {                 // la cola desbordó (no debería pasar): se pierde lo más viejo
      const sobra = this.nivel - this.cap;
      this.lee = (this.lee + sobra) % this.cap; this.nivel = this.cap; this.c.tirados += sobra; this.c.saltos++;
    }
  }

  // Lo que pide la tarjeta: 128 muestras por canal
  process(_entradas, salidas) {
    const sal = salidas[0], L = sal[0], R = sal[1] || sal[0], N = L.length;
    this.c.bloques++;
    this.suma += this.nivel; this.n++; if (this.nivel < this.min) this.min = this.nivel;
    if (this.fase === 'sonando' && this.nivel < this.minSeg) this.minSeg = this.nivel;
    if ((this.contSeg += N) >= sampleRate) {    // cada segundo, el mínimo de ese segundo entra a la ventana
      this.ventana.shift(); this.ventana.push(this.minSeg); this.minSeg = Infinity; this.contSeg = 0;
    }
    let silencio = false;

    if (this.fase === 'llenando') {
      if (this.nivel >= this.objetivo) {
        // Juntó el objetivo: si sobra (llegó todo junto), se descarta lo viejo (igual vuelve con fundido de entrada)
        if (this.nivel > this.objetivo + 1) { const s = Math.floor(this.nivel - this.objetivo); this.lee = (this.lee + s) % this.cap; this.nivel -= s; }
        this.fase = 'sonando'; this.rampa = 0;
      }
    } else if (this.nivel > this.objetivo + MS(3) && this.silencioDeMas()) {
      // (descartó silencio de más: nada que se oiga; si todavía sobra mucho, el bloque que viene lo ve)
    } else if (this.nivel > this.objetivo + Math.max(MS(30), this.objetivo) + N) {
      // Demasiado en la cola y no es silencio: saltar hasta el objetivo con un fundido cruzado (lo de ahora baja, lo
      // de adelante sube). Último recurso: casi nunca pasa (después de un vacío la cola vuelve de cero)
      const s = Math.floor(this.nivel - this.objetivo) - N;   // (el objetivo puede tener decimales: baja de a poco)
      for (let i = 0; i < N; i++) {
        const a = (this.lee + i) % this.cap, b = (this.lee + s + i) % this.cap, w = (i + 0.5) / N;
        L[i] = this.izq[a] * (1 - w) + this.izq[b] * w;
        R[i] = this.der[a] * (1 - w) + this.der[b] * w;
      }
      this.lee = (this.lee + s + N) % this.cap; this.nivel -= s + N;
      this.c.saltos++; this.c.tirados += s; this.c.sonados += N;
      return this.cerrar(L, R, N, false);
    }

    if (this.fase === 'sonando') {
      const k = Math.min(N, this.nivel);         // lo que hay (todo el bloque, salvo que la cola se vacíe)
      for (let i = 0; i < k; i++) {
        if (this.rampa < 1) this.rampa = Math.min(1, this.rampa + 1 / N);   // fundido de entrada de un bloque
        L[i] = this.izq[this.lee] * this.rampa;
        R[i] = this.der[this.lee] * this.rampa;
        if (++this.lee === this.cap) this.lee = 0;
      }
      this.nivel -= k; this.c.sonados += k;
      if (k > 0) { this.colaIzq = L[k - 1]; this.colaDer = R[k - 1]; }
      if (k < N) {
        // Se vació: el resto del bloque es la última muestra apagándose (sin clic), y a juntar el objetivo de nuevo
        this.fase = 'llenando'; this.vacioEn = currentFrame + k; this.c.vacios++;
        this.vacioOido = this.huboSonido || Math.abs(this.colaIzq) > 1e-4 || Math.abs(this.colaDer) > 1e-4;
        if (this.vacioOido) this.c.huecos++;
        this.calma = 0; this.ventana.fill(0); this.minSeg = 0;   // (un vacío: 4 s sin bajar el objetivo)
        this.apagando(L, R, k, N);
        silencio = true;
      }
    } else {
      this.apagando(L, R, 0, N);                 // todavía juntando: silencio (o el final del apagado)
      silencio = true;
    }
    return this.cerrar(L, R, N, silencio);
  }

  // Sobra cola: si lo que viene es silencio (al menos 1 ms seguido), se descarta hasta el objetivo. Los dos bordes son
  // silencio, así que no hay salto que se oiga. Devuelve si descartó algo
  silencioDeMas() {
    const max = Math.floor(this.nivel - this.objetivo);
    let s = 0, i = this.lee;
    while (s < max && Math.abs(this.izq[i]) < 1e-4 && Math.abs(this.der[i]) < 1e-4) { s++; if (++i === this.cap) i = 0; }
    if (s < MS(1)) return false;
    this.lee = i; this.nivel -= s; this.c.silencioSaltado += s;
    return true;
  }

  // La última muestra se achica de a poco (1,5 ms) hasta cero: así un corte no suena como un golpe
  apagando(L, R, desde, N) {
    for (let i = desde; i < N; i++) {
      this.colaIzq *= this.apagar; this.colaDer *= this.apagar;
      L[i] = this.colaIzq; R[i] = this.colaDer;
    }
    if (Math.abs(this.colaIzq) < 1e-6) this.colaIzq = 0;
    if (Math.abs(this.colaDer) < 1e-6) this.colaDer = 0;
    this.c.silencio += N - desde;
  }

  cerrar(L, R, N, silencio) {
    let pico = 0;
    for (let i = 0; i < N; i += 4) { const v = Math.abs(L[i]); if (v > pico) pico = v; }   // 1 de cada 4 alcanza
    if (!silencio) this.huboSonido = pico > 1e-4;
    if (pico > this.pico) this.pico = pico;
    if (silencio) this.c.bloquesSilencio++;
    // El clic de la medición de la demora: ¿en qué muestra de la tarjeta salió?
    if (this.buscarMarca) {
      for (let i = 0; i < N; i++) if (Math.abs(L[i]) > 0.25) { this.port.postMessage({ t: 'm', cuadro: currentFrame + i }); this.buscarMarca = false; break; }
    }
    // Calma: con 3 s SONANDO sin cortes, el objetivo baja hacia el reposo: un 20 % de lo que sobra por segundo (como la
    // descarga de un capacitor, constante de tiempo 5 s), y al menos 2 ms por segundo. El ajuste de ritmo, que mueve
    // hasta 0,6 % = 6 ms por segundo, lo sigue; y en el silencio se descarta lo que sobra. El silencio no cuenta como
    // calma (solo la pausa): en el arranque el juego calla mientras carga, y justo cuando arranca la música del título
    // es cuando más se traba (se precalientan los pipelines)
    if (this.fase === 'sonando' && pico > 1e-4) {
      this.calma += N;
      // (y solo si la cola ya lo alcanzó, ±15 ms: así el ajuste de ritmo la sigue con ~0,3 % y no va al tope)
      if (this.calma > MS(3000) && this.objetivo > this.base && Math.min(this.minSeg, ...this.ventana) > MS(8) &&
          this.nivel < this.objetivo + MS(15)) {
        const porSegundo = Math.max(MS(2), (this.objetivo - this.base) * 0.2);   // muestras por segundo
        this.objetivo = Math.max(this.base, this.objetivo - porSegundo * N / sampleRate);
      }
    }
    // Informe cada 8 bloques (~21 ms a 48 kHz)
    if (this.n >= 8) {
      const ms = 1000 / sampleRate;
      this.port.postMessage({ t: 'e', nivel: this.suma / this.n * ms, min: this.min * ms, objetivo: this.objetivo * ms,
                              pico: this.pico, fase: this.fase, ...this.c });
      this.suma = 0; this.n = 0; this.min = Infinity; this.pico = 0;
    }
    return true;                                 // seguir vivo aunque no haya entradas
  }
}

registerProcessor('mkw-salida', SalidaMkw);
