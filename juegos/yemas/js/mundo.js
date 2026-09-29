// Mapa, física de cuerpos y rayos. Todo lo que es geometría vive acá.
import * as THREE from 'three';

export const ALTO = 1.7;       // altura del huevo
export const RADIO = 0.42;     // radio de colisión
export const OJOS = 1.5;       // altura de la cámara sobre los pies
export const PASO = 0.55;      // escalón máximo que se sube caminando
export const GRAVEDAD = 22;
const MITAD = 36;              // medio lado de la arena

// [cx, cz, ancho(x), fondo(z), alto, y0, color]
function disenoCajas() {
  const c = [];
  const muro = '#f2c6a0', caja = '#e0a458', torre = '#f7e1b5', plat = '#9fd3c7', escalon = '#f4d58d', pilar = '#e8a0a8', bajo = '#b5c99a';

  // Muros del borde
  c.push([0, -MITAD - 0.5, 2 * MITAD + 2, 1, 5, 0, muro]);
  c.push([0, MITAD + 0.5, 2 * MITAD + 2, 1, 5, 0, muro]);
  c.push([-MITAD - 0.5, 0, 1, 2 * MITAD, 5, 0, muro]);
  c.push([MITAD + 0.5, 0, 1, 2 * MITAD, 5, 0, muro]);

  // Torre central con escalas por los dos lados (z+ y z-)
  c.push([0, 0, 6, 6, 3, 0, torre]);
  for (let i = 1; i <= 5; i++) {
    const z = 3 + (6 - i) - 0.5;
    c.push([0, z, 2, 1, 0.5 * i, 0, escalon]);
    c.push([0, -z, 2, 1, 0.5 * i, 0, escalon]);
  }

  // Plataformas en las esquinas, con escala mirando al centro
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    c.push([sx * 24, sz * 24, 8, 8, 2.5, 0, plat]);
    for (let i = 1; i <= 4; i++) {
      c.push([sx * (20 - (5 - i) + 0.5), sz * 24, 1, 2, 0.5 * i, 0, escalon]);
    }
  }

  // Muros de cobertura
  c.push([12, 0, 1, 10, 2.2, 0, muro]);
  c.push([-12, 0, 1, 10, 2.2, 0, muro]);
  c.push([0, 14, 10, 1, 2.2, 0, muro]);
  c.push([0, -14, 10, 1, 2.2, 0, muro]);

  // Muretes bajos (se saltan)
  c.push([20, -14, 6, 1, 1.2, 0, bajo]);
  c.push([-20, 14, 6, 1, 1.2, 0, bajo]);
  c.push([14, 26, 1, 6, 1.2, 0, bajo]);
  c.push([-14, -26, 1, 6, 1.2, 0, bajo]);

  // Pilares
  for (const [x, z] of [[6, 24], [-6, 24], [6, -24], [-6, -24], [24, 6], [-24, 6], [24, -6], [-24, -6]]) {
    c.push([x, z, 1.5, 1.5, 5, 0, pilar]);
  }

  // Cajas
  for (const [x, z] of [[8, 8], [-8, -8], [8, -10], [-10, 9], [18, 4], [-18, -4], [4, 20], [-4, -20], [27, -9], [-27, 9], [30, 14], [-30, -14]]) {
    c.push([x, z, 2, 2, 2, 0, caja]);
  }
  c.push([18, 4, 1.6, 1.6, 1.6, 2, caja]);
  c.push([-18, -4, 1.6, 1.6, 1.6, 2, caja]);
  return c;
}

export const SPAWNS = [
  [31, 31], [-31, 31], [31, -31], [-31, -31],
  [0, 31], [0, -31], [31, 0], [-31, 0],
  [16, 16], [-16, 16], [16, -16], [-16, -16],
].map(([x, z]) => new THREE.Vector3(x, 0, z));

function texturaPiso() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f0dcc0'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(MITAD / 2, MITAD / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function crearMundo(escena) {
  const colisores = [];
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * MITAD + 2, 2 * MITAD + 2),
    new THREE.MeshLambertMaterial({ map: texturaPiso() })
  );
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  escena.add(piso);

  const materiales = new Map();
  for (const [cx, cz, w, d, h, y0, color] of disenoCajas()) {
    if (!materiales.has(color)) materiales.set(color, new THREE.MeshLambertMaterial({ color }));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materiales.get(color));
    m.position.set(cx, y0 + h / 2, cz);
    m.castShadow = m.receiveShadow = true;
    escena.add(m);
    colisores.push({ minx: cx - w / 2, maxx: cx + w / 2, miny: y0, maxy: y0 + h, minz: cz - d / 2, maxz: cz + d / 2 });
  }
  return { colisores };
}

// ---------- Física ----------

function solapa(p, b) {
  return p.x + RADIO > b.minx && p.x - RADIO < b.maxx &&
         p.z + RADIO > b.minz && p.z - RADIO < b.maxz &&
         p.y + ALTO > b.miny && p.y < b.maxy;
}

function moverEje(c, eje, delta, cols) {
  if (!delta) return;
  c.pos[eje] += delta;
  for (const b of cols) {
    if (!solapa(c.pos, b)) continue;
    const subir = b.maxy - c.pos.y;
    if (c.enSuelo && subir > 0 && subir <= PASO) {
      const y0 = c.pos.y;
      c.pos.y = b.maxy;
      if (!cols.some(o => solapa(c.pos, o))) continue;
      c.pos.y = y0;
    }
    const min = eje === 'x' ? b.minx : b.minz;
    const max = eje === 'x' ? b.maxx : b.maxz;
    c.pos[eje] = delta > 0 ? min - RADIO - 1e-4 : max + RADIO + 1e-4;
    c.vel[eje] = 0;
  }
}

// c = { pos (pies), vel, enSuelo }
export function moverCuerpo(c, dt, cols) {
  const pasos = Math.max(1, Math.ceil(dt * 120));
  const h = dt / pasos;
  for (let s = 0; s < pasos; s++) {
    c.vel.y -= GRAVEDAD * h;
    moverEje(c, 'x', c.vel.x * h, cols);
    moverEje(c, 'z', c.vel.z * h, cols);
    c.pos.y += c.vel.y * h;
    c.enSuelo = false;
    if (c.pos.y <= 0) { c.pos.y = 0; c.vel.y = 0; c.enSuelo = true; }
    for (const b of cols) {
      if (!solapa(c.pos, b)) continue;
      if (c.vel.y <= 0) { c.pos.y = b.maxy; c.enSuelo = true; }
      else c.pos.y = b.miny - ALTO - 1e-4;
      c.vel.y = 0;
    }
  }
}

// ---------- Rayos ----------

function rayoCaja(o, d, b) {
  let tmin = 0, tmax = Infinity;
  const ejes = [[o.x, d.x, b.minx, b.maxx], [o.y, d.y, b.miny, b.maxy], [o.z, d.z, b.minz, b.maxz]];
  for (const [oa, da, mn, mx] of ejes) {
    if (Math.abs(da) < 1e-9) {
      if (oa < mn || oa > mx) return null;
    } else {
      let t1 = (mn - oa) / da, t2 = (mx - oa) / da;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

// Distancia hasta el primer obstáculo (piso o caja), o max si no hay nada
export function rayoMundo(o, d, max, cols) {
  let t = max;
  if (d.y < -1e-6) t = Math.min(t, -o.y / d.y);
  for (const b of cols) {
    const tb = rayoCaja(o, d, b);
    if (tb !== null && tb < t) t = tb;
  }
  return t;
}

// Rayo contra el huevo aproximado como elipsoide; p = pies del huevo
export function rayoHuevo(o, d, p) {
  const rx = 0.5, ry = ALTO / 2;
  const ox = (o.x - p.x) / rx, oy = (o.y - p.y - ry) / ry, oz = (o.z - p.z) / rx;
  const dx = d.x / rx, dy = d.y / ry, dz = d.z / rx;
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (ox * dx + oy * dy + oz * dz);
  const c = ox * ox + oy * oy + oz * oz - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 ? t : null;
}

// ---------- El huevo ----------

let geoHuevo = null;
function geometriaHuevo() {
  if (geoHuevo) return geoHuevo;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 2 * t - 1;
    const r = 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u);
    pts.push(new THREE.Vector2(Math.max(r, 1e-3), t * ALTO));
  }
  geoHuevo = new THREE.LatheGeometry(pts, 28);
  return geoHuevo;
}

function etiqueta(texto) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.strokeText(texto, 128, 32);
  g.fillStyle = '#fff'; g.fillText(texto, 128, 32);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  return s;
}

const matOjo = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const matPupila = new THREE.MeshBasicMaterial({ color: '#1b1b1b' });
const matArma = new THREE.MeshLambertMaterial({ color: '#3a3a44' });

// Mira hacia -z, igual que la cámara con yaw = 0
export function crearHuevo(color, nombre) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);

  const casco = new THREE.Mesh(geometriaHuevo(), new THREE.MeshLambertMaterial({ color }));
  casco.castShadow = true;
  cuerpo.add(casco);

  for (const sx of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), matOjo);
    ojo.position.set(sx * 0.15, 1.18, -0.36);
    cuerpo.add(ojo);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 6), matPupila);
    pup.position.set(sx * 0.15, 1.18, -0.45);
    cuerpo.add(pup);
  }

  const arma = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.7), matArma);
  arma.position.set(0.32, 0.85, -0.45);
  cuerpo.add(arma);
  const punta = new THREE.Object3D();
  punta.position.set(0.32, 0.87, -0.82);
  cuerpo.add(punta);

  const tag = etiqueta(nombre);
  tag.position.y = ALTO + 0.35;
  g.add(tag);

  g.userData = { cuerpo, punta };
  return g;
}
