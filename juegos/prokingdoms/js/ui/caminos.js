// pk-78: menú de caminos (pedido del dueño: «un menú especial para hacer caminos, como el de las cintas»).
// Una barra arriba (#caminobar) mientras una herramienta de PK.Input.HERR_CAMINO está elegida: Camino, Calzada Real,
// las decoraciones de la Calzada (D.AUTOPISTA.decos), Quitar por zona y Mover recursos del mapa (con monedas del reino).
// El panel de abajo explica la herramienta elegida y su costo (UI.caminoToolPanel).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, Sp = PK.Sprites, UI = PK.UI;
  const el = (...a) => U.el(...a);
  const G = () => PK.Game, S = () => PK.Game.state;
  let bar = null, barKey = '';
  const ICO = {};
  const ico = (k, f) => ICO[k] || (ICO[k] = f());
  const enMar = () => !!(G().enMar && G().enMar());

  UI.barraCaminos = function () {
    const hud = document.getElementById('hud');
    if (!hud) return;
    if (!bar) { bar = el('div', { id: 'caminobar', class: 'frame', role: 'toolbar', 'aria-label': 'Caminos' }); hud.append(bar); }
    const L = PK.Logi, I = PK.Input, on = !!(S() && L.tool && I.HERR_CAMINO && I.HERR_CAMINO[L.tool]);
    const key = on ? [L.tool, L.decoTipo, S().era, UI.isTouch(), enMar()].join('|') : '';
    hud.classList.toggle('caminos-on', on);
    if (key === barKey) return;
    barKey = key; bar.innerHTML = '';
    if (!on) return;
    const tool = L.tool, col = Sp.ownerColor('p');
    const herr = (id, label, icon, title, extra) => {
      const sel = tool === id && (!extra || extra.sel());
      return el('button', { type: 'button', class: 'cb-herr' + (sel ? ' sel' : '') + (extra && extra.off ? ' off' : ''), title, 'aria-label': label, 'aria-pressed': sel ? 'true' : 'false', onclick: () => {
        if (extra && extra.fn) extra.fn();
        if (tool !== id) I.abrirCaminos(id); else UI.refreshPanel(true);
      } }, icon && icon.startsWith('data:') ? el('img', { src: icon, alt: '' }) : el('span', { class: 'cb-glifo' }, icon), el('span', { class: 'cb-txt' }, label));
    };
    const grupos = [el('div', { class: 'cb-grupo' },
      herr('road', 'Camino', ico('road', () => Sp.calzada(10, false, [150, 120, 80]).c.toDataURL()), 'Camino de tierra: solo en tu tierra. Toca dónde empieza y dónde termina'),
      enMar() ? '' : herr('calzada', 'Calzada', ico('cz' + col, () => Sp.calzada(15, true, col).c.toDataURL()), 'Calzada Real: de 2 de ancho, del color de tu reino; tierra de nadie, la tuya y zonas comunes'))];
    if (!enMar()) grupos.push(el('div', { class: 'cb-grupo' },
      D.AUTOPISTA.decos.map((d, i) => {
        const tipo = i + 1, ok = (S().era || 1) >= d.era;
        return herr('czdeco', d.name.split(' ')[0], ico('d' + tipo + col, () => PK.Calzada.icono(tipo)), ok ? d.name + ': ' + d.desc + ' Toca una casilla de tu Calzada.' : d.name + ': se habilita en la Era ' + U.roman(d.era) + '.',
          { sel: () => L.decoTipo === tipo, fn: () => { L.decoTipo = tipo; }, off: !ok });
      }),
      herr('czdeco', 'Sacar', '✕', 'Quitar una decoración de tu Calzada (vuelve la mitad)', { sel: () => L.decoTipo === 0, fn: () => { L.decoTipo = 0; } })));
    grupos.push(el('div', { class: 'cb-grupo' },
      herr('qcamino', 'Quitar', '⌫', 'Quitar caminos y Calzada en una zona: toca dos esquinas (vuelve la mitad del material)'),
      herr('mrecurso', 'Mover', '✥', 'Mover recursos del mapa (árboles, minas, vetas…): 1 moneda del reino cada ' + D.MOVER_RECURSO.cada + ' casillas, por recurso')));
    grupos.push(el('div', { class: 'cb-grupo' },
      el('button', { type: 'button', class: 'cb-herr cb-x', title: 'Cerrar el menú de caminos (Esc)', 'aria-label': 'Cerrar', onclick: () => { G().sel = null; I.cancelTool(); } }, el('span', { class: 'cb-glifo' }, '✓'), el('span', { class: 'cb-txt' }, 'Listo'))));
    bar.append(...grupos);
  };

  // El panel de abajo para las herramientas nuevas (el camino y la Calzada tienen el suyo en ui.js)
  UI.caminoToolPanel = function () {
    const L = PK.Logi, I = PK.Input, Cz = PK.Calzada, t = L.tool, box = el('div', { class: 'p-help' });
    const fin = UI.btn('Terminar', () => I.cancelTool(), { small: true });
    if (t === 'czdeco') {
      const d = L.decoTipo ? Cz.decoDef(L.decoTipo) : null;
      box.append(el('h3', null, d ? 'Decorar la Calzada: ' + d.name.toLowerCase() : 'Quitar decoraciones'),
        el('p', { class: 'small' }, d ? d.desc + ' Toca una casilla de tu Calzada Real para ponerla (si ya tiene otra, la cambia y te devuelve la mitad de la anterior). La ven todos los reinos. Cuesta ' : 'Toca una decoración de tu Calzada para quitarla: vuelve la mitad de lo que costó.'),
        d ? UI.costEl(d.cost) : '',
        el('p', { class: 'small muted' }, 'Tus decoraciones: ' + Cz.misDecos() + ' de ' + D.AUTOPISTA.decoMax + '. No estorban el paso.'),
        el('div', { class: 'row' }, fin));
      return box;
    }
    if (t === 'qcamino') {
      box.append(el('h3', null, 'Quitar caminos'),
        el('p', { class: 'small' }, I.roadStart ? 'Ahora toca la otra esquina de la zona (hasta ' + ((PK.Despeje && PK.Despeje.ZONA_MAX) || 24) + ' casillas por lado).' : 'Toca una esquina de la zona y después la otra. Se quitan tus caminos y la Calzada Real que puedes quitar (la tuya, o la de otro en tu tierra), con sus decoraciones. Vuelve la mitad del material.'),
        el('div', { class: 'row' }, fin));
      return box;
    }
    // mrecurso
    const p = I.planMover, m = I.mover;
    box.append(el('h3', null, 'Mover recursos'));
    if (!m) {
      box.append(el('p', { class: 'small' }, I.roadStart ? 'Toca el mismo recurso para moverlo solo, u otra casilla para elegir todos los de la zona (hasta ' + D.MOVER_RECURSO.max + ').' : 'Toca un recurso del mapa (árbol, arbusto, mina, veta, ciervo…) o una esquina de una zona. Después eliges a dónde va: en tu tierra o en tierra de nadie, en una casilla libre.'),
        el('p', { class: 'small muted' }, 'Cuesta 1 moneda del reino cada ' + D.MOVER_RECURSO.cada + ' casillas, por cada recurso. Tienes ' + PK.Platform.getCoins() + '. Solo cambia tu mapa.'),
        el('div', { class: 'row' }, fin));
      return box;
    }
    const n = m.nodos.length;
    box.append(el('p', { class: 'small' }, (n === 1 ? 'Un recurso elegido' : n + ' recursos elegidos (mantienen su forma)') + '. ' + UI.hint('Mueve el ratón y haz clic donde va.', 'Toca dónde va y toca otra vez (o «Mover aquí») para confirmar.')));
    if (p) {
      box.append(el('p', { class: 'small' }, 'Distancia: ' + Math.round(p.dist) + ' casillas · ' + p.uno + (p.uno === 1 ? ' moneda' : ' monedas') + ' por recurso · total ', UI.amount('coins', p.costo)),
        p.malas.length ? el('p', { class: 'small warn-t' }, 'Ahí no puede ir: ' + p.malas[0].why + (p.malas.length > 1 ? ' (y ' + (p.malas.length - 1) + ' más)' : '') + '.') : '');
    }
    box.append(el('div', { class: 'row' },
      UI.btn(p ? el('span', null, 'Mover aquí ', UI.amount('coins', p.costo)) : 'Mover aquí', () => I.confirmarMover(), { small: true, cls: 'gold', disabled: !p || !p.ok || PK.Platform.getCoins() < p.costo }),
      UI.btn('Elegir otros', () => { I.mover = null; I.planMover = null; PK.Render.beltGhost = null; UI.refreshPanel(true); }, { small: true }),
      fin));
    return box;
  };
})();
