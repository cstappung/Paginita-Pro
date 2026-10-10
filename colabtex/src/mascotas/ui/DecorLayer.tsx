import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getDecor } from '../data/decor'
import { clampSpot } from '../game/decor'
import type { PlacedDecor } from '../game/types'
import { buildDecor, glowDecor, night } from '../scene/decor'

/** Raíces de los objetos puestos (por id), para que la escena los pueda tocar y arrastrar. */
export type DecorRegistry = Map<string, THREE.Group>

const noRaycast = () => {}

let arrowTex: THREE.CanvasTexture | null = null
/** Flechita amarilla que marca el objeto elegido (dibujada con el mismo trazo de tinta). */
function arrowTexture() {
  if (arrowTex) return arrowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.beginPath()
  g.moveTo(12, 14)
  g.lineTo(52, 14)
  g.lineTo(32, 50)
  g.closePath()
  g.lineJoin = 'round'
  g.lineWidth = 6
  g.fillStyle = '#ffd23f'
  g.strokeStyle = '#3a2416'
  g.fill()
  g.stroke()
  arrowTex = new THREE.CanvasTexture(c)
  arrowTex.colorSpace = THREE.SRGBColorSpace
  return arrowTex
}

function DecorItem({ item, selected, registry }: { item: PlacedDecor; selected: boolean; registry: DecorRegistry }) {
  const model = useMemo(() => buildDecor(item.id, item.tint), [item.id, item.tint])
  const r = getDecor(item.id)?.r ?? 0.2
  const ring = useRef<THREE.Mesh>(null)
  const arrow = useRef<THREE.Sprite>(null)
  // Alto del objeto (solo sus mallas: el resplandor de las lámparas no cuenta).
  const top = useMemo(() => {
    const box = new THREE.Box3()
    model.body.traverse((o) => (o as THREE.Mesh).isMesh && box.expandByObject(o))
    return box.max.y
  }, [model])
  const lamp = useRef<THREE.PointLight>(null)
  const born = useRef(-1)
  const picked = useRef(-1)

  useEffect(() => {
    // Alto del objeto: el menú flotante (girar, guardar) va justo encima.
    model.root.userData.top = top
    registry.set(item.id, model.root)
    return () => {
      registry.delete(item.id)
      model.dispose()
    }
  }, [model, item.id, registry, top])

  // Mientras se arrastra, la escena la mueve directo; al soltar llega acá la posición guardada.
  useEffect(() => {
    // Por si quedó guardado fuera del piso (versiones anteriores).
    const p = clampSpot(item.id, item.x, item.z)
    model.root.position.set(p.x, 0, p.z)
  }, [model, item.id, item.x, item.z])
  useEffect(() => {
    model.root.rotation.y = item.rot
  }, [model, item.rot])
  useEffect(() => {
    if (selected) picked.current = -1
  }, [selected])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (born.current < 0) born.current = t
    if (selected && picked.current < 0) picked.current = t
    const { body } = model
    // Aparece con un rebote; al elegirlo da un saltito; arrastrándolo queda en el aire y se mece.
    const u = Math.min(1, (t - born.current) / 0.5)
    const pop = u < 1 ? 1 - Math.cos(u * Math.PI * 2.2) * Math.exp(-u * 5) * (1 - u) : 1
    const dragging = !!model.root.userData.dragging
    const hop = selected ? Math.max(0, Math.sin(Math.min(1, (t - picked.current) / 0.35) * Math.PI)) * 0.06 : 0
    body.scale.setScalar(Math.max(0.01, pop))
    body.position.y += ((dragging ? 0.08 : hop) - body.position.y) * 0.35
    body.rotation.z = dragging ? Math.sin(t * 9) * 0.06 : 0
    if (ring.current) {
      ring.current.visible = selected
      const m = ring.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.6 + Math.sin(t * 5) * 0.25
    }
    if (arrow.current) {
      arrow.current.visible = selected
      arrow.current.position.y = top + body.position.y + 0.14 + Math.abs(Math.sin(t * 4)) * 0.05
    }
    const n = night.level
    if (lamp.current) lamp.current.intensity = n * 0.9
    if (model.light) model.light.glow.material.opacity = n * 0.85
  })

  return (
    <primitive object={model.root}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02} raycast={noRaycast} visible={false}>
        <ringGeometry args={[r + 0.01, r + 0.09, 48]} />
        <meshBasicMaterial color="#ffd23f" transparent depthWrite={false} />
      </mesh>
      <sprite ref={arrow} scale={[0.13, 0.13, 1]} renderOrder={9} raycast={noRaycast} visible={false}>
        <spriteMaterial map={arrowTexture()} depthTest={false} transparent />
      </sprite>
      {model.light && <pointLight ref={lamp} position={model.light.pos} color={model.light.color} intensity={0} distance={2.2} decay={2} />}
    </primitive>
  )
}

/** Muebles y juguetes del lugar de la mascota en primer plano. */
export function DecorLayer({ items, selected, registry }: { items: PlacedDecor[]; selected: string | null; registry: DecorRegistry }) {
  useFrame(() => glowDecor(night.level))
  return (
    <>
      {items.map((o) => (
        <DecorItem key={o.id} item={o} selected={selected === o.id} registry={registry} />
      ))}
    </>
  )
}
