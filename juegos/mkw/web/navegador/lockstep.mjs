// La carrera sincronizada (lockstep) de la sala con CPU — bitácora §61.
//
// Resumen: en la sala con CPU de relleno, cada navegador corre LA MISMA carrera offline (12 karts: los humanos de la
// sala y CPU) y para que salga igual en todos, en cada cuadro todos usan los mismos botones de cada humano. El juego
// (pad_web.cpp) pide los botones de un cuadro con pad(cuadro) y espera la respuesta (32 enteros: 4 puertos × 8). Este módulo:
//   - guarda lo que toca este jugador para el cuadro actual + RETRASO (3 cuadros = 50 ms: el tiempo que tienen sus
//     botones para llegar a los demás antes de hacer falta) y se lo manda a todos;
//   - junta los de los demás (llegan por la malla WebRTC, canal "udp") y responde cuando tiene los de todos;
//   - cada paquete repite los últimos 16 cuadros (si se pierde uno, el siguiente lo trae); si igual falta alguno,
//     pide que se lo reenvíen (a todos: cualquiera que lo tenga contesta);
//   - si un humano se va (4 s sin sus botones) o nunca llega (45 s), el "decisor" (el primer humano que sigue y no falta) anuncia desde qué cuadro su
//     kart sigue sin nadie (botones sueltos) y todos hacen lo mismo en el mismo cuadro;
//   - cada 120 cuadros compara una "huella" de la carrera (el avance de los 12 karts) con los demás: si no coincide,
//     la carrera se desincronizó (no debería pasar: el juego es determinista con el reloj fijo, §61).
// Como un sistema de control distribuido con reloj común: nadie avanza un paso hasta tener las entradas de todos.
//
// Formato de los mensajes (binario, el primer byte 0xA7 los distingue de los de red.mjs, que empiezan con el largo):
//   [0xA7, tipo, carrera, mando, u32 cuadro, …]  tipo 1 botones (u8 cuántos + 8 bytes por cuadro), 2 pide, 3 corte,
//   4 huella (u32), 5 propone corte, 6 "tengo hasta este cuadro". 8 bytes por cuadro: botones u16, stick x/y, stick C x/y (i8), gatillos L/R (u8).
//
// Uso:  const ls = crearLockstep({ yo, humanos: [{ uid, mando }], enviar: (uid, bytes, canal) => …, local: () => [7 números] });
//       Module.mkwLockstep = ls;  malla → ls.alBinario(de, bytes)  (los que empiezan con MARCA)
export const MARCA = 0xA7;
export const RETRASO = 3;
const REPITE = 16, CADA_HUELLA = 120, ESPERA_PIDE = 120, ESPERA_CORTE = 4000, ESPERA_INICIO = 45000;
const NEUTRO = [0, 0, 0, 0, 0, 0, 0];
const START = 0x1000;                      // pausa: en la carrera de la sala no se pausa (pausaría solo una consola)

export function crearLockstep({ yo, humanos, enviar, local, huella = null, retraso = RETRASO, registro = () => {},
  ahora = () => performance.now(), esperaCorte = ESPERA_CORTE, esperaInicio = ESPERA_INICIO }) {
  const miMando = humanos.find(h => h.uid === yo)?.mando ?? -1;
  const mandos = humanos.map(h => h.mando);
  const duenoDe = new Map(humanos.map(h => [h.mando, h.uid]));
  let carrera = 0, ultimo = -1;           // carrera en curso (cuenta desde 1) y último cuadro pedido
  let tablas = new Map(), cortes = new Map(), siguiente = null;   // mando → Map(cuadro → [7]); mando → cuadro de corte
  let espera = null;                      // { cuadro, listo, desde, pedido }
  const huellas = new Map();              // cuadro → { mia, de: Map(uid → h) }
  const propuestas = new Map();           // corte propuesto: mando → { de: Map(uid → último cuadro que tiene), desde: ms }
  const est = { cuadros: 0, esperas: 0, msEsperando: 0, maxEspera: 0, msLlegada: 0, desincronizado: null, huellasIguales: 0, cortes: [] };

  const tabla = m => { let t = tablas.get(m); if (!t) tablas.set(m, t = new Map()); return t; };
  const vivos = () => humanos.filter(h => !cortes.has(h.mando));
  // el botón de un mando en un cuadro: neutro antes de RETRASO (nadie tocó nada todavía) y desde su corte
  function boton(m, c) {
    if (c < retraso) return NEUTRO;
    if (cortes.has(m) && c >= cortes.get(m)) return NEUTRO;
    return tabla(m).get(c);
  }
  const listo = c => mandos.every(m => boton(m, c) !== undefined);
  // el último cuadro que tengo de un mando (RETRASO - 1 si no tengo ninguno)
  const ultimoDe = m => { let x = retraso - 1; for (const c of tabla(m).keys()) if (c > x) x = c; return x; };

  function empaca(tipo, mando, cuadro, extra = 0) {
    const b = new Uint8Array(8 + extra);
    b[0] = MARCA; b[1] = tipo; b[2] = carrera & 255; b[3] = mando;
    new DataView(b.buffer).setUint32(4, cuadro >>> 0);
    return b;
  }
  function paqueteBotones(m, desde, hasta) {
    const t = tabla(m), lista = [];
    for (let c = Math.max(desde, retraso); c <= hasta; c++) { const v = t.get(c); if (!v) break; lista.push(v); }
    if (!lista.length) return null;
    const b = empaca(1, m, Math.max(desde, retraso), 1 + 8 * lista.length), d = new DataView(b.buffer);
    b[8] = lista.length;
    lista.forEach((v, i) => { const o = 9 + 8 * i; d.setUint16(o, v[0] & 0xFFFF); for (let k = 1; k < 5; k++) d.setInt8(o + 1 + k, v[k]); d.setUint8(o + 6, v[5]); d.setUint8(o + 7, v[6]); });
    return b;
  }
  const aTodos = (bytes, canal = 'udp') => { for (const h of humanos) if (h.uid !== yo) enviar(h.uid, bytes, canal); };

  function nuevaCarrera() {
    carrera++; ultimo = -1; espera = null; huellas.clear(); propuestas.clear();
    tablas = siguiente?.carrera === carrera ? siguiente.tablas : new Map();
    cortes = siguiente?.carrera === carrera ? siguiente.cortes : new Map();
    // los que se fueron en la carrera anterior siguen fuera
    for (const c of est.cortes) if (!cortes.has(c.mando)) cortes.set(c.mando, 0);
    siguiente = null;
    registro(`[lockstep] carrera ${carrera}: ${humanos.length} humanos, yo en el mando ${miMando}, retraso ${retraso}`);
  }

  // ---- lo que pide el juego (pad_web.cpp) ----
  async function pad(cuadro) {
    if (ultimo < 0 || cuadro + 300 < ultimo) nuevaCarrera();     // primer cuadro, o el contador volvió a empezar
    ultimo = cuadro;
    est.cuadros++;
    // lo mío: el estado de ahora vale para cuadro + retraso (y para los cuadros intermedios que no tenían nada)
    if (miMando >= 0 && !cortes.has(miMando)) {
      const v = (local() || NEUTRO).slice(0, 7); v[0] &= ~START;
      const t = tabla(miMando);
      for (let c = Math.max(retraso, cuadro); c <= cuadro + retraso; c++) if (!t.has(c)) t.set(c, v);
      const p = paqueteBotones(miMando, cuadro + retraso - REPITE + 1, cuadro + retraso);
      if (p) aTodos(p);
    }
    if (!listo(cuadro)) {
      const t0 = ahora();
      // ¿espero a alguien que todavía no llegó a la carrera (no mandó nada)? Eso es la "llegada" (cada uno carga a su
      // ritmo), no el costo de sincronizar: se cuenta aparte
      const llegada = mandos.some(m => m !== miMando && !cortes.has(m) && tabla(m).size === 0);
      await new Promise(resolver => { espera = { cuadro, resolver, desde: t0, pedido: 0 }; revisar(); });
      const ms = ahora() - t0;
      if (llegada) est.msLlegada += ms;
      else { est.esperas++; est.msEsperando += ms; est.maxEspera = Math.max(est.maxEspera, ms); }
    }
    // los 4 puertos: conectado, botones, sx, sy, cx, cy, gl, gr (pad_web.cpp los copia al mando de cada puerto).
    // conectado = 2: ese humano se fue (desde su corte): el juego deja de esperarlo para terminar la carrera
    const datos = new Int32Array(32);
    for (let p = 0; p < 4; p++) {
      const v = mandos.includes(p) ? boton(p, cuadro) : null;
      if (!v) continue;
      datos[p * 8] = cortes.has(p) && cuadro >= cortes.get(p) ? 2 : 1;
      for (let k = 0; k < 7; k++) datos[p * 8 + 1 + k] = v[k];
    }
    if (huella && cuadro % CADA_HUELLA === 0 && cuadro > 0) compararHuella(cuadro, huella());
    return datos;
  }

  // ¿ya se puede seguir? Si no: pedir lo que falta y, después de mucho, cortar al que no aparece
  function revisar() {
    if (!espera) return;
    const { cuadro } = espera;
    if (listo(cuadro)) { const r = espera.resolver; espera = null; propuestas.clear(); r(); return; }
    const t = ahora() - espera.desde;
    const faltan = mandos.filter(m => boton(m, cuadro) === undefined);
    if (t > ESPERA_PIDE && ahora() - espera.pedido > ESPERA_PIDE) {
      espera.pedido = ahora();
      for (const m of faltan) aTodos(empaca(2, m, cuadro), 'udp');
    }
    // decide el primer humano que sigue Y que no es uno de los que faltan (si el que falta es justo el primero —por
    // ejemplo nunca llegó—, decide el siguiente: todos los que siguen ven faltar al mismo y eligen igual)
    const decide = vivos().find(h => !faltan.includes(h.mando))?.uid;
    // El corte va en dos pasos (como un "commit" en dos fases): 1) el decisor pregunta a todos hasta qué cuadro tienen
    // los botones del que falta (y ellos se los reparten); 2) corta DESPUÉS del último que tenga cualquiera. Así nadie
    // usó botones de verdad en un cuadro que para otro ya es "sin nadie" (eso desincronizaría la carrera).
    // al que todavía no mandó nada en esta carrera se le espera más (esperaInicio): cada uno llega a la carrera a su
    // ritmo (la carga del disco, los menús); al que ya estaba y se calla, solo esperaCorte
    if (decide === yo)
      for (const m of faltan) if (!propuestas.has(m) && t > (tabla(m).size ? esperaCorte : esperaInicio)) {
        propuestas.set(m, { de: new Map(), desde: ahora() });
        aTodos(empaca(5, m, cuadro), 'tcp');
      }
    for (const [m, p] of propuestas) {
      const deben = humanos.filter(h => h.uid !== yo && !cortes.has(h.mando) && !faltan.includes(h.mando));
      if (deben.every(h => p.de.has(h.uid)) || ahora() - p.desde > esperaCorte) {
        propuestas.delete(m);
        cortar(m, Math.max(ultimoDe(m), ...p.de.values()) + 1, true);
      }
    }
    if (espera) setTimeout(revisar, 40);
  }

  function cortar(m, desde, anunciar) {
    if (cortes.has(m) && cortes.get(m) <= desde) return;
    cortes.set(m, desde);
    est.cortes.push({ mando: m, desde, carrera });
    registro(`[lockstep] el mando ${m} (${duenoDe.get(m)}) sigue sin nadie desde el cuadro ${desde}`);
    if (anunciar) aTodos(empaca(3, m, desde), 'tcp');
    revisar();
  }

  function compararHuella(cuadro, h) {
    let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
    e.mia = h >>> 0;
    aTodos((() => { const b = empaca(4, miMando & 255, cuadro, 4); new DataView(b.buffer).setUint32(8, e.mia); return b; })(), 'tcp');
    revisarHuella(cuadro);
  }
  function revisarHuella(cuadro) {
    const e = huellas.get(cuadro); if (!e || e.mia === undefined) return;
    for (const [u, h] of e.de) {
      if (h === e.mia) { est.huellasIguales++; e.de.delete(u); continue; }
      if (!est.desincronizado) { est.desincronizado = { cuadro, carrera, con: u }; registro(`[lockstep] ¡DESINCRONIZADO con ${u} en el cuadro ${cuadro} (carrera ${carrera})!`); }
      e.de.delete(u);
    }
  }

  // ---- lo que llega de los demás ----
  function alBinario(de, b) {
    if (b[0] !== MARCA || b.length < 8) return;
    const tipo = b[1], c = b[2], m = b[3], d = new DataView(b.buffer, b.byteOffset, b.byteLength), cuadro = d.getUint32(4);
    // ¿de esta carrera, de la siguiente (alguien ya empezó) o vieja?
    let destino;
    if (c === (carrera & 255)) destino = { tablas, cortes };
    else if (c === ((carrera + 1) & 255)) { if (!siguiente) siguiente = { carrera: carrera + 1, tablas: new Map(), cortes: new Map() }; destino = siguiente; }
    else return;
    if (tipo === 1) {
      let t = destino.tablas.get(m); if (!t) destino.tablas.set(m, t = new Map());
      const n = b[8];
      for (let i = 0; i < n && 9 + 8 * i + 8 <= b.length; i++) {
        const o = 9 + 8 * i, f = cuadro + i;
        if (!t.has(f)) t.set(f, [d.getUint16(o), d.getInt8(o + 2), d.getInt8(o + 3), d.getInt8(o + 4), d.getInt8(o + 5), d.getUint8(o + 6), d.getUint8(o + 7)]);
      }
      if (destino.tablas === tablas) revisar();
    } else if (tipo === 2) {
      // alguien pide los botones del mando m desde `cuadro`: si los tengo (míos o de otro), se los mando
      const t = destino.tablas.get(m);
      if (t?.has(cuadro) && destino.tablas === tablas) { const p = paqueteBotones(m, cuadro, cuadro + 63); if (p) enviar(de, p, 'udp'); }
    } else if (tipo === 3) {
      if (destino.tablas === tablas) cortar(m, cuadro, false); else destino.cortes.set(m, cuadro);
    } else if (tipo === 5 && destino.tablas === tablas) {
      // el decisor va a cortar el mando m: le digo hasta dónde tengo y reparto lo que tengo (por "tcp": llega antes
      // que la respuesta, en orden)
      const x = ultimoDe(m), p = paqueteBotones(m, Math.max(retraso, x - 63), x);
      if (p) aTodos(p, 'tcp');
      enviar(de, empaca(6, m, x), 'tcp');
    } else if (tipo === 6 && destino.tablas === tablas) {
      propuestas.get(m)?.de.set(de, cuadro);
      revisar();
    } else if (tipo === 4 && b.length >= 12 && destino.tablas === tablas) {
      let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
      e.de.set(de, d.getUint32(8));
      revisarHuella(cuadro);
    }
  }

  return { pad, alBinario, estado: () => ({ ...est, carrera, cuadro: ultimo, miMando, cortes: Object.fromEntries(cortes) }) };
}

// La huella de la carrera para comparar entre consolas: el avance (raceCompletion, Raceinfo → jugador +0xC) de los
// 12 karts, mezclado. L = el lector de memoria de menus.mjs.
export function huellaCarrera(L) {
  const ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
  let h = 2166136261;
  for (let i = 0; i < 12; i++) h = Math.imul(h ^ L.u32(L.u32(lista + 4 * i) + 0xC), 16777619);
  return h >>> 0;
}

// El plantel de la carrera: los humanos en los primeros puestos (cada uno con su mando: el orden de la sala) y CPU
// en el resto, todos con personaje y vehículo. Los de los CPU salen de la semilla (los mismos en todas las consolas).
// Cada personaje tiene su peso (0 liviano, 1 mediano, 2 pesado) y el vehículo tiene que ser de ese peso: los
// vehículos van liviano/mediano/pesado alternados (id % 3).
export const PESO = [1, 0, 2, 2, 0, 0, 0, 1, 0, 2, 1, 2, 0, 0, 0, 1, 1, 1, 1, 2, 1, 2, 2, 2];   // personajes 0..23
export function armarPlantel({ humanos, semilla }) {
  let x = (semilla >>> 0) || 1;
  const azar = n => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
  const usados = new Set();
  const plantel = [];
  humanos.forEach((h, i) => {
    const pj = Number.isInteger(h.personaje) && h.personaje >= 0 && h.personaje < 24 ? h.personaje : [0, 7, 16, 10][i % 4];
    let veh = Number.isInteger(h.vehiculo) && h.vehiculo >= 0 && h.vehiculo < 36 ? h.vehiculo : PESO[pj] + 0;
    if (veh % 3 !== PESO[pj]) veh = PESO[pj];                                   // el kart estándar de su peso
    usados.add(pj);
    plantel.push([veh, pj, 1, h.mando]);
  });
  while (plantel.length < 12) {
    let pj; do pj = azar(24); while (usados.has(pj) && usados.size < 24);
    usados.add(pj);
    plantel.push([PESO[pj] + 3 * azar(12), pj, 1, -1]);
  }
  return plantel;
}
