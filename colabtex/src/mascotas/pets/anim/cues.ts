import type { RigKind } from '../rig/types'
import type { Clip, Ctx, V3 } from './clip'
import { BOX_CUES, CAT_CUES } from './cat'
import { BODY, bubbles, drops, every, fromTop, heart, note, shakeAt, shower, skip, sparkles, zzz } from './effects'
import { A, CW, PECK, ROOST, beak, body, gaze, head, neck, rollBody, root, squash, tail } from './poses'
import { TAU, arc, backOut, env, hash, kf, smooth, spring } from './util'

export { TOP, every, heart, note } from './effects'

// Reacciones a los cuidados (comer, jugar, bañarse, dormir, abrigar, tocarla, negarse) y los cambios de
// etapa (nacer, aparecer). Cada una dura un tiempo fijo y se mezcla sobre el reposo.

export type CueId =
  | 'feed'
  | 'eat'
  | 'play'
  | 'pounce'
  | 'clean'
  | 'rinse'
  | 'potion'
  | 'sleep'
  | 'wake'
  | 'incubate'
  | 'poke'
  | 'refuse'
  | 'hatch'
  | 'appear'
  | 'dance'

export interface CueDef {
  dur: number
  /** Duración propia de alguna familia (si no, `dur`). */
  durs?: Partial<Record<RigKind, number>>
  /** Entrada y salida de la mezcla (s). */
  fin?: number
  fout?: number
  clips: Partial<Record<RigKind, Clip>>
  /** Se queda mirando hacia donde está (no se da vuelta al frente): comer en el suelo, atrapar. */
  stay?: boolean
}

/** Lluvia de granos que cae delante de la mascota. */
function grains(c: Ctx) {
  const T = c.rig.peckTarget
  if (!c.at(0.05)) return
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + c.k * 3
    const r = 0.03 + hash(i * 13 + Math.floor(c.k * 1000)) * 0.07
    c.emit('grain', [T[0] + Math.cos(a) * r, 0.5 + i * 0.05, T[2] + Math.sin(a) * r * 0.6], {
      vel: [0, -0.2, 0],
      gravity: -4,
      ground: true,
      life: 3.4 - i * 0.05,
      size: 0.065,
      delay: i * 0.06,
      spin: (i % 2 ? 1 : -1) * 4,
    })
  }
}

/** Picotones a tiempos fijos: devuelve cuánto baja la cabeza (0–1) y se come un grano en cada uno. */
function pecks(c: Ctx, times: number[]) {
  let dip = 0
  for (const t0 of times) {
    if (c.u > t0 && c.u < t0 + 0.22) dip = Math.sin((Math.PI * (c.u - t0)) / 0.22)
    if (c.at(t0 + 0.11)) {
      c.sound('peck')
      c.take('grain', c.rig.peckTarget, 0.25)
    }
  }
  return dip
}

const PECKS = [0.8, 1.25, 1.7, 2.15, 2.6]

/** Comer: con `shower` le caen los granos del cielo (estudio); sin él, picotea los que ya hay en el suelo. */
function feedCue(shower: boolean): CueDef {
  return {
    dur: 3.6,
    clips: {
      hen(c) {
        if (shower) grains(c)
        const dip = pecks(c, PECKS)
        const lean = smooth(0.35, 0.75, c.u) * (1 - smooth(2.85, 3.2, c.u))
        c.L.pose(PECK, lean * (0.62 + 0.38 * dip)).pose(gaze(0, 0.25 * smooth(0.1, 0.4, c.u) * (1 - lean)))
        // Al final: se endereza, cacarea contenta y suelta un corazón.
        const open = arc(c.u, 3.05, 3.3)
        c.L.pose(beak(open * 0.3)).pose(head(-0.15 * smooth(2.9, 3.2, c.u)))
        if (c.at(3.05)) c.sound('cluck')
        if (c.at(3.1)) heart(c)
        if (c.u > 2.9) c.face('happy')
      },
      chick(c) {
        if (shower) grains(c)
        const dip = pecks(c, PECKS)
        const lean = smooth(0.4, 0.75, c.u) * (1 - smooth(2.85, 3.15, c.u))
        c.L.pose(rollBody(0, lean * (0.3 + 0.16 * dip), c.R)).j('head', { rx: lean * (0.25 + 0.15 * dip) })
        const hop = arc(c.u, 3.1, 3.45)
        c.L.pose(root(hop * 0.06)).pose(CW(hop * 0.5))
        if (c.at(3.05)) c.sound('peep')
        if (c.at(3.1)) heart(c)
        if (c.u > 2.9) c.face('happy')
      },
    },
  }
}

/**
 * Poción eterna: aparece un frasco sobre la mascota, se inclina y le derrama el líquido morado
 * encima; la mascota brilla, se llena de destellos y da un saltito feliz.
 */
function potionClip(c: Ctx) {
  const { c: p, r } = BODY[c.kind]
  const top = p[1] + r * 2.3
  // El frasco, a un costado y arriba: gira hacia la mascota mientras vierte.
  // (No en 0: al empezar el clip todavía está entrando y `at` no dispara.)
  if (c.at(0.12)) {
    c.emit('potion', [p[0] + r * 0.75, top, p[2] + 0.1], { vel: [0, 0, 0], gravity: 0, life: 1.9, size: 0.34, spin: 1.25 })
    c.sound('pop')
  }
  // Chorro de gotas moradas que cae sobre la cabeza.
  every(c, 0.55, 1.7, 0.03, (i) => {
    const h = (n: number) => hash(i * 13 + n)
    c.emit('pdrop', [p[0] + r * 0.3 + (h(1) - 0.5) * r * 0.5, top - 0.08, p[2] + 0.1 + (h(2) - 0.5) * 0.08], {
      vel: [-0.35 - h(3) * 0.3, -0.6, 0],
      gravity: -5,
      life: 0.55,
      size: 0.05 + h(4) * 0.03,
    })
  })
  if (c.at(0.6)) c.sound('splash')
  // Destellos y estrellitas alrededor del cuerpo mientras le hace efecto.
  every(c, 1.1, 2.7, 0.07, (i) => {
    const h = (n: number) => hash(i * 7 + n)
    const a = h(1) * TAU
    c.emit(i % 3 ? 'sparkle' : 'star', [p[0] + Math.cos(a) * r * 1.1, p[1] + (h(2) - 0.3) * r * 1.6, p[2] + Math.sin(a) * r * 0.6 + 0.1], {
      vel: [0, 0.35 + h(3) * 0.3, 0],
      life: 0.8,
      size: 0.07 + h(4) * 0.05,
    })
  })
  if (c.at(1.15)) c.sound('magic')
  const u = c.u
  c.glow(0.9 * smooth(0.9, 1.4, u) * (1 - smooth(2.4, 3.2, u)))
  c.face(u < 0.6 ? 'normal' : u < 1.3 ? 'surprised' : 'happy')
  // Se encoge al mojarse y después da un saltito.
  const hop = arc(u, 2.0, 2.5)
  c.L.pose(squash(-0.08 * smooth(0.6, 0.75, u) * (1 - smooth(1.2, 1.5, u)) + 0.05 * hop)).pose(root(0.12 * hop))
}

export const CUES: Record<Exclude<CueId, 'dance'>, CueDef> = {
  potion: { dur: 3.2, fin: 0.1, clips: { hen: potionClip, chick: potionClip, egg: potionClip, cat: potionClip, box: potionClip } },

  feed: feedCue(true),
  // Come los granos que le lanzaron (ya están en el suelo, delante del pico).
  eat: { ...feedCue(false), stay: true },

  play: {
    dur: 3.2,
    clips: {
      hen(c) {
        const u = c.u
        c.face('happy')
        // Dos saltos aleteando; en el segundo da una vuelta completa en el aire.
        const h1 = arc(u, 0.38, 0.82)
        const h2 = arc(u, 1.4, 2.2)
        const turn = smooth(1.4, 2.2, u)
        const crouch = -0.1 * arc(u, 0.12, 0.4) - 0.1 * arc(u, 0.78, 1.0) - 0.12 * arc(u, 1.12, 1.42) - 0.14 * arc(u, 2.15, 2.45)
        const open = smooth(0.3, 0.42, u) * (1 - smooth(0.8, 0.95, u)) + smooth(1.32, 1.45, u) * (1 - smooth(2.15, 2.35, u))
        const flap = Math.sin(TAU * 5.5 * u)
        c.L.pose(root(h1 * 0.1 + h2 * 0.17, turn < 1 ? TAU * turn : 0))
          .pose(squash(crouch + 0.05 * (h1 + h2)))
          .pose(A(1.2 * open, open * (0.35 + 0.65 * flap), 1.2 * open, open * (0.35 + 0.65 * flap), 0.15 * open))
          .pose(body(-0.16 * open))
          .pose(head(-0.18 * open))
          .pose(tail(0.3 * open))
        // Remate: cacarea feliz moviendo la colita.
        const end = smooth(2.4, 2.6, u)
        c.L.pose(beak(0.3 * (arc(u, 2.5, 2.68) + arc(u, 2.75, 2.93)))).pose(tail(0.15 * end, 0.25 * end * Math.sin(TAU * 4 * u)))
        if (c.at(0.38) || c.at(1.4)) c.sound('boing')
        if (c.at(2.5)) c.sound('cluck')
        every(c, 0.6, 3, 0.8, (i) => note(c, i))
      },
      chick(c) {
        const u = c.u
        c.face('happy')
        const h1 = arc(u, 0.3, 0.7)
        const h2 = arc(u, 0.95, 1.35)
        const h3 = arc(u, 1.7, 2.5)
        const turn = smooth(1.7, 2.5, u)
        const crouch = -0.14 * (arc(u, 0.1, 0.32) + arc(u, 0.68, 0.98) + arc(u, 1.35, 1.72) + arc(u, 2.45, 2.75))
        c.L.pose(root(h1 * 0.12 + h2 * 0.12 + h3 * 0.2, turn < 1 ? TAU * turn : 0))
          .pose(squash(crouch + 0.1 * (h1 + h2 + h3)))
          .pose(CW((h1 + h2 + h3) * (0.6 + 0.4 * Math.sin(TAU * 8 * u))))
          .j('head', { rx: -0.15 * (h1 + h2 + h3) })
        const wig = smooth(2.7, 2.85, u)
        c.L.pose(rollBody(0.12 * wig * Math.sin(TAU * 3 * u), 0, c.R)).pose(beak(0.4 * arc(u, 2.75, 2.95)))
        if (c.at(0.3) || c.at(0.95) || c.at(1.7)) c.sound('boing')
        if (c.at(2.75)) c.sound('peep')
        every(c, 0.5, 3, 0.8, (i) => note(c, i))
      },
    },
  },

  clean: {
    dur: 3.8,
    clips: {
      hen(c) {
        const u = c.u
        bubbles(c, 0.05, 1.9)
        // Mojada: se le aplastan las plumas y cierra los ojos tranquila.
        const wet = smooth(0.1, 0.5, u) * (1 - smooth(1.95, 2.15, u))
        c.L.pose(
          {
            body: { sy: -0.03, sx: -0.03, rz: 0.05 * Math.sin(TAU * 0.9 * u) },
            head: { rz: 0.12 * Math.sin(TAU * 0.9 * u + 1), rx: 0.08 },
            tail: { rx: -0.35 },
          },
          wet,
        ).pose(A(0.12, 0.1, 0.12, 0.1, 0.12), wet)
        if (u < 2) c.face('happy')
        // Sacudón: el cuerpo gira para un lado y la cabeza para el otro, gotas para todos lados.
        const s = shakeAt(u, 2.0, 2.85)
        const e = env(u - 2.0, 0.85, 0.08, 0.25)
        c.L.pose(body(0, 0.06 * s, 0.22 * s))
          .pose(gaze(-0.5 * s, 0, 0.2 * s))
          .pose(tail(0.15 * e, 0.6 * s))
          .pose(A(0.25 * e, 0.15 * e, 0.25 * e, 0.15 * e, 0.3 * e))
          .pose(root(0.02 * arc(u, 2.0, 2.3)))
        if (c.at(2.0)) c.sound('splash')
        drops(c, 2.05, 2.7)
        if (u >= 2 && u < 2.9) c.face('dizzy')
        // Esponjada y brillante.
        const puff = smooth(2.85, 3.1, u) * (1 - smooth(3.5, 3.8, u))
        c.L.j('body', { sx: 0.05 * puff, sz: 0.04 * puff }).pose(tail(0.12 * puff))
        sparkles(c, 2.95)
        if (u > 2.9) c.face('happy')
      },
      chick(c) {
        const u = c.u
        bubbles(c, 0.05, 1.9)
        const wet = smooth(0.1, 0.5, u) * (1 - smooth(1.95, 2.15, u))
        c.L.pose(rollBody(0.06 * Math.sin(TAU * 0.9 * u), 0, c.R), wet)
          .j('body', { sy: -0.05 * wet, sx: -0.02 * wet, sz: -0.02 * wet })
          .j('head', { rz: 0.1 * wet * Math.sin(TAU * 0.9 * u + 1) })
        if (u < 2) c.face('happy')
        const s = shakeAt(u, 2.0, 2.8)
        c.L.j('body', { ry: 0.3 * s }).j('head', { ry: -0.35 * s }).pose(CW(0.3 * Math.abs(s)))
        if (c.at(2.0)) c.sound('splash')
        drops(c, 2.05, 2.65)
        if (u >= 2 && u < 2.85) c.face('dizzy')
        const puff = smooth(2.85, 3.1, u) * (1 - smooth(3.5, 3.8, u))
        c.L.j('body', { sx: 0.07 * puff, sz: 0.07 * puff, sy: 0.03 * puff })
        sparkles(c, 2.95)
        if (u > 2.9) c.face('happy')
      },
      egg(c) {
        const u = c.u
        bubbles(c, 0.05, 2.2)
        c.L.pose(rollBody(0.06 * Math.sin(TAU * 1.2 * u) * env(u, 2.4, 0.3, 0.3), 0, c.R))
        // Se seca girando como trompo y queda brillando.
        const spin = smooth(2.3, 3.1, u)
        c.L.pose(root(0.04 * arc(u, 2.3, 3.1), spin < 1 ? TAU * spin : 0))
        sparkles(c, 3.0, 6)
      },
    },
  },

  // Después de la esponja: le cae el agua del enjuague, se sacude y queda esponjada (el final del baño).
  rinse: {
    dur: 2.5,
    fin: 0.1,
    clips: {
      hen(c) {
        shower(c, 0, 0.55)
        skip(CUES.clean.clips.hen!, 1.35)(c)
      },
      chick(c) {
        shower(c, 0, 0.55)
        skip(CUES.clean.clips.chick!, 1.35)(c)
      },
      egg(c) {
        shower(c, 0, 0.6)
        skip(CUES.clean.clips.egg!, 1.6)(c)
      },
    },
  },

  // Jugando con el gusanito: se agazapa, salta encima y lo agarra con el pico; después lo sacude, feliz.
  pounce: {
    dur: 1.5,
    fin: 0.08,
    stay: true,
    clips: {
      hen(c) {
        const u = c.u
        const crouch = smooth(0, 0.22, u) * (1 - smooth(0.24, 0.3, u))
        const leap = arc(u, 0.28, 0.66)
        const reach = smooth(0.26, 0.4, u) * (1 - smooth(0.6, 0.85, u))
        const wings = smooth(0.24, 0.32, u) * (1 - smooth(0.62, 0.8, u))
        c.L.pose(squash(-0.1 * crouch - 0.1 * arc(u, 0.64, 0.82) + 0.05 * leap))
          .pose(body(0.22 * crouch, 0, 0, -0.03 * crouch))
          .pose(tail(0.35 * crouch + 0.2 * leap, 0.4 * crouch * Math.sin(TAU * 6 * u)))
          .pose(root(0.12 * leap))
          .pose(PECK, 0.75 * reach)
          .pose(A(1.1 * wings, wings * (0.4 + 0.6 * Math.sin(TAU * 6 * u)), 1.1 * wings, wings * (0.4 + 0.6 * Math.sin(TAU * 6 * u)), 0.2 * wings))
        // Pico: se abre en el aire y se cierra sobre el gusanito.
        c.L.pose(beak(0.4 * smooth(0.28, 0.38, u) * (1 - smooth(0.42, 0.46, u))))
        // Lo sacude de lado a lado, orgullosa.
        const shake = Math.sin(TAU * 4 * (u - 0.85)) * env(u - 0.85, 0.6, 0.08, 0.2)
        c.L.pose(gaze(0.55 * shake, -0.1 * smooth(0.8, 0.95, u)))
        if (c.at(0.28)) c.sound('boing')
        if (c.at(0.95)) c.sound('cluck')
        if (c.at(1.0)) heart(c)
        c.face(u < 0.3 ? 'surprised' : 'happy')
      },
      chick(c) {
        const u = c.u
        const crouch = smooth(0, 0.2, u) * (1 - smooth(0.22, 0.28, u))
        const leap = arc(u, 0.26, 0.62)
        const reach = smooth(0.26, 0.4, u) * (1 - smooth(0.6, 0.85, u))
        c.L.pose(squash(-0.14 * crouch - 0.12 * arc(u, 0.6, 0.8) + 0.08 * leap))
          .pose(root(0.14 * leap))
          .pose(rollBody(0, 0.22 * crouch + 0.35 * reach, c.R))
          .j('head', { rx: 0.25 * reach })
          .pose(CW(0.3 * crouch + leap * (0.7 + 0.3 * Math.sin(TAU * 9 * u))))
          .pose(beak(0.45 * smooth(0.26, 0.36, u) * (1 - smooth(0.4, 0.45, u))))
        const shake = Math.sin(TAU * 4.5 * (u - 0.8)) * env(u - 0.8, 0.6, 0.08, 0.2)
        c.L.pose(rollBody(0.08 * shake, 0, c.R)).j('head', { ry: 0.45 * shake })
        if (c.at(0.26)) c.sound('boing')
        if (c.at(0.9)) c.sound('peep')
        if (c.at(0.95)) heart(c)
        c.face(u < 0.28 ? 'surprised' : 'happy')
      },
    },
  },

  // Acostarla: bosteza, cabecea y se echa a dormir. Termina en la misma pose del sueño (idle.ts),
  // así la mezcla pasa al dormir continuo sin saltos.
  sleep: {
    dur: 2.8,
    durs: { cat: 3.2 },
    fout: 0.6,
    clips: {
      hen(c) {
        const u = c.u
        const yawn = env(u, 1.25, 0.3, 0.35)
        c.L.pose(beak(kf(u, [[0, 0], [0.3, 0.34], [0.85, 0.34], [1.15, 0]])))
          .pose(gaze(0, -0.5 * yawn))
          .pose(A(0.35 * yawn, -0.2 * yawn, 0.35 * yawn, -0.2 * yawn, 0.2 * yawn))
          .j('body', { sy: 0.03 * yawn, rx: -0.08 * yawn })
        if (c.at(0.15)) c.sound('yawn')
        // Cabecea un par de veces y se acomoda (se esponja al echarse).
        const doze = smooth(1.1, 1.9, u)
        const nod = Math.sin(TAU * 1.2 * (u - 1.1)) * env(u - 1.1, 1.1, 0.2, 0.4)
        const fluff = arc(u, 1.7, 2.2)
        c.L.pose(ROOST, doze).pose(neck(0.3 + 0.12 * nod, 0, 0), doze).pose(head(0.35, 0, 0.12), doze).pose(A(0, 0, 0, 0, -0.03), doze)
        c.L.j('body', { sx: 0.05 * fluff, sz: 0.05 * fluff, sy: 0.03 * fluff })
        zzz(c, 2.0, 2.8)
        if (u > 1.0) c.face('sleep')
      },
      chick(c) {
        const u = c.u
        const yawn = env(u, 1.2, 0.3, 0.35)
        c.L.pose(beak(kf(u, [[0, 0], [0.3, 0.42], [0.85, 0.42], [1.1, 0]])))
          .j('head', { rx: -0.3 * yawn })
          .pose(CW(0.5 * yawn))
          .pose(squash(0.06 * yawn))
        if (c.at(0.15)) c.sound('yawn')
        const doze = smooth(1.1, 1.7, u)
        const nod = Math.sin(TAU * 1.3 * (u - 1.1)) * env(u - 1.1, 1.0, 0.2, 0.4)
        c.L.j('body', { py: -0.04 * doze, sy: -0.09 * doze, sx: 0.05 * doze, sz: 0.05 * doze }).j('head', { rx: (0.32 + 0.1 * nod) * doze, rz: 0.15 * doze })
        zzz(c, 1.9, 2.8)
        if (u > 1.0) c.face('sleep')
      },
    },
  },

  // Despertar: sale de la pose de dormir, abre los ojos, se estira y se sacude.
  wake: {
    dur: 2.7,
    fin: 0.05,
    clips: {
      hen(c) {
        const u = c.u
        const doze = 1 - smooth(0.35, 0.9, u)
        c.L.pose(ROOST, doze).pose(neck(0.3, 0, 0), doze).pose(head(0.35, 0, 0.12), doze).pose(A(0, 0, 0, 0, -0.03), doze)
        // Estirón: cuello arriba, alas abiertas, pico en bostezo.
        const st = env(u - 0.8, 1.0, 0.3, 0.35)
        c.L.pose(neck(-0.3 * st)).pose(head(-0.25 * st)).pose(A(0.85 * st, 0.5 * st, 0.85 * st, 0.5 * st, 0.3 * st))
          .j('body', { sy: 0.05 * st, rx: -0.1 * st })
          .pose(tail(0.3 * st))
          .pose(beak(0.3 * env(u - 0.85, 0.8, 0.2, 0.3)))
        if (c.at(0.9)) c.sound('yawn')
        // Sacudón de plumas y lista.
        const s = shakeAt(u, 1.9, 2.5)
        c.L.pose(body(0, 0.05 * s, 0.14 * s)).pose(gaze(-0.35 * s)).pose(A(0.1 * Math.abs(s), 0, 0.1 * Math.abs(s), 0, 0.2 * Math.abs(s)))
        if (c.at(2.0)) {
          c.sound('cluck')
          for (let i = 0; i < 4; i++) c.emitFrom('body', [(i - 1.5) * 0.12, 0.45, -0.05], 'sparkle', { vel: [(i - 1.5) * 0.25, 0.4, 0.1], life: 0.6, size: 0.07 })
        }
        c.face(u < 0.55 ? 'sleep' : u < 0.85 ? 'surprised' : u < 1.85 ? 'sleep' : 'happy')
      },
      chick(c) {
        const u = c.u
        const doze = 1 - smooth(0.35, 0.8, u)
        c.L.j('body', { py: -0.04 * doze, sy: -0.09 * doze, sx: 0.05 * doze, sz: 0.05 * doze }).j('head', { rx: 0.32 * doze, rz: 0.15 * doze })
        const st = env(u - 0.8, 0.9, 0.25, 0.3)
        c.L.pose(squash(0.1 * st)).pose(CW(1.1 * st)).j('head', { rx: -0.3 * st })
          .pose(beak(0.4 * env(u - 0.85, 0.7, 0.2, 0.3)))
        if (c.at(0.9)) c.sound('yawn')
        // Saltito de "¡buen día!".
        const hop = arc(u, 1.95, 2.35)
        c.L.pose(root(0.08 * hop)).pose(CW(0.7 * hop)).pose(squash(-0.06 * arc(u, 2.35, 2.55)))
        if (c.at(1.95)) {
          c.sound('peep')
          fromTop(c, 'sparkle', { vel: [0.15, 0.4, 0.05], life: 0.7, size: 0.08 })
        }
        c.face(u < 0.5 ? 'sleep' : u < 0.8 ? 'surprised' : u < 1.7 ? 'sleep' : 'happy')
      },
    },
  },

  incubate: {
    dur: 3.2,
    clips: {
      egg(c) {
        const u = c.u
        c.glow(0.7 * env(u, 3.2, 0.6, 0.9))
        if (c.at(0.05)) c.sound('warm')
        // Se acurruca al calorcito y luego se mece feliz.
        c.L.j('body', { sy: -0.03 * env(u, 1.6, 0.4, 0.5), sx: 0.015 * env(u, 1.6, 0.4, 0.5), sz: 0.015 * env(u, 1.6, 0.4, 0.5) })
        c.L.pose(rollBody(0.1 * Math.sin(TAU * 2.2 * u) * env(u - 1.6, 1.4, 0.2, 0.3), 0, c.R))
        every(c, 0.5, 2.7, 0.7, (i) => heart(c, (i % 2 ? -1 : 1) * 0.12))
      },
    },
  },

  poke: {
    dur: 1.3,
    fin: 0.04,
    clips: {
      hen(c) {
        const u = c.u
        // ¡Ay! Da un saltito con las alas abiertas y después se ríe.
        const e = env(u, 0.95, 0.05, 0.45)
        const j = arc(u, 0.02, 0.36)
        c.L.pose(root(0.07 * j))
          .pose(A(0.9 * e, 0.5 * e, 0.9 * e, 0.5 * e, 0.3 * e))
          .pose(body(-0.12 * e))
          .pose(gaze(0, -0.35 * e))
          .pose(tail(0.35 * e))
          .pose(beak(0.3 * arc(u, 0.04, 0.34)))
        if (c.at(0.02)) c.sound('cluck')
        c.face(u < 0.55 ? 'surprised' : 'happy')
        if (c.at(0.75)) heart(c)
      },
      chick(c) {
        const u = c.u
        const j = arc(u, 0.05, 0.42)
        c.L.pose(root(0.1 * j))
          .pose(squash(-0.12 * arc(u, 0, 0.08) + 0.1 * j - 0.12 * arc(u, 0.4, 0.58)))
          .pose(CW(0.8 * env(u, 0.8, 0.05, 0.4)))
          .pose(beak(0.4 * arc(u, 0.05, 0.3)))
        if (c.at(0.03)) c.sound('peep')
        c.face(u < 0.55 ? 'surprised' : 'happy')
        if (c.at(0.75)) heart(c)
      },
      egg(c) {
        const u = c.u
        c.L.pose(rollBody(0.14 * spring(u, 2.2, 3.5) * (1 - smooth(1.0, 1.3, u)), 0, c.R)).pose(squash(-0.06 * arc(u, 0, 0.15) + 0.04 * arc(u, 0.15, 0.4), 'body'))
        if (c.at(0.02)) c.sound('knock')
      },
    },
  },

  refuse: {
    dur: 1.5,
    fin: 0.1,
    clips: {
      hen(c) {
        const u = c.u
        // "No, gracias": niega con la cabeza, alas a la cintura, y sacude la cola al final.
        const e = env(u, 1.5, 0.12, 0.35)
        const no = Math.sin(TAU * 2.6 * u) * env(u, 1.1, 0.1, 0.3)
        c.L.pose(gaze(0.85 * no, 0.12 * e, -0.08 * e))
          .pose(body(-0.06 * e, 0, -0.1 * no))
          .pose(A(0.2 * e, 0.12 * e, 0.2 * e, 0.12 * e))
          .pose(tail(0.15 * e, 0.4 * Math.sin(TAU * 4 * u) * arc(u, 1.0, 1.45)))
        if (c.at(0.05)) c.sound('cluck')
        c.face('angry')
      },
      chick(c) {
        const u = c.u
        const e = env(u, 1.5, 0.12, 0.35)
        const no = Math.sin(TAU * 2.6 * u) * env(u, 1.1, 0.1, 0.3)
        // Todo el cuerpo dice que no (no tiene cuello) y patalea con las alitas.
        c.L.pose(root(0, 0.45 * no))
          .pose(rollBody(0.06 * no, 0, c.R))
          .pose(CW(0.25 * e + 0.15 * Math.abs(no)))
          .pose(squash(-0.04 * e))
        if (c.at(0.05)) c.sound('peep')
        c.face('angry')
      },
      egg(c) {
        const u = c.u
        c.L.pose(rollBody(0.08 * Math.sin(TAU * 2.6 * u) * env(u, 1.1, 0.1, 0.3), 0, c.R))
      },
    },
  },

  hatch: {
    dur: 1.5,
    fin: 0.05,
    fout: 0.05,
    clips: {
      chick(c) {
        const u = c.u
        // Está por crecer: tiembla cada vez más, brilla y se infla hasta que ¡pop!
        const k = 0.3 + 0.7 * smooth(0, 1.3, u)
        c.glow(0.9 * smooth(0.2, 1.4, u))
        c.L.pose(root(0.05 * k * Math.abs(Math.sin(TAU * 3 * u)), 0.12 * k * Math.sin(TAU * 5 * u)))
          .pose(squash(0.05 * k * Math.sin(TAU * 7 * u) + 0.14 * smooth(1.15, 1.5, u)))
          .pose(CW(0.3 + 0.5 * k * Math.abs(Math.sin(TAU * 4 * u))))
        for (const t of [0.05, 0.6, 1.1]) if (c.at(t)) c.sound('peep')
        every(c, 0.3, 1.5, 0.3, () => sparkles(c, c.u, 3))
        c.face(u < 0.8 ? 'surprised' : 'happy')
      },
      egg(c) {
        const u = c.u
        // Cada vez más fuerte: golpes desde adentro hasta que revienta.
        const k = 0.3 + 0.7 * smooth(0, 1.3, u)
        c.L.pose(rollBody(0.13 * k * Math.sin(TAU * 7 * u), 0, c.R)).pose(root(0.05 * k * Math.abs(Math.sin(TAU * 3.5 * u))))
        c.L.pose(squash(0.08 * smooth(1.25, 1.5, u), 'body'))
        for (const t of [0.1, 0.4, 0.62, 0.82, 1.0, 1.15, 1.28, 1.4]) if (c.at(t)) c.sound('knock')
        every(c, 0.6, 1.5, 0.3, () => sparkles(c, c.u, 2))
      },
    },
  },

  appear: {
    dur: 1.4,
    fin: 0.0001,
    fout: 0.1,
    clips: {
      chick: appear,
      hen: appear,
    },
  },
}

function appear(c: Ctx) {
  const u = c.u
  // ¡Pop! Crece con rebote, vuelan pedazos de cáscara (o estrellitas, si ya era pollito).
  const g = u < 0.55 ? backOut(u / 0.55, 2.4) - 1 : 0
  c.L.j('root', { sx: g, sy: g, sz: g })
  if (c.at(0.0001)) {
    c.sound('pop')
    const shell = c.kind === 'chick'
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3
      const p: V3 = [Math.cos(a) * 0.25, 0.35, Math.sin(a) * 0.2 + 0.05]
      if (shell) c.emit('shell', p, { vel: [Math.cos(a) * 1.0, 1.4, Math.sin(a) * 0.7], gravity: -5, ground: true, life: 1.4, size: 0.12, spin: (i % 2 ? 1 : -1) * 6 })
      else c.emit('star', p, { vel: [Math.cos(a) * 0.8, 0.9, Math.sin(a) * 0.5], drag: 2, life: 1, size: 0.12, spin: 3 })
    }
  }
  if (c.at(0.55)) c.sound(c.kind === 'chick' ? 'peep' : 'cluck')
  c.L.pose(c.kind === 'chick' ? CW(0.7 * arc(u, 0.4, 1.1)) : A(1 * arc(u, 0.4, 1.1), 0.6 * arc(u, 0.4, 1.1)))
  c.L.pose(beak(0.35 * arc(u, 0.55, 0.75)))
  c.face(u < 0.5 ? 'surprised' : 'happy')
}

// El gato y la caja traen sus propias reacciones (anim/cat.ts).
for (const [fam, clips] of [
  ['cat', CAT_CUES],
  ['box', BOX_CUES],
] as const)
  for (const [id, clip] of Object.entries(clips)) CUES[id as Exclude<CueId, 'dance'>].clips[fam] = clip

/** Instante del cue `pounce` en que el pico se cierra sobre el gusanito. */
export const POUNCE_BITE = 0.43
