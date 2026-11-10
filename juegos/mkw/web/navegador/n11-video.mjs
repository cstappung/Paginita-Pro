// N11 (plan v4, etapa E5; bitácora §229): el instrumento de la puerta. ¿Cuánto pide mandar la imagen del juego en
// video desde un PC a un teléfono, y cuánto tarda?
//
// Resumen: con ?n11=MBIT (solo para medir; nunca en la sala ni por omisión), la página toma la imagen del lienzo del
// juego (captureStream a 60), la codifica con el codificador de video del PC (WebRTC, como iría al teléfono) y la
// recibe en un segundo RTCPeerConnection DENTRO de la misma página (ida y vuelta por la placa de red de mentira de
// Chrome, sin red de verdad). Así se miden, sin construir nada del producto:
//   - los Mbit/s que de verdad salen con el tope pedido, y la calidad (el QP medio: cuanto más alto, más «bloques»);
//   - cuántas imágenes por segundo llegan y cuántas se pierden o descartan;
//   - lo que cuesta codificar y decodificar (ms por imagen) y la demora de la toma a la pantalla
//     (requestVideoFrameCallback: expectedDisplayTime − captureTime, los dos en el reloj de esta página).
// Como medir un enlace de radio con el transmisor y el receptor en la misma mesa unidos por un cable con atenuador:
// sale la potencia y la calidad de la modulación, no el camino del aire (la red se suma aparte).
// El receptor en la misma página decodifica en este PC: lo que cuesta en el PC sale un poco peor que en la realidad.
//
// Parámetros: ?n11=8 (tope en Mbit/s), &n11Alto=720 (alto de la imagen que sale: el teléfono va a 720, §113),
// &n11Codec=h264|vp8|vp9|av1 (por omisión h264: en Windows suele ir por la tarjeta), &n11Fps=60.
// &n11Colchon=MS = el colchón de llegada del receptor (jitterBufferTarget; un teléfono de N11 pediría 0).
// &n11Marca=1 = la demora de punta a punta con una marca: cada refresco, la imagen del juego se copia a un lienzo 2D
// del tamaño que sale (16:9, n11Alto de alto) con la hora pintada arriba a la izquierda en 24 cuadraditos blancos o
// negros (24 bits, de a 0,25 ms); el receptor lee los cuadraditos de cada imagen que va a mostrar y resta. Es la demora
// de verdad, de «la imagen está hecha» a «la imagen se ve» (la copia cuesta algo en el PC: no se usa al medir el costo).
// La demora de captureTime de requestVideoFrameCallback (demoraMs) no sirve: en la primera prueba daba ~198 ms fijos.
// window.mkwEstado.n11 = { muestras (una por segundo), info, resumen(desdeMs, hastaMs) }.

export function n11DeParametros(p) {
  const mbit = Number(p.get('n11'));
  if (!(mbit > 0)) return null;
  return { mbit, alto: Number(p.get('n11Alto')) || 720, codec: (p.get('n11Codec') || 'h264').toLowerCase(), fps: Number(p.get('n11Fps')) || 60,
           marca: p.get('n11Marca') === '1', colchon: p.has('n11Colchon') ? Number(p.get('n11Colchon')) : null };
}

// Lo que se resume de las muestras (cada una con los contadores acumulados de getStats en ese segundo)
export function resumirN11(muestras, desde = -Infinity, hasta = Infinity) {
  const m = muestras.filter(x => x.t >= desde && x.t <= hasta);
  if (m.length < 2) return null;
  const a = m[0], b = m.at(-1), s = (b.t - a.t) / 1000, d = k => (b[k] ?? 0) - (a[k] ?? 0);
  const r2 = x => Math.round(x * 100) / 100;
  const cod = d('framesEncoded'), dec = d('framesDecoded');
  const demoras = m.flatMap(x => x.demoras || []).sort((x, y) => x - y);
  const marcas = m.flatMap(x => x.marcas || []).sort((x, y) => x - y);
  const cuantil = (l, f) => l.length ? r2(l[Math.min(l.length - 1, Math.floor(f * l.length))]) : null;
  const q = f => cuantil(demoras, f);
  const motivos = {};
  for (const x of m) motivos[x.limitacion || '—'] = (motivos[x.limitacion || '—'] || 0) + 1;
  return {
    segundos: r2(s),
    mbitSalen: r2(d('bytesSent') * 8 / s / 1e6),             // lo que sale del codificador (con cabeceras RTP)
    imagenesCodificadas: r2(cod / s), imagenesDecodificadas: r2(dec / s),
    descartadas: d('framesDropped'), perdidosPaquetes: d('packetsLost'),
    qpMedio: cod ? r2(d('qpSum') / cod) : null,
    codificarMs: cod ? r2(d('totalEncodeTime') * 1000 / cod) : null,
    decodificarMs: dec ? r2(d('totalDecodeTime') * 1000 / dec) : null,
    // del primer paquete recibido de una imagen a tenerla decodificada (Chrome: totalProcessingDelay)
    procesarMs: dec ? r2(d('totalProcessingDelay') * 1000 / dec) : null,
    colchonMs: d('jitterBufferEmittedCount') ? r2(d('jitterBufferDelay') * 1000 / d('jitterBufferEmittedCount')) : null,
    envioMs: d('packetsSent') ? r2(d('totalPacketSendDelay') * 1000 / d('packetsSent')) : null,
    // la demora de la toma a la pantalla, imagen por imagen (mediana y percentil 90)
    demoraMs: { n: demoras.length, mediana: q(0.5), p90: q(0.9), p99: q(0.99) },
    // la de la marca pintada: de «la imagen está en el lienzo» a «se va a ver» (la que vale)
    marcaMs: { n: marcas.length, mediana: cuantil(marcas, 0.5), p90: cuantil(marcas, 0.9), p99: cuantil(marcas, 0.99) },
    tamano: `${b.ancho || '?'}×${b.alto || '?'}`, limitacion: motivos,
    codificador: b.codificador, decodificador: b.decodificador, porTarjeta: b.porTarjeta,
  };
}

export function instalarN11({ lienzo, opciones, nota = () => {} }) {
  const est = { muestras: [], info: { ...opciones }, fallo: null };
  est.resumen = (desde, hasta) => resumirN11(est.muestras, desde, hasta);
  if (!globalThis.RTCPeerConnection || !lienzo?.captureStream) { est.fallo = 'sin WebRTC o sin captureStream'; return est; }
  (async () => {
    const pa = new RTCPeerConnection(), pb = new RTCPeerConnection();
    pa.onicecandidate = e => { if (e.candidate) pb.addIceCandidate(e.candidate).catch(() => {}); };
    pb.onicecandidate = e => { if (e.candidate) pa.addIceCandidate(e.candidate).catch(() => {}); };
    // (con la marca: se capta el lienzo 2D con la hora pintada, ver arriba)
    const B = 24, origen = opciones.marca ? document.createElement('canvas') : lienzo;
    if (opciones.marca) {
      origen.height = opciones.alto; origen.width = Math.round(opciones.alto * 16 / 9);
      const g = origen.getContext('2d');
      const pinta = () => {
        try { g.drawImage(lienzo, 0, 0, origen.width, origen.height); } catch {}
        const v = Math.round(performance.now() * 4) & 0xFFFFFF;
        for (let k = 0; k < 24; k++) { g.fillStyle = (v >> k) & 1 ? '#fff' : '#000'; g.fillRect(k * B, 0, B, B); }
        requestAnimationFrame(pinta);
      };
      requestAnimationFrame(pinta);
    }
    const flujo = origen.captureStream(opciones.fps);
    const pista = flujo.getVideoTracks()[0];
    try { pista.contentHint = 'motion'; } catch {}
    const tr = pa.addTransceiver(pista, { direction: 'sendonly', streams: [flujo] });
    // el códec pedido primero (si el navegador no lo tiene, el que elija)
    const caps = RTCRtpSender.getCapabilities?.('video')?.codecs || [];
    const quiero = caps.filter(c => c.mimeType.toLowerCase() === 'video/' + opciones.codec);
    if (quiero.length && tr.setCodecPreferences) {
      // (H.264: primero el perfil «constrained baseline» con packetization-mode=1, el que todos los teléfonos decodifican)
      quiero.sort((x, y) => (/42e01f/.test(y.sdpFmtpLine || '') && /packetization-mode=1/.test(y.sdpFmtpLine || '') ? 1 : 0) -
                            (/42e01f/.test(x.sdpFmtpLine || '') && /packetization-mode=1/.test(x.sdpFmtpLine || '') ? 1 : 0));
      tr.setCodecPreferences([...quiero, ...caps.filter(c => !quiero.includes(c))]);
    } else est.info.codecFalta = opciones.codec;
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    video.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:36px;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(video);
    // &n11Colchon=MS: el colchón de llegada que pide el receptor (jitterBufferTarget; por omisión Chrome pone ~30 ms)
    pb.ontrack = e => { if (opciones.colchon !== null && 'jitterBufferTarget' in e.receiver) e.receiver.jitterBufferTarget = opciones.colchon; video.srcObject = e.streams[0] || new MediaStream([e.track]); video.play().catch(() => {}); };
    const oferta = await pa.createOffer(); await pa.setLocalDescription(oferta); await pb.setRemoteDescription(oferta);
    const resp = await pb.createAnswer(); await pb.setLocalDescription(resp); await pa.setRemoteDescription(resp);
    // el tope, el ritmo y el tamaño de lo que sale (el alto pedido: el lienzo se achica en el codificador)
    const fijar = async () => {
      const p = tr.sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = Math.round(opciones.mbit * 1e6);
      p.encodings[0].maxFramerate = opciones.fps;
      p.encodings[0].scaleResolutionDownBy = Math.max(1, (origen.height || opciones.alto) / opciones.alto);
      p.degradationPreference = 'maintain-framerate';
      try { await tr.sender.setParameters(p); } catch (e) { est.info.parametros = String(e?.message || e); }
    };
    await fijar();
    let altoAntes = lienzo.height;
    // la demora de cada imagen: cuándo se tomó (captureTime) y cuándo se va a ver (expectedDisplayTime)
    let demoras = [], marcas = [];
    const tira = document.createElement('canvas'); tira.width = 24 * B; tira.height = B;
    const gt = tira.getContext('2d', { willReadFrequently: true });
    if (video.requestVideoFrameCallback) {
      const cb = (ahora, md) => {
        if (md.captureTime > 0) demoras.push(md.expectedDisplayTime - md.captureTime);
        if (opciones.marca && video.videoWidth >= 24 * B) {
          gt.drawImage(video, 0, 0, 24 * B, B, 0, 0, 24 * B, B);
          const px = gt.getImageData(0, 0, 24 * B, B).data;
          let v = 0;
          for (let k = 0; k < 24; k++) { const o = ((B >> 1) * 24 * B + k * B + (B >> 1)) * 4; if (px[o] + px[o + 1] + px[o + 2] > 384) v |= 1 << k; }
          let d = (Math.round(md.expectedDisplayTime * 4) & 0xFFFFFF) - v;
          if (d < 0) d += 0x1000000;
          if (d < 4000) marcas.push(d / 4);                   // (más de 1 s: una lectura mala)
        }
        video.requestVideoFrameCallback(cb);
      };
      video.requestVideoFrameCallback(cb);
    } else est.info.sinDemora = 'sin requestVideoFrameCallback';
    setInterval(async () => {
      if (lienzo.height !== altoAntes) { altoAntes = lienzo.height; fijar(); }   // (SDL3 cambia el lienzo con la ventana)
      const x = { t: performance.now() };
      try {
        for (const r of (await pa.getStats()).values()) {
          if (r.type === 'outbound-rtp' && r.kind === 'video') Object.assign(x, { bytesSent: r.bytesSent, packetsSent: r.packetsSent, framesEncoded: r.framesEncoded,
            totalEncodeTime: r.totalEncodeTime, qpSum: r.qpSum, totalPacketSendDelay: r.totalPacketSendDelay, ancho: r.frameWidth, alto: r.frameHeight,
            limitacion: r.qualityLimitationReason, codificador: r.encoderImplementation, porTarjeta: r.powerEfficientEncoder });
          if (r.type === 'candidate-pair' && r.nominated) x.salidaDisponible = r.availableOutgoingBitrate;
        }
        for (const r of (await pb.getStats()).values()) {
          if (r.type === 'inbound-rtp' && r.kind === 'video') Object.assign(x, { framesDecoded: r.framesDecoded, framesDropped: r.framesDropped, packetsLost: r.packetsLost,
            totalDecodeTime: r.totalDecodeTime, totalProcessingDelay: r.totalProcessingDelay, jitterBufferDelay: r.jitterBufferDelay,
            jitterBufferEmittedCount: r.jitterBufferEmittedCount, decodificador: r.decoderImplementation });
        }
      } catch (e) { est.fallo = String(e?.message || e); }
      x.demoras = demoras; demoras = []; x.marcas = marcas; marcas = [];
      est.muestras.push(x);
      if (est.muestras.length > 1200) est.muestras.shift();
    }, 1000);
    nota(`n11 (§229): video ${opciones.codec} a ${opciones.mbit} Mbit/s, ${opciones.alto} de alto, ${opciones.fps} imágenes/s`);
  })().catch(e => { est.fallo = String(e?.message || e); nota(`n11: falla ${est.fallo}`); });
  return est;
}
