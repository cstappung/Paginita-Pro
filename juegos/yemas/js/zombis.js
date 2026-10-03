// El modo zombis: oleadas de huevos podridos contra todos los jugadores juntos.
//
// Sin servidor alguien tiene que mover a los zombis, y es el «director»: el
// primer asiento que sigue en la sala y cuyo huevo se ve en `vivo` (main.js
// decide quién es). Su marco los simula, decide a quién muerden y publica en
// su propio estado (`zb`) dónde está cada uno, cuánta vida le queda y las
// últimas muertes con quién las hizo. Los demás solo los dibujan y les
// disparan: el daño viaja con los golpes de siempre, nombrando `z:<id>`, y
// el director lo aplica. Si el director se va, el siguiente adopta el último
// `zb` que vio y sigue desde ahí.
//
// Las rondas sí son estado de la partida: al limpiar una, el director escribe
// `{t:"ronda", r}` en el registro, y ese es el momento en que los caídos
// vuelven (main.js lo ve en el marcador).
//
// Cómo caminan, como en Black Ops: aparecen fuera de una ventana (o salen del
// suelo en los mapas abiertos), arrancan las tablas de a una, trepan por la
// ventana y
// desde ahí van por el grafo del mapa (`nodos`/`enlaces` de mapas.js). Un
// enlace que pasa por una puerta solo vale con la puerta abierta, así que las
// distancias se recalculan (Floyd-Warshall, son menos de cincuenta nodos) cada
// vez que se abre una. Si ven a su presa la persiguen derecho; si no, van al
// nodo visible que deja menos camino hasta el nodo desde donde se la ve.
import * as THREE from 'three';
import { moverCuerpo, rayoMundo, crearZombi, ALTO } from 'yemas/mundo';

export const ZB = {
  mordida: 40, alcance: 1.3, cadencia: 1.1, preparar: 0.35, sube: 0.9, pausa: 9, arranque: 3,
  tabla: 1.0, entra: 1.6, trepa: 2.4, quema: 4, explota: 3, danioExplota: 50,
};
// Vida, cuántos salen y qué tan rápido, por ronda (y por jugadores, cuántos).
// La curva es la de Black Ops pero estirada: las primeras rondas son para
// aprender el mapa y juntar puntos, y la presión llega hacia la 10–15. Antes
// a la ronda 5 los comunes ya iban casi al paso del jugador, salían corredores
// desde la 3 y grandotes desde la 5, y dos mordiscos tumbaban desde la 4.
export const hpRonda = r => r <= 9 ? 60 + 35 * (r - 1) : Math.round(340 * Math.pow(1.09, r - 9));
export const totalRonda = (r, n) => Math.min(90, Math.round((4 + 2.4 * r) * (1 + 0.5 * (Math.max(1, n) - 1))));
export const velRonda = r => Math.min(5.5, 2 + 0.25 * (Math.max(1, r) - 1));
const cadaSpawn = r => Math.max(0.6, 2.3 - 0.1 * r);
// Como en Call of Duty, nunca hay más de 24 en pie a la vez, juegue quien
// juegue y sea la ronda que sea: el resto espera su turno para salir. Por
// debajo del tope, cada dos rondas cabe uno más.
export const MAX_ZOMBIS = 24;
export const maxVivos = (n, r = 1) => Math.min(MAX_ZOMBIS, 5 + 2 * Math.max(1, n) + Math.floor(Math.max(1, r) / 2));
// El mordisco: 30 en la primera (cuatro para caer), 50 hacia la novena y como
// mucho 75.
export const mordidaRonda = r => Math.min(75, 30 + 2.5 * (Math.max(1, r) - 1));
// Tres clases de zombi, para que las rondas no sean solo «lo mismo con más
// vida». El corredor (desde la ronda 5) es más rápido que los comunes y desde
// la 13 te alcanza caminando: hay que correr o pararlo. El grandote (desde la
// 8) es lento, aguanta el triple y muerde más fuerte. Cuántos de cada uno
// sube con la ronda.
// El índice viaja por la red: lo nuevo va al final.
export const TIPOS = ['n', 'c', 'g'];
export const CLASE = {
  n: { hp: 1, mordida: 1, puntos: 60 },
  c: { hp: 0.7, mordida: 1, puntos: 80 },
  g: { hp: 3, mordida: 1.6, puntos: 150 },
};
export const velCorredor = r => Math.min(8.5, 5.5 + 0.2 * (Math.max(5, r) - 5));
const velDe = (tipo, r) => tipo === 'c' ? velCorredor(r) * (0.95 + Math.random() * 0.1)
  : tipo === 'g' ? 2.3 + Math.random() * 0.3 : velRonda(r) * (0.85 + Math.random() * 0.3);
export function tipoRonda(r, azar = Math.random()) {
  const g = r >= 8 ? Math.min(0.18, 0.04 * (r - 7)) : 0;
  const c = r >= 5 ? Math.min(0.4, 0.07 * (r - 4)) : 0;
  return azar < g ? 'g' : azar < g + c ? 'c' : 'n';
}
// Lo que se avisa al empezar las rondas que traen algo nuevo.
export const NOVEDAD_RONDA = {
  5: '¡Cuidado: ahora algunos corren!',
  8: '¡Llegan los grandotes: lentos, pero aguantan el triple!',
  13: '¡Ronda 13: los corredores ya te alcanzan caminando!',
};
const r1 = x => Math.round(x * 10) / 10;
// Firebase devuelve los arreglos como objetos y se come los vacíos.
const lista = x => Array.isArray(x) ? x : Object.values(x || {});
// La fase viaja como número: dentro, fuera (camino a la ventana), rompiendo
// tablas, trepando por la ventana, saliendo del suelo y trepando a algo. Los
// índices viajan por la red: lo nuevo va al final.
const FASES = ['dentro', 'fuera', 'rompe', 'entra', 'brote', 'trepa'];

// El huevo verde que deja cada zombi al morir.
const HUEVOS_MAX = 40, HUEVO_VIDA = 20;
// El huevo que deja un zombi es frito, como el de un jugador, pero verde: la
// clara verdosa, el borde tostado oliva y la yema verde que brilla un poco.
const matBordeV = () => new THREE.MeshLambertMaterial({ color: '#8fa63a', transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
const matClaraV = () => new THREE.MeshLambertMaterial({ color: '#d9f5c4', emissive: '#1d3a10', transparent: true, polygonOffset: true, polygonOffsetFactor: -3 });
const matYemaV = () => new THREE.MeshPhongMaterial({ color: '#5cff2e', emissive: '#1fa012', emissiveIntensity: 0.8, specular: '#ffffff', shininess: 90, transparent: true });
function contorno(radio, puntos = 26) {
  const f = new THREE.Shape();
  const fase = Math.random() * 6, lobulos = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i <= puntos; i++) {
    const a = (i / puntos) * Math.PI * 2;
    const r = radio * (1 + 0.16 * Math.sin(a * lobulos + fase) + 0.08 * Math.sin(a * 7 + fase * 2) + (Math.random() - 0.5) * 0.06);
    if (i === 0) f.moveTo(Math.cos(a) * r, Math.sin(a) * r); else f.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return f;
}
function friteVerde() {
  const g = new THREE.Group();
  const radio = 0.6 + Math.random() * 0.15;
  const borde = new THREE.Mesh(new THREE.ShapeGeometry(contorno(radio * 1.07)), matBordeV());
  borde.rotation.x = -Math.PI / 2; borde.position.y = 0.009;
  const clara = new THREE.Mesh(new THREE.ShapeGeometry(contorno(radio)), matClaraV());
  clara.rotation.x = -Math.PI / 2; clara.position.y = 0.015;
  const yema = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), matYemaV());
  yema.scale.y = 0.55;
  yema.position.set((Math.random() - 0.5) * 0.2, 0.017, (Math.random() - 0.5) * 0.2);
  g.add(borde, clara, yema);
  g.userData.yema = yema;
  return g;
}
const tiraHuevo = g => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
// Las llamas de un zombi que pisó la lava.
const geoLlama = new THREE.ConeGeometry(0.22, 0.7, 7);
const matLlama = new THREE.MeshBasicMaterial({ color: '#ff8a1c', transparent: true, opacity: 0.85, depthWrite: false });
const matLlama2 = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.8, depthWrite: false });

// cb: alCaer({id, pos, killer, cab, a, explota}), pideRonda(r), grunido(pos),
//     rompe(pos) (una tabla arrancada)
export function crearZombis(escena, colisores, cb) {
  const zs = new Map();         // id → zombi
  const vistos = new Set();     // muertes ya anunciadas
  let muertes = [];             // [[id, killer, cab, a, explota]] las últimas, para la red
  let ronda = 0, q = 0, pausa = 0, cdSpawn = 0, entre = 0, pedida = 0, sigId = 1, nJug = 1;
  let mapa = null, inter = null;
  let nodos = [], N = 0, Dist = null, hop = null;
  const huevos = [];
  const metas = new Map();      // uid → {n, t}: el nodo desde donde se ve a cada jugador

  // ---------- El mapa y su grafo ----------
  function ponMapa(m, it) {
    vacia();
    mapa = m; inter = it;
    nodos = (m?.nodos || []).map(([x, z, y]) => new THREE.Vector3(x, y || 0, z));
    N = nodos.length;
    recalcula();
  }
  function recalcula() {
    Dist = new Float32Array(N * N).fill(Infinity);
    hop = new Int16Array(N * N).fill(-1);
    for (let i = 0; i < N; i++) { Dist[i * N + i] = 0; hop[i * N + i] = i; }
    for (const [a, b, p] of mapa?.enlaces || []) {
      if (p && !(inter && inter.puertaAbierta(p))) continue;
      const d = nodos[a].distanceTo(nodos[b]);
      Dist[a * N + b] = Dist[b * N + a] = d;
      hop[a * N + b] = b; hop[b * N + a] = a;
    }
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
      const ik = Dist[i * N + k];
      if (ik === Infinity) continue;
      for (let j = 0; j < N; j++) {
        const d = ik + Dist[k * N + j];
        if (d < Dist[i * N + j]) { Dist[i * N + j] = d; hop[i * N + j] = hop[i * N + k]; }
      }
    }
    metas.clear();
    for (const z of zs.values()) z.replan = 0;
  }

  // ¿Se ve b desde a? Dos rayos, a la altura de las rodillas y del pecho, que
  // sí chocan con las tablas: la mesa que corta el de abajo obliga a rodear.
  const _o = new THREE.Vector3(), _v = new THREE.Vector3();
  function ve(a, b, alturas = [0.6, 1.3]) {
    for (const h of alturas) {
      _o.set(a.x, a.y + h, a.z);
      _v.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const L = _v.length();
      if (L < 1e-3) continue;
      if (rayoMundo(_o, _v.divideScalar(L), L, colisores, true) < L - 0.05) return false;
    }
    return true;
  }
  function cercano(p, filtro) {
    let mejor = -1, dm = Infinity;
    for (let i = 0; i < N; i++) {
      if (filtro && !filtro(i)) continue;
      const d = nodos[i].distanceToSquared(p);
      if (d < dm) { dm = d; mejor = i; }
    }
    return mejor;
  }
  // El nodo meta de un jugador: de los más cercanos, el primero que lo ve.
  function metaDe(j) {
    const m = metas.get(j.uid);
    const ahora = performance.now();
    if (m && ahora - m.t < 300) return m.n;
    const orden = [...nodos.keys()].sort((a, b) => nodos[a].distanceToSquared(j.pos) - nodos[b].distanceToSquared(j.pos));
    let n = orden[0] ?? -1;
    for (const i of orden.slice(0, 6)) if (Math.abs(nodos[i].y - j.pos.y) < 1.2 && ve(nodos[i], j.pos, [1.0])) { n = i; break; }
    metas.set(j.uid, { n, t: ahora });
    return n;
  }
  // Adónde camina un zombi que no ve a su presa.
  function eligeNodo(z, meta) {
    const cand = [];
    for (let i = 0; i < N; i++) {
      const n = nodos[i];
      if (Math.abs(n.y - z.pos.y) > 1) continue;
      const d = n.distanceTo(z.pos);
      if (d > 15 || (d < 0.8 && i !== meta)) continue;
      const s = d + Dist[i * N + meta];
      if (s < Infinity) cand.push([s, i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, i] of cand.slice(0, 6)) if (ve(z.pos, nodos[i])) return i;
    if (z.nodo >= 0 && hop[z.nodo * N + meta] >= 0) return hop[z.nodo * N + meta];
    return cercano(z.pos);
  }

  // ---------- Los zombis ----------
  function nuevo(id, x, y, z, hp, max, fase = 'dentro', v = -1, tipo = 'n') {
    const mesh = crearZombi(tipo);
    const zb = {
      tipo,
      id, mesh, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), enSuelo: true,
      obj: new THREE.Vector3(x, y, z), ry: 0, hp, max, sube: fase === 'brote' ? 0 : 1,
      fase, v, t: 0, de: null, nodo: -1, meta: -1, ve: false, replan: 0, lejos: 0, quema: 0,
      cd: 0.6, prep: -1, atasco: 0, lado: 1, desvio: 0, golpeT: 0, grunido: 2 + Math.random() * 6,
      vel0: velDe(tipo, Math.max(1, ronda)),
    };
    mesh.position.set(x, y - (zb.sube < 1 ? ALTO : 0), z);
    escena.add(mesh);
    zs.set(id, zb);
    sigId = Math.max(sigId, id + 1);
    return zb;
  }
  function quita(id) {
    const z = zs.get(id);
    if (!z) return null;
    escena.remove(z.mesh);
    z.mesh.userData.casco.material.dispose();
    zs.delete(id);
    return z;
  }
  function vacia() {
    for (const id of [...zs.keys()]) quita(id);
    for (const h of huevos) { escena.remove(h.mesh); tiraHuevo(h.mesh); }
    huevos.length = 0;
  }

  function ponHuevo(pos) {
    const mesh = friteVerde();
    mesh.position.set(pos.x, Math.max(0, pos.y), pos.z);
    mesh.rotation.y = Math.random() * 6.28;
    mesh.scale.setScalar(0.2);
    escena.add(mesh);
    huevos.push({ mesh, t: 0, fase: Math.random() * 6 });
    while (huevos.length > HUEVOS_MAX) {
      const h = huevos.shift();
      escena.remove(h.mesh); tiraHuevo(h.mesh);
    }
  }
  function cae(z, killer, cab, a, explota) {
    const pos = z.mesh.position.clone();
    if (z.sube < 1) pos.y = z.pos.y;
    ponHuevo(pos);
    cb.alCaer({ id: z.id, pos, killer, cab, a, explota, tipo: z.tipo || 'n' });
  }

  // ---------- Director ----------
  function iniciaRonda(r, n) {
    if (r === ronda) return;
    ronda = r; nJug = n;
    q = totalRonda(r, n);
    pausa = ZB.arranque; entre = 0; pedida = 0;
  }
  // Toma el último estado que publicó el director anterior.
  function adopta(zb, n) {
    nJug = n;
    if (!zb) return;
    ronda = zb.r | 0; q = Math.max(0, zb.q | 0); pausa = +zb.p || 0; entre = +zb.e || 0; pedida = 0;
    for (const z of zs.values()) {
      const max = hpRonda(Math.max(1, ronda)) * CLASE[z.tipo || 'n'].hp;
      z.max = max;
      z.hp = Math.max(1, Math.round((z.pct ?? 100) / 100 * max));
      z.pos.copy(z.mesh.position);
      if (z.sube < 1) z.pos.y = z.obj.y;
      if (z.fase === 'entra') { z.de = z.pos.clone(); z.t = 0; }
      if (z.fase === 'trepa') { z.fase = 'dentro'; z.enSuelo = false; }
      if (z.fase === 'rompe') z.t = ZB.tabla;
      z.replan = 0;
      if (z.fase === 'dentro') z.nodo = cercano(z.pos);
    }
  }

  const persigue = (jug) => jug.filter(j => j.vivo && !(inter && inter.enAislado(j.pos)));
  const activa = zona => !inter || inter.zonaActiva(zona);
  function sitioSpawn(vivos) {
    const cand = [];
    (mapa?.ventanas || []).forEach((v, i) => { if (activa(v.zona)) cand.push({ i, x: v.ox, z: v.oz, y: v.y }); });
    for (const [x, z, zona] of mapa?.brotes || []) {
      if (!activa(zona)) continue;
      if (vivos.some(j => Math.hypot(j.pos.x - x, j.pos.z - z) < 5)) continue;
      cand.push({ i: -1, x, z, y: 0 });
    }
    if (!cand.length) return null;
    // Por donde está la gente, con algo de azar.
    const d = c => Math.min(999, ...vivos.map(j => Math.hypot(j.pos.x - c.x, j.pos.z - c.z) + Math.abs(j.pos.y - c.y) * 3));
    cand.sort((a, b) => d(a) - d(b));
    return cand[Math.floor(Math.random() * Math.min(4, cand.length))];
  }

  const enLava = p => p.y < 0.3 && (mapa?.lava || []).some(([x0, x1, z0, z1]) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1);

  // ¿Se puede trepar lo que hay delante? Rayos hacia abajo un poco más allá
  // de la pared: el techo más alto entre 0.3 y 3.5 m sobre los pies, con
  // lugar para el cuerpo encima. Devuelve {y, p} (la altura y dónde pararse).
  const _ab = new THREE.Vector3(0, -1, 0), _ro = new THREE.Vector3();
  function trepable(z, dx, dz, dy) {
    let mejor = null;
    for (const a of [0.6, 0.85, 1.15]) {
      _ro.set(z.pos.x + dx * a, z.pos.y + 4, z.pos.z + dz * a);
      const d = rayoMundo(_ro, _ab, 4, colisores, true);
      const y = _ro.y - d, sobre = y - z.pos.y;
      if (sobre < 0.3 || sobre > 3.5) continue;
      // Que haya lugar arriba: nada en los 1.6 m siguientes.
      _o.set(_ro.x, y + 0.05, _ro.z);
      if (rayoMundo(_o, _v.set(0, 1, 0), 1.6, colisores, true) < 1.55) continue;
      if (!mejor || y > mejor.y) mejor = { y, p: new THREE.Vector3(_ro.x, y, _ro.z) };
    }
    // Sin nadie arriba, solo trepa lo bajo (una mesa, un auto): un muro alto
    // lo rodea por el grafo.
    if (mejor && dy < 0.5 && mejor.y - z.pos.y > 1.3) return null;
    return mejor;
  }

  const _d = new THREE.Vector3(), _m = new THREE.Vector3();
  // jug: [{uid, pos (pies), vivo}]. Devuelve los mordiscos [{uid, dmg}].
  function paso(dt, jug, n) {
    nJug = n;
    const mordidas = [];
    if (!ronda || !mapa) return mordidas;
    const vivos = persigue(jug);
    const todos = jug.filter(j => j.vivo);
    // Salen de a uno, por las ventanas o del suelo.
    if (pausa > 0) pausa -= dt;
    else if (q > 0 && zs.size < maxVivos(n, ronda)) {
      cdSpawn -= dt;
      if (cdSpawn <= 0 && todos.length) {
        cdSpawn = cadaSpawn(ronda);
        const s = sitioSpawn(vivos.length ? vivos : todos);
        if (s) {
          const tipo = tipoRonda(ronda), hp = Math.round(hpRonda(ronda) * CLASE[tipo].hp);
          if (s.i >= 0) nuevo(sigId, s.x + (Math.random() - 0.5) * 1.2, s.y + 0.02, s.z + (Math.random() - 0.5) * 1.2, hp, hp, 'fuera', s.i, tipo);
          else nuevo(sigId, s.x + (Math.random() - 0.5) * 1.5, 0, s.z + (Math.random() - 0.5) * 1.5, hp, hp, 'brote', -1, tipo);
          q--;
        }
      }
    }
    // Ronda limpia: unos segundos de respiro y se pide la siguiente.
    if (q === 0 && zs.size === 0 && pausa <= 0) {
      if (entre <= 0 && !pedida) entre = ZB.pausa;
      entre -= dt;
      if (entre <= 0 && performance.now() - pedida > 3000) { pedida = performance.now(); cb.pideRonda(ronda + 1); }
    }
    const caidos = [];
    for (const z of [...zs.values()]) {
      // La lava: prende fuego y quema un 15 % de la vida por segundo.
      if (enLava(z.pos)) z.quema = ZB.quema;
      if (z.quema > 0) {
        z.quema -= dt;
        z.hp -= z.max * 0.15 * dt;
        if (z.hp <= 0) { caidos.push(z); continue; }
      }
      // El que se quedó lejos de todos (un rincón sin salida, un mapa grande)
      // se borra y vuelve a salir por otro lado.
      if (todos.every(j => j.pos.distanceTo(z.pos) > 35)) z.lejos += dt; else z.lejos = 0;
      if (z.lejos > 20) { quita(z.id); vistos.add(z.id); q++; continue; }

      let t = null, dt2 = Infinity;
      for (const j of vivos) {
        const d = j.pos.distanceTo(z.pos);
        if (d < dt2) { dt2 = d; t = j; }
      }
      const quiero = _d.set(0, 0, 0);
      let morder = false;

      if (z.fase === 'brote') {
        z.sube = Math.min(1, z.sube + dt / ZB.sube);
        if (z.sube >= 1) { z.fase = 'dentro'; z.nodo = cercano(z.pos); }
        continue;
      }
      if (z.fase === 'fuera') {
        const v = mapa.ventanas[z.v];
        const fx = v.x + v.nx * 0.7, fz = v.z + v.nz * 0.7;
        quiero.set(fx - z.pos.x, 0, fz - z.pos.z);
        const largo = quiero.length();
        z.ry = Math.atan2(v.nx, v.nz);
        z.t += dt;
        if (largo < 0.45 || z.t > 14) {
          if (z.t > 14) z.pos.set(fx, v.y, fz);
          z.fase = inter && inter.tablas[z.v] > 0 ? 'rompe' : 'entra';
          z.t = z.fase === 'rompe' ? ZB.tabla : 0;
          z.de = z.pos.clone();
          quiero.set(0, 0, 0);
        } else quiero.divideScalar(largo).multiplyScalar(z.vel0);
      } else if (z.fase === 'rompe') {
        const v = mapa.ventanas[z.v];
        z.ry = Math.atan2(v.nx, v.nz);
        z.t -= dt;
        if (z.t <= 0) {
          z.t = ZB.tabla;
          if (inter && inter.tablas[z.v] > 0) { inter.quitaTabla(z.v); cb.rompe?.(z.pos); }
        }
        if (!inter || inter.tablas[z.v] <= 0) { z.fase = 'entra'; z.t = 0; z.de = z.pos.clone(); }
        // A través de la ventana muerden igual, si uno se arrima a repararla.
        if (t && Math.hypot(t.pos.x - z.pos.x, t.pos.z - z.pos.z) < 1.7 && Math.abs(t.pos.y - z.pos.y) < 1.3) morder = true;
      } else if (z.fase === 'entra') {
        const v = mapa.ventanas[z.v];
        // Trepa: sube al alféizar agarrado, pasa el cuerpo y se deja caer.
        z.t += dt / ZB.entra;
        const k = Math.min(1, z.t);
        const sube = Math.min(1, k / 0.45), pasa = Math.max(0, Math.min(1, (k - 0.45) / 0.3)), baja = Math.max(0, (k - 0.75) / 0.25);
        const alto = 0.9 * (1 - (1 - sube) * (1 - sube)) * (1 - baja * baja);
        const kx = 0.15 * sube + 0.85 * pasa;
        z.pos.set(z.de.x + (v.ix - z.de.x) * kx, v.y + alto, z.de.z + (v.iz - z.de.z) * kx);
        z.vel.set(0, 0, 0);
        z.ry = Math.atan2(v.nx, v.nz);
        if (k >= 1) { z.fase = 'dentro'; z.pos.y = v.y; z.nodo = cercano(z.pos); z.replan = 0; }
        z.obj.copy(z.pos);
        continue;
      } else if (z.fase === 'trepa') {
        // Trepando a una caja, un muro o un auto: sube pegado a la pared y,
        // arriba, se arrastra por encima del borde.
        z.vel.set(0, 0, 0);
        if (z.pos.y < z.cima) {
          z.pos.y = Math.min(z.cima, z.pos.y + ZB.trepa * dt);
          z.t = 0;
        } else {
          z.t += dt / 0.35;
          const k = Math.min(1, z.t);
          z.pos.set(z.de.x + (z.arriba.x - z.de.x) * k, z.cima, z.de.z + (z.arriba.z - z.de.z) * k);
          if (k >= 1) { z.fase = 'dentro'; z.enSuelo = true; z.replan = 0; z.nodo = cercano(z.pos); z.atasco = 0; }
        }
        z.obj.copy(z.pos);
        continue;
      } else if (t) {
        // Dentro: persigue derecho si lo ve, si no va por el grafo.
        const dy = t.pos.y - z.pos.y;
        z.replan -= dt;
        if (z.replan <= 0) {
          z.replan = 0.3 + Math.random() * 0.1;
          // Si está arriba de algo y cerca, va derecho y trepa: buscarlo por
          // el grafo lo dejaba dando vueltas abajo con los demás amontonados.
          const h0 = Math.hypot(t.pos.x - z.pos.x, t.pos.z - z.pos.z);
          z.ve = (Math.abs(dy) < 1 && ve(z.pos, t.pos)) || (dy > 0.5 && h0 < 6 && ve(_m.set(z.pos.x, t.pos.y, z.pos.z), t.pos, [1]));
          z.meta = -1;
          if (!z.ve && N) {
            const meta = metaDe(t);
            if (meta >= 0 && nodos[meta].distanceTo(z.pos) < 0.8) z.ve = true;
            else if (meta >= 0 && z.nodo >= 0 && Dist[z.nodo * N + meta] === Infinity && cercano(z.pos) === z.nodo) z.ve = true;
            else if (meta >= 0) z.meta = eligeNodo(z, meta);
          }
        }
        if (z.meta >= 0 && nodos[z.meta].distanceTo(z.pos) < 0.8) { z.nodo = z.meta; z.replan = 0; }
        const meta = !z.ve && z.meta >= 0 ? nodos[z.meta] : t.pos;
        quiero.set(meta.x - z.pos.x, 0, meta.z - z.pos.z);
        const largo = quiero.length();
        if (largo > 0.01) quiero.divideScalar(largo);
        const h = Math.hypot(t.pos.x - z.pos.x, t.pos.z - z.pos.z);
        z.ry = z.ve ? Math.atan2(-(t.pos.x - z.pos.x), -(t.pos.z - z.pos.z)) : Math.atan2(-quiero.x, -quiero.z);
        const cerca = h < ZB.alcance && Math.abs(dy) < 1.3;
        if (cerca) z.ry = Math.atan2(-(t.pos.x - z.pos.x), -(t.pos.z - z.pos.z));
        if (h < 0.85 && Math.abs(dy) < 1.3) quiero.set(0, 0, 0);
        // Se trabó contra algo: trepa si se puede, si no se corre de lado.
        if (z.desvio > 0) {
          z.desvio -= dt;
          const c = Math.cos(1.3 * z.lado), s = Math.sin(1.3 * z.lado);
          quiero.set(quiero.x * c - quiero.z * s, 0, quiero.x * s + quiero.z * c);
        }
        quiero.multiplyScalar(z.vel0);
        if (!cerca && Math.hypot(z.vel.x, z.vel.z) < z.vel0 * 0.3) z.atasco += dt; else z.atasco = Math.max(0, z.atasco - dt);
        // Trabado: si lo que tiene delante se puede trepar (y el que persigue
        // está arriba, o el camino sigue por encima), trepa. Si no, se corre de
        // lado. Antes saltaba, y subirse a un muro bastaba para que se
        // amontonaran todos abajo sin tocarte nunca.
        if (z.atasco > 0.5 && z.enSuelo) {
          z.atasco = 0; z.replan = 0;
          const c = largo > 0.01 ? trepable(z, quiero.x / z.vel0, quiero.z / z.vel0, dy) : null;
          if (c) {
            z.fase = 'trepa'; z.cima = c.y; z.de = z.pos.clone(); z.arriba = c.p; z.t = 0;
            z.ry = Math.atan2(-quiero.x, -quiero.z);
            z.vel.set(0, 0, 0); z.obj.copy(z.pos);
            continue;
          }
          z.lado = Math.random() < 0.5 ? -1 : 1;
          z.desvio = 1.1;
        }
        morder = cerca;
      }
      // El mordisco: un amago corto y, si sigue cerca, muerde.
      if (t) {
        z.cd -= dt;
        if (z.prep >= 0) {
          z.prep -= dt;
          if (z.prep < 0) {
            z.cd = ZB.cadencia;
            if (morder) {
              const ojo = _m.copy(z.pos).setY(z.pos.y + 1.2), q2 = t.pos.clone().setY(t.pos.y + 1);
              const dir = q2.sub(ojo), dd = dir.length();
              // Nunca de un mordisco con la vida llena: se alcanza a reaccionar.
              const dmg = Math.min(95, Math.round(mordidaRonda(ronda) * CLASE[z.tipo || 'n'].mordida));
              if (rayoMundo(ojo, dir.normalize(), dd, colisores) >= dd - 0.2) mordidas.push({ uid: t.uid, dmg });
            }
          }
        } else if (morder && z.cd <= 0) z.prep = ZB.preparar;
      }
      // Que no se amontonen todos en el mismo punto.
      for (const o of zs.values()) {
        if (o === z || o.fase === 'entra' || o.fase === 'trepa') continue;
        const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 0.9 && Math.abs(z.pos.y - o.pos.y) < 1.5) { quiero.x += dx / d * 2.5; quiero.z += dz / d * 2.5; }
      }
      if (z.fase === 'rompe') quiero.multiplyScalar(0.3);
      const k = 1 - Math.exp(-(z.enSuelo ? 8 : 2) * dt);
      z.vel.x += (quiero.x - z.vel.x) * k;
      z.vel.z += (quiero.z - z.vel.z) * k;
      moverCuerpo(z, dt, colisores);
      z.obj.copy(z.pos);
    }
    for (const z of caidos) if (zs.has(z.id)) muere(z, '', false, 0);
    return mordidas;
  }

  // Muere en el director: se anuncia, deja su huevo y, si venía ardiendo,
  // revienta y se lleva a los que tenga al lado.
  function muere(z, killer, cab, a) {
    const explota = z.quema > 0 ? 1 : 0;
    muertes = [...muertes, [z.id, killer || '', cab ? 1 : 0, a | 0, explota, TIPOS.indexOf(z.tipo || 'n')]].slice(-20);
    vistos.add(z.id);
    quita(z.id);
    cae(z, killer || '', !!cab, a | 0, !!explota);
    if (!explota) return;
    const cerca = [...zs.values()].filter(o => o.pos.distanceTo(z.pos) < ZB.explota);
    for (const o of cerca) golpe(o.id, o.max * 0.6, killer, false, a);
  }
  // Daño a un zombi (solo en el director). Devuelve true si lo mató.
  function golpe(id, dmg, killer, cab, a) {
    const z = zs.get(id);
    if (!z) return false;
    z.hp -= dmg;
    z.golpeT = 0.12;
    if (z.hp > 0) return false;
    muere(z, killer, cab, a);
    return true;
  }

  // Kaboom: revientan todos los que están en pie (solo en el director). Sin
  // asesino, así que no dan puntos por cabeza ni sueltan bonificaciones.
  function kaboom() {
    for (const z of [...zs.values()]) if (z.fase !== 'brote' || z.sube > 0.3) muere(z, '', false, 0);
  }

  // Lo que el director publica.
  function estado() {
    return {
      r: ronda, q, p: r1(Math.max(0, pausa)), e: r1(Math.max(0, entre)),
      z: [...zs.values()].map(z => [z.id, r1(z.pos.x), r1(z.pos.y), r1(z.pos.z), r1(z.ry),
        Math.max(1, Math.round(z.hp / z.max * 100)), z.sube < 1 ? 1 : 0, z.quema > 0 ? 1 : 0,
        FASES.indexOf(z.fase), z.v, TIPOS.indexOf(z.tipo || 'n')]),
      m: muertes,
    };
  }

  // Lo que dibuja quien no dirige, desde el `zb` del director.
  function desdeRed(zb) {
    if (!zb || typeof zb !== 'object') return;
    ronda = zb.r | 0; q = zb.q | 0; pausa = +zb.p || 0; entre = +zb.e || 0;
    for (const m of lista(zb.m)) {
      if (!Array.isArray(m) || vistos.has(+m[0])) continue;
      const id = +m[0];
      vistos.add(id);
      sigId = Math.max(sigId, id + 1);
      const z = quita(id);
      if (z) { z.tipo = TIPOS[m[5] | 0] || z.tipo; cae(z, String(m[1] || ''), !!m[2], m[3] | 0, !!m[4]); }
    }
    const ahora = new Set();
    for (const e of lista(zb.z)) {
      if (!Array.isArray(e)) continue;
      const [id, x, y, zz, ry, pct, sube, quema, fase, v, ti] = e.map(Number);
      const tipo = TIPOS[ti | 0] || 'n';
      if (vistos.has(id)) continue;
      ahora.add(id);
      let z = zs.get(id);
      const f = FASES[fase | 0] || 'dentro';
      if (!z) z = nuevo(id, x, y, zz, 1, 1, sube ? 'brote' : f, Number.isFinite(v) ? v : -1, tipo);
      z.obj.set(x, y, zz);
      z.pos.set(x, y, zz);
      z.ry = ry;
      if (z.pct !== undefined && pct < z.pct) z.golpeT = 0.12;
      z.pct = pct;
      z.remotoSube = !!sube;
      z.quema = quema ? 1 : 0;
      if (!sube) z.fase = f;
      z.v = Number.isFinite(v) ? v : -1;
    }
    for (const id of [...zs.keys()]) if (!ahora.has(id)) quita(id);
  }

  function llamas(z, si) {
    let f = z.mesh.userData.llamas;
    if (!f && !si) return;
    if (!f) {
      f = new THREE.Group();
      for (const [x, y, zz, s, m] of [[0, 1.75, 0, 1.2, matLlama], [0.25, 1.2, 0.1, 0.9, matLlama], [-0.25, 0.9, -0.1, 0.9, matLlama], [0, 1.55, 0.05, 0.7, matLlama2]]) {
        const c = new THREE.Mesh(geoLlama, m);
        c.position.set(x, y, zz);
        c.scale.setScalar(s);
        f.add(c);
      }
      z.mesh.userData.llamas = f;
      z.mesh.add(f);
    }
    f.visible = si;
    if (si) {
      const t = performance.now() / 90 + z.id;
      f.children.forEach((c, i) => { c.scale.y = (i === 3 ? 0.7 : 1) * (1 + 0.35 * Math.sin(t + i * 1.7)); c.rotation.y = t * 0.3 + i; });
    }
  }

  // Animación de todos (director o no): subir del piso, bambolearse, el amago
  // del mordisco, arrancar tablas, el fuego y el destello rojo de un balazo.
  function animar(dt, director, ojo) {
    const t = performance.now() / 1000, kp = 1 - Math.exp(-12 * dt);
    for (const z of zs.values()) {
      if (!director && z.sube < 1) z.sube = Math.min(z.remotoSube ? 0.95 : 1, z.sube + dt / (z.remotoSube ? ZB.sube : 0.2));
      const baja = z.sube < 1 ? ALTO * (1 - z.sube) : 0;
      if (director) z.mesh.position.set(z.pos.x, z.pos.y - baja, z.pos.z);
      else {
        const k = z.fase === 'entra' || z.fase === 'trepa' ? 1 - Math.exp(-20 * dt) : kp;
        z.mesh.position.x += (z.obj.x - z.mesh.position.x) * k;
        z.mesh.position.z += (z.obj.z - z.mesh.position.z) * k;
        z.mesh.position.y += (z.obj.y - baja - z.mesh.position.y) * k;
      }
      let dr = z.ry - z.mesh.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      z.mesh.rotation.y += dr * kp;
      const c = z.mesh.userData.cuerpo;
      const fase = t * 9 + z.id;
      c.rotation.z = Math.sin(fase) * 0.16;
      // Arrancando tablas: tirones hacia adelante.
      // Trepando: pegado a la pared, los brazos arriba tirando de a uno.
      const trepa = z.fase === 'trepa' || z.fase === 'entra';
      c.rotation.x = z.fase === 'rompe' ? 0.3 + Math.max(0, Math.sin(t * 7 + z.id)) * 0.5
        : trepa ? 0.5 + Math.sin(t * 10 + z.id) * 0.12 : 0.18 + (z.prep >= 0 ? 0.45 : 0);
      if (trepa) c.rotation.z = Math.sin(t * 10 + z.id) * 0.1;
      const brazos = z.mesh.userData.brazos || [];
      brazos.forEach((b, i) => {
        const obj = trepa ? Math.PI / 2 + 0.9 + Math.sin(t * 10 + z.id + i * Math.PI) * 0.35 : Math.PI / 2;
        b.rotation.x += (obj - b.rotation.x) * kp;
      });
      z.golpeT = Math.max(0, z.golpeT - dt);
      const e = z.mesh.userData.casco.material.emissive;
      if (z.golpeT > 0) e.setRGB(0.7, 0, 0);
      else if (z.quema > 0) { const p = 0.5 + 0.3 * Math.sin(t * 25 + z.id); e.setRGB(p, p * 0.35, 0); }
      else e.setRGB(0, 0, 0);
      llamas(z, z.quema > 0);
      z.grunido -= dt;
      if (z.grunido <= 0) {
        z.grunido = 4 + Math.random() * 7;
        if (ojo && z.mesh.position.distanceTo(ojo) < 30) cb.grunido(z.mesh.position);
      }
    }
    // Los huevos fritos verdes: se extienden al caer, la yema late y se
    // desvanecen a los 20 s.
    for (let i = huevos.length - 1; i >= 0; i--) {
      const h = huevos[i];
      h.t += dt;
      const c = Math.min(1, h.t * 3);
      h.mesh.scale.setScalar(0.2 + 0.8 * (1 - Math.pow(1 - c, 3)));
      h.mesh.userData.yema.material.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 4 + h.fase);
      const queda = HUEVO_VIDA - h.t;
      const op = Math.max(0, Math.min(1, queda / 3));
      h.mesh.traverse(o => { if (o.isMesh) o.material.opacity = op; });
      if (queda <= 0) { escena.remove(h.mesh); tiraHuevo(h.mesh); huevos.splice(i, 1); }
    }
  }

  return {
    lista: zs, iniciaRonda, adopta, paso, golpe, kaboom, estado, desdeRed, animar, ponMapa, recalcula, vacia,
    get ronda() { return ronda; },
    get quedan() { return zs.size + q; },
    get respiro() { return q === 0 && zs.size === 0 ? Math.max(0, entre) : 0; },
  };
}
