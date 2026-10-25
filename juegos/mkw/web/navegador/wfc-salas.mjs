// La lista de salas del WFC virtual ("server browser" de GameSpy, TCP 28910) — bitácora §58 (F1).
//
// Resumen: para buscar partida, la consola le pide al servidor la lista de consolas que están en línea, con un
// FILTRO parecido a SQL ("dwc_mver = 90 and numplayers < 11 and rk = 'vs_10'…") y los datos que quiere de cada una
// (numplayers, dwc_pid, dwc_hoststate…). Esos datos salen de los latidos QR2 que cada consola manda. La respuesta va
// CIFRADA con "enctypeX" (un cifrado de flujo de GameSpy, parecido a RC4) usando la clave del juego y el reto que
// mandó la consola. También por aquí la consola le manda un mensaje a otra ("quiero entrar a tu sala"): el servidor
// se lo pasa por QR2 (mensaje de cliente).
// Escrito desde la descripción pública del protocolo (GameSpy SB v3), sin copiar código.
//
// Uso:  servidorSalas({ pila, qr2, enviarMensaje: (sesionQr2, bytes) => …, registro })

const texto = new TextDecoder('latin1'), bytes = s => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
const CLAVE_JUEGO = { mariokartwii: '9r3Rmy' };
// como Retro WFC: la búsqueda no separa por VR/BR (con pocos jugadores, que todos se encuentren)
const SIN_VR = new Set(['ev', 'eb']);           // la "secretKey" de GameSpy de cada juego

// ---- enctypeX: estado de 261 bytes, armado con la clave del juego + el reto del cliente + 13 bytes nuestros ----
function enctypexEstado(clave, retoCliente, retoServidor) {
  const reto = Uint8Array.from(retoCliente);              // se mezcla (sin tocar el original)
  for (let i = 0; i < retoServidor.length; i++) {
    const k = clave.charCodeAt(i % clave.length);
    reto[(k * i) & 7] ^= reto[i & 7] ^ retoServidor[i];
  }
  const s = new Uint8Array(261);
  for (let i = 0; i < 256; i++) s[i] = i;
  let n1 = 0, n2 = 0;
  const elegir = cnt => {                                  // un índice "al azar" ≤ cnt, sacado del reto
    if (!cnt) return 0;
    let mascara = 1; while (mascara < cnt) mascara = (mascara << 1) + 1;
    let i = 0, t;
    do {
      n1 = (s[n1 & 255] + reto[n2]) & 0xffffffff;
      n2++; if (n2 >= 8) { n2 = 0; n1 += 8; }
      t = n1 & mascara;
      if (++i > 11) t %= cnt;
    } while (t > cnt);
    return t;
  };
  for (let i = 255; i >= 0; i--) { const t = elegir(i); const x = s[i]; s[i] = s[t]; s[t] = x; }
  s[256] = s[1]; s[257] = s[3]; s[258] = s[5]; s[259] = s[7]; s[260] = s[n1 & 255];
  return s;
}
// cifra un byte (el estado avanza; al descifrar se hace lo mismo pero se guarda al revés lo que entra y sale)
function enctypexByte(s, d, descifrar = false) {
  let a = s[256], b = s[257], c = s[a];
  s[256] = a + 1; s[257] = b + c;
  a = s[260]; b = s[s[257]]; c = s[a]; s[a] = b;
  a = s[s[259]]; b = s[257]; s[b] = a;
  a = s[s[256]]; b = s[259]; s[b] = a;
  a = s[256]; s[a] = c;
  b = s[258]; a = s[c]; c = s[259]; b = (a + b) & 255; s[258] = b;
  a = b; c = s[c]; b = s[s[257]]; a = s[a]; c = (b + c) & 255; b = s[s[260]]; c = (b + c) & 255;
  b = s[c]; c = s[s[256]]; a = (a + c) & 255; c = s[b]; b = s[a];
  const salida = (c ^ b ^ d) & 255;
  if (descifrar) { s[260] = d; s[259] = salida; } else { s[260] = salida; s[259] = d; }
  return salida;
}
export function enctypexCifrar(clave, retoCliente, datos, retoServidor = crypto.getRandomValues(new Uint8Array(13))) {
  // cabecera: [5 ^ 0xEC][5 bytes][13 ^ 0xEA][13 bytes = reto del servidor]
  const cab = new Uint8Array(20);
  crypto.getRandomValues(cab);
  cab[0] = 5 ^ 0xec; cab[1] = 0; cab[2] = 0; cab[6] = 13 ^ 0xea; cab.set(retoServidor, 7);
  const s = enctypexEstado(clave, retoCliente, retoServidor), sal = new Uint8Array(20 + datos.length);
  sal.set(cab);
  for (let i = 0; i < datos.length; i++) sal[20 + i] = enctypexByte(s, datos[i]);
  return sal;
}
export function enctypexDescifrar(clave, retoCliente, cifrado) {   // para las pruebas: lo que hace la consola
  const a = cifrado[0] ^ 0xec, b = cifrado[a + 1] ^ 0xea, retoServidor = cifrado.subarray(a + 2, a + 2 + b);
  const s = enctypexEstado(clave, retoCliente, retoServidor), datos = cifrado.subarray(a + 2 + b);
  return Uint8Array.from(datos, d => enctypexByte(s, d, true));
}

// ---- el filtro: and / or / not, paréntesis, = != <> < > <= >=, like, números y 'textos' ----
// ignorar: campos cuyas comparaciones cuentan siempre como ciertas (Retro WFC no filtra por VR: ev, eb)
export function evaluarFiltro(filtro, datos, { ignorar = new Set() } = {}) {
  const fichas = [...String(filtro || '').matchAll(/\s*('(?:[^']|'')*'|"[^"]*"|<=|>=|!=|<>|[()=<>]|[\w.+\-:]+)/g)].map(m => m[1]);
  let i = 0;
  const ver = () => fichas[i], tomar = () => fichas[i++];
  const valor = f => {
    if (f === undefined) return '';
    if (/^'.*'$|^".*"$/.test(f)) return f.slice(1, -1).replace(/''/g, "'");
    if (/^-?\d+(\.\d+)?$/.test(f)) return Number(f);
    return datos[f] ?? '';                                 // un nombre de campo
  };
  const comparar = (x, op, y) => {
    const nx = Number(x), ny = Number(y), num = x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny);
    const [p, q] = num ? [nx, ny] : [String(x), String(y)];
    switch (op.toLowerCase()) {
      case '=': return p === q; case '!=': case '<>': return p !== q;
      case '<': return p < q; case '>': return p > q; case '<=': return p <= q; case '>=': return p >= q;
      case 'like': return new RegExp('^' + String(y).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i').test(String(x));
    }
    return false;
  };
  function primario() {
    if (ver()?.toLowerCase() === 'not') { tomar(); return !primario(); }
    if (ver() === '(') { tomar(); const r = o(); tomar(); return r; }
    const izq = tomar(), op = tomar() || '', der = tomar();
    if (ignorar.has(izq) || ignorar.has(der)) return true;
    return comparar(valor(izq), op, valor(der));
  }
  function y() { let r = primario(); while (ver()?.toLowerCase() === 'and') { tomar(); const d = primario(); r = r && d; } return r; }
  function o() { let r = y(); while (ver()?.toLowerCase() === 'or') { tomar(); const d = y(); r = r || d; } return r; }
  if (!fichas.length) return true;
  try { return o(); } catch { return false; }
}

const u16 = n => [(n >>> 8) & 255, n & 255], u32 = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ipDe = clave => Number(clave.split(':')[0]) >>> 0;

export function servidorSalas({ pila, qr2, enviarMensaje, registro = () => {} }) {
  const log = (...a) => registro(`[wfc:salas] ${a.join(' ')}`);
  pila.servidorTcp(28910, con => {
    let buf = new Uint8Array(0);
    con.alRecibir(b => {
      const n = new Uint8Array(buf.length + b.length); n.set(buf); n.set(b, buf.length); buf = n;
      while (buf.length >= 3) {
        const largo = (buf[0] << 8) | buf[1];
        if (largo < 3 || buf.length < largo) break;
        const pedido = buf.subarray(0, largo); buf = buf.slice(largo);
        try { atender(pedido); } catch (e) { log('error', e.message); }
      }
    });
    function atender(p) {
      const tipo = p[2];
      if (tipo === 0x00) lista(p);
      else if (tipo === 0x02) {                              // mensaje para otra consola: [ip 4][puerto 2][mensaje]
        const ip = ((p[3] << 24) | (p[4] << 16) | (p[5] << 8) | p[6]) >>> 0, puerto = (p[7] << 8) | p[8];
        const ses = qr2.get(`${ip}:${puerto}`);
        log(`mensaje para ${ip}:${puerto} (${p.length - 9} bytes)${ses ? '' : ' — no está'}`);
        if (ses) enviarMensaje(`${ip}:${puerto}`, p.subarray(9));
      } else if (tipo === 0x03) { /* sigo aquí: nada */ }
      else log(`pedido tipo ${tipo} (${p.length} bytes) — sin manejar`);
    }
    function lista(p) {
      // [largo 2][0x00][protocolo][codificación][versión 4] juego\0 juego\0 reto(8) filtro\0 campos\0 opciones(4)
      let o = 9;
      const cadena = () => { const f = p.indexOf(0, o); const s = texto.decode(p.subarray(o, f)); o = f + 1; return s; };
      cadena(); const juego = cadena();
      const reto = p.slice(o, o + 8); o += 8;
      const filtro = cadena(), campos = cadena().split('\\').filter(c => c && !/^(publicip|publicport|localport|localip\d*)$/.test(c));
      const opciones = ((p[o] << 24) | (p[o + 1] << 16) | (p[o + 2] << 8) | p[o + 3]) >>> 0;
      const clave = CLAVE_JUEGO[juego]; if (!clave) { log(`juego desconocido ${juego}`); return; }
      const sal = [...u32(con.par.ip >>> 0), ...u16(con.par.puerto), campos.length];
      for (const c of campos) sal.push(0, ...bytes(c), 0);
      sal.push(0);
      let n = 0;
      if (!(opciones & 0x02)) {                              // 0x02 = "no quiero la lista" (solo los campos)
        for (const [k, ses] of qr2) {
          const d = ses.datos;
          if (!ses.registrada || d.gamename !== juego || !evaluarFiltro(filtro, d, { ignorar: SIN_VR })) continue;
          // todos con su IP de verdad (la red es solo de la sala: no hay nada que esconder)
          let flags = 0x40 | 0x10 | 0x08;
          const extra = [...u32(ipDe(k)), ...u16(Number(d.publicport) || Number(d.localport) || 0)];
          if (d.localip0) { flags |= 0x02; extra.push(...d.localip0.split('.').map(Number)); }
          if (d.localport) { flags |= 0x20; extra.push(...u16(Number(d.localport))); }
          if (d.natneg && d.natneg !== '0') flags |= 0x04;
          sal.push(flags, ...extra, 0, 0, 0, 0);
          for (const c of campos) sal.push(0xff, ...bytes(String(d[c] ?? '')), 0);
          n++;
        }
        sal.push(0, 0xff, 0xff, 0xff, 0xff);
      }
      log(`lista «${filtro}» → ${n} consola(s)`);
      con.enviar(enctypexCifrar(clave, reto, Uint8Array.from(sal)));
    }
  });
}
