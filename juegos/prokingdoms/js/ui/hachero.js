// pk-83 (plan Hacha y Pico, P2): ventana del Taller del Hachero. Tres columnas (Filo, Golpe, Aguante) con sus cinco
// herramientas dibujadas en pixel art por código (hachaIcono), el nivel actual iluminado y, para el siguiente, sus
// requisitos uno por uno con la barra de la prueba de campo. Arriba, lo que rinde todo junto y la investigación en curso.
// Todo lo que decide vive en game.js (G.talaSig, G.talaEmpezar, G.talaAcelerar); aquí solo se dibuja.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI;
  const el = (...a) => U.el(...a);
  const G = () => PK.Game;

  // Íconos de 20×20 dibujados por código, uno por rama y nivel (caché por clave).
  const ICO = {};
  function hachaIcono(rama, n) {
    const k = rama + n;
    if (ICO[k]) return ICO[k];
    const c = document.createElement('canvas');
    c.width = c.height = 20;
    const x = c.getContext('2d');
    const px = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const MAD = '#8a5a30', MAD2 = '#5e3a1e', MET = n >= 3 ? '#d8dde6' : n >= 2 ? '#b8bec8' : '#9aa0aa', MET2 = n >= 3 ? '#8e96a4' : '#6c727c';
    if (rama === 'filo') {
      px(9, 3, 2, 15, MAD); px(10, 3, 1, 15, MAD2);                   // mango
      px(4, 3, 6, 5, MET); px(4, 7, 6, 1, MET2); px(3, 4, 1, 3, '#f4f6fa'); // hoja
      if (n >= 4) { px(11, 3, 5, 4, MET); px(16, 4, 1, 2, '#f4f6fa'); }    // doble filo
      if (n >= 1) for (let i = 0; i < n; i++) px(2 + i * 2, 0, 1, 2, '#ffe28a'); // destellos del afilado
    } else if (rama === 'golpe') {
      if (n <= 1) { px(3, 10, 10, 6, MAD); px(3, 10, 10, 1, '#c49a64'); px(12, 4, 2, 7, MAD2); px(10, 2, 6, 3, MET); } // mazo y cuña
      else {
        const largo = n >= 3 ? 16 : 14;
        px(2, 8, largo, 4, MET); for (let i = 2; i < 2 + largo; i += 2) px(i, 12, 1, 1, MET2); // hoja con dientes
        px(1, 6, 2, 8, MAD); px(1 + largo, 6, 2, 8, MAD);                                       // mangos
        if (n >= 3) { px(2, 4, largo, 1, MAD2); px(9, 4, 1, 4, MAD2); }                         // bastidor
        if (n >= 4) { px(13, 0, 3, 3, '#e8e8e8'); px(15, 1, 2, 2, '#c8c8c8'); }                 // vapor
        if (n >= 5) { px(2, 15, 16, 3, '#4a4e58'); px(3, 16, 2, 1, '#9aa0aa'); px(15, 16, 2, 1, '#9aa0aa'); } // poleas
      }
    } else {
      px(4, 12, 12, 6, '#7a5232'); px(4, 12, 12, 1, '#c49a64');         // tocón
      for (let r = 1; r <= Math.min(n, 4); r++) px(10 - r, 12, 1, 1, '#9a7046');   // anillos
      if (n >= 2) { px(13, 4, 2, 8, MAD); px(12, 8, 4, 1, MAD); }       // rama podada
      if (n >= 3) px(3, 17, 14, 1, '#4a3420');                          // corte a ras
      if (n >= 4) { px(2, 18, 3, 2, '#7a5232'); px(15, 18, 3, 2, '#7a5232'); } // raíces
      if (n >= 5) { px(9, 0, 2, 4, '#6a6e76'); px(6, 0, 8, 1, '#6a6e76'); }      // polipasto
    }
    if (n === 0) { x.globalCompositeOperation = 'source-atop'; px(0, 0, 20, 20, 'rgba(60,50,40,0.45)'); }
    return (ICO[k] = c.toDataURL());
  }
  UI.hachaIcono = hachaIcono;

  // pk-87: cómo se ve hoy tu leñador en el mapa (camina con el hacha al hombro, hachea y, con Golpe II, aserra)
  function lenadorVista(g) {
    const Sp = PK.Sprites, lk = g.talaLook(), col = Sp.ownerColor('p');
    const c = document.createElement('canvas'), z = 3;
    c.width = 3 * 22 * 2 * z / 2 + 24; c.height = 22 * 2 * z / 2 + 4;
    c.className = 'hach-lenador';
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const poses = [['walk', 1, null], ['work', 2, 'axe'], ['work', 2, lk && lk.g >= 2 ? 'saw' : 'axe']];
    poses.forEach(([mode, fr, tool], i) => {
      const s = Sp.villager(col, i % 4, (i + 1) % 3, mode, fr, null, false, tool, false, false, null, undefined, false, undefined, lk);
      if (s) x.drawImage(s.c, i * (22 * z + 8), 0, s.c.width * z / 2, s.c.height * z / 2);
    });
    const tot = lk ? lk.f + lk.g + lk.a : 0;
    return el('div', { class: 'hach-vista' }, c, el('span', { class: 'small muted' }, tot ? 'Así se ven tus leñadores en el mapa: el equipo cambia con cada herramienta (hacha del Filo, sierras del Golpe, cuerda, gorro y polea del Aguante).' : 'Tus leñadores todavía usan el hacha de siempre. Cada herramienta que investigues se les verá en el mapa.'));
  }

  UI.openHachero = function () {
    UI.modal('hachero', D.BUILD.hachero.name, body => {
      const g = G(), t = g.talaSt(), m = g.talaMult(), R = D.HACHERO.ramas;
      body.append(el('p', { class: 'small muted' }, 'Tres ramas de herramientas. Filo hace talar más rápido, Golpe da más madera por toque y Aguante hace que el árbol dure más. Las herramientas no se gastan. Con las tres al máximo, los leñadores sacan 4 veces la madera por minuto y cada árbol da 4 veces más.'));
      body.append(el('div', { class: 'hach-resumen' },
        el('span', null, 'Madera por minuto ', el('b', null, '×' + (m.f * m.g).toFixed(2))),
        el('span', null, 'Madera por árbol ', el('b', null, '×' + (m.g * m.a).toFixed(2))),
        el('span', null, 'Carga del leñador ', el('b', null, '×' + m.g.toFixed(2)))));
      body.append(lenadorVista(g));
      if (g.enMar()) body.append(el('p', { class: 'small warn-t' }, 'Las herramientas valen también en el archipiélago, pero se investigan en el taller de tu reino.'));
      if (!g.buildings.some(b => b.owner === 'p' && b.type === 'hachero' && b.done) && !g.enMar()) body.append(el('p', { class: 'small warn-t' }, 'Sin un ' + D.BUILD.hachero.name + ' terminado no se investiga nada (y una investigación empezada queda en pausa).'));
      if (t.inv) {
        const i = t.inv, falta = i.total - i.t, n = g.talaAcelerarCosto();
        body.append(el('div', { class: 'hach-inv' },
          el('img', { class: 'hach-ico', src: hachaIcono(i.rama, i.n), alt: '' }),
          el('div', null, el('b', null, R[i.rama].niv[i.n]), el('span', { class: 'small muted' }, ' · ' + R[i.rama].name + ' ' + U.roman(i.n)),
            el('div', { class: 'bar' }, el('div', { class: 'fill blue', style: { width: (i.t / i.total) * 100 + '%' } }), el('span', null, 'Falta ' + U.fmtTime(falta)))),
          el('div', { class: 'row' },
            UI.btn('Acelerar (' + n + ' monedas del reino)', () => { g.talaAcelerar(); UI.rerender(); }, { small: true, title: 'Termina ya la investigación. La prueba de campo nunca se acelera.' }),
            UI.btn('Cancelar', () => { g.talaCancelar(); UI.rerender(); }, { small: true, title: 'Vuelve la mitad de los materiales' }))));
      }
      const cols = el('div', { class: 'hach-ramas' });
      for (const rama of D.HACHERO.orden) {
        const r = R[rama], cur = t.n[rama] || 0, sig = g.talaSig(rama);
        const lista = el('div', { class: 'hach-lista' });
        for (let n = 1; n <= 5; n++) {
          const est = n <= cur ? 'hecho' : t.inv && t.inv.rama === rama && t.inv.n === n ? 'enCurso' : n === cur + 1 ? 'sig' : 'lejos';
          lista.append(el('div', { class: 'hach pieza ' + est, title: r.niv[n] },
            el('img', { class: 'hach-ico', src: hachaIcono(rama, est === 'lejos' ? 0 : n), alt: '' }),
            el('span', { class: 'hach-nom' }, el('b', null, U.roman(n) + ' '), r.niv[n]),
            el('span', { class: 'hach-mult' }, '×' + r.mult[n].toFixed(2))));
        }
        const col = el('div', { class: 'hach rama' },
          el('div', { class: 'hach-h' }, el('b', null, r.name), el('span', { class: 'small muted' }, ' · ' + r.que), el('span', { class: 'hach-mult' }, '×' + r.mult[cur].toFixed(2))),
          lista);
        if (!sig) col.append(el('p', { class: 'small good-t' }, '¡Rama al máximo!'));
        else if (!(t.inv && t.inv.rama === rama)) {
          const pr = sig.pide.find(p => p.prueba), have = Math.min(sig.nv.prueba, t.cortado[rama] || 0);
          col.append(el('div', { class: 'hach-pide' },
            el('div', { class: 'small' }, el('b', null, 'Siguiente: '), r.niv[sig.n], ' (×' + r.mult[sig.n].toFixed(2) + ', ' + U.fmtTime(sig.nv.time) + ')'),
            sig.pide.filter(p => !p.prueba && !p.costo).map(p => el('div', { class: 'small ' + (p.ok ? 'good-t' : 'warn-t') }, (p.ok ? '✓ ' : '✗ ') + p.txt)),
            el('div', { class: 'small ' + (pr.ok ? 'good-t' : 'muted') }, (pr.ok ? '✓ ' : '') + 'Prueba de campo: talar ' + U.fmt(sig.nv.prueba) + ' de madera'),
            el('div', { class: 'bar' }, el('div', { class: 'fill green', style: { width: (have / sig.nv.prueba) * 100 + '%' } }), el('span', null, U.fmt(Math.floor(have)) + ' / ' + U.fmt(sig.nv.prueba))),
            el('div', { class: 'small' }, UI.costEl(sig.cost)),
            UI.btn('Investigar', () => { if (g.talaEmpezar(rama)) UI.rerender(); }, { small: true, cls: sig.ok ? 'gold' : '', disabled: !sig.ok })));
        }
        cols.append(col);
      }
      body.append(cols);
      body.append(el('p', { class: 'small muted' }, 'La prueba de campo cuenta la madera que tus leñadores talan en tu reino desde la última mejora de esa rama. El taller investiga una cosa a la vez; su nivel abre los niveles de herramienta (I en el nivel 1, II en el 3, III en el 5, IV en el 7 y V en el 9).'));
    }, { wide: true, cls: 'hach-modal' });
  };
})();
