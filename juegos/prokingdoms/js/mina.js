// pk-84 (plan Hacha y Pico, P3): la Mina Profunda, lo que calcula. Un piso por nivel del edificio; cada piso tiene vetas
// (D.vetaMina, con la semilla de la mina) que se agotan y un frente de avance que destapa la siguiente. Los mineros son
// aldeanos con task { t: 'mina', b } que entran (u.inside, b.workers) y trabajan en un piso (b.mina.asig[uid] = n).
//
// La simulación es UNA fórmula por paso (Mi.paso, desde G.updateBuildings): en vivo y sin conexión es la misma, con dt
// chico o grande. La vista en corte (P4) solo lee este estado. Nada usa Date.now() ni Math.random.
//
// Estado guardado en el edificio: b.mina = { sem, pisos: [{ v: [{ k, q, e }], i, fr, m: { mejora: 1 } }], asig, mont, mano }
//  - v: vetas destapadas sin agotar (k = número de veta, q = lo que le queda, e = especial acumulado)
//  - i: cuántas vetas se destaparon en ese piso; fr: avance del frente (minero·segundos)
//  - asig: piso de cada minero adentro; mont: montacargas (índice de D.MINA.montacargas); mano: reparto a mano
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, U = PK.U;
  const Mi = (PK.Mina = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (m, k) => { if (!G().offline && PK.UI && PK.UI.toast) PK.UI.toast(m, k); };

  Mi.es = b => !!(b && b.def && b.def.mina);
  Mi.mia = () => G().buildings.find(b => b.owner === 'p' && b.type === 'mina' && b.done) || null;

  // ---------- Estado ----------
  Mi.estado = function (b) {
    if (!b.mina) b.mina = { sem: ((b.id * 2654435761) ^ ((S() && S().created) || 0)) >>> 0, pisos: [], asig: {}, mont: 0, mano: false };
    return b.mina;
  };
  Mi.pisos = b => (b.done ? b.lvl : 0);
  Mi.piso = function (b, n) {
    const m = Mi.estado(b);
    let p = m.pisos[n - 1];
    if (!p) {
      p = m.pisos[n - 1] = { v: [], i: 0, fr: 0, m: {} };
      for (let k = 0; k < D.MINA.vetasIni; k++) destapar(b, n, p);
    }
    return p;
  };
  Mi.info = (b, n) => D.pisoMina(Mi.estado(b).sem, n); // { e, agua, gas }
  function destapar(b, n, p) {
    const v = D.vetaMina(Mi.estado(b).sem, n, p.i);
    p.v.push({ k: p.i, q: v.cant, e: 0 });
    p.i++;
    return v;
  }
  Mi.veta = (b, n, k) => D.vetaMina(Mi.estado(b).sem, n, k);

  // ---------- Puestos y mineros ----------
  Mi.puestosPiso = (b, n) => D.MINA.puestos + (Mi.piso(b, n).m.puestos ? D.MINA.mejoras.puestos.ef : 0);
  Mi.puestos = function (b) { let s = 0; for (let n = 1; n <= Mi.pisos(b); n++) s += Mi.puestosPiso(b, n); return s; };
  Mi.trabajable = function (b, n) { const f = Mi.info(b, n); return !(f.gas && !Mi.piso(b, n).m.ventilacion); };
  Mi.cuenta = function (b) {
    const m = Mi.estado(b), c = new Array(Mi.pisos(b) + 1).fill(0);
    for (const id of b.workers) { const n = m.asig[id]; if (n >= 1 && n < c.length) c[n]++; }
    return c;
  };
  Mi.libres = b => Mi.puestos(b) - b.workers.length - G().units.filter(u => u.task && u.task.t === 'mina' && u.task.b === b.id && !u.inside).length;
  // qué tan bueno es un piso para el próximo minero (para el reparto automático)
  function valor(b, n, c) {
    if (!Mi.trabajable(b, n) || c[n] >= Mi.puestosPiso(b, n)) return -1;
    const p = Mi.piso(b, n), f = Mi.info(b, n), act = p.v[0], res = act ? Mi.veta(b, n, act.k).res : 'stone';
    const nec = G().metaNecesita ? G().metaNecesita() : {}, pide = (nec[res] || 0) > (S().res[res] || 0);
    let w = (1 + D.MINA.prof * (n - 1)) * (pide ? 3 : 1) * (act ? 1 : 0.4) * (f.agua && !p.m.bomba ? 0.5 : 1) * (p.m.rieles ? 1.25 : 1);
    w *= 1 / (1 + c[n] * 0.08); // repartir un poco
    return w;
  }
  Mi.mejorPiso = function (b, c) {
    c = c || Mi.cuenta(b);
    let best = 0, bw = -1;
    for (let n = 1; n <= Mi.pisos(b); n++) { const w = valor(b, n, c); if (w > bw) { bw = w; best = n; } }
    return bw > 0 ? best : 0;
  };
  // un minero que llega: a su piso elegido (task.piso) si hay lugar, si no al mejor
  Mi.ubicar = function (b, u) {
    const m = Mi.estado(b), c = Mi.cuenta(b), want = u.task && u.task.piso;
    m.asig[u.id] = want && want <= Mi.pisos(b) && c[want] < Mi.puestosPiso(b, want) && Mi.trabajable(b, want) ? want : Mi.mejorPiso(b, c) || 1;
  };
  Mi.soltar = (b, id) => { if (b.mina) delete b.mina.asig[id]; };
  // un minero que llega al castillete baja (false si ya no hay puesto)
  Mi.entrar = function (b, u) {
    if (b.workers.includes(u.id)) return true;
    if (b.workers.length >= Mi.puestos(b)) { if (!G().offline && u.task && u.task.m) toast(b.def.name + ' ya tiene todos sus puestos ocupados.', 'warn'); return false; }
    b.workers.push(u.id);
    u.inside = true; u.mode = 'idle'; u.path = [];
    Mi.ubicar(b, u);
    return true;
  };
  // pasa un minero del piso `de` al `a` (0 = cualquiera, el menos valioso). Apaga el reparto automático.
  Mi.mover = function (b, de, a) {
    const m = Mi.estado(b), c = Mi.cuenta(b);
    if (a && c[a] >= Mi.puestosPiso(b, a)) return false;
    let id = null;
    if (de) id = b.workers.find(x => m.asig[x] === de);
    else {
      let peor = Infinity;
      for (const x of b.workers) { const n = m.asig[x]; if (n === a) continue; const w = valor(b, n, c); if (w < peor) { peor = w; id = x; } }
    }
    if (id === null || id === undefined) return false;
    if (!a) return false;
    m.asig[id] = a;
    m.mano = true;
    return true;
  };
  // reparto automático (cada 10 s): pasa de a un minero del piso que menos rinde al que más, si la diferencia es clara
  Mi.repartir = function (b) {
    const m = Mi.estado(b);
    if (m.mano) return;
    for (let k = 0; k < 4; k++) {
      const c = Mi.cuenta(b);
      let peor = 0, pw = Infinity;
      for (let n = 1; n <= Mi.pisos(b); n++) {
        if (!c[n]) continue;
        const w = Mi.trabajable(b, n) ? valor(b, n, Object.assign([], c, { [n]: c[n] - 1 })) : -2;
        if (w < pw) { pw = w; peor = n; }
      }
      if (!peor) return;
      const c2 = Object.assign([], c, { [peor]: c[peor] - 1 }), mejor = Mi.mejorPiso(b, c2);
      if (!mejor || mejor === peor || valor(b, mejor, c2) < pw * 1.3) return;
      const id = b.workers.find(x => m.asig[x] === peor);
      if (id === undefined) return;
      m.asig[id] = mejor;
    }
  };

  // ---------- Ritmo ----------
  Mi.sube = b => D.MINA.montacargas[Mi.estado(b).mont || 0].sube; // por minuto
  Mi.ritmo = function (b, n, res) {
    const p = Mi.piso(b, n), f = Mi.info(b, n);
    return G().gatherRate('p', res, null, res) * D.minaRitmo(n, p.m.rieles, p.m.lamparas) * (f.agua && !p.m.bomba ? 0.5 : 1);
  };
  // lo que sacaría un piso por segundo con c mineros (sin topes): { res: unidades/s, fr: avance/s, piedra: /s }
  function potencial(b, n, c, room) {
    if (!c || !Mi.trabajable(b, n)) return null;
    const p = Mi.piso(b, n), act = p.v[0], res = act ? Mi.veta(b, n, act.k).res : null;
    const puede = res && room(res) >= 1;
    const frac = puede ? D.MINA.avance : 1;
    const f = Mi.info(b, n), agua = f.agua && !p.m.bomba ? 0.5 : 1;
    return { res: puede ? res : null, r: puede ? c * (1 - frac) * Mi.ritmo(b, n, res) : 0, fr: c * frac * agua, piedra: c * frac * Mi.ritmo(b, n, 'stone') * D.MINA.roca };
  }
  // por minuto, para el panel: { total, porRes, sube, limita: 'montacargas'|'bodega'|null }
  Mi.resumen = function (b) {
    const c = Mi.cuenta(b), room = r => Mi.lugar(b, r), por = {};
    let tot = 0;
    for (let n = 1; n <= Mi.pisos(b); n++) {
      const q = potencial(b, n, c[n], room);
      if (!q) continue;
      if (q.res) { por[q.res] = (por[q.res] || 0) + q.r * 60; tot += q.r * 60; }
      if (room('stone') >= 1) { por.stone = (por.stone || 0) + q.piedra * 60; tot += q.piedra * 60; }
    }
    const sube = Mi.sube(b);
    return { total: tot, porRes: por, sube, limita: tot > sube ? 'montacargas' : null, mineros: b.workers.length };
  };
  Mi.aislada = b => !!(PK.Logi && PK.Logi.campoAislado && PK.Logi.campoAislado(b));
  Mi.lugar = function (b, r) {
    if (Mi.aislada(b)) { const g = G(); return Math.max(0, g.cap(r) - (S().res[r] || 0)); }
    return PK.Libro.lugarCampo(b, r);
  };

  // ---------- El paso ----------
  Mi.paso = function (dt) {
    if (!(dt > 0)) return;
    const g = G();
    for (const b of g.buildings) if (b.owner === 'p' && b.type === 'mina' && b.done && b.workers.length) pasoMina(b, dt);
  };
  let repT = 0;
  Mi.tick = function (dt) { // desde PK.Auto.tick (cada segundo, o de a 60 sin conexión)
    if ((repT += dt) < 10) return;
    repT = 0;
    for (const b of G().buildings) if (b.owner === 'p' && b.type === 'mina' && b.done && b.workers.length) Mi.repartir(b);
  };
  function pasoMina(b, dt) {
    const g = G(), c = Mi.cuenta(b), aislada = Mi.aislada(b);
    const room = r => Mi.lugar(b, r);
    const pots = [];
    let tot = 0;
    for (let n = 1; n <= Mi.pisos(b); n++) {
      const q = potencial(b, n, c[n], room);
      if (!q) continue;
      pots.push([n, q]);
      tot += q.r + (room('stone') >= 1 ? q.piedra : 0);
    }
    if (!pots.length) return;
    // topes: el montacargas (por segundo) y lo que queda libre en la bodega (de la mina, o del pueblo si está aislada)
    const libre = aislada ? Infinity : PK.Libro.capCampo(b) - PK.Libro.totalCampo(b);
    const k = tot > 0 ? Math.min(1, Mi.sube(b) / 60 / tot, Math.max(0, libre) / (tot * dt)) : 1;
    const out = {};
    for (const [n, q] of pots) {
      const p = Mi.piso(b, n), d = dt * k;
      // el frente avanza (y da piedra, si cabe; si no, va a la escombrera)
      p.fr += q.fr * d;
      if (room('stone') >= 1) out.stone = (out.stone || 0) + q.piedra * d;
      const costo = D.MINA.avanceCosto(n);
      while (p.fr >= costo) {
        if (p.v.length >= D.MINA.maxVetas) { p.fr = costo; break; }
        p.fr -= costo;
        const v = destapar(b, n, p);
        if (v.esp || v.res === 'gems' || v.res === 'marble' || v.res === 'gold') toast('Nueva veta de ' + (v.esp ? D.RES[v.esp].name.toLowerCase() + ' y ' : '') + D.RES[v.res].name.toLowerCase() + ' en el piso ' + n + ' de la mina.', 'info');
      }
      // las vetas, de a una
      let falta = q.r * d;
      while (falta > 1e-9 && p.v.length && q.res) {
        const a = p.v[0], def = Mi.veta(b, n, a.k);
        if (def.res !== q.res) break; // la siguiente es de otra cosa: el próximo paso la mira
        const t = Math.min(falta, a.q);
        a.q -= t; falta -= t;
        out[def.res] = (out[def.res] || 0) + t;
        if (def.esp) {
          a.e += t * def.espN / def.cant;
          const e = Math.floor(a.e);
          if (e >= 1) { a.e -= e; g.give({ [def.esp]: e }); g.stat('mina_esp', e); toast('La mina sacó ' + e + ' de ' + D.RES[def.esp].name.toLowerCase() + '.', 'good'); }
        }
        if (a.q <= 1e-6) {
          p.v.shift();
          g.stat('mina_vetas', 1);
          if (def.hall) { g.give({ gems: def.hall }); g.stat('mina_gemas', def.hall); toast('¡Un bolsón de gemas al final de la veta del piso ' + n + '! (+' + def.hall + ')', 'good'); }
        }
      }
    }
    let sacado = 0;
    for (const r in out) {
      const q = out[r];
      if (!(q > 0)) continue;
      // aislada: los mineros suben a pie al pueblo y llega la mitad (como L.campoAislado con los campamentos)
      const n = aislada ? g.addRes(r, q * 0.5) : PK.Libro.ponerCampo(b, r, q);
      if (n > 0) { sacado += n; if (g.gained) g.gained(r, n, -1); }
      if (r === 'gems' && n > 0) g.stat('mina_gemas', n);
    }
    if (sacado > 0) g.stat('mina_sacado', sacado);
  }

  // ---------- Mejoras ----------
  Mi.mejoraCosto = (k, n) => { const c = D.MINA.mejoras[k].cost(n), o = {}; for (const r in c) o[r] = Math.round(c[r]); return o; };
  // qué mejoras se pueden poner en el piso n: [{ k, def, tiene, cost, why }]
  Mi.mejorasDe = function (b, n) {
    const p = Mi.piso(b, n), f = Mi.info(b, n), out = [];
    for (const k in D.MINA.mejoras) {
      const def = D.MINA.mejoras[k];
      if (def.solo && !f[def.solo]) continue;
      if (def.desde && n < def.desde) continue;
      const cost = Mi.mejoraCosto(k, n);
      out.push({ k, def, tiene: !!p.m[k], cost, why: p.m[k] ? null : !G().canAfford(cost) ? 'Te faltan recursos.' : null });
    }
    return out;
  };
  Mi.comprar = function (b, n, k) {
    const p = Mi.piso(b, n), def = D.MINA.mejoras[k];
    if (!def || p.m[k]) return false;
    if (!G().pay(Mi.mejoraCosto(k, n))) { toast('Recursos insuficientes.', 'warn'); return false; }
    p.m[k] = 1;
    G().stat('mina_mejoras', 1);
    toast(def.name + ' en el piso ' + n + '.', 'good');
    return true;
  };
  Mi.montSig = function (b) {
    const i = (Mi.estado(b).mont || 0) + 1, m = D.MINA.montacargas[i];
    if (!m) return null;
    return { i, m, why: S().era < m.era ? 'Se habilita en la Era ' + U.roman(m.era) + '.' : !G().canAfford(m.cost) ? 'Te faltan recursos.' : null };
  };
  Mi.subirMontacargas = function (b) {
    const s = Mi.montSig(b);
    if (!s || s.why) { if (s) toast(s.why, 'warn'); return false; }
    if (!G().pay(s.m.cost)) return false;
    Mi.estado(b).mont = s.i;
    toast('Nuevo montacargas: ' + s.m.name + ' (' + s.m.sube + ' por minuto).', 'good');
    return true;
  };
})();
