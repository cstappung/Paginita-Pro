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
import { crearControles, BOTON, juntarPuertos } from './controles.mjs';
import { crearAvisosLag, CHIPS_LAG } from './avisos-lag.mjs';   // §262: «Mostrar avisos de conexión y lag»
import { crearSonido } from './sonido.mjs';
import { crearGuardado } from './guardado.mjs';
import { crearNube } from './nube.mjs';
import { crearRespaldos } from './respaldos.mjs';
import { crearDisco, leerPaquete, memoriaDeBloques } from './disco.mjs';
import { crearLotes } from './lote.mjs';
import { crearPipelines } from './pipelines.mjs';
import { largoEncabezadoBrsar, gruposBrsar, gruposConNombreBrsar } from './brsar.mjs';
import { crearInterfaz } from './interfaz.mjs';
import { montarControles } from './opciones-mandos.mjs';
import { crearRecords, vigilarCarreras, textoTiempo, nombreCategoria as NOMBRE_CATEGORIA } from './records.mjs';
import { crearLector, crearPiloto, leerNombres, SECCION, PAGINA, BOT } from './menus.mjs';
import { crearPila, crearConmutador, crearEnlaceCanal, crearRouterMalla } from './red.mjs';
import { crearMalla, senalPadre, senalCanal } from './malla.mjs';
import { montarMandoSitio } from './mando-sitio.mjs';
import { crearConexiones, avisoConexiones } from './conexiones.mjs';
import { crearWfc } from './wfc.mjs';
import { crearVr, presentarVr, extraerVrbr } from './vr.mjs';
import { crearLockstep, huellaCarrera, huellaAmpliada, armarPlantel, vigiaLento, SERVIDOR, MARCA as MARCA_LOCKSTEP } from './lockstep.mjs';
import { configArbitro, crearConexionArbitro, UID_SERVIDOR } from './arbitro-servidor.mjs';
import { crearPrivado } from './privado.mjs';
import { crearOcultar } from './ocultar.mjs';
import { crearInicio } from './inicio.mjs';
import { prepararMii, crearDirecto, armarFicha, SECCION_DIRECTA, BOTON as BOTON_JUEGO } from './directo.mjs';
import { asegurarInvitados, leerInvitados, invitadoElegido, mejorarMiiNuevo, LETRAS as LETRAS_INVITADO } from './invitados.mjs';
import { crearModo, pistasDe, SEGUNDOS_ELEGIR } from './modos.mjs';
import { escalonDe, leerCapacidad, anotarCarrera, capacidadLatido, lentosDe, textoLentos, resumirCarrera, envolverPadSala } from './escalon.mjs';
import { crearSala as crearSalaCarrera, humanosDeFicha, tablaDelJuego, puntosDelJuego, ponerPuntos, vrsDeCarrera, reglaCpuDe, MARCA_SALA,
         llegadaDelJuego, ponerParrilla, SEGUNDOS_RESULTADOS, copaMasPedida, correnEn, sumadosEn, VERSION_SALA, MARGEN_PAUSA_CUADROS } from './sala-carrera.mjs';
import { cambiosVr, peorCaso, aplicarCambio, corredoresDelJuego, VR_INICIAL as VR_INICIAL_SALA } from './vr-sala.mjs';
import { crearCuentaDnf, DNF_MS } from './dnf.mjs';
import { crearLetreros, filasDeTabla } from './letreros.mjs';
import { escribirNombres, leerNombresCpu, leerSkins, escribirSkins } from './nombres-juego.mjs';
import { crearPreparacion, graficosListos } from './preparacion.mjs';
import { crearAvisoGpu } from './aviso-gpu.mjs';
import { crearFantasmaPagina } from './fantasma-pagina.mjs';
import { crearDescargas, montarBarraDescarga } from './descargas.mjs';
import { leerGraficos, guardarGraficos, lineasVideo, montarGraficos, montarMedidor, limitarSalida, queFrena, presupuesto } from './graficos.mjs';
import { instalarPerfilGpu } from './perfil-gpu.mjs';
import { crearLastreCpu, crearLadron, instalarLastreGpu, lastreDeParametros } from './lastre.mjs';
import { crearPersistencia, textoPersistencia } from './persistencia.mjs';
import { crearTramo, tramoDeParametros, repartoLastre, sinTopeActivo, crearBomba } from './sin-tope.mjs';
import { n11DeParametros, instalarN11 } from './n11-video.mjs';
import { crearMemoriaLocal, crearPaquete, carreraEnCamino } from './paquete-carrera.mjs';
import { crearUsoPistas, armarResumen, archivosDePista, esDePista, CLAVE_USO } from './espacio.mjs';   // §251: borrar por partes
import { montarEspacio } from './espacio-panel.mjs';
import { crearImagenes } from './imagenes.mjs';
import { crearVideosMenu } from './videos-menu.mjs';
import { envAnillo, envCaliente } from './anillo.mjs';
import { crearVigiaAhorro, crearVigiaCalor, prendido as energiaPrendida, CALOR } from './energia.mjs';
import { riesgoAdreno } from './adreno.mjs';
import { modoPiscina, modoHuesosFilas, modoSoltarPipelines, modoTecho, mascaraTecho, modoIsla, modoSumidero, cuadroFoto, azarFijo } from './interruptores-e0.mjs';
import { modoW10, mandaCaja, crearMandadero } from './w10.mjs';
import { modoPedido, modoAutomatico, crearVigiaN8 } from './n8.mjs';
import { estadoHilos } from './aislar.mjs';
import { instalarCensoGpu } from './censo-gpu.mjs';
import { crearImagenesVista, engancharImagenes, textoResumen, dibujarGrafico, crearRitmoJuego, envolverEsperaJuego, PUNTOS_GRAFICO } from './imagenes-vista.mjs';
import { crearAutoCalibrar, crearAvisoPausa, montarBotonCalibrar } from './auto-calibrar.mjs';   // §274
import { crearRitmoMenus } from './ritmo-menus.mjs';
import { montarBienvenida, montarAyuda } from './bienvenida.mjs';
import { crearCaidas } from './caidas.mjs';
import { crearRedEstado, MARCA_RED_ESTADO } from './red-estado-sala.mjs';
import { crearArranque } from './arranque.mjs';   // §276: la línea de tiempo del arranque (solo mira)
import { crearCartelCarga, crearMedidorPipes, faseCarga } from './cartel-carga.mjs';   // §276b: qué hace mientras carga

const parametros = new URLSearchParams(location.search);
// §275: ?red=estado = el piloto «host + predicción» (apagado por omisión): la red NATIVA del juego (RKNet: cada consola
// maneja su kart y manda su estado) por la malla WebRTC = ?red=malla&modo=enlinea, más la sonda que mide
// (red-estado.mjs, window.mkwRedEstado). No es la sala de §73: pasa por las pantallas de Retro WFC (§58)
// §288: con un solo humano en la sala, «Cada uno su kart» corre la carrera de siempre (la red nativa del juego sin nadie del
// otro lado no creaba los karts y la carrera terminaba en el primer cuadro: el dueño, 2026-11-12). ?estadoSolo=1 = como antes
const UN_HUMANO_SALA = parametros.get('modo') === 'sala' && (parametros.get('sincro') || '').split(',').filter(Boolean).length < 2
  && parametros.get('estadoSolo') !== '1';
if (parametros.get('red') === 'estado' && UN_HUMANO_SALA) { parametros.delete('red'); console.log('[red-estado] §288 un solo humano: la carrera de siempre'); }
const RED_ESTADO = parametros.get('red') === 'estado';
// §275b: con ?modo=sala es la opción de la sala «Cada uno su kart»: la sala de siempre (copa, elegir, puntos…) pero la
// carrera sin lockstep, con la red nativa por el DWC falso (red_estado_nativo.cpp + red-estado-sala.mjs)
let RED_ESTADO_SALA = RED_ESTADO && parametros.get('modo') === 'sala';   // (let: vuelve a false si el programa no lo trae, abajo de crear())
if (RED_ESTADO) { parametros.set('red', 'malla'); if (!parametros.has('modo')) parametros.set('modo', 'enlinea'); }
if (RED_ESTADO || parametros.get('sonda') === '1') import('./red-estado.mjs')   // (?sonda=1: la misma sonda en la sala de siempre, para comparar)
  .then(m => { window.mkwRedEstado = m.crearSonda({ lector: () => window.mkwMenus }); });
// §225 (W21): mientras index.html registra el service worker que aísla la página y va a recargarla, no arrancar nada
// (sin esto, la primera carga empezaba a bajar el juego para tirarlo a la basura con la recarga)
if (window.mkwEsperaAislar) await new Promise(listo => { const t = setInterval(() => { if (!window.mkwEsperaAislar) { clearInterval(t); listo(); } }, 50); });
// §148 (P3): sin filtros CSS que se recalculen en cada cuadro encima del juego (dnf.mjs, el plano del selector)
if (parametros.get('filtrosLivianos') !== '0') document.documentElement.classList.add('filtros-livianos');
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
  // §91: hasta 12 humanos (como Mario Kart en línea): mandos 0-3 con puerto, del 4 al 11 "virtuales" (mandos_virtuales_nativo.cpp)
  const humanos = parametros.get('sincro').split(',').filter(Boolean).slice(0, 12).map((uid, mando) => {
    const [pj, veh] = (pjs[mando] || '').split('.').map(x => x === '' || x === undefined ? NaN : Number(x));
    return { uid, mando, personaje: pj, vehiculo: veh };
  });
  const miPuesto = humanos.findIndex(h => h.uid === yo);
  if (miPuesto < 0) return null;
  // §110: &base=N = cuántos de `sincro` estaban al empezar la copa (los demás llegaron con ella andando: corren desde la
  // carrera que diga la anfitriona, sala-carrera.mjs correnEn). Sin él (un sitio de antes), todos son de la base
  const base = Math.max(1, Math.min(humanos.length, Number(parametros.get('base')) || humanos.length));
  window.mkwPlantel = armarPlantel({ humanos: humanos.slice(0, base), semilla: Number(parametros.get('semilla')) >>> 0 });
  // ?autoconducir=1 (solo para el banco): los karts de los humanos también los maneja la CPU (sin mando), así cada
  // carrera termina sola y se puede probar la copa entera; los botones igual viajan por la malla
  if (parametros.get('autoconducir') === '1') window.mkwPlantel.forEach(x => { x[3] = -1; });
  window.mkwMiPuesto = miPuesto;                    // la cámara y el HUD siguen a mi kart (semillas_nativo.cpp)
  window.mkwRelojFijo = true;                       // el azar de la carrera, igual en todas (ppc_helpers.cpp)
  // corren = los humanos de la carrera de ahora, en el orden de sus puestos (§110: cambia al empezar cada carrera; hasta
  // la primera, los de la base). Lo que va por puesto (nombres en el juego, tablas, VR) se lee de aquí, no de `humanos`
  return { yo, humanos, base, corren: humanos.slice(0, base), miPuesto, local: [0, 0, 0, 0, 0, 0, 0], lockstep: null };
})() : null;
window.mkwSincro = sincro;
// §110: un piloto que llegó con la copa andando, a la lista de la carrera sincronizada (entre carreras), con su mando:
// su lugar en la lista de la sala (la base y después los sumados, en el orden de la anfitriona: igual en todas)
function sumarHumano(uid) {
  if (!sincro || typeof uid !== 'string' || sincro.humanos.some(h => h.uid === uid) || sincro.humanos.length >= 12) return;
  const h = { uid, mando: sincro.humanos.length };
  sincro.lockstep?.agregar(h);
  if (!sincro.humanos.includes(h)) sincro.humanos.push(h);    // Oracle usa una lista aparte para el mando sin kart
}
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
      : b[0] === MARCA_RED_ESTADO ? window.mkwRedEstadoSala?.alBinario(de, b)
      : b[0] === MARCA_SALA ? window.mkwSala?.alBinario(de, b) : router.alBinario(de, b, canal);
    // §103: «🛰 Todo por Cloudflare» (lo prende el anfitrión en el vestíbulo; apagado por omisión, como el relevo de BT3):
    // todas las conexiones por el repetidor TURN que entrega el Worker. Hasta tener sus credenciales no conecta a nadie;
    // sin ellas (el Worker sin TURN) o si no llegan en 8 s, directo como siempre (cómo quedó: window.mkwRed.malla.modo())
    const todoRelevo = parametros.get('conexion') === 'cloudflare';
    const alRelevo = e => {
      anotar(e === 'relevo' ? '[malla] 🛰 todo por el repetidor de Cloudflare' : `[malla] el repetidor de Cloudflare no ${e === 'tarde' ? 'contestó a tiempo' : 'está disponible (el Worker no dio credenciales)'}: conexión directa`);
    };
    // (§99: en la sala, cola corta para la carrera: un paquete viejo no sirve)
    malla = crearMalla({ uid, senal, alBinario, alCambiar: router.alCambiar, trozos: parametros.get('trozos') !== '0',   // (§135: ?trozos=0 = enteros)
      colaUdp: ['sala', 'directa'].includes(parametros.get('modo')) ? 8192 : undefined,
      soloRelevo: todoRelevo, alRelevo });
    router.usar(malla);
    if (todoRelevo) {
      // las credenciales: se le piden al sitio (que las saca del /turn del Worker de amigos con el token de quien juega) y
      // se escucha la respuesta desde ya (la sala del juego, que oye los demás mensajes del sitio, se arma más tarde)
      addEventListener('message', ev => {
        const d = ev.data;
        if (ev.source !== window.parent || ev.origin !== location.origin || d?.canal !== 'mkw-padre' || d.tipo !== 'turn' || !Array.isArray(d.iceServers)) return;
        malla.ponerIce(d.iceServers);
      });
      if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'turn' }, location.origin);
    }
    malla.entrar().then(ok => anotar(`[malla] ${ok ? 'entré a la sala como ' + uid : 'no pude entrar a la sala'}`));
    // §100: al cerrar la página (o salir del juego al vestíbulo) se avisa ya: sale del buzón y cierra sus conexiones, y
    // los demás no esperan a notarlo solos
    addEventListener('pagehide', () => malla.salir());
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
// §100: ¿se fue esa página? (cerró la pestaña o perdió internet: ya no está en el buzón de la sala y su WebRTC no está
// sano). La sala no la espera para mandar y la carrera la corta sin el margen de quien puede volver
const consolaSeFue = u => { const m = red?.malla; return !!m?.activa() && !m.sano(u) && !m.presentes().includes(u); };
// §100, solo pruebas (prueba-desconexion.mjs): cortar la red de esta pestaña ('todo' = como si se fuera internet;
// 'rtc' = solo la conexión directa con los demás, sigue en el buzón)
window.mkwCortarRed = (modo = 'todo', uid = null) => { red?.malla?.cortar(modo, uid); return !!red?.malla; };
// De dónde salen las piezas privadas (el juego compilado, el manifiesto y los archivos del disco). Vacío = este mismo
// servidor (servidor.mjs). En el sitio vendrán del Worker de amigos, otro origen (como el disco de BT3):
// ?privado=http://127.0.0.1:8151 lo imita con herramientas/sitio-local.mjs (bitácora §54). La página en sí usa
// direcciones relativas, para vivir en /juegos/mkw/ del sitio igual que aquí en /.
const ORIGEN = (parametros.get('privado') || '').replace(/\/+$/, '');
// El Worker de amigos solo responde con el token de Firebase de quien juega: privado.mjs se lo pide a la página de Juegos
// (el marco padre, como el de BT3) y se lo pone a cada pedido que va a ORIGEN (bitácora §65). Sin ORIGEN, nada cambia.
const privado = ORIGEN ? crearPrivado({ origen: ORIGEN }).instalar() : null;

// §236: abrir el enlace durante la carga para que la sala lo pueda elegir al largar.
const quiereOracle = !!sincro && !!red?.malla && parametros.get('conexion') === 'oracle' &&
  parametros.get('arbitro') !== '0' && ['sala', 'directa'].includes(parametros.get('modo'));
let enlaceOracle = null, paginaCerrada = false, carreraOracle = 0;
if (quiereOracle) {
  addEventListener('pagehide', () => { paginaCerrada = true; enlaceOracle?.cerrar(); }, { once: true });
  configArbitro({ parametros, origen: ORIGEN }).then(cfg => {
    if (!cfg || paginaCerrada) return;
    enlaceOracle = crearConexionArbitro({ ...cfg, sala: JSON.stringify([parametros.get('sala'), parametros.get('r')]),
      uid: sincro.yo, humanos: () => sincro.humanos,
      alBinario: b => sincro.lockstep?.alBinario(UID_SERVIDOR, b),
      registro: t => red.registro.push(t) });
  });
}

function prepararArbitro(n, fuera, autoridad, oracle) {
  if (quiereOracle) {
    carreraOracle = oracle ? n : 0;
    window.mkwEstado.conexionCarrera = oracle ? 'oracle' : 'host';
    ui.chip('arbitro', oracle ? 'Árbitro: servidor Oracle' : 'Oracle no está disponible para la sala. Arbitra un host.', !oracle);
    if (oracle) enlaceOracle?.carrera(n, fuera);
    else fuera = [...fuera, SERVIDOR];
  }
  sincro.lockstep?.fijarCarrera(n, fuera, oracle ? SERVIDOR : autoridad);
}

function saltarArbitro(m, n) {
  sincro.lockstep?.saltar(m, n);
  if (window.mkwEstado.conexionCarrera === 'oracle') enlaceOracle?.saltar(m, n);
}
window.mkwPrivado = privado;
// §106: la barra de descarga (descargas.mjs): encima del fetch con token, cuenta lo que llega de lo privado (sin ORIGEN,
// todo lo que se pide con fetch es del juego: servidor.mjs). ?barraDescarga=0 = sin contar ni mostrar nada.
const descargas = parametros.get('barraDescarga') === '0' ? null : crearDescargas({ base: ORIGEN ? ORIGEN + '/' : '' });
if (descargas) window.fetch = descargas.envolver(window.fetch.bind(window));
window.mkwDescargas = descargas;
const TRAZA_DISCO = parametros.has('trazaDisco');   // anotar cada lectura del disco que hace el juego (bitácora §52)
const CUADROS_PRUEBA = Number(parametros.get('cuadros') || 0);   // 0 = jugar sin fin
const { ok, nota, fin } = prueba('juego', 'Juego en el navegador (fase 3)');
const $ = id => document.getElementById(id);

// Un registro (log) en pantalla y en la consola; Playwright lee la consola.
const logCaja = $('log');
const lineasLog = [];          // las últimas 400 líneas (lo que se ve en pantalla)
const todoElLog = [];           // todas, para las verificaciones
let pintarPendiente = false;
// §125 (P7): el registro tiene tope (TOPE_LOG líneas: al pasarlo se sacan las 2.000 más viejas de una vez, no una por
// línea) y el cuadro de texto se pinta solo mientras se ve (un IntersectionObserver avisa; al aparecer se pinta lo que
// haya). Antes se reescribía y se medía (scrollHeight) en cada cuadro con líneas nuevas aunque el cajón estuviera
// cerrado. ?logLiviano=0 = como antes (sin tope y pintando siempre).
const LOG_LIVIANO = parametros.get('logLiviano') !== '0';
// §129 (P8): la cortina y los récords no miran la memoria del juego cuando no hace falta (?relojesLivianos=0 = como antes)
const RELOJES_LIVIANOS = parametros.get('relojesLivianos') !== '0';
// §133 (U1): al elegir en el menú de inicio, esperar los pipelines de los menús. Solo en el teléfono (allí el precalentado
// tardó 41 s y se metía en la 1.ª carrera); en el PC costaba 4–6 s y a los 20 s ya estaban casi todos igual (medido).
// ?esperaGraficos=1 = también en el PC, =0 = nunca
const ESPERA_GRAFICOS = parametros.has('esperaGraficos') ? parametros.get('esperaGraficos') === '1'
  : matchMedia('(any-pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
// §276: en el teléfono, la espera de §133 pide el primer CUARTO de la lista (el título y los menús, ~175 de ~700), no la
// mitad: medido en el Oppo, el menú «Un jugador» a los 8 s en vez de 12 (con el tope 8), y los mismos dibujos saltados
// (0 en la pantalla de elegir personaje, entrando 1,5 s después). Lo demás sigue llegando de fondo mientras se elige.
// ?parteMenus=F = otra parte (0,5 = la mitad, como antes); la sala no cambia (su meta sigue en preparacion.mjs)
const PARTE_MENUS = Number(parametros.get('parteMenus')) > 0 ? Number(parametros.get('parteMenus')) : ESPERA_GRAFICOS ? 0.25 : null;
const TOPE_LOG = 20000;
let logVisible = !LOG_LIVIANO;
const pintarLog = () => { logCaja.textContent = lineasLog.join('\n'); logCaja.scrollTop = logCaja.scrollHeight; };
if (LOG_LIVIANO) {
  try { new IntersectionObserver(e => { logVisible = e.some(x => x.isIntersecting); if (logVisible) pintarLog(); }).observe(logCaja); }
  catch { logVisible = true; }
}
// §99: la preparación de la sala (preparacion.mjs): cuánto falta para que el navegador esté listo para jugar sin
// trabarse (el programa, los pipelines que compila, la primera pantalla y un segundo de calma). En la sala, la cortina
// muestra ese porcentaje y la lista de copas del anfitrión recién se abre al 100 %. Las tareas largas del navegador
// (≥ 50 ms: lo que traba la página) las cuenta un PerformanceObserver.
const preparacion = crearPreparacion();
window.mkwPreparacion = preparacion;
const preparada = () => parametros.get('preparacion') === '0' || preparacion.lista();   // (?preparacion=0: sin esperar)
try { new PerformanceObserver(l => { for (const t of l.getEntries()) preparacion.larga(t.startTime + t.duration); }).observe({ type: 'longtask', buffered: true }); } catch {}
const escribe = texto => {
  preparacion.linea(texto);                // (§99: las líneas «[pipelines]» de aurora: cuántos llegaron)
  console.log(texto);
  todoElLog.push(texto);
  if (LOG_LIVIANO && todoElLog.length > TOPE_LOG) { todoElLog.splice(0, 2000); window.mkwEstado.logRecortado = (window.mkwEstado.logRecortado || 0) + 2000; }
  lineasLog.push(texto);
  if (lineasLog.length > 400) lineasLog.shift();
  // Redibujar el cuadro de texto cuesta: se hace como mucho una vez por cuadro de pantalla, no por línea
  // (§125: y solo si se ve)
  if (!pintarPendiente && logVisible) {
    pintarPendiente = true;
    requestAnimationFrame(() => {
      pintarPendiente = false;
      pintarLog();
    });
  }
};
window.mkwEstado = { log: todoElLog, cuadros: 0, fps: 0, trabajo: 0, lecturas: 0, bytes: 0 };   // para las pruebas
// §276: la línea de tiempo del arranque (arranque.mjs): cuándo terminó cada tramo hasta poder jugar; el vigía mira cada
// 50 ms lo que no avisa solo (el primer cuadro, la primera pantalla, la cortina, los pipelines). ?arranqueMarcas=0 = sin vigía
const arranque = crearArranque({ nota: t => nota(t), vigia: parametros.get('arranqueMarcas') !== '0', leer: () => {
  const e = window.mkwEstado, L = window.mkwMenus, m = L?.estado?.() || {};
  let etapa = -1;
  try { const ri = L?.u32(0x809BD730); if (ri) etapa = L.u32(ri + 0x28); } catch {}
  const pe = preparacion.estado, g = graficosListos(pe, PARTE_MENUS);
  return { cuadros: window.mkwCuadros ? window.mkwCuadros() : 0, seccion: m.seccion ?? -1, pagina: m.pagina ?? -1, etapa,
    lecturas: e.lecturas || 0, esperaDisco: Math.round(msEsperaDisco), mb: Math.round((e.bytes || 0) / 104857.6) / 10,
    inicioVisto: e.inicioVisto ?? null, cortinaFuera: e.cortinaFuera ?? null, graficosListos: !!g.listo,
    pipesTotal: pe.pipesTotal, pipesLlegados: pe.pipesLlegados, elegido: e.inicio?.cuando ?? null,
    esperaGraficosFin: e.esperaGraficos?.ms != null ? e.esperaGraficos.desde + e.esperaGraficos.ms : null };
} });
arranque.marcar('modulo');
window.mkwArranque = arranque;

// §269: la caja negra (caidas.mjs): un latido cada 5 s en localStorage y la causa si el juego se cae (la tarjeta de video
// perdida, un error del motor); al recargar se muestra lo de la vez anterior. Va antes que nada que pida la tarjeta.
const caidas = parametros.get('caidas') === '0' ? null : crearCaidas({ medir: () => ({
  enCarrera: !!window.mkwEstado.enCarrera, cuadro: window.mkwEstado.cuadros || 0,
  heapMB: window.mkwHeapMB ? Math.round(window.mkwHeapMB()) : null,
  jsMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }) });
window.mkwCaidas = caidas;

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
// §161: ?sinTope=1 = banco sin el tope de 60 (pedido del dueño: con tope, «59 fps» no dice cuánto sobra). Solo para
// medir, apagado por omisión y nunca en la sala ni en línea: la cuadrícula del juego se suelta del monitor (como
// ?enganche=0) y, durante la carrera, se le pide «ponerse al día» sin fin (mkw_prisa de vi.cpp, §99): el juego corre
// sus cuadros seguidos sin esperar el reloj de 60 Hz, como un motor en un dinamómetro sin carga. La carrera va más
// rápida que el tiempo real. Los cuadros de lógica por segundo (Raceinfo, §124) dicen el techo de la CPU; las imágenes
// por segundo del medidor, cuántas llegó a entregar el dibujo.
const SIN_TOPE = sinTopeActivo(parametros);   // (sin-tope.mjs: solo con sinTope=1, nunca en la sala ni en línea)
const ENGANCHE = parametros.get('enganche') !== '0' && !parametros.has('red') && !SIN_TOPE;
// La pausa de presentar de aurora y la toma a compás (§54) no tocan el reloj VI (solo esperan a que el navegador tome
// el canvas, con tope en el vencimiento del cuadro): van también en línea. Sin ellas, con ?red el juego casi no
// soltaba el hilo y la página pasaba 120-700 ms sin actualizar la pantalla ni atender la red (bitácora §63).
const PRESENTA = parametros.get('enganche') !== '0' && !SIN_TOPE;   // (§161: sin tope, aurora no espera la toma)
// Ajuste fino del ritmo del sonido (parche en audio_backend.cpp): ?ajusteSonido=0 lo apaga para comparar
const AJUSTE_SONIDO = parametros.get('ajusteSonido') !== '0';
// §88: el sonido sale por un AudioWorklet de la página (sonido-worklet.js, cola de ~25 ms en el hilo de audio).
// ?audio=viejo = el ScriptProcessorNode de SDL3 (bloques de 43 ms + cola de 60 ms). ?audioMs=N = la cola de reposo.
const AUDIO_WORKLET = parametros.get('audio') !== 'viejo';
const AUDIO_MS = Number(parametros.get('audioMs')) || 25;
const AUDIO_ARRANQUE = parametros.has('audioArranque') ? Number(parametros.get('audioArranque')) : 80;   // la cola al arrancar

// ---- Tarjeta de video ----
// La página no la elige (en Windows, Chrome usa la que Windows le asignó y no hace caso al pedido de la página):
// se pide "alto rendimiento" (por si algún navegador sí hace caso) y se muestra cuál dio. ?gpu=bajo|auto en la
// dirección cambia el pedido (solo para pruebas). Se le pasa a aurora (Module.mkwGpuPreferencia, ver gpu.cpp).
const GPU = parametros.get('gpu') || 'alto';
const PREFERENCIA = { alto: 'high-performance', bajo: 'low-power' }[GPU];  // auto → sin preferencia

// Al abrir la página: qué tarjeta da el navegador, y si hace caso al pedido. Se le pide una de cada tipo: si da la
// MISMA para "alto rendimiento" y "bajo consumo", el pedido no cuenta, y se ofrece (plegada) la ayuda para
// cambiarla desde Windows.
// §156 (E5): al cargar se pide UNA sola tarjeta (la del juego). Las otras dos preguntas («alto rendimiento» y «bajo
// consumo») despiertan la tarjeta dedicada de un portátil (y su ventilador) y la carga las esperaba: ahora van 20 s
// después, en segundo plano, y solo si sirven (si ya dio una NVIDIA, que siempre es dedicada, o una por software, la
// ayuda de Windows no cambia nada). `ignora` se completa entonces en el mismo objeto (lo lee aviso-gpu.mjs al
// necesitarlo). ?unaTarjeta=0 = las tres juntas al cargar, como antes.
const UNA_TARJETA = parametros.get('unaTarjeta') !== '0';
const revisionGpu = (async () => {
  if (!navigator.gpu) return { adaptador: null, nombreGpu: 'sin WebGPU', ignora: false };
  const nombreDe = a => {
    const i = (a && a.info) || {};
    return (`${i.vendor || '?'} ${i.architecture || ''} ${i.description || ''}`.trim() + (i.isFallbackAdapter ? ' (POR SOFTWARE)' : ''));
  };
  const pedir = o => navigator.gpu.requestAdapter(o).catch(() => null);
  const sondear = async r => {
    const [rapida, ahorro] = await Promise.all([pedir({ powerPreference: 'high-performance' }), pedir({ powerPreference: 'low-power' })]);
    r.ignora = nombreDe(rapida) === nombreDe(ahorro);
    r.sondeado = true;
    document.getElementById('gpuAyuda').hidden = !r.ignora;
    window.mkwEstado.gpu = { pedida: GPU, dada: r.nombreGpu, ignora: r.ignora, sondeado: true, adreno: r.adreno };
  };
  const adaptador = await pedir(PREFERENCIA ? { powerPreference: PREFERENCIA } : {});
  const nombreGpu = nombreDe(adaptador);
  // §205 (W9): ¿es una Adreno 6xx/7xx, donde KartPad vio personajes invisibles? (el registro y el informe lo anotan)
  const adreno = riesgoAdreno(adaptador?.info);
  const r = { adaptador, nombreGpu, ignora: false, sondeado: false, adreno };
  document.getElementById('gpuEnUso').textContent = '🎮 tarjeta de video: ' + nombreGpu;
  window.mkwEstado.gpu = { pedida: GPU, dada: nombreGpu, ignora: false, sondeado: false, adreno };
  if (!UNA_TARJETA) { await sondear(r); return r; }
  // (sondear no sirve con una NVIDIA o una por software: aviso-gpu.mjs no ofrece cambiarla)
  if (adaptador && !/^nvidia/i.test(nombreGpu) && !/POR SOFTWARE/.test(nombreGpu)) setTimeout(() => sondear(r), 20000);
  return r;
})();
// Tiempo de GPU (?gpu=1, diagnóstico; bitácora §54): cuánto tarda la tarjeta en terminar lo que aurora le manda en cada
// cuadro. Envuelve GPUQueue.submit: al último envío de cada cuadro le pregunta "avisame cuando termines"
// (onSubmittedWorkDone) y mide la demora. Si la tarjeta estaba libre, eso es su tiempo de trabajo; si se acerca a un
// refresco del monitor, el compositor a veces no alcanza a mostrar la imagen a tiempo (ritmo 3-5-3-5).
const gpuMedida = { muestras: [] };
// (§114: también con «Mostrar qué frena» prendido: el medidor dice cuánto tarda la tarjeta por cuadro. Medir cuesta un
// aviso de la tarjeta por cuadro: por eso solo si se pidió)
const MEDIR_GPU = parametros.get('gpu') === '1' || leerGraficos().verDetalle;
if (MEDIR_GPU && globalThis.GPUQueue) {
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
        else gpuMedida.muestras.splice(0, 100000);   // (§114: medido en una sesión larga, sin crecer sin fin)
        pendiente = null;
      });
    });
    return r;
  };
  window.mkwGpu = () => gpuMedida.muestras;
}
// §114b: los «pipelines» que crea aurora (la receta con que la tarjeta dibuja cada material nuevo) y los shaders: cuántos
// y cuánto bloquean al pedirlos. Siempre (solo cuesta cuando se crea uno). En un teléfono compilar uno puede costar
// decenas de ms: si el tramo lento de la primera carrera coincide con muchos, el culpable es ese (el informe lo dice)
const pipelinesMedida = { n: 0, ms: 0, nAsync: 0, shaders: 0, msShaders: 0 };
if (globalThis.GPUDevice) {
  const envolver = (nombre, contar) => {
    const original = GPUDevice.prototype[nombre];
    if (typeof original !== 'function') return;
    GPUDevice.prototype[nombre] = function (...a) { const t0 = performance.now(); try { return original.apply(this, a); } finally { contar(performance.now() - t0); } };
  };
  envolver('createRenderPipeline', ms => { pipelinesMedida.n++; pipelinesMedida.ms += ms; });
  envolver('createComputePipeline', ms => { pipelinesMedida.n++; pipelinesMedida.ms += ms; });
  envolver('createRenderPipelineAsync', () => { pipelinesMedida.nAsync++; });
  envolver('createShaderModule', ms => { pipelinesMedida.shaders++; pipelinesMedida.msShaders += ms; });
}
window.mkwPipelines = () => ({ ...pipelinesMedida });
// §115: el perfil de la tarjeta (perfil-gpu.mjs): el conteo por cuadro (pasadas, dibujos, bytes subidos) con «Mostrar qué
// frena»; y, a pedido («🔬 Perfilar la tarjeta de video», `mkw.perfilGpu`), los ms de CADA pasada medidos por la misma
// tarjeta durante 20 s de carrera. Se instala antes de que el juego cree su dispositivo de WebGPU
// §155 (H1): el aparato de mentira (lastre.mjs): ?lastre=K (el hilo del juego K veces más lento), ?lastreAyuda=K (el
// hilo del sonido), ?ladron=MB (un Worker que ensucia la caché grande), ?lastreGpu=K (cada pasada K veces). El de la
// tarjeta va ANTES del perfil (perfil-gpu.mjs pone y saca sus envolturas con las ventanas: así no tapa las nuestras)
const LASTRE = lastreDeParametros(parametros);
// (§161: sin tope el lastre queda corto: gira en las esperas, y sin tope el juego casi no espera; ver la bitácora)
// §162: con ?sinTope=1 (o ?lastreCuadro=K) el lastre de CPU va dentro del runtime, cuadro por cuadro (sin-tope.mjs
// repartoLastre); el de la página queda en K = 1 y solo mide la CPU pura
const LASTRE_REPARTO = repartoLastre(parametros, SIN_TOPE, LASTRE.cpu);
// §173: con «Mostrar qué frena» (verDetalle) también se mide la CPU pura (K = 1, solo mide: el informe trae cpuPuraMs y
// separa el juego de la tarjeta sin pedirle nada al dueño). ?cpuPura=0 = solo con ?lastre=1, como antes
const CPU_PURA_DETALLE = parametros.get('cpuPura') !== '0' && leerGraficos().verDetalle;
const lastreCpu = LASTRE.cpu > 1 || LASTRE.medir || CPU_PURA_DETALLE || LASTRE_REPARTO.cuadro > 1 ? crearLastreCpu({ k: LASTRE_REPARTO.pagina }) : null;
const lastreGpu = LASTRE.gpu > 1 && globalThis.GPUCommandEncoder ? instalarLastreGpu({ k: LASTRE.gpu }) : null;
const ladron = LASTRE.ladron > 0 ? crearLadron({ mb: LASTRE.ladron }) : null;
const conLastre = f => lastreCpu ? lastreCpu.envolver(f) : f;
// §163: el tramo fijo (?tramo=600-2400, sin-tope.mjs crearTramo) y lo que aurora espera a sus búferes de subida (con el
// tramo se le ofrece la espera a aurora también sin lastre, para medirla: es el mismo setTimeout(0) de su emscripten_sleep(0))
const TRAMO = tramoDeParametros(parametros);
const esperaSubidaMedida = { ms: 0, n: 0 };
const medirSubida = f => () => { const t0 = performance.now(); esperaSubidaMedida.n++;
  return Promise.resolve(f()).then(v => { esperaSubidaMedida.ms += performance.now() - t0; return v; }); };
window.mkwLastre = () => ({ cpu: lastreCpu?.estado ?? null,
  cuadro: LASTRE_REPARTO.cuadro > 1 && window.mkw?._mkw_lastre_cuadro_estado ? (e => ({ k: e(4), ms: Math.round(e(0)),
    trabajoMs: Math.round(e(1)), veces: e(2), topes: e(3) }))(window.mkw._mkw_lastre_cuadro_estado) : null, gpu: lastreGpu?.estado ?? null, ladron: ladron?.estado() ?? null,
  ayuda: LASTRE.ayuda > 1 ? { k: window.mkwSonido?.estado?.lastreK ?? null, ms: Math.round(window.mkwSonido?.estado?.lastreMs ?? 0),
    trabajoMs: Math.round(window.mkwSonido?.estado?.lastreTrabajoMs ?? 0) } : null });
const CONTAR_LOGICA = parametros.get('logica') !== '0';   // §124 (V5): los cuadros de lógica de la carrera
// (§155: también ?perfilGpu=1 en la dirección, para medir-sitio, que abre un perfil de Chrome nuevo)
const PERFIL_TIEMPOS = parametros.get('perfilGpu') === '1' || (() => { try { return localStorage.getItem('mkw.perfilGpu') === '1'; } catch { return false; } })();
// §123 (G8): sin «Perfilar», el conteo va por ventanas: 2 s de cada 10, y entre ventanas WebGPU queda sin nada encima
// (contar costaba 0,2–1 ms por cuadro). ?ventanaGpu=0 = contar siempre, como antes
const VENTANA_GPU = parametros.get('ventanaGpu') === '0' ? null : { cadaMs: 10000, durMs: 2000 };
const perfilGpu = (MEDIR_GPU || PERFIL_TIEMPOS) && globalThis.GPUCommandEncoder
  ? instalarPerfilGpu({ tiempos: PERFIL_TIEMPOS, ventana: PERFIL_TIEMPOS ? null : VENTANA_GPU, cuadros: () => window.mkw?._mkw_web_cuadros?.() ?? 0 }) : null;
window.mkwPerfilGpu = perfilGpu;
// §114: la mediana de la tarjeta de video en los últimos `ms` (null si no se mide)
const gpuReciente = (ms = 2000) => {
  const desde = performance.now() - ms, v = [];
  for (let i = gpuMedida.muestras.length - 1; i >= 0 && gpuMedida.muestras[i][0] >= desde; i--) v.push(gpuMedida.muestras[i][1]);
  if (!v.length) return null;
  v.sort((a, b) => a - b);
  return v[v.length >> 1];
};
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
const TOMA_TIC = parametros.get('tomaTic') !== '0';
const MARGEN_TOMA = parametros.has('margenToma') ? Math.max(0, Number(parametros.get('margenToma')) || 0) : 0.5;   // (§256, en refrescos)   // (§256: el refresco de la toma lo anota el reloj del monitor)
const FASE_CEDER = 0.75;
const enTareaNueva = (() => {
  const canal = new MessageChannel(), cola = [];
  canal.port1.onmessage = () => cola.shift()();
  return f => { cola.push(f); canal.port2.postMessage(0); };
})();
// §143 (P4): un solo planificador por refresco. Las diferencias entre refrescos van en un anillo fijo (Float64Array) y el
// período se recalcula cada 30 refrescos (antes: copiar y ordenar las 240 en cada refresco, 240 veces por segundo con
// un monitor de 240 Hz); la función de rAF se ata una sola vez; los demás que necesitan cada refresco (el ritmo en
// pantalla, los mandos) se anotan en relojMonitor.alRefresco en vez de tener su propio rAF. ?planificador=0 = como antes
const PLANIFICADOR = parametros.get('planificador') !== '0';
let arranqueSuelto = false;   // §276 (ver «el arranque de prisa»)
const relojMonitor = {
  t: 0, p: 0, n: 0, deltas: [], esperas: [], tomas: [],
  anillo: new Float64Array(240), orden: new Float64Array(240), nd: 0, ia: 0, alRefresco: [], paginaMs: 0,
  entregado: 0, retrace: 0, desfases: [], fase: null, tomaAnterior: 0, huecosToma: {}, fotos: [],
  // (§276: mientras el juego corre su arranque invisible, la cuadrícula va suelta del monitor para poder apurarlo)
  valido() { return !arranqueSuelto && (PLANIFICADOR ? this.nd : this.deltas.length) >= 30 && performance.now() - this.t < 100; },  // pestaña oculta → no
  // el período a partir de las diferencias guardadas (ver tic): p0 = percentil 20; cada salto vale round(salto/p0)
  periodoAnillo() {
    const n = this.nd, orden = this.orden.subarray(0, n);
    orden.set(this.anillo.subarray(0, n)); orden.sort();
    const p0 = orden[Math.floor(n * 0.2)];
    let suma = 0, refrescos = 0;
    for (let i = 0; i < n; i++) { const d = this.anillo[i], k = Math.round(d / p0); if (k >= 1 && k <= 8) { suma += d; refrescos += k; } }
    this.p = refrescos ? suma / refrescos : p0;
  },
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
    // §256 (G16): si aurora pidió la textura del lienzo desde el refresco anterior (getCurrentTexture, `adquirida`),
    // este refresco es el de la toma: el compás cuenta desde aquí aunque la pausa de presentar de aurora ya se haya
    // cansado de esperarlo (esperaToma vence a los `ms`; antes solo ella lo anotaba). Se mira la textura y no la entrega
    // del juego: con la imagen intermedia (N8 modo 2) aurora pide la textura varios ms después de la entrega, y contar
    // desde la entrega adelantaba un refresco el compás de la imagen guardada (3 y 5 refrescos). ?tomaTic=0 = sin esto
    if (TOMA_TIC && this.adquirida) { this.ultimaToma = hora; this.adquirida = false; }
    if (this.t && PLANIFICADOR) {
      this.anillo[this.ia] = hora - this.t; this.ia = (this.ia + 1) % 240; if (this.nd < 240) this.nd++;
      if (this.nd < 60 || this.n % 30 === 0) this.periodoAnillo();   // (al principio en cada refresco; después cada 30)
    } else if (this.t) {
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
    if (!PLANIFICADOR) {
      this.esperas = this.esperas.filter(e => (hora >= e.desde ? (e.listo(1), false) : true));
      for (const f of this.tomas.splice(0)) f(hora);        // la pausa de presentar de aurora: el canvas ya se tomó
      requestAnimationFrame(h => this.tic(h));
      return;
    }
    if (this.esperas.length) this.esperas = this.esperas.filter(e => (hora >= e.desde ? (e.listo(1), false) : true));
    if (this.tomas.length) for (const f of this.tomas.splice(0)) f(hora);
    const t0 = performance.now();
    for (let i = 0; i < this.alRefresco.length; i++) { try { this.alRefresco[i](hora); } catch (e) { console.warn('[refresco]', e); } }
    this.paginaMs = this.paginaMs * 0.98 + (performance.now() - t0) * 0.02;   // (§149: la parte de la página, promedio que se mueve)
    requestAnimationFrame(this.ticAtado || (this.ticAtado = h => this.tic(h)));
  },
  // El runtime avisa que va a entregar un cuadro a aurora; retraceMs = la "tele" (retrace) de ese cuadro.
  entrega(retraceMs) { this.entregado = performance.now(); this.retrace = retraceMs; this.entregas++; },
  entregas: 0,
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
  ultimaToma: 0, desdeToma: 0, esperandoAtrasada: false, adquirida: false, msCompas: 0, diagCompas: { conCompas: 0, sinCompas: 0, rearmes: 0, corridas: 0, tarde: {} },
  tomaAtrasada() {
    if (!this.valido() || !(this.p > 0)) return false;
    // §270: con el ritmo de los menús prendido (ritmo-menus.mjs), el compás es de N cuadros (30 o 20 parejos): cada
    // imagen se toma N × 16,7 ms después de la anterior, no 16,7
    const N = ritmoMenus?.n && menusAhora() ? ritmoMenus.n : 1, largo = 16.6833 * N;
    const p = this.p, n = Math.round(largo / p), ahora = performance.now();
    this.desdeToma = ahora - 1.5 * p;            // sin compás: solo un refresco que pasó hace más de medio refresco
    const d = this.diagCompas;
    if (COMPAS && n >= 2 && Math.abs(largo - n * p) < 0.1 * p && this.ultimaToma) {
      let objetivo = this.ultimaToma + n * p;
      // §256 (la zona del borde): una imagen que llega a menos de MARGEN_TOMA refrescos del refresco objetivo a veces
      // alcanza ese refresco y a veces no (el hilo sigue ocupado cuando el navegador arma la pantalla): 5 y 3 refrescos
      // alternados. Ahí se espera a propósito al refresco siguiente: la fase se corre una vez y las imágenes que siguen
      // llegan lejos del borde. ?margenToma=0 = como antes
      if (MARGEN_TOMA > 0 && ahora >= objetivo - MARGEN_TOMA * p && ahora < objetivo + 0.5 * p) { objetivo += p; d.corridas++; }
      if (ahora < objetivo + 0.5 * p) this.desdeToma = objetivo - 1.5 * p;
      // §256 (G16, para medir): cuánto antes (−) o después (+) del refresco objetivo entregó el juego, en ms redondeados
      d.conCompas++; if (ahora >= objetivo + 0.5 * p) d.rearmes++;
      const b = Math.round(ahora - objetivo); d.tarde[b] = (d.tarde[b] || 0) + 1;
    } else d.sinCompas++;
    return this.t < this.desdeToma;
  },
  // Espera el rAF con hora ≥ desdeToma (se cumple en una tarea nueva, como esperaHasta), o un tope de tiempo.
  esperaAtrasada() {
    const desde = this.desdeToma, t0 = performance.now();
    anota('a', desde - this.t);
    this.esperandoAtrasada = true;
    return new Promise(listo => {
      let hecho = false;
      const fin = v => {
        if (hecho) return; hecho = true;
        this.msCompas += performance.now() - t0;   // (§270: lo esperado al compás, para no contarlo como trabajo)
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
window.mkwRelojMonitor = relojMonitor;
// §256 (G16): las imágenes que de verdad salen a la pantalla (cada getCurrentTexture de aurora es una) y el tiempo de
// cada una, medido en el refresco del monitor en que se vio (imagenes-vista.mjs): fps a la vista, 1 % y 0,1 % bajo, la
// causa de cada pico y el gráfico del medidor. Las causas son contadores que solo crecen: el primero que creció en una
// imagen larga es el sospechoso. ?imagenesVista=0 = sin esto. El tiempo de cada imagen es de entrega a entrega (la hora
// en que aurora pidió la textura, como PresentMon/Afterburner); ?imagenesVista=refresco = medido en los refrescos del
// monitor (la primera versión: redondea a refrescos, ver imagenes-vista.mjs)
const IMAGENES_VISTA = parametros.get('imagenesVista') !== '0';
// §270 (el dueño: «fps de video y fps de lógica» por separado): el ritmo del JUEGO, aparte del de las imágenes. Entre
// dos cuadros el juego espera pidiéndole a la página turnos de 1 ms (mkwEsperaHasta con el monitor enganchado,
// mkwEsperaReloj sin él), así que en cada pedido se mira la cuenta de cuadros del juego: si avanzó, el cuadro terminó
// recién (con 1 ms de error). La cuenta: en la carrera, los cuadros de lógica del Raceinfo (+0x1C + +0x20, se dibujen o
// no: con N8 se dibuja la mitad); en los menús, los cuadros que el juego entregó (ahí cada cuadro se dibuja).
// ?ritmoJuego=0 = sin esto
const ritmoJuego = parametros.get('ritmoJuego') !== '0' ? crearRitmoJuego() : null;
function cuentaJuego() {
  const M = window.mkw, L = window.mkwMenus;
  try {
    const ri = L?.u32(0x809BD730), et = ri ? L.u32(ri + 0x28) : -1;
    if (ri && et >= 0 && et <= 2) return ['carrera' + ri, L.u32(ri + 0x1C) + L.u32(ri + 0x20)];
  } catch {}
  // (en los menús el runtime cuenta los cuadros presentados; con N8 en elegir personaje, el cuadro saltado es de lógica
  // y no se presenta: se suman los saltados, mkw_n8_estado(1))
  const saltados = M?._mkw_n8_estado ? Math.max(0, M._mkw_n8_estado(1)) : 0;
  return ['menus', (M?._mkw_web_cuadros?.() ?? NaN) + saltados];
}
// §270: el ritmo parejo en los menús (ritmo-menus.mjs): si el aparato no llega a 60 en un menú, cada cuadro empieza en
// un compás fijo de 2 (30 parejos) o 3 (20 parejos) tiempos de 16,7 ms. Nunca con la carrera andando; en la sala,
// tampoco en sus resultados (los demás pueden seguir corriendo con mis cuadros). APAGADO por omisión (medido en la gama baja: no mejora el 1 % bajo y se prendía en las trabas de la carga); ?menusRitmo=1 = probarlo. Elegir personaje va con N8 (n8MenusAlActivar)
const ritmoMenus = parametros.get('menusRitmo') === '1' ? crearRitmoMenus() : null;
function menusAhora() {
  try {
    const L = window.mkwMenus, ri = L?.u32(0x809BD730);
    if (!ri) return true;
    return L.u32(ri + 0x28) >= 3 && !sincro;
  } catch { return false; }
}
const conRitmoMenus = f => ritmoMenus ? (v, s) => ritmoMenus.n ? f(ritmoMenus.objetivo(v, performance.now(), menusAhora()), s) : f(v, s) : f;
// §283: el cuadro se anota al EMPEZAR (al salir de la espera que da su hora), no al terminar: ver envolverEsperaJuego en
// imagenes-vista.mjs. ?ritmoJuego=fin = al terminar, como §270
const esperaJuego = ritmoJuego ? envolverEsperaJuego(ritmoJuego, cuentaJuego, { modo: parametros.get('ritmoJuego') === 'fin' ? 'fin' : 'inicio' }) : null;
const conRitmoJuego = f => esperaJuego ? esperaJuego.envolver(f) : f;
window.mkwRitmoJuego = ritmoJuego;
// (cuando cada cuadro llega tarde el runtime no espera y no llama a las esperas: la cuenta se lee también en cada
// refresco del monitor; dos lecturas del mismo cuadro no anotan nada)
if (esperaJuego) relojMonitor.alRefresco.push(() => esperaJuego.refresco());
const vistaImagenes = IMAGENES_VISTA ? crearImagenesVista({ modo: parametros.get('imagenesVista') === 'refresco' ? 'refresco' : 'entrega', causas: [
  ['pipeline', () => window.mkw?._mkw_web_pipelines_cuantos?.() ?? 0],     // (un pipeline nuevo armado)
  ['disco', () => window.mkwDisco?.estado?.esperaRed ?? 0],                // (el juego esperó una lectura de la red)
  ['sala', () => { try { return sincro?.lockstep?.estado().esperasLargas ?? 0; } catch { return 0; } }],   // (esperó a otro)
] }) : null;
let esperadoImagen = 1000 / 60;   // (ms de una imagen pareja: 1/60 s, o 1/30 con «30 parejas» andando; se renueva cada segundo)
if (vistaImagenes) {
  vistaImagenes.esperado = esperadoImagen;
  // ?diagN8=1 (§256, para medir): cada imagen separada en «tras una entrega» (la intermedia de N8 o la de siempre) y «sin
  // entrega» (la de verdad guardada de N8, en el cuadro saltado): ms desde la anterior, desde el retrace del cuadro, y
  // en qué refresco (desde la toma anterior) se tomó
  const DIAG_N8 = parametros.get('diagN8') === '1';
  const diagN8 = window.__diagN8 = DIAG_N8 ? { tras: {}, sin: {}, compasTras: {}, compasSin: {} } : null;
  let entregasAntes = 0, horaAntes = 0;
  engancharImagenes(() => {
    relojMonitor.adquirida = true;
    const ahora = performance.now();
    vistaImagenes.contar(ahora);
    if (diagN8) {
      // (sin enganche el runtime no avisa la entrega: un cuadro dibujado se ve en el contador de N8, mkw_n8_estado(0))
      const dib = window.mkw?._mkw_n8_estado?.(0) ?? relojMonitor.entregas;
      const tras = dib !== entregasAntes, k = tras ? 'Tras' : 'Sin', suma = (o, b) => { o[b] = (o[b] || 0) + 1; };
      entregasAntes = dib;
      if (horaAntes) suma(diagN8[tras ? 'tras' : 'sin'], Math.round(ahora - horaAntes));
      if (relojMonitor.p) suma(diagN8['compas' + k], Math.round((ahora - relojMonitor.ultimaToma) / relojMonitor.p * 2) / 2);
      horaAntes = ahora;
    }
  });
  const alRefrescoVista = hora => vistaImagenes.refresco(hora, Math.max(esperadoImagen, relojMonitor.p || 0));
  if (PLANIFICADOR) relojMonitor.alRefresco.push(alRefrescoVista);
  else { const f = h => { alRefrescoVista(h); requestAnimationFrame(f); }; requestAnimationFrame(f); }
  document.addEventListener('visibilitychange', () => vistaImagenes.cortar());
  setInterval(() => {
    vistaImagenes.segundo();
    try { const n = window.mkwEstado?.n8?.(); esperadoImagen = n?.activo && n.modo === 1 ? 2000 / 60 : n?.activo && n.modo === 3 ? 3000 / 60 : 1000 / 60; } catch {}   // (§283: «20 parejas»)
    vistaImagenes.esperado = esperadoImagen;
  }, 1000);
  window.mkwImagenesVista = vistaImagenes;
  window.mkwEstado = Object.assign(window.mkwEstado || {}, {
    imagenes: { marca: () => vistaImagenes.marca(), resumen: (desde = null, ultimos = null) => vistaImagenes.resumen(desde, ultimos),
                causas: (desde = 0) => vistaImagenes.causas(desde), texto: (desde = null) => textoResumen(vistaImagenes.resumen(desde)),
                tiempos: (desde = null) => Array.from(vistaImagenes.tiempos({ desde })) } });
}      // (para medir-oculta: volver a prender su cadena de rAF tras la oculta simulada)

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
// §120 (C10): ese «ceder una vuelta y seguir» con la pestaña oculta contestaba al instante: el runtime volvía a llamar
// enseguida y el hilo giraba al 100 % todo el rato que la pestaña estaba escondida (cientos de miles de vueltas por
// segundo). Ahora, oculta, la espera duerme de verdad con un temporizador de un Worker (los de un Worker no los frena
// Chrome en una pestaña oculta, los de la página sí): hasta el vencimiento, de a OCULTA_MS como mucho (para que el
// juego siga atendiendo su sonido y sus alarmas). El juego sigue a su ritmo (la sala lo necesita: el lockstep no espera)
// pero el procesador descansa entre cuadro y cuadro. ?esperaOculta=0 = como antes; ?ocultaMs=N = de a N ms.
const ESPERA_OCULTA = parametros.get('esperaOculta') !== '0';
const OCULTA_MS = Math.max(1, Number(parametros.get('ocultaMs')) || 4);
const relojOculto = (() => {
  if (!ESPERA_OCULTA) return null;
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['onmessage = e => setTimeout(() => postMessage(e.data[0]), e.data[1]);'],
                                                       { type: 'text/javascript' })));
    const pendientes = new Map();
    let n = 0;
    w.onmessage = e => { const f = pendientes.get(e.data); pendientes.delete(e.data); if (f) f(); };
    return (ms, f) => { pendientes.set(++n, f); w.postMessage([n, ms]); };
  } catch { return null; }   // (sin Workers: como antes)
})();
// §134 (C10, la pausa): jugando solo (sin sala, sin carrera sincronizada, sin red), con la pestaña oculta el juego se
// PAUSA: la espera no termina hasta que la pestaña vuelve a verse (nadie mira y nadie espera a esta consola).
// ?pausaOculta=0 = sigue corriendo dormido como en §120
const PAUSA_OCULTA = parametros.get('pausaOculta') !== '0' && !parametros.has('sincro') && !parametros.has('red') &&
  !['sala', 'enlinea'].includes(parametros.get('modo'));
// §205 (W9, solo para medir): ?fotoCuadro=N = al llegar al cuadro de lógica N de la carrera (Raceinfo +0x20, desde la
// cuenta) el juego se queda quieto con esa imagen en pantalla (mkwEstado.fotoLista = true) hasta window.mkwFotoSigue():
// dos corridas con la misma semilla dan la misma imagen, y se comparan píxel a píxel (prueba-foto-igual.mjs)
const FOTO_CUADRO = cuadroFoto(parametros.get('fotoCuadro'));
function fotoQuieta() {
  if (!FOTO_CUADRO || window.mkwEstado.fotoHecha) return false;
  try {
    const L = window.mkwMenus, ri = L?.u32(0x809BD730), et = ri ? L.u32(ri + 0x28) : -1;
    return !!ri && et >= 1 && et <= 2 && L.u32(ri + 0x20) >= FOTO_CUADRO;
  } catch { return false; }
}
// (la foto quieta: la espera no vuelve hasta mkwFotoSigue(). Va en las dos esperas del cuadro: la suelta, esperaReloj, y
// la pegada al monitor, mkwEsperaHasta, que es la que corre con la cuadrícula enganchada, lo de siempre; §252: antes solo
// estaba en la suelta y con la enganchada la carrera seguía de largo)
const fotoEspera = () => new Promise(listo => {
  window.mkwEstado.fotoLista = true;
  window.mkwFotoSigue = () => { window.mkwEstado.fotoHecha = true; window.mkwEstado.fotoLista = false; listo(1); };
});
// §256 (G16, para medir): cuánto después del vencimiento despertó el juego (ms redondeados → veces)
const despertares = { tarde: {} };
// §256 (G16): el último tramo de la espera sin enganche (la sala, en línea, un monitor que no divide los 60 Hz): el
// temporizador de Chrome despertaba 0–7 ms tarde (medido: 1–2 ms a 240 Hz, hasta 7 a 178 Hz), y cada imagen salía con
// ese atraso: 3 y 5 refrescos en vez de 4. Ahora el temporizador despierta DESPERTAR_ANTES ms antes y el resto se espera
// cediendo el turno: despierta en el vencimiento (0 ms) y nunca antes (la lógica no cambia). ?despertarAntes=0 = antes,
// ?despertarAntes=M = M ms
const DESPERTAR_ANTES = parametros.has('despertarAntes') ? Math.max(0, Number(parametros.get('despertarAntes')) || 0) : 3;
const despertarTarde = v => { const b = Math.round(performance.now() - v); despertares.tarde[b] = (despertares.tarde[b] || 0) + 1; };
window.mkwDespertares = despertares;
function esperaReloj(vencimiento, servicioMs) {
  window.mkwEstado.despiertes = (window.mkwEstado.despiertes || 0) + 1;   // (cuántas veces se esperó: medir-oculta.mjs)
  if (fotoQuieta()) return fotoEspera();
  return new Promise(listo => {
    const falta = vencimiento - performance.now();
    if (document.hidden && PAUSA_OCULTA) {
      const p = window.mkwEstado.pausaOculta = window.mkwEstado.pausaOculta || { veces: 0, ms: 0 };
      p.veces++; const t0 = performance.now();
      const vuelve = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', vuelve);
        p.ms += Math.round(performance.now() - t0);
        enTareaNueva(() => listo(1));
      };
      document.addEventListener('visibilitychange', vuelve);
      return;
    }
    if (document.hidden && relojOculto && falta > 0)
      relojOculto(Math.min(Math.ceil(falta), OCULTA_MS), () => listo(performance.now() >= vencimiento ? 1 : 0));
    else if (document.hidden) enTareaNueva(() => listo(falta <= 0 ? 1 : 0));
    else if (SIN_TOPE && falta <= 0) enTareaNueva(() => listo(1));   // §161: ya venció: solo ceder el turno, sin temporizador
    else if (falta <= servicioMs && DESPERTAR_ANTES > 0) {
      // §256 (G16): el temporizador despierta DESPERTAR_ANTES ms antes y el resto se espera cediendo el turno (una tarea
      // nueva por vuelta, MessageChannel: sin el redondeo de los temporizadores), hasta el vencimiento
      const girar = () => { if (performance.now() >= vencimiento) { despertarTarde(vencimiento); listo(1); } else enTareaNueva(girar); };
      enTareaNueva(() => setTimeout(girar, Math.max(0, Math.floor(falta - DESPERTAR_ANTES))));
    }
    else if (falta <= servicioMs) enTareaNueva(() => setTimeout(() => { despertarTarde(vencimiento); listo(1); }, Math.max(0, Math.ceil(falta))));
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
const sonido = crearSonido({ alCambiar: () => { pintarSonido(); ui?.sonidoCambio(); }, simularBloqueo: parametros.get('bloquearSonido') === '1',
                             worklet: AUDIO_WORKLET, objetivoMs: AUDIO_MS, arranqueMs: AUDIO_ARRANQUE, lastreAyuda: LASTRE.ayuda,
                             // P5 (§232): ?reciclarSonido=0 = un búfer nuevo por entrega; ?informeSonido=N = el informe del worklet cada N bloques (antes 8)
                             reciclar: parametros.get('reciclarSonido') !== '0', informeBloques: Number(parametros.get('informeSonido')) || 32 });
const SONIDO_PAGINA = parametros.get('sonidoPagina') !== '0';
if (SONIDO_PAGINA) sonido.instalar();       // ?sonidoPagina=0: sin esto (para comparar; también sin worklet)
window.mkwSonido = sonido;                  // para las pruebas
const barraVolumen = document.getElementById('volumen'), casillaSilencio = document.getElementById('silencio');
barraVolumen.value = Math.round(sonido.estado.volumen * 100);
casillaSilencio.checked = sonido.estado.silencio;
barraVolumen.addEventListener('input', () => sonido.volumen(barraVolumen.value / 100));
// − y + de a 10 %: el cursor del mando (mando.js) hace clic, pero un clic simulado no mueve una barra deslizante
const pasoVolumen = d => { const v = Math.min(100, Math.max(0, Math.round(sonido.estado.volumen * 10) * 10 + d)); barraVolumen.value = v; sonido.volumen(v / 100); };
document.getElementById('volumenMenos').addEventListener('click', () => pasoVolumen(-10));
document.getElementById('volumenMas').addEventListener('click', () => pasoVolumen(10));
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
// Cuánto ocupa lo guardado del disco, y borrarlo (la próxima vez se baja de nuevo). §251: la cuenta sale de la caja del
// disco (disco.inventario: el manifiesto y las entradas guardadas), no de storage.estimate (todo el sitio, BT3 incluido),
// y el borrado pasa por el disco (disco.borrar): antes caches.delete por debajo dejaba su índice de grupos mintiendo
async function pintarDatosDisco() {
  const t = document.getElementById('datosDisco');
  if (!disco?.inventario) { t.textContent = 'se cuenta cuando el juego abre su disco'; return; }
  let b = 0;
  try { for (const v of (await disco.inventario(tamDeUrl)).values()) b += v; } catch {}
  t.textContent = b >= 1048576 ? `${(b / 1048576).toFixed(0)} MB guardados en total (la próxima vez no se bajan)` : 'nada todavía';
}
document.getElementById('borrarDisco').addEventListener('click', async () => {
  if (!await ui.preguntar({ titulo: 'Borrar los datos del juego', si: 'Borrar', peligro: true,
    texto: 'Se borran TODOS los archivos del juego guardados en este navegador (para liberar espacio). Las partidas no se tocan; la próxima vez se bajan de nuevo. Para borrar solo algunas pistas, usa la lista de arriba.' })) return;
  if (disco?.borrar) await disco.borrar({ seguir: true });
  else for (const n of await caches.keys()) if (n.startsWith('mkw-disco:')) await caches.delete(n);   // (el juego todavía no abrió su disco)
  try { localStorage.removeItem(CLAVE_USO); } catch {}
  pintarDatosDisco(); espacio?.refrescar();
});

// ---- §251: la pantalla «Espacio» (borrar por partes: espacio.mjs + espacio-panel.mjs) ----
const usoPistas = crearUsoPistas();
let espacio = null, manifiestoEspacio = null, pistasSalaProtegidas = [];
let tamPorUrl = null;                        // dirección absoluta → [ruta del juego, tamaño] (del manifiesto)
function mapaManifiesto() {
  if (tamPorUrl || !manifiestoEspacio) return tamPorUrl;
  tamPorUrl = new Map();
  for (const [prefijo, archivos] of Object.entries(manifiestoEspacio)) for (const [ruta, tam] of archivos) {
    if (tam >= 0) tamPorUrl.set(new URL(direccion(prefijo + ruta), location.href).href, [prefijo + ruta, tam]);
  }
  return tamPorUrl;
}
const tamDeUrl = u => mapaManifiesto()?.get(u)?.[1] || 0;
const rutaDeUrl = u => mapaManifiesto()?.get(u)?.[0] || decodeURIComponent(new URL(u).pathname);
// La pista que el juego tiene elegida o corriendo (Pulsar 0x8043319C + 0x10), solo con una carrera en camino o en los menús
function pistaDelJuego() {
  try { const L = window.mkwMenus; if (L?.estado && (carreraEnCamino(L) || hayCarrera)) return L.u32(0x8043319C + 0x10); } catch {}
  return -1;
}
// Las pistas que no se pueden borrar ahora: la de la carrera en curso (o la elegida) y la que corre ahora y la siguiente
// de la sala (en la carrera no se puede bajar nada, §176)
function pistasProtegidas() {
  const s = new Set(pistasSalaProtegidas.filter(p => p >= 0));
  const p = pistaDelJuego();
  if (p >= 0) s.add(p);
  return s;
}
// …y sus archivos, para el disco (borrarArchivos nunca los toca; también se los dice a las otras pestañas)
function urlsProtegidas() {
  const uso = usoPistas.leer(), r = [];
  for (const p of pistasProtegidas()) for (const ruta of [...(uso[p]?.a || []), ...archivosDePista(p)]) r.push(direccion(ruta));
  return r;
}
async function resumenEspacio() {
  const inv = new Map();
  if (disco?.inventario) for (const [u, b] of await disco.inventario(tamDeUrl)) inv.set(rutaDeUrl(u), b);
  let copas = null;
  try { if (window.mkwMenus?.estado && window.mkw) copas = leerNombres(window.mkwMenus, window.mkw); } catch {}
  if (!copas) { try { copas = JSON.parse(localStorage.getItem('mkw.pistas') || 'null'); } catch {} }
  if (!copas) copas = await (espacioImagenes ||= crearImagenes(ORIGEN + '/build/imagenes')).nombres().catch(() => null);
  return armarResumen({ inventario: inv, uso: usoPistas.leer(), estrellas: usoPistas.estrellas(), protegidas: pistasProtegidas(),
                        copas, partidasBytes: guardado.estado.bytes || 0 });
}
let espacioImagenes = null;
async function borrarRutas(rutas) {
  if (!disco?.borrarArchivos) return { borrados: [], saltados: [] };
  const r = await disco.borrarArchivos(rutas.map(direccion));
  nota(`espacio: borrados ${r.borrados.length} archivos (${r.entradas} entradas de la caja)${r.saltados.length ? `, ${r.saltados.length} en uso quedaron` : ''}`);
  pintarDatosDisco();
  return r;
}
if (parametros.get('espacio') !== '0') {
  espacio = montarEspacio(document.getElementById('espacioPanel'), {
    leer: resumenEspacio, borrar: borrarRutas, uso: usoPistas,
    preguntar: o => ui.preguntar(o), alPartida: () => ui.abrirCajon('partida'),
    aplazar: () => hayCarrera,                // (lo pedido en la carrera se borra al terminarla, §176)
    alBorrar: ({ pistas, porTope }) => { if (porTope) nota(`espacio: el tope soltó ${pistas.length} pistas jugadas hace más tiempo`); },
  });
  window.mkwEspacio = espacio;              // (para las pruebas)
  // se cuenta al abrir la hoja Avanzado (no antes: recorrer la caja son unos ms)
  document.querySelectorAll('[data-hoja="avanzado"], [data-abre="ajustes"]').forEach(b => b.addEventListener('click', () => { espacio.refrescar(); pintarDatosDisco(); }));
}

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
  addEventListener('pagehide', () => disco?.guardarIndice?.());   // §175: lo último del índice de grupos (§171) no se pierde al cerrar
  try { nota(`partidas en la nube: ${await nube.alEntrar()}`); }
  finally { window.mkwEstado.nubeLista = performance.now(); soltarLectura(); }
  return nube.estado;
};
// (mkwEstado.lecturaPartidas: cuándo el juego leyó sus partidas, para la prueba: después de la nube, nunca antes)
let guardadosAlAbrir = esperaLectura.then(() => { window.mkwEstado.lecturaPartidas = performance.now(); return guardado.cargar(); }).catch(e => { guardado.estado.error = String(e); return new Map(); });
// Pipelines para precalentar (pipelines.mjs): la lista de este navegador y la semilla del servidor.
// ?precalentar=no: sin listas (para medir el peor caso, la primera visita sin semilla).
// §104: la semilla (pipelines.bin) pasa por la caché del disco (Cache Storage, con la versión de los archivos): en la
// 2.ª visita no llama al Worker. Por eso espera a que exista el disco (llega con el manifiesto, antes de que se use).
let discoListo = null;
const esperaDisco = new Promise(r => { discoListo = r; });
const semillaPorDisco = u => esperaDisco.then(d => d.entero(u)).then(b => new Response(b), () => new Response(null, { status: 404 }));
// §172: ?pipelines=<nombre>.bin = otra semilla de la misma carpeta (para medir antes y después en la misma tanda)
const ARCHIVO_PIPELINES = /^[\w.-]+\.bin$/.test(parametros.get('pipelines') || '') ? parametros.get('pipelines') : 'pipelines.bin';
const pipelines = crearPipelines({ urlSemilla: ORIGEN + '/build/' + ARCHIVO_PIPELINES, ...(parametros.get('lote') !== '0' ? { buscar: semillaPorDisco } : {}) });
const listasAlAbrir = parametros.get('precalentar') === 'no' ? Promise.resolve({}) : pipelines.cargar();
// §118 (D6): el almacenamiento persistente (persistencia.mjs): se pide al arrancar y otra vez al terminar cada carrera
// (como mucho cada 5 min) hasta que Chrome lo concede; ?persistir=0 = solo al arrancar, como antes
const persistencia = crearPersistencia();
let hayCarrera = false;                     // (la vigía de la carrera, después de main(): ver alCambiarCarrera)
// N12 (§233): el escalón del aparato. Los segundos de la carrera en curso; al terminar, la mediana va a localStorage
// (`mkw.capacidad`) y al latido de la sala. ?escalon=0 = sin esto (ni el aviso de la sala)
const ESCALON = parametros.get('escalon') !== '0';
// §269: lo que la v2.0 aprendió mal en la sala (contaba la espera a los demás como trabajo de esta PC): la capacidad
// guardada (`mkw.capacidad`, la del aviso «tu aparato no llegó a 60») y un «N8 no sirve aquí» (`mkw.n8.auto` = 'no') se
// olvidan UNA vez; la próxima carrera los vuelve a medir bien. (mkw.v269 = ya se hizo)
try {
  if (!localStorage.getItem('mkw.v269')) {
    localStorage.removeItem('mkw.capacidad');
    if (localStorage.getItem('mkw.n8.auto') === 'no') localStorage.removeItem('mkw.n8.auto');
    localStorage.setItem('mkw.v269', '1');
  }
} catch {}
const segundosEscalon = [];
let avisoLentosEn = -1;                    // (la carrera de la sala para la que ya se avisó quién no llega a 60)
const alCambiarCarrera = [];
// §256 (G16): al terminar cada carrera, «[imagenes]» al registro: fps a la vista, 1 % y 0,1 % bajo y los picos por causa
if (vistaImagenes) {
  let marcaCarrera = null;
  alCambiarCarrera.push(corre => {
    if (corre) { marcaCarrera = vistaImagenes.marca(); return; }
    if (marcaCarrera === null) return;
    const r = vistaImagenes.resumen(marcaCarrera);
    window.mkwEstado.imagenesCarrera = { ...r, causas: vistaImagenes.causas(marcaCarrera) };
    nota(`[imagenes] carrera: ${textoResumen(r)} · picos ${JSON.stringify(vistaImagenes.causas(marcaCarrera))}`);
    marcaCarrera = null;
  });
}
// §251: la fecha de cada pista al jugarla (la pantalla Espacio: «última vez jugada» y el tope) y, terminada la carrera y
// fuera de ella, el tope de espacio (opcional, apagado por omisión): suelta las pistas jugadas hace más tiempo
alCambiarCarrera.push(corre => {
  if (corre) { const p = pistaDelJuego(); if (p >= 0) usoPistas.jugada(p); return; }
  if (espacio && usoPistas.tope()) setTimeout(() => { if (!hayCarrera) espacio.aplicarTope().catch(e => nota('espacio: el tope falló: ' + e)); }, 3000);
});
// §269: si una carrera empieza con el mensaje de bienvenida abierto (lo abrió el jugador desde la Ayuda, o un camino que
// no se vio), se cierra sin marcarlo como visto: con él abierto el juego no recibe los botones y el kart queda quieto
alCambiarCarrera.push(corre => { if (corre && window.mkwBienvenida?.estado?.abierto) { window.mkwBienvenida.cerrar('carrera', { marcar: false }); nota('bienvenida: cerrada porque empezó la carrera'); } });
if (ESCALON) alCambiarCarrera.push(corre => {
  if (corre) { segundosEscalon.length = 0; return; }
  const r = resumirCarrera(segundosEscalon);
  segundosEscalon.length = 0;
  if (!r) return;
  const c = anotarCarrera(r);
  window.mkwEstado.capacidad = c;
  nota(`[escalón] carrera: ${r.logica} cuadros de lógica por segundo, ${r.cpuMs ?? '—'} ms por cuadro → guardado ${JSON.stringify(c)}`);
});
window.mkwPersistencia = persistencia;     // (para el informe y las pruebas)
function pintarPartidas() {
  const e = guardado.estado;
  const hora = e.ultimoGuardado ? `, guardado a las ${new Date(e.ultimoGuardado).toLocaleTimeString()}` : '';
  document.getElementById('partidas').textContent = (e.error ? `error: ${e.error}`
    : e.archivos ? `${e.archivos} archivos en este navegador${hora}` : 'ninguna todavía (se guardan solas al jugar)')
    + ' · ' + textoPersistencia(persistencia.estado);
}
persistencia.revisar().then(pintarPartidas, () => {});
// Cargar, descargar, borrar y las copias de respaldo: interfaz.mjs (panel «Partida»)

// ---- Controles (web/navegador/controles.mjs) ----
// Funcionan desde que se abre la página; hasta que el juego arranca, lo que juntan no va a ningún lado.
let enviarAlJuego = () => {};
let panelControles = null;                  // la hoja «Controles» (opciones-mandos.mjs; se monta más abajo)
const controles = crearControles({
  enviar: (...estado) => enviarAlJuego(...estado),
  contenedorTactil: document.getElementById('pantalla'),
  alCambiar: () => panelControles?.refrescar(),     // (cambió una tecla o terminó la espera de una tecla)
  ...(PLANIFICADOR ? { refresco: f => relojMonitor.alRefresco.push(f) } : {}),   // (§143: sin rAF propio)
});
window.mkwControles = controles;            // para las pruebas
// §100: los mandos como en el resto de Juegos (mando-sitio.mjs): en el marco del sitio, la copia de mando.js del sitio
// maneja con su cursor los menús de la página (los selectores, los diálogos, el cajón, el zócalo del descanso) y la de
// arriba se aparta; en el juego no hace nada (el juego lee el mando solo). El menú de inicio lee el mando él mismo
// (§111, el crítico: mientras se reasigna un control del mando, el cursor del sitio se aparta: si no, la A que se aprieta
// para asignar también hacía clic, y la cruz movía el foco)
// (§111, el dueño: «la selección de personajes no funciona bien con mando»: con la pantalla de personajes del juego
// abierta, la franja del descanso —«Cambiar personaje y vehículo», «+ Agregar pistas»— contaba como un menú de la página:
// el mando manejaba el cursor del sitio y no le llegaba al juego (con el teclado sí andaba). Mientras se elige en el juego
// el mando es del juego; solo lo que tapa la pantalla —el selector de pistas, el cajón— se lo queda)
// (§112, el crítico: mientras el panel de Controles captura o prueba un mando —y 250 ms después de soltar lo capturado—
// el cursor no lo toma: si no, en el mismo cuadro la B capturada cerraba el cajón y la A hacía clic. Y el cajón abierto
// encima del menú de inicio sí es un menú de la página: antes el mando no podía ni cerrarlo)
const menuDePagina = () => {
  if (document.getElementById('bienvenida')?.open) return true;   // (§263: el mensaje de bienvenida es un menú de la página)
  if (controles.ocupado()) return false;
  if (document.body.classList.contains('cajon-abierto')) return true;
  if (document.body.classList.contains('con-inicio')) return false;
  if (document.getElementById('elegirPista')) return true;
  return !!document.getElementById('playlistBreve') && !eligiendoEnJuego;
};
// §111: ¿está abierta la pantalla de personajes y vehículos del juego, esperando que esta persona elija? (directo.elegir)
let eligiendoEnJuego = 0;
const marcarEligiendo = promesaEleccion => { eligiendoEnJuego++; window.mkwEstado.eligiendoEnJuego = true;
  Promise.resolve(promesaEleccion).catch(() => {}).finally(() => { eligiendoEnJuego = Math.max(0, eligiendoEnJuego - 1); window.mkwEstado.eligiendoEnJuego = eligiendoEnJuego > 0; }); };
if (parametros.get('mandoSitio') !== '0') montarMandoSitio({ menu: menuDePagina, controles }).then(M => { window.mkwMandoSitio = !!M; });
// §113 (el dueño: «coloca compatibilidad con móviles»): el celular. Un TELÉFONO es una pantalla táctil sin puntero fino
// (como BT3: un PC con pantalla táctil o drivers de toque también dice «coarse», y el mando en pantalla le tapaba el
// juego). Ahí el mando en pantalla se prende solo (salvo que la persona lo apagó: `mkw.tactil.activo`) y la hoja
// Controles muestra la sección «Celular». ?tactil=1 lo prende en cualquier lado (pruebas), ?tactil=0 lo apaga.
const esTelefono = matchMedia('(any-pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const conCelular = parametros.get('tactil') === '1' || esTelefono;
const ponerTactil = si => {
  controles.tactil(si);
  document.body.classList.toggle('tactil', !!si);
  controles.ajustarTactil({ activo: !!si });     // (se recuerda en el navegador)
};
ponerTactil(parametros.has('tactil') ? parametros.get('tactil') === '1' : esTelefono && controles.ajustesTactil().activo !== false);
if (conCelular && controles.ajustesTactil().inclinar) controles.inclinar(true);   // (dirigir inclinando, si lo dejó prendido)
// editar el mando en pantalla (mover, agrandar, agregar u ocultar botones, cambiar lo que hacen): se cierra el cajón y se
// edita sobre el juego. opciones.objetivo (§113b): la acción que se tocó en la lista de Controles (ese botón ya elegido)
const editarTactil = (opciones = {}) => {
  ui.cerrarCajon();
  document.body.classList.add('editando-tactil');
  controles.editarTactil(true, () => document.body.classList.remove('editando-tactil'), opciones);
};
// §113c: «Acelerar solo»: ¿puede el kart acelerar solo AHORA? Sí con la carrera corriendo (Raceinfo +0x28 = 2, desde el
// «¡YA!»: en la cuenta, 1, la salida rápida es de la persona) y con la pantalla de la carrera encima. Esa pantalla se
// anota al largar (la de arriba de la pila en ese momento: el HUD, sea cual sea el modo); si después hay otra encima
// (la pausa, los resultados), no acelera: en un menú, A apretado elegiría por la persona
let etapaAntes = -1, paginaCarrera = -1;
controles.acelerar(() => {
  try {
    const L = window.mkwMenus, ri = L?.u32(0x809BD730), etapa = ri ? L.u32(ri + 0x28) : -1, pagina = L?.estado().pagina ?? -1;
    if (etapa === 2 && etapaAntes !== 2) paginaCarrera = pagina;
    etapaAntes = etapa;
    return etapa === 2 && pagina === paginaCarrera && pagina !== -1;
  } catch { return false; }
});
window.mkwCelular = { esTelefono, conCelular, ponerTactil, editarTactil };   // (para las pruebas)
// «Gira el teléfono»: jugando parado, la imagen 16:9 queda chica; el aviso ofrece pantalla completa acostada
document.getElementById('girarCompleta')?.addEventListener('click', () => document.getElementById('completa').click());
document.getElementById('girarCerrar')?.addEventListener('click', () => document.body.classList.add('girar-visto'));
document.getElementById('completa').addEventListener('click', async () => {
  // pantalla completa y, en el celular, acostado (horizontal); si el navegador no deja girar, no pasa nada
  // (toda la página, no solo el juego: así la barra y el cajón siguen a mano)
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  await document.documentElement.requestFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
});
// ---- La cara de la página (interfaz.mjs): inicio, modos, barra, cajón, «Tu partida», diálogos ----
// alCambiarGuardado: el editor de Mii guardó algo sin recargar la página → se vuelve a leer lo guardado para el arranque
// §262: los avisos de lag de la sala (📶, 🔴, «la sala va lenta», la sala partida) se pueden esconder: Avanzado → Gráficos
// → «Mostrar avisos de conexión y lag» (localStorage mkw.avisosLag; ?avisosLag=0|1 la fuerza). Solo lo que se ve: la
// red, el relevo y el árbitro siguen igual, y el registro lo anota todo
const avisosLag = crearAvisosLag({ parametros, alCambiar: v => {
  escribe(`[avisos] avisos de conexión y lag: ${v ? 'a la vista' : 'escondidos'}`);
  ui.repintarChips(CHIPS_LAG, v);
} });
window.mkwAvisosLag = avisosLag;   // (para las pruebas: estado() = prendidos, ocultos, mostrados)
if (!avisosLag.prendidos()) escribe('[avisos] avisos de conexión y lag escondidos' + (avisosLag.forzado ? ' (?avisosLag=0)' : ''));
var ui = crearInterfaz({ guardado, sonido, controles, imagenes: ORIGEN + '/build/imagenes', filtroChip: avisosLag,
  estadoNube: () => nube?.estado,
  alCambiarGuardado: () => { guardadosAlAbrir = esperaLectura.then(() => guardado.cargar()).catch(() => new Map()); } });
if (caidas?.estado.anterior) escribe('[caída] ' + caidas.texto());
if (caidas?.estado.anterior) setTimeout(() => ui.aviso(caidas.texto() + ' — Avanzado → Diagnóstico → «Copiar el informe» y mándalo, por favor.', true), 3000);   // §269
window.mkwInterfaz = ui;
// §276b: el cartel de la carga (cartel-carga.mjs): la cortina dice la fase con su avance («Bajando el juego… 34 MB de
// 80», «Compilando el programa…», «Preparando gráficos: 412 de 729 (te faltan ~6 s)», «Casi listo…»), con un puntito
// que gira y los segundos, y una línea tranquila si una fase pasa 15 s sin avanzar. Lo ponen el arranque, la espera de
// los gráficos de los menús (§133) y la preparación de la sala (§99). ?cartelCarga=0 = los textos fijos de antes
const CARTEL = parametros.get('cartelCarga') !== '0';
const cartel = crearCartelCarga({ puede: () => ui.cortinaPuesta && !document.body.classList.contains('cortina-mal'),
  pintar: p => { if (!p) return ui.cortinaVivo(null); ui.cortina(p.texto, false, p.pct); ui.cortinaVivo(p.segundos, p.calma); } });
window.mkwCartel = cartel;
const medidorPipes = crearMedidorPipes();
// la fase de ahora: las marcas del arranque, lo que se está bajando y los pipelines (parte = la de los menús, §276)
const faseAhora = ({ soloGraficos = false, parte = null } = {}) => {
  const pe = preparacion.estado;
  const meta = pe.pipesTotal > 0 ? (parte > 0 && parte < 1 ? Math.ceil(pe.pipesTotal * parte) : pe.pipesMeta) : 0;
  medidorPipes.agregar(pe.pipesLlegados || 0);
  const pipes = pe.sinPipelines || !(meta > 0) ? null : { llegados: Math.min(pe.pipesLlegados, meta), meta };
  const m = { ...arranque.marcas, pantalla: arranque.marcas.pantalla ?? (pe.pantalla ? 1 : null) };
  return faseCarga({ m, descarga: descargas?.mirar() ?? null, pipes, soloGraficos, sinLista: !!pe.sinPipelines,
    restante: pipes ? medidorPipes.restante(meta, pe.pipesLlegados) : null });
};
// §106: la barra, abajo a la izquierda (sobre la cortina de carga, al centro y con «queda guardado» la primera vez)
// (la cortina «puesta» pero tapada por la portada, ?portada=1, no cuenta: se mira si de verdad se ve)
if (descargas) montarBarraDescarga($('descarga'), descargas, { primeraVez: () => descargas.primeraVez,
  enCortina: () => ui.cortinaPuesta && getComputedStyle($('cortina')).visibility !== 'hidden' });
// §107: gráficos opcionales (graficos.mjs): resolución interna y fluidez van al Config.toml al arrancar; para medir sin
// tocar lo guardado, ?escala=2&fluidez=180 (o ?graficos=0 = lo de siempre, ignore lo guardado)
// §113: en un teléfono, la primera vez, la resolución de salida empieza en 720 (la pantalla de un teléfono tiene 3 pixeles
// por punto: sin tope el lienzo medía ~2400×1080 y la tarjeta del teléfono dibujaba 5 veces más que en 720); la
// persona la cambia en Avanzado → Gráficos y desde ahí manda lo suyo
try { if (esTelefono && localStorage.getItem('mkw.graficos') === null) guardarGraficos({ ...leerGraficos(), salida: 720 }); } catch {}
// §114: y una vez, para quien ya tenía guardado «la de tu pantalla» en el teléfono (lo de siempre del PC, sin elegirlo):
// también 720 (en un teléfono de 3,5 pixeles por punto el lienzo medía ~2770×1270, ¡7 veces 720!)
try {
  if (esTelefono && localStorage.getItem('mkw.graficos.telefono') !== '1') {
    localStorage.setItem('mkw.graficos.telefono', '1');
    if (leerGraficos().salida === 0) guardarGraficos({ ...leerGraficos(), salida: 720 });
  }
} catch {}
const graficosArranque = parametros.get('graficos') === '0' ? leerGraficos({ getItem: () => null }) : {
  ...leerGraficos(),
  ...(parametros.has('escala') ? { escala: Number(parametros.get('escala')) } : {}),
  ...(parametros.has('fluidez') ? { fluidez: Number(parametros.get('fluidez')) } : {}),
  ...(parametros.has('salida') ? { salida: Number(parametros.get('salida')) } : {}),
};
window.mkwEstado.graficos = { ...graficosArranque, lineas: lineasVideo(graficosArranque) };
// §108: la resolución de salida (el alto máximo del lienzo), en el momento y cada vez que la persona la cambia
const salidaLienzo = limitarSalida($('canvas'), { tope: graficosArranque.salida });
window.mkwSalida = salidaLienzo;
// §274: «⚡ Auto calibración: máxima fluidez» (auto-calibrar.mjs): prueba las opciones de Imagen y de salida que se
// aplican en el momento y deja la de mejor 1 % bajo con la lógica a 60. En la sala pausa a todos (sala-carrera.mjs
// pausaSala + lockstep.congelar + mkw_congelar). ?autoCalibrar=0 = sin el botón
const AUTO_CALIBRAR = parametros.get('autoCalibrar') !== '0';
const carreraAndando = () => { try { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return !!ri && L.u32(ri + 0x28) === 2; } catch { return false; } };
let panelGraficos = null;
const avisoPausa = crearAvisoPausa(document);   // (§274; §285 lo usa también para la espera de la carga)
const autoCalibrar = AUTO_CALIBRAR ? crearAutoCalibrar({
  leer: () => leerGraficos(), guardar: g => { guardarGraficos(g); panelGraficos?.releer(); },
  aplicarN8: v => window.mkwImagen?.(v, 'auto calibración'), aplicarSalida: s => salidaLienzo?.fijar(s),
  modoN8: () => { try { const n = window.mkwEstado.n8?.(); return n?.activo ? n.modo : 0; } catch { return 0; } },
  alto: () => $('canvas')?.height || 0,
  enCarrera: carreraAndando,
  medidor: {
    marca: () => vistaImagenes?.marca() ?? 0, resumen: d => vistaImagenes?.resumen(d) ?? null,
    logica: () => { const [f, n] = cuentaJuego(); return f.startsWith('carrera') ? n : NaN; },
    trabajo: () => { const M = window.mkw; return { t: performance.now(), espera: (M?._mkw_web_ms_espera?.() ?? 0) + (window.mkwEstado.esperaSala?.ms || 0), lastre: lastreCpu?.estado.ms ?? 0 }; },
    vueltasCongelado: () => window.mkw?._mkw_congelado_estado?.(1) ?? 0,
    gpuMs: () => gpuReciente(2000),
  },
  congelarJuego: si => window.mkw?._mkw_congelar?.(si ? 1 : 0),
  congeladoAhora: () => !!window.mkw?._mkw_congelado_estado?.(0),   // (§287: ya quieta por otro, p. ej. el cajón abierto con ▶)
  // (§275b: en «Cada uno su kart» no corre el lockstep: la pausa congela cada consola al llegarle y el lento al día empareja después)
  sala: () => window.mkwSala || null, lockstep: () => RED_ESTADO_SALA ? null : sincro?.lockstep || null, yo: sincro?.yo ?? null,
  nombreDe: u => window.mkwNombreDe?.(u), aviso: avisoPausa, nota,
  margenCuadros: MARGEN_PAUSA_CUADROS,
  alEstado: e => botonCalibrar?.pintar(e),
}) : null;
const botonCalibrar = autoCalibrar ? montarBotonCalibrar(document, { alApretar: () => autoCalibrar.apretar(), alDeshacer: () => autoCalibrar.deshacer() }) : null;
window.mkwAutoCalibrar = autoCalibrar;
panelGraficos = montarGraficos($('graficosPanel'), { enSala: !!sincro, alSalida: t => salidaLienzo?.fijar(t), arriba: botonCalibrar?.nodo,
  alQuitar: q => { if (parametros.has('quitarEfectos')) return; const M = window.mkw; M?._mkw_graficos_quitar?.(q); if (M?._mkw_graficos_quitar) window.mkwEstado.efectosQuitados = q; },
  alTexturas: k => { if (!parametros.has('texturasMenos')) window.mkw?._mkw_web_texturas_menos?.(k); },
  alImagen: v => window.mkwImagen?.(v),   // (§255, G15: en el momento, también en la carrera)
  avisosLag });                           // (§262: la casilla de los avisos de lag, en el momento)
// ---- §263: la bienvenida (una vez por versión del mensaje) y la «Ayuda de ajustes» de Avanzado (bienvenida.mjs) ----
// Abre la hoja del cajón sin cerrarla si ya está abierta (ui.abrirCajon con la misma hoja la cierra)
const abrirHojaAjuste = h => { if (!(document.body.classList.contains('cajon-abierto') && !$('hoja' + h[0].toUpperCase() + h.slice(1)).hidden)) ui.abrirCajon(h); };
// «⚡ Liviano» desde el mensaje: el botón de la hoja Gráficos (guarda y aplica en el momento) y cómo deshacerlo
const ponerLiviano = () => {
  const ctr = [...document.querySelectorAll('#graficosEfectos input, #graficosTexturas, #graficosSalida')];
  const antes = ctr.map(c => (c.type === 'checkbox' ? c.checked : c.value));
  $('graficosLiviano')?.click();
  return () => { ctr.forEach((c, i) => { if (c.type === 'checkbox') c.checked = antes[i]; else c.value = antes[i]; }); ctr[0]?.dispatchEvent(new Event('change')); };
};
// ¿Es buen momento? Sin la cortina de carga, sin carrera (ni su cuenta), sin otro diálogo, selector o editor encima, con la
// pestaña a la vista; en la sala, además, nunca en la fase de correr salvo el descanso con 10 s o más por delante
const momentoBienvenida = ({ abierto }) => {
  if (hayCarrera || document.hidden) return false;
  const sala = window.mkwSala?.estado?.();
  if (sala) {
    const n = sala.carrera | 0, descanso = sala.fase === 'correr' && sala.terminaron?.[n] && sala.plazo;
    // §269: en la sala, SOLO en el descanso (como dice §263). Antes también podía salir en la elección de copa y de
    // personaje: con el mensaje abierto el juego no recibe los botones (controles.silenciar), y si la carrera largaba con
    // él encima ese jugador quedaba quieto. ?bienvenidaSala=1 = como antes (solo pruebas)
    if (parametros.get('bienvenidaSala') === '1' ? sala.fase === 'correr' && !descanso : !descanso) return false;
    if (!abierto && sala.plazo && window.mkwSala.restan(sala.plazo) < 10000) return false;
  }
  if (abierto) return true;
  return !ui.cortinaPuesta && !document.querySelector('dialog[open]') && !document.getElementById('elegirPista') &&
    !aLaVistaId('editorMii') && !document.body.classList.contains('editando-tactil') && !controles.ocupado();
};
const aLaVistaId = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
let silencioAntesBienvenida = false;
const bienvenida = montarBienvenida({
  parametros, telefono: esTelefono, abrirHoja: abrirHojaAjuste, liviano: ponerLiviano, editor: () => editarTactil(), calibrar: AUTO_CALIBRAR,
  puedeMostrar: momentoBienvenida, nota,
  // mientras está abierto, el juego no recibe lo de la persona (una A en «¡A jugar!» no es también una A en el menú)
  alAbrir: () => { silencioAntesBienvenida = controles.silenciado; controles.silenciar(true); },
  alCerrar: () => controles.silenciar(silencioAntesBienvenida),
});
window.mkwBienvenida = bienvenida;
montarAyuda($('ayudaAjustes'), { telefono: esTelefono, abrirHoja: abrirHojaAjuste, liviano: ponerLiviano, editor: () => { ui.cerrarCajon(); editarTactil(); }, calibrar: AUTO_CALIBRAR,
  abrirMensaje: () => { ui.cerrarCajon(); bienvenida.abrir(); } });
// …y el medidor de fps y ping, arriba a la izquierda (solo si la persona lo prende; con el juego andando)
{
  const medidor = Object.assign(document.createElement('span'), { id: 'medidor', className: 'chip-estado', hidden: true });
  $('estadoJuego')?.prepend(medidor);
  // Pedido del dueño (2026-11-02): las pruebas que abren el navegador (Playwright: navigator.webdriver) muestran los fps
  // siempre, para que quien mira vea cómo va; ?verFps=1 los prende a mano, ?verFps=0 los apaga también en las pruebas
  const fpsPruebas = parametros.get('verFps') === '1' || (navigator.webdriver === true && parametros.get('verFps') !== '0');
  const graficoPruebas = parametros.get('verGrafico') === '1';   // (§256: ?verGrafico=1 = el gráfico del tiempo de cada imagen)
  montarMedidor(medidor, {
    graficos: () => { const g = leerGraficos(), h = fpsPruebas ? { ...g, verFps: true } : g; return graficoPruebas ? { ...h, verGrafico: true } : h; },
    // §270: «Imagen» = las imágenes que se vieron el último segundo (imagenes-vista; sin él, los cuadros entregados)
    fps: () => window.mkwEstado.cuadros > 0 ? (window.mkwEstado.imagenesSeg ?? window.mkwEstado.fps) : null,
    // §270: «Juego» = los cuadros que el juego calculó el último segundo y su 1 % bajo (los últimos 600)
    ...(ritmoJuego ? { juego: () => ritmoJuego.porSeg === null ? null : ritmoJuego.resumen(600),
                       // (el dueño 2026-11-11: un gráfico de imagen y otro de juego; el de juego = los mismos 240 cuadros)
                       graficoJuego: () => ritmoJuego.ultimos(PUNTOS_GRAFICO) } : {}),
    rtt: () => { try { return sincro?.lockstep?.estado().rtt || {}; } catch { return {}; } },
    nombres: () => window.mkwNombresSala || {}, yo: sincro?.yo ?? null,
    jugando: () => document.body.classList.contains('started') && !ui.cortinaPuesta,
    // §114: el detalle (qué frena): ms del juego por cuadro, de la tarjeta, Hz de la pantalla y el lienzo
    detalle: () => ({ trabajo: window.mkwEstado.trabajo, gpu: gpuReciente() ?? undefined, logica: window.mkwEstado.logica ?? undefined,
      hz: relojMonitor.p ? 1000 / relojMonitor.p : undefined, lienzo: `${$('canvas').width}×${$('canvas').height}` }),
    // §256 (G16): el 1 % bajo de las últimas 600 imágenes (10 s) y el gráfico de las últimas 240
    // (el dueño 2026-11-10: «ese 1 % low sea del gráfico que se muestra»: el 1 % bajo del texto sale de las mismas
    // PUNTOS_GRAFICO imágenes que dibuja el gráfico, no de una ventana más larga)
    ...(vistaImagenes ? { imagenes: () => vistaImagenes.resumen(null, PUNTOS_GRAFICO), grafico: () => vistaImagenes.ultimos(PUNTOS_GRAFICO),
                          esperado: () => esperadoImagen, dibujar: dibujarGrafico } : {}),
  });
}
// §114: «📋 Copiar el informe de rendimiento» (Avanzado → Diagnóstico): todo lo que hace falta para saber por qué un
// teléfono (o un PC) no llega a 60, en un texto para pegarlo en el chat. Nada personal: el navegador, el teléfono o PC
// (núcleos, memoria, tarjeta de video), la pantalla y los últimos 30 s del medidor
function informeRendimiento() {
  const h = window.mkwEstado.historial || [], ult = h.slice(-10);
  const media = k => { const v = ult.map(x => x[k]).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const hz = relojMonitor.p ? Math.round(1000 / relojMonitor.p * 10) / 10 : null;
  const fps = media('fps'), trabajo = media('juego'), gpu = media('video'), logica = media('logica'), cpuPura = media('cpu'), sala = media('sala');
  return {
    cuando: new Date().toISOString(), navegador: navigator.userAgent, telefono: esTelefono,
    nucleos: navigator.hardwareConcurrency ?? null, memoriaGB: navigator.deviceMemory ?? null,
    ...(caidas?.estado.anterior ? { caidaAnterior: caidas.texto() } : {}),   // §269: lo de la caja negra
    // §269: la sala, para diagnosticar desde el informe de cada PC (versión, papel en el lockstep, retraso, botones de
    // cada jugador mandados/recibidos/inventados/tarde, cuántas pantallas y locales armó el juego, el mando)
    ...(window.mkwSincro?.lockstep ? { sala: (() => { try {
      const e = window.mkwSincro.lockstep.estado(), L = window.mkwMenus, rd = L?.u32(0x809BD728), esc = rd ? rd + 0x20 : 0;
      return { version: window.mkwSala?.versiones?.() ?? { mia: VERSION_SALA, distintas: [] },   // (la carrera directa de las pruebas no arma la sala: la versión de la página igual)
        yo: window.mkwSincro.yo, humanos: (window.mkwSincro.humanos || []).map(h => h.uid),
        arbitro: e.arbitro, autoridad: e.autoridad, carrera: e.carrera, cuadro: e.cuadro, retraso: e.retraso, retrasos: e.retrasos, retrasoMax: e.retrasoMax,
        rtt: e.rtt, enviados: e.paquetesBotones, enviosA: e.enviosA, recibidosDe: e.recibidosDe, inventados: e.inventados, inventadosViejos: e.inventadosViejos,
        tardeVivo: e.tardeVivo, tardeDe: e.tardeDe, tardeAtraso: e.tardeEdad, pausas: (e.pausas || []).length, cortes: e.cortes, fuera: e.fuera, desincronizado: e.desincronizado || null,
        pantallasLocales: esc ? [L.u8(esc + 5), L.u8(esc + 6)] : null, unMando: window.mkwEstado.unMando, ventanas: window.mkwControles?.estado?.ventanas || null,
        esperaSalaMs: window.mkwEstado.esperaSala?.ms ?? null, avisosLento: (window.mkwAvisosLento || []).slice(-5) };
    } catch (x) { return { error: String(x) }; } })() } : {}),
    tarjeta: window.mkwEstado.gpu?.dada ?? null, adreno: window.mkwEstado.gpu?.adreno?.adreno ? window.mkwEstado.gpu.adreno : null,
    pantallaHz: hz, dpr: devicePixelRatio,
    pipelinesAcotado: window.mkwEstado.pipelinesAcotado ?? null,   // §248 (W26): el conjunto acotado (teléfono)
    efectosQuitados: window.mkwEstado.efectosQuitados ?? 0,   // §252 (G11): los efectos que el jugador apagó (máscara)
    texturasMenos: window.mkwEstado.texturasMenos?.() ?? null,   // §253 (G12): niveles saltados y KB que subieron
    hilos: estadoHilos(),   // (H5, §208: ¿aislada y con memoria compartida? la versión de Chrome y si es Android)
    lienzo: `${$('canvas').width}×${$('canvas').height}`, ventana: `${innerWidth}×${innerHeight}`,
    // (G5, §177: el lienzo puede ser 2,18:1 y la vista del juego seguir en 16:9 con barras: force_16_9 del Config.toml)
    zDescartadas: window.mkwEstado.zDescartadas?.() ?? null,   // (G2, §177.2: pasadas que no guardaron la profundidad)
    texturasBc: window.mkwEstado.texturasBc?.() ?? null,   // (G6, §190: las CMPR en BC1 y los KB ahorrados en la tarjeta)
    vista: parametros.get('aspecto') === 'libre' ? 'libre (la escena se estira al lienzo)' : '16:9 fija (barras dentro del lienzo)',
    graficos: leerGraficos(), mandoEnPantalla: controles.tactilActivo(), enSala: !!sincro,
    avisosLag: avisosLag.estado(),   // §262: ¿el jugador escondió los avisos de lag? (y cuántos se escondieron)
    // §190: el ahorro de energía (30 Hz) y el calor (los ms por cuadro de cada minuto de carrera), si están prendidos
    ...(window.mkwEnergia?.ahorro || window.mkwEnergia?.calor ? { energia: { ahorro: window.mkwEnergia.ahorro?.ahorro ?? null,
      calorMinutos: window.mkwEnergia.calor?.minutos ?? null, caliente: window.mkwEnergia.calor?.caliente ?? null } } : {}),
    enganche: { ...window.mkwEstado.fase }, memoriaJuegoMB: window.mkwHeapMB ? Math.round(window.mkwHeapMB()) : null,
    ultimos10s: { fps, logica, juegoMs: trabajo, videoMs: gpu, ...(cpuPura !== null ? { cpuPuraMs: cpuPura } : {}), ...(sala !== null ? { esperaSalaMs: sala } : {}) },
    // N12 (§233): en qué escalón está el aparato y qué esperar (con lo de los últimos 10 s; si no hubo carrera, la última guardada)
    ...(ESCALON ? { escalon: (() => {
      const cap = leerCapacidad(), enCarrera = Number.isFinite(logica);
      let rtt = null; try { const r = sincro?.lockstep?.estado().rtt || {}; const v = Object.values(r).filter(Number.isFinite); rtt = v.length ? Math.max(...v) : null; } catch {}
      const e = escalonDe({ cpuPuraMs: cpuPura ?? (enCarrera ? null : cap?.ms ?? null), juegoMs: enCarrera ? trabajo : null, logica: enCarrera ? logica : cap?.l ?? null,
        telefono: esTelefono, memoriaGB: navigator.deviceMemory ?? null, rttMs: rtt, esperaSalaMs: enCarrera ? sala : null, n8: (() => { try { return window.mkwEstado.n8?.()?.activo === true; } catch { return false; } })() });
      return { ...e, ultimaCarrera: cap };
    })() } : {}),
    frena: queFrena({ fps, trabajo, gpu: gpu ?? undefined, hz: hz ?? undefined, logica }),
    pipelines: { ...pipelinesMedida, ms: Math.round(pipelinesMedida.ms), msShaders: Math.round(pipelinesMedida.msShaders) },
    ...(lastreCpu || lastreGpu || ladron || LASTRE.ayuda > 1 ? { lastre: { ...LASTRE, ...window.mkwLastre() } } : {}),   // §155 (H1)
    // §115: el perfil de la tarjeta: los ms de cada pasada (las 15 más caras) y si se pudo medir
    ...(perfilGpu ? { perfilTarjeta: { marcas: perfilGpu.conMarcas, estado: window.mkwEstado.perfilEstado || null, fallo: perfilGpu.fallo,
      // (§155: la suma de lo que tardan las pasadas en un cuadro: el promedio de cada pasada por las veces que aparece,
      // entre los cuadros medidos —las veces de la pasada más repetida—)
      msPorCuadro: (t => { const n = Math.max(1, ...t.map(x => x.veces)); return Math.round(t.reduce((a, x) => a + x.ms * x.veces, 0) / n * 100) / 100; })(perfilGpu.tiempos()),
      // §173: el tramo de la tarjeta por cuadro (último fin − primer comienzo; mediana) y la suma de las pasadas: en una
      // tarjeta por mosaicos (mosaicos: true) las pasadas se pisan y lo que vale es tramoMs
      ...(perfilGpu.tramo ? (t => t ? { tramoMs: t.tramoMs, sumaMs: t.sumaMs, cuadrosTramo: t.cuadros, mosaicos: t.mosaicos,
        ...(t.mosaicos ? { aviso: 'tarjeta por mosaicos: las pasadas se pisan; lo que tardó la tarjeta es tramoMs' } : {}) } : {})(perfilGpu.tramo()) : {}),
      pasadasCaras: perfilGpu.tiempos().slice(0, 15).map(t => `#${t.n} ${t.tam}${t.etiqueta ? ' «' + t.etiqueta + '»' : ''}: ${t.ms} ms, ${t.dibujos} dibujos (×${t.veces})`) } } : {}),
    // un renglón por segundo: «s · fps · juego ms · video ms · disco ms · pipelines nuevos (ms) · dónde»
    porSegundo: h.map(x => `${x.s}s ${x.fps}fps` + (Number.isFinite(x.logica) ? ` logica${x.logica}` : '') + ` juego${x.juego}` + (x.video === null ? '' : ` video${x.video}`) + (x.disco ? ` disco${x.disco}` : '') +
      (x.pip ? ` pip${x.pip}(${x.pipMs}ms)` : '') + (x.shaders ? ` sh${x.shaders}` : '') +
      (x.pasadas !== undefined ? ` pasadas${x.pasadas} dib${x.dibujos} kb${x.kb} cop${x.copias}` : '') + (x.lugar ? ` ${x.lugar}` : '') + (x.lret !== undefined ? ` giro${x.lgiro}/${x.lpared}ms ret${x.lret}` : '')),
    // §149 (H2): cada pieza contra su meta del presupuesto de la gama media (?presupuesto=0 = sin esta parte)
    ...(parametros.get('presupuesto') !== '0' ? { presupuesto: presupuesto({ juegoMs: trabajo, tarjetaMs: gpu, paginaMs: PLANIFICADOR ? relojMonitor.paginaMs : null })
      .map(p => `${p.estado === 'bien' ? '🟢' : p.estado === 'mal' ? '🔴' : '⚪'} ${p.pieza}: ${p.ms ?? '—'} ms (meta ≤ ${p.meta})${p.nota ? ' · ' + p.nota : ''}`) } : {}),
    ...(gpu === null ? { nota: 'sin medida de la tarjeta: prende «Mostrar qué frena» en Avanzado → Gráficos y recarga' } : {}),
  };
}
window.mkwInformeRendimiento = informeRendimiento;   // (para las pruebas)
// §115: «🔬 Perfilar la tarjeta de video»: se recarga con las marcas de tiempo de la tarjeta, mide 20 s de carrera y queda
// en el informe (después se apaga solo)
$('perfilarGpu')?.addEventListener('click', () => {
  try { localStorage.setItem('mkw.perfilGpu', '1'); const g = leerGraficos(); if (!g.verDetalle) guardarGraficos({ ...g, verDetalle: true }); } catch {}
  location.reload();
});
$('copiarRendimiento')?.addEventListener('click', async () => {
  const texto = JSON.stringify(informeRendimiento(), null, 1);
  $('informeRendimiento').hidden = false; $('informeRendimiento').textContent = texto;
  let copiado = false;
  try { await navigator.clipboard.writeText(texto); copiado = true; } catch {}
  $('copiarRendimiento').textContent = copiado ? '✓ Copiado: pégalo en el chat' : '📋 No se pudo copiar: selecciona el texto de abajo';
  setTimeout(() => { $('copiarRendimiento').textContent = '📋 Copiar el informe de rendimiento'; }, 4000);
});

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
// §117 (C1): el precalentado SIEMPRE con tope, también en la 1.ª visita y en la sala. Antes, fuera del caso de arriba,
// aurora pedía la lista entera de a 8 por cuadro sin límite: en la sala, 723 pedidos en 1 s y hasta 553 compilándose a
// la vez en el proceso de GPU de Chrome, que es UNO para todas las pestañas (el PC y las demás pestañas se trababan).
// Ahora va como el modo «tarde» (que ya existe en aurora): como mucho 2 nuevos por cuadro y solo mientras haya menos de
// EN_CAMINO_MAX compilándose (contando los que pide el propio juego, que nunca esperan); se suelta ya, sin esperar
// la primera pantalla (eso sigue siendo solo para quien vuelve, arriba). EN_CAMINO_MAX = max(2, núcleos/4): 4 en esta
// PC de 16 hilos, 2 en un teléfono de 8 núcleos.
// ?precalentarTope=0: sin tope (el de antes, para comparar); ?precalentarTope=N: N compilándose como mucho.
const TOPE_PEDIDO = parametros.get('precalentarTope');
// §276: en el teléfono (el de §133: toque sin puntero fino) el tope es UNO POR NÚCLEO (8 en el Oppo), no núcleos ÷ 4: ahí
// la cortina «Preparando los gráficos» espera la mitad de la lista antes de abrir Single Player, y con 2 a la vez eran
// 17–19 s (el 85 % del arranque, medido en el Oppo Find X9 Pro); con 8, ~8 s, sin dibujos saltados y casi la misma
// fluidez del menú después (16 y 32 no ganan más: la tarjeta ya va llena). Como abrir más cajas en un peaje: hasta 8
// pasan más autos; desde ahí la calle de salida es la que limita. ?precalentarTope=N sigue mandando.
const TOPE_TELEFONO = ESPERA_GRAFICOS && parametros.get('topeTelefono') !== '0';   // (?topeTelefono=0 = núcleos ÷ 4 también ahí, como antes)
const EN_CAMINO_MAX = TOPE_PEDIDO === '0' ? 0
  : Math.min(64, Number(TOPE_PEDIDO) > 0 ? Math.round(Number(TOPE_PEDIDO))
    : TOPE_TELEFONO ? Math.max(4, navigator.hardwareConcurrency || 8)
    : Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 4)));
const PRECALENTAR_RITMO = Number(parametros.get('precalentarRitmo')) > 0 ? Math.round(Number(parametros.get('precalentarRitmo'))) : 2;
let pedirPiloto = null;          // arrancar() lo pone cuando el piloto existe; antes, la elección queda esperando
let eleccionPendiente = null;
let modoInicio = null;           // lo último elegido que mueve el juego ('unjugador' | 'local')
let localesInicio = 2;           // §84: cuántos juegan en este PC (Local → 2, 3 o 4 Players)
const aLaVista = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
const inicio = crearInicio({
  imagen: ORIGEN + '/build/imagenes/inicio/jlokart.webp',
  leerMandos: () => controles.estado.mandos,
  enSitio: window.parent !== window,
  // con el cajón, un diálogo, el editor de Mii o la lista de pistas encima, las teclas y el mando son para ellos
  ocupado: () => document.body.classList.contains('cajon-abierto') || !!document.querySelector('dialog[open]') ||
    aLaVista('editorMii') || aLaVista('elegirPista'),
  alElegir: que => elegirInicio(que),
  multiEnObra: parametros.get('multi') === '0',     // §116: Multiplayer «trabajando para usted»; abierto desde la v2.0 (2026-11-09), ?multi=0 = en obra
});
window.mkwInicio = inicio;
function mostrarInicio() {
  if (!inicio.mostrar()) return false;
  controles.silenciar(true);
  window.mkwEstado.inicioVisto = performance.now();
  return true;
}
function elegirInicio(que) {
  if (que === 'opciones') return ui.abrirCajon('ajustes');      // §265: la Ayuda primero (antes: Controles)
  if (que === 'salas') return window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'salas' }, location.origin);
  // 'unjugador' | 'local2'…'local4': el juego vuelve a recibir lo de la persona y se abre esa pantalla
  const local = /^local([234])$/.exec(que);
  if (local) { localesInicio = Number(local[1]); que = 'local'; }
  // §133 (U1): si los pipelines de los menús todavía no llegaron (1.ª visita, el precalentado con tope de §117), se
  // espera aquí con la cortina y el %, como mucho 30 s: así no siguen compilándose dentro de la 1.ª carrera.
  // ?esperaGraficos=0 = entrar en seguida, como antes
  // §276b: con el cartel, también hasta que el juego esté en su primera pantalla. Medido en el Oppo: quien toca Single
  // Player apenas sale el menú de inicio (el juego todavía cargando detrás) veía ~6 s el arranque del juego sin cortina
  // ni cartel, como trabado; ahora la cortina sigue con «Arrancando el juego…» hasta que el juego se ve
  const enPantalla = () => { try { const e = window.mkwMenus?.estado?.(); return !!e && e.seccion >= 0 && e.pagina >= 0; } catch { return false; } };
  const faltaPantalla = () => CARTEL && !enPantalla();
  if (ESPERA_GRAFICOS && (!graficosListos(preparacion.estado, PARTE_MENUS).listo || faltaPantalla())) {
    const t0 = performance.now();
    window.mkwEstado.esperaGraficos = { desde: Math.round(t0), ms: null };
    const vuelta = () => {
      const g = graficosListos(preparacion.estado, PARTE_MENUS);
      if ((!g.listo || faltaPantalla()) && performance.now() - t0 < 30000) {
        if (!CARTEL) ui.cortina(`Preparando los gráficos… ${g.pct} %`, false, g.pct);
        else if (cartel.cual !== 'graficos') cartel.mostrar(() => faseAhora({ soloGraficos: enPantalla(), parte: PARTE_MENUS }), 'graficos');   // (§276b)
        return setTimeout(vuelta, 150);
      }
      cartel.parar('graficos');
      ui.cortina(false);
      window.mkwEstado.esperaGraficos.ms = Math.round(performance.now() - t0);
      nota(`menú de inicio (§133): esperé los gráficos de los menús ${window.mkwEstado.esperaGraficos.ms} ms${g.listo ? '' : ' (tope)'}`);
      seguirInicio(que);
    };
    return vuelta();
  }
  seguirInicio(que);
}
function seguirInicio(que) {
  controles.silenciar(false);
  modoInicio = que;
  window.mkwEstado.inicio = { que, cuando: performance.now(), ...(que === 'local' ? { locales: localesInicio } : {}) };
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
// La hoja «Controles» (opciones-mandos.mjs, §112): pestaña por jugador, la lista de acciones (mando y teclado), el asistente
// paso a paso, probar el mando y los ajustes de todos
panelControles = montarControles(document.getElementById('panelControles'), controles,
  { celular: { visible: conCelular, ponerTactil, alEditar: editarTactil } });
window.mkwPanelControles = panelControles;  // para las pruebas
// Récords (records.mjs): existen desde el principio (la lista de pistas muestra tus mejores tiempos antes de jugar)
const records = crearRecords();
window.mkwRecords = records;
// §92: el mismo almacén lleva los fantasmas de la página (fantasma-pagina.mjs: se conecta cuando el juego cargó)
let conexionRecords = null, fantasmaPagina = null;
window.mkwConectarRecords = o => { records.conectar(o); conexionRecords = o; fantasmaPagina?.conectar(o); };
window.mkwConectarVr = async o => {
  vr.conectar(o);
  const r = await vr.cargar();
  if (r && vr.conNube) red?.presentador.presentar(r);     // sin sesión manda el archivo del juego (RRRating.pul)
  return r;
};

// La dirección web de un archivo del juego: es la misma ruta, con cada pedazo "escapado" (espacios → %20…)
const direccion = ruta => ORIGEN + ruta.split('/').map(encodeURIComponent).join('/');
// §174 (D5): la huella de cada archivo, del manifiesto ([ruta, tamaño, huella]; un manifiesto viejo trae solo dos): el
// disco guarda cada archivo con la suya y una actualización ya no tira lo que no cambió. null = sin huellas (como antes;
// también con ?versionArchivo=0). La dirección se normaliza como la arma el disco (new URL).
function huellasDelManifiesto(manifiesto) {
  if (parametros.get('versionArchivo') === '0') return null;
  const mapa = new Map();
  for (const [prefijo, archivos] of Object.entries(manifiesto)) for (const [ruta, tam, h] of archivos) {
    if (tam >= 0 && typeof h === 'string' && h) mapa.set(new URL(direccion(prefijo + ruta), location.href).href, h);
  }
  if (!mapa.size) return null;
  const cache = new Map();             // (la dirección tal cual llega → la huella: new URL una sola vez por dirección)
  return url => {
    let h = cache.get(url);
    if (h === undefined) { h = mapa.get(new URL(url, location.href).href) || ''; cache.set(url, h); }
    return h;
  };
}
// §104: el cartero de lotes (lote.mjs): muchos pedazos del disco en UNA llamada a <ORIGEN>/lote (el Worker de amigos;
// servidor.mjs en las pruebas). ?lote=0 = de a uno, como antes (para comparar)
const nuevosLotes = () => {
  if (parametros.get('lote') === '0') return null;
  const l = crearLotes({ url: ORIGEN + '/lote', base: ORIGEN + '/', registro: nota, prioridad: parametros.get('prioridad') !== '0',   // (§132: ?prioridad=0 = sin)
    // §139/§142 (C4): lo de fondo a la mitad del ancho medido, solo en la sala ya cargada (en la carga el juego necesita
    // todo lo que baja: frenarla la alargaba 39 s, §139; en la carrera ya está en pausa, §121). ?freno=0 = nunca;
    // ?freno=1 = siempre (también en la carga y jugando solo)
    freno: parametros.get('freno') === '1' || (parametros.get('freno') !== '0' && parametros.get('modo') === 'sala'),
    frenoActivo: () => parametros.get('freno') === '1' || preparacion.lista() });
  window.mkwEstado.lotes = l.estado;
  return l;
};

async function arrancar() {
  $('arrancar').disabled = true;
  ui.empezo();                                // la pantalla de inicio se va; el juego ocupa la ventana
  // §99: en la sala, la cortina con la barra de la preparación hasta que el navegador está listo (preparacion.mjs);
  // después avisa (window.mkwAlPreparada: la sala abre la lista de copas del anfitrión y empieza el reloj de la copa)
  if (parametros.get('modo') === 'sala' && parametros.get('preparacion') !== '0') {
    const desde = performance.now();
    const vigiaPrep = setInterval(() => {
      { const em = window.mkwMenus?.estado?.(); if (em && em.seccion >= 0 && em.pagina >= 0) preparacion.marcar('pantalla'); }   // (con su página activa)
      if (!preparacion.lista()) {
        if (CARTEL) { if (cartel.cual !== 'sala') cartel.mostrar(() => faseAhora(), 'sala'); return; }   // (§276b)
        const pct = preparacion.pct();
        const que = pct < 35 ? 'Bajando el juego' : pct < 90 ? 'Preparando los gráficos (la primera vez tarda más)' : 'Casi listo';
        ui.cortina(`${que}… ${pct} %`, false, pct);
        return;
      }
      clearInterval(vigiaPrep);
      cartel.parar('sala');
      window.mkwEstado.preparacion = { ms: Math.round(performance.now() - desde), por: preparacion.estado.por };
      nota(`sala: preparada en ${(window.mkwEstado.preparacion.ms / 1000).toFixed(1)} s (${preparacion.estado.por}; pipelines ${preparacion.estado.pipesLlegados} de ${preparacion.estado.pipesTotal})`);
      ui.cortina(false);
      window.mkwAlPreparada?.();
    }, 250);
  } else if (CARTEL) cartel.mostrar(() => faseAhora(), 'arranque');   // §276b: lo saca revisarCortina al irse la carga
  $('canvas').focus();

  // §276: el manifiesto se pide ya, mientras el navegador contesta por la tarjeta de video (en el teléfono simulado
  // requestAdapter tarda ~0,6 s; antes el manifiesto esperaba detrás). ?manifiestoTemprano=0 = después, como antes
  const manifiestoEnCamino = parametros.get('manifiestoTemprano') !== '0' ? fetch(ORIGEN + '/manifiesto.json') : null;
  manifiestoEnCamino?.catch(() => {});
  // 1) Lo que el navegador necesita
  const hayJspi = 'Suspending' in WebAssembly;
  const revisarGpu = async () => {
    const revision = await revisionGpu, { adaptador, nombreGpu, ignora } = revision;
    arranque.marcar('gpu');
    if (!ok('el navegador tiene WebGPU y JSPI', !!adaptador && hayJspi,
            `WebGPU ${adaptador ? 'sí' : 'no'}, JSPI ${hayJspi ? 'sí' : 'no'}`)) {
      ui.cortina('Este navegador no puede correr el juego: necesita WebGPU y JSPI (Chrome o Edge, en el computador o en Android).', true);
      return false;
    }
    nota(`GPU pedida: ${GPU}; la que dio el navegador: ${nombreGpu}`);
    if (ignora) nota('el navegador ignora la elección de tarjeta (da la misma para alto rendimiento y bajo consumo)');
    return true;
  };
  // §276: la respuesta de la tarjeta (requestAdapter: ~0,5 s en este PC) solo la necesita el motor al arrancar; el
  // manifiesto, el disco, los archivos chicos y el programa no. Si el navegador tiene WebGPU y JSPI, todo eso sigue
  // en paralelo y la respuesta se espera justo antes de crear el juego. ?gpuParalela=0 = esperarla aquí, como antes
  const GPU_PARALELA = parametros.get('gpuParalela') !== '0' && !!navigator.gpu && hayJspi;
  if (!GPU_PARALELA && !(await revisarGpu())) return fin();

  // 2) Manifiesto
  const respuestaManifiesto = await (manifiestoEnCamino || fetch(ORIGEN + '/manifiesto.json'));
  if (!respuestaManifiesto.ok) {                     // el Worker: 401 = sin sesión, 403 = no está en la lista de amigos
    const por = { 401: 'Inicia sesión en Juegos para jugar.', 403: 'Este juego es solo para la lista de amigos.' }[respuestaManifiesto.status] || `El servidor del juego contestó ${respuestaManifiesto.status}.`;
    ui.aviso(por, true); ui.cortina(por, true);
    ok('lo privado responde', false, `manifiesto: ${respuestaManifiesto.status}`);
    return fin();
  }
  const manifiesto = await respuestaManifiesto.json();
  manifiestoEspacio = manifiesto; tamPorUrl = null;   // (§251: los tamaños para la pantalla Espacio)
  preparacion.marcar('manifiesto'); arranque.marcar('manifiesto');
  // El programa con su huella (?v=, de la cabecera X-Mkw-Build del manifiesto): el servidor lo da guardable para
  // siempre y Chrome reusa su caché HTTP y su caché de código en la próxima visita (bitácora §54). ?huella=0:
  // sin huella (siempre se baja y se compila de nuevo, como antes).
  const huellaBuild = parametros.get('huella') === '0' ? null : respuestaManifiesto.headers.get('X-Mkw-Build');
  const conHuella = f => ORIGEN + '/build/' + f + (huellaBuild ? '?v=' + huellaBuild : '');
  // §276: el programa (mkw.wasm) y su cargador (mkw.js) se piden YA, en paralelo con los archivos chicos y los
  // diminutos: antes el programa recién empezaba a bajar cuando habían llegado TODOS los chicos (en el teléfono
  // simulado, 2,6 s después). compileStreaming compila mientras baja (y deja la caché de código de V8 igual que antes:
  // la misma dirección); emscripten recibe el módulo ya compilado por su gancho instantiateWasm. Como dos líneas que
  // se cargan a la vez en vez de una detrás de otra. ?programaTemprano=0 = como antes (el programa al final).
  const PROGRAMA_TEMPRANO = parametros.get('programaTemprano') !== '0';
  const programaTemprano = PROGRAMA_TEMPRANO ? (() => {
    const url = conHuella('mkw.wasm');
    return WebAssembly.compileStreaming(fetch(url, { credentials: 'same-origin' })).catch(async e => {
      nota(`programa temprano (§276): compilar mientras baja falló (${e?.message || e}): lo compilo entero`);
      return WebAssembly.compile(await (await fetch(url, { credentials: 'same-origin' })).arrayBuffer());
    }).then(m => { arranque.marcar('compiladoTemprano'); return m; });
  })() : null;
  const cargadorTemprano = PROGRAMA_TEMPRANO ? (privado ? privado.importar(conHuella('mkw.js')) : import(conHuella('mkw.js'))) : null;
  cargadorTemprano?.catch(() => {});   // (si falla, el error sale abajo, donde se espera)
  if (!cartel.activo) ui.cortina('Bajando los archivos del juego…');
  // Caché del disco (disco.mjs): lo bajado queda en este navegador; la versión de los archivos la da el servidor
  // ?adelantar=0: sin bajar antes (ni avisos del juego ni lectura seguida), para comparar (bitácora §52)
  const memoriaBloques = parametros.has('memoriaBloques') ? Math.max(4, Number(parametros.get('memoriaBloques')) || 64) * 1048576
    : memoriaDeBloques(navigator.deviceMemory);
  const huellaDe = huellasDelManifiesto(manifiesto);
  window.mkwEstado.versionArchivo = !!huellaDe;
  disco = crearDisco({ version: respuestaManifiesto.headers.get('X-Mkw-Version') || 'sin-version', cajaGrande: parametros.get('cajaGrande') === '0' ? 0 : 8,   // (§171, C5)
                       huellaDe,   // §174 (D5): una versión por archivo
                       adelantarActivo: parametros.get('adelantar') !== '0', lotes: nuevosLotes(),
                       // §138 (C9): la memoria de bloques según la RAM del aparato; ?memoriaBloques=N = N MB (64 = como antes)
                       memoriaMax: memoriaBloques,
                       // §146 (D3): lo que el juego espera y venía de fondo pasa a urgente o se pide aparte (?apurar=0 = esperar)
                       apurarActivo: parametros.get('apurar') !== '0',
                       protegidas: urlsProtegidas });   // §251: lo de la carrera en curso y la siguiente de la sala no se borra
  window.mkwEstado.memoriaBloquesMB = memoriaBloques / 1048576;
  await disco.abrir();
  arranque.marcar('disco');
  window.mkwDisco = disco;
  discoListo(disco);
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

  // §93 (E2): el paquete de los diminutos (diminutos.bin, junto al programa: herramientas/diminutos.mjs). Los ~600
  // archivos de ≤ 8 KB que el juego lee de a uno (fantasmas, íconos, voces…) llegan en UN pedido (~1,5 MB) mientras
  // baja el programa, y quedan fijos en la memoria (disco.fijar): ya no van uno por uno por la fila baja, que en la
  // primera visita tardaba ~22 s en vaciarse. Con caché, sale de Cache Storage. Cada archivo solo se usa si su tamaño
  // es el del manifiesto. Si no está (404) o algo falla, queda el camino de antes. ?paquete=0: sin él.
  if (parametros.get('paquete') !== '0' && parametros.get('adelantar') !== '0') {
    const t0 = performance.now();
    window.mkwEstado.paquete = disco.entero(ORIGEN + '/build/diminutos.bin').then(b => {
      const archivos = leerPaquete(b);
      let puestos = 0, distintos = 0;
      for (const [ruta, datos] of archivos) {
        if (tamaños.get(ruta) === datos.length) { if (disco.fijar(direccion(ruta), datos)) puestos++; }
        else if (tamaños.has(ruta)) distintos++;              // otro tamaño: el paquete es de otra versión del archivo
      }
      const r = { puestos, distintos, archivos: archivos.length, mb: +(b.length / 1048576).toFixed(2), ms: Math.round(performance.now() - t0) };
      arranque.marcar('diminutos');
      nota(`paquete de diminutos: ${puestos} archivos listos en la memoria (${r.mb} MB en ${r.ms} ms)${distintos ? `, ${distintos} de otra versión (esos, de a uno)` : ''}`);
      return r;
    }).catch(e => { nota('paquete de diminutos: no está (' + e.message + '): de a uno, como antes'); return null; });
  }

  // 3) Bajar los chicos, de a 16 a la vez
  const t0 = performance.now();
  const contenidos = new Map();
  let siguiente = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (siguiente < aBajar.length) {
      const [ruta, tam] = aBajar[siguiente++];
      contenidos.set(ruta, await disco.entero(direccion(ruta), tam));   // de la caché si ya se bajó antes (§104: por lote)
      preparacion.marcar('chicos', contenidos.size / Math.max(1, aBajar.length));
    }
  }));
  const mb = [...contenidos.values()].reduce((s, d) => s + d.length, 0) / 1048576;
  arranque.marcar('chicos');
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
  if (GPU_PARALELA && !(await revisarGpu())) return fin();   // (§276: la tarjeta, recién aquí)
  const t1 = performance.now();
  // (la huella del programa y lo temprano de §276: arriba, apenas llegó el manifiesto)
  // (desde el Worker, import() no deja poner el token: privado.mjs lo baja con fetch y lo importa desde un blob)
  if (!cartel.activo) ui.cortina('Preparando el juego…');
  const crear = (await (cargadorTemprano || (privado ? privado.importar(conHuella('mkw.js')) : import(conHuella('mkw.js'))))).default;
  arranque.marcar('cargador');
  let lecturas = 0, bytes = 0;
  const M = await crear({
    canvas: $('canvas'),
    onAbort: t => caidas?.alAbortar(t),   // §269: el motor se detuvo: a la caja negra
    mkwGpuPreferencia: GPU,
    mkwVibrar: (puerto, cmd) => controles.vibrar(puerto, cmd),   // el juego pide vibrar (pad_web.cpp)
    locateFile: f => conHuella(f),
    // §276: el módulo ya compilado mientras bajaban los chicos; aquí solo se instancia con las importaciones de
    // emscripten (las de JSPI ya envueltas). Si lo temprano falló, emscripten lo baja y compila como siempre
    ...(programaTemprano ? { instantiateWasm: (importaciones, listo) => {
      programaTemprano.then(m => WebAssembly.instantiate(m, importaciones)).then(inst => listo(inst), e => {
        nota(`programa temprano (§276): no se pudo instanciar (${e?.message || e}): lo bajo de nuevo`);
        WebAssembly.instantiateStreaming(fetch(conHuella('mkw.wasm'), { credentials: 'same-origin' }), importaciones).then(r => listo(r.instance));
      });
      return {};
    } } : {}),
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
      descargas?.esperaJuego(+1);                              // §106: el juego espera (si tarda, la barra lo dice)
      try { datos = await disco.leer(direccion(ruta), tam, inicio, largo); }   // bloques de 256 KB, con caché
      catch (e) { escribe('[mkw] ' + e.message); return -1; }
      finally { descargas?.esperaJuego(-1); }
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
    mkwLsArreglos: parametros.has('arreglos') ? (Number(parametros.get('arreglos')) | 0) : RED_ESTADO ? 0 : true,   // (§283: RED_ESTADO, no parametros.get('red'): la línea 90 ya la cambió a «malla» y quedaba la máscara 63) (§269b: ?arreglos=N = la máscara N de semillas_nativo.cpp; 0 = ninguno; §275b: con red=estado, 0 por omisión: cada consola corre su kart y nada se recalcula igual en todas)
    // §179 (G1): con «todo a la vista», el dibujo recorta con las marcas de verdad de mi cámara (?recorteDibujo=0 = no)
    // (2 = el dibujo entero, §179.2; ?recorteDibujo=modelos = 1, solo las opciones de dibujo de los modelos)
    mkwRecorteDibujo: { '0': 0, modelos: 1 }[parametros.get('recorteDibujo')] ?? 2,
    mkwVistaPropia: (parametros.get('vista') === '0' ? 0 : 1) | (parametros.get('camara') === '0' ? 0 : 2),   // ?vista=0 / ?camara=0: sin sonido-HUD / cámara propios (para comparar)   // ?arreglos=0: sin «todo a la vista» (lockstep_nativo.cpp), para comparar
    // …y el plantel (personaje y vehículo de los 12 puestos) que la sala reparte igual a todas (lockstep.mjs)
    mkwPlantel: () => window.mkwPlantel || null,
    mkwMiPuesto: () => window.mkwMiPuesto ?? null,
    // §73: en la sala nueva (humanos de verdad), la única pantalla es la del kart de esta consola (semillas_nativo.cpp)
    mkwPantallaPropia: () => window.mkwPantallaPropia ?? -1,
    mkwUnaPantalla: parametros.get('unaPantalla') !== '0',
    // §91: cuántos mandos de la sala usan un puerto de verdad (4; los demás van por su portador virtual). ?puertos=N
    // (solo pruebas): menos puertos, así con 2 pestañas se prueba el camino de los virtuales
    mkwPuertos: parametros.has('puertos') ? Math.max(0, Math.min(4, Number(parametros.get('puertos')) | 0)) : 4,       // §73: una sola pantalla, la propia (?unaPantalla=0 = la pantalla partida del juego)
    mkwNotaCuentas: parametros.get('notaCuentas') === '1',          // (depurar: cada cálculo de pantallas en la consola)
    // La red del juego (web/red/red_web.cpp → red.mjs): solo con ?red=1; sin ella el juego ve "sin conexión"
    mkwRed: red?.pila,
    // §88: el runtime le pide el sonido a la página (AudioWorklet); sin esto, o con ?audio=viejo, lo abre SDL3
    ...(SONIDO_PAGINA ? { mkwSonido: sonido.puente } : {}),
    preRun: [m => {
      arranque.marcar('compilado');   // (§276: el programa ya compiló e instanció; ahora MEMFS)
      armarArchivos(m, contenidos, tamaños);
      if (parametros.get('soltarChicos') !== '0') contenidos.clear();   // §141 (C9): ya copiados a MEMFS: los 10 MB de aquí sobran (?soltarChicos=0 = guardarlos)
      carpetasVacias.forEach(c => m.FS.mkdirTree(c));
      guardado.restaurar(m.FS, guardados);   // encima de lo que trae el servidor (la partida vacía de RR)
      pipelines.escribir(m.FS, listas);      // aurora las lee al iniciar y las pide en segundo plano
      arranque.marcar('armado');
    }],
    // Ceder sin enganche (vi.cpp, §63): la espera por reloj cuando el cuadro no va enganchado al monitor
    ...(CEDER ? { mkwEsperaReloj: conRitmoJuego(conRitmoMenus(conLastre(esperaReloj))) } : {}),
    // §155: con el lastre de CPU, la espera de aurora a sus búferes de subida (staging_map.hpp) pasa por aquí, así el
    // lastre sabe que es espera y no trabajo (sin esto, con la tarjeta lenta, la contaba como CPU y la multiplicaba).
    // Sin lastre no se ofrece: aurora hace su emscripten_sleep(0) de siempre
    ...(lastreCpu || TRAMO ? { mkwEsperaSubida: medirSubida(conLastre(() => new Promise(r => setTimeout(r, 0)))) } : {}),
    ...(PRESENTA && ESPERA_TOMA ? { mkwEsperaToma: conLastre(ms => relojMonitor.esperaToma(ms)) } : {}),
    ...(PRESENTA && ESPERA_ATRASADA ? { mkwTomaAtrasada: () => relojMonitor.tomaAtrasada(),
                                        mkwEsperaAtrasada: conLastre(() => relojMonitor.esperaAtrasada()) } : {}),
    // Enganche al monitor (vi.cpp en el parche): sin estas tres, el juego sigue con su temporizador como en Node
    ...(ENGANCHE ? {
      mkwVsync: relojMonitor,
      mkwEsperaHasta: conRitmoJuego(conRitmoMenus(conLastre((vencimiento, servicioMs) => fotoQuieta() ? fotoEspera() : relojMonitor.esperaHasta(vencimiento, servicioMs)))),
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
  // §275b.12: «Cada uno su kart» necesita el programa con red_estado_nativo.cpp. Con la página nueva y un .wasm viejo (el
  // de R2 antes de subir el nuevo) la ficha salía en línea (modo 7) sin la red nativa: cada consola corría sola y la tabla
  // del final traía tiempos basura (el 1.º 20:13.886, los demás 00:00.000). Sin las funciones, la sala va con el lockstep
  // de siempre, con sus arreglos (la máscara se lee al empezar cada carrera: semillas_nativo.cpp)
  if (RED_ESTADO_SALA && typeof M._mkw_red_estado_config !== 'function') {
    RED_ESTADO_SALA = false;
    if (!parametros.has('arreglos')) M.mkwLsArreglos = true;
    window.mkwEstado.redEstadoSinPrograma = true;
    console.log('[red-estado] ⚠ el programa no trae «Cada uno su kart» (falta _mkw_red_estado_config): la sala va con el lockstep');
  }
  // §286: mi programa, para el latido de la sala (la anfitriona no larga si otro trae otro): la huella del .wasm que bajó
  // esta página y si trae «Cada uno su kart»
  window.mkwPrograma = `${huellaBuild || 'sin-huella'}${typeof M._mkw_red_estado_config === 'function' ? '+re' : ''}`;
  // Para medir desde afuera (herramientas/medir-sitio.mjs): el contador de cuadros al instante (el del medidor se
  // actualiza una vez por segundo) y la memoria del wasm (el "heap": todo lo que el juego tiene reservado), en MB
  window.mkwCuadros = () => M._mkw_web_cuadros();
  window.mkwHeapMB = () => M.HEAPU8.length / 1048576;
  // §152 (V4): los contadores del motor (solo el programa compilado con -DMKW_CONTADORES, build/web-contadores): cada
  // segundo, cuántas veces por cuadro pasó cada cosa (lecturas y escrituras de la memoria de la Wii y cuántas por el
  // camino lento, accesos «resueltos» y «planos», multiplicaciones-sumas, llamadas indirectas, cambios de fibra, esperas
  // JSPI). ?contadores=1 = prenderlo (con el programa normal no hay nada que leer)
  if (parametros.get('contadores') === '1' && M._mkw_contador) {
    const NOMBRES = ['lee', 'leeLenta', 'escribe', 'escribeLenta', 'resuelta', 'resueltaCae', 'flat', 'fma', 'indirecta', 'fibra', 'esperaJspi'];
    let antes = NOMBRES.map((_, k) => M._mkw_contador(k)), cuadros0 = M._mkw_web_cuadros(), enCarrera0 = !!window.mkwEstado.enCarrera;
    window.mkwEstado.contadores = { porCuadro: null, historia: [] };
    setInterval(() => {
      const ahora = NOMBRES.map((_, k) => M._mkw_contador(k)), cuadros = M._mkw_web_cuadros(), n = cuadros - cuadros0;
      if (n > 0) {
        const porCuadro = Object.fromEntries(NOMBRES.map((k, i) => [k, Math.round((ahora[i] - antes[i]) / n)]));
        const fila = { s: Math.round(performance.now() / 1000), cuadros: n, carrera: enCarrera0 && !!window.mkwEstado.enCarrera, ...porCuadro };
        window.mkwEstado.contadores.porCuadro = fila;
        const h = window.mkwEstado.contadores.historia; h.push(fila); if (h.length > 600) h.shift();
        nota(`[contadores] por cuadro (${n} cuadros${fila.carrera ? ', carrera' : ''}): ` + NOMBRES.map(k => `${k} ${porCuadro[k]}`).join(' · '));
      }
      antes = ahora; cuadros0 = cuadros; enCarrera0 = !!window.mkwEstado.enCarrera;
    }, 1000);
  }
  arranque.marcar('programa');
  // §276, el arranque de prisa: del primer cuadro hasta su primera pantalla, el juego pasa ~255 cuadros (4,3 s a 60
  // por segundo, medido) en su pantalla de arranque (la del aviso de la correa: pide un mínimo de cuadros y que la carga
  // de fondo termine) y ~65 más con la imagen en negro mientras carga la primera sección. Nadie lo ve (lo tapan el menú
  // de inicio o la cortina, o es negro). Mientras dura, la cuadrícula se suelta del monitor y se le pide al motor que se ponga al
  // día sin fin (mkw_prisa, el mismo de la sala y de ?sinTope): corre esos cuadros uno detrás de otro, tan rápido como
  // pueda el aparato. Es como dejar que un motor arranque sin el limitador de velocidad mientras está en el taller:
  // cuando sale a la calle (la primera pantalla), el limitador vuelve. Nada de la carrera cambia: solo el arranque.
  // ?arranqueRapido=0 = a 60, como antes.
  if (parametros.get('arranqueRapido') !== '0' && ENGANCHE && typeof M._mkw_prisa === 'function') {
    arranqueSuelto = true;
    const desde = performance.now(), ganada0 = M._mkw_prisa_ganada?.() ?? 0;
    window.mkwEstado.arranqueRapido = { activo: true, ms: null, ganadaMs: 0, cuadros: null };
    const bomba = setInterval(() => {
      let seccion = -1, pagina = -1;
      try { const e = window.mkwMenus?.estado?.(); seccion = e?.seccion ?? -1; pagina = e?.pagina ?? -1; } catch {}
      // (hasta la primera pantalla activa del juego: mientras la sección carga, la imagen es negra; medido: 65 cuadros)
      const fin = (seccion >= 0 && pagina >= 0) || document.hidden || performance.now() - desde > 20000;
      if (!fin) { M._mkw_prisa(2000); return; }
      clearInterval(bomba);
      M._mkw_prisa(0);
      arranqueSuelto = false;
      const r = window.mkwEstado.arranqueRapido;
      Object.assign(r, { activo: false, ms: Math.round(performance.now() - desde), ganadaMs: Math.round((M._mkw_prisa_ganada?.() ?? 0) - ganada0), cuadros: M._mkw_web_cuadros?.() ?? null });
      arranque.marcar('arranqueDePrisa');
      nota(`arranque de prisa (§276): ${r.cuadros} cuadros en ${r.ms} ms (ganados ${r.ganadaMs} ms de cuadrícula)`);
    }, 100);
    M._mkw_prisa(2000);
  }
  ok('el juego (wasm) cargó', !!M, `${(performance.now() - t1).toFixed(0)} ms`);
  preparacion.marcar('programa');
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
    if (w) descargas?.programaListo(w.name, w.decodedBodySize, w.encodedBodySize);   // §106: la próxima vez, sin contarlo
    if (w) nota(`programa: llegó en ${(w.responseEnd - w.startTime).toFixed(0)} ms (${(w.transferSize / 1048576).toFixed(1)} MB por la red` +
                `${w.transferSize === 0 ? ', de la caché' : ''}), listo ${(listo - w.responseEnd).toFixed(0)} ms después`);
  }
  window.mkw = M;
  // §229 (N11, la puerta): ?n11=MBIT = la imagen del juego en video por WebRTC a un receptor en esta misma página (solo
  // para medir lo que pediría mandarla a un teléfono; n11-video.mjs). Nunca en la sala
  { const o = n11DeParametros(parametros); if (o && !parametros.get('sincro')) window.mkwEstado.n11 = instalarN11({ lienzo: document.getElementById('canvas'), opciones: o, nota }); }
  // §162: el lastre por cuadro del runtime (repartoLastre); un programa viejo sin la función = sin él (se avisa)
  if (LASTRE_REPARTO.cuadro > 1) {
    if (typeof M._mkw_lastre_cuadro === 'function') { M._mkw_lastre_cuadro(LASTRE_REPARTO.cuadro); nota(`lastre por cuadro (§162): K = ${LASTRE_REPARTO.cuadro}`); }
    else nota('lastre por cuadro (§162): este programa no lo tiene (falta recompilar)');
  }
  // §259 (W31, instrumento): ?w31=contar|quietos|repetidas|todas (o 1–4) = aurora cuenta las listas de dibujo del juego
  // (cuántas, cuántas se repiten con los mismos bytes, cuántas son de objetos quietos —además las mismas matrices— y el
  // tiempo de traducirlas); quietos/repetidas/todas = el TECHO: se salta los dibujos de esas listas (la imagen pierde
  // esos objetos; solo para medir lo más que ganaría guardar la traducción). Con ?tramo, los contadores son del tramo
  const W31_MODOS = { '0': 0, contar: 1, quietos: 2, repetidas: 3, todas: 4, '1': 1, '2': 2, '3': 3, '4': 4 };
  const modoW31 = W31_MODOS[parametros.get('w31') ?? ''];
  if (modoW31 && M._mkw_web_w31) { M._mkw_web_w31(-1); M._mkw_web_w31(modoW31); }
  window.mkwEstado.w31 = () => {
    const d = M._mkw_web_w31_dato; if (!d || !d(9)) return null;
    const im = Math.max(1, d(0)), r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;
    return { modo: d(9), imagenes: d(0), listasPorImagen: r2(d(1) / im), kbPorImagen: r2(d(2) / im),
      repetidas: r3(d(3) / Math.max(1, d(1))), quietas: r3(d(4) / Math.max(1, d(1))),
      msListasPorImagen: r3(d(5) / im), msRepetidasPorImagen: r3(d(6) / im), msQuietasPorImagen: r3(d(7) / im),
      msHuellasPorImagen: r3(d(12) / im), dibujosListaPorImagen: r2(d(10) / im),
      dibujosQuietosPorImagen: r2(d(11) / im), dibujosRepetidosPorImagen: r2(d(13) / im), saltadosPorImagen: r2(d(8) / im) };
  };
  // §163: el tramo fijo: mirar el contador de lógica cada 2 ms hasta pasar «hasta»
  if (TRAMO) {
    const ec = M._mkw_lastre_cuadro_estado;
    const tramo = crearTramo({ ...TRAMO, leer: () => {
      let logica = null;
      try { const L = window.mkwMenus, ri = L?.u32(0x809BD730), et = ri ? L.u32(ri + 0x28) : -1; if (ri && et >= 0 && et <= 2) logica = L.u32(ri + 0x20); } catch {}
      return { logica, imagenes: M._mkw_web_cuadros(), esperaRuntime: M._mkw_web_ms_espera(), esperaSubida: esperaSubidaMedida.ms,
        giro: (LASTRE_REPARTO.cuadro > 1 && ec ? ec(0) : 0) + (lastreCpu?.estado.ms ?? 0) };
    } });
    window.mkwEstado.tramo = { ...TRAMO, empezo: false, resultado: null };
    // §224 (W22): ?censoGpu=1 = el censo de las llamadas a WebGPU (censo-gpu.mjs) apenas empieza el tramo: el tiempo de
    // la ráfaga de cada imagen, cuántas llamadas de cada método, cuántas se repiten iguales y el ensayo (instrumento)
    if (parametros.get('censoGpu') === '1' && globalThis.GPUCommandEncoder) {
      window.mkwEstado.censoGpu = instalarCensoGpu({ empezar: () => window.mkwEstado.tramo?.empezo,
        alTerminar: (r, fallo) => nota(`censo (§224): ${fallo ? 'falla ' + fallo : JSON.stringify({ ...r, porMetodo: undefined })}`) });
    }
    // §164: con ?perfilGpu=1, las marcas de la tarjeta (§115) cubren justo el tramo: se prenden al pasar «desde» y se
    // apagan al pasar «hasta»; la tarjeta por imagen = la suma de todas las pasadas medidas ÷ las imágenes del tramo
    const conTarjeta = !!(perfilGpu && PERFIL_TIEMPOS);
    let tarjeta0 = null, w31Reiniciado = false;
    const totalTarjeta = () => perfilGpu.tiempos().reduce((a, x) => a + x.ms * x.veces, 0);
    const reloj = setInterval(() => { const r = tramo.tic(); window.mkwEstado.tramo.empezo = tramo.empezo;
      if (modoW31 && tramo.empezo && !w31Reiniciado) { w31Reiniciado = true; M._mkw_web_w31?.(-1); }   // (§259)
      if (conTarjeta && tramo.empezo && !tarjeta0) { tarjeta0 = { prendido: perfilGpu.medirTiempos(true), imagenes: M._mkw_web_cuadros() }; }
      if (!r) return;
      clearInterval(reloj);
      if (modoW31) r.w31 = window.mkwEstado.w31();   // (§259: las listas de dibujo del tramo)
      const terminar = () => { window.mkwEstado.tramo.resultado = r; nota(`tramo (§163): ${JSON.stringify(r)}`); };
      if (!conTarjeta || !tarjeta0?.prendido) { if (conTarjeta) r.tarjeta = { fallo: perfilGpu.fallo || 'sin timestamp-query' }; terminar(); return; }
      const imagenes = M._mkw_web_cuadros() - tarjeta0.imagenes;
      perfilGpu.medirTiempos(false);
      // (las últimas lecturas de la tarjeta llegan un poco después: 500 ms de gracia)
      setTimeout(() => {
        const ms = totalTarjeta();
        r.tarjeta = { msPorImagen: imagenes > 0 ? Math.round(ms / imagenes * 1000) / 1000 : null, msTotal: Math.round(ms), imagenes,
          pasadas: perfilGpu.tiempos().slice(0, 5).map(t => `#${t.n} ${t.tam}: ${t.ms} ms ×${t.veces}`) };
        // la CPU por imagen (trabajo + giro de cada cuadro de lógica × cuadros de lógica por imagen), para ver cuál pone el techo
        r.cpuMsPorImagen = Math.round((r.porCuadro.trabajo + r.porCuadro.giro) * r.logicaPorSeg / Math.max(0.01, r.imagenesPorSeg) * 1000) / 1000;
        r.techo = r.tarjeta.msPorImagen > r.cpuMsPorImagen ? 'tarjeta' : 'CPU';
        terminar();
      }, 500);
    }, 2);
  }
  // §161 (?sinTope=1): durante la carrera, «ponerse al día» sin fin (2 s de cuadrícula cada 100 ms, el tope del runtime);
  // fuera de la carrera, nada (los menús a su ritmo: el piloto de la página los recorre con sus tiempos)
  if (SIN_TOPE && typeof M._mkw_prisa === 'function') {
    const bomba = crearBomba({ prisa: (ms) => M._mkw_prisa(ms), enCarrera: () => !!window.mkwEstado.enCarrera });
    window.mkwEstado.sinTope = { activo: true, get prisa() { return bomba.ultima; } };
    // §162.2: en la carrera sin tope, el lastre por cuadro cuenta también lo cedido al navegador (ahí no hay esperas de
    // verdad, solo turnos para la página: su trabajo también sería K veces más lento); en los menús, como siempre
    const todo = typeof M._mkw_lastre_cuadro_todo === 'function' ? M._mkw_lastre_cuadro_todo : null;
    setInterval(() => { const ms = bomba.tic(); todo?.(ms > 0 ? 1 : 0); }, 100);
  }
  // En qué pantalla está el juego (menus.mjs: lee la memoria de la Wii; para elegir pista o copa desde la página)
  window.mkwMenus = crearLector(M);
  // depuración: el punto de vigilancia de escritura (solo en el build con -DMKW_VIGIA, §62): mkwVigiar(desde, tamaño)
  window.mkwVigiar = (desde, tam) => (M._mkw_vigia_poner ? (M._mkw_vigia_poner(desde >>> 0, tam >>> 0), true) : false);
  // pruebas (§72): dar por terminada la carrera en línea de los pilotos de esta pestaña (como si cruzaran la meta)
  window.mkwTerminarCarrera = () => (M._mkw_modos_terminar ? (M._mkw_modos_terminar(), true) : false);
  // §86: las caras de los Mii invitados del juego (invitados.mjs): las de este navegador o, si no hay, se las pide al
  // juego (las saca en su próximo cuadro de menú). La usa «Mi Mii» (interfaz.mjs); { forzar: true } = del juego siempre
  window.mkwInvitados = { sacar: (opciones = {}) => asegurarInvitados(M, { nota, ...opciones }) };
  // §88: cuánto tarda en oírse lo que el juego mezcla (un clic de prueba con el juego mudo ~3 s; sonido.mjs)
  window.mkwMedirDemora = opciones => sonido.medirDemora(M, opciones);
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
  // §92: la Contrarreloj contra el mejor fantasma de la página (fantasma-pagina.mjs + fantasma_pagina_nativo.cpp): en la
  // pantalla de fantasmas se baja el del mejor tiempo de la tabla y el juego corre contra él. ?fantasmaPagina=0: el de RR
  if (parametros.get('fantasmaPagina') !== '0' && M._mkw_fantasma_pagina_poner) {
    fantasmaPagina = crearFantasmaPagina({ lector: window.mkwMenus, modulo: M, fs: M.FS,
      carpetaMod: '/datos/WiiCompiled/NAND/shared2/Pulsar/RetroRewind6', nota,
      // §147 (D12): los fantasmas de la tabla, de a 3 con tope de 4 s cada uno; ?fantasmaParalelo=0 = de a uno sin tope
      ...(parametros.get('fantasmaParalelo') === '0' ? { aLaVez: 1, topeMs: 1e9 } : {}),
      aviso: f => ui.aviso(`Fantasma: el mejor de la página — ${f.nombre}, ${textoTiempo(f.ms)}`) });
    if (conexionRecords) fantasmaPagina.conectar(conexionRecords);
    window.mkwFantasmaPagina = fantasmaPagina;
  }
  // (lo de los fantasmas va fuera de la llamada del juego: baja de la red y vuelve a llamar al juego)
  // §270 (el dueño: «que el limitador no funcione tampoco en los menús de personaje»): el tope de «Imagen» (N8: 30
  // parejas o con imagen intermedia) vale también en elegir personaje, vehículo y derrape. El juego avisa cada pantalla
  // que se activa: si es una de esas, N8 queda permitido fuera de la carrera; si es otra, no (en el mismo cuadro: el
  // aviso llega antes del dibujo). ?n8Menus=0 = solo en la carrera (antes); ?n8Menus=todos = en todos los menús (pruebas)
  const N8_MENUS = parametros.get('n8Menus') ?? '1', PAGINAS_N8 = new Set([0x6B, 0x6C, 0x6D, 0x10E]);
  // (medido: la pantalla de personaje tiene varias pantallas apiladas y cada una avisa al activarse; si decidía la última
  // en avisar, el permiso se prendía y se apagaba en el mismo cuadro. Se decide con TODA la pila de pantallas del juego:
  // al activarse una —la de llegada ya está en la pila— y cada medio segundo por si una se cierra sin avisar)
  let n8MenusAntes = null;
  let n8AlCambiarMenus = null;   // §273: Automático cambia de modo al entrar y salir de elegir personaje (más abajo)
  const n8MenusRevisar = (id = null) => {
    if (!M._mkw_n8_menus || N8_MENUS === '0') return;
    const pila = window.mkwMenus?.estado?.().paginas || [];
    const si = N8_MENUS === 'todos' || PAGINAS_N8.has(id) || pila.some(p => PAGINAS_N8.has(p));
    if (si !== n8MenusAntes) { M._mkw_n8_menus(si ? 1 : 0); n8MenusAntes = si; window.mkwEstado.n8Menus = si; n8AlCambiarMenus?.(); }
  };
  const n8MenusAlActivar = dir => n8MenusRevisar(window.mkwMenus?.u32(dir + 4));
  if (N8_MENUS !== '0') setInterval(() => n8MenusRevisar(), 500);
  M.mkwAlActivarPagina = dir => { if (ocultarActivo) ocultar.alActivar(dir); alActivarInicio(dir); n8MenusAlActivar(dir);
    if (fantasmaPagina) { const id = window.mkwMenus.u32(dir + 4); setTimeout(() => fantasmaPagina.alActivarPagina(id), 0); } };
  // Récords (records.mjs): al terminar cada carrera, el tiempo final (leído del juego) queda como récord personal de
  // esa pista y categoría (modo + cc). Con sesión en el sitio, también va a la tabla de Firebase: la página del sitio
  // llama window.mkwConectarRecords({ almacen: almacenRtdb({ rtdb, db }), uid, nombre }).
  vigilarCarreras({ lector: window.mkwMenus, hay: RELOJES_LIVIANOS ? () => hayCarrera : null, alTerminar: async c => {
    const r = await records.registrar(c);
    if (r.nube === 'subido') fantasmaPagina?.alTerminar(c);       // §92: su fantasma, para que otros corran contra él
    window.mkwEstado.ultimoTiempo = { ...c, ...r };
    const cat = NOMBRE_CATEGORIA(c.cat);
    if (window.mkwSincro && c.cat?.startsWith('vs')) return;   // (M22: en la sala no se avisa: lo tapaba el VR, y al revés)
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
    // PLAN M20 (solo para medir, herramientas/medir-cpu-niveles.mjs): &soloCpu=1 = las 12 en CPU, también el puesto 1, para
    // medir lo rápidas que son por nivel sin el «elástico» que las ajusta según dónde va el humano
    if (parametros.get('soloCpu') === '1' && !sincro) ficha.puestos[0] = { ...ficha.puestos[0], tipo: 1, mando: -1 };
    // §229 (N11, solo para medir): &vistas=2 = la pantalla partida de dos (la vista que un PC dibujaría de más para un
    // teléfono); el segundo puesto también es un humano de esta consola. El juego da pantalla solo a las personas
    // (directo_nativo.cpp): las dos quedan quietas en la largada (sin mando) y las otras 10 son CPU; &soloCpu no vale aquí
    if (parametros.get('vistas') === '2' && !sincro) {
      ficha = armarFicha({ ...datosFicha, humanos: [...datosFicha.humanos, { personaje: 1, vehiculo: 1, mando: 1 }] });
      ficha.pantallas = 2;
    }
    window.mkwEstado.ficha = ficha;
    // §205 (W9): sin la sala, ?azarFijo=1 = las semillas del azar de la carrera (RacedataScenario::InitRng) salen de la
    // ficha y no del reloj: dos pestañas con la misma semilla corren la misma carrera (prueba-foto-igual.mjs). No es
    // ?reloj=fijo: ese reloj lo hace avanzar el lockstep de la sala, y sin sala la carrera no arranca
    if (!sincro && azarFijo(parametros.get('azarFijo'))) window.mkwSemillaCarrera = ficha.semilla;
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
    window.mkwNombresSala = nombres;   // (M22: los avisos de la carrera dicen el nombre, no «jugador 2»)
    // la cilindrada de cada carrera ('azar' = como Retro Rewind: 10 % 200cc, 65 % 150cc, 25 % espejo, sorteada con la
    // semilla de la sala: igual en todas). §84: 'c100' es la cilindrada 100cc del juego, que Retro Rewind corre como
    // 200cc (y 'c50' como su «500cc»): medido con el juego, el sitio la llama 200cc.
    // M20 (§96, el dueño): el nivel de la CPU es un ajuste propio de la sala, aparte de la cilindrada (en las carreras VS
    // del juego son dos ajustes separados; solo el Grand Prix los ata): &cpu=maximo|dificil|normal|facil, máximo si no
    // viene
    const ccDe = n => {
      const cc = parametros.get('cc') || 'c150';
      if (cc !== 'azar') return cc;
      const x = Math.imul((semillaSala ^ Math.imul(n, 0x9E3779B9)) >>> 0, 0x85EBCA6B) >>> 0, r = x % 100;
      return r < 10 ? 'c100' : r < 75 ? 'c150' : 'espejo';
    };
    const cpuDe = () => parametros.get('cpu') || 'maximo';
    window.mkwPantallaPropia = sincro.miPuesto;
    // la sala del sitio (marco de Juegos) avisa los nombres de los pilotos (para la tabla) y, si el anfitrión se va,
    // quién manda ahora (la copa sigue con él, sin recargar)
    addEventListener('message', ev => {
      const d = ev.data;
      if (ev.source !== window.parent || ev.origin !== location.origin || d?.canal !== 'mkw-padre') return;
      if (d.tipo === 'nombres' && d.nombres && typeof d.nombres === 'object') {
        nombres = Object.fromEntries(Object.entries(d.nombres).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.slice(0, 20)]));
        window.mkwNombresSala = nombres;
        window.mkwNombresAlJuego?.();                    // (M22: y al juego, para la carrera siguiente)
      }
      else if (d.tipo === 'anfitrion' && typeof d.uid === 'string') window.mkwSala?.cambiarAnfitrion(d.uid);
      // §110: la lista de pilotos de la sala del sitio creció (alguien llegó con la copa andando): a la sala del juego,
      // que lo anota (la anfitriona) y lo hace correr desde la carrera en que ya dé señales
      else if (d.tipo === 'sincro' && Array.isArray(d.sincro)) window.mkwSala?.sumar(d.sincro.filter(u => typeof u === 'string').slice(0, 12));
      // (§103b: el TURN ya no llega por aquí como reserva automática, §99; solo lo pide el modo «🛰 Todo por Cloudflare»,
      // que lo escucha él mismo al armar la malla. Un sitio viejo que lo siga mandando no cambia nada: como en BT3)
      // §87: los pilotos que salieron de la sala del sitio (echados por el anfitrión, por votación o idos): la carrera en
      // curso los corta ya (sin esperar 2 s de silencio) y la sala no los cuenta en las que vienen
      else if (d.tipo === 'fuera' && Array.isArray(d.uids)) {
        const e = window.mkwSala?.estado();
        for (const u of d.uids) {
          const h = sincro.humanos.find(x => x.uid === u);
          if (!h || u === sincro.yo || !window.mkwSala?.quitar(u)) continue;
          if (e?.fase === 'correr' && e.carrera >= 1) saltarArbitro(h.mando, e.carrera);
          nota(`sala: ${nombres[u] || u} salió de la sala`);
        }
      }
    });
    let primeraVista = true, miEleccion = null, pickerAbierto = false, reloj = null, vigiaFin = null;
    // M22 (pedido del dueño): volver a elegir personaje y vehículo en el descanso, si uno quiere: { carrera, estado:
    // 'eligiendo' | 'listo' }. La pantalla de personajes del juego se abre por código (directo.elegir, como al empezar la
    // copa); lo elegido va a la anfitriona (sala.elegi) y corre desde la carrera siguiente, igual en todas las consolas.
    // Si el descanso termina antes de confirmar, la carrera abre igual (el salto a la carrera apaga el modo elección) con
    // el de antes.
    let reeleccion = null;
    window.mkwEstado.reeleccion = null;
    // M22: los letreros con la letra del juego (letreros.mjs: el ±VR al lado de la tabla, el podio, el cartel de quien
    // recargó) y el VR de cada humano en toda la copa (uid → { antes, despues }: para el podio)
    let letreros = null, podioPuesto = false;
    const vrCopa = {};
    // §74: los selectores abiertos de la playlist (el del anfitrión, el de sugerir) y el panel de entre carreras
    let selLista = null, selSug = null, breve = null;
    // §87: un selector abriéndose. elegirPista espera los nombres de las pistas (con un perfil nuevo, bajados por la red)
    // antes de dar su control (alAbrir): los estados que llegan mientras tanto veían selSug vacío y abrían OTRO. Al
    // confirmar la playlist se cerraba uno y el otro quedaba encima de la pantalla de personaje (los demás no seguían)
    let abriendoSug = false, abriendoEntre = false;
    const carrerasPedidas = Math.max(1, Math.min(32, Number(parametros.get('carreras')) || 4));
    // los nombres de las pistas se leen de la memoria del juego (lento): una vez
    let copasLeidas = null;
    const copasSala = () => copasLeidas || (copasLeidas = leerNombres(window.mkwMenus, M));
    let desde = 0;                                  // §75: la primera carrera de la copa que corrió esta consola
    // §94: el descanso entre carreras (30 s; ?descanso=N s = otro, solo pruebas: la copa de las pruebas no espera tanto)
    const descanso = parametros.has('descanso') ? Math.max(1, Number(parametros.get('descanso')) || SEGUNDOS_RESULTADOS) : SEGUNDOS_RESULTADOS;
    const sala = window.mkwSala = crearSalaCarrera({ yo: sincro.yo, humanos: sincro.humanos, base: sincro.base, anfitrion: jefe, estilo,
      carreras: carrerasPedidas, pistas: cola, segundosResultados: descanso,
      // §269: otra consola de la sala con otra versión de la página (una con la vieja en caché): se avisa fijo en las dos
      alVersion: (uid, que) => { const n = (typeof nombres !== 'undefined' && nombres?.[uid]) || 'Otro jugador';
        const t = que === 'mia' ? '⚠ Tu página es una versión vieja del juego: recarga con Ctrl+Mayús+R (en el celular: borra la caché del sitio) para jugar con los demás'
          : `⚠ ${n} tiene una versión vieja del juego: que recargue con Ctrl+Mayús+R (si no, la carrera puede fallar)`;
        escribe('[sala] ' + t); try { ui.aviso(t, true); } catch {} },
      servidor: quiereOracle ? () => enlaceOracle?.vivo() : null,
      programa: () => window.mkwPrograma || null,   // (§286: la anfitriona no larga con programas distintos)
      // N12 (§233): cómo le fue a este aparato en su última carrera, en el latido (?comoLento=L = decir L cuadros de lógica
      // por segundo, el aparato lento de mentira: solo pruebas)
      capacidad: () => !ESCALON ? null : parametros.has('comoLento') ? { l: Number(parametros.get('comoLento')) || 30, ms: 33 } : capacidadLatido(leerCapacidad()),
      // M22: la copa con reloj (?copaReloj=N s solo para las pruebas; 0 = sin reloj); al vencer, una al azar
      segundosCopa: parametros.has('copaReloj') ? Math.max(0, Number(parametros.get('copaReloj')) || 0) : undefined,
      // §99: y el reloj de la copa empieza recién cuando el navegador de la anfitriona está preparado (la lista abierta)
      esperarListo: parametros.get('preparacion') !== '0',
      alVencioCopa: () => {
        if (!window.mkwSala?.soyAnfitrion) return;
        const cs = copasSala(), n = Array.isArray(cs) ? cs.length : 0;
        // (§100: si alguien pidió una, la más pedida; si no, una al azar)
        const pedida = copaMasPedida(window.mkwSala.estado().pedidas, sincro.humanos);
        const c = pedida >= 0 && (!n || pedida < n) ? pedida : n ? Math.floor(Math.random() * n) : 0;
        nota(`sala: se acabó el tiempo de elegir la copa: sale la copa ${c} ${pedida === c ? '(la más pedida)' : 'al azar'}`);
        // (primero la copa: la fase pasa a «elegir» y el selector se cierra solo sin volver a abrirse)
        window.mkwSala.ponerPistas([0, 1, 2, 3].map(f => ({ copa: c, fila: f })));
      },
      enviar: (u, b) => red?.malla?.enviar(u, b, 'tcp'), alCambiar: e => alCambiarSala(e),
      alPausaNo: m => window.mkwAutoCalibrar?.alPausaNo(m),   // (§274: la anfitriona no dio la pausa de la auto calibración)
      // §75: otro avisa que se salta la carrera k (recargó la página): que la carrera sincronizada no lo espere
      alSalta: (uid, k) => { const h = sincro.humanos.find(x => x.uid === uid); if (h) saltarArbitro(h.mando, k); },
      // §100: la anfitriona que se fue se reemplaza a los 4 s (sin esperar al sitio)
      ido: consolaSeFue,
      registro: t => red?.registro?.push(new Date().toISOString().slice(11, 23) + ' ' + t) });
    window.mkwEstado.sala = sala.estado();
    window.mkwNombreDe = u => nombres[u] || `Jugador ${sincro.humanos.findIndex(h => h.uid === u) + 1}`;   // (§274: el aviso de la pausa)
    // §99: el navegador quedó preparado: el reloj de la copa puede correr (si es la anfitriona) y se vuelve a mirar la
    // sala (abre la lista de copas). Solo si la sala ya sabe en qué va: la primera vista es la que detecta a quien recargó
    // (§269b.14, solo pruebas: ?cargaLenta=ms = esta consola avisa «cargué» ms más tarde, como un teléfono que tarda)
    const cargaLenta = Math.max(0, Number(parametros.get('cargaLenta')) || 0);
    const yaCargue = () => { sala.copaLista(); if (sala.lista) alCambiarSala(sala.estado()); };
    window.mkwAlPreparada = () => { if (cargaLenta) setTimeout(yaCargue, cargaLenta); else yaCargue(); };
    if (preparada()) window.mkwAlPreparada();
    // §100 (H1.2, la prueba de conexión): cada 2 s, cómo llega cada piloto (🟢 directa, 🛰 por el repetidor, 🔴 por otro
    // o sin conexión). Los 🔴 salen en la esquina; la lista entera va al vestíbulo del sitio, que pone el ícono al lado
    // de cada piloto de la tira. ?conexiones=0 = sin ella
    if (parametros.get('conexiones') !== '0') {
      const nombreCon = u => nombres[u] || `Jugador ${sincro.humanos.findIndex(h => h.uid === u) + 1}`;
      const quienes = () => { const fuera = new Set(sala.estado().fuera || []); return sincro.humanos.map(h => h.uid).filter(u => u !== sincro.yo && !fuera.has(u)); };
      window.mkwConexiones = crearConexiones({ sala, quienes,
        // (§127: en la carrera, getStats de a un piloto por vuelta y avisos solo si cambia el estado; ?conexionesRueda=0 = no)
        enCarrera: () => parametros.get('conexionesRueda') !== '0' && hayCarrera,
        malla: { sano: u => !!red?.malla?.sano(u), camino: u => red?.malla?.camino(u) ?? Promise.resolve(null) },
        alCambiar: lista => {
          window.mkwEstado.conexiones = lista;
          ui.chip('conexion', avisoConexiones(lista, nombreCon), true);
          if (window.parent !== window) try {
            window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'conexiones',
              de: Object.fromEntries(lista.map(c => [c.uid, { e: c.e, ms: c.ms ?? null, por: c.por || null }])) }, location.origin);
          } catch {}
        } });
    }
    // §94: después de una carrera, los botones de la persona llegan al juego en la carrera y en sus resultados (páginas
    // 0x0E y 0x2F), no más allá: con A en la tabla de puntos (0x30) el juego abría su menú de «carrera siguiente»
    // (0x22), elegía pista por su cuenta y largaba otra carrera fuera de la sala (medido: a los ~11 s de apretar A).
    // Con el descanso de 30 s pasaba seguro. El juego queda en la tabla hasta que la sala abre la siguiente
    const PAGINAS_LIBRES = new Set([0x0E, 0x2F]);
    // §99 (bug que encontró el dueño): en la sala nadie vuelve atrás ni se sale de las pantallas que tocan. Start nunca
    // llega al juego (la pausa de la carrera tiene «Salir»; con la carrera sincronizada la pausa de uno llega a todas las
    // consolas; y Esc del teclado es Start) y B no llega en la primera pantalla de personajes (sección 0x49, página 0x6B:
    // ahí B vuelve al menú del juego). Dentro de la elección B sí sirve (del vehículo al personaje, del derrape al
    // vehículo). ?atras=1 = sin filtro (solo pruebas)
    const PAGINA_PERSONAJES = 0x6B;
    if (parametros.get('atras') !== '1') controles.filtro(() => {
      const est = window.mkwMenus?.estado?.();
      return BOTON.START | (est && est.seccion === 0x49 && est.pagina === PAGINA_PERSONAJES ? BOTON.B : 0);
    });
    controles.cerrojo(() => {
      if (reeleccion?.estado === 'eligiendo') return false;        // (M22: en la pantalla de personajes del descanso)
      const L = window.mkwMenus, ri = L?.u32(0x809BD730);
      if (!ri || L.u32(ri + 0x28) < 4) return false;              // (en la carrera manda la carrera sincronizada)
      return !PAGINAS_LIBRES.has(L.estado().pagina);
    });
    // §82: el VR de la sala (vr-sala.mjs; el juego no lo calcula: para él son carreras sin conexión). Cada página le
    // dice a la anfitriona el VR que tiene —el asentado: mientras corre una carrera, el de antes de empezarla— y ella los
    // congela al empezar cada carrera (todas cuentan con los mismos). Al abrir la carrera queda guardado (aquí y en
    // Firebase, vr.mjs) el peor caso: perder contra todos, que es lo que vale si la página se cierra o se recarga a mitad
    // de carrera (para los demás, se cortó). Al terminarla, el de verdad, con los puestos que da el juego. Cada página
    // guarda solo el suyo. ?vr=0 = el VR no se mueve en la sala
    const conVr = parametros.get('vr') !== '0';
    // (la copia local del VR, la de esta cuenta: el sitio la conecta con Firebase después, con el mismo uid)
    if (!vr.conNube) vr.conectar({ uid: sincro.yo });
    let vrEnCarrera = null;                         // { n, base, br, nivelCpu, regla } mientras corre la carrera n
    const vrAsentado = () => vrEnCarrera ? vrEnCarrera.base : (vr.actual?.vr ?? VR_INICIAL_SALA);
    window.mkwAvisosVr = [];
    if (conVr) setInterval(() => { if (sala.lista && sala.estado().vrs?.[sincro.yo] !== vrAsentado()) sala.miVr(vrAsentado()); }, 1000);
    // §95: las CPU cuentan para el VR (al VR fijo de su nivel, el de la ficha, y con la regla congelada por la
    // anfitriona: igual en todas las consolas)
    function vrEmpieza(e, n, ficha) {
      if (!conVr) return;
      vrEnCarrera = null;                           // (la anterior sin terminar —me salí, me cortaron—: vale lo guardado)
      const vrs = vrsDeCarrera(e, n);
      const corren = sincro.corren.filter(h => !(e.fuera || []).includes(h.uid)).map(h => ({ uid: h.uid, vr: vrs[h.uid] }));   // (§110: los de esta carrera)
      if (corren.length < 2 || !corren.some(h => h.uid === sincro.yo)) return;
      const cpus = (ficha?.puestos || []).filter(q => q.tipo === 1).map(() => ({ cpu: true, puesto: 0 }));
      // (§99: el nivel de la ficha; sin él, las CPU no cuentan —antes valía «máximo»—)
      const nivelCpu = Number.isInteger(ficha?.cpu) ? ficha.cpu : null, regla = reglaCpuDe(e, n);
      const base = vrAsentado(), br = vr.actual?.br ?? VR_INICIAL_SALA;
      const peor = aplicarCambio(base, peorCaso(sincro.yo, [...corren, ...cpus], { nivelCpu, regla }));
      vrEnCarrera = { n, base, br, nivelCpu, regla };
      window.mkwEstado.vr = { carrera: n, antes: base, peor, cpus: cpus.length, nivelCpu, regla };
      vr.informar({ vr: peor, br }).then(r => nota(`[vr] carrera ${n}: guardado el peor caso ${peor} (antes ${base}) → ${r.nube}`));
    }
    // §94: lo que cambió el VR de cada humano en la carrera n (uid → {antes, despues}; para el panel del descanso)
    let vrDeCarrera = null;
    function vrTermina(e, n) {
      if (!vrEnCarrera || vrEnCarrera.n !== n) return;
      const { base, br, nivelCpu, regla } = vrEnCarrera;
      vrEnCarrera = null;
      // quiénes corrieron (sin los que quedaron fuera desde el principio: la sala, o cortados en el cuadro 0) y quiénes
      // se cortaron a mitad (la carrera sincronizada; yo, si me salí o me cortaron: pierdo contra todos)
      const est = sincro.lockstep?.estado() || {}, cortes = est.cortes || {};
      const fuera = [...(e.fuera || []), ...sincro.humanos.filter(h => cortes[h.mando] === 0).map(h => h.uid)];
      const cortados = sincro.humanos.filter(h => cortes[h.mando] > 0).map(h => h.uid);
      if (est.fuera || est.cortado) cortados.push(sincro.yo);
      // (§275b: en «Cada uno su kart» no hay lockstep: se fue el humano que el juego terminó con el respaldo —su consola
      // dejó de avisar—; bit i = el puesto i, en el orden de los que corren)
      if (RED_ESTADO_SALA) { const m = M._mkw_red_estado_fin?.(3) ?? 0;
        correnEn(sincro.humanos, e, n).forEach((h, i) => { if ((m >> i & 1) && !cortados.includes(h.uid)) cortados.push(h.uid); }); }
      // §99 (VR v2): quien no tocó nada 30 s seguidos en el primer minuto es un «ausente» (la regla del juego en línea):
      // cuenta como cortado (sin esto una cuenta alterna quieta juntaba VR). Los botones son los de la carrera: el mismo
      // número en todas las consolas
      const ausentes = sincro.humanos.filter(h => (est.quieto?.[h.mando] ?? 0) >= 1800 && !cortados.includes(h.uid) && !fuera.includes(h.uid)).map(h => h.uid);
      cortados.push(...ausentes);
      // §99: el nivel que de verdad corrió (el que dice el gancho nativo); si no es el pedido (un programa viejo), las
      // CPU no cuentan para el VR
      const aplicado = typeof M._mkw_cpu_estado === 'function' && M._mkw_cpu_estado(7) === 1 ? M._mkw_cpu_estado(2) : -1;
      const nivelVr = aplicado === nivelCpu ? nivelCpu : null;
      const corredores = corredoresDelJuego(window.mkwMenus, correnEn(sincro.humanos, e, n), { vrs: vrsDeCarrera(e, n), fuera, cortados });
      const cambios = cambiosVr(corredores, { nivelCpu: nivelVr, regla });
      const cambio = corredores.some(c => c.uid === sincro.yo) ? cambios[sincro.yo] : 0;
      const final = aplicarCambio(base, cambio);
      // (§94: el de todos, con los mismos números en todas las consolas; el mío con mi VR asentado)
      const todos = {};
      for (const c of corredores) if (c.uid) todos[c.uid] = c.uid === sincro.yo ? { antes: base, despues: final }
        : { antes: aplicarCambio(c.vr, 0), despues: aplicarCambio(c.vr, cambios[c.uid] || 0) };
      vrDeCarrera = { n, todos };
      for (const [u, v] of Object.entries(todos)) { vrCopa[u] ??= { antes: v.antes }; vrCopa[u].despues = v.despues; }   // (M22)
      const texto = `VR ${base} → ${final} (${final >= base ? '+' : '−'}${Math.abs(final - base)})`;
      window.mkwEstado.vr = { carrera: n, antes: base, despues: final, cambio: final - base, corredores, nivelCpu, nivelVr, ausentes, regla,
        cortes: { ...cortes }, quieto: est.quieto || {} };   // (§100: por qué cuenta cada uno como cortado, para las pruebas)
      if (window.mkwAvisosVr.length < 200) window.mkwAvisosVr.push(texto);
      // (M22, avisos por capas: el VR ya no va en la píldora del centro —tapaba la tabla—: va al lado de tu fila de la
      // tabla del juego y en el zócalo del descanso)
      if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'vr', vr: final }, location.origin);
      vr.informar({ vr: final, br }).then(r => nota(`[vr] carrera ${n}: ${texto} → ${r.nube}`));
    }
    // §75 (pruebas): terminar la carrera de los humanos en el cuadro `cuadro` de la carrera sincronizada, el mismo en
    // todas las consolas (cada pestaña lo pide con el mismo número): el juego da los puestos y los puntos de verdad.
    // puestos = solo esos (por ejemplo [0]: A llega y B no; sin puestos, todos)
    window.mkwTerminarEn = (cuadro, n = sincro.lockstep?.estado().carrera, puestos = null) => {
      if (!sincro.lockstep || !M._mkw_sala_terminar) return false;
      const mascara = Array.isArray(puestos) ? puestos.reduce((m, i) => m | (1 << i), 0) : 0;
      // (§275b «Cada uno su kart»: no hay cuadros comunes; cada consola termina en el momento, a la vez si se pide a la vez)
      if (RED_ESTADO_SALA) { M._mkw_sala_terminar(mascara); return true; }
      sincro.lockstep.enCuadro(n, cuadro, () => M._mkw_sala_terminar(mascara));
      return true;
    };
    // §75: el tiempo límite de la carrera (el del juego en línea, el de Retro Rewind; lockstep_nativo.cpp): quien no
    // llegó a la meta cuando el reloj de la carrera lo pasa termina con un tiempo estimado. ?limite=N segundos = otro
    // (solo pruebas: esperar 5 minutos de carrera no da)
    if (parametros.has('limite')) M._mkw_sala_limite?.(Math.max(0, Number(parametros.get('limite')) * 1000) >>> 0);
    window.mkwLimiteCarrera = () => M._mkw_sala_limite_juego?.();
    // §78: el contador de los que faltan (dnf.mjs). Cuando llega el primero (humano o CPU) el juego da 30 s a los demás
    // (§77); la página lo muestra con las letras y los colores de la cuenta de salida, de la fuente que el juego ya cargó
    // (UI/Font.szs, leída de la caché de bloques del disco: no se baja de nuevo). ?cuentaDnf=0 = sin contador.
    M._mkw_sala_dnf?.(DNF_MS); M._mkw_red_estado_dnf?.(DNF_MS);   // (§275b: el mismo plazo en «Cada uno su kart»)
    const leerFuente = ruta => tamaños.has(ruta) ? disco.leer(direccion(ruta), tamaños.get(ruta), 0, tamaños.get(ruta)) : null;
    if (parametros.get('cuentaDnf') !== '0') window.mkwCuentaDnf = crearCuentaDnf({ M, lector: () => window.mkwMenus, leerArchivo: leerFuente,
      saltoSinCuenta: parametros.get('dnfLiviano') === '0' ? 1 : 10 });   // (§136: sin cuenta, mirar cada 10 refrescos; ?dnfLiviano=0 = cada uno)
    // M22: los letreros (la misma fuente del juego que el contador)
    letreros = window.mkwLetreros = crearLetreros({ leerArchivo: leerFuente });
    // M22: los nombres de la sala en el juego (nombres-juego.mjs + nombres_nativo.cpp): cada humano con su nombre sobre
    // el kart y en las tablas del juego (antes: «Piloto» el de la casilla 0 y nada los demás). Antes de abrir la
    // elección de personaje (ahí el juego le pone un Mii a cada casilla de humano) y otra vez antes de cada carrera.
    // ?nombresJuego=0 = como antes
    const nombresAlJuego = window.mkwNombresAlJuego = () => parametros.get('nombresJuego') !== '0' &&
      escribirNombres(M, sincro.corren, u => nombres[u] || `Jugador ${sincro.humanos.findIndex(h => h.uid === u) + 1}`);   // (§110: por puesto)
    nombresAlJuego();
    let nombresCpu = null;                          // cómo nombra el juego a cada CPU (de la carrera en curso)
    // el juego: directo a la pantalla de personaje (la licencia 1, creada si hace falta)
    directo.elegir().then(({ abierto, eleccion }) => {
      if (abierto) marcarEligiendo(eleccion);                    // (§111: el mando, al juego mientras elige)
      window.mkwEstado.piloto = { llego: abierto, modo: 'sala', eligiendo: true };
      revisarCortina();
      eleccion.then(p => {
        if (!p) return;
        miEleccion = p; window.mkwEstado.eleccion = p;
        // el aviso ANTES de avisar lo elegido: en el anfitrión, elegi() puede arrancar la carrera en el acto (si era el
        // último en elegir) y el aviso escrito después quedaría encima de la carrera
        const x = sala.estado();
        if (x.fase === 'correr' && x.carrera >= 1 && letreros?.cartelVisible) {
          // (M22: recargó con la copa andando: lo elegido llega a la anfitriona en el descanso y corre desde la siguiente)
          letreros.cartel(`Carrera ${x.carrera} de ${x.carreras} en curso`, x.carrera < x.carreras
            ? `¡Listo! Corres con eso desde la ${x.carrera + 1}.` : 'Es la última: al final verás la tabla de la copa.');
        } else ui.aviso('¡Listo! Esperando a que elijan los demás…');
        sala.elegi(p);                                     // (si todavía no es la fase de elegir, se manda otra vez al llegar)
      });
    });
    const pistaDe = (e, n) => { const t = e.pistas?.[n - 1]; return t ? 0x100 + 4 * t.copa + t.fila : 0x100; };
    // §74: el nombre de cada piloto (el que manda la sala del sitio) y las sugerencias de la playlist
    const nombreDe = uid => nombres[uid] || `Jugador ${sincro.humanos.findIndex(h => h.uid === uid) + 1}`;
    const pendientesDe = e => (e.lista?.sugerencias || []).filter(s => s.estado === 'pendiente').map(s => ({ ...s, nombre: nombreDe(s.de) }));
    const misSugerencias = e => (e.lista?.sugerencias || []).filter(s => s.de === sincro.yo);
    // §100 («Pedir copa»): las copas que piden los demás, copa → sus nombres (para el selector de la anfitriona)
    const pedidasDe = e => { const m = {}; for (const [u, c] of Object.entries(e.pedidas || {})) (m[c] ||= []).push(nombreDe(u)); return m; };
    // §100 («Pedir copa», pedido del dueño: «que los otros jugadores puedan solicitar copa en vez de esperar sin ver»):
    // mientras la anfitriona elige la copa, los demás abren el mismo selector y piden una; ella la ve con un 🙋 en su
    // tarjeta y, si se le acaba el reloj, sale la más pedida. Pedir otra cambia el pedido
    let pidoSel = null, abriendoPido = false;
    function abrirPedir() {
      if (pidoSel || abriendoPido) return;
      abriendoPido = true;
      mirame();
      const jefeNombre = nombres[sala.anfitrion] || 'el anfitrión';
      const sigue = () => { const x = sala.estado(); return x.fase === 'copa' && !x.lista && !sala.soyAnfitrion; };
      ui.elegirPista({ modo: 'gp', copas: copasSala(), cerrar: true, textoCerrar: 'Volver', titulo: `Pídele una copa a ${jefeNombre}`,
        textoJugar: c => `Pedir la Copa ${c + 1} ▸`,
        lista: { alAbrir: c => { abriendoPido = false; if (!sigue()) { c.cerrar(null); return; } pidoSel = c; } } }).then(r => {
        abriendoPido = false; pidoSel = null;
        if (r && r.copa >= 0 && sala.pedirCopa(r.copa)) nota(`sala: pedí la copa ${r.copa}`);
        if (sigue()) alCambiarSala(sala.estado());
      });
    }
    // §79: en el sitio el marco del juego mide 100vh − 120 px y empieza más abajo del borde de la ventana: el panel de
    // los selectores queda pegado abajo del marco, fuera de la vista. Al abrir uno se le pide al sitio que acomode la
    // página para que se vea el marco entero ({tipo:'mirame'}: scrollIntoView «nearest», solo si hace falta)
    const mirame = () => { if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'mirame' }, location.origin); };
    // el anfitrión elige: la copa (una de las del juego, sus 4 pistas) o arma la playlist con las sugerencias de todos
    function abrirSelectorSala(e) {
      pickerAbierto = true;
      ui.aviso('');
      mirame();
      // §87: si mientras se abría la copa se fijó (o mandó otro), se cierra solo
      const sigue = c => { if (sala.soyAnfitrion && sala.estado().fase === 'copa') return true; c.cerrar(null); return false; };
      if (!e.lista) {
        ui.elegirPista({ modo: 'gp', copas: copasSala(), cerrar: false, titulo: 'Elige la copa de la sala', lista: { alAbrir: c => { if (sigue(c)) { selLista = c; c.pedidas?.(pedidasDe(sala.estado())); } } } }).then(r => {
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
          if (!sigue(c)) return;
          selLista = c;
          if (!sala.estado().lista?.pistas?.length && c.pistas.length) sala.listaCambio(c.pistas);   // (venía del borrador: que la vean todos)
          c.sugerencias(pendientesDe(sala.estado()));
        } } }).then(r => {
        pickerAbierto = false; selLista = null;
        if (r?.pistas?.length) sala.ponerPistas(r.pistas);
        else if (sala.estado().fase === 'copa') alCambiarSala(sala.estado());
      });
    }
    // los demás sugieren (mientras se arma la playlist, o entre carrera y carrera con «Sugerir pista»)
    function abrirSugerir(e, entre) {
      if (selSug || abriendoSug) return;            // §87: uno solo (el que se está abriendo toma el estado más nuevo)
      abriendoSug = true;
      const n = e.carrera;
      // ¿todavía hace falta? (mientras se abría, el anfitrión pudo confirmar la playlist o empezar la carrera siguiente)
      const sigue = () => { const x = sala.estado(); return entre ? x.fase === 'correr' && x.carrera === n : x.fase === 'copa' && !sala.soyAnfitrion; };
      ui.aviso('');
      mirame();
      ui.elegirPista({ modo: 'sugerir', copas: copasSala(), cerrar: entre,
        titulo: entre ? 'Sugiere pistas para lo que viene' : 'Sugiere pistas para la playlist', lista: {
          pistas: (entre ? e.pistas : e.lista.pistas) || [], alSugerir: p => sala.sugerir(p),
          nota: entre ? 'El anfitrión decide si entran. La carrera siguiente empieza sola.' : undefined,
          alAbrir: c => {
            abriendoSug = false;
            if (!sigue()) { c.cerrar(); return; }
            selSug = c;
            const x = sala.estado();
            c.poner((entre ? x.pistas : x.lista?.pistas) || []);
            c.sugerencias(misSugerencias(x));
          } } }).then(() => { abriendoSug = false; selSug = null; });
    }
    // §94: lo que vio esta consola al terminar la carrera n (la llegada y los puntos, por si la sala todavía no los tiene)
    let finLocal = null;
    // §94: los resultados de la carrera n para el panel del descanso: cada humano que la corrió con su puesto, los puntos
    // de la copa y el VR (antes → después). De la sala (llegada y puntos: iguales para todos, también para quien
    // recargó) o, si todavía no llegaron, de esta consola; el VR, el que calculó esta página (o el que avisó cada uno)
    function resultadosDe(e, n) {
      const llegada = e.llegada?.carrera === n ? e.llegada.puestos : finLocal?.n === n ? finLocal.llegada : null;
      const puntos = e.puntos?.carrera === n ? e.puntos.tabla : finLocal?.n === n ? finLocal.puntos : null;
      const vrs0 = vrsDeCarrera(e, n), vrMio = vrDeCarrera?.n === n ? vrDeCarrera.todos : null;
      return correnEn(sincro.humanos, e, n).map((h, i) => {        // (§110: los puestos de la carrera n)
        if ((e.fuera || []).includes(h.uid)) return null;
        const v = vrMio?.[h.uid] || (conVr && Number.isInteger(vrs0[h.uid]) ? { antes: vrs0[h.uid], despues: e.vrs?.[h.uid] ?? vrs0[h.uid] } : null);
        return { nombre: nombreDe(h.uid), yo: h.uid === sincro.yo, puesto: llegada?.[i] || 0, puntos: puntos ? puntos[i] : null,
                 vrAntes: v?.antes ?? null, vrDespues: v?.despues ?? null, slot: i };
      }).filter(Boolean);
    }
    // §94: el descanso entre carrera y carrera (las dos salas): la cuenta, los resultados con el VR y, en la playlist, lo
    // que viene con «+ Agregar pistas» / «Sugerir pista»
    function mostrarBreve(e) {
      const n = e.carrera;
      const o = { pistas: e.pistas, hechas: n, anfitrion: sala.soyAnfitrion, pendientes: pendientesDe(e).length, copas: copasSala(),
        titulo: e.lista ? 'Playlist' : 'Copa', botones: !!e.lista, carrera: n, ultima: n >= e.carreras,
        restan: () => sala.restan(sala.estado().plazo), resultados: resultadosDe(e, n), nota: '',
        alAgregar: () => agregarEntre(), alSugerir: () => { if (!selSug) abrirSugerir(sala.estado(), true); },
        // (M22: solo con el programa nuevo —el de los nombres, que trae el arreglo del «modo elección»—: con uno de antes,
        // al confirmar el derrape el juego se iba solo a otra carrera, fuera de la sala)
        alKart: typeof M._mkw_nombres === 'function' ? () => reelegir(n) : null, kart: reeleccion?.carrera === n ? reeleccion.estado : null };
      const antes = window.mkwEstado.descanso?.carrera === n ? window.mkwEstado.descanso : null;
      // (restanAlAbrir: lo que faltaba cuando apareció el panel; las pruebas miden con eso el descanso)
      window.mkwEstado.descanso = { carrera: n, ultima: o.ultima, resultados: o.resultados, restanAlAbrir: antes?.restanAlAbrir ?? o.restan() };
      if (breve?.abierto) breve.poner(o); else { breve = ui.playlistBreve(o); mirame(); }
    }
    // M22 (modelo «Modo consola»): el ±VR de cada humano al lado de su fila de la tabla de puntos del juego (página
    // 0x30), con la letra del juego. La fila sale de la tabla de la sala (puntos y llegada, iguales en todas las
    // consolas: filasDeTabla). Recién 3 s después de que aparece la tabla (antes el juego la anima: suma y reordena) y
    // nunca encima de la pantalla de personajes (volver a elegir). ?marcas=0 = sin marcas
    const PAGINA_TABLA = 0x30;
    let tablaDesde = 0, marcasFirma = '';
    function marcasVr(e, n) {
      const puntos = e.puntos?.carrera === n ? e.puntos.tabla : finLocal?.n === n ? finLocal.puntos : null;
      const llegada = e.llegada?.carrera === n ? e.llegada.puestos : finLocal?.n === n ? finLocal.llegada : null;
      const fila = filasDeTabla(puntos, llegada);
      if (!fila) return [];
      return resultadosDe(e, n).filter(r => Number.isInteger(r.vrAntes) && Number.isInteger(r.vrDespues) && fila[r.slot] > 0).map(r => {
        const d = r.vrDespues - r.vrAntes;
        return { puesto: fila[r.slot], texto: `${d >= 0 ? '+' : '-'}${Math.abs(d)} VR`, sube: d >= 0, yo: r.yo };
      });
    }
    function revisarMarcas() {
      if (!letreros) return;
      const e = sala.estado(), n = e.carrera, L = window.mkwMenus;
      const enTabla = e.fase === 'correr' && n >= 1 && !!e.terminaron?.[n] && e.plazo > 0 && reeleccion?.estado !== 'eligiendo' &&
        L?.estado().pagina === PAGINA_TABLA;
      if (!enTabla) {
        tablaDesde = 0;
        if (marcasFirma) { marcasFirma = ''; letreros.quitarMarcas(); window.mkwEstado.marcas = null; }
        return;
      }
      tablaDesde ||= performance.now();
      if (performance.now() - tablaDesde < 3000) return;
      const m = marcasVr(e, n), firma = JSON.stringify(m);
      if (firma === marcasFirma) return;
      marcasFirma = firma;
      window.mkwEstado.marcas = { carrera: n, filas: m };
      if (m.length) letreros.marcas(m); else letreros.quitarMarcas();
    }
    if (parametros.get('marcas') !== '0') setInterval(revisarMarcas, 250);
    function reelegir(n) {
      const e = sala.estado();
      if (reeleccion?.carrera === n || e.fase !== 'correr' || e.carrera !== n || n >= e.carreras) return;
      reeleccion = window.mkwEstado.reeleccion = { carrera: n, estado: 'eligiendo' };
      mostrarBreve(e);
      directo.elegir().then(({ abierto, eleccion }) => {
        nota(`sala: elegir otra vez en el descanso de la ${n}: ${abierto ? 'abierta' : 'no se pudo abrir'}`);
        if (!abierto) { reeleccion = window.mkwEstado.reeleccion = null; if (sala.estado().carrera === n) mostrarBreve(sala.estado()); return; }
        marcarEligiendo(eleccion);                                  // (§111: el mando, al juego mientras elige)
        eleccion.then(p => {
          const x = sala.estado();
          if (!p || x.carrera !== n || reeleccion?.carrera !== n) return;      // (el descanso ya terminó: corre con el de antes)
          miEleccion = p; window.mkwEstado.eleccion = p;
          reeleccion = window.mkwEstado.reeleccion = { carrera: n, estado: 'listo', eleccion: p };
          sala.elegi(p);
          mostrarBreve(x);
        });
      });
    }
    // «+ Agregar pistas» (el anfitrión): §94, si al descanso le quedan menos de 15 s vuelve a 15 s (antes: pausa de 60 s)
    function agregarEntre() {
      const e = sala.estado();
      if (!sala.soyAnfitrion || selLista || abriendoEntre || e.fase !== 'correr') return;
      abriendoEntre = true;                         // §87: un solo «+ Agregar pistas» (aunque se aprieten dos)
      sala.pausar(true);
      mirame();
      const hechas = e.carrera;
      ui.elegirPista({ modo: 'lista', copas: copasSala(), cerrar: true, textoCerrar: 'Listo', titulo: 'Agrega pistas a la playlist', lista: {
        pistas: (e.pistas || []).slice(hechas), max: Math.max(1, 32 - hechas), clave: '', sugerencias: true, confirmar: 'Seguir', titulo: 'Lo que viene',
        objetivo: Math.min(4, Math.max(1, 32 - hechas)),
        alCambiar: ps => sala.restantesCambio(ps), alAceptar: id => sala.aceptar(id), alRechazar: id => sala.rechazar(id),
        alAbrir: c => {
          abriendoEntre = false;
          const x = sala.estado();
          if (x.fase !== 'correr' || x.carrera !== hechas) { c.cerrar(); return; }   // (§87: la carrera siguiente ya empezó)
          selLista = c; c.sugerencias(pendientesDe(x));
        } } }).then(() => { abriendoEntre = false; selLista = null; sala.pausar(false); });
    }
    // M22: la fase de la sala, para la tira del sitio (el sitio no la sabe y su texto quedaba fijo toda la copa)
    const avisarFase = e => {
      if (window.parent === window) return;
      const n = e.carrera | 0;
      const fase = e.fase === 'correr' ? (e.terminaron?.[n] && e.plazo ? 'descanso' : 'carrera') : e.fase;
      try { window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'fase', fase, carrera: n, carreras: e.carreras | 0, estilo }, location.origin); } catch {}
    };
    // §269b.14 (el dueño): mientras alguna consola no tiene el juego cargado, ningún reloj de la sala corre y todas muestran
    // quién falta (el estado de la anfitriona: faltanCarga). En la carrera, nunca
    function avisoCarga(e) {
      let n = document.getElementById('esperaCarga');
      const faltan = e?.faltanCarga || [], otra = e?.versionDistinta || [];
      const ver = (faltan.length > 0 || otra.length > 0) && !window.mkwEstado.enCarrera;
      if (!ver) { if (n) n.hidden = true; return; }
      if (!n) {
        n = Object.assign(document.createElement('div'), { id: 'esperaCarga', role: 'status' });
        n.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:55;max-width:calc(100vw - 32px);' +
          'padding:10px 16px;border-radius:14px;background:rgba(10,14,30,.88);color:#fff;font:15px/1.35 system-ui,sans-serif;' +
          'text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.4);pointer-events:none';
        document.body.append(n);
      }
      const nombre = u => u === sincro.yo ? 'tú' : (window.mkwNombresSala?.[u] || `jugador ${sincro.humanos.findIndex(h => h.uid === u) + 1}`);
      // (§286: con otra versión no se larga: el que la tiene vieja recarga; la anfitriona compara contra la suya)
      n.textContent = otra.length ? (otra.includes(sincro.yo) ? '⚠ Tienes otra versión del juego que los demás: recarga la página (Ctrl+Mayús+R) para correr'
        : `⚠ ${otra.map(nombre).join(', ')} ${otra.length > 1 ? 'tienen' : 'tiene'} otra versión del juego: recarguen la página (Ctrl+Mayús+R). La carrera no empieza hasta que todos tengan la misma`)
        : `⏳ Esperando a los jugadores… (faltan: ${faltan.map(nombre).join(', ')})`;
      n.hidden = false;
    }
    function alCambiarSala(e) {
      window.mkwEstado.sala = e;
      try { window.mkwAutoCalibrar?.alEstadoSala(e); } catch (x) { console.warn('[auto-calibrar] ' + x); }   // (§274: la pausa de la sala)
      // §251: la pista que corre ahora y la siguiente no se borran (pantalla Espacio)
      try { const k = Math.max(1, e.carrera || 1); pistasSalaProtegidas = e.pistas?.length ? [k, k + 1].filter(n => e.pistas[n - 1]).map(n => pistaDe(e, n)) : []; } catch {}
      // §176 (D1 en la sala): apenas la sala sabe las pistas (la copa o la lista elegida), la de la carrera que viene y la
      // siguiente se piden con su música; fuera de la carrera (en la elección y el descanso: en la carrera no se baja nada)
      if (paqueteCarrera?.pedirPista && e.pistas?.length && !window.mkwEstado.enCarrera && parametros.get('pistaSala') !== '0') {
        const k = Math.max(1, e.carrera || 1);
        try { for (const n of [k, k + 1]) if (e.pistas[n - 1]) paqueteCarrera.pedirPista(pistaDe(e, n)); } catch {}   // (pistaDe se define más abajo)
      }
      avisarFase(e);
      avisoCarga(e);
      const primera = primeraVista; primeraVista = false;
      clearInterval(reloj); reloj = null;
      // (§100: el botón «Pedir copa» y su selector, solo para los demás mientras la anfitriona elige la copa)
      if (e.fase !== 'copa' || e.lista || sala.soyAnfitrion) { ui.accion(''); if (pidoSel) { pidoSel.cerrar(null); pidoSel = null; } }
      if (e.fase === 'copa') {
        // M22: el reloj de la copa (lo ven todos; en la playlist no hay)
        const segCopa = () => (e.plazo && !e.lista ? Math.max(0, Math.ceil(sala.restan(e.plazo) / 1000)) : 0);
        if (sala.soyAnfitrion) {
          if (selSug) { selSug.cerrar(); selSug = null; }    // (sugería y ahora manda: el anfitrión se fue, §74)
          if (!pickerAbierto && preparada()) abrirSelectorSala(e);   // (§99: recién con el navegador preparado)
          else selLista?.sugerencias(pendientesDe(e));       // (las sugerencias que van llegando)
          selLista?.pedidas?.(pedidasDe(e));                 // (§100: y las copas que piden los demás)
          if (!e.lista && e.plazo) {
            const f = () => { const s = segCopa(); ui.aviso(s ? `Elige la copa: ${s} s (si no, sale una al azar)…` : ''); };
            f(); reloj = setInterval(f, 1000);
          }
        } else if (e.lista) {
          // §74: los demás, en la playlist: sugieren pistas mientras el anfitrión arma la lista
          if (!selSug) abrirSugerir(e, false);
          else { selSug.poner(e.lista.pistas); selSug.sugerencias(misSugerencias(e)); }
        } else {
          // (M22, el crítico: la pantalla de personajes ya sirve —lo elegido se guarda y se manda después—, pero el aviso
          // se leía como «espera»)
          const jefeNombre = nombres[sala.anfitrion] || 'El anfitrión';
          // (§100: y lo que pedí, si pedí)
          const mia = e.pedidas?.[sincro.yo], pedi = Number.isInteger(mia) ? ` · pediste la Copa ${mia + 1}` : '';
          const f = () => {
            const s = segCopa(), cuanto = s ? ` (${s} s)` : '';
            ui.aviso(miEleccion ? `¡Listo! ${jefeNombre} está eligiendo la copa${cuanto}${pedi}…` : `Ya puedes elegir personaje y vehículo · ${jefeNombre} está eligiendo la copa${cuanto}${pedi}…`);
          };
          f(); if (e.plazo) reloj = setInterval(f, 1000);
          ui.accion(pidoSel ? '' : Number.isInteger(mia) ? '🙋 Pedir otra copa' : '🙋 Pedir una copa', abrirPedir);
        }
      } else if (e.fase === 'elegir') {
        // N12 (§233): antes de largar, quién no llega a 60 (lo dijo su latido: su última carrera); una vez por carrera
        if (ESCALON && avisoLentosEn !== e.carrera) {
          avisoLentosEn = e.carrera;
          setTimeout(() => {          // (2 s: que lleguen los latidos de todos)
            const corren = correnEn(sincro.humanos, sala.estado(), sala.estado().carrera).map(h => h.uid).filter(u => !(sala.estado().fuera || []).includes(u));
            const lentos = lentosDe(sala.capacidades(), corren);
            window.mkwEstado.lentos = lentos;
            const t = textoLentos(lentos, u => nombres[u] || u, sincro.yo);
            if (t) { ui.chip('lentos', t, true, 15000); nota(`[escalón] antes de la carrera ${e.carrera}: ${t}`); }
          }, 2000);
        }
        if (selSug) { selSug.cerrar(); selSug = null; }      // (§74: el anfitrión confirmó la playlist)
        if (selLista) { selLista.cerrar(null); selLista = null; }   // (la copa se fijó sin el selector: un anfitrión nuevo, las pruebas)
        // (lo mío se manda otra vez solo si el anfitrión todavía no lo tiene: en el anfitrión, elegi() cambia el estado y
        // vuelve a llamar aquí; sin esta condición sería un círculo sin fin)
        if (miEleccion && !e.picks?.[sincro.yo]) sala.elegi(miEleccion);
        const cuenta = () => {
          const quedan = Math.ceil(sala.restan(e.plazo) / 1000);   // (§94: con la hora de la anfitriona)
          const picks = sala.estado().picks || {}, listos = Object.keys(picks).length;
          // (M22: a quién se espera, por su nombre, si son pocos)
          const faltan = sincro.humanos.filter(h => !picks[h.uid] && h.uid !== sincro.yo && !(sala.estado().fuera || []).includes(h.uid))
            .map(h => nombres[h.uid]).filter(Boolean);
          const aQuien = faltan.length && faltan.length <= 3 ? ` (falta${faltan.length > 1 ? 'n' : ''} ${faltan.join(', ')})` : '';
          ui.aviso(miEleccion ? `¡Listo! Esperando a los demás (${listos} de ${sincro.humanos.length})${aQuien}… ${quedan} s`
            : `Elige personaje y vehículo: ${quedan} s…`);
        };
        cuenta(); reloj = setInterval(cuenta, 1000);
      } else if (e.fase === 'correr') {
        const n = e.carrera;
        // §74/§94: mientras se ven los resultados, el panel del descanso (en la playlist, con «+ Agregar pistas» /
        // «Sugerir pista»). También para quien recargó: los resultados salen de la sala
        if (e.terminaron?.[n] && e.plazo) {
          mostrarBreve(e);
          // (M22: lo que eligió quien recargó —la pantalla de personajes se abre al cargar— llega en el descanso, el
          // primer momento en que la anfitriona lo acepta; corre con eso desde la siguiente)
          const mio = e.picks?.[sincro.yo];
          if (miEleccion && n < e.carreras && (!mio || mio.personaje !== miEleccion.personaje || mio.vehiculo !== miEleccion.vehiculo ||
              (mio.derrape | 0) !== (miEleccion.derrape | 0))) sala.elegi(miEleccion);
        }
        if (e.lista) {
          selLista?.sugerencias(pendientesDe(e));
          if (selSug) { selSug.poner(e.pistas); selSug.sugerencias(misSugerencias(e)); }
        }
        // §75: quien recargó la página con la copa andando (la primera vista ya es una carrera) no entra a esa carrera,
        // aunque esté en los resultados: su consola no tiene los cuadros que ya pasaron. Se la salta —y lo avisa en el
        // latido, para que nadie lo espere— y entra en la siguiente con su puesto y lo que eligió. Lo mismo si la
        // anfitriona lo dejó fuera de esta carrera (no daba señales al empezarla: en todas va "sin nadie").
        // §110: quiénes corren esta carrera (la base y los sumados desde ≤ n, sala-carrera.mjs): los sumados que la
        // anfitriona anotó van a la lista de la carrera sincronizada (con su mando: su lugar en la lista de la sala), y el
        // que todavía no corre se la salta como quien recargó
        // (la lista con los sumados se arma aparte: la de la carrera sincronizada cambia recién al ARRANCAR la carrera —
        // más abajo—; si cambiara con la carrera andando, esperaría los botones de alguien que no está en ella)
        const conSumados = sincro.humanos.slice();
        for (const [u] of e.sumados || []) if (!conSumados.some(h => h.uid === u) && conSumados.length < 12) conSumados.push({ uid: u, mando: conSumados.length });
        // (una anfitriona con el juego de antes —sin §110, el estado sin `base`—: solo la base, y el que llegó espera la
        // tanda siguiente como antes; si no, sus consolas armarían otra ficha)
        const corren = n < 1 ? sincro.corren : !Number.isInteger(e.base) && sincro.base < sincro.humanos.length
          ? conSumados.slice(0, sincro.base) : correnEn(conSumados, e, n);
        const corre = u => corren.some(h => h.uid === u);
        const fueraYo = (e.fuera || []).includes(sincro.yo) || (n >= 1 && !corre(sincro.yo));
        if ((primera || fueraYo) && n >= 1 && sala.arrancar(n)) {
          if (primera) sala.saltar(n);
          // (M22: un cartel arriba, no la píldora del centro: la pantalla de personajes que se ve detrás sí sirve)
          ui.aviso('');
          letreros?.cartel(`Carrera ${n} de ${e.carreras} en curso`, n >= e.carreras
            ? 'Es la última: al final verás la tabla de la copa.'
            : `Vuelves en la ${n + 1}. Mientras, si quieres, elige personaje y vehículo.`);
          window.mkwEstado.cartel = { carrera: n, texto: letreros?.cartelVisible || '' };
          return;
        }
        if (!sala.arrancar(n)) return;
        // §110: ahora sí, los sumados (todos, en su orden: el mando de cada uno es su lugar) a la carrera sincronizada; los
        // que todavía no corren van en `fuera` (fijarCarrera, abajo)
        for (const [u] of e.sumados || []) sumarHumano(u);
        sala.saltar(0);
        // (§111: la carrera abre: la pantalla de personajes se cerró aunque nadie haya confirmado)
        eligiendoEnJuego = 0; window.mkwEstado.eligiendoEnJuego = false;
        ui.aviso('');
        letreros?.quitarCartel(); letreros?.quitarMarcas(); marcasFirma = '';
        // §74: la carrera nueva: fuera el panel y los selectores de entre carreras
        breve?.cerrar(); breve = null;
        if (reeleccion && reeleccion.carrera < n) reeleccion = null;   // (M22: lo elegido ya está en la ficha de esta)
        selSug?.cerrar(); selSug = null;
        selLista?.cerrar(null); selLista = null;
        // (§110: la ficha, con los que corren esta carrera; mi puesto —la cámara, el HUD, mis récords— es el mío en ella)
        sincro.corren = corren;
        sincro.miPuesto = window.mkwMiPuesto = window.mkwPantallaPropia = corren.findIndex(h => h.uid === sincro.yo);
        const hs = humanosDeFicha(corren, e);
        const cc = ccDe(n);
        const ficha = armarFicha({ pista: pistaDe(e, n), cc, cpu: cpuDe(cc),
          humanos: hs, semilla: semillaSala, carrera: n - 1, carreras: e.carreras, primera: n === 1 });
        ficha.pantallas = 1;
        // §275b «Cada uno su kart»: la carrera es en línea (modo 7, VS de una sala de amigos) y los otros humanos son
        // karts de otra consola (tipo 4, PLAYER_REAL_ONLINE: los mueve el estado que llega por la red, no los botones)
        if (RED_ESTADO_SALA) {
          ficha.modo = 7;
          // los otros humanos = jugadores en línea (tipo 4, los mueve la red); el mío, con el mando 0: sin lockstep la
          // página manda sus botones solo al puerto 0 (en la sala de siempre cada consola alimenta el mando de cada uno)
          // (3c: los que la sala dejó fuera de esta carrera —se fueron, no se oyen— no tienen consola en la red: su kart lo
          // corre la anfitriona como una CPU más, siempre 12 karts, y el juego no espera paquetes de ellos)
          const jefeRed = parametros.get('jefe') || sincro.humanos[0]?.uid;   // (la del sitio: la misma en todas)
          const fueraRed = new Set(e.fuera || []);
          corren.forEach((h, i) => { if (!ficha.puestos[i]) return;
            ficha.puestos[i] = fueraRed.has(h.uid) ? { ...ficha.puestos[i], tipo: jefeRed === sincro.yo ? 1 : 4, mando: -1 }
              : h.uid !== sincro.yo ? { ...ficha.puestos[i], tipo: 4, mando: -1 } : { ...ficha.puestos[i], mando: 0 }; });
          // (3b: las CPU las corre la anfitriona; en las demás consolas son karts remotos de ella: siempre 12 karts)
          if (jefeRed !== sincro.yo) ficha.puestos.forEach((q, i) => { if (q && i >= corren.length) ficha.puestos[i] = { ...q, tipo: 4, mando: -1 }; });
          try {
            window.mkwRedEstadoSala?.apagar();
            window.mkwRedEstadoSala = crearRedEstado({ M, malla: red.malla, registro: nota,
              // (el lento al día: la hora de la sala —Date.now() + sala.desfase, la de la anfitriona; no performance.now(), que cuenta desde que abrió cada pestaña— para comparar los pulsos; ?alDia=0 = no)
              alDia: parametros.get('alDia') === '0' ? false : parametros.get('alDia') === 'viejo' ? 'viejo' : true, kartLiviano: parametros.get('kartLiviano') !== '0', hora: () => Date.now() + (sala.desfase || 0),
              sala: { uids: corren.map(h => h.uid).filter(u => !fueraRed.has(u)), yo: sincro.yo, jefe: jefeRed },   // (§110: solo los que corren esta carrera: un sumado que todavía no corre no tiene consola en la red)
              puestos: ficha.puestos.map((q, i) => q ? { uid: i < corren.length && !fueraRed.has(corren[i].uid) ? corren[i].uid : null } : null) });
          } catch (err) { nota('[red-estado] no se pudo armar: ' + err.message); }
        }
        window.mkwEstado.ficha = ficha;
        if (parametros.get('pistaSala') !== '0') try { paqueteCarrera?.pedirFicha?.(ficha); paqueteDeCarrera = n; paqueteFichaT = performance.now(); } catch {}   // (§176: D1 en la sala; §285: de qué carrera)
        window.mkwSemillaCarrera = ficha.semilla;          // (semillas_nativo.cpp: plantel y pantalla propia)
        // (los mandos y el derrape de cada humano, igual en todas las consolas: semillas_nativo.cpp)
        window.mkwPlantel = ficha.puestos.map((q, i) => [q.vehiculo, q.personaje, q.tipo, q.tipo === 0 ? q.mando : -1, q.tipo === 0 ? hs[i]?.derrape || 0 : 0]);
        // (§75: y quiénes están fuera de esta carrera, igual en todas: los que la anfitriona no oyó al empezarla)
        // (§99, D: y la primera autoridad, la más estable de las carreras anteriores según la anfitriona)
        // (§110: y los sumados que todavía no corren, también fuera: nadie espera sus botones)
        prepararArbitro(n, [...(e.fuera || []).map(u => sincro.humanos.find(h => h.uid === u)?.mando),
          ...sincro.humanos.filter(h => !corre(h.uid)).map(h => h.mando)].filter(m => m >= 0),
          e.autoridad ? sincro.humanos.find(h => h.uid === e.autoridad)?.mando ?? null : null, quiereOracle && e.servidor === true);
        // (§75: y los puntos que lleva la copa, los de la sala: quien recargó no tiene los de las carreras que se saltó)
        // (§110: el que se suma en esta carrera toma el puesto de una CPU: empieza con 0, no con los puntos de ella)
        if (n > 1 && e.puntos?.carrera === n - 1) {
          const nuevos = new Set(sumadosEn(e, n)), tabla = e.puntos.tabla.slice();
          corren.forEach((h, i) => { if (nuevos.has(h.uid)) tabla[i] = 0; });
          ponerPuntos(window.mkwMenus, tabla);
        }
        // (§94: y la parrilla, como en Mario Kart: cada uno larga en el puesto en que llegó a la anterior; la de la sala,
        // igual en todas las consolas. La primera la arma escribirFicha: los humanos atrás)
        if (n > 1) {
          const parrilla = ponerParrilla(window.mkwMenus, e.llegada?.carrera === n - 1 ? e.llegada.puestos : null, ficha.puestos.length);
          window.mkwEstado.parrilla = { carrera: n, ...parrilla };
          nota(`sala: parrilla de la carrera ${n} ${parrilla?.deLlegada ? 'según la llegada de la ' + (n - 1) : 'como la primera (no llegó la llegada)'}: ${parrilla?.orden.join(' ')}`);
        }
        if (!desde) desde = n;
        vrEmpieza(e, n, ficha);
        nombresAlJuego();                              // (M22: los nombres, los últimos que mandó el sitio)
        escribirSkins(M, e.skins);                      // (M22: y las skins de las CPU de la sala, desde la 2.ª)
        const cpuAntes = leerNombresCpu(M).listo;
        M._mkw_nombres_cpu_pedir?.();                   // (y cómo nombra el juego a cada CPU, ya en la carrera)
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
          // (M22: los nombres de las CPU, apenas el juego los dio; §126: una vez leídos los de esta carrera, no se leen más)
          if (empezo && window.mkwEstado.nombresCpu?.carrera !== n) {
            const c = leerNombresCpu(M);
            if (c.listo > cpuAntes) {
              nombresCpu = c.nombres; window.mkwEstado.nombresCpu = { carrera: n, ...c, skins: leerSkins(M) };
              nota(`sala: las CPU de la carrera ${n} según el juego: ${c.nombres.map((t, j) => t ? `${j}:${t}` : '').filter(Boolean).join(', ')} (skins ${leerSkins(M)?.join(',')})`);
            }
          }
          // (§94: los puestos en la cuenta regresiva = la parrilla con que largó el juego; para las pruebas)
          const pr = window.mkwEstado.parrilla;
          if (et === 1 && pr?.carrera === n && !pr.largada) pr.largada = llegadaDelJuego(L);
          // (§75: y con los puntos ya sumados: el juego los suma en el primer cuadro con la carrera terminada, que esta
          // vigía puede ver un cuadro antes; mkw_sala_puntos_sumados lo dice)
          if (empezo && ri && s >= 0x20 && s <= 0x23 && et >= 4 && (M._mkw_sala_puntos_sumados?.() ?? 1)) {
            // (§80: si esta consola se salió de la carrera —su copia ya no es la de los demás— no avisa: sus puntos
            // no valen; en la siguiente toma la tabla de la sala, como quien recargó)
            clearInterval(vigiaFin);
            const puntos = puntosDelJuego(L), llegada = llegadaDelJuego(L);
            finLocal = { n, puntos, llegada };
            if (!sincro?.lockstep?.estado().fuera) sala.termine(n, puntos, desde, llegada, n === 1 ? leerSkins(M) : null, sincro?.lockstep?.estado().estable);
            vrTermina(e, n);                        // §82
            if (sala.estado().carrera === n && sala.estado().plazo) mostrarBreve(sala.estado());   // (§94: con el VR)
          }
        }, 500);
      } else if (e.fase === 'fin') {
        clearInterval(vigiaFin);
        breve?.cerrar(); breve = null; selSug?.cerrar(); selSug = null; selLista?.cerrar(null); selLista = null;
        const tabla = tablaDelJuego(window.mkwMenus, correnEn(sincro.humanos, e, e.carreras), nombres, e.puntos?.carrera === e.carreras ? e.puntos.tabla : null, nombresCpu);
        window.mkwEstado.finModo = tabla;
        // M22: el podio, 8 s con la letra del juego (?podio=N ms; 0 = sin podio), y después el aviso al sitio, que vuelve
        // al vestíbulo con la tabla. Antes: una píldora de una línea encima de la fila del 1.º
        ui.aviso('');
        letreros?.quitarMarcas(); letreros?.quitarCartel();
        const msPodio = parametros.has('podio') ? Math.max(0, Number(parametros.get('podio')) || 0) : 8000;
        const avisarFin = () => { if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'fin', estilo, tabla }, location.origin); };
        if (podioPuesto) return;                       // (el estado «fin» llega más de una vez: un podio)
        podioPuesto = true;
        if (!msPodio || !letreros || !tabla.length) { avisarFin(); return; }
        const podio = tabla.slice(0, 3).map(x => ({ ...x, nombre: x.nombre.replace(/ \(CPU\)$/, ''), vr: x.uid && vrCopa[x.uid] ? vrCopa[x.uid].despues - vrCopa[x.uid].antes : null }));
        const k = tabla.findIndex(x => x.uid === sincro.yo);
        const yo = k >= 3 ? { puesto: k + 1, ...tabla[k], vr: vrCopa[sincro.yo] ? vrCopa[sincro.yo].despues - vrCopa[sincro.yo].antes : null } : null;
        window.mkwEstado.podio = { tabla: podio, yo, ms: msPodio };
        letreros.podio(podio, msPodio, yo).then(() => { letreros.quitarPodio(); avisarFin(); });
      }
    }
    // §75: la página no mira su estado inicial (sería el de una sala nueva aunque la copa ya vaya por la carrera 3):
    // la sala llama alCambiarSala recién cuando sabe en qué va (el primer reparto de la anfitriona, o la anfitriona
    // cuando oyó a todos o adoptó la copia). Antes de §75 esta llamada gastaba la "primera vista" y quien recargaba
    // entraba a la carrera en curso desde el cuadro 0 (desincronizada).
    ui.aviso('Conectando con la sala…');
    // §99 (H1): un plazo para «Conectando con la sala…»: a los 15 s, con quién no se pudo (antes quedaba para siempre)
    setTimeout(() => {
      if (window.mkwSala?.lista) return;
      const conectados = new Set(red?.malla?.conectados?.() || []);
      const sin = sincro.humanos.filter(h => h.uid !== sincro.yo && !conectados.has(h.uid)).map(h => window.mkwNombresSala?.[h.uid] || h.uid);
      const texto = sin.length ? `No se pudo conectar con ${sin.slice(0, 3).join(', ')}${sin.length > 3 ? '…' : ''}: tu red o la suya bloquea la conexión directa. Se sigue intentando (por un repetidor si hace falta)…`
        : 'La sala tarda en responder: se sigue intentando…';
      ui.aviso(texto, true);
      window.mkwEstado.sinConexion = sin;
    }, 15000);
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
    const directoSinCortina = () => DIRECTO && ['enlinea', 'unjugador', 'local'].includes(objetivoPiloto.modo);
    const conPiloto = () => directoSinCortina() ? false : objetivoPiloto.modo === 'enlinea' ? !!red : MODOS_PILOTO.includes(objetivoPiloto.modo);
    const textoPiloto = () => ({ enlinea: 'Entrando a la sala…', copa: 'Preparando la carrera…', directa: 'Preparando la carrera…', sala: 'Entrando a la sala…', unjugador: 'Entrando a Single Player…',
      local: 'Entrando a Multiplayer…' }[objetivoPiloto.modo] || 'Yendo a la carrera…') + (matchMedia('(pointer: fine)').matches ? ' (Esc: lo hago yo)' : '');
    let vioTitulo = false, puesta = '';
    revisarCortina = () => {
      if (parametros.get('modo') === 'sala' && parametros.get('preparacion') !== '0' && !preparacion.lista()) return;   // (§99: la maneja la preparación)
      if (cartel.cual === 'graficos') return;   // (§276b: la espera de los gráficos de los menús es dueña de la cortina hasta que termina)
      const e = window.mkwMenus.estado();
      if (e.seccion === SECCION.titulo || e.seccion === SECCION.menuPrincipal || (e.seccion > 0 && e.seccion < 0x30)) vioTitulo = true;
      if (window.mkwEstado.piloto?.llego && e.seccion > 0) vioTitulo = true;   // §73: abrió directo otra pantalla (elegir personaje)
      const piloteando = conPiloto() && (piloto.activo || !window.mkwEstado.piloto);
      const quiere = !vioTitulo ? 'carga' : piloteando ? 'piloto' : '';
      if (quiere === puesta) return;
      puesta = quiere;
      if (quiere !== 'carga') cartel.parar('arranque');   // (§276b: la carga terminó)
      if (quiere === 'piloto') ui.cortina(textoPiloto());
      else if (!quiere) {
        ui.cortina(false); window.mkwEstado.cortinaFuera = performance.now();
        if (!conPiloto() && !quiereInicio) clearInterval(vigilaCortina);   // con menú de inicio puede volver a hacer falta
      }
    };
    // §129 (P8): con una carrera andando la cortina no cambia (el piloto no recorre menús): no se mira
    const vigilaCortina = setInterval(() => { if (RELOJES_LIVIANOS && hayCarrera) return; revisarCortina(); }, 200);
  }

  // El menú de inicio (§67): Single Player → el menú «Un jugador» del juego; Multiplayer local → el multijugador en la
  // consola (sección 0x54, §84). Los dos se abren directo por código (§71); lo demás se elige con los menús del juego.
  // (El piloto de antes, ?directo=0: hasta el menú «Un jugador» o hasta el menú principal con el cursor en «2 Players».)
  const DESTINO = {
    unjugador: { pagina: PAGINA.unJugador, seccion: SECCION.unJugador },
    local: { pagina: PAGINA.menuPrincipal, alLlegar: async toque => { await toque(BOT.derecha); } },
  };
  pedirPiloto = que => {
    objetivoPiloto.modo = que;
    window.mkwEstado.piloto = null;
    revisarCortina();                               // la cortina al tiro (si el juego ya mostraba su título)
    if (DIRECTO && (que === 'unjugador' || que === 'local')) {   // §71/§84: el juego abre su menú de una
      if (que === 'local') M._mkw_directo_locales?.(localesInicio);   // 2, 3 o 4 jugadores (directo_nativo.cpp)
      directo.ir(SECCION_DIRECTA[que]).then(llego => {
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
    if (!PLANIFICADOR) requestAnimationFrame(alRefrescar);
  };
  if (PLANIFICADOR) relojMonitor.alRefresco.push(alRefrescar);   // (§143: en el mismo refresco del reloj del monitor)
  else requestAnimationFrame(alRefrescar);

  // §81: el aviso de «tarjeta de video equivocada» (aviso-gpu.mjs): si el juego va lento un buen rato por trabajo de
  // esta PC y Windows es quien elige la tarjeta, ofrece la ayuda del cajón (Avanzado → Video). Fuera de la sala (ahí
  // avisa la sala, §70.7) y no en las pruebas automáticas (salvo ?avisoGpu=1; ?avisoGpu=0 lo apaga)
  const enSalaGpu = parametros.has('sincro') || ['sala', 'enlinea'].includes(parametros.get('modo'));
  const avisoGpu = parametros.get('avisoGpu') === '0' || (navigator.webdriver && parametros.get('avisoGpu') !== '1') ? null
    : crearAvisoGpu({ gpu: revisionGpu, abrirAyuda: () => {
        if (!(document.body.classList.contains('cajon-abierto') && !$('hojaAvanzado').hidden)) ui.abrirCajon('avanzado');
        const ayuda = $('gpuAyuda'); ayuda.hidden = false; ayuda.open = true; ayuda.scrollIntoView({ block: 'nearest' });
      } });
  window.mkwAvisoGpu = avisoGpu;           // (para las pruebas)

  // §190 (E1/E2): los vigías del ahorro de energía y del calor (window.mkwEnergia: su estado, y probar() para el banco)
  // §241: el del ahorro va prendido por omisión (probado con el Ahorro de energía de verdad de Chrome; con Playwright
  // solo con ?ahorro=1, como N8); ?ahorro=0 = apagado. El del calor sigue apagado hasta verlo en un teléfono (?calor=1);
  // ?calorSeg=N = el «minuto» del vigía dura N segundos (solo pruebas: así la prueba del PC no dura 5 minutos)
  const vigiaAhorro = energiaPrendida(parametros.get('ahorro'), !navigator.webdriver) ? crearVigiaAhorro({ alAviso: t => ui.chip('ahorro', t, true, 15000) }) : null;
  const calorSeg = Number(parametros.get('calorSeg')) || 0;
  const vigiaCalor = energiaPrendida(parametros.get('calor')) ? crearVigiaCalor({ alAviso: t => ui.chip('calor', t, true, 15000),
    umbral: calorSeg > 0 ? { ...CALOR, segundosMinuto: calorSeg } : CALOR }) : null;
  let vigiaN8 = null;   // (§219: con ?n8=auto, n8.mjs decide cada segundo de carrera; se arma más abajo, con el programa)
  window.mkwEnergia = { ahorro: vigiaAhorro?.estado ?? null, calor: vigiaCalor?.estado ?? null };
  // 6b) Medidor: cada segundo
  let antes = { t: performance.now(), c: 0, espera: 0, lastre: 0 };
  let primerCuadro = false, verificado = false;
  const sonidoMedido = { nivelMax: -100, base: null, colaMin: 1e9, colaMax: -1, ritmoMin: 9, ritmoMax: 0 };
  window.mkwEstado.sonido = sonidoMedido;
  const medidas = [];
  let lastreSegAntes = null;                 // (§162: lo del lastre por cuadro del segundo anterior)
  let salaAjenaAntes = null;                 // (§269b.13: lo frenado y esperado en la sala hasta el segundo anterior)
  let antesImagenesSeg = null, antesCompas = null;              // (§270: la cuenta de imágenes a la vista del segundo anterior)
  const ultimoPg = {};                       // (§123: lo último contado por cuadro, para los segundos fuera de la ventana)
  setInterval(() => {
    // (§269: + lo que el juego esperó los botones de la sala, window.mkwEstado.esperaSala: no es trabajo de esta PC)
    const salaMs = window.mkwEstado.esperaSala?.ms || 0;
    const ahora = { t: performance.now(), c: M._mkw_web_cuadros(), espera: M._mkw_web_ms_espera() + salaMs, sala: salaMs, lastre: lastreCpu?.estado.ms ?? 0,
                    cpuPura: lastreCpu ? lastreCpu.estado.trabajoMs + lastreCpu.estado.ms : 0 };
    const dc = ahora.c - antes.c, dt = ahora.t - antes.t;
    const fps = dc * 1000 / dt;
    // (§155: lo girado por el lastre pasa dentro de las esperas del runtime, pero es «trabajo» del núcleo lento)
    const trabajo = dc ? ((dt - (ahora.espera - antes.espera) + (ahora.lastre - antes.lastre)) / dc) : 0;
    // (§155: con ?lastre, la CPU pura por cuadro —sin lo que aurora espera a la toma—, con lo girado)
    const cpuPura = lastreCpu && dc ? (ahora.cpuPura - (antes.cpuPura || 0)) / dc : null;
    const desde = antes.c;                     // cuadro con que empezó este segundo de medición
    // (§269: lo que se esperó a la sala por cuadro dibujado este segundo; null fuera de la sala)
    const salaSeg = sincro && dc ? Math.round((ahora.sala - (antes.sala || 0)) / dc * 10) / 10 : null;
    // §269b.13 (el simulador PC + Oppo: con la sala frenada por el teléfono, la vigía de N8 de dos PC vio «no llega a 60» y
    // prendió su N8): un segundo en que el lockstep me frenó o me hizo esperar más de 20 ms en total (lo que va repartido
    // en muchos cuadros —1 a 2 ms cada uno— no pasaba el SALA_AJENA de n8.mjs) es de la sala, no de este aparato
    const salaAjena = () => {
      try {
        const e = sincro?.lockstep?.estado?.(); if (!e) return false;
        const ms = (e.msFrenado || 0) + (e.msEsperando || 0) + (e.msEsperaVivo || 0) + (e.msEsperaCorta || 0);
        const d = ms - (salaAjenaAntes ?? ms); salaAjenaAntes = ms;
        return d > 20;
      } catch { return false; }
    };
    ahora.disco = msEsperaDisco;
    ahora.pip = antes.pip; ahora.pg = antes.pg; ahora.logica = antes.logica;   // (lo del segundo anterior: se ponen al día abajo, con el historial)
    const esperaDiscoSeg = msEsperaDisco - (antes.disco || 0);   // ms de este segundo esperando el disco
    antes = ahora;
    Object.assign(window.mkwEstado, { cuadros: ahora.c, fps, trabajo });
    // §270: las imágenes a la vista y los cuadros del juego de este segundo, por separado (el medidor dice los dos)
    if (vistaImagenes) { const m = vistaImagenes.marca(); if (antesImagenesSeg !== null && dt > 0) window.mkwEstado.imagenesSeg = (m - antesImagenesSeg) * 1000 / dt; antesImagenesSeg = m; }
    if (ritmoJuego) window.mkwEstado.juegoSeg = ritmoJuego.segundo(ahora.t);
    // §270: el compás de los menús decide cada segundo con lo de este segundo (cuadros y trabajo por cuadro)
    // (el trabajo sin lo esperado al compás de la toma: esa espera la pone el ritmo mismo y no es trabajo)
    if (ritmoMenus) {
      const compas = relojMonitor.msCompas - (antesCompas ?? relojMonitor.msCompas); antesCompas = relojMonitor.msCompas;
      ritmoMenus.segundo({ cuadros: fps, trabajo: cpuPura ?? (dc ? Math.max(0, trabajo - compas / dc) : null), enMenus: menusAhora(), visible: !document.hidden });
      window.mkwEstado.ritmoMenus = ritmoMenus.estado;
    }
    // §114: los últimos 2 min, un renglón por segundo (para el informe de rendimiento): fps, ms del juego por cuadro,
    // ms de la tarjeta, ms esperando el disco, pipelines nuevos (y ms bloqueados creándolos) y dónde estaba el juego
    const hist = window.mkwEstado.historial || (window.mkwEstado.historial = []);
    const pip = { ...pipelinesMedida }, pipAntes = antes.pip || { n: 0, ms: 0, nAsync: 0, shaders: 0 };
    ahora.pip = pip;
    let lugar = '', logica = null;
    try {
      const L = window.mkwMenus, ri = L?.u32(0x809BD730), et = ri ? L.u32(ri + 0x28) : -1;
      lugar = et === 0 ? 'presentación' : et === 1 ? 'cuenta' : et === 2 ? 'carrera' : et >= 3 ? 'fin' : 'menú';
      // §124 (V5): los cuadros de LÓGICA de la carrera, se dibujen o no. El Raceinfo los cuenta él mismo: +0x1C en la
      // presentación y +0x20 desde la cuenta (medido: 60 por segundo con 54 dibujados; con la CPU 6 veces más lenta, 15,9
      // de lógica y 2,3 dibujados). Fuera de la carrera no hay Raceinfo: null. ?logica=0 = sin esto
      // §162: solo con la carrera andando (etapa 0-2, antes y ahora): al terminar, el Raceinfo cambia sus campos y la
      // resta daba millones (§161); y nunca más de 2000 por segundo (ni sin tope llega: lo de más es basura)
      if (CONTAR_LOGICA && ri) {
        const n = L.u32(ri + 0x1C) + L.u32(ri + 0x20), a = antes.logica;
        if (a && a.ri === ri && a.et >= 0 && a.et <= 2 && et >= 0 && et <= 2 && n >= a.n && dt > 0) {
          const v = Math.round((n - a.n) * 10000 / dt) / 10;
          if (v <= 2000) logica = v;
        }
        ahora.logica = { ri, n, et };
      }
    } catch {}
    window.mkwEstado.logica = logica;
    const g1 = gpuReciente(1000);
    // (§115: por cuadro, lo que se le pidió a la tarjeta este segundo)
    const pg = perfilGpu?.foto(), pgAntes = antes.pg;
    ahora.pg = pg;
    // (§123: dividido por los cuadros que de verdad se contaron —con ventanas, solo los de dentro—; un segundo sin
    // ventana repite lo de la última)
    const dcPg = pg && pgAntes ? pg.cuadros - pgAntes.cuadros : 0;
    const porCuadro = (k, div = 1) => (dcPg > 0 ? (ultimoPg[k + div] = Math.round((pg[k] - pgAntes[k]) / dcPg / div)) : ultimoPg[k + div]);
    // (§115: los tiempos por pasada se miden 20 s de carrera, una vez, y se apagan solos)
    if (perfilGpu && PERFIL_TIEMPOS && !TRAMO) {   // (§164: con ?tramo, las marcas van con el tramo)
      const p = window.mkwEstado.perfilEstado || (window.mkwEstado.perfilEstado = { desde: 0, listo: false });
      if (!p.listo && lugar === 'carrera' && !p.desde) { p.desde = performance.now(); p.prendido = perfilGpu.medirTiempos(true); }
      if (!p.listo && p.desde && performance.now() - p.desde > 20000) {
        perfilGpu.medirTiempos(false); p.listo = true;
        try { localStorage.removeItem('mkw.perfilGpu'); } catch {}
        nota(`perfil de la tarjeta listo (${perfilGpu.tiempos().length} pasadas distintas)`);
      }
    }
    // §162: con el lastre por cuadro, lo girado (ms) y los retrazados en este segundo, y la pared del segundo (ms)
    const lastreSeg = () => {
      const e = window.mkw?._mkw_lastre_cuadro_estado; if (LASTRE_REPARTO.cuadro <= 1 || !e) return {};
      const ya = { g: e(0), v: e(2) }, an = lastreSegAntes || ya; lastreSegAntes = ya;   // (antes ya es este segundo)
      return { lgiro: Math.round(ya.g - an.g), lret: ya.v - an.v, lpared: Math.round(dt) };
    };
    hist.push({ s: Math.round(performance.now() / 1000), fps: Math.round(fps * 10) / 10, juego: Math.round(trabajo * 10) / 10,
      video: g1 === null ? null : Math.round(g1 * 10) / 10, disco: Math.round(esperaDiscoSeg),
      pip: pip.n + pip.nAsync - pipAntes.n - (pipAntes.nAsync || 0), pipMs: Math.round(pip.ms - pipAntes.ms), shaders: pip.shaders - (pipAntes.shaders || 0), lugar,
      pasadas: porCuadro('pasadas'), dibujos: porCuadro('dibujos'), kb: porCuadro('bytes', 1024), copias: porCuadro('copias'), logica,
      ...(cpuPura !== null ? { cpu: Math.round(cpuPura * 10) / 10 } : {}), ...(salaSeg !== null ? { sala: salaSeg } : {}), ...lastreSeg() });
    if (hist.length > 120) hist.shift();
    // §190 (E1 y E2): el ahorro de energía de Chrome (todo a 30 Hz) y el calor del teléfono, con lo medido en este
    // segundo; solo avisan en la esquina (el ahorro prendido por omisión desde §241, ?ahorro=0 lo apaga; el calor con ?calor=1)
    vigiaAhorro?.segundo({ periodo: relojMonitor.valido() ? relojMonitor.p : null, trabajo, visible: !document.hidden });
    vigiaCalor?.segundo({ trabajo, enCarrera: lugar === 'carrera', visible: !document.hidden });
    // §219 (N8, ?n8=auto): lo que se vio y la fracción del segundo que el hilo trabajó (trabajo por cuadro × cuadros)
    // (§270: también en elegir personaje, donde N8 ahora vale: la vigía de Automático decide ahí como en la carrera)
    // (§269: en la carrera, los cuadros de lógica de verdad —Raceinfo, §124—; antes, las imágenes por segundo: en la sala el
    // reloj va por la hora y no por el monitor, y con N8 sube la lógica pero no las imágenes: la prueba lo apagaba)
    const logicaVigia = lugar === 'menú' && Number.isFinite(window.mkwEstado.juegoSeg) && window.mkwEstado.juegoSeg > 0 ? window.mkwEstado.juegoSeg
      : lugar === 'carrera' && Number.isFinite(logica) && logica > 0 && parametros.get('vigiaLogica') !== '0' ? logica : fps;
    vigiaN8?.segundo({ enCarrera: lugar === 'carrera' || (lugar === 'menú' && !!window.mkwEstado.n8Menus), visible: !document.hidden, imagenes: fps,
                      // (§270: en los menús los cuadros presentados no son los de lógica: con N8 la mitad no se presenta)
                      logica: logicaVigia, juegoMs: (cpuPura ?? trabajo) * (logicaVigia > 0 ? fps / logicaVigia : 1),
                      salaMs: parametros.get('esperaSala') === '0' ? null : salaAjena() ? 99 : salaSeg,   // (§269; §269b.13)
                      lugar });   // (§283: la prueba de «no mejora» no mezcla elegir personaje con la carrera)
    // N12 (§233): cada segundo de carrera (visible, sin el modo sin tope) para saber cómo le fue a este aparato
    if (ESCALON && lugar === 'carrera' && !document.hidden && !SIN_TOPE && Number.isFinite(logica)) {
      segundosEscalon.push({ logica, ms: cpuPura ?? trabajo, gpu: g1 }); if (segundosEscalon.length > 1200) segundosEscalon.shift();
    }
    avisoGpu?.medir({ fps, trabajo, cuadros: ahora.c, esperaDisco: esperaDiscoSeg, oculta: document.hidden, enSala: enSalaGpu });
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
    // (camino worklet, §88: la cola es la del worklet, que el runtime lee y promedia; los saltos los cuenta el worklet)
    const cola = M._mkw_web_sonido_cola_ms(), ritmo = M._mkw_web_sonido_ritmo(), tirados = M._mkw_web_sonido_tirados() + es.tirados;
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
                (es.camino === 'worklet'
                  ? `worklet: objetivo ${es.objetivoMs.toFixed(1)} ms, mínimo ${es.nivelMinMs.toFixed(1)} ms, vacíos ${es.vacios}, ` +
                    `costo ${(es.msBloqueTotal / Math.max(1, es.entregas)).toFixed(3)} ms/entrega, máx ${es.msBloqueMax.toFixed(2)})`
                  : `costo ${(es.msBloqueTotal / Math.max(1, es.bloques)).toFixed(2)} ms/bloque, máx ${es.msBloqueMax.toFixed(2)})`));
    if (CUADROS_PRUEBA && !verificado && ahora.c >= CUADROS_PRUEBA) {
      verificado = true;
      verificar(medidas).catch(e => { ok('verificaciones', false, String(e)); fin(); });
    }
  }, 1000);

  // Desde ahora los controles van al juego (mando de GameCube por puerto, ver pad_web.cpp)
  // §269 (bug 3 del dueño, «uno puede jugar y otro no puede moverse»): en la sala solo el puerto 1 era «lo mío». El reparto
  // de los mandos (§106) pone el teclado y el primer mando en el puerto 1, pero un segundo aparato que el navegador ve
  // como mando (un mando virtual de Steam o DS4Windows, un adaptador, un volante), o «Jugador 2» elegido en Controles,
  // manda el mando de verdad al puerto 2: el juego (la pantalla de personajes) y la sala no lo oían y el kart quedaba
  // quieto. En la sala cada consola tiene UN jugador: lo de los 4 puertos se junta (juntarPuertos) y va al puerto 1 y a
  // la sala. ?unMando=0 = solo el puerto 1, como antes
  const porPuerto = [null, null, null, null];
  const unMando = !!sincro && parametros.get('unMando') !== '0';
  window.mkwEstado.unMando = unMando;
  if (unMando) controles.compartirVentanas();   // §269: dos ventanas de la sala en este navegador = cada una su mando
  enviarAlJuego = (...estado) => {
    if (unMando) {
      if (estado[0] >= 0 && estado[0] < 4) porPuerto[estado[0]] = estado.slice(1, 9);
      const j = juntarPuertos(porPuerto);
      sincro.local = j.slice(1, 8);
      M._mkw_web_pad(0, ...j);
      return;
    }
    if (sincro && estado[0] === 0) sincro.local = estado.slice(2, 9);   // lo mío, para la carrera sincronizada
    M._mkw_web_pad(...estado);
  };
  // la carrera sincronizada: el juego le pide a M.mkwLockstep los botones de cada cuadro (pad_web.cpp)
  if (sincro && red?.malla) {
    // §73: en la sala nueva (carrera directa) se le da a quien se corta un MARGEN para volver antes de seguir sin él
    // (?margen=N segundos); la carrera queda en pausa en todas mientras tanto. §80: 2 s (antes 30): quien tiene la
    // conexión mala ya no frena a nadie (lo releva la autoridad), y al que se corta de golpe no conviene esperarlo
    // más: quien recarga avisa que se salta la carrera y vuelve en la siguiente
    const margen = parametros.has('margen') ? Number(parametros.get('margen')) * 1000 : ['directa', 'sala'].includes(objetivoPiloto.modo) ? 2000 : undefined;
    // §93 (C4): en los primeros 10 s de cada carrera, 15 s de margen (?largada=N segundos; ?largada=0 = el margen de
    // siempre, como antes): la primera visita puede trabar la pestaña de alguien varios segundos justo al largar
    const largada = parametros.has('largada') ? Number(parametros.get('largada')) * 1000 : 15000;
    // §179 (R7): la subida de cada conexión, de una por vez cada 5 s (getStats es caro con 11: §127)
    const subidaDe = new Map();
    if (red?.malla?.camino) { let k = 0; setInterval(async () => {
      const otros = sincro.humanos.map(h => h.uid).filter(u => u !== sincro.yo);
      if (!otros.length) return;
      const u = otros[k++ % otros.length], c = await red.malla.camino(u).catch(() => null);
      if (Number.isFinite(c?.subida)) subidaDe.set(u, c.subida);
    }, 5000); }
    const pilotos = quiereOracle ? [{ uid: UID_SERVIDOR, mando: SERVIDOR }, ...sincro.humanos] : sincro.humanos;
    sincro.lockstep = crearLockstep({ yo: sincro.yo, humanos: pilotos, local: () => sincro.local, esperaCorte: margen,
      esperaLargada: largada || undefined,
      // §231: el árbitro (§191, R1) prendido por omisión en la sala (el dueño, 2026-11-05); ?arbitro=0 = sin él, como antes
      arbitro: parametros.get('arbitro') !== '0',
      // §99 (C3): ponerse al día corriendo cuadros seguidos (el runtime, vi.cpp: mkw_prisa); ?alDia=0 = como antes
      prisa: typeof M._mkw_prisa === 'function' && parametros.get('alDia') !== '0' ? ms => M._mkw_prisa(ms) : null,
      // §269b.16: el freno de la sala corre la cuadrícula del runtime (vi.cpp: mkw_frenar) en vez de esperar en el cuadro,
      // que no frenaba (el juego volvía a la cuadrícula corriendo de golpe); ?frenoReloj=0 = esperar como antes
      frenar: typeof M._mkw_frenar === 'function' && parametros.get('frenoReloj') !== '0' ? ms => M._mkw_frenar(ms) : null,
      // §99 (C4): la cuenta regresiva (Raceinfo +0x28: 0 presentación, 1 cuenta, 2 carrera): todos con el mismo retraso
      enCuenta: () => { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return !!ri && L.u32(ri + 0x28) < 2; },
      // §250: la etapa de la carrera, para anotar en qué cuadro y a qué hora larga esta consola (lockstep est.largada)
      etapa: () => { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return ri ? L.u32(ri + 0x28) : null; },
      // §250: el «¡YA!» se le avisa al servidor de Oracle (que no lee el juego): desde ahí ya no espera a todos
      alYa: (n, c) => enlaceOracle?.ya?.(n, c),
      // §100: la consola que se fue (cerró la página al cargar la carrera, o en la cuenta) se corta sin el margen
      ido: u => u === UID_SERVIDOR ? !enlaceOracle?.enCarrera() : consolaSeFue(u),
      // §100: el humano i ya cruzó la meta (RaceinfoPlayer +0x38, bit 2): para la regla del ausente del VR (§99)
      llego: (i, m) => {
        if (Number.isInteger(m)) { i = sincro.corren.findIndex(h => h.mando === m); if (i < 0) return false; }   // (§110: su puesto)
        const L = window.mkwMenus, ri = L?.u32(0x809BD730), lista = ri && L.u32(ri + 0xC), pl = lista && L.u32(lista + 4 * i);
        return !!pl && (L.u32(pl + 0x38) & 2) !== 0;
      },
      // §175: la sala se partió (las copias de la carrera ya no coinciden): sigue la isla más grande y se dice
      alPartida: x => {
        if (x.motivo === 'historial') {
          ui.aviso('📶 Tu aparato quedó demasiado atrás para seguir esta carrera. Puedes volver en la siguiente.', true);
          return;
        }
        nota(`la sala se partió en el cuadro ${x.cuadro}: ${x.grupos.map(g => '[' + g.join(', ') + ']').join(' · ')}`);
        // (§262: que OTRA parte se separó es informativo: se esconde con los avisos de lag; que me separé yo, no)
        if (!x.meSali && !avisosLag.prendidos()) return;
        ui.aviso(x.meSali ? `📶 Tu carrera se separó de la de los demás (${x.sigue.length} siguen juntos): vuelves en la carrera siguiente`
                          : `📶 ${x.grupos.length - 1 === 1 ? 'Una parte' : 'Partes'} de la sala se separó de esta carrera: vuelven en la siguiente`, x.meSali);
      },
      // §179 (R7): lo que puede esta consola, para elegir la autoridad: los ms libres por cuadro de los últimos 5 s (la
      // CPU pura si se mide, si no lo que trabaja el juego), la subida más chica que estima WebRTC y si es un teléfono
      capacidad: () => {
        const h = (window.mkwEstado.historial || []).slice(-5).map(x => x.cpu ?? x.juego).filter(x => Number.isFinite(x) && x > 0);
        const sub = [...subidaDe.values()].filter(Number.isFinite);
        return { margen: h.length ? 1000 / 60 - h.reduce((a, b) => a + b, 0) / h.length : null, subida: sub.length ? Math.min(...sub) : null,
                 telefono: esTelefono || parametros.get('comoTelefono') === '1' };   // (?comoTelefono=1: solo pruebas)
      },
      enviar: (u, b, canal) => u === UID_SERVIDOR ? enlaceOracle?.enviar(b) : red.malla.enviar(u, b, canal),
      huella: parametros.get('huellaAmpliada') === '0' ? () => huellaCarrera(window.mkwMenus) : () => huellaAmpliada(window.mkwMenus),   // R5 (§154)
      registro: t => red.registro.push(new Date().toISOString().slice(11, 23) + ' ' + t) });
    // §269 (bug 1 del dueño, «en la sala me dice que mi PC no alcanza 60»): el juego le pide a la sala los botones de
    // cada cuadro y, mientras llegan los de los demás, el hilo del juego queda PARADO esperando (JSPI suspende el wasm).
    // Ese rato no es trabajo de esta PC, pero el medidor de cada segundo solo restaba la espera del propio runtime (la del
    // monitor) y contaba esta como «trabajo»: con la sala a 50 por el otro PC o la red, el hilo de un PC sobrado parecía
    // ocupado 20 ms por cuadro. Eso engañaba al escalón (§233: «tu aparato no llegó a 60»), a la vigía de N8 Automático
    // (§219: prendía N8 en la sala, no mejoraba —la sala la frenaba otro— y lo apagaba PARA SIEMPRE en ese aparato, también
    // para el Single Player) y a «qué frena». Aquí se mide ese rato: desde que pad() suelta el hilo (su primera espera)
    // hasta que vuelve, sin la parte que pad() trabaja en el momento. El medidor lo resta como la espera del monitor.
    // Como medir el consumo de un motor sin contar el tiempo que estuvo frenado esperando la cinta de al lado.
    // ?esperaSala=0 = contarlo como trabajo, como antes
    const esperaSala = window.mkwEstado.esperaSala = { ms: 0, veces: 0 };
    // (con ?lastre, el aparato de mentira de §155, también es una espera: el lastre gira lo trabajado ANTES de ella y no
    // multiplica lo que se esperó a los demás)
    // (§275b: en «Cada uno su kart» los botones no pasan por el lockstep: cada consola maneja su kart al instante)
    if (RED_ESTADO_SALA) M.mkwLockstep = null; else
    M.mkwLockstep = parametros.get('esperaSala') === '0' ? sincro.lockstep : {
      pad: conLastre(envolverPadSala(c => sincro.lockstep.pad(c), esperaSala)),   // (escalon.mjs)
    };
    if (quiereOracle) {
      // El banco directo ya conoce el acuerdo de arranque. En Juegos siempre lo reparte el anfitrión.
      if (objetivoPiloto.modo === 'directa')
        prepararArbitro(1, [], null, parametros.get('arbitroDirecto') === '1' && !!enlaceOracle?.vivo());
      const relojOracle = setInterval(() => {
        if (window.mkwEstado.conexionCarrera !== 'oracle') return;
        const { autoridad, carrera, cuadro } = sincro.lockstep.estado();
        if (carrera !== carreraOracle || cuadro < 0 || !autoridad || autoridad === UID_SERVIDOR) return;
        window.mkwEstado.conexionCarrera = 'host';
        ui.chip('arbitro', 'Oracle dejó de arbitrar. La carrera sigue con un host.', true);
      }, 500);
      addEventListener('pagehide', () => clearInterval(relojOracle), { once: true });
    }
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
    // §80: el relevo (la autoridad lleva los botones de quien va atrasado: su conexión o su PC) y salirse de la carrera
    // (la copia de esta consola se separó, o la cortaron): lo que ve cada uno, en window.mkwAvisosRelevo para las
    // pruebas. Fuera de la carrera, el aviso queda (los de «…» quedan mientras duren): la carrera ya no es suya y tiene
    // que saber por qué. El relevo, en cambio, se avisa una vez (6 s) cada vez que cambia: no tapa la carrera
    window.mkwAvisosRelevo = [];
    let avisandoLlegada = false, avisoRelevo = '';
    // (M22: con el nombre que manda la sala del sitio; sin él —las pruebas sin sitio—, «jugador N»)
    const jugador = u => window.mkwNombresSala?.[u] || `jugador ${sincro.humanos.findIndex(h => h.uid === u) + 1}`;
    // §100: ¿se fueron todos los demás? (ni en el buzón ni por WebRTC; yo sigo en el buzón). Entonces no llega nada de
    // nadie, pero no es mi conexión: con dos pilotos, al que quedaba se le decía «se cortó TU conexión»
    const seFueronTodos = () => sincro.humanos.every(h => h.uid === sincro.yo || consolaSeFue(h.uid));
    const sordo = est => est.sordoMs > est.sordo && est.cuadro >= 0 && !est.fuera && !est.cortado;
    const textoRelevo = est => {
      // §99 (H8): si no llega nada de NADIE, el que se cortó soy yo (antes decía «esperando a X»)
      if (sordo(est)) return seFueronTodos() ? '📶 Los demás pilotos se desconectaron: sigues corriendo con la CPU'
        : '📶 Se cortó TU conexión: no llega nada de los demás. Esperando volver…';
      if (est.fuera) return '📶 Te desconectaste de esta carrera: tu kart sigue sin ti y vuelves en la siguiente…';
      if (est.cortado) return '📶 Se cortó tu conexión: tu kart sigue sin ti y vuelves en la siguiente carrera…';
      // §99 (C1): la pausa del relevo rápido (mi PC se trabó o se cortó la red: los demás no me esperaron)
      if (est.pausado) return '📶 Tu PC o tu conexión se trabaron: tu kart siguió solo un momento. Vuelves a manejar enseguida…';
      // (§269b.8: con el árbitro, «relevado» es lo normal —la autoridad escribe lo de todos—: vale a quién se le inventan
      // los botones seguido, lentosAhora/yoLento del lockstep; sin el árbitro, como antes)
      const conArbitro = Array.isArray(est.lentosAhora);
      if (conArbitro ? est.yoLento : est.yoRelevado) return '📶 Tu conexión o tu PC van lentas: tu kart responde con retraso';
      const otros = (conArbitro ? est.lentosAhora : est.relevadosAhora).filter(u => u !== sincro.yo);
      return otros.length ? `📶 ${otros.map(jugador).join(' y ')} va${otros.length > 1 ? 'n' : ''} lento` : '';
    };
    setInterval(() => {
      const est = sincro.lockstep.estado(), e = est.esperando;
      if (avisandoLlegada && !(e?.llegando)) { avisandoLlegada = false; ui.aviso(''); }
      // (al terminar, el que queda puesto se borra si nadie lo tapó)
      const relevo = textoRelevo(est);
      if (relevo !== avisoRelevo) {
        // (M22, avisos por capas: salirse de la carrera va al centro —la carrera ya no es suya—; el relevo, «va lento», es
        // un estado: va a la esquina mientras dure)
        const grave = est.fuera || est.cortado || (sordo(est) && !seFueronTodos());
        if (relevo && grave) ui.aviso(relevo, true);
        else if (avisoRelevo.endsWith('…') && document.getElementById('avisoJuego')?.textContent === avisoRelevo) ui.aviso('');
        if (relevo && window.mkwAvisosRelevo.length < 200) window.mkwAvisosRelevo.push(relevo);
        avisoRelevo = relevo;
      }
      // (el chip de la esquina, solo con la carrera andando: el relevo es de la carrera; en el descanso quedaba puesto)
      {
        const L = window.mkwMenus, ri = L?.u32(0x809BD730), s = L?.estado().seccion ?? -1;
        const corre = !!ri && s >= 0x20 && s <= 0x23 && L.u32(ri + 0x28) < 4;
        ui.chip('red', corre && !(est.fuera || est.cortado) ? relevo : '', est.yoRelevado);
      }
      if (!e || e.ms < (e.llegando ? 400 : 1500)) return;
      const quien = e.uids.map(jugador).join(' y ');
      if (e.llegando) {
        const texto = `Esperando a que ${quien} termine de cargar la pista: la carrera empieza al mismo tiempo para todos…`;
        if (!avisandoLlegada) { avisandoLlegada = true; window.mkwAvisosLlegada.push(texto); }
        ui.aviso(texto);
        return;
      }
      const quedan = Math.max(0, Math.ceil((e.margen - e.ms) / 1000));
      // §93: en la largada lo más probable es que su navegador todavía esté armando la pista (la primera vez)
      const texto = e.largada ? `Esperando a ${quien}: su navegador todavía arma la pista (la primera vez tarda). Lo esperamos ${quedan} s…`
        : `Se cortó la conexión con ${quien}: lo esperamos ${quedan} s (si no vuelve, la carrera sigue sin él)`;
      ui.aviso(texto, true);
      if (window.mkwAvisosCorte.length < 200) window.mkwAvisosCorte.push(texto);
    }, 500);
    const vigia = vigiaLento(sincro.humanos, 2, parametros.get('esperaSala') === '0');
    setInterval(() => {
      // (§269: con lo ocupado que estuvo el hilo del juego en los últimos 3 s, sin lo que esperó a la sala)
      const h = (window.mkwEstado.historial || []).slice(-3).filter(x => Number.isFinite(x.juego) && Number.isFinite(x.fps));
      const ocupado = h.length ? h.reduce((a, x) => a + Math.min(1, x.juego * x.fps / 1000), 0) / h.length : null;
      const texto = vigia(sincro.lockstep.estado(), performance.now(), ocupado);
      ui.chip('lento', texto, true);                  // (M22: en la esquina, mientras dure)
      if (texto) window.mkwAvisosLento.push(texto);
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
    const conNombre = gruposConNombreBrsar(await disco.leer(url, tam, 0, largo), tam);
    vocesCpuBrsar.push(...conNombre.filter(([nombre]) => /^GRP_VO_[A-Z0-9]+_(CAN_)?NPC$/.test(nombre)).map(([, ini, fin]) => [ruta, ini, fin]));
    if (ruta.endsWith('/revo_kart.brsar')) for (const [nombre, ini, fin] of conNombre) gruposPorNombre.set(nombre, [ini, fin]);   // (§169)
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
  window.mkwEstado.precalentado = { tope: EN_CAMINO_MAX, ritmo: EN_CAMINO_MAX > 0 ? PRECALENTAR_RITMO : 8, postergado: PRECALENTAR_TARDE };
  if (EN_CAMINO_MAX > 0 && !PRECALENTAR_TARDE && M._mkw_web_pipelines_precalentar) {
    // §117: con tope y sin postergar, se suelta ya. Si aurora todavía no leyó las listas (main() espera a la tarjeta de
    // video), el aviso queda anotado y los encola en cuanto las lee, al final de su primer cuadro.
    M._mkw_web_pipelines_precalentar();
    nota(`precalentado con tope (§117): de a ${PRECALENTAR_RITMO} por cuadro, como mucho ${EN_CAMINO_MAX} compilándose ` +
         `(${navigator.hardwareConcurrency || '?'} núcleos)`);
    // sin nada que precalentar (sin listas, o todas de otra versión) aurora no escribe «precalentando N»: a los 30
    // cuadros, la sala deja de esperarlos (si no, esperaba el tope de 45 s)
    const vigiaVacio = setInterval(() => {
      if (M._mkw_web_cuadros() < 30) return;
      clearInterval(vigiaVacio);
      if (!preparacion.estado.pipesTotal) preparacion.marcar('sinPipelines');
    }, 200);
  }
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
  persistencia.pedir('arranque').then(si => { pintarPartidas(); nota(`almacenamiento persistente: ${si ? 'sí' : 'no (el navegador podría borrarlo si le falta espacio)'}`); });
  // ¿Hay carrera andando? (el Raceinfo existe y su etapa, +0x28, es menor que 4: presentación, cuenta o carrera). Una
  // sola vigía para los que necesitan saberlo; cada uno se anota en alCambiarCarrera y recibe true/false al cambiar.
  setInterval(() => {
    let ahora = false;
    try { const L = window.mkwMenus, ri = L?.u32(0x809BD730); ahora = !!ri && L.u32(ri + 0x28) < 4; } catch {}
    if (ahora === hayCarrera) return;
    hayCarrera = ahora; window.mkwEstado.enCarrera = ahora;
    for (const f of alCambiarCarrera) try { f(ahora); } catch (e) { console.warn('[carrera] ' + e); }
  }, 200);
  // §169 (D4, U2, D1 en un jugador): el paquete de carrera. Fuera de la carrera, cada 200 ms se mira la ficha que
  // armó el juego (la pista y los 12 puestos); si es nueva, se pide todo lo que va a leer (paquete-carrera.mjs).
  // ?paqueteCarrera=0 = sin esto.
  if (parametros.get('paqueteCarrera') !== '0' && disco.estado && parametros.get('adelantar') !== '0') {
    paqueteCarrera = crearPaquete({ L: window.mkwMenus, disco, tamaños, direccion, grupos: gruposPorNombre, skins: () => leerSkins(M), nota,
                                   pistaTemprana: parametros.get('pistaTemprana') !== '0', alPista: pipelinesDePista,
                                   ultima: parametros.get('musicaUltima') !== '0', fanfarrias: parametros.get('fanfarriaEntera') !== '0',   // (§285)
                                   musica: parametros.get('musicaPaquete') !== '0', comun: parametros.get('comunCarrera') !== '0', vocesAmbas: parametros.get('vocesAmbas') !== '0',
                                   memoria: parametros.get('aprender') !== '0' ? crearMemoriaLocal() : null });
    window.mkwEstado.paquete = paqueteCarrera.estado;
    // §176 (D1): lo que la carrera tuvo que bajar (mkwFaltas desde que empezó) se aprende para esa pista
    let faltasDesde = 0, pistaCorre = -1;
    alCambiarCarrera.push(corre => {
      const faltas = disco.estado.faltas || [];
      if (corre) { faltasDesde = faltas.length; try { pistaCorre = window.mkwMenus.u32(0x8043319C + 0x10); } catch { pistaCorre = -1; } }
      else if (pistaCorre >= 0) { paqueteCarrera.aprender(pistaCorre, faltas.slice(faltasDesde)); pistaCorre = -1; }
    });
    // (también en la presentación, etapa 0 del Raceinfo: Retro Rewind sortea las skins al crear la carrera, después de
    // que aparece el Raceinfo, y los karts se leen recién ahí; desde la cuenta, nada)
    setInterval(() => {
      if (!window.mkwMenus?.estado) return;
      if (hayCarrera) { try { const L = window.mkwMenus, ri = L.u32(0x809BD730); if (ri && L.u32(ri + 0x28) >= 1) return; } catch { return; } }
      paqueteCarrera.revisar();
    }, 200);
  }
  // §285 (el dueño: «todos los jugadores deben empezar al mismo tiempo y tener la carrera descargada al 100 %; pone un
  // aviso de pausa»): en la sala, cada 250 ms le digo a la sala cuánto bajé del paquete de la carrera en curso; al
  // aparecer la carrera me quedo quieta en su primer cuadro (lockstep.congelarEn(1) + mkw_congelar: el juego sigue
  // dibujando la misma imagen) hasta que la anfitriona anota paqueteOk de esta carrera y llega su hora («en», la misma
  // en todas). Con «Cada uno su kart» no hay lockstep: me congelo apenas aparece. ?esperarPaquete=0 = como antes
  if (paqueteCarrera && sincro && parametros.get('esperarPaquete') !== '0') {
    const espera = { n: 0, congelada: false, pedida: false, veces: 0, aviso: '' };
    const lento = Number(parametros.get('paqueteLento')) || 0;   // (solo pruebas: una consola lenta para bajar)
    window.mkwEstado.esperaPaquete = espera;
    const ls = () => RED_ESTADO_SALA ? null : sincro?.lockstep || null;
    const soltarEspera = por => {
      if (espera.congelada) { try { ls()?.congelar(false); } catch {} try { window.mkw?._mkw_congelar?.(0); } catch {}
        nota(`§285: sigue la carrera ${espera.n} (${por})`); }
      if (espera.congelada) { espera.soltadaSala = Date.now() + (window.mkwSala?.desfase || 0); espera.msQuieta = Math.round(performance.now() - espera.congeladaT); espera.por = por; }
      espera.congelada = false; espera.pedida = false; espera.soltada = espera.n; avisoPausa.ocultar();
    };
    // (al empezar el cuadro 1 de cada carrera —el lockstep avisa: alPrimerCuadro—; antes se miraba el cambio de «hay
    // carrera», que en la sala puede estar prendido desde antes y no avisaba)
    const quieta = c => {
      const e = window.mkwSala?.estado?.();
      if (!e || e.fase !== 'correr' || !(e.carrera >= 1) || e.paqueteOk?.n === e.carrera || espera.soltada === e.carrera || espera.congelada) return;
      espera.n = e.carrera; espera.pedida = true;
      espera.congelada = true; espera.veces++; espera.congeladaT = performance.now(); window.mkw?._mkw_congelar?.(1); ls()?.congelar(true);
      nota(`§285: quieta en el cuadro ${c ?? 0} de la carrera ${espera.n} hasta que todos tengan la carrera bajada`);
    };
    alCambiarCarrera.push(corre => { if (!corre && (espera.pedida || espera.congelada)) soltarEspera('terminó'); });
    setInterval(() => {
      const sala = window.mkwSala, e = sala?.estado?.();
      if (!sala || !e) return;
      if (ls()) ls().alPrimerCuadro?.(quieta);
      else if (RED_ESTADO_SALA && hayCarrera && !espera.congelada) quieta(null);   // (sin lockstep: apenas aparece la carrera)
      if (e.fase === 'correr' && paqueteDeCarrera === e.carrera) { try { let pct = paqueteCarrera.progreso().pct; const el = performance.now() - paqueteFichaT;
        if (lento && el < lento) pct = Math.min(pct, Math.floor(99 * el / lento)); sala.paquete?.(e.carrera, pct); } catch {} }
      if (!espera.pedida) return;
      const ok = e.paqueteOk;
      if (e.carrera !== espera.n) { soltarEspera('otra carrera'); return; }
      if (ok?.n === espera.n && sala.restan(ok.en) <= 0) { soltarEspera(ok.sin ? `tope: sin ${ok.sin.join(', ')}` : 'todos listos'); return; }
      if (!espera.congelada) return;
      const de = e.paqueteFaltan?.n === espera.n ? e.paqueteFaltan.de || {} : {};
      avisoPausa.poner(() => {
        const f = Object.entries(de).map(([u, pct]) => `${window.mkwNombreDe?.(u) || 'un piloto'} ${pct} %`);
        const r = ['⏸ Esperando a que todos carguen la carrera…',
                f.length ? `Faltan: ${f.join(', ')}. Todos parten juntos apenas terminen.` : 'Todos parten juntos en un momento.'];
        espera.aviso = r.join(' '); return r;
      });
    }, 250);
  }
  // §174 (D8): al abrir el primer video (el del título), el principio de los demás videos de los menús, de fondo
  // (videos-menu.mjs). ?videosCabeza=MB (2 por omisión; 0 = sin esto)
  {
    const mbCabeza = parametros.has('videosCabeza') ? Number(parametros.get('videosCabeza')) : 2;
    if (mbCabeza > 0 && disco.estado && parametros.get('adelantar') !== '0') {
      videosMenu = crearVideosMenu({ disco, tamaños, direccion, cabeza: mbCabeza * 1048576, nota, enCarrera: () => hayCarrera });
      window.mkwEstado.videosMenu = videosMenu.estado;
    }
  }
  // §121 (D2): mientras corre una carrera, la fila baja del disco (la semilla de bloques, las voces de las CPU, los
  // diminutos) queda en pausa: la red y el hilo, para la carrera; sigue en la meta y en los menús. Lo que el juego tuvo
  // que bajar en plena carrera queda en mkwFaltas() (para el paquete de carrera, D1). ?pausaCarrera=0 = como antes.
  if (parametros.get('pausaCarrera') !== '0' && disco.pausarBaja) {
    alCambiarCarrera.push(corre => {
      disco.pausarBaja(corre);
      nota(corre ? `carrera: descargas de fondo en pausa (${disco.estado.colaBaja()} en fila)` : `carrera terminada: descargas de fondo otra vez (${disco.estado.colaBaja()} en fila)`);
    });
    window.mkwFaltas = () => disco.estado.faltas.slice();
    window.mkwRedEnCarrera = () => (disco.estado.redEnCarrera || []).slice();   // (§176: lo que de verdad fue a la red en la carrera)
    // (cada pedido anota la etapa del Raceinfo de ese momento: 0 presentación, 1 cuenta, 2 carrera andando, ≥ 4 resultados;
    //  3 = la carrera sigue pero el jugador de esta pantalla ya cruzó la meta —Racedata +0x20 +0xB64 = su puesto, como en
    //  dnf.mjs; RaceinfoPlayer +0x38 bit 2 = llegó—: ahí suena la fanfarria y ya no se maneja)
    disco.estado.marcaRed = () => {
      const L = window.mkwMenus, ri = L?.u32(0x809BD730); if (!ri) return -1;
      const etapa = L.u32(ri + 0x28); if (etapa !== 2) return etapa;
      const rd = L.u32(0x809BD728), yo = rd ? L.u8(rd + 0x20 + 0xB64) : 0xFF, lista = L.u32(ri + 0xC), pl = yo < 12 && lista ? L.u32(lista + 4 * yo) : 0;
      return pl && (L.u32(pl + 0x38) & 2) ? 3 : 2;
    };
  }
  // §174 (C2): aurora sabe dónde está el juego (los menús o la pista de la carrera) y anota así cada pipeline que usa;
  // al arrancar precalienta solo lo de los menús y lo común, y lo de cada pista cuando se elige (pipelinesDePista,
  // desde el paquete de carrera). ?pipelinesPista=0 = como antes (todo al arrancar)
  if (PIPELINES_POR_PISTA && M._mkw_web_pipelines_etiqueta) {
    window.mkwEstado.pipelinesPista = { pedidas: [], ultima: null };
    alCambiarCarrera.push(corre => {
      let pista = 0;
      try { pista = window.mkwMenus.u32(0x8043319C + 0x10); } catch {}
      M._mkw_web_pipelines_etiqueta(corre ? 0x10000 + pista : 0);
    });
    // §203 (W8): ?soltarPipelines=1 = al entrar a la carrera de una pista, aurora suelta los pipelines que solo se usaron
    // en otras pistas (cada uno ~2 MB en el proceso de la tarjeta); vuelven precalentados si esa pista vuelve.
    // Sin el parámetro o con 0 = guardarlos todos, como antes. mkwEstado.pipelinesSoltados() = cuántos se soltaron
    if (M._mkw_web_pipelines_soltar) {
      // §248 (W26): en el TELÉFONO, por omisión, el conjunto acotado: soltar lo de las pistas viejas (y los sombreadores,
      // 2) guardando las últimas 4 (una copa entera no vuelve a preparar nada); en una sesión larga la memoria de la
      // tarjeta queda con tope (medido: ~1,8 GB de pico contra 2,3 GB y subiendo en 16 carreras, en este PC). En el PC
      // sigue como antes (todo guardado). ?soltarPipelines=0|1|2|3 y ?pistasGuardadas=K mandan sobre esto
      const acotado = esTelefono && !parametros.has('soltarPipelines') && M._mkw_web_pipelines_guardar;
      M._mkw_web_pipelines_soltar(acotado ? 2 : modoSoltarPipelines(parametros.get('soltarPipelines')));
      // ?pistasGuardadas=K = las últimas K pistas (la de ahora incluida) guardan sus pipelines; solo se sueltan las más viejas
      if (parametros.get('pistasGuardadas') || acotado) M._mkw_web_pipelines_guardar?.(Number(parametros.get('pistasGuardadas')) || 4);
      window.mkwEstado.pipelinesAcotado = acotado;
      window.mkwEstado.pipelinesSoltados = () => M._mkw_web_pipelines_soltar(-1);
    }
  }
  // §252 (G11): los efectos de la escena que el jugador apagó (Gráficos) o ?quitarEfectos=N (bits: 1 brillo,
  // 2 profundidad de campo, 4 sombras por volumen, 8 mapa de luz, 16 partículas: G13 §254); solo el dibujo: la carrera es la misma
  const quitar = parametros.has('quitarEfectos') ? (Number(parametros.get('quitarEfectos')) | 0) & 31 : leerGraficos().quitar;
  M._mkw_graficos_quitar?.(quitar);
  window.mkwEstado.efectosQuitados = M._mkw_graficos_quitar ? quitar : 0;
  // §253 (G12): las texturas más chicas (Gráficos «Texturas» o ?texturasMenos=0|1|2: la mitad o un cuarto, saltando los
  // niveles de detalle más grandes que el juego ya trae); antes de callMain, así valen desde la primera textura
  const menos = parametros.has('texturasMenos') ? Math.max(0, Math.min(2, Number(parametros.get('texturasMenos')) | 0)) : leerGraficos().texturas;
  M._mkw_web_texturas_menos?.(menos);
  window.mkwEstado.texturasMenos = () => M._mkw_web_texturas_menos_dato
    ? { k: M._mkw_web_texturas_menos_dato(4), achicadas: M._mkw_web_texturas_menos_dato(0), kb: M._mkw_web_texturas_menos_dato(1),
        kbEnteras: M._mkw_web_texturas_menos_dato(2), conMips: M._mkw_web_texturas_menos_dato(3) }
    : null;
  // §177.2 (G2): aurora descarta la profundidad de las pasadas que nadie vuelve a leer (la siguiente que la usa la
  // limpia); en las tarjetas por baldosas de los teléfonos ahorra llevarla a la memoria principal. ?descartarZ=0 = guardar siempre
  if (parametros.get('descartarZ') === '0') M._mkw_web_profundidad?.(0);
  window.mkwEstado.zDescartadas = () => M._mkw_web_profundidad_cuenta?.() ?? null;
  // §205 (W9): ?huesosFilas=1 = el camino de reserva de las Adreno 6xx/7xx (las matrices de los huesos leídas por
  // filas; la misma imagen). Apagado por omisión, también en las Adreno: se prende con el primer informe de un jugador
  if (modoHuesosFilas(parametros.get('huesosFilas'))) M._mkw_web_huesos_filas?.(1);
  window.mkwEstado.huesosFilas = modoHuesosFilas(parametros.get('huesosFilas')) === 1 && !!M._mkw_web_huesos_filas;
  // §248 (W26): ?wgslCompartido=1 = las configuraciones que dan el mismo texto WGSL comparten el módulo compilado
  if (parametros.get('wgslCompartido') === '1') M._mkw_web_wgsl_compartir?.(1);
  window.mkwEstado.wgsl = () => M._mkw_web_wgsl ? { armados: M._mkw_web_wgsl(0), textos: M._mkw_web_wgsl(1), reusados: M._mkw_web_wgsl(2), compartidos: M._mkw_web_wgsl(3) } : null;
  // §204 (W20): ?piscina=1 = aurora suelta las texturas de copia de repuesto que nadie pidió en 300 cuadros (KartPad
  // 0cca4d2); ?piscina=0 o nada = guardarlas como antes. mkwEstado.piscina() = cuántas hay, sus MB y las soltadas
  if (modoPiscina(parametros.get('piscina')) !== null) M._mkw_web_piscina?.(modoPiscina(parametros.get('piscina')));
  window.mkwEstado.piscina = () => M._mkw_web_piscina_dato
    ? { texturas: M._mkw_web_piscina_dato(0), mb: Math.round(M._mkw_web_piscina_dato(1) * 10) / 10,
        sueltas: M._mkw_web_piscina_dato(2), modo: M._mkw_web_piscina_dato(3) }
    : null;
  // §190 (G6): las texturas CMPR que subieron en BC1: { bc, kbBc, kbRgba, no, vistas } (null = programa sin G6)
  window.mkwEstado.texturasBc = () => {
    const f = M._mkw_web_texturas_bc; if (!f) return null;
    const r = { bc: f(0), kbBc: f(1), kbRgba: f(2), no: f(3), vistas: f(4) };
    // ?texturasBc=verifica: cada BC1 comparada con la RGBA8 de siempre (peor canal, miles de texeles, PSNR dB, texeles > 8 tonos)
    if (f(6)) Object.assign(r, { peor: f(5), milTexeles: f(6), psnr: f(7) / 100, mas8: f(8) });
    return r;
  };
  // §179 (G1): cuántas veces el dibujo de la sala usó las marcas de verdad (0 fuera de la sala o con ?recorteDibujo=0)
  window.mkwEstado.recortesDibujo = () => M._mkw_recortes_dibujo?.() ?? null;
  window.mkwEstado.dibujosEnteros = () => M._mkw_dibujos_enteros?.() ?? null;   // (§179.2: ScnMgr::DrawMain con las marcas de verdad)
  // §192 (R2): saltarse el dibujo de un cuadro sin tocar la lógica. ?saltarDibujo=N = uno de cada N cuadros (solo para
  // probar; N8 lo pedirá cuadro por cuadro con Module._mkw_dibujo_saltar(1)); ?saltarDibujoModo=1 = el juego dibuja igual
  // y solo queda la marca para aurora (mkw_dibujo_este_saltado). Apagado por omisión
  {
    const n = Number(parametros.get('saltarDibujo')) || 0;
    if (n > 1) M._mkw_dibujo_patron?.(n);
    if (parametros.get('saltarDibujoModo') === '1') M._mkw_dibujo_modo?.(1);
  }
  window.mkwEstado.dibujosSaltados = () => M._mkw_dibujos_saltados ? { total: M._mkw_dibujos_saltados(), juego: M._mkw_dibujos_saltados_juego() } : null;
  // §219 (N8): con la carrera andando el juego dibuja uno de cada dos cuadros (la lógica sigue a 60). ?n8=1 = solo eso
  // (30 a la vista); ?n8=2 = además la imagen de entre medio de aurora (60 a la vista, un cuadro más de demora).
  // n8_nativo.cpp. Al terminar cada carrera, «[n8]» al registro
  if (M._mkw_n8_modo) {
    // (sin ?n8 vale lo que eligió el jugador en Gráficos, «Dibujar a 30 y mostrar 60»: Automático por omisión, decisión
    // del dueño 2026-11-04; quien eligió «No» a mano lo mantiene. Las pruebas y mediciones con Playwright
    // (navigator.webdriver) van sin N8 salvo que lo pidan con ?n8=…: así comparan contra la base como siempre)
    const n8Guardado = navigator.webdriver === true ? '0' : String(leerGraficos().n8);
    const e = i => M._mkw_n8_estado(i);
    window.mkwEstado.n8 = () => ({ modo: e(6), activo: !!e(7), dibujados: e(0), saltados: e(1), copiasSaltadas: e(2),
                                   realesEnSaltado: e(3), guardadas: e(8), mostradas: e(9), descartadas: e(10), sinIntermedia: e(11),
                                   realesAlDibujar: e(13), esperaRealMs: e(9) + e(13) ? e(12) / (e(9) + e(13)) : 0,
                                   pedido: e(14), cambiosModo: e(15), eleccion: imagenElegida,
                                   menus: e(16) === 1, saltadosMenus: e(17) });   // (§270: permitido en el menú de ahora, saltados fuera de la carrera)
    // (2026-11-07: en un teléfono Automático prende «30 parejas», el modo 1; en un PC, el 2: modoAutomatico de n8.mjs)
    const modoAuto = modoAutomatico({ telefono: esTelefono || parametros.get('comoTelefono') === '1' });
    let imagenElegida = null;
    // §273: en elegir personaje Automático usa «30 parejas» (modo 1) también en un PC. Ahí casi todo es 2D, que con la
    // imagen del medio igual va a 30, y el modo 2 le pide más a la CPU: medido en la gama baja con la sala, la lógica
    // 49/s con el modo 2 y 60/s con el 1. ?n8MenusModo=2 = el mismo modo que en la carrera (antes)
    const MENUS_MODO_1 = parametros.get('n8MenusModo') !== '2';
    const modoAutoAhora = () => (MENUS_MODO_1 && window.mkwEstado.n8Menus && !hayCarrera) ? 1 : modoAuto;
    n8AlCambiarMenus = () => {
      if (imagenElegida !== 'auto' || !vigiaN8?.estado.prendido) return;
      const m = modoAutoAhora(); M._mkw_n8_modo(m); nota(`[n8] Automático: modo ${m} (${window.mkwEstado.n8Menus ? 'elegir personaje' : 'fuera de elegir personaje'})`);
    };
    // §255 (G15): aplicar una elección de «Imagen» (Gráficos) en cualquier momento, sin reiniciar: 0 = 60, 1 = 30
    // parejas, 2 = con imagen intermedia, 'auto' = la vigía de n8.mjs (solo en el aparato que no llega a 60 por la CPU,
    // regla del dueño 2026-11-02). El juego cambia de modo en el cuadro siguiente que se dibuja (n8_nativo.cpp,
    // aplicarPedido); la lógica sigue a 60 en todas. window.mkwImagen(v) es esto mismo (el panel y las pruebas)
    const aplicarImagen = (v, por = 'el jugador') => {
      const pedido = modoPedido(v);
      if (pedido === imagenElegida) return;
      const antes = imagenElegida;
      imagenElegida = pedido;
      if (pedido === 'auto') {
        vigiaN8 = crearVigiaN8({ prender: p => { const m = modoAutoAhora(); M._mkw_n8_modo(m); nota(`[n8] se prende en modo ${m} (${p})`); },
                                 apagar: p => { M._mkw_n8_modo(0); nota(`[n8] se apaga (${p})`); },
                                 mismoLugar: parametros.get('n8MismoLugar') !== '0',   // (§283; ?n8MismoLugar=0 = como antes)
                                 menuNoPasa: parametros.get('n8MenuPasa') !== '1' && modoAuto !== 1,   // (§283: lo de elegir personaje no pasa a la carrera, solo en un PC: el teléfono lo sigue, §283.9; ?n8MenuPasa=1 = antes)
                                 probar: () => modoAutoAhora() !== 1 || parametros.get('n8Prueba1') === '1' });   // (§283.9: sin «no mejora» en el modo 1; ?n8Prueba1=1 = antes)
        window.mkwEstado.n8auto = vigiaN8.estado;
        if (!vigiaN8.estado.prendido) M._mkw_n8_modo(0);
      } else {
        vigiaN8 = null; delete window.mkwEstado.n8auto;
        M._mkw_n8_modo(pedido);
      }
      if (antes !== null) nota(`[n8] imagen: ${antes} → ${pedido} (${por})`);
    };
    window.mkwImagen = aplicarImagen;
    aplicarImagen(parametros.has('n8') ? parametros.get('n8') : n8Guardado, 'al arrancar');
    // ?imagenCiclo=S (solo pruebas, G15): cambia la imagen cada S segundos de carrera, 60 → 30 parejas → intermedia → 60…
    {
      const s = Number(parametros.get('imagenCiclo')) || 0;
      if (s > 0) {
        const ciclo = [0, 1, 2]; let k = 0;
        window.mkwEstado.imagenCiclo = { cambios: 0 };
        setInterval(() => {
          if (!window.mkwEstado.enCarrera) return;
          k = (k + 1) % ciclo.length; aplicarImagen(ciclo[k], 'ciclo de prueba'); window.mkwEstado.imagenCiclo.cambios++;
        }, s * 1000);
      }
    }
    const informe = (cuando) => {
      const s = window.mkwEstado.n8();
      if (!s.dibujados && !s.saltados) return;
      nota(`[n8] ${cuando}, modo ${s.modo} (elegido ${imagenElegida}, ${s.cambiosModo} cambios): ${s.dibujados} dibujados, ${s.saltados} saltados (copias ${s.copiasSaltadas}); aurora: ` +
           `${s.guardadas} reales guardadas, ${s.mostradas} mostradas en el saltado, ${s.realesAlDibujar} al empezar el dibujo siguiente, ${s.descartadas} descartadas, ` +
           `${s.sinIntermedia} sin intermedia; la real esperó ${s.esperaRealMs.toFixed(1)} ms de promedio`);
    };
    alCambiarCarrera.push(corre => { if (!corre && (imagenElegida === 1 || imagenElegida === 2 || window.mkwEstado.n8().saltados)) informe('fin de la carrera'); });
    // (con el tramo fijo de §163, también al cerrarlo: medir-sitio lo guarda en su .log)
    if (window.mkwEstado.tramo && (imagenElegida === 1 || imagenElegida === 2)) {
      const vigia = setInterval(() => { if (window.mkwEstado.tramo.resultado) { clearInterval(vigia); informe('tramo'); } }, 100);
    }
  }
  // §199 (W2): la colisión con la pista como isla. Solo con el programa de MKW_ISLA_COMPILAR=1 (isla_kcl_nativo.cpp):
  // ?isla=1 = la isla; ?isla=2 = el comprobador (las dos en cada llamada, compara el borde y mide cada una); sin el
  // parámetro, la traducida. La cuenta empieza con cada carrera y al terminarla va al registro («[isla]»)
  if (M._mkw_isla_modo) {
    const d = i => M._mkw_isla_dato(i);
    window.mkwEstado.isla = () => ({ modo: d(11), llamadas: d(0), porIsla: d(1), porTraducida: d(2), distintas: d(3),
      distintasVolatiles: d(4), avisos: d(5), sinSombra: d(6), sombras: d(7), comparadas: d(10),
      nsIsla: d(10) ? d(8) / d(10) * 1e6 : null, nsTraducida: d(10) ? d(9) / d(10) * 1e6 : null });
    M._mkw_isla_modo(modoIsla(parametros.get('isla')));
    alCambiarCarrera.push(corre => {
      if (corre) { M._mkw_isla_reiniciar(); return; }
      const s = window.mkwEstado.isla();
      nota(`[isla] modo ${s.modo}: ${s.llamadas} llamadas (${s.porIsla} por la isla), ${s.comparadas} comparadas, ` +
           `${s.distintas} distintas (${s.distintasVolatiles} solo en r4/f1), sin sombra ${s.sinSombra}` +
           (s.nsIsla != null ? `; isla ${s.nsIsla.toFixed(1)} ns, traducida ${s.nsTraducida.toFixed(1)} ns por llamada` : ''));
    });
  }
  // §200 (W3): ?techo=1 = el programa de MKW_TECHO_COMPILAR=1 esconde el modelo de la pista antes de cada dibujo (solo
  // para medir cuánto cuesta hoy dibujarlo); mkwEstado.techo() = modelos vistos, el de la pista y cuántas veces se escondió
  if (M._mkw_techo_modo) {
    // §222 (E4): ?techo=N es una suma de bits (1 pista, 2 efectos, 4 los modelos de la máscara ?techoOp=0x…)
    const modoT = modoTecho(parametros.get('techo'));
    if (modoT) M._mkw_techo_modo(modoT);
    if (M._mkw_techo_mascara) M._mkw_techo_mascara(mascaraTecho(parametros.get('techoOp')));
    window.mkwEstado.techo = () => ({ modelos: M._mkw_techo_dato(0), pista: M._mkw_techo_dato(1).toString(16),
                                      escondida: M._mkw_techo_dato(2), modo: M._mkw_techo_dato(3),
                                      efectosSinDibujar: M._mkw_techo_dato(4), escondidosUltimo: M._mkw_techo_dato(5),
                                      dibujosMascara: M._mkw_techo_dato(6), mascara: M._mkw_techo_dato(7),
                                      porOpcion: Array.from({ length: 24 }, (_, k) => M._mkw_techo_dato(10 + k)) });
  }
  // §205 (W9): una Adreno 6xx/7xx queda anotada en el registro (con el riesgo de los personajes invisibles)
  revisionGpu.then(r => { if (r.adreno?.adreno) nota(`[tarjeta] ${r.adreno.texto}`); });
  // §196 (W1): ¿el dibujo es un sumidero? Solo con el programa de MKW_SUMIDERO_COMPILAR=1 (sumidero_nativo.cpp):
  // ?sumidero=1 = contar las páginas de 4 KiB que cambia la carrera y las que cambia el dibujo en cada cuadro;
  // ?sumidero=2 = además deshacer lo que escribió el dibujo (salvo SwitchScnRoot). La cuenta empieza con cada carrera y
  // al terminarla va al registro («[sumidero]»); mkwEstado.sumidero() = lo de ahora. Sin el parámetro, nada
  if (M._mkw_sumidero_modo) {
    const d = i => M._mkw_sumidero_dato(i);
    window.mkwEstado.sumidero = () => {
      const n = d(0) || 1;
      return { modo: d(9), cuadros: d(0), carreraPag: d(1) / n, carreraMax: d(2), dibujoPag: d(3) / n, dibujoMax: d(4),
               carreraMB: d(1) / n * 4096 / 1048576, carreraMaxMB: d(2) * 4096 / 1048576, conservadosB: d(5) / n,
               deshechosB: d(6) / n, switches: d(7), arribaUsada: d(8) };
    };
    const modo = modoSumidero(parametros.get('sumidero'));
    if (modo > 0) {
      // deshacer (2) solo mientras corre una carrera: en los menús el juego SÍ usa lo que escribe su dibujo (§196: la
      // Contrarreloj por los menús se quedaba trabada); fuera de la carrera solo se cuenta (1)
      M._mkw_sumidero_modo(Math.min(modo, 1));
      alCambiarCarrera.push(corre => {
        if (corre) { M._mkw_sumidero_modo(modo); M._mkw_sumidero_reiniciar(); return; }
        const s = window.mkwEstado.sumidero();
        nota(`[sumidero] modo ${s.modo}, ${s.cuadros} cuadros: la carrera ${s.carreraPag.toFixed(1)} páginas por cuadro ` +
             `(${s.carreraMB.toFixed(2)} MB; máx ${s.carreraMax}, ${s.carreraMaxMB.toFixed(2)} MB), el dibujo ${s.dibujoPag.toFixed(1)} ` +
             `(máx ${s.dibujoMax}); SwitchScnRoot ${s.conservadosB.toFixed(0)} B por cuadro, deshechos ${s.deshechosB.toFixed(0)} B`);
        M._mkw_sumidero_modo(Math.min(modo, 1));
      });
    }
  }
  // §207 (W10): el techo y el costo de la caja del dibujo en otro Worker. Solo con el programa de MKW_W10_COMPILAR=1
  // (w10_nativo.cpp): ?w10=1 = la carrera sin dibujo (solo SwitchScnRoot), 2 = además juntar la caja de cada cuadro,
  // 3 = además mandarla a un Worker que la pega (w10.mjs, w10-dibujo.js), 4 = además comprobar la marca de las páginas;
  // 5, 6, 7 = 1, 2, 3 sin presentar nada (como el Worker de la carrera de W10).
  // Solo con la carrera andando (en los menús el dibujo no es un sumidero, §196); al terminarla, «[w10]» al registro
  if (M._mkw_w10_modo) {
    const modo = modoW10(parametros.get('w10'));
    const d = i => M._mkw_w10_dato(i);
    const mandadero = mandaCaja(modo) ? crearMandadero(M) : null;
    window.mkwEstado.w10 = () => {
      const n = d(0) || 1, nj = Math.max(1, d(0) - d(13));
      return { modo: d(15), cuadros: d(0), saltados: d(1), switches: d(2), paginas: d(3) / nj, paginasMax: d(4),
               kb: d(5) / nj / 1024, kbMax: d(6) / 1024, tramos: d(7) / nj, msJuntar: d(8) / nj, msJuntarMax: d(9),
               msMandar: d(10) / nj, sinMarcaB: d(11), sinMarcaPag: d(12), primeraSinMarca: d(16).toString(16),
               fotos: d(13), msFoto: d(14) / Math.max(1, d(13)), mandadero: mandadero?.estado ?? null, n };
    };
    // W24 (§227): cuánto se achica la caja para mandarla a un teléfono (al cerrar el tramo y al terminar la carrera)
    const notaCompresion = () => mandadero?.compresion().then(r => {
      window.mkwEstado.w24compresion = r;
      nota(`[w24] ${r.cajas} cajas, cruda ${r.crudaKB.toFixed(1)} KB por cuadro; ` + r.modos.map(m =>
        `${m.nombre} ${m.kb.toFixed(1)} KB (máx ${m.kbMax.toFixed(0)}, ×${m.razon.toFixed(2)}, ${m.mbitPor60.toFixed(1)} Mbit/s a 60, ` +
        `armar ${m.ms.toFixed(3)} ms, desarmar ${m.msDes.toFixed(3)} ms)`).join('; ') +
        `; deflate saltadas ${r.saltadas}, vueltas malas ${r.malasVuelta}`);
    });
    if (modo > 0) {
      // (sin presentar, 5–7: con el tramo fijo cerrado se vuelve a dibujar, así medir-sitio recibe sus imágenes)
      if (modo >= 5 && window.mkwEstado.tramo) {
        const vigia = setInterval(() => { if (window.mkwEstado.tramo.resultado) { clearInterval(vigia); M._mkw_w10_modo(0); notaCompresion(); } }, 50);
      }
      alCambiarCarrera.push(corre => {
        if (corre) { M._mkw_w10_reiniciar(); M._mkw_w10_modo(modo); return; }
        M._mkw_w10_modo(0);
        const s = window.mkwEstado.w10();
        nota(`[w10] modo ${modo}, ${s.cuadros} cuadros sin dibujo: ${s.paginas.toFixed(1)} páginas por cuadro (máx ` +
             `${s.paginasMax}), ${s.kb.toFixed(1)} KB (máx ${s.kbMax.toFixed(0)}), ${s.tramos.toFixed(0)} tramos; juntar ` +
             `${s.msJuntar.toFixed(3)} ms (máx ${s.msJuntarMax.toFixed(2)}), mandar ${s.msMandar.toFixed(3)} ms; sin marca ` +
             `${s.sinMarcaPag} páginas ${s.sinMarcaB} B (la primera ${s.primeraSinMarca})` +
             (s.mandadero ? `; Worker: ${s.mandadero.mandadas} cajas, ${s.mandadero.aplicadas} pegadas, sin caja ` +
                            `${s.mandadero.sinCaja}, malas ${s.mandadero.malos}` : ''));
        notaCompresion();
      });
    }
  }
  // §209 (W11): las pruebas de saltar, en el mismo programa de MKW_W10_COMPILAR=1: ?w11=máscara (1 = calcular los
  // efectos, 2 = el gestor de sonido del juego, 4 = el hilo de sonido) deja de correr eso con la carrera andando; al
  // terminarla, «[w11]» con cuántas veces se saltó cada uno. mkwEstado.w11()
  // §207.3: ?dibujarSiempre=1 = sin la compensación de lag de RR también jugando solo (como en la sala, §62): solo para
  // medir la gama baja simulada, donde la compensación se salta casi todos los dibujos
  if (parametros.get('dibujarSiempre') === '1') M._mkw_dibujar_siempre?.(1);
  const w11 = Number(parametros.get('w11')) & 7;
  if (M._mkw_w11_saltar && w11) {
    window.mkwEstado.w11 = () => ({ mascara: w11, efectos: M._mkw_w11_dato(0), sonido: M._mkw_w11_dato(1), hilo: M._mkw_w11_dato(2) });
    alCambiarCarrera.push(corre => {
      M._mkw_w11_saltar(corre ? w11 : 0);
      if (!corre) { const s = window.mkwEstado.w11(); nota(`[w11] máscara ${w11}: saltados efectos ${s.efectos}, sonido ${s.sonido}, hilo ${s.hilo}`); }
    });
  }
  // §140 (U1): mientras corre una carrera, el precalentado de pipelines se pausa (aurora deja de pedir los de su cola; lo
  // que el juego necesita para dibujar lo sigue pidiendo en el momento) y sigue en los menús. ?pausaPrecalentado=0 = no
  // §174 (C2): si a la pista recién elegida le quedan pipelines en la cola, la pausa espera a la cuenta (etapa 1): la
  // presentación de la pista los alcanza a pedir
  if (parametros.get('pausaPrecalentado') !== '0' && M._mkw_web_pipelines_pausa) {
    window.mkwEstado.pausaPrecalentado = { veces: 0, enCola: [], esperoCuenta: 0 };
    let vigiaCuenta = null;
    // §273: la pausa tiene dos motivos que se suman: la carrera andando (§140) y la pantalla de elegir personaje,
    // vehículo o derrape (la que más dibuja de los menús: armar pipelines ahí, de fondo, daba los tirones del 1 % bajo
    // en la gama baja). Lo que queda en la cola se arma en lo demás: la carga, el selector, el descanso.
    // Solo en el aparato que no llega a 60: con N8 prendido en esa pantalla (Automático lo prende ahí si no llega; o el
    // jugador lo eligió). En este PC la cola se termina en 14-20 s y pausarla solo atrasaba lo que la pantalla misma
    // necesita (medido: 70 dibujos saltados al entrar, contra 14). ?pausaPersonaje=0 = solo en la carrera, como antes;
    // ?pausaPersonaje=siempre = también sin N8 (para medir)
    const motivos = { carrera: false, personaje: false };
    let pausadoAhora = false;
    const aplicarPausa = porque => {
      const quiero = motivos.carrera || motivos.personaje;
      if (quiero === pausadoAhora) return;
      pausadoAhora = quiero;
      const enCola = M._mkw_web_pipelines_pausa(quiero ? 1 : 0);
      const p = window.mkwEstado.pausaPrecalentado;
      if (quiero) { p.veces++; p.enCola.push(enCola); }
      nota(quiero ? `${porque}: precalentado en pausa (${enCola} en su cola)` : `${porque}: precalentado otra vez (${enCola} en su cola)`);
    };
    const pausar = () => { motivos.carrera = true; aplicarPausa('carrera'); };
    if (parametros.get('pausaPersonaje') !== '0') {
      window.mkwEstado.pausaPrecalentado.personaje = 0;
      setInterval(() => {
        const pila = window.mkwMenus?.estado?.().paginas || [];
        const n8Prendido = parametros.get('pausaPersonaje') === 'siempre' || (M._mkw_n8_estado?.(6) ?? 0) > 0;
        const si = !hayCarrera && n8Prendido && pila.some(id => PAGINAS_N8.has(id));
        if (si === motivos.personaje) return;
        motivos.personaje = si;
        if (si) window.mkwEstado.pausaPrecalentado.personaje++;
        aplicarPausa(si ? 'elegir personaje' : 'fuera de elegir personaje');
      }, 250);
    }
    alCambiarCarrera.push(corre => {
      clearInterval(vigiaCuenta); vigiaCuenta = null;
      if (!corre) {
        motivos.carrera = false;
        aplicarPausa('carrera terminada');
        return;
      }
      // (§273: si elegir personaje dejó pipelines en la cola, también se espera a la cuenta: la carga y la presentación
      // de la pista los arman, así no faltan en la carrera)
      const dePersonaje = motivos.personaje || window.mkwEstado.pausaPrecalentado.personaje > 0;
      motivos.personaje = false;
      if (!(PIPELINES_POR_PISTA && pipelinesPistaRecientes()) && !dePersonaje) return pausar();
      aplicarPausa('la carga de la carrera');
      window.mkwEstado.pausaPrecalentado.esperoCuenta++;
      vigiaCuenta = setInterval(() => {
        let etapa = 9;
        try { const L = window.mkwMenus, ri = L.u32(0x809BD730); etapa = ri ? L.u32(ri + 0x28) : 9; } catch {}
        if (etapa >= 1) { clearInterval(vigiaCuenta); vigiaCuenta = null; if (hayCarrera) pausar(); }
      }, 100);
    });
  }
  // §122 (D13): el guardado de la partida y la lista de pipelines esperan a que termine la carrera (?aplazarGuardado=0 = no)
  if (parametros.get('aplazarGuardado') !== '0') { guardado.aplazarMientras(() => hayCarrera); pipelines.aplazarMientras(() => hayCarrera); }
  // §118: al terminar cada carrera se vuelve a pedir la persistencia (Chrome la concede con el uso: no muestra nada)
  if (parametros.get('persistir') !== '0')
    alCambiarCarrera.push(corre => { if (!corre) persistencia.pedir('carrera').then(si => { pintarPartidas(); if (si) nota('almacenamiento persistente: concedido al terminar una carrera'); }); });
  window.mkwEstado.horaMain = Date.now();  // los archivos con fecha posterior los escribió el juego
  // La base de Mii con al menos un Mii (si estaba vacía se pone uno y se guarda solo, ya con el guardado vigilando):
  // con él el juego crea la licencia 1 si la partida es nueva, al abrir directo (directo.mjs)
  if (DIRECTO) {
    // §86: con la base vacía, el Mii de la licencia nueva es el invitado del juego elegido (si ya están en este navegador)
    const miiLicencia = prepararMii(M.FS, parametros.get('nombre') || 'Piloto', { invitados: await leerInvitados(), elegido: invitadoElegido() });
    directo.ponerMii(miiLicencia);
    if (miiLicencia.nueva) nota(`directo: base de Mii vacía, puse un Mii para la licencia${miiLicencia.invitado >= 0 ? ` (el invitado ${LETRAS_INVITADO[miiLicencia.invitado]})` : ''}`);
    // …y si todavía no estaban (primera visita): se sacan del juego en su primer menú y ese Mii toma la cara del invitado.
    // (Sacarlas detiene ese cuadro ~40 ms, una vez por navegador: con Playwright no, salvo ?invitados=1, para no
    // ensuciar las pruebas que miden el ritmo; ?invitados=0 = nunca. «Mi Mii» las pide igual si hacen falta.)
    const sacarInvitados = parametros.get('invitados') === '1' || (parametros.get('invitados') !== '0' && !navigator.webdriver);
    if (miiLicencia.nueva && miiLicencia.invitado < 0 && sacarInvitados)
      asegurarInvitados(M, { nota }).then(r => {
        if (r && mejorarMiiNuevo(M.FS, r, miiLicencia.createId)) nota('invitados: el Mii de la licencia nueva tomó la cara del invitado (se ve desde el próximo arranque)');
      });
  }
  if (parametros.get('adelantar') !== '0' && parametros.get('semillaArranque') !== '0') adelantarArranque(tamaños);   // §76
  nota('arrancando main() — el juego corre');
  if (!cartel.activo) ui.cortina('Arrancando…');
  M.callMain([]);
}

// Qué bloques leyó el juego, sin los videos THP (esos los adelanta la lectura seguida), con el cuadro de la primera
// vez (la semilla solo usa los que se leyeron por primera vez después del título, cuadro 300): guion.mjs --semilla lo junta con otras corridas en bloques.json (la semilla de
// bloques), que la próxima primera visita baja de antemano con prioridad baja (bitácora §52).
const lecturasVistas = new Map();       // "ruta|bloque" → [ruta, bloque, cuadro, tamaño]
let paqueteCarrera = null;                // (§169: el paquete de carrera, paquete-carrera.mjs)
let paqueteDeCarrera = 0;                 // (§285: la carrera de la sala cuya ficha se pidió por último)
let paqueteFichaT = 0;                    // (§285: cuándo; con ?paqueteLento=ms —solo pruebas— el % no pasa de lo proporcional)
let videosMenu = null;                    // (§174, D8: el principio de los videos de los menús, videos-menu.mjs)
// §174 (C2): los pipelines de una sola pista esperan a que se elija esa pista (aurora: mkw_web_pipelines_pista)
const PIPELINES_POR_PISTA = parametros.get('pipelinesPista') !== '0';
let pipelinesPistaHora = -Infinity;
function pipelinesDePista(pista) {
  const M = window.mkw;
  if (!PIPELINES_POR_PISTA || !M?._mkw_web_pipelines_pista || !(pista >= 0)) return;
  const n = M._mkw_web_pipelines_pista(0x10000 + pista);
  const e = window.mkwEstado.pipelinesPista;
  if (e) { e.ultima = { pista, n, t: Math.round(performance.now()) }; if (n) e.pedidas.push([pista, n]); }
  if (n) { pipelinesPistaHora = performance.now(); nota(`pipelines de la pista ${pista}: ${n} a la cola de precalentado`); }
}
// (¿se pidieron pipelines de pista hace poco? Entonces la pausa de §140 espera a la cuenta)
const pipelinesPistaRecientes = () => performance.now() - pipelinesPistaHora < 60000;
const gruposPorNombre = new Map();       // nombre del grupo de revo_kart.brsar → [inicio, fin)
function anotarLectura(ruta, tam, inicio, largo) {
  const cuadro = window.mkwEstado.cuadros || 0;
  paqueteCarrera?.alLeer(ruta);
  videosMenu?.alLeer(ruta);
  // §251: un archivo de pista que el juego lee con una pista elegida queda atado a ella (así se sabe qué es de cada pista,
  // también de las de Nintendo y las de Retro Rewind con nombre, sin adivinar)
  if (esDePista(ruta)) { const p = pistaDelJuego(); if (p >= 0) usoPistas.archivo(p, ruta); }
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
// (§104: por la caché del disco, con la versión de los archivos: en la 2.ª visita no llama al Worker)
// (§168, D9: ?bloques=<nombre>.json = otra semilla de la misma carpeta, p. ej. la vieja para comparar)
const ARCHIVO_BLOQUES = /^[\w.-]+\.json$/.test(parametros.get('bloques') || '') ? parametros.get('bloques') : 'bloques.json';
const leerSemillaBloques = () => semillaBloques ??= (disco && parametros.get('lote') !== '0'
  ? disco.entero(ORIGEN + '/build/' + ARCHIVO_BLOQUES).then(b => JSON.parse(new TextDecoder().decode(b)))
  : fetch(ORIGEN + '/build/' + ARCHIVO_BLOQUES, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)).catch(() => null);
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
  // (§169: con el paquete de carrera, la voz de cada CPU se pide en su carrera: las 42 de antemano, solo con ?voces=1)
  const voces = parametros.get('voces') === '1' || (parametros.get('voces') !== '0' && !paqueteCarrera) ? bloquesVocesCpu(tamaños) : [];
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
  const t0 = performance.now();
  // §130 (C6): cada carpeta se crea una sola vez (antes, mkdirTree recorría la ruta entera por cada uno de los ~6.000
  // archivos). ?armadoRapido=0 = como antes
  const hechas = new Set();
  const carpeta = parametros.get('armadoRapido') === '0' ? ruta => FS.mkdirTree(ruta.slice(0, ruta.lastIndexOf('/')))
    : ruta => { const c = ruta.slice(0, ruta.lastIndexOf('/')); if (!hechas.has(c)) { FS.mkdirTree(c); hechas.add(c); } };
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
  // §130 (C6): cuánto tarda armar el sistema de archivos (una sola tarea, antes de callMain)
  window.mkwEstado.armado = { ms: Math.round((performance.now() - t0) * 10) / 10, archivos: (contenidos.size ?? contenidos.length) + (tamaños.size ?? tamaños.length),
    mb: Math.round([...contenidos].reduce((s, [, d]) => s + (d.byteLength || d.length || 0), 0) / 1e5) / 10 };
  escribe(`armar archivos (§130): ${window.mkwEstado.armado.archivos} en ${window.mkwEstado.armado.ms} ms (${window.mkwEstado.armado.mb} MB con contenido)`);
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
    '[video]', 'widescreen = true', `force_16_9 = ${parametros.get('aspecto') === 'libre' ? 'false' : 'true'}`,
    ...lineasVideo(graficosArranque), '',   // §107: resolución interna y fluidez (con lo de siempre, nada)
    '[paths]', 'dvd_root = "/mkw/disco"', 'retro_rewind_root = "/mkw/sd/RetroRewind6"', '',
  ].join('\n'));
  if (lineasVideo(graficosArranque).length) nota('gráficos (§107): ' + lineasVideo(graficosArranque).join(', '));
  m.ENV.XDG_DATA_HOME = '/datos';       // la "AppData" del juego (Config, NAND, registros)
  // ?thp=traducido: los videos THP con el decodificador traducido del juego (el de antes, para comparar);
  // ?thp=comparar: los dos, y anota en la consola cuánto difieren y cuánto tarda cada uno (bitácora §47).
  // Sin el parámetro: el decodificador nativo (web/thp/thp_nativo.cpp).
  if (parametros.has('thp')) m.ENV.MKW_THP = parametros.get('thp');
  if (parametros.get('thpDirecto') === '0') m.ENV.MKW_THP_DIRECTO = '0';   // §174 (D8): copiar cada cuadro como antes
  // ?rutas=traducido: buscar los archivos en el índice del disco siempre con la función del juego (como antes);
  // ?rutas=comparar: con la búsqueda nativa, comprobando cada respuesta contra la del juego; ?rutas=listar: anota
  // cada nombre buscado. Sin el parámetro: la búsqueda nativa con tabla hash (web/dvd/rutas_nativo.cpp, bitácora §50).
  if (parametros.has('rutas')) m.ENV.MKW_RUTAS = parametros.get('rutas');
  if (parametros.has('decomp')) m.ENV.MKW_DECOMP = parametros.get('decomp');   // §280: la función decompilada (solo build/web-decomp): 0 traducida, 1 nueva, 2 comprobar
  // ?pipelines=sincronico: crear cada pipeline nuevo en el momento, frenando el cuadro (como antes, para comparar;
  // bitácora §51). Sin el parámetro: en segundo plano, saltando el dibujo hasta que llegue.
  if (parametros.has('pipelines')) m.ENV.MKW_PIPELINES = parametros.get('pipelines');
  // Precalentado postergado (§76): aurora lee las listas igual, pero los pedidos esperan a la primera pantalla del juego
  // (de a 2 por cuadro: ya suena la música del título; ?precalentarRitmo=N para probar otro ritmo).
  // §117: con tope (lo de siempre) va «tarde:ritmo:tope» y la página lo suelta en cuanto arranca main() (más abajo);
  // sin tope y sin postergar, nada (aurora pide todo de a 8 por cuadro, sin límite: lo de antes).
  if (PIPELINES_POR_PISTA) m.ENV.MKW_PIPELINES_ETIQUETA = '1';   // §174 (C2)
  if (EN_CAMINO_MAX > 0) m.ENV.MKW_PRECALENTAR = `tarde:${PRECALENTAR_RITMO}:${EN_CAMINO_MAX}`;
  else if (PRECALENTAR_TARDE) m.ENV.MKW_PRECALENTAR = 'tarde' + (parametros.has('precalentarRitmo') ? ':' + parametros.get('precalentarRitmo') : '');
  if (parametros.has('staging')) m.ENV.MKW_STAGING = parametros.get('staging');   // ?staging=mapeo: búfer mapeado viejo (§53)
  // §181 (G3/H12): ?anillo=0 = subir todo en cada lote como antes; ?anillo=verifica = comparar cada acierto con su huella
  if (envAnillo(parametros.get('anillo'))) m.ENV.MKW_ANILLO = envAnillo(parametros.get('anillo'));
  // §190 (G6): ?texturasBc=1 = las texturas CMPR de la Wii suben comprimidas (BC1) a la tarjeta; sin nada, como antes
  // E4c (C2): con el paquete de las chicas van en BC1 por omisión; ?texturasBc=0 las apaga
  if (['0', '1', 'verifica'].includes(parametros.get('texturasBc'))) m.ENV.MKW_TEXTURAS_BC = parametros.get('texturasBc');
  // §181 (N14): ?caliente=0|1|comprobar = las funciones calientes traducidas, reescritas o las dos comparadas
  if (envCaliente(parametros.get('caliente'))) m.ENV.MKW_CALIENTE = envCaliente(parametros.get('caliente'));
  FS.chdir('/wc');                      // el runtime busca runtime/assets/... desde aquí
}

// Las verificaciones de la prueba, cuando se llega a ?cuadros=N
async function verificar(medidas) {
  // El sonido primero (§88): la demora con el clic y una foto del medidor ANTES del trabajo pesado de abajo (unir y
  // recorrer todo el registro traba la página ~70 ms: con la cola corta del worklet eso es un hueco que no es del juego)
  const sonidoFoto = { estado: { ...sonido.estado }, medido: { ...window.mkwEstado.sonido } };
  const demora = await sonido.medirDemora(window.mkw).catch(() => null);
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
  verificarSonido(sonidoFoto, demora);
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

// El sonido: ¿se abrió por nuestra cadena (el AudioWorklet de la página, o SDL3 con ?audio=viejo), se desbloqueó con
// un gesto, suena, sin cortes, con la cola centrada y poca demora?
function verificarSonido({ estado: e, medido: m }, d) {
  const chrome = sonido.estadisticasChrome();
  const worklet = e.camino === 'worklet';
  ok('el juego abrió su sonido (por el volumen y el medidor de la página)', e.contextos === 1 && e.frecuencia > 0 && (worklet || !AUDIO_WORKLET),
     `${e.contextos} AudioContext, ${e.frecuencia} Hz, camino ${e.camino}${AUDIO_WORKLET && !worklet ? ' (se pidió el worklet: ¿wasm viejo?)' : ''}, ` +
     `bloques de ${e.muestrasBloque} muestras (${(1000 * e.muestrasBloque / (e.frecuencia || 1)).toFixed(1)} ms)`);
  ok(`el sonido arrancó bloqueado${parametros.get('bloquearSonido') === '1' ? ' (simulado)' : ''} y se desbloqueó con el primer gesto`, e.activo && e.desbloqueadoCon !== '',
     e.desbloqueadoCon ? `con «${e.desbloqueadoCon}»` : (e.activo ? 'sonaba sin gesto (¿Chrome sin bloqueo?)' : 'sigue bloqueado'));
  ok('el juego suena (música del título)', m.nivelMax > -40, `nivel máximo ${m.nivelMax.toFixed(1)} dB`);
  // Cortes: se cuentan desde el cuadro 300; los del arranque (el juego se traba leyendo el disco) van como nota
  const base = m.base || { huecos: e.huecos, tirados: m.tirados };
  const huecos = e.huecos - base.huecos, tirados = m.tirados - base.tirados;
  if (base.huecos || base.tirados) nota(`sonido en el arranque: ${base.huecos} huecos y ${base.tirados} bloques tirados (mientras carga del disco)`);
  ok('sin cortes en el sonido desde el cuadro 300', huecos === 0 && tirados === 0,
     `${huecos} huecos, ${tirados} bloques tirados por cola llena` +
     (chrome ? `; Chrome: ${chrome.rellenos} rellenos, latencia ${chrome.latenciaMs?.toFixed?.(1)} ms` : ''));
  const detalle = `cola entre ${m.colaMin.toFixed(1)} y ${m.colaMax.toFixed(1)} ms ` +
                  (worklet ? `(ahora ${m.cola.toFixed(1)}, objetivo ${e.objetivoMs.toFixed(1)}; worklet: ${e.vacios} vacíos, ${e.saltos} saltos)` : '(objetivo 60, tope 120)') +
                  `, ritmo entre ${((m.ritmoMin - 1) * 100).toFixed(3)} % y ${((m.ritmoMax - 1) * 100).toFixed(3)} %`;
  // camino worklet: el objetivo se adapta (sube con los tirones, baja con la calma): la cola tiene que estar cerca de él
  const centrada = worklet ? m.colaMin > 3 && Math.abs(m.cola - e.objetivoMs) < 10 : m.colaMin > 20 && m.colaMax < 110;
  if (AJUSTE_SONIDO) ok('la cola del sonido se mantiene centrada (ajuste de ritmo)', centrada, detalle);
  else nota('sin ajuste de ritmo (?ajusteSonido=0): ' + detalle);
  // La demora (§88, medida al empezar verificar): un clic de prueba con el juego mudo ~3 s; del juego al parlante
  const texto = d && `${d.mediana.toFixed(1)} ms del juego al parlante (de ${d.min.toFixed(1)} a ${d.max.toFixed(1)}, ${d.n} clics): ` +
                     `cola ${d.colaMs.toFixed(1)} ms + lo que dice el navegador (su búfer y el de Windows) ${d.chromeMs.toFixed(1)} ms`;
  if (worklet) ok('poca demora del sonido: nuestra parte (sin la del navegador) < 40 ms', d && d.mediana - d.chromeMs < 40, texto || 'no se pudo medir');
  else nota('demora del sonido (camino viejo): ' + (texto || 'no se pudo medir'));
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

// M22 (modelo «Modo consola» del crítico): la PRECARGA del vestíbulo (?precarga=1). Mientras se conversa en el
// vestíbulo de la sala, el sitio abre esta página escondida con ese parámetro: baja lo que el juego necesita para
// arrancar y para la primera carrera —el manifiesto, los archivos chicos, el paquete de diminutos, el programa (mkw.js
// y mkw.wasm, con su huella) y la semilla de bloques (la del arranque y la de después del título, hasta 32 MB)— y lo deja
// en las cachés del navegador (Cache Storage para el disco, la caché HTTP para el programa), SIN arrancar el juego: sin
// WebGPU y sin la memoria del wasm (es liviana). Le avisa al sitio cuánto lleva ({tipo:'precarga', pct, listo}) y el
// sitio lo muestra en la ficha de cada piloto («⬇ 40 %», «● listo»). Al empezar la copa el sitio la cierra y abre el
// juego de verdad, que encuentra todo guardado. Con todo ya en la caché (una visita anterior), termina en segundos.
const PESO_PROGRAMA = 16 * 1048576;          // lo que viaja del programa (comprimido): solo para el porcentaje
// §119 (C7): la precarga solo quiere que el programa quede en la caché HTTP: no hace falta tenerlo en la memoria. Antes
// se leía con arrayBuffer(): el navegador lo descomprimía entero en un bloque de 122 MB que nadie usaba (y el recolector
// lo soltaba después). Ahora el cuerpo pasa por un sumidero que solo cuenta los bytes: llega de a pedazos chicos, cada
// uno se olvida al llegar, y la caché HTTP queda igual de llena. ?precargaLiviana=0 = como antes (arrayBuffer y 24 a la vez).
const PRECARGA_LIVIANA = parametros.get('precargaLiviana') !== '0';
async function bajarSinGuardar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url.split('?')[0].split('/').pop()}: ${r.status}`);
  let n = 0;
  if (!r.body) return (await r.arrayBuffer()).byteLength;   // (un navegador sin flujos: como antes)
  await r.body.pipeTo(new WritableStream({ write(pedazo) { n += pedazo.byteLength; } }));
  return n;
}
async function precargarTodo() {
  let ultimo = -1;
  const avisar = (pct, listo = false, error = '') => {
    pct = Math.max(0, Math.min(100, Math.floor(pct)));
    if (pct === ultimo && !listo && !error) return;
    ultimo = pct;
    window.mkwEstado.precarga = { pct, listo, error };
    if (window.parent !== window) window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'precarga', pct, listo, error }, location.origin);
  };
  avisar(0);
  const r = await fetch(ORIGEN + '/manifiesto.json');
  if (!r.ok) { avisar(0, false, String(r.status)); return; }
  const manifiesto = await r.json();
  // (§119: los bloques van a Cache Storage y aquí nadie los vuelve a leer: en la memoria de esta página, como mucho 4 MB
  // en vez de los 64 MB del juego)
  disco = crearDisco({ version: r.headers.get('X-Mkw-Version') || 'sin-version', cajaGrande: parametros.get('cajaGrande') === '0' ? 0 : 8,   // (§171, C5)
    huellaDe: (h => (window.mkwEstado.versionArchivo = !!h, h))(huellasDelManifiesto(manifiesto)),   // §174 (D5)
    adelantarActivo: false, lotes: nuevosLotes(),
                       protegidas: urlsProtegidas,   // (§251)
                       ...(PRECARGA_LIVIANA ? { memoriaMax: 4 * 1048576 } : {}) });
  await disco.abrir();
  window.mkwDisco = disco;
  discoListo(disco);
  const tamaños = new Map(), aBajar = [];
  for (const [prefijo, archivos] of Object.entries(manifiesto)) for (const [ruta, tam] of archivos) {
    if (tam < 0) continue;
    if (precargar(prefijo, ruta)) aBajar.push([prefijo + ruta, tam]); else tamaños.set(prefijo + ruta, tam);
  }
  const huella = parametros.get('huella') === '0' ? null : r.headers.get('X-Mkw-Build');
  const conHuella = f => ORIGEN + '/build/' + f + (huella ? '?v=' + huella : '');
  // la semilla de bloques: lo que el juego leyó en las corridas de muestra (antes y después del título), en tramos de
  // hasta 8 bloques seguidos del mismo archivo (un pedido cada uno), como adelantarArranque y precalentarBloques
  const semilla = await leerSemillaBloques();
  const minimo = semilla?.corridas >= 2 ? 2 : 1;
  const tramos = [];
  let tramo = null, bytesTarde = 0;
  for (const [ruta, b, cuadro, veces] of (semilla?.bloques || []).slice().sort((x, y) => x[2] - y[2])) {
    if (veces < minimo || !tamaños.has(ruta)) continue;
    const tam = tamaños.get(ruta), largo = Math.min(disco.bloque, tam - b * disco.bloque);
    if (largo <= 0) continue;
    if (cuadro >= 450 && (bytesTarde += largo) > 32 * 1048576) continue;
    if (tramo && tramo.ruta === ruta && tramo.b1 === b - 1 && tramo.b1 - tramo.b0 < 7) { tramo.b1 = b; tramo.bytes += largo; }
    else { tramo = { ruta, b0: b, b1: b, bytes: largo }; tramos.push(tramo); }
  }
  // los trabajos, cada uno con su peso (bytes) para el porcentaje
  const trabajos = [
    ...aBajar.map(([ruta, tam]) => [tam, () => disco.entero(direccion(ruta), tam)]),
    ...(parametros.get('paquete') !== '0' ? [[1.5 * 1048576, () => disco.entero(ORIGEN + '/build/diminutos.bin').catch(() => null)]] : []),
    [PESO_PROGRAMA, PRECARGA_LIVIANA ? () => bajarSinGuardar(conHuella('mkw.wasm')) : () => fetch(conHuella('mkw.wasm')).then(x => x.arrayBuffer())],
    [1048576, PRECARGA_LIVIANA ? () => bajarSinGuardar(conHuella('mkw.js')) : () => fetch(conHuella('mkw.js')).then(x => x.text())],
    // (§104: no urgentes, así se juntan de a 12 por llamada: nadie está esperando estos bytes todavía)
    ...tramos.map(t => [t.bytes, () => disco.leer(direccion(t.ruta), tamaños.get(t.ruta), t.b0 * disco.bloque,
      Math.min((t.b1 + 1) * disco.bloque, tamaños.get(t.ruta)) - t.b0 * disco.bloque, { urgente: false })]),
  ];
  const total = trabajos.reduce((x, [peso]) => x + peso, 0);
  let hecho = 0, siguiente = 0, fallas = 0;
  const t0 = performance.now();
  // (§104: con lotes, varios trabajos a la vez: el cartero los junta de a 12 por llamada; sin lotes, 6 como antes.
  // §119: 12, no 24: alcanza para llenar un lote, y la mitad de pedazos esperando en la memoria del vestíbulo)
  const aLaVez = !window.mkwEstado.lotes ? 6 : PRECARGA_LIVIANA ? Number(parametros.get('precargaHilos')) || 12 : 24;
  await Promise.all(Array.from({ length: aLaVez }, async () => {
    while (siguiente < trabajos.length) {
      const [peso, hacer] = trabajos[siguiente++];
      try { await hacer(); } catch { fallas++; }
      hecho += peso;
      avisar(99 * hecho / total);
    }
  }));
  nota(`precarga: ${trabajos.length} pedidos (${(total / 1048576).toFixed(0)} MB) en ${((performance.now() - t0) / 1000).toFixed(1)} s` +
       (fallas ? `, ${fallas} fallaron` : ''));
  await disco.guardarIndice();   // §175: el índice de los grupos de 2 MB, antes de decir «listo» (si no, el juego no los ve)
  avisar(100, true);
}

// Sin la portada (lo normal, §66) el juego arranca solo al abrir la página; con ?portada=1, al apretar «Jugar»
const arrancarYa = () => arrancar().catch(e => { ui.cortina(`No pude arrancar el juego: ${e && e.message || e}`, true); throw e; });
$('arrancar').addEventListener('click', arrancarYa);
if (parametros.get('precarga') === '1') precargarTodo().catch(e => nota('precarga: ' + (e?.message || e)));
else if (parametros.get('auto') === '1' || !ui.conPortada) arrancarYa();
