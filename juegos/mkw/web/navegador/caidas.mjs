// La caja negra de la página (bitácora §269, el dueño: «se me crasheó en el celular en medio de la carrera»).
//
// Resumen: cuando el juego se cae, la pestaña se cierra o se recarga y todo lo que sabíamos se pierde. Esto deja una
// «caja negra» como la de un avión, en localStorage (sobrevive a la caída):
//   - un LATIDO cada 5 s: la hora, si estaba en carrera, la memoria del juego (heap de wasm) y la de JavaScript, el
//     cuadro. Al ocultar la pestaña o cerrarla bien se marca «salió limpio»; al volver a verse se borra la marca.
//   - la CAUSA cuando se puede ver: la tarjeta de video perdida (`GPUDevice.lost`: el sistema la reinició, se quedó sin
//     memoria de video), un error del motor (RuntimeError de WebAssembly, «Aborted», memoria agotada) o una promesa
//     rechazada con uno de esos.
// Al abrir la página otra vez, `revisar()` mira la caja: con una causa anotada, o con un latido de hace poco SIN la marca
// de «salió limpio» (la pestaña murió de golpe, lo típico cuando Android mata la pestaña por memoria: ahí no corre nada,
// ni pagehide), dice que el juego se cayó, con lo último medido. La página lo muestra y lo agrega al informe.
// Como el breaker de un tablero que deja la bandera bajada: al volver se sabe que saltó y en qué circuito.
// ?caidas=0 = sin la caja negra.

export const CLAVE = 'mkw.caida';
export const LATIDO_MS = 5000;
export const VIGENCIA_MS = 30 * 60 * 1000;   // un latido sin «limpio» de hace más de 30 min no se cree (otro día, otro uso)

// ¿Un error de los que matan al juego? (los demás errores de la página no paran el juego y no se anotan)
export function esGrave(e) {
  const t = String(e?.name || '') + ' ' + String(e?.message ?? e ?? '');
  return /RuntimeError|Aborted|abort\(|out of memory|memory access out of bounds|Out of bounds|unreachable|Maximum call stack|WebAssembly|OOM/i.test(t);
}

export function crearCaidas({ almacen = globalThis.localStorage, ahora = () => Date.now(), medir = () => ({}),
  ventana = globalThis, documento = globalThis.document, gpu = globalThis.GPUAdapter } = {}) {
  const leer = () => { try { return JSON.parse(almacen.getItem(CLAVE) || 'null'); } catch { return null; } };
  const escribir = v => { try { almacen.setItem(CLAVE, JSON.stringify(v)); } catch {} };
  const estado = { anterior: null, causas: 0, latidos: 0 };
  let caja = { latido: null, limpio: false, causa: null };

  // lo de la vez anterior (se lee una sola vez, al crear, antes del primer latido de esta)
  const vieja = leer();
  if (vieja && (vieja.causa || (vieja.latido && !vieja.limpio && ahora() - vieja.latido.t < VIGENCIA_MS))) {
    estado.anterior = { causa: vieja.causa || { tipo: 'cierre', texto: 'la pestaña se cerró de golpe (sin aviso: lo típico cuando el sistema la mata por memoria)' },
      ultimo: vieja.latido, cuando: vieja.causa?.t || vieja.latido?.t || null };
  }
  escribir(caja);

  const latir = () => {
    estado.latidos++;
    let m = {}; try { m = medir() || {}; } catch {}
    caja.latido = { t: ahora(), ...m };
    escribir(caja);
  };
  // la causa: solo la primera (la que tumbó; lo que viene después suele ser consecuencia)
  const anotar = (tipo, texto) => {
    estado.causas++;
    if (caja.causa) return;
    let m = {}; try { m = medir() || {}; } catch {}
    caja.causa = { tipo, texto: String(texto).slice(0, 400), t: ahora(), ...m };
    escribir(caja);
  };
  const limpio = v => { caja.limpio = v; if (v) latir(); else escribir(caja); };

  // la tarjeta de video: aurora pide el device desde el wasm; se envuelve requestDevice para oír su `lost`
  if (gpu?.prototype?.requestDevice && !gpu.prototype.requestDevice.__caidas) {
    const original = gpu.prototype.requestDevice;
    const envuelta = function (...a) {
      return original.apply(this, a).then(d => {
        d?.lost?.then?.(i => { if (i?.reason !== 'destroyed') anotar('tarjeta', `se perdió la tarjeta de video (${i?.reason || '?'}): ${i?.message || ''}`); });
        return d;
      });
    };
    envuelta.__caidas = true;
    gpu.prototype.requestDevice = envuelta;
  }
  ventana?.addEventListener?.('error', e => { const x = e?.error || e?.message; if (esGrave(x)) anotar('motor', x?.stack || x?.message || x); });
  ventana?.addEventListener?.('unhandledrejection', e => { if (esGrave(e?.reason)) anotar('motor', e.reason?.stack || e.reason?.message || e.reason); });
  ventana?.addEventListener?.('pagehide', () => limpio(true));
  documento?.addEventListener?.('visibilitychange', () => limpio(documento.visibilityState === 'hidden'));
  const reloj = setInterval(latir, LATIDO_MS);
  latir();

  return {
    estado, anotar, latir, limpio,
    // para el Module de emscripten: onAbort
    alAbortar: t => anotar('motor', 'el motor se detuvo (abort): ' + t),
    // el texto para mostrar al recargar (null si la vez anterior no hubo caída)
    texto() {
      const a = estado.anterior; if (!a) return null;
      const u = a.ultimo || {};
      return `La última vez el juego se cerró${u.enCarrera ? ' en medio de la carrera' : ''}: ${a.causa.texto}` +
        (u.heapMB ? ` · memoria del juego ${u.heapMB} MB` : '') + (u.jsMB ? `, de la página ${u.jsMB} MB` : '');
    },
    parar() { clearInterval(reloj); },
  };
}
