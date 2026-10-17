// Selección de instrumento y dificultad. Otros jugadores locales pueden unirse
// pulsando el botón verde en su mando (o en el perfil "Teclado 2").
import { h, Screen } from './dom.js';
import { PARTS, PART_ORDER, DIFF_LABEL } from '../core/constants.js';
import { settings, profileById } from '../settings.js';
import { navAction, deviceMatches } from '../input/input.js';
import { NOTE_MODES } from '../core/noteMode.js';
import { celular } from '../sitio/celular.js';

const MODE_SHORT = { taps: 'Todo taps', normal: 'Normal', hopos: 'Todo HOPOs', strums: 'Todo rasgueo' };
import { SongSelectScreen } from './songSelect.js';

const DIFF_UI = ['easy', 'medium', 'hard', 'expert'];

export class PartSelectScreen extends Screen {
  constructor(app, entry) {
    super(app);
    this.entry = entry;
    // en el celular solo lo que se toca con cinco botones (la batería necesita bombo)
    this.parts = PART_ORDER.filter((p) => entry.parts[p] && !(celular && PARTS[p].kind === 'drums'));
    this.slots = [];
    this.addSlot(app.defaultProfileId());
  }

  addSlot(profileId) {
    const last = this.app.lastChoice[profileId] || {};
    const partIdx = Math.max(0, this.parts.indexOf(last.part));
    const slot = {
      profileId,
      name: this.slots.length === 0 && settings.playerName ? settings.playerName : `Jugador ${this.slots.length + 1}`,
      step: 'part',
      partIdx,
      diffIdx: 0,
      bot: false,
      mode: celular ? 'taps' : last.mode || settings.noteMode,
      wantDiff: last.diff || 'expert',
    };
    this.slots.push(slot);
    this.resetDiff(slot);
    if (this.el) this.renderSlots();
  }

  diffsFor(slot) {
    const p = this.parts[slot.partIdx];
    return DIFF_UI.filter((d) => this.entry.parts[p]?.[d]);
  }

  resetDiff(slot) {
    const diffs = this.diffsFor(slot);
    const i = diffs.indexOf(slot.wantDiff);
    slot.diffIdx = i >= 0 ? i : diffs.length - 1;
  }

  render() {
    this.slotsEl = h('div', { class: 'slots' });
    const m = this.entry.meta;
    return h('div', { class: 'screen part-select' },
      h('div', { class: 'ss-head' },
        h('button', { class: 'back-btn', onclick: () => this.back() }, '‹'),
        h('h1', {}, m.name), h('span', { class: 'count' }, m.artist)),
      this.slotsEl,
      h('div', { class: 'hint' }, 'Arriba/abajo para elegir · Verde/Enter confirmar · Rojo/Esc volver · Otro jugador: pulsa verde en tu mando o "H" (Teclado 2) para unirte'));
  }

  afterMount() {
    this.renderSlots();
  }

  renderSlots() {
    const cols = this.slots.map((slot, si) => {
      const prof = profileById(slot.profileId);
      let items;
      if (slot.step === 'part') {
        items = this.parts.map((p, i) => this.item(slot, i === slot.partIdx, PARTS[p].label, () => {
          slot.partIdx = i;
          this.slotNav(slot, 'confirm');
        }, `i-${p}`));
        items.push(this.item(slot, slot.partIdx === this.parts.length, `Notas: ${MODE_SHORT[slot.mode]}`, () => {
          slot.partIdx = this.parts.length;
          this.slotNav(slot, 'confirm');
        }));
        items.push(this.item(slot, slot.partIdx === this.parts.length + 1, `Bot: ${slot.bot ? 'Sí' : 'No'}`, () => {
          slot.partIdx = this.parts.length + 1;
          this.slotNav(slot, 'confirm');
        }));
      } else if (slot.step === 'diff') {
        items = this.diffsFor(slot).map((d, i) => this.item(slot, i === slot.diffIdx, DIFF_LABEL[d], () => {
          slot.diffIdx = i;
          this.slotNav(slot, 'confirm');
        }));
      } else {
        items = [h('div', { class: 'ready-badge' }, '¡LISTO!')];
      }
      const part = this.parts[Math.min(slot.partIdx, this.parts.length - 1)];
      return h('div', { class: `slot step-${slot.step}` },
        h('div', { class: 'slot-head' },
          h('span', { class: 'slot-p' }, `P${si + 1}`),
          h('span', { class: 'slot-name' }, slot.name),
          h('span', { class: 'slot-dev' }, celular ? 'Pantalla táctil' : prof?.name || '')),
        h('div', { class: 'slot-sum' }, slot.step !== 'part' ? `${PARTS[part].label}${slot.step === 'ready' ? ' · ' + DIFF_LABEL[this.diffsFor(slot)[slot.diffIdx]] : ''}${slot.bot ? ' · BOT' : ''}` : (slot.bot ? 'Modo bot activado' : `Elige instrumento · ${MODE_SHORT[slot.mode]}`)),
        h('div', { class: 'slot-items' }, ...items),
        si > 0 ? h('button', { class: 'slot-leave', onclick: () => this.removeSlot(slot) }, 'Salir') : null);
    });
    if (this.slots.length < 4 && !celular) {
      cols.push(h('div', { class: 'slot join' }, h('div', { class: 'join-text' }, '+', h('small', {}, 'Pulsa verde para unirte'))));
    }
    this.slotsEl.replaceChildren(...cols);
  }

  item(slot, selected, label, onclick, icon) {
    return h('button', { class: `slot-item${selected ? ' sel' : ''}`, onclick }, icon ? h('span', { class: `inst-icon ${icon}` }) : null, label);
  }

  removeSlot(slot) {
    this.slots = this.slots.filter((s) => s !== slot);
    this.renderSlots();
    this.checkStart();
  }

  slotNav(slot, a) {
    const isFirst = slot === this.slots[0];
    if (slot.step === 'part') {
      const n = this.parts.length + 2;
      if (a === 'up') slot.partIdx = (slot.partIdx - 1 + n) % n;
      else if (a === 'down') slot.partIdx = (slot.partIdx + 1) % n;
      else if (a === 'confirm') {
        if (slot.partIdx === this.parts.length) {
          if (celular) return; // sin rasgueo: siempre todo taps
          const modes = Object.keys(NOTE_MODES);
          slot.mode = modes[(modes.indexOf(slot.mode) + 1) % modes.length];
        } else if (slot.partIdx === this.parts.length + 1) slot.bot = !slot.bot;
        else {
          this.resetDiff(slot);
          slot.step = 'diff';
        }
      } else if (a === 'back') {
        if (isFirst) return this.back();
        return this.removeSlot(slot);
      }
    } else if (slot.step === 'diff') {
      const n = this.diffsFor(slot).length;
      if (a === 'up') slot.diffIdx = (slot.diffIdx - 1 + n) % n;
      else if (a === 'down') slot.diffIdx = (slot.diffIdx + 1) % n;
      else if (a === 'confirm') slot.step = 'ready';
      else if (a === 'back') slot.step = 'part';
    } else if (slot.step === 'ready' && a === 'back') slot.step = 'diff';
    this.renderSlots();
    this.checkStart();
  }

  checkStart() {
    if (!this.slots.length || !this.slots.every((s) => s.step === 'ready')) return;
    const players = this.slots.map((s) => {
      const part = this.parts[s.partIdx];
      const diff = this.diffsFor(s)[s.diffIdx];
      this.app.lastChoice[s.profileId] = { part, diff, mode: s.mode };
      return { type: 'local', name: s.name, part, diff, profileId: s.profileId, bot: s.bot, mode: s.mode };
    });
    setTimeout(() => this.app.playLocal(this.entry, players), 250);
  }

  back() {
    this.app.show(new SongSelectScreen(this.app, { mode: 'play', selectId: this.entry.id }));
  }

  onInput(ev) {
    if (!ev.down) return true;
    let firstKeyboard = true;
    for (const slot of this.slots) {
      const prof = profileById(slot.profileId);
      if (!prof || !deviceMatches(prof, ev)) continue;
      let a = null;
      if (prof.device !== 'keyboard' || firstKeyboard) a = navAction(ev);
      if (!a) {
        const g = prof.guitar;
        if (g.up?.includes(ev.code)) a = 'up';
        else if (g.down?.includes(ev.code)) a = 'down';
        else if (g.g0?.includes(ev.code)) a = 'confirm';
        else if (g.g1?.includes(ev.code)) a = 'back';
      }
      if (prof.device === 'keyboard') firstKeyboard = false;
      if (a) {
        this.slotNav(slot, a);
        return true;
      }
    }
    // ¿Se une alguien?
    if (this.slots.length < 4) {
      const used = new Set(this.slots.map((s) => s.profileId));
      const gp = /^gamepad:(\d)$/.exec(ev.device);
      if (gp && (ev.code === 'b0' || ev.code === 'b9') && !used.has(`gp${gp[1]}`)) {
        this.addSlot(`gp${gp[1]}`);
        return true;
      }
      const kb2 = profileById('kb2');
      if (ev.device === 'keyboard' && !used.has('kb2') && kb2.guitar.g0.includes(ev.code)) {
        this.addSlot('kb2');
        return true;
      }
      if (ev.device === 'keyboard' && !used.has('kb1') && profileById('kb1').guitar.g0.includes(ev.code)) {
        this.addSlot('kb1');
        return true;
      }
    }
    return true;
  }
}
