// La cara de la página: pantalla de inicio, modos, barra, cajón de paneles, "Tu partida" y diálogos — bitácora §55.
//
// Resumen: mkw.mjs arranca el juego; este módulo es todo lo que la persona ve y toca alrededor:
//   - diálogos propios (preguntar / avisar) en vez de confirm()/alert(), que dentro del marco del sitio no andan;
//   - la barra de arriba (se esconde sola mientras se juega y vuelve al mover el mouse o tocar), el volumen chico,
//     el estado del mando y «← Juegos» cuando la página está dentro del sitio;
//   - el cajón de la derecha con sus pestañas (Partida, Controles, Avanzado);
//   - "Tu partida": lee el rksys.dat guardado y muestra sus licencias (nombre, VR, carreras, código de amigo); cargar
//     un rksys.dat de la Wii o de Dolphin o una copia .mkwp (botón o arrastrando el archivo), descargar, borrar, y las
//     copias de respaldo automáticas (respaldos.mjs) antes de todo lo que reemplaza la partida;
//   - la columna de modos (window.mkwModo dice cuál se eligió; mkw.mjs lo usa al arrancar). La portada (tarjeta +
//     modos) solo aparece con ?portada=1 (banco y pruebas de la página): lo normal es entrar directo al juego (§66);
//   - la cortina (ui.cortina(texto) / ui.cortina(false)): tapa la pantalla mientras el juego carga y mientras el piloto
//     recorre solo sus menús; ui.cortina(texto, true) la deja con un error.
//
// Uso (en mkw.mjs):  const ui = crearInterfaz({ guardado, sonido, controles, alCambiarGuardado });
//                    ui.preguntar({...}), ui.avisar(...), ui.partidaCambio(), ui.sonidoCambio(), ui.empezo()

import { leerRksys, resumenLicencia, queArchivo, RUTA_RKSYS, leerRating, RUTA_RATING } from './licencias.mjs';
import { crearRespaldos } from './respaldos.mjs';
import { abrirEditorMii } from './editor-mii.mjs';
import { leerInvitados } from './invitados.mjs';
import { crearImagenes } from './imagenes.mjs';
import { textoTiempo, nombreCategoria } from './records.mjs';
import { crearLista, crearPresets, crearSonidosLista, MAX_PISTAS } from './lista-pistas.mjs';

const $ = id => document.getElementById(id);
const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };
const hora = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const fecha = t => new Date(t).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const guardarPref = (k, v) => { try { localStorage.setItem('mkw.' + k, JSON.stringify(v)); } catch {} };
const leerPref = (k, d) => { try { const v = localStorage.getItem('mkw.' + k); return v ? JSON.parse(v) : d; } catch { return d; } };

// Los emblemas de los modos: dibujos nuestros, simples (volante, trofeo, bandera, reloj, globo, mundo, carita)
const ICONOS = {
  libre: '<circle cx="16" cy="16" r="11" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="16" cy="16" r="3.2" fill="#fff"/><path d="M5.5 14h7.5M19 14h7.5M16 19.5V27" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>',
  gp: '<path d="M9 5h14v6a7 7 0 0 1-14 0z" fill="#fff"/><path d="M9 7H5a4 4 0 0 0 4 6M23 7h4a4 4 0 0 1-4 6" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M14 18h4v5h-4zM10 24h12v3H10z" fill="#fff"/>',
  copa: '<rect x="4" y="4" width="11" height="11" rx="2.5" fill="#fff"/><rect x="17" y="4" width="11" height="11" rx="2.5" fill="#ffffffaa"/><rect x="4" y="17" width="11" height="11" rx="2.5" fill="#ffffffaa"/><rect x="17" y="17" width="11" height="11" rx="2.5" fill="#fff"/>',
  vs: '<path d="M8 4v25" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M9 5h16v12H9z" fill="#fff"/><path d="M9 5h4v4H9zm8 0h4v4h-4zm-4 4h4v4h-4zm8 0h4v4h-4zm-12 4h4v4H9zm8 0h4v4h-4z" fill="#222"/>',
  tt: '<circle cx="16" cy="18" r="10" fill="none" stroke="#fff" stroke-width="3"/><path d="M16 18v-6M16 18l4 3" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M13 4h6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  bat: '<ellipse cx="16" cy="12" rx="8" ry="9" fill="#fff"/><path d="M16 21l-2 3h4z" fill="#fff"/><path d="M16 24c0 3-3 3-3 6" fill="none" stroke="#fff" stroke-width="1.8"/><ellipse cx="13" cy="9" rx="2" ry="3" fill="#ffffff88"/>',
  red: '<circle cx="16" cy="16" r="11" fill="none" stroke="#fff" stroke-width="2.8"/><path d="M5 16h22M16 5c-5 6-5 16 0 22M16 5c5 6 5 16 0 22" fill="none" stroke="#fff" stroke-width="2.4"/>',
  mii: '<circle cx="16" cy="14" r="9" fill="#fff"/><path d="M7 29c1-6 5-8 9-8s8 2 9 8z" fill="#fff"/><circle cx="13" cy="13" r="1.4" fill="#333"/><circle cx="19" cy="13" r="1.4" fill="#333"/><path d="M13 17q3 2 6 0" fill="none" stroke="#333" stroke-width="1.4" stroke-linecap="round"/>',
};
// Los modos. `listo` = ya funciona desde la página; los demás se juegan entrando con «Jugar libre» y eligiéndolos en el
// menú del juego, hasta que la página sepa llevarte directo (bitácora §55, "elegir carrera").
// §99: el editor de Mii («Mi Mii»), apagado hasta una actualización futura (?editorMii=1 = prendido, para probarlo)
export const EDITOR_MII = new URLSearchParams(globalThis.location?.search || '').get('editorMii') === '1';
export const MODOS = [
  { id: 'libre', nombre: 'Jugar libre', texto: 'Los menús del juego, como en la Wii: todos los modos y las 200+ pistas.', listo: true },
  { id: 'gp', nombre: 'Gran Premio', texto: 'Una copa completa: 4 carreras contra la CPU. Te llevamos directo.', listo: true },
  { id: 'vs', nombre: 'Carrera', texto: 'La pista que elijas, contra la CPU. Te llevamos directo.', listo: true },
  { id: 'copa', nombre: 'Copa a tu gusto', texto: '4 pistas que eliges tú o al azar, en el orden que quieras.', listo: true },
  { id: 'tt', nombre: 'Contrarreloj', texto: 'Tú contra el reloj y el mejor fantasma. Te llevamos directo.', listo: true },
  { id: 'bat', nombre: 'Batalla', texto: 'Globos o monedas en las arenas.', listo: false },
  { id: 'red', nombre: 'En línea', texto: 'Salas de Paginita Pro: juega con tus amigos.', listo: false },
  // §99 (el dueño): personalizar los Mii queda para una actualización futura: sin «Mi Mii» salvo con ?editorMii=1
  ...(EDITOR_MII ? [{ id: 'mii', nombre: 'Mi Mii', texto: 'Crea o cambia tu Mii sin abrir el juego.', listo: true, accion: true }] : []),
];

// estadoNube() = el estado de las partidas en la nube (nube.mjs) o null si no hay (sin sesión, fuera del sitio)
export function crearInterfaz({ guardado, sonido, controles, alCambiarGuardado = () => {}, imagenes = '/build/imagenes',
                               estadoNube = () => null }) {
  const respaldos = crearRespaldos();
  const enJuegos = window.parent !== window;
  const conPortada = new URLSearchParams(location.search).get('portada') === '1';
  if (conPortada) document.body.classList.add('portada');
  if (enJuegos) document.documentElement.classList.add('en-juegos');

  // ---------------- Diálogos ----------------
  // preguntar({ titulo, texto (HTML propio, nunca datos de un archivo sin escapar), si, no, peligro }) → true/false
  const dialogo = $('dialogo');
  function preguntar({ titulo, texto = '', nodo = null, si = 'Aceptar', no = 'Cancelar', peligro = false }) {
    return new Promise(listo => {
      dialogo.querySelector('h2').textContent = titulo;
      const cuerpo = dialogo.querySelector('.cuerpo');
      cuerpo.innerHTML = texto;
      if (nodo) cuerpo.append(nodo);
      const acciones = dialogo.querySelector('.acciones');
      acciones.innerHTML = '';
      const terminar = v => { dialogo.close(); listo(v); };
      if (no) acciones.append(el('button', { type: 'button', className: 'boton', textContent: no, onclick: () => terminar(false) }));
      const b = el('button', { type: 'button', className: 'boton ' + (peligro ? 'peligro' : 'principal'), textContent: si, onclick: () => terminar(true) });
      acciones.append(b);
      dialogo.onclose = () => listo(false);           // Esc
      // Esc cierra el diálogo aunque la tecla esté tomada por los controles del juego (Esc = Start), que le quitan al
      // navegador su cierre automático: se cierra a mano
      dialogo.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminar(false); } };
      dialogo.showModal();
      b.focus();
    });
  }
  const avisar = (titulo, texto = '') => preguntar({ titulo, texto, no: null, si: 'Entendido' });
  const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- Barra ----------------
  // Con el juego andando se esconde sola (como un reproductor de video): vuelve 2,5 s al mover el mouse o tocar
  let tBarra = 0;
  const barraViva = () => { document.body.classList.add('barra-viva'); clearTimeout(tBarra); tBarra = setTimeout(() => document.body.classList.remove('barra-viva'), 2500); };
  addEventListener('mousemove', barraViva, { passive: true });
  addEventListener('touchstart', e => { if (!e.target.closest('.mkw-tactil')) barraViva(); }, { passive: true });
  // «← Juegos»: dentro del sitio, vuelve al salón. Con el juego andando, dos clics (el primero avisa en el botón)
  let seguro = 0;
  $('volverJuegos').onclick = e => {
    const b = e.currentTarget;
    if (document.body.classList.contains('started') && !seguro) {
      b.textContent = '¿Salir? Lo no guardado se pierde'; b.classList.add('seguro');
      seguro = setTimeout(() => { seguro = 0; b.textContent = '← Juegos'; b.classList.remove('seguro'); }, 4000);
      return;
    }
    guardado.guardarPendientes().finally(() => window.parent.postMessage({ canal: 'mkw-hijo', tipo: 'volver' }, location.origin));
  };
  // Volumen: en el sitio manda el del sitio (volumen.js, [data-volumen]); si no está, el nuestro (sonido.mjs)
  if (window.VolumenJuego && window.VolumenJuego.control) {
    const lugar = document.querySelector('[data-volumen]');
    lugar.hidden = false; $('volMini').hidden = true;
    try { window.VolumenJuego.control(lugar); } catch {}
  }
  const volBarra = $('volMiniBarra'), volMudo = $('volMiniMudo');
  volBarra.addEventListener('input', () => { sonido.volumen(volBarra.value / 100); if (sonido.estado.silencio) sonido.silenciar(false); });
  volMudo.addEventListener('click', () => sonido.silenciar(!sonido.estado.silencio));
  function sonidoCambio() {
    const e = sonido.estado;
    volBarra.value = Math.round(e.volumen * 100);
    volMudo.textContent = e.silencio || e.volumen === 0 ? '🔇' : '🔊';
  }
  sonidoCambio();
  // El mando: la pastilla dice cuál hay (o que falta apretar un botón); con más de uno, qué jugador es cada uno.
  // Un clic abre Controles, donde se elige qué jugador es cada mando (como en BT3: la pastilla abre los ajustes).
  const pastilla = $('mando');
  pastilla.style.cursor = 'pointer';
  pastilla.title = 'Controles: qué jugador es cada mando, sus botones y probarlo';
  pastilla.addEventListener('click', () => abrirCajon('controles'));
  setInterval(() => {
    const m = controles.estado.mandos.slice().sort((a, b) => (a.puerto ?? 9) - (b.puerto ?? 9));
    const corto = x => x.nombre.replace(/\s*\(.*\)$/, '');
    pastilla.classList.toggle('ok', m.length > 0);
    pastilla.textContent = controles.estado.bloqueados ? 'Mandos bloqueados aquí'
      : !m.length ? 'Mando: aprieta un botón'
      : '🎮 ' + (m.length === 1 ? corto(m[0]) : m.map(x => `${x.puerto === undefined ? '–' : 'J' + (x.puerto + 1)} ${corto(x)}`).join(' · '));
    pastilla.hidden = document.body.classList.contains('tactil') && !m.length;
  }, 500);

  // ---------------- Cajón ----------------
  const HOJAS = ['partida', 'controles', 'avanzado'];
  const hojaDe = n => $('hoja' + n[0].toUpperCase() + n.slice(1));
  let hojaAbierta = null;
  function abrirCajon(nombre) {
    if (hojaAbierta === nombre) return cerrarCajon();
    hojaAbierta = nombre;
    for (const h of HOJAS) hojaDe(h).hidden = h !== nombre;
    document.querySelectorAll('.pestanas [data-hoja]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.hoja === nombre)));
    document.querySelectorAll('#barra [data-abre]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.abre === nombre)));
    document.body.classList.add('cajon-abierto');
    if (nombre === 'partida') pintarRespaldos();
  }
  function cerrarCajon() {
    hojaAbierta = null;
    document.body.classList.remove('cajon-abierto');
    document.querySelectorAll('#barra [data-abre]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (document.body.classList.contains('started')) $('canvas').focus();   // las teclas vuelven al juego
  }
  document.querySelectorAll('[data-abre]').forEach(b => b.addEventListener('click', () => abrirCajon(b.dataset.abre)));
  document.querySelectorAll('.pestanas [data-hoja]').forEach(b => b.addEventListener('click', () => { hojaAbierta = null; abrirCajon(b.dataset.hoja); }));
  $('cerrarCajon').onclick = cerrarCajon;
  // Esc cierra el cajón (y no le llega al juego, donde Esc es Start)
  addEventListener('keydown', e => { if (e.code === 'Escape' && hojaAbierta && !dialogo.open) { e.stopImmediatePropagation(); e.preventDefault(); cerrarCajon(); } }, true);

  // ---------------- Tu partida ----------------
  let licencias = [];
  function fichaLicencia(l) {
    const detalle = resumenLicencia(l) || 'sin carreras todavía';
    const nombre = el('strong', { textContent: l.nombre, translate: false });   // el nombre del Mii no se traduce
    nombre.setAttribute('translate', 'no');
    return el('div', { className: 'licencia' },
      el('span', { className: 'num', textContent: l.casilla }),
      el('span', {}, nombre, el('small', { textContent: detalle })),
      ...(l.codigoAmigo ? [el('span', { className: 'ca', title: 'Código de amigo', textContent: l.codigoAmigo })] : []));
  }
  let tPartida = 0;
  const partidaCambio = () => { clearTimeout(tPartida); tPartida = setTimeout(pintarPartida, 800); };
  async function pintarPartida() {
    let info = null;
    try { const b = await guardado.leerArchivo(RUTA_RKSYS); if (b) info = leerRksys(b); } catch {}
    licencias = info && info.crcBien ? info.licencias : [];
    // el VR que usa Retro Rewind está en RRRating.pul (por ID de perfil): ese manda sobre el de rksys.dat
    try { const rr = leerRating(await guardado.leerArchivo(RUTA_RATING)); for (const l of licencias) { const x = rr.get(l.pid); if (x) Object.assign(l, x); } } catch {}
    for (const id of ['licenciasInicio', 'licenciasPanel']) $(id).replaceChildren(...licencias.map(fichaLicencia));
    $('partidaVacia').hidden = licencias.length > 0;
    const e = guardado.estado, chip = $('chipPartida');
    chip.className = 'chip' + (licencias.length ? ' bien' : '');
    // Con sesión en el sitio: «en tu cuenta» cuando la última versión ya subió; si la nube no responde, se dice
    const n = estadoNube();
    const enCuenta = n && n.activa && !n.error && (n.ultimaSubida || n.bajadas || n.accion === 'iguales');
    chip.textContent = e.error ? 'error al guardar' : licencias.length
      ? (n && n.activa && n.error ? `guardada aquí (tu cuenta no responde)`
         : enCuenta && n.ultimaSubida && n.ultimaSubida >= (e.ultimoGuardado || 0) ? `en tu cuenta · ${hora(n.ultimaSubida)}`
         : enCuenta && !e.ultimoGuardado ? 'en tu cuenta'
         : e.ultimoGuardado ? `guardada aquí · ${hora(e.ultimoGuardado)}` : 'guardada en este navegador') : 'sin partida';
    chip.title = n && n.activa ? `Partidas en tu cuenta: ${n.accion || '…'}${n.error ? ' — ' + n.error : ''}` : '';
    $('bajarRksys').disabled = !info;
  }
  pintarPartida();

  // Foto de todo lo guardado antes de reemplazarlo (si hay algo que fotografiar)
  async function respaldar(motivo) {
    try {
      await guardado.cargar();
      if (!guardado.estado.archivos) return;
      await respaldos.guardar(await guardado.exportar(), motivo, licencias);
    } catch (e) { console.warn('[respaldo] ' + e); }
  }
  async function pintarRespaldos() {
    const ul = $('listaRespaldos');
    let lista = [];
    try { lista = await respaldos.lista(); } catch {}
    if (!lista.length) { ul.replaceChildren(el('li', {}, el('span', { textContent: 'Ninguna todavía: se hace una sola antes de cargar, borrar o restaurar.' }))); return; }
    ul.replaceChildren(...lista.map(r => {
      const quien = r.licencias.map(l => l.nombre).join(', ') || 'sin licencias';
      const b = el('button', { type: 'button', className: 'boton', textContent: 'Restaurar' });
      b.onclick = async () => {
        if (!await preguntar({ titulo: 'Restaurar una copia', si: 'Restaurar',
          texto: `Vuelve la partida a como estaba el <b>${escapar(fecha(r.fecha))}</b> (${escapar(quien)}). Lo de ahora queda en otra copia de respaldo. Se recarga la página.` })) return;
        await respaldar('antes de restaurar una copia');
        await guardado.importar(await respaldos.leer(r.id));
        location.reload();
      };
      const s = el('span', {}, el('b', { textContent: fecha(r.fecha) }), el('small', { textContent: `${r.motivo} · ${quien}` }));
      s.querySelector('small').setAttribute('translate', 'no');
      return el('li', {}, s, b);
    }));
  }

  // Cargar un archivo: se mira QUÉ es por dentro (no por el nombre), se revisa, se muestra y se pregunta
  async function cargarArchivo(archivo) {
    if (archivo.size > 64 * 1048576) return avisar('Archivo muy grande', 'Una partida de Mario Kart Wii pesa 2,8 MB (una copia .mkwp, unos pocos KB). Este archivo no es una partida.');
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const tipo = queArchivo(bytes);
    if (tipo === 'rfldb' || tipo === 'mii') {
      if (!EDITOR_MII) return avisar('Archivo de Mii', 'Cambiar o cargar Mii llega en una actualización próxima. Por ahora, tu licencia usa el Mii que ya tiene.');
      return abrirMii({ importar: bytes, nombreArchivo: archivo.name });
    }
    let nuevas, aplicar;
    if (tipo === 'rksys') {
      const info = leerRksys(bytes);
      if (!info.valido) return avisar('No se puede cargar', `Ese archivo ${escapar(info.problema)}.`);
      nuevas = info.licencias;
      aplicar = () => guardado.ponerArchivo(RUTA_RKSYS, bytes);
    } else if (tipo === 'paquete') {
      let archivos;
      try { archivos = await guardado.abrirPaquete(archivo); }
      catch (e) { return avisar('No se puede cargar', `Ese archivo no es una copia de partidas de esta página (${escapar(e.message)}).`); }
      const rk = archivos.find(([ruta]) => ruta === RUTA_RKSYS);
      nuevas = rk ? leerRksys(rk[1].datos).licencias : [];
      aplicar = () => guardado.importar(archivo);
    } else {
      return avisar('Archivo desconocido', 'Eso no parece una partida de Mario Kart Wii. Se puede cargar el <b>rksys.dat</b> de una Wii o de Dolphin, una copia <b>.mkwp</b> de esta página, una base de Mii (<b>RFL_DB.dat</b>) o un Mii (<b>.mii</b>).');
    }
    const lista = el('div', { className: 'licencias', style: 'margin-top:10px' }, ...nuevas.map(fichaLicencia));
    const reemplaza = licencias.length
      ? `<p>Reemplaza la partida de este navegador (${licencias.map(l => `<b translate="no">${escapar(l.nombre)}</b>`).join(', ')}). Antes se guarda una copia de respaldo, por si acaso.</p>` : '';
    const si = await preguntar({ titulo: 'Cargar esta partida', si: 'Cargar y recargar',
      texto: `<p>${nuevas.length ? `Trae ${nuevas.length} licencia${nuevas.length === 1 ? '' : 's'}:` : 'No trae licencias (una partida vacía).'}</p>${reemplaza}`, nodo: lista });
    if (!si) return;
    await respaldar('antes de cargar ' + (archivo.name || 'un archivo'));
    await aplicar();
    guardado.pedirPersistencia();
    location.reload();
  }
  const archivoPartidas = $('archivoPartidas');
  document.querySelectorAll('[data-cargar]').forEach(b => b.addEventListener('click', () => { archivoPartidas.value = ''; archivoPartidas.click(); }));
  archivoPartidas.addEventListener('change', () => { const f = archivoPartidas.files[0]; if (f) cargarArchivo(f); });
  // Arrastrar un archivo a la página (antes de jugar o con el cajón abierto: en pleno juego no molesta)
  const soltar = $('soltar');
  let arrastres = 0;
  const llevaArchivo = e => [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (!llevaArchivo(e)) return; arrastres++; soltar.hidden = false; });
  addEventListener('dragleave', () => { if (--arrastres <= 0) { arrastres = 0; soltar.hidden = true; } });
  addEventListener('dragover', e => { if (llevaArchivo(e)) e.preventDefault(); });
  addEventListener('drop', e => {
    if (!llevaArchivo(e)) return;
    e.preventDefault(); arrastres = 0; soltar.hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) cargarArchivo(f);
  });

  const bajar = (blob, nombre) => {
    const a = el('a', { href: URL.createObjectURL(blob), download: nombre });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };
  $('bajarRksys').onclick = async () => {
    const b = await guardado.leerArchivo(RUTA_RKSYS);
    if (!b) return avisar('Todavía no hay partida', 'Juega un rato: al crear tu licencia el juego guarda su rksys.dat y ahí se puede descargar.');
    bajar(new Blob([b]), 'rksys.dat');
  };
  $('abrirMii').onclick = () => abrirMii();            // «Mi Mii» (sin la portada, vive en el cajón)
  $('abrirMii').hidden = !EDITOR_MII;                  // (§99: apagado hasta una actualización futura)
  $('bajarPartidas').onclick = async () => bajar(await guardado.exportar(), `partida-mkw-${new Date().toISOString().slice(0, 10)}.mkwp`);
  $('borrarPartidas').onclick = async () => {
    if (!await preguntar({ titulo: 'Borrar las partidas', si: 'Borrar', peligro: true,
      texto: 'Se borran las licencias, los ajustes y los fantasmas guardados en este navegador. Queda una copia de respaldo en «Copias de respaldo» por si te arrepientes.' })) return;
    await respaldar('antes de borrar todo');
    await guardado.borrarTodo();
    location.reload();
  };

  // ---------------- Mi Mii ----------------
  // §86: los Mii invitados del juego: los guardados en este navegador o, con el juego andando, se los pide (mkw.mjs)
  function abrirMii(opciones = {}) {
    return abrirEditorMii({ guardado, preguntar, avisar, bajar, respaldar, licencias, ...opciones,
      cargarInvitados: async () => (await leerInvitados()) || (window.mkwInvitados ? await window.mkwInvitados.sacar() : null),
      alGuardar: () => { alCambiarGuardado(); partidaCambio(); } });
  }

  // ---------------- Modos ----------------
  const modos = $('modos');
  const elegido = { modo: leerPref('modo', 'libre') };
  if (!MODOS.find(m => m.id === elegido.modo && m.listo && !m.accion)) elegido.modo = 'libre';
  window.mkwModo = elegido;
  const estado = $('estadoInicio');
  for (const m of MODOS) {
    const b = el('button', { type: 'button', className: 'modo', id: 'modo-' + m.id });
    b.innerHTML = `<span class="ico ico-${m.id}"><svg viewBox="0 0 32 32" aria-hidden="true">${ICONOS[m.id]}</svg></span>` +
      `<span><strong>${m.nombre}${m.listo ? '' : '<em>pronto</em>'}</strong><small>${m.texto}</small></span>` + (m.accion ? '' : '<span class="radio"></span>');
    b.onclick = () => {
      if (m.accion) return abrirMii();
      if (!m.listo) {
        estado.textContent = `«${m.nombre}» desde aquí llega pronto. Por ahora: «Jugar libre» y elígelo en el menú del juego.`;
        return;
      }
      elegirModo(m.id);
      // en pantallas angostas los modos quedan bajo la tarjeta: volver a mostrar los ajustes y «Jugar»
      if (matchMedia('(max-width: 860px)').matches) (opciones.hidden ? $('arrancar') : opciones).scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    modos.append(b);
  }
  // Ajustes del modo (en la tarjeta, sobre «Jugar»): la CPU en las carreras (dificultad o sin CPU) y el fantasma en Contrarreloj.
  // Van a window.mkwModo (cpu, fantasma), que mkw.mjs le pasa al piloto; quedan anotados para la próxima vez.
  elegido.cpu = leerPref('cpu', 'normal');
  elegido.fantasma = leerPref('fantasma', true);
  const opciones = el('div', { className: 'opciones-modo', id: 'opcionesModo' });
  $('arrancar').before(opciones);                                       // justo sobre «Jugar», donde se decide
  const fichas = (titulo, valores, actual, alElegir) => {
    const caja = el('div', { className: 'fichas', role: 'group' });
    caja.setAttribute('aria-label', titulo);
    for (const [valor, texto] of valores) {
      const b = el('button', { type: 'button', textContent: texto });
      b.setAttribute('aria-pressed', String(valor === actual));
      b.dataset.valor = String(valor);
      b.onclick = () => { caja.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); alElegir(valor); };
      caja.append(b);
    }
    return [el('span', { textContent: titulo }), caja];
  };
  function pintarOpciones(id) {
    opciones.replaceChildren();
    opciones.hidden = !['gp', 'vs', 'copa', 'tt'].includes(id);
    if (id === 'tt') {
      opciones.append(...fichas('Fantasma', [[true, 'Contra el mejor fantasma'], [false, 'Solo']], elegido.fantasma, v => { elegido.fantasma = v; guardarPref('fantasma', v); }));
    } else {
      opciones.append(...fichas('Rivales (CPU)', [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil'], ['ninguna', 'Sin CPU']], elegido.cpu,
        v => { elegido.cpu = v; guardarPref('cpu', v); }));
    }
    opciones.append(el('small', { className: 'opciones-nota', textContent: id === 'gp' ? 'La copa la eliges al cargar el juego.' : id === 'copa' ? 'Las 4 pistas las armas al cargar el juego.' : 'La pista la eliges al cargar el juego.' }));
  }
  function elegirModo(id) {
    elegido.modo = id; guardarPref('modo', id);
    pintarOpciones(id);
    modos.querySelectorAll('.modo').forEach(b => b.classList.toggle('activo', b.id === 'modo-' + id));
    const m = MODOS.find(x => x.id === id);
    $('arrancar').textContent = id === 'libre' ? 'Jugar' : `Jugar · ${m.nombre}`;
    estado.textContent = '';
  }
  elegirModo(elegido.modo);

  // Al arrancar el juego
  function empezo() {
    // SDL le pone a la pestaña el nombre de su ventana ("Retro Rewind"): se deja el de la página
    const titulo = document.title;
    new MutationObserver(() => { if (document.title !== titulo) document.title = titulo; })
      .observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
    document.body.classList.add('started');
    cerrarCajon();
    barraViva();
  }

  // ---------------- La cortina ----------------
  // ?cortina=0: sin cortina (para mirar o fotografiar lo que hace el piloto en los menús)
  const sinCortina = new URLSearchParams(location.search).get('cortina') === '0';
  // pct (§99, la preparación de la sala): 0..100 = la barra se llena hasta ahí (sin él, la barra que va y viene)
  function cortina(texto, mal = false, pct = null) {
    const quitar = texto === false || sinCortina;
    document.body.classList.toggle('sin-cortina', quitar);
    document.body.classList.toggle('cortina-mal', !quitar && mal);   // un error: el menú de inicio se aparta (inicio.mjs)
    if (!quitar) {
      $('cortinaTexto').textContent = texto; $('cortina').classList.toggle('mal', mal);
      const barra = $('cortina').querySelector('.carga'), conPct = Number.isFinite(pct);
      if (barra) {
        barra.classList.toggle('con-pct', conPct);
        barra.firstElementChild.style.width = conPct ? `${Math.max(2, Math.min(100, pct))}%` : '';
        if (conPct) { barra.setAttribute('role', 'progressbar'); barra.setAttribute('aria-valuenow', String(Math.round(pct))); }
        else { barra.removeAttribute('role'); barra.removeAttribute('aria-valuenow'); }
      }
    }
  }
  if (sinCortina) cortina(false);

  // ---------------- Aviso sobre el juego y elegir copa/pista ----------------
  const avisoJuego = el('div', { id: 'avisoJuego', role: 'status', hidden: true });
  document.body.append(avisoJuego);
  // §100: un botón encima del juego, debajo del aviso (texto vacío = se va): «🙋 Pedir copa»
  const accionJuego = el('button', { type: 'button', id: 'accionJuego', hidden: true });
  document.body.append(accionJuego);
  function accion(texto, alClic = null) { accionJuego.textContent = texto || ''; accionJuego.hidden = !texto; accionJuego.onclick = texto ? alClic : null; }
  function aviso(texto, mal = false) {
    avisoJuego.textContent = texto; avisoJuego.hidden = !texto; avisoJuego.classList.toggle('mal', mal);
    if (texto && !texto.includes('…')) setTimeout(() => { if (avisoJuego.textContent === texto) avisoJuego.hidden = true; }, 6000);   // los de «…» quedan mientras dure
  }
  // M22 (avisos por capas, el crítico): el estado de la red y de la PC no va en la píldora del centro (tapaba la carrera)
  // sino en una esquina, como un ícono con su texto corto. chip(clave, texto, mal): aparece 6 s cada vez que el texto
  // cambia y se va solo (texto vacío = se va ya). No queda puesto mientras dure: cualquier cosa encima de la imagen del
  // juego obliga al navegador a componer cada cuadro (el lienzo de WebGPU ya no va directo a la pantalla) y en la
  // prueba con tres juegos en una PC eso solo hacía crecer el retraso de todos (§98.9). Al centro quedan solo las cosas
  // de la carrera (esperar a alguien, cortes)
  const esquina = el('div', { id: 'estadoJuego', role: 'status' });
  document.body.append(esquina);
  const sinEsquina = new URLSearchParams(location.search).get('esquina') === '0';   // (?esquina=0: sin chips, para medir)
  const ultimoChip = new Map();                   // clave → el último texto pedido (el mismo de nuevo no vuelve a salir)
  function chip(clave, texto, mal = false, ms = 6000) {
    if (sinEsquina) return;
    let c = esquina.querySelector(`[data-clave="${clave}"]`);
    if (!texto) { ultimoChip.delete(clave); c?.remove(); return; }
    if (ultimoChip.get(clave) === texto) return;
    ultimoChip.set(clave, texto);
    if (!c) { c = el('span', { className: 'chip-estado' }); c.dataset.clave = clave; esquina.append(c); }
    c.textContent = texto;
    c.classList.toggle('mal', mal);
    clearTimeout(c._hasta);
    c._hasta = setTimeout(() => c.remove(), ms);
  }
  // ---------------- Elegir copa, pista o armar una copa ----------------
  // Las imágenes sacadas del juego (herramientas/sacar-imagenes.mjs, fotos-pistas.mjs, planos-pistas.mjs) van en unos
  // pocos paquetes en la parte privada (build/imagenes, en R2 detrás del Worker; imagenes.mjs los abre): ícono de cada
  // copa, foto, plano y videíto de cada pista. Si alguna falta, queda una ficha de color (.sin-imagen, index.html) y la
  // lista sigue andando.
  const fotos = crearImagenes(imagenes);
  const imagen = (promesa, clase, alt = '') => {
    const i = el('img', { className: clase, alt, decoding: 'async' });
    promesa.then(u => { if (u) i.src = u; else i.classList.add('sin-imagen'); });
    i.onerror = () => i.classList.add('sin-imagen');
    return i;
  };
  // Videíto en la vista previa: solo si no se pidió "menos movimiento" ni "ahorro de datos"
  const conVideo = () => !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;
  // Los nombres de las pistas: los que lee el juego (menus.mjs) > los anotados en este navegador > los del índice de
  // los paquetes (los que anotó fotos-pistas.mjs) > «Pista n».
  async function nombresPistas(copas) {
    if (copas && copas.length) { guardarPref('pistas', copas); return copas; }
    copas = leerPref('pistas', null);
    if (copas && copas.length) return copas;
    copas = await fotos.nombres();
    if (copas && copas.length) return copas;
    return Array.from({ length: 8 }, () => ['', '', '', '']);
  }
  // Sorteos con semilla: la misma semilla da siempre las mismas pistas (mulberry32, un generador chico y conocido).
  // Cada «volver a sortear» saca una semilla nueva del azar del navegador (crypto) y esa semilla también va al juego
  // (la usa para los objetos y la CPU: menus.mjs la escribe antes de cada carrera).
  const semillaNueva = () => crypto.getRandomValues(new Uint32Array(1))[0];
  function azar(semilla) {
    let t = semilla >>> 0;
    return () => { t = (t + 0x6D2B79F5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }

  // La tabla de récords de una pista: fichas por categoría y los 10 mejores (records.mjs: de Firebase con sesión en el
  // sitio; sin sesión, solo el tuyo de este navegador)
  const CATEGORIAS = ['tt150', 'tt200', 'vs150', 'vs200', 'vs500', 'vs100', 'vsespejo'];
  function mostrarTabla(c, f, cat = 'tt150') {
    const pista = 0x100 + 4 * c + f, caja = el('div', { className: 'tabla-records' });
    const lista = el('ol', { className: 'tabla-filas' });
    const pintar = async elegida => {
      chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === elegida)));
      lista.replaceChildren(el('li', { className: 'tabla-vacia', textContent: 'Cargando…' }));
      let filas = [];
      try { filas = await window.mkwRecords?.tabla(pista, elegida) || []; } catch (e) { lista.replaceChildren(el('li', { className: 'tabla-vacia', textContent: 'No se pudo leer la tabla (¿sin conexión?).' })); return; }
      lista.replaceChildren(...(filas.length ? filas.map((r, i) => el('li', { className: r.tuyo ? 'tuyo' : '' },
        el('span', { className: 'puesto', textContent: i + 1 }), el('span', { className: 'quien', textContent: r.nombre || 'Piloto' }), el('b', { textContent: textoTiempo(r.ms) })))
        : [el('li', { className: 'tabla-vacia', textContent: 'Todavía no hay tiempos en esta categoría. ¡Sé el primero!' })]));
    };
    const chips = el('div', { className: 'fichas' }, ...CATEGORIAS.map(k => {
      const b = el('button', { type: 'button', textContent: nombreCategoria(k) });
      b.dataset.cat = k; b.onclick = () => pintar(k);
      return b;
    }));
    caja.append(chips, lista, el('p', { className: 'tabla-nota', textContent: window.mkwRecords?.conNube ? '' : 'Inicia sesión en Paginita Pro para subir tus tiempos a la tabla de todos. Sin sesión se guardan solo en este navegador.' }));
    pintar(CATEGORIAS.includes(cat) ? cat : 'tt150');
    preguntar({ titulo: `Récords · ${nombreRecords(c, f)}`, nodo: caja, no: null, si: 'Cerrar' });
  }
  let nombreRecords = (c, f) => `Copa ${c + 1}, pista ${f + 1}`;

  // elegirPista({ modo, copas, titulo, cerrar, lista }) — bitácora §56 y §74
  //   modo 'gp' → { copa, fila: 0 } (una copa entera) · 'vs' → { copa, fila } (una pista) · 'lista' → { pistas: [{copa,
  //   fila}, …], semilla } (una lista de hasta 32 pistas; 'copa' es su nombre viejo, «Arma tu copa») · o null (cerró).
  //   cerrar: false = sin «Prefiero los menús del juego» ni Esc (en la sala hay que elegir algo); textoCerrar = otro texto.
  //   lista (solo el modo lista): { pistas (las que ya trae), max (32), objetivo (hasta cuántas llena 🎲; 4),
  //     clave (el borrador en el navegador: la lista sigue ahí al volver; '' = sin borrador), confirmar (texto del
  //     botón), titulo (de la lista), alCambiar(pistas) (cada cambio), extra (un nodo que va debajo de la lista),
  //     sugerencias: true (la playlist de la sala: un panel con las pistas que sugieren los demás, ✓ agrega y ✕
  //     rechaza → alAceptar(id, resultado) / alRechazar(id)), alAbrir(ctrl) (ctrl.sugerencias(lista) las pone o
  //     cambia; ctrl.poner(pistas); ctrl.cerrar(valor)) }
  //   modo 'sugerir' (los demás en la playlist de la sala): la grilla igual, pero un clic SUGIERE la pista al anfitrión
  //     (lista.alSugerir(p) → 'sugerida' | 'ya-sugerida' | 'tope' | 'llena' | 'ya-esta'); al costado, la lista de la
  //     sala (solo para ver: ctrl.poner(pistas)) y «Tus sugerencias» con ⌛ ✓ ✕ (ctrl.sugerencias(mías)); lista.nota =
  //     el texto del pie. Termina con ctrl.cerrar() (la sala, cuando el anfitrión confirma) o con «Listo» si cerrar.
  // Con mouse: pasar por encima muestra la foto y el plano. Con el dedo: el primer toque muestra y el segundo elige; en
  // el modo lista el primer toque ya agrega (es lo que se hace todo el rato) y otro toque la quita.
  // §100 («Pedir copa»): textoJugar(c) = otro texto para el botón del modo gp («Pedir la Copa N ▸»); ctrl.pedidas({copa:
  //   [nombres]}) = las copas que piden los demás, con un 🙋 en su tarjeta (la anfitriona)
  async function elegirPista({ modo, copas, cuantas = 4, titulo: tituloPedido = '', cerrar = true, textoCerrar = 'Prefiero los menús del juego', lista: conf = {}, textoJugar = null }) {
    if (modo === 'copa') modo = 'lista';
    copas = await nombresPistas(copas);
    fotos.precargar?.().catch(() => {});
    const nombre = (c, f) => copas[c]?.[f] || `Pista ${f + 1}`;
    nombreRecords = nombre;
    const enLista = modo === 'lista', enSugerir = modo === 'sugerir', conLista = enLista || enSugerir;
    return new Promise(listo => {
      const caja = el('div', { id: 'elegirPista', className: 'modo-' + modo + (enSugerir ? ' modo-lista' : '') });
      const titulo = tituloPedido || { gp: 'Elige la copa', vs: 'Elige la pista', lista: 'Arma tu lista', sugerir: 'Sugiere pistas' }[modo];
      const buscar = el('input', { type: 'search', placeholder: 'Buscar pista (p. ej. «N64» o «Rainbow»)' });
      buscar.setAttribute('aria-label', 'Buscar pista');
      const grilla = el('div', { className: 'copas' });
      let medidor = null;
      const teclaEsc = e => {
        if (e.key !== 'Escape' || dialogo.open) return;           // (Esc en un diálogo cierra solo el diálogo)
        if (guardadas?.open) { e.stopPropagation(); guardadas.open = false; return; }
        if (lado.classList.contains('abierta')) { e.stopPropagation(); desplegar(false); return; }
        if (cerrar) { e.stopPropagation(); terminar(null); }
      };
      const terminar = v => {
        caja.remove(); document.removeEventListener('keydown', teclaEsc, true); document.removeEventListener('keydown', teclaCopa);
        clearTimeout(relojAuto); medidor?.disconnect(); listo(v);
      };
      document.addEventListener('keydown', teclaEsc, true);

      // ---- La vista previa: foto (la presentación de la pista, desde el aire) + plano (desde arriba, del course.kmp) ----
      const vista = el('aside', { className: 'vista' });
      vista.setAttribute('aria-live', 'polite');
      let enVista = '', esperaVista = 0;
      // una imagen se cambia recién cuando la nueva está decodificada: sin parpadeo y sin la foto anterior a medias
      const poner = (img, promesa, aca) => promesa.then(async u => {
        if (enVista !== aca) return;
        if (!u) { img.removeAttribute('src'); img.classList.add('sin-imagen'); return; }
        if (img.getAttribute('src') !== u) {
          const pre = new Image(); pre.src = u;
          await pre.decode().catch(() => {});
          if (enVista !== aca) return;
          img.src = u;
        }
        img.classList.remove('sin-imagen');
      }).catch(() => {});
      // los nodos de la vista de una pista se arman UNA vez y después solo cambian (antes se rehacían en cada pista)
      const v = {
        icono: el('img', { className: 'vista-icono sin-imagen', alt: '' }), donde: el('span'), titulo: el('h3'),
        foto: el('img', { className: 'vista-foto sin-imagen', alt: 'Foto de la pista', decoding: 'async' }),
        plano: el('img', { className: 'vista-plano sin-imagen', alt: 'Plano de la pista', decoding: 'async' }),
        records: el('ul', { className: 'vista-records' }),
        tabla: el('button', { type: 'button', className: 'boton vista-tabla', textContent: '🏆 Récords de esta pista' }),
      };
      v.titulo.setAttribute('translate', 'no');
      const nodosPista = [el('div', { className: 'vista-cab' }, v.icono, v.donde), v.titulo,
        el('div', { className: 'vista-imagenes' }, v.foto, v.plano), v.records, v.tabla];
      function mostrarPista(c, f) {
        clearTimeout(esperaVista);
        if (enVista === `${c}/${f}`) return;
        const aca = enVista = `${c}/${f}`;
        if (vista.firstChild !== nodosPista[0]) vista.replaceChildren(...nodosPista);
        vista.classList.add('con-algo');
        v.titulo.textContent = nombre(c, f);
        v.donde.textContent = `Copa ${c + 1} · pista ${f + 1}`;
        v.foto.classList.remove('en-video');
        poner(v.icono, fotos.copa(c), aca); poner(v.foto, fotos.foto(c, f), aca); poner(v.plano, fotos.plano(c, f), aca);
        // tus mejores tiempos en esta pista (records.mjs, de este navegador)
        const mejores = window.mkwRecords?.mejoresDe(0x100 + 4 * c + f) || [];
        v.records.replaceChildren(...mejores.map(m => el('li', {}, el('span', { textContent: nombreCategoria(m.cat) }), el('b', { textContent: textoTiempo(m.ms) }))));
        v.records.hidden = !mejores.length;
        v.tabla.onclick = () => mostrarTabla(c, f, mejores[0]?.cat);
        // si se queda mirando esta pista ~0,7 s, la foto pasa a ser el videíto (se baja la copa entera, una vez)
        if (conVideo()) setTimeout(async () => {
          if (enVista !== aca) return;
          const u = await fotos.clip(c, f);
          if (u && enVista === aca) { v.foto.src = u; v.foto.classList.remove('sin-imagen'); v.foto.classList.add('en-video'); }
        }, 700);
      }
      // ---- Modo copa (gp): un panel fijo con la presentación de cada pista (el videíto), su plano en la esquina como el
      // minimapa de la carrera, las 4 fotos para pasar de una pista a otra y «Jugar la Copa N». Pasar el mouse por una
      // copa la muestra (y avanza sola de pista cada 4 s); un clic la MARCA (anillo amarillo) y el botón (o Enter, o
      // doble clic) la confirma: un clic suelto ya no elige la copa de toda la sala. (Revisión crítica del diseño, §74.)
      const enGp = modo === 'gp';
      let copaVista = -1, pistaVista = -1, elegida = -1, autoAvanza = false, relojAuto = 0, frente = 0;
      const tarjetas = [];                                         // copa → su tarjeta en la grilla
      const vc = enGp ? (() => {
        const n = {
          icono: el('img', { className: 'vc-icono sin-imagen', alt: '' }), titulo: el('h3'), sub: el('small'),
          fotos: [el('img', { className: 'vc-foto', alt: '' }), el('img', { className: 'vc-foto', alt: '' })],
          clip: el('img', { className: 'vc-clip', alt: '' }), num: el('span', { className: 'vc-num' }),
          plano: el('img', { className: 'vc-plano sin-imagen', alt: 'Plano de la pista' }), nombre: el('span', { className: 'vc-nombre' }), record: el('b'),
          tira: el('ol', { className: 'vc-tira' }), jugar: el('button', { type: 'button', className: 'vc-jugar', id: 'copaJugar' }),
          cerrar: el('button', { type: 'button', className: 'vc-cerrar', textContent: '✕', title: 'Cerrar la vista' }),
        };
        n.nombre.setAttribute('translate', 'no');
        n.cerrar.setAttribute('aria-label', 'Cerrar la vista');
        n.miniaturas = [0, 1, 2, 3].map(f => {
          const b = el('button', { type: 'button' }, el('img', { alt: '' }), el('i', { textContent: f + 1 }));
          b.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') verPista(f, false); });
          b.onclick = () => verPista(f, false);
          return b;
        });
        n.tira.append(...n.miniaturas.map(b => el('li', {}, b)));
        n.escenario = el('div', { className: 'vc-escenario' }, ...n.fotos, n.clip, n.num, n.plano, el('div', { className: 'vc-pie' }, n.nombre, n.record));
        n.cab = el('div', { className: 'vc-cab' }, n.icono, el('div', { className: 'vc-titulos' }, n.titulo, n.sub),
          ...(matchMedia('(hover: hover)').matches ? [el('span', { className: 'vc-teclas', textContent: '← →', title: 'Las flechas del teclado cambian de pista' })] : []), n.cerrar);
        n.jugar.onclick = () => { const c = elegida >= 0 ? elegida : copaVista; if (c >= 0) terminar({ copa: c, fila: 0 }); };
        n.cerrar.onclick = () => { vista.classList.remove('con-algo'); clearTimeout(relojAuto); };
        // con el dedo: deslizar de lado sobre el video cambia de pista
        let x0 = null;
        n.escenario.addEventListener('pointerdown', e => { x0 = e.pointerType === 'touch' ? e.clientX : null; });
        n.escenario.addEventListener('pointerup', e => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (Math.abs(d) >= 40) verPista((pistaVista + (d < 0 ? 1 : 3)) % 4, false); });
        n.todo = [n.cab, n.escenario, n.tira, n.jugar];
        return n;
      })() : null;
      // muestra la copa c en la pista f (auto: que avance sola de pista)
      function verCopa(c, f = 0, auto = false) {
        if (!vc || c < 0 || c >= copas.length) return;
        if (vista.firstChild !== vc.cab) { vista.replaceChildren(...vc.todo); vista.classList.add('vista-copa'); }
        vista.classList.add('con-algo');
        marcarScroll();
        if (c !== copaVista) {
          copaVista = c; pistaVista = -1;
          vc.titulo.textContent = `Copa ${c + 1}`;
          vc.icono.classList.add('sin-imagen');
          fotos.copa(c).then(u => { if (copaVista === c && u) { vc.icono.src = u; vc.icono.classList.remove('sin-imagen'); } }).catch(() => {});
          vc.miniaturas.forEach((b, i) => {
            const img = b.firstChild; img.removeAttribute('src');
            b.title = nombre(c, i); b.setAttribute('aria-label', `Pista ${i + 1}: ${nombre(c, i)}`);
            fotos.foto(c, i).then(u => { if (copaVista === c && u) img.src = u; }).catch(() => {});
          });
          caja.querySelectorAll('.copa.en-vista').forEach(x => x.classList.remove('en-vista'));
          caja.querySelectorAll('.copa .pista.visto').forEach(x => x.classList.remove('visto'));
          tarjetas[c]?.classList.add('en-vista');
        }
        vc.sub.textContent = subDe(c);
        vc.jugar.textContent = textoJugar ? textoJugar(elegida >= 0 ? elegida : c) : `Jugar la Copa ${(elegida >= 0 ? elegida : c) + 1} ▸`;
        verPista(f, auto);
      }
      // muestra la pista f de la copa a la vista: la foto pasa adelante ya decodificada (fundido de 140 ms) y el videíto
      // aparece encima recién cuando está listo (nunca el de la pista anterior sobre la foto nueva)
      function verPista(f, auto = autoAvanza) {
        const c = copaVista;
        if (c < 0 || !(f >= 0 && f < 4)) return;
        autoAvanza = auto && conVideo();
        clearTimeout(relojAuto);
        if (f !== pistaVista) {
          pistaVista = f;
          const aca = enVista = `${c}/${f}`;
          vc.num.textContent = `${f + 1}/4`;
          vc.nombre.textContent = nombre(c, f);
          const m = window.mkwRecords?.mejoresDe(0x100 + 4 * c + f)?.[0];
          vc.record.textContent = m ? `🏆 ${textoTiempo(m.ms)}` : '';
          tarjetas[c]?.querySelectorAll('.pista').forEach((b, i) => b.classList.toggle('visto', i === f));
          fotos.foto(c, f).then(async u => {
            if (enVista !== aca || !u) return;
            const atras = vc.fotos[1 - frente];
            if (atras.getAttribute('src') !== u) { const pre = new Image(); pre.src = u; await pre.decode().catch(() => {}); if (enVista !== aca) return; atras.src = u; }
            atras.classList.add('frente'); vc.fotos[frente].classList.remove('frente'); frente = 1 - frente;
          }).catch(() => {});
          poner(vc.plano, fotos.plano(c, f), aca);
          vc.clip.classList.remove('lista');
          // (el paquete de videítos es de la copa entera: se pide a los 250 ms de quedarse; después cada pista es al toque)
          if (conVideo()) setTimeout(() => {
            if (enVista !== aca) return;
            fotos.clip(c, f).then(async u => {
              if (enVista !== aca || !u) return;
              if (vc.clip.getAttribute('src') !== u) { vc.clip.src = u; await vc.clip.decode().catch(() => {}); }
              if (enVista === aca) vc.clip.classList.add('lista');
            }).catch(() => {});
          }, 250);
        }
        // la miniatura de la pista a la vista, con su barra de avance (4 s) si avanza sola
        vista.classList.toggle('avanza', autoAvanza);
        vc.miniaturas.forEach((b, i) => b.classList.toggle('actual', i === f && i !== -1));
        const act = vc.miniaturas[f];
        act.classList.remove('actual'); void act.offsetWidth; act.classList.add('actual');
        programarAuto();
      }
      function programarAuto() {
        clearTimeout(relojAuto);
        if (!autoAvanza || vista.matches(':hover')) return;
        relojAuto = setTimeout(() => { if (caja.isConnected && autoAvanza && vista.classList.contains('con-algo')) verPista((pistaVista + 1) % 4, true); }, 4000);
      }
      // §100: las copas que piden los demás (copa → nombres): un 🙋 en la cabeza de su tarjeta y en el panel
      let pedidas = {};
      // (y arriba, junto al título: «🙋 Copa 8 · Beto», un botón por copa pedida que la marca y la trae a la vista: la
      // pedida podía quedar abajo, fuera de la pantalla)
      const pedidasCab = el('div', { className: 'pedidas-cab', hidden: true });
      const pideTxt = c => (pedidas[c]?.length ? ` · 🙋 la pide${pedidas[c].length > 1 ? 'n' : ''} ${pedidas[c].join(', ')}` : '');
      function subDe(c) { return (elegida === c ? '4 carreras · la marcaste' : elegida >= 0 ? `4 carreras · marcaste la Copa ${elegida + 1}` : '4 carreras') + pideTxt(c); }
      function pintarPedidas() {
        if (!enGp) return;
        tarjetas.forEach((t, c) => {
          let b = t.querySelector('.copa-pedida');
          const ns = pedidas[c] || [];
          if (!ns.length) { b?.remove(); return; }
          if (!b) { b = el('span', { className: 'copa-pedida' }); t.querySelector('.copa-cab')?.append(b); }
          b.textContent = `🙋 ${ns.length > 2 ? ns.length : ns.join(', ')}`;
          b.title = `La pide${ns.length > 1 ? 'n' : ''}: ${ns.join(', ')}`;
        });
        if (copaVista >= 0) vc.sub.textContent = subDe(copaVista);
        const orden = Object.keys(pedidas).map(Number).filter(c => pedidas[c]?.length && c >= 0 && c < copas.length).sort((x, y) => pedidas[y].length - pedidas[x].length || x - y);
        pedidasCab.hidden = !orden.length;
        pedidasCab.replaceChildren(...orden.map(c => el('button', { type: 'button', className: 'pedida-ir', textContent: `🙋 Copa ${c + 1} · ${pedidas[c].join(', ')}`,
          title: 'Marcar esta copa', onclick: () => {
            if (buscar.value) { buscar.value = ''; pintar(); }
            lado.classList.remove('arriba'); lado.style.top = '';
            marcarCopa(c, 0, true);
            ignorarScrollHasta = performance.now() + 800;
            tarjetas[c]?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          } })));
      }
      // marcar una copa (anillo amarillo); el botón la confirma
      function marcarCopa(c, f = 0, auto = false) {
        elegida = c;
        caja.querySelectorAll('.copa.elegida').forEach(x => x.classList.remove('elegida'));
        tarjetas[c]?.classList.add('elegida');
        verCopa(c, f, auto);
      }
      if (enGp) {
        // con el mouse encima del panel no avanza solo; al salir vuelve a contar los 4 s
        vista.addEventListener('pointerenter', () => clearTimeout(relojAuto));
        vista.addEventListener('pointerleave', () => { if (autoAvanza && pistaVista >= 0 && vista.classList.contains('con-algo')) verPista(pistaVista, true); });
      }
      // ←/→ y 1–4 cambian de pista; Enter juega la copa marcada (en el buscador: las flechas solo si está vacío)
      function teclaCopa(e) {
        if (!enGp || dialogo.open || copaVista < 0 || pistaVista < 0 || e.ctrlKey || e.metaKey || e.altKey) return;
        const enTexto = e.target?.tagName === 'INPUT';
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (!enTexto || !e.target.value)) {
          e.preventDefault(); verPista((pistaVista + (e.key === 'ArrowRight' ? 1 : 3)) % 4, false);
        } else if (/^[1-4]$/.test(e.key) && !enTexto) { e.preventDefault(); verPista(Number(e.key) - 1, false); }
        // (Enter en un botón lo aprieta, salvo «Una al azar»: ahí juega la que acaba de marcar)
        else if (e.key === 'Enter' && elegida >= 0 && (e.target?.tagName !== 'BUTTON' || e.target.id === 'copaAzar')) { e.preventDefault(); terminar({ copa: elegida, fila: 0 }); }
      }
      document.addEventListener('keydown', teclaCopa);
      // en pantallas angostas el panel flota; desplazar la grilla ≥ 32 px lo cierra (salvo con una copa marcada: tiene
      // el botón de jugar), y no justo después de que la página misma desplazó para mostrar la tarjeta
      let scrollBase = null, ignorarScrollHasta = 0;
      function marcarScroll() { scrollBase = caja.scrollTop; }      // (desde dónde se cuentan los 32 px)
      // pasar el mouse rápido por encima de varias no las muestra todas: solo la que queda debajo ~60 ms
      const pronto = f => { clearTimeout(esperaVista); esperaVista = setTimeout(f, 60); };
      const prontoEn = (f, ms) => { clearTimeout(esperaVista); esperaVista = setTimeout(f, ms); };
      const conMouse = matchMedia('(hover: hover)').matches;
      const angosta = matchMedia('(max-width: 899px)');
      // en pantallas angostas (fuera del modo lista) la vista previa flota sobre la grilla: va a la mitad de la pantalla
      // donde NO está lo que se señala (copa de abajo → vista arriba, bajo la cabecera), así nunca tapa esa copa
      const ubicar = b => {
        if (conLista || !angosta.matches) { lado.classList.remove('arriba'); lado.style.top = ''; return; }
        const r = (b.closest('.copa') || b).getBoundingClientRect();
        const arriba = r.top + r.height / 2 > innerHeight / 2;
        lado.classList.toggle('arriba', arriba);
        lado.style.top = arriba ? Math.round(cabeza.getBoundingClientRect().bottom) + 'px' : '';
      };
      vista.append(el('p', { className: 'vista-vacia', textContent: conMouse ? 'Pasa el mouse por una pista para ver su foto y su plano.' : 'Toca una pista para ver su foto y su plano.' }));
      if (conLista) { v.tabla.textContent = '🏆'; v.tabla.title = 'Récords de esta pista'; }

      // Un botón que muestra con el mouse (o el foco) y elige con clic; con el dedo, el primer toque solo muestra salvo
      // con tocarElige (el modo lista)
      function boton(props, mostrar, elegir, tocarElige = false) {
        const b = el('button', { type: 'button', ...props });
        let toque = false;
        b.addEventListener('pointerdown', e => { toque = e.pointerType === 'touch'; });
        const ver = () => { ubicar(b); marcarScroll(); mostrar(); };
        b.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') pronto(ver); });
        b.addEventListener('focus', () => ver());
        b.onclick = () => {
          if (toque && !tocarElige && !b.classList.contains('visto')) {
            caja.querySelectorAll('.visto').forEach(x => x.classList.remove('visto'));
            b.classList.add('visto'); ver(); return;
          }
          ver(); elegir();
        };
        return b;
      }

      // ---- El costado: la lista (modo lista) y la vista previa. En pantallas angostas es una hoja abajo ----
      const lado = el('div', { className: 'lado' });
      const desplegar = (si = !lado.classList.contains('abierta')) => {
        lado.classList.toggle('abierta', si);
        abrir?.setAttribute('aria-expanded', String(si));
      };
      let abrir = null, guardadas = null, panel = null, pintarListaYa = null;
      const todas = () => copas.flatMap((p, c) => p.map((_, f) => ({ copa: c, fila: f })));
      const botonesPista = new Map();                              // "c/f" → su botón en la grilla
      const max = Math.max(1, Math.min(MAX_PISTAS, conf.max | 0 || MAX_PISTAS));
      const objetivo = Math.max(1, Math.min(max, conf.objetivo | 0 || cuantas || 4));
      // (en el modo sugerir, la lista es la del anfitrión, solo para ver: sin borrador)
      const tuLista = conLista ? crearLista({ pistas: conf.pistas || [], max, clave: enSugerir ? '' : (conf.clave ?? 'mkw.lista') }) : null;
      const conSugerencias = enLista && !!conf.sugerencias;
      const marcas = new Map();                                    // "c/f" → '💬' (sugerida al anfitrión) | '⌛' (mía, esperando)
      const sonidos = crearSonidosLista({ contexto: () => sonido?.contexto || null,
        volumen: () => sonido?.estado?.volumen ?? 0.7, silencio: () => !!sonido?.estado?.silencio });
      let semilla = semillaNueva(), resaltar = -1;
      window.mkwTuLista = tuLista;                                 // para las pruebas
      window.mkwSonidosLista = sonidos;
      // un clic en una pista de la grilla: entra (al final) o sale, con su sonido
      function alternar(c, f) {
        resaltar = tuLista.tiene({ copa: c, fila: f }) ? -1 : tuLista.pistas.length;
        const r = tuLista.alternar({ copa: c, fila: f });
        if (r === 'agregada') sonidos.agregar();
        else if (r === 'quitada') sonidos.quitar();
        else if (r === 'llena') { sonidos.llena(); aviso(`La lista ya tiene ${max} pistas (el máximo)`, true); }
        return r;
      }
      // modo sugerir: un clic sugiere la pista al anfitrión (la sala manda el mensaje; acá solo el sonido y el aviso)
      function sugerirP(c, f) {
        const p = { copa: c, fila: f }, n = nombre(c, f);
        if (tuLista.tiene(p)) { sonidos.llena(); aviso(`«${n}» ya está en la lista`, true); return; }
        let r = 'sugerida';
        try { r = conf.alSugerir?.(p) || 'sugerida'; } catch (e) { console.warn('[lista]', e); r = 'nada'; }
        if (r === 'sugerida') { sonidos.agregar(); aviso(`Le sugeriste «${n}» al anfitrión`); return; }
        sonidos.llena();
        aviso({ 'ya-sugerida': `«${n}» ya está sugerida: falta que el anfitrión responda`, 'ya-esta': `«${n}» ya está en la lista`,
          tope: 'Tienes muchas sugerencias esperando: espera que el anfitrión responda', llena: `La lista ya tiene ${max} pistas (el máximo)` }[r] || 'No se pudo sugerir', true);
      }
      // en la grilla: el número de las que están en la lista y la marca de las sugeridas
      function marcarGrilla() {
        for (const [k, b] of botonesPista) {
          const [c, f] = k.split('/').map(Number), i = tuLista.posicion({ copa: c, fila: f }), m = i < 0 ? marcas.get(k) : '';
          b.classList.toggle('en-lista', i >= 0);
          b.setAttribute('aria-pressed', String(i >= 0));
          if (i >= 0) b.dataset.pos = String(i + 1); else delete b.dataset.pos;
          b.classList.toggle('sugerida', !!m);
          if (m) b.dataset.marca = m; else delete b.dataset.marca;
        }
      }
      let pintarSugerencias = () => {};
      if (conLista) {
        const presets = crearPresets();
        const cuenta = el('span', { className: 'tu-lista-cuenta' });
        abrir = el('button', { type: 'button', className: 'tu-lista-abrir', title: 'Ver la lista' }, el('span', { className: 'flecha', textContent: '▴' }));
        abrir.setAttribute('aria-expanded', 'false');
        abrir.onclick = () => desplegar();
        const semillaTxt = el('span', { className: 'semilla', title: 'La semilla del sorteo; también decide los objetos y la CPU en las carreras' });
        // (con sugerencias: un chip «💬 N» en la cabeza, que se ve aunque la hoja esté plegada en el celular)
        const sugChip = el('button', { type: 'button', className: 'sug-chip', hidden: true, title: 'Ver las sugerencias' });
        const cab = el('div', { className: 'tu-lista-cab' }, el('b', { textContent: conf.titulo || (enSugerir ? 'Lista de la sala' : 'Tu lista') }), cuenta,
          ...(enLista ? [semillaTxt] : []), sugChip, abrir);
        cab.onclick = e => { if (e.target === cab || e.target.tagName === 'B' || e.target === cuenta) desplegar(); };
        const azarBtn = el('button', { type: 'button', className: 'boton', id: 'listaAzar', textContent: '🎲 Al azar',
          title: `Llena la lista hasta ${objetivo} pistas al azar (sin repetir); si ya tiene ${objetivo} o más, agrega una`,
          onclick: () => {
            semilla = semillaNueva();
            resaltar = tuLista.pistas.length;
            const n = tuLista.llenar(todas(), Math.max(objetivo, tuLista.pistas.length + 1), semilla);
            if (n) sonidos.agregar(); else { sonidos.llena(); aviso(`La lista ya tiene ${max} pistas (el máximo)`, true); }
          } });
        // «Deshacer» un rato después de vaciar o de cargar una guardada encima de otra lista
        let antesDe = null, relojDeshacer = 0;
        const deshacer = el('button', { type: 'button', className: 'boton', id: 'listaDeshacer', textContent: '↶ Deshacer', hidden: true,
          onclick: () => { if (antesDe) { resaltar = -1; tuLista.poner(antesDe); sonidos.agregar(); } antesDe = null; deshacer.hidden = true; } });
        const recordar = antes => {                                 // (la lista de antes: la que vuelve con «Deshacer»)
          if (!antes.length) return;
          antesDe = antes; deshacer.hidden = false;
          clearTimeout(relojDeshacer); relojDeshacer = setTimeout(() => { antesDe = null; deshacer.hidden = true; }, 8000);
        };
        const vaciarBtn = el('button', { type: 'button', className: 'boton', id: 'listaVaciar', textContent: 'Vaciar',
          onclick: () => { const antes = tuLista.pistas; if (tuLista.vaciar()) { recordar(antes); sonidos.quitar(); } } });
        // las listas guardadas (presets): guardar la de ahora con un nombre, usar o borrar una guardada
        guardadas = el('details', { className: 'guardadas' });
        const resumenG = el('summary');
        const nombreG = el('input', { type: 'text', maxLength: 40, placeholder: 'Nombre (p. ej. «Retro de la noche»)' });
        nombreG.setAttribute('aria-label', 'Nombre de la lista para guardarla');
        const guardarG = el('button', { type: 'button', className: 'boton', id: 'listaGuardar', textContent: '💾 Guardar' });
        const listaG = el('ul', { className: 'guardadas-lista' });
        function pintarGuardadas() {
          const ps = presets.listar();
          resumenG.textContent = `Listas guardadas (${ps.length})`;
          listaG.replaceChildren(...(ps.length ? ps.map(p => {
            // borrar en dos pasos: el primer clic pregunta «¿Borrar?», el segundo (antes de 3 s) borra
            const borrar = el('button', { type: 'button', className: 'mini', textContent: '✕', title: `Borrar «${p.nombre}»`, ariaLabel: `Borrar la lista «${p.nombre}»` });
            let reloj = 0;
            borrar.onclick = () => {
              if (!borrar.classList.contains('borrar-ya')) {
                borrar.classList.add('borrar-ya'); borrar.textContent = '¿Borrar?';
                reloj = setTimeout(() => { borrar.classList.remove('borrar-ya'); borrar.textContent = '✕'; }, 3000);
                return;
              }
              clearTimeout(reloj); presets.borrar(p.nombre); sonidos.quitar(); pintarGuardadas();
            };
            return el('li', {},
              el('button', { type: 'button', className: 'guardada', title: 'Cargar esta lista (reemplaza la de ahora; se puede deshacer)',
                onclick: () => { const antes = tuLista.pistas; resaltar = -1; tuLista.poner(p.pistas.slice(0, max)); recordar(antes);
                  sonidos.agregar(); guardadas.open = false; aviso(`Lista «${p.nombre}»: ${Math.min(max, p.pistas.length)} pistas`); } },
                el('b', { textContent: p.nombre }), el('span', { textContent: `${p.pistas.length} ${p.pistas.length === 1 ? 'pista' : 'pistas'}` })),
              borrar);
          })
            : [el('li', { className: 'guardadas-vacia', textContent: 'Todavía no hay listas guardadas.' })]));
          guardarG.disabled = !tuLista.pistas.length;
        }
        function guardarLista() {
          if (!tuLista.pistas.length) return;
          const n = nombreG.value.trim() || `Lista ${presets.listar().length + 1}`;
          if (presets.guardar(n, tuLista.pistas)) { nombreG.value = ''; sonidos.agregar(); pintarGuardadas(); aviso(`Lista «${n}» guardada`); }
        }
        guardarG.onclick = guardarLista;
        nombreG.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); guardarLista(); } };
        guardadas.append(resumenG, el('div', { className: 'guardadas-menu' }, el('div', { className: 'guardadas-form' }, nombreG, guardarG), listaG));

        const filas = el('ol', { className: 'renglones' });
        const vacia = el('p', { className: 'renglones-vacia', textContent: enSugerir ? `Todavía no hay pistas en la lista. ${conMouse ? 'Haz clic en' : 'Toca'} una pista de las copas para sugerírsela al anfitrión.`
          : conMouse ? 'Haz clic en una pista de las copas para agregarla a la lista. Otro clic la quita.'
          : 'Toca una pista de las copas para agregarla a la lista. Otro toque la quita.' });
        const confirmar = el('button', { type: 'button', className: 'boton primario', id: 'listaConfirmar',
          onclick: () => { if (tuLista.pistas.length) terminar({ pistas: tuLista.pistas, semilla }); } });
        const pie = el('div', { className: 'tu-lista-pie' }, deshacer, confirmar);
        function pintarLista() {
          const ps = tuLista.pistas, nueva = resaltar;
          resaltar = -1;
          cuenta.textContent = ps.length >= max ? `${ps.length} de ${max} · llena` : `${ps.length} de ${max}`;
          caja.classList.toggle('llena', ps.length >= max);
          filas.replaceChildren(...ps.map((p, i) => {
            const li = el('li', { className: 'renglon' + (i === nueva ? ' nueva' : '') });
            li.onclick = e => { if (!e.target.closest('button')) mostrarPista(p.copa, p.fila); };
            li.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') pronto(() => mostrarPista(p.copa, p.fila)); });
            const nom = el('span', { className: 'renglon-nombre', textContent: nombre(p.copa, p.fila) });
            nom.setAttribute('translate', 'no');
            li.append(el('span', { className: 'num', textContent: i + 1 }),
              imagen(fotos.foto(p.copa, p.fila), 'renglon-foto'),
              el('span', { className: 'renglon-texto' }, nom,
                el('span', { className: 'renglon-copa' }, imagen(fotos.copa(p.copa), 'renglon-icono'), el('span', { textContent: `Copa ${p.copa + 1} · pista ${p.fila + 1}` }))),
              enSugerir ? '' : el('span', { className: 'renglon-botones' },
                el('button', { type: 'button', className: 'mini', textContent: '↑', title: 'Subir', ariaLabel: `Subir ${nombre(p.copa, p.fila)}`, disabled: i === 0, onclick: () => tuLista.mover(i, -1) }),
                el('button', { type: 'button', className: 'mini', textContent: '↓', title: 'Bajar', ariaLabel: `Bajar ${nombre(p.copa, p.fila)}`, disabled: i === ps.length - 1, onclick: () => tuLista.mover(i, 1) }),
                el('button', { type: 'button', className: 'mini quitar', textContent: '✕', title: 'Quitar de la lista', ariaLabel: `Quitar ${nombre(p.copa, p.fila)}`,
                  onclick: () => { tuLista.quitar(i); sonidos.quitar(); } })));
            return li;
          }));
          filas.hidden = !ps.length; vacia.hidden = !!ps.length;
          confirmar.disabled = !ps.length;
          confirmar.textContent = ps.length ? `${conf.confirmar || 'Confirmar'} · ${ps.length} ${ps.length === 1 ? 'carrera' : 'carreras'} ▸` : 'Agrega pistas para seguir';
          vaciarBtn.disabled = !ps.length;
          // (M22: la semilla es para depurar: solo con ?depurar=1)
          semillaTxt.textContent = new URLSearchParams(location.search).get('depurar') === '1' ? 'Semilla ' + semilla.toString(16).toUpperCase().padStart(8, '0') : '';
          marcarGrilla();
          if (nueva >= 0) filas.children[nueva]?.scrollIntoView({ block: 'nearest' });
          pintarGuardadas();
        }
        tuLista.alCambiar(ps => { pintarLista(); try { conf.alCambiar?.(ps); } catch (e) { console.warn('[lista]', e); } });

        // ---- Sugerencias (playlist de la sala) ----
        // el anfitrión: las pendientes, cada una con ✓ (entra al final de la lista) y ✕ (no entra)
        const sugPanel = el('section', { className: 'sugerencias', hidden: true });
        const sugLista = el('ul', { className: 'sugerencias-lista' });
        const sugCuenta = el('span', { className: 'sugerencias-cuenta' });
        sugPanel.append(el('div', { className: 'sugerencias-cab' }, el('b', { textContent: 'Sugerencias' }), sugCuenta), sugLista);
        sugChip.onclick = () => { desplegar(true); sugPanel.scrollIntoView({ block: 'nearest' }); };
        // los demás: «Tus sugerencias», con cómo le fue a cada una
        const misPanel = el('section', { className: 'sugerencias mias', hidden: true });
        const misLista = el('ul', { className: 'sugerencias-lista' });
        misPanel.append(el('div', { className: 'sugerencias-cab' }, el('b', { textContent: 'Tus sugerencias' })), misLista);
        const vistas = new Set(), estadoDe = new Map();
        let primeraVez = true;
        const nombreSpan = (c, f) => { const n = el('span', { className: 'renglon-nombre', textContent: nombre(c, f) }); n.setAttribute('translate', 'no'); return n; };
        const verAlPasar = (li, s) => li.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') pronto(() => mostrarPista(s.copa, s.fila)); });
        function aceptarSug(s) {
          resaltar = tuLista.pistas.length;
          const r = tuLista.agregar({ copa: s.copa, fila: s.fila });
          if (r === 'agregada') sonidos.agregar();
          else { resaltar = -1; if (r === 'llena') { sonidos.llena(); aviso(`La lista ya tiene ${max} pistas (el máximo)`, true); } }
          try { conf.alAceptar?.(s.id, r); } catch (e) { console.warn('[lista]', e); }
        }
        pintarSugerencias = (lista = []) => {
          const validas = (Array.isArray(lista) ? lista : []).filter(s => s && Number.isInteger(s.copa) && Number.isInteger(s.fila));
          marcas.clear();
          if (conSugerencias) {
            let nuevas = 0;
            sugLista.replaceChildren(...validas.map(s => {
              marcas.set(`${s.copa}/${s.fila}`, '💬');
              const nueva = !vistas.has(s.id);
              if (nueva) { vistas.add(s.id); nuevas++; }
              const quien = s.nombre || 'otro piloto';
              const li = el('li', { className: 'sugerencia' + (nueva ? ' nueva' : '') });
              verAlPasar(li, s);
              li.append(imagen(fotos.foto(s.copa, s.fila), 'renglon-foto'),
                el('span', { className: 'renglon-texto' }, nombreSpan(s.copa, s.fila), el('span', { className: 'renglon-copa', textContent: `de ${quien} · Copa ${s.copa + 1}` })),
                el('span', { className: 'renglon-botones' },
                  el('button', { type: 'button', className: 'mini aceptar', textContent: '✓', title: 'Agregar a la lista', ariaLabel: `Agregar ${nombre(s.copa, s.fila)}, sugerida por ${quien}`, onclick: () => aceptarSug(s) }),
                  el('button', { type: 'button', className: 'mini quitar', textContent: '✕', title: 'No agregar', ariaLabel: `No agregar ${nombre(s.copa, s.fila)}`,
                    onclick: () => { sonidos.quitar(); try { conf.alRechazar?.(s.id); } catch (e) { console.warn('[lista]', e); } } })));
              return li;
            }));
            sugPanel.hidden = !validas.length;
            sugCuenta.textContent = String(validas.length);
            sugChip.hidden = !validas.length; sugChip.textContent = `💬 ${validas.length}`;
            if (nuevas && !primeraVez) sonidos.sugerencia();
          } else if (enSugerir) {
            const TEXTO = { pendiente: '⌛ Esperando', aceptada: '✓ En la lista', rechazada: '✕ No entró' };
            let cambio = '';
            misLista.replaceChildren(...validas.slice(-8).reverse().map(s => {
              if (s.estado === 'pendiente') marcas.set(`${s.copa}/${s.fila}`, '⌛');
              const antes = estadoDe.get(s.id);
              if (antes === 'pendiente' && s.estado !== 'pendiente') cambio = s.estado;
              estadoDe.set(s.id, s.estado);
              const li = el('li', { className: 'sugerencia estado-' + s.estado });
              verAlPasar(li, s);
              li.append(imagen(fotos.foto(s.copa, s.fila), 'renglon-foto'),
                el('span', { className: 'renglon-texto' }, nombreSpan(s.copa, s.fila), el('span', { className: 'renglon-copa', textContent: `Copa ${s.copa + 1} · pista ${s.fila + 1}` })),
                el('span', { className: 'estado', textContent: TEXTO[s.estado] || '' }));
              return li;
            }));
            misPanel.hidden = !validas.length;
            if (cambio === 'aceptada') sonidos.agregar(); else if (cambio === 'rechazada') sonidos.quitar();
          }
          primeraVez = false;
          marcarGrilla();
        };
        // el pie del modo sugerir: qué hacer, y «Listo» si se puede cerrar (entre carrera y carrera)
        const pieSug = el('div', { className: 'tu-lista-pie' },
          el('p', { className: 'sugerir-nota', textContent: conf.nota || 'El anfitrión arma la lista; tú le sugieres pistas. Cuando la confirme, eliges personaje y vehículo.' }),
          ...(cerrar ? [el('button', { type: 'button', className: 'boton primario', id: 'sugerirListo', textContent: 'Listo', onclick: () => terminar(null) })] : []));

        panel = el('section', { className: 'tu-lista' }, cab,
          ...(enLista ? [el('div', { className: 'tu-lista-acciones' }, azarBtn, vaciarBtn, guardadas)] : []), filas, vacia,
          ...(conSugerencias ? [sugPanel] : []), ...(enSugerir ? [misPanel] : []), ...(conf.extra ? [conf.extra] : []), enSugerir ? pieSug : pie);
        pintarListaYa = pintarLista;
        lado.append(panel);
      }
      lado.append(vista);

      const pintar = () => {
        const q = buscar.value.trim().toLowerCase();
        botonesPista.clear();
        tarjetas.length = 0;
        grilla.replaceChildren(...copas.map((pistas, c) => {
          if (q && !pistas.some(n => n.toLowerCase().includes(q))) return null;
          const tarjeta = el('div', { className: 'copa' });
          const cabeza = [imagen(fotos.copa(c), 'copa-icono'), el('b', { textContent: `Copa ${c + 1}` })];
          if (enGp) {
            tarjetas[c] = tarjeta;
            const cab = el('button', { type: 'button', className: 'copa-cab', title: `Copa ${c + 1}: clic para marcarla` }, ...cabeza);
            cab.addEventListener('focus', () => verCopa(c, 0, true));
            const tira = el('div', { className: 'copa-tira' }, ...[0, 1, 2, 3].map(f => {
              const i = el('img', { className: 'copa-tira-foto', alt: '', decoding: 'async', loading: 'lazy' });
              i.dataset.f = f;
              fotos.foto(c, f).then(u => { if (u) i.src = u; }).catch(() => {});
              return i;
            }));
            tarjeta.append(cab, tira);
            pistas.forEach((n, f) => {
              const b = el('button', { type: 'button', className: 'pista' + (q && !n.toLowerCase().includes(q) ? ' apagada' : '') },
                el('i', { className: 'pista-num', textContent: f + 1 }), el('span', { className: 'pista-nombre', textContent: n || `Pista ${f + 1}` }));
              b.dataset.f = f; b.setAttribute('translate', 'no');
              b.addEventListener('focus', () => { if (copaVista === c) verPista(f, false); else verCopa(c, f, false); });
              tarjeta.append(b);
            });
            let toque = false;
            const esperaCambio = () => elegida >= 0 && elegida !== c ? 250 : 60;   // (con una marcada, cambiar de copa pide quedarse más)
            tarjeta.addEventListener('pointerdown', e => { toque = e.pointerType === 'touch'; });
            tarjeta.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') prontoEn(() => { ubicar(tarjeta); verCopa(c, 0, true); }, esperaCambio()); });
            tarjeta.addEventListener('pointerover', e => {
              const x = e.pointerType !== 'touch' && e.target.closest('[data-f]');
              if (!x) return;
              const f = Number(x.dataset.f);
              if (copaVista === c) { clearTimeout(esperaVista); verPista(f, false); } else prontoEn(() => { ubicar(tarjeta); verCopa(c, f, false); }, esperaCambio());
            });
            tarjeta.addEventListener('click', e => {
              const x = e.target.closest('[data-f]');
              if (e.detail === 0 && elegida === c && !x) { terminar({ copa: c, fila: 0 }); return; }   // (Enter en una copa ya marcada)
              clearTimeout(esperaVista);
              if (toque) { lado.classList.remove('arriba'); lado.style.top = ''; } else ubicar(tarjeta);
              marcarCopa(c, x ? Number(x.dataset.f) : 0, !x);
              // con el dedo, el panel queda abajo: la tarjeta se desplaza para que no quede tapada
              if (toque && angosta.matches) requestAnimationFrame(() => {
                tarjeta.style.scrollMarginBottom = Math.ceil(lado.getBoundingClientRect().height + 8) + 'px';
                tarjeta.style.scrollMarginTop = Math.ceil((caja.querySelector('.elegir-cab')?.getBoundingClientRect().height || 0) + 8) + 'px';
                ignorarScrollHasta = performance.now() + 500;
                tarjeta.scrollIntoView({ block: 'nearest' });
              });
            });
            tarjeta.addEventListener('dblclick', () => terminar({ copa: c, fila: 0 }));
            return tarjeta;
          }
          tarjeta.append(el('div', { className: 'copa-cab' }, ...cabeza));
          pistas.forEach((n, f) => {
            const b = boton({ className: 'pista' + (q && !n.toLowerCase().includes(q) ? ' apagada' : '') }, () => mostrarPista(c, f),
              enLista ? () => alternar(c, f) : enSugerir ? () => sugerirP(c, f) : () => terminar({ copa: c, fila: f }), conLista);
            b.append(el('span', { className: 'pista-nombre', textContent: n || `Pista ${f + 1}` }));
            b.setAttribute('translate', 'no');
            if (conLista) botonesPista.set(`${c}/${f}`, b);
            tarjeta.append(b);
          });
          return tarjeta;
        }).filter(Boolean));
        pintarListaYa?.();
        if (enGp) {                                                // (al buscar se rehace la grilla: vuelven las marcas)
          tarjetas[elegida]?.classList.add('elegida');
          tarjetas[copaVista]?.classList.add('en-vista');
          tarjetas[copaVista]?.querySelectorAll('.pista').forEach((b, i) => b.classList.toggle('visto', i === pistaVista));
          pintarPedidas();
        }
      };
      buscar.oninput = pintar;
      const cabeza = el('div', { className: 'elegir-cab' }, el('h2', { textContent: titulo }), buscar);
      if (enGp) cabeza.append(el('button', { type: 'button', className: 'boton', id: 'copaAzar', textContent: '🎲 Una al azar',
        title: 'Marca una copa al azar (después, «Jugar la Copa N»)', onclick: () => {
          if (buscar.value) { buscar.value = ''; pintar(); }
          const c = Math.floor(Math.random() * copas.length);
          lado.classList.remove('arriba'); lado.style.top = '';
          marcarCopa(c, 0, true);
          ignorarScrollHasta = performance.now() + 800;
          tarjetas[c]?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        } }));
      if (enGp) cabeza.append(pedidasCab);
      if (cerrar && !enSugerir) cabeza.append(el('button', { type: 'button', className: 'boton', id: 'elegirCerrar', textContent: textoCerrar, onclick: () => terminar(null) }));
      caja.append(cabeza, el('div', { className: 'elegir-cuerpo' }, grilla, lado));
      document.body.append(caja);
      // en pantallas angostas el costado va fijo abajo: la grilla deja ese alto libre al final (sin esto la última copa
      // quedaba tapada, «la copa 79 cortada»)
      medidor = new ResizeObserver(() => {
        caja.style.setProperty('--alto-lado', Math.ceil(lado.getBoundingClientRect().height) + 'px');
        caja.style.setProperty('--alto-cab', Math.ceil(cabeza.getBoundingClientRect().height) + 'px');
      });
      medidor.observe(lado); medidor.observe(cabeza);
      caja.addEventListener('scroll', () => {
        if (conLista || !angosta.matches || !vista.classList.contains('con-algo')) { scrollBase = null; return; }
        if (performance.now() < ignorarScrollHasta || (enGp && elegida >= 0)) { scrollBase = caja.scrollTop; return; }
        if (scrollBase == null) scrollBase = caja.scrollTop;
        if (Math.abs(caja.scrollTop - scrollBase) < 32) return;
        scrollBase = null; vista.classList.remove('con-algo'); enVista = ''; pistaVista = -1; clearTimeout(relojAuto);
        caja.querySelectorAll('.visto').forEach(x => x.classList.remove('visto'));
      }, { passive: true });
      // al salir de la grilla, el panel vuelve a la copa marcada (cruzar otras copas camino al botón no la cambia)
      if (enGp) grilla.addEventListener('pointerleave', () => { clearTimeout(esperaVista); if (elegida >= 0 && copaVista !== elegida) verCopa(elegida, 0, false); });
      pintar();
      // el panel nunca está vacío en pantalla ancha: la primera copa, avanzando sola
      if (enGp && !angosta.matches) verCopa(0, 0, true);
      if (!matchMedia('(pointer: coarse)').matches) buscar.focus();
      // el control para quien abrió el selector (la sala): poner la lista, las sugerencias, cerrar
      const ctrl = {
        poner(ps) { if (!tuLista) return; const n = Array.isArray(ps) ? ps.length : 0; resaltar = n > tuLista.pistas.length ? n - 1 : -1; tuLista.poner(ps || []); },
        sugerencias(l) { pintarSugerencias(l); },
        pedidas(m) { pedidas = m && typeof m === 'object' ? m : {}; pintarPedidas(); },
        get pistas() { return tuLista ? tuLista.pistas : []; },
        cerrar(v = null) { if (caja.isConnected) terminar(v); },
        get abierto() { return caja.isConnected; },
      };
      window.mkwSelector = ctrl;                                   // (para las pruebas)
      try { conf.alAbrir?.(ctrl); } catch (e) { console.warn('[lista]', e); }
    });
  }

  // playlistBreve({ pistas, hechas, anfitrion, pendientes, nota, alAgregar, alSugerir, copas, titulo, botones, restan,
  // ultima, carrera, resultados }) — §74: entre carrera y carrera de la playlist de la sala, la lista un rato (mientras
  // se ven los resultados, al costado): las que vienen, cuántas ya se corrieron y «+ Agregar pistas» (el anfitrión) o
  // «Sugerir pista» (los demás). pendientes = cuántas sugerencias esperan (solo se le muestra al anfitrión).
  // §94: es el panel del DESCANSO de las dos salas (titulo 'Copa', botones: false en la copa): arriba la cuenta
  // (restan() = ms que faltan; ultima = después no hay otra carrera) y los resultados de la carrera que terminó
  // (resultados: [{ nombre, puesto, puntos, vrAntes, vrDespues, yo }]: el puesto, los puntos de la copa y el VR de
  // cada humano). Devuelve { poner(cambios), cerrar() }: la sala lo actualiza con cada estado y lo cierra cuando
  // arranca la carrera siguiente.
  // M22: alKart() = «Cambiar personaje y vehículo» (opcional, el de cada uno; no en la última); kart = null | 'eligiendo'
  // (el panel se achica a la cuenta y una línea: la pantalla del juego queda libre) | 'listo'.
  // M22 (modelo «Modo consola» del crítico): el panel es un ZÓCALO, una franja baja como la de la tele («Sigue: GBA
  // Bowser Castle 4 · 24 s»), y deja libre la tabla de puntos del juego. Se ve: la copa y cuántas van, la cuenta, la
  // pista que sigue (las demás: «y N más»), tu puesto y tu VR, y los botones. Los resultados de todos los humanos van
  // escritos en la tabla del juego (letreros.mjs, el ±VR al lado de cada fila); aquí quedan como lista para el lector de
  // pantalla (.pb-res, que no se ve).
  function playlistBreve(o) {
    document.getElementById('playlistBreve')?.remove();
    const caja = el('aside', { id: 'playlistBreve', className: 'playlist-breve' });
    caja.setAttribute('aria-label', o.titulo === 'Copa' ? 'El descanso de la copa' : 'La playlist de la sala');
    let nombres = null;
    nombresPistas(o.copas).then(n => { nombres = n; pintar(); }).catch(() => {});
    const nombre = (c, f) => nombres?.[c]?.[f] || `Copa ${c + 1} · pista ${f + 1}`;
    // la cuenta del descanso: solo su texto cambia cada medio segundo (repintar todo movería el foco de los botones)
    const cuenta = el('p', { className: 'pb-cuenta', id: 'pbCuenta' });
    const textoCuenta = () => {
      if (typeof o.restan !== 'function') return '';
      const s = Math.ceil(o.restan() / 1000);
      if (s <= 0) return o.ultima ? 'Fin de la copa…' : 'Empieza la carrera siguiente…';
      return `${o.ultima ? 'La copa termina en' : 'La carrera siguiente en'} ${s} s`;
    };
    const ponerCuenta = () => {
      const t = textoCuenta();
      cuenta.hidden = !t;
      if (cuenta.textContent !== t) cuenta.textContent = t;
      cuenta.classList.toggle('pronto', typeof o.restan === 'function' && o.restan() <= 5000);
    };
    const reloj = setInterval(() => { if (!caja.isConnected) { clearInterval(reloj); return; } ponerCuenta(); }, 500);
    const ordinal = n => `${n}.º`;
    const signo = d => (d >= 0 ? '+' : '−') + Math.abs(d);
    function pintar() {
      const ps = Array.isArray(o.pistas) ? o.pistas : [], hechas = Math.max(0, o.hechas | 0), quedan = ps.slice(hechas);
      // (M22: en el zócalo, solo la que sigue; la lista entera está en «+ Agregar pistas» / «Sugerir pista»)
      const lista = el('ol', { className: 'pb-lista' }, ...quedan.slice(0, 1).map((p, i) => {
        const nom = el('span', { className: 'pb-nombre', textContent: nombre(p.copa, p.fila) });
        nom.setAttribute('translate', 'no');
        return el('li', { className: i === 0 ? 'sigue' : '' }, el('span', { className: 'num', textContent: hechas + i + 1 }),
          imagen(fotos.foto(p.copa, p.fila), 'renglon-foto'), nom);
      }));
      const mas = quedan.length > 1 ? [el('p', { className: 'pb-mas', textContent: `y ${quedan.length - 1} más` })] : [];
      const botones = o.botones !== false;
      const vacia = quedan.length || !botones ? [] : [el('p', { className: 'pb-mas', textContent: o.anfitrion ? 'No quedan pistas: agrega más para seguir, o la copa termina aquí.' : 'No quedan pistas: la copa termina aquí, salvo que el anfitrión agregue más.' })];
      const pend = botones && o.anfitrion && o.pendientes > 0 ? [el('span', { className: 'sug-chip', textContent: `💬 ${o.pendientes}` })] : [];
      const boton = !botones ? [] : [o.anfitrion
        ? el('button', { type: 'button', className: 'boton primario', id: 'pbAgregar', textContent: '+ Agregar pistas', onclick: () => o.alAgregar?.() })
        : el('button', { type: 'button', className: 'boton', id: 'pbSugerir', textContent: 'Sugerir pista', onclick: () => o.alSugerir?.() })];
      // §94: los resultados de la carrera que terminó: puesto, puntos de la copa y el VR (antes → después) de cada humano
      const filas = (Array.isArray(o.resultados) ? o.resultados : []).slice().sort((x, y) => (x.puesto || 99) - (y.puesto || 99));
      // (M22: la lista entera, para el lector de pantalla; a la vista, solo tu fila: .pb-yo)
      const mia = filas.find(r => r.yo);
      const yo = mia && (mia.puesto || Number.isInteger(mia.vrDespues)) ? [el('p', { className: 'pb-yo' },
        el('span', { className: 'num', textContent: mia.puesto ? ordinal(mia.puesto) : '—' }),
        el('span', { textContent: Number.isInteger(mia.puntos) ? `${mia.puntos} pts` : '' }),
        ...(Number.isInteger(mia.vrAntes) && Number.isInteger(mia.vrDespues)
          ? [el('span', { className: 'pb-vr ' + (mia.vrDespues >= mia.vrAntes ? 'sube' : 'baja'),
              textContent: `VR ${mia.vrDespues.toLocaleString('es')} (${signo(mia.vrDespues - mia.vrAntes)})` })] : []))] : [];
      const res = filas.length ? [el('div', { className: 'pb-lector' },
        el('p', { className: 'pb-sub', textContent: o.carrera ? `Resultados de la carrera ${o.carrera}` : 'Resultados' }),
        el('ol', { className: 'pb-res' }, ...filas.map(r => {
          const quien = el('span', { className: 'pb-quien', textContent: r.yo ? `${r.nombre} (tú)` : r.nombre });
          quien.setAttribute('translate', 'no');
          const vr = Number.isInteger(r.vrAntes) && Number.isInteger(r.vrDespues)
            ? [el('span', { className: 'pb-vr ' + (r.vrDespues >= r.vrAntes ? 'sube' : 'baja'),
                textContent: `VR ${r.vrDespues.toLocaleString('es')} (${signo(r.vrDespues - r.vrAntes)})` })]
            : [el('span', { className: 'pb-vr' })];
          return el('li', { className: r.yo ? 'yo' : '' }, el('span', { className: 'num', textContent: r.puesto ? ordinal(r.puesto) : '—' }),
            quien, el('span', { className: 'pb-pts', textContent: Number.isInteger(r.puntos) ? `${r.puntos} pts` : '' }), ...vr);
        })))] : [];
      const cab = o.titulo === 'Copa'
        ? el('span', { textContent: `${hechas} de ${ps.length} corridas` })
        : el('span', { textContent: hechas ? `${hechas} de ${ps.length} corridas` : `${ps.length} ${ps.length === 1 ? 'pista' : 'pistas'}` });
      const viene = quedan.length ? [el('div', { className: 'pb-viene' }, el('p', { className: 'pb-sub', textContent: 'Sigue' }), lista, ...mas)] : [];
      const eligiendo = o.kart === 'eligiendo';
      caja.classList.toggle('eligiendo', eligiendo);
      if (eligiendo) {
        caja.replaceChildren(el('div', { className: 'pb-cab' }, el('b', { textContent: 'Tu personaje' })), cuenta,
          el('p', { className: 'pb-kart', textContent: 'Elige personaje y vehículo en el juego. Si no alcanzas, corres con el de antes.' }));
        ponerCuenta();
        return;
      }
      const kart = typeof o.alKart !== 'function' || o.ultima ? []
        : o.kart === 'listo' ? [el('p', { className: 'pb-kart', textContent: `¡Listo! Corres la carrera ${(o.carrera | 0) + 1} con tu elección nueva.` })]
        : [el('button', { type: 'button', className: 'boton', id: 'pbKart', textContent: 'Cambiar personaje y vehículo', onclick: () => o.alKart() })];
      caja.replaceChildren(
        el('div', { className: 'pb-cab' }, el('b', { textContent: o.titulo || 'Playlist' }), cab, ...pend),
        cuenta, ...yo, ...viene, ...vacia, ...(o.nota ? [el('p', { className: 'pb-nota', textContent: o.nota })] : []), ...kart, ...boton, ...res);
      ponerCuenta();
    }
    pintar();
    document.body.append(caja);
    return {
      poner(cambios) { Object.assign(o, cambios || {}); if (caja.isConnected) pintar(); },
      cerrar() { clearInterval(reloj); caja.remove(); },
      get abierto() { return caja.isConnected; },
    };
  }

  return { preguntar, avisar, partidaCambio, sonidoCambio, empezo, abrirCajon, cerrarCajon, respaldar, aviso, accion, chip, elegirPista, cortina, playlistBreve,
           conPortada, get cortinaPuesta() { return !document.body.classList.contains('sin-cortina'); },
           estado: t => { estado.textContent = t; } };
}
