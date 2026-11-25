// pk-84 (plan Hacha y Pico, P6–P7): la Posada de los Viajeros, lo que calcula. Tablas en datos-posada.js.
//  - Tablero: llegan viajeros con pedidos (1 a 3 bienes) hasta llenar los lugares; mientras no estás también llegan,
//    y esperan: ningún pedido caduca. Entregar paga al instante (oro, algo de monedas del reino con tope diario, fama).
//  - La Diligencia: cada 4 h de reloj real, 9 cajas; se llenan de a una, cada caja paga, y las 9 dan un premio extra.
//  - El visitante ilustre: uno por día, con un pedido grande; se queda hasta que lo atiendas.
//  - La Feria: 30 escalones por semana que avanzan con la fama de esa semana; cada escalón paga solo al pasarlo.
//  - El álbum: cada viajero cuenta un capítulo de su historia a las 1, 3, 6, 10 y 15 entregas.
// Todo con semilla por pedido (st.posada.n) o por bloque de tiempo, y con G.ahora(): recargar no cambia nada y lo que
// llega sin conexión es lo mismo que habría llegado en vivo. Solo en tu reino (en el mar, la posada espera).
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, U = PK.U;
  const Po = (PK.Posada = {});
  const G = () => PK.Game;
  const toast = (m, k) => { if (!G().offline && PK.UI && PK.UI.toast) PK.UI.toast(m, k); };
  const sfx = n => { if (!G().offline && PK.Sfx) PK.Sfx.play(n); };

  Po.taller = () => G().buildings.find(b => b.owner === 'p' && b.type === 'posada' && b.done) || null;
  Po.st = function () {
    const st = G().state;
    if (!st) return null;
    if (!st.posada) st.posada = { n: 0, tab: [], prox: 0, fama: 0, album: {}, dil: null, ilu: null, feria: null, mon: { d: '', n: 0 }, cola: [] };
    return st.posada;
  };
  const semilla = (k, x) => ((((G().state.created || 1) % 2147483647) * 31 + k * 7919 + (x || 0) * 104729) >>> 0);
  const rngDe = (k, x) => { const r = U.rng(semilla(k, x)); r(); return r; };
  const diaDe = t => U.dayKey(new Date(t));
  const semanaDe = t => Math.floor((t / 86400000 + 3) / 7); // semanas UTC que empiezan el lunes
  Po.nivel = f => D.POSADA.fama.reduce((n, umbral, i) => (f >= umbral ? i + 1 : n), 1);
  Po.unidad = r => (r === 'gold' ? 1 : (D.MARKET_BASE[r] || 100) / 100); // valor en oro de una unidad

  // lo que tu reino puede dar ahora: recursos de tu era cuyo taller tienes
  function candidatos() {
    const g = G(), st = g.state;
    return D.POSADA_RES.filter(o => o.era <= st.era && (!o.b || g.countB(o.b) > 0)).map(o => o.r);
  }
  function elegirRes(r, k, gusta) {
    const st = G().state, cs = candidatos(), out = [];
    for (let i = 0; i < k && cs.length; i++) {
      const peso = cs.map(x => (gusta.includes(x) ? 3 : 1) * (0.5 + Math.min(1.5, (st.res[x] || 0) / Math.max(1, G().cap(x)) * 2)));
      let s = peso.reduce((a, b) => a + b, 0) * r(), j = 0;
      while ((s -= peso[j]) > 0 && j < cs.length - 1) j++;
      out.push(cs[j]); cs.splice(j, 1);
    }
    return out;
  }
  function cantidades(r, res, valor) {
    const items = {};
    for (const x of res) { const v = valor / res.length * (0.8 + 0.4 * r()); items[x] = Math.max(5, Math.round(v / Po.unidad(x) / 5) * 5); }
    return items;
  }
  const valorDe = items => Object.keys(items).reduce((s, x) => s + items[x] * Po.unidad(x), 0);

  // ---------- Tablero ----------
  function nuevoPedido(t) {
    const p = Po.st(), st = G().state;
    p.n++;
    const r = rngDe(p.n), nivel = Po.nivel(p.fama), ocupados = new Set(p.tab.map(o => o.v));
    let pool = D.VIAJEROS.filter(v => v.fama < nivel && !ocupados.has(v.id));
    if (!pool.length) pool = D.VIAJEROS.filter(v => v.fama < nivel);
    // los que tienen la historia más atrasada vienen un poco más seguido (así avanzan todas)
    const peso = pool.map(v => 1 / (1 + ((p.album[v.id] && p.album[v.id].n) || 0) * 0.15));
    let s = peso.reduce((a, b) => a + b, 0) * r(), j = 0;
    while ((s -= peso[j]) > 0 && j < pool.length - 1) j++;
    const v = pool[j], k = 1 + (r() < 0.5 ? 1 : 0) + (st.era >= 3 && r() < 0.25 ? 1 : 0);
    const res = elegirRes(r, k, v.gusta);
    if (!res.length) return null;
    const items = cantidades(r, res, D.POSADA.valor(st.era) * (1 + 0.1 * (k - 1)) * (1 + 0.04 * (nivel - 1)));
    const gusto = res.some(x => v.gusta.includes(x));
    const o = { id: p.n, v: v.id, items, gold: Math.round(valorDe(items) * D.POSADA.paga * (gusto ? 1.15 : 1)), coins: r() < 0.35 ? 2 : 1, fama: k + 1, t };
    p.tab.push(o);
    return o;
  }
  Po.puede = o => Object.keys(o.items).every(r => (G().state.res[r] || 0) >= o.items[r]);
  Po.falta = o => Object.keys(o.items).filter(r => (G().state.res[r] || 0) < o.items[r]);
  Po.listos = () => { const p = Po.st(); return p ? p.tab.filter(Po.puede).length + (p.ilu && !p.ilu.hecho && Po.puede(p.ilu) ? 1 : 0) : 0; };
  function monedas(n) {
    const p = Po.st(), d = diaDe(G().ahora());
    if (p.mon.d !== d) p.mon = { d, n: 0 };
    const c = Math.max(0, Math.min(n, D.POSADA.monedasDia - p.mon.n));
    if (c > 0) { p.mon.n += c; G().give({ coins: c }); }
    return c;
  }
  Po.entregar = function (id) {
    const p = Po.st(), i = p.tab.findIndex(o => o.id === id), o = p.tab[i];
    if (!o) return false;
    if (!Po.puede(o)) { toast('Te falta: ' + Po.falta(o).map(r => D.RES[r].name.toLowerCase()).join(', ') + '.', 'warn'); return false; }
    if (!G().pay(o.items)) return false;
    G().give({ gold: o.gold });
    const c = monedas(o.coins);
    p.tab.splice(i, 1);
    p.prox = Math.min(p.prox || Infinity, G().ahora() + 120e3); // el próximo viajero, pronto
    G().stat('posada_pedidos', 1);
    const v = Po.viajero(o.v);
    toast(v.nombre + ' se va contento: +' + U.fmt(o.gold) + ' de oro' + (c ? ', +' + c + ' monedas' : '') + ', +' + o.fama + ' de fama.', 'good');
    sfx('coin');
    sumarFama(o.fama);
    contar(o.v);
    return true;
  };
  Po.despedir = function (id) {
    const p = Po.st(), i = p.tab.findIndex(o => o.id === id);
    if (i < 0) return;
    p.tab.splice(i, 1);
    p.prox = Math.min(p.prox || Infinity, G().ahora() + D.POSADA.despedir * 1000);
  };
  Po.viajero = id => D.VIAJEROS.find(v => v.id === id) || D.ILUSTRES.find(v => v.id === id);

  // ---------- Fama, Feria y álbum ----------
  function sumarFama(f) {
    const p = Po.st(), antes = Po.nivel(p.fama);
    p.fama += f;
    G().stat('posada_fama', f);
    if (Po.nivel(p.fama) > antes) {
      const nuevos = D.VIAJEROS.filter(v => v.fama === Po.nivel(p.fama) - 1).map(v => v.nombre);
      toast('¡Tu posada es más famosa (nivel ' + Po.nivel(p.fama) + ')!' + (nuevos.length ? ' Ahora llegan: ' + nuevos.join(', ') + '.' : ''), 'epic');
    }
    feria().f += f;
    avanzarFeria();
  }
  function avanzarFeria() {
    const fe = feria();
    while (fe.paso < D.POSADA.feriaPasos && fe.f >= Po.umbralFeria(fe.paso + 1)) {
      fe.paso++;
      const pr = Po.premioFeria(fe.paso);
      G().give(pr);
      G().stat('posada_feria', 1);
      toast('Feria de la semana: escalón ' + fe.paso + '. ' + PK.Posada.premioTxt(pr), fe.paso % 5 ? 'good' : 'epic');
    }
  }
  Po.umbralFeria = k => { let s = 0; for (let i = 1; i <= k; i++) s += D.POSADA.feriaPaso(i); return s; };
  Po.premioFeria = function (k) {
    const e = Math.max(2, G().state.era);
    if (k === D.POSADA.feriaPasos) return { coins: 30, gems: 10 * e, crystal: 2 };
    if (k % 10 === 0) return { coins: 15, [['hide', 'lore', 'crystal'][(k / 10) % 3]]: 1 };
    if (k % 5 === 0) return { coins: 8 };
    return [{ gems: 2 * e }, { tools: 4 * e }, { books: 3 * e }, { ingots: 8 * e }][k % 4];
  };
  Po.premioTxt = pr => Object.keys(pr).map(r => '+' + U.fmt(pr[r]) + ' ' + (r === 'coins' ? 'monedas' : D.RES[r].name.toLowerCase())).join(', ');
  function feria() {
    const p = Po.st(), s = semanaDe(G().ahora());
    if (!p.feria || p.feria.sem !== s) p.feria = { sem: s, f: 0, paso: 0 };
    return p.feria;
  }
  Po.feria = feria;
  Po.feriaFin = () => (semanaDe(G().ahora()) + 1) * 7 * 86400000 - 3 * 86400000; // cuándo empieza la próxima
  function contar(vid) {
    const p = Po.st(), a = p.album[vid] || (p.album[vid] = { n: 0, c: 0 });
    a.n++;
    const caps = D.POSADA.capitulos;
    while (a.c < caps.length && a.n >= caps[a.c]) {
      a.c++;
      p.cola.push({ v: vid, c: a.c });
      G().stat('posada_capitulos', 1);
      if (a.c === caps.length) {
        const e = Math.max(2, G().state.era), pr = { coins: 20, gems: 10 * e };
        G().give(pr);
        G().stat('posada_historias', 1);
        toast('¡' + Po.viajero(vid).nombre + ' terminó su historia y te deja un regalo! ' + Po.premioTxt(pr), 'epic');
      } else toast(Po.viajero(vid).nombre + ' tiene algo que contarte (capítulo ' + a.c + ' de 5). Míralo en la Posada.', 'info');
    }
  }
  Po.capitulosVistos = () => { const p = Po.st(); return p ? p.cola.length : 0; };

  // ---------- Diligencia ----------
  function nuevaDil(bloque) {
    const st = G().state, r = rngDe(bloque, 7), cajas = [];
    const val = D.POSADA.valor(st.era) * 0.6;
    for (let i = 0; i < D.POSADA.dilCajas; i++) {
      const [res] = elegirRes(r, 1, []);
      if (!res) break;
      const pago = ['tools', 'books', 'gems', 'ingots', 'marble', 'planks'][Math.floor(r() * 6)];
      cajas.push({ r: res, q: Math.max(5, Math.round(val * (0.8 + 0.4 * r()) / Po.unidad(res) / 5) * 5), pago, pq: Math.max(1, Math.round(val * 1.1 / Po.unidad(pago))), hecha: false });
    }
    return { bloque, cajas, bono: false };
  }
  Po.dil = function () {
    const p = Po.st(), bloque = Math.floor(G().ahora() / (D.POSADA.dilCada * 1000));
    if (!p.dil || p.dil.bloque !== bloque) p.dil = nuevaDil(bloque);
    return p.dil;
  };
  Po.dilParte = () => (Math.floor(G().ahora() / (D.POSADA.dilCada * 1000)) + 1) * D.POSADA.dilCada * 1000;
  Po.llenarCaja = function (i) {
    const d = Po.dil(), c = d.cajas[i];
    if (!c || c.hecha) return false;
    if ((G().state.res[c.r] || 0) < c.q) { toast('Te falta ' + D.RES[c.r].name.toLowerCase() + ' (' + U.fmt(c.q) + ').', 'warn'); return false; }
    if (!G().pay({ [c.r]: c.q })) return false;
    c.hecha = true;
    G().give({ [c.pago]: c.pq });
    G().stat('posada_cajas', 1);
    sfx('deposit');
    sumarFama(2);
    if (!d.bono && d.cajas.every(x => x.hecha)) {
      d.bono = true;
      const pr = { gems: 3 * Math.max(2, G().state.era) }; // las monedas, dentro del tope diario de la posada
      G().give(pr);
      const c = monedas(12);
      if (c) pr.coins = c;
      G().stat('posada_dil', 1);
      sumarFama(10);
      toast('¡La Diligencia sale completa! ' + Po.premioTxt(pr) + ', +10 de fama.', 'epic');
      sfx('quest');
    }
    return true;
  };
  // pk-84: una caja difícil se le puede pedir al gremio (el tablón «Necesito…» que ya existe, con sus topes)
  Po.pedirAyuda = function (i) {
    const c = Po.dil().cajas[i], st = G().state;
    if (!c || !PK.Social || !st.guild || !st.guild.joined || !D.NEED_RES.includes(c.r)) return false;
    PK.Social.askNeed(c.r);
    return true;
  };

  // ---------- Visitante ilustre ----------
  function nuevoIlustre(dia, t) {
    const st = G().state, k = U.strHash(dia), r = rngDe(k, 11), v = D.ILUSTRES[Math.floor(r() * D.ILUSTRES.length)];
    const res = elegirRes(r, st.era >= 3 ? 3 : 2, v.gusta);
    if (!res.length) return null;
    const items = cantidades(r, res, D.POSADA.valor(st.era) * 5);
    const e = Math.max(2, st.era);
    return { id: 'i' + dia, v: v.id, dia, items, premio: { coins: 8, gems: 4 * e, [['crystal', 'hide', 'lore'][Math.floor(r() * 3)]]: 1 }, fama: 15, t, hecho: false };
  }
  Po.atenderIlustre = function () {
    const p = Po.st(), o = p.ilu;
    if (!o || o.hecho) return false;
    if (!Po.puede(o)) { toast('Te falta: ' + Po.falta(o).map(r => D.RES[r].name.toLowerCase()).join(', ') + '.', 'warn'); return false; }
    if (!G().pay(o.items)) return false;
    o.hecho = true;
    const pr = Object.assign({}, o.premio), c = monedas(pr.coins || 0); // las monedas, dentro del tope diario
    delete pr.coins;
    G().give(pr);
    if (c) pr.coins = c;
    G().stat('posada_ilustres', 1);
    toast(Po.viajero(o.v).nombre + ' queda encantado con tu reino. ' + Po.premioTxt(pr) + ', +' + o.fama + ' de fama.', 'epic');
    sfx('quest');
    sumarFama(o.fama);
    return true;
  };

  // ---------- El paso (desde G.updateTimers: en vivo y sin conexión) ----------
  Po.tick = function () {
    const g = G(), b = Po.taller();
    if (!b || g.enMar()) return;
    const p = Po.st(), ahora = g.ahora(), cada = D.POSADA.cada(b.lvl) * 1000, lugares = D.POSADA.lugares(b.lvl);
    if (!p.prox) p.prox = ahora + 20e3; // el primer viajero llega enseguida
    let k = 0;
    while (p.tab.length < lugares && ahora >= p.prox && k++ < 12) { if (!nuevoPedido(p.prox)) break; p.prox += cada; }
    if (p.tab.length >= lugares && p.prox < ahora + cada) p.prox = ahora + cada; // lleno: el próximo, un rato después de que haya lugar
    Po.dil();
    avanzarFeria();
    const dia = diaDe(ahora);
    if (g.state.era >= 2 && Po.nivel(p.fama) >= 2 && (!p.ilu || (p.ilu.hecho && p.ilu.dia !== dia))) {
      const o = nuevoIlustre(dia, ahora);
      if (o) { p.ilu = o; toast('¡' + Po.viajero(o.v).nombre + ', ' + Po.viajero(o.v).titulo + ', llegó a tu posada!', 'epic'); }
    }
  };
})();
