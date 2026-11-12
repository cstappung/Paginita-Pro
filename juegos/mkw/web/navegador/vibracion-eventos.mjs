// La vibración del teléfono, solo en los momentos que importan y suave (§272, el dueño 2026-11-10: «haz que en móvil
// solo vibre cuando choca con algo, le pega algo y al inicio con el ya o con el turbo con champiñón, pero vibre suave,
// está vibrando demasiado fuerte»).
//
// Resumen: el juego no le dice al mando «vibra porque te pegó un plátano»: prende y apaga el motor (PADControlMotor)
// y nada más. Pero ANTES de eso, cada evento pide su patrón con un número: `ControllerHolder::RequestRumble(número)`
// (0x80521A34) guarda ese número en el ControllerHolder del jugador, en +0x10, mientras la vibración dura (y lo
// vuelve a 44 = «ninguna» cuando termina: 0x80521198). Es como un tablero eléctrico donde cada circuito tiene su
// etiqueta: el motor es la ampolleta, y el número en +0x10 es la etiqueta del interruptor que la prendió.
// Así que cuando el juego prende el motor, la página lee ese número en la memoria del juego (sin cambiar el
// programa) y decide:
//   - choque  (kart contra kart, contra la pared u objetos del circuito)  → pulso de 35 ms;
//   - golpe   (plátano, caparazón, bomba, rayo, POW, fuego, tinta, Thwomp…) → pulso de 30 ms;
//   - largada (el turbo de la salida, en los primeros 2 s después del «¡YA!») → pulso de 22 ms;
//   - champiñón (el turbo del champiñón: número 3 con el contador de turbo de champiñón del kart andando) → 18 ms;
//   - todo lo demás (derrape y miniturbo, pasto, rampas, piruetas, flechas de turbo, rebufo, los menús…) → nada.
// Una sola orden corta por evento: el motor del teléfono no tiene fuerza regulable, solo cuánto rato anda; un pulso
// de 20-35 ms se siente como un toquecito (antes: hasta 2 s seguidos).
//
// Los números salen del juego mismo (bitácora §272.2): quién llama a RequestRumble con qué número, leído en el C++
// traducido y con los nombres de las funciones de Pulsar. No se copia nada del juego: solo la tabla de números.
//
// No sabe nada del navegador: recibe el lector de la memoria (menus.mjs crearLector), el teléfono y el reloj, así se
// prueba en el banco (banco/pruebas/vibracion).

export const PULSO_MS = { choque: 35, golpe: 30, largada: 22, champinon: 18 };
export const NINGUNA = 44;          // el número que el juego deja en +0x10 cuando no hay vibración (0x80521198)
export const LARGADA_S = 2;         // ventana de la largada: el reloj de la carrera en menos de 2 s

// El número del patrón → qué es (de quién lo pide; las direcciones son del juego, los nombres de Pulsar)
export const KRM = {
  9: 'golpe',      // ApplyBananaDamage 0x80567F68
  10: 'golpe',     // ApplyGoombaDamage / ApplyFireDamage / ApplyPOWDamage 0x80567FB4, 0x80568000, 0x80568064
  11: 'golpe',     // el trompo (caparazones, plátano de costado) 0x80568794
  12: 'golpe',     //   (la otra variante del trompo)
  14: 'golpe',     // ApplyLaunchDamage (bomba, caparazón azul, explosiones, Cataquack) 0x805690A0
  36: 'golpe',     //   (la otra variante del lanzamiento)
  15: 'golpe',     // ApplyLightningEffect (el rayo) 0x80580778
  31: 'golpe',     // ApplyInk (la tinta del Blooper de otro) 0x80581A58
  34: 'golpe',     // Thwomp y aplastados 0x805696CC…0x80569978
  24: 'choque',    // CheckKartCollision (kart contra kart) 0x8056F7F0
  28: 'choque',    //   (contra uno más pesado)
  25: 'choque',    // ActivateRumble de los objetos del circuito y de los objetos de carrera al tocarte 0x80590478/0x80590570
  26: 'choque',    //   (ídem, con objeto en la mano)
  3: 'turbo',      // ApplyStartBoost 0x8058212C, ActivateMushroom 0x8057F3D8 (y otros turbos: se separan abajo)
  // sin vibrar (medidos en la carrera, §272.4): 8 = caer al suelo después de un salto (Kart::Status::UpdateCollisions
  // 0x80594BD4, solo si no es contra la pared), 19 = abrir una caja de objetos (Itembox::OnCollision 0x80828CB8),
  // 4 flechas de turbo, 5 miniturbo, 6 caballito, 16 salirse del circuito, 27 Mega, 32 cañón…
};

// Las dos tablas de patrones del juego (una por tipo de mando): objeto en 0x809BD70C, tablas en +0x4108 y +0x410C;
// cada entrada son 8 bytes (tipo, bandera, y en +4 la dirección de los pasos del patrón). Un Rumble activo guarda esa
// dirección en +0x4 (y el paso en curso en +0x8): con ella se sabe qué número de patrón es.
const TABLAS = 0x809BD70C, N_KRM = 45;
let mapaCache = null, mapaClave = 0;
function mapaPatrones(L) {
  const obj = L.u32(TABLAS);
  if (!obj) return null;
  const t0 = L.u32(obj + 0x4108), t1 = L.u32(obj + 0x410C), clave = (t0 ^ (t1 * 3)) >>> 0;
  if (mapaCache && clave === mapaClave) return mapaCache;
  const m = new Map();
  for (const t of [t0, t1]) {
    if (!t) continue;
    for (let i = 0; i < N_KRM; i++) { const d = L.u32(t + 8 * i + 4); if (d && !m.has(d)) m.set(d, i); }
  }
  mapaCache = m; mapaClave = clave;
  return m;
}
const esRam = d => (d >= 0x80000000 && d < 0x81800000) || (d >= 0x90000000 && d < 0x94000000);   // MEM1 o MEM2 (los ControllerHolder viven en MEM2)

// Lee lo que hace falta en la memoria del juego cuando el juego manda una orden al motor.
// L = lector de menus.mjs (u32, u16, u8). Devuelve null fuera de la carrera o sin jugador local que vibre.
// idxs = los números de patrón que están sonando ahora en ese jugador.
export function leerRumble(L) {
  const ri = L.u32(0x809BD730);                       // Raceinfo
  if (!ri) return null;
  const etapa = L.u32(ri + 0x28);                     // 0-1 presentación/cuenta, 2 corriendo, ≥ 3 terminada
  const lista = L.u32(ri + 0xC);                      // RaceinfoPlayer*[]
  const km = L.u32(0x809C18F8);                       // Kart::Manager
  const karts = km ? L.u32(km + 0x20) : 0, n = km ? Math.min(12, L.u8(km + 0x24)) : 0;
  const mapa = mapaPatrones(L);
  for (let i = 0; i < n && esRam(lista); i++) {       // solo los jugadores que existen (más allá hay basura)
    const jp = L.u32(lista + 4 * i);
    const holder = esRam(jp) ? L.u32(jp + 0x48) : 0;  // RealControllerHolder: solo los jugadores de esta consola
    if (!esRam(holder)) continue;
    const idxs = [], sonidos = [];   // sonidos: cada vibración activa con su clave y cuánto lleva (pos)
    // los patrones que se repiten guardan su número en +0x10 (44 = ninguno)
    const fijo = L.u32(holder + 0x10);
    if (fijo < N_KRM && fijo !== NINGUNA) { idxs.push(fijo); sonidos.push({ clave: 'fijo:' + fijo, idx: fijo, pos: 0 }); }
    // los de una vez van a la lista de Rumble activos de cada RumbleController (+0x20, +0x24)
    for (const off of [0x20, 0x24]) {
      const rc = L.u32(holder + off);
      if (!esRam(rc)) continue;
      const cuenta = L.u16(rc + 4 + 8), enlace = L.u16(rc + 4 + 0xA);
      let r = L.u32(rc + 4);
      for (let k = 0; k < Math.min(cuenta, 16) && esRam(r); k++) {
        const d = L.u32(r + 4), cur = L.u32(r + 8);
        const idx = mapa ? (mapa.get(d) ?? mapa.get(cur)) : undefined;
        if (idx !== undefined) {
          if (!idxs.includes(idx)) idxs.push(idx);
          // pos = cuántos pasos del patrón ya sonaron (el juego avanza +0x8 un byte por cuadro desde +0x4)
          const pos = cur >= d && cur - d < 0x1000 ? cur - d : 0;
          sonidos.push({ clave: (r >>> 0) + ':' + idx, idx, pos });
        }
        r = L.u32(r + enlace + 4);
      }
    }
    if (!idxs.length && !L.u32(holder + 0x20)) continue;
    // el kart de ese jugador: Kart::Manager → players[i] → Pointers (+0x1C) → Movement (+0x28) → Boost (+0x108)
    const kart = esRam(karts) ? L.u32(karts + 4 * i) : 0;
    const mov = esRam(kart) ? L.u32(kart + 0x1C + 0x28) : 0;
    const hongo = esRam(mov) ? (L.u16(mov + 0x110) << 16 >> 16) : 0;   // Boost.mushroomBoostPanelFrames
    // Kart::Status (Pointers +0x4): bitfield0 +0x4 (0x20/0x40 = contra la pared), bitfield1 +0x8 (0x1 = le pegó algo)
    const st = esRam(kart) ? L.u32(kart + 0x1C + 0x4) : 0;
    const pared = esRam(st) ? (L.u32(st + 0x4) & 0x60) !== 0 : false;
    const pegado = esRam(st) ? (L.u32(st + 0x8) & 0x1) !== 0 : false;
    const bits = esRam(st) ? [4, 8, 0xC, 0x10].map(o => (L.u32(st + o) >>> 0).toString(16)).join('/') : '';   // para el diagnóstico
    const tm = L.u32(ri + 0x14);                      // el reloj de la carrera: minutos +0x8, segundos +0xA
    const segundos = esRam(tm) ? L.u16(tm + 0x8) * 60 + L.u8(tm + 0xA) : 99;
    return { jugador: i, idxs, sonidos, idx: idxs[0] ?? -1, etapa, hongo, segundos, pared, pegado, bits };
  }
  return null;
}

// La pared: el juego NO pide ningún patrón al chocar contra la pared (medido, §272.4: el bit de pared se prende sin
// vibración), así que la página lo mira ella misma en cada refresco: Kart::Status +0x4 bit 0x40 («wall collision»)
// que se prende, con el kart yendo al menos a PARED_RAPIDEZ de su máximo el cuadro anterior (Movement +0xB0,
// speedRatioCapped, 0 a 1: rozar la pared despacio no cuenta). Como un detector de flanco de subida con umbral.
export const PARED_RAPIDEZ = 0.45;
export const PARED_REPOSO_MS = 500;    // un roce largo contra la pared prende y apaga el bit: un pulso cada 0,5 s como mucho
const flotante = new DataView(new ArrayBuffer(4));
const f32 = (L, a) => { flotante.setUint32(0, L.u32(a)); return flotante.getFloat32(0); };
let jugadorCache = -1, carreraCache = 0;
export function leerPared(L) {
  const ri = L.u32(0x809BD730);
  if (!esRam(ri)) { jugadorCache = -1; return null; }
  const etapa = L.u32(ri + 0x28);
  if (etapa !== 2) return { etapa, pared: false, rapidez: 0 };
  const lista = L.u32(ri + 0xC), km = L.u32(0x809C18F8);
  const karts = esRam(km) ? L.u32(km + 0x20) : 0, n = esRam(km) ? Math.min(12, L.u8(km + 0x24)) : 0;
  if (ri !== carreraCache) { jugadorCache = -1; carreraCache = ri; }
  if (jugadorCache < 0 && esRam(lista)) {               // el jugador de esta consola: el primero con ControllerHolder
    for (let i = 0; i < n; i++) { const jp = L.u32(lista + 4 * i); if (esRam(jp) && esRam(L.u32(jp + 0x48))) { jugadorCache = i; break; } }
  }
  const i = jugadorCache;
  if (i < 0 || i >= n || !esRam(karts)) return null;
  const kart = L.u32(karts + 4 * i);
  if (!esRam(kart)) return null;
  const st = L.u32(kart + 0x1C + 0x4), mov = L.u32(kart + 0x1C + 0x28);
  const pared = esRam(st) ? (L.u32(st + 0x4) & 0x40) !== 0 : false;
  const rapidez = esRam(mov) ? f32(L, mov + 0xB0) : 0;
  return { etapa, pared, rapidez: Number.isFinite(rapidez) ? rapidez : 0 };
}

// Qué evento es un número de patrón (o null = no vibrar)
export function clasificarIdx(idx, r) {
  if (!r || r.etapa < 1 || r.etapa > 2) return null;        // solo en la carrera (cuenta incluida, la llegada no)
  const tipo = KRM[idx];
  if (tipo !== 'turbo') return tipo || null;
  if (r.segundos < LARGADA_S) return 'largada';             // ApplyStartBoost: justo después del «¡YA!»
  if (r.hongo > 0) return 'champinon';                      // ActivateMushroom (las flechas del piso piden el 4)
  return null;                                              // piruetas, rebufo, el turbo de quieto…: nada
}
const PRIORIDAD = ['choque', 'golpe', 'largada', 'champinon'];
export function clasificar(r, idxs = r?.idxs ?? (r ? [r.idx] : [])) {
  let mejor = null;
  for (const i of idxs) { const t = clasificarIdx(i, r); if (t && (!mejor || PRIORIDAD.indexOf(t) < PRIORIDAD.indexOf(mejor))) mejor = t; }
  return mejor;
}

// telefono(ms): una orden de vibrar. leer(): leerRumble(lector) o null. ahora(): el reloj en ms.
export function crearVibracionEventos({ telefono = () => {}, leer = () => null, leerPared = () => null, ahora = () => performance.now(),
                                        pulsos = PULSO_MS } = {}) {
  const estado = { ordenes: 0, eventos: {}, vistos: {}, ignorados: 0, ultimo: null, historial: [] };   // historial: los últimos 100
  let encendido = false, ultimoMotor = -1e9, sonando = new Map();   // clave → avance
  let paredAntes = false, rapidezAntes = 0, ultimaPared = -1e9, ultimoChoque = -1e9;
  return {
    estado,
    // el juego prendió (true) o apagó (false) el motor (cada flanco del PWM)
    pedir(on) {
      const t = ahora();
      if (!on) { if (encendido) ultimoMotor = t; encendido = false; return; }
      const r = leer();
      encendido = true; ultimoMotor = t;
      // un mismo evento manda muchas órdenes (PWM): vale solo la vibración que recién EMPIEZA. Cada una tiene su
      // clave (dónde vive + número) y su avance: nueva = no estaba antes y va en sus primeros pasos, o volvió atrás
      // (el juego reusó el mismo lugar para otra). Si el lector no trae `sonidos`, cada número es una clave.
      const sonidos = r ? (r.sonidos ?? (r.idxs ?? [r.idx]).map(i => ({ clave: 'n:' + i, idx: i, pos: 0 }))) : [];
      const nuevos = [], ahoraSuenan = new Map();
      for (const x of sonidos) {
        const antes = sonando.get(x.clave);
        if ((antes === undefined && x.pos <= 8) || (antes !== undefined && x.pos < antes)) { if (!nuevos.includes(x.idx)) nuevos.push(x.idx); }
        ahoraSuenan.set(x.clave, x.pos);
      }
      sonando = ahoraSuenan;
      if (!nuevos.length) return;
      for (const i of nuevos) estado.vistos[i] = (estado.vistos[i] || 0) + 1;     // qué pidió el juego (diagnóstico)
      const tipo = clasificar(r, nuevos);
      estado.ultimo = { t: Math.round(t), idx: nuevos[0], idxs: nuevos, tipo, etapa: r?.etapa ?? -1, segundos: r?.segundos ?? -1, hongo: r?.hongo ?? 0, pared: !!r?.pared, pegado: !!r?.pegado, bits: r?.bits || '' };
      estado.historial.push(estado.ultimo); if (estado.historial.length > 100) estado.historial.shift();
      if (!tipo) { estado.ignorados++; return; }
      estado.eventos[tipo] = (estado.eventos[tipo] || 0) + 1;
      estado.ordenes++;
      if (tipo === 'choque') { if (t - ultimoChoque < 150) { estado.ordenes--; estado.eventos[tipo]--; return; } ultimoChoque = t; }
      telefono(pulsos[tipo]);
    },
    // cada refresco de pantalla: la pared (ver leerPared)
    vigilar() {
      const p = leerPared();
      if (!p || p.etapa !== 2) { paredAntes = false; rapidezAntes = 0; return; }
      const t = ahora();
      const sube = p.pared && !paredAntes;
      const rapidez = rapidezAntes;
      paredAntes = p.pared; rapidezAntes = p.rapidez;
      if (!sube || rapidez < PARED_RAPIDEZ || t - ultimaPared < PARED_REPOSO_MS) return;
      ultimaPared = t;
      estado.vistos.pared = (estado.vistos.pared || 0) + 1;
      // si el juego ya pidió un choque en este momento (kart contra kart u objeto), no se repite
      if (t - ultimoChoque < 150) return;
      ultimoChoque = t;
      estado.ultimo = { t: Math.round(t), idx: 'pared', idxs: [], tipo: 'choque', etapa: 2, segundos: -1, hongo: 0, rapidez: Math.round(rapidez * 100) / 100 };
      estado.historial.push(estado.ultimo); if (estado.historial.length > 100) estado.historial.shift();
      estado.eventos.choque = (estado.eventos.choque || 0) + 1;
      estado.ordenes++;
      telefono(pulsos.choque);
    },
    parar() { encendido = false; sonando = new Map(); },
  };
}
