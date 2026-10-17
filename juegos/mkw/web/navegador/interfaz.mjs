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
//   - la columna de modos (window.mkwModo dice cuál se eligió; mkw.mjs lo usa al arrancar).
//
// Uso (en mkw.mjs):  const ui = crearInterfaz({ guardado, sonido, controles, alCambiarGuardado });
//                    ui.preguntar({...}), ui.avisar(...), ui.partidaCambio(), ui.sonidoCambio(), ui.empezo()

import { leerRksys, resumenLicencia, queArchivo, RUTA_RKSYS } from './licencias.mjs';
import { crearRespaldos } from './respaldos.mjs';
import { abrirEditorMii } from './editor-mii.mjs';

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
  vs: '<path d="M8 4v25" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M9 5h16v12H9z" fill="#fff"/><path d="M9 5h4v4H9zm8 0h4v4h-4zm-4 4h4v4h-4zm8 0h4v4h-4zm-12 4h4v4H9zm8 0h4v4h-4z" fill="#222"/>',
  tt: '<circle cx="16" cy="18" r="10" fill="none" stroke="#fff" stroke-width="3"/><path d="M16 18v-6M16 18l4 3" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M13 4h6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  bat: '<ellipse cx="16" cy="12" rx="8" ry="9" fill="#fff"/><path d="M16 21l-2 3h4z" fill="#fff"/><path d="M16 24c0 3-3 3-3 6" fill="none" stroke="#fff" stroke-width="1.8"/><ellipse cx="13" cy="9" rx="2" ry="3" fill="#ffffff88"/>',
  red: '<circle cx="16" cy="16" r="11" fill="none" stroke="#fff" stroke-width="2.8"/><path d="M5 16h22M16 5c-5 6-5 16 0 22M16 5c5 6 5 16 0 22" fill="none" stroke="#fff" stroke-width="2.4"/>',
  mii: '<circle cx="16" cy="14" r="9" fill="#fff"/><path d="M7 29c1-6 5-8 9-8s8 2 9 8z" fill="#fff"/><circle cx="13" cy="13" r="1.4" fill="#333"/><circle cx="19" cy="13" r="1.4" fill="#333"/><path d="M13 17q3 2 6 0" fill="none" stroke="#333" stroke-width="1.4" stroke-linecap="round"/>',
};
// Los modos. `listo` = ya funciona desde la página; los demás se juegan entrando con «Jugar libre» y eligiéndolos en el
// menú del juego, hasta que la página sepa llevarte directo (bitácora §55, "elegir carrera").
export const MODOS = [
  { id: 'libre', nombre: 'Jugar libre', texto: 'Los menús del juego, como en la Wii: todos los modos y las 200+ pistas.', listo: true },
  { id: 'gp', nombre: 'Gran Premio', texto: 'Una copa completa: 4 carreras contra la CPU. Te llevamos directo.', listo: true },
  { id: 'vs', nombre: 'Carrera', texto: 'La pista que elijas, contra la CPU. Te llevamos directo.', listo: true },
  { id: 'tt', nombre: 'Contrarreloj', texto: 'Tú contra el reloj y tus fantasmas.', listo: false },
  { id: 'bat', nombre: 'Batalla', texto: 'Globos o monedas en las arenas.', listo: false },
  { id: 'red', nombre: 'En línea', texto: 'Salas de Paginita Pro: juega con tus amigos.', listo: false },
  { id: 'mii', nombre: 'Mi Mii', texto: 'Crea o cambia tu Mii sin abrir el juego.', listo: true, accion: true },
];

export function crearInterfaz({ guardado, sonido, controles, alCambiarGuardado = () => {} }) {
  const respaldos = crearRespaldos();
  const enJuegos = window.parent !== window;
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
  // El mando: la pastilla dice cuál hay (o que falta apretar un botón)
  setInterval(() => {
    const m = controles.estado.mandos, p = $('mando');
    p.classList.toggle('ok', m.length > 0);
    p.textContent = m.length ? '🎮 ' + m.map(x => x.nombre.replace(/\s*\(.*\)$/, '')).join(' · ') : 'Mando: aprieta un botón';
    p.hidden = document.body.classList.contains('tactil') && !m.length;
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
    for (const id of ['licenciasInicio', 'licenciasPanel']) $(id).replaceChildren(...licencias.map(fichaLicencia));
    $('partidaVacia').hidden = licencias.length > 0;
    const e = guardado.estado, chip = $('chipPartida');
    chip.className = 'chip' + (licencias.length ? ' bien' : '');
    chip.textContent = e.error ? 'error al guardar' : licencias.length
      ? (e.ultimoGuardado ? `guardada aquí · ${hora(e.ultimoGuardado)}` : 'guardada en este navegador') : 'sin partida';
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
    if (tipo === 'rfldb' || tipo === 'mii') return abrirMii({ importar: bytes, nombreArchivo: archivo.name });
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
  $('bajarPartidas').onclick = async () => bajar(await guardado.exportar(), `partida-mkw-${new Date().toISOString().slice(0, 10)}.mkwp`);
  $('borrarPartidas').onclick = async () => {
    if (!await preguntar({ titulo: 'Borrar las partidas', si: 'Borrar', peligro: true,
      texto: 'Se borran las licencias, los ajustes y los fantasmas guardados en este navegador. Queda una copia de respaldo en «Copias de respaldo» por si te arrepientes.' })) return;
    await respaldar('antes de borrar todo');
    await guardado.borrarTodo();
    location.reload();
  };

  // ---------------- Mi Mii ----------------
  function abrirMii(opciones = {}) {
    return abrirEditorMii({ guardado, preguntar, avisar, bajar, respaldar, licencias, ...opciones,
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
    };
    modos.append(b);
  }
  function elegirModo(id) {
    elegido.modo = id; guardarPref('modo', id);
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

  // ---------------- Aviso sobre el juego y elegir copa/pista ----------------
  const avisoJuego = el('div', { id: 'avisoJuego', role: 'status', hidden: true });
  document.body.append(avisoJuego);
  function aviso(texto, mal = false) {
    avisoJuego.textContent = texto; avisoJuego.hidden = !texto; avisoJuego.classList.toggle('mal', mal);
    if (texto && !texto.includes('…')) setTimeout(() => { if (avisoJuego.textContent === texto) avisoJuego.hidden = true; }, 6000);   // los de «…» quedan mientras dure
  }
  // La lista de copas (Gran Premio) o de pistas (Carrera), con los nombres que trae el juego (menus.mjs: leerNombres).
  // Los nombres quedan anotados en este navegador (localStorage) para la próxima vez. Devuelve {copa, fila} o null.
  function elegirPista({ modo, copas }) {
    if (copas && copas.length) guardarPref('pistas', copas); else copas = leerPref('pistas', null);
    if (!copas || !copas.length) copas = Array.from({ length: 8 }, () => ['', '', '', '']);
    return new Promise(listo => {
      const caja = el('div', { id: 'elegirPista' });
      const titulo = modo === 'gp' ? 'Elige la copa' : 'Elige la pista';
      const buscar = el('input', { type: 'search', placeholder: 'Buscar pista (p. ej. «N64» o «Rainbow»)' });
      buscar.setAttribute('aria-label', 'Buscar pista');
      const lista = el('div', { className: 'copas' });
      const terminar = v => { caja.remove(); listo(v); };
      const pintar = () => {
        const q = buscar.value.trim().toLowerCase();
        lista.replaceChildren(...copas.map((pistas, c) => {
          if (q && !pistas.some(n => n.toLowerCase().includes(q))) return null;
          const tarjeta = el('div', { className: 'copa' });
          const cab = el('button', { type: 'button', className: 'copa-cab', disabled: modo !== 'gp' },
            el('b', { textContent: `Copa ${c + 1}` }), ...(modo === 'gp' ? [el('span', { textContent: 'Jugar esta copa ▸' })] : []));
          cab.onclick = () => terminar({ copa: c, fila: 0 });
          tarjeta.append(cab);
          pistas.forEach((n, f) => {
            const b = el('button', { type: 'button', className: 'pista', textContent: n || `Pista ${f + 1}`, disabled: modo === 'gp' });
            b.setAttribute('translate', 'no');
            b.onclick = () => terminar({ copa: c, fila: f });
            tarjeta.append(b);
          });
          return tarjeta;
        }).filter(Boolean));
      };
      buscar.oninput = pintar;
      caja.append(el('div', { className: 'elegir-cab' }, el('h2', { textContent: titulo }), buscar,
        el('button', { type: 'button', className: 'boton', textContent: 'Prefiero los menús del juego', onclick: () => terminar(null) })), lista);
      document.body.append(caja);
      pintar();
      buscar.focus();
    });
  }

  return { preguntar, avisar, partidaCambio, sonidoCambio, empezo, abrirCajon, cerrarCajon, respaldar, aviso, elegirPista,
           estado: t => { estado.textContent = t; } };
}
