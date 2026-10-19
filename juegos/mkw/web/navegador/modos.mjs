// Los tres modos de la sala sobre el Retro WFC del juego: el original, la copa y la playlist — bitácora §72.
//
// Resumen: la sala del sitio manda al marco del juego `?modo=enlinea&estilo=wfc|copa|playlist` (+ `carreras`, `pistas`
// y `cc`). Las tres entran al modo en línea del juego (Retro WFC por nuestro WFC virtual, §71); lo que cambia:
//   - wfc (el original): nada; el bucle del juego sin fin (votar, ruleta, carrera, VR).
//   - copa: N carreras con puntos; la página cuenta las carreras, suma los puntos que da el juego en cada una y, al
//     terminar la última, muestra la tabla final y le avisa a la sala (`alTerminar(tabla)`: el anfitrión vuelve al
//     vestíbulo con la tabla).
//   - playlist: una cola de pistas (la sortea la sala); antes de cada carrera la página le dice al juego la pista que
//     toca (Module._mkw_modos_pista, modos_nativo.cpp: el voto de cada uno y la decisión del anfitrión pasan a ser esa)
//     y, al vaciarse la cola, lo mismo que la copa.
//   - copa y playlist: la cilindrada que eligió el anfitrión (Module._mkw_modos_cc) en vez de la de Retro Rewind.
// Además, en los tres: 45 s para elegir personaje, kart y pista (pedido del dueño) en vez de 30. El reloj del juego
// arranca con un número guardado en la memoria (0x80899EF4 = 30.0, en StaticR.rel: SELECTStageMgr::OnResume lo pasa a
// CountDown::SetInitial; nadie más lo lee, se vio en el C++ traducido): se cambia ese número.
// Como un contador de vueltas al lado de la pista: el juego corre igual; nosotros contamos, anotamos y bajamos la bandera.
//
// Lo que se lee de la memoria (Pulsar, GameSource: RaceData.hpp, RaceInfo.hpp, Mii.hpp):
//   Raceinfo (0x809BD730): +0x28 la etapa de la carrera (4 = terminada para todos), +0xC la lista de jugadores
//     (cada uno: +0x20 su puesto).
//   Racedata (0x809BD728): +0x20 la carrera (RacedataScenario): +0x4 cuántos jugadores, +0x8 los jugadores (0xF0 cada
//     uno): +0x14 su Mii (el nombre, 10 letras UTF-16, en Mii +0x68), +0xD8 los puntos de antes, +0xDA los de ahora.
//
// Uso:  const modo = crearModo({ estilo, carreras, pistas: pistasDe('50.2,3.1'), cc: 'c150', M, lector, alTerminar });
//       modo.estado() → { estilo, total, terminadas, tabla, final }

export const RELOJ_ELEGIR = 0x80899EF4;     // el 30.0 con que arranca el reloj de elegir y votar
export const SEGUNDOS_ELEGIR = 45;
export const PUNTOS = [15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0];   // por puesto, 12 jugadores (si el juego no los dio)
export const CC_MODOS = { azar: 0, c100: 1, c150: 2, espejo: 3 };
export const MAX_COPAS = 79;                // copas de carrera de Retro Rewind
const RACEINFO = 0x809BD730, RACEDATA = 0x809BD728;
const ETAPA_TERMINADA = 4;
const SECCION_CARRERA = [0x68, 0x77];       // las carreras en línea (VS, mirando, batalla, de amigos; Identifiers.hpp)

export const bitsDe = f => { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, f); return d.getUint32(0); };
export const floatDe = b => { const d = new DataView(new ArrayBuffer(4)); d.setUint32(0, b >>> 0); return d.getFloat32(0); };

// El reloj de elegir: solo si en esa dirección está el 30.0 del juego (o un valor que ya pusimos nosotros), para no
// pisar otra cosa si el programa cambiara. Devuelve true si quedó con `segundos`.
export function ponerReloj(L, segundos = SEGUNDOS_ELEGIR) {
  const ahora = L.u32(RELOJ_ELEGIR) >>> 0, quiero = bitsDe(segundos);
  if (ahora === quiero) return true;
  const v = floatDe(ahora);
  if (!(v === 30 || (v >= 10 && v <= 120 && Number.isInteger(v)))) return false;
  L.w32(RELOJ_ELEGIR, quiero);
  return (L.u32(RELOJ_ELEGIR) >>> 0) === quiero;
}

// "50.2,3.1" → [{ copa: 50, fila: 2, id: 0x1CA }, …] (id de Pulsar: 0x100 + 4·copa + fila). Lo inválido se descarta.
export function pistasDe(texto, max = 32) {
  const r = [];
  for (const parte of String(texto || '').split(',')) {
    const m = /^\s*(\d{1,2})\.([0-3])\s*$/.exec(parte);
    if (!m) continue;
    const copa = Number(m[1]), fila = Number(m[2]);
    if (copa >= MAX_COPAS) continue;
    r.push({ copa, fila, id: 0x100 + 4 * copa + fila });
    if (r.length >= max) break;
  }
  return r;
}

const nombreMii = (L, dir) => {
  let s = '';
  for (let k = 0; k < 10; k++) { const c = L.u16(dir + 2 * k); if (!c) break; s += String.fromCharCode(c); }
  return s.trim();
};

// La carrera que terminó: [{ i, nombre, puesto, puntos (los que dio esta carrera), total (los del juego) }]
export function leerCarreraOnline(L) {
  const rd = L.u32(RACEDATA), ri = L.u32(RACEINFO);
  if (!rd || !ri) return null;
  const esc = rd + 0x20, n = Math.min(12, L.u8(esc + 4));
  const lista = L.u32(ri + 0xC);
  if (!n || !lista) return null;
  const r = [];
  for (let i = 0; i < n; i++) {
    const j = esc + 8 + 0xF0 * i, rij = L.u32(lista + 4 * i);
    const puesto = rij ? L.u8(rij + 0x20) : 0;
    const antes = L.u16(j + 0xD8), ahora = L.u16(j + 0xDA);
    const delta = ahora - antes;
    r.push({ i, nombre: nombreMii(L, j + 0x14 + 0x68) || `Piloto ${i + 1}`, puesto, total: ahora,
             puntos: delta > 0 && delta <= 15 ? delta : -1 });
  }
  // si el juego no anotó los puntos de esta carrera (todos -1 o 0), por puesto con la tabla de 12
  const dio = r.some(x => x.puntos > 0);
  for (const x of r) if (!dio || x.puntos < 0) x.puntos = x.puesto >= 1 && x.puesto <= 12 ? PUNTOS[x.puesto - 1] : 0;
  return r;
}

// Suma una carrera a la tabla (por nombre; dos con el mismo nombre se separan con su número de jugador)
export function sumar(tabla, carrera) {
  const t = new Map(tabla.map(x => [x.clave, { ...x }]));
  const vistos = new Map();
  for (const x of carrera) {
    const k = vistos.has(x.nombre) ? `${x.nombre}#${x.i}` : x.nombre;
    vistos.set(x.nombre, true);
    const fila = t.get(k) || { clave: k, nombre: x.nombre, puntos: 0, carreras: 0 };
    fila.puntos += x.puntos; fila.carreras++; fila.ultimo = x.puesto;
    t.set(k, fila);
  }
  return [...t.values()].sort((a, b) => b.puntos - a.puntos || (a.ultimo || 99) - (b.ultimo || 99));
}

const ESTILO_CSS = `
#mkw-modo { position: fixed; z-index: 4; top: calc(10px + var(--st, 0px)); left: 50%; transform: translateX(-50%);
  padding: 5px 12px; border-radius: 999px; background: #17142acc; border: 1px solid #3a3361; color: #f1effa;
  font: 600 13px 'IBM Plex Sans', system-ui, sans-serif; pointer-events: none; white-space: nowrap; max-width: calc(100vw - 32px);
  overflow: hidden; text-overflow: ellipsis; }
#mkw-modo[hidden], #mkw-tabla[hidden] { display: none; }
#mkw-tabla { position: fixed; z-index: 6; inset: 0; display: grid; place-items: center; background: #0d0b1acc; padding: 16px; }
#mkw-tabla > div { width: min(440px, 100%); max-height: 100%; overflow: auto; background: #17142a; border: 1px solid #3a3361;
  border-radius: 16px; padding: 16px 18px; color: #f1effa; font: 15px 'IBM Plex Sans', system-ui, sans-serif; }
#mkw-tabla h2 { margin: 0 0 4px; font-size: 22px; }
#mkw-tabla p { margin: 0 0 12px; color: #a7a3bd; font-size: 13px; }
#mkw-tabla ol { margin: 0; padding: 0; list-style: none; }
#mkw-tabla li { display: grid; grid-template-columns: 2em 1fr auto; gap: 8px; padding: 6px 4px; border-top: 1px solid #3a336188; }
#mkw-tabla li:first-child { color: #ffd21f; font-weight: 700; }
#mkw-tabla li b { text-align: right; font-variant-numeric: tabular-nums; }`;

// El modo de la sala. reloj: para el banco (cada/parar/ahora); nombrePista(copa, fila) → texto o ''.
export function crearModo({ estilo = 'wfc', carreras = 4, pistas = [], cc = 'azar', segundos = SEGUNDOS_ELEGIR, M, lector: L,
                             alTerminar = () => {}, nota = () => {}, nombrePista = () => '', doc = globalThis.document,
                             reloj = { cada: (f, ms) => setInterval(f, ms), parar: id => clearInterval(id), despues: (f, ms) => setTimeout(f, ms) },
                             esperaResultados = 9000, esperaTabla = 14000 } = {}) {
  const conTabla = estilo === 'copa' || (estilo === 'playlist' && pistas.length > 0);
  const total = estilo === 'copa' ? carreras : estilo === 'playlist' ? pistas.length : 0;
  let terminadas = 0, tabla = [], final = false, contada = false, relojPuesto = false, ultima = null, avisado = false, cortado = false;

  // la cilindrada y la primera pista de la cola (se ponen ya: el juego las usa recién al decidir)
  if (conTabla && M?._mkw_modos_cc) M._mkw_modos_cc(CC_MODOS[cc] ?? 0);
  const ponerPista = k => { if (estilo === 'playlist' && M?._mkw_modos_pista) M._mkw_modos_pista(k < pistas.length ? pistas[k].id : -1); };
  ponerPista(0);

  // el cartel de arriba y la tabla final (nuestros: nada del juego)
  let cartel = null, cuadro = null;
  if (conTabla && doc?.body) {
    if (!doc.getElementById('mkw-modo-css')) {
      const st = doc.createElement('style'); st.id = 'mkw-modo-css'; st.textContent = ESTILO_CSS; doc.head.append(st);
    }
    cartel = doc.createElement('div'); cartel.id = 'mkw-modo'; cartel.setAttribute('role', 'status');
    cuadro = doc.createElement('div'); cuadro.id = 'mkw-tabla'; cuadro.hidden = true;
    doc.body.append(cartel, cuadro);
  }
  const textoCartel = () => {
    if (estilo === 'copa') return terminadas >= total ? `Modo copa · terminada` : `Modo copa · carrera ${terminadas + 1} de ${total}`;
    const p = pistas[terminadas];
    if (!p) return 'Modo playlist · terminada';
    const nom = nombrePista(p.copa, p.fila);
    return `Playlist · ${terminadas + 1} de ${total}${nom ? ' · ' + nom : ''}`;
  };
  const pintar = () => {
    if (cartel) { cartel.textContent = textoCartel(); cartel.hidden = final; }
    if (cuadro && final) {
      const filas = tabla.map((x, k) => `<li><span>${k + 1}.</span><span>${escapar(x.nombre)}</span><b>${x.puntos}</b></li>`).join('');
      cuadro.innerHTML = `<div><h2>${estilo === 'copa' ? '🏆 Fin de la copa' : '🏁 Fin de la playlist'}</h2>
        <p>${total} carrera${total === 1 ? '' : 's'} · en unos segundos vuelven a la sala</p><ol>${filas}</ol></div>`;
      cuadro.hidden = false;
    }
  };

  function paso() {
    if (!relojPuesto && segundos > 0) {
      try { relojPuesto = ponerReloj(L, segundos); } catch {}     // (hasta que cargue StaticR.rel ahí hay 0: no se toca)
      if (relojPuesto) nota(`modos: reloj de elegir en ${segundos} s`);
    }
    if (!conTabla || final) return;
    // (solo dentro de una carrera en línea, secciones 0x68-0x77: tras un corte, el juego sale a 0x78/0x79 y el Raceinfo
    // viejo puede seguir diciendo "terminada")
    let etapa = -1, seccion = -1;
    try { seccion = L.estado().seccion; const ri = L.u32(RACEINFO); etapa = ri ? L.u32(ri + 0x28) : -1; } catch { return; }
    if (seccion === 0x78 || seccion === 0x79) { if (!cortado) { cortado = true; nota(`modos: el juego se desconectó (sección 0x${seccion.toString(16)})`); } }
    else cortado = false;
    if (etapa !== ETAPA_TERMINADA || seccion < SECCION_CARRERA[0] || seccion > SECCION_CARRERA[1]) { contada = false; return; }
    if (contada) return;
    contada = true;
    // terminó una carrera: sus puntos un poco después (el juego los anota al mostrar los resultados)
    reloj.despues(() => {
      // un corte también deja la carrera "terminada" un instante antes de saltar a 0x78/0x79: eso no cuenta
      let ahora = -1;
      try { ahora = L.estado().seccion; } catch {}
      if (cortado || ahora === 0x78 || ahora === 0x79) { nota('modos: la carrera terminó por un corte: no cuenta'); return; }
      let c = null;
      try { c = leerCarreraOnline(L); } catch {}
      if (c) { tabla = sumar(tabla, c); ultima = c; }
      terminadas++;
      nota(`modos: carrera ${terminadas}/${total} terminada${c ? ' — ' + c.map(x => `${x.nombre} ${x.puesto}.º +${x.puntos}`).join(', ') : ''}`);
      ponerPista(terminadas);
      if (terminadas >= total) {
        reloj.despues(() => {
          final = true; pintar();
          nota(`modos: fin — ${tabla.map(x => `${x.nombre} ${x.puntos}`).join(', ')}`);
          reloj.despues(() => { if (!avisado) { avisado = true; alTerminar(tabla.map(x => ({ nombre: x.nombre, puntos: x.puntos }))); } }, esperaTabla);
        }, esperaResultados);
      }
      pintar();
    }, 2500);
  }
  pintar();
  const id = reloj.cada(paso, 300);
  return {
    estado: () => ({ estilo, total, terminadas, tabla, final, relojPuesto, ultima, cortado, pista: estilo === 'playlist' ? (pistas[terminadas] || null) : null }),
    parar: () => { reloj.parar(id); cartel?.remove(); cuadro?.remove(); },
  };
}

const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
