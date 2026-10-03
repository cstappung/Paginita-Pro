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

// Sin mapa, la arena de siempre (los modos de duelo). Con mapa (mapas.js),
// el mapa de zombis: cajas sólidas, adornos, puertas que se quitan al
// comprarlas y lo que solo se enciende con la electricidad. `colisores` es el
// arreglo compartido con los demás módulos: se llena y se vacía en el lugar,
// porque granadas, zombis y la física guardan la referencia.
export function crearMundo(escena, mapa = null, colisores = []) {
  const grupo = new THREE.Group();
  escena.add(grupo);
  const puertas = {};      // id → { mallas, cols }
  const deLuz = [];        // [material, color encendido] o [luz, intensidad]
  let encendido = false;
  const lote = new Lote();

  if (!mapa) {
    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * MITAD + 2, 2 * MITAD + 2),
      new THREE.MeshLambertMaterial({ map: texturaPiso() })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    grupo.add(piso);
    for (const [cx, cz, w, d, h, y0, color] of disenoCajas()) {
      lote.caja(color, cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2);
      colisores.push({ minx: cx - w / 2, maxx: cx + w / 2, miny: y0, maxy: y0 + h, minz: cz - d / 2, maxz: cz + d / 2 });
    }
    lote.monta(grupo);
    return { quitaPuerta() {}, enciende() {}, desmonta: () => desmonta(), get luz() { return true; } };
  }

  const amb = mapa.ambiente || {};
  const [sx0, sz0, sx1, sz1] = mapa.suelo || [-60, -60, 60, 60];
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(sx1 - sx0, sz1 - sz0), new THREE.MeshLambertMaterial({ map: texturaTierra(amb.piso || '#444', (sx1 - sx0) / 8, (sz1 - sz0) / 8) }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.set((sx0 + sx1) / 2, 0, (sz0 + sz1) / 2);
  piso.receiveShadow = true;
  grupo.add(piso);

  const dePuerta = id => (puertas[id] ||= { mallas: [], cols: [] });
  // Lo que pertenece a una puerta o a la luz va suelto; lo demás, al lote.
  const suelta = (geo, mat, o) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    grupo.add(m);
    if (o?.puerta) dePuerta(o.puerta).mallas.push(m);
    return m;
  };
  const material = (color, o) => {
    if (o?.luz) {
      const mat = o.brilla ? new THREE.MeshBasicMaterial({ color: '#222' }) : new THREE.MeshLambertMaterial({ color: '#222' });
      deLuz.push([mat, new THREE.Color(color)]);
      return mat;
    }
    return o?.brilla ? basico(color) : lambert(color);
  };
  // Una caja: al lote si es fija, suelta si depende de algo.
  const pieza3 = (color, x0, y0, z0, x1, y1, z1, o, brilla = false) => {
    if (!o?.puerta && !o?.luz) { lote.caja(color, x0, y0, z0, x1, y1, z1, brilla || o?.brilla); return; }
    const m = suelta(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material(color, { ...o, brilla: brilla || o?.brilla }), o);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };

  for (const [x0, z0, x1, z1, y0, y1, color, o] of mapa.cajas) {
    const c = { minx: x0, maxx: x1, miny: y0, maxy: y1, minz: z0, maxz: z1 };
    if (o?.pasa) c.pasa = true;
    if (o?.puerta) { c.puerta = o.puerta; dePuerta(o.puerta).cols.push(c); }
    colisores.push(c);
    if (!color) continue;
    if (o?.puerta) {
      // La puerta: tablones con travesaños, o un montón de escombros.
      pieza3(color, x0, y0, z0, x1, y1, z1, o);
      const ejeX = x1 - x0 > z1 - z0;
      if (o.estilo === 'escombros') {
        for (let i = 0; i < 7; i++) {
          const f = (i * 0.37) % 1, h = (y1 - y0) * (0.25 + 0.6 * ((i * 0.61) % 1));
          const a = ejeX ? x0 + (x1 - x0) * f : z0 + (z1 - z0) * f;
          const m = suelta(new THREE.BoxGeometry(0.7, 0.5, 0.6), lambert(i & 1 ? '#5a4a3c' : '#7a6a58'), o);
          m.position.set(ejeX ? a : (x0 + x1) / 2 + (i % 3 - 1) * 0.35, y0 + h, ejeX ? (z0 + z1) / 2 + (i % 3 - 1) * 0.35 : a);
          m.rotation.set(i * 0.7, i * 1.3, i * 0.4);
        }
      } else {
        for (const f of [0.25, 0.7]) {
          const y = y0 + (y1 - y0) * f;
          if (ejeX) pieza3('#3a2412', x0, y - 0.08, z0 - 0.05, x1, y + 0.08, z1 + 0.05, o);
          else pieza3('#3a2412', x0 - 0.05, y - 0.08, z0, x1 + 0.05, y + 0.08, z1, o);
        }
      }
      continue;
    }
    pieza3(color, x0, y0, z0, x1, y1, z1, o);
  }

  for (const d of mapa.decor) {
    const t = d[0];
    if (t === 'c' || t === 'brillo') {
      const [, x0, z0, x1, z1, y0, y1, color, o] = d;
      pieza3(color, x0, y0, z0, x1, y1, z1, o, t === 'brillo');
    } else if (t === 'tubo') {
      const [, x0, y0, z0, x1, y1, z1, r, color, o] = d;
      const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
      const largo = a.distanceTo(b);
      const geo = new THREE.CylinderGeometry(r, r, largo, r > 0.3 ? 16 : 8);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const mat4 = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
      ponGeo(geo, mat4, color, o);
    } else if (t === 'cil' || t === 'cono') {
      const [, x, z, r, y0, y1, color, o] = d;
      const geo = t === 'cil' ? new THREE.CylinderGeometry(r, r, y1 - y0, r > 0.5 ? 20 : 10) : new THREE.ConeGeometry(r, y1 - y0, 10);
      const m4 = new THREE.Matrix4().makeTranslation(x, (y0 + y1) / 2, z);
      // rx tumba el cilindro (la puerta redonda de la bóveda, un reflector).
      if (o?.rx) m4.multiply(new THREE.Matrix4().makeRotationX(o.rx));
      ponGeo(geo, m4, color, o);
    } else if (t === 'esf') {
      const [, x, y, z, r, color, o] = d;
      ponGeo(new THREE.SphereGeometry(r, 12, 8), new THREE.Matrix4().makeTranslation(x, y, z), color, o);
    } else if (t === 'rot') {
      const [, x, y, z, ry, w, h, dd, color, o] = d;
      const e = new THREE.Euler(o?.rx || 0, ry, o?.rz || 0, 'YXZ');
      const mat4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1));
      ponGeo(new THREE.BoxGeometry(w, h, dd), mat4, color, o);
    } else if (t === 'piso' || t === 'techo') {
      const [, x0, z0, x1, z1, y, color] = d;
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      const mat4 = new THREE.Matrix4().makeTranslation((x0 + x1) / 2, y, (z0 + z1) / 2)
        .multiply(new THREE.Matrix4().makeRotationX(t === 'piso' ? -Math.PI / 2 : Math.PI / 2));
      ponGeo(geo, mat4, color, null, false);
    } else if (t === 'cartel') {
      const [, x, y, z, ry, w, h, texto, fondo, tinta, o] = d;
      const m = suelta(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: texturaCartel(texto, w, h, fondo, tinta, o?.fuente), transparent: !fondo }), o);
      m.castShadow = false;
      m.position.set(x, y, z);
      m.rotation.y = ry;
    } else if (t === 'luz') {
      const [, x, y, z, color, intensidad, alcance, o] = d;
      // Luz física de three (r160): con decaimiento 1 y este factor, las
      // intensidades de los mapas se leen como «tenue / normal / fuerte».
      const l = new THREE.PointLight(color, o?.luz ? 0 : intensidad * LUX, alcance, 1);
      l.position.set(x, y, z);
      grupo.add(l);
      if (o?.luz) deLuz.push([l, intensidad * LUX]);
    }
  }
  lote.monta(grupo);
  if (mapa.luzSiempre) enciende();

  function ponGeo(geo, mat4, color, o, sombra = true) {
    if (!o?.puerta && !o?.luz) { lote.agrega(color, geo, mat4, o?.brilla, sombra); return; }
    const m = suelta(geo, material(color, o), o);
    m.applyMatrix4(mat4);
  }
  function enciende() {
    if (encendido) return;
    encendido = true;
    for (const [cosa, v] of deLuz) {
      if (cosa.isLight) cosa.intensity = v;
      else cosa.color.copy(v);
    }
  }
  function quitaPuerta(id) {
    const p = puertas[id];
    if (!p) return;
    for (const m of p.mallas) { grupo.remove(m); m.geometry.dispose(); }
    for (const c of p.cols) { const i = colisores.indexOf(c); if (i >= 0) colisores.splice(i, 1); }
    delete puertas[id];
  }
  function desmonta() {
    escena.remove(grupo);
    grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material?.map) o.material.map.dispose();
    });
    colisores.length = 0;
  }
  return { quitaPuerta, enciende, desmonta, get luz() { return encendido; } };
}

const LUX = 6;
const _lam = new Map(), _bas = new Map();
const basico = color => { if (!_bas.has(color)) _bas.set(color, new THREE.MeshBasicMaterial({ color })); return _bas.get(color); };
function lambertC(color) { if (!_lam.has(color)) _lam.set(color, new THREE.MeshLambertMaterial({ color })); return _lam.get(color); }

// Junta todo lo fijo en una malla por material: un mapa son cientos de
// piezas, y cientos de llamadas de dibujo (el doble con sombras) se notan.
class Lote {
  constructor() { this.g = new Map(); }
  caja(color, x0, y0, z0, x1, y1, z1, brilla) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    this.agrega(color, geo, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), brilla, true);
  }
  agrega(color, geo, mat4, brilla, sombra) {
    const k = `${color}|${brilla ? 1 : 0}|${sombra ? 1 : 0}`;
    if (!this.g.has(k)) this.g.set(k, []);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(mat4);
    this.g.get(k).push(g);
  }
  monta(grupo) {
    for (const [k, geos] of this.g) {
      const [color, brilla, sombra] = k.split('|');
      let n = 0;
      for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let i = 0;
      for (const g of geos) {
        pos.set(g.attributes.position.array, i * 3);
        nor.set(g.attributes.normal.array, i * 3);
        i += g.attributes.position.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, brilla === '1' ? basico(color) : lambertC(color));
      m.castShadow = sombra === '1';
      m.receiveShadow = true;
      grupo.add(m);
    }
    this.g.clear();
  }
}

// El piso de un mapa: tierra o baldosa con algo de ruido para que no sea un plano liso.
function texturaTierra(color, rx, rz) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  let s = 7;
  const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = azar() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)';
    const r = 1 + azar() * 4;
    g.fillRect(azar() * 128, azar() * 128, r, r);
  }
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, rz);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function texturaCartel(texto, w, h, fondo, tinta, fuente) {
  const cv = document.createElement('canvas');
  const px = 128;
  cv.width = Math.max(64, Math.round(w * px)); cv.height = Math.max(32, Math.round(h * px));
  const g = cv.getContext('2d');
  if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, cv.width, cv.height); }
  let tam = cv.height * 0.7;
  g.font = `bold ${tam}px ${fuente || 'system-ui, sans-serif'}`;
  const ancho = g.measureText(texto).width;
  if (ancho > cv.width * 0.92) { tam *= cv.width * 0.92 / ancho; g.font = `bold ${tam}px ${fuente || 'system-ui, sans-serif'}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = tinta || '#fff';
  g.fillText(texto, cv.width / 2, cv.height / 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
    const y0 = c.pos.y;
    c.pos.y += c.vel.y * h;
    c.enSuelo = false;
    if (c.pos.y <= 0) { c.pos.y = 0; c.vel.y = 0; c.enSuelo = true; }
    for (const b of cols) {
      if (!solapa(c.pos, b)) continue;
      // Solo se apoya encima quien venía de arriba (o a un escalón), y solo
      // se frena contra el techo quien venía de abajo. Un cuerpo que quedó
      // metido dentro de una caja por otra cosa (un empujón) se saca hacia
      // el costado más cercano: subirlo arriba de todo era dejarlo parado
      // sobre un muro de cuatro metros, fuera del mapa.
      if (c.vel.y <= 0 && y0 >= b.maxy - PASO) { c.pos.y = b.maxy; c.enSuelo = true; c.vel.y = 0; }
      else if (c.vel.y > 0 && y0 + ALTO <= b.miny + 1e-3) { c.pos.y = b.miny - ALTO - 1e-4; c.vel.y = 0; }
      else sacaDeCaja(c, b);
    }
  }
}

// Saca el cuerpo de la caja por el lado más cercano, en el plano.
function sacaDeCaja(c, b) {
  const o = [
    [b.maxx + RADIO + 1e-4 - c.pos.x, 'x'], [b.minx - RADIO - 1e-4 - c.pos.x, 'x'],
    [b.maxz + RADIO + 1e-4 - c.pos.z, 'z'], [b.minz - RADIO - 1e-4 - c.pos.z, 'z'],
  ].sort((a, d) => Math.abs(a[0]) - Math.abs(d[0]))[0];
  c.pos[o[1]] += o[0];
  if (Math.sign(c.vel[o[1]]) === -Math.sign(o[0])) c.vel[o[1]] = 0;
}

/* Un empujón (un zombi que se te mete encima) que respeta las paredes: se
   aplica a pasos cortos con el mismo choque que caminar, así que nunca
   atraviesa un muro ni deja el cuerpo metido en una caja. */
export function empujaCuerpo(c, dx, dz, cols) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
  for (let i = 0; i < n; i++) { moverEje(c, 'x', dx / n, cols); moverEje(c, 'z', dz / n, cols); }
}

// ¿El cuerpo está dentro de alguna caja?
export const metido = (p, cols) => cols.some(b => solapa(p, b));

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

// Distancia hasta el primer obstáculo (piso o caja), o max si no hay nada.
// Las ventanas tapiadas (`pasa`) frenan cuerpos, no balas; con `todos` también
// cuentan (los zombis no ven a través de las tablas: si no, se pegaban a la
// ventana del otro lado de la pared persiguiendo a quien estaba dentro).
export function rayoMundo(o, d, max, cols, todos = false) {
  let t = max;
  if (d.y < -1e-6) t = Math.min(t, -o.y / d.y);
  for (const b of cols) {
    if (b.pasa && !todos) continue;
    const tb = rayoCaja(o, d, b);
    if (tb !== null && tb < t) t = tb;
  }
  return t;
}

// Rayo contra el huevo aproximado como elipsoide; p = pies del huevo
// `alto` achata el elipsoide (un perro, uno que se arrastra) sin cambiar el ancho.
export function rayoHuevo(o, d, p, escala = 1, alto = 1) {
  const rx = 0.5 * escala, ry = ALTO / 2 * escala * alto;
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
export function geometriaHuevo() {
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

export function etiqueta(texto) {
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
export const lambert = color => new THREE.MeshLambertMaterial({ color });
export function pieza(geo, mat, x, y, z) {
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
const matCarbon = new THREE.MeshLambertMaterial({ color: '#2a1a14' });
const matBrasa = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });
const matAcero = new THREE.MeshPhongMaterial({ color: '#8d949c', specular: '#ffffff', shininess: 70 });
const matGas = new THREE.MeshBasicMaterial({ color: '#7dff3a', transparent: true, opacity: 0.85 });
const matBoca = new THREE.MeshBasicMaterial({ color: '#1a0606' });
// El color de la cáscara y cuánto brilla, por tipo (TIPOS en zombis.js).
const PIEL = {
  n: ['#8fa36b'], c: ['#c2b357'], g: ['#5d7a3c'], p: ['#4a1f17', '#3a0800'], t: ['#a7c43a', '#2f6a10'],
  f: ['#c24a1a', '#6a1d00'], x: ['#e3dcc8'], j: ['#5b4a63', '#1a0a20'], k: ['#7d9460'],
};
// La forma la dibuja este archivo, pero la medida de las balas (`escala`,
// `alto`) es la de FORMA en zombis.js: aquí se copia para no importar al revés.
const MEDIDA_Z = { g: [1.3, 1], p: [1.1, 0.37], t: [1, 0.42], f: [1.12, 1], x: [0.95, 1], j: [1.9, 1], k: [1.05, 1] };

// `tipo`: ver TIPOS en zombis.js. Todos guardan en `userData` lo que anima
// zombis.js: `cuerpo` (se bambolea), `casco` (la cáscara, la que destella al
// recibir un balazo), `brazos`, y según el tipo `patas`, `repta`, `yelmo`,
// `boca` y `ojos`.
export function crearZombi(tipo = 'n') {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const [color, brillo] = PIEL[tipo] || PIEL.n;
  const casco = new THREE.Mesh(geometriaHuevo(), matPodrido.clone());
  casco.material.color.set(color);
  if (brillo) casco.material.emissive?.set(brillo);
  casco.castShadow = true;
  const ud = { cuerpo, casco, brazos: [], base: casco.material.emissive.clone() };
  const [escala, alto] = MEDIDA_Z[tipo] || [1, 1];
  ud.escala = escala; ud.alto = alto;

  if (tipo === 'p') {
    // El perro infernal: el huevo acostado, chamuscado, en cuatro patas, con
    // brasas en el lomo, orejas de cuerno y los ojos encendidos.
    casco.rotation.x = -Math.PI / 2;
    casco.scale.set(0.78, 0.72, 0.7);
    casco.position.set(0, 0.5, 0.61);
    cuerpo.add(casco);
    ud.patas = [];
    for (const [x, z] of [[-0.2, -0.32], [0.2, -0.32], [-0.2, 0.36], [0.2, 0.36]]) {
      const pata = new THREE.Group();
      pata.position.set(x, 0.42, z);
      pata.add(pieza(new THREE.CylinderGeometry(0.06, 0.045, 0.42, 6), matCarbon, 0, -0.21, 0));
      cuerpo.add(pata);
      ud.patas.push(pata);
    }
    for (const sx of [-1, 1]) {
      cuerpo.add(pieza(new THREE.SphereGeometry(0.06, 8, 6), matOjoZombi, sx * 0.12, 0.66, -0.66));
      const oreja = pieza(new THREE.ConeGeometry(0.06, 0.22, 6), matCarbon, sx * 0.14, 0.82, -0.5);
      oreja.rotation.z = -sx * 0.4;
      cuerpo.add(oreja);
    }
    for (const [x, z] of [[0, 0.1], [0.08, -0.15], [-0.07, 0.3], [0, -0.35]]) cuerpo.add(pieza(new THREE.SphereGeometry(0.05, 6, 5), matBrasa, x, 0.78, z));
    const cola = pieza(new THREE.CylinderGeometry(0.02, 0.05, 0.4, 6), matCarbon, 0, 0.65, 0.72);
    cola.rotation.x = -0.9;
    cuerpo.add(cola);
  } else if (tipo === 't') {
    // El tóxico: un huevo verde chillón que se arrastra con los brazos, con
    // burbujas de gas que le revientan en la cáscara.
    const tendido = new THREE.Group();
    tendido.rotation.x = -1.32;
    tendido.position.set(0, 0.3, 0.75);
    casco.scale.set(0.95, 0.95, 0.85);
    tendido.add(casco);
    for (const [y, a, r] of [[0.5, 0.4, 0.09], [0.8, 2.1, 0.07], [1.1, 3.9, 0.08], [1.3, 5.2, 0.06], [0.3, 1.2, 0.07]])
      tendido.add(pieza(new THREE.SphereGeometry(r, 8, 6), matGas, Math.cos(a) * 0.4, y, Math.sin(a) * 0.4));
    cuerpo.add(tendido);
    for (const sx of [-1, 1]) {
      cuerpo.add(pieza(new THREE.SphereGeometry(0.07, 10, 6), matOjoZombi, sx * 0.14, 0.45, -0.95));
      const brazo = pieza(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), casco.material, sx * 0.34, 0.12, -1.0);
      brazo.rotation.x = Math.PI / 2;
      cuerpo.add(brazo);
    }
    ud.repta = true;
  } else {
    cuerpo.add(casco);
    if (tipo === 'c') casco.scale.set(0.88, 1.04, 0.88);
    if (tipo === 'x') casco.scale.set(0.82, 1.08, 0.82);
    const manchas = tipo === 'f' ? matCarbon : matMoho;
    for (const [y, a, s] of [[0.5, 0.6, 0.11], [0.9, 2.4, 0.09], [1.25, 4.1, 0.08], [0.35, 3.3, 0.12], [1.05, 5.5, 0.1]]) {
      const t = y / ALTO, u = 2 * t - 1;
      const r = 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u) * 0.97;
      cuerpo.add(pieza(new THREE.SphereGeometry(s, 8, 6), manchas, Math.cos(a) * r, y, Math.sin(a) * r));
    }
    // El Mutante tiene ojos propios (se encienden al embestir).
    const ojo = tipo === 'j' ? () => new THREE.MeshLambertMaterial({ color: '#ffd23a', emissive: '#ffb000', emissiveIntensity: 1 }) : () => matOjoZombi;
    ud.ojos = [];
    for (const sx of [-1, 1]) {
      const o = pieza(new THREE.SphereGeometry(0.075, 10, 6), ojo(), sx * 0.15, 1.16, -0.43);
      cuerpo.add(o); ud.ojos.push(o);
      const grueso = tipo === 'j' ? 1.6 : 1;
      const brazo = pieza(new THREE.CylinderGeometry(0.06 * grueso, 0.07 * grueso, 0.55, 8), tipo === 'j' ? matCarbon : matPodrido, sx * 0.36, 0.95, -0.42);
      brazo.rotation.x = Math.PI / 2;
      cuerpo.add(brazo);
      ud.brazos.push(brazo);
    }
    if (tipo === 'f') for (const [x, y, z] of [[0.2, 0.7, -0.38], [-0.3, 1.0, -0.25], [0.1, 1.35, -0.3], [-0.1, 0.45, 0.42], [0.35, 1.1, 0.2]])
      cuerpo.add(pieza(new THREE.SphereGeometry(0.06, 6, 5), matBrasa, x, y, z));
    if (tipo === 'x') {
      // El chillón: una boca enorme que se abre al gritar.
      ud.boca = pieza(new THREE.SphereGeometry(0.13, 12, 8), matBoca, 0, 0.92, -0.42);
      ud.boca.scale.set(1.1, 0.5, 0.4);
      cuerpo.add(ud.boca);
    }
    if (tipo === 'k') {
      // Un casco de acero que salta al romperse.
      const yelmo = new THREE.Group();
      yelmo.add(pieza(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matAcero, 0, 1.3, 0));
      yelmo.add(pieza(new THREE.CylinderGeometry(0.47, 0.47, 0.04, 18), matAcero, 0, 1.31, 0));
      cuerpo.add(yelmo);
      ud.yelmo = yelmo;
    }
    if (tipo === 'j') {
      // El Mutante: púas en el lomo, placas de hierro y una cicatriz.
      for (let i = 0; i < 5; i++) {
        const pua = pieza(new THREE.ConeGeometry(0.07, 0.32, 6), matAcero, 0, 0.55 + i * 0.22, 0.42 - Math.abs(i - 2) * 0.03);
        pua.rotation.x = 0.9;
        cuerpo.add(pua);
      }
      for (const sx of [-1, 1]) cuerpo.add(pieza(new THREE.BoxGeometry(0.22, 0.12, 0.3), matAcero, sx * 0.42, 1.2, 0));
      cuerpo.add(pieza(new THREE.BoxGeometry(0.5, 0.05, 0.02), matBoca, 0, 1.0, -0.46));
    }
  }
  g.scale.setScalar(tipo === 'p' || tipo === 't' ? 1 : escala);
  g.userData = ud;
  return g;
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
