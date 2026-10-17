// Salas de Retro WFC en vivo: quién está jugando en línea ahora, en qué sala y en qué pista, y buscar a un amigo
// por su código de amigo.
//
// Resumen: Retro WFC (el servidor en línea de la comunidad que usa Retro Rewind) publica el estado de todas sus salas
// en https://rwfc.net/api/roomstatus (JSON, se actualiza cada ~10 s y deja leerlo desde cualquier página: responde
// "Access-Control-Allow-Origin: *", así que la página del sitio en GitHub Pages lo lee directo, sin el Worker).
// Este módulo:
//   1. baja ese JSON y lo deja en una forma simple para mostrar (normalizar): salas con gente, ordenadas por cantidad
//      de jugadores; cada jugador con su nombre, código de amigo, VR (puntaje de carreras) y si es el anfitrión;
//   2. lo vuelve a pedir cada 15 s mientras la pestaña está a la vista (crearSalas), y espera más si falla;
//   3. valida un código de amigo y busca en qué sala está (buscarAmigo).
//
// El código de amigo (12 cifras, "XXXX-XXXX-XXXX") NO es un número al azar: según la documentación pública de
// Tockdom ("Friend Code"), es el número de jugador (pid, 32 bits) con 7 bits de control delante, sacados del MD5 de
// (pid en little-endian + el código del juego "RMCJ" al revés). Como el dígito verificador de un RUT: permite saber si
// un código está mal escrito sin preguntarle a nadie. Verificado con los 280 jugadores en línea el 2026-10-17 (280/0).
// El MD5 se hace aquí mismo (el navegador no lo trae en crypto.subtle), según el algoritmo público RFC 1321.
//
// Qué significan los "rk" de las salas (vs_10, vs_20, …) no está documentado: se muestran tal cual.
//
// Uso:  const s = crearSalas({ alCambiar: datos => pinta(datos) });  s.empezar();  …  s.detener();
//       codigoValido('2535-2652-7253') → true;   buscarAmigo(datos, '2535-2652-7253') → { sala, jugador } | null

export const URL_SALAS = 'https://rwfc.net/api/roomstatus';

// ---- MD5 (RFC 1321) ----
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

// ---- Dejar el JSON de Retro WFC en una forma simple ----
export function normalizar(json) {
  const salas = (Array.isArray(json && json.rooms) ? json.rooms : []).map(r => {
    const jugadores = (Array.isArray(r.players) ? r.players : []).map(p => ({
      nombre: String(p.name || p.mii?.name || '?').slice(0, 20),
      codigo: String(p.friendCode || ''),
      vr: Number.isFinite(p.vr) ? p.vr : null,
      anfitrion: !!p.isOpenHost,
      suspendido: !!p.isSuspended,
    }));
    return {
      id: String(r.id || ''),
      tipo: r.type === 'private' ? 'amigos' : r.type === 'anybody' ? 'abierta' : String(r.type || '?'),
      rk: r.rk && r.rk !== 'unknown' ? String(r.rk) : '',
      creada: r.created ? new Date(r.created) : null,
      unible: !!r.isJoinable,
      suspendida: !!r.isSuspended,
      vrMedio: Number.isFinite(r.averageVR) ? Math.round(r.averageVR) : null,
      carrera: r.race ? { numero: Number(r.race.num) || 0, pista: String(r.race.trackName || '') } : null,
      jugadores,
    };
  }).filter(s => s.jugadores.length > 0)                     // las salas vacías (quedan colgadas) no interesan
    .sort((a, b) => b.jugadores.length - a.jugadores.length || (b.vrMedio || 0) - (a.vrMedio || 0));
  const total = Number.isFinite(json && json.totalPlayers) ? json.totalPlayers : salas.reduce((n, s) => n + s.jugadores.length, 0);
  return { cuando: json && json.timestamp ? new Date(json.timestamp) : null, total, salas };
}

export function buscarAmigo(datos, codigo) {
  const c = limpiarCodigo(codigo);
  if (!c) return null;
  for (const sala of datos.salas) {
    const jugador = sala.jugadores.find(j => j.codigo === c);
    if (jugador) return { sala, jugador };
  }
  return null;
}

// ---- Pedir cada tanto, solo con la pestaña a la vista ----
export function crearSalas({ buscar = (u, o) => fetch(u, o), url = URL_SALAS, cadaMs = 15000, maxEsperaMs = 120000,
                             alCambiar = null, documento = globalThis.document } = {}) {
  const estado = { datos: null, error: '', pedidos: 0, fallos: 0, activo: false };
  let temporizador = 0, espera = cadaMs;
  async function pedir() {
    clearTimeout(temporizador);
    estado.pedidos++;
    try {
      const r = await buscar(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Retro WFC respondió ${r.status}`);
      estado.datos = normalizar(await r.json());
      estado.error = ''; estado.fallos = 0; espera = cadaMs;
    } catch (e) {
      estado.error = String(e && e.message || e); estado.fallos++;
      espera = Math.min(maxEsperaMs, espera * 2);            // si falla, espera el doble cada vez (hasta 2 min)
    }
    if (alCambiar) alCambiar(estado);
    if (estado.activo && !(documento && documento.hidden)) temporizador = setTimeout(pedir, espera);
    return estado;
  }
  const alVer = () => { if (estado.activo && documento && !documento.hidden) pedir(); else clearTimeout(temporizador); };
  return {
    estado, pedir,
    empezar() { estado.activo = true; documento?.addEventListener?.('visibilitychange', alVer); return pedir(); },
    detener() { estado.activo = false; clearTimeout(temporizador); documento?.removeEventListener?.('visibilitychange', alVer); },
  };
}
