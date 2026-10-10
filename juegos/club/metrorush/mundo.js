/* Metro Rush — el mundo 3D (todo lo que se dibuja).

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
   - "neon": la ciudad oscura con bordes y luces que brillan (bloom), piso
     de espejo mojado y un sol synthwave; los trenes, barreras, rampas y
     poderes, en cambio, brillan en su propio color para que se lean sobre
     lo oscuro (ver "LEGIBILIDAD" en las paletas).
   - "comic": la luz y los materiales del juguete, pero planos (luz pareja,
     sin oclusión, sombras duras) y a resolución completa, con un contorno de
     tinta que recorta cada objeto contra lo que tiene detrás (PasadaTinta).
     Reemplazó al estilo pixelado, que dibujaba a baja resolución y no se
     leía bien en ninguna pantalla.
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
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
// los escenarios nuevos y la historia que se ve en la vía (afiches, utilería, horizonte, sucesos): ver escenarios.js
import * as ESC from './escenarios.js?v=metrorush-15';

const MOTOR = window.MetroRushMotor;                // el motor (motor.js), cargado antes como script
const CARRILES = MOTOR.CARRILES;                   // x de cada carril
const L_VAGON = MOTOR.LARGO_VAGON;                 // largo de un vagón
const TECHO = MOTOR.ALTO_TECHO;                    // altura del techo de un tren
/* La catenaria va alta, por encima de lo que pasa en los techos: de pie
   sobre un vagón la cabeza llega a 5,05 m y un salto desde ahí a 6,55, y la
   cámara de los techos va a 7,2 (7,9 con el celular en vertical). Con los
   cables a 5,4 el corredor los atravesaba en cuanto subía a un vagón. (Las
   alturas de hoy, con el salto nuevo, en el bloque de abajo.) */
/* --- La catenaria, más alta para el salto nuevo (ronda 2) ---
   Lo más alto del corredor es la coronilla: 1,8 m sobre sus pies (la cabeza
   tiene el centro a 1,68 y 0,21 de radio, y el muñeco va a escala 0,95), y
   los pies van 0,14 sobre el piso (la vía). Con el salto de Subway Surfers
   (2,1 m; 4,4 con zapatillas) saltar desde un techo con zapatillas la lleva
   a 3,35 + 4,4 + 0,14 + 1,8 ≈ 9,7 m; la mochila vuela a 8,5 (cabeza a
   10,4) y el pogo sube a 8,3 con el corredor 0,55 más arriba (cabeza a
   10,8). Con los cables a 7,8 todos los atravesaban; ahora van a 11,2, el
   brazo justo encima y el poste un poco más arriba. Los tests
   (metrorush-salto) leen estos números de aquí y lo comprueban. */
const ALTO_CABLE = 11.2;                           // los cables de la catenaria (eran 7,8)
const ALTO_BRAZO = 11.7;                           // el brazo del poste que los sostiene (era 8,3)
const ALTO_POSTE = 12.0;                           // el poste entero (era 8,6)
const ATERRIZA_PERRO = 0.45;                       // a los cuántos segundos de la atrapada cae el perro encima (lo mismo usa juego.js)
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
function aTextura(c, { repetir = true, rep = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;                                         // los colores del canvas están en sRGB
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
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
  /** Rayas diagonales de dos colores (barreras, cintas de peligro).
      Con `marco`, un borde oscuro alrededor (los tableros de las barreras):
      separa las rayas claras de un fondo claro, como la nieve de Invierno o
      el cielo del amanecer, sin cambiar los colores de la barrera. */
  rayas(c1, c2, n = 8, marco = null) {
    const [c, x] = lienzo(256, 64);
    x.fillStyle = hexCss(c2); x.fillRect(0, 0, 256, 64);
    x.fillStyle = hexCss(c1);
    const paso = 256 / n;
    for (let k = -1; k < n + 1; k++) { x.beginPath(); x.moveTo(k * paso, 64); x.lineTo(k * paso + paso / 2, 64); x.lineTo(k * paso + paso / 2 + 32, 0); x.lineTo(k * paso + 32, 0); x.fill(); }
    if (marco != null) { x.strokeStyle = hexCss(marco); x.lineWidth = 12; x.strokeRect(0, 0, 256, 64); }
    return c;
  },
  /** Rejilla metálica (la superficie de la rampa). Clara a propósito: a más
      de diez metros el enrejado no se distingue y la rampa se ve del color
      PROMEDIO de la textura; con la rejilla gris de antes (fondo #9aa3ae,
      líneas #5d6672) ese promedio oscurecía cualquier color de rampa a la
      mitad, y en Invierno una rampa naranja salía café sobre el balasto café. */
  rejilla() {
    const [c, x] = lienzo(128, 128);
    x.fillStyle = '#dfe4ea'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#9aa3ae'; x.lineWidth = 5;
    for (let k = -128; k < 256; k += 22) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke(); x.beginPath(); x.moveTo(k + 128, 0); x.lineTo(k, 128); x.stroke(); }
    return c;
  },
  /** La rejilla de la rampa en neón: líneas que brillan sobre un fondo tenue.
      Se usa sin sombreado ('texluz') y la tiñe el color de la rampa, así que
      es lo único que hay en blanco y gris. */
  rejillaNeon() {
    const [c, x] = lienzo(128, 128);
    x.fillStyle = '#6a6a6a'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#ffffff'; x.lineWidth = 5;
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
  /** Las luces de un tren que viene de frente, en una sola textura (así todo
      su brillo es UNA llamada al GPU). Mitad izquierda: un halo redondo para
      cada foco. Mitad derecha: un haz que es fuerte arriba (junto al tren) y
      se apaga hacia abajo, con los bordes suaves: es el charco de luz que el
      tren tira sobre la vía delante de él. */
  faro() {
    const [c, x] = lienzo(256, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 63);                  // el halo: blanco al centro, transparente en el borde
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.16, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const img = x.createImageData(128, 128);                                  // el haz, píxel por píxel
    for (let j = 0; j < 128; j++) {
      const largo = Math.pow(1 - j / 127, 1.7);                               // fila 0 (arriba) = junto al tren: fuerte; abajo: nada
      for (let i = 0; i < 128; i++) {
        const u = (i - 63.5) / 64, ancho = Math.exp(-u * u * 4.5) * (1 - u * u); // de lado: una campana que llega a cero en el borde
        const k = (j * 128 + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(255 * largo * Math.max(0, ancho));
      }
    }
    x.putImageData(img, 128, 0);
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

/* LEGIBILIDAD. Lo que hay que esquivar o tomar (trenes, barreras, rampas,
   monedas, poderes, estrella, boleto) tiene que leerse de un vistazo a
   30 m/s, en cualquier estación y en cualquier calidad. La regla: el
   decorado puede ser tan oscuro o tan parejo como pida el estilo, pero un
   objeto del juego tiene que distinguirse de él en luminosidad o en tono.
   Cada paleta lo ajusta con `legible`:
   - brillo:   luz propia de los objetos del juego (0 = ninguna). Es lo que
               los saca de la oscuridad en Neón y Fantasma sin agregar luces.
   - niebla:   potencia del factor de niebla en esos objetos (1 = como la
               ciudad); con más de 1 se ven desde más lejos que el decorado.
   - decorado: cuánto se atenúan los postes y faroles de luz (solo neón);
               eran lo más brillante de la pantalla y competían con los
               obstáculos.
   Las variantes heredan el `legible` de su base, así que una estación
   nueva de noche (hecha con variante(BASE_NEON, …)) ya nace legible. */

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
    barrera: 0xe8463b, barrera2: 0xffffff, ambar: 0xffa424, rampa: 0xd9dde2, oro: 0xffc63a, iman: 0xe5332a, cromo: 0xf2f5f8, nube: 0xffffff, basurero: 0x2f8f5a
  },
  carteles: ['CAFÉ', 'PAN', 'FARMACIA', 'LIBROS', 'HELADOS', 'FRUTAS', 'MÚSICA'],
  grafitis: [['¡CORRE!', 0xff5a8a, 0xffd23f], ['METRO RUSH', 0x3fd0ff, 0x7a5cff], ['LAB', 0x8aff6a, 0x19b37a], ['ZOOM', 0xffa23a, 0xff3d6e]],
  extras: { nubes: true },
  // de día casi todo se lee bien; solo la niebla clara se comía los trenes lejanos (en Invierno, sobre todo)
  legible: { brillo: 0, niebla: 1.6 }
};
/* La base del estilo cómic es Ocaso, a la «hora dorada»: cielo ciruela que
   baja a dorado, edificios en rosa viejo, terracota y azul pizarra. La luz es
   pareja (la hemisférica pesa casi tanto como el sol) para que los colores se
   lean planos, como pintados, y el volumen lo dé el contorno de tinta, no las
   sombras. Los objetos del juego van en el tono opuesto al decorado: trenes
   fríos y claros (turquesa, crema, azul) y barreras azules con blanco; el
   rojo que tenían se perdía en lo anaranjado. `tinta` es el color del
   contorno: un ciruela casi negro, no negro puro, que se funde con la paleta. */
const BASE_COMIC = {
  estilo: 'comic',
  cielo: { arriba: 0x7a2e6a, horizonte: 0xffc65a, sol: 0xfff2c4 }, niebla: [40, 165],
  sol: [0xffb24a, 2.0, [-16, 12, -40]], hemi: [0xffd6a8, 0x5a2a4a, 1.0], env: 0.15, exposicion: 0.95,
  post: { vineta: 0.12, sat: 1.12 },
  tinta: 0x2a1230, fuerzaTinta: 0.85,
  c: {
    grava: 0x7a4e48, tierra: 0x5e3a3a, traviesa: 0x4a2e2a, riel: 0xc8b8c8, muro: 0xd8a888, acera: 0xc89878, bordillo: 0x9a6a5a,
    trenes: [0x2fb8c8, 0xf4f1e6, 0x3a4fd0], acentos: [0xffffff, 0xffd23f, 0x2a1230], bajo: 0x2a2232, vidrio: 0x22304a, techoTren: 0xe8e4dc,
    edificios: [0x8a3a5a, 0xc8603a, 0x3f5a7a, 0xa8506a, 0xe0905a], ladrillo: 0xb5677f, probLadrillo: 0,
    marco: 0x3b2040, vidrioEd: 0xffcf7a, cornisa: 0x4a2a4a, vitrina: 0x5a3f36,
    toldos: [[0xe2463a, 0xfff1d4], [0x2fb59a, 0xfff1d4], [0xffd23f, 0x5a3b2c]],
    arboles: [0x2f5a3a, 0x3f6a40], tronco: 0x4a2e2a, poste: 0x3b2040, farol: 0xffe3a0, catenaria: 0x3b2040,
    barrera: 0x2340b8, barrera2: 0xffffff, ambar: 0xffb020, rampa: 0xe8f4ff, oro: 0xffd23f, iman: 0xe2463a, cromo: 0xfff1d4, nube: 0xffd9c2, basurero: 0x2f5a3a
  },
  carteles: ['CAFÉ', 'PAN', 'ARCADE', 'LIBROS', 'DISCOS', 'FRUTAS'],
  grafitis: [['¡CORRE!', 0xffd23f, 0xe2463a], ['LAB', 0x2fb59a, 0x4f8c4f]],
  extras: { nubes: true, disco: true },
  // la luz del atardecer es cálida y pareja: un poco de brillo propio separa los objetos del fondo anaranjado
  legible: { brillo: 0.05, niebla: 1.6 }
};
const BASE_NEON = {
  estilo: 'neon',
  cielo: { arriba: 0x04021a, horizonte: 0x3a0a48, sol: 0xff4fa0 }, niebla: [35, 165], nieblaColor: 0x16062a,
  /* La única luz era un cielo violeta a 0,2: los trenes, la rampa y el
     cuerpo de los poderes se perdían como manchas negras sobre el piso negro
     y solo sus aristas los delataban. El cielo sube a 0,5 (da volumen a lo
     que no es luz: el techo de un tren se ve más claro que su costado), la
     exposición un poco, y la viñeta baja de 0,6 a 0,4, que oscurecía justo
     los carriles de los lados. */
  sol: null, hemi: [0x7a5ac8, 0x0a0618, 0.5], env: 0.1, exposicion: 0.78,
  post: { bloom: [0.5, 0.3, 0.85], vineta: 0.4, sat: 1.1, aberracion: 0.0009, lineas: 0.03 },
  c: {
    grava: 0x0b0720, tierra: 0x07041a, traviesa: 0x3a1a70, riel: 0x22e5ff, muro: 0x2a1a50, acera: 0x120a2a, bordillo: 0x22e5ff,
    trenes: [0xff2bd6, 0x22e5ff, 0xffe14d], acentos: [0x22e5ff, 0xff2bd6, 0xff2bd6], bajo: 0x1a1030, vidrio: 0x5ad8e8, techoTren: 0x6a35c9,
    edificios: [0x7b5cff, 0xff2bd6, 0x22e5ff, 0x9a4dff], ladrillo: 0x7b5cff, probLadrillo: 0,
    marco: 0x2a1a50, vidrioEd: 0xffffff, cornisa: 0xb01f96, vitrina: 0x4a1a40,
    toldos: [[0xff2bd6, 0x22e5ff]], ventanas: [0x22e5ff, 0xff2bd6, 0xffe14d, 0x7b5cff, 0x1a0f30, 0x1a0f30],
    arboles: [0xff2bd6], tronco: 0xff2bd6, poste: 0x2a1a50, farol: 0xff7ae0, catenaria: 0xff2bd6, rejilla: 0xb01f96,
    barrera: 0xff3d6e, barrera2: 0xffe14d, ambar: 0xffb020, rampa: 0x22e5ff, oro: 0xffe14d, iman: 0xff3d6e, cromo: 0xffffff, nube: 0xffffff, basurero: 0x22e5ff,
    rampaBorde: 0xffffff,          // las aristas de la rampa, blancas: cian sobre la rejilla cian no dibujaban la cuña
    marcoBarrera: null,            // el tablero ya brilla sobre lo oscuro: un marco oscuro solo lo achicaría
    tubo: 0xff2bd6                 // los postes de luz de los faroles (instanciados)
  },
  carteles: ['BAR', '24H', 'ARCADE', 'RAMEN', 'KARAOKE', 'DISCO'],
  grafitis: [['NEÓN', 0xff2bd6, 0x22e5ff], ['METRO RUSH', 0x22e5ff, 0x7b5cff]],
  extras: { synth: ['#ffe46b', '#ff6a9a', '#ff2bd6'], estrellas: true },
  /* El cuerpo de los objetos del juego brilla a un 32 % de su color (un tren
     magenta se ve magenta, no negro con borde), la niebla les llega más
     tarde (potencia 2) y los postes de luz bajan a un tercio. */
  legible: { brillo: 0.32, niebla: 2, decorado: 0.35 }
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
  ocaso: BASE_COMIC,
  neon: BASE_NEON,
  /* Estación Fantasma: el neón se vuelve verde espectral, con niebla verde y un tren fantasma en el cielo.
     Los trenes eran verde menta y cian, los mismos tonos de la ciudad, los
     rieles y los bordillos: todo era del mismo verde y un tren no se
     separaba de nada. Ahora son trenes fantasma de verdad: cuerpo pálido
     (menta casi blanca, hielo, lila), ventanas apagadas (oscuras, como un
     tren vacío) y franjas rosa, ámbar y lila, tonos que no hay en la
     ciudad. La rampa va en ámbar por lo mismo. El cielo de la luz ambiente
     pasa de violeta a verde, como el resto de la estación. */
  fantasma: variante(BASE_NEON, {
    cielo: { arriba: 0x020a0c, horizonte: 0x0e3a32, sol: 0x7dffcf }, nieblaColor: 0x062019,
    hemi: [0x6ab8a8, 0x061210, 0.5],
    c: { trenes: [0xe6fff4, 0xd4ecff, 0xeadcff], acentos: [0xff8ad8, 0xffc56b, 0xb08cff], techoTren: 0xc6ddd6, vidrio: 0x14352e,
      riel: 0x7dffcf, bordillo: 0x7dffcf, rampa: 0xffc56b, tubo: 0x2bd6a0,
      edificios: [0x2bd6a0, 0x3dd6ff, 0x7dffcf], ventanas: [0x7dffcf, 0x3dd6ff, 0xb6fff0, 0x0a1e1a, 0x0a1e1a, 0x0a1e1a], cornisa: 0x2bd6a0, catenaria: 0x3dd6ff, farol: 0x9fffe6, rejilla: 0x1a7a60, traviesa: 0x10403a, vitrina: 0x0f3a30 },
    // los cuerpos pálidos ya son claros: con menos brillo propio no se queman a blanco
    legible: { brillo: 0.24, niebla: 2, decorado: 0.35 },
    carteles: ['ADIÓS', 'ÚLTIMO TREN', 'BOLETERÍA', 'ANDÉN 0'],
    grafitis: [['1 000 000', 0x7dffcf, 0x3dd6ff], ['HOLA', 0xb6fff0, 0x2bd6a0]],
    extras: { synth: ['#d6fff2', '#7dffcf', '#1f8a6a'], estrellas: true, espectros: true, trenFantasma: true }
  }),
  /* Invierno: la ciudad de juguete con nieve, cielo gris y copos que caen. */
  invierno: variante(BASE_JUGUETE, {
    cielo: { arriba: 0x8aa4c0, horizonte: 0xe6edf3, sol: 0xffffff }, niebla: [40, 150],
    sol: [0xeaf2ff, 2.0, [-16, 26, 14]], hemi: [0xeef4ff, 0xa0a8b8, 0.75],
    /* Sobre la nieve lo blanco desaparece: las patas blancas de las
       barreras no se veían y la rampa (rejilla blanca) se confundía con la
       nieve de los costados. Las patas pasan a azul marino y la rampa a
       naranja. Las rayas siguen rojas y blancas: delante de una barrera lo
       que hay es el balasto café, donde el blanco es lo que más se lee (se
       probó rojo con marino y sobre el balasto quedaba oscuro sobre oscuro);
       el marco oscuro del tablero (ver TEX.rayas) la separa de la nieve. */
    c: { grava: 0xe8edf2, tierra: 0xf2f5f8, acera: 0xf0f3f6, bordillo: 0xd6dde6, muro: 0xeef1f4, arboles: [0x2e6b4a, 0x3a7d58, 0x24583c],
      edificios: [0xc9d6e3, 0xe8c9b5, 0xb8c9b0, 0xd9c2e0, 0xf2e6d8], ladrillo: 0x9c5a4a, cornisa: 0xffffff, techoTren: 0xffffff,
      pata: 0x1f2c4a, rampa: 0xff8a2a },
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
  /* Óxido: mediodía sobre una meseta roja. Cielo azul limpio arriba y tierra
     roja abajo: frío arriba y caliente abajo, nada que ver con el atardecer
     de Ocaso. Los trenes van en pátina (el verde azulado del cobre oxidado,
     el opuesto del rojo), hueso y azul tinta, las barreras en negro con
     amarillo de peligro y la rampa en cian: todo lo que se esquiva salta
     sobre lo rojo. */
  oxido: variante(BASE_COMIC, {
    cielo: { arriba: 0x2a7ac8, horizonte: 0xf2d6b0, sol: 0xffffff }, niebla: [30, 140],
    sol: [0xfff4e0, 2.6, [-16, 26, 14]], hemi: [0xbfe0ff, 0x8a3a1a, 0.75], tinta: 0x3a140a,
    c: { grava: 0xb8603a, tierra: 0xa04a2a, acera: 0xc8784a, muro: 0xa0523a, bordillo: 0x8a3a1e, riel: 0x8a5a3a, traviesa: 0x5a2a1a,
      edificios: [0x9a3a1e, 0xc8682e, 0xe0a060, 0x6a2a1a], marco: 0x4a1a0a, cornisa: 0x5a2010, vidrioEd: 0x2a3d58, arboles: [0x4a7a3a, 0x6a8a4a],
      trenes: [0x1fa08a, 0xf2ece0, 0x2a3a6a], acentos: [0xffffff, 0xffe02a, 0x3a140a], barrera: 0x1a1a1a, barrera2: 0xffe02a, rampa: 0x3ad0e0, nube: 0xffffff },
    carteles: ['AGUA', 'TALLER', 'POSADA', 'ÚLTIMA BOMBA'],
    extras: { nubes: false, disco: false, polvo: true }
  })
};
/* ---- Las estaciones nuevas y la historia (escenarios.js) ----
   Se suman Mercado de Farolillos, Cocheras, Muelle y «fin» (el alba con la
   historia; el «alba» queda limpio para City), y después cada paleta de la
   Línea 3 recibe sus grafitis, letreros y afiches. Las bases no se tocan:
   todo son copias hechas con `variante`. */
Object.assign(PALETAS, ESC.paletasNuevas({ variante, BASE_JUGUETE, BASE_COMIC, BASE_NEON, PALETAS }));
ESC.sumaHistoria(PALETAS, variante);

/* ===================================================================
   4. EL KIT DE UNA ESTACIÓN (materiales, texturas, modelos y reservas)
   =================================================================== */

let _texBrillo = null;
const texBrillo = () => (_texBrillo ||= aTextura(TEX.brillo(), { repetir: false }));

/** Hace que un material se lea mejor, tocando su shader:
    - `brillo`: le suma luz propia en su mismo color (el color del vértice y
      de la textura como luz emitida). Así un tren se ve como una masa de
      color aunque la estación esté a oscuras, en cualquier calidad (no
      depende del bloom) y sin agregar ni una luz a la escena.
    - `niebla`: la niebla le llega más tarde. El factor de niebla (0 cerca,
      1 al fondo) se eleva a esta potencia: con 2, un tren a 78 m en calidad
      baja queda a un 38 % de niebla en vez de un 61 %. Al final de la vista
      el factor sigue siendo 1, así que los objetos siguen apareciendo desde
      la niebla sin saltar a la vista de golpe.
    Los programas se distinguen por los dos números (customProgramCacheKey):
    si no, Three reusaría el shader de otro material con otros valores. */
function realza(m, brillo, niebla) {
  if (!brillo && niebla === 1) return;
  const b = brillo.toFixed(3), n = niebla.toFixed(2);
  m.onBeforeCompile = sh => {
    if (brillo) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * ${b};`);
    if (niebla !== 1) sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>',
      THREE.ShaderChunk.fog_fragment.replace('fogColor, fogFactor', `fogColor, pow( fogFactor, ${n} )`));
  };
  m.customProgramCacheKey = () => `metrorush-realce-${b}-${n}`;
}

/* La pasada del estilo cómic: dibuja la escena en su propio lienzo (con su
   profundidad) y oscurece hacia el color de tinta de la estación el borde de
   cada silueta. Un píxel es borde cuando lo que tiene al lado, a `grosor`
   píxeles, está bastante más lejos: el salto se mide en METROS y relativo a
   la propia distancia (un vecino un 15 % más lejos ya cuenta). Medido en el
   búfer de profundidad tal cual (que no es lineal) solo lo cercano tenía
   contorno; en metros, un tren, una barrera o una rampa que vienen quedan
   recortados a cualquier distancia, que es lo que más ayuda a leerlos a
   60 m/s. El suelo visto de refilón no da bordes falsos (de un píxel al
   siguiente se aleja mucho menos de un 15 %), y el contorno se apaga al
   llegar a la niebla (`lejos`), para que lo que sale de la bruma no aparezca
   con un trazo encima. La línea mide `grosor` píxeles del lienzo (1 en una
   pantalla de 1×, 2 en una de 2× o 3×), así se ve igual de gruesa en todas.
   Cuesta lo mismo que dibujar la escena más un cuadro a pantalla completa, y
   por eso se usa también en calidad baja. */
class PasadaTinta extends Pass {
  constructor(escena, camara, { tinta = 0x1a1420, fuerza = 0.85, grosor = 1 } = {}) {
    super();
    this.escena = escena; this.camara = camara; this.grosor = grosor;        // qué se dibuja, desde dónde y qué tan gruesa va la línea
    this.lienzo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });   // la escena, en luz lineal (el tono lo pone OutputPass)
    this.lienzo.depthTexture = new THREE.DepthTexture(1, 1);                   // y su profundidad, para encontrar los bordes
    this.cuadro = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },                    // la escena y su profundidad
        paso: { value: new THREE.Vector2() },                                  // cuánto es `grosor` píxeles en coordenadas de textura
        cerca: { value: 0.1 }, fondo: { value: 240 }, lejos: { value: 1e4 },   // planos de la cámara y fin de la niebla
        tinta: { value: new THREE.Color(tinta) }, fuerza: { value: fuerza }    // el color del contorno y cuánto tapa
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform vec2 paso; uniform float cerca, fondo, lejos, fuerza; uniform vec3 tinta; varying vec2 vUv;
        // del valor del búfer de profundidad (perspectiva) a metros desde la cámara
        float metros(float d) { return cerca * fondo / (fondo - (fondo - cerca) * d); }
        float prof(vec2 o) { return metros(texture2D(tDepth, vUv + o * paso).r); }
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float z = prof(vec2(0.0)), d = 0.0;                                   // la distancia de este píxel…
          d += clamp((prof(vec2(1.0, 0.0)) - z) / z, 0.0, 1.0);                 // …y cuánto más lejos están sus cuatro vecinos
          d += clamp((prof(vec2(-1.0, 0.0)) - z) / z, 0.0, 1.0);
          d += clamp((prof(vec2(0.0, 1.0)) - z) / z, 0.0, 1.0);
          d += clamp((prof(vec2(0.0, -1.0)) - z) / z, 0.0, 1.0);
          float borde = smoothstep(0.15, 0.3, d) * (1.0 - smoothstep(0.6 * lejos, lejos, z));
          gl_FragColor = vec4(mix(c.rgb, tinta, borde * fuerza), c.a);
        }`
    }));
  }
  setSize(w, h) {
    this.lienzo.setSize(w, h);                                                  // a la resolución del lienzo de verdad: nada pixelado
    this.cuadro.material.uniforms.paso.value.set(this.grosor / w, this.grosor / h);
  }
  render(renderer, writeBuffer) {
    const u = this.cuadro.material.uniforms, cam = this.camara, fog = this.escena.fog;
    u.cerca.value = cam.near; u.fondo.value = cam.far; u.lejos.value = fog ? fog.far : 1e4;   // cada cuadro: la niebla cambia con la estación y la calidad
    renderer.setRenderTarget(this.lienzo);
    renderer.render(this.escena, this.camara);                                 // la escena, una sola vez, con su profundidad
    u.tDiffuse.value = this.lienzo.texture; u.tDepth.value = this.lienzo.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (!this.renderToScreen && this.clear) renderer.clear();
    this.cuadro.render(renderer);                                              // la escena con su contorno
  }
  dispose() { this.lienzo.depthTexture?.dispose(); this.lienzo.dispose(); this.cuadro.material.dispose(); this.cuadro.dispose(); }
}

/** Lleva las coordenadas v de una geometría a la franja `i` de `n` de un atlas
    apilado de arriba abajo (con un margen, para que el filtrado no traiga el
    color de la franja vecina). Ejemplo: el letrero 2 de 5 usa v de 0,4 a 0,6. */
function franja(geo, i, n) {
  const uv = geo.attributes.uv, m = 0.02;
  for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - m) / n + uv.getY(k) * (1 - 2 * m) / n);
  return geo;
}

/** Muchos objetos iguales (árboles, faroles, postes) dibujados de una vez:
    una InstancedMesh por material del modelo. Sin esto cada farol eran tres
    llamadas al GPU; así son tres para todos los faroles de un lado.
    Uso: serie.empieza(); serie.pon(matriz) por cada uno; serie.termina(). */
class Serie {
  constructor(grupo, max = 48) {
    this.max = max; this.n = 0; this.mallas = []; this.raiz = new THREE.Group();
    grupo.traverse(m => {
      if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, max);
      im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow; im.count = 0;
      im.frustumCulled = false;                                                // la caja de la geometría base no sirve para todas las copias
      this.mallas.push(im); this.raiz.add(im);
    });
  }
  empieza() { this.n = 0; }
  pon(m) { if (this.n >= this.max) return; for (const im of this.mallas) im.setMatrixAt(this.n, m); this.n++; }
  termina() { for (const im of this.mallas) { im.count = this.n; im.instanceMatrix.needsUpdate = true; } }
}

class Kit {
  constructor(mundo, clave, pal) {
    this.mundo = mundo; this.clave = clave; this.pal = pal; this.c = pal.c;
    this.neon = pal.estilo === 'neon'; this.comic = pal.estilo === 'comic'; this.juguete = pal.estilo === 'juguete';
    this.az = azarDe(0xC17A + clave.length * 131 + clave.charCodeAt(0));   // la ciudad sale igual en cada visita
    this.mats = new Map(); this.texs = new Map(); this.lineasMat = new Map();
    this.reserva = new Map();          // tipo → objetos guardados para reusar
    this.almacen = new THREE.Group(); this.almacen.visible = false; this.almacen.name = 'almacen:' + clave;   // donde esperan los objetos guardados
    this.listo = false;
  }
  /* ---- materiales ----
     Las claves dicen qué clase de material es y, después de ":", su textura:
     plano (mate), pintura (brillante), metal, vidrio, luz (sin sombreado,
     brilla), tex:x (con textura), texmetal:x, texluz:x (textura que brilla).
     Un "!" al final ('pintura!', 'tex:rayasRB!') marca una pieza de un
     OBJETO DEL JUEGO: tren, barrera, rampa, poder, estrella o boleto. Es lo
     que hay que ver de un vistazo a 30 m/s, así que no se dibuja igual que
     la ciudad (ver `legible` en las paletas y `realza` aquí abajo). */
  mat(clave) {
    if (this.mats.has(clave)) return this.mats.get(clave);
    const juego = clave.endsWith('!');
    const [tipo, tx] = (juego ? clave.slice(0, -1) : clave).split(':');
    const map = tx ? this.tex(tx) : null;
    const basico = tipo === 'luz' || tipo === 'texluz';
    let m;
    if (basico) m = new THREE.MeshBasicMaterial({ vertexColors: true, map, transparent: tipo === 'texluz' && !!tx && tx.startsWith('graf'), alphaTest: tx && tx.startsWith('graf') ? 0.02 : 0 });
    else {
      const P = { plano: [.8, 0], pintura: [.34, .35], metal: [.28, .9], vidrio: [.06, .65], tex: [.9, 0], texmetal: [.5, .55] }[tipo] || [.8, 0];
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: P[0], metalness: P[1], map, envMapIntensity: this.pal.env,
        transparent: !!tx && tx.startsWith('graf'), alphaTest: tx && tx.startsWith('graf') ? 0.03 : 0 });
      // en neón la ciudad que no brilla es casi negra (así resaltan sus luces); los objetos del juego y las personas, no
      if (this.neon && tipo !== 'personaje' && !juego) m.color.setScalar(0.14);
    }
    /* Las personas en neón (el corredor, el inspector y el perro): la única
       luz es un cielo violeta tenue, y con eso un personaje de colores
       normales salía negro sobre el piso negro. Se les suma un brillo propio
       en sus mismos colores (el color del vértice como luz emitida), que se
       ve en cualquier calidad, con o sin bloom. A los objetos del juego les
       pasa lo mismo, con la fuerza que diga la paleta. */
    const L = this.pal.legible || {};
    const brillo = basico ? 0 : tipo === 'personaje' && this.neon ? 0.42 : juego ? (L.brillo || 0) : 0;
    realza(m, brillo, juego ? (L.niebla || 1) : 1);
    if (m.transparent) { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    this.mats.set(clave, m);
    return m;
  }
  /** El lienzo de un letrero de tienda (el color sale del texto, así es siempre el mismo). */
  lienzoCartel(texto) {
    const c = this.c;
    const k = [...texto].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const fondo = this.neon ? '#0a0418' : hexCss([0x23304a, 0xfff6e6, 0x2a6df4, 0xe8463b][k % 4]);
    const tinta = this.neon ? hexCss([0xff2bd6, 0x22e5ff, 0xffe14d, ...(c.ventanas || [])][k % 3]) : (k % 4 === 1 ? '#23304a' : '#ffffff');
    return TEX.cartel(texto, fondo, tinta, this.neon ? '700 80px Orbitron, sans-serif' : this.comic ? '92px Bangers, "Arial Black", sans-serif' : '86px "Lilita One", "Arial Black", sans-serif', this.neon);
  }
  /* ---- texturas (se dibujan una vez y se reusan) ---- */
  tex(nombre) {
    if (this.texs.has(nombre)) return this.texs.get(nombre);
    const c = this.c, az = this.az;
    const [tipo, ...arg] = nombre.split('|');
    let t;
    switch (tipo) {
      case 'grava': t = aTextura(TEX.grava(az, c.grava)); break;
      case 'gravaSuelo': t = aTextura(TEX.grava(az, c.tierra)); break;
      case 'ladrillo': t = aTextura(TEX.ladrillo(az, c.ladrillo)); break;
      case 'ruido': t = aTextura(TEX.ruido(az)); break;
      case 'acera': t = aTextura(TEX.ruido(az)); break;
      case 'muro': t = aTextura(TEX.muro(az)); break;
      case 'rejilla': t = aTextura(TEX.rejilla(), { rep: [2.5, 2.5] }); break;
      case 'rejillaNeon': t = aTextura(TEX.rejillaNeon(), { rep: [2.5, 2.5] }); break;
      // el marco del tablero: oscuro salvo que la paleta diga otro (o null, sin marco)
      case 'rayasRB': t = aTextura(TEX.rayas(c.barrera, c.barrera2, 7, c.marcoBarrera === undefined ? 0x1d2233 : c.marcoBarrera)); break;
      case 'rayasRB8': t = aTextura(TEX.rayas(c.barrera, c.barrera2, 8, c.marcoBarrera === undefined ? 0x1d2233 : c.marcoBarrera)); break;
      case 'rayasNA': t = aTextura(TEX.rayas(0x1d1f26, 0xffd23f, 6)); break;
      case 'chevron': t = aTextura(TEX.rayas(0x1d1f26, 0xffd23f, 10), { rep: [1, 1] }); break;
      case 'flecha': t = aTextura(TEX.flecha(this.neon), { repetir: false }); break;
      case 'destino': t = aTextura(TEX.destino(), { repetir: false }); break;
      case 'doble': t = aTextura(TEX.doble(), { repetir: false }); break;
      case 'caja': t = aTextura(TEX.caja(), { repetir: false }); break;
      case 'boleto': t = aTextura(TEX.boleto(), { repetir: false }); break;
      case 'faro': t = aTextura(TEX.faro(), { repetir: false }); break;         // las luces de los trenes que vienen
      case 'toldo': { const [c1, c2] = c.toldos[+arg[0] % c.toldos.length]; t = aTextura(TEX.toldo(c1, c2, this.neon ? 0.45 : 1)); break; }
      case 'cartel': t = aTextura(this.lienzoCartel(arg[0]), { repetir: false }); break;
      case 'carteles': {                                                       // todos los letreros de la paleta en una textura, uno debajo del otro
        const lista = this.pal.carteles, [cv, x] = lienzo(512, 128 * lista.length);
        lista.forEach((texto, i) => x.drawImage(this.lienzoCartel(texto), 0, i * 128));
        t = aTextura(cv, { repetir: false }); break;
      }
      case 'graf': { const g = this.pal.grafitis[+arg[0] % this.pal.grafitis.length]; t = aTextura(TEX.grafiti(az, g[0], g[1], g[2], this.neon ? 0.85 : 1), { repetir: false }); break; }
      default: t = ESC.textura(this, tipo, arg, AYUDA);                      // los afiches y los grafitis de la historia (o null)
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
  get vid() { return this.neon ? 'luz' : 'vidrio'; }

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
  /** Devuelve todo lo del kit a la tarjeta de video: geometrías, materiales y
      texturas. Se llama cuando su estación ya pasó (liberaKits). */
  libera() {
    const geos = new Set(), mats = new Set();
    const junta = o => o && o.traverse(x => {
      if (x.isSprite) { if (x.material) mats.add(x.material); return; }          // la geometría del sprite es de three.js, compartida
      if (x.isInstancedMesh) x.dispose();                                      // las matrices de las instancias
      if (x.geometry) geos.add(x.geometry);
      if (x.material) for (const m of [].concat(x.material)) mats.add(m);
    });
    for (const lista of this.reserva.values()) for (const o of lista) { junta(o); o.parent?.remove(o); }
    junta(this.almacen); this.almacen.parent?.remove(this.almacen);
    for (const o of [this.via, this.cielo, this.monedas, this.seriesRaiz]) { junta(o); o?.parent?.remove(o); }
    for (const m of this.mats.values()) mats.add(m);
    for (const m of this.lineasMat.values()) mats.add(m);
    const brillo = texBrillo();
    for (const m of mats) { if (m.map && m.map !== brillo && ![...this.texs.values()].includes(m.map)) m.map.dispose(); m.dispose(); }
    for (const t of this.texs.values()) t && t.dispose();
    for (const g of geos) g.dispose();
    this.reserva.clear(); this.mats.clear(); this.texs.clear(); this.lineasMat.clear(); this.listo = false;
  }
  /** Llena las reservas por adelantado (para que no se trabe en plena carrera).
      Devuelve una lista de pasos chicos: el mundo los va haciendo de a poco. */
  pasosDePreparacion() {
    const pasos = [];
    const pre = (tipo, fab, n) => { for (let i = 0; i < n; i++) pasos.push(() => { const o = fab(); o.visible = false; o.userData.tipoReserva = tipo; this.almacen.add(o); if (!this.reserva.has(tipo)) this.reserva.set(tipo, []); this.reserva.get(tipo).push(o); }); };
    for (let i = 0; i < 3; i++) pre('tren' + i, () => this.tren(i), 3);
    for (let i = 0; i < 3; i++) pre('trenM' + i, () => this.tren(i, true), 1);   // los que vienen de frente (con los focos encendidos)
    pre('rampa', () => this.rampa(), 3); pre('bajo', () => this.barreraBaja(), 5); pre('alto', () => this.barreraAlta(), 5);
    for (const lado of [-1, 1]) {
      pre('edificio' + lado, () => this.edificio(lado), 7); pre('graf' + lado, () => this.grafiti(lado), 3);
    }
    ESC.preparaKit(this, pre, AYUDA);                                         // los afiches y los grafitis de la historia (si la paleta tiene)
    pasos.push(() => {                                                         // árboles, faroles y postes: instancias
      const libres = []; const serie = (g, max) => { const s = new Serie(g, max); libres.push(s); return s; };
      this.series = {
        // en neón no hay árboles, salvo que la estación traiga su utilería (el Muelle: bitas, cajas, faroles)
        arbol: this.neon && !this.pal.props && !this.pal.arbolesNeon ? [] : [0, 1, 2].map(() => { const g = this.arbol(); g.scale.setScalar(1); return serie(g, 40); }),   // tres árboles distintos, cada uno muchas veces (en neón no hay)
        farol: { [-1]: serie(this.farol(-1, true), 24), [1]: serie(this.farol(1, true), 24) },
        poste: { [-1]: serie(this.poste(-1, true), 14), [1]: serie(this.poste(1, true), 14) }
      };
      this.listaSeries = libres;
      this.seriesRaiz = new THREE.Group(); this.seriesRaiz.name = 'series:' + this.clave; for (const s of libres) this.seriesRaiz.add(s.raiz);
    });
    for (const cl of ['iman', 'mochila', 'zapatillas', 'doble', 'caja']) pre('poder-' + cl, () => this.poder(cl), 1);
    pre('estrella', () => this.estrella(), 2); pre('boleto', () => this.boleto(), 1);
    if (this.pasosCity) this.pasosCity(pre);                                   // CITY: las reservas de los objetos de City (mundo-city.js)
    pasos.push(() => { this.via = this.armaVia(); this.cielo = this.armaCielo(); this.monedas = this.armaMonedas(); this.via.name = 'via:' + this.clave; this.cielo.name = 'cielo:' + this.clave; this.listo = true; });
    return pasos;
  }

  /* ---- modelos ---- */

  /** Un vagón de metro. El perfil (paredes rectas, techo redondeado) se extruye a lo largo.
      Todas sus piezas llevan "!" (objeto del juego, ver `mat`): con poca luz
      el cuerpo brilla en su color en vez de quedar negro.

      `marcha` = un tren que VIENE DE FRENTE. Antes era el mismo modelo que
      uno detenido y, como se mira desde atrás y arriba, nadie notaba que
      venía hacia ti hasta tenerlo encima. Ahora se distinguen como en la
      vida real, donde adelante van luces blancas y atrás rojas:
      - detenido: focos apagados (vidrio oscuro) y las luces rojas de cola;
      - en marcha: focos blancos grandes, una franja de luz bajo el
        parabrisas, sin rojo, y además un brillo (`faro`): un halo en cada
        foco y un charco de luz en la vía delante de él, que se ve desde
        lejos, atraviesa la niebla y crece en tus pies cuando se acerca.
      El brillo es una sola malla con una sola textura (TEX.faro): una
      llamada al GPU más por tren en marcha, nada en los detenidos. */
  tren(i, marcha = false) {
    const c = this.c, a = new Arma(this), col = c.trenes[i % 3], ac = c.acentos[i % 3], L = L_VAGON - 0.3;
    const vid = this.vid + '!';
    /* En neón el contorno brillante ya no puede ser del color del cuerpo:
       con el cuerpo encendido en ese mismo color, el borde se perdía en él.
       Va casi blanco (el color del tren aclarado), que es lo que dibuja la
       silueta del vagón contra la ciudad oscura. */
    const borde = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.6).getHex();
    a.pon(geoTren(L), 'pintura!', col, [0, 0, 0], null, 1, borde);
    a.pon(CAJA, 'plano!', c.bajo, [0, 0.36, 0], null, [1.75, 0.34, L - 0.6]);
    for (const zb of [-3.7, 3.7]) {
      a.pon(CAJA, 'plano!', c.bajo, [0, 0.32, zb], null, [1.5, 0.22, 2]);
      for (const s of [-1, 1]) for (const zr of [-0.62, 0.62]) a.pon(CILINDRO, 'metal!', 0x2a2d33, [s * 0.6, 0.3, zb + zr], [0, 0, Math.PI / 2], [0.5, 0.12, 0.5]);
    }
    const puerta = new THREE.Color(col).multiplyScalar(0.8).getHex();
    for (const s of [-1, 1]) {
      a.pon(CAJA, vid, c.vidrio, [s * 1.02, 2.2, 0], null, [0.03, 0.85, L - 1.4]);                    // la franja de ventanas
      for (let k = -3; k <= 3; k++) a.pon(CAJA, 'pintura!', col, [s * 1.035, 2.2, k * 1.45], null, [0.04, 0.86, 0.15]);   // pilares
      for (const zp of [-2.6, 2.6]) {
        a.pon(CAJA, 'pintura!', puerta, [s * 1.03, 1.62, zp], null, [0.03, 2.3, 1.35]);                // puertas
        for (const dz of [-0.33, 0.33]) a.pon(CAJA, vid, c.vidrio, [s * 1.045, 2.15, zp + dz], null, [0.035, 0.9, 0.5]);
        a.pon(CAJA, 'plano!', 0x22262c, [s * 1.05, 1.62, zp], null, [0.04, 2.3, 0.025]);
      }
      a.pon(CAJA, this.neon ? 'luz!' : 'plano!', ac, [s * 1.03, 1.45, 0], null, [0.03, 0.16, L]);    // franja de color
      a.pon(new THREE.PlaneGeometry(4.2, 1.2), (this.neon ? 'texluz:graf|' : 'tex:graf|') + ((i + (s > 0 ? 1 : 0)) % 9) + '!', 0xffffff, [s * 1.045, 0.92, -0.2], [0, s * Math.PI / 2, 0]);
    }
    const zf = L / 2 + 0.16;                                                                          // el frente
    a.pon(redonda(1.55, 0.95, 0.08, 0.06), vid, c.vidrio, [0, 2.3, zf]);
    a.pon(new THREE.PlaneGeometry(1.15, 0.24), 'texluz:destino!', 0xffffff, [0, 2.95, zf + 0.012]);
    for (const s of [-1, 1]) {
      if (marcha) a.pon(CILINDRO, 'luz!', 0xffffff, [s * 0.62, 0.98, zf + 0.02], [Math.PI / 2, 0, 0], [0.36, 0.07, 0.36]);   // foco encendido, más grande
      else {
        a.pon(CILINDRO, 'plano!', 0x3a3f49, [s * 0.62, 0.98, zf + 0.01], [Math.PI / 2, 0, 0], [0.26, 0.06, 0.26]);       // foco apagado
        a.pon(redonda(0.18, 0.1, 0.04, 0.02), 'luz!', 0xff3030, [s * 0.62, 0.72, zf + 0.01]);                           // la luz roja de cola
      }
    }
    if (marcha) a.pon(CAJA, 'luz!', 0xfff6dc, [0, 1.72, zf + 0.03], null, [1.3, 0.08, 0.03]);   // la franja de luz bajo el parabrisas
    a.pon(redonda(1.85, 0.3, 0.26, 0.1), 'plano!', c.bajo, [0, 0.5, zf]);
    // los equipos del techo, del mismo material que el cuerpo: desde la cámara (atrás y arriba) el techo es lo que más se ve de un tren
    for (const za of [-2.8, 2.8]) a.pon(redonda(1.0, 0.26, 1.7, 0.1), 'pintura!', c.techoTren, [0, 3.32, za]);
    const g = a.hecho();
    if (marcha) {
      /* El brillo de los focos. Cada tren en marcha tiene su propio material
         (comparten el programa del GPU), porque su opacidad cambia sola:
         aparece de a poco desde el fondo y late si viene por tu carril (ver
         `paso`). Sin niebla, a propósito: las luces atraviesan la niebla
         antes que el tren, que es justo lo que avisa de lejos. */
      // blanco frío de noche, cálido de día y al atardecer; de día más fuerte (una luz que se suma a un fondo claro se nota menos)
      const luz = new THREE.Color(this.neon ? 0xdcefff : 0xfff0c8).multiplyScalar(this.neon ? 0.85 : 1.6);
      const mat = new THREE.MeshBasicMaterial({ map: this.tex('faro'), color: luz, vertexColors: true, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const faro = new THREE.Mesh(this._geoFaro ||= geoFaro(zf), mat);
      faro.castShadow = faro.receiveShadow = false; faro.renderOrder = 2;
      g.add(faro); g.userData.faro = faro;
    }
    return g;
  }
  /** La rampa: una cuña de rejilla con bordes de cinta de peligro. Su origen es el pie (z=0) y sube hacia −z.
      En neón era 'plano' (casi negra) y solo la delataban sus aristas cian:
      delante de un tren oscuro no se veía dónde empezaba la subida. Ahora es
      una rejilla que brilla en el color de rampa de la paleta, con las
      aristas en otro color (`rampaBorde`) para que no se fundan con ella.
      En las demás estaciones es mate ('tex', no 'texmetal'): el metal
      reflejaba el cielo y oscurecía el color justo en la cara que se ve. */
  rampa() {
    const largo = MOTOR.LARGO_RAMPA, alto = TECHO, a = new Arma(this), c = this.c;
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(largo, 0); s.lineTo(largo, alto); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-0.9, 0, 0);
    a.pon(geo, this.neon ? 'texluz:rejillaNeon!' : 'tex:rejilla!', c.rampa, [0, 0, 0], null, 1, c.rampaBorde || 0x22e5ff);
    const ang = Math.atan2(alto, largo), lg = Math.hypot(largo, alto);
    for (const sx of [-0.84, 0.84]) a.pon(CAJA, this.neon ? 'texluz:chevron!' : 'tex:chevron!', 0xffffff, [sx, alto / 2 + 0.04, -largo / 2], [ang, 0, 0], [0.14, 0.05, lg]);
    return a.hecho();
  }
  /** La barrera baja (se salta): un caballete a la altura de la cintura. */
  barreraBaja() {
    const c = this.c, a = new Arma(this);
    a.pon(CAJA, this.neon ? 'texluz:rayasRB!' : 'tex:rayasRB!', 0xffffff, [0, 0.72, 0], null, [1.9, 0.3, 0.08], c.barrera);
    // las patas, del color de la paleta (en Invierno, blancas sobre la nieve no se veían)
    for (const s of [-1, 1]) for (const k of [-1, 1]) a.pon(CAJA, 'plano!', c.pata || 0xe8e8e8, [s * 0.82, 0.42, k * 0.13], [k * 0.28, 0, 0], [0.07, 0.86, 0.07]);
    a.pon(CILINDRO_CHICO, 'plano!', 0x222222, [-0.6, 0.91, 0], null, [0.13, 0.08, 0.13]);
    a.pon(ESFERA, 'luz!', c.ambar, [-0.6, 0.98, 0], null, 0.14);
    const g = a.hecho();
    if (this.neon) g.add(sprite(c.ambar, 1.2, [-0.6, 0.98, 0.05]));
    return g;
  }
  /** La barrera alta (se pasa rodando): un letrero de la cintura a la cabeza, con una flecha hacia abajo. */
  barreraAlta() {
    const c = this.c, a = new Arma(this);
    for (const s of [-1, 1]) a.pon(CILINDRO, this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [s * 0.9, 1.125, 0], null, [0.14, 2.25, 0.14], 0xffe14d);
    a.pon(redonda(1.95, 0.9, 0.1, 0.04), this.neon ? 'texluz:rayasRB8!' : 'tex:rayasRB8!', 0xffffff, [0, 1.32, 0], null, 1, c.barrera);
    a.pon(new THREE.CircleGeometry(0.34, 32), this.neon ? 'texluz:flecha!' : 'tex:flecha!', 0xffffff, [0, 1.32, 0.056]);
    for (const s of [-1, 1]) a.pon(ESFERA, 'luz!', c.ambar, [s * 0.9, 2.32, 0], null, 0.18);
    const g = a.hecho();
    if (this.neon) for (const s of [-1, 1]) g.add(sprite(c.ambar, 1.4, [s * 0.9, 2.32, 0.05]));
    return g;
  }
  /** Los poderes que flotan: cada uno con su forma y un aro de luz debajo.
      Como objetos del juego ("!"): en neón su cuerpo ya no queda casi negro
      dentro del halo, se ve el imán rojo, la mochila, las zapatillas. */
  poder(clase) {
    if (this.poderCity) { const g = this.poderCity(clase); if (g) return g; }   // CITY: el chicle, la batería y las monedas ×2 (mundo-city.js)
    const c = this.c, a = new Arma(this), g0 = new THREE.Group();
    const anillo = { iman: 0xff5a5a, mochila: 0xffb02e, zapatillas: 0x6aff8a, doble: 0x5fb0ff, caja: 0xffd23f }[clase];
    if (clase === 'iman') {
      a.pon(new THREE.TorusGeometry(0.32, 0.12, 12, 24, Math.PI), 'pintura!', c.iman, [0, 0.1, 0]);
      for (const s of [-1, 1]) { a.pon(CILINDRO, 'pintura!', c.iman, [s * 0.32, -0.05, 0], null, [0.24, 0.3, 0.24]); a.pon(CILINDRO, 'metal!', c.cromo, [s * 0.32, -0.3, 0], null, [0.25, 0.2, 0.25]); }
    } else if (clase === 'mochila') {
      for (const s of [-1, 1]) { a.pon(CILINDRO, 'pintura!', 0xe8463b, [s * 0.16, 0, 0], null, [0.24, 0.6, 0.24]); a.pon(new THREE.ConeGeometry(0.12, 0.2, 14), 'pintura!', 0xffd23f, [s * 0.16, 0.4, 0]); a.pon(new THREE.ConeGeometry(0.1, 0.18, 12), 'luz!', 0xffa424, [s * 0.16, -0.38, 0], [Math.PI, 0, 0]); }
      a.pon(redonda(0.5, 0.36, 0.12, 0.04), 'plano!', 0x2a2d33, [0, 0.05, -0.14]);
    } else if (clase === 'zapatillas') {
      a.pon(redonda(0.34, 0.24, 0.6, 0.1), 'pintura!', 0x3ad16a, [0, 0, 0]);
      a.pon(redonda(0.36, 0.08, 0.64, 0.03), 'plano!', 0xffffff, [0, -0.14, 0]);
      for (const s of [-1, 1]) a.pon(CAJA, 'plano!', 0xffffff, [s * 0.24, 0.12, 0.12], [0.3, 0, s * 0.6], [0.04, 0.3, 0.4]);
    } else if (clase === 'doble') {
      a.pon(CILINDRO, 'pintura!', 0x1d4fd6, [0, 0, 0], [Math.PI / 2, 0, 0], [0.8, 0.12, 0.8]);
      for (const s of [-1, 1]) a.pon(new THREE.CircleGeometry(0.36, 32), 'texluz:doble!', 0xffffff, [0, 0, s * 0.065], [0, s > 0 ? 0 : Math.PI, 0]);
      a.pon(new THREE.TorusGeometry(0.4, 0.04, 8, 32), 'metal!', c.oro, [0, 0, 0]);
    } else {
      a.pon(CAJA, this.neon ? 'texluz:caja!' : 'tex:caja!', 0xffffff, [0, 0, 0], null, 0.62);
    }
    const cuerpo = a.hecho(false);
    cuerpo.name = 'cuerpo';
    g0.add(cuerpo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 40), this.mat('luz!'));
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
    a.pon(geo, this.neon ? 'luz!' : 'metal!', this.c.oro);
    const g = new THREE.Group(), cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g.add(cuerpo);
    if (this.neon) g.add(sprite(this.c.oro, 2, [0, 0, 0], 0.8));
    return g;
  }
  /** El boleto dorado (un trozo de la historia). */
  boleto() {
    const a = new Arma(this);
    a.pon(CAJA, 'texluz:boleto!', 0xffffff, [0, 0, 0], null, [0.9, 0.45, 0.03]);
    const g = new THREE.Group(), cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g.add(cuerpo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 40), this.mat('luz!'));
    aro.geometry = prepara(aro.geometry, 0xffe066); aro.rotation.x = Math.PI / 2; aro.position.y = -0.9; g.add(aro);
    if (this.neon) g.add(sprite(0xffe066, 3, [0, 0, 0], 0.9));
    return g;
  }
  /** Un edificio para el costado `lado` (−1 izquierda, 1 derecha). Su origen es el centro de la base. */
  /** Una cuadra: dos o tres edificios seguidos en una sola pieza (un toldo
      del mismo color para toda la cuadra y los letreros en un atlas). Cada
      edificio suelto eran ~7 llamadas al GPU, una por material; la cuadra
      entera usa casi los mismos materiales, así que cuesta lo de uno. */
  edificio(lado) {
    if (this.pal.distrito && this.cuadraCity) return this.cuadraCity(lado);   // CITY: los distritos tienen sus propias cuadras (mundo-city.js)
    const az = this.az, a = new Arma(this), n = az() < 0.65 ? 3 : 2;
    const toldo = Math.floor(az() * this.c.toldos.length);
    const partes = [];
    let z = 0;
    for (let i = 0; i < n; i++) {
      const sub = { pon: null }, inicio = z;
      const p = this.unEdificio(sub, lado, toldo);
      partes.push({ p, inicio });
      z += p.d + 0.8 + az() * 1.6;
    }
    const L = z - 0.8;                                                         // el largo de la cuadra (sin el último hueco)
    for (const { p, inicio } of partes) {                                      // cada edificio con la fachada en x = 0 y en su tramo de la cuadra
      const ox = lado * p.w / 2, oz = -L / 2 + inicio + p.d / 2;
      for (const [geo, clave, col, pos, rot, esc, borde] of p.piezas) a.pon(geo, clave, col, [pos[0] + ox, pos[1], pos[2] + oz], rot, esc, borde);
    }
    const g = a.hecho();
    g.userData.largo = L / 2; g.userData.ancho = 0;
    return g;
  }
  /** Un edificio: anota sus piezas (no las arma) para que la cuadra las ponga en su lugar. */
  unEdificio(sub, lado, toldoCuadra) {
    const c = this.c, az = this.az, piezas = [], a = { pon: (...x) => { piezas.push(x); return a; } };
    const pisos = this.neon ? 3 + Math.floor(az() * 5) : 2 + Math.floor(az() * 4);
    const w = 5 + az() * 3, d = 6 + az() * 4.5, PISO = 3, h = pisos * PISO + 0.6;
    const fx = -lado * (w / 2);                                                // la fachada que mira a la vía
    const ladrillo = this.juguete && az() < c.probLadrillo;
    const cuerpo = uvMundo(new THREE.BoxGeometry(w, h, d), ladrillo ? 2.4 : 6, h / 2);
    a.pon(cuerpo, ladrillo ? 'tex:ladrillo' : this.juguete ? 'tex:ruido' : 'plano', ladrillo ? 0xffffff : c.edificios[Math.floor(az() * c.edificios.length)], [0, h / 2, 0], null, 1,
      this.neon ? c.edificios[Math.floor(az() * c.edificios.length)] : null);
    a.pon(CAJA, this.neon ? 'luz' : 'plano', c.cornisa, [0, h + 0.05, 0], null, [w + 0.3, 0.35, d + 0.3]);
    a.pon(CAJA, 'plano', c.cornisa, [0, PISO + 0.35, 0], null, [w + 0.12, 0.25, d + 0.12]);
    // planta baja: vitrina, marco, puerta, toldo y letrero
    a.pon(CAJA, this.juguete ? 'vidrio' : 'luz', c.vitrina, [fx, 1.3, -d * 0.1], null, [0.08, 1.9, d * 0.5]);
    a.pon(CAJA, 'plano', c.marco, [fx - lado * 0.02, 2.3, -d * 0.1], null, [0.1, 0.12, d * 0.5 + 0.2]);
    a.pon(CAJA, this.neon ? 'luz' : 'plano', this.neon ? 0x22e5ff : 0x5a3b2c, [fx, 1.1, d * 0.32], null, [0.1, 2.2, 1.0]);
    const toldo = uvMundo(new THREE.BoxGeometry(1.1, 0.08, d * 0.62), 1);
    a.pon(toldo, (this.neon ? 'texluz:toldo|' : 'tex:toldo|') + toldoCuadra, 0xffffff, [fx - lado * 0.5, 2.85, -d * 0.1], [0, 0, lado * 0.32]);
    const nc = this.pal.carteles.length, ic = Math.floor(az() * nc);
    a.pon(franja(new THREE.PlaneGeometry(Math.min(d * 0.55, 4), 0.75), ic, nc), this.neon ? 'texluz:carteles' : 'tex:carteles', 0xffffff, [fx - lado * 0.06, 3.55, -d * 0.1], [0, -lado * Math.PI / 2, 0]);
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
    return { piezas, w, d };
  }
  /** Un árbol low-poly: tronco y tres copas facetadas. */
  arbol() {
    if (this.pal.distrito && this.arbolCity) { const g = this.arbolCity(); if (g) return g; }   // CITY: palmeras en el bulevar (mundo-city.js)
    const prop = ESC.prop(this, AYUDA); if (prop) return prop;               // una estación nueva pone su utilería (puestos, bidones, bitas) en vez de árboles
    const c = this.c, az = this.az, a = new Arma(this);
    a.pon(new THREE.CylinderGeometry(0.11, 0.17, 1.7, 8), 'plano', c.tronco, [0, 0.85, 0]);
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.IcosahedronGeometry(0.85 + az() * 0.3, 1);
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
  /** Un color de luz del decorado, atenuado según la paleta (`legible.decorado`).
      Los postes de luz de neón, a todo color, eran lo más brillante de la
      pantalla y los ojos se iban a ellos en vez de a los obstáculos. */
  tenue(col) { return new THREE.Color(col).multiplyScalar(this.pal.legible?.decorado ?? 1).getHex(); }
  /** Un farol de la vereda, con el brazo hacia la vía. */
  farol(lado, enSerie = false) {
    const c = this.c, a = new Arma(this);
    // instanciado en neón: el poste es un tubo de luz (las líneas de borde y el halo no se pueden instanciar)
    if (enSerie && this.neon) a.pon(CILINDRO_CHICO, 'luz', this.tenue(c.tubo || 0xff2bd6), [0, 2.3, 0], null, [0.1, 4.6, 0.1]);
    else a.pon(CILINDRO_CHICO, 'metal', c.poste, [0, 2.3, 0], null, [0.14, 4.6, 0.14], 0xff2bd6);
    a.pon(CAJA, 'metal', c.poste, [-lado * 0.42, 4.6, 0], null, [0.9, 0.08, 0.1]);
    a.pon(redonda(0.5, 0.16, 0.3, 0.06), 'plano', c.poste, [-lado * 0.82, 4.52, 0]);
    a.pon(CAJA, 'luz', c.farol, [-lado * 0.82, 4.43, 0], null, [0.4, 0.04, 0.22]);
    const g = a.hecho();
    if (this.neon && !enSerie) g.add(sprite(c.farol, 3.2, [-lado * 0.82, 4.35, 0], 0.9));
    return g;
  }
  /** Un poste de catenaria, con su brazo sobre la vía. */
  poste(lado, enSerie = false) {
    const c = this.c, a = new Arma(this), mat = enSerie && this.neon ? 'luz' : 'metal';
    const col = enSerie && this.neon ? this.tenue(c.catenaria) : c.catenaria;     // en neón es un tubo de luz: atenuado, como los faroles
    a.pon(CAJA, mat, col, [0, ALTO_POSTE / 2, 0], null, [0.2, ALTO_POSTE, 0.2], enSerie ? null : c.catenaria);
    a.pon(CAJA, mat, col, [-lado * 1.72, ALTO_BRAZO, 0], null, [3.45, 0.12, 0.12], enSerie ? null : c.catenaria);
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
      tira(uvMundo(new THREE.BoxGeometry(240, 0.02, LARGO), 2), 'tex:gravaSuelo', 0xffffff, [0, -0.01, ZC], 2, 'v');
      for (const x of CARRILES) tira(uvMundo(new THREE.BoxGeometry(2.0, SUELO, LARGO), 2), 'tex:grava', 0xffffff, [x, SUELO / 2, ZC], 2, 'v');
    }
    /* durmientes: una sola InstancedMesh que se corre de a un paso.
       En neón no hay balasto: lo único que dice dónde está cada carril son
       los durmientes (los seis rieles brillan igual y están casi a la misma
       distancia, así que por sí solos no se agrupan de a dos). A 0,35 de su
       color eran casi negros; a 0,75 cada carril se lee como una escalera
       violeta entre franjas negras. */
    const paso = 0.72, n = Math.ceil(LARGO / paso);
    const geoT = prepara(CAJA, c.traviesa, matriz([0, 0, 0], null, [1.9, 0.09, 0.24]));
    const trav = new THREE.InstancedMesh(geoT, this.neon ? this.mat('luz') : this.mat('plano'), n * 3);
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let i = 0;
    for (const x of CARRILES) for (let k = 0; k < n; k++) {
      m4.makeTranslation(x, this.neon ? 0.05 : SUELO + 0.045, 30 - k * paso); trav.setMatrixAt(i, m4);
      trav.setColorAt(i, col.setScalar(this.neon ? 0.75 : 0.88 + this.az() * 0.12)); i++;
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
      tira(uvMundo(new THREE.BoxGeometry(0.3, 1.15, LARGO), 4, 0), this.neon ? 'plano' : 'tex:muro', c.muro, [xm, 0.575, ZC], 4, 'u');
      tira(CAJA.clone().scale(0.42, 0.12, LARGO), this.neon ? 'luz' : 'plano', this.neon ? new THREE.Color(c.bordillo).multiplyScalar(0.45).getHex() : c.bordillo, [xm, 1.21, ZC]);
      tira(uvMundo(new THREE.BoxGeometry(2.6, 0.14, LARGO), 3), this.neon ? 'plano' : 'tex:acera', c.acera, [lado * 5.17, 0.07, ZC], 3, 'v');
    }
    /* Cables de la catenaria. Van sobre
       los espacios ENTRE las vías, no sobre el centro de cada una: arriba de
       un tren la cámara sube por encima de los cables, y el que iba justo
       sobre tu carril cruzaba al corredor de arriba abajo, como una franja
       negra que lo tapaba. En neón son líneas de un píxel y siguen arriba
       de cada vía (no tapan nada). */
    const entreVias = CARRILES[1] - CARRILES[0];                              // 2,2 m de un carril al otro
    const xCables = this.neon ? CARRILES : [-1.5 * entreVias, -0.5 * entreVias, 0.5 * entreVias, 1.5 * entreVias];
    for (const x of xCables) {
      if (this.neon) {
        const lg = new LineSegmentsGeometry(); lg.setPositions([x, ALTO_CABLE, 30, x, ALTO_CABLE, -260]);
        const lm = new LineMaterial({ color: 0xff7ae0, linewidth: 1.1, worldUnits: false }); lm.resolution.copy(this.mundo.resolucion);
        const l = new LineSegments2(lg, lm); l.frustumCulled = false; g.add(l); this.lineasMat.set('cable' + x, lm);
      } else tira(CILINDRO_CHICO.clone().rotateX(Math.PI / 2).scale(0.028, 0.028, LARGO), 'metal', 0x2a2f36, [x, ALTO_CABLE, ZC]);
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
  /** El cielo: un domo con degradado y brillo del sol, más nubes, disco de sol, sol synthwave o estrellas. */
  armaCielo() {
    const pal = this.pal, g = new THREE.Group();
    const sd = pal.sol ? new THREE.Vector3(...pal.sol[2]).normalize() : new THREE.Vector3(0, 0.05, -1).normalize();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { arriba: { value: color(pal.cielo.arriba) }, horizonte: { value: color(pal.cielo.horizonte) }, solCol: { value: color(pal.cielo.sol) }, solDir: { value: sd }, pasos: { value: 0 } },
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
      // las 49 bolitas de las siete nubes van fundidas en una sola malla (eran 49 llamadas al GPU)
      const mn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: pal.c.nube, emissiveIntensity: 0.3, fog: false });
      const geoN = new THREE.SphereGeometry(1, 14, 10), bolitas = [];
      for (let i = 0; i < 7; i++) {
        const cx = -36 + i * 12 + az() * 6, cy = 15 + az() * 7, cz = -120 - az() * 25;
        for (let k = 0; k < 7; k++) bolitas.push(prepara(geoN, pal.c.nube, matriz([cx + (k - 3) * 1.3, cy + Math.sin(k * 1.3) * 0.5 + (k % 3 === 0 ? 0.8 : 0), cz + az()], null, 1.3 + az() * 1.1)));
      }
      g.add(new THREE.Mesh(funde(bolitas), mn)); geoN.dispose();
    }
    if (pal.extras.disco) { const d = new THREE.Mesh(new THREE.CircleGeometry(11, 24), new THREE.MeshBasicMaterial({ color: pal.cielo.sol, fog: false })); d.position.set(-8, 7, -170); g.add(d); }
    if (pal.extras.synth) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshBasicMaterial({ map: aTextura(TEX.solSynth(...pal.extras.synth), { repetir: false }), transparent: true, fog: false, depthWrite: false }));
      s.position.set(0, 7, -165); s.renderOrder = -1; g.add(s);
    }
    if (pal.extras.estrellas) {
      const est = [];
      for (let i = 0; i < 380; i++) est.push((az() - .5) * 360, 8 + az() * 110, -175);
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(est, 3)); normalesFijas(ge);
      g.add(new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
    }
    ESC.cielo(this, g, AYUDA);                                                // el horizonte de las estaciones nuevas (tejados, galpones, grúas y faro)
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
        : new THREE.MeshStandardMaterial({ color: this.c.oro, roughness: 0.22, metalness: 1, emissive: 0x3a2500, envMapIntensity: 1.2 });
    realza(mat, 0, this.pal.legible?.niebla || 1);                             // las monedas también son del juego: la niebla les llega más tarde
    const im = new THREE.InstancedMesh(geo, mat, 400);
    im.count = 0; im.castShadow = true; im.frustumCulled = false;
    return im;
  }
}

/* ===================================================================
   CITY: los ganchos del mundo City (mundo-city.js)
   ===================================================================
   El dibujo de City (los cinco distritos, sus objetos, los rasgos de sus
   personajes, la burbuja del chicle) vive en mundo-city.js, que importa este
   módulo, le agrega lo suyo a PALETAS y al Kit, y llena GANCHOS. Así este
   archivo solo lleva unas pocas líneas marcadas «CITY:» en los lugares donde
   se pregunta por un gancho, y sin City cargado nada cambia.
   `piezas` son las herramientas internas que mundo-city.js necesita (no hay
   otra forma de compartirlas entre módulos que exportarlas). */
export const GANCHOS = {
  paleta: null,      // (clave) → una paleta que no está en PALETAS (las de City con otro estilo: 'muelles@neon'), o null
  objeto: null,      // (kit, o) → el dibujo de un objeto de la pista de City (cajón, dron…), o null si no es suyo
  viste: null,       // (partes del corredor, kit, apariencia, pelo) → agrega los rasgos de un personaje de City
  crea: null         // ({escena}) → los efectos de City en la escena (la burbuja, los trozos): {paso(e, corredor), …}
};
export const piezas = {
  Kit, Arma, Serie, CAJA, CILINDRO, CILINDRO_CHICO, ESFERA, redonda, prepara, funde, matriz, uvMundo, franja, sprite, texBrillo,
  variante, BASE_JUGUETE, BASE_COMIC, BASE_NEON, TEX, aTextura, lienzo, hexCss, azarDe, SUELO, CARRILES, TECHO, L_VAGON
};

/** Tiñe (o devuelve a su oro) el material de las monedas: en el modo «Sin
    monedas» tocarlas mata, así que tienen que leerse como peligro de un
    vistazo, rojas y con brillo propio (el neón no tiene `emissive`: con el
    color basta, porque su material ya es plano y brillante). */
function tiñeMonedas(mat, rojas) {
  if (mat.userData.oro == null) { mat.userData.oro = mat.color.getHex(); mat.userData.emis = mat.emissive ? mat.emissive.getHex() : null; }
  mat.color.setHex(rojas ? 0xff2b2b : mat.userData.oro);
  if (mat.emissive) mat.emissive.setHex(rojas ? 0x8a0000 : mat.userData.emis);
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
/** La geometría del brillo de un tren que viene (ver `Kit.tren`), con su
    frente en z = `zf` mirando hacia +z (hacia el corredor). Son cuadros
    planos que usan las dos mitades de TEX.faro:
    - un halo en cada foco y un resplandor grande y tenue entre los dos (lo
      que se ve de lejos, cuando el tren todavía es un punto);
    - el charco de luz sobre la vía: de 3,1 m de ancho y 14 m hacia
      adelante, fuerte junto al tren, apagándose lejos de él.
    El color de cada vértice es su intensidad (con mezcla aditiva, negro no
    suma nada). Ejemplo: el charco va a 0,65 y los halos a 1. */
function geoFaro(zf) {
  const pos = [], uv = [], col = [];
  /** Un cuadro con esquinas a, b, c, d (en orden), su rango de uv y su intensidad k. */
  const cuadro = (a, b, c, d, u0, u1, v0, v1, k) => {
    const P = [a, b, c, d], U = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...P[i]); uv.push(...U[i]); col.push(k, k, k); }
  };
  const HALO = [0.004, 0.496], HAZ = [0.504, 0.996];                         // las dos mitades de la textura (con un margen entre ellas)
  const halo = (x, y, z, r, k) => cuadro([x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], [x - r, y + r, z], HALO[0], HALO[1], 0, 1, k);
  for (const s of [-1, 1]) halo(s * 0.62, 0.98, zf + 0.25, 1.05, 1);          // un halo por foco
  halo(0, 1.25, zf + 0.3, 2.4, 0.3);                                         // el resplandor de los dos juntos
  // el charco: v = 1 junto al tren (lo fuerte del haz) y v = 0 a 14 m (se apaga); va justo sobre los rieles
  const y = 0.32, z0 = zf - 0.3, z1 = zf + 14;
  cuadro([-1.55, y, z1], [1.55, y, z1], [1.55, y, z0], [-1.55, y, z0], HAZ[0], HAZ[1], 0, 1, 0.65);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  /* Normales aunque el material no las use: la oclusión ambiental (SAO, en
     calidad alta) vuelve a dibujar cada malla con un material de normales, y
     sin ellas salían valores inválidos que el bloom esparcía en cuadros negros
     sobre el tren que venía. */
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
/** Una normal fija (hacia arriba) en cada punto de una nube de partículas: la
    oclusión ambiental (SAO, calidad alta) dibuja todo con un material de
    normales, y sin ellas salían valores inválidos (cuadros negros en el bloom). */
function normalesFijas(g) {
  const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a[i * 3 + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(a, 3));
}
/** Una mancha de luz (sprite) para el neón. */
function sprite(col, escala, pos, opacidad = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacidad }));
  s.scale.setScalar(escala); s.position.set(pos[0], pos[1], pos[2]);
  return s;
}

/* Las ayudas de este archivo que usa escenarios.js (afiches, utilería,
   horizonte, sucesos). Se le pasan en vez de copiarse allá: así una pieza
   nueva se arma, se funde y se libera igual que las de aquí. */
const AYUDA = { Arma, CAJA, CILINDRO, CILINDRO_CHICO, ESFERA, prepara, funde, matriz, lienzo, aTextura, TEX, sprite, normalesFijas, geoTren, azarDe, SUELO, L_VAGON };

/* ===================================================================
   5. EL CORREDOR, EL INSPECTOR Y SU PERRO
   =================================================================== */

/* --- Los rasgos de las corredoras (ronda 2) ---
   Los aspectos de siempre son el mismo muñeco con otra ropa. Las corredoras
   nuevas (Paloma, Trini, Luz, Maite y Kiara, en `MOTOR.ASPECTOS`) traen además
   `rasgos`, que cambian la silueta, que es lo que se reconoce de espaldas
   corriendo, que es como se las ve casi siempre:
   - pelo: el color (las cejas lo siguen);
   - peinado: 'coleta' (cola de caballo alta), 'trenzas' (dos, a los lados),
     'larga' (melena hasta los omóplatos), 'monos' (dos moños) o
     'afro' (una nube redonda alrededor de la cabeza: no cuelga ni se mece);
   - piel: un tono de piel propio (opcional; sin él, el de siempre);
   - tocado: 'cintillo' o 'boina', en el color `gorra` del aspecto (sin
     tocado, `gorra` no se usa: no llevan gorra, llevan el pelo);
   - falda: un color, o nada: una falda acampanada colgada de la cadera
     (con el color de la sudadera es un vestido);
   - lentes y aros: redondos y dorados.
   Todo es de piezas fundidas como el resto del corredor (una llamada al GPU
   por material). El pelo que cuelga (coleta, trenzas, melena) y la falda
   cuelgan de articulaciones propias que `mueveRasgos` mece al correr, se
   levantan al caer de un salto y se quedan quietas en el aire del pogo. */
/** Agrega los rasgos de `asp.rasgos` a un corredor a medio armar. Devuelve sus articulaciones. */
function armaRasgos(asp, pelo, piel, cab, pelvis, parte, art) {
  const R = asp.rasgos, pelo2 = new THREE.Color(pelo).multiplyScalar(0.78).getHex();   // un tono más oscuro, para las mechas
  const cuelgan = [];                                                         // las articulaciones que se mecen
  // el pelo de arriba (donde iba la gorra) y el flequillo
  parte(cab, a => {
    a.pon(new THREE.SphereGeometry(0.214, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), 'personaje', pelo, [0, 0.022, 0]);   // la coronilla (deja libres cejas y ojos)
    a.pon(ESFERA, 'personaje', pelo, [-0.05, 0.13, -0.15], [0, 0, 0.35], [0.26, 0.08, 0.1]);   // el flequillo, de lado
    for (const s of [-1, 1]) {
      a.pon(CAJA, 'personaje', 0x1d1a2a, [s * 0.105, 0.05, -0.172], [0, 0, s * 0.6], [0.035, 0.012, 0.012]);   // las pestañas, en la esquina de afuera de cada ojo
    }
    if (R.tocado === 'cintillo') a.pon(new THREE.TorusGeometry(0.218, 0.022, 6, 22, Math.PI), 'personaje', asp.gorra, [0, 0.04, 0.02], [-0.35, 0, 0]);   // de oreja a oreja por arriba
    if (R.tocado === 'boina') {
      a.pon(ESFERA, 'personaje', asp.gorra, [0.02, 0.19, 0.03], [0, 0, 0.22], [0.5, 0.13, 0.48]);   // la boina, chata y caída hacia un lado
      a.pon(ESFERA, 'personaje', asp.gorra, [0.03, 0.26, 0.03], null, 0.04);                        // el piquito de arriba
    }
    if (R.lentes) {
      for (const s of [-1, 1]) a.pon(new THREE.TorusGeometry(0.052, 0.009, 6, 16), 'personaje', 0x2b2d42, [s * 0.068, 0.02, -0.2]);   // los dos marcos redondos
      a.pon(CAJA, 'personaje', 0x2b2d42, [0, 0.026, -0.205], null, [0.04, 0.01, 0.01]);             // el puente
    }
    if (R.aros) for (const s of [-1, 1]) a.pon(new THREE.TorusGeometry(0.04, 0.008, 6, 14), 'personaje', 0xffc63a, [s * 0.205, -0.1, 0.01], [0, Math.PI / 2, 0]);   // aros dorados
    if (R.peinado === 'afro') {
      a.pon(ESFERA, 'personaje', pelo, [0, 0.11, 0.13], null, [0.66, 0.58, 0.5]);                    // la nube: más ancha que la cabeza y corrida hacia atrás (la cara, en −z, queda libre)
      for (const [x, y, z] of [[-0.2, 0.2, 0.14], [0.2, 0.2, 0.14], [0, 0.28, 0.14], [0, 0.12, 0.3]]) a.pon(ESFERA, 'personaje', pelo2, [x, y, z], null, 0.22);   // bultos más oscuros: le dan textura sin texturas
    }
    if (R.peinado === 'monos') for (const s of [-1, 1]) {
      a.pon(ESFERA, 'personaje', pelo, [s * 0.14, 0.17, 0.05], null, 0.19);                         // los dos moños
      a.pon(new THREE.TorusGeometry(0.06, 0.016, 6, 14), 'personaje', asp.gorra, [s * 0.12, 0.12, 0.04], [0.9, 0, -s * 0.6]);   // el elástico de cada uno
    }
  });
  // lo que cuelga y se mece
  if (R.peinado === 'coleta') {
    const coleta = art(cab, [0, 0.17, 0.16]);                                 // nace arriba y atrás de la cabeza
    parte(coleta, a => {
      a.pon(new THREE.TorusGeometry(0.045, 0.018, 6, 14), 'personaje', asp.gorra, [0, 0, 0.01], [0.5, 0, 0]);   // el elástico
      a.pon(new THREE.CapsuleGeometry(0.06, 0.24, 4, 10), 'personaje', pelo, [0, -0.17, 0.04]);    // la cola…
      a.pon(ESFERA, 'personaje', pelo2, [0, -0.33, 0.05], null, [0.09, 0.12, 0.09]);               // …y su punta
    });
    cuelgan.push({ g: coleta, x0: 0.75, amp: 1 });                            // cae hacia atrás, y se mece mucho
  }
  if (R.peinado === 'trenzas') for (const s of [-1, 1]) {
    const trenza = art(cab, [s * 0.16, -0.04, 0.09]);                          // detrás de cada oreja
    parte(trenza, a => {
      for (let i = 0; i < 4; i++) a.pon(ESFERA, 'personaje', i % 2 ? pelo2 : pelo, [0, -0.05 - i * 0.075, 0], null, [0.085, 0.1, 0.085]);   // los nudos de la trenza
      a.pon(ESFERA, 'personaje', asp.gorra, [0, -0.35, 0], null, 0.05);                              // el lazo de la punta
    });
    cuelgan.push({ g: trenza, x0: 0.25, amp: 0.6, lado: s });
  }
  if (R.peinado === 'larga') {
    const melena = art(cab, [0, 0.02, 0.1]);                                  // cuelga de la nuca
    parte(melena, a => {
      /* Hasta los omóplatos y no más: hasta la mitad de la espalda se metía
         dentro de la mochila (que empieza en y = 0,51 del torso, a la altura de
         la punta de esta melena), y por detrás se veía el pelo atravesándola. */
      a.pon(redonda(0.44, 0.3, 0.12, 0.05), 'personaje', pelo, [0, -0.12, 0.04]);   // la melena, hasta los omóplatos
      a.pon(redonda(0.38, 0.07, 0.11, 0.035), 'personaje', pelo2, [0, -0.27, 0.05]);   // las puntas, más oscuras
    });
    cuelgan.push({ g: melena, x0: 0.12, amp: 0.35 });                         // pesada: se mece poco
  }
  let falda = null;
  if (R.falda != null) {
    falda = art(pelvis, [0, 0.06, 0]);                                         // cuelga de la cintura
    parte(falda, a => {
      a.pon(new THREE.CylinderGeometry(0.18, 0.31, 0.34, 18), 'personaje', R.falda, [0, -0.15, 0]);   // acampanada
      a.pon(new THREE.CylinderGeometry(0.315, 0.315, 0.035, 18), 'personaje', new THREE.Color(R.falda).multiplyScalar(0.75).getHex(), [0, -0.31, 0]);   // el ruedo, más oscuro
    });
  }
  return { cuelgan, falda };
}
/** Mece el pelo y la falda según la pose `p` (la llama `posa` al final). */
function mueveRasgos(r, p) {
  const { cuelgan, falda } = r.rasgos;
  const f = p.fase || 0, t = p.t || 0, vy = p.vy || 0;
  // cuánto se levanta el pelo: cayendo (vy < 0) flota hacia arriba, subiendo se pega
  const flota = p.modo === 'saltar' || p.modo === 'patinar' ? THREE.MathUtils.clamp(-vy / 10, -0.4, 1) : 0;
  for (const c of cuelgan) {
    let x = c.x0, z = 0;                                                       // x: hacia atrás; z: de lado
    if (p.modo === 'correr') { x += 0.22 * c.amp * Math.sin(f * 2); z = 0.25 * c.amp * Math.sin(f); }   // rebota dos veces por zancada y se va de lado a lado
    else if (p.modo === 'menu' || p.modo === 'quieto') z = 0.08 * c.amp * Math.sin(t * 1.6 + f);       // apenas se mece
    else if (p.modo === 'volar') x += 0.9 * c.amp;                            // con la mochila el viento lo tira para atrás
    else if (p.modo === 'rodar') x += 0.6 * c.amp;                            // hecha bolita, el pelo pegado
    x += 1.1 * c.amp * flota;                                                  // al caer, el pelo sube
    if (c.lado) z += c.lado * 0.12;                                            // las trenzas, un poco abiertas
    c.g.rotation.set(-x, 0, z);                                                // negativo: atrás es +z (la cara mira a −z)
  }
  if (falda) {
    // la falda se abre con las piernas al correr, y flota un poco al caer
    falda.rotation.set(p.modo === 'correr' ? 0.08 * Math.sin(f * 2) : 0, 0, p.modo === 'correr' ? 0.06 * Math.sin(f) : 0);
    falda.scale.set(1 + 0.12 * Math.max(0, flota), 1, 1 + 0.12 * Math.max(0, flota));   // al caer se infla
  }
}

/* --- La identidad de los corredores (ronda 4) ---
   Los cinco chicos (Tomás, Benja, Nacho, Mateo y Don Ramón) eran
   el mismo muñeco con gorra y otra ropa. `asp.identidad` (motor.js) les da
   una silueta propia, pensada como la de las corredoras: lo que se ve de
   espaldas y a lo lejos es la cabeza y lo que cuelga, así que cada uno
   cambia sobre todo eso:
   - tocado 'gorra': la gorra al revés de siempre (con audífonos encima, el
     Clásico); 'capucha': la capucha puesta, en el color de la sudadera, con
     su borde alrededor de la cara y sus cordones; 'lana': gorro de lana con
     doblez y pompón; 'corona': corona dorada de cinco puntas sobre el pelo;
     'quepi': la gorra de uniforme del inspector, con banda y visera adelante;
   - accesorios: pañuelo sobre nariz y boca (con su nudo atrás), franjas que
     reflejan en las pantorrillas, un spray en el bolsillo de la mochila,
     manchas de pintura en los jeans, lentes de sol, cadena con medalla,
     capa (cuelga de los hombros y se mece como el pelo de las corredoras:
     la mueve `mueveRasgos`), bigote y abrigo largo.
   Todo en piezas fundidas, como el resto del muñeco. Devuelve lo mismo que
   armaRasgos ({cuelgan, falda}), así `posa` lo mece con el mismo código. */
function armaIdentidad(asp, pelo, piel, cab, torso, piernas, parte, art) {
  const I = asp.identidad, cuelgan = [];
  const oscuro = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();     // el mismo color, más oscuro
  parte(cab, a => {
    if (I.tocado === 'gorra') {                                               // la gorra al revés (la de siempre)
      a.pon(new THREE.SphereGeometry(0.218, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 'personaje', asp.gorra, [0, 0.03, 0]);
      a.pon(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), 'personaje', asp.gorra, [0, 0.04, 0.13], [-0.14, 0, 0]);
      a.pon(ESFERA, 'personaje', asp.gorra, [0, 0.25, 0], null, 0.05);
    }
    if (I.audifonos) {
      a.pon(new THREE.TorusGeometry(0.255, 0.022, 6, 22, Math.PI), 'personaje', 0x22262c, [0, 0.02, -0.01]);   // el arco, de oreja a oreja por encima de la gorra
      for (const s of [-1, 1]) {
        a.pon(CILINDRO_CHICO, 'personaje', 0x22262c, [s * 0.235, 0.0, -0.01], [0, 0, Math.PI / 2], [0.17, 0.07, 0.17]);   // cada copa
        a.pon(CILINDRO_CHICO, 'personaje', asp.mochila2, [s * 0.272, 0.0, -0.01], [0, 0, Math.PI / 2], [0.11, 0.015, 0.11]);   // su tapa de color
      }
    }
    if (I.tocado === 'capucha') {
      const cap = asp.sudadera, borde = oscuro(cap, 0.75);
      a.pon(new THREE.SphereGeometry(0.25, 22, 14, Math.PI * 11 / 6, Math.PI * 4 / 3, 0, Math.PI * 0.78), 'personaje', cap, [0, 0.02, 0.02]);   // atrás y a los lados, hasta la nuca
      a.pon(new THREE.SphereGeometry(0.25, 22, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), 'personaje', cap, [0, 0.02, 0.02]);   // y arriba, entera
      a.pon(new THREE.TorusGeometry(0.19, 0.035, 6, 22), 'personaje', borde, [0, 0.0, -0.14], [0.12, 0, 0]);   // el borde que enmarca la cara
      for (const s of [-1, 1]) a.pon(new THREE.CapsuleGeometry(0.012, 0.12, 3, 6), 'personaje', 0xedf2f4, [s * 0.06, -0.24, -0.15]);   // los cordones
    }
    if (I.panuelo != null) {
      a.pon(new THREE.SphereGeometry(0.222, 18, 6, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.53, Math.PI * 0.3), 'personaje', I.panuelo, [0, 0, 0]);   // sobre nariz y boca (la cara mira a −z)
      /* El nudo y sus puntas van atrás, en la nuca. Con capucha quedan adentro
         de ella, salvo las puntas, que asomaban bajo su borde como una «^» roja
         sobre la mochila: con capucha no se dibujan (el nudo no se vería). */
      if (I.tocado !== 'capucha') {
        a.pon(ESFERA, 'personaje', oscuro(I.panuelo, 0.8), [0, -0.06, 0.215], null, [0.07, 0.06, 0.05]);   // el nudo, atrás
        for (const s of [-1, 1]) a.pon(CAJA, 'personaje', I.panuelo, [s * 0.03, -0.13, 0.23], [0.3, 0, s * 0.3], [0.04, 0.12, 0.012]);   // las dos puntas que cuelgan
      }
    }
    if (I.tocado === 'lana') {
      a.pon(new THREE.SphereGeometry(0.228, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 'personaje', asp.gorra, [0, 0.03, 0.02], null, [1, 1.22, 1]);   // el gorro, alto
      a.pon(new THREE.CylinderGeometry(0.234, 0.234, 0.07, 20, 1, true), 'personaje', oscuro(asp.gorra, 0.8), [0, 0.05, 0.02]);   // el doblez
      a.pon(ESFERA, 'personaje', asp.mochila2, [0, 0.33, 0.03], null, 0.12);   // el pompón
    }
    if (I.tocado === 'corona') {
      a.pon(new THREE.SphereGeometry(0.214, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), 'personaje', pelo, [0, 0.022, 0]);   // el pelo de arriba
      a.pon(new THREE.CylinderGeometry(0.135, 0.125, 0.07, 10, 1, true), 'personaje', 0xffc63a, [0, 0.24, 0.01]);   // el aro de la corona
      for (let k = 0; k < 5; k++) {
        const t = k / 5 * Math.PI * 2;
        a.pon(new THREE.ConeGeometry(0.035, 0.09, 4), 'personaje', 0xffc63a, [Math.sin(t) * 0.13, 0.315, 0.01 + Math.cos(t) * 0.13]);   // las cinco puntas
        a.pon(ESFERA, 'personaje', k % 2 ? 0x2a6df4 : 0xe8203a, [Math.sin(t) * 0.137, 0.24, 0.01 + Math.cos(t) * 0.137], null, 0.035);   // las piedras
      }
    }
    if (I.lentesSol) {
      for (const s of [-1, 1]) {
        a.pon(redonda(0.085, 0.05, 0.02, 0.012), 'personaje', 0x111318, [s * 0.066, 0.02, -0.205]);   // cada vidrio, negro
        a.pon(CAJA, 'personaje', 0x111318, [s * 0.15, 0.03, -0.11], [0, s * 0.5, 0], [0.012, 0.012, 0.16]);   // la patilla hacia la oreja
      }
      a.pon(CAJA, 'personaje', 0xffc63a, [0, 0.03, -0.21], null, [0.05, 0.012, 0.012]);   // el puente dorado
    }
    if (I.tocado === 'quepi') {
      a.pon(new THREE.CylinderGeometry(0.235, 0.205, 0.15, 20), 'personaje', asp.gorra, [0, 0.19, 0.0], [-0.08, 0, 0]);   // la copa, más ancha arriba
      a.pon(new THREE.CylinderGeometry(0.21, 0.21, 0.045, 20), 'personaje', 0xfca311, [0, 0.12, 0.0]);   // la banda dorada
      a.pon(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20, 1, false, Math.PI / 2, Math.PI), 'personaje', 0x111111, [0, 0.1, -0.12], [0.14, 0, 0]);   // la visera, adelante
      a.pon(CAJA, 'personaje', 0xffd23f, [0, 0.2, -0.235], [-0.08, 0, 0], [0.06, 0.06, 0.015]);   // la insignia
    }
    if (I.bigote) for (const s of [-1, 1]) a.pon(ESFERA, 'personaje', pelo, [s * 0.034, -0.058, -0.196], [0, 0, -s * 0.35], [0.065, 0.026, 0.03]);   // el bigote, en dos mitades
  });
  parte(torso, a => {
    if (I.spray) {
      a.pon(CILINDRO_CHICO, 'personaje', asp.mochila2, [0.2, 0.3, 0.22], null, [0.08, 0.2, 0.08]);   // la lata, en el bolsillo del costado
      a.pon(CILINDRO_CHICO, 'personaje', 0xffffff, [0.2, 0.42, 0.22], null, [0.06, 0.05, 0.06]);    // su tapa
    }
    if (I.cadena) {
      a.pon(new THREE.TorusGeometry(0.16, 0.02, 6, 22), 'personaje', 0xffc63a, [0, 0.5, -0.06], [1.1, 0, 0]);   // la cadena, caída sobre el pecho
      a.pon(CILINDRO_CHICO, 'personaje', 0xffc63a, [0, 0.38, -0.16], [Math.PI / 2, 0, 0], [0.1, 0.02, 0.1]);   // la medalla
    }
    if (I.abrigo) {
      a.pon(redonda(0.5, 0.78, 0.34, 0.1), 'personaje', asp.sudadera, [0, 0.2, 0.02]);   // el abrigo largo, tapa la mochila
      for (let k = 0; k < 3; k++) a.pon(ESFERA, 'personaje', 0xfca311, [0, 0.42 - k * 0.14, -0.15], null, 0.03);   // los botones dorados
      a.pon(CAJA, 'personaje', 0xfca311, [0.13, 0.46, -0.15], null, [0.06, 0.06, 0.015]);   // la placa en el pecho
    }
  });
  if (I.capa != null) {
    /* El manto de los hombros: une la capa al cuerpo. Sin él la capa colgaba
       en z = 0,35 (por fuera de la mochila) y de perfil se veía como una tabla
       roja flotando detrás, separada de la espalda. El manto va fijo al torso,
       sobre los hombros, desde el pecho hasta la bisagra de la capa. */
    parte(torso, a => a.pon(redonda(0.5, 0.07, 0.36, 0.03), 'personaje', I.capa, [0, 0.62, 0.2]));
    const capa = art(torso, [0, 0.6, 0.35]);                                  // cuelga de los hombros, por fuera de la mochila (que llega hasta z = 0,33)
    parte(capa, a => {
      a.pon(redonda(0.5, 0.72, 0.035, 0.015), 'personaje', I.capa, [0, -0.36, 0.06]);   // la capa
      a.pon(redonda(0.52, 0.05, 0.05, 0.02), 'personaje', 0xffc63a, [0, -0.01, 0.05]);  // el ribete dorado de los hombros
    });
    cuelgan.push({ g: capa, x0: 0.18, amp: 0.55 });                           // cae hacia atrás y flamea al correr
  }
  for (const pi of piernas) {
    if (I.reflejos) parte(pi.rodilla, a => { for (const y of [-0.12, -0.22]) a.pon(new THREE.TorusGeometry(0.079, 0.012, 5, 16), 'luz', 0xd8f0ff, [0, y, 0], [Math.PI / 2, 0, 0]); });   // dos franjas que reflejan en cada pantorrilla
    if (I.manchas) parte(pi.cadera, a => {
      const cols = [asp.gorra, asp.mochila, asp.mochila2];
      for (let k = 0; k < 3; k++) a.pon(ESFERA, 'personaje', cols[k], [0.05 * (k - 1), -0.1 - k * 0.07, k % 2 ? 0.08 : -0.08], null, [0.05, 0.04, 0.02]);   // tres manchas de pintura en cada muslo
    });
  }
  return { cuelgan, falda: null };
}

/** Arma el corredor articulado con los colores de su aspecto.
    Devuelve las articulaciones para poder posarlo en cada cuadro. */
function armaCorredor(kit, asp) {
  const piel = asp.piel ?? (asp.rasgos && asp.rasgos.piel) ?? 0xf1c19c, pelo = asp.pelo ?? ((asp.rasgos && asp.rasgos.pelo) || (asp.identidad && asp.identidad.pelo) || 0x3b2a20);   // CITY trae su piel y su pelo; las corredoras, su color de pelo (ver «Los rasgos»)
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
  /* Las llamas cuelgan de la boca de las toberas (el origen de la pieza está
     ahí, a −0,25): así, cuando `paso` las estira para que tiemblen, crecen
     hacia abajo sin separarse del cohete. Van de blanco amarillo en la boca
     a rojo anaranjado en la punta, pintado en el color de cada vértice: la
     misma malla, ninguna llamada más al GPU. */
  const llamas = parte(cohete, a => { for (const s of [-1, 1]) a.pon(new THREE.ConeGeometry(0.08, 0.5, 10), 'luz', 0xffa424, [s * 0.13, -0.25, 0.04], [Math.PI, 0, 0]); }, [0, -0.25, 0]);
  {
    const geo = llamas.children[0].geometry, py = geo.attributes.position, cv = geo.attributes.color;
    const boca = new THREE.Color(0xfff2b8), punta = new THREE.Color(0xff4a14), col = new THREE.Color();
    for (let i = 0; i < py.count; i++) {
      col.copy(boca).lerp(punta, THREE.MathUtils.clamp(-py.getY(i) / 0.5, 0, 1));   // y = 0 en la boca, −0,5 en la punta
      cv.setXYZ(i, col.r, col.g, col.b);
    }
  }
  const cab = art(torso, [0, 0.8, 0]); cab.rotation.x = 0.12;
  parte(cab, a => {
    a.pon(ESFERA, 'personaje', piel, [0, 0, 0], null, [0.4, 0.42, 0.4]);
    for (const s of [-1, 1]) a.pon(ESFERA, 'personaje', piel, [s * 0.198, -0.01, 0.01], null, [0.05, 0.1, 0.08]);
    // el pelo solo atrás y a los lados (deja libre la cara: 120° de frente, hacia -z)
    a.pon(new THREE.SphereGeometry(0.208, 22, 14, Math.PI * 11 / 6, Math.PI * 4 / 3, Math.PI * 0.32, Math.PI * 0.42), 'personaje', pelo, [0, 0, 0.01]);
    /* La cara. Corriendo nunca se ve (va de espaldas), pero en el menú el
       corredor se da vuelta y saluda, y sin cara era una bola con gorra. */
    for (const s of [-1, 1]) {
      a.pon(ESFERA, 'personaje', 0xffffff, [s * 0.068, 0.022, -0.168], null, [0.07, 0.082, 0.05]);           // el blanco del ojo
      a.pon(ESFERA, 'personaje', 0x1d1a2a, [s * 0.064, 0.016, -0.19], null, [0.036, 0.046, 0.024]);          // la pupila
      a.pon(ESFERA, 'personaje', 0xffffff, [s * 0.058 + 0.01, 0.03, -0.2], null, 0.012);                     // el brillo
      a.pon(CAJA, 'personaje', pelo, [s * 0.072, 0.092, -0.176], [0, 0, -s * 0.18], [0.07, 0.016, 0.02]);    // la ceja
    }
    a.pon(ESFERA, 'personaje', new THREE.Color(piel).multiplyScalar(0.88).getHex(), [0, -0.03, -0.196], null, [0.04, 0.034, 0.03]);   // la nariz
    a.pon(new THREE.TorusGeometry(0.046, 0.011, 6, 14, Math.PI), 'personaje', 0x8a2a1e, [0, -0.072, -0.176], [0.25, 0, Math.PI]);    // la sonrisa
    if (!asp.rasgos && !asp.identidad) {                                       // la gorra (las corredoras van sin gorra; los corredores traen su tocado: ver «La identidad»)
      a.pon(new THREE.SphereGeometry(0.218, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 'personaje', asp.gorra, [0, 0.03, 0]);
      a.pon(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), 'personaje', asp.gorra, [0, 0.04, 0.13], [-0.14, 0, 0]);
      a.pon(ESFERA, 'personaje', asp.gorra, [0, 0.25, 0], null, 0.05);
    }
  });
  const rasgos = asp.rasgos ? armaRasgos(asp, pelo, piel, cab, pelvis, parte, art)   // peinado, falda, lentes… (ver «Los rasgos»)
    : asp.identidad ? armaIdentidad(asp, pelo, piel, cab, torso, piernas, parte, art) : null;   // tocado, capa, accesorios… (ver «La identidad»)
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
  /* El pogo saltarín (sale de la caja misteriosa): un palo delante del
     corredor, con manubrio a la altura del pecho, dos pedales bajo los pies
     y un resorte con su goma abajo. El palo baja 0,55 m bajo los pies, así
     que mientras se usa el corredor va 0,55 m más arriba (ver `paso`). */
  const pogo = new THREE.Group(); pogo.visible = false; raiz.add(pogo);
  parte(pogo, a => {
    a.pon(CILINDRO_CHICO, 'pintura', 0xff3b8d, [0, 0.33, -0.24], null, [0.07, 1.1, 0.07]);              // el palo, de -0,22 a 0,88
    a.pon(CILINDRO_CHICO, 'pintura', 0x2b2d42, [0, 1.06, -0.24], [0, 0, Math.PI / 2], [0.06, 0.62, 0.06]);   // el manubrio
    for (const sx of [-1, 1]) a.pon(CILINDRO_CHICO, 'personaje', 0x111111, [sx * 0.27, 1.06, -0.24], [0, 0, Math.PI / 2], [0.075, 0.12, 0.075]);   // los puños de goma
    for (const sx of [-1, 1]) a.pon(CAJA, 'pintura', 0xffd23f, [sx * 0.14, -0.01, -0.14], null, [0.16, 0.035, 0.24]);    // los pedales, bajo cada pie
    a.pon(CAJA, 'pintura', 0x2b2d42, [0, -0.01, -0.24], null, [0.12, 0.06, 0.08]);                     // donde se unen al palo
    a.pon(CILINDRO_CHICO, 'personaje', 0x111111, [0, -0.53, -0.24], null, [0.1, 0.05, 0.1]);             // la goma de abajo
  });
  const resorte = new THREE.Group(); resorte.position.set(0, -0.5, -0.24); pogo.add(resorte);   // se estira y se encoge desde la goma
  parte(resorte, a => { for (let i = 0; i < 5; i++) a.pon(new THREE.TorusGeometry(0.055, 0.012, 5, 14), 'luz', 0x00f5d4, [0, 0.05 + i * 0.07, 0], [Math.PI / 2, 0, 0]); });
  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 40), kit.mat('luz'));
  aura.geometry = prepara(aura.geometry, 0xff5a5a); aura.rotation.x = Math.PI / 2; aura.position.y = 1.0; aura.visible = false; raiz.add(aura);
  // la sombra redonda bajo los pies (en calidad baja, que no tiene sombras de verdad)
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  sombra.material.userData.propio = true;                                      // es solo de este corredor: se suelta con él
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.01;
  if (GANCHOS.viste && asp.peinado) GANCHOS.viste({ cab, torso, pelvis, piernas }, kit, asp, pelo);   // CITY: peinado y falda (mundo-city.js)
  raiz.scale.setScalar(0.95);
  return { raiz, cuerpo, pelvis, torso, cab, piernas, brazos, cohete, llamas, tabla, pogo, resorte, aura, sombra, rasgos };
}

/** Pone la pose del corredor según lo que está haciendo.
    p = {modo: 'correr'|'saltar'|'rodar'|'patinar'|'volar'|'pogo'|'tropezar'|'caer'|'quieto'|'menu', fase, t, vy, ladeo, agacha, aire} */
function posa(r, p) {
  const s = Math.sin(p.fase || 0), c = Math.cos(p.fase || 0);
  const [pi, pd] = r.piernas, [bi, bd] = r.brazos;
  /* Primero todo vuelve a su lugar de siempre. Cada pose cambia solo lo
     suyo, y lo que una pose movió (la bolita de la rodada, la postura de
     lado en la patineta) no puede quedarse pegado en la siguiente. */
  r.cuerpo.rotation.set(-0.14, 0.08 * s, (p.ladeo || 0));
  r.cuerpo.position.set(0, 0, 0);                                              // los pies en el origen
  r.cuerpo.scale.setScalar(1);                                                 // de su tamaño (la rodada lo achica un poco)
  r.pelvis.position.set(0, 0.78, 0);                                           // la cadera a su altura de pie
  r.pelvis.rotation.set(0, 0, 0);                                              // mirando hacia adelante (en la patineta se pone de lado)
  r.torso.rotation.set(0, 0, 0);                                               // el tronco derecho
  r.cab.rotation.set(0.12, 0, 0);                                              // la cabeza apenas inclinada, como se armó
  r.tabla.position.set(0, 0, 0);                                               // la patineta en su sitio…
  r.tabla.rotation.set(0, 0, 0);                                               // …y plana
  if (r.pogo) { r.pogo.rotation.set(0, 0, 0); r.resorte.scale.set(1, 1, 1); }  // el pogo derecho y el resorte suelto
  pi.tobillo.rotation.x = pd.tobillo.rotation.x = 0;                           // los pies planos (la bolita y la patineta los doblan)
  bi.hombro.rotation.z = -0.15; bd.hombro.rotation.z = 0.15;
  pi.cadera.rotation.z = pd.cadera.rotation.z = 0;                             // la pose del menú las abre un poco: se cierran antes de cualquier otra
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
    /* Hecho una bolita que da una vuelta entera hacia adelante. Antes giraba
       el cuerpo entero en torno a los pies (el origen de `cuerpo` está en el
       suelo): a media vuelta quedaba de cabeza BAJO la vía y desaparecía, y
       con el tronco derecho la "bolita" medía un metro de largo. Ahora se
       encoge (tronco doblado sobre las rodillas, cabeza metida, brazos
       abrazando las piernas) y gira en torno al centro de la bolita, que se
       pone en el origen de `cuerpo` y se levanta a la altura de su radio:
       así ninguna parte baja del suelo (lo más bajo, −0,02 m) y lo más alto
       queda en ~1,08 m (la barrera alta empieza a 1,0 m), en todos los
       ángulos. Medido en Chromium con la caja de lo que se ve: la mochila
       cohete y sus llamas cuelgan escondidas del torso y no cuentan. */
    const giro = (p.t || 0) * Math.PI * 2 / 0.62;                              // una vuelta completa en lo que dura la rodada
    r.torso.rotation.x = -2.0;                                                 // el tronco se dobla hacia adelante, sobre los muslos
    r.cab.rotation.x = -0.5;                                                   // el mentón al pecho
    for (const pp of [pi, pd]) { pp.cadera.rotation.x = 0.99; pp.rodilla.rotation.x = -2.7; pp.tobillo.rotation.x = 0.6; }   // las rodillas al pecho y los talones atrás
    for (const b of [bi, bd]) { b.hombro.rotation.x = 0.2; b.codo.rotation.x = 1.55; }   // los brazos bajan por delante…
    bi.hombro.rotation.z = 0.3; bd.hombro.rotation.z = -0.3;                   // …y se cierran sobre las canillas: las abrazan
    r.pelvis.position.set(0, 0.141, 0.399);                                    // corre el cuerpo para que el centro de la bolita quede en el origen
    r.cuerpo.scale.setScalar(0.78);                                            // más chico mientras rueda: la cabeza es grande y la bolita no cabe bajo la barrera
    r.cuerpo.position.y = 0.56;                                                // el centro, a la altura del radio: la bolita toca el suelo y no lo cruza
    r.cuerpo.rotation.x = -giro;                                               // y gira en torno a ese centro
  } else if (p.modo === 'patinar') {
    /* En la patineta (una tabla que flota, como el hoverboard de Subway
       Surfers): de lado, rodillas dobladas y brazos abiertos para el
       equilibrio. Se inclina al cambiar de carril (y la tabla con él), en
       el salto hace un ollie (encoge las piernas y la tabla levanta la
       punta al subir y se nivela al bajar, según `vy`: no según el tiempo
       en el aire, que al caerse de un techo empieza con vy = 0) y al rodar
       se agacha sobre la tabla en vez de hacerse bolita.
       `agacha` va de 0 a 1 y `aire` dice si está en el aire. */
    const t = p.t || 0, ag = p.agacha || 0, vy = p.vy || 0, ladeo = p.ladeo || 0;
    const ABRE = 0.3;                                                          // cuánto se separan los pies a lo largo de la tabla
    const encoge = p.aire ? 0.6 + 0.4 * (1 - Math.min(1, Math.abs(vy) / 10)) : 0;   // en el aire recoge las rodillas (más en lo más alto)
    const cadera = 0.45 + 1.0 * ag, rodilla = -0.9 - 1.45 * ag;               // de pie con las rodillas dobladas → agachado
    const caderaE = cadera + 0.55 * encoge, rodillaE = rodilla - 1.0 * encoge; // y recogidas en el salto
    // el alto de la pierna, de la cadera a la suela, con el pie plano
    const altoPierna = (h, k) => 0.4 * Math.cos(ABRE) * Math.cos(h) + 0.4 * (Math.cos(ABRE) * Math.cos(k) * Math.cos(h) - Math.sin(k) * Math.sin(h)) + 0.1;
    const flota = Math.sin(t * 3.2) * 0.02;                                    // la tabla sube y baja apenas, y él con ella
    const levanta = altoPierna(cadera, rodilla) - altoPierna(caderaE, rodillaE);   // lo que suben los pies al encogerse: la tabla sube con ellos
    // la tabla
    r.tabla.position.y = flota + levanta;
    r.tabla.rotation.x = !p.aire ? 0                                           // en el suelo, plana
      : vy > 0 ? 0.45 * Math.min(1, vy / 10)                                   // subiendo: la punta arriba (y se nivela al llegar arriba)
        : -0.15 * Math.sin(Math.min(1, -vy / 10) * Math.PI);                   // bajando: un poco de punta y plana otra vez al tocar el suelo
    r.tabla.rotation.z = ladeo * 1.5;                                          // se ladea con él al cambiar de carril
    // el cuerpo: de lado sobre la tabla, ladeado igual que ella (los dos giran en torno al mismo punto, así los pies no se despegan)
    r.cuerpo.rotation.set(0, 0, ladeo * 1.5);
    r.cuerpo.position.y = flota;
    r.pelvis.rotation.y = -1.05;                                               // la cadera de lado: el pie izquierdo adelante
    r.pelvis.position.y = 0.15 + altoPierna(cadera, rodilla);                  // a la altura justa para que las suelas pisen la tabla (su cara de arriba está a 0,15)
    pi.cadera.rotation.set(caderaE, 0, -ABRE); pd.cadera.rotation.set(caderaE, 0, ABRE);   // las piernas abiertas, una hacia la punta y otra hacia la cola
    for (const pp of [pi, pd]) { pp.rodilla.rotation.x = rodillaE; pp.tobillo.rotation.x = -(caderaE + rodillaE); }   // rodillas dobladas, pies planos
    r.torso.rotation.set(-0.2 - 0.75 * ag, 0.35, 0);                           // el tronco un poco adelante y los hombros abiertos hacia donde va
    r.cab.rotation.set(0.12 + 0.4 * ag, 0.6, 0);                               // la cabeza mira hacia adelante, por la vía (agachado, la levanta)
    const vaiven = Math.sin(t * 2.3) * 0.15;                                   // los brazos se mecen como un balancín
    bi.hombro.rotation.set(0.2 + 0.6 * ag, 0, -1.25 + 0.9 * ag + vaiven - 0.2 * encoge);   // el brazo de adelante, abierto hacia la punta
    bd.hombro.rotation.set(-0.1 + 0.9 * ag, 0, 1.1 - 0.75 * ag + vaiven + 0.2 * encoge);   // el de atrás, hacia la cola (agachado, los dos bajan a la tabla)
    bi.codo.rotation.x = 0.35 + 0.25 * ag; bd.codo.rotation.x = 0.5 + 0.1 * ag;
  } else if (p.modo === 'volar') {
    pi.cadera.rotation.x = 0.2; pd.cadera.rotation.x = -0.1; pi.rodilla.rotation.x = -0.4; pd.rodilla.rotation.x = -0.6;
    bi.hombro.rotation.x = 0.3 + 0.1 * s; bd.hombro.rotation.x = 0.3 - 0.1 * s; bi.hombro.rotation.z = -0.6; bd.hombro.rotation.z = 0.6;
    bi.codo.rotation.x = 0.3; bd.codo.rotation.x = 0.3;
    r.cuerpo.rotation.x = -0.35;
  } else if (p.modo === 'pogo') {
    /* De pie en los pedales, agarrado al manubrio con las dos manos y las
       rodillas un poco dobladas. El resorte se encoge mientras más rápido
       sube o baja (en la cima, quieto en el aire, está suelto), y todo se
       ladea al cambiar de carril. */
    const vy = p.vy || 0, k = Math.min(1, Math.abs(vy) / 14);
    r.cuerpo.rotation.set(-0.06, 0, (p.ladeo || 0) * 1.4);
    for (const pp of [pi, pd]) { pp.cadera.rotation.x = 0.35; pp.rodilla.rotation.x = -0.6; pp.tobillo.rotation.x = 0.25; }
    r.pelvis.position.y = 0.72;                                                // baja un poco: las rodillas dobladas
    for (const b of [bi, bd]) { b.hombro.rotation.x = -0.95; b.codo.rotation.x = 0.55; }   // los brazos al manubrio
    bi.hombro.rotation.z = 0.12; bd.hombro.rotation.z = -0.12;
    r.pogo.rotation.z = (p.ladeo || 0) * 1.4;
    r.resorte.scale.y = 1 - 0.45 * k;
    /* --- El pogo de la ronda 2: impulso, vuelta en la cima y caída ---
       Como en Subway Surfers, el salto del pogo es un espectáculo:
       - al despegar (los primeros 0,22 s, `t` = segundos en el pogo) el
         resorte se aplasta y se suelta, y él se agacha y se estira con él;
       - subiendo, el resorte va estirado (ya se soltó);
       - en la cima, mientras la velocidad vertical cruza de +4 a −4 m/s, da
         una vuelta entera sobre sí mismo con el pogo (sale de `vy`, no del
         reloj: el pogo lanzado desde un techo sube menos y la vuelta igual
         cae en la cima), y encoge las piernas como en un truco;
       - bajando, se prepara para el golpe: rodillas dobladas, resorte suelto. */
    const t = p.t || 0;                                                        // segundos desde que saltó con el pogo
    const IMPULSO = 0.22;                                                      // lo que dura el impulso
    if (t < IMPULSO) {
      const u = t / IMPULSO;                                                   // 0 → 1 durante el impulso
      const aplasta = Math.sin(u * Math.PI);                                   // se aplasta y vuelve: sube y baja una vez
      r.resorte.scale.y = 1 - 0.55 * aplasta + 0.25 * u;                       // la goma contra el suelo, y después se estira
      r.pelvis.position.y = 0.72 - 0.12 * aplasta;                             // él se agacha con el resorte…
      for (const pp of [pi, pd]) { pp.cadera.rotation.x = 0.35 + 0.5 * aplasta; pp.rodilla.rotation.x = -0.6 - 0.8 * aplasta; }   // …doblando las rodillas
    } else if (vy > 0) r.resorte.scale.y = 1 + 0.25 * k;                      // subiendo: el resorte suelto y estirado
    const vuelta = THREE.MathUtils.smoothstep((4 - vy) / 8, 0, 1);             // 0 antes de la cima, 1 después (sin saltos)
    if (t >= IMPULSO && vuelta > 0 && vuelta < 1) {
      const truco = Math.sin(vuelta * Math.PI);                                // más encogido a mitad de la vuelta
      for (const pp of [pi, pd]) { pp.cadera.rotation.x = 0.35 + 0.9 * truco; pp.rodilla.rotation.x = -0.6 - 1.3 * truco; }   // las rodillas al pecho
    }
    r.cuerpo.rotation.y = vuelta * Math.PI * 2;                                // la vuelta entera (2π = de espaldas otra vez)
    r.pogo.rotation.y = vuelta * Math.PI * 2;                                  // el pogo gira con él: lo lleva de las manos
  } else if (p.modo === 'tropezar') {
    const k = Math.sin(Math.min(1, (p.t || 0) / 0.4) * Math.PI);
    r.cuerpo.rotation.x = -0.14 - 0.5 * k; r.cuerpo.rotation.z = (p.ladeo || 0) + 0.3 * k;
    bi.hombro.rotation.x = -1.4 * k; bd.hombro.rotation.x = -1.4 * k; bi.hombro.rotation.z = -1.2 * k; bd.hombro.rotation.z = 1.2 * k;
    pi.cadera.rotation.x = 0.6 * s; pd.cadera.rotation.x = -0.6 * s;
  } else if (p.modo === 'menu') {
    /* En el menú: de pie, mirando a la cámara, con un balanceo de peso de
       una pierna a la otra y, cada cinco segundos, un saludo con la mano
       derecha (como el personaje del inicio de Subway Surfers, que nunca
       está quieto del todo). `t` = segundos desde que empezó el juego. */
    const t = p.t || 0, peso = Math.sin(t * 1.6);
    r.cuerpo.rotation.set(0.02, 0, 0.035 * peso);
    r.cuerpo.position.y = 0.012 * Math.abs(Math.cos(t * 1.6));
    pi.cadera.rotation.set(0.04, 0, -0.06); pd.cadera.rotation.set(-0.04, 0, 0.06);
    pi.rodilla.rotation.x = -0.05 - 0.08 * Math.max(0, peso); pd.rodilla.rotation.x = -0.05 - 0.08 * Math.max(0, -peso);
    pi.tobillo.rotation.x = 0; pd.tobillo.rotation.x = 0;
    bi.hombro.rotation.set(0.12, 0, -0.22); bi.codo.rotation.x = 0.35;          // el brazo izquierdo, suelto
    const ciclo = t % 5, saluda = ciclo < 1.7;                                  // 1,7 s de saludo cada 5 s
    const sube = saluda ? Math.min(1, ciclo / 0.25, (1.7 - ciclo) / 0.25) : 0;  // sube y baja el brazo sin saltos
    bd.hombro.rotation.set(0.12 - 0.1 * sube, 0, 0.22 + 2.35 * sube + (saluda ? 0.28 * Math.sin(t * 13) * sube : 0));
    bd.codo.rotation.x = 0.35 + 0.25 * sube;
  } else if (p.modo === 'caer') {
    const k = Math.min(1, (p.t || 0) / 0.5);
    /* Cae de espaldas, hacia la cámara, y queda tendido SOBRE el suelo. El
       giro es en torno a los pies, así que tendido la espalda queda a la
       altura del suelo: hay que subirlo un poco (antes se bajaba, y quedaba
       medio enterrado entre los durmientes, con solo la gorra a la vista). */
    r.cuerpo.rotation.x = 0.3 + 1.15 * k;
    r.cuerpo.position.y = 0.17 * k;
    bi.hombro.rotation.x = -2.2 * k; bd.hombro.rotation.x = -2.2 * k; bi.hombro.rotation.z = -1 * k; bd.hombro.rotation.z = 1 * k;
    pi.cadera.rotation.x = -0.9 * k; pd.cadera.rotation.x = -0.4 * k; pi.rodilla.rotation.x = -0.3; pd.rodilla.rotation.x = -0.6;
  }
  if (r.rasgos) mueveRasgos(r, p);                                            // el pelo y la falda siguen al cuerpo (ver «Los rasgos»)
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
  /* --- La placa del inspector (ronda 2) ---
     Una placa dorada de seis puntas en la mano derecha, que solo se ve
     cuando grita «¡Alto!» o cuando te atrapa (`paso` la prende y levanta
     el brazo). Es un prisma de seis lados (se ve igual de los dos lados) con
     una estrella de luz al centro, colgada del codo a la altura de la mano. */
  const placa = new THREE.Group(); placa.position.set(0, -0.36, -0.05); placa.visible = false;   // en la mano (la mano está a −0,31 del codo)
  const ap = new Arma(kit);
  ap.pon(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 6), 'pintura!', 0xffc63a, [0, 0, 0], [Math.PI / 2, 0, 0]);   // el escudo: seis lados, de canto hacia los costados
  ap.pon(new THREE.CylinderGeometry(0.05, 0.05, 0.045, 5), 'luz!', 0xfff3b0, [0, 0, 0], [Math.PI / 2, 0, 0]);      // el centro que brilla
  placa.add(ap.hecho()); r.brazos[1].codo.add(placa);
  return { r, perro, patas, cola, placa };
}

/* ===================================================================
   5 bis. EL FANTASMA (modos «Fantasma» y «City fantasma»)
   ===================================================================
   El corredor de la mejor carrera de la tabla, que corre a tu lado: es el
   mismo muñeco articulado (armaCorredor, así posa igual), pero de un azul
   translúcido de un solo material propio, sin sombra (ni la de verdad ni la
   redonda de calidad baja) y sin escribir profundidad, para que nunca tape
   ni se coma lo que tiene detrás. Lleva un letrerito con el nombre de quien
   lo corrió (en un lienzo: no pasa por la traducción ni por el HTML). No
   choca con nada: solo se dibuja (lo mueve juego.js con su rastro).
   La oclusión ambiental no lo ve (`sinAO`): redibujaría su cuerpo opaco en
   el pase de normales y le pondría un halo oscuro a algo que es de aire. */
function armaFantasma(kit, nombre) {
  const r = armaCorredor(kit, MOTOR.ASPECTOS.clasico);                       // el mismo cuerpo de siempre…
  const mat = new THREE.MeshLambertMaterial({ color: 0x9fd0ff, emissive: 0x2f6bff, emissiveIntensity: 0.55, vertexColors: true,
    transparent: true, opacity: 0.45, depthWrite: false });                  // …teñido de azul, translúcido y con luz propia (se ve en la noche del neón)
  mat.userData.propio = true;                                                // es solo de este fantasma: se suelta con él
  r.raiz.traverse(o => {
    if (o.isLine || o.isLineSegments2 || o.isLine2) { o.visible = false; return; }   // los bordes de neón quedarían opacos sobre un cuerpo de aire
    if (!o.isMesh) return;
    o.material = mat;                                                        // todas las piezas con el mismo material: una sola opacidad que bajar
    o.castShadow = o.receiveShadow = false;                                  // sin sombra
    o.renderOrder = 3;                                                       // después de lo opaco
    o.userData.sinAO = true;                                                 // la oclusión ambiental no lo dibuja
  });
  for (const x of [r.cohete, r.tabla, r.pogo, r.aura]) x.visible = false;    // en estos modos no hay poderes
  for (const pp of r.piernas) pp.brilloZap.visible = false;
  // el letrero con el nombre, sobre la cabeza
  const [cv, g] = lienzo(512, 96);
  g.font = 'bold 54px "Lilita One", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = String(nombre || 'Fantasma').slice(0, 24);
  const ancho = Math.min(500, g.measureText(txt).width + 70);
  g.fillStyle = 'rgba(16, 40, 110, 0.72)'; g.beginPath(); g.roundRect((512 - ancho) / 2, 8, ancho, 80, 40); g.fill();
  g.fillStyle = '#e8f3ff'; g.fillText(txt, 256, 50);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
  cartel.scale.set(2.4, 0.45, 1); cartel.position.set(0, 2.45, 0); cartel.renderOrder = 4;
  r.raiz.add(cartel);
  return { r, mat, cartel, kit, nombre };
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
    /* --- El frontón del portal (ronda 2) ---
       Los cables de la catenaria subieron a 11,2 m (ver ALTO_CABLE): antes
       entraban en el portal y desaparecían, ahora pasarían por encima del
       túnel. Un frontón de hormigón sobre cada portal, hasta 12,4 m, los
       recibe como antes y tapa lo que sigue detrás. */
    const f = new THREE.Mesh(CAJA, hormigon); f.scale.set(9.4, 4.2, 1.6); f.position.set(0, 10.3, zz - 0.3); g.add(f);   // de 8,2 a 12,4 m, un poco más grueso que el portal
    const corn = new THREE.Mesh(CAJA, borde); corn.scale.set(9.8, 0.35, 1.9); corn.position.set(0, 12.55, zz - 0.3); g.add(corn);   // la cornisa de arriba
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
  /* El suavizado del propio lienzo solo sirve cuando se dibuja directo (calidad
     baja, sin post-proceso) en una pantalla de 1×: ahí, sin él, los bordes
     salían en escalera. Con 2× o más no hace falta (ver armaComposer). */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;                                            // se reinicia a mano en dibuja(): con post-proceso, cada pasada la borraba
  renderer.shadowMap.enabled = true;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 240);
  const vivos = new THREE.Group(); vivos.name = 'vivos'; escena.add(vivos);                       // lo que está en pantalla y se mueve
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
  let fan = null;                                                             // el fantasma (armaFantasma), si se corre contra uno
  let sacudida = 0;

  /* --- La persecución con más impacto (ronda 2) ---
     Dibuja al inspector Don Ramón y a su perro Tornillo detrás del corredor
     con lo que manda juego.js en `e.persecucion` ({amenaza, grito, ladra,
     atrapa}; ver «La persecución» allá). Es solo imagen:
     - después del primer tropiezo (amenaza) vienen más cerca, el inspector
       corre inclinado y más rápido, y el perro se adelanta;
     - con el grito, el inspector levanta la placa dorada y aparece un globo
       «¡ALTO!» sobre su cabeza (crece de golpe y se desvanece);
     - el perro, cuando ladra, levanta el hocico y da un saltito;
     - al atraparte: el perro salta en arco y cae encima del corredor tendido
       (mirando a la cámara, moviendo la cola), y el inspector se pone a su
       lado, inclinado, con la placa en alto y el globo «¡TE PILLÉ!».
     Los globos son planos con una textura de lienzo (con normales: el SAO
     de la calidad alta redibuja todo lo que es malla), sin niebla y por
     encima de todo; se arman la primera vez que hacen falta y no se sueltan
     con los kits (son del mundo, no de una estación). */
  const persigue = { am: 0, fase: 0, y: 0, perro0: null, inspector0: null, globos: {} };   // lo que dura de un cuadro al otro (y: el piso por el que corren)
  /** Un globo de historieta con `texto`, armado una vez (plano de 1,9 × 0,95 m). */
  function globo(texto) {
    if (persigue.globos[texto]) return persigue.globos[texto];
    const lz = document.createElement('canvas'); lz.width = 512; lz.height = 256;   // la textura
    const g = lz.getContext('2d');
    g.fillStyle = '#ffffff'; g.strokeStyle = '#141420'; g.lineWidth = 12;      // el globo blanco con borde de tinta
    g.beginPath(); g.ellipse(256, 112, 236, 96, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(200, 196); g.lineTo(150, 250); g.lineTo(262, 202); g.closePath(); g.fill(); g.stroke();   // la colita hacia abajo
    g.beginPath(); g.ellipse(256, 112, 230, 90, 0, 0, Math.PI * 2); g.fill();    // tapa la raya donde la colita se une al globo
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${texto.length > 7 ? 92 : 118}px "Lilita One", Impact, "Arial Black", sans-serif`;   // los largos, más chicos
    g.lineWidth = 10; g.strokeStyle = '#141420'; g.strokeText(texto, 256, 118);   // el contorno de las letras…
    g.fillStyle = '#e8263b'; g.fillText(texto, 256, 118);                     // …y las letras rojas
    const tex = new THREE.CanvasTexture(lz); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    m.renderOrder = 999; m.frustumCulled = false; m.visible = false;         // siempre encima, y no se esconde por estar al borde
    escena.add(m);
    return (persigue.globos[texto] = m);
  }
  /** Muestra (o esconde) un globo sobre la cabeza del inspector: crece de golpe y se desvanece al final. */
  function ponGlobo(texto, ver, x, y, z, edad, resta) {
    const m = ver || persigue.globos[texto] ? globo(texto) : null;            // no lo arma si nunca se mostró
    if (!m) return;
    m.visible = !!ver;
    if (!ver) return;
    const crece = Math.min(1, edad / 0.14), rebote = 1 + 0.25 * Math.sin(crece * Math.PI);   // de 0 al tamaño, pasándose un poco
    m.scale.setScalar(Math.max(0.01, crece * rebote));
    m.material.opacity = resta == null ? 1 : Math.min(1, resta / 0.25);       // se desvanece el último cuarto de segundo
    m.position.set(x, y + 0.05 * Math.sin(edad * 9), z);                      // flota apenas
    m.quaternion.copy(camara.quaternion);                                     // de frente a la cámara
  }
  /** Un cuadro de la persecución (ver el comentario de arriba). */
  function pasoPersecucion(e, dt) {
    const PE = e.persecucion || {}, k = e.perseguidor || 0;
    const atrapa = PE.atrapa != null && PE.atrapa >= 0 ? PE.atrapa : -1;      // segundos desde la atrapada (−1: no)
    const vis = k > 0.01 || atrapa >= 0;
    perse.r.raiz.visible = perse.perro.visible = vis;
    const insp = perse.r, perro = perse.perro, [, bd] = insp.brazos;          // bd: el brazo de la placa
    if (!vis) { persigue.perro0 = persigue.inspector0 = null; ponGlobo('¡ALTO!', false); ponGlobo('¡TE PILLÉ!', false); return; }
    persigue.am += ((PE.amenaza ? 1 : 0) - persigue.am) * (1 - Math.exp(-3 * dt));   // se acercan (y se van) en ~0,3 s
    /* Corren por el mismo piso que el corredor: si él va por los techos, ellos
       también (como el guardia de Subway Surfers, que se sube a los trenes).
       Abajo, en la vía, un tren entre ellos y la cámara los tapaba enteros,
       con globo y todo. Suben y bajan suavizado, en ~0,2 s. */
    persigue.y += ((e.suelo || 0) - persigue.y) * (1 - Math.exp(-6 * dt));
    const am = persigue.am, piso = SUELO + persigue.y;
    if (atrapa < 0) {
      // la carrera: detrás, más cerca y más rápido con la amenaza
      persigue.perro0 = persigue.inspector0 = null;
      persigue.fase += dt * (11 + 4 * am);                                    // las zancadas (acumuladas: cambiar el ritmo no salta)
      const z = 2.2 - 0.8 * am + (1 - k) * 9;                                 // a 2,2 m, o a 1,4 con la amenaza
      insp.raiz.position.set(e.x * 0.85 + 0.6, piso, z);
      insp.raiz.rotation.y = 0;
      posa(insp, { modo: 'correr', fase: persigue.fase });
      insp.cuerpo.rotation.x -= 0.22 * am;                                    // inclinado hacia adelante: va con todo
      const grita = (PE.grito || 0) > 0;
      if (grita) { bd.hombro.rotation.set(2.7, 0, 0.25); bd.codo.rotation.x = 0.15; }   // el brazo arriba, mostrando la placa
      perse.placa.visible = grita;
      ponGlobo('¡ALTO!', grita, insp.raiz.position.x, piso + 2.55, z, 1.6 - (PE.grito || 0), PE.grito);
      ponGlobo('¡TE PILLÉ!', false);
      // el perro: adelante del inspector (más con la amenaza), saltando al ladrar
      const ladra = Math.max(0, PE.ladra || 0), hop = ladra > 0 ? Math.sin(Math.min(1, 1 - ladra / 0.35) * Math.PI) : 0;
      perro.position.set(e.x * 0.85 - 0.7, piso + 0.18 * hop, z - 0.9 - 0.6 * am);
      perro.rotation.set(0.35 * hop, 0, 0);                                    // el hocico arriba cuando ladra
      perse.patas.forEach((p, i) => { p.rotation.x = Math.sin(persigue.fase * 1.6 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1 : 0)) * 0.8; });
      perse.cola.rotation.z = Math.sin(e.t * 20) * 0.6;
      return;
    }
    // la atrapada: dónde estaban al empezar (de ahí parten el salto y la caminata)
    if (!persigue.perro0) persigue.perro0 = perro.position.clone();
    if (!persigue.inspector0) persigue.inspector0 = insp.raiz.position.clone();
    const sueloR = (e.suelo || 0) + SUELO;                                    // donde está tendido el corredor (la vía o un techo)
    // el perro: un salto en arco hasta el pecho del corredor (que cayó de espaldas hacia la cámara)
    const u = THREE.MathUtils.clamp((atrapa - 0.08) / (ATERRIZA_PERRO - 0.08), 0, 1);   // 0 → 1 durante el salto
    const destino = _v.set(e.x + 0.05, sueloR + 0.3, 0.95);                   // sobre el pecho
    perro.position.lerpVectors(persigue.perro0, destino, u);
    perro.position.y += 1.3 * Math.sin(u * Math.PI);                          // el arco
    perro.rotation.set(0.5 * (1 - 2 * u) * Math.sin(u * Math.PI), Math.PI * THREE.MathUtils.smoothstep(u, 0, 1), 0);   // se da vuelta en el aire y cae mirando a la cámara
    if (u >= 1) {                                                             // ya encima: ladra moviendo la cabeza y la cola
      const ladra = Math.max(0, PE.ladra || 0);
      perro.position.y += 0.04 * Math.abs(Math.sin(atrapa * 7));              // respira agitado
      perro.rotation.x = 0.3 * Math.sin(Math.min(1, 1 - ladra / 0.6) * Math.PI) * (ladra > 0 ? 1 : 0);
      perse.patas.forEach(p => { p.rotation.x = 0.35; });                     // las patas firmes sobre el pecho
      perse.cola.rotation.z = Math.sin(e.t * 28) * 0.8;                       // la cola, feliz
    } else perse.patas.forEach((p, i) => { p.rotation.x = (i < 2 ? -1 : 1) * 0.9 * Math.sin(u * Math.PI); });   // estirado en el salto
    // el inspector: camina hasta el costado del corredor, se inclina y muestra la placa
    const w = THREE.MathUtils.smoothstep(atrapa / 0.5, 0, 1);
    insp.raiz.position.lerpVectors(persigue.inspector0, _v.set(e.x + 1.05, sueloR, 0.35), w);   // al costado de la cadera (más cerca de la cámara quedaba fuera de cuadro)
    insp.raiz.rotation.y = (Math.PI / 2) * w;                                 // se gira hacia el corredor tendido
    posa(insp, { modo: w < 1 ? 'correr' : 'quieto', fase: e.t * 9, t: atrapa });
    insp.torso.rotation.x = -0.6 * w;                                         // se agacha de la cintura sobre él (las piernas quedan derechas)
    insp.cab.rotation.x = 0.12 + 0.3 * w;                                     // y lo mira
    bd.hombro.rotation.set(2.3, 0, 0.2); bd.codo.rotation.x = 0.3;            // la placa en alto
    perse.placa.visible = true;
    ponGlobo('¡ALTO!', false);
    ponGlobo('¡TE PILLÉ!', atrapa > 0.25, insp.raiz.position.x, insp.raiz.position.y + 2.4, insp.raiz.position.z, atrapa - 0.25, null);
  }
  const chispas = [];                                                         // brillitos al tomar monedas
  let monedasRojas = false;                                                   // ¿las monedas son un peligro? (modo «Sin monedas»)
  let particulas = null, trenFantasma = null, tiempoFantasma = 0;
  let lore = true;                                                            // ¿se cuenta la historia de la Línea 3? (afiches, el 317): solo en su mundo, lo dice juego.js
  let sucesos = null;                                                         // los sucesos de la estación (escenarios.js): farolillos, lluvia, el 317…
  const camPos = new THREE.Vector3(0, 4.7, 8.6), camMira = new THREE.Vector3(0, 0.4, -9);
  const visCity = GANCHOS.crea ? GANCHOS.crea({ escena }) : null;             // CITY: los efectos de City (mundo-city.js), si está cargado

  /* ---- la sensación de velocidad (solo para el ojo) ----
     Nada de esto mueve al corredor: la velocidad de verdad, los metros y los
     puntos los decide juego.js, y el antitrampas los recalcula con la curva
     del motor. Aquí solo se cambia CÓMO se ve:
     - el lente se abre con la velocidad (hasta +11° a 50 m/s) y la cámara
       se acerca y baja un poco: el costado del mundo pasa más rápido;
     - un balanceo apenas visible con cada paso, y la cámara se ladea un
       poco al cambiar de carril;
     - líneas de viento (una sola malla de instancias: una llamada al GPU)
       que aparecen pasados los ~24 m/s;
     - la mochila cohete: un golpe de lente al despegar (un resorte que sale
       y vuelve), las líneas a toda fuerza, temblor de cámara, las llamas
       que crecen y un resplandor detrás del corredor; al aterrizar, un
       golpe hacia abajo.
     La rapidez se mide como k = (V − V0) / (VMAX − V0) con la curva del
     motor (MOTOR.VELOCIDAD), nunca con números escritos aquí: si la curva
     cambia, esto la sigue. Ejemplo: a 15 m/s k = 0; a 32,5 m/s k = 0,5.
     `mov` lo fija el juego: `sacudir` es la opción «Sacudir la pantalla» y
     `quieto` el ajuste del sistema «reducir movimiento»; sin sacudir no hay
     temblor, balanceo ni ladeo, y quieto además quita las líneas y achica
     el golpe de lente. */
  let VEL = MOTOR.VELOCIDAD;                                                  // {V0, VMAX}: la misma curva del juego y del antitrampas (CITY: la cambia `curva`, City tiene la suya)
  const SENS = {
    FOV_VEL: 11,        // grados que se abre el lente a toda velocidad (k = 1)
    FOV_VUELO: 5,       // grados más mientras se vuela con la mochila
    FOV_PATADA: 18,     // grados por unidad del resorte del despegue (el pico queda en ~+10°)
    ACERCA: 0.9,        // metros que la cámara se acerca a toda velocidad…
    BAJA: 0.4,          // …y que baja
    PASO: 0.035,        // el balanceo de cada zancada a toda velocidad (m)
    LADEO: 0.09         // cuánto del ladeo del corredor toma la cámara
  };
  const mov = { sacudir: true, quieto: false };
  const sens = {
    kv: 0,              // k suavizado (el lente no salta de golpe)
    p: 0, pv: 0,        // el resorte del golpe de lente (posición y velocidad)
    cy: 0, cyv: 0,      // el resorte del golpe de cámara al aterrizar (m)
    vuelo: 0,           // 0 a 1: cuánto se nota la mochila (sube y baja suave)
    volaba: false,      // ¿volaba en el cuadro anterior? (para notar el despegue y el aterrizaje)
    cae: false,         // se acabó la mochila y todavía no toca el suelo
    Dantes: null,       // el metro del cuadro anterior: lo que se avanzó mueve las líneas
    lineas: 0,          // la fuerza de las líneas de viento (su opacidad)
    giro: 0,            // el ladeo de la cámara (radianes)
    extra: 0            // los grados que se le suman al lente ahora
  };
  let fovBase = 40;                                                          // el lente sin nada (lo fija `tamano` según la forma de la pantalla)
  const azarL = azarDe(0x11E7A5);                                            // azar propio de las líneas y las llamas (no gasta el Math.random del juego)

  /* Las líneas de viento: rayas finas y largas a lo largo de la vía, por los
     costados y por arriba (nunca sobre los carriles ni sobre el corredor,
     donde están los obstáculos), que pasan más rápido que el mundo. Cada raya
     son dos planos cruzados (se ve desde cualquier ángulo), con la punta de
     adelante brillante y la cola que se apaga: el color de cada vértice es
     su brillo, y con mezcla aditiva el negro no suma nada. */
  const N_LINEAS = 40;
  const lineas = (() => {
    const pos = [], col = [], Z = [-0.5, 0.3, 0.5], B = [0, 1, 0];           // a lo largo: cola apagada, lo más brillante cerca de la punta, punta suave
    for (const vertical of [false, true]) for (let s = 0; s < 2; s++) {
      const A = vertical ? [0, -0.5] : [-0.5, 0], C = vertical ? [0, 0.5] : [0.5, 0];   // los dos bordes largos del plano
      const P = [[...A, Z[s]], [...C, Z[s]], [...C, Z[s + 1]], [...A, Z[s + 1]]], K = [B[s], B[s], B[s + 1], B[s + 1]];
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...P[i]); col.push(K[i], K[i], K[i]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();                                                  // para la oclusión ambiental (ver geoFaro)
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(g, m, N_LINEAS);
    im.frustumCulled = false; im.visible = false; im.count = 0; im.renderOrder = 3; im.name = 'lineas';
    return im;
  })();
  escena.add(lineas);
  const rayas = Array.from({ length: N_LINEAS }, () => ({ x: 0, y: -50, z: 0, l: 1, v: 1, w: 0.05 }));
  let rayasListas = false;
  const _der = new THREE.Vector3(), _arr = new THREE.Vector3(), _fre = new THREE.Vector3(), _r = new THREE.Vector3();
  /** Pone una raya en un lugar nuevo, DENTRO de lo que ve la cámara, entre
      12 y 45 m por delante (`cerca`: desde 3 m, al aparecer) y lejos del
      centro de la pantalla. Como la raya queda quieta de lado y solo avanza
      en z, al acercarse se abre hacia el borde de la pantalla: es el efecto
      de «salto al hiperespacio». Nunca sobre los carriles ni el corredor
      (abajo al centro), donde se leen los obstáculos.
      Ejemplo: sx = 0,8 y sy = 0,5 es arriba a la derecha. */
  function naceRaya(R, cerca, ex, ey) {
    _der.set(1, 0, 0).applyQuaternion(camara.quaternion);                    // los ejes de la cámara: derecha, arriba y adelante
    _arr.set(0, 1, 0).applyQuaternion(camara.quaternion);
    _fre.set(0, 0, -1).applyQuaternion(camara.quaternion);
    const tv = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)), th = tv * camara.aspect;
    for (let k = 0; k < 10; k++) {
      const d = cerca ? 3 + azarL() * 42 : 12 + azarL() * 33;               // a cuántos metros por delante
      // dónde en la pantalla (−1 a 1): tres de cada cuatro por los costados (sobre las fachadas se notan más que sobre el cielo claro)
      const costado = azarL() < 0.75, lado = azarL() < 0.5 ? -1 : 1;
      const sx = costado ? lado * (0.45 + azarL() * 0.55) : azarL() * 2 - 1, sy = costado ? azarL() * 2 - 1 : 0.5 + azarL() * 0.5;
      _r.copy(camPos).addScaledVector(_fre, d).addScaledVector(_der, sx * d * th).addScaledVector(_arr, sy * d * tv);
      if (_r.y < 0.4) continue;                                              // bajo el suelo, no
      if (Math.abs(_r.x - ex) < 2.7 && _r.y < ey + 3.6) continue;            // sobre la vía y el corredor, no
      R.x = _r.x; R.y = _r.y; R.z = _r.z;
      break;
    }
    R.l = 0.6 + azarL() * 0.8;                                               // largo propio de cada una
    R.v = 1.3 + azarL() * 0.9;                                               // pasan entre 1,3 y 2,2 veces más rápido que el mundo
    R.w = 0.09 + azarL() * 0.08;                                             // grosor (m): a 30 m, unos 2 px; al pasar junto a la cámara, más
  }
  /** Mueve y dibuja las líneas de viento. Su fuerza: nada hasta ~24 m/s
      (k = 0,25), 0,6 a 50 m/s, y casi toda con la mochila. Avanzan con lo
      que avanzó el mundo (`dD`), no con el reloj: en la pausa se quedan
      quietas (y se apagan) aunque los cuadros sigan. Ejemplo: a 50 m/s, en
      un cuadro de 1/60 s el mundo avanza 0,83 m y cada raya entre 1,1 y 1,8. */
  function pintaRayas(e, dD, corre, dt) {
    const porVelocidad = THREE.MathUtils.clamp((sens.kv - 0.25) / 0.75, 0, 1) * 0.6;
    const meta = mov.quieto || !corre ? 0 : Math.min(1, Math.max(porVelocidad, sens.vuelo * 0.95) + Math.max(0, sens.p) * 0.3);
    sens.lineas += (meta - sens.lineas) * (1 - Math.exp(-6 * dt));
    if (sens.lineas < 0.01) { lineas.visible = false; return; }             // apagadas no cuestan nada
    const ex = e.x || 0, ey = (e.y || 0) + SUELO;
    if (!rayasListas) { for (const R of rayas) naceRaya(R, true, ex, ey); rayasListas = true; }
    lineas.visible = true;
    lineas.material.opacity = sens.lineas;
    const largo = 2 + 9 * sens.kv + 7 * sens.vuelo;                          // más largas a más velocidad (m)
    const n = Math.round(N_LINEAS * (0.45 + 0.55 * sens.lineas));            // y más mientras más fuerza
    for (let i = 0; i < N_LINEAS; i++) {
      const R = rayas[i];
      R.z += Math.max(0, dD) * R.v;                                          // vienen hacia la cámara
      if (R.z - largo * R.l * 0.5 > camPos.z + 0.5) naceRaya(R, false, ex, ey);   // ya pasó la cámara: vuelve al fondo
      if (i < n) lineas.setMatrixAt(i, _m.compose(_p.set(R.x, R.y, R.z), _q.identity(), _s.set(R.w, R.w, largo * R.l)));
    }
    lineas.count = n; lineas.instanceMatrix.needsUpdate = true;
  }
  /* El resplandor de la mochila cohete: una mancha de luz detrás del
     corredor, solo mientras vuela (una llamada al GPU, solo entonces). */
  const brasa = sprite(0xffa040, 1.2, [0, -50, 0], 0.9);
  brasa.material.fog = false; brasa.visible = false; brasa.renderOrder = 3; escena.add(brasa);

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
      if (kit.series && kit.series.arbol.length) while (frente.arbol[lado] < hasta) {   // árboles en la vereda (instancias)
        const d = frente.arbol[lado];
        frente.arbol[lado] = d + 9 + kit.az() * 8;
        if (enTunel(d - 2, d + 2)) continue;
        const v = kit.series.arbol[Math.floor(kit.az() * 3)];
        // la utilería de una estación nueva va de frente a la vía (un árbol, girado al azar); el azar se pide igual en los dos casos
        const x = lado * (5.45 + kit.az() * 0.3), giro = kit.az(), rot = kit.pal.props ? ESC.giroProp(lado, giro) : giro * 6.28;
        paisaje.push({ serie: v, x, y: SUELO, rot, esc: 0.9 + kit.az() * 0.35, d, largo: 1.5, k: kit });
      }
      while (frente.graf[lado] < hasta) {                                     // grafitis en el muro
        const d = frente.graf[lado];
        frente.graf[lado] = d + 12 + kit.az() * 22;
        if (enTunel(d - 3, d + 3) || kit.az() < 0.35) continue;
        // con la historia, algunos de estos lugares son un afiche de pie en la vereda o un grafiti de la historia (escenarios.js)
        const deco = lore ? ESC.decoraMuro(kit, lado, AYUDA) : null;
        if (deco) { deco.obj.position.set(...deco.pos); paisaje.push({ obj: deco.obj, d, largo: deco.largo, k: kit }); continue; }
        const o = kit.saca('graf' + lado, () => kit.grafiti(lado)); o.position.set(lado * 3.56, 0.6, 0);
        paisaje.push({ obj: o, d, largo: 1.8, k: kit });
      }
    }
    while (frente.farol < hasta) {                                            // faroles, alternando lados
      const d = frente.farol; frente.farol = d + 13;
      if (enTunel(d - 1, d + 1)) continue;
      for (const lado of [-1, 1]) {
        if (kit.series) { paisaje.push({ serie: kit.series.farol[lado], x: lado * 4.55, y: SUELO, rot: 0, esc: 1, d: d + lado * 3, largo: 1, k: kit }); continue; }
        const o = kit.saca('farol' + lado, () => kit.farol(lado)); o.position.set(lado * 4.55, SUELO, 0); paisaje.push({ obj: o, d: d + lado * 3, largo: 1, k: kit });
      }
    }
    while (frente.poste < hasta) {                                            // postes de catenaria
      const d = frente.poste; frente.poste = d + 24;
      if (enTunel(d - 1, d + 1)) continue;
      for (const lado of [-1, 1]) {
        if (kit.series) { paisaje.push({ serie: kit.series.poste[lado], x: lado * 3.45, y: 0, rot: 0, esc: 1, d, largo: 0.6, k: kit }); continue; }
        const o = kit.saca('poste' + lado, () => kit.poste(lado)); o.position.set(lado * 3.45, 0, 0); paisaje.push({ obj: o, d, largo: 0.6, k: kit });
      }
    }
  }
  const _mS = new THREE.Matrix4(), _qS = new THREE.Quaternion(), _eS = new THREE.Euler(), _pS = new THREE.Vector3(), _sS = new THREE.Vector3();
  function mueveCiudad(D) {
    for (let i = paisaje.length - 1; i >= 0; i--) {
      const p = paisaje[i];
      if (p.d + p.largo < D - DETRAS) { if (p.obj) p.k.guarda(p.obj); paisaje.splice(i, 1); continue; }   // ya quedó atrás: a la reserva
      if (p.obj) p.obj.position.z = -(p.d - D);
    }
    if (kit && kit.listaSeries) {                                              // las instancias se escriben de nuevo cada cuadro, como las monedas
      for (const s of kit.listaSeries) s.empieza();
      for (const p of paisaje) if (p.serie) p.serie.pon(_mS.compose(_pS.set(p.x, p.y, -(p.d - D)), _qS.setFromEuler(_eS.set(0, p.rot, 0)), _sS.setScalar(p.esc)));
      for (const s of kit.listaSeries) s.termina();
    }
  }
  function vaciaCiudad(desde) {
    for (const p of paisaje) if (p.obj) p.k.guarda(p.obj);
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
    // el túnel se anota una sola vez (o.vis marcado): antes se volvía a pedir en cada cuadro y sinPaisaje crecía sin parar
    if (o.tipo === 'tunel') { if (tunelObj !== o) { tunelObj = o; sinPaisaje.push([o.d0, o.d0 + o.largo]); } o.vis = { tunel: true }; return; }
    const objCity = GANCHOS.objeto ? GANCHOS.objeto(kit, o) : null;           // CITY: cajones, drones, barandas, lonas, estrellas secretas
    if (objCity) { o.vis = { obj: objCity, kit }; dinamicos.add(o); return; }
    let obj;
    if (o.tipo === 'tren') {                                                  // uno que viene de frente (vel > 0) sale de otra reserva: la de los focos encendidos
      const i = (o.id || 0) % 3, marcha = o.vel > 0;
      obj = kit.saca((marcha ? 'trenM' : 'tren') + i, () => kit.tren(i, marcha)); obj.position.x = CARRILES[o.carril]; obj.rotation.z = 0;
    }
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
  /* `dpr`: cuántos píxeles del lienzo por píxel CSS, como tope (nunca más que
     los del aparato). Estaban en 1,5 / 1,0 / 0,8, y un celular (pantalla de
     3×, calidad media por defecto) dibujaba a un tercio de su resolución y el
     navegador lo estiraba: el juego se veía borroso. Ahora ni la baja queda
     por debajo de 2 (medido en un celular de 3×: con 1,5 todavía se notaba
     blando, sin FXAA que lo disimule), la media va a 2,5 y la alta usa la de
     la pantalla entera. El lienzo de un celular es chico (el escenario 3:4,
     ~360×480 CSS), así que 2× son ~0,7 megapíxeles: lo aguanta. Si el aparato
     no da abasto, «auto» baja de nivel. */
  const AJUSTES = {
    alta: { dpr: 3, sombras: 2048, ao: true, bloom: true, fxaa: true, espejo: true },
    media: { dpr: 2.5, sombras: 1024, ao: false, bloom: true, fxaa: true, espejo: false },
    baja: { dpr: 2, sombras: 0, ao: false, bloom: false, fxaa: false, espejo: false }
  };
  const SIN_NAN = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
        gl_FragColor = c; }`
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
    // cada pasada tiene sus propias texturas (el bloom, la oclusión…): composer.dispose() solo suelta las suyas
    if (composer) { for (const ps of composer.passes) ps.dispose?.(); composer.dispose?.(); composer = null; }
    if (!kit) return;
    const A = AJUSTES[calidad], pal = kit.pal;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = pal.exposicion;
    /* En baja se dibuja directo, sin post-proceso. El estilo cómic es la
       excepción: su contorno de tinta va igual (cuesta lo mismo que dibujar
       directo más un cuadro), porque es lo que recorta los obstáculos. */
    if (calidad === 'baja' && !kit.comic) return;
    /* El suavizado de bordes es MSAA (el lienzo intermedio con 4 muestras por
       píxel), no FXAA: FXAA difumina la imagen ENTERA después de dibujarla
       (texturas, letreros, bordes finos) y era parte de lo «borroso». Con
       2× de densidad o más no hace falta ninguno: el escalón de un borde ya
       es más chico que lo que el ojo separa, y nos ahorramos el costo. */
    const pr = renderer.getPixelRatio();
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());           // el lienzo de verdad, en píxeles
    // el cómic dibuja la escena en su propio lienzo (necesita la profundidad), así que el MSAA de este no le sirve: lo suaviza FXAA
    const muestras = !kit.comic && pr < 2 && renderer.capabilities.isWebGL2 ? 4 : 0;
    const rt = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: muestras });
    const c = new EffectComposer(renderer, rt);
    c.setPixelRatio(1); c.setSize(tam.x, tam.y);                               // en píxeles del lienzo (CSS × densidad)
    if (kit.comic) {
      // la línea de tinta mide 1 píxel del lienzo en una pantalla de 1× y 2 desde 1,5×: así se ve igual de gruesa en todas
      c.addPass(new PasadaTinta(escena, camara, { tinta: pal.tinta ?? 0x1a1420, fuerza: pal.fuerzaTinta ?? 0.85, grosor: pr >= 1.5 ? 2 : 1 }));
    } else c.addPass(new RenderPass(escena, camara));
    if (A.ao && kit.juguete) {
      try {
        const ao = new GTAOPass(escena, camara, ancho, alto);
        /* La oclusión redibuja TODA la escena con un material de normales, y de
           fábrica solo esconde puntos y líneas. Lo que no tiene normales (los
           sprites como el brillo de la mochila cohete, las líneas gruesas del
           neón, las partículas) da NaN en ese pase, y el bloom esparce cada
           NaN en un cuadrado negro: eso es lo que se veía sobre la mochila.
           Aquí se esconde, solo durante el pase de normales, todo lo que no
           tenga normales, así no depende de acordarse objeto por objeto. */
        ao.overrideVisibility = function () {
          const cache = this._visibilityCache;
          this.scene.traverse(o => {
            cache.set(o, o.visible);
            const g = o.geometry;
            const sinNormales = g && g.isBufferGeometry && !g.attributes.normal;
            if (o.isPoints || o.isLine || o.isSprite || o.isLineSegments2 || o.isLine2 || sinNormales || o.userData.sinAO) o.visible = false;   // sinAO: el fantasma (es translúcido)
          });
        };
        ao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.4, thickness: 2, scale: 1.3, samples: 12, distanceFallOff: 1 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
        c.addPass(ao);
      } catch (e) { console.warn('Metro Rush: sin oclusión ambiental', e); }
    }
    /* Red de seguridad antes del bloom: un píxel NaN o infinito (de cualquier
       shader) el bloom lo agranda hasta un cuadrado negro. Aquí se cambia por
       negro y se queda en un píxel. isnan/isinf solo existen en WebGL2. */
    if (A.bloom && pal.post.bloom && renderer.capabilities.isWebGL2) c.addPass(new ShaderPass(SIN_NAN));
    if (A.bloom && pal.post.bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(ancho / 2, alto / 2), ...pal.post.bloom));
    c.addPass(new OutputPass());
    // FXAA solo si no hay MSAA (WebGL1) y la densidad es baja: es el último recurso, porque difumina
    if (A.fxaa && !muestras && pr < 2) { const f = new ShaderPass(FXAAShader); f.uniforms.resolution.value.set(1 / tam.x, 1 / tam.y); c.addPass(f); }
    if (pal.post.vineta) {
      const v = new ShaderPass(ACABADO);
      v.uniforms.vig.value = pal.post.vineta; v.uniforms.sat.value = pal.post.sat || 1;
      v.uniforms.aber.value = 0;                                             // sin aberración cromática: separaba los colores en los bordes y restaba nitidez
      v.uniforms.scan.value = pal.post.lineas || 0; v.uniforms.alto.value = tam.y;
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
    // se suelta entero (el Reflector suelta su textura y su material, pero no la geometría; una malla simple, nada)
    if (espejo) { escena.remove(espejo); espejo.dispose?.(); espejo.geometry.dispose(); espejo.material?.dispose?.(); espejo = null; }
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
      const k = new Kit(mundo, clave, PALETAS[clave] || (GANCHOS.paleta && GANCHOS.paleta(clave)) || PALETAS.barrio);   // CITY: 'muelles@neon' la arma mundo-city.js
      escena.add(k.almacen);
      kits.set(clave, k);
    }
    return kits.get(clave);
  }
  /** Devuelve a la tarjeta de video las geometrías de unos objetos que ya no
      se usan (los materiales son del kit y se van con él). Los sprites
      comparten una geometría de three.js para todos: esa no se toca. */
  function suelta3D(...objs) {
    for (const o of objs) o && o.traverse(x => { if (x.isSprite || !x.geometry) return; x.geometry.dispose(); if (x.material && x.material.userData && x.material.userData.propio) x.material.dispose(); });
  }
  /* Libera los kits que ya no sirven: todos menos el activo y el que se está
     precargando para la estación que viene. Sin esto cada estación dejaba su
     ciudad entera en la tarjeta de video: al llegar a Óxido había cuatro
     (de 685 geometrías se pasaba a 1743). Si una estación vuelve (las
     vueltas desde los 12 M), su kit se arma de nuevo. */
  let kitPrecarga = null;
  function liberaKits() {
    for (const [clave, k] of kits) {
      if (k === kit || k === kitPrecarga || (k.preparando && !k.listo)) continue;
      k.libera(); kits.delete(clave);
    }
  }
  /** Prepara el kit de una estación de a poco (sin trabar la carrera). */
  function precarga(estacion) {
    const k = kitDe(estacion);
    kitPrecarga = k;
    if (k.listo || k.preparando) return;
    k.preparando = true;
    pasosPendientes.push(...k.pasosDePreparacion());
  }
  /* La niebla, un poco más suave que la de cada paleta: empieza un 40 % más
     lejos y termina un 15 % más lejos (se veía la ciudad lavada demasiado
     cerca). El final sigue topado en el borde de lo que se dibuja (vista − 6),
     para que lo que aparece salga de la niebla y no salte a la vista de golpe.
     Ejemplo, Barrio con la vista entera: de 55–175 m pasa a 77–189 m. */
  const SUAVE_NIEBLA = { cerca: 1.4, lejos: 1.15 };
  /** La niebla de la paleta, suavizada y acortada si la vista se acortó (calidad baja). */
  function ajustaNiebla() {
    if (!escena.fog || !kit) return;
    const [cerca, lejos] = kit.pal.niebla, f = vista / VISTA;                  // f < 1 cuando la calidad baja acorta la vista
    const fin = Math.min(lejos * SUAVE_NIEBLA.lejos, vista - 6);                // dónde ya no se ve nada (nunca más allá de lo dibujado)
    escena.fog.far = fin;
    escena.fog.near = Math.min(cerca * SUAVE_NIEBLA.cerca * f, fin - 40);        // dónde empieza, siempre 40 m antes del final
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
    if (kit && kit !== k) { escena.remove(kit.via); escena.remove(kit.cielo); kit.monedas.parent?.remove(kit.monedas); if (kit.seriesRaiz) escena.remove(kit.seriesRaiz); }
    kit = k;
    escena.add(kit.via); escena.add(kit.cielo); escena.add(kit.monedas); if (kit.seriesRaiz) escena.add(kit.seriesRaiz);
    liberaKits();
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
    if (corredor) { escena.remove(corredor.raiz, corredor.sombra); suelta3D(corredor.raiz, corredor.sombra); }
    corredor = armaCorredor(kit, aspecto); escena.add(corredor.raiz, corredor.sombra);
    if (perse) { escena.remove(perse.r.raiz, perse.perro); suelta3D(perse.r.raiz, perse.perro); }
    perse = armaPerseguidor(kit); perse.r.raiz.visible = perse.perro.visible = false; escena.add(perse.r.raiz, perse.perro);
    // partículas del ambiente
    if (particulas) { escena.remove(particulas); particulas = null; }
    const ex = pal.extras;
    if (ex.nieve || ex.polvo || ex.espectros) {
      const n = ex.nieve ? 900 : ex.polvo ? 500 : 220, pos = new Float32Array(n * 3), az = azarDe(5);
      for (let i = 0; i < n; i++) { pos[i * 3] = (az() - .5) * 40; pos[i * 3 + 1] = az() * 16; pos[i * 3 + 2] = -az() * 120 + 10; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); normalesFijas(g);
      /* Con la textura de brillo cada partícula es una mancha redonda y
         suave. Sin textura un punto es un cuadrado, y uno que pasaba junto a
         la cámara se agrandaba hasta tapar un carril: en Fantasma (0,35 m,
         aditivo) era un cuadrado pálido de 120 px encima de la vía. */
      particulas = new THREE.Points(g, new THREE.PointsMaterial({ color: ex.nieve ? 0xffffff : ex.polvo ? 0xe8b080 : 0x9fffe6, size: ex.nieve ? 0.16 : ex.polvo ? 0.1 : 0.45, map: texBrillo(), transparent: true, opacity: ex.espectros ? 0.5 : 0.85, depthWrite: false, blending: ex.espectros ? THREE.AdditiveBlending : THREE.NormalBlending }));
      particulas.userData = { tipo: ex.nieve ? 'nieve' : ex.polvo ? 'polvo' : 'espectros' }; particulas.frustumCulled = false;
      escena.add(particulas);
    }
    // las líneas de viento toman el tono de la estética: cian de noche, crema al atardecer, blancas de día
    lineas.material.color.set(kit.neon ? 0xa8f2ff : 0xffffff);
    if (trenFantasma) { escena.remove(trenFantasma); trenFantasma = null; }
    if (ex.trenFantasma) {
      trenFantasma = new THREE.Mesh(geoTren(L_VAGON * 3), new THREE.MeshBasicMaterial({ color: 0x7dffcf, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      trenFantasma.visible = false; escena.add(trenFantasma);
    }
    // los sucesos de la estación nueva (farolillos, lluvia y relámpagos, focos, el 317 a lo lejos): escenarios.js
    if (sucesos) { sucesos.quita(); sucesos = null; }
    sucesos = ESC.ambiente(kit, escena, AYUDA, lore);
    aplicaSombras();
    tamano(anchoCss, altoCss);                                                 // rearma el post-proceso (el cómic lleva su contorno de tinta)
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
      if (obj.userData.colocar) { obj.userData.colocar(o, D, e.t); continue; }   // CITY: los objetos de City se colocan (y animan) solos
      if (o.tipo === 'tren') {
        obj.position.z = -(o.d0 + o.largo / 2 - D);
        const faro = obj.userData.faro;
        if (faro) {
          /* Las luces de un tren que viene: aparecen de a poco en el último
             30 % de lo que se dibuja (si no, saltarían a la vista de golpe en
             el borde), y si viene por tu carril laten un poco. Además el
             vagón se mece apenas: un tren detenido no se mueve. */
          const dist = o.d0 - D, mio = Math.abs(CARRILES[o.carril] - e.x) < 1.1 && dist > -2;
          const aparece = THREE.MathUtils.clamp((vista - dist) / (vista * 0.3), 0, 1);
          faro.material.opacity = aparece * (mio ? 0.85 + 0.15 * Math.sin(e.t * 16) : 0.8);   // late 2,5 veces por segundo (menos de 3: no encandila)
          obj.rotation.z = o.activo ? Math.sin(e.t * 7.3 + (o.id || 0)) * 0.01 : 0;
        }
      } else if (o.tipo === 'rampa') obj.position.z = -(o.d0 - D);
      else if (o.tipo === 'bajo' || o.tipo === 'alto') obj.position.z = -(o.d - D);
      else {                                                                  // poderes, estrellas y boletos: giran y flotan
        obj.position.set(o.x != null ? o.x : CARRILES[o.carril], (o.y || 1.2) + SUELO + Math.sin(e.t * 3 + o.id) * 0.12, -(o.d - D));
        const cuerpo = obj.getObjectByName('cuerpo'); if (cuerpo) cuerpo.rotation.y = e.t * 2.2 + o.id;
      }
    }
    // monedas: una InstancedMesh
    const im = kit.monedas; let n = 0;
    if (im.userData.peligro !== monedasRojas) { tiñeMonedas(im.material, monedasRojas); im.userData.peligro = monedasRojas; }   // cada kit tiene su material: se tiñe al usarlo
    const late = monedasRojas && !mov.quieto ? 1 + 0.14 * Math.sin(e.t * 9) : 1;   // en «Sin monedas» laten, como una alarma
    for (const o of monedas) {
      if (n >= 400) break;
      const z = -(o.d - D);
      if (z < -vista || z > DETRAS) continue;
      _p.set(o.x != null ? o.x : CARRILES[o.carril], o.y + SUELO, z);
      // una moneda que pasa pegada a la cámara (las del cielo, volando con el lente abierto) se achica: si no, tapa media pantalla
      const dc = _p.distanceTo(camPos), esc = (dc < 4 ? Math.max(0.05, dc / 4) : 1) * late;
      _m.compose(_p, _q.setFromEuler(_e.set(0, e.t * 3 + o.d * 0.15, 0)), _s.set(esc, esc, esc));
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
    // la sensación de velocidad: cuánto se avanzó, qué tan rápido va y si despegó o aterrizó
    const dD = sens.Dantes == null ? 0 : D - sens.Dantes;                     // metros desde el cuadro anterior
    if (dD < -1) { sens.volaba = sens.cae = false; sens.vuelo = 0; sens.p = sens.pv = sens.cy = sens.cyv = 0; }   // una carrera nueva (D volvió a cero): de cero
    sens.Dantes = D;
    const avanza = dD > 1e-4 && !e.menu;                                     // ¿el mundo se mueve? (en pausa, en el menú y tras chocar, no)
    const corre = avanza && !(e.pose && e.pose.modo === 'caer');
    const kv = corre ? THREE.MathUtils.clamp(((e.v || 0) - VEL.V0) / (VEL.VMAX - VEL.V0), 0, 1) : 0;   // 0 a V0, 1 a VMAX
    sens.kv += (kv - sens.kv) * (1 - Math.exp(-2.5 * dt));                  // en ~0,4 s: el lente no salta
    const vuela = corre && !!(e.poderes && e.poderes.mochila);
    if (avanza && vuela !== sens.volaba) {                                   // despegó, o se le acabó la mochila, en este cuadro
      if (vuela) { sens.pv += mov.quieto ? 4 : 9; sens.cae = false; }        // despegue: el lente se abre de golpe y vuelve
      else { sens.pv -= 1.5; sens.cae = true; }                              // se apagó: el lente se cierra un poco y empieza la caída
      sens.volaba = vuela;
    }
    /* --- El pogo también se siente (ronda 2) ---
       Al saltar con el pogo el lente se abre de golpe (menos que con la
       mochila) y al aterrizar la cámara cae un poco, como un golpe seco.
       Solo mira el borde: el cuadro en que empieza y el que termina. */
    const enPogo = corre && !!(e.poderes && e.poderes.pogo);                 // ¿va en el pogo este cuadro?
    if (avanza && enPogo !== !!sens.pogoAntes) {                              // empezó o terminó en este cuadro
      if (enPogo) sens.pv += mov.quieto ? 3 : 7;                              // el resorte se suelta: patada al lente
      else { sens.cyv -= 3.5; if (mov.sacudir && !mov.quieto) sacudida = Math.max(sacudida, 0.22); }   // la goma toca el techo o la vía
      sens.pogoAntes = enPogo;                                                // recuerda para el próximo cuadro
    }
    if (sens.cae && corre && (e.y || 0) - (e.suelo || 0) < 0.05) {          // tocó el suelo (o un techo) después de volar: el golpe
      sens.cae = false; sens.pv -= 2.5; sens.cyv -= 4.5;
      if (mov.sacudir && !mov.quieto) sacudida = Math.max(sacudida, 0.3);
    }
    // dos resortes con amortiguación: salen con el golpe y vuelven solos a cero, con un rebote chico
    sens.pv += (-60 * sens.p - 9 * sens.pv) * dt; sens.p += sens.pv * dt;
    sens.cyv += (-70 * sens.cy - 10 * sens.cyv) * dt; sens.cy += sens.cyv * dt;
    sens.vuelo += ((vuela ? 1 : 0) - sens.vuelo) * (1 - Math.exp(-4 * dt));
    // el corredor
    if (corredor) {
      const r = corredor, P = e.poderes || {};
      r.raiz.position.set(e.x, e.y + SUELO + (P.pogo && !e.menu ? 0.55 : P.patineta ? 0.12 : 0), 0);   // en el pogo, la goma toca donde iban los pies
      // en el menú se da vuelta y mira a la cámara (en la tienda gira despacio, como en un probador)
      const giro = !e.menu ? 0 : Math.PI + (e.menu === 'tienda' ? Math.sin(e.t * 0.55) * 0.5 : Math.sin(e.t * 0.4) * 0.12);
      r.raiz.rotation.y += (giro - r.raiz.rotation.y) * (1 - Math.exp(-7 * (e.dt || 0.016)));
      posa(r, e.pose || { modo: 'correr', fase: 0 });
      r.cohete.visible = !!P.mochila;
      r.llamas.scale.y = 0.7 + Math.random() * 0.6;
      brasa.visible = !!P.mochila && !e.menu;
      if (P.mochila && avanza) {
        /* Volando, las llamas tiemblan fuerte (cambian de largo y de grosor en
           cada cuadro) y el golpe del despegue las estira; el resplandor va
           en la boca de las toberas y late con ellas. */
        const golpe = Math.max(0, sens.p), largo = 0.8 + azarL() * 1.0 + golpe * 1.4;
        r.llamas.scale.set(0.8 + azarL() * 0.4, largo, 0.8 + azarL() * 0.4);
        brasa.scale.setScalar(0.8 + largo * 0.45 + golpe * 1.2);
      }
      if (brasa.visible) { r.llamas.updateWorldMatrix(true, false); r.llamas.localToWorld(brasa.position.set(0, -0.3, 0.06)); }   // a un tercio de las llamas (ya estiradas por su escala)
      r.tabla.visible = !!P.patineta && !P.pogo;
      r.pogo.visible = !!P.pogo && !e.menu;
      r.aura.visible = !!P.iman; r.aura.rotation.z = e.t * 3;
      for (const pp of r.piernas) pp.brilloZap.visible = !!P.zapatillas;
      r.sombra.position.set(e.x, (e.suelo || 0) + SUELO + 0.01, 0);
      r.sombra.scale.setScalar(Math.max(0.4, 1 - (e.y - (e.suelo || 0)) * 0.15));
    }
    if (visCity) visCity.paso(e, corredor);                                  // CITY: la burbuja del chicle y los trozos de lo que se pisó
    // el inspector y el perro (vienen detrás cuando tropiezas)
    if (perse) pasoPersecucion(e, dt);
    /* El fantasma: e.fantasma = {x, y, z (metros por delante de ti; negativo,
       detrás), pose, alfa (0 a 1), nombre} o null. Se arma con el kit de la
       estación (sus geometrías salen del kit) y se rearma si el kit o el
       nombre cambian. */
    const ef = e.fantasma;
    if (fan && (!ef || fan.kit !== kit || fan.nombre !== ef.nombre)) { escena.remove(fan.r.raiz); suelta3D(fan.r.raiz, fan.r.sombra); fan.cartel.material.map.dispose(); fan.cartel.material.dispose(); fan = null; }
    if (ef && !fan) { fan = armaFantasma(kit, ef.nombre); escena.add(fan.r.raiz); }
    if (fan) {
      const a = THREE.MathUtils.clamp(ef.alfa == null ? 1 : ef.alfa, 0, 1);
      fan.r.raiz.visible = a > 0.01 && -ef.z < DETRAS && ef.z < vista;          // fuera de lo que se dibuja, no se dibuja
      fan.mat.opacity = 0.45 * a; fan.cartel.material.opacity = 0.85 * a;
      fan.r.raiz.position.set(ef.x, ef.y + SUELO, -ef.z);
      posa(fan.r, ef.pose || { modo: 'correr', fase: 0 });
      fan.cartel.visible = !(ef.pose && ef.pose.modo === 'caer');             // caído, sin letrero
    }
    // la cámara: detrás y arriba, sigue al corredor con suavidad
    // en el suelo la cámara casi no sube con el salto (se ve el salto); en
    // los techos sube un poco menos que él (se ve la vía de abajo); volando
    // con la mochila lo sigue metro a metro, o el corredor se sale por arriba
    /* --- La altura de la cámara, continua (ronda 2) ---
       Antes eran tres tramos con un salto en y = 1: con el salto nuevo de
       2,1 m la cámara pegaba un tirón a mitad de cada salto. Ahora es el
       mayor de tres pisos, y todos crecen sin saltos:
       - lo de siempre: 0,75 de la altura del piso que pisa (en un techo, 2,51
         como antes) más 0,4 de lo que salta sobre él (casi no se mueve: se ve
         el salto);
       - nunca más de 2 m por debajo del corredor, para que un salto con
         zapatillas o el pogo no se salgan por arriba de la pantalla; en el
         pogo, que sube a 13 m/s, se adelanta además lo que va a subir en el
         suavizado de la cámara (0,17 s), o la cámara llegaba tarde;
       - con la mochila, 1,2 m por debajo, como antes (a 8,5 m da 7,3);
       - en las burbujas de City (baja gravedad, salto doble), 1,4 m por
         debajo: con 2 m la cabeza tocaba el borde de arriba de la pantalla. */
    const sueloC = e.suelo || 0, yR = e.y || 0;                                 // el piso que pisa y la altura del corredor
    const vyPogo = e.pose && e.pose.modo === 'pogo' ? Math.max(0, e.pose.vy || 0) : 0;   // cuánto sube el pogo (m/s)
    const yC = Math.max(
      0.75 * sueloC + 0.4 * (yR - sueloC),                                    // pegada al piso, casi quieta en el salto
      yR - 2.0 + vyPogo * 0.17,                                               // no lo deja salirse por arriba
      e.poderes && e.poderes.mochila ? yR - 1.2 : -Infinity,                  // volando con la mochila, como antes
      e.poderes && e.poderes.flota ? yR - 1.4 : -Infinity);                   // en las burbujas de City: el salto doble llega alto y se salía por arriba
    const k = 1 - Math.exp(-6 * dt);
    if (e.menu) {
      /* La cámara del menú, delante del corredor y a la altura del pecho.
         Portada: el corredor al centro, ocupando casi la mitad del alto.
         Tienda: corrido a la izquierda (en vertical, arriba), para que la
         lista quede al lado (o debajo) sin taparlo. Al empezar a correr la
         cámara vuelve sola detrás de él con el mismo suavizado. */
      const vertical = ancho / alto < 1;
      const [px, py, pz, my] = e.menu === 'tienda'
        ? (vertical ? [0, 0.81, 4.5, -0.39] : [1.3, 1.2, 4.0, 0.95])
        : (vertical ? [0, 1.2, 2.7, 0.95] : [0, 1.25, 4.45, 0.95]);
      camPos.lerp(_v.set(e.x + px, py, pz), k);
      camMira.lerp(_v.set(e.x + px, my, 0), k);
    } else if (e.pose && e.pose.modo === 'caer') {
      /* Tras un choque la cámara se acerca y baja la mirada hacia el
         corredor tendido. Desde la de correr (que mira 18 m adelante) el
         cuerpo, que cae hacia la cámara, quedaba justo en el borde de abajo
         de la pantalla. Se mueve con el mismo suavizado, en medio segundo. */
      const yS = (e.y || 0) * 0.75;                               // sobre un techo, la cámara sube con él
      camPos.lerp(_v.set(e.x * 0.6, 3.4 + yS + ajusteRetrato.y * 0.6, 6.2 + ajusteRetrato.z * 0.6), k);
      camMira.lerp(_v.set(e.x * 0.5, 0.3 + yS, -2.5), k);           // el corredor queda en el tercio de abajo (arriba va «¿Seguir corriendo?»)
    } else {
      /* Corriendo: a más velocidad la cámara se acerca y baja un poco (con el
         lente más abierto, el costado pasa más rápido). Volando no: con el
         lente tan abierto, las monedas del cielo que pasan bajo la cámara
         se veían enormes en el borde de abajo. */
      const acerca = sens.kv * (1 - sens.vuelo);
      camPos.lerp(_v.set(e.x * 0.45, 4.7 + yC + ajusteRetrato.y - SENS.BAJA * acerca, 8.6 + ajusteRetrato.z - SENS.ACERCA * acerca), k);
      camMira.lerp(_v.set(e.x * 0.3, 0.4 + yC * 1.05, -9), k);
    }
    camara.position.copy(camPos);
    camara.position.y += sens.cy;                                             // el golpe del aterrizaje de la mochila
    if (sacudida > 0) { camara.position.x += (Math.random() - .5) * sacudida; camara.position.y += (Math.random() - .5) * sacudida; sacudida = Math.max(0, sacudida - dt * 2.5); }
    const mueve = mov.sacudir && !mov.quieto;                                 // ¿se permite mover la cámara por gusto?
    if (mueve && corre) {
      // el paso: la cámara baja y sube apenas con cada zancada, más a más velocidad
      if (e.pose && e.pose.modo === 'correr') camara.position.y += SENS.PASO * sens.kv * (Math.abs(Math.cos(e.pose.fase || 0)) * 2 - 1);
      // la mochila: un temblor fino y continuo (sumas de senos: parejo aunque los cuadros duren distinto)
      if (sens.vuelo > 0.01) {
        const a = 0.045 * sens.vuelo;
        camara.position.x += a * (Math.sin(e.t * 31) + 0.5 * Math.sin(e.t * 53 + 2));
        camara.position.y += a * (Math.sin(e.t * 37 + 1) + 0.5 * Math.sin(e.t * 61));
      }
    }
    camara.lookAt(camMira);
    // la cámara se ladea un poco hacia donde se mueve el corredor al cambiar de carril
    sens.giro += ((mueve && corre ? ((e.pose && e.pose.ladeo) || 0) * SENS.LADEO : 0) - sens.giro) * (1 - Math.exp(-8 * dt));
    if (Math.abs(sens.giro) > 1e-4) camara.rotateZ(sens.giro);
    // el lente: se abre con la velocidad y con la mochila, más el golpe del despegue (con tope, por si se juntan)
    const curva = 1 - Math.pow(1 - sens.kv, 1.5);                            // sube rápido al principio y se aplana arriba: a 32 m/s ya va en +7°
    sens.extra = Math.min(24, SENS.FOV_VEL * curva + SENS.FOV_VUELO * sens.vuelo + SENS.FOV_PATADA * sens.p);
    if (Math.abs(camara.fov - (fovBase + sens.extra)) > 0.01) { camara.fov = fovBase + sens.extra; camara.updateProjectionMatrix(); }
    pintaRayas(e, dD, corre, dt);
    kit.cielo.position.copy(camara.position);
    // partículas del ambiente
    if (particulas) {
      const a = particulas.geometry.attributes.position, tipo = particulas.userData.tipo, vz = (e.v || 15) * dt;
      // vuelven al fondo antes de llegar a la cámara (está en z = 8,6): pegadas a ella tapaban la vía; los espectros, aún antes (son grandes)
      const tope = tipo === 'espectros' ? -2 : 4;
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i), y = a.getY(i), z = a.getZ(i) + vz;
        if (tipo === 'nieve') { y -= dt * 2.2; x += Math.sin(e.t + i) * dt * 0.6; }
        else if (tipo === 'polvo') { x += dt * 3; y += Math.sin(e.t * 2 + i) * dt * 0.3; }
        else { y += Math.sin(e.t * 0.7 + i) * dt * 0.5; }
        if (z > tope) z -= 130;
        if (y < 0) y += 16; if (x > 20) x -= 40;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true;
    }
    if (sucesos) sucesos.paso(e, dt, camara, mov);                           // los sucesos de la estación (escenarios.js)
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
  /** La densidad de la pantalla (píxeles del aparato por píxel CSS). */
  const dprAparato = () => window.devicePixelRatio || 1;
  /** Cuántos píxeles del lienzo por píxel CSS (nunca más que los del aparato). */
  function proporcion() {
    return Math.min(dprAparato(), AJUSTES[calidad].dpr);
  }
  let anchoCss = 1280, altoCss = 720;                                         // el tamaño CSS exacto (con decimales) de la pantalla
  const ajusteRetrato = { y: 0, z: 0 };
  function tamano(w, h) {
    anchoCss = Math.max(1, w); altoCss = Math.max(1, h);                      // el tamaño CSS exacto, con decimales
    ancho = Math.max(1, w | 0); alto = Math.max(1, h | 0);
    const asp = ancho / alto;
    renderer.setPixelRatio(proporcion());
    renderer.setSize(ancho, alto, false);
    canvas.style.width = canvas.style.height = canvas.style.imageRendering = '';     // al 100 % de la hoja de estilos
    // el ángulo de visión se ajusta para que siempre quepan los tres carriles (en un celular vertical, más abierto)
    fovBase = THREE.MathUtils.clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(33)) / asp) * 180 / Math.PI, 40, 74);
    camara.fov = fovBase + sens.extra;                                         // más lo que la velocidad le está sumando ahora (ver `paso`)
    ajusteRetrato.y = asp < 1 ? 1.2 * (1 - asp) : 0; ajusteRetrato.z = asp < 1 ? 2.2 * (1 - asp) : 0;
    camara.aspect = asp; camara.updateProjectionMatrix();
    /* Las líneas (los bordes del neón, la rejilla, los cables) miden su grosor
       en píxeles de esta resolución. Antes era la del lienzo (CSS × densidad),
       y en un celular de 3× un borde de 2,2 px quedaba de 0,7 px: casi
       invisible. En píxeles CSS el grosor es el mismo en cualquier pantalla. */
    mundo.resolucion.set(ancho, alto);
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
    // la cuenta de llamadas se reinicia una vez por cuadro (no en cada pasada del post-proceso), para que sume todo lo que de verdad cuesta
    dibuja() { renderer.info.reset(); if (composer) composer.render(); else renderer.render(escena, camara); },
    tamano,
    /** Cambia la calidad: 'alta' | 'media' | 'baja'. */
    calidad(nivel) { if (!AJUSTES[nivel] || nivel === calidad) return; calidad = nivel; vista = nivel === 'baja' ? 125 : VISTA; ajustaNiebla(); tamano(anchoCss, altoCss); aplicaSombras(); },
    /** Hasta cuántos metros por delante se dibuja (el juego no crea dibujos más allá). */
    get vista() { return vista; },
    get nivelCalidad() { return calidad; },
    /** Cambia los colores del corredor (aspecto de la tienda). */
    aspecto(asp) { aspecto = asp; if (kit && corredor) { escena.remove(corredor.raiz, corredor.sombra); suelta3D(corredor.raiz, corredor.sombra); corredor = armaCorredor(kit, aspecto); escena.add(corredor.raiz, corredor.sombra); aplicaSombras(); } },
    /** Sacude la cámara (un choque). */
    sacude(f) { sacudida = Math.max(sacudida, f); },
    /** Qué movimientos de cámara se permiten (ver «la sensación de velocidad»):
        `sacudir` = la opción del juego; `quieto` = el sistema pide reducir el movimiento. */
    movimiento(o) { Object.assign(mov, o); },
    /** ¿Se cuenta la historia de la Línea 3 en la vía (afiches, grafitis de la historia, el 317)? Solo en su mundo: juego.js lo apaga en City. Vale para lo que se ponga desde ahora. */
    lore(si) { lore = !!si; },
    /** CITY: la curva de velocidad con que se mide la sensación de velocidad
        ({V0, VMAX}): la del mundo de la carrera (City tiene la suya). */
    curva(V) { if (V && V.VMAX > V.V0) VEL = V; },
    /** CITY: los efectos de City (null sin mundo-city.js): chicle(si), rompe(o, col). */
    city: visCity,
    /** Pinta las monedas de rojo (y latiendo) si `si`: el modo «Sin monedas». */
    monedasPeligro(si) { monedasRojas = !!si; },
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
    /** Para depurar: cuántas mallas visibles hay, agrupadas por qué son (edificio, árbol, tren…). */
    desglose() {
      const n = {};
      const visible = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
      escena.traverse(o => {
        if (!o.isMesh || !visible(o)) return;
        let t = 'otro'; for (let x = o; x; x = x.parent) if (x.userData && x.userData.tipoReserva) { t = x.userData.tipoReserva; break; }
        if (o === lineas) t = 'lineas';
        if (t === 'otro' && kit) { if (o === kit.monedas) t = 'monedas'; else for (let x = o; x; x = x.parent) { if (x === kit.via) { t = 'via'; break; } if (x === kit.cielo) { t = 'cielo'; break; } if (corredor && x === corredor.raiz) { t = 'corredor'; break; } } }
        n[t] = (n[t] || 0) + 1;
      });
      return n;
    },
    /** Para depurar: cuántas llamadas al GPU hizo el último cuadro. */
    info: () => ({ llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, kit: kit && kit.clave, calidad,
      geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures, programas: (renderer.info.programs || []).length, kits: kits.size })
  };
}
