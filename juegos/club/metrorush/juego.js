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
import { crearMundo, PALETAS } from './mundo.js?v=metrorush-2';
import { Sonido } from './audio.js?v=metrorush-2';

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
const opciones = Object.assign({ calidad: 'auto', estilo: 'auto', musica: 80, efectos: 90, sacudida: true, mudo: false }, lee(CLAVE_OPC, {}));
/** Guarda el progreso aquí y (si `subir`) en la cuenta. */
function guardar(subir = true) {
  progreso.at = Date.now();
  escribe(CLAVE, progreso);
  if (subir && Club && Club.guardarPartida) Club.guardarPartida(JSON.stringify(progreso));
}
const guardaOpciones = () => escribe(CLAVE_OPC, opciones);
// lo de la nube se mezcla con lo de aquí (gana lo más nuevo en monedas; lo mayor en mejoras, boletos y récords)
if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
  if (!dato) return;
  try { progreso = M.mezclaProgreso(progreso, JSON.parse(dato)); guardar(false); pintaPortada(); } catch (e) { /* un dato raro se ignora */ }
});

/* ===================================================================
   2. PIEZAS: pantalla, mundo y sonido
   =================================================================== */
const pantalla = $('pantalla'), lienzo = $('lienzo');
const sonido = new Sonido();
sonido.ponMudo(opciones.mudo); sonido.volumenes(opciones.musica / 100, opciones.efectos / 100);
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
  return Object.assign({}, e, { estilo: opciones.estilo, paleta: PALETA_FIJA[opciones.estilo] });
}

/* ===================================================================
   3. LA CARRERA
   =================================================================== */
let estado = 'cargando';      // cargando | portada | jugando | pausa | muerte | salvar («¿seguir corriendo?») | fin
let c = null;                 // los datos de la carrera en curso (ver nuevaCarrera)
let panel = null;             // el panel abierto (tienda, retos, libreta, opciones, ayuda, relato)

function nuevaCarrera() {
  const semilla = (Math.random() * 2 ** 31) >>> 0;
  return {
    // la prueba de la carrera (docs/antitrampas/metrorush.md): con qué se empezó, y después cada evento que cambia el puntaje
    prueba: MP ? MP.nueva({ s: semilla, b: progreso.retos.nivel, md: progreso.mejoras.doble, u: cuentaUrl }) : null,
    r0: performance.now(), sigMuestra: MP ? MP.PASO_MUESTRA : Infinity, sinteticas: 0, tocada: tocada,
    gen: M.crearGenerador(semilla),                  // la pista de esta carrera
    activos: [],                                     // los objetos de la pista que existen ahora
    D: 0, t: 0, V: M.velocidad(0),                   // metros, segundos y velocidad
    puntos: 0, monedas: 0, estrellas: 0,
    r: { carril: 1, carrilPrev: 1, x: 0, xPrev: 0, y: 0, vy: 0, suelo: 0, enAire: false, rodar: 0, rodarPend: false, fase: 0,
      ultSuelo: 0, saltoBufer: -1, tropezarT: -1, ladeo: 0 },
    poderes: { iman: 0, mochila: 0, zapatillas: 0, doble: 0, patineta: 0 },   // segundos que les quedan
    invulnerable: 0, tropiezo: 0, perseguidor: 1, perseguidorObj: 1, introPersecucion: 2.5,
    cuenta: { monedas: 0, saltos: 0, rodadas: 0, distancia: 0, puntos: 0, poderes: 0, techos: 0, estrellas: 0, esquivar: 0, patinetas: 0, mochilas: 0 },
    techos: new Set(), esquivados: new Set(), avisados: new Set(),
    estacion: M.estacionDe(0), cambio: null, banner: 2.5,
    seguirVeces: 0, muerte: null, recordAvisado: false, finalizada: false, quieto: 0,
    extra: 0, potVentana: 6, potUsado: {},          // el potenciador de puntos (+5), y cuánto quedan los botones de potenciadores
    tutorial: progreso.totales.carreras < 2 ? { bajo: 0, alto: 0, tren: 0 } : null,   // las pistas de las dos primeras carreras
    pista: null                                      // la pista que se está mostrando ({tipo, o})
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
  // 1) lo que pidió el jugador
  while (pedidos.length) {
    const p = pedidos.shift();
    if (p === 'izq' || p === 'der') {
      const n = Math.max(0, Math.min(2, r.carril + (p === 'izq' ? -1 : 1)));
      if (n !== r.carril) { r.carrilPrev = r.carril; r.carril = n; sonido.carril(); }
    } else if (p === 'arriba') {
      if (c.poderes.mochila > 0) continue;                    // volando no se salta
      r.saltoBufer = 0.16;                                     // se recuerda un instante, por si aún no toca el suelo
    } else if (p === 'abajo') {
      if (c.poderes.mochila > 0) continue;
      if (r.enAire) { r.vy = -F.caidaRapida; r.rodarPend = true; r.saltoBufer = -1; }   // en el aire: baja de golpe y rueda al caer
      else { r.rodar = F.tiempoRodar; c.cuenta.rodadas++; sonido.rodar(); }
    } else if (p === 'patineta') usaPatineta();
  }
  // 2) el salto (con búfer y tiempo de coyote)
  if (r.saltoBufer > 0) {
    r.saltoBufer -= dt;
    const enSuelo = !r.enAire || c.t - r.ultSuelo < 0.09;
    if (enSuelo && c.poderes.mochila <= 0) {
      const alto = c.poderes.zapatillas > 0 ? F.alturaZapatillas : F.alturaSalto;
      r.vy = M.impulso(alto); r.enAire = true; r.rodar = 0; r.saltoBufer = -1; r.ultSuelo = -1;
      c.cuenta.saltos++;
      if (c.poderes.zapatillas > 0) sonido.saltoAlto(); else sonido.salto();
    }
  }
  // 3) de lado: el corredor va hacia el centro de su carril
  const xObj = M.CARRILES[r.carril], vl = 2.2 / F.cambioCarril;
  r.xPrev = r.x;
  r.x += Math.max(-vl * dt, Math.min(vl * dt, xObj - r.x));
  r.ladeo += ((xObj - r.x) * -0.18 - r.ladeo) * Math.min(1, dt * 10);   // se inclina hacia donde va
  // 4) arriba y abajo: gravedad, suelo, rampas y techos (o la mochila cohete)
  const sop = soporte(r.x, c.D, r.y);
  if (c.poderes.mochila > 0) {
    r.y += (F.alturaMochila - r.y) * (1 - Math.exp(-3.5 * dt)); r.vy = 0; r.enAire = true;
  } else {
    r.vy -= F.gravedad * dt; r.y += r.vy * dt;
    if (r.y <= sop.h) {                                        // toca el suelo (o el techo, o la rampa)
      if (r.enAire && r.vy < -1) { sonido.aterriza(); if (r.rodarPend) { r.rodar = F.tiempoRodar; c.cuenta.rodadas++; sonido.rodar(); } }
      r.y = sop.h; r.vy = 0; r.enAire = false; r.rodarPend = false; r.ultSuelo = c.t;
    } else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;   // se acabó el tren: cae
  }
  r.suelo = sop.h;
  if (sop.tren && !c.techos.has(sop.tren.id)) { c.techos.add(sop.tren.id); c.cuenta.techos++; }
  if (r.rodar > 0) r.rodar -= dt;
  if (r.tropezarT >= 0) { r.tropezarT += dt; if (r.tropezarT > 0.45) r.tropezarT = -1; }
  r.fase += dt * (8 + c.V * 0.32);                            // la zancada se acelera con la velocidad
}

/* ---- choques ---- */

/** El alto que ocupa cada obstáculo [abajo, arriba] y su medio ancho (motor.js). */
const caja = o => M.caja(o, c.D);
function choques() {
  const r = c.r;
  if (c.poderes.mochila > 0 || r.y > 6) return;                // volando, por encima de todo
  const yb = r.y + 0.02, yt = r.y + (r.rodar > 0 ? F.altoRodando : F.altoDePie);
  for (const o of c.activos) {
    const k = caja(o);
    if (!k || k.y1 <= k.y0) continue;
    if (c.D + M.MEDIO_LARGO < k.z0 || c.D - M.MEDIO_LARGO > k.z1) continue;   // no está a mi altura en la pista
    const X = M.CARRILES[o.carril], lim = k.w + F.medioAncho;
    if (Math.abs(r.x - X) >= lim) continue;                     // no está en mi carril
    if (yb >= k.y1 || yt <= k.y0) continue;                     // lo paso por arriba o por abajo
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
  aviso('¡Cuidado! Don Ramón te pisa los talones');
}
function choca(o) {
  if (c.poderes.patineta > 0) {                                 // la patineta se rompe y te salva
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
  c.perseguidorObj = 1;
  c.potVentana = 0; pintaPots();                                // los botones de potenciadores se van (y no vuelven al seguir)
  ocultaPista();
  sonido.choque(); sonido.mochila(false);
  if (opciones.sacudida) mundo.sacude(0.8);
}

/* ---- poderes ---- */
function activaPoder(clase) {
  if (clase === 'caja') {
    const premio = M.cajaMisteriosa(Math.random);
    sonido.caja();
    if (premio.patineta) { progreso.patinetas++; aviso('Caja misteriosa: ¡una patineta!'); }
    else { c.monedas += premio.monedas; aviso(premio.gordo ? `¡PREMIO GORDO! +${premio.monedas} monedas` : `Caja misteriosa: +${premio.monedas} monedas`); }
    return;
  }
  const dur = M.duracionPoder(clase, progreso.mejoras[clase]);
  c.poderes[clase] = dur;
  c.cuenta.poderes++;
  sonido.poder();
  if (clase === 'mochila') {                                   // la mochila cohete: monedas en el aire y a volar
    c.cuenta.mochilas++;
    anotaPedido('C', c.D + 12, c.D + 12 + c.V * dur, c.r.carril);
    c.activos.push(...c.gen.monedasCielo(c.D + 12, c.D + 12 + c.V * dur, c.r.carril));
    sonido.mochila(true);
  }
  aviso(M.PODERES[clase].nombre + '!');
}
function usaPatineta() {
  if (c.poderes.patineta > 0) return;
  if (progreso.patinetas <= 0) { aviso('No te quedan patinetas (se compran en la tienda)'); return; }
  progreso.patinetas--; c.poderes.patineta = M.DURACION_PATINETA; c.cuenta.patinetas++;
  sonido.patineta(); aviso('¡Patineta! Te salva de un choque');
}

/* ---- monedas, poderes y regalos que se recogen ---- */
function recoge(dt) {
  const r = c.r, imanta = c.poderes.iman > 0, k = 1 - Math.exp(-14 * dt);
  for (let i = c.activos.length - 1; i >= 0; i--) {
    const o = c.activos[i];
    if (o.tipo !== 'moneda' && o.tipo !== 'poder' && o.tipo !== 'estrella' && o.tipo !== 'boleto') continue;
    const dz = o.d - c.D;
    if (dz > 20 || dz < -2) continue;
    const ox = o.x != null ? o.x : M.CARRILES[o.carril];
    if (o.tipo === 'moneda' && imanta && dz < 18) {             // el imán las trae volando
      o.x = ox + (r.x - ox) * k; o.y += (r.y + 1 - o.y) * k; o.d += (c.D - o.d) * k;
    }
    if (Math.abs(o.d - c.D) > 1.0 || Math.abs((o.x != null ? o.x : ox) - r.x) > 0.95) continue;
    if (o.y < r.y - 0.4 || o.y > r.y + 2.2) continue;
    // ¡recogido!
    c.activos.splice(i, 1); mundo.suelta(o);
    if (o.tipo === 'moneda') { c.monedas++; c.cuenta.monedas++; sonido.moneda(); if (c.monedas % 5 === 0) mundo.chispa(r.x, r.y + 1, 0); }
    else if (o.tipo === 'poder') { if (o.clase === 'doble') anota('d', o.id); activaPoder(o.clase); mundo.chispa(r.x, r.y + 1.2, 0, 0xffffff); }
    else if (o.tipo === 'estrella') {
      anota('e', o.id);
      c.estrellas = Math.min(M.MAX_ESTRELLAS, c.estrellas + 1); c.cuenta.estrellas++;
      sonido.estrella(); aviso(`Estrella: multiplicador ×${multiplicador()}`); mundo.chispa(r.x, r.y + 1.2, 0, 0xffe066);
    } else if (o.tipo === 'boleto') {
      if (!progreso.boletos.includes(o.n)) { progreso.boletos.push(o.n); progreso.boletos.sort((a, b) => a - b); }
      sonido.boleto(); banner(M.BOLETOS[o.n].titulo, 'Léelo en la Libreta');
      if (progreso.boletos.length >= 7) desbloquea('inspector', '¡Los siete boletos! Aspecto Inspector desbloqueado');
      guardar();
    }
  }
}
const multiplicador = () => M.multiplicador({ base: progreso.retos.nivel, estrellas: c.estrellas, doble: c.poderes.doble > 0, extra: c.extra });

/* ---- potenciadores (Despegue y Potenciador +5) ----
   Los primeros segundos de la carrera aparecen dos botones (o las teclas 1
   y 2) con los que tengas. Usarlos los gasta. */
function pintaPots() {
  const el = $('hudPots'), hay = c && c.potVentana > 0 && Object.keys(M.POTENCIADORES).some(k => progreso.potenciadores[k] > 0 && !c.potUsado[k]);
  el.hidden = !hay;
  pantalla.classList.toggle('con-pots', hay);                     // la pista de las primeras carreras sube para no taparlos
  if (!hay) return;
  el.innerHTML = Object.entries(M.POTENCIADORES).map(([k, P], i) => progreso.potenciadores[k] > 0 && !c.potUsado[k]
    ? `<button type="button" data-pot="${k}" aria-label="${P.nombre} (tecla ${i + 1})"><i>${ICONOS[k === 'despegue' ? 'cohete' : 'mas5']}</i><span>${P.nombre}</span><b translate="no">×${progreso.potenciadores[k]}</b><kbd>${i + 1}</kbd></button>` : '').join('');
}
function usaPotenciador(k) {
  if (!c || estado !== 'jugando' || c.potVentana <= 0 || c.potUsado[k] || !(progreso.potenciadores[k] > 0)) return;
  progreso.potenciadores[k]--; c.potUsado[k] = true; guardar();
  if (k === 'despegue') {                                       // empezar volando con la mochila, sin chocar con nada
    const seg = M.POTENCIADORES.despegue.seg;
    c.poderes.mochila = seg; c.invulnerable = Math.max(c.invulnerable, seg + 1.5);
    anotaPedido('C', c.D + 12, c.D + 12 + c.V * seg, c.r.carril);
    c.activos.push(...c.gen.monedasCielo(c.D + 12, c.D + 12 + c.V * seg, c.r.carril));
    sonido.mochila(true); sonido.poder(); aviso('¡Despegue! A volar');
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
  c.V = muriendo ? Math.max(0, c.V - M.FRENADA * dt) : M.velocidad(c.t);   // al caer frena (lo que tolera el antitrampas)
  const dD = c.V * dt;
  c.Dantes = c.D;                                               // dónde iba en el cuadro anterior (para seguir la rampa)
  c.D += dD;
  if (!muriendo) {
    // los puntos: 10 por metro × el multiplicador
    const antes = c.puntos;
    c.puntos += M.puntosPorTramo(dD, multiplicador());
    c.cuenta.puntos = Math.floor(c.puntos); c.cuenta.distancia = Math.floor(c.D);
    if (!c.recordAvisado && progreso.records.puntos > 0 && antes <= progreso.records.puntos && c.puntos > progreso.records.puntos) {
      c.recordAvisado = true; banner('¡Nuevo récord!', fmt(c.puntos) + ' puntos'); sonido.record();
    }
  }
  // la pista: generar por delante, mover los trenes que vienen, dibujar lo cercano y soltar lo que pasó
  for (const o of c.gen.generarHasta(c.D + 230, { V: Math.max(13, c.V) })) c.activos.push(o);
  for (let i = c.activos.length - 1; i >= 0; i--) {
    const o = c.activos[i];
    if (o.tipo === 'tren' && o.vel > 0) {
      if (!o.activo && c.D >= o.dArribo - M.APARECE) o.activo = true;
      if (o.activo && !muriendo) o.d0 -= o.vel * dt;            // al morir todo se queda quieto (el tren no te pasa por encima)
      if (o.d0 + o.largo < c.D - 1 && !c.esquivados.has(o.id) && !muriendo) { c.esquivados.add(o.id); c.cuenta.esquivar++; }
    }
    const fin = o.d != null ? o.d : o.d0 + (o.largo || 0);
    if (fin < c.D - 15) { mundo.suelta(o); c.activos.splice(i, 1); continue; }
    if (!o.vis && (o.d != null ? o.d : o.d0) - c.D < mundo.vista) mundo.nuevo(o);
    if (o.tipo === 'tunel' && c.cambio && !c.cambio.tunel) c.cambio.tunel = o;
  }
  if (!muriendo) {
    fisica(dt);
    choques();
  }
  /* Si chocó en este mismo cuadro, ya no recoge nada ni se le gastan los
     poderes: la prueba de la carrera dice que los puntos paran en el choque,
     y una estrella anotada justo después se leería como recogida estando caído. */
  if (!muriendo && estado === 'jugando') {
    recoge(dt);
    // los poderes se gastan
    for (const k of Object.keys(c.poderes)) if (c.poderes[k] > 0) {
      c.poderes[k] = Math.max(0, c.poderes[k] - dt);
      if (c.poderes[k] === 0 && k === 'mochila') { sonido.mochila(false); c.invulnerable = Math.max(c.invulnerable, 2); }
      if (c.poderes[k] === 0 && k === 'doble') anota('x');      // el multiplicador vuelve a la mitad
    }
    if (c.invulnerable > 0) c.invulnerable -= dt;
    if (c.tropiezo > 0) { c.tropiezo -= dt; if (c.tropiezo <= 0) c.perseguidorObj = 0; }
    if (c.introPersecucion > 0) { c.introPersecucion -= dt; if (c.introPersecucion <= 0 && c.tropiezo <= 0) c.perseguidorObj = 0; }
    estaciones();
    if (c.t >= c.sigMuestra) { anota('w'); c.sigMuestra = c.t + MP.PASO_MUESTRA; }   // una muestra de metros y reloj cada 2 s
    retosEnVivo(dt);
    pistas(dt);
    if (c.potVentana > 0) { c.potVentana -= dt; if (c.potVentana <= 0) pintaPots(); }
  } else if (muriendo) {
    const r = c.r;                                               // chocó en el aire: cae hasta el suelo (o el techo) antes de quedar tendido
    if (r.y > r.suelo) { r.vy -= F.gravedad * dt; r.y = Math.max(r.suelo, r.y + r.vy * dt); }
    c.muerte.t += Math.max(dt, dtRealUltimo);                     // en un aparato lento la pausa tras el choque no se alarga
    if (estado === 'muerte' && c.muerte.t > 0.9 && puedeSalvar()) abreSalvar();
    else if (estado === 'muerte' && c.muerte.t > 1.4) muestraFin();
  }
  c.perseguidor += (c.perseguidorObj - c.perseguidor) * Math.min(1, dt * 2.2);
}

/* ---- estaciones y túneles ---- */
function estaciones() {
  /* El túnel se pide ANTES de llegar al umbral. La pista ya está generada
     unos 230 m por delante (lo que se ve), así que un túnel pedido justo al
     cruzar el umbral recién aparecería 15 segundos después. Por eso se
     calcula cuántos metros faltan para el umbral al multiplicador de ahora:
     si es menos de lo que ya está generado, el túnel se pide ya y cae más o
     menos donde vas a estar cuando ganes esos puntos. Ejemplo: vas en 49 000
     con ×5, faltan 1000 puntos = 20 m; el túnel cae a ~240 m y la estación
     nueva empieza al salir de él. */
  const sig = M.siguienteUmbral(c.puntos);
  const faltan = (sig - c.puntos) / (M.PUNTOS_POR_METRO * multiplicador());
  const e = M.estacionDe(faltan < 220 ? sig : c.puntos);         // a donde se va: la que viene si llega pronto
  if (!c.cambio && e.clave !== c.estacion.clave) {
    c.cambio = { estacion: e, tunel: null, hecho: false };
    anotaPedido('T', c.D + 40, e.id);
    c.gen.pedirTunel(c.D + 40, e.id);
    mundo.precarga(estacionVisual(e));
    mundo.letreroTunel(e.nombre);
  }
  // precarga el kit de la estación siguiente cuando falta poco (para que el túnel no se trabe)
  if (c.puntos > sig * 0.7) mundo.precarga(estacionVisual(M.estacionDe(sig)));
  const cb = c.cambio;
  if (cb && cb.tunel) {
    const o = cb.tunel;
    if (!cb.entro && c.D >= o.d0 - 2) { cb.entro = true; sonido.tunel(); }
    if (!cb.hecho && c.D >= o.d0 + 40) {                         // dentro del túnel (no se ve el mundo de afuera): se cambia todo
      cb.hecho = true;
      mundo.activa(estacionVisual(cb.estacion), o.d0 + o.largo + 4);
      c.estacion = cb.estacion;
      sonido.tocaTema(cb.estacion.musica);
      pantalla.dataset.estilo = estacionVisual(cb.estacion).estilo;
      if (cb.estacion.boleto && !progreso.boletos.includes(cb.estacion.boleto)) { anotaPedido('B', cb.estacion.boleto, o.d0 + o.largo + 260); c.gen.pedirBoleto(cb.estacion.boleto, o.d0 + o.largo + 260); }
    }
    if (cb.hecho && c.D >= o.d0 + o.largo - 6) { banner(cb.estacion.nombre, cb.estacion.lema); c.cambio = null; }
  }
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
    if (o.carril !== r.carril || !(o.tipo === 'bajo' || o.tipo === 'alto' || o.tipo === 'tren' || o.tipo === 'rampa')) continue;
    const dz = (o.d != null ? o.d : o.d0) - c.D;
    if (dz > 0 && dz < dz0) { dz0 = dz; cerca = o; }
  }
  if (!cerca || cerca.tipo === 'rampa' || c.tutorial[cerca.tipo] >= 2) return;
  const cierre = c.V + (cerca.tipo === 'tren' && cerca.activo ? cerca.vel : 0);   // un tren que viene se acerca más rápido
  if (dz0 / Math.max(1, cierre) > 1.6) return;                   // todavía lejos: se avisa 1,6 s antes
  c.tutorial[cerca.tipo]++;
  c.pista = { tipo: cerca.tipo, o: cerca };
  const P = PISTAS[cerca.tipo], el = $('pista');
  el.dataset.tipo = cerca.tipo;
  $('pistaIco').innerHTML = ICONOS[P.ico];
  $('pistaTxt').textContent = esTactil ? P.tactil : P.teclas;
  el.hidden = false;
}

/* ===================================================================
   4. EL CICLO DE LA PARTIDA (empezar, pausa, fin, seguir)
   =================================================================== */
function empezar() {
  sonido.iniciar();
  if (!progreso.intro) { abreRelato(); return; }               // la primera vez se cuenta de qué se trata
  cierraPanel();
  c = nuevaCarrera(); ocultaPista();
  mundo.reinicia();
  const e = estacionVisual(c.estacion);
  mundo.activa(e, 0);
  pantalla.dataset.estilo = e.estilo;
  for (const o of c.gen.generarHasta(230, { V: c.V })) c.activos.push(o);
  if (!progreso.boletos.includes(1)) { anotaPedido('B', 1, 420); c.gen.pedirBoleto(1, 420); }
  estado = 'jugando';
  muestraCapa(null);
  $('hud').hidden = false;
  sonido.tocaTema(c.estacion.musica);
  banner(c.estacion.nombre, c.estacion.lema);
  if (esTactil && progreso.totales.carreras < 3) aviso('Desliza el dedo: ← → carril · ↑ saltar · ↓ rodar');
  if (Club) Club.category('club-metrorush-carrera');
  pintaPots();
  lienzo.focus({ preventScroll: true });
  midiendo = { t: 0, n: 0, suma: 0 };
}
function pausar() {
  if (estado !== 'jugando') return;
  estado = 'pausa'; sonido.calla(); sonido.mochila(false);
  $('pausaDetalle').textContent = `${fmt(c.puntos)} puntos · ${fmt(c.D)} m · ${c.monedas} monedas`;
  muestraCapa('capaPausa');
}
function seguirJugando() {
  if (estado !== 'pausa') return;
  cierraPanel(); muestraCapa(null);
  estado = 'jugando'; sonido.tocaTema(c.estacion.musica);
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
function puedeSalvar() { return c && c.muerte && c.muerte.motivo !== 'abandono' && progreso.monedas + c.monedas >= M.costoSeguir(c.seguirVeces); }
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
const MOTIVOS = { atrapado: 'Don Ramón te atrapó', tren: 'Te atropelló un tren', bajo: 'Chocaste con una barrera', alto: 'Te diste con un letrero', rampa: 'Chocaste con una rampa', abandono: 'Carrera terminada' };
let cuentaFin = 0;                                              // para cortar la animación de los puntos si se sale antes
/** El resumen. La carrera se cierra aquí mismo (monedas, récords, misiones,
    clasificación): después ya no se puede seguir, así que no hay nada que esperar. */
function muestraFin() {
  if (!c || estado === 'fin') return;
  estado = 'fin';
  sonido.calla();
  const k = cierraCarrera();
  c.potVentana = 0; pintaPots(); ocultaPista();                 // por si se terminó desde la pausa en los primeros segundos
  pintaPortada();                                               // el marcador de la página (récord, monedas, multiplicador) ya cambió
  $('finTitulo').textContent = MOTIVOS[c.muerte && c.muerte.motivo] || 'Fin de la carrera';
  const nuevo = k.puntos > k.recordAntes && k.recordAntes > 0;
  $('finRecord').hidden = !nuevo;
  $('finMejor').textContent = nuevo ? `Antes: ${fmt(k.recordAntes)}` : `Récord: ${fmt(Math.max(k.recordAntes, k.puntos))}`;
  $('finStats').innerHTML = [
    ['moneda', '+' + fmt(k.monedas), 'monedas'], ['bandera', fmt(k.metros) + ' m', 'distancia'],
    ['estrella', '×' + k.mult, 'multiplicador'], ['tren', c.estacion.nombre, 'estación', 'largo']
  ].map(([ico, v, nom, cls]) => `<li${cls ? ` class="${cls}"` : ''}><i>${ICONOS[ico]}</i><b translate="no">${v}</b><small>${nom}</small></li>`).join('');
  // las misiones: si el set se completó, se muestran las del set terminado (las tres cumplidas) y el premio
  $('finSet').hidden = !k.subio;
  if (k.subio) $('finSet').innerHTML = `¡Set completo! Multiplicador <b translate="no">×${progreso.retos.nivel}</b> y ${ICONOS.moneda}<b translate="no">+${fmt(k.premio)}</b>`;
  filasRetos($('finRetos'), k.nivelRetos, k.avanceRetos);
  $('finFuera').hidden = !k.fuera; $('finFuera').textContent = k.fuera || '';
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
  const recordAntes = progreso.records.puntos, mult = multiplicador();   // antes de que suba el multiplicador base
  progreso.monedas += c.monedas;
  progreso.totales.carreras++; progreso.totales.metros += metros; progreso.totales.monedas += c.monedas;
  const recordDist = metros > progreso.records.distancia;
  progreso.records.puntos = Math.max(progreso.records.puntos, puntos);
  progreso.records.distancia = Math.max(progreso.records.distancia, metros);
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
  // a la clasificación (con su prueba): la carrera siempre (cuenta como partida del club); la distancia, solo si es récord
  if (Club && Club.result && puntos >= 1 && prueba) {
    Club.result({ categoria: 'club-metrorush-carrera', puntos: Math.min(1e9, puntos), tiempo: ms }, prueba);
    if (recordDist && metros >= 1) Club.result({ categoria: 'club-metrorush-distancia', puntos: Math.min(1e6, metros), tiempo: ms }, prueba);
  }
  c.cierre = { puntos, metros, monedas: c.monedas, mult, recordAntes, subio: res.subio, premio, nivelRetos: nivelAntes, avanceRetos, fuera: c.fuera };
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
  c.pruebaFinal = prueba;
  if (c.tocada || tocada) { c.fuera = 'Partida de prueba (se usó __metrorush): no entra en la clasificación.'; return null; }
  if (c.sinteticas > 0) { c.fuera = 'Esta carrera tuvo teclas que no apretó una persona: no entra en la clasificación.'; return null; }
  const r = MP.rehace(prueba);
  if (r.motivo || Math.abs(r.puntos - puntos) > 2 || r.metros !== metros || Math.abs(r.tiempo - ms) > 100) {
    console.warn('Metro Rush: la prueba no cuadra con la carrera', r, { puntos, metros, ms });
    c.fuera = 'Esta carrera no se pudo comprobar, así que no entra en la clasificación.';
    return null;
  }
  return prueba;
}
function aPortada() {
  cierraCarrera(); ocultaPista();
  estado = 'portada'; c = null;
  $('hud').hidden = true;
  mundo.reinicia(); mundo.activa(estacionVisual(M.ESTACIONES[0]), 0);
  pantalla.dataset.estilo = estacionVisual(M.ESTACIONES[0]).estilo;
  sonido.tocaTema('metrorush-barrio');
  pintaPortada(); muestraCapa('capaPortada');
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
  // lo que el mundo necesita para dibujar este cuadro
  const r = c ? c.r : null;
  // en la portada y en la tienda la cámara se pone delante del corredor, que mira y saluda
  const menu = panel === 'capaTienda' ? 'tienda' : estado === 'portada' ? 'portada' : null;
  const pose = menu ? { modo: 'menu', t: tiempoTotal }
    : !c ? { modo: 'quieto', fase: tiempoTotal * 3 }
    : c.muerte && c.muerte.motivo === 'abandono' ? { modo: 'quieto', fase: tiempoTotal * 3 }      // «Terminar la carrera»: se queda de pie
    : estado === 'muerte' || estado === 'salvar' || (estado === 'fin' && c.muerte) ? { modo: 'caer', t: c.muerte ? c.muerte.t : 1 }
      : r.tropezarT >= 0 ? { modo: 'tropezar', t: r.tropezarT, fase: r.fase, ladeo: r.ladeo }
        : c.poderes.mochila > 0 ? { modo: 'volar', fase: r.fase }
          : r.rodar > 0 ? { modo: 'rodar', t: F.tiempoRodar - r.rodar }
            : r.enAire ? { modo: 'saltar', vy: r.vy, ladeo: r.ladeo }
              : { modo: 'correr', fase: r.fase, ladeo: r.ladeo };
  mundo.paso({
    D: c ? c.D : 0, x: r ? r.x : 0, y: r ? r.y : 0, suelo: r ? r.suelo : 0, v: c ? c.V : 0, dt, t: tiempoTotal, pose,
    poderes: c ? { iman: c.poderes.iman > 0, mochila: c.poderes.mochila > 0, zapatillas: c.poderes.zapatillas > 0, patineta: c.poderes.patineta > 0 } : {},
    perseguidor: c && !menu ? c.perseguidor : 0, menu
  });
  mundo.dibuja();
  sonido.tick(c && estado === 'jugando' ? c.V : 13);
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
/* Un saltito (crece y vuelve) cuando cambia un número del marcador: el
   multiplicador al tomar una estrella, la moneda con cada moneda. Va con
   la propiedad `scale` (no `transform`), para no pisar la inclinación que
   la estética juguete le da a la placa del multiplicador. */
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
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
  // la barra hacia la próxima estación
  const e = c.estacion, sig = M.siguienteUmbral(c.puntos), desde = e.desde || 0;
  const k = Math.max(0, Math.min(1, (c.puntos - (e.vuelta > 1 ? sig - M.VUELTA_CADA : desde)) / Math.max(1, sig - (e.vuelta > 1 ? sig - M.VUELTA_CADA : desde))));
  ponTexto('hudEstacion', e.nombre);
  $('hudEstBarra').style.setProperty('--k', k.toFixed(3));
  // los poderes activos, con su barra de tiempo
  const lista = [];
  for (const [kk, v] of Object.entries(c.poderes)) if (v > 0) {
    const total = kk === 'patineta' ? M.DURACION_PATINETA : M.duracionPoder(kk, progreso.mejoras[kk]);
    lista.push(`<li class="p-${kk}"><b>${ICONOS[kk === 'patineta' ? 'patineta' : ICONO_PODER[kk]]}</b><span><i style="--k:${(v / total).toFixed(3)}"></i></span></li>`);
  }
  const html = lista.join('');
  if (hudCache.poderes !== html.replace(/--k:[\d.]+/g, '')) { hudCache.poderes = html.replace(/--k:[\d.]+/g, ''); $('hudPoderes').innerHTML = html; }
  else { let i = 0; for (const [kk, v] of Object.entries(c.poderes)) if (v > 0) { const el = $('hudPoderes').children[i++]; if (el) { const total = kk === 'patineta' ? M.DURACION_PATINETA : M.duracionPoder(kk, progreso.mejoras[kk]); el.querySelector('i').style.setProperty('--k', (v / total).toFixed(3)); } } }
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
  $('bannerTitulo').textContent = titulo; $('bannerSub').textContent = sub || '';
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
  bandera: svg(`<path d="M8 29V4" stroke="#142357" stroke-width="2.8" stroke-linecap="round"/><path d="M8.5 5h17l-3.5 5 3.5 5h-17z" fill="#ff3d4f" ${T}/>`)
};
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
function abrePanel(id) { if (panel === 'capaTienda' && id !== 'capaTienda') saleTienda(); panel = id; for (const el of document.querySelectorAll('.capa')) el.hidden = el.id !== id; }
function cierraPanel() {
  if (!panel) return;
  if (panel === 'capaTienda') saleTienda();
  panel = null;
  muestraCapa(estado === 'pausa' ? 'capaPausa' : estado === 'fin' ? 'capaFin' : estado === 'portada' ? 'capaPortada' : null);
}
function pintaPortada() {
  ponTexto('portadaRecord', fmt(progreso.records.puntos));
  ponTexto('portadaMult', '×' + progreso.retos.nivel);
  ponTexto('portadaMonedas', fmt(progreso.monedas));
  // los globitos de la barra: cuántos retos van cumplidos y cuántos boletos tienes
  const lista = M.retosDeNivel(progreso.retos.nivel);
  const hechos = lista.filter((r, i) => progreso.retos.avance[i] >= r.meta).length;
  ponTexto('portadaRetosN', `${hechos}/${lista.length}`);
  $('portadaMisBarra').style.setProperty('--k', (hechos / lista.length).toFixed(3));
  // el globito «!» de Misiones: hay algo que hacer ahí (una misión se puede saltar con lo que tienes, o el set está a una misión)
  $('portadaRetosG').hidden = !(progreso.retos.nivel < M.MAX_BASE && (hechos === 2 || progreso.monedas >= M.costoSaltar(progreso.retos.nivel)));
  ponTexto('portadaBoletos', `${progreso.boletos.length}/7`);
  ponTexto('barRecord', fmt(progreso.records.puntos));
  ponTexto('barMonedas', fmt(progreso.monedas));
  ponTexto('barMult', '×' + progreso.retos.nivel);
}
/* Tocar cualquier parte vacía de la portada empieza a correr, como «toca
   para jugar»: solo los botones y los contadores no cuentan. */
$('capaPortada').addEventListener('click', e => {
  if (estado !== 'portada' || panel || e.target.closest('button, .contador, .p-record, .logo')) return;
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
let tiendaVer = null;                                          // el aspecto que se está probando
let aspectoMostrado = null;                                    // el que lleva el corredor en pantalla
function abreTienda(pestana = 'mejoras') {
  tiendaPestana = pestana; tiendaVer = progreso.aspecto;
  pintaTienda(); abrePanel('capaTienda');
}
function saleTienda() {                                        // vuelve a la ropa que de verdad lleva puesta
  if (aspectoMostrado && aspectoMostrado !== progreso.aspecto) mundo.aspecto(M.ASPECTOS[progreso.aspecto] || M.ASPECTOS.clasico);
  aspectoMostrado = progreso.aspecto;
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
  for (const [k, P] of Object.entries(M.POTENCIADORES)) tarjetas.push(`<li class="t-tarjeta" style="--tinte:${k === 'despegue' ? '#dff1ff' : '#fff1c4'}"><span class="t-ico">${ICONOS[k === 'despegue' ? 'cohete' : 'mas5']}</span>
      <div class="t-info"><strong>${P.nombre}</strong><small>${P.texto}</small><span class="t-cuenta">Tienes <b translate="no">${progreso.potenciadores[k]}</b></span></div>
      <button type="button" class="t-precio" data-comprar="pot:${k}" ${progreso.monedas < P.precio ? 'disabled' : ''} aria-label="Comprar ${P.nombre} por ${fmt(P.precio)} monedas">${ICONOS.moneda}<b translate="no">${fmt(P.precio)}</b></button></li>`);
  $('tiendaPoderes').innerHTML = tarjetas.join('');
  // los personajes: la ropa en fila, y la ficha del que se está probando
  if (!M.ASPECTOS[tiendaVer]) tiendaVer = progreso.aspecto;
  $('tiendaAspectos').innerHTML = Object.entries(M.ASPECTOS).map(([k, a]) => {
    const tiene = progreso.aspectos.includes(k), puesto = progreso.aspecto === k, secreto = !tiene && a.precio == null;
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    const marca = puesto ? `<em class="ok">${ICONOS.check}</em>` : secreto ? `<em class="cerrado">${ICONOS.candado}</em>` : '';
    return `<li><button type="button" class="t-traje${k === tiendaVer ? ' sel' : ''}${secreto ? ' secreto' : ''}" data-ver="${k}" aria-pressed="${k === tiendaVer}">
      <span class="t-muestra" style="--a:${hex(a.sudadera)};--b:${hex(a.gorra)};--c:${hex(a.jeans)};--d:${hex(a.mochila)}"><i></i></span><span class="t-n">${a.nombre}</span>${marca}</button></li>`;
  }).join('');
  const a = M.ASPECTOS[tiendaVer], tiene = progreso.aspectos.includes(tiendaVer), puesto = progreso.aspecto === tiendaVer;
  $('tiendaNombre').textContent = a.nombre;
  $('tiendaEstado').textContent = puesto ? 'Lo llevas puesto' : tiene ? 'Es tuyo' : a.precio != null ? 'En venta' : 'Secreto';
  $('tiendaAccion').innerHTML = puesto ? `<span class="t-puesto">${ICONOS.check}<span>Puesto</span></span>`
    : tiene ? `<button type="button" class="t-boton verde" data-poner="${tiendaVer}">Ponérmelo</button>`
      : a.precio != null ? `<button type="button" class="t-precio grande" data-aspecto="${tiendaVer}" ${progreso.monedas < a.precio ? 'disabled' : ''}>${ICONOS.moneda}<b translate="no">${fmt(a.precio)}</b></button>`
        : `<p class="t-secreto">${ICONOS.candado}<span>${a.secreto}</span></p>`;
  // el corredor se lo prueba (solo en la pestaña de personajes; en mejoras lleva lo suyo)
  const mostrar = tiendaPestana === 'personajes' ? tiendaVer : progreso.aspecto;
  if (mundo && mostrar !== aspectoMostrado) { mundo.aspecto(M.ASPECTOS[mostrar]); aspectoMostrado = mostrar; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  sonido.iniciar();
  if (b.dataset.comprar) {
    const k = b.dataset.comprar;
    if (k === 'patineta') { if (progreso.monedas >= M.PRECIO_PATINETA) { progreso.monedas -= M.PRECIO_PATINETA; progreso.patinetas++; sonido.poder(); } }
    else if (k.startsWith('pot:')) { const id = k.slice(4), P = M.POTENCIADORES[id]; if (P && progreso.monedas >= P.precio) { progreso.monedas -= P.precio; progreso.potenciadores[id]++; sonido.poder(); } }
    else { const p = M.precioMejora(progreso.mejoras[k]); if (p != null && progreso.monedas >= p) { progreso.monedas -= p; progreso.mejoras[k]++; sonido.poder(); } }
    guardar(); pintaTienda(); pintaPortada(); return;
  }
  if (b.dataset.aspecto) { const a = M.ASPECTOS[b.dataset.aspecto]; if (a && a.precio != null && progreso.monedas >= a.precio) { progreso.monedas -= a.precio; progreso.aspectos.push(b.dataset.aspecto); progreso.aspecto = b.dataset.aspecto; mundo.aspecto(a); aspectoMostrado = b.dataset.aspecto; sonido.poder(); guardar(); pintaTienda(); pintaPortada(); } return; }
  if (b.dataset.poner) { progreso.aspecto = b.dataset.poner; mundo.aspecto(M.ASPECTOS[b.dataset.poner]); aspectoMostrado = b.dataset.poner; sonido.reto(); guardar(); pintaTienda(); return; }
  if (b.dataset.saltar != null) { saltarMision(Number(b.dataset.saltar)); return; }
  if (b.dataset.pot) { cuentaEntrada(e); usaPotenciador(b.dataset.pot); return; }
  if (b.dataset.pestana && b.getAttribute('role') === 'tab') { tiendaPestana = b.dataset.pestana; sonido.carril(); pintaTienda(); return; }
  if (b.dataset.ver) { tiendaVer = b.dataset.ver; sonido.carril(); pintaTienda(); return; }
  if (b.dataset.flecha) {                                       // las flechas pasan de un aspecto al siguiente
    const ids = Object.keys(M.ASPECTOS), i = ids.indexOf(tiendaVer);
    tiendaVer = ids[(i + Number(b.dataset.flecha) + ids.length) % ids.length]; sonido.carril(); pintaTienda(); return;
  }
  const accion = b.dataset.accion;
  if (!accion) return;
  ({
    jugar: empezar, otra: otraCarrera, portada: aPortada, seguir: seguirJugando, seguirChoque: seguirTrasChoque,
    abandonar: () => { if (estado !== 'pausa') return; anota('m'); c.muerte = { t: 2, motivo: 'abandono' }; muestraFin(); },
    noSalvar: () => { if (estado === 'salvar') muestraFin(); },
    tienda: () => abreTienda('mejoras'), personajes: () => abreTienda('personajes'), retos: abreRetos, libreta: abreLibreta, opciones: abreOpciones, ayuda: () => abrePanel('capaAyuda'),
    volver: cierraPanel, relatoListo: () => { progreso.intro = true; guardar(); panel = null; empezar(); }
  })[accion]?.();
});
function abreLibreta() {
  $('libretaIntro').textContent = M.INTRO;
  $('listaBoletos').innerHTML = M.ESTACIONES.map(e => {
    const b = M.BOLETOS[e.boleto], tiene = progreso.boletos.includes(e.boleto);
    return tiene ? `<li><strong>${b.titulo}</strong><p>${b.texto}</p></li>`
      : `<li class="falta"><strong>Boleto n.º ${e.boleto} · ${e.desde ? `desde ${fmt(e.desde)} puntos` : 'Barrio Estación'}</strong><p>Todavía no lo encuentras. Está en la estación ${e.nombre}.</p></li>`;
  }).join('');
  $('libretaCuenta').textContent = `${progreso.boletos.length} de 7 boletos`;
  abrePanel('capaLibreta');
}
function abreRelato() {
  $('relatoTexto').textContent = M.INTRO;
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

/* ===================================================================
   8. ARRANQUE
   =================================================================== */
ponIconos();
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
  const ajusta = () => { const r = pantalla.getBoundingClientRect(); mundo.tamano(r.width, r.height); };
  new ResizeObserver(ajusta).observe(pantalla); ajusta();
  mundo.aspecto(M.ASPECTOS[progreso.aspecto] || M.ASPECTOS.clasico); aspectoMostrado = progreso.aspecto;
  const inicio = estacionVisual(M.ESTACIONES[0]);
  mundo.activa(inicio, 0);
  pantalla.dataset.estilo = inicio.estilo;
  // en la portada se ve la vía con los primeros trenes de una pista cualquiera
  const vitrina = M.crearGenerador(2026);
  for (const o of vitrina.generarHasta(200, { V: 13 })) if (o.tipo !== 'moneda' && o.d0 > 30) mundo.nuevo(o);
  estado = 'portada';
  pintaPortada(); muestraCapa('capaPortada');
  if (Club) Club.category('club-metrorush-carrera');
  sonido.tocaTema('metrorush-barrio');
  requestAnimationFrame(t => { prevT = t; cuadro(t); });
  // se precarga el kit de la segunda estación cuando el navegador esté libre
  setTimeout(() => mundo.precarga(estacionVisual(M.ESTACIONES[1])), 4000);
}
window.addEventListener('club-record', e => {                    // el récord de la nube, por si es mayor que el de aquí
  const d = e.detail; if (!d) return;
  if (d.categoria === 'club-metrorush-carrera' && d.puntos > progreso.records.puntos) { progreso.records.puntos = d.puntos; pintaPortada(); }
  if (d.categoria === 'club-metrorush-distancia' && d.puntos > progreso.records.distancia) { progreso.records.distancia = d.puntos; pintaPortada(); }
});
// Para probar desde la consola o desde un script: estado, saltar a puntos, etc.
/* Los que cambian la carrera (puntos, teclas, poderes, inmortal, adelantar
   el tiempo) la vuelven una partida de prueba: se juega igual, pero ya no va
   a la clasificación (ver «la prueba de la carrera»). */
const toca = () => { tocada = true; if (c) c.tocada = true; };
window.__metrorush = {
  estado: () => ({ estado, puntos: c && c.puntos, D: c && c.D, V: c && c.V, estacion: c && c.estacion.nombre, info: mundo && mundo.info() }),
  puntos: n => { toca(); if (c) c.puntos = n; },
  pulsa: a => { toca(); pedidos.push(a); },
  poder: k => { toca(); return c && activaPoder(k); },
  inmortal: (s = 9999) => { toca(); if (c) c.invulnerable = s; },
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
