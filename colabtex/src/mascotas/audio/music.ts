import { getDance, type DanceId } from '../data/accessories'
import { audio, onMute } from './sound'

// Música original de cada baile, sintetizada al vuelo (sin archivos de audio).
// Cada pista es una lista de pasos (subdivisiones del golpe) que se repite hasta llenar el baile:
//   nota ("C5", "F#4", "Bb3"), "-" = sigue sonando, "." = silencio. Las barras "|" solo ordenan.
// Percusión: "x" = golpe. Acordes: "C", "Am", "G7"…

type Wave = OscillatorType

interface Tune {
  lead: string
  leadWave: Wave
  bass: string
  bassWave: Wave
  chords?: string
  kick?: string
  snare?: string
  hat?: string
  clave?: string
  clap?: string
  /** Zapateo / golpecitos secos. */
  tap?: string
  /** Colchón: acordes sostenidos con sierras desafinadas y entrada lenta (legendarios). */
  pad?: string
  /** Campanitas brillantes (arpegio). */
  bell?: string
  /** Eco sobre melodía y campanitas, en pasos de retardo. */
  echo?: number
}

const TUNES: Record<DanceId, Tune> = {
  salsa: {
    lead: 'G4 C5 E5 G4 . C5 E5 C5 | A4 C5 F5 A4 . C5 F5 D5 | B4 D5 G5 B4 . D5 F5 D5 | C5 E5 G5 E5 C5 - G4 .',
    leadWave: 'triangle',
    bass: 'C3 . . G2 . . C3 . | F2 . . C3 . . F2 . | G2 . . D3 . . G2 . | C3 . . G2 . . C3 .',
    bassWave: 'triangle',
    kick: 'x...x...x...x...',
    clave: 'x..x..x...x.x...',
    hat: '.x.x.x.x.x.x.x.x',
  },
  spin: {
    lead: 'D5 . B4 . G4 . B4 D5 | E5 . C5 . A4 . C5 E5 | D5 E5 F#5 G5 A5 B5 C6 D6 | C6 - B5 - Bb5 - G5 .',
    leadWave: 'triangle',
    bass: 'G2 . G3 . G2 . G3 . | C3 . C4 . C3 . C4 . | D3 . D4 . D3 . D4 . | G2 . . . G2 . . .',
    bassWave: 'triangle',
    kick: 'x...x...x...x...',
    snare: '..x...x...x...x.',
    hat: '.x.x.x.x.x.x.x.x',
  },
  robot: {
    lead: 'A4 . A4 C5 . E5 . D5 | C5 . A4 . G4 . A4 . | A4 . A4 C5 . E5 . G5 | E5 - D5 - C5 - A3 -',
    leadWave: 'square',
    bass: 'A2 A2 . A2 . A2 G2 . | F2 F2 . F2 . G2 . .',
    bassWave: 'sawtooth',
    kick: 'x..x..x.x..x..x.',
    snare: '....x.......x...',
    hat: 'xxxxxxxxxxxxxxxx',
  },
  disco: {
    lead: 'E5 - - - A5 - G5 E5 | D5 - - - F#5 - E5 D5 | C5 - E5 - A5 - - - | B5 - G#5 - E5 - - .',
    leadWave: 'triangle',
    bass: 'A2 A3 A2 A3 A2 A3 A2 A3 | D3 D4 D3 D4 E3 E4 E3 E4',
    bassWave: 'triangle',
    kick: 'x.x.x.x.x.x.x.x.',
    clap: '..x...x...x...x.',
    hat: '.x.x.x.x.x.x.x.x',
  },
  conga: {
    lead:
      'C5 E5 C5 E5 | G5 . G5 . | A5 G5 F5 E5 | D5 D5 D5 . | C5 E5 C5 E5 | G5 . G5 . | A5 B5 C6 A5 | G5 E5 C5 . | ' +
      'C5 D5 E5 F5 G5 A5 B5 C6 | D6 C6 B5 A5 G5 - C6 .',
    leadWave: 'square',
    bass: 'C3 . G2 . C3 . G2 . | F2 . C3 . G2 . G2 .',
    bassWave: 'triangle',
    chords: '. C . C . C . C . F . F . G . G',
    clap: '............xxx.',
  },
  cueca: {
    lead:
      'A4 . D5 F#5 . E5 D5 . C#5 B4 . A4 | G4 . B4 D5 . C#5 B4 . A4 A4 . . | ' +
      'F#5 . G5 A5 . F#5 E5 . D5 C#5 . E5 | D5 . B4 A4 . F#4 E4 . F#4 D4 - -',
    leadWave: 'triangle',
    bass: 'D3 . A2 D3 . A2 | A2 . E3 A2 . E3 | G2 . D3 A2 . E3 | D3 . A2 D3 . .',
    bassWave: 'triangle',
    chords: 'D . D D . D | A . A A . A | G . G A . A | D . D D . .',
    kick: 'x.....',
    snare: '...x..',
    tap: `${'. '.repeat(24)}x . x x . x x . x x . x ${'. '.repeat(12)}`,
  },
  // ——— Legendarios: más capas (colchón, campanitas, eco) ———
  moonwalk: {
    lead: 'E5 . G5 E5 . D5 E5 . | B4 . D5 . E5 - . . | E5 . G5 A5 . G5 E5 D5 | E5 - B4 - D5 - E5 .',
    leadWave: 'square',
    bass: 'E2 . E3 . . E2 D3 E3 | G2 . G3 . A2 . B2 D3',
    bassWave: 'sawtooth',
    chords: '. . Em7 . . . Em7 . | . . G . . . A . | . . Em7 . . . Em7 . | . . C . . . B7 .',
    pad: 'Em7 - - - - - - - | C - - - - - - - | Am7 - - - - - - - | B7 - - - - - - -',
    bell: '. . . . . . . . | . . . . B5 . E6 . | . . . . . . . . | . . G6 . F#6 . D#6 .',
    echo: 3,
    kick: 'x.....x.x.......',
    snare: '..x...x...x...x.',
    hat: 'x.xxx.xxx.xxx.xx',
  },
  cosmic: {
    lead: 'A5 - - - E5 - F#5 - | G#5 - - - E5 - - - | A5 - B5 - C#6 - E6 - | D6 - - - C#6 - - -',
    leadWave: 'sine',
    bass: 'A2 - - - - - - - | F#2 - - - - - - - | D2 - - - - - - - | E2 - - - - - - -',
    bassWave: 'sine',
    pad: 'A - - - - - - - | F#m - - - - - - - | D - - - - - - - | E - - - - - - -',
    bell:
      'A5 C#6 E6 A6 E6 C#6 A5 E5 | F#5 A5 C#6 F#6 C#6 A5 F#5 C#5 | ' +
      'D5 F#5 A5 D6 A5 F#5 D5 A4 | E5 G#5 B5 E6 B5 G#5 E5 B4',
    echo: 3,
    kick: 'x.......x.......',
    hat: '...x...x...x...x',
  },
}

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function midi(name: string) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!m) return null
  return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12
}
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)
const tokens = (s: string) => s.split(/\s+/).filter((t) => t && t !== '|')
const hits = (s: string) => s.replace(/[\s|]/g, '').split('')

let current: { master: GainNode; nodes: AudioScheduledSourceNode[]; extra: AudioNode[] } | null = null

export function stopMusic() {
  if (!current) return
  const { master, nodes, extra } = current
  current = null
  const ctx = master.context
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  window.setTimeout(() => {
    for (const n of nodes) {
      try {
        n.stop()
      } catch {
        /* ya terminó */
      }
    }
    master.disconnect()
    for (const n of extra) n.disconnect()
  }, 300)
}
onMute(stopMusic)

/** Toca la música de un baile desde ya (corta la que estuviera sonando). */
export function playDance(id: string) {
  const dance = getDance(id)
  const ctx = audio()
  if (!dance || !ctx) return
  stopMusic()
  const tune = TUNES[dance.id]
  const master = ctx.createGain()
  master.gain.value = 0.55
  master.connect(ctx.destination)
  const nodes: AudioScheduledSourceNode[] = []
  const extra: AudioNode[] = []
  current = { master, nodes, extra }
  const step = 60 / dance.bpm / dance.steps
  const total = dance.beats * dance.steps
  const t0 = ctx.currentTime + 0.06

  // Eco: la melodía y las campanitas pasan también por un retardo con realimentación.
  let lit: AudioNode = master
  if (tune.echo) {
    const bus = ctx.createGain()
    const delay = ctx.createDelay(2)
    const fb = ctx.createGain()
    const wet = ctx.createGain()
    delay.delayTime.value = step * tune.echo
    fb.gain.value = 0.38
    wet.gain.value = 0.32
    bus.connect(master)
    bus.connect(delay).connect(wet).connect(master)
    delay.connect(fb).connect(delay)
    extra.push(bus, delay, fb, wet)
    lit = bus
  }

  const voice = (freq: number, at: number, dur: number, wave: Wave, vol: number, cutoff = 4000, out: AudioNode = master) => {
    const o = ctx.createOscillator()
    const f = ctx.createBiquadFilter()
    const g = ctx.createGain()
    o.type = wave
    o.frequency.value = freq
    f.type = 'lowpass'
    f.frequency.value = cutoff
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012)
    g.gain.exponentialRampToValueAtTime(vol * 0.55, at + Math.min(dur, 0.12))
    g.gain.setValueAtTime(vol * 0.55, at + Math.max(0.02, dur - 0.04))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.06)
    o.connect(f).connect(g).connect(out)
    o.start(at)
    o.stop(at + dur + 0.1)
    nodes.push(o)
  }

  const melody = (track: string, wave: Wave, vol: number, cutoff: number, gate = 0.9, out: AudioNode = master) => {
    const tk = tokens(track)
    for (let i = 0; i < total; i++) {
      const m = midi(tk[i % tk.length])
      if (m === null) continue
      let len = 1
      while (i + len < total && tk[(i + len) % tk.length] === '-') len++
      voice(hz(m), t0 + i * step, len * step * gate, wave, vol, cutoff, out)
    }
  }

  /** Acorde → notas MIDI (raíz en la octava dada). */
  const chord = (name: string, octave: number) => {
    const c = /^([A-G][#b]?)(m?)(7?)$/.exec(name)
    if (!c) return null
    const root = midi(`${c[1]}${octave}`)!
    return [0, c[2] ? 3 : 4, 7, ...(c[3] ? [10] : [])].map((n) => root + n)
  }

  /** Colchón: cada nota del acorde con dos sierras desafinadas, entrada y salida lentas. */
  const pad = (track: string) => {
    const tk = tokens(track)
    for (let i = 0; i < total; i++) {
      const ns = chord(tk[i % tk.length], 3)
      if (!ns) continue
      let len = 1
      while (i + len < total && tk[(i + len) % tk.length] === '-') len++
      const at = t0 + i * step
      const dur = len * step
      for (const n of ns)
        for (const det of [-8, 8]) {
          const o = ctx.createOscillator()
          const f = ctx.createBiquadFilter()
          const g = ctx.createGain()
          o.type = 'sawtooth'
          o.frequency.value = hz(n + 12)
          o.detune.value = det
          f.type = 'lowpass'
          f.frequency.value = 1300
          g.gain.setValueAtTime(0.0001, at)
          g.gain.linearRampToValueAtTime(0.012, at + Math.min(0.35, dur * 0.4))
          g.gain.setValueAtTime(0.012, at + dur * 0.85)
          g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.25)
          o.connect(f).connect(g).connect(master)
          o.start(at)
          o.stop(at + dur + 0.3)
          nodes.push(o)
        }
    }
  }

  /** Campanita: seno con un parcial inarmónico que se apaga rápido. */
  const bell = (track: string) => {
    const tk = tokens(track)
    for (let i = 0; i < total; i++) {
      const m = midi(tk[i % tk.length])
      if (m === null) continue
      const at = t0 + i * step
      for (const [mul, vol, dec] of [[1, 0.045, 0.7], [2.76, 0.015, 0.25]] as const) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = hz(m) * mul
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(vol, at + 0.005)
        g.gain.exponentialRampToValueAtTime(0.0001, at + dec)
        o.connect(g).connect(lit)
        o.start(at)
        o.stop(at + dec + 0.05)
        nodes.push(o)
      }
    }
  }

  let noiseBuf: AudioBuffer | null = null
  const noise = (at: number, dur: number, freq: number, type: BiquadFilterType, vol: number, q = 1) => {
    noiseBuf ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      return b
    })()
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(f).connect(g).connect(master)
    src.start(at)
    src.stop(at + dur + 0.02)
    nodes.push(src)
  }
  const drum = (track: string | undefined, fn: (at: number) => void) => {
    if (!track) return
    const h = hits(track)
    for (let i = 0; i < total; i++) if (h[i % h.length] === 'x') fn(t0 + i * step)
  }
  const kick = (at: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(150, at)
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12)
    g.gain.setValueAtTime(0.32, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
    o.connect(g).connect(master)
    o.start(at)
    o.stop(at + 0.2)
    nodes.push(o)
  }

  melody(tune.lead, tune.leadWave, tune.leadWave === 'square' ? 0.05 : 0.09, tune.leadWave === 'square' ? 2600 : 5000, 0.9, lit)
  if (tune.pad) pad(tune.pad)
  if (tune.bell) bell(tune.bell)
  melody(tune.bass, tune.bassWave, tune.bassWave === 'sawtooth' ? 0.07 : 0.12, 900, 0.8)
  if (tune.chords) {
    const tk = tokens(tune.chords)
    for (let i = 0; i < total; i++) {
      const notes = chord(tk[i % tk.length], 4)
      if (!notes) continue
      // Rasgueo: las notas entran apenas desfasadas, como una guitarra.
      notes.forEach((n, k) => voice(hz(n), t0 + i * step + k * 0.012, step * 0.7, 'triangle', 0.035, 2400))
    }
  }
  drum(tune.kick, kick)
  drum(tune.snare, (at) => noise(at, 0.13, 1800, 'bandpass', 0.22, 0.8))
  drum(tune.hat, (at) => noise(at, 0.035, 8000, 'highpass', 0.05))
  drum(tune.clave, (at) => voice(2500, at, 0.03, 'sine', 0.08))
  drum(tune.clap, (at) => {
    for (const d of [0, 0.012, 0.024]) noise(at + d, 0.08, 1400, 'bandpass', 0.16, 1.2)
  })
  drum(tune.tap, (at) => noise(at, 0.04, 700, 'bandpass', 0.25, 4))
}
