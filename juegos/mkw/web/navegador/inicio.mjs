// El menú de inicio «JloKart Wii» (bitácora §67): la imagen que dio el dueño, con 3 botones de verdad encima.
//
// Resumen: al abrir el juego sin un modo ya decidido (sin ?modo= de una sala), lo primero que se ve es esta pantalla:
// la ilustración «JloKart Wii» y a la derecha Single Player, Multiplayer y Options (el dueño pidió quitar
// «Championship»). Mientras está, el juego carga y arranca DEBAJO (así, al elegir, ya está listo o casi).
//   - Single Player → el piloto lleva el juego (tapado por la cortina) hasta su menú «Un jugador» (Grand Prix,
//     Contrarreloj, VS, Batalla) y ahí lo deja: desde ahí se juega con los menús del juego.
//   - Multiplayer → «Local» (este PC: 2, 3 o 4 Players, como los botones del menú principal del juego; el juego abre
//     directo su registro de mandos, §84) u «Online» (las salas de Juegos: solo dentro del sitio, le avisa a Juegos).
//   - Options → el cajón de la página (Controles, Partida, ajustes).
//
// PRIVADO: la imagen muestra a una persona real. No está en git ni en GitHub Pages: vive en la parte privada
// (build/…/imagenes/inicio/jlokart.webp → R2 detrás del Worker de amigos, como el disco de BT3) y se baja con el token
// de Firebase de quien juega (privado.mjs le pone la cabecera a todo lo que va al Worker). Si el Worker no la entrega
// (401 sin sesión, 403 no está en la lista AMIGOS, 404 no subida), el menú NO aparece y la página sigue como antes:
// nadie fuera de la lista ve la imagen. herramientas/preparar-inicio.py la arma desde el original (sin los botones
// pintados, que aquí se dibujan con HTML para que el resaltado pueda moverse).
//
// Mandos: lo que entrega controles.mjs (los bits del mando de GameCube, con la disposición de cada mando ya aplicada):
// A o Start = aceptar, B = volver, cruz o stick = subir/bajar. Teclado: flechas o W/S, Enter/Espacio/K, Esc/Retroceso/J.
// Mientras el menú está, el juego no recibe nada de la persona (controles.silenciar).
//
// Uso:  const inicio = crearInicio({ imagen: ORIGEN + '/build/imagenes/inicio/jlokart.webp', alElegir: que => … });
//       if (await inicio.cargar()) inicio.mostrar();      // que: 'unjugador' | 'local2'…'local4' | 'salas' | 'opciones'

// Dónde van los botones, en % de la imagen (1448 × 1086): en el lugar de los 3 primeros que traía pintados
// (y un 4.º, solo en el submenú de Local, dentro del mismo panel: ahí no va la línea de ayuda)
const LUGAR = { izquierda: 74.72, ancho: 22.44, arriba: [48.34, 55.43, 62.43, 69.43], alto: 5.89 };
// «PRESS START» pintado abajo: un brillo que late encima, y tocarlo acepta lo elegido
const START = { izquierda: 27.6, ancho: 47.3, arriba: 86.6, alto: 8.3 };
// Un panel de vidrio esmerilado detrás de los botones: tapa el borde del relleno donde estaban los 4 botones pintados
// (preparar-inicio.py) y hace que esa zona se vea como un panel del menú, no como un parche
const PANEL = { izquierda: 72.65, ancho: 26.66, arriba: 45.86, alto: 30.94 };

// Íconos (blancos con borde azul oscuro, como los pintados): bandera a cuadros, gente, engranaje, pantalla, mundo, flecha
const ICONO = {
  bandera: '<path d="M7 4v17" stroke-width="2.2"/><path d="M8 5c3-1.6 5 1.4 8 0s3.5-.6 4.5 0v8c-1-.6-2-1.2-4.5 0s-5-1.6-8 0z"/><path class="n" d="M8 5c1.4-.7 2.6-.5 4 0v4c-1.4-.5-2.6-.7-4 0zM12 9c1.4.5 2.7.6 4 0v4c-1.3.6-2.6.5-4 0zM16 5c1.6-.8 3-.6 4.5 0v4c-1.5-.6-2.9-.8-4.5 0z"/>',
  gente: '<circle cx="12" cy="7.5" r="3.4"/><path d="M5.8 20c0-4 2.8-6.6 6.2-6.6s6.2 2.6 6.2 6.6z"/><circle cx="5.2" cy="9.2" r="2.5"/><path d="M1 19c0-3 1.7-5 4.2-5 1 0 1.8.3 2.4.8-1.3 1.2-2 2.7-2.2 4.2z"/><circle cx="18.8" cy="9.2" r="2.5"/><path d="M23 19c0-3-1.7-5-4.2-5-1 0-1.8.3-2.4.8 1.3 1.2 2 2.7 2.2 4.2z"/>',
  engranaje: '<path d="M10.3 2h3.4l.5 2.6 1.8.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.8 2.6.5v3.4l-2.6.5-.8 1.8 1.5 2.2-2.4 2.4-2.2-1.5-1.8.8-.5 2.6h-3.4l-.5-2.6-1.8-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.8L2 13.7v-3.4l2.6-.5.8-1.8-1.5-2.2 2.4-2.4 2.2 1.5 1.8-.8zM12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z" fill-rule="evenodd"/>',
  pantalla: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4" stroke-width="2.2"/>',
  mundo: '<circle cx="12" cy="12" r="9.5"/><path class="n" d="M2.5 12h19M12 2.5c2.6 2.6 3.8 6 3.8 9.5s-1.2 6.9-3.8 9.5c-2.6-2.6-3.8-6-3.8-9.5S9.4 5.1 12 2.5z" fill="none" stroke-width="1.6"/>',
  atras: '<path d="M10 5 3 12l7 7v-4.2h4.5c2.6 0 4.5 1.3 6.5 4.2-.5-5.6-3.2-9.3-6.5-9.3H10z"/>',
};
const svg = nombre => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONO[nombre]}</svg>`;

// Los menús: el de entrada, el de Multiplayer y el de Local (cuántos juegan en este PC). «salas» solo dentro del sitio
// (las salas viven en Juegos).
const MENUS = {
  principal: [['unjugador', 'Single Player', 'bandera'], ['multijugador', 'Multiplayer', 'gente'], ['opciones', 'Options', 'engranaje']],
  multi: [['local', 'Local', 'pantalla'], ['salas', 'Online', 'mundo'], ['volver', 'Back', 'atras']],
  local: [['local2', '2 Players', 'gente'], ['local3', '3 Players', 'gente'], ['local4', '4 Players', 'gente'], ['volver', 'Back', 'atras']],
};
const ANTERIOR = { multi: 'principal', local: 'multi' };   // a dónde vuelve Back (o B, Esc) desde cada menú
const AYUDA = {
  unjugador: 'Grand Prix, Contrarreloj, VS y Batalla: con los menús del juego',
  multijugador: 'En este PC con 2 a 4 mandos, o en línea con tus amigos',
  opciones: 'Controles, mandos, tu partida y ajustes',
  local: 'En este PC, pantalla dividida: conecta 2 a 4 mandos',
  local2: 'Dos jugadores en este PC', local3: 'Tres jugadores en este PC', local4: 'Cuatro jugadores en este PC',
  salas: 'Con tus amigos: abre o únete a una sala en Juegos',
  volver: 'Volver al menú',
};

const ESTILO = `
#inicioJlo { position: fixed; inset: 0; z-index: 6; overflow: hidden; background: #0a1a4a; user-select: none;
  -webkit-user-select: none; touch-action: manipulation; transition: opacity .35s; }
#inicioJlo.saliendo { opacity: 0; pointer-events: none; }
body.cortina-mal #inicioJlo { display: none; }   /* un error del juego (sin WebGPU, sin permiso…): que se lea en la cortina */
#inicioJlo .ij-fondo { position: absolute; inset: -40px; background: center / cover no-repeat; filter: blur(26px) brightness(.72) saturate(1.2); }
/* el lienzo: la imagen entera a la vista (sin recortar el título), lo más grande que quepa; los botones en % de ella */
#inicioJlo .ij-lienzo { position: absolute; left: 50%; top: 50%; translate: -50% -50%; aspect-ratio: 1448 / 1086;
  width: min(100vw, 100vh * 1448 / 1086); container-type: inline-size; }
#inicioJlo .ij-arte { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
#inicioJlo .ij-panel { position: absolute; left: ${PANEL.izquierda}%; width: ${PANEL.ancho}%; top: ${PANEL.arriba}%; height: ${PANEL.alto}%;
  box-sizing: border-box; border-radius: 2.2cqw; border: .14cqw solid #ffffff59; pointer-events: none;
  background: linear-gradient(180deg, #0d47c240, #0a2a7a66); -webkit-backdrop-filter: blur(12px) saturate(1.25); backdrop-filter: blur(12px) saturate(1.25);
  box-shadow: 0 .6cqw 2.2cqw #00103a66, inset 0 .16cqw 0 #ffffff4d, inset 0 0 1.6cqw #6fd0ff26; }
#inicioJlo .ij-menu { position: absolute; inset: 0; margin: 0; padding: 0; list-style: none; pointer-events: none; }
#inicioJlo .ij-boton { position: absolute; left: ${LUGAR.izquierda}%; width: ${LUGAR.ancho}%; height: ${LUGAR.alto}%;
  pointer-events: auto; box-sizing: border-box; display: flex; align-items: center; gap: 1.1cqw; padding: 0 1.4cqw 0 1.7cqw;
  border-radius: 999px; border: .17cqw solid #e4f3ffe6; cursor: pointer; color: #fff; outline: none;
  font: 400 1.95cqw/1 'Lilita One', 'Arial Rounded MT Bold', 'Segoe UI Black', system-ui, sans-serif; letter-spacing: .02em;
  background:
    linear-gradient(90deg, transparent 62%, #ffffff1f 62% 64%, transparent 64% 70%, #ffffff17 70% 72%, transparent 72%),
    repeating-conic-gradient(#ffffff26 0 25%, transparent 0 50%) right 1.2cqw center / 1.5cqw 1.5cqw no-repeat,
    linear-gradient(180deg, #6fb2ffb8 0%, #2a74e6c4 48%, #0d47bfd6 100%);
  box-shadow: 0 0 0 .2cqw #0b2a7ccc, inset 0 .25cqw 0 #ffffff66, inset 0 -.3cqw .6cqw #06205e66, 0 .35cqw .9cqw #00103a59;
  -webkit-backdrop-filter: blur(4px) saturate(1.3); backdrop-filter: blur(4px) saturate(1.3);
  transition: transform .14s, box-shadow .14s, filter .14s; }
#inicioJlo .ij-boton:nth-child(1) { top: ${LUGAR.arriba[0]}%; }
#inicioJlo .ij-boton:nth-child(2) { top: ${LUGAR.arriba[1]}%; }
#inicioJlo .ij-boton:nth-child(3) { top: ${LUGAR.arriba[2]}%; }
#inicioJlo .ij-boton:nth-child(4) { top: ${LUGAR.arriba[3]}%; }
#inicioJlo .ij-menu.cuatro ~ .ij-ayuda { display: none; }
#inicioJlo .ij-boton span { display: block; transform: skewX(-8deg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  -webkit-text-stroke: .28cqw #0a2470; paint-order: stroke fill; text-shadow: 0 .18cqw 0 #0a2470; }
#inicioJlo .ij-boton svg { flex: none; width: 2.75cqw; height: 2.75cqw; fill: #fff; stroke: #0a2470; stroke-width: 1.3;
  stroke-linejoin: round; paint-order: stroke fill; overflow: visible; filter: drop-shadow(0 .12cqw 0 #0a2470); }
#inicioJlo .ij-boton svg .n { fill: #0a2470; stroke: none; }
#inicioJlo .ij-boton svg path[stroke-width] { fill: none; stroke: #fff; }
/* el elegido: más azul, con brillo celeste, un poco más grande y la flecha ▶ a la izquierda (como el pintado) */
#inicioJlo .ij-boton.elegido { transform: scale(1.05); border-color: #f4fdff; z-index: 1;
  background:
    linear-gradient(90deg, transparent 62%, #ffffff2e 62% 64%, transparent 64% 70%, #ffffff24 70% 72%, transparent 72%),
    repeating-conic-gradient(#ffffff38 0 25%, transparent 0 50%) right 1.2cqw center / 1.5cqw 1.5cqw no-repeat,
    linear-gradient(180deg, #7fd0ff 0%, #2f86f5 46%, #1150d8 100%);
  box-shadow: 0 0 0 .22cqw #0b2a7c, 0 0 1.4cqw .45cqw #52d2ffd9, inset 0 .3cqw 0 #ffffff99, inset 0 -.3cqw .6cqw #06205e66;
  animation: ij-latido 1.3s ease-in-out infinite; }
#inicioJlo .ij-boton.elegido::before { content: ""; position: absolute; left: -3.55cqw; top: 50%; width: 2.3cqw; height: 2.5cqw;
  translate: 0 -50%; background: linear-gradient(180deg, #8fe6ff, #1b8cf0); border-radius: .25cqw;
  clip-path: polygon(0 0, 100% 50%, 0 100%); filter: drop-shadow(0 0 .3cqw #0a2470); animation: ij-flecha .7s ease-in-out infinite alternate; }
#inicioJlo .ij-boton.elegido::after { content: ""; position: absolute; left: -3.75cqw; top: 50%; width: 2.7cqw; height: 2.9cqw;
  translate: 0 -50%; background: #0a2470; clip-path: polygon(0 0, 100% 50%, 0 100%); z-index: -1; animation: ij-flecha .7s ease-in-out infinite alternate; }
#inicioJlo .ij-boton:active { transform: scale(.98); }
#inicioJlo .ij-boton.disparado { filter: brightness(1.6); }
@keyframes ij-latido { 50% { box-shadow: 0 0 0 .22cqw #0b2a7c, 0 0 2cqw .7cqw #7fe0ffee, inset 0 .3cqw 0 #ffffffb0, inset 0 -.3cqw .6cqw #06205e66; } }
@keyframes ij-flecha { to { margin-left: .5cqw; } }
#inicioJlo .ij-start { position: absolute; left: ${START.izquierda}%; width: ${START.ancho}%; top: ${START.arriba}%; height: ${START.alto}%;
  border: 0; padding: 0; background: radial-gradient(ellipse 50% 60% at 50% 50%, #b9ecffcc, #59c8ff55 55%, transparent 75%);
  mix-blend-mode: screen; cursor: pointer; opacity: .15; animation: ij-start 1.6s ease-in-out infinite; }
@keyframes ij-start { 50% { opacity: .85; } }
#inicioJlo .ij-ayuda { position: absolute; left: ${LUGAR.izquierda - 1}%; width: ${LUGAR.ancho + 2}%; top: 69.6%; margin: 0;
  text-align: center; font: 600 1.15cqw/1.25 'IBM Plex Sans', system-ui, sans-serif; color: #fff;
  text-shadow: 0 0 .5cqw #0a2470, 0 .1cqw .2cqw #0a2470; pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  #inicioJlo .ij-boton.elegido, #inicioJlo .ij-boton.elegido::before, #inicioJlo .ij-boton.elegido::after { animation: none; }
  #inicioJlo .ij-start { animation: none; opacity: .5; }
}
/* teléfono parado (más alto que ancho): la imagen arriba y los botones grandes abajo, fuera de ella */
@media (max-aspect-ratio: 1 / 1) {
  /* sin translate ni container-type: los dos convierten al lienzo en la referencia de sus hijos "fixed", y los
     botones quedaban pegados al borde de la imagen y no al de la pantalla */
  #inicioJlo .ij-lienzo { left: 0; top: calc(8px + env(safe-area-inset-top, 0px)); translate: none; width: 100vw; container-type: normal; }
  #inicioJlo .ij-panel { display: none; }
  #inicioJlo .ij-menu { position: fixed; inset: auto 16px calc(24px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 14px; }
  #inicioJlo .ij-boton { position: relative; left: auto; top: auto !important; width: 100%; height: 58px; font-size: 22px;
    gap: 14px; padding: 0 22px; border-width: 2px; }
  #inicioJlo .ij-boton span { -webkit-text-stroke: 4px #0a2470; text-shadow: 0 2px 0 #0a2470; }
  #inicioJlo .ij-boton svg { width: 30px; height: 30px; }
  #inicioJlo .ij-boton.elegido { transform: scale(1.03); }
  #inicioJlo .ij-boton.elegido::before, #inicioJlo .ij-boton.elegido::after { display: none; }
  #inicioJlo .ij-ayuda { position: fixed; left: 16px; right: 16px; width: auto; top: auto; bottom: calc(24px + 3 * 72px + env(safe-area-inset-bottom, 0px));
    font-size: 14px; }
}`;

export function crearInicio({ contenedor = document.body, imagen, buscar = (...a) => fetch(...a), leerMandos = () => [],
                              enSitio = false, ocupado = () => false, alElegir = () => {} } = {}) {
  const estado = { imagen: 'sin pedir', mostrado: 0, elecciones: [], menu: 'principal', elegido: 0 };
  let raiz = null, url = null, visible = false, menu = 'principal', elegido = 0;
  let antes = 0, repetir = 0, direccionAntes = 0, vivo = false;

  // ---- La imagen: del Worker de amigos (con el token) o nada ----
  async function cargar() {
    if (url) return true;
    try {
      const r = await buscar(imagen, { cache: 'force-cache' });
      estado.imagen = r.status;                       // 200 bien; 401 sin sesión; 403 no está en la lista; 404 no subida
      if (!r.ok) return false;
      const b = await r.blob();
      if (!/^image\//.test(b.type) && b.size < 1000) { estado.imagen = 'no es imagen'; return false; }
      url = URL.createObjectURL(b);
      return true;
    } catch (e) { estado.imagen = 'error: ' + (e && e.message || e); return false; }
  }

  // ---- Armar la pantalla (una vez) ----
  function armar() {
    if (raiz) return;
    if (!document.getElementById('estiloInicioJlo')) {
      const s = document.createElement('style'); s.id = 'estiloInicioJlo'; s.textContent = ESTILO; document.head.append(s);
    }
    raiz = document.createElement('div');
    raiz.id = 'inicioJlo';
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-label', 'JloKart Wii: menú de inicio');
    raiz.innerHTML = `<div class="ij-fondo"></div><div class="ij-lienzo"><img class="ij-arte" alt="JloKart Wii" draggable="false"><div class="ij-panel"></div>
      <div class="ij-menu" role="menu"></div><p class="ij-ayuda" aria-live="polite"></p>
      <button type="button" class="ij-start" aria-label="Press Start: aceptar lo elegido"></button></div>`;
    raiz.querySelector('.ij-fondo').style.backgroundImage = `url("${url}")`;
    raiz.querySelector('.ij-arte').src = url;
    raiz.querySelector('.ij-start').addEventListener('click', () => aceptar());
    contenedor.append(raiz);
  }
  const opciones = () => MENUS[menu].filter(([que]) => que !== 'salas' || enSitio);
  function pintar() {
    const caja = raiz.querySelector('.ij-menu');
    caja.innerHTML = '';
    opciones().forEach(([que, texto, icono], i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ij-boton'; b.dataset.que = que; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${svg(icono)}<span>${texto}</span>`;
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') elegir(i); });
      b.addEventListener('click', () => { elegir(i); aceptar(); });
      caja.append(b);
    });
    caja.classList.toggle('cuatro', opciones().length > 3);
    elegir(Math.min(elegido, opciones().length - 1));
  }
  function elegir(i) {
    const n = opciones().length;
    elegido = (i + n) % n;
    estado.elegido = elegido; estado.menu = menu;
    raiz.querySelectorAll('.ij-boton').forEach((b, k) => { b.classList.toggle('elegido', k === elegido); b.setAttribute('aria-current', String(k === elegido)); });
    raiz.querySelector('.ij-ayuda').textContent = AYUDA[opciones()[elegido][0]] || '';
  }
  function cambiarMenu(nuevo) { menu = nuevo; elegido = 0; pintar(); }

  // ---- Aceptar lo elegido ----
  function aceptar() {
    if (!visible) return;
    const [que] = opciones()[elegido];
    const b = raiz.querySelectorAll('.ij-boton')[elegido];
    if (b) { b.classList.add('disparado'); setTimeout(() => b.classList.remove('disparado'), 180); }
    if (que === 'multijugador') return cambiarMenu('multi');
    if (que === 'local') return cambiarMenu('local');
    if (que === 'volver') return cambiarMenu(ANTERIOR[menu] || 'principal');
    estado.elecciones.push(que);
    if (que === 'unjugador' || /^local[234]$/.test(que)) ocultar();   // se va: lo que sigue es el juego
    alElegir(que);
  }
  function atras() { if (visible && menu !== 'principal') cambiarMenu(ANTERIOR[menu] || 'principal'); }

  // ---- Teclado (antes que nadie: lo que se usa aquí no le llega al juego ni a otros) ----
  const TECLAS = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 };
  function alTecla(e) {
    if (!visible || ocupado()) return;
    let usada = true;
    if (e.code in TECLAS) elegir(elegido + TECLAS[e.code]);
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyK' || e.code === 'NumpadEnter') { if (!e.repeat) aceptar(); }
    else if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyJ') atras();
    else if (e.code === 'Tab') usada = false;                                      // el foco del navegador, como siempre
    else usada = false;
    if (usada) { e.preventDefault(); e.stopImmediatePropagation(); }
  }

  // ---- Mandos: los bits del mando de GameCube que entrega controles.mjs (cada refresco) ----
  const A = 0x0100, B = 0x0200, STARTB = 0x1000, ARRIBA = 0x0008, ABAJO = 0x0004;
  function vuelta(t) {
    if (!vivo) return;
    requestAnimationFrame(vuelta);
    if (!visible || ocupado()) { antes = 0xFFFF; return; }   // al volver, lo que siga apretado no cuenta como nuevo
    let botones = 0, sy = 0;
    for (const m of leerMandos() || []) { botones |= m.botones || 0; if (Math.abs(m.sy || 0) > Math.abs(sy)) sy = m.sy || 0; }
    const nuevos = botones & ~antes;
    antes = botones;
    if (nuevos & (A | STARTB)) aceptar();
    else if (nuevos & B) atras();
    // subir/bajar: con la cruz o el stick (en el mando de GameCube, arriba es positivo); repite si se mantiene
    const dir = (botones & ARRIBA) || sy > 64 ? -1 : (botones & ABAJO) || sy < -64 ? 1 : 0;
    if (dir && (dir !== direccionAntes || t >= repetir)) {
      elegir(elegido + dir);
      repetir = t + (dir !== direccionAntes ? 380 : 150);
    }
    direccionAntes = dir;
  }

  // ---- Mostrar y esconder ----
  function mostrar() {
    if (!url) return false;
    armar();
    menu = 'principal'; elegido = 0; pintar();
    raiz.hidden = false; raiz.classList.remove('saliendo');
    visible = true; estado.mostrado++;
    document.body.classList.add('con-inicio');
    antes = 0xFFFF;                                   // lo que ya estaba apretado al abrir no cuenta
    if (!vivo) { vivo = true; addEventListener('keydown', alTecla, true); requestAnimationFrame(vuelta); }
    return true;
  }
  function ocultar() {
    if (!raiz || !visible) return;
    visible = false;
    document.body.classList.remove('con-inicio');
    raiz.classList.add('saliendo');
    setTimeout(() => { if (!visible) raiz.hidden = true; }, 380);
  }

  return { cargar, mostrar, ocultar, aceptar, atras, elegir: i => elegir(i), estado,
           get visible() { return visible; }, get opciones() { return opciones().map(([que]) => que); } };
}
