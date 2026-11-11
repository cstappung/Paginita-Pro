// Aventura (H2 y H7 del plan de la mega actualización): encuentros en el camino y mapas del tesoro.
//
// Encuentros: una expedición que lleva un héroe y tiene un viaje de más de un minuto se cruza con algo a mitad
// de camino (dos cosas si el viaje es largo). Es una carta con 2 o 3 opciones, cada una con su riesgo y su
// premio. Sin el jugador (sin conexión, o un minuto sin elegir) se toma la opción cauta, y el azar de cada carta
// sale de una semilla (id de viaje, número de encuentro): da lo mismo en vivo que sin conexión (regla 8).
//
// Mapas del tesoro: salen de las ruinas, de algunos encuentros y del Mercader de mapas. Marcan una casilla en la
// niebla (una X en el minimapa). El explorador lo desentierra al descubrir esa casilla (una bandera lo lleva), o
// un héroe va a buscarlo. El cofre trae equipo raro o mejor.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const A = (PK.Aventura = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const H = () => PK.Heroes;

  // ---------- Cartas ----------
  // ef: costo (se paga de las bodegas, se escala con la era), fuerza (+x para esta salida), tiempo (+x del viaje
  // que queda), perder (x de la tropa), riesgo (probabilidad de que lo malo pase), botin (recursos x era), xp (al
  // héroe), objeto (probabilidad), mapa (probabilidad). cauta: la que se toma sola.
  A.ENCUENTROS = [
    { id: 'puente', name: 'Puente roto', desc: 'El río baja crecido y el puente cuelga de una cuerda.', ops: [
      { label: 'Repararlo', ef: { costo: { wood: 60 } }, txt: 'gastas madera y siguen', cauta: true },
      { label: 'Vadear el río', ef: { riesgo: 0.4, perder: 0.05 }, txt: 'puede llevarse a alguno' },
      { label: 'Rodear', ef: { tiempo: 0.3 }, txt: 'el viaje se alarga' }] },
    { id: 'comerciante', name: 'Comerciante asaltado', desc: 'Un carro volcado y un mercader rodeado de forajidos.', ops: [
      { label: 'Ayudarlo', ef: { riesgo: 0.3, perder: 0.03, botin: { gold: 60 } }, txt: 'una pelea chica y una recompensa' },
      { label: 'Seguir de largo', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'ermitano', name: 'Ermitaño del bosque', desc: 'Un viejo junto al fuego ofrece una historia o una poción.', ops: [
      { label: 'Escuchar su historia', ef: { xp: 30 }, txt: '+experiencia al héroe', cauta: true },
      { label: 'Comprar una poción', ef: { costo: { gold: 40 }, fuerza: 0.06 }, txt: '+6% de fuerza en esta salida' }] },
    { id: 'lobos', name: 'Lobos hambrientos', desc: 'Una manada sigue a la columna desde hace un rato.', ops: [
      { label: 'Pelear', ef: { riesgo: 0.5, perder: 0.04, botin: { food: 80 }, xp: 15 }, txt: 'pieles y algo de riesgo' },
      { label: 'Darles comida', ef: { costo: { food: 80 } }, txt: 'se van sin pelear', cauta: true }] },
    { id: 'santuario', name: 'Santuario olvidado', desc: 'Una piedra con velas apagadas y monedas viejas.', ops: [
      { label: 'Rezar', ef: { fuerza: 0.08 }, txt: '+8% de fuerza en esta salida', cauta: true },
      { label: 'Saquear', ef: { botin: { gems: 3 }, riesgo: 0.3, perder: 0.03 }, txt: 'gemas, y a los dioses no les gusta' }] },
    { id: 'nino', name: 'Niño perdido', desc: 'Llora sentado en una piedra del camino.', ops: [
      { label: 'Llevarlo a casa', ef: { tiempo: 0.2, botin: { gold: 30 } }, txt: 'el viaje se atrasa; la familia agradece', cauta: true },
      { label: 'Dejarlo con unos pastores', ef: {}, txt: 'nada' }] },
    { id: 'gitanos', name: 'Caravana de gitanos', desc: 'Carros pintados y una adivina en la puerta.', ops: [
      { label: 'Cambiar por un objeto', ef: { costo: { gold: 80 }, objeto: 1 }, txt: 'un objeto al azar' },
      { label: 'Contratar a la adivina', ef: { costo: { gold: 50 }, mapa: 1 }, txt: 'te dibuja un mapa del tesoro' },
      { label: 'Saludar y seguir', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'emboscada', name: 'Emboscada', desc: 'Flechas desde los árboles.', ops: [
      { label: 'Cargar', ef: { perder: 0.05, fuerza: 0.06, xp: 15 }, txt: '+fuerza, con bajas' },
      { label: 'Retirarse a cubierto', ef: { tiempo: 0.25 }, txt: 'pierden tiempo', cauta: true }] },
    { id: 'cueva', name: 'Cueva lateral', desc: 'Una grieta en la roca con brillo adentro.', ops: [
      { label: 'Explorar', ef: { riesgo: 0.35, perder: 0.04, botin: { gems: 4, gold: 40 } }, txt: 'un poco de botín al azar' },
      { label: 'Ignorarla', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'desertores', name: 'Desertores del Rey Bandido', desc: 'Cinco hombres con armas viejas piden unirse.', era: 3, ops: [
      { label: 'Reclutarlos', ef: { tropa: 5 }, txt: '+5 milicianos al volver' },
      { label: 'Entregarlos', ef: { botin: { gold: 80 } }, txt: 'una recompensa en oro', cauta: true }] },
    { id: 'tormenta', name: 'Tormenta', desc: 'El cielo se pone negro de golpe.', ops: [
      { label: 'Refugiarse', ef: { tiempo: 0.25 }, txt: 'esperan a que pase', cauta: true },
      { label: 'Seguir', ef: { riesgo: 0.4, perder: 0.03, xp: 20 }, txt: '+experiencia, con riesgo' }] },
    { id: 'botella', name: 'Mapa en una botella', desc: 'Una botella en la orilla con un papel adentro.', ops: [
      { label: 'Seguirlo', ef: { mapa: 1 }, txt: 'un mapa del tesoro', cauta: true },
      { label: 'Venderlo', ef: { botin: { gold: 50 } }, txt: 'oro' }] },
    { id: 'herrero', name: 'Herrero ambulante', desc: 'Afila espadas por unas monedas.', ops: [
      { label: 'Afilar las armas', ef: { costo: { gold: 50 }, fuerza: 0.07 }, txt: '+7% de fuerza en esta salida' },
      { label: 'No, gracias', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'osos', name: 'Osezno en una trampa', desc: 'Una cría atrapada y la madre rugiendo cerca.', ops: [
      { label: 'Liberarlo', ef: { xp: 25, tiempo: 0.1 }, txt: 'la madre se va; +experiencia', cauta: true },
      { label: 'Ahuyentarlos', ef: { riesgo: 0.5, perder: 0.04, botin: { food: 60 } }, txt: 'carne, con riesgo' }] },
    { id: 'peaje', name: 'Peaje del barón', desc: 'Una cadena cruza el camino y un guardia aburrido.', ops: [
      { label: 'Pagar el peaje', ef: { costo: { gold: 40 } }, txt: 'siguen sin problemas', cauta: true },
      { label: 'Forzar el paso', ef: { riesgo: 0.4, perder: 0.03, botin: { gold: 40 } }, txt: 'su caja de monedas, con riesgo' },
      { label: 'Otro camino', ef: { tiempo: 0.3 }, txt: 'el viaje se alarga' }] },
    { id: 'fuente', name: 'Fuente clara', desc: 'Agua fresca después de días de polvo.', ops: [
      { label: 'Descansar', ef: { tiempo: 0.15, fuerza: 0.05 }, txt: '+5% de fuerza, se atrasan', cauta: true },
      { label: 'Seguir', ef: {}, txt: 'nada' }] },
    { id: 'campamento', name: 'Campamento abandonado', desc: 'Fogata tibia y bolsas a medio llenar.', ops: [
      { label: 'Revisarlo', ef: { riesgo: 0.25, perder: 0.03, botin: { wood: 60, gold: 30 }, objeto: 0.3 }, txt: 'algo de botín, y quizás una trampa' },
      { label: 'Seguir', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'espiritu', name: 'Espíritu del camino', desc: 'Una luz pálida pide que alguien recuerde su nombre.', era: 3, ops: [
      { label: 'Escucharlo', ef: { xp: 40, tiempo: 0.15 }, txt: '+mucha experiencia, se atrasan', cauta: true },
      { label: 'Espantarlo', ef: { riesgo: 0.3, perder: 0.04 }, txt: 'nada bueno' }] },
    { id: 'mercenarios', name: 'Mercenarios', desc: 'Cobran por acompañarlos hasta el destino.', era: 3, ops: [
      { label: 'Contratarlos', ef: { costo: { gold: 90 }, fuerza: 0.1 }, txt: '+10% de fuerza en esta salida' },
      { label: 'Rechazarlos', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'reliquia', name: 'Reliquia en el barro', desc: 'Algo dorado asoma en una huella de carreta.', ops: [
      { label: 'Desenterrarla', ef: { tiempo: 0.1, objeto: 0.6 }, txt: 'quizás un objeto', cauta: true },
      { label: 'Dejarla', ef: {}, txt: 'nada' }] },
    { id: 'aldea', name: 'Aldea en problemas', desc: 'Les falta comida para el invierno.', ops: [
      { label: 'Compartir provisiones', ef: { costo: { food: 100 }, xp: 25, botin: { gems: 2 } }, txt: 'te regalan gemas; +experiencia', cauta: true },
      { label: 'Seguir', ef: {}, txt: 'nada' }] },
    { id: 'gigante', name: 'Gigante dormido', desc: 'Ronca atravesado en el camino.', era: 4, ops: [
      { label: 'Pasar en silencio', ef: { riesgo: 0.3, perder: 0.05 }, txt: 'si despierta, golpea' },
      { label: 'Rodear', ef: { tiempo: 0.35 }, txt: 'el viaje se alarga', cauta: true }] },
    { id: 'alquimista', name: 'Alquimista', desc: 'Vende frascos que brillan.', era: 3, ops: [
      { label: 'Comprar un elixir', ef: { costo: { gold: 70 }, fuerza: 0.08, xp: 10 }, txt: '+8% de fuerza en esta salida' },
      { label: 'Seguir', ef: {}, txt: 'nada', cauta: true }] },
    { id: 'tesoro', name: 'Cofre a la vista', desc: 'Un cofre en lo alto de un barranco.', ops: [
      { label: 'Trepar', ef: { riesgo: 0.4, perder: 0.03, botin: { gold: 70, gems: 3 } }, txt: 'oro y gemas, con riesgo' },
      { label: 'Dejarlo', ef: {}, txt: 'nada', cauta: true }] },
  ];
  const escala = () => Math.pow(1.6, Math.max(0, S().era - 1));
  const costoDe = op => { const c = {}; for (const r in op.ef.costo || {}) c[r] = Math.round(op.ef.costo[r] * escala()); return c; };
  const puede = op => !op.ef.costo || G().canAfford(costoDe(op));

  // ---------- En el viaje ----------
  // Cuántos encuentros y en qué parte del viaje de ida (fracción).
  A.puntos = r => (!r.heroe || !PK.Heroes || r.travel < 60 ? [] : r.travel >= 240 ? [0.35, 0.7] : [0.5]);
  A.update = function (r, offline) {
    if (r.phase !== 'go' || (r.inc && r.inc.llego)) return;
    const now = G().ahora(), pts = A.puntos(r);
    r.encN = r.encN || 0;
    if (r.enc) { if (offline || now >= r.enc.hasta || now >= r.arrive) A.elegir(r.id, r.enc.ops.findIndex(o => o.cauta), true); return; }
    if (r.encN >= pts.length) return;
    const f = 1 - (r.arrive - now) / Math.max(1, r.travel * 1000);
    if (f < pts[r.encN]) return;
    const rng = U.rng(r.id * 7919 + r.encN * 131 + 17), pool = A.ENCUENTROS.filter(e => (e.era || 0) <= S().era), c = pool[Math.floor(rng() * pool.length)];
    r.enc = { id: c.id, n: r.encN, hasta: now + 60000, ops: c.ops.map(o => ({ label: o.label, cauta: !!o.cauta })) };
    r.encN++;
    if (offline) { A.elegir(r.id, r.enc.ops.findIndex(o => o.cauta), true); return; }
    toast('En el camino a ' + r.name + ': ' + c.name + '.', 'quest', { label: 'Decidir', fn: () => A.open(r.id) });
  };
  A.elegir = function (id, i, sola) {
    const r = S().exp.runs.find(o => o.id === id);
    if (!r || !r.enc) return false;
    const c = A.ENCUENTROS.find(e => e.id === r.enc.id), op = c && c.ops[i];
    if (!op) { r.enc = null; return false; }
    if (!puede(op)) {
      if (!sola) { toast('Te falta para eso.', 'warn'); return false; }
      // la segura cuesta y no alcanza: la más tranquila de las que no cuestan
      const j = c.ops.map((o, k) => [k, o]).filter(([, o]) => !o.ef.costo).sort((x, y) => ((x[1].ef.riesgo || 0) * (x[1].ef.perder || 0)) - ((y[1].ef.riesgo || 0) * (y[1].ef.perder || 0)))[0];
      return A.elegir(id, j ? j[0] : 0, true);
    }
    const rng = U.rng(r.id * 104729 + r.enc.n * 977 + i), ef = op.ef, notas = [];
    if (ef.costo) G().pay(costoDe(op));
    const malo = ef.riesgo ? rng() < ef.riesgo : !!ef.perder;
    if (ef.perder && malo) {
      let n = 0;
      for (const k in r.units) {
        const l = Math.min(r.units[k], Math.round(r.units[k] * ef.perder));
        r.units[k] -= l; n += l;
        if (r.inc) r.inc.perdidos[k] = (r.inc.perdidos[k] || 0) + l;
        else if (l) { r.encPerdidos = r.encPerdidos || {}; r.encPerdidos[k] = (r.encPerdidos[k] || 0) + l; } // para el informe (cerrar)
      }
      if (n) { r.power = Math.round(r.power * (1 - ef.perder)); notas.push('perdiste ' + n + ' soldado' + (n > 1 ? 's' : '')); }
    }
    if (ef.fuerza) { if (r.inc) r.inc.bend += ef.fuerza; else { r.power = Math.round(r.power * (1 + ef.fuerza)); r.encFuerza = (r.encFuerza || 1) * (1 + ef.fuerza); } notas.push('+' + Math.round(ef.fuerza * 100) + '% de fuerza'); }
    if (ef.tiempo) { const left = Math.max(0, r.arrive - G().ahora()); r.arrive += left * ef.tiempo; notas.push('el viaje se alarga'); }
    if (ef.botin && !(ef.riesgo && malo && ef.perder)) {
      const b = {}; for (const k in ef.botin) b[k] = Math.round(ef.botin[k] * escala());
      r.encBotin = r.encBotin || {};
      for (const k in b) r.encBotin[k] = (r.encBotin[k] || 0) + b[k];
      notas.push('+' + Object.keys(b).map(k => U.fmt(b[k]) + ' de ' + D.RES[k].name.toLowerCase()).join(', ') + ' al volver');
    }
    if (ef.xp && H()) { const h = H().de(r.heroe); if (h) { H().darXp(h, ef.xp); notas.push('+' + ef.xp + ' de experiencia'); } }
    if (ef.objeto && H() && rng() < ef.objeto) { (r.encObjetos = r.encObjetos || []).push(H().crearObjeto(0.4, 0)); notas.push('un objeto'); }
    if (ef.mapa && rng() < ef.mapa) { A.nuevoMapa('encuentro', r.id * 31 + r.enc.n); notas.push('un mapa del tesoro'); }
    if (ef.tropa) { r.encTropa = (r.encTropa || 0) + ef.tropa; notas.push('+' + ef.tropa + (D.ARMY.militia ? ' milicianos' : ' soldados') + ' al volver'); }
    G().stat('encounters', 1);
    (r.encLog = r.encLog || []).push(c.name + ': ' + op.label.toLowerCase() + (notas.length ? ' (' + notas.join(', ') + ')' : ''));
    r.enc = null;
    if (!sola && !G().offline) toast(c.name + ': ' + (notas.length ? notas.join(', ') : 'siguen su camino') + '.', malo && ef.perder ? 'warn' : 'good');
    return true;
  };
  A.tropaBasica = () => (D.ARMY.militia ? 'militia' : D.ARMY.infanteria ? 'infanteria' : Object.keys(D.ARMY)[0]);
  // Al volver al Cuartel: lo juntado en el camino (lo llama arrive en expeditions.js).
  A.volver = function (r) {
    if (r.encBotin) G().give(r.encBotin);
    // La tropa básica del mundo: en el mar no hay milicianos, y un `militia` en la Flota rompía Social.power para siempre.
    if (r.encTropa) { const k = A.tropaBasica(); if (k) S().war.army[k] = (S().war.army[k] || 0) + r.encTropa; }
    if (r.encObjetos && H()) for (const o of r.encObjetos) H().guardarObjeto(o);
  };

  A.open = function (id) {
    const UI = PK.UI;
    UI.modal('encuentro', 'En el camino', body => {
      const r = S().exp.runs.find(o => o.id === id);
      if (!r || !r.enc) { body.append(el('p', null, 'Ya siguieron su camino.')); return; }
      const c = A.ENCUENTROS.find(e => e.id === r.enc.id), h = H() && H().de(r.heroe);
      body.append(el('div', { class: 'enc-cab' }, h ? H().retratoEl(h, 'grande') : '', el('div', null, el('h3', null, c.name), el('p', null, c.desc),
        el('p', { class: 'small muted' }, 'Rumbo a ' + r.name + (h ? ', con ' : ''), h ? el('b', { translate: 'no' }, h.nombre) : '', '. Si no eliges en ' + U.fmtTime(Math.max(0, (r.enc.hasta - Date.now()) / 1000)) + ', van por lo seguro.'))));
      body.append(el('div', { class: 'enc-ops' }, c.ops.map((op, i) => {
        const cost = costoDe(op), riesgo = op.ef.riesgo ? Math.round(op.ef.riesgo * 100) + '% de riesgo' : '';
        return el('div', { class: 'enc-op' + (op.cauta ? ' cauta' : '') }, el('b', null, op.label), el('span', { class: 'small' }, op.txt + (riesgo ? ' (' + riesgo + ')' : '') + (op.cauta ? ' · la segura' : '')),
          Object.keys(cost).length ? UI.costEl(cost) : '',
          UI.btn('Elegir', () => { if (A.elegir(r.id, i)) UI.closeModal(); else UI.rerender(); }, { small: true, cls: 'gold', disabled: !puede(op) }));
      })));
    }, { wide: true });
  };

  // ---------- Mapas del tesoro (H7) ----------
  A.init = function (st) { st.mapas = st.mapas || []; };
  // Una casilla en la niebla, a buena distancia, elegida con semilla (la misma ruina da siempre el mismo mapa).
  A.nuevoMapa = function (de, semilla) {
    const st = S(), [hx, hy] = D.PLAYER_HOME, rng = U.rng(U.strHash(de + ':' + semilla + ':' + (st.created || 0)));
    const rMax = Math.max(24, (G().exploreRange() || 20) + 8);
    let pos = null;
    for (let k = 0; k < 200 && !pos; k++) {
      const a = rng() * Math.PI * 2, d = 12 + rng() * (rMax - 12), x = Math.round(hx + Math.cos(a) * d), y = Math.round(hy + Math.sin(a) * d);
      if (W.inb(x, y) && W.passable(x, y) && (!W.fog[W.idx(x, y)] || k > 150)) pos = [x, y];
    }
    if (!pos) return null;
    const m = { id: (st.mapas.reduce((a, o) => Math.max(a, o.id), 0) || 0) + 1, x: pos[0], y: pos[1], de, s: Math.floor(rng() * 1e9) };
    st.mapas.push(m);
    G().stat('maps_found', 1);
    toast('¡Un mapa del tesoro! Marca un lugar ' + (W.fog[W.idx(m.x, m.y)] ? 'ya descubierto' : 'en la niebla') + ': mira la X en el minimapa.', 'epic', { label: 'Ver', fn: () => A.openMapas() });
    return m;
  };
  A.mapaDeRuina = function (p) {
    const st = S();
    if (st.flags['mapa_ruina_' + p.id]) return;
    st.flags['mapa_ruina_' + p.id] = 1;
    if (U.rng(p.id * 613 + (st.created || 0) % 997)() < 0.35) A.nuevoMapa('ruina', p.id);
  };
  // Desenterrar: un cofre con oro, gemas y un objeto raro o mejor.
  A.desenterrar = function (m, h) {
    const st = S(), i = st.mapas.indexOf(m);
    if (i < 0) return;
    st.mapas.splice(i, 1);
    const r = { gold: Math.round(150 * escala()), gems: 5 * st.era, coins: 5 };
    G().give(r);
    let it = null;
    if (H()) { const o = H().crearObjeto(0.7, 1 + (h ? H().efecto(h, 'suerte') : 0)); if (o.r < 1) o.r = 1; it = H().guardarObjeto(o); }
    if (h && H()) H().darXp(h, 30);
    G().stat('treasures', 1);
    toast('¡' + (h ? h.nombre : 'Tu explorador') + ' desenterró el tesoro! +' + U.fmt(r.gold) + ' de oro, +' + r.gems + ' gemas' + (it ? ' y ' + H().itemNombre(it) + ' (' + H().RAREZAS[it.r].name + ')' : '') + '.', 'epic', it ? { label: 'Ver', fn: () => H().open('inv') } : null);
    if (PK.Sfx) PK.Sfx.play('level');
  };
  A.buscarConExplorador = function (m) {
    if (W.fog[W.idx(m.x, m.y)]) { A.desenterrar(m, null); return; }
    G().ponerBandera(m.x, m.y);
  };
  A.viajeHeroe = (m, h) => Math.round((40 + U.dist(m.x, m.y, D.PLAYER_HOME[0], D.PLAYER_HOME[1]) * 3) * (h ? H().viaje(h) : 1));
  A.mandarHeroe = function (m, h) {
    if (!h || h.estado !== 'libre') return false;
    h.estado = 'explora'; h.mapa = m.id; h.hasta = Date.now() + A.viajeHeroe(m, h) * 1000;
    m.heroe = h.id;
    toast(h.nombre + ' sale a buscar el tesoro (' + U.fmtTime(A.viajeHeroe(m, h)) + ').', 'good');
    return true;
  };
  let t1 = 0;
  A.tick = function (dt) {
    const st = S();
    if (!st || !st.mapas || (t1 += dt) < 2) return;
    t1 = 0;
    // W.fog[i] verdadero = ya descubierto. El explorador desentierra el que estaba en la niebla y quedó a la vista
    // (oculto: lo estaba); el que salió ya descubierto se desentierra con el botón.
    for (const m of st.mapas.slice()) if (!m.heroe && W.fog[W.idx(m.x, m.y)] && m.oculto) A.desenterrar(m, null);
    for (const m of st.mapas) if (!m.heroe && !W.fog[W.idx(m.x, m.y)]) m.oculto = 1;
    // los héroes que fueron a buscar uno
    if (H()) for (const h of H().lista()) if (h.estado === 'explora' && Date.now() >= h.hasta) {
      const m = st.mapas.find(o => o.id === h.mapa);
      h.estado = 'libre'; h.mapa = null;
      if (m) A.desenterrar(m, h);
    }
  };

  A.openMapas = function () {
    const UI = PK.UI;
    UI.modal('mapas', 'Mapas del tesoro', body => {
      const st = S(), ms = st.mapas || [];
      body.append(el('p', { class: 'small' }, 'Salen de las ruinas, de los encuentros en el camino y del Mercader de mapas. La X está en el minimapa. Tu explorador lo desentierra al descubrir ese lugar (una bandera lo lleva); un héroe puede ir a buscarlo.'));
      if (!ms.length) { body.append(el('p', { class: 'muted small' }, 'No tienes mapas por ahora.')); return; }
      for (const m of ms) {
        const h = m.heroe && H() ? H().de(m.heroe) : null, libre = H() ? H().libres()[0] : null;
        body.append(el('div', { class: 'run-row' }, el('span', { class: 'run-ic' }, '✕'),
          el('div', { class: 'dg-info' }, el('b', null, 'Mapa ' + (m.de === 'ruina' ? 'de unas ruinas' : m.de === 'mercader' ? 'del mercader' : 'del camino')),
            el('div', { class: 'small muted' }, h ? 'Lo busca ' + h.nombre + ' (' + U.fmtTime(Math.max(0, (h.hasta - Date.now()) / 1000)) + ')' : W.fog[W.idx(m.x, m.y)] ? 'El lugar ya está a la vista: tu explorador lo puede desenterrar.' : 'En la niebla, a ' + Math.round(U.dist(m.x, m.y, D.PLAYER_HOME[0], D.PLAYER_HOME[1])) + ' casillas.')),
          el('span', { class: 'row' },
            h ? '' : UI.btn(W.fog[W.idx(m.x, m.y)] ? 'Desenterrar' : 'Bandera', () => { A.buscarConExplorador(m); UI.rerender(); }, { small: true, cls: 'gold', title: 'Tu explorador irá hacia allá' }),
            h || !libre ? '' : UI.btn('Mandar a ' + libre.nombre, () => { A.mandarHeroe(m, libre); UI.rerender(); }, { small: true, title: 'Viaje de ' + U.fmtTime(A.viajeHeroe(m, libre)) }),
            UI.btn('Ver', () => { UI.closeModal(); PK.Render.centerOn(m.x, m.y); }, { small: true }))));
      }
    });
  };
})();
