// Controles del juego en la página: teclado, mandos (Gamepad API) y celular (mando táctil + inclinar para dirigir).
// (Para el salón de Juegos —build-controles.js del sitio—: @controles: tactil teclado . En el PC con teclado o mando; en
// el celular con el mando en pantalla, que se mueve, agranda, agrega u oculta botón por botón —§113, el dueño
// 2026-10-26: «coloca compatibilidad con móviles», como BT3—.)
//
// Resumen: el juego solo entiende mandos de GameCube (4 puertos). Este módulo junta todo lo que el jugador usa y,
// una vez por refresco de pantalla, arma el estado de un mando de GameCube por puerto y se lo entrega al juego con
// `enviar(puerto, conectado, botones, sx, sy, cx, cy, gl, gr)` (en la página real es Module._mkw_web_pad, ver
// web/navegador/pad_web.cpp). No sabe nada del juego: por eso se prueba solo en el banco (banco/pruebas/controles).
//
//   - Teclado → puerto 1. Mapeo por defecto pensado para Mario Kart, cambiable y guardado en el navegador.
//   - Mandos → el primero comparte el puerto 1 con el teclado; los siguientes van a los puertos 2, 3 y 4. La persona
//     puede elegir qué jugador es cada mando (elegirPuerto, se recuerda por mando), como en BT3.
//     Mapeo "standard" del navegador (Xbox/PlayStation/Switch Pro/genéricos), zona muerta ajustable, gatillos
//     analógicos; disposición «por letra» para los de Nintendo (A a la derecha) y asignación propia por mando (para
//     adaptadores de GameCube y mandos sin mapeo estándar), todo guardado en el navegador ("mkw.mandos").
//   - Táctil (celular) → puerto 1: stick a la izquierda y botones a la derecha, cada dedo por separado.
//   - Inclinar el teléfono (como el Wii Wheel) → mueve el stick a izquierda/derecha del puerto 1 (opcional).
//   - Vibración: el juego la pide con vibrar(puerto, cmd); va al mando (vibrationActuator) o al celular.

import { mapaPorOmision, revisarMapa, migrarPropio, aplicarMapa, fotoMando, capturar as capturarFuente, poner as ponerFuente,
         clavePerfil, ES_OBJETIVO, esPorOmision, conReposo } from './asignacion-mando.mjs';

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
  // §111: el stick C también desde el teclado (antes no había cómo). Sin teclas de partida (el crítico: lo de siempre no
  // cambia, y una tecla que alguien ya usaba no hace dos cosas): la persona le pone las que quiera
  ['cArriba',        'Stick C ↑',                          []],
  ['cAbajo',         'Stick C ↓',                          []],
  ['cIzquierda',     'Stick C ←',                          []],
  ['cDerecha',       'Stick C →',                          []],
];
export const MAX_TECLAS = 3;                       // §111: teclas por acción (lo de siempre trae hasta 2)
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
  // (§111: Xbox antes que PlayStation, como juegos/audio/mando.js: el nombre del de Xbox también dice «Wireless
  // Controller», que es el del DualShock 4; antes un mando de Xbox salía como PlayStation)
  if (/045e|xbox|xinput/.test(s)) return 'xbox';
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(s)) return 'playstation';
  return 'generico';
}
export const NOMBRE_TIPO = { nintendo: 'Nintendo (Switch Pro / Joy-Con)', playstation: 'PlayStation', xbox: 'Xbox', gamecube: 'GameCube (adaptador)', generico: 'Mando genérico' };
// Los botones de GameCube que se pueden asignar a mano (para mandos raros o gustos propios), en orden del asistente
export const ASIGNABLES = [['A', 'A — acelerar'], ['B', 'B — frenar'], ['R', 'R — derrapar'], ['L', 'L — objeto'], ['X', 'X — mirar atrás'],
  ['Y', 'Y'], ['Z', 'Z'], ['START', 'Start — pausa'], ['arriba', 'Cruz arriba — truco'], ['abajo', 'Cruz abajo'], ['izquierda', 'Cruz izquierda'], ['derecha', 'Cruz derecha']];
const CLAVE_MANDOS = 'mkw.mandos';
// zona muerta en %; puertos = el jugador que la persona eligió para cada mando (clave del mando → puerto 0..3)
const PREFS_MANDOS = { disposicion: 'auto', zona: 15, vibrar: true, propios: {}, puertos: {} };

// La clave de un mando: su nombre (g.id) y, si hay dos iguales conectados, cuál de ellos (#2, #3… por orden de índice).
// El índice solo no sirve para recordarlo: cambia al desconectar y volver a conectar; el nombre solo, tampoco: dos
// mandos iguales lo comparten. Como dos enchufes iguales en un tablero: se distinguen por su posición en la fila.
export function clavesMandos(lista) {
  const vistos = new Map();                                   // nombre → cuántos van con ese nombre
  return [...lista].sort((a, b) => a.index - b.index).map(g => {
    const n = (vistos.get(g.id) || 0) + 1;
    vistos.set(g.id, n);
    return [g.index, n === 1 ? g.id : `${g.id}#${n}`];
  });
}

// Reparte los mandos en los 4 puertos (jugadores). Primero los que tienen un jugador elegido (si dos eligieron el mismo,
// gana el de menor índice); después los demás, cada uno en el primer puerto libre. Devuelve Map índice → puerto.
// (Los que no caben, del 5.º en adelante, quedan sin puerto: el juego solo tiene 4.)
export function repartirPuertos(claves, elegidos = {}) {
  const puertos = new Map(), usados = new Set();
  for (const [indice, clave] of claves) {
    const p = elegidos[clave];
    if (Number.isInteger(p) && p >= 0 && p <= 3 && !usados.has(p)) { puertos.set(indice, p); usados.add(p); }
  }
  for (const [indice] of claves) {
    if (puertos.has(indice)) continue;
    const libre = [0, 1, 2, 3].find(p => !usados.has(p));
    if (libre === undefined) break;
    puertos.set(indice, libre); usados.add(libre);
  }
  return puertos;
}

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
  // lo que el jugador cambió (solo acciones conocidas y listas de textos: un guardado viejo o roto no rompe nada)
  for (const [id, l] of Object.entries(leer(CLAVE_TECLAS) || {}))
    if (id in teclas && Array.isArray(l)) teclas[id] = l.filter(c => typeof c === 'string' && c.length < 40).slice(0, MAX_TECLAS);
  const tactil = { activo: false, sx: 0, sy: 0, botones: 0 };
  const inclinacion = { activa: false, centro: null, x: 0 };
  const piloto = { botones: 0 };                  // la página aprieta botones sola (menus.mjs: ir a una copa/pista)
  let silencio = false;                           // true = el juego no recibe nada de la persona (menú de inicio)
  let cerrojo = null;                             // §94: función que dice si AHORA lo de la persona no va al juego (la sala)
  let filtro = null;                              // §99: función que dice qué botones de la persona NO van al juego ahora (la sala)
  let sinMandos = null;                           // §100: función que dice si AHORA los mandos son de la página (el cursor del sitio)
  // §113c (el dueño: «agrega una opción de aceleración automática, con ojo en que el headstart se hace con el botón
  // asignado a la aceleración»): «Acelerar solo». acelerar() = la página dice si AHORA el kart puede acelerar solo (la
  // carrera corriendo, desde el «¡YA!», con su pantalla encima: no en la cuenta, ni en la pausa, ni en los menús)
  let acelerar = null;
  const ayudas = { acelerar: false, ...(leer('mkw.ayudas') || {}) };
  ayudas.acelerar = ayudas.acelerar === true;
  let esperandoTecla = null;                      // acción que se está reasignando (la próxima tecla va ahí)
  let sumarTecla = false;                         // §111: esa tecla se suma a las que tiene (si no, las reemplaza)
  const puertosMando = new Map();                 // índice del Gamepad → puerto (0..3)
  const ultimo = [];                              // lo último enviado por puerto (para no repetir)
  const estado = { puertos: [], mandos: [], bloqueados: false };   // para mostrar en pantalla y para las pruebas
  const prefsMandos = { ...PREFS_MANDOS, ...(leer(CLAVE_MANDOS) || {}) };   // disposición, zona muerta, vibrar, asignaciones
  prefsMandos.propios = { ...(prefsMandos.propios || {}) };            // (copias propias: el default no se toca)
  prefsMandos.mapas = { ...(prefsMandos.mapas || {}) };               // §111: el mapa entero de cada mando (asignacion-mando.mjs)
  prefsMandos.puertos = { ...(prefsMandos.puertos || {}) };
  // §111: capturando = { clave (la de ESE mando: dos iguales no se escuchan los dos), objetivo, sumar, base (foto del
  // mando al empezar), listo } mientras se espera una entrada
  let capturando = null;
  // el mapa de un mando: el que armó la persona para su modelo (§111, por perfil; antes de eso, por su nombre entero),
  // el del asistente viejo (§57: solo botones) o el de siempre
  const guardadoDe = (perfil, id) => prefsMandos.mapas[perfil] || prefsMandos.mapas[id] || null;
  const mapaDe = (perfil, id, letra) => guardadoDe(perfil, id) ? revisarMapa(guardadoDe(perfil, id))
    : prefsMandos.propios[id] ? migrarPropio(prefsMandos.propios[id]) : mapaPorOmision({ letra });
  // (§111: el mapa de siempre no se guarda —ver esPorOmision—; el asistente viejo de ese mando queda reemplazado)
  const guardarMapa = (perfil, id, m, letra) => {
    if (id !== perfil) delete prefsMandos.mapas[id];
    if (esPorOmision(m, letra)) { delete prefsMandos.mapas[perfil]; delete prefsMandos.propios[id]; } else prefsMandos.mapas[perfil] = m;
    guardar(CLAVE_MANDOS, prefsMandos);
  };
  // §111 (el crítico): después de capturar, ese mando no maneja el juego hasta que se suelta todo (si no, el botón recién
  // capturado —Start, A— llegaba un cuadro al juego): { clave, base, fuente, perfil, id, letra, objetivo }
  let hastaSoltar = null;
  // (el rediseño de Controles, el crítico: el cursor del sitio vuelve recién 250 ms después de soltar lo capturado —si no,
  // en el mismo cuadro la B capturada cerraba el cajón y la A hacía clic—; y el modo «Probar el mando»: N ms en que los
  // mandos encienden las luces del panel pero no manejan ni el cursor ni el juego)
  let ocupadoHasta = 0, probandoHasta = 0;
  const reloj = () => performance.now();
  const probandoAhora = () => probandoHasta > reloj();
  let reservado = false;                          // (el asistente «paso a paso»: los mandos son del panel de punta a punta)
  // ({ sinReserva: true } = sin contar la reserva del asistente: «¿ya se soltó lo capturado?»)
  const ocupado = ({ sinReserva = false } = {}) => (!sinReserva && reservado) || !!capturando || !!hastaSoltar || probandoAhora() || ocupadoHasta > reloj();

  // --- teclado ---
  const teclasEnUso = () => new Set(Object.values(teclas).flat());
  const alBajar = e => {
    if (esperandoTecla) {                         // reasignando: esta tecla pasa a ser de esa acción
      e.preventDefault();
      // (§111: Tab y F1–F12 no se pueden asignar —son del navegador—: se sigue esperando otra)
      if (e.code === 'Tab' || /^F([1-9]|1[0-2])$/.test(e.code)) return;
      if (e.code !== 'Escape') {                  // (Esc cancela: Esc sigue siendo Start por omisión)
        for (const id of Object.keys(teclas)) teclas[id] = teclas[id].filter(c => c !== e.code);   // sin repetidas
        teclas[esperandoTecla] = sumarTecla ? [...teclas[esperandoTecla], e.code].slice(-MAX_TECLAS) : [e.code];
        guardar(CLAVE_TECLAS, teclas);
      }
      esperandoTecla = null; sumarTecla = false;
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
    const cx = (accion('cDerecha') ? 127 : 0) - (accion('cIzquierda') ? 128 : 0);
    const cy = (accion('cArriba') ? 127 : 0) - (accion('cAbajo') ? 128 : 0);
    // el teclado no tiene gatillos analógicos: L o R apretados = gatillo a fondo (como el clic de la GameCube)
    return { botones, sx, sy, cx, cy, gl: botones & BOTON.L ? 255 : 0, gr: botones & BOTON.R ? 255 : 0, activo: teclasApretadas.size > 0 };
  }

  // --- mandos (Gamepad API) ---
  // Si el navegador no deja leer mandos aquí (un marco sin permiso «gamepad»: getGamepads lanza un error), se anota en
  // estado.bloqueados y se sigue sin mandos: el teclado no se puede caer por eso.
  const listaMandos = () => {
    try { estado.bloqueados = false; return (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean); }
    catch { estado.bloqueados = true; return []; }
  };
  let firmaReparto = '';                          // qué mandos había la última vez que se repartieron los puertos
  function leerMandos() {
    const lista = listaMandos();
    const claves = clavesMandos(lista);
    const claveDe = new Map(claves);
    // se reparte de nuevo solo si cambió qué mandos hay (o lo que eligió la persona): así nadie salta de puerto solo
    const firma = claves.map(c => c.join('=')).join('|');
    if (firma !== firmaReparto) {
      firmaReparto = firma;
      puertosMando.clear();
      for (const [i, p] of repartirPuertos(claves, prefsMandos.puertos)) puertosMando.set(i, p);
    }
    const zona = Math.min(0.4, Math.max(0.03, prefsMandos.zona / 100));
    // (§112: si el mando de lo capturado se desconectó antes de soltarlo, no queda «esperando que se suelte» para
    // siempre: con eso puesto ningún mando llegaba al juego)
    if (hastaSoltar && !claves.some(([, k]) => k === hastaSoltar.clave)) { hastaSoltar = null; ocupadoHasta = reloj() + 250; }
    return lista.map(g => {
      const tipo = tipoMando(g.id), perfil = clavePerfil(g.id, g.mapping);
      const propio = !!guardadoDe(perfil, g.id) || !!prefsMandos.propios[g.id];
      const letra = prefsMandos.disposicion === 'letra' || (prefsMandos.disposicion === 'auto' && tipo === 'nintendo');
      const mapa = mapaDe(perfil, g.id, letra);
      const comun = { puerto: puertosMando.get(g.index), nombre: g.id, clave: claveDe.get(g.index), perfil, indice: g.index, tipo, letra, vibra: !!g.vibrationActuator,
                      propio, sinMapa: g.mapping !== 'standard' && !propio, estandar: g.mapping === 'standard', mapa, mando: g };
      const quieto = { ...comun, botones: 0, sx: 0, sy: 0, cx: 0, cy: 0, gl: 0, gr: 0 };
      // §111: capturando para este mando: la primera entrada nueva (botón, eje o cruceta) queda para ese control
      if (capturando && capturando.clave === comun.clave) {
        if (!capturando.base) capturando.base = fotoMando(g);             // (la foto, del primer cuadro si no la había)
        const fuente = capturarFuente(capturando.base, g);
        if (fuente) {
          const c = capturando; capturando = null;
          const r = ponerFuente(mapa, c.objetivo, fuente, { sumar: c.sumar });
          guardarMapa(perfil, g.id, r.mapa, letra);
          hastaSoltar = { clave: comun.clave, base: c.base, fuente, perfil, id: g.id, letra, objetivo: c.objetivo };
          c.listo({ fuente, quitadoDe: r.quitadoDe, antes: mapa });
        }
        return quieto;                                                    // mientras captura, el mando no maneja
      }
      if (hastaSoltar && hastaSoltar.clave === comun.clave) {
        const h = hastaSoltar, m = /^a(\d{1,2})[+-]$/.exec(h.fuente);
        // (el gatillo-eje que marcaba 0 hasta tocarlo: al soltarlo queda en −1 → se guarda con su reposo)
        if (m && Math.abs(h.base.ejes[+m[1]] ?? 0) < 0.3) {
          const fija = conReposo(h.fuente, g.axes?.[+m[1]]);
          if (fija !== h.fuente) {
            const mp = revisarMapa(mapaDe(h.perfil, h.id, h.letra));
            mp[h.objetivo] = mp[h.objetivo].map(f => (f === h.fuente ? fija : f));
            guardarMapa(h.perfil, h.id, mp, h.letra); h.base.ejes[+m[1]] = g.axes[+m[1]]; h.fuente = fija;
          }
        }
        const f = fotoMando(g);
        const suelto = f.botones.every((b, i) => !b || h.base.botones[i]) && f.ejes.every((v, i) => Math.abs(v - (h.base.ejes[i] ?? 0)) < 0.3);
        if (!suelto) return quieto;
        hastaSoltar = null; ocupadoHasta = reloj() + 250;
      }
      return { ...comun, ...aplicarMapa(g, mapa, zona) };
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
    // (y mientras el panel de Controles captura o prueba un mando: ningún mando maneja el juego de atrás)
    const mandosFuera = (sinMandos ? !!sinMandos() : false) || ocupado();
    for (const m of mandos) if (m.puerto !== undefined && !mandosFuera) suma(m.puerto, m, m.nombre);
    if (tactil.activo) suma(0, { ...tactil, gl: tactil.botones & BOTON.L ? 255 : 0, gr: tactil.botones & BOTON.R ? 255 : 0 }, 'táctil');
    if (inclinacion.activa) suma(0, { sx: inclinacion.x }, 'inclinación');
    if (piloto.botones) suma(0, piloto, 'piloto');
    const callado = silencio || (cerrojo ? !!cerrojo() : false);
    // §113c: «Acelerar solo». En la cuenta 3-2-1 no actúa: la salida rápida (el turbo de la largada) la hace la persona con
    // SU botón de acelerar, apretándolo justo cuando sale el «2»; si lo tiene apretado al «¡YA!», sigue sin corte. Desde
    // ahí A queda apretado en cada puerto con alguien, salvo que frene (B le gana: así hay marcha atrás)
    const solo = ayudas.acelerar && !callado && acelerar ? !!acelerar() : false;
    const enviados = estado.enviados || (estado.enviados = []);
    estado.acelerandoSolo = solo;
    puertos.forEach((d0, p) => {
      const d = solo && d0.conectado && !(d0.botones & BOTON.B) ? { ...d0, botones: d0.botones | BOTON.A } : d0;
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
      enviados[p] = s.botones;                    // (lo último que recibió el juego en cada puerto: para las pruebas)
      enviar(p, s.conectado ? 1 : 0, s.botones, s.sx, s.sy, s.cx, s.cy, s.gl, s.gr);
    });
    estado.puertos = puertos;
    estado.mandos = mandos.map(({ mando, ...resto }) => resto);
    estado.teclado = kb;                          // (lo del teclado solo: las luces del panel de Controles)
    if (tactilUI) tactilUI.pinta();
  }
  // (§111, el crítico: un error en un cuadro —un mando raro, un guardado roto— no puede apagar los controles para siempre)
  const mandoDe = k => estado.mandos.find(x => x.clave === k) || estado.mandos.find(x => x.nombre === k) || null;
  let vivo = true, errores = 0;
  const bucle = () => {
    if (!vivo) return;
    try { paso(); } catch (e) { if (errores++ < 5) console.warn('[controles]', e); }
    requestAnimationFrame(bucle);
  };
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
    // §113c: acelerar(f) = f() dice si ahora el kart puede acelerar solo (la página lee la etapa de la carrera); y la ayuda
    acelerar(f) { acelerar = typeof f === 'function' ? f : null; },
    ayudas: () => ({ ...ayudas }),
    ajustarAyudas(c) { if ('acelerar' in c) ayudas.acelerar = !!c.acelerar; guardar('mkw.ayudas', ayudas); paso(); },
    // §100: sinMandos(f) = f() dice, en cada cuadro, si los mandos son ahora de la página (mando-sitio.mjs; null = nunca)
    sinMandos(f) { sinMandos = typeof f === 'function' ? f : null; paso(); },
    get silenciado() { return silencio; },                           // volver a mandar todo (p. ej. al arrancar el juego)
    // la próxima tecla queda para esa acción (§111: { sumar: true } = además de las que tiene, hasta MAX_TECLAS)
    reasignar(id, { sumar = false } = {}) { esperandoTecla = id in teclas ? id : null; sumarTecla = !!sumar; },
    cancelarTecla() { esperandoTecla = null; sumarTecla = false; },
    esperando: () => esperandoTecla,
    // §111: quitar una tecla de una acción, y volver una acción a sus teclas de siempre
    quitarTecla(id, code) { if (!(id in teclas)) return; teclas[id] = teclas[id].filter(c => c !== code); guardar(CLAVE_TECLAS, teclas); },
    restaurarTecla(id) {
      const def = ACCIONES.find(([x]) => x === id)?.[2]; if (!def) return;
      for (const k of Object.keys(teclas)) if (k !== id) teclas[k] = teclas[k].filter(c => !def.includes(c));   // (sin repetidas)
      teclas[id] = [...def]; guardar(CLAVE_TECLAS, teclas);
    },
    restaurarTeclas() { teclas = Object.fromEntries(ACCIONES.map(([id, , def]) => [id, def])); guardar(CLAVE_TECLAS, teclas); this.teclas = teclas; },
    teclasDe: id => teclas[id],
    // todas las teclas de una vez (Deshacer del panel; una acción con [] = sin teclas). Solo acciones y textos válidos
    ponerTeclas(nuevas) {
      for (const [id, l] of Object.entries(nuevas || {})) if (id in teclas && Array.isArray(l)) teclas[id] = l.filter(c => typeof c === 'string' && c.length < 40).slice(0, MAX_TECLAS);
      guardar(CLAVE_TECLAS, teclas);
    },
    copiaTeclas: () => JSON.parse(JSON.stringify(teclas)),
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
    // §111: reasignar UN control de GameCube (objetivo: 'A', 'R', 'stick.izq', 'c.arr'…) del mando `id`: espera la
    // primera entrada nueva (botón, eje o cruceta) y la deja ahí (sola, o { sumar: true }: además de las que tenía; la
    // misma entrada se quita de cualquier otro control). → Promise con { fuente, quitadoDe }, o null si se cancela
    // (k = la clave de ese mando —estado.mandos[i].clave— o su nombre: el primero con ese nombre)
    capturar(k, objetivo, { sumar = false } = {}) {
      if (capturando) { const c = capturando; capturando = null; c.listo(null); }
      const m = mandoDe(k);
      if (!m || !ES_OBJETIVO.has(objetivo)) return Promise.resolve(null);
      let base = null;
      try { const g = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(x => x && x.index === m.indice); if (g) base = fotoMando(g); } catch {}
      hastaSoltar = null;
      return new Promise(listo => { capturando = { clave: m.clave, objetivo, sumar, base, listo }; });
    },
    cancelarCaptura() { if (capturando) { const c = capturando; capturando = null; c.listo(null); } },
    // ¿el panel de Controles tiene ocupados los mandos? (capturando, esperando que se suelte lo capturado, probando, o
    // los 250 ms de después): el cursor del sitio no los toma (mkw.mjs menuDePagina) y no llegan al juego
    ocupado,
    // «Probar el mando» durante ms (0 = terminar ya): los mandos solo encienden las luces del panel
    probar(ms) { const estaba = probandoAhora(); probandoHasta = ms > 0 ? reloj() + ms : 0; if (!(ms > 0) && estaba) ocupadoHasta = reloj() + 250; },
    probando: () => Math.max(0, Math.round(probandoHasta - reloj())),
    // el asistente «paso a paso» se queda con los mandos entre un paso y otro (si no, en el hueco el cursor volvía y la A
    // del paso siguiente hacía clic)
    reservar(si) { reservado = !!si; if (!si) ocupadoHasta = reloj() + 250; },
    // (para las pruebas: qué lo tiene ocupado)
    porQueOcupado: () => ({ reservado, hastaSoltar: hastaSoltar && { ...hastaSoltar, base: undefined }, ms: Math.round(ocupadoHasta - reloj()) }),
    capturandoAhora: () => capturando ? { clave: capturando.clave, objetivo: capturando.objetivo } : null,
    // el mapa de un mando como está ahora (una copia), y cambiarlo a mano (se guarda para su modelo: su perfil)
    mapaDe(k) { const m = mandoDe(k); return m ? revisarMapa(m.mapa) : null; },
    ponerMapa(k, mapa) { const m = mandoDe(k); if (m) guardarMapa(m.perfil, m.nombre, revisarMapa(mapa), m.letra); },
    quitarFuente(k, objetivo, fuente) {
      const m = mandoDe(k); if (!m || !ES_OBJETIVO.has(objetivo)) return;
      const mapa = revisarMapa(m.mapa); mapa[objetivo] = mapa[objetivo].filter(f => f !== fuente); guardarMapa(m.perfil, m.nombre, mapa, m.letra);
    },
    restaurarObjetivo(k, objetivo) {
      const m = mandoDe(k), def = mapaPorOmision({ letra: !!m?.letra })[objetivo];
      if (!m || !def) return;
      let mapa = revisarMapa(m.mapa);
      mapa[objetivo] = [];
      for (const f of def) mapa = ponerFuente(mapa, objetivo, f, { sumar: true }).mapa;   // (y se quitan de otros)
      guardarMapa(m.perfil, m.nombre, mapa, m.letra);
    },
    // (compatibles con el asistente de §57: asignar un botón = capturar ese control; borrar = volver a lo de siempre)
    asignarBoton(k, boton) { return this.capturar(k, boton).then(r => (r ? (/^b\d+$/.test(r.fuente) ? +r.fuente.slice(1) : r.fuente) : null)); },
    cancelarAsignacion() { this.cancelarCaptura(); },
    borrarAsignacion(k) {
      const m = mandoDe(k), id = m?.nombre ?? k;
      delete prefsMandos.propios[id]; delete prefsMandos.mapas[id]; if (m) delete prefsMandos.mapas[m.perfil];
      guardar(CLAVE_MANDOS, prefsMandos);
    },
    // Elegir qué jugador (puerto 0..3) es un mando (como el «qué mando usa cada jugador» de BT3). Si ese jugador ya lo
    // tenía otro mando conectado, se cambian de lugar: el otro queda con el jugador que tenía este. Se guarda por mando.
    elegirPuerto(clave, puerto) {
      puerto = Number(puerto);
      if (!Number.isInteger(puerto) || puerto < 0 || puerto > 3) return;
      const mandos = estado.mandos || [];
      const este = mandos.find(m => m.clave === clave);
      const otro = mandos.find(m => m.clave !== clave && m.puerto === puerto);
      if (otro && este && este.puerto !== undefined) prefsMandos.puertos[otro.clave] = este.puerto;   // el cambio de lugar
      else if (otro) delete prefsMandos.puertos[otro.clave];                                         // (este no tenía: el otro busca uno libre)
      for (const [k, p] of Object.entries(prefsMandos.puertos)) if (p === puerto && k !== clave && k !== otro?.clave) delete prefsMandos.puertos[k];
      prefsMandos.puertos[clave] = puerto;
      guardar(CLAVE_MANDOS, prefsMandos);
      firmaReparto = '';                         // repartir de nuevo en el próximo cuadro
      ultimo.length = 0;                         // y volver a mandar los 4 puertos al juego
      paso();
    },
    tactil(activar) { tactil.activo = !!activar; if (tactilUI) tactilUI.mostrar(!!activar); },
    tactilActivo: () => tactil.activo,
    // §113: editar el mando en pantalla (mover, agrandar, agregar u ocultar botones); listo() se llama al terminar
    editarTactil(si, listo, opciones) { if (!tactilUI) return; if (si && !tactil.activo) this.tactil(true); tactilUI.editar(si, listo, opciones); },
    // §113b: qué botones en pantalla hacen cada acción, y qué hace cada pieza cambiada
    queHaceTactil: () => tactilUI?.queHace() || {},
    haceTactil: () => tactilUI?.hace() || {},
    tactilEditando: () => !!tactilUI?.editando,
    piezasTactil: () => tactilUI?.piezas() || {},
    borrarPiezasTactil() { tactilUI?.borrarPiezas(); },
    inclinando: () => inclinacion.activa,
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
  // [id, texto, bit, posición (desde la esquina inferior derecha, o superior derecha si dice top), tamaño, ¿fijo?, ¿se ve de partida?]
  ['A', 'A', BOTON.A, { right: 4, bottom: 18 }, 20, false, true],          // acelerar: el más grande, bajo el pulgar
  ['B', 'B', BOTON.B, { right: 26, bottom: 4 }, 16, false, true],          // frenar / marcha atrás
  ['R', 'R', BOTON.R, { right: 4, bottom: 42 }, 16, false, true],          // saltar / derrapar
  ['L', 'L', BOTON.L, { right: 26, bottom: 26 }, 16, false, true],         // usar objeto
  ['arriba', '↑', BOTON.arriba, { right: 26, bottom: 46 }, 14, false, true], // truco (cruz arriba)
  ['START', '▶', BOTON.START, { right: 4, top: 4 }, 11, true, true],       // pausa: arriba a la derecha y de tamaño fijo
  // §113 (el dueño: «permite agregar o ocultar botones»): los que no vienen puestos y se pueden agregar
  ['X', 'X', BOTON.X, { right: 48, bottom: 4 }, 14, false, false],         // mirar atrás
  ['Y', 'Y', BOTON.Y, { right: 48, bottom: 22 }, 12, false, false],
  ['Z', 'Z', BOTON.Z, { right: 48, bottom: 38 }, 12, false, false],
  ['abajo', '↓', BOTON.abajo, { right: 70, bottom: 4 }, 12, false, false],
  ['izquierda', '←', BOTON.izquierda, { right: 70, bottom: 20 }, 12, false, false],
  ['derecha', '→', BOTON.derecha, { right: 70, bottom: 36 }, 12, false, false],
];
// los nombres que ve la persona al editar (el stick es una pieza más)
export const NOMBRE_TACTIL = { stick: 'Stick', A: 'A (acelerar)', B: 'B (frenar)', R: 'R (derrapar)', L: 'L (objeto)', arriba: '↑ (truco)',
  START: '▶ (pausa)', X: 'X (mirar atrás)', Y: 'Y', Z: 'Z', abajo: '↓', izquierda: '←', derecha: '→' };
// §113b (el dueño: «los botones del celular también se deben poder rebindear»): QUÉ HACE cada botón en pantalla. Cada
// pieza tiene una acción de partida (la de su nombre: la pieza «L» usa el objeto) y la persona puede cambiarla (la pieza
// «L» derrapa, o dos piezas aceleran). [acción, nombre, etiqueta que se ve en el botón]
export const ACCIONES_TACTILES = [['A', 'Acelerar', 'A'], ['B', 'Frenar', 'B'], ['R', 'Derrapar', 'R'], ['L', 'Usar objeto', 'L'],
  ['arriba', 'Truco', '↑'], ['X', 'Mirar atrás', 'X'], ['START', 'Pausa', '▶'], ['Y', 'Y', 'Y'], ['Z', 'Z', 'Z'],
  ['abajo', 'Cruz ↓', '↓'], ['izquierda', 'Cruz ←', '←'], ['derecha', 'Cruz →', '→']];
const ACCION_TACTIL = Object.fromEntries(ACCIONES_TACTILES.map(([id, nombre, etiqueta]) => [id, { nombre, etiqueta }]));
// { pieza: acción } solo de las cambiadas (la misma para acostado y parado: es qué hace el botón, no dónde está)
const CLAVE_HACE = 'mkw.tactil.hace';
export function revisarHace(v) {
  const r = {};
  if (!v || typeof v !== 'object') return r;
  for (const [pieza, accion] of Object.entries(v))
    if (BOTONES_TACTILES.some(b => b[0] === pieza) && ACCION_TACTIL[accion] && accion !== pieza) r[pieza] = accion;
  return r;
}
// §113: lo que la persona movió, agrandó, agregó u ocultó, por orientación (como BT3: `mkw.tactil.pos.h` acostado, `.v`
// parado): { pieza: { x, y, k, ver } } — x/y el corrimiento en fracción del ancho/alto del recuadro, k el tamaño
// (1 = el de siempre) y ver = true/false si se agregó u ocultó (sin ver = lo de siempre)
const CLAVE_PIEZAS = 'mkw.tactil.pos.';
export function revisarPiezas(v) {
  const r = {};
  if (!v || typeof v !== 'object') return r;
  for (const [id, a] of Object.entries(v)) {
    if (id !== 'stick' && !BOTONES_TACTILES.some(b => b[0] === id)) continue;
    if (!a || typeof a !== 'object') continue;
    const n = {};
    if (Number.isFinite(a.x)) n.x = Math.max(-1, Math.min(1, a.x));
    if (Number.isFinite(a.y)) n.y = Math.max(-1, Math.min(1, a.y));
    if (Number.isFinite(a.k)) n.k = Math.max(0.6, Math.min(2, a.k));
    if (typeof a.ver === 'boolean' && id !== 'stick') n.ver = a.ver;
    if (Object.keys(n).length) r[id] = n;
  }
  return r;
}
function crearTactil(contenedor, tactil) {
  const capa = document.createElement('div');
  capa.className = 'mkw-tactil';
  // --esc (tamaño, 1 = normal) y la opacidad se ajustan desde la página (ajustar()); todo se mide en % del recuadro
  capa.style.cssText = 'position:absolute;inset:0;touch-action:none;user-select:none;display:none;z-index:5;--esc:1;' +
                       'container-type:size';      // para que cqmin mida este recuadro
  const base = document.createElement('div');   // el aro del stick
  base.style.cssText = 'position:absolute;left:4cqmin;bottom:8cqmin;width:calc(30cqmin * var(--esc));aspect-ratio:1;border-radius:50%;' +
                       'background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35)';
  base.dataset.pieza = 'stick';
  const perilla = document.createElement('div');
  perilla.style.cssText = 'position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:rgba(255,255,255,.45)';
  base.append(perilla);
  capa.append(base);
  const botones = BOTONES_TACTILES.map(([id, texto, bit, pos, tam, fijo]) => {
    const b = document.createElement('div');
    b.textContent = texto;
    b.dataset.bit = bit;
    b.dataset.pieza = id;
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
  const porOmision = id => BOTONES_TACTILES.find(b => b[0] === id)?.[6] !== false;
  // §113b: qué hace cada pieza (se escribe en su bit y en su etiqueta: el dedo y la vista siguen al cambio)
  let ultimaPinta = '';                            // (§114: lo último pintado, para no repintar lo mismo)
  let hace = revisarHace(leer(CLAVE_HACE));
  const haceDe = id => hace[id] || id;
  const nombrePieza = id => (id === 'stick' ? 'Stick' : `${ACCION_TACTIL[haceDe(id)].etiqueta} (${ACCION_TACTIL[haceDe(id)].nombre.toLowerCase()})`);
  const aplicarHace = () => {
    for (const b of botones) { const a = haceDe(b.dataset.pieza); b.dataset.bit = BOTON[a]; b.textContent = ACCION_TACTIL[a].etiqueta; }
    ultimaPinta = '';
  };
  aplicarHace();
  contenedor.style.position = contenedor.style.position || 'relative';
  contenedor.append(capa);

  // ---- §113: las piezas movidas, agrandadas, agregadas u ocultas (por orientación) ----
  const orientacion = () => (capa.clientWidth >= capa.clientHeight ? 'h' : 'v');
  let piezas = {}, orientacionLeida = '';
  const leerPiezas = () => { orientacionLeida = orientacion(); piezas = revisarPiezas(leer(CLAVE_PIEZAS + orientacionLeida) || {}); };
  const guardarPiezas = () => guardar(CLAVE_PIEZAS + orientacionLeida, piezas);
  const visible = el => el === base || (piezas[el.dataset.pieza]?.ver ?? porOmision(el.dataset.pieza));
  const aplicarPiezas = () => {
    if (capa.style.display === 'none') return;
    if (orientacion() !== orientacionLeida) leerPiezas();
    const w = capa.clientWidth, h = capa.clientHeight;
    for (const el of [base, ...botones]) {
      const a = piezas[el.dataset.pieza] || {};
      el.style.display = visible(el) ? (el === base ? 'block' : 'flex') : 'none';
      el.style.translate = a.x || a.y ? `${(a.x || 0) * w}px ${(a.y || 0) * h}px` : '';
      el.style.scale = a.k && a.k !== 1 ? String(a.k) : '';
    }
  };
  leerPiezas();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => aplicarPiezas()).observe(capa);

  const dedos = new Map();                         // pointerId → { stick: bool, x, y }
  const dentro = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  const activos = () => botones.filter(visible);
  const recalcula = () => {
    let bits = 0, sx = 0, sy = 0;
    for (const d of dedos.values()) {
      if (d.stick) {                               // distancia al centro del aro, normalizada a su radio
        const r = base.getBoundingClientRect();
        const nx = (d.x - (r.left + r.width / 2)) / (r.width / 2);
        const ny = (d.y - (r.top + r.height / 2)) / (r.height / 2);
        [sx, sy] = aStickGC(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
      } else {
        for (const b of activos()) if (dentro(b, d.x, d.y)) bits |= Number(b.dataset.bit);
      }
    }
    tactil.botones = bits; tactil.sx = sx; tactil.sy = sy;
  };
  capa.addEventListener('pointerdown', e => {
    if (editando) return;
    try { capa.setPointerCapture(e.pointerId); } catch {}   // (los toques simulados de las pruebas no se pueden "capturar")
    // un dedo es del stick si cae en el aro o en su lado de la pantalla (hasta el borde derecho del aro + un poco),
    // salvo que caiga justo sobre un botón (con el tamaño grande, B queda cerca de esa zona; o un botón que se movió ahí)
    const aro = base.getBoundingClientRect();
    const enBoton = activos().some(b => dentro(b, e.clientX, e.clientY));
    dedos.set(e.pointerId, { stick: !enBoton && (dentro(base, e.clientX, e.clientY) || e.clientX < aro.right + aro.width * 0.25),
                             x: e.clientX, y: e.clientY });
    recalcula();
  });
  capa.addEventListener('pointermove', e => { const d = dedos.get(e.pointerId); if (d) { d.x = e.clientX; d.y = e.clientY; recalcula(); } });
  const suelta = e => { dedos.delete(e.pointerId); recalcula(); };
  capa.addEventListener('pointerup', suelta);
  capa.addEventListener('pointercancel', suelta);

  // ---- §113: el editor (como el «✏️ Mover y agrandar» de BT3, más agregar y ocultar) ----
  // Una capa encima del mando recibe los toques (ninguno llega al juego): tocar una pieza la elige, arrastrarla la mueve;
  // la barra de arriba tiene − / + (su tamaño), Ocultar, ↺ Esta, ↺ Todas, ✓ Listo y «Agregar:» con las que no se ven.
  let editando = false, elegida = '', arrastre = null, alTerminar = null;
  const editor = document.createElement('div');
  editor.className = 'mkw-tactil-editor';
  editor.style.cssText = 'position:absolute;inset:0;z-index:6;display:none;touch-action:none';
  const barra = document.createElement('div');
  barra.className = 'mkw-tactil-barra';
  barra.setAttribute('role', 'toolbar'); barra.setAttribute('aria-label', 'Editar el mando en pantalla');
  barra.style.cssText = 'position:absolute;left:50%;top:6px;translate:-50% 0;z-index:7;display:none;flex-wrap:wrap;justify-content:center;gap:6px;' +
    'max-width:calc(100% - 12px);padding:8px;border-radius:12px;background:rgba(18,14,40,.94);border:1px solid #5b4bb0;font:600 13px system-ui;color:#fff';
  const texto = document.createElement('span');
  texto.style.cssText = 'flex-basis:100%;text-align:center';
  const bot = (t, accion, etiqueta) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t; b.dataset.e = accion;
    if (etiqueta) b.setAttribute('aria-label', etiqueta);
    b.style.cssText = 'min-width:44px;min-height:40px;padding:6px 10px;border-radius:9px;border:1px solid #5b4bb0;background:#2a2350;color:#fff;font:inherit';
    return b;
  };
  const bHace = bot('Hace: —', 'hace');
  // (el menú «¿qué hace este botón?»: las 12 acciones, una fila de botones que se abre bajo la barra)
  const menuHace = document.createElement('div');
  menuHace.style.cssText = 'flex-basis:100%;display:none;flex-wrap:wrap;justify-content:center;gap:6px';
  menuHace.append(...ACCIONES_TACTILES.map(([id, nombre, etiqueta]) => { const b = bot(`${etiqueta} · ${nombre}`, 'poner'); b.dataset.accion = id; return b; }));
  const bMenos = bot('−', 'menos', 'Más chico'), bMas = bot('+', 'mas', 'Más grande'), bOcultar = bot('Ocultar', 'ocultar'),
        bEsta = bot('↺ Esta', 'esta'), bTodas = bot('↺ Todas', 'todas'), bListo = bot('✓ Listo', 'listo');
  bListo.style.background = '#ffd21f'; bListo.style.color = '#1a0a00'; bListo.style.borderColor = '#ffd21f';
  const agregar = document.createElement('div');
  agregar.style.cssText = 'flex-basis:100%;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;align-items:center';
  barra.append(texto, bHace, bMenos, bMas, bOcultar, bEsta, bTodas, bListo, menuHace, agregar);
  capa.append(editor, barra);
  const pintaEditor = () => {
    for (const el of [base, ...botones]) el.style.outline = editando ? (el.dataset.pieza === elegida ? '3px solid #ffd21f' : '2px dashed rgba(255,255,255,.7)') : '';
    const k = Math.round(((piezas[elegida] && piezas[elegida].k) || 1) * 100);
    texto.textContent = elegida ? `«${nombrePieza(elegida)}» · ${k} % — arrástralo, usa − / + o cambia lo que hace`
      : 'Toca un botón (o el stick) y arrástralo para moverlo. − / + cambia su tamaño; «Hace» cambia lo que hace.';
    for (const b of [bMenos, bMas, bEsta]) b.disabled = !elegida;
    bHace.disabled = !elegida || elegida === 'stick';
    bHace.textContent = elegida && elegida !== 'stick' ? `Hace: ${ACCION_TACTIL[haceDe(elegida)].nombre} ▾` : 'Hace: —';
    if (bHace.disabled) menuHace.style.display = 'none';
    for (const b of menuHace.children) b.style.background = elegida && b.dataset.accion === haceDe(elegida) ? '#7042df' : '#2a2350';
    bOcultar.disabled = !elegida || elegida === 'stick';
    // «Agregar»: las que no se ven (se arma de nuevo solo al ocultar o agregar)
    const ocultas = botones.filter(b => !visible(b)).map(b => b.dataset.pieza);
    const firma = ocultas.map(id => id + '=' + haceDe(id)).join();
    if (agregar.dataset.firma !== firma) {
      agregar.dataset.firma = firma;
      agregar.replaceChildren(...(ocultas.length ? [Object.assign(document.createElement('span'), { textContent: 'Agregar:' }),
        ...ocultas.map(id => { const b = bot('＋ ' + nombrePieza(id), 'agregar'); b.dataset.pieza = id; return b; })] : []));
    }
  };
  const piezaEn = (x, y) => {
    let mejor = null, d = Infinity;
    for (const el of [base, ...botones]) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) {
        const dd = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (dd < d) { d = dd; mejor = el; }
      }
    }
    return mejor;
  };
  editor.addEventListener('pointerdown', e => {
    e.preventDefault();
    const el = piezaEn(e.clientX, e.clientY);
    elegida = el ? el.dataset.pieza : '';
    pintaEditor();
    if (!el) return;
    try { editor.setPointerCapture(e.pointerId); } catch {}
    const a = piezas[elegida] || {};
    arrastre = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: a.x || 0, ay: a.y || 0 };
  });
  editor.addEventListener('pointermove', e => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    e.preventDefault();
    const a = piezas[elegida] || (piezas[elegida] = {});
    a.x = Math.round((arrastre.ax + (e.clientX - arrastre.x0) / capa.clientWidth) * 1000) / 1000;
    a.y = Math.round((arrastre.ay + (e.clientY - arrastre.y0) / capa.clientHeight) * 1000) / 1000;
    piezas = revisarPiezas(piezas);
    aplicarPiezas();
  });
  for (const ev of ['pointerup', 'pointercancel']) editor.addEventListener(ev, () => { if (arrastre) { arrastre = null; guardarPiezas(); } });
  barra.addEventListener('click', e => {
    const q = e.target.closest('[data-e]');
    if (!q) return;
    const que = q.dataset.e;
    if (que === 'listo') return editar(false);
    if (que === 'hace') { menuHace.style.display = menuHace.style.display === 'flex' ? 'none' : 'flex'; return; }
    if (que === 'poner') {                         // §113b: este botón ahora hace eso
      if (!elegida || elegida === 'stick') return;
      hace = revisarHace({ ...hace, [elegida]: q.dataset.accion });
      if (q.dataset.accion === elegida) delete hace[elegida];
      guardar(CLAVE_HACE, hace); aplicarHace();
      menuHace.style.display = 'none';
      return pintaEditor();
    }
    if (que === 'todas') { piezas = {}; hace = {}; guardar(CLAVE_HACE, hace); aplicarHace(); elegida = ''; }
    else if (que === 'agregar') { const id = q.dataset.pieza; piezas[id] = { ...(piezas[id] || {}), ver: true }; elegida = id; }
    else if (!elegida) return;
    else if (que === 'esta') { delete piezas[elegida]; if (hace[elegida]) { delete hace[elegida]; guardar(CLAVE_HACE, hace); aplicarHace(); } }
    else if (que === 'ocultar') { piezas[elegida] = { ...(piezas[elegida] || {}), ver: false }; elegida = ''; }
    else { const a = piezas[elegida] || (piezas[elegida] = {}); a.k = Math.max(0.6, Math.min(2, Math.round(((a.k || 1) + (que === 'mas' ? 0.1 : -0.1)) * 10) / 10)); }
    piezas = revisarPiezas(piezas);
    guardarPiezas(); aplicarPiezas(); pintaEditor();
  });
  // editar(si, listo, { objetivo }): con un objetivo (lo que tocó la persona en la lista de Controles: 'R', 'stick.izq'…)
  // abre con el botón que hace eso ya elegido; si ninguno lo hace, agrega uno de los que no se ven y se lo asigna
  function editar(si, listo = null, { objetivo = null } = {}) {
    editando = !!si;
    if (editando) { alTerminar = listo; dedos.clear(); recalcula(); }
    editor.style.display = editando ? 'block' : 'none';
    barra.style.display = editando ? 'flex' : 'none';
    menuHace.style.display = 'none';
    capa.style.opacity = editando ? '1' : capa.dataset.opa || '1';
    elegida = ''; arrastre = null;
    if (editando && objetivo) {
      if (/^stick\./.test(objetivo)) elegida = 'stick';
      else if (ACCION_TACTIL[objetivo]) {
        const ya = botones.find(b => visible(b) && haceDe(b.dataset.pieza) === objetivo);
        const libre = ya ? null : (botones.find(b => !visible(b) && haceDe(b.dataset.pieza) === objetivo) || botones.find(b => !visible(b)));
        if (ya) elegida = ya.dataset.pieza;
        else if (libre) {
          const id = libre.dataset.pieza;
          piezas = revisarPiezas({ ...piezas, [id]: { ...(piezas[id] || {}), ver: true } }); guardarPiezas();
          if (haceDe(id) !== objetivo) { hace = revisarHace({ ...hace, [id]: objetivo }); guardar(CLAVE_HACE, hace); aplicarHace(); }
          elegida = id;
        }
      }
    }
    aplicarPiezas(); pintaEditor();
    if (!editando) { guardarPiezas(); const f = alTerminar; alTerminar = null; f?.(); }
  }

  return {
    mostrar(si) { capa.style.display = si ? 'block' : 'none'; if (!si) { if (editando) editar(false); dedos.clear(); recalcula(); } else aplicarPiezas(); },
    ajustar({ esc, opa }) { capa.style.setProperty('--esc', String(esc)); capa.dataset.opa = String(opa); if (!editando) capa.style.opacity = String(opa); aplicarPiezas(); },
    // la perilla sigue al dedo; los botones apretados se iluminan. (§114: solo si algo cambió: se llama en cada cuadro, y
    // escribir 13 estilos por cuadro hacía que el navegador recalculara y volviera a pintar el mando en cada uno —en un
    // teléfono, tiempo que se le quita al juego—)
    pinta() {
      const firma = `${tactil.sx},${tactil.sy},${tactil.botones},${capa.style.display}`;
      if (firma === ultimaPinta) return;
      ultimaPinta = firma;
      perilla.style.transform = `translate(${(tactil.sx / 127) * 60}%, ${(-tactil.sy / 127) * 60}%)`;
      for (const b of botones) b.style.background = tactil.botones & Number(b.dataset.bit) ? 'rgba(228,0,43,.6)' : 'rgba(255,255,255,.18)';
    },
    editar, get editando() { return editando; },
    piezas: () => JSON.parse(JSON.stringify(piezas)),
    hace: () => ({ ...hace }),
    // §113b: qué botones a la vista hacen cada acción ({ 'R': ['L'], 'A': ['A', 'X'] …}: la etiqueta de cada uno), y el stick
    queHace() {
      const r = {};
      for (const b of botones) if (visible(b)) (r[haceDe(b.dataset.pieza)] ||= []).push(ACCION_TACTIL[haceDe(b.dataset.pieza)].etiqueta);
      if (visible(base)) for (const d of ['izq', 'der', 'arr', 'aba']) r['stick.' + d] = ['Stick'];
      return r;
    },
    borrarPiezas() { for (const o of ['h', 'v']) guardar(CLAVE_PIEZAS + o, {}); hace = {}; guardar(CLAVE_HACE, hace); aplicarHace(); leerPiezas(); aplicarPiezas(); pintaEditor(); },
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
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
