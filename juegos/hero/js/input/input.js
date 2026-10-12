// Entrada unificada: teclado y mandos/guitarras (Gamepad API).
// Emite eventos crudos { device, code, down, time } con marca de tiempo precisa.

const AXIS_THRESHOLD = 0.5;

export class InputManager {
  constructor() {
    this.listeners = new Set();
    this.pads = [];
    this.keysDown = new Set();
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => {
      for (const code of this.keysDown) this._emit({ device: 'keyboard', code, down: false, time: performance.now() });
      this.keysDown.clear();
    });
    window.addEventListener('gamepadconnected', (e) => console.log('Mando conectado:', e.gamepad.index, e.gamepad.id));
    // Sondeo frecuente de mandos (los navegadores no dan eventos de botones)
    setInterval(() => this.poll(), 4);
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(ev) {
    for (const fn of [...this.listeners]) fn(ev);
  }

  _key(e, down) {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    if (e.repeat) {
      if (!typing && this.capture) e.preventDefault();
      return;
    }
    if (down) this.keysDown.add(e.code);
    else this.keysDown.delete(e.code);
    const ev = { device: 'keyboard', code: e.code, key: e.key, down, time: e.timeStamp, typing, event: e };
    this._emit(ev);
    if (this.capture && !typing && /^(Space|Arrow|Tab|Backspace|F\d)/.test(e.code)) e.preventDefault();
  }

  poll() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = performance.now();
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      const st = (this.pads[gp.index] ??= { buttons: [], axes: [] });
      const device = `gamepad:${gp.index}`;
      gp.buttons.forEach((b, i) => {
        const down = b.pressed || b.value > 0.5;
        if (down !== !!st.buttons[i]) {
          st.buttons[i] = down;
          this._emit({ device, code: `b${i}`, down, time: now });
        }
      });
      gp.axes.forEach((v, i) => {
        const pos = v > AXIS_THRESHOLD, neg = v < -AXIS_THRESHOLD;
        const prev = st.axes[i] || 0;
        const cur = pos ? 1 : neg ? -1 : 0;
        if (cur !== prev) {
          if (prev === 1) this._emit({ device, code: `a${i}+`, down: false, time: now });
          if (prev === -1) this._emit({ device, code: `a${i}-`, down: false, time: now });
          if (cur === 1) this._emit({ device, code: `a${i}+`, down: true, time: now });
          if (cur === -1) this._emit({ device, code: `a${i}-`, down: true, time: now });
          st.axes[i] = cur;
        }
      });
    }
  }

  connectedPads() {
    return [...(navigator.getGamepads?.() || [])].filter(Boolean).map((g) => ({ index: g.index, id: g.id }));
  }
}

// Navegación de menús con cualquier dispositivo (teclado, mando o guitarra)
export function navAction(ev) {
  if (!ev.down) return null;
  if (ev.device === 'keyboard') {
    if (ev.typing && !['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'PageUp', 'PageDown'].includes(ev.code)) return null;
    return {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', NumpadEnter: 'confirm',
      Escape: 'back', Backspace: ev.typing ? null : 'back', PageUp: 'pageup', PageDown: 'pagedown',
    }[ev.code] || null;
  }
  return {
    b12: 'up', b13: 'down', b14: 'left', b15: 'right', b0: 'confirm', b9: 'confirm', b1: 'back',
    'a1-': 'up', 'a1+': 'down', 'a0-': 'left', 'a0+': 'right', b3: 'pageup', b2: 'pagedown',
  }[ev.code] || null;
}

export function deviceMatches(profile, ev) {
  return profile.device === 'keyboard' ? ev.device === 'keyboard' : ev.device === profile.device;
}

// Mapa inverso código -> acciones para un perfil e instrumento
export function buildActionMap(profile, kind) {
  const map = new Map();
  const binds = kind === 'drums' ? profile.drums : profile.guitar;
  for (const [action, codes] of Object.entries(binds)) {
    for (const code of codes || []) {
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(action);
    }
  }
  return map;
}

export function codeLabel(code) {
  if (!code) return '—';
  if (/^b\d+$/.test(code)) return `Botón ${code.slice(1)}`;
  if (/^a\d+[+-]$/.test(code)) return `Eje ${code.slice(1, -1)}${code.slice(-1)}`;
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Semicolon', 'Ñ')
    .replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→')
    .replace('ShiftRight', 'Shift der.').replace('ShiftLeft', 'Shift izq.')
    .replace('ControlRight', 'Ctrl der.').replace('ControlLeft', 'Ctrl izq.')
    .replace('Space', 'Espacio');
}
