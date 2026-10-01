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
// ---------- Skins ----------
// Cada una es un accesorio armado con piezas simples, colgado del cuerpo para
// que se bambolee con el huevo. La cáscara la sigue pintando el color (o el
// del equipo), así una skin no confunde de qué lado está cada uno.
export const SKINS = {
  clasico: 'Clásico', chef: 'Chef', vaquero: 'Vaquero', pirata: 'Pirata',
  corona: 'Realeza', lentes: 'Lentes de sol', lana: 'Gorro de lana', manchas: 'Manchitas',
};
const lambert = color => new THREE.MeshLambertMaterial({ color });
function pieza(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function ponSkin(cuerpo, skin) {
  if (skin === 'chef') {
    const blanco = lambert('#ffffff');
    cuerpo.add(pieza(new THREE.CylinderGeometry(0.27, 0.29, 0.28, 18), blanco, 0, 1.66, 0));
    const copa = pieza(new THREE.SphereGeometry(0.34, 16, 10), blanco, 0, 1.88, 0);
    copa.scale.y = 0.62;
    cuerpo.add(copa);
  } else if (skin === 'vaquero') {
    const cafe = lambert('#8b5a2b');
    cuerpo.add(pieza(new THREE.CylinderGeometry(0.56, 0.56, 0.03, 24), cafe, 0, 1.56, 0));
    cuerpo.add(pieza(new THREE.CylinderGeometry(0.24, 0.29, 0.3, 18), cafe, 0, 1.72, 0));
    cuerpo.add(pieza(new THREE.CylinderGeometry(0.295, 0.295, 0.06, 18), lambert('#3b2414'), 0, 1.61, 0));
  } else if (skin === 'pirata') {
    const negro = lambert('#1d1d22');
    cuerpo.add(pieza(new THREE.CylinderGeometry(0.47, 0.47, 0.03, 3), negro, 0, 1.57, 0));
    const copa = pieza(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), negro, 0, 1.57, 0);
    cuerpo.add(copa);
    cuerpo.add(pieza(new THREE.SphereGeometry(0.05, 8, 6), lambert('#ffffff'), 0, 1.75, -0.24));
    const parche = pieza(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 14), negro, -0.15, 1.18, -0.47);
    parche.rotation.x = Math.PI / 2;
    cuerpo.add(parche);
    const cinta = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 32), negro);
    cinta.position.y = 1.25;
    cinta.rotation.set(Math.PI / 2 + 0.25, 0, 0.2);
    cuerpo.add(cinta);
  } else if (skin === 'corona') {
    const oro = new THREE.MeshPhongMaterial({ color: '#f2c230', specular: '#fff6cc', shininess: 80 });
    cuerpo.add(pieza(new THREE.CylinderGeometry(0.25, 0.27, 0.16, 20, 1, true), oro, 0, 1.62, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cuerpo.add(pieza(new THREE.ConeGeometry(0.05, 0.13, 8), oro, Math.cos(a) * 0.25, 1.76, Math.sin(a) * 0.25));
    }
    cuerpo.add(pieza(new THREE.SphereGeometry(0.04, 8, 6), lambert('#d6283a'), 0, 1.62, -0.27));
  } else if (skin === 'lentes') {
    const vidrio = new THREE.MeshPhongMaterial({ color: '#111118', specular: '#99aaff', shininess: 100 });
    for (const sx of [-1, 1]) cuerpo.add(pieza(new THREE.BoxGeometry(0.17, 0.1, 0.03), vidrio, sx * 0.15, 1.2, -0.47));
    cuerpo.add(pieza(new THREE.BoxGeometry(0.1, 0.02, 0.02), vidrio, 0, 1.22, -0.47));
  } else if (skin === 'lana') {
    const lana = lambert('#e2474b');
    const gorro = pieza(new THREE.SphereGeometry(0.35, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lana, 0, 1.4, 0);
    cuerpo.add(gorro);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 24), lambert('#f4f0e6'));
    borde.position.y = 1.42;
    borde.rotation.x = Math.PI / 2;
    cuerpo.add(borde);
    cuerpo.add(pieza(new THREE.SphereGeometry(0.1, 10, 8), lambert('#f4f0e6'), 0, 1.78, 0));
  } else if (skin === 'manchas') {
    const mancha = lambert('#5a3a24');
    for (const [y, a] of [[0.55, 0.4], [0.8, 2.1], [1.05, 4.0], [0.4, 3.1], [1.3, 1.2], [0.65, 5.2], [1.0, 5.9], [0.3, 1.6]]) {
      const t = y / ALTO, u = 2 * t - 1;
      const r = 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u) * 0.97;
      const m = pieza(new THREE.SphereGeometry(0.08, 10, 6), mancha, Math.cos(a) * r, y, Math.sin(a) * r);
      m.scale.set(1, 1.2, 1);
      cuerpo.add(m);
    }
  }
}

export function crearHuevo(color, nombre, skin = 'clasico') {
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

  ponSkin(cuerpo, skin);

  const tag = etiqueta(nombre);
  tag.position.y = ALTO + (skin === 'chef' ? 0.6 : 0.35);
  g.add(tag);

  g.userData = { cuerpo, punta, casco };
  return g;
}

// ---------- Zombis ----------
// Un huevo podrido: cáscara verdosa con manchas, ojos rojos que brillan y los
// brazos estirados hacia adelante. Sin nombre ni arma. Mismo tamaño que un
// huevo, así que las balas usan el mismo elipsoide (`rayoHuevo`).
const matPodrido = new THREE.MeshLambertMaterial({ color: '#8fa36b' });
const matMoho = new THREE.MeshLambertMaterial({ color: '#4f6136' });
const matOjoZombi = new THREE.MeshBasicMaterial({ color: '#ff3b2f' });
export function crearZombi() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const casco = new THREE.Mesh(geometriaHuevo(), matPodrido.clone());
  casco.castShadow = true;
  cuerpo.add(casco);
  for (const [y, a, s] of [[0.5, 0.6, 0.11], [0.9, 2.4, 0.09], [1.25, 4.1, 0.08], [0.35, 3.3, 0.12], [1.05, 5.5, 0.1]]) {
    const t = y / ALTO, u = 2 * t - 1;
    const r = 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u) * 0.97;
    cuerpo.add(pieza(new THREE.SphereGeometry(s, 8, 6), matMoho, Math.cos(a) * r, y, Math.sin(a) * r));
  }
  for (const sx of [-1, 1]) {
    cuerpo.add(pieza(new THREE.SphereGeometry(0.075, 10, 6), matOjoZombi, sx * 0.15, 1.16, -0.43));
    const brazo = pieza(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8), matPodrido, sx * 0.36, 0.95, -0.42);
    brazo.rotation.x = Math.PI / 2;
    cuerpo.add(brazo);
  }
  g.userData = { cuerpo, casco };
  return g;
}

// Por dónde entran: dieciséis «ventanas» en los muros del borde.
export const VENTANAS = [];
for (const v of [-24, -8, 8, 24]) {
  VENTANAS.push(new THREE.Vector3(v, 0, MITAD - 2), new THREE.Vector3(v, 0, -MITAD + 2));
  VENTANAS.push(new THREE.Vector3(MITAD - 2, 0, v), new THREE.Vector3(-MITAD + 2, 0, v));
}
// Para subir a la torre y a las plataformas hay que pasar por su escala: si
// el que persigue está arriba de una, el zombi va primero al pie de la
// escala más cercana y la sube hasta la cima.
// [minx, maxx, minz, maxz, alto, [[pie, cima], …]]
const v3 = (x, z) => new THREE.Vector3(x, 0, z);
export const ALTURAS = [
  [-3, 3, -3, 3, 3, [[v3(0, 9.6), v3(0, 2.4)], [v3(0, -9.6), v3(0, -2.4)]]],
];
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  ALTURAS.push([sx * 24 - 4, sx * 24 + 4, sz * 24 - 4, sz * 24 + 4, 2.5, [[v3(sx * 15.2, sz * 24), v3(sx * 20.6, sz * 24)]]]);
}

// ---------- Armas tiradas ----------
// Los puntos donde aparecen: arriba de la torre, arriba de las cuatro
// plataformas y cuatro en el suelo. El orden es el `s` del registro (`recoge`),
// así que no se reordena. Hay tantos como YM_PUNTOS_ARMA en motor.js.
export const PUNTOS_ARMA = [
  [0, 3, 0], [24, 2.5, 24], [-24, 2.5, 24], [24, 2.5, -24], [-24, 2.5, -24],
  [20, 0, 10], [-20, 0, -10], [10, 0, -20],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

export function crearPedestal() {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.05, 28),
    new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.45 })
  );
  m.position.y = 0.03;
  return m;
}

// ---------- Captura la bandera ----------
// Las mismas coordenadas que YM_BASES en colabtex/src/juegos/motor.js: el
// reductor devuelve ahí una bandera, y aquí se dibuja la base.
export const BASES = { rojo: new THREE.Vector3(0, 0, 29), azul: new THREE.Vector3(0, 0, -29) };

const matAsta = new THREE.MeshLambertMaterial({ color: '#6b4a2b' });
export function crearBandera(color) {
  const g = new THREE.Group();
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), matAsta);
  asta.position.y = 1.2;
  asta.castShadow = true;
  g.add(asta);
  const tela = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.04), new THREE.MeshLambertMaterial({ color }));
  tela.position.set(0.5, 2.05, 0);
  tela.castShadow = true;
  g.add(tela);
  g.userData.tela = tela;
  return g;
}

export function crearBase(color) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.06, 32),
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 })
  );
  m.position.y = 0.03;
  m.receiveShadow = true;
  return m;
}
