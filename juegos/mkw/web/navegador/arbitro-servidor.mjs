// La conexión de la página con el árbitro en un servidor (bitácora §236): la opción «Servidor Oracle» de la sala.
//
// Resumen: con `&conexion=oracle`, la página abre un WebSocket seguro (wss://) con el programa del dueño
// (herramientas/arbitro/servidor.mjs, en una máquina de Oracle Cloud en Santiago) y le pasa los paquetes de la carrera
// sincronizada que van al «servidor» (el participante sin kart de lockstep.mjs, mando 12). Lo que el servidor contesta va
// al lockstep como si viniera de un piloto más. La dirección y la clave NO están en el código: salen de
// `<privado>/build/arbitro.json` (lo sube el dueño a R2, detrás del Worker de amigos: solo lo ven los amigos con su
// token) = {"url": "wss://…", "clave": "…"}; para las pruebas, `?arbitroUrl=ws://127.0.0.1:N[&arbitroClave=…]`.
// Si no hay configuración, o el servidor no contesta, la sala no lo usa (sala-carrera.mjs decide carrera por carrera
// con lo que dice cada página en su latido) y arbitra una PC, como siempre. Como un generador de respaldo: el servidor
// alimenta mientras está; si se cae, la PC «suplente» toma la carga sin cortar la línea.
//
// Uso:  const cfg = await configArbitro({ parametros, origen: ORIGEN });       // null = sin servidor
//       const srv = crearConexionArbitro({ ...cfg, sala, uid, humanos, alBinario: b => ls.alBinario('servidor', b) });
//       srv.enviar(bytes); srv.carrera(n, fuera, humanos); srv.saltar(m, k); srv.vivo(); srv.estado(); srv.cerrar();
export const UID_SERVIDOR = 'servidor';
const VIVO_MS = 1500;                      // sin nada del servidor en 1,5 s = no contesta (pings del lockstep cada 0,5 s)
const REINTENTO_MIN = 1000, REINTENTO_MAX = 10000;

// La configuración: la de las pruebas (en la dirección) o la del dueño (arbitro.json en lo privado). null = no hay.
export async function configArbitro({ parametros, origen = '', buscar = (u, o) => fetch(u, o) }) {
  const deDireccion = parametros.get('arbitroUrl');
  if (deDireccion && esLocal(globalThis.location?.hostname ?? '127.0.0.1'))
    return valida({ url: deDireccion, clave: parametros.get('arbitroClave') || '' });
  if (!origen) return null;
  try {
    const r = await buscar((origen || '') + '/build/arbitro.json', { cache: 'no-store' });
    if (!r.ok) return null;
    return valida(await r.json());
  } catch { return null; }
}
// solo ws:// o wss:// (ws:// solo a esta misma PC: afuera tiene que ir cifrado)
const esLocal = host => ['127.0.0.1', 'localhost', '[::1]'].includes(host);
function valida(c) {
  if (!c || typeof c.url !== 'string') return null;
  let u; try { u = new URL(c.url); } catch { return null; }
  const local = esLocal(u.hostname);
  if (!(u.protocol === 'wss:' || (u.protocol === 'ws:' && local))) return null;
  return { url: u.href, clave: typeof c.clave === 'string' ? c.clave : '' };
}

export function crearConexionArbitro({ url, clave = '', sala, uid, humanos, alBinario, registro = () => {}, ahora = () => performance.now(),
  WS = globalThis.WebSocket }) {
  let ws = null, listo = false, ultimo = -Infinity, cerrado = false, espera = REINTENTO_MIN, timer = null, intentos = 0;
  let conexionCarrera = null;                // si se cae, el reemplazo queda a cargo hasta la próxima carrera
  const est = { conexiones: 0, caidas: 0, enviados: 0, recibidos: 0, error: null };
  const dir = () => { const u = new URL(url); u.searchParams.set('sala', sala); u.searchParams.set('uid', uid); if (clave) u.searchParams.set('clave', clave); return u.href; };
  const lista = () => humanos().map(h => ({ uid: h.uid, mando: h.mando }));
  function abrir() {
    if (cerrado) return;
    intentos++;
    try { ws = new WS(dir()); } catch (e) { est.error = String(e?.message || e); return reintentar(); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { est.conexiones++; ws.send(JSON.stringify({ t: 'hola', humanos: lista(), v: 1 })); };
    ws.onmessage = ev => {
      ultimo = ahora();
      if (typeof ev.data === 'string') {
        let m = null; try { m = JSON.parse(ev.data); } catch {}
        if (m?.t === 'listo') {
          listo = true; espera = REINTENTO_MIN; est.error = null;
          registro(`[árbitro] conectado al servidor (${new URL(url).host})`);
        } else if (m?.t === 'error') { est.error = m.motivo || 'error'; registro(`[árbitro] el servidor no me acepta: ${est.error}`); }
        return;
      }
      est.recibidos++;
      if (conexionCarrera === ws) alBinario(new Uint8Array(ev.data));
    };
    ws.onclose = () => {
      if (listo) { est.caidas++; registro('[árbitro] se cortó la conexión con el servidor'); }
      listo = false; ws = null; reintentar();
    };
    ws.onerror = () => { est.error = est.error || 'no conecta'; };
  }
  function reintentar() {
    if (cerrado || timer) return;
    timer = setTimeout(() => { timer = null; abrir(); }, espera);
    espera = Math.min(REINTENTO_MAX, espera * 2);
  }
  const abierto = () => listo && ws?.readyState === 1;
  const enCarrera = () => abierto() && conexionCarrera === ws;
  const latido = setInterval(() => {
    if (listo && ws?.readyState === 1) ws.send('{"t":"ping"}');
  }, 500);
  abrir();
  return {
    // los paquetes del lockstep para el servidor (sin conexión, se pierden: el lockstep repite lo que hace falta)
    enviar(b) { if (enCarrera()) { ws.send(b); est.enviados++; } },
    // la sala empieza la carrera n con el servidor de árbitro: se lo dice (lo dicen todas; vale la primera)
    carrera(n, fuera) {
      conexionCarrera = abierto() ? ws : null;
      if (enCarrera()) ws.send(JSON.stringify({ t: 'carrera', n, fuera, humanos: lista() }));
    },
    // §250: la carrera n largó (el «¡YA!») en el cuadro c: el servidor deja de esperar a todos en cada cuadro
    ya(n, c) { if (enCarrera()) ws.send(JSON.stringify({ t: 'ya', n, c })); },
    saltar(m, k) { if (enCarrera()) ws.send(JSON.stringify({ t: 'saltar', m, k })); },
    // abierto = el WebSocket está; vivo = además llegó algo hace poco (el servidor contesta)
    abierto, enCarrera,
    vivo: () => abierto() && ahora() - ultimo < VIVO_MS,
    estado: () => ({ ...est, listo, intentos, hace: Number.isFinite(ultimo) ? Math.round(ahora() - ultimo) : null, host: (() => { try { return new URL(url).host; } catch { return ''; } })() }),
    cerrar() { cerrado = true; clearTimeout(timer); clearInterval(latido); try { ws?.close(); } catch {} },
  };
}
