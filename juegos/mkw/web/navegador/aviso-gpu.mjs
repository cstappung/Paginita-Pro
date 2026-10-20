// El aviso de «tarjeta de video equivocada» (bitácora §81, D4 del plan).
//
// Resumen: en Windows la tarjeta de video que usa el navegador la decide Windows, no la página. En un PC con dos
// (la integrada del procesador y una dedicada), Windows puede darle al navegador la integrada y el juego va lento.
// La página ya mostraba la tarjeta en uso y, plegada, cómo cambiarla (cajón → Avanzado → Video). Pero nadie va a mirar
// ahí. Esto la ofrece CUANDO HACE FALTA: si el juego va lento un buen rato por trabajo de esta PC (no esperando el
// disco, ni a otro jugador, ni con la pestaña escondida) y el navegador no deja elegir la tarjeta (da la misma pidiendo
// «alto rendimiento» o «bajo consumo»), o la que da es «por software», aparece un aviso chico con «Ver cómo» y «✕».
// Como el testigo de «filtro sucio» de un equipo: no se enciende por un tirón, sino cuando la caída se sostiene.
//
// La regla (cada segundo, con lo que mide la página):
//   - cuenta solo los segundos «de juego»: pasado el arranque (cuadro ≥ 600), pestaña a la vista, sin esperar el
//     disco más de 200 ms en ese segundo, y fuera de la sala (ahí manda el aviso propio de la sala, §70.7);
//   - un segundo es «lento» si da menos de 54 cuadros y el trabajo por cuadro pasa de 12 ms (si el trabajo es poco,
//     el juego estaba esperando: no es la tarjeta);
//   - se enciende con 8 segundos lentos entre los últimos 12 de juego, una vez por visita;
//   - «Windows elige la tarjeta» solo vale en Windows (en un teléfono el navegador también da la misma tarjeta para los
//     dos pedidos, porque tiene una sola): ahí, solo el caso «por software»; y si la que dio es una NVIDIA (siempre
//     dedicada), cambiarla no ayuda: tampoco;
//   - «✕» lo apaga por 7 días (se guarda la hora en localStorage, `mkw.avisoGpu`); «Ver cómo» abre la ayuda.
//
// Uso:  const a = crearAvisoGpu({ gpu: revisionGpu, abrirAyuda: () => …, documento: document });
//       a.medir({ fps, trabajo, cuadros, esperaDisco, oculta, enSala })   (una vez por segundo)
//       a.estado() → { visible, lentos, motivo, puede }
//   pruebas: almacen: { leer(k), escribir(k, v) }, ahora: () => ms, windows: true/false (por omisión, lo dice el navegador)
export const CUADROS_ARRANQUE = 600, FPS_LENTO = 54, TRABAJO_LENTO = 12, VENTANA = 12, LENTOS = 8;
export const SILENCIO_MS = 7 * 24 * 3600 * 1000, CLAVE = 'mkw.avisoGpu';

const almacenLocal = {
  leer: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  escribir: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};

const enWindows = () => /Windows/i.test(globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.userAgent || '');

export function crearAvisoGpu({ gpu, abrirAyuda, documento = globalThis.document, almacen = almacenLocal, ahora = () => Date.now(), windows = enWindows() }) {
  let info = null;                        // { ignora, nombreGpu } cuando la revisión de la tarjeta termina
  Promise.resolve(gpu).then(g => { info = g || null; }, () => {});
  const ventana = [];                     // los últimos segundos de juego: true = lento
  let visible = false, mostrado = false, motivo = '';
  let caja = null;

  // ¿La tarjeta se puede cambiar desde Windows y eso ayudaría? (si el navegador hace caso al pedido, la página ya pidió
  // «alto rendimiento» y tiene la mejor: cambiarla no ayuda)
  const porSoftware = () => /POR SOFTWARE/.test(info?.nombreGpu || '');
  // si ya le dio una NVIDIA (siempre dedicada) cambiar la tarjeta no ayuda; Intel y AMD pueden ser la integrada
  const yaDedicada = () => /^nvidia/i.test(info?.nombreGpu || '');
  const puede = () => !!info && ((windows && info.ignora && !yaDedicada()) || porSoftware());
  const silenciado = () => { const t = Number(almacen.leer(CLAVE)); return t > 0 && ahora() - t < SILENCIO_MS; };

  function pintar() {
    if (!documento) return;
    if (!caja) {
      caja = documento.createElement('div');
      caja.id = 'avisoGpu';
      caja.setAttribute('role', 'status');
      const texto = documento.createElement('span');
      texto.className = 'aviso-gpu-texto';
      const ver = documento.createElement('button');
      ver.type = 'button'; ver.className = 'boton'; ver.id = 'avisoGpuVer'; ver.textContent = 'Ver cómo';
      ver.addEventListener('click', () => { ocultar(); abrirAyuda?.(); });
      const cerrar = documento.createElement('button');
      cerrar.type = 'button'; cerrar.className = 'aviso-gpu-cerrar'; cerrar.id = 'avisoGpuCerrar'; cerrar.textContent = '✕';
      cerrar.setAttribute('aria-label', 'No mostrar este aviso por 7 días');
      cerrar.addEventListener('click', () => { almacen.escribir(CLAVE, String(ahora())); ocultar(); });
      caja.append(texto, ver, cerrar);
      documento.body.append(caja);
    }
    caja.querySelector('.aviso-gpu-texto').textContent = porSoftware()
      ? '🐢 El juego va lento: el navegador está dibujando sin la tarjeta de video («por software»).'
      : '🐢 El juego va lento en esta PC. Si tienes una tarjeta de video dedicada, Windows puede estar dándole al navegador la integrada.';
    caja.hidden = !visible;
  }
  function ocultar() { visible = false; if (caja) caja.hidden = true; }

  function medir({ fps, trabajo, cuadros, esperaDisco = 0, oculta = false, enSala = false }) {
    if (enSala || oculta || cuadros < CUADROS_ARRANQUE || esperaDisco > 200) return;   // no es un segundo de juego
    ventana.push(fps < FPS_LENTO && trabajo > TRABAJO_LENTO);
    if (ventana.length > VENTANA) ventana.shift();
    const lentos = ventana.filter(Boolean).length;
    if (!mostrado && lentos >= LENTOS && puede() && !silenciado()) {
      mostrado = visible = true;
      motivo = porSoftware() ? 'software' : 'ignora';
      pintar();
    }
  }
  return {
    medir,
    ocultar,
    estado: () => ({ visible, lentos: ventana.filter(Boolean).length, motivo, puede: puede(), mostrado }),
  };
}
