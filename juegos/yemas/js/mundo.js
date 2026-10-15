// Mapa, física de cuerpos y rayos. Todo lo que es geometría vive acá.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

// El piso de la arena: baldosas de cocina, con su fragüe y algo de desgaste.
function texturaPiso() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#efd9bb'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
  manchas(g, 256, 60, 'rgba(120,90,50,0.05)', 'rgba(255,255,255,0.06)');
  grano(g, 256, 2500, 0.05);
  g.strokeStyle = 'rgba(110,90,70,0.35)'; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
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
    const etiquetas = [];
    for (const [cx, cz, w, d, h, y0, color] of disenoCajas()) {
      colisores.push({ minx: cx - w / 2, maxx: cx + w / 2, miny: y0, maxy: y0 + h, minz: cz - d / 2, maxz: cz + d / 2 });
      if (color === '#e0a458') { cajaDeHuevos(lote, etiquetas, cx, cz, w, d, h, y0); continue; }
      lote.caja(color, cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2);
      // Arriba de cada pilar, un huevo gigante en su huevera.
      if (color === '#e8a0a8') huevoGigante(lote, cx, y0 + h, cz);
    }
    // En la torre del centro, un huevo frito del tamaño de una cama.
    friteGigante(lote, 0, 3, 0);
    lote.monta(grupo);
    if (etiquetas.length) {
      const m = new THREE.Mesh(mergeGeometries(etiquetas), new THREE.MeshLambertMaterial({ map: texturaEtiqueta(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.receiveShadow = true;
      grupo.add(m);
    }
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
// Lo fijo del mapa lleva el grano de `texturaDetalle` (con coordenadas del
// mundo, así una pared de diez metros no estira la textura) y la sombra de
// contacto en los colores de vértice.
function lambertC(color) {
  if (!_lam.has(color)) _lam.set(color, new THREE.MeshLambertMaterial({ color, map: texturaDetalle(), vertexColors: true }));
  return _lam.get(color);
}

// ---------- Texturas pintadas a mano (en un canvas) ----------
// Un azar con semilla: el mismo mapa se ve igual en todas las pantallas.
function azarCon(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function manchas(g, lado, n, oscura, clara, az = azarCon(11)) {
  for (let i = 0; i < n; i++) {
    const x = az() * lado, y = az() * lado, r = lado * (0.04 + az() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, az() < 0.6 ? oscura : clara);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}
function grano(g, lado, n, fuerza, az = azarCon(5)) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = az() < 0.5 ? `rgba(0,0,0,${fuerza})` : `rgba(255,255,255,${fuerza})`;
    const r = 1 + az() * 2.2;
    g.fillRect(az() * lado, az() * lado, r, r);
  }
}
function canvasTex(cv, repetir = true) {
  const t = new THREE.CanvasTexture(cv);
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// El grano de las superficies del mapa: casi blanco (multiplica al color de
// cada pieza), con manchas de humedad, poros y alguna raya.
let _detalle = null;
const ESCALA_DETALLE = 2.4;   // metros por repetición
function texturaDetalle() {
  if (_detalle) return _detalle;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
  manchas(g, 256, 70, 'rgba(60,50,40,0.07)', 'rgba(255,255,255,0.10)');
  grano(g, 256, 5000, 0.05);
  const az = azarCon(23);
  g.strokeStyle = 'rgba(50,40,30,0.10)'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    let x = az() * 256, y = az() * 256, a = az() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { a += (az() - 0.5) * 0.8; x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); }
    g.stroke();
  }
  _detalle = canvasTex(cv);
  return _detalle;
}
// La etiqueta de las cajas de huevos de la arena.
function texturaEtiqueta() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff6e2'; g.fillRect(16, 60, 224, 136);
  g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.strokeRect(16, 60, 224, 136);
  g.fillStyle = '#c0392b'; g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('HUEVOS', 128, 112);
  g.font = 'bold 26px system-ui, sans-serif'; g.fillStyle = '#7a4a26';
  g.fillText('de campo · 12 un.', 128, 148);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = '#f3e3c3'; g.strokeStyle = '#a0784a'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(56 + i * 36, 176, 12, 15, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  return canvasTex(cv, false);
}

// Una caja de huevos de cartón: el cuerpo, los relieves de las cubetas a los
// costados y la etiqueta en cada cara. Choca como la caja de siempre.
function cajaDeHuevos(lote, etiquetas, cx, cz, w, d, h, y0) {
  const carton = '#d8c49e', relieve = '#cdb68c';
  lote.caja(carton, cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2);
  // La tapa, un poco más ancha, con su ceja.
  lote.caja(relieve, cx - w / 2 - 0.04, y0 + h - 0.12, cz - d / 2 - 0.04, cx + w / 2 + 0.04, y0 + h, cz + d / 2 + 0.04);
  const cubeta = new THREE.CylinderGeometry(0.22, 0.22, h - 0.3, 12, 1, false, 0, Math.PI);
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const largo = nz ? w : d;
    for (const f of [-0.36, 0.36]) {
      const x = cx + nx * (w / 2 - 0.16) + (nz ? f * largo : 0);
      const z = cz + nz * (d / 2 - 0.16) + (nx ? f * largo : 0);
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + (h - 0.3) / 2 + 0.05, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(nx, nz) - Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1));
      lote.agrega(relieve, cubeta.clone(), m4, false, true);
    }
    const et = new THREE.PlaneGeometry(largo * 0.45, largo * 0.45);
    et.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(cx + nx * (w / 2 + 0.01), y0 + h * 0.55, cz + nz * (d / 2 + 0.01)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(nx, nz), 0)), new THREE.Vector3(1, 1, 1)));
    etiquetas.push(et);
  }
  cubeta.dispose();
}
// Un huevo gigante parado en su huevera, encima de un pilar.
function huevoGigante(lote, x, y, z) {
  lote.agrega('#f1e4cc', new THREE.CylinderGeometry(0.62, 0.42, 0.45, 20), new THREE.Matrix4().makeTranslation(x, y + 0.22, z), false, true);
  lote.agrega('#f1e4cc', new THREE.TorusGeometry(0.6, 0.06, 8, 24), new THREE.Matrix4().makeTranslation(x, y + 0.45, z).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), false, true);
  lote.agrega('#fbf6ec', geometriaHuevo().clone(), new THREE.Matrix4().makeTranslation(x, y + 0.2, z).multiply(new THREE.Matrix4().makeScale(1.15, 0.9, 1.15)), false, true);
}
// El huevo frito de la torre: una clara de borde ondulado y la yema encima.
function friteGigante(lote, x, y, z) {
  const f = new THREE.Shape(), az = azarCon(3);
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 2.3 * (1 + 0.12 * Math.sin(a * 4 + 1) + 0.06 * Math.sin(a * 9) + (az() - 0.5) * 0.04);
    if (i === 0) f.moveTo(Math.cos(a) * r, Math.sin(a) * r); else f.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const giro = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  lote.agrega('#e6b862', new THREE.ShapeGeometry(f).scale(1.06, 1.06, 1), new THREE.Matrix4().makeTranslation(x, y + 0.01, z).multiply(giro), false, false);
  lote.agrega('#fffaf0', new THREE.ShapeGeometry(f), new THREE.Matrix4().makeTranslation(x, y + 0.02, z).multiply(giro), false, false);
  lote.agrega('#ffb000', new THREE.SphereGeometry(0.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().makeTranslation(x + 0.4, y + 0.02, z - 0.3).multiply(new THREE.Matrix4().makeScale(1, 0.32, 1)), false, true);
}

// Junta todo lo fijo en una malla por material: un mapa son cientos de
// piezas, y cientos de llamadas de dibujo (el doble con sombras) se notan.
// Al juntar, cada vértice recibe coordenadas de textura según su cara (las
// del mundo, a escala fija) y un color: más oscuro abajo (la sombra donde la
// pared toca el piso) y un matiz apenas distinto por pieza, para que veinte
// cajas iguales no parezcan copiadas.
class Lote {
  constructor() { this.g = new Map(); this.az = azarCon(17); }
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
    g.userData.matiz = 0.93 + this.az() * 0.11;
    this.g.get(k).push(g);
  }
  monta(grupo) {
    for (const [k, geos] of this.g) {
      const [color, brilla, sombra] = k.split('|');
      let n = 0;
      for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
      let i = 0;
      for (const g of geos) {
        const p = g.attributes.position.array, nn = g.attributes.normal.array, c = g.attributes.position.count;
        pos.set(p, i * 3);
        nor.set(nn, i * 3);
        for (let v = 0; v < c; v++) {
          const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
          const ax = Math.abs(nn[v * 3]), ay = Math.abs(nn[v * 3 + 1]), az = Math.abs(nn[v * 3 + 2]);
          const j = i + v;
          if (ay >= ax && ay >= az) { uv[j * 2] = x / ESCALA_DETALLE; uv[j * 2 + 1] = z / ESCALA_DETALLE; }
          else if (ax >= az) { uv[j * 2] = z / ESCALA_DETALLE; uv[j * 2 + 1] = y / ESCALA_DETALLE; }
          else { uv[j * 2] = x / ESCALA_DETALLE; uv[j * 2 + 1] = y / ESCALA_DETALLE; }
          const sombraPie = 0.66 + 0.34 * Math.min(1, Math.max(0, y) / 1.8);
          const s = Math.min(1.05, sombraPie * g.userData.matiz);
          col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = s;
        }
        i += c;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
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
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  manchas(g, 256, 90, 'rgba(0,0,0,0.13)', 'rgba(255,255,255,0.07)', azarCon(7));
  grano(g, 256, 4200, 0.09, azarCon(9));
  // Piedritas y grietas.
  const az = azarCon(13);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = az() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.10)';
    g.beginPath(); g.ellipse(az() * 256, az() * 256, 1.5 + az() * 3, 1 + az() * 2, az() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let x = az() * 256, y = az() * 256, a = az() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 10; k++) { a += (az() - 0.5) * 1; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
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

// La cáscara de los huevos: casi blanca (la tiñe el color de cada uno), con
// pintitas y manchas apenas visibles, como un huevo de verdad.
let _cascara = null;
function texturaCascara() {
  if (_cascara) return _cascara;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  manchas(g, 256, 30, 'rgba(120,100,80,0.06)', 'rgba(255,255,255,0.05)', azarCon(31));
  const az = azarCon(37);
  for (let i = 0; i < 170; i++) {
    g.fillStyle = `rgba(110,80,50,${0.05 + az() * 0.12})`;
    g.beginPath(); g.arc(az() * 256, az() * 256, 0.6 + az() * 1.6, 0, Math.PI * 2); g.fill();
  }
  _cascara = canvasTex(cv);
  return _cascara;
}
// La de los zombis: moho, mugre y grietas oscuras que se ramifican.
let _grietas = null;
function texturaGrietas() {
  if (_grietas) return _grietas;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  manchas(g, 256, 55, 'rgba(50,60,20,0.32)', 'rgba(255,255,230,0.12)', azarCon(41));
  grano(g, 256, 4000, 0.07, azarCon(43));
  const az = azarCon(47);
  g.lineCap = 'round';
  const grieta = (x, y, a, n, w) => {
    g.lineWidth = w; g.strokeStyle = 'rgba(25,15,5,0.85)';
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < n; i++) {
      a += (az() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6;
      g.lineTo(x, y);
      if (az() < 0.14 && w > 0.9) { g.stroke(); grieta(x, y, a + (az() < 0.5 ? 1 : -1) * 0.9, n >> 1, w * 0.6); g.lineWidth = w; g.beginPath(); g.moveTo(x, y); }
    }
    g.stroke();
  };
  for (let i = 0; i < 8; i++) grieta(az() * 256, az() * 256, az() * 6.28, 12 + Math.floor(az() * 14), 2.4);
  _grietas = canvasTex(cv);
  return _grietas;
}
// Un halo que brilla (los ojos de los zombis, como en Call of Duty).
let _halo = null;
function halo(color, escala) {
  if (!_halo) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    _halo = canvasTex(cv, false);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _halo, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(escala);
  return s;
}

const matOjo = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18 });
const matPupila = new THREE.MeshStandardMaterial({ color: '#15151a', roughness: 0.15 });
const matBrillito = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const matCeja = new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.8 });
const matBoquita = new THREE.MeshStandardMaterial({ color: '#5a2219', roughness: 0.6 });
const matPata = new THREE.MeshStandardMaterial({ color: '#f0a33a', roughness: 0.55 });
const matGuante = new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.5 });

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

// Junta las mallas hijas directas de `grupo` que comparten material en una
// sola (menos llamadas de dibujo); `deja` son las que se animan aparte.
function funde(grupo, deja = []) {
  const por = new Map();
  for (const o of grupo.children) {
    if (!o.isMesh || deja.includes(o) || o.geometry === geoHuevo) continue;
    if (!por.has(o.material)) por.set(o.material, []);
    por.get(o.material).push(o);
  }
  for (const [mat, ms] of por) {
    if (ms.length < 2) continue;
    const m = new THREE.Mesh(mergeGeometries(ms.map(x => { x.updateMatrix(); return x.geometry.clone().applyMatrix4(x.matrix); })), mat);
    m.castShadow = ms.some(x => x.castShadow);
    for (const x of ms) { grupo.remove(x); x.geometry.dispose(); }
    grupo.add(m);
  }
}

// ---------- Manos y patas ----------
// Un huevo no tiene brazos: las manos son guantes blancos de dibujo animado
// que flotan al lado del arma, como las de Rayman. Cerrados alrededor de una
// empuñadura vertical en el origen (el arma mira hacia -z); `lado` 1 es la
// derecha, -1 la izquierda (el mismo guante en espejo).
let geoGuante = null;
export function crearGuante(lado = 1, mat = matGuante) {
  geoGuante ||= {
    palma: new THREE.SphereGeometry(0.04, 14, 10).scale(0.8, 1.05, 1.05),
    dedo: new THREE.CapsuleGeometry(0.0125, 0.03, 4, 8),
    pulgar: new THREE.CapsuleGeometry(0.0135, 0.026, 4, 8),
    puno: new THREE.TorusGeometry(0.03, 0.013, 8, 18),
  };
  const g = new THREE.Group();
  const palma = new THREE.Mesh(geoGuante.palma, mat);
  palma.position.set(0.028, 0, 0.012);
  g.add(palma);
  // Los cuatro dedos, cruzados por delante de la empuñadura, de arriba abajo.
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(geoGuante.dedo, mat);
    d.position.set(0.004, 0.03 - i * 0.02, -0.024);
    d.rotation.set(0, 0.35, Math.PI / 2);
    g.add(d);
  }
  const pulgar = new THREE.Mesh(geoGuante.pulgar, mat);
  pulgar.position.set(-0.016, 0.035, 0.0);
  pulgar.rotation.set(-0.9, 0, -0.5);
  g.add(pulgar);
  const puno = new THREE.Mesh(geoGuante.puno, mat);
  puno.position.set(0.034, -0.03, 0.04);
  puno.rotation.set(0.9, 0.5, 0);
  g.add(puno);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.guante = true; } });
  if (lado < 0) g.scale.x = -1;
  return g;
}

// Una pata de pollo: la canilla y tres dedos adelante (y uno atrás). Cuelga
// de la cadera (el origen), así se la balancea girándola en x.
function crearPata(mat = matPata, largo = 0.16, grueso = 1) {
  const g = new THREE.Group();
  g.add(pieza(new THREE.CylinderGeometry(0.028 * grueso, 0.022 * grueso, largo, 8), mat, 0, -largo / 2, 0));
  for (const a of [-0.55, 0, 0.55, Math.PI]) {
    const l = a === Math.PI ? 0.035 : 0.06;
    const dedo = pieza(new THREE.CapsuleGeometry(0.017 * grueso, l, 4, 6), mat, -Math.sin(a) * (l / 2 + 0.015), -largo + 0.016, -Math.cos(a) * (l / 2 + 0.015));
    dedo.rotation.set(-Math.PI / 2, a, 0, 'YXZ');
    g.add(dedo);
  }
  funde(g);
  return g;
}

// La cáscara va un poco levantada (y apenas achatada) para que se vean las
// patas, con la misma altura total de siempre: la del blanco de las balas.
const PIERNA = 0.12;
function cascaraSobrePatas() {
  const c = new THREE.Group();
  c.position.y = PIERNA;
  c.scale.y = (ALTO - PIERNA) / ALTO;
  return c;
}

export function crearHuevo(color, nombre, skin = 'clasico') {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const cascara = cascaraSobrePatas();
  cuerpo.add(cascara);

  const casco = new THREE.Mesh(geometriaHuevo(), new THREE.MeshStandardMaterial({ color, roughness: 0.33, map: texturaCascara() }));
  casco.castShadow = true;
  cascara.add(casco);

  // Ojos grandes con su brillito (y párpados: el bucle los cierra al pestañear),
  // cejas de pocos amigos y una sonrisa.
  const ojos = [];
  for (const sx of [-1, 1]) {
    const ojo = new THREE.Group();
    ojo.position.set(sx * 0.15, 1.18, -0.355);
    const blanco = pieza(new THREE.SphereGeometry(0.1, 16, 12), matOjo, 0, 0, 0);
    blanco.scale.z = 0.8;
    const pup = pieza(new THREE.SphereGeometry(0.052, 12, 8), matPupila, -sx * 0.008, -0.006, -0.068);
    pup.scale.z = 0.55;
    ojo.add(blanco, pup, pieza(new THREE.SphereGeometry(0.016, 8, 6), matBrillito, 0.018, 0.02, -0.092));
    cascara.add(ojo);
    ojos.push(ojo);
    const ceja = pieza(new THREE.CapsuleGeometry(0.019, 0.09, 4, 8), matCeja, sx * 0.15, 1.315, -0.37);
    ceja.rotation.set(-0.35, 0, Math.PI / 2 + sx * 0.3);
    cascara.add(ceja);
  }
  const boca = pieza(new THREE.TorusGeometry(0.06, 0.013, 6, 14, Math.PI), matBoquita, 0, 1.0, -0.465);
  boca.rotation.set(-0.2, 0, Math.PI);
  cascara.add(boca);

  const pies = [];
  for (const sx of [-1, 1]) {
    const p = crearPata(matPata, PIERNA + 0.04);
    p.position.set(sx * 0.16, PIERNA + 0.04, 0.02);
    cuerpo.add(p);
    pies.push(p);
  }

  // Donde va el arma (con sus guantes): la pone main.js según lo que lleva.
  const mano = new THREE.Group();
  mano.position.set(0.3, 0.86, -0.32);
  cuerpo.add(mano);
  const punta = new THREE.Object3D();
  punta.position.set(0.32, 0.9, -0.85);
  cuerpo.add(punta);

  ponSkin(cascara, skin);

  const tag = etiqueta(nombre);
  tag.position.y = ALTO + (skin === 'chef' ? 0.6 : 0.35);
  g.add(tag);

  g.userData = { cuerpo, punta, casco, mano, pies, ojos, parpadeo: 1 + Math.random() * 3 };
  return g;
}

// ---------- Zombis ----------
// Un huevo podrido: cáscara verdosa, agrietada y con moho, la yema que se le
// sale por arriba, ojos que brillan (amarillos, como en Call of Duty), una
// boca de dientes chuecos, brazos estirados con garras y patas de pollo que
// arrastran. Mismo tamaño que un huevo, así que las balas usan el mismo
// elipsoide (`rayoHuevo`).
const matPodrido = new THREE.MeshStandardMaterial({ color: '#8fa36b', roughness: 0.85, map: texturaGrietas() });
const matMoho = new THREE.MeshStandardMaterial({ color: '#4f6136', roughness: 0.95 });
const matOjoZombi = new THREE.MeshBasicMaterial({ color: '#ffd23a' });
const matOjoRojo = new THREE.MeshBasicMaterial({ color: '#ff3b2f' });
const matCarbon = new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: 0.9 });
const matBrasa = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });
const matAcero = new THREE.MeshStandardMaterial({ color: '#8d949c', metalness: 0.85, roughness: 0.32 });
const matGas = new THREE.MeshBasicMaterial({ color: '#7dff3a', transparent: true, opacity: 0.85 });
const matBoca = new THREE.MeshBasicMaterial({ color: '#1a0606' });
const matDiente = new THREE.MeshStandardMaterial({ color: '#e6dcae', roughness: 0.5 });
const matYemaPodrida = new THREE.MeshStandardMaterial({ color: '#e0b41c', emissive: '#3a2a00', roughness: 0.18 });
const matPataZ = new THREE.MeshStandardMaterial({ color: '#8c8f5a', roughness: 0.85 });
const matUna = new THREE.MeshStandardMaterial({ color: '#2b2418', roughness: 0.6 });
// La gallina infernal.
const matCresta = new THREE.MeshStandardMaterial({ color: '#d61f16', emissive: '#4a0000', roughness: 0.5 });
const matPico = new THREE.MeshStandardMaterial({ color: '#f2b233', roughness: 0.4 });
const matPataGallina = new THREE.MeshStandardMaterial({ color: '#e8a92e', roughness: 0.6 });
// El color de la cáscara y cuánto brilla, por tipo (TIPOS en zombis.js).
const PIEL = {
  n: ['#8fa36b'], c: ['#c2b357'], g: ['#5d7a3c'], p: ['#3b2622', '#3a0800'], t: ['#a7c43a', '#2f6a10'],
  f: ['#c24a1a', '#6a1d00'], x: ['#e3dcc8'], j: ['#5b4a63', '#1a0a20'], k: ['#7d9460'],
};
// La forma la dibuja este archivo, pero la medida de las balas (`escala`,
// `alto`) es la de FORMA en zombis.js: aquí se copia para no importar al revés.
const MEDIDA_Z = { g: [1.3, 1], p: [1.1, 0.37], t: [1, 0.42], f: [1.12, 1], x: [0.95, 1], j: [1.9, 1], k: [1.05, 1] };

// Un brazo que cuelga del hombro (el origen del grupo): girado π/2 en x
// apunta hacia adelante; zombis.js lo sube al trepar y al zarpazo.
function brazoZombi(mat, grueso, sx) {
  const b = new THREE.Group();
  b.position.set(sx * 0.36, 0.98, -0.16);
  b.add(pieza(new THREE.CylinderGeometry(0.06 * grueso, 0.07 * grueso, 0.5, 8), mat, 0, -0.25, 0));
  const mano = new THREE.Group();
  mano.position.y = -0.54;
  const palma = pieza(new THREE.SphereGeometry(0.07 * grueso, 10, 8), mat, 0, 0, 0);
  palma.scale.set(1.1, 0.8, 0.7);
  mano.add(palma);
  for (const a of [-1, 0, 1]) {
    const una = pieza(new THREE.ConeGeometry(0.018 * grueso, 0.11 * grueso, 6), matUna, a * 0.04 * grueso, -0.08 * grueso, 0.01);
    una.rotation.set(Math.PI, 0, a * 0.25);
    mano.add(una);
  }
  funde(mano, [palma]);
  b.add(mano);
  b.rotation.x = Math.PI / 2;
  return b;
}
// La yema que se le sale por la grieta de arriba, con chorreones.
function yemaQueSale(cascara) {
  const y = pieza(new THREE.SphereGeometry(0.16, 16, 10), matYemaPodrida, 0.04, 1.62, 0.02);
  y.scale.set(1, 0.42, 1);
  cascara.add(y);
  for (const [a, l] of [[0.6, 0.16], [2.3, 0.24], [4.2, 0.12], [5.4, 0.2]]) {
    const t = (1.58 - l / 2) / ALTO, u = 2 * t - 1;
    const r = 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u);
    const c = pieza(new THREE.CapsuleGeometry(0.028, l, 4, 8), matYemaPodrida, Math.cos(a) * r, 1.58 - l / 2, Math.sin(a) * r);
    c.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    cascara.add(c);
  }
}
// La boca: un hueco oscuro con dientes chuecos arriba.
function bocaZombi(cascara, ud, grande) {
  const s = grande ? 1.25 : 1;
  ud.boca = pieza(new THREE.SphereGeometry(0.12 * s, 12, 8), matBoca, 0, 0.93, -0.43);
  ud.boca.scale.set(1.15, 0.5, 0.45);
  cascara.add(ud.boca);
  for (let i = 0; i < 5; i++) {
    const d = pieza(new THREE.ConeGeometry(0.018, 0.05 + (i % 2) * 0.02, 5), matDiente, (i - 2) * 0.04 * s, 0.95, -0.475 + Math.abs(i - 2) * 0.012);
    d.rotation.set(Math.PI, 0, (i - 2) * 0.12);
    cascara.add(d);
  }
}
function ojosZombi(padre, ud, mat, color, pos, r = 0.07) {
  ud.ojos = [];
  for (const sx of [-1, 1]) {
    const o = pieza(new THREE.SphereGeometry(r, 10, 8), mat, sx * pos[0], pos[1], pos[2]);
    padre.add(o);
    ud.ojos.push(o);
    const h = halo(color, r * 4.2);
    h.position.set(sx * pos[0], pos[1], pos[2] - 0.02);
    padre.add(h);
  }
}

// `tipo`: ver TIPOS en zombis.js. Todos guardan en `userData` lo que anima
// zombis.js: `cuerpo` (se bambolea), `casco` (la cáscara, la que destella al
// recibir un balazo), `brazos`, `piernas`, y según el tipo `patas` (la
// gallina), `alas`, `cabeza`, `repta`, `yelmo`, `boca` y `ojos`.
export function crearZombi(tipo = 'n') {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const [color, brillo] = PIEL[tipo] || PIEL.n;
  const casco = new THREE.Mesh(geometriaHuevo(), matPodrido.clone());
  casco.material.color.set(color);
  if (brillo) casco.material.emissive.set(brillo);
  casco.castShadow = true;
  const ud = { cuerpo, casco, brazos: [], base: casco.material.emissive.clone() };
  const [escala, alto] = MEDIDA_Z[tipo] || [1, 1];
  ud.escala = escala; ud.alto = alto;

  if (tipo === 'p') {
    // La gallina infernal: plumas chamuscadas con brasas en el lomo, la
    // cresta roja, el pico, alas que aletean, la cola en abanico y dos patas
    // de pollo que corren. Ojos rojos encendidos.
    casco.geometry = new THREE.SphereGeometry(0.3, 18, 14);
    casco.material.map = null;
    casco.material.roughness = 0.95;
    casco.scale.set(0.85, 0.78, 1.15);
    casco.position.set(0, 0.4, 0.04);
    cuerpo.add(casco);
    const cuello = pieza(new THREE.CylinderGeometry(0.08, 0.12, 0.22, 10), casco.material, 0, 0.5, -0.2);
    cuello.rotation.x = 0.7;
    cuerpo.add(cuello);
    const cabeza = new THREE.Group();
    cabeza.position.set(0, 0.58, -0.3);
    cabeza.add(pieza(new THREE.SphereGeometry(0.12, 14, 10), casco.material, 0, 0, 0));
    for (const [z, y, r] of [[-0.04, 0.12, 0.042], [0.01, 0.145, 0.05], [0.06, 0.13, 0.044], [0.1, 0.1, 0.034]]) {
      const c = pieza(new THREE.SphereGeometry(r, 10, 8), matCresta, 0, y, z);
      c.scale.x = 0.45;
      cabeza.add(c);
    }
    const pico = pieza(new THREE.ConeGeometry(0.04, 0.12, 8), matPico, 0, -0.01, -0.15);
    pico.rotation.x = -Math.PI / 2;
    cabeza.add(pico);
    const barbilla = pieza(new THREE.SphereGeometry(0.032, 8, 6), matCresta, 0, -0.075, -0.1);
    barbilla.scale.y = 1.6;
    cabeza.add(barbilla);
    ojosZombi(cabeza, ud, matOjoRojo, '#ff3b2f', [0.085, 0.03, -0.075], 0.026);
    cuerpo.add(cabeza);
    ud.cabeza = cabeza;
    ud.alas = [];
    for (const sx of [-1, 1]) {
      const ala = new THREE.Group();
      ala.position.set(sx * 0.23, 0.5, 0.0);
      const pluma = pieza(new THREE.SphereGeometry(0.2, 12, 8), matCarbon, sx * 0.03, -0.07, 0.06);
      pluma.scale.set(0.22, 0.55, 1);
      ala.add(pluma);
      cuerpo.add(ala);
      ud.alas.push(ala);
    }
    for (let i = 0; i < 4; i++) {
      const p = pieza(new THREE.SphereGeometry(0.13, 10, 8), i % 2 ? matCarbon : casco.material, (i - 1.5) * 0.06, 0.62, 0.36);
      p.scale.set(0.22, 1, 0.45);
      p.rotation.set(-0.5, 0, (i - 1.5) * 0.35);
      cuerpo.add(p);
    }
    for (const [x, z] of [[0, 0.05], [0.07, -0.08], [-0.06, 0.18], [0.02, 0.28]]) cuerpo.add(pieza(new THREE.SphereGeometry(0.035, 6, 5), matBrasa, x, 0.66, z));
    ud.patas = [];
    for (const sx of [-1, 1]) {
      const pata = crearPata(matPataGallina, 0.27, 0.8);
      pata.position.set(sx * 0.1, 0.29, 0.06);
      cuerpo.add(pata);
      ud.patas.push(pata);
    }
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
    ojosZombi(cuerpo, ud, matOjoZombi, '#c8ff3a', [0.14, 0.45, -0.95]);
    for (const sx of [-1, 1]) {
      const brazo = pieza(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), casco.material, sx * 0.34, 0.12, -1.0);
      brazo.rotation.x = Math.PI / 2;
      cuerpo.add(brazo);
    }
    ud.repta = true;
  } else {
    const cascara = cascaraSobrePatas();
    cuerpo.add(cascara);
    cascara.add(casco);
    if (tipo === 'c') casco.scale.set(0.88, 1.04, 0.88);
    if (tipo === 'x') casco.scale.set(0.82, 1.08, 0.82);
    const manchas = tipo === 'f' ? matCarbon : matMoho;
    for (const [y, a, s] of [[0.5, 0.6, 0.11], [0.9, 2.4, 0.09], [1.25, 4.1, 0.08], [0.35, 3.3, 0.12], [1.05, 5.5, 0.1]]) {
      const t = y / ALTO, u = 2 * t - 1;
      const r = 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u) * 0.97;
      const m = pieza(new THREE.SphereGeometry(s, 8, 6), manchas, Math.cos(a) * r, y, Math.sin(a) * r);
      m.scale.set(1, 0.8, 0.5);
      m.lookAt(0, y, 0);
      cascara.add(m);
    }
    // El Mutante tiene ojos propios (se encienden al embestir).
    if (tipo === 'j') {
      const ojo = () => new THREE.MeshLambertMaterial({ color: '#ffd23a', emissive: '#ffb000', emissiveIntensity: 1 });
      ud.ojos = [];
      for (const sx of [-1, 1]) { const o = pieza(new THREE.SphereGeometry(0.075, 10, 6), ojo(), sx * 0.15, 1.16, -0.43); cascara.add(o); ud.ojos.push(o); }
    } else ojosZombi(cascara, ud, matOjoZombi, '#ffb000', [0.15, 1.16, -0.42]);
    if (tipo !== 'k' && tipo !== 'j' && tipo !== 'f') yemaQueSale(cascara);
    bocaZombi(cascara, ud, tipo === 'x');
    ud.piernas = [];
    for (const sx of [-1, 1]) {
      const p = crearPata(matPataZ, PIERNA + 0.04);
      p.position.set(sx * 0.17, PIERNA + 0.04, 0.02);
      cuerpo.add(p);
      ud.piernas.push(p);
    }
    for (const sx of [-1, 1]) {
      const b = brazoZombi(tipo === 'j' ? matCarbon : casco.material, tipo === 'j' ? 1.6 : 1, sx);
      cuerpo.add(b);
      ud.brazos.push(b);
    }
    if (tipo === 'f') for (const [x, y, z] of [[0.2, 0.7, -0.38], [-0.3, 1.0, -0.25], [0.1, 1.35, -0.3], [-0.1, 0.45, 0.42], [0.35, 1.1, 0.2]])
      cascara.add(pieza(new THREE.SphereGeometry(0.06, 6, 5), matBrasa, x, y, z));
    if (tipo === 'k') {
      // Un casco de acero que salta al romperse.
      const yelmo = new THREE.Group();
      yelmo.add(pieza(new THREE.SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), matAcero, 0, 1.3, 0));
      yelmo.add(pieza(new THREE.CylinderGeometry(0.47, 0.47, 0.04, 20), matAcero, 0, 1.31, 0));
      cascara.add(yelmo);
      ud.yelmo = yelmo;
    }
    if (tipo === 'j') {
      // El Mutante: púas en el lomo, placas de hierro y una cicatriz.
      for (let i = 0; i < 5; i++) {
        const pua = pieza(new THREE.ConeGeometry(0.07, 0.32, 6), matAcero, 0, 0.55 + i * 0.22, 0.42 - Math.abs(i - 2) * 0.03);
        pua.rotation.x = 0.9;
        cascara.add(pua);
      }
      for (const sx of [-1, 1]) cascara.add(pieza(new THREE.BoxGeometry(0.22, 0.12, 0.3), matAcero, sx * 0.42, 1.2, 0));
      cascara.add(pieza(new THREE.BoxGeometry(0.5, 0.05, 0.02), matBoca, 0.05, 1.32, -0.44));
    }
  }
  // Lo que no se mueve por separado se junta en una malla por material: con
  // 24 zombis en pie, cada pieza suelta era una llamada de dibujo más.
  const quietos = [casco, ud.boca, ...(ud.ojos || [])];
  g.traverse(o => { if (o.isGroup) funde(o, quietos); });
  g.traverse(o => { if (o.isMesh && o.geometry.parameters?.radius < 0.05) o.castShadow = false; });
  g.scale.setScalar(tipo === 'p' || tipo === 't' ? 1 : escala);
  g.userData = ud;
  return g;
}

// Al sacar un zombi de la escena: cada uno arma sus propias geometrías y
// materiales (menos la cáscara compartida y los materiales del módulo).
const COMPARTIDOS = new Set([matPodrido, matMoho, matOjoZombi, matOjoRojo, matCarbon, matBrasa, matAcero, matGas, matBoca,
  matDiente, matYemaPodrida, matPataZ, matUna, matCresta, matPico, matPataGallina]);
export function soltarZombi(mesh) {
  mesh.traverse(o => {
    if (o.geometry && o.geometry !== geoHuevo) o.geometry.dispose();
    if (o.material && !COMPARTIDOS.has(o.material)) o.material.dispose();
  });
}

// ---------- Armas tiradas ----------
// Los puntos donde aparecen: arriba de la torre, arriba de las cuatro
// plataformas y cuatro en el suelo. El orden es el `s` del registro (`recoge`),
// así que no se reordena. Hay tantos como YM_PUNTOS_ARMA en motor.js.
export const PUNTOS_ARMA = [
  [0, 3, 0], [24, 2.5, 24], [-24, 2.5, 24], [24, 2.5, -24], [-24, 2.5, -24],
  [20, 0, 10], [-20, 0, -10], [10, 0, -20],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

// Un nido de ramitas con paja al centro y el brillo de siempre debajo, para
// que se vea de lejos dónde aparece un arma.
const matRamita = new THREE.MeshStandardMaterial({ color: '#7a5532', roughness: 0.95 });
const matPaja = new THREE.MeshStandardMaterial({ color: '#d9b45a', roughness: 0.9 });
export function crearPedestal() {
  const g = new THREE.Group();
  const az = azarCon(71);
  const ramas = [];
  for (let i = 0; i < 3; i++) {
    const t = new THREE.TorusGeometry(0.64 - i * 0.06, 0.07, 6, 26);
    t.rotateX(Math.PI / 2);
    t.translate(0, 0.06 + i * 0.055, 0);
    ramas.push(t);
  }
  for (let i = 0; i < 26; i++) {
    const a = az() * Math.PI * 2, r = 0.5 + az() * 0.2;
    const c = new THREE.CylinderGeometry(0.012, 0.014, 0.35 + az() * 0.3, 4);
    c.rotateZ(Math.PI / 2 + (az() - 0.5) * 0.5);
    c.rotateY(-(a + Math.PI / 2) + (az() - 0.5) * 0.8);
    c.translate(Math.cos(a) * r, 0.05 + az() * 0.16, Math.sin(a) * r);
    ramas.push(c);
  }
  const nido = new THREE.Mesh(mergeGeometries(ramas), matRamita);
  nido.castShadow = nido.receiveShadow = true;
  const paja = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 8).scale(1, 0.16, 1), matPaja);
  paja.position.y = 0.07;
  paja.receiveShadow = true;
  const brillo = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.35, depthWrite: false })
  );
  brillo.position.y = 0.02;
  g.add(brillo, nido, paja);
  return g;
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
