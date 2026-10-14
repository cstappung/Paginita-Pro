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
<script src="../audio/volumen.js?v=vol-1"></script>''')
cambia('<link rel="manifest" href="manifest.webmanifest">\n', '')
cambia('<link rel="stylesheet" href="net.css">\n<script src="net.js"></script>',
       f'<script src="red.js?v={ver}"></script>')

# ---- la barra de arriba: volumen, ajustes, mando, log ----
cambia('</style>', '''  #barra { position: fixed; z-index: 7; top: calc(var(--st) + 6px); right: calc(var(--sr) + 8px); display: flex; gap: 6px;
    align-items: center; font: 600 12px system-ui, -apple-system, sans-serif; }
  #barra button, #mando { background: rgba(20,24,32,.88); color: #e8e8ea; border: 1px solid #3a4356; border-radius: 6px;
    padding: 5px 9px; font: inherit; cursor: pointer; }
  #barra button:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 2px; }
  #mando { max-width: 38vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #mando.ok { border-color: #4fd1a5; color: #4fd1a5; }
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
  /* la tarjeta de inicio, con la cara del vestíbulo de la sala (juegos.html, .jg-bt3-vest) */
  #start { background: radial-gradient(ellipse at 50% 0%, #5a2a0a 0%, #22140c 42%, #0b0908 100%); }
  #start .card { background: #15100d; border-color: #3d2a1c; box-shadow: 0 24px 60px #000b, 0 0 0 1px #f28c1e22; padding: 28px; }
  #start .ceja { margin: 0 0 4px; font: 700 12px system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #b7aa9a; }
  #start h1 { margin: 0 0 10px; font: italic 900 28px/1.1 system-ui, sans-serif; letter-spacing: -.01em; color: #fde047;
    text-shadow: 0 0 18px #f28c1e99, 2px 2px 0 #7c2d12; }
  #start .pick { background: linear-gradient(180deg, #ffb347, #f28c1e 55%, #c2410c); color: #1d1004; font-weight: 800;
    box-shadow: 0 4px 0 #7c2d12; }
  #start .pick.alt { background: #2a1f18; color: var(--text); border: 1px solid #4a3426; box-shadow: none; }
  #start .pick:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 3px; }
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
       '<div class="keys mobile-only">Se juega en horizontal o vertical, con controles táctiles (un mando también sirve).\n      Las partidas guardadas quedan en este dispositivo.</div>')

# ---- solo computador con Chrome o Edge (JSPI): en el celular no se juega ----
cambia("  const BUILD = Q.get('build') || ('Suspending' in WebAssembly ? 'bt3-jspi' : 'bt3-async');",
       "  const BUILD = 'bt3-jspi';   // (solo la versión JSPI: sin ella el juego no arranca, ver abajo)")
cambia("  if (typeof WebAssembly !== 'object') say('This browser cannot run WebAssembly.', true);",
       "  if (typeof WebAssembly !== 'object' || !('Suspending' in WebAssembly) || phone) {\n"
       "    $('pickLabel').hidden = true;\n"
       "    say('Este juego necesita Chrome o Edge en un computador (no funciona en el celular ni en Safari).', true);\n"
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
cambia("    s.onerror = () => say('Could not load ' + BUILD + '.js', true);",
       "    s.onerror = () => say('No se pudo cargar el juego (' + BUILD + '.js). Revisa tu conexión y recarga la página.', true);")
# El programa no se pide solo: pagina.js baja primero el .wasm con una barra de progreso y después lo arranca.
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
