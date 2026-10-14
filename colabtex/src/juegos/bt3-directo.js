/* BT3: la pelea en vivo para los que miran, retransmitida de espectador en espectador.

   El juego no tiene modo espectador: la pelea existe solo en los computadores de los dos que pelean. Para que el
   resto de la sala la vea, uno de los peleadores (el «emisor»: el jugador 1, o el humano contra la CPU) manda la
   imagen y el sonido de su juego por WebRTC. Para no cargar al que pelea, **él le manda a uno solo**: cada
   espectador que ya la está viendo se la reenvía a dos más (un árbol), así que con muchos mirando el emisor sigue
   codificando un único video. Ejemplo con 5 mirando: el emisor → A; A → B y C; B → D y E.

   - El emisor lleva el árbol (`arbol`): a quien pide ver le dice de quién recibirla (`vir`, el primer espectador
     ya listo que tenga lugar, por orden de llegada, nunca uno de su propia rama), o que espere un momento
     (`vespera`) si nadie puede todavía. Cada espectador avisa cuando ya ve (`vya`) y desde ahí puede reenviar.
   - Si un espectador se va (`vfin`) o se cae, los que colgaban de él piden de nuevo (`vreve` del emisor, o solos
     al perder la conexión, diciendo quién se cayó: `cae`) y se cuelgan de otro, con toda su rama.
   - Cada reenvío decodifica y vuelve a codificar (unos 0,1–0,2 s más por salto); con 14 mirando son 3 saltos.

   Todo pasa por el buzón de la malla (`vivo/<pid>/rtc`, que cualquiera con sesión puede usar): mensajes `ver`,
   `vir`, `vespera`, `vreve`, `vya`, `vof` (oferta), `vans` (respuesta), `vcan` (candidatos), `vfin` y `vlleno`.
   La malla de la pelea los ignora (no traen su sesión), y aquí se ignoran los de ella.

   El video sale a 540 de alto, 30 cuadros y 1,5 Mb/s como mucho; el sonido es el del juego, tomado antes del
   volumen de quien juega (juegos/bt3/pagina.js), y cada espectador tiene su propio volumen.

   **Lo que lo hacía ir a 1 cuadro por segundo, y feo** (medido con WebRTC de verdad, tele/ en el banco):
   - Capturar el lienzo del juego (`captureStream`) lee de la tarjeta de video el cuadro ENTERO, del tamaño de la
     pantalla (1920×1080 o más), en cada cuadro: frena la tarjeta («GPU stall due to ReadPixels») y al juego mismo, y
     la captura quedaba en pocos cuadros. Ahora, si el juego avisa cada cuadro que dibuja (`alCuadro`: el parche
     llama a Module.onCuadro), ese cuadro se copia achicado a un lienzo propio de 540 de alto (`drawImage`, dentro
     de la tarjeta) hasta 30 veces por segundo, y se manda ese (`captureStream(0)` + `requestFrame`). Solo mientras
     alguien mira. Sin el aviso (un programa viejo), se captura el lienzo del juego como antes.
   - La conexión parte con ~300 kb/s y sube de a poco; con pocos cuadros casi no subía, y Chrome bajaba la
     resolución hasta 320×180 para cumplir. Ahora la respuesta del espectador se toca antes de usarla
     (`conArranque`: x-google-start-bitrate/min-bitrate) para partir en 1,2 Mb/s sin bajar de 400 kb/s, y se
     prefiere el equilibrio (`balanced`) entre cuadros y resolución.

   - `crearEmisor({senal, uid, canvas, audio, alCuadro})` (en el marco del juego que pelea).
   - `crearVisor({senal, uid, emisor, alVideo, alFalla})` (en la sala, para quien mira): recibe y reenvía. */
const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const ALTO = 540, BITS = 1500000, CUADROS = 30, COLCHON_MS = 300;
const ARRANQUE_KB = 1200, MINIMO_KB = 400;   // con qué ancho parte la conexión del video, y de cuánto no baja

/* La respuesta SDP del espectador, con el ancho de partida del video para quien manda (Chrome lee
   x-google-start-bitrate / x-google-min-bitrate del códec acordado): sin esto parte en ~300 kb/s y la imagen
   empieza borrosa y chica. Solo toca los códecs de video (no el rtx ni el red). */
export function conArranque(sdp) {
  if (typeof sdp !== "string") return sdp;
  const extra = `x-google-start-bitrate=${ARRANQUE_KB};x-google-min-bitrate=${MINIMO_KB}`;
  const fin = sdp.includes("\r\n") ? "\r\n" : "\n";
  const lineas = sdp.split(fin);
  let video = false;
  const pts = new Set();
  for (const l of lineas) {
    if (l.startsWith("m=")) video = l.startsWith("m=video");
    const m = video && /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(l);
    if (m) pts.add(m[1]);
  }
  const out = [], conFmtp = new Set();
  for (const l of lineas) {
    const f = /^a=fmtp:(\d+) (.*)$/.exec(l);
    if (f && pts.has(f[1])) { conFmtp.add(f[1]); out.push(/x-google-start-bitrate/.test(l) ? l : l + ";" + extra); }
    else out.push(l);
  }
  // los que no traían fmtp (VP8): uno nuevo, justo después de su rtpmap
  for (let i = out.length - 1; i >= 0; i--) {
    const m = /^a=rtpmap:(\d+) /.exec(out[i]);
    if (m && pts.has(m[1]) && !conFmtp.has(m[1])) out.splice(i + 1, 0, `a=fmtp:${m[1]} ${extra}`);
  }
  return out.join(fin);
}
export const DIRECTOS = 1;       // a cuántos les manda el que pelea
export const RELEVO = 2;         // a cuántos les reenvía cada espectador
export const MAX_VISORES = 14;   // cuántos pueden mirar una pelea

/* Una fuente: le entrega sus pistas (video y sonido) a quien se las pida, como mucho a `max` a la vez. La usan el
   emisor (con el lienzo del juego) y cada espectador que reenvía (con lo que recibe; `sesion`: solo atiende a
   quien le pide a esa sesión suya). No escucha el buzón: le pasan los mensajes (`alMensaje`). */
function crearFuente({ senal, uid, pistas, max, sesion = null, RTC }) {
  const visores = new Map();   // "<de>|<s>" → {pc, cola, remota}
  function cierraUno(k) {
    const x = visores.get(k);
    if (!x) return;
    visores.delete(k);
    try { x.pc.close(); } catch (e) {}
  }
  async function alMensaje(de, m) {
    if (!m || typeof m.t !== "string" || typeof m.s !== "string" || de === uid) return;
    const k = de + "|" + m.s;
    try {
      if (m.t === "ver") {
        if (sesion ? m.rs !== sesion : !!m.rs) return;
        const ps = pistas().filter(t => t && t.readyState !== "ended");
        if ((!visores.has(k) && visores.size >= max) || !ps.some(t => t.kind === "video")) { senal.envia(de, { t: "vlleno", s: m.s }); return; }
        cierraUno(k);
        const pc = new RTC({ iceServers: ICE }), x = { pc, cola: [], remota: false };
        visores.set(k, x);
        const flujo = new MediaStream(ps);
        let envio = null;
        for (const tr of ps) { const e = pc.addTrack(tr, flujo); if (tr.kind === "video") envio = e; }
        /* H.264 primero: Chrome y Edge lo comprimen con la tarjeta de video (VP8, el de siempre, casi siempre con el
           procesador, que es el del juego). Si este navegador no lo tiene, queda el orden de siempre. */
        try {
          const tv = pc.getTransceivers().find(x => x.sender === envio), cods = RTCRtpSender.getCapabilities?.("video")?.codecs || [];
          const h264 = cods.filter(c => /h264/i.test(c.mimeType));
          if (tv && h264.length && tv.setCodecPreferences) tv.setCodecPreferences([...h264, ...cods.filter(c => !/h264/i.test(c.mimeType))]);
        } catch (e) {}
        pc.onicecandidate = e => { if (e.candidate) senal.envia(de, { t: "vcan", s: m.s, d: e.candidate.toJSON() }); };
        pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") cierraUno(k); };
        const o = await pc.createOffer();
        await pc.setLocalDescription(o);
        try {   // liviano: alto, cuadros y bits con tope
          const p = envio.getParameters();
          if (!p.encodings || !p.encodings.length) p.encodings = [{}];
          const alto = ps.find(t => t.kind === "video")?.getSettings?.().height || ALTO;
          Object.assign(p.encodings[0], { maxBitrate: BITS, maxFramerate: CUADROS, scaleResolutionDownBy: Math.max(1, alto / ALTO) });
          p.degradationPreference = "balanced";
          await envio.setParameters(p);
        } catch (e) {}
        senal.envia(de, { t: "vof", s: m.s, d: { type: o.type, sdp: o.sdp } });
      } else if (m.t === "vans") {
        const x = visores.get(k);
        if (!x || x.pc.signalingState !== "have-local-offer") return;
        await x.pc.setRemoteDescription({ type: m.d.type, sdp: conArranque(m.d.sdp) });
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
      console.warn("[directo] fuente", m.t, e);
    }
  }
  return {
    alMensaje,
    cuantos: () => visores.size,
    // lo recibido cambió (el espectador se colgó de otro): lo que reenvía pasa a ser lo nuevo, sin cortar
    cambia(nuevas) {
      for (const x of visores.values()) for (const e of x.pc.getSenders()) {
        const t = nuevas.find(n => n.kind === e.track?.kind);
        if (t) e.replaceTrack(t).catch(() => {});
      }
    },
    suelta: cierraUno,   // (el árbol lo sacó: deja de contarlo aunque su conexión todavía no se haya cortado)
    cierra() { for (const k of [...visores.keys()]) cierraUno(k); },
  };
}

export function crearEmisor({ senal, uid, canvas, audio = () => null, alCuadro = null, RTC = globalThis.RTCPeerConnection, max = DIRECTOS, total = MAX_VISORES, relevo = RELEVO }) {
  let pista = null, sueltaCuadro = null;
  /* Una sola captura para todo. Con el aviso de cada cuadro (alCuadro), una copia chica del lienzo del juego (540 de
     alto, el ancho según su forma), hecha justo después de que el juego dibuja: ahí el lienzo todavía tiene el
     cuadro (después de mostrarlo el navegador lo puede borrar). Sin el aviso, el lienzo del juego entero. */
  const video = () => {
    if (pista && pista.readyState !== "ended") return pista;
    sueltaCuadro?.();
    sueltaCuadro = null;
    const chico = alCuadro && typeof document !== "undefined" ? document.createElement("canvas") : null;
    const c2 = chico?.getContext?.("2d", { alpha: false });
    if (c2 && chico.captureStream) {
      chico.width = 960; chico.height = ALTO;
      pista = chico.captureStream(0).getVideoTracks()[0];
      /* El juego primero: la copia corre dentro del cuadro del juego, así que se mide cuánto tarda (promedio) y se
         espacia para no pasar del 10% de su tiempo. Rápida (una tarjeta de video que copia en 1 ms): 30 por segundo;
         cara (44 ms a 1080p en una máquina sin tarjeta de video): menos cuadros para el que mira, y el que pelea no se
         traba. Antes iba siempre a 30 y, con alguien mirando, el juego caía a la mitad. */
      /* Y pareja: se copia 1 de cada `paso` cuadros del juego (contando cuadros, no midiendo tiempo), al ritmo más alto
         de 30, 15, 10 o 5 que deje la copia bajo el 10%; el paso se revisa cada 90 cuadros, para que no salte. Un ritmo
         parejo se ve fluido; uno que va y viene (lo que pasaba al espaciar por tiempo) se ve a tirones. 24 no: el juego
         va a 30 y sacar 24 es botar 1 de cada 5, a saltos. */
      let costo = 1, n = 0, paso = 1, previo = 0, cadaCuadro = 1000 / 60;
      sueltaCuadro = alCuadro(() => {
        const ahora = performance.now();
        if (previo) cadaCuadro = cadaCuadro * 0.95 + Math.min(100, ahora - previo) * 0.05;   // (cuánto dura un cuadro del juego)
        previo = ahora;
        if (!fuente.cuantos() || !canvas.width || !canvas.height) return;   // (nadie mirando: nada)
        if (n % 90 === 0) {
          const ritmo = costo <= 100 / 30 ? 30 : costo <= 100 / 15 ? 15 : costo <= 10 ? 10 : 5;
          paso = Math.max(1, Math.round(1000 / cadaCuadro / ritmo));
        }
        if (n++ % paso) return;
        const ancho = Math.max(2, Math.round(ALTO * canvas.width / canvas.height / 2) * 2);   // (par: lo pide el códec)
        if (chico.width !== ancho) chico.width = ancho;
        try { c2.drawImage(canvas, 0, 0, ancho, ALTO); pista.requestFrame?.(); } catch (e) {}
        costo = costo * 0.8 + (performance.now() - ahora) * 0.2;
      });
    } else {
      pista = canvas.captureStream(CUADROS).getVideoTracks()[0];
    }
    try { pista.contentHint = "motion"; } catch (e) {}
    return pista;
  };
  const fuente = crearFuente({ senal, uid, max, RTC, pistas: () => [video(), audio()].filter(Boolean) });
  /* El árbol de los que miran: "<de>|<s>" → {de, s, padre ("" = el emisor), hijos, listo, orden}. */
  const arbol = new Map();
  let llegada = 0;
  const directos = () => [...arbol.values()].filter(n => n.padre === "").length;
  const deRama = (k, raiz) => { for (let x = arbol.get(k); x; x = arbol.get(x.padre)) if (x.k === raiz) return true; return false; };
  function suelta(k) {   // quita a k de su padre (sus hijos siguen colgando de él)
    const n = arbol.get(k);
    if (n && n.padre && arbol.get(n.padre)) arbol.get(n.padre).hijos.delete(k);
    if (n) n.padre = null;
  }
  function quita(k) {    // se fue: los que colgaban de él piden de nuevo
    const n = arbol.get(k);
    if (!n) return;
    suelta(k);
    arbol.delete(k);
    fuente.suelta(k);   // si era el directo y se cayó sin avisar, su lugar queda libre ya
    for (const h of n.hijos) { const c = arbol.get(h); if (c) { c.padre = null; senal.envia(c.de, { t: "vreve", s: c.s }); } }
  }
  function alMensaje(de, m) {
    if (!m || typeof m.t !== "string" || m.t[0] !== "v" || typeof m.s !== "string" || de === uid) return;
    const k = de + "|" + m.s;
    if (m.t === "ver" && !m.rs) {
      if (typeof m.cae === "string" && m.cae !== k && arbol.has(m.cae)) quita(m.cae);   // el de arriba se cayó
      let n = arbol.get(k);
      if (!n && arbol.size >= total) { senal.envia(de, { t: "vlleno", s: m.s }); return; }
      if (!n) { n = { k, de, s: m.s, padre: null, hijos: new Set(), listo: false, orden: llegada++ }; arbol.set(k, n); }
      suelta(k);
      if (directos() < max) {
        n.padre = "";
        return fuente.alMensaje(de, m);   // se la manda el emisor mismo
      }
      // el primero (por orden de llegada) que ya ve, con lugar, y que no sea de su propia rama
      const padre = [...arbol.values()].filter(x => x.listo && x.k !== k && x.padre !== null && x.hijos.size < relevo && !deRama(x.k, k))
        .sort((a, b) => a.orden - b.orden)[0];
      if (!padre) { senal.envia(de, { t: "vespera", s: m.s }); return; }
      n.padre = padre.k;
      padre.hijos.add(k);
      senal.envia(de, { t: "vir", s: m.s, a: padre.de, as: padre.s });
    } else if (m.t === "vya") {
      const n = arbol.get(k);
      if (n) n.listo = true;
    } else if (m.t === "vfin") {
      quita(k);
      return fuente.alMensaje(de, m);
    } else {
      return fuente.alMensaje(de, m);
    }
  }
  const off = senal.alMensajes(alMensaje);
  return {
    cuantos: () => fuente.cuantos(),
    arbol: () => [...arbol.values()].map(n => ({ k: n.k, padre: n.padre, listo: n.listo, hijos: [...n.hijos] })),
    cierra() {
      off?.();
      fuente.cierra();
      sueltaCuadro?.();
      try { pista?.stop(); } catch (e) {}
    },
  };
}

export function crearVisor({ senal, uid, emisor, alVideo, alFalla = () => {}, RTC = globalThis.RTCPeerConnection, espera = 30000, relevo = RELEVO }) {
  const s = Math.random().toString(36).slice(2, 10);   // este pedido (si pide de nuevo, es otro)
  let pc = null, remota = false, vivo = true, padre = emisor, padreS = null, flujo = null, visto = false, reloj = 0, reintento = 0, plazo = 0, corte = 0;
  let cola = [];
  // lo que recibe, lo reenvía a los que el emisor le cuelgue (solo a quien le pide a esta sesión)
  const fuente = crearFuente({ senal, uid, sesion: s, max: relevo, RTC, pistas: () => flujo ? flujo.getTracks() : [] });
  const armaReloj = () => { clearTimeout(reloj); reloj = setTimeout(() => { if (vivo && !visto) alFalla("sin-respuesta"); }, espera); };
  function cierraPc() { try { pc?.close(); } catch (e) {} pc = null; remota = false; cola = []; }
  // pedirle al emisor de quién recibirla (cae: la fuente que se cayó, para que la saque del árbol)
  function pide(cae) {
    if (!vivo) return;
    if (padre !== emisor && padreS) senal.envia(padre, { t: "vfin", s });   // (si el de arriba sigue ahí, que suelte)
    cierraPc();
    padre = emisor; padreS = null;
    senal.envia(emisor, cae ? { t: "ver", s, cae } : { t: "ver", s });
  }
  async function alMensaje(de, m) {
    if (!vivo || !m || typeof m.t !== "string" || m.s !== s) return;
    try {
      if (de === emisor && m.t === "vir" && typeof m.a === "string" && typeof m.as === "string") {
        padre = m.a; padreS = m.as;
        senal.envia(padre, { t: "ver", s, rs: padreS });
        // si ese espectador no contesta (se cayó sin avisar), se le dice al emisor y se pide otro
        clearTimeout(plazo);
        const a = padre, as = padreS;
        plazo = setTimeout(() => { if (vivo && padre === a && padreS === as && !remota) pide(a + "|" + as); }, 6000);
      } else if (de === emisor && m.t === "vespera") {
        clearTimeout(reintento); reintento = setTimeout(() => pide(), 1500);
      } else if (de === emisor && m.t === "vreve") {
        pide();
      } else if (m.t === "vlleno" && de === padre) {
        if (de === emisor) { clearTimeout(reloj); alFalla("lleno"); }
        else { clearTimeout(reintento); reintento = setTimeout(() => pide(), 1000); }
      } else if (m.t === "vof" && de === padre) {
        clearTimeout(plazo);
        cierraPc();
        const este = pc = new RTC({ iceServers: ICE });
        este.ontrack = e => {
          // un colchón: el navegador junta 300 ms antes de mostrar y reparte los cuadros parejo (mirar con un poco de
          // retraso da igual; a tirones no)
          try { e.receiver.jitterBufferTarget = COLCHON_MS; } catch (err) {}
          const nuevo = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
          if (flujo !== nuevo) {
            const antes = flujo;
            flujo = nuevo;
            if (antes) fuente.cambia(flujo.getTracks());
            alVideo(flujo);
          } else fuente.cambia(flujo.getTracks());
          if (e.track.kind === "video" && !visto) { visto = true; clearTimeout(reloj); }
          if (e.track.kind === "video") senal.envia(emisor, { t: "vya", s });   // desde ya puede reenviar
        };
        este.onicecandidate = e => { if (e.candidate) senal.envia(padre, { t: "vcan", s, d: e.candidate.toJSON() }); };
        este.onconnectionstatechange = ev => {
          if (pc !== este || !vivo) return;
          clearTimeout(corte);
          // «disconnected» a veces vuelve solo; si sigue así 4 s, se da por caída
          if (este.connectionState === "disconnected") corte = setTimeout(() => { if (pc === este && este.connectionState === "disconnected") este.onconnectionstatechange({ caida: true }); }, 4000);
          if (este.connectionState === "failed" || este.connectionState === "closed" || (ev && ev.caida)) {
            // se cayó la fuente: si era un espectador, se le avisa al emisor para que lo saque del árbol
            if (padre !== emisor) pide(padre + "|" + padreS); else if (visto) pide(); else alFalla("sin-conexion");
          }
        };
        await este.setRemoteDescription(m.d);
        remota = true;
        for (const c of cola.splice(0)) await este.addIceCandidate(c).catch(() => {});
        const r = await este.createAnswer();
        await este.setLocalDescription(r);
        senal.envia(padre, { t: "vans", s, d: { type: r.type, sdp: r.sdp } });
      } else if (m.t === "vcan" && de === padre) {
        if (remota && pc) await pc.addIceCandidate(m.d).catch(() => {});
        else cola.push(m.d);
      }
    } catch (e) {
      console.warn("[directo] visor", m.t, e);
    }
  }
  // un solo oyente del buzón: lo de esta sesión es para el visor; el resto, para lo que reenvía
  const off = senal.alMensajes((de, m) => {
    if (m && m.s === s) alMensaje(de, m);
    else fuente.alMensaje(de, m);
  });
  armaReloj();
  senal.envia(emisor, { t: "ver", s });
  return {
    reenvia: () => fuente.cuantos(),
    // cómo está llegando el video (para mostrarlo): cuadros por segundo, tamaño y bytes recibidos hasta ahora
    async calidad() {
      if (!pc) return null;
      let r = null;
      try { (await pc.getStats()).forEach(x => { if (x.type === "inbound-rtp" && x.kind === "video") r = x; }); } catch (e) {}
      return r && { fps: r.framesPerSecond || 0, ancho: r.frameWidth || 0, alto: r.frameHeight || 0, bytes: r.bytesReceived || 0 };
    },
    cierra() {
      if (!vivo) return;
      vivo = false;
      clearTimeout(reloj); clearTimeout(reintento); clearTimeout(plazo); clearTimeout(corte);
      off?.();
      senal.envia(emisor, { t: "vfin", s });
      if (padre !== emisor) senal.envia(padre, { t: "vfin", s });
      fuente.cierra();
      cierraPc();
    },
  };
}
