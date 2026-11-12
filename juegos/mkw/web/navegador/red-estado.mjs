// El piloto «host + predicción» (bitácora §275): cada consola maneja SU kart al instante y por la red viaja el ESTADO
// (dónde está cada kart), no los botones. Los karts de los demás se dibujan con lo último que llegó.
//
// Resumen general:
//   - El juego ya trae este modelo adentro: su modo en línea (RKNet: paquetes RACEHEADER_1 + RACEDATA con la posición,
//     la dirección y la velocidad de cada kart; Kart::MovementRemote mueve los karts de las otras consolas). La página
//     ya lo lleva por la malla WebRTC (§58: los sockets del juego → red.mjs → malla.mjs). `?red=estado` en mkw.mjs es
//     ese camino (`red=malla&modo=enlinea`) más la SONDA de este archivo, que mide.
//   - Las funciones puras de arriba (sin el juego) son el modelo del «estado que llega por la red»: guardar lo que llega
//     (aunque llegue tarde, repetido o desordenado), y pedir «¿dónde dibujo al otro AHORA?» = interpolar entre dos
//     muestras con un pequeño atraso fijo, o adivinar hacia adelante (extrapolar) un rato corto si no llega nada. Las
//     usa el banco `banco/pruebas/red-estado/` y sirven para un camino propio si algún día no se usa el del juego.
//   - Las funciones de medir comparan trayectorias (el kart de A visto en A = la verdad, contra el kart de A visto en B)
//     y cuentan cuadros de lógica por segundo.
//   - `crearSonda` corre en la página: en cada refresco, si avanzó la lógica, anota el cuadro, la hora y la posición de
//     cada kart (memoria del juego: Kart::Manager 0x809C18F8 → +0x20 jugadores; la posición es la que devuelve
//     Kart::Link::GetKartPosition 0x8059020C = jugador → +0 → +8 → +0x90 → +4, y +0x68 tres floats).
//
// Comparación eléctrica: el lockstep es un sistema con reloj común (todas las consolas avanzan juntas, como un bus
// síncrono: el más lento marca el ritmo). Este modelo es asíncrono: cada consola tiene su propio oscilador, y lo que
// viaja son muestras del estado; quien recibe las reconstruye como un conversor D/A con retención e interpolación.

// ---------- 1. El búfer de estado de UN kart remoto ----------
// opciones:
//   retrasoMs     el atraso fijo con que se dibuja (para tener siempre dos muestras entre las que interpolar)
//   extrapolarMs  cuánto se adivina hacia adelante si se acaban las muestras; después se queda quieto
//   tope          cuántas muestras se guardan
export function crearBufferEstado({ retrasoMs = 100, extrapolarMs = 250, tope = 64 } = {}) {
  const m = [];                       // muestras ordenadas por hora: { t, seq, pos:[x,y,z], vel:[x,y,z] por ms }
  let ultimoSeq = -Infinity, tiradas = 0, tardias = 0;
  return {
    // recibir un paquete de estado. Devuelve 'nuevo' | 'tarde' (llegó después de uno más nuevo: se guarda en su lugar
    // si todavía sirve) | 'repetido' | 'viejo' (más viejo que todo lo guardado: no sirve)
    recibir(p) {
      if (!p || !Number.isFinite(p.t) || !Array.isArray(p.pos)) return 'malo';
      if (m.some(x => x.seq === p.seq)) { tiradas++; return 'repetido'; }
      const s = { t: p.t, seq: p.seq, pos: p.pos.slice(0, 3), vel: Array.isArray(p.vel) ? p.vel.slice(0, 3) : null };
      if (p.seq > ultimoSeq) { ultimoSeq = p.seq; m.push(s); m.sort((a, b) => a.t - b.t); }
      else {
        if (m.length && p.t < m[0].t) { tiradas++; return 'viejo'; }
        tardias++; m.push(s); m.sort((a, b) => a.t - b.t);
        while (m.length > tope) m.shift();
        return 'tarde';
      }
      while (m.length > tope) m.shift();
      return 'nuevo';
    },
    // ¿dónde se dibuja el kart a la hora `ahora`? (la hora de quien envía: en la prueba, la misma hora de la sala)
    muestrear(ahora) {
      if (!m.length) return { pos: null, modo: 'vacio', edadMs: Infinity };
      const t = ahora - retrasoMs;
      if (t <= m[0].t) return { pos: m[0].pos.slice(), modo: 'primera', edadMs: ahora - m[0].t };
      for (let i = m.length - 1; i > 0; i--) {
        const a = m[i - 1], b = m[i];
        if (a.t <= t && t <= b.t) {
          const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
          return { pos: a.pos.map((v, j) => v + (b.pos[j] - v) * k), modo: 'interp', edadMs: ahora - b.t };
        }
      }
      // pasado la última muestra: adivinar con su velocidad (o con la de las dos últimas), como mucho extrapolarMs
      const u = m[m.length - 1], ant = m.length > 1 ? m[m.length - 2] : null;
      const vel = u.vel ?? (ant && u.t > ant.t ? u.pos.map((v, j) => (v - ant.pos[j]) / (u.t - ant.t)) : [0, 0, 0]);
      const dt = Math.min(t - u.t, extrapolarMs);
      return { pos: u.pos.map((v, j) => v + vel[j] * dt), modo: t - u.t > extrapolarMs ? 'quieto' : 'extrap', edadMs: ahora - u.t };
    },
    estado: () => ({ muestras: m.length, ultimoSeq, tiradas, tardias }),
  };
}

// ---------- 2. Medir ----------
export const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// la verdad (lista {t, pos} ordenada) interpolada a la hora t; null fuera de su rango
export function posicionEn(verdad, t) {
  if (!verdad.length || t < verdad[0].t || t > verdad[verdad.length - 1].t) return null;
  let lo = 0, hi = verdad.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (verdad[mid].t <= t) lo = mid; else hi = mid; }
  const a = verdad[lo], b = verdad[hi], k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return a.pos.map((v, j) => v + (b.pos[j] - v) * k);
}

const percentil = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

// error de la vista contra la verdad: para cada muestra de la vista, la distancia a la verdad a esa misma hora
// devuelve { n, medio, p50, p90, max } (en unidades del juego; en MKW 1 unidad ≈ 1 cm)
export function errorTrayectoria(verdad, vista) {
  const e = [];
  for (const s of vista) { const v = posicionEn(verdad, s.t); if (v && s.pos) e.push(distancia(v, s.pos)); }
  if (!e.length) return { n: 0, medio: null, p50: null, p90: null, max: null };
  return { n: e.length, medio: e.reduce((a, b) => a + b, 0) / e.length, p50: percentil(e, 0.5), p90: percentil(e, 0.9), max: Math.max(...e) };
}

// cuánto atraso tiene la vista: el corrimiento en ms que hace mínimo el error (de 0 a maxMs, paso pasoMs)
export function atrasoDeVista(verdad, vista, { maxMs = 1000, pasoMs = 8 } = {}) {
  let mejor = { ms: 0, medio: Infinity };
  for (let d = 0; d <= maxMs; d += pasoMs) {
    const r = errorTrayectoria(verdad, vista.map(s => ({ t: s.t - d, pos: s.pos })));
    if (r.n > 5 && r.medio < mejor.medio) mejor = { ms: d, medio: r.medio };
  }
  return mejor;
}

// cuadros de lógica por segundo entre dos muestras {t, f}
export function ritmo(muestras) {
  if (muestras.length < 2) return null;
  const a = muestras[0], b = muestras[muestras.length - 1];
  return b.t > a.t ? (b.f - a.f) / ((b.t - a.t) / 1000) : null;
}

// la respuesta del kart propio a soltar el acelerador: muestras {f, pos} del kart propio cuadro a cuadro y el cuadro
// `fSuelta` en que el botón dejó de llegar al juego. Devuelve cuántos cuadros después la velocidad empezó a bajar
// (0 = en el mismo cuadro), o null si no se vio. La velocidad = distancia por cuadro
export function cuadrosDeRespuesta(muestras, fSuelta, { caida = 0.004 } = {}) {
  const v = [];
  for (let i = 1; i < muestras.length; i++) {
    const a = muestras[i - 1], b = muestras[i];
    // desde = el cuadro donde empieza el tramo: si la sonda se saltó cuadros (el PC cargado), la velocidad es el
    // promedio del tramo (a.f, b.f] y la caída pudo pasar en cualquiera de ellos; se cuenta desde su comienzo
    if (b.f > a.f) v.push({ f: b.f, desde: a.f, vel: distancia(a.pos, b.pos) / (b.f - a.f) });
  }
  const antes = v.filter(x => x.f <= fSuelta).slice(-10);
  if (antes.length < 3) return null;
  const base = Math.max(...antes.map(x => x.vel));
  if (!(base > 0)) return null;
  const caer = v.find(x => x.f > fSuelta && x.vel < base * (1 - caida));
  // con muestras de todos los cuadros desde = f − 1, o sea f − fSuelta − 1 (el cuadro fSuelta+1 es el primero que corre
  // sin el botón); con un hueco, el tramo que ya trae la caída cuenta desde su comienzo (antes daba 2 o 3 «de atraso»
  // que eran solo los cuadros que la sonda no vio)
  return caer ? Math.max(0, caer.desde - fSuelta) : null;
}

// ---------- 3. La sonda en la página ----------
// lector = () => window.mkwMenus (u32/u8 de la memoria del juego). Anota hasta `tope` muestras
export function crearSonda({ lector, tope = 20000, ahora = () => performance.timeOrigin + performance.now() } = {}) {
  const muestras = [], marcas = [];
  const f32 = x => new DataView(new Uint32Array([x]).buffer).getFloat32(0, true);
  let ultimoF = -1, vivo = true;
  const leer = () => {
    const L = lector?.(); if (!L?.u32) return null;
    const ri = L.u32(0x809BD730); if (!ri) return null;
    const etapa = L.u32(ri + 0x28); if (etapa > 4) return null;
    const f = L.u32(ri + 0x1C) + L.u32(ri + 0x20);
    const km = L.u32(0x809C18F8); if (!km) return null;
    const n = Math.min(12, L.u8(km + 0x24)), lista = L.u32(km + 0x20), karts = [];
    for (let i = 0; i < n; i++) {
      try {
        const ph = L.u32(L.u32(L.u32(L.u32(L.u32(lista + 4 * i)) + 8) + 0x90) + 4), p = ph + 0x68;
        karts.push([f32(L.u32(p)), f32(L.u32(p + 4)), f32(L.u32(p + 8))]);
      } catch { karts.push(null); }
    }
    let propio = -1; try { propio = L.u8(L.u32(0x809BD728) + 0x20 + 0xB64); } catch {}
    return { t: ahora(), f, etapa, karts, propio };
  };
  const vuelta = () => {
    if (!vivo) return;
    try { const s = leer(); if (s && s.f !== ultimoF) { ultimoF = s.f; muestras.push(s); if (muestras.length > tope) muestras.shift(); } } catch {}
    requestAnimationFrame(vuelta);
  };
  requestAnimationFrame(vuelta);
  return {
    // la prueba marca un momento (p. ej. «soltó el acelerador»): se anota con el cuadro de lógica de ese momento
    marcar(que) { const s = leer(); marcas.push({ que, t: ahora(), f: s?.f ?? null }); return s?.f ?? null; },
    muestras: (desde = 0) => muestras.filter(s => s.t >= desde),
    marcas: () => marcas.slice(),
    ultima: () => muestras[muestras.length - 1] ?? null,
    parar() { vivo = false; },
  };
}
