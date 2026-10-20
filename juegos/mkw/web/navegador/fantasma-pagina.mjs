// La Contrarreloj contra el mejor fantasma de la página (pedido del dueño, bitácora §92).
//
// Resumen: cada vez que alguien con sesión en el sitio bate su récord de Contrarreloj, su fantasma (el .rkg que graba
// el juego: sus botones de esa vuelta) se sube a Firebase Storage, en mkw/fantasmas/<pista>-<categoría>/<uid>.rkg.
// Cuando cualquiera abre la pantalla de fantasmas de esa pista (página 0x71 del juego), la página busca la tabla de
// récords de esa pista (los mejores tiempos, de Firebase) y baja el fantasma del mejor que tenga uno; se lo pasa al
// juego (fantasma_pagina_nativo.cpp), que lo pone en lugar del de Retro Rewind al elegir «correr contra el fantasma».
//   1. SUBIR (alTerminar): después de un récord nuevo en la nube, busca el .rkg que Pulsar acaba de escribir en la
//      carpeta del mod (Ghosts/<crc32>/<150|200>/<m>m<ss>s<mmm>.rkg, con el tiempo de la vuelta en el nombre) y lo sube.
//   2. BAJAR (alActivarPagina): en la página de fantasmas, mira la pista y el modo que eligió la persona, pide la tabla
//      (top 10) y prueba los fantasmas en orden de tiempo hasta que uno baja; lo copia a la memoria del juego.
// Solo 150cc y 200cc normales (con pluma, la categoría de los récords no se distingue: ahí no se sube ni se usa).
// Firebase entra por el mismo almacén de los récords (records.mjs) con dos funciones más: fantasmaSubir(k, uid, bytes)
// y fantasmaBajar(k, uid) → bytes o null. El banco usa uno falso (banco/pruebas/fantasma-pagina).
//
// Uso:  const f = crearFantasmaPagina({ lector, modulo, fs, carpetaMod, aviso });  f.conectar({ almacen, uid })
//       f.alTerminar(carrera)   (la de records.leerCarrera, después de registrar)    f.alActivarPagina(idPagina)

export const PAGINA_FANTASMAS = 0x71;
const CARPETAS_MODO = ['150', '200'];                                   // System::ttModeFolders (2 y 3 = con pluma: no)
const MAX_RKG = 0x2800;

// El nombre que le da Pulsar al .rkg de una vuelta (CreateAndSaveFiles): «1m07s873.rkg»; si ya había otro con el
// mismo tiempo, «1m07s87a.rkg» (centésimas + una letra). Devuelve una expresión que acepta los dos.
export function patronNombre(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, mil = ms % 1000;
  const ss = String(s).padStart(2, '0');
  return new RegExp(`^${m}m${ss}s(${String(mil).padStart(3, '0')}|${String(Math.floor(mil / 10)).padStart(2, '0')}[A-Za-z@])\\.rkg$`);
}

// La categoría de récords (records.mjs) que corresponde al modo de Contrarreloj de Pulsar, o '' si no va
export const categoriaDeModo = modo => (modo === 0 ? 'tt150' : modo === 1 ? 'tt200' : '');

// El tiempo que trae un .rkg en su cabecera (bytes 4-6: 7 bits minutos, 7 bits segundos, 10 bits milésimas)
export function tiempoRkg(b) {
  if (!b || b.length < 8 || String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'RKGD') return 0;
  const min = b[4] >> 1, seg = ((b[4] & 1) << 6) | (b[5] >> 2), mil = ((b[5] & 3) << 8) | b[6];
  return min * 60000 + seg * 1000 + mil;
}

export function crearFantasmaPagina({ lector, modulo, fs, carpetaMod, aviso = () => {}, nota = () => {}, espera = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let almacen = null, uid = '';
  const estado = { subidos: 0, puestos: 0, ultimo: null, error: '' };
  const cache = new Map();                                // clave → { bytes, nombre, ms } | null (en esta visita)
  // (Pulsar vive en 0x818…, fuera del alcance del lector de la página: los lee el juego, fantasma_pagina_nativo.cpp)
  const modoActual = () => (modulo._mkw_fantasma_pagina_modo ? modulo._mkw_fantasma_pagina_modo() | 0 : -1);
  const pistaActual = () => (modulo._mkw_fantasma_pagina_pista ? modulo._mkw_fantasma_pagina_pista() | 0 : -1);

  // los .rkg de la carpeta del mod para ese modo: [{ ruta, nombre, cuando }]
  function rkgsDe(carpetaModo) {
    const lista = [], fantasmas = `${carpetaMod}/Ghosts`;
    let pistas = [];
    try { pistas = fs.readdir(fantasmas).filter(n => n !== '.' && n !== '..'); } catch { return lista; }
    for (const p of pistas) {
      const dir = `${fantasmas}/${p}/${carpetaModo}`;
      let nombres = [];
      try { nombres = fs.readdir(dir); } catch { continue; }
      for (const n of nombres) if (n.endsWith('.rkg')) { try { lista.push({ ruta: `${dir}/${n}`, nombre: n, cuando: +fs.stat(`${dir}/${n}`).mtime }); } catch {} }
    }
    return lista;
  }

  // 1) Subir el fantasma de un récord nuevo (carrera = { pista, cat, ms, modo }, ya registrada y subida a la tabla)
  async function alTerminar(carrera) {
    if (!almacen?.fantasmaSubir || !uid || carrera.modo !== 'tt') return false;
    const modo = modoActual(), cat = categoriaDeModo(modo);
    if (!cat || cat !== carrera.cat) return false;        // con pluma (o algo raro): no
    const patron = patronNombre(carrera.ms), desde = Date.now() - 60000;
    // Pulsar lo escribe en su tarea de fondo, un momento después de la meta
    for (let i = 0; i < 30; i++) {
      const hay = rkgsDe(CARPETAS_MODO[modo]).filter(x => patron.test(x.nombre) && x.cuando >= desde).sort((a, b) => b.cuando - a.cuando);
      if (hay.length) {
        const bytes = fs.readFile(hay[0].ruta);
        if (bytes.length > MAX_RKG || !tiempoRkg(bytes)) return false;   // (el nombre ya dice el tiempo)
        const k = `${carrera.pista.toString(16)}-${cat}`;
        try { await almacen.fantasmaSubir(k, uid, bytes); } catch (e) { estado.error = String(e.code || e.message); return false; }
        estado.subidos++;
        cache.delete(k);
        nota(`fantasma subido: ${k} (${bytes.length} bytes, ${hay[0].nombre})`);
        return true;
      }
      await espera(500);
    }
    return false;
  }

  // 2) Bajar el del mejor de la página para la pista y el modo de ahora, y dejarlo en el juego
  async function preparar() {
    if (!almacen?.fantasmaBajar || !almacen.top) return null;
    const pista = pistaActual(), modo = modoActual(), cat = categoriaDeModo(modo);
    if (!(pista >= 0x100) || !cat) { modulo._mkw_fantasma_pagina_poner?.(0, 0, 0); return null; }
    const k = `${pista.toString(16)}-${cat}`;
    let elegido = cache.get(k);
    if (elegido === undefined) {
      elegido = null;
      try {
        for (const fila of await almacen.top(k, 10)) {
          const bytes = await almacen.fantasmaBajar(k, fila.uid).catch(() => null);
          if (bytes && bytes.length <= MAX_RKG && tiempoRkg(bytes) > 0) { elegido = { bytes, nombre: fila.nombre || 'Piloto', ms: tiempoRkg(bytes), uid: fila.uid }; break; }
        }
      } catch (e) { estado.error = String(e.code || e.message); }
      cache.set(k, elegido);
    }
    if (!elegido || pistaActual() !== pista || modoActual() !== modo) { modulo._mkw_fantasma_pagina_poner?.(0, 0, 0); return null; }
    modulo.HEAPU8.set(elegido.bytes, modulo._mkw_fantasma_pagina_bufer());
    modulo._mkw_fantasma_pagina_poner(elegido.bytes.length, pista, modo);
    estado.puestos++; estado.ultimo = { k, nombre: elegido.nombre, ms: elegido.ms, uid: elegido.uid };
    aviso(elegido);
    return elegido;
  }

  return {
    estado,
    conectar(o) { ({ almacen, uid } = { almacen, uid, ...o }); cache.clear(); },
    alTerminar,
    preparar,
    alActivarPagina(id) { if (id === PAGINA_FANTASMAS) return preparar(); return null; },
  };
}
