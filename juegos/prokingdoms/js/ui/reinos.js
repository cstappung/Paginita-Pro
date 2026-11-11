// Ventana Reinos (Fase 5, S1, pk-23): una ficha por reino con escudo, personalidad, relación, pactos y acciones,
// más los asuntos pendientes (ultimátum, pedido de ayuda, propuestas de jugadores), la plaza del mundo y el
// ranking. La diplomacia la decide el servidor (js/diplomacia.js): sin conexión, la ficha dice «Requiere conexión».
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI;
  const el = U.el;
  const S = () => PK.Game.state;
  const Dp = () => PK.Diplo;
  let abierto = null; // casilla de la ficha con el regalo desplegado

  const relBar = rel => {
    const pct = (rel + 100) / 2, cls = rel < -20 ? 'mal' : rel >= 20 ? 'bien' : '';
    return el('div', { class: 'rel-bar ' + cls, title: 'Relación ' + rel },
      el('i', { style: { left: Math.min(pct, 50) + '%', width: Math.abs(pct - 50) + '%' } }), el('b', { style: { left: '50%' } }));
  };
  const chip = (txt, cls, title) => el('span', { class: 'dp-chip ' + (cls || ''), title: title || '' }, txt);

  function asuntos(body) {
    const info = Dp().info, ev = info && info.ev, st = S();
    if (ev) {
      const pide = ev.tipo === 'ultimatum' ? ev.pide : { [ev.res]: ev.n }, alcanza = PK.Game.canAfford(pide), left = Math.max(0, (ev.hasta - Date.now()) / 1000);
      body.append(el('div', { class: 'dp-ev ' + ev.tipo },
        Dp().escudo(ev.slot, 36),
        el('div', null,
          el('b', null, ev.tipo === 'ultimatum' ? 'Ultimátum de ' : 'Pedido de ayuda de '), el('b', { translate: 'no' }, Dp().nombre(ev.slot)),
          el('p', { class: 'small' }, ev.tipo === 'ultimatum' ? 'Paga o manda una partida de saqueo enseguida. Quedan ' + U.fmtTime(left) + '.' : 'Mandárselo sube la relación el doble que un regalo. Quedan ' + U.fmtTime(left) + '.'),
          el('div', { class: 'row' }, UI.costEl(pide), UI.btn(ev.tipo === 'ultimatum' ? 'Pagar' : 'Mandar', () => Dp().responder('pagar'), { small: true, cls: 'gold', disabled: !alcanza, title: alcanza ? '' : 'No te alcanza' }),
            UI.btn(ev.tipo === 'ultimatum' ? 'Negarse' : 'Ahora no', () => Dp().responder('rechazar'), { small: true })))));
    }
    for (const x of (info && info.prop) || []) {
      body.append(el('div', { class: 'dp-ev prop' }, Dp().escudo(x.slot, 36),
        el('div', null, el('b', { translate: 'no' }, x.from), ' te propone ', el('b', null, (D.PACTOS[x.pacto] || { name: 'hacer las paces' }).name.toLowerCase()), '.',
          el('div', { class: 'row' }, UI.btn('Aceptar', () => Dp().aceptar(x.id, true), { small: true, cls: 'gold' }), UI.btn('Rechazar', () => Dp().aceptar(x.id, false), { small: true })))));
    }
    if (st.era < D.DIPLO.era) body.append(el('p', { class: 'small muted' }, 'La diplomacia se abre en la Era ' + U.roman(D.DIPLO.era) + ': regalos, tratados, pactos y alianzas.'));
  }

  function acciones(b) {
    const e = Dp().de(b.slot), out = el('div', { class: 'dp-acc' });
    if (!e) return out;
    const boton = (pacto, label, cls) => {
      const why = Dp().porQueNo(b.slot, pacto);
      return UI.btn(label, () => {
        if ((pacto === 'rival' || pacto === 'romper') && !confirm(pacto === 'rival' ? '¿Declarar la rivalidad a ' + b.realm + '? Rompe los pactos y su relación cae mucho.' : '¿Romper con ' + b.realm + '? La relación baja.')) return;
        Dp().proponer(b.slot, pacto);
      }, { small: true, cls: why ? '' : cls || '', title: why || (D.PACTOS[pacto] || {}).desc || '' });
    };
    const reg = e.reg || 0;
    out.append(UI.btn('Regalo' + (reg ? ' (' + reg + '/' + D.DIPLO.regalosDia + ')' : ''), () => { abierto = abierto === b.slot ? null : b.slot; UI.rerender(); }, { small: true, disabled: reg >= D.DIPLO.regalosDia, title: 'Hasta ' + D.DIPLO.regalosDia + ' por día' }));
    if (e.pacto === 'rival') out.append(boton('paz', 'Pedir la paz', 'gold'));
    else {
      if (!e.tratado) out.append(boton('comercio', 'Tratado', 'gold'));
      if (!e.pacto) out.append(boton('noAgresion', 'No agresión', 'gold'));
      if (e.pacto !== 'alianza') out.append(boton('alianza', 'Alianza', 'gold'));
      if (e.pacto || e.tratado) out.append(boton('romper', 'Romper'));
      out.append(boton('rival', 'Rivalidad', 'danger'));
    }
    return out;
  }

  function regalos(b) {
    const st = S(), fila = el('div', { class: 'dp-reg' });
    for (const r of D.DIPLO.regaloRes) {
      const n = Dp().regaloN(r, 1), tiene = Math.floor(st.res[r] || 0) >= n, gana = Dp().regaloGana(b.slot, r, n);
      fila.append(UI.btn(el('span', null, UI.resIcon(r), U.fmt(n)), () => Dp().regalar(b.slot, r, n), { small: true, disabled: !tiene, title: gana ? 'Relación +' + U.fmt(gana) : 'Le llega a su bodega' }));
    }
    return el('div', null, el('p', { class: 'small muted' }, b.human ? 'Le llega a su bodega (con tope diario, como el tablón del gremio).' : 'Cuánto sube la relación depende de su personalidad.'), fila);
  }

  function ficha(b) {
    const e = Dp().de(b.slot), pers = Dp().pers(b.slot), P = pers && D.PERSONALIDADES[pers], conectado = Dp().activa();
    const chips = el('div', { class: 'dp-chips' });
    if (e) {
      if (e.pacto) chips.append(chip(D.PACTOS[e.pacto].name, e.pacto, D.PACTOS[e.pacto].desc));
      if (e.tratado) chips.append(chip('Tratado', 'comercio', D.PACTOS.comercio.desc));
      if (e.boda) chips.append(chip('Boda real', 'alianza', 'Alianza sellada para siempre: ayuda un 50% más.'));
    }
    if (PK.Saqueos && PK.Saqueos.info && PK.Saqueos.info.slot === b.slot) chips.append(chip('¡Te saquea!', 'rival'));
    const card = el('div', { class: 'ficha' + (e && e.pacto ? ' ' + e.pacto : '') },
      el('div', { class: 'ficha-h' }, Dp().escudo(b.slot, 40),
        el('div', null, el('b', { translate: 'no' }, b.realm),
          el('div', { class: 'small' }, b.human ? el('span', { class: 'tag' }, b.online ? 'jugador ● en línea' : 'jugador') : P ? el('span', { class: 'pers ' + pers, title: P.desc }, P.name) : '',
            b.human && b.era ? ' · Era ' + U.roman(b.era) : ''))),
      P ? el('p', { class: 'small muted' }, P.desc) : '',
      e && e.rel !== null && e.rel !== undefined ? el('div', { class: 'dp-rel' }, relBar(e.rel), el('span', { class: 'small' }, D.relNombre(e.rel) + ' (' + (e.rel > 0 ? '+' : '') + e.rel + ')')) : '',
      chips,
      conectado && S().era >= D.DIPLO.era ? acciones(b) : el('p', { class: 'small muted' }, conectado ? '' : 'Diplomacia: requiere conexión.'),
      conectado && e && e.tratado && PK.Mundo ? PK.Mundo.caravanaEl(b.slot) : '', // S2 (pk-24)
      conectado && b.human && b.pid && PK.Mundo ? el('div', { class: 'dp-acc' }, UI.btn('Visitar', () => PK.Mundo.visitar(b.pid), { small: true })) : '', // S4
      abierto === b.slot && conectado ? regalos(b) : '');
    return card;
  }

  UI.openRealms = function () {
    const net = PK.Net;
    UI.modal('realms', 'Reinos', body => {
      body.append(el('h3', null, net.online ? 'Tu mundo: ' + net.world.name : 'Tu mundo (modo local)'));
      const humanos = D.BOTS.filter(b => b.human), enLinea = humanos.filter(b => b.online).length;
      if (net.online) body.append(el('p', { class: 'small' + (enLinea ? ' good-t' : ' muted') }, humanos.length ? humanos.length + ' jugador(es) real(es) en tu mundo · ' + enLinea + ' en línea ahora.' : 'Por ahora eres el único jugador real de este mundo: los demás reinos son simulados hasta que llegue alguien.'));
      if (Dp().activa()) {
        asuntos(body);
        if (PK.Mundo) body.append(PK.Mundo.caravanasEl());
        const ali = Dp().aliados().length;
        body.append(el('p', { class: 'small' }, 'Aliados: ' + ali + '/' + D.DIPLO.maxAliados + (Dp().tratado() ? ' · Con un tratado de comercio compras un 10% más barato en el Mercado.' : ' · Un tratado de comercio abarata un 10% las compras del Mercado.') + ' Los reinos con pacto no te saquean.'));
      } else if (!net.online) body.append(el('p', { class: 'small muted' }, 'La diplomacia (regalos, tratados, pactos, alianzas y rivalidades) requiere conexión: la decide el servidor.'));
      const rel = b => { const e = Dp().de(b.slot); return (e && e.pacto === 'alianza' ? 300 : 0) + (b.human ? 200 : 0) + (e && e.rel !== null && e.rel !== undefined ? e.rel : 0); };
      const lista = D.BOTS.slice().sort((a, b) => rel(b) - rel(a));
      body.append(el('div', { class: 'fichas' }, el('div', { class: 'ficha yo' },
        el('div', { class: 'ficha-h' }, el('span', { class: 'swatch', style: { background: 'rgb(' + D.PLAYER_COLOR.join(',') + ')' } }),
          el('div', null, el('b', { translate: 'no' }, UI.yo(net.online ? net.me.name : PK.Platform.getPlayer().name)), el('div', { class: 'small' }, 'Era ' + U.roman(S().era))))),
      lista.map(ficha)));
      // plaza del mundo: chat corto entre reinos, que además aparece como globo sobre el reino que habla
      const chat = el('div', { class: 'chat scroll' }, PK.Social.worldChat().map(m => el('div', { class: m.me ? 'me' : '' }, el('b', { translate: 'no' }, m.who + ': '), el('span', { translate: 'no' }, m.text))));
      const input = el('input', { id: 'wchat-in', placeholder: 'Escribe a todo el mundo…', maxlength: 100 });
      const send = t => { PK.Social.sayWorld(t); input.value = ''; setTimeout(() => UI.rerender(), 300); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); e.stopPropagation(); });
      body.append(el('h3', null, 'Plaza del mundo'), chat, el('div', { class: 'chat-in' }, input, UI.btn('Enviar', () => send(input.value), { small: true })),
        el('div', { class: 'row quick-say' }, D.QUICK_SAY.map(t => UI.btn(t, () => send(t), { small: true }))));
      setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);
      if (!net.online) {
        body.append(el('p', { class: 'muted' }, (PK.Platform.name === 'paginita-pro' ? 'Sin conexión con el mundo compartido: por ahora los demás reinos son simulados y tu partida se guarda en este navegador. Recarga la página para volver a intentarlo.' : 'No hay servidor: los demás reinos son simulados. Ejecuta "node server.js" y abre el juego desde http://localhost:8080 para jugar con otras personas.')));
        return;
      }
      body.append(el('p', { class: 'muted small' }, 'Cada mundo tiene 16 reinos. Las casillas libres las ocupan reinos simulados hasta que llegue un jugador.'));
      body.append(PK.Mundo.rankingEl()); // S5 (pk-24): categorías, títulos y «Visitar»
    }, { wide: true });
    if (net.online) net.refreshRanking();
  };
})();
