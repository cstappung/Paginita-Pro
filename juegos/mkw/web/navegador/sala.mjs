// La sala en línea de la página: quién está, la cola de pistas (como una playlist) y el tiempo entre carreras — §58.
//
// Resumen: una sala junta hasta 12 personas (lo máximo que admite Mario Kart Wii en línea). Una de ellas es el
// ANFITRIÓN: guarda el estado verdadero de la sala y se lo manda a todos cada vez que cambia (como un tablero que
// solo él escribe); los demás le mandan PEDIDOS (agregar una pista, confirmar, salir…) y él decide. Si el anfitrión se
// va, toma su lugar quien entró primero de los que quedan (y sigue desde el último estado que todos tenían).
//
// Las fases de la sala:
//   sala       → esperando: se arma la cola; el anfitrión aprieta «Empezar» (con al menos una pista en la cola)
//   eligiendo  → 45 s para cambiar personaje y kart antes de la próxima pista; cada uno puede «Confirmar». Si todos
//                confirman antes, se empieza ya; si se acaba el tiempo, también
//   carrera    → se corre la primera pista de la cola (que sale de la cola). Quien entra ahora no puede correr: elige
//                «Entrar en la siguiente carrera» o «Ir a la sala», y mientras tanto MIRA la carrera (espectador)
//   (al terminar la carrera) → eligiendo otra vez si quedan pistas, o sala si la cola quedó vacía
//
// No sabe nada de la red: habla por un "canal" { enviar(mensaje), alRecibir(fn) } (en el banco, un BroadcastChannel
// o un bus en memoria; en el sitio, Firebase para presentarse + WebRTC). Y el reloj se puede cambiar (para probar los
// 45 s sin esperarlos). Lo que hace el juego en cada fase (llevarlo a la carrera, la red del juego) va aparte.
//
// Uso:  const sala = crearSala({ canal, yo: { id, nombre }, anfitrion: true });  sala.alCambiar(e => pintar(e));
//       sala.agregar({ copa, fila }) · sala.confirmar() · sala.empezar() · sala.terminoCarrera() · sala.salir()

export const MAX_JUGADORES = 12;
export const SEGUNDOS_ELEGIR = 45;

export function crearSala({ canal, yo, anfitrion = false, reloj = { ahora: () => Date.now(), cada: (fn, ms) => setInterval(fn, ms), parar: id => clearInterval(id) } }) {
  let estado = anfitrion ? nuevaSala() : null;          // la copia de la sala (verdadera si soy anfitrión)
  let soyAnfitrion = anfitrion;
  const oyentes = new Set();
  let tic = 0, rechazo = '', salio = false;

  function nuevaSala() {
    return { version: 0, anfitrion: yo.id, fase: 'sala', jugadores: [{ id: yo.id, nombre: yo.nombre, entro: reloj.ahora(), listo: false, espera: false }],
             cola: [], actual: null, hasta: 0, historia: [] };
  }
  const avisar = () => oyentes.forEach(f => f(vista()));
  const vista = () => estado && { ...estado, yo: yo.id, soyAnfitrion, rechazo,
    // quien entró con la carrera andando: no corre esta, la mira (espectador) y elige qué hacer
    espectador: estado.fase === 'carrera' && !!estado.jugadores.find(j => j.id === yo.id)?.espera,
    restante: estado.fase === 'eligiendo' ? Math.max(0, Math.ceil((estado.hasta - reloj.ahora()) / 1000)) : 0 };

  // ---- el anfitrión: aplica un pedido y publica el estado ----
  function publicar() { estado.version++; canal.enviar({ tipo: 'estado', estado }); avisar(); }
  function aplicar(de, p) {
    const s = estado, j = s.jugadores.find(x => x.id === de);
    switch (p.tipo) {
      case 'unirse': {
        if (j) return;                                                             // ya estaba
        if (s.jugadores.length >= MAX_JUGADORES) { canal.enviar({ tipo: 'rechazo', para: de, motivo: `La sala está llena (${MAX_JUGADORES} de ${MAX_JUGADORES}).` }); return; }
        s.jugadores.push({ id: de, nombre: String(p.nombre || 'Piloto').slice(0, 20), entro: reloj.ahora(), listo: false, espera: s.fase === 'carrera' });
        break;
      }
      case 'salir': s.jugadores = s.jugadores.filter(x => x.id !== de); break;
      case 'agregar':                                                              // a la cola, al final (como una playlist)
        if (!j || s.cola.length >= 32) return;
        s.cola.push({ copa: p.copa | 0, fila: p.fila | 0, por: de, id: `${de}-${reloj.ahora()}-${s.cola.length}` });
        break;
      case 'quitar': {                                                             // quien la puso o el anfitrión
        const i = s.cola.findIndex(x => x.id === p.id);
        if (i >= 0 && (s.cola[i].por === de || de === s.anfitrion)) s.cola.splice(i, 1);
        break;
      }
      case 'mover': {                                                              // subir/bajar: quien la puso o el anfitrión
        const i = s.cola.findIndex(x => x.id === p.id), k = i + (p.d | 0);
        if (i < 0 || k < 0 || k >= s.cola.length || (s.cola[i].por !== de && de !== s.anfitrion)) return;
        [s.cola[i], s.cola[k]] = [s.cola[k], s.cola[i]];
        break;
      }
      case 'empezar':
        if (de !== s.anfitrion || s.fase !== 'sala' || !s.cola.length) return;
        abrirEleccion();
        break;
      case 'confirmar':
        if (!j || s.fase !== 'eligiendo') return;
        j.listo = true;
        if (s.jugadores.filter(x => !x.espera).every(x => x.listo)) arrancarCarrera();   // todos listos: ya
        break;
      case 'siguiente':                                                            // el espectador: «entrar en la siguiente»
        if (j) j.espera = s.fase === 'carrera';                                    // sigue esperando hasta que termine
        if (j) j.quiereSala = false;
        break;
      case 'irSala':                                                               // el espectador: «ir a la sala» (no corre hasta que la sala vuelva)
        if (j) { j.quiereSala = true; }
        break;
      case 'termino':                                                              // la carrera terminó (lo dice el anfitrión)
        if (de !== s.anfitrion || s.fase !== 'carrera') return;
        s.historia.push(s.actual); s.actual = null;
        s.jugadores.forEach(x => { x.espera = false; });                           // los que miraban ya pueden correr
        if (s.cola.length) abrirEleccion(); else { s.fase = 'sala'; s.hasta = 0; }
        break;
      default: return;
    }
    publicar();
  }
  function abrirEleccion() {
    const s = estado;
    s.fase = 'eligiendo'; s.hasta = reloj.ahora() + SEGUNDOS_ELEGIR * 1000;
    s.jugadores.forEach(x => { x.listo = false; });
  }
  function arrancarCarrera() {
    const s = estado;
    s.fase = 'carrera'; s.actual = s.cola.shift() || null; s.hasta = 0;
    s.jugadores.forEach(x => { x.listo = false; });
  }
  // el reloj del anfitrión: se acabaron los 45 s → a correr
  function vigilar() {
    if (tic) return;
    tic = reloj.cada(() => {
      if (!soyAnfitrion || !estado) return;
      if (estado.fase === 'eligiendo' && reloj.ahora() >= estado.hasta) { arrancarCarrera(); publicar(); }
      else avisar();                                                               // para la cuenta regresiva en pantalla
    }, 250);
  }

  // ---- mensajes ----
  canal.alRecibir(m => {
    if (salio || !m || m.de === yo.id) return;                                     // quien ya salió no escucha más
    if (m.tipo === 'pedido' && soyAnfitrion) aplicar(m.de, m.pedido);
    else if (m.tipo === 'estado' && (!estado || m.estado.version > estado.version || m.estado.anfitrion !== estado.anfitrion)) {
      estado = m.estado;
      soyAnfitrion = estado.anfitrion === yo.id;
      if (!estado.jugadores.some(j => j.id === yo.id) && !rechazo) pedir({ tipo: 'unirse', nombre: yo.nombre });   // el anfitrión no me tiene: pedirlo otra vez
      avisar();
    } else if (m.tipo === 'rechazo' && m.para === yo.id) { rechazo = m.motivo; avisar(); }
    else if (m.tipo === 'hola' && soyAnfitrion) canal.enviar({ tipo: 'estado', estado });
    else if (m.tipo === 'adios' && estado) {
      // alguien se fue (cerró la pestaña). Si era el anfitrión: el que entró primero de los que quedan toma su lugar
      const eraAnfitrion = m.de === estado.anfitrion;
      if (soyAnfitrion) aplicar(m.de, { tipo: 'salir' });
      else if (eraAnfitrion) {
        const quedan = estado.jugadores.filter(j => j.id !== m.de).sort((a, b) => a.entro - b.entro);
        if (quedan[0]?.id === yo.id) {
          estado = { ...estado, anfitrion: yo.id, jugadores: quedan, version: estado.version + 1 };
          soyAnfitrion = true;
          if (estado.fase === 'eligiendo') estado.hasta = reloj.ahora() + SEGUNDOS_ELEGIR * 1000;   // tiempo nuevo, justo
          publicar();
        }
      }
    }
  });
  // un pedido: el anfitrión lo aplica directo; los demás se lo mandan
  function pedir(p) {
    if (soyAnfitrion) aplicar(yo.id, p);
    else canal.enviar({ tipo: 'pedido', de: yo.id, pedido: p });
  }
  const enviarOrig = canal.enviar.bind(canal);
  canal.enviar = m => enviarOrig({ ...m, de: m.de || yo.id });
  vigilar();
  if (soyAnfitrion) publicar(); else { canal.enviar({ tipo: 'hola' }); pedir({ tipo: 'unirse', nombre: yo.nombre }); }

  return {
    get estado() { return vista(); },
    alCambiar(f) { oyentes.add(f); if (estado) f(vista()); return () => oyentes.delete(f); },
    agregar: ({ copa, fila }) => pedir({ tipo: 'agregar', copa, fila }),
    quitar: id => pedir({ tipo: 'quitar', id }),
    mover: (id, d) => pedir({ tipo: 'mover', id, d }),
    empezar: () => pedir({ tipo: 'empezar' }),
    confirmar: () => pedir({ tipo: 'confirmar' }),
    entrarEnLaSiguiente: () => pedir({ tipo: 'siguiente' }),
    irALaSala: () => pedir({ tipo: 'irSala' }),
    terminoCarrera: () => pedir({ tipo: 'termino' }),
    salir() { canal.enviar({ tipo: 'adios' }); salio = true; if (tic) reloj.parar(tic); tic = 0; oyentes.clear(); canal.cerrar?.(); },
  };
}

// Un bus en memoria (para el banco y para probar en una sola página): cada canal recibe lo que mandan los demás
export function crearBus() {
  const canales = new Set();
  return {
    canal() {
      const c = { oyente: null, enviar(m) { const copia = JSON.parse(JSON.stringify(m)); for (const o of canales) if (o !== c && o.oyente) queueMicrotask(() => o.oyente(copia)); },
                  alRecibir(f) { c.oyente = f; }, cerrar() { canales.delete(c); } };
      canales.add(c);
      return c;
    },
  };
}
