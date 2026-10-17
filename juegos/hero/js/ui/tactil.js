// Los cinco botones táctiles del modo celular (sitio/celular.js), uno por color.
// La pantalla se parte en cinco columnas iguales: el carril de cada color, que
// en el celular llega abajo justo con ese ancho (render/highway.js, opts.celular).
// Un dedo puede deslizarse de un color a otro y varios dedos tocan acordes.
// No llama al motor: emite eventos como un mando más (device 'touch'), y la
// sesión los lee con el perfil TACTIL, así que pasan por la grabadora de siempre.
import { h } from './dom.js';
import { FRET_COLORS } from '../core/constants.js';
import { settings } from '../settings.js';
import { enHorizontal } from '../sitio/celular.js';

export const TACTIL = {
  id: 'tactil',
  name: 'Pantalla táctil',
  device: 'touch',
  guitar: { g0: ['t0'], g1: ['t1'], g2: ['t2'], g3: ['t3'], g4: ['t4'], up: [], down: [], sp: ['tsp'], whammy: [], start: ['tpausa'] },
  drums: { kick: [], p0: [], p1: [], p2: [], p3: [], p4: [], c1: [], c2: [], c3: [], sp: ['tsp'], start: ['tpausa'] },
};

// Desde aquí hacia abajo (fracción del alto) el toque cuenta como traste
const ZONA = 0.38;

export class Tactil {
  constructor(session) {
    this.session = session;
    this.input = session.app.input;
    this.dedos = new Map(); // pointerId → carril
    this.cuenta = [0, 0, 0, 0, 0]; // dedos sobre cada carril
    this.botones = [0, 1, 2, 3, 4].map((f) => h('div', { class: 'tc-btn', style: `--c:${FRET_COLORS[f]}` }));
    this.zona = h('div', { class: 'tc-zona' }, h('div', { class: 'tc-fila' }, ...this.botones));
    const boton = (cls, txt, code, label) => h('button', {
      class: cls, 'aria-label': label,
      onpointerdown: (e) => {
        e.preventDefault();
        this._emite(code, true, e.timeStamp);
        this._emite(code, false, e.timeStamp);
      },
    }, txt);
    this.el = h('div', { class: 'tactil', oncontextmenu: (e) => e.preventDefault() },
      this.zona,
      boton('tc-sp', '★', 'tsp', 'Star Power'),
      boton('tc-pausa', '❚❚', 'tpausa', 'Pausa'));
    this._pinta();
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      this.zona.addEventListener(t, (e) => this._dedo(e), { passive: false });
    }
    session.app.overlay.append(this.el);
    document.documentElement.classList.add('tocando');
    // girar a vertical en plena canción la pausa (en una sala no se puede pausar)
    this.onResize = () => {
      if (!enHorizontal() && !session.paused && !session.net && !session.finished) session.togglePause();
    };
    window.addEventListener('resize', this.onResize);
  }

  // el carril bajo un punto de la pantalla (en zurdo los colores van al revés)
  _carril(x, y) {
    const r = this.zona.getBoundingClientRect();
    if (y < r.top + r.height * ZONA || x < r.left || x > r.right) return -1;
    const c = Math.max(0, Math.min(4, Math.floor(((x - r.left) / r.width) * 5)));
    return settings.lefty ? 4 - c : c;
  }

  _dedo(e) {
    e.preventDefault();
    const id = e.pointerId;
    let nuevo = -1;
    if (e.type === 'pointerdown') {
      try {
        this.zona.setPointerCapture(id);
      } catch {}
      nuevo = this._carril(e.clientX, e.clientY);
    } else if (e.type === 'pointermove') {
      if (!this.dedos.has(id)) return;
      nuevo = this._carril(e.clientX, e.clientY);
    }
    const antes = this.dedos.has(id) ? this.dedos.get(id) : -1;
    if (nuevo === antes) return;
    if (nuevo < 0 && e.type === 'pointermove') {
      // un dedo que sube por encima de la zona sigue siendo el mismo dedo: suelta y espera
      this.dedos.set(id, -1);
    } else if (nuevo < 0) this.dedos.delete(id);
    else this.dedos.set(id, nuevo);
    if (antes >= 0 && --this.cuenta[antes] === 0) this._emite(`t${antes}`, false, e.timeStamp);
    if (nuevo >= 0 && this.cuenta[nuevo]++ === 0) this._emite(`t${nuevo}`, true, e.timeStamp);
    this._pinta();
  }

  _emite(code, down, time) {
    this.input._emit({ device: 'touch', code, down, time });
  }

  _pinta() {
    this.botones.forEach((b, i) => {
      const f = settings.lefty ? 4 - i : i;
      b.style.setProperty('--c', FRET_COLORS[f]);
      b.classList.toggle('on', this.cuenta[f] > 0);
    });
  }

  // tras la pausa la sesión suelta los trastes: aquí también
  suelta() {
    this.dedos.clear();
    this.cuenta.fill(0);
    this._pinta();
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    document.documentElement.classList.remove('tocando');
    this.el.remove();
  }
}
