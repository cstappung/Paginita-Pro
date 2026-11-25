// pk-84 (plan Hacha y Pico, P6–P7): la ventana de la Posada de los Viajeros. Cuatro pestañas: Tablero (los pedidos y el
// visitante ilustre), Diligencia (9 cajas), Feria (30 escalones de la semana) y Álbum (cada viajero y su historia).
// Lo que decide está en posada.js; aquí solo se dibuja. Los nombres de los viajeros son nuestros (no los escribe nadie),
// pero igual van con translate="no" porque son nombres propios.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI;
  const el = (...a) => U.el(...a);
  const G = () => PK.Game, Po = () => PK.Posada;
  let tab = 'tablero', leyendo = null; // leyendo: { v, c } un capítulo abierto en el álbum

  const RET = {};
  function retrato(v, gris) {
    const k = v.id + (gris ? ':g' : '');
    if (RET[k]) return RET[k];
    if (!PK.Retratos || typeof document === 'undefined') return '';
    const c = PK.Retratos.canvas({ semilla: U.strHash(v.id) >>> 0, clase: v.clase, mujer: !!v.mujer }, { col: v.col });
    if (gris) { const x = c.getContext('2d'); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(30,24,20,0.82)'; x.fillRect(0, 0, c.width, c.height); }
    return (RET[k] = c.toDataURL());
  }
  const nom = v => el('b', { translate: 'no' }, v.nombre);
  function itemsEl(items) {
    const st = G().state;
    return el('div', { class: 'po-items' }, Object.keys(items).map(r => {
      const ok = (st.res[r] || 0) >= items[r];
      return el('span', { class: 'po-item' + (ok ? '' : ' falta'), title: 'Tienes ' + U.fmt(Math.floor(st.res[r] || 0)) }, UI.resIcon(r), U.fmt(items[r]));
    }));
  }
  const premioEl = pr => el('span', { class: 'po-premio' }, Object.keys(pr).filter(r => pr[r]).map(r => el('span', null, UI.resIcon(r === 'coins' ? 'coins' : r), '+' + U.fmt(pr[r]))));

  UI.openPosada = function (t) {
    if (t) tab = t;
    UI.modal('posada', D.BUILD.posada.name, body => {
      const p = Po().st(), b = Po().taller();
      if (!b) { body.append(el('p', null, 'Construye la ' + D.BUILD.posada.name + ' (Era II) para que lleguen viajeros.')); return; }
      const lvl = Po().nivel(p.fama), sig = D.POSADA.fama[lvl];
      body.append(el('div', { class: 'po-fama' },
        el('span', null, 'Fama ', el('b', null, U.fmt(p.fama)), ' · nivel ', el('b', null, String(lvl))),
        sig !== undefined ? el('div', { class: 'bar po-bar' }, el('div', { class: 'fill gold', style: { width: Math.min(100, ((p.fama - D.POSADA.fama[lvl - 1]) / (sig - D.POSADA.fama[lvl - 1])) * 100) + '%' } }), el('span', null, 'nivel ' + (lvl + 1) + ' con ' + U.fmt(sig))) : el('span', { class: 'small good-t' }, '¡Fama máxima!')));
      const tabs = [['tablero', 'Tablero' + (Po().listos() ? ' (' + Po().listos() + ')' : '')], ['diligencia', 'Diligencia'], ['feria', 'Feria'], ['album', 'Álbum' + (p.cola.length ? ' ¡' + p.cola.length + '!' : '')]];
      body.append(el('div', { class: 'book-tabs bar-tabs' }, tabs.map(([id, txt]) => el('button', { class: 'book-tab' + (tab === id ? ' on' : ''), onclick: () => { tab = id; leyendo = null; UI.rerender(true); } }, txt))));
      if (p.cola.length && tab !== 'album') body.append(el('div', { class: 'po-aviso' }, el('img', { class: 'po-ret chico', src: retrato(Po().viajero(p.cola[0].v)), alt: '' }), el('span', null, nom(Po().viajero(p.cola[0].v)), ' quiere contarte algo.'), UI.btn('Escuchar', () => { tab = 'album'; leyendo = p.cola[0]; UI.rerender(true); }, { small: true, cls: 'gold' })));
      if (tab === 'tablero') tablero(body, p, b);
      else if (tab === 'diligencia') diligencia(body);
      else if (tab === 'feria') feria(body);
      else album(body, p);
    }, { wide: true, cls: 'po-modal' });
  };

  function tablero(body, p, b) {
    const ilu = p.ilu;
    if (ilu && !ilu.hecho) {
      const v = Po().viajero(ilu.v), ok = Po().puede(ilu);
      body.append(el('div', { class: 'po-card ilustre' },
        el('img', { class: 'po-ret', src: retrato(v), alt: '' }),
        el('div', { class: 'po-txt' }, el('div', null, '★ ', nom(v), el('span', { class: 'small muted' }, ' ' + v.titulo)),
          el('div', { class: 'small' }, 'Pide:'), itemsEl(ilu.items), el('div', { class: 'small' }, 'Te da: ', premioEl(ilu.premio), ' +' + ilu.fama + ' de fama')),
        el('div', { class: 'po-acc' }, UI.btn('Atender', () => { Po().atenderIlustre(); UI.rerender(); }, { cls: ok ? 'gold' : '', disabled: !ok, title: ok ? '' : 'Te falta: ' + Po().falta(ilu).map(r => D.RES[r].name.toLowerCase()).join(', ') }))));
    }
    const grid = el('div', { class: 'po-grid' });
    const ord = p.tab.slice().sort((x, y) => Po().puede(y) - Po().puede(x));
    for (const o of ord) {
      const v = Po().viajero(o.v), ok = Po().puede(o);
      grid.append(el('div', { class: 'po-card' + (ok ? ' listo' : '') },
        el('img', { class: 'po-ret', src: retrato(v), alt: '', title: v.oficio }),
        el('div', { class: 'po-txt' }, el('div', null, nom(v), el('span', { class: 'small muted' }, ' ' + v.oficio)), itemsEl(o.items),
          el('div', { class: 'small po-paga' }, premioEl({ gold: o.gold, coins: o.coins }), el('span', { class: 'po-f' }, '★+' + o.fama))),
        el('div', { class: 'po-acc' },
          UI.btn('Entregar', () => { Po().entregar(o.id); UI.rerender(); }, { small: true, cls: ok ? 'gold' : '', disabled: !ok }),
          UI.btn('Despedir', () => { Po().despedir(o.id); UI.rerender(); }, { small: true, title: 'Se va y llega otro viajero en 10 minutos' }))));
    }
    const lugares = D.POSADA.lugares(b.lvl);
    for (let i = p.tab.length; i < lugares; i++) {
      const falta = Math.max(0, (p.prox - G().ahora()) / 1000) + (i - p.tab.length) * D.POSADA.cada(b.lvl);
      grid.append(el('div', { class: 'po-card vacio' }, el('span', { class: 'small muted' }, 'Llega un viajero en aprox. ' + U.fmtTime(Math.max(1, falta)))));
    }
    body.append(grid);
    body.append(el('p', { class: 'small muted' }, 'Los pedidos no caducan: los viajeros esperan aunque no estés. Monedas del reino de hoy: ' + (p.mon.d === U.dayKey(new Date(G().ahora())) ? p.mon.n : 0) + ' de ' + D.POSADA.monedasDia + '. Sube la posada de nivel para más lugares y viajeros más seguido.'));
  }

  function diligencia(body) {
    const d = Po().dil(), hechas = d.cajas.filter(c => c.hecha).length, st = G().state;
    body.append(el('div', { class: 'po-dil-h' },
      el('span', null, 'La Diligencia parte en ', el('b', null, U.fmtTime((Po().dilParte() - G().ahora()) / 1000))),
      el('span', null, ' · cajas ', el('b', null, hechas + '/' + d.cajas.length)),
      el('span', { class: 'small ' + (d.bono ? 'good-t' : 'muted') }, d.bono ? ' · ¡Sale completa! Premio cobrado.' : ' · Las ' + d.cajas.length + ' llenas: hasta 12 monedas, gemas y +10 de fama')));
    const grid = el('div', { class: 'po-cajas' });
    d.cajas.forEach((c, i) => {
      const ok = (st.res[c.r] || 0) >= c.q;
      grid.append(el('div', { class: 'po-caja' + (c.hecha ? ' hecha' : ok ? ' listo' : '') },
        el('div', { class: 'po-caja-h' }, UI.resIcon(c.r), el('b', null, U.fmt(c.q))),
        el('div', { class: 'small' }, 'Paga ', UI.resIcon(c.pago), '+' + U.fmt(c.pq)),
        c.hecha ? el('span', { class: 'small good-t' }, '✓ Cargada')
          : el('div', { class: 'row' }, UI.btn('Llenar', () => { Po().llenarCaja(i); UI.rerender(); }, { small: true, cls: ok ? 'gold' : '', disabled: !ok }),
            st.guild && st.guild.joined && D.NEED_RES.includes(c.r) && !ok ? UI.btn('Pedir al gremio', () => { Po().pedirAyuda(i); UI.rerender(); }, { small: true, title: 'Pone un pedido en el tablón «Necesito…» de tu gremio' }) : null)));
    });
    body.append(grid);
    body.append(el('p', { class: 'small muted' }, 'Cada caja paga al cargarla. Si no alcanzas a llenarlas todas, la Diligencia igual parte (no pierdes nada) y llega otra con cajas nuevas.'));
  }

  function feria(body) {
    const f = Po().feria(), N = D.POSADA.feriaPasos, umbral = Po().umbralFeria;
    body.append(el('div', { class: 'po-dil-h' },
      el('span', null, 'Feria de la semana: escalón ', el('b', null, f.paso + '/' + N)),
      el('span', null, ' · fama de la semana ', el('b', null, U.fmt(f.f))),
      el('span', { class: 'small muted' }, ' · termina en ' + U.fmtTime((Po().feriaFin() - G().ahora()) / 1000))));
    const pasos = el('div', { class: 'po-feria' });
    for (let k = 1; k <= N; k++) {
      const pr = Po().premioFeria(k), r0 = Object.keys(pr)[0];
      pasos.append(el('div', { class: 'po-paso' + (k <= f.paso ? ' hecho' : k === f.paso + 1 ? ' sig' : '') + (k % 5 === 0 ? ' grande' : ''), title: 'Escalón ' + k + ' (fama ' + umbral(k) + '): ' + Po().premioTxt(pr) },
        el('span', { class: 'po-k' }, String(k)), UI.resIcon(r0 === 'coins' ? 'coins' : r0)));
    }
    body.append(pasos);
    if (f.paso < N) {
      const k = f.paso + 1, a = umbral(f.paso), b = umbral(k);
      body.append(el('div', { class: 'bar po-bar' }, el('div', { class: 'fill gold', style: { width: Math.min(100, ((f.f - a) / (b - a)) * 100) + '%' } }), el('span', null, 'escalón ' + k + ': ' + U.fmt(f.f) + ' / ' + U.fmt(b))));
      body.append(el('p', { class: 'small' }, 'Próximos premios: ', ...[k, k + 1, k + 2].filter(x => x <= N).map(x => el('span', { class: 'po-prox' }, x + ': ', premioEl(Po().premioFeria(x))))));
    } else body.append(el('p', { class: 'good-t' }, '¡Completaste la Feria de esta semana! La próxima empieza el lunes.'));
    body.append(el('p', { class: 'small muted' }, 'La fama de cada pedido, caja e ilustre sube la Feria. Cada escalón paga solo, en el momento.'));
  }

  function album(body, p) {
    if (leyendo) {
      const v = Po().viajero(leyendo.v), a = p.album[v.id] || { c: 0 }, c = leyendo.c;
      body.append(el('div', { class: 'po-cap' },
        el('img', { class: 'po-ret grande', src: retrato(v), alt: '' }),
        el('div', null, el('div', null, nom(v), el('span', { class: 'small muted' }, ' ' + v.oficio + ' · capítulo ' + c + ' de 5')),
          el('p', { class: 'po-hist' }, '«' + v.historia[c - 1] + '»'),
          el('div', { class: 'row' },
            c > 1 ? UI.btn('◀ Anterior', () => { leyendo = { v: v.id, c: c - 1 }; UI.rerender(); }, { small: true }) : null,
            c < a.c ? UI.btn('Siguiente ▶', () => { leyendo = { v: v.id, c: c + 1 }; UI.rerender(); }, { small: true }) : null,
            UI.btn('Volver al álbum', () => { leyendo = null; UI.rerender(); }, { small: true, cls: 'gold' })))));
      const i = p.cola.findIndex(x => x.v === v.id && x.c === c);
      if (i >= 0) p.cola.splice(i, 1);
      return;
    }
    const conocidos = D.VIAJEROS.filter(v => p.album[v.id]).length, completas = D.VIAJEROS.filter(v => p.album[v.id] && p.album[v.id].c >= 5).length;
    body.append(el('p', { class: 'small' }, 'Conoces a ' + conocidos + ' de ' + D.VIAJEROS.length + ' viajeros · ' + completas + ' historias completas. Cada viajero cuenta un capítulo a las 1, 3, 6, 10 y 15 entregas.'));
    const grid = el('div', { class: 'po-album' }), nivel = Po().nivel(p.fama);
    for (const v of D.VIAJEROS) {
      const a = p.album[v.id], nuevo = p.cola.some(x => x.v === v.id), llega = v.fama < nivel;
      grid.append(el('button', { class: 'po-fig' + (a ? '' : ' nunca') + (nuevo ? ' nuevo' : ''), disabled: !a, onclick: () => { const c = (p.cola.find(x => x.v === v.id) || {}).c || a.c; leyendo = { v: v.id, c }; UI.rerender(true); } },
        el('img', { class: 'po-ret', src: retrato(v, !a), alt: '' }),
        a ? nom(v) : el('span', { class: 'small muted' }, llega ? 'Todavía no vino' : 'Fama nivel ' + (v.fama + 1)),
        el('span', { class: 'po-caps' }, [1, 2, 3, 4, 5].map(i => el('i', { class: a && a.c >= i ? 'si' : '' })))));
    }
    body.append(grid);
  }
})();
