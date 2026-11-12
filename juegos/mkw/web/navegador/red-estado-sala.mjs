// §275b: la sala «Cada uno su kart» — el lado de la página del DWC falso (web/juego/red_estado_nativo.cpp).
//
// Resumen general: en la carrera de esta sala NO hay lockstep. Cada consola corre su kart con la red nativa del juego
// (RKNet: cada uno manda su estado en un paquete RACE). El juego cree que habla con DWC; en realidad:
//   - cada paquete que el juego manda a la consola `aid` sale por Module.mkwRedEstadoEnviar(aid, tam): se copia de la
//     memoria del programa y va por la malla WebRTC (canal «udp», el que no reintenta: un paquete viejo ya no sirve) a la
//     página de esa consola, con una marca (0xA9) y el aid de quien lo manda;
//   - cada paquete que llega por la malla con esa marca se deja en la memoria del programa y se encola para el juego
//     (mkw_red_estado_entregar), que lo lee al empezar su cuadro de red, como si lo hubiera traído DWC.
// Quién es quién: el «aid» de cada consola es su lugar en la lista de la sala (la misma en todas: la de la anfitriona);
// la anfitriona de la sala es la anfitriona de RKNet. Cada jugador de la carrera (puesto 0-11) dice de qué aid es: una
// persona, el de su consola; una CPU, por ahora el de la consola que la mira (cada consola mueve sus CPU: 3b lo cambia).
// Como una centralita: el juego marca un interno (aid) y la página lo conecta con la línea (uid) que corresponde.

export const MARCA_RED_ESTADO = 0xA9;

// los aid de la sala: lista de uid en el orden de la sala (igual en todas las consolas), yo y la anfitriona
export function aidsDeSala({ uids, yo, jefe }) {
  const lista = [...new Set(uids)].slice(0, 12);
  const aidDe = new Map(lista.map((u, i) => [u, i]));
  const miAid = aidDe.get(yo) ?? -1, anfitriona = aidDe.get(jefe) ?? 0;
  const mapa = lista.reduce((m, _, i) => m | (1 << i), 0);
  return { lista, aidDe, miAid, anfitriona, mapa, consolas: lista.length };
}

// de qué aid es cada puesto de la carrera: personas → su consola; CPU (uid null) → `aidCpu` (la consola que la mueve:
// la anfitriona, §275b 3b)
export function aidsDePuestos(puestos, aidDe, aidCpu) {
  return puestos.map(p => p == null ? null : p.uid ? (aidDe.get(p.uid) ?? null) : aidCpu);
}

// el paquete que viaja: [marca, aid de quien manda, …bytes del paquete RACE]
export function empaquetar(aid, bytes) { const b = new Uint8Array(bytes.length + 2); b[0] = MARCA_RED_ESTADO; b[1] = aid; b.set(bytes, 2); return b; }
export function desempaquetar(b) { return b?.[0] === MARCA_RED_ESTADO && b.length > 2 ? { aid: b[1], bytes: b.subarray(2) } : null; }
// 3b: el lote de las CPU de la anfitriona viaja con 0xFE en el lugar del aid (ningún aid llega a 0xFE):
// [0xA9, 0xFE, (jugador, 64 bytes del registro RACEDATA)…]
export const LOTE_CPU = 0xFE;
// 3c: «mis karts que ya cruzaron la meta» (personas y, la anfitriona, las CPU): [0xA9, 0xFD, máscara baja, máscara alta,
// el tiempo en ms de cada uno, u32] (cada 15 cuadros, desde el juego)
export const AVISO_LLEGO = 0xFD;
// «el lento al día»: cada consola manda cada 250 ms su pulso [0xA9, 0xFC, hora de la sala (f64), cuadro de la carrera (u32)]
// y quien va atrás de la más adelantada corre los cuadros que le faltan seguidos (mkw_prisa del runtime). Sin esto, una
// consola que se trabó (una pestaña oculta, un aparato lento) quedaba para siempre segundos detrás de las demás: los
// karts que le llegan son «del futuro» y las CPU se ven a decenas de metros. Como dos relojes de pared: el que atrasa
// mira la hora del otro y adelanta las agujas, sin parar el del otro.
export const PULSO = 0xFC;
export const AL_DIA = { umbral: 3, tope: 120, cadaMs: 250, entrePrisasMs: 500, viejoMs: 2000, porSegundo: 60 };
// El ponerse al día repartido (lo que encontró sim-sala-mixta en el Oppo: con «Cada uno su kart» la mitad de sus tirones
// eran el ponerse al día). Antes, al pasar los 3 cuadros de atraso, la página pedía TODO lo que faltaba de una vez (hasta
// 120) y el motor corría esos cuadros seguidos, cada uno dibujado: en un teléfono, un tirón. Y uno que no da 60 queda
// atrás siempre, así que lo pedía dos veces por segundo para siempre. Ahora, como un regulador que suelta de a poco:
//  · empieza recién con más de `empieza` cuadros atrás (100 ms) y sigue hasta quedar a `para` (histéresis: no titila);
//  · a lo más UN cuadro de más cada `cadaMs` (100 ms: hasta 10 cuadros por segundo, nunca dos seguidos en un refresco);
//  · si en `pruebaMs` apurándose no ganó ni `ganaMin` cuadros (el aparato no da 60 de lógica: no puede alcanzar),
//    descansa `descansoMs` sin apurarse (apurar ahí solo agrega tirones).
// ?alDia=viejo = la de antes (todo de una vez); ?alDia=0 = nada.
export const AL_DIA_SUAVE = { empieza: 6, para: 2, cadaMs: 100, porVez: 1, pruebaMs: 5000, ganaMin: 3, descansoMs: 10000 };
export function crearAlDia(o = {}) {
  const k = { ...AL_DIA_SUAVE, ...o };
  let apurando = false, ultima = -Infinity, prueba = null, descansoHasta = -Infinity;
  const e = { pedidos: 0, cuadros: 0, descansos: 0, apurando: false };
  return {
    estado: () => ({ ...e, apurando }),
    // ahora (ms), atraso (cuadros, null = no se sabe) → cuántos cuadros pedir ahora (0 o porVez)
    paso(ahora, atraso) {
      if (atraso === null || !Number.isFinite(atraso) || ahora < descansoHasta) { apurando = false; prueba = null; return 0; }
      if (!apurando && atraso > k.empieza) { apurando = true; prueba = { desde: ahora, atraso }; }
      else if (apurando && atraso <= k.para) { apurando = false; prueba = null; }
      if (!apurando) return 0;
      if (ahora - prueba.desde >= k.pruebaMs) {
        if (prueba.atraso - atraso < k.ganaMin) { descansoHasta = ahora + k.descansoMs; e.descansos++; apurando = false; prueba = null; return 0; }
        prueba = { desde: ahora, atraso };
      }
      if (ahora - ultima < k.cadaMs) return 0;
      ultima = ahora; e.pedidos++; e.cuadros += k.porVez;
      return k.porVez;
    },
  };
}
export function pulso(hora, cuadro) {
  const b = new Uint8Array(14), d = new DataView(b.buffer);
  b[0] = MARCA_RED_ESTADO; b[1] = PULSO; d.setFloat64(2, hora, true); d.setUint32(10, cuadro >>> 0, true);
  return b;
}
export function leerPulso(b) {
  if (b?.[0] !== MARCA_RED_ESTADO || b[1] !== PULSO || b.length < 14) return null;
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { hora: d.getFloat64(2, true), cuadro: d.getUint32(10, true) };
}
// el cuadro en que va AHORA la consola más adelantada, según el último pulso de cada una (los de más de 2 s no cuentan)
export function cuadroDeAdelante(pulsos, ahora, { viejoMs = AL_DIA.viejoMs, porSegundo = AL_DIA.porSegundo } = {}) {
  let max = null;
  for (const v of pulsos.values()) {
    if (!v || ahora - v.hora > viejoMs) continue;
    const c = v.cuadro + Math.max(0, ahora - v.hora) * porSegundo / 1000;
    if (max === null || c > max) max = c;
  }
  return max;
}
// cuántos cuadros correr seguidos ahora (0 = nada): solo si voy más de `umbral` atrás, con tope
export function cuadrosPrisa(adelante, mio, { umbral = AL_DIA.umbral, tope = AL_DIA.tope } = {}) {
  if (adelante === null || !Number.isFinite(mio)) return 0;
  const atraso = adelante - mio;
  return atraso > umbral ? Math.min(Math.round(atraso), tope) : 0;
}
export function jugadoresDelLote(b) { const j = []; for (let p = 2; p + 65 <= b.length; p += 65) j.push(b[p]); return j; }

// M = el Module del juego; malla = malla.mjs; sala = { uids, yo, jefe }; puestos = [{ uid|null }, …] (12, null = vacío)
// en qué cuadro de la carrera va este juego: el reloj de la carrera (Raceinfo +0x14: minutos, segundos, milésimas; arranca
// con el «¡YA!» en todas las consolas) en cuadros de 1/60 s; null antes del «¡YA!» o fuera de la carrera. (Los contadores
// +0x1C y +0x20 de Raceinfo NO sirven para comparar: cuentan desde que cada página cargó.)
// (el reloj de la carrera solo marca el comienzo: después se cuentan los cuadros de lógica que de verdad corrieron, con
// +0x20. RR adelanta el reloj cuando detecta lag —«Detected frame lag», corrige solo el reloj—: en el Oppo el reloj decía
// 169 cuadros atrás y de verdad iban 1.125. Como medir el atraso de un motor con un reloj que alguien adelanta a mano.)
let base = null;   // { ri, f20, cuadro }: al primer cuadro con el reloj andando de esta carrera
function cuadroDelJuego() {
  const L = globalThis.window?.mkwMenus; if (!L) return null;
  const ri = L.u32(0x809BD730); if (!ri) { base = null; return null; }
  const etapa = L.u32(ri + 0x28), r = L.u32(ri + 0x14);
  if (etapa < 2 || etapa > 4 || !r) { if (etapa < 2) base = null; return null; }
  const f20 = L.u32(ri + 0x20);
  if (!base || base.ri !== ri || f20 < base.f20) {
    const ms = (L.u16(r + 8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC);
    if (!(ms > 0)) return null;
    base = { ri, f20, cuadro: Math.round(ms * 0.06) };
  }
  return base.cuadro + (f20 - base.f20);
}
export function crearRedEstado({ M, malla, sala, puestos, registro = () => {}, alDia = true, kartLiviano = true,
  hora = () => performance.now(), cuadro = cuadroDelJuego, prisa = ms => M._mkw_prisa?.(ms), oculta = () => !!globalThis.document?.hidden }) {
  const a = aidsDeSala(sala);
  const cuentas = { enviados: 0, recibidos: 0, tirados: 0, sinRuta: 0, porAid: {} };
  if (a.miAid < 0) throw new Error('red=estado: no estoy en la lista de la sala');
  // 3b: las CPU las corre la anfitriona (modo 1: el juego las mueve y mandamos su registro); en las demás son karts
  // remotos de la consola anfitriona (modo 2: el juego lee el registro que llegó). Siempre 12 karts.
  const soyAnfitriona = a.miAid === a.anfitriona;
  const cpus = puestos.map((p, i) => p && !p.uid ? i : -1).filter(i => i >= 0);
  const aidPuesto = aidsDePuestos(puestos, a.aidDe, a.anfitriona);
  cuentas.cpu = { soyAnfitriona, cpus: cpus.length, lotes: 0, lotesRecibidos: 0 };
  const configurar = () => {
    // bit 1 = los karts de afuera con el modelo completo (como el juego en línea; ?kartLiviano=0, red_estado_nativo.cpp)
    M._mkw_red_estado_config(kartLiviano ? 1 : 3, a.miAid, a.anfitriona, a.mapa, a.consolas);
    // jugadores por consola: las personas de cada aid (las CPU no cuentan para DWC)
    const porAid = new Array(12).fill(0);
    puestos.forEach(p => { if (p?.uid && a.aidDe.has(p.uid)) porAid[a.aidDe.get(p.uid)]++; });
    aidPuesto.forEach((aid, i) => M._mkw_red_estado_jugador(i, aid ?? 0xFF, aid == null ? 0 : Math.max(1, porAid[aid])));
    for (let i = 0; i < 12; i++) M._mkw_red_estado_cpu?.(i, cpus.includes(i) ? (soyAnfitriona ? 1 : 2) : 0);
    // los humanos de la sala, también los de las otras consolas (sin mando aquí el juego no los cuenta como humanos:
    // la carrera terminaba apenas llegaba el mío)
    M._mkw_red_estado_humanos?.(puestos.reduce((m, p, i) => p?.uid ? m | (1 << i) : m, 0));
  };
  configurar();
  // lo que cuesta en red (bytes de datos, sin las cabeceras de WebRTC): por tipo, lo que sale y lo que entra
  cuentas.bytes = { sale: { race: 0, cpu: 0, llego: 0, pulso: 0 }, entra: { race: 0, cpu: 0, llego: 0, pulso: 0 }, desde: performance.now() };
  const mandar = (uid, b, tipo) => { malla.enviar(uid, b, 'udp'); cuentas.bytes.sale[tipo] += b.length; };
  M.mkwRedEstadoEnviar = (aid, tam) => {
    const uid = a.lista[aid];
    if (!uid || aid === a.miAid) { cuentas.sinRuta++; return; }
    const p = M._mkw_red_estado_salida();
    mandar(uid, empaquetar(a.miAid, M.HEAPU8.subarray(p, p + tam)), 'race');
    cuentas.enviados++;
  };
  // 3b: el lote de las CPU (lo junta el juego en cada cuadro de red) a cada una de las otras consolas
  M.mkwRedEstadoCpu = tam => {
    const p = M._mkw_red_estado_cpu_salida(), lote = M.HEAPU8.slice(p, p + tam);
    for (const uid of a.lista) if (uid !== sala.yo) mandar(uid, lote, 'cpu');
    cuentas.cpu.lotes++;
  };
  // 3c: el aviso de llegada (lo pide el juego cada 15 cuadros mientras haya alguno mío llegado) a las otras consolas
  M.mkwRedEstadoLlego = m => {
    const quienes = [...Array(12).keys()].filter(i => m >> i & 1), b = new Uint8Array(4 + 4 * quienes.length), d = new DataView(b.buffer);
    b[0] = MARCA_RED_ESTADO; b[1] = AVISO_LLEGO; b[2] = m & 0xFF; b[3] = (m >> 8) & 0xFF;
    quienes.forEach((i, k) => d.setUint32(4 + 4 * k, M._mkw_red_estado_llego_tiempo(i) >>> 0, true));
    for (const uid of a.lista) if (uid !== sala.yo) mandar(uid, b, 'llego');
    cuentas.llegoMandados = (cuentas.llegoMandados || 0) + 1;
  };
  // el lento al día (ver PULSO): el pulso a las demás y, si voy atrás, los cuadros seguidos
  const pulsos = new Map();
  cuentas.alDia = { activo: !!alDia, prisas: 0, cuadros: 0, atraso: null, maxAtraso: 0 };
  let ultimaPrisa = -Infinity;
  const suave = alDia && alDia !== 'viejo' ? crearAlDia() : null;
  const atrasoAhora = () => { const c = cuadro(); if (c === null) return null; const ad = cuadroDeAdelante(pulsos, hora()); return ad === null ? null : ad - c; };
  // (el repartido: cada 100 ms, a lo más un cuadro; ver crearAlDia)
  const relojSuave = suave ? setInterval(() => {
    if (oculta()) return;
    const n = suave.paso(hora(), atrasoAhora());
    if (n) { cuentas.alDia.prisas++; cuentas.alDia.cuadros += n; try { prisa(n * 1000 / AL_DIA.porSegundo); } catch {} }
    cuentas.alDia.suave = suave.estado();
  }, AL_DIA_SUAVE.cadaMs) : null;
  const reloj = alDia ? setInterval(() => {
    const c = cuadro(); if (c === null) return;          // (fuera de la carrera: nada)
    const ahora = hora(), b = pulso(ahora, c);
    for (const uid of a.lista) if (uid !== sala.yo) mandar(uid, b, 'pulso');
    const adelante = cuadroDeAdelante(pulsos, ahora);
    cuentas.alDia.atraso = adelante === null ? null : Math.round(adelante - c);
    if (cuentas.alDia.atraso > cuentas.alDia.maxAtraso) cuentas.alDia.maxAtraso = cuentas.alDia.atraso;
    const n = suave ? 0 : cuadrosPrisa(adelante, c);   // (?alDia=viejo: todo de una vez, como antes)
    if (n && !oculta() && ahora - ultimaPrisa >= AL_DIA.entrePrisasMs) {
      ultimaPrisa = ahora; cuentas.alDia.prisas++; cuentas.alDia.cuadros += n;
      try { prisa(n * 1000 / AL_DIA.porSegundo); } catch {}
    }
  }, AL_DIA.cadaMs) : null;
  registro(`[red-estado] soy el aid ${a.miAid} de ${a.consolas} (anfitriona ${a.anfitriona}); puestos → aid ${JSON.stringify(aidPuesto)}`);
  return {
    aids: a, aidPuesto, cuentas,
    // de la malla: los binarios que empiezan con MARCA_RED_ESTADO
    alBinario(de, b) {
      const pu = leerPulso(b);
      if (pu) { if (a.aidDe.has(de)) pulsos.set(de, pu); return; }
      if (b) cuentas.bytes.entra[b[1] === AVISO_LLEGO ? 'llego' : b[1] === LOTE_CPU ? 'cpu' : b[1] === PULSO ? 'pulso' : 'race'] += b.length;
      if (b?.[1] === AVISO_LLEGO && b.length >= 4) {   // 3c: los de esa consola que ya llegaron
        const aid = a.aidDe.get(de), m = b[2] | (b[3] << 8), d = new DataView(b.buffer, b.byteOffset, b.byteLength);
        if (aid !== undefined) [...Array(12).keys()].filter(i => m >> i & 1).forEach((i, k) => {
          if (4 + 4 * k + 4 <= b.length) M._mkw_red_estado_llego?.(aid, i, d.getUint32(4 + 4 * k, true));
        });
        cuentas.llegoRecibidos = (cuentas.llegoRecibidos || 0) + 1;
        return;
      }
      if (b?.[1] === LOTE_CPU) {   // 3b: las CPU, solo si viene de la anfitriona
        if (a.aidDe.get(de) !== a.anfitriona || soyAnfitriona || b.length > 2 + 12 * 65) { cuentas.tirados++; return; }
        M.HEAPU8.set(b, M._mkw_red_estado_llegada());
        M._mkw_red_estado_cpu_entregar(b.length); cuentas.cpu.lotesRecibidos++;
        return;
      }
      const x = desempaquetar(b);
      if (!x || a.aidDe.get(de) !== x.aid) { cuentas.tirados++; return; }
      const p = M._mkw_red_estado_llegada();
      M.HEAPU8.set(x.bytes, p);
      if (M._mkw_red_estado_entregar(x.aid, x.bytes.length)) { cuentas.recibidos++; cuentas.porAid[x.aid] = (cuentas.porAid[x.aid] || 0) + 1; }
      else cuentas.tirados++;
    },
    reconfigurar: configurar,
    estado: () => ({ ...cuentas, juego: [0, 1, 2, 3, 4, 5, 6, 7].map(i => M._mkw_red_estado_estado(i)),
      cpuJuego: [0, 1, 2, 3].map(i => M._mkw_red_estado_cpu_estado?.(i)),
      fin: [0, 1, 2, 3, 4, 5, 6, 7].map(i => M._mkw_red_estado_fin?.(i)),
      etapas: [10, 11, 12, 13, 14, 15, 16, 17].map(i => M._mkw_red_estado_fin?.(i)) }),
    apagar() {
      if (reloj) clearInterval(reloj);
      if (relojSuave) clearInterval(relojSuave);
      for (let i = 0; i < 12; i++) M._mkw_red_estado_cpu?.(i, 0);
      M._mkw_red_estado_config(0, 0, 0, 0, 1); M.mkwRedEstadoEnviar = null; M.mkwRedEstadoCpu = null; M.mkwRedEstadoLlego = null;
    },
  };
}
