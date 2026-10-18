// «Mandos» en el panel Controles: qué mando hay, cómo se leen sus botones, probarlo y asignarle botones — bitácora §57.
//
// Resumen: por cada mando conectado muestra una tarjeta con su tipo (Nintendo, PlayStation, Xbox, adaptador de
// GameCube o genérico), en qué puerto está, si usa la disposición «por letra» (Nintendo: A a la derecha) y un
// PROBADOR en vivo (los botones de GameCube que llegan al juego se encienden, y un punto muestra el stick). Con
// «Asignar botones» un asistente pide, uno por uno, que aprietes el botón del mando para A, B, R, L… (útil con
// adaptadores de GameCube y mandos sin mapeo estándar, que el navegador no sabe leer solo). Arriba, los ajustes de
// todos: disposición (automática / por posición / por letra), zona muerta del stick y vibración (con «Probar»).
// Todo lo guarda controles.mjs en el navegador ("mkw.mandos").
//
// Uso:  montarMandos(document.getElementById('mandosPanel'), controles)

import { BOTON, NOMBRE_TIPO, ASIGNABLES } from './controles.mjs';

const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };
const ICONO = { nintendo: '🔴', playstation: '🔵', xbox: '🟢', gamecube: '🟣', generico: '🎮' };
const PROBAR = ['A', 'B', 'X', 'Y', 'L', 'R', 'Z', 'START', 'arriba', 'abajo', 'izquierda', 'derecha'];
const CORTO = { START: 'Start', arriba: '↑', abajo: '↓', izquierda: '←', derecha: '→' };

export function montarMandos(caja, controles) {
  const prefs = controles.prefsMandos();
  // ---- ajustes de todos los mandos ----
  const disp = el('select', { id: 'dispMandos' },
    el('option', { value: 'auto', textContent: 'Automática (Nintendo por letra, los demás por posición)' }),
    el('option', { value: 'posicion', textContent: 'Por posición (como Xbox: el de abajo es A)' }),
    el('option', { value: 'letra', textContent: 'Por letra (como Nintendo: la A está a la derecha)' }));
  disp.value = prefs.disposicion;
  disp.onchange = () => controles.ajustarMandos({ disposicion: disp.value });
  const zona = el('input', { type: 'range', id: 'zonaMandos', min: 3, max: 40, step: 1, value: prefs.zona, style: 'width:130px' });
  const zonaDato = el('span', { className: 'dato', textContent: prefs.zona + ' %' });
  zona.oninput = () => { zonaDato.textContent = zona.value + ' %'; controles.ajustarMandos({ zona: Number(zona.value) }); };
  const vibrar = el('input', { type: 'checkbox', id: 'vibrarMandos', checked: prefs.vibrar });
  vibrar.onchange = () => controles.ajustarMandos({ vibrar: vibrar.checked });
  const probarVib = el('button', { type: 'button', className: 'boton', textContent: 'Probar vibración',
    onclick: () => { controles.vibrar(0, 1); setTimeout(() => controles.vibrar(0, 0), 400); } });
  const lista = el('div', { className: 'mandos-lista', id: 'listaMandos' });
  caja.replaceChildren(
    el('div', { className: 'fila' }, el('label', { htmlFor: 'dispMandos', textContent: 'Botones' }), disp),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'zonaMandos', textContent: 'Zona muerta del stick' }), zona, zonaDato),
    el('div', { className: 'fila' }, el('label', {}, vibrar, ' Vibración'), probarVib),
    lista);

  // ---- una tarjeta por mando, con probador y asistente ----
  const tarjetas = new Map();                       // id del mando → { nodo, luces, punto, asistente }
  function tarjeta(m) {
    const luces = Object.fromEntries(PROBAR.map(b => [b, el('span', { className: 'luz', textContent: CORTO[b] || b })]));
    const punto = el('i', { className: 'stick-punto' });
    const titulo = el('b', {}), sub = el('small', {}), aviso = el('p', { className: 'aviso', hidden: true,
      textContent: 'Este mando no tiene mapeo estándar: el navegador no sabe qué botón es cuál. Usa «Asignar botones».' });
    const asistente = el('div', { className: 'asistente', hidden: true });
    const asignar = el('button', { type: 'button', className: 'boton', textContent: 'Asignar botones' });
    const borrar = el('button', { type: 'button', className: 'boton', textContent: 'Borrar asignación', hidden: true });
    const nodo = el('div', { className: 'mando-tarjeta' },
      el('div', { className: 'mando-cab' }, titulo, sub), aviso,
      el('div', { className: 'probador' }, el('div', { className: 'stick-aro' }, punto), el('div', { className: 'luces' }, ...Object.values(luces))),
      el('div', { className: 'fila-botones' }, asignar, borrar), asistente);
    const t = { nodo, luces, punto, titulo, sub, aviso, borrar, asistente, id: m.nombre };
    asignar.onclick = () => asistir(t);
    borrar.onclick = () => { controles.borrarAsignacion(t.id); };
    return t;
  }
  // El asistente: uno por uno, «Aprieta el botón para A — acelerar…»; Saltar deja ese sin asignar; Esc cancela
  async function asistir(t) {
    t.asistente.hidden = false;
    let cancelado = false;
    const cancelar = el('button', { type: 'button', className: 'boton', textContent: 'Cancelar', onclick: () => { cancelado = true; controles.cancelarAsignacion(); } });
    for (const [boton, texto] of ASIGNABLES) {
      if (cancelado) break;
      const saltar = el('button', { type: 'button', className: 'boton', textContent: 'Saltar', onclick: () => controles.cancelarAsignacion() });
      t.asistente.replaceChildren(el('p', {}, 'Aprieta en el mando el botón para ', el('b', { textContent: texto }), '…'), el('div', { className: 'fila-botones' }, saltar, cancelar));
      await controles.asignarBoton(t.id, boton);
    }
    t.asistente.replaceChildren(el('p', { textContent: cancelado ? 'Asignación cancelada (lo que alcanzaste a asignar quedó guardado).' : '¡Listo! Prueba los botones arriba.' }));
    setTimeout(() => { t.asistente.hidden = true; }, 2500);
  }

  // ---- cada 100 ms: tarjetas al día y luces del probador ----
  function pintar() {
    const mandos = controles.estado.mandos || [];
    for (const [id, t] of tarjetas) if (!mandos.some(m => m.nombre === id)) { t.nodo.remove(); tarjetas.delete(id); }
    for (const m of mandos) {
      let t = tarjetas.get(m.nombre);
      if (!t) { t = tarjeta(m); tarjetas.set(m.nombre, t); lista.append(t.nodo); }
      t.titulo.textContent = `${ICONO[m.tipo] || '🎮'} ${NOMBRE_TIPO[m.tipo] || 'Mando'} · jugador ${m.puerto + 1}`;
      t.sub.textContent = `${m.nombre.replace(/\s*\(.*$/, '')} · ${m.propio ? 'botones asignados por ti' : m.letra ? 'botones por letra (A a la derecha)' : 'botones por posición'}`;
      t.aviso.hidden = !m.sinMapa;
      t.borrar.hidden = !m.propio;
      for (const b of PROBAR) t.luces[b].classList.toggle('encendida', !!(m.botones & BOTON[b]));
      t.punto.style.transform = `translate(${(m.sx / 128) * 18}px, ${(-m.sy / 128) * 18}px)`;
    }
    lista.classList.toggle('vacia', !mandos.length);
    if (!mandos.length) lista.dataset.vacia = 'Ningún mando todavía: conéctalo y aprieta un botón para que el navegador lo vea.';
  }
  setInterval(pintar, 100);
  pintar();
}
