// Dos redes con la misma interfaz:
//   - el marco: la sala de Juegos (colabtex/src/juegos/yemas.js) nos pasa a
//     los demás y publica lo nuestro en Firebase
//   - local con bots, para practicar sin sala
//
// red:  yo, mirando, meta, variante, equipos (uid → 'rojo'|'azul', o null),
//       jugadores (Map uid → {nombre, color}, en orden de asiento), fuera (Set),
//       publicar(estado), golpear(uid | 'z:<id>', golpe), morir(ev),
//       accion(tipo, datos), hablar(on), tick(dt)
// h:    alConfig(red), alJugador(uid, estado|null), alGolpe(g), alGolpeZombi(g),
//       alBaja(nombre), alFeed(item), alSuceso(item), alMarcador(m), alFin(f), alVoces(v)
import * as THREE from 'three';
import { moverCuerpo, rayoMundo, SPAWNS, OJOS } from 'yemas/mundo';
import { MAPAS } from 'yemas/mapas';

export const PALETA = ['#fff4e0', '#ffd54a', '#8fd3ff', '#ff9ec7', '#9be28f', '#c98b55', '#b99bff', '#ff8a4a'];
// En las variantes por equipo el color es del equipo, no del asiento.
export const COLOR_EQUIPO = { rojo: '#ff8f7f', azul: '#7fb6ff' };
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
          // Un balazo a un zombi: lo aplica el director (main.js mira si es uno).
          else if (typeof dest === 'string' && dest.startsWith('z:')) h.alGolpeZombi({ de: uid, id: +dest.slice(2), dmg: +dmg || 0, cab: !!cab, a: a | 0 });
          // Una petición al director (abrir una puerta, la caja, una bebida…):
          // viaja por el mismo canal que los golpes, sin regla nueva.
          else if (typeof dest === 'string' && dest.startsWith('p:')) h.alPeticion?.({ de: uid, que: dest.slice(2) });
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
      const equipos = m.equipos && typeof m.equipos === 'object' ? m.equipos : null;
      red = {
        yo: m.yo, online: true, mirando: !!m.mirando, meta: m.meta | 0, semilla: (m.semilla >>> 0) || 1,
        variante: ['todos', 'equipos', 'bandera', 'zombis'].includes(m.variante) ? m.variante : 'todos', equipos, fuera,
        mapa: MAPAS[m.mapa] ? m.mapa : 'nacht',
        jugadores: new Map(js.map((j, i) => [j.uid, {
          nombre: String(j.nombre || 'Huevo').slice(0, 20),
          color: equipos ? COLOR_EQUIPO[equipos[j.uid]] || PALETA[0] : PALETA[i % PALETA.length],
        }])),
        publicar(est) {
          if (red.mirando) return;
          if (golpes.length) est.g = golpes;
          post('estado', { e: est });
        },
        golpear(dest, g) {
          ultimoId = Math.max(ultimoId + 1, Date.now());
          golpes = [...golpes, [ultimoId, dest, Math.round(g.dmg), g.cab ? 1 : 0, g.a | 0]].slice(-8);
        },
        morir(ev) {
          const d = { por: ev.de || '', a: ev.a | 0, cab: !!ev.cab };
          if (ev.x !== undefined) { d.x = ev.x; d.z = ev.z; }
          // En zombis cada muerte lleva los puntos, los zombis y la ronda.
          if (ev.pts !== undefined) { d.pts = ev.pts | 0; d.zk = ev.zk | 0; d.r = ev.r | 0; }
          post('muere', d);
        },
        accion(tipo, datos) { if (!red.mirando) post(tipo, datos); },
        hablar(on) { post('hablar', { on: !!on }); },
        entrarVoz() { post('voz'); },
        tick() {},
      };
      h.alConfig(red);
      return;
    }
    if (!red) return;
    if (m.tipo === 'vivo') recibeVivo(m.v);
    else if (m.tipo === 'marcador') {
      for (const u of lista(m.fuera)) if (!fuera.has(u)) { fuera.add(u); presentes.delete(u); h.alJugador(u, null); }
      // Los equipos pueden cambiar hasta que empieza de verdad (cada uno elige
      // el suyo): el marcador trae los vigentes y el color sigue al equipo.
      if (m.equipos && JSON.stringify(m.equipos) !== JSON.stringify(red.equipos)) {
        red.equipos = m.equipos;
        for (const [u, f] of red.jugadores) f.color = COLOR_EQUIPO[m.equipos[u]] || f.color;
      }
      h.alMarcador({
        bajas: m.bajas || {}, muertes: m.muertes || {}, puntosEq: m.puntosEq || null, banderas: m.banderas || null, armas: m.armas || {},
        ronda: m.ronda | 0, caidos: lista(m.caidos), puntos: m.puntos || {},
      });
      if (m.fin) h.alFin(m.fin);
    } else if (m.tipo === 'bajas') {
      if (m.viejas) return;
      for (const b of lista(m.lista)) {
        const quien = red.jugadores.get(b.uid);
        if (!quien) continue;
        if (b.t && b.t !== 'muere') { h.alSuceso({ t: b.t, uid: b.uid, nombre: quien.nombre, b: b.b, auto: !!b.auto }); continue; }
        const k = red.jugadores.get(b.por);
        h.alFeed({ k: k ? k.nombre : '', v: quien.nombre, a: b.a | 0, cab: !!b.cab });
        if (b.por === red.yo && b.uid !== red.yo) h.alBaja(quien.nombre);
      }
    } else if (m.tipo === 'voces') h.alVoces({ en: lista(m.en), hablan: lista(m.hablan) });
  });
  post('listo');
}

// ---------- Local con bots ----------
const BOTS = ['Huevo Duro', 'Tortilla', 'Yemita', 'Clarita'];
const SKINS_BOTS = ['chef', 'vaquero', 'pirata', 'lana'];

export function conectarLocal({ nombre, color, colisores, variante, mapa }, h) {
  const r = new RedLocal(nombre, color, colisores, h, variante === 'zombis' ? 'zombis' : 'todos');
  r.mapa = MAPAS[mapa] ? mapa : 'nacht';
  h.alConfig(r);
  r.avisaMarcador();   // la ronda 1 de zombis arranca con el primer marcador
  r.tick(0);
  return r;
}

class RedLocal {
  constructor(nombre, color, cols, h, variante) {
    this.yo = 'yo';
    this.online = false;
    this.mirando = false;
    this.meta = 0;
    this.semilla = (Math.random() * 4294967295) >>> 0;
    this.armas = {};
    // En zombis se practica solo: sin bots, contra las oleadas.
    this.variante = variante;
    this.equipos = null;
    this.fuera = new Set();
    this.ronda = 1;
    this.caidos = new Set();
    this.cols = cols;
    this.h = h;
    this.estadoYo = null;
    this.jugadores = new Map([['yo', { nombre, color }]]);
    const libres = PALETA.filter(c => c !== color);
    this.bots = (variante === 'zombis' ? [] : BOTS).map((n, i) => {
      this.jugadores.set('bot' + i, { nombre: n, color: libres[i] });
      this.skinsBots = this.skinsBots || {};
      this.skinsBots['bot' + i] = SKINS_BOTS[i % SKINS_BOTS.length];
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
  avisaMarcador() {
    this.h.alMarcador({ bajas: { ...this.bajas }, muertes: { ...this.muertes }, armas: { ...this.armas }, ronda: this.ronda, caidos: [...this.caidos], puntos: {} });
  }

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
    const e = { x: b.pos.x, y: b.pos.y, z: b.pos.z, ry: b.yaw, v: b.vivo ? 1 : 0, a: 0, sk: this.skinsBots[b.id] };
    if (b.disparo) e.s = { i: b.disparo, e: b.finales };
    return e;
  }

  publicar(e) { this.estadoYo = e; }
  // Sin sala, las armas del piso se reparten aquí con la misma regla que el
  // reductor: vale la siguiente aparición de ese punto.
  accion(tipo, d) {
    if (tipo === 'ronda' && this.variante === 'zombis' && d.r === this.ronda + 1 && !this.caidos.has('fin')) {
      this.ronda = d.r;
      this.caidos.clear();
      this.avisaMarcador();
    }
    if (tipo !== 'recoge') return;
    if (d.g !== (this.armas[d.s] ? this.armas[d.s].g : -1) + 1) return;
    this.armas[d.s] = { g: d.g, uid: 'yo' };
    this.avisaMarcador();
  }
  hablar() {}
  entrarVoz() {}

  golpear(dest, g) {
    const b = this.bots.find(x => x.id === dest);
    if (!b || !b.vivo) return;
    // La espátula dorada le quita la mitad de lo que le queda.
    b.hp -= g.a === 8 ? Math.max(1, Math.ceil(b.hp / 2)) : g.dmg;
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
    if (this.variante === 'zombis') {
      // Solo: caer es el fin de la práctica.
      this.caidos.add('yo');
      this.h.alFeed({ k: '', v: this.nombre('yo'), a: ev.a | 0, cab: false });
      this.avisaMarcador();
      this.caidos.add('fin');
      this.h.alFin({ ganador: 'yo', motivo: 'zombis', ronda: ev.r | 0, puntos: { yo: ev.pts | 0 } });
      return;
    }
    if (ev.de !== 'yo' && this.bajas[ev.de] !== undefined) this.bajas[ev.de]++;   // la propia granada no es baja
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
