/* Una malla de datos entre navegadores: WebRTC DataChannel, sin servidor.

   Es la hermana de `voz.js` y usa el mismo buzón de señalización (`senal`:
   quién está y los mensajes de oferta, respuesta y candidatos), así que no
   sabe de Firebase y se prueba con uno de mentira. Por aquí viaja el
   directo de Yemas: dónde está cada huevo, sus disparos, sus golpes y los
   zombis del director. Por la base pasaba todo eso doce veces por segundo y
   a cada jugador le llegaba el de todos los demás, o sea N² descargas que
   pagaba la cuota diaria; por aquí no se paga nada.

   Lo que la sostiene, además de lo que ya sostenía la voz (ofrece el uid
   menor, cada entrada es una sesión, los candidatos esperan en cola):

   - **El canal no espera ni reenvía** (`ordered: false, maxRetransmits: 0`).
     Un estado viejo no sirve de nada cuando ya salió el siguiente, y
     esperar a que llegue uno perdido frenaría a todos los que vienen
     detrás. Cada estado lleva un número que solo crece (`q`) y quien
     recibe se queda con el mayor.
   - **El canal se negocia a mano** (`negotiated: true, id: 0`), igual en
     los dos lados: no hay que esperar al `ondatachannel` del otro.
   - **Cada intento tiene su número** (`k`). Si un canal se cae, quien
     ofrece vuelve a ofrecer con una conexión nueva, y los candidatos que
     llegan tarde del intento anterior se reconocen y se tiran.
   - **Sano es «el canal está abierto y la conexión no se cortó»**, no «me
     llegó algo hace poco»: una pestaña oculta deja de mandar y su canal
     sigue sano, igual que antes su entrada en la base seguía ahí.

   El límite es el de la voz: solo STUN. El par que no logra conectarse no
   pasa por la base: se lo sirve un tercero que tenga canal con los dos
   (ver `yemas-red.js`). */

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const LLENO = 1 << 18;          // lo que se deja en cola sin enviar antes de saltarse estados
const VIGILA_MS = 1000;

export function crearMalla({ uid, senal, quiere = () => true, alDatos = () => {}, alCambiar = () => {},
  RTC = globalThis.RTCPeerConnection, ahora = () => Date.now() }) {
  let sesion = "", offP = null, offM = null, reloj = null, intento = 0;
  const pares = new Map();          // uid → {pc, dc, s, k, cola, remota, desde, abrio, malDesde}
  const presentes = new Map();      // uid → sesión
  const fallos = new Map();         // uid → intentos seguidos que nunca abrieron

  const sanoX = x => {
    if (!x || x.dc.readyState !== "open") return false;
    const st = x.pc.connectionState || x.pc.iceConnectionState;
    return st !== "failed" && st !== "closed" && st !== "disconnected";
  };

  function cierra(u) {
    const x = pares.get(u);
    if (!x) return;
    pares.delete(u);
    try { x.dc.close(); } catch {}
    try { x.pc.close(); } catch {}
  }

  function nuevoPar(u, s, k) {
    cierra(u);
    const pc = new RTC({ iceServers: ICE });
    const dc = pc.createDataChannel("directo", { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
    const x = { pc, dc, s, k, cola: [], remota: false, abrio: false, malDesde: ahora() };
    pares.set(u, x);
    const mio = () => pares.get(u) === x;
    dc.onopen = () => { if (mio()) { x.abrio = true; x.malDesde = 0; alCambiar(); } };
    dc.onclose = () => { if (mio()) alCambiar(); };
    dc.onmessage = ev => {
      if (!mio() || typeof ev.data !== "string") return;
      let d;
      try { d = JSON.parse(ev.data); } catch { return; }
      alDatos(u, d);
    };
    pc.onicecandidate = e => {
      if (e.candidate && mio()) senal.envia(u, { t: "ice", s: sesion, a: s, k, d: e.candidate.toJSON() });
    };
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
      senal.envia(u, { t: "oferta", s: sesion, a: s, k, d: { type: o.type, sdp: o.sdp } });
    } catch (e) {
      console.warn("[malla] oferta", e);
    }
  }

  async function vacia(x) {
    x.remota = true;
    for (const c of x.cola.splice(0)) await x.pc.addIceCandidate(c).catch(() => {});
  }

  async function alMensaje(de, m) {
    if (!sesion || !m || m.a !== sesion || de === uid || typeof de !== "string") return;
    let x = pares.get(de);
    try {
      if (m.t === "oferta") {
        // Solo ofrece el menor; una oferta del mayor es un resto o un intruso.
        if (!(de < uid) || !quiere(de)) return;
        x = nuevoPar(de, m.s, m.k);
        await x.pc.setRemoteDescription(m.d);
        await vacia(x);
        const r = await x.pc.createAnswer();
        if (pares.get(de) !== x) return;
        await x.pc.setLocalDescription(r);
        senal.envia(de, { t: "respuesta", s: sesion, a: m.s, k: m.k, d: { type: r.type, sdp: r.sdp } });
      } else if (m.t === "respuesta") {
        if (!x || x.s !== m.s || x.k !== m.k || x.pc.signalingState !== "have-local-offer") return;
        await x.pc.setRemoteDescription(m.d);
        await vacia(x);
      } else if (m.t === "ice") {
        if (!x || x.s !== m.s || x.k !== m.k) return;
        if (x.remota) await x.pc.addIceCandidate(m.d).catch(() => {});
        else x.cola.push(m.d);
      }
    } catch (e) {
      console.warn("[malla] señal", m.t, e);
    }
  }

  // Quién está y con quién toca conectarse. También se llama cuando cambia
  // `quiere` (alguien entró a la sala o se fue).
  function revisa() {
    if (!sesion) return;
    for (const [u, x] of [...pares]) if (presentes.get(u) !== x.s || !quiere(u)) cierra(u);
    for (const [u, s] of presentes) {
      if (pares.has(u) || !quiere(u)) continue;
      if (uid < u) ofrece(u, s);
      // Si ofrece el otro, el par se arma cuando llega su oferta.
    }
    alCambiar();
  }

  function alPresentes(v) {
    presentes.clear();
    for (const [u, s] of Object.entries(v || {})) if (u !== uid && typeof s === "string") presentes.set(u, s);
    revisa();
  }

  /* Quien ofrece vuelve a intentar cuando el canal no está sano: pronto si
     llegó a abrir y se cortó (una red que cambió), cada vez más espaciado si
     nunca abrió (dos redes que no se dejan conectar no van a cambiar de
     opinión cada diez segundos). */
  function vigila() {
    const t = ahora();
    for (const [u, x] of [...pares]) {
      if (sanoX(x)) { x.malDesde = 0; x.abrio = true; fallos.delete(u); continue; }
      if (!x.malDesde) x.malDesde = t;
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
    if (sesion || typeof RTC !== "function") return false;
    sesion = Math.random().toString(36).slice(2, 10);
    offM = senal.alMensajes(alMensaje);
    try { await senal.entra(sesion); }
    catch (e) {
      // Sin permiso para presentarse (un mirón con las reglas viejas): sin malla.
      offM?.(); offM = null; sesion = "";
      return false;
    }
    if (!sesion) return false;
    offP = senal.alPresentes(alPresentes);
    reloj = setInterval(vigila, VIGILA_MS);
    return true;
  }

  function salir() {
    if (!sesion) return;
    sesion = "";
    offP?.(); offM?.();
    offP = offM = null;
    clearInterval(reloj);
    for (const u of [...pares.keys()]) cierra(u);
    presentes.clear();
    senal.sale();
    alCambiar();
  }

  // A todos los pares con canal sano, o solo a los de `a`.
  function envia(obj, a = null) {
    let txt = null;
    for (const [u, x] of pares) {
      if (a && !a.includes(u)) continue;
      if (!sanoX(x) || x.dc.bufferedAmount > LLENO) continue;
      if (txt === null) txt = JSON.stringify(obj);
      try { x.dc.send(txt); } catch {}
    }
  }

  return {
    entrar, salir, envia, revisa,
    activa: () => !!sesion,
    sano: u => sanoX(pares.get(u)),
    presentes: () => [...presentes.keys()],
    conectados: () => [...pares].filter(([, x]) => sanoX(x)).map(([u]) => u),
  };
}
