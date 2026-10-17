// Partidas guardadas en el navegador (IndexedDB): que la licencia, los ajustes y los fantasmas sobrevivan a cerrar
// la página.
//
// Resumen: el juego escribe sus archivos en un sistema de archivos de mentira que vive en la memoria de la página
// (MEMFS, ver mkw.mjs) y se borra al cerrarla. Este módulo:
//   1. al abrir la página, lee de IndexedDB (la base de datos del navegador, en el disco del usuario) los archivos
//      guardados la vez anterior y, antes de que arranque el juego, los vuelve a poner en su lugar (restaurar);
//   2. mientras se juega, se "engancha" a tres funciones del sistema de archivos: cerrar un archivo que se escribió,
//      renombrar y borrar. Cada vez que pasa eso en una carpeta de partidas, anota el archivo y, medio segundo
//      después del último cambio (para no guardar a medias si el juego escribe en varios pasos), lo copia a
//      IndexedDB. Sin revisar miles de archivos cada tanto: solo se mira lo que el juego toca.
//   3. al esconder o cerrar la pestaña, guarda enseguida lo que esté pendiente.
//
// Qué se guarda (lo que escribe el juego, medido con guion.mjs --listar al crear una licencia):
//   /mkw/sd/riivolution/save/...      la partida de Retro Rewind (rksys.dat: licencias, récords) y su banner
//   /datos/WiiCompiled/NAND/...       la memoria interna de la Wii: ajustes de RR (shared2/Pulsar/RetroRewind6/*.pul:
//                                     ajustes, trofeos, VR), ajustes de la consola
//   /mkw/sd/RetroRewind6/...          lo que el juego cree ahí (fantasmas guardados, ajustes en la SD)
// No se guardan archivos temporales (*.tmp) ni Config.toml (lo arma la página cada vez).
//
// Uso:  const g = crearGuardado();  const guardados = await g.cargar();   (antes de crear el juego)
//       en preRun: g.restaurar(FS, guardados);  después: g.vigilar(FS);
//       g.estado (para mostrar), await g.borrarTodo(), await g.guardarPendientes()

export const CARPETAS = ['/mkw/sd/riivolution/save/', '/datos/WiiCompiled/NAND/', '/mkw/sd/RetroRewind6/'];
const EXCLUIR = [/\.tmp$/i, /Config\.toml$/i];
const O_ACCMODE = 3;   // los 2 bits de "cómo se abrió": 0 = solo leer, 1 = escribir, 2 = leer y escribir

export function crearGuardado({ base = 'mkw-partidas', almacen = 'archivos', esperaMs = 500, alCambiar = null,
                                idb = globalThis.indexedDB } = {}) {
  const estado = { archivos: 0, bytes: 0, guardadosEstaSesion: 0, ultimoGuardado: 0, restaurados: 0, error: '' };
  const pendientes = new Set();          // rutas cambiadas que todavía no se copiaron a IndexedDB
  const borrados = new Set();            // rutas que el juego borró (hay que sacarlas de IndexedDB)
  let FS = null, temporizador = 0, db = null;
  const avisar = () => { if (alCambiar) alCambiar(estado); };
  const interesa = ruta => typeof ruta === 'string' && CARPETAS.some(c => ruta.startsWith(c)) && !EXCLUIR.some(r => r.test(ruta));

  // IndexedDB habla por eventos; esto lo convierte en promesas (await)
  const promesa = pedido => new Promise((bien, mal) => { pedido.onsuccess = () => bien(pedido.result); pedido.onerror = () => mal(pedido.error); });
  async function abrir() {
    if (db) return db;
    const pedido = idb.open(base, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(almacen);   // clave = ruta del archivo
    db = await promesa(pedido);
    return db;
  }
  const transaccion = async modo => (await abrir()).transaction(almacen, modo);
  const terminada = tx => new Promise((bien, mal) => { tx.oncomplete = bien; tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error); });

  // 1) Leer lo guardado: Map ruta → { datos: Uint8Array, mtime }
  async function cargar() {
    const tx = await transaccion('readonly');
    const os = tx.objectStore(almacen);
    const [claves, valores] = await Promise.all([promesa(os.getAllKeys()), promesa(os.getAll())]);
    const mapa = new Map(claves.map((k, i) => [k, valores[i]]));
    estado.archivos = mapa.size;
    estado.bytes = valores.reduce((s, v) => s + v.datos.byteLength, 0);
    avisar();
    return mapa;
  }

  // Volver a poner los archivos en el sistema de archivos del juego (antes de su main)
  function restaurar(fs, mapa) {
    for (const [ruta, { datos, mtime }] of mapa) {
      fs.mkdirTree(ruta.slice(0, ruta.lastIndexOf('/')));
      try { fs.unlink(ruta); } catch {}          // si había uno (p. ej. el que trae el servidor), lo reemplaza
      fs.writeFile(ruta, datos);
      if (mtime) try { fs.utime(ruta, mtime, mtime); } catch {}
    }
    estado.restaurados = mapa.size;
    avisar();
  }

  // 2) Engancharse a cerrar / renombrar / borrar del sistema de archivos
  function vigilar(fs) {
    FS = fs;
    const cerrar = fs.close, renombrar = fs.rename, borrar = fs.unlink;
    fs.close = function (stream) {
      const escribia = stream && (stream.flags & O_ACCMODE) !== 0;
      const ruta = stream && stream.path;
      const r = cerrar.apply(this, arguments);
      if (escribia && interesa(ruta)) anotar(ruta);
      return r;
    };
    fs.rename = function (de, a) {
      const r = renombrar.apply(this, arguments);
      if (interesa(de)) { borrados.add(de); pendientes.delete(de); programar(); }
      if (interesa(a)) anotar(a);
      return r;
    };
    fs.unlink = function (ruta) {
      const r = borrar.apply(this, arguments);
      if (interesa(ruta)) { borrados.add(ruta); pendientes.delete(ruta); programar(); }
      return r;
    };
    // 3) Al esconder o cerrar la pestaña: guardar ya
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarPendientes(); });
    addEventListener('pagehide', () => guardarPendientes());
  }
  function anotar(ruta) { pendientes.add(ruta); borrados.delete(ruta); programar(); }
  function programar() { clearTimeout(temporizador); temporizador = setTimeout(guardarPendientes, esperaMs); }

  // Copiar a IndexedDB lo pendiente (y sacar lo borrado), todo en una sola transacción
  async function guardarPendientes() {
    clearTimeout(temporizador);
    if (!FS || (!pendientes.size && !borrados.size)) return 0;
    const rutas = [...pendientes], fuera = [...borrados];
    pendientes.clear(); borrados.clear();
    try {
      const tx = await transaccion('readwrite');
      const os = tx.objectStore(almacen);
      for (const ruta of rutas) {
        let datos, mtime;
        try { datos = FS.readFile(ruta); mtime = FS.stat(ruta).mtime.getTime(); } catch { continue; }   // ya no existe
        os.put({ datos, mtime }, ruta);
      }
      for (const ruta of fuera) os.delete(ruta);
      await terminada(tx);
      estado.guardadosEstaSesion += rutas.length;
      estado.ultimoGuardado = Date.now();
      estado.error = '';
      const total = await promesa((await transaccion('readonly')).objectStore(almacen).count());
      estado.archivos = total;
    } catch (e) {
      estado.error = String(e && e.message || e);
      rutas.forEach(r => pendientes.add(r)); fuera.forEach(r => borrados.add(r));   // se reintenta la próxima vez
    }
    avisar();
    return rutas.length;
  }

  // Después de borrar o importar, el guardado automático queda quieto hasta recargar: si no, al cerrar la pestaña
  // podría volver a escribir encima la partida vieja que el juego todavía tiene en memoria.
  function detener() { FS = null; pendientes.clear(); borrados.clear(); clearTimeout(temporizador); }

  async function borrarTodo() {
    detener();
    const tx = await transaccion('readwrite');
    tx.objectStore(almacen).clear();
    await terminada(tx);
    Object.assign(estado, { archivos: 0, bytes: 0 });
    avisar();
  }

  // Pedirle al navegador que no borre estos datos solo cuando le falte espacio ("almacenamiento persistente")
  async function pedirPersistencia() {
    try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
  }

  // ---- Paquete: todas las partidas en un solo archivo comprimido ----
  // Para pasarlas a otro navegador (descargar / cargar) y, en el sitio, para subirlas a Firebase Storage
  // (mkw/<uid>/partidas.mkwp: un solo objeto por persona; las reglas dejan leerlo y pisarlo solo a su dueño).
  // Formato: "MKWP" + versión (1 byte) + largo del índice (4 bytes) + índice JSON [{ruta, tam, mtime}] + los datos
  // seguidos; todo comprimido con gzip (rksys.dat son 2,8 MB casi todos ceros: queda en unos pocos KB).
  async function exportar() {
    await guardarPendientes();
    const mapa = await cargar();
    const indice = [...mapa].map(([ruta, v]) => ({ ruta, tam: v.datos.byteLength, mtime: v.mtime || 0 }));
    const json = new TextEncoder().encode(JSON.stringify(indice));
    const cabeza = new Uint8Array(9);
    cabeza.set([0x4d, 0x4b, 0x57, 0x50, 1]);                       // "MKWP", versión 1
    new DataView(cabeza.buffer).setUint32(5, json.length, true);
    const partes = [cabeza, json, ...[...mapa.values()].map(v => v.datos)];
    const crudo = new Blob(partes);
    return new Response(crudo.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  // Reemplaza TODO lo guardado por el contenido del paquete (después hay que recargar la página)
  async function importar(blob) {
    let bytes;
    try { bytes = new Uint8Array(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
    catch { throw new Error('no es un paquete de partidas de MKW'); }   // no está comprimido con gzip
    if (bytes.length < 9 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MKWP' || bytes[4] !== 1) throw new Error('no es un paquete de partidas de MKW');
    const largo = new DataView(bytes.buffer, bytes.byteOffset).getUint32(5, true);
    const indice = JSON.parse(new TextDecoder().decode(bytes.subarray(9, 9 + largo)));
    // Primero se revisa TODO el paquete; recién si está bien se reemplaza lo guardado (un paquete roto no borra nada)
    let p = 9 + largo;
    const archivos = [];
    for (const { ruta, tam, mtime } of indice) {
      if (!interesa(ruta)) throw new Error('ruta fuera de las carpetas de partidas: ' + ruta);   // no puede escribir en cualquier lado
      if (!Number.isInteger(tam) || tam < 0 || p + tam > bytes.length) throw new Error('paquete cortado o dañado');
      archivos.push([ruta, { datos: bytes.slice(p, p + tam), mtime: Number(mtime) || 0 }]);
      p += tam;
    }
    if (p !== bytes.length) throw new Error('paquete con bytes de más');
    detener();                                                     // recién ahora: el paquete está bien
    const tx = await transaccion('readwrite');
    const os = tx.objectStore(almacen);
    os.clear();
    for (const [ruta, valor] of archivos) os.put(valor, ruta);
    await terminada(tx);
    await cargar();
    return indice.length;
  }

  return { estado, cargar, restaurar, vigilar, guardarPendientes, borrarTodo, pedirPersistencia, interesa, exportar, importar,
           get pendientes() { return pendientes.size + borrados.size; } };
}
