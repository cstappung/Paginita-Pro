import * as THREE from 'three'

// Letreros del Pueblo dibujados en un lienzo: el nombre bajo cada mascota y el globo de lo que dice.
// Son sprites de la escena (sin DOM, como las burbujas del corral). La textura del nombre se
// guarda por texto y color; la del globo es una por mensaje y la libera quien la pidió.

const TINTA = '#3a2416'
const FUENTE = 'Nunito, system-ui, sans-serif'

export interface Letrero {
  tex: THREE.CanvasTexture
  /** Ancho / alto, para escalar el sprite sin deformarlo. */
  aspecto: number
}

function lienzo(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}
function textura(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const nombres = new Map<string, Letrero>()
/** Cartelito con el nombre de la mascota y, chico, el de su dueño. `color` es el del dueño. */
export function letreroNombre(nombre: string, dueno: string, color: string): Letrero {
  const key = `${nombre}\u0000${dueno}\u0000${color}`
  let l = nombres.get(key)
  if (l) return l
  const H = 96
  const medida = lienzo(8, 8).g
  medida.font = `900 40px ${FUENTE}`
  const w1 = medida.measureText(nombre).width
  medida.font = `800 26px ${FUENTE}`
  const w2 = dueno ? medida.measureText(dueno).width : 0
  const W = Math.ceil(Math.min(640, Math.max(w1, w2) + 48))
  const { c, g } = lienzo(W, dueno ? H + 30 : H)
  const alto = c.height
  g.fillStyle = 'rgba(255, 250, 241, 0.92)'
  g.strokeStyle = color
  g.lineWidth = 6
  g.beginPath()
  g.roundRect(4, 4, W - 8, alto - 8, 26)
  g.fill()
  g.stroke()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = TINTA
  g.font = `900 40px ${FUENTE}`
  g.fillText(nombre, W / 2, dueno ? 40 : alto / 2 + 2, W - 30)
  if (dueno) {
    g.fillStyle = color
    g.font = `800 26px ${FUENTE}`
    g.fillText(dueno, W / 2, 86, W - 30)
  }
  l = { tex: textura(c), aspecto: W / alto }
  nombres.set(key, l)
  // No hay tantos paseantes: con un tope basta para no juntar texturas viejas para siempre.
  if (nombres.size > 80) {
    const [k0, v0] = nombres.entries().next().value as [string, Letrero]
    nombres.delete(k0)
    v0.tex.dispose()
  }
  return l
}

/** Parte un texto en líneas que quepan en `ancho` (como mucho `max`; la última se corta con …). */
function lineas(g: CanvasRenderingContext2D, texto: string, ancho: number, max: number) {
  const out: string[] = []
  let linea = ''
  for (const p of texto.split(' ')) {
    const prueba = linea ? linea + ' ' + p : p
    if (g.measureText(prueba).width <= ancho || !linea) linea = prueba
    else {
      out.push(linea)
      linea = p
    }
  }
  if (linea) out.push(linea)
  if (out.length > max) {
    out.length = max
    out[max - 1] = out[max - 1].replace(/.{0,2}$/, '…')
  }
  return out
}

/** Globo de diálogo con lo que dijo (hay que liberarlo con `tex.dispose()`). */
export function globo(texto: string): Letrero {
  const W = 420
  const medida = lienzo(8, 8).g
  medida.font = `800 34px ${FUENTE}`
  const ls = lineas(medida, texto, W - 56, 3)
  const anchoTexto = Math.max(...ls.map((x) => medida.measureText(x).width))
  const w = Math.ceil(Math.min(W, anchoTexto + 56))
  const h = 30 + ls.length * 42 + 34
  const { c, g } = lienzo(w, h)
  g.fillStyle = '#ffffff'
  g.strokeStyle = TINTA
  g.lineWidth = 6
  g.beginPath()
  g.roundRect(4, 4, w - 8, h - 30, 24)
  g.fill()
  g.stroke()
  // La colita del globo.
  g.beginPath()
  g.moveTo(w / 2 - 14, h - 28)
  g.lineTo(w / 2, h - 6)
  g.lineTo(w / 2 + 14, h - 28)
  g.fill()
  g.stroke()
  g.fillRect(w / 2 - 11, h - 34, 22, 8)
  g.fillStyle = TINTA
  g.font = `800 34px ${FUENTE}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  ls.forEach((x, i) => g.fillText(x, w / 2, 26 + 21 + i * 42))
  return { tex: textura(c), aspecto: w / h }
}
