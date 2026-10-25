// La playlist de la sala con sugerencias — bitácora §74.
//
// Resumen: en el modo playlist de la sala, el anfitrión arma la lista de pistas y los demás le SUGIEREN pistas; él
// acepta (la pista entra al final de la lista) o rechaza. Recién cuando el anfitrión confirma la lista, todos eligen
// personaje y vehículo. Entre carrera y carrera la lista aparece un rato y se pueden agregar o sugerir más. Este módulo
// es solo la lógica (sin dibujar ni mandar mensajes): el estado entero viaja dentro del estado de la sala
// (sala-carrera.mjs), así que si el anfitrión se va, el nuevo anfitrión ya tiene la lista y las sugerencias.
//   - pistas: la lista ({copa, fila}, en orden, sin repetir, hasta 32).
//   - sugerencias: { id, de (uid), copa, fila, estado: 'pendiente' | 'aceptada' | 'rechazada' }. Las respondidas se
//     guardan un rato (las últimas 40) para que quien sugirió vea ✓ o ✕.
//   - Reglas: no se sugiere una pista que ya está en la lista ni una que ya espera respuesta; cada persona tiene hasta 8
//     pendientes a la vez; con la lista llena (32) no se sugiere más.
// Como un buzón de sugerencias con un encargado: cualquiera echa una tarjeta, el encargado la pega en el tablero o la
// tira, y el tablero tiene 32 lugares.
//
// Uso:  const pl = crearPlaylistSala();  pl.sugerir('uidB', {copa: 3, fila: 1}) → 'sugerida' | 'ya-esta' | …
//       pl.aceptar(id) → 'agregada' | 'llena' | 'ya-esta' | 'nada';  pl.rechazar(id);  pl.ponerPistas(lista)
//       pl.exportar() → { pistas, sugerencias, sig } (va en el estado de la sala);  crearPlaylistSala({ estado })

import { MAX_PISTAS, misma } from './lista-pistas.mjs';

export const PENDIENTES_POR_PERSONA = 8;
const RESPONDIDAS = 40;
const pistaValida = p => p && Number.isInteger(p.copa) && Number.isInteger(p.fila) && p.copa >= 0 && p.copa < 100 && p.fila >= 0 && p.fila < 4;
const ESTADOS = ['pendiente', 'aceptada', 'rechazada'];

export function crearPlaylistSala({ max = MAX_PISTAS, porPersona = PENDIENTES_POR_PERSONA, estado = null } = {}) {
  max = Math.max(1, Math.min(MAX_PISTAS, max | 0 || MAX_PISTAS));
  let pistas = [], sugerencias = [], sig = 1;

  const enLista = p => pistas.some(q => misma(p, q));
  const pendientes = () => sugerencias.filter(s => s.estado === 'pendiente');
  // las respondidas más viejas se van (quedan las últimas 40); las pendientes nunca se borran solas
  const recortar = () => {
    const resp = sugerencias.filter(s => s.estado !== 'pendiente');
    if (resp.length <= RESPONDIDAS) return;
    const fuera = new Set(resp.slice(0, resp.length - RESPONDIDAS).map(s => s.id));
    sugerencias = sugerencias.filter(s => !fuera.has(s.id));
  };
  // una pendiente cuya pista ya entró a la lista (el anfitrión la agregó por su cuenta) cuenta como aceptada
  const marcarLasQueEntraron = () => { for (const s of sugerencias) if (s.estado === 'pendiente' && enLista(s)) s.estado = 'aceptada'; };

  function importar(e) {
    if (!e || typeof e !== 'object') return;
    pistas = [];
    for (const p of Array.isArray(e.pistas) ? e.pistas : []) if (pistaValida(p) && !enLista(p) && pistas.length < max) pistas.push({ copa: p.copa, fila: p.fila });
    sugerencias = [];
    for (const s of Array.isArray(e.sugerencias) ? e.sugerencias : [])
      if (s && Number.isInteger(s.id) && s.id > 0 && typeof s.de === 'string' && pistaValida(s) && ESTADOS.includes(s.estado) && !sugerencias.some(x => x.id === s.id))
        sugerencias.push({ id: s.id, de: s.de, copa: s.copa, fila: s.fila, estado: s.estado });
    sig = Math.max(Number.isInteger(e.sig) ? e.sig : 1, ...sugerencias.map(s => s.id + 1), 1);
    marcarLasQueEntraron(); recortar();
  }
  if (estado) importar(estado);

  return {
    get pistas() { return pistas.map(p => ({ ...p })); },
    get sugerencias() { return sugerencias.map(s => ({ ...s })); },
    get pendientes() { return pendientes().map(s => ({ ...s })); },
    get llena() { return pistas.length >= max; },
    get max() { return max; },
    // las de una persona (para mostrarle cómo le fue: ⌛ ✓ ✕)
    de: uid => sugerencias.filter(s => s.de === uid).map(s => ({ ...s })),
    // ¿qué pasaría si `de` sugiere p? (sin cambiar nada: la página de quien sugiere lo mira antes de mandar)
    revisar(de, p) {
      if (!pistaValida(p) || typeof de !== 'string' || !de) return 'nada';
      if (enLista(p)) return 'ya-esta';
      if (pendientes().some(s => misma(s, p))) return 'ya-sugerida';
      if (pistas.length >= max) return 'llena';
      if (pendientes().filter(s => s.de === de).length >= porPersona) return 'tope';
      return 'sugerida';
    },
    sugerir(de, p) {
      const r = this.revisar(de, p);
      if (r === 'sugerida') { sugerencias.push({ id: sig++, de, copa: p.copa, fila: p.fila, estado: 'pendiente' }); recortar(); }
      return r;
    },
    aceptar(id) {
      const s = sugerencias.find(x => x.id === id && x.estado === 'pendiente');
      if (!s) return 'nada';
      if (enLista(s)) { s.estado = 'aceptada'; return 'ya-esta'; }
      if (pistas.length >= max) return 'llena';
      pistas.push({ copa: s.copa, fila: s.fila }); s.estado = 'aceptada'; recortar();
      return 'agregada';
    },
    rechazar(id) {
      const s = sugerencias.find(x => x.id === id && x.estado === 'pendiente');
      if (!s) return false;
      s.estado = 'rechazada'; recortar();
      return true;
    },
    // la lista que dejó el anfitrión en el selector (agregó, quitó o reordenó)
    ponerPistas(lista) {
      pistas = [];
      for (const p of Array.isArray(lista) ? lista : []) if (pistaValida(p) && !enLista(p) && pistas.length < max) pistas.push({ copa: p.copa, fila: p.fila });
      marcarLasQueEntraron(); recortar();
      return pistas.length;
    },
    importar,
    exportar: () => ({ pistas: pistas.map(p => ({ ...p })), sugerencias: sugerencias.map(s => ({ ...s })), sig }),
  };
}
