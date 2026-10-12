// Sesión de juego: une audio, motores de cada jugador, entrada, red y render.
import { createEngine, Bot, PENDING, HIT, MISSED, DROPPED } from '../core/engine.js';
import { PARTS, DIFF_LABEL } from '../core/constants.js';
import { SongAudio } from '../audio/audio.js';
import { HighwayRenderer } from '../render/highway.js';
import { buildActionMap, deviceMatches, navAction, codeLabel } from '../input/input.js';
import { applyNoteMode } from '../core/noteMode.js';
import { settings, profileById } from '../settings.js';
import { songUrl, fetchSongFile, fileUrl, library } from '../library.js';
import { h } from '../ui/dom.js';
import { Grabadora, opcionesMotor } from './prueba.js';

const PLAYER_COLORS = ['#ffffff', '#ffb21e', '#53e7ff', '#ff6fb5', '#9dff6f', '#c79bff', '#ff8a5c', '#5cffd6'];
const STATE_INTERVAL = 100;
// Sucesos de notas que viajan en cada estado (los últimos): el canal no reenvía lo perdido
const EV_DIRECTO = 40;

// Estado de un jugador remoto reconstruido a partir de los mensajes de red
class RemoteState {
  constructor(track, kind) {
    this.kind = kind;
    this.track = track;
    this.notes = track.notes;
    this.noteState = new Uint8Array(track.notes.length);
    this.held = 0;
    this.laneHitTime = new Float64Array(8).fill(-100);
    this.padHitTime = new Float64Array(7).fill(-100);
    this.score = 0;
    this.combo = 0;
    this.mult = 1;
    this.prog = 0;
    this.sp = 0;
    this.spActive = false;
    this.solo = null;
    this.sus = 0;
    this.onHitFx = null;
    const np = track.spPhrases.length;
    this.phraseFailed = new Uint8Array(np);
    this.phraseHits = new Uint16Array(np);
    this.phraseTotal = new Uint16Array(np);
    for (const nt of track.notes) if (nt.sp >= 0 && !nt.double) this.phraseTotal[nt.sp]++;
  }
  multiplier() { return this.mult; }
  comboProgress() { return this.prog; }
  currentSolo() { return this.solo; }
  sustainingMask() { return this.sus; }

  apply(m, now) {
    this.score = m.s;
    this.combo = m.c;
    this.mult = m.m;
    this.prog = m.p;
    this.sp = m.sp;
    if (m.sa && !this.spActive) this.onHitFx?.(null, 'spActivate');
    this.spActive = !!m.sa;
    this.held = m.h || 0;
    this.sus = m.su || 0;
    this.solo = m.so || null;
    // El directo va por un canal que no reenvía lo perdido: cada estado trae
    // los últimos sucesos (`ev`), así que un suceso puede llegar varias veces.
    for (const [i, st] of m.ev || []) {
      if (!Number.isInteger(i) || i < 0 || i >= this.noteState.length || this.noteState[i] === st) continue;
      this.noteState[i] = st;
      const nt = this.notes[i];
      if (st === MISSED && nt.sp >= 0) this.phraseFailed[nt.sp] = 1;
      if (st !== HIT) continue;
      this.onHitFx?.(nt);
      if (nt.sp >= 0 && !this.phraseFailed[nt.sp] && ++this.phraseHits[nt.sp] === this.phraseTotal[nt.sp]) this.onHitFx?.(nt, 'phrase');
      if (this.kind === 'drums') {
        this.laneHitTime[nt.pad + 1] = now;
        this.padHitTime[nt.pad + 1] = now;
      } else if (nt.open) this.laneHitTime[5] = now;
      else for (let f = 0; f < 5; f++) if (nt.frets & (1 << f)) this.laneHitTime[f] = now;
    }
  }
}

export class GameSession {
  constructor(app, { entry, song, players, net = null, onFinish }) {
    this.app = app;
    this.entry = entry;
    this.song = song;
    this.net = net;
    this.onFinish = onFinish;
    this.audio = new SongAudio();
    this.renderer = new HighwayRenderer();
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this.finished = false;
    this.paused = false;
    this.lastStateSent = 0;
    this.players = players.map((pd, idx) => this._makePlayer(pd, idx, players.length));
    this.local = this.players.filter((p) => p.type !== 'remote');
    // Con un solo jugador humano, acepta teclado Y cualquier mando a la vez
    const humans = this.local.filter((p) => p.inputs && !p.bot);
    if (humans.length === 1) {
      const p = humans[0];
      for (const prof of settings.profiles) {
        if (prof.device === 'keyboard' || prof === p.profile) continue;
        p.inputs.push({ profile: prof, map: buildActionMap(prof, p.track.kind) });
      }
      if (p.profile.device !== 'keyboard') {
        const kb = profileById('kb1');
        p.inputs.push({ profile: kb, map: buildActionMap(kb, p.track.kind) });
      }
    }
  }

  _makePlayer(pd, idx, count) {
    const raw = this.song.parts[pd.part]?.[pd.diff];
    const mode = pd.mode || (pd.type === 'remote' ? 'normal' : settings.noteMode);
    const track = applyNoteMode(raw, mode);
    if (!track) throw new Error(`La canción no tiene ${pd.part}/${pd.diff}`);
    const p = {
      ...pd,
      track,
      popups: [],
      color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
      label: count > 1 ? `${pd.name} · ${PARTS[pd.part].label} ${DIFF_LABEL[pd.diff]}${pd.bot ? ' (BOT)' : ''}` : pd.bot ? 'BOT' : '',
      stems: PARTS[pd.part].stems,
      netEvents: [],
      fxQueue: [],
      frets: 0,
      mode,
    };
    if (pd.type === 'remote') {
      p.engine = new RemoteState(track, track.kind);
      p.engine.onHitFx = (nt, kind) => p.fxQueue.push(kind
        ? { type: kind, lanes: nt ? GameSession.noteLanes(nt, track.kind) : null }
        : this._hitFx(nt, track.kind, p.engine.spActive, p.engine.phraseFailed));
      return p;
    }
    // Las opciones del motor salen de la cabecera de la prueba: así el que
    // verifica el récord arma exactamente el mismo motor (prueba.js).
    const cab = { id: this.entry.id, p: pd.part, d: pd.diff, m: mode, xp: settings.expertPlus ? 1 : 0, pc: settings.proCymbals ? 1 : 0 };
    p.engine = createEngine(track, this.song.tempo, opcionesMotor(cab));
    if (pd.bot) p.bot = new Bot(p.engine);
    // un humano toca a través de la grabadora: el motor avanza en su rejilla fija
    else p.grab = new Grabadora(p.engine, cab);
    if (pd.profileId) {
      p.profile = profileById(pd.profileId);
      p.inputs = [{ profile: p.profile, map: buildActionMap(p.profile, track.kind) }];
      if (settings.showKeyLabels && p.profile.device === 'keyboard' && !pd.bot) p.keyLabels = this._keyLabels(p.profile, track);
    }
    p.engine.listener = (type, a, b) => this._onEngineEvent(p, type, a, b);
    return p;
  }

  // Teclas asignadas para mostrarlas bajo cada traste
  _keyLabels(profile, track) {
    if (track.kind === 'drums') {
      const b = profile.drums;
      const out = Array.from({ length: track.lanes }, (_, l) => codeLabel(b[`p${l}`]?.[0]));
      out.kick = codeLabel(b.kick?.[0]);
      return out;
    }
    return [0, 1, 2, 3, 4].map((f) => codeLabel(profile.guitar[`g${f}`]?.[0]));
  }

  static noteLanes(nt, kind) {
    if (kind === 'drums') return [nt.pad < 0 ? 'kick' : nt.pad];
    return nt.open ? ['open'] : [0, 1, 2, 3, 4].filter((f) => nt.frets & (1 << f));
  }

  // spActive: llamas azules; star: era una nota estrella (frase aún válida)
  _hitFx(nt, kind, spActive, phraseFailed) {
    return {
      type: 'hit', lanes: GameSession.noteLanes(nt, kind), sp: spActive,
      star: nt.sp >= 0 && !phraseFailed?.[nt.sp], gtype: nt.type, open: !!nt.open, cymbal: !!nt.cymbal,
    };
  }

  _onEngineEvent(p, type, a, b) {
    const now = this.now ?? 0;
    switch (type) {
      case 'hit':
        if (settings.muteOnMiss) this.audio.setMuted(p.stems, false);
        p.netEvents.push([a, HIT]);
        p.fxQueue.push(this._hitFx(p.engine.notes[a], p.engine.kind, p.engine.spActive, p.engine.phraseFailed));
        break;
      case 'comboBreak':
        if (a > 0) {
          p.fxQueue.push({ type: 'break', had: a });
          // solo suena al perder una racha con multiplicador x2 o más (10+ notas)
          if (settings.missSound && !p.bot && a >= 10) this.audio.loseStreak(Math.min(1, a / 50));
        }
        break;
      case 'miss':
        if (settings.muteOnMiss) this.audio.setMuted(p.stems, true);
        p.netEvents.push([a, MISSED]);
        break;
      case 'drop':
        p.netEvents.push([a, DROPPED]);
        break;
      case 'overstrum':
        if (settings.muteOnMiss) this.audio.setMuted(p.stems, true);
        p.fxQueue.push({ type: 'overstrum' });
        break;
      case 'spActivate':
        this.audio.spDeployed();
        p.fxQueue.push({ type: 'spActivate' });
        p.popups.push({ text: '¡STAR POWER!', t: now, color: '#53e7ff', big: true });
        break;
      case 'spPhrase': {
        p.fxQueue.push({ type: 'phrase', lanes: GameSession.noteLanes(p.engine.notes[b], p.engine.kind) });
        const ready = p.engine.sp >= 0.5 && !p.engine.spActive && !p.spReadyShown;
        // al llenarse la mitad de la barra suena "Star Power disponible" en vez del de frase
        this.audio.spAwarded(ready);
        if (ready) {
          p.spReadyShown = true;
          p.popups.push({ text: 'Star Power listo', t: now, color: '#53e7ff' });
        }
        break;
      }
      case 'spEnd':
        p.spReadyShown = false;
        this.audio.spReleased();
        break;
      case 'streak':
        if (a % 100 === 0 || a === 50) {
          p.popups.push({ text: `¡Racha de ${a} notas!`, t: now, color: '#ffd34d', big: a >= 100 });
          p.fxQueue.push({ type: 'streak' });
        }
        break;
      case 'soloEnd': {
        const pct = Math.round((b.hits / b.total) * 100);
        p.popups.push({ text: pct === 100 ? '¡SOLO PERFECTO!' : `Solo ${pct}%`, t: now, color: '#ffd34d' });
        p.popups.push({ text: `+${b.bonus.toLocaleString('es')}`, t: now, color: '#fff' });
        break;
      }
    }
  }

  // track(archivo) devuelve la función que recibe los bytes descargados de ese archivo
  async load(track) {
    const files = {};
    for (const [stem, file] of Object.entries(this.entry.audio)) files[stem] = () => fetchSongFile(this.entry, file, track?.(file));
    const bg = library.remote && this.entry.background && settings.showBackground
      ? fileUrl(this.entry, this.entry.background).then((u) => (this.bgUrl = u), () => null)
      : null;
    await Promise.all([this.audio.load(files), bg]);
    const stems = new Set(this.players.flatMap((p) => p.stems));
    this.audio.setStemVolumes([...stems]);
    this._setupBackground();
  }

  _setupBackground() {
    const video = document.getElementById('bgvideo');
    const img = document.getElementById('bgimage');
    this.video = null;
    video.removeAttribute('src');
    img.style.backgroundImage = '';
    if (library.remote) {
      // con Firebase solo se usa el fondo ya descargado (los videos no se suben)
      if (this.bgUrl) {
        img.style.backgroundImage = `url("${this.bgUrl}")`;
        img.classList.remove('blur');
        img.classList.add('on');
      }
    } else if (settings.showVideo && this.entry.video) {
      video.src = songUrl(this.entry, this.entry.video);
      video.muted = true;
      video.load();
      this.video = video;
      video.classList.add('on');
    } else if (settings.showBackground && (this.entry.background || this.entry.album)) {
      img.style.backgroundImage = `url("${songUrl(this.entry, this.entry.background || this.entry.album)}")`;
      img.classList.toggle('blur', !this.entry.background);
      img.classList.add('on');
    }
  }

  _clearBackground() {
    const video = document.getElementById('bgvideo');
    video.pause();
    video.classList.remove('on');
    video.removeAttribute('src');
    video.load();
    document.getElementById('bgimage').classList.remove('on');
  }

  start(perfStart = null) {
    this.running = true;
    this.endAt = Math.max(this.song.endTime + 2.5, Math.min(this.audio.duration + 0.3, this.song.endTime + 25));
    if (perfStart === null) this.audio.startWithLeadIn(2.2);
    else this.audio.startAtPerf(perfStart);
    // la autopista sube y los botones brotan uno tras otro, con su sonido
    this.introPerf = performance.now();
    this.audio.playSample('ripple', 0.8);
    this._showIntro();
    this.unsubInput = this.app.input.on((ev) => this.handleInput(ev));
    this.app.input.capture = true;
    this.resize = () => this._resize();
    window.addEventListener('resize', this.resize);
    // Como "pause_on_focus_lost" de Clone Hero: pausa si cambias de pestaña
    this.onVisibility = () => {
      if (document.hidden && !this.paused && !this.net && !this.finished) this.togglePause();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    this._resize();
    const frame = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      this.tick();
    };
    this.raf = requestAnimationFrame(frame);
  }

  _showIntro() {
    const m = this.entry.meta;
    this.introEl = h('div', { class: 'song-intro' },
      h('div', { class: 'si-name' }, m.name),
      h('div', { class: 'si-artist' }, m.artist),
      m.charter ? h('div', { class: 'si-charter' }, `Chart: ${m.charter}`) : null);
    this.app.overlay.append(this.introEl);
    setTimeout(() => this.introEl?.classList.add('hide'), 5500);
    // Ayuda rápida de controles para el jugador de teclado
    const kp = this.local.find((p) => p.keyLabels);
    if (kp) {
      const g = kp.profile.guitar;
      const txt = kp.track.kind === 'drums'
        ? `Golpea ${kp.keyLabels.join(' ')} y bombo ${kp.keyLabels.kick} cuando las notas lleguen a los círculos`
        : kp.mode === 'taps'
          ? `Pulsa ${kp.keyLabels.join(' ')} justo cuando cada nota llegue a su círculo (no hace falta rasguear). Barra morada: no pulses nada`
          : `Mantén el traste (${kp.keyLabels.join(' ')}) y rasguea con ${codeLabel(g.up?.[0])} / ${codeLabel(g.down?.[0])}`;
      this.helpEl = h('div', { class: 'play-help' }, txt, h('small', {}, `Star Power: ${codeLabel((kp.track.kind === 'drums' ? kp.profile.drums : g).sp?.[0])} · Pausa: Esc`));
      this.app.overlay.append(this.helpEl);
      setTimeout(() => this.helpEl?.classList.add('hide'), 7000);
    }
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.dpr = dpr;
  }

  handleInput(ev) {
    if (this.paused) {
      const a = navAction(ev);
      if (a) this.pauseMenu?.onNav(a);
      return;
    }
    for (const p of this.local) {
      if (!p.inputs || p.bot) continue;
      for (const inp of p.inputs) {
        if (!deviceMatches(inp.profile, ev)) continue;
        const actions = inp.map.get(ev.code);
        if (!actions) continue;
        const t = this.audio.timeAt(ev.time);
        // durante el retroceso y la parte repetida solo se siguen los trastes (no rasgueos ni golpes)
        const gated = this.rewind || t < this.resumeGate;
        for (const act of actions) {
          if (gated && !(act === 'start' || act === 'whammy' || /^g\d$/.test(act))) continue;
          this._playerAction(p, act, ev.down, t);
        }
        return;
      }
    }
  }

  _playerAction(p, act, down, t) {
    const e = p.engine;
    const g = p.grab;
    if (act === 'start') {
      if (down) this.togglePause();
      return;
    }
    if (!g) return;
    if (e.kind === 'guitar') {
      if (act[0] === 'g' && act.length === 2) {
        const bit = 1 << Number(act[1]);
        p.frets = down ? p.frets | bit : p.frets & ~bit;
        g.fret(p.frets, t);
      } else if ((act === 'up' || act === 'down') && down) g.strum(t);
      else if (act === 'sp' && down) g.sp(t);
      else if (act === 'whammy' && e.whammy !== down) g.whammy(down, t);
      return;
    }
    if (!down) return;
    if (act === 'kick') g.pad(-1, t);
    else if (act[0] === 'p') {
      const pad = Number(act[1]);
      if (pad < e.track.lanes) g.pad(pad, t, settings.proCymbals && e.track.pro ? false : null);
    } else if (act[0] === 'c') g.pad(Number(act[1]), t, settings.proCymbals ? true : null);
    else if (act === 'sp') g.sp(t);
  }

  tick() {
    const perf = performance.now();
    const rw = this.rewind;
    if (rw) this._rewindStep(rw, perf);
    const now = this.audio.songTime(perf);
    this.now = now;
    if (!this.rewind) {
      for (const p of this.local) {
        if (p.grab) p.grab.hasta(now);
        else {
          p.bot?.update(now);
          p.engine.update(now);
        }
      }
      this._syncVideo(now);
    }
    this._sendState(perf);
    this.draw(now);
    if (!this.finished && now > this.endAt) this.finish();
  }

  // Retroceso tras la pausa: la pista corre hacia atrás y luego cuenta 3, 2, 1
  _rewindStep(rw, perf) {
    if (perf >= rw.goPerf) {
      this.rewind = null;
      return;
    }
    const k = Math.min(1, (perf - rw.t0) / rw.dur);
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    this.audio.pausedAt = rw.from - (rw.from - rw.to) * e;
    const count = k < 1 || !rw.step ? 0 : 3 - Math.floor((perf - rw.t0 - rw.dur) / rw.step);
    if (count !== rw.count) {
      rw.count = count;
      if (count > 0) this.audio.sfx('tick');
    }
  }

  _syncVideo(now) {
    const v = this.video;
    if (!v || this.paused) return;
    const target = now + (this.entry.meta.videoStart || 0) / 1000 + settings.videoOffset / 1000;
    if (target < 0 || (v.duration && target > v.duration)) {
      if (!v.paused) v.pause();
      return;
    }
    if (v.paused && v.readyState >= 2) v.play().catch(() => {});
    if (v.readyState >= 1 && Math.abs(v.currentTime - target) > 0.2 && perfThrottle(this, 1000)) v.currentTime = target;
  }

  _sendState(perf) {
    if (!this.net || perf - this.lastStateSent < STATE_INTERVAL) return;
    this.lastStateSent = perf;
    const p = this.local[0];
    if (!p) return;
    const e = p.engine;
    const solo = e.currentSolo(this.now);
    this.net.send({
      t: 'state',
      s: Math.floor(e.score), c: e.combo, m: e.multiplier(), p: e.comboProgress(),
      sp: Math.round(e.sp * 1000) / 1000, sa: e.spActive ? 1 : 0,
      h: e.kind === 'guitar' ? e.held : 0,
      su: e.kind === 'guitar' ? e.sustainingMask() : 0,
      so: solo,
      ev: (p.netEvents = p.netEvents.slice(-EV_DIRECTO)),
    });
  }

  onRemoteState(m) {
    const p = this.players.find((q) => q.type === 'remote' && q.id === m.id);
    if (p) p.engine.apply(m, this.now ?? 0);
  }

  draw(now) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = W / this.dpr, hh = H / this.dpr;
    const n = this.players.length;
    const colW = w / n;
    const opts = {
      noteSpeed: settings.noteSpeed, lefty: settings.lefty, tilt: settings.highwayTilt,
      style: settings.highwayStyle, shake: settings.screenShake,
      rewinding: !!this.rewind,
      introAge: this.introPerf ? (performance.now() - this.introPerf) / 1000 : 99,
    };
    this.players.forEach((p, i) => {
      const view = n === 1 ? { x: 0, y: 0, w, h: hh } : { x: i * colW, y: 0, w: colW, h: hh };
      this.renderer.draw(ctx, view, p, now, this.song, { ...opts, keyLabels: p.keyLabels });
    });

    // barra de progreso de la canción
    const prog = Math.max(0, Math.min(1, now / this.endAt));
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = '#ffb21e';
    ctx.fillRect(0, 0, w * prog, 4);

    if (this.rewind) this._drawRewind(ctx, w, hh);

    // cuenta atrás
    if (now < 0) {
      const c = Math.ceil(-now);
      if (c <= 3) {
        ctx.font = `800 ${Math.round(hh * 0.12)}px Rajdhani, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(255,255,255,${(-now % 1) * 0.9 + 0.1})`;
        ctx.fillText(String(c), w / 2, hh * 0.4);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  _drawRewind(ctx, w, hh) {
    const rw = this.rewind;
    if (!rw.step) return;
    const perf = performance.now();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (rw.count === 0) {
      // pista "rebobinando": velo azulado y símbolo ◀◀ que late
      const k = (perf - rw.t0) / rw.dur;
      ctx.fillStyle = `rgba(30,60,140,${0.18 * Math.sin(Math.PI * Math.min(1, k))})`;
      ctx.fillRect(0, 0, w, hh);
      ctx.font = `800 ${Math.round(hh * 0.09)}px Rajdhani, "Segoe UI", sans-serif`;
      ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.4 * Math.abs(Math.sin(perf / 90))})`;
      ctx.fillText('◀◀', w / 2, hh * 0.32);
    } else {
      const f = ((perf - rw.t0 - rw.dur) % rw.step) / rw.step;
      const sc = 1 + 0.5 * (1 - f) ** 3;
      ctx.font = `800 ${Math.round(hh * 0.14 * sc)}px Rajdhani, "Segoe UI", sans-serif`;
      ctx.shadowColor = 'rgba(255,178,30,0.9)';
      ctx.shadowBlur = 30 * (1 - f);
      ctx.fillStyle = `rgba(255,255,255,${1 - f * 0.7})`;
      ctx.fillText(String(rw.count), w / 2, hh * 0.38);
    }
    ctx.restore();
  }

  togglePause() {
    if (this.finished) return;
    if (this.rewind) {
      // pausa en pleno retroceso: se cancela y se queda donde iba
      this.rewind = null;
      this.paused = true;
      this.audio.pause();
      this.pauseMenu = this.app.showPauseMenu(false, {
        resume: () => this.resumeGame(),
        volume: () => this.audio.refreshVolumes(),
        restart: () => this.restart(),
        quit: () => this.quit(),
      });
      return;
    }
    if (this.paused) return this.resumeGame();
    if (this.net) {
      // en línea no se puede pausar: solo salir
      this.paused = true;
      this.pauseMenu = this.app.showPauseMenu(true, {
        resume: () => this.resumeGame(),
        volume: () => this.audio.refreshVolumes(),
        quit: () => this.quit(),
      });
      return;
    }
    this.paused = true;
    this.audio.pause();
    this.video?.pause();
    this.pauseMenu = this.app.showPauseMenu(false, {
      resume: () => this.resumeGame(),
      volume: () => this.audio.refreshVolumes(),
      restart: () => this.restart(),
      quit: () => this.quit(),
    });
  }

  resumeGame() {
    this.pauseMenu?.close();
    this.pauseMenu = null;
    this.paused = false;
    if (!this.net) this._rewindAndResume();
    for (const p of this.local) {
      // al volver de la pausa, se sueltan los trastes para evitar estados pegados
      p.frets = 0;
      if (p.engine.kind !== 'guitar') continue;
      if (p.grab) p.grab.suelta(this.now ?? 0);
      else p.engine.held = 0;
    }
  }

  // Como Clone Hero: al quitar la pausa la pista retrocede unos segundos y cuenta atrás
  async _rewindAndResume() {
    const from = this.audio.pausedAt;
    const to = from > 0 ? Math.max(0, from - REWIND_SECS) : from;
    const t0 = performance.now();
    // pausa durante la entrada (antes del segundo 0): se reanuda sin retroceso
    const quick = from <= 0;
    const dur = quick ? 120 : 1000, step = quick ? 0 : 600;
    const rw = { from, to, t0, dur, step, goPerf: t0 + dur + 3 * step, count: -1 };
    this.resumeGate = Math.max(this.resumeGate ?? -Infinity, from - 0.2);
    this.rewind = rw;
    // los efectos van atados al tiempo de canción: al retroceder se descartan
    for (const p of this.players) {
      if (p.fx) p.fx = null;
    }
    await this.audio.beginRewind();
    if (this.rewind !== rw) return; // se volvió a pausar mientras tanto
    if (dur) this.audio.playSample('rewind', 0.85);
    this.audio.resumeFrom(to, rw.goPerf);
    this.audio.pausedAt = from;
  }

  restart() {
    this.pauseMenu?.close();
    this.destroy();
    this.app.restartSession();
  }

  quit() {
    this.pauseMenu?.close();
    this.destroy();
    if (this.net) this.net.send({ t: 'done', stats: { ...this.local[0].engine.stats(), quit: true } });
    this.app.afterSessionQuit(this.net);
  }

  finish() {
    this.finished = true;
    const results = this.players.map((p) => ({
      name: p.name, part: p.part, diff: p.diff, bot: !!p.bot, type: p.type, id: p.id,
      stats: p.type === 'remote' ? null : p.engine.stats(),
      detail: p.type === 'remote' ? null : this._detail(p),
      // la prueba del primer jugador humano: con ella la página verifica y guarda el récord
      prueba: p === this.local[0] && p.grab ? p.grab.texto() : null,
    }));
    if (this.net) {
      this._sendState(Infinity);
      this.net.send({ t: 'done', stats: results.find((r) => r.type !== 'remote')?.stats });
    }
    setTimeout(() => {
      this.destroy();
      this.onFinish?.(results);
    }, 600);
  }

  // Detalle para la pantalla de resultados: aciertos a lo largo de la canción, por sección y por solo
  _detail(p) {
    const e = p.engine;
    const notes = e.notes;
    if (!notes.length) return null;
    const t0 = notes[0].time, t1 = notes[notes.length - 1].time;
    const N = 48;
    const timeline = Array.from({ length: N }, () => [0, 0]);
    const secs = (this.song.sections || []).filter((x) => x.time <= t1).sort((a, b) => a.time - b.time);
    const bySec = secs.map((x) => ({ name: x.name, hits: 0, total: 0 }));
    let si = -1;
    notes.forEach((nt, i) => {
      const hit = e.noteState[i] === HIT;
      const b = Math.min(N - 1, Math.floor(((nt.time - t0) / Math.max(0.001, t1 - t0)) * N));
      timeline[b][hit ? 0 : 1]++;
      while (si + 1 < secs.length && secs[si + 1].time <= nt.time + 1e-3) si++;
      if (si >= 0) {
        bySec[si].total++;
        if (hit) bySec[si].hits++;
      }
    });
    const solos = [];
    for (let k = 0; k < (e.soloTotal?.length || 0); k++) {
      if (e.soloTotal[k]) solos.push({ hits: e.soloHits[k], total: e.soloTotal[k], bonus: e.soloHits[k] * 100 });
    }
    return { timeline, sections: bySec.filter((x) => x.total > 0), solos, soloBonus: e.soloBonus || 0 };
  }

  destroy() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unsubInput?.();
    this.app.input.capture = false;
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.stop();
    this.introEl?.remove();
    this.helpEl?.remove();
    this._clearBackground();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

const REWIND_SECS = 2.5;

function perfThrottle(obj, ms) {
  const now = performance.now();
  if (now - (obj._vthrottle || 0) < ms) return false;
  obj._vthrottle = now;
  return true;
}

export { PENDING };
