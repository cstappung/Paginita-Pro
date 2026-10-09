/* Metro Rush — el juego (la carrera, los controles, el marcador y los menús).

   QUÉ HACE, EN GLOBAL
   Une las tres piezas: el motor (motor.js, las reglas y la pista), el mundo
   (mundo.js, lo que se dibuja) y el sonido (audio.js). En cada cuadro:
     1. lee lo que pidió el jugador (teclas, deslizar el dedo, mando),
     2. mueve al corredor (carril, salto, rodada, techos y rampas),
     3. revisa choques, monedas, poderes, estrellas y boletos,
     4. suma puntos (10 por metro × el multiplicador),
     5. decide si toca cambiar de estación (por un túnel),
     6. le pasa todo al mundo para que lo dibuje y actualiza el marcador.
   Al terminar, guarda el progreso (monedas, mejoras, retos, boletos) en el
   aparato y en la cuenta, y manda el puntaje a la clasificación del Club.

   POR QUÉ ASÍ
   - La física es sencilla y en metros: x (carril), y (altura) y D (cuánto
     avanzaste). El corredor nunca se mueve hacia adelante en la pantalla:
     el mundo viene hacia él.
   - Un choque "de frente" (el objeto te alcanza estando ya en tu carril)
     termina la carrera; uno "de costado" (te metiste en un carril ocupado)
     es un tropiezo: te devuelve a tu carril y el inspector se acerca. Dos
     tropiezos en 8 s y te atrapa. Es la regla de Subway Surfers, y es lo
     que hace que cambiar de carril tarde se perdone una vez.
   - Se perdona el salto un poco antes de tocar el suelo y un poco después
     de dejarlo (búfer y "tiempo de coyote"): sin eso el salto se siente
     "comido" a toda velocidad. */
import { crearMundo, PALETAS } from './mundo.js?v=metrorush-14';
import { Sonido } from './audio.js?v=metrorush-14';
import './mundo-city.js?v=metrorush-14';                        // CITY: el dibujo de City (se engancha a mundo.js por GANCHOS)
import { crearCiudad } from './ciudad.js?v=metrorush-14';       // CITY: lo que la carrera hace distinto en City

const M = window.MetroRushMotor;                               // el motor (motor.js)
const MP = window.MetroRushPrueba;                            // la prueba de la carrera, para el antitrampas (prueba.js)
const Club = window.Club || null;                             // la conexión con la sección Juegos (puede faltar)
const F = M.FISICA;                                           // las constantes de la física
const $ = id => document.getElementById(id);                  // atajo para buscar en la página
const fmt = n => Math.floor(n).toLocaleString('es-CL');       // 128450 → "128.450"

/* ===================================================================
   1. GUARDADO: progreso (cuenta) y opciones (este aparato)
   =================================================================== */
const CLAVE = Club && Club.storageKey ? Club.storageKey('metrorush.progreso') : 'metrorush.progreso';
const CLAVE_OPC = 'metrorush.opciones';
const lee = (k, def) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : def; } catch (e) { return def; } };
const escribe = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: se juega igual */ } };
let progreso = M.limpiaProgreso(lee(CLAVE, null));            // lo que se gana y se compra (va a la cuenta)
const opciones = Object.assign({ calidad: 'auto', estilo: 'auto', musica: 80, efectos: 90, sacudida: true, mudo: false, modo: 'clasico' }, lee(CLAVE_OPC, {}));
/* El modo de juego elegido en la portada (M.MODOS: clásico, sin ayudas, sin
   monedas, City, City sin ayudas). Se recuerda en este aparato, con las
   opciones; una clave que ya no existe vuelve al clásico. */
if (!M.modoDe(opciones.modo) || !opciones.modo) opciones.modo = 'clasico';
let modoSel = M.modoDe(opciones.modo);                         // el modo con que empieza la próxima carrera
/* La cuenta guarda `{d, at}` en users/<uid>/club/metrorush, y eso mismo es
   lo que llega al pedirla: un OBJETO con el progreso como texto en `d`.
   Antes se hacía JSON.parse(dato) del objeto entero, que siempre fallaba y
   se ignoraba en silencio: la copia de la cuenta nunca se leía, y en otro
   navegador se empezaba de cero (y lo primero que se guardaba pisaba la
   nube). Ahora no se sube nada hasta haber leído la cuenta. */
let nubeLeida = !(Club && Club.pedirPartida);                // fuera de Juegos no hay cuenta que esperar
let subirLuego = false;                                       // se guardó antes de leer la cuenta: subir al leerla
/** Guarda el progreso aquí y (si `subir`) en la cuenta. */
function guardar(subir = true) {
  progreso.at = Date.now();
  escribe(CLAVE, progreso);
  if (!subir || !Club || !Club.guardarPartida) return;
  if (!nubeLeida) { subirLuego = true; return; }              // primero se lee la cuenta, o la copia vacía de aquí la pisaría
  Club.guardarPartida(JSON.stringify(progreso));
}
const guardaOpciones = () => escribe(CLAVE_OPC, opciones);
/** Saca el progreso de lo que respondió la cuenta: `{d: "texto"}` o, por si acaso, el texto solo. */
function progresoDeNube(dato) {
  const texto = dato && typeof dato === 'object' ? dato.d : dato;   // la forma que guarda la cuenta, o texto suelto
  if (typeof texto !== 'string' || !texto) return null;            // la cuenta no tiene nada
  try { return JSON.parse(texto); } catch (e) { return null; }     // un dato raro se ignora
}
// lo de la nube se mezcla con lo de aquí (gana lo más nuevo en monedas; lo mayor en mejoras, boletos y récords)
let intentosNube = 0;
function leeNube() {
  Club.pedirPartida(dato => {
    const nube = progresoDeNube(dato);
    // nada (cuenta nueva o lectura fallida): se pregunta una vez más antes de dar la cuenta por vacía
    if (!nube && intentosNube++ < 1) { setTimeout(leeNube, 4000); return; }
    const antes = JSON.stringify(progreso);
    if (nube) progreso = M.mezclaProgreso(progreso, nube);
    nubeLeida = true;
    // si aquí había algo que la cuenta no tenía (o se guardó mientras se esperaba), se sube
    const distinto = !nube || JSON.stringify(progreso) !== JSON.stringify(M.limpiaProgreso(nube));
    if (subirLuego || distinto) guardar(true);
    else if (JSON.stringify(progreso) !== antes) guardar(false);
    subirLuego = false;
    pintaPortada();
  });
}
if (Club && Club.pedirPartida) leeNube();

/* ===================================================================
   2. PIEZAS: pantalla, mundo y sonido
   =================================================================== */
const pantalla = $('pantalla'), lienzo = $('lienzo');
const sonido = new Sonido();
sonido.ponMudo(opciones.mudo); sonido.volumenes(opciones.musica / 100, opciones.efectos / 100);
const ciudad = crearCiudad({ M, sonido, aviso: t => aviso(t) });   // CITY: pisar, lonas, barandas, chicle, personajes y postales (ciudad.js)
let mundo = null;                                             // se crea cuando cargan las fuentes
const esTactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/** La calidad gráfica que se usa: la elegida o, en "auto", según el aparato. */
function calidadInicial() {
  if (opciones.calidad !== 'auto') return opciones.calidad;
  const chico = Math.min(screen.width, screen.height) < 720;
  if (esTactil && (navigator.deviceMemory || 4) <= 3) return 'baja';
  return esTactil || chico ? 'media' : 'alta';
}
/** La estación que se DIBUJA: la de los puntos, salvo que en Opciones se fijó un estilo. */
const PALETA_FIJA = { juguete: 'barrio', neon: 'neon', pixel: 'ocaso' };
function estacionVisual(e) {
  if (opciones.estilo === 'auto' || e.estilo === opciones.estilo) return e;
  // CITY: un distrito conserva su ciudad con el estilo fijado («muelles@neon», la arma mundo-city.js)
  if (e.distrito) return Object.assign({}, e, { estilo: opciones.estilo, paleta: e.paleta + '@' + opciones.estilo });
  return Object.assign({}, e, { estilo: opciones.estilo, paleta: PALETA_FIJA[opciones.estilo] });
}

/* ===================================================================
   3. LA CARRERA
   =================================================================== */
let estado = 'cargando';      // cargando | portada | jugando | pausa | muerte | salvar («¿seguir corriendo?») | fin
let c = null;                 // los datos de la carrera en curso (ver nuevaCarrera)
let panel = null;             // el panel abierto (tienda, retos, libreta, opciones, ayuda, relato)

/* La semilla de la próxima carrera. Normalmente al azar; el modo Fantasma
   la fija (semillaSiguiente) para correr la MISMA pista que el récord que se
   persigue: el antitrampas acepta cualquier semilla, porque la pista sale de
   ella y la prueba la lleva en `s`. Se usa una vez y vuelve al azar. */
let semillaSiguiente = null;
function nuevaCarrera() {
  // el fantasma (modos «Fantasma»): si hay uno listo, se corre SU pista (su semilla); la semilla fijada a mano gana y lo apaga
  const fanG = semillaSiguiente == null ? fantasmaListo(modoSel) : null;
  const semilla = semillaSiguiente != null ? semillaSiguiente >>> 0 : fanG ? fanG.semilla : (Math.random() * 2 ** 31) >>> 0;
  semillaSiguiente = null;
  /* En un modo fantasma se corre con las REGLAS del fantasma (su pista es la
     de esas reglas: con o sin poderes y cajas) y con su versión de pista;
     sin fantasma, con las del modo normal de su mundo (reglasDefecto).
     Ejemplo: el récord de distancia es del Clásico → poderes, patineta y
     seguir corriendo; es de Sin ayudas → nada, a ×10. */
  const modo = modoSel.fantasma ? M.conReglas(modoSel, fanG ? fanG.reglas : modoSel.reglasDefecto) : modoSel;
  const version = fanG ? fanG.version : MP ? MP.VERSION : undefined;   // la versión de la pista (la del fantasma, que puede ser la vieja)
  const curva = M.velocidadDe(modo, version);                   // la curva de velocidad (la clásica, en el clásico)
  return {
    modo, curva, mundoJ: M.mundoDe(modo),            // las reglas, la velocidad y el mundo (estaciones, historia) de esta carrera
    // la prueba de la carrera (docs/antitrampas/metrorush.md): con qué se empezó, y después cada evento que cambia el puntaje
    prueba: MP ? MP.nueva({ s: semilla, b: progreso.retos.nivel, md: progreso.mejoras.doble, u: cuentaUrl, m: modo.id, pm: modo.reglas, v: version }) : null,
    r0: performance.now(), sigMuestra: MP ? MP.PASO_MUESTRA : Infinity, sinteticas: 0, tocada: tocada,
    gen: M.crearGenerador(semilla, { modo, version }), // la pista de esta carrera (la del modo, o la de las reglas del fantasma)
    version,                                         // la versión de esa pista
    activos: [],                                     // los objetos de la pista que existen ahora
    D: 0, t: 0, V: curva.velocidad(0),               // metros, segundos y velocidad
    puntos: 0, monedas: 0, estrellas: 0,
    r: { carril: 1, carrilPrev: 1, x: 0, xPrev: 0, y: 0, vy: 0, suelo: 0, enAire: false, rodar: 0, rodarPend: false, fase: 0,
      ultSuelo: 0, saltoBufer: -1, tropezarT: -1, ladeo: 0 },
    poderes: { iman: 0, mochila: 0, zapatillas: 0, doble: 0, patineta: 0 },   // segundos que les quedan
    pogo: false,                                              // ¿va en el pogo saltarín? (sale de la caja misteriosa)
    invulnerable: 0, tropiezo: 0, perseguidor: 1, perseguidorObj: 1, introPersecucion: 2.5,
    cuenta: { monedas: 0, saltos: 0, rodadas: 0, distancia: 0, puntos: 0, poderes: 0, techos: 0, estrellas: 0, esquivar: 0, patinetas: 0, mochilas: 0 },
    techos: new Set(), esquivados: new Set(), avisados: new Set(),
    estacion: M.estacionDe(0, modo), cambio: null, banner: 2.5,
    seguirVeces: 0, muerte: null, recordAvisado: false, finalizada: false, quieto: 0,
    extra: 0, potVentana: 6, potUsado: {},          // el potenciador de puntos (+5), y cuánto quedan los botones de potenciadores
    tutorial: progreso.totales.carreras < 2 ? { bajo: 0, alto: 0, tren: 0 } : null,   // las pistas de las dos primeras carreras
    pista: null,                                     // la pista que se está mostrando ({tipo, o})
    semilla,                                         // la semilla de esta pista (la del récord, en el modo Fantasma)
    rastro: null,                                    // el rastro de esta carrera para que otro la vea como fantasma (texto; va a la prueba como `g`)
    // el fantasma (ver «EL FANTASMA»): contra quién se corre, y el grabador del rastro de esta carrera
    // (en todo modo que entra en la tabla de distancia: cualquiera de esas carreras puede ser el próximo fantasma)
    fan: fanG ? nuevoFan(fanG) : null,
    grab: M.distanciaDe(modo) && MF ? MF.crearGrabador() : null, rastroK: 0
  };
}

/* ---- la prueba de la carrera (antitrampas, docs/antitrampas/metrorush.md) ----
   Se anota lo que cambia el puntaje (estrellas, el 2×, el +5, los choques),
   los pedidos al generador de la pista y una muestra cada 2 s; con eso el
   club rehace los puntos exactos antes de guardar un récord. Una carrera en
   la que se usó __metrorush para cambiar algo (puntos, poderes, inmortal,
   adelantar el tiempo, apretar teclas) se juega igual, pero no se manda a la
   clasificación: es una partida de prueba. */
const cuentaUrl = new URLSearchParams(location.search).get('cuenta') || 'local';
let tocada = false;           // ¿se usó __metrorush en esta página? Desde entonces ninguna carrera cuenta
/** Un evento de la prueba, con el tiempo de juego, los metros y el reloj real de ahora. `D` cambia los metros anotados (al chocar se anotan los de antes del rebote). */
function anota(cod, x, D) { if (c && c.prueba) MP.evento(c.prueba, cod, c.t, D != null ? D : c.D, performance.now() - c.r0, x); }
/** Un pedido al generador de la pista, con el punto de la pista en que se hizo. */
function anotaPedido(tipo, ...datos) { if (c && c.prueba) MP.pedido(c.prueba, tipo, c.gen.estado().dSig, ...datos); }
/** Una entrada que no hizo una persona (un script que despacha teclas o toques). Las del mando valen si de verdad hay un mando conectado. */
function cuentaEntrada(e) {
  if (!c || !e || e.isTrusted) return;
  let mando = false;
  try { mando = !!e.__mando && Array.from((navigator.getGamepads && navigator.getGamepads()) || []).some(g => g && g.connected); } catch (err) { mando = false; }
  if (!mando) c.sinteticas++;
}

/* ---- lo que pide el jugador ---- */
const pedidos = [];           // 'izq' | 'der' | 'arriba' | 'abajo' | 'patineta'
const TECLA = { ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arriba', KeyW: 'arriba', Space: 'arriba', ArrowDown: 'abajo', KeyS: 'abajo', KeyH: 'patineta', ShiftRight: 'patineta' };
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konami = 0;               // cuántas teclas del código secreto van bien
document.addEventListener('keydown', e => {
  sonido.iniciar();
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  // el código secreto de siempre, en la portada: desbloquea el aspecto dorado
  if (estado === 'portada' && !panel) { konami = e.code === KONAMI[konami] ? konami + 1 : (e.code === KONAMI[0] ? 1 : 0); if (konami === KONAMI.length) { konami = 0; desbloquea('dorado', '¡Código secreto! Aspecto Dorado desbloqueado'); } }
  if (e.code === 'KeyM') { alternaSonido(); return; }
  if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { alternaPantallaCompleta(); return; }   // F: pantalla completa (no en un campo de texto: eso ya se filtró arriba)
  // «¿Seguir corriendo?»: Intro paga y sigue, Escape (o P) lo deja pasar. Espacio y las flechas no hacen
  // nada a propósito: quien venía saltando con la barra no debe pagar sin querer.
  if (estado === 'salvar') { if (e.code === 'Enter') { e.preventDefault(); seguirTrasChoque(); } else if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); muestraFin(); } return; }
  if ((e.code === 'Digit1' || e.code === 'Digit2') && estado === 'jugando') { cuentaEntrada(e); usaPotenciador(Object.keys(M.POTENCIADORES)[e.code === 'Digit1' ? 0 : 1]); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (estado === 'jugando') pausar(); else if (estado === 'pausa' && !panel) seguirJugando(); else if (panel) cierraPanel(); e.preventDefault(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && estado === 'portada' && !panel) { e.preventDefault(); empezar(); return; }
  const a = TECLA[e.code];
  if (!a || estado !== 'jugando') return;
  e.preventDefault();
  cuentaEntrada(e);
  if (e.repeat) return;                                       // mantener apretado no repite el movimiento
  pedidos.push(a);
});
/* Deslizar el dedo: en cuanto recorre 26 px se decide la dirección (sin esperar
   a que lo suelte, que se siente lento). Dos toques rápidos = patineta. */
let toque = null, ultimoToque = 0;
lienzo.addEventListener('pointerdown', ev => {
  sonido.iniciar();
  if (estado !== 'jugando') return;
  ev.preventDefault();
  cuentaEntrada(ev);
  toque = { x: ev.clientX, y: ev.clientY, usado: false, id: ev.pointerId };
  try { lienzo.setPointerCapture(ev.pointerId); } catch (e) {}
});
lienzo.addEventListener('pointermove', ev => {
  if (!toque || toque.usado || ev.pointerId !== toque.id) return;
  const dx = ev.clientX - toque.x, dy = ev.clientY - toque.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
  toque.usado = true;
  pedidos.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'der' : 'izq') : (dy > 0 ? 'abajo' : 'arriba'));
});
lienzo.addEventListener('pointerup', ev => {
  if (toque && !toque.usado && estado === 'jugando') {        // un toque sin deslizar: ¿es el segundo de un doble toque?
    const ahora = performance.now();
    if (ahora - ultimoToque < 320) { pedidos.push('patineta'); ultimoToque = 0; } else ultimoToque = ahora;
  }
  toque = null;
});
lienzo.addEventListener('pointercancel', () => { toque = null; });
lienzo.addEventListener('contextmenu', ev => ev.preventDefault());
// Mando de consola (juegos/audio/mando.js): la cruceta y el stick son las flechas; A salta, B rueda, X patineta.
if (window.Mando) window.Mando.configura({
  botones: { a: 'ArrowUp', b: 'ArrowDown', x: 'KeyH', y: 'KeyM', start: 'KeyP', lb: 'ArrowLeft', rb: 'ArrowRight' },
  menu: () => estado !== 'jugando' || !!panel,
  pistas: [['dpad stickL', 'carril · saltar · rodar'], ['a', 'saltar'], ['b', 'rodar'], ['x', 'patineta'], ['start', 'pausa']],
  zonas: [{ sel: '.pie' }]
});

/* ---- la física ---- */

/** Qué hay bajo los pies del corredor: el suelo (0), una rampa o el techo
    de un tren. Lo decide `M.soporte` (motor.js), que se prueba en Node; aquí
    solo se le pasan la pista y la D del cuadro anterior. */
const soporte = (x, D, y) => M.soporte(c.activos, x, D, y, c.Dantes);
/** Mueve al corredor un paso de `dt` segundos. */
function fisica(dt) {
  const r = c.r;
  ciudad.antes(c);                                               // CITY: dónde estaban los pies (para pisar cajones y drones)
  // 1) lo que pidió el jugador
  while (pedidos.length) {
    const p = pedidos.shift();
    if (p === 'izq' || p === 'der') {
      const n = Math.max(0, Math.min(2, r.carril + (p === 'izq' ? -1 : 1)));
      if (n !== r.carril) { r.carrilPrev = r.carril; r.carril = n; sonido.carril(); }
    } else if (p === 'arriba') {
      if (c.poderes.mochila > 0 || c.pogo) continue;          // volando (mochila o pogo) no se salta
      r.saltoBufer = 0.16;                                     // se recuerda un instante, por si aún no toca el suelo
    } else if (p === 'abajo') {
      if (c.poderes.mochila > 0) continue;
      if (c.pogo) c.pogo = false;                              // rodar en el pogo lo suelta: cae de golpe como siempre
      if (r.enAire && c.ciudad && ciudad.rebota(c)) continue;  // CITY: con chicle, rodar en el aire es el pisotón que después rebota (ciudad.js)
      if (r.enAire) { r.vy = -F.caidaRapida; r.rodarPend = true; r.saltoBufer = -1; }   // en el aire: baja de golpe y rueda al caer
      else { r.rodar = F.tiempoRodar; c.cuenta.rodadas++; sonido.rodar(); }
    } else if (p === 'patineta') usaPatineta();
  }
  // 2) el salto (con búfer y tiempo de coyote)
  if (r.saltoBufer > 0) {
    r.saltoBufer -= dt;
    const enSuelo = !r.enAire || c.t - r.ultSuelo < 0.09;
    const enAire = !enSuelo && c.poderes.mochila <= 0 && !c.pogo && ciudad.saltoAire(c);   // CITY: en las burbujas, un salto más en el aire
    if ((enSuelo || enAire) && c.poderes.mochila <= 0) {
      const alto = (c.poderes.zapatillas > 0 ? F.alturaZapatillas : F.alturaSalto) * ciudad.salto(c);   // CITY: Nico salta un poco más (solo altura)
      r.vy = M.impulso(alto); r.enAire = true; r.rodar = 0; r.saltoBufer = -1; r.ultSuelo = -1;
      c.cuenta.saltos++;
      if (c.poderes.zapatillas > 0) sonido.saltoAlto(); else sonido.salto();
    }
  }
  // 3) de lado: el corredor va hacia el centro de su carril. Volando con la
  //    mochila cambia de carril 1,7 veces más rápido (más frenético, y así se
  //    alcanzan las monedas del cielo): es solo de lado, así que no cambia ni
  //    los metros ni los puntos, y volando no hay choques.
  const xObj = M.CARRILES[r.carril], vl = 2.2 / F.cambioCarril * (c.poderes.mochila > 0 ? 1.7 : 1);
  r.xPrev = r.x;
  r.x += Math.max(-vl * dt, Math.min(vl * dt, xObj - r.x));
  r.ladeo += ((xObj - r.x) * -0.18 - r.ladeo) * Math.min(1, dt * 10);   // se inclina hacia donde va
  // 4) arriba y abajo: gravedad, suelo, rampas y techos (o la mochila cohete)
  const sop = soporte(r.x, c.D, r.y);
  if (c.poderes.mochila > 0) {
    // sube de golpe: el 95 % de la altura en medio segundo (antes, en casi uno). Solo cambia la altura, no los metros
    r.y += (F.alturaMochila - r.y) * (1 - Math.exp(-6 * dt)); r.vy = 0; r.enAire = true;
  } else {
    r.vy -= F.gravedad * (c.pogo ? F.gravedadPogo : 1) * ciudad.gravedad(c) * dt; r.y += r.vy * dt;   // en el pogo cae despacio (flota); CITY: en las burbujas también
    if (r.y <= sop.h) {                                        // toca el suelo (o el techo, o la rampa)
      if (c.pogo && r.vy < 0) { c.pogo = false; c.invulnerable = Math.max(c.invulnerable, 0.35); }   // se acabó el pogo: un respiro al aterrizar
      if (r.enAire && r.vy < -1) { sonido.aterriza(-r.vy); if (r.rodarPend) { r.rodar = F.tiempoRodar; c.cuenta.rodadas++; sonido.rodar(); } }
      r.y = sop.h; r.vy = 0; r.enAire = false; r.rodarPend = false; r.ultSuelo = c.t;
    } else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;   // se acabó el tren: cae
  }
  r.suelo = sop.h;
  if (c.ciudad) ciudad.fisica(c, sop, dt, mundo, tiempoTotal);   // CITY: lonas, deslizarse por la baranda y la burbuja
  if (sop.tren && !c.techos.has(sop.tren.id)) { c.techos.add(sop.tren.id); c.cuenta.techos++; }
  if (r.rodar > 0) r.rodar -= dt;
  if (c.pogo) c.pogoT = (c.pogoT || 0) + dt;                    // cuánto lleva en el pogo (la pose lo usa para el resorte y la pirueta)
  if (r.tropezarT >= 0) { r.tropezarT += dt; if (r.tropezarT > 0.45) r.tropezarT = -1; }
  r.fase += dt * (8 + c.V * 0.32);                            // la zancada se acelera con la velocidad
}

/* ---- choques ---- */

/** El alto que ocupa cada obstáculo [abajo, arriba] y su medio ancho (motor.js). */
const caja = o => M.caja(o, c.D);
function choques() {
  const r = c.r;
  if (c.poderes.mochila > 0 || r.y > 6) return;                // volando, por encima de todo
  /* En el pogo: invencible toda la subida y todo lo que vuela por encima de
     los techos (3,35 m). En el último tramo de la bajada vuelven los choques,
     como antes: así lo que haya abajo se esquiva cambiando de carril, o se
     cae sobre el techo. Si fuera invencible hasta tocar el suelo, podría
     aterrizar DENTRO de un tren y morir de frente al terminarse el pogo. */
  if (c.pogo && (r.vy > 0 || r.y > 3.6)) return;
  const alto = r.rodar > 0 ? F.altoRodando : F.altoDePie;       // cuánto mide el corredor (de pie o rodando)
  const dA = c.Dantes != null ? c.Dantes : c.D, dD = c.D - dA;  // dónde empezó el cuadro y cuánto avanzó
  for (const o of c.activos) {
    const k = caja(o);
    if (!k || k.y1 <= k.y0) continue;
    let xs = r.x, ys = r.y;                                     // dónde estaba el corredor al cruzar la pieza
    if (c.D + M.MEDIO_LARGO < k.z0 || c.D - M.MEDIO_LARGO > k.z1) {   // no está a mi altura en la pista al final del cuadro…
      /* …pero puede que la haya atravesado DENTRO del cuadro. Una pieza corta
         (un cajón o un seto de 1,2 m, un dron de 0,9) mide menos que lo que
         se avanza en un cuadro lento: a 60 m/s y 20 cuadros/s son 3 m. Mirar
         solo dónde termina el cuadro la dejaba atrás sin tocarla, y se podía
         pasar a través. Ejemplo: cajón en el metro 40, el cuadro va de 38,8
         a 41,8; al final estás 1,8 m más allá y al principio 1,2 m antes. Se
         mira entonces en el instante en que se la cruzó (la mitad del tramo
         en que se solapan), con el carril y la altura de ese momento. */
      const ancho = k.z1 - k.z0 + 2 * M.MEDIO_LARGO;          // cuánto de pista ocupa el choque
      if (ancho >= dD || dA - M.MEDIO_LARGO > k.z1 || c.D + M.MEDIO_LARGO < k.z0) continue;   // ya se habría visto, o no la cruzó
      const s0 = Math.max(0, (k.z0 - M.MEDIO_LARGO - dA) / dD), s1 = Math.min(1, (k.z1 + M.MEDIO_LARGO - dA) / dD), s = (s0 + s1) / 2;
      xs = r.xPrev + (r.x - r.xPrev) * s;                       // el carril de ese instante
      ys = c.yAntes != null ? c.yAntes + (r.y - c.yAntes) * s : r.y;   // y la altura
    }
    const X = M.CARRILES[o.carril], lim = k.w + F.medioAncho;
    if (Math.abs(xs - X) >= lim) continue;                      // no está en mi carril
    if (ys + 0.02 >= k.y1 || ys + alto <= k.y0) continue;       // lo paso por arriba o por abajo
    if (c.ciudad && ciudad.pisa(c, o, mundo)) continue;         // CITY: cayendo encima de un cajón o un dron, lo rompes
    if (c.invulnerable > 0) continue;
    const deCostado = Math.abs(r.xPrev - X) >= lim - 0.02;      // recién me metí en su carril
    if (deCostado) tropieza(X); else choca(o);
    return;
  }
}
function tropieza(X) {
  const r = c.r;
  sonido.tropiezo(); if (opciones.sacudida) mundo.sacude(0.25);
  r.carril = r.carrilPrev;                                      // vuelve a su carril
  r.x = r.xPrev - Math.sign(X - r.xPrev) * 0.05;
  r.tropezarT = 0;
  if (c.tropiezo > 0) { muere('atrapado'); return; }            // segundo tropiezo seguido: te atrapan
  c.tropiezo = F.ventanaTropiezo; c.perseguidorObj = 1;
  aviso('¡Alto! Don Ramón te pisa los talones');
  gritaAlto();                                                  // el grito, la placa y el perro (ver «La persecución»)
}
function choca(o) {
  if (c.ciudad && ciudad.salva(c, mundo)) return;               // CITY: la burbuja de chicle revienta y te salva
  if (c.poderes.patineta > 0) {                                 // (en los modos sin patineta nunca hay una puesta)                                 // la patineta se rompe y te salva
    c.poderes.patineta = 0; c.invulnerable = 2; sonido.rompePatineta(); if (opciones.sacudida) mundo.sacude(0.4);
    aviso('¡La patineta te salvó!');
    return;
  }
  muere(o.tipo === 'tren' && o.vel > 0 ? 'tren' : o.tipo);
}
function muere(motivo) {
  anota('m');                                                   // antes del rebote: ahí paran los puntos
  estado = 'muerte';
  c.muerte = { t: 0, motivo };
  /* Un choque de frente para en seco, y medio metro hacia atrás (el rebote):
     si se frenara de a poco, el corredor seguía 2 m más y quedaba tirado
     DETRÁS de la barrera con la que chocó, tapado por ella. Si te atrapan
     no hubo choque, así que ahí sí se frena de a poco. */
  if (motivo !== 'atrapado') { c.V = 0; c.D = Math.max(0, c.D - 0.35); }
  c.r.vy = Math.min(0, c.r.vy); c.r.rodar = 0;                   // si chocó saltando, cae (no sigue subiendo)
  c.pogo = false;                                               // y el pogo se pierde
  ciudad.cae(c, mundo);                                         // CITY: y la burbuja de chicle
  c.perseguidorObj = 1;
  c.potVentana = 0; pintaPots();                                // los botones de potenciadores se van (y no vuelven al seguir)
  ocultaPista(); altavozCalla();
  sonido.choque(); sonido.mochila(false);
  if (opciones.sacudida) mundo.sacude(0.8);
}

/* ---- La persecución, con más impacto (ronda 2) ----
   Todo esto es imagen y sonido: no cambia ni un metro ni un punto, así que
   el antitrampas no se entera. Lleva un estado aparte, `c.pers`:
   - grito: segundos que le quedan al «¡Alto!» del inspector (con la placa
     en alto y el globo de texto en el mundo);
   - ladra: segundos que le quedan al ladrido que suena (el perro levanta la
     cabeza y da un saltito);
   - sigLadra: cuánto falta para el próximo ladrido mientras te persiguen;
   - atrapo: segundos desde que te atraparon (−1 si no): con eso `mundo`
     anima al perro saltándote encima y al inspector inclinándose.
   Se llama desde `cuadro` en todos los estados, para que la escena de la
   atrapada siga en «¿Seguir corriendo?» y en el resumen. */
const ATERRIZA_PERRO = 0.45;                                    // a los cuántos segundos de atraparte cae el perro encima (lo mismo usa mundo.js)
/** El estado de la persecución de esta carrera (se arma la primera vez). */
function estadoPers() {
  return c.pers || (c.pers = { grito: 0, ladra: 0, sigLadra: 0.5, atrapo: -1 });
}
/** El primer tropiezo: el inspector grita «¡Alto!» con la placa en alto, pita y el perro ladra. */
function gritaAlto() {
  const P = estadoPers();
  P.grito = 1.6; P.ladra = 0.35; P.sigLadra = 1.1;               // el globo dura 1,6 s; el primer ladrido ya mismo
  c.perseguidor = Math.max(c.perseguidor, 0.95);                // aparecen de golpe detrás (si no, llegaban cuando el grito ya había pasado)
  sonido.alto(); sonido.ladrido(1);
  vibra([40, 60, 40]);                                          // dos golpecitos en el bolsillo (si «Sacudir» está encendido)
}
/** Un paso de la persecución: ladridos mientras te siguen, la atrapada y el borde rojo de peligro. */
function persecucion(dt) {
  if (!c) { pintaPeligro(false); return; }
  const P = estadoPers();
  P.grito = Math.max(0, P.grito - dt); P.ladra = Math.max(0, P.ladra - dt);   // se apagan solos
  const atrapado = !!(c.muerte && c.muerte.motivo === 'atrapado');            // te atraparon (sigue en «seguir», en el resumen…)
  if (!atrapado) P.atrapo = -1;                                               // al seguir corriendo, la escena se deshace
  else {
    const antes = P.atrapo;
    if (antes < 0) { P.atrapo = 0; sonido.atrapado(); }                       // el instante de la atrapada
    else P.atrapo += dt;
    if (antes < ATERRIZA_PERRO && P.atrapo >= ATERRIZA_PERRO) {               // el perro cae encima: el golpe se siente
      P.ladra = 0.6;
      if (opciones.sacudida) mundo.sacude(0.7);
    }
  }
  // mientras dura el tropiezo el perro ladra cada tanto (más seguido al final, cuando está por soltarte)
  const persigue = estado === 'jugando' && c.tropiezo > 0;
  if (persigue) {
    P.sigLadra -= dt;
    if (P.sigLadra <= 0) { sonido.ladrido(c.tropiezo < 2.5 ? 1 : 2); P.ladra = 0.35; P.sigLadra = 0.9 + Math.random() * 0.9; }
  }
  pintaPeligro(persigue);
}
/** El borde rojo de peligro que late mientras el inspector te pisa los talones (un div sobre el lienzo, puesto una vez). */
function pintaPeligro(ver) {
  let el = $('mrPeligro');
  if (!el && ver) {                                                          // se crea la primera vez que hace falta
    el = document.createElement('div'); el.id = 'mrPeligro'; el.className = 'mr-peligro'; el.setAttribute('aria-hidden', 'true');
    $('lienzo').insertAdjacentElement('afterend', el);                       // justo sobre el juego, debajo del HUD
  }
  if (el) el.classList.toggle('ver', !!ver);
}
/** Lo que `mundo` necesita para dibujar la persecución en este cuadro. */
function datosPersecucion() {
  if (!c) return null;
  const P = estadoPers();
  return { amenaza: estado === 'jugando' && c.tropiezo > 0 ? 1 : 0, grito: P.grito, ladra: P.ladra, atrapa: P.atrapo };
}

/* La cinta de monedas de la mochila (o del Despegue). En la versión 3 de la
   pista no la toca (motor.js, monedasCielo), y se anota igual en la prueba.
   Corriendo la pista vieja (contra un fantasma de la versión 2) la cinta
   todavía movería el azar, así que sale de un generador aparte y no se
   anota: la pista sigue siendo la del fantasma, y las monedas no dan puntos. */
function cintaCielo(desde, hasta, carril) {
  if (c.version >= 3 || !MP) { anotaPedido('C', desde, hasta, carril); return c.gen.monedasCielo(desde, hasta, carril); }
  if (!c.genCielo) c.genCielo = M.crearGenerador(c.semilla ^ 0x5eed, { modo: c.modo });   // uno por carrera: sus ids no se repiten
  return c.genCielo.monedasCielo(desde, hasta, carril);
}

/* ---- poderes ---- */
function activaPoder(clase) {
  if (!c.modo.items) return;                                   // los modos sin ayudas no tienen poderes (ni siquiera desde la consola)
  if (clase === 'caja') {
    const premio = M.cajaMisteriosa(Math.random);
    sonido.caja();
    // en City no se usan las patinetas de la tienda: la caja carga la tabla eléctrica (o, si ya estaba llena, monedas)
    if (premio.patineta && c.ciudad) { if (ciudad.cargaTabla(c)) aviso('Caja misteriosa: ¡tabla cargada! H o dos toques'); else { c.monedas += 300; aviso('Caja misteriosa: +300 monedas'); } }
    else if (premio.patineta) { progreso.patinetas++; aviso('Caja misteriosa: ¡una patineta!'); }
    else if (premio.pogo) { if (!lanzaPogo()) { c.monedas += 300; aviso('Caja misteriosa: +300 monedas'); } }   // volando con la mochila no hay pogo: monedas
    else { c.monedas += premio.monedas; aviso(premio.gordo ? `¡PREMIO GORDO! +${premio.monedas} monedas` : `Caja misteriosa: +${premio.monedas} monedas`); }
    return;
  }
  if (ciudad.poder(c, clase, mundo)) return;                   // CITY: el chicle no es un poder de la lista (ver ciudad.js)
  const dur = M.duracionPoder(clase, progreso.mejoras[clase]) + ciudad.extraPoder(c, clase);   // CITY: Lía, +3 s de imán
  c.poderes[clase] = dur;
  c.cuenta.poderes++;
  sonido.poder();
  if (clase === 'mochila') {                                   // la mochila cohete: monedas en el aire y a volar
    c.cuenta.mochilas++;
    c.activos.push(...cintaCielo(c.D + 12, c.D + 12 + c.V * dur, c.r.carril));
    sonido.mochila(true); sonido.despega();
  }
  aviso(M.PODERES[clase].nombre + '!');
}
/* El pogo saltarín (de la caja misteriosa, como en Subway Surfers), ronda 2.
   UN lanzamiento enorme: sube hasta 8,3 m (al menos 3 m, aunque se lance
   desde un techo) y cae despacio (40 % de la gravedad), ~2,5 s en el aire.
   Es invencible toda la subida y mientras va por encima de los techos (ver
   `choques`), y se puede cambiar de carril en el aire; rodar lo suelta. Aterriza donde caiga:
   en el suelo o sobre el techo de un tren (M.soporte lo sostiene).
   Mientras vuela aparece un arco de monedas en los tres carriles (15 por
   carril, M.monedasPogo). Esas monedas NO salen del generador de la pista,
   no gastan su azar y no dan puntos: la pista sigue dependiendo solo de la
   semilla y de los pedidos anotados, y la prueba del antitrampas no necesita
   saber del pogo (solo cambia la altura, nunca los metros ni los puntos).
   No se lanza si en lo que dura el vuelo viene un túnel (su techo está a
   6,6 m y el pogo lo atravesaría): entonces la caja da monedas.
   Devuelve false si no se pudo. */
let idPogo = 0;                                                // ids negativos para las monedas del arco (los de la pista son positivos)
function lanzaPogo() {
  const r = c.r;
  if (c.poderes.mochila > 0) return false;                     // volando con la mochila no se puede
  const vuelo = M.vueloPogo(r.y);                              // la trayectoria (la misma cuenta que usan los tests)
  const alcance = c.D + c.V * vuelo.duracion + 15;             // hasta dónde llega volando (y un poco más)
  if (c.activos.some(o => o.tipo === 'tunel' && o.d0 < alcance && o.d0 + o.largo > c.D - 2)) return false;   // un túnel en el camino: mejor monedas
  c.pogo = true; c.pogoT = 0;                                  // va en el pogo, y desde cuándo (para la animación)
  r.vy = vuelo.v0;                                             // el impulso: justo para llegar a la cima
  r.enAire = true; r.rodar = 0; r.saltoBufer = -1; r.ultSuelo = -1; r.rodarPend = false;
  c.invulnerable = Math.max(c.invulnerable, 0.45);             // el instante del despegue (después, `choques` no mira nada mientras suba o vaya sobre los techos)
  c.cuenta.saltos++;
  if (!c.modo.monedasMatan) {                                  // (en «Sin monedas» no hay cajas, pero por si acaso: ahí matarían)
    for (const m of M.monedasPogo(c.D, c.V, r.y)) { m.id = --idPogo; c.activos.push(m); }   // el arco de monedas en los tres carriles
  }
  sonido.pogo(); aviso('¡Pogo saltarín!');
  return true;
}
function usaPatineta() {
  if (!c.modo.patineta) { aviso(`En «${c.modo.nombre}» no hay patineta`); return; }   // los modos sin ayudas
  if (c.poderes.patineta > 0) return;
  if (ciudad.tablaLista(c)) {                                   // CITY: con la energía llena, la tabla se enciende gratis (no gasta las compradas)
    c.poderes.patineta = ciudad.usaTabla(c); c.patTotal = c.poderes.patineta; c.cuenta.patinetas++;
    sonido.patineta(); aviso('¡Tabla encendida con energía! Te salva de un choque');
    return;
  }
  /* En City solo existe la tabla eléctrica: se carga con diez celdas de
     energía (las celestes de la pista) y las patinetas compradas en la
     tienda quedan guardadas para la Línea 3. Así City se juega como Subway
     Surfers City, donde la tabla es de energía y no se compra. */
  if (c.ciudad) { aviso(`Junta energía para la tabla: ${ciudad.hud(c).energia}/${ciudad.hud(c).llena}`); return; }
  if (progreso.patinetas <= 0) { aviso('No te quedan patinetas (se compran en la tienda)'); return; }
  progreso.patinetas--; c.poderes.patineta = c.patTotal = M.DURACION_PATINETA; c.cuenta.patinetas++;
  sonido.patineta(); aviso('¡Patineta! Te salva de un choque');
}

/** CITY: la barra de energía de la tabla (solo con patineta en el modo) y
    el reloj de «monedas ×2». Se escribe solo cuando cambia (como el resto
    del marcador). Ejemplo: «⚡ 7/10»; llena, «⚡ ¡Lista! H». */
function pintaHudCity() {
  const el = $('hudCity'), h = ciudad.hud(c);
  const ver = !!h && (c.modo.patineta || h.monedas2 > 0);
  if (el.hidden === ver) el.hidden = !ver;
  if (!ver) return;
  const lista = h.energia >= h.llena, txt = (c.modo.patineta ? (lista ? '¡Lista! H' : `${h.energia}/${h.llena}`) : '') + '|' + (h.monedas2 > 0 ? Math.ceil(h.monedas2) : '');
  if (hudCache.city === txt) return;
  hudCache.city = txt;
  el.classList.toggle('lista', lista);
  $('hudEnergia').hidden = !c.modo.patineta;
  $('hudEnergia').style.setProperty('--k', (h.energia / h.llena).toFixed(2));
  ponTexto('hudEnergiaTxt', lista ? '¡Lista!' : `${h.energia}/${h.llena}`);   // corto: el cómo (H o dos toques) ya lo dijo el aviso al llenarse
  $('hudMon2').hidden = !(h.monedas2 > 0);
  ponTexto('hudMon2Txt', `×2 ${Math.ceil(h.monedas2)} s`);
}

/* ---- monedas, poderes y regalos que se recogen ---- */
function recoge(dt) {
  const r = c.r, imanta = c.poderes.iman > 0 || ciudad.imanChicle(c),   // CITY: con chicle, en el aire también imanta
        k = 1 - Math.exp(-14 * dt);
  for (let i = c.activos.length - 1; i >= 0; i--) {
    const o = c.activos[i];
    if (o.tipo !== 'moneda' && o.tipo !== 'poder' && o.tipo !== 'estrella' && o.tipo !== 'boleto' && o.tipo !== 'energia') continue;   // CITY: la energía de la tabla
    const dz = o.d - c.D;
    if (dz > 20 || dz < -2) continue;
    const ox = o.x != null ? o.x : M.CARRILES[o.carril];
    if (o.tipo === 'moneda' && imanta && dz < 18) {             // el imán las trae volando
      o.x = ox + (r.x - ox) * k; o.y += (r.y + 1 - o.y) * k; o.d += (c.D - o.d) * k;
    }
    /* Se recoge lo que el corredor CRUZÓ en este cuadro, no solo lo que le
       quedó cerca al final. A 50 m/s y 20 fps avanza 2,5 m por cuadro, más
       que la caja de 2 m (±1): mirando solo dónde terminó, una moneda que
       cayó entre dos cuadros no se tocaba nunca (y eso pasaba justo en los
       arcos, que a esa velocidad tienen las monedas a 5 m). La altura con
       que se compara es la que tenían los pies al pasar por esa moneda
       (interpolada entre el principio y el final del cuadro), así que un
       salto se mide igual a 20 fps que a 144. */
    const dA = c.Dantes != null ? c.Dantes : c.D;               // dónde empezó el cuadro
    if (o.d < dA - 1.0 || o.d > c.D + 1.0 || Math.abs((o.x != null ? o.x : ox) - r.x) > 0.95) continue;
    const f = c.D > dA ? Math.min(1, Math.max(0, (o.d - dA) / (c.D - dA))) : 1;   // qué parte del cuadro llevaba al pasar por ella
    const yP = c.yAntes != null ? c.yAntes + (r.y - c.yAntes) * f : r.y;          // la altura de los pies en ese momento
    if (o.y < yP - 0.4 || o.y > yP + 2.2) continue;
    /* En «Sin monedas» una moneda es un obstáculo: tocarla termina la
       carrera, como un choque de frente (la prueba lo anota como choque).
       La caja es un poco más chica que la de recoger (0,7 m hacia adelante
       y 0,6 m de lado en vez de 1 y 0,95): es un castigo y se cobra solo si
       de verdad la tocaste. Lo demás (estrellas, boletos) se recoge igual. */
    if (o.tipo === 'moneda' && c.modo.monedasMatan) {
      if (o.d < dA - 0.7 || o.d > c.D + 0.7 || Math.abs((o.x != null ? o.x : ox) - r.x) > 0.6 || c.invulnerable > 0) continue;   // también la que cruzó entre dos cuadros
      mundo.chispa(r.x, r.y + 1, 0, 0xff3b3b);
      muere('moneda');
      return;                                                   // con el choque no se recoge nada más en este cuadro
    }
    // ¡recogido!
    c.activos.splice(i, 1); mundo.suelta(o);
    if (o.tipo === 'moneda') { const n = ciudad.valorMoneda(c); c.monedas += n; c.cuenta.monedas += n; sonido.moneda(); if (c.monedas % 5 === 0) mundo.chispa(r.x, r.y + 1, 0); }   // CITY: con monedas ×2, valen dos
    else if (o.tipo === 'energia') { ciudad.energia(c); mundo.chispa(r.x, r.y + 1, 0, 0x5ff6ff); }   // CITY: una celda de energía de la tabla
    else if (o.tipo === 'poder') { if (o.clase === 'doble') anota('d', o.id); activaPoder(o.clase); mundo.chispa(r.x, r.y + 1.2, 0, 0xffffff); }
    else if (o.tipo === 'estrella') {
      anota('e', o.id);
      c.estrellas = Math.min(M.MAX_ESTRELLAS, c.estrellas + 1); c.cuenta.estrellas++;
      // con el multiplicador fijo (Sin ayudas) la estrella no lo sube: paga monedas y cuenta para las misiones
      if (c.modo.multFijo) { c.monedas += ESTRELLA_MONEDAS; sonido.estrella(); aviso(`Estrella: +${ESTRELLA_MONEDAS} monedas (multiplicador fijo ×${c.modo.multFijo})`); }
      else { sonido.estrella(); aviso(`Estrella: multiplicador ×${multiplicador()}`); }
      mundo.chispa(r.x, r.y + 1.2, 0, 0xffe066);
    } else if (o.tipo === 'boleto' && c.ciudad) {                // CITY: una postal (se guarda aparte de los boletos de la Línea 3)
      sonido.boleto(); banner(ciudad.postal(progreso, o.n), 'Léela en la Libreta');
      guardar();
    } else if (o.tipo === 'boleto') {
      if (!progreso.boletos.includes(o.n)) { progreso.boletos.push(o.n); progreso.boletos.sort((a, b) => a - b); }
      // el número que se muestra es su lugar en la historia (el de la vía), no su número interno: «Boleto 3 de 10»
      const cap = M.capituloDe(o.n);
      sonido.boleto(); banner(`Boleto ${cap.n} de ${cap.de}`, `«${M.BOLETOS[o.n].titulo}» · Léelo en la Libreta`);
      if (tieneTodosLosBoletos()) desbloquea('inspector', '¡Todos los boletos! Don Ramón terminó su último turno: te regala su gorra. Aspecto Inspector');
      guardar();
    }
  }
}
const ESTRELLA_MONEDAS = 50;                                   // lo que paga una estrella donde no puede subir el multiplicador
// el multiplicador de la carrera; en Sin ayudas (`multFijo`) es ×10 fijo para todos, sin importar nivel ni estrellas
const multiplicador = () => M.multiplicador({ base: progreso.retos.nivel, estrellas: c.estrellas, doble: c.poderes.doble > 0, extra: c.extra, fijo: c.modo.multFijo });

/* ---- potenciadores (Despegue y Potenciador +5) ----
   Los primeros segundos de la carrera aparecen dos botones (o las teclas 1
   y 2) con los que tengas. Usarlos los gasta. */
function pintaPots() {
  const el = $('hudPots'), hay = c && c.modo.potenciadores && c.potVentana > 0 && Object.keys(M.POTENCIADORES).some(k => progreso.potenciadores[k] > 0 && !c.potUsado[k]);
  el.hidden = !hay;
  pantalla.classList.toggle('con-pots', hay);                     // la pista de las primeras carreras sube para no taparlos
  if (!hay) return;
  el.innerHTML = Object.entries(M.POTENCIADORES).map(([k, P], i) => progreso.potenciadores[k] > 0 && !c.potUsado[k]
    ? `<button type="button" data-pot="${k}" aria-label="${P.nombre} (tecla ${i + 1})"><i>${ICONOS[k === 'despegue' ? 'cohete' : 'mas5']}</i><span>${P.nombre}</span><b translate="no">×${progreso.potenciadores[k]}</b><kbd>${i + 1}</kbd></button>` : '').join('');
}
function usaPotenciador(k) {
  if (!c || !c.modo.potenciadores || estado !== 'jugando' || c.potVentana <= 0 || c.potUsado[k] || !(progreso.potenciadores[k] > 0)) return;
  progreso.potenciadores[k]--; c.potUsado[k] = true; guardar();
  if (k === 'despegue') {                                       // empezar volando con la mochila, sin chocar con nada
    const seg = M.POTENCIADORES.despegue.seg;
    c.poderes.mochila = seg; c.invulnerable = Math.max(c.invulnerable, seg + 1.5);
    c.activos.push(...cintaCielo(c.D + 12, c.D + 12 + c.V * seg, c.r.carril));
    sonido.mochila(true); sonido.despega(); sonido.poder(); aviso('¡Despegue! A volar');
  } else {                                                      // +5 al multiplicador durante toda la carrera
    anota('p');
    c.extra = M.POTENCIADORES.puntos.extra; sonido.multiplicador(); aviso(`Potenciador: multiplicador ×${multiplicador()}`);
  }
  pintaPots();
}

/* ---- el paso de una carrera ---- */
function actualiza(dt) {
  c.t += dt;
  const muriendo = estado === 'muerte';
  c.V = muriendo ? Math.max(0, c.V - M.FRENADA * dt) : c.curva.velocidad(c.t);   // al caer frena (lo que tolera el antitrampas); la curva es la del modo
  const dD = c.V * dt;
  c.Dantes = c.D;                                               // dónde iba en el cuadro anterior (para seguir la rampa)
  c.yAntes = c.r.y;                                             // a qué altura iban los pies al empezar el cuadro (para recoger, ver recoge)
  c.D += dD;
  if (!muriendo) {
    // los puntos: 10 por metro × el multiplicador
    const antes = c.puntos;
    c.puntos += M.puntosPorTramo(dD, multiplicador());
    c.cuenta.puntos = Math.floor(c.puntos); c.cuenta.distancia = Math.floor(c.D);
    const rec = M.recordDe(progreso, c.modo);                   // el récord de este modo (en un modo fantasma, metros)
    const fanM = !!c.modo.fantasma, va = fanM ? c.D : c.puntos, iba = fanM ? c.D - dD : antes;   // lo que se compara: metros o puntos
    if (!c.recordAvisado && rec > 0 && iba <= rec && va > rec) {
      c.recordAvisado = true; banner('¡Nuevo récord!', fmt(va) + (fanM ? ' m' : ' puntos')); sonido.record();
    }
  }
  // la pista: generar por delante, mover los trenes que vienen, dibujar lo cercano y soltar lo que pasó
  for (const o of generaPista(c.D + 230, { V: Math.max(13, c.V) })) c.activos.push(o);   // (generaPista: la del fantasma, si se corre contra uno)
  for (let i = c.activos.length - 1; i >= 0; i--) {
    const o = c.activos[i];
    if (o.tipo === 'tren' && o.vel > 0) {
      M.activaTren(o, c.D, c.V);                               // (al partir tarde, en la largada, se adelanta a donde ya iría)
      if (o.activo && !muriendo) o.d0 -= o.vel * dt;            // al morir todo se queda quieto (el tren no te pasa por encima)
      if (o.activo && !muriendo) avisaTren(o);                  // la bocina, si viene hacia ti
      if (o.d0 + o.largo < c.D - 1 && !c.esquivados.has(o.id) && !muriendo) { c.esquivados.add(o.id); c.cuenta.esquivar++; }
    }
    const fin = o.d != null ? o.d : o.d0 + (o.largo || 0);
    if (fin < c.D - 15) { mundo.suelta(o); c.activos.splice(i, 1); continue; }
    if (!o.vis && (o.d != null ? o.d : o.d0) - c.D < mundo.vista) mundo.nuevo(o);
    // el cambio de estación se engancha al túnel QUE VA A ESA estación (un túnel
    // del fantasma hacia otra, grabado con otros umbrales, no debe adelantarlo)
    if (o.tipo === 'tunel' && c.cambio && !c.cambio.tunel && (o.estacion == null || o.estacion === c.cambio.estacion.id)) c.cambio.tunel = o;
  }
  if (!muriendo) {
    fisica(dt);
    choques();
  }
  /* Si chocó en este mismo cuadro, ya no recoge nada ni se le gastan los
     poderes: la prueba de la carrera dice que los puntos paran en el choque,
     y una estrella anotada justo después se leería como recogida estando caído. */
  if (!muriendo && estado === 'jugando') recoge(dt);
  // en «Sin monedas» recoger puede ser un choque: entonces, como con los demás choques, el cuadro termina ahí
  if (!muriendo && estado === 'jugando') {
    // los poderes se gastan
    for (const k of Object.keys(c.poderes)) if (c.poderes[k] > 0) {
      c.poderes[k] = Math.max(0, c.poderes[k] - dt);
      if (c.poderes[k] === 0 && k === 'mochila') { sonido.mochila(false); sonido.cortaMochila(); c.invulnerable = Math.max(c.invulnerable, 2); }
      if (c.poderes[k] === 0 && k === 'doble') anota('x');      // el multiplicador vuelve a la mitad
    }
    if (c.invulnerable > 0) c.invulnerable -= dt;
    if (c.tropiezo > 0) { c.tropiezo -= dt; if (c.tropiezo <= 0) c.perseguidorObj = 0; }
    if (c.introPersecucion > 0) { c.introPersecucion -= dt; if (c.introPersecucion <= 0 && c.tropiezo <= 0) c.perseguidorObj = 0; }
    estaciones();
    if (c.t >= c.sigMuestra) { anota('w'); c.sigMuestra = c.t + MP.PASO_MUESTRA; }   // una muestra de metros y reloj cada 2 s
    retosEnVivo(dt);
    pistas(dt);
    altavoz(dt);                                                 // el altavoz del andén (la historia que se oye)
    if (c.potVentana > 0) { c.potVentana -= dt; if (c.potVentana <= 0) pintaPots(); }
  } else if (muriendo) {
    const r = c.r;                                               // chocó en el aire: cae hasta el suelo (o el techo) antes de quedar tendido
    if (r.y > r.suelo) { r.vy -= F.gravedad * dt; r.y = Math.max(r.suelo, r.y + r.vy * dt); }
    c.muerte.t += Math.max(dt, dtRealUltimo);                     // en un aparato lento la pausa tras el choque no se alarga
    if (estado === 'muerte' && c.muerte.t > 0.9 && puedeSalvar()) abreSalvar();
    else if (estado === 'muerte' && c.muerte.t > 1.4) muestraFin();
  }
  c.perseguidor += (c.perseguidorObj - c.perseguidor) * Math.min(1, dt * 2.2);
  if (c.grab || c.fan) pasoFantasma(dt, muriendo);              // el rastro de esta carrera y la carrera contra el fantasma
}

/* ---- los trenes que vienen de frente se anuncian ----
   Solo sonido y vibración: no cambia nada del juego. Un tren en marcha que
   viene por TU carril toca la bocina cuando le faltan 2,4 s para cruzarse
   contigo (un bocinazo largo) y, si sigues ahí cuando falta 1 s, dos toques
   cortos y urgentes; si te metes en su carril ya tarde, van directo los dos
   toques. Uno del carril de al lado toca corto y bajito, como mucho uno cada
   3 s (si no, con varios trenes sería un concierto). La bocina suena del lado
   en que viene, y en un celular además vibra (si «Sacudir la pantalla» está
   encendido). Ejemplo: a 30 m/s con el tren a 11 m/s se acercan a 41 m/s:
   el bocinazo suena con el tren a ~98 m. */
function avisaTren(o) {
  const r = c.r, dz = o.d0 - c.D;                                // metros hasta su frente
  if (estado !== 'jugando' || dz <= 0 || dz > mundo.vista || c.poderes.mochila > 0) return;   // ya pasó, aún no se ve, o vuelas por encima
  const seg = dz / (c.V + o.vel);                                // segundos para cruzarse
  const lejos = Math.abs(o.carril - r.carril);                   // 0: mi carril; 1: el de al lado; 2: el del otro extremo
  const pan = Math.max(-1, Math.min(1, (M.CARRILES[o.carril] - r.x) / 3));   // de qué lado suena
  if (lejos === 0) {
    if (!o.bocina && seg < 2.4) { o.bocina = seg < 1 ? 2 : 1; sonido.bocina(o.bocina, pan); vibra(o.bocina === 2 ? 140 : [90, 60, 90]); }
    else if (o.bocina === 1 && seg < 1) { o.bocina = 2; sonido.bocina(2, pan); vibra(140); }
  } else if (lejos === 1 && !o.bocina && !o.bocinaLejos && seg < 2 && c.t - (c.bocinaLejos ?? -9) > 3) {   // c.bocinaLejos: cuándo tocó la última «de al lado»
    o.bocinaLejos = true; c.bocinaLejos = c.t; sonido.bocina(0, pan);
  }
}
/** Una vibración corta en el celular (Android; el iPhone no deja), solo si «Sacudir la pantalla» está encendido. */
function vibra(patron) {
  if (!esTactil || !opciones.sacudida || !navigator.vibrate) return;
  try { navigator.vibrate(patron); } catch (e) { /* sin permiso: no pasa nada */ }
}

/* ---- estaciones y túneles ---- */
function estaciones() {
  /* Las estaciones cambian con la DISTANCIA (M.ESTACIONES, en metros), no
     con los puntos. El túnel se pide ANTES de llegar al umbral: la pista ya
     está generada unos 230 m por delante (lo que se ve), así que un túnel
     pedido justo al cruzar el umbral recién aparecería 230 m después. Si
     faltan menos de 220 m, se pide ya y cae justo en el umbral, porque es
     ahí donde termina lo generado. Ejemplo: vas en el metro 1 300 y Ocaso
     empieza en el 1 500; el túnel cae a ~1 530 y Ocaso empieza al salir. */
  const sig = M.siguienteUmbral(c.D, c.modo);                    // el metro en que empieza la estación siguiente (Infinity si el mundo no tiene otra)
  const faltan = sig - c.D;                                      // cuántos metros faltan para llegar
  const e = M.estacionDe(faltan < 220 ? sig : c.D, c.modo);      // a donde se va: la que viene si llega pronto
  if (!c.cambio && e.clave !== c.estacion.clave) {
    c.cambio = { estacion: e, tunel: null, hecho: false };
    pideTunel(c.D + 40, e.id);                                   // (el del fantasma, si él ya lo pidió: ver «EL FANTASMA»)
    mundo.precarga(estacionVisual(e));
    mundo.letreroTunel(e.nombre);
  }
  // precarga el kit de la estación siguiente cuando falta poco (para que el túnel no se trabe)
  if (faltan < 900) mundo.precarga(estacionVisual(M.estacionDe(sig, c.modo)));
  const cb = c.cambio;
  if (cb && cb.tunel) {
    const o = cb.tunel;
    if (!cb.entro && c.D >= o.d0 - 2) { cb.entro = true; sonido.tunel(); altavozProxima(cb.estacion); }   // en el túnel no hay obstáculos: ahí habla el altavoz
    if (!cb.hecho && c.D >= o.d0 + 40) {                         // dentro del túnel (no se ve el mundo de afuera): se cambia todo
      cb.hecho = true;
      mundo.activa(estacionVisual(cb.estacion), o.d0 + o.largo + 4);
      c.estacion = cb.estacion;
      altavozEstacion();                                         // el «eco» de esta estación, más adelante y en un momento tranquilo
      sonido.tocaTema(cb.estacion.musica);
      pantalla.dataset.estilo = estacionVisual(cb.estacion).estilo;
      if (cb.estacion.boleto && c.modo.mundo === 'metro' && !progreso.boletos.includes(cb.estacion.boleto)) pideBoleto(cb.estacion.boleto, o.d0 + o.largo + 260);
      if (ciudad.faltaPostal(c, progreso, cb.estacion.boleto)) pideBoleto(cb.estacion.boleto, o.d0 + o.largo + 260);   // CITY: la postal del distrito
    }
    if (cb.hecho && c.D >= o.d0 + o.largo - 6) { banner(cb.estacion.nombre, cb.estacion.lema); c.cambio = null; }
  }
}

/* ===================================================================
   3 bis. EL FANTASMA (modos «Fantasma» y «City fantasma»)
   ===================================================================
   QUÉ HACE, EN GLOBAL
   En estos modos se corre contra la carrera más larga del mundo (la n.º 1
   de la tabla de distancia de todo el sitio, venga del modo normal, de Sin
   ayudas o de otro fantasma), en su MISMA pista y con sus MISMAS reglas: si
   él tuvo poderes y «seguir corriendo», tú también (M.conReglas). Se compite
   en metros: gana quien llega más lejos. Cinco piezas:
     1. Pedir el fantasma a la página (Club.pedirFantasma): la fila 1.ª de la
        tabla y su prueba. Se prepara con fantasma.js, que la pasa por el
        mismo `rehace` del antitrampas (si no cuadra, se corre solo). Si
        alguien bate el récord mientras tanto, la página manda el fantasma
        nuevo sin que se lo pidan (evento «club-fantasma»).
     2. Correr su pista: su semilla, y los túneles y boletos que él le pidió
        al generador, en el mismo punto (generaPista, pideTunel, pideBoleto).
        La prueba de ESTA carrera los anota como propios: para el
        antitrampas es una carrera más con esa semilla, y la acepta.
     3. Grabar el rastro de esta carrera (x, altura y qué hace, cada 0,1 s),
        para que la próxima persona la vea correr si queda n.º 1. Se graba
        en todos los modos que entran en la tabla de distancia.
     4. Dibujarlo: un corredor azul translúcido que sigue su rastro, sin
        sombra ni choques (mundo.js, «EL FANTASMA»).
     5. La ventaja en vivo, en metros (iguales mientras los dos corren: la
        velocidad es la misma para todos; se separan cuando uno choca). Un
        letrero cuando lo adelantas, y al final, quién ganó. Ganarle da el
        logro «Cazafantasmas».
   Los nombres nunca van en avisos ni letreros (esos se traducen): solo en
   la portada, dentro de translate="no", y en el letrerito 3D del fantasma.
   Un fantasma sin rastro (una carrera de antes del rastro) corre igual en
   metros, pero no se dibuja. */
const MF = window.MetroRushFantasma || null;                   // el rastro y la preparación del fantasma (fantasma.js)
const ESPERA_FANTASMA = 8000;                                  // ms que se espera la respuesta de la página antes de correr solo
const fantasmas = {};                                          // por categoría: {estado, g (el fantasma preparado), motivo, pidio, reloj}
let esperandoFantasma = false;                                 // «¡Jugar!» se tocó mientras el fantasma venía en camino

/** El fantasma listo para el modo `modo`, o null (no es un modo fantasma, o no hay). */
function fantasmaListo(modo) {
  const f = modo && modo.fantasma ? fantasmas[modo.categoria] : null;
  return f && f.estado === 'listo' ? f.g : null;
}
/** Pide a la página el n.º 1 de la tabla del modo. Una vez cada 30 s como
    mucho (la página guarda la tabla y la prueba, pero no hace falta
    preguntar en cada vuelta a la portada), salvo `forzar`. La respuesta
    llega por Club.pedirFantasma; si no llega en ESPERA_FANTASMA, se corre solo. */
function pideFantasma(modo, forzar) {
  if (!modo || !modo.fantasma || !MF) return;
  const cat = modo.categoria, ant = fantasmas[cat];
  if (ant && ant.estado === 'cargando') return;                // ya se está pidiendo
  if (ant && !forzar && ant.estado !== 'error' && performance.now() - ant.pidio < 30000) return;   // hace poco: vale lo que hay
  const info = { estado: 'cargando', g: null, motivo: '', pidio: performance.now(), reloj: 0 };
  fantasmas[cat] = info;
  /* dato: lo que mandó la página ({nombre, puntos, d…}) o null; motivo: por qué no hay */
  const llega = (dato, motivo) => {
    if (fantasmas[cat] !== info) return;                       // una respuesta a un pedido viejo
    if (info.estado !== 'cargando' && !(info.tarde && (dato || motivo !== 'error'))) return;   // ya contestada (una tardía vale si dice algo más que «error»)
    clearTimeout(info.reloj); info.tarde = false;
    if (!dato) info.estado = ['invitado', 'fuera', 'vacia'].includes(motivo) ? motivo : 'error';
    else {
      const g = MF.prepara(dato, MP, M, modo.id);              // pasa por rehace: un fantasma que no cuadra no se corre
      if (g.motivo) { info.estado = 'malo'; info.motivo = g.motivo; }
      else { info.estado = 'listo'; info.g = g; }
    }
    alLlegarFantasma();
  };
  /* si la página no contesta a tiempo se corre solo, pero la respuesta que
     llegue después aún vale para la carrera siguiente (un hilo ocupado
     compilando sombreadores en un teléfono lento puede atrasarla) */
  info.reloj = setTimeout(() => { llega(null, 'error'); info.tarde = true; }, ESPERA_FANTASMA);
  if (Club && Club.pedirFantasma) Club.pedirFantasma(cat, llega); else llega(null, 'fuera');
  pintaFantasmaPortada();
}
/** Llegó (o no) el fantasma: se repinta la portada, y si se tocó «¡Jugar!» esperándolo, se empieza. */
function alLlegarFantasma() {
  pintaFantasmaPortada();
  if (!esperandoFantasma) return;
  esperandoFantasma = false;
  // solo se arranca si nada cambió mientras tanto: sigue en un modo fantasma,
  // en la portada o el resumen, y sin un panel abierto (la tienda, la Libreta…)
  if (!modoSel.fantasma || panel) return;
  if (estado === 'portada' || estado === 'fin') { if (estado === 'fin') cierraCarrera(); empezar(); }
}
const ORDEN_FANTASMA = Object.keys(M.MODOS).filter(k => M.MODOS[k].fantasma);   // los modos que corren contra un fantasma
/* El n.º 1 cambió (alguien —quizá tú— batió el récord): la página manda el
   fantasma nuevo sin que se lo pidan. Se prepara igual que uno pedido y
   reemplaza al anterior, así la próxima carrera ya corre contra el nuevo.
   Si llega en medio de una carrera, esa sigue contra el que tenía. */
window.addEventListener('club-fantasma', e => {
  const d = e.detail; if (!d || !MF) return;
  const modo = ORDEN_FANTASMA.map(k => M.MODOS[k]).find(m => m.categoria === d.categoria);   // de qué modo fantasma es esa tabla
  if (!modo) return;
  const ant = fantasmas[d.categoria];
  if (ant) clearTimeout(ant.reloj);
  const info = { estado: 'vacia', g: null, motivo: '', pidio: performance.now(), reloj: 0 };
  if (d.dato) { const g = MF.prepara(d.dato, MP, M, modo.id); if (g.motivo) { info.estado = 'malo'; info.motivo = g.motivo; } else { info.estado = 'listo'; info.g = g; } }
  else if (d.motivo && d.motivo !== 'vacia') return;           // un «no hay» que no es «tabla vacía»: se queda el que había
  fantasmas[d.categoria] = info;
  alLlegarFantasma();
});
/** ¿Hay que esperar al fantasma antes de empezar? Solo si viene en camino
    (como mucho ESPERA_FANTASMA: después se corre solo). */
function esperaAlFantasma() {
  const f = modoSel.fantasma ? fantasmas[modoSel.categoria] : null;
  if (!f || f.estado !== 'cargando' || semillaSiguiente != null) return false;
  if (!esperandoFantasma) aviso('Buscando al fantasma…');
  esperandoFantasma = true;
  return true;
}

/** Lo que se lleva de un fantasma durante la carrera. */
function nuevoFan(g) {
  return {
    g,                                     // el fantasma preparado (fantasma.js: prepara)
    pi: 0,                                 // cuántos de sus pedidos a la pista ya se aplicaron
    reclamados: new Set(),                 // sus pedidos que esta carrera usó en vez de pedir uno propio
    diverge: false,                        // la pista dejó de ser la suya (no debería pasar): sus pedidos ya no se aplican
    lado: 0,                               // quién va ganando en metros: 1 tú, −1 él, 0 parejos (con margen)
    Dg: 0, vivo: true, caeT: 0,            // su metro ahora, si va corriendo, y cuándo cayó por última vez
    murio: false, superado: false,         // si ya terminó su carrera, y si ya lo pasaste después de eso
    fase: 0, ladeo: 0                      // su zancada y su inclinación (para dibujarlo)
  };
}

/* ---- su pista ----
   La pista sale de la semilla y de los pedidos (túneles y boletos), cada uno
   aplicado cuando lo generado llega a su `dSig`. Para que salga la misma que
   la del fantasma, sus pedidos se aplican en el mismo punto: se genera hasta
   ahí, se pide y se sigue. Esta carrera no pide los suyos mientras él los
   tenga: un túnel a la misma estación se «reclama» (ya viene en los de él),
   y un boleto que él no pidió (ya lo tenía) tampoco se pide mientras él
   corría ahí, porque cambiaría la pista. Pasado su choque, todo vuelve a ser
   como siempre. La prueba anota los pedidos tal cual: rehace los repite con
   la misma semilla, igual que si los hubiera pedido esta carrera.
   Ejemplo: el fantasma pidió el túnel a Ocaso en dSig 1 487; al generar hasta
   1 520 se genera primero hasta 1 487, se pide el túnel y se sigue. */
function generaPista(hasta, ctx) {
  const f = c.fan;
  if (!f || f.diverge) return c.gen.generarHasta(hasta, ctx);   // sin fantasma: como siempre
  const salida = [];
  while (f.pi < f.g.pedidos.length && f.g.pedidos[f.pi][1] <= hasta) {
    const q = f.g.pedidos[f.pi];
    for (const o of c.gen.generarHasta(q[1], ctx)) salida.push(o);   // hasta donde él lo pidió
    if (c.gen.estado().dSig !== q[1]) { f.diverge = true; console.warn('Metro Rush: la pista del fantasma se separó'); break; }
    MP.pedido(c.prueba, q[0], q[1], ...q.slice(2));             // en la prueba de esta carrera, en el mismo punto
    if (q[0] === 'T') c.gen.pedirTunel(q[2], q[3]);
    else if (q[0] === 'B') c.gen.pedirBoleto(q[2], q[3]);
    else for (const o of c.gen.monedasCielo(q[2], q[3], q[4])) salida.push(o);   // 'C', solo de un fantasma de la versión 2: su cinta movió el azar de su pista
    f.pi++;
  }
  for (const o of c.gen.generarHasta(hasta, ctx)) salida.push(o);
  return salida;
}
/** Busca un pedido del fantasma de ese tipo que cumpla `es` y no se haya usado; lo marca usado. */
function reclamaPedido(tipo, es) {
  const f = c.fan;
  if (!f || f.diverge) return false;
  for (let i = 0; i < f.g.pedidos.length; i++) {
    const q = f.g.pedidos[i];
    if (q[0] === tipo && !f.reclamados.has(i) && es(q)) { f.reclamados.add(i); return true; }
  }
  return false;
}
/** Un pedido propio con el fantasma corriendo todavía: si le quedan pedidos por aplicar, la pista ya no es la suya. */
function pedidoPropio() { const f = c.fan; if (f && !f.diverge && f.pi < f.g.pedidos.length) f.diverge = true; }
/** El túnel hacia la estación `id`: el del fantasma si él lo pidió, o uno propio. */
function pideTunel(desde, id) {
  if (reclamaPedido('T', q => q[3] === id)) return;              // ya viene en su pista
  pedidoPropio();
  anotaPedido('T', desde, id); c.gen.pedirTunel(desde, id);
}
/** El boleto `n`: el del fantasma si él lo pidió; si no, uno propio, salvo
    mientras él corría por ahí (no lo pidió: lo tenía, y pedirlo cambiaría su pista). */
function pideBoleto(n, desde) {
  const f = c.fan;
  if (f && !f.diverge) {
    if (reclamaPedido('B', q => q[2] === n)) return;
    if (c.D < f.g.Dm) return;                                    // él seguía corriendo aquí y no lo pidió
  }
  pedidoPropio();
  anotaPedido('B', n, desde); c.gen.pedirBoleto(n, desde);
}

/* ---- el paso del fantasma (lo llama actualiza en cada cuadro) ----
   1) graba el rastro de esta carrera mientras se corre; 2) calcula dónde va
   el fantasma (fantasma.js: metrosEn, con su curva y sus choques) y avisa
   cuando cambia quién va adelante. El margen (1,5 m) evita que los avisos
   vayan y vuelvan cuando van parejos: mientras los dos corren van hombro con
   hombro, y eso se lee «a la par», no como una ventaja de centímetros. */
const MARGEN_FAN = 1.5;
function pasoFantasma(dt, muriendo) {
  // 1) el rastro: una muestra cada 0,1 s de juego, mientras se corre (al chocar se para; al seguir corriendo se pone al día)
  if (c.grab && estado === 'jugando' && !muriendo) {
    const r = c.r;
    const s = r.tropezarT >= 0 ? 4 : r.rodar > 0 ? 3 : r.enAire ? (r.vy > 0 ? 1 : 2) : 0;   // tropieza, rueda, sube, baja o corre
    while (c.t >= c.rastroK * MF.PASO) { c.grab.muestra(r.x, r.y, s); c.rastroK++; }
  }
  const f = c.fan;
  if (!f) return;
  const g = f.g, yoVivo = !c.muerte;
  // 2) dónde va: sus metros a este segundo de juego, y si va corriendo
  f.Dg = MF.metrosEn(g.pasos, g.curva, c.t);
  const vivoG = MF.vivoEn(g.pasos, c.t);
  if (!vivoG && f.vivo) f.caeT = c.t;                            // acaba de caer (en el modo normal puede volver a correr)
  f.vivo = vivoG;
  if (vivoG) f.fase += dt * (8 + g.curva.velocidad(c.t) * 0.32); // su zancada, como la tuya
  // terminó su carrera (su último choque)
  if (c.t >= g.tf && !f.murio) {
    f.murio = true;
    if (yoVivo) aviso(c.D > g.Df ? '¡El fantasma chocó y vas más lejos!' : `El fantasma chocó: llega más allá de sus ${fmt(g.metros)} m`);
  }
  // quién va adelante, con margen
  const dif = c.D - f.Dg;
  const lado = dif > MARGEN_FAN ? 1 : dif < -MARGEN_FAN ? -1 : (f.murio ? f.lado : 0);
  if (lado !== f.lado && yoVivo && estado === 'jugando') {
    if (lado === 1 && f.murio && !f.superado) {                  // pasaste el metro donde quedó: le ganaste
      f.superado = true;
      banner('¡Superaste al fantasma!', 'Su récord: ' + fmt(g.metros) + ' m');
      sonido.record();
    } else if (lado === 1 && f.lado !== 1 && !f.murio) aviso('¡Vas delante del fantasma!');
    else if (lado === -1 && f.lado !== -1) aviso('El fantasma va delante');
  }
  f.lado = lado;
}

/** Lo que mundo.paso necesita para dibujar al fantasma este cuadro, o null.
    x e y salen de su rastro (interpolados); de lado y hacia arriba se ve
    exactamente lo que él hizo. Hacia adelante va donde dicen sus metros:
    a tu altura mientras los dos corren (la misma velocidad), atrás si
    chocó, adelante si chocaste tú. */
function dibujoFantasma() {
  const f = c && c.fan;
  if (!f || !f.g.rastro || estado === 'portada') return null;
  const g = f.g, ra = g.rastro, t = c.t;
  const p = MF.estadoEn(ra, t);                                  // pasado el rastro, la última muestra
  if (!p) return null;
  // su velocidad de lado y vertical, de las muestras alrededor (para inclinarlo y para la pose del salto)
  const a = MF.estadoEn(ra, Math.max(0, t - 0.05)), b = MF.estadoEn(ra, t + 0.05);
  const vx = (b.x - a.x) / 0.1, vy = (b.y - a.y) / 0.1;
  f.ladeo += (Math.max(-0.45, Math.min(0.45, -vx * 0.031)) - f.ladeo) * 0.25;
  const z = Math.abs(f.Dg - c.D) < 0.05 ? 0 : f.Dg - c.D;        // corriendo los dos, a tu lado (sin temblar por centímetros)
  const desde = () => t - MF.desdeEn(ra, t);                     // cuánto lleva en este estado
  const pose = !f.vivo ? { modo: 'caer', t: t - f.caeT }
    : p.s === 4 ? { modo: 'tropezar', t: desde(), fase: f.fase, ladeo: f.ladeo }
      : p.s === 3 ? { modo: 'rodar', t: desde() }
        : p.s === 1 || p.s === 2 ? { modo: 'saltar', vy: p.s === 1 ? Math.max(1, vy) : Math.min(-1, vy), ladeo: f.ladeo }
          : { modo: 'correr', fase: f.fase, ladeo: f.ladeo };
  const alfa = f.vivo ? 1 : Math.max(0.35, 1 - (t - f.caeT) / 1.5);   // caído se va apagando (sin desaparecer: se ve dónde quedó)
  return { x: p.x, y: f.vivo ? p.y : 0, z, pose, alfa, nombre: g.yo ? 'Tu récord' : g.nombre };
}

/** La ventaja en el marcador, en metros: «a la par» mientras van juntos,
    + adelante, − atrás; abajo, hasta dónde llegó su récord. */
function pintaFantasmaHud() {
  const f = c.fan, dm = Math.round(c.D - f.Dg);
  ponTexto('hudFanPts', f.lado === 0 && Math.abs(dm) <= MARGEN_FAN ? 'a la par' : (dm >= 0 ? '+' : '−') + fmt(Math.abs(dm)) + ' m');
  ponTexto('hudFanM', 'récord ' + fmt(f.g.metros) + ' m');
  const el = $('hudFan'), ld = String(f.lado);
  if (el.dataset.lado !== ld) el.dataset.lado = ld;              // verde si ganas, rojo si pierdes
}
/** En la portada, contra quién se va a correr (solo en los modos fantasma). */
function pintaFantasmaPortada() {
  const el = $('modoFantasma');
  if (!el) return;
  const f = modoSel.fantasma ? fantasmas[modoSel.categoria] : null;
  el.hidden = !modoSel.fantasma;
  if (!modoSel.fantasma) return;
  const estadoF = f ? f.estado : MF ? 'cargando' : 'error';
  el.dataset.estado = estadoF;
  el.textContent = '';
  const pon = (txt, sinTraducir) => { const n = document.createElement(sinTraducir ? 'b' : 'span'); n.textContent = txt; if (sinTraducir) n.setAttribute('translate', 'no'); el.appendChild(n); };
  if (estadoF === 'listo') {
    const g = f.g;
    if (g.yo) pon('Corres contra tu propio récord: ');
    else { pon('Corres contra '); pon(g.nombre, true); pon(': '); }   // el nombre de una persona no se traduce
    pon(fmt(g.metros) + ' m', true);
    pon(' · con las reglas de «' + M.MODOS[g.reglas].nombre + '»');
    if (!g.rastro) pon(' (su carrera no trae rastro: solo verás sus metros)');
  } else pon({
    cargando: 'Buscando al fantasma de la carrera más larga…',
    vacia: 'Nadie tiene récord de distancia aún: tu carrera será el primer fantasma.',
    invitado: 'Inicia sesión en Juegos para correr contra el fantasma del récord.',
    fuera: 'Abre Metro Rush desde Juegos para correr contra el fantasma del récord.',
    malo: 'El fantasma del récord no se puede usar (' + (f && f.motivo) + '): correrás solo.',
    error: 'No se pudo traer al fantasma: esta vez correrás solo.'
  }[estadoF] || '');
}
/** En el resumen: cómo te fue contra el fantasma, en metros. */
function pintaFinFantasma(k) {
  const el = $('finFantasma');
  if (!el) return;
  el.hidden = !k.modo.fantasma;
  if (!k.modo.fantasma) return;
  el.textContent = '';
  const pon = (txt, num) => { const n = document.createElement(num ? 'b' : 'span'); n.textContent = txt; if (num) n.setAttribute('translate', 'no'); el.appendChild(n); };
  const f = c.fan;
  if (!f) { pon(k.metros >= 1 ? 'Corriste sin fantasma: si es la carrera más larga, será el próximo fantasma.' : 'Corriste sin fantasma.'); el.dataset.lado = '0'; return; }
  const dif = k.metros - f.g.metros;                             // contra su carrera entera (lo que dice la tabla)
  el.dataset.lado = dif > 0 ? '1' : dif < 0 ? '-1' : '0';
  if (dif > 0) { pon('¡Le ganaste al fantasma por '); pon(fmt(dif) + ' m', true); pon('!'); }
  else if (dif < 0) { pon('El fantasma llegó '); pon(fmt(-dif) + ' m', true); pon(' más lejos'); }
  else pon('Empate exacto con el fantasma');
  // al rato se vuelve a preguntar quién es el n.º 1 (si ganaste, el próximo fantasma eres tú; la página además lo manda sola)
  const modo = k.modo;
  setTimeout(() => pideFantasma(M.MODOS[modo.id], true), 3000);
}

/* ---- retos (se avisan apenas se cumplen) ---- */
let relojRetos = 0;
function retosEnVivo(dt) {
  relojRetos -= dt;
  if (relojRetos > 0) return;
  relojRetos = 0.5;
  const { cumplidos } = M.avanzaRetos(progreso.retos, c.cuenta, false);
  const lista = M.retosDeNivel(progreso.retos.nivel);
  for (const i of cumplidos) {
    if (c.avisados.has(i) || progreso.retos.avance[i] >= lista[i].meta) continue;
    c.avisados.add(i); sonido.reto(); aviso('Misión cumplida: ' + lista[i].texto);
  }
}

/* ---- las pistas de las primeras carreras ----
   Como el tutorial de Subway Surfers, pero sin detener nada: en las dos
   primeras carreras, cuando por tu carril viene una barrera o un tren, aparece
   en grande qué hacer (en un celular, hacia dónde deslizar; en un PC, qué
   tecla). Cada clase se explica dos veces por carrera como mucho, y la pista
   se va cuando el obstáculo quedó atrás o te cambiaste de carril.
   Ejemplo: a 13 m/s, una barrera baja a 20 m (1,5 s) muestra «Desliza hacia
   arriba: ¡salta!» hasta que la pasas. */
const PISTAS = {
  bajo: { ico: 'salto', tactil: 'Desliza hacia arriba: ¡salta!', teclas: '↑ o Espacio: ¡salta!' },
  alto: { ico: 'rueda', tactil: 'Desliza hacia abajo: ¡rueda!', teclas: '↓ o S: ¡rueda!' },
  tren: { ico: 'lados', tactil: 'Desliza a un lado: ¡esquiva!', teclas: '← o →: ¡esquiva!' }
};
/* Qué pista enseña cada cosa: en City no hay barreras (sus filas son de
   cajones, que se saltan como la baja, y de drones, que se ruedan como la
   alta), así que sin esto sus primeras carreras no enseñaban nada. La rampa
   está para saber que no es un problema (se sube). */
const PISTA_DE = { bajo: 'bajo', alto: 'alto', tren: 'tren', rampa: 'rampa', cajon: 'bajo', dron: 'alto', seto: 'seto' };
/* El seto del parque enseña dos cosas: dentro de las burbujas se salta
   (el salto flota y lo pasa); fuera es un muro de 2,8 m, como un vagón, y se
   esquiva. Ejemplo: la pared de tres setos de punta a punta solo se pasa
   saltando, y eso es lo que dice la pista. */
const pistaDe = o => PISTA_DE[o.tipo] === 'seto' ? (c.ciudad && c.ciudad.enBurbuja ? 'bajo' : 'tren') : PISTA_DE[o.tipo];
let relojPista = 0;
function ocultaPista() { if (c) c.pista = null; $('pista').hidden = true; }
function pistas(dt) {
  if (!c.tutorial) return;
  relojPista -= dt;
  if (relojPista > 0) return;
  relojPista = 0.12;                                             // no hace falta mirarlo en cada cuadro
  const r = c.r;
  if (c.pista) {                                                 // la de ahora: ¿ya pasó?
    const o = c.pista.o, frente = o.d != null ? o.d : o.d0;
    if (frente < c.D || o.carril !== r.carril || !c.activos.includes(o)) ocultaPista();
    return;
  }
  if (c.poderes.mochila > 0 || r.y > 1.5) return;                // volando o arriba de un tren no hay nada que explicar
  // lo más cercano por delante en mi carril (una rampa no es un problema: se sube)
  let cerca = null, dz0 = Infinity;
  for (const o of c.activos) {
    if (o.carril !== r.carril || !PISTA_DE[o.tipo] || o.roto) continue;   // (un cajón ya pisado no enseña nada)
    const dz = (o.d != null ? o.d : o.d0) - c.D;
    if (dz > 0 && dz < dz0) { dz0 = dz; cerca = o; }
  }
  const k = cerca && pistaDe(cerca);                       // la pista que toca (un cajón enseña a saltar, como la barrera baja)
  if (!cerca || k === 'rampa' || c.tutorial[k] >= 2) return;
  const cierre = c.V + (cerca.tipo === 'tren' && cerca.activo ? cerca.vel : 0);   // un tren que viene se acerca más rápido
  if (dz0 / Math.max(1, cierre) > 1.6) return;                   // todavía lejos: se avisa 1,6 s antes
  c.tutorial[k]++;
  c.pista = { tipo: k, o: cerca };
  const P = PISTAS[k], el = $('pista');
  el.dataset.tipo = k;
  $('pistaIco').innerHTML = ICONOS[P.ico];
  $('pistaTxt').textContent = esTactil ? P.tactil : P.teclas;
  el.hidden = false;
}

/* ---- el altavoz del andén (la historia que se oye) ----
   La Libreta cuenta la historia con el juego en pausa; el altavoz la cuenta
   mientras se corre, sin detener nada. Es una franja chica arriba al centro
   (debajo del marcador, lejos del letrero grande, de los avisos y de las
   pistas, que van abajo) con un «ding-dong» de estación antes de hablar.
   Habla dos veces por estación (textos en historia.js):
   - «Próxima estación…» al entrar al túnel: en el túnel no hay obstáculos,
     así que es el único momento en que leer no compite con esquivar;
   - el «eco», una sola vez, pasados ECO_TRAS segundos en la estación y solo
     en un momento tranquilo: sin pista del tutorial a la vista, sin el
     letrero grande y sin nada por tu carril en los próximos ECO_LIBRE
     segundos. Si en ECO_ESPERA segundos no hay calma, no se dice (otra
     visita será).
   Solo en la Línea 3 (el mundo de esta historia), y no cambia nada del
   juego: ni puntos, ni metros, ni la prueba. Ejemplo: a 30 m/s el túnel
   dura 5 s; el anuncio queda 4,5 s más lo que tarde en leerse. */
const HIST = window.MetroRushHistoria || null;                 // los textos (historia.js); sin él, el altavoz calla
const ECO_TRAS = 20, ECO_ESPERA = 25, ECO_LIBRE = 2.2;
let altavozT = 0;                                               // segundos que le quedan al anuncio a la vista
/** ¿Habla el altavoz en esta carrera? Solo en la Línea 3. */
const altavozActivo = () => !!(HIST && c && c.modo.mundo === 'metro');
/** Muestra un anuncio, con su ding-dong. La duración crece con el largo del texto (de 4,5 a 7 s). */
function altavozDice(txt) {
  if (!txt) return;
  $('altavozTxt').textContent = txt;
  const el = $('altavoz'); el.hidden = false; el.classList.remove('ver'); void el.offsetWidth; el.classList.add('ver');
  altavozT = Math.min(7, 4.5 + txt.length * 0.03);
  sonido.dingDong();
  sonido.anuncio(txt);                                          // y lo dice la voz grabada, al terminar el ding-dong (sin grabación, callado)
}
/** Esconde el anuncio (pausa, choque, portada, carrera nueva). */
function altavozCalla() { altavozT = 0; const el = $('altavoz'); if (el) { el.classList.remove('ver'); el.hidden = true; } }
/** Al entrar al túnel de la estación `est`: «Próxima estación…». */
function altavozProxima(est) { if (altavozActivo()) altavozDice(HIST.anuncioProxima(est)); }
/** Al llegar a una estación: el eco queda programado (una vez por visita). */
function altavozEstacion() { if (c) c.eco = altavozActivo() ? { t: 0, txt: HIST.anuncioEco(c.estacion) } : null; }
/** Cada cuadro: apaga el anuncio cuando se cumple su tiempo y decide si llegó el momento del eco. */
function altavoz(dt) {
  if (altavozT > 0) { altavozT -= dt; if (altavozT <= 0) { $('altavoz').classList.remove('ver'); setTimeout(() => { if (altavozT <= 0) $('altavoz').hidden = true; }, 400); } }
  const eco = c.eco;
  if (!eco || !eco.txt) return;
  eco.t += dt;
  if (eco.t < ECO_TRAS) return;
  if (eco.t > ECO_TRAS + ECO_ESPERA) { c.eco = null; return; }   // no hubo calma: se queda sin decir
  if (altavozT > 0 || c.pista || c.banner > 0 || c.cambio) return;   // ya hay algo que leer, o viene un túnel
  // ¿viene algo por mi carril en los próximos segundos? (lo mismo que miran las pistas del tutorial)
  for (const o of c.activos) {
    if (o.carril !== c.r.carril || !(o.tipo === 'bajo' || o.tipo === 'alto' || o.tipo === 'tren' || o.tipo === 'rampa')) continue;
    const dz = (o.d != null ? o.d : o.d0) - c.D, cierre = c.V + (o.tipo === 'tren' && o.activo ? o.vel : 0);
    if (dz > -2 && dz / Math.max(1, cierre) < ECO_LIBRE) return;
  }
  altavozDice(eco.txt); c.eco = null;
}

/* ---- los boletos de la Línea 3 ----
   Son uno por estación (hoy diez). El número de un boleto es su nombre (los
   1 a 7 de siempre y 8 a 10 de las estaciones nuevas); lo que se muestra es
   su lugar en la vía. El aspecto Inspector se gana con TODOS: quien ya lo
   ganó con los siete de antes lo conserva (está en sus aspectos). */
/** Las estaciones de la Línea 3 que tienen boleto, en el orden de la vía. */
const boletosLinea = () => M.ESTACIONES.filter(e => e.boleto);
/** Cuántos de esos tienes. */
const boletosTenidos = () => boletosLinea().filter(e => progreso.boletos.includes(e.boleto)).length;
/** ¿Están todos? */
const tieneTodosLosBoletos = () => boletosTenidos() === boletosLinea().length;

/* ===================================================================
   4. EL CICLO DE LA PARTIDA (empezar, pausa, fin, seguir)
   =================================================================== */
function empezar() {
  sonido.iniciar();
  if (!progreso.intro) { abreRelato(); return; }               // la primera vez se cuenta de qué se trata
  if (esperaAlFantasma()) return;                               // el fantasma viene en camino: se empieza apenas llegue (o a los 8 s, solo)
  cierraPanel();
  c = nuevaCarrera(); ocultaPista(); altavozCalla();
  mundo.reinicia();
  mundo.lore(c.modo.mundo === 'metro');                        // los afiches y el 317 cuentan la historia de la Línea 3: solo en su mundo
  ciudad.inicia(c, progreso, mundo);                            // CITY: la curva de velocidad del modo (mundo y sonido) y lo de City
  vistePuesto();                                                // CITY: en City corre con su personaje de City
  const e = estacionVisual(c.estacion);
  mundo.activa(e, 0);
  altavozEstacion();                                            // el primer «eco» (Barrio: la línea cierra mañana)
  pantalla.dataset.estilo = e.estilo;
  for (const o of generaPista(230, { V: c.V })) c.activos.push(o);
  // el boleto de la primera estación (solo en la Línea 3: los boletos guardados son de ese mundo)
  if (c.estacion.boleto && c.modo.mundo === 'metro' && !progreso.boletos.includes(c.estacion.boleto)) pideBoleto(c.estacion.boleto, 420);
  if (ciudad.faltaPostal(c, progreso, c.estacion.boleto)) pideBoleto(c.estacion.boleto, 420);   // CITY: la postal de Barrio Sur
  estado = 'jugando';
  muestraCapa(null);
  $('hud').hidden = false;
  pintaModoHud();                                               // la insignia del modo y lo que el modo no tiene (patinetas)
  mundo.monedasPeligro(!!c.modo.monedasMatan);                  // en «Sin monedas» las monedas se ven rojas: son un peligro
  if (Club && Club.inmersivo) Club.inmersivo(true);             // en un teléfono vertical, la carrera ocupa toda la pantalla
  sonido.tocaTema(c.estacion.musica);
  banner(c.estacion.nombre, c.estacion.lema);
  if (esTactil && progreso.totales.carreras < 3) aviso('Desliza el dedo: ← → carril · ↑ saltar · ↓ rodar');
  if (Club) Club.category(c.modo.categoria);                    // la clasificación del costado: la tabla de este modo
  pintaPots();
  lienzo.focus({ preventScroll: true });
  midiendo = { t: 0, n: 0, suma: 0 };
}
function pausar() {
  if (estado !== 'jugando') return;
  estado = 'pausa'; sonido.calla(); sonido.mochila(false); altavozCalla();
  if (Club && Club.inmersivo) Club.inmersivo(false);            // en pausa vuelven el marcador de la página y el volumen
  $('pausaDetalle').textContent = `${fmt(c.puntos)} puntos · ${fmt(c.D)} m · ${c.monedas} monedas`;
  muestraCapa('capaPausa');
}
function seguirJugando() {
  if (estado !== 'pausa') return;
  cierraPanel(); muestraCapa(null);
  estado = 'jugando'; sonido.tocaTema(c.estacion.musica);
  if (Club && Club.inmersivo) Club.inmersivo(true);
  if (c.poderes.mochila > 0) sonido.mochila(true);
  prevT = performance.now();
}
/* ---- después del choque: «¿Seguir corriendo?» ----
   Como en Subway Surfers: antes del resumen aparece un botón redondo con el
   precio y un anillo que se vacía en 5 segundos. Tocarlo paga y sigue la
   misma carrera; si el anillo se acaba (o tocas «No, gracias») va al resumen.
   Solo aparece si alcanzan las monedas (las de esta carrera más las
   guardadas) y nunca tras «Terminar la carrera». */
const SALVAR_SEG = 5;
function puedeSalvar() { return c && c.modo.revivir && c.muerte && c.muerte.motivo !== 'abandono' && progreso.monedas + c.monedas >= M.costoSeguir(c.seguirVeces); }
function abreSalvar() {
  estado = 'salvar'; c.salvarT = SALVAR_SEG; c.salvarTic = SALVAR_SEG;
  sonido.calla();
  $('salvarCosto').textContent = fmt(M.costoSeguir(c.seguirVeces));
  $('salvarTienes').textContent = fmt(progreso.monedas + c.monedas);
  $('salvarAnillo').style.strokeDashoffset = '0';
  $('hud').hidden = true;                                        // el marcador estorba al cartel (vuelve si sigue la carrera)
  muestraCapa('capaSalvar');
}
/** La cuenta regresiva (en tiempo real: con la pestaña escondida no corre, porque no hay cuadros). */
function pasoSalvar(dt) {
  c.salvarT -= dt;
  $('salvarAnillo').style.strokeDashoffset = (100 * (1 - Math.max(0, c.salvarT) / SALVAR_SEG)).toFixed(2);
  if (c.salvarT < c.salvarTic - 1 && c.salvarT > 0) { c.salvarTic = Math.ceil(c.salvarT); sonido.tic(c.salvarTic <= 1); }   // un tic por segundo
  if (c.salvarT <= 0) muestraFin();
}
const MOTIVOS = { atrapado: 'Don Ramón te atrapó', tren: 'Te atropelló un tren', bajo: 'Chocaste con una barrera', alto: 'Te diste con un letrero', rampa: 'Chocaste con una rampa', moneda: 'Tocaste una moneda', abandono: 'Carrera terminada' };
Object.assign(MOTIVOS, ciudad.MOTIVOS);                       // CITY: cajones, drones y barandas
let cuentaFin = 0;                                              // para cortar la animación de los puntos si se sale antes
/** El resumen. La carrera se cierra aquí mismo (monedas, récords, misiones,
    clasificación): después ya no se puede seguir, así que no hay nada que esperar. */
function muestraFin() {
  if (!c || estado === 'fin') return;
  estado = 'fin';
  sonido.calla();
  if (Club && Club.inmersivo) Club.inmersivo(false);            // el resumen se ve con la página entera (clasificación, volumen)
  const k = cierraCarrera();
  c.potVentana = 0; pintaPots(); ocultaPista();                 // por si se terminó desde la pausa en los primeros segundos
  pintaPortada();                                               // el marcador de la página (récord, monedas, multiplicador) ya cambió
  $('finTitulo').textContent = MOTIVOS[c.muerte && c.muerte.motivo] || 'Fin de la carrera';
  const fanM = !!k.modo.fantasma, val = fanM ? k.metros : k.puntos, uni = fanM ? ' m' : '';   // en un modo fantasma el récord es en metros
  const nuevo = val > k.recordAntes && k.recordAntes > 0;
  $('finRecord').hidden = !nuevo;
  $('finMejor').textContent = nuevo ? `Antes: ${fmt(k.recordAntes)}${uni}` : `Récord: ${fmt(Math.max(k.recordAntes, val))}${uni}`;
  $('finStats').innerHTML = [
    ['moneda', '+' + fmt(k.monedas), 'monedas'], ['bandera', fmt(k.metros) + ' m', 'distancia'],
    ['estrella', '×' + k.mult, 'multiplicador'], ['tren', c.estacion.nombre, 'estación', 'largo']
  ].map(([ico, v, nom, cls]) => `<li${cls ? ` class="${cls}"` : ''}><i>${ICONOS[ico]}</i><b translate="no">${v}</b><small>${nom}</small></li>`).join('');
  // las misiones: si el set se completó, se muestran las del set terminado (las tres cumplidas) y el premio
  $('finSet').hidden = !k.subio;
  if (k.subio) $('finSet').innerHTML = `¡Set completo! Multiplicador <b translate="no">×${progreso.retos.nivel}</b> y ${ICONOS.moneda}<b translate="no">+${fmt(k.premio)}</b>`;
  filasRetos($('finRetos'), k.nivelRetos, k.avanceRetos);
  $('finFuera').hidden = !k.fuera; $('finFuera').textContent = k.fuera || '';
  // a qué tabla fue la carrera (o a cuál habría ido): la del modo, y la distancia si fue récord en el clásico
  const nomDist = (k.modo.mundo === 'city' ? 'City distancia' : 'Distancia');   // el nombre de la tabla de distancia de su mundo
  $('finTabla').innerHTML = fanM
    ? `${ICONOS[ICONO_MODO[k.modo.id]] || ''}<span>${k.enviada ? 'Va a la tabla' : 'Tabla'} «<b>${nomDist}</b>»</span>`
    : `${ICONOS[ICONO_MODO[k.modo.id]] || ''}<span>${k.enviada ? 'Va a la tabla' : 'Tabla del modo'} «<b>${k.modo.nombre}</b>»${k.enviada && k.distancia ? ` y a «<b>${nomDist}</b>»` : ''}</span>`;
  $('finTabla').dataset.modo = k.modo.id;
  pintaFinFantasma(k);                                          // contra el fantasma: quién ganó (modos «Fantasma»)
  muestraCapa('capaFin');
  // los puntos suben contando, con un tic suave (como el «score» de Subway Surfers)
  const el = $('finPuntos'), yo = ++cuentaFin, t0 = performance.now(), dur = k.puntos > 0 ? 900 : 0;
  let ultTic = 0;
  el.classList.remove('pum');
  const sube = ahora => {
    if (yo !== cuentaFin) return;
    const u = dur ? Math.min(1, Math.max(0, (ahora - t0) / dur)) : 1, e = 1 - Math.pow(1 - u, 3);
    el.textContent = fmt(k.puntos * e);
    if (ahora - ultTic > 70 && u < 1) { ultTic = ahora; sonido.sube(e); }
    if (u < 1) requestAnimationFrame(sube); else if (nuevo || k.subio) { el.classList.add('pum'); sonido.record(); }
  };
  requestAnimationFrame(sube);
}
/** Sigue la misma carrera después de chocar, pagando monedas. */
function seguirTrasChoque() {
  if (!c || estado !== 'salvar') return;                         // solo desde «¿Seguir corriendo?» (después del resumen ya no)
  const costo = M.costoSeguir(c.seguirVeces);
  if (c.monedas + progreso.monedas < costo) return;              // no alcanza (el botón ni se muestra, pero por si acaso)
  const deCarrera = Math.min(c.monedas, costo);                  // primero se paga con las monedas de esta carrera…
  c.monedas -= deCarrera; progreso.monedas -= costo - deCarrera; // …y el resto con las guardadas
  c.seguirVeces++; guardar();
  anota('s');
  // se despeja la vía alrededor y hay unos segundos de protección
  // (se mira dónde termina cada cosa, no solo dónde empieza: un convoy largo que empezó atrás seguiría debajo de ti)
  for (let i = c.activos.length - 1; i >= 0; i--) {
    const o = c.activos[i], d0 = o.d != null ? o.d : o.d0, d1 = d0 + (o.largo || 0);
    if (d1 > c.D - 15 && d0 < c.D + 60 && o.tipo !== 'moneda' && o.tipo !== 'tunel') { mundo.suelta(o); c.activos.splice(i, 1); }
  }
  c.r.y = c.r.suelo = 0; c.r.vy = 0; c.r.enAire = false; c.r.rodar = 0;
  c.invulnerable = 3; c.tropiezo = 0; c.perseguidorObj = 0; c.muerte = null;
  estado = 'jugando'; muestraCapa(null); $('hud').hidden = false;
  sonido.seguir(); sonido.tocaTema(c.estacion.musica);
  prevT = performance.now();
}
/** Cierra la carrera: suma monedas, récords y misiones, guarda y avisa a la
    clasificación. Devuelve lo que muestra el resumen (y lo mismo si se llama
    otra vez: cerrar dos veces no suma dos veces). */
function cierraCarrera() {
  if (!c) return null;
  if (c.finalizada) return c.cierre;
  c.finalizada = true;
  const puntos = Math.floor(c.puntos), metros = Math.floor(c.D), ms = Math.max(1, Math.round(c.t * 1000));   // las reglas piden enteros y un tiempo de al menos 1 ms
  const mult = multiplicador();                                  // antes de que suba el multiplicador base
  // la distancia: una tabla por mundo (Línea 3 o City) que reúne su modo normal, su «sin ayudas» y su fantasma
  const tablaDist = M.distanciaDe(c.modo);
  const distAntes = M.distanciaRecord(progreso, c.modo);         // el récord de distancia de este mundo, antes de esta carrera
  const fanM = !!c.modo.fantasma;                                // en un modo fantasma solo se compiten metros
  const recordAntes = M.anotaRecord(progreso, c.modo, fanM ? metros : puntos);   // el récord de ESTE modo (en un fantasma, su distancia)
  progreso.monedas += c.monedas;
  progreso.totales.carreras++; progreso.totales.metros += metros; progreso.totales.monedas += c.monedas;
  const recordDist = !!tablaDist && metros > distAntes;          // ¿mejoró la distancia de su mundo?
  if (tablaDist) M.anotaDistancia(progreso, c.modo, metros);
  progreso.records.monedas = Math.max(progreso.records.monedas, c.monedas);
  const nivelAntes = progreso.retos.nivel;
  const res = M.avanzaRetos(progreso.retos, c.cuenta, true);
  // lo que se muestra: el set de esta carrera (si se completó, sus tres metas cumplidas)
  const avanceRetos = res.subio ? M.retosDeNivel(nivelAntes).map(r => r.meta) : res.retos.avance;
  progreso.retos = res.retos;
  const premio = res.subio ? M.premioSet(nivelAntes) : 0;         // completar el set también paga
  progreso.monedas += premio;
  guardar();
  if (res.subio) sonido.multiplicador();
  // la prueba: el fin de la carrera, y el juego se revisa a sí mismo con lo mismo que usará el club
  const prueba = cierraPrueba(puntos, metros, ms);
  // a la clasificación (con su prueba). Un modo fantasma no tiene tabla de puntos: su carrera va siempre,
  // en metros, a la distancia de su mundo (cuenta como partida del club). Los demás van siempre a la tabla
  // de su modo y, si mejoraron la distancia de su mundo, también a esa.
  const enviada = !!(Club && Club.result && prueba && (fanM ? metros >= 1 : puntos >= 1));
  let aDist = false;
  if (enviada) {
    if (fanM) { Club.result({ categoria: tablaDist.categoria, puntos: Math.min(1e6, metros), tiempo: ms }, prueba); }
    else {
      Club.result({ categoria: c.modo.categoria, puntos: Math.min(1e9, puntos), tiempo: ms }, prueba);
      if (tablaDist && recordDist && metros >= 1) { Club.result({ categoria: tablaDist.categoria, puntos: Math.min(1e6, metros), tiempo: ms }, prueba); aDist = true; }
    }
  }
  // el logro «Cazafantasmas»: pasar al fantasma (su récord) en una carrera de verdad, que va a la clasificación
  const cazado = !!(enviada && fanM && c.fan && c.fan.g && metros > c.fan.g.metros);   // (también contra tu propio récord: es el n.º 1 igual)
  if (cazado && Club && Club.logro) Club.logro('fan');
  c.cierre = { puntos, metros, monedas: c.monedas, mult, recordAntes, subio: res.subio, premio, nivelRetos: nivelAntes, avanceRetos, fuera: c.fuera,
    modo: c.modo, enviada, distancia: aDist, cazado };
  return c.cierre;
}
/** Cierra la prueba y decide si la carrera va a la clasificación. Devuelve
    la prueba, o null si no va: una carrera tocada con __metrorush o con
    entradas que no hizo una persona, o una prueba que no cuadra (eso sería un
    error de este juego: se avisa en la consola en vez de mandar algo que el
    club rechazaría como trampa). */
function cierraPrueba(puntos, metros, ms) {
  if (!c.prueba) return null;
  if (!c.muerte) anota('m');                                    // se cerró en plena carrera (la pestaña, desde la pausa): ahí paran los puntos
  anota('f');
  const prueba = MP.cierra(JSON.parse(JSON.stringify(c.prueba)), { sn: c.sinteticas });
  if (c.grab) c.rastro = c.grab.texto();                         // el rastro de esta carrera (modos fantasma)
  if (typeof c.rastro === 'string' && MP.ponFantasma) MP.ponFantasma(prueba, c.rastro);   // el rastro del fantasma (no cuenta para los puntos)
  c.pruebaFinal = prueba;
  if (c.tocada || tocada) { c.fuera = 'Partida de prueba (se usó __metrorush): no entra en la clasificación.'; return null; }
  if (c.sinteticas > 0) { c.fuera = 'Esta carrera tuvo teclas que no apretó una persona: no entra en la clasificación.'; return null; }
  let r = MP.rehace(prueba);
  /* Si lo que no cuadra es el rastro (un error nuestro al grabarlo), se
     manda sin él: el récord vale igual, solo que no se podrá ver correr. */
  if (r.motivo && prueba.g !== undefined) { const sinG = Object.assign({}, prueba); delete sinG.g; const r2 = MP.rehace(sinG); if (!r2.motivo) { console.warn('Metro Rush: el rastro no cuadra; va sin él', r.motivo); delete prueba.g; r = r2; } }
  if (r.motivo || Math.abs(r.puntos - puntos) > 2 || r.metros !== metros || Math.abs(r.tiempo - ms) > 100) {
    console.warn('Metro Rush: la prueba no cuadra con la carrera', r, { puntos, metros, ms });
    c.fuera = 'Esta carrera no se pudo comprobar, así que no entra en la clasificación.';
    return null;
  }
  return prueba;
}
function aPortada() {
  cierraCarrera(); ocultaPista(); altavozCalla();
  estado = 'portada'; c = null;
  $('hud').hidden = true;
  if (Club && Club.inmersivo) Club.inmersivo(false);
  escenaPortada();
  pintaPortada(); muestraCapa('capaPortada');
  pideFantasma(modoSel);                                        // en un modo fantasma, quién es el n.º 1 (puede haber cambiado)
}
/** El escenario de la portada: la primera estación del mundo del modo
    elegido, con los trenes de una pista cualquiera a la vista, y su música. */
function escenaPortada() {
  const e = estacionVisual(M.estacionDe(0, modoSel));
  mundo.reinicia(); mundo.lore(modoSel.mundo === 'metro'); mundo.activa(e, 0);
  mundo.monedasPeligro(!!modoSel.monedasMatan);
  pantalla.dataset.estilo = e.estilo;
  const vitrina = M.crearGenerador(2026, { modo: modoSel.id });  // en la portada se ve la vía con los primeros trenes de una pista cualquiera
  for (const o of vitrina.generarHasta(200, { V: 13 })) if (o.tipo !== 'moneda' && o.d0 > 30) mundo.nuevo(o);
  sonido.tocaTema(e.musica || 'metrorush-barrio');
}
/* ---- el modo de juego (M.MODOS) ----
   Se elige en la portada con una fila de tarjetas; cada una dice su regla
   en una línea. Lo elegido se guarda en las opciones de este aparato, la
   clasificación del costado pasa a la tabla de ese modo y, si el modo es de
   otro mundo (City), el escenario de la portada cambia. */
function eligeModo(id) {
  const m = M.modoDe(id);
  if (!m || estado !== 'portada') return;
  const otroMundo = m.mundo !== modoSel.mundo;
  modoSel = m; opciones.modo = m.id; guardaOpciones();
  esperandoFantasma = false;                                    // otro modo: ya no se espera al fantasma del anterior
  if (Club) Club.category(m.categoria);
  if (otroMundo) { escenaPortada(); vistePuesto(); } else mundo.monedasPeligro(!!m.monedasMatan);   // CITY: al cambiar de mundo, su ropa de ese mundo
  sonido.carril();
  pideFantasma(m);                                              // en un modo fantasma, se busca al n.º 1 de su tabla
  pintaPortada();
}
/** La fila de modos de la portada y la línea que explica el elegido. */
function pintaModos() {
  $('modosLista').innerHTML = M.ORDEN_MODOS.map(k => {
    const m = M.MODOS[k], sel = m === modoSel;
    return `<button type="button" class="p-modo${sel ? ' sel' : ''}" role="radio" aria-checked="${sel}" data-modo="${k}" title="${m.desc}"><i>${ICONOS[ICONO_MODO[k]]}</i><span>${m.corto}</span></button>`;
  }).join('');
  $('modoDesc').textContent = modoSel.desc;
  $('capaPortada').dataset.modo = modoSel.id;
  pintaFantasmaPortada();                                       // contra quién se corre (modos «Fantasma»)
}
/** La insignia del modo en el marcador de la carrera, y lo que ese modo no tiene. */
function pintaModoHud() {
  const el = $('hudModo');
  el.innerHTML = `${ICONOS[ICONO_MODO[c.modo.id]]}<span>${c.modo.corto}</span>`;
  el.dataset.modo = c.modo.id;
  document.querySelector('.hud .patinetas').hidden = !c.modo.patineta || !!c.ciudad;   // sin patineta (o en City, donde solo está la tabla de energía) no hay contador de patinetas
  $('hudFan').hidden = !c.fan;                                   // contra el fantasma: la ventaja (modos «Fantasma» con fantasma)
}
function otraCarrera() { cierraCarrera(); empezar(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (estado === 'jugando') pausar(); if (estado === 'fin') cierraCarrera(); }
});
window.addEventListener('pagehide', () => { if (estado === 'pausa' || estado === 'salvar') cierraCarrera(); });

/* ===================================================================
   5. EL BUCLE DE CADA CUADRO
   =================================================================== */
let prevT = performance.now(), midiendo = null, tiempoTotal = 0;
let dtRealUltimo = 0;                                           // el tiempo real del último cuadro (la caída tras un choque se mide en tiempo real)
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dtReal = Math.min(0.25, (ahora - prevT) / 1000); prevT = ahora;
  dtRealUltimo = dtReal;
  const dt = Math.min(0.05, dtReal);                            // nunca un salto mayor a 50 ms (si el aparato se traba, el juego va más lento, no atraviesa trenes)
  tiempoTotal += dt;
  if (!mundo) return;
  if (estado === 'jugando' || estado === 'muerte') actualiza(dt);
  else if (estado === 'salvar') pasoSalvar(dtReal);
  if (c) persecucion(estado === 'pausa' ? 0 : dt);               // ladridos, la atrapada y el borde rojo (en pausa, quieto)
  else pintaPeligro(false);
  // lo que el mundo necesita para dibujar este cuadro
  const r = c ? c.r : null;
  // en la portada y en la tienda la cámara se pone delante del corredor, que mira y saluda
  const menu = panel === 'capaTienda' ? 'tienda' : estado === 'portada' ? 'portada' : null;
  // en la patineta, rodar es agacharse: de 0 a 1 en una décima, se queda, y vuelve en las últimas 0,12 s (suave, sin saltos)
  const agacha0 = r && r.rodar > 0 ? Math.max(0, Math.min(1, (F.tiempoRodar - r.rodar) / 0.1, r.rodar / 0.12)) : 0;
  const agacha = agacha0 * agacha0 * (3 - 2 * agacha0);
  const pose = menu ? { modo: 'menu', t: tiempoTotal }
    : !c ? { modo: 'quieto', fase: tiempoTotal * 3 }
    : c.muerte && c.muerte.motivo === 'abandono' ? { modo: 'quieto', fase: tiempoTotal * 3 }      // «Terminar la carrera»: se queda de pie
    : estado === 'muerte' || estado === 'salvar' || (estado === 'fin' && c.muerte) ? { modo: 'caer', t: c.muerte ? c.muerte.t : 1 }
      : r.tropezarT >= 0 ? { modo: 'tropezar', t: r.tropezarT, fase: r.fase, ladeo: r.ladeo }
        : c.poderes.mochila > 0 ? { modo: 'volar', fase: r.fase }
          : c.pogo ? { modo: 'pogo', vy: r.vy, ladeo: r.ladeo, t: c.pogoT || 0 }   // de pie en el pogo, agarrado al manubrio (t: desde que se lanzó)
          : c.poderes.patineta > 0 ? { modo: 'patinar', fase: r.fase, ladeo: r.ladeo, vy: r.vy, aire: r.enAire, t: tiempoTotal, agacha }   // de lado sobre la tabla (rodar = agacharse, saltar = un ollie)
          : r.rodar > 0 ? { modo: 'rodar', t: F.tiempoRodar - r.rodar }
            : r.enAire ? { modo: 'saltar', vy: r.vy, ladeo: r.ladeo }
              : { modo: 'correr', fase: r.fase, ladeo: r.ladeo };
  mundo.paso({
    D: c ? c.D : 0, x: r ? r.x : 0, y: r ? r.y : 0, suelo: r ? r.suelo : 0, v: c ? c.V : 0, dt, t: tiempoTotal, pose,
    poderes: c ? { iman: c.poderes.iman > 0, mochila: c.poderes.mochila > 0, zapatillas: c.poderes.zapatillas > 0, patineta: c.poderes.patineta > 0, pogo: !!c.pogo } : {},
    perseguidor: c && !menu ? c.perseguidor : 0, menu,
    persecucion: c && !menu ? datosPersecucion() : null,         // el grito, el ladrido y la atrapada (ver «La persecución»)
    fantasma: menu ? null : dibujoFantasma()                     // el corredor fantasma (null: no hay)
  });
  mundo.dibuja();
  sonido.tick(c && estado === 'jugando' ? c.V : (c ? c.curva.VELOCIDAD : M.VELOCIDAD).V0);   // CITY: el reposo es el V0 de la curva de la carrera
  if (c && (estado === 'jugando' || estado === 'muerte')) pintaHud(dt);
  autoCalidad(dtReal);
}
/** Si el aparato no da abasto, baja la calidad una vez (solo en "auto"). */
function autoCalidad(dtReal) {
  if (!midiendo || opciones.calidad !== 'auto' || estado !== 'jugando') return;
  midiendo.t += dtReal; midiendo.n++; midiendo.suma += dtReal;
  if (midiendo.t < 4) return;
  const prom = midiendo.suma / midiendo.n;                       // segundos por cuadro, en promedio
  midiendo = { t: 0, n: 0, suma: 0 };
  const nivel = mundo.nivelCalidad;
  if (prom > 0.028 && nivel !== 'baja') { mundo.calidad(nivel === 'alta' ? 'media' : 'baja'); aviso('Bajé la calidad gráfica para que corra más fluido'); }
}

/* ===================================================================
   6. EL MARCADOR Y LOS AVISOS
   =================================================================== */
const hudCache = {};
const ponTexto = (id, txt) => { if (hudCache[id] !== txt) { hudCache[id] = txt; $(id).textContent = txt; } };
/* La fuente pixel (Press Start 2P) dibuja cada mayúscula con tilde con la
   misma figura que su minúscula: en una celda de 8×8 la tilde no le cabe
   encima a una mayúscula, así que «Óxido» se leía «óxido». Los nombres que
   van en esa fuente (la estación del marcador y el letrero grande) se
   escriben con `ponConTildes`: cada mayúscula con tilde va en un
   <span class="mr-tilde" data-l="Ó" data-b="O">. En los estilos juguete y
   neón la hoja muestra la letra tal cual (data-l); en el pixel muestra la
   letra sin tilde (data-b) y le dibuja encima la tilde de dos píxeles
   (estilo.css, .mr-tilde). El texto de verdad sigue entero en
   aria-label, para quien lee con un lector de pantalla. */
const SIN_TILDE = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U' };
function ponConTildes(el, txt) {
  txt = String(txt || '');
  if (!/[ÁÉÍÓÚ]/.test(txt)) { el.textContent = txt; el.removeAttribute('aria-label'); return; }   // lo normal: texto sin más
  el.textContent = '';
  for (const parte of txt.split(/([ÁÉÍÓÚ])/)) {
    if (!parte) continue;
    if (SIN_TILDE[parte]) {                                    // una mayúscula con tilde: su caja propia
      const s = document.createElement('span');
      s.className = 'mr-tilde'; s.dataset.l = parte; s.dataset.b = SIN_TILDE[parte];
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    } else el.appendChild(document.createTextNode(parte));      // el resto, tal cual
  }
  el.setAttribute('aria-label', txt);                          // el nombre entero, para el lector de pantalla
}
/** Como ponTexto (solo escribe si cambió), pero con las tildes de la fuente pixel. */
const ponTextoTildes = (id, txt) => { if (hudCache[id] !== txt) { hudCache[id] = txt; ponConTildes($(id), txt); } };
/* Un saltito (crece y vuelve) cuando cambia un número del marcador: el
   multiplicador al tomar una estrella, la moneda con cada moneda. Va con
   la propiedad `scale` (no `transform`), para no pisar la inclinación que
   la estética juguete le da a la placa del multiplicador. */
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
/** Le dice al mundo qué movimientos de cámara se permiten (ver «la sensación
    de velocidad» en mundo.js): la opción «Sacudir la pantalla» (sin ella no
    hay temblor, balanceo ni ladeo) y el ajuste del sistema «reducir
    movimiento» (además, sin líneas de viento). */
function aplicaMovimiento() { if (mundo) mundo.movimiento({ sacudir: !!opciones.sacudida, quieto: quieto.matches }); }
if (quieto.addEventListener) quieto.addEventListener('change', aplicaMovimiento);
let ultSaltoMoneda = 0;
function salta(el, k, ms) { if (el && el.animate && !quieto.matches) el.animate([{ scale: 1 }, { scale: k }, { scale: 1 }], { duration: ms, easing: 'ease-out' }); }
function pintaHud(dt) {
  ponTexto('hudPuntos', fmt(c.puntos));
  const mult = '×' + multiplicador(), mon = fmt(c.monedas);
  if (hudCache.hudMult && hudCache.hudMult !== mult) salta($('hudMult'), 1.45, 380);
  if (hudCache.hudMonedas && hudCache.hudMonedas !== mon && performance.now() - ultSaltoMoneda > 90) { ultSaltoMoneda = performance.now(); salta(document.querySelector('.hud .moneda'), 1.28, 200); }
  ponTexto('hudMult', mult);
  ponTexto('hudMetros', fmt(c.D) + ' m');
  ponTexto('hudMonedas', mon);
  ponTexto('hudPatinetas', String(progreso.patinetas));
  pintaHudCity();                                                // CITY: la energía de la tabla y las monedas ×2
  if (c.fan) pintaFantasmaHud();                                 // la ventaja contra el fantasma
  // la barra hacia la próxima estación
  const e = c.estacion, sig = M.siguienteUmbral(c.D, c.modo), desde = e.desde || 0;   // en metros, como las estaciones
  const cada = c.mundoJ.vuelta ? c.mundoJ.vuelta.cada : 0;       // lo que dura una vuelta en este mundo
  const k = Math.max(0, Math.min(1, (c.D - (e.vuelta > 1 ? sig - cada : desde)) / Math.max(1, sig - (e.vuelta > 1 ? sig - cada : desde))));
  ponTextoTildes('hudEstacion', e.nombre);                     // con la tilde de «Óxido» bien puesta en la fuente pixel
  $('hudEstBarra').hidden = !Number.isFinite(sig);               // un mundo sin más estaciones no tiene barra hacia la siguiente
  $('hudEstBarra').style.setProperty('--k', k.toFixed(3));
  // los poderes activos, con su barra de tiempo
  const lista = [];
  for (const [kk, v] of Object.entries(c.poderes)) if (v > 0) {
    const total = kk === 'patineta' ? (c.patTotal || M.DURACION_PATINETA) : M.duracionPoder(kk, progreso.mejoras[kk]);
    lista.push(`<li class="p-${kk}"><b>${ICONOS[kk === 'patineta' ? 'patineta' : ICONO_PODER[kk]]}</b><span><i style="--k:${Math.min(1, v / total).toFixed(3)}"></i></span></li>`);
  }
  const html = lista.join('');
  if (hudCache.poderes !== html.replace(/--k:[\d.]+/g, '')) { hudCache.poderes = html.replace(/--k:[\d.]+/g, ''); $('hudPoderes').innerHTML = html; }
  else { let i = 0; for (const [kk, v] of Object.entries(c.poderes)) if (v > 0) { const el = $('hudPoderes').children[i++]; if (el) { const total = kk === 'patineta' ? (c.patTotal || M.DURACION_PATINETA) : M.duracionPoder(kk, progreso.mejoras[kk]); el.querySelector('i').style.setProperty('--k', Math.min(1, v / total).toFixed(3)); } } }
  // el letrero grande se apaga solo
  if (c.banner > 0) { c.banner -= dt; if (c.banner <= 0) $('banner').classList.remove('ver'); }
}
let avisoTimer = null;
/** Un aviso corto abajo de la pantalla. */
function aviso(txt) {
  const el = $('aviso');
  el.textContent = txt; el.classList.add('ver');
  clearTimeout(avisoTimer); avisoTimer = setTimeout(() => el.classList.remove('ver'), 2200);
}
/** El letrero grande del centro (estación nueva, récord, boleto). */
function banner(titulo, sub) {
  ponConTildes($('bannerTitulo'), titulo); ponConTildes($('bannerSub'), sub || '');   // «Óxido» con su mayúscula también en la fuente pixel
  const b = $('banner'); b.classList.remove('ver'); void b.offsetWidth; b.classList.add('ver');
  if (c) c.banner = 3;
}

/* ===================================================================
   7. LOS MENÚS (portada, tienda, retos, libreta, opciones, ayuda)
   =================================================================== */
/* Los íconos del menú y la tienda, dibujados en SVG con el mismo trazo azul
   marino grueso de todo el menú. No son emojis a propósito: cada sistema
   dibuja 🧲 o 🛹 a su manera (y de distinto tamaño), y en un menú de juego eso
   se ve barato. Los elementos con data-icono="x" se rellenan solos al
   arrancar (ponIconos); la tienda los usa directo desde ICONOS. */
const T = 'stroke="#142357" stroke-width="2.4" stroke-linejoin="round"';      // el trazo de siempre
const svg = cuerpo => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
const ICONOS = {
  moneda: svg(`<circle cx="16" cy="16" r="13" fill="#ffc81e" stroke="#8a5a00" stroke-width="2.5"/><circle cx="16" cy="16" r="8.6" fill="none" stroke="#fff3a6" stroke-width="2"/><path d="M13 10.5h6M16 10.5v11M13 21.5h6" stroke="#b37a00" stroke-width="2.6" stroke-linecap="round"/>`),
  trofeo: svg(`<path d="M9 7H5v2a5 5 0 0 0 5 5M23 7h4v2a5 5 0 0 1-5 5" fill="none" ${T}/><path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#ffd23f" ${T}/><path d="M14 18h4v5h-4z" fill="#ffd23f" ${T}/><path d="M9.5 27.5h13v-4.5h-13z" fill="#ff8a1f" ${T}/>`),
  estrella: svg(`<path d="M16 3.5l3.8 7.9 8.6 1.2-6.2 6 1.5 8.6L16 23.1l-7.7 4.1 1.5-8.6-6.2-6 8.6-1.2z" fill="#ffd23f" ${T}/>`),
  engranaje: svg(`<path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" stroke="#142357" stroke-width="5.2" stroke-linecap="round"/><circle cx="16" cy="16" r="9" fill="#eaf1fb" stroke="#142357" stroke-width="2.6"/><circle cx="16" cy="16" r="3.5" fill="#142357"/>`),
  ayuda: svg(`<path d="M11 12a5 5 0 1 1 7.5 4.3c-1.6.9-2.5 2-2.5 3.7v1" fill="none" stroke="#142357" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="26.2" r="2.5" fill="#142357"/>`),
  retos: svg(`<rect x="6" y="5" width="20" height="24" rx="3" fill="#fff" ${T}/><rect x="11" y="2.5" width="10" height="5.5" rx="2" fill="#ffd23f" ${T}/><path d="M10.5 16.5l3.5 3.5 7.5-8" fill="none" stroke="#2fb52f" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 25h11" stroke="#9fb3d9" stroke-width="2.4" stroke-linecap="round"/>`),
  personaje: svg(`<path d="M11 4.5c1 2.5 3 3.6 5 3.6s4-1.1 5-3.6l6 3 2.5 7.2-4 1.4V28H6.5V16.1l-4-1.4L5 7.5z" fill="#ff6a3d" ${T}/><path d="M12 16.5h8v5h-8z" fill="#e0502a" stroke="#142357" stroke-width="2"/>`),
  tienda: svg(`<path d="M6 11h20l-1.5 17h-17z" fill="#ffd23f" ${T}/><path d="M11.5 14V9a4.5 4.5 0 0 1 9 0v5" fill="none" stroke="#142357" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="20.5" r="3.2" fill="#ff8a1f" stroke="#142357" stroke-width="2"/>`),
  boleto: svg(`<path d="M3.5 9.5h25v4.5a2.5 2.5 0 0 0 0 5v4.5h-25V19a2.5 2.5 0 0 0 0-5z" fill="#ffd23f" ${T}/><path d="M20.5 10.5v12" stroke="#142357" stroke-width="2" stroke-dasharray="2 2"/><path d="M8 14.5h8M8 18.5h5.5" stroke="#b37a00" stroke-width="2.3" stroke-linecap="round"/>`),
  atras: svg(`<path d="M19.5 6.5 10 16l9.5 9.5" fill="none" stroke="#142357" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  rayo: svg(`<path d="M18.5 3 7 18h7.5l-2 11L24 14h-7.5z" fill="#ffd23f" ${T}/>`),
  iman: svg(`<path d="M5.5 5h7.5v11a3 3 0 0 0 6 0V5h7.5v11a10.5 10.5 0 0 1-21 0z" fill="#ff3d4f" ${T}/><path d="M5.5 5H13v5.5H5.5zM19 5h7.5v5.5H19z" fill="#e6eef8" ${T}/>`),
  mochila: svg(`<path d="M9.5 24.5l2 5.5 2-5.5M18.5 24.5l2 5.5 2-5.5" fill="#ff8a1f" stroke="#ff8a1f" stroke-width="1.6" stroke-linejoin="round"/><rect x="6" y="5" width="9.5" height="20" rx="4.7" fill="#d5dfee" ${T}/><rect x="16.5" y="5" width="9.5" height="20" rx="4.7" fill="#d5dfee" ${T}/><path d="M6.5 12.5h8.5M17 12.5h8.5" stroke="#ff3d4f" stroke-width="2.8"/>`),
  zapatilla: svg(`<path d="M3 24.5v-10l6.5-3.5 3 4 6 1.5 6.5 2.3c2.6.9 4 2.6 4 5.2v.5z" fill="#4fd36b" ${T}/><path d="M3.5 22h25.5" stroke="#fff" stroke-width="2.6"/><path d="M12.5 15.8l-1.2 3M16.2 16.7l-1.2 3" stroke="#142357" stroke-width="1.8" stroke-linecap="round"/>`),
  doble: svg(`<rect x="2.5" y="6" width="27" height="20" rx="6" fill="#8b5cf6" ${T}/><path d="M8 12l6 8M14 12l-6 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M17 13.6c.6-1.6 2-2.3 3.6-2.3 2 0 3.4 1.2 3.4 3 0 2.4-3 3.6-6.8 5.9h7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  patineta: svg(`<path d="M3 13.5c0-2 1.5-3 3.5-3h19c2 0 3.5 1 3.5 3s-1.5 3-3.5 3h-19c-2 0-3.5-1-3.5-3z" fill="#7b2ff7" ${T}/><path d="M6.5 13.5h19" stroke="#00f5d4" stroke-width="2"/><circle cx="9" cy="22" r="3.2" fill="#ffd23f" ${T}/><circle cx="23" cy="22" r="3.2" fill="#ffd23f" ${T}/>`),
  candado: svg(`<path d="M10 14v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#142357" stroke-width="3"/><rect x="7" y="14" width="18" height="14" rx="3" fill="#ffd23f" ${T}/><circle cx="16" cy="21" r="2.2" fill="#142357"/>`),
  check: svg(`<path d="M7 16.5l6 6 12-13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  play: svg(`<path d="M10 6.5v19l15-9.5z" fill="#fff" stroke="#0e5a10" stroke-width="2.4" stroke-linejoin="round"/>`),
  cohete: svg(`<path d="M16 2.5c5 3.5 7 9 6.5 15.5H9.5C9 11.5 11 6 16 2.5z" fill="#eaf1fb" ${T}/><circle cx="16" cy="11.5" r="2.8" fill="#5cc0ff" stroke="#142357" stroke-width="2"/><path d="M9.5 15l-4 5 4 1M22.5 15l4 5-4 1" fill="#ff3d4f" ${T}/><path d="M12.5 21.5c.5 3 2 5.5 3.5 8 1.5-2.5 3-5 3.5-8z" fill="#ff8a1f" stroke="#c4500a" stroke-width="1.6" stroke-linejoin="round"/>`),
  mas5: svg(`<rect x="2.5" y="6" width="27" height="20" rx="6" fill="#ffd23f" ${T}/><path d="M7 16h7M10.5 12.5v7" stroke="#142357" stroke-width="3" stroke-linecap="round"/><path d="M24 11.3h-5.2l-.6 4.3c.7-.5 1.5-.7 2.4-.7 2 0 3.4 1.3 3.4 3.1s-1.5 3.2-3.6 3.2c-1.4 0-2.6-.6-3.1-1.6" fill="none" stroke="#142357" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  flecha: svg(`<path d="M4 16h20M17 8l8 8-8 8" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  tren: svg(`<rect x="6" y="3.5" width="20" height="23" rx="6" fill="#ffb21f" ${T}/><rect x="9" y="7.5" width="14" height="8" rx="2" fill="#5cc0ff" stroke="#142357" stroke-width="2"/><circle cx="11" cy="21" r="2" fill="#fff6c9" stroke="#142357" stroke-width="1.6"/><circle cx="21" cy="21" r="2" fill="#fff6c9" stroke="#142357" stroke-width="1.6"/><path d="M9 26.5l-2.5 3M23 26.5l2.5 3" stroke="#142357" stroke-width="2.4" stroke-linecap="round"/>`),
  salto: svg(`<path d="M16 26V8M8.5 14.5 16 7l7.5 7.5" fill="none" stroke="#2fb52f" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 28.5h20" stroke="#142357" stroke-width="2.6" stroke-linecap="round"/>`),
  lados: svg(`<path d="M5 16h22M11 9.5 4.5 16l6.5 6.5M21 9.5l6.5 6.5-6.5 6.5" fill="none" stroke="#ff8a1f" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  rueda: svg(`<path d="M16 5v18M8.5 16.5 16 24l7.5-7.5" fill="none" stroke="#1f7ae0" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 3.5h20" stroke="#142357" stroke-width="2.6" stroke-linecap="round"/>`),
  supercaja: svg(`<path d="M4 12h24v16H4z" fill="#8b5cf6" ${T}/><path d="M2.5 7.5h27v5h-27z" fill="#b28cff" ${T}/><path d="M14 7.5h4V28h-4z" fill="#ffd23f" stroke="#142357" stroke-width="1.6"/><path d="M16 7c-3-5-8-4-6-1s6 1 6 1 4-.8 6-1 -3-4-6 1z" fill="#ffd23f" ${T}/><path d="M23 15.5l1 2 2 .5-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L20 18l2-.5z" fill="#fff"/>`),
  bandera: svg(`<path d="M8 29V4" stroke="#142357" stroke-width="2.8" stroke-linecap="round"/><path d="M8.5 5h17l-3.5 5 3.5 5h-17z" fill="#ff3d4f" ${T}/>`),
  // los modos: sin ayudas (el rayo de los poderes, tachado), sin monedas (una moneda roja con calavera), la ciudad y la ciudad tachada
  sinAyudas: svg(`<circle cx="16" cy="16" r="13" fill="#eaf1fb" ${T}/><path d="M18 6.5 10.5 17h5l-1.5 8.5 7.5-11h-5z" fill="#ffd23f" stroke="#142357" stroke-width="2" stroke-linejoin="round"/><path d="M7 25 25 7" stroke="#e8283c" stroke-width="3.6" stroke-linecap="round"/>`),
  peligro: svg(`<circle cx="16" cy="16" r="13" fill="#ff4a3d" stroke="#6e0a00" stroke-width="2.5"/><circle cx="16" cy="16" r="8.8" fill="none" stroke="#ffb3a8" stroke-width="1.8"/><path d="M11 14.5a5 5 0 0 1 10 0c0 1.8-.8 2.8-1.8 3.5v2.2h-6.4V18c-1-.7-1.8-1.7-1.8-3.5z" fill="#fff" stroke="#6e0a00" stroke-width="1.6" stroke-linejoin="round"/><circle cx="13.9" cy="14.6" r="1.3" fill="#6e0a00"/><circle cx="18.1" cy="14.6" r="1.3" fill="#6e0a00"/><path d="M14.4 22.6h3.2" stroke="#6e0a00" stroke-width="1.6" stroke-linecap="round"/>`),
  ciudad: svg(`<path d="M3 28V14h6V8h7v6h3V4h8v24z" fill="#5cc0ff" ${T}/><path d="M6 18h2M6 22h2M12 12h2M12 16h2M12 20h2M22 8h2M22 12h2M22 16h2M22 20h2" stroke="#fff6c9" stroke-width="2" stroke-linecap="round"/><path d="M1.5 28.5h29" stroke="#142357" stroke-width="2.6" stroke-linecap="round"/>`),
  // el fantasma: una sábana con ojos, y la ciudad con su fantasma
  fantasma: svg(`<path d="M6 28V14a10 10 0 0 1 20 0v14l-3.3-2.6-3.4 2.6-3.3-2.6-3.3 2.6-3.4-2.6z" fill="#eef3ff" ${T}/><ellipse cx="12.5" cy="14" rx="2" ry="2.8" fill="#142357"/><ellipse cx="19.5" cy="14" rx="2" ry="2.8" fill="#142357"/>`),
  ciudadFantasma: svg(`<path d="M3 28V14h6V8h7v6h3V4h8v24z" fill="#9fd9ff" ${T}/><path d="M1.5 28.5h29" stroke="#142357" stroke-width="2.6" stroke-linecap="round"/><path d="M12 29V21a6 6 0 0 1 12 0v8l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6z" fill="#eef3ff" stroke="#142357" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="21.5" r="1.2" fill="#142357"/><circle cx="20" cy="21.5" r="1.2" fill="#142357"/>`),
  ciudadPura: svg(`<path d="M3 28V14h6V8h7v6h3V4h8v24z" fill="#9fd9ff" ${T}/><path d="M6 18h2M12 12h2M12 16h2M22 8h2M22 12h2" stroke="#fff6c9" stroke-width="2" stroke-linecap="round"/><path d="M1.5 28.5h29" stroke="#142357" stroke-width="2.6" stroke-linecap="round"/><path d="M6 26 26 6" stroke="#e8283c" stroke-width="3.6" stroke-linecap="round"/>`),
  // pantalla completa: cuatro esquinas hacia afuera (entrar) o hacia adentro (salir)
  pantalla: svg(`<path d="M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  pantallaSale: svg(`<path d="M12 5v7H5M27 12h-7V5M20 27v-7h7M5 20h7v7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`)
};
/* El ícono de cada modo de juego (M.MODOS). */
const ICONO_MODO = { clasico: 'tren', puro: 'sinAyudas', sinmonedas: 'peligro', fantasma: 'fantasma', city: 'ciudad', citypuro: 'ciudadPura', cityfantasma: 'ciudadFantasma' };
/* El ícono de cada clase de misión. */
const ICONO_RETO = { monedas: 'moneda', monedasTotal: 'moneda', saltos: 'salto', rodadas: 'rueda', distancia: 'bandera', puntos: 'estrella',
  poderes: 'rayo', techos: 'tren', estrellas: 'estrella', esquivar: 'tren', patinetas: 'patineta', mochilas: 'mochila' };
const ICONO_PODER = { iman: 'iman', mochila: 'mochila', zapatillas: 'zapatilla', doble: 'doble' };
const TINTE_PODER = { iman: '#ffd5d9', mochila: '#d7e6ff', zapatillas: '#d3f6db', doble: '#e6dcff' };
function ponIconos(raiz = document) {
  for (const el of raiz.querySelectorAll('[data-icono]')) if (!el.firstElementChild) el.innerHTML = ICONOS[el.dataset.icono] || '';
}

function muestraCapa(id) {
  for (const el of document.querySelectorAll('.capa')) el.hidden = el.id !== id;
}
function abrePanel(id) { esperandoFantasma = false; if (panel === 'capaTienda' && id !== 'capaTienda') saleTienda(); panel = id; for (const el of document.querySelectorAll('.capa')) el.hidden = el.id !== id; }
function cierraPanel() {
  if (!panel) return;
  if (panel === 'capaTienda') saleTienda();
  panel = null;
  muestraCapa(estado === 'pausa' ? 'capaPausa' : estado === 'fin' ? 'capaFin' : estado === 'portada' ? 'capaPortada' : null);
}
function pintaPortada() {
  const recTxt = fmt(M.recordDe(progreso, modoSel)) + (modoSel.fantasma ? ' m' : '');   // el récord del modo elegido (en un fantasma, su distancia)
  ponTexto('portadaRecord', recTxt);
  pintaModos();
  // en un modo de multiplicador fijo (Sin ayudas) la placa dice ×10: es lo que vale la próxima carrera
  const fijo = modoSel.multFijo;
  ponTexto('portadaMult', '×' + (fijo || progreso.retos.nivel));
  $('portadaMult').closest('.p-mult').classList.toggle('fijo', !!fijo);
  ponTexto('portadaMonedas', fmt(progreso.monedas));
  // los globitos de la barra: cuántos retos van cumplidos y cuántos boletos tienes
  const lista = M.retosDeNivel(progreso.retos.nivel);
  const hechos = lista.filter((r, i) => progreso.retos.avance[i] >= r.meta).length;
  ponTexto('portadaRetosN', `${hechos}/${lista.length}`);
  $('portadaMisBarra').style.setProperty('--k', (hechos / lista.length).toFixed(3));
  // el globito «!» de Misiones: hay algo que hacer ahí (una misión se puede saltar con lo que tienes, o el set está a una misión)
  $('portadaRetosG').hidden = !(progreso.retos.nivel < M.MAX_BASE && (hechos === 2 || progreso.monedas >= M.costoSaltar(progreso.retos.nivel)));
  ponTexto('portadaBoletos', ciudad.cuentaPostales(modoSel, progreso) || `${boletosTenidos()}/${boletosLinea().length}`);   // CITY: las postales
  ponTexto('barRecord', recTxt);
  ponTexto('barMonedas', fmt(progreso.monedas));
  ponTexto('barMult', '×' + (fijo || progreso.retos.nivel));
}
/* Tocar cualquier parte vacía de la portada empieza a correr, como «toca
   para jugar»: solo los botones y los contadores no cuentan. */
$('capaPortada').addEventListener('click', e => {
  if (estado !== 'portada' || panel || e.target.closest('button, .contador, .p-record, .logo, .p-modos')) return;   // la fila de modos tampoco empieza
  empezar();
});
/** Las misiones de un set con su barra, en chico y sin «Saltar» (para el resumen). */
function filasRetos(el, nivel, avance) {
  el.innerHTML = M.retosDeNivel(nivel).map((r, i) => {
    const v = Math.min(r.meta, avance[i] || 0), ok = v >= r.meta;
    return `<li class="m-fila${ok ? ' ok' : ''}"><span class="m-ico">${ICONOS[ICONO_RETO[r.tipo]] || ICONOS.estrella}</span>
      <div class="m-txt"><b>${r.texto}</b><span class="m-barra"><i style="--k:${(v / r.meta).toFixed(3)}"></i></span><small translate="no">${fmt(v)} / ${fmt(r.meta)}</small></div>${ok ? `<em class="m-ok">${ICONOS.check}</em>` : ''}</li>`;
  }).join('');
}
function abreRetos() { pintaMisiones(); abrePanel('capaRetos'); }
/** El panel de misiones: el multiplicador de ahora y el que viene, el premio
    del set y las tres misiones con su barra y el botón «Saltar». Durante una
    carrera (en pausa) no se puede saltar: la carrera en curso se aplicaría a
    las misiones del set siguiente. */
function pintaMisiones() {
  const n = progreso.retos.nivel, max = n >= M.MAX_BASE;
  $('retosSet').textContent = `Set ${n}`;
  $('retosDe').textContent = '×' + n;
  $('retosA').textContent = max ? 'MÁX' : '×' + (n + 1);
  $('retosPremio').innerHTML = max ? 'Llegaste al multiplicador máximo. Las misiones siguen dando premio.'
    : `Completa las tres para subir a <b translate="no">×${n + 1}</b> y ganar ${ICONOS.moneda}<b translate="no">${fmt(M.premioSet(n))}</b>`;
  const lista = M.retosDeNivel(n), vivo = progreso.retos.avance, costo = M.costoSaltar(n), enCarrera = estado === 'pausa';
  $('listaRetos').innerHTML = lista.map((r, i) => {
    const v = Math.min(r.meta, vivo[i] || 0), ok = v >= r.meta;
    const fin = ok ? `<em class="m-ok">${ICONOS.check}</em>`
      : `<button type="button" class="m-saltar" data-saltar="${i}" ${enCarrera || progreso.monedas < costo ? 'disabled' : ''} title="${enCarrera ? 'Termina la carrera para saltar misiones' : 'Saltar esta misión'}">Saltar<span>${ICONOS.moneda}<b translate="no">${fmt(costo)}</b></span></button>`;
    return `<li class="m-fila${ok ? ' ok' : ''}"><span class="m-ico">${ICONOS[ICONO_RETO[r.tipo]] || ICONOS.estrella}</span>
      <div class="m-txt"><b>${r.texto}</b><span class="m-barra"><i style="--k:${(v / r.meta).toFixed(3)}"></i></span><small translate="no">${fmt(v)} / ${fmt(r.meta)}</small></div>${fin}</li>`;
  }).join('');
}
/** Salta una misión pagando; si era la que faltaba, el set se completa ahí mismo. */
function saltarMision(i) {
  const n = progreso.retos.nivel, costo = M.costoSaltar(n);
  if (estado === 'pausa' || progreso.monedas < costo) return;
  progreso.monedas -= costo;
  const r = M.saltaReto(progreso.retos, i);
  progreso.retos = r.retos;
  if (r.subio) { const premio = M.premioSet(n); progreso.monedas += premio; sonido.multiplicador(); aviso(`¡Set completo! Multiplicador ×${progreso.retos.nivel} y +${fmt(premio)} monedas`); }
  else sonido.reto();
  guardar(); pintaMisiones(); pintaPortada();
}
/* La tienda. Dos pestañas: «mejoras» (los poderes y la patineta) y
   «personajes» (los aspectos). En personajes el corredor se prueba la ropa
   que tocas aunque no sea tuya; al salir de la tienda vuelve a lo puesto. */
let tiendaPestana = 'mejoras';                                 // la pestaña abierta
/* --- La muestra de las corredoras (ronda 2) ---
   Los aspectos de siempre se muestran con una cabecita de CSS (gorra, cara,
   sudadera). Las corredoras no llevan gorra: lo que las distingue es el
   peinado, así que su muestra es un SVG chico que dibuja la cara con su
   pelo (coleta, trenzas, melena, moños o afro), su tono de piel, su tocado (cintillo o boina), y
   los lentes o aros si los tiene, con los mismos colores que el modelo 3D
   (`a.rasgos` en motor.js). Todo con colores del aspecto: nada que el
   jugador escriba, nada que escapar. */
function muestraRasgos(a) {
  const R = a.rasgos, hex = n => '#' + n.toString(16).padStart(6, '0');
  const piel = hex(R.piel ?? 0xf1c19c), pelo = hex(R.pelo), toc = hex(a.gorra), ropa = hex(a.sudadera), tinta = '#0d2a63';   // los colores (tinta: el borde de la tienda)
  const detras = R.peinado === 'larga' ? `<path d="M27 44 Q26 82 34 86 L66 86 Q74 82 73 44 Z" fill="${pelo}"/>`   // la melena, detrás de la cara
    : R.peinado === 'coleta' ? `<path d="M64 28 Q88 26 84 58 Q80 48 70 40 Z" fill="${pelo}"/><circle cx="66" cy="30" r="4" fill="${toc}"/>`   // la cola, hacia un lado
      : R.peinado === 'trenzas' ? [-1, 1].map(s => `<g fill="${pelo}">${[0, 1, 2].map(i => `<circle cx="${50 + s * 22}" cy="${54 + i * 9}" r="5.5"/>`).join('')}<circle cx="${50 + s * 22}" cy="${80}" r="3" fill="${toc}"/></g>`).join('')
        : R.peinado === 'monos' ? `<circle cx="32" cy="27" r="9" fill="${pelo}"/><circle cx="68" cy="27" r="9" fill="${pelo}"/>`
          : R.peinado === 'afro' ? `<circle cx="50" cy="40" r="29" fill="${pelo}"/>` : '';   // la nube del afro, detrás de la cara
  const tocado = R.tocado === 'cintillo' ? `<path d="M30 42 Q50 16 70 42" fill="none" stroke="${toc}" stroke-width="4" stroke-linecap="round"/>`
    : R.tocado === 'boina' ? `<ellipse cx="53" cy="27" rx="23" ry="8" fill="${toc}" transform="rotate(-10 53 27)"/><circle cx="54" cy="18" r="2.5" fill="${toc}"/>`
      : R.tocado === 'gorra' ? `<path d="M30 42 Q30 24 50 24 Q70 24 70 42 Z" fill="${toc}"/><path d="M30 41 L16 44 Q22 38 32 37 Z" fill="${toc}"/>` : '';   // la gorra de City, con la visera hacia un lado
  const lentes = R.lentes ? `<g fill="none" stroke="#2b2d42" stroke-width="1.8"><circle cx="43" cy="47" r="5.5"/><circle cx="57" cy="47" r="5.5"/><path d="M48.5 47 L51.5 47"/></g>` : '';
  const aros = R.aros ? `<g fill="none" stroke="#ffc63a" stroke-width="1.8"><circle cx="30" cy="55" r="3.2"/><circle cx="70" cy="55" r="3.2"/></g>` : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" fill="#cfe3ff"/>${detras}
    <ellipse cx="50" cy="100" rx="38" ry="24" fill="${ropa}"/><rect x="45" y="62" width="10" height="10" fill="${piel}"/>
    <circle cx="50" cy="48" r="19" fill="${piel}"/>
    <path d="M31 47 Q30 26 50 27 Q70 26 69 47 Q66 37 58 34 Q48 40 34 40 Z" fill="${pelo}"/>
    <circle cx="43.5" cy="48" r="2.2" fill="#1d1a2a"/><circle cx="56.5" cy="48" r="2.2" fill="#1d1a2a"/>
    ${R.chico ? '' : '<path d="M39 45.5 L41 44.5 M61 45.5 L59 44.5" stroke="#1d1a2a" stroke-width="1.2"/>'}
    <path d="M45 56 Q50 60 55 56" fill="none" stroke="#8a2a1e" stroke-width="1.6" stroke-linecap="round"/>
    ${tocado}${lentes}${aros}<rect x="70" y="80" width="13" height="13" rx="3" fill="${hex(a.mochila)}" stroke="${tinta}" stroke-width="1.5"/></svg>`;
}
/** Los personajes de City traen `piel`, `pelo` y `peinado` sueltos en su
    apariencia (y otros nombres de peinado): se traducen a `rasgos` para que
    `muestraRasgos` los dibuje con su cara de verdad. Ejemplo: Dante, de pelo
    corto, sale con su piel morena y su gorra celeste. */
function conRasgosCity(a) {
  const peinado = { melena: 'larga', coleta: 'coleta', trenzas: 'trenzas' }[a.peinado] || '';   // corto y rapado: solo el pelo de arriba
  return Object.assign({}, a, { rasgos: { pelo: a.pelo, piel: a.piel, peinado, tocado: peinado ? '' : 'gorra', chico: !peinado } });   // sin pelo largo, gorra (como en 3D) y sin pestañas
}
let tiendaVer = null;                                          // el aspecto que se está probando
let aspectoMostrado = null;                                    // el que lleva el corredor en pantalla
function abreTienda(pestana = 'mejoras') {
  tiendaPestana = pestana; tiendaVer = ciudad.puestoDe(progreso, modoSel);   // CITY: en City, su personaje de City
  if (estado === 'fin') despejaChoque();                       // desde el resumen: primero se saca la carrera perdida del escenario
  pintaTienda(); abrePanel('capaTienda');
}
/* La tienda abierta desde el resumen se veía sobre el lugar del choque:
   el corredor quedaba en su carril (y a veces en el aire, fuera de la
   cámara del probador), con el tren o la barrera del choque pegados a la
   espalda, las monedas flotando, el aro del imán todavía girando y el
   marcador de la carrera encima de la tienda. Desde la portada no pasa,
   porque ahí no hay carrera y la vía está vacía. La carrera ya está cerrada
   (el resumen la cerró), así que se saca del escenario igual que al ir a la
   portada, y el resumen sigue ahí al volver. */
function despejaChoque() {
  if (!c) return;                                              // ya se despejó (o no hubo carrera)
  cierraCarrera();                                             // ya estaba cerrada: cerrarla otra vez no suma nada
  c = null;                                                    // sin carrera, el corredor va al medio de la vía, en el suelo y sin poderes
  $('hud').hidden = true;                                      // el marcador de la carrera ya no tiene nada que contar
  mundo.reinicia();                                            // fuera trenes, barreras, monedas y poderes: la vía queda vacía, como en la portada
}
function saleTienda() {                                        // vuelve a la ropa que de verdad lleva puesta
  vistePuesto();                                                // CITY: la del modo elegido (en City, su personaje de City)
}
/** CITY: le pone al corredor lo que lleva puesto con el modo elegido (en
    City, su personaje de City si tiene uno puesto), si no lo lleva ya. */
function vistePuesto() {
  const k = ciudad.puestoDe(progreso, c ? c.modo : modoSel);
  if (mundo && k !== aspectoMostrado) { mundo.aspecto(ciudad.aspecto(k) || M.ASPECTOS.clasico); aspectoMostrado = k; }
}
let superTexto = '';           // lo que dio la última súper caja (se ve en su tarjeta)
/** Abre una súper caja: cobra, sortea el premio y lo entrega. */
function abreSuperCaja() {
  if (progreso.monedas < M.PRECIO_SUPERCAJA) return;
  progreso.monedas -= M.PRECIO_SUPERCAJA;
  const p = M.cajaSuper(Math.random);
  if (p.monedas) { progreso.monedas += p.monedas; superTexto = (p.gordo ? '¡PREMIO GORDO! ' : 'Te tocaron ') + fmt(p.monedas) + ' monedas'; }
  else if (p.patinetas) { progreso.patinetas += p.patinetas; superTexto = `Te tocaron ${p.patinetas} patinetas`; }
  else if (p.potenciador) { progreso.potenciadores[p.potenciador]++; superTexto = `Te tocó un ${M.POTENCIADORES[p.potenciador].nombre}`; }
  sonido.caja(); setTimeout(() => sonido.boleto(), 160);
}
function pintaTienda() {
  const cap = $('capaTienda');
  cap.dataset.pestana = tiendaPestana;
  for (const b of cap.querySelectorAll('[role="tab"]')) b.setAttribute('aria-selected', String(b.dataset.pestana === tiendaPestana));
  $('tiendaMonedas').textContent = fmt(progreso.monedas);
  // las mejoras: una tarjeta por poder, con sus cinco niveles y el precio del siguiente
  const tarjetas = Object.entries(M.PODERES).map(([k, p]) => {
    const n = progreso.mejoras[k], precio = M.precioMejora(n);
    const niveles = Array.from({ length: M.MAX_MEJORA }, (_, i) => `<i class="${i < n ? 'si' : ''}"></i>`).join('');
    const boton = precio == null ? '<span class="t-max">MÁX</span>'
      : `<button type="button" class="t-precio" data-comprar="${k}" ${progreso.monedas < precio ? 'disabled' : ''} aria-label="Mejorar ${p.nombre} por ${fmt(precio)} monedas">${ICONOS.moneda}<b translate="no">${fmt(precio)}</b></button>`;
    return `<li class="t-tarjeta" style="--tinte:${TINTE_PODER[k] || '#e3ecfb'}"><span class="t-ico">${ICONOS[ICONO_PODER[k]] || ''}</span>
      <div class="t-info"><strong>${p.nombre}</strong><small translate="no">${M.duracionPoder(k, n)} s${precio != null ? ` → ${M.duracionPoder(k, n + 1)} s` : ''}</small><span class="t-niveles" aria-label="Nivel ${n} de ${M.MAX_MEJORA}">${niveles}</span></div>${boton}</li>`;
  });
  tarjetas.push(`<li class="t-tarjeta" style="--tinte:#ecdfff"><span class="t-ico">${ICONOS.patineta}</span>
      <div class="t-info"><strong>Patineta</strong><small>Te salva de un choque (30 s)</small><span class="t-cuenta">Tienes <b translate="no">${progreso.patinetas}</b></span></div>
      <button type="button" class="t-precio" data-comprar="patineta" ${progreso.monedas < M.PRECIO_PATINETA ? 'disabled' : ''} aria-label="Comprar una patineta por ${M.PRECIO_PATINETA} monedas">${ICONOS.moneda}<b translate="no">${M.PRECIO_PATINETA}</b></button></li>`);
  // la súper caja misteriosa: se abre en el acto, y lo que dio queda escrito en su tarjeta
  tarjetas.push(`<li class="t-tarjeta" style="--tinte:#efe4ff"><span class="t-ico">${ICONOS.supercaja}</span>
      <div class="t-info"><strong>Súper caja misteriosa</strong><small>${superTexto || 'Siempre trae algo bueno: monedas, patinetas o potenciadores'}</small></div>
      <button type="button" class="t-precio" data-comprar="supercaja" ${progreso.monedas < M.PRECIO_SUPERCAJA ? 'disabled' : ''} aria-label="Abrir una súper caja por ${fmt(M.PRECIO_SUPERCAJA)} monedas">${ICONOS.moneda}<b translate="no">${fmt(M.PRECIO_SUPERCAJA)}</b></button></li>`);
  for (const [k, P] of Object.entries(M.POTENCIADORES)) tarjetas.push(`<li class="t-tarjeta" style="--tinte:${k === 'despegue' ? '#dff1ff' : '#fff1c4'}"><span class="t-ico">${ICONOS[k === 'despegue' ? 'cohete' : 'mas5']}</span>
      <div class="t-info"><strong>${P.nombre}</strong><small>${P.texto}</small><span class="t-cuenta">Tienes <b translate="no">${progreso.potenciadores[k]}</b></span></div>
      <button type="button" class="t-precio" data-comprar="pot:${k}" ${progreso.monedas < P.precio ? 'disabled' : ''} aria-label="Comprar ${P.nombre} por ${fmt(P.precio)} monedas">${ICONOS.moneda}<b translate="no">${fmt(P.precio)}</b></button></li>`);
  $('tiendaPoderes').innerHTML = tarjetas.join('');
  // los personajes: la ropa en fila, y la ficha del que se está probando
  // CITY: con un modo de City, primero sus personajes (con la insignia «City»); las claves y lo puesto los resuelve ciudad.js
  const puestoAhora = ciudad.puestoDe(progreso, modoSel);
  if (!ciudad.aspecto(tiendaVer) || !ciudad.idsTienda(modoSel).includes(tiendaVer)) tiendaVer = puestoAhora;
  $('tiendaAspectos').innerHTML = ciudad.idsTienda(modoSel).map(k => [k, ciudad.aspecto(k)]).map(([k, a]) => {
    const tiene = ciudad.tiene(progreso, k), puesto = puestoAhora === k, secreto = !tiene && a.precio == null;
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    const marca = puesto ? `<em class="ok">${ICONOS.check}</em>` : secreto ? `<em class="cerrado">${ICONOS.candado}</em>` : '';
    return `<li><button type="button" class="t-traje${k === tiendaVer ? ' sel' : ''}${secreto ? ' secreto' : ''}" data-ver="${k}" aria-pressed="${k === tiendaVer}">
      ${a.rasgos || a.city ? `<span class="t-muestra con-rasgos">${muestraRasgos(a.rasgos ? a : conRasgosCity(a))}</span>`   /* las corredoras y los de City: su cabecita con peinado y piel (ver «La muestra de las corredoras») */
        : `<span class="t-muestra" style="--a:${hex(a.sudadera)};--b:${hex(a.gorra)};--c:${hex(a.jeans)};--d:${hex(a.mochila)}"><i></i></span>`}<span class="t-n">${a.nombre}</span>${marca}${a.city ? '<em class="t-city">City</em>' : ''}</button></li>`;
  }).join('');
  const a = ciudad.aspecto(tiendaVer), tiene = ciudad.tiene(progreso, tiendaVer), puesto = puestoAhora === tiendaVer;
  $('tiendaNombre').textContent = a.nombre;
  $('tiendaEstado').textContent = (puesto ? 'Lo llevas puesto' : tiene ? 'Es tuyo' : a.precio != null ? 'En venta' : 'Secreto') + (a.city ? ` · Solo en City · ${a.texto}` : '');   // CITY: su ventaja
  $('tiendaAccion').innerHTML = puesto ? `<span class="t-puesto">${ICONOS.check}<span>Puesto</span></span>`
    : tiene ? `<button type="button" class="t-boton verde" data-poner="${tiendaVer}">Ponérmelo</button>`
      : a.precio != null ? `<button type="button" class="t-precio grande" data-aspecto="${tiendaVer}" ${progreso.monedas < a.precio ? 'disabled' : ''}>${ICONOS.moneda}<b translate="no">${fmt(a.precio)}</b></button>`
        : `<p class="t-secreto">${ICONOS.candado}<span>${a.secreto}</span></p>`;
  // el corredor se lo prueba (solo en la pestaña de personajes; en mejoras lleva lo suyo)
  const mostrar = tiendaPestana === 'personajes' ? tiendaVer : puestoAhora;
  if (mundo && mostrar !== aspectoMostrado) { mundo.aspecto(ciudad.aspecto(mostrar)); aspectoMostrado = mostrar; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  sonido.iniciar();
  if (b.dataset.comprar) {
    const k = b.dataset.comprar;
    if (k === 'supercaja') abreSuperCaja();
    else if (k === 'patineta') { if (progreso.monedas >= M.PRECIO_PATINETA) { progreso.monedas -= M.PRECIO_PATINETA; progreso.patinetas++; sonido.poder(); } }
    else if (k.startsWith('pot:')) { const id = k.slice(4), P = M.POTENCIADORES[id]; if (P && progreso.monedas >= P.precio) { progreso.monedas -= P.precio; progreso.potenciadores[id]++; sonido.poder(); } }
    else { const p = M.precioMejora(progreso.mejoras[k]); if (p != null && progreso.monedas >= p) { progreso.monedas -= p; progreso.mejoras[k]++; sonido.poder(); } }
    guardar(); pintaTienda(); pintaPortada(); return;
  }
  { const k = ciudad.clic(b, progreso, modoSel); if (k) { mundo.aspecto(ciudad.aspecto(k)); aspectoMostrado = k; guardar(); pintaTienda(); pintaPortada(); return; } }   // CITY: comprar o ponerse un personaje de City
  if (b.dataset.aspecto) { const a = M.ASPECTOS[b.dataset.aspecto]; if (a && a.precio != null && progreso.monedas >= a.precio) { progreso.monedas -= a.precio; progreso.aspectos.push(b.dataset.aspecto); progreso.aspecto = b.dataset.aspecto; mundo.aspecto(a); aspectoMostrado = b.dataset.aspecto; sonido.poder(); guardar(); pintaTienda(); pintaPortada(); } return; }
  if (b.dataset.poner) { progreso.aspecto = b.dataset.poner; mundo.aspecto(M.ASPECTOS[b.dataset.poner]); aspectoMostrado = b.dataset.poner; sonido.reto(); guardar(); pintaTienda(); return; }
  if (b.dataset.saltar != null) { saltarMision(Number(b.dataset.saltar)); return; }
  if (b.dataset.modo) { eligeModo(b.dataset.modo); return; }   // una tarjeta de modo, en la portada
  if (b.dataset.pot) { cuentaEntrada(e); usaPotenciador(b.dataset.pot); return; }
  if (b.dataset.pestana && b.getAttribute('role') === 'tab') { tiendaPestana = b.dataset.pestana; sonido.carril(); pintaTienda(); return; }
  if (b.dataset.ver) { tiendaVer = b.dataset.ver; sonido.carril(); pintaTienda(); return; }
  if (b.dataset.flecha) {                                       // las flechas pasan de un aspecto al siguiente
    const ids = ciudad.idsTienda(modoSel), i = ids.indexOf(tiendaVer);   // CITY: en City, también sus personajes
    tiendaVer = ids[(i + Number(b.dataset.flecha) + ids.length) % ids.length]; sonido.carril(); pintaTienda(); return;
  }
  const accion = b.dataset.accion;
  if (!accion) return;
  ({
    jugar: empezar, otra: otraCarrera, portada: aPortada, seguir: seguirJugando, seguirChoque: seguirTrasChoque,
    abandonar: () => { if (estado !== 'pausa') return; anota('m'); c.muerte = { t: 2, motivo: 'abandono' }; muestraFin(); },
    noSalvar: () => { if (estado === 'salvar') muestraFin(); },
    tienda: () => abreTienda('mejoras'), personajes: () => abreTienda('personajes'), retos: abreRetos, libreta: abreLibreta, opciones: abreOpciones, ayuda: () => abrePanel('capaAyuda'),
    volver: cierraPanel, relatoListo: () => { progreso.intro = true; guardar(); panel = null; empezar(); },
    pantallaCompleta: alternaPantallaCompleta
  })[accion]?.();
});
/* La Libreta y el relato cuentan la historia de la Línea 3 (el mundo
   «metro»). Un mundo con historia propia (City) la tiene en
   M.historiaDe(modo) → {intro, boletos, estaciones}: es el gancho para
   mostrarla cuando ese mundo tenga boletos (y su propio lugar en el
   progreso para guardarlos; los de `progreso.boletos` son de la Línea 3). */
function abreLibreta() {
  if (ciudad.libreta(modoSel, progreso, $, fmt)) { abrePanel('capaLibreta'); return; }   // CITY: las postales de City
  $('libretaIntro').textContent = M.INTRO;
  // en el orden de la vía, que es el de la historia: «Boleto 3 de 10 · Objetos perdidos»
  const lista = boletosLinea(), N = lista.length;
  $('listaBoletos').innerHTML = lista.map((e, i) => {
    const b = M.BOLETOS[e.boleto], tiene = progreso.boletos.includes(e.boleto);
    return tiene ? `<li><strong>Boleto ${i + 1} de ${N} · ${b.titulo}</strong><p>${b.texto}</p></li>`
      : `<li class="falta"><strong>Boleto ${i + 1} de ${N} · ${e.desde ? `desde los ${fmt(e.desde)} m` : 'Barrio Estación'}</strong><p>Todavía no lo encuentras. Está en la estación ${e.nombre}.</p></li>`;
  }).join('');
  $('libretaCuenta').textContent = `${boletosTenidos()} de ${N} boletos`;
  abrePanel('capaLibreta');
}
function abreRelato() {
  $('relatoTexto').textContent = ciudad.intro(modoSel) || M.INTRO;   // CITY: la intro de City, con un modo de City
  // y su título: en City la historia es otra (la ciudad que heredó los vagones), no la última noche de la Línea 3
  $('relatoTitulo').textContent = ciudad.intro(modoSel) ? 'La ciudad de los vagones' : 'La última noche de la Línea 3';
  abrePanel('capaRelato');
}
function abreOpciones() {
  $('optCalidad').value = opciones.calidad; $('optEstilo').value = opciones.estilo;
  $('optMusica').value = opciones.musica; $('optEfectos').value = opciones.efectos; $('optSacudida').checked = opciones.sacudida;
  abrePanel('capaOpciones');
}
for (const [id, k] of [['optCalidad', 'calidad'], ['optEstilo', 'estilo'], ['optMusica', 'musica'], ['optEfectos', 'efectos'], ['optSacudida', 'sacudida']]) {
  $(id).addEventListener('input', ev => {
    const el = ev.target;
    opciones[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    guardaOpciones();
    if (k === 'calidad') mundo.calidad(opciones.calidad === 'auto' ? calidadInicial() : opciones.calidad);
    if (k === 'musica' || k === 'efectos') sonido.volumenes(opciones.musica / 100, opciones.efectos / 100);
    if (k === 'sacudida') aplicaMovimiento();
    if (k === 'estilo' && (estado === 'portada')) aPortada();
  });
}
function alternaSonido() {
  opciones.mudo = !opciones.mudo; guardaOpciones();
  sonido.ponMudo(opciones.mudo);
  const b = $('sound-button'); b.setAttribute('aria-pressed', String(!opciones.mudo)); b.classList.toggle('apagado', opciones.mudo);
}
$('sound-button').addEventListener('click', () => { sonido.iniciar(); alternaSonido(); });
$('btnPausa').addEventListener('click', () => { if (estado === 'jugando') pausar(); else if (estado === 'pausa') seguirJugando(); });
$('hudPausa').addEventListener('click', () => pausar());
function desbloquea(aspecto, texto) {
  if (progreso.aspectos.includes(aspecto)) return;
  progreso.aspectos.push(aspecto); guardar(); sonido.boleto(); aviso(texto);
}

/* ---- pantalla completa (PC y teléfono) ----
   El botón ⛶ de la portada y de la pausa, o la tecla F, piden pantalla
   completa para TODA la página del juego (el iframe de Juegos ya trae
   allow="fullscreen"); el estilo (html.mr-pc) deja solo el marcador fino de
   arriba —con el sonido y el volumen, que tienen que verse siempre— y la
   pantalla del juego ocupando el resto. Safari viejo usa los nombres webkit.
   En el iPhone no hay pantalla completa de elementos: ahí el botón no se
   muestra y basta el modo inmersivo de conexion.js (Club.inmersivo), que se
   prende al correr. El ícono y el texto siguen al estado real
   (fullscreenchange), también si se sale con Escape. */
const enPantallaCompleta = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const hayPantallaCompleta = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function alternaPantallaCompleta() {
  if (!hayPantallaCompleta) return;
  try {
    if (enPantallaCompleta()) { const f = document.exitFullscreen || document.webkitExitFullscreen; const r = f && f.call(document); if (r && r.catch) r.catch(() => {}); }
    else { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; const r = f && f.call(el); if (r && r.catch) r.catch(() => {}); }
  } catch (e) { /* el navegador no dejó (sin un gesto, o en un iframe sin permiso): se sigue en ventana */ }
}
function pintaPantallaCompleta() {
  const si = enPantallaCompleta();
  document.documentElement.classList.toggle('mr-pc', si);        // el estilo de pantalla completa (estilo.css)
  for (const b of document.querySelectorAll('[data-accion="pantallaCompleta"]')) {
    b.hidden = !hayPantallaCompleta;
    b.setAttribute('aria-pressed', String(si));
    const t = si ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)';
    b.title = t; b.setAttribute('aria-label', t);
    const i = b.querySelector('i'); if (i) i.innerHTML = ICONOS[si ? 'pantallaSale' : 'pantalla'];
    const n = b.querySelector('.nom-pc'); if (n) n.textContent = si ? 'Salir de pantalla completa' : 'Pantalla completa';
  }
  if (mundo) requestAnimationFrame(() => { const r = pantalla.getBoundingClientRect(); mundo.tamano(r.width, r.height); });   // el lienzo toma el tamaño nuevo ya
}
document.addEventListener('fullscreenchange', pintaPantallaCompleta);
document.addEventListener('webkitfullscreenchange', pintaPantallaCompleta);

/* ===================================================================
   8. ARRANQUE
   =================================================================== */
ponIconos();
pintaPantallaCompleta();
/* La letra del marcador pixelado (Press Start 2P) está dibujada en una
   cuadrícula de 8: solo se ve nítida si su tamaño es un múltiplo de 8
   píxeles del APARATO (cada píxel de la letra, un cuadrado entero de
   píxeles). En unidades del contenedor salía a 25,3 píxeles en un celular de
   3×, cada píxel de la letra medía 3,16 y los bordes se emborronaban; la
   sombra (.4cqh = 4,6 píxeles) además caía corrida respecto de esa
   cuadrícula y se veía doble. Aquí se calcula el tamaño que pedía la hoja de
   estilos y se lleva al múltiplo de 8 más cercano; la sombra y los marcos van
   en `--pp`, un píxel de la letra chica. Lo demás (márgenes) se ajusta a
   píxeles enteros del aparato. Solo lo usa el estilo pixel (estilo.css). */
function medidasPixel(r) {
  const dpr = window.devicePixelRatio || 1;                                  // píxeles del aparato por píxel CSS
  const u = (r.width <= r.height ? Math.min(0.8 * r.height, 1.45 * r.width) : r.height) / 100;   // la unidad del marcador (--u en estilo.css; en vertical mira también el ancho)
  const ocho = v => Math.max(1, Math.round(v * dpr / 8)) * 8 / dpr;          // al múltiplo de 8 píxeles del aparato más cercano (en px CSS)
  const entero = v => Math.max(1, Math.round(v * dpr)) / dpr;                // a píxeles enteros del aparato
  const chico = ocho(2.2 * u), pp = chico / 8;                               // la letra chica y un píxel suyo
  const fija = (k, v) => pantalla.style.setProperty(k, v + 'px');
  fija('--pp', pp);                                                          // un píxel de la letra chica: sombras y marcos
  fija('--pf-chico', chico);                                                 // metros, nombre de la estación, multiplicador
  fija('--pf-valor', 2 * chico);                                             // los puntos y las monedas: el doble, la misma cuadrícula
  /* El letrero va por el alto (5cqh y 3cqh), salvo en un celular vertical: ahí
     5cqh son 42 px y la letra pixel es cuadrada, así que «Boleto 6 de 10» no
     cabía en una línea y el letrero tapaba media pantalla. Con el ancho de
     tope caben unas 16 letras grandes y unas 28 chicas por línea. */
  fija('--pf-banner', ocho(Math.min(5 * r.height / 100, 0.9 * r.width / 16)));   // el letrero grande
  fija('--pf-banner2', ocho(Math.min(3 * r.height / 100, 0.9 * r.width / 28)));  // su segunda línea
  fija('--pm', entero(2.4 * u));                                             // el margen del marcador, en píxeles enteros
}
async function arranca() {
  // las fuentes del marcador y de los letreros (con un tope: si no llegan, se usa la de respaldo)
  const fuentes = Promise.all(['100px "Lilita One"', '700 60px Orbitron', '20px "Press Start 2P"'].map(f => document.fonts.load(f).catch(() => null)));
  await Promise.race([fuentes, new Promise(r => setTimeout(r, 2500))]);
  try {
    mundo = crearMundo(lienzo);
  } catch (e) {
    $('cargaTexto').textContent = 'Tu navegador no pudo iniciar los gráficos 3D (WebGL). Prueba con otro navegador o activa la aceleración por hardware.';
    console.error(e);
    return;
  }
  mundo.calidad(calidadInicial());
  aplicaMovimiento();
  const ajusta = () => { const r = pantalla.getBoundingClientRect(); mundo.tamano(r.width, r.height); medidasPixel(r); };
  new ResizeObserver(ajusta).observe(pantalla); ajusta();
  vistePuesto();                                                // CITY: lo puesto en el modo elegido (en City, su personaje)
  escenaPortada();                                              // la primera estación del modo elegido, con trenes a la vista
  estado = 'portada';
  pintaPortada(); muestraCapa('capaPortada');
  if (Club) Club.category(modoSel.categoria);                   // la clasificación del costado: la del modo elegido
  pideFantasma(modoSel);                                        // en un modo fantasma, el n.º 1 de su tabla
  requestAnimationFrame(t => { prevT = t; cuadro(t); });
  // se precarga el kit de la segunda estación cuando el navegador esté libre
  setTimeout(() => mundo.precarga(estacionVisual(M.historiaDe(modoSel).estaciones[1] || M.ESTACIONES[1])), 4000);   // CITY: la segunda del mundo elegido
}
window.addEventListener('club-record', e => {                    // el récord de la nube, por si es mayor que el de aquí
  const d = e.detail; if (!d) return;
  for (const w of Object.keys(M.DISTANCIA)) {                   // las de distancia (una por mundo): metros
    if (d.categoria !== M.DISTANCIA[w].categoria) continue;
    const m = M.MODOS[M.DISTANCIA[w].modos[0]];                  // un modo de ese mundo, para saber dónde se guarda
    if (d.puntos > M.distanciaRecord(progreso, m)) { M.anotaDistancia(progreso, m, d.puntos); pintaPortada(); }
    return;
  }
  const m = M.modoDeCategoria(d.categoria);                     // la mejor carrera de algún modo
  if (m && d.puntos > M.recordDe(progreso, m)) { M.anotaRecord(progreso, m, d.puntos); pintaPortada(); }
});
// Para probar desde la consola o desde un script: estado, saltar a puntos, etc.
/* Los que cambian la carrera (puntos, teclas, poderes, inmortal, adelantar
   el tiempo) la vuelven una partida de prueba: se juega igual, pero ya no va
   a la clasificación (ver «la prueba de la carrera»). */
const toca = () => { tocada = true; if (c) c.tocada = true; };
window.__metrorush = {
  estado: () => ({ estado, puntos: c && c.puntos, D: c && c.D, V: c && c.V, estacion: c && c.estacion.nombre, info: mundo && mundo.info(),
    modo: c ? c.modo.id : modoSel.id, motivo: c && c.muerte ? c.muerte.motivo : null, carril: c && c.r.carril, y: c && c.r.y,
    tabla: c && c.cierre ? { modo: c.cierre.modo.id, enviada: c.cierre.enviada, fuera: c.cierre.fuera || null } : null,
    pogo: !!(c && c.pogo), tropiezo: c ? c.tropiezo : 0, suelo: c && c.r.suelo, pers: c && c.pers ? Object.assign({}, c.pers) : null }),   // (ronda 2: el pogo y la persecución)
  /** La semilla de la próxima carrera (la del récord, en el modo Fantasma). No vuelve «de prueba» a nada:
      el antitrampas acepta cualquier semilla. Gancho para el fantasma. */
  semillaSiguiente: n => { semillaSiguiente = Number.isInteger(n) && n >= 0 ? n : null; return semillaSiguiente; },
  /** El fantasma (solo para mirar): el de la portada (por tabla) y el de la carrera en curso. */
  fantasma: () => ({ portada: Object.fromEntries(Object.entries(fantasmas).map(([k, v]) => [k, { estado: v.estado, motivo: v.motivo || null, nombre: v.g && v.g.nombre, puntos: v.g && v.g.puntos, rastro: !!(v.g && v.g.rastro) }])),
    carrera: c && c.fan ? { lado: c.fan.lado, pg: c.fan.pg, Dg: c.fan.Dg, diverge: c.fan.diverge, aplicados: c.fan.pi, pedidos: c.fan.g.pedidos.length } : null,
    rastro: c && c.grab ? c.grab.n : null }),
  /** Elige el modo de juego en la portada, como tocar su tarjeta (no vuelve «de prueba» a nada). */
  modo: id => { eligeModo(id); return modoSel.id; },
  /** Los objetos de la pista por delante (copias, solo para mirar): [{tipo, clase, carril, d, y}]. */
  objetos: (hasta = 60) => c ? c.activos.filter(o => (o.d != null ? o.d : o.d0) - c.D < hasta && (o.d != null ? o.d : o.d0 + (o.largo || 0)) > c.D - 1)
    .map(o => ({ id: o.id, tipo: o.tipo, clase: o.clase, carril: o.carril, d: o.d != null ? o.d : o.d0, y: o.y, largo: o.largo, vel: o.vel, cae: o.cae || undefined })) : [],
  puntos: n => { toca(); if (c) c.puntos = n; },
  pulsa: a => { toca(); pedidos.push(a); },
  poder: k => { toca(); return c && activaPoder(k); },
  inmortal: (s = 9999) => { toca(); if (c) c.invulnerable = s; },
  /* Ganchos de la ronda 2 (los dos vuelven «de prueba» la carrera, como los demás que cambian algo):
     `pogo()` lanza el pogo saltarín ya mismo (como si saliera de la caja) y
     `tropieza()` hace tropezar al corredor como contra un costado (el
     segundo seguido lo atrapa), para mirar la persecución sin buscar un tren. */
  pogo: () => { toca(); return !!(c && estado === 'jugando' && c.modo.items && lanzaPogo()); },
  tropieza: () => { toca(); if (c && estado === 'jugando') tropieza(c.r.x + 1); return estado; },
  /** La prueba de la carrera (la de la última, cerrada, si ya terminó). Solo la lee: no toca nada. */
  prueba: () => c ? JSON.parse(JSON.stringify(c.pruebaFinal || c.prueba)) : null,
  empezar, progreso: () => progreso,
  /** Fija la calidad gráfica (sin la automática), para medir cada una. */
  calidad: n => { opciones.calidad = n; mundo.calidad(n); },
  desglose: () => mundo.desglose(),
  mundo: () => mundo,
  /** Cuánto tarda la lógica de un cuadro (física, choques, generación), en ms, promediando `n` pasos. */
  logica: (n = 600) => { if (estado !== 'jugando') return null; toca(); const t0 = performance.now(); let k = 0; for (; k < n && estado === 'jugando'; k++) actualiza(1 / 60); return (performance.now() - t0) / Math.max(1, k); },
  /** Adelanta `seg` segundos de juego sin dibujar (para probar túneles y estaciones desde un script). */
  avanza: (seg = 5) => { toca(); for (let i = 0; i < seg * 60 && estado === 'jugando'; i++) { actualiza(1 / 60); tiempoTotal += 1 / 60; } }
};
arranca();
