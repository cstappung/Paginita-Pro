// Los mandos entre ventanas del mismo navegador (bitácora §269, bug 3 del dueño: «con 2 jugadores uno juega y el otro no
// puede moverse»).
//
// Resumen: el dueño prueba «2 PCs» como 2 ventanas de Chrome en un PC. Chrome le da los mandos (la Gamepad API) SOLO a la
// ventana que tiene el foco: la otra ve la lista vacía y su kart no se mueve. Y si las dos los vieran, cada una juntaría
// TODOS los mandos en su único jugador de la sala (§269, `juntarPuertos`): los dos karts con los dos mandos.
// Esto lo arregla con un canal entre las ventanas del mismo navegador (BroadcastChannel, como un bus de campo que todas
// escuchan): cada ventana en una sala dice «estoy» cada segundo; la que tiene el foco publica la foto de los mandos en
// cada lectura; la que no lo tiene usa la última foto (si tiene menos de 250 ms). Con 2 o más ventanas en la sala, cada
// una usa SOLO su mando: la 1.ª ventana en llegar el 1.er mando conectado, la 2.ª el 2.º, etc. (como repartir los
// enchufes de una zapatilla por orden de llegada). Con una sola ventana no cambia nada (todos los mandos a su jugador).
// El teclado sigue yendo a la ventana con el foco (eso no se puede compartir sin que las dos manejen con las mismas teclas).
// ?mandosVentanas=0 = sin esto.

export const VIGENCIA_FOTO_MS = 250;   // una foto más vieja que esto no vale (la otra ventana perdió el foco o se cerró)
export const VIGENCIA_VENTANA_MS = 3000;
export const LATIDO_MS = 1000;

// la foto de un mando: solo lo que lee controles.mjs (los objetos Gamepad no se pueden mandar por el canal)
export const fotoDe = g => ({ index: g.index, id: g.id, mapping: g.mapping, timestamp: g.timestamp,
  axes: [...(g.axes || [])], buttons: [...(g.buttons || [])].map(b => ({ pressed: !!b?.pressed, value: +b?.value || 0, touched: !!b?.touched })) });

export function crearMandosVentanas({ canal = null, ahora = () => performance.now(), tieneFoco = () => !!globalThis.document?.hasFocus?.(),
  id = Math.random().toString(36).slice(2), desde = Date.now() } = {}) {
  const ventanas = new Map();             // id → { desde, visto }
  let foto = null, fotoT = -Infinity, activa = false, reloj = null;
  const estado = { activa: false, ventanas: 1, puesto: 0, fotosRecibidas: 0, fotosMandadas: 0, usandoFoto: false };
  const mandar = m => { try { canal?.postMessage(m); } catch {} };
  const latir = () => mandar({ t: 'aqui', id, desde });
  if (canal) canal.onmessage = ({ data: m }) => {
    if (!activa || !m || m.id === id) return;   // (fuera de la sala no se cuenta ni se contesta)
    if (m.t === 'aqui' || m.t === 'mandos') ventanas.set(m.id, { desde: m.desde ?? ventanas.get(m.id)?.desde ?? Infinity, visto: ahora() });
    if (m.t === 'adios') ventanas.delete(m.id);
    if (m.t === 'mandos') { foto = m.mandos; fotoT = ahora(); estado.fotosRecibidas++; }
    if (m.t === 'aqui' && m.nuevo) latir();      // (al que llega se le contesta enseguida: así sabe su puesto al toque)
  };
  // las ventanas de la sala, por orden de llegada (y el id para desempatar): mi puesto es mi lugar en esa fila
  const fila = () => {
    const t = ahora();
    for (const [k, v] of ventanas) if (t - v.visto > VIGENCIA_VENTANA_MS) ventanas.delete(k);
    return [[id, desde], ...[...ventanas].map(([k, v]) => [k, v.desde])].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).map(x => x[0]);
  };
  return {
    estado,
    // prender (al entrar a la sala): desde ahí esta ventana cuenta en la fila
    activar() {
      if (activa || !canal) return; activa = estado.activa = true;
      mandar({ t: 'aqui', id, desde, nuevo: true });
      reloj = setInterval(latir, LATIDO_MS);
      globalThis.addEventListener?.('pagehide', () => mandar({ t: 'adios', id }));
    },
    // lo que lee controles.mjs cada vez: la lista de mandos de esta ventana (la del navegador) → la que debe usar
    elegir(propios) {
      if (!activa) return propios;
      const f = fila(), puesto = f.indexOf(id);
      estado.ventanas = f.length; estado.puesto = puesto;
      let lista = propios;
      if (propios.length && tieneFoco()) { mandar({ t: 'mandos', id, desde, mandos: propios.map(fotoDe) }); estado.fotosMandadas++; }
      estado.usandoFoto = false;
      if (!propios.length && foto && ahora() - fotoT < VIGENCIA_FOTO_MS) { lista = foto; estado.usandoFoto = true; }
      if (f.length < 2) return lista;
      // con 2 o más ventanas: solo el mando de mi puesto (por orden de índice de los conectados)
      const orden = [...lista].sort((a, b) => a.index - b.index);
      return orden[puesto] ? [orden[puesto]] : [];
    },
    parar() { clearInterval(reloj); mandar({ t: 'adios', id }); activa = estado.activa = false; },
  };
}
