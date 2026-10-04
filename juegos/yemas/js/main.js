// Yemas: shooter de huevos en primera persona.
// Suelto es práctica contra bots; con ?modo=online dentro de la sala de Juegos,
// la sala le pasa los demás jugadores y anota las muertes en el registro.
import * as THREE from 'three';
import {
  crearMundo, moverCuerpo, empujaCuerpo, metido, rayoMundo, rayoHuevo, crearHuevo, crearBandera, crearBase, crearPedestal,
  SPAWNS, BASES, PUNTOS_ARMA, SKINS, ALTO, OJOS,
} from 'yemas/mundo';
import {
  ARMAS, SARTEN, ESPATULA, ZOMBI, ESPATULA_CFG, RECARGAS, NOMBRE_ARMA, GRANADAS, TIPOS_GRANADA, caida, armaEnPunto,
  BEBIDAS, conPap, RECARGAS_ZOMBIS, MAQUINA, ICONO_BEBIDA, BONOS,
} from 'yemas/armas';
import { sonido } from 'yemas/audio';
import { conectarMarco, conectarLocal, PALETA, COLOR_EQUIPO } from 'yemas/red';
import { crearGranadas, GRANADA } from 'yemas/granada';
import { crearZombis, ZB, CLASE, novedadRonda, esPerros } from 'yemas/zombis';
import { MAPAS, LISTA_MAPAS } from 'yemas/mapas';
import { crearInteractivo } from 'yemas/interactivo';
import { crearBonos } from 'yemas/bonos';

const VEL = 7, SALTO = 8, SENS = 0.0022, HZ_RED = 12, INVULNERABLE = 1.5;
// Correr: Shift mientras se avanza. Deslizarse: C mientras se corre; sale
// disparado en la dirección en que iba, frena solo y termina el sprint (para
// volver a correr hay que soltar Shift y apretarlo de nuevo).
const SPRINT = 1.6;
const DESLIZ = { vel: 15, dura: 0.9, roce: 1.6, enfriar: 1.2, baja: 0.6 };
const ONLINE = new URLSearchParams(location.search).get('modo') === 'online' && parent !== window;
const $ = id => document.getElementById(id);
document.documentElement.classList.toggle('en-sala', ONLINE);

// ---------- Preferencias de cada uno ----------
// Sensibilidad del mouse, skin y las dos granadas que se llevan en cada vida.
// Viven en este navegador, no en la sala.
const pref = (() => {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('yemas.pref') || '{}'); } catch {}
  const sens = Number(p.sens);
  return {
    sens: Number.isFinite(sens) && sens >= 0.2 && sens <= 3 ? sens : 1,
    skin: SKINS[p.skin] ? p.skin : 'clasico',
    granadas: Array.isArray(p.granadas) && p.granadas.length === 2 && p.granadas.every(g => GRANADAS[g]) ? p.granadas : ['duro', 'duro'],
  };
})();
const guardaPref = () => { try { localStorage.setItem('yemas.pref', JSON.stringify(pref)); } catch {} };

// ---------- Escena ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const escena = new THREE.Scene();
escena.background = new THREE.Color('#a9dcff');
escena.fog = new THREE.Fog('#a9dcff', 45, 120);
const camara = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
camara.rotation.order = 'YXZ';
escena.add(camara);

const cielo = new THREE.HemisphereLight('#ffffff', '#c9b28a', 1.6);
escena.add(cielo);
const sol = new THREE.DirectionalLight('#fff3dd', 2.2);
sol.position.set(20, 40, 12);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
sol.shadow.bias = -0.0005;
escena.add(sol);

// En zombis el mundo se vuelve a armar con el mapa elegido (alConfig); los
// colisores son siempre la misma lista, que granadas y zombis ya tienen.
const colisores = [];
let mundo = crearMundo(escena, null, colisores);
let inter = null;   // lo que se compra y se toca en zombis (interactivo.js)
let bonos = null;   // las bonificaciones que sueltan los zombis (bonos.js)

// El arma en primera persona va en su propia escena para que no atraviese paredes
const escenaArma = new THREE.Scene();
const camaraArma = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
escenaArma.add(new THREE.HemisphereLight('#ffffff', '#886644', 2.2));
const luzArma = new THREE.DirectionalLight('#ffffff', 1.5);
luzArma.position.set(1, 2, 1);
escenaArma.add(luzArma);

// Un modelo por arma: sirve para la mano y para el arma tirada en el piso.
const MEDIDAS = { 0: [0.55, 0.09, 0.025], 1: [0.5, 0.13, 0.045], 2: [0.85, 0.08, 0.025], 6: [0.9, 0.16, 0.075], 7: [0.32, 0.07, 0.022],
  10: [0.45, 0.12, 0.04], 11: [0.95, 0.13, 0.035], 12: [0.75, 0.08, 0.022] };
function construyeArma(id) {
  const a = ARMAS[id];
  const g = new THREE.Group();
  const oscuro = new THREE.MeshLambertMaterial({ color: '#2d2d35' });
  if (id === ESPATULA) {
    // La espátula dorada: mango redondo y una paleta plana con ranuras.
    const oro = new THREE.MeshPhongMaterial({ color: '#f2c230', emissive: '#6b4a00', specular: '#fff6cc', shininess: 90 });
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 10), oro);
    mango.rotation.x = Math.PI / 2;
    mango.position.z = 0.06;
    const paleta = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.15), oro);
    paleta.position.z = -0.14;
    g.add(mango, paleta);
    for (const x of [-0.03, 0, 0.03]) {
      const ranura = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.09), oscuro);
      ranura.position.set(x, 0, -0.14);
      g.add(ranura);
    }
    return g;
  }
  if (id === MAQUINA) {
    // La Máquina de muerte: una ametralladora pesada de seis cañones que giran.
    const fierro = new THREE.MeshPhongMaterial({ color: a.color, specular: '#aaaaaa', shininess: 60 });
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.34), fierro);
    caja.position.z = 0.02;
    const giro = new THREE.Group();
    giro.position.set(0, 0.01, -0.18);
    for (let i = 0; i < 6; i++) {
      const th = i / 6 * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 8), oscuro);
      c.rotation.x = Math.PI / 2;
      c.position.set(Math.cos(th) * 0.045, Math.sin(th) * 0.045, -0.3);
      giro.add(c);
    }
    for (const z of [-0.05, -0.4, -0.58]) {
      const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 16), fierro);
      aro.rotation.x = Math.PI / 2;
      aro.position.z = z;
      giro.add(aro);
    }
    const asa = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), oscuro);
    asa.position.set(0, 0.12, -0.02);
    const cinta = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: '#6a5a2a' }));
    cinta.position.set(-0.13, -0.04, 0.02);
    const mango = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), oscuro);
    mango.position.set(0, -0.14, 0.1);
    mango.rotation.x = 0.3;
    g.add(caja, giro, asa, cinta, mango);
    g.userData.giro = giro;
    return g;
  }
  if (a.melee) {
    // La sartén: el fondo negro, el borde y el mango de madera.
    const fierro = new THREE.MeshPhongMaterial({ color: a.color, specular: '#888888', shininess: 40 });
    const fondo = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.035, 24), fierro);
    fondo.position.z = -0.27;
    const borde = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.012, 6, 24), fierro);
    borde.rotation.x = Math.PI / 2;
    borde.position.set(0, 0.018, -0.27);
    const mango = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.2), new THREE.MeshLambertMaterial({ color: '#5a3a24' }));
    mango.position.z = -0.03;
    g.add(fondo, borde, mango);
    return g;
  }
  const [largo, ancho, r] = MEDIDAS[id];
  const cuerpo = new THREE.MeshLambertMaterial({ color: a.color });
  const caja = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.12, largo * 0.55), cuerpo);
  caja.position.z = -largo * 0.2;
  g.add(caja);
  const canon = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 12), a.cohete ? cuerpo : oscuro);
  canon.rotation.x = Math.PI / 2;
  canon.position.set(0, a.cohete ? 0.06 : 0.03, -largo * 0.5);
  g.add(canon);
  const mango = new THREE.Mesh(new THREE.BoxGeometry(ancho * 0.8, 0.16, 0.08), oscuro);
  mango.position.set(0, -0.11, 0.02);
  mango.rotation.x = 0.3;
  g.add(mango);
  if (a.zoom) {
    const mira = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), oscuro);
    mira.rotation.x = Math.PI / 2;
    mira.position.set(0, 0.11, -0.2);
    g.add(mira);
  }
  return g;
}
const modelos = {};
for (const id of Object.keys(ARMAS)) {
  modelos[id] = construyeArma(+id);
  modelos[id].visible = false;
  escenaArma.add(modelos[id]);
}
// La bazuca es grande: en la mano va más chica y más abajo, o tapa media pantalla.
modelos[6].scale.setScalar(0.7);
modelos[MAQUINA].scale.setScalar(0.85);

// Con Pack-a-Punch el arma se ve metalizada: un cromo con un brillo violeta
// que va cambiando de tono, para que se note desde lejos que es especial.
const matsPap = [];
function metaliza(g) {
  g.traverse(o => {
    if (!o.isMesh) return;
    const base = o.material.color ? o.material.color.clone() : new THREE.Color('#888888');
    const c = base.lerp(new THREE.Color('#b8bcd8'), 0.55);
    o.material = new THREE.MeshPhongMaterial({ color: c, specular: '#ffffff', shininess: 160, emissive: '#3a1a80', emissiveIntensity: 0.5 });
    matsPap.push(o.material);
  });
  return g;
}
const modelosPap = {};
for (const id of Object.keys(ARMAS)) {
  if (ARMAS[id].melee || +id === MAQUINA || +id === ESPATULA) continue;
  modelosPap[id] = metaliza(construyeArma(+id));
  modelosPap[id].visible = false;
  modelosPap[id].scale.copy(modelos[id].scale);
  escenaArma.add(modelosPap[id]);
}
const _tono = new THREE.Color();
function brilloPap() {
  const t = performance.now() / 1000;
  _tono.setHSL((0.72 + 0.12 * Math.sin(t * 1.3)) % 1, 0.9, 0.35 + 0.1 * Math.sin(t * 3.1));
  for (const mt of matsPap) mt.emissive.copy(_tono);
}

// La bebida: una botella que sube a la boca, se empina y se baja. Mientras
// se toma no hay arma en la mano (ni disparos).
const BEBER = 1.4;
const botella = new THREE.Group();
const vidrio = new THREE.MeshPhongMaterial({ color: '#ffffff', specular: '#ffffff', shininess: 120, transparent: true, opacity: 0.92 });
{
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 14), vidrio);
  const hombro = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 0.05, 14), vidrio);
  hombro.position.y = 0.11;
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 10), vidrio);
  cuello.position.y = 0.16;
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.015, 10), new THREE.MeshPhongMaterial({ color: '#d8d8d8', shininess: 80 }));
  tapa.position.y = 0.195;
  const etiqueta = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.07, 14), new THREE.MeshLambertMaterial({ color: '#f4efe0' }));
  botella.add(cuerpo, hombro, cuello, tapa, etiqueta);
}
botella.visible = false;
escenaArma.add(botella);
function pasoBotella(ver) {
  botella.visible = ver;
  if (!ver) return;
  vidrio.color.set(yo.bebidaColor);
  const t = 1 - yo.bebiendo / BEBER;
  // Sube (0–0.25), se empina (0.25–0.8) y baja (0.8–1).
  const sube = Math.min(1, t / 0.25), baja = Math.max(0, (t - 0.8) / 0.2);
  const k = sube * (1 - baja);
  const empina = Math.min(1, Math.max(0, (t - 0.2) / 0.2)) * (1 - baja);
  // El cuello mira a la cámara (+z) y el fondo se levanta: girar hacia el
  // lado negativo empinaba la botella con el cuello alejándose y el fondo
  // contra la cara, que en pantalla se leía como una botella al revés.
  botella.position.set(0.22 - 0.2 * k, -0.45 + 0.36 * k, -0.45 + 0.08 * k);
  botella.rotation.set(0.1 + 1.95 * empina, 0, 0.25 * (1 - k));
}
function beber(color) {
  yo.bebiendo = BEBER;
  yo.bebidaColor = color || '#ffffff';
  yo.recargando = 0;
  yo.zoom = 0;
}

// Los zombis son cuerpos: no se los atraviesa. Se empuja al jugador hacia
// afuera en el plano; si está casi encima de uno (al caerle desde arriba),
// se lo deja apoyado sobre la cabeza en vez de hundirlo.
//
// El empujón se suma de todos los zombis y se aplica con `empujaCuerpo`, que
// choca con las paredes como caminar. Antes se sumaba a la posición a pelo:
// rodeado contra un muro, el empujón te metía dentro de la pared y la física
// te sacaba por arriba, parado sobre el muro y fuera del mapa. Con el tope
// por cuadro, una horda que aprieta desde todos lados te deja quieto en vez
// de lanzarte.
const RADIO_CHOQUE = 0.85, EMPUJE_MAX = 0.25;
function chocaZombis() {
  let ex = 0, ez = 0;
  for (const z of zombis.lista.values()) {
    if (z.sube < 1 || z.fase !== 'dentro') continue;
    const p = z.mesh.position, ud = z.mesh.userData;
    // El Mutante ocupa casi el doble; un perro, la mitad de alto.
    const e = ud.escala || 1, al = ALTO * e * (ud.alto || 1), radio = RADIO_CHOQUE * Math.max(0.9, e * 0.85);
    const dy = yo.pos.y - p.y;
    if (dy < -1.6 || dy > al) continue;
    let dx = yo.pos.x - p.x, dz = yo.pos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d >= radio) continue;
    if (dy > al * 0.75 && yo.vel.y <= 0) {
      // Encima de la cabeza: se apoya, si arriba hay lugar.
      const y0 = yo.pos.y;
      yo.pos.y = p.y + al;
      if (metido(yo.pos, colisores)) yo.pos.y = y0;
      else { yo.vel.y = 0; yo.enSuelo = true; }
    }
    if (d < 1e-3) { dx = Math.sin(yo.yaw); dz = Math.cos(yo.yaw); } else { dx /= d; dz /= d; }
    // El Mutante embistiendo empuja de verdad (con el mismo tope por cuadro).
    const empuja = (radio - (d < 1e-3 ? 0 : d)) * (z.carga > 0 ? 3 : 1);
    ex += dx * empuja;
    ez += dz * empuja;
    const v = yo.vel.x * dx + yo.vel.z * dz;
    if (v < 0) { yo.vel.x -= v * dx; yo.vel.z -= v * dz; }
  }
  const l = Math.hypot(ex, ez);
  if (l < 1e-6) return;
  if (l > EMPUJE_MAX) { ex *= EMPUJE_MAX / l; ez *= EMPUJE_MAX / l; }
  empujaCuerpo(yo, ex, ez, colisores);
}
const BASE_ARMA = new THREE.Vector3(0.2, -0.19, -0.62);

function ajustar() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camara.aspect = camaraArma.aspect = w / h;
  camara.updateProjectionMatrix();
  camaraArma.updateProjectionMatrix();
}
addEventListener('resize', ajustar);
ajustar();

// ---------- Estado ----------
// `jugando` es que hay partida en pantalla; `terminado`, que la sala ya tiene ganador.
let red = null, jugando = false, terminado = false;
let zombis = null;   // el modo zombis (zombis.js), solo en esa variante
let marcador = { bajas: {}, muertes: {}, puntosEq: null, banderas: null, armas: {} };
const yo = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), enSuelo: false,
  yaw: 0, pitch: 0, hp: 100, hpAntes: 100, vivo: false,
  // Inventario: la sartén y dos huecos. `mun` por id: {c: en el cargador, r: recargas que quedan}.
  inv: [SARTEN, null, null], sel: 0, mun: {},
  recargando: 0, recargaTotal: 1, cadencia: 0, tajo: 0,
  zoom: 0, apuntando: false, escudo: 0, muerteT: 0, asesino: '',
  disparo: 0, finales: null, retroceso: 0, bob: 0,
  gr: [], grSel: 0, grTiradas: 0, cdGranada: 0, lanzo: null, revento: null,
  cargaAuto: -1,    // < 0: no se está cargando la autodestrucción
  // Si se suicidó: lo que tenía, para devolvérselo al revivir si no mató a nadie.
  suicidio: null, matoMuerto: false,
  // Sprint y deslizamiento. `sinSprint`: ya se deslizó con este Shift apretado.
  corriendo: false, sinSprint: false, deslizando: 0, cdDesliz: 0, sprintK: 0, agacho: 0,
  // La espátula dorada: si la lleva y, lanzada, la que va volando.
  espatula: false, ep: null,
  // Zombis: puntos para gastar, puntos ganados, zombis fritos y la ronda en que cayó.
  pz: 0, pzT: 0, zk: 0, ultDanio: 0,
  // Zombis: las bebidas tomadas, la vida máxima (Juggernog) y las armas con Pack-a-Punch.
  perks: new Set(), maxHp: 100, pap: new Set(),
  // Zombis: en el suelo con la pistola (segundos que le quedan antes de
  // morir), si se levanta solo (Quick Revive jugando solo), con qué lo
  // tumbaron y si la pistola era prestada.
  abatido: 0, autoLevanta: false, tumbo: null, pistolaPrestada: false,
  // Zombis: tomándose una bebida (segundos que quedan, de qué color era) y la
  // Máquina de muerte de la bonificación (segundos que le quedan en la mano).
  bebiendo: 0, bebidaColor: '#ffffff', maquina: 0,
};
// En el suelo, como en Black Ops: se aguanta ABATIDO.dura segundos con la
// pistola mientras un compañero llega y mantiene E (ABATIDO.revive, la mitad
// con Quick Revive). Si no queda nadie en pie, se termina de morir enseguida.
const ABATIDO = { dura: 30, sinNadie: 2, revive: 4, alcance: 1.6, solo: 3, vel: 0.25, ojos: 0.35 };
const GRITO = 98;    // el grito de un chillón: daño 0, ciega
const REVIVE = 99;   // el «golpe» que levanta a un compañero: viaja con daño 0
let reviviendo = { uid: '', t: 0 };
// La autodestrucción: se mantiene X un momento (soltarla antes la cancela,
// así no se dispara sin querer), el huevo pita y brilla —también en la
// pantalla de los demás, que alcanzan a arrancar— y revienta llevándose a
// los rivales que tenga cerca. Uno muere siempre; es la baja «a 4».
const AUTO = { nombre: 'Autodestrucción', carga: 0.9, radio: 6.5, danio: 220 };
const otros = new Map();
const teclas = new Set();
let gatillo = false, yaDisparo = false;
// Los números de un arma tal como la lleva uno: con Pack-a-Punch si se lo hizo.
const armaDe = id => ARMAS[id] && yo.pap.has(id) ? conPap(ARMAS[id]) : ARMAS[id];
const armaActual = () => (yo.abatido > 0 ? armaDe(7) : yo.maquina > 0 ? ARMAS[MAQUINA] : armaDe(yo.inv[yo.sel])) || ARMAS[SARTEN];
const miNombre = () => red?.jugadores.get(red.yo)?.nombre || '';
const miColor = () => red?.jugadores.get(red.yo)?.color || PALETA[0];
const puedoJugar = () => jugando && !terminado && red && !red.mirando;
const EQUIPOS = ['rojo', 'azul'];
const NOMBRE_EQ = { rojo: 'Rojo', azul: 'Azul' };
const miEquipo = () => red?.equipos?.[red.yo] || '';
const rival = () => miEquipo() === 'rojo' ? 'azul' : 'rojo';
// En zombis los demás jugadores son todos compañeros: no hay fuego amigo.
const esZombis = () => red?.variante === 'zombis';
const aliado = id => esZombis() || (!!red?.equipos && red.equipos[id] === miEquipo());

const handlers = { alConfig, alJugador, alGolpe, alGolpeZombi, alBaja, alFeed, alSuceso, alMarcador, alFin, alVoces,
  alPeticion: ({ de, que }) => String(que).startsWith('bono:') ? bonos?.peticion(String(que).slice(5), de) : inter?.peticion(que) };

// ---------- Ajustes (menú de práctica y tarjeta de pausa) ----------
// Los dos paneles comparten las mismas piezas: skin, sensibilidad y granadas.
function montaAjustes(caja) {
  if (!caja) return;
  caja.innerHTML = `
    <label class="aj">Sensibilidad del mouse <input type="range" min="0.2" max="3" step="0.05" data-aj="sens"><b data-aj="sens-n"></b></label>
    <label class="aj">Skin <select data-aj="skin">${Object.entries(SKINS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
    <div class="aj">Granadas de cada vida
      ${[0, 1].map(i => `<select data-aj="gr${i}">${TIPOS_GRANADA.map(k => `<option value="${k}">${GRANADAS[k].icono} ${GRANADAS[k].nombre}</option>`).join('')}</select>`).join('')}
    </div>`;
  const q = k => caja.querySelector(`[data-aj="${k}"]`);
  const pinta = () => {
    q('sens').value = pref.sens; q('sens-n').textContent = pref.sens.toFixed(2) + '×';
    q('skin').value = pref.skin; q('gr0').value = pref.granadas[0]; q('gr1').value = pref.granadas[1];
  };
  pinta();
  caja.addEventListener('click', e => e.stopPropagation());   // en la pausa, tocar un ajuste no captura el mouse
  q('sens').oninput = () => { pref.sens = +q('sens').value; guardaPref(); refrescaAjustes(); };
  q('skin').onchange = () => { pref.skin = q('skin').value; guardaPref(); refrescaAjustes(); publicar(); };
  for (const i of [0, 1]) q('gr' + i).onchange = () => { cambiaGranada(i, q('gr' + i).value); };
  cajasAjustes.push(pinta);
}
const cajasAjustes = [];
const refrescaAjustes = () => { for (const p of cajasAjustes) p(); pintaElegidas(); };

// Cambia una de las dos granadas elegidas. Vale desde la próxima vida, o ya
// mismo si en esta todavía no se ha tirado ninguna.
function cambiaGranada(i, k) {
  if (!GRANADAS[k]) return;
  pref.granadas[i] = k;
  guardaPref();
  if (yo.grTiradas === 0 && yo.vivo) { yo.gr = [...pref.granadas]; yo.grSel = 0; }
  refrescaAjustes();
}
function ciclaGranada(i) {
  const k = TIPOS_GRANADA[(TIPOS_GRANADA.indexOf(pref.granadas[i]) + 1) % TIPOS_GRANADA.length];
  cambiaGranada(i, k);
}
function pintaElegidas() {
  $('muerte-granadas').innerHTML = 'Granadas de la próxima vida: ' +
    pref.granadas.map((k, i) => `<span><kbd>${i ? 'C' : 'Z'}</kbd> ${GRANADAS[k].icono} ${GRANADAS[k].nombre}</span>`).join(' · ');
}
montaAjustes($('ajustes-menu'));
montaAjustes($('ajustes-pausa'));
pintaElegidas();

// ---------- Menú (sólo práctica) ----------
let colorElegido = PALETA[0];
if (ONLINE) {
  $('menu').hidden = true;
  $('espera').hidden = false;
  conectarMarco(handlers);
} else {
  const guardado = (() => { try { return JSON.parse(localStorage.getItem('yemas') || '{}'); } catch { return {}; } })();
  $('nombre').value = guardado.nombre || '';
  if (guardado.modo === 'zombis') $('modo-practica').value = 'zombis';
  // El mapa solo cuenta en zombis: el selector aparece con ese modo.
  $('mapa-practica').innerHTML = LISTA_MAPAS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  if (MAPAS[guardado.mapa]) $('mapa-practica').value = guardado.mapa;
  const muestraMapa = () => { $('mapa-fila').hidden = $('modo-practica').value !== 'zombis'; };
  $('modo-practica').addEventListener('change', muestraMapa);
  muestraMapa();
  colorElegido = PALETA.includes(guardado.color) ? guardado.color : PALETA[Math.floor(Math.random() * PALETA.length)];
  for (const c of PALETA) {
    const b = document.createElement('button');
    b.className = 'color' + (c === colorElegido ? ' activo' : '');
    b.style.background = c;
    b.setAttribute('aria-label', 'Cáscara ' + c);
    b.onclick = () => {
      colorElegido = c;
      document.querySelectorAll('.color').forEach(x => x.classList.toggle('activo', x === b));
    };
    $('colores').append(b);
  }
  $('jugar').onclick = () => {
    const nombre = $('nombre').value.trim().slice(0, 14) || 'Huevo' + Math.floor(Math.random() * 1000);
    const variante = $('modo-practica').value === 'zombis' ? 'zombis' : 'todos';
    const mapa = $('mapa-practica').value;
    try { localStorage.setItem('yemas', JSON.stringify({ nombre, color: colorElegido, modo: variante, mapa })); } catch {}
    sonido.iniciar();
    conectarLocal({ nombre, color: colorElegido, colisores, variante, mapa }, handlers);
    bloquear();
  };
}

function alConfig(r) {
  red = r;
  $('menu').hidden = true;
  $('espera').hidden = true;
  $('hud').hidden = false;
  $('meta').textContent = esZombis() ? (red.online ? 'Zombis · aguanten juntos todas las rondas que puedan' : 'Práctica: zombis')
    : !red.meta ? 'Práctica contra bots'
    : red.variante === 'bandera' ? `Captura la bandera · primero a ${red.meta} 🚩`
    : red.variante === 'equipos' ? `Duelo por equipos · primero a ${red.meta} bajas`
    : `Todos contra todos · primero a ${red.meta} bajas`;
  marcador = { bajas: {}, muertes: {}, puntosEq: null, banderas: null, armas: {} };
  jugando = true;
  if (esZombis()) {
    // Fuera la arena: se arma el mapa clásico elegido en la sala.
    inter?.desmonta();
    bonos?.desmonta();
    mundo.desmonta();
    mundo = crearMundo(escena, MAPAS[red.mapa] || MAPAS.nacht, colisores);
  } else montaArmasSuelo();
  if (red.variante === 'bandera') montaBanderas();
  if (esZombis()) montaZombis();
  if (miEquipo()) $('mi-equipo').textContent = `Equipo ${NOMBRE_EQ[miEquipo()]}`;
  $('mi-equipo').className = miEquipo();
  if (red.mirando) {
    $('hud').classList.add('mirando');
    return;
  }
  aparecer();
  if (ONLINE) $('pausa').hidden = false;   // el mouse se captura con un click
  $('voz-entrar').hidden = !ONLINE;
}

// ---------- Controles ----------
function bloquear() { $('lienzo').requestPointerLock?.()?.catch?.(() => {}); }
const bloqueado = () => document.pointerLockElement === $('lienzo');
$('pausa').onclick = () => { sonido.iniciar(); bloquear(); };
$('lienzo').onclick = () => { if (puedoJugar() && !bloqueado()) bloquear(); };
document.addEventListener('pointerlockchange', () => {
  $('pausa').hidden = !puedoJugar() || bloqueado();
  if (!bloqueado()) { teclas.clear(); gatillo = false; yo.apuntando = false; yo.sinSprint = false; }
});

addEventListener('keydown', e => {
  if (!jugando) return;
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '')) return;
  teclas.add(e.code);
  if (e.code === 'Tab') $('tabla').hidden = false;
  if (e.code === 'KeyR') recargar();
  if (e.code === 'KeyV') red?.hablar(true);
  if (e.code === 'KeyG' && !yo.abatido) lanzarGranada();
  if (e.code === 'KeyT') yo.grSel = yo.gr.length ? (yo.grSel + 1) % yo.gr.length : 0;
  if (e.code === 'KeyE') recogeCerca();
  if (e.code === 'KeyQ' && !yo.abatido) tirarEspatula();
  if (e.code === 'KeyX' && puedoJugar() && yo.vivo && !yo.abatido) yo.cargaAuto = 0;
  // Shift+F y no F sola: la F queda al lado de la G y se apretaba sin querer.
  if (e.code === 'KeyF' && e.shiftKey) pantallaCompleta();
  if (!yo.vivo && e.code === 'KeyZ') ciclaGranada(0);
  if (!yo.vivo && e.code === 'KeyC') ciclaGranada(1);
  if (yo.vivo && e.code === 'KeyC') deslizar();
  if (/^Digit[1234]$/.test(e.code)) cambiarArma(+e.code.slice(5) - 1);
});
addEventListener('keyup', e => {
  teclas.delete(e.code);
  if (e.code === 'Tab') $('tabla').hidden = true;
  if (e.code === 'KeyV') red?.hablar(false);
  if (e.code === 'KeyX') yo.cargaAuto = -1;   // soltó antes de tiempo: no pasa nada
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') yo.sinSprint = false;
});
// Soltar la V cuando se pierde el foco: si no, el micrófono queda abierto.
addEventListener('blur', () => { red?.hablar(false); yo.cargaAuto = -1; yo.sinSprint = false; });
addEventListener('mousemove', e => {
  if (!bloqueado() || !yo.vivo) return;
  const s = SENS * pref.sens * (1 - yo.zoom * 0.7);
  yo.yaw -= e.movementX * s;
  yo.pitch = Math.max(-1.5, Math.min(1.5, yo.pitch - e.movementY * s));
});
addEventListener('mousedown', e => {
  if (!bloqueado()) return;
  if (e.button === 0) gatillo = true;
  if (e.button === 2) yo.apuntando = true;
});
addEventListener('mouseup', e => {
  if (e.button === 0) { gatillo = false; yaDisparo = false; }
  if (e.button === 2) yo.apuntando = false;
});
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  if (!bloqueado()) return;
  const n = yo.inv.length, paso = e.deltaY > 0 ? 1 : n - 1;
  for (let k = 1; k < n; k++) {
    const i = (yo.sel + paso * k) % n;
    if (yo.inv[i] !== null) { cambiarArma(i); break; }
  }
});

// ---------- Mando ----------
// Las teclas las manda Mando como si fueran del teclado (el stick izquierdo
// es WASD); lo analógico se lee aquí cada cuadro: el stick derecho mira, R2
// dispara y L2 apunta. Con mando no hace falta capturar el mouse: «Options»
// abre y cierra la pausa, y en la pausa el mando maneja el cursor.
let padPausa = false, padActivo = false, padGatillo = false, padMira = false;
const padJuega = () => !!(window.Mando && Mando.conectado()) && jugando && puedoJugar() && !padPausa;
function rueda(paso) {
  const n = yo.inv.length;
  for (let k = 1; k < n; k++) {
    const i = ((yo.sel + paso * k) % n + n) % n;
    if (yo.inv[i] !== null) { cambiarArma(i); break; }
  }
}
function pasoMando(dt) {
  const hay = !!(window.Mando && Mando.conectado()) && jugando && puedoJugar();
  if (!hay) {
    if (padActivo) {   // se desconectó: todo vuelve a depender del mouse
      padActivo = false; padPausa = false;
      if (padGatillo) { gatillo = false; yaDisparo = false; padGatillo = false; }
      if (padMira) { yo.apuntando = false; padMira = false; }
      $('pausa').hidden = !puedoJugar() || bloqueado();
    }
    return;
  }
  padActivo = true;
  $('pausa').hidden = bloqueado() || !padPausa;
  const st = Mando.estado();
  if (!st || padPausa || st.modo === 'cursor') return;
  const tira = st.b.rt > 0.4, mira = st.b.lt > 0.4;
  if (tira !== padGatillo) { padGatillo = tira; gatillo = tira; if (!tira) yaDisparo = false; }
  if (mira !== padMira) { padMira = mira; yo.apuntando = mira; }
  if (!yo.vivo) return;
  const r = 3.2 * pref.sens * (1 - yo.zoom * 0.7) * dt;
  yo.yaw -= st.ejes.rx * Math.abs(st.ejes.rx) * r;
  yo.pitch = Math.max(-1.5, Math.min(1.5, yo.pitch - st.ejes.ry * Math.abs(st.ejes.ry) * r * 0.8));
}
if (window.Mando) Mando.configura({
  stick: { izq: 'KeyA', der: 'KeyD', arriba: 'KeyW', abajo: 'KeyS' },
  botones: {
    a: 'Space', b: 'KeyC', x: 'KeyR', y: () => rueda(1), lb: 'KeyG', rb: 'KeyE',
    l3: 'ShiftLeft', r3: 'KeyQ',
    arriba: 'KeyT', abajo: 'Tab', izq: 'KeyX', der: 'KeyV',
    start: () => {
      padPausa = !padPausa;
      if (!padPausa) sonido.iniciar();
      else if (document.pointerLockElement) document.exitPointerLock();   // si no, la pausa queda tapada
    },
  },
  menu: () => !jugando || padPausa || !puedoJugar(),
  inicio: '#jugar',
  zonas: [{ sel: '#pausa .chico' }, { sel: '#menu .ayuda' }],
  pistas: [['stickL', 'moverte'], ['stickR', 'mirar'], ['rt', 'disparar'], ['lt', 'mira'], ['a', 'saltar'],
    ['l3', 'correr'], ['b', 'deslizarse'], ['x', 'recargar'], ['y', 'arma'], ['lb', 'granada'], ['arriba', 'cambia granada'],
    ['rb', 'usar / recoger'], ['r3', 'espátula'], ['izq', 'mantener: autodestrucción'], ['abajo', 'tabla'], ['der', 'hablar'], ['start', 'pausa']],
});

// ---------- Armas ----------
function llenaArma(id) {
  const a = armaDe(id);
  if (a && !a.melee) yo.mun[id] = { c: a.cargador, r: esZombis() ? RECARGAS_ZOMBIS : RECARGAS };
}

function cambiarArma(i) {
  if (i === yo.sel || !yo.vivo || yo.abatido > 0 || yo.maquina > 0 || yo.bebiendo > 0 || i >= yo.inv.length || yo.inv[i] === null) return;
  yo.sel = i;
  yo.recargando = 0;
  yo.zoom = 0;
  yo.cadencia = Math.max(yo.cadencia, 0.35);
  yo.retroceso = 1;
}

function recargar() {
  const a = armaActual(), m = yo.mun[a.id];
  if (!yo.vivo || a.melee || !m || yo.recargando > 0 || m.c === a.cargador) return;
  if (m.r <= 0) { aviso(esZombis() ? 'Sin recargas: compra munición o usa la sartén' : 'Sin recargas: busca otra arma o usa la sartén'); sonido.vacio(); return; }
  yo.recargando = yo.recargaTotal = a.recarga * (yo.perks.has('speed') ? 0.5 : 1);
  sonido.recarga();
}

const _u = new THREE.Vector3(), _v = new THREE.Vector3();
function disparar() {
  const a = armaActual();
  if (yo.recargando > 0 || yo.cadencia > 0) return;
  if (a.melee) return sartenazo(a);
  if (yo.bebiendo > 0) return;
  const m = a.infinita ? { c: 1, r: 0 } : yo.mun[a.id];
  if (!m || m.c <= 0) {
    sonido.vacio();
    if (m && m.r > 0) recargar();
    else aviso(esZombis() ? 'Sin munición: compra más o usa la sartén' : 'Sin munición: busca otra arma o usa la sartén');
    yo.cadencia = 0.3;
    return;
  }
  if (!a.infinita) m.c--;
  yo.cadencia = a.cadencia;
  // Double Tap: cada disparo sale doble (dos balas por bala), no más daño.
  const doble = yo.perks.has('doble') ? 2 : 1;
  if (a.cohete) {
    if (doble > 1) setTimeout(() => { if (yo.vivo && armaActual().id === a.id) lanzarCohete(a, 0.035); }, 70);
    return lanzarCohete(a);
  }

  const o = camara.getWorldPosition(new THREE.Vector3());
  const base = camara.getWorldDirection(new THREE.Vector3());
  _u.set(0, 1, 0).cross(base).normalize();
  _v.copy(base).cross(_u).normalize();
  const moviendo = Math.hypot(yo.vel.x, yo.vel.z) > 1.5;
  let disp = a.dispersion + (moviendo ? a.dispMov : 0) + (yo.enSuelo ? 0 : 0.04) + (yo.corriendo ? 0.03 : 0);
  if (a.zoom && yo.zoom > 0.9) disp = a.dispZoom + (moviendo ? 0.02 : 0);
  if (yo.perks.has('deadshot')) disp *= 0.4;

  const golpes = new Map();
  const finales = [];
  const boca = camara.localToWorld(new THREE.Vector3(0.22, -0.2, -0.7));
  for (let p = 0; p < a.perdigones * doble; p++) {
    const r = Math.sqrt(Math.random()) * Math.max(disp, doble > 1 && a.perdigones === 1 ? 0.006 : 0), th = Math.random() * Math.PI * 2;
    const d = base.clone().addScaledVector(_u, r * Math.cos(th)).addScaledVector(_v, r * Math.sin(th)).normalize();
    let t = rayoMundo(o, d, a.alcance, colisores);
    const quien = primerBlanco(o, d, t);
    if (quien) t = quien.t;
    const fin = o.clone().addScaledVector(d, t);
    finales.push([+fin.x.toFixed(2), +fin.y.toFixed(2), +fin.z.toFixed(2)]);
    trazo(p >= a.perdigones ? boca.clone().add(_u.clone().multiplyScalar(-0.05)) : boca, fin, '#fff2a8');
    if (quien) {
      const j = quien;
      const cab = fin.y - j.pos.y > ALTO * 0.72 * (j.esc || 1) * (j.alto || 1);
      const g = golpes.get(j.id) || { dmg: 0, cab: false };
      g.dmg += a.danio * (cab ? a.cabeza : 1) * caida(a, t);
      g.cab = g.cab || cab;
      golpes.set(j.id, g);
      chispa(fin, j.color);
    } else if (t < a.alcance) {
      chispa(fin, '#ffffff');
    }
  }
  for (const [id, g] of golpes) pegaA(id, Math.round(g.dmg), g.cab, a.id);
  if (golpes.size) {
    const cab = [...golpes.values()].some(g => g.cab);
    marcaGolpe(cab);
    sonido.golpe(cab);
  }
  yo.disparo = Math.max(yo.disparo + 1, Date.now() % 1e9);
  yo.finales = finales;
  yo.pitch = Math.min(1.5, yo.pitch + a.retroceso);
  yo.yaw += (Math.random() - 0.5) * a.retroceso * 0.5;
  yo.retroceso = Math.min(1, yo.retroceso + 0.6);
  sonido.disparo(a.id);
  publicar();
}

// El primer huevo que corta el rayo antes de `tope`: un rival o un zombi.
// Devuelve {id, t, pos, color}; el id de un zombi es 'z:<n>'.
function primerBlanco(o, d, tope) {
  let mejor = null;
  for (const [id, j] of otros) {
    if (!j.vivo || aliado(id)) continue;   // sin fuego amigo: la bala los atraviesa
    const t = rayoHuevo(o, d, j.mesh.position);
    if (t !== null && t < (mejor ? mejor.t : tope)) mejor = { id, t, pos: j.mesh.position, color: j.color };
  }
  if (zombis) for (const [n, z] of zombis.lista) {
    const esc = z.mesh.userData.escala || 1, alto = z.mesh.userData.alto || 1;
    const t = rayoHuevo(o, d, z.mesh.position, esc, alto);
    if (t !== null && t < (mejor ? mejor.t : tope)) mejor = { id: 'z:' + n, t, pos: z.mesh.position, color: '#b6d47a', esc, alto };
  }
  return mejor;
}
// El daño a quien sea: a un jugador por los golpes de siempre, a un zombi por
// el director (que puede ser uno mismo). Cada golpe a un zombi da 10 puntos.
function pegaA(id, dmg, cab, a) {
  if (!String(id).startsWith('z:')) { red.golpear(id, { dmg, cab, a }); return; }
  sumaPuntos(10);
  if (bonos?.insta) dmg = 1e6;
  const n = +String(id).slice(2);
  if (soyDirector()) zombis.golpe(n, dmg, red.yo, cab, a);
  else red.golpear('z:' + n, { dmg, cab, a });
}

// La sartén: alcanza al primer huevo rival delante, a menos de un brazo y
// sin pared en medio. Se manda como un disparo sin trazos, para que los demás
// lo oigan.
function sartenazo(a) {
  yo.cadencia = a.cadencia;
  yo.tajo = 1;
  const o = camara.getWorldPosition(new THREE.Vector3());
  const d = camara.getWorldDirection(new THREE.Vector3());
  const tope = Math.min(a.alcance, rayoMundo(o, d, a.alcance, colisores));
  const j = primerBlanco(o, d, tope);
  if (j) {
    const fin = o.clone().addScaledVector(d, j.t);
    const cab = fin.y - j.pos.y > ALTO * 0.72 * (j.esc || 1) * (j.alto || 1);
    pegaA(j.id, Math.round(a.danio * (cab ? a.cabeza : 1)), cab, a.id);
    marcaGolpe(cab);
    sonido.sarten();
    chispa(fin, j.color);
  }
  yo.disparo = Math.max(yo.disparo + 1, Date.now() % 1e9);
  yo.finales = [];
  sonido.disparo(a.id);
  publicar();
}

function lanzarCohete(a, desvio = 0) {
  const dir = camara.getWorldDirection(new THREE.Vector3());
  if (desvio) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), desvio).normalize();
  const o = camara.localToWorld(new THREE.Vector3(0.2, -0.15, -0.9));
  const v = dir.multiplyScalar(a.velocidad);
  const id = Math.max((yo.lanzo?.i || 0) + 1, Date.now() % 1e9);
  const oa = [r2(o.x), r2(o.y), r2(o.z)], va = [r2(v.x), r2(v.y), r2(v.z)];
  const k = a.rayo ? 'rayo' : 'cohete';
  granadas.lanzar(id, oa, va, true, red.yo, k);
  yo.lanzo = { i: id, o: oa, v: va, k };
  yo.retroceso = 1;
  yo.pitch = Math.min(1.5, yo.pitch + a.retroceso);
  sonido.disparo(a.id);
  publicar();
}

// ---------- Vida y muerte ----------
// C mientras se corre por el suelo: sale disparado en la dirección en que iba.
function deslizar() {
  if (!puedoJugar() || yo.abatido > 0 || !yo.corriendo || !yo.enSuelo || yo.deslizando > 0 || yo.cdDesliz > 0) return;
  const v = Math.hypot(yo.vel.x, yo.vel.z);
  const dx = v > 0.5 ? yo.vel.x / v : -Math.sin(yo.yaw), dz = v > 0.5 ? yo.vel.z / v : -Math.cos(yo.yaw);
  yo.vel.x = dx * DESLIZ.vel;
  yo.vel.z = dz * DESLIZ.vel;
  yo.deslizando = DESLIZ.dura;
  yo.cdDesliz = DESLIZ.enfriar;
  yo.corriendo = false;
  yo.sinSprint = true;
  sonido.desliza();
  publicar();
}

function aparecer() {
  // En equipos cada uno aparece en su mitad del mapa: rojo al norte (z > 0).
  const lado = miEquipo() === 'rojo' ? 1 : miEquipo() === 'azul' ? -1 : 0;
  const lugares = esZombis() ? (MAPAS[red.mapa] || MAPAS.nacht).spawns.map(([x, z]) => new THREE.Vector3(x, 0, z))
    : lado ? SPAWNS.filter(s => s.z * lado >= 15) : SPAWNS;
  let mejor = lugares[0], dMejor = -1;
  for (const s of lugares) {
    let dMin = Infinity;
    for (const [id, j] of otros) if (j.vivo && !aliado(id)) dMin = Math.min(dMin, s.distanceTo(j.obj));
    if (zombis) for (const z of zombis.lista.values()) dMin = Math.min(dMin, s.distanceTo(z.pos));
    dMin = Math.min(dMin, 60) + Math.random() * 10;
    if (dMin > dMejor) { dMejor = dMin; mejor = s; }
  }
  yo.pos.copy(mejor);
  yo.vel.set(0, 0, 0);
  yo.yaw = Math.atan2(mejor.x, mejor.z);
  yo.pitch = 0;
  // Las armas se conservan entre vidas. Quien se suicidó sin llevarse a nadie
  // vuelve como estaba (vida, munición y granadas): suicidarse no recarga. Si
  // su suicidio frió a alguien, o si lo mataron, vuelve lleno.
  const s = yo.suicidio;
  if (esZombis()) {
    // En zombis se vuelve con la sartén y la pistola, como al empezar; los
    // puntos se guardan.
    // Las bebidas y el Pack-a-Punch se pierden al caer, como en Black Ops.
    yo.perks.clear();
    yo.pap.clear();
    yo.maxHp = 100;
    yo.hp = 100;
    yo.inv = [SARTEN, 7, null];
    yo.mun = {};
    llenaArma(7);
    yo.sel = 1;
    yo.gr = [...pref.granadas];
  } else if (s && !yo.matoMuerto) {
    yo.hp = s.hp;
    yo.mun = s.mun;
    yo.gr = s.gr;
    aviso('Vuelves como estabas: tu suicidio no frió a nadie');
  } else {
    yo.hp = 100;
    for (const id of yo.inv) if (id !== null) llenaArma(id);
    yo.gr = [...pref.granadas];
  }
  yo.suicidio = null;
  yo.matoMuerto = false;
  yo.abatido = 0;
  yo.grSel = 0;
  yo.grTiradas = 0;
  yo.hpAntes = yo.hp;
  yo.vivo = true;
  yo.recargando = 0;
  yo.deslizando = 0;
  yo.corriendo = false;
  yo.escudo = INVULNERABLE;
  $('muerte').hidden = true;
  publicar();
}

function alGolpe(g) {
  if (!puedoJugar()) return;
  // Un compañero terminó de levantarme.
  if (g.a === REVIVE) { if (yo.abatido > 0) levantarse(`${g.n} te levantó`); return; }
  // En el suelo los zombis ya no muerden y nada más duele: solo corre el reloj.
  if (!yo.vivo || yo.escudo > 0 || yo.abatido > 0) return;
  // El grito de un chillón no duele: deja ciego un momento.
  if (g.a === GRITO) { if (esZombis()) chillido(); return; }
  // Un mordisco viaja como un golpe del director, pero no es baja de nadie.
  if (g.a === ZOMBI) {
    if (!esZombis()) return;
    g = { ...g, de: '', n: 'Los zombis' };
    sonido.mordida();
  }
  // La espátula dorada quita la mitad de lo que queda, sea cuanto sea.
  const dmg = g.a === ESPATULA ? Math.max(1, Math.ceil(yo.hp / 2)) : g.dmg;
  if (g.a === ESPATULA) sonido.espatulazo();
  yo.hpAntes = yo.hp;
  yo.hp -= dmg;
  yo.ultDanio = performance.now();
  danio = 1;
  sonido.dolor();
  if (yo.hp <= 0) cae(g);
}
// Un balazo de otro a un zombi: solo lo aplica el director.
function alGolpeZombi(g) {
  if (soyDirector()) zombis.golpe(g.id, g.dmg, g.de, g.cab, g.a);
}

let ultimaBaja = -1e9;
function alBaja(victima) {
  // Una baja que llega estando muerto tras suicidarse: el suicidio sí frió a
  // alguien. En línea llega después de la muerte; sin sala llega en el mismo
  // instante, antes, y por eso `morir` mira también la hora de la última.
  ultimaBaja = performance.now();
  if (!yo.vivo && yo.suicidio) yo.matoMuerto = true;
  sonido.baja();
  aviso(`Freíste a ${victima}`);
}

// Quedarse sin vida: en zombis primero se cae al suelo; en lo demás se muere.
function cae(g) {
  if (!esZombis()) return morir(g);
  if (yo.abatido > 0) return;
  const qr = yo.perks.has('revive'), solo = nActivos() <= 1;
  // Jugando solo no hay quién lo levante: sin Quick Revive se muere ya.
  if (solo && !qr) return morir(g);
  // Al caer se pierden las bebidas, como en Black Ops (Quick Revive también).
  yo.perks.clear();
  yo.maxHp = 100;
  yo.hp = 1;
  yo.tumbo = g;
  yo.autoLevanta = solo;
  yo.abatido = solo ? ABATIDO.solo : ABATIDO.dura;
  yo.cargaAuto = -1;
  yo.maquina = 0;
  yo.corriendo = false;
  yo.deslizando = 0;
  yo.recargando = 0;
  yo.zoom = 0;
  yo.apuntando = false;
  // La pistola: la propia si la tiene, con al menos un cargador; si no, una prestada.
  yo.pistolaPrestada = !yo.inv.includes(7);
  if (yo.pistolaPrestada || !yo.mun[7] || (yo.mun[7].c <= 0 && yo.mun[7].r <= 0)) llenaArma(7);
  sonido.dolor();
  aviso(solo ? 'Quick Revive te va a levantar…' : '¡Caíste! Aguanta con la pistola hasta que te levanten');
  pintaElegidas();
  publicar();
}
function levantarse(texto) {
  yo.abatido = 0;
  yo.autoLevanta = false;
  yo.hp = yo.maxHp;
  yo.hpAntes = yo.hp;
  yo.escudo = 1.5;
  yo.recargando = 0;
  if (yo.pistolaPrestada) delete yo.mun[7];
  yo.pistolaPrestada = false;
  sonido.bebida();
  aviso(texto);
  publicar();
}

function morir(g) {
  yo.abatido = 0;
  if (yo.pistolaPrestada) delete yo.mun[7];
  yo.pistolaPrestada = false;
  if (g.de === red.yo) {
    yo.suicidio = { hp: Math.max(1, Math.round(yo.hpAntes)), mun: JSON.parse(JSON.stringify(yo.mun)), gr: [...yo.gr] };
    yo.matoMuerto = performance.now() - ultimaBaja < 300;
  } else yo.suicidio = null;
  yo.hp = 0;
  yo.vivo = false;
  yo.cargaAuto = -1;
  yo.maquina = 0;
  yo.muerteT = 3;
  yo.asesino = g.n;
  yo.espatula = false;
  gatillo = false;
  yo.apuntando = false;
  // Quien lleva una bandera la suelta donde cae: el registro necesita el sitio.
  const llevo = marcador.banderas && EQUIPOS.some(b => marcador.banderas[b]?.uid === red.yo);
  // En zombis cada muerte anota los puntos, los zombis fritos y la ronda.
  const extra = esZombis() ? { pts: yo.pzT, zk: yo.zk, r: marcador.ronda || 1 } : {};
  red.morir(llevo ? { ...g, x: r2(yo.pos.x), z: r2(yo.pos.z) } : { ...g, ...extra });
  explotar(yo.pos, miColor());
  pintaElegidas();
  $('muerte').hidden = false;
  publicar();
}

function alMarcador(m) {
  // Si cambió algún color de equipo, los huevos se vuelven a pintar.
  for (const [id, j] of otros) {
    const c = red.jugadores.get(id)?.color;
    if (c && c !== j.color) { escena.remove(j.mesh); otros.delete(id); }
  }
  if (miEquipo()) { $('mi-equipo').textContent = `Equipo ${NOMBRE_EQ[miEquipo()]}`; $('mi-equipo').className = miEquipo(); }
  const antes = marcador.banderas;
  marcador = m;
  tablaT = 0;
  // Desde cuándo está cada bandera en el suelo, para devolverla sola.
  if (m.banderas) for (const b of EQUIPOS) {
    const ahora = m.banderas[b]?.e, previo = antes?.[b]?.e;
    if (ahora === 'suelo' && previo !== 'suelo') enSuelo[b] = performance.now();
    if (ahora !== 'suelo') enSuelo[b] = 0;
  }
  armasTomadas(m.armas || {});
  if (esZombis()) marcadorZombis(m);
}

function alFin(f) {
  if (terminado) return;
  terminado = true;
  gatillo = false;
  if (document.pointerLockElement) document.exitPointerLock();
  $('pausa').hidden = true;
  $('muerte').hidden = true;
  $('hud').classList.add('terminado');
  const g = red.jugadores.get(f.ganador), eq = String(f.ganador).startsWith('eq:') ? f.ganador.slice(3) : '';
  if (esZombis()) {
    const r = f.ronda || marcador.ronda || 1, pts = f.puntos || marcador.puntos || {};
    const suyos = u => u === red.yo ? yo.pzT : pts[u] ?? otros.get(u)?.pz ?? 0;
    $('fin-txt').textContent = !red.online ? `Aguantaste hasta la ronda ${r} con ${yo.pzT} puntos y ${yo.zk} zombis fritos.`
      : `Cayeron todos en la ronda ${r}. ` + (f.ganador === red.yo ? `¡Hiciste más puntos que nadie: ${suyos(red.yo)}!`
        : g ? `${g.nombre} hizo más puntos (${suyos(f.ganador)}).` : 'Nadie hizo puntos.');
    $('otra').hidden = red.online;
    $('fin').hidden = false;
    return;
  }
  $('fin-txt').textContent = eq ? (eq === miEquipo() ? `¡Ganó tu equipo, el ${NOMBRE_EQ[eq]}!` : `Ganó el equipo ${NOMBRE_EQ[eq]}.`)
    : f.ganador === red.yo ? '¡Ganaste! Nadie te frió a tiempo.'
    : g ? `${g.nombre} llegó primero a la meta.` : 'La partida terminó.';
  $('fin').hidden = false;
}

// ---------- Armas tiradas en el mapa ----------
// Cuál aparece en cada punto sale de la semilla de la sala (`armaEnPunto`), así
// que todos ven la misma; quién se la lleva lo decide el registro (`recoge`) y
// llega en el marcador. Tomada una, ese punto vuelve a tener otra (la siguiente
// aparición) a los REAPARECE milisegundos de verla tomada.
const REAPARECE = 18000, TOCA_ARMA = 1.5;
const suelo = PUNTOS_ARMA.map(() => ({ g: 0, desde: 0, obj: null }));
const pedidos = new Map();   // 's:g' → {t, reemplaza, at}
let cerca = null;            // el arma al alcance cuando ya se llevan dos
function montaArmasSuelo() {
  for (const p of PUNTOS_ARMA) {
    const ped = crearPedestal();
    ped.position.x = p.x; ped.position.z = p.z; ped.position.y += p.y;
    escena.add(ped);
  }
}
// La espátula dorada solo sale en todos contra todos.
const tipoEn = (s, g) => armaEnPunto(red.semilla || 1, s, g, red.variante === 'todos');
function quitaDelSuelo(st) {
  if (!st.obj) return;
  escena.remove(st.obj);
  st.obj.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  st.obj = null;
}
function armasTomadas(armas) {
  for (const [sk, x] of Object.entries(armas)) {
    const s = +sk, st = suelo[s];
    if (!st || !(x.g >= st.g)) continue;
    const t = tipoEn(s, x.g);
    st.g = x.g + 1;
    st.desde = performance.now() + REAPARECE;
    quitaDelSuelo(st);
    const pedido = pedidos.get(s + ':' + x.g);
    pedidos.delete(s + ':' + x.g);
    if (x.uid === red.yo) otorgar(t, pedido?.reemplaza ?? null);
    else if (pedido) aviso(`${red.jugadores.get(x.uid)?.nombre || 'Alguien'} se llevó la ${NOMBRE_ARMA[t]} primero`);
  }
}
function otorgar(t, reemplaza) {
  if (t === ESPATULA) {
    yo.espatula = true;
    sonido.recoge();
    aviso('¡La espátula dorada! Apriétale Q para lanzarla');
    return;
  }
  const a = armaDe(t);
  if (yo.inv.includes(t)) { llenaArma(t); aviso(`${a.nombre}: munición llena`); sonido.recoge(); return; }
  // El primer hueco libre (con Mule Kick hay tres), y si no hay, el de la mano.
  let i = yo.inv.findIndex((x, k) => k > 0 && x === null);
  if (i < 0) i = reemplaza || (yo.sel || 1);
  const viejo = yo.inv[i];
  if (viejo !== null) { delete yo.mun[viejo]; yo.pap.delete(viejo); }
  yo.inv[i] = t;
  llenaArma(t);
  sonido.recoge();
  aviso(viejo !== null ? `Cambiaste la ${NOMBRE_ARMA[viejo]} por la ${a.nombre} (${a.corto})` : `Tienes la ${a.nombre} (${a.corto})`);
  if (yo.vivo) { cambiarArma(i); yo.sel = i; }
}
function pideArma(s, g, reemplaza) {
  const k = s + ':' + g, t = performance.now(), p = pedidos.get(k);
  if (p && t - p.at < 1500) return;
  pedidos.set(k, { t: tipoEn(s, g), reemplaza, at: t });
  red.accion('recoge', { s, g });
}
function recogeCerca() {
  if (esZombis()) { if (puedoJugar() && yo.vivo && !yo.abatido && !reviviendo.uid) inter?.usar(); return; }
  if (!cerca || !puedoJugar() || !yo.vivo) return;
  pideArma(cerca.s, cerca.g, yo.sel !== 0 ? yo.sel : 1);
}
function actualizaArmasSuelo() {
  if (esZombis()) return;
  const ahora = performance.now(), t = ahora / 1000;
  cerca = null;
  for (let s = 0; s < suelo.length; s++) {
    const st = suelo[s], p = PUNTOS_ARMA[s];
    if (ahora < st.desde) continue;
    const tipo = tipoEn(s, st.g);
    if (!st.obj) {
      st.obj = construyeArma(tipo);
      st.obj.scale.setScalar(1.8);
      escena.add(st.obj);
    }
    st.obj.position.set(p.x, p.y + 0.9 + Math.sin(t * 2 + s) * 0.12, p.z);
    st.obj.rotation.y = t * 1.2 + s;
    if (!puedoJugar() || !yo.vivo) continue;
    if (Math.hypot(yo.pos.x - p.x, yo.pos.z - p.z) > TOCA_ARMA || Math.abs(yo.pos.y - p.y) > 1.2) continue;
    // La espátula no ocupa hueco: se toma si no se lleva otra.
    if (tipo === ESPATULA) { if (!yo.espatula && !yo.ep) pideArma(s, st.g, null); continue; }
    const libre = yo.inv[1] === null || yo.inv[2] === null;
    if (libre || yo.inv.includes(tipo)) pideArma(s, st.g, null);
    else cerca = { s, g: st.g, tipo };
  }
  $('prompt').hidden = !cerca;
  if (cerca) {
    const enMano = yo.sel !== 0 ? yo.inv[yo.sel] : yo.inv[1];
    $('prompt').textContent = `E: cambiar la ${NOMBRE_ARMA[enMano]} por la ${NOMBRE_ARMA[cerca.tipo]} (${ARMAS[cerca.tipo].corto})`;
  }
}

// ---------- Los demás ----------
function alJugador(id, e) {
  if (!red || id === red.yo) return;
  let j = otros.get(id);
  if (!e) {
    if (j) { escena.remove(j.mesh); quitaMalla(j.epMalla); otros.delete(id); }
    return;
  }
  const ficha = red.jugadores.get(id) || { nombre: 'Huevo', color: PALETA[0] };
  const skin = SKINS[e.sk] ? e.sk : 'clasico';
  if (j && j.skin !== skin) { escena.remove(j.mesh); quitaMalla(j.epMalla); otros.delete(id); j = null; }
  if (!j) {
    j = {
      mesh: crearHuevo(ficha.color, ficha.nombre, skin), obj: new THREE.Vector3(e.x, e.y, e.z),
      color: ficha.color, skin, vivo: !!e.v, sI: e.s ? e.s.i : 0, ry: e.ry || 0,
      nI: e.n ? e.n.i : 0, xI: e.x2 ? e.x2.i : 0,
    };
    j.mesh.position.copy(j.obj);
    j.mesh.rotation.y = j.ry;
    j.mesh.visible = j.vivo;
    escena.add(j.mesh);
    otros.set(id, j);
  }
  j.obj.set(+e.x || 0, +e.y || 0, +e.z || 0);
  j.ry = +e.ry || 0;
  if (j.vivo && !e.v) explotar(j.mesh.position, j.color);
  if (!j.vivo && e.v) j.mesh.position.copy(j.obj);
  j.vivo = !!e.v;
  j.mesh.visible = j.vivo;
  if (e.s && e.s.i !== j.sI) {
    j.sI = e.s.i;
    const boca = j.mesh.userData.punta.getWorldPosition(new THREE.Vector3());
    const fins = Array.isArray(e.s.e) ? e.s.e : Object.values(e.s.e || {});
    for (const f of fins.slice(0, 12)) {
      const fin = new THREE.Vector3(+f[0] || 0, +f[1] || 0, +f[2] || 0);
      trazo(boca, fin, '#ffb347');
      chispa(fin, '#ffffff');
    }
    sonido.disparo(e.a | 0, boca.distanceTo(yo.pos));
  }
  // Está cargando su autodestrucción: brilla y pita (lo pinta el bucle).
  if (e.ad && !j.ad) sonido.pitido(0, j.mesh.position.distanceTo(yo.pos));
  j.ad = !!e.ad && j.vivo;
  if (e.ds && !j.ds && j.vivo) sonido.desliza(j.mesh.position.distanceTo(yo.pos));
  j.ds = !!e.ds && j.vivo;
  // En el suelo esperando que lo levanten.
  const ab = j.vivo && e.ab > 0;
  if (ab && !j.ab && esZombis() && !red.mirando) aviso(`¡${ficha.nombre} cayó! Ve y mantén E a su lado para levantarlo`);
  j.ab = ab;
  // Lo que lanzó (granada o cohete): se ve volar y revienta donde su dueño dice.
  if (e.n && e.n.i !== j.nI && Array.isArray(e.n.o) && Array.isArray(e.n.v)) {
    j.nI = e.n.i;
    granadas.lanzar('r' + id + e.n.i, e.n.o.map(Number), e.n.v.map(Number), false, id, e.n.k || 'duro');
  }
  if (e.x2 && e.x2.i !== j.xI && Array.isArray(e.x2.p)) {
    j.xI = e.x2.i;
    granadas.revienta('r' + id + e.x2.i, e.x2.p.map(Number), e.x2.k || 'duro');
  }
  // La espátula dorada que lanzó: se ve volar, y si viene por mí, aviso.
  if (e.ep && Array.isArray(e.ep.p)) {
    const q = new THREE.Vector3(...e.ep.p.map(Number));
    if (!j.epMalla) { j.epMalla = mallaEspatula(); j.epMalla.position.copy(q); }
    j.epObj = q;
    if (e.ep.i !== j.epI) {
      j.epI = e.ep.i;
      if (e.ep.u === red.yo) { aviso(`¡${ficha.nombre} te tiró la espátula dorada! Te va a perseguir`); sonido.espatula(); }
    }
  } else if (j.epMalla) { quitaMalla(j.epMalla); j.epMalla = null; }
  if (esZombis()) {
    j.pz = e.pz | 0;
    j.zk = e.zk | 0;
    if (e.zb) ultimoZb.set(id, e.zb);
    if (e.zb && id === director() && !soyDirector()) { zombis.desdeRed(e.zb); inter?.desdeRed(e.zb); bonos?.desdeRed(e.zb); }
  }
}

function alFeed(item) {
  const div = document.createElement('div');
  div.className = 'baja';
  const nombre = miNombre();
  if (item.k === nombre || item.v === nombre) div.classList.add('mia');
  const arma = NOMBRE_ARMA[item.a] ?? '';
  div.innerHTML = '<b></b> <span class="arma"></span> <b></b>';
  div.children[0].textContent = item.k || '💀';
  div.children[1].textContent = `[${arma}${item.cab ? ' · cabeza' : ''}]`;
  div.children[2].textContent = item.v;
  $('feed').prepend(div);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
  setTimeout(() => div.remove(), 6000);
}

const r2 = x => Math.round(x * 100) / 100;
function publicar() {
  if (!red || red.mirando || terminado) return;
  const e = {
    x: r2(yo.pos.x), y: r2(yo.pos.y), z: r2(yo.pos.z),
    vx: r2(yo.vel.x), vz: r2(yo.vel.z), ry: r2(yo.yaw),
    v: yo.vivo ? 1 : 0, a: armaActual().id, sk: pref.skin,
  };
  if (yo.disparo) e.s = { i: yo.disparo, e: yo.finales };
  if (yo.lanzo) e.n = yo.lanzo;
  if (yo.cargaAuto >= 0) e.ad = 1;
  if (yo.deslizando > 0) e.ds = 1;
  if (yo.abatido > 0) e.ab = Math.ceil(yo.abatido);
  if (yo.revento) e.x2 = yo.revento;
  if (yo.ep) e.ep = { i: yo.ep.i, u: yo.ep.u, p: [r2(yo.ep.pos.x), r2(yo.ep.pos.y), r2(yo.ep.pos.z)] };
  if (esZombis()) {
    e.pz = yo.pzT;
    e.zk = yo.zk;
    if (soyDirector()) e.zb = { ...zombis.estado(), ...(inter?.estado() || {}), ...(bonos?.estado() || {}) };
  }
  red.publicar(e);
}

// ---------- Granadas y cohetes ----------
// ¿El cohete propio pasa pegado a un rival o a un zombi? El elipsoide del
// huevo agrandado por la espoleta: revienta al lado, no hace falta acertarle.
function tocaHuevo(p) {
  const m = ARMAS[6].espoleta;
  const cerca = q => {
    const dx = (p.x - q.x) / (0.55 + m), dy = (p.y - q.y - ALTO / 2) / (ALTO / 2 + 0.1 + m), dz = (p.z - q.z) / (0.55 + m);
    return dx * dx + dy * dy + dz * dz <= 1;
  };
  for (const [id, j] of otros) if (j.vivo && !aliado(id) && cerca(j.mesh.position)) return true;
  if (zombis) for (const z of zombis.lista.values()) if (cerca(z.mesh.position)) return true;
  return false;
}
const granadas = crearGranadas(escena, colisores, reventar, tocaHuevo);
function lanzarGranada() {
  if (!puedoJugar() || !yo.vivo || !yo.gr.length || yo.cdGranada > 0) return;
  const k = yo.gr.splice(Math.min(yo.grSel, yo.gr.length - 1), 1)[0];
  yo.grSel = Math.min(yo.grSel, Math.max(0, yo.gr.length - 1));
  yo.grTiradas++;
  yo.cdGranada = GRANADA.cadencia;
  const dir = camara.getWorldDirection(new THREE.Vector3());
  const o = camara.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.6);
  const v = dir.multiplyScalar(GRANADA.fuerza).add(new THREE.Vector3(yo.vel.x * 0.5, 4, yo.vel.z * 0.5));
  const id = Math.max((yo.lanzo?.i || 0) + 1, Date.now() % 1e9);
  const oa = [r2(o.x), r2(o.y), r2(o.z)], va = [r2(v.x), r2(v.y), r2(v.z)];
  granadas.lanzar(id, oa, va, true, red.yo, k);
  yo.lanzo = { i: id, o: oa, v: va, k };
  yo.retroceso = 1;
  sonido.lanza();
  publicar();
}

// Revienta algo lanzado, propio o ajeno. El humo y la cegadora los ve cada uno
// en su pantalla; el daño (Huevo duro y cohete) lo decide solo el dueño, como
// con las balas: a los rivales por los golpes de siempre, y a uno mismo
// directo, a la mitad.
function reventar(p, dueno, id, propia, k) {
  if (k === 'humo') nube(p);
  else if (k === 'luz') destello(p);
  else explosion(p, k === 'cohete' ? armaDe(6).radio : k === 'rayo' ? armaDe(10).radio : GRANADA.radio, k === 'rayo');
  if (!propia || !red) return;
  yo.revento = { i: id, p: [r2(p.x), r2(p.y), r2(p.z)], k };
  if (k === 'duro') danioExplosivo(p, GRANADA.radio, GRANADA.danio, 3, 'tu propio huevo duro');
  else if (k === 'cohete') { const b = armaDe(6); danioExplosivo(p, b.radio, b.danio, 6, 'tu propia bazuca', b.pleno); }
  else if (k === 'rayo') { const b = armaDe(10); danioExplosivo(p, b.radio, b.danio, 10, 'tu propio rayo', b.pleno); }
  publicar();
}
function danioExplosivo(p, radio, danioMax, arma, comoMuero, pleno = 0) {
  golpeaRivales(p, radio, danioMax, arma, pleno);
  // PhD Flopper: las explosiones propias no le hacen nada a uno.
  if (!yo.vivo || yo.escudo > 0 || yo.abatido > 0 || yo.perks.has('phd')) return;
  const dmg = Math.round(alcanceExplosion(p, yo.pos, radio, danioMax, pleno) / 2);
  if (dmg < 5) return;
  yo.hpAntes = yo.hp;
  yo.hp -= dmg;
  danio = 1;
  if (yo.hp <= 0) cae({ de: red.yo, n: comoMuero, dmg, cab: false, a: arma });
}

// Daño de una explosión en `p` sobre el huevo parado en `pies`: entero hasta
// `pleno` metros y lineal hasta `radio`. Se mide a los pies, al medio y a la
// cabeza, y vale el mejor de los que no tienen una pared en medio: así un
// huevo asomado detrás de un murete también lo siente. Lo usan la granada, el
// cohete y la autodestrucción.
function alcanceExplosion(p, pies, radio, danioMax, pleno = 0) {
  let mejor = 0;
  for (const h of [0.3, ALTO / 2, ALTO * 0.85]) {
    const q = pies.clone();
    q.y += h;
    const d = p.distanceTo(q);
    if (d >= radio) continue;
    const dir = q.clone().sub(p).normalize();
    if (rayoMundo(p.clone().addScaledVector(dir, 0.05), dir, d, colisores) < d - 0.3) continue;   // tapado
    mejor = Math.max(mejor, d <= pleno ? 1 : 1 - (d - pleno) / (radio - pleno));
  }
  return Math.round(danioMax * mejor);
}
function golpeaRivales(p, radio, danioMax, arma, pleno = 0) {
  for (const [idJ, j] of otros) {
    if (!j.vivo || aliado(idJ)) continue;
    const dmg = alcanceExplosion(p, j.mesh.position, radio, danioMax, pleno);
    if (dmg >= 5) { red.golpear(idJ, { dmg, cab: false, a: arma }); marcaGolpe(false); }
  }
  if (zombis) for (const [n, z] of [...zombis.lista]) {
    const dmg = alcanceExplosion(p, z.mesh.position, radio, danioMax, pleno);
    if (dmg >= 5) { pegaA('z:' + n, dmg, false, arma); marcaGolpe(false); }
  }
}

// La autodestrucción: la explosión se publica como la de una granada (`x2`),
// así los demás la ven donde fue, y uno se muere con `por` = uno mismo.
function autodestruir() {
  yo.cargaAuto = -1;
  if (!puedoJugar() || !yo.vivo) return;
  const p = yo.pos.clone().add(new THREE.Vector3(0, ALTO / 2, 0));
  const id = Math.max((yo.revento?.i || 0) + 1, Date.now() % 1e9);
  explosion(p, AUTO.radio);
  golpeaRivales(p, AUTO.radio, AUTO.danio, 4);
  yo.revento = { i: id, p: [r2(p.x), r2(p.y), r2(p.z)], k: 'duro' };
  yo.hpAntes = yo.hp;
  morir({ de: red.yo, n: 'tu autodestrucción', dmg: 999, cab: false, a: 4 });
}

let temblor = 0;
function explosion(p, radio = GRANADA.radio, verde = false) {
  const d = p.distanceTo(yo.pos);
  sonido.explosion(d);
  temblor = Math.max(temblor, Math.max(0, 1 - d / 14) * (verde ? 0.4 : 1));
  const bola = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: verde ? '#62ff4a' : '#ffb347', transparent: true, opacity: 0.9 }));
  bola.position.copy(p);
  escena.add(bola);
  efectos.push({ obj: bola, vida: 0.35, max: 0.35, crece: radio * 0.7 });
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(geoCascara, new THREE.MeshLambertMaterial({ color: i % 2 ? '#f3ead8' : '#ffb300', transparent: true }));
    m.position.copy(p);
    escena.add(m);
    efectos.push({
      obj: m, vida: 1.2, max: 1.2, piso: 0,
      vel: new THREE.Vector3((Math.random() - 0.5) * 12, 3 + Math.random() * 7, (Math.random() - 0.5) * 12),
      giro: (Math.random() - 0.5) * 20,
    });
  }
}

// La de humo: una nube de bocanadas que tapa la vista unos doce segundos. Las
// balas la atraviesan (es humo); lo que quita es ver.
const nubes = [];
let texHumo = null;
function texturaHumo() {
  if (texHumo) return texHumo;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.65)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  texHumo = new THREE.CanvasTexture(cv);
  return texHumo;
}
const VIDA_HUMO = 14;
function nube(p) {
  sonido.humo(p.distanceTo(yo.pos));
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHumo(), color: '#cfd4d6', transparent: true, opacity: 0, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = Math.random() * 3.2;
    s.position.set(Math.cos(a) * r, 0.4 + Math.random() * 2.8, Math.sin(a) * r);
    s.scale.setScalar(3 + Math.random() * 2.2);
    s.userData.deriva = new THREE.Vector3((Math.random() - 0.5) * 0.15, Math.random() * 0.08, (Math.random() - 0.5) * 0.15);
    g.add(s);
  }
  g.position.set(p.x, Math.max(0, p.y - 0.2), p.z);
  escena.add(g);
  nubes.push({ g, t: 0 });
}
function actualizaNubes(dt) {
  let dentro = 0;
  const ojo = camara.position;
  for (let i = nubes.length - 1; i >= 0; i--) {
    const n = nubes[i];
    n.t += dt;
    const op = n.t < 1 ? n.t * 0.92 : n.t > VIDA_HUMO - 3 ? Math.max(0, (VIDA_HUMO - n.t) / 3) * 0.92 : 0.92;
    for (const s of n.g.children) { s.material.opacity = op; s.position.addScaledVector(s.userData.deriva, dt); }
    const d = Math.hypot(ojo.x - n.g.position.x, ojo.z - n.g.position.z);
    if (d < 3.8 && ojo.y < n.g.position.y + 3.6) dentro = Math.max(dentro, op * Math.min(1, (3.8 - d) / 1.5));
    if (n.t >= VIDA_HUMO) {
      escena.remove(n.g);
      for (const s of n.g.children) s.material.dispose();
      nubes.splice(i, 1);
    }
  }
  $('humo').style.opacity = dentro;
}

// La cegadora: a cada uno lo encandila según lo cerca que esté, si la tiene a
// la vista (sin pared en medio) y si la estaba mirando. A uno mismo y a los
// compañeros también: hay que tirarla con cuidado.
let cegado = 0;
function destello(p) {
  const fogonazo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }));
  fogonazo.position.copy(p);
  escena.add(fogonazo);
  efectos.push({ obj: fogonazo, vida: 0.25, max: 0.25, crece: 4 });
  const ojo = camara.getWorldPosition(new THREE.Vector3());
  const d = ojo.distanceTo(p);
  let I = 0;
  if (yo.vivo && !red?.mirando && d < 20) {
    const dir = p.clone().sub(ojo).normalize();
    if (rayoMundo(ojo, dir, d, colisores) >= d - 0.3) {
      const mira = camara.getWorldDirection(new THREE.Vector3()).dot(dir);
      I = (1 - d / 20) * (mira > 0.5 ? 1 : mira > 0 ? 0.6 : 0.25);
    }
  }
  cegado = Math.max(cegado, Math.min(1.4, I * 1.4));
  sonido.destello(d, Math.min(1, I));
}

// ---------- Pantalla completa ----------
// La del marco: en la pantalla queda solo el juego. Dentro de la sala el
// iframe tiene allow="fullscreen", así que esto no saca la página entera.
function pantallaCompleta() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen)?.call(d)?.catch?.(() => {}); return; }
  const r = d.documentElement, pide = r.requestFullscreen || r.webkitRequestFullscreen;
  try { pide?.call(r, { navigationUI: 'hide' })?.catch?.(() => {}); } catch {}
}
$('pantalla').onclick = e => { e.stopPropagation(); pantallaCompleta(); };
$('otra').onclick = () => location.reload();
$('voz-entrar').onclick = e => { e.stopPropagation(); red?.entrarVoz(); };

// ---------- Efectos ----------
const efectos = [];
const geoTrazo = new THREE.BoxGeometry(0.03, 0.03, 1).translate(0, 0, 0.5);
function trazo(a, b, color) {
  const m = new THREE.Mesh(geoTrazo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  m.position.copy(a);
  m.lookAt(b);
  m.scale.z = a.distanceTo(b);
  escena.add(m);
  efectos.push({ obj: m, vida: 0.07, max: 0.07 });
}

const geoChispa = new THREE.SphereGeometry(0.08, 6, 4);
function chispa(p, color) {
  const m = new THREE.Mesh(geoChispa, new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(p);
  escena.add(m);
  efectos.push({ obj: m, vida: 0.2, max: 0.2, crece: 3 });
}

const geoCascara = new THREE.BoxGeometry(0.14, 0.03, 0.11);
const geoYema = new THREE.SphereGeometry(0.09, 8, 6);
const manchas = [];
function explotar(p, color, frito = true) {
  for (let i = 0; i < 22; i++) {
    const yema = i >= 14;
    const mat = new THREE.MeshLambertMaterial({ color: yema ? '#ffb300' : color, transparent: true });
    const m = new THREE.Mesh(yema ? geoYema : geoCascara, mat);
    m.position.set(p.x, p.y + 0.4 + Math.random() * 1.1, p.z);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    escena.add(m);
    efectos.push({
      obj: m, vida: 1.6, max: 1.6, piso: p.y,
      vel: new THREE.Vector3((Math.random() - 0.5) * 7, 3 + Math.random() * 5, (Math.random() - 0.5) * 7),
      giro: (Math.random() - 0.5) * 16,
    });
  }
  // El zombi deja su propio huevo frito, verde (zombis.js): aquí no va otro.
  if (frito) {
    const f = huevoFrito(p);
    escena.add(f);
    manchas.push({ obj: f, t: 14 });
    if (manchas.length > 30) quitaFrito(manchas.shift().obj);
  }
  sonido.crack(p.distanceTo(yo.pos));
  sonido.fritura(p.distanceTo(yo.pos));
}

// Lo que queda en el piso: un huevo frito. La clara es una mancha blanca de
// borde irregular con una orilla dorada y crujiente debajo, y la yema una
// cúpula amarilla brillante, corrida del centro como en la sartén. Aparece
// creciendo, como si recién cayera, y se desvanece a los catorce segundos.
const matBorde = () => new THREE.MeshLambertMaterial({ color: '#e2b86b', transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
const matClara = () => new THREE.MeshLambertMaterial({ color: '#fbf8ef', transparent: true, polygonOffset: true, polygonOffsetFactor: -3 });
const matYemaFrita = () => new THREE.MeshPhongMaterial({ color: '#ffb000', emissive: '#6b3a00', specular: '#ffffff', shininess: 90, transparent: true });
function contornoClara(radio, puntos = 28) {
  const f = new THREE.Shape();
  const fase = Math.random() * 6, lobulos = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i <= puntos; i++) {
    const a = (i / puntos) * Math.PI * 2;
    const r = radio * (1 + 0.16 * Math.sin(a * lobulos + fase) + 0.08 * Math.sin(a * 7 + fase * 2) + (Math.random() - 0.5) * 0.06);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) f.moveTo(x, y); else f.lineTo(x, y);
  }
  return f;
}
function huevoFrito(p) {
  const g = new THREE.Group();
  const radio = 0.75 + Math.random() * 0.2;
  const forma = contornoClara(radio);
  const borde = new THREE.Mesh(new THREE.ShapeGeometry(contornoClara(radio * 1.07)), matBorde());
  borde.rotation.x = -Math.PI / 2;
  borde.position.y = 0.008;
  borde.receiveShadow = true;
  const clara = new THREE.Mesh(new THREE.ShapeGeometry(forma), matClara());
  clara.rotation.x = -Math.PI / 2;
  clara.position.y = 0.014;
  clara.receiveShadow = true;
  const yema = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), matYemaFrita());
  yema.scale.y = 0.55;
  yema.position.set((Math.random() - 0.5) * 0.25, 0.016, (Math.random() - 0.5) * 0.25);
  yema.castShadow = true;
  g.add(borde, clara, yema);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.position.set(p.x, p.y, p.z);
  g.scale.setScalar(0.2);
  g.userData.crece = 0;
  return g;
}
function quitaFrito(g) {
  escena.remove(g);
  g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}

function quitar(obj) {
  escena.remove(obj);
  obj.material.dispose();
  if (obj.geometry !== geoTrazo && obj.geometry !== geoChispa && obj.geometry !== geoCascara && obj.geometry !== geoYema) obj.geometry.dispose();
}

function actualizarEfectos(dt) {
  for (let i = efectos.length - 1; i >= 0; i--) {
    const f = efectos[i];
    f.vida -= dt;
    const k = Math.max(0, f.vida / f.max);
    if (f.vel) {
      f.vel.y -= 18 * dt;
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.rotation.x += f.giro * dt;
      if (f.obj.position.y < f.piso + 0.03) { f.obj.position.y = f.piso + 0.03; f.vel.multiplyScalar(0.4); f.vel.y *= -0.5; f.giro *= 0.5; }
      f.obj.material.opacity = Math.min(1, k * 3);
    } else {
      f.obj.material.opacity = k * 0.9;
      if (f.crece) f.obj.scale.setScalar(1 + (1 - k) * f.crece);
    }
    if (f.vida <= 0) { quitar(f.obj); efectos.splice(i, 1); }
  }
  for (let i = manchas.length - 1; i >= 0; i--) {
    const m = manchas[i];
    m.t -= dt;
    if (m.obj.userData.crece < 1) {
      m.obj.userData.crece = Math.min(1, m.obj.userData.crece + dt * 3);
      m.obj.scale.setScalar(0.2 + 0.8 * (1 - Math.pow(1 - m.obj.userData.crece, 3)));
    }
    if (m.t < 2) m.obj.traverse(o => { if (o.isMesh) o.material.opacity = Math.max(0, m.t / 2); });
    if (m.t <= 0) { quitaFrito(m.obj); manchas.splice(i, 1); }
  }
  actualizaNubes(dt);
  cegado = Math.max(0, cegado - dt * 0.35);
  $('cegado').style.opacity = Math.min(1, cegado);
}

// ---------- Captura la bandera ----------
// El estado de las banderas es del registro (lo trae el marcador); aquí solo
// se dibuja y se pide `toma`, `devuelve` o `captura` al tocarlas. Mientras la
// jugada no vuelve con el estado nuevo, no se repite la misma petición.
const banderas = {};
const enSuelo = { rojo: 0, azul: 0 }, pedido = {};
const TOQUE = 1.8, AUTO_DEVUELVE = 25000;
function montaBanderas() {
  for (const b of EQUIPOS) {
    const base = crearBase(COLOR_EQUIPO[b]);
    base.position.x = BASES[b].x; base.position.z = BASES[b].z;
    escena.add(base);
    banderas[b] = crearBandera(COLOR_EQUIPO[b]);
    banderas[b].position.copy(BASES[b]);
    escena.add(banderas[b]);
  }
}
const dist2 = (p, x, z) => Math.hypot(p.x - x, p.z - z);
function pide(tipo, b, extra = {}) {
  const k = tipo + b, t = performance.now();
  if (pedido[k] && t - pedido[k] < 1500) return;
  pedido[k] = t;
  red.accion(tipo, { b, ...extra });
}
function actualizaBanderas() {
  const bs = marcador.banderas;
  if (!bs) return;
  const t = performance.now() / 1000;
  for (const b of EQUIPOS) {
    const f = bs[b], m = banderas[b];
    if (!f || !m) continue;
    if (f.e === 'lleva') {
      const j = f.uid === red.yo ? null : otros.get(f.uid);
      m.visible = !!j && j.vivo;
      if (j) { m.position.copy(j.mesh.position); m.position.y += 1.1; m.scale.setScalar(0.6); }
    } else {
      m.visible = true;
      m.scale.setScalar(1);
      m.position.set(f.x, 0, f.z);
    }
    m.userData.tela.rotation.y = Math.sin(t * 3 + (b === 'rojo' ? 0 : 1)) * 0.25;
  }
  if (!puedoJugar() || !yo.vivo || !miEquipo()) { $('llevo').hidden = true; return; }
  const mia = bs[miEquipo()], suya = bs[rival()];
  if (suya.e !== 'lleva' && dist2(yo.pos, suya.x, suya.z) < TOQUE) pide('toma', rival());
  if (mia.e === 'suelo' && dist2(yo.pos, mia.x, mia.z) < TOQUE) pide('devuelve', miEquipo());
  if (mia.e === 'suelo' && enSuelo[miEquipo()] && performance.now() - enSuelo[miEquipo()] > AUTO_DEVUELVE)
    pide('devuelve', miEquipo(), { auto: true });
  const base = BASES[miEquipo()];
  if (suya.uid === red.yo && mia.e === 'base' && dist2(yo.pos, base.x, base.z) < 3) pide('captura', rival());
  const llevo = suya.uid === red.yo;
  $('llevo').hidden = !llevo;
  if (llevo) $('llevo').textContent = mia.e === 'base' ? '🚩 ¡Llevas la bandera! Vuelve a tu base'
    : '🚩 Llevas la bandera, pero la tuya no está en casa: recupérala para capturar';
}

function alSuceso(s) {
  const eq = NOMBRE_EQ[s.b] || '', mio = s.uid === red.yo;
  if (s.t === 'toma') aviso(mio ? `¡Tomaste la bandera ${eq}!` : `${s.nombre} tomó la bandera ${eq}`);
  else if (s.t === 'devuelve') aviso(`La bandera ${eq} volvió a su base`);
  else if (s.t === 'captura') { aviso(`¡${mio ? 'Capturaste' : s.nombre + ' capturó'} la bandera ${eq}!`); sonido.baja(); }
  const div = document.createElement('div');
  div.className = 'baja' + (mio ? ' mia' : '');
  div.textContent = s.t === 'toma' ? `🚩 ${s.nombre} tomó la ${eq}` : s.t === 'captura' ? `🏁 ${s.nombre} capturó la ${eq}`
    : `↩ La ${eq} volvió${s.auto ? ' sola' : ''}`;
  $('feed').prepend(div);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
  setTimeout(() => div.remove(), 6000);
}

// ---------- Zombis ----------
// Quién los mueve (el director), las rondas que llegan por el marcador, los
// puntos de cada uno y el cartel de cada ronda. La simulación vive en zombis.js.
let rondaVista = 0, eraDirector = false, ultimoDirector = '', primerMarcadorZ = true, cartelT = null;
const ultimoZb = new Map();   // uid → el último `zb` que publicó
const nActivos = () => [...red.jugadores.keys()].filter(u => !red.fuera?.has(u)).length;
// El primer asiento que sigue en la sala y cuyo huevo se ve: si su pestaña se
// cierra, su estado desaparece de `vivo` y dirige el siguiente.
function director() {
  if (!red) return '';
  for (const u of red.jugadores.keys()) {
    if (red.fuera?.has(u)) continue;
    if (u === red.yo ? !red.mirando : otros.has(u)) return u;
  }
  return '';
}
const soyDirector = () => !!zombis && !terminado && director() === red.yo;

function montaZombis() {
  zombis = crearZombis(escena, colisores, {
    alCaer: alCaeZombi,
    pideRonda: r => red.accion('ronda', { r }),
    grunido: p => sonido.grunido(p.distanceTo(camara.position)),
    rompe: p => sonido.rompe(p.distanceTo(camara.position)),
    aparece: alAparecerZombi,
    // El último perro de la ronda suelta una Munición máxima.
    finPerros: p => { if (soyDirector()) bonos?.suelta(p, 'municion'); },
    chilla: p => sonido.chillido(p.distanceTo(camara.position)),
    ruge: p => { sonido.ruge(p.distanceTo(camara.position)); temblor = Math.max(temblor, Math.max(0, 1 - p.distanceTo(yo.pos) / 25) * 0.6); },
    casco: p => sonido.casco(p.distanceTo(camara.position)),
  });
  // Cada mapa trae su cielo, su niebla y su luz.
  const M = MAPAS[red.mapa] || MAPAS.nacht, am = M.ambiente || {};
  escena.background.set(am.fondo || '#2b2740');
  escena.fog.color.set(am.fondo || '#2b2740');
  [escena.fog.near, escena.fog.far] = am.niebla || [22, 85];
  cielo.intensity = am.cielo ?? 0.85;
  sol.intensity = am.sol ?? 0.9;
  sol.color.set(am.solColor || '#c9bbff');
  nieblaBase = { near: escena.fog.near, far: escena.fog.far, color: escena.fog.color.clone() };
  inter = crearInteractivo(escena, M, colisores, mundo, {
    pos: () => yo.pos,
    puedo: () => puedoJugar() && yo.vivo && !yo.abatido,
    puntos: () => yo.pz,
    gasta: n => {
      if (yo.pz < n) { aviso(`Te faltan ${n - yo.pz} puntos`); sonido.vacio(); return false; }
      yo.pz -= n;
      return true;
    },
    suma: sumaPuntos,
    director: soyDirector,
    envia: q => red.golpear('p:' + q, { dmg: 0 }),
    solo: () => nActivos() <= 1,
    ronda: () => zombis?.ronda || marcador.ronda || 1,
    arma: {
      tiene: id => yo.inv.includes(id),
      enMano: () => yo.sel > 0 ? yo.inv[yo.sel] : null,
      compra: id => otorgar(id, yo.sel || 1),
      llena: id => { llenaArma(id); sonido.recoge(); },
      pap: id => { yo.pap.add(id); llenaArma(id); yo.recargando = 0; aviso(`¡${armaDe(id).nombre}!`); },
      tienePap: id => yo.pap.has(id),
    },
    bebida: {
      tiene: t => yo.perks.has(t),
      toma: t => {
        yo.perks.add(t);
        if (t === 'jugger') { yo.maxHp = 250; yo.hp = 250; }
        if (t === 'mula' && yo.inv.length < 4) yo.inv.push(null);
        sonido.bebida();
        beber(BEBIDAS[t].color);
        aviso(`${ICONO_BEBIDA[t]} ${BEBIDAS[t].nombre}: ${BEBIDAS[t].texto}`);
      },
    },
    recalcula: () => zombis?.recalcula(),
    teleporta: (x, y, z) => { yo.pos.set(x, y, z); yo.vel.set(0, 0, 0); },
    modelo: id => construyeArma(id),
    aviso,
    prompt: t => { $('prompt').hidden = !t; if (t) $('prompt').textContent = t; },
  });
  zombis.ponMapa(M, inter);
  bonos = crearBonos(escena, {
    director: soyDirector,
    yo: () => red.yo,
    pos: () => yo.pos,
    puedo: () => puedoJugar() && yo.vivo && !yo.abatido,
    envia: q => red.golpear('p:' + q, { dmg: 0 }),
    efecto: alBono,
  });
  $('puntos-z').hidden = false;
  $('puntos-z').innerHTML = '<b></b>';
  $('tabla').querySelector('thead tr').innerHTML = '<th>Huevo</th><th>Puntos</th><th>Zombis</th><th>Caídas</th>';
}

function marcadorZombis(m) {
  // Recargó la pestaña estando caído: sigue caído hasta la ronda siguiente.
  if (primerMarcadorZ) {
    primerMarcadorZ = false;
    if (yo.vivo && (m.caidos || []).includes(red.yo)) { yo.vivo = false; yo.hp = 0; yo.muerteT = 0; $('muerte').hidden = false; publicar(); }
  }
  if (!m.ronda || m.ronda === rondaVista) return;
  const primera = !rondaVista;
  rondaVista = m.ronda;
  if (soyDirector()) zombis.iniciaRonda(m.ronda, nActivos());
  cartelRonda(m.ronda);
  nieblaRonda(m.ronda);
  const nov = novedadRonda(m.ronda);
  if (nov) setTimeout(() => aviso(nov), 1200);
  if (primera || !puedoJugar()) return;
  // Ronda nueva: los caídos vuelven, y los que siguen en pie recuperan las granadas.
  if (!yo.vivo) aparecer();
  else { yo.gr = [...pref.granadas]; yo.grSel = 0; yo.grTiradas = 0; }
}

// Caído en zombis. Si los únicos que siguen en pie son jugadores que cerraron
// la pestaña sin abandonar, el registro los cuenta vivos y la partida no se
// acaba nunca: la sala tiene que expulsarlos con la votación de siempre.
function textoCaido() {
  const caidos = new Set(marcador.caidos || []);
  const ausentes = [...red.jugadores.keys()].filter(u => u !== red.yo && !red.fuera?.has(u) && !caidos.has(u) && !otros.has(u));
  const enPie = [...otros.values()].some(j => j.vivo);
  if (!enPie && ausentes.length) {
    const n = ausentes.map(u => red.jugadores.get(u)?.nombre || 'alguien').join(' y ');
    return `${ausentes.length > 1 ? 'Solo siguen en pie ' + n + ', que se desconectaron' : 'Solo sigue en pie ' + n + ', que se desconectó'}. ` +
      `Para cerrar la partida, voten para expulsar a ${n} con ⏏ en la cabecera de la sala.`;
  }
  const quien = !yo.asesino || yo.asesino === 'Los zombis' ? 'Los zombis te frieron' : `${yo.asesino} te frió`;
  return `${quien}. Vuelves cuando empiece la ronda ${(marcador.ronda || 1) + 1}, si alguien aguanta.`;
}

// En las rondas de perros el mapa se cierra en una niebla anaranjada, como el
// aviso de Black Ops de que viene algo distinto; la siguiente la despeja.
let nieblaBase = null;
const NIEBLA_PERROS = new THREE.Color('#5a2a14');
function nieblaRonda(r) {
  if (!nieblaBase) return;
  const perros = esPerros(r);
  escena.fog.near = perros ? Math.min(nieblaBase.near, 10) : nieblaBase.near;
  escena.fog.far = perros ? Math.min(nieblaBase.far, 42) : nieblaBase.far;
  escena.fog.color.copy(perros ? NIEBLA_PERROS : nieblaBase.color);
  escena.background.copy(escena.fog.color);
}

// Un zombi que aparece: el perro cae en un rayo y el Mutante sale rugiendo.
function alAparecerZombi(tipo, pos) {
  if (tipo === 'p') {
    sonido.trueno(pos.distanceTo(camara.position));
    const rayo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 30, 6),
      new THREE.MeshBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.95 }));
    rayo.position.set(pos.x, pos.y + 15, pos.z);
    escena.add(rayo);
    efectos.push({ obj: rayo, vida: 0.3, max: 0.3 });
  } else if (tipo === 'j') {
    sonido.ruge(pos.distanceTo(camara.position));
    temblor = Math.max(temblor, Math.max(0, 1 - pos.distanceTo(yo.pos) / 30));
    aviso('¡Llegó el Mutante!');
  }
}

// El grito de un chillón: encandila como una cegadora corta.
function chillido() {
  cegado = Math.max(cegado, 1.3);
  sonido.chillido(0);
}

function cartelRonda(r) {
  const c = $('ronda');
  c.textContent = `RONDA ${r}`;
  c.hidden = true;
  void c.offsetWidth;   // para que la animación vuelva a empezar
  c.hidden = false;
  clearTimeout(cartelT);
  cartelT = setTimeout(() => { c.hidden = true; }, 3300);
  sonido.ronda();
}

function sumaPuntos(n) {
  yo.pz += n;
  yo.pzT += n;
  if (n <= 0) return;
  const i = document.createElement('i');
  i.textContent = '+' + n;
  $('puntos-z').append(i);
  setTimeout(() => i.remove(), 900);
}

function alCaeZombi({ pos, killer, cab, a, explota, tipo }) {
  explotar(pos, tipo === 'p' ? '#4a1f17' : tipo === 't' ? '#a7c43a' : '#8fa36b', false);
  // El Mutante siempre suelta algo; los demás, con la suerte de siempre.
  if (soyDirector() && (tipo === 'j' || killer)) bonos?.suelta(pos, tipo === 'j' || undefined);
  if (tipo === 'j') { explosion(pos, 3); aviso('¡Cayó el Mutante!'); }
  const d = pos.distanceTo(yo.pos);
  // El que ardía (la lava de Pueblo, el napalm) revienta en llamas y quema lo
  // que tenga cerca; el tóxico suelta su gas (PhD no lo para) y el perro, un
  // fogonazo más chico.
  if (explota === 1 || explota === true) {
    sonido.quema(d);
    explosion(pos, ZB.explota);
    if (yo.vivo && !yo.perks.has('phd') && d < ZB.explota)
      alGolpe({ de: '', n: 'Un zombi en llamas', dmg: ZB.danioExplota, cab: false, a: ZOMBI });
  } else if (explota === 2) {
    explosion(pos, ZB.gas, true);
    if (yo.vivo && d < ZB.gas) alGolpe({ de: '', n: 'El gas de un tóxico', dmg: ZB.danioGas, cab: false, a: ZOMBI });
  } else if (explota === 3) {
    sonido.quema(d);
    explosion(pos, ZB.perro);
    if (yo.vivo && !yo.perks.has('phd') && d < ZB.perro)
      alGolpe({ de: '', n: 'Un perro infernal', dmg: ZB.danioPerro, cab: false, a: ZOMBI });
  }
  if (killer !== red.yo) return;
  yo.zk++;
  // El grandote vale más; la cabeza suma 40 y la sartén 70, como siempre.
  const base = CLASE[tipo]?.puntos || 60;
  sumaPuntos(base + (cab ? 40 : a === SARTEN ? 70 : 0));
}

// Una bonificación tomada por alguien de la sala. Las que tocan a la sala
// (Carpintero, Kaboom) las hace el director; los puntos y la munición, cada uno.
function alBono(ti, uid) {
  const b = BONOS[ti];
  if (!b) return;
  const quien = uid === red.yo ? '' : ` (${red.jugadores.get(uid)?.nombre || 'alguien'})`;
  sonido.bono();
  if (ti === 'carpintero') {
    if (soyDirector()) inter?.reparaTodo();
    if (puedoJugar()) sumaPuntos(200);
  } else if (ti === 'kaboom') {
    if (soyDirector()) zombis?.kaboom();
    if (puedoJugar()) sumaPuntos(400);
  } else if (ti === 'municion') {
    if (yo.vivo) {
      for (const id of yo.inv) if (id !== null && id !== undefined) llenaArma(id);
      yo.gr = [...pref.granadas]; yo.grSel = 0; yo.grTiradas = 0;
    }
  } else if (ti === 'maquina') {
    if (uid === red.yo && yo.vivo && !yo.abatido) { yo.maquina = b.dura; yo.recargando = 0; }
    else { aviso(`${b.icono} ${b.nombre}${quien}`); return; }
  }
  aviso(`${b.icono} ¡${b.nombre}!${quien}`);
}

// El reloj del que está en el suelo: se levanta solo (Quick Revive jugando
// solo) o se termina de morir. Sin nadie en pie que pueda venir, no se espera.
function pasoAbatido(dt) {
  if (!yo.autoLevanta && ![...otros.values()].some(j => j.vivo && !j.ab)) yo.abatido = Math.min(yo.abatido, ABATIDO.sinNadie);
  yo.abatido -= dt;
  if (yo.abatido > 0) return;
  if (yo.autoLevanta) return levantarse('¡Quick Revive te levantó! Ya no lo tienes');
  morir(yo.tumbo || { de: '', n: 'Los zombis', dmg: 0, cab: false, a: ZOMBI });
}
// El compañero en el suelo más cerca, si estoy en pie y lo alcanzo.
function buscaCaido() {
  if (!puedoJugar() || !yo.vivo || yo.abatido > 0) return null;
  let mejor = null, dMejor = ABATIDO.alcance;
  for (const [id, j] of otros) {
    if (!j.ab) continue;
    const d = Math.hypot(j.obj.x - yo.pos.x, j.obj.z - yo.pos.z);
    if (d < dMejor && Math.abs(j.obj.y - yo.pos.y) < 1.5) { dMejor = d; mejor = id; }
  }
  return mejor;
}
// Mantener E al lado de un caído lo levanta. Con Quick Revive tarda la mitad.
function pasoRevivir(dt, uid) {
  if (!uid) { if (reviviendo.uid) $('revive').hidden = true; reviviendo = { uid: '', t: 0 }; return; }
  if (reviviendo.uid !== uid) reviviendo = { uid, t: 0 };
  const total = ABATIDO.revive * (yo.perks.has('revive') ? 0.5 : 1);
  const nombre = red.jugadores.get(uid)?.nombre || 'tu compañero';
  if (teclas.has('KeyE')) reviviendo.t += dt;
  else reviviendo.t = 0;
  $('prompt').hidden = false;
  $('prompt').textContent = reviviendo.t > 0 ? `Levantando a ${nombre}…` : `Mantén E para levantar a ${nombre}`;
  $('revive').hidden = !(reviviendo.t > 0);
  $('revive-barra').style.width = Math.min(100, reviviendo.t / total * 100) + '%';
  if (reviviendo.t < total) return;
  red.golpear(uid, { dmg: 0, cab: false, a: REVIVE });
  const j = otros.get(uid);
  if (j) j.ab = false;   // hasta que llegue su estado, ya no está en el suelo
  sumaPuntos(10);
  aviso(`Levantaste a ${nombre}`);
  sonido.bebida();
  reviviendo = { uid: '', t: 0 };
  $('revive').hidden = true;
  publicar();
}

function pasoZombis(dt) {
  if (!zombis) return;
  const d = director(), soy = d === red.yo && !terminado;
  if (soy && !eraDirector) {
    zombis.adopta(ultimoZb.get(ultimoDirector) || null, nActivos());
    if (marcador.ronda) zombis.iniciaRonda(marcador.ronda, nActivos());
  }
  eraDirector = soy;
  if (d && d !== red.yo) ultimoDirector = d;
  if (soy) {
    const jug = [];
    // A los que están en el suelo los zombis los dejan: van por los que siguen en pie.
    if (!red.mirando) jug.push({ uid: red.yo, pos: yo.pos, vivo: yo.vivo && !yo.abatido });
    for (const [id, j] of otros) jug.push({ uid: id, pos: j.obj, vivo: j.vivo && !j.ab });
    for (const m of zombis.paso(dt, jug, nActivos())) {
      const a = m.grito ? GRITO : ZOMBI;
      if (m.uid === red.yo) alGolpe({ de: '', n: 'Los zombis', dmg: m.dmg, cab: false, a });
      else red.golpear(m.uid, { dmg: m.dmg, cab: false, a });
    }
  }
  zombis.animar(dt, soy, camara.position);
  pintaJefe(soy);
}
// La barra de vida del Mutante, arriba al centro, mientras haya uno en pie
// (con dos, la del más entero).
let jefeVisto = -1;
function pintaJefe(soy) {
  let pct = -1;
  for (const z of zombis.lista.values()) if (z.tipo === 'j') pct = Math.max(pct, soy ? z.hp / z.max * 100 : z.pct ?? 100);
  pct = pct < 0 ? -1 : Math.max(0, Math.round(pct));
  if (pct === jefeVisto) return;
  jefeVisto = pct;
  $('jefe').hidden = pct < 0;
  if (pct >= 0) $('jefe-barra').style.width = pct + '%';
}

// ---------- La espátula dorada ----------
// Quien la lanza la simula: vuela hacia el rival más cerca de la mira, a
// través de las paredes, y cada golpe (cada ESPATULA_CFG.cada segundos) le
// quita la mitad de la vida que le queda, hasta que se muere. Los demás la ven
// volar por el estado (`ep`).
let epId = 0, mallaEp = null;
function mallaEspatula() {
  const m = construyeArma(ESPATULA);
  m.scale.setScalar(2.2);
  escena.add(m);
  return m;
}
function quitaMalla(m) {
  if (!m) return;
  escena.remove(m);
  m.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
function tirarEspatula() {
  if (!puedoJugar() || !yo.vivo || !yo.espatula || yo.ep) return;
  const o = camara.getWorldPosition(new THREE.Vector3()), d = camara.getWorldDirection(new THREE.Vector3());
  let mejor = null, ang = Infinity;
  for (const [id, j] of otros) {
    if (!j.vivo || aliado(id)) continue;
    const a = d.angleTo(j.obj.clone().setY(j.obj.y + ALTO * 0.6).sub(o));
    if (a < ang) { ang = a; mejor = id; }
  }
  if (!mejor) { aviso('No hay a quién tirarle la espátula'); return; }
  yo.espatula = false;
  epId = Math.max(epId + 1, Date.now() % 1e9);
  yo.ep = { i: epId, u: mejor, pos: o.addScaledVector(d, 0.8), t: 0, cd: 0 };
  mallaEp = mallaEspatula();
  mallaEp.position.copy(yo.ep.pos);
  sonido.espatula();
  aviso(`¡La espátula dorada va por ${red.jugadores.get(mejor)?.nombre || 'él'}!`);
  publicar();
}
function terminaEspatula() {
  quitaMalla(mallaEp);
  mallaEp = null;
  yo.ep = null;
  publicar();
}
function pasoEspatula(dt) {
  const e = yo.ep;
  if (!e) return;
  const j = otros.get(e.u);
  e.t += dt;
  e.cd -= dt;
  if (!j || !j.vivo || terminado || e.t > ESPATULA_CFG.vida) { terminaEspatula(); return; }
  const meta = j.mesh.position.clone();
  meta.y += ALTO * 0.6;
  const dir = meta.clone().sub(e.pos), dist = dir.length();
  dir.normalize();
  if (dist < ESPATULA_CFG.toca) {
    if (e.cd <= 0) {
      e.cd = ESPATULA_CFG.cada;
      red.golpear(e.u, { dmg: 1, cab: false, a: ESPATULA });
      marcaGolpe(false);
      sonido.espatulazo(meta.distanceTo(yo.pos));
      chispa(meta, '#ffd54a');
      e.pos.addScaledVector(dir, -1.2);   // rebota y vuelve
    }
  } else e.pos.addScaledVector(dir, Math.min(dist, ESPATULA_CFG.vel * dt));
  mallaEp.position.copy(e.pos);
  mallaEp.rotation.y += dt * 14;
  mallaEp.rotation.x = 0.6;
}

// ---------- Voz ----------
// La voz la maneja la sala; aquí solo se pinta quién está y quién habla.
function alVoces(v) {
  $('voz-entrar').hidden = !ONLINE || !red || red.mirando || (v.en || []).includes(red.yo);
  const en = (v.en || []).filter(u => red && red.jugadores.has(u));
  $('voces').hidden = !en.length;
  $('voces').innerHTML = '';
  for (const u of en) {
    const s = document.createElement('span');
    s.className = (v.hablan || []).includes(u) ? 'habla' : '';
    s.textContent = u === red.yo ? 'Tú' : red.jugadores.get(u).nombre;
    $('voces').append(s);
  }
}

// ---------- HUD ----------
let danio = 0, marcaT = 0, tablaT = 0, avisoT = null;
function marcaGolpe(cab) {
  marcaT = 0.15;
  $('marca').classList.toggle('cab', cab);
}
function aviso(txt) {
  $('aviso').textContent = txt;
  $('aviso').hidden = false;
  clearTimeout(avisoT);
  avisoT = setTimeout(() => { $('aviso').hidden = true; }, 1800);
}

let firmaInv = '';
function hud(dt) {
  const a = armaActual(), m = yo.mun[a.id];
  $('vida-barra').style.width = Math.max(0, yo.hp / yo.maxHp * 100) + '%';
  $('vida-barra').classList.toggle('baja', yo.hp <= 35);
  $('vida-num').textContent = Math.max(0, Math.round(yo.hp));
  $('arma-nombre').textContent = `${yo.sel + 1} · ${a.nombre}${a.melee ? '' : ' (' + a.corto + ')'}`;
  $('municion').textContent = a.melee ? '∞' : yo.recargando > 0 ? 'recargando…' : `${m?.c ?? 0} / ${a.cargador}`;
  $('reservas').textContent = a.melee ? '' : `🔄 ${m?.r ?? 0} recargas`;
  $('reservas').classList.toggle('vacio', !a.melee && !(m?.r > 0));
  const inv = yo.inv.map((id, i) => `${i}:${id}:${i === yo.sel}`).join() + '|' + yo.gr.join() + yo.grSel + yo.espatula +
    '|' + [...yo.perks].join() + '|' + [...yo.pap].join();
  if (inv !== firmaInv) {
    firmaInv = inv;
    $('inv').innerHTML = yo.inv.map((id, i) => `<span class="${i === yo.sel ? 'activa' : ''}${id === null ? ' vacia' : ''}">` +
      `<kbd>${i + 1}</kbd> ${id === null ? '—' : (yo.pap.has(id) ? '⚡' : '') + ARMAS[id].corto}</span>`).join('') +
      (yo.espatula ? '<span class="oro"><kbd>Q</kbd> ✨ Espátula</span>' : '');
    $('granadas').innerHTML = yo.gr.length
      ? yo.gr.map((k, i) => `<span class="${i === yo.grSel ? 'sel' : ''}">${GRANADAS[k].icono} ${GRANADAS[k].nombre}</span>`).join('') + '<small>G lanza · T cambia</small>'
      : '<small>Sin granadas</small>';
    $('bebidas').hidden = !yo.perks.size;
    $('bebidas').innerHTML = [...yo.perks].map(t => `<span style="--c:${BEBIDAS[t].color}" title="${BEBIDAS[t].nombre}: ${BEBIDAS[t].texto}"><i>${ICONO_BEBIDA[t]}</i>${BEBIDAS[t].nombre}</span>`).join('');
  }
  const activos = [];
  if (bonos?.insta) activos.push(['insta', bonos.instaT]);
  if (yo.maquina > 0) activos.push(['maquina', yo.maquina]);
  $('bonos').hidden = !activos.length;
  if (activos.length) $('bonos').innerHTML = activos.map(([t, s]) =>
    `<span class="${s < 5 ? 'acaba' : ''}" style="--c:${BONOS[t].color}"><i>${BONOS[t].icono}</i>${BONOS[t].nombre} ${Math.ceil(s)}</span>`).join('');
  danio = Math.max(0, danio - dt * 2.5);
  $('danio').style.opacity = danio * 0.7;
  marcaT -= dt;
  $('marca').style.opacity = marcaT > 0 ? 1 : 0;
  const francotirador = a.zoom && yo.zoom > 0.85;
  $('mira-sniper').hidden = !francotirador;
  $('mira').hidden = francotirador || !yo.vivo;
  $('abatido').hidden = !(yo.abatido > 0) || terminado;
  if (yo.abatido > 0) $('abatido').textContent = yo.autoLevanta ? `Quick Revive te levanta en ${Math.ceil(yo.abatido)}…`
    : `En el suelo: te quedan ${Math.ceil(yo.abatido)} s para que te levanten`;
  if (!yo.vivo && !terminado) $('muerte-txt').textContent = esZombis() ? textoCaido()
    : `${yo.asesino} te frió. Vuelves en ${Math.ceil(yo.muerteT)}…`;
  if (zombis) {
    const b = $('puntos-z').firstChild;
    if (b && b.textContent !== '💰 ' + yo.pz) b.textContent = '💰 ' + yo.pz;
  }

  tablaT -= dt;
  if (tablaT > 0) return;
  tablaT = 0.25;
  if (zombis) return tablaZombis();
  const filas = [...red.jugadores].map(([u, f]) => ({
    u, n: f.nombre, c: f.color, k: marcador.bajas[u] || 0, d: marcador.muertes[u] || 0,
  }));
  filas.sort((p, q) => q.k - p.k || p.d - q.d);
  $('tabla-filas').innerHTML = '';
  for (const f of filas) {
    const tr = document.createElement('tr');
    if (f.u === red.yo) tr.className = 'yo';
    tr.innerHTML = '<td><i></i><span></span></td><td></td><td></td>';
    if (red.equipos) tr.classList.add(red.equipos[f.u] || 'x');
    tr.querySelector('i').style.background = f.c;
    tr.querySelector('span').textContent = f.n;
    tr.children[1].textContent = f.k;
    tr.children[2].textContent = f.d;
    $('tabla-filas').append(tr);
  }
  if (marcador.puntosEq) {
    const pe = marcador.puntosEq, band = red.variante === 'bandera' ? ' 🚩' : '';
    $('equipos').hidden = false;
    $('equipos').innerHTML = `<b class="rojo">Rojo ${pe.rojo || 0}</b><span>${red.meta}${band}</span><b class="azul">${pe.azul || 0} Azul</b>`;
  }
  const lider = filas[0], mio = filas.find(f => f.u === red.yo);
  $('marcador-mini').textContent = (mio ? `Tú ${mio.k}/${mio.d}` : 'Mirando') +
    (lider && lider !== mio ? ` · Líder: ${lider.n} (${lider.k})` : '');
}
// En zombis la tabla son los puntos, los zombis fritos y las caídas.
function tablaZombis() {
  const filas = [...red.jugadores].map(([u, f]) => {
    const j = otros.get(u);
    return {
      u, n: f.nombre, c: f.color, d: marcador.muertes[u] || 0,
      p: u === red.yo ? yo.pzT : j ? j.pz || 0 : marcador.puntos?.[u] || 0,
      z: u === red.yo ? yo.zk : j ? j.zk || 0 : 0,
    };
  });
  filas.sort((a, b) => b.p - a.p);
  $('tabla-filas').innerHTML = '';
  for (const f of filas) {
    const tr = document.createElement('tr');
    if (f.u === red.yo) tr.className = 'yo';
    tr.innerHTML = '<td><i></i><span></span></td><td></td><td></td><td></td>';
    tr.querySelector('i').style.background = f.c;
    tr.querySelector('span').textContent = f.n;
    tr.children[1].textContent = f.p;
    tr.children[2].textContent = f.z;
    tr.children[3].textContent = f.d;
    $('tabla-filas').append(tr);
  }
  const r = zombis.ronda || marcador.ronda || 1, resp = zombis.respiro;
  $('marcador-mini').textContent = `Ronda ${r} · ` + (resp > 0 ? `la siguiente en ${Math.ceil(resp)}…` : `quedan ${zombis.quedan} zombis`);
}

// ---------- La sartén en la mano ----------
// Se lleva del mango, abajo a la derecha y apuntando al frente, con la cara
// girada hacia el centro. El sartenazo es un golpe de derecha: la sube y la
// echa atrás por encima del hombro, la baja en diagonal hasta la izquierda con
// la cara por delante y vuelve. `yo.tajo` va de 1 a 0 a lo largo de SARTEN_DURA segundos.
const SARTEN_DURA = 0.38;
const POSE_SARTEN = {
  //            posición (x, y, z)        giro (x, y, z)
  quieta: [[0.33, -0.28, -0.52], [0.35, 0.55, 0.35]],
  arriba: [[0.38, -0.05, -0.3], [1.1, -0.4, 1.4]],
  golpe: [[-0.15, -0.28, -0.6], [0.2, 1.0, 1.45]],
};
const suave = u => u * u * (3 - 2 * u);
function poseSarten(m, cruza) {
  const u = 1 - yo.tajo;   // 0: empieza; 1: terminó
  let de = POSE_SARTEN.quieta, a = POSE_SARTEN.quieta, k = 0;
  if (yo.tajo > 0) {
    if (u < 0.3) { de = POSE_SARTEN.quieta; a = POSE_SARTEN.arriba; k = suave(u / 0.3); }
    else if (u < 0.55) { de = POSE_SARTEN.arriba; a = POSE_SARTEN.golpe; k = Math.pow((u - 0.3) / 0.25, 0.7); }
    else { de = POSE_SARTEN.golpe; a = POSE_SARTEN.quieta; k = suave((u - 0.55) / 0.45); }
  }
  const mez = (i, j) => de[i][j] + (a[i][j] - de[i][j]) * k;
  const vel = Math.hypot(yo.vel.x, yo.vel.z), paso = Math.min(1, vel / VEL);
  m.position.set(
    mez(0, 0) + Math.sin(yo.bob) * 0.015 * paso,
    mez(0, 1) + Math.abs(Math.cos(yo.bob)) * 0.015 * paso - yo.sprintK * 0.06,
    mez(0, 2),
  );
  m.rotation.set(mez(1, 0) - cruza * 0.3, mez(1, 1) + cruza * 0.35, mez(1, 2));
}

// ---------- Bucle ----------
const _adelante = new THREE.Vector3(), _derecha = new THREE.Vector3(), _quiero = new THREE.Vector3();
let acumRed = 0, reloj = performance.now();

function actualizar(dt) {
  const a = armaActual();
  if (red.mirando || terminado) {
    // Mirón o sala terminada: la cámara da vueltas sobre la arena
    const t = performance.now() / 1000 * 0.08;
    camara.position.set(Math.sin(t) * 30, 16, Math.cos(t) * 30);
    camara.lookAt(0, 2, 0);
  } else if (yo.vivo) {
    _adelante.set(-Math.sin(yo.yaw), 0, -Math.cos(yo.yaw));
    _derecha.set(Math.cos(yo.yaw), 0, -Math.sin(yo.yaw));
    _quiero.set(0, 0, 0);
    if (teclas.has('KeyW') || teclas.has('ArrowUp')) _quiero.add(_adelante);
    if (teclas.has('KeyS') || teclas.has('ArrowDown')) _quiero.sub(_adelante);
    if (teclas.has('KeyD') || teclas.has('ArrowRight')) _quiero.add(_derecha);
    if (teclas.has('KeyA') || teclas.has('ArrowLeft')) _quiero.sub(_derecha);
    if (_quiero.lengthSq() > 0) _quiero.normalize();
    const shift = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
    const avanza = (teclas.has('KeyW') || teclas.has('ArrowUp')) && !teclas.has('KeyS') && !teclas.has('ArrowDown');
    const mira = a.zoom && yo.zoom > 0.5;
    yo.corriendo = shift && !yo.sinSprint && avanza && !mira && yo.deslizando <= 0 && !yo.abatido;
    _quiero.multiplyScalar((yo.abatido > 0 ? ABATIDO.vel : 1) * VEL * (mira ? 0.5 : (a.melee ? 1.1 : 1) * (yo.corriendo ? SPRINT : 1) * (yo.perks.has('stamina') ? 1.1 : 1)));
    if (yo.deslizando > 0) {
      // Deslizándose no se dobla: el roce frena hasta que vuelve a caminar.
      yo.deslizando -= dt;
      if (yo.enSuelo) { const f = Math.exp(-DESLIZ.roce * dt); yo.vel.x *= f; yo.vel.z *= f; }
      if (yo.deslizando <= 0 || Math.hypot(yo.vel.x, yo.vel.z) < VEL * 0.55) yo.deslizando = 0;
    } else {
      const k = 1 - Math.exp(-(yo.enSuelo ? 14 : 3) * dt);
      yo.vel.x += (_quiero.x - yo.vel.x) * k;
      yo.vel.z += (_quiero.z - yo.vel.z) * k;
    }
    yo.cdDesliz = Math.max(0, yo.cdDesliz - dt);
    // Saltar corta el deslizamiento, pero el impulso sigue en el aire.
    // Saltando desde un deslizamiento se llega más alto.
    if (teclas.has('Space') && yo.enSuelo && !yo.abatido) { yo.vel.y = SALTO * (yo.deslizando > 0 ? 1.3 : 1); yo.enSuelo = false; yo.deslizando = 0; }
    moverCuerpo(yo, dt, colisores);
    if (zombis) chocaZombis();

    yo.cadencia = Math.max(0, yo.cadencia - dt);
    if (yo.bebiendo > 0) yo.bebiendo = Math.max(0, yo.bebiendo - dt);
    if (yo.maquina > 0) {
      yo.maquina -= dt;
      if (yo.maquina <= 0) { yo.maquina = 0; yo.cadencia = Math.max(yo.cadencia, 0.35); aviso('Se acabó la Máquina de muerte'); }
    }
    yo.escudo = Math.max(0, yo.escudo - dt);
    // En zombis la vida se recupera sola si pasan unos segundos sin daño.
    if (zombis && !yo.abatido && yo.hp < yo.maxHp && performance.now() - yo.ultDanio > 4000) yo.hp = Math.min(yo.maxHp, yo.hp + 30 * dt);
    // La lava de Pueblo quema a quien la pisa.
    if (inter?.enLava(yo.pos) && yo.escudo <= 0 && !yo.abatido) {
      yo.hp -= 12 * dt;
      yo.ultDanio = performance.now();
      danio = Math.max(danio, 0.5);
      if (yo.hp <= 0) cae({ de: '', n: 'La lava', dmg: 0, cab: false, a: ZOMBI });
    }
    if (yo.recargando > 0) {
      yo.recargando -= dt;
      const m = yo.mun[a.id];
      if (yo.recargando <= 0) { yo.recargando = 0; if (m && m.r > 0) { m.c = a.cargador; m.r--; } }
    }
    if (gatillo && (a.auto || !yaDisparo)) { disparar(); yaDisparo = true; }
    if (yo.abatido > 0) pasoAbatido(dt);
    const zoomObj = a.zoom && yo.apuntando && yo.recargando === 0 ? 1 : 0;
    yo.zoom += (zoomObj - yo.zoom) * (1 - Math.exp(-14 * dt));
  } else {
    yo.muerteT -= dt;
    yo.zoom = 0;
    yo.corriendo = false;
    yo.deslizando = 0;
    // En zombis no se vuelve por tiempo: se vuelve con la ronda siguiente.
    if (yo.muerteT <= 0 && !zombis) aparecer();
  }
  yo.sprintK += ((yo.corriendo || yo.deslizando > 0 ? 1 : 0) - yo.sprintK) * (1 - Math.exp(-8 * dt));
  yo.agacho += ((yo.deslizando > 0 ? 1 : 0) - yo.agacho) * (1 - Math.exp(-14 * dt));

  if (!red.mirando && !terminado) {
    const alturaCam = yo.vivo ? (yo.abatido > 0 ? OJOS * ABATIDO.ojos : OJOS - DESLIZ.baja * yo.agacho) : OJOS + Math.min(2.5, (3 - yo.muerteT) * 2);
    camara.position.set(yo.pos.x, yo.pos.y + alturaCam, yo.pos.z);
    camara.rotation.set(yo.pitch, yo.yaw, yo.agacho * 0.06);
  }
  const fov = 75 + 8 * yo.sprintK - yo.zoom * (a.zoom ? 55 : 0);
  if (Math.abs(camara.fov - fov) > 0.01) { camara.fov = fov; camara.updateProjectionMatrix(); }

  // Arma en mano
  const enMano = yo.vivo && !red.mirando && !terminado;
  const bebe = yo.bebiendo > 0;
  const m = (a.pap && modelosPap[a.id]) || modelos[a.id];
  for (const x of [...Object.values(modelos), ...Object.values(modelosPap)]) x.visible = enMano && !bebe && x === m && yo.zoom < 0.8;
  pasoBotella(enMano && bebe);
  if (a.pap) brilloPap();
  if (a.id === MAQUINA) m.userData.giro.rotation.z += dt * (gatillo ? 40 : 6);
  const vel = Math.hypot(yo.vel.x, yo.vel.z);
  if (yo.enSuelo) yo.bob += dt * vel * 1.6;
  yo.retroceso = Math.max(0, yo.retroceso - dt * 8);
  yo.tajo = Math.max(0, yo.tajo - dt / SARTEN_DURA);
  const bajar = yo.recargando > 0 ? Math.sin(Math.PI * (1 - yo.recargando / yo.recargaTotal)) : 0;
  m.position.copy(BASE_ARMA);
  m.position.x += Math.sin(yo.bob) * 0.012 * Math.min(1, vel / VEL) - yo.zoom * 0.24;
  m.position.y += Math.abs(Math.cos(yo.bob)) * 0.012 * Math.min(1, vel / VEL) - bajar * 0.15 - yo.sprintK * 0.05;
  m.position.z += yo.retroceso * 0.07;
  // Corriendo, el arma se baja y se cruza; deslizándose vuelve a apuntar.
  const cruza = yo.corriendo ? yo.sprintK : 0;
  m.rotation.set(yo.retroceso * 0.15 - bajar * 0.7 - cruza * 0.35, cruza * 0.45, 0);
  if (a.melee) poseSarten(m, cruza);

  actualizaBanderas();
  actualizaArmasSuelo();
  const reviveA = zombis && !terminado ? buscaCaido() : null;
  inter?.actualizar(dt, teclas.has('KeyE') && !reviveA);
  bonos?.actualizar(dt);
  if (zombis) pasoRevivir(dt, reviveA);
  if (yo.cargaAuto >= 0) {
    const antes = Math.floor(yo.cargaAuto / 0.2);
    yo.cargaAuto += dt;
    if (Math.floor(yo.cargaAuto / 0.2) !== antes) sonido.pitido(Math.floor(yo.cargaAuto / 0.2));
    if (yo.cargaAuto >= AUTO.carga) autodestruir();
  }
  $('auto').hidden = yo.cargaAuto < 0;
  if (yo.cargaAuto >= 0) $('auto-barra').style.width = Math.min(100, yo.cargaAuto / AUTO.carga * 100) + '%';
  granadas.paso(dt);
  pasoZombis(dt);
  pasoEspatula(dt);
  yo.cdGranada = Math.max(0, yo.cdGranada - dt);
  if (temblor > 0) {
    camara.position.x += (Math.random() - 0.5) * temblor * 0.3;
    camara.position.y += (Math.random() - 0.5) * temblor * 0.3;
    temblor = Math.max(0, temblor - dt * 2.5);
  }
  red.tick(dt);
  acumRed += dt;
  if (acumRed >= 1 / HZ_RED) { acumRed = 0; publicar(); }

  const kp = 1 - Math.exp(-14 * dt);
  const t = performance.now() / 1000;
  for (const j of otros.values()) {
    const antes = j.mesh.position.clone();
    j.mesh.position.lerp(j.obj, kp);
    let dRy = j.ry - j.mesh.rotation.y;
    dRy = Math.atan2(Math.sin(dRy), Math.cos(dRy));
    j.mesh.rotation.y += dRy * kp;
    const v = dt > 0 ? antes.distanceTo(j.mesh.position) / dt : 0;
    const c = j.mesh.userData.cuerpo;
    j.mesh.userData.casco.material.emissive.setRGB(j.ad ? 0.6 + 0.4 * Math.sin(t * 30) : 0, 0, 0);
    c.rotation.z = j.ds ? 0 : Math.sin(t * 14) * 0.12 * Math.min(1, v / 5);
    // Deslizándose va echado hacia atrás.
    // En el suelo, tirado de espaldas; deslizándose, echado hacia atrás.
    c.rotation.x += ((j.ab ? 1.35 : j.ds ? 0.7 : 0) - c.rotation.x) * kp;
    if (j.ab) c.rotation.z = 0;
    c.position.y = j.ab ? 0.25 : Math.abs(Math.sin(t * 14)) * 0.08 * Math.min(1, v / 5);
    if (j.epMalla && j.epObj) { j.epMalla.position.lerp(j.epObj, kp); j.epMalla.rotation.y += dt * 14; j.epMalla.rotation.x = 0.6; }
  }

  hud(dt);
}

function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (ahora - reloj) / 1000);
  reloj = ahora;
  pasoMando(dt);
  if (jugando) actualizar(dt);
  else {
    const t = ahora / 1000 * 0.08;
    camara.position.set(Math.sin(t) * 30, 16, Math.cos(t) * 30);
    camara.lookAt(0, 2, 0);
  }
  actualizarEfectos(dt);
  renderer.clear();
  renderer.render(escena, camara);
  if (jugando) {
    renderer.clearDepth();
    renderer.render(escenaArma, camaraArma);
  }
}
requestAnimationFrame(bucle);

// Para depurar desde la consola: __yemas.paso(dt) avanza el juego sin requestAnimationFrame
window.__yemas = {
  yo, otros, disparar, beber, granadas, suelo, pref, alGolpe, nubes, tirarEspatula, director, get cegado() { return cegado; }, get zombis() { return zombis; },
  get inter() { return inter; }, get mundo() { return mundo; }, get pad() { return { padPausa, padActivo }; },
  get red() { return red; }, get marcador() { return marcador; },
  paso(dt) { actualizar(dt); actualizarEfectos(dt); escena.updateMatrixWorld(); },
};
