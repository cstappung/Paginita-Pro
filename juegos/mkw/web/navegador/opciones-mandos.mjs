// La hoja «Controles» del cajón: el mando y el teclado de cada jugador, en una sola lista — bitácora §57, §106, §111 y
// §112 (el rediseño que pidió el dueño: «el botón de reasignar no funciona; quiero un rework de toda esta página»; la
// propuesta C del crítico externo, con el asistente «paso a paso» de su propuesta B adentro).
//
// Resumen: arriba, una pestaña por JUGADOR (1 a 4: así piensa el juego). Debajo, el mando de ese jugador (qué es, qué
// jugador es —cuatro botones grandes—, un probador con los sticks y los gatillos) y una LISTA DE ACCIONES con nombre de
// acción primero («Acelerar», «Derrapar y saltar»…) y dos columnas: lo que la maneja en el MANDO y en el TECLADO (el
// teclado solo en el jugador 1). Cada fila tiene una luz que se prende al apretar: la lista es también el probador.
//   · Clic (o A con el cursor del mando) en un recuadro = «Cambiar»: la fila espera la próxima entrada y la pone ahí.
//     Debajo de la fila se abre una tira con lo demás: «＋ Sumar otro», «Dejar sin nada», «↺ Como siempre»,
//     «Deshacer» y «Listo», y el mensaje de lo que pasó («✓ Derrapar: LB · se quitó de Usar objeto»).
//   · Las acciones principales (Manejar y Acciones) se ven siempre; las otras 11 (Y, Z, la cruz, el stick ↑↓ y el
//     stick C) en «Más controles».
//   · «Asignar paso a paso»: una tarjeta grande por acción («Paso 3 de 9 · DERRAPAR · aprieta…»); si no se toca nada
//     en 6 s queda igual y sigue (así un mando solo, sin cursor, lo recorre entero).
//   · «Probar el mando 10 s»: los botones solo encienden las luces (no hacen clic ni manejan el juego).
//   · Abajo, los ajustes de todos los mandos: estilo de botones, zona muerta (− y +) y vibración (probarla en ESE mando).
//
// Reglas que lo hacen funcionar con el cursor del mando (mando.js del sitio) y con el ratón (el crítico):
//   1. Todo se arma UNA vez; el bucle de 100 ms solo cambia textos, clases y atributos. (La falla del «Reasignar» que
//      no abría: el panel volvía a meter cada tarjeta en la página cada 100 ms y Chrome pierde el clic si el elemento
//      sale y vuelve entre apretar y soltar.)
//   2. Una sola espera a la vez en toda la página (mando o teclado); Esc, cerrar el cajón, «Cancelar» o 8 s la cancelan.
//   3. Mientras se captura o se prueba, el cursor del sitio se aparta y los mandos no manejan el juego
//      (controles.ocupado()); vuelve 250 ms después de soltar lo capturado.
//   4. Botones de 38 px o más, con texto (el cursor del mando no muestra los «title»), y sin barras deslizantes (un clic
//      simulado no las mueve): la zona muerta va con − y +.
// Como un tablero eléctrico con un diagrama al lado: cada fila es un circuito con su piloto (la luz) y su interruptor.
//
// Uso:  montarControles(document.getElementById('panelControles'), controles)  →  { refrescar, pintar, … }

import { NOMBRE_TIPO, nombreTecla, MAX_TECLAS, ACCIONES } from './controles.mjs';
import { BITS as BOTON, nombreFuente, MAX_FUENTES } from './asignacion-mando.mjs';

export const ESPERA_CAPTURA_MS = 8000;           // cuánto espera «Cambiar» una entrada antes de rendirse
export const ESPERA_PASO_MS = 6000;              // cuánto espera cada paso del asistente («si no tocas nada, queda igual»)
export const PRUEBA_MS = 10000;                  // «Probar el mando»

const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };
const ICONO = { nintendo: '🔴', playstation: '🔵', xbox: '🟢', gamecube: '🟣', generico: '🎮' };

// Cada control de GameCube: [nombre de la acción, el botón de GameCube] (la acción primero: es lo que busca la persona)
export const ACCION = {
  A: ['Acelerar', 'A'], B: ['Frenar y marcha atrás', 'B'], 'stick.izq': ['Girar a la izquierda', 'stick ←'],
  'stick.der': ['Girar a la derecha', 'stick →'], R: ['Derrapar y saltar', 'R'],
  L: ['Usar objeto', 'L'], arriba: ['Truco', 'cruz ↑'], X: ['Mirar atrás', 'X'], START: ['Pausa', 'Start'],
  'stick.arr': ['Stick arriba (lanzar adelante)', 'stick ↑'], 'stick.aba': ['Stick abajo (lanzar atrás)', 'stick ↓'],
  Y: ['Y (en los menús)', 'Y'], Z: ['Z', 'Z'], abajo: ['Cruz abajo', 'cruz ↓'], izquierda: ['Cruz izquierda', 'cruz ←'],
  derecha: ['Cruz derecha', 'cruz →'], 'c.arr': ['Stick C arriba', 'C ↑'], 'c.aba': ['Stick C abajo', 'C ↓'],
  'c.izq': ['Stick C izquierda', 'C ←'], 'c.der': ['Stick C derecha', 'C →'],
};
// Los grupos de la lista (los dos primeros a la vista; el tercero en «Más controles»)
export const GRUPOS = [
  ['Manejar', ['A', 'B', 'stick.izq', 'stick.der', 'R']],
  ['Acciones', ['L', 'arriba', 'X', 'START']],
  ['Más controles', ['stick.arr', 'stick.aba', 'Y', 'Z', 'abajo', 'izquierda', 'derecha', 'c.arr', 'c.aba', 'c.izq', 'c.der']],
];
export const PRINCIPALES = [...GRUPOS[0][1], ...GRUPOS[1][1]];   // lo que recorre primero el asistente (9)
export const OTROS = GRUPOS[2][1];
// El mismo control en la lista del teclado (controles.mjs ACCIONES usa otros nombres para el stick y el stick C)
export const TECLA = { 'stick.izq': 'stickIzquierda', 'stick.der': 'stickDerecha', 'stick.arr': 'stickArriba', 'stick.aba': 'stickAbajo',
  'c.arr': 'cArriba', 'c.aba': 'cAbajo', 'c.izq': 'cIzquierda', 'c.der': 'cDerecha' };
const teclaDe = obj => TECLA[obj] || obj;
const nombreDe = obj => ACCION[obj]?.[0] || obj;

// ¿ese control está encendido ahora en lo que manda este mando (o el teclado)? (la luz de su fila)
export function encendido(m, id) {
  if (!m) return false;
  if (id === 'L') return (m.gl || 0) > 20 || !!(m.botones & BOTON.L);
  if (id === 'R') return (m.gr || 0) > 20 || !!(m.botones & BOTON.R);
  if (BOTON[id]) return !!(m.botones & BOTON[id]);
  const [st, d] = id.split('.'), x = st === 'stick' ? m.sx : m.cx, y = st === 'stick' ? m.sy : m.cy;
  return d === 'der' ? x > 40 : d === 'izq' ? x < -40 : d === 'arr' ? y > 40 : y < -40;
}

// cambiar un texto / atributo / clase solo si cambió (el bucle corre cada 100 ms: nada de tocar el DOM por tocarlo)
const texto = (n, t) => { if (n.textContent !== t) n.textContent = t; };
const oculto = (n, si) => { if (n.hidden !== !!si) n.hidden = !!si; };
const apagado = (n, si) => { if (n.disabled !== !!si) n.disabled = !!si; };
const marcado = (n, si) => { const v = String(!!si); if (n.getAttribute('aria-pressed') !== v) n.setAttribute('aria-pressed', v); };

// celular (§113): { visible, ponerTactil(si), alEditar() } — la sección «Celular» (el mando en pantalla, su tamaño, su
// transparencia, editarlo y dirigir inclinando); visible solo en una pantalla táctil sin ratón (o con ?tactil=1)
export function montarControles(caja, controles, { ahora = () => performance.now(), celular = null } = {}) {
  if (!caja) return null;
  const boton = (t, clase = '') => el('button', { type: 'button', className: 'boton ' + clase, textContent: t });

  // ---------------- arriba: las pestañas de los jugadores ----------------
  const pestanas = [0, 1, 2, 3].map(p => {
    const sub = el('small', { textContent: '' });
    const b = el('button', { type: 'button', className: 'ctl-pestana', role: 'tab' }, el('b', { textContent: `Jugador ${p + 1}` }), sub);
    b.dataset.jugador = String(p);
    b.onclick = () => elegirPestana(p);
    return { b, sub };
  });
  const barraPestanas = el('div', { className: 'ctl-pestanas', role: 'tablist' }, ...pestanas.map(x => x.b));

  // ---------------- el mando de ese jugador ----------------
  const titulo = el('b', { className: 'ctl-titulo' }), sub = el('small', { className: 'ctl-sub' });
  const numeros = [0, 1, 2, 3].map(p => { const b = boton(String(p + 1), 'ctl-num'); b.dataset.puerto = String(p); b.onclick = () => cambiarJugador(p); return b; });
  const filaJugador = el('div', { className: 'ctl-fila-jugador' }, el('span', { textContent: 'Este mando es el jugador' }), ...numeros);
  const traer = el('div', { className: 'ctl-traer' });          // (sin mando en esta pestaña: «que sea el jugador N»)
  const punto = el('i', { className: 'stick-punto' }), puntoC = el('i', { className: 'stick-punto c' });
  const barraL = el('i'), barraR = el('i');
  const probar = boton('Probar el mando 10 s', 'ctl-probar');
  probar.onclick = () => (controles.probando() ? terminarPrueba() : empezarPrueba());
  const estadoPrueba = el('p', { className: 'ctl-nota', role: 'status', hidden: true });
  const probador = el('div', { className: 'probador' },
    el('div', { className: 'stick-aro', title: 'Stick' }, punto), el('div', { className: 'stick-aro c', title: 'Stick C' }, puntoC),
    el('div', { className: 'gatillos' }, el('span', {}, 'L', el('b', { className: 'barra-gatillo' }, barraL)), el('span', {}, 'R', el('b', { className: 'barra-gatillo' }, barraR))),
    probar);
  const avisoSinMapa = el('div', { className: 'aviso ctl-sinmapa', hidden: true },
    el('span', { textContent: 'Este mando no tiene mapeo estándar: el navegador no sabe qué botón es cuál. Asígnalos una vez y quedan guardados.' }));
  const asistirAviso = boton('▶ Asignar paso a paso', 'principal');
  asistirAviso.onclick = () => asistir(PRINCIPALES);
  avisoSinMapa.append(asistirAviso);
  const cabeza = el('div', { className: 'ctl-cabeza' }, el('div', { className: 'ctl-nombre' }, titulo, sub), filaJugador, traer, probador, estadoPrueba);

  // ---------------- la lista de acciones ----------------
  const lista = el('div', { className: 'ctl-lista' },
    el('div', { className: 'ctl-encab' }, el('span', { textContent: 'Acción' }), el('span', { className: 'ctl-col-mando', textContent: 'Mando' }),
      el('span', { className: 'ctl-col-teclado', textContent: 'Teclado' }), el('span', { className: 'ctl-col-pantalla', textContent: 'En pantalla' })));
  const filas = new Map();                      // objetivo → { fila, luz, mando, teclado }
  const verMas = boton('▸ Más controles (Y, Z, la cruz, el stick ↑↓ y el stick C)', 'ctl-mas');
  verMas.onclick = () => { raiz.classList.toggle('ver-mas'); texto(verMas, (raiz.classList.contains('ver-mas') ? '▾ Menos controles' : '▸ Más controles (Y, Z, la cruz, el stick ↑↓ y el stick C)')); };
  GRUPOS.forEach(([nombreGrupo, objetivos], g) => {
    lista.append(g === 2 ? el('div', { className: 'ctl-grupo' }, verMas) : el('div', { className: 'ctl-grupo', textContent: nombreGrupo }));
    for (const obj of objetivos) {
      const luz = el('i', { className: 'luz' });
      const mando = el('button', { type: 'button', className: 'ctl-chip ctl-col-mando' }), teclado = el('button', { type: 'button', className: 'ctl-chip ctl-col-teclado' });
      // §113b: en el celular, qué botón en pantalla hace esto; tocarlo abre el editor con ese botón elegido (o agrega uno)
      const pantalla = el('button', { type: 'button', className: 'ctl-chip ctl-col-pantalla' });
      mando.dataset.col = 'mando'; teclado.dataset.col = 'teclado'; pantalla.dataset.col = 'pantalla';
      mando.onclick = () => tocarRecuadro(obj, 'mando'); teclado.onclick = () => tocarRecuadro(obj, 'teclado');
      pantalla.onclick = () => { cancelarTodo(); celular?.alEditar({ objetivo: obj }); };
      const fila = el('div', { className: 'ctl-fila' + (g === 2 ? ' ctl-otro' : '') },
        el('span', { className: 'ctl-accion' }, luz, el('span', { textContent: nombreDe(obj) }), el('small', { textContent: ACCION[obj][1] })), mando, teclado, pantalla);
      fila.dataset.objetivo = obj;
      filas.set(obj, { fila, luz, mando, teclado, pantalla });
      lista.append(fila);
    }
  });

  // ---------------- la tira de la fila elegida (una sola: se mueve debajo de la fila que se tocó) ----------------
  const mensaje = el('p', { className: 'ctl-mensaje', role: 'status', 'aria-live': 'polite' });
  const bCambiar = boton('Cambiar'), bSumar = boton('＋ Sumar otro'), bVaciar = boton('Dejar sin nada'),
        bComoSiempre = boton('↺ Como siempre'), bDeshacer = boton('Deshacer'), bListo = boton('Listo');
  const tira = el('div', { className: 'ctl-tira' }, mensaje, el('div', { className: 'fila-botones' }, bCambiar, bSumar, bVaciar, bComoSiempre, bDeshacer, bListo));
  bCambiar.onclick = () => (espera ? cancelarTodo('No se cambió nada.') : sel && esperar(sel.obj, sel.col, false));
  bSumar.onclick = () => sel && esperar(sel.obj, sel.col, true);
  bVaciar.onclick = () => sel && vaciar(sel.obj, sel.col);
  bComoSiempre.onclick = () => sel && comoSiempre(sel.obj, sel.col);
  bDeshacer.onclick = () => deshacerUltimo();
  bListo.onclick = () => { cancelarTodo(); elegir(null); };

  // ---------------- abajo: el asistente, restaurar y los ajustes de todos ----------------
  const bAsistir = boton('▶ Asignar paso a paso', 'principal'), bRestaurarMando = boton('↺ Mando como siempre'), bRestaurarTeclado = boton('↺ Teclado como siempre', 'ctl-col-teclado');
  bAsistir.onclick = () => asistir(PRINCIPALES);
  bRestaurarMando.onclick = () => { const m = mandoDeAhora(); if (!m) return; cancelarTodo(); deshacer = { tipo: 'mando', clave: m.clave, mapa: controles.mapaDe(m.clave) }; controles.borrarAsignacion(m.clave); avisarAbajo('El mando quedó como siempre.'); };
  bRestaurarTeclado.onclick = () => { cancelarTodo(); deshacer = { tipo: 'tecla', teclas: controles.copiaTeclas() }; controles.restaurarTeclas(); avisarAbajo('El teclado quedó como siempre.'); };
  const mensajeAbajo = el('p', { className: 'ctl-mensaje', role: 'status' });
  const bDeshacerAbajo = boton('Deshacer'); bDeshacerAbajo.onclick = () => deshacerUltimo();
  const pie = el('div', { className: 'fila-botones ctl-pie' }, bAsistir, bRestaurarMando, bRestaurarTeclado);
  const asistente = el('div', { className: 'ctl-asistente', hidden: true, role: 'dialog', 'aria-live': 'polite' });

  const estilos = [['auto', 'Automático'], ['posicion', 'Por posición (Xbox: A abajo)'], ['letra', 'Por letra (Nintendo: A a la derecha)']]
    .map(([v, t]) => { const b = boton(t, 'ctl-opcion'); b.dataset.valor = v; b.onclick = () => { controles.ajustarMandos({ disposicion: v }); pintar(); }; return b; });
  const zonaDato = el('span', { className: 'dato ctl-zona' }), zonaMenos = boton('−', 'ctl-paso'), zonaMas = boton('+', 'ctl-paso');
  const zona = d => { controles.ajustarMandos({ zona: controles.prefsMandos().zona + d }); pintar(); };
  zonaMenos.onclick = () => zona(-2); zonaMas.onclick = () => zona(2);
  zonaMenos.setAttribute('aria-label', 'Menos zona muerta'); zonaMas.setAttribute('aria-label', 'Más zona muerta');
  const vibSi = boton('Sí', 'ctl-opcion'), vibNo = boton('No', 'ctl-opcion'), vibProbar = boton('Probar en este mando');
  vibSi.onclick = () => { controles.ajustarMandos({ vibrar: true }); pintar(); }; vibNo.onclick = () => { controles.ajustarMandos({ vibrar: false }); pintar(); };
  const vibNota = el('p', { className: 'ctl-nota', role: 'status' });
  vibProbar.onclick = () => {
    const m = mandoDeAhora();
    if (!m) return texto(vibNota, 'No hay un mando en este jugador.');
    if (!controles.prefsMandos().vibrar) return texto(vibNota, 'La vibración está apagada (elige «Sí»).');
    if (!m.vibra) return texto(vibNota, 'Este mando no vibra en este navegador.');
    controles.vibrar(m.puerto, 1); setTimeout(() => controles.vibrar(m.puerto, 0), 400);
    texto(vibNota, 'Debería vibrar medio segundo.');
  };
  const ajustes = el('div', { className: 'ctl-ajustes' },
    el('h3', { textContent: 'Ajustes de los mandos' }),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Estilo de botones' }), ...estilos),
    el('p', { className: 'ctl-nota', textContent: '(Vale para los mandos que no reasignaste a mano.)' }),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Zona muerta del stick' }), zonaMenos, zonaDato, zonaMas),
    el('p', { className: 'ctl-nota', textContent: 'Cuánto hay que mover el stick para que cuente. Súbela si el kart gira solo.' }),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Vibración' }), vibSi, vibNo, vibProbar), vibNota);

  // ---------------- §113: el celular (el mando en pantalla) ----------------
  const tactilSi = boton('Sí', 'ctl-opcion'), tactilNo = boton('No', 'ctl-opcion');
  tactilSi.onclick = () => { celular?.ponerTactil(true); pintar(); }; tactilNo.onclick = () => { celular?.ponerTactil(false); pintar(); };
  const tamDato = el('span', { className: 'dato ctl-zona' }), tamMenos = boton('−', 'ctl-paso'), tamMas = boton('+', 'ctl-paso');
  const opaDato = el('span', { className: 'dato ctl-zona' }), opaMenos = boton('−', 'ctl-paso'), opaMas = boton('+', 'ctl-paso');
  tamMenos.setAttribute('aria-label', 'Mando en pantalla más chico'); tamMas.setAttribute('aria-label', 'Mando en pantalla más grande');
  opaMenos.setAttribute('aria-label', 'Más transparente'); opaMas.setAttribute('aria-label', 'Menos transparente');
  const tactil = (k, d, min, max) => { const a = controles.ajustesTactil(); controles.ajustarTactil({ [k]: Math.round(Math.min(max, Math.max(min, a[k] + d)) * 100) / 100 }); pintar(); };
  tamMenos.onclick = () => tactil('esc', -0.05, 0.8, 1.3); tamMas.onclick = () => tactil('esc', 0.05, 0.8, 1.3);
  opaMenos.onclick = () => tactil('opa', -0.1, 0.3, 1); opaMas.onclick = () => tactil('opa', 0.1, 0.3, 1);
  const editarTactil = boton('✏️ Mover, agrandar, agregar u ocultar botones', 'principal');
  editarTactil.onclick = () => celular?.alEditar();
  const incSi = boton('Sí', 'ctl-opcion'), incNo = boton('No', 'ctl-opcion');
  incSi.onclick = () => { controles.inclinar(true); controles.ajustarTactil({ inclinar: true }); pintar(); };
  incNo.onclick = () => { controles.inclinar(false); controles.ajustarTactil({ inclinar: false }); pintar(); };
  const tactilComoVenia = boton('↺ Como venía');
  tactilComoVenia.onclick = () => { controles.ajustarTactil({ esc: 1, opa: 1 }); controles.borrarPiezasTactil(); pintar(); };
  const seccionCelular = el('div', { className: 'ctl-celular', hidden: !celular?.visible },
    el('h3', { textContent: '📱 Celular' }),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Mando en pantalla' }), tactilSi, tactilNo),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Tamaño de todos' }), tamMenos, tamDato, tamMas),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Opacidad' }), opaMenos, opaDato, opaMas),
    el('div', { className: 'fila' }, editarTactil),
    el('p', { className: 'ctl-nota', textContent: 'Arrastra cada botón (o el stick) a donde te acomode, agranda o achica uno solo, agrega «Mirar atrás», Z o la cruz, u oculta los que no uses. Se guarda aparte con el teléfono acostado y parado.' }),
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: 'Dirigir inclinando el teléfono' }), incSi, incNo),
    el('p', { className: 'ctl-nota', textContent: 'Como un volante: se centra en la posición del teléfono al prenderlo (para centrarlo de nuevo, «No» y «Sí»).' }),
    el('div', { className: 'fila' }, tactilComoVenia));

  // ---------------- §113c: «Acelerar solo» ----------------
  const aceSi = boton('Sí', 'ctl-opcion'), aceNo = boton('No', 'ctl-opcion');
  aceSi.onclick = () => { controles.ajustarAyudas({ acelerar: true }); pintar(); };
  aceNo.onclick = () => { controles.ajustarAyudas({ acelerar: false }); pintar(); };
  const seccionAyudas = el('div', { className: 'ctl-ayudas' },
    el('div', { className: 'fila' }, el('span', { className: 'ctl-etq', textContent: '🚗 Acelerar solo' }), aceSi, aceNo),
    el('p', { className: 'ctl-nota', textContent: 'Con la carrera andando, el kart acelera sin apretar nada; frenar le gana (para ir marcha atrás). ' +
      'La salida rápida la haces tú: en la cuenta 3-2-1, aprieta tu botón de acelerar justo cuando sale el «2» y mantenlo.' }));

  const raiz = el('div', { className: 'ctl' }, seccionCelular, seccionAyudas, barraPestanas, cabeza, avisoSinMapa, asistente, lista, pie,
    el('div', { className: 'fila-botones' }, mensajeAbajo, bDeshacerAbajo), ajustes);
  caja.replaceChildren(raiz);

  // ---------------- el estado del panel ----------------
  let pestana = 0;                 // el jugador que se ve
  let sel = null;                  // { obj, col } la fila (y columna) elegida: ahí está la tira
  let espera = null;               // la espera en curso: { tipo: 'mando'|'tecla', obj, col, clave?, id?, antes?, hasta, reloj }
  let deshacer = null;             // lo de antes del último cambio: { tipo: 'mando', clave, mapa } | { tipo: 'tecla', teclas }
  let ayudante = null;             // el asistente en curso: { cancelado, … }
  let quietoHasta = 0;             // hasta cuándo se esconden los avisos de mando.js (cada captura le cambia el modo)
  const mandoDeAhora = () => (controles.estado.mandos || []).find(m => m.puerto === pestana) || null;
  const mandoPorClave = k => (controles.estado.mandos || []).find(m => m.clave === k) || null;

  function elegirPestana(p) {
    if (p === pestana) return;
    cancelarTodo(); elegir(null);
    pestana = p;
    pintar();
  }
  function cambiarJugador(p) {
    const m = mandoDeAhora();
    if (!m || m.puerto === p) return;
    cancelarTodo(); elegir(null);
    controles.elegirPuerto(m.clave, p);
    pestana = p;                                  // (la pestaña sigue al mando)
    pintar();
  }
  // elegir una fila (la tira se mueve debajo de ella) o ninguna (la tira se va)
  function elegir(nuevo) {
    if (sel && nuevo && sel.obj === nuevo.obj && sel.col === nuevo.col) return;
    sel = nuevo;
    for (const [obj, f] of filas) { f.mando.classList.toggle('elegido', !!sel && sel.obj === obj && sel.col === 'mando'); f.teclado.classList.toggle('elegido', !!sel && sel.obj === obj && sel.col === 'teclado'); }
    if (!sel) { tira.remove(); return; }
    const f = filas.get(sel.obj);
    if (f.fila.classList.contains('ctl-otro')) { raiz.classList.add('ver-mas'); texto(verMas, '▾ Menos controles'); }
    if (f.fila.nextSibling !== tira) f.fila.after(tira);
    texto(mensaje, '');
  }
  // tocar el recuadro de una fila: elegirla y esperar la entrada nueva ahí (tocarlo mientras espera = cancelar)
  function tocarRecuadro(obj, col) {
    if (espera && espera.obj === obj && espera.col === col) return cancelarTodo('No se cambió nada.');
    elegir({ obj, col });
    esperar(obj, col, false);
  }

  // ---------------- esperar una entrada (una a la vez en toda la página) ----------------
  function esperar(obj, col, sumar, ms = ESPERA_CAPTURA_MS) {
    cancelarTodo();
    if (col === 'teclado') return esperarTecla(obj, sumar, ms);
    const m = mandoDeAhora();
    if (!m) { texto(mensaje, 'No hay un mando en este jugador: conecta uno y aprieta un botón.'); return Promise.resolve(null); }
    const antes = controles.mapaDe(m.clave);
    const p = controles.capturar(m.clave, obj, { sumar });
    // (la espera es ESTA: la respuesta de una cancelada —otra espera antes de tocar nada— no puede borrar la de ahora)
    const mia = espera = { tipo: 'mando', obj, col, clave: m.clave, hasta: ahora() + ms, reloj: setTimeout(() => controles.cancelarCaptura(), ms) };
    pintar();
    return p.then(r => {
      if (espera !== mia) return r;
      clearTimeout(mia.reloj); espera = null;
      if (r) {
        deshacer = { tipo: 'mando', clave: mia.clave, mapa: antes };
        const t = mandoPorClave(mia.clave) || m;
        texto(mensaje, `✓ ${nombreDe(obj)}: ${nombreFuente(r.fuente, t.tipo, t.estandar)}` +
          (r.quitadoDe.length ? ` · se quitó de ${r.quitadoDe.map(nombreDe).join(', ')}` : ''));
      } else if (!ayudante) texto(mensaje, 'No se cambió nada.');
      pintar();
      return r;
    });
  }
  function esperarTecla(obj, sumar, ms) {
    const id = teclaDe(obj);
    const mia = espera = { tipo: 'tecla', obj, col: 'teclado', id, antes: controles.copiaTeclas(), hasta: ahora() + ms,
      reloj: setTimeout(() => { if (espera === mia) { controles.cancelarTecla(); terminarTecla(mia); } }, ms) };
    controles.reasignar(id, { sumar });
    texto(mensaje, '');
    pintar();
    return Promise.resolve(null);
  }
  // terminó la espera de una tecla (controles.mjs avisa con alCambiar → refrescar): qué cambió y de dónde se quitó
  function terminarTecla(e) {
    clearTimeout(e.reloj); if (espera === e) espera = null;
    const ahoraT = controles.copiaTeclas();
    const nuevas = (ahoraT[e.id] || []).filter(c => !(e.antes[e.id] || []).includes(c));
    if (!nuevas.length) { texto(mensaje, 'No se cambió nada.'); pintar(); return; }
    deshacer = { tipo: 'tecla', teclas: e.antes };
    const quitadas = [];
    for (const [id] of ACCIONES) if (id !== e.id && (e.antes[id] || []).some(c => nuevas.includes(c))) quitadas.push(nombreDe(Object.keys(TECLA).find(k => TECLA[k] === id) || id));
    texto(mensaje, `✓ ${nombreDe(e.obj)}: ${nuevas.map(nombreTecla).join(' · ')}` + (quitadas.length ? ` · se quitó de ${quitadas.join(', ')}` : ''));
    pintar();
  }
  // cancelar lo que esté esperando (mando o tecla), la prueba y el asistente
  function cancelarTodo(motivo) {
    if (espera) {
      const e = espera; espera = null; clearTimeout(e.reloj);
      if (e.tipo === 'mando') controles.cancelarCaptura(); else controles.cancelarTecla();
      if (motivo) texto(mensaje, motivo);
    }
    if (controles.esperando()) controles.cancelarTecla();
    if (controles.probando()) terminarPrueba();
    if (ayudante) { ayudante.cancelado = true; controles.cancelarCaptura(); }
    pintar();
  }

  // ---------------- lo demás de la tira ----------------
  function vaciar(obj, col) {
    cancelarTodo();
    if (col === 'teclado') { deshacer = { tipo: 'tecla', teclas: controles.copiaTeclas() }; controles.ponerTeclas({ [teclaDe(obj)]: [] }); }
    else {
      const m = mandoDeAhora(); if (!m) return;
      const mapa = controles.mapaDe(m.clave); deshacer = { tipo: 'mando', clave: m.clave, mapa: JSON.parse(JSON.stringify(mapa)) };
      mapa[obj] = []; controles.ponerMapa(m.clave, mapa);
    }
    texto(mensaje, `${nombreDe(obj)}: sin nada (no se usa).`);
    pintar();
  }
  function comoSiempre(obj, col) {
    cancelarTodo();
    if (col === 'teclado') { deshacer = { tipo: 'tecla', teclas: controles.copiaTeclas() }; controles.restaurarTecla(teclaDe(obj)); }
    else { const m = mandoDeAhora(); if (!m) return; deshacer = { tipo: 'mando', clave: m.clave, mapa: controles.mapaDe(m.clave) }; controles.restaurarObjetivo(m.clave, obj); }
    texto(mensaje, `${nombreDe(obj)}: como siempre.`);
    pintar();
  }
  function deshacerUltimo() {
    if (!deshacer) return;
    cancelarTodo();
    const d = deshacer; deshacer = null;
    if (d.tipo === 'tecla') controles.ponerTeclas(d.teclas); else controles.ponerMapa(d.clave, d.mapa);
    texto(mensaje, 'Deshecho.'); avisarAbajo('Deshecho.');
    pintar();
  }
  function avisarAbajo(t) { texto(mensajeAbajo, t); pintar(); }

  // ---------------- probar el mando ----------------
  function empezarPrueba() { cancelarTodo(); controles.probar(PRUEBA_MS); pintar(); }
  function terminarPrueba() { controles.probar(0); pintar(); }

  // ---------------- el asistente «paso a paso» ----------------
  async function asistir(objetivos) {
    const m = mandoDeAhora();
    if (!m) return;
    cancelarTodo(); elegir(null);
    const clave = m.clave, antes = controles.mapaDe(clave);
    const yo = ayudante = { cancelado: false };
    controles.reservar(true);                       // (los mandos son del panel de punta a punta)
    document.body.classList.add('asistiendo-mando');
    const paso = el('small'), grande = el('div', { className: 'ctl-paso-nombre' }), ahoraTiene = el('p'), cuenta = el('p', { className: 'ctl-nota' });
    const saltar = boton('Saltar este'), terminar = boton('Terminar');
    saltar.onclick = () => controles.cancelarCaptura();
    terminar.onclick = () => { yo.cancelado = true; controles.cancelarCaptura(); };
    asistente.replaceChildren(paso, grande, ahoraTiene, cuenta, el('div', { className: 'fila-botones' }, saltar, terminar));
    oculto(asistente, false);
    let hechos = 0;
    try {
      for (let i = 0; i < objetivos.length && !yo.cancelado; i++) {
        const obj = objetivos[i];
        texto(paso, `Paso ${i + 1} de ${objetivos.length}`);
        texto(grande, nombreDe(obj).toUpperCase());
        const est = mandoPorClave(clave);
        const tiene = (controles.mapaDe(clave)?.[obj] || []).map(f => nombreFuente(f, est?.tipo, est?.estandar)).join(' · ') || 'nada';
        texto(ahoraTiene, `Aprieta en tu mando el botón (o mueve el stick) para ${nombreDe(obj).toLowerCase()}. Ahora: ${tiene}.`);
        yo.cuenta = cuenta;
        const r = await esperarPaso(clave, obj);
        if (r) hechos++;
        if (!yo.cancelado) await sueltoTodo();
      }
    } finally {
      if (ayudante === yo) ayudante = null;
      controles.reservar(false);
      document.body.classList.remove('asistiendo-mando');
    }
    if (hechos) deshacer = { tipo: 'mando', clave, mapa: antes };
    const fin = el('p', { textContent: yo.cancelado ? `Terminado (${hechos} cambiados; «Deshacer» los vuelve atrás).` : `¡Listo! ${hechos} cambiados. Prueba los botones: se enciende su fila.` });
    const cerrar = boton('Cerrar'); cerrar.onclick = () => oculto(asistente, true);
    const botones = [cerrar];
    if (!yo.cancelado && objetivos === PRINCIPALES) { const seguir = boton(`Seguir con los otros ${OTROS.length}`, 'principal'); seguir.onclick = () => asistir(OTROS); botones.unshift(seguir); }
    asistente.replaceChildren(fin, el('div', { className: 'fila-botones' }, ...botones));
    pintar();
  }
  // un paso: espera hasta ESPERA_PASO_MS (si no se toca nada, queda igual) con la cuenta a la vista
  function esperarPaso(clave, obj) {
    const p = controles.capturar(clave, obj, { sumar: false });
    const mia = espera = { tipo: 'mando', obj, col: 'mando', clave, hasta: ahora() + ESPERA_PASO_MS, reloj: setTimeout(() => controles.cancelarCaptura(), ESPERA_PASO_MS), paso: true };
    pintar();
    return p.then(r => { if (espera === mia) { clearTimeout(mia.reloj); espera = null; } pintar(); return r; });
  }
  // espera (hasta 3 s) a que se suelte lo capturado (controles.mjs lo sabe: hastaSoltar)
  function sueltoTodo() {
    return new Promise(listo => { const desde = ahora(); const mira = () => (!controles.ocupado({ sinReserva: true }) || ahora() - desde > 3000 ? listo() : setTimeout(mira, 40)); mira(); });
  }

  // Esc (interfaz.mjs) y cerrar el cajón cancelan cualquier espera, la prueba y el asistente
  addEventListener('mkw-reasignacion-cancelada', () => { if (espera || ayudante || controles.probando()) cancelarTodo('No se cambió nada.'); });

  // ---------------- pintar (cada 100 ms y después de cada cambio): solo textos, clases y atributos ----------------
  let firmaTraer = '';
  function pintar() {
    // (§114: con la hoja escondida —el cajón cerrado, otra pestaña— no hay nada que mostrar: el bucle de 100 ms no toca
    // nada; en un teléfono cada milisegundo de la página se lo quita al juego. Una espera en curso sí se sigue atendiendo)
    if (!caja.isConnected || (!caja.offsetParent && !espera && !ayudante)) { if (quietoHasta) { quietoHasta = 0; document.body.classList.remove('mando-quieto'); } return; }
    // (la espera de una tecla terminó —alCambiar de controles.mjs lo avisa, y por si no está conectado, aquí también—)
    if (espera?.tipo === 'tecla' && !controles.esperando()) terminarTecla(espera);
    const t = ahora();
    const mandos = (controles.estado.mandos || []);
    const m = mandoDeAhora();
    // (en un teléfono —sección Celular a la vista— no hay teclado: sin esa columna; en cambio, «En pantalla» —§113b—)
    const conTeclado = pestana === 0 && !celular?.visible;
    const conPantalla = pestana === 0 && !!celular?.visible && controles.tactilActivo();
    raiz.classList.toggle('con-pantalla', conPantalla);
    raiz.classList.toggle('con-teclado', conTeclado);
    raiz.classList.toggle('sin-mando', !m);
    // (en un teléfono sin mando conectado, la lista no tiene nada que mostrar —ni mando ni teclado—: se esconde)
    raiz.classList.toggle('sin-lista', !m && !conTeclado && !conPantalla);
    // las columnas de la lista: la acción, el mando (si hay) y el teclado o lo de la pantalla
    const cols = 'minmax(0, 1.3fr)' + (m ? ' minmax(0, 1fr)' : '') + (conTeclado || conPantalla ? ' minmax(0, 1fr)' : '');
    if (raiz.style.getPropertyValue('--cols') !== cols) raiz.style.setProperty('--cols', cols);
    // pestañas: quién es cada jugador
    pestanas.forEach(({ b, sub: s }, p) => {
      const x = mandos.find(y => y.puerto === p);
      const propio = celular?.visible ? (controles.tactilActivo() ? '📱 En pantalla' : 'sin mando') : '⌨ Teclado';
      texto(s, x ? `${ICONO[x.tipo] || '🎮'} ${NOMBRE_TIPO[x.tipo]?.split(' (')[0] || 'Mando'}` + (p === 0 && !celular?.visible ? ' + ⌨' : '') : p === 0 ? propio : 'sin mando');
      b.setAttribute('aria-selected', String(p === pestana));
    });
    // la cabeza
    if (m) {
      texto(titulo, `${ICONO[m.tipo] || '🎮'} ${NOMBRE_TIPO[m.tipo] || 'Mando'}`);
      const iguales = mandos.filter(x => x.perfil === m.perfil).length;
      texto(sub, `${m.nombre.replace(/\s*\(.*$/, '')} · ${m.propio ? 'botones asignados por ti' : m.letra ? 'botones por letra (A a la derecha)' : 'botones por posición'}` +
        (iguales > 1 ? ` · ${iguales} iguales: comparten botones` : ''));
    } else {
      const enPantalla = pestana === 0 && celular?.visible;
      texto(titulo, enPantalla ? (controles.tactilActivo() ? '📱 Mando en pantalla' : 'Jugador 1: sin mando') : conTeclado ? '⌨ Teclado' : `Jugador ${pestana + 1}: sin mando`);
      texto(sub, enPantalla && !mandos.length ? 'Juegas con el mando en pantalla (lo ajustas arriba, en «Celular»). Si conectas un mando por Bluetooth o cable, aparece aquí.'
        : controles.estado.bloqueados ? 'El navegador no deja leer mandos en esta página (permiso «gamepad» del marco). Recarga Juegos; si sigue, avísale al dueño.'
        : mandos.length ? (conTeclado ? 'Juegas con el teclado. Para usar un mando aquí, elige cuál:' : 'Elige qué mando es este jugador:')
        : 'Ningún mando todavía: conéctalo y aprieta un botón (si no aparece, haz clic en el juego y vuelve a apretar uno).');
    }
    oculto(filaJugador, !m);
    numeros.forEach((b, p) => marcado(b, m && m.puerto === p));
    // «que sea el jugador N» (se arma de nuevo solo si cambian los mandos o la pestaña)
    const firma = m ? '' : `${pestana}|` + mandos.map(x => `${x.clave}=${x.puerto}`).join(',');
    if (firma !== firmaTraer) {
      firmaTraer = firma;
      traer.replaceChildren(...(m ? [] : mandos.map(x => {
        const b = boton(`${ICONO[x.tipo] || '🎮'} ${NOMBRE_TIPO[x.tipo]?.split(' (')[0] || 'Mando'} (${x.puerto === undefined ? 'sin jugador' : 'jugador ' + (x.puerto + 1)}) → jugador ${pestana + 1}`);
        b.onclick = () => { cancelarTodo(); controles.elegirPuerto(x.clave, pestana); pintar(); };
        return b;
      })));
    }
    oculto(traer, !!m || !mandos.length);
    oculto(probador, !m);
    oculto(avisoSinMapa, !(m && m.sinMapa));
    // el probador
    if (m) {
      punto.style.transform = `translate(${(m.sx / 128) * 18}px, ${(-m.sy / 128) * 18}px)`;
      puntoC.style.transform = `translate(${(m.cx / 128) * 18}px, ${(-m.cy / 128) * 18}px)`;
      barraL.style.width = `${Math.round((m.gl / 255) * 100)}%`; barraR.style.width = `${Math.round((m.gr / 255) * 100)}%`;
    }
    const prueba = controles.probando();
    texto(probar, prueba ? 'Terminar la prueba' : 'Probar el mando 10 s');
    oculto(estadoPrueba, !prueba);
    if (prueba) texto(estadoPrueba, `Probando: aprieta botones y mueve los sticks; se enciende lo que manejan (no hacen nada más). Quedan ${Math.ceil(prueba / 1000)} s.`);
    // la lista: lo de cada fila, su luz y si espera
    const mapa = m?.mapa || {};
    const queHace = conPantalla ? controles.queHaceTactil() : {};
    for (const [obj, f] of filas) {
      const fuentes = mapa[obj] || [];
      const esperaAqui = espera && espera.obj === obj;
      const esperaMando = esperaAqui && espera.col === 'mando', esperaTecla = esperaAqui && espera.col === 'teclado';
      texto(f.mando, !m ? '—' : esperaMando ? 'Aprieta…' : fuentes.length ? fuentes.map(x => nombreFuente(x, m.tipo, m.estandar)).join(' · ') : 'nada');
      apagado(f.mando, !m);
      f.mando.classList.toggle('esperando', !!esperaMando); f.mando.classList.toggle('vacio', !!m && !fuentes.length && !esperaMando);
      const teclas = controles.teclasDe(teclaDe(obj)) || [];
      texto(f.teclado, esperaTecla ? 'Aprieta una tecla…' : teclas.length ? teclas.map(nombreTecla).join(' · ') : 'nada');
      f.teclado.classList.toggle('esperando', !!esperaTecla); f.teclado.classList.toggle('vacio', !teclas.length && !esperaTecla);
      f.luz.classList.toggle('encendida', encendido(m, obj) || (conTeclado && encendido(controles.estado.teclado, obj)));
      if (conPantalla) {                             // §113b: qué botones en pantalla lo hacen
        const enPantalla = queHace[obj] || [], sinBoton = obj.startsWith('c.');
        texto(f.pantalla, sinBoton ? '—' : enPantalla.length ? enPantalla.join(' · ') : 'agregar');
        apagado(f.pantalla, sinBoton); f.pantalla.classList.toggle('vacio', !enPantalla.length);
      }
      f.fila.classList.toggle('esperando', !!esperaAqui);
    }
    // la tira
    if (sel) {
      const esperaSel = espera && espera.obj === sel.obj && espera.col === sel.col;
      if (esperaSel && !espera.paso) {
        const s = Math.max(0, Math.ceil((espera.hasta - t) / 1000));
        texto(mensaje, sel.col === 'teclado' ? `Aprieta la tecla para «${nombreDe(sel.obj)}»… ${s} s (Esc o «Cancelar»: no cambia nada)`
          : `Aprieta en tu mando el botón (o mueve el stick) para «${nombreDe(sel.obj)}»… ${s} s (Esc o «Cancelar»: no cambia nada)`);
      }
      texto(bCambiar, esperaSel ? 'Cancelar' : 'Cambiar');
      const cuantas = sel.col === 'teclado' ? (controles.teclasDe(teclaDe(sel.obj)) || []).length : (mapa[sel.obj] || []).length;
      apagado(bSumar, !!esperaSel || cuantas >= (sel.col === 'teclado' ? MAX_TECLAS : MAX_FUENTES) || (sel.col === 'mando' && !m));
      apagado(bVaciar, !!esperaSel || !cuantas); apagado(bComoSiempre, !!esperaSel || (sel.col === 'mando' && !m));
      oculto(bDeshacer, !deshacer); apagado(bDeshacer, !!esperaSel);
    }
    // el asistente: la cuenta del paso
    if (ayudante?.cuenta && espera?.paso) texto(ayudante.cuenta, `Si no tocas nada en ${Math.max(0, Math.ceil((espera.hasta - t) / 1000))} s, queda igual y sigue. (Esc: terminar)`);
    oculto(pie, !m && !conTeclado);
    apagado(bAsistir, !m || !!ayudante); apagado(bRestaurarMando, !m);
    oculto(bDeshacerAbajo, !deshacer || !!sel); oculto(mensajeAbajo, !!sel);
    // §113: el celular
    if (celular?.visible) {
      const a = controles.ajustesTactil(), on = controles.tactilActivo();
      marcado(tactilSi, on); marcado(tactilNo, !on);
      texto(tamDato, `${Math.round(a.esc * 100)} %`); apagado(tamMenos, a.esc <= 0.8); apagado(tamMas, a.esc >= 1.3);
      texto(opaDato, `${Math.round(a.opa * 100)} %`); apagado(opaMenos, a.opa <= 0.3); apagado(opaMas, a.opa >= 1);
      const inc = controles.inclinando(); marcado(incSi, inc); marcado(incNo, !inc);
    }
    const ace = controles.ayudas().acelerar; marcado(aceSi, ace); marcado(aceNo, !ace);
    // los ajustes de todos
    const pr = controles.prefsMandos();
    estilos.forEach(b => marcado(b, b.dataset.valor === pr.disposicion));
    texto(zonaDato, `${pr.zona} %`); apagado(zonaMenos, pr.zona <= 3); apagado(zonaMas, pr.zona >= 40);
    marcado(vibSi, pr.vibrar); marcado(vibNo, !pr.vibrar);
    // (cada captura le cambia el modo a mando.js, que avisa con un cartel: mientras se usa el panel, sin carteles)
    if (espera || ayudante || controles.ocupado()) quietoHasta = t + 9000;
    document.body.classList.toggle('mando-quieto', t < quietoHasta);
  }
  const reloj = setInterval(pintar, 100);
  pintar();

  return {
    pintar,
    // controles.mjs avisa (alCambiar) cuando cambió una tecla o terminó la espera de una tecla
    refrescar() { if (espera?.tipo === 'tecla' && !controles.esperando()) terminarTecla(espera); else pintar(); },
    cancelar: () => cancelarTodo('No se cambió nada.'),
    elegirPestana, tocarRecuadro, asistir,
    get pestana() { return pestana; }, get espera() { return espera ? { ...espera } : null }, get ocupado() { return !!(espera || ayudante); },
    detener() { clearInterval(reloj); },
  };
}
