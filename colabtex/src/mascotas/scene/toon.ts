import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Utilidades del estilo "3D que parece 2D": cel-shading + contorno de tinta.

/** Rampa de 3 tonos (sombra, medio, luz) para MeshToonMaterial. */
export function makeToonGradient(levels: number[] = [90, 175, 255]) {
  const data = new Uint8Array(levels.flatMap((v) => [v, v, v, 255]))
  const tex = new THREE.DataTexture(data, levels.length, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Zona frontal (z > 0) donde no se dibuja contorno, en unidades del modelo.
 * Sirve para piezas que sobresalen de la cara (p. ej. el pico): el casco inflado
 * asoma por debajo y se ve como una mancha negra.
 */
export interface OutlineMask {
  x: number
  y: number
  r: number
}

/** Une los vértices duplicados por las costuras de UV (solo posición). */
function mergeByPosition(source: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry()
  // clone() de-intercala el atributo (mergeVertices no soporta InterleavedBufferAttribute).
  g.setAttribute('position', source.getAttribute('position').clone())
  if (source.index) g.setIndex(source.index)
  const merged = mergeVertices(g, 1e-4)
  merged.computeVertexNormals()
  return merged
}

/**
 * Reemplaza las normales del modelo (facetadas en los modelos de Tripo) por normales suaves
 * que ignoran las costuras de UV. Así el borde entre luz y sombra del cel-shading queda limpio
 * en vez de dentado.
 */
export function smoothNormals(geometry: THREE.BufferGeometry) {
  const merged = mergeByPosition(geometry)
  const key = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) =>
    `${Math.round(a.getX(i) * 1e4)},${Math.round(a.getY(i) * 1e4)},${Math.round(a.getZ(i) * 1e4)}`
  const mp = merged.getAttribute('position')
  const mn = merged.getAttribute('normal')
  const byPos = new Map<string, number>()
  for (let i = 0; i < mp.count; i++) byPos.set(key(mp, i), i)
  const pos = geometry.getAttribute('position')
  const normals = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const j = byPos.get(key(pos, i))
    if (j !== undefined) normals.set([mn.getX(j), mn.getY(j), mn.getZ(j)], i * 3)
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geometry
}

/**
 * Geometría para el contorno: vértices unidos y normales suaves, para que el "casco" inflado
 * no se abra en las costuras. `outlineScale` (0–1) apaga el contorno dentro de las máscaras.
 */
export function makeOutlineGeometry(source: THREE.BufferGeometry, masks: OutlineMask[] = []) {
  const merged = mergeByPosition(source)
  merged.setAttribute('outlineScale', computeOutlineScale(merged.getAttribute('position'), masks))
  return merged
}

/** Atributo `outlineScale` (1 = contorno completo, 0 = sin contorno) según las máscaras. */
export function computeOutlineScale(pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, masks: OutlineMask[] = []) {
  const scale = new Float32Array(pos.count).fill(1)
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) <= 0) continue
    for (const m of masks) {
      const d = Math.hypot(pos.getX(i) - m.x, pos.getY(i) - m.y)
      // 0 dentro del radio, sube suave hasta 1 en 1,6 × radio.
      scale[i] = Math.min(scale[i], THREE.MathUtils.smoothstep(d, m.r, m.r * 1.6))
    }
  }
  return new THREE.BufferAttribute(scale, 1)
}

/**
 * Material del contorno: infla la malla a lo largo de la normal y dibuja solo las caras traseras.
 * El grosor se aplica en espacio de cámara (unidades de mundo), así el trazo mide lo mismo en
 * todas las piezas aunque estén escaladas (cuerpo, sombrero, zapatos…).
 */
export function makeOutlineMaterial(color: THREE.ColorRepresentation, thickness: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      thickness: { value: thickness },
      color: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      uniform float thickness;
      attribute float outlineScale;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * thickness * outlineScale;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}

/** Igual que el contorno normal, pero sigue a un esqueleto (para mallas con huesos). */
export function makeSkinnedOutlineMaterial(color: THREE.ColorRepresentation, thickness: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      thickness: { value: thickness },
      color: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float thickness;
      attribute float outlineScale;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        mv.xyz += normalize(normalMatrix * objectNormal) * thickness * outlineScale;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}
