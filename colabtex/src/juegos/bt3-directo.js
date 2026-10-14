/* BT3: la pelea en vivo para los que miran.

   El juego no tiene modo espectador: la pelea existe solo en los computadores de los dos que pelean (cada uno
   calcula la misma pelea con los botones de los dos). Para que el resto de la sala la vea, uno de los
   peleadores (el «emisor»: el jugador 1, o el humano contra la CPU) manda la imagen de su pantalla como video
   por WebRTC a cada uno que la pida. Nada de esto pasa por Firebase salvo la presentación, por el mismo buzón
   de la malla (`vivo/<pid>/rtc`, que cualquiera con sesión puede usar para presentarse): mensajes `ver`,
   `vof` (oferta), `vans` (respuesta), `vcan` (candidatos), `vfin` y `vlleno`. La malla de la pelea los ignora
   (no traen su sesión), y aquí se ignoran los de ella.

   Para no cargar al que juega: el video sale a unos 540 de alto, 30 cuadros y 1,5 Mb/s como mucho (el
   navegador lo codifica, casi siempre con la tarjeta de video), solo cuando alguien lo pide y a lo más a
   seis a la vez. Sin audio: el sonido del juego se queda con quien juega.

   - `crearEmisor({senal, uid, canvas})` (en el marco del juego que pelea): contesta los pedidos.
   - `crearVisor({senal, uid, emisor, alVideo, alFalla})` (en la sala, para quien mira): pide y muestra. */
const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const ALTO = 540, BITS = 1500000, MAX_VISORES = 6;

export function crearEmisor({ senal, uid, canvas, RTC = globalThis.RTCPeerConnection, max = MAX_VISORES }) {
  const visores = new Map();   // "<de>|<s>" → {pc, cola, remota}
  let pista = null;
  // una sola captura del lienzo para todos los que miran
  const captura = () => {
    if (!pista || pista.readyState === "ended") {
      pista = canvas.captureStream(30).getVideoTracks()[0];
      try { pista.contentHint = "motion"; } catch (e) {}
    }
    return pista;
  };
  function cierraUno(k) {
    const x = visores.get(k);
    if (!x) return;
    visores.delete(k);
    try { x.pc.close(); } catch (e) {}
  }
  async function alMensaje(de, m) {
    if (!m || typeof m.t !== "string" || m.t[0] !== "v" || typeof m.s !== "string" || de === uid) return;
    const k = de + "|" + m.s;
    try {
      if (m.t === "ver") {
        if (!visores.has(k) && visores.size >= max) { senal.envia(de, { t: "vlleno", s: m.s }); return; }
        cierraUno(k);
        const pc = new RTC({ iceServers: ICE }), x = { pc, cola: [], remota: false };
        visores.set(k, x);
        const tr = captura(), envio = pc.addTrack(tr, new MediaStream([tr]));
        pc.onicecandidate = e => { if (e.candidate) senal.envia(de, { t: "vcan", s: m.s, d: e.candidate.toJSON() }); };
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") cierraUno(k); };
        const o = await pc.createOffer();
        await pc.setLocalDescription(o);
        try {   // liviano para el que juega: alto, cuadros y bits con tope
          const p = envio.getParameters();
          if (!p.encodings || !p.encodings.length) p.encodings = [{}];
          Object.assign(p.encodings[0], { maxBitrate: BITS, maxFramerate: 30, scaleResolutionDownBy: Math.max(1, (canvas.height || ALTO) / ALTO) });
          p.degradationPreference = "maintain-framerate";
          await envio.setParameters(p);
        } catch (e) {}
        senal.envia(de, { t: "vof", s: m.s, d: { type: o.type, sdp: o.sdp } });
      } else if (m.t === "vans") {
        const x = visores.get(k);
        if (!x || x.pc.signalingState !== "have-local-offer") return;
        await x.pc.setRemoteDescription(m.d);
        x.remota = true;
        for (const c of x.cola.splice(0)) await x.pc.addIceCandidate(c).catch(() => {});
      } else if (m.t === "vcan") {
        const x = visores.get(k);
        if (!x) return;
        if (x.remota) await x.pc.addIceCandidate(m.d).catch(() => {});
        else x.cola.push(m.d);
      } else if (m.t === "vfin") {
        cierraUno(k);
      }
    } catch (e) {
      console.warn("[directo] emisor", m.t, e);
    }
  }
  const off = senal.alMensajes(alMensaje);
  return {
    cuantos: () => visores.size,
    cierra() {
      off?.();
      for (const k of [...visores.keys()]) cierraUno(k);
      try { pista?.stop(); } catch (e) {}
    },
  };
}

export function crearVisor({ senal, uid, emisor, alVideo, alFalla = () => {}, RTC = globalThis.RTCPeerConnection, espera = 20000 }) {
  const s = Math.random().toString(36).slice(2, 10);   // este pedido (si pide de nuevo, es otro)
  let pc = null, remota = false, vivo = true;
  const cola = [];
  const reloj = setTimeout(() => { if (vivo) alFalla("sin-respuesta"); }, espera);
  async function alMensaje(de, m) {
    if (!vivo || de !== emisor || !m || m.s !== s) return;
    try {
      if (m.t === "vlleno") {
        clearTimeout(reloj);
        alFalla("lleno");
      } else if (m.t === "vof") {
        try { pc?.close(); } catch (e) {}
        pc = new RTC({ iceServers: ICE });
        pc.ontrack = e => { clearTimeout(reloj); alVideo(e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track])); };
        pc.onicecandidate = e => { if (e.candidate) senal.envia(emisor, { t: "vcan", s, d: e.candidate.toJSON() }); };
        pc.onconnectionstatechange = () => { if (pc && pc.connectionState === "failed") alFalla("sin-conexion"); };
        await pc.setRemoteDescription(m.d);
        remota = true;
        for (const c of cola.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        const r = await pc.createAnswer();
        await pc.setLocalDescription(r);
        senal.envia(emisor, { t: "vans", s, d: { type: r.type, sdp: r.sdp } });
      } else if (m.t === "vcan") {
        if (remota && pc) await pc.addIceCandidate(m.d).catch(() => {});
        else cola.push(m.d);
      }
    } catch (e) {
      console.warn("[directo] visor", m.t, e);
    }
  }
  const off = senal.alMensajes(alMensaje);
  senal.envia(emisor, { t: "ver", s });
  return {
    cierra() {
      if (!vivo) return;
      vivo = false;
      clearTimeout(reloj);
      off?.();
      senal.envia(emisor, { t: "vfin", s });
      try { pc?.close(); } catch (e) {}
    },
  };
}
