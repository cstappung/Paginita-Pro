// Lo que se lanza: las tres granadas (Huevo duro, humo y cegadora) y el cohete
// de la bazuca. Las granadas rebotan contra el piso y las cajas y revientan a
// los `mecha` segundos; el cohete va derecho y revienta con lo primero que
// toca.
//
// Quien lanza es el dueño de la verdad: su marco lo simula, decide dónde
// revienta y a quién le hace daño (con los golpes de siempre). Los demás
// reciben el lanzamiento (`n` en el estado, con su tipo `k`) y lo simulan solo
// para verlo volar, y lo hacen reventar donde el dueño dice que reventó
// (`x2`), no donde les dio a ellos: dos simulaciones con cuadros distintos no
// terminan exactamente en el mismo sitio.
import * as THREE from 'three';

export const GRANADA = { nombre: 'Huevo duro', porVida: 2, mecha: 1.8, radio: 5.5, danio: 140, cadencia: 0.8, fuerza: 17 };
const GRAV = 22, RADIO = 0.13, REBOTE = 0.45, ROCE = 0.75, VIDA_COHETE = 3;

const geo = new THREE.SphereGeometry(RADIO, 12, 8).scale(1, 1.3, 1);
const geoFaja = new THREE.TorusGeometry(RADIO * 1.02, 0.025, 6, 16);
const COLORES = {
  duro: ['#f3ead8', '#c0392b'],
  humo: ['#9aa39c', '#3f6b4a'],
  luz: ['#f5f7ff', '#3b78ff'],
};

function malla(k) {
  const g = new THREE.Group();
  if (k === 'cohete') {
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), new THREE.MeshLambertMaterial({ color: '#7d8f3c' }));
    cuerpo.rotation.x = Math.PI / 2;
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 10), new THREE.MeshLambertMaterial({ color: '#f3ead8' }));
    punta.rotation.x = -Math.PI / 2;
    punta.position.z = -0.33;
    const fuego = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    fuego.position.z = 0.28;
    g.add(cuerpo, punta, fuego);
    return g;
  }
  const [c, f] = COLORES[k] || COLORES.duro;
  const huevo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c }));
  huevo.castShadow = true;
  const faja = new THREE.Mesh(geoFaja, new THREE.MeshLambertMaterial({ color: f }));
  faja.rotation.x = Math.PI / 2;
  g.add(huevo, faja);
  return g;
}

function dentro(p, b, r) {
  return p.x > b.minx - r && p.x < b.maxx + r && p.y > b.miny - r &&
         p.y < b.maxy + r && p.z > b.minz - r && p.z < b.maxz + r;
}

function choca(p, v, b) {
  if (!dentro(p, b, RADIO)) return;
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

// alReventar(p, dueno, id, propia, k). `tocaHuevo(p)` (solo para lo propio)
// dice si el cohete le dio a alguien.
export function crearGranadas(escena, colisores, alReventar, tocaHuevo = () => false) {
  const vivas = new Map();   // id → {pos, vel, t, obj, propia, dueno, k}

  function lanzar(id, o, v, propia, dueno, k = 'duro') {
    if (vivas.has(id)) return;
    const obj = malla(k);
    obj.position.set(o[0], o[1], o[2]);
    const vel = new THREE.Vector3(v[0], v[1], v[2]);
    if (k === 'cohete') obj.lookAt(obj.position.clone().sub(vel));
    escena.add(obj);
    vivas.set(id, { pos: obj.position, vel, t: 0, obj, propia, dueno, k });
  }

  function quita(id) {
    const g = vivas.get(id);
    if (!g) return null;
    escena.remove(g.obj);
    g.obj.traverse(o => { if (o.isMesh) { if (o.geometry !== geo && o.geometry !== geoFaja) o.geometry.dispose(); o.material.dispose(); } });
    vivas.delete(id);
    return g;
  }

  function revienta(id, donde, k) {
    const g = quita(id);
    const p = donde ? new THREE.Vector3(donde[0], donde[1], donde[2]) : g && g.pos.clone();
    if (p) alReventar(p, g ? g.dueno : '', id, !!(g && g.propia), (g && g.k) || k || 'duro');
  }

  function pasoCohete(id, g, h) {
    g.pos.addScaledVector(g.vel, h);
    const choco = g.pos.y < 0.08 || colisores.some(b => dentro(g.pos, b, 0.05)) || (g.propia && tocaHuevo(g.pos));
    if (!choco) return false;
    // El propio revienta ahí; el ajeno se queda quieto esperando a que el
    // dueño diga dónde fue (llega en un instante).
    if (g.propia) revienta(id);
    else { g.vel.set(0, 0, 0); g.obj.visible = false; }
    return true;
  }

  function paso(dt) {
    const pasos = Math.max(1, Math.ceil(dt * 120)), h = dt / pasos;
    for (const [id, g] of vivas) {
      if (g.k === 'cohete') {
        for (let s = 0; s < pasos && vivas.has(id); s++) if (pasoCohete(id, g, h)) break;
        g.t += dt;
        if (vivas.has(id) && g.t >= VIDA_COHETE) { if (g.propia) revienta(id); else quita(id); }
        continue;
      }
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
