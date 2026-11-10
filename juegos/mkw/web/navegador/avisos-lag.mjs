// §262 — Ocultar los avisos de lag (el dueño: «agrega una opcion para ocultar los mensajes de lag»).
//
// Resumen: la sala avisa en una esquina cuando la red o una PC van lentas (📶 «X va lento», «tu conexión va lenta»,
// «la sala va lenta por X», 🔴 «X llega por otro piloto», «quién no llega a 60» antes de largar) y al centro cuando una
// parte de la sala se separó de la carrera. Con la casilla «Mostrar avisos de conexión y lag» apagada (Avanzado →
// Gráficos) esos carteles no se pintan. Es solo lo que se VE: el lockstep, el relevo, el árbitro y los cortes siguen
// igual, el registro (mkwEstado.log) y las listas de las pruebas (window.mkwAvisosRelevo, mkwAvisosLento) siguen
// anotándolo todo, y los avisos graves (te cortaste, te echaron, la carrera espera a alguien, se cortó TU conexión)
// salen siempre. La lista de cuál es cuál está en la bitácora §262.
//
// Cómo se usa: crearAvisosLag({ parametros }) → { prendidos(), fijar(v), forzado, esLag(clave), pasa(clave, texto),
// pintado(clave, texto), estado() }. La página (interfaz.mjs) le pregunta a `pasa` antes de pintar cada chip de la
// esquina; mkw.mjs pregunta `prendidos()` antes del aviso de la sala partida. `?avisosLag=0|1` la fuerza (pruebas).

export const CLAVE = 'mkw.avisosLag';                 // localStorage: '0' = escondidos; cualquier otra cosa = a la vista
// Las claves de los chips de la esquina que son «lag» (interfaz.mjs chip(clave, …)):
//   red      el relevo de la sincronía: «📶 X va lento», «📶 tu conexión o tu PC van lentas», la pausa del relevo rápido
//   lento    la vigía de cada 3 s: «la sala va lenta por X» (lockstep.mjs vigiaLento)
//   conexion los 🔴 de la prueba de conexión (conexiones.mjs: por otro piloto o sin conexión)
//   lentos   N12 (§233): antes de largar, quién no llega a 60
export const CHIPS_LAG = Object.freeze(['red', 'lento', 'conexion', 'lentos']);

// Lo guardado: prendidos salvo un '0' guardado (como un interruptor que viene cerrado de fábrica)
export function leerAvisosLag(almacen = globalThis.localStorage) {
  try { return almacen?.getItem(CLAVE) !== '0'; } catch { return true; }   // (sin almacén o bloqueado: a la vista)
}
export function guardarAvisosLag(v, almacen = globalThis.localStorage) {
  try { almacen?.setItem(CLAVE, v ? '1' : '0'); } catch {}                // (si no se puede guardar, vale igual en esta visita)
}

// parametros: los de la dirección (?avisosLag=0|1 manda por encima de lo guardado); alCambiar(v): al prender o apagar
export function crearAvisosLag({ parametros = new URLSearchParams(globalThis.location?.search || ''),
                                 almacen = globalThis.localStorage, alCambiar = () => {} } = {}) {
  const p = parametros.get('avisosLag');
  const forzado = p === '0' || p === '1';               // (forzado por la dirección: la casilla queda fija)
  let prendido = forzado ? p === '1' : leerAvisosLag(almacen);
  const lag = new Set(CHIPS_LAG);
  const ultimoOculto = new Map();                       // clave → el último texto escondido (el mismo no se cuenta 2 veces)
  const cuenta = { ocultos: 0, mostrados: 0, porClave: {} };
  const esLag = clave => lag.has(clave);
  return {
    forzado,
    prendidos: () => prendido,
    esLag,
    // prender o apagar desde la casilla: se aplica en el momento (los chips puestos los saca alCambiar)
    fijar(v) {
      v = !!v;
      if (v === prendido) return;
      prendido = v;
      if (!forzado) guardarAvisosLag(v, almacen);
      ultimoOculto.clear();
      try { alCambiar(v); } catch {}
    },
    // ¿se pinta este chip? (texto vacío = sacarlo: eso pasa siempre). Cuenta lo escondido, una vez por texto distinto
    pasa(clave, texto) {
      if (!texto || prendido || !esLag(clave)) return true;
      if (ultimoOculto.get(clave) !== texto) {
        ultimoOculto.set(clave, texto);
        cuenta.ocultos++;
        cuenta.porClave[clave] = (cuenta.porClave[clave] || 0) + 1;
      }
      return false;
    },
    // la página pintó un chip de lag nuevo (para las pruebas: con la opción apagada tiene que quedar en 0)
    pintado(clave, texto) { if (texto && esLag(clave)) cuenta.mostrados++; },
    estado: () => ({ prendidos: prendido, forzado, ocultos: cuenta.ocultos, mostrados: cuenta.mostrados, porClave: { ...cuenta.porClave } }),
  };
}

// Los chips de la esquina (M22, antes dentro de interfaz.mjs; §262 los trajo aquí para probarlos en el banco).
// chip(clave, texto, mal, ms): aparece `ms` cada vez que el texto cambia y se va solo (texto vacío = se va ya); el mismo
// texto de nuevo no vuelve a salir. No queda puesto mientras dure: cualquier cosa encima de la imagen del juego obliga al
// navegador a componer cada cuadro (§98.9). filtroChip = crearAvisosLag(): un chip de lag con la opción apagada no se pinta.
// repintarChips(claves, prendidos): la opción cambió en el momento: apagada = se sacan; prendida = vuelve lo que sigue
// vigente (lo pedido hace menos de lo que iba a durar)
export function crearChips(esquina, { filtroChip = null, sinEsquina = false, ahora = () => Date.now() } = {}) {
  const ultimoChip = new Map();                   // clave → el último texto pintado (el mismo de nuevo no vuelve a salir)
  const pedidoChip = new Map();                   // clave → lo último pedido [texto, mal, ms, cuándo] (para volver a pintarlo)
  const buscar = clave => esquina.querySelector(`[data-clave="${clave}"]`);
  function chip(clave, texto, mal = false, ms = 6000) {
    if (sinEsquina) return;
    let c = buscar(clave);
    if (!texto) { ultimoChip.delete(clave); pedidoChip.delete(clave); c?.remove(); return; }
    if (filtroChip && !filtroChip.pasa(clave, texto)) {   // un aviso de lag con la opción apagada: no se pinta
      pedidoChip.set(clave, [texto, mal, ms, ahora()]);
      if (c) { ultimoChip.delete(clave); c.remove(); }
      return;
    }
    if (ultimoChip.get(clave) === texto) return;
    ultimoChip.set(clave, texto);
    pedidoChip.set(clave, [texto, mal, ms, ahora()]);
    filtroChip?.pintado(clave, texto);
    if (!c) { c = document.createElement('span'); c.className = 'chip-estado'; c.dataset.clave = clave; esquina.append(c); }
    c.textContent = texto;
    c.classList.toggle('mal', mal);
    clearTimeout(c._hasta);
    c._hasta = setTimeout(() => c.remove(), ms);
  }
  function repintarChips(claves, prendidos) {
    for (const clave of claves) {
      const c = buscar(clave);
      if (!prendidos) { ultimoChip.delete(clave); c?.remove(); continue; }
      const p = pedidoChip.get(clave), pasado = p ? ahora() - p[3] : 0;
      if (p && !c && pasado < p[2]) { ultimoChip.delete(clave); chip(clave, p[0], p[1], p[2] - pasado); }
    }
  }
  return { chip, repintarChips };
}
