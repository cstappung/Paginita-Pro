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
import { prueba } from './verificaciones.mjs';   // (junto a la página: en el sitio ./banco/ no existe, §69)
import { crearControles, ACCIONES, BOTON, nombreTecla } from './controles.mjs';
import { crearSonido } from './sonido.mjs';
import { crearGuardado } from './guardado.mjs';
import { crearNube } from './nube.mjs';
import { crearRespaldos } from './respaldos.mjs';
import { crearDisco } from './disco.mjs';
import { crearPipelines } from './pipelines.mjs';
import { largoEncabezadoBrsar, gruposBrsar, gruposConNombreBrsar } from './brsar.mjs';
import { crearInterfaz } from './interfaz.mjs';
import { montarMandos } from './opciones-mandos.mjs';
import { crearRecords, vigilarCarreras, textoTiempo, nombreCategoria as NOMBRE_CATEGORIA } from './records.mjs';
import { crearLector, crearPiloto, leerNombres, SECCION, PAGINA, BOT } from './menus.mjs';
import { crearPila, crearConmutador, crearEnlaceCanal, crearRouterMalla } from './red.mjs';
import { crearMalla, senalPadre, senalCanal } from './malla.mjs';
import { crearWfc } from './wfc.mjs';
import { crearVr, presentarVr, extraerVrbr } from './vr.mjs';
import { crearLockstep, huellaCarrera, armarPlantel, vigiaLento, MARCA as MARCA_LOCKSTEP } from './lockstep.mjs';
import { crearPrivado } from './privado.mjs';
import { crearOcultar } from './ocultar.mjs';
import { crearInicio } from './inicio.mjs';
import { prepararMii, crearDirecto, armarFicha, SECCION_DIRECTA, BOTON as BOTON_JUEGO } from './directo.mjs';
import { crearModo, pistasDe, SEGUNDOS_ELEGIR } from './modos.mjs';
import { crearSala as crearSalaCarrera, humanosDeFicha, tablaDelJuego, puntosDelJuego, ponerPuntos, MARCA_SALA } from './sala-carrera.mjs';

const parametros = new URLSearchParams(location.search);
// Abrir directo por código (§71): ?directo=0 vuelve al piloto que aprieta botones (para comparar)
const DIRECTO = parametros.get('directo') !== '0';
// ---- En línea (bitácora §58). ?red=1: la red de juguete de la sala, con el WFC virtual en esta misma pestaña
// (10.77.0.1) y el juego en 10.77.0.2. Todos los nombres de servidores (nintendowifi.net, gs.nintendowifi.net,
// rwfc.net…) apuntan al WFC virtual. Lo que pasa queda en window.mkwRed.registro (y en la consola con ?red=ver).
// VR y BR (vr.mjs, §59): existe siempre (la tarjeta de inicio lo muestra). Con sesión en el sitio, la página llama
// window.mkwConectarVr({ almacen: almacenRtdbVr({ rtdb, db }), uid, nombre }) ANTES de entrar en línea: lee el VR de
// la cuenta y se lo presenta al WFC de la sala, que se lo da al juego cuando pregunta
const vr = crearVr();
window.mkwVr = vr;
// ---- La carrera sincronizada de la sala con CPU (lockstep.mjs, bitácora §61) ----
// ?sincro=uidA,uidB,…&uid=YO&modo=copa&pistas=…&semilla=N&cpu=normal&red=malla: cada navegador de la sala corre la
// misma carrera offline (12 karts: estos humanos, en ese orden, y CPU) y la malla reparte los botones de cada cuadro.
// ?pjs=personaje.vehículo,… (opcional, en el orden de sincro): lo que eligió cada humano. Sin `semilla` no hay número
// común del que partir: no se arma.
const sincro = parametros.get('sincro') && parametros.get('semilla') ? (() => {
  const yo = parametros.get('uid') || '';
  const pjs = (parametros.get('pjs') || '').split(',');
  const humanos = parametros.get('sincro').split(',').filter(Boolean).slice(0, 4).map((uid, mando) => {
    const [pj, veh] = (pjs[mando] || '').split('.').map(x => x === '' || x === undefined ? NaN : Number(x));
    return { uid, mando, personaje: pj, vehiculo: veh };
  });
  const miPuesto = humanos.findIndex(h => h.uid === yo);
  if (miPuesto < 0) return null;
  window.mkwPlantel = armarPlantel({ humanos, semilla: Number(parametros.get('semilla')) >>> 0 });
  // ?autoconducir=1 (solo para el banco): los karts de los humanos también los maneja la CPU (sin mando), así cada
  // carrera termina sola y se puede probar la copa entera; los botones igual viajan por la malla
  if (parametros.get('autoconducir') === '1') window.mkwPlantel.forEach(x => { x[3] = -1; });
  window.mkwMiPuesto = miPuesto;                    // la cámara y el HUD siguen a mi kart (semillas_nativo.cpp)
  window.mkwRelojFijo = true;                       // el azar de la carrera, igual en todas (ppc_helpers.cpp)
  return { yo, humanos, miPuesto, local: [0, 0, 0, 0, 0, 0, 0], lockstep: null };
})() : null;
window.mkwSincro = sincro;
const red = parametros.has('red') ? (() => {
  const registro = [];
  const anotar = t => { t = new Date().toISOString().slice(11, 23) + ' ' + t; registro.push(t); if (registro.length > 2000) registro.shift(); if (parametros.get('red') === 'ver') console.log(t); };
  // ?red=1: todo en esta pestaña (un conmutador en memoria). ?red=canal&nodo=N[&anfitrion=1]: varias pestañas en la
  // misma sala del banco, unidas por BroadcastChannel (como lo harán los canales WebRTC); el anfitrión tiene el WFC
  // y su juego es la 10.77.0.2; los demás, 10.77.0.N
  // ?red=malla&nodo=N[&anfitrion=1][&sala=…]: lo de verdad (F2): una malla WebRTC entre navegadores. La señalización la
  // presta la página de la sala del sitio (postMessage, como BT3) si el juego está en su marco (o con &senal=padre); si
  // no, un buzón falso por BroadcastChannel (banco: dos pestañas del mismo Chrome)
  const modo = parametros.get('red'), multi = modo === 'canal' || modo === 'malla';
  const anfitrion = !multi || parametros.get('anfitrion') === '1';
  const conmutador = multi ? null : crearConmutador();
  let router = null, malla = null;
  if (modo === 'malla') {
    const uid = parametros.get('uid') || 'u' + Math.random().toString(36).slice(2, 10);
    const enMarco = parametros.get('senal') === 'padre' || (window.parent !== window && parametros.get('senal') !== 'canal');
    const senal = enMarco ? senalPadre({ canal: 'mkw' }) : senalCanal({ sala: parametros.get('sala') || 'banco', uid });
    router = crearRouterMalla({ registro: anotar });
    // los mensajes de la carrera sincronizada (lockstep.mjs) empiezan con su marca; los demás son de la red del juego
    // (y los de la sala nueva, §73, con la suya: sala-carrera.mjs)
    const alBinario = (de, b, canal) => b[0] === MARCA_LOCKSTEP ? sincro?.lockstep?.alBinario(de, b)
      : b[0] === MARCA_SALA ? window.mkwSala?.alBinario(de, b) : router.alBinario(de, b, canal);
    malla = crearMalla({ uid, senal, alBinario, alCambiar: router.alCambiar });
    router.usar(malla);
    malla.entrar().then(ok => anotar(`[malla] ${ok ? 'entré a la sala como ' + uid : 'no pude entrar a la sala'}`));
  }
  const enlace = () => router ? router.enlace() : multi ? crearEnlaceCanal('mkw-red-' + (parametros.get('sala') || 'banco')) : conmutador.enlace();
  const wfc = anfitrion ? crearWfc({ pila: crearPila({ ip: '10.77.0.1', enlace: enlace(), registro: (...a) => anotar('[wfc-red] ' + a.join(' ')) }), registro: anotar }) : null;
  const miIp = `10.77.0.${multi ? Math.max(2, Number(parametros.get('nodo')) || 2) : 2}`;
  // la pila del juego; el espía lee lo que el juego le informa al WFC por GPCM (29900): su VR y BR después de cada
  // carrera → vr.informar (localStorage + Firebase). El presentador le cuenta al WFC el VR de la cuenta
  const latin1 = new TextDecoder('latin1');
  const espia = (par, datos) => {
    if (par?.puerto !== 29900) return;
    const vb = extraerVrbr(latin1.decode(datos)); if (!vb) return;
    vr.informar(vb).then(r => { if (r.cambio) anotar(`[vr] el juego informa VR ${vb.vr} / BR ${vb.br}${r.antes ? ` (antes ${r.antes.vr})` : ''} → ${r.nube}`); });
  };
  const pila = crearPila({ ip: miIp, enlace: enlace(), dns: () => '10.77.0.1', registro: (...a) => anotar('[juego-red] ' + a.join(' ')), espia });
  const presentador = presentarVr({ pila });
  const r = { pila, wfc, registro, conmutador, ip: miIp, malla, router, presentador };
  window.mkwRed = r;
  return r;
})() : null;
// De dónde salen las piezas privadas (el juego compilado, el manifiesto y los archivos del disco). Vacío = este mismo
// servidor (servidor.mjs). En el sitio vendrán del Worker de amigos, otro origen (como el disco de BT3):
// ?privado=http://127.0.0.1:8151 lo imita con herramientas/sitio-local.mjs (bitácora §54). La página en sí usa
// direcciones relativas, para vivir en /juegos/mkw/ del sitio igual que aquí en /.
const ORIGEN = (parametros.get('privado') || '').replace(/\/+$/, '');
// El Worker de amigos solo responde con el token de Firebase de quien juega: privado.mjs se lo pide a la página de Juegos
// (el marco padre, como el de BT3) y se lo pone a cada pedido que va a ORIGEN (bitácora §65). Sin ORIGEN, nada cambia.
const privado = ORIGEN ? crearPrivado({ origen: ORIGEN }).instalar() : null;
window.mkwPrivado = privado;
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
// En línea (?red) va SIEMPRE sin enganche (bitácora §58): todas las consolas de la carrera tienen que avanzar al mismo
// ritmo medido con el reloj de pared, no con el refresco de cada monitor (con el enganche, los refrescos que una
// pestaña pierde son cuadros perdidos: dos pestañas se separaron 0,44 cuadros por segundo y Retro Rewind echaba al
// invitado a los ~34 s). Con el reloj propio del runtime la diferencia queda en ±2 cuadros sin acumularse.
const ENGANCHE = parametros.get('enganche') !== '0' && !parametros.has('red');
// La pausa de presentar de aurora y la toma a compás (§54) no tocan el reloj VI (solo esperan a que el navegador tome
// el canvas, con tope en el vencimiento del cuadro): van también en línea. Sin ellas, con ?red el juego casi no
// soltaba el hilo y la página pasaba 120-700 ms sin actualizar la pantalla ni atender la red (bitácora §63).
const PRESENTA = parametros.get('enganche') !== '0';
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
// Tiempo de GPU (?gpu=1, diagnóstico; bitácora §54): cuánto tarda la tarjeta en terminar lo que aurora le manda en cada
// cuadro. Envuelve GPUQueue.submit: al último envío de cada cuadro le pregunta "avisame cuando termines"
// (onSubmittedWorkDone) y mide la demora. Si la tarjeta estaba libre, eso es su tiempo de trabajo; si se acerca a un
// refresco del monitor, el compositor a veces no alcanza a mostrar la imagen a tiempo (ritmo 3-5-3-5).
const gpuMedida = { muestras: [] };
if (parametros.get('gpu') === '1' && globalThis.GPUQueue) {
  const original = GPUQueue.prototype.submit;
  let pendiente = null;
  GPUQueue.prototype.submit = function (buffers) {
    const r = original.call(this, buffers);
    const t0 = performance.now(), cola = this;
    if (pendiente !== null) return r;                 // ya hay uno midiéndose en este cuadro
    pendiente = t0;
    queueMicrotask(() => {                            // el último envío seguido (mismo trozo de trabajo) cuenta junto
      cola.onSubmittedWorkDone().then(() => {
        if (gpuMedida.muestras.length < 200000) gpuMedida.muestras.push([pendiente, performance.now() - pendiente]);
        pendiente = null;
      });
    });
    return r;
  };
  window.mkwGpu = () => gpuMedida.muestras;
}
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
// ?esperaToma=0: la pausa de presentar de aurora vuelve a ser un sueño fijo hasta retrace+6,5 ms, y nada si faltan
// menos de 2 ms (antes de §54), para comparar.
const ESPERA_TOMA = parametros.get('esperaToma') !== '0';
// ?atrasada=0: aurora toma la textura del canvas sin esperar la actualización de la pantalla atrasada (antes de §54).
const ESPERA_ATRASADA = parametros.get('atrasada') !== '0';
// ?compas=0: sin el compás de 4 refrescos (solo se espera la actualización atrasada).
const COMPAS = parametros.get('compas') !== '0';
const FASE_CEDER = 0.75;
const enTareaNueva = (() => {
  const canal = new MessageChannel(), cola = [];
  canal.port1.onmessage = () => cola.shift()();
  return f => { cola.push(f); canal.port2.postMessage(0); };
})();
const relojMonitor = {
  t: 0, p: 0, n: 0, deltas: [], esperas: [], tomas: [],
  entregado: 0, retrace: 0, desfases: [], fase: null, tomaAnterior: 0, huecosToma: {}, fotos: [],
  valido() { return this.deltas.length >= 30 && performance.now() - this.t < 100; },  // pestaña oculta → no
  tic(hora) {
    if (this.entregado && !this.esperandoAtrasada) {
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
    for (const f of this.tomas.splice(0)) f(hora);          // la pausa de presentar de aurora: el canvas ya se tomó
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
  // La pausa de presentar de aurora (§54): se cumple apenas el navegador hizo su actualización de la pantalla (ahí
  // tomó el canvas con el cuadro recién entregado), desde una tarea nueva para que esa actualización termine antes de
  // que el juego siga; o a los `ms` si no llega ninguna antes (a 60 Hz el refresco siguiente queda lejos).
  // La toma del canvas, a compás (§54). aurora pregunta tomaAtrasada() justo antes de tomar la textura del canvas.
  // Dos casos en que tomarla de inmediato sale mal:
  //  - una actualización de la pantalla ATRASADA: pasó un refresco y el navegador no pudo correr su actualización
  //    (el juego tenía el hilo). Si aurora toma la textura ahora, esa actualización vieja se lleva el cuadro nuevo un
  //    refresco antes, y el siguiente dura uno más: 3 y 5 refrescos en vez de 4 a 240 Hz (el tirón en carrera).
  //  - el compás: a 240 Hz cada cuadro debe verse 4 refrescos. objetivo = refresco de la toma anterior + 4; la textura
  //    se toma recién después de la actualización del refresco objetivo − 1, así la del objetivo se la lleva. Si el
  //    juego entrega antes (un cuadro rápido), espera; si entrega tarde, se toma apenas se pueda y el compás se rearma.
  //    (Probado y descartado: dejar un margen de 2,5 ms entre la entrega y el refresco de la toma: 69–74 % a compás
  //    contra 95 % sin margen, §54.)
  // tomaAtrasada() calcula desde qué hora de rAF ya se puede tomar y dice si hay que esperar a ese rAF.
  ultimaToma: 0, desdeToma: 0, esperandoAtrasada: false,
  tomaAtrasada() {
    if (!this.valido() || !(this.p > 0)) return false;
    const p = this.p, n = Math.round(16.6833 / p), ahora = performance.now();
    this.desdeToma = ahora - 1.5 * p;            // sin compás: solo un refresco que pasó hace más de medio refresco
    if (COMPAS && n >= 2 && Math.abs(16.6833 - n * p) < 0.1 * p && this.ultimaToma) {
      const objetivo = this.ultimaToma + n * p;
      if (ahora < objetivo + 0.5 * p) this.desdeToma = objetivo - 1.5 * p;
    }
    return this.t < this.desdeToma;
  },
  // Espera el rAF con hora ≥ desdeToma (se cumple en una tarea nueva, como esperaHasta), o un tope de tiempo.
  esperaAtrasada() {
    const desde = this.desdeToma;
    anota('a', desde - this.t);
    this.esperandoAtrasada = true;
    return new Promise(listo => {
      let hecho = false;
      const fin = v => {
        if (hecho) return; hecho = true;
        this.esperas = this.esperas.filter(e => e !== espera); this.esperandoAtrasada = false;
        anota('b', v); listo();
      };
      const espera = { desde, listo: () => enTareaNueva(() => fin(1)) };
      this.esperas.push(espera);
      setTimeout(() => fin(0), Math.max(2, desde - performance.now() + 1.5 * this.p));
    });
  },
  esperaToma(ms) {
    anota('t', ms);
    return new Promise(listo => {
      let hecho = false;
      const fin = v => { if (hecho) return; hecho = true; this.tomas = this.tomas.filter(f => f !== aviso); anota('u', v); listo(); };
      const aviso = hora => { this.ultimaToma = hora; enTareaNueva(() => fin(1)); };   // hora del refresco de la toma
      this.tomas.push(aviso);
      setTimeout(() => fin(0), ms);
    });
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

// La espera del juego cuando su reloj NO va enganchado al monitor (bitácora §63): en línea (?red, §58) siempre, en
// un monitor cuyo refresco no divide los 60 Hz del juego (144, 165, 175 Hz) y cuando el reloj del monitor deja de
// valer (una pestaña que pasó >100 ms sin refrescar). Se cumple con 1 al llegar el vencimiento o con 0 a los
// `servicioMs` (para que el juego atienda su sonido y alarmas y vuelva a esperar). Siempre desde una tarea nueva
// (enTareaNueva): así el setTimeout no sufre el mínimo de 4 ms de los temporizadores anidados.
// El último tramo se pide REDONDEADO HACIA ARRIBA y sin margen: despierta en el vencimiento o un poco después (0,1-1
// ms), nunca antes, y el runtime casi no gira. Llegar un poco tarde no corre el reloj del juego (cada "tele" se
// sella en su lugar de la grilla, vi.cpp: lastRetrace = target) y sin enganche no hay refresco con el que calzar.
// Con un margen de 1,5 ms girando, el reloj se leía miles de veces por cuadro: ~8 % del tiempo de la pestaña (§63).
// Con la pestaña oculta Chrome demora los setTimeout hasta 1 s: ahí solo se cede una vuelta (MessageChannel) y se
// sigue, para que la sala no se atrase.
// Antes de §63, sin esto, la espera giraba sin soltar nunca el hilo: en la carrera sincronizada la página solo
// respiraba cuando el lockstep esperaba a la otra consola (huecos de 120-700 ms) y, terminada la carrera, nunca más.
function esperaReloj(vencimiento, servicioMs) {
  return new Promise(listo => {
    const falta = vencimiento - performance.now();
    if (document.hidden) enTareaNueva(() => listo(falta <= 0 ? 1 : 0));
    else if (falta <= servicioMs) enTareaNueva(() => setTimeout(() => listo(1), Math.max(0, Math.ceil(falta))));
    else enTareaNueva(() => setTimeout(() => listo(0), servicioMs));
  });
}

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
const sonido = crearSonido({ alCambiar: () => { pintarSonido(); ui?.sonidoCambio(); }, simularBloqueo: parametros.get('bloquearSonido') === '1' });
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
  if (!await ui.preguntar({ titulo: 'Borrar los datos del juego', si: 'Borrar', peligro: true,
    texto: 'Se borran los archivos del juego guardados en este navegador (para liberar espacio). Las partidas no se tocan; la próxima vez se bajan de nuevo.' })) return;
  for (const n of await caches.keys()) if (n.startsWith('mkw-disco:')) await caches.delete(n);
  pintarDatosDisco();
});

// ---- Partidas guardadas (web/navegador/guardado.mjs) ----
// Se leen de IndexedDB al abrir la página; se restauran antes del main() del juego y se guardan solas al escribirse.
// Cada guardado nuevo también se sube a la nube (si hay sesión): unos segundos después, o enseguida si la pestaña se
// está escondiendo (cambiar de app en el celular, cerrar).
let nube = null, vistoGuardado = 0;
const guardado = crearGuardado({ alCambiar: e => {
  pintarPartidas(); ui?.partidaCambio();
  if (nube && e.ultimoGuardado && e.ultimoGuardado !== vistoGuardado) {
    vistoGuardado = e.ultimoGuardado;
    if (document.visibilityState === 'hidden') nube.enviar('subida al esconder la pestaña'); else nube.cambio();
  }
} });
window.mkwGuardado = guardado;              // para las pruebas

// ---- Partidas en la nube (nube.mjs: Firebase Storage, mkw/<uid>/partidas.mkwp) ----
// La sala del sitio (colabtex/src/juegos/mkw.js) llama window.mkwConectarNube({ almacen, uid }) apenas carga el
// marco, con un almacén { meta, bajar, subir } hecho con el Firebase del sitio. ANTES de que el juego lea las
// partidas, la nube deja iguales las de este navegador y las de la cuenta (nube.alEntrar). Por eso, en el marco
// (&senal=padre), la lectura espera: hasta 4 s a que llegue la nube y, si llegó, a que termine (cada pedido a
// Firebase tiene su tope, así que eso también termina). Sin sesión o si no llega a tiempo, se juega con lo de este
// navegador; la nube de esta visita queda apagada (la próxima vez se ponen al día, y si las dos cambiaron gana la más
// nueva y la otra queda en «Copias de respaldo»).
let nubeTarde = false, nubeEmpezo = false, soltarLectura;
const esperaLectura = new Promise(r => { soltarLectura = r; });
if (parametros.get('senal') === 'padre') setTimeout(() => { if (!nubeEmpezo) { nubeTarde = true; soltarLectura(); } }, 4000);
else soltarLectura();
// Un pedido que no contesta (sin red) no puede dejar el juego esperando: cada uno tiene su tope
const conTope = (promesa, ms, que) => Promise.race([promesa, new Promise((_, mal) => setTimeout(() => mal(new Error(`${que}: sin respuesta en ${ms / 1000} s`)), ms))]);
let ultimoRespaldoNube = null;
const respaldosNube = crearRespaldos();
window.mkwConectarNube = async ({ almacen, uid } = {}) => {
  if (nube || nubeTarde || !almacen || !uid) {
    if (nubeTarde && !nube) nota('partidas en la nube: la sala las conectó tarde (esta visita, solo en este navegador)');
    return nube?.estado || null;
  }
  nubeEmpezo = true;
  // Lo que viene de la página de la sala es de otro "reino" de JavaScript: sus Uint8Array no pasan las revisiones de
  // tipo de este, así que se copian (la sala copia del mismo modo lo que sube)
  const propio = {
    meta: ruta => conTope(Promise.resolve(almacen.meta(ruta)), 8000, 'nube (meta)').then(m => m && { ...m }),
    bajar: async ruta => new Uint8Array(await conTope(Promise.resolve(almacen.bajar(ruta)), 20000, 'nube (bajar)')),
    subir: (ruta, bytes, meta) => conTope(Promise.resolve(almacen.subir(ruta, bytes, { ...meta })), 20000, 'nube (subir)'),
  };
  nube = crearNube({ guardado, almacen: propio, uid: String(uid), alCambiar: () => {
    ui?.partidaCambio();
    // La versión que perdió un conflicto queda en «Copias de respaldo» (nunca se pierde una partida)
    const r = nube.respaldo;
    if (r && r !== ultimoRespaldoNube) {
      ultimoRespaldoNube = r;
      respaldosNube.guardar(r.blob, `la de ${r.de === 'nube' ? 'tu cuenta' : 'este navegador'}: perdió contra una más nueva`).catch(() => {});
    }
  } });
  window.mkwNube = nube;
  // Al esconder la pestaña (cambiar de app en el celular, cerrar): subir ya lo que esperaba su turno (la nube sube
  // como mucho una vez cada 30 s; sin esto, cerrar justo después de guardar dejaría la cuenta atrasada)
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') nube.alEsconder(); });
  addEventListener('pagehide', () => nube.alEsconder());
  try { nota(`partidas en la nube: ${await nube.alEntrar()}`); }
  finally { window.mkwEstado.nubeLista = performance.now(); soltarLectura(); }
  return nube.estado;
};
// (mkwEstado.lecturaPartidas: cuándo el juego leyó sus partidas, para la prueba: después de la nube, nunca antes)
let guardadosAlAbrir = esperaLectura.then(() => { window.mkwEstado.lecturaPartidas = performance.now(); return guardado.cargar(); }).catch(e => { guardado.estado.error = String(e); return new Map(); });
// Pipelines para precalentar (pipelines.mjs): la lista de este navegador y la semilla del servidor.
// ?precalentar=no: sin listas (para medir el peor caso, la primera visita sin semilla).
const pipelines = crearPipelines({ urlSemilla: ORIGEN + '/build/pipelines.bin' });
const listasAlAbrir = parametros.get('precalentar') === 'no' ? Promise.resolve({}) : pipelines.cargar();
function pintarPartidas() {
  const e = guardado.estado;
  const hora = e.ultimoGuardado ? `, guardado a las ${new Date(e.ultimoGuardado).toLocaleTimeString()}` : '';
  document.getElementById('partidas').textContent = e.error ? `error: ${e.error}`
    : e.archivos ? `${e.archivos} archivos en este navegador${hora}` : 'ninguna todavía (se guardan solas al jugar)';
}
// Cargar, descargar, borrar y las copias de respaldo: interfaz.mjs (panel «Partida»)

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
  // (toda la página, no solo el juego: así la barra y el cajón siguen a mano)
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  await document.documentElement.requestFullscreen().catch(() => {});
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
// Lo que recibe el puerto 1, 5 veces por segundo (para ver que todo responde; los mandos: opciones-mandos.mjs)
const NOMBRES_BOTON = Object.entries(BOTON);
setInterval(() => {
  const p = controles.estado.puertos[0];
  if (p) {
    const apretados = NOMBRES_BOTON.filter(([, bit]) => p.botones & bit).map(([n]) => n).join(' ');
    document.getElementById('puerto1').textContent = `puerto 1: ${apretados || '—'} · stick ${p.sx},${p.sy}` + (p.gr ? ` · R ${p.gr}` : '');
  }
}, 200);

// ---- La cara de la página (interfaz.mjs): inicio, modos, barra, cajón, «Tu partida», diálogos ----
// alCambiarGuardado: el editor de Mii guardó algo sin recargar la página → se vuelve a leer lo guardado para el arranque
var ui = crearInterfaz({ guardado, sonido, controles, imagenes: ORIGEN + '/build/imagenes',
  estadoNube: () => nube?.estado,
  alCambiarGuardado: () => { guardadosAlAbrir = esperaLectura.then(() => guardado.cargar()).catch(() => new Map()); } });
window.mkwInterfaz = ui;

// ---- El menú de inicio «JloKart Wii» (inicio.mjs, bitácora §67) ----
// Sale al abrir el juego sin un modo ya decidido (sin ?modo= de una sala): la imagen del dueño con Single Player,
// Multiplayer y Options. La imagen es PRIVADA (una persona real): viene del Worker de amigos con el token de quien
// juega (el fetch de privado.mjs), así que si el Worker no la entrega (401/403/404) el menú no aparece y todo sigue
// como antes. Mientras está, el juego carga y arranca debajo, sin recibir nada de la persona (controles.silenciar).
// Las pruebas con Playwright no lo ven (navigator.webdriver) salvo con ?inicio=1; ?inicio=0 lo apaga.
const quiereInicio = !parametros.get('modo') && !ui.conPortada && parametros.get('inicio') !== '0' &&
  (parametros.get('inicio') === '1' || !navigator.webdriver);
// Con el menú de inicio, lo primero que se oye es la música del título del juego (debajo del menú), y precalentar los
// ~700 pipelines en el arranque la atrasaba ~3 s: se postergan hasta la primera pantalla (§76, pipeline_cache.cpp).
// Solo si este navegador ya jugó antes (marca "mkw.precalentado"): entonces Chrome ya tiene esos shaders en su caché
// y pedirlos es liviano; en la 1.ª visita se compilan de cero, y hacerlo con la música sonando la trababa.
// ?precalentarTarde=1 / 0: forzarlo o apagarlo (sin menú, las pruebas siguen como antes).
const yaPrecalento = (() => { try { return localStorage.getItem('mkw.precalentado') === '1'; } catch { return false; } })();
const PRECALENTAR_TARDE = parametros.get('precalentarTarde') === '1' ||
  (quiereInicio && yaPrecalento && parametros.get('precalentarTarde') !== '0');
let pedirPiloto = null;          // arrancar() lo pone cuando el piloto existe; antes, la elección queda esperando
let eleccionPendiente = null;
let modoInicio = null;           // lo último elegido que mueve el juego ('unjugador' | 'local')
const aLaVista = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
const inicio = crearInicio({
  imagen: ORIGEN + '/build/imagenes/inicio/jlokart.webp',
  leerMandos: () => controles.estado.mandos,
  enSitio: window.parent !== window,
  // con el cajón, un diálogo, el editor de Mii o la lista de pistas encima, las teclas y el mando son para ellos
  ocupado: () => document.body.classList.contains('cajon-abierto') || !!document.querySelector('dialog[open]') ||
    aLaVista('editorMii') || aLaVista('elegirPista'),
  alElegir: que => elegirInicio(que),
});
window.mkwInicio = inicio;
function mostrarInicio() {
  if (!inicio.mostrar()) return false;
  controles.silenciar(true);
  window.mkwEstado.inicioVisto = performance.now();
  return true;
}
function elegirInicio(que) {
  if (que === 'opciones') return ui.abrirCajon('controles');
  if (que === 'salas') return window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'salas' }, location.origin);
  // 'unjugador' | 'local': el juego vuelve a recibir lo de la persona y el piloto lo lleva a esa pantalla
  controles.silenciar(false);
  modoInicio = que;
  window.mkwEstado.inicio = { que, cuando: performance.now() };
  if (pedirPiloto) pedirPiloto(que); else eleccionPendiente = que;
}
// El juego volvió a su título (la persona apretó B desde el menú principal): ahí va otra vez nuestro menú de inicio.
// Lo llama el gancho de Page::Activate; nunca debe fallar (es una llamada desde dentro del juego).
function alActivarInicio(dir) {
  try {
    if (!modoInicio || inicio.visible || window.mkwPiloto?.activo || !window.mkwEstado.piloto) return;
    if (window.mkwMenus.u32(dir + 4) !== PAGINA.titulo) return;
    modoInicio = null;
    mostrarInicio();
  } catch (e) { console.warn('[inicio]', e); }
}
if (quiereInicio) inicio.cargar().then(ok => {
  window.mkwEstado.imagenInicio = inicio.estado.imagen;
  if (ok && !modoInicio) mostrarInicio();
  else if (!ok) nota(`menú de inicio: sin imagen (${inicio.estado.imagen}): la página sigue sin él`);
});
// Panel «Mandos» (opciones-mandos.mjs): tipo de mando, disposición de botones, zona muerta, vibración, probar y asignar
montarMandos(document.getElementById('mandosPanel'), controles);
// Récords (records.mjs): existen desde el principio (la lista de pistas muestra tus mejores tiempos antes de jugar)
const records = crearRecords();
window.mkwRecords = records;
window.mkwConectarRecords = o => records.conectar(o);
window.mkwConectarVr = async o => {
  vr.conectar(o);
  const r = await vr.cargar();
  if (r && vr.conNube) red?.presentador.presentar(r);     // sin sesión manda el archivo del juego (RRRating.pul)
  return r;
};

// La dirección web de un archivo del juego: es la misma ruta, con cada pedazo "escapado" (espacios → %20…)
const direccion = ruta => ORIGEN + ruta.split('/').map(encodeURIComponent).join('/');

async function arrancar() {
  $('arrancar').disabled = true;
  ui.empezo();                                // la pantalla de inicio se va; el juego ocupa la ventana
  $('canvas').focus();

  // 1) Lo que el navegador necesita
  const hayJspi = 'Suspending' in WebAssembly;
  const { adaptador, nombreGpu, ignora } = await revisionGpu;
  if (!ok('el navegador tiene WebGPU y JSPI', !!adaptador && hayJspi,
          `WebGPU ${adaptador ? 'sí' : 'no'}, JSPI ${hayJspi ? 'sí' : 'no'}`)) {
    ui.cortina('Este navegador no puede correr el juego: necesita WebGPU y JSPI (Chrome o Edge, en el computador o en Android).', true);
    return fin();
  }
  nota(`GPU pedida: ${GPU}; la que dio el navegador: ${nombreGpu}`);
  if (ignora) nota('el navegador ignora la elección de tarjeta (da la misma para alto rendimiento y bajo consumo)');

  // 2) Manifiesto
  const respuestaManifiesto = await fetch(ORIGEN + '/manifiesto.json');
  if (!respuestaManifiesto.ok) {                     // el Worker: 401 = sin sesión, 403 = no está en la lista de amigos
    const por = { 401: 'Inicia sesión en Juegos para jugar.', 403: 'Este juego es solo para la lista de amigos.' }[respuestaManifiesto.status] || `El servidor del juego contestó ${respuestaManifiesto.status}.`;
    ui.aviso(por, true); ui.cortina(por, true);
    ok('lo privado responde', false, `manifiesto: ${respuestaManifiesto.status}`);
    return fin();
  }
  const manifiesto = await respuestaManifiesto.json();
  ui.cortina('Bajando los archivos del juego…');
  // Caché del disco (disco.mjs): lo bajado queda en este navegador; la versión de los archivos la da el servidor
  // ?adelantar=0: sin bajar antes (ni avisos del juego ni lectura seguida), para comparar (bitácora §52)
  disco = crearDisco({ version: respuestaManifiesto.headers.get('X-Mkw-Version') || 'sin-version',
                       adelantarActivo: parametros.get('adelantar') !== '0' });
  await disco.abrir();
  window.mkwDisco = disco;
  if (parametros.get('adelantar') !== '0') leerSemillaBloques();   // ya en camino para la semilla del arranque (§76)
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
  // El programa con su huella (?v=, de la cabecera X-Mkw-Build del manifiesto): el servidor lo da guardable para
  // siempre y Chrome reusa su caché HTTP y su caché de código en la próxima visita (bitácora §54). ?huella=0:
  // sin huella (siempre se baja y se compila de nuevo, como antes).
  const huellaBuild = parametros.get('huella') === '0' ? null : respuestaManifiesto.headers.get('X-Mkw-Build');
  const conHuella = f => ORIGEN + '/build/' + f + (huellaBuild ? '?v=' + huellaBuild : '');
  // (desde el Worker, import() no deja poner el token: privado.mjs lo baja con fetch y lo importa desde un blob)
  ui.cortina('Preparando el juego…');
  const crear = (await (privado ? privado.importar(conHuella('mkw.js')) : import(conHuella('mkw.js')))).default;
  let lecturas = 0, bytes = 0;
  const M = await crear({
    canvas: $('canvas'),
    mkwGpuPreferencia: GPU,
    mkwVibrar: (puerto, cmd) => controles.vibrar(puerto, cmd),   // el juego pide vibrar (pad_web.cpp)
    locateFile: f => conHuella(f),
    print: escribe,
    printErr: t => escribe('[err] ' + t),
    // El runtime llama a esto para cada lectura del disco (ver dvd.cpp y dvd_contract.h en el parche)
    mkwLeeRango: async (ruta, inicio, largo) => {
      ruta = ruta.replace(/\/+/g, '/');
      const tam = tamaños.get(ruta);
      if (tam === undefined) return -2;                        // no es perezoso: que lo lea de la memoria
      if (inicio >= tam) return -3;
      if (TRAZA_DISCO) escribe(`[lee] cuadro ${window.mkwCuadros ? window.mkwCuadros() : 0} ${ruta} ${inicio} ${largo}`);   // ?trazaDisco=1: cada lectura del juego (diagnóstico)
      anotarLectura(ruta, tam, inicio, largo);
      let datos;
      const t0 = performance.now();
      const donde = TRAZA_DISCO ? disco.donde(direccion(ruta), inicio) : null;   // diagnóstico: dónde estaba el bloque
      try { datos = await disco.leer(direccion(ruta), tam, inicio, largo); }   // bloques de 256 KB, con caché
      catch (e) { escribe('[mkw] ' + e.message); return -1; }
      msEsperaDisco += performance.now() - t0;   // el juego estuvo parado esperando estos bytes
      if (TRAZA_DISCO && performance.now() - t0 > 5) { const ms = performance.now() - t0; donde.then(d => escribe(`[espera] ${ms.toFixed(0)} ms ${ruta} ${inicio} ${largo} ${JSON.stringify(d)}`)); }
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
    // La semilla de la carrera que se prepara, si la página eligió una («Copa a tu gusto»: web/juego/semillas_nativo.cpp)
    mkwSemillas: () => window.mkwSemillaCarrera || null,
    // El reloj fijo de la carrera sincronizada (sala con CPU, lockstep.mjs; ?reloj=fijo para probarlo): desde que se
    // prepara la carrera, el reloj del procesador es un contador igual en todas las consolas (semillas_nativo.cpp)
    get mkwRelojFijo() { return parametros.get('reloj') === 'fijo' || !!window.mkwRelojFijo; },
    mkwLsArreglos: parametros.get('arreglos') !== '0',
    mkwVistaPropia: (parametros.get('vista') === '0' ? 0 : 1) | (parametros.get('camara') === '0' ? 0 : 2),   // ?vista=0 / ?camara=0: sin sonido-HUD / cámara propios (para comparar)   // ?arreglos=0: sin «todo a la vista» (lockstep_nativo.cpp), para comparar
    // …y el plantel (personaje y vehículo de los 12 puestos) que la sala reparte igual a todas (lockstep.mjs)
    mkwPlantel: () => window.mkwPlantel || null,
    mkwMiPuesto: () => window.mkwMiPuesto ?? null,
    // §73: en la sala nueva (humanos de verdad), la única pantalla es la del kart de esta consola (semillas_nativo.cpp)
    mkwPantallaPropia: () => window.mkwPantallaPropia ?? -1,
    mkwUnaPantalla: parametros.get('unaPantalla') !== '0',       // §73: una sola pantalla, la propia (?unaPantalla=0 = la pantalla partida del juego)
    mkwNotaCuentas: parametros.get('notaCuentas') === '1',          // (depurar: cada cálculo de pantallas en la consola)
    // La red del juego (web/red/red_web.cpp → red.mjs): solo con ?red=1; sin ella el juego ve "sin conexión"
    mkwRed: red?.pila,
    preRun: [m => {
      armarArchivos(m, contenidos, tamaños);
      carpetasVacias.forEach(c => m.FS.mkdirTree(c));
      guardado.restaurar(m.FS, guardados);   // encima de lo que trae el servidor (la partida vacía de RR)
      pipelines.escribir(m.FS, listas);      // aurora las lee al iniciar y las pide en segundo plano
    }],
    // Ceder sin enganche (vi.cpp, §63): la espera por reloj cuando el cuadro no va enganchado al monitor
    ...(CEDER ? { mkwEsperaReloj: esperaReloj } : {}),
    ...(PRESENTA && ESPERA_TOMA ? { mkwEsperaToma: ms => relojMonitor.esperaToma(ms) } : {}),
    ...(PRESENTA && ESPERA_ATRASADA ? { mkwTomaAtrasada: () => relojMonitor.tomaAtrasada(),
                                        mkwEsperaAtrasada: () => relojMonitor.esperaAtrasada() } : {}),
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
  // Para medir desde afuera (herramientas/medir-sitio.mjs): el contador de cuadros al instante (el del medidor se
  // actualiza una vez por segundo) y la memoria del wasm (el "heap": todo lo que el juego tiene reservado), en MB
  window.mkwCuadros = () => M._mkw_web_cuadros();
  window.mkwHeapMB = () => M.HEAPU8.length / 1048576;
  ok('el juego (wasm) cargó', !!M, `${(performance.now() - t1).toFixed(0)} ms`);
  // Carga del programa (§54): cuándo terminó de llegar el .wasm (la red o la caché) y cuándo quedó listo para correr.
  // Con instantiateStreaming el navegador compila MIENTRAS baja; "compilar" = lo que tardó DESPUÉS de que llegó el
  // último byte. bytes = lo que viajó (0 = salió de la caché HTTP; Timing-Allow-Origin deja verlo desde otro origen).
  {
    const w = performance.getEntriesByType('resource').find(e => /\/mkw\.wasm(\?|$)/.test(e.name));
    const listo = performance.now();
    window.mkwEstado.programa = w ? {
      inicio: t1, llegó: w.responseEnd, listo, bajarMs: w.responseEnd - w.startTime, compilarMs: listo - w.responseEnd,
      bytes: w.transferSize, comprimido: w.encodedBodySize, descomprimido: w.decodedBodySize,
    } : { inicio: t1, listo };
    if (w) nota(`programa: llegó en ${(w.responseEnd - w.startTime).toFixed(0)} ms (${(w.transferSize / 1048576).toFixed(1)} MB por la red` +
                `${w.transferSize === 0 ? ', de la caché' : ''}), listo ${(listo - w.responseEnd).toFixed(0)} ms después`);
  }
  window.mkw = M;
  // En qué pantalla está el juego (menus.mjs: lee la memoria de la Wii; para elegir pista o copa desde la página)
  window.mkwMenus = crearLector(M);
  // depuración: el punto de vigilancia de escritura (solo en el build con -DMKW_VIGIA, §62): mkwVigiar(desde, tamaño)
  window.mkwVigiar = (desde, tam) => (M._mkw_vigia_poner ? (M._mkw_vigia_poner(desde >>> 0, tam >>> 0), true) : false);
  // pruebas (§72): dar por terminada la carrera en línea de los pilotos de esta pestaña (como si cruzaran la meta)
  window.mkwTerminarCarrera = () => (M._mkw_modos_terminar ? (M._mkw_modos_terminar(), true) : false);
  // §73: en nuestras salas nadie sale por inactividad (modos_nativo.cpp); ?inactividad=1 = la regla del juego (30 s)
  if (parametros.get('inactividad') === '1') M._mkw_modos_inactividad?.(1);
  // Abrir directo (directo.mjs + directo_nativo.cpp, §71): la página le pide al juego la sección (un jugador, en línea)
  // y el juego la abre con sus propias funciones. ?directo=0: el camino viejo (el piloto apretando botones), para comparar
  const directo = crearDirecto({ M, lector: window.mkwMenus, nota });
  window.mkwDirecto = directo;
  // Botones del juego que aquí no sirven (ocultar.mjs, §66): el juego avisa cada pantalla que se activa (paginas_nativo.cpp)
  // y se esconden antes de dibujarla: «Retro WFC» fuera de la sala en línea y los «Settings» de Retro Rewind. ?ocultar=0: todo como el juego
  const ocultar = crearOcultar({ lector: window.mkwMenus, enLinea: parametros.get('modo') === 'enlinea' });
  window.mkwOcultar = ocultar;
  const ocultarActivo = parametros.get('ocultar') !== '0';
  M.mkwAlActivarPagina = dir => { if (ocultarActivo) ocultar.alActivar(dir); alActivarInicio(dir); };
  // Récords (records.mjs): al terminar cada carrera, el tiempo final (leído del juego) queda como récord personal de
  // esa pista y categoría (modo + cc). Con sesión en el sitio, también va a la tabla de Firebase: la página del sitio
  // llama window.mkwConectarRecords({ almacen: almacenRtdb({ rtdb, db }), uid, nombre }).
  vigilarCarreras({ lector: window.mkwMenus, alTerminar: async c => {
    const r = await records.registrar(c);
    window.mkwEstado.ultimoTiempo = { ...c, ...r };
    const cat = NOMBRE_CATEGORIA(c.cat);
    ui.aviso(`${textoTiempo(c.ms)} en ${cat}` + (r.mejoraLocal ? (r.anterior ? ` — ¡récord personal! (antes ${textoTiempo(r.anterior)})` : ' — tu primer tiempo aquí') : ` · tu mejor: ${textoTiempo(r.anterior)}`) +
      (r.nube === 'subido' ? ' · subido a la tabla' : ''));
    nota(`récord: pista 0x${c.pista.toString(16)} ${c.cat} ${textoTiempo(c.ms)} (${r.nube})`);
  } });

  // El piloto (menus.mjs): con «Gran Premio», «Carrera», «Contrarreloj» o «Copa a tu gusto» elegidos, lleva el juego
  // solo hasta la carrera. La copa o la(s) pista(s) se eligen en una lista de la página (interfaz.mjs) cuando el juego
  // ya cargó sus nombres (en el menú principal). En la dirección, sin preguntar (para las pruebas):
  //   ?modo=vs&copa=13&fila=2 · ?modo=copa&pistas=13.2,0.1,5.3,40.0&semilla=12345 (copa.fila de cada una)
  const conPrimera = r => r && r.pistas ? { ...r, copa: r.pistas[0].copa, fila: r.pistas[0].fila } : r;
  const piloto = crearPiloto({ lector: window.mkwMenus, controles, alAviso: (t, mal) => ui.aviso(t, mal),
    esperarEleccion: () => ui.elegirPista({ modo: objetivoPiloto.modo, copas: leerNombres(window.mkwMenus, M) }).then(conPrimera) });
  window.mkwPiloto = piloto;
  // sin la portada (lo normal) el modo sale solo de la dirección (la sala del sitio); si no, los menús del juego
  const objetivoPiloto = { modo: parametros.get('modo') || (ui.conPortada ? window.mkwModo.modo : 'libre') };
  // En línea, directo (§71): con la red de la sala lista, el juego abre su modo en línea (sección 0x55) y las acciones
  // de sus botones se llaman directo (las mismas funciones que corren al apretarlos): el aviso de datos → Siguiente,
  // «¿Usar Nintendo WFC?» → Sí, el cartel «Welcome to Retro Wi-Fi Connection!» → cerrar, menú
  // Wi-Fi → Mundial, VS o Batalla → VS. El juego busca rivales (página 0x8F) en el WFC de la sala y sigue su propio
  // bucle: votación, carrera, VR… Cualquier otra pantalla (un aviso de Retro Rewind) queda para la persona.
  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function enLineaDirecto({ redLista, tope = 180000 }) {
    const t0 = performance.now();
    while (!redLista()) { if (performance.now() - t0 > tope) return false; await espera(200); }
    if (!await directo.ir(SECCION_DIRECTA.enlinea)) return false;
    const vistas = [];
    let ultimo = 0;
    while (performance.now() - t0 < tope) {
      const e = window.mkwMenus.estado(), arriba = e.pagina;
      if (vistas[vistas.length - 1] !== arriba) vistas.push(arriba);
      window.mkwEstado.directoPaginas = vistas;
      if ((e.seccion === 0x55 && arriba === 0x8f) || e.seccion === 0x58 || (e.seccion > 0 && e.seccion < 0x30)) return true;
      // la sala de las retro de RR (Regional → VS de RR); ?wfc=mundial = la Mundial (solo pistas de Nintendo), la de antes
      const sala = parametros.get('wfc') === 'mundial' ? [BOTON_JUEGO.mundial, BOTON_JUEGO.vs] : [BOTON_JUEGO.regional, BOTON_JUEGO.vsRetros];
      const b = [BOTON_JUEGO.cartel, BOTON_JUEGO.avisoDatos, BOTON_JUEGO.usarWfc, ...sala].find(x => x.pagina === arriba);
      // la acción, cuando la página ya está activa; si sigue ahí 2 s después (no la tomó), otra vez
      if (b && performance.now() - ultimo > 2000 && directo.boton(b)) { ultimo = performance.now(); nota(`directo: botón de la página 0x${arriba.toString(16)}`); }
      await espera(100);
    }
    return false;
  }
  // Volver a la sala después de un corte (§73). Si el juego sale a la sección de desconexión (0x78/0x79: se cortó la
  // red, o el juego sacó a alguien por inactividad —30 s de carrera sin tocar un botón, regla del juego original—), se
  // deja su aviso 3 s, se cierra con su propia función (DisconnectError::OnClick → el menú principal, 0x41) y se vuelve
  // a entrar directo a la sala, como al principio. El juego une a quien llega con la carrera andando cuando esa carrera
  // termina. La carrera cortada no cuenta en la copa ni en la playlist (modos.mjs). ?volver=0 = quedarse en el aviso.
  async function vigilarCortes({ redLista }) {
    const cortes = window.mkwEstado.cortes = [];
    for (;;) {
      await espera(500);
      const e = window.mkwMenus.estado();
      if (e.seccion !== 0x78 && e.seccion !== 0x79) continue;
      const corte = { seccion: e.seccion, desde: Math.round(performance.now()), volvio: null };
      cortes.push(corte);
      nota(`en línea: el juego se desconectó (sección 0x${e.seccion.toString(16)}); vuelvo a entrar a la sala`);
      ui.aviso('Se cortó la conexión con la sala: volviendo a entrar…');
      if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'corte' }, location.origin);
      // el aviso del juego (página 0x89): se cierra a los 3 s; si a los 2 s sigue ahí (no tomó la acción), otra vez
      const t0 = performance.now();
      let ultimo = 0;
      while (performance.now() - t0 < 60000) {
        const s = window.mkwMenus.estado();
        if (s.seccion !== 0x78 && s.seccion !== 0x79) break;
        if (s.pagina === 0x89 && performance.now() - t0 > 3000 && performance.now() - ultimo > 2000 && directo.boton(BOTON_JUEGO.avisoCorte)) ultimo = performance.now();
        await espera(250);
      }
      const llego = await enLineaDirecto({ redLista });
      corte.volvio = llego ? Math.round(performance.now()) : null;
      nota(`en línea: ${llego ? 'de vuelta, buscando la sala' : 'no pude volver a la sala'} después del corte`);
      ui.aviso(llego ? 'De vuelta: buscando la sala' : 'No se pudo volver a la sala', !llego);
      if (!llego) return;
    }
  }
  // ?modo=enlinea (la sala del sitio la pone): el piloto entra solo hasta «VS mundial». Quien no es anfitrión espera a
  // tener ruta al WFC de la sala (10.77.0.1) por la malla antes de conectarse
  if (objetivoPiloto.modo === 'enlinea' && red) {
    const redLista = () => !!red.wfc || !red.router || !!red.router.rutas()['10.77.0.1'];
    (DIRECTO ? enLineaDirecto({ redLista }) : piloto.enLinea({ redLista })).then(llego => {
      window.mkwEstado.piloto = { llego, modo: 'enlinea', paginas: piloto.paginas, directo: DIRECTO };
      nota(`piloto en línea: ${llego ? 'buscando rivales' : 'se detuvo'}`);
      if (!llego) return;
      if (DIRECTO && parametros.get('volver') !== '0') vigilarCortes({ redLista });
      // Vigilante: una búsqueda normal se junta en ~40 s. Una vez de nueve, en las pruebas, los dos quedaron buscando
      // sin juntarse; si pasan 100 s buscando, se cancela (B) y se vuelve a buscar. Solo mientras nadie toque nada.
      let desde = performance.now(), reintentos = 0;
      const vigila = setInterval(async () => {
        const e = window.mkwMenus.estado(), ps = e.paginas || [];
        if (!(e.seccion === 0x55 && ps[ps.length - 1] === 0x8f)) { desde = performance.now(); if (e.seccion === 0x58 || e.seccion === 0x68) clearInterval(vigila); return; }
        if (performance.now() - desde < 100000 || piloto.activo || reintentos >= 5) return;
        reintentos++; desde = performance.now();
        nota(`piloto en línea: 100 s buscando sin juntarse, vuelvo a buscar (${reintentos})`);
        controles.pilotar(0x200); await new Promise(r => setTimeout(r, 150)); controles.pilotar(0);
        await new Promise(r => setTimeout(r, 2500));
        piloto.enLinea({ redLista });
      }, 2000);
    });
  }
  // Los modos de la sala (modos.mjs + modos_nativo.cpp, §72), que manda la sala del sitio: ?estilo=wfc (Retro WFC tal
  // cual) | copa (?carreras=N con puntos) | playlist (?pistas=copa.fila,… la cola); ?cc=c100|c150|espejo|azar (copa y
  // playlist). En los tres, 45 s para elegir personaje, kart y pista (?eleccion=30: el reloj del juego). Al terminar la
  // copa o la cola, el marco le avisa a la sala ({tipo:'fin', tabla}): el anfitrión vuelve al vestíbulo con la tabla.
  if (objetivoPiloto.modo === 'enlinea') {
    let copas = null;
    const nombrePista = (c, f) => { if (!copas) try { copas = leerNombres(window.mkwMenus, M); } catch {} return copas?.[c]?.[f] || ''; };
    const estilo = ['wfc', 'copa', 'playlist'].includes(parametros.get('estilo')) ? parametros.get('estilo') : 'wfc';
    window.mkwSalaModo = crearModo({ estilo, carreras: Math.max(1, Math.min(32, Number(parametros.get('carreras')) || 4)),
      pistas: pistasDe(parametros.get('pistas')), cc: parametros.get('cc') || 'azar',
      segundos: parametros.has('eleccion') ? Number(parametros.get('eleccion')) : SEGUNDOS_ELEGIR,
      M, lector: window.mkwMenus, nota, nombrePista,
      alTerminar: tabla => {
        window.mkwEstado.finModo = tabla;
        if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'fin', estilo, tabla }, location.origin);
      } });
    M.mkwAlDecidir = (pista, cc, votada) => {
      (window.mkwEstado.decisiones ||= []).push({ pista, cc, votada });
      nota(`modos: el anfitrión decidió la pista 0x${pista.toString(16)} (votada 0x${votada.toString(16)}), cc ${cc}`);
    };
  }
  // §73: la carrera directa, sin ningún menú del juego (directo.mjs armarFicha + directo_nativo.cpp): la página escribe
  // la ficha (pista, cc, CPU, personaje y vehículo) y el juego salta a la presentación de la carrera. La cortina tapa
  // el arranque hasta que la carrera está en pantalla. ?modo=directa&pista=13.2&cc=c150&cpu=normal&pj=0&kart=1
  if (objetivoPiloto.modo === 'directa') {
    const [c, f] = (parametros.get('pista') || '0.0').split('.').map(Number);
    const datosFicha = { pista: 0x100 + 4 * c + (f || 0), cc: parametros.get('cc') || 'c150', cpu: parametros.get('cpu') || 'normal',
      humanos: [{ personaje: Number(parametros.get('pj') ?? 0), vehiculo: Number(parametros.get('kart') ?? 1), mando: 0 }],
      semilla: Number(parametros.get('semilla') || 0) >>> 0, objetos: Number(parametros.get('objetos') || 0), intro: parametros.get('intro') === '1' };
    // con la sala sincronizada (?sincro=…&semilla=N): los humanos de la sala, cada uno con su mando (el orden de la sala),
    // como jugadores de verdad; la misma ficha en todas las consolas (misma semilla) y cada una con SU pantalla
    if (sincro) {
      datosFicha.humanos = sincro.humanos.map(h => ({ personaje: h.personaje, vehiculo: h.vehiculo, mando: h.mando }));
      datosFicha.semilla = Number(parametros.get('semilla')) >>> 0;
      window.mkwPantallaPropia = sincro.miPuesto;
    }
    let ficha = armarFicha(datosFicha);
    window.mkwEstado.ficha = ficha;
    if (sincro) {
      ficha.pantallas = 1;                                 // una pantalla: la propia (sección 0x20)
      window.mkwSemillaCarrera = ficha.semilla;            // (semillas_nativo.cpp: el plantel y la pantalla propia van con ella)
    }
    const correr = opciones => directo.carrera(ficha, opciones).then(llego => {
      window.mkwEstado.piloto = { llego, modo: 'directa', directo: true };
      nota(`directo: carrera ${llego ? 'abierta' : 'no se pudo'} (pista 0x${ficha.pista.toString(16)})`);
      revisarCortina();
    });
    if (parametros.get('elegir') === '1') {
      // &elegir=1: antes, personaje y vehículo con las pantallas del juego (abiertas por código); lo elegido va a la ficha
      directo.elegir().then(async ({ abierto, eleccion }) => {
        window.mkwEstado.eleccion = { abierto };
        window.mkwEstado.piloto = { llego: abierto, modo: 'directa', eligiendo: true };
        revisarCortina();
        const e = await eleccion;
        if (!e) return;
        window.mkwEstado.eleccion = { abierto, ...e };
        ficha = window.mkwEstado.ficha = armarFicha({ ...datosFicha, humanos: [{ personaje: e.personaje, vehiculo: e.vehiculo, mando: 0 }] });
        correr({ licencia: -1 });
      });
    } else correr();
  }
  // §73: la sala nueva, sin Retro WFC (sala-carrera.mjs): ?modo=sala&sincro=uidA,uidB…&uid=YO&jefe=UID_ANFITRIÓN&semilla=N
  // &estilo=copa|playlist&carreras=N[&pistas=c.f,…]&cc=c150|c100|espejo&cpu=normal[&nombres={uid:nombre}]. El juego
  // arranca directo en la pantalla de personaje (sin título ni licencias); el anfitrión arma la copa con el selector de
  // la página; cada uno elige personaje y vehículo en el juego (45 s); cada carrera abre directo con la misma ficha en
  // todas (los humanos de verdad + CPU, cada uno con su pantalla) y la corre la carrera sincronizada. Al final, la tabla
  // va a la sala del sitio.
  if (objetivoPiloto.modo === 'sala' && sincro) {
    const estilo = parametros.get('estilo') === 'playlist' ? 'playlist' : 'copa';
    const jefe = parametros.get('jefe') || sincro.humanos[0].uid;
    const semillaSala = Number(parametros.get('semilla')) >>> 0;
    const cola = parametros.has('pistas') ? pistasDe(parametros.get('pistas')) : null;
    let nombres = (() => { try { return JSON.parse(parametros.get('nombres') || '{}'); } catch { return {}; } })();
    // la cilindrada de cada carrera ('azar' = como Retro Rewind: 10 % 100cc, 65 % 150cc, 25 % espejo, sorteada con la
    // semilla de la sala: igual en todas) y la CPU como en un Grand Prix de un jugador (50cc fácil, 100cc normal,
    // 150cc y espejo difícil), salvo que la dirección pida otra (&cpu=…)
    const ccDe = n => {
      const cc = parametros.get('cc') || 'c150';
      if (cc !== 'azar') return cc;
      const x = Math.imul((semillaSala ^ Math.imul(n, 0x9E3779B9)) >>> 0, 0x85EBCA6B) >>> 0, r = x % 100;
      return r < 10 ? 'c100' : r < 75 ? 'c150' : 'espejo';
    };
    const cpuDe = cc => parametros.get('cpu') || ({ c50: 'facil', c100: 'normal' }[cc] || 'dificil');
    window.mkwPantallaPropia = sincro.miPuesto;
    // la sala del sitio (marco de Juegos) avisa los nombres de los pilotos (para la tabla) y, si el anfitrión se va,
    // quién manda ahora (la copa sigue con él, sin recargar)
    addEventListener('message', ev => {
      const d = ev.data;
      if (ev.source !== window.parent || ev.origin !== location.origin || d?.canal !== 'mkw-padre') return;
      if (d.tipo === 'nombres' && d.nombres && typeof d.nombres === 'object')
        nombres = Object.fromEntries(Object.entries(d.nombres).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.slice(0, 20)]));
      else if (d.tipo === 'anfitrion' && typeof d.uid === 'string') window.mkwSala?.cambiarAnfitrion(d.uid);
    });
    let primeraVista = true, miEleccion = null, pickerAbierto = false, reloj = null, vigiaFin = null;
    // §74: los selectores abiertos de la playlist (el del anfitrión, el de sugerir) y el panel de entre carreras
    let selLista = null, selSug = null, breve = null;
    const carrerasPedidas = Math.max(1, Math.min(32, Number(parametros.get('carreras')) || 4));
    // los nombres de las pistas se leen de la memoria del juego (lento): una vez
    let copasLeidas = null;
    const copasSala = () => copasLeidas || (copasLeidas = leerNombres(window.mkwMenus, M));
    let desde = 0;                                  // §75: la primera carrera de la copa que corrió esta consola
    const sala = window.mkwSala = crearSalaCarrera({ yo: sincro.yo, humanos: sincro.humanos, anfitrion: jefe, estilo,
      carreras: carrerasPedidas, pistas: cola,
      enviar: (u, b) => red?.malla?.enviar(u, b, 'tcp'), alCambiar: e => alCambiarSala(e),
      // §75: otro avisa que se salta la carrera k (recargó la página): que la carrera sincronizada no lo espere
      alSalta: (uid, k) => { const h = sincro.humanos.find(x => x.uid === uid); if (h) sincro.lockstep?.saltar(h.mando, k); },
      registro: t => red?.registro?.push(new Date().toISOString().slice(11, 23) + ' ' + t) });
    window.mkwEstado.sala = sala.estado();
    // §75 (pruebas): terminar la carrera de los humanos en el cuadro `cuadro` de la carrera sincronizada, el mismo en
    // todas las consolas (cada pestaña lo pide con el mismo número): el juego da los puestos y los puntos de verdad.
    // puestos = solo esos (por ejemplo [0]: A llega y B no; sin puestos, todos)
    window.mkwTerminarEn = (cuadro, n = sincro.lockstep?.estado().carrera, puestos = null) => {
      if (!sincro.lockstep || !M._mkw_sala_terminar) return false;
      const mascara = Array.isArray(puestos) ? puestos.reduce((m, i) => m | (1 << i), 0) : 0;
      sincro.lockstep.enCuadro(n, cuadro, () => M._mkw_sala_terminar(mascara));
      return true;
    };
    // §75: el tiempo límite de la carrera (el del juego en línea, el de Retro Rewind; lockstep_nativo.cpp): quien no
    // llegó a la meta cuando el reloj de la carrera lo pasa termina con un tiempo estimado. ?limite=N segundos = otro
    // (solo pruebas: esperar 5 minutos de carrera no da)
    if (parametros.has('limite')) M._mkw_sala_limite?.(Math.max(0, Number(parametros.get('limite')) * 1000) >>> 0);
    window.mkwLimiteCarrera = () => M._mkw_sala_limite_juego?.();
    // el juego: directo a la pantalla de personaje (la licencia 1, creada si hace falta)
    directo.elegir().then(({ abierto, eleccion }) => {
      window.mkwEstado.piloto = { llego: abierto, modo: 'sala', eligiendo: true };
      revisarCortina();
      eleccion.then(p => {
        if (!p) return;
        miEleccion = p; window.mkwEstado.eleccion = p;
        // el aviso ANTES de avisar lo elegido: en el anfitrión, elegi() puede arrancar la carrera en el acto (si era el
        // último en elegir) y el aviso escrito después quedaría encima de la carrera
        ui.aviso('¡Listo! Esperando a que elijan los demás…');
        sala.elegi(p);                                     // (si todavía no es la fase de elegir, se manda otra vez al llegar)
      });
    });
    const pistaDe = (e, n) => { const t = e.pistas?.[n - 1]; return t ? 0x100 + 4 * t.copa + t.fila : 0x100; };
    // §74: el nombre de cada piloto (el que manda la sala del sitio) y las sugerencias de la playlist
    const nombreDe = uid => nombres[uid] || `Jugador ${sincro.humanos.findIndex(h => h.uid === uid) + 1}`;
    const pendientesDe = e => (e.lista?.sugerencias || []).filter(s => s.estado === 'pendiente').map(s => ({ ...s, nombre: nombreDe(s.de) }));
    const misSugerencias = e => (e.lista?.sugerencias || []).filter(s => s.de === sincro.yo);
    // §79: en el sitio el marco del juego mide 100vh − 120 px y empieza más abajo del borde de la ventana: el panel de
    // los selectores queda pegado abajo del marco, fuera de la vista. Al abrir uno se le pide al sitio que acomode la
    // página para que se vea el marco entero ({tipo:'mirame'}: scrollIntoView «nearest», solo si hace falta)
    const mirame = () => { if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'mirame' }, location.origin); };
    // el anfitrión elige: la copa (una de las del juego, sus 4 pistas) o arma la playlist con las sugerencias de todos
    function abrirSelectorSala(e) {
      pickerAbierto = true;
      ui.aviso('');
      mirame();
      if (!e.lista) {
        ui.elegirPista({ modo: 'gp', copas: copasSala(), cerrar: false, titulo: 'Elige la copa de la sala', lista: { alAbrir: c => { selLista = c; } } }).then(r => {
          pickerAbierto = false; selLista = null;
          if (r && r.copa >= 0) sala.ponerPistas([0, 1, 2, 3].map(f => ({ copa: r.copa, fila: f })));
          else if (sala.estado().fase === 'copa') alCambiarSala(sala.estado());   // (se cerró sin elegir: se vuelve a abrir)
        });
        return;
      }
      ui.elegirPista({ modo: 'lista', copas: copasSala(), cerrar: false, titulo: 'Arma la playlist de la sala', lista: {
        pistas: e.lista.pistas, clave: 'mkw.lista.sala', sugerencias: true, confirmar: 'Confirmar la playlist', objetivo: carrerasPedidas,
        alCambiar: ps => sala.listaCambio(ps), alAceptar: id => sala.aceptar(id), alRechazar: id => sala.rechazar(id),
        alAbrir: c => {
          selLista = c;
          if (!e.lista.pistas.length && c.pistas.length) sala.listaCambio(c.pistas);   // (venía del borrador: que la vean todos)
          c.sugerencias(pendientesDe(sala.estado()));
        } } }).then(r => {
        pickerAbierto = false; selLista = null;
        if (r?.pistas?.length) sala.ponerPistas(r.pistas);
        else if (sala.estado().fase === 'copa') alCambiarSala(sala.estado());
      });
    }
    // los demás sugieren (mientras se arma la playlist, o entre carrera y carrera con «Sugerir pista»)
    function abrirSugerir(e, entre) {
      ui.aviso('');
      mirame();
      ui.elegirPista({ modo: 'sugerir', copas: copasSala(), cerrar: entre,
        titulo: entre ? 'Sugiere pistas para lo que viene' : 'Sugiere pistas para la playlist', lista: {
          pistas: (entre ? e.pistas : e.lista.pistas) || [], alSugerir: p => sala.sugerir(p),
          nota: entre ? 'El anfitrión decide si entran. La carrera siguiente empieza sola.' : undefined,
          alAbrir: c => { selSug = c; c.sugerencias(misSugerencias(sala.estado())); } } }).then(() => { selSug = null; });
    }
    // entre carrera y carrera de la playlist: el panel con lo que viene
    function mostrarBreve(e) {
      const o = { pistas: e.pistas, hechas: e.carrera, anfitrion: sala.soyAnfitrion, pendientes: pendientesDe(e).length, copas: copasSala(),
        nota: e.pausa && !sala.soyAnfitrion ? 'El anfitrión está agregando pistas…' : '',
        alAgregar: () => agregarEntre(), alSugerir: () => { if (!selSug) abrirSugerir(sala.estado(), true); } };
      if (breve?.abierto) breve.poner(o); else { breve = ui.playlistBreve(o); mirame(); }
    }
    // «+ Agregar pistas» (el anfitrión): la sala espera (hasta 60 s) mientras cambia las que vienen
    function agregarEntre() {
      const e = sala.estado();
      if (!sala.soyAnfitrion || selLista || e.fase !== 'correr') return;
      sala.pausar(true);
      mirame();
      const hechas = e.carrera;
      ui.elegirPista({ modo: 'lista', copas: copasSala(), cerrar: true, textoCerrar: 'Listo', titulo: 'Agrega pistas a la playlist', lista: {
        pistas: (e.pistas || []).slice(hechas), max: Math.max(1, 32 - hechas), clave: '', sugerencias: true, confirmar: 'Seguir', titulo: 'Lo que viene',
        objetivo: Math.min(4, Math.max(1, 32 - hechas)),
        alCambiar: ps => sala.restantesCambio(ps), alAceptar: id => sala.aceptar(id), alRechazar: id => sala.rechazar(id),
        alAbrir: c => { selLista = c; c.sugerencias(pendientesDe(sala.estado())); } } }).then(() => { selLista = null; sala.pausar(false); });
    }
    function alCambiarSala(e) {
      window.mkwEstado.sala = e;
      const primera = primeraVista; primeraVista = false;
      clearInterval(reloj); reloj = null;
      if (e.fase === 'copa') {
        if (sala.soyAnfitrion) {
          if (selSug) { selSug.cerrar(); selSug = null; }    // (sugería y ahora manda: el anfitrión se fue, §74)
          if (!pickerAbierto) abrirSelectorSala(e);
          else selLista?.sugerencias(pendientesDe(e));       // (las sugerencias que van llegando)
        } else if (e.lista) {
          // §74: los demás, en la playlist: sugieren pistas mientras el anfitrión arma la lista
          if (!selSug) abrirSugerir(e, false);
          else { selSug.poner(e.lista.pistas); selSug.sugerencias(misSugerencias(e)); }
        } else ui.aviso('El anfitrión está eligiendo la copa…');
      } else if (e.fase === 'elegir') {
        if (selSug) { selSug.cerrar(); selSug = null; }      // (§74: el anfitrión confirmó la playlist)
        if (selLista) { selLista.cerrar(null); selLista = null; }   // (la copa se fijó sin el selector: un anfitrión nuevo, las pruebas)
        // (lo mío se manda otra vez solo si el anfitrión todavía no lo tiene: en el anfitrión, elegi() cambia el estado y
        // vuelve a llamar aquí; sin esta condición sería un círculo sin fin)
        if (miEleccion && !e.picks?.[sincro.yo]) sala.elegi(miEleccion);
        const cuenta = () => {
          const quedan = Math.max(0, Math.ceil((e.plazo - Date.now()) / 1000));
          const listos = Object.keys(sala.estado().picks || {}).length;
          ui.aviso(miEleccion ? `¡Listo! Esperando a los demás (${listos} de ${sincro.humanos.length})… ${quedan} s`
            : `Elige personaje y vehículo: ${quedan} s…`);
        };
        cuenta(); reloj = setInterval(cuenta, 1000);
      } else if (e.fase === 'correr') {
        const n = e.carrera;
        // §74: en la playlist, mientras se ven los resultados, la lista un rato con «+ Agregar pistas» / «Sugerir pista»
        if (e.lista) {
          if (e.terminaron?.[n] && e.plazo) mostrarBreve(e);
          selLista?.sugerencias(pendientesDe(e));
          if (selSug) { selSug.poner(e.pistas); selSug.sugerencias(misSugerencias(e)); }
        }
        // §75: quien recargó la página con la copa andando (la primera vista ya es una carrera) no entra a esa carrera,
        // aunque esté en los resultados: su consola no tiene los cuadros que ya pasaron. Se la salta —y lo avisa en el
        // latido, para que nadie lo espere— y entra en la siguiente con su puesto y lo que eligió. Lo mismo si la
        // anfitriona lo dejó fuera de esta carrera (no daba señales al empezarla: en todas va "sin nadie").
        const fueraYo = (e.fuera || []).includes(sincro.yo);
        if ((primera || fueraYo) && n >= 1 && sala.arrancar(n)) {
          if (primera) sala.saltar(n);
          ui.aviso(n >= e.carreras ? 'La copa ya va en su última carrera: al final verás la tabla…' : 'La copa ya empezó: entras en la carrera siguiente…');
          return;
        }
        if (!sala.arrancar(n)) return;
        sala.saltar(0);
        ui.aviso('');
        // §74: la carrera nueva: fuera el panel y los selectores de entre carreras
        breve?.cerrar(); breve = null;
        selSug?.cerrar(); selSug = null;
        selLista?.cerrar(null); selLista = null;
        const hs = humanosDeFicha(sincro.humanos, e);
        const cc = ccDe(n);
        const ficha = armarFicha({ pista: pistaDe(e, n), cc, cpu: cpuDe(cc),
          humanos: hs, semilla: semillaSala, carrera: n - 1, carreras: e.carreras, primera: n === 1 });
        ficha.pantallas = 1;
        window.mkwEstado.ficha = ficha;
        window.mkwSemillaCarrera = ficha.semilla;          // (semillas_nativo.cpp: plantel y pantalla propia)
        // (los mandos y el derrape de cada humano, igual en todas las consolas: semillas_nativo.cpp)
        window.mkwPlantel = ficha.puestos.map((q, i) => [q.vehiculo, q.personaje, q.tipo, q.tipo === 0 ? q.mando : -1, q.tipo === 0 ? hs[i]?.derrape || 0 : 0]);
        // (§75: y quiénes están fuera de esta carrera, igual en todas: los que la anfitriona no oyó al empezarla)
        sincro.lockstep?.fijarCarrera(n, (e.fuera || []).map(u => sincro.humanos.find(h => h.uid === u)?.mando).filter(m => m >= 0));
        // (§75: y los puntos que lleva la copa, los de la sala: quien recargó no tiene los de las carreras que se saltó)
        if (n > 1 && e.puntos?.carrera === n - 1) ponerPuntos(window.mkwMenus, e.puntos.tabla);
        if (!desde) desde = n;
        directo.carrera(ficha, { licencia: -1 }).then(llego => {
          nota(`sala: carrera ${n} de ${e.carreras} ${llego ? 'abierta' : 'no se pudo'} (pista 0x${ficha.pista.toString(16)})`);
          window.mkwEstado.piloto = { llego, modo: 'sala', carrera: n };
          revisarCortina();
        });
        // la carrera terminó (Raceinfo +0x28 ≥ 4): se avisa al anfitrión (la misma carrera en todas: cuenta la primera)
        clearInterval(vigiaFin);
        // (§77: recién vale después de ver ESTA carrera corriendo: al llegar «correr n» la consola todavía muestra los
        // resultados de la n−1 —la misma sección, el Raceinfo viejo con la etapa ≥ 4— y la vigía avisaba que la n ya
        // había terminado, con la tabla vieja: la anfitriona saltaba a la siguiente 9 s después)
        let empezo = false;
        vigiaFin = setInterval(() => {
          const L = window.mkwMenus, ri = L.u32(0x809BD730), s = L.estado().seccion, et = ri ? L.u32(ri + 0x28) : -1;
          if (et >= 0 && et < 4) empezo = true;
          // (§75: y con los puntos ya sumados: el juego los suma en el primer cuadro con la carrera terminada, que esta
          // vigía puede ver un cuadro antes; mkw_sala_puntos_sumados lo dice)
          if (empezo && ri && s >= 0x20 && s <= 0x23 && et >= 4 && (M._mkw_sala_puntos_sumados?.() ?? 1)) {
            clearInterval(vigiaFin); sala.termine(n, puntosDelJuego(L), desde);
          }
        }, 500);
      } else if (e.fase === 'fin') {
        clearInterval(vigiaFin);
        breve?.cerrar(); breve = null; selSug?.cerrar(); selSug = null; selLista?.cerrar(null); selLista = null;
        const tabla = tablaDelJuego(window.mkwMenus, sincro.humanos, nombres, e.puntos?.carrera === e.carreras ? e.puntos.tabla : null);
        window.mkwEstado.finModo = tabla;
        ui.aviso(`Fin de la copa: ${tabla.slice(0, 3).map((x, k) => `${k + 1}. ${x.nombre} ${x.puntos}`).join(' · ')}`);
        if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'fin', estilo, tabla }, location.origin);
      }
    }
    // §75: la página no mira su estado inicial (sería el de una sala nueva aunque la copa ya vaya por la carrera 3):
    // la sala llama alCambiarSala recién cuando sabe en qué va (el primer reparto de la anfitriona, o la anfitriona
    // cuando oyó a todos o adoptó la copia). Antes de §75 esta llamada gastaba la "primera vista" y quien recargaba
    // entraba a la carrera en curso desde el cuadro 0 (desincronizada).
    ui.aviso('Conectando con la sala…');
  }
  if (['gp', 'vs', 'tt', 'copa'].includes(objetivoPiloto.modo)) {
    if (parametros.has('copa')) { objetivoPiloto.copa = Number(parametros.get('copa')); objetivoPiloto.fila = Number(parametros.get('fila') || 0); }
    if (parametros.has('pistas')) {
      Object.assign(objetivoPiloto, conPrimera({ pistas: parametros.get('pistas').split(',').map(t => { const [c, f] = t.split('.').map(Number); return { copa: c, fila: f || 0 }; }),
        semilla: Number(parametros.get('semilla') || 0) >>> 0 }));
    }
    // CPU: ?cpu=facil|normal|dificil|ninguna (si no, la que se eligió en la página); ?autoconducir=1 solo para el banco
    if (objetivoPiloto.modo !== 'tt') objetivoPiloto.cpu = parametros.get('cpu') || window.mkwModo.cpu;
    if (parametros.get('autoconducir') === '1') objetivoPiloto.autoconducir = true;
    if (parametros.has('objetos')) objetivoPiloto.objetos = Number(parametros.get('objetos'));
    // Contrarreloj: contra el mejor fantasma (si no, solo): ?fantasma=0 o lo elegido en la página
    if (objetivoPiloto.modo === 'tt') objetivoPiloto.fantasma = parametros.has('fantasma') ? parametros.get('fantasma') !== '0' : window.mkwModo.fantasma !== false;
    ui.aviso(ui.cortinaPuesta ? '' : 'Yendo a la carrera… (Esc para manejar tú)');
    piloto.ir(objetivoPiloto).then(async llego => {
      window.mkwEstado.piloto = { llego, ...objetivoPiloto, paginas: piloto.paginas };
      nota(`piloto: ${llego ? 'llegó a la carrera' : 'se detuvo'} (${JSON.stringify(objetivoPiloto)}) páginas ${piloto.paginas.map(p => p.toString(16)).join(',')}`);
      if (llego && objetivoPiloto.modo === 'copa') {
        // las carreras 2, 3 y 4 de la copa a tu gusto: el piloto pone cada pista cuando aparece la pantalla de copas
        window.mkwEstado.copa = { carrera: 1 };
        const total = objetivoPiloto.pistas?.length || 4;          // (§74: la lista puede tener hasta 32)
        ui.aviso(`Copa a tu gusto: carrera 1 de ${total}`);
        const termino = await piloto.seguirCopa(objetivoPiloto, n => { window.mkwEstado.copa = { carrera: n + 1 }; ui.aviso(`Copa a tu gusto: carrera ${n + 1} de ${total}…`); });
        window.mkwEstado.copa.termino = termino;
        window.mkwSemillaCarrera = null;          // las carreras que vengan después: el azar de siempre
        nota(`copa a tu gusto: ${termino ? `jugó las ${total}` : 'se dejó'}`);
      }
    });
  }

  // La cortina (§66): tapa la pantalla hasta que el juego llega a su título (sin piloto) o hasta que el piloto termina
  // de recorrer solo los menús del juego (con piloto: la sala del sitio o ?modo=…), y vuelve mientras el piloto los
  // recorre otra vez (las carreras 2–4 de la copa). Esc le quita el mando al piloto, y con eso se va la cortina.
  // Secciones del juego que cuentan como "ya cargó": el título, el menú principal y las carreras (< 0x30).
  // Con el menú de inicio (§67) el modo se decide después (Single Player, Multiplayer local): por eso se mira cada vez.
  let revisarCortina = () => {};
  {
    const MODOS_PILOTO = ['gp', 'vs', 'tt', 'copa', 'unjugador', 'local', 'directa', 'sala'];
    // abrir directo (§71): sin cortina; lo que se ve es el juego cambiando de pantalla con su propio fundido
    const directoSinCortina = () => DIRECTO && ['enlinea', 'unjugador'].includes(objetivoPiloto.modo);
    const conPiloto = () => directoSinCortina() ? false : objetivoPiloto.modo === 'enlinea' ? !!red : MODOS_PILOTO.includes(objetivoPiloto.modo);
    const textoPiloto = () => ({ enlinea: 'Entrando a la sala…', copa: 'Preparando la carrera…', directa: 'Preparando la carrera…', sala: 'Entrando a la sala…', unjugador: 'Entrando a Single Player…',
      local: 'Entrando a Multiplayer…' }[objetivoPiloto.modo] || 'Yendo a la carrera…') + (matchMedia('(pointer: fine)').matches ? ' (Esc: lo hago yo)' : '');
    let vioTitulo = false, puesta = '';
    revisarCortina = () => {
      const e = window.mkwMenus.estado();
      if (e.seccion === SECCION.titulo || e.seccion === SECCION.menuPrincipal || (e.seccion > 0 && e.seccion < 0x30)) vioTitulo = true;
      if (window.mkwEstado.piloto?.llego && e.seccion > 0) vioTitulo = true;   // §73: abrió directo otra pantalla (elegir personaje)
      const piloteando = conPiloto() && (piloto.activo || !window.mkwEstado.piloto);
      const quiere = !vioTitulo ? 'carga' : piloteando ? 'piloto' : '';
      if (quiere === puesta) return;
      puesta = quiere;
      if (quiere === 'piloto') ui.cortina(textoPiloto());
      else if (!quiere) {
        ui.cortina(false); window.mkwEstado.cortinaFuera = performance.now();
        if (!conPiloto() && !quiereInicio) clearInterval(vigilaCortina);   // con menú de inicio puede volver a hacer falta
      }
    };
    const vigilaCortina = setInterval(revisarCortina, 200);
  }

  // El menú de inicio (§67): Single Player → el piloto hasta el menú «Un jugador» del juego; Multiplayer local → hasta
  // el menú principal con el cursor en «2 Players». Ahí se detiene: lo demás se elige con los menús del juego.
  const DESTINO = {
    unjugador: { pagina: PAGINA.unJugador, seccion: SECCION.unJugador },
    local: { pagina: PAGINA.menuPrincipal, alLlegar: async toque => { await toque(BOT.derecha); } },
  };
  pedirPiloto = que => {
    objetivoPiloto.modo = que;
    window.mkwEstado.piloto = null;
    revisarCortina();                               // la cortina al tiro (si el juego ya mostraba su título)
    if (DIRECTO && que === 'unjugador') {           // §71: el juego abre su menú «Un jugador» de una
      directo.ir(SECCION_DIRECTA.unjugador).then(llego => {
        window.mkwEstado.piloto = { llego, modo: que, directo: true };
        nota(`directo: ${que} ${llego ? 'abierto' : 'no se pudo'}`);
        revisarCortina();
      });
      return;
    }
    piloto.hasta(DESTINO[que]).then(llego => {
      window.mkwEstado.piloto = { llego, modo: que, paginas: piloto.paginas };
      nota(`piloto del menú de inicio: ${que} ${llego ? 'llegó' : 'se detuvo'} (páginas ${piloto.paginas.map(p => p.toString(16)).join(',')})`);
      revisarCortina();
    });
  };
  if (eleccionPendiente) { const que = eleccionPendiente; eleccionPendiente = null; pedirPiloto(que); }

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
    if (!primerCuadro && ahora.c > 0) { window.mkwEstado.primerCuadroMs = ahora.t; primerCuadro = true; ok('primer cuadro dibujado', true, `a los ${((ahora.t - t1) / 1000).toFixed(1)} s`); }
    // Solo cuentan los segundos que EMPIEZAN pasado el cuadro 420: el título carga sus archivos entre los cuadros
    // ~300 y ~360 (Code.pul de Retro Rewind, Title.szs, 2.416 búsquedas en el índice), y en la primera visita ese
    // segundo espera a la red. Con el corte en 300, según dónde caía el límite del segundo, entraba o no (§52).
    if (desde >= 420) medidas.push({ fps, trabajo });
    // una línea por segundo en la consola: así la prueba deja la "película" del ritmo del juego
    console.log(`[medidor] ${((ahora.t - t1) / 1000).toFixed(0)} s: cuadro ${ahora.c}, ${fps.toFixed(1)} fps, ` +
                `trabajo ${trabajo.toFixed(2)} ms, disco ${lecturas} lecturas (red ${de.pedidosRed} pedidos ${(de.bytesRed / 1048576).toFixed(1)} MB, caché ${de.bloquesCache} bloques, esperó ${esperaDiscoSeg.toFixed(0)} ms; adelantados ${de.adelantados}, aprovechados ${de.aprovechados}, cola baja ${de.colaBaja ? de.colaBaja() : 0}), ` +
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
  enviarAlJuego = (...estado) => {
    if (sincro && estado[0] === 0) sincro.local = estado.slice(2, 9);   // lo mío, para la carrera sincronizada
    M._mkw_web_pad(...estado);
  };
  // la carrera sincronizada: el juego le pide a M.mkwLockstep los botones de cada cuadro (pad_web.cpp)
  if (sincro && red?.malla) {
    // §73: en la sala nueva (carrera directa) se le da a quien se corta un MARGEN para volver antes de seguir sin él:
    // 30 s (?margen=N segundos); la carrera queda en pausa en todas mientras tanto
    const margen = parametros.has('margen') ? Number(parametros.get('margen')) * 1000 : ['directa', 'sala'].includes(objetivoPiloto.modo) ? 30000 : undefined;
    sincro.lockstep = crearLockstep({ yo: sincro.yo, humanos: sincro.humanos, local: () => sincro.local, esperaCorte: margen,
      enviar: (u, b, canal) => red.malla.enviar(u, b, canal), huella: () => huellaCarrera(window.mkwMenus),
      registro: t => red.registro.push(new Date().toISOString().slice(11, 23) + ' ' + t) });
    M.mkwLockstep = sincro.lockstep;
    M.mkwLockstepFin = () => controles.reenviar();   // terminó la carrera: la página vuelve a mandar sus mandos
    // ?rastro=1 (solo para depurar, §70): en cada cuadro de la carrera sincronizada, el azar de la carrera (azar 1 y 2)
    // y de cada uno de los 12 RaceinfoPlayer su avance (+0xC) y una huella del resto de sus 0x54 bytes, en
    // window.mkwRastro (los últimos 4000 cuadros, con la clave "carrera:cuadro"). `prueba-sincro --rastro` compara los de las dos pestañas y dice en qué cuadro y qué kart se separó primero
    // ?depura=desde-hasta: el tramo de cuadros que anota el programa de depuración (MKW_DEPURAR_LS, depurar_lockstep.cpp)
    if (parametros.get('depura')) window.mkwDepura = parametros.get('depura');
    if (parametros.get('volcar')) window.mkwDepuraVolcar = Number(parametros.get('volcar'));   // y el cuadro en que vuelca la IA
    if (parametros.get('vigiaIA')) window.mkwVigiaIA = parametros.get('vigiaIA').split('.').map(Number);   // cuadro.índice.desplazamiento.tamaño[.puntero]
    if (parametros.get('rastro') === '1') {
      const rastro = window.mkwRastro = [], pad0 = sincro.lockstep.pad;
      sincro.lockstep.pad = async cuadro => {
        const datos = await pad0(cuadro), L = window.mkwMenus;
        const ri = L?.u32(0x809BD730), lista = ri && L.u32(ri + 0xC);
        if (lista && L.u32(ri + 0x28) < 4) {                       // etapa < 4: la carrera (después, los resultados son locales)
          const fila = [`${sincro.lockstep.estado().carrera}:${cuadro}`];
          for (const r of [L.u32(ri + 4), L.u32(ri + 8)]) fila.push(r ? L.u32(r + 8) : 0, r ? L.u32(r + 12) : 0);
          for (let i = 0; i < 12; i++) {
            const pl = L.u32(lista + 4 * i);
            let h = 2166136261;
            for (let o = 0; o < 0x54; o += 4) if (o !== 0xC) h = Math.imul(h ^ L.u32(pl + o), 16777619);
            fila.push(L.u32(pl + 0xC), h >>> 0);                   // el avance en la carrera (+0xC) y el resto
          }
          rastro.push(fila);
          if (rastro.length > 4000) rastro.shift();
        }
        return datos;
      };
    }
    // cada 3 s: ¿la sala va lenta por alguien? (lockstep.mjs, avisoLento/vigiaLento; §70). Los avisos quedan en
    // window.mkwAvisosLento para las pruebas
    window.mkwAvisosLento = [];
    // §73: a quién se espera (se cortó) y cuánto queda del margen, cada medio segundo
    window.mkwAvisosCorte = [];
    // y al empezar cada carrera, mientras los demás todavía cargan la pista: la carrera está quieta en su primer cuadro
    // (nadie avanza sin los botones de todos) y empieza en el mismo cuadro para todos; se avisa a quién se espera
    window.mkwAvisosLlegada = [];
    let avisandoLlegada = false;
    setInterval(() => {
      const e = sincro.lockstep.estado().esperando;
      if (avisandoLlegada && !(e?.llegando)) { avisandoLlegada = false; ui.aviso(''); }
      if (!e || e.ms < (e.llegando ? 400 : 1500)) return;
      const quien = e.uids.map(u => `jugador ${sincro.humanos.findIndex(h => h.uid === u) + 1}`).join(' y ');
      if (e.llegando) {
        const texto = `Esperando a que ${quien} termine de cargar la pista: la carrera empieza al mismo tiempo para todos…`;
        if (!avisandoLlegada) { avisandoLlegada = true; window.mkwAvisosLlegada.push(texto); }
        ui.aviso(texto);
        return;
      }
      const texto = `Se cortó la conexión con ${quien}: lo esperamos ${Math.max(0, Math.ceil((e.margen - e.ms) / 1000))} s (si no vuelve, la carrera sigue sin él)`;
      ui.aviso(texto, true);
      if (window.mkwAvisosCorte.length < 200) window.mkwAvisosCorte.push(texto);
    }, 500);
    const vigia = vigiaLento(sincro.humanos);
    setInterval(() => {
      const texto = vigia(sincro.lockstep.estado(), performance.now());
      if (texto) { ui.aviso(texto, true); window.mkwAvisosLento.push(texto); }
    }, 3000);
  }
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
    vocesCpuBrsar.push(...gruposConNombreBrsar(await disco.leer(url, tam, 0, largo), tam)
      .filter(([nombre]) => /^GRP_VO_[A-Z0-9]+_(CAN_)?NPC$/.test(nombre)).map(([, ini, fin]) => [ruta, ini, fin]));
  })().catch(e => escribe('[mkw] tabla de grupos: ' + e.message));
  // Los diminutos (≤ 8 KB) por carpeta: si el juego lee dos seguidos de la misma carpeta, el resto se pide de una vez
  // (disco.mjs, carpeta en racha, §76: los 64 fantasmas del menú «Un jugador»). ?vecinos=0: sin esto.
  if (parametros.get('vecinos') !== '0')
    disco.vecinos([...tamaños].filter(([, tam]) => tam > 0 && tam <= 8192).map(([ruta, tam]) => [direccion(ruta), tam]));
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
  // Precalentado postergado (§76): se pide apenas el juego llega a su primera pantalla (el título, o la que abrió
  // directo), con la música del título ya en camino; si en 30 s no llegó a ninguna, se pide igual
  // la marca para las próximas visitas: 20 s después de llegar a la primera pantalla ya se compiló lo de la lista
  const vigiaMarca = setInterval(() => {
    if (!((window.mkwMenus?.estado?.().seccion ?? -1) >= 0)) return;
    clearInterval(vigiaMarca);
    setTimeout(() => { try { localStorage.setItem('mkw.precalentado', '1'); } catch {} }, 20000);
  }, 500);
  if (PRECALENTAR_TARDE && M._mkw_web_pipelines_precalentar) {
    const desdeMain = performance.now();
    const vigiaPrecalentado = setInterval(() => {
      const e = window.mkwMenus?.estado?.();
      if (!(e && e.seccion >= 0) && performance.now() - desdeMain < 30000) return;
      clearInterval(vigiaPrecalentado);
      const n = M._mkw_web_pipelines_precalentar(), ms = Math.round(performance.now() - desdeMain);
      window.mkwEstado.precalentadoTarde = { n, ms, seccion: e ? e.seccion : -1 };
      nota(`pipelines postergados: ${n} pedidos ahora (${(ms / 1000).toFixed(1)} s después de main(), sección 0x${((e && e.seccion) ?? -1).toString(16)})`);
    }, 50);
  }
  guardado.pedirPersistencia().then(si => nota(`almacenamiento persistente: ${si ? 'sí' : 'no (el navegador podría borrarlo si le falta espacio)'}`));
  window.mkwEstado.horaMain = Date.now();  // los archivos con fecha posterior los escribió el juego
  // La base de Mii con al menos un Mii (si estaba vacía se pone uno y se guarda solo, ya con el guardado vigilando):
  // con él el juego crea la licencia 1 si la partida es nueva, al abrir directo (directo.mjs)
  if (DIRECTO) {
    const miiLicencia = prepararMii(M.FS, parametros.get('nombre') || 'Piloto');
    directo.ponerMii(miiLicencia);
    if (miiLicencia.nueva) nota('directo: base de Mii vacía, puse un Mii para la licencia');
  }
  if (parametros.get('adelantar') !== '0' && parametros.get('semillaArranque') !== '0') adelantarArranque(tamaños);   // §76
  nota('arrancando main() — el juego corre');
  ui.cortina('Arrancando…');
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
// (se baja una sola vez: la usan la semilla del arranque y este precalentado)
let semillaBloques = null;
const leerSemillaBloques = () => semillaBloques ??= fetch(ORIGEN + '/build/bloques.json', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null).catch(() => null);
async function precalentarBloques(tamaños) {
  const semilla = await leerSemillaBloques();
  if (!semilla) return;
  const minimo = semilla.corridas >= 2 ? 2 : 1;          // con varias corridas, solo lo que se repite (no los CPU al azar)
  // solo lo que el juego necesitó por primera vez después del título (lo de antes ya lo bajó él al arrancar), y como
  // mucho 32 MB, en el orden en que los fue necesitando
  const todos = (semilla.bloques || []).filter(([ruta, , cuadro]) => cuadro >= 300 && tamaños.has(ruta));
  const lista = todos.filter(([, , , veces]) => veces >= minimo);
  let n = 0, bytes = 0;
  // Las voces de los corredores CPU (bloquesVocesCpu) van intercaladas donde el juego las necesita: en el cuadro en
  // que las semillas vieron por primera vez una voz de CPU (la cuenta regresiva); si no hay dato, al final.
  const VOZ = /\/Character\/Sound\/[^/]*_NPC\.|revo_kart\.brsar$/;
  const cuadroVoces = Math.min(...todos.filter(([ruta, , , veces]) => veces < minimo && VOZ.test(ruta)).map(([, , c]) => c), Infinity);
  const voces = parametros.get('voces') !== '0' ? bloquesVocesCpu(tamaños) : [];
  const orden = [...lista.map(([ruta, b, cuadro]) => [ruta, b, cuadro, false]), ...voces.map(([ruta, b]) => [ruta, b, cuadroVoces, true])]
    .sort((x, y) => x[2] - y[2]);
  let nVoces = 0, bytesVoces = 0;
  const pedidos = new Set();
  // bloques seguidos del mismo archivo van en UN pedido (menos viajes a la red; la fila baja espera entre pedidos)
  let tramo = null;
  const cerrar = () => { if (tramo) disco.adelantarBloques(direccion(tramo.ruta), tamaños.get(tramo.ruta), tramo.b0, tramo.b1); tramo = null; };
  for (const [ruta, b, , esVoz] of orden) {
    if (pedidos.has(ruta + '|' + b)) continue;
    const tam = tamaños.get(ruta), largo = Math.min(disco.bloque, tam - b * disco.bloque);   // el último es más corto
    if (largo <= 0 || (!esVoz && bytes + largo > 32 * 1048576)) continue;
    pedidos.add(ruta + '|' + b);
    if (tramo && tramo.ruta === ruta && tramo.b1 === b - 1 && tramo.b1 - tramo.b0 < 7) tramo.b1 = b;
    else { cerrar(); tramo = { ruta, b0: b, b1: b }; }
    if (esVoz) { nVoces++; bytesVoces += largo; } else { n++; bytes += largo; }
  }
  cerrar();
  nota(`semilla de bloques: ${n} bloques (${(bytes / 1048576).toFixed(1)} MB) pedidos con prioridad baja`);
  if (voces.length) nota(`voces de los corredores CPU: ${nVoces} bloques (${(bytesVoces / 1048576).toFixed(1)} MB), ` +
                         `intercaladas en el cuadro ${cuadroVoces === Infinity ? '(al final)' : cuadroVoces}`);
}

// La semilla del ARRANQUE (§76): lo que el juego lee antes de su título (en la semilla, cuadro < 450: el código y la
// configuración de Retro Rewind, el menú HOME, los Mii, las fuentes, el título y su grupo de sonido; ~100 bloques) lo
// lee de a una lectura, esperando cada una: en la 1.ª visita eran ~2 s de viajes a la red seguidos, y la música del
// título (lo primero que se oye, debajo del menú de inicio) esperaba todo eso. Se pide entero apenas arranca main(),
// con prioridad normal y en paralelo (como mucho 12 pedidos a la vez, disco.mjs), en el orden en que el juego lo va a
// leer; con caché sale de Cache Storage, también en paralelo. ?semillaArranque=0: sin esto.
async function adelantarArranque(tamaños) {
  const semilla = await leerSemillaBloques();
  if (!semilla) return;
  const minimo = semilla.corridas >= 2 ? 2 : 1;
  const lista = (semilla.bloques || []).filter(([ruta, , cuadro, veces]) => cuadro < 450 && veces >= minimo && tamaños.has(ruta))
    .sort((x, y) => x[2] - y[2] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]));
  let tramo = null, pedidos = 0;
  // bloques seguidos del mismo archivo van en UN pedido (hasta 8 bloques, 2 MB)
  const cerrar = () => {
    if (tramo) { disco.adelantarRango(direccion(tramo.ruta), tamaños.get(tramo.ruta), tramo.b0 * disco.bloque, (tramo.b1 + 1) * disco.bloque); pedidos++; }
    tramo = null;
  };
  for (const [ruta, b] of lista) {
    if (tramo && tramo.ruta === ruta && tramo.b1 === b - 1 && tramo.b1 - tramo.b0 < 7) tramo.b1 = b;
    else { cerrar(); tramo = { ruta, b0: b, b1: b }; }
  }
  cerrar();
  window.mkwEstado.semillaArranque = { bloques: lista.length, pedidos };
  nota(`semilla del arranque: ${lista.length} bloques en ${pedidos} pedidos, antes de que el juego los lea`);
}

// Las voces de los corredores de la consola (CPU), §54. En cada carrera la consola elige corredores al azar, y en la
// cuenta regresiva el juego lee la voz de cada uno: el comienzo de su grupo en revo_kart.brsar (GRP_VO_MR_NPC…) y,
// para los personajes de Retro Rewind, su archivo en Character/Sound (…_NPC.brwsd/.brbnk). Son ~15 lecturas de a una,
// ~60 ms cada una con la red del sitio: ~1 s de juego congelado al largar. La semilla de bloques no las tiene (cambian
// en cada carrera; solo guarda lo que se repite), así que se piden todas con la semilla, con prioridad baja: los 42
// grupos de voces de CPU enteros (56 bloques, 14 MB) y los archivos de voces de CPU de Retro Rewind enteros (174
// archivos, 26,7 MB); solo en la 1.ª visita, después salen de la caché. ?voces=0: sin esto.
const vocesCpuBrsar = [];                    // [ruta del brsar, inicio, fin del grupo], de la tabla de grupos (más abajo)
function bloquesVocesCpu(tamaños) {
  const salida = [];
  for (const [ruta, ini, fin] of vocesCpuBrsar)          // el grupo entero (el juego lo lee en pedazos de 300–400 KB)
    for (let b = Math.floor(ini / disco.bloque); b <= Math.floor((fin - 1) / disco.bloque); b++) salida.push([ruta, b]);
  for (const [ruta, tam] of tamaños) if (/\/Character\/Sound\/[^/]*_NPC\./.test(ruta))   // el archivo entero (1 o 2 bloques)
    for (let b = 0; b <= Math.floor((tam - 1) / disco.bloque); b++) salida.push([ruta, b]);
  return salida;
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
    '[network]', `enabled = ${red ? 'true' : 'false'}`, '',     // en línea solo con la red de la sala (?red=1, §58)
    '[discord]', 'enabled = false', '',
    // §79: la imagen siempre 16:9. SDL3 agranda el canvas a su tamaño en la página cada vez que la ventana (o el marco
    // del sitio) cambia de tamaño; sin esto, el "aspecto dinámico" de WiiCompiled estiraba la escena 3D a esa forma y lo
    // 2D del juego (la cortina de Lakitu, el HUD) quedaba en la franja 16:9 del medio. Con force_16_9 aurora dibuja 16:9
    // y pone las barras negras dentro del canvas. ?aspecto=libre: el estirado de antes (para comparar)
    '[video]', 'widescreen = true', `force_16_9 = ${parametros.get('aspecto') === 'libre' ? 'false' : 'true'}`, '',
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
  // Precalentado postergado (§76): aurora lee las listas igual, pero los pedidos esperan a la primera pantalla del juego
  // (de a 2 por cuadro: ya suena la música del título; ?precalentarRitmo=N para probar otro ritmo)
  if (PRECALENTAR_TARDE) m.ENV.MKW_PRECALENTAR = 'tarde' + (parametros.has('precalentarRitmo') ? ':' + parametros.get('precalentarRitmo') : '');
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

// Sin la portada (lo normal, §66) el juego arranca solo al abrir la página; con ?portada=1, al apretar «Jugar»
const arrancarYa = () => arrancar().catch(e => { ui.cortina(`No pude arrancar el juego: ${e && e.message || e}`, true); throw e; });
$('arrancar').addEventListener('click', arrancarYa);
if (parametros.get('auto') === '1' || !ui.conPortada) arrancarYa();
