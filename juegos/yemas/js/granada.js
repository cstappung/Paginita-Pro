// El Huevo duro: la granada. Rebota contra el piso y las cajas y revienta a
// los `mecha` segundos.
//
// Quien la lanza es el dueño de la verdad: su marco la simula, decide dónde
// revienta y a quién le hace daño (con los golpes de siempre, arma 3). Los
// demás reciben el lanzamiento (`n` en el estado) y la simulan solo para
// verla volar, y la hacen reventar donde el dueño dice que reventó (`x2`),
// no donde les dio a ellos: dos simulaciones con cuadros distintos no
// terminan exactamente en el mismo sitio.
import * as THREE from 'three';

export const GRANADA = { nombre: 'Huevo duro', porVida: 2, mecha: 1.8, radio: 5.5, danio: 140, cadencia: 0.8, fuerza: 17 };
const GRAV = 22, RADIO = 0.13, REBOTE = 0.45, ROCE = 0.75;

const geo = new THREE.SphereGeometry(RADIO, 12, 8).scale(1, 1.3, 1);
const matCascara = new THREE.MeshLambertMaterial({ color: '#f3ead8' });
const matFaja = new THREE.MeshLambertMaterial({ color: '#c0392b' });
const geoFaja = new THREE.TorusGeometry(RADIO * 1.02, 0.025, 6, 16);

function malla() {
  const g = new THREE.Group();
  const huevo = new THREE.Mesh(geo, matCascara);
  huevo.castShadow = true;
  g.add(huevo);
  const faja = new THREE.Mesh(geoFaja, matFaja);
  faja.rotation.x = Math.PI / 2;
  g.add(faja);
  return g;
}

function choca(p, v, b) {
  if (p.x < b.minx - RADIO || p.x > b.maxx + RADIO || p.y < b.miny - RADIO ||
      p.y > b.maxy + RADIO || p.z < b.minz - RADIO || p.z > b.maxz + RADIO) return;
  // Sale por la cara más cercana y rebota en ese eje.
  const caras = [
    ['x', b.minx - RADIO - p.x], ['x', b.maxx + RADIO - p.x],
    ['y', b.miny - RADIO - p.y], ['y', b.maxy + RADIO - p.y],
    ['z', b.minz - RADIO - p.z], ['z', b.maxz + RADIO - p.z],
  ];
  let [eje, d] = caras[0];
  for (const c of caras) if (Math.abs(c[1]) < Math.abs(d)) [eje, d] = c;
  p[eje] += d;
  v[eje] = -v[eje] * REBOTE;
  for (const o of ['x', 'y', 'z']) if (o !== eje) v[o] *= ROCE;
}

export function crearGranadas(escena, colisores, alReventar) {
  const vivas = new Map();   // id → {pos, vel, t, obj, propia, dueno}

  function lanzar(id, o, v, propia, dueno) {
    if (vivas.has(id)) return;
    const obj = malla();
    obj.position.set(o[0], o[1], o[2]);
    escena.add(obj);
    vivas.set(id, { pos: obj.position, vel: new THREE.Vector3(v[0], v[1], v[2]), t: 0, obj, propia, dueno });
  }

  function quita(id) {
    const g = vivas.get(id);
    if (!g) return null;
    escena.remove(g.obj);
    vivas.delete(id);
    return g;
  }

  function revienta(id, donde) {
    const g = quita(id);
    const p = donde ? new THREE.Vector3(donde[0], donde[1], donde[2]) : g && g.pos.clone();
    if (p) alReventar(p, g ? g.dueno : '', id, !!(g && g.propia));
  }

  function paso(dt) {
    const pasos = Math.max(1, Math.ceil(dt * 120)), h = dt / pasos;
    for (const [id, g] of vivas) {
      for (let s = 0; s < pasos; s++) {
        g.vel.y -= GRAV * h;
        g.pos.addScaledVector(g.vel, h);
        if (g.pos.y < RADIO) {
          g.pos.y = RADIO;
          g.vel.y = -g.vel.y * REBOTE;
          g.vel.x *= ROCE; g.vel.z *= ROCE;
        }
        for (const b of colisores) choca(g.pos, g.vel, b);
      }
      g.obj.rotation.x += g.vel.length() * dt * 2;
      g.t += dt;
      // La propia revienta por la mecha; la ajena espera a que el dueño diga
      // dónde, y si ese aviso no llega nunca, se va sola.
      if (g.propia && g.t >= GRANADA.mecha) revienta(id);
      else if (!g.propia && g.t >= GRANADA.mecha + 2) quita(id);
    }
  }

  return { lanzar, paso, revienta, vivas };
}
