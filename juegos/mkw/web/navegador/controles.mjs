// Controles del juego en la página: teclado, mandos (Gamepad API) y celular (mando táctil + inclinar para dirigir).
// (Para el salón de Juegos —build-controles.js del sitio—: @controles: teclado . Sale para el PC, con teclado o mando;
// lo táctil existe pero los celulares quedan fuera del lanzamiento, decisión del dueño 2026-10-19.)
//
// Resumen: el juego solo entiende mandos de GameCube (4 puertos). Este módulo junta todo lo que el jugador usa y,
// una vez por refresco de pantalla, arma el estado de un mando de GameCube por puerto y se lo entrega al juego con
// `enviar(puerto, conectado, botones, sx, sy, cx, cy, gl, gr)` (en la página real es Module._mkw_web_pad, ver
// web/navegador/pad_web.cpp). No sabe nada del juego: por eso se prueba solo en el banco (banco/pruebas/controles).
//
//   - Teclado → puerto 1. Mapeo por defecto pensado para Mario Kart, cambiable y guardado en el navegador.
//   - Mandos → el primero comparte el puerto 1 con el teclado; los siguientes van a los puertos 2, 3 y 4.
//     Mapeo "standard" del navegador (Xbox/PlayStation/Switch Pro/genéricos), zona muerta ajustable, gatillos
//     analógicos; disposición «por letra» para los de Nintendo (A a la derecha) y asignación propia por mando (para
//     adaptadores de GameCube y mandos sin mapeo estándar), todo guardado en el navegador ("mkw.mandos").
//   - Táctil (celular) → puerto 1: stick a la izquierda y botones a la derecha, cada dedo por separado.
//   - Inclinar el teléfono (como el Wii Wheel) → mueve el stick a izquierda/derecha del puerto 1 (opcional).
//   - Vibración: el juego la pide con vibrar(puerto, cmd); va al mando (vibrationActuator) o al celular.

// ---- Botones de GameCube (los mismos bits que dolphin/pad.h) ----
export const BOTON = {
  izquierda: 0x0001, derecha: 0x0002, abajo: 0x0004, arriba: 0x0008,   // cruz (en MKW: truco = cruz arriba)
  Z: 0x0010, R: 0x0020, L: 0x0040, A: 0x0100, B: 0x0200, X: 0x0400, Y: 0x0800, START: 0x1000,
};

// ---- Teclado: acción → teclas (KeyboardEvent.code: la tecla física, no la letra; así sirve en cualquier idioma) ----
export const ACCIONES = [
  // [id,            nombre que ve el jugador,             teclas por defecto]
  ['stickArriba',    'Stick arriba',                       ['KeyW', 'ArrowUp']],
  ['stickAbajo',     'Stick abajo',                        ['KeyS', 'ArrowDown']],
  ['stickIzquierda', 'Stick izquierda (girar)',            ['KeyA', 'ArrowLeft']],
  ['stickDerecha',   'Stick derecha (girar)',              ['KeyD', 'ArrowRight']],
  ['A',              'A — acelerar / aceptar',             ['KeyK', 'Enter']],
  ['B',              'B — frenar, marcha atrás / volver',  ['KeyJ', 'Backspace']],
  ['R',              'R — derrapar / saltar',              ['KeyL', 'ShiftLeft']],
  ['L',              'L — usar objeto',                    ['Space', 'KeyI']],
  ['arriba',         'Cruz arriba — truco',                ['KeyT']],
  ['abajo',          'Cruz abajo',                         ['KeyG']],
  ['izquierda',      'Cruz izquierda',                     ['KeyF']],
  ['derecha',        'Cruz derecha',                       ['KeyH']],
  ['X',              'X — mirar atrás',                    ['KeyU']],
  ['Y',              'Y',                                  ['KeyO']],
  ['Z',              'Z',                                  ['KeyN']],
  ['START',          'Start — pausa',                      ['KeyP', 'Escape']],
];
const CLAVE_TECLAS = 'mkw.teclas';
const CLAVE_TACTIL = 'mkw.tactil';
const leer = clave => { try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };

// ---- Mandos: botones del mapeo "standard" (https://w3c.github.io/gamepad/#remapping) → GameCube ----
// 0 abajo (Xbox A / PS ✕) · 1 derecha (B / ○) · 2 izquierda (X / □) · 3 arriba (Y / △) · 4 LB · 5 RB · 6 LT · 7 RT
// 8 Back · 9 Start · 10/11 clic de sticks · 12-15 cruz (arriba, abajo, izquierda, derecha)
const MANDO_BOTONES = [
  [0, BOTON.A], [1, BOTON.B], [2, BOTON.X], [3, BOTON.Y],
  [4, BOTON.L], [5, BOTON.Z],                       // LB = objeto (L digital), RB = Z
  [9, BOTON.START], [8, BOTON.START],
  [12, BOTON.arriba], [13, BOTON.abajo], [14, BOTON.izquierda], [15, BOTON.derecha],
];
// Los mandos de Nintendo (Switch Pro, Joy-Con) tienen las letras cambiadas de lugar: la A está a la DERECHA (donde
// Xbox tiene B) y la B abajo. El navegador numera por POSICIÓN (0 = el de abajo), así que con un Switch Pro la "A"
// de la etiqueta llegaría como B. Con la disposición «por letra» se cruzan: 1 (derecha, «A») → A, 0 (abajo, «B»)
// → B, 3 (arriba, «X») → X, 2 (izquierda, «Y») → Y. «Automático» la usa solo si el mando es de Nintendo.
const MANDO_LETRA = [[1, BOTON.A], [0, BOTON.B], [3, BOTON.X], [2, BOTON.Y], ...MANDO_BOTONES.slice(4)];
// Qué mando es, por su nombre (el navegador pone el fabricante: 057e Nintendo, 054c Sony, 045e Microsoft)
export function tipoMando(id = '') {
  const s = id.toLowerCase();
  if (/0079.{0,12}1846|mayflash|gamecube|057e.{0,12}0337/.test(s)) return 'gamecube';
  if (/057e|nintendo|pro controller|joy-con/.test(s)) return 'nintendo';
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(s)) return 'playstation';
  if (/045e|xbox|xinput/.test(s)) return 'xbox';
  return 'generico';
}
export const NOMBRE_TIPO = { nintendo: 'Nintendo (Switch Pro / Joy-Con)', playstation: 'PlayStation', xbox: 'Xbox', gamecube: 'GameCube (adaptador)', generico: 'Mando genérico' };
// Los botones de GameCube que se pueden asignar a mano (para mandos raros o gustos propios), en orden del asistente
export const ASIGNABLES = [['A', 'A — acelerar'], ['B', 'B — frenar'], ['R', 'R — derrapar'], ['L', 'L — objeto'], ['X', 'X — mirar atrás'],
  ['Y', 'Y'], ['Z', 'Z'], ['START', 'Start — pausa'], ['arriba', 'Cruz arriba — truco'], ['abajo', 'Cruz abajo'], ['izquierda', 'Cruz izquierda'], ['derecha', 'Cruz derecha']];
const CLAVE_MANDOS = 'mkw.mandos';
const PREFS_MANDOS = { disposicion: 'auto', zona: 15, vibrar: true, propios: {} };   // zona muerta en %

// stick del navegador (−1..1, +y = ABAJO) → stick de GameCube (−128..127, +y = ARRIBA), con zona muerta redonda
// (un stick suelto nunca marca 0 exacto: por debajo de la zona muerta se toma como centro; por defecto 15 %)
function aStickGC(x, y, zona = 0.15) {
  const r = Math.hypot(x, y);
  if (r < zona) return [0, 0];
  const k = Math.min(1, (r - zona) / (1 - zona)) / r;                 // reescala para que siga llegando a 1
  return [Math.round(x * k * 127), Math.round(-y * k * 127)];
}
const recorta = v => Math.max(-128, Math.min(127, Math.round(v)));

export function crearControles({ enviar, objetivoTeclado = window, contenedorTactil = null, alCambiar = null } = {}) {
  // --- estado de cada fuente ---
  const teclasApretadas = new Set();              // KeyboardEvent.code de las teclas apretadas ahora
  let teclas = Object.fromEntries(ACCIONES.map(([id, , def]) => [id, def]));
  Object.assign(teclas, leer(CLAVE_TECLAS) || {});   // lo que el jugador cambió
  const tactil = { activo: false, sx: 0, sy: 0, botones: 0 };
  const inclinacion = { activa: false, centro: null, x: 0 };
  const piloto = { botones: 0 };                  // la página aprieta botones sola (menus.mjs: ir a una copa/pista)
  let silencio = false;                           // true = el juego no recibe nada de la persona (menú de inicio)
  let cerrojo = null;                             // §94: función que dice si AHORA lo de la persona no va al juego (la sala)
  let filtro = null;                              // §99: función que dice qué botones de la persona NO van al juego ahora (la sala)
  let sinMandos = null;                           // §100: función que dice si AHORA los mandos son de la página (el cursor del sitio)
  let esperandoTecla = null;                      // acción que se está reasignando (la próxima tecla va ahí)
  const puertosMando = new Map();                 // índice del Gamepad → puerto (0..3)
  const ultimo = [];                              // lo último enviado por puerto (para no repetir)
  const estado = { puertos: [], mandos: [] };     // para mostrar en pantalla y para las pruebas
  const prefsMandos = { ...PREFS_MANDOS, ...(leer(CLAVE_MANDOS) || {}) };   // disposición, zona muerta, vibrar, asignaciones
  let asignando = null;                           // { id, boton, antes:Set, listo } mientras el asistente espera un botón

  // --- teclado ---
  const teclasEnUso = () => new Set(Object.values(teclas).flat());
  const alBajar = e => {
    if (esperandoTecla) {                         // reasignando: esta tecla pasa a ser de esa acción
      e.preventDefault();
      if (e.code !== 'Escape') {
        for (const id of Object.keys(teclas)) teclas[id] = teclas[id].filter(c => c !== e.code);   // sin repetidas
        teclas[esperandoTecla] = [e.code];
        guardar(CLAVE_TECLAS, teclas);
      }
      esperandoTecla = null;
      alCambiar && alCambiar();
      return;
    }
    if (teclasEnUso().has(e.code)) {
      e.preventDefault();                         // que flechas y espacio no muevan la página
      teclasApretadas.add(e.code);
    }
  };
  const alSubir = e => teclasApretadas.delete(e.code);
  const alPerderFoco = () => teclasApretadas.clear();   // si la ventana pierde el foco, se sueltan todas
  objetivoTeclado.addEventListener('keydown', alBajar);
  objetivoTeclado.addEventListener('keyup', alSubir);
  window.addEventListener('blur', alPerderFoco);
  const accion = id => teclas[id].some(c => teclasApretadas.has(c));

  function leerTeclado() {
    let botones = 0;
    for (const [id] of ACCIONES) if (BOTON[id] && accion(id)) botones |= BOTON[id];
    const sx = (accion('stickDerecha') ? 127 : 0) - (accion('stickIzquierda') ? 128 : 0);
    const sy = (accion('stickArriba') ? 127 : 0) - (accion('stickAbajo') ? 128 : 0);
    // el teclado no tiene gatillos analógicos: L o R apretados = gatillo a fondo (como el clic de la GameCube)
    return { botones, sx, sy, gl: botones & BOTON.L ? 255 : 0, gr: botones & BOTON.R ? 255 : 0, activo: teclasApretadas.size > 0 };
  }

  // --- mandos (Gamepad API) ---
  function leerMandos() {
    const lista = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
    for (const idx of [...puertosMando.keys()]) if (!lista.some(g => g.index === idx)) puertosMando.delete(idx);
    for (const g of lista) {                      // un mando nuevo va al primer puerto libre
      if (puertosMando.has(g.index)) continue;
      const usados = new Set(puertosMando.values());
      const libre = [0, 1, 2, 3].find(p => !usados.has(p));
      if (libre !== undefined) puertosMando.set(g.index, libre);
    }
    const zona = Math.min(0.4, Math.max(0.03, prefsMandos.zona / 100));
    return lista.map(g => {
      const tipo = tipoMando(g.id), propio = prefsMandos.propios[g.id];
      const letra = prefsMandos.disposicion === 'letra' || (prefsMandos.disposicion === 'auto' && tipo === 'nintendo');
      const apretado = i => !!(g.buttons[i] && g.buttons[i].pressed);
      const comun = { puerto: puertosMando.get(g.index), nombre: g.id, tipo, letra, propio: !!propio, sinMapa: g.mapping !== 'standard' && !propio, mando: g };
      // el asistente de asignar: el primer botón que se aprieta (y no estaba apretado al empezar) queda para ese botón
      if (asignando && asignando.id === g.id) {
        const i = g.buttons.findIndex((b, k) => b && b.pressed && !asignando.antes.has(k));
        if (i >= 0) {
          const listo = asignando.listo;
          prefsMandos.propios[g.id] = { ...(prefsMandos.propios[g.id] || {}), [asignando.boton]: i };
          guardar(CLAVE_MANDOS, prefsMandos); asignando = null; listo(i);
        }
        return { ...comun, botones: 0, sx: 0, sy: 0, cx: 0, cy: 0, gl: 0, gr: 0 };   // mientras asigna, el mando no maneja
      }
      let botones = 0, gl = 0, gr = 0;
      if (propio) {
        // asignación propia: cada botón de GameCube sale del botón del mando que se eligió (L y R con su valor analógico)
        for (const [nombre] of ASIGNABLES) if (propio[nombre] !== undefined && apretado(propio[nombre])) botones |= BOTON[nombre];
        const valor = i => i === undefined ? 0 : Math.round(255 * ((g.buttons[i] && g.buttons[i].value) || 0));
        gl = Math.max(valor(propio.L), botones & BOTON.L ? 255 : 0);
        gr = Math.max(valor(propio.R), botones & BOTON.R ? 255 : 0);
      } else {
        for (const [i, bit] of (letra ? MANDO_LETRA : MANDO_BOTONES)) if (apretado(i)) botones |= bit;
        gl = Math.round(255 * ((g.buttons[6] && g.buttons[6].value) || 0));   // LT/ZL analógico → L
        gr = Math.round(255 * ((g.buttons[7] && g.buttons[7].value) || 0));   // RT/ZR analógico → R (derrapar)
        if (gl > 128) botones |= BOTON.L;          // pasada la mitad, también cuenta el clic digital
        if (gr > 128) botones |= BOTON.R;
        if (apretado(4)) gl = 255;                 // LB / L (digital) = L a fondo
      }
      const [sx, sy] = aStickGC(g.axes[0] || 0, g.axes[1] || 0, zona);
      const [cx, cy] = aStickGC(g.axes[2] || 0, g.axes[3] || 0, zona);
      return { ...comun, botones, sx, sy, cx, cy, gl, gr };
    });
  }

  // --- vibración: el juego la pide por puerto ---
  const vibrando = new Set();
  function vibrar(puerto, cmd) {
    const on = cmd === 1;
    if (on === vibrando.has(puerto)) return;
    on ? vibrando.add(puerto) : vibrando.delete(puerto);
    for (const m of leerMandos()) {
      if (m.puerto !== puerto || !m.mando.vibrationActuator || (on && !prefsMandos.vibrar)) continue;
      if (on) m.mando.vibrationActuator.playEffect('dual-rumble', { duration: 5000, strongMagnitude: 0.8, weakMagnitude: 0.8 }).catch(() => {});
      else m.mando.vibrationActuator.reset().catch(() => {});
    }
    if (puerto === 0 && tactil.activo && navigator.vibrate && (prefsMandos.vibrar || !on)) navigator.vibrate(on ? 5000 : 0);
  }

  // --- inclinación (Wii Wheel): girar el teléfono acostado como un volante ---
  const alInclinar = e => {
    if (!inclinacion.activa || e.beta == null) return;
    // con el teléfono horizontal, "beta" es el giro de volante; se mide respecto de la posición al activar
    const angulo = screen.orientation && screen.orientation.angle === 270 ? -e.beta : e.beta;
    if (inclinacion.centro === null) inclinacion.centro = angulo;
    const grados = angulo - inclinacion.centro;
    inclinacion.x = Math.abs(grados) < 3 ? 0 : recorta((grados / 35) * 127);   // 35° = giro a fondo
  };
  window.addEventListener('deviceorientation', alInclinar);

  // --- mando táctil ---
  let tactilUI = null;
  const ajustesTactil = { esc: 1, opa: 1, ...(leer(CLAVE_TACTIL) || {}) };
  if (contenedorTactil) { tactilUI = crearTactil(contenedorTactil, tactil); tactilUI.ajustar(ajustesTactil); }

  // --- cada refresco: juntar todo y entregarlo ---
  function paso() {
    const kb = leerTeclado();
    const mandos = leerMandos();
    const puertos = [0, 1, 2, 3].map(p => ({ conectado: false, botones: 0, sx: 0, sy: 0, cx: 0, cy: 0, gl: 0, gr: 0, fuentes: [] }));
    const suma = (p, f, nombre) => {             // sumar una fuente a un puerto (botones con OR, sticks sumados)
      const d = puertos[p];
      d.conectado = true; d.fuentes.push(nombre);
      d.botones |= f.botones || 0;
      d.sx = recorta(d.sx + (f.sx || 0)); d.sy = recorta(d.sy + (f.sy || 0));
      d.cx = recorta(d.cx + (f.cx || 0)); d.cy = recorta(d.cy + (f.cy || 0));
      d.gl = Math.max(d.gl, f.gl || 0); d.gr = Math.max(d.gr, f.gr || 0);
    };
    suma(0, kb, 'teclado');                       // el puerto 1 siempre está conectado (teclado)
    // (§100: mientras el cursor del sitio maneja un menú de la página, los mandos no llegan al juego; el teclado sí)
    const mandosFuera = sinMandos ? !!sinMandos() : false;
    for (const m of mandos) if (m.puerto !== undefined && !mandosFuera) suma(m.puerto, m, m.nombre);
    if (tactil.activo) suma(0, { ...tactil, gl: tactil.botones & BOTON.L ? 255 : 0, gr: tactil.botones & BOTON.R ? 255 : 0 }, 'táctil');
    if (inclinacion.activa) suma(0, { sx: inclinacion.x }, 'inclinación');
    if (piloto.botones) suma(0, piloto, 'piloto');
    const callado = silencio || (cerrojo ? !!cerrojo() : false);
    puertos.forEach((d, p) => {
      // silenciado (el menú de inicio, inicio.mjs, está encima): al juego le llega solo lo del piloto; lo de la
      // persona lo lee el menú (estado.puertos y estado.mandos siguen al día), como un interruptor que corta la
      // salida pero deja el medidor conectado
      // §99: y los botones que la sala no deja pasar ahora (Start = la pausa del juego, que tiene «Salir»; B en la
      // primera pantalla de personajes = volver al menú): se borran de lo que se manda, como un relé que abre esa línea
      const quita = filtro ? (filtro() | 0) : 0;
      const s = callado ? { conectado: d.conectado, botones: p === 0 ? piloto.botones : 0, sx: 0, sy: 0, cx: 0, cy: 0, gl: 0, gr: 0 }
        : quita && (d.botones & quita) ? { ...d, botones: d.botones & ~quita } : d;
      const firma = [s.conectado, s.botones, s.sx, s.sy, s.cx, s.cy, s.gl, s.gr].join();
      if (firma === ultimo[p]) return;            // sin cambios: no hace falta volver a mandarlo
      ultimo[p] = firma;
      enviar(p, s.conectado ? 1 : 0, s.botones, s.sx, s.sy, s.cx, s.cy, s.gl, s.gr);
    });
    estado.puertos = puertos;
    estado.mandos = mandos.map(({ mando, ...resto }) => resto);
    if (tactilUI) tactilUI.pinta();
  }
  let vivo = true;
  const bucle = () => { if (!vivo) return; paso(); requestAnimationFrame(bucle); };
  requestAnimationFrame(bucle);

  return {
    estado, teclas, vibrar, paso,
    reenviar() { ultimo.length = 0; },
    // el piloto automático (menus.mjs) aprieta estos botones en el puerto 1, sumados a lo que haga la persona
    // (y lo manda enseguida: con la pestaña en segundo plano requestAnimationFrame no corre)
    pilotar(botones) { piloto.botones = botones | 0; paso(); },
    // el menú de inicio (inicio.mjs) está encima: lo que toca la persona es para el menú, no para el juego
    silenciar(si) { silencio = !!si; paso(); },
    // §94: lo mismo, pero preguntado en cada cuadro (la sala: después de los resultados de la carrera, para que A no
    // abra el menú de «carrera siguiente» del juego). null = sin cerrojo
    cerrojo(f) { cerrojo = typeof f === 'function' ? f : null; paso(); },
    // §99: filtro(f) = f() devuelve, en cada cuadro, los bits de botones que no llegan al juego (null = ninguno)
    filtro(f) { filtro = typeof f === 'function' ? f : null; paso(); },
    // §100: sinMandos(f) = f() dice, en cada cuadro, si los mandos son ahora de la página (mando-sitio.mjs; null = nunca)
    sinMandos(f) { sinMandos = typeof f === 'function' ? f : null; paso(); },
    get silenciado() { return silencio; },                           // volver a mandar todo (p. ej. al arrancar el juego)
    reasignar(id) { esperandoTecla = id; },                      // la próxima tecla queda para esa acción
    esperando: () => esperandoTecla,
    restaurarTeclas() { teclas = Object.fromEntries(ACCIONES.map(([id, , def]) => [id, def])); guardar(CLAVE_TECLAS, teclas); this.teclas = teclas; },
    teclasDe: id => teclas[id],
    // --- mandos: disposición de botones ('auto' | 'posicion' | 'letra'), zona muerta (%), vibrar, asignaciones propias ---
    prefsMandos: () => JSON.parse(JSON.stringify(prefsMandos)),
    ajustarMandos(cambios) {
      Object.assign(prefsMandos, cambios);
      prefsMandos.zona = Math.min(40, Math.max(3, Number(prefsMandos.zona) || 15));
      if (!['auto', 'posicion', 'letra'].includes(prefsMandos.disposicion)) prefsMandos.disposicion = 'auto';
      prefsMandos.vibrar = prefsMandos.vibrar !== false;
      guardar(CLAVE_MANDOS, prefsMandos);
    },
    // asistente: espera que se apriete un botón del mando `id` y lo deja para el botón de GameCube `boton`.
    // → Promise con el número del botón del mando (o null si se cancela)
    asignarBoton(id, boton) {
      if (asignando) asignando.listo(null);
      const g = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(x => x && x.id === id);
      const antes = new Set(g ? g.buttons.map((b, k) => b && b.pressed ? k : -1).filter(k => k >= 0) : []);
      return new Promise(listo => { asignando = { id, boton, antes, listo }; });
    },
    cancelarAsignacion() { if (asignando) { asignando.listo(null); asignando = null; } },
    borrarAsignacion(id) { delete prefsMandos.propios[id]; guardar(CLAVE_MANDOS, prefsMandos); },
    tactil(activar) { tactil.activo = activar; if (tactilUI) tactilUI.mostrar(activar); },
    // Tamaño (0,8–1,3) y opacidad (0,3–1) del mando táctil, guardados en el navegador ("mkw.tactil")
    ajustesTactil: () => ({ ...ajustesTactil }),
    ajustarTactil(cambios) {
      Object.assign(ajustesTactil, cambios);
      ajustesTactil.esc = Math.min(1.3, Math.max(0.8, Number(ajustesTactil.esc) || 1));
      ajustesTactil.opa = Math.min(1, Math.max(0.3, Number(ajustesTactil.opa) || 1));
      guardar(CLAVE_TACTIL, ajustesTactil);
      if (tactilUI) tactilUI.ajustar(ajustesTactil);
    },
    async inclinar(activar) {
      // Android: funciona directo. (iPhone pide permiso, pero el juego no corre en iPhone.)
      inclinacion.activa = activar; inclinacion.centro = null; inclinacion.x = 0;
    },
    detener() { vivo = false; objetivoTeclado.removeEventListener('keydown', alBajar); objetivoTeclado.removeEventListener('keyup', alSubir); },
  };
}

// ---- Mando táctil: stick (izquierda) + botones (derecha), multitáctil con Pointer Events ----
// Cada dedo se sigue por su pointerId: un dedo en el stick y otro en A funcionan a la vez. Los botones se "re-miden"
// en cada movimiento (un dedo que se desliza de A a R suelta A y aprieta R), como el mando táctil de BT3.
// Todo se mide en "cqmin" = 1 % del lado MÁS CORTO del recuadro: así los botones tienen el mismo tamaño con el
// teléfono acostado o parado (con % del ancho, acostado el stick salía más alto que media pantalla).
// Medidas comprobadas con prueba-tactil.mjs (Pixel 7 parado y acostado, tamaños 80–130 %): ninguno pisa a otro, todos
// caben y miden ≥ 44 px. A la derecha ocupan 42 cqmin de ancho: acostado es justo la franja negra al lado de la imagen.
const BOTONES_TACTILES = [
  // [texto, bit, posición (desde la esquina inferior derecha, o superior derecha si dice top), tamaño, ¿fijo?]
  ['A', BOTON.A, { right: 4, bottom: 18 }, 20],          // acelerar: el más grande, bajo el pulgar
  ['B', BOTON.B, { right: 26, bottom: 4 }, 16],          // frenar / marcha atrás
  ['R', BOTON.R, { right: 4, bottom: 42 }, 16],          // saltar / derrapar
  ['L', BOTON.L, { right: 26, bottom: 26 }, 16],         // usar objeto
  ['↑', BOTON.arriba, { right: 26, bottom: 46 }, 14],    // truco (cruz arriba)
  ['▶', BOTON.START, { right: 4, top: 4 }, 11, true],    // pausa: arriba a la derecha y de tamaño fijo (no cambia con el deslizador)
];
function crearTactil(contenedor, tactil) {
  const capa = document.createElement('div');
  capa.className = 'mkw-tactil';
  // --esc (tamaño, 1 = normal) y la opacidad se ajustan desde la página (ajustar()); todo se mide en % del recuadro
  capa.style.cssText = 'position:absolute;inset:0;touch-action:none;user-select:none;display:none;z-index:5;--esc:1;' +
                       'container-type:size';      // para que cqmin mida este recuadro
  const base = document.createElement('div');   // el aro del stick
  base.style.cssText = 'position:absolute;left:4cqmin;bottom:8cqmin;width:calc(30cqmin * var(--esc));aspect-ratio:1;border-radius:50%;' +
                       'background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35)';
  const perilla = document.createElement('div');
  perilla.style.cssText = 'position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:rgba(255,255,255,.45)';
  base.append(perilla);
  capa.append(base);
  const botones = BOTONES_TACTILES.map(([texto, bit, pos, tam, fijo]) => {
    const b = document.createElement('div');
    b.textContent = texto;
    b.dataset.bit = bit;
    // la posición se corre con el tamaño (los botones crecen hacia el centro, sin salirse por el borde)
    const esc = fijo ? '1' : 'var(--esc)';        // el de pausa no cambia de tamaño
    const vertical = pos.top !== undefined ? `top:calc(${pos.top}cqmin * ${esc})` : `bottom:calc(${pos.bottom}cqmin * ${esc})`;
    b.style.cssText = `position:absolute;right:calc(${pos.right}cqmin * ${esc});${vertical};` +
      `height:calc(${tam}cqmin * ${esc});aspect-ratio:1;` +
      'border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 18px system-ui;color:#fff;' +
      'background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4)';
    capa.append(b);
    return b;
  });
  contenedor.style.position = contenedor.style.position || 'relative';
  contenedor.append(capa);

  const dedos = new Map();                         // pointerId → { stick: bool, x, y }
  const dentro = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  const recalcula = () => {
    let bits = 0, sx = 0, sy = 0;
    for (const d of dedos.values()) {
      if (d.stick) {                               // distancia al centro del aro, normalizada a su radio
        const r = base.getBoundingClientRect();
        const nx = (d.x - (r.left + r.width / 2)) / (r.width / 2);
        const ny = (d.y - (r.top + r.height / 2)) / (r.height / 2);
        [sx, sy] = aStickGC(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
      } else {
        for (const b of botones) if (dentro(b, d.x, d.y)) bits |= Number(b.dataset.bit);
      }
    }
    tactil.botones = bits; tactil.sx = sx; tactil.sy = sy;
  };
  capa.addEventListener('pointerdown', e => {
    try { capa.setPointerCapture(e.pointerId); } catch {}   // (los toques simulados de las pruebas no se pueden "capturar")
    // un dedo es del stick si cae en el aro o en la zona de la izquierda (hasta el borde derecho del aro + un poco)
    const aro = base.getBoundingClientRect();
    // (salvo que caiga justo sobre un botón: con el tamaño grande, B queda cerca de esa zona)
    const enBoton = botones.some(b => dentro(b, e.clientX, e.clientY));
    dedos.set(e.pointerId, { stick: !enBoton && (dentro(base, e.clientX, e.clientY) || e.clientX < aro.right + aro.width * 0.25),
                             x: e.clientX, y: e.clientY });
    recalcula();
  });
  capa.addEventListener('pointermove', e => { const d = dedos.get(e.pointerId); if (d) { d.x = e.clientX; d.y = e.clientY; recalcula(); } });
  const suelta = e => { dedos.delete(e.pointerId); recalcula(); };
  capa.addEventListener('pointerup', suelta);
  capa.addEventListener('pointercancel', suelta);

  return {
    mostrar(si) { capa.style.display = si ? 'block' : 'none'; if (!si) { dedos.clear(); recalcula(); } },
    ajustar({ esc, opa }) { capa.style.setProperty('--esc', String(esc)); capa.style.opacity = String(opa); },
    pinta() {                                      // la perilla sigue al dedo; los botones apretados se iluminan
      perilla.style.transform = `translate(${(tactil.sx / 127) * 60}%, ${(-tactil.sy / 127) * 60}%)`;
      for (const b of botones) b.style.background = tactil.botones & Number(b.dataset.bit) ? 'rgba(228,0,43,.6)' : 'rgba(255,255,255,.18)';
    },
    capa, base, botones,
  };
}

// Nombre legible de una tecla (KeyboardEvent.code → texto corto)
export function nombreTecla(code) {
  const especiales = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espacio', Enter: 'Enter',
                       Backspace: 'Retroceso', ShiftLeft: 'Shift izq.', ShiftRight: 'Shift der.', Escape: 'Esc', Tab: 'Tab' };
  if (especiales[code]) return especiales[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
