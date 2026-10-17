#!/usr/bin/env python3
"""Arma `juegos/bt3/index.html` a partir de la página del port web (`port/web/shell.html` del fork stufno102).

Resumen: la página del fork ya sabe leer la ISO del jugador, dibujar los controles táctiles, el sonido y los
guardados. Aquí se le aplican los cambios que la hacen una página del sitio, como reemplazos de texto que
fallan en voz alta si el fork cambió ese trozo (así una actualización del fork no rompe nada en silencio):
- español, `i18n.js` y `volumen.js` (silencio y volumen del sitio) antes que todo lo demás;
- sin juego en línea del fork (su servidor de Cloudflare): en su lugar `red.js` (bt3-marco.js), la malla del
  sitio, cuando el marco está en una sala (`?modo=online`);
- sin buscar un disco en un servidor: la ISO la elige el jugador, y se recuerda (File System Access) para no
  pedirla en cada pelea;
- una barra arriba a la derecha: volumen, Ajustes (la ventana F1 en Controls), el mando conectado y el log;
- `?v=` en el programa y su .wasm, para que el navegador no use uno viejo.
Uso: pagina.py <shell.html del fork> <index.html de salida> <versión> [<el .wasm, para el tamaño de la descarga>]"""
import pathlib, sys

fuente, salida, ver = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
tam_wasm = pathlib.Path(sys.argv[4]).stat().st_size if len(sys.argv) > 4 else 0
t = fuente.read_text()


def cambia(viejo, nuevo, veces=1):
    """Reemplaza un trozo que TIENE que estar (si el fork lo cambió, se para aquí)."""
    global t
    if t.count(viejo) < 1:
        sys.exit(f"pagina.py: no está en shell.html: {viejo[:90]!r}")
    t = t.replace(viejo, nuevo, veces)


# ---- cabecera: idioma, título, scripts del sitio primero ----
cambia('<html lang="en">', '<html lang="es">')
cambia('<title>Tenkaichi 3 Web</title>', f'''<title>Budokai Tenkaichi 3</title>
<!-- i18n.js primero (traducción del sitio); volumen.js antes que cualquier audio: envuelve AudioContext para que
     el silencio y el volumen del sitio gobiernen el sonido del juego sin que el juego lo sepa. -->
<script src="../../i18n.js?v={ver}"></script>
<script src="../audio/volumen.js?v=vol-1"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap" rel="stylesheet">
<!-- los cuatro kanji de los emblemas de modo, y nada más (text=): unos pocos KB -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@900&text=%E4%BA%80%E6%A9%9F%E9%97%98%E5%A4%A9&display=swap" rel="stylesheet">''')
cambia('<link rel="manifest" href="manifest.webmanifest">\n', '')
cambia('<link rel="stylesheet" href="net.css">\n<script src="net.js"></script>',
       f'<script src="red.js?v={ver}"></script>')

# ---- la barra de arriba: volumen, ajustes, mando, log ----
cambia('</style>', '''  #barra { position: fixed; z-index: 7; top: calc(var(--st) + 6px); right: calc(var(--sr) + 8px); display: flex; gap: 6px;
    align-items: center; font: 600 12px system-ui, -apple-system, sans-serif; }
  #barra button, #mando { background: rgba(20,24,32,.88); color: #e8e8ea; border: 1px solid #3a4356; border-radius: 6px;
    padding: 5px 9px; font: inherit; cursor: pointer; }
  #barra button:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 2px; }
  #mando { max-width: min(220px, 30vw); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* con el juego andando la barra no tapa el juego (ahí está la vida del jugador 2): se oculta sola y vuelve al mover
     el mouse, como en un reproductor de video (pagina.js, 2: body.barra-viva) */
  #barra { transition: opacity .25s, transform .25s; }
  body.started:not(.barra-viva) #barra { opacity: 0; transform: translateY(-10px); pointer-events: none; }
  #mando.ok { border-color: #4fd1a5; color: #4fd1a5; }
  #barra button.seguro { border-color: #ffd21f; color: #ffd21f; }
  #mando.mal { border-color: #ff6b7a; color: #ff6b7a; }
  #registro { position: fixed; left: 8px; right: 8px; bottom: 8px; max-height: 45%; z-index: 8; display: none; margin: 0;
    padding: 8px; overflow: auto; white-space: pre-wrap; word-break: break-word; background: rgba(10,12,16,.94);
    color: #d8dee9; border: 1px solid #333; border-radius: 8px; font: 12px/1.4 ui-monospace, monospace; }
  #registro.on { display: block; }
  /* en una sala: la espera antes de la pelea y los avisos de la conexión */
  #sala { position: fixed; z-index: 6; left: 50%; bottom: calc(var(--sb) + 18px); transform: translateX(-50%); display: none;
    max-width: min(560px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px; background: rgba(15,17,23,.92);
    border: 1px solid var(--line); color: var(--text); font: 14px/1.45 system-ui, -apple-system, sans-serif; text-align: center; }
  #sala.on { display: block; }
  .recordada { margin-top: 10px; }
  /* la tarjeta de inicio, con la cara del vestíbulo de la sala (juegos.html,
     .jg-bt3-vest): el cielo de noche de Dragon Ball, ki naranja, títulos como el logo (Lilita One) */
  #start { background: radial-gradient(ellipse 70% 50% at 50% -5%, #ff9a1f55, transparent 70%),
    repeating-conic-gradient(from 0deg at 50% 0%, #ffffff07 0deg 1.5deg, transparent 1.5deg 7deg),
    linear-gradient(170deg, #0b1a48, #101c45 45%, #1d0f33 80%, #2a0f0a); }
  #start .card { background: #0c1a42ee; border: 2px solid #2c4a98; border-radius: 18px; padding: 28px;
    box-shadow: 0 24px 60px #000b, 0 0 40px #ff8a0022; }
  .ceja { margin: 0 0 4px; font: 800 11px system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #a9b6dc; }
  #start h1 { margin: 0 0 12px; font: 400 34px/1.05 'Lilita One', system-ui, sans-serif; letter-spacing: .01em;
    background: linear-gradient(180deg, #fffbd1, #ffe14a 38%, #ff9d00 70%, #ff5a00); -webkit-background-clip: text; background-clip: text;
    color: transparent; -webkit-text-stroke: 1.5px #4a1300; filter: drop-shadow(0 3px 0 #1a0600) drop-shadow(0 0 14px #ff8a0066); }
  #start .pick { background: linear-gradient(180deg, #fff27a, #ffd21f 30%, #ff9d00 65%, #ff6a00); color: #2a0d00; border: 3px solid #3a1000;
    font: 400 19px 'Lilita One', system-ui, sans-serif; letter-spacing: .03em; box-shadow: 0 5px 0 #3a1000, 0 0 24px #ff8a0066; }
  #start .pick.alt { background: #16306e; color: var(--text); border: 2px solid #2f4d9c; box-shadow: none; font: 600 15px system-ui, sans-serif; }
  #start .pick:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 3px; }
  /* el selector de modo (pagina.js, 2b), como el de Snake Club: una columna de tarjetas junto a la de inicio */
  /* `safe center`: centrado mientras cabe; si no cabe (un celular vertical, una ventana baja) empieza arriba y se
     desliza. Con `center` a secas lo que sobraba arriba quedaba cortado, fuera del alcance del scroll. */
  #start { align-items: safe center; justify-content: safe center; }
  #start.con-modos { gap: 22px; flex-wrap: wrap; align-content: safe center; }
  .modos-lista { width: 320px; max-width: 100%; display: grid; gap: 8px; }
  .modos-tit { display: flex; justify-content: space-between; align-items: baseline; margin: 0 2px 4px; }
  .modos-tit h2 { margin: 0; font: 400 20px 'Lilita One', system-ui, sans-serif; color: #ffd21f; text-shadow: 0 2px 0 #1a0600; }
  .modos-tit span { font: 400 13px 'Lilita One', system-ui, sans-serif; letter-spacing: .08em; color: #6f7da6; }
  .modo { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 78px; padding: 12px; border-radius: 14px; text-align: left;
    border: 2px solid #2f4d9c; background: #0c1a42e6; color: #f4f6ff; cursor: pointer; font: 13px/1.35 system-ui, sans-serif;
    transition: border-color .15s, box-shadow .15s, transform .15s, background .15s; }
  .modo:hover { border-color: #5a7fd6; transform: translateY(-1px); }
  .modo:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 2px; }
  /* el emblema: fondo de ki de su color con líneas de velocidad, y encima el círculo blanco con el kanji */
  .modo .ico { --c1: #ff9d00; --c2: #b33a00; position: relative; width: 54px; height: 54px; flex: none; display: grid; place-items: center;
    border-radius: 14px; overflow: hidden; isolation: isolate; box-shadow: inset 0 0 0 2px #ffffff22, 0 3px 0 #050c22;
    background: repeating-conic-gradient(from 0deg, #ffffff22 0deg 6deg, transparent 6deg 18deg), radial-gradient(circle at 50% 40%, var(--c1), var(--c2) 75%); }
  .modo .ico b { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: #fffdf5;
    box-shadow: 0 0 0 2px #1a0a00, 0 2px 6px #0007; font: 900 22px/1 'Noto Serif JP', 'Yu Mincho', 'MS Mincho', serif; color: #111; }
  .modo .ico-entrenamiento { --c1: #ffb340; --c2: #c2410c; }
  .modo .ico-cpu { --c1: #4ade80; --c2: #0f5132; }
  .modo .ico-duelo { --c1: #ff6b6b; --c2: #7f1d1d; }
  .modo .ico-torneo { --c1: #ffe14a; --c2: #b45309; }
  .modo.activo .ico { box-shadow: inset 0 0 0 2px #ffd21f, 0 0 16px #ffd21f88, 0 3px 0 #050c22; }
  @media (prefers-reduced-motion: no-preference) { .modo.activo .ico { animation: aura-modo 1.8s ease-in-out infinite; } }
  @keyframes aura-modo { 50% { box-shadow: inset 0 0 0 2px #ffd21f, 0 0 26px 4px #ffd21fcc, 0 3px 0 #050c22; } }
  .modo strong { display: flex; align-items: center; gap: 6px; font: 400 18px 'Lilita One', system-ui, sans-serif; color: #fff; }
  .modo strong em { font: 800 9px system-ui, sans-serif; font-style: normal; letter-spacing: .08em; padding: 2px 5px; border-radius: 4px;
    background: #3d7bff33; color: #9cc0ff; }
  .modo small { display: block; margin-top: 2px; font-size: 12px; color: #a9b6dc; }
  .modo .radio { margin-left: auto; width: 14px; height: 14px; flex: none; border-radius: 50%; border: 2px solid #56689c; }
  .modo.activo { border-color: #ff8a00; background: linear-gradient(180deg, #1b2f66, #0f1f4d); box-shadow: 0 0 20px #ff8a0044; }
  .modo.activo strong { color: #ffd21f; }
  .modo.activo .radio { background: #ffd21f; border-color: #ffd21f; box-shadow: inset 0 0 0 3px #0f1f4d; }
  /* la dificultad de «Contra la CPU» (pagina.js, 2b): cinco fichas bajo los modos, solo con ese modo elegido */
  .nivel-cpu { display: grid; gap: 6px; padding: 10px 12px; border-radius: 14px; border: 2px solid #2f4d9c; background: #0c1a42e6; }
  .nivel-cpu[hidden] { display: none; }
  .nivel-cpu > span { font: 800 11px system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #a9b6dc; }
  .nivel-cpu div { display: flex; flex-wrap: wrap; gap: 6px; }
  .nivel-cpu button { padding: 6px 10px; border-radius: 999px; border: 1px solid #2f4d9c; background: #132a63; color: #f4f6ff;
    font: 700 12px system-ui, sans-serif; cursor: pointer; }
  .nivel-cpu button:hover { border-color: #ff8a00; }
  .nivel-cpu button[aria-pressed="true"] { background: linear-gradient(180deg, #ffd21f, #ff8a00); border-color: #ffd21f; color: #1a0a00; }
  .nivel-cpu button:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 2px; }
  /* lo que se baja por detrás (pagina.js, «el disco privado, rápido»): una pastilla en la barra con su avance */
  #bajando { --f: 0; background: linear-gradient(90deg, #ff8a0055 calc(var(--f) * 100%), rgba(20,24,32,.88) 0) !important;
    border-color: #ff9d0088 !important; cursor: default; max-width: 42vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #bajando.clic { cursor: pointer; }
  #bajando[hidden] { display: none; }
  #start #esencial { margin-top: 8px; font-size: 13px; }
  #start #esencial[disabled] { opacity: .75; cursor: default; }
  #volverModos, #volverSala, #atras { display: none; }
  body.started #volverModos, body.started #volverSala { display: inline-block; }
  body.started #volverJuegos { display: none; }   /* (con el juego andando, «← Modos»; desde los modos, a Juegos) */
  body.started.en-menus #atras { display: inline-block; }
  /* los vetados de la sala, al costado mientras se elige personaje (pagina.js, 3): plegable, nunca en la pelea */
  #vetos { position: fixed; z-index: 6; right: calc(var(--sr) + 8px); top: calc(var(--st) + 46px); width: 214px;
    max-height: calc(100vh - var(--st) - var(--sb) - 120px); display: flex; flex-direction: column; border-radius: 12px;
    background: rgba(8,16,44,.95); border: 1px solid #2f4d9c; color: #e8ecff; font: 12px/1.35 system-ui, sans-serif;
    box-shadow: 0 8px 24px #0008; }
  /* sin backdrop-filter: desenfocar lo de atrás (el juego, que cambia cada cuadro) costaba en cada cuadro y trababa el
     juego; y solo en los menús (body.en-menus, Module.onMenus), aunque el juego no avise que cerró la selección */
  #vetos[hidden], body:not(.en-menus) #vetos { display: none; }
  #vetos .tit { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 10px; border: 0; background: none;
    color: #ffd21f; font: 400 14px 'Lilita One', system-ui, sans-serif; cursor: pointer; text-align: left; }
  #vetos .tit span { flex: 1; min-width: 0; }
  #vetos .tit b { padding: 0 7px; border-radius: 999px; background: #ff5d5d; color: #fff; font: 800 11px/18px system-ui, sans-serif; }
  #vetos .tit i { font-style: normal; color: #a9b6dc; }
  #vetos .tit:focus-visible { outline: 2px solid #7fb2ff; outline-offset: -2px; border-radius: 12px; }
  #vetos .cuerpo { overflow: auto; padding: 0 10px 10px; border-top: 1px solid #2f4d9c; }
  #vetos p { margin: 8px 0; color: #a9b6dc; font-size: 11px; }
  #vetos h3 { margin: 8px 0 3px; font: 800 10px system-ui, sans-serif; letter-spacing: .08em; color: #ff9d00; }
  #vetos ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 1px; }
  #vetos li { padding: 1px 0 1px 8px; border-left: 2px solid #ff5d5d66; overflow-wrap: anywhere; }
  #vetos.plegado { width: auto; }
  #abreSala { display: none; }
  #start.en-sala .card .pick:not(#abreSala) { display: none; }
  #start.en-sala #abreSala { display: block; }
  @media (max-width: 760px) { .modos-lista { width: 460px; grid-template-columns: 1fr 1fr; } .modos-tit { grid-column: 1 / -1; } .modo .radio { display: none; } }
  /* un celular vertical (Android): una columna; las dos de 460 px se salían de la pantalla */
  @media (max-width: 500px) { .modos-lista { width: 100%; grid-template-columns: 1fr; } }
</style>''')
cambia('<div id="stage">', '''<div id="barra"><span data-volumen></span><button id="ajustes" type="button" hidden
  title="Ajustes (F1): video, sonido y controles">Ajustes</button><span id="mando" role="status">Mando: aprieta un botón</span><button
  id="verLog" type="button" hidden>Log</button></div>
<pre id="registro"></pre>
<div id="sala" role="status"></div>
<div id="stage">''')

# ---- la tarjeta de inicio, en español ----
cambia('<h1>Budokai Tenkaichi 3, in the browser</h1>', '<p class="ceja">El juego de PS2, en tu navegador</p>\n    <h1>Budokai Tenkaichi 3</h1>')
cambia('<p>Choose your own disc image of the USA release (SLUS-21678). It is read in place on this device and never uploaded.</p>',
       '<p>Elige tu propia imagen del disco, versión USA (SLUS-21678). Se lee aquí mismo, en tu navegador: no se sube a ningún lado.</p>')
cambia('>Choose disc image (.iso)<input', '>Elegir la ISO del juego<input')
cambia('<button class="pick" id="serverDisc" hidden>Play</button>',
       '<button class="pick" id="serverDisc" hidden>Jugar</button>\n    <button class="pick alt recordada" id="recordada" hidden></button>')
cambia('<kbd>F1</kbd> settings and controls &nbsp; <kbd>F11</kbd> full screen &nbsp; Saves stay in this browser.',
       '<kbd>F1</kbd> o «Ajustes»: video, sonido y controles &nbsp; <kbd>F11</kbd> pantalla completa &nbsp; Las partidas guardadas quedan en este navegador.')
cambia('<div class="keys mobile-only">Plays in landscape or portrait, with touch controls (a controller works too).\n      For full screen on iPhone: Share &rarr; Add to Home Screen. Saves stay on this device.</div>',
       '<div class="keys mobile-only">Se juega con controles táctiles (un mando también sirve), mejor con el celular en horizontal:\n      al tocar el juego se pone a pantalla completa. Las partidas guardadas quedan en este celular.</div>')

# ---- los controles táctiles: solo en una pantalla sin mouse ----
# El fork los muestra si hay «algo táctil» (pointer: coarse o maxTouchPoints > 1), y un notebook con pantalla táctil
# (o un Windows con drivers táctiles) cumple eso aunque se juegue con mouse y teclado: los controles tapaban la pelea.
# «Táctil» exige que NO haya ningún puntero fino (mouse o touchpad): un celular sí, un PC con pantalla táctil no.
cambia("  const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;",
       "  const coarse = !matchMedia('(any-pointer: fine)').matches &&   // (con mouse o touchpad no: ver pagina.py)\n"
       "                 (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1);")
# Y lo guardado no manda en el computador: el fork guardaba 'bt3.touch' = '1' al arrancar aunque nadie lo eligiera,
# así que ese '1' viejo los volvía a encender. Con mouse solo ?touch=1 los muestra.
cambia("      let touch = coarse;\n      try { const t = localStorage.getItem('bt3.touch'); if (t !== null) touch = t === '1'; } catch (e) {}",
       "      let touch = coarse;\n      if (coarse) try { const t = localStorage.getItem('bt3.touch'); if (t !== null) touch = t === '1'; } catch (e) {}")

# ---- en el celular: la barra chica y al centro, sin tapar los botones táctiles ----
# Los botones del fork van en dos columnas a los lados (horizontal) o abajo (vertical). La barra del sitio, a la
# derecha como en el PC, tapaba R2 y START en horizontal y se salía de la pantalla en vertical. En el celular va
# centrada entre las columnas (con el juego andando; antes queda donde en el PC), sin el deslizador del volumen (queda el botón 🔇) ni el indicador del mando si no hay
# uno. `translate` (no `transform`) para no pisar la animación con que la barra se esconde. El selector de idioma
# flotante de i18n.js (abajo a la izquierda) se iba encima del stick: con el juego andando no se muestra (en ningún
# aparato: en el PC tapaba la imagen).
cambia('</style>', '''  body.started .i18n-flota { display: none; }
  body.coarse.started #barra { left: 50%; right: auto; translate: -50% 0; flex-wrap: wrap; justify-content: center;
    max-width: calc(100vw - var(--vh, 1vh) * 84); }
  @media (orientation: portrait) { body.coarse.started #barra { max-width: calc(100vw - 16px); } }
  body.coarse #barra .vj-ctl input, body.coarse #barra .vj-ctl output { display: none; }
  body.coarse #mando:not(.ok) { display: none; }
  /* el tamaño y la opacidad de los controles (🎮, pagina.js): todo el pad está medido en --u, así que escalar --u
     agranda los botones y su distancia a los bordes juntos */
  /* (con tope en 100 %: la disposición por defecto ya es la grande, y más allá la cruceta toca el stick en
     horizontal y ✕ toca START en vertical — banco, choques.cjs. Para agrandar uno solo: ✏️ en el panel 🎮) */
  @media (orientation: landscape) { #pad { --u: calc(var(--vh, 1vh) * min(var(--esc, 1), 1)); } }
  @media (orientation: portrait) { #pad { --u: calc(var(--vw, 1vw) * .62 * min(var(--esc, 1), 1)); } }
  #pad { opacity: var(--opa, 1); }
  /* ☰ (la barra a la vista), ⛶ y 🎮 solo en el celular */
  #menuTactil, #activaSonido { display: none; }
  body.coarse.started #menuTactil { display: block; position: fixed; z-index: 6; top: calc(var(--st) + 4px); left: 50%; translate: -50% 0;
    padding: 2px 14px; border-radius: 0 0 10px 10px; border: 1px solid #ffffff33; border-top: 0; background: #14182099; color: #fff;
    font: 700 16px/1.4 system-ui, sans-serif; opacity: .7; transition: opacity .25s; }
  /* (con la barra a la vista el ☰ se va: iba encima de sus botones. Tiene que ganarle a la regla de arriba, que es más
     específica: con solo `body.barra-viva` el ☰ no se ocultaba nunca) */
  body.coarse.started.barra-viva #menuTactil { opacity: 0; pointer-events: none; }
  body.coarse.started #activaSonido:not([hidden]) { display: block; position: fixed; z-index: 8; left: 50%; top: 38%; translate: -50% -50%;
    padding: 12px 20px; border-radius: 12px; border: 2px solid #ffd21f; background: #0c1a42f2; color: #ffd21f;
    font: 700 17px system-ui, sans-serif; box-shadow: 0 8px 30px #000a; }
  #ajustePad { position: fixed; z-index: 9; left: 50%; top: 50%; translate: -50% -50%; width: min(340px, calc(100vw - 32px));
    display: grid; gap: 10px; padding: 14px 16px; border-radius: 14px; border: 2px solid #2c4a98; background: #0c1a42f5; color: #e8eaf6;
    font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 12px 40px #000c; }
  #ajustePad[hidden] { display: none; }
  #ajustePad b { color: #ffd21f; font: 400 18px 'Lilita One', system-ui, sans-serif; }
  #ajustePad label { display: grid; grid-template-columns: 90px 1fr 46px; align-items: center; gap: 8px; }
  #ajustePad input { width: 100%; accent-color: #ffb21e; }
  #ajustePad output { text-align: right; font-variant-numeric: tabular-nums; }
  #ajustePad p { margin: 0; color: #a9b6dc; font-size: 12.5px; }
  #ajustePad div { display: flex; gap: 8px; justify-content: flex-end; }
  #ajustePad button { padding: 7px 12px; border-radius: 8px; border: 1px solid #2f4d9c; background: #16306e; color: #fff; font: 600 14px system-ui, sans-serif; }
  #ajustePad button[data-x="listo"] { background: #ffb21e; border-color: #ffb21e; color: #2a0d00; }
</style>''')

# ---- los controles táctiles: más grandes por defecto, y la ventana de Ajustes sin nada encima ----
# El dueño pidió botones más grandes de fábrica. Misma idea que el fork (dos columnas a los lados de la imagen en
# horizontal, todo bajo la imagen en vertical), con cada botón más grande: en horizontal la cara pasa de 11 a 15 (de
# --u), la cruceta de 9 a 12 y el stick de 32 a 36; en vertical la cara de 20 a 25, la cruceta de 15 a 18 y el stick
# de 52 a 60. Los botones de la cara y la cruceta pueden entrar un poco en la imagen en los celulares más angostos
# (sus columnas miden ~36 --u). Sin choques entre ellos: banco, choques.cjs. Cada botón se puede además mover y
# agrandar a mano (✏️ en el panel 🎮, pagina.js).
# Mientras la ventana de Ajustes del juego está abierta (Module.onAjustes, parche: ui.cpp) se ocultan los controles y
# la barra: tapaban la ventana y se comían sus toques; «✕ Cerrar ajustes» abajo al centro la cierra.
cambia('</style>', """  @media (orientation: landscape) {
    #pad .sh { width: calc(var(--u) * 17); height: calc(var(--u) * 11); }
    #pad .l2, #pad .r2 { top: calc(var(--st) + var(--u) * 2); }
    #pad .l1, #pad .r1 { top: calc(var(--st) + var(--u) * 14); }
    #pad .sm { width: calc(var(--u) * 12); height: calc(var(--u) * 8); font-size: calc(var(--u) * 3.2); }
    #pad .select { left: calc(var(--fl) + var(--u) * 21); top: calc(var(--st) + var(--u) * 3.5); }
    #pad .l3 { left: calc(var(--fl) + var(--u) * 21); top: calc(var(--st) + var(--u) * 15.5); }
    #pad .start { right: calc(var(--fr) + var(--u) * 21); top: calc(var(--st) + var(--u) * 3.5); }
    #pad .r3 { right: calc(var(--fr) + var(--u) * 21); top: calc(var(--st) + var(--u) * 15.5); }
    #pad .dp { width: calc(var(--u) * 12); height: calc(var(--u) * 12); }
    #pad .dp.up { left: calc(var(--fl) + var(--u) * 14); top: calc(var(--st) + var(--u) * 26); }
    #pad .dp.left { left: calc(var(--fl) + var(--u) * 2); top: calc(var(--st) + var(--u) * 38); }
    #pad .dp.right { left: calc(var(--fl) + var(--u) * 26); top: calc(var(--st) + var(--u) * 38); }
    #pad .dp.down { left: calc(var(--fl) + var(--u) * 14); top: calc(var(--st) + var(--u) * 50); }
    #pad .stick { width: calc(var(--u) * 35); height: calc(var(--u) * 35); left: calc(var(--el) + var(--u) * 2); bottom: calc(var(--sb) + var(--u) * 1); }
    #pad .face { width: calc(var(--u) * 15); height: calc(var(--u) * 15); }
    #pad .face.tri { right: calc(var(--er) + var(--u) * 16.5); bottom: calc(var(--sb) + var(--u) * 34); }
    #pad .face.cro { right: calc(var(--er) + var(--u) * 16.5); bottom: calc(var(--sb) + var(--u) * 2); }
    #pad .face.cir { right: calc(var(--er) + var(--u) * 1); bottom: calc(var(--sb) + var(--u) * 18); }
    #pad .face.squ { right: calc(var(--er) + var(--u) * 32); bottom: calc(var(--sb) + var(--u) * 18); }
    #pad .hide { right: calc(var(--fr) + var(--u) * 2); top: calc(var(--st) + var(--u) * 27); }
  }
  @media (orientation: portrait) {
    #pad .stick { left: calc(var(--u) * 4); bottom: calc(var(--sb) + var(--u) * 20); width: calc(var(--u) * 60); height: calc(var(--u) * 60); }
    #pad .face { width: calc(var(--u) * 25); height: calc(var(--u) * 25); }
    #pad .face.tri { right: calc(var(--u) * 27.5); bottom: calc(var(--sb) + var(--u) * 61.5); }
    #pad .face.cro { right: calc(var(--u) * 27.5); bottom: calc(var(--sb) + var(--u) * 9.5); }
    #pad .face.cir { right: calc(var(--u) * 1.5); bottom: calc(var(--sb) + var(--u) * 35.5); }
    #pad .face.squ { right: calc(var(--u) * 53.5); bottom: calc(var(--sb) + var(--u) * 35.5); }
    #pad .dp { width: calc(var(--u) * 18); height: calc(var(--u) * 18); }
    #pad .dp.up { left: calc(var(--u) * 25); bottom: calc(var(--sb) + var(--u) * 127); }
    #pad .dp.down { left: calc(var(--u) * 25); bottom: calc(var(--sb) + var(--u) * 91); }
    #pad .dp.left { left: calc(var(--u) * 7); bottom: calc(var(--sb) + var(--u) * 109); }
    #pad .dp.right { left: calc(var(--u) * 43); bottom: calc(var(--sb) + var(--u) * 109); }
    #pad .sh { width: calc(var(--u) * 26); height: calc(var(--u) * 15); }
    #pad .l2 { left: calc(var(--u) * 4); } #pad .l1 { left: calc(var(--u) * 33); }
    #pad .r1 { right: calc(var(--u) * 33); } #pad .r2 { right: calc(var(--u) * 4); }
    #pad .sm { width: calc(var(--u) * 22); height: calc(var(--u) * 11); font-size: calc(var(--u) * 4.2); }
    #pad .select { left: calc(50% - var(--u) * 24); bottom: calc(var(--sb) + var(--u) * 4); }
    #pad .start { left: calc(50% + var(--u) * 2); bottom: calc(var(--sb) + var(--u) * 4); }
    #pad .l3 { left: calc(50% - var(--u) * 24); top: calc(var(--st) + min(var(--vw, 1vw) * 75, var(--vh, 1vh) * 52) + var(--u) * 24); }
    #pad .r3 { left: calc(50% + var(--u) * 2); top: calc(var(--st) + min(var(--vw, 1vw) * 75, var(--vh, 1vh) * 52) + var(--u) * 24); }
    #pad .hide { left: calc(50% - var(--u) * 11); top: calc(var(--st) + min(var(--vw, 1vw) * 75, var(--vh, 1vh) * 52) + var(--u) * 39);
      width: calc(var(--u) * 22); }
  }
  /* la ventana de Ajustes del juego abierta: nada encima (ni se come sus toques) */
  body.ajustes-abiertos #pad, body.ajustes-abiertos #show, body.ajustes-abiertos #vetos, body.ajustes-abiertos #hud,
  body.ajustes-abiertos #activaSonido, body.coarse.ajustes-abiertos #barra, body.coarse.ajustes-abiertos #menuTactil { display: none !important; }
  #cierraAjustes { display: none; }
  body.coarse.ajustes-abiertos #cierraAjustes { display: block; position: fixed; z-index: 9; left: 50%; bottom: calc(var(--sb) + 10px);
    translate: -50% 0; padding: 10px 18px; border-radius: 12px; border: 2px solid #ffd21f; background: #0c1a42f2; color: #ffd21f;
    font: 700 16px system-ui, sans-serif; box-shadow: 0 8px 30px #000a; }
  /* ✏️ mover y agrandar cada control (pagina.js) */
  #editaPad, #editaBarra { display: none; }
  body.editando-pad #editaPad { display: block; position: fixed; inset: 0; z-index: 5; touch-action: none; }
  body.editando-pad #pad { opacity: 1; }
  body.editando-pad #pad .b, body.editando-pad #pad .stick { outline: 2px dashed #ffffffa0; outline-offset: 1px; }
  body.editando-pad #pad .sel { outline: 3px solid #ffb21e; background: rgba(255,178,30,.4); }
  body.editando-pad #barra, body.editando-pad #menuTactil { display: none !important; }
  body.editando-pad #editaBarra { display: flex; position: fixed; z-index: 9; left: 50%; top: calc(var(--st) + 6px); translate: -50% 0;
    flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; max-width: calc(100vw - 16px); padding: 8px 10px;
    border-radius: 12px; border: 2px solid #2c4a98; background: #0c1a42f0; color: #e8eaf6; font: 13px/1.3 system-ui, sans-serif;
    box-shadow: 0 8px 30px #000a; }
  #editaBarra span { flex-basis: 100%; text-align: center; }
  #editaBarra button { min-width: 40px; padding: 7px 10px; border-radius: 8px; border: 1px solid #2f4d9c; background: #16306e; color: #fff;
    font: 700 15px system-ui, sans-serif; }
  #editaBarra button:disabled { opacity: .4; }
  #editaBarra button[data-e="listo"] { background: #ffb21e; border-color: #ffb21e; color: #2a0d00; }
</style>""")

# ---- deslizar con el dedo: en todo el inicio, no solo en la tarjeta ----
# El fork bloquea el arrastre con el dedo (touchmove) en toda la página salvo en `.card`, para que el juego no se
# mueva ni haga zoom. Pero los modos (pagina.js, 2b) van fuera de la tarjeta: se bajaba arrastrando sobre ella y,
# con el dedo ya sobre los modos, no se podía volver a subir. Se deja arrastrar en todo el inicio (`#start`, que se
# quita al empezar), en las dos listas con scroll propio (los vetados, el log) y en el panel 🎮 (sus deslizadores).
cambia("    document.addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest('.card')) e.preventDefault(); }, { passive: false });",
       "    document.addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest('.card, #start, #vetos, #registro, #ajustePad')) e.preventDefault(); }, { passive: false });")

# ---- los botones táctiles se miden de nuevo con cada dedo ----
# El fork guarda dónde está cada botón (Touch.rects) y solo lo vuelve a medir al girar el celular. Pero los botones se
# mueven también cuando cambia el alto de la pantalla sin girar: al entrar a pantalla completa (el primer toque, ver
# pagina.js) o cuando la barra de Chrome se esconde. Los toques caían donde estaban antes y «no reaccionaban a la
# primera»; girar y volver lo arreglaba. Medir ~18 rectángulos en cada dedo nuevo no cuesta nada.
cambia("      if (!this.rects) this.layout();\n      if (e.target.closest('[data-hide]'))",
       "      this.layout();   // (siempre: la pantalla pudo cambiar de alto sin girar; ver pagina.py)\n      if (e.target.closest('[data-hide]'))")

# ---- Chrome o Edge (JSPI): en el computador y en Android; iPhone y Safari no ----
# Solo se construye la versión JSPI. La tienen Chrome y Edge, también Chrome de Android (con los controles táctiles
# del fork). En el iPhone todo navegador es Safari por dentro, sin JSPI: ahí no arranca y se dice.
cambia("  const BUILD = Q.get('build') || ('Suspending' in WebAssembly ? 'bt3-jspi' : 'bt3-async');",
       "  const BUILD = 'bt3-jspi';   // (solo la versión JSPI: sin ella el juego no arranca, ver abajo)")
cambia("  if (typeof WebAssembly !== 'object') say('This browser cannot run WebAssembly.', true);",
       "  if (typeof WebAssembly !== 'object' || !('Suspending' in WebAssembly)) {\n"
       "    $('pickLabel').hidden = true;\n"
       "    say('Este juego necesita Chrome o Edge: en el computador, o Chrome en un celular Android. En iPhone y Safari no funciona.', true);\n"
       "  }")

# ---- el programa: con versión, también el .wasm ----
cambia("    noInitialRun: true,", f"    noInitialRun: true,\n    locateFile: (f, base) => base + f + '?v={ver}',   // el .wasm con la misma versión que su .js")
cambia("    s.src = BUILD + '.js';", f"    s.src = BUILD + '.js?v={ver}';")

# ---- el entorno del programa: sin la sesión del fork; la de una sala la pone `sala` (abajo) ----
cambia("                                      window.BT3Net ? BT3Net.sessionEnv() : {},",
       "                                      window.Sala ? Sala.entorno() : { BT3_NOMOVIE: '1' },")
cambia("      if (window.BT3Net) { await BT3Net.beforeStart(); BT3Net.afterStart(); } // (a match: the other player first)",
       "      if (window.Sala) await Sala.antesDeEmpezar();   // en una sala: el rival conectado primero")

# ---- el disco: sin servidor; recordado ----
inicio = t.index("  const served = Q.get('disc')")
fin = t.index("  // the program itself")
t = t[:inicio] + "  say('');\n\n" + t[fin:]
cambia("  $('iso').addEventListener('change', (e) => { audioUnlock(); if (e.target.files[0]) go(fileDisc(e.target.files[0])); });",
       "  $('iso').addEventListener('change', (e) => { audioUnlock(); if (e.target.files[0]) { Disco.olvida(); go(fileDisc(e.target.files[0])); } });")

# ---- progreso: nada de esperas mudas (bajar el programa, leer el disco, cargar del disco privado) ----
cambia("      say('Reading the disc image…');", "      say('Leyendo el disco…');")
cambia("      say(`Disc recognised (${n.toLocaleString()} archive entries). Starting…`);",
       "      say(`Disco reconocido (${n.toLocaleString('es')} archivos). Arrancando el juego…`);")
cambia("say('Loading the program…'))", "say('Cargando el programa…'))")
# En «un jugador» el programa (3,6 MB) no se baja al abrir la página: recién al apretar «Jugar» o elegir la ISO,
# que es cuando se llama a go (pagina.js, `pidePrograma`; en una sala ya se pidió al entrar).
cambia("  const go = (disc) => Module.ready ? start(disc) : (Module.pendingStart = () => start(disc), say('Cargando el programa…'));",
       "  const go = (disc) => {\n    if (window.pidePrograma) pidePrograma();\n"
       "    return Module.ready ? start(disc) : (Module.pendingStart = () => start(disc), say('Cargando el programa…'));\n  };")
cambia("    s.onerror = () => say('Could not load ' + BUILD + '.js', true);",
       "    s.onerror = () => say('No se pudo cargar el juego (' + BUILD + '.js). Revisa tu conexión y recarga la página.', true);")
# El programa no se pide solo: pagina.js baja primero el .wasm con una barra de progreso y después lo arranca
# (en una sala al abrir la página; en «un jugador», al apretar «Jugar»).
cambia("    document.body.appendChild(s);\n  }\n</script>", "    window.cargaPrograma = () => document.body.appendChild(s);   // (lo llama pagina.js)\n  }\n</script>")
# La insignia de lectura del disco: la dibuja pagina.js (en español, con barra) si está.
cambia("  const netShow = () => { $('net').textContent = `Loading ${(netBytes / 1048576).toFixed(1)} MB`; $('net').classList.add('on'); };",
       "  const netShow = () => { if (window.Progreso) return Progreso.red(netBytes); $('net').textContent = `Cargando ${(netBytes / 1048576).toFixed(1)} MB`; $('net').classList.add('on'); };")
cambia('<div id="status"></div>', '<div id="status"></div>\n    <div id="progreso" hidden><div class="pista"><i></i></div><span></span></div>')
cambia('</style>', '''  /* barras de progreso: en la tarjeta (bajar el juego) y arriba al centro durante el juego (cargar del disco) */
  #progreso { margin-top: 12px; display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
  .pista { height: 8px; border-radius: 99px; background: #2a1f18; overflow: hidden; }
  .pista i { display: block; height: 100%; width: 0; border-radius: inherit; background: linear-gradient(90deg, #f28c1e, #fde047); transition: width .2s; }
  .indef .pista i { width: 35% !important; animation: indef 1.1s ease-in-out infinite; }
  @keyframes indef { 0% { transform: translateX(-100%); } 100% { transform: translateX(290%); } }
  #net { left: 50%; right: auto; transform: translateX(-50%); top: calc(var(--st) + 10px); padding: 8px 12px; border-radius: 12px;
    min-width: 220px; background: rgba(15,11,9,.92); border: 1px solid #3d2a1c; display: none; gap: 6px; font: 600 12px system-ui, sans-serif; }
  #net.on { display: grid; }
  #sala.gira::before { content: ""; display: inline-block; width: 12px; height: 12px; margin-right: 8px; vertical-align: -1px; border-radius: 50%;
    border: 2px solid #f28c1e; border-right-color: transparent; animation: gira .8s linear infinite; }
  @keyframes gira { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .indef .pista i, #sala.gira::before { animation: none; } }
</style>''')
# ---- nuestro código, al final: disco recordado, barra, sala ----
cambia('</script>\n</body>', '</script>\n<script>var BT3_TAM_WASM = ' + str(tam_wasm) + ';</script>\n<script src="pagina.js?v=' + ver + '"></script>\n</body>')

salida.write_text(t)
print(f"{salida}: {len(t)} bytes")
