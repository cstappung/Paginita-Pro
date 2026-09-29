// Dos redes con la misma interfaz:
//   - el marco: la sala de Juegos (colabtex/src/juegos/yemas.js) nos pasa a
//     los demás y publica lo nuestro en Firebase
//   - local con bots, para practicar sin sala
//
// red:  yo, mirando, meta, jugadores (Map uid → {nombre, color}),
//       publicar(estado), golpear(uid, golpe), morir(ev), tick(dt)
// h:    alConfig(red), alJugador(uid, estado|null), alGolpe(g), alBaja(nombre),
//       alFeed(item), alMarcador({bajas, muertes}), alFin({ganador, motivo})
import * as THREE from 'three';
import { moverCuerpo, rayoMundo, SPAWNS, OJOS } from 'yemas/mundo';

export const PALETA = ['#fff4e0', '#ffd54a', '#8fd3ff', '#ff9ec7', '#9be28f', '#c98b55', '#b99bff', '#ff8a4a'];
const HIJO = 'yemas-hijo', PADRE = 'yemas-padre';
const lista = x => Array.isArray(x) ? x : Object.values(x || {});

// ---------- El marco ----------
// Los golpes no tienen canal propio: cada huevo publica en su estado los
// últimos ocho que dio (`g`, con un id que sólo crece) y cada uno aplica los
// que lo nombran y todavía no había visto. Así no hace falta ninguna regla
// nueva en la base, y un estado que se pierde no se lleva el golpe: el
// siguiente lo vuelve a traer.
export function conectarMarco(h) {
  const post = (tipo, d = {}) => { try { parent.postMessage({ canal: HIJO, tipo, ...d }, location.origin); } catch {} };
  let red = null, golpes = [], ultimoId = 0;
  const vistoG = {}, fuera = new Set(), presentes = new Set();

  function recibeVivo(v) {
    const ahora = new Set();
    for (const [uid, e] of Object.entries(v || {})) {
      if (uid === red.yo || fuera.has(uid) || !red.jugadores.has(uid) || !e) continue;
      ahora.add(uid);
      const g = lista(e.g).filter(Array.isArray);
      if (vistoG[uid] === undefined) vistoG[uid] = Math.max(0, ...g.map(x => +x[0] || 0));
      else {
        for (const [id, dest, dmg, cab, a] of g) {
          if (!(id > vistoG[uid])) continue;
          vistoG[uid] = id;
          if (dest === red.yo) h.alGolpe({ de: uid, n: red.jugadores.get(uid).nombre, dmg: +dmg || 0, cab: !!cab, a: a | 0 });
        }
      }
      h.alJugador(uid, e);
    }
    for (const uid of presentes) if (!ahora.has(uid)) h.alJugador(uid, null);
    presentes.clear();
    for (const uid of ahora) presentes.add(uid);
  }

  addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const m = e.data;
    if (!m || m.canal !== PADRE) return;
    if (m.tipo === 'config') {
      if (red) return;
      const js = lista(m.jugadores).sort((a, b) => a.orden - b.orden);
      red = {
        yo: m.yo, online: true, mirando: !!m.mirando, meta: m.meta | 0,
        jugadores: new Map(js.map((j, i) => [j.uid, { nombre: String(j.nombre || 'Huevo').slice(0, 20), color: PALETA[i % PALETA.length] }])),
        publicar(est) {
          if (red.mirando) return;
          if (golpes.length) est.g = golpes;
          post('estado', { e: est });
        },
        golpear(dest, g) {
          ultimoId = Math.max(ultimoId + 1, Date.now());
          golpes = [...golpes, [ultimoId, dest, Math.round(g.dmg), g.cab ? 1 : 0, g.a | 0]].slice(-8);
        },
        morir(ev) { post('muere', { por: ev.de || '', a: ev.a | 0, cab: !!ev.cab }); },
        tick() {},
      };
      h.alConfig(red);
      return;
    }
    if (!red) return;
    if (m.tipo === 'vivo') recibeVivo(m.v);
    else if (m.tipo === 'marcador') {
      for (const u of lista(m.fuera)) if (!fuera.has(u)) { fuera.add(u); presentes.delete(u); h.alJugador(u, null); }
      h.alMarcador({ bajas: m.bajas || {}, muertes: m.muertes || {} });
      if (m.fin) h.alFin(m.fin);
    } else if (m.tipo === 'bajas') {
      for (const b of lista(m.lista)) {
        const k = red.jugadores.get(b.por), v = red.jugadores.get(b.v);
        if (m.viejas || !v) continue;
        h.alFeed({ k: k ? k.nombre : '', v: v.nombre, a: b.a | 0, cab: !!b.cab });
        if (b.por === red.yo && b.v !== red.yo) h.alBaja(v.nombre);
      }
    }
  });
  post('listo');
}

// ---------- Local con bots ----------
const BOTS = ['Huevo Duro', 'Tortilla', 'Yemita', 'Clarita'];

export function conectarLocal({ nombre, color, colisores }, h) {
  const r = new RedLocal(nombre, color, colisores, h);
  h.alConfig(r);
  r.tick(0);
  return r;
}

class RedLocal {
  constructor(nombre, color, cols, h) {
    this.yo = 'yo';
    this.online = false;
    this.mirando = false;
    this.meta = 0;
    this.cols = cols;
    this.h = h;
    this.estadoYo = null;
    this.jugadores = new Map([['yo', { nombre, color }]]);
    const libres = PALETA.filter(c => c !== color);
    this.bots = BOTS.map((n, i) => {
      this.jugadores.set('bot' + i, { nombre: n, color: libres[i] });
      return {
        id: 'bot' + i, hp: 100, vivo: true, muerte: 0,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), enSuelo: false,
        yaw: 0, meta: null, atasco: 0, cd: 1, visto: 0, lado: 1, cambioLado: 0,
        disparo: 0, finales: null,
      };
    });
    this.bajas = {}; this.muertes = {};
    for (const u of this.jugadores.keys()) { this.bajas[u] = 0; this.muertes[u] = 0; }
    for (const b of this.bots) this.aparecer(b);
  }

  nombre(u) { return this.jugadores.get(u)?.nombre || ''; }
  avisaMarcador() { this.h.alMarcador({ bajas: { ...this.bajas }, muertes: { ...this.muertes } }); }

  // El spawn más lejos de todos, con algo de azar
  aparecer(b) {
    const ocupados = this.bots.filter(o => o !== b && o.vivo).map(o => o.pos);
    const e = this.estadoYo;
    if (e && e.v) ocupados.push(new THREE.Vector3(e.x, e.y, e.z));
    let s = SPAWNS[0], mejor = -1;
    for (const p of SPAWNS) {
      const d = Math.min(60, ...ocupados.map(o => o.distanceTo(p))) + Math.random() * 10;
      if (d > mejor) { mejor = d; s = p; }
    }
    b.pos.copy(s); b.vel.set(0, 0, 0);
    b.hp = 100; b.vivo = true; b.meta = null; b.visto = 0;
  }

  estado(b) {
    const e = { x: b.pos.x, y: b.pos.y, z: b.pos.z, ry: b.yaw, v: b.vivo ? 1 : 0, a: 0 };
    if (b.disparo) e.s = { i: b.disparo, e: b.finales };
    return e;
  }

  publicar(e) { this.estadoYo = e; }

  golpear(dest, g) {
    const b = this.bots.find(x => x.id === dest);
    if (!b || !b.vivo) return;
    b.hp -= g.dmg;
    b.visto = Math.max(b.visto, 0.3);   // se da vuelta a mirarte
    if (b.hp > 0) return;
    b.vivo = false; b.muerte = 3;
    this.muertes[b.id]++; this.bajas.yo++;
    this.h.alBaja(this.nombre(b.id));
    this.h.alFeed({ k: this.nombre('yo'), v: this.nombre(b.id), a: g.a | 0, cab: !!g.cab });
    this.avisaMarcador();
  }

  morir(ev) {
    this.muertes.yo++;
    if (this.bajas[ev.de] !== undefined) this.bajas[ev.de]++;
    this.h.alFeed({ k: this.nombre(ev.de), v: this.nombre('yo'), a: ev.a | 0, cab: !!ev.cab });
    this.avisaMarcador();
  }

  tick(dt) {
    for (const b of this.bots) {
      if (!b.vivo) {
        b.muerte -= dt;
        if (b.muerte <= 0) this.aparecer(b);
      } else if (dt > 0) {
        this.pensar(b, dt);
      }
      this.h.alJugador(b.id, this.estado(b));
    }
  }

  pensar(b, dt) {
    const yo = this.estadoYo;
    const ojo = new THREE.Vector3(b.pos.x, b.pos.y + OJOS, b.pos.z);
    let veo = false, dist = Infinity, dir = null;
    if (yo && yo.v) {
      dir = new THREE.Vector3(yo.x, yo.y + 1.0, yo.z).sub(ojo);
      dist = dir.length();
      dir.normalize();
      veo = dist > 0.8 && dist < 45 && rayoMundo(ojo, dir, dist, this.cols) >= dist - 0.2;
    }

    const quiero = new THREE.Vector3();
    if (veo) {
      b.visto += dt;
      b.yaw = Math.atan2(-dir.x, -dir.z);
      b.cambioLado -= dt;
      if (b.cambioLado <= 0) { b.lado = Math.random() < 0.5 ? -1 : 1; b.cambioLado = 0.8 + Math.random() * 1.5; }
      quiero.set(-dir.z * b.lado, 0, dir.x * b.lado).multiplyScalar(3.5);
      if (dist > 18) quiero.addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 4);

      b.cd -= dt;
      if (b.visto > 0.6 && b.cd <= 0) {
        b.cd = 0.3 + Math.random() * 0.5;
        const moviendo = Math.hypot(yo.vx || 0, yo.vz || 0) > 2;
        const p = Math.min(0.55, Math.max(0.1, 0.6 - dist / 55)) * (moviendo ? 0.75 : 1);
        const acierto = Math.random() < p;
        const fin = new THREE.Vector3(yo.x, yo.y + 1.0, yo.z);
        if (!acierto) fin.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(3));
        b.disparo++;
        b.finales = [[+fin.x.toFixed(2), +fin.y.toFixed(2), +fin.z.toFixed(2)]];
        if (acierto) this.h.alGolpe({ de: b.id, n: this.nombre(b.id), dmg: 9, cab: false, a: 0 });
      }
    } else {
      b.visto = Math.max(0, b.visto - dt);
      if (!b.meta || b.pos.distanceTo(b.meta) < 1.5 || b.atasco > 4) {
        b.meta = new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
        b.atasco = 0;
      }
      const d = b.meta.clone().sub(b.pos); d.y = 0; d.normalize();
      quiero.copy(d).multiplyScalar(4.5);
      b.yaw = Math.atan2(-d.x, -d.z);
      b.atasco += dt;
      if (b.enSuelo && Math.hypot(b.vel.x, b.vel.z) < 0.5 && Math.random() < dt * 2) b.vel.y = 8;
    }

    const k = 1 - Math.exp(-(b.enSuelo ? 10 : 2) * dt);
    b.vel.x += (quiero.x - b.vel.x) * k;
    b.vel.z += (quiero.z - b.vel.z) * k;
    moverCuerpo(b, dt, this.cols);
  }
}
