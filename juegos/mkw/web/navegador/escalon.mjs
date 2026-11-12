// N12 (plan v4, etapa E6, bitácora §233): lo que no se puede por física, y decirlo en la página.
//
// Resumen: hay límites que ningún arreglo del motor saca. (1) Un aparato que no simula 60 cuadros de carrera por
// segundo ni dibujando la mitad no puede ir a la par en la sala (el lockstep lo releva para que no frene a los demás,
// pero él ve saltos). (2) Con datos móviles (saltos de 50–200 ms) el retraso de los botones tiene que crecer. (3) La
// primera visita baja ~100 MB y compila el programa. (4) Un teléfono con 3–4 GB de RAM puede cerrar la pestaña. (5) El
// calor: un teléfono baja su velocidad después de 10–20 minutos. En vez de esconderlo, la página lo dice:
//   - el informe de rendimiento dice en qué ESCALÓN está el aparato y qué esperar (`escalonDe`);
//   - cada página guarda cómo le fue en su última carrera (`anotarCarrera` → localStorage `mkw.capacidad`) y lo cuenta
//     en el latido de la sala; antes de largar, la sala avisa quién no llega a 60 (`lentosDe`, `textoLentos`), en vez de
//     que se note a mitad de carrera.
// Como la placa de un motor: dice la potencia que da; no promete más de lo que el cobre aguanta.
//
// Los escalones (ms de CPU pura del hilo del juego por imagen, lo que mide «Mostrar qué frena»; 16,7 ms = 60 por segundo):
//   sobrado  ≤ 11 ms   60 de verdad, con margen (un PC típico o mejor)
//   justo    ≤ 15,5 ms 60 al borde (un teléfono de gama media): un tirón se nota
//   n8       ≤ 30 ms   no simula y dibuja 60 a la vez: con «Dibujar a 30 y mostrar 60» (N8) la carrera va a 60
//   lento    > 30 ms   ni dibujando la mitad: la carrera va más lenta que el reloj; en la sala no puede ir a la par
// Si se midieron los cuadros de LÓGICA por segundo en la carrera, mandan esos (es lo que de verdad decide la sala).

export const ESCALONES = [
  { id: 'sobrado', hasta: 11, nombre: '60 de verdad, con margen', esperar: 'la carrera y la imagen a 60, como un PC típico o mejor' },
  { id: 'justo', hasta: 15.5, nombre: '60 al borde', esperar: 'la carrera a 60, al borde (como un teléfono de gama media): un tirón del aparato se nota' },
  { id: 'n8', hasta: 30, nombre: 'probar dibujar a 30', esperar: 'prueba en Gráficos → Imagen «Con imagen intermedia» (Dibujar a 30 y mostrar 60) y comprueba que la lógica llegue a 60; la imagen intermedia es inventada y este tiempo por imagen no garantiza el resultado' },
  { id: 'lento', hasta: Infinity, nombre: 'menos de 60', esperar: 'esta medida no llega a 60; prueba dibujar a 30 y vuelve a medir la lógica. En la sala puedes quedar atrás y ver saltos' },
];
export const LOGICA_MIN = 57;          // cuadros de lógica por segundo: menos que esto en la carrera = no va a la par
export const CAP_LENTO_MS = 30;        // CPU pura por imagen: más que esto = ni con N8

const num = x => (Number.isFinite(x) ? x : null);

// El escalón del aparato con lo medido. Devuelve { id, nombre, esperar, por, limites: [texto…] } (por = qué medida decidió)
// §269: esperaSalaMs = lo que el juego esperó por cuadro los botones de la sala (null = no es la sala). Si fue más de
// ESPERA_SALA_AJENA ms, la lógica baja por OTRO (el PC más lento de la sala o la red): no dice nada de este aparato y
// manda la CPU por imagen. Como un amperímetro en serie con la carga de otro: lo que marca no es tu motor.
export const ESPERA_SALA_AJENA = 2;
export function escalonDe({ cpuPuraMs = null, juegoMs = null, logica = null, telefono = false, memoriaGB = null, rttMs = null,
                            n8 = false, enCarrera = true, esperaSalaMs = null } = {}) {
  const ms = num(cpuPuraMs) ?? num(juegoMs);
  let e = null, por = null;
  if (ms !== null) { e = ESCALONES.find(x => ms <= x.hasta); por = `${Math.round(ms * 10) / 10} ms de CPU por imagen`; }
  // los cuadros de lógica en la carrera mandan: si no llega a 57 por segundo, no va a la par (aunque la CPU diga otra cosa:
  // la espera de la tarjeta o del navegador también frena)
  const ajena = num(esperaSalaMs) !== null && esperaSalaMs > ESPERA_SALA_AJENA && ms !== null && ms < TRABAJO_OCUPADO;
  const l = ajena ? null : num(logica);
  if (ajena && e) por += ` (la sala esperó ${Math.round(esperaSalaMs * 10) / 10} ms por cuadro a los demás: su ritmo no es el de este aparato)`;
  if (enCarrera && l !== null && l > 0) {
    if (l < LOGICA_MIN) { e = ESCALONES[3]; por = `${Math.round(l)} cuadros de carrera por segundo`; }
    else if (n8 || !e || e.id === 'lento') {
      e = n8 ? ESCALONES[2] : ESCALONES[1]; por = `${Math.round(l)} cuadros de carrera por segundo`;
    }
  }
  // con N8 prendido y a 60 de lógica, el escalón es «n8» aunque la CPU por imagen salga baja (dibuja la mitad)
  if (e && n8 && e.id !== 'lento' && (l === null || l >= LOGICA_MIN) && e.id !== 'n8' && ms !== null && ms > 8) e = ESCALONES[2];
  const limites = [];
  if (telefono && num(memoriaGB) !== null && memoriaGB <= 4) limites.push(`con ${memoriaGB} GB de memoria el navegador puede cerrar la pestaña si se abren otras apps`);
  if (telefono) limites.push('el calor puede bajar la velocidad del teléfono durante una sesión larga; la simulación en este PC no comprueba ese efecto');
  if (num(rttMs) !== null && rttMs > 80) limites.push(`con la red a ${Math.round(rttMs)} ms (datos móviles o Wi-Fi lejano), el retraso de los botones crece y se siente`);
  if (!e) return { id: 'sin-medir', nombre: 'sin medir', esperar: 'falta una carrera con «Mostrar qué frena» para saberlo', por: null, limites };
  return { id: e.id, nombre: e.nombre, esperar: e.esperar, por, limites };
}

// ---- Lo que esta página aprendió de sí misma en sus carreras (para avisar en la sala antes de largar) ----
const CLAVE = 'mkw.capacidad';
export function leerCapacidad(almacen = globalThis.localStorage) {
  try { const c = JSON.parse(almacen?.getItem(CLAVE) || 'null'); return c && Number.isFinite(c.l) ? c : null; } catch { return null; }
}
// Una carrera terminada: los cuadros de lógica por segundo (mediana de la carrera) y la CPU pura por imagen (si se
// midió). Se promedia con lo de antes (la mitad cada vez: la última carrera pesa, pero un tirón suelto no manda)
export function anotarCarrera({ logica = null, cpuMs = null, gpuMs = null } = {}, almacen = globalThis.localStorage) {
  if (!Number.isFinite(logica) || logica <= 0) return leerCapacidad(almacen);
  const antes = leerCapacidad(almacen);
  const l = antes ? (antes.l + logica) / 2 : logica;
  const ms = Number.isFinite(cpuMs) ? (antes && Number.isFinite(antes.ms) ? (antes.ms + cpuMs) / 2 : cpuMs) : (antes?.ms ?? null);
  const c = { l: Math.round(l * 10) / 10, ms: ms === null ? null : Math.round(ms * 10) / 10, n: (antes?.n | 0) + 1, cuando: Date.now() };
  // Una tarjeta lenta puede frenar aunque el hilo del juego tenga tiempo libre.
  const g = Number.isFinite(gpuMs) ? (Number.isFinite(antes?.g) ? (antes.g + gpuMs) / 2 : gpuMs) : antes?.g;
  if (Number.isFinite(g)) c.g = Math.round(g * 10) / 10;
  try { almacen?.setItem(CLAVE, JSON.stringify(c)); } catch {}
  return c;
}
// Latido pequeño: lógica y CPU; también tarjeta si se midió. null = aún no hay carrera medida.
export const capacidadLatido = c => (c ? { l: c.l, ms: c.ms, ...(Number.isFinite(c.g) ? { g: c.g } : {}) } : null);
// ¿Esta capacidad no llega a 60 en la sala? Pocos cuadros de lógica Y el hilo ocupado (si el hilo trabajó menos de
// TRABAJO_OCUPADO ms por cuadro, lo frenaba otro —la sala esperando a alguien—, no él), o la CPU por imagen sobre el tope
export const TRABAJO_OCUPADO = 14;
export const noLlega = c => !!c && !(Number.isFinite(c.l) && c.l >= LOGICA_MIN) &&
                                   ((Number.isFinite(c.l) && c.l < LOGICA_MIN && !(Number.isFinite(c.ms) && c.ms < TRABAJO_OCUPADO)) ||
                                    (Number.isFinite(c.l) && c.l < LOGICA_MIN && Number.isFinite(c.g) && c.g > 1000 / LOGICA_MIN) ||
                                    (Number.isFinite(c.ms) && c.ms > CAP_LENTO_MS));
// Lo de una carrera: la mediana de los segundos con la carrera andando ({logica, ms} de cada segundo) → {logica, cpuMs}
const mediana = v => { if (!v.length) return null; const o = [...v].sort((a, b) => a - b), k = o.length >> 1; return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2; };
export function resumirCarrera(segundos, minimo = 10) {
  const l = segundos.map(x => x.logica).filter(x => Number.isFinite(x) && x > 0);
  if (l.length < minimo) return null;                  // (una carrera de menos de 10 s andando no dice nada)
  const ms = segundos.map(x => x.ms).filter(x => Number.isFinite(x) && x > 0);
  const g = segundos.map(x => x.gpu).filter(x => Number.isFinite(x) && x > 0);
  return { logica: mediana(l), cpuMs: ms.length ? mediana(ms) : null, ...(g.length ? { gpuMs: mediana(g) } : {}) };
}

// Los que no llegan, de las capacidades de la sala (uid → {l, ms}), entre los que corren
export function lentosDe(capacidades, corren) {
  const r = [];
  for (const u of corren) { const c = capacidades[u]; if (noLlega(c)) r.push({ uid: u, l: c.l, ms: c.ms }); }
  return r;
}
// El aviso antes de largar (nombre: uid → texto). '' si nadie
export function textoLentos(lentos, nombre = u => u, yo = null) {
  if (!lentos.length) return '';
  const yoLento = lentos.some(x => x.uid === yo);
  const otros = lentos.filter(x => x.uid !== yo).map(x => `${nombre(x.uid)} (${Math.round(x.l)} por segundo)`);
  const partes = [];
  if (yoLento) partes.push(`Tu aparato no llegó a 60 en tu última carrera (${Math.round(lentos.find(x => x.uid === yo).l)} por segundo): para no frenar a los demás, la sala te ayuda (relevo) y vas a ver saltos. Cierra otras pestañas o apps, o prueba en Gráficos → Imagen «Con imagen intermedia» (Dibujar a 30 y mostrar 60)`);
  if (otros.length) partes.push(`${otros.join(', ')} no ${otros.length > 1 ? 'llegan' : 'llega'} a 60: la sala intenta sostener el ritmo mediante el relevo (sus botones pueden llegar tarde y puede haber saltos)`);
  return '⚠ ' + partes.join(' · ');
}

// §269: la envoltura de pad() de la sala (lockstep.mjs) que cuenta cuánto esperó el juego los botones de los demás.
// Lo de antes de la primera espera de pad() es trabajo de esta PC (armar y mandar mis botones); lo que va desde ahí hasta
// que vuelve, espera (el hilo del juego quedó parado). cuenta = { ms, veces } (se suma en el momento)
export function envolverPadSala(pad, cuenta, ahora = () => performance.now()) {
  return async cuadro => {
    const p = pad(cuadro), t1 = ahora();
    try { return await p; } finally { const d = ahora() - t1; if (d > 0.05) { cuenta.ms += d; cuenta.veces++; } }
  };
}
