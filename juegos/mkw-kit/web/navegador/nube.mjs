// Partidas en la nube (Firebase Storage): la misma partida en cualquier computador o celular donde la persona entre
// con su cuenta de Google en el sitio.
//
// Resumen: las partidas ya se guardan solas en el navegador (guardado.mjs, IndexedDB) y se pueden empaquetar en un
// solo archivo comprimido (.mkwp). Este módulo sube ese paquete a Firebase Storage, en mkw/<uid>/partidas.mkwp (un
// objeto por persona), y lo baja en otro navegador. Para decidir qué hacer sin bajar nada de más, cada paquete lleva
// una HUELLA (SHA-256 del contenido de los archivos: cambia si cambia un solo byte) y la hora en que se subió, en los
// metadatos del objeto. Este navegador recuerda la huella de la última vez que quedó igual que la nube
// (localStorage "mkw.nube.<uid>"). Con eso, al entrar:
//
//   local \ nube          no hay nada          igual a la última vez       cambió (otro aparato subió)
//   no hay nada           nada                 bajar                       bajar
//   igual a la última     subir                nada                        bajar
//   cambió (se jugó)      subir                subir                       CONFLICTO: gana la más nueva y la otra
//                                                                           queda de respaldo para descargarla
//
// Como un control de versiones de un solo archivo: nunca se pisa una partida sin quedarse con una copia.
//
// Mientras se juega, cada vez que guardado.mjs guarda algo, se sube el paquete unos segundos después (espera para
// juntar varias escrituras y no subir en cada una) y nunca más de una vez cada 30 s. Al esconder la pestaña se
// intenta subir enseguida lo pendiente.
//
// Firebase entra solo por un "almacén" de tres funciones (meta, bajar, subir). almacenFirebase() lo arma con el SDK
// del sitio (el mismo de juegos/hero/js/cloud.js: firebase-storage 10.12.2 del CDN de Google); el banco de pruebas
// usa uno falso que además imita las reglas de Storage. Así todo se prueba sin Firebase ni internet.
//
// Uso (en la página del sitio, con sesión iniciada):
//   const nube = crearNube({ guardado, almacen: almacenFirebase({ st, storage }), uid: user.uid });
//   await nube.alEntrar();          ← ANTES de guardado.cargar() (si la nube es más nueva, deja eso en IndexedDB)
//   crearGuardado({ alCambiar: () => nube.cambio() })   …   nube.estado (para mostrar), nube.respaldo (otra versión)

export const VERSION_PAQUETE = '1';

// ---- La huella: SHA-256 de rutas + contenidos, en orden (las fechas no cuentan: solo el contenido) ----
export async function huellaDe(mapa) {
  if (!mapa || !mapa.size) return '';
  const rutas = [...mapa.keys()].sort();
  const partes = [];
  for (const ruta of rutas) {
    const datos = mapa.get(ruta).datos;
    partes.push(new TextEncoder().encode(ruta + '\0' + datos.byteLength + '\0'), datos);
  }
  const todo = new Uint8Array(await new Blob(partes).arrayBuffer());
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', todo));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('');
}

// La hora del archivo más nuevo de las partidas locales (mtime que puso el juego al escribir)
const masNuevo = mapa => Math.max(0, ...[...mapa.values()].map(v => Number(v.mtime) || 0));

export function crearNube({ guardado, almacen, uid, ruta = u => `mkw/${u}/partidas.mkwp`, esperaMs = 5000,
                            minIntervaloMs = 30000, recuerdo = globalThis.localStorage, alCambiar = null,
                            ahora = () => Date.now() } = {}) {
  const estado = { activa: !!uid, accion: '', subidas: 0, bajadas: 0, ultimaSubida: 0, error: '', conflicto: false };
  let respaldo = null;                         // { blob, de: 'nube'|'local', cuando } — la versión que no ganó
  let temporizador = 0, ultimoEnvio = 0, enviando = null;
  const destino = uid ? ruta(uid) : '';
  const clave = 'mkw.nube.' + uid;
  const avisar = () => { if (alCambiar) alCambiar(estado); };
  const leerRecuerdo = () => { try { return JSON.parse(recuerdo.getItem(clave)) || {}; } catch { return {}; } };
  const anotarRecuerdo = huella => { try { recuerdo.setItem(clave, JSON.stringify({ huella, cuando: ahora() })); } catch {} };
  const bytesDe = async blob => new Uint8Array(await blob.arrayBuffer());

  async function subirAhora(motivo) {
    const blob = await guardado.exportar();
    const mapa = await guardado.cargar();
    const huella = await huellaDe(mapa);
    if (!huella) return false;                                    // nada que subir
    // actualizado = cuándo se subió; jugado = la hora del archivo más nuevo (cuándo se jugó de verdad: es lo que se
    // compara en un conflicto, porque una partida vieja se puede subir tarde)
    await almacen.subir(destino, await bytesDe(blob), { uid, huella, actualizado: String(ahora()), jugado: String(masNuevo(mapa)),
                                                        version: VERSION_PAQUETE });
    anotarRecuerdo(huella);
    estado.subidas++; estado.ultimaSubida = ahora(); estado.accion = motivo; estado.error = '';
    ultimoEnvio = ahora();
    return true;
  }
  async function bajarAhora(motivo) {
    const bytes = await almacen.bajar(destino);
    await guardado.importar(new Blob([bytes]));                   // revisa todo el paquete antes de reemplazar
    const huella = await huellaDe(await guardado.cargar());
    anotarRecuerdo(huella);
    estado.bajadas++; estado.accion = motivo; estado.error = '';
  }

  // Al entrar a la página (antes de que el juego lea las partidas): dejar local y nube iguales
  async function alEntrar() {
    if (!uid) { estado.accion = 'sin sesión: solo en este navegador'; avisar(); return estado.accion; }
    try {
      const [meta, mapa] = await Promise.all([almacen.meta(destino), guardado.cargar()]);
      const local = await huellaDe(mapa);
      const ultima = leerRecuerdo().huella || '';
      const remota = meta ? meta.huella || '' : '';
      if (!meta && !local) { estado.accion = 'nada que sincronizar'; }
      else if (!meta) { await subirAhora('subida: la nube estaba vacía'); }
      else if (!local) { await bajarAhora('bajada: este navegador no tenía partidas'); }
      else if (remota === local) { anotarRecuerdo(local); estado.accion = 'iguales'; }
      else {
        const cambioLocal = local !== ultima, cambioNube = remota !== ultima;
        if (cambioNube && !cambioLocal) await bajarAhora('bajada: la nube tenía una más nueva');
        else if (cambioLocal && !cambioNube) await subirAhora('subida: se jugó aquí sin conexión');
        else {
          // Las dos cambiaron desde la última vez: gana la más nueva; la otra queda de respaldo (nunca se pierde)
          estado.conflicto = true;
          const horaNube = Number(meta.jugado) || Number(meta.actualizado) || 0, horaLocal = masNuevo(mapa);
          if (horaNube > horaLocal) {
            respaldo = { blob: await guardado.exportar(), de: 'local', cuando: horaLocal };
            await bajarAhora('conflicto: ganó la de la nube (la de este navegador quedó de respaldo)');
          } else {
            respaldo = { blob: new Blob([await almacen.bajar(destino)]), de: 'nube', cuando: horaNube };
            await subirAhora('conflicto: ganó la de este navegador (la de la nube quedó de respaldo)');
          }
        }
      }
    } catch (e) {
      // Sin conexión, sin permiso, etc.: se juega con lo local y se reintenta al guardar
      estado.error = String(e && e.message || e);
      estado.accion = 'sin conexión con la nube: se juega con lo de este navegador';
    }
    avisar();
    return estado.accion;
  }

  // Mientras se juega: guardado.mjs avisa que guardó → subir dentro de unos segundos
  function cambio() {
    if (!uid) return;
    clearTimeout(temporizador);
    const espera = Math.max(esperaMs, ultimoEnvio + minIntervaloMs - ahora());
    temporizador = setTimeout(() => enviar('subida automática'), espera);
  }
  async function enviar(motivo = 'subida') {
    clearTimeout(temporizador);
    if (!uid) return false;
    if (enviando) return enviando;                                // una subida a la vez
    enviando = (async () => {
      try {
        // ¿Otro aparato subió mientras tanto? Antes de pisarla, guardarla de respaldo
        const meta = await almacen.meta(destino);
        const ultima = leerRecuerdo().huella || '';
        if (meta && meta.huella && meta.huella !== ultima) {
          const local = await huellaDe(await guardado.cargar());
          if (meta.huella === local) { anotarRecuerdo(local); return false; }
          respaldo = { blob: new Blob([await almacen.bajar(destino)]), de: 'nube', cuando: Number(meta.jugado) || Number(meta.actualizado) || 0 };
          estado.conflicto = true;
        }
        const local = await huellaDe(await guardado.cargar());
        if (local && local === ultima && meta && meta.huella === local) return false;   // ya está arriba
        return await subirAhora(motivo);
      } catch (e) {
        estado.error = String(e && e.message || e);
        return false;
      } finally {
        enviando = null;
        avisar();
      }
    })();
    return enviando;
  }

  // Al esconder la pestaña (cambiar de app en el celular, cerrar): intentar subir ya lo pendiente
  function alEsconder() { if (temporizador) enviar('subida al esconder la pestaña'); }

  return { estado, alEntrar, cambio, enviar, alEsconder, get respaldo() { return respaldo; }, destino };
}

// ---- El almacén de Firebase Storage (en el sitio) ----
// st = el módulo firebase-storage.js del SDK (import(`${SDK}/firebase-storage.js`)), storage = st.getStorage(app).
// Los metadatos van en customMetadata: uid (lo exigen las reglas del sitio), huella, actualizado, jugado, version.
export function almacenFirebase({ st, storage }) {
  const ref = ruta => st.ref(storage, ruta);
  return {
    async meta(ruta) {
      try {
        const m = await st.getMetadata(ref(ruta));
        const c = m.customMetadata || {};
        return { huella: c.huella || '', actualizado: Number(c.actualizado) || 0, jugado: Number(c.jugado) || 0,
                 version: c.version || '', tam: m.size };
      } catch (e) {
        if (e && e.code === 'storage/object-not-found') return null;   // todavía no subió nada
        throw e;
      }
    },
    async bajar(ruta) { return new Uint8Array(await st.getBytes(ref(ruta))); },
    async subir(ruta, bytes, meta) {
      await st.uploadBytes(ref(ruta), bytes, { contentType: 'application/octet-stream', customMetadata: meta });
    },
  };
}
