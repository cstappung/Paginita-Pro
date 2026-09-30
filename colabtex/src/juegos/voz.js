/* Chat de voz de una sala: WebRTC de navegador a navegador.

   El audio no pasa por ningún servidor nuestro: cada par de jugadores abre
   una conexión directa (una malla; con ocho son siete conexiones por
   cabeza, que para voz sobra). La base solo hace de buzón para que dos
   navegadores se presenten (la «señalización»): quién está en la voz y los
   mensajes de oferta, respuesta y candidatos ICE. Ese buzón llega por
   `senal`, así que este módulo no sabe de Firebase y se prueba con uno de
   mentira.

   Tres cosas lo sostienen:

   - **Quién ofrece lo decide el uid**: de cada par ofrece el menor. Si los
     dos ofrecieran a la vez habría que resolver el choque (el «glare»), y
     así no hay choque posible.
   - **Cada entrada a la voz es una sesión** (un id al azar). Los mensajes
     llevan la sesión de quien los manda y la de a quien van, y un mensaje
     de una sesión que ya no existe se ignora: recargar la pestaña deja en
     el buzón restos de la conversación anterior.
   - **Los candidatos que llegan antes que la oferta esperan en cola**:
     `addIceCandidate` sin descripción remota falla.

   El límite honesto: solo hay STUN, no TURN. Entre dos redes que no dejan
   conectar directo (algunas de celular, algunas corporativas) la conexión
   no se arma y ese par no se oye; la barra lo dice en vez de quedarse muda. */

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const UMBRAL = 0.02;     // RMS sobre el que se considera que alguien habla

export function crearVoz({ uid, senal, pista, alCambiar = () => {} }) {
  let sesion = "", local = null, modo = "ptt", apretado = false, silencio = false;
  let offPresentes = null, offMensajes = null, ctx = null, medidor = null;
  const pares = new Map();          // uid → {pc, s, audio, cola, remota, analizador}
  const presentes = new Map();      // uid → sesión

  const aviso = () => alCambiar(estado());

  function estado() {
    return {
      activo: !!sesion, modo, silencio, hablando: !!local && pistaActiva(),
      pares: [...pares].map(([u, x]) => ({ uid: u, estado: x.pc.connectionState })),
      hablan: [...hablan],
    };
  }
  const pistaActiva = () => modo === "abierto" || apretado;
  function aplicaMicro() {
    if (local) for (const t of local.getAudioTracks()) t.enabled = pistaActiva();
  }

  // ---------- quién habla ----------
  const hablan = new Set();
  function analizador(stream) {
    if (!ctx) return null;
    try {
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(a);
      return { a, buf: new Float32Array(a.fftSize) };
    } catch { return null; }
  }
  function nivel(x) {
    if (!x) return 0;
    x.a.getFloatTimeDomainData(x.buf);
    let s = 0;
    for (const v of x.buf) s += v * v;
    return Math.sqrt(s / x.buf.length);
  }
  function mide() {
    const antes = [...hablan].sort().join();
    hablan.clear();
    if (local && pistaActiva() && nivel(local.analizador) > UMBRAL) hablan.add(uid);
    for (const [u, x] of pares) if (!silencio && nivel(x.analizador) > UMBRAL) hablan.add(u);
    if ([...hablan].sort().join() !== antes) aviso();
  }

  // ---------- pares ----------
  function cierra(u) {
    const x = pares.get(u);
    if (!x) return;
    pares.delete(u);
    try { x.pc.close(); } catch {}
    if (x.audio) { x.audio.srcObject = null; x.audio.remove(); }
  }

  function nuevoPar(u, s) {
    cierra(u);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const x = { pc, s, audio: null, cola: [], remota: false, analizador: null };
    pares.set(u, x);
    for (const t of local.getAudioTracks()) pc.addTrack(t, local);
    pc.onicecandidate = e => {
      if (e.candidate) senal.envia(u, { t: "ice", s: sesion, a: s, d: e.candidate.toJSON() });
    };
    pc.ontrack = e => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (!x.audio) {
        x.audio = document.createElement("audio");
        x.audio.autoplay = true;
        x.audio.hidden = true;
        document.body.append(x.audio);
      }
      x.audio.srcObject = stream;
      x.audio.muted = silencio;
      x.audio.play?.().catch(() => {});
      x.analizador = analizador(stream);
    };
    pc.onconnectionstatechange = aviso;
    return x;
  }

  async function ofrece(u) {
    const x = pares.get(u);
    const oferta = await x.pc.createOffer();
    await x.pc.setLocalDescription(oferta);
    senal.envia(u, { t: "oferta", s: sesion, a: x.s, d: { type: oferta.type, sdp: oferta.sdp } });
  }

  async function vacia(x) {
    x.remota = true;
    for (const c of x.cola.splice(0)) await x.pc.addIceCandidate(c).catch(() => {});
  }

  async function alMensaje(de, m) {
    if (!sesion || !m || m.a !== sesion || de === uid) return;
    let x = pares.get(de);
    try {
      if (m.t === "oferta") {
        if (!x || x.s !== m.s) x = nuevoPar(de, m.s);
        await x.pc.setRemoteDescription(m.d);
        await vacia(x);
        const resp = await x.pc.createAnswer();
        await x.pc.setLocalDescription(resp);
        senal.envia(de, { t: "respuesta", s: sesion, a: m.s, d: { type: resp.type, sdp: resp.sdp } });
      } else if (m.t === "respuesta") {
        if (!x || x.s !== m.s || x.pc.signalingState !== "have-local-offer") return;
        await x.pc.setRemoteDescription(m.d);
        await vacia(x);
      } else if (m.t === "ice") {
        if (!x || x.s !== m.s) return;
        if (x.remota) await x.pc.addIceCandidate(m.d).catch(() => {});
        else x.cola.push(m.d);
      }
    } catch (e) {
      console.warn("[voz] señal", m.t, e);
    }
    aviso();
  }

  function alPresentes(v) {
    presentes.clear();
    for (const [u, s] of Object.entries(v || {})) if (u !== uid && typeof s === "string") presentes.set(u, s);
    for (const u of [...pares.keys()]) if (!presentes.has(u)) cierra(u);
    for (const [u, s] of presentes) {
      const x = pares.get(u);
      if (x && x.s === s) continue;
      if (uid < u) { nuevoPar(u, s); ofrece(u).catch(e => console.warn("[voz] oferta", e)); }
      // Si ofrece el otro, el par se arma cuando llega su oferta.
      else if (x) cierra(u);
    }
    aviso();
  }

  // ---------- la interfaz ----------
  async function entrar() {
    if (sesion) return;
    local = await (pista ? pista() : navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false
    }));
    try { ctx = new AudioContext(); } catch { ctx = null; }
    local.analizador = analizador(local);
    sesion = Math.random().toString(36).slice(2, 10);
    aplicaMicro();
    offMensajes = senal.alMensajes(alMensaje);
    await senal.entra(sesion);
    offPresentes = senal.alPresentes(alPresentes);
    medidor = setInterval(mide, 200);
    aviso();
  }

  function salir() {
    if (!sesion) return;
    sesion = "";
    offPresentes?.(); offMensajes?.();
    offPresentes = offMensajes = null;
    clearInterval(medidor);
    for (const u of [...pares.keys()]) cierra(u);
    for (const t of local?.getTracks() || []) t.stop();
    local = null;
    ctx?.close?.().catch?.(() => {});
    ctx = null;
    hablan.clear();
    senal.sale();
    aviso();
  }

  return {
    entrar, salir, estado,
    ponModo(m) { modo = m === "abierto" ? "abierto" : "ptt"; aplicaMicro(); aviso(); },
    hablar(on) { if (apretado === !!on) return; apretado = !!on; aplicaMicro(); aviso(); },
    silenciar(on) {
      silencio = !!on;
      for (const x of pares.values()) if (x.audio) x.audio.muted = silencio;
      aviso();
    },
  };
}
