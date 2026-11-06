// La Regata de la Bruma y los duelos navales (Fase 9 «d», pk-30). Solo en el archipiélago.
// La regata: mejoras tu barco (casco, velas, timón) con lo del mar, eliges ruta según la marea y el viento de ese
// momento, y el servidor calcula el tiempo (D.regataTiempo, la misma fórmula que se ve aquí). El mejor tiempo de la
// semana cuenta para tu liga (Bronce, Plata, Oro, Bruma): cada lunes los mejores ascienden y todos cobran.
// Los duelos: anotas tu flota de duelo con lo que tienes en casa y desafías la de otro jugador; el servidor decide
// (fuerza, y qué barcos le ganan a cuáles). No se pierde ningún barco: se juegan trofeos.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, Sp = PK.Sprites;
  const Rg = (PK.Regata = { info: null, duelos: null, ultimo: null, tab: 'regata' });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const UI = () => PK.UI;
  const toast = (t, k) => UI().toast(t, k);

  // ---------- Tu barco ----------
  const BASE = { casco: { tablazon: 30, wood: 150 }, velas: { lona: 25, fibra: 60 }, timon: { tablazon: 20, especias: 3 } };
  Rg.barco = () => { const st = S(); st.regata = st.regata || { casco: 0, velas: 0, timon: 0 }; return st.regata; };
  Rg.costo = function (parte, L) { const c = {}; for (const r in BASE[parte]) c[r] = Math.max(5, Math.round((BASE[parte][r] * (L + 1) * Math.pow(1.25, L)) / 5) * 5); return c; };
  Rg.mejorar = function (parte) {
    const b = Rg.barco(), L = b[parte] || 0;
    if (L >= D.REGATA.maxNivel) return;
    const c = Rg.costo(parte, L);
    if (!G().canAfford(c)) { toast('Te falta para mejorar ' + D.REGATA.partes[parte].name.toLowerCase() + '.', 'warn'); return; }
    G().pay(c);
    b[parte] = L + 1;
    G().stat('regata_mejoras', 1);
    UI().rerender();
  };

  // ---------- Servidor ----------
  const enLinea = () => !!(PK.Net && PK.Net.online);
  async function pide(ruta, body) {
    try { return await PK.Net.api('POST', ruta, body || {}); } catch (e) { toast(e.message || 'No se pudo hablar con el servidor.', 'warn'); return null; }
  }
  Rg.refrescar = async function () {
    if (!enLinea()) return;
    const [a, b] = await Promise.all([pide('/api/regata/info'), pide('/api/duelos')]);
    if (a) Rg.info = a;
    if (b) Rg.duelos = b;
    if (UI().modalKey() === 'regata') UI().rerender();
  };
  Rg.correr = async function (ruta) {
    const r = await pide('/api/regata', { ruta, barco: Rg.barco() });
    if (!r) return;
    Rg.info = r; Rg.ultimo = r;
    G().stat('regatas', 1);
    toast('Regata por ' + D.REGATA.rutas[ruta].name.toLowerCase() + ': ' + seg(r.tiempo) + (r.record ? ' · ¡tu mejor tiempo de la semana!' : '') + '.', r.record ? 'epic' : 'info');
    UI().rerender();
  };
  Rg.anotar = async function () {
    const army = S().war.army, units = {};
    for (const k in D.DUELO.poder) if (army[k] > 0) units[k] = army[k];
    if (!Object.keys(units).length) { toast('No tienes barcos en casa para anotar.', 'warn'); return; }
    const r = await pide('/api/flota', { units });
    if (r) { Rg.duelos = r; toast('Tu flota de duelo quedó anotada: ' + U.fmt(r.flota.poder) + ' de poder.', 'good'); UI().rerender(); }
  };
  Rg.desafiar = async function (id) {
    const r = await pide('/api/duelo', { id });
    if (!r) return;
    Rg.duelos = r;
    const x = r.resultado;
    G().stat('duelos', 1);
    if (x.gano) G().stat('duelos_ganados', 1);
    toast((x.gano ? '¡Ganaste el duelo contra ' : 'Perdiste el duelo contra ') + x.rival + ' (' + (x.trofeos > 0 ? '+' : '') + x.trofeos + ' trofeos).', x.gano ? 'epic' : 'bad');
    UI().rerender();
  };

  // ---------- Ventana ----------
  const seg = t => (t || 0).toFixed(1).replace('.', ',') + ' s';
  Rg.abrir = function (tab) {
    if (tab) Rg.tab = tab;
    UI().modal('regata', 'Regata de la Bruma', body => {
      const tabs = el('div', { class: 'book-tabs bar-tabs' });
      for (const [id, name] of [['regata', 'Regata'], ['duelos', 'Duelos navales']]) tabs.append(el('button', { class: 'book-tab' + (Rg.tab === id ? ' on' : ''), onclick: () => { Rg.tab = id; UI().rerender(true); } }, name));
      body.append(tabs);
      if (!enLinea()) { body.append(el('div', { class: 'empty-box' }, el('div', null, el('b', null, 'Se juega contra otros jugadores.'), el('p', { class: 'small' }, 'Conéctate al servidor del mundo compartido para correr la Regata y los duelos navales. Mientras tanto puedes mejorar tu barco.')))); }
      if (Rg.tab === 'duelos') duelosTab(body); else regataTab(body);
    }, { wide: true });
    Rg.refrescar();
  };
  function marAhora() {
    const t = Date.now(), m = D.marea(t), v = D.vientoMar(t), tor = D.tormenta(t);
    return el('div', { class: 'rg-mar small' }, el('span', null, '🌊 ' + (D.mareaBaja(t) ? 'Bajamar' : m > 0.75 ? 'Pleamar' : 'Marea alta')), ' · ', el('span', null, '⛵ Viento ' + Math.round(v * 100) + '%'), tor ? el('b', { class: 'warn-t' }, ' · ⛈ Tormenta') : '');
  }
  function regataTab(body) {
    const b = Rg.barco(), inf = Rg.info, t = Date.now();
    body.append(el('p', { class: 'small' }, 'Tres regatas por día. Cuenta tu mejor tiempo de la semana; cada lunes los mejores de tu liga ascienden y todos los que corrieron cobran monedas.'));
    if (inf) body.append(el('div', { class: 'rg-top' }, el('b', null, 'Liga ' + inf.ligaName), ' · mejor tiempo: ' + (inf.mejor ? seg(inf.mejor) : '—') + ' · hoy ' + inf.hoy + '/' + inf.porDia + (inf.puesto ? ' · ' + inf.puesto + '.º de ' + inf.de : '')));
    // el barco
    const partes = el('div', { class: 'rg-partes' });
    for (const k in D.REGATA.partes) {
      const P = D.REGATA.partes[k], L = b[k] || 0, max = L >= D.REGATA.maxNivel, c = Rg.costo(k, L);
      partes.append(el('div', { class: 'rg-parte' }, el('b', null, P.name + ' ' + L + '/' + D.REGATA.maxNivel), el('span', { class: 'small muted' }, P.desc),
        el('div', { class: 'bar thin' }, el('div', { class: 'fill gold', style: { width: (L / D.REGATA.maxNivel) * 100 + '%' } })),
        max ? el('span', { class: 'small good-t' }, 'Al máximo') : el('div', { class: 'row' }, UI().costEl(c), UI().btn('Mejorar', () => Rg.mejorar(k), { small: true, cls: 'gold', disabled: !G().canAfford(c) }))));
    }
    body.append(el('h3', null, 'Tu barco'), partes);
    // las rutas, con el tiempo que darían ahora
    body.append(el('h3', null, 'Rutas'), marAhora());
    const rutas = el('div', { class: 'rg-rutas' });
    for (const id in D.REGATA.rutas) {
      const R = D.REGATA.rutas[id], est = D.regataTiempo(b, id, t, 1);
      rutas.append(el('div', { class: 'rg-ruta' }, el('b', null, R.name), el('span', { class: 'small' }, R.desc), el('span', null, 'Ahora: unos ', el('b', null, seg(est))),
        UI().btn('Zarpar', () => Rg.correr(id), { small: true, cls: 'gold', disabled: !enLinea() || (inf && inf.hoy >= inf.porDia) })));
    }
    body.append(rutas);
    if (Rg.ultimo) body.append(carrera(Rg.ultimo));
    if (inf && inf.tabla && inf.tabla.length) body.append(el('h3', null, 'Liga ' + inf.ligaName + ' · esta semana'), el('ol', { class: 'rank' }, inf.tabla.map(o => el('li', { class: o.me ? 'me' : '' }, el('span', { translate: 'no' }, o.name), el('span', null, seg(o.mejor))))));
  }
  // la última regata, animada: tu barco contra tu mejor tiempo de la semana
  function carrera(r) {
    const c = el('canvas', { class: 'rg-carrera', width: 320, height: 70 }), x = c.getContext('2d'), t0 = performance.now(), dur = 3200;
    const spr = PK.Armada && PK.Armada.dibujo('balandra', false, 0);
    const pinta = () => {
      if (!c.isConnected && performance.now() - t0 > 200) return;
      const k = Math.min(1, (performance.now() - t0) / dur), g = x.createLinearGradient(0, 0, 0, 70);
      g.addColorStop(0, '#3a86b4'); g.addColorStop(1, '#1d5a84'); x.fillStyle = g; x.fillRect(0, 0, 320, 70);
      for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect((i * 53 + performance.now() / 30) % 320, 10 + (i * 17) % 55, 4, 1); }
      x.fillStyle = '#f0e0b0'; x.fillRect(300, 4, 3, 62); // la meta
      const fb = r.mejor && r.mejor < r.tiempo ? Math.min(1, k * r.tiempo / r.mejor) : null;
      if (fb !== null) { x.globalAlpha = 0.4; if (spr) x.drawImage(spr.c, 8 + fb * 280 - spr.ax, 18 - spr.ay + 14); x.globalAlpha = 1; }
      if (spr) x.drawImage(spr.c, 8 + k * 280 - spr.ax, 46 - spr.ay + 14);
      x.fillStyle = '#fff'; x.font = '10px monospace'; x.fillText(seg(r.tiempo * k), 6, 66);
      if (k < 1) requestAnimationFrame(pinta);
    };
    requestAnimationFrame(pinta);
    return el('div', { class: 'rg-ultima' }, el('b', null, 'Última regata: ' + seg(r.tiempo) + (r.record ? ' · ¡récord de la semana!' : '')), c,
      el('div', { class: 'small muted' }, 'Marea ' + Math.round(r.marea * 100) + '%, viento ' + Math.round(r.viento * 100) + '%' + (r.tormenta ? ', con tormenta' : '') + '.' +
        (Object.keys(D.REGATA.partes).some(k => (r.barcoUsado[k] || 0) < (Rg.barco()[k] || 0)) ? ' El servidor deja subir el barco de a poco: corrió con ' + Object.keys(D.REGATA.partes).map(k => D.REGATA.partes[k].name.toLowerCase() + ' ' + r.barcoUsado[k]).join(', ') + '.' : '')));
  }
  function duelosTab(body) {
    const d = Rg.duelos, army = S().war.army, mia = {};
    for (const k in D.DUELO.poder) if (army[k] > 0) mia[k] = army[k];
    body.append(el('p', { class: 'small' }, 'Anota tu flota de duelo con los barcos que tienes en casa y desafía la de otros jugadores: decide el servidor, por la fuerza y por qué barcos le ganan a cuáles (brulotes a galeones, galeones a balandras, fragatas a los botes, balandras a brulotes). Nadie pierde barcos: se juegan trofeos. Cinco duelos por día.'));
    if (!d) { body.append(el('p', { class: 'muted' }, enLinea() ? 'Cargando…' : '')); return; }
    body.append(el('div', { class: 'rg-top' }, el('b', null, '🏆 ' + d.trofeos + ' trofeos'), ' · ganados ' + d.gan + ', perdidos ' + d.per + ' · hoy ' + d.hoy + '/' + d.porDia));
    body.append(el('h3', null, 'Tu flota de duelo'),
      d.flota ? el('div', { class: 'as-chips' }, Object.keys(d.flota.units).filter(k => d.flota.units[k] > 0).map(k => el('span', { class: 'as-chip' }, el('img', { class: 'ico', src: Sp.troopIcon(k), alt: '' }), String(d.flota.units[k]))), el('span', { class: 'small muted' }, ' poder ' + U.fmt(d.flota.poder))) : el('p', { class: 'small muted' }, 'Todavía no anotaste una.'),
      el('div', { class: 'row' }, UI().btn('Anotar la flota que tengo en casa (' + U.fmt(D.dueloPoder(mia)) + ')', () => Rg.anotar(), { small: true, cls: 'gold', disabled: !Object.keys(mia).length })));
    body.append(el('h3', null, 'Rivales'));
    if (!d.rivales.length) body.append(el('p', { class: 'small muted' }, 'Todavía nadie más anotó una flota.'));
    for (const o of d.rivales) {
      const ch = d.flota ? U.clamp(0.5 + (d.flota.poder / Math.max(1, o.poder) - 1) * 0.9, 0.05, 0.95) : 0;
      body.append(el('div', { class: 'raid-row' }, el('div', { class: 'dg-info' }, el('b', { translate: 'no' }, o.name), el('div', { class: 'small muted' }, '🏆 ' + o.trofeos + ' · poder aprox. ' + U.fmt(o.poder) + (d.flota ? ' · probabilidad aprox. ' + Math.round(ch * 100) + '%' : ''))),
        UI().btn('Desafiar', () => Rg.desafiar(o.id), { small: true, cls: 'gold', disabled: !d.flota || d.hoy >= d.porDia })));
    }
    if (d.hist && d.hist.length) body.append(el('h3', null, 'Últimos duelos'), el('ul', { class: 'small' }, d.hist.map(h => el('li', null, (h.gano ? '✔ ' : '✘ ') + (h.defensa ? 'Te atacó ' : 'Contra ') + h.rival + ' (' + (h.trofeos > 0 ? '+' : '') + h.trofeos + ')'))));
  }
})();
