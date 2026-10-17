// Copias de respaldo automáticas de las partidas — bitácora §55.
//
// Resumen: antes de cualquier cosa que reemplace la partida (cargar un rksys.dat o un paquete, borrar todo, traer la
// partida de la nube encima de la local, guardar un Mii nuevo), la página saca una "foto" de TODO lo guardado (el
// mismo paquete .mkwp de guardado.mjs: gzip, unos pocos KB) y la guarda aparte, en otra base de IndexedDB
// ("mkw-respaldos"). Así un error ("cargué el archivo equivocado") se deshace con un clic en "Copias de respaldo".
// Se quedan las últimas MAX copias; las más viejas se borran solas. Cada copia lleva cuándo, por qué y qué licencias
// tenía (para que la lista diga "17:42 · antes de cargar rksys.dat · Juan, Ana" sin tener que abrir el paquete).
//
// Uso:  const r = crearRespaldos();
//       await r.guardar(blobPaquete, 'antes de cargar rksys.dat', [{nombre:'Juan', vr:5230}]);
//       const lista = await r.lista();     // [{id, fecha, motivo, licencias}], la más nueva primero
//       const blob = await r.leer(id);     // para guardado.importar(blob)

export function crearRespaldos({ base = 'mkw-respaldos', almacen = 'copias', max = 8, idb = globalThis.indexedDB } = {}) {
  let db = null;
  const promesa = p => new Promise((bien, mal) => { p.onsuccess = () => bien(p.result); p.onerror = () => mal(p.error); });
  const terminada = tx => new Promise((bien, mal) => { tx.oncomplete = bien; tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error); });
  async function abrir() {
    if (db) return db;
    const p = idb.open(base, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(almacen, { keyPath: 'id', autoIncrement: true });   // id = 1, 2, 3…
    return (db = await promesa(p));
  }
  const os = async modo => { const tx = (await abrir()).transaction(almacen, modo); return [tx, tx.objectStore(almacen)]; };

  async function guardar(blob, motivo, licencias = []) {
    // el paquete va como bytes (no como Blob) para que funcione igual en todos los navegadores
    const datos = new Uint8Array(await blob.arrayBuffer());
    const [tx, o] = await os('readwrite');
    o.add({ fecha: Date.now(), motivo, licencias: licencias.map(l => ({ nombre: l.nombre, vr: l.vr || 0 })), datos });
    await terminada(tx);
    // recortar: quedan solo las últimas `max`
    const [tx2, o2] = await os('readwrite');
    const claves = await promesa(o2.getAllKeys());
    for (const k of claves.slice(0, Math.max(0, claves.length - max))) o2.delete(k);
    await terminada(tx2);
  }
  async function lista() {
    const [, o] = await os('readonly');
    const todas = await promesa(o.getAll());
    return todas.map(({ id, fecha, motivo, licencias, datos }) => ({ id, fecha, motivo, licencias, bytes: datos.byteLength })).reverse();
  }
  async function leer(id) {
    const [, o] = await os('readonly');
    const v = await promesa(o.get(id));
    return v ? new Blob([v.datos]) : null;
  }
  async function borrarTodas() { const [tx, o] = await os('readwrite'); o.clear(); await terminada(tx); }
  return { guardar, lista, leer, borrarTodas };
}
