// Precalentar los pipelines de WebGPU: recordar qué "programas de dibujo" usa el juego y pedirlos al arrancar.
//
// Resumen: cada combinación de efectos que el juego dibuja (mezcla de colores, texturas, niebla…) necesita un
// "pipeline", que la tarjeta de video compila la primera vez (~25 ms cada uno en Chrome/Windows). Al entrar a una
// pista aparecen 50–80 nuevos de golpe. aurora (pipeline_cache.cpp, parche) los pide en segundo plano y lleva una
// lista de los que se usaron. Este módulo:
//   1. al abrir la página, lee la lista de este navegador (IndexedDB) y la "semilla" del servidor (una lista
//      armada jugando, que se sirve junto al .wasm), y las deja como archivos para aurora antes de main();
//   2. aurora pone todos esos en la cola y los pide en segundo plano en el primer segundo (precalentado), así ya
//      están compilados cuando el juego los necesita;
//   3. mientras se juega, cada 10 s (y al esconder la pestaña) pregunta cuántos hay en la lista; si creció, la
//      guarda en IndexedDB para la próxima visita.
//
// Formato de la lista (lo arma aurora): "MKWPIPE1", u32 cantidad, y por cada pipeline u32 tipo, u32 versión,
// u32 primer cuadro, u32 tamaño y los bytes de su configuración. Son solo descripciones de cómo dibujar (no
// contienen imágenes ni código del juego), pero salen del juego: la semilla va con el .wasm (R2), nunca a git.

const MAGIA = 'MKWPIPE1';
const CARPETA = '/datos/pipelines';            // donde aurora las busca (web_cargar_listas)

// Cuántos pipelines trae una lista, o -1 si no es una lista válida.
export function contarLista(bytes) {
  if (!bytes || bytes.length < 12) return -1;
  for (let i = 0; i < 8; i++) if (bytes[i] !== MAGIA.charCodeAt(i)) return -1;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
}

// IndexedDB con promesas: una base con un almacén y una clave ("propia" = la lista de este navegador)
function abrirBase(idb, nombre) {
  return new Promise((listo, falla) => {
    const pedido = idb.open(nombre, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('listas');
    pedido.onsuccess = () => listo(pedido.result);
    pedido.onerror = () => falla(pedido.error);
  });
}
function operar(base, modo, accion) {
  return new Promise((listo, falla) => {
    const tx = base.transaction('listas', modo);
    const pedido = accion(tx.objectStore('listas'));
    tx.oncomplete = () => listo(pedido.result);
    tx.onerror = () => falla(tx.error);
  });
}

export function crearPipelines({
  indexedDB = globalThis.indexedDB,              // en el banco se puede dar otro
  buscar = (...a) => globalThis.fetch(...a),
  urlSemilla = '/build/pipelines.bin',
  base = 'mkw-pipelines',
  cadaMs = 10000,
  documento = globalThis.document,
} = {}) {
  const estado = { semilla: 0, propia: 0, guardadas: 0, vecesGuardada: 0, error: '' };
  let reloj = null, ultimoConteo = -1, modulo = null, alEsconder = null;
  const basePromesa = () => abrirBase(indexedDB, base);

  // 1) Leer las dos listas (si falla algo, se sigue sin precalentar: el juego anda igual)
  async function cargar() {
    const [semilla, propia] = await Promise.all([
      buscar(urlSemilla).then(async r => r.ok ? new Uint8Array(await r.arrayBuffer()) : null).catch(() => null),
      basePromesa().then(b => operar(b, 'readonly', a => a.get('propia')).finally(() => b.close()))
        .then(v => v ? new Uint8Array(v) : null).catch(e => { estado.error = String(e); return null; }),
    ]);
    estado.semilla = Math.max(0, contarLista(semilla));
    estado.propia = Math.max(0, contarLista(propia));
    return { semilla: contarLista(semilla) >= 0 ? semilla : null, propia: contarLista(propia) >= 0 ? propia : null };
  }

  // 2) Dejarlas como archivos para aurora (en el preRun, antes de main)
  function escribir(FS, { semilla, propia } = {}) {
    FS.mkdirTree(CARPETA);
    if (semilla) FS.writeFile(CARPETA + '/semilla.bin', semilla);
    if (propia) FS.writeFile(CARPETA + '/propia.bin', propia);
  }

  // La lista actual de aurora, copiada fuera de la memoria del juego
  function exportar(M = modulo) {
    const tam = M._mkw_web_pipelines_armar();
    const p = M._mkw_web_pipelines_datos();
    return M.HEAPU8.slice(p, p + tam);
  }

  // 3) Guardar si creció desde la última vez (devuelve true si guardó); forzar: guardar aunque no haya crecido
  async function guardarAhora(M = modulo, forzar = false) {
    if (!M) return false;
    const n = M._mkw_web_pipelines_cuantos();
    if (n === 0 || (n === ultimoConteo && !forzar)) return false;
    const bytes = exportar(M);
    const anterior = ultimoConteo;
    ultimoConteo = n;                  // antes de esperar: el reloj y el "esconder" no guardan lo mismo dos veces
    try {
      const b = await basePromesa();
      try { await operar(b, 'readwrite', a => a.put(bytes.buffer, 'propia')); } finally { b.close(); }
      estado.guardadas = n; estado.vecesGuardada++; estado.error = '';
      return true;
    } catch (e) { ultimoConteo = anterior; estado.error = String(e); return false; }
  }

  function vigilar(M) {
    modulo = M;
    ultimoConteo = M._mkw_web_pipelines_cuantos();     // lo cargado al arrancar ya está guardado
    reloj = setInterval(() => guardarAhora(), cadaMs);
    alEsconder = () => { if (documento.hidden) guardarAhora(); };
    documento?.addEventListener('visibilitychange', alEsconder);
  }

  function detener() {
    clearInterval(reloj); reloj = null;
    if (alEsconder) documento?.removeEventListener('visibilitychange', alEsconder);
  }

  return { estado, cargar, escribir, exportar, guardarAhora, vigilar, detener };
}
