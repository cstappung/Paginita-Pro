// La red de la Wii dentro de la página: sockets UDP y TCP falsos, IP inventadas y DNS propio — bitácora §58 (F0).
//
// Resumen: el juego, para jugar en línea, abre "sockets" (enchufes de red) como cualquier programa: UDP (paquetes
// sueltos, como cartas) y TCP (una conversación ordenada, como una llamada). En el navegador no hay sockets de
// verdad, así que web/red/red_web.cpp le entrega al juego unas funciones socket/bind/connect/sendto/recvfrom/poll… que
// llegan aquí. Este archivo es esa "red de juguete":
//   - una PILA por máquina (la del juego de esta pestaña, o la del servidor WFC virtual escrito en JS), con su IP
//     inventada (10.77.0.N). La pila lleva la cuenta de cada socket: puerto, cola de paquetes, conexión TCP…
//   - un ENLACE que lleva los paquetes de una pila a otra: en el banco, un conmutador en memoria (crearConmutador);
//     en el sitio, los canales WebRTC entre navegadores (F2). UDP va "sin garantía" (puede perderse, como en la
//     Wii) y TCP "fiable y en orden" — sobre un canal fiable el TCP se vuelve muy simple: abrir, datos, cerrar.
//   - el DNS: nombres → IP desde una tabla (p. ej. todo *.nintendowifi.net y *.rwfc.net → el WFC virtual).
// Nada de esto toca internet: es una red de mentira, solo entre los jugadores de la sala.
//
// Uso (la pila del juego):  const pila = crearPila({ ip: '10.77.0.2', enlace, dns: nombre => '10.77.0.1' });
//                            Module.mkwRed = pila;     // red_web.cpp la llama
// Uso (un servidor en JS):   pila.servidorTcp(80, con => { con.alRecibir(b => con.enviar(b)); });   // eco
//                            pila.udp(27900, (datos, ip, puerto, responder) => responder(datos));

// Errores: el mismo número que espera red_web.cpp (que lo traduce al errno de C)
export const ERR = { AGAIN: 1, INPROGRESS: 2, ALREADY: 3, ISCONN: 4, NOTCONN: 5, CONNREFUSED: 6, CONNRESET: 7,
  ADDRINUSE: 8, BADF: 9, INVAL: 10, NETUNREACH: 11, MFILE: 12, TIMEDOUT: 13, PIPE: 14, NOPROTOOPT: 15 };
// Estados que devuelve listo(fd), como los bits de poll(): se puede leer, escribir, hubo error, se cortó
export const LEER = 1, ESCRIBIR = 4, FALLO = 8, CORTE = 16;
export const UDP = 2, TCP = 1;

// IP en texto ↔ número de 32 bits (10.77.0.2 ↔ 0x0A4D0002)
export const ipNumero = t => t.split('.').reduce((n, x) => (n * 256 + (x | 0)) >>> 0, 0);
export const ipTexto = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

const MAX_SOCKETS = 256;
const MAX_COLA_UDP = 256;                 // paquetes UDP esperando a ser leídos (más viejos se tiran, como la Wii)
const PRIMER_FD = 0x7000;                 // números de socket propios (para no chocar con los archivos)

// espia(par, datos): ve cada trozo TCP que esta pila manda (vr.mjs lo usa para leer el VR que informa el juego)
export function crearPila({ ip, enlace, dns = () => null, registro = null, espia = null }) {
  const miIp = typeof ip === 'number' ? ip >>> 0 : ipNumero(ip);
  const socks = new Map();                // fd → socket
  const conexiones = new Map();           // "ipA:pA>ipB:pB" (visto desde aquí) → socket TCP conectado
  let siguienteFd = PRIMER_FD, efimero = 49152;
  const esperando = new Set();            // quien espera algún cambio (poll con tiempo, recv bloqueante…)
  const cuentas = {};                     // para mirar el tráfico: por IP del otro, paquetes UDP mandados/recibidos/tirados
  const cuenta = (ip, k) => { const c = cuentas[ip] || (cuentas[ip] = { env: 0, rec: 0, tirados: 0, ultimo: 0 }); c[k]++; if (k === 'rec') c.ultimo = Date.now(); };
  const log = (...a) => registro?.(...a);
  // depuración: con globalThis.mkwTrazaUdp = [] se anota cada paquete UDP entre consolas (no los del WFC)
  const traza = (dir, ip, pOtro, pMio, d, tirado) => { const t = globalThis.mkwTrazaUdp; if (t.length > 200000) t.shift();
    t.push(`${performance.now().toFixed(1)} ${dir} ${ipTexto(ip)}:${pOtro} mio ${pMio} ${d.length}B ${[...d.subarray(0, 24)].map(x => x.toString(16).padStart(2, '0')).join('')}${tirado ? ' TIRADO' : ''}`); };

  // algo cambió (llegó un paquete, se conectó…): que los que esperan vuelvan a mirar
  function cambio() { for (const r of [...esperando]) r(); }

  const nuevo = (tipo) => ({ tipo, puerto: 0, ipLocal: miIp, par: null, cola: [], recibido: [], estado: 'nuevo',
                              error: 0, aceptar: [], fin: false, roto: false, escucha: false, js: null });
  const puertoUsado = (tipo, p) => [...socks.values()].some(s => s.tipo === tipo && s.puerto === p && true);
  function puertoLibre(tipo) {
    for (let i = 0; i < 16384; i++) { const p = efimero; efimero = efimero >= 65535 ? 49152 : efimero + 1; if (!puertoUsado(tipo, p)) return p; }
    return 0;
  }
  const clave = (ipA, pA, ipB, pB) => `${ipA}:${pA}>${ipB}:${pB}`;

  // ---- lo que llega por el enlace (o de mí mismo, por recibirLocal) ----
  function manejar(m) {
    if (!m || m.a !== miIp) return;
    if (m.t === 'udp') {
      const s = [...socks.values()].find(x => x.tipo === UDP && x.puerto === m.ap);
      cuenta(m.de, 'rec');
      if (globalThis.mkwTrazaUdp && m.de !== 0x0A4D0001) traza('rec', m.de, m.dp, m.ap, m.datos, !s);
      if (!s) { cuenta(m.de, 'tirados'); return; }           // nadie escucha en ese puerto: se pierde (como UDP)
      if (s.js) { s.js(m.datos, m.de, m.dp, d => enviarUdp(s, d, m.de, m.dp)); return; }
      if (s.cola.length >= MAX_COLA_UDP) { s.cola.shift(); cuenta(m.de, 'tirados'); }
      s.cola.push({ datos: m.datos, ip: m.de, puerto: m.dp });
    } else if (m.t === 'syn') {                             // alguien quiere conectarse a mi puerto m.ap
      const l = [...socks.values()].find(x => x.tipo === TCP && x.escucha && x.puerto === m.ap);
      if (!l) { enviarA(m.de, { t: 'rst', de: miIp, a: m.de, c: m.c, l: 'srv' }); return; }
      const h = nuevo(TCP);
      h.puerto = m.ap; h.par = { ip: m.de, puerto: m.dp }; h.estado = 'conectado'; h.c = m.c; h.lado = 'srv';
      conexiones.set(clave(miIp, m.ap, m.de, m.dp), h);
      enviarA(m.de, { t: 'ack', de: miIp, a: m.de, c: m.c, l: 'srv' });
      if (l.js) { const fd = registrar(h); if (fd < 0) { enviarA(m.de, { t: 'rst', de: miIp, a: m.de, c: m.c, l: 'srv' }); return; } h.js2 = true; l.js(conexionJs(fd)); }
      else l.aceptar.push(h);
    } else {
      // la conexión es la del otro lado (en una conexión a mí mismo están los dos extremos en esta pila)
      const s = [...conexiones.values()].find(x => x.c === m.c && x.lado !== m.l);
      if (!s) { if (m.t === 'd') enviarA(m.de, { t: 'rst', de: miIp, a: m.de, c: m.c, l: m.l === 'cli' ? 'srv' : 'cli' }); return; }
      if (m.t === 'ack') { s.estado = 'conectado'; }
      else if (m.t === 'rst') { log('rst de', ipTexto(m.de), s.puerto); s.error = s.estado === 'conectando' ? ERR.CONNREFUSED : ERR.CONNRESET; s.estado = 'cerrado'; s.roto = true; quitarConexion(s); if (s.js2) { s.jsFin?.(); liberar(s); } }
      else if (m.t === 'd') { if (s.jsDatos) s.jsDatos(m.datos); else s.recibido.push(m.datos); }
      else if (m.t === 'fin') { s.fin = true; s.jsFin?.(); if (s.js2) pila.cerrar(s.fd); }   // de un servidor en JS: el otro colgó → se libera
    }
    cambio();
  }
  enlace.unir?.(miIp);
  enlace.alRecibir(manejar);
  // paquetes a mí mismo (127.0.0.1 o mi IP): sin pasar por el enlace, pero igual "después" (como la red)
  const recibirLocal = m => manejar(m);
  // TCP: siempre por el canal fiable; a mí mismo, directo (en la próxima vuelta, como si viajara)
  const enviarA = (ip, m) => { if (ip === miIp) queueMicrotask(() => recibirLocal(m)); else enlace.enviar(ip, m, true); };

  function registrar(s) {
    if (socks.size >= MAX_SOCKETS) return -ERR.MFILE;
    const fd = siguienteFd++;
    socks.set(fd, s); s.fd = fd;
    return fd;
  }
  function liberar(s) { quitarConexion(s); socks.delete(s.fd); }
  function quitarConexion(s) { for (const [k, v] of conexiones) if (v === s) conexiones.delete(k); }
  function enviarUdp(s, datos, ipA, pA) {
    if (!s.puerto) s.puerto = puertoLibre(UDP);
    if (ipA === miIp || ipA === 0x7F000001) { queueMicrotask(() => recibirLocal({ t: 'udp', de: miIp, dp: s.puerto, a: miIp, ap: pA, datos })); return datos.length; }
    cuenta(ipA, 'env');
    if (globalThis.mkwTrazaUdp && ipA !== 0x0A4D0001) traza('env', ipA, pA, s.puerto, datos, false);
    enlace.enviar(ipA, { t: 'udp', de: miIp, dp: s.puerto, a: ipA, ap: pA, datos }, false);
    return datos.length;
  }
  const s_ = fd => socks.get(fd);
  const pila = {
    ip: miIp,
    // ---- la cara para red_web.cpp (números y bytes; los errores son negativos) ----
    socket(tipo) { if (tipo !== UDP && tipo !== TCP) return -ERR.INVAL; return registrar(nuevo(tipo)); },
    bind(fd, ipB, puerto) {
      const s = s_(fd); if (!s) return -ERR.BADF;
      if (s.puerto) return -ERR.INVAL;
      if (ipB && ipB !== miIp && ipB !== 0x7F000001) return -ERR.INVAL;
      const p = puerto || puertoLibre(s.tipo);
      if (puertoUsado(s.tipo, p)) return -ERR.ADDRINUSE;
      s.puerto = p; return 0;
    },
    connect(fd, ipA, puerto) {
      const s = s_(fd); if (!s) return -ERR.BADF;
      if (s.tipo === UDP) { s.par = { ip: ipA, puerto }; if (!s.puerto) s.puerto = puertoLibre(UDP); return 0; }   // UDP "conectado": solo recuerda el destino
      if (s.estado === 'conectado') return -ERR.ISCONN;
      if (s.estado === 'conectando') return -ERR.ALREADY;
      if (s.roto) return -(s.error || ERR.CONNREFUSED);
      if (!enlace.alcanza(ipA) && ipA !== miIp) return -ERR.NETUNREACH;
      if (!s.puerto) s.puerto = puertoLibre(TCP);
      s.par = { ip: ipA, puerto }; s.estado = 'conectando'; s.lado = 'cli';
      s.c = `${miIp}:${s.puerto}>${ipA}:${puerto}#${Math.random().toString(36).slice(2, 8)}`;
      conexiones.set(clave(miIp, s.puerto, ipA, puerto), s);
      enviarA(ipA, { t: 'syn', de: miIp, dp: s.puerto, a: ipA, ap: puerto, c: s.c, l: 'cli' });
      log('connect', ipTexto(ipA), puerto);
      return -ERR.INPROGRESS;                                 // como un connect sin bloqueo: "en camino"
    },
    listen(fd) { const s = s_(fd); if (!s || s.tipo !== TCP) return -ERR.BADF; if (!s.puerto) s.puerto = puertoLibre(TCP); s.escucha = true; return 0; },
    accept(fd) {
      const s = s_(fd); if (!s || !s.escucha) return { r: -ERR.INVAL };
      const h = s.aceptar.shift(); if (!h) return { r: -ERR.AGAIN };
      const nfd = registrar(h); return { r: nfd, ip: h.par.ip, puerto: h.par.puerto };
    },
    // datos: Uint8Array. ipA/puerto solo para UDP sin conectar
    enviar(fd, datos, ipA, puerto) {
      const s = s_(fd); if (!s) return -ERR.BADF;
      if (s.tipo === UDP) {
        const d = ipA ? { ip: ipA, puerto } : s.par;
        if (!d) return -ERR.NOTCONN;
        return enviarUdp(s, datos, d.ip, d.puerto);
      }
      if (s.estado === 'conectando') return -ERR.AGAIN;
      if (s.estado !== 'conectado' || s.roto) return -(s.roto ? ERR.CONNRESET : ERR.NOTCONN);
      if (s.cerradoEscritura) return -ERR.PIPE;
      if (espia) try { espia(s.par, datos); } catch {}
      enviarA(s.par.ip, { t: 'd', de: miIp, a: s.par.ip, c: s.c, l: s.lado, datos });
      return datos.length;
    },
    // → { r: bytes|−error, datos, ip, puerto }. r = 0 con TCP = el otro cerró
    recibir(fd, cap, mirar = false) {
      const s = s_(fd); if (!s) return { r: -ERR.BADF };
      if (s.tipo === UDP) {
        const p = s.cola[0]; if (!p) return { r: -ERR.AGAIN };
        if (!mirar) s.cola.shift();
        const datos = p.datos.subarray(0, cap);                // lo que no cabe se pierde (como UDP)
        return { r: datos.length, datos, ip: p.ip, puerto: p.puerto };
      }
      if (s.roto) return { r: -(s.error || ERR.CONNRESET) };
      if (s.estado === 'conectando') return { r: -ERR.AGAIN };
      if (s.estado !== 'conectado') return { r: -ERR.NOTCONN };
      if (!s.recibido.length) return s.fin ? { r: 0 } : { r: -ERR.AGAIN };
      // juntar lo que haya hasta cap bytes (TCP es un chorro: no respeta los cortes de los mensajes)
      const partes = []; let n = 0;
      while (s.recibido.length && n < cap) {
        const b = s.recibido[0], k = Math.min(b.length, cap - n);
        partes.push(b.subarray(0, k)); n += k;
        if (!mirar) { if (k === b.length) s.recibido.shift(); else s.recibido[0] = b.subarray(k); }
        if (mirar) break;
      }
      const datos = new Uint8Array(n); let o = 0; for (const p of partes) { datos.set(p, o); o += p.length; }
      return { r: n, datos, ip: s.par.ip, puerto: s.par.puerto };
    },
    // lo que se puede hacer ahora con el socket (bits LEER/ESCRIBIR/FALLO/CORTE)
    listo(fd) {
      const s = s_(fd); if (!s) return FALLO;
      if (s.tipo === UDP) return ESCRIBIR | (s.cola.length ? LEER : 0);
      if (s.escucha) return s.aceptar.length ? LEER : 0;
      if (s.roto) return FALLO | CORTE | LEER | ESCRIBIR;
      if (s.estado === 'conectando') return 0;
      if (s.estado !== 'conectado') return 0;
      return ESCRIBIR | (s.recibido.length || s.fin ? LEER : 0) | (s.fin ? CORTE : 0);
    },
    // el error pendiente (SO_ERROR): una sola vez, como en los sistemas de verdad
    error(fd) { const s = s_(fd); if (!s) return ERR.BADF; const e = s.error; if (s.estado !== 'conectando') s.error = 0; return e; },
    tipo(fd) { return s_(fd)?.tipo || 0; },
    nombre(fd) { const s = s_(fd); if (!s) return null; return { ip: miIp, puerto: s.puerto }; },
    par(fd) { const s = s_(fd); if (!s || !s.par || (s.tipo === TCP && s.estado !== 'conectado')) return null; return s.par; },
    cortar(fd, como) {                                         // shutdown: 0 leer, 1 escribir, 2 ambos
      const s = s_(fd); if (!s) return -ERR.BADF;
      if (s.tipo === TCP && s.estado === 'conectado' && (como === 1 || como === 2) && !s.cerradoEscritura) {
        s.cerradoEscritura = true;
        enviarA(s.par.ip, { t: 'fin', de: miIp, a: s.par.ip, c: s.c, l: s.lado });
      }
      return 0;
    },
    cerrar(fd) {
      const s = s_(fd); if (!s) return -ERR.BADF;
      if (s.tipo === TCP && s.par) log('cerrar', ipTexto(s.par.ip), s.par.puerto, s.estado);
      if (s.tipo === TCP && (s.estado === 'conectado' || s.estado === 'conectando') && !s.roto) {
        enviarA(s.par.ip, { t: 'fin', de: miIp, a: s.par.ip, c: s.c, l: s.lado });
      }
      quitarConexion(s); socks.delete(fd); s.estado = 'cerrado';
      cambio();
      return 0;
    },
    // DNS: nombre → IP (número) o 0 si no existe. Un número en texto vale tal cual
    dns(nombre) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(nombre)) return ipNumero(nombre);
      const r = dns(String(nombre).toLowerCase());
      log('dns', nombre, r || '—');
      return r ? (typeof r === 'number' ? r >>> 0 : ipNumero(r)) : 0;
    },
    // espera (sin trabar la página) hasta que cambie algo o pasen ms; red_web.cpp vuelve a mirar después
    esperar(ms) {
      return new Promise(listo => {
        let t = 0;
        const fin = () => { esperando.delete(fin); clearTimeout(t); listo(); };
        esperando.add(fin);
        t = setTimeout(fin, Math.max(0, Math.min(ms < 0 ? 30000 : ms, 30000)));
      });
    },

    // ---- comodidades para servidores escritos en JS (el WFC virtual, las pruebas) ----
    udp(puerto, alRecibir) {
      const s = nuevo(UDP); s.puerto = puerto || puertoLibre(UDP); s.js = alRecibir;
      const fd = registrar(s);
      return { puerto: s.puerto, enviar: (datos, ipA, pA) => enviarUdp(s, datos, typeof ipA === 'string' ? ipNumero(ipA) : ipA, pA), cerrar: () => pila.cerrar(fd) };
    },
    servidorTcp(puerto, alConectar) {
      const s = nuevo(TCP); s.puerto = puerto; s.escucha = true; s.js = alConectar;
      if (puertoUsado(TCP, puerto)) throw new Error(`puerto TCP ${puerto} ocupado`);
      const fd = registrar(s);
      return { cerrar: () => pila.cerrar(fd) };
    },
    // conectar desde JS (para las pruebas): promesa con la conexión
    conectarTcp(ipA, puerto) {
      const fd = pila.socket(TCP);
      const r = pila.connect(fd, typeof ipA === 'string' ? ipNumero(ipA) : ipA, puerto);
      if (r !== -ERR.INPROGRESS) return Promise.reject(new Error('connect ' + r));
      return new Promise((bien, mal) => {
        const mirar = () => {
          const s = s_(fd);
          if (s.estado === 'conectado') { esperando.delete(mirar); bien(conexionJs(fd)); }
          else if (s.roto) { esperando.delete(mirar); mal(new Error('rechazada')); }
        };
        esperando.add(mirar);
      });
    },
    sockets: () => socks.size,
    cuentas: () => Object.fromEntries(Object.entries(cuentas).map(([ip, c]) => [ipTexto(+ip), { ...c, hace: c.ultimo ? Date.now() - c.ultimo : null }])),
  };

  // una conexión TCP vista desde JS: enviar, alRecibir(bytes), alCerrar, cerrar
  function conexionJs(fd) {
    const s = s_(fd);
    const pendientes = s.recibido.splice(0);
    const c = {
      par: s.par,
      enviar: b => pila.enviar(fd, b instanceof Uint8Array ? b : new TextEncoder().encode(String(b))),
      // lo que llegó antes de que JS escuchara (p. ej. el servidor saluda primero) se entrega al empezar a escuchar
      alRecibir(f) { s.jsDatos = f; for (const b of [...pendientes.splice(0), ...s.recibido.splice(0)]) f(b); },
      alCerrar(f) { s.jsFin = f; if (s.fin) f(); },
      cerrar: () => pila.cerrar(fd),
    };
    return c;
  }

  return pila;
}

// El conmutador en memoria: une varias pilas como un switch de red (para el banco y para el WFC en la misma
// pestaña). Cada pila recibe solo lo dirigido a su IP. Opciones para simular la red real: retraso (ms) y pérdida
// (0..1, solo UDP: TCP va por un canal fiable).
export function crearConmutador({ retraso = 0, perdida = 0 } = {}) {
  const puertos = new Map();             // ip → función que entrega
  const entregar = (ip, m) => {
    const f = puertos.get(ip >>> 0); if (!f) return;
    const copia = { ...m, datos: m.datos ? new Uint8Array(m.datos) : undefined };
    if (retraso) setTimeout(() => f(copia), retraso); else queueMicrotask(() => f(copia));
  };
  return {
    enlace() {
      let oyente = null, miIp = 0;
      const e = {
        enviar(ip, m, fiable) { if (!fiable && perdida && Math.random() < perdida) return; entregar(ip, m); },
        alRecibir(f) { oyente = f; },
        alcanza: ip => puertos.has(ip >>> 0),
        // la pila se presenta con su IP al crearse: desde ahí recibe lo dirigido a ella
        unir(ip) { miIp = ip >>> 0; puertos.set(miIp, m => oyente?.(m)); },
        salir() { puertos.delete(miIp); },
      };
      return e;
    },
  };
}

// Un enlace sobre un canal de mensajes entre pestañas (BroadcastChannel): cada pila tiene el suyo y todos los del
// mismo nombre se oyen. Es el "WebRTC de mentira" del banco (F2): mismo trato (UDP puede perderse, TCP no).
// Cada pila se presenta ("hola") para que las demás sepan que su IP existe (alcanza).
export function crearEnlaceCanal(nombre, { perdida = 0, retraso = 0, Canal = globalThis.BroadcastChannel } = {}) {
  const canal = new Canal(nombre);
  const conocidas = new Set();
  let oyente = null, miIp = 0;
  canal.onmessage = ({ data: m }) => {
    if (m.t === 'hola' || m.t === 'hola-tambien') { conocidas.add(m.ip >>> 0); if (m.t === 'hola' && miIp) canal.postMessage({ t: 'hola-tambien', ip: miIp }); return; }
    if (m.a !== miIp) return;
    if (retraso) setTimeout(() => oyente?.(m), retraso); else oyente?.(m);
  };
  return {
    unir(ip) { miIp = ip >>> 0; canal.postMessage({ t: 'hola', ip: miIp }); },
    enviar(ip, m, fiable) { if (!fiable && perdida && Math.random() < perdida) return; canal.postMessage(m); },
    alRecibir(f) { oyente = f; },
    alcanza: ip => conocidas.has(ip >>> 0),
    salir() { canal.close(); },
  };
}

// Un enrutador sobre la malla WebRTC (malla.mjs) — F2. Una pestaña puede tener varias pilas (la anfitriona: el WFC en
// 10.77.0.1 y su juego en 10.77.0.2): entre ellas los paquetes se entregan aquí mismo; hacia otra IP van por la malla
// al navegador dueño de esa IP. Cada pestaña anuncia sus IPs ({t:'ips'}) por el canal confiable cuando se abre un par
// nuevo, y contesta el anuncio del otro (así da igual quién abrió primero). Como un router con una tabla de rutas que
// se arma sola. Formato de cada paquete: [largo del encabezado: 2 bytes][encabezado JSON][datos tal cual].
//   const r = crearRouterMalla();  const malla = crearMalla({ uid, senal, alBinario: r.alBinario, alCambiar: r.alCambiar });
//   r.usar(malla);  crearPila({ ip, enlace: r.enlace(), … })
export function crearRouterMalla({ registro = null } = {}) {
  const locales = new Map();             // ip → función que entrega a esa pila
  const duenos = new Map();              // ip remota → uid del navegador
  const anunciados = new Set();          // uids a los que ya les dije mis IPs
  let malla = null;
  const tx = new TextEncoder(), rx = new TextDecoder();
  const empaquetar = m => {
    const { datos, ...cab } = m;
    const j = tx.encode(JSON.stringify(cab)), d = datos ? new Uint8Array(datos) : new Uint8Array(0);
    const b = new Uint8Array(2 + j.length + d.length);
    b[0] = j.length >> 8; b[1] = j.length & 255; b.set(j, 2); b.set(d, 2 + j.length);
    return b;
  };
  const desempaquetar = b => {
    const n = (b[0] << 8) | b[1], m = JSON.parse(rx.decode(b.subarray(2, 2 + n)));
    if (b.length > 2 + n || m.t === 'udp' || m.t === 'd') m.datos = b.slice(2 + n);
    return m;
  };
  const entregar = (ip, m) => { const f = locales.get(ip >>> 0); if (f) queueMicrotask(() => f({ ...m, datos: m.datos ? new Uint8Array(m.datos) : undefined })); };
  const anunciar = u => { anunciados.add(u); malla?.enviar(u, empaquetar({ t: 'ips', ips: [...locales.keys()] }), 'tcp'); };
  return {
    usar(m) { malla = m; },
    enlace() {
      let oyente = null, miIp = 0;
      return {
        unir(ip) { miIp = ip >>> 0; locales.set(miIp, m => oyente?.(m)); for (const u of anunciados) anunciar(u); },
        enviar(ip, m, fiable) {
          ip >>>= 0;
          if (locales.has(ip)) { entregar(ip, m); return; }
          const u = duenos.get(ip); if (!u || !malla) return;           // nadie con esa IP: se pierde, como en una red
          malla.enviar(u, empaquetar(m), fiable ? 'tcp' : 'udp');
        },
        alRecibir(f) { oyente = f; },
        alcanza: ip => locales.has(ip >>> 0) || duenos.has(ip >>> 0),
        salir() { locales.delete(miIp); },
      };
    },
    alBinario(de, bytes) {
      let m; try { m = desempaquetar(bytes); } catch { return; }
      if (m.t === 'ips') {
        for (const [ip, u] of [...duenos]) if (u === de) duenos.delete(ip);
        for (const ip of m.ips || []) duenos.set(ip >>> 0, de);
        registro?.(`[malla] ${de} tiene ${(m.ips || []).map(ipTexto).join(', ')}`);
        if (!anunciados.has(de)) anunciar(de);
        return;
      }
      if (locales.has(m.a >>> 0)) entregar(m.a, m);
    },
    // la malla cambió: anunciar mis IPs a los pares nuevos y olvidar las rutas de los que se fueron
    alCambiar() {
      if (!malla) return;
      const vivos = new Set(malla.conectados());
      for (const u of vivos) if (!anunciados.has(u)) anunciar(u);
      for (const u of [...anunciados]) if (!vivos.has(u)) anunciados.delete(u);
      for (const [ip, u] of [...duenos]) if (!vivos.has(u)) duenos.delete(ip);
    },
    rutas: () => Object.fromEntries([...duenos].map(([ip, u]) => [ipTexto(ip), u])),
  };
}
