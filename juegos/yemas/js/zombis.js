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
import * as THREE from 'three';
import { moverCuerpo, rayoMundo, crearZombi, VENTANAS, ALTURAS, ALTO } from 'yemas/mundo';

export const ZB = { mordida: 40, alcance: 1.3, cadencia: 1.1, preparar: 0.35, sube: 0.9, pausa: 9, arranque: 3 };
// Vida, cuántos salen y qué tan rápido, por ronda (y por jugadores, cuántos).
export const hpRonda = r => r <= 9 ? 60 + 45 * (r - 1) : Math.round(420 * Math.pow(1.1, r - 9));
export const totalRonda = (r, n) => Math.min(90, Math.round((4 + 3 * r) * (1 + 0.5 * (Math.max(1, n) - 1))));
export const velRonda = r => Math.min(6.2, 2.2 + 0.45 * r);
const cadaSpawn = r => Math.max(0.45, 2.1 - 0.15 * r);
const maxVivos = n => Math.min(24, 8 + 3 * Math.max(1, n));
const r1 = x => Math.round(x * 10) / 10;
// Firebase devuelve los arreglos como objetos y se come los vacíos.
const lista = x => Array.isArray(x) ? x : Object.values(x || {});

// cb: alCaer({id, pos, killer, cab, a}), pideRonda(r), grunido(pos)
export function crearZombis(escena, colisores, cb) {
  const zs = new Map();         // id → zombi
  const vistos = new Set();     // muertes ya anunciadas
  let muertes = [];             // [[id, killer, cab, a]] las últimas, para la red
  let ronda = 0, q = 0, pausa = 0, cdSpawn = 0, entre = 0, pedida = 0, sigId = 1, nJug = 1;

  function nuevo(id, x, y, z, hp, max, sube) {
    const mesh = crearZombi();
    mesh.position.set(x, y - (sube < 1 ? ALTO * (1 - sube) : 0), z);
    escena.add(mesh);
    const zb = {
      id, mesh, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), enSuelo: true,
      obj: new THREE.Vector3(x, y, z), ry: 0, hp, max, sube,
      cd: 0.6, prep: -1, atasco: 0, lado: 1, desvio: 0, golpeT: 0, grunido: 2 + Math.random() * 6,
      vel0: velRonda(Math.max(1, ronda)) * (0.85 + Math.random() * 0.3),
    };
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
    const max = hpRonda(Math.max(1, ronda));
    for (const z of zs.values()) {
      z.max = max;
      z.hp = Math.max(1, Math.round((z.pct ?? 100) / 100 * max));
    }
  }

  function sitioSpawn(jug) {
    const vivos = jug.filter(j => j.vivo);
    const lejos = VENTANAS.filter(v => vivos.every(j => Math.hypot(j.pos.x - v.x, j.pos.z - v.z) > 12));
    const cand = (lejos.length ? lejos : VENTANAS).slice();
    // Los zombis entran por las ventanas cercanas a la gente, con algo de azar.
    const d = v => Math.min(999, ...vivos.map(j => Math.hypot(j.pos.x - v.x, j.pos.z - v.z)));
    cand.sort((a, b) => d(a) - d(b));
    return cand[Math.floor(Math.random() * Math.min(5, cand.length))];
  }

  // Adónde camina: al que persigue, salvo que esté arriba de la torre o de
  // una plataforma, que entonces va al pie de la escala y la sube.
  function metaDe(z, t) {
    if (t.pos.y - z.pos.y < 1) return t.pos;
    for (const [x0, x1, z0, z1, alto, escalas] of ALTURAS) {
      if (t.pos.x < x0 || t.pos.x > x1 || t.pos.z < z0 || t.pos.z > z1) continue;
      if (z.pos.y >= alto - 0.3) return t.pos;
      let [pie, cima] = escalas[0];
      for (const e of escalas) if (e[0].distanceTo(z.pos) < pie.distanceTo(z.pos)) [pie, cima] = e;
      // ¿Ya va por la escala? Cerca del segmento pie–cima, sigue a la cima.
      const ab = cima.clone().sub(pie), ap = z.pos.clone().sub(pie);
      ab.y = 0; ap.y = 0;
      const k = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
      return ap.sub(ab.multiplyScalar(k)).length() < 0.9 ? cima : pie;
    }
    return t.pos;
  }

  const _d = new THREE.Vector3();
  // jug: [{uid, pos (pies), vivo}]. Devuelve los mordiscos [{uid, dmg}].
  function paso(dt, jug, n) {
    nJug = n;
    const mordidas = [];
    if (!ronda) return mordidas;
    const vivos = jug.filter(j => j.vivo);
    // Salen de a uno, por las ventanas.
    if (pausa > 0) pausa -= dt;
    else if (q > 0 && zs.size < maxVivos(n)) {
      cdSpawn -= dt;
      if (cdSpawn <= 0 && vivos.length) {
        cdSpawn = cadaSpawn(ronda);
        const v = sitioSpawn(jug);
        nuevo(sigId, v.x + (Math.random() - 0.5) * 2, 0, v.z + (Math.random() - 0.5) * 2, hpRonda(ronda), hpRonda(ronda), 0);
        q--;
      }
    }
    // Ronda limpia: unos segundos de respiro y se pide la siguiente.
    if (q === 0 && zs.size === 0 && pausa <= 0) {
      if (entre <= 0 && !pedida) entre = ZB.pausa;
      entre -= dt;
      if (entre <= 0 && performance.now() - pedida > 3000) { pedida = performance.now(); cb.pideRonda(ronda + 1); }
    }
    for (const z of zs.values()) {
      if (z.sube < 1) { z.sube = Math.min(1, z.sube + dt / ZB.sube); continue; }
      // El más cercano de los que siguen en pie.
      let t = null, dt2 = Infinity;
      for (const j of vivos) {
        const d = j.pos.distanceTo(z.pos);
        if (d < dt2) { dt2 = d; t = j; }
      }
      const quiero = _d.set(0, 0, 0);
      if (t) {
        const h = Math.hypot(t.pos.x - z.pos.x, t.pos.z - z.pos.z), dy = Math.abs(t.pos.y - z.pos.y);
        const meta = metaDe(z, t);
        quiero.set(meta.x - z.pos.x, 0, meta.z - z.pos.z);
        const largo = quiero.length();
        if (largo > 0.01) quiero.divideScalar(largo);
        z.ry = Math.atan2(-(t.pos.x - z.pos.x), -(t.pos.z - z.pos.z));
        const cerca = h < ZB.alcance && dy < 1.3;
        if (h < 0.85 && dy < 1.3) quiero.set(0, 0, 0);
        // Se trabó contra algo: se corre de lado un rato y prueba saltar.
        if (z.desvio > 0) {
          z.desvio -= dt;
          const c = Math.cos(1.3 * z.lado), s = Math.sin(1.3 * z.lado);
          quiero.set(quiero.x * c - quiero.z * s, 0, quiero.x * s + quiero.z * c);
        }
        quiero.multiplyScalar(z.vel0);
        if (!cerca && Math.hypot(z.vel.x, z.vel.z) < z.vel0 * 0.3) z.atasco += dt; else z.atasco = Math.max(0, z.atasco - dt);
        // Si el que persigue está arriba (encima de un muro o una caja), el
        // salto es de trepar: si no, bastaba subirse a un muro para que no
        // pudieran tocarte nunca.
        if (z.atasco > 0.6) {
          const arriba = t.pos.y - z.pos.y > 0.8;
          z.atasco = 0; z.lado = Math.random() < 0.5 ? -1 : 1;
          z.desvio = arriba ? 0 : 1.1;
          if (z.enSuelo) z.vel.y = arriba ? 11.5 : 8;
        }
        // El mordisco: un amago corto y, si sigue cerca, muerde.
        z.cd -= dt;
        if (z.prep >= 0) {
          z.prep -= dt;
          if (z.prep < 0) {
            z.cd = ZB.cadencia;
            if (cerca) {
              const ojo = z.pos.clone().setY(z.pos.y + 1.2), q2 = t.pos.clone().setY(t.pos.y + 1);
              const dir = q2.clone().sub(ojo), dd = dir.length();
              if (rayoMundo(ojo, dir.normalize(), dd, colisores) >= dd - 0.2) mordidas.push({ uid: t.uid, dmg: ZB.mordida });
            }
          }
        } else if (cerca && z.cd <= 0) z.prep = ZB.preparar;
      }
      // Que no se amontonen todos en el mismo punto.
      for (const o of zs.values()) {
        if (o === z) continue;
        const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 0.9) { quiero.x += dx / d * 2.5; quiero.z += dz / d * 2.5; }
      }
      const k = 1 - Math.exp(-(z.enSuelo ? 8 : 2) * dt);
      z.vel.x += (quiero.x - z.vel.x) * k;
      z.vel.z += (quiero.z - z.vel.z) * k;
      moverCuerpo(z, dt, colisores);
      z.obj.copy(z.pos);
    }
    return mordidas;
  }

  // Daño a un zombi (solo en el director). Devuelve true si lo mató.
  function golpe(id, dmg, killer, cab, a) {
    const z = zs.get(id);
    if (!z) return false;
    z.hp -= dmg;
    z.golpeT = 0.12;
    if (z.hp > 0) return false;
    muertes = [...muertes, [id, killer || '', cab ? 1 : 0, a | 0]].slice(-20);
    vistos.add(id);
    const pos = z.mesh.position.clone();
    quita(id);
    cb.alCaer({ id, pos, killer: killer || '', cab: !!cab, a: a | 0 });
    return true;
  }

  // Lo que el director publica.
  function estado() {
    return {
      r: ronda, q, p: r1(Math.max(0, pausa)), e: r1(Math.max(0, entre)),
      z: [...zs.values()].map(z => [z.id, r1(z.pos.x), r1(z.pos.y), r1(z.pos.z), r1(z.ry),
        Math.max(1, Math.round(z.hp / z.max * 100)), z.sube < 1 ? 1 : 0]),
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
      const z = zs.get(id);
      const pos = z ? z.mesh.position.clone() : null;
      quita(id);
      if (pos) cb.alCaer({ id, pos, killer: String(m[1] || ''), cab: !!m[2], a: m[3] | 0 });
    }
    const ahora = new Set();
    for (const e of lista(zb.z)) {
      if (!Array.isArray(e)) continue;
      const [id, x, y, zz, ry, pct, sube] = e.map(Number);
      if (vistos.has(id)) continue;
      ahora.add(id);
      let z = zs.get(id);
      if (!z) z = nuevo(id, x, y, zz, 1, 1, sube ? 0 : 1);
      z.obj.set(x, y, zz);
      z.pos.set(x, y, zz);
      z.ry = ry;
      if (z.pct !== undefined && pct < z.pct) z.golpeT = 0.12;
      z.pct = pct;
      z.remotoSube = !!sube;
    }
    for (const id of [...zs.keys()]) if (!ahora.has(id)) quita(id);
  }

  // Animación de todos (director o no): subir del piso, bambolearse, el amago
  // del mordisco y el destello rojo al recibir un balazo.
  function animar(dt, director, ojo) {
    const t = performance.now() / 1000, kp = 1 - Math.exp(-12 * dt);
    for (const z of zs.values()) {
      if (!director && z.sube < 1) z.sube = Math.min(z.remotoSube ? 0.95 : 1, z.sube + dt / (z.remotoSube ? ZB.sube : 0.2));
      const baja = z.sube < 1 ? ALTO * (1 - z.sube) : 0;
      if (director) z.mesh.position.set(z.pos.x, z.pos.y - baja, z.pos.z);
      else {
        z.mesh.position.x += (z.obj.x - z.mesh.position.x) * kp;
        z.mesh.position.z += (z.obj.z - z.mesh.position.z) * kp;
        z.mesh.position.y += (z.obj.y - baja - z.mesh.position.y) * kp;
      }
      let dr = z.ry - z.mesh.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      z.mesh.rotation.y += dr * kp;
      const c = z.mesh.userData.cuerpo;
      const fase = t * 9 + z.id;
      c.rotation.z = Math.sin(fase) * 0.16;
      c.rotation.x = 0.18 + (z.prep >= 0 ? 0.45 : 0);
      z.golpeT = Math.max(0, z.golpeT - dt);
      z.mesh.userData.casco.material.emissive.setRGB(z.golpeT > 0 ? 0.7 : 0, 0, 0);
      z.grunido -= dt;
      if (z.grunido <= 0) {
        z.grunido = 4 + Math.random() * 7;
        if (ojo && z.mesh.position.distanceTo(ojo) < 30) cb.grunido(z.mesh.position);
      }
    }
  }

  return {
    lista: zs, iniciaRonda, adopta, paso, golpe, estado, desdeRed, animar,
    get ronda() { return ronda; },
    get quedan() { return zs.size + q; },
    get respiro() { return q === 0 && zs.size === 0 ? Math.max(0, entre) : 0; },
  };
}
