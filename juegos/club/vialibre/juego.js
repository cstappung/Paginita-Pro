/* Vía Libre — el juego (la carrera, los controles, el marcador y los menús).

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
import { crearMundo, PALETAS } from './mundo.js?v=vialibre-1';
import { Sonido } from './audio.js?v=vialibre-1';

const M = window.ViaLibreMotor;                               // el motor (motor.js)
const Club = window.Club || null;                             // la conexión con la sección Juegos (puede faltar)
const F = M.FISICA;                                           // las constantes de la física
const $ = id => document.getElementById(id);                  // atajo para buscar en la página
const fmt = n => Math.floor(n).toLocaleString('es-CL');       // 128450 → "128.450"

/* ===================================================================
   1. GUARDADO: progreso (cuenta) y opciones (este aparato)
   =================================================================== */
const CLAVE = Club && Club.storageKey ? Club.storageKey('vialibre.progreso') : 'vialibre.progreso';
const CLAVE_OPC = 'vialibre.opciones';
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
let estado = 'cargando';      // cargando | portada | jugando | pausa | muerte | fin
let c = null;                 // los datos de la carrera en curso (ver nuevaCarrera)
let panel = null;             // el panel abierto (tienda, retos, libreta, opciones, ayuda, relato)

function nuevaCarrera() {
  const semilla = (Math.random() * 2 ** 31) >>> 0;
  return {
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
    seguirVeces: 0, muerte: null, recordAvisado: false, finalizada: false, quieto: 0
  };
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
  if (e.code === 'KeyP' || e.code === 'Escape') { if (estado === 'jugando') pausar(); else if (estado === 'pausa' && !panel) seguirJugando(); else if (panel) cierraPanel(); e.preventDefault(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && estado === 'portada' && !panel) { e.preventDefault(); empezar(); return; }
  const a = TECLA[e.code];
  if (!a || estado !== 'jugando') return;
  e.preventDefault();
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

/** Qué hay bajo los pies del corredor en (x, D) estando a la altura y:
    el suelo (0), una rampa (sube de 0 al techo) o el techo de un tren. */
function soporte(x, D, y) {
  let h = 0, tren = null;
  for (const o of c.activos) {
    if (o.tipo !== 'tren' && o.tipo !== 'rampa') continue;
    if (D < o.d0 - 0.2 || D > o.d0 + o.largo + 0.2) continue;   // no está a mi altura en la pista
    if (Math.abs(x - M.CARRILES[o.carril]) > 1.05) continue;    // no está en mi carril
    if (o.tipo === 'rampa') {
      const hs = M.ALTO_TECHO * Math.max(0, Math.min(1, (D - o.d0) / o.largo));
      if (y >= hs - 0.7 && hs > h) h = hs;
    } else if (y >= M.ALTO_TECHO - 0.5 && M.ALTO_TECHO >= h) { h = M.ALTO_TECHO; tren = o; }
  }
  return { h, tren };
}
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

/** El alto que ocupa cada obstáculo [abajo, arriba] y su medio ancho. */
function caja(o) {
  if (o.tipo === 'tren') return { z0: o.d0, z1: o.d0 + o.largo, y0: 0, y1: M.ALTO_TECHO, w: 0.98 };
  if (o.tipo === 'bajo') return { z0: o.d - 0.12, z1: o.d + 0.12, y0: 0, y1: 0.95, w: 0.95 };
  if (o.tipo === 'alto') return { z0: o.d - 0.12, z1: o.d + 0.12, y0: 1.0, y1: 2.35, w: 0.95 };
  if (o.tipo === 'rampa') { const hs = M.ALTO_TECHO * Math.max(0, Math.min(1, (c.D - o.d0) / o.largo)); return { z0: o.d0, z1: o.d0 + o.largo, y0: 0, y1: hs - 0.6, w: 0.95 }; }
  return null;
}
function choques() {
  const r = c.r;
  if (c.poderes.mochila > 0 || r.y > 6) return;                // volando, por encima de todo
  const yb = r.y + 0.02, yt = r.y + (r.rodar > 0 ? F.altoRodando : F.altoDePie);
  for (const o of c.activos) {
    const k = caja(o);
    if (!k || k.y1 <= k.y0) continue;
    if (c.D + 0.3 < k.z0 || c.D - 0.3 > k.z1) continue;          // no está a mi altura en la pista
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
  estado = 'muerte';
  c.muerte = { t: 0, motivo };
  /* Un choque de frente para en seco, y medio metro hacia atrás (el rebote):
     si se frenara de a poco, el corredor seguía 2 m más y quedaba tirado
     DETRÁS de la barrera con la que chocó, tapado por ella. Si te atrapan
     no hubo choque, así que ahí sí se frena de a poco. */
  if (motivo !== 'atrapado') { c.V = 0; c.D = Math.max(0, c.D - 0.35); }
  c.perseguidorObj = 1;
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
    else if (o.tipo === 'poder') { activaPoder(o.clase); mundo.chispa(r.x, r.y + 1.2, 0, 0xffffff); }
    else if (o.tipo === 'estrella') {
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
const multiplicador = () => M.multiplicador({ base: progreso.retos.nivel, estrellas: c.estrellas, doble: c.poderes.doble > 0 });

/* ---- el paso de una carrera ---- */
function actualiza(dt) {
  c.t += dt;
  const muriendo = estado === 'muerte';
  c.V = muriendo ? Math.max(0, c.V - 60 * dt) : M.velocidad(c.t);
  const dD = c.V * dt;
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
    recoge(dt);
    // los poderes se gastan
    for (const k of Object.keys(c.poderes)) if (c.poderes[k] > 0) {
      c.poderes[k] = Math.max(0, c.poderes[k] - dt);
      if (c.poderes[k] === 0 && k === 'mochila') { sonido.mochila(false); c.invulnerable = Math.max(c.invulnerable, 2); }
    }
    if (c.invulnerable > 0) c.invulnerable -= dt;
    if (c.tropiezo > 0) { c.tropiezo -= dt; if (c.tropiezo <= 0) c.perseguidorObj = 0; }
    if (c.introPersecucion > 0) { c.introPersecucion -= dt; if (c.introPersecucion <= 0 && c.tropiezo <= 0) c.perseguidorObj = 0; }
    estaciones();
    retosEnVivo(dt);
  } else {
    c.muerte.t += Math.max(dt, dtRealUltimo);                     // en un aparato lento la pausa tras el choque no se alarga
    if (c.muerte.t > 1.4 && estado === 'muerte') muestraFin();
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
      if (cb.estacion.boleto && !progreso.boletos.includes(cb.estacion.boleto)) c.gen.pedirBoleto(cb.estacion.boleto, o.d0 + o.largo + 260);
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
    c.avisados.add(i); sonido.reto(); aviso('Reto cumplido: ' + lista[i].texto);
  }
}

/* ===================================================================
   4. EL CICLO DE LA PARTIDA (empezar, pausa, fin, seguir)
   =================================================================== */
function empezar() {
  sonido.iniciar();
  if (!progreso.intro) { abreRelato(); return; }               // la primera vez se cuenta de qué se trata
  cierraPanel();
  c = nuevaCarrera();
  mundo.reinicia();
  const e = estacionVisual(c.estacion);
  mundo.activa(e, 0);
  pantalla.dataset.estilo = e.estilo;
  for (const o of c.gen.generarHasta(230, { V: c.V })) c.activos.push(o);
  if (!progreso.boletos.includes(1)) c.gen.pedirBoleto(1, 420);
  estado = 'jugando';
  muestraCapa(null);
  $('hud').hidden = false;
  sonido.tocaTema(c.estacion.musica);
  banner(c.estacion.nombre, c.estacion.lema);
  if (esTactil && progreso.totales.carreras < 3) aviso('Desliza el dedo: ← → carril · ↑ saltar · ↓ rodar');
  if (Club) Club.category('club-vialibre-carrera');
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
function muestraFin() {
  estado = 'fin';
  sonido.calla();
  const motivos = { atrapado: 'Don Ramón te atrapó', tren: 'Te atropelló un tren', bajo: 'Chocaste con una barrera', alto: 'Te diste con un letrero', rampa: 'Chocaste con una rampa' };
  $('finTitulo').textContent = c.puntos > progreso.records.puntos && progreso.records.puntos > 0 ? '¡Nuevo récord!' : motivos[c.muerte.motivo] || 'Fin de la carrera';
  $('finStats').innerHTML = [
    ['Puntos', fmt(c.puntos)], ['Distancia', fmt(c.D) + ' m'], ['Monedas', fmt(c.monedas)],
    ['Multiplicador', '×' + multiplicador()], ['Estación', c.estacion.nombre], ['Récord', fmt(Math.max(progreso.records.puntos, c.puntos))]
  ].map(([a, b]) => `<div><dt>${a}</dt><dd translate="no">${b}</dd></div>`).join('');
  const costo = M.costoSeguir(c.seguirVeces), btn = $('btnSeguir');
  btn.hidden = progreso.monedas + c.monedas < costo;
  btn.textContent = `Seguir corriendo (${fmt(costo)} monedas)`;
  pintaRetos($('finRetos'), true);
  muestraCapa('capaFin');
}
/** Sigue la misma carrera después de chocar, pagando monedas. */
function seguirTrasChoque() {
  const costo = M.costoSeguir(c.seguirVeces);
  if (c.monedas + progreso.monedas < costo) return;              // no alcanza (el botón ni se muestra, pero por si acaso)
  const deCarrera = Math.min(c.monedas, costo);                  // primero se paga con las monedas de esta carrera…
  c.monedas -= deCarrera; progreso.monedas -= costo - deCarrera; // …y el resto con las guardadas
  c.seguirVeces++; guardar();
  // se despeja la vía alrededor y hay unos segundos de protección
  // (se mira dónde termina cada cosa, no solo dónde empieza: un convoy largo que empezó atrás seguiría debajo de ti)
  for (let i = c.activos.length - 1; i >= 0; i--) {
    const o = c.activos[i], d0 = o.d != null ? o.d : o.d0, d1 = d0 + (o.largo || 0);
    if (d1 > c.D - 15 && d0 < c.D + 60 && o.tipo !== 'moneda' && o.tipo !== 'tunel') { mundo.suelta(o); c.activos.splice(i, 1); }
  }
  c.r.y = c.r.suelo = 0; c.r.vy = 0; c.r.enAire = false; c.r.rodar = 0;
  c.invulnerable = 3; c.tropiezo = 0; c.perseguidorObj = 0; c.muerte = null;
  estado = 'jugando'; muestraCapa(null);
  sonido.seguir(); sonido.tocaTema(c.estacion.musica);
  prevT = performance.now();
}
/** Cierra la carrera: suma monedas, récords y retos, guarda y avisa a la clasificación. */
function cierraCarrera() {
  if (!c || c.finalizada) return;
  c.finalizada = true;
  const puntos = Math.floor(c.puntos), metros = Math.floor(c.D), ms = Math.max(1, Math.round(c.t * 1000));   // las reglas piden enteros y un tiempo de al menos 1 ms
  progreso.monedas += c.monedas;
  progreso.totales.carreras++; progreso.totales.metros += metros; progreso.totales.monedas += c.monedas;
  const recordDist = metros > progreso.records.distancia;
  progreso.records.puntos = Math.max(progreso.records.puntos, puntos);
  progreso.records.distancia = Math.max(progreso.records.distancia, metros);
  progreso.records.monedas = Math.max(progreso.records.monedas, c.monedas);
  const res = M.avanzaRetos(progreso.retos, c.cuenta, true);
  progreso.retos = res.retos;
  guardar();
  if (res.subio) { sonido.multiplicador(); aviso(`¡Retos cumplidos! Multiplicador base ×${progreso.retos.nivel}`); }
  // a la clasificación: la carrera siempre (cuenta como partida del club); la distancia, solo si es récord
  if (Club && Club.result && puntos >= 1) {
    Club.result({ categoria: 'club-vialibre-carrera', puntos: Math.min(1e9, puntos), tiempo: ms });
    if (recordDist && metros >= 1) Club.result({ categoria: 'club-vialibre-distancia', puntos: Math.min(1e6, metros), tiempo: ms });
  }
}
function aPortada() {
  cierraCarrera();
  estado = 'portada'; c = null;
  $('hud').hidden = true;
  mundo.reinicia(); mundo.activa(estacionVisual(M.ESTACIONES[0]), 0);
  pantalla.dataset.estilo = estacionVisual(M.ESTACIONES[0]).estilo;
  sonido.tocaTema('vialibre-barrio');
  pintaPortada(); muestraCapa('capaPortada');
}
function otraCarrera() { cierraCarrera(); empezar(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (estado === 'jugando') pausar(); if (estado === 'fin') cierraCarrera(); }
});
window.addEventListener('pagehide', () => { if (estado === 'fin' || estado === 'pausa') cierraCarrera(); });

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
  // lo que el mundo necesita para dibujar este cuadro
  const r = c ? c.r : null;
  const pose = !c ? { modo: 'quieto', fase: tiempoTotal * 3 }
    : estado === 'muerte' || (estado === 'fin' && c.muerte) ? { modo: 'caer', t: c.muerte ? c.muerte.t : 1 }
      : r.tropezarT >= 0 ? { modo: 'tropezar', t: r.tropezarT, fase: r.fase, ladeo: r.ladeo }
        : c.poderes.mochila > 0 ? { modo: 'volar', fase: r.fase }
          : r.rodar > 0 ? { modo: 'rodar', t: F.tiempoRodar - r.rodar }
            : r.enAire ? { modo: 'saltar', vy: r.vy, ladeo: r.ladeo }
              : { modo: 'correr', fase: r.fase, ladeo: r.ladeo };
  mundo.paso({
    D: c ? c.D : 0, x: r ? r.x : 0, y: r ? r.y : 0, suelo: r ? r.suelo : 0, v: c ? c.V : 0, dt, t: tiempoTotal, pose,
    poderes: c ? { iman: c.poderes.iman > 0, mochila: c.poderes.mochila > 0, zapatillas: c.poderes.zapatillas > 0, patineta: c.poderes.patineta > 0 } : {},
    perseguidor: c ? c.perseguidor : 0
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
function pintaHud(dt) {
  ponTexto('hudPuntos', fmt(c.puntos));
  ponTexto('hudMult', '×' + multiplicador());
  ponTexto('hudMetros', fmt(c.D) + ' m');
  ponTexto('hudMonedas', fmt(c.monedas));
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
    lista.push(`<li class="p-${kk}"><b>${kk === 'patineta' ? '🛹' : M.PODERES[kk].icono}</b><span><i style="--k:${(v / total).toFixed(3)}"></i></span></li>`);
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
function muestraCapa(id) {
  for (const el of document.querySelectorAll('.capa')) el.hidden = el.id !== id;
}
function abrePanel(id) { panel = id; for (const el of document.querySelectorAll('.capa')) el.hidden = el.id !== id; }
function cierraPanel() {
  if (!panel) return;
  panel = null;
  muestraCapa(estado === 'pausa' ? 'capaPausa' : estado === 'fin' ? 'capaFin' : estado === 'portada' ? 'capaPortada' : null);
}
function pintaPortada() {
  $('records').innerHTML = `Récord <b translate="no">${fmt(progreso.records.puntos)}</b> · Distancia <b translate="no">${fmt(progreso.records.distancia)} m</b> · Multiplicador base <b translate="no">×${progreso.retos.nivel}</b>`;
  ponTexto('barRecord', fmt(progreso.records.puntos));
  ponTexto('barMonedas', fmt(progreso.monedas));
  ponTexto('barMult', '×' + progreso.retos.nivel);
  pintaRetos($('portadaRetos'), false);
}
/** Los tres retos con su barra de avance (en la portada, en el panel y en el fin). */
function pintaRetos(el, conCarrera) {
  const lista = M.retosDeNivel(progreso.retos.nivel);
  const vivo = conCarrera && c ? M.avanzaRetos(progreso.retos, c.cuenta, false).retos.avance : progreso.retos.avance;
  el.innerHTML = lista.map((r, i) => {
    const v = Math.min(r.meta, vivo[i]), ok = v >= r.meta;
    return `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✔ ' : ''}${r.texto}</span><i style="--k:${(v / r.meta).toFixed(3)}"></i><small translate="no">${fmt(v)} / ${fmt(r.meta)}</small></li>`;
  }).join('');
}
function abreRetos() {
  $('retosNivel').textContent = `Multiplicador base: ×${progreso.retos.nivel}` + (progreso.retos.nivel >= M.MAX_BASE ? ' (el máximo)' : ` · cumple los tres para llegar a ×${progreso.retos.nivel + 1}`);
  pintaRetos($('listaRetos'), false);
  abrePanel('capaRetos');
}
function abreTienda() { pintaTienda(); abrePanel('capaTienda'); }
function pintaTienda() {
  $('tiendaMonedas').textContent = fmt(progreso.monedas);
  $('tiendaPoderes').innerHTML = Object.entries(M.PODERES).map(([k, p]) => {
    const n = progreso.mejoras[k], precio = M.precioMejora(n);
    const barras = Array.from({ length: M.MAX_MEJORA }, (_, i) => `<i class="${i < n ? 'si' : ''}"></i>`).join('');
    return `<li><b>${p.icono}</b><div><strong>${p.nombre}</strong><small>${M.duracionPoder(k, n)} s${precio ? ` → ${M.duracionPoder(k, n + 1)} s` : ''}</small><span class="niveles">${barras}</span></div>
      <button type="button" class="opcion" data-comprar="${k}" ${precio == null || progreso.monedas < precio ? 'disabled' : ''}>${precio == null ? 'Al máximo' : fmt(precio) + ' 🪙'}</button></li>`;
  }).join('') + `<li><b>🛹</b><div><strong>Patineta</strong><small>Tienes ${progreso.patinetas}. Te salva de un choque (30 s).</small></div>
      <button type="button" class="opcion" data-comprar="patineta" ${progreso.monedas < M.PRECIO_PATINETA ? 'disabled' : ''}>${M.PRECIO_PATINETA} 🪙</button></li>`;
  $('tiendaAspectos').innerHTML = Object.entries(M.ASPECTOS).map(([k, a]) => {
    const tiene = progreso.aspectos.includes(k), puesto = progreso.aspecto === k;
    const muestra = `<span class="muestra" style="--a:#${a.sudadera.toString(16).padStart(6, '0')};--b:#${a.gorra.toString(16).padStart(6, '0')};--c:#${a.mochila.toString(16).padStart(6, '0')}"></span>`;
    const accion = puesto ? '<button type="button" class="opcion" disabled>Puesto</button>'
      : tiene ? `<button type="button" class="opcion" data-poner="${k}">Ponerme</button>`
        : a.precio != null ? `<button type="button" class="opcion" data-aspecto="${k}" ${progreso.monedas < a.precio ? 'disabled' : ''}>${fmt(a.precio)} 🪙</button>`
          : `<small class="secreto">🔒 ${a.secreto}</small>`;
    return `<li>${muestra}<div><strong>${a.nombre}</strong></div>${accion}</li>`;
  }).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  sonido.iniciar();
  if (b.dataset.comprar) {
    const k = b.dataset.comprar;
    if (k === 'patineta') { if (progreso.monedas >= M.PRECIO_PATINETA) { progreso.monedas -= M.PRECIO_PATINETA; progreso.patinetas++; sonido.poder(); } }
    else { const p = M.precioMejora(progreso.mejoras[k]); if (p != null && progreso.monedas >= p) { progreso.monedas -= p; progreso.mejoras[k]++; sonido.poder(); } }
    guardar(); pintaTienda(); pintaPortada(); return;
  }
  if (b.dataset.aspecto) { const a = M.ASPECTOS[b.dataset.aspecto]; if (a && a.precio != null && progreso.monedas >= a.precio) { progreso.monedas -= a.precio; progreso.aspectos.push(b.dataset.aspecto); progreso.aspecto = b.dataset.aspecto; mundo.aspecto(a); sonido.poder(); guardar(); pintaTienda(); pintaPortada(); } return; }
  if (b.dataset.poner) { progreso.aspecto = b.dataset.poner; mundo.aspecto(M.ASPECTOS[b.dataset.poner]); guardar(); pintaTienda(); return; }
  const accion = b.dataset.accion;
  if (!accion) return;
  ({
    jugar: empezar, otra: otraCarrera, portada: aPortada, seguir: seguirJugando, seguirChoque: seguirTrasChoque,
    abandonar: () => { muere('abandono'); c.muerte.t = 2; muestraFin(); },
    tienda: abreTienda, retos: abreRetos, libreta: abreLibreta, opciones: abreOpciones, ayuda: () => abrePanel('capaAyuda'),
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
  mundo.aspecto(M.ASPECTOS[progreso.aspecto] || M.ASPECTOS.clasico);
  const inicio = estacionVisual(M.ESTACIONES[0]);
  mundo.activa(inicio, 0);
  pantalla.dataset.estilo = inicio.estilo;
  // en la portada se ve la vía con los primeros trenes de una pista cualquiera
  const vitrina = M.crearGenerador(2026);
  for (const o of vitrina.generarHasta(200, { V: 13 })) if (o.tipo !== 'moneda' && o.d0 > 30) mundo.nuevo(o);
  estado = 'portada';
  pintaPortada(); muestraCapa('capaPortada');
  if (Club) Club.category('club-vialibre-carrera');
  sonido.tocaTema('vialibre-barrio');
  requestAnimationFrame(t => { prevT = t; cuadro(t); });
  // se precarga el kit de la segunda estación cuando el navegador esté libre
  setTimeout(() => mundo.precarga(estacionVisual(M.ESTACIONES[1])), 4000);
}
window.addEventListener('club-record', e => {                    // el récord de la nube, por si es mayor que el de aquí
  const d = e.detail; if (!d) return;
  if (d.categoria === 'club-vialibre-carrera' && d.puntos > progreso.records.puntos) { progreso.records.puntos = d.puntos; pintaPortada(); }
  if (d.categoria === 'club-vialibre-distancia' && d.puntos > progreso.records.distancia) { progreso.records.distancia = d.puntos; pintaPortada(); }
});
// Para probar desde la consola o desde un script: estado, saltar a puntos, etc.
window.__vialibre = {
  estado: () => ({ estado, puntos: c && c.puntos, D: c && c.D, V: c && c.V, estacion: c && c.estacion.nombre, info: mundo && mundo.info() }),
  puntos: n => { if (c) c.puntos = n; },
  pulsa: a => pedidos.push(a),
  poder: k => c && activaPoder(k),
  inmortal: (s = 9999) => { if (c) c.invulnerable = s; },
  empezar, progreso: () => progreso,
  /** Adelanta `seg` segundos de juego sin dibujar (para probar túneles y estaciones desde un script). */
  avanza: (seg = 5) => { for (let i = 0; i < seg * 60 && estado === 'jugando'; i++) { actualiza(1 / 60); tiempoTotal += 1 / 60; } }
};
arranca();
