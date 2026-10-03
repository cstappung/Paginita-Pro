// Las bonificaciones que sueltan los zombis al morir, como en Black Ops:
// Insta-Kill, Carpintero, Kaboom, Munición máxima y la Máquina de muerte.
//
// Son de la sala, así que las lleva el director en su `zb`, con dos claves
// que no chocan con las de zombis.js ni interactivo.js: `b` lo que está en el
// suelo ([id, tipo, x, y, z]) y `x` los últimos tomados ([id, tipo, uid]).
// Quien no dirige y pisa una la pide con un golpe de daño cero a `p:bono:<id>`
// y la esconde en el acto; el director la da por tomada y la publica en `x`,
// y cada marco aplica una sola vez lo que ve en `x` (el efecto es para todos,
// salvo la Máquina de muerte, que es de quien la tomó).
import * as THREE from 'three';
import { BONOS, TIPOS_BONO } from 'yemas/armas';

export const BONO = { prob: 0.045, max: 3, vida: 25, toma: 1.3, parpadeo: 5 };

const r1 = v => Math.round(v * 10) / 10;
const lista = v => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [];

function textura(ti) {
  const b = BONOS[ti];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  rad.addColorStop(0, b.color);
  rad.addColorStop(0.55, b.color + 'aa');
  rad.addColorStop(1, b.color + '00');
  g.fillStyle = rad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(10,10,14,.75)';
  g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.fill();
  g.font = '44px system-ui, "Segoe UI Emoji", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(b.icono, 64, 67);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// cb: { director(), yo(), pos(), puedo(), envia(q), efecto(ti, uid) }
export function crearBonos(escena, cb) {
  const texturas = {};
  const suelos = new Map();   // id → { id, ti, pos, t, mesh }
  const tomados = new Set();  // los que pedí y escondí, hasta que el director lo confirme
  let eventos = [];           // [id, ti, uid], los últimos ocho
  const vistos = new Set();
  let primero = true, ultimoId = 0, instaT = 0, reloj = 0;

  const nuevoId = () => (ultimoId = Math.max(Date.now(), ultimoId + 1));

  function pon(id, ti, x, y, z, t = BONO.vida) {
    if (!BONOS[ti] || suelos.has(id)) return;
    const mat = new THREE.SpriteMaterial({ map: texturas[ti] ||= textura(ti), transparent: true, depthWrite: false });
    const mesh = new THREE.Sprite(mat);
    mesh.scale.set(1.1, 1.1, 1);
    mesh.position.set(x, y + 0.9, z);
    escena.add(mesh);
    suelos.set(id, { id, ti, pos: new THREE.Vector3(x, y, z), t, mesh });
  }
  function quita(id) {
    const s = suelos.get(id);
    if (!s) return;
    escena.remove(s.mesh);
    s.mesh.material.dispose();
    suelos.delete(id);
  }

  // Un zombi muerto puede soltar una (solo el director lo decide).
  // `forzado`: el tipo que tiene que salir (la munición del último perro), o
  // true para uno cualquiera sin tirar la suerte (el Mutante).
  function suelta(pos, forzado) {
    if (!cb.director()) return;
    if (!forzado && (suelos.size >= BONO.max || Math.random() >= BONO.prob)) return;
    const ti = typeof forzado === 'string' && TIPOS_BONO.includes(forzado) ? forzado : TIPOS_BONO[Math.floor(Math.random() * TIPOS_BONO.length)];
    pon(nuevoId(), ti, pos.x, pos.y, pos.z);
  }

  function registra(id, ti, uid) {
    if (vistos.has(id)) return;
    vistos.add(id);
    eventos.push([id, ti, uid]);
    if (eventos.length > 8) eventos = eventos.slice(-8);
    if (ti === 'insta') instaT = BONOS.insta.dura;
    cb.efecto(ti, uid);
  }

  // El director da una por tomada (por él o por quien la pidió).
  function toma(id, uid) {
    const s = suelos.get(+id);
    if (!s) return;
    quita(s.id);
    registra(s.id, s.ti, uid);
  }
  const peticion = (id, de) => { if (cb.director()) toma(+id, de); };

  function actualizar(dt) {
    reloj += dt;
    instaT = Math.max(0, instaT - dt);
    const p = cb.pos(), puedo = cb.puedo();
    for (const s of [...suelos.values()]) {
      s.t -= dt;
      if (cb.director() && s.t <= 0) { quita(s.id); continue; }
      s.mesh.position.y = s.pos.y + 0.9 + Math.sin(reloj * 3 + s.id % 7) * 0.12;
      s.mesh.visible = !tomados.has(s.id) && (s.t > BONO.parpadeo || Math.floor(reloj * 6) % 2 === 0);
      if (!puedo || tomados.has(s.id)) continue;
      if (Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < BONO.toma && Math.abs(s.pos.y - p.y) < 1.8) {
        if (cb.director()) toma(s.id, cb.yo());
        else { tomados.add(s.id); s.mesh.visible = false; cb.envia('bono:' + s.id); }
      }
    }
  }

  function estado() {
    return {
      b: [...suelos.values()].map(s => [s.id, s.ti, r1(s.pos.x), r1(s.pos.y), r1(s.pos.z), Math.max(0, Math.round(s.t))]),
      x: eventos,
    };
  }

  function desdeRed(zb) {
    if (!zb || typeof zb !== 'object') return;
    const enSuelo = new Set();
    for (const b of lista(zb.b)) {
      if (!Array.isArray(b)) continue;
      const [id, ti, x, y, z, t] = b;
      enSuelo.add(+id);
      if (!suelos.has(+id)) pon(+id, ti, +x || 0, +y || 0, +z || 0, +t || BONO.vida);
      else suelos.get(+id).t = +t || 0;
    }
    for (const id of [...suelos.keys()]) if (!enSuelo.has(id)) { quita(id); tomados.delete(id); }
    const xs = lista(zb.x).filter(Array.isArray);
    if (primero) { primero = false; for (const [id] of xs) vistos.add(+id); return; }
    for (const [id, ti, uid] of xs) registra(+id, ti, uid);
    eventos = xs.map(e => [+e[0], e[1], e[2]]);
  }

  function desmonta() {
    for (const id of [...suelos.keys()]) quita(id);
    for (const t of Object.values(texturas)) t.dispose();
  }

  return {
    suelta, peticion, actualizar, estado, desdeRed, desmonta,
    get insta() { return instaT > 0; },
    get instaT() { return instaT; },
  };
}
