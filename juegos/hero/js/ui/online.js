// Multijugador en línea: conexión, sala (lobby) y orquestación de partidas.
import { h, Screen, toast } from './dom.js';
import { NetClient } from '../net/net.js';
import { library, artImg } from '../library.js';
import { PARTS, PART_ORDER, DIFF_LABEL } from '../core/constants.js';
import { settings, saveSettings } from '../settings.js';
import { SongSelectScreen, tocaVistaPrevia, cancelaVistaPrevia } from './songSelect.js';
import { SettingsScreen, ALTO_AYUDA } from './settingsScreen.js';
import { NOTE_MODES } from '../core/noteMode.js';
import { sitio, pantallaCompleta } from '../sitio/puente.js';
import { enElCentro } from '../game/orden.js';

const DIFF_UI = ['expert', 'hard', 'medium', 'easy'];
const chatLog = [];

// En una sala de Juegos (?modo=online) se entra directo: la página ya sabe quién eres.
export async function entraSala(app) {
  try {
    await ensureNet(app);
    app.show(new LobbyScreen(app));
  } catch (err) {
    toast(err.message, 5000);
    app.show(new OnlineScreen(app));
  }
}

async function ensureNet(app) {
  if (app.net?.connected) return app.net;
  const net = new NetClient();
  await net.connect();
  app.net = net;
  app.onlineProfile ??= app.defaultProfileId();
  net.on('error', (m) => toast(m.msg));
  net.on('room', () => {
    // quien mira (o entró tarde) no está en la ronda: si había partida, vuelve a la sala
    if (!app.screen && !app.session) app.show(new LobbyScreen(app));
  });
  net.on('chat', (m) => {
    chatLog.push(m);
    if (chatLog.length > 60) chatLog.shift();
    app.screen?.onChat?.();
  });
  net.on('load', (m) => onLoad(app, m));
  net.on('go', (m) => onGo(app, m));
  net.on('pstate', (m) => app.session?.onRemoteState(m));
  net.on('close', () => {
    toast('Desconectado del servidor');
    app.net = null;
    if (app.session) {
      app.session.destroy();
      app.session = null;
    }
    app.goMenu();
  });
  return net;
}

async function onLoad(app, m) {
  const net = app.net;
  const entry = library.byId.get(m.songId);
  if (!entry) {
    toast('Esta canción no está en tu biblioteca');
    net.send({ t: 'noload' });
    return;
  }
  const room = net.room;
  const players = enElCentro(room.players
    .filter((p) => p.inGame)
    .map((p) => p.id === net.id
      ? { type: 'local', id: p.id, name: p.name, part: p.part, diff: p.diff, mode: p.mode, profileId: app.onlineProfile, bot: !!app.onlineBot }
      : { type: 'remote', id: p.id, name: p.name, part: p.part, diff: p.diff, mode: p.mode }));
  app.screen?.unmount();
  const session = await app.prepareSession(entry, players, net);
  net.send({ t: session ? 'loaded' : 'noload' });
}

function onGo(app, m) {
  const s = app.session;
  if (!s || s.running) return;
  const inGame = new Set(m.room.players.filter((p) => p.inGame).map((p) => p.id));
  s.players = s.players.filter((p) => p.type !== 'remote' || inGame.has(p.id));
  if (!inGame.has(app.net.id)) {
    s.destroy();
    app.session = null;
    app.show(new LobbyScreen(app));
    return;
  }
  s.start(app.net.serverToPerf(m.at));
}

export class OnlineScreen extends Screen {
  render() {
    // En una sala de Juegos que no respondió: solo queda reintentar
    if (sitio.sala) {
      return h('div', { class: 'screen online' },
        h('div', { class: 'ss-head' }, h('h1', {}, 'Sala de PRO HERO')),
        h('div', { class: 'online-box' },
          h('p', {}, 'No se pudo entrar a la sala. Revisa tu conexión y vuelve a intentarlo.'),
          h('button', { class: 'primary big', 'data-nav': true, onclick: () => entraSala(this.app) }, 'Reintentar')));
    }
    // Ya no hay servidor propio: el multijugador son las salas de Juegos
    if (!sitio.sala) {
      return h('div', { class: 'screen online' },
        h('div', { class: 'ss-head' },
          h('button', { class: 'back-btn', onclick: () => this.back() }, '‹'),
          h('h1', {}, 'Multijugador en línea')),
        h('div', { class: 'online-box' },
          h('p', {}, 'Las salas de PRO HERO se abren en el salón de Juegos: crea una sala de PRO HERO, comparte el enlace y elige la canción.'),
          sitio.embebido ? h('button', { class: 'primary big', 'data-nav': true, onclick: () => sitio.envia('en-linea') }, 'Ir al salón') : null));
    }
    this.name = h('input', { type: 'text', placeholder: 'Tu nombre', maxlength: 20, value: settings.playerName, 'data-nav': true });
    this.code = h('input', { type: 'text', placeholder: 'CÓDIGO', maxlength: 4, class: 'code-input', 'data-nav': true });
    return h('div', { class: 'screen online' },
      h('div', { class: 'ss-head' },
        h('button', { class: 'back-btn', onclick: () => this.back() }, '‹'),
        h('h1', {}, 'Multijugador en línea')),
      h('div', { class: 'online-box' },
        h('label', { class: 'set-row' }, h('span', {}, 'Nombre'), this.name),
        h('button', { class: 'primary big', 'data-nav': true, onclick: () => this.go('create') }, 'Crear sala'),
        h('div', { class: 'or' }, 'o únete con un código'),
        h('div', { class: 'join-row' }, this.code, h('button', { 'data-nav': true, onclick: () => this.go('join') }, 'Unirse')),
        h('p', { class: 'hint' },
          'Todos los jugadores deben abrir el juego desde este mismo servidor: ',
          h('b', {}, location.origin),
          '. Para jugar fuera de tu red local, abre el puerto o usa un túnel (ver README).')));
  }

  afterMount() {
    this.focusFirst();
  }

  async go(kind) {
    const name = this.name.value.trim();
    if (!name) {
      toast('Escribe tu nombre');
      this.name.focus();
      return;
    }
    settings.playerName = name;
    saveSettings();
    try {
      const net = await ensureNet(this.app);
      net.send({ t: 'hello', name });
      const off = net.on('room', () => {
        off();
        this.app.show(new LobbyScreen(this.app));
      });
      if (kind === 'create') net.send({ t: 'create' });
      else net.send({ t: 'join', code: this.code.value.trim().toUpperCase() });
    } catch (err) {
      toast(err.message);
    }
  }

  back() {
    this.app.goMenu();
  }
}

export class LobbyScreen extends Screen {
  render() {
    this.left = h('div', { class: 'lobby-players' });
    this.center = h('div', { class: 'lobby-song' });
    this.mine = h('div', { class: 'lobby-mine' });
    this.chat = h('div', { class: 'chat-log' });
    this.chatInput = h('input', { type: 'text', placeholder: 'Escribe un mensaje y pulsa Enter', maxlength: 200,
      onkeydown: (e) => {
        if (e.key === 'Enter' && this.chatInput.value.trim()) {
          this.app.net.send({ t: 'chat', text: this.chatInput.value.trim() });
          this.chatInput.value = '';
        }
      } });
    this.codeEl = h('span', { class: 'room-code' });
    // En Juegos la sala, el chat y el botón de abandonar son de la página
    if (sitio.sala) {
      return h('div', { class: 'screen lobby' },
        h('div', { class: 'ss-head' }, h('h1', {}, 'Sala de PRO HERO'), this.codeEl),
        h('div', { class: 'lobby-body sin-chat' },
          this.left,
          h('div', { class: 'lobby-mid' }, this.center, this.mine)));
    }
    return h('div', { class: 'screen lobby' },
      h('div', { class: 'ss-head' },
        h('button', { class: 'back-btn', onclick: () => this.back() }, '‹'),
        h('h1', {}, 'Sala '), this.codeEl,
        h('button', { class: 'leave', onclick: () => this.leave() }, 'Salir de la sala')),
      h('div', { class: 'lobby-body' },
        this.left,
        h('div', { class: 'lobby-mid' }, this.center, this.mine),
        h('div', { class: 'lobby-chat' }, this.chat, this.chatInput)));
  }

  afterMount() {
    this.off = this.app.net?.on('room', () => this.update());
    this.offOjeo = this.app.net?.on('browse', () => this.update());
    this.update();
    this.onChat();
  }

  beforeUnmount() {
    this.off?.();
    this.offOjeo?.();
    cancelaVistaPrevia();
    this.app.preview.stop();
  }

  // Suena la vista previa de lo que hojea quien dirige o, si no, de la canción elegida
  suena(entry) {
    const id = entry?.id ?? null;
    if (id === this.sonando) return;
    this.sonando = id;
    tocaVistaPrevia(this.app, entry);
  }

  tarjeta(entry, arte = true) {
    return h('div', { class: 'ls-card' },
      (arte && artImg(entry, '', false)) || h('div', { class: 'album empty' }, '♪'),
      h('div', {}, h('div', { class: 'd-name' }, entry.meta.name), h('div', { class: 'd-artist' }, entry.meta.artist),
        h('div', { class: 'd-charter' }, entry.meta.charter ? `Chart: ${entry.meta.charter}` : '')));
  }

  // La canción que tiene marcada quien dirige en su selector (si no eres tú)
  ojeada(room, isHost) {
    const o = this.app.net?.ojeo;
    if (isHost || room.phase !== 'lobby' || !o || o.from !== room.host || o.songId === room.songId) return null;
    return library.byId.get(o.songId) || null;
  }

  ojeoEl(oj, entry) {
    return [h('div', { class: 'ls-ojeo' }, '👀 El anfitrión está mirando…'), this.tarjeta(oj),
      entry ? h('div', { class: 'ls-elegida' }, 'Elegida: ', h('b', {}, entry.meta.name), ` · ${entry.meta.artist}`) : null].filter(Boolean);
  }

  ajustesEl() {
    return h('div', { class: 'lobby-ajustes' },
      h('button', { 'data-nav': true, onclick: () => this.app.show(new SettingsScreen(this.app, 'controls')) }, '🎮 Controles'),
      h('button', { 'data-nav': true, onclick: () => this.app.show(new SettingsScreen(this.app)) }, '⚙ Ajustes'));
  }

  onLibrary() {
    this.update();
  }

  onChat() {
    this.chat.replaceChildren(...chatLog.map((m) => h('div', {}, h('b', {}, `${m.from}: `), m.text)));
    this.chat.scrollTop = this.chat.scrollHeight;
  }

  update() {
    const net = this.app.net;
    const room = net?.room;
    if (!room && sitio.sala && net?.connected) {
      // la sala llega justo después del saludo
      this.center.replaceChildren(h('div', { class: 'ls-empty' }, 'Conectando con la sala…'));
      return;
    }
    if (!room) return this.app.show(new OnlineScreen(this.app));
    const me = room.players.find((p) => p.id === net.id);
    const isHost = room.host === net.id;
    const entry = room.songId ? library.byId.get(room.songId) : null;
    const oj = this.ojeada(room, isHost);
    this.suena(room.phase === 'lobby' ? oj || entry : null);
    this.codeEl.textContent = room.code;
    // quien mira la sala (o la canción no está en tu biblioteca) no elige nada
    if (!me) {
      this.left.replaceChildren(h('h3', {}, `Jugadores (${room.players.length}/${room.cupo || 8})`), ...room.players.map((p) =>
        h('div', { class: 'lp-row' }, h('span', { class: 'lp-name', translate: 'no' }, `${room.host === p.id ? '👑 ' : ''}${p.name}`),
          h('span', { class: 'lp-part' }, `${PARTS[p.part]?.label || '?'} · ${DIFF_LABEL[p.diff] || '?'}`))));
      this.center.replaceChildren(...(oj ? this.ojeoEl(oj, entry) : [entry
        ? this.tarjeta(entry)
        : h('div', { class: 'ls-empty' }, 'Todavía no hay canción elegida.')]));
      this.mine.replaceChildren(h('p', { class: 'hint' }, room.phase === 'lobby' ? 'Estás mirando esta sala.' : 'Están tocando. Estás mirando esta sala.'), this.ajustesEl());
      return;
    }


    // Si la canción no tiene mi instrumento/dificultad, elige otro automáticamente
    if (entry && me) {
      const parts = PART_ORDER.filter((p) => entry.parts[p]);
      let part = parts.includes(me.part) ? me.part : parts[0];
      const diffs = DIFF_UI.filter((d) => entry.parts[part]?.[d]);
      let diff = diffs.includes(me.diff) ? me.diff : diffs[0];
      if (part !== me.part || diff !== me.diff || !me.mode) net.send({ t: 'part', part, diff, mode: me.mode || settings.noteMode });
    }

    this.left.replaceChildren(h('h3', {}, `Jugadores (${room.players.length}/${room.cupo || 8})`), ...room.players.map((p) =>
      h('div', { class: `lp-row${p.id === net.id ? ' me' : ''}` },
        h('span', { class: 'lp-name', translate: 'no' }, `${room.host === p.id ? '👑 ' : ''}${p.name}`),
        h('span', { class: 'lp-part' }, `${PARTS[p.part]?.label || '?'} · ${DIFF_LABEL[p.diff] || '?'}`),
        h('span', { class: `lp-ready${p.ready || room.host === p.id ? ' ok' : ''}` }, room.host === p.id ? 'Anfitrión' : p.ready ? 'Listo' : 'Esperando'))));

    this.center.replaceChildren(...(oj ? this.ojeoEl(oj, entry) : []), ...[
      oj ? null : entry
        ? this.tarjeta(entry)
        : h('div', { class: 'ls-empty' }, room.songId && library.songs.length ? 'La canción elegida no está en tu biblioteca.' : isHost ? 'Elige una canción para empezar' : 'Esperando a que el anfitrión elija canción…'),
      isHost ? h('button', { 'data-nav': true, onclick: () => this.pickSong() }, entry ? 'Cambiar canción' : 'Elegir canción') : null].filter(Boolean));

    const parts = entry ? PART_ORDER.filter((p) => entry.parts[p]) : PART_ORDER;
    const diffs = entry ? DIFF_UI.filter((d) => entry.parts[me?.part]?.[d]) : DIFF_UI;
    const sendPart = (o) => net.send({ t: 'part', part: me.part, diff: me.diff, mode: me.mode || settings.noteMode, ...o });
    const partSel = h('select', { 'data-nav': true, onchange: () => sendPart({ part: partSel.value }) },
      ...parts.map((p) => h('option', { value: p, selected: p === me?.part }, PARTS[p].label)));
    const diffSel = h('select', { 'data-nav': true, onchange: () => sendPart({ diff: diffSel.value }) },
      ...diffs.map((d) => h('option', { value: d, selected: d === me?.diff }, DIFF_LABEL[d])));
    const modeSel = h('select', { 'data-nav': true, onchange: () => { settings.noteMode = modeSel.value; saveSettings(); sendPart({ mode: modeSel.value }); } },
      ...Object.entries(NOTE_MODES).map(([v, l]) => h('option', { value: v, selected: v === (me?.mode || settings.noteMode) }, l)));
    const profSel = h('select', { 'data-nav': true, onchange: () => { this.app.onlineProfile = profSel.value; } },
      ...settings.profiles.map((p) => h('option', { value: p.id, selected: p.id === this.app.onlineProfile }, p.name)));
    const alto = h('input', { type: 'checkbox', 'data-nav': true, onchange: () => { settings.altoRendimiento = alto.checked; saveSettings(); } });
    alto.checked = settings.altoRendimiento;
    const bot = h('input', { type: 'checkbox', onchange: () => { this.app.onlineBot = bot.checked; } });
    bot.checked = !!this.app.onlineBot;
    const faltan = room.players.filter((p) => p.id !== room.host && !p.ready).length;
    this.mine.replaceChildren(...[
      h('label', { class: 'set-row' }, h('span', {}, 'Instrumento'), partSel),
      h('label', { class: 'set-row' }, h('span', {}, 'Dificultad'), diffSel),
      h('label', { class: 'set-row' }, h('span', {}, 'Notas'), modeSel),
      h('label', { class: 'set-row' }, h('span', {}, 'Control'), profSel),
      h('label', { class: 'set-row check' }, h('span', {}, 'Alto rendimiento', h('small', {}, ALTO_AYUDA)), alto),
      sitio.sala ? null : h('label', { class: 'set-row check' }, h('span', {}, 'Bot (pruebas)'), bot),
      this.ajustesEl(),
      sitio.sala ? h('p', { class: 'd-aviso' }, '★ Doradas solo en Experto (o la dificultad más alta del instrumento). Tus estrellas y monedas se guardan igual que tocando solo.') : null,
      isHost
        ? h('button', { class: 'primary big', 'data-nav': true, disabled: !entry || room.phase !== 'lobby' || faltan > 0, onclick: () => { pantallaCompleta(); net.send({ t: 'start' }); } },
          room.phase === 'loading' ? 'Cargando…' : room.phase === 'playing' ? 'Tocando…' : faltan > 0 ? `Esperando que estén listos (${faltan})` : 'Empezar canción')
        : h('button', { class: `primary big${me?.ready ? ' on' : ''}`, 'data-nav': true, onclick: () => { if (!me?.ready) pantallaCompleta(); net.send({ t: 'ready', ready: !me?.ready }); } },
          me?.ready ? '¡Listo! (cancelar)' : 'Estoy listo')].filter(Boolean));
  }

  pickSong() {
    const net = this.app.net;
    this.app.show(new SongSelectScreen(this.app, {
      mode: 'pick',
      selectId: net.room?.songId,
      // los demás ven (y oyen) la canción que tienes marcada mientras eliges
      onBrowse: (entry) => net.send({ t: 'browse', songId: entry.id }),
      onPick: (entry) => {
        net.send({ t: 'browse', songId: null });
        if (entry) net.send({ t: 'song', songId: entry.id });
        this.app.show(new LobbyScreen(this.app));
      },
    }));
  }

  leave() {
    this.app.net?.send({ t: 'leave' });
    this.app.net.room = null;
    this.app.goMenu();
  }

  back() {
    this.app.goMenu();
  }
}
