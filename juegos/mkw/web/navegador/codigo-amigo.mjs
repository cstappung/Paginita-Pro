// El código de amigo de Mario Kart Wii: calcularlo desde el número de jugador y revisar uno escrito a mano.
//
// Resumen: el código de amigo (12 cifras, "XXXX-XXXX-XXXX") NO es un número al azar: según la documentación pública
// de Tockdom ("Friend Code"), es el número de jugador (pid, 32 bits) con 7 bits de control delante, sacados del MD5 de
// (pid en little-endian + el código del juego "RMCJ" al revés). Como el dígito verificador de un RUT: permite saber
// si un código está mal escrito sin preguntarle a nadie. La fórmula se verificó con los 280 jugadores en línea de
// Retro WFC el 2026-10-17 (280/0). «Tu partida» lo muestra para cada licencia (licencias.mjs).
// El MD5 se hace aquí mismo (el navegador no lo trae en crypto.subtle), según el algoritmo público RFC 1321.
//
// (Antes vivía en salas.mjs, el visor de las salas de Retro WFC en vivo; ese visor se quitó el 2026-10-18 porque el
// multijugador va solo por la página del sitio: decisión del dueño, bitácora §64.)
//
// Uso:  codigoDesdePid(123456789) → '2535-2652-7253';  codigoValido('2535 2652 7253') → true

// ---- MD5 (RFC 1321) ----
// S = cuánto rota cada paso, K = las 64 constantes (la parte entera de |sen(i+1)|·2³²)
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
           4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
export function md5(bytes) {
  const largo = bytes.length;
  const n = (((largo + 8) >> 6) + 1) << 6;                 // relleno hasta múltiplo de 64 bytes, con 8 para el largo
  const m = new Uint8Array(n);
  m.set(bytes); m[largo] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(n - 8, (largo * 8) >>> 0, true);
  dv.setUint32(n - 4, Math.floor(largo / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < n; off += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const x = (a + f + K[i] + dv.getUint32(off + 4 * g, true)) >>> 0;
      a = d; d = c; c = b;
      b = (b + ((x << S[i]) | (x >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const salida = new Uint8Array(16), sv = new DataView(salida.buffer);
  [a0, b0, c0, d0].forEach((v, i) => sv.setUint32(4 * i, v, true));
  return salida;
}

// ---- Código de amigo ----
export function codigoDesdePid(pid) {
  const buf = new Uint8Array(8), dv = new DataView(buf.buffer);
  dv.setUint32(0, pid >>> 0, true);                         // pid en little-endian
  buf.set([0x4a, 0x43, 0x4d, 0x52], 4);                     // "RMCJ" al revés = "JCMR" (todas las regiones usan RMCJ)
  const control = md5(buf)[0] >> 1;                         // 7 bits de control
  const valor = BigInt(control) * 2n ** 32n + BigInt(pid >>> 0);
  const s = valor.toString().padStart(12, '0');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
// "2535 2652 7253", "253526527253" o "2535-2652-7253" → "2535-2652-7253" (o '' si no son 12 cifras)
export const limpiarCodigo = texto => { const d = String(texto || '').replace(/\D/g, ''); return d.length === 12 ? `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : ''; };
export function codigoValido(texto) {
  const c = limpiarCodigo(texto);
  if (!c) return false;
  const valor = BigInt(c.replace(/-/g, ''));
  const pid = Number(valor % 2n ** 32n);
  return valor < 2n ** 39n && pid !== 0 && codigoDesdePid(pid) === c;
}
