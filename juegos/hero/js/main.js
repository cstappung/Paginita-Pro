// Punto de entrada: gestiona pantallas, carga de canciones y sesiones de juego.
// @controles: teclado
// (Se toca con teclado, guitarra o mando: build-controles.js no debe leer los
// clics de los menús como «se juega en el celular».)
import { InputManager, navAction } from './input/input.js';
import { PreviewPlayer, audioContext } from './audio/audio.js';
import { library, loadSongChart, artImg, songBytes } from './library.js';
import { GameSession } from './game/session.js';
import { settings, saveSettings } from './settings.js';
import { h, Screen, toast } from './ui/dom.js';
import { SongSelectScreen } from './ui/songSelect.js';
import { PartSelectScreen } from './ui/partSelect.js';
import { ResultsScreen } from './ui/results.js';
import { SettingsScreen } from './ui/settingsScreen.js';
import { OnlineScreen, LobbyScreen, entraSala } from './ui/online.js';
import { MenuBackground } from './ui/menuBackground.js';
import { songSource } from './site.js';
import { RankingScreen } from './ui/ranking.js';
import { sitio } from './sitio/puente.js';
import { claveCancion } from './sitio/clave.js';

class MainMenu extends Screen {
  render() {
    const btn = (label, sub, onclick) => h('button', { class: 'menu-btn', 'data-nav': true, onclick }, h('span', {}, label), h('small', {}, sub));
    const status = h('div', { class: 'lib-status' });
    this.status = status;
    return h('div', { class: 'screen main-menu' },
      h('div', { class: 'logo' }, h('span', { class: 'logo-a' }, 'PRO'), h('span', { class: 'logo-b' }, 'HERO')),
      h('div', { class: 'menu-list' },
        btn('Jugar', 'Un jugador o multijugador local', () => this.app.show(new SongSelectScreen(this.app, { mode: 'play' }))),
        // En línea se juega en una sala de Juegos (como Yemas o Boxhead): el botón lleva al salón
        sitio.embebido ? btn('En línea', 'Abre o únete a una sala en el salón de Juegos', () => sitio.envia('en-linea')) : null,
        sitio.embebido ? btn('Clasificación', 'La tabla general: quién tiene más estrellas doradas', () => this.app.show(new RankingScreen(this.app))) : null,
        btn('Controles', 'Cambia las teclas o configura tu guitarra/mando', () => this.app.show(new SettingsScreen(this.app, 'controls'))),
        btn('Ajustes', 'Volumen, modo de notas, pista y calibración', () => this.app.show(new SettingsScreen(this.app))),
        // el selector y el reescaneo necesitan el servidor local (no existen con Firebase)
        library.remote ? null : btn('Elegir canciones', 'Escucha tus canciones y decide cuáles guardar', () => (location.href = 'elegir.html')),
        library.remote
          ? btn('Recargar canciones', 'Vuelve a leer la lista de canciones', () => this.app.watchLibrary())
          : btn('Reescanear canciones', 'Vuelve a leer la carpeta de canciones', async () => {
            await library.rescan();
            toast('Escaneando canciones…');
            this.app.watchLibrary();
          }),
        sitio.embebido ? btn('Volver a Juegos', 'Sales de PRO HERO', () => sitio.envia('volver')) : null),
      status,
      h('div', { class: 'hint' }, 'Flechas / Enter para navegar · Canciones de Clone Hero (.chart / .mid)'));
  }
  afterMount() {
    this.focusFirst();
    this.update();
    this.timer = setInterval(() => this.update(), 1000);
  }
  beforeUnmount() {
    clearInterval(this.timer);
  }
  update() {
    if (library.needsLogin) {
      // con Firebase las canciones solo se descargan con la sesión iniciada (cuenta de Google)
      if (!this.status.querySelector('button')) {
        this.status.replaceChildren('Inicia sesión para cargar las canciones ',
          h('button', { class: 'login-btn', 'data-nav': true, onclick: () => this.app.login() }, 'Iniciar sesión con Google'));
      }
      return;
    }
    this.status.textContent = library.loading
      ? 'Cargando lista de canciones…'
      : library.scanning
        ? `Escaneando canciones… ${library.progress}`
        : `${library.songs.length.toLocaleString('es')} canciones en la biblioteca`;
  }
}

class App {
  constructor() {
    this.root = document.getElementById('ui');
    this.overlay = document.getElementById('overlay');
    this.input = new InputManager();
    this.preview = new PreviewPlayer();
    this.menuBg = new MenuBackground(document.getElementById('menubg'));
    this.net = null;
    this.session = null;
    this.lastDevice = 'keyboard';
    this.lastChoice = {};
    this.input.on((ev) => this.onInput(ev));
    // Los navegadores exigen un gesto del usuario para activar el audio.
    // Solo se hace UNA vez: si no, cualquier tecla reanudaría el audio durante la pausa.
    const unlock = () => {
      const ctx = audioContext();
      if (ctx.state === 'running') return done();
      if (this.session?.paused) return;
      ctx.resume().then(() => ctx.state === 'running' && done());
    };
    const done = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('blur', () => this.stopRepeat());
    // primero se averigua de dónde vienen las canciones (servidor local o Firebase)
    songSource().then((src) => {
      library.source = src;
      this.watchLibrary();
      // en una sala de Juegos se entra directo a la sala
      if (sitio.sala) this.openOnline();
      else this.show(new MainMenu(this));
    });
    sitio.envia('listo');
  }

  async login() {
    try {
      const { signIn } = await import('./cloud.js');
      await signIn();
      await this.watchLibrary();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') toast(`No se pudo iniciar sesión: ${err.message}`, 5000);
    }
  }

  async watchLibrary() {
    library.loading = true;
    try {
      await library.refresh();
    } catch (err) {
      console.error(err);
      toast(library.remote ? `No se pudo cargar la lista de canciones: ${err.message}` : 'No se pudo conectar con el servidor', 6000);
      return;
    } finally {
      library.loading = false;
    }
    if (library.scanning) {
      clearTimeout(this.libTimer);
      this.libTimer = setTimeout(() => this.watchLibrary(), 1200);
    } else this.screen?.onLibrary?.();
  }

  show(screen) {
    this.stopRepeat();
    this.screen?.unmount();
    this.screen = screen;
    this.root.classList.remove('hidden');
    this.menuBg.start();
    screen.mount(this.root);
  }

  onInput(ev) {
    // solo teclas y botones (no ejes, que pueden tener ruido) cambian el dispositivo "activo"
    if (ev.down && (ev.device === 'keyboard' || /^b\d+$/.test(ev.code))) this.lastDevice = ev.device;
    if (this.session?.running) return this.stopRepeat();
    if (!ev.down && this.repeat?.code === ev.code && this.repeat.device === ev.device) this.stopRepeat();
    if (this.modal) {
      const a = navAction(ev);
      if (a) this.modal.onNav(a);
      return;
    }
    if (this.screen?.onInput?.(ev)) return;
    const a = navAction(ev);
    if (a) {
      this.screen?.onNav(a, ev);
      if (['up', 'down', 'pageup', 'pagedown'].includes(a)) this.startRepeat(a, ev);
    }
  }

  // Mantener una flecha (o la cruceta) repite la acción y acelera con el tiempo
  startRepeat(action, ev) {
    this.stopRepeat();
    const rep = { action, code: ev.code, device: ev.device, start: performance.now() };
    this.repeat = rep;
    const step = () => {
      if (this.repeat !== rep) return;
      const held = performance.now() - rep.start;
      const times = held > 3000 ? 4 : held > 1600 ? 2 : 1;
      for (let i = 0; i < times; i++) this.screen?.onNav(action, ev);
      rep.timer = setTimeout(step, Math.max(28, 85 - held / 25));
    };
    rep.timer = setTimeout(step, 320);
  }

  stopRepeat() {
    if (this.repeat) clearTimeout(this.repeat.timer);
    this.repeat = null;
  }

  defaultProfileId() {
    const m = /^gamepad:(\d)$/.exec(this.lastDevice);
    return m ? `gp${m[1]}` : 'kb1';
  }

  // ---------- Carga y juego ----------
  showLoading(entry) {
    const bar = h('div', { class: 'lp-fill' });
    const status = h('div', { class: 'lp-status' });
    const el = h('div', { class: 'loading-screen' },
      artImg(entry, 'lp-art', false) || h('div', { class: 'lp-art empty' }),
      h('div', { class: 'lp-name' }, entry.meta.name),
      h('div', { class: 'lp-artist' }, entry.meta.artist),
      h('div', { class: 'lp-bar' }, bar),
      status,
      h('div', { class: 'lp-phrase' }, entry.meta.loadingPhrase || 'Cargando…'));
    this.overlay.append(el);
    return {
      el,
      set: (f, text) => {
        bar.style.width = `${Math.round(Math.min(1, f) * 100)}%`;
        if (text !== undefined) status.textContent = text;
      },
      close: () => el.remove(),
    };
  }

  // Avance de la descarga de una canción: por bytes si library.json trae los tamaños
  downloadTracker(entry, loading) {
    const list = [entry.chartFile, entry.iniFile, ...Object.values(entry.audio)].filter(Boolean);
    const total = songBytes(entry, list);
    const got = {};
    const mb = (b) => (b / 1024 ** 2).toLocaleString('es', { maximumFractionDigits: 1 });
    const update = () => {
      const sum = Object.values(got).reduce((a, b) => a + b, 0);
      if (total) loading.set(sum / total, library.remote ? `Descargando ${mb(sum)} de ${mb(total)} MB` : '');
      else loading.set(Object.keys(got).length / list.length);
    };
    return (file) => (n) => {
      got[file] = n;
      update();
    };
  }

  async prepareSession(entry, players, net = null) {
    this.preview.stop();
    const loading = this.showLoading(entry);
    this.screen?.unmount();
    this.screen = null;
    this.root.classList.add('hidden');
    this.menuBg.stop();
    try {
      // con Firebase, recién aquí se descarga la canción (y se espera a que termine)
      const track = this.downloadTracker(entry, loading);
      const song = await loadSongChart(entry, track);
      this.lastSong = song;
      const session = new GameSession(this, {
        entry, song, players, net,
        onFinish: (results) => this.onSessionFinish(entry, results, net),
      });
      await session.load(track);
      loading.set(1, 'Preparando…');
      loading.close();
      this.session = session;
      return session;
    } catch (err) {
      console.error(err);
      loading.close();
      toast(`Error al cargar la canción: ${err.message}`, 5000);
      if (net) this.show(new LobbyScreen(this));
      else this.show(new SongSelectScreen(this, { mode: 'play', selectId: entry.id }));
      return null;
    }
  }

  async playLocal(entry, players) {
    this.lastLocal = { entry, players };
    const session = await this.prepareSession(entry, players);
    session?.start();
  }

  restartSession() {
    this.session = null;
    if (this.lastLocal) this.playLocal(this.lastLocal.entry, this.lastLocal.players);
  }

  afterSessionQuit(net) {
    this.session = null;
    if (net) this.show(new LobbyScreen(this));
    else this.show(new SongSelectScreen(this, { mode: 'play', selectId: this.lastLocal?.entry.id }));
  }

  onSessionFinish(entry, results, net) {
    this.session = null;
    this.mandaResultado(entry, results, net);
    this.show(new ResultsScreen(this, { entry, results, net }));
  }

  // La canción terminada va a la página: ella la vuelve a tocar con la prueba
  // (verifica el puntaje), guarda tus estrellas y paga las monedas.
  mandaResultado(entry, results, net) {
    const r = results.find((x) => x.prueba && x.stats && !x.bot);
    const b = this.lastSong?.bytes;
    if (!sitio.embebido || !r || !b) return;
    sitio.envia('resultado', {
      k: claveCancion(entry.id), id: entry.id, nombre: entry.meta.name, artista: entry.meta.artist,
      prueba: r.prueba, stats: r.stats, part: r.part, diff: r.diff, sala: !!net,
      chartFile: b.chartFile, chart: b.chart.slice(0), ini: b.ini ? b.ini.slice(0) : null,
    });
  }

  showPauseMenu(online, handlers) {
    const buttons = [
      h('button', { 'data-nav': true, onclick: handlers.resume }, 'Continuar'),
      handlers.restart ? h('button', { 'data-nav': true, onclick: handlers.restart }, 'Reiniciar') : null,
      h('button', { 'data-nav': true, onclick: handlers.quit }, online ? 'Abandonar partida' : 'Salir'),
    ].filter(Boolean);
    const V = settings.volume;
    const slider = (label, key) => {
      const out = h('b', {}, `${Math.round(V[key] * 100)}%`);
      const input = h('input', {
        type: 'range', min: 0, max: 1, step: 0.05, value: V[key], 'data-nav': true,
        oninput: () => {
          V[key] = Number(input.value);
          out.textContent = `${Math.round(V[key] * 100)}%`;
          saveSettings();
          handlers.volume?.();
        },
      });
      return { row: h('label', { class: 'pm-vol' }, h('span', {}, label), input, out), input };
    };
    const sliders = [slider('Música', 'song'), slider('Tu instrumento', 'instrument'), slider('Efectos', 'sfx'), slider('General', 'master')];
    const items = [...buttons, ...sliders.map((x) => x.input)];
    const el = h('div', { class: 'pause-menu' },
      h('div', { class: 'pm-box' }, h('h2', {}, online ? 'Menú (la canción sigue sonando)' : 'Pausa'), ...buttons,
        h('div', { class: 'pm-vols' }, h('h3', {}, 'Volumen'), ...sliders.map((x) => x.row))));
    this.overlay.append(el);
    items[0].focus();
    const menu = {
      onNav: (a) => {
        const cur = document.activeElement;
        const i = items.indexOf(cur);
        if (a === 'down') items[(i + 1) % items.length].focus();
        else if (a === 'up') items[(i - 1 + items.length) % items.length].focus();
        else if ((a === 'left' || a === 'right') && cur?.type === 'range') {
          cur.value = Math.max(0, Math.min(1, Number(cur.value) + (a === 'right' ? 0.05 : -0.05)));
          cur.dispatchEvent(new Event('input'));
        } else if (a === 'confirm' && cur?.tagName === 'BUTTON') cur.click();
        else if (a === 'confirm' && i < 0) items[0].click();
        else if (a === 'back') handlers.resume();
      },
      close: () => el.remove(),
    };
    return menu;
  }

  goMenu() {
    if (sitio.sala) return this.openOnline();
    this.show(new MainMenu(this));
  }

  // ---------- En línea ----------
  openOnline() {
    if (sitio.sala) {
      if (this.net?.connected) return this.show(new LobbyScreen(this));
      return entraSala(this);
    }
    this.show(new OnlineScreen(this));
  }
}

// Los mandos y las guitarras los lee el propio juego (input.js, Gamepad API).
// mando.js del sitio no traduce nada aquí: solo deja de mover el cursor de la
// página mientras se toca, y Select (el Star Power de muchas guitarras) es del juego.
if (window.Mando) window.Mando.configura({ botones: { select: () => {} } });

window.app = new App();
