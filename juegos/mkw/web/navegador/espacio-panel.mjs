// La pantalla «Espacio» del cajón (Avanzado → Datos del juego) — bitácora §251, el diseño que eligió el dueño: la
// opción B arriba (una barra apilada con las cuatro partes) y la A adentro (la lista de pistas con casillas).
//
// Resumen: espacio.mjs hace las cuentas; esto las dibuja y atiende los toques, el ratón, el teclado y el mando:
//   - arriba, la barra de espacio partida en Pistas, Karts y sonidos comunes, Básico del juego y Partidas y fantasmas
//     (🔒: solo lleva al panel «Partida»; aquí nunca se borran). Cada parte se toca y abre su lista;
//   - el botón grande «Borrar todas las pistas salvo las ⭐» y, opcional y apagado, el tope de espacio (1/2/4 GB);
//   - la lista: por fila la casilla, el nombre, la copa, los MB y la última vez jugada; ordenar por última vez (la más
//     vieja primero, por omisión), tamaño, nombre o copa (con el mando: los gatillos LT/RT cambian el orden); «Marcar
//     todas» (nunca una ⭐) y «Ninguna»; la ⭐ de cada fila la protege; el botón dice cuántas y cuántos MB y pide
//     confirmación; después «Deshacer» durante 8 s y recién al vencer se borra de verdad;
//   - en el teléfono: filas de 48 px o más y toda la fila marca; con el mando, el cursor del sitio (mando-sitio.mjs).
// Nada se rehace bajo el puntero mientras se aprieta (§112: un nodo que se saca y se vuelve a poner pierde el clic): la
// pantalla se vuelve a armar solo después de un clic o cuando llegan datos nuevos; la cuenta del «Deshacer» cambia
// solo su texto.
//
// Uso:  const p = montarEspacio(nodo, { leer: async () => resumen (armarResumen), borrar: async rutas → {borrados…},
//                                       uso: crearUsoPistas(), preguntar, alPartida, mandos: () => navigator.getGamepads() });
//       p.refrescar(); p.abrir('pistas'); p.estado (para las pruebas)

import { ordenar, crearSeleccion, crearPendiente, ORDENES, TOPES_GB, haceCuanto, mb, elegirPorTope } from './espacio.mjs';

const CSS = `
.esp { --e-linea: var(--linea, #3a3361); --e-panel: var(--panel2, #201c38); --e-suave: var(--suave, #a7a3bd);
  --e-texto: var(--texto, #f1effa); --e-lila: var(--lila, #ab8bff); --e-peligro: var(--peligro, #ff6b7a); color: var(--e-texto); }
.esp-barra { display: flex; height: 18px; border-radius: 9px; overflow: hidden; background: #0004; border: 1px solid var(--e-linea); margin: 6px 0 4px; }
.esp-barra > span { display: block; min-width: 0; }
.esp-c-pistas { background: #7042df; } .esp-c-comun { background: #3fd59a; } .esp-c-basico { background: #ffd21f; } .esp-c-partidas { background: #a7a3bd; }
.esp-total { font-size: 13px; color: var(--e-suave); margin: 0 0 6px; }
.esp-partes { display: grid; gap: 6px; margin: 6px 0 10px; }
.esp-parte { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 12px; border-radius: 10px; width: 100%;
  border: 1px solid var(--e-linea); background: var(--e-panel); color: var(--e-texto); text-align: left; font: inherit; cursor: pointer; box-sizing: border-box; }
.esp-parte:hover, .esp-parte:focus-visible { border-color: var(--e-lila); outline: none; }
.esp-punto { width: 12px; height: 12px; border-radius: 3px; flex: none; }
.esp-parte b { flex: 1; font-weight: 600; } .esp-parte small { color: var(--e-suave); }
.esp-grande { width: 100%; min-height: 48px; font-size: 15px; }
.esp-tope { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 0 2px; font-size: 13px; }
.esp-tope button { min-height: 40px; min-width: 56px; }
.esp-tope button[aria-pressed="true"] { background: var(--morado, #7042df); border-color: var(--morado, #7042df); color: #fff; }
.esp-nota { font-size: 12px; color: var(--e-suave); margin: 2px 0 8px; }
.esp-cab { display: flex; align-items: center; gap: 8px; margin: 2px 0 6px; flex-wrap: wrap; }
.esp-cab h4 { margin: 0; flex: 1; font-size: 15px; }
.esp-ordenes, .esp-marcar { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; align-items: center; }
.esp-ordenes button { min-height: 40px; }
.esp-ordenes button[aria-pressed="true"] { border-color: var(--e-lila); color: var(--e-lila); }
.esp-gatillo { font-size: 11px; color: var(--e-suave); }
.esp-lista { display: grid; gap: 4px; margin: 6px 0; max-height: 52vh; overflow: auto; overscroll-behavior: contain; }
.esp-fila { display: grid; grid-template-columns: 28px 1fr auto 40px; align-items: center; gap: 4px 8px; min-height: 48px;
  padding: 4px 8px; border-radius: 10px; border: 1px solid var(--e-linea); background: var(--e-panel); cursor: pointer; box-sizing: border-box; }
.esp-fila:hover { border-color: var(--e-lila); }
.esp-fila.marcada { border-color: var(--e-peligro); background: #3a1c2e; }
.esp-fila.protegida { opacity: .6; cursor: default; }
.esp-fila input { width: 20px; height: 20px; margin: 0; }
.esp-nombre { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.esp-nombre small { display: block; color: var(--e-suave); font-size: 12px; }
.esp-mb { font-variant-numeric: tabular-nums; text-align: right; font-size: 13px; }
.esp-estrella { width: 40px; height: 40px; border-radius: 8px; border: 1px solid transparent; background: none; font-size: 20px; cursor: pointer; color: var(--e-suave); }
.esp-estrella[aria-pressed="true"] { color: #ffd21f; }
.esp-estrella:focus-visible { border-color: var(--e-lila); outline: none; }
.esp-accion { width: 100%; min-height: 48px; margin-top: 4px; }
.esp-deshacer { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; margin: 8px 0;
  background: #2b2140; border: 1px solid var(--e-lila); font-size: 14px; }
.esp-deshacer span { flex: 1; }
.esp-deshacer button { min-height: 44px; }
.esp-vacia { color: var(--e-suave); font-size: 13px; padding: 8px 0; }
`;

export function montarEspacio(nodo, { leer, borrar, uso, preguntar = async () => true, alPartida = () => {},
                                     mandos = () => (globalThis.navigator?.getGamepads?.() || []), ms = 8000,
                                     reloj = undefined, ahora = () => Date.now(), aplazar = () => false, alBorrar = () => {} } = {}) {
  const doc = nodo.ownerDocument;
  if (!doc.getElementById('esp-estilo')) doc.head.append(Object.assign(doc.createElement('style'), { id: 'esp-estilo', textContent: CSS }));
  const el = (tag, props = {}, ...hijos) => { const e = Object.assign(doc.createElement(tag), props); for (const h of hijos) if (h != null) e.append(h); return e; };
  const boton = (texto, props = {}) => el('button', { type: 'button', className: 'boton', textContent: texto, ...props });

  const estado = { vista: 'resumen', orden: 'vez', inverso: false, resumen: null, pendientes: new Set(), ultimo: null, cargando: false };
  const seleccion = { pistas: crearSeleccion({ claveDe: f => f.clave }), comun: crearSeleccion({ claveDe: f => f.clave }), basico: crearSeleccion({ claveDe: f => f.clave }) };
  const pendiente = crearPendiente({ ms, reloj, aplazar, ejecutar: async items => {
    const rutas = items.flatMap(f => f.rutas);
    const r = await borrar(rutas);
    const pistas = items.filter(f => f.pista >= 0).map(f => f.pista);
    alBorrar({ items, resultado: r, pistas });
    return r;
  } });
  let toast = null, relojToast = null;

  // Las filas de cada lista, sin lo que está esperando su «Deshacer»
  const filasDe = vista => {
    const r = estado.resumen;
    if (!r) return [];
    let filas;
    if (vista === 'pistas') filas = r.pistas.lista.map(f => ({ ...f, clave: 'p:' + f.pista, estrella: uso?.estrellas().has(f.pista) || false }));
    else if (vista === 'comun') filas = r.comun.lista.map(f => ({ ...f, clave: 'c:' + f.id, c: 0, f: 0, t: 0, copa: '' }));
    else filas = r.basico.bytes > 0 ? [{ clave: 'basico', nombre: 'Todo lo básico del juego', copa: '', c: 0, f: 0, t: 0, bytes: r.basico.bytes, rutas: r.basico.rutas }] : [];
    return filas.filter(f => !estado.pendientes.has(f.clave));
  };
  const suma = vista => filasDe(vista).reduce((s, f) => s + f.bytes, 0);

  async function refrescar() {
    estado.cargando = true;
    try { estado.resumen = await leer(); } catch (e) { estado.error = String(e); }
    estado.cargando = false;
    pintar();
    return estado.resumen;
  }

  function pintarResumen() {
    const r = estado.resumen;
    const partes = [
      ['pistas', 'Pistas', suma('pistas'), r ? `${filasDe('pistas').filter(f => f.pista >= 0).length} guardadas` : ''],
      ['comun', 'Karts y sonidos comunes', suma('comun'), 'StaticR, fanfarrias, karts, sonidos, videos'],
      ['basico', 'Básico del juego', suma('basico'), 'lo que el juego necesita para arrancar'],
      ['partidas', 'Partidas y fantasmas 🔒', r?.partidas?.bytes || 0, 'se cuidan en el panel «Partida»'],
    ];
    const total = partes.reduce((s, p) => s + p[2], 0) || 1;
    const barra = el('div', { className: 'esp-barra', role: 'img', ariaLabel: 'Espacio usado por partes' },
      ...partes.map(([id, nombre, b]) => el('span', { className: 'esp-c-' + id, title: `${nombre}: ${mb(b)}`, style: `width:${(100 * b / total).toFixed(2)}%` })));
    const lista = el('div', { className: 'esp-partes' }, ...partes.map(([id, nombre, b, sub]) => {
      const bt = el('button', { type: 'button', className: 'esp-parte' },
        el('span', { className: 'esp-punto esp-c-' + id }), el('b', { textContent: nombre }), el('small', { textContent: `${mb(b)} · ${sub}` }));
      bt.dataset.parte = id;
      bt.addEventListener('click', () => id === 'partidas' ? alPartida() : abrir(id));
      return bt;
    }));
    const salvoEstrellas = filasDe('pistas').filter(f => f.pista >= 0 && !f.estrella && !f.protegida);
    const grande = boton(`🗑 Borrar todas las pistas salvo las ⭐ (${salvoEstrellas.length} · ${mb(salvoEstrellas.reduce((s, f) => s + f.bytes, 0))})`,
      { className: 'boton peligro esp-grande', id: 'espBorrarPistas', disabled: !salvoEstrellas.length });
    grande.addEventListener('click', () => pedirBorrar(salvoEstrellas, 'pistas'));
    const tope = uso?.tope() || 0;
    const topes = el('div', { className: 'esp-tope' }, el('span', { textContent: 'Tope de espacio:' }),
      ...TOPES_GB.map(g => { const b = boton(g ? `${g} GB` : 'No', { className: 'boton chico' }); b.dataset.tope = g; b.setAttribute('aria-pressed', String(g === tope));
        b.addEventListener('click', () => { uso?.ponerTope(g); pintar(); }); return b; }));
    return [
      el('p', { className: 'esp-total', id: 'espTotal', textContent: r ? `${mb(total === 1 ? 0 : total)} guardados en este navegador (la próxima vez no se bajan)` : 'contando…' }),
      barra, lista, grande, topes,
      el('p', { className: 'esp-nota', textContent: 'Con tope, al terminar cada carrera se sueltan las pistas jugadas hace más tiempo hasta bajar del tope (nunca las ⭐ ni las de la sala). Lo borrado se vuelve a bajar si lo juegas.' }),
    ];
  }

  function pintarLista(vista) {
    const titulo = { pistas: 'Pistas', comun: 'Karts y sonidos comunes', basico: 'Básico del juego' }[vista];
    const volver = boton('← Volver', { id: 'espVolver' });
    volver.addEventListener('click', () => { estado.vista = 'resumen'; pintar(); });
    const sel = seleccion[vista];
    let filas = filasDe(vista);
    if (vista === 'pistas') filas = ordenar(filas, estado.orden, estado.inverso);
    const partes = [el('div', { className: 'esp-cab' }, volver, el('h4', { textContent: `${titulo} · ${mb(suma(vista))}` }))];
    if (vista === 'pistas') {
      partes.push(el('div', { className: 'esp-ordenes' }, el('span', { textContent: 'Ordenar:' }),
        ...ORDENES.map(([id, nombre]) => {
          const flecha = estado.orden === id ? (estado.inverso ? ' ↑' : ' ↓') : '';
          const b = boton(nombre + flecha, { className: 'boton chico' }); b.dataset.orden = id; b.setAttribute('aria-pressed', String(estado.orden === id));
          b.addEventListener('click', () => { if (estado.orden === id) estado.inverso = !estado.inverso; else { estado.orden = id; estado.inverso = false; } pintar(); });
          return b;
        }), el('span', { className: 'esp-gatillo', textContent: '🎮 LT / RT' })));
    }
    const todas = boton('Marcar todas', { className: 'boton chico', id: 'espTodas' });
    todas.addEventListener('click', () => { sel.todas(filas); pintar(); });
    const ninguna = boton('Ninguna', { className: 'boton chico', id: 'espNinguna' });
    ninguna.addEventListener('click', () => { sel.ninguna(); pintar(); });
    partes.push(el('div', { className: 'esp-marcar' }, todas, ninguna));
    const lista = el('div', { className: 'esp-lista', id: 'espLista', role: 'list' });
    if (!filas.length) lista.append(el('p', { className: 'esp-vacia', textContent: 'Nada guardado aquí.' }));
    for (const f of filas) {
      const marcada = sel.tiene(f) && !f.protegida;
      const casilla = el('input', { type: 'checkbox', checked: marcada, disabled: !!f.protegida, tabIndex: -1 });
      casilla.setAttribute('aria-label', f.nombre);
      const sub = vista === 'pistas' ? `${f.copa} · ${f.protegida ? '🏁 en uso ahora' : haceCuanto(f.t, ahora())}` : (f.rutas?.length ? `${f.rutas.length} archivos` : '');
      const fila = el('div', { className: 'esp-fila' + (marcada ? ' marcada' : '') + (f.protegida ? ' protegida' : ''), role: 'listitem', tabIndex: 0 },
        casilla, el('span', { className: 'esp-nombre' }, el('span', { textContent: f.nombre }), el('small', { textContent: sub })),
        el('span', { className: 'esp-mb', textContent: mb(f.bytes) }));
      fila.dataset.clave = f.clave;
      if (vista === 'pistas' && f.pista >= 0) {
        const est = el('button', { type: 'button', className: 'esp-estrella', textContent: f.estrella ? '★' : '☆', title: f.estrella ? 'Protegida: «Marcar todas» y el tope no la tocan' : 'Proteger esta pista' });
        est.setAttribute('aria-pressed', String(!!f.estrella)); est.setAttribute('aria-label', 'Proteger ' + f.nombre); est.dataset.estrella = f.pista;
        est.addEventListener('click', ev => { ev.stopPropagation(); uso?.estrella(f.pista, !f.estrella); pintar(); });
        fila.append(est);
      } else fila.append(el('span'));
      const alternar = () => { if (sel.alternar(f)) {} pintar(); };
      fila.addEventListener('click', ev => { if (ev.target.closest('.esp-estrella')) return; alternar(); });
      fila.addEventListener('keydown', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); alternar(); } });
      lista.append(fila);
    }
    partes.push(lista);
    const { n, bytes } = sel.cuenta(filas);
    const nombreN = vista === 'pistas' ? (n === 1 ? 'pista' : 'pistas') : (n === 1 ? 'parte' : 'partes');
    const accion = boton(n ? `🗑 Borrar ${n} ${nombreN} (${mb(bytes)})` : 'Marca lo que quieras borrar', { className: 'boton peligro esp-accion', id: 'espBorrar', disabled: !n });
    accion.addEventListener('click', () => pedirBorrar(sel.de(filas), vista));
    partes.push(accion);
    return partes;
  }

  function pintarToast() {
    if (!toast) return null;
    const p = pendiente.actual;
    if (!p) return null;
    const des = boton('Deshacer', { className: 'boton principal', id: 'espDeshacer' });
    des.addEventListener('click', deshacer);
    const txt = el('span', { id: 'espCuenta' });
    toast.texto = txt;
    contarToast();
    return el('div', { className: 'esp-deshacer', role: 'status' }, txt, des);
  }
  function contarToast() {
    if (!toast?.texto) return;
    const r = pendiente.restan();             // (vencido con la carrera andando: espera a que termine, §176)
    toast.texto.textContent = r > 0 ? `🗑 ${toast.cuantas} (${mb(toast.bytes)}) se borran en ${r} s` : `🗑 ${toast.cuantas} (${mb(toast.bytes)}) se borran al terminar la carrera`;
  }

  function pintar() {
    const partes = estado.vista === 'resumen' ? pintarResumen() : pintarLista(estado.vista);
    const t = pintarToast();
    const caja = el('div', { className: 'esp' }, ...(t ? [t] : []), ...partes);
    if (estado.ultimo && !pendiente.actual) caja.prepend(el('p', { className: 'esp-nota', id: 'espListo', textContent: estado.ultimo }));
    nodo.replaceChildren(caja);
  }

  function abrir(vista) { estado.vista = vista; pintar(); }

  async function pedirBorrar(filas, vista) {
    if (!filas.length) return false;
    const bytes = filas.reduce((s, f) => s + f.bytes, 0);
    const cuantas = vista === 'pistas' ? `${filas.length} ${filas.length === 1 ? 'pista' : 'pistas'}` : `${filas.length} ${filas.length === 1 ? 'parte' : 'partes'}`;
    const si = await preguntar({ titulo: 'Borrar del navegador', si: 'Borrar', peligro: true,
      texto: `Se borran ${cuantas} (${mb(bytes)}) guardadas en este navegador. Las partidas y los fantasmas no se tocan; lo borrado se vuelve a bajar si lo juegas. Tienes 8 segundos para deshacerlo.` });
    if (!si) return false;
    for (const f of filas) { estado.pendientes.add(f.clave); seleccion[vista].marcadas.delete(f.clave); }
    estado.ultimo = null;
    toast = { cuantas, bytes, claves: filas.map(f => f.clave) };
    const p = pendiente.pedir(filas, terminado);
    p.claves = toast.claves;
    clearInterval(relojToast);
    relojToast = setInterval(() => { if (pendiente.actual === p) contarToast(); else clearInterval(relojToast); }, 250);
    pintar();
    return true;
  }
  async function terminado(p) {
    for (const k of p.claves || []) estado.pendientes.delete(k);
    if (pendiente.actual == null) { toast = null; clearInterval(relojToast); }
    const r = p.resultado || {};
    estado.hecho = (estado.hecho || 0) + 1;
    estado.ultimo = p.estado === 'hecho' ? `✓ Listo: se liberó ${mb(p.items.reduce((s, f) => s + f.bytes, 0))}${r.saltados?.length ? ` (${r.saltados.length} archivos en uso quedaron)` : ''}.` : '✗ No se pudo borrar.';
    await refrescar();
  }
  function deshacer() {
    const p = pendiente.actual;
    if (!p) return false;
    pendiente.deshacer();
    for (const k of p.claves || []) estado.pendientes.delete(k);
    toast = null; clearInterval(relojToast);
    estado.ultimo = '↩ Deshecho: no se borró nada.';
    pintar();
    return true;
  }

  // El mando: los gatillos cambian el orden de la lista de pistas (LT = el anterior, RT = el siguiente). El cursor del
  // sitio hace el resto (A = clic). Solo mientras la lista se ve
  let antes = [false, false];
  const vigia = setInterval(() => {
    if (!nodo.isConnected || estado.vista !== 'pistas' || !nodo.offsetParent) { antes = [false, false]; return; }
    let lt = false, rt = false;
    try { for (const m of mandos() || []) if (m) { lt ||= !!m.buttons?.[6]?.pressed; rt ||= !!m.buttons?.[7]?.pressed; } } catch {}
    const i = ORDENES.findIndex(([id]) => id === estado.orden);
    if (lt && !antes[0]) { estado.orden = ORDENES[(i + ORDENES.length - 1) % ORDENES.length][0]; estado.inverso = false; pintar(); }
    if (rt && !antes[1]) { estado.orden = ORDENES[(i + 1) % ORDENES.length][0]; estado.inverso = false; pintar(); }
    antes = [lt, rt];
  }, 100);

  // El tope (opcional): mkw.mjs lo llama al terminar cada carrera, fuera de ella. Devuelve las pistas soltadas
  async function aplicarTope() {
    const g = uso?.tope() || 0;
    if (!g) return [];
    const r = await leer();
    const filas = r.pistas.lista.map(f => ({ ...f, estrella: uso.estrellas().has(f.pista) }));
    const soltar = elegirPorTope({ ...r, pistas: { ...r.pistas, lista: filas } }, g * 1073741824);
    if (!soltar.length) return [];
    const res = await borrar(soltar.flatMap(f => f.rutas));
    alBorrar({ items: soltar, resultado: res, pistas: soltar.map(f => f.pista), porTope: true });
    estado.resumen = await leer(); pintar();
    return soltar;
  }

  pintar();
  return { refrescar, abrir, pintar, deshacer, aplicarTope, pedirBorrar, estado, seleccion, pendiente,
           filas: filasDe, cerrar: () => clearInterval(vigia) };
}
