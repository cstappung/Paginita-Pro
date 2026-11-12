// La bienvenida y la «Ayuda de ajustes» — bitácora §263 (el dueño: «en la primera iniciada (hasta incluso despues de
// la update) y en las ayudas, un mensaje claro limpio bonito sencillo explicando las settings y como configurarlas para
// cada jugador, usa un critico para el diseño tambien»).
//
// Resumen: un mensaje corto con tarjetas, una por tipo de jugador («💻 Se ve lento», «📱 Juegas en el celular», «🎮 Juegas
// con mando o teclado», «🌐 Juegas en una sala»), cada una con su botón que lleva directo al ajuste (cierra el mensaje,
// abre el cajón en la hoja que va, baja hasta la fila y la marca con un borde lila que late dos veces). La forma y el
// texto los eligió un crítico aparte entre tres propuestas (tarjetas, pasos, una hoja plegable): tarjetas en el
// mensaje y la hoja plegable (acordeón) en la Ayuda, con un caso más (💾 Te falta espacio) y una línea extra por caso.
//   - Sale UNA vez por versión del mensaje: la marca `mkw.bienvenida.version` guarda la última versión vista (no «ya
//     vino antes»): quien jugaba antes de esta versión también lo ve una vez. Cerrarlo de cualquier forma (¡A jugar!,
//     ✕, Esc, B del mando, tocar fuera) cuenta como visto; «No volver a mostrar» además guarda `mkw.bienvenida.nunca`,
//     así una versión nueva del texto tampoco sale. La Ayuda queda siempre a mano en ⚙ Avanzado.
//   - Espera su momento: `puedeMostrar()` (lo da mkw.mjs) dice si ahora no hay carrera, ni cortina de carga, ni un
//     selector de pistas encima, ni pocos segundos de descanso en la sala. Se pregunta cada segundo hasta que sea sí.
//   - Las pruebas con Playwright (navigator.webdriver) no lo ven salvo con ?bienvenida=1; ?bienvenida=0 lo apaga.
// Como el rótulo de un tablero nuevo: se lee una vez al recibirlo, y la copia queda pegada adentro de la puerta.
//
// Uso:  const b = montarBienvenida({ irA, liviano, puedeMostrar, telefono, ... });   b.revisar() / b.abrir() / b.estado()
//       montarAyuda(nodo, { irA, liviano, telefono })                                 (la Ayuda en Avanzado)

export const VERSION_BIENVENIDA = 1;                 // subirla = todos lo vuelven a ver una vez (salvo «No volver a mostrar»)
export const CLAVE_VERSION = 'mkw.bienvenida.version';
export const CLAVE_NUNCA = 'mkw.bienvenida.nunca';

// el almacén de verdad, o null si el navegador lo bloquea (todo con try/catch: sin él, el mensaje sale y no se guarda)
const almacenDe = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const leer = (a, k) => { try { return a ? a.getItem(k) : null; } catch { return null; } };
const escribir = (a, k, v) => { try { a?.setItem(k, String(v)); return true; } catch { return false; } };

// ¿Hay que mostrarlo al abrir? (sin mirar el momento: eso es puedeMostrar). Devuelve el porqué, para el registro.
export function decidirBienvenida({ parametros = new URLSearchParams(), almacen = almacenDe(), webdriver = false,
                                    version = VERSION_BIENVENIDA } = {}) {
  const p = parametros.get('bienvenida');
  if (p === '0') return { mostrar: false, porque: '?bienvenida=0' };
  if (p === '1') return { mostrar: true, porque: '?bienvenida=1' };
  if (webdriver) return { mostrar: false, porque: 'prueba automática (sin ?bienvenida=1)' };
  if (leer(almacen, CLAVE_NUNCA) === '1') return { mostrar: false, porque: 'no volver a mostrar' };
  const visto = Number(leer(almacen, CLAVE_VERSION)) || 0;
  if (visto >= version) return { mostrar: false, porque: `ya vio la versión ${visto}` };
  return { mostrar: true, porque: visto ? `vio la versión ${visto}, ahora va la ${version}` : 'primera vez' };
}

// Adónde lleva cada botón: la hoja del cajón y lo que se busca en ella (el control que recibe el foco y la fila que se marca)
export const DESTINOS = {
  imagen:   { hoja: 'avanzado',  control: '#graficosN8' },
  calibrar: { hoja: 'avanzado',  control: '#autoCalibrar' },   // §274: «⚡ Auto calibración: máxima fluidez»
  salida:   { hoja: 'avanzado',  control: '#graficosSalida' },
  liviano:  { hoja: 'avanzado',  control: '#graficosLiviano' },
  avisos:   { hoja: 'avanzado',  control: '#graficosAvisosLag' },
  datos:    { hoja: 'avanzado',  control: '#espacioPanel', fila: '#espacioPanel' },
  informe:  { hoja: 'avanzado',  control: '#copiarRendimiento' },
  controles:{ hoja: 'controles', control: '#panelControles .ctl-pestana', fila: '#panelControles .ctl-pestanas' },
  zona:     { hoja: 'controles', control: '#panelControles [aria-label="Más zona muerta"]' },
  celular:  { hoja: 'controles', control: '#panelControles .ctl-celular button', fila: '#panelControles .ctl-celular' },
  acelerar: { hoja: 'controles', control: '#panelControles .ctl-ayudas button', fila: '#panelControles .ctl-ayudas' },
};

// Los casos. `corto` = la tarjeta del mensaje (2 líneas como mucho); `extra` = la línea de más que lleva la Ayuda.
// Un botón: { texto, ir } (lleva a DESTINOS[ir]) o { texto, hace } ('liviano' = lo pone ahí mismo, 'editor' = abre el
// editor de los botones en pantalla). `soloTelefono` = el caso sale solo en un teléfono; `soloAyuda` = no va en el mensaje.
// §274: calibrar = hay botón de auto calibración (?autoCalibrar=0 = no): el caso «lento» lleva primero a él
export function casos({ telefono = false, calibrar = true } = {}) {
  const cal = calibrar ? [{ texto: '⚡ Auto calibración', ir: 'calibrar' }] : [];
  return [
    { id: 'lento', icono: '💻', titulo: 'El juego va lento o se traba',
      corto: calibrar ? 'Toca «⚡ Auto calibración»: prueba solo y deja la imagen más pareja.'
        : 'Toca «Elegir imagen» y elige «30 parejas»: se ve un poco menos suave, pero sin tirones.',
      extra: 'Si todavía se traba, baja la «Resolución de salida»: la imagen se ve más borrosa, pero el juego va más liviano.',
      botones: [...cal, { texto: 'Elegir imagen', ir: 'imagen' }], botonesAyuda: [...cal, { texto: 'Elegir imagen', ir: 'imagen' }, { texto: 'Resolución de salida', ir: 'salida' }] },
    { id: 'celular', icono: '📱', titulo: 'Juegas en el celular', soloTelefono: true,
      corto: 'Toca ⚡ «Liviano»: el juego se ve más simple y va más fluido. «Mover botones» pone los botones donde te acomoden.',
      extra: 'En Controles puedes dirigir inclinando el teléfono, o prender 🚗 Acelerar solo.',
      botones: [{ texto: '⚡ Liviano', hace: 'liviano' }, { texto: 'Mover botones', hace: 'editor' }],
      botonesAyuda: [{ texto: '⚡ Liviano', hace: 'liviano' }, { texto: 'Mover botones', hace: 'editor' }, { texto: 'Ver Celular', ir: 'celular' }] },
    { id: 'mando', icono: '🎮', titulo: 'Juegas con mando o teclado',
      corto: 'Funciona solo. Para cambiar qué hace cada botón, toca «Cambiar botones». Si el kart dobla solo, sube la «zona muerta».',
      extra: 'La «zona muerta» es cuánto hay que mover el palito antes de que el kart gire. Con varios mandos, cada uno elige su jugador en las pestañas «Jugador 1–4». 🚗 Acelerar solo acelera por ti.',
      botones: [{ texto: 'Cambiar botones', ir: 'controles' }],
      botonesAyuda: [{ texto: 'Cambiar botones', ir: 'controles' }, { texto: 'Zona muerta', ir: 'zona' }, { texto: 'Acelerar solo', ir: 'acelerar' }] },
    { id: 'sala', icono: '🌐', titulo: 'Juegas con otros en una sala',
      corto: 'Si alguien tiene mala conexión sale un aviso 📶; es solo para que sepas. Si no quieres verlo, toca «Ocultar avisos».',
      extra: 'La conexión la elige el anfitrión, no tú.',
      botones: [{ texto: 'Ocultar avisos', ir: 'avisos' }], botonesAyuda: [{ texto: 'Ocultar avisos', ir: 'avisos' }] },
    { id: 'espacio', icono: '💾', titulo: 'El navegador se queda sin espacio', soloAyuda: true,
      corto: 'El juego guarda las pistas para cargar más rápido. Borra las que no juegas; las que marques con ⭐ no se borran.',
      botones: [], botonesAyuda: [{ texto: 'Ver Datos del juego', ir: 'datos' }] },
  ].filter(c => telefono || !c.soloTelefono);
}

// ---------------- los estilos (una vez; todo bajo .mkw-bv) ----------------
const CSS = `
dialog.mkw-bv { max-width: min(560px, calc(100vw - 32px)); max-height: 90vh; width: 100%; box-sizing: border-box; padding: 0;
  border: 2px solid #4b3d93; border-radius: 18px; background: var(--panel, #17142a); color: var(--texto, #f1effa); overflow: hidden; }
dialog.mkw-bv[open] { display: flex; flex-direction: column; }
dialog.mkw-bv::backdrop { background: #05031099; }
.mkw-bv .bv-cabeza { position: relative; padding: 18px 56px 4px 20px; }
.mkw-bv h2 { margin: 0; font: 400 22px 'Lilita One', system-ui, sans-serif; color: var(--amarillo, #ffd21f); }
.mkw-bv .bv-sub { margin: 2px 0 0; font-size: 14px; color: var(--suave, #a7a3bd); }
.mkw-bv .bv-x { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; border: 0; border-radius: 12px; background: none;
  color: var(--suave, #a7a3bd); font-size: 22px; cursor: pointer; }
.mkw-bv .bv-x:hover { background: #ffffff14; color: var(--texto, #f1effa); }
.mkw-bv .bv-tarjetas { flex: 1 1 auto; min-height: 0; overflow: auto; display: grid; gap: 10px; padding: 12px 20px; grid-template-columns: 1fr; }
@media (min-width: 520px) { .mkw-bv .bv-tarjetas { grid-template-columns: 1fr 1fr; } }
.bv-tarjeta { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 14px; background: var(--panel2, #201c38);
  border: 1px solid var(--linea, #3a3361); }
.bv-tarjeta b { font-size: 15px; color: var(--texto, #f1effa); }
.bv-tarjeta p { margin: 0; flex: 1; font-size: 14px; line-height: 1.4; color: var(--suave, #a7a3bd); }
.bv-botones { display: flex; flex-wrap: wrap; gap: 6px; }
.bv-ir { min-height: 40px; padding: 6px 12px; border-radius: 10px; border: 1px solid #4b3d93; background: #2a2350; color: var(--texto, #f1effa);
  font: 600 13.5px 'IBM Plex Sans', system-ui, sans-serif; cursor: pointer; }
.bv-ir:hover { border-color: var(--lila, #ab8bff); }
.bv-hecho { font-size: 13px; color: var(--verde, #3fd59a); }
.bv-hecho button { margin-left: 6px; background: none; border: 0; padding: 4px 6px; color: var(--lila, #ab8bff); text-decoration: underline; cursor: pointer; font: inherit; }
.mkw-bv .bv-pie { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 20px 16px; border-top: 1px solid var(--linea, #3a3361); }
.mkw-bv .bv-donde { flex: 1 1 200px; margin: 0; font-size: 13px; color: var(--suave, #a7a3bd); }
.mkw-bv .bv-nunca { min-height: 44px; padding: 6px 8px; background: none; border: 0; color: var(--suave, #a7a3bd); text-decoration: underline;
  cursor: pointer; font: 13px 'IBM Plex Sans', system-ui, sans-serif; }
.mkw-bv .bv-jugar { min-height: 48px; padding: 8px 22px; border: 0; border-radius: 12px; background: var(--amarillo, #ffd21f); color: #2a1a00;
  font: 400 19px 'Lilita One', system-ui, sans-serif; cursor: pointer; }
.mkw-bv button:focus-visible, .bv-ayuda button:focus-visible, .bv-ayuda summary:focus-visible { outline: 3px solid var(--lila, #ab8bff); outline-offset: 2px; }
.mkw-bv .bv-tarjetas.hay-mas { -webkit-mask-image: linear-gradient(#000 calc(100% - 36px), #0000); mask-image: linear-gradient(#000 calc(100% - 36px), #0000); }
.mkw-bv .bv-mas { align-self: center; margin: -6px 0 2px; min-height: 32px; padding: 2px 14px; border: 0; border-radius: 999px; background: #2a2350;
  color: var(--texto, #f1effa); font: 600 13px 'IBM Plex Sans', system-ui, sans-serif; cursor: pointer; }
/* el teléfono parado: una hoja que sube desde abajo */
@media (max-width: 519px) {
  dialog.mkw-bv { max-width: calc(100vw - 32px); max-height: 85vh; margin: auto auto calc(16px + env(safe-area-inset-bottom, 0px)); }
  .mkw-bv .bv-ir, .mkw-bv .bv-nunca { min-height: 48px; }
  .mkw-bv .bv-jugar { flex: 1 1 auto; }
}
/* acostado y bajo (un teléfono): título y subtítulo en una línea, las tarjetas con su propio desplazamiento */
@media (max-height: 520px) and (orientation: landscape) {
  dialog.mkw-bv { max-width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 16px); }
  .mkw-bv .bv-cabeza { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding-top: 10px; }
  .mkw-bv .bv-tarjetas { grid-template-columns: 1fr 1fr; padding: 8px 20px; }
  .mkw-bv .bv-pie { padding: 8px 20px 10px; justify-content: flex-end; }
  .mkw-bv .bv-ir { min-height: 44px; }
}
/* mientras está abierto, el mando en pantalla no tapa */
body.con-bienvenida .mkw-tactil { visibility: hidden; }
/* el ajuste al que se llegó: borde lila que late dos veces y se apaga en 2,5 s */
@keyframes bv-late { 0%, 100% { box-shadow: 0 0 0 2px #ab8bff, 0 0 0 0 #ab8bff00; } 25%, 75% { box-shadow: 0 0 0 2px #ab8bff, 0 0 0 6px #ab8bff55; } }
.bv-resaltado { border-radius: 10px; background: #ab8bff26 !important; box-shadow: 0 0 0 2px #ab8bff; animation: bv-late 1.25s ease-in-out 2; }
@media (prefers-reduced-motion: reduce) { .bv-resaltado { animation: none; } }
/* la Ayuda de ajustes (Avanzado) */
.bv-ayuda details { border: 1px solid var(--linea, #3a3361); border-radius: 12px; background: var(--panel2, #201c38); margin: 0 0 6px; }
.bv-ayuda summary { padding: 10px 12px; cursor: pointer; font-weight: 600; color: var(--texto, #f1effa); min-height: 24px; }
.bv-ayuda details > div { padding: 0 12px 12px; }
.bv-ayuda p { margin: 0 0 8px; font-size: 13.5px; }
.bv-ayuda .bv-ver { margin: 8px 0 0; }
`;
function ponerEstilos(doc) {
  if (doc.getElementById('estiloBienvenida')) return;
  const s = doc.createElement('style'); s.id = 'estiloBienvenida'; s.textContent = CSS; doc.head.append(s);
}

const el = (doc, tag, props = {}, ...hijos) => {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('aria-') || k === 'role') e.setAttribute(k, v);
    else e[k] = v;
  }
  e.append(...hijos.filter(h => h != null));
  return e;
};

// Llevar a un ajuste: abrir la hoja, bajar hasta la fila, marcarla y dejar el foco en su control.
// abrirHoja(nombre) la abre (ui.abrirCajon, sin cerrarla si ya está abierta). Devuelve el control encontrado (o null).
export function llevarA(destino, { abrirHoja, doc = globalThis.document, ms = 2500 } = {}) {
  const d = DESTINOS[destino];
  if (!d) return null;
  abrirHoja?.(d.hoja);
  const control = doc.querySelector(d.control);
  if (!control) return null;
  const fila = (d.fila && doc.querySelector(d.fila)) || control.closest('.fila') || control;
  try { fila.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch { try { fila.scrollIntoView(); } catch {} }
  fila.classList.remove('bv-resaltado'); void fila.offsetWidth; fila.classList.add('bv-resaltado');
  setTimeout(() => fila.classList.remove('bv-resaltado'), ms);
  let foco = control.matches('button, input, select, summary, [tabindex]') ? control
    : control.querySelector('button, input, select, summary, [tabindex]');
  if (foco?.disabled) foco = fila;                              // (fijado por la dirección, gris: el foco a su fila)
  if (!foco) foco = control;
  if (!foco.matches('button, input, select, summary, [tabindex]')) foco.tabIndex = -1;   // (una caja sin controles: el foco a la caja misma)
  try { foco?.focus({ preventScroll: true }); } catch {}
  return control;
}

// los botones de un caso: { texto, ir } lleva; { texto, hace: 'liviano' } lo pone ahí mismo con «Deshacer» 6 s
function armarBotones(doc, lista, { ir, liviano, editor, dondeHecho }) {
  return lista.map(b => {
    const boton = el(doc, 'button', { type: 'button', className: 'bv-ir', textContent: b.texto });
    boton.dataset.bv = b.ir || b.hace;
    boton.onclick = () => {
      if (b.ir) return ir(b.ir);
      if (b.hace === 'editor') return editor?.();
      if (b.hace === 'liviano') {
        const deshacer = liviano?.();
        const nota = dondeHecho();
        const bDeshacer = el(doc, 'button', { type: 'button', textContent: 'Deshacer' });
        nota.replaceChildren('✓ Liviano puesto', bDeshacer);
        nota.hidden = false;
        bDeshacer.onclick = () => { try { deshacer?.(); } catch {} nota.replaceChildren('Vuelto como estaba.'); setTimeout(() => { nota.hidden = true; }, 2000); };
        try { bDeshacer.focus(); } catch {}
        setTimeout(() => { if (nota.contains(bDeshacer)) { nota.hidden = true; try { boton.focus(); } catch {} } }, 6000);
      }
    };
    return boton;
  });
}

// ---------------- el mensaje ----------------
export function montarBienvenida({ doc = globalThis.document, parametros = new URLSearchParams(globalThis.location?.search || ''),
                                   almacen = almacenDe(), webdriver = !!globalThis.navigator?.webdriver, telefono = false,
                                   puedeMostrar = () => true, abrirHoja = null, liviano = null, editor = null, calibrar = true,
                                   alAbrir = null, alCerrar = null, nota = () => {}, cada = 1000, version = VERSION_BIENVENIDA } = {}) {
  ponerEstilos(doc);
  const decision = decidirBienvenida({ parametros, almacen, webdriver, version });
  const estado = { decision, abierto: false, visto: false, nunca: false, abiertoEn: null, cerradoCon: null, idas: [] };
  let dialogo = null, reloj = null;

  function cerrar(con = 'jugar', { marcar = true } = {}) {
    if (!dialogo?.open) return;
    estado.cerradoCon = con;
    if (marcar) {
      estado.visto = escribir(almacen, CLAVE_VERSION, version) || true;
      if (con === 'nunca') { estado.nunca = true; escribir(almacen, CLAVE_NUNCA, '1'); }
    }
    dialogo.close();
    alCerrado();                           // (en el momento: el evento «close» llega recién en la tarea siguiente)
  }
  // lo de cerrarse, una sola vez (también si lo cierra otro: la B del mando del sitio cierra el diálogo directo)
  function alCerrado() {
    if (!estado.abierto) return;
    estado.abierto = false;
    doc.body.classList.remove('con-bienvenida');
    alCerrar?.(estado.cerradoCon);
    nota(`bienvenida (§263): cerrada con «${estado.cerradoCon || 'sin marcar'}»`);
  }
  function ir(destino) {
    estado.idas.push(destino);
    cerrar('ir:' + destino);
    llevarA(destino, { abrirHoja, doc });
  }
  function armar() {
    const hecho = el(doc, 'p', { className: 'bv-hecho', role: 'status', hidden: true });
    const tarjetas = casos({ telefono, calibrar }).filter(c => !c.soloAyuda).map(c =>
      el(doc, 'section', { className: 'bv-tarjeta', dataset: { caso: c.id } },
        el(doc, 'b', { textContent: `${c.icono} ${c.titulo}` }),
        el(doc, 'p', { textContent: c.corto }),
        el(doc, 'div', { className: 'bv-botones' }, ...armarBotones(doc, c.botones, { ir, liviano, editor: () => { cerrar('ir:editor'); editor?.(); }, dondeHecho: () => {
          const t = tarjetas.find(x => x.dataset.caso === c.id); if (!t.contains(hecho)) t.append(hecho); return hecho; } }))));
    // §263 (el crítico): si las tarjetas no caben (un teléfono), el borde de abajo se difumina y sale «▾ Más abajo»
    const lista = el(doc, 'div', { className: 'bv-tarjetas' }, ...tarjetas);
    const mas = el(doc, 'button', { type: 'button', className: 'bv-mas', hidden: true, textContent: '▾ Más abajo', tabIndex: -1 });
    const verMas = () => { const hay = lista.scrollHeight > lista.clientHeight + 4 && lista.scrollTop + lista.clientHeight < lista.scrollHeight - 4;
      mas.hidden = !hay; lista.classList.toggle('hay-mas', hay); };
    lista.addEventListener('scroll', verMas, { passive: true });
    mas.onclick = () => lista.scrollBy({ top: lista.clientHeight * 0.8, behavior: 'smooth' });
    const x = el(doc, 'button', { type: 'button', className: 'bv-x', textContent: '✕', 'aria-label': 'Cerrar' });
    const nunca = el(doc, 'button', { type: 'button', className: 'bv-nunca', id: 'bienvenidaNunca', textContent: 'No volver a mostrar' });
    const jugar = el(doc, 'button', { type: 'button', className: 'bv-jugar', id: 'bienvenidaJugar', textContent: '¡A jugar!' });
    x.onclick = () => cerrar('x'); nunca.onclick = () => cerrar('nunca'); jugar.onclick = () => cerrar('jugar');
    const d = el(doc, 'dialog', { className: 'mkw-bv', id: 'bienvenida', 'aria-labelledby': 'bienvenidaTitulo' },
      el(doc, 'div', { className: 'bv-cabeza' },
        el(doc, 'h2', { id: 'bienvenidaTitulo', textContent: 'Te damos la bienvenida a JloKart Wii' }),
        el(doc, 'p', { className: 'bv-sub', textContent: 'Ajústalo a tu aparato. Si algo te molesta, el botón de tu caso te lleva al ajuste.' }), x),
      lista,
      mas,
      el(doc, 'div', { className: 'bv-pie' },
        el(doc, 'p', { className: 'bv-donde', textContent: 'Para volver a verlo: ⚙ → Avanzado → Ayuda de ajustes.' }), nunca, jugar));
    // Esc y la B del mando (mando.js manda un Escape): cierra y cuenta como visto
    d.addEventListener('cancel', e => { e.preventDefault(); cerrar('esc'); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar('esc'); } });
    // tocar fuera (en el velo: el clic cae en el <dialog> mismo, fuera de su recuadro)
    d.addEventListener('click', e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrar('fuera');
    });
    d.addEventListener('close', () => {
      // cerrado desde afuera (mando.js hace dialog.close() si nadie atajó su Escape): cuenta como visto
      if (estado.abierto && d === dialogo && !estado.cerradoCon) { estado.cerradoCon = 'afuera'; estado.visto = true; escribir(almacen, CLAVE_VERSION, version); }
      if (d === dialogo) alCerrado();
    });
    doc.body.append(d);
    return { d, jugar, verMas };
  }
  function abrir() {
    if (dialogo?.open) return true;
    dialogo?.remove();                     // (antes de armar el nuevo: los dos llevan los mismos id)
    const a = armar();
    dialogo = a.d;
    dialogo.showModal();
    estado.abierto = true; estado.abiertoEn = Math.round(performance.now()); estado.cerradoCon = null;
    doc.body.classList.add('con-bienvenida');
    try { a.jugar.focus(); } catch {}
    a.verMas(); requestAnimationFrame?.(() => a.verMas());
    alAbrir?.();
    nota(`bienvenida (§263): abierta (${decision.porque})`);
    return true;
  }
  // cada segundo, si toca y es el momento, abrir; si se abrió y llegó una carrera (la sala largó), cerrar sin marcar
  function revisar() {
    if (dialogo?.open) { if (!puedeMostrar({ abierto: true })) cerrar('carrera', { marcar: false }); return; }
    if (!decision.mostrar || estado.visto) { if (reloj) { clearInterval(reloj); reloj = null; } return; }
    if (puedeMostrar({ abierto: false })) abrir();
  }
  if (decision.mostrar) reloj = setInterval(revisar, cada);
  nota(`bienvenida (§263): ${decision.mostrar ? 'se mostrará' : 'no se muestra'} (${decision.porque})`);
  return { abrir, cerrar, revisar, get estado() { return { ...estado, abierto: !!dialogo?.open }; }, get dialogo() { return dialogo; } };
}

// ---------------- la Ayuda (Avanzado): el mismo texto en acordeón, con la línea de más y más botones ----------------
export function montarAyuda(nodo, { doc = globalThis.document, telefono = false, abrirHoja = null, liviano = null, editor = null,
                                     alIr = null, abrirMensaje = null, calibrar = true } = {}) {
  if (!nodo) return null;
  ponerEstilos(doc);
  const ir = destino => { alIr?.(destino); llevarA(destino, { abrirHoja, doc }); };
  const secciones = casos({ telefono, calibrar }).map(c => {
    const hecho = el(doc, 'p', { className: 'bv-hecho', role: 'status', hidden: true });
    const det = el(doc, 'details', { dataset: { caso: c.id }, open: telefono && c.id === 'celular' },
      el(doc, 'summary', { textContent: `${c.icono} ${c.titulo}` }),
      el(doc, 'div', {},
        el(doc, 'p', { textContent: c.corto }),
        c.extra ? el(doc, 'p', { textContent: c.extra }) : null,
        el(doc, 'div', { className: 'bv-botones' }, ...armarBotones(doc, c.botonesAyuda, { ir, liviano, editor, dondeHecho: () => hecho })),
        hecho));
    return det;
  });
  const otraVez = el(doc, 'button', { type: 'button', className: 'boton chico', id: 'ayudaVerMensaje', textContent: 'Ver el mensaje de bienvenida' });
  otraVez.onclick = () => abrirMensaje?.();
  nodo.classList.add('bv-ayuda');
  nodo.replaceChildren(...secciones,
    el(doc, 'p', { className: 'nota-graficos', textContent: '¿Pedirás ayuda a alguien? Copia el informe en ⚙ → Avanzado → Diagnóstico y pégaselo.' }),
    abrirMensaje ? otraVez : null);
  return { secciones };
}
