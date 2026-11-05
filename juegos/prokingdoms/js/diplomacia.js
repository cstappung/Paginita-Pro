// Diplomacia con los reinos (Fase 5, S1, pk-23). La decide server/sim.js (diploDe, diploPropose, diploGift,
// diploEvento): aquí se guarda lo último que mandó el servidor (llega en el sync solo cuando cambió su versión),
// se piden las acciones y se dibuja el escudo de cada reino. Sin servidor (modo local) no hay diplomacia: la
// ventana Reinos dice «Requiere conexión».
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const Dp = (PK.Diplo = { info: null, v: 0 });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);
  const rerender = () => { if (PK.UI && PK.UI.modalKey && PK.UI.modalKey() === 'realms') PK.UI.rerender(); };

  Dp.activa = () => !!(PK.Net && PK.Net.online && Dp.info);
  Dp.desdeSync = function (r) {
    if (!r.diplo) return;
    Dp.info = r.diplo; Dp.v = r.diplo.v;
    rerender();
  };
  Dp.de = slot => (Dp.info && Dp.info.s[slot]) || null;
  Dp.pacto = slot => (Dp.de(slot) || {}).pacto || null;
  Dp.tratado = () => !!(Dp.info && Object.values(Dp.info.s).some(e => e.tratado));
  Dp.aliados = () => (Dp.info ? Object.keys(Dp.info.s).map(Number).filter(k => Dp.info.s[k].pacto === 'alianza') : []);
  Dp.esHumano = slot => { const b = D.BOTS.find(o => o.slot === slot); return !!(b && b.human); };
  Dp.pers = slot => (Dp.esHumano(slot) ? null : (D.REALM_SLOTS[slot] && D.REALM_SLOTS[slot].bot.pers) || null);
  Dp.nombre = slot => { const b = D.BOTS.find(o => o.slot === slot); return b ? b.realm : '?'; };
  // Lo que pediría un reino simulado para aceptar (null si aceptaría ahora); con un jugador, solo el estado.
  Dp.porQueNo = function (slot, pacto) {
    const e = Dp.de(slot);
    if (!e) return 'Requiere conexión.';
    const pers = Dp.pers(slot);
    return D.diploAcepta(pers || 'sabio', pers ? e : Object.assign({}, e, { rel: 100 }), pacto, Dp.aliados().length);
  };
  // Tamaños de regalo: medio, uno y dos «escalones» de la era, al precio del Mercado.
  const precio = r => (r === 'gold' ? 100 : (S().market.p[r] || D.MARKET_BASE[r] || 100));
  Dp.regaloN = (res, k) => Math.max(10, Math.round((D.diploEscala(S().era) * (k || 1) * 100) / precio(res) / 10) * 10);
  Dp.regaloGana = (slot, res, n) => (Dp.pers(slot) ? D.regaloRel(precio(res) * n / 100, S().era, Dp.pers(slot), res) : 0);

  // ---------- Pedidos al servidor ----------
  async function llamar(ruta, body) {
    try {
      const r = await PK.Net.api('POST', ruta, body);
      if (r.diplo) { Dp.info = r.diplo; Dp.v = r.diplo.v; }
      if (r.inbox && PK.Net.applyInbox) PK.Net.applyInbox(r.inbox);
      return r;
    } catch (e) {
      toast((e && e.message) || 'No se pudo hablar con el servidor.', 'warn');
      return null;
    } finally { rerender(); }
  }
  Dp.proponer = async function (slot, pacto) {
    const r = await llamar('/api/diplo/propose', { slot, pacto });
    if (!r) return;
    if (r.ok) { toast(r.txt, pacto === 'rival' || pacto === 'romper' ? 'warn' : 'good'); if (pacto !== 'rival' && pacto !== 'romper') G().stat('pactos', 1); if (PK.Sfx) PK.Sfx.play(pacto === 'rival' ? 'cuerno' : 'level'); }
    else toast(r.motivo, 'warn');
  };
  Dp.aceptar = async function (id, si) {
    const r = await llamar('/api/diplo/accept', { id, si });
    if (r) toast(r.ok ? r.txt : r.motivo, r.ok ? 'good' : 'warn');
  };
  Dp.regalar = async function (slot, res, n) {
    const st = S();
    n = Math.min(Math.floor(n), Math.floor(st.res[res] || 0));
    if (n <= 0) { toast('No tienes de eso en tu bodega.', 'warn'); return; }
    st.res[res] -= n; // se reserva y se devuelve lo que no se mandó
    const r = await llamar('/api/diplo/gift', { slot, res, n });
    if (!r) { st.res[res] += n; return; }
    st.res[res] += n - (r.accepted || 0);
    G().stat('regalos', 1);
    toast('Regalo entregado a ' + Dp.nombre(slot) + (r.gana ? ': relación +' + U.fmt(r.gana) + '.' : '.') + (r.txt ? ' ' + r.txt : ''), 'good');
  };
  Dp.responder = async function (acc) {
    const ev = Dp.info && Dp.info.ev;
    if (!ev) return;
    const r = await llamar('/api/diplo/evento', { id: ev.id, acc });
    if (!r) return;
    if (r.paga) { const st = S(); for (const k in r.paga) st.res[k] = Math.max(0, (st.res[k] || 0) - r.paga[k]); }
    if (r.txt) toast(r.txt, 'good');
  };

  // ---------- Buzón: lo que llega de la diplomacia ----------
  Dp.recibir = function (it) {
    const g = G(), st = S();
    if (it.res) g.give(it.res);
    if (it.tropas) { for (const k in it.tropas) if (D.ARMY[k]) st.war.army[k] = (st.war.army[k] || 0) + it.tropas[k]; }
    const extra = it.res ? ' ' + Object.keys(it.res).map(k => '+' + U.fmt(it.res[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', ') + '.' : it.tropas ? ' ' + Object.keys(it.tropas).map(k => '+' + it.tropas[k] + ' ' + D.ARMY[k].name.toLowerCase()).join(', ') + '.' : '';
    toast(it.text + extra, it.urgente ? 'bad' : it.res || it.tropas ? 'good' : 'info', it.ev || /propone/.test(it.text) ? { label: 'Ver', fn: () => PK.UI.openRealms() } : null);
    if (PK.Social.log) PK.Social.log(it.text + extra, it.urgente ? 'bad' : 'info');
    if (it.urgente) { if (PK.Notify) PK.Notify.now('Ultimátum', it.text); if (PK.Sfx) PK.Sfx.play('cuerno'); }
  };

  // ---------- Escudo de cada reino (14×16, dibujado por código) ----------
  const CARGA = {
    comerciante: ['.GGG.', 'GG.GG', 'G.G.G', 'GG.GG', '.GGG.'],
    conquistador: ['..W..', '..W..', '..W..', '..W..', 'WWWWW', '..W..', '..G..'],
    sabio: ['..G..', '..G..', 'GGGGG', '.GGG.', '.G.G.'],
    ermitano: ['..W..', '.WWW.', 'WWWWW', '.WWW.', 'WWWWW', '..B..'],
    humano: ['G.G.G', 'GGGGG', 'GGGGG'],
  };
  const cache = {};
  Dp.escudo = function (slot, alto) {
    const pers = Dp.pers(slot) || 'humano', col = (D.REALM_SLOTS[slot] || {}).color || [120, 120, 120], pt = PK.Sprites.daltonico() ? PK.Sprites.patronDe(slot) : -1, key = slot + ':' + pers + ':' + pt;
    if (!cache[key]) {
      const c = document.createElement('canvas');
      c.width = 14; c.height = 16;
      const x = c.getContext('2d'), ancho = y => (y < 10 ? 0 : y - 9); // cuánto se angosta cada fila hacia la punta
      const rgb = k => 'rgb(' + col.map(v => U.clamp(Math.round(v * k), 0, 255)).join(',') + ')';
      for (let y = 0; y < 16; y++) {
        const i = ancho(y), a = i, b = 13 - i;
        if (a > b) continue;
        x.fillStyle = '#1d120a'; x.fillRect(a, y, b - a + 1, 1);
        if (y > 0 && y < 15 && b - a >= 2) { x.fillStyle = y < 4 ? rgb(1.25) : rgb(1); x.fillRect(a + 1, y, b - a - 1, 1); }
      }
      if (pt >= 0) { // daltonismo: el campo lleva el patrón del reino (el mismo del mapa)
        x.fillStyle = rgb(0.62);
        for (let y = 5; y < 15; y++) { const i = ancho(y); for (let k = i + 1; k < 13 - i; k++) if (PK.Sprites.enPatron(pt, k, y)) x.fillRect(k, y, 1, 1); }
      }
      x.fillStyle = rgb(0.75); x.fillRect(1, 4, 12, 1); // la franja bajo el jefe del escudo
      const m = CARGA[pers], top = pers === 'humano' ? 6 : 5, left = 4;
      const tinta = { G: '#f0c850', W: '#f4ecd8', B: '#7a4a24' };
      for (let r = 0; r < m.length; r++) for (let k = 0; k < m[r].length; k++) {
        const ch = m[r][k];
        if (ch === '.') continue;
        x.fillStyle = tinta[ch]; x.fillRect(left + k, top + r - (m.length > 6 ? 1 : 0), 1, 1);
      }
      cache[key] = c.toDataURL();
    }
    return U.el('img', { class: 'escudo', src: cache[key], alt: '', style: { height: (alto || 32) + 'px' } });
  };
})();
