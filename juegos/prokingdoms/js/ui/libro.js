// Exploración, Reinos, Opciones, cofres, el cartel de reinicio y el informe «Mientras no estabas».
// Salió de js/ui.js al partirlo por ventanas (T5 del plan): los mismos atajos que allá. Va después de ui.js.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites, UI = PK.UI;
  const el = U.el;
  const G = () => PK.Game;
  const S = () => PK.Game.state;

  // ---------- Exploración ----------
  UI.openExplore = function () {
    UI.modal('explore', 'Exploración', body => {
      const g = G(), st = S();
      const lodge = g.countB('scout');
      body.append(el('div', { class: 'war-top' },
        el('div', null, el('b', null, 'Mapa explorado: '), Math.round(g.explorePct() * 1000) / 10 + '% (' + U.fmt(W.fogCount) + ' casillas)'),
        el('div', null, el('b', null, 'Exploradores: '), g.scoutCount() + '/' + g.scoutMax() + ' · alcance ' + g.exploreRange() + ' casillas'),
        lodge ? null : el('p', { class: 'muted small' }, 'Construye un Puesto de Exploradores para entrenar exploradores. Su nivel define cuántos tienes y hasta dónde llegan. Las torres también ven lejos.')));
      const found = W.pois.filter(p => g.poiState(p) && g.poiState(p).f);
      const counts = {};
      for (const p of W.pois) { const c = counts[p.kind] || (counts[p.kind] = [0, 0]); c[1]++; if (g.poiState(p) && g.poiState(p).f) c[0]++; }
      body.append(el('h3', null, 'Descubrimientos'), el('div', { class: 'poi-sum' }, Object.keys(D.POI).map(k => el('span', { class: 'tag' }, D.POI[k].name + ': ' + (counts[k] ? counts[k][0] + '/' + counts[k][1] : '0')))));
      if (lodge) {
        const fl = g.banderas();
        body.append(el('h3', null, 'Banderas de exploración'),
          el('p', { class: 'small muted' }, 'Marca hasta ' + g.BANDERAS_MAX + ' lugares en la niebla: ' + (g.dirigidos() > 1 ? 'tus 2 primeros exploradores van' : 'tu primer explorador va') + ' hacia ellos antes que a la niebla más cercana. ' + (g.dirigidos() > 1 ? '' : 'El Puesto en nivel 5 o Cartografía III suman un segundo explorador dirigido.')),
          el('div', { class: 'row' }, UI.btn('Poner bandera', () => { UI.closeModal(); PK.Input.startFlag(); }, { small: true, cls: 'gold', disabled: fl.length >= g.BANDERAS_MAX }),
            fl.map((f, i) => el('span', { class: 'tag' }, '⚑ ' + (i + 1) + ' ', UI.btn('Ver', () => { UI.closeModal(); PK.Render.centerOn(f[0], f[1]); }, { small: true }), UI.btn('✕', () => { fl.splice(i, 1); UI.rerender(); }, { small: true, aria: 'Quitar la bandera ' + (i + 1) })))));
      }
      const realms = D.BOTS.filter(b => st.flags['seen_' + b.slot]);
      if (realms.length) body.append(el('p', { class: 'small' }, 'Reinos encontrados: ' + realms.map(b => b.realm).join(', ') + '.'));
      const box = el('div', { class: 'works scroll' });
      const order = { relic: 0, ruin: 1, camp: 2, watch: 3, chest: 4 };
      found.sort((a, b) => (g.poiState(a).d ? 1 : 0) - (g.poiState(b).d ? 1 : 0) || order[a.kind] - order[b.kind]);
      for (const p of found) {
        const s2 = g.poiState(p), tier = g.poiTier(p);
        const state = s2.d ? { chest: 'abierto', watch: 'visitada', ruin: 'excavada', camp: 'destruido', relic: 'en tu Monasterio' }[p.kind] : p.kind === 'ruin' ? 'excavada ' + Math.floor((s2.p || 0) * 100) + '%' : p.kind === 'camp' ? 'fuerza aprox. ' + D.campPower(tier) : 'sin reclamar';
        box.append(el('div', { class: 'work-row' + (s2.d ? ' done' : '') }, el('img', { src: Sp.poi(p.kind, s2.d).c.toDataURL() }),
          el('b', null, D.POI[p.kind].name), el('span', { class: 'lvl' }, 'rango ' + U.roman(tier + 1)), el('span', { class: 'muted small' }, state),
          p.kind === 'relic' && !s2.d ? UI.btn('Al Monasterio', () => { g.claimRelic(p); UI.rerender(); }, { small: true, cls: 'gold' }) : null,
          UI.btn('Ver', () => { UI.closeModal(); g.sel = { type: 'poi', id: p.id }; PK.Render.centerOn(p.x + p.w / 2, p.y + p.h / 2); UI.refreshPanel(true); }, { small: true })));
      }
      if (!found.length) box.append(el('p', { class: 'muted' }, 'Aún no descubres nada. Hay cofres, ruinas, atalayas, reliquias y campamentos de bandidos escondidos en la niebla.'));
      body.append(box);
    }, { wide: true });
  };

  // ---------- Reinos y ranking ----------
  UI.openRealms = function () {
    const net = PK.Net;
    UI.modal('realms', 'Reinos', body => {
      body.append(el('h3', null, net.online ? 'Tu mundo: ' + net.world.name : 'Tu mundo (modo local)'));
      const rows = [{ me: true, name: UI.yo(net.online ? net.me.name : PK.Platform.getPlayer().name), color: D.PLAYER_COLOR, era: S().era }]
        .concat(D.BOTS.map(b => ({ name: b.realm, color: b.color, human: b.human, online: b.online, era: b.human ? b.era : null })));
      const humansN = rows.filter(r => r.human).length, onlineN = rows.filter(r => r.human && r.online).length;
      if (net.online) body.append(el('p', { class: 'small' + (onlineN ? ' good-t' : ' muted') }, humansN ? humansN + ' jugador(es) real(es) en tu mundo · ' + onlineN + ' en línea ahora.' : 'Por ahora eres el único jugador real de este mundo: los demás reinos son simulados hasta que llegue alguien.'));
      rows.sort((a, b) => (b.me ? 2 : 0) + (b.human ? 1 : 0) + (b.online ? 1 : 0) - ((a.me ? 2 : 0) + (a.human ? 1 : 0) + (a.online ? 1 : 0)));
      body.append(el('div', { class: 'offers' }, rows.map(r => el('div', { class: 'offer' + (r.human ? ' human' : '') },
        el('span', { class: 'swatch', style: { background: 'rgb(' + r.color.join(',') + ')' } }), el('b', null, r.name),
        r.me ? null : el('span', { class: 'tag' }, r.human ? (r.online ? 'jugador ● en línea' : 'jugador') : 'simulado'),
        r.era ? el('span', { class: 'muted small' }, ' · Era ' + U.roman(r.era)) : null))));
      // plaza del mundo: chat corto entre reinos, que además aparece como globo sobre el reino que habla
      const chat = el('div', { class: 'chat scroll' }, PK.Social.worldChat().map(m => el('div', { class: m.me ? 'me' : '' }, el('b', null, m.who + ': '), m.text)));
      const input = el('input', { id: 'wchat-in', placeholder: 'Escribe a todo el mundo…', maxlength: 100 });
      const send = t => { PK.Social.sayWorld(t); input.value = ''; setTimeout(() => UI.rerender(), 300); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); e.stopPropagation(); });
      body.append(el('h3', null, 'Plaza del mundo'), chat, el('div', { class: 'chat-in' }, input, UI.btn('Enviar', () => send(input.value), { small: true })),
        el('div', { class: 'row quick-say' }, D.QUICK_SAY.map(t => UI.btn(t, () => send(t), { small: true }))));
      setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);
      if (!net.online) {
        body.append(el('p', { class: 'muted' }, (PK.Platform.name === 'paginita-pro-beta' ? 'Beta cerrada: por ahora los demás reinos son simulados y tu partida se guarda en este navegador. El mundo compartido con otras personas llega más adelante.' : 'No hay servidor: los demás reinos son simulados. Ejecuta "node server.js" y abre el juego desde http://localhost:8080 para jugar con otras personas.')));
        return;
      }
      body.append(el('p', { class: 'muted small' }, 'Cada mundo tiene 16 reinos. Las casillas libres las ocupan reinos simulados hasta que llegue un jugador.'));
      body.append(el('h3', null, 'Ranking del servidor'));
      const rk = net.cache.ranking;
      if (!rk) body.append(el('p', { class: 'muted' }, 'Cargando…'));
      else body.append(el('ol', { class: 'rank' }, rk.map(r => el('li', { class: r.me ? 'me' : '' },
        el('span', null, r.name + (r.online ? ' ●' : '') + ' · ' + r.world), el('span', null, 'Era ' + U.roman(r.era) + ' · ' + U.fmt(r.total))))));
    });
    if (net.online) net.refreshRanking();
  };

  // ---------- Opciones ----------
  UI.openSettings = function () {
    UI.modal('settings', 'Opciones', body => {
      const nameIn = el('input', { id: 'pname', value: PK.Platform.getPlayer().name, maxlength: 20 });
      nameIn.addEventListener('keydown', e => e.stopPropagation());
      body.append(el('h3', null, 'Jugador'), el('div', { class: 'row' }, nameIn, UI.btn('Guardar nombre', () => { U.store.set('pk_player_name', nameIn.value.trim() || 'Tú'); UI.toast('Nombre guardado.', 'good'); }, { small: true })),
        el('h3', null, 'Sonido'),
        el('div', { class: 'row' }, UI.btn(PK.Sfx.on ? 'Silenciar (M)' : 'Activar sonido (M)', () => { PK.Sfx.toggle(); UI.rerender(); }, { small: true })),
        el('h3', null, 'Avisos'),
        el('p', { class: 'small muted' }, 'Te avisamos cuando termine una mejora, una investigación, una era o una expedición, y cuando el cofre diario esté listo, aunque el juego esté en otra pestaña.'),
        el('div', { class: 'row' }, PK.Notify.enabled()
          ? UI.btn('Desactivar avisos', () => { PK.Notify.enable(false); UI.rerender(); }, { small: true })
          : UI.btn('Activar avisos', () => PK.Notify.enable(true).then(() => UI.rerender()), { small: true, cls: 'gold' })),
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!S().flags.evMin, onchange: e => { S().flags.evMin = e.target.checked; } }),
          el('b', null, ' Eventos achicados'), el('span', { class: 'small muted' }, ' — los eventos del mapa (ciervo dorado, estrellas, mercader…) aparecen como una pastilla chica arriba, sin el cartel grande. Igual se pueden abrir tocándolos.')),
        el('p', { class: 'small muted' }, 'Los avisos que aparecen y se van solos se cierran antes tocándolos.'),
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !S().flags.helpOff, onchange: e => { S().flags.helpOff = !e.target.checked; UI.refreshPanel(true); } }),
          el('b', null, ' Ayuda en el panel'), el('span', { class: 'small muted' }, ' — con nada elegido, el panel de abajo muestra cómo se juega. Sin ella, el panel solo aparece al elegir algo y el mapa queda libre.')),
        el('h3', null, 'Partida'),
        el('p', { class: 'small muted' }, 'El juego se guarda solo cada 20 segundos y al cerrar. Tus aldeanos siguen trabajando hasta 12 horas sin ti.'),
        el('div', { class: 'row' }, UI.btn('Guardar ahora', () => { G().save(); UI.toast('Partida guardada.', 'good'); }, { small: true }),
          UI.btn('Borrar partida', () => { if (confirm('¿Seguro? Se perderá todo tu progreso.')) G().reset(); }, { small: true, cls: 'danger' })),
        el('h3', null, 'Controles'),
        UI.isTouch() ? el('ul', { class: 'small' },
          el('li', null, 'Toca: seleccionar · Con aldeanos elegidos, toca un árbol, una mina o un edificio: recolectar / trabajar'),
          el('li', null, 'Para soltar lo elegido: toca el suelo vacío, vuelve a tocar al aldeano o usa la ✕ del panel'),
          el('li', null, 'Construir: elige el edificio en el menú, toca dónde va y vuelve a tocar (o «Construir aquí») para confirmar'),
          el('li', null, 'Mantén pulsado y arrastra: seleccionar grupo · Doble toque en un aldeano: todos los de su tipo en pantalla'),
          el('li', null, 'Con el Centro Urbano elegido, toca un recurso para fijar el punto de reunión'),
          el('li', null, 'Arrastra: mover cámara · Pellizca: zoom'),
          el('li', null, 'Botones Ocioso y Demoler en el menú lateral'))
        : el('ul', { class: 'small' },
          el('li', null, 'Clic: seleccionar · Arrastrar: seleccionar grupo · Mayús: añadir'),
          el('li', null, 'Clic derecho: recolectar / trabajar / mover'),
          el('li', null, 'Con el Centro Urbano seleccionado, clic derecho fija el punto de reunión'),
          el('li', null, 'WASD / flechas / botón central: mover cámara · Rueda: zoom'),
          el('li', null, 'C: construir · H: Centro Urbano · . o I: aldeano ocioso · Z: zonas · B: libro · V: mover el edificio elegido · Supr: demoler')));
      if (PK.dev) {
        body.append(el('h3', null, 'Modo desarrollo'), el('div', { class: 'row' },
          [1, 5, 20].map(s => UI.btn('x' + s, () => { G().timeScale = s; UI.toast('Velocidad x' + s, 'info'); }, { small: true })),
          UI.btn('+5K recursos', () => { for (const r of D.RES_ORDER) S().res[r] += 5000; }, { small: true }),
          UI.btn('Terminar obras', () => { for (const b of G().buildings) if (b.upg) b.upg.t = b.upg.total; if (S().research) S().research.t = S().research.total; if (S().eraProg) S().eraProg.t = S().eraProg.total; G().updateTimers(0); }, { small: true }),
          UI.btn('Revelar mapa', () => { G().revealAt(W.W / 2, W.H / 2, W.W); }, { small: true }),
          UI.btn('Lobos', () => PK.Life.debug.spawnPack(), { small: true }),
          UI.btn('Bandidos', () => { if (PK.Incursiones.activa()) PK.Incursiones.debug.atacar(); else PK.Incursiones.debug.ya(); }, { small: true }),
          UI.btn('Evento', () => PK.Life.debug.startEvent(), { small: true }),
          UI.btn('Simular 3h offline', () => { const rep = G().simulateOffline(3 * 3600); UI.closeModal(); UI.offlineReport(rep); }, { small: true })));
      }
    });
  };

  // ---------- Cofre: animación al abrirlo ----------
  // Antes el cofre diario solo dejaba un aviso y no se entendía qué había salido. Ahora tiembla, se abre con un
  // destello y los premios saltan uno por uno. o = { title, sub, reward, tier (0 normal, 1 bueno, 2 especial) }.
  UI.chestReveal = function (o) {
    const old = document.querySelector('.cr-back');
    if (old) old.remove();
    const sfx = n => PK.Sfx && PK.Sfx.play(n);
    const keys = Object.keys(o.reward || {}).filter(k => o.reward[k] > 0);
    const OPEN = 1.05, STEP = 0.24;
    const chest = el('img', { class: 'cr-chest', src: Sp.icon('chest'), alt: '' });
    const items = el('div', { class: 'cr-items' }, keys.map((k, i) => el('div', { class: 'cr-item', style: { animationDelay: OPEN + 0.25 + i * STEP + 's' } },
      el('img', { class: 'ico', src: Sp.icon(k === 'coins' ? 'coin' : k), alt: '' }), el('b', null, '+' + U.fmt(o.reward[k])), el('small', null, k === 'coins' ? 'monedas' : D.RES[k].name))));
    const done = el('button', { class: 'btn gold cr-ok', style: { animationDelay: OPEN + 0.45 + keys.length * STEP + 's' } }, '¡Genial!');
    const conf = el('div', { class: 'cr-conf', 'aria-hidden': 'true' }, Array.from({ length: 22 }, (_, i) => el('i', { style: { left: (4 + ((i * 37) % 92)) + '%', animationDelay: OPEN + (i % 7) * 0.08 + 's', background: ['#ffd84a', '#e8b83a', '#fffbe0', '#6fbf5a', '#6aa8ff', '#d8503c'][i % 6] } })));
    const box = el('div', { class: 'cr-box tier' + (o.tier || 0) }, el('div', { class: 'cr-title' }, o.title), o.sub ? el('div', { class: 'cr-sub' }, o.sub) : null,
      el('div', { class: 'cr-stage' }, el('div', { class: 'cr-rays' }), el('div', { class: 'cr-glow' }), chest), items, done);
    const back = el('div', { class: 'cr-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title }, conf, box);
    let shut = false;
    const close = () => { if (shut) return; shut = true; back.classList.add('out'); setTimeout(() => back.remove(), 260); };
    done.addEventListener('click', close);
    back.addEventListener('pointerdown', e => { if (e.target === back && back.classList.contains('open')) close(); });
    back.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); close(); } });
    document.body.append(back);
    sfx('hammer');
    setTimeout(() => sfx('hammer'), 350); setTimeout(() => sfx('hammer'), 700);
    setTimeout(() => { if (shut) return; chest.src = Sp.icon('chestOpen'); back.classList.add('open'); sfx('level'); }, OPEN * 1000);
    keys.forEach((k, i) => setTimeout(() => { if (!shut) sfx('coin'); }, (OPEN + 0.25 + i * STEP) * 1000));
    setTimeout(() => { try { done.focus({ preventScroll: true }); } catch (e) { /* nada */ } }, (OPEN + 0.5 + keys.length * STEP) * 1000);
  };

  // Al entrar después de un reinicio (D.SAVE_V nuevo): una vez, porque la partida nueva se guarda con la versión nueva.
  UI.reinicio = function () {
    const N = D.NOVEDADES || { ver: '', items: [] };
    UI.modal('reinicio', 'Un mundo nuevo', body => {
      body.append(el('p', null, 'El mundo se reinició con la actualización ' + N.ver + '. Tu reino empieza de cero, igual que el de todos.'),
        N.items.length ? el('ul', { class: 'info' }, N.items.map(t => el('li', null, t))) : '',
        el('div', { class: 'row' }, UI.btn('¡A construir!', () => UI.closeModal(), { cls: 'gold' })));
    });
  };
  UI.offlineReport = function (rep) {
    if (!rep) return;
    UI.modal('offline', 'Mientras no estabas…', body => {
      body.append(el('p', null, 'Pasaron ' + U.fmtTime(rep.sec) + '. Tus aldeanos siguieron trabajando:'));
      const keys = Object.keys(rep.gained).filter(k => rep.gained[k] > 0);
      // Por qué no se ganó (o se ganó poco): antes culpaba siempre al jugador, aunque la causa fuera el almacén lleno.
      const full = ['food', 'wood', 'stone', 'gold', 'ore', 'marble', 'gems'].filter(r => G().cap(r) !== Infinity && (S().res[r] || 0) >= G().cap(r) - 1);
      const working = G().units.some(u => u.owner === 'p' && u.kind === 'v' && (u.task || u.inside));
      body.append(keys.length ? el('div', { class: 'reward big' }, keys.map(k => UI.amount(k, rep.gained[k])))
        : el('p', { class: 'muted' }, full.length ? 'No cupo nada más: el almacenamiento está lleno.' : working ? 'Tus aldeanos no lograron juntar nada: quizás se agotó lo que tenían cerca.' : 'Nadie estaba trabajando. ¡Asigna tareas antes de irte!'));
      if (full.length) body.append(el('p', { class: 'small warn-t' }, 'Lleno: ' + full.map(r => D.RES[r].name.toLowerCase()).join(', ') + '. Mejora el Granero, el Almacén o el Centro Urbano para guardar más mientras no estás.'));
      if (rep.depleted) body.append(el('p', { class: 'small muted' }, 'Tus aldeanos agotaron ' + rep.depleted + (rep.depleted === 1 ? ' árbol, veta o arbusto' : ' árboles, vetas o arbustos') + ' (vuelven a crecer con el tiempo).'));
      if (rep.explored > 0) body.append(el('p', { class: 'small' }, 'Tus exploradores revelaron ' + rep.explored + ' casillas del mapa.'));
      if (rep.finished && rep.finished.length) body.append(el('p', { class: 'small' }, 'Terminado: ' + rep.finished.join(', ') + '.'));
      if (rep.capped) body.append(el('p', { class: 'small muted' }, 'Las obras y estudios contaron todo el tiempo; los aldeanos, hasta 12 horas.'));
      if (rep.eraUp) body.append(el('p', { class: 'good' }, '¡Tu pueblo avanzó de era mientras dormías!'));
      if (rep.helps) body.append(el('p', { class: 'small good-t' }, 'Tu pedido' + (rep.helpsWhat ? ' (' + rep.helpsWhat + ')' : '') + ' recibió ' + rep.helps + (rep.helps === 1 ? ' ayuda' : ' ayudas') + ' del gremio.'));
      const traba = PK.Asesor.problemas()[0]; // lo primero que conviene arreglar al volver
      if (traba) body.append(el('div', { class: 'asesor-row' + (traba.prioridad >= 70 ? ' grave' : '') }, el('span', null, el('b', null, 'Ojo: '), traba.texto),
        el('span', { class: 'row' }, traba.acciones.slice(0, 2).map(a => UI.btn(a.label, () => { a.fn(); UI.refreshPanel(true); if (UI.modalKey() === 'offline') UI.rerender(); }, { small: true, cls: 'gold' })))));
      if (rep.consejo && rep.consejo.length) body.append(el('h3', null, 'Lo que hizo tu Consejo'), el('div', { class: 'log' }, rep.consejo.map(c => el('div', null, el('b', null, c.name + ': '), c.items.slice(0, 4).join(' ') + (c.items.length > 4 ? ' Y ' + (c.items.length - 4) + ' cosas más.' : '')))));
      if (rep.news && rep.news.length) body.append(el('h3', null, 'Novedades'), el('div', { class: 'log' }, rep.news.slice(-8).map(n => el('div', { class: n.kind }, n.text))));
      const sk = S().streak, Q = PK.Quests;
      if (sk.shielded === U.dayKey()) body.append(el('p', { class: 'small' }, 'Faltaste un día, pero tu escudo de racha la salvó: tus ' + sk.n + ' días siguen en pie.'));
      else if (Q.repairable()) body.append(el('p', { class: 'small warn-t' }, 'Tu racha de ' + sk.n + ' días se cortó. Puedes repararla hoy en el Libro (pestaña Diarias).'));
      const w = rep.welcome;
      if (w) {
        const open = () => { if (S().ret.welcome === w) { G().openWelcome(); UI.chestReveal({ title: w.name, sub: 'Por el tiempo que estuviste fuera', reward: w.reward, tier: w.tier }); } UI.rerender(); };
        body.append(w.opened
          ? el('div', { class: 'welcome-chest opened tier' + w.tier + (Date.now() - w.opened < 800 ? ' pop' : '') },el('img', { src: Sp.icon('chest') }), el('div', null, el('b', null, w.name + ' abierto'), el('div', { class: 'reward' }, Object.keys(w.reward).map(k => UI.amount(k, w.reward[k])))))
          : el('button', { class: 'welcome-chest closed', onclick: open }, el('img', { src: Sp.icon('chest') }),
            el('div', null, el('b', null, 'Cofre de bienvenida'), el('span', { class: 'small' }, 'Crece con el tiempo fuera (hasta 12 h) y a veces viene cargado. Tócalo para abrirlo.'))));
      }
      body.append(UI.btn('A trabajar', () => { if (w && S().ret.welcome === w) G().openWelcome(true); UI.closeModal(); }, { cls: 'gold' }));
    });
  };
})();
