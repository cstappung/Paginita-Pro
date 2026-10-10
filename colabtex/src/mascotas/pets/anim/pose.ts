import * as THREE from 'three'
import type { JointMix, JointName, PetRig } from '../rig/types'

// Poses aditivas: cada capa (respirar, mirar, picotear, bailar…) suma desplazamientos sobre la pose
// de reposo con un peso. Así las capas se mezclan y se funden sin saltos.

export interface JointPose {
  px?: number
  py?: number
  pz?: number
  rx?: number
  ry?: number
  rz?: number
  /** Escala relativa (0 = igual, 0.1 = 10 % más grande). */
  sx?: number
  sy?: number
  sz?: number
}
export type Pose = Partial<Record<JointName, JointPose>>

const KEYS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'] as const
type Full = JointMix
const zero = (): Full => ({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0 })

/** Acumula capas de pose con peso. */
export class PoseMix {
  readonly j = new Map<JointName, Full>()
  reset() {
    for (const v of this.j.values()) for (const k of KEYS) v[k] = 0
  }
  add(pose: Pose | null | undefined, w = 1) {
    if (!pose || w <= 0) return
    for (const name in pose) {
      const src = pose[name as JointName]!
      let dst = this.j.get(name as JointName)
      if (!dst) this.j.set(name as JointName, (dst = zero()))
      for (const k of KEYS) {
        const v = src[k]
        if (v) dst[k] += v * w
      }
    }
  }
  addJoint(name: JointName, src: JointPose, w = 1) {
    if (w <= 0) return
    let dst = this.j.get(name)
    if (!dst) this.j.set(name, (dst = zero()))
    for (const k of KEYS) {
      const v = src[k]
      if (v) dst[k] += v * w
    }
  }
  get(name: JointName) {
    return this.j.get(name)
  }
}

interface Rest {
  pos: THREE.Vector3
  rot: THREE.Euler
  scale: THREE.Vector3
}

/** Aplica la mezcla al esqueleto y estira las canillas (IK simple de dos puntos). */
export class Poser {
  private rest = new Map<THREE.Object3D, Rest>()
  private v1 = new THREE.Vector3()
  private v2 = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)
  /** Dirección de cada pata en reposo (de la cadera al tobillo), para girar las fundas. */
  private restDir: THREE.Vector3[]

  constructor(private rig: PetRig) {
    for (const obj of Object.values(rig.joints)) {
      if (!obj || this.rest.has(obj)) continue
      this.rest.set(obj, { pos: obj.position.clone(), rot: obj.rotation.clone(), scale: obj.scale.clone() })
    }
    rig.root.updateMatrixWorld(true)
    this.restDir = rig.legs.map((leg) => {
      const hip = rig.root.worldToLocal(leg.hip.getWorldPosition(new THREE.Vector3()))
      return rig.root.worldToLocal(leg.ankle.getWorldPosition(new THREE.Vector3())).sub(hip).normalize()
    })
  }

  apply(mix: PoseMix) {
    this.rig.solve?.(mix.j)
    for (const [name, obj] of Object.entries(this.rig.joints)) {
      if (!obj) continue
      const r = this.rest.get(obj)!
      const p = mix.get(name as JointName)
      if (!p) {
        obj.position.copy(r.pos)
        obj.rotation.copy(r.rot)
        obj.scale.copy(r.scale)
        continue
      }
      obj.position.set(r.pos.x + p.px, r.pos.y + p.py, r.pos.z + p.pz)
      obj.rotation.set(r.rot.x + p.rx, r.rot.y + p.ry, r.rot.z + p.rz)
      obj.scale.set(r.scale.x * Math.max(0.05, 1 + p.sx), r.scale.y * Math.max(0.05, 1 + p.sy), r.scale.z * Math.max(0.05, 1 + p.sz))
    }
    if (!this.rig.legs.length) return
    const root = this.rig.root
    root.updateMatrixWorld(true)
    this.rig.legs.forEach((leg, i) => {
      const hip = root.worldToLocal(leg.hip.getWorldPosition(this.v1))
      const ankle = root.worldToLocal(leg.ankle.getWorldPosition(this.v2))
      if (leg.sleeve) leg.sleeve.position.copy(hip)
      const dir = hip.sub(ankle)
      const len = Math.max(0.001, dir.length())
      leg.shin.position.copy(ankle)
      leg.shin.quaternion.setFromUnitVectors(this.up, dir.divideScalar(len))
      leg.shin.scale.set(1, len, 1)
      if (leg.sleeve) leg.sleeve.quaternion.setFromUnitVectors(this.restDir[i], this.v2.copy(dir).negate())
    })
  }
}
