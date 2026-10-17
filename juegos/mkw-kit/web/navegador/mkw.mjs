// Arranca Mario Kart Wii + Retro Rewind (compilado a wasm, con aurora de verdad) en esta página.
//
// Resumen, en orden:
//   1. Revisa que el navegador tenga WebGPU (dibujar) y JSPI (dejar que el juego "espere" sin congelar la página).
//   2. Pide el manifiesto: la lista de archivos (ruta y tamaño) que el juego verá en su disco.
//   3. Baja enteros los archivos chicos que el juego lee "a la antigua" (sys/ del disco, el XML de Retro Rewind,
//      las partidas, los archivos base del runtime): ~10 MB.
//   4. Carga el juego (mkw.js + mkw.wasm) y, antes de su main(), le arma un sistema de archivos en memoria
//      (MEMFS): los archivos chicos con su contenido; los grandes (2,5 GB del disco + 2 GB de RR) solo con su
//      nombre y tamaño. Cuando el juego lee uno grande, el runtime llama a Module.mkwLeeRango y esta página
//      descarga SOLO ese pedazo (petición HTTP con Range). Con JSPI el juego queda en pausa mientras llega.
//   5. Llama a main(): el runtime arranca, aurora crea el WebGPU sobre el <canvas id="canvas"> y dibuja.
//   6. Cada segundo muestra cuadros por segundo y trabajo por cuadro, y anota las verificaciones del banco.
import { prueba } from '/banco/comun.js';
import { crearControles, ACCIONES, BOTON, nombreTecla } from '/web/navegador/controles.mjs';
import { crearSonido } from '/web/navegador/sonido.mjs';
import { crearGuardado } from '/web/navegador/guardado.mjs';
import { crearDisco } from '/web/navegador/disco.mjs';
import { crearPipelines } from '/web/navegador/pipelines.mjs';
import { largoEncabezadoBrsar, gruposBrsar } from '/web/navegador/brsar.mjs';

const parametros = new URLSearchParams(location.search);
const TRAZA_DISCO = parametros.has('trazaDisco');   // anotar cada lectura del disco que hace el juego (bitácora §52)
const CUADROS_PRUEBA = Number(parametros.get('cuadros') || 0);   // 0 = jugar sin fin
const { ok, nota, fin } = prueba('juego', 'Juego en el navegador (fase 3)');
const $ = id => document.getElementById(id);

// Un registro (log) en pantalla y en la consola; Playwright lee la consola.
const logCaja = $('log');
const lineasLog = [];          // las últimas 400 líneas (lo que se ve en pantalla)
const todoElLog = [];           // todas, para las verificaciones
let pintarPendiente = false;
const escribe = texto => {
  console.log(texto);
  todoElLog.push(texto);
  lineasLog.push(texto);
  if (lineasLog.length > 400) lineasLog.shift();
  // Redibujar el cuadro de texto cuesta: se hace como mucho una vez por cuadro de pantalla, no por línea
  if (!pintarPendiente) {
    pintarPendiente = true;
    requestAnimationFrame(() => {
      pintarPendiente = false;
      logCaja.textContent = lineasLog.join('\n');
      logCaja.scrollTop = logCaja.scrollHeight;
    });
  }
};
window.mkwEstado = { log: todoElLog, cuadros: 0, fps: 0, trabajo: 0, lecturas: 0, bytes: 0 };   // para las pruebas

// ¿Qué archivos se bajan enteros al inicio? Los que el runtime abre con el sistema de archivos normal (no por
// el lector del disco). Todo lo demás queda "perezoso" y se descarga por pedazos cuando se lee.
const precargar = (prefijo, ruta) =>
  prefijo === '/wc/runtime/assets/' || prefijo === '/mkw/sd/riivolution/' ||
  (prefijo === '/mkw/disco/' && ruta.startsWith('sys/')) ||
  (prefijo === '/mkw/sd/RetroRewind6/' && /\.(xml|txt)$/i.test(ruta));

// ---- Reloj del monitor (para enganchar el reloj de la "tele" del juego al refresco de la pantalla) ----
// requestAnimationFrame (rAF) llama a `tic` una vez por refresco, con la hora de ese refresco (en ms, la misma
// base de tiempo que usa el juego). De ahí sale:
//   t = hora del último refresco,  p = período (ms entre refrescos, la mediana de los últimos 60: 16,67 en 60 Hz)
// El runtime (vi.cpp) lee t y p para correr su reloj, y usa esperaHasta() para despertar justo con un refresco.
// Con ?enganche=0 en la dirección no se le ofrece nada de esto al juego (para comparar con y sin enganche).
const ENGANCHE = parametros.get('enganche') !== '0';
// Ajuste fino del ritmo del sonido (parche en audio_backend.cpp): ?ajusteSonido=0 lo apaga para comparar
const AJUSTE_SONIDO = parametros.get('ajusteSonido') !== '0';

// ---- Tarjeta de video ----
// La página no la elige (en Windows, Chrome usa la que Windows le asignó y no hace caso al pedido de la página):
// se pide "alto rendimiento" (por si algún navegador sí hace caso) y se muestra cuál dio. ?gpu=bajo|auto en la
// dirección cambia el pedido (solo para pruebas). Se le pasa a aurora (Module.mkwGpuPreferencia, ver gpu.cpp).
const GPU = parametros.get('gpu') || 'alto';
const PREFERENCIA = { alto: 'high-performance', bajo: 'low-power' }[GPU];  // auto → sin preferencia

// Al abrir la página: qué tarjeta da el navegador, y si hace caso al pedido. Se le pide una de cada tipo: si da la
// MISMA para "alto rendimiento" y "bajo consumo", el pedido no cuenta, y se ofrece (plegada) la ayuda para
// cambiarla desde Windows.
const revisionGpu = (async () => {
  if (!navigator.gpu) return { adaptador: null, nombreGpu: 'sin WebGPU', ignora: false };
  const nombreDe = a => {
    const i = (a && a.info) || {};
    return (`${i.vendor || '?'} ${i.architecture || ''} ${i.description || ''}`.trim() + (i.isFallbackAdapter ? ' (POR SOFTWARE)' : ''));
  };
  const [adaptador, rapida, ahorro] = await Promise.all([
    navigator.gpu.requestAdapter(PREFERENCIA ? { powerPreference: PREFERENCIA } : {}),
    navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }),
    navigator.gpu.requestAdapter({ powerPreference: 'low-power' }),
  ]);
  const nombreGpu = nombreDe(adaptador);
  const ignora = nombreDe(rapida) === nombreDe(ahorro);
  document.getElementById('gpuEnUso').textContent = '🎮 tarjeta de video: ' + nombreGpu;
  document.getElementById('gpuAyuda').hidden = !ignora;
  window.mkwEstado.gpu = { pedida: GPU, dada: nombreGpu, ignora };
  return { adaptador, nombreGpu, ignora };
})();
// Traza del ritmo (?traza=1, diagnóstico): guarda con hora cada refresco, cada espera del juego y cada cuadro
// entregado, y al final la vuelca a la consola en líneas "[traza] [...]" para analizarla fuera (ver
// herramientas/analizar-traza.mjs). Códigos: 'r' = refresco (valor = hora del rAF), 'v' = lo que vio el medidor
// (valor = contador de cuadros), 'e' = el juego pide esperar (valor = vencimiento), 'w' = la espera se cumple
// (valor: 1 refresco, 5 ya había pasado, 2 tarde, 0 servicio), y del runtime (vi.cpp): 1/2 = antes/después de
// aurora_end_frame, 3 = empieza el cuadro (valor = vencimiento al que se ajustó), 4 = volvió la espera.
const TRAZA = parametros.get('traza') === '1';
const traza = [];
let moduloTraza = null;                       // el módulo del juego, para leer sus contadores desde la traza
const anota = (codigo, valor) => {
  if (!TRAZA) return;
  const e = [codigo, +performance.now().toFixed(3), +(+valor).toFixed(3)];
  // en la entrega (1) y al volver aurora (2), también los contadores de espera: la del runtime (retrace, pausas) y la
  // del disco, para que herramientas/tiempos-cuadro.mjs los descuente del tiempo del juego
  if ((codigo === 1 || codigo === 2) && moduloTraza) e.push(+moduloTraza._mkw_web_ms_espera().toFixed(3), +msEsperaDisco.toFixed(3));
  if (traza.length < 400000) traza.push(e);
  if (codigo === 1) console.timeStamp('mkw1');      // marca para la traza de Chrome (prueba-navegador.mjs)
};
window.mkwTrazaRitmo = () => traza;          // guion.mjs --traza la vuelca sin esperar al final de la prueba
// Dónde debe caer la "toma" del canvas dentro del refresco (bitácora §43). El juego casi no le devuelve el control
// al navegador: solo en una pausa dentro de aurora_end_frame (aurora espera su hora de presentar). En esa pausa el
// navegador corre su "actualización de la pantalla" y TOMA el canvas nuevo; ~COMPOSITOR_MS después (medido con la
// traza de Chrome: dibujar ~0,4 ms + entregarlo a Windows ~1,6 ms) el compositor lo presenta, y se ve en el refresco
// siguiente. Si esa presentación cae cerca de un refresco, a veces llega y a veces no: el cuadro dura 3 o 5
// refrescos en vez de 4 (a 240 Hz). Por eso la toma se pone a la mitad del refresco menos COMPOSITOR_MS: así la
// presentación queda a la mitad, lo más lejos posible de los dos refrescos vecinos.
//   ?toma=X    la toma a X ms después de un refresco (para probar)
//   ?faseVi=X  la fase del reloj VI fija en X ms (0.25 = como antes de §43, para comparar)
const COMPOSITOR_MS = 2;
const TOMA = parametros.has('toma') ? Number(parametros.get('toma')) : null;
const FASE_VI = parametros.has('faseVi') ? Number(parametros.get('faseVi')) : null;

// ---- Esperar cediendo (bitácora §48) ----
// Mientras espera la próxima "tele" (retrace), el juego ya no gira: le pide a la página "despiértame con el refresco
// justo antes del vencimiento" (esperaHasta) y gira solo lo que falta desde ese refresco (FASE_CEDER, menos de 1 ms).
// Así el procesador descansa y el navegador dibuja, suena y lee los controles en ese rato. Dos detalles:
//  - el juego se despierta en una TAREA NUEVA (enTareaNueva), no dentro del rAF: si siguiera dentro, entregaría su
//    cuadro en medio de la actualización de la pantalla y el navegador lo tomaría en ese mismo refresco, tarde.
//    Despertando después, el cuadro se entrega ~2 ms después del refresco y se toma SIEMPRE en el refresco
//    siguiente; el compositor lo presenta ~2 ms más tarde: a la mitad del refresco (a 240 Hz).
//  - los avisos de servicio (cada 1 ms, para el sonido y las alarmas del juego) también salen de una tarea nueva:
//    Chrome alarga a 4 ms los setTimeout encadenados (uno pedido desde otro más de 5 veces seguidas).
// ?ceder=0: el juego gira como antes, con la fase que se mide sola (§43), para comparar.
const CEDER = parametros.get('ceder') !== '0';
const FASE_CEDER = 0.75;
const enTareaNueva = (() => {
  const canal = new MessageChannel(), cola = [];
  canal.port1.onmessage = () => cola.shift()();
  return f => { cola.push(f); canal.port2.postMessage(0); };
})();
const relojMonitor = {
  t: 0, p: 0, n: 0, deltas: [], esperas: [],
  entregado: 0, retrace: 0, desfases: [], fase: null, tomaAnterior: 0, huecosToma: {}, fotos: [],
  valido() { return this.deltas.length >= 30 && performance.now() - this.t < 100; },  // pestaña oculta → no
  tic(hora) {
    if (this.entregado) {
      // Primer refresco después de que el juego entregó un cuadro: el navegador toma el canvas AHORA. Se guarda
      // cuánto pasó desde la "tele" (retrace) del cuadro hasta la toma (los últimos 240 cuadros, 4 s), y cuántos
      // refrescos pasaron desde la toma anterior.
      const ahora = performance.now();
      if (ahora - this.retrace < 50) {
        this.desfases.push(ahora - this.retrace);
        if (this.desfases.length > 240) this.desfases.shift();
      }
      if (this.tomaAnterior && this.p && this.contar) {
        const k = Math.round((ahora - this.tomaAnterior) / this.p);
        this.huecosToma[k] = (this.huecosToma[k] || 0) + 1;
      }
      this.tomaAnterior = ahora;
      this.entregado = 0;
      // Fotos del canvas pedidas por las verificaciones: AHORA el canvas todavía tiene el cuadro recién entregado.
      // Después de esta actualización de la pantalla, WebGPU lo presenta y el canvas queda vacío para leerlo
      // (y desde §48 la página corre también entre cuadros, cuando ya está vacío). Ver fotoCanvas.
      for (const f of this.fotos.splice(0)) f();
    }
    if (this.t) {
      // Mientras el juego calcula (~7 ms) Chrome no puede llamar a rAF y se "pierden" refrescos: un salto puede
      // valer 1, 2 o 3 refrescos. Por eso: p0 = el salto más corto típico (percentil 20); cada salto cuenta como
      // round(salto / p0) refrescos; p = suma de saltos / suma de refrescos (preciso: promedia ~2 s).
      this.deltas.push(hora - this.t);
      if (this.deltas.length > 240) this.deltas.shift();
      const orden = [...this.deltas].sort((a, b) => a - b);
      const p0 = orden[Math.floor(orden.length * 0.2)];
      let suma = 0, refrescos = 0;
      for (const d of this.deltas) { const k = Math.round(d / p0); if (k >= 1 && k <= 8) { suma += d; refrescos += k; } }
      this.p = refrescos ? suma / refrescos : p0;
    }
    this.t = hora; this.n++;
    anota('r', hora);
    // despertar a quien espera el refresco "justo antes" de su vencimiento (ver esperaHasta)
    this.esperas = this.esperas.filter(e => (hora >= e.desde ? (e.listo(1), false) : true));
    requestAnimationFrame(h => this.tic(h));
  },
  // El runtime avisa que va a entregar un cuadro a aurora; retraceMs = la "tele" (retrace) de ese cuadro.
  entrega(retraceMs) { this.entregado = performance.now(); this.retrace = retraceMs; },
  tomaDeseada(p) { return TOMA !== null ? TOMA : Math.max(0, p / 2 - COMPOSITOR_MS); },
  // Fase que el runtime le da a su reloj VI (ms después de un refresco; lo pide en cada cuadro): la que pone la
  // toma en tomaDeseada. desfase = mediana de retrace→toma de los últimos 4 s → fase = toma deseada − desfase,
  // dado vuelta dentro del período. Con banda muerta: la fase solo se mueve si la nueva difiere en más de
  // 0,3 ms, para que el ruido de la medida no la haga pasear (eso mismo causaba tirones). -1 = todavía sin datos
  // (el runtime usa 0,25 ms).
  objetivo(p) {
    if (FASE_VI !== null) return FASE_VI;
    if (CEDER) return FASE_CEDER;              // cediendo, la toma cae sola en el refresco siguiente (arriba)
    if (this.desfases.length < 60 || !(p > 0)) return -1;
    const orden = [...this.desfases].sort((a, b) => a - b);
    const nueva = (((this.tomaDeseada(p) - orden[orden.length >> 1]) % p) + p) % p;
    const distancia = this.fase === null ? p : Math.min(Math.abs(nueva - this.fase), p - Math.abs(nueva - this.fase));
    if (distancia > 0.3) this.fase = nueva;
    return this.fase;
  },
  // Promesa que se cumple con 1 cuando llega el último refresco antes del vencimiento (hora > vencimiento − p;
  // el runtime gira el resto, menos de un refresco), con 0 a los `servicioMs` (para que el juego atienda su sonido
  // y alarmas y vuelva a esperar), o con 2 si el vencimiento ya pasó de largo (p. ej. la pestaña se ocultó y rAF se
  // detuvo). Se cumple siempre desde una tarea nueva (ver enTareaNueva arriba).
  esperaHasta(vencimiento, servicioMs) {
    const desde = vencimiento - this.p + 0.1;
    anota('e', vencimiento);
    if (this.t >= desde) { anota('w', 5); return Promise.resolve(1); }   // ese refresco ya pasó mientras atendía otra cosa
    if (performance.now() > vencimiento + 2) { anota('w', 2); return Promise.resolve(2); }
    return new Promise(listo => {
      let hecho = false;
      const fin = v => { if (hecho) return; hecho = true; this.esperas = this.esperas.filter(e => e !== espera); anota('w', v); listo(v); };
      const espera = { desde, listo: () => enTareaNueva(() => fin(1)) };
      this.esperas.push(espera);
      enTareaNueva(() => setTimeout(() => fin(0), servicioMs));
    });
  },
};
requestAnimationFrame(h => relojMonitor.tic(h));

// Foto del canvas en chico (ancho×alto, RGBA), tomada en el momento en que el navegador toma el cuadro nuevo (ver
// relojMonitor.tic). Si en 1 s no hay cuadro nuevo (juego parado), se saca igual.
const fotoCanvas = (ancho, alto) => new Promise(listo => {
  const sacar = () => {
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const g = c.getContext('2d');
    g.drawImage(document.getElementById('canvas'), 0, 0, ancho, alto);
    listo(g.getImageData(0, 0, ancho, alto).data);
  };
  let hecho = false;
  const una = () => { if (!hecho) { hecho = true; sacar(); } };
  relojMonitor.fotos.push(una);
  setTimeout(una, 1000);
});

window.mkwEstado = Object.assign(window.mkwEstado || {}, { fase: { e: 0, n: 0, ajuste: 0, enganchado: 0, cuadros: 0 } });

// ---- Sonido (web/navegador/sonido.mjs) ----
// Se instala ANTES de cargar el juego: así el AudioContext que crea SDL3 pasa por nuestro volumen y medidor.
// ?bloquearSonido=1: arranca bloqueado aunque el navegador lo deje sonar (para probar el desbloqueo; ver sonido.mjs)
const sonido = crearSonido({ alCambiar: () => pintarSonido(), simularBloqueo: parametros.get('bloquearSonido') === '1' });
if (parametros.get('sonidoPagina') !== '0') sonido.instalar();   // ?sonidoPagina=0: sin esto (para comparar)
window.mkwSonido = sonido;                  // para las pruebas
const barraVolumen = document.getElementById('volumen'), casillaSilencio = document.getElementById('silencio');
barraVolumen.value = Math.round(sonido.estado.volumen * 100);
casillaSilencio.checked = sonido.estado.silencio;
barraVolumen.addEventListener('input', () => sonido.volumen(barraVolumen.value / 100));
casillaSilencio.addEventListener('change', () => sonido.silenciar(casillaSilencio.checked));
function pintarSonido() {
  const e = sonido.estado;
  document.getElementById('volumenDato').textContent = e.silencio ? 'silencio' : `${Math.round(e.volumen * 100)} %`;
  // el aviso solo tiene sentido si el juego ya abrió su sonido y el navegador lo tiene bloqueado
  document.getElementById('sonidoAviso').hidden = !(e.contextos > 0 && !e.activo);
}
pintarSonido();

let disco = null;                           // la caché del disco (se crea al leer el manifiesto)
let msEsperaDisco = 0;                      // total de ms que el juego esperó lecturas del disco
// Cuánto ocupa lo guardado del disco, y borrarlo (la próxima vez se baja de nuevo)
async function pintarDatosDisco() {
  let mb = 0;
  try { const e = await navigator.storage.estimate(); mb = (e.usageDetails?.caches ?? e.usage ?? 0) / 1048576; } catch {}
  document.getElementById('datosDisco').textContent = mb >= 1 ? `${mb.toFixed(0)} MB guardados (la próxima vez no se bajan)` : 'nada todavía';
}
pintarDatosDisco();
document.getElementById('borrarDisco').addEventListener('click', async () => {
  if (!confirm('¿Borrar los archivos del juego guardados en este navegador? Las partidas no se tocan; la próxima vez se bajan de nuevo.')) return;
  for (const n of await caches.keys()) if (n.startsWith('mkw-disco:')) await caches.delete(n);
  pintarDatosDisco();
});

// ---- Partidas guardadas (web/navegador/guardado.mjs) ----
// Se leen de IndexedDB al abrir la página; se restauran antes del main() del juego y se guardan solas al escribirse.
const guardado = crearGuardado({ alCambiar: () => pintarPartidas() });
window.mkwGuardado = guardado;              // para las pruebas
const guardadosAlAbrir = guardado.cargar().catch(e => { guardado.estado.error = String(e); return new Map(); });
// Pipelines para precalentar (pipelines.mjs): la lista de este navegador y la semilla del servidor.
// ?precalentar=no: sin listas (para medir el peor caso, la primera visita sin semilla).
const pipelines = crearPipelines();
const listasAlAbrir = parametros.get('precalentar') === 'no' ? Promise.resolve({}) : pipelines.cargar();
function pintarPartidas() {
  const e = guardado.estado;
  const hora = e.ultimoGuardado ? `, guardado a las ${new Date(e.ultimoGuardado).toLocaleTimeString()}` : '';
  document.getElementById('partidas').textContent = e.error ? `error: ${e.error}`
    : e.archivos ? `${e.archivos} archivos en este navegador${hora}` : 'ninguna todavía (se guardan solas al jugar)';
}
document.getElementById('borrarPartidas').addEventListener('click', async () => {
  if (!confirm('¿Borrar las licencias, ajustes y fantasmas guardados en este navegador? No se puede deshacer.')) return;
  await guardado.borrarTodo();
  location.reload();                        // el juego en memoria todavía tiene la partida: se recarga limpio
});

// Descargar todas las partidas en un archivo (.mkwp) y cargarlas en otro navegador. En el sitio, ese mismo
// archivo es el que se sube a Firebase Storage para tener la partida en la nube.
document.getElementById('bajarPartidas').addEventListener('click', async () => {
  const blob = await guardado.exportar();
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'partidas-mkw.mkwp' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});
const archivoPartidas = document.getElementById('archivoPartidas');
document.getElementById('subirPartidas').addEventListener('click', () => archivoPartidas.click());
archivoPartidas.addEventListener('change', async () => {
  const f = archivoPartidas.files[0];
  if (!f || !confirm('¿Reemplazar las partidas de este navegador por las del archivo? Se recarga la página.')) return;
  try { await guardado.importar(f); location.reload(); }
  catch (e) { alert('No se pudo cargar: ' + e.message); }
});

// ---- Controles (web/navegador/controles.mjs) ----
// Funcionan desde que se abre la página; hasta que el juego arranca, lo que juntan no va a ningún lado.
let enviarAlJuego = () => {};
const controles = crearControles({
  enviar: (...estado) => enviarAlJuego(...estado),
  contenedorTactil: document.getElementById('pantalla'),
  alCambiar: () => pintarTeclas(),
});
window.mkwControles = controles;            // para las pruebas
const esCelular = matchMedia('(pointer: coarse)').matches;   // pantalla táctil como puntero principal
const casillaTactil = document.getElementById('usarTactil');
casillaTactil.checked = esCelular;
// Mando táctil prendido: el recuadro del juego pasa a ocupar la pantalla (body.tactil) y aparecen sus ajustes
const usarTactil = si => {
  controles.tactil(si);
  document.body.classList.toggle('tactil', si);
  document.getElementById('ajustesTactil').hidden = !si;
};
usarTactil(esCelular);
casillaTactil.addEventListener('change', () => usarTactil(casillaTactil.checked));
const tamTactil = document.getElementById('tamTactil'), opaTactil = document.getElementById('opaTactil');
const pintarAjustesTactil = () => {
  const a = controles.ajustesTactil();
  tamTactil.value = Math.round(a.esc * 100); opaTactil.value = Math.round(a.opa * 100);
  document.getElementById('tamTactilDato').textContent = `${Math.round(a.esc * 100)} %`;
  document.getElementById('opaTactilDato').textContent = `${Math.round(a.opa * 100)} %`;
};
tamTactil.addEventListener('input', () => { controles.ajustarTactil({ esc: tamTactil.value / 100 }); pintarAjustesTactil(); });
opaTactil.addEventListener('input', () => { controles.ajustarTactil({ opa: opaTactil.value / 100 }); pintarAjustesTactil(); });
pintarAjustesTactil();
document.getElementById('usarInclinacion').addEventListener('change', e => controles.inclinar(e.target.checked));
document.getElementById('completa').addEventListener('click', async () => {
  // pantalla completa y, en el celular, acostado (horizontal); si el navegador no deja girar, no pasa nada
  await document.getElementById('pantalla').requestFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
});
document.getElementById('restaurarTeclas').addEventListener('click', () => { controles.restaurarTeclas(); pintarTeclas(); });
// La tabla de teclas: una fila por acción; clic en el botón y luego la tecla nueva (Esc cancela)
function pintarTeclas() {
  const tabla = document.getElementById('tablaTeclas');
  tabla.innerHTML = '';
  for (const [id, nombre] of ACCIONES) {
    const fila = tabla.insertRow();
    fila.insertCell().textContent = nombre;
    const celda = fila.insertCell();
    const boton = document.createElement('button');
    boton.textContent = controles.esperando() === id ? 'aprieta una tecla…' : controles.teclasDe(id).map(nombreTecla).join(' / ') || '—';
    boton.addEventListener('click', () => { controles.reasignar(id); pintarTeclas(); });
    celda.append(boton);
  }
}
pintarTeclas();
// Lo que recibe el puerto 1 y qué mandos hay, 5 veces por segundo (para ver que todo responde)
const NOMBRES_BOTON = Object.entries(BOTON);
setInterval(() => {
  const p = controles.estado.puertos[0];
  if (p) {
    const apretados = NOMBRES_BOTON.filter(([, bit]) => p.botones & bit).map(([n]) => n).join(' ');
    document.getElementById('puerto1').textContent = `puerto 1: ${apretados || '—'} · stick ${p.sx},${p.sy}` + (p.gr ? ` · R ${p.gr}` : '');
  }
  const mandos = controles.estado.mandos;
  document.getElementById('listaMandos').textContent = mandos.length
    ? mandos.map(m => `${m.nombre} → puerto ${m.puerto + 1}`).join(' · ')
    : 'ninguno (aprieta un botón del mando para que el navegador lo vea)';
}, 200);

// La dirección web de un archivo del juego: es la misma ruta, con cada pedazo "escapado" (espacios → %20…)
const direccion = ruta => ruta.split('/').map(encodeURIComponent).join('/');

async function arrancar() {
  $('arrancar').disabled = true;
  // En el celular (mando táctil), llevar el recuadro del juego a la pantalla: arriba quedan opciones y textos
  if (document.body.classList.contains('tactil')) $('pantalla').scrollIntoView({ block: 'start' });

  // 1) Lo que el navegador necesita
  const hayJspi = 'Suspending' in WebAssembly;
  const { adaptador, nombreGpu, ignora } = await revisionGpu;
  if (!ok('el navegador tiene WebGPU y JSPI', !!adaptador && hayJspi,
          `WebGPU ${adaptador ? 'sí' : 'no'}, JSPI ${hayJspi ? 'sí' : 'no'}`)) return fin();
  nota(`GPU pedida: ${GPU}; la que dio el navegador: ${nombreGpu}`);
  if (ignora) nota('el navegador ignora la elección de tarjeta (da la misma para alto rendimiento y bajo consumo)');

  // 2) Manifiesto
  const respuestaManifiesto = await fetch('/manifiesto.json');
  const manifiesto = await respuestaManifiesto.json();
  // Caché del disco (disco.mjs): lo bajado queda en este navegador; la versión de los archivos la da el servidor
  // ?adelantar=0: sin bajar antes (ni avisos del juego ni lectura seguida), para comparar (bitácora §52)
  disco = crearDisco({ version: respuestaManifiesto.headers.get('X-Mkw-Version') || 'sin-version',
                       adelantarActivo: parametros.get('adelantar') !== '0' });
  await disco.abrir();
  window.mkwDisco = disco;
  const tamaños = new Map();          // ruta del juego → tamaño, solo de los archivos perezosos
  const aBajar = [];
  const carpetasVacias = [];                  // [ruta del juego, tamaño] de los archivos que se bajan enteros
  let total = 0;
  for (const [prefijo, archivos] of Object.entries(manifiesto)) {
    for (const [ruta, tam] of archivos) {
      const completa = prefijo + ruta;
      if (tam < 0) { carpetasVacias.push(completa); continue; }   // carpeta vacía: solo se crea
      total++;
      if (precargar(prefijo, ruta)) aBajar.push([completa, tam]);
      else tamaños.set(completa, tam);
    }
  }
  ok('manifiesto del disco', total > 6000, `${total} archivos (${tamaños.size} perezosos)`);

  // 3) Bajar los chicos, de a 16 a la vez
  const t0 = performance.now();
  const contenidos = new Map();
  let siguiente = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (siguiente < aBajar.length) {
      const [ruta] = aBajar[siguiente++];
      contenidos.set(ruta, await disco.entero(direccion(ruta)));   // de la caché si ya se bajó antes
    }
  }));
  const mb = [...contenidos.values()].reduce((s, d) => s + d.length, 0) / 1048576;
  ok('archivos chicos bajados', contenidos.size === aBajar.length,
     `${contenidos.size} archivos, ${mb.toFixed(1)} MB en ${(performance.now() - t0).toFixed(0)} ms`);

  // Las partidas guardadas en este navegador (se pidieron al abrir la página)
  const guardados = await guardadosAlAbrir;
  const listas = await listasAlAbrir;
  if (listas.semilla || listas.propia) nota(`pipelines para precalentar: ${pipelines.estado.semilla} de la semilla, ` +
                                            `${pipelines.estado.propia} de este navegador`);
  if (guardados.size) nota(`partidas guardadas en el navegador: ${guardados.size} archivos, ` +
                           `${([...guardados.values()].reduce((s, v) => s + v.datos.byteLength, 0) / 1048576).toFixed(1)} MB`);

  // 4) El juego
  const t1 = performance.now();
  const crear = (await import('/build/mkw.js')).default;
  let lecturas = 0, bytes = 0;
  const M = await crear({
    canvas: $('canvas'),
    mkwGpuPreferencia: GPU,
    mkwVibrar: (puerto, cmd) => controles.vibrar(puerto, cmd),   // el juego pide vibrar (pad_web.cpp)
    locateFile: f => '/build/' + f,
    print: escribe,
    printErr: t => escribe('[err] ' + t),
    // El runtime llama a esto para cada lectura del disco (ver dvd.cpp y dvd_contract.h en el parche)
    mkwLeeRango: async (ruta, inicio, largo) => {
      ruta = ruta.replace(/\/+/g, '/');
      const tam = tamaños.get(ruta);
      if (tam === undefined) return -2;                        // no es perezoso: que lo lea de la memoria
      if (inicio >= tam) return -3;
      if (TRAZA_DISCO) escribe(`[lee] ${ruta} ${inicio} ${largo}`);   // ?trazaDisco=1: cada lectura del juego (diagnóstico)
      anotarLectura(ruta, tam, inicio, largo);
      let datos;
      const t0 = performance.now();
      try { datos = await disco.leer(direccion(ruta), tam, inicio, largo); }   // bloques de 256 KB, con caché
      catch (e) { escribe('[mkw] ' + e.message); return -1; }
      msEsperaDisco += performance.now() - t0;   // el juego estuvo parado esperando estos bytes
      lecturas++; bytes += datos.length;
      window.mkwEstado.lecturas = lecturas; window.mkwEstado.bytes = bytes;
      return datos;
    },
    // El juego encontró este archivo en el índice del disco (rutas_nativo.cpp): lo va a leer enseguida, así que se
    // empieza a bajar ya, en paralelo con los otros que encontró (disco.mjs, adelantar)
    mkwAvisoLectura: (ruta, tam) => {
      ruta = ruta.replace(/\/+/g, '/');
      const t = tamaños.get(ruta);
      if (t !== undefined) disco.adelantar(direccion(ruta), t);   // solo los perezosos: los demás ya están en memoria
    },
    preRun: [m => {
      armarArchivos(m, contenidos, tamaños);
      carpetasVacias.forEach(c => m.FS.mkdirTree(c));
      guardado.restaurar(m.FS, guardados);   // encima de lo que trae el servidor (la partida vacía de RR)
      pipelines.escribir(m.FS, listas);      // aurora las lee al iniciar y las pide en segundo plano
    }],
    // Enganche al monitor (vi.cpp en el parche): sin estas tres, el juego sigue con su temporizador como en Node
    ...(ENGANCHE ? {
      mkwVsync: relojMonitor,
      mkwEsperaHasta: (vencimiento, servicioMs) => relojMonitor.esperaHasta(vencimiento, servicioMs),
      mkwSonidoAjuste: AJUSTE_SONIDO,
      mkwCeder: CEDER,
      ...(TRAZA ? { mkwTraza: anota } : {}),
      // el runtime avisa en cada cuadro: error de fase (ms), refrescos por cuadro, corrección aplicada (ms)
      mkwFaseInforme: (e, n, ajuste) => {
        const f = window.mkwEstado.fase;
        f.e = e; f.n = n; f.ajuste = ajuste; f.cuadros++;
        if (n > 0 && Math.abs(e) < 0.5) f.enganchado++;
      },
    } : {}),
  });
  moduloTraza = M;
  ok('el juego (wasm) cargó', !!M, `${(performance.now() - t1).toFixed(0)} ms`);
  window.mkw = M;

  // 6a) Ritmo contra el monitor: requestAnimationFrame se llama una vez por cada refresco de la pantalla (60 Hz
  // en un monitor común). En cada refresco se mira cuántos cuadros nuevos entregó el juego: lo ideal es 1.
  // 0 = la pantalla repitió la imagen anterior; 2 o más = se saltó una imagen. Ambos se ven como un tirón.
  // huecos[n] = cuántas veces pasaron n refrescos entre dos cuadros nuevos (en 180 Hz lo parejo es siempre 3)
  const vsync = { refrescos: 0, unoJusto: 0, repetidos: 0, saltados: 0, huecos: {} };
  window.mkwEstado.vsync = vsync;
  // El hueco se mide por HORA (rAF puede saltarse refrescos mientras el juego calcula): refrescos entre dos
  // cuadros nuevos = round((hora de este − hora del anterior) / período del monitor).
  let cuadroAnterior = 0, horaCuadroAnterior = 0;
  const alRefrescar = hora => {
    const c = M._mkw_web_cuadros();
    anota('v', c);
    relojMonitor.contar = c > 300;                   // los huecos entre tomas también cuentan desde el cuadro 300
    if (c > 300 && relojMonitor.p) {                 // después del arranque (cargas iniciales fuera)
      const d = c - cuadroAnterior;
      vsync.refrescos++;
      if (d > 0) {
        if (horaCuadroAnterior) {
          const hueco = Math.round((hora - horaCuadroAnterior) / relojMonitor.p);
          vsync.huecos[hueco] = (vsync.huecos[hueco] || 0) + 1;
        }
        horaCuadroAnterior = hora;
      }
      if (d === 1) vsync.unoJusto++; else if (d === 0) vsync.repetidos++; else vsync.saltados++;
    }
    cuadroAnterior = c;
    requestAnimationFrame(alRefrescar);
  };
  requestAnimationFrame(alRefrescar);

  // 6b) Medidor: cada segundo
  let antes = { t: performance.now(), c: 0, espera: 0 };
  let primerCuadro = false, verificado = false;
  const sonidoMedido = { nivelMax: -100, base: null, colaMin: 1e9, colaMax: -1, ritmoMin: 9, ritmoMax: 0 };
  window.mkwEstado.sonido = sonidoMedido;
  const medidas = [];
  setInterval(() => {
    const ahora = { t: performance.now(), c: M._mkw_web_cuadros(), espera: M._mkw_web_ms_espera() };
    const dc = ahora.c - antes.c, dt = ahora.t - antes.t;
    const fps = dc * 1000 / dt;
    const trabajo = dc ? ((dt - (ahora.espera - antes.espera)) / dc) : 0;
    const desde = antes.c;                     // cuadro con que empezó este segundo de medición
    ahora.disco = msEsperaDisco;
    const esperaDiscoSeg = msEsperaDisco - (antes.disco || 0);   // ms de este segundo esperando el disco
    antes = ahora;
    Object.assign(window.mkwEstado, { cuadros: ahora.c, fps, trabajo });
    $('fps').textContent = `${fps.toFixed(1)} fps`;
    $('trabajo').textContent = `trabajo ${trabajo.toFixed(2)} ms`;
    const de = disco.estado;
    $('lecturas').textContent = `disco: ${lecturas} lecturas, ${(bytes / 1048576).toFixed(1)} MB` +
      ` (red ${(de.bytesRed / 1048576).toFixed(1)} MB en ${de.pedidosRed} pedidos, ${de.bloquesCache} bloques de la caché)`;
    // Sonido: nivel en dB (0 dB = el máximo posible; −20 dB = una décima de eso; música normal: −30 a −10 dB)
    const es = sonido.estado, rms = sonido.nivel('entrada');
    const db = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
    if (es.activo) sonidoMedido.nivelMax = Math.max(sonidoMedido.nivelMax, db);
    // La cola del runtime (ms de sonido esperando a la tarjeta), el ritmo de reproducción y los bloques tirados
    const cola = M._mkw_web_sonido_cola_ms(), ritmo = M._mkw_web_sonido_ritmo(), tirados = M._mkw_web_sonido_tirados();
    if (desde >= 300 && es.activo) {
      // desde el cuadro 300 (pasada la carga del arranque) y con el sonido andando: base para contar cortes
      if (!sonidoMedido.base) sonidoMedido.base = { huecos: es.huecos, tirados };
      sonidoMedido.colaMin = Math.min(sonidoMedido.colaMin, cola);
      sonidoMedido.colaMax = Math.max(sonidoMedido.colaMax, cola);
      sonidoMedido.ritmoMin = Math.min(sonidoMedido.ritmoMin, ritmo);
      sonidoMedido.ritmoMax = Math.max(sonidoMedido.ritmoMax, ritmo);
    }
    Object.assign(sonidoMedido, { cola, ritmo, tirados });
    $('sonidoDato').textContent = !es.contextos ? 'sonido: —' : es.activo ? `sonido ${db.toFixed(0)} dB` : 'sonido bloqueado';
    if (!primerCuadro && ahora.c > 0) { primerCuadro = true; ok('primer cuadro dibujado', true, `a los ${((ahora.t - t1) / 1000).toFixed(1)} s`); }
    // Solo cuentan los segundos que EMPIEZAN pasado el cuadro 420: el título carga sus archivos entre los cuadros
    // ~300 y ~360 (Code.pul de Retro Rewind, Title.szs, 2.416 búsquedas en el índice), y en la primera visita ese
    // segundo espera a la red. Con el corte en 300, según dónde caía el límite del segundo, entraba o no (§52).
    if (desde >= 420) medidas.push({ fps, trabajo });
    // una línea por segundo en la consola: así la prueba deja la "película" del ritmo del juego
    console.log(`[medidor] ${((ahora.t - t1) / 1000).toFixed(0)} s: cuadro ${ahora.c}, ${fps.toFixed(1)} fps, ` +
                `trabajo ${trabajo.toFixed(2)} ms, disco ${lecturas} lecturas (red ${de.pedidosRed} pedidos ${(de.bytesRed / 1048576).toFixed(1)} MB, caché ${de.bloquesCache} bloques, esperó ${esperaDiscoSeg.toFixed(0)} ms; adelantados ${de.adelantados}, aprovechados ${de.aprovechados}), ` +
                `fase ${window.mkwEstado.fase.e.toFixed(2)} ms (ajuste ${window.mkwEstado.fase.ajuste.toFixed(3)}, objetivo ${relojMonitor.objetivo(relojMonitor.p).toFixed(2)}), ` +
                `sonido ${!es.contextos ? 'sin abrir' : es.activo ? `${db.toFixed(1)} dB` : 'bloqueado'} (bloques ${es.bloques}, en silencio ${es.bloquesSilencio}, huecos ${es.huecos}, ` +
                `cola ${cola.toFixed(1)} ms, ritmo ${((ritmo - 1) * 100).toFixed(3)} %, tirados ${tirados}, ` +
                `costo ${(es.msBloqueTotal / Math.max(1, es.bloques)).toFixed(2)} ms/bloque, máx ${es.msBloqueMax.toFixed(2)})`);
    if (CUADROS_PRUEBA && !verificado && ahora.c >= CUADROS_PRUEBA) {
      verificado = true;
      verificar(medidas).catch(e => { ok('verificaciones', false, String(e)); fin(); });
    }
  }, 1000);

  // Desde ahora los controles van al juego (mando de GameCube por puerto, ver pad_web.cpp)
  enviarAlJuego = (...estado) => M._mkw_web_pad(...estado);
  controles.reenviar();

  // 5) main()
  window.mkwFS = M.FS;                     // el sistema de archivos del juego, para las pruebas
  // Archivos de sonido BRSAR (revo_kart.brsar): leer su tabla de grupos para bajar cada grupo entero apenas el juego
  // lo toque (brsar.mjs, disco.agrupar). La tabla está en el primer MB, que el juego lee igual al arrancar.
  if (disco.estado && parametros.get('adelantar') !== '0') for (const [ruta, tam] of tamaños) if (ruta.endsWith('.brsar')) (async () => {
    const url = direccion(ruta);
    const largo = largoEncabezadoBrsar(await disco.leer(url, tam, 0, 0x20));
    if (!largo || largo > 8 * 1024 * 1024) return;
    const rangos = gruposBrsar(await disco.leer(url, tam, 0, largo), tam);
    disco.agrupar(url, rangos);
    nota(`${ruta.split('/').pop()}: ${rangos.length} grupos de sonido (cada uno se baja entero al tocarlo)`);
  })().catch(e => escribe('[mkw] tabla de grupos: ' + e.message));
  // Con el título en pantalla (cuadro 300), traer en segundo plano y con prioridad baja todos los archivos diminutos
  // (≤ 8 KB: 613 archivos, 1,5 MB): el juego los lee de a uno, un pedido por cuadro (los fantasmas del Contrarreloj,
  // íconos y bancos de sonido de Retro Rewind), y con la red del sitio cada uno serían ~50 ms de espera (§52)
  const barrerDiminutos = setInterval(() => {
    if ((window.mkwEstado.cuadros || 0) < 300) return;
    clearInterval(barrerDiminutos);
    let n = 0;
    // ?diminutos=0 / ?semillaBloques=0: apagar cada parte por separado (para medir cuánto cuesta cada una)
    if (parametros.get('diminutos') !== '0')
      for (const [ruta, tam] of tamaños) if (tam <= 8192) { disco.adelantar(direccion(ruta), tam, { baja: true }); n++; }
    nota(`archivos diminutos pedidos en segundo plano: ${n}`);
    if (parametros.get('adelantar') !== '0' && parametros.get('semillaBloques') !== '0') precalentarBloques(tamaños);
  }, 500);
  guardado.vigilar(M.FS);                  // desde ahora, lo que el juego escriba en sus partidas se guarda solo
  pipelines.vigilar(M);                    // y la lista de pipelines usados, cada 10 s si creció
  window.mkwPipelines = { estado: pipelines.estado, exportar: () => pipelines.exportar(M),
                          cuantos: () => M._mkw_web_pipelines_cuantos(), guardar: forzar => pipelines.guardarAhora(M, forzar) };
  guardado.pedirPersistencia().then(si => nota(`almacenamiento persistente: ${si ? 'sí' : 'no (el navegador podría borrarlo si le falta espacio)'}`));
  window.mkwEstado.horaMain = Date.now();  // los archivos con fecha posterior los escribió el juego
  nota('arrancando main() — el juego corre');
  M.callMain([]);
}

// Qué bloques leyó el juego, sin los videos THP (esos los adelanta la lectura seguida), con el cuadro de la primera
// vez (la semilla solo usa los que se leyeron por primera vez después del título, cuadro 300): guion.mjs --semilla lo junta con otras corridas en bloques.json (la semilla de
// bloques), que la próxima primera visita baja de antemano con prioridad baja (bitácora §52).
const lecturasVistas = new Map();       // "ruta|bloque" → [ruta, bloque, cuadro, tamaño]
function anotarLectura(ruta, tam, inicio, largo) {
  const cuadro = window.mkwEstado.cuadros || 0;
  if (ruta.endsWith('.thp') || !disco) return;
  for (let b = Math.floor(inicio / disco.bloque); b <= Math.floor((Math.min(inicio + largo, tam) - 1) / disco.bloque); b++) {
    const k = ruta + '|' + b;
    if (!lecturasVistas.has(k)) lecturasVistas.set(k, [ruta, b, cuadro, tam]);
  }
}
window.mkwLecturas = () => [...lecturasVistas.values()];

// La semilla de bloques (bloques.json, junto al .wasm): con el título en pantalla se piden con prioridad baja, en el
// orden en que el juego los fue necesitando; los que estén en Cache Storage (visitas siguientes) no van a la red.
async function precalentarBloques(tamaños) {
  let semilla;
  try { const r = await fetch('/build/bloques.json', { cache: 'no-store' }); if (!r.ok) return; semilla = await r.json(); }
  catch { return; }
  const minimo = semilla.corridas >= 2 ? 2 : 1;          // con varias corridas, solo lo que se repite (no los CPU al azar)
  // solo lo que el juego necesitó por primera vez después del título (lo de antes ya lo bajó él al arrancar), y como
  // mucho 32 MB, en el orden en que los fue necesitando
  const lista = (semilla.bloques || []).filter(([ruta, , cuadro, veces]) => veces >= minimo && cuadro >= 300 && tamaños.has(ruta))
    .sort((a, b) => a[2] - b[2]);
  let n = 0, bytes = 0;
  for (const [ruta, b] of lista) {
    const tam = tamaños.get(ruta);
    const largo = Math.min(disco.bloque, tam - b * disco.bloque);   // el último bloque de un archivo es más corto
    if (largo <= 0 || bytes + largo > 32 * 1048576) continue;
    disco.adelantarBloques(direccion(ruta), tam, b, b);
    n++; bytes += largo;
  }
  nota(`semilla de bloques: ${n} bloques (${(bytes / 1048576).toFixed(1)} MB) pedidos con prioridad baja`);
}

// Arma el sistema de archivos del juego en la memoria (MEMFS) antes de su main().
function armarArchivos(m, contenidos, tamaños) {
  const FS = m.FS;
  const carpeta = ruta => FS.mkdirTree(ruta.slice(0, ruta.lastIndexOf('/')));
  for (const [ruta, datos] of contenidos) { carpeta(ruta); FS.writeFile(ruta, datos); }
  // Archivos perezosos: existen y dicen su tamaño (así el runtime los indexa), pero no tienen contenido en
  // memoria. Si algo los leyera por el sistema de archivos normal (no por el lector del disco), avisamos claro.
  for (const [ruta, tam] of tamaños) {
    carpeta(ruta);
    const nodo = FS.create(ruta, 0o444);
    nodo.usedBytes = tam;               // MEMFS informa este número como tamaño del archivo
    nodo.stream_ops = Object.assign({}, nodo.stream_ops, {
      read() {
        escribe('[mkw] se leyó un archivo perezoso por el sistema de archivos: ' + ruta);
        throw new FS.ErrnoError(29);    // EIO: error de entrada/salida
      },
    });
  }
  // Config.toml: dónde está cada cosa (rutas absolutas del sistema de archivos de mentira)
  FS.mkdirTree('/datos/WiiCompiled');
  FS.writeFile('/datos/WiiCompiled/Config.toml', [
    '# Generado por web/navegador/mkw.mjs',
    '[audio]', 'mix_worker = false', '',     // sin hilos en la web: el sonido se mezcla en el mismo hilo
    '[network]', 'enabled = false', '',
    '[discord]', 'enabled = false', '',
    '[paths]', 'dvd_root = "/mkw/disco"', 'retro_rewind_root = "/mkw/sd/RetroRewind6"', '',
  ].join('\n'));
  m.ENV.XDG_DATA_HOME = '/datos';       // la "AppData" del juego (Config, NAND, registros)
  // ?thp=traducido: los videos THP con el decodificador traducido del juego (el de antes, para comparar);
  // ?thp=comparar: los dos, y anota en la consola cuánto difieren y cuánto tarda cada uno (bitácora §47).
  // Sin el parámetro: el decodificador nativo (web/thp/thp_nativo.cpp).
  if (parametros.has('thp')) m.ENV.MKW_THP = parametros.get('thp');
  // ?rutas=traducido: buscar los archivos en el índice del disco siempre con la función del juego (como antes);
  // ?rutas=comparar: con la búsqueda nativa, comprobando cada respuesta contra la del juego; ?rutas=listar: anota
  // cada nombre buscado. Sin el parámetro: la búsqueda nativa con tabla hash (web/dvd/rutas_nativo.cpp, bitácora §50).
  if (parametros.has('rutas')) m.ENV.MKW_RUTAS = parametros.get('rutas');
  // ?pipelines=sincronico: crear cada pipeline nuevo en el momento, frenando el cuadro (como antes, para comparar;
  // bitácora §51). Sin el parámetro: en segundo plano, saltando el dibujo hasta que llegue.
  if (parametros.has('pipelines')) m.ENV.MKW_PIPELINES = parametros.get('pipelines');
  if (parametros.has('staging')) m.ENV.MKW_STAGING = parametros.get('staging');   // ?staging=mapeo: búfer mapeado viejo (§53)
  FS.chdir('/wc');                      // el runtime busca runtime/assets/... desde aquí
}

// Las verificaciones de la prueba, cuando se llega a ?cuadros=N
async function verificar(medidas) {
  const lineas = window.mkwEstado.log.join('\n');
  ok('aurora creó WebGPU sobre el canvas', /surface format/i.test(lineas), (lineas.match(/Using surface format[^\n]*/) || [''])[0]);
  ok('el juego lee el disco por pedazos (HTTP Range)', window.mkwEstado.lecturas > 0,
     `${window.mkwEstado.lecturas} lecturas, ${(window.mkwEstado.bytes / 1048576).toFixed(1)} MB`);
  ok('el código de Retro Rewind corre', /WWFC_NOTICE|Pulsar|New race started/.test(lineas));
  const fpsMin = medidas.length ? Math.min(...medidas.map(m => m.fps)) : 0;
  const fpsMedio = medidas.length ? medidas.reduce((s, m) => s + m.fps, 0) / medidas.length : 0;
  ok('60 fps desde el cuadro 420 (el título ya cargado)', fpsMedio >= 59 && fpsMin >= 55, `medio ${fpsMedio.toFixed(1)}, mínimo ${fpsMin.toFixed(1)}`);
  const msMax = medidas.length ? Math.max(...medidas.map(m => m.trabajo)) : 99;
  ok('el trabajo por cuadro cabe en 16,67 ms', msMax < 16.67, `máximo ${msMax.toFixed(2)} ms`);
  // ¿Hay imagen? Se copia el canvas a uno 2D chico y se cuentan los píxeles que no son negros
  const px = await fotoCanvas(160, 132);
  let noNegros = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) noNegros++;
  ok('hay imagen en el canvas (no todo negro)', noNegros > 160 * 132 * 0.05, `${(100 * noNegros / (160 * 132)).toFixed(0)} % de píxeles con color`);
  ok('sin errores de lectura perezosa', !/archivo perezoso/.test(lineas));
  const v = window.mkwEstado.vsync;
  // (cuenta con el contador del juego, que sube DESPUÉS de la pausa de aurora: no es lo que se ve; ver §43)
  nota(`contador del juego visto por rAF: ${v.refrescos} refrescos, ${v.unoJusto} con 1 cuadro nuevo, ${v.repetidos} repetidos, ${v.saltados} saltados; ` +
       `refrescos entre cuadros: ${Object.entries(v.huecos).map(([n, k]) => `${n}→${k} veces`).join(', ')}`);
  // "Parejo" = el hueco que corresponde al monitor: 16,67 ms del juego / p ms del refresco (60 Hz → 1, 180 Hz → 3)
  const hz = relojMonitor.p ? 1000 / relojMonitor.p : 0;
  const esperado = relojMonitor.p ? Math.round(16.6667 / relojMonitor.p) : 0;
  const multiplo = esperado > 0 && Math.abs(16.6667 - esperado * relojMonitor.p) < 0.1;
  // Lo más cercano a lo que se ve que la página puede medir es la TOMA del canvas (cuándo el navegador se lleva
  // la imagen nueva al compositor). Lo que de verdad se VE solo lo sabe Chrome: lo mide prueba-navegador.mjs con
  // la traza de Chrome (ver §43). Aquí queda como dato. huecosToma[n] = veces que entre dos tomas pasaron n refrescos.
  const tomas = relojMonitor.huecosToma;
  nota(`refrescos entre tomas del canvas: ${Object.entries(tomas).map(([n, k]) => `${n}→${k} veces`).join(', ')}; ` +
       `fase del reloj VI ${relojMonitor.objetivo(relojMonitor.p).toFixed(2)} ms después del refresco ` +
       `(toma del canvas a ${relojMonitor.tomaDeseada(relojMonitor.p).toFixed(2)} ms)`);
  const totalHuecos = Object.values(tomas).reduce((s, k) => s + k, 0);
  const parejo = totalHuecos ? 100 * (tomas[esperado] || 0) / totalHuecos : 0;
  const f = window.mkwEstado.fase;
  const detalle = `monitor ${hz.toFixed(1)} Hz, ${parejo.toFixed(1)} % de los cuadros duran ${esperado} refresco(s); ` +
                  `enganche ${ENGANCHE ? `sí (${f.enganchado} de ${f.cuadros} cuadros con error < 0,5 ms)` : 'no (?enganche=0)'}`;
  nota(`tomas parejas: ${detalle}` + (multiplo ? '' : ' — el monitor no es múltiplo de 60 Hz'));
  if (TRAZA) for (let i = 0; i < traza.length; i += 3000) console.log('[traza] ' + JSON.stringify(traza.slice(i, i + 3000)));
  verificarSonido(lineas);
  const de = disco.estado;
  nota(`caché del disco: ${de.pedidosRed} pedidos a la red (${(de.bytesRed / 1048576).toFixed(1)} MB), ` +
       `${de.bloquesCache} bloques de la caché, ${de.bloquesMemoria} de la memoria, para ${de.lecturas} lecturas del juego; ` +
       `bajados antes: ${de.adelantados} bloques (${de.avisos} avisos del juego), ${de.aprovechados} aprovechados; ` +
       `${de.esperaRed} lecturas esperaron a la red` +
       (de.sinCache ? ' — sin Cache Storage en este navegador' : ''));
  pintarDatosDisco();
  await verificarPipelines(lineas);
  await probarControles();
  fin();
}

// Pipelines (bitácora §51): se crean en segundo plano, y la lista de los usados se guarda en este navegador y se
// vuelve a leer igual (lo que se precalentará en la próxima visita).
async function verificarPipelines(lineas) {
  const enFondo = /\[pipelines\] modo asíncrono/.test(lineas);
  const cuantos = window.mkwPipelines.cuantos();
  const guardo = await window.mkwPipelines.guardar(true);
  const leidas = await crearPipelines({ urlSemilla: 'data:,' }).cargar();
  const n = leidas.propia ? new DataView(leidas.propia.buffer).getUint32(8, true) : 0;
  const forzados = [...lineas.matchAll(/(\d+) armados en el momento/g)].reduce((s, m) => s + Number(m[1]), 0);
  ok('los pipelines nuevos se piden en segundo plano y su lista queda guardada para precalentar la próxima visita',
     enFondo && cuantos > 0 && guardo && n === cuantos,
     `${cuantos} en la lista (${pipelines.estado.semilla} venían de la semilla), guardados y leídos de vuelta ${n}; ` +
     `${forzados} tuvieron que armarse en el momento`);
}

// El sonido: ¿SDL3 abrió el suyo por nuestra cadena, se desbloqueó con un gesto, suena y sin cortes?
function verificarSonido(lineas) {
  const e = sonido.estado, chrome = sonido.estadisticasChrome();
  ok('el juego abrió su sonido (por el volumen y el medidor de la página)', e.contextos === 1 && e.frecuencia > 0,
     `${e.contextos} AudioContext, ${e.frecuencia} Hz, bloques de ${e.muestrasBloque} muestras (${(1000 * e.muestrasBloque / (e.frecuencia || 1)).toFixed(1)} ms)`);
  ok(`el sonido arrancó bloqueado${parametros.get('bloquearSonido') === '1' ? ' (simulado)' : ''} y se desbloqueó con el primer gesto`, e.activo && e.desbloqueadoCon !== '',
     e.desbloqueadoCon ? `con «${e.desbloqueadoCon}»` : (e.activo ? 'sonaba sin gesto (¿Chrome sin bloqueo?)' : 'sigue bloqueado'));
  ok('el juego suena (música del título)', window.mkwEstado.sonido.nivelMax > -40, `nivel máximo ${window.mkwEstado.sonido.nivelMax.toFixed(1)} dB`);
  // Cortes: se cuentan desde el cuadro 300; los del arranque (el juego se traba leyendo el disco) van como nota
  const m = window.mkwEstado.sonido, base = m.base || { huecos: e.huecos, tirados: m.tirados };
  const huecos = e.huecos - base.huecos, tirados = m.tirados - base.tirados;
  if (base.huecos || base.tirados) nota(`sonido en el arranque: ${base.huecos} huecos y ${base.tirados} bloques tirados (mientras carga del disco)`);
  ok('sin cortes en el sonido desde el cuadro 300', huecos === 0 && tirados === 0,
     `${huecos} huecos, ${tirados} bloques tirados por cola llena` +
     (chrome ? `; Chrome: ${chrome.rellenos} rellenos, latencia ${chrome.latenciaMs?.toFixed?.(1)} ms` : ''));
  const detalle = `cola entre ${m.colaMin.toFixed(1)} y ${m.colaMax.toFixed(1)} ms (objetivo 60, tope 120), ` +
                  `ritmo entre ${((m.ritmoMin - 1) * 100).toFixed(3)} % y ${((m.ritmoMax - 1) * 100).toFixed(3)} %`;
  if (AJUSTE_SONIDO) ok('la cola del sonido se mantiene centrada (ajuste de ritmo)', m.colaMin > 20 && m.colaMax < 110, detalle);
  else nota('sin ajuste de ritmo (?ajusteSonido=0): ' + detalle);
}

// ¿El juego responde a los controles? En la pantalla de título se aprieta A como lo haría una persona: un
// "keydown" de la tecla K en la ventana, que pasa por controles.mjs → mkw_web_pad → PADRead → el juego.
// Si el juego lo ve, sale del título hacia el menú: cambia la imagen y lee archivos nuevos del disco.
// Para no confundir eso con la animación propia del título, primero se mide 2 s SIN tocar nada (la "línea base")
// y después 3 s tras apretar A; la reacción tiene que ser claramente mayor que la base.
async function probarControles() {
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const foto = async () => {                 // el canvas en chico (80×66), en grises
    const d = await fotoCanvas(80, 66), gris = new Uint8Array(80 * 66);
    for (let i = 0; i < gris.length; i++) gris[i] = (d[4 * i] + d[4 * i + 1] + d[4 * i + 2]) / 3;
    return gris;
  };
  // fracción de píxeles que cambiaron bastante (más de 40 de 255) entre dos fotos
  const cambio = (a, b) => a.reduce((n, v, i) => n + (Math.abs(v - b[i]) > 40 ? 1 : 0), 0) / a.length;
  const tecla = (tipo, code) => window.dispatchEvent(new KeyboardEvent(tipo, { code, bubbles: true, cancelable: true }));
  const f0 = await foto(), l0 = window.mkwEstado.lecturas;
  await espera(2000);                        // línea base: sin tocar nada
  const f1 = await foto(), l1 = window.mkwEstado.lecturas;
  tecla('keydown', 'KeyK');                  // apretar A…
  await espera(200);
  const visto = window.mkwControles.estado.puertos[0];
  const aLlego = !!visto && (visto.botones & BOTON.A) !== 0;
  tecla('keyup', 'KeyK');                    // …y soltar (como un toque rápido)
  await espera(3000);
  const f2 = await foto(), l2 = window.mkwEstado.lecturas;
  ok('la tecla K llega al puerto 1 como botón A', aLlego);
  const base = cambio(f0, f1), tras = cambio(f1, f2);
  ok('el juego responde al botón A en el título', (l2 - l1) > (l1 - l0) || tras > base + 0.2,
     `sin tocar: ${(100 * base).toFixed(0)} % de la imagen cambió y ${l1 - l0} lecturas del disco; ` +
     `tras apretar A: ${(100 * tras).toFixed(0)} % y ${l2 - l1} lecturas`);
}

$('arrancar').addEventListener('click', arrancar);
if (parametros.get('auto') === '1') arrancar();
