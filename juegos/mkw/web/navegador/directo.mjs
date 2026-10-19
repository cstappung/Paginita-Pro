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

// Secciones del juego (Pulsar, Identifiers.hpp)
export const SECCION_DIRECTA = { menuPrincipal: 0x41, unjugador: 0x48, local: 0x54, enlinea: 0x55 };
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
};

// La base de Mii del sistema de archivos del juego (antes de arrancar). Devuelve el Mii para una licencia nueva:
// { createId: 8 bytes (id del Mii + id de la consola), nombre: 20 bytes UTF-16 big-endian, nueva: base que hay que
// guardar o null }.
export function prepararMii(FS, nombre = 'Piloto') {
  let bytes = null;
  try { bytes = FS.readFile(RUTA_RFLDB); } catch {}
  const base = bytes ? leerBase(bytes) : { valida: false, mii: [] };
  let mii = base.valida && base.mii.length ? base.mii[0].mii : null, nueva = null;
  if (!mii) {
    mii = miiDesdePreset(0, { nombre: String(nombre || 'Piloto').slice(0, 10) });
    nueva = armarBase([mii], base.valida ? bytes : null);
    FS.mkdirTree(RUTA_RFLDB.slice(0, RUTA_RFLDB.lastIndexOf('/')));
    FS.writeFile(RUTA_RFLDB, nueva);
  }
  const nom = new Uint8Array(20);
  for (let k = 0; k < 10 && k < mii.nombre.length; k++) { const c = mii.nombre.charCodeAt(k); nom[2 * k] = c >> 8; nom[2 * k + 1] = c & 0xFF; }
  return { createId: Uint8Array.from([...mii.id, ...mii.consola]), nombre: nom, nueva };
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
  async function ir(seccion, { licencia = 0, tope = 60000 } = {}) {
    if (!M._mkw_directo_ir) return false;
    const t0 = performance.now();
    while (performance.now() - t0 < tope) {
      const e = lector.estado();
      if (e.seccion === seccion && e.pagina >= 0) return true;
      // (primero la sección: antes de que arranque el main del juego, la memoria de la Wii no existe y leerla falla)
      if (e.seccion > 0 && e.siguiente === -1 && M._mkw_directo_listo()) break;
      await espera(50);
    }
    hecho = null;
    M._mkw_directo_ir(seccion, licencia);
    while (performance.now() - t0 < tope) {
      if (hecho && !hecho.ok) return false;
      const e = lector.estado();
      if (e.seccion === seccion && e.pagina >= 0) return true;      // la sección ya con su página (no solo cargando)
      await espera(50);
    }
    return false;
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
  return { ir, boton, ponerMii, paginaArriba };
}
