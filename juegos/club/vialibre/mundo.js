/* Vía Libre — el mundo 3D (todo lo que se dibuja).

   QUÉ HACE, EN GLOBAL
   Dibuja la carrera con Three.js: la vía, la ciudad a los costados, los
   trenes, barreras, rampas, monedas y poderes que manda el motor, el
   corredor (articulado, con sus poses), el inspector y su perro, el cielo,
   la niebla, las luces y el post-proceso. No decide nada del juego: recibe
   "en qué metro va el corredor y qué está haciendo" y lo muestra.

   LAS TRES ESTÉTICAS
   Cada estación usa una de tres maneras de dibujar, con su paleta:
   - "juguete": materiales con reflejos (PBR), sombras suaves y, en calidad
     alta, oclusión ambiental (GTAO) y un poco de brillo.
   - "neon": todo oscuro con bordes y luces que brillan (bloom), piso de
     espejo mojado y un sol synthwave.
   - "pixel": sombreado por escalones (toon) dibujado a baja resolución por
     RenderPixelatedPass, que además marca los bordes con un píxel.
   Un "kit" es todo lo que hace falta para una estación: materiales,
   texturas, modelos y sus reservas. Se arma una vez y se guarda.

   POR QUÉ ESTÁ HECHO ASÍ (rendimiento en el celular)
   - Cada objeto se arma con muchas piezas (un tren tiene ~60), pero las que
     comparten material se FUNDEN en una sola malla con el color guardado en
     cada vértice (`Arma`). Un tren cuesta así ~5 llamadas al GPU, no 60.
   - Nada se crea en plena carrera: trenes, edificios, monedas… salen de una
     reserva y vuelven a ella cuando quedan atrás.
   - Las monedas son una sola InstancedMesh: cientos de monedas, una llamada.
   - La vía, los muros y las veredas no se mueven: se desplaza su textura.
   - El cambio de estética ocurre dentro de un túnel, donde no se ve el
     mundo de afuera, y los materiales nuevos se compilan ahí mismo.

   COORDENADAS: el corredor está siempre en z = 0 y corre hacia −z. Un
   objeto en el metro d de la pista se dibuja en z = −(d − D), donde D es el
   metro del corredor. x es el carril (−2,2 / 0 / 2,2), y es la altura. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const MOTOR = window.ViaLibreMotor;                // el motor (motor.js), cargado antes como script
const CARRILES = MOTOR.CARRILES;                   // x de cada carril
const L_VAGON = MOTOR.LARGO_VAGON;                 // largo de un vagón
const TECHO = MOTOR.ALTO_TECHO;                    // altura del techo de un tren
const VISTA = 195;                                 // hasta cuántos metros por delante se dibujan las cosas
const DETRAS = 16;                                 // cuántos metros por detrás siguen existiendo
const SUELO = 0.14;                                // la vía (el balasto) está 14 cm sobre el piso: ahí pisa el corredor

/* ===================================================================
   1. HERRAMIENTAS
   =================================================================== */

const color = hex => new THREE.Color(hex);                                   // un color de Three a partir de 0xRRGGBB
const hexCss = n => '#' + new THREE.Color(n).getHexString();                 // 0xRRGGBB → "#rrggbb" para el canvas
const mezclaCss = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
/** Un generador al azar con semilla (el mismo del motor), para que la ciudad salga igual cada vez. */
const azarDe = s => MOTOR.rng(s);

/* Geometrías base que se escalan: una caja de 1×1×1 sirve para todas las cajas. */
const CAJA = new THREE.BoxGeometry(1, 1, 1);
const CILINDRO = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const CILINDRO_CHICO = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const ESFERA = new THREE.SphereGeometry(0.5, 18, 12);
const cacheRedonda = new Map();
/** Una caja de bordes redondeados (se cachea por medidas: no se puede escalar sin deformar las curvas). */
function redonda(w, h, d, r, s = 3) {
  const k = [w, h, d, r, s].map(v => v.toFixed(3)).join('|');
  if (!cacheRedonda.has(k)) cacheRedonda.set(k, new RoundedBoxGeometry(w, h, d, s, Math.min(r, Math.min(w, h, d) / 2 - 1e-3)));
  return cacheRedonda.get(k);
}

/** Prepara una geometría para fundirla: sin índice, con uv, con un color por
    vértice y con su posición/rotación/escala ya aplicadas. */
function prepara(geo, col, matriz) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();                    // todas sin índice, para poder unirlas
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);   // solo lo que se usa
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count, c = new THREE.Color(col), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }   // el mismo color en todos los vértices
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (matriz) g.applyMatrix4(matriz);                                        // la pieza queda en su lugar dentro del objeto
  return g;
}
/** Une varias geometrías preparadas en una sola (concatena posiciones, normales, uv y colores). */
function funde(lista) {
  let n = 0;
  for (const g of lista) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [k, t] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
    const arr = new Float32Array(n * t);
    let o = 0;
    for (const g of lista) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, t));
  }
  out.computeBoundingSphere();
  return out;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Matriz de posición [x,y,z], rotación [rx,ry,rz] y escala (número o [sx,sy,sz]). */
function matriz(pos = [0, 0, 0], rot = null, esc = 1) {
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  _q.setFromEuler(_e);
  _p.set(pos[0], pos[1], pos[2]);
  if (Array.isArray(esc)) _s.set(esc[0], esc[1], esc[2]); else _s.set(esc, esc, esc);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** Arma un objeto con piezas y, al final, funde las piezas por material.
    Ejemplo: a.pon(CAJA, 'plano', 0xff0000, [0, 1, 0], null, [2, 1, 1]) agrega
    una caja roja de 2×1×1 a un metro de altura. */
class Arma {
  constructor(kit) { this.kit = kit; this.grupos = new Map(); this.bordes = new Map(); this.sombra = true; }
  pon(geo, clave, col, pos, rot, esc, borde) {
    const m = matriz(pos, rot, esc);
    if (!this.grupos.has(clave)) this.grupos.set(clave, []);
    this.grupos.get(clave).push(prepara(geo, col, m));
    if (borde != null && this.kit.neon) {                                    // en neón, esta pieza lleva bordes que brillan
      if (!this.bordes.has(borde)) this.bordes.set(borde, []);
      const eg = new THREE.EdgesGeometry(geo, 28); eg.applyMatrix4(m);
      this.bordes.get(borde).push(eg);
    }
    return this;
  }
  hecho(sombras = true) {
    const g = new THREE.Group();
    for (const [clave, lista] of this.grupos) {
      const malla = new THREE.Mesh(funde(lista), this.kit.mat(clave));
      malla.castShadow = sombras && !clave.startsWith('luz') && !clave.startsWith('texluz');
      malla.receiveShadow = sombras;
      g.add(malla);
    }
    for (const [col, lista] of this.bordes) g.add(this.kit.lineas(lista, col));   // las líneas de neón, una por color
    return g;
  }
}

/* ===================================================================
   2. TEXTURAS DIBUJADAS EN EL NAVEGADOR (ninguna imagen se descarga)
   =================================================================== */

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function aTextura(c, { repetir = true, pixel = false, rep = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;                                         // los colores del canvas están en sRGB
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  if (pixel) t.magFilter = THREE.NearestFilter;                                // en pixel, sin suavizar
  t.anisotropy = 4;
  return t;
}
const TEX = {
  /** Grava: miles de piedritas con su sombra. */
  grava(az, base) {
    const [c, x] = lienzo(256, 256);
    x.fillStyle = hexCss(base); x.fillRect(0, 0, 256, 256);
    const tonos = [0x7d7264, 0x9b8f7f, 0xb7ac9c, 0x6c6357, 0xc9bfae, 0x8a7a68];
    for (let i = 0; i < 2400; i++) {
      const px = az() * 256, py = az() * 256, r = 1.2 + az() * 3;
      x.fillStyle = 'rgba(40,32,24,.35)'; x.beginPath(); x.ellipse(px + 1, py + 1.2, r, r * .75, az() * 3, 0, 7); x.fill();
      x.fillStyle = hexCss(tonos[Math.floor(az() * tonos.length)]); x.beginPath(); x.ellipse(px, py, r, r * .75, az() * 3, 0, 7); x.fill();
    }
    return c;
  },
  /** Ladrillos con mortero, cada uno de un tono un poco distinto. */
  ladrillo(az, tono) {
    const [c, x] = lienzo(256, 256);
    x.fillStyle = '#d9cfc2'; x.fillRect(0, 0, 256, 256);
    for (let f = 0; f < 8; f++) for (let k = -1; k < 5; k++) {
      const bx = k * 64 + (f % 2) * 32, by = f * 32;
      const t = new THREE.Color(tono).offsetHSL((az() - .5) * .03, (az() - .5) * .1, (az() - .5) * .12);
      x.fillStyle = '#' + t.getHexString(); x.fillRect(bx + 2, by + 2, 60, 28);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(bx + 2, by + 2, 60, 4);
    }
    return c;
  },
  /** Ruido suave (estuco, vereda): manchas claras y oscuras sobre casi blanco. */
  ruido(az) {
    const [c, x] = lienzo(256, 256);
    x.fillStyle = '#f2f0ec'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${az() < .5 ? '0,0,0' : '255,255,255'},${.03 + az() * .05})`; x.beginPath(); x.arc(az() * 256, az() * 256, 2 + az() * 10, 0, 7); x.fill(); }
    return c;
  },
  /** Muro de hormigón con juntas y una mancha de humedad abajo. */
  muro(az) {
    const [c, x] = lienzo(512, 256);
    x.fillStyle = '#bdb8ae'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${az() < .5 ? '60,55,50' : '255,255,255'},${.03 + az() * .06})`; x.beginPath(); x.arc(az() * 512, az() * 256, 1 + az() * 6, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, 256, 0, 150); g.addColorStop(0, 'rgba(70,60,50,.35)'); g.addColorStop(1, 'rgba(70,60,50,0)');
    x.fillStyle = g; x.fillRect(0, 150, 512, 106);
    x.fillStyle = 'rgba(60,55,50,.45)'; for (let k = 0; k < 512; k += 128) x.fillRect(k, 0, 3, 256);
    return c;
  },
  /** Rayas diagonales de dos colores (barreras, cintas de peligro). */
  rayas(c1, c2, n = 8) {
    const [c, x] = lienzo(256, 64);
    x.fillStyle = hexCss(c2); x.fillRect(0, 0, 256, 64);
    x.fillStyle = hexCss(c1);
    const paso = 256 / n;
    for (let k = -1; k < n + 1; k++) { x.beginPath(); x.moveTo(k * paso, 64); x.lineTo(k * paso + paso / 2, 64); x.lineTo(k * paso + paso / 2 + 32, 0); x.lineTo(k * paso + 32, 0); x.fill(); }
    return c;
  },
  /** Rejilla metálica (la superficie de la rampa). */
  rejilla() {
    const [c, x] = lienzo(128, 128);
    x.fillStyle = '#9aa3ae'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#5d6672'; x.lineWidth = 5;
    for (let k = -128; k < 256; k += 22) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke(); x.beginPath(); x.moveTo(k + 128, 0); x.lineTo(k, 128); x.stroke(); }
    return c;
  },
  /** Toldo a rayas verticales. */
  toldo(c1, c2, brillo = 1) {
    const [c, x] = lienzo(128, 64);
    for (let k = 0; k < 8; k++) { x.fillStyle = mezclaCss(k % 2 ? c2 : c1, 0x000000, 1 - brillo); x.fillRect(k * 16, 0, 16, 64); }
    return c;
  },
  /** Un letrero con texto centrado. */
  cartel(texto, fondo, tinta, fuente, neon) {
    const [c, x] = lienzo(512, 128);
    x.fillStyle = fondo; x.fillRect(0, 0, 512, 128);
    if (!neon) { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 120); }
    x.font = fuente; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (neon) { x.shadowColor = tinta; x.shadowBlur = 18; }
    x.fillStyle = tinta; x.fillText(texto, 256, 70);
    return c;
  },
  /** Un grafiti: letras gordas con contorno, degradado, brillo y chorreados. */
  grafiti(az, texto, c1, c2, brillo = 1) {
    const [c, x] = lienzo(1024, 300);
    x.font = '190px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 40 + az() * 70), col = new THREE.Color(az() < .5 ? c1 : c2);
      g.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},.22)`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.save(); x.translate(80 + az() * 860, 60 + az() * 180); x.fillStyle = g; x.fillRect(-120, -120, 240, 240); x.restore();
    }
    x.save(); x.translate(512, 160); x.rotate(-0.05);
    x.lineJoin = 'round'; x.lineWidth = 34; x.strokeStyle = '#151824'; x.strokeText(texto, 0, 0);
    const g = x.createLinearGradient(0, -80, 0, 80); g.addColorStop(0, mezclaCss(c1, 0, 1 - brillo)); g.addColorStop(1, mezclaCss(c2, 0, 1 - brillo));
    x.fillStyle = g; x.fillText(texto, 0, 0);
    x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,.6)'; x.strokeText(texto, -4, -6);
    x.restore();
    x.fillStyle = hexCss(c2);
    for (let i = 0; i < 9; i++) { const dx = 200 + az() * 620; x.fillRect(dx, 220, 7, 30 + az() * 50); x.beginPath(); x.arc(dx + 3.5, 252 + az() * 30, 6, 0, 7); x.fill(); }
    return c;
  },
  /** La señal redonda con flecha hacia abajo de la barrera alta. */
  flecha(neon) {
    const [c, x] = lienzo(256, 256);
    x.fillStyle = neon ? '#0a0418' : '#ffffff'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
    x.lineWidth = 22; x.strokeStyle = neon ? '#22e5ff' : '#1f5fd6'; x.beginPath(); x.arc(128, 128, 108, 0, 7); x.stroke();
    x.fillStyle = neon ? '#22e5ff' : '#1f5fd6';
    x.beginPath(); x.moveTo(98, 52); x.lineTo(158, 52); x.lineTo(158, 132); x.lineTo(196, 132); x.lineTo(128, 206); x.lineTo(60, 132); x.lineTo(98, 132); x.closePath(); x.fill();
    return c;
  },
  /** El letrero de destino del tren («3 · CENTRO»). */
  destino() {
    const [c, x] = lienzo(512, 128);
    x.fillStyle = '#120e0a'; x.fillRect(0, 0, 512, 128);
    x.font = '700 72px Orbitron, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffb43a'; x.fillText('3  CENTRO', 256, 70);
    return c;
  },
  /** La cara del poder 2×. */
  doble() {
    const [c, x] = lienzo(256, 256);
    const g = x.createRadialGradient(128, 110, 10, 128, 128, 128); g.addColorStop(0, '#5fb0ff'); g.addColorStop(1, '#1d4fd6');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.font = '150px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 16; x.strokeStyle = '#0b1f5c'; x.strokeText('2×', 128, 138); x.fillStyle = '#ffffff'; x.fillText('2×', 128, 138);
    return c;
  },
  /** La caja misteriosa: un signo de pregunta sobre madera pintada. */
  caja() {
    const [c, x] = lienzo(256, 256);
    x.fillStyle = '#ffb02e'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#8a4f00'; x.lineWidth = 18; x.strokeRect(9, 9, 238, 238);
    x.font = '190px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 14; x.strokeStyle = '#6a3d00'; x.strokeText('?', 128, 140); x.fillStyle = '#fff6d0'; x.fillText('?', 128, 140);
    return c;
  },
  /** El boleto dorado. */
  boleto() {
    const [c, x] = lienzo(512, 256);
    const g = x.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, '#fff1a8'); g.addColorStop(.5, '#ffc93a'); g.addColorStop(1, '#e09a10');
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#ffffff55'; for (let i = 0; i < 12; i++) x.fillRect(0, i * 22, 512, 2);
    x.setLineDash([10, 10]); x.lineWidth = 6; x.strokeStyle = '#8a5a00'; x.strokeRect(14, 14, 484, 228); x.setLineDash([]);
    x.font = '700 64px Orbitron, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#6a3d00'; x.fillText('LÍNEA 3', 256, 104);
    x.font = '700 36px Orbitron, "Arial Black", sans-serif'; x.fillText('BOLETO DORADO', 256, 170);
    return c;
  },
  /** El sol synthwave a rayas. */
  solSynth(c1 = '#ffe46b', c2 = '#ff6a9a', c3 = '#ff2bd6') {
    const [c, x] = lienzo(256, 256);
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c1); g.addColorStop(.55, c2); g.addColorStop(1, c3);
    x.fillStyle = g; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) x.fillRect(0, 138 + i * 17, 256, 2 + i * 1.7);
    return c;
  },
  /** Una mancha de luz redonda (para los brillos de neón). */
  brillo() {
    const [c, x] = lienzo(64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  },
  /** El letrero de la entrada del túnel: «PRÓXIMA ESTACIÓN · …». */
  tunel(nombre) {
    const [c, x] = lienzo(1024, 192);
    x.fillStyle = '#1b2a4a'; x.fillRect(0, 0, 1024, 192);
    x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.strokeRect(10, 10, 1004, 172);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffd23f';
    x.font = '700 40px Orbitron, "Arial Black", sans-serif'; x.fillText('PRÓXIMA ESTACIÓN', 512, 58);
    x.fillStyle = '#ffffff'; x.font = '84px "Lilita One", "Arial Black", sans-serif'; x.fillText(String(nombre).toUpperCase(), 512, 128);
    return c;
  }
};
/** UV en metros: así una textura que se repite no se estira en una caja larga. */
function uvMundo(geo, tile = 1, dy = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i) + dy; }       // caras de los costados: u a lo largo de la vía
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }                    // caras de arriba: v a lo largo de la vía
    else { u = p.getX(i); v = p.getY(i) + dy; }
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

/* ===================================================================
   3. PALETAS: los colores y la luz de cada estación
   =================================================================== */

const BASE_JUGUETE = {
  estilo: 'juguete',
  cielo: { arriba: 0x3d8ff0, horizonte: 0xcfe9ff, sol: 0xfff3d0 }, niebla: [55, 175],
  sol: [0xfff1dc, 2.7, [-16, 26, 14]], hemi: [0xdcefff, 0x8f8068, 0.55], env: 0.4, exposicion: 0.9,
  post: { bloom: [0.22, 0.4, 0.95], vineta: 0.34, sat: 1.16 },
  c: {
    grava: 0xa39684, tierra: 0x8d8473, traviesa: 0x6f5643, riel: 0xb0b9c3, muro: 0xd9d5cd, acera: 0xb9b2a7, bordillo: 0xa39d93,
    trenes: [0xe2443a, 0x2c7be0, 0xf0ad2e], acentos: [0xffffff, 0xffd23f, 0x23304a], bajo: 0x353a44, vidrio: 0x223449, techoTren: 0xd5dae0,
    edificios: [0xf2c46b, 0xee8f6a, 0x86ceb0, 0xa99ae6, 0xeef0f3, 0xf4a6b8], ladrillo: 0xb5563c, probLadrillo: 0.45,
    marco: 0xf6f3ec, vidrioEd: 0x2a3d58, cornisa: 0xe9e3d8, vitrina: 0x6a5444,
    toldos: [[0xe8463b, 0xffffff], [0x2f7fe0, 0xffffff], [0x2fb59a, 0xf6f2e8], [0xf2b233, 0x6a4632]],
    arboles: [0x3fa34d, 0x5bbd5c, 0x2f8c45], tronco: 0x7a5236, poste: 0x48525e, farol: 0xe8e0c8, catenaria: 0x55606c,
    barrera: 0xe8463b, barrera2: 0xffffff, ambar: 0xffa424, rampa: 0xffffff, oro: 0xffc63a, iman: 0xe5332a, cromo: 0xf2f5f8, nube: 0xffffff, basurero: 0x2f8f5a
  },
  carteles: ['CAFÉ', 'PAN', 'FARMACIA', 'LIBROS', 'HELADOS', 'FRUTAS', 'MÚSICA'],
  grafitis: [['¡CORRE!', 0xff5a8a, 0xffd23f], ['VÍA LIBRE', 0x3fd0ff, 0x7a5cff], ['LAB', 0x8aff6a, 0x19b37a], ['ZOOM', 0xffa23a, 0xff3d6e]],
  extras: { nubes: true }
};
const BASE_PIXEL = {
  estilo: 'pixel',
  cielo: { arriba: 0x4b3474, horizonte: 0xffa070, sol: 0xffe7a8 }, niebla: [30, 160],
  sol: [0xffc890, 2.6, [-16, 13, -46]], hemi: [0xffcfb0, 0x4a3355, 1.15], env: 0, exposicion: 1,
  post: {},
  c: {
    grava: 0x8d5f52, tierra: 0x6d4c4a, traviesa: 0x5a3b2c, riel: 0x9a8ea6, muro: 0xc9a48a, acera: 0xb08a78, bordillo: 0x8a6a5c,
    trenes: [0x2f6fb6, 0xe2463a, 0xece3cc], acentos: [0xfff1d4, 0xfff1d4, 0x2a2442], bajo: 0x2a2232, vidrio: 0x2a2442, techoTren: 0x8a8090,
    edificios: [0x6c4f7c, 0x8f5b8a, 0xb5677f, 0x4f5d8c, 0xa0606a], ladrillo: 0xb5677f, probLadrillo: 0,
    marco: 0x3b2a40, vidrioEd: 0xffcf7a, cornisa: 0x4a3550, vitrina: 0x5a3f36,
    toldos: [[0xe2463a, 0xfff1d4], [0x2fb59a, 0xfff1d4], [0xffd23f, 0x5a3b2c]],
    arboles: [0x3f7a4a, 0x4f8c4f, 0x2f6a40], tronco: 0x5a3b2c, poste: 0x3b2a40, farol: 0xffe3a0, catenaria: 0x3b2a40,
    barrera: 0xe2463a, barrera2: 0xfff1d4, ambar: 0xffb020, rampa: 0x8a8090, oro: 0xffd23f, iman: 0xe2463a, cromo: 0xfff1d4, nube: 0xffd9c2, basurero: 0x3f7a4a
  },
  carteles: ['CAFÉ', 'PAN', 'ARCADE', 'LIBROS', 'DISCOS', 'FRUTAS'],
  grafitis: [['¡CORRE!', 0xffd23f, 0xe2463a], ['LAB', 0x2fb59a, 0x4f8c4f]],
  extras: { nubes: true, disco: true }
};
const BASE_NEON = {
  estilo: 'neon',
  cielo: { arriba: 0x04021a, horizonte: 0x3a0a48, sol: 0xff4fa0 }, niebla: [35, 165], nieblaColor: 0x16062a,
  sol: null, hemi: [0x6a4ab0, 0x0a0618, 0.2], env: 0.1, exposicion: 0.72,
  post: { bloom: [0.5, 0.3, 0.85], vineta: 0.6, sat: 1.1, aberracion: 0.0009, lineas: 0.03 },
  c: {
    grava: 0x0b0720, tierra: 0x07041a, traviesa: 0x3a1a70, riel: 0x22e5ff, muro: 0x2a1a50, acera: 0x120a2a, bordillo: 0x22e5ff,
    trenes: [0xff2bd6, 0x22e5ff, 0xffe14d], acentos: [0x22e5ff, 0xff2bd6, 0xff2bd6], bajo: 0x1a1030, vidrio: 0x5ad8e8, techoTren: 0x6a35c9,
    edificios: [0x7b5cff, 0xff2bd6, 0x22e5ff, 0x9a4dff], ladrillo: 0x7b5cff, probLadrillo: 0,
    marco: 0x2a1a50, vidrioEd: 0xffffff, cornisa: 0xb01f96, vitrina: 0x4a1a40,
    toldos: [[0xff2bd6, 0x22e5ff]], ventanas: [0x22e5ff, 0xff2bd6, 0xffe14d, 0x7b5cff, 0x1a0f30, 0x1a0f30],
    arboles: [0xff2bd6], tronco: 0xff2bd6, poste: 0x2a1a50, farol: 0xff7ae0, catenaria: 0xff2bd6, rejilla: 0xb01f96,
    barrera: 0xff3d6e, barrera2: 0xffe14d, ambar: 0xffb020, rampa: 0x22e5ff, oro: 0xffe14d, iman: 0xff3d6e, cromo: 0xffffff, nube: 0xffffff, basurero: 0x22e5ff
  },
  carteles: ['BAR', '24H', 'ARCADE', 'RAMEN', 'KARAOKE', 'DISCO'],
  grafitis: [['NEÓN', 0xff2bd6, 0x22e5ff], ['VÍA LIBRE', 0x22e5ff, 0x7b5cff]],
  extras: { synth: ['#ffe46b', '#ff6a9a', '#ff2bd6'], estrellas: true }
};
/** Copia una paleta base y cambia lo que se indique (también dentro de `c`). */
function variante(base, cambios) {
  const p = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(cambios)) {
    if (k === 'c') Object.assign(p.c, v); else if (k === 'extras') p.extras = Object.assign({}, p.extras, v); else p[k] = v;
  }
  return p;
}
export const PALETAS = {
  barrio: BASE_JUGUETE,
  ocaso: BASE_PIXEL,
  neon: BASE_NEON,
  /* Estación Fantasma: el neón se vuelve verde espectral, con niebla verde y un tren fantasma en el cielo. */
  fantasma: variante(BASE_NEON, {
    cielo: { arriba: 0x020a0c, horizonte: 0x0e3a32, sol: 0x7dffcf }, nieblaColor: 0x062019,
    c: { trenes: [0x7dffcf, 0xb6fff0, 0x3dd6ff], acentos: [0x7dffcf, 0x3dd6ff, 0x7dffcf], riel: 0x7dffcf, bordillo: 0x7dffcf, vidrio: 0x9fffe6,
      edificios: [0x2bd6a0, 0x3dd6ff, 0x7dffcf], ventanas: [0x7dffcf, 0x3dd6ff, 0xb6fff0, 0x0a1e1a, 0x0a1e1a, 0x0a1e1a], cornisa: 0x2bd6a0, catenaria: 0x3dd6ff, farol: 0x9fffe6, rejilla: 0x1a7a60, traviesa: 0x10403a, vitrina: 0x0f3a30 },
    carteles: ['ADIÓS', 'ÚLTIMO TREN', 'BOLETERÍA', 'ANDÉN 0'],
    grafitis: [['1 000 000', 0x7dffcf, 0x3dd6ff], ['HOLA', 0xb6fff0, 0x2bd6a0]],
    extras: { synth: ['#d6fff2', '#7dffcf', '#1f8a6a'], estrellas: true, espectros: true, trenFantasma: true }
  }),
  /* Invierno: la ciudad de juguete con nieve, cielo gris y copos que caen. */
  invierno: variante(BASE_JUGUETE, {
    cielo: { arriba: 0x8aa4c0, horizonte: 0xe6edf3, sol: 0xffffff }, niebla: [40, 150],
    sol: [0xeaf2ff, 2.0, [-16, 26, 14]], hemi: [0xeef4ff, 0xa0a8b8, 0.75],
    c: { grava: 0xe8edf2, tierra: 0xf2f5f8, acera: 0xf0f3f6, bordillo: 0xd6dde6, muro: 0xeef1f4, arboles: [0x2e6b4a, 0x3a7d58, 0x24583c],
      edificios: [0xc9d6e3, 0xe8c9b5, 0xb8c9b0, 0xd9c2e0, 0xf2e6d8], ladrillo: 0x9c5a4a, cornisa: 0xffffff, techoTren: 0xffffff },
    carteles: ['CHOCOLATE', 'SOPAIPILLAS', 'BUFANDAS', 'CAFÉ'],
    extras: { nubes: true, nieve: true }
  }),
  /* Fin de la Línea: amanece, todo dorado y rosado. */
  alba: variante(BASE_JUGUETE, {
    cielo: { arriba: 0x6a7fd0, horizonte: 0xffc2a0, sol: 0xfff0c0 }, niebla: [45, 165],
    sol: [0xffd6a0, 2.6, [-10, 10, -40]], hemi: [0xffe2c8, 0x7a6060, 0.7], exposicion: 0.95,
    c: { edificios: [0xffd6a5, 0xffadad, 0xfdffb6, 0xcaffbf, 0xbdb2ff], trenes: [0xffc63a, 0xffadad, 0xa0c4ff], arboles: [0x8ad06a, 0xa6db8a, 0x6fbf5a] },
    carteles: ['GRACIAS', 'FIN', 'OTRA VEZ', 'BUENOS DÍAS'],
    grafitis: [['GRACIAS', 0xffd23f, 0xff5a8a], ['FIN?', 0x3fd0ff, 0x7a5cff]],
    extras: { nubes: true, solBajo: true }
  }),
  /* Óxido: el atardecer pixelado se vuelve desierto oxidado, con polvo en el aire. */
  oxido: variante(BASE_PIXEL, {
    cielo: { arriba: 0x6a3a2a, horizonte: 0xffb070, sol: 0xfff0c0 }, niebla: [26, 140],
    sol: [0xffb878, 2.8, [-16, 13, -46]], hemi: [0xffc8a0, 0x5a3020, 1.1],
    c: { grava: 0xc08a5a, tierra: 0xb07a4a, acera: 0xc89a6a, muro: 0xa0623a, riel: 0x8a5a3a, edificios: [0x8a4a2a, 0xa05a30, 0x7a3a22, 0xb87040], arboles: [0x6a7a3a, 0x7a8a4a], trenes: [0x8a4a2a, 0xb87040, 0x5a6a7a] },
    carteles: ['AGUA', 'TALLER', 'POSADA', 'ÚLTIMA BOMBA'],
    extras: { nubes: false, disco: true, polvo: true }
  })
};

/* ===================================================================
   4. EL KIT DE UNA ESTACIÓN (materiales, texturas, modelos y reservas)
   =================================================================== */

let _gradToon = null;
/** Los escalones de luz del sombreado toon (pixel). */
function gradToon() {
  if (_gradToon) return _gradToon;
  _gradToon = new THREE.DataTexture(new Uint8Array([70, 130, 195, 255]), 4, 1, THREE.RedFormat);
  _gradToon.minFilter = _gradToon.magFilter = THREE.NearestFilter; _gradToon.needsUpdate = true;
  return _gradToon;
}
let _texBrillo = null;
const texBrillo = () => (_texBrillo ||= aTextura(TEX.brillo(), { repetir: false }));

class Kit {
  constructor(mundo, clave, pal) {
    this.mundo = mundo; this.clave = clave; this.pal = pal; this.c = pal.c;
    this.neon = pal.estilo === 'neon'; this.pixel = pal.estilo === 'pixel'; this.juguete = pal.estilo === 'juguete';
    this.az = azarDe(0xC17A + clave.length * 131 + clave.charCodeAt(0));   // la ciudad sale igual en cada visita
    this.mats = new Map(); this.texs = new Map(); this.lineasMat = new Map();
    this.reserva = new Map();          // tipo → objetos guardados para reusar
    this.almacen = new THREE.Group(); this.almacen.visible = false;   // donde esperan los objetos guardados
    this.listo = false;
  }
  /* ---- materiales ----
     Las claves dicen qué clase de material es y, después de ":", su textura:
     plano (mate), pintura (brillante), metal, vidrio, luz (sin sombreado,
     brilla), tex:x (con textura), texmetal:x, texluz:x (textura que brilla). */
  mat(clave) {
    if (this.mats.has(clave)) return this.mats.get(clave);
    const [tipo, tx] = clave.split(':');
    const map = tx ? this.tex(tx) : null;
    let m;
    if (tipo === 'luz' || tipo === 'texluz') m = new THREE.MeshBasicMaterial({ vertexColors: true, map, transparent: tipo === 'texluz' && !!tx && tx.startsWith('graf'), alphaTest: tx && tx.startsWith('graf') ? 0.02 : 0 });
    else if (this.pixel) m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradToon(), map, transparent: !!tx && tx.startsWith('graf'), alphaTest: tx && tx.startsWith('graf') ? 0.05 : 0 });
    else {
      const P = { plano: [.8, 0], pintura: [.34, .35], metal: [.28, .9], vidrio: [.06, .65], tex: [.9, 0], texmetal: [.5, .55] }[tipo] || [.8, 0];
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: P[0], metalness: P[1], map, envMapIntensity: this.pal.env,
        transparent: !!tx && tx.startsWith('graf'), alphaTest: tx && tx.startsWith('graf') ? 0.03 : 0 });
      if (this.neon && tipo !== 'personaje') m.color.setScalar(0.14);         // en neón todo lo que no brilla es casi negro…
    }
    /* …menos las personas: el corredor, el inspector y el perro. En neón la
       única luz es un cielo violeta muy tenue (0,2), y con eso un personaje
       de colores normales salía negro sobre el piso negro. Se les suma un
       brillo propio en sus mismos colores (el color del vértice como luz
       emitida), que se ve en cualquier calidad, con o sin bloom. */
    if (tipo === 'personaje' && this.neon) {
      m.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * 0.42;');
      };
      m.customProgramCacheKey = () => 'vialibre-personaje-neon';
    }
    if (m.transparent) { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    this.mats.set(clave, m);
    return m;
  }
  /* ---- texturas (se dibujan una vez y se reusan) ---- */
  tex(nombre) {
    if (this.texs.has(nombre)) return this.texs.get(nombre);
    const c = this.c, az = this.az, px = this.pixel;
    const [tipo, ...arg] = nombre.split('|');
    let t;
    switch (tipo) {
      case 'grava': t = aTextura(TEX.grava(az, c.grava), { pixel: px }); break;
      case 'gravaSuelo': t = aTextura(TEX.grava(az, c.tierra), { pixel: px }); break;
      case 'ladrillo': t = aTextura(TEX.ladrillo(az, c.ladrillo), { pixel: px }); break;
      case 'ruido': t = aTextura(TEX.ruido(az), { pixel: px }); break;
      case 'acera': t = aTextura(TEX.ruido(az), { pixel: px }); break;
      case 'muro': t = aTextura(TEX.muro(az), { pixel: px }); break;
      case 'rejilla': t = aTextura(TEX.rejilla(), { pixel: px, rep: [2.5, 2.5] }); break;
      case 'rayasRB': t = aTextura(TEX.rayas(c.barrera, c.barrera2, 7), { pixel: px }); break;
      case 'rayasRB8': t = aTextura(TEX.rayas(c.barrera, c.barrera2, 8), { pixel: px }); break;
      case 'rayasNA': t = aTextura(TEX.rayas(0x1d1f26, 0xffd23f, 6), { pixel: px }); break;
      case 'chevron': t = aTextura(TEX.rayas(0x1d1f26, 0xffd23f, 10), { pixel: px, rep: [1, 1] }); break;
      case 'flecha': t = aTextura(TEX.flecha(this.neon), { repetir: false, pixel: px }); break;
      case 'destino': t = aTextura(TEX.destino(), { repetir: false, pixel: px }); break;
      case 'doble': t = aTextura(TEX.doble(), { repetir: false, pixel: px }); break;
      case 'caja': t = aTextura(TEX.caja(), { repetir: false, pixel: px }); break;
      case 'boleto': t = aTextura(TEX.boleto(), { repetir: false, pixel: px }); break;
      case 'toldo': { const [c1, c2] = c.toldos[+arg[0] % c.toldos.length]; t = aTextura(TEX.toldo(c1, c2, this.neon ? 0.45 : 1), { pixel: px }); break; }
      case 'cartel': {
        const texto = arg[0];
        const k = [...texto].reduce((s, ch) => s + ch.charCodeAt(0), 0);
        const fondo = this.neon ? '#0a0418' : hexCss([0x23304a, 0xfff6e6, 0x2a6df4, 0xe8463b][k % 4]);
        const tinta = this.neon ? hexCss([0xff2bd6, 0x22e5ff, 0xffe14d, ...(c.ventanas || [])][k % 3]) : (k % 4 === 1 ? '#23304a' : '#ffffff');
        t = aTextura(TEX.cartel(texto, fondo, tinta, this.neon ? '700 80px Orbitron, sans-serif' : px ? '54px "Press Start 2P", monospace' : '86px "Lilita One", "Arial Black", sans-serif', this.neon), { repetir: false, pixel: px });
        break;
      }
      case 'graf': { const g = this.pal.grafitis[+arg[0] % this.pal.grafitis.length]; t = aTextura(TEX.grafiti(az, g[0], g[1], g[2], this.neon ? 0.85 : 1), { repetir: false, pixel: px }); break; }
      default: t = null;
    }
    this.texs.set(nombre, t);
    return t;
  }
  /** Líneas que brillan (neón) a partir de una lista de EdgesGeometry. */
  lineas(lista, col) {
    const pos = [];
    for (const eg of lista) pos.push(...eg.attributes.position.array);
    const g = new LineSegmentsGeometry(); g.setPositions(pos);
    if (!this.lineasMat.has(col)) {
      const lm = new LineMaterial({ color: col, linewidth: 2.2, worldUnits: false });
      lm.resolution.copy(this.mundo.resolucion);
      this.lineasMat.set(col, lm);
    }
    const l = new LineSegments2(g, this.lineasMat.get(col));
    l.frustumCulled = false;
    return l;
  }
  /** La clave del vidrio: reflectante de día, encendido de noche. */
  get vid() { return this.neon ? 'luz' : this.pixel ? 'plano' : 'vidrio'; }

  /* ---- reservas: sacar y guardar objetos ---- */
  saca(tipo, fabrica) {
    const lista = this.reserva.get(tipo);
    const o = lista && lista.length ? lista.pop() : fabrica();               // uno guardado o uno nuevo
    o.visible = true; o.userData.tipoReserva = tipo;
    if (o.parent !== this.mundo.vivos) this.mundo.vivos.add(o);
    return o;
  }
  guarda(o) {
    o.visible = false;
    const t = o.userData.tipoReserva;
    if (!this.reserva.has(t)) this.reserva.set(t, []);
    this.reserva.get(t).push(o);
  }
  /** Llena las reservas por adelantado (para que no se trabe en plena carrera).
      Devuelve una lista de pasos chicos: el mundo los va haciendo de a poco. */
  pasosDePreparacion() {
    const pasos = [];
    const pre = (tipo, fab, n) => { for (let i = 0; i < n; i++) pasos.push(() => { const o = fab(); o.visible = false; o.userData.tipoReserva = tipo; this.almacen.add(o); if (!this.reserva.has(tipo)) this.reserva.set(tipo, []); this.reserva.get(tipo).push(o); }); };
    for (let i = 0; i < 3; i++) pre('tren' + i, () => this.tren(i), 3);
    pre('rampa', () => this.rampa(), 3); pre('bajo', () => this.barreraBaja(), 5); pre('alto', () => this.barreraAlta(), 5);
    for (const lado of [-1, 1]) { pre('edificio' + lado, () => this.edificio(lado), 14); pre('farol' + lado, () => this.farol(lado), 6); pre('poste' + lado, () => this.poste(lado), 4); pre('graf' + lado, () => this.grafiti(lado), 3); if (!this.neon) pre('arbol', () => this.arbol(), 6); }
    for (const cl of ['iman', 'mochila', 'zapatillas', 'doble', 'caja']) pre('poder-' + cl, () => this.poder(cl), 1);
    pre('estrella', () => this.estrella(), 2); pre('boleto', () => this.boleto(), 1);
    pasos.push(() => { this.via = this.armaVia(); this.cielo = this.armaCielo(); this.monedas = this.armaMonedas(); this.listo = true; });
    return pasos;
  }

  /* ---- modelos ---- */

  /** Un vagón de metro. El perfil (paredes rectas, techo redondeado) se extruye a lo largo. */
  tren(i) {
    const c = this.c, a = new Arma(this), col = c.trenes[i % 3], ac = c.acentos[i % 3], L = L_VAGON - 0.3;
    a.pon(geoTren(L), 'pintura', col, [0, 0, 0], null, 1, col);
    a.pon(CAJA, 'plano', c.bajo, [0, 0.36, 0], null, [1.75, 0.34, L - 0.6]);
    for (const zb of [-3.7, 3.7]) {
      a.pon(CAJA, 'plano', c.bajo, [0, 0.32, zb], null, [1.5, 0.22, 2]);
      for (const s of [-1, 1]) for (const zr of [-0.62, 0.62]) a.pon(CILINDRO, 'metal', 0x2a2d33, [s * 0.6, 0.3, zb + zr], [0, 0, Math.PI / 2], [0.5, 0.12, 0.5]);
    }
    const puerta = new THREE.Color(col).multiplyScalar(0.8).getHex();
    for (const s of [-1, 1]) {
      a.pon(CAJA, this.vid, c.vidrio, [s * 1.02, 2.2, 0], null, [0.03, 0.85, L - 1.4]);                // la franja de ventanas
      for (let k = -3; k <= 3; k++) a.pon(CAJA, 'pintura', col, [s * 1.035, 2.2, k * 1.45], null, [0.04, 0.86, 0.15]);   // pilares
      for (const zp of [-2.6, 2.6]) {
        a.pon(CAJA, 'pintura', puerta, [s * 1.03, 1.62, zp], null, [0.03, 2.3, 1.35]);                 // puertas
        for (const dz of [-0.33, 0.33]) a.pon(CAJA, this.vid, c.vidrio, [s * 1.045, 2.15, zp + dz], null, [0.035, 0.9, 0.5]);
        a.pon(CAJA, 'plano', 0x22262c, [s * 1.05, 1.62, zp], null, [0.04, 2.3, 0.025]);
      }
      a.pon(CAJA, this.neon ? 'luz' : 'plano', ac, [s * 1.03, 1.45, 0], null, [0.03, 0.16, L]);        // franja de color
      a.pon(new THREE.PlaneGeometry(4.2, 1.2), this.neon ? `texluz:graf|${(i + (s > 0 ? 1 : 0)) % 9}` : `tex:graf|${(i + (s > 0 ? 1 : 0)) % 9}`, 0xffffff, [s * 1.045, 0.92, -0.2], [0, s * Math.PI / 2, 0]);
    }
    const zf = L / 2 + 0.16;                                                                          // el frente
    a.pon(redonda(1.55, 0.95, 0.08, 0.06), this.vid, c.vidrio, [0, 2.3, zf]);
    a.pon(new THREE.PlaneGeometry(1.15, 0.24), 'texluz:destino', 0xffffff, [0, 2.95, zf + 0.012]);
    for (const s of [-1, 1]) {
      a.pon(CILINDRO, 'luz', 0xfff4d6, [s * 0.62, 0.98, zf + 0.01], [Math.PI / 2, 0, 0], [0.26, 0.06, 0.26]);
      a.pon(redonda(0.18, 0.1, 0.04, 0.02), 'luz', 0xff3030, [s * 0.62, 0.72, zf + 0.01]);
    }
    a.pon(redonda(1.85, 0.3, 0.26, 0.1), 'plano', c.bajo, [0, 0.5, zf]);
    for (const za of [-2.8, 2.8]) a.pon(redonda(1.0, 0.26, 1.7, 0.1), 'plano', c.techoTren, [0, 3.32, za]);
    const g = a.hecho();
    if (this.neon) for (const s of [-1, 1]) g.add(sprite(0xffffff, 1.8, [s * 0.62, 0.98, zf + 0.15]));
    return g;
  }
  /** La rampa: una cuña de rejilla con bordes de cinta de peligro. Su origen es el pie (z=0) y sube hacia −z. */
  rampa() {
    const largo = MOTOR.LARGO_RAMPA, alto = TECHO, a = new Arma(this);
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(largo, 0); s.lineTo(largo, alto); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-0.9, 0, 0);
    a.pon(geo, this.neon ? 'plano' : 'texmetal:rejilla', this.neon ? this.c.rejilla : this.c.rampa, [0, 0, 0], null, 1, 0x22e5ff);
    const ang = Math.atan2(alto, largo), lg = Math.hypot(largo, alto);
    for (const sx of [-0.84, 0.84]) a.pon(CAJA, this.neon ? 'texluz:chevron' : 'tex:chevron', 0xffffff, [sx, alto / 2 + 0.04, -largo / 2], [ang, 0, 0], [0.14, 0.05, lg]);
    return a.hecho();
  }
  /** La barrera baja (se salta): un caballete a la altura de la cintura. */
  barreraBaja() {
    const c = this.c, a = new Arma(this);
    a.pon(CAJA, this.neon ? 'texluz:rayasRB' : 'tex:rayasRB', 0xffffff, [0, 0.72, 0], null, [1.9, 0.3, 0.08], c.barrera);
    for (const s of [-1, 1]) for (const k of [-1, 1]) a.pon(CAJA, 'plano', 0xe8e8e8, [s * 0.82, 0.42, k * 0.13], [k * 0.28, 0, 0], [0.07, 0.86, 0.07]);
    a.pon(CILINDRO_CHICO, 'plano', 0x222222, [-0.6, 0.91, 0], null, [0.13, 0.08, 0.13]);
    a.pon(ESFERA, 'luz', c.ambar, [-0.6, 0.98, 0], null, 0.14);
    const g = a.hecho();
    if (this.neon) g.add(sprite(c.ambar, 1.2, [-0.6, 0.98, 0.05]));
    return g;
  }
  /** La barrera alta (se pasa rodando): un letrero de la cintura a la cabeza, con una flecha hacia abajo. */
  barreraAlta() {
    const c = this.c, a = new Arma(this);
    for (const s of [-1, 1]) a.pon(CILINDRO, this.neon ? 'texluz:rayasNA' : 'tex:rayasNA', 0xffffff, [s * 0.9, 1.125, 0], null, [0.14, 2.25, 0.14], 0xffe14d);
    a.pon(redonda(1.95, 0.9, 0.1, 0.04), this.neon ? 'texluz:rayasRB8' : 'tex:rayasRB8', 0xffffff, [0, 1.32, 0], null, 1, c.barrera);
    a.pon(new THREE.CircleGeometry(0.34, 32), this.neon ? 'texluz:flecha' : 'tex:flecha', 0xffffff, [0, 1.32, 0.056]);
    for (const s of [-1, 1]) a.pon(ESFERA, 'luz', c.ambar, [s * 0.9, 2.32, 0], null, 0.18);
    const g = a.hecho();
    if (this.neon) for (const s of [-1, 1]) g.add(sprite(c.ambar, 1.4, [s * 0.9, 2.32, 0.05]));
    return g;
  }
  /** Los poderes que flotan: cada uno con su forma y un aro de luz debajo. */
  poder(clase) {
    const c = this.c, a = new Arma(this), g0 = new THREE.Group();
    const anillo = { iman: 0xff5a5a, mochila: 0xffb02e, zapatillas: 0x6aff8a, doble: 0x5fb0ff, caja: 0xffd23f }[clase];
    if (clase === 'iman') {
      a.pon(new THREE.TorusGeometry(0.32, 0.12, 12, 24, Math.PI), 'pintura', c.iman, [0, 0.1, 0]);
      for (const s of [-1, 1]) { a.pon(CILINDRO, 'pintura', c.iman, [s * 0.32, -0.05, 0], null, [0.24, 0.3, 0.24]); a.pon(CILINDRO, 'metal', c.cromo, [s * 0.32, -0.3, 0], null, [0.25, 0.2, 0.25]); }
    } else if (clase === 'mochila') {
      for (const s of [-1, 1]) { a.pon(CILINDRO, 'pintura', 0xe8463b, [s * 0.16, 0, 0], null, [0.24, 0.6, 0.24]); a.pon(new THREE.ConeGeometry(0.12, 0.2, 14), 'pintura', 0xffd23f, [s * 0.16, 0.4, 0]); a.pon(new THREE.ConeGeometry(0.1, 0.18, 12), 'luz', 0xffa424, [s * 0.16, -0.38, 0], [Math.PI, 0, 0]); }
      a.pon(redonda(0.5, 0.36, 0.12, 0.04), 'plano', 0x2a2d33, [0, 0.05, -0.14]);
    } else if (clase === 'zapatillas') {
      a.pon(redonda(0.34, 0.24, 0.6, 0.1), 'pintura', 0x3ad16a, [0, 0, 0]);
      a.pon(redonda(0.36, 0.08, 0.64, 0.03), 'plano', 0xffffff, [0, -0.14, 0]);
      for (const s of [-1, 1]) a.pon(CAJA, 'plano', 0xffffff, [s * 0.24, 0.12, 0.12], [0.3, 0, s * 0.6], [0.04, 0.3, 0.4]);
    } else if (clase === 'doble') {
      a.pon(CILINDRO, 'pintura', 0x1d4fd6, [0, 0, 0], [Math.PI / 2, 0, 0], [0.8, 0.12, 0.8]);
      for (const s of [-1, 1]) a.pon(new THREE.CircleGeometry(0.36, 32), 'texluz:doble', 0xffffff, [0, 0, s * 0.065], [0, s > 0 ? 0 : Math.PI, 0]);
      a.pon(new THREE.TorusGeometry(0.4, 0.04, 8, 32), 'metal', c.oro, [0, 0, 0]);
    } else {
      a.pon(CAJA, this.neon ? 'texluz:caja' : 'tex:caja', 0xffffff, [0, 0, 0], null, 0.62);
    }
    const cuerpo = a.hecho(false);
    cuerpo.name = 'cuerpo';
    g0.add(cuerpo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 40), this.mat('luz'));
    aro.geometry = prepara(aro.geometry, anillo); aro.rotation.x = Math.PI / 2; aro.position.y = -0.9;
    g0.add(aro);
    if (this.neon) g0.add(sprite(anillo, 2.4, [0, 0, 0], 0.7));
    return g0;
  }
  /** La estrella (+1 al multiplicador de la carrera). */
  estrella() {
    const a = new Arma(this), s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.46, t = Math.PI / 2 + i * Math.PI / 5; (i ? s.lineTo : s.moveTo).call(s, Math.cos(t) * r, Math.sin(t) * r); }
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    geo.translate(0, 0, -0.07);
    a.pon(geo, this.neon ? 'luz' : 'metal', this.c.oro);
    const g = new THREE.Group(), cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g.add(cuerpo);
    if (this.neon) g.add(sprite(this.c.oro, 2, [0, 0, 0], 0.8));
    return g;
  }
  /** El boleto dorado (un trozo de la historia). */
  boleto() {
    const a = new Arma(this);
    a.pon(CAJA, 'texluz:boleto', 0xffffff, [0, 0, 0], null, [0.9, 0.45, 0.03]);
    const g = new THREE.Group(), cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g.add(cuerpo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 40), this.mat('luz'));
    aro.geometry = prepara(aro.geometry, 0xffe066); aro.rotation.x = Math.PI / 2; aro.position.y = -0.9; g.add(aro);
    if (this.neon) g.add(sprite(0xffe066, 3, [0, 0, 0], 0.9));
    return g;
  }
  /** Un edificio para el costado `lado` (−1 izquierda, 1 derecha). Su origen es el centro de la base. */
  edificio(lado) {
    const c = this.c, az = this.az, a = new Arma(this);
    const pisos = this.neon ? 3 + Math.floor(az() * 5) : 2 + Math.floor(az() * 4);
    const w = 5 + az() * 3, d = 6 + az() * 4.5, PISO = 3, h = pisos * PISO + 0.6;
    const fx = -lado * (w / 2);                                                // la fachada que mira a la vía
    const ladrillo = !this.neon && !this.pixel && az() < c.probLadrillo;
    const cuerpo = uvMundo(new THREE.BoxGeometry(w, h, d), ladrillo ? 2.4 : 6, h / 2);
    a.pon(cuerpo, ladrillo ? 'tex:ladrillo' : this.pixel || this.neon ? 'plano' : 'tex:ruido', ladrillo ? 0xffffff : c.edificios[Math.floor(az() * c.edificios.length)], [0, h / 2, 0], null, 1,
      this.neon ? c.edificios[Math.floor(az() * c.edificios.length)] : null);
    a.pon(CAJA, this.neon ? 'luz' : 'plano', c.cornisa, [0, h + 0.05, 0], null, [w + 0.3, 0.35, d + 0.3]);
    a.pon(CAJA, 'plano', c.cornisa, [0, PISO + 0.35, 0], null, [w + 0.12, 0.25, d + 0.12]);
    // planta baja: vitrina, marco, puerta, toldo y letrero
    a.pon(CAJA, this.juguete ? 'vidrio' : 'luz', c.vitrina, [fx, 1.3, -d * 0.1], null, [0.08, 1.9, d * 0.5]);
    a.pon(CAJA, 'plano', c.marco, [fx - lado * 0.02, 2.3, -d * 0.1], null, [0.1, 0.12, d * 0.5 + 0.2]);
    a.pon(CAJA, this.neon ? 'luz' : 'plano', this.neon ? 0x22e5ff : 0x5a3b2c, [fx, 1.1, d * 0.32], null, [0.1, 2.2, 1.0]);
    const toldo = uvMundo(new THREE.BoxGeometry(1.1, 0.08, d * 0.62), 1);
    a.pon(toldo, (this.neon ? 'texluz:toldo|' : 'tex:toldo|') + Math.floor(az() * c.toldos.length), 0xffffff, [fx - lado * 0.5, 2.85, -d * 0.1], [0, 0, lado * 0.32]);
    const texto = this.pal.carteles[Math.floor(az() * this.pal.carteles.length)];
    a.pon(new THREE.PlaneGeometry(Math.min(d * 0.55, 4), 0.75), (this.neon ? 'texluz:cartel|' : 'tex:cartel|') + texto, 0xffffff, [fx - lado * 0.06, 3.55, -d * 0.1], [0, -lado * Math.PI / 2, 0]);
    // ventanas de los pisos de arriba: marco, vidrio y alféizar
    const cols = Math.max(2, Math.floor(d / 2.1));
    for (let f = 1; f < pisos; f++) for (let k = 0; k < cols; k++) {
      const y = f * PISO + 1.55, z = -d / 2 + (k + 0.5) * d / cols;
      a.pon(CAJA, 'plano', c.marco, [fx, y, z], null, [0.1, 1.55, 1.08]);
      a.pon(CAJA, this.vid, this.neon ? c.ventanas[Math.floor(az() * c.ventanas.length)] : c.vidrioEd, [fx, y, z], null, [0.14, 1.3, 0.84]);
      a.pon(CAJA, 'plano', c.marco, [fx - lado * 0.1, y - 0.82, z], null, [0.26, 0.08, 1.2]);
    }
    if (!this.neon && az() < 0.4 && pisos > 2) for (let f = 2; f < pisos; f++) for (let k = 0; k < cols; k += 2) {   // balcones
      const y = f * PISO + 0.75, z = -d / 2 + (k + 0.5) * d / cols;
      a.pon(CAJA, 'plano', c.cornisa, [fx - lado * 0.45, y, z], null, [0.9, 0.12, 1.5]);
      a.pon(CAJA, 'plano', c.cornisa, [fx - lado * 0.88, y + 0.42, z], null, [0.06, 0.75, 1.5]);
    }
    if (!this.neon) {                                                         // el techo
      const tx = (az() - .5) * w * 0.4, tz = (az() - .5) * d * 0.4;
      if (az() < 0.45) {
        a.pon(CILINDRO, 'plano', 0x9a7a5c, [tx, h + 1.5, tz], null, [1.6, 1.4, 1.6]);
        a.pon(new THREE.ConeGeometry(0.88, 0.5, 14), 'plano', 0x7a5c44, [tx, h + 2.45, tz]);
        for (const [p, q] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) a.pon(CAJA, 'metal', 0x55505a, [tx + p, h + 0.6, tz + q], null, [0.08, 0.8, 0.08]);
      } else a.pon(redonda(1.1, 0.6, 0.8, 0.08), 'metal', 0xc9ccd2, [tx, h + 0.5, tz]);
    }
    const g = a.hecho();
    g.userData.largo = d / 2; g.userData.ancho = w;
    return g;
  }
  /** Un árbol low-poly: tronco y tres copas facetadas. */
  arbol() {
    const c = this.c, az = this.az, a = new Arma(this);
    a.pon(new THREE.CylinderGeometry(0.11, 0.17, 1.7, 8), 'plano', c.tronco, [0, 0.85, 0]);
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.IcosahedronGeometry(0.85 + az() * 0.3, this.pixel ? 0 : 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const f = 0.96 + az() * 0.08; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); }
      geo.computeVertexNormals();
      a.pon(geo, 'plano', c.arboles[Math.floor(az() * c.arboles.length)], [(az() - .5) * 0.9, 2.2 + az() * 0.9, (az() - .5) * 0.9]);
    }
    const g = a.hecho();
    const e = 0.9 + az() * 0.35; g.scale.setScalar(e);
    g.userData.largo = 1.3 * e;
    return g;
  }
  /** Un farol de la vereda, con el brazo hacia la vía. */
  farol(lado) {
    const c = this.c, a = new Arma(this);
    a.pon(CILINDRO_CHICO, 'metal', c.poste, [0, 2.3, 0], null, [0.14, 4.6, 0.14], 0xff2bd6);
    a.pon(CAJA, 'metal', c.poste, [-lado * 0.42, 4.6, 0], null, [0.9, 0.08, 0.1]);
    a.pon(redonda(0.5, 0.16, 0.3, 0.06), 'plano', c.poste, [-lado * 0.82, 4.52, 0]);
    a.pon(CAJA, 'luz', c.farol, [-lado * 0.82, 4.43, 0], null, [0.4, 0.04, 0.22]);
    const g = a.hecho();
    if (this.neon) g.add(sprite(c.farol, 3.2, [-lado * 0.82, 4.35, 0], 0.9));
    return g;
  }
  /** Un poste de catenaria, con su brazo sobre la vía. */
  poste(lado) {
    const c = this.c, a = new Arma(this);
    a.pon(CAJA, 'metal', c.catenaria, [0, 3.15, 0], null, [0.2, 6.3, 0.2], c.catenaria);
    a.pon(CAJA, 'metal', c.catenaria, [-lado * 1.72, 5.95, 0], null, [3.45, 0.12, 0.12], c.catenaria);
    return a.hecho();
  }
  /** Un grafiti pintado en el muro de la vía. */
  grafiti(lado) {
    const a = new Arma(this);
    a.pon(new THREE.PlaneGeometry(3.4, 1.0), (this.neon ? 'texluz:graf|' : 'tex:graf|') + Math.floor(this.az() * 9), 0xffffff, [0, 0, 0], [0, -lado * Math.PI / 2, 0]);
    const g = a.hecho(false);
    return g;
  }
  /** La vía, los muros y las veredas: tiras largas que no se mueven (se desplaza su textura). */
  armaVia() {
    const c = this.c, g = new THREE.Group(), LARGO = 300, ZC = -VISTA / 2 + 10;
    const texturas = [];                                                      // las que hay que desplazar, con su tamaño de baldosa
    const tira = (geo, clave, col, pos, tile, eje) => {
      const a = new Arma(this); a.pon(geo, clave, col, pos);
      const m = a.hecho(); g.add(m);
      const mat = m.children[0].material;
      if (tile && mat.map && !mat.userData.desplaza) {                     // cada material se desplaza una sola vez (lo comparten varias tiras)
        mat.map = mat.map.clone(); mat.map.needsUpdate = true; mat.userData.desplaza = true; texturas.push([mat.map, tile, eje]);
      }
      return m;
    };
    if (this.neon) {
      this.espejoPos = [0, 0, ZC];                                            // el piso de espejo lo pone el mundo (depende de la calidad)
      const pts = [];
      for (let x = -60; x <= 60; x += 3) pts.push(x, 0.01, 30, x, 0.01, -260);
      for (let z = 30; z >= -260; z -= 3) pts.push(-60, 0.01, z, 60, 0.01, z);
      const lg = new LineSegmentsGeometry(); lg.setPositions(pts);
      const lm = new LineMaterial({ color: this.c.rejilla, linewidth: 1.2, worldUnits: false, transparent: true, opacity: 0.5 }); lm.resolution.copy(this.mundo.resolucion);
      this.rejilla = new LineSegments2(lg, lm); this.rejilla.frustumCulled = false; g.add(this.rejilla);
      this.lineasMat.set('rejilla', lm);
    } else {
      tira(uvMundo(new THREE.BoxGeometry(240, 0.02, LARGO), 2), this.pixel ? 'plano' : 'tex:gravaSuelo', this.pixel ? c.tierra : 0xffffff, [0, -0.01, ZC], 2, 'v');
      for (const x of CARRILES) tira(uvMundo(new THREE.BoxGeometry(2.0, SUELO, LARGO), 2), this.pixel ? 'plano' : 'tex:grava', this.pixel ? c.grava : 0xffffff, [x, SUELO / 2, ZC], 2, 'v');
    }
    // durmientes: una sola InstancedMesh que se corre de a un paso
    const paso = 0.72, n = Math.ceil(LARGO / paso);
    const geoT = prepara(CAJA, c.traviesa, matriz([0, 0, 0], null, [1.9, 0.09, 0.24]));
    const trav = new THREE.InstancedMesh(geoT, this.neon ? this.mat('luz') : this.mat('plano'), n * 3);
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let i = 0;
    for (const x of CARRILES) for (let k = 0; k < n; k++) {
      m4.makeTranslation(x, this.neon ? 0.05 : SUELO + 0.045, 30 - k * paso); trav.setMatrixAt(i, m4);
      trav.setColorAt(i, col.setScalar(this.neon ? 0.35 : 0.88 + this.az() * 0.12)); i++;
    }
    trav.receiveShadow = true; trav.frustumCulled = false;
    this.durmientes = trav; this.pasoDurmientes = paso; g.add(trav);
    // rieles
    const yR = this.neon ? 0.13 : SUELO + 0.13;
    for (const x of CARRILES) for (const s of [-0.6, 0.6]) {
      tira(CAJA.clone().scale(0.075, 0.07, LARGO), this.neon ? 'luz' : 'metal', c.riel, [x + s, yR, ZC]);
      if (!this.neon) tira(CAJA.clone().scale(0.035, 0.07, LARGO), 'metal', 0x6a6e75, [x + s, yR - 0.06, ZC]);
    }
    // muros, bordillos y veredas
    for (const lado of [-1, 1]) {
      const xm = lado * 3.72;
      tira(uvMundo(new THREE.BoxGeometry(0.3, 1.15, LARGO), 4, 0), this.juguete ? 'tex:muro' : 'plano', this.juguete ? c.muro : c.muro, [xm, 0.575, ZC], 4, 'u');
      tira(CAJA.clone().scale(0.42, 0.12, LARGO), this.neon ? 'luz' : 'plano', this.neon ? new THREE.Color(c.bordillo).multiplyScalar(0.45).getHex() : c.bordillo, [xm, 1.21, ZC]);
      tira(uvMundo(new THREE.BoxGeometry(2.6, 0.14, LARGO), 3), this.juguete ? 'tex:acera' : 'plano', c.acera, [lado * 5.17, 0.07, ZC], 3, 'v');
    }
    // cables de la catenaria (no en pixel: se verían como ruido)
    if (!this.pixel) for (const x of CARRILES) {
      if (this.neon) {
        const lg = new LineSegmentsGeometry(); lg.setPositions([x, 5.4, 30, x, 5.4, -260]);
        const lm = new LineMaterial({ color: 0xff7ae0, linewidth: 1.1, worldUnits: false }); lm.resolution.copy(this.mundo.resolucion);
        const l = new LineSegments2(lg, lm); l.frustumCulled = false; g.add(l); this.lineasMat.set('cable' + x, lm);
      } else tira(CILINDRO_CHICO.clone().rotateX(Math.PI / 2).scale(0.028, 0.028, LARGO), 'metal', 0x2a2f36, [x, 5.4, ZC]);
    }
    g.userData.texturas = texturas;
    for (const m of g.children) m.frustumCulled = false;
    return g;
  }
  /** Mueve las texturas de la vía para que parezca que avanza (D = metros recorridos). */
  desplaza(D) {
    if (!this.via) return;
    for (const [t, tile, eje] of this.via.userData.texturas) { if (eje === 'v') t.offset.y = -D / tile; else t.offset.x = -D / tile; }
    this.durmientes.position.z = D % this.pasoDurmientes;
    if (this.rejilla) this.rejilla.position.z = D % 3;
  }
  /** El cielo: un domo con degradado y brillo del sol, más nubes, sol pixel, sol synthwave o estrellas. */
  armaCielo() {
    const pal = this.pal, g = new THREE.Group();
    const sd = pal.sol ? new THREE.Vector3(...pal.sol[2]).normalize() : new THREE.Vector3(0, 0.05, -1).normalize();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { arriba: { value: color(pal.cielo.arriba) }, horizonte: { value: color(pal.cielo.horizonte) }, solCol: { value: color(pal.cielo.sol) }, solDir: { value: sd }, pasos: { value: this.pixel ? 7 : 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vDir = normalize(w.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 arriba, horizonte, solCol, solDir; uniform float pasos; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0); float t = pow(h, 0.55);
          if (pasos > 0.0) { float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453); t = floor(t * pasos + d * 0.6) / pasos; }
          vec3 c = mix(horizonte, arriba, t);
          float s = max(dot(vDir, solDir), 0.0);
          c += solCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    const domo = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), mat); domo.renderOrder = -2; g.add(domo);
    const az = azarDe(77);
    if (pal.extras.nubes) {                                                   // nubes esponjosas
      const mn = new THREE.MeshStandardMaterial({ color: pal.c.nube, roughness: 1, emissive: pal.c.nube, emissiveIntensity: 0.3, fog: false });
      const geoN = this.pixel ? new THREE.IcosahedronGeometry(1, 0) : new THREE.SphereGeometry(1, 14, 10);
      for (let i = 0; i < 7; i++) {
        const n = new THREE.Group(); n.position.set(-36 + i * 12 + az() * 6, 15 + az() * 7, -120 - az() * 25);
        for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(geoN, mn); s.position.set((k - 3) * 1.3, Math.sin(k * 1.3) * 0.5 + (k % 3 === 0 ? 0.8 : 0), az()); s.scale.setScalar(1.3 + az() * 1.1); n.add(s); }
        g.add(n);
      }
    }
    if (pal.extras.disco) { const d = new THREE.Mesh(new THREE.CircleGeometry(11, 24), new THREE.MeshBasicMaterial({ color: pal.cielo.sol, fog: false })); d.position.set(-8, 7, -170); g.add(d); }
    if (pal.extras.synth) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshBasicMaterial({ map: aTextura(TEX.solSynth(...pal.extras.synth), { repetir: false }), transparent: true, fog: false, depthWrite: false }));
      s.position.set(0, 7, -165); s.renderOrder = -1; g.add(s);
    }
    if (pal.extras.estrellas) {
      const est = [];
      for (let i = 0; i < 380; i++) est.push((az() - .5) * 360, 8 + az() * 110, -175);
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(est, 3));
      g.add(new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
    }
    for (const m of g.children) m.frustumCulled = false;
    return g;
  }
  /** Las monedas: una InstancedMesh para todas. */
  armaMonedas() {
    const geo = new THREE.LatheGeometry([
      new THREE.Vector2(0, -0.03), new THREE.Vector2(0.21, -0.03), new THREE.Vector2(0.245, -0.048), new THREE.Vector2(0.3, -0.042),
      new THREE.Vector2(0.31, 0), new THREE.Vector2(0.3, 0.042), new THREE.Vector2(0.245, 0.048), new THREE.Vector2(0.21, 0.03), new THREE.Vector2(0, 0.03)
    ], 28).rotateX(Math.PI / 2);
    const mat = this.neon ? new THREE.MeshBasicMaterial({ color: this.c.oro })
      : this.pixel ? new THREE.MeshToonMaterial({ color: this.c.oro, gradientMap: gradToon() })
        : new THREE.MeshStandardMaterial({ color: this.c.oro, roughness: 0.22, metalness: 1, emissive: 0x3a2500, envMapIntensity: 1.2 });
    const im = new THREE.InstancedMesh(geo, mat, 400);
    im.count = 0; im.castShadow = true; im.frustumCulled = false;
    return im;
  }
  /** Libera todo lo de este kit en la GPU (cuando ya no se usará). */
  libera() {
    for (const m of this.mats.values()) m.dispose();
    for (const t of this.texs.values()) if (t) t.dispose();
  }
}

/** El perfil de un vagón extruido a lo largo (se cachea por largo). */
const cacheTren = new Map();
function geoTren(L) {
  if (cacheTren.has(L)) return cacheTren.get(L);
  const s = new THREE.Shape();
  s.moveTo(-0.95, 0.38); s.lineTo(0.95, 0.38); s.lineTo(0.95, 2.72);
  s.quadraticCurveTo(0.95, 3.15, 0.55, 3.15); s.lineTo(-0.55, 3.15);
  s.quadraticCurveTo(-0.95, 3.15, -0.95, 2.72); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.06, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -L / 2);
  cacheTren.set(L, g);
  return g;
}
/** Una mancha de luz (sprite) para el neón. */
function sprite(col, escala, pos, opacidad = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacidad }));
  s.scale.setScalar(escala); s.position.set(pos[0], pos[1], pos[2]);
  return s;
}

/* ===================================================================
   5. EL CORREDOR, EL INSPECTOR Y SU PERRO
   =================================================================== */

/** Arma el corredor articulado con los colores de su aspecto.
    Devuelve las articulaciones para poder posarlo en cada cuadro. */
function armaCorredor(kit, asp) {
  const piel = 0xf1c19c, pelo = 0x3b2a20;
  const raiz = new THREE.Group(), cuerpo = new THREE.Group(); raiz.add(cuerpo);
  const parte = (padre, construir, pos = [0, 0, 0]) => {                   // una pieza rígida (fundida) colgada de una articulación
    const a = new Arma(kit); construir(a); const m = a.hecho(); m.position.set(pos[0], pos[1], pos[2]); padre.add(m); return m;
  };
  const art = (padre, pos) => { const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); padre.add(g); return g; };
  const pelvis = art(cuerpo, [0, 0.78, 0]);
  parte(pelvis, a => a.pon(redonda(0.32, 0.18, 0.21, 0.07), 'personaje', asp.jeans, [0, 0.02, 0]));
  const piernas = [-1, 1].map(s => {
    const cadera = art(pelvis, [s * 0.095, 0, 0]);
    parte(cadera, a => a.pon(new THREE.CapsuleGeometry(0.088, 0.26, 4, 10), 'personaje', asp.jeans, [0, -0.2, 0]));
    const rodilla = art(cadera, [0, -0.4, 0]);
    parte(rodilla, a => a.pon(new THREE.CapsuleGeometry(0.076, 0.25, 4, 10), 'personaje', asp.jeans, [0, -0.19, 0]));
    const tobillo = art(rodilla, [0, -0.4, 0]);
    parte(tobillo, a => { a.pon(redonda(0.15, 0.11, 0.3, 0.05), 'personaje', 0xffffff, [0, -0.02, -0.06]); a.pon(redonda(0.156, 0.045, 0.312, 0.02), 'personaje', asp.suela, [0, -0.076, -0.06]); });
    const brilloZap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), kit.mat('luz'));
    brilloZap.geometry = prepara(brilloZap.geometry, 0x6aff8a); brilloZap.rotation.x = Math.PI / 2; brilloZap.position.set(0, -0.05, -0.06); brilloZap.visible = false; tobillo.add(brilloZap);
    return { cadera, rodilla, tobillo, brilloZap };
  });
  const torso = art(pelvis, [0, 0.1, 0]);
  parte(torso, a => {
    a.pon(redonda(0.44, 0.52, 0.27, 0.1, 4), 'personaje', asp.sudadera, [0, 0.3, 0]);
    a.pon(redonda(0.46, 0.08, 0.29, 0.035), 'personaje', new THREE.Color(asp.sudadera).multiplyScalar(0.82).getHex(), [0, 0.05, 0]);
    a.pon(new THREE.TorusGeometry(0.13, 0.055, 8, 18), 'personaje', asp.sudadera, [0, 0.58, 0.06], [Math.PI / 2, 0, 0]);
    a.pon(CILINDRO_CHICO, 'personaje', piel, [0, 0.62, 0], null, [0.15, 0.12, 0.15]);
    a.pon(redonda(0.34, 0.38, 0.15, 0.06, 4), 'personaje', asp.mochila, [0, 0.3, 0.2]);
    a.pon(redonda(0.35, 0.13, 0.17, 0.05), 'personaje', new THREE.Color(asp.mochila).multiplyScalar(0.8).getHex(), [0, 0.45, 0.21]);
    a.pon(redonda(0.22, 0.14, 0.06, 0.03), 'personaje', asp.mochila2, [0, 0.18, 0.29]);
    for (const s of [-1, 1]) a.pon(redonda(0.05, 0.42, 0.05, 0.02), 'personaje', 0x22262c, [s * 0.12, 0.33, 0.14]);
    a.pon(ESFERA, 'personaje', asp.mochila2, [0.13, 0.06, 0.29], null, 0.07);
  });
  // la mochila cohete (aparece con el poder) y sus llamas
  const cohete = new THREE.Group(); cohete.position.set(0, 0.32, 0.3); cohete.visible = false; torso.add(cohete);
  parte(cohete, a => { for (const s of [-1, 1]) { a.pon(CILINDRO, 'pintura', 0xe8463b, [s * 0.13, 0, 0.04], null, [0.17, 0.46, 0.17]); a.pon(new THREE.ConeGeometry(0.085, 0.14, 12), 'pintura', 0xffd23f, [s * 0.13, 0.3, 0.04]); } });
  const llamas = parte(cohete, a => { for (const s of [-1, 1]) a.pon(new THREE.ConeGeometry(0.08, 0.5, 10), 'luz', 0xffa424, [s * 0.13, -0.5, 0.04], [Math.PI, 0, 0]); });
  const cab = art(torso, [0, 0.8, 0]); cab.rotation.x = 0.12;
  parte(cab, a => {
    a.pon(ESFERA, 'personaje', piel, [0, 0, 0], null, [0.4, 0.42, 0.4]);
    for (const s of [-1, 1]) a.pon(ESFERA, 'personaje', piel, [s * 0.198, -0.01, 0.01], null, [0.05, 0.1, 0.08]);
    a.pon(new THREE.SphereGeometry(0.208, 22, 14, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.42), 'personaje', pelo, [0, 0, 0.01]);
    a.pon(new THREE.SphereGeometry(0.218, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 'personaje', asp.gorra, [0, 0.03, 0]);
    a.pon(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), 'personaje', asp.gorra, [0, 0.04, 0.13], [-0.14, 0, 0]);
    a.pon(ESFERA, 'personaje', asp.gorra, [0, 0.25, 0], null, 0.05);
  });
  const brazos = [-1, 1].map(s => {
    const hombro = art(torso, [s * 0.27, 0.5, 0]);
    parte(hombro, a => a.pon(new THREE.CapsuleGeometry(0.068, 0.2, 4, 10), 'personaje', asp.sudadera, [0, -0.15, 0]));
    const codo = art(hombro, [0, -0.3, 0]);
    parte(codo, a => { a.pon(new THREE.CapsuleGeometry(0.06, 0.18, 4, 10), 'personaje', asp.sudadera, [0, -0.13, 0]); a.pon(ESFERA, 'personaje', piel, [0, -0.31, 0], null, 0.13); });
    return { hombro, codo, lado: s };
  });
  // la patineta (aparece con el poder) y el aro del imán
  const tabla = new THREE.Group(); tabla.visible = false; raiz.add(tabla);
  parte(tabla, a => { a.pon(redonda(0.62, 0.06, 1.5, 0.03), 'pintura', 0x7b2ff7, [0, 0.12, 0]); a.pon(redonda(0.58, 0.02, 1.4, 0.01), 'luz', 0x00f5d4, [0, 0.085, 0]); });
  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 40), kit.mat('luz'));
  aura.geometry = prepara(aura.geometry, 0xff5a5a); aura.rotation.x = Math.PI / 2; aura.position.y = 1.0; aura.visible = false; raiz.add(aura);
  // la sombra redonda bajo los pies (en calidad baja, que no tiene sombras de verdad)
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.01;
  raiz.scale.setScalar(0.95);
  return { raiz, cuerpo, pelvis, torso, cab, piernas, brazos, cohete, llamas, tabla, aura, sombra };
}

/** Pone la pose del corredor según lo que está haciendo.
    p = {modo: 'correr'|'saltar'|'rodar'|'volar'|'tropezar'|'caer'|'quieto', fase, t, vy, ladeo} */
function posa(r, p) {
  const s = Math.sin(p.fase || 0), c = Math.cos(p.fase || 0);
  const [pi, pd] = r.piernas, [bi, bd] = r.brazos;
  r.cuerpo.rotation.set(-0.14, 0.08 * s, (p.ladeo || 0));
  r.cuerpo.position.y = 0;
  r.pelvis.position.y = 0.78;
  bi.hombro.rotation.z = -0.15; bd.hombro.rotation.z = 0.15;
  if (p.modo === 'correr' || p.modo === 'quieto') {
    const k = p.modo === 'quieto' ? 0.15 : 1;
    pi.cadera.rotation.x = 0.75 * s * k; pd.cadera.rotation.x = -0.75 * s * k;
    pi.rodilla.rotation.x = -(0.25 + 0.9 * Math.max(0, -s)) * k; pd.rodilla.rotation.x = -(0.25 + 0.9 * Math.max(0, s)) * k;
    pi.tobillo.rotation.x = 0.2 * s; pd.tobillo.rotation.x = -0.2 * s;
    bi.hombro.rotation.x = -0.8 * s * k; bd.hombro.rotation.x = 0.8 * s * k;
    bi.codo.rotation.x = 1.1 + 0.2 * c; bd.codo.rotation.x = 1.1 - 0.2 * c;
    r.cuerpo.position.y = Math.abs(c) * 0.06 * k;                             // el rebote de cada zancada
  } else if (p.modo === 'saltar') {
    const sube = (p.vy || 0) > 0;
    pi.cadera.rotation.x = sube ? 0.9 : 0.5; pd.cadera.rotation.x = sube ? -0.3 : 0.2;
    pi.rodilla.rotation.x = sube ? -1.2 : -0.5; pd.rodilla.rotation.x = sube ? -0.6 : -0.9;
    bi.hombro.rotation.x = -0.4; bd.hombro.rotation.x = 0.4; bi.hombro.rotation.z = -1.4; bd.hombro.rotation.z = 1.4;
    bi.codo.rotation.x = 0.4; bd.codo.rotation.x = 0.4;
  } else if (p.modo === 'rodar') {
    const giro = (p.t || 0) * Math.PI * 2 / 0.62;                              // una vuelta completa en lo que dura la rodada
    r.pelvis.position.y = 0.42;
    r.cuerpo.rotation.x = -giro;
    r.cuerpo.position.y = 0.05;
    for (const pp of [pi, pd]) { pp.cadera.rotation.x = 1.9; pp.rodilla.rotation.x = -2.3; pp.tobillo.rotation.x = 0.4; }
    for (const b of [bi, bd]) { b.hombro.rotation.x = 1.6; b.codo.rotation.x = 1.6; }
  } else if (p.modo === 'volar') {
    pi.cadera.rotation.x = 0.2; pd.cadera.rotation.x = -0.1; pi.rodilla.rotation.x = -0.4; pd.rodilla.rotation.x = -0.6;
    bi.hombro.rotation.x = 0.3 + 0.1 * s; bd.hombro.rotation.x = 0.3 - 0.1 * s; bi.hombro.rotation.z = -0.6; bd.hombro.rotation.z = 0.6;
    bi.codo.rotation.x = 0.3; bd.codo.rotation.x = 0.3;
    r.cuerpo.rotation.x = -0.35;
  } else if (p.modo === 'tropezar') {
    const k = Math.sin(Math.min(1, (p.t || 0) / 0.4) * Math.PI);
    r.cuerpo.rotation.x = -0.14 - 0.5 * k; r.cuerpo.rotation.z = (p.ladeo || 0) + 0.3 * k;
    bi.hombro.rotation.x = -1.4 * k; bd.hombro.rotation.x = -1.4 * k; bi.hombro.rotation.z = -1.2 * k; bd.hombro.rotation.z = 1.2 * k;
    pi.cadera.rotation.x = 0.6 * s; pd.cadera.rotation.x = -0.6 * s;
  } else if (p.modo === 'caer') {
    const k = Math.min(1, (p.t || 0) / 0.5);
    r.cuerpo.rotation.x = 0.3 + 1.2 * k;                                       // cae de espaldas, hacia la cámara
    r.cuerpo.position.y = -0.55 * k;
    bi.hombro.rotation.x = -2.2 * k; bd.hombro.rotation.x = -2.2 * k; bi.hombro.rotation.z = -1 * k; bd.hombro.rotation.z = 1 * k;
    pi.cadera.rotation.x = -0.9 * k; pd.cadera.rotation.x = -0.4 * k; pi.rodilla.rotation.x = -0.3; pd.rodilla.rotation.x = -0.6;
  }
}

/** El inspector Don Ramón (uniforme y gorra con visera) y su perro Tornillo. */
function armaPerseguidor(kit) {
  const r = armaCorredor(kit, { sudadera: 0x1f3a5f, gorra: 0x1f3a5f, jeans: 0x14213d, mochila: 0x1f3a5f, mochila2: 0xfca311, suela: 0x111111 });
  // al inspector le sobra la mochila; la tapamos con un abrigo largo y le damos bigote y visera adelante
  const extra = new Arma(kit);
  extra.pon(redonda(0.5, 0.75, 0.34, 0.1), 'personaje', 0x1f3a5f, [0, 0.22, 0.02]);
  extra.pon(CAJA, 'personaje', 0xfca311, [0, 0.42, -0.15], null, [0.1, 0.1, 0.02]);
  const abrigo = extra.hecho(); r.torso.add(abrigo);
  const v = new Arma(kit); v.pon(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20, 1, false, Math.PI / 2, Math.PI), 'personaje', 0x111111, [0, 0.05, -0.12], [0.14, 0, 0]);
  r.cab.add(v.hecho());
  // el perro: cuerpo, cabeza, orejas, cola y cuatro patas
  const perro = new THREE.Group(), cp = new Arma(kit), cafe = 0xa0703a;
  cp.pon(redonda(0.32, 0.3, 0.75, 0.12), 'personaje', cafe, [0, 0.5, 0]);
  cp.pon(redonda(0.28, 0.26, 0.3, 0.1), 'personaje', cafe, [0, 0.72, -0.45]);
  cp.pon(redonda(0.14, 0.1, 0.16, 0.04), 'personaje', 0x5a3a1a, [0, 0.66, -0.64]);
  for (const s of [-1, 1]) cp.pon(redonda(0.06, 0.16, 0.1, 0.03), 'personaje', 0x5a3a1a, [s * 0.11, 0.9, -0.4], [0, 0, s * 0.3]);
  cp.pon(CILINDRO_CHICO, 'personaje', 0xe8463b, [0, 0.62, -0.32], [Math.PI / 2, 0, 0], [0.3, 0.06, 0.3]);
  perro.add(cp.hecho());
  const patas = [];
  for (const [x, z] of [[-0.11, -0.25], [0.11, -0.25], [-0.11, 0.25], [0.11, 0.25]]) {
    const pa = new THREE.Group(); pa.position.set(x, 0.42, z);
    const a = new Arma(kit); a.pon(CAJA, 'personaje', cafe, [0, -0.2, 0], null, [0.08, 0.4, 0.08]); pa.add(a.hecho()); perro.add(pa); patas.push(pa);
  }
  const cola = new THREE.Group(); cola.position.set(0, 0.6, 0.36);
  const ac = new Arma(kit); ac.pon(CAJA, 'personaje', cafe, [0, 0.12, 0.05], [0.6, 0, 0], [0.05, 0.28, 0.05]); cola.add(ac.hecho()); perro.add(cola);
  return { r, perro, patas, cola };
}

/** El túnel entre estaciones: un tubo oscuro con tiras de luz y un letrero en la entrada. */
function armaTunel() {
  const g = new THREE.Group(), largo = 150;
  const hormigon = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.95 });
  const luz = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
  const borde = new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.8 });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(CAJA, hormigon); m.scale.set(0.5, 6.8, largo); m.position.set(s * 4.1, 3.4, -largo / 2); g.add(m); }
  const techo = new THREE.Mesh(CAJA, hormigon); techo.scale.set(8.7, 0.5, largo); techo.position.set(0, 6.85, -largo / 2); g.add(techo);
  const luces = new THREE.InstancedMesh(CAJA, luz, Math.floor(largo / 6) * 2);
  const m4 = new THREE.Matrix4(); let i = 0;
  for (let z = 3; z < largo; z += 6) for (const s of [-1, 1]) { m4.compose(new THREE.Vector3(s * 2.6, 6.55, -z), new THREE.Quaternion(), new THREE.Vector3(0.18, 0.06, 2.4)); luces.setMatrixAt(i++, m4); }
  luces.count = i; g.add(luces);
  for (const zz of [0, -largo]) {                                              // los dos portales
    const p = new THREE.Mesh(CAJA, borde); p.scale.set(9.4, 1.6, 1); p.position.set(0, 7.4, zz); g.add(p);
    for (const s of [-1, 1]) { const q = new THREE.Mesh(CAJA, borde); q.scale.set(0.9, 7.4, 1); q.position.set(s * 4.35, 3.7, zz); g.add(q); }
  }
  const cartelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), cartelMat); cartel.position.set(0, 7.45, 0.52); g.add(cartel);
  g.userData = { largo, cartelMat };
  for (const m of g.children) { m.receiveShadow = false; m.castShadow = false; m.frustumCulled = false; }
  g.visible = false;
  return g;
}

/* ===================================================================
   6. EL MUNDO
   =================================================================== */

/** Crea el mundo sobre un canvas. Devuelve lo que la pantalla necesita para dibujar. */
export function crearMundo(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 240);
  const vivos = new THREE.Group(); escena.add(vivos);                       // lo que está en pantalla y se mueve
  const pm = new THREE.PMREMGenerator(renderer);
  const ambiente = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;   // reflejos para los materiales PBR
  const mundo = { vivos, resolucion: new THREE.Vector2(1280, 720) };
  const kits = new Map();
  let kit = null;                                                             // el kit activo
  let calidad = 'media';
  /* Hasta dónde se dibuja. En calidad baja se acorta a 125 m y la niebla se
     acerca con él: es lo que más llamadas al GPU ahorra (un 35 % menos de
     edificios, árboles y faroles), y en un celular lento eso pesa más que
     los píxeles. */
  let vista = VISTA;
  let composer = null;
  let luces = [];                                                             // las luces del kit activo
  let espejo = null;                                                          // el piso de espejo (neón, calidad alta)
  let tunel = armaTunel(); escena.add(tunel);
  let tunelObj = null;
  const pasosPendientes = [];                                                 // trabajo de preparación repartido en cuadros
  let ancho = 1280, alto = 720;
  let corredor = null, perse = null, aspecto = MOTOR.ASPECTOS.clasico;
  let sacudida = 0;
  const chispas = [];                                                         // brillitos al tomar monedas
  let particulas = null, trenFantasma = null, tiempoFantasma = 0;
  const camPos = new THREE.Vector3(0, 4.7, 8.6), camMira = new THREE.Vector3(0, 0.4, -9);

  /* ---- la ciudad de los costados ---- */
  const paisaje = [];                                                         // {obj, d, largo, tipo}
  const frente = { e: { [-1]: 0, [1]: 0 }, farol: 0, poste: 0, arbol: { [-1]: 0, [1]: 0 }, graf: { [-1]: 0, [1]: 0 } };
  const sinPaisaje = [];                                                      // tramos [a, b] donde no se pone ciudad (túneles)
  const enTunel = (a, b) => sinPaisaje.some(([x, y]) => b > x - 6 && a < y + 6);
  function poneciudad(D) {
    if (!kit || !kit.listo) return;
    const hasta = D + vista;
    for (const lado of [-1, 1]) {
      while (frente.e[lado] < hasta) {                                        // edificios uno tras otro, con callejones
        const o = kit.saca('edificio' + lado, () => kit.edificio(lado));
        const d0 = frente.e[lado], dl = o.userData.largo * 2;
        if (enTunel(d0, d0 + dl)) { kit.guarda(o); frente.e[lado] = d0 + dl + 2; continue; }
        o.position.x = lado * (6.5 + o.userData.ancho / 2);
        paisaje.push({ obj: o, d: d0 + dl / 2, largo: dl / 2, k: kit });
        frente.e[lado] = d0 + dl + 0.8 + kit.az() * 2.2;
      }
      if (!kit.neon) while (frente.arbol[lado] < hasta) {                     // árboles en la vereda
        const d = frente.arbol[lado];
        frente.arbol[lado] = d + 9 + kit.az() * 8;
        if (enTunel(d - 2, d + 2)) continue;
        const o = kit.saca('arbol', () => kit.arbol()); o.position.set(lado * (5.45 + kit.az() * 0.3), SUELO, 0);
        paisaje.push({ obj: o, d, largo: 1.5, k: kit });
      }
      while (frente.graf[lado] < hasta) {                                     // grafitis en el muro
        const d = frente.graf[lado];
        frente.graf[lado] = d + 12 + kit.az() * 22;
        if (enTunel(d - 3, d + 3) || kit.az() < 0.35) continue;
        const o = kit.saca('graf' + lado, () => kit.grafiti(lado)); o.position.set(lado * 3.56, 0.6, 0);
        paisaje.push({ obj: o, d, largo: 1.8, k: kit });
      }
    }
    while (frente.farol < hasta) {                                            // faroles, alternando lados
      const d = frente.farol; frente.farol = d + 13;
      if (enTunel(d - 1, d + 1)) continue;
      for (const lado of [-1, 1]) { const o = kit.saca('farol' + lado, () => kit.farol(lado)); o.position.set(lado * 4.55, SUELO, 0); paisaje.push({ obj: o, d: d + lado * 3, largo: 1, k: kit }); }
    }
    while (frente.poste < hasta) {                                            // postes de catenaria
      const d = frente.poste; frente.poste = d + 24;
      if (enTunel(d - 1, d + 1)) continue;
      for (const lado of [-1, 1]) { const o = kit.saca('poste' + lado, () => kit.poste(lado)); o.position.set(lado * 3.45, 0, 0); paisaje.push({ obj: o, d, largo: 0.6, k: kit }); }
    }
  }
  function mueveCiudad(D) {
    for (let i = paisaje.length - 1; i >= 0; i--) {
      const p = paisaje[i];
      if (p.d + p.largo < D - DETRAS) { p.k.guarda(p.obj); paisaje.splice(i, 1); continue; }   // ya quedó atrás: a la reserva
      p.obj.position.z = -(p.d - D);
    }
  }
  function vaciaCiudad(desde) {
    for (const p of paisaje) p.k.guarda(p.obj);
    paisaje.length = 0;
    frente.e[-1] = frente.e[1] = frente.farol = frente.poste = desde;
    frente.arbol[-1] = frente.arbol[1] = frente.graf[-1] = frente.graf[1] = desde;
  }

  /* ---- los objetos del juego (los manda el motor) ---- */
  const dinamicos = new Set();                                                // objetos del motor que tienen dibujo
  const monedas = new Set();                                                  // las monedas visibles
  function nuevo(o) {
    if (o.vis || !kit || !kit.listo) return;
    if (o.tipo === 'moneda') { o.vis = { moneda: true }; monedas.add(o); return; }
    if (o.tipo === 'tunel') { tunelObj = o; sinPaisaje.push([o.d0, o.d0 + o.largo]); return; }
    let obj;
    if (o.tipo === 'tren') { const i = (o.id || 0) % 3; obj = kit.saca('tren' + i, () => kit.tren(i)); obj.position.x = CARRILES[o.carril]; }
    else if (o.tipo === 'rampa') { obj = kit.saca('rampa', () => kit.rampa()); obj.position.x = CARRILES[o.carril]; obj.position.y = SUELO; }
    else if (o.tipo === 'bajo') { obj = kit.saca('bajo', () => kit.barreraBaja()); obj.position.set(CARRILES[o.carril], SUELO, 0); }
    else if (o.tipo === 'alto') { obj = kit.saca('alto', () => kit.barreraAlta()); obj.position.set(CARRILES[o.carril], SUELO, 0); }
    else if (o.tipo === 'poder') { obj = kit.saca('poder-' + o.clase, () => kit.poder(o.clase)); obj.position.x = CARRILES[o.carril]; }
    else if (o.tipo === 'estrella') { obj = kit.saca('estrella', () => kit.estrella()); obj.position.x = CARRILES[o.carril]; }
    else if (o.tipo === 'boleto') { obj = kit.saca('boleto', () => kit.boleto()); obj.position.x = CARRILES[o.carril]; }
    else return;
    o.vis = { obj, kit };
    dinamicos.add(o);
  }
  function suelta(o) {
    if (!o.vis) return;
    if (o.vis.moneda) monedas.delete(o);
    else if (o.vis.obj) { o.vis.kit.guarda(o.vis.obj); dinamicos.delete(o); }
    o.vis = null;
  }
  function sueltaTodo() {
    for (const o of [...dinamicos]) suelta(o);
    for (const o of [...monedas]) suelta(o);
  }

  /* ---- calidad y post-proceso ---- */
  const AJUSTES = {
    alta: { dpr: 1.5, sombras: 2048, ao: true, bloom: true, fxaa: true, espejo: true, pixel: 4 },
    media: { dpr: 1.0, sombras: 1024, ao: false, bloom: true, fxaa: true, espejo: false, pixel: 4 },
    baja: { dpr: 0.8, sombras: 0, ao: false, bloom: false, fxaa: false, espejo: false, pixel: 0 }
  };
  const ACABADO = {                                                            // viñeta, saturación, aberración y líneas de barrido
    uniforms: { tDiffuse: { value: null }, vig: { value: 0.3 }, sat: { value: 1 }, aber: { value: 0 }, scan: { value: 0 }, alto: { value: 720 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float vig, sat, aber, scan, alto; varying vec2 vUv;
      void main(){
        vec2 d = vUv - 0.5; vec3 c;
        if (aber > 0.0) { c.r = texture2D(tDiffuse, vUv + d * aber * 4.0).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - d * aber * 4.0).b; }
        else c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat);
        c *= 1.0 - vig * dot(d, d) * 1.5;
        if (scan > 0.0) c *= 1.0 - scan * (0.5 + 0.5 * sin(vUv.y * alto * 3.14159));
        gl_FragColor = vec4(c, 1.0);
      }`
  };
  function armaComposer() {
    if (composer) { composer.dispose?.(); composer = null; }
    if (!kit) return;
    const A = AJUSTES[calidad], pal = kit.pal;
    renderer.toneMapping = kit.pixel ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = pal.exposicion;
    if (calidad === 'baja' && !kit.pixel) return;                             // en baja se dibuja directo, sin post-proceso
    const c = new EffectComposer(renderer);
    c.setPixelRatio(renderer.getPixelRatio()); c.setSize(ancho, alto);
    if (kit.pixel) {
      // el tamaño del píxel se elige para que la imagen tenga ~270 filas de alto, en cualquier pantalla
      const px = Math.max(2, Math.round(alto * renderer.getPixelRatio() / 270));
      c.addPass(new RenderPixelatedPass(px, escena, camara, { normalEdgeStrength: calidad === 'baja' ? 0.0001 : 0.45, depthEdgeStrength: calidad === 'baja' ? 0.0001 : 0.55 }));
    } else c.addPass(new RenderPass(escena, camara));
    if (A.ao && kit.juguete) {
      try {
        const ao = new GTAOPass(escena, camara, ancho, alto);
        ao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.4, thickness: 2, scale: 1.3, samples: 12, distanceFallOff: 1 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
        c.addPass(ao);
      } catch (e) { console.warn('Vía Libre: sin oclusión ambiental', e); }
    }
    if (A.bloom && pal.post.bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(ancho / 2, alto / 2), ...pal.post.bloom));
    c.addPass(new OutputPass());
    if (A.fxaa && !kit.pixel) { const f = new ShaderPass(FXAAShader); f.uniforms.resolution.value.set(1 / (ancho * renderer.getPixelRatio()), 1 / (alto * renderer.getPixelRatio())); c.addPass(f); }
    if (pal.post.vineta) {
      const v = new ShaderPass(ACABADO);
      v.uniforms.vig.value = pal.post.vineta; v.uniforms.sat.value = pal.post.sat || 1;
      v.uniforms.aber.value = calidad === 'alta' ? (pal.post.aberracion || 0) : 0;
      v.uniforms.scan.value = pal.post.lineas || 0; v.uniforms.alto.value = alto * renderer.getPixelRatio();
      c.addPass(v);
    }
    composer = c;
  }
  function aplicaSombras() {
    const A = AJUSTES[calidad];
    renderer.shadowMap.enabled = A.sombras > 0 && !!(kit && kit.pal.sol);
    renderer.shadowMap.type = kit && kit.juguete ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    for (const l of luces) if (l.isDirectionalLight) {
      l.castShadow = renderer.shadowMap.enabled;
      if (l.castShadow && l.shadow.mapSize.x !== A.sombras) { l.shadow.mapSize.set(A.sombras, A.sombras); l.shadow.map?.dispose(); l.shadow.map = null; }
    }
    if (corredor) corredor.sombra.visible = !renderer.shadowMap.enabled;
    if (kit) for (const m of kit.mats.values()) m.needsUpdate = true;          // los materiales cambian de programa
  }
  function ponEspejo() {
    if (espejo) { escena.remove(espejo); espejo.dispose?.(); espejo = null; }
    if (!kit || !kit.neon) return;
    if (AJUSTES[calidad].espejo) {
      espejo = new Reflector(new THREE.PlaneGeometry(240, 300), { clipBias: 0.003, textureWidth: Math.round(ancho / 2), textureHeight: Math.round(alto / 2), color: 0x2a2a3c });
    } else espejo = new THREE.Mesh(new THREE.PlaneGeometry(240, 300), new THREE.MeshStandardMaterial({ color: 0x0a0618, roughness: 0.25, metalness: 0.6, envMapIntensity: 0.3 }));
    espejo.rotation.x = -Math.PI / 2; espejo.position.set(0, 0, -VISTA / 2 + 10); espejo.frustumCulled = false;
    escena.add(espejo);
  }

  /* ---- cambiar de estación ---- */
  function kitDe(estacion) {
    const clave = estacion.paleta;
    if (!kits.has(clave)) {
      const k = new Kit(mundo, clave, PALETAS[clave] || PALETAS.barrio);
      escena.add(k.almacen);
      kits.set(clave, k);
    }
    return kits.get(clave);
  }
  /** Prepara el kit de una estación de a poco (sin trabar la carrera). */
  function precarga(estacion) {
    const k = kitDe(estacion);
    if (k.listo || k.preparando) return;
    k.preparando = true;
    pasosPendientes.push(...k.pasosDePreparacion());
  }
  /** La niebla de la paleta, acortada si la vista se acortó (calidad baja). */
  function ajustaNiebla() {
    if (!escena.fog || !kit) return;
    const [cerca, lejos] = kit.pal.niebla, f = vista / VISTA;
    escena.fog.near = cerca * f; escena.fog.far = Math.min(lejos, vista - 6);
  }
  /** Activa la estación: cambia kit, luces, cielo, niebla, post-proceso. `desde` = metro desde el que se rehace la ciudad. */
  function activa(estacion, desde) {
    const k = kitDe(estacion);
    if (!k.listo) {                                                           // si no alcanzó a prepararse de a poco, se termina ahora
      if (!k.preparando) { k.preparando = true; for (const p of k.pasosDePreparacion()) p(); }
      else while (!k.listo && pasosPendientes.length) pasosPendientes.shift()();
    }
    sueltaTodo();
    vaciaCiudad(desde);
    if (kit && kit !== k) { escena.remove(kit.via); escena.remove(kit.cielo); kit.monedas.parent?.remove(kit.monedas); }
    kit = k;
    escena.add(kit.via); escena.add(kit.cielo); escena.add(kit.monedas);
    for (const l of luces) escena.remove(l, l.target || l);
    luces = [];
    const pal = kit.pal;
    escena.fog = new THREE.Fog(pal.nieblaColor ?? pal.cielo.horizonte, pal.niebla[0], pal.niebla[1]);
    ajustaNiebla();
    escena.environment = pal.env ? ambiente : null;
    const h = new THREE.HemisphereLight(...pal.hemi); escena.add(h); luces.push(h);
    if (pal.sol) {
      const l = new THREE.DirectionalLight(pal.sol[0], pal.sol[1]);
      l.position.set(...pal.sol[2]); l.target.position.set(0, 0, -16);
      Object.assign(l.shadow.camera, { left: -26, right: 26, top: 42, bottom: -42, near: 1, far: 140 });
      l.shadow.camera.updateProjectionMatrix(); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.035; l.shadow.radius = 2;
      escena.add(l, l.target); luces.push(l);
    }
    // el corredor y el perseguidor se rearman con los materiales del kit nuevo
    if (corredor) escena.remove(corredor.raiz, corredor.sombra);
    corredor = armaCorredor(kit, aspecto); escena.add(corredor.raiz, corredor.sombra);
    if (perse) escena.remove(perse.r.raiz, perse.perro);
    perse = armaPerseguidor(kit); perse.r.raiz.visible = perse.perro.visible = false; escena.add(perse.r.raiz, perse.perro);
    // partículas del ambiente
    if (particulas) { escena.remove(particulas); particulas = null; }
    const ex = pal.extras;
    if (ex.nieve || ex.polvo || ex.espectros) {
      const n = ex.nieve ? 900 : ex.polvo ? 500 : 220, pos = new Float32Array(n * 3), az = azarDe(5);
      for (let i = 0; i < n; i++) { pos[i * 3] = (az() - .5) * 40; pos[i * 3 + 1] = az() * 16; pos[i * 3 + 2] = -az() * 120 + 10; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      particulas = new THREE.Points(g, new THREE.PointsMaterial({ color: ex.nieve ? 0xffffff : ex.polvo ? 0xe8b080 : 0x9fffe6, size: ex.nieve ? 0.12 : ex.polvo ? 0.08 : 0.35, transparent: true, opacity: ex.espectros ? 0.5 : 0.85, depthWrite: false, blending: ex.espectros ? THREE.AdditiveBlending : THREE.NormalBlending }));
      particulas.userData = { tipo: ex.nieve ? 'nieve' : ex.polvo ? 'polvo' : 'espectros' }; particulas.frustumCulled = false;
      escena.add(particulas);
    }
    if (trenFantasma) { escena.remove(trenFantasma); trenFantasma = null; }
    if (ex.trenFantasma) {
      trenFantasma = new THREE.Mesh(geoTren(L_VAGON * 3), new THREE.MeshBasicMaterial({ color: 0x7dffcf, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      trenFantasma.visible = false; escena.add(trenFantasma);
    }
    ponEspejo();
    aplicaSombras();
    armaComposer();
    try { renderer.compile(escena, camara); } catch (e) { /* si no se puede compilar antes, se compila al dibujar */ }
  }

  /* ---- cada cuadro ---- */
  const _v = new THREE.Vector3();
  /** Actualiza todo para el estado `e` del juego:
      e = {D, x, y, pose, poderes:{iman,mochila,zapatillas,patineta}, perseguidor (0 a 1), dt, t} */
  function paso(e) {
    const dt = e.dt || 0;
    // trabajo de preparación pendiente, con un presupuesto de ~4 ms por cuadro
    const t0 = performance.now();
    while (pasosPendientes.length && performance.now() - t0 < 4) pasosPendientes.shift()();
    if (!kit) return;
    const D = e.D;
    kit.desplaza(D);
    poneciudad(D); mueveCiudad(D);
    // objetos del juego
    for (const o of dinamicos) {
      const obj = o.vis.obj;
      if (o.tipo === 'tren') obj.position.z = -(o.d0 + o.largo / 2 - D);
      else if (o.tipo === 'rampa') obj.position.z = -(o.d0 - D);
      else if (o.tipo === 'bajo' || o.tipo === 'alto') obj.position.z = -(o.d - D);
      else {                                                                  // poderes, estrellas y boletos: giran y flotan
        obj.position.set(o.x != null ? o.x : CARRILES[o.carril], (o.y || 1.2) + SUELO + Math.sin(e.t * 3 + o.id) * 0.12, -(o.d - D));
        const cuerpo = obj.getObjectByName('cuerpo'); if (cuerpo) cuerpo.rotation.y = e.t * 2.2 + o.id;
      }
    }
    // monedas: una InstancedMesh
    const im = kit.monedas; let n = 0;
    for (const o of monedas) {
      if (n >= 400) break;
      const z = -(o.d - D);
      if (z < -vista || z > DETRAS) continue;
      _m.compose(_p.set(o.x != null ? o.x : CARRILES[o.carril], o.y + SUELO, z), _q.setFromEuler(_e.set(0, e.t * 3 + o.d * 0.15, 0)), _s.set(1, 1, 1));
      im.setMatrixAt(n++, _m);
    }
    im.count = n; im.instanceMatrix.needsUpdate = true;
    // túnel
    if (tunelObj) {
      const z0 = -(tunelObj.d0 - D);
      tunel.visible = z0 > -vista - 20 && z0 - tunelObj.largo < DETRAS + 10;
      tunel.position.z = z0;
      if (z0 - tunelObj.largo > DETRAS + 20) tunelObj = null;
    } else tunel.visible = false;
    // el corredor
    if (corredor) {
      const r = corredor, P = e.poderes || {};
      r.raiz.position.set(e.x, e.y + SUELO + (P.patineta ? 0.12 : 0), 0);
      posa(r, e.pose || { modo: 'correr', fase: 0 });
      r.cohete.visible = !!P.mochila;
      r.llamas.scale.y = 0.7 + Math.random() * 0.6;
      r.tabla.visible = !!P.patineta;
      r.aura.visible = !!P.iman; r.aura.rotation.z = e.t * 3;
      for (const pp of r.piernas) pp.brilloZap.visible = !!P.zapatillas;
      r.sombra.position.set(e.x, (e.suelo || 0) + SUELO + 0.01, 0);
      r.sombra.scale.setScalar(Math.max(0.4, 1 - (e.y - (e.suelo || 0)) * 0.15));
    }
    // el inspector y el perro (vienen detrás cuando tropiezas)
    if (perse) {
      const k = e.perseguidor || 0, vis = k > 0.01;
      perse.r.raiz.visible = perse.perro.visible = vis;
      if (vis) {
        const z = 2.2 + (1 - k) * 9;
        perse.r.raiz.position.set(e.x * 0.85 + 0.6, SUELO, z);
        posa(perse.r, { modo: 'correr', fase: e.t * 11 });
        perse.perro.position.set(e.x * 0.85 - 0.7, SUELO, z - 0.9);
        perse.patas.forEach((p, i) => { p.rotation.x = Math.sin(e.t * 18 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1 : 0)) * 0.8; });
        perse.cola.rotation.z = Math.sin(e.t * 20) * 0.6;
      }
    }
    // la cámara: detrás y arriba, sigue al corredor con suavidad
    // en el suelo la cámara casi no sube con el salto (se ve el salto); en
    // los techos sube un poco menos que él (se ve la vía de abajo); volando
    // con la mochila lo sigue metro a metro, o el corredor se sale por arriba
    const yC = e.y > 4.8 ? 3.6 + (e.y - 4.8) : e.y > 1 ? e.y * 0.75 : e.y * 0.4;
    const k = 1 - Math.exp(-6 * dt);
    camPos.lerp(_v.set(e.x * 0.45, 4.7 + yC + ajusteRetrato.y, 8.6 + ajusteRetrato.z), k);
    camMira.lerp(_v.set(e.x * 0.3, 0.4 + yC * 1.05, -9), k);
    camara.position.copy(camPos);
    if (sacudida > 0) { camara.position.x += (Math.random() - .5) * sacudida; camara.position.y += (Math.random() - .5) * sacudida; sacudida = Math.max(0, sacudida - dt * 2.5); }
    camara.lookAt(camMira);
    kit.cielo.position.copy(camara.position);
    // partículas del ambiente
    if (particulas) {
      const a = particulas.geometry.attributes.position, tipo = particulas.userData.tipo, vz = (e.v || 15) * dt;
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i), y = a.getY(i), z = a.getZ(i) + vz;
        if (tipo === 'nieve') { y -= dt * 2.2; x += Math.sin(e.t + i) * dt * 0.6; }
        else if (tipo === 'polvo') { x += dt * 3; y += Math.sin(e.t * 2 + i) * dt * 0.3; }
        else { y += Math.sin(e.t * 0.7 + i) * dt * 0.5; }
        if (z > 12) z -= 130;
        if (y < 0) y += 16; if (x > 20) x -= 40;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true;
    }
    if (trenFantasma) {                                                       // el tren fantasma cruza el cielo de vez en cuando
      tiempoFantasma -= dt;
      if (tiempoFantasma <= 0 && !trenFantasma.visible) { trenFantasma.visible = true; trenFantasma.position.set(-80, 18, -90); trenFantasma.rotation.y = Math.PI / 2; tiempoFantasma = 22; }
      if (trenFantasma.visible) { trenFantasma.position.x += dt * 14; if (trenFantasma.position.x > 90) trenFantasma.visible = false; }
    }
    // chispas
    for (let i = chispas.length - 1; i >= 0; i--) {
      const c = chispas[i]; c.t += dt;
      c.m.position.y += dt * 2.5; c.m.position.z += (e.v || 15) * dt * 0.6;
      c.m.scale.setScalar(Math.max(0.01, 0.35 * (1 - c.t / 0.35)));
      if (c.t > 0.35) { escena.remove(c.m); chispas.splice(i, 1); }
    }
  }
  const geoChispa = new THREE.OctahedronGeometry(0.5, 0);
  const matsChispa = new Map();                                                // un material por color, reusado
  const matChispa = col => { if (!matsChispa.has(col)) matsChispa.set(col, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); return matsChispa.get(col); };

  /* ---- tamaño de la pantalla ---- */
  const ajusteRetrato = { y: 0, z: 0 };
  function tamano(w, h) {
    ancho = Math.max(1, w | 0); alto = Math.max(1, h | 0);
    const A = AJUSTES[calidad];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, A.dpr));
    renderer.setSize(ancho, alto, false);
    const asp = ancho / alto;
    // el ángulo de visión se ajusta para que siempre quepan los tres carriles (en un celular vertical, más abierto)
    camara.fov = THREE.MathUtils.clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(33)) / asp) * 180 / Math.PI, 40, 74);
    ajusteRetrato.y = asp < 1 ? 1.2 * (1 - asp) : 0; ajusteRetrato.z = asp < 1 ? 2.2 * (1 - asp) : 0;
    camara.aspect = asp; camara.updateProjectionMatrix();
    mundo.resolucion.set(ancho * renderer.getPixelRatio(), alto * renderer.getPixelRatio());
    for (const k of kits.values()) for (const lm of k.lineasMat.values()) lm.resolution.copy(mundo.resolucion);
    ponEspejo();
    armaComposer();
  }

  return {
    escena, camara, renderer,
    /** Activa la estación (al empezar y dentro de un túnel). */
    activa, precarga,
    /** ¿Ya está listo el kit de esa estación? */
    listo: estacion => kitDe(estacion).listo,
    nuevo, suelta, sueltaTodo,
    paso,
    dibuja() { if (composer) composer.render(); else renderer.render(escena, camara); },
    tamano,
    /** Cambia la calidad: 'alta' | 'media' | 'baja'. */
    calidad(nivel) { if (!AJUSTES[nivel] || nivel === calidad) return; calidad = nivel; vista = nivel === 'baja' ? 125 : VISTA; ajustaNiebla(); tamano(ancho, alto); aplicaSombras(); },
    /** Hasta cuántos metros por delante se dibuja (el juego no crea dibujos más allá). */
    get vista() { return vista; },
    get nivelCalidad() { return calidad; },
    /** Cambia los colores del corredor (aspecto de la tienda). */
    aspecto(asp) { aspecto = asp; if (kit && corredor) { escena.remove(corredor.raiz, corredor.sombra); corredor = armaCorredor(kit, aspecto); escena.add(corredor.raiz, corredor.sombra); aplicaSombras(); } },
    /** Sacude la cámara (un choque). */
    sacude(f) { sacudida = Math.max(sacudida, f); },
    /** Un brillito donde se tomó una moneda o un poder. */
    chispa(x, y, z, col) {
      const m = new THREE.Mesh(geoChispa, matChispa(col || 0xfff3a0));
      m.position.set(x, y + SUELO, z); escena.add(m); chispas.push({ m, t: 0 });
    },
    /** Pone el letrero del túnel con el nombre de la estación que viene. */
    letreroTunel(nombre) {
      const mat = tunel.userData.cartelMat;
      mat.map?.dispose(); mat.map = aTextura(TEX.tunel(nombre), { repetir: false }); mat.needsUpdate = true;
    },
    /** Olvida los túneles ya pasados (para que la ciudad vuelva a ponerse ahí si se reinicia). */
    reinicia() { sinPaisaje.length = 0; tunelObj = null; tunel.visible = false; sueltaTodo(); vaciaCiudad(0); },
    /** Para depurar: cuántas llamadas al GPU hizo el último cuadro. */
    info: () => ({ llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, kit: kit && kit.clave, calidad })
  };
}
