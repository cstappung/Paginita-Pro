// Efectos de sonido sintetizados con Web Audio (sin archivos). Silenciables.

let ctx: AudioContext | null = null
let muted = false

export const setMuted = (m: boolean) => {
  muted = m
  if (m) stopMusicHook?.()
}
export const isMuted = () => muted

/** La música de los bailes se corta al silenciar (la registra music.ts). */
let stopMusicHook: (() => void) | null = null
export const onMute = (fn: () => void) => {
  stopMusicHook = fn
}

/** Contexto de audio compartido (se crea con el primer gesto del usuario). */
export function audio(): AudioContext | null {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
  slide(freq, freq, start, dur, type, vol)
}

/** Nota con glissando (de f0 a f1) y envolvente rápida: sirve para piar, cacarear, pops. */
function slide(f0: number, f1: number, start: number, dur: number, type: OscillatorType = 'triangle', vol = 0.06) {
  if (!ctx) return
  const t = ctx.currentTime + start
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

let noiseBuf: AudioBuffer | null = null
/** Ruido filtrado (golpecitos, salpicaduras). */
function noise(start: number, dur: number, freq: number, vol = 0.08, type: BiquadFilterType = 'bandpass', q = 1) {
  if (!ctx) return
  noiseBuf ??= (() => {
    const b = ctx!.createBuffer(1, ctx!.sampleRate * 0.5, ctx!.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  })()
  const t = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(ctx.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

const arpeggio = (freqs: number[], step: number, dur: number) => freqs.forEach((f, i) => tone(f, i * step, dur, 'triangle'))
const vary = (x: number) => x * (0.94 + Math.random() * 0.12)

const SOUNDS = {
  tap: () => tone(660, 0, 0.08),
  buy: () => arpeggio([523, 659, 784, 1047], 0.07, 0.12),
  care: () => arpeggio([523, 784], 0.1, 0.14),
  dance: () => arpeggio([392, 523, 659, 523, 659, 784], 0.1, 0.1),
  grow: () => arpeggio([523, 659, 784, 1047, 1319], 0.09, 0.16),
  error: () => tone(160, 0, 0.18, 'sawtooth', 0.05),
  /** Pollito: dos píos agudos que suben. */
  peep: () => {
    const f = vary(2300)
    slide(f, f * 1.35, 0, 0.09, 'sine', 0.05)
    slide(f * 1.05, f * 1.45, 0.13, 0.1, 'sine', 0.05)
  },
  /** Gallina: "cloc-cloc" grave con un quiebre al final. */
  cluck: () => {
    const f = vary(420)
    slide(f * 1.2, f, 0, 0.07, 'square', 0.035)
    slide(f * 1.25, f * 0.95, 0.11, 0.07, 'square', 0.035)
    slide(f * 1.6, f * 1.1, 0.24, 0.13, 'square', 0.03)
  },
  /** Gato: "miau" que sube y baja, con un poco de nariz. */
  meow: () => {
    const f = vary(620)
    slide(f * 0.8, f * 1.25, 0, 0.16, 'sawtooth', 0.022)
    slide(f * 1.25, f * 0.7, 0.16, 0.24, 'sawtooth', 0.02)
    slide(f * 1.6, f * 2.4, 0, 0.16, 'sine', 0.03)
    slide(f * 2.4, f * 1.3, 0.16, 0.24, 'sine', 0.026)
  },
  /** Gatito: "mi" agudito y corto. */
  mew: () => {
    const f = vary(1100)
    slide(f, f * 1.4, 0, 0.08, 'sine', 0.05)
    slide(f * 1.4, f * 0.9, 0.08, 0.14, 'sine', 0.045)
    slide(f * 2, f * 2.6, 0, 0.1, 'triangle', 0.015)
  },
  /** Ronroneo: pulsos graves y suaves (unos 25 por segundo). */
  purr: () => {
    for (let i = 0; i < 36; i++) noise(i * 0.04, 0.035, 160, 0.06 * Math.sin((Math.PI * i) / 36), 'lowpass', 1)
  },
  /** "Mrrp": el trino corto con que saludan los gatos. */
  mrrp: () => {
    const f = vary(520)
    for (let i = 0; i < 5; i++) slide(f * (1 + i * 0.05), f * (1.04 + i * 0.05), i * 0.028, 0.03, 'triangle', 0.035)
    slide(f * 1.25, f * 1.6, 0.14, 0.1, 'sine', 0.03)
  },
  /** Lengüetazo. */
  lick: () => noise(0, 0.05, vary(3200), 0.035, 'bandpass', 2.5),
  /** Masticar croquetas. */
  crunch: () => {
    noise(0, 0.04, vary(1700), 0.1, 'bandpass', 1.5)
    noise(0.07, 0.03, vary(2300), 0.07, 'bandpass', 1.5)
  },
  /** Golpecitos desde adentro del huevo. */
  knock: () => {
    noise(0, 0.05, 900, 0.18, 'bandpass', 3)
    noise(0.14, 0.05, 1000, 0.15, 'bandpass', 3)
  },
  pop: () => slide(380, 900, 0, 0.09, 'sine', 0.08),
  peck: () => noise(0, 0.03, vary(2600), 0.12, 'bandpass', 6),
  bubble: () => slide(vary(500), vary(1100), 0, 0.07, 'sine', 0.04),
  // Poción eterna: glissando mágico hacia arriba con campanitas.
  magic: () => {
    slide(300, 1200, 0, 0.5)
    arpeggio([784, 988, 1175, 1568], 0.09, 0.25)
  },
  splash: () => noise(0, 0.35, 1800, 0.07, 'highpass', 0.7),
  boing: () => {
    slide(180, 520, 0, 0.16, 'triangle', 0.07)
    slide(520, 300, 0.16, 0.12, 'triangle', 0.04)
  },
  yawn: () => slide(520, 260, 0, 0.7, 'sine', 0.035),
  warm: () => arpeggio([392, 494, 587, 784], 0.12, 0.3),
  /** Esponja frotando: "fsh" húmedo y cortito. */
  scrub: () => noise(0, vary(0.12), vary(2400), 0.05, 'bandpass', 1.4),
  /** Puñado de granos al aire. */
  toss: () => {
    noise(0, 0.16, 3200, 0.05, 'highpass', 0.8)
    slide(300, 700, 0, 0.12, 'sine', 0.03)
  },
  /** Gusanito de juguete que chilla al apretarlo. */
  squeak: () => {
    const f = vary(1250)
    slide(f, f * 1.6, 0, 0.08, 'square', 0.03)
    slide(f * 1.5, f * 1.1, 0.08, 0.1, 'square', 0.025)
  },
  /** Granos que caen al suelo. */
  patter: () => [0, 0.05, 0.11, 0.16].forEach((t) => noise(t, 0.03, vary(3600), 0.06, 'bandpass', 5)),
}
export type SoundId = keyof typeof SOUNDS

export function play(id: SoundId) {
  if (!audio()) return
  try {
    SOUNDS[id]()
  } catch {
    /* sin audio disponible: se ignora */
  }
}
