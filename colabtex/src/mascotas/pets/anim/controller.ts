import * as THREE from 'three'
import { play, type SoundId } from '../../audio/sound'
import { danceSeconds, getDance, type DanceId } from '../../data/accessories'
import { Fx, type EmitOptions, type FxKind } from '../fx'
import type { Expression } from '../rig/face'
import type { JointName, PetRig } from '../rig/types'
import type { Ctx, V3 } from './clip'
import { catDance, catScrub, catWatch, boxScrub } from './cat'
import { CUES, POUNCE_BITE, TOP, type CueId } from './cues'
import { DANCE_CLIPS } from './dances'
import { IDLE_CLIPS, LOOK, LookAround, blinkAt, breathe, moodLayers, nextIdle, roamAt, walkTo, type IdleEnv, type IdleItem } from './idle'
import { PoseMix, Poser } from './pose'
import { A, CW, gaze, rollBody, tail } from './poses'
import { Layer, TAU, Timeline, clamp, env, hash, lerpAngle } from './util'

// Director de animación de una mascota: mezcla el reposo (respirar, mirar, picotear, pasear…),
// el ánimo (triste, dormida) y las reacciones/bailes, y maneja sus partículas y sonidos.
// Es determinista: con el mismo reloj y las mismas órdenes da siempre la misma pose (el estudio
// puede saltar a cualquier instante).

export interface AnimInput {
  sleeping: boolean
  sad: boolean
  dirt: number
  growth: number
  roam: boolean
  /** Si suena (solo la mascota que se está mirando). */
  voice: boolean
  /** Atenta a quien la cuida (con granos, esponja o juguete en la mano): no se pone a pasear. */
  busy?: boolean
  /** Cuánto la están frotando con la esponja ahora (0–1). */
  scrub?: number
  /** Juguete que persigue (espacio de la mascota), o null. */
  lure?: V3 | null
}

export interface AnimOutput {
  /** Cara pedida por la acción en curso (null = la del ánimo). */
  expression: Expression | null
  /** Ojos: 1 abiertos, 0 cerrados. */
  blink: number
  /** Brillo cálido (huevo abrigado). */
  glow: number
  /** Objeto en la mano. */
  prop: string | null
  /** Aura legendaria: círculo de runas (0–1), columna de luz (0–1) y sus colores. */
  aura: number
  beam: number
  auraColor: [string, string] | null
  /** Veces que atrapó el juguete (sube en el instante del picotón). */
  caught: number
}

interface CueRun {
  id: CueId
  dance?: DanceId
  t0: number
  dur: number
  fin: number
  fout: number
  started: boolean
  /** Se queda mirando hacia donde está. */
  stay: boolean
  /** La agregó una caminata (`goTo` con `then`): se rehace al re-simular. */
  auto?: boolean
}

interface Goto {
  t0: number
  x: number
  z: number
  reach: number
  pace: number
  then?: CueId
  started: boolean
}

const ROUND_R = { egg: 0.32, chick: 0.43, hen: 0, box: 0.32, cat: 0 }
const DT = 1 / 30

export class Animator {
  readonly mix = new PoseMix()
  /** Baile de la gallina antes de pasarlo al gato. */
  private danceMix = new PoseMix()
  readonly fx = new Fx()
  private poser: Poser
  private idle: Timeline<IdleItem>
  private look: LookAround
  private cues: CueRun[] = []
  private gotos: Goto[] = []
  private forced: { dur: number; stay: boolean } | null = null
  private walking: Goto | null = null
  /** Persecución del juguete: adónde va, cuándo decidió y si ya puede volver a abalanzarse. */
  private chase = { x: 0, z: 0, at: -9, near: 0, last: -9, armed: true, cx: 0, cz: 0 }
  private t: number | null = null
  private origin = 0
  private sleepW = 0
  private sadW = 0
  private inp: AnimInput = { sleeping: false, sad: false, dirt: 0, growth: 0, roam: true, voice: false }
  private silent = false
  private out: AnimOutput = { expression: null, blink: 1, glow: 0, prop: null, aura: 0, beam: 0, auraColor: null, caught: 0 }
  private faceW = 0
  private yaw = 0
  private pos = { x: 0, z: 0 }
  private v = new THREE.Vector3()

  constructor(
    private rig: PetRig,
    private seed: number,
    /** Escala de la etapa: las partículas se agrandan en las mascotas chicas para que se lean igual. */
    private scale = 1,
  ) {
    this.poser = new Poser(rig)
    this.idle = new Timeline<IdleItem>((prev, i) => this.nextItem(prev, i))
    this.look = new LookAround(rig.kind, seed)
    this.fx.swap = rig.swap?.fx ?? {}
  }

  private envOf(): IdleEnv {
    const { sleeping, sad, roam, growth, busy } = this.inp
    return { seed: this.seed, sleeping, sad, roam, growth, busy, young: this.rig.young }
  }

  private nextItem(prev: IdleItem | undefined, i: number): IdleItem {
    if (prev && this.forced != null) {
      // Durante una reacción: quieta donde está, girando para mirar al frente (o no, si la reacción es ahí).
      const { dur, stay } = this.forced
      this.forced = null
      return { t0: prev.t0 + prev.dur, dur, act: 'rest', k: 0, x0: prev.x1, z0: prev.z1, yaw0: prev.yaw1, x1: prev.x1, z1: prev.z1, yaw1: stay ? prev.yaw1 : 0 }
    }
    if (prev && this.walking) {
      const g = this.walking
      this.walking = null
      const it = walkTo(this.rig.kind, prev, g.x, g.z, { reach: g.reach, pace: g.pace, k: hash(i * 7 + this.seed) })
      // Al llegar, hace lo que iba a hacer (comer los granos).
      if (g.then) this.pushCue(g.then, it.t0 + it.dur, undefined, true)
      return it
    }
    return nextIdle(this.rig.kind, prev, i, this.envOf())
  }

  /** Corta el reposo en `t` dejando a la mascota donde está (aunque vaya caminando). */
  private cutIdle(t: number) {
    const it = this.idle.at(t)
    const p = roamAt(it, t - it.t0)
    this.idle.cut(t)
    it.x1 = p.x
    it.z1 = p.z
    it.yaw1 = p.yaw
  }

  /**
   * Camina hasta (x, z) (espacio de la mascota) a partir de `t0`. Con `reach` se para a esa distancia
   * mirando el punto; con `then` hace esa reacción al llegar. Devuelve cuándo llegaría (aprox.).
   */
  goTo(x: number, z: number, t0: number, o: { reach?: number; pace?: number; then?: CueId } = {}) {
    const g: Goto = { t0, x, z, reach: o.reach ?? 0, pace: o.pace ?? 1, then: o.then, started: false }
    this.gotos.push(g)
    if (this.t != null && t0 < this.t) this.t = Infinity
    const from = { t0: 0, dur: 0, act: 'rest', k: 0, x0: 0, z0: 0, yaw0: 0, x1: this.pos.x, z1: this.pos.z, yaw1: this.yaw } as IdleItem
    return t0 + walkTo(this.rig.kind, from, x, z, g).dur
  }

  /** Ordena una reacción (o un baile) que empieza en `t0` (reloj de la animación). */
  cue(id: CueId, t0: number, dance?: string) {
    this.pushCue(id, t0, dance, false)
  }

  private pushCue(id: CueId, t0: number, dance: string | undefined, auto: boolean) {
    let dur: number
    let fin = 0.18
    let fout = 0.3
    let stay = false
    const d = dance ? getDance(dance) : undefined
    if (id === 'dance') {
      if (!d) return
      dur = danceSeconds(d) + 0.2
      fin = 0.12
      fout = 0.35
    } else {
      const def = CUES[id]
      if (!def.clips[this.rig.kind]) return
      dur = def.durs?.[this.rig.kind] ?? def.dur
      fin = def.fin ?? fin
      fout = def.fout ?? fout
      stay = !!def.stay
    }
    // Una reacción nueva reemplaza a la que estaba en curso.
    for (const q of this.cues) if (q.t0 + q.dur > t0) q.dur = Math.max(0.001, t0 - q.t0)
    this.cues.push({ id, dance: d?.id, t0, dur, fin, fout, started: false, stay, auto })
    if (this.t != null && t0 < this.t) this.t = Infinity // fuerza re-simular
  }

  get now() {
    return this.t ?? 0
  }

  /** Avanza hasta `t`. `scrub` = reloj fijo del estudio (se re-simula desde 0). */
  advance(t: number, inp: AnimInput, scrub = false): AnimOutput {
    const flags = this.inp.sleeping !== inp.sleeping || this.inp.sad !== inp.sad || !!this.inp.busy !== !!inp.busy
    this.inp = inp
    if (this.t == null || t < this.t) {
      // Primer cuadro o salto atrás: se rehace todo desde el principio (sin sonido).
      const first = this.t == null
      this.reset()
      this.origin = scrub ? 0 : first ? Math.min(t, ...this.cues.map((q) => q.t0)) : this.origin
      this.silent = true
      let x = this.origin
      this.t = x
      this.step(x, 0)
      while (x + DT < t) {
        x += DT
        this.step(x, DT)
      }
      this.silent = false
      this.step(t, t - x)
      this.t = t
      return this.out
    }
    if (t === this.t) return this.out
    if (flags) this.cutIdle(this.t)
    const dt = t - this.t
    this.t = t
    this.step(t, Math.min(dt, 0.25))
    return this.out
  }

  private reset() {
    this.idle.reset()
    this.look.reset()
    this.fx.clear()
    this.forced = null
    this.walking = null
    this.sleepW = this.inp.sleeping ? 1 : 0
    this.sadW = this.inp.sad ? 1 : 0
    this.cues = this.cues.filter((q) => !q.auto && q.t0 + q.dur > this.origin - 60)
    for (const q of this.cues) q.started = false
    this.gotos = this.gotos.filter((g) => g.t0 > this.origin - 60)
    for (const g of this.gotos) g.started = false
    this.chase.at = this.chase.last = -9
  }

  private step(t: number, dt: number) {
    const kind = this.rig.kind
    const prevT = t - dt
    // Caminatas pedidas (ir a comer, perseguir el juguete): cortan el reposo.
    for (const g of this.gotos)
      if (!g.started && g.t0 <= t) {
        g.started = true
        this.cutIdle(Math.max(g.t0, this.idle.items[0]?.t0 ?? g.t0))
        this.walking = g
      }
    if (this.gotos.length > 40) this.gotos = this.gotos.filter((g) => !g.started || g.t0 > t - 30)
    // Reacciones que empiezan ahora: cortan lo que estaba haciendo.
    for (const q of this.cues)
      if (!q.started && q.t0 <= t) {
        q.started = true
        if (q.t0 + q.dur > t) {
          this.cutIdle(Math.max(q.t0, this.idle.items[0]?.t0 ?? q.t0))
          this.forced = { dur: q.dur, stay: q.stay }
        }
      }
    const k = 1 - Math.exp(-dt * 2.5)
    this.sleepW += ((this.inp.sleeping ? 1 : 0) - this.sleepW) * k
    this.sadW += ((this.inp.sad && !this.inp.sleeping ? 1 : 0) - this.sadW) * k

    const run = this.cues.find((q) => q.started && t < q.t0 + q.dur) ?? null
    const cw = run ? env(t - run.t0, run.dur, run.fin, run.fout) : 0
    const it = this.idle.at(t)
    const u = t - it.t0
    const iw = (1 - cw) * (1 - this.sleepW)

    this.mix.reset()
    const L = new Layer(this.mix)
    this.out.expression = null
    this.out.glow = 0
    this.out.prop = null
    this.out.aura = 0
    this.out.beam = 0
    this.out.auraColor = null
    this.faceW = 0

    breathe(kind, L, t, this.sleepW)
    const lure = this.inp.lure && kind !== 'egg' && kind !== 'box' ? this.inp.lure : null
    if (lure) this.watch(L.with(1 - cw), lure)
    else this.look.apply(L.with(iw * (LOOK[it.act] ?? 1)), t)
    const clip = IDLE_CLIPS[kind][it.act]
    if (clip) clip(this.ctx(L.with(iw), u, Math.max(-1, prevT - it.t0), it.dur, it.k), it)
    moodLayers(kind, L.with(1 - cw), t, this.sadW, this.sleepW, this.rig.young)
    if (this.sleepW > 0.5 && cw < 0.5) this.setFace('sleep', 1)
    // Zetas mientras duerme (en tiempos fijos, así el estudio las reproduce igual).
    if (this.sleepW > 0.8 && !run) {
      const P = 1.6
      const i = Math.floor(t / P)
      if (i !== Math.floor(prevT / P)) {
        const [j, off] = TOP[kind]
        this.ctx(L, 0, 0, 0, 0).emitFrom(j, off, 'z', { vel: [0.1 + 0.04 * (i % 2), 0.18, 0.03], life: 2.2, size: 0.08 + (i % 2) * 0.03, sway: 0.05 })
      }
    }

    const scrub = this.inp.scrub ?? 0
    if (scrub > 0.01) this.scrubbed(L.with(scrub * (1 - cw)), t, scrub)

    if (run) {
      const cu = t - run.t0
      if (run.id === 'pounce' && !this.silent && prevT - run.t0 < POUNCE_BITE && cu >= POUNCE_BITE) this.out.caught++
      const c = this.ctx(L.with(cw), cu, prevT - run.t0, run.dur, hash(Math.floor(run.t0 * 1000)))
      if (run.id === 'dance' && kind === 'cat') {
        // El gato baila la coreografía de la gallina parado en dos patas.
        this.danceMix.reset()
        DANCE_CLIPS[run.dance!]({ ...c, L: new Layer(this.danceMix, cw) }, cu)
        catDance(this.danceMix.j, L, cw, this.rig)
      } else if (run.id === 'dance') DANCE_CLIPS[run.dance!](c, cu)
      else CUES[run.id].clips[kind]?.(c)
    }

    // Moscas cuando está muy sucia.
    if (this.inp.dirt > 0.6 && kind !== 'egg') {
      const P = 2.4
      if (Math.floor(t / P) !== Math.floor(prevT / P))
        this.emit('fly', [0, this.rig.height * 0.9, 0], { life: P * 1.05, orbit: 0.28, size: 0.07, vel: [0, 0, 0] })
    }

    if (lure && !this.silent) this.hunt(t, dt, lure, !!run, it)

    const pos = roamAt(it, u)
    this.pos.x = pos.x
    this.pos.z = pos.z
    this.yaw = pos.yaw
    this.mix.addJoint('root', { px: pos.x, pz: pos.z, ry: pos.yaw })

    this.out.blink = blinkAt(t, this.seed)
    this.poser.apply(this.mix)
    this.fx.update(dt)
  }

  /** Sigue con la mirada el juguete (girando cuello y cabeza hacia él). */
  private watch(L: Layer, p: V3) {
    const dx = p[0] - this.pos.x
    const dz = p[2] - this.pos.z
    const dist = Math.hypot(dx, dz)
    const rel = clamp(lerpAngle(0, Math.atan2(dx, dz) - this.yaw, 1), -1.3, 1.3)
    // Si lo tiene cerca, mira hacia abajo.
    const down = clamp(0.55 - dist * 0.6, -0.1, 0.45)
    if (this.rig.kind === 'hen') L.pose(gaze(rel, down))
    else if (this.rig.kind === 'cat') catWatch(L, rel, down, dist, this.t ?? 0, this.rig.young ? 0.72 : 1)
    else L.j('head', { ry: rel * 0.8, rx: down * 0.6 })
  }

  /**
   * Persigue el juguete: camina hasta quedar a un picotón de él y, si se queda quieto un momento,
   * se abalanza. Para volver a atraparlo hay que moverlo (si no, sería muy fácil).
   */
  private hunt(t: number, dt: number, p: V3, busy: boolean, it: IdleItem) {
    const ch = this.chase
    const reach = this.rig.peckTarget[2]
    if (!ch.armed && Math.hypot(p[0] - ch.cx, p[2] - ch.cz) > 0.3) ch.armed = true
    if (busy) return
    const dx = p[0] - this.pos.x
    const dz = p[2] - this.pos.z
    const d = Math.hypot(dx, dz)
    const sx = d > 1e-3 ? p[0] - (dx / d) * reach : this.pos.x
    const sz = d > 1e-3 ? p[2] - (dz / d) * reach : this.pos.z
    if (Math.hypot(sx - ch.x, sz - ch.z) > 0.1 && t - ch.at > 0.35 && Math.abs(d - reach) > 0.06) {
      ch.x = sx
      ch.z = sz
      ch.at = t
      this.goTo(p[0], p[2], t, { reach, pace: 2.8 })
      return
    }
    const still = it.act !== 'walk' || t - it.t0 > it.ta! + it.tw!
    if (still && ch.armed && Math.abs(d - reach) < 0.16 && t - ch.last > 1.2) ch.near += dt
    else ch.near = 0
    if (ch.near > 0.3) {
      ch.near = 0
      ch.last = t
      ch.armed = false
      ch.cx = p[0]
      ch.cz = p[2]
      this.pushCue('pounce', t, undefined, false)
    }
  }

  /** Mientras la frotan con la esponja: cierra los ojos feliz, se mece y mueve la cola. */
  private scrubbed(L: Layer, t: number, w: number) {
    const s = Math.sin(TAU * 1.4 * t)
    const kind = this.rig.kind
    if (kind === 'cat') {
      // El gato se deja bañar, pero gruñón.
      catScrub(L, t, this.rig.young ? 0.72 : 1)
      return this.setFace('angry', w)
    }
    if (kind === 'hen') L.pose({ body: { rz: 0.05 * s, sy: -0.02 }, head: { rz: 0.16 * s, rx: 0.08 } }).pose(tail(0.15, 0.35 * Math.sin(TAU * 3 * t))).pose(A(0.18, 0.12))
    else if (kind === 'chick') L.pose(rollBody(0.07 * s, 0, ROUND_R.chick)).j('head', { rz: 0.14 * s }).pose(CW(0.25 + 0.15 * Math.abs(Math.sin(TAU * 3 * t))))
    else if (kind === 'box') boxScrub(L, t)
    else L.pose(rollBody(0.05 * s, 0, ROUND_R.egg))
    this.setFace('happy', w)
  }

  private setFace(e: Expression, w: number) {
    if (w >= Math.max(0.3, this.faceW)) {
      this.out.expression = e
      this.faceW = w
    }
  }

  private emit(kind: FxKind, p: V3, o: EmitOptions = {}) {
    // De la mascota en reposo al lugar donde está ahora (camina y gira).
    const c = Math.cos(this.yaw)
    const s = Math.sin(this.yaw)
    const x = p[0] * c + p[2] * s + this.pos.x
    const z = -p[0] * s + p[2] * c + this.pos.z
    const vel = o.vel ? ([o.vel[0] * c + o.vel[2] * s, o.vel[1], -o.vel[0] * s + o.vel[2] * c] as V3) : undefined
    this.fx.emit(kind, [x, p[1], z], { ...o, vel, size: (o.size ?? 0.12) * (0.5 + 0.5 / this.scale) })
  }

  private ctx(L: Layer, u: number, prev: number, dur: number, k: number): Ctx {
    const self = this
    const w = L.w
    return {
      kind: this.rig.kind,
      rig: this.rig,
      L,
      u,
      prev,
      dur,
      k,
      R: ROUND_R[this.rig.kind],
      growth: this.inp.growth,
      at: (x) => w > 0.05 && prev < x && x <= u,
      sound(id: SoundId) {
        if (!self.silent && self.inp.voice) play(self.rig.swap?.sound?.[id] ?? id)
      },
      emit: (kind, p, o) => this.emit(kind, p, o),
      emitFrom(j: JointName | 'hand', off: V3, kind: FxKind, o: EmitOptions = {}) {
        const obj = j === 'hand' ? self.rig.sockets.hand : self.rig.joints[j]
        if (!obj) return
        obj.updateWorldMatrix(true, false)
        self.fx.group.updateWorldMatrix(true, false)
        const v = self.fx.group.worldToLocal(obj.localToWorld(self.v.set(...off)))
        const c = Math.cos(self.yaw)
        const s = Math.sin(self.yaw)
        const vel = o.vel ? ([o.vel[0] * c + o.vel[2] * s, o.vel[1], -o.vel[0] * s + o.vel[2] * c] as V3) : undefined
        self.fx.emit(kind, [v.x, v.y, v.z], { ...o, vel, size: (o.size ?? 0.12) * (0.5 + 0.5 / self.scale) })
      },
      take(kind, p, radius) {
        const c = Math.cos(self.yaw)
        const s = Math.sin(self.yaw)
        return self.fx.take(kind, self.v.set(p[0] * c + p[2] * s + self.pos.x, p[1], -p[0] * s + p[2] * c + self.pos.z), radius)
      },
      face: (e) => this.setFace(e, w),
      glow: (v) => (this.out.glow = Math.max(this.out.glow, v)),
      prop: (id) => {
        if (w > 0.02) this.out.prop = id
      },
      aura: (level, beam = 0, colors) => {
        this.out.aura = Math.max(this.out.aura, level * w)
        this.out.beam = Math.max(this.out.beam, beam * w)
        if (colors && w > 0.02) this.out.auraColor = colors
      },
    }
  }

  dispose() {
    this.fx.dispose()
  }
}
