// La malla WebRTC de la sala en línea: un canal directo entre cada par de navegadores — bitácora §58 (F2).
//
// Resumen: es la malla del sitio (Paginita-Pro, colabtex/src/juegos/malla.js, la que usan Yemas y BT3) con dos
// cambios para Mario Kart:
//   - DOS canales por par en vez de uno: "udp" (sin orden ni reenvío: la carrera, 36 paquetes por segundo; uno
//     viejo no sirve cuando ya salió el siguiente) y "tcp" (ordenado y confiable: la conexión con el servidor WFC y
//     los mensajes de la sala, donde perder un byte rompe todo). Como tener una línea de radio y otra telefónica.
//   - solo binario (Uint8Array): el formato lo pone red.mjs.
// Lo demás igual que en el sitio: ofrece el uid menor; cada entrada es una sesión; cada intento lleva su número (k)
// para tirar candidatos viejos; si un canal se cae, quien ofrece vuelve a ofrecer (pronto si había abierto, cada vez
// más espaciado si nunca abrió). La señalización (quién está y los mensajes de oferta/respuesta/candidatos) llega por
// `senal` y no sabe de Firebase: en el sitio la presta la página de la sala (postMessage, como BT3), en el banco un
// buzón falso por BroadcastChannel.
//
// Uso:  const m = crearMalla({ uid, senal, alBinario: (de, bytes, canal) => …, alCambiar });
//       await m.entrar();  m.enviar(uid, bytes, 'udp' | 'tcp');  m.conectados();  m.salir();

export const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const LLENO = 1 << 20;            // bytes en cola sin enviar: más que esto y los UDP se tiran (como un router lleno)
const VIGILA_MS = 1000;

// Red mala de mentira, SOLO para pruebas (PLAN C3, bitácora §70): ?redMala=80,20,5 en la dirección de la página = lo que
// LLEGA por "udp" se demora 80 ms ± 20 ms (cada paquete con su propia demora: pueden llegar desordenados) y se pierde
// el 5 %; por "tcp" solo la demora, y en orden (es el canal confiable: ahí nada se pierde ni se desordena). Como meter
// entre dos equipos un tramo de cable largo y con ruido. Sin el parámetro no hace nada. Cuenta lo que hizo en
// globalThis.mkwRedMala (para las pruebas).
// §80: ?redMala=80,20,5,ida = también lo que SALE de esta página (la conexión mala es la de este jugador, en los dos
// sentidos: los demás reciben lo suyo tarde y él lo de ellos); cuenta lo que sale en globalThis.mkwRedMalaIda.
export function leerRedMala(busqueda = globalThis.location?.search || '') {
  try {
    const v = new URLSearchParams(busqueda).get('redMala');
    if (!v) return null;
    const partes = v.split(',');
    const [latencia = 0, variacion = 0, perdida = 0] = partes.slice(0, 3).map(Number);
    return { latencia: Math.max(0, latencia), variacion: Math.max(0, variacion), perdida: Math.min(1, Math.max(0, perdida / 100)),
      ida: partes[3] === 'ida' };
  } catch { return null; }
}
export function degradar(alBinario, red, azar = Math.random, reloj = (f, ms) => setTimeout(f, ms), ahora = () => performance.now(), nombre = 'mkwRedMala') {
  if (!red) return alBinario;
  const cuenta = globalThis[nombre] = { ...red, llegados: 0, perdidos: 0, demoraMedia: 0 };
  const ultimaTcp = new Map();      // uid → cuándo sale el último "tcp" (el siguiente no puede salir antes: en orden)
  return (u, bytes, canal) => {
    if (canal === 'udp' && azar() < red.perdida) { cuenta.perdidos++; return; }
    let demora = red.latencia + (azar() * 2 - 1) * red.variacion;
    if (canal === 'tcp') {
      const sale = Math.max(ahora() + demora, ultimaTcp.get(u) || 0);
      ultimaTcp.set(u, sale);
      demora = sale - ahora();
    }
    demora = Math.max(0, demora);
    cuenta.llegados++;
    cuenta.demoraMedia += (demora - cuenta.demoraMedia) / cuenta.llegados;
    reloj(() => alBinario(u, bytes, canal), demora);
  };
}

export function crearMalla({ uid, senal, quiere = () => true, alBinario = () => {}, alCambiar = () => {},
  RTC = globalThis.RTCPeerConnection, ahora = () => Date.now(), ice = ICE, redMala = leerRedMala() }) {
  alBinario = degradar(alBinario, redMala);       // sin ?redMala, el mismo alBinario de siempre
  let sesion = '', offP = null, offM = null, reloj = null, intento = 0;
  const pares = new Map();          // uid → { pc, udp, tcp, s, k, cola, remota, abrio, malDesde }
  const presentes = new Map();      // uid → sesión
  const fallos = new Map();

  const abierto = c => c && c.readyState === 'open';
  const sanoX = x => {
    if (!x || !abierto(x.udp) || !abierto(x.tcp)) return false;
    const st = x.pc.connectionState || x.pc.iceConnectionState;
    return st !== 'failed' && st !== 'closed' && st !== 'disconnected';
  };

  function cierra(u) {
    const x = pares.get(u);
    if (!x) return;
    pares.delete(u);
    for (const c of [x.udp, x.tcp]) try { c.close(); } catch {}
    try { x.pc.close(); } catch {}
    alCambiar();
  }

  function nuevoPar(u, s, k) {
    cierra(u);
    const pc = new RTC({ iceServers: ice });
    // negociados a mano (mismo id en los dos lados): no hay que esperar al ondatachannel del otro
    const udp = pc.createDataChannel('udp', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
    const tcp = pc.createDataChannel('tcp', { negotiated: true, id: 1, ordered: true });
    const x = { pc, udp, tcp, s, k, cola: [], remota: false, abrio: false, malDesde: ahora() };
    pares.set(u, x);
    const mio = () => pares.get(u) === x;
    for (const [c, nombre] of [[udp, 'udp'], [tcp, 'tcp']]) {
      c.binaryType = 'arraybuffer';
      c.onopen = () => { if (mio() && sanoX(x)) { x.abrio = true; x.malDesde = 0; alCambiar(); } };
      c.onclose = () => { if (mio()) alCambiar(); };
      c.onmessage = ev => { if (mio() && ev.data instanceof ArrayBuffer) alBinario(u, new Uint8Array(ev.data), nombre); };
    }
    pc.onicecandidate = e => { if (e.candidate && mio()) senal.envia(u, { t: 'ice', s: sesion, a: s, k, d: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (mio()) alCambiar(); };
    return x;
  }

  async function ofrece(u, s) {
    const k = ++intento;
    const x = nuevoPar(u, s, k);
    try {
      const o = await x.pc.createOffer();
      if (pares.get(u) !== x) return;
      await x.pc.setLocalDescription(o);
      senal.envia(u, { t: 'oferta', s: sesion, a: s, k, d: { type: o.type, sdp: o.sdp } });
    } catch (e) { console.warn('[malla] oferta', e); }
  }

  async function vacia(x) {
    x.remota = true;
    for (const c of x.cola.splice(0)) await x.pc.addIceCandidate(c).catch(() => {});
  }

  async function alMensaje(de, m) {
    if (!sesion || !m || m.a !== sesion || de === uid || typeof de !== 'string') return;
    let x = pares.get(de);
    try {
      if (m.t === 'oferta') {
        if (!(de < uid) || !quiere(de)) return;             // solo ofrece el menor
        x = nuevoPar(de, m.s, m.k);
        await x.pc.setRemoteDescription(m.d);
        await vacia(x);
        const r = await x.pc.createAnswer();
        if (pares.get(de) !== x) return;
        await x.pc.setLocalDescription(r);
        senal.envia(de, { t: 'respuesta', s: sesion, a: m.s, k: m.k, d: { type: r.type, sdp: r.sdp } });
      } else if (m.t === 'respuesta') {
        if (!x || x.s !== m.s || x.k !== m.k || x.pc.signalingState !== 'have-local-offer') return;
        await x.pc.setRemoteDescription(m.d);
        await vacia(x);
      } else if (m.t === 'ice') {
        if (!x || x.s !== m.s || x.k !== m.k) return;
        if (x.remota) await x.pc.addIceCandidate(m.d).catch(() => {}); else x.cola.push(m.d);
      }
    } catch (e) { console.warn('[malla] señal', m.t, e); }
  }

  function revisa() {
    if (!sesion) return;
    // se cierra el par de quien ya no se quiere o volvió con OTRA sesión (recargó la página). §93: si solo dejó de verse
    // en el buzón y la conexión directa sigue sana, se deja: una pestaña trabada unos segundos (la primera visita armando
    // gráficos) deja de dar señales en el buzón, pero su WebRTC sigue vivo; si se fue de verdad, la conexión se cae sola
    for (const [u, x] of [...pares]) {
      const s = presentes.get(u);
      if (!quiere(u) || (s !== undefined && s !== x.s) || (s === undefined && !sanoX(x))) cierra(u);
    }
    for (const [u, s] of presentes) if (!pares.has(u) && quiere(u) && uid < u) ofrece(u, s);
    alCambiar();
  }

  function alPresentes(v) {
    presentes.clear();
    for (const [u, s] of Object.entries(v || {})) if (u !== uid && typeof s === 'string') presentes.set(u, s);
    revisa();
  }

  function vigila() {
    const t = ahora();
    for (const [u, x] of [...pares]) {
      if (sanoX(x)) { x.malDesde = 0; x.abrio = true; fallos.delete(u); continue; }
      if (!x.malDesde) x.malDesde = t;
      // (§93: el par que se dejó abierto de alguien que ya no está en el buzón, si se cae, se cierra: no vuelve)
      if (!presentes.has(u)) { if (t - x.malDesde >= 4000) cierra(u); continue; }
      if (!(uid < u)) continue;
      const n = fallos.get(u) || 0;
      const espera = x.abrio ? 4000 : Math.min(60000, 10000 * 2 ** n);
      if (t - x.malDesde < espera) continue;
      if (!x.abrio) fallos.set(u, n + 1);
      const s = presentes.get(u);
      if (s && quiere(u)) ofrece(u, s); else cierra(u);
    }
  }

  async function entrar() {
    if (sesion || typeof RTC !== 'function') return false;
    sesion = Math.random().toString(36).slice(2, 10);
    offM = senal.alMensajes(alMensaje);
    try { await senal.entra(sesion); } catch { offM?.(); offM = null; sesion = ''; return false; }
    if (!sesion) return false;
    offP = senal.alPresentes(alPresentes);
    reloj = setInterval(vigila, VIGILA_MS);
    return true;
  }

  function salir() {
    if (!sesion) return;
    sesion = '';
    offP?.(); offM?.(); offP = offM = null;
    clearInterval(reloj);
    for (const u of [...pares.keys()]) cierra(u);
    presentes.clear();
    senal.sale();
    alCambiar();
  }

  // bytes a un par por el canal pedido; false si no se pudo (sin canal, o el UDP con la cola llena)
  function enviar(u, bytes, canal = 'udp') {
    const x = pares.get(u);
    if (!sanoX(x)) return false;
    const c = canal === 'tcp' ? x.tcp : x.udp;
    if (canal === 'udp' && c.bufferedAmount > LLENO) return false;
    try { c.send(bytes); return true; } catch { return false; }
  }

  return {
    entrar, salir, revisa,
    // §80: con ?redMala=…,ida, lo que sale también va por el tramo malo (con la misma demora y pérdida)
    enviar: redMala?.ida ? degradar((u, bytes, canal) => { enviar(u, bytes, canal); }, redMala, Math.random, (f, ms) => setTimeout(f, ms), () => performance.now(), 'mkwRedMalaIda') : enviar,
    activa: () => !!sesion,
    sano: u => sanoX(pares.get(u)),
    detalle: u => { const x = pares.get(u); return x ? { pc: x.pc.connectionState || '', ice: x.pc.iceConnectionState || '', udp: x.udp.readyState, tcp: x.tcp.readyState, abrio: x.abrio } : null; },
    presentes: () => [...presentes.keys()],
    conectados: () => [...pares].filter(([, x]) => sanoX(x)).map(([u]) => u),
  };
}

// ---- Señalización ----

// La del sitio: la página de la sala (padre) tiene la sesión de Firebase y presta su buzón por postMessage, con el
// mismo protocolo que BT3 (op: entra, sale, presentes, envia, mensajes). `canal` = prefijo de los mensajes.
export function senalPadre({ canal = 'mkw', padre = globalThis.parent, origen = globalThis.location?.origin } = {}) {
  const HIJO = canal + '-hijo', PADRE = canal + '-padre';
  const oyentes = new Set(); let alPres = null, n = 0;
  const esperas = new Map();
  const manda = (op, extra = {}) => padre.postMessage({ canal: HIJO, tipo: 'senal', op, ...extra }, origen);
  globalThis.addEventListener('message', e => {
    if (e.source !== padre || e.origin !== origen || e.data?.canal !== PADRE) return;
    const d = e.data;
    if (d.tipo === 'senal-mensaje') for (const f of oyentes) f(d.de, d.m);
    else if (d.tipo === 'senal-presentes') alPres?.(d.v);
    else if (d.tipo === 'senal-entro') { esperas.get(d.id)?.(d.ok); esperas.delete(d.id); }
  });
  return {
    entra(s) { const id = ++n; return new Promise((ok, mal) => { esperas.set(id, v => v ? ok() : mal(new Error('sin permiso'))); manda('entra', { id, s }); }); },
    sale() { manda('sale'); },
    alPresentes(f) { alPres = f; manda('presentes', { on: true }); return () => { alPres = null; manda('presentes', { on: false }); }; },
    envia(para, m) { manda('envia', { para, m }); },
    alMensajes(f) { oyentes.add(f); if (oyentes.size === 1) manda('mensajes', { on: true }); return () => { oyentes.delete(f); if (!oyentes.size) manda('mensajes', { on: false }); }; },
  };
}

// La del banco: un "Firebase" falso con BroadcastChannel (presencia y buzón), para dos pestañas del mismo Chrome.
// Cada pestaña repite su presencia cada segundo (así la que llega tarde ve a las de antes) y la borra al salir.
export function senalCanal({ sala = 'mkw-banco', uid, Canal = globalThis.BroadcastChannel } = {}) {
  const c = new Canal('mkw-senal-' + sala);
  const oyentes = new Set(); let alPres = null, miSesion = '', reloj = null;
  const vistos = new Map();         // uid → { s, hace }
  const avisa = () => alPres?.(Object.fromEntries([...vistos].map(([u, v]) => [u, v.s])));
  c.onmessage = ({ data: d }) => {
    if (d.t === 'presente') { const antes = vistos.get(d.uid)?.s; vistos.set(d.uid, { s: d.s, hace: Date.now() }); if (antes !== d.s) avisa(); }
    else if (d.t === 'fuera') { if (vistos.delete(d.uid)) avisa(); }
    else if (d.t === 'msg' && d.para === uid) for (const f of oyentes) f(d.de, d.m);
  };
  const latido = () => {
    if (miSesion) c.postMessage({ t: 'presente', uid, s: miSesion });
    const t = Date.now(); let cambio = false;
    for (const [u, v] of vistos) if (t - v.hace > 4000) { vistos.delete(u); cambio = true; }
    if (cambio) avisa();
  };
  return {
    async entra(s) { miSesion = s; latido(); reloj = setInterval(latido, 1000); },
    sale() { c.postMessage({ t: 'fuera', uid }); miSesion = ''; clearInterval(reloj); },
    alPresentes(f) { alPres = f; avisa(); return () => { alPres = null; }; },
    envia(para, m) { c.postMessage({ t: 'msg', de: uid, para, m }); },
    alMensajes(f) { oyentes.add(f); return () => oyentes.delete(f); },
  };
}
