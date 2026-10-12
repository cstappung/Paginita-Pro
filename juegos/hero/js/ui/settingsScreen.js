// Ajustes: juego, audio (con calibración) y asignación de controles.
import { h, Screen, toast } from './dom.js';
import { settings, saveSettings, resetProfile, GUITAR_ACTIONS, DRUM_ACTIONS } from '../settings.js';
import { codeLabel, buildActionMap, deviceMatches } from '../input/input.js';
import { audioContext, SongAudio, sampleBank } from '../audio/audio.js';
import { NOTE_MODES } from '../core/noteMode.js';
import { FRET_COLORS, DRUM_COLORS5 } from '../core/constants.js';

export class SettingsScreen extends Screen {
  constructor(app, tab = 'game') {
    super(app);
    this.tab = tab;
    this.profileId = 'kb1';
    this.kind = 'guitar';
    this.capturing = null;
  }

  render() {
    this.body = h('div', { class: 'set-body' });
    this.tabs = h('div', { class: 'tabs' });
    return h('div', { class: 'screen settings' },
      h('div', { class: 'ss-head' },
        h('button', { class: 'back-btn', onclick: () => this.back() }, '‹'),
        h('h1', {}, 'Ajustes')),
      this.tabs, this.body);
  }

  afterMount() {
    this.renderAll();
    this.padTimer = setInterval(() => this.tab === 'controls' && this.updatePads(), 1000);
    // probador en vivo: ilumina las acciones al pulsar sus teclas/botones
    this.offTester = this.app.input.on((ev) => this.testInput(ev));
  }

  beforeUnmount() {
    clearInterval(this.padTimer);
    this.offTester?.();
    this.capturing?.();
    this.stopCalibration?.();
    saveSettings();
  }

  renderAll() {
    const tab = (id, label) => h('button', { class: `tab${this.tab === id ? ' on' : ''}`, 'data-nav': true, onclick: () => { this.tab = id; this.renderAll(); } }, label);
    this.tabs.replaceChildren(tab('game', 'Juego'), tab('audio', 'Audio'), tab('controls', 'Controles'));
    if (this.tab === 'game') this.renderGame();
    else if (this.tab === 'audio') this.renderAudio();
    else this.renderControls();
  }

  slider(label, get, set, min, max, step, fmt = (v) => v) {
    const out = h('b', {}, fmt(get()));
    const input = h('input', { type: 'range', min, max, step, value: get(), 'data-nav': true, oninput: () => { set(Number(input.value)); out.textContent = fmt(Number(input.value)); saveSettings(); } });
    return h('label', { class: 'set-row' }, h('span', {}, label), input, out);
  }

  check(label, get, set, help) {
    const input = h('input', { type: 'checkbox', 'data-nav': true, onchange: () => { set(input.checked); saveSettings(); } });
    input.checked = get();
    return h('label', { class: 'set-row check' }, h('span', {}, label, help ? h('small', {}, help) : null), input);
  }

  select(label, options, get, set, help) {
    const sel = h('select', { 'data-nav': true, onchange: () => { set(sel.value); saveSettings(); } },
      ...Object.entries(options).map(([v, l]) => h('option', { value: v, selected: v === get() }, l)));
    return h('label', { class: 'set-row' }, h('span', {}, label, help ? h('small', {}, help) : null), sel);
  }

  renderGame() {
    const name = h('input', { type: 'text', value: settings.playerName, placeholder: 'Tu nombre', maxlength: 20, 'data-nav': true, oninput: () => { settings.playerName = name.value; saveSettings(); } });
    this.body.replaceChildren(
      h('label', { class: 'set-row' }, h('span', {}, 'Nombre de jugador'), name),
      this.select('Modo de notas', NOTE_MODES, () => settings.noteMode, (v) => (settings.noteMode = v),
        'Todo taps: solo pulsa los trastes, sin rasgueo'),
      this.select('Estilo de la pista', { wood: 'Mástil de madera', dark: 'Clásico oscuro' }, () => settings.highwayStyle, (v) => (settings.highwayStyle = v)),
      this.check('Mostrar teclas bajo los trastes', () => settings.showKeyLabels, (v) => (settings.showKeyLabels = v)),
      this.check('Vibración de pantalla', () => settings.screenShake, (v) => (settings.screenShake = v), 'Sacudida al perder racha o activar Star Power'),
      this.check('Modo zurdo', () => settings.lefty, (v) => (settings.lefty = v), 'Invierte la autopista'),
      this.check('Videos de fondo', () => settings.showVideo, (v) => (settings.showVideo = v), 'video.mp4 / .webm de la canción'),
      this.check('Imágenes de fondo', () => settings.showBackground, (v) => (settings.showBackground = v)),
      this.check('Batería: Expert+ (doble bombo)', () => settings.expertPlus, (v) => (settings.expertPlus = v)),
      this.check('Batería: platillos pro', () => settings.proCymbals, (v) => (settings.proCymbals = v), 'Exige teclas distintas para platillos'));
  }

  renderAudio() {
    const pct = (v) => `${Math.round(v * 100)}%`;
    const V = settings.volume;
    this.calOut = h('div', { class: 'cal-out' }, 'Pulsa "Calibrar" y toca cualquier tecla al ritmo de los clics.');
    this.body.replaceChildren(
      h('p', { class: 'set-note' }, 'También puedes cambiar el volumen en plena canción desde el menú de pausa (Esc).'),
      this.slider('Volumen general', () => V.master, (v) => (V.master = v), 0, 1, 0.01, pct),
      this.slider('Música', () => V.song, (v) => (V.song = v), 0, 1, 0.01, pct),
      this.slider('Tu instrumento', () => V.instrument, (v) => (V.instrument = v), 0, 1, 0.01, pct),
      this.slider('Efectos', () => V.sfx, (v) => (V.sfx = v), 0, 1, 0.01, pct),
      this.slider('Vista previa en menú', () => V.preview, (v) => (V.preview = v), 0, 1, 0.01, pct),
      this.check('Silenciar tu instrumento al fallar', () => settings.muteOnMiss, (v) => (settings.muteOnMiss = v)),
      this.missSoundRow(),
      this.audioOffsetRow = this.slider('Retraso de audio (calibración)', () => settings.audioOffset, (v) => (settings.audioOffset = v), -300, 300, 1, (v) => `${v} ms`),
      this.slider('Retraso de video', () => settings.videoOffset, (v) => (settings.videoOffset = v), -500, 500, 10, (v) => `${v} ms`),
      h('div', { class: 'cal' }, h('button', { class: 'primary', 'data-nav': true, onclick: () => this.calibrate() }, 'Calibrar audio'), this.calOut));
  }

  // Calibración: suenan clics regulares; el jugador pulsa a tiempo y medimos la diferencia
  calibrate() {
    this.stopCalibration?.();
    const ctx = audioContext();
    ctx.resume();
    const bpm = 100, beat = 60 / bpm, count = 16;
    const start = ctx.currentTime + 1;
    const clicks = [];
    for (let i = 0; i < count; i++) {
      const t = start + i * beat;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i % 4 ? 900 : 1400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.08);
      clicks.push(t);
    }
    const diffs = [];
    const toCtx = (perf) => {
      const ts = ctx.getOutputTimestamp?.();
      if (ts && ts.contextTime > 0) return ts.contextTime + (perf - ts.performanceTime) / 1000;
      return ctx.currentTime - (ctx.outputLatency || 0) + (perf - performance.now()) / 1000;
    };
    this.calOut.textContent = 'Escucha… pulsa una tecla (o botón) en cada clic, a partir del 5º.';
    const off = this.app.input.on((ev) => {
      if (!ev.down) return;
      const t = toCtx(ev.time);
      let best = null;
      for (const c of clicks.slice(4)) if (best === null || Math.abs(t - c) < Math.abs(t - best)) best = c;
      if (best !== null && Math.abs(t - best) < beat / 2) diffs.push(t - best);
      this.calOut.textContent = `Toques registrados: ${diffs.length}`;
    });
    const timer = setTimeout(() => {
      off();
      this.stopCalibration = null;
      if (diffs.length < 5) {
        this.calOut.textContent = 'No se registraron suficientes toques. Inténtalo de nuevo.';
        return;
      }
      diffs.sort((a, b) => a - b);
      const mid = diffs.slice(Math.floor(diffs.length * 0.2), Math.ceil(diffs.length * 0.8));
      const avg = (mid.reduce((s, x) => s + x, 0) / mid.length) * 1000;
      settings.audioOffset = Math.round(avg);
      saveSettings();
      toast(`Retraso de audio ajustado a ${settings.audioOffset} ms`);
      this.renderAudio();
      this.calOut.textContent = `Resultado: ${settings.audioOffset} ms (positivo = pulsas después del sonido).`;
    }, (1 + count * beat + 0.6) * 1000);
    this.stopCalibration = () => {
      off();
      clearTimeout(timer);
    };
  }

  missSoundRow() {
    const c = h('input', { type: 'checkbox', 'data-nav': true, onchange: () => { settings.missSound = c.checked; saveSettings(); } });
    c.checked = settings.missSound;
    return h('div', { class: 'set-row check' },
      h('span', {}, 'Nota fallida de guitarra al perder la racha', h('small', {}, 'Solo con multiplicador x2 o más')),
      h('div', { class: 'row-inline' }, c, h('button', { 'data-nav': true, onclick: () => this.testMissSound() }, 'Probar')));
  }

  async testMissSound() {
    const a = new SongAudio();
    await sampleBank(a.ctx);
    a.loseStreak(1);
    setTimeout(() => a.stop(), 2000);
  }

  renderControls() {
    const profSel = h('select', { 'data-nav': true, onchange: () => { this.profileId = profSel.value; this.renderControls(); } },
      ...settings.profiles.map((p) => h('option', { value: p.id, selected: p.id === this.profileId }, p.name)));
    const kindSel = h('select', { 'data-nav': true, onchange: () => { this.kind = kindSel.value; this.renderControls(); } },
      h('option', { value: 'guitar', selected: this.kind === 'guitar' }, 'Guitarra / Bajo / Teclado'),
      h('option', { value: 'drums', selected: this.kind === 'drums' }, 'Batería'));
    const prof = settings.profiles.find((p) => p.id === this.profileId);
    const binds = this.kind === 'drums' ? prof.drums : prof.guitar;
    const actions = this.kind === 'drums' ? DRUM_ACTIONS : GUITAR_ACTIONS;
    this.rowEls = {};
    this.pads = h('div', { class: 'pads' });

    // Probador visual: se ilumina con lo que pulsas
    const testerItems = this.kind === 'drums'
      ? [['kick', 'Bombo', '#f28a1c'], ...[0, 1, 2, 3, 4].map((i) => [`p${i}`, '', DRUM_COLORS5[i]]), ['sp', 'SP', '#53e7ff']]
      : [...[0, 1, 2, 3, 4].map((i) => [`g${i}`, '', FRET_COLORS[i]]), ['up', '▲', '#dddddd'], ['down', '▼', '#dddddd'], ['sp', 'SP', '#53e7ff']];
    this.testerEls = {};
    const tester = h('div', { class: 'tester' },
      h('span', { class: 'tester-title' }, 'Probador: pulsa tus teclas o botones'),
      h('div', { class: 'tester-row' }, ...testerItems.map(([id, txt, col]) => (this.testerEls[id] = h('div', { class: 'tester-dot', style: { '--c': col } },
        h('b', {}, txt || codeLabel(binds[id]?.[0])))))));

    this.body.replaceChildren(
      h('div', { class: 'ctrl-top' }, profSel, kindSel,
        h('button', { 'data-nav': true, onclick: () => { resetProfile(this.profileId); this.renderControls(); } }, 'Restablecer')),
      tester,
      h('div', { class: 'binds' }, ...actions.map(([id, label]) => {
        const codes = binds[id] || [];
        const row = h('div', { class: 'bind-row' },
          h('span', { class: 'b-label' }, label),
          h('span', { class: 'b-codes' }, codes.length
            ? codes.map((c) => h('span', { class: 'chip', title: 'Click para quitar', onclick: () => { binds[id] = codes.filter((x) => x !== c); saveSettings(); this.renderControls(); } }, codeLabel(c), ' ×'))
            : h('span', { class: 'chip empty' }, 'sin asignar')),
          h('span', { class: 'b-btns' },
            h('button', { class: 'b-add', 'data-nav': true, onclick: (e) => this.capture(prof, binds, id, e.currentTarget, true) }, 'Cambiar'),
            h('button', { class: 'b-plus', 'data-nav': true, title: 'Añadir otra tecla', onclick: (e) => this.capture(prof, binds, id, e.currentTarget, false) }, '+')));
        this.rowEls[id] = row;
        return row;
      })),
      this.pads,
      h('div', { class: 'hint' }, prof.device === 'keyboard'
        ? '"Cambiar" sustituye la tecla y "+" añade otra. Haz click en una tecla asignada para quitarla. Esc cancela.'
        : 'Conecta tu guitarra o mando y pulsa cualquier botón para que el navegador lo detecte. Luego "Cambiar" y pulsa el botón.'));
    this.liveMap = buildActionMap(prof, this.kind);
    this.liveProfile = prof;
    this.updatePads();
  }

  testInput(ev) {
    if (this.tab !== 'controls' || !this.liveMap || this.capturingNow) return;
    if (!deviceMatches(this.liveProfile, ev)) return;
    for (const a of this.liveMap.get(ev.code) || []) {
      this.rowEls?.[a]?.classList.toggle('active', ev.down);
      this.testerEls?.[a]?.classList.toggle('on', ev.down);
    }
  }

  updatePads() {
    if (!this.pads) return;
    const pads = this.app.input.connectedPads();
    this.pads.replaceChildren(h('b', {}, 'Mandos detectados: '), pads.length ? pads.map((p) => h('div', {}, `Mando ${p.index + 1}: ${p.id}`)) : 'ninguno');
  }

  capture(prof, binds, id, btn, replace) {
    this.capturing?.();
    btn.textContent = 'Pulsa…';
    btn.classList.add('capturing');
    this.capturingNow = true;
    const off = this.app.input.on((ev) => {
      if (!ev.down) return;
      const isKb = prof.device === 'keyboard';
      if (isKb !== (ev.device === 'keyboard')) return;
      if (!isKb && ev.device !== prof.device) return;
      ev.event?.preventDefault();
      if (isKb && ev.code === 'Escape' && id !== 'start') {
        done();
        this.renderControls();
        return;
      }
      binds[id] = replace ? [ev.code] : [...new Set([...(binds[id] || []), ev.code])];
      saveSettings();
      done();
      setTimeout(() => this.renderControls(), 0);
    });
    const done = () => {
      off();
      this.capturing = null;
      this.capturingNow = false;
      this.blockNav = false;
    };
    this.blockNav = true;
    this.capturing = done;
  }

  onInput() {
    return this.blockNav === true;
  }

  back() {
    saveSettings();
    this.app.goMenu();
  }
}
