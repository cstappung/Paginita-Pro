// Leer en qué pantalla está el juego y llevarlo solo a una pista o a una copa — bitácora §55 ("elegir carrera").
//
// Resumen: la página no puede "llamar" al juego para decirle "empezá la Copa Champiñón"; lo que sí puede es lo mismo que
// una persona: apretar botones del mando. Para no apretar a ciegas (con esperas fijas que fallan si una pantalla tarda),
// este módulo MIRA la memoria de la Wii (que el wasm tiene adentro, ver puente.cpp: mkw_web_mem) y lee:
//   - la sección (el "modo de pantalla": menú principal, Gran Premio, VS…) y la página de arriba (título, elegir
//     personaje, elegir copa…), del administrador de pantallas del juego (SectionMgr);
//   - lo elegido en los menús (pista, modo, cilindrada, copa, número de carrera), de la configuración de carrera
//     (Racedata).
// Así cada paso del recorrido es "apretar A hasta que la página sea la de elegir copa", no "apretar A y esperar 2 s".
//
// Las direcciones son las de la versión europea (RMCP01) y vienen del código abierto de Pulsar (el motor de Retro
// Rewind): github.com/MelgMKW/Pulsar, GameSource/symbols.txt y los .hpp de Racedata y SectionMgr. Se verifican en el
// banco con el juego andando (guion.mjs --menus anota el estado después de cada paso).

export const DIR = {
  racedata: 0x809BD728,        // puntero a Racedata (la configuración de la carrera)
  seccionMgr: 0x809C1E38,      // puntero a SectionMgr (las pantallas)
};
// dentro de Racedata: lo elegido en los menús ("menusScenario", ajustes desde +0x1758)
const RD = { curso: 0x1758, cc: 0x175C, modo: 0x1760, tipo: 0x1764, cpu: 0x176C, objetos: 0x1770, copa: 0x1778, carrera: 0x177C, vueltas: 0x177D,
             jugadores: 0xC14 };
// dentro de SectionMgr y de Section
const SM = { seccion: 0x0, siguiente: 0xC, anterior: 0x10 };
const SEC = { id: 0x0, paginas: 0x354, capas: 0x37C };
export const MODO = ['Gran Premio', 'VS', 'Contrarreloj', 'Batalla'];
export const CC = ['50cc', '100cc', '150cc', 'batalla'];
// Algunas páginas del menú (Identifiers.hpp de Pulsar)
export const PAGINA = { titulo: 0x57, menuPrincipal: 0x5A, unJugador: 0x69, personaje: 0x6B, kart: 0x6C, derrape: 0x6D, copa: 0x6E, pista: 0x6F, ajustesVs: 0x73 };
export const SECCION = { gp: 0x1E, tt: 0x1F, vs: 0x20, batalla: 0x28, unJugador: 0x48 };

// Las 32 pistas de Nintendo, en el orden de sus copas, con su número de pista (CourseId) — tockdom, List of Identifiers
export const COPAS = [
  ['Copa Champiñón', [['Circuito Luigi', 0x08], ['Prado Mu-Mu', 0x01], ['Garganta Champiñón', 0x02], ['Fábrica de Toad', 0x04]]],
  ['Copa Flor', [['Circuito de Mario', 0x00], ['Centro Comercial Coco', 0x05], ['Cumbre DK', 0x06], ['Mina de Wario', 0x07]]],
  ['Copa Estrella', [['Circuito de Daisy', 0x09], ['Cabo Koopa', 0x0F], ['Bosque Arce', 0x0B], ['Volcán Rugiente', 0x03]]],
  ['Copa Especial', [['Ruinas Desierto Seco', 0x0E], ['Avenida Lunar', 0x0A], ['Castillo de Bowser', 0x0C], ['Senda Arco Iris', 0x0D]]],
  ['Copa Caparazón', [['Playa Peach (GCN)', 0x10], ['Cascadas Yoshi (DS)', 0x14], ['Valle Fantasmal 2 (SNES)', 0x19], ['Autopista de Mario (N64)', 0x1A]]],
  ['Copa Plátano', [['Autopista Sherbet (N64)', 0x1B], ['Mina Shy Guy (GBA)', 0x1F], ['Pueblo Delfino (DS)', 0x17], ['Estadio Waluigi (GCN)', 0x12]]],
  ['Copa Hoja', [['Desierto Dano Dano (DS)', 0x15], ['Castillo de Bowser 3 (GBA)', 0x1E], ['Jungla DK (N64)', 0x1D], ['Circuito de Mario (GCN)', 0x11]]],
  ['Copa Rayo', [['Circuito Mario 3 (SNES)', 0x18], ['Jardín Peach (DS)', 0x16], ['Montaña DK (GCN)', 0x13], ['Castillo de Bowser (N64)', 0x1C]]],
];

// El lector: pide a la página del wasm dónde quedó cada bloque de memoria de la Wii y lee de ahí, en big-endian.
export function crearLector(M) {
  // (se piden recién al usarlas: la memoria de la Wii se arma cuando arranca el main del juego, no al cargar el wasm)
  let base1 = 0, base2 = 0, vista = null;
  const bases = () => { if (!base1 && M._mkw_web_mem) { base1 = M._mkw_web_mem(0x80000000); base2 = M._mkw_web_mem(0x90000000); } return base1; };
  const dv = () => { if (!vista || vista.buffer !== M.HEAPU8.buffer) vista = new DataView(M.HEAPU8.buffer); return vista; };   // el wasm puede crecer: rehacer la vista
  const lugar = a => {
    a >>>= 0;
    if (!bases()) return -1;
    if (a >= 0x80000000 && a < 0x81800000) return base1 + (a - 0x80000000);
    if (a >= 0x90000000 && a < 0x94000000) return base2 + (a - 0x90000000);
    return -1;
  };
  const u32 = a => { const p = lugar(a); return p < 0 || !base1 ? 0 : dv().getUint32(p, false); };
  const u16 = a => { const p = lugar(a); return p < 0 || !base1 ? 0 : dv().getUint16(p, false); };
  const u8 = a => { const p = lugar(a); return p < 0 || !base1 ? 0 : dv().getUint8(p); };
  const s32 = a => u32(a) | 0;
  // escribir (big-endian, como la Wii): solo para dejar elegida la copa/pista antes de abrir su pantalla
  const w32 = (a, v) => { const p = lugar(a); if (p >= 0) dv().setUint32(p, v >>> 0, false); };
  const w8 = (a, v) => { const p = lugar(a); if (p >= 0) dv().setUint8(p, v & 0xFF); };

  function estado() {
    const r = { listo: !!bases(), seccion: -1, pagina: -1, paginas: [] };
    const sm = u32(DIR.seccionMgr);
    if (sm) {
      const sec = u32(sm + SM.seccion);
      r.siguiente = s32(sm + SM.siguiente);
      if (sec) {
        r.seccion = s32(sec + SEC.id);
        const capas = Math.min(11, u32(sec + SEC.capas));
        for (let i = 0; i < capas; i++) { const p = u32(sec + SEC.paginas + 4 * i); if (p) r.paginas.push(s32(p + 4)); }
        r.pagina = r.paginas.length ? r.paginas[r.paginas.length - 1] : -1;
      }
    }
    const rd = u32(DIR.racedata);
    if (rd) {
      r.curso = s32(rd + RD.curso); r.cc = s32(rd + RD.cc); r.modo = s32(rd + RD.modo); r.copa = s32(rd + RD.copa);
      r.carrera = u8(rd + RD.carrera); r.vueltas = u8(rd + RD.vueltas); r.jugadores = u8(rd + RD.jugadores);
    }
    return r;
  }
  const texto = e => `sección 0x${e.seccion.toString(16)} página 0x${e.pagina.toString(16)} [${e.paginas.map(p => p.toString(16)).join(',')}]` +
    (e.curso !== undefined ? ` · pista 0x${e.curso.toString(16)} modo ${e.modo} cc ${e.cc} copa ${e.copa} carrera ${e.carrera}` : '');
  return { estado, texto, u32, u16, u8, w32, w8, RD };
}

// ---- Retro Rewind: sus copas y los nombres de sus pistas ----
// Pulsar (el motor de RR) guarda lo elegido en su propio objeto, CupsConfig (no en Racedata). Lo encontramos buscando
// en la memoria, con el juego andando, la estructura que cambia al elegir copas (banco, bitácora §55):
//   +0x00 copa elegida (0x40 + n para la copa n de RR)   +0x10 pista ganadora   +0x14 pista elegida   +0x24 cuántas copas
// Las pistas de RR se numeran 0x100 + 4·copa + fila. El objeto está dentro del código de RR (no hay puntero que lleve a
// él): su dirección es fija para esta versión de RR, y antes de escribir se revisa que lo que hay tenga esa forma.
export const CUPS = 0x8043319C;
export function cupsValido(L) {
  const c = L.u32(CUPS), sel = L.u32(CUPS + 0x14), n = L.u32(CUPS + 0x24);
  return n > 0 && n < 400 && (c < 8 || (c >= 0x40 && c < 0x40 + n)) && sel < 0x100 + 4 * n;
}
export const copasRR = L => cupsValido(L) ? L.u32(CUPS + 0x24) : 0;

// Los nombres: el juego carga sus textos en tablas "BMG" (MESGbmg1). En la de Pulsar, el mensaje 0x20000 + n es el
// nombre de la pista n de RR (0x20000 = la primera). Se leen de la memoria del juego en esta PC y no se guardan en
// ningún servidor (son del juego: solo se muestran). Devuelve [[nombre pista 0..3] por copa] o null si no están.
export function leerNombres(L, M) {
  const n = copasRR(L);
  if (!n) return null;
  const U = M.HEAPU8, H = new DataView(U.buffer);
  const base2 = M._mkw_web_mem(0x90000000);
  if (!base2) return null;
  for (let o = 0; o + 32 < 0x4000000; o += 4) {
    const p = base2 + o;
    if (U[p] !== 0x4D || U[p + 1] !== 0x45 || U[p + 2] !== 0x53 || U[p + 3] !== 0x47 || U[p + 4] !== 0x62 || U[p + 7] !== 0x31) continue;   // "MESGbmg1"
    const secciones = H.getUint32(p + 12);
    let q = p + 32, inf = 0, dat = 0, mid = 0;
    for (let s = 0; s < secciones && s < 8; s++) {
      const tag = String.fromCharCode(U[q], U[q + 1], U[q + 2], U[q + 3]);
      if (tag === 'INF1') inf = q; else if (tag === 'DAT1') dat = q; else if (tag === 'MID1') mid = q;
      q += H.getUint32(q + 4);
    }
    if (!inf || !dat || !mid) continue;
    const cuantos = H.getUint16(inf + 8), tamEntrada = H.getUint16(inf + 10);
    const indice = new Map();
    for (let i = 0; i < cuantos; i++) indice.set(H.getUint32(mid + 16 + 4 * i), i);
    if (!indice.has(0x20000)) continue;
    const texto = i => {
      const a = dat + 8 + H.getUint32(inf + 16 + i * tamEntrada);
      let s = '';
      for (let k = 0; k < 80; k++) {
        const c = H.getUint16(a + 2 * k);
        if (!c) break;
        if (c === 0x1A) { k += (U[a + 2 * k + 2] >> 1) - 1; continue; }   // código de formato (color…): se salta
        s += String.fromCharCode(c);
      }
      return s.trim();
    };
    const copas = [];
    for (let c = 0; c < n; c++) copas.push([0, 1, 2, 3].map(f => { const i = indice.get(0x20000 + 4 * c + f); return i === undefined ? '' : texto(i); }));
    return copas;
  }
  return null;
}

// ---- El piloto: lleva el juego solo hasta la carrera pedida ----
// Mira la página del menú cada 60 ms y aprieta lo que corresponde (A casi siempre; abajo para elegir el modo). Antes
// de la pantalla de copas deja escrita en CupsConfig la copa y la fila pedidas: el cursor del juego aparece ahí.
// Y comprueba (lazo cerrado, como un regulador): el modo en la pantalla de cilindrada y la pista en la confirmación;
// si no es la pedida, vuelve atrás (B) y corrige. Se detiene al empezar la carrera, si la persona toca una tecla o un
// botón del mando, o a los 90 s. objetivo = { modo: 'gp' | 'vs', copa, fila }
const INDICE_MODO = { gp: 0, tt: 1, vs: 2, bat: 3 };
const BOT = { A: 0x0100, B: 0x0200, abajo: 0x0004, arriba: 0x0008 };   // bits del mando de GameCube (BOTON en controles.mjs)
// páginas donde solo hay que aceptar: título, licencias, menú principal, personaje, kart, la de RR antes del derrape,
// copas, variante de la pista, y las de crear licencia (elegir Mii, confirmar…)
const PAGINAS_A = new Set([0x57, 0x65, 0x52, 0x5a, 0x6b, 0x6c, 0x10e, 0x6e, 0x6f, 0x101, 0x60, 0x66, 0x51]);
export function crearPiloto({ lector: L, controles, alAviso = () => {}, esperarEleccion = async () => null }) {
  let activo = false, cancelado = false;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function toque(bit, ms = 110) { controles.pilotar(bit); await espera(ms); controles.pilotar(0); await espera(90); }

  // Antes del «OK»: la CPU. En Racedata, lo elegido en los menús (menusScenario) se copia a la carrera al empezar:
  // dificultad de la CPU en +0x176C (0 fácil, 1 normal, 2 difícil); los jugadores en +0xC18 + i·0xF0, con su tipo en
  // +0x10 (0 persona, 1 CPU, 5 ninguno) y cuántos hay en +0xC14. «Sin CPU» = solo el jugador 1.
  // autoconducir (solo para el banco): el jugador 1 también lo maneja la CPU, así la carrera termina sola.
  function ajustarJugadores(objetivo) {
    const rd = L.u32(DIR.racedata);
    if (!rd) return;
    const dificultad = { facil: 0, normal: 1, dificil: 2 }[objetivo.cpu];
    if (dificultad !== undefined) L.w32(rd + RD.cpu, dificultad);
    if (objetivo.cpu === 'ninguna') {
      for (let i = 1; i < 12; i++) L.w32(rd + 0xC18 + i * 0xF0 + 0x10, 5);
      L.w8(rd + RD.jugadores, 1);
    }
    if (objetivo.autoconducir) L.w32(rd + 0xC18 + 0x10, 1);
  }

  async function ir(objetivo) {
    activo = true; cancelado = false;
    const tocaPersona = e => { if (e.isTrusted) cancelado = true; };
    addEventListener('keydown', tocaPersona, true);
    const inicio = performance.now();
    let paginaAntes = -1, listoDesde = 0, cursorModo = 0, reintentos = 0;
    let elegido = objetivo.copa !== undefined;
    try {
      while (!cancelado) {
        if (performance.now() - inicio > 90000) { alAviso('No pude llegar solo: sigue tú desde el menú.', true); return false; }
        if ((controles.estado.mandos || []).some(m => m.botones)) { cancelado = true; break; }   // la persona agarró el mando
        const e = L.estado();
        if (e.seccion > 0 && e.seccion < 0x30) { alAviso(''); return true; }    // una sección de carrera: llegamos
        const p = e.pagina;
        // cada página nueva: esperar a que termine de entrar (las páginas no hacen caso mientras aparecen)
        if (p !== paginaAntes) { paginaAntes = p; listoDesde = performance.now() + 300; }
        if (performance.now() < listoDesde) { await espera(60); continue; }
        const despues = ms => { listoDesde = performance.now() + ms; };   // si sigue en la misma página después de ms, reintentar
        if (p === 0x5a && !elegido) {
          // menú principal: si todavía no se eligió copa/pista, la página la pide (con los nombres que trae el juego)
          alAviso('Elige la copa o la pista…');
          const r = await esperarEleccion();
          if (!r) { alAviso('Listo: sigue tú desde el menú.'); return false; }
          Object.assign(objetivo, r); elegido = true; alAviso('Yendo a la carrera… (toca una tecla para manejar tú)');
          continue;
        }
        if (p === 0x69) {
          // Un jugador: Gran Premio, Contrarreloj, VS, Batalla (lista vertical)
          const quiero = INDICE_MODO[objetivo.modo], d = quiero - cursorModo;
          for (let i = 0; i < Math.abs(d); i++) await toque(d > 0 ? BOT.abajo : BOT.arriba);
          cursorModo = quiero;
          await toque(BOT.A); despues(1500); continue;
        }
        if (p === 0x6a || p === 0x72) {
          // cilindrada: aquí ya se ve qué modo quedó (Racedata: 0 GP, 1 VS, 2 contrarreloj, 3 batalla)
          const modoQuiero = { gp: 0, vs: 1 }[objetivo.modo];
          if (e.modo !== modoQuiero) { cursorModo = [0, 2, 1, 3][e.modo] ?? 0; await toque(BOT.B); despues(1000); continue; }
          await toque(BOT.A); despues(1500); continue;
        }
        if (p === 0x6d) {
          // derrape: lo último antes de las copas. Dejar elegidas copa y fila (si CupsConfig tiene la forma esperada)
          if (cupsValido(L)) {
            const pista = 0x100 + 4 * objetivo.copa + (objetivo.fila || 0);
            L.w32(CUPS, 0x40 + objetivo.copa); L.w32(CUPS + 0x10, pista); L.w32(CUPS + 0x14, pista);
          }
          await toque(BOT.A); despues(1500); continue;
        }
        if (p === 0x4b) {
          // confirmación «OK»: ¿quedó lo pedido? Si no, atrás y de nuevo (hasta 2 veces)
          const pedida = 0x100 + 4 * objetivo.copa + (objetivo.modo === 'vs' ? (objetivo.fila || 0) : 0);
          const quedo = objetivo.modo === 'vs' ? L.u32(CUPS + 0x10) : 0x100 + 4 * (L.u32(CUPS) - 0x40);
          if (cupsValido(L) && quedo !== pedida && reintentos < 2) {
            reintentos++;
            alAviso(`Corrigiendo la pista (quedó 0x${quedo.toString(16)}, pedí 0x${pedida.toString(16)})…`);
            await toque(BOT.B); await espera(700); await toque(BOT.B); despues(1000); continue;
          }
          ajustarJugadores(objetivo);
          await toque(BOT.A); despues(2000); continue;
        }
        if (PAGINAS_A.has(p) || e.seccion === 0x45) { await toque(BOT.A); despues(1300); continue; }
        await espera(60);                       // otra pantalla (cargando, una animación): esperar
      }
      alAviso(cancelado ? 'Tomaste el control: sigue tú.' : '');
      return false;
    } finally {
      controles.pilotar(0);
      removeEventListener('keydown', tocaPersona, true);
      activo = false;
    }
  }
  return { ir, get activo() { return activo; }, cancelar() { cancelado = true; } };
}
