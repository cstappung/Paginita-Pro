// Yemas: shooter de huevos en primera persona.
// Suelto es práctica contra bots; con ?modo=online dentro de la sala de Juegos,
// la sala le pasa los demás jugadores y anota las muertes en el registro.
import * as THREE from 'three';
import { crearMundo, moverCuerpo, rayoMundo, rayoHuevo, crearHuevo, crearBandera, crearBase, SPAWNS, BASES, ALTO, OJOS } from 'yemas/mundo';
import { ARMAS, caida } from 'yemas/armas';
import { sonido } from 'yemas/audio';
import { conectarMarco, conectarLocal, PALETA, COLOR_EQUIPO } from 'yemas/red';
import { crearGranadas, GRANADA } from 'yemas/granada';

const VEL = 7, SALTO = 8, SENS = 0.0022, HZ_RED = 12, INVULNERABLE = 1.5;
const ONLINE = new URLSearchParams(location.search).get('modo') === 'online' && parent !== window;
const $ = id => document.getElementById(id);
document.documentElement.classList.toggle('en-sala', ONLINE);

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

escena.add(new THREE.HemisphereLight('#ffffff', '#c9b28a', 1.6));
const sol = new THREE.DirectionalLight('#fff3dd', 2.2);
sol.position.set(20, 40, 12);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
sol.shadow.bias = -0.0005;
escena.add(sol);

const { colisores } = crearMundo(escena);

// El arma en primera persona va en su propia escena para que no atraviese paredes
const escenaArma = new THREE.Scene();
const camaraArma = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
escenaArma.add(new THREE.HemisphereLight('#ffffff', '#886644', 2.2));
const luzArma = new THREE.DirectionalLight('#ffffff', 1.5);
luzArma.position.set(1, 2, 1);
escenaArma.add(luzArma);

function modeloArma(a, i) {
  const g = new THREE.Group();
  const cuerpo = new THREE.MeshLambertMaterial({ color: a.color });
  const oscuro = new THREE.MeshLambertMaterial({ color: '#2d2d35' });
  const largo = [0.55, 0.5, 0.85][i], ancho = [0.09, 0.13, 0.08][i];
  const caja = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.12, largo * 0.55), cuerpo);
  caja.position.z = -largo * 0.2;
  g.add(caja);
  const r = i === 1 ? 0.045 : 0.025;
  const canon = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 10), oscuro);
  canon.rotation.x = Math.PI / 2;
  canon.position.set(0, 0.03, -largo * 0.5);
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
  g.visible = false;
  escenaArma.add(g);
  return g;
}
const modelos = ARMAS.map(modeloArma);
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
let marcador = { bajas: {}, muertes: {}, puntosEq: null, banderas: null };
const yo = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), enSuelo: false,
  yaw: 0, pitch: 0, hp: 100, vivo: false,
  arma: 0, balas: ARMAS.map(a => a.cargador), recargando: 0, cadencia: 0,
  zoom: 0, apuntando: false, escudo: 0, muerteT: 0, asesino: '',
  disparo: 0, finales: null, retroceso: 0, bob: 0,
  granadas: GRANADA.porVida, cdGranada: 0, lanzo: null, revento: null,
  cargaAuto: -1,    // < 0: no se está cargando la autodestrucción
};
// La autodestrucción: se mantiene X un momento (soltarla antes la cancela,
// así no se dispara sin querer), el huevo pita y brilla —también en la
// pantalla de los demás, que alcanzan a arrancar— y revienta llevándose a
// los rivales que tenga cerca. Uno muere siempre; es la baja «a 4».
const AUTO = { nombre: 'Autodestrucción', carga: 0.9, radio: 6.5, danio: 220 };
// Para el feed y los avisos: las tres armas, la granada y la autodestrucción, en el orden del `a`.
const NOMBRE_ARMA = [...ARMAS.map(a => a.nombre), GRANADA.nombre, AUTO.nombre];
const otros = new Map();
const teclas = new Set();
let gatillo = false, yaDisparo = false;
const miNombre = () => red?.jugadores.get(red.yo)?.nombre || '';
const miColor = () => red?.jugadores.get(red.yo)?.color || PALETA[0];
const puedoJugar = () => jugando && !terminado && red && !red.mirando;
const EQUIPOS = ['rojo', 'azul'];
const NOMBRE_EQ = { rojo: 'Rojo', azul: 'Azul' };
const miEquipo = () => red?.equipos?.[red.yo] || '';
const rival = () => miEquipo() === 'rojo' ? 'azul' : 'rojo';
const aliado = id => !!red?.equipos && red.equipos[id] === miEquipo();

const handlers = { alConfig, alJugador, alGolpe, alBaja, alFeed, alSuceso, alMarcador, alFin, alVoces };

// ---------- Menú (sólo práctica) ----------
let colorElegido = PALETA[0];
if (ONLINE) {
  $('menu').hidden = true;
  $('espera').hidden = false;
  conectarMarco(handlers);
} else {
  const guardado = (() => { try { return JSON.parse(localStorage.getItem('yemas') || '{}'); } catch { return {}; } })();
  $('nombre').value = guardado.nombre || '';
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
    try { localStorage.setItem('yemas', JSON.stringify({ nombre, color: colorElegido })); } catch {}
    sonido.iniciar();
    conectarLocal({ nombre, color: colorElegido, colisores }, handlers);
    bloquear();
  };
}

function alConfig(r) {
  red = r;
  $('menu').hidden = true;
  $('espera').hidden = true;
  $('hud').hidden = false;
  $('meta').textContent = !red.meta ? 'Práctica contra bots'
    : red.variante === 'bandera' ? `Captura la bandera · primero a ${red.meta} 🚩`
    : red.variante === 'equipos' ? `Duelo por equipos · primero a ${red.meta} bajas`
    : `Todos contra todos · primero a ${red.meta} bajas`;
  marcador = { bajas: {}, muertes: {}, puntosEq: null, banderas: null };
  jugando = true;
  if (red.variante === 'bandera') montaBanderas();
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
  if (!bloqueado()) { teclas.clear(); gatillo = false; yo.apuntando = false; }
});

addEventListener('keydown', e => {
  if (!jugando) return;
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  teclas.add(e.code);
  if (e.code === 'Tab') $('tabla').hidden = false;
  if (e.code === 'KeyR') recargar();
  if (e.code === 'KeyV') red?.hablar(true);
  if (e.code === 'KeyG' || e.code === 'Digit4') lanzarGranada();
  if (e.code === 'KeyX' && puedoJugar() && yo.vivo) yo.cargaAuto = 0;
  if (e.code === 'KeyF') pantallaCompleta();
  if (/^Digit[123]$/.test(e.code)) cambiarArma(+e.code.slice(5) - 1);
});
addEventListener('keyup', e => {
  teclas.delete(e.code);
  if (e.code === 'Tab') $('tabla').hidden = true;
  if (e.code === 'KeyV') red?.hablar(false);
  if (e.code === 'KeyX') yo.cargaAuto = -1;   // soltó antes de tiempo: no pasa nada
});
// Soltar la V cuando se pierde el foco: si no, el micrófono queda abierto.
addEventListener('blur', () => { red?.hablar(false); yo.cargaAuto = -1; });
addEventListener('mousemove', e => {
  if (!bloqueado() || !yo.vivo) return;
  const s = SENS * (1 - yo.zoom * 0.7);
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
  cambiarArma((yo.arma + (e.deltaY > 0 ? 1 : 2)) % 3);
});

// ---------- Armas ----------
function cambiarArma(i) {
  if (i === yo.arma || !yo.vivo) return;
  yo.arma = i;
  yo.recargando = 0;
  yo.cadencia = Math.max(yo.cadencia, 0.35);
  yo.retroceso = 1;
}

function recargar() {
  const a = ARMAS[yo.arma];
  if (!yo.vivo || yo.recargando > 0 || yo.balas[yo.arma] === a.cargador) return;
  yo.recargando = a.recarga;
  sonido.recarga();
}

const _u = new THREE.Vector3(), _v = new THREE.Vector3();
function disparar() {
  const a = ARMAS[yo.arma];
  if (yo.recargando > 0 || yo.cadencia > 0) return;
  if (yo.balas[yo.arma] <= 0) { sonido.vacio(); recargar(); return; }
  yo.balas[yo.arma]--;
  yo.cadencia = a.cadencia;

  const o = camara.getWorldPosition(new THREE.Vector3());
  const base = camara.getWorldDirection(new THREE.Vector3());
  _u.set(0, 1, 0).cross(base).normalize();
  _v.copy(base).cross(_u).normalize();
  const moviendo = Math.hypot(yo.vel.x, yo.vel.z) > 1.5;
  let disp = a.dispersion + (moviendo ? a.dispMov : 0) + (yo.enSuelo ? 0 : 0.04);
  if (a.zoom && yo.zoom > 0.9) disp = a.dispZoom + (moviendo ? 0.02 : 0);

  const golpes = new Map();
  const finales = [];
  const boca = camara.localToWorld(new THREE.Vector3(0.22, -0.2, -0.7));
  for (let p = 0; p < a.perdigones; p++) {
    const r = Math.sqrt(Math.random()) * disp, th = Math.random() * Math.PI * 2;
    const d = base.clone().addScaledVector(_u, r * Math.cos(th)).addScaledVector(_v, r * Math.sin(th)).normalize();
    let t = rayoMundo(o, d, a.alcance, colisores);
    let quien = null;
    for (const [id, j] of otros) {
      if (!j.vivo || aliado(id)) continue;   // sin fuego amigo: la bala los atraviesa
      const tj = rayoHuevo(o, d, j.mesh.position);
      if (tj !== null && tj < t) { t = tj; quien = id; }
    }
    const fin = o.clone().addScaledVector(d, t);
    finales.push([+fin.x.toFixed(2), +fin.y.toFixed(2), +fin.z.toFixed(2)]);
    trazo(boca, fin, '#fff2a8');
    if (quien) {
      const j = otros.get(quien);
      const cab = fin.y - j.mesh.position.y > ALTO * 0.72;
      const g = golpes.get(quien) || { dmg: 0, cab: false };
      g.dmg += a.danio * (cab ? a.cabeza : 1) * caida(a, t);
      g.cab = g.cab || cab;
      golpes.set(quien, g);
      chispa(fin, j.color);
    } else if (t < a.alcance) {
      chispa(fin, '#ffffff');
    }
  }
  for (const [id, g] of golpes) red.golpear(id, { dmg: Math.round(g.dmg), cab: g.cab, a: yo.arma });
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
  sonido.disparo(yo.arma);
  publicar();
}

// ---------- Vida y muerte ----------
function aparecer() {
  // En equipos cada uno aparece en su mitad del mapa: rojo al norte (z > 0).
  const lado = miEquipo() === 'rojo' ? 1 : miEquipo() === 'azul' ? -1 : 0;
  const lugares = lado ? SPAWNS.filter(s => s.z * lado >= 15) : SPAWNS;
  let mejor = lugares[0], dMejor = -1;
  for (const s of lugares) {
    let dMin = Infinity;
    for (const [id, j] of otros) if (j.vivo && !aliado(id)) dMin = Math.min(dMin, s.distanceTo(j.obj));
    dMin = Math.min(dMin, 60) + Math.random() * 10;
    if (dMin > dMejor) { dMejor = dMin; mejor = s; }
  }
  yo.pos.copy(mejor);
  yo.vel.set(0, 0, 0);
  yo.yaw = Math.atan2(mejor.x, mejor.z);
  yo.pitch = 0;
  yo.hp = 100;
  yo.vivo = true;
  yo.balas = ARMAS.map(a => a.cargador);
  yo.recargando = 0;
  yo.granadas = GRANADA.porVida;
  yo.escudo = INVULNERABLE;
  $('muerte').hidden = true;
  publicar();
}

function alGolpe(g) {
  if (!puedoJugar() || !yo.vivo || yo.escudo > 0) return;
  yo.hp -= g.dmg;
  danio = 1;
  sonido.dolor();
  if (yo.hp <= 0) morir(g);
}

function alBaja(victima) {
  sonido.baja();
  aviso(`Freíste a ${victima}`);
}

function morir(g) {
  yo.hp = 0;
  yo.vivo = false;
  yo.cargaAuto = -1;
  yo.muerteT = 3;
  yo.asesino = g.n;
  gatillo = false;
  yo.apuntando = false;
  // Quien lleva una bandera la suelta donde cae: el registro necesita el sitio.
  const llevo = marcador.banderas && EQUIPOS.some(b => marcador.banderas[b]?.uid === red.yo);
  red.morir(llevo ? { ...g, x: r2(yo.pos.x), z: r2(yo.pos.z) } : g);
  explotar(yo.pos, miColor());
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
  $('fin-txt').textContent = eq ? (eq === miEquipo() ? `¡Ganó tu equipo, el ${NOMBRE_EQ[eq]}!` : `Ganó el equipo ${NOMBRE_EQ[eq]}.`)
    : f.ganador === red.yo ? '¡Ganaste! Nadie te frió a tiempo.'
    : g ? `${g.nombre} llegó primero a la meta.` : 'La partida terminó.';
  $('fin').hidden = false;
}

// ---------- Los demás ----------
function alJugador(id, e) {
  if (!red || id === red.yo) return;
  let j = otros.get(id);
  if (!e) {
    if (j) { escena.remove(j.mesh); otros.delete(id); }
    return;
  }
  const ficha = red.jugadores.get(id) || { nombre: 'Huevo', color: PALETA[0] };
  if (!j) {
    j = {
      mesh: crearHuevo(ficha.color, ficha.nombre), obj: new THREE.Vector3(e.x, e.y, e.z),
      color: ficha.color, vivo: !!e.v, sI: e.s ? e.s.i : 0, ry: e.ry || 0,
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
  // Su granada: se ve volar y revienta donde su dueño dice.
  if (e.n && e.n.i !== j.nI && Array.isArray(e.n.o) && Array.isArray(e.n.v)) {
    j.nI = e.n.i;
    granadas.lanzar('r' + id + e.n.i, e.n.o.map(Number), e.n.v.map(Number), false, id);
  }
  if (e.x2 && e.x2.i !== j.xI && Array.isArray(e.x2.p)) {
    j.xI = e.x2.i;
    granadas.revienta('r' + id + e.x2.i, e.x2.p.map(Number));
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
    v: yo.vivo ? 1 : 0, a: yo.arma,
  };
  if (yo.disparo) e.s = { i: yo.disparo, e: yo.finales };
  if (yo.lanzo) e.n = yo.lanzo;
  if (yo.cargaAuto >= 0) e.ad = 1;
  if (yo.revento) e.x2 = yo.revento;
  red.publicar(e);
}

// ---------- Granadas ----------
const granadas = crearGranadas(escena, colisores, reventar);
function lanzarGranada() {
  if (!puedoJugar() || !yo.vivo || yo.granadas <= 0 || yo.cdGranada > 0) return;
  yo.granadas--;
  yo.cdGranada = GRANADA.cadencia;
  const dir = camara.getWorldDirection(new THREE.Vector3());
  const o = camara.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.6);
  const v = dir.multiplyScalar(GRANADA.fuerza).add(new THREE.Vector3(yo.vel.x * 0.5, 4, yo.vel.z * 0.5));
  const id = Math.max((yo.lanzo?.i || 0) + 1, Date.now() % 1e9);
  const oa = [r2(o.x), r2(o.y), r2(o.z)], va = [r2(v.x), r2(v.y), r2(v.z)];
  granadas.lanzar(id, oa, va, true, red.yo);
  yo.lanzo = { i: id, o: oa, v: va };
  yo.retroceso = 1;
  sonido.lanza();
  publicar();
}

// Revienta una granada, propia o ajena. Solo la propia hace daño (el dueño
// decide a quién alcanzó, como con las balas): a los rivales por los golpes
// de siempre con arma 3, y a uno mismo directo, a la mitad.
function reventar(p, dueno, id, propia) {
  explosion(p);
  if (!propia || !red) return;
  yo.revento = { i: id, p: [r2(p.x), r2(p.y), r2(p.z)] };
  const alcance = q => alcanceExplosion(p, q, GRANADA.radio, GRANADA.danio);
  golpeaRivales(p, GRANADA.radio, GRANADA.danio, 3);
  if (yo.vivo && yo.escudo <= 0) {
    const dmg = Math.round(alcance(yo.pos.clone().add(new THREE.Vector3(0, ALTO / 2, 0))) / 2);
    if (dmg >= 5) {
      yo.hp -= dmg;
      danio = 1;
      if (yo.hp <= 0) morir({ de: red.yo, n: 'tu propio huevo duro', dmg, cab: false, a: 3 });
    }
  }
  publicar();
}

// Daño de una explosión en `p` sobre el punto `q`: lineal hasta `radio` y
// nada si hay una pared en medio. Lo usan la granada y la autodestrucción.
function alcanceExplosion(p, q, radio, danioMax) {
  const d = p.distanceTo(q);
  if (d >= radio) return 0;
  const dir = q.clone().sub(p).normalize();
  if (rayoMundo(p.clone().addScaledVector(dir, 0.05), dir, d, colisores) < d - 0.3) return 0;   // tapado
  return Math.round(danioMax * (1 - d / radio));
}
function golpeaRivales(p, radio, danioMax, arma) {
  for (const [idJ, j] of otros) {
    if (!j.vivo || aliado(idJ)) continue;
    const dmg = alcanceExplosion(p, j.mesh.position.clone().add(new THREE.Vector3(0, ALTO / 2, 0)), radio, danioMax);
    if (dmg >= 5) { red.golpear(idJ, { dmg, cab: false, a: arma }); marcaGolpe(false); }
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
  yo.revento = { i: id, p: [r2(p.x), r2(p.y), r2(p.z)] };
  morir({ de: red.yo, n: 'tu autodestrucción', dmg: 999, cab: false, a: 4 });
}

let temblor = 0;
function explosion(p, radio = GRANADA.radio) {
  const d = p.distanceTo(yo.pos);
  sonido.explosion(d);
  temblor = Math.max(temblor, Math.max(0, 1 - d / 14));
  const bola = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 }));
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
function explotar(p, color) {
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
  const frito = huevoFrito(p);
  escena.add(frito);
  manchas.push({ obj: frito, t: 14 });
  if (manchas.length > 30) quitaFrito(manchas.shift().obj);
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

function hud(dt) {
  const a = ARMAS[yo.arma];
  $('vida-barra').style.width = Math.max(0, yo.hp) + '%';
  $('vida-barra').classList.toggle('baja', yo.hp <= 35);
  $('vida-num').textContent = Math.max(0, Math.round(yo.hp));
  $('arma-nombre').textContent = `${yo.arma + 1} · ${a.nombre}`;
  $('municion').textContent = yo.recargando > 0 ? 'recargando…' : `${yo.balas[yo.arma]} / ${a.cargador}`;
  $('granadas').textContent = `🥚 ${yo.granadas} · G`;
  $('granadas').classList.toggle('vacio', yo.granadas <= 0);
  danio = Math.max(0, danio - dt * 2.5);
  $('danio').style.opacity = danio * 0.7;
  marcaT -= dt;
  $('marca').style.opacity = marcaT > 0 ? 1 : 0;
  const francotirador = a.zoom && yo.zoom > 0.85;
  $('mira-sniper').hidden = !francotirador;
  $('mira').hidden = francotirador || !yo.vivo;
  if (!yo.vivo && !terminado) $('muerte-txt').textContent = `${yo.asesino} te frió. Vuelves en ${Math.ceil(yo.muerteT)}…`;

  tablaT -= dt;
  if (tablaT > 0) return;
  tablaT = 0.25;
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

// ---------- Bucle ----------
const _adelante = new THREE.Vector3(), _derecha = new THREE.Vector3(), _quiero = new THREE.Vector3();
let acumRed = 0, reloj = performance.now();

function actualizar(dt) {
  const a = ARMAS[yo.arma];
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
    _quiero.multiplyScalar(VEL * (a.zoom && yo.zoom > 0.5 ? 0.5 : 1));
    const k = 1 - Math.exp(-(yo.enSuelo ? 14 : 3) * dt);
    yo.vel.x += (_quiero.x - yo.vel.x) * k;
    yo.vel.z += (_quiero.z - yo.vel.z) * k;
    if (teclas.has('Space') && yo.enSuelo) { yo.vel.y = SALTO; yo.enSuelo = false; }
    moverCuerpo(yo, dt, colisores);

    yo.cadencia = Math.max(0, yo.cadencia - dt);
    yo.escudo = Math.max(0, yo.escudo - dt);
    if (yo.recargando > 0) {
      yo.recargando -= dt;
      if (yo.recargando <= 0) { yo.recargando = 0; yo.balas[yo.arma] = a.cargador; }
    }
    if (gatillo && (a.auto || !yaDisparo)) { disparar(); yaDisparo = true; }
    const zoomObj = a.zoom && yo.apuntando && yo.recargando === 0 ? 1 : 0;
    yo.zoom += (zoomObj - yo.zoom) * (1 - Math.exp(-14 * dt));
  } else {
    yo.muerteT -= dt;
    yo.zoom = 0;
    if (yo.muerteT <= 0) aparecer();
  }

  if (!red.mirando && !terminado) {
    const alturaCam = yo.vivo ? OJOS : OJOS + Math.min(2.5, (3 - yo.muerteT) * 2);
    camara.position.set(yo.pos.x, yo.pos.y + alturaCam, yo.pos.z);
    camara.rotation.set(yo.pitch, yo.yaw, 0);
  }
  const fov = 75 - yo.zoom * (a.zoom ? 55 : 0);
  if (Math.abs(camara.fov - fov) > 0.01) { camara.fov = fov; camara.updateProjectionMatrix(); }

  // Arma en mano
  const enMano = yo.vivo && !red.mirando && !terminado;
  modelos.forEach((m, i) => { m.visible = enMano && i === yo.arma && yo.zoom < 0.8; });
  const m = modelos[yo.arma];
  const vel = Math.hypot(yo.vel.x, yo.vel.z);
  if (yo.enSuelo) yo.bob += dt * vel * 1.6;
  yo.retroceso = Math.max(0, yo.retroceso - dt * 8);
  const bajar = yo.recargando > 0 ? Math.sin(Math.PI * (1 - yo.recargando / a.recarga)) : 0;
  m.position.copy(BASE_ARMA);
  m.position.x += Math.sin(yo.bob) * 0.012 * Math.min(1, vel / VEL) - yo.zoom * 0.24;
  m.position.y += Math.abs(Math.cos(yo.bob)) * 0.012 * Math.min(1, vel / VEL) - bajar * 0.15;
  m.position.z += yo.retroceso * 0.07;
  m.rotation.set(yo.retroceso * 0.15 - bajar * 0.7, 0, 0);

  actualizaBanderas();
  if (yo.cargaAuto >= 0) {
    const antes = Math.floor(yo.cargaAuto / 0.2);
    yo.cargaAuto += dt;
    if (Math.floor(yo.cargaAuto / 0.2) !== antes) sonido.pitido(Math.floor(yo.cargaAuto / 0.2));
    if (yo.cargaAuto >= AUTO.carga) autodestruir();
  }
  $('auto').hidden = yo.cargaAuto < 0;
  if (yo.cargaAuto >= 0) $('auto-barra').style.width = Math.min(100, yo.cargaAuto / AUTO.carga * 100) + '%';
  granadas.paso(dt);
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
    const casco = c.children[0].material;
    casco.emissive.setRGB(j.ad ? 0.6 + 0.4 * Math.sin(t * 30) : 0, 0, 0);
    c.rotation.z = Math.sin(t * 14) * 0.12 * Math.min(1, v / 5);
    c.position.y = Math.abs(Math.sin(t * 14)) * 0.08 * Math.min(1, v / 5);
  }

  hud(dt);
}

function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (ahora - reloj) / 1000);
  reloj = ahora;
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
  yo, otros, disparar, granadas, get red() { return red; }, get marcador() { return marcador; },
  paso(dt) { actualizar(dt); actualizarEfectos(dt); escena.updateMatrixWorld(); },
};
