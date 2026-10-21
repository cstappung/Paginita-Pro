// Abrir directo una pantalla del juego, por código (sin cortina ni botones apretados por detrás) — bitácora §71.
//
// Resumen: el dueño pidió que «saltar la interfaz» sea abrir la pantalla de una, usando el código del juego. Esta es la
// mitad de la página; la otra mitad es web/juego/directo_nativo.cpp (adentro del juego):
//   1. Antes de arrancar (prepararMii): que la base de Mii de la Wii (RFL_DB.dat) tenga al menos un Mii. Si está vacía
//      se pone uno nuestro con el nombre de la persona (y se guarda, para que la próxima vez sea el mismo).
//   2. Con el juego andando (crearDirecto → ir): apenas el juego leyó el archivo de guardado, se le pide la sección
//      (el menú de un jugador, el modo en línea…). El juego elige la licencia 1 como lo haría la pantalla de licencias
//      (y si la partida es nueva, la CREA con ese Mii, como «Crear licencia») y cambia de sección con sus propias
//      funciones (SetNextSection + RequestSceneChange).
//   3. boton(): la acción de un botón del juego, llamada directo (la misma función que corre cuando alguien lo aprieta),
//      p. ej. «Mundial» en el menú Wi-Fi. No es apretar un botón del mando: es llamar a esa función.
// Como un conmutador de canales: en vez de apretar «siguiente» diez veces, se marca el número.
//
// Uso:  preRun: prepararMii(FS, 'Ana') → { createId, nombre }   (luego directo.ponerMii(eso))
//       const directo = crearDirecto({ M, lector });  await directo.ir(SECCION_DIRECTA.unjugador)  → true/false
import { leerBase, armarBase, miiDesdePreset, RUTA_RFLDB } from './mii.mjs';
import { miiDeInvitado } from './invitados.mjs';
import { armarPlantel } from './lockstep.mjs';
import { aplicarPerfilCpu } from './dificultad-cpu.mjs';

// Secciones del juego (Pulsar, Identifiers.hpp)
export const SECCION_DIRECTA = { presentacionVs: 0x1A, carreraVs: 0x20, elegirPersonaje: 0x49, menuPrincipal: 0x41, unjugador: 0x48, local: 0x54, enlinea: 0x55 };
// Acciones de botones que el juego deja llamar directo (la lista de directo_nativo.cpp): función y dónde está el botón
// dentro de su página (Pulsar: WFCConnect.hpp, WFCMenu.hpp)
export const BOTON = {
  cartel: { pagina: 0x4D, funcion: 0x805F8F54, boton: null },        // un cartel que se cierra con A (Click::OnClick(mando 0))
  avisoDatos: { pagina: 0x85, funcion: 0x80648404, boton: 0x578 },    // el aviso de datos de Nintendo WFC → Siguiente
  usarWfc: { pagina: 0x86, funcion: 0x80648AFC, boton: 0x58C },       // «¿Conectarse a Nintendo WFC?» → Sí
  mundial: { pagina: 0x8B, funcion: 0x8064BCE8, boton: 0x230 },       // menú Wi-Fi → Mundial
  amigos: { pagina: 0x8B, funcion: 0x8064BEA0, boton: 0x6D8 },        // menú Wi-Fi → Amigos
  vs: { pagina: 0x8C, funcion: 0x8064C610, boton: 0x208 },            // VS o Batalla → VS
  // Retro WFC como lo abre Retro Rewind (§72): «Main modes» = la sala REGIONAL (la Mundial de Pulsar es solo de pistas
  // de Nintendo) y, en la página de modos, el VS de las retro con la versión de RR (fija la región 0x0A)
  regional: { pagina: 0x8B, funcion: 0x8064BDC4, boton: 0x484 },      // menú Wi-Fi → Regional («Main modes» de RR)
  vsRetros: { pagina: 0x8C, funcion: 0x8183FCC0, boton: 0x208 },      // modos de RR → VS (las retro, región 0x0A)
  // el aviso de desconexión (sección 0x78/0x79, página 0x89): cerrarlo → el juego vuelve al menú principal (§73)
  avisoCorte: { pagina: 0x89, funcion: 0x80649FD8, boton: null },     // DisconnectError::OnClick(mando 0)
};

// La base de Mii del sistema de archivos del juego (antes de arrancar). Devuelve el Mii para una licencia nueva:
// { createId: 8 bytes (id del Mii + id de la consola), nombre: 20 bytes UTF-16 big-endian, nueva: base que hay que
// guardar o null, invitado: 0..5 si el Mii nuevo salió de un invitado del juego (§86) o -1 }.
// §86: con la base vacía, el Mii nuevo es el invitado del juego elegido (invitados = el registro de invitados.mjs,
// guardado en este navegador); si todavía no hay (primera visita), una cara de la página (PRESETS).
export function prepararMii(FS, nombre = 'Piloto', { invitados = null, elegido = 0 } = {}) {
  let bytes = null;
  try { bytes = FS.readFile(RUTA_RFLDB); } catch {}
  const base = bytes ? leerBase(bytes) : { valida: false, mii: [] };
  let mii = base.valida && base.mii.length ? base.mii[0].mii : null, nueva = null, invitado = -1;
  if (!mii) {
    const nombreMii = String(nombre || 'Piloto').slice(0, 10);
    if (invitados) { invitado = elegido; mii = miiDeInvitado(invitados, elegido, { nombre: nombreMii }); }
    else mii = miiDesdePreset(0, { nombre: nombreMii });
    nueva = armarBase([mii], base.valida ? bytes : null);
    FS.mkdirTree(RUTA_RFLDB.slice(0, RUTA_RFLDB.lastIndexOf('/')));
    FS.writeFile(RUTA_RFLDB, nueva);
  }
  const nom = new Uint8Array(20);
  for (let k = 0; k < 10 && k < mii.nombre.length; k++) { const c = mii.nombre.charCodeAt(k); nom[2 * k] = c >> 8; nom[2 * k + 1] = c & 0xFF; }
  return { createId: Uint8Array.from([...mii.id, ...mii.consola]), nombre: nom, nueva, invitado };
}

const PAGINA_ACTIVA = 4;          // Page +0x8: el estado de la página (4 = activa, esperando a la persona)

export function crearDirecto({ M, lector, nota = () => {} }) {
  let hecho = null;                                  // el aviso del juego: { seccion, ok }
  M.mkwAlIrDirecto = (seccion, ok) => { hecho = { seccion, ok: !!ok }; nota(`directo: sección 0x${seccion.toString(16)} ${ok ? 'pedida' : 'NO (sin licencia)'}`); };
  const espera = ms => new Promise(r => setTimeout(r, ms));

  // El Mii para crear la licencia si la partida es nueva (ver prepararMii)
  function ponerMii({ createId, nombre }) {
    if (!M._mkw_directo_mii) return;
    const p = M._mkw_directo_mii();
    M.HEAPU8.set(createId.subarray(0, 8), p);
    M.HEAPU8.set(nombre.subarray(0, 20), p + 8);
  }

  // Ir a la sección: espera a que el juego haya leído el guardado y esté en una pantalla (no en medio de un cambio),
  // pide el salto y espera a que la sección aparezca. licencia: 0..3, o -1 para no tocarla (ya hay una elegida).
  // ficha (§73): la carrera que hay que dejar escrita antes del salto (ver armarFicha); llego(seccion) = cuándo ya está.
  async function ir(seccion, { licencia = 0, tope = 60000, ficha = null, llego = s => s === seccion } = {}) {
    if (!M._mkw_directo_ir) return false;
    const t0 = performance.now();
    const e0 = lector.estado();
    if (!ficha && llego(e0.seccion) && e0.pagina >= 0) return true;
    // §73: el pedido se deja puesto YA (aunque el juego no haya arrancado): el juego mismo espera a haber leído la
    // partida guardada y salta en ese cuadro (directo_nativo.cpp), sin pasar por el título ni las licencias
    hecho = null;
    if (ficha) { escribirFicha(ficha); M._mkw_directo_carrera(seccion, licencia); }
    else M._mkw_directo_ir(seccion, licencia);
    while (performance.now() - t0 < tope) {
      if (hecho && !hecho.ok) return false;
      const e = lector.estado();
      if (hecho && llego(e.seccion) && e.pagina >= 0) return true;  // la sección ya con su página (no solo cargando)
      await espera(50);
    }
    return false;
  }

  // §73: la carrera directa, sin menús: la ficha queda escrita como la dejan los menús del juego (directo_nativo.cpp,
  // escribirFicha) y se salta a la carrera VS (0x20, o 0x21-0x23 con 2-4 pantallas: la cuenta regresiva y a correr).
  // Con ficha.intro: antes la presentación (0x1A, el vuelo sobre la pista ~13 s), que sigue sola a la carrera.
  const carrera = (ficha, opciones = {}) => {
    const locales = Math.min(ficha.pantallas || 4, ficha.puestos.filter(q => q && q.tipo === 0).length);
    const seccion = ficha.intro ? SECCION_DIRECTA.presentacionVs : SECCION_DIRECTA.carreraVs + Math.max(0, Math.min(3, locales - 1));
    return ir(seccion, { ...opciones, ficha, llego: s => s >= 0x1A && s <= 0x23 });
  };
  function escribirFicha(f) {
    aplicarPerfilCpu(M, f.cpu ?? 1);   // M20 (§96): cuánto sube cada perilla de la CPU (cpu_dificultad_nativo.cpp)
    // (con un programa de antes de §96 —sin _mkw_cpu_perfil— el nivel va tal cual a la carrera: «máximo» (3) sería una
    // fila que el juego no tiene; ahí va como su difícil, 2)
    const nivel = Math.min(f.cpu ?? 1, typeof M._mkw_cpu_perfil === 'function' ? 3 : 2);
    const p = M._mkw_directo_ficha() >> 2, H = new Int32Array(M.HEAPU8.buffer);   // (el programa no publica HEAP32)
    H.fill(0, p, p + 64);
    const v = [f.pista, f.variante || 0, f.cc ?? 2, f.espejo ? 1 : 0, nivel, f.objetos || 0, f.modo ?? 1, f.carrera || 0,
               f.carreras || 4, f.semilla?.[0] || 0, f.semilla?.[1] || 0, 0, f.pantallas || 0, f.vueltas || 0, f.primera === false ? 0 : 1, f.intro ? 1 : 0];
    v.forEach((x, i) => { H[p + i] = x | 0; });
    for (let i = 0; i < 12; i++) {
      const q = f.puestos[i] || { tipo: -1 };
      [q.tipo ?? -1, q.personaje ?? -1, q.vehiculo ?? -1, q.mando ?? -1].forEach((x, k) => { H[p + 16 + 4 * i + k] = x | 0; });
    }
  }

  // La acción de un botón del juego (BOTON.mundial…), cuando su página está arriba y ya ACTIVA (Page +0x8 = 4: terminó
  // de entrar; antes, su OnActivate deja todo como al principio y la acción se pierde): la misma función que corre
  // cuando alguien lo aprieta. Devuelve true si se pidió.
  function boton(b) {
    const dir = paginaArriba(b.pagina);
    if (!dir || lector.u32(dir + 8) !== PAGINA_ACTIVA) return false;
    return M._mkw_directo_boton(b.funcion, dir, b.boton == null ? 0 : dir + b.boton) === 1;
  }
  // La dirección del objeto de la página id si es la de arriba (Section +0x354: las páginas activas; +0x37C: cuántas)
  function paginaArriba(id) {
    const sm = lector.u32(0x809C1E38), sec = sm && lector.u32(sm);
    if (!sec) return 0;
    const n = lector.u32(sec + 0x37C);
    const p = n ? lector.u32(sec + 0x354 + 4 * (n - 1)) : 0;
    return p && lector.u32(p + 4) === id ? p : 0;
  }
  // §73: elegir personaje, vehículo y derrape con las pantallas del juego (sección 0x49, que empieza en la de personaje).
  // Al confirmar el derrape el juego NO sigue a la copa: avisa lo elegido (directo_nativo.cpp) y se queda quieto hasta
  // que la página salta a la carrera (carrera(ficha, { licencia: -1 })). Devuelve { abierto, eleccion: Promise<{
  // personaje, vehiculo, derrape }> }.
  async function elegir({ licencia = 0, tope = 60000 } = {}) {
    if (!M._mkw_directo_eleccion) return { abierto: false, eleccion: Promise.resolve(null) };
    M._mkw_directo_eleccion(1);
    const eleccion = new Promise(listo => {
      // (el juego sigue en modo elección hasta el salto a la carrera: otro A en el derrape no se escapa a las copas)
      M.mkwAlElegir = (personaje, vehiculo, derrape) => {
        nota(`directo: eligió personaje ${personaje}, vehículo ${vehiculo}, derrape ${derrape}`);
        listo({ personaje, vehiculo, derrape });
      };
    });
    const abierto = await ir(SECCION_DIRECTA.elegirPersonaje, { licencia, tope });
    return { abierto, eleccion };
  }
  return { ir, carrera, elegir, boton, ponerMii, paginaArriba };
}

// §73: la ficha de una carrera VS. humanos = [{ personaje, vehiculo, mando }] (los de esta consola, mando = su puerto);
// con cpu ≠ 'ninguna' el resto de los 12 puestos son CPU con personaje y vehículo sacados de la semilla (armarPlantel:
// los mismos en todas las consolas con la misma semilla). pista = id de Pulsar (0x100 + 4·copa + fila).
// cc: 'c50' | 'c100' | 'c150' | 'espejo'. cpu: 'facil' | 'normal' | 'dificil' | 'ninguna'.
export function armarFicha({ pista, cc = 'c150', cpu = 'normal', humanos = [{ personaje: 0, vehiculo: 1, mando: 0 }], semilla = 0,
                             carrera = 0, carreras = 4, objetos = 0, primera = carrera === 0, intro = false }) {
  const plantel = armarPlantel({ humanos, semilla: semilla || (Math.random() * 2 ** 32) >>> 0 });   // sin semilla: CPU al azar
  const cuantos = cpu === 'ninguna' ? humanos.length : 12;
  const puestos = plantel.slice(0, cuantos).map(([vehiculo, personaje], i) => (
    i < humanos.length ? { tipo: 0, personaje, vehiculo, mando: humanos[i].mando ?? i } : { tipo: 1, personaje, vehiculo, mando: -1 }));
  const s1 = semilla ? (semilla ^ Math.imul(0x9E3779B9, carrera + 1)) >>> 0 : 0;
  return { pista, cc: { c50: 0, c100: 1, c150: 2, espejo: 2 }[cc] ?? 2, espejo: cc === 'espejo', modo: 1,
           // M20 (§96): el nivel de la página (0 fácil, 1 normal, 2 difícil, 3 máximo); directo_nativo.cpp le da al juego
           // una fila de su tabla un nivel más arriba y cpu_dificultad_nativo.cpp sube «difícil» y «máximo»
           cpu: { facil: 0, normal: 1, dificil: 2, maximo: 3 }[cpu] ?? 1, objetos, carrera, carreras, primera, puestos, intro,
           semilla: s1 ? [s1, Math.imul(s1, 0x85EBCA6B) >>> 0] : null };
}
