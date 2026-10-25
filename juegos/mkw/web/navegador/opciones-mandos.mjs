// «Mandos» en el panel Controles: qué mando hay, qué jugador es, cómo se leen sus botones, probarlo y REASIGNAR TODO —
// bitácora §57, §106 y §111.
//
// Resumen: por cada mando conectado, una tarjeta con su tipo (Nintendo, PlayStation, Xbox, adaptador de GameCube o
// genérico), qué jugador es (§106), un PROBADOR en vivo (los botones de GameCube que llegan al juego se encienden, el
// stick y el stick C con su punto, y los gatillos L y R con una barra de cuánto se aprietan) y, §111, la TABLA de
// asignación: cada control de GameCube (A, B, R, L, X, Y, Z, Start, la cruz, el stick y el stick C en sus cuatro
// direcciones) con lo que lo maneja en este mando, en la letra de su familia (✕ ○ □ △, A B X Y, «Stick izq. →»,
// «Eje 5+ (gatillo)», «Cruceta»). Por fila:
//   «Cambiar»  espera el próximo botón, eje o cruceta que se toque y lo pone ahí (solo);
//   «＋»       lo suma a lo que tenía (dos botones para lo mismo);
//   «✕» en cada entrada la quita; «↺» vuelve esa fila a la de siempre.
// Una entrada que ya manejaba otro control se mueve (no hace dos cosas a la vez) y se avisa («se quitó de Z»), con
// «Deshacer». Abajo, «Asignar todo seguido» (el asistente de antes: uno por uno, con «Saltar») y «Restaurar todo».
// Mientras se espera una entrada: Esc o 8 s la cancelan, ese mando no maneja el juego y el cursor del sitio se aparta.
// Arriba, los ajustes de todos: disposición (automática / por posición / por letra), zona muerta y vibración.
// Lo que se cambia se guarda para el MODELO del mando (su fabricante y producto: sirve por cable y por Bluetooth).
//
// Uso:  montarMandos(document.getElementById('mandosPanel'), controles)

import { BOTON, NOMBRE_TIPO } from './controles.mjs';
import { OBJETIVOS, nombreFuente, fotoMando } from './asignacion-mando.mjs';

const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };
const ICONO = { nintendo: '🔴', playstation: '🔵', xbox: '🟢', gamecube: '🟣', generico: '🎮' };
const PROBAR = ['A', 'B', 'X', 'Y', 'L', 'R', 'Z', 'START', 'arriba', 'abajo', 'izquierda', 'derecha'];
const CORTO = { START: 'Start', arriba: '↑', abajo: '↓', izquierda: '←', derecha: '→' };
export const ESPERA_CAPTURA_MS = 8000;
const NOMBRE_OBJETIVO = Object.fromEntries(OBJETIVOS);

// ¿ese control está encendido ahora en lo que llega al juego? (la luz de su fila)
export function encendido(m, id) {
  if (BOTON[id] && !['L', 'R'].includes(id)) return !!(m.botones & BOTON[id]);
  if (id === 'L') return m.gl > 20;
  if (id === 'R') return m.gr > 20;
  const [st, d] = id.split('.'), x = st === 'stick' ? m.sx : m.cx, y = st === 'stick' ? m.sy : m.cy;
  return d === 'der' ? x > 40 : d === 'izq' ? x < -40 : d === 'arr' ? y > 40 : y < -40;
}

export function montarMandos(caja, controles, { ahora = () => Date.now(), leerMandos = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []) } = {}) {
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
    el('p', { className: 'nota-mandos', textContent: '(La disposición vale para los mandos que no reasignaste a mano.)' }),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'zonaMandos', textContent: 'Zona muerta del stick' }), zona, zonaDato),
    el('div', { className: 'fila' }, el('label', {}, vibrar, ' Vibración'), probarVib),
    lista);

  // ---- esperar una entrada (una a la vez en toda la página) ----
  let espera = null;                                 // { clave, objetivo, reloj } mientras se espera
  function esperar(t, objetivo, sumar) {
    cancelarEspera();
    const antes = controles.mapaDe(t.clave);
    const p = controles.capturar(t.clave, objetivo, { sumar });
    espera = { clave: t.clave, objetivo, reloj: setTimeout(() => controles.cancelarCaptura(), ESPERA_CAPTURA_MS) };
    t.pintarTabla();
    return p.then(r => {
      clearTimeout(espera?.reloj); espera = null;
      if (r) {
        t.deshacer = antes;
        t.mensaje.textContent = `${NOMBRE_OBJETIVO[objetivo]}: ${nombreFuente(r.fuente, t.tipo, t.estandar)}` +
          (r.quitadoDe.length ? ` · se quitó de ${r.quitadoDe.map(id => NOMBRE_OBJETIVO[id].split(' —')[0]).join(', ')}` : '');
      } else t.mensaje.textContent = 'Cancelado: no se cambió nada.';
      t.botonDeshacer.hidden = !t.deshacer;
      t.pintarTabla();
      return r;
    });
  }
  function cancelarEspera() { if (espera) { clearTimeout(espera.reloj); espera = null; controles.cancelarCaptura(); } }
  addEventListener('mkw-reasignacion-cancelada', () => { for (const t of tarjetas.values()) t.pintarTabla(); });

  // ---- una tarjeta por mando ----
  const tarjetas = new Map();                       // clave del mando → la tarjeta
  function tarjeta(m) {
    const luces = Object.fromEntries(PROBAR.map(b => [b, el('span', { className: 'luz', textContent: CORTO[b] || b })]));
    const punto = el('i', { className: 'stick-punto' }), puntoC = el('i', { className: 'stick-punto c' });
    const barraL = el('i'), barraR = el('i');
    const titulo = el('b', {}), sub = el('small', {}), aviso = el('p', { className: 'aviso', hidden: true,
      textContent: 'Este mando no tiene mapeo estándar: el navegador no sabe qué botón es cuál. Usa «Asignar todo seguido».' });
    // qué jugador es este mando (1–4); «sin jugador» solo se ve si hay más de 4 mandos conectados
    const jugador = el('select', { className: 'mando-jugador', title: 'Qué jugador maneja este mando' },
      ...[0, 1, 2, 3].map(p => el('option', { value: String(p), textContent: `Jugador ${p + 1}` })),
      el('option', { value: '', textContent: 'Sin jugador (más de 4 mandos)', disabled: true }));
    jugador.onchange = () => { if (jugador.value !== '') controles.elegirPuerto(m.clave, Number(jugador.value)); };
    const tabla = el('table', { className: 'tabla-asignacion' });
    const mensaje = el('p', { className: 'nota-mandos', role: 'status' });
    const botonDeshacer = el('button', { type: 'button', className: 'boton', textContent: 'Deshacer', hidden: true });
    const asistir = el('button', { type: 'button', className: 'boton', textContent: 'Asignar todo seguido' });
    const restaurar = el('button', { type: 'button', className: 'boton', textContent: 'Restaurar todo' });
    const asistente = el('div', { className: 'asistente', hidden: true });
    const detalles = el('details', { className: 'mando-asignar' }, el('summary', { textContent: 'Reasignar botones, gatillos y sticks' }),
      tabla, el('div', { className: 'fila-botones' }, asistir, botonDeshacer, restaurar), mensaje, asistente);
    const nodo = el('div', { className: 'mando-tarjeta' },
      el('div', { className: 'mando-cab' }, el('div', { className: 'mando-nombre' }, titulo, sub), jugador), aviso,
      el('div', { className: 'probador' },
        el('div', { className: 'stick-aro', title: 'Stick' }, punto), el('div', { className: 'stick-aro c', title: 'Stick C' }, puntoC),
        el('div', { className: 'gatillos' }, el('span', {}, 'L', el('b', { className: 'barra-gatillo' }, barraL)), el('span', {}, 'R', el('b', { className: 'barra-gatillo' }, barraR))),
        el('div', { className: 'luces' }, ...Object.values(luces))),
      detalles);
    const t = { nodo, luces, punto, puntoC, barraL, barraR, titulo, sub, aviso, jugador, tabla, mensaje, botonDeshacer, asistente, detalles,
                clave: m.clave, tipo: m.tipo, estandar: m.estandar, deshacer: null, filas: new Map(), firmaTabla: '' };
    botonDeshacer.onclick = () => { if (t.deshacer) { controles.ponerMapa(t.clave, t.deshacer); t.deshacer = null; botonDeshacer.hidden = true; mensaje.textContent = 'Deshecho.'; t.pintarTabla(); } };
    restaurar.onclick = () => { t.deshacer = controles.mapaDe(t.clave); controles.borrarAsignacion(t.clave); botonDeshacer.hidden = false; mensaje.textContent = 'Todo como siempre.'; t.pintarTabla(); };
    asistir.onclick = () => asistirTodo(t);

    // la tabla: una fila por control (se arma de nuevo solo si cambió lo asignado o la espera)
    t.pintarTabla = () => {
      const est = (controles.estado.mandos || []).find(x => x.clave === t.clave);
      if (!est) return;
      const mapa = est.mapa || {};
      const esperando = espera?.clave === t.clave ? espera.objetivo : null;
      const firma = JSON.stringify([mapa, esperando, est.tipo, est.estandar]);
      if (firma === t.firmaTabla) return;
      t.firmaTabla = firma; t.tipo = est.tipo; t.estandar = est.estandar;
      t.filas.clear();
      t.tabla.replaceChildren(...OBJETIVOS.map(([id, nombre]) => {
        const luz = el('span', { className: 'luz', textContent: '' });
        const fuentes = el('span', { className: 'fuentes' });
        if (esperando === id) fuentes.append(el('i', { className: 'esperando', textContent: 'Aprieta un botón o mueve un stick… (Esc cancela)' }));
        else if (!(mapa[id] || []).length) fuentes.append(el('i', { className: 'vacio', textContent: 'nada (no se usa)' }));
        for (const f of esperando === id ? [] : mapa[id] || []) {
          const quitar = el('button', { type: 'button', className: 'quitar', textContent: '✕', title: 'Quitar' });
          quitar.onclick = () => { t.deshacer = controles.mapaDe(t.clave); controles.quitarFuente(t.clave, id, f); botonDeshacer.hidden = false; mensaje.textContent = `${nombre.split(' —')[0]}: se quitó ${nombreFuente(f, t.tipo, t.estandar)}.`; t.pintarTabla(); };
          fuentes.append(el('span', { className: 'fuente' }, nombreFuente(f, t.tipo, t.estandar), quitar));
        }
        const cambiar = el('button', { type: 'button', className: 'boton chico', textContent: esperando === id ? 'Cancelar' : 'Cambiar' });
        cambiar.onclick = () => (esperando === id ? (cancelarEspera(), t.pintarTabla()) : esperar(t, id, false));
        const sumar = el('button', { type: 'button', className: 'boton chico', textContent: '＋', title: 'Sumar otra entrada para lo mismo' });
        sumar.onclick = () => esperar(t, id, true);
        const deNuevo = el('button', { type: 'button', className: 'boton chico', textContent: '↺', title: 'Como siempre' });
        deNuevo.onclick = () => { t.deshacer = controles.mapaDe(t.clave); controles.restaurarObjetivo(t.clave, id); botonDeshacer.hidden = false; mensaje.textContent = `${nombre.split(' —')[0]}: como siempre.`; t.pintarTabla(); };
        t.filas.set(id, luz);
        const fila = el('tr', { className: esperando === id ? 'esperando' : '' },
          el('th', {}, luz, ' ', nombre), el('td', {}, fuentes), el('td', { className: 'acciones' }, cambiar, sumar, deNuevo));
        fila.dataset.objetivo = id;
        return fila;
      }));
    };
    return t;
  }

  // El asistente: uno por uno, «Toca lo que quieres para A — acelerar…» (con «Saltar» y «Cancelar»); entre uno y otro
  // espera a que se suelte todo, para que el mismo botón no quede en el siguiente
  async function asistirTodo(t) {
    cancelarEspera();
    t.detalles.open = true;
    t.asistente.hidden = false;
    let cancelado = false;
    const cancelar = el('button', { type: 'button', className: 'boton', textContent: 'Cancelar', onclick: () => { cancelado = true; cancelarEspera(); } });
    const antes = controles.mapaDe(t.clave);
    for (const [id, texto] of OBJETIVOS) {
      if (cancelado) break;
      const saltar = el('button', { type: 'button', className: 'boton', textContent: 'Saltar', onclick: () => cancelarEspera() });
      t.asistente.replaceChildren(el('p', {}, 'Toca en el mando lo que quieres para ', el('b', { textContent: texto }), '…'), el('div', { className: 'fila-botones' }, saltar, cancelar));
      await esperar(t, id, false);
      await soltado(t);
    }
    t.deshacer = antes; t.botonDeshacer.hidden = false;
    t.asistente.replaceChildren(el('p', { textContent: cancelado ? 'Asignación cancelada (lo que alcanzaste a asignar quedó guardado; «Deshacer» lo vuelve atrás).' : '¡Listo! Prueba los botones arriba.' }));
    setTimeout(() => { t.asistente.hidden = true; }, 3000);
  }
  // espera (hasta 3 s) a que el mando quede suelto: ningún botón apretado y los ejes cerca de su reposo
  const reposos = new Map();
  function soltado(t) {
    return new Promise(listo => {
      const desde = ahora();
      const mira = () => {
        const est = (controles.estado.mandos || []).find(x => x.clave === t.clave);
        let g = null;
        try { g = est ? leerMandos().find(x => x && x.index === est.indice) : null; } catch {}
        if (!g) return listo();
        const f = fotoMando(g);
        if (!reposos.has(t.clave)) reposos.set(t.clave, f);
        const r = reposos.get(t.clave);
        const quieto = f.botones.every((b, i) => !b || r.botones[i]) && f.ejes.every((v, i) => Math.abs(v - (r.ejes[i] ?? 0)) < 0.3);
        if (quieto || ahora() - desde > 3000) return listo();
        setTimeout(mira, 50);
      };
      mira();
    });
  }

  // ---- cada 100 ms: tarjetas al día, luces del probador y de la tabla ----
  function pintar() {
    // (las tarjetas van por la clave del mando, no por su nombre: dos mandos iguales son dos tarjetas)
    const mandos = (controles.estado.mandos || []).slice().sort((a, b) => (a.puerto ?? 9) - (b.puerto ?? 9));
    for (const [clave, t] of tarjetas) if (!mandos.some(m => m.clave === clave)) { t.nodo.remove(); tarjetas.delete(clave); }
    for (const m of mandos) {
      let t = tarjetas.get(m.clave);
      if (!t) { t = tarjeta(m); tarjetas.set(m.clave, t); reposos.delete(m.clave); }
      lista.append(t.nodo);                       // (en orden de jugador: append de un nodo que ya está solo lo mueve)
      const sinPuerto = m.puerto === undefined;
      t.titulo.textContent = `${ICONO[m.tipo] || '🎮'} ${NOMBRE_TIPO[m.tipo] || 'Mando'}${sinPuerto ? ' · sin jugador' : ` · jugador ${m.puerto + 1}`}`;
      if (document.activeElement !== t.jugador) t.jugador.value = sinPuerto ? '' : String(m.puerto);   // (no mientras la persona elige)
      t.sub.textContent = `${m.nombre.replace(/\s*\(.*$/, '')} · ${m.propio ? 'botones asignados por ti' : m.letra ? 'botones por letra (A a la derecha)' : 'botones por posición'}`;
      t.aviso.hidden = !m.sinMapa;
      for (const b of PROBAR) t.luces[b].classList.toggle('encendida', !!(m.botones & BOTON[b]));
      t.punto.style.transform = `translate(${(m.sx / 128) * 18}px, ${(-m.sy / 128) * 18}px)`;
      t.puntoC.style.transform = `translate(${(m.cx / 128) * 18}px, ${(-m.cy / 128) * 18}px)`;
      t.barraL.style.width = `${Math.round((m.gl / 255) * 100)}%`; t.barraR.style.width = `${Math.round((m.gr / 255) * 100)}%`;
      if (t.detalles.open) { t.pintarTabla(); for (const [id, luz] of t.filas) luz.classList.toggle('encendida', encendido(m, id)); }
    }
    lista.classList.toggle('vacia', !mandos.length);
    // Sin mandos: qué hacer. Chrome no muestra un mando a la página hasta que se aprieta un botón con la página a la vista
    // (por privacidad); en el marco de Juegos, a veces hace falta un clic en el juego para que el marco sea el activo.
    if (!mandos.length) lista.dataset.vacia = controles.estado.bloqueados
      ? 'El navegador no deja leer mandos en esta página (permiso «gamepad» del marco). Recarga Juegos; si sigue, avísale al dueño.'
      : 'Ningún mando todavía: conéctalo y aprieta un botón (si no aparece, haz clic en el juego y vuelve a apretar uno).';
  }
  setInterval(pintar, 100);
  pintar();
  return { pintar, tarjetas };
}
