// "Mi Mii": el editor de Mii de la página, sin arrancar el juego — bitácora §55.
//
// Resumen: abre la base de Mii guardada en este navegador (RFL_DB.dat, la de la memoria interna de la Wii que lee Mario
// Kart Wii), muestra la lista de Mii y deja crear, duplicar, borrar y cambiar cada rasgo con deslizadores (pestañas
// como el editor de la Wii: Datos, Cara, Pelo, Cejas, Ojos, Nariz, Boca, Lentes, Barba, Lunar), con una vista previa
// aproximada dibujada por nosotros (mii.mjs). "Guardar" escribe la base con su suma de control en IndexedDB (con una
// copia de respaldo antes); el juego la lee al arrancar, así que los cambios se ven la próxima vez que se juega.
// También se puede cargar un Mii suelto (.mii, 74 bytes) o una base entera (RFL_DB.dat) y descargarlos.
//
// El Mii de una licencia se reconoce por su id (4 bytes, ver licencias.mjs: miiId): si se edita ese Mii, se conserva el
// id y la licencia lo sigue encontrando. Duplicar le da un id nuevo.

import { desarmarMii, armarMii, miiNuevo, duplicarMii, miiDesdePreset, miiAlAzar, PRESETS, leerBase, armarBase, vistaPrevia, idTexto, mismoId,
         RASGOS, COLORES_FAVORITOS, COLORES_HEX, RUTA_RFLDB, MAX_MII } from './mii.mjs';

const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };
const obtener = (o, ruta) => ruta.split('.').reduce((x, k) => x && x[k], o);
function poner(o, ruta, v) { const k = ruta.split('.'); let x = o; for (const p of k.slice(0, -1)) x = x[p] ??= {}; x[k.at(-1)] = v; }
const idNumero = m => ((m.id[0] << 24) | (m.id[1] << 16) | (m.id[2] << 8) | m.id[3]) >>> 0;

export async function abrirEditorMii({ guardado, preguntar, avisar, bajar, respaldar, licencias = [], importar = null, nombreArchivo = '', alGuardar = () => {} }) {
  const caja = document.getElementById('editorMii');
  let original = null, lista = [], actual = 0, pestana = 'Datos', cambiado = false, galeria = false;

  // 1) La base guardada (si hay)
  try {
    const b = await guardado.leerArchivo(RUTA_RFLDB);
    if (b) { const r = leerBase(b); if (r.mii.length || r.crcBien) { original = b; lista = r.mii.map(x => x.mii); } }
  } catch {}

  // 2) Lo que se trajo para cargar (desde «Cargar mi partida» o arrastrado)
  if (importar) {
    if (importar.length === 74 || importar.length === 76) {
      let m;
      try { m = desarmarMii(importar.subarray(0, 74)); } catch { return avisar('No se puede cargar', 'Ese archivo no es un Mii.'); }
      const i = lista.findIndex(x => mismoId(x, m));
      if (i >= 0) { lista[i] = m; actual = i; } else if (lista.length < MAX_MII) { lista.push(m); actual = lista.length - 1; }
      cambiado = true;
    } else {
      const r = leerBase(importar);
      if (!r.valida) return avisar('No se puede cargar', `Esa base de Mii ${r.problema}.`);
      if (!await preguntar({ titulo: 'Cargar esta base de Mii', si: 'Cargar', texto: `Trae ${r.mii.length} Mii y reemplaza los de este navegador al guardar.` })) return;
      original = importar; lista = r.mii.map(x => x.mii); cambiado = true;
    }
  }

  // ¿Qué Mii usa cada licencia? (para marcarlo: "el de tu licencia")
  const deLicencia = m => licencias.find(l => l.miiId === idNumero(m));

  function pintar() {
    caja.replaceChildren();
    const cabeza = el('div', { className: 'mii-cabeza' },
      el('button', { type: 'button', className: 'boton', textContent: '← Volver', onclick: cerrar }),
      el('h2', { textContent: 'Mi Mii' }));
    const marco = el('div', { className: 'mii-marco' }, cabeza);

    // La lista de la izquierda
    const col = el('div', { className: 'mii-lista' });
    lista.forEach((m, i) => {
      const b = el('button', { type: 'button', className: 'mii', onclick: () => { actual = i; pintar(); } });
      b.setAttribute('aria-pressed', String(i === actual));
      b.innerHTML = vistaPrevia(m, 40);
      const lic = deLicencia(m);
      const nombre = el('span', { textContent: (m.nombre || 'Mii') + (lic ? ' ⭐' : '') });
      nombre.setAttribute('translate', 'no');
      if (lic) b.title = `El Mii de tu licencia ${lic.casilla}`;
      b.append(nombre);
      col.append(b);
    });
    col.append(el('button', { type: 'button', className: 'boton principal', textContent: '+ Mii nuevo', disabled: lista.length >= MAX_MII,
      onclick: () => { galeria = true; pintar(); } }));
    marco.append(col);

    // La galería de caras de partida (como los Mii «invitado» del juego): elegir una y después ponerle nombre
    if (galeria || !lista.length) {
      const caja2 = el('div', { className: 'mii-editor', style: 'display:block' });
      caja2.append(el('h3', { textContent: 'Elige una cara para empezar', style: 'margin:0 0 4px;color:#ff9ad5;font:400 20px Lilita One,system-ui' }),
        el('p', { textContent: 'Como los Mii invitados del juego: eliges una, le pones tu nombre y tu color, y si quieres la cambias rasgo por rasgo.', style: 'margin:0 0 10px;font-size:13px;color:var(--suave)' }));
      const grilla = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px' });
      const elegir = m => { lista.push(m); actual = lista.length - 1; cambiado = true; galeria = false; pestana = 'Datos'; pintar();
        const i = caja.querySelector('.mii-campos input[type=text]'); if (i) { i.focus(); i.select(); } };
      PRESETS.forEach((_, i) => {
        const m = miiDesdePreset(i, { colorFavorito: i % 12 });
        const b = el('button', { type: 'button', className: 'mii', style: 'flex-direction:column;justify-content:center', title: m.esChica ? 'Chica' : 'Chico',
          onclick: () => elegir(miiDesdePreset(i, { colorFavorito: i % 12 })) });
        b.innerHTML = vistaPrevia(m, 72);
        grilla.append(b);
      });
      const azar = el('button', { type: 'button', className: 'mii', style: 'flex-direction:column;justify-content:center;font-size:28px', title: 'Una cara al azar',
        textContent: '🎲', onclick: () => elegir(miiAlAzar()) });
      grilla.append(azar);
      caja2.append(grilla);
      if (lista.length) caja2.append(el('button', { type: 'button', className: 'boton', textContent: 'Cancelar', style: 'margin-top:10px', onclick: () => { galeria = false; pintar(); } }));
      marco.append(caja2);
      caja.append(marco);
      return;
    }
    if (!lista.length) {
      marco.append(el('div', { className: 'mii-editor', style: 'display:block' }, el('div', {},
        el('p', { textContent: 'Todavía no hay Mii en este navegador. Crea el tuyo con «+ Mii nuevo», o carga un Mii (.mii) o la base de Mii de tu Wii o Dolphin (RFL_DB.dat) con «Cargar mi partida…».' }))));
      caja.append(marco);
      return;
    }
    actual = Math.min(actual, lista.length - 1);
    const m = lista[actual];

    // La vista previa y las pestañas
    const vista = el('div', { className: 'mii-vista' });
    const dibujo = el('div'); dibujo.innerHTML = vistaPrevia(m, 180);
    vista.append(dibujo, el('small', { textContent: 'Vista aproximada (dibujo de la página). En el juego se ve el Mii de verdad.' }));
    const lic = deLicencia(m);
    if (lic) vista.append(el('small', { textContent: `⭐ Es el Mii de tu licencia ${lic.casilla}: los cambios se ven en ella.` }));
    const derecha = el('div');
    const pest = el('div', { className: 'mii-pestanas', role: 'tablist' });
    for (const p of Object.keys(RASGOS)) {
      const b = el('button', { type: 'button', textContent: p, onclick: () => { pestana = p; pintar(); } });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(p === pestana));
      pest.append(b);
    }
    const campos = el('div', { className: 'mii-campos' });
    const refrescar = () => { dibujo.innerHTML = vistaPrevia(m, 180); cambiado = true; const mini = col.children[actual]; if (mini) { mini.querySelector('svg').outerHTML = vistaPrevia(m, 40); } };
    if (pestana === 'Datos') {
      const texto = (etq, campo, max) => {
        const i = el('input', { type: 'text', value: m[campo] || '', maxLength: max });
        i.setAttribute('translate', 'no');
        i.oninput = () => { m[campo] = i.value; refrescar(); };
        return el('label', {}, etq, i, el('span'));
      };
      campos.append(texto('Nombre', 'nombre', 10), texto('Creador', 'creador', 10));
      const sexo = el('div', { className: 'fichas' });
      for (const [v, t] of [[0, 'Chico'], [1, 'Chica']]) {
        const b = el('button', { type: 'button', textContent: t, onclick: () => { m.esChica = v; refrescar(); pintar(); } });
        b.setAttribute('aria-pressed', String(m.esChica === v));
        sexo.append(b);
      }
      campos.append(el('label', {}, 'Es', sexo, el('span')));
      const colores = el('div', { className: 'colores' });
      COLORES_HEX.forEach((c, i) => {
        const b = el('button', { type: 'button', title: COLORES_FAVORITOS[i], style: `background:${c}`, onclick: () => { m.colorFavorito = i; refrescar(); pintar(); } });
        b.setAttribute('aria-pressed', String(m.colorFavorito === i));
        colores.append(b);
      });
      campos.append(el('label', {}, 'Color favorito', colores, el('span')));
    }
    for (const [campo, etq, min, max] of RASGOS[pestana]) {
      if (campo === 'colorFavorito') continue;          // va con las muestras de color, arriba
      const salida = el('output', { textContent: obtener(m, campo) });
      const r = el('input', { type: 'range', min, max, value: obtener(m, campo) });
      r.oninput = () => { poner(m, campo, Number(r.value)); salida.textContent = r.value; refrescar(); };
      campos.append(el('label', {}, etq, r, salida));
    }
    derecha.append(pest, campos);
    marco.append(el('div', { className: 'mii-editor' }, vista, derecha));

    // El pie: guardar, duplicar, borrar, descargar
    const pie = el('div', { className: 'mii-pie' },
      el('button', { type: 'button', className: 'boton principal', textContent: 'Guardar para el juego', onclick: guardar }),
      el('button', { type: 'button', className: 'boton', textContent: 'Duplicar', disabled: lista.length >= MAX_MII,
        onclick: () => { lista.splice(actual + 1, 0, duplicarMii(m)); actual++; cambiado = true; pintar(); } }),
      el('button', { type: 'button', className: 'boton', textContent: 'Descargar este Mii (.mii)',
        onclick: () => bajar(new Blob([armarMii(m)]), `${(m.nombre || 'mii').replace(/[^\w-]+/g, '_')}.mii`) }),
      el('button', { type: 'button', className: 'boton', textContent: 'Descargar todos (RFL_DB.dat)',
        onclick: () => bajar(new Blob([armarBase(lista, original)]), 'RFL_DB.dat') }),
      el('button', { type: 'button', className: 'boton peligro', textContent: 'Borrar este Mii', onclick: async () => {
        const extra = deLicencia(m) ? ' <b>Es el Mii de una licencia</b>: la licencia quedará con un Mii invitado.' : '';
        if (!await preguntar({ titulo: 'Borrar Mii', si: 'Borrar', peligro: true, texto: `Se quita de la lista (se borra de verdad al guardar).${extra}` })) return;
        lista.splice(actual, 1); actual = Math.max(0, actual - 1); cambiado = true; pintar();
      } }),
      el('p', { textContent: cambiado ? 'Hay cambios sin guardar. Se aplican al juego la próxima vez que lo arranques.'
                                      : 'El juego lee los Mii al arrancar: al crear o elegir la licencia aparecen en «Elegir Mii».' }));
    marco.append(pie);
    caja.append(marco);
  }

  async function guardar() {
    try {
      await respaldar('antes de guardar los Mii');
      const base = armarBase(lista, original);
      await guardado.ponerArchivo(RUTA_RFLDB, base);
      original = base; cambiado = false;
      alGuardar();
      pintar();
      await avisar('Mii guardados', `Quedaron ${lista.length} Mii en este navegador. Los verás en el juego la próxima vez que lo arranques (al crear una licencia, en «Elegir Mii»).`);
    } catch (e) { avisar('No se pudo guardar', String(e.message || e)); }
  }
  async function cerrar() {
    if (cambiado && !await preguntar({ titulo: 'Salir sin guardar', si: 'Salir', texto: 'Hay cambios en los Mii que no se guardaron.' })) return;
    caja.hidden = true;
    caja.replaceChildren();
  }
  caja.hidden = false;
  pintar();
  if (importar && nombreArchivo) console.log('[mii] cargado ' + nombreArchivo + ' (' + idTexto(lista[actual] || miiNuevo()) + ')');
}
