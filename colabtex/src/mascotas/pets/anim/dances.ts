import { DANCES, type DanceId } from '../../data/accessories'
import type { Pose } from './pose'
import type { Ctx } from './clip'
import { heart, note } from './cues'
import { A, A1, beak, body, foot, gaze, head, neck, root, squash, tail } from './poses'
import { Layer, P, TAU, arc, bounce, clamp, easeInOut, frac, hit, kf, lerp, smooth } from './util'

// Coreografías de la gallina, escritas en golpes (beats) de la música de cada baile
// (src/audio/music.ts): los pasos caen justo con el ritmo. Las vueltas terminan en un múltiplo
// de 2π expresado como 0, así el final empalma con el reposo sin girar de vuelta.

type DanceClip = (c: Ctx, u: number) => void

const bpm = (id: DanceId) => DANCES.find((d) => d.id === id)!.bpm
const turns = (x: number, n = 1) => (x > 0 && x < 1 ? TAU * n * x : 0)

/** ¿Pasó el golpe `beat` en este cuadro? */
function atB(c: Ctx, id: DanceId, beat: number) {
  return c.at((beat * 60) / bpm(id))
}

/** Notas musicales cada dos golpes. */
function notes(c: Ctx, id: DanceId, beats: number) {
  for (let i = 1; i * 2 < beats; i++) if (atB(c, id, i * 2 - 0.5)) note(c, i)
}

type Step = readonly [beat: number, z: number, x?: number, lift?: number]

/**
 * Pie que pisa en las posiciones dadas: llega a cada una justo en su golpe, levantándose en
 * arco durante `move` golpes antes. Una clave con `lift` y la misma posición = pisar en el lugar.
 */
function steps(L: Layer, s: 1 | -1, b: number, keys: readonly Step[], move = 0.45, liftDefault = 0.055) {
  let i = 0
  while (i < keys.length - 1 && b >= keys[i + 1][0]) i++
  const k0 = keys[i]
  const k1 = keys[i + 1]
  let z = k0[1]
  let x = k0[2] ?? 0
  let y = 0
  if (k1 && b >= k0[0]) {
    const m = Math.min(move, k1[0] - k0[0])
    const t = smooth(k1[0] - m, k1[0], b)
    const moved = k1[1] !== k0[1] || (k1[2] ?? 0) !== (k0[2] ?? 0)
    z = lerp(z, k1[1], t)
    x = lerp(x, k1[2] ?? 0, t)
    y = arc(b, k1[0] - m, k1[0]) * (k1[3] ?? (moved ? liftDefault : 0))
  }
  L.pose(foot(s, y, z, x))
}

/** Pisar en el lugar en los golpes dados, alternando pies (empieza con `first`). */
function march(L: Layer, b: number, beats: number[], first: 1 | -1 = 1, lift = 0.04, move = 0.4) {
  beats.forEach((t, i) => {
    const s = (i % 2 ? -first : first) as 1 | -1
    const y = arc(b, t - move, t) * lift
    if (y) L.pose(foot(s, y))
  })
}

/** Rebote de rodillas: baja en cada golpe. */
const groove = (b: number, k = 0.018): Pose => ({ body: { py: -k * (1 - bounce(b)) } })
/** Cabeceo de gallina al ritmo: la cabeza se adelanta en cada golpe. */
const bob = (b: number, k = 0.022): Pose => ({ head: { pz: k * hit(b, 6), rx: 0.08 * hit(b, 6) } })
const range = (b: number, a: number, z: number, fade = 0.3) => smooth(a - fade, a, b) * (1 - smooth(z, z + fade, b))

// ——— Poses de brazos con nombre ———
/** Ala en la cadera (mano en la cintura). */
const HIP = (s: number) => A1(s, 0.25, -1.05, 0.5)
/** Ala señalando arriba en diagonal (disco). */
const POINT_UP = (s: number) => A1(s, 1.2, 1.25)
const POINT_DOWN = (s: number) => A1(s, 0.35, -1.1, 0.15)
const TADA = P(A(1.3, 1.1), body(-0.1), gaze(0, -0.2), tail(0.3))

// ——— Salsa: básico adelante-atrás, vuelta guiada, shimmy y pose enamorada ———
const salsa: DanceClip = (c, u) => {
  const b = (u * bpm('salsa')) / 60
  const L = c.L
  c.face(b > 14.8 ? 'love' : 'happy')
  steps(L, 1, b, [[0, 0], [1, 0.08], [3, 0], [6, 0, 0, 0.035], [9, 0, 0, 0.03], [11, 0, 0, 0.03], [13, 0.08], [14, 0], [15, 0]])
  steps(L, -1, b, [[0, 0], [2, 0, 0, 0.035], [5, -0.08], [7, 0], [8, 0], [10, 0, 0, 0.03], [12, 0, 0, 0.03], [13.5, 0, 0, 0.03], [15, 0]])
  // Caderas cubanas: el peso pasa de un pie al otro en cada golpe.
  const hips = range(b, 0, 14.6)
  L.pose(body(0.06 * kf(b, [[0, 0], [1, 1], [3, 0], [5, -1], [7, 0], [12, 0], [13, 1], [14, 0]]), 0.075 * Math.cos(Math.PI * b), 0.1 * Math.sin(Math.PI * b)), hips)
    .pose(head(0, 0, -0.05 * Math.cos(Math.PI * b)), hips)
    .pose(groove(b), hips)
    .pose(bob(b, 0.015), hips)
    .pose(tail(0.1, 0.25 * Math.cos(Math.PI * b)), hips)
  // Brazos: marco de pareja → vuelta guiada → shimmy → pose final.
  const frame = (k: number) => P(A(1.0, 0.2 + 0.15 * k, 1.0, 0.2 - 0.15 * k, 0.15), gaze(0, -0.1))
  const turnArms = P(A1(-1, 0.35, 1.75, 0.1), A1(1, 1.15, 0.25), gaze(0, -0.15))
  const shimmy = P(A(1.15, -0.25, 1.15, -0.25, 0.2), body(0.05))
  L.seq(b, [
    [0, frame(Math.sin(Math.PI * b))],
    [7.5, frame(Math.sin(Math.PI * b))],
    [8.3, turnArms],
    [11, turnArms],
    [11.7, shimmy],
    [14.5, shimmy],
    [15, P(A(1.2, 0.9), body(-0.08), head(-0.1, 0, 0.22), tail(0.3))],
  ])
  L.pose(root(0.05 * arc(b, 8.5, 9.4) + 0.05 * arc(b, 14.7, 15.3), turns(smooth(8.5, 10.6, b))))
  L.pose(body(0, 0, 0.14 * Math.sin(TAU * 2 * b)), range(b, 12, 14.5)) // shimmy de hombros
  march(L, b, [9, 10, 11], -1, 0.03)
  if (atB(c, 'salsa', 15)) for (const dx of [-0.15, 0, 0.15]) heart(c, dx)
  notes(c, 'salsa', 14)
}

// ——— Giro: balanceo, medias vueltas, piruetas de avión, mareo y ¡ta-dá! ———
const spin: DanceClip = (c, u) => {
  const b = (u * bpm('spin')) / 60
  const L = c.L
  const dizzy = range(b, 11.8, 13.8, 0.2)
  c.face(dizzy > 0.5 ? 'dizzy' : 'happy')
  // Balanceo de lado a lado agitando las alas.
  const sway = range(b, 0, 3.8)
  L.pose(body(0, 0.11 * Math.sin(Math.PI * b), 0, 0), sway)
    .pose(A(0.55, -0.15 + 0.35 * Math.sin(Math.PI * b), 0.55, -0.15 - 0.35 * Math.sin(Math.PI * b), 0.1), sway)
    .pose(bob(b), sway)
    .pose(groove(b), sway)
  march(L, b, [0.5, 1, 1.5, 2, 2.5, 3, 3.5], 1, 0.035, 0.3)
  // Dos medias vueltas con saltito.
  const half = range(b, 4, 7.8)
  L.pose(P(A(1.3, 0.35), tail(0.25), gaze(0, -0.15)), half).pose(root(0.06 * (arc(b, 4, 5) + arc(b, 6, 7))))
  // Pirueta de avión: alas en cruz, inclinada, una pata atrás, dos vueltas.
  const plane = range(b, 8, 11.6)
  L.pose(P(A(1.5, 0.05), body(0.32, 0, 0, -0.01), gaze(0, -0.45), tail(0.35), foot(-1, 0.09, -0.12)), plane)
  L.pose(root(0, turns((smooth(4, 5, b) + smooth(6, 7, b)) / 2) + turns(easeInOut(clamp((b - 8) / 3.6)), 2)))
  // Mareada: la cabeza da vueltitas y se tambalea.
  const w = TAU * 1.1 * u
  L.pose(
    P(
      { head: { rz: 0.3 * Math.sin(w), ry: 0.3 * Math.cos(w), rx: 0.1 } },
      { neck: { rz: 0.12 * Math.sin(w - 0.6) } },
      body(0.05, 0.1 * Math.sin(w * 0.5)),
      A(0.4, -0.55, 0.25, -0.35, 0.2),
      { root: { px: 0.03 * Math.sin(w * 0.5) } },
      foot(1, 0.02 * Math.max(0, Math.sin(w * 0.5)), 0, 0.02),
      foot(-1, 0.02 * Math.max(0, -Math.sin(w * 0.5)), 0, -0.02),
    ),
    dizzy,
  )
  // ¡Ta-dá!
  const end = smooth(13.7, 14.05, b)
  L.pose(TADA, end).pose(root(0.08 * arc(b, 13.7, 14.4))).pose(squash(-0.06 * arc(b, 14.3, 14.7)))
  if (atB(c, 'spin', 14)) stars(c)
  notes(c, 'spin', 13)
}

// ——— Robot: poses secas en cada golpe, ola, apagón y reinicio ———
const robot: DanceClip = (c, u) => {
  const b = (u * bpm('robot')) / 60
  const L = c.L
  const off = range(b, 12.2, 13.9, 0.2)
  c.face(off > 0.6 ? 'sleep' : b > 13.9 && b < 14.5 ? 'surprised' : 'happy')
  const N = P(A(0.15, -0.15), gaze(0))
  L.seq(
    b,
    [
      [0, N],
      [1, P(A1(1, 1.5, 0), gaze(0.65))],
      [2, P(A(1.5, 0), gaze(0))],
      [3, P(A1(-1, 1.5, 1.5), A1(1, 1.5, -0.9), gaze(-0.65))],
      [4, P(A(0.25, -2.55), body(0.1), gaze(0, 0.1))],
      [5, P(A(1.2, -0.7), head(0, 0, 0.38))],
      [6, P(A(1.5, 0), body(0, 0, 0.45), gaze(-0.35))],
      [7, P(A(1.5, 0), body(0, 0, -0.45), gaze(0.35))],
      [8, P(A(1.5, 0))],
      [11.6, P(A(1.5, 0))],
      [12.2, P(A(0.1, -0.5), neck(0.45), head(0.4, 0, 0.2), body(0.2, 0, 0, -0.05), tail(-0.4))],
      [14, P(A(0.1, -0.5), neck(0.45), head(0.4, 0, 0.2), body(0.2, 0, 0, -0.05), tail(-0.4))],
      [14.25, TADA],
    ],
    'snap',
    0.22,
  )
  // Ola: pasa del ala izquierda a la cabeza, al cuerpo y al ala derecha.
  const wave = range(b, 8, 11.6, 0.25)
  const p = Math.PI * (b - 8)
  L.pose(P(A1(1, 0, 0.9 * Math.sin(p)), head(0, 0, 0.25 * Math.sin(p - 1)), body(0, 0.07 * Math.sin(p - 1.6)), A1(-1, 0, 0.9 * Math.sin(p - 2.4))), wave)
  // Marcha de robot y el apagón (se hunde de golpe), con chispazo al reiniciar.
  march(L, b, [1, 2, 3, 4, 5, 6, 7, 8], 1, 0.04, 0.25)
  L.pose(groove(b, 0.012), range(b, 0, 11.6))
  if (atB(c, 'robot', 14.1)) stars(c)
  notes(c, 'robot', 12)
}

// ——— Disco: señalar arriba/abajo, paso de hustle, vuelta y pose final ———
const disco: DanceClip = (c, u) => {
  const b = (u * bpm('disco')) / 60
  const L = c.L
  c.face('happy')
  const up = P(POINT_UP(-1), HIP(1), body(0, 0.12), gaze(-0.45, -0.45), foot(-1, 0, 0.02, -0.04))
  const down = P(POINT_DOWN(-1), HIP(1), body(0.05, -0.1), gaze(0.25, 0.35), foot(-1, 0.03, 0.05, -0.06))
  const roll = (k: number) => P(A(0.25, -2.1 + 0.35 * Math.sin(TAU * b + k), 0.25, -2.1 + 0.35 * Math.sin(TAU * b + k + Math.PI)), gaze(0, 0.05))
  L.seq(
    b,
    [
      [0, down],
      [1, up],
      [2, down],
      [3, up],
      [4, down],
      [5, up],
      [6, down],
      [7, up],
      [8, roll(0)],
      [11.7, roll(0)],
      [12.1, P(A(0.1, 0.1), gaze(0, -0.2))],
      [13.6, P(A(0.1, 0.1), gaze(0, -0.2))],
      [14, up],
    ],
    'snap',
    0.2,
  )
  L.pose(groove(b, 0.02), range(b, 0, 11.7)).pose(bob(b), range(b, 8, 11.7))
  // Hustle: paso al costado y toque, ida y vuelta.
  const hustle = range(b, 7.6, 12, 0.3)
  L.pose(body(0, 0.07 * Math.sin((Math.PI * (b - 8)) / 2), 0, 0), hustle)
  L.j('body', { px: 0.06 * kf(b, [[7.6, 0], [8, -0.5], [9, -1], [10, -0.5], [11, 0], [12, 0]]) })
  steps(L, -1, b, [[7.5, 0], [8, 0, -0.06], [10, 0, -0.06], [11, 0, 0, 0.05], [12, 0]])
  steps(L, 1, b, [[7.5, 0], [9, 0, -0.08, 0.05], [10, 0, 0], [12, 0]])
  // Vuelta y final.
  L.pose(root(0.06 * arc(b, 12, 13.5), turns(smooth(12, 13.5, b))))
  if (atB(c, 'disco', 14)) stars(c)
  notes(c, 'disco', 13)
}

// ——— Pollo loco (la danza del pollito): pico, alas, colita, aplausos… y a girar ———
const conga: DanceClip = (c, u) => {
  const b = (u * bpm('conga')) / 60
  const L = c.L
  c.face('happy')
  const q = b < 16 ? b % 8 : -1
  const fade = range(b, 0, 15.7, 0.15)
  const sec = (a: number, z: number) => (q >= a - 0.15 && q < z + 0.15 ? smooth(a - 0.15, a + 0.05, q) * (1 - smooth(z - 0.05, z + 0.15, q)) : 0) * fade
  // 1) Pico: cuatro picotazos al aire con las alas adelante como manitos.
  const s1 = sec(0, 2)
  const snap = arc(frac(q * 2), 0, 0.6)
  L.pose(P(A(0.15, -2.55, 0.15, -2.55, 0.1), beak(0.32 * snap), { head: { pz: 0.02 * snap, rx: -0.12 } }), s1)
  // 2) Alas: cuatro aleteos de codo.
  const s2 = sec(2, 4)
  const fl = bounce(q * 2)
  L.pose(P(A(0.75, -0.1 + 0.7 * fl, 0.75, -0.1 + 0.7 * fl, 0.2), root(0.02 * fl)), s2)
  // 3) Colita: se agacha y menea la cola.
  const s3 = sec(4, 6)
  const wig = Math.sin(TAU * 2 * q)
  L.pose(P(body(0.15, 0, 0.16 * wig, -0.06), tail(0.3, 0.6 * wig), A(0.5, -0.45, 0.5, -0.45, 0.25), gaze(0, 0.2)), s3)
  // 4) Aplausos (tres, con la música).
  const s4 = sec(6, 8)
  const clap = Math.max(hit(q - 6, 5) * (q >= 6 ? 1 : 0), hit(q - 6.5, 5) * (q >= 6.5 ? 1 : 0), hit(q - 7, 5) * (q >= 7 && q < 7.6 ? 1 : 0))
  L.pose(P(A(-0.45 + 0.8 * clap, -2.6), body(-0.05), gaze(0, -0.1)), s4)
  L.pose(groove(b, 0.02), fade)
  march(L, b, [1, 3, 5, 7, 9, 11, 13, 15], 1, 0.03, 0.3)
  // 5) Polka: dos vueltas saltando y pataditas.
  const polka = range(b, 16, 21.9, 0.25)
  L.pose(P(A(1.05, 0.35 + 0.3 * Math.sin(Math.PI * b), 1.05, 0.35 - 0.3 * Math.sin(Math.PI * b), 0.15), gaze(0, -0.15), tail(0.3, 0.3 * Math.sin(Math.PI * b))), polka)
  L.pose(root(0.06 * polka * bounce(b), turns(smooth(16.2, 21.7, b), 2)))
  for (let i = 16; i < 22; i++) {
    const s = (i % 2 ? -1 : 1) as 1 | -1
    L.pose(foot(s, 0.06 * arc(b, i, i + 0.7), 0.07 * arc(b, i, i + 0.7)), polka)
  }
  // 6) Últimos aplausos y ¡ta-dá!
  const fin = range(b, 22, 23, 0.15)
  const clap2 = Math.max(hit(b - 22, 5) * (b >= 22 ? 1 : 0), hit(b - 22.5, 5) * (b >= 22.5 ? 1 : 0))
  L.pose(P(A(-0.45 + 0.8 * clap2, -2.6), gaze(0, -0.1)), fin)
  L.pose(TADA, smooth(22.8, 23.1, b)).pose(root(0.07 * arc(b, 22.8, 23.4)))
  if (atB(c, 'conga', 23)) stars(c)
  notes(c, 'conga', 22)
}

// ——— Cueca: paseo en media luna, vuelta, zapateo y remate, con pañuelo ———
const cueca: DanceClip = (c, u) => {
  const b = (u * bpm('cueca')) / 60
  const L = c.L
  c.face(b > 14.7 ? 'love' : 'happy')
  c.prop('panuelo')
  // Recorrido: una vuelta completa a un círculo chico (media luna de ida y de vuelta).
  const th = TAU * smooth(0, 8, b)
  const pathW = 1 - smooth(8, 8.4, b)
  L.pose(root(0, 0.4 * Math.sin(th) * pathW + turns(smooth(4.6, 7.6, b)), 0.11 * Math.sin(th), 0.07 * (1 - Math.cos(th))))
  march(L, b, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5], 1, 0.04, 0.28)
  // Pañuelo arriba agitándose; la otra ala en la cintura.
  const twirl = TAU * b * 0.5
  L.pose(HIP(1))
  L.pose(A1(-1, 1.0 + 0.2 * Math.cos(twirl), 1.25 + 0.25 * Math.sin(twirl), 0.1))
  L.pose(P(gaze(0.2 * Math.sin(th), -0.12), body(-0.04, 0.06 * Math.sin(Math.PI * b))))
  L.pose(groove(b, 0.015), range(b, 0, 8))
  // Zapateo: golpes secos con los dos pies, justo con la percusión.
  const zap = range(b, 8, 11.9, 0.2)
  const taps = [8, 8 + 2 / 3, 9, 9 + 2 / 3, 10, 10 + 2 / 3, 11, 11 + 2 / 3]
  taps.forEach((t, i) => {
    const s = (i % 2 ? -1 : 1) as 1 | -1
    L.pose(foot(s, 0.06 * arc(b, t - 0.3, t), 0.02 * arc(b, t - 0.3, t)))
    if (atB(c, 'cueca', t)) c.emitFrom(s > 0 ? 'footL' : 'footR', [0, 0.01, 0.03], 'puff', { vel: [s * 0.15, 0.12, 0.1], life: 0.45, size: 0.07, drag: 3 })
  })
  const tap = taps.reduce((m, t) => Math.max(m, b >= t ? hit(b - t, 9) : 0), 0)
  L.pose(P(body(-0.06, 0, 0, -0.02 * tap), gaze(0, -0.15)), zap)
  // Remate: se acerca, abre las alas y queda enamorada.
  const end = smooth(14.6, 15, b)
  L.pose(root(0, 0, 0, 0.06 * smooth(12, 13.5, b)))
  L.pose(P(A1(1, 0.85, 0.75), body(-0.08), head(-0.08, 0, 0.2), tail(0.3)), end)
  L.j('wingL', { ry: 0.25 * end, rx: 1.05 * end, rz: -0.5 * end }) // suelta la cintura
  L.pose(root(0.05 * arc(b, 14.5, 15.1)))
  if (atB(c, 'cueca', 15)) for (const dx of [-0.15, 0, 0.15]) heart(c, dx)
  notes(c, 'cueca', 14)
}

function stars(c: Ctx) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    c.emit('star', [Math.cos(a) * 0.2, 0.7 + Math.sin(a) * 0.2, 0.15], { vel: [Math.cos(a) * 0.6, Math.sin(a) * 0.6 + 0.2, 0.1], drag: 2.5, life: 0.9, size: 0.11, spin: 3 })
  }
}

// ——— Legendarios: encienden el aura (círculo de runas, columna de luz) y dejan estela ———

/** Chispas de luz en anillo alrededor de la mascota. */
function ring(c: Ctx, y: number, n = 8, r = 0.32, kind: 'sparkle' | 'star' = 'sparkle') {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    c.emit(kind, [Math.cos(a) * r, y, Math.sin(a) * r * 0.7], { vel: [Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.15], drag: 2, life: 1.1, size: kind === 'star' ? 0.1 : 0.09, spin: 2 })
  }
}

// ——— Paso lunar: presentación, deslizamiento hacia atrás, pirueta en puntillas, deslizamiento
// de costado, inclinación imposible y final ———
const moonwalk: DanceClip = (c, u) => {
  const b = (u * bpm('moonwalk')) / 60
  const L = c.L
  c.face(b > 22.8 ? 'love' : 'happy')
  const beam = 0.85 * range(b, 13.8, 16.2, 0.4) + range(b, 20, 23.6, 0.5)
  c.aura(smooth(0, 2, b), beam, ['#7aa2ff', '#eef3ff'])

  // 1) Presentación: un ala en la cadera, la otra abajo; cabeceo y golpecitos con la punta.
  const intro = range(b, 0, 3.8, 0.3)
  L.pose(P(HIP(1), POINT_DOWN(-1), gaze(0.15, 0.25), body(0, 0.05)), intro).pose(bob(b, 0.02), intro).pose(groove(b, 0.012), intro)
  for (const t of [1, 2, 3]) L.pose(foot(-1, 0.035 * arc(b, t - 0.4, t), 0.02), intro)
  if (atB(c, 'moonwalk', 3.5)) ring(c, 0.05, 6, 0.25)

  // 2) Paso lunar: un pie se desliza plano hacia atrás mientras el otro queda en puntas; se alternan.
  const mw = range(b, 4, 11.8, 0.3)
  const d = 0.055
  if (b >= 4 && b < 12) {
    const s = (Math.floor(b) % 2 ? 1 : -1) as 1 | -1
    const p = easeInOut(frac(b))
    L.pose(foot(s, 0.004, lerp(d, -d, p)), mw)
    L.pose(foot(-s, 0.045 * (1 - 0.6 * arc(frac(b), 0.8, 1.2)), lerp(-d, d, p)), mw)
  }
  for (let i = 4; i < 12; i++)
    if (atB(c, 'moonwalk', i + 0.5)) c.emitFrom(i % 2 ? 'footL' : 'footR', [0, 0.01, 0.02], 'sparkle', { vel: [0, 0.12, 0.25], life: 0.6, size: 0.06, drag: 2, spin: 3 })
  L.pose(root(0, 0, 0, -0.22 * smooth(4, 11.8, b) * (1 - smooth(16, 20, b))))
  L.pose(P(body(-0.06, 0, 0, 0.005), A(0.35, -0.7 + 0.25 * Math.sin(Math.PI * b), 0.35, -0.7 - 0.25 * Math.sin(Math.PI * b), 0.1), gaze(0, -0.08), tail(0.15)), mw)
  L.pose(bob(b, 0.012), mw)

  // 3) Pirueta en puntillas y pose con el ala al cielo.
  const toe = range(b, 12, 16, 0.3)
  L.pose(P(squash(0.05), root(0.035)), toe)
  L.pose(root(0, turns(easeInOut(clamp((b - 12.2) / 1.6)))))
  const spinArms = P(A(1.2, 0.3), gaze(0, -0.1))
  const pointSky = P(POINT_UP(-1), HIP(1), body(0, 0.1), gaze(-0.5, -0.4), tail(0.3))
  L.with(toe).seq(b, [[12, spinArms], [13.8, spinArms], [14.1, pointSky], [16, pointSky]], 'snap', 0.2)
  L.pose(beak(0.3 * arc(b, 14.1, 14.6)), toe)
  if (atB(c, 'moonwalk', 14.1)) {
    stars(c)
    ring(c, 0.4, 10, 0.36)
  }

  // 4) Deslizamiento de costado (ida y vuelta) que la devuelve al centro.
  const side = range(b, 16, 20, 0.3)
  const sx = Math.sin((Math.PI * (b - 16)) / 2)
  L.pose(root(0, 0, 0.13 * sx, 0), side)
  L.pose(P(body(0, -0.12 * sx), A(0.7, 0.2 + 0.4 * sx, 0.7, 0.2 - 0.4 * sx, 0.15), gaze(0.3 * sx, -0.1)), side)
  steps(L, 1, b, [[16, 0], [16.5, 0, 0.04], [17.5, 0, -0.02], [18.5, 0, 0.04], [19.5, 0, 0], [20, 0]], 0.35, 0.03)
  steps(L, -1, b, [[16, 0], [17, 0, 0.02], [18, 0, -0.04], [19, 0, 0.02], [20, 0]], 0.35, 0.03)

  // 5) Inclinación imposible: se va hacia adelante con los pies clavados… y vuelve.
  const lean = kf(b, [[20, 0], [21, 1], [22, 1], [22.6, 0]])
  L.pose(P(body(0.5, 0, 0, -0.02), neck(-0.35), head(-0.25), A(0.45, -0.5, 0.45, -0.5, 0.2), tail(0.45)), lean)
  if (atB(c, 'moonwalk', 21)) ring(c, 0.02, 12, 0.4)

  // 6) Final.
  L.pose(TADA, smooth(22.6, 23, b)).pose(root(0.07 * arc(b, 22.6, 23.3))).pose(squash(-0.05 * arc(b, 23.2, 23.6)))
  if (atB(c, 'moonwalk', 23)) {
    stars(c)
    for (const dx of [-0.15, 0.15]) heart(c, dx)
  }
  notes(c, 'moonwalk', 22)
}

// ——— Danza cósmica: levita, orbita flotando, gira entre estrellas, las atrapa y aterriza ———
const cosmic: DanceClip = (c, u) => {
  const b = (u * bpm('cosmic')) / 60
  const L = c.L
  c.face(b < 3 ? 'sleep' : b > 22.6 ? 'love' : 'happy')
  const beam = smooth(1.5, 4, b) * (0.55 + 0.45 * range(b, 12, 16.4, 0.5)) * (1 - smooth(21, 22.4, b)) + range(b, 22, 23.7, 0.3)
  c.aura(smooth(0, 1.5, b), beam, ['#b46bff', '#5fe3ff'])

  // Altura de vuelo: sube, flota con vaivén, sube más al girar y baja suave para aterrizar.
  const fly = kf(b, [[0.5, 0], [4, 0.12], [12, 0.12], [14, 0.2], [16.5, 0.14], [20, 0.12], [22, 0]])
  const hover = 0.025 * Math.sin((Math.PI * b) / 2) * range(b, 4, 21, 1)
  L.pose(root(fly + hover))
  // Las patas cuelgan relajadas mientras vuela.
  const air = smooth(1, 3, b) * (1 - smooth(21, 22, b))
  L.pose(P(foot(1, 0.025, -0.03, 0.01), foot(-1, 0.03 + 0.01 * Math.sin(Math.PI * b), -0.02, -0.01)), air)

  // 1) Despertar: las alas suben desde los costados.
  const wake = range(b, 0, 4.2, 0.4)
  const k = smooth(0, 3.6, b)
  L.pose(P(A(lerp(0.2, 1.3, k), lerp(-0.6, 1.0, k)), A(0, 0, 0, 0, 0.15), gaze(0, lerp(0.3, -0.35, k)), tail(0.2 * k)), wake)
  if (atB(c, 'cosmic', 3)) ring(c, 0.05, 10, 0.3)

  // 2) Órbita: da una vuelta a un círculo chico, nadando en el aire con las alas.
  const orb = range(b, 4, 12, 0.5)
  const th = TAU * smooth(4, 12, b)
  L.pose(root(0, 0.5 * Math.sin(th), 0.12 * Math.sin(th), 0.07 * (1 - Math.cos(th))), orb)
  const sw = Math.sin(Math.PI * b)
  L.pose(P(A(1.0, 0.3 + 0.6 * sw, 1.0, 0.3 + 0.6 * Math.sin(Math.PI * b - 0.8), 0.2), body(0.08 * sw, 0.06 * Math.cos(Math.PI * b)), tail(0.25, 0.3 * sw), gaze(0, -0.15)), orb)
  for (let i = 4; i < 12; i++)
    if (atB(c, 'cosmic', i + 0.5)) c.emit('sparkle', [0.25 * Math.sin(i), 0.5 + 0.1 * (i % 3), -0.1], { vel: [0, 0.18, 0], life: 1.0, size: 0.08, drag: 1, spin: 2 })

  // 3) Giro cósmico: dos vueltas con las alas en cruz y el cuerpo arqueado hacia atrás.
  const spin = range(b, 12, 16.3, 0.4)
  L.pose(P(A(1.5, 0.35), body(-0.15), gaze(0, -0.45), tail(0.4)), spin)
  L.pose(root(0, turns(easeInOut(clamp((b - 12.2) / 3.6)), 2)))
  if (atB(c, 'cosmic', 16)) {
    stars(c)
    ring(c, 0.5, 12, 0.42, 'star')
  }

  // 4) Atrapa estrellas: mira a un lado y al otro y junta las alas al frente en cada golpe.
  const catchW = range(b, 16.4, 20.4, 0.3)
  const side = Math.floor(b) % 2 ? 1 : -1
  const grab = b >= 16 && b < 20.5 ? hit(b, 4) : 0
  L.pose(P(A(lerp(1.1, 0.25, grab), lerp(0.4, -2.3, grab)), gaze(0.45 * side, -0.25), body(0.04, -0.08 * side)), catchW)
  for (const t of [17, 18, 19, 20])
    if (atB(c, 'cosmic', t)) c.emit('star', [0.18 * (t % 2 ? 1 : -1), 0.85, 0.2], { vel: [0.2 * (t % 2 ? 1 : -1), 0.3, 0.1], life: 0.9, size: 0.1, drag: 2, spin: 3 })

  // 5) Aterrizaje y pose final con las alas en V.
  L.pose(squash(-0.06 * arc(b, 21.9, 22.5)))
  L.pose(P(A(1.2, 1.45), body(-0.1), gaze(0, -0.35), tail(0.35)), smooth(22.3, 22.8, b))
  if (atB(c, 'cosmic', 22)) ring(c, 0.02, 14, 0.42)
  if (atB(c, 'cosmic', 23)) {
    stars(c)
    for (const dx of [-0.15, 0, 0.15]) heart(c, dx)
  }
  notes(c, 'cosmic', 21)
}

export const DANCE_CLIPS: Record<DanceId, DanceClip> = { salsa, spin, robot, disco, conga, cueca, moonwalk, cosmic }
