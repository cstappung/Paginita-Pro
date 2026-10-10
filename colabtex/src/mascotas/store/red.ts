// El puente con la página de Juegos. El juego vive en un iframe y nunca toca Firebase: el cartero
// (colabtex/src/juegos/mascotas.js) le manda los datos de la cuenta cada vez que cambian y hace por
// él las escrituras que pide, una a la vez, revisadas contra la lectura completa de la economía.

type Oyente = (x: any) => void

const CANAL_PADRE = 'mascotas-parent'
const CANAL_HIJO = 'mascotas-child'

export const enJuegos = typeof window !== 'undefined' && window.parent !== window

const pendientes = new Map<number, { ok: (v: any) => void; mal: (e: Error) => void }>()
const oyentes = new Map<string, Set<Oyente>>()
let siguiente = 1

function manda(x: Record<string, unknown>) {
  if (enJuegos) window.parent.postMessage({ canal: CANAL_HIJO, ...x }, location.origin)
}

if (typeof window !== 'undefined')
  window.addEventListener('message', (e) => {
    if (!enJuegos || e.source !== window.parent || e.origin !== location.origin) return
    const x = e.data
    if (!x || x.canal !== CANAL_PADRE) return
    if (x.tipo === 'resp') {
      const p = pendientes.get(x.id)
      if (!p) return
      pendientes.delete(x.id)
      if (x.ok) p.ok(x.dato)
      else p.mal(new Error(x.error || 'No se pudo.'))
      return
    }
    for (const f of oyentes.get(x.tipo) ?? []) f(x)
  })

/** Le pide al cartero una escritura (o una lectura). Responde lo que él responda. */
export function pide<T = unknown>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  if (!enJuegos) return Promise.reject(new Error('Abre Mascotas desde Juegos para guardar.'))
  const id = siguiente++
  return new Promise<T>((ok, mal) => {
    pendientes.set(id, { ok, mal })
    manda({ tipo: 'pide', id, accion, ...datos })
  })
}

/** Escucha un tipo de mensaje del cartero ('datos', 'tema'…). */
export function al(tipo: string, f: Oyente) {
  if (!oyentes.has(tipo)) oyentes.set(tipo, new Set())
  oyentes.get(tipo)!.add(f)
  return () => void oyentes.get(tipo)!.delete(f)
}

/** Avisa algo sin esperar respuesta ('listo', 'volver', 'mercado'). */
export const avisa = (tipo: string, datos: Record<string, unknown> = {}) => manda({ tipo, ...datos })
