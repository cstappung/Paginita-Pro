// Las armas: los modelos (redondeados, de cocina, con las piezas que se mueven
// sueltas), los guantes que las sostienen y todo lo que se anima en primera
// persona: el retroceso con resorte, el balanceo al mirar y al caminar, sacar
// el arma, las recargas pieza por pieza, el fogonazo y las vainas.
//
// Cada modelo mira hacia -z con la empuñadura en el origen, y guarda en
// `userData` lo que se anima: `boca` (de donde sale el tiro), `cargador`,
// `corredera`, `bomba`, `cerrojo`, `tapa`, `cohete`, `celda`, `giro`, y cómo se
// recarga (`recarga`). El arma tirada en el piso, la de la pared y la de la
// caja usan `construyeArma` (sin guantes); la de la mano y la de los huevos de
// los demás, `armaConManos`.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARMAS, ESPATULA, MAQUINA } from 'yemas/armas';
import { crearGuante } from 'yemas/mundo';

// ---------- Materiales ----------
// Compartidos por todos los modelos: quien desarma uno no los tira
// (`userData.compartido`).
function texturaMadera() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 256);
  let s = 9;
  const az = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 28; i++) {
    g.strokeStyle = `rgba(70,38,16,${0.08 + az() * 0.2})`;
    g.lineWidth = 0.6 + az() * 2;
    g.beginPath();
    let x = az() * 64;
    g.moveTo(x, 0);
    for (let y = 16; y <= 256; y += 16) { x += (az() - 0.5) * 3; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const marca = m => { m.userData.compartido = true; return m; };
const std = (color, o = {}) => marca(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...o }));
const M = {
  fierro: std('#2b2d34', { metalness: 0.7, roughness: 0.36 }),
  acero: std('#c3c8d0', { metalness: 0.9, roughness: 0.22 }),
  goma: std('#1d1d22', { roughness: 0.85 }),
  madera: std('#9a6238', { roughness: 0.55, map: texturaMadera() }),
  carton: std('#d8c49e', { roughness: 0.9 }),
  cascara: std('#f6ecdb', { roughness: 0.35 }),
  cascaraDoble: std('#f6ecdb', { roughness: 0.35, side: THREE.DoubleSide }),
  clara: std('#fdfbf4', { roughness: 0.3 }),
  yema: std('#ffb31a', { roughness: 0.18, emissive: '#5a2a00', emissiveIntensity: 0.5 }),
  laton: std('#d9a943', { metalness: 0.9, roughness: 0.3 }),
  cobre: std('#c4733f', { metalness: 0.85, roughness: 0.3 }),
  oro: std('#f2c230', { metalness: 1, roughness: 0.22, emissive: '#3a2600' }),
  oliva: std('#5b6b3a', { roughness: 0.6, metalness: 0.2 }),
  vidrio: std('#9fd8ff', { metalness: 0.2, roughness: 0.05, emissive: '#1a4a66', emissiveIntensity: 0.6 }),
  pan: std('#d9a066', { roughness: 0.85 }),
  jamon: std('#e47f84', { roughness: 0.5 }),
  holandesa: std('#ffd34d', { roughness: 0.22 }),
  ciboulette: std('#3f8f2a', { roughness: 0.6 }),
  sarten: std('#2b2b30', { metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide }),
  antiadherente: std('#161619', { metalness: 0.2, roughness: 0.6 }),
  luzVerde: marca(new THREE.MeshBasicMaterial({ color: '#7dff5a' })),
};
const _plastico = {};
const plastico = id => (_plastico[id] ||= std(ARMAS[id]?.color || '#888888', { roughness: 0.3, metalness: 0.05 }));

// ---------- Piezas ----------
const caja = (w, h, d, r = Math.min(w, h, d) * 0.3) => new RoundedBoxGeometry(w, h, d, 3, r);
// Un cilindro acostado a lo largo de z: `r0` es el radio del extremo de +z.
const tubo = (r0, r1, l, n = 16) => new THREE.CylinderGeometry(r0, r1, l, n).rotateX(Math.PI / 2);
const huevito = (r, alto = 1.3) => new THREE.SphereGeometry(r, 12, 9).scale(1, alto, 1);
function p(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
function grupo(g, x = 0, y = 0, z = 0) {
  const s = new THREE.Group();
  s.position.set(x, y, z);
  g.add(s);
  return s;
}
function punto(g, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); return o; }
// El guardamonte: medio aro bajo el gatillo.
const guardamonte = r => new THREE.TorusGeometry(r, 0.005, 6, 16, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI);
// Cómo va la mano izquierda: «agarra» una empuñadura vertical (el guante tal
// cual), «sostiene» un guardamanos desde abajo (la palma arriba, los dedos por
// el costado) y «encima» toma un asa de arriba.
const base = (x, y, z) => new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SOSTIENE = base(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0));
const ENCIMA = base(V(0, -1, 0), V(0, 0, 1), V(-1, 0, 0));
const mano = (x, y, z, r = new THREE.Euler()) => ({ p: V(x, y, z), r: r instanceof THREE.Euler ? r : new THREE.Euler(r, 0, 0) });

// ---------- Los modelos ----------
// La Batidora: una batidora de pie roja con su motor arriba y un batidor que
// gira en la boca a cada tiro.
function batidora(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, caja(0.085, 0.11, 0.36), c, 0, 0, -0.09);
  p(g, new THREE.CapsuleGeometry(0.05, 0.2, 6, 16).rotateX(Math.PI / 2), c, 0, 0.05, -0.1);
  for (let i = 0; i < 4; i++) p(g, caja(0.104, 0.01, 0.03, 0.004), M.goma, 0, 0.065, -0.02 - i * 0.042);
  p(g, new THREE.TorusGeometry(0.051, 0.006, 8, 26), M.acero, 0, 0.05, -0.215);
  p(g, huevito(0.016).scale(0.35, 1, 0.8), M.cascara, -0.044, -0.01, -0.13);
  p(g, tubo(0.017, 0.017, 0.14), M.acero, 0, 0, -0.33);
  const giro = grupo(g, 0, 0, -0.45);
  const lazos = [];
  for (let i = 0; i < 4; i++) lazos.push(new THREE.TorusGeometry(0.034, 0.0032, 5, 24).scale(1.8, 1, 1).rotateY(Math.PI / 2).rotateZ(i * Math.PI / 4));
  p(giro, mergeGeometries(lazos), M.acero);
  p(giro, tubo(0.012, 0.009, 0.03), M.acero, 0, 0, 0.065);
  ud.giro = giro;
  p(g, caja(0.05, 0.03, 0.075), c, 0, -0.065, -0.15);
  ud.cargador = grupo(g, 0, -0.14, -0.15);
  ud.cargador.rotation.x = 0.12;
  p(ud.cargador, caja(0.036, 0.16, 0.058), M.fierro);
  p(g, caja(0.042, 0.12, 0.055), M.goma, 0, -0.1, 0.035, -0.28);
  p(g, guardamonte(0.024), M.fierro, 0, -0.055, -0.03);
  p(g, caja(0.008, 0.03, 0.012, 0.003), M.fierro, 0, -0.065, -0.03, -0.3);
  p(g, caja(0.03, 0.06, 0.14), c, 0, -0.01, 0.15);
  p(g, caja(0.036, 0.09, 0.025, 0.01), M.goma, 0, -0.015, 0.23);
  p(g, caja(0.05, 0.035, 0.12), M.goma, 0, -0.07, -0.24);
  ud.palanca = grupo(g, -0.052, 0.02, -0.17);
  p(ud.palanca, caja(0.03, 0.016, 0.022, 0.006), M.fierro, -0.01, 0, 0);
  ud.boca = punto(g, 0, 0, -0.5);
  ud.expulsa = V(0.045, 0.03, -0.08);
  ud.der = mano(0, -0.085, 0.035, -0.28);
  ud.izq = mano(0, -0.1, -0.24, SOSTIENE);
  ud.recarga = 'cargador';
}

// La Revuelta: una escopeta de bomba con el guardamanos de madera y los
// cartuchos de repuesto, que son huevitos, al costado.
function revuelta(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, caja(0.07, 0.1, 0.26), c, 0, 0, -0.04);
  p(g, tubo(0.021, 0.021, 0.56), M.acero, 0, 0.028, -0.43);
  p(g, tubo(0.017, 0.017, 0.42), M.fierro, 0, -0.022, -0.37);
  p(g, tubo(0.026, 0.026, 0.025), M.fierro, 0, 0.003, -0.6);
  p(g, new THREE.SphereGeometry(0.006, 8, 6), M.laton, 0, 0.052, -0.7);
  ud.bomba = grupo(g, 0, -0.022, -0.3);
  p(ud.bomba, new THREE.CapsuleGeometry(0.03, 0.12, 6, 16).rotateX(Math.PI / 2), M.madera);
  for (let i = 0; i < 4; i++) p(ud.bomba, new THREE.TorusGeometry(0.0305, 0.004, 6, 22), M.goma, 0, 0, -0.045 + i * 0.03);
  p(g, caja(0.016, 0.05, 0.11, 0.006), M.goma, -0.042, 0, -0.06);
  for (let i = 0; i < 4; i++) p(g, huevito(0.0135), M.cascara, -0.052, 0.005, -0.1 + i * 0.026);
  p(g, caja(0.04, 0.1, 0.06), M.madera, 0, -0.08, 0.1, -0.4);
  p(g, caja(0.045, 0.085, 0.24), M.madera, 0, -0.05, 0.24, 0.12);
  p(g, caja(0.048, 0.1, 0.025, 0.01), M.goma, 0, -0.07, 0.365, 0.12);
  p(g, guardamonte(0.024), M.fierro, 0, -0.055, 0.04);
  ud.puerto = V(0, -0.06, -0.02);
  ud.boca = punto(g, 0, 0.028, -0.72);
  ud.expulsa = V(0.04, 0.02, -0.04);
  ud.vaina = 'cascara';
  ud.der = mano(0, -0.07, 0.095, -0.4);
  ud.izq = mano(0, -0.052, -0.3, SOSTIENE);
  ud.recarga = 'escopeta';
}

// La Poché: un rifle de cerrojo con mira telescópica y las tapas de la mira
// color yema.
function poche(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, caja(0.06, 0.085, 0.44), c, 0, 0, -0.08);
  p(g, caja(0.05, 0.11, 0.28), c, 0, -0.025, 0.24, 0.08);
  p(g, caja(0.054, 0.03, 0.12), c, 0, 0.045, 0.22);
  p(g, caja(0.056, 0.11, 0.025, 0.01), M.goma, 0, -0.035, 0.385, 0.08);
  p(g, tubo(0.014, 0.016, 0.5), M.acero, 0, 0.015, -0.52);
  p(g, tubo(0.022, 0.022, 0.07), M.fierro, 0, 0.015, -0.78);
  for (const z of [-0.77, -0.79]) p(g, caja(0.05, 0.008, 0.008, 0.003), M.goma, 0, 0.015, z);
  p(g, tubo(0.025, 0.025, 0.2), M.fierro, 0, 0.085, -0.08);
  p(g, tubo(0.026, 0.036, 0.07), M.fierro, 0, 0.085, -0.2);
  p(g, tubo(0.032, 0.026, 0.05), M.fierro, 0, 0.085, 0.04);
  p(g, new THREE.CircleGeometry(0.033, 24).rotateY(Math.PI), M.vidrio, 0, 0.085, -0.236);
  for (const z of [-0.14, 0.0]) p(g, caja(0.02, 0.04, 0.022, 0.006), M.fierro, 0, 0.055, z);
  p(g, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), M.yema, 0, 0.115, -0.08);
  p(g, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12).rotateZ(Math.PI / 2), M.yema, -0.03, 0.085, -0.08);
  ud.cerrojo = grupo(g, 0, 0.035, 0.08);
  p(ud.cerrojo, tubo(0.012, 0.012, 0.08), M.acero, 0, 0, -0.02);
  p(ud.cerrojo, new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8).rotateZ(Math.PI / 2), M.acero, 0.035, 0, 0.01);
  p(ud.cerrojo, new THREE.SphereGeometry(0.014, 12, 8), M.acero, 0.066, 0, 0.01);
  ud.cargador = grupo(g, 0, -0.07, -0.05);
  p(ud.cargador, caja(0.04, 0.06, 0.09), M.fierro);
  p(g, caja(0.038, 0.1, 0.05), c, 0, -0.08, 0.1, -0.35);
  p(g, guardamonte(0.022), M.fierro, 0, -0.045, 0.04);
  ud.boca = punto(g, 0, 0.015, -0.82);
  ud.expulsa = V(0.035, 0.04, 0.03);
  ud.der = mano(0, -0.075, 0.1, -0.35);
  ud.izq = mano(0, -0.06, -0.3, SOSTIENE);
  ud.recarga = 'cerrojo';
}

// La Benedictina: una bazuca cuyo cohete es un huevo benedictino (el muffin,
// el jamón, el huevo y la salsa holandesa) asomado por delante.
function benedictina(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, tubo(0.07, 0.07, 0.92, 26), c, 0, 0.06, -0.2);
  for (const z of [-0.64, -0.3, 0.2]) p(g, new THREE.TorusGeometry(0.072, 0.011, 8, 28), M.fierro, 0, 0.06, z);
  p(g, tubo(0.095, 0.07, 0.12, 26), M.fierro, 0, 0.06, 0.31);
  p(g, new THREE.CircleGeometry(0.066, 26), M.goma, 0, 0.06, 0.371);
  p(g, caja(0.04, 0.12, 0.055), M.goma, 0, -0.06, 0.0, -0.28);
  p(g, caja(0.036, 0.045, 0.1), M.fierro, 0, -0.01, -0.03);
  p(g, guardamonte(0.022), M.fierro, 0, -0.035, -0.06);
  p(g, caja(0.04, 0.1, 0.05), M.goma, 0, -0.04, -0.34, -0.1);
  p(g, caja(0.03, 0.05, 0.08), M.fierro, -0.085, 0.1, -0.25);
  p(g, new THREE.TorusGeometry(0.012, 0.004, 6, 14), M.vidrio, -0.085, 0.115, -0.291);
  const cohete = grupo(g, 0, 0.06, -0.66);
  p(cohete, tubo(0.06, 0.06, 0.04, 22), M.pan, 0, 0, 0.0);
  p(cohete, tubo(0.064, 0.064, 0.012, 22), M.jamon, 0, 0, -0.025);
  p(cohete, new THREE.SphereGeometry(0.07, 20, 12).scale(1, 1, 0.3), M.clara, 0, 0, -0.04);
  p(cohete, new THREE.SphereGeometry(0.06, 18, 10).scale(1, 1, 0.3), M.holandesa, 0, 0.004, -0.052);
  p(cohete, new THREE.SphereGeometry(0.03, 14, 10).scale(1, 1, 0.75), M.yema, 0, 0.004, -0.06);
  for (const [x, y] of [[0.03, 0.02], [-0.025, -0.02], [0.012, -0.035]]) p(cohete, new THREE.CapsuleGeometry(0.003, 0.012, 2, 5), M.ciboulette, x, y, -0.07, 0, 0, x * 40);
  ud.cohete = cohete;
  ud.asiento = cohete.position.clone();
  ud.boca = punto(g, 0, 0.06, -0.72);
  ud.der = mano(0, -0.05, 0.0, -0.28);
  ud.izq = mano(0, -0.03, -0.34, -0.1);
  ud.recarga = 'cohete';
  ud.escala = 0.7;
  ud.base = V(0.23, -0.21, -0.6);
}

// Pasado por agua: la pistola, dorada, con la corredera que se va atrás a cada
// tiro y un huevito en las cachas.
function pistola(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, caja(0.034, 0.035, 0.17), M.fierro, 0, 0, -0.07);
  const corredera = grupo(g, 0, 0.034, -0.075);
  p(corredera, caja(0.037, 0.034, 0.19), c);
  for (let i = 0; i < 5; i++) p(corredera, caja(0.04, 0.026, 0.004, 0.0015), M.fierro, 0, -0.002, 0.05 + i * 0.009);
  p(corredera, caja(0.006, 0.01, 0.01, 0.002), M.fierro, 0, 0.021, -0.085);
  p(corredera, caja(0.022, 0.01, 0.01, 0.002), M.fierro, 0, 0.021, 0.085);
  p(corredera, caja(0.016, 0.006, 0.04, 0.002), M.goma, 0.008, 0.017, 0.0);
  p(corredera, tubo(0.009, 0.009, 0.01), M.goma, 0, 0, -0.095);
  ud.corredera = corredera;
  p(g, caja(0.036, 0.11, 0.05), M.madera, 0, -0.06, 0.0, -0.28);
  p(g, huevito(0.012).scale(0.3, 1, 1), M.cascara, -0.0185, -0.055, 0.0, -0.28);
  p(g, guardamonte(0.02), M.fierro, 0, -0.022, -0.045);
  ud.cargador = grupo(g, 0, -0.062, 0.002);
  ud.cargador.rotation.x = -0.28;
  p(ud.cargador, caja(0.026, 0.1, 0.04), M.fierro, 0, 0.002, 0);
  p(ud.cargador, caja(0.038, 0.012, 0.054, 0.004), M.fierro, 0, -0.055, 0.002);
  ud.boca = punto(g, 0, 0.035, -0.18);
  ud.expulsa = V(0.03, 0.055, -0.06);
  ud.der = mano(0, -0.05, 0.005, -0.28);
  ud.izq = mano(-0.03, -0.07, 0.0, -0.28);
  ud.recarga = 'cargador';
  ud.base = V(0.18, -0.17, -0.5);
}

// El Rayo batido: una pistola de rayos de los cincuenta con el cuerpo de
// huevo, aletas verdes y una celda que brilla arriba.
function rayo(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, new THREE.SphereGeometry(0.06, 22, 14).scale(0.9, 1, 2.1), M.cascara, 0, 0.03, -0.08);
  for (const [z, r] of [[-0.12, 0.06], [-0.16, 0.052], [-0.195, 0.038]]) p(g, new THREE.TorusGeometry(r, 0.008, 8, 26), c, 0, 0.03, z);
  p(g, tubo(0.02, 0.012, 0.07), M.fierro, 0, 0.03, -0.24);
  p(g, new THREE.SphereGeometry(0.014, 12, 8), M.luzVerde, 0, 0.03, -0.278);
  p(g, tubo(0.03, 0.026, 0.03), M.cobre, 0, 0.03, 0.05);
  p(g, new THREE.SphereGeometry(0.012, 10, 8), c, 0, 0.03, 0.068);
  const celda = grupo(g, 0, 0.1, -0.07);
  p(celda, new THREE.CylinderGeometry(0.019, 0.019, 0.065, 16), M.vidrio);
  ud.liquido = p(celda, new THREE.CylinderGeometry(0.013, 0.013, 0.06, 12), M.luzVerde);
  for (const y of [-0.036, 0.036]) p(celda, new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), M.cobre, 0, y, 0);
  ud.cargador = celda;
  p(g, caja(0.036, 0.1, 0.05), M.goma, 0, -0.05, 0.0, -0.3);
  for (const y of [-0.02, -0.08]) p(g, caja(0.04, 0.008, 0.054, 0.003), M.cobre, 0, y, 0.0 + (y + 0.05) * -0.3, -0.3);
  p(g, guardamonte(0.02), M.fierro, 0, -0.018, -0.045);
  ud.boca = punto(g, 0, 0.03, -0.29);
  ud.der = mano(0, -0.045, 0.005, -0.3);
  ud.izq = mano(-0.03, -0.065, 0.0, -0.3);
  ud.recarga = 'rayo';
  ud.luz = '#7dff5a';
  ud.base = V(0.18, -0.17, -0.5);
}

// La Amasadora: una ametralladora con la caja de munición al costado, la
// tapa que se abre para poner la cinta y un uslero por guardamanos.
function amasadora(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, caja(0.09, 0.12, 0.4), c, 0, 0, -0.06);
  ud.tapa = grupo(g, 0, 0.06, 0.12);
  p(ud.tapa, caja(0.088, 0.026, 0.24), c, 0, 0.013, -0.12);
  p(g, tubo(0.02, 0.02, 0.6), M.acero, 0, 0.02, -0.52);
  p(g, tubo(0.032, 0.032, 0.3), M.fierro, 0, 0.02, -0.42);
  for (let i = 0; i < 5; i++) p(g, new THREE.TorusGeometry(0.033, 0.004, 6, 20), M.goma, 0, 0.02, -0.3 - i * 0.055);
  p(g, tubo(0.03, 0.03, 0.18, 20), M.madera, 0, -0.065, -0.3);
  for (const z of [-0.18, -0.42]) p(g, tubo(0.012, 0.012, 0.06), M.madera, 0, -0.065, z);
  p(g, new THREE.TorusGeometry(0.04, 0.007, 6, 16, Math.PI).rotateY(Math.PI / 2), M.fierro, 0, 0.06, -0.2);
  for (const sx of [-1, 1]) p(g, tubo(0.005, 0.005, 0.25), M.fierro, sx * 0.012, -0.012, -0.62);
  ud.cargador = grupo(g, -0.035, -0.105, -0.08);
  p(ud.cargador, caja(0.085, 0.11, 0.13), M.oliva);
  for (let i = 0; i < 6; i++) p(ud.cargador, new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8).rotateZ(Math.PI / 2), M.laton, 0.012, 0.06 + i * 0.008, -0.04 + i * 0.012);
  p(g, caja(0.05, 0.09, 0.2), c, 0, -0.02, 0.22, 0.06);
  p(g, caja(0.054, 0.1, 0.025, 0.01), M.goma, 0, -0.03, 0.325, 0.06);
  p(g, caja(0.04, 0.11, 0.055), M.goma, 0, -0.1, 0.07, -0.28);
  p(g, guardamonte(0.024), M.fierro, 0, -0.065, 0.02);
  ud.boca = punto(g, 0, 0.02, -0.83);
  ud.expulsa = V(0.05, -0.02, -0.04);
  ud.der = mano(0, -0.085, 0.07, -0.28);
  ud.izq = mano(0, -0.098, -0.3, SOSTIENE);
  ud.recarga = 'cinta';
  ud.base = V(0.21, -0.21, -0.6);
}

// La Huevera: un fusil de madera que se carga por arriba con una tira de
// huevos en su cartón (y la escupe, con su «ping», al gastar el último).
function huevera(g, id) {
  const c = plastico(id), ud = g.userData;
  p(g, caja(0.05, 0.075, 0.66), M.madera, 0, -0.015, -0.12);
  p(g, caja(0.05, 0.11, 0.2), M.madera, 0, -0.035, 0.3, 0.1);
  p(g, caja(0.052, 0.12, 0.022, 0.008), c, 0, -0.045, 0.405, 0.1);
  p(g, caja(0.045, 0.05, 0.2), M.fierro, 0, 0.035, -0.02);
  p(g, caja(0.04, 0.03, 0.28), M.madera, 0, 0.04, -0.27);
  p(g, tubo(0.013, 0.013, 0.66), M.acero, 0, 0.03, -0.45);
  p(g, caja(0.006, 0.03, 0.01, 0.002), M.fierro, 0, 0.055, -0.76);
  for (const z of [-0.38, -0.12]) p(g, new THREE.TorusGeometry(0.03, 0.005, 6, 20).scale(0.9, 1.1, 1), M.fierro, 0, 0.015, z);
  ud.cerrojo = grupo(g, 0.028, 0.03, -0.06);
  p(ud.cerrojo, caja(0.012, 0.014, 0.12, 0.004), M.acero);
  p(ud.cerrojo, new THREE.SphereGeometry(0.01, 10, 8), M.acero, 0.006, 0, 0.06);
  ud.cargador = grupo(g, 0, 0.065, -0.03);
  p(ud.cargador, caja(0.034, 0.026, 0.11, 0.006), M.carton);
  for (let i = 0; i < 4; i++) p(ud.cargador, huevito(0.0125), M.cascara, 0, 0.018, -0.04 + i * 0.027);
  p(g, guardamonte(0.022), M.fierro, 0, -0.06, 0.04);
  ud.boca = punto(g, 0, 0.03, -0.79);
  ud.expulsa = V(0.02, 0.07, -0.02);
  ud.der = mano(0, -0.07, 0.1, -0.5);
  ud.izq = mano(0, -0.055, -0.3, SOSTIENE);
  ud.recarga = 'peine';
}

// La Máquina de muerte: seis cañones que giran, el asa arriba y la caja de
// munición al lado.
function maquina(g, id) {
  const a = ARMAS[id], ud = g.userData;
  const fierro = std(a.color, { metalness: 0.7, roughness: 0.35 });
  p(g, caja(0.16, 0.16, 0.34, 0.04), fierro, 0, 0, 0.02);
  const giro = grupo(g, 0, 0.01, -0.18);
  const canones = [], aros = [];
  for (let i = 0; i < 6; i++) {
    const th = i / 6 * Math.PI * 2;
    canones.push(tubo(0.014, 0.014, 0.6, 10).translate(Math.cos(th) * 0.045, Math.sin(th) * 0.045, -0.3));
  }
  for (const z of [-0.05, -0.4, -0.58]) aros.push(tubo(0.068, 0.068, 0.03, 22).translate(0, 0, z));
  p(giro, mergeGeometries(canones), M.fierro);
  p(giro, mergeGeometries(aros), M.acero);
  ud.giro = giro;
  p(g, caja(0.03, 0.03, 0.2, 0.01), M.goma, 0, 0.13, -0.02);
  for (const z of [-0.1, 0.06]) p(g, caja(0.02, 0.05, 0.02, 0.006), M.fierro, 0, 0.1, z);
  p(g, caja(0.1, 0.13, 0.14), M.oliva, -0.14, -0.04, 0.02);
  for (let i = 0; i < 5; i++) p(g, new THREE.CylinderGeometry(0.007, 0.007, 0.035, 8).rotateZ(Math.PI / 2), M.laton, -0.075 + i * 0.012, 0.03 - i * 0.006, -0.02);
  p(g, caja(0.05, 0.15, 0.07), M.goma, 0, -0.14, 0.1, -0.3);
  ud.boca = punto(g, 0, 0.01, -0.8);
  ud.expulsa = V(0.08, -0.02, 0.0);
  ud.der = mano(0, -0.12, 0.1, -0.3);
  ud.izq = mano(0, 0.15, -0.02, ENCIMA);
  ud.recarga = 'nada';
  ud.escala = 0.85;
  ud.base = V(0.22, -0.25, -0.6);
}

// La sartén, con un huevo frito adentro. Se lleva del mango.
function sarten(g, id) {
  const ud = g.userData;
  const perfil = [[0.0, 0], [0.118, 0], [0.13, 0.004], [0.142, 0.016], [0.152, 0.038], [0.157, 0.042]].map(([r, y]) => new THREE.Vector2(r, y));
  const olla = grupo(g, 0, -0.018, -0.27);
  p(olla, new THREE.LatheGeometry(perfil, 36), M.sarten);
  p(olla, new THREE.CircleGeometry(0.12, 32).rotateX(-Math.PI / 2), M.antiadherente, 0, 0.002, 0);
  p(olla, new THREE.TorusGeometry(0.155, 0.006, 6, 36).rotateX(Math.PI / 2), M.sarten, 0, 0.042, 0);
  const forma = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const th = i / 40 * Math.PI * 2;
    const r = 0.072 * (1 + 0.13 * Math.sin(3 * th + 0.4) + 0.07 * Math.sin(5 * th + 1.3));
    if (i === 0) forma.moveTo(Math.cos(th) * r, Math.sin(th) * r); else forma.lineTo(Math.cos(th) * r, Math.sin(th) * r);
  }
  p(olla, new THREE.ShapeGeometry(forma, 6).rotateX(-Math.PI / 2), M.clara, 0.008, 0.006, 0.004);
  p(olla, new THREE.SphereGeometry(0.03, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1), M.yema, 0.02, 0.006, -0.01);
  p(g, tubo(0.013, 0.013, 0.05), M.fierro, 0, 0.0, -0.105);
  p(g, tubo(0.02, 0.02, 0.03), M.acero, 0, 0.0, -0.075);
  p(g, tubo(0.019, 0.016, 0.16), M.madera, 0, 0.0, 0.02);
  p(g, new THREE.TorusGeometry(0.011, 0.0035, 6, 14).rotateY(Math.PI / 2), M.acero, 0, 0.0, 0.11);
  ud.boca = punto(g, 0, 0, -0.27);
  ud.der = mano(0, 0.0, 0.02, -Math.PI / 2);
  ud.izq = null;
  ud.recarga = 'nada';
}

// La espátula dorada: la paleta con tres ranuras y el mango con anillos.
function espatula(g) {
  const ud = g.userData;
  const f = new THREE.Shape();
  const w = 0.06, l = 0.075, r = 0.02;
  f.moveTo(-w + r, -l); f.lineTo(w - r, -l); f.quadraticCurveTo(w, -l, w, -l + r);
  f.lineTo(w, l - r); f.quadraticCurveTo(w, l, w - r, l); f.lineTo(-w + r, l);
  f.quadraticCurveTo(-w, l, -w, l - r); f.lineTo(-w, -l + r); f.quadraticCurveTo(-w, -l, -w + r, -l);
  for (const x of [-0.03, 0, 0.03]) {
    const h = new THREE.Path();
    h.absarc(x, 0.03, 0.006, 0, Math.PI, false); h.lineTo(x - 0.006, -0.03); h.absarc(x, -0.03, 0.006, Math.PI, Math.PI * 2, false); h.lineTo(x + 0.006, 0.03);
    f.holes.push(h);
  }
  const paleta = new THREE.ExtrudeGeometry(f, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 8 });
  paleta.rotateX(-Math.PI / 2).translate(0, -0.003, 0);
  p(g, paleta, M.oro, 0, 0, -0.14);
  p(g, tubo(0.012, 0.008, 0.07), M.oro, 0, 0.01, -0.04, -0.25);
  p(g, tubo(0.018, 0.016, 0.2), M.oro, 0, 0.02, 0.08);
  for (const z of [0.03, 0.08, 0.13]) p(g, new THREE.TorusGeometry(0.018, 0.004, 6, 18), M.goma, 0, 0.02, z);
  p(g, new THREE.SphereGeometry(0.018, 12, 8), M.oro, 0, 0.02, 0.18);
  ud.boca = punto(g, 0, 0, -0.14);
}

// Cualquier otra (no debería haber): una caja con un cañón.
function generica(g, id) {
  const ud = g.userData;
  p(g, caja(0.07, 0.11, 0.3), plastico(id), 0, 0, -0.1);
  p(g, tubo(0.02, 0.02, 0.4), M.fierro, 0, 0.02, -0.35);
  p(g, caja(0.04, 0.12, 0.05), M.goma, 0, -0.09, 0.03, -0.28);
  ud.boca = punto(g, 0, 0.02, -0.56);
  ud.der = mano(0, -0.08, 0.03, -0.28);
  ud.izq = mano(0, -0.07, -0.25, SOSTIENE);
  ud.recarga = 'nada';
}

const MODELOS = { 0: batidora, 1: revuelta, 2: poche, 6: benedictina, 7: pistola, 10: rayo, 11: amasadora, 12: huevera, 13: maquina };

export function construyeArma(id) {
  const g = new THREE.Group();
  g.userData = { escala: 1, vaina: 'laton', id };
  if (id === ESPATULA) espatula(g);
  else if (ARMAS[id]?.melee) sarten(g, id);
  else (MODELOS[id] || generica)(g, id);
  // Lo que se mueve suelto se guarda dónde descansa.
  const ud = g.userData;
  for (const k of ['cargador', 'corredera', 'bomba', 'cerrojo', 'palanca', 'tapa', 'cohete']) {
    if (ud[k]) { ud[k].userData.p0 = ud[k].position.clone(); ud[k].userData.r0 = ud[k].rotation.clone(); }
  }
  return g;
}

// El arma con sus dos guantes puestos (la de la mano y la de los demás).
const GUANTE = 1.0;
export function armaConManos(id) {
  const g = construyeArma(id);
  const ud = g.userData, s = GUANTE / ud.escala;
  if (ud.der) {
    ud.manoDer = crearGuante(1);
    ud.manoDer.position.copy(ud.der.p);
    ud.manoDer.rotation.copy(ud.der.r);
    ud.manoDer.scale.set(s, s, s);
    g.add(ud.manoDer);
  }
  if (ud.izq) {
    ud.manoIzq = crearGuante(-1);
    ud.manoIzq.position.copy(ud.izq.p);
    ud.manoIzq.rotation.copy(ud.izq.r);
    ud.manoIzq.scale.set(-s, s, s);
    ud.izq.q = ud.manoIzq.quaternion.clone();
    g.add(ud.manoIzq);
    // El cartucho que la mano mete en la escopeta: un huevito.
    if (ud.recarga === 'escopeta') {
      ud.cartucho = p(ud.manoIzq, huevito(0.0135), M.cascara, 0.0, 0.05, -0.01);
      ud.cartucho.visible = false;
    }
  }
  g.scale.setScalar(ud.escala);
  return g;
}

// ---------- Pack-a-Punch ----------
// Cromado con un brillo violeta que va cambiando de tono (menos los guantes y
// lo que ya brilla solo).
const matsPap = [];
export function metaliza(g) {
  const hechos = new Map();
  g.traverse(o => {
    if (!o.isMesh || o.userData.guante || o.material.isMeshBasicMaterial) return;
    if (!hechos.has(o.material)) {
      const c = (o.material.color ? o.material.color.clone() : new THREE.Color('#888888')).lerp(new THREE.Color('#b8bcd8'), 0.55);
      const m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.95, roughness: 0.18, emissive: '#3a1a80', emissiveIntensity: 0.5, side: o.material.side });
      matsPap.push(m);
      hechos.set(o.material, m);
    }
    o.material = hechos.get(o.material);
  });
  return g;
}
const _tono = new THREE.Color();
export function brilloPap() {
  const t = performance.now() / 1000;
  _tono.setHSL((0.72 + 0.12 * Math.sin(t * 1.3)) % 1, 0.9, 0.35 + 0.1 * Math.sin(t * 3.1));
  for (const mt of matsPap) mt.emissive.copy(_tono);
}

// ---------- Ayudas de animación ----------
const suave = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const tramo = (u, a, b) => suave((u - a) / (b - a));
const loma = (u, a, b) => { const x = (u - a) / (b - a); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x); };
// Una posición por tramos: [[u, x, y, z], …], suavizada entre cada par.
function kv(u, keys, out) {
  if (u <= keys[0][0]) return out.set(keys[0][1], keys[0][2], keys[0][3]);
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (u <= b[0]) {
      const a = keys[i - 1], k = suave((u - a[0]) / (b[0] - a[0]));
      return out.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
    }
  }
  const l = keys[keys.length - 1];
  return out.set(l[1], l[2], l[3]);
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
const Q_AGARRA = new THREE.Quaternion();

// ---------- En primera persona ----------
// `crearVista(escena)` arma lo de la mano en la escena del arma (la que se
// dibuja encima de todo, con su cámara quieta en el origen). Cada cuadro,
// `paso(dt, e)` recibe cómo está el jugador y devuelve el modelo en la mano.
export function crearVista(escena) {
  const pivote = new THREE.Group();
  escena.add(pivote);
  const modelos = new Map();
  let actual = null;

  // El fogonazo: una estrella que dura un suspiro y una luz que alumbra los
  // guantes.
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  {
    const g = cv.getContext('2d');
    g.translate(64, 64);
    for (let i = 0; i < 7; i++) {
      g.rotate(Math.PI * 2 / 7 + (i % 2) * 0.2);
      const gr = g.createLinearGradient(0, 0, 62, 0);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(40 + (i % 3) * 10, 0); g.lineTo(0, 8); g.fill();
    }
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 40);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
  }
  const texFog = new THREE.CanvasTexture(cv);
  texFog.colorSpace = THREE.SRGBColorSpace;
  const fogonazo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFog, color: '#ffcf7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  fogonazo.visible = false;
  fogonazo.renderOrder = 5;
  escena.add(fogonazo);
  const luz = new THREE.PointLight('#ffb35a', 0, 2.2, 1.6);
  escena.add(luz);

  // Las vainas que salta el arma (cáscaras de huevo, la escopeta).
  const geoVaina = new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 8).rotateZ(Math.PI / 2);
  const geoCascara = new THREE.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const vainas = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(geoVaina, M.laton);
    m.visible = false;
    escena.add(m);
    vainas.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 0 });
  }
  let sigVaina = 0;
  // `cosa`: un Object3D que sale volando en vez de la vaina (el peine vacío).
  function salta(m, cascara = false, cosa = null) {
    const ud = m.userData;
    const pos = m.localToWorld(_v.copy(ud.expulsa || V(0.04, 0.03, -0.05)));
    const s = vainas[sigVaina++ % vainas.length];
    if (s.cosa) { escena.remove(s.cosa); s.cosa = null; }
    if (cosa) { s.cosa = cosa; escena.add(cosa); s.m.visible = false; } else {
      s.m.geometry = cascara ? geoCascara : geoVaina;
      s.m.material = cascara ? M.cascaraDoble : M.laton;
      s.m.visible = true;
    }
    (s.cosa || s.m).position.copy(pos);
    s.v.set(0.9 + Math.random() * 0.6, 1.3 + Math.random() * 0.6, 0.3 + Math.random() * 0.3);
    s.w.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
    s.t = 0.9;
  }

  // El estado de la animación.
  const muelle = { z: 0, vz: 0, x: 0, vx: 0, r: 0, vr: 0 };
  const caida = { y: 0, v: 0 };
  let saca = 1, pulso = 0, fogT = 0, giroV = 0, bombaT = 9, cerrojoT = 9;
  let swayX = 0, swayY = 0, yawAntes = null, pitchAntes = 0, balasAntes = -1;

  function modelo(id, pap) {
    const k = id + (pap ? 'p' : '');
    if (!modelos.has(k)) {
      const m = armaConManos(id);
      if (pap) metaliza(m);
      m.visible = false;
      m.traverse(o => { o.castShadow = false; });
      pivote.add(m);
      modelos.set(k, m);
    }
    return modelos.get(k);
  }

  // Deja cada pieza donde descansa.
  function reposo(ud) {
    for (const k of ['cargador', 'corredera', 'bomba', 'cerrojo', 'palanca', 'tapa', 'cohete']) {
      const o = ud[k];
      if (!o) continue;
      o.position.copy(o.userData.p0);
      o.rotation.copy(o.userData.r0);
    }
    if (ud.cargador) ud.cargador.visible = true;
    if (ud.manoIzq) { ud.manoIzq.position.copy(ud.izq.p); ud.manoIzq.quaternion.copy(ud.izq.q); }
    if (ud.liquido) ud.liquido.scale.y = 1;
  }
  // La mano izquierda: de su lugar hacia `p` (en el espacio del arma), girada
  // como quien agarra algo, con peso `w` (0 en su lugar, 1 del todo allá).
  function manoA(ud, p, w) {
    if (!ud.manoIzq) return;
    ud.manoIzq.position.lerpVectors(ud.izq.p, p, w);
    ud.manoIzq.quaternion.slerpQuaternions(ud.izq.q, Q_AGARRA, w);
  }

  // Las recargas, con `u` de 0 a 1. Los tiempos van con los clics de
  // `sonido.recarga` en audio.js. Devuelven cuánto se inclina el arma.
  const giro = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };
  function recarga(m, u) {
    const ud = m.userData;
    Object.keys(giro).forEach(k => { giro[k] = 0; });
    const tipo = ud.recarga;
    const inclina = tramo(u, 0, 0.12) * (1 - tramo(u, 0.86, 1));
    if (tipo === 'cargador' || tipo === 'cerrojo') {
      giro.rz = 0.45 * inclina; giro.rx = 0.12 * inclina; giro.px = -0.03 * inclina; giro.py = 0.02 * inclina;
      const c = ud.cargador, p0 = c.userData.p0;
      const abajo = _w.set(0, -1, 0).applyEuler(c.userData.r0);
      // Sale (0.12–0.3, cae), viene el nuevo desde abajo (0.3–0.48), entra (0.48–0.56).
      let d = 0;
      if (u < 0.12) d = 0;
      else if (u < 0.3) d = 0.45 * Math.pow((u - 0.12) / 0.18, 2);
      else if (u < 0.48) d = 0.4 * (1 - tramo(u, 0.3, 0.48)) + 0.05;
      else d = 0.05 * (1 - tramo(u, 0.48, 0.56));
      c.position.copy(p0).addScaledVector(abajo, d);
      c.rotation.copy(c.userData.r0);
      if (u > 0.12 && u < 0.3) c.rotation.x += (u - 0.12) * 3;
      c.visible = !(u > 0.27 && u < 0.31);
      giro.py += 0.016 * loma(u, 0.53, 0.62);
      const fondo = p0.clone().addScaledVector(abajo, 0.07);
      // Dónde tira la mano al final: la corredera desde arriba, la palanca
      // desde el costado o la bola del cerrojo.
      const atras = ud.corredera || ud.palanca || ud.cerrojo;
      const tira = !atras ? fondo.clone() : atras.userData.p0.clone().add(
        ud.corredera ? V(0, 0.03, 0.03) : tipo === 'cerrojo' ? V(0.066, -0.025, 0.02) : V(-0.02, 0, 0.03));
      let w = 0;
      if (u < 0.12) { _v.copy(fondo); w = tramo(u, 0, 0.12); }
      else if (u < 0.56) { _v.copy(c.position).addScaledVector(abajo, 0.07); w = 1; }
      else if (u < 0.9) { kv(u, [[0.56, ...fondo.toArray()], [0.66, ...tira.toArray()], [0.78, tira.x, tira.y, tira.z + 0.04], [0.84, ...tira.toArray()]], _v); w = 1; }
      else { _v.copy(tira); w = 1 - tramo(u, 0.86, 1); }
      manoA(ud, _v, w);
      if (tipo === 'cerrojo' && ud.cerrojo) mueveCerrojo(ud.cerrojo, (u - 0.68) / 0.24);
      else if (atras) atras.position.z = atras.userData.p0.z + 0.04 * (u > 0.66 && u < 0.84 ? tramo(u, 0.66, 0.78) : 0);
    } else if (tipo === 'escopeta') {
      giro.rz = -0.5 * inclina; giro.rx = 0.1 * inclina; giro.px = -0.02 * inclina;
      const port = ud.puerto, cargando = u > 0.06 && u < 0.66;
      if (cargando) {
        const f = ((u - 0.06) / 0.15) % 1;
        const baja = f < 0.67 ? 1 - suave(f / 0.67) : suave((f - 0.67) / 0.33);
        _v.copy(port).add(V(0, -0.055 - 0.13 * baja, 0.03 * baja));
        manoA(ud, _v, 1);
        ud.cartucho.visible = f < 0.67;
      } else {
        ud.cartucho.visible = false;
        // Después de los cartuchos, la mano a la bomba, y bomba (0.72–0.9).
        _v.copy(port).add(V(0, -0.055, 0));
        manoA(ud, _v, 1 - tramo(u, 0.66, 0.72) - (u < 0.06 ? 1 - tramo(u, 0, 0.06) : 0));
        const b = loma(u, 0.74, 0.9);
        ud.bomba.position.z = ud.bomba.userData.p0.z + 0.07 * b;
        if (u >= 0.72) ud.manoIzq.position.z += 0.07 * b;
      }
    } else if (tipo === 'cohete') {
      giro.rx = -0.25 * inclina; giro.ry = 0.35 * inclina; giro.rz = 0.15 * inclina; giro.py = -0.04 * inclina;
      const co = ud.cohete, s = ud.asiento;
      // La mano baja (0–0.2), sube con el cohete delante del tubo (0.2–0.42), lo
      // mete (0.42–0.72), le da un golpecito y vuelve.
      if (u < 0.2) { co.visible = false; manoA(ud, _v.copy(s).add(V(0, -0.35, 0.1)), tramo(u, 0, 0.2)); }
      else if (u < 0.8) {
        co.visible = true;
        kv(u, [[0.2, s.x, s.y - 0.35, s.z - 0.1], [0.42, s.x, s.y, s.z - 0.24], [0.72, s.x, s.y, s.z]], co.position);
        manoA(ud, _v.copy(co.position).add(V(0, -0.08, -0.02)), 1);
      } else { co.position.copy(s); co.visible = true; manoA(ud, _v.copy(s).add(V(0, -0.08, -0.02)), 1 - tramo(u, 0.8, 1)); }
    } else if (tipo === 'rayo') {
      giro.rz = 0.35 * inclina; giro.rx = 0.15 * inclina;
      const c = ud.cargador, p0 = c.userData.p0;
      if (u < 0.15) { c.position.copy(p0); c.visible = true; }
      else if (u < 0.3) { const k = (u - 0.15) / 0.15; c.position.copy(p0).add(V(0.1 * k, 0.25 * k - 0.2 * k * k, 0)); c.rotation.z = -k * 3; c.visible = k < 0.95; }
      else if (u < 0.56) { c.visible = true; c.rotation.copy(c.userData.r0); kv(u, [[0.3, p0.x - 0.1, p0.y - 0.3, p0.z + 0.05], [0.5, p0.x, p0.y + 0.07, p0.z], [0.56, p0.x, p0.y, p0.z]], c.position); }
      else { c.position.copy(p0); c.rotation.copy(c.userData.r0); c.visible = true; }
      ud.liquido.scale.y = u < 0.15 ? 1 : u < 0.56 ? 0.15 : 0.15 + 0.85 * tramo(u, 0.6, 0.9);
      if (u < 0.3) manoA(ud, _v.copy(p0).add(V(-0.1, -0.35, 0.05)), tramo(u, 0.08, 0.3));
      else if (u < 0.6) manoA(ud, _v.copy(c.position).add(V(-0.03, 0.0, 0.01)), 1);
      else manoA(ud, _v.copy(p0).add(V(-0.03, 0, 0.01)), 1 - tramo(u, 0.6, 0.8));
    } else if (tipo === 'cinta') {
      giro.rz = 0.3 * inclina; giro.rx = 0.1 * inclina; giro.py = 0.02 * inclina;
      const t = ud.tapa, c = ud.cargador, p0 = c.userData.p0;
      t.rotation.x = 1.1 * (tramo(u, 0.12, 0.24) - tramo(u, 0.72, 0.84));
      const frente = V(0, 0.09, -0.08);
      let d = 0;
      if (u >= 0.36 && u < 0.5) d = 0.4 * tramo(u, 0.36, 0.5);
      else if (u >= 0.5 && u < 0.64) d = 0.4 * (1 - tramo(u, 0.5, 0.64));
      c.position.copy(p0).add(V(0, -d, 0));
      c.visible = !(u > 0.48 && u < 0.52);
      const caja0 = _w.copy(p0).add(V(0, -0.075, 0));
      if (u < 0.24) manoA(ud, frente, tramo(u, 0, 0.12));
      else if (u < 0.36) manoA(ud, _v.lerpVectors(frente, caja0, tramo(u, 0.24, 0.36)), 1);
      else if (u < 0.64) manoA(ud, _v.copy(c.position).add(V(0, -0.075, 0)), 1);
      else if (u < 0.86) manoA(ud, _v.lerpVectors(caja0, frente, tramo(u, 0.64, 0.72)), 1);
      else manoA(ud, frente, 1 - tramo(u, 0.86, 1));
      giro.py += 0.018 * loma(u, 0.82, 0.9);
    } else if (tipo === 'peine') {
      giro.rz = 0.3 * inclina; giro.rx = 0.1 * inclina;
      const c = ud.cargador, p0 = c.userData.p0, ce = ud.cerrojo;
      ce.position.z = ce.userData.p0.z + 0.05 * (tramo(u, 0.04, 0.12) - tramo(u, 0.8, 0.84));
      if (u < 0.28) { c.visible = false; manoA(ud, _v.copy(p0).add(V(0, -0.35, 0.05)), tramo(u, 0.1, 0.28)); }
      else if (u < 0.62) {
        c.visible = true;
        kv(u, [[0.28, p0.x, p0.y - 0.35, p0.z + 0.05], [0.45, p0.x, p0.y + 0.13, p0.z], [0.56, p0.x, p0.y, p0.z]], c.position);
        manoA(ud, _v.copy(c.position).add(V(0, 0.05, 0.01)), 1);
      } else { c.visible = true; c.position.copy(p0); manoA(ud, _v.copy(p0).add(V(0, 0.05, 0.01)), 1 - tramo(u, 0.62, 0.8)); }
      giro.py += 0.012 * loma(u, 0.8, 0.88);
    }
    return giro;
  }
  // El cerrojo del rifle, con `k` de 0 a 1: se levanta, va atrás, adelante y baja.
  function mueveCerrojo(ce, k) {
    const r0 = ce.userData.r0, p0 = ce.userData.p0;
    if (k <= 0 || k >= 1) { ce.rotation.copy(r0); ce.position.copy(p0); return 0; }
    ce.rotation.z = r0.z + 1.1 * (tramo(k, 0, 0.2) - tramo(k, 0.75, 0.95));
    ce.position.z = p0.z + 0.07 * (tramo(k, 0.2, 0.45) - tramo(k, 0.45, 0.7));
    return loma(k, 0, 1);
  }

  return {
    get modelo() { return actual; },
    // Disparó el que lleva el arma `id`.
    dispara(id) {
      const a = ARMAS[id] || {};
      const m = actual;
      if (!m || m.userData.id !== id) return;
      const ud = m.userData, kick = a.retroceso || 0.02;
      muelle.vz += 0.25 + kick * 14;
      muelle.vx += 0.5 + kick * 30;
      muelle.vr += (Math.random() - 0.5) * (0.4 + kick * 12);
      if (a.melee) return;
      pulso = 1;
      if (ud.giro) giroV = Math.max(giroV, id === MAQUINA ? 40 : 30);
      fogT = 0.05;
      fogonazo.material.color.set(ud.luz || '#ffcf7a');
      luz.color.set(ud.luz || '#ffb35a');
      fogonazo.material.rotation = Math.random() * Math.PI * 2;
      fogonazo.scale.setScalar((a.cohete ? 0.3 : 0.12 + (a.perdigones > 1 ? 0.08 : 0)) * (0.8 + Math.random() * 0.4));
      if (ud.cohete) ud.cohete.visible = false;
      if (ud.bomba) bombaT = -0.36;
      else if (ud.recarga === 'cerrojo') cerrojoT = -0.45;
      else if (ud.expulsa && !a.cohete) salta(m);
    },
    saca() { saca = 1; },
    aterriza(f) { caida.v -= 0.5 * Math.min(1.6, f); },
    // e: {ver, id, pap, mov (0–1), sprint (0–1), cruza, zoom, recarga (0–1, o
    //     -1), yaw, pitch, bob, gatillo, balas, melee}
    paso(dt, e) {
      const m = modelo(e.id, e.pap);
      if (m !== actual) { if (actual) { actual.visible = false; reposo(actual.userData); } actual = m; balasAntes = -1; }
      m.visible = e.ver;
      const ud = m.userData;
      // Los resortes del retroceso y del aterrizaje.
      const K = 260, C = 26;
      muelle.vz += (-K * muelle.z - C * muelle.vz) * dt; muelle.z += muelle.vz * dt;
      muelle.vx += (-K * muelle.x - C * muelle.vx) * dt; muelle.x += muelle.vx * dt;
      muelle.vr += (-K * muelle.r - C * muelle.vr) * dt; muelle.r += muelle.vr * dt;
      caida.v += (-150 * caida.y - 16 * caida.v) * dt; caida.y += caida.v * dt;
      // El balanceo: el arma se queda atrás al girar la cabeza.
      if (yawAntes === null) { yawAntes = e.yaw; pitchAntes = e.pitch; }
      let dy = e.yaw - yawAntes;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const dp = e.pitch - pitchAntes;
      yawAntes = e.yaw; pitchAntes = e.pitch;
      const ks = 1 - Math.exp(-10 * dt), lim = v => Math.max(-0.08, Math.min(0.08, v));
      const idt = 1 / Math.max(dt, 1e-3);
      swayX += (lim(dy * idt * 0.012) - swayX) * ks;
      swayY += (lim(dp * idt * 0.012) - swayY) * ks;
      saca = Math.max(0, saca - dt / 0.4);
      pulso = Math.max(0, pulso - dt * 16);
      fogT = Math.max(0, fogT - dt);
      bombaT += dt; cerrojoT += dt;
      // Las piezas que se mueven solas.
      if (ud.giro) {
        giroV = Math.max(e.id === MAQUINA ? (e.gatillo ? 40 : 6) : 0, giroV - dt * (e.id === MAQUINA ? 30 : 60));
        ud.giro.rotation.z += giroV * dt;
      }
      if (!e.ver) { fogonazo.visible = false; luz.intensity = 0; return m; }
      const t = performance.now() / 1000;
      const amp = e.mov * (1 + e.sprint * 0.7);
      const bx = Math.sin(e.bob) * 0.013 * amp;
      const by = (Math.abs(Math.cos(e.bob)) - 1) * 0.014 * amp + Math.sin(t * 1.6) * 0.003 * (1 - e.mov);
      pivote.position.set(0, caida.y, 0);
      pivote.rotation.set(-swayY * 0.6 + Math.sin(t * 1.6) * 0.004 * (1 - e.mov), -swayX * 0.9, -swayX * 0.6);
      reposo(ud);
      const r = e.recarga >= 0 ? recarga(m, e.recarga) : null;
      if (ud.cartucho && !r) ud.cartucho.visible = false;
      // Lo que pasa a cada tiro: la corredera, el cerrojo del fusil, la bomba.
      if (ud.corredera && !r) ud.corredera.position.z = ud.corredera.userData.p0.z + 0.032 * pulso;
      if (ud.recarga === 'peine' && !r) ud.cerrojo.position.z = ud.cerrojo.userData.p0.z + 0.045 * pulso;
      let extra = 0;
      if (ud.bomba && !r && bombaT >= 0 && bombaT < 0.36) {
        const b = loma(bombaT, 0, 0.36);
        ud.bomba.position.z += 0.07 * b;
        if (ud.manoIzq) ud.manoIzq.position.z += 0.07 * b;
        extra = 0.08 * b;
        if (bombaT - dt < 0.14 && bombaT >= 0.14) salta(m, true);
      }
      if (ud.recarga === 'cerrojo' && !r && cerrojoT >= 0 && cerrojoT < 0.6) {
        extra = 0.25 * mueveCerrojo(ud.cerrojo, cerrojoT / 0.6);
        if (cerrojoT - dt < 0.25 && cerrojoT >= 0.25) salta(m);
      }
      // El cohete se ve cargado si quedan balas; el peine de la Huevera salta
      // con el último tiro.
      if (ud.cohete && !r) ud.cohete.visible = e.balas > 0;
      if (ud.recarga === 'peine' && !r) {
        if (balasAntes > 0 && e.balas === 0) {
          const peine = ud.cargador.clone();
          peine.scale.setScalar(ud.escala);
          salta(m, false, peine);
        }
        ud.cargador.visible = e.balas > 0;
      }
      balasAntes = e.balas;
      // Todo junto.
      const s2 = saca * saca, cruza = e.cruza;
      const b0 = ud.base || V(0.2, -0.19, -0.62);
      m.position.set(
        b0.x + bx - e.zoom * 0.24 + (r ? r.px : 0) + 0.03 * cruza,
        b0.y + by - e.sprint * 0.05 - 0.28 * s2 + (r ? r.py : 0),
        b0.z + muelle.z + (r ? r.pz : 0),
      );
      m.rotation.set(
        muelle.x - cruza * 0.35 - 1.0 * s2 + (r ? r.rx : 0) + extra * 0.3,
        0.05 + cruza * 0.45 + (r ? r.ry : 0),   // apenas hacia la mira
        Math.sin(e.bob) * 0.025 * amp + muelle.r + 0.3 * s2 + cruza * 0.2 + (r ? r.rz : 0) - extra,
      );
      // El fogonazo en la boca.
      fogonazo.visible = fogT > 0;
      if (fogT > 0) {
        m.updateMatrixWorld(true);
        ud.boca.getWorldPosition(fogonazo.position);
        luz.position.copy(fogonazo.position);
      }
      luz.intensity = fogT > 0 ? 6 : 0;
      // Las vainas.
      for (const s of vainas) {
        if (s.t <= 0) continue;
        s.t -= dt;
        const o = s.cosa || s.m;
        s.v.y -= 9.8 * dt;
        o.position.addScaledVector(s.v, dt);
        o.rotation.x += s.w.x * dt; o.rotation.y += s.w.y * dt; o.rotation.z += s.w.z * dt;
        if (s.t <= 0) { s.m.visible = false; if (s.cosa) { escena.remove(s.cosa); s.cosa = null; } }
      }
      return m;
    },
  };
}
