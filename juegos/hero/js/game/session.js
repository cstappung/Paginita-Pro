// Sesión de juego: une audio, motores de cada jugador, entrada, red y render.
import { createEngine, Bot, PENDING, HIT, MISSED, DROPPED } from '../core/engine.js';
import { PARTS, DIFF_LABEL } from '../core/constants.js';
import { SongAudio } from '../audio/audio.js';
import { HighwayRenderer } from '../render/highway.js';
import { buildActionMap, deviceMatches, navAction, codeLabel } from '../input/input.js';
import { applyNoteMode } from '../core/noteMode.js';
import { settings, profileById } from '../settings.js';
import { songUrl, fetchSongFile, fileUrl, library } from '../library.js';
import { h, toast } from '../ui/dom.js';
import { Grabadora, opcionesMotor } from './prueba.js';
import { RemoteState } from './remoto.js';
import { celular } from '../sitio/celular.js';
import { Tactil, TACTIL } from '../ui/tactil.js';
import { vistas } from './orden.js';
import { CURVA_N } from './carrera.js';
import { rockSitio, cargaFondo } from '../sitio/rock.js';
import { descansos, enDescanso, humorDe, fuegoDe, analizaMusica } from '../rock/ritmo.js';
import { Batalla, PODERES, TIPOS, PODERES_BATERIA, MAX_PODERES, REPARA, FIN_KO, dobla } from './batalla.js';

// los nombres de los trastes (FRET_COLORS), para los avisos de la batalla
const TRASTES = ['Verde', 'Rojo', 'Amarillo', 'Azul', 'Naranja'];
const PLAYER_COLORS = ['#ffffff', '#ffb21e', '#53e7ff', '#ff6fb5', '#9dff6f', '#c79bff', '#ff8a5c', '#5cffd6'];
const STATE_INTERVAL = 100;
// Sucesos de notas que viajan en cada estado (los últimos): el canal no reenvía lo perdido
const EV_DIRECTO = 40;

// Alto rendimiento: se pinta a 3/4 de la resolución de la ventana (sin pantalla de
// alta densidad) y el navegador lo estira, que es casi gratis. Es lo que más ahorra
// en un PC sin GPU: la mitad de píxeles o menos.
const ESCALA_ALTO = 0.75;

export class GameSession {
  constructor(app, { entry, song, players, net = null, batalla = false, onFinish }) {
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
    this.curva = [];
    this.enBatalla = !!batalla && players.length === 2;
    this.players = players.map((pd, idx) => this._makePlayer(pd, idx, players.length));
    this.local = this.players.filter((p) => p.type !== 'remote');
    // modo batalla (game/batalla.js): solo de a dos; el Star Power se cambia por poderes que se lanzan al rival
    this.bt = batalla && this.players.length === 2 ? new Batalla() : null;
    if (this.bt) this.players.forEach((p, i) => {
      p.bq = i;
      if (p.bot) p.bot.sinSP = true;
    });
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
    // en el celular, el primer humano toca con los cinco botones de la pantalla (ui/tactil.js)
    this.tactilDe = celular ? humans[0] || null : null;
    this.tactilDe?.inputs.push({ profile: TACTIL, map: buildActionMap(TACTIL, this.tactilDe.track.kind) });
  }

  _makePlayer(pd, idx, count) {
    const raw = this.song.parts[pd.part]?.[pd.diff];
    // en el celular no hay rasgueo: todo taps (el modo va en la cabecera de la prueba)
    const mode = celular && pd.type !== 'remote' ? 'taps' : pd.mode || (pd.type === 'remote' ? 'normal' : settings.noteMode);
    let track = applyNoteMode(raw, mode);
    if (!track) throw new Error(`La canción no tiene ${pd.part}/${pd.diff}`);
    // en la batalla las «notas dobles» cambian las notas de quien las recibe: cada uno con su copia (con la
    // misma parte y dificultad, el bot y tú compartían el arreglo y se doblaban las de los dos)
    if (this.enBatalla && track.kind === 'guitar') track = { ...track, notes: track.notes.map((n) => ({ ...n, sus: n.sus.map((x) => ({ ...x })) })) };
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
      fis: 0,   // en la batalla: los trastes que pisas de verdad (con las teclas cruzadas no son los que suenan)
      mode,
    };
    if (pd.type === 'remote') {
      p.engine = new RemoteState(track, track.kind);
      p.engine.onHitFx = (nt, kind) => {
        p.fxQueue.push(kind
          ? { type: kind, lanes: nt ? GameSession.noteLanes(nt, track.kind) : null }
          : this._hitFx(nt, track.kind, p.engine.spActive, p.engine.phraseFailed));
        if (!kind && nt) this._rockGolpe(p, nt);
      };
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
      if (settings.showKeyLabels && p.profile.device === 'keyboard' && !pd.bot && !celular) p.keyLabels = this._keyLabels(p.profile, track);
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
    if (this.rock) this._rockEvento(p, type, a, b);
    if (type === 'hit' && this.rock) this._rockGolpe(p, p.engine.notes[a]);
    if (this.bt) {
      // en la batalla los aciertos dan vida, los fallos la quitan y cada frase de estrellas da un poder
      if (type === 'hit') this.bt.acierto(p.bq);
      else if (type === 'miss' || type === 'overstrum') this.bt.fallo(p.bq, now);
      else if (type === 'spPhrase') {
        p.fxQueue.push({ type: 'phrase', lanes: GameSession.noteLanes(p.engine.notes[b], p.engine.kind) });
        const r = this._rival(p), k = this.bt.gana(p.bq, now, r?.engine.kind === 'drums' ? PODERES_BATERIA : TIPOS);
        this.audio.spAwarded(!!k);
        return;
      }
    }
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
  // `aviso(texto)`: lo que se va preparando, para la pantalla de carga
  async load(track, aviso) {
    const files = {};
    for (const [stem, file] of Object.entries(this.entry.audio)) files[stem] = () => fetchSongFile(this.entry, file, track?.(file));
    const bg = library.remote && this.entry.background && settings.showBackground
      ? fileUrl(this.entry, this.entry.background).then((u) => (this.bgUrl = u), () => null)
      : null;
    await Promise.all([this.audio.load(files), bg]);
    const stems = new Set(this.players.flatMap((p) => p.stems));
    this.audio.setStemVolumes([...stems]);
    this._setupBackground();
    await this._preparaRock(aviso);
    this._precalienta();
  }

  // Batalla de Rock de fondo (js/rock/). Con otro jugador (en la sala,
  // el primero de los demás; en local, el segundo) es una batalla: tu rockero contra el suyo, y quién va
  // ganando sale de los puntajes. Solo, tu rockero toca al centro y el público sigue tu combo.
  async _preparaRock(aviso) {
    this.rock = null;
    if (!rockSitio.admin || !settings.fondoRock || celular) return;
    let rock;
    aviso?.('Montando el escenario…');
    try { rock = await cargaFondo(); } catch (err) { console.warn('[hero] Batalla de Rock', err); return; }
    const yo = this.local.find((p) => !p.bot) || this.local[0];
    const rival = this.players.find((p) => p !== yo && p.type === 'remote') || this.players.find((p) => p !== yo) || null;
    // en una sala de 3 a 8, los demás también tocan en el escenario
    const otros = rival ? this.players.filter((p) => p !== yo && p !== rival).slice(0, 6) : [];
    this.rock = rock;
    this.rockYo = yo;
    this.rockRival = rival;
    this.rockTodos = [yo, rival, ...otros].filter(Boolean);
    this.rockSp = this.rockTodos.map(() => false);
    this.rockGolpes = [];
    this.rockCarga = this.rockTodos.map(() => 0);
    this.rockFin = false;
    this.rockT = 0;
    this.rockHumor = 0.3;
    this.rockMuestras = [];
    // los tramos sin notas de cada uno: ahí el rockero deja de tocar
    const fin = this.song.endTime;
    this.rockDescansos = this.rockTodos.map((p) => ({ l: descansos(p.track.notes, { fin }), cur: { i: 0 } }));
    rock.monta(document.getElementById('rockbg'));
    // la canción espera a que el escenario esté listo (rockeros armados, shaders y texturas estrenados): si no,
    // los primeros segundos se trababan mientras se preparaba. Con tope, por si el equipo es muy lento.
    aviso?.('Preparando a los rockeros…');
    const vivo = rock.enVivo({
        yo: { look: rockSitio.look, nombre: yo?.name },
        rival: rival ? { uid: rival.id || rival.name || 'rival', nombre: rival.name, look: (rival.id && rockSitio.looks.get(rival.id)) || null } : null,
        otros: otros.map((p, i) => ({ uid: p.id || p.name || 'p' + i, nombre: p.name, look: (p.id && rockSitio.looks.get(p.id)) || null })),
        alto: settings.altoRendimiento,
        // si el juego se resiente aun con el fondo al mínimo, se apaga para esta sesión (en la pausa se vuelve a encender)
        alDemasiado: () => {
          if (!this.rock) return;
          this.ponRock(false);
          toast('Se apagó el fondo de rock: tu equipo no daba con los dos. Lo puedes volver a encender en la pausa.', 5000);
        },
      });
    // mientras tanto se analiza la canción para que las luces sigan la música de verdad (después de enVivo,
    // que la borra: es de la canción anterior)
    const musica = this._musicaRock()
      .then((m) => { if (m && this.rock === rock) rock.musica(m); })
      .catch((err) => console.warn('[hero] Batalla de Rock: análisis de la música', err));
    await Promise.race([Promise.all([vivo, musica]), new Promise((ok) => setTimeout(ok, 20000))])
      .catch((err) => console.warn('[hero] Batalla de Rock', err));
  }

  // La canción filtrada en graves, medios y agudos con un OfflineAudioContext (lo renderiza el navegador,
  // fuera del hilo del juego, a 11 025 por segundo) y resumida a 60 cuadros por segundo (ritmo.js,
  // analizaMusica): con eso las luces de la Batalla de Rock laten con la música. Una vez por canción; las
  // canciones de más de 10 minutos se analizan hasta ahí (después las luces siguen la coreografía).
  async _musicaRock() {
    if (this.rockMusica !== undefined) return this.rockMusica;
    this.rockMusica = null;
    const bufs = Object.values(this.audio.buffers || {});
    const Off = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!bufs.length || !Off) return null;
    const SR = 11025, dur = Math.min(600, Math.max(...bufs.map((b) => b.duration)));
    const ctx = new Off(3, Math.max(1, Math.ceil(dur * SR)), SR);
    const mezcla = ctx.createGain();
    mezcla.channelCount = 1;
    mezcla.channelCountMode = 'explicit';
    for (const b of bufs) {
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(mezcla);
      src.start(0);
    }
    const une = ctx.createChannelMerger(3);
    [['lowpass', 150, 0.707], ['bandpass', 900, 0.6], ['highpass', 3000, 0.707]].forEach(([type, f, q], i) => {
      const filtro = ctx.createBiquadFilter();
      filtro.type = type;
      filtro.frequency.value = f;
      filtro.Q.value = q;
      mezcla.connect(filtro);
      filtro.connect(une, 0, i);
    });
    une.connect(ctx.destination);
    const out = await ctx.startRendering();
    this.rockMusica = analizaMusica([0, 1, 2].map((i) => out.getChannelData(i)), SR);
    return this.rockMusica;
  }

  // Desde la pausa: se apaga o se vuelve a montar sin salir de la canción
  async ponRock(on) {
    settings.fondoRock = on;
    if (!on) {
      this.rock?.desmonta();
      this.rock = null;
    } else if (!this.rock && this.running) await this._preparaRock();
  }

  _pulsoRock(now) {
    const yo = this.rockYo?.engine, rv = this.rockRival?.engine, T = this.song.tempo;
    if (!yo) return;
    const beats = T.secToTick(Math.max(0, now)) / T.resolution;
    // el humor del público: el acierto de los últimos segundos (si hay pocas notas, se queda como estaba)
    const M = this.rockMuestras, ult = M[M.length - 1];
    if (!ult || now - ult.t >= 0.5 || now < ult.t) {
      if (ult && now < ult.t) M.length = 0;   // la canción volvió atrás (la pausa retrocede)
      M.push({ t: now, h: yo.hitCount, m: yo.missCount });
      if (M.length > 24) M.shift();
    }
    const hu = humorDe(M, now);
    if (hu !== null) this.rockHumor += (hu - this.rockHumor) * 0.05;
    const humor = Math.max(-1, Math.min(1, this.rockHumor + Math.min(0.25, (yo.combo || 0) / 200)));
    // el ánimo de tu rockero: en batalla, quién va ganando; solo, cómo vas tocando y tu multiplicador
    const animo = rv
      ? (yo.score - rv.score) / Math.max(4000, 0.25 * (yo.score + rv.score))
      : 0.7 * humor + 0.3 * ((yo.multiplier() - 1) / 3);
    // el intervalo real entre cuadros del juego: con él la escena decide cuánto se puede gastar
    const ahora = performance.now(), dtJuego = this.rockT ? (ahora - this.rockT) / 1000 : 0;
    this.rockT = ahora;
    const D = this.rockDescansos, toca = D.map((d) => !enDescanso(d.l, now, d.cur));
    // con más de dos: el ánimo de cada uno según cuánto lleva respecto del promedio de la sala
    const E = this.rockTodos.map((p) => p.engine);
    let confs = null;
    if (E.length > 2) {
      const media = E.reduce((a, e) => a + (e.score || 0), 0) / E.length;
      confs = E.map((e) => Math.max(-0.85, Math.min(0.85, ((e.score || 0) - media) / Math.max(4000, 0.3 * media))));
    }
    const golpes = this.rockGolpes?.length ? this.rockGolpes.splice(0) : null;
    // cuánto arde el escenario por cada uno: ritmo de estrellas + racha (ritmo.js, fuegoDe)
    const fuego = E.map((e) => fuegoDe(e));
    this.rock.pulso({ beats, animo: confs ? confs[0] : animo, humor, hype: Math.min(1, (yo.combo || 0) / 100), dtJuego, toca, solo: !!yo.currentSolo?.(now), confs, golpes, t: now, fuego });
    // Star Power: cada frase completa carga la barra y manda un rayo; activarlo hace caer otro y la guitarra
    // se prende de azul mientras dure (en un mano a mano, la carga es un ataque al rival)
    // (en la batalla no: ahí las frases dan poderes y el rayo sale al lanzarlos, _lanzaBt)
    if (!this.bt) E.forEach((e, q) => {
      const sp = e.sp || 0, on = !!e.spActive;
      if (sp > this.rockCarga[q] + 0.2) this.rock.carga(q);
      this.rockCarga[q] = sp;
      if (on !== this.rockSp[q]) this.rock.poder(q, on);
      this.rockSp[q] = on;
    });
    if (!this.rockFin && now > this.song.endTime + 0.3) {
      this.rockFin = true;
      if (this.bt) { const g = this.bt.ganador ?? (this.bt.j[0].vida >= this.bt.j[1].vida ? 0 : 1); this.rock.fin(Math.max(0, this.rockTodos.indexOf(this.players[g]))); }
      else if (rv) this.rock.fin(E.reduce((g, e, q) => ((e.score || 0) > (E[g].score || 0) ? q : g), 0));
      else {
        const e = yo.stats().stars;
        this.rock.fin(0, e >= 5 ? '¡LEYENDA!' : e >= 4 ? '¡OVACIÓN!' : e >= 3 ? '¡BIEN TOCADO!' : '¡A ENSAYAR!');
      }
    }
  }

  // Cada nota tocada de verdad: el rockero de quien la tocó rasguea (van juntas en el próximo pulso)
  _rockGolpe(p, nt) {
    const q = this.rockTodos ? this.rockTodos.indexOf(p) : -1;
    if (q < 0 || !nt || (this.rockGolpes ||= []).length > 64) return;
    // carril: el pad de la batería o el traste más bajo de la nota; acorde: más de un traste
    let l = 0, acorde = 0;
    if (nt.pad !== undefined) l = Math.max(0, nt.pad);
    else { const f = nt.open ? 0 : nt.frets | 0; l = f ? 31 - Math.clz32(f & -f) : 0; acorde = f & (f - 1) ? 1 : 0; }
    this.rockGolpes.push([q, l, acorde, Math.round(Math.max(0, (nt.endTime ?? nt.time) - nt.time) * 100)]);
  }

  // Rachas, caídas y solos del jugador, para la coreografía de Batalla de Rock
  _rockEvento(p, type, a, b) {
    if (!this.rock || p !== this.rockYo) return;
    const solo = !this.rockRival;
    if (type === 'streak' && (a % 100 === 0 || a === 50)) {
      if (solo) this.rock.hype('racha', `¡RACHA DE ${a}!`, '#ffd34d');
    } else if (type === 'comboBreak' && a >= 25) {
      if (solo) this.rock.hype('falla');
    } else if (type === 'soloEnd' && b?.total) {
      const pct = b.hits / b.total;
      if (pct >= 0.85) this.rock.hype('solo', pct === 1 ? '¡SOLO PERFECTO!' : '¡QUÉ SOLO!', '#ffd34d');
    }
  }

  // Sprites y efectos se estrenan aquí, tras la pantalla de carga, y no a mitad de
  // canción (el primer rayo de Star Power daba un tirón): HighwayRenderer.precalienta
  _precalienta() {
    try {
      this._resize();
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const opts = this._drawOpts();
      this._views().forEach(([p, view]) => this.renderer.precalienta(this.ctx, view, p, this.song, { ...opts, keyLabels: p.keyLabels }));
    } catch (err) {
      console.warn('[hero] precalentar', err);
    }
  }

  _drawOpts() {
    return {
      // en el celular la autopista es ancha y baja: las gemas, más aplastadas
      noteSpeed: settings.noteSpeed, lefty: settings.lefty, tilt: celular ? settings.highwayTilt * 0.62 : settings.highwayTilt,
      style: settings.highwayStyle, shake: settings.screenShake, alto: settings.altoRendimiento, celular,
      compartido: this.players.length > 1,
      rewinding: !!this.rewind,
      introAge: this.introPerf ? (performance.now() - this.introPerf) / 1000 : 99,
    };
  }

  // [jugador, rectángulo] de cada autopista, en píxeles de la ventana
  _views() {
    const w = this.canvas.width / this.dpr, hh = this.canvas.height / this.dpr;
    // en el celular solo tu autopista, a todo lo ancho (las de los demás quedarían diminutas)
    if (celular) {
      const yo = this.tactilDe || this.local[0] || this.players[0];
      return [[yo, { x: 0, y: 0, w, h: hh }]];
    }
    return vistas(this.players, this.local[0], w, hh, this.dpr);
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
    if (this.tactilDe) this.tactil = new Tactil(this);
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
    if (this.tactilDe) {
      this.helpEl = h('div', { class: 'play-help' }, 'Toca el botón de cada color justo cuando su nota llegue al círculo (no hace falta rasguear). Barra morada: no toques nada',
        h('small', {}, 'Star Power: ★ · Pausa: ❚❚ · En el celular las partidas no se guardan'));
      this.app.overlay.append(this.helpEl);
      setTimeout(() => this.helpEl?.classList.add('hide'), 7000);
      return;
    }
    // Ayuda rápida de controles para el jugador de teclado
    const kp = this.local.find((p) => p.keyLabels);
    if (kp) {
      const g = kp.profile.guitar;
      const txt = kp.track.kind === 'drums'
        ? `Golpea ${kp.keyLabels.join(' ')} y bombo ${kp.keyLabels.kick} cuando las notas lleguen a los círculos`
        : kp.mode === 'taps'
          ? `Pulsa ${kp.keyLabels.join(' ')} justo cuando cada nota llegue a su círculo (no hace falta rasguear). Barra morada: no pulses nada`
          : `Mantén el traste (${kp.keyLabels.join(' ')}) y rasguea con ${codeLabel(g.up?.[0])} / ${codeLabel(g.down?.[0])}`;
      const spTecla = codeLabel((kp.track.kind === 'drums' ? kp.profile.drums : g).sp?.[0]);
      this.helpEl = h('div', { class: 'play-help' }, txt, h('small', {}, this.bt
        ? `⚔️ Batalla: cada frase de estrellas te da un poder; lánzaselo al rival con ${spTecla} · Pierde quien se queda sin vida · Pausa: Esc`
        : `Star Power: ${spTecla} · Pausa: Esc`));
      this.app.overlay.append(this.helpEl);
      setTimeout(() => this.helpEl?.classList.add('hide'), 7000);
    }
  }

  _resize() {
    // alto rendimiento: sin pantalla de alta densidad (hasta 4 veces menos píxeles que pintar)
    const dpr = settings.altoRendimiento ? ESCALA_ALTO : Math.min(2, window.devicePixelRatio || 1);
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
    if (this.bt) {
      // el botón de Star Power lanza tu poder; un traste con la cuerda rota no suena: cada pulsación la repara.
      // Con las teclas cruzadas, dos trastes tocan el carril del otro
      if (act === 'sp') { if (down) this._lanzaBt(p, t); return; }
      const l0 = e.kind === 'guitar' ? (act[0] === 'g' && act.length === 2 ? Number(act[1]) : -1) : act[0] === 'p' || act[0] === 'c' ? Number(act[1]) : -1;
      if (l0 >= 0) {
        const l = this.bt.cruzado(p.bq, l0, t);
        if (down && this.bt.roto(p.bq, l, t) && this.bt.pulsaRoto(p.bq, t)) this.audio.playSample('ripple', 0.5);
        if (e.kind === 'guitar') {
          p.fis = down ? p.fis | (1 << l0) : p.fis & ~(1 << l0);
          this._trastesBt(p, t);
          return;
        }
        if (this.bt.roto(p.bq, l, t)) return;
        act = act[0] + l;
      }
    }
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
    if (this.bt) this._tickBt(now);
    this._sendState(perf);
    if (this.net) this._anotaCurva(now);
    this.draw(now);
    if (this.rock) this._pulsoRock(now);
    if (!this.finished && now > this.endAt) this.finish();
  }

  /* ---------- modo batalla ---------- */
  _rival(p) { return this.players.find((q) => q !== p); }

  // `p` lanza su poder más viejo al rival
  _lanzaBt(p, t) {
    const r = this._rival(p), bt = this.bt;
    if (!r || t < 0) return;
    const a = bt.lanza(p.bq, t, r.engine.kind === 'drums' ? r.engine.track.lanes : 5);
    if (!a) return;
    this.audio.spDeployed();
    p.fxQueue.push({ type: 'spActivate' });
    if (this.rock) this.rock.ataque(this.rockTodos ? this.rockTodos.indexOf(p) : p.bq);
    if (r.type === 'remote') {
      // en línea: el ataque viaja en tu estado (bt.a) y el rival se lo aplica; el robo te da uno de sus poderes
      const J = bt.j[p.bq], V = bt.j[r.bq];
      if (a.k === 'robo' && V.poderes.length && J.poderes.length < MAX_PODERES) J.poderes.push(V.poderes[0]);
      return;
    }
    this._recibeBt(r, a, t);
  }

  _recibeBt(p, a, t) {
    if (!this.bt.recibe(p.bq, a, t)) return;
    p.fxQueue.push({ type: 'break', had: 40 });   // el golpe sacude su autopista
    // la cuerda rota suelta ese traste si lo tenía pisado; las teclas cruzadas cambian lo que suena ya
    if (p.grab && p.engine.kind === 'guitar') this._trastesBt(p, Math.max(t, 0));
    if (a.k === 'dobles' && p.engine.kind === 'guitar') dobla(p.engine.notes, ...this.bt.j[p.bq].dobles);
    // en la guitarra, el aviso dice cuáles se cruzaron
    const J = this.bt.j[p.bq];
    if (a.k === 'cruce' && p.engine.kind === 'guitar' && J.cruce && J.aviso) J.aviso.sub = `${TRASTES[J.cruce[0]]} ⇄ ${TRASTES[J.cruce[1]]}: cada uno toca el carril del otro`;
  }

  /* lo que suena en la guitarra de `p` en la batalla: lo que pisa, con las teclas cruzadas y sin la cuerda rota */
  _trastesBt(p, t) {
    if (!p.grab) return;
    let m = 0;
    for (let l = 0; l < 5; l++) {
      if (!(p.fis & (1 << l))) continue;
      const c = this.bt.cruzado(p.bq, l, t);
      if (!this.bt.roto(p.bq, c, t)) m |= 1 << c;
    }
    if (m === p.frets) return;
    p.frets = m;
    p.grab.fret(m, t);
  }

  _tickBt(now) {
    const bt = this.bt, dt = this.btT === undefined ? 0 : Math.max(0, now - this.btT);
    this.btT = now;
    for (const p of this.local) {
      bt.tick(p.bq, now, dt);
      // al empezar o terminar un cruce (o vencer la cuerda) cambia lo que suena con lo que ya tienes pisado
      if (p.grab && p.engine.kind === 'guitar' && !this.rewind) this._trastesBt(p, now);
      if (!p.bot) continue;
      // el bot también juega la batalla: lanza sus poderes al rato, los ataques lo hacen fallar y repara la cuerda
      const J = bt.j[p.bq], ef = bt.pintura(p.bq, now);
      if (J.poderes.length) { p.btLanza ??= now + 1 + Math.random() * 2.5; if (now >= p.btLanza) { p.btLanza = null; this._lanzaBt(p, now); } }
      p.bot.torpe = ef.apagon ? 0.35 : ef.amp || ef.cruce || ef.dobles ? 0.25 : 0;
      p.bot.sinTraste = ef.roto >= 0 ? 1 << ef.roto : 0;
      if (ef.roto >= 0) { p.btRepara ??= now + 2.5; if (now >= p.btRepara) { p.btRepara = null; for (let i = 0; i < REPARA; i++) bt.pulsaRoto(p.bq, now); } }
    }
    // alguien quedó K.O.: se ve el cartel y la canción termina a los FIN_KO segundos
    if (bt.ganador !== null && this.btFinT === undefined) {
      this.btFinT = now;
      this.endAt = Math.min(this.endAt, now + FIN_KO);
      this.audio.playSample('ripple', 1);
      if (this.rock && this.rockTodos) this.rock.fin(this.rockTodos.indexOf(this.players[bt.ganador]));
    }
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
      ...(this.bt ? { bt: this.bt.vista(p.bq, this.now ?? 0) } : {}),
    });
  }

  // El puntaje de cada tramo que ya pasó (el i-ésimo, al llegar a (i+1)/CURVA_N de la canción)
  _anotaCurva(now) {
    const p = this.local[0], paso = this.song.endTime / CURVA_N;
    if (!p || !(paso > 0)) return;
    while (this.curva.length < CURVA_N && now >= (this.curva.length + 1) * paso) this.curva.push(Math.floor(p.engine.score));
  }

  onRemoteState(m) {
    const p = this.players.find((q) => q.type === 'remote' && q.id === m.id);
    if (!p) return;
    p.engine.apply(m, this.now ?? 0);
    if (this.bt && m.bt && typeof m.bt === 'object') {
      const now = this.now ?? 0, yo = this._rival(p);
      this.bt.ponRemoto(p.bq, m.bt, now);
      // sus notas dobles: su autopista en tu pantalla se dobla igual que la suya (misma ventana, mismas notas)
      const dn = this.bt.j[p.bq].dobles;
      if (dn && p.engine.kind === 'guitar' && p.dnHecho !== dn.join()) { p.dnHecho = dn.join(); dobla(p.engine.notes, ...dn); }
      // sus ataques (se repiten en cada paquete; cada uno se aplica una vez). En la cuenta regresiva no valen:
      // pueden ser de la canción anterior
      if (now >= 0 && yo && Array.isArray(m.bt.a)) for (const x of m.bt.a.slice(-8)) {
        if (Array.isArray(x) && Number.isInteger(x[0]) && PODERES[x[1]]) this._recibeBt(yo, { id: x[0], k: x[1], l: Number.isInteger(x[2]) ? x[2] : 0, de: p.bq }, now);
      }
    }
  }

  draw(now) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = W / this.dpr, hh = H / this.dpr;
    const opts = this._drawOpts();
    const vistas = this._views();
    // la autopista de otro se pinta con su retraso (remoto.js): sus aciertos caen en la barra
    // con 4 o más, unas sobre otras: que la entrada y el bamboleo no se metan en la vecina
    const recorta = vistas.length > 3;
    for (const [p, view] of vistas) {
      const t = p.type === 'remote' ? now - p.engine.retraso(performance.now()) : now;
      if (this.bt) p.batalla = this.bt.pintura(p.bq, now);
      if (recorta) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x, view.y, view.w, view.h);
        ctx.clip();
      }
      this.renderer.draw(ctx, view, p, t, this.song, { ...opts, keyLabels: p.keyLabels, neckNow: now });
      if (recorta) ctx.restore();
    }
    // los que no se pintan no consumen sus efectos: que no se acumulen toda la canción
    if (vistas.length < this.players.length) for (const p of this.players) if (!vistas.some(([q]) => q === p)) p.fxQueue.length = 0;

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
    this.tactil?.suelta();
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
    if (this.net) this.net.send({ t: 'done', stats: { ...this.local[0].engine.stats(), quit: true, ...(this.bt ? { vida: 0, ko: 1 } : {}) }, curva: this.curva });
    this.app.afterSessionQuit(this.net);
  }

  finish() {
    this.finished = true;
    if (this.bt) this.bt.cierra(this.now ?? 0, this.players.map((p) => p.engine.score || 0));
    // el último punto, con el puntaje final (algo puede sumar tras la última nota)
    if (this.curva.length === CURVA_N) this.curva[CURVA_N - 1] = Math.floor(this.local[0].engine.score);
    const results = this.players.map((p) => ({
      name: p.name, part: p.part, diff: p.diff, bot: !!p.bot, type: p.type, id: p.id, color: p.color,
      curva: p === this.local[0] && this.net ? this.curva : null,
      stats: p.type === 'remote' ? null : p.engine.stats(),
      detail: p.type === 'remote' ? null : this._detail(p),
      // la prueba del primer jugador humano: con ella la página verifica y guarda el récord (la batalla no se guarda)
      prueba: p === this.local[0] && p.grab && !this.bt ? p.grab.texto() : null,
      batalla: this.bt ? { gano: this.bt.ganador === p.bq, motivo: this.bt.motivo, vida: this.bt.j[p.bq].vida, ko: this.bt.j[p.bq].ko } : null,
    }));
    if (this.net) {
      this._sendState(Infinity);
      const yo = results.find((r) => r.type !== 'remote');
      this.net.send({ t: 'done', stats: yo?.stats && (this.bt ? { ...yo.stats, vida: Math.round(yo.batalla.vida * 1000), ko: yo.batalla.ko ? 1 : 0 } : yo.stats), curva: this.curva });
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
    this.tactil?.destroy();
    this.tactil = null;
    this._clearBackground();
    this.rock?.desmonta();
    this.rock = null;
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
