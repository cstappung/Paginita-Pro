// Selector de canciones estilo Clone Hero: lista virtual, búsqueda, orden y vista previa.
import { h, Screen, fmtTime } from './dom.js';
import { library, artImg, previewInfo } from '../library.js';
import { appleConocida, previewApple, olvidaApple } from '../applePreview.js';
import { PARTS, PART_ORDER, DIFFS } from '../core/constants.js';
import { PartSelectScreen } from './partSelect.js';
import { sitio, estrellasDe } from '../sitio/puente.js';
import { claveCancion } from '../sitio/clave.js';

const ROW_H = 58;
// Una canción que nunca se buscó en Apple se busca solo si te quedas en ella:
// Apple corta a ~20 búsquedas por minuto.
const APPLE_ESPERA = 700;
const SORTS = {
  artist: ['Artista', (s) => s.meta.artist],
  name: ['Título', (s) => s.meta.name],
  album: ['Álbum', (s) => s.meta.album],
  genre: ['Género', (s) => s.meta.genre],
  charter: ['Charter', (s) => s.meta.charter],
  year: ['Año', (s) => s.meta.year],
  length: ['Duración', (s) => s.length],
};
// La vista previa de una canción: su audio en el servidor local o, con
// Firebase, los 30 s de Apple Music, sin bajar nada de la canción. La usan el
// selector y la sala en línea (lo que hojea quien dirige, la canción elegida).
let previewTok = 0;
let previewTimer = null;
export function cancelaVistaPrevia() {
  clearTimeout(previewTimer);
  previewTok++;
}
export function tocaVistaPrevia(app, s) {
  cancelaVistaPrevia();
  const tok = previewTok;
  if (!s) return app.preview.stop();
  const pv = previewInfo(s);
  if (pv) {
    previewTimer = setTimeout(() => app.preview.play(pv.url, pv.start), 150);
    return;
  }
  const conocida = library.remote ? appleConocida(s) : '';
  if (conocida === '') return app.preview.stop();
  if (!conocida) app.preview.stop();
  previewTimer = setTimeout(async () => {
    const url = await previewApple(s);
    if (tok !== previewTok) return;
    if (url) app.preview.play(url, 0, { loop: true, onError: () => olvidaApple(s) });
    else app.preview.stop();
  }, conocida ? 150 : APPLE_ESPERA);
}

let lastState = { sort: 'artist', query: '', instrument: 'all', selectId: null };

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Tus estrellas en una canción: las doradas (en la dificultad más alta) y,
// detrás, las azules que tengas de más en otra dificultad.
export function estrellasEl(r, cls = 'r-stars') {
  const { oro, azul } = estrellasDe(r);
  if (!oro && !azul) return null;
  return h('span', { class: cls, title: `${oro} ${oro === 1 ? 'estrella dorada' : 'estrellas doradas'}${azul ? ` y ${azul} azul${azul === 1 ? '' : 'es'} más` : ''}` },
    ...Array.from({ length: oro }, () => h('i', { class: 'oro' }, '★')),
    ...Array.from({ length: azul }, () => h('i', { class: 'azul' }, '★')));
}

// El top de una canción se pide recién cuando te quedas TOP_ESPERA en ella:
// recorrer la lista no baja nada de la base de datos.
const TOP_ESPERA = 3000;
const tops = new Map(); // clave → {filas, error} (en esta visita)
const fmtPts = (n) => Math.round(n).toLocaleString('es');
const DIFF_CORTA = { expert: 'Experto', hard: 'Difícil', medium: 'Medio', easy: 'Fácil' };
const PARTE_CORTA = { guitar: 'Guitarra', bass: 'Bajo', rhythm: 'Rítmica', guitarcoop: 'Guitarra coop', keys: 'Teclado', drums: 'Batería' };

export function difficultyDots(n) {
  if (n < 0) return null;
  const v = Math.min(6, n);
  return h('span', { class: 'dots' }, ...Array.from({ length: 6 }, (_, i) => h('i', { class: i < v ? 'on' : '' })));
}

export class SongSelectScreen extends Screen {
  constructor(app, { mode = 'play', onPick = null, onBrowse = null, selectId = null } = {}) {
    super(app);
    this.mode = mode;
    this.onPick = onPick;
    this.onBrowse = onBrowse;
    this.state = { ...lastState };
    if (selectId) this.state.selectId = selectId;
    this.filtered = [];
    this.sel = 0;
  }

  render() {
    this.search = h('input', { class: 'search', placeholder: 'Buscar artista, canción, álbum, charter…', value: this.state.query, oninput: () => this.applyFilter(true) });
    this.sortSel = h('select', { onchange: () => this.applyFilter(false) },
      ...Object.entries(SORTS).map(([k, [label]]) => h('option', { value: k, selected: k === this.state.sort }, label)));
    this.instSel = h('select', { onchange: () => this.applyFilter(false) },
      h('option', { value: 'all' }, 'Todos los instrumentos'),
      ...PART_ORDER.map((p) => h('option', { value: p, selected: p === this.state.instrument }, PARTS[p].label)));
    this.count = h('span', { class: 'count' });
    this.spacer = h('div', { class: 'spacer' });
    this.rows = h('div', { class: 'rows' });
    this.list = h('div', { class: 'song-list', onscroll: () => this.renderRows() }, this.spacer, this.rows);
    this.detail = h('div', { class: 'song-detail' });
    return h('div', { class: 'screen song-select' },
      h('div', { class: 'ss-head' },
        h('button', { class: 'back-btn', onclick: () => this.back() }, '‹'),
        h('h1', {}, this.mode === 'pick' ? 'Elegir canción para la sala' : 'Elegir canción'),
        this.count),
      h('div', { class: 'ss-tools' }, this.search, this.sortSel, this.instSel),
      h('div', { class: 'ss-body' }, this.list, this.detail),
      h('div', { class: 'hint' }, '↑↓ moverse · RePág/AvPág saltar · escribe para buscar · Enter elegir · Esc volver'));
  }

  afterMount() {
    this.applyFilter(false);
    this.ro = new ResizeObserver(() => this.renderRows());
    this.ro.observe(this.list);
    this.offMias = sitio.on('mias', () => {
      this.renderRows();
      this.renderMiRecord();
    });
    this.offTop = sitio.on('top', (d) => {
      tops.set(d.k, { filas: d.filas || [], error: !!d.error });
      if (this.topK === d.k) this.renderTop();
    });
  }

  beforeUnmount() {
    lastState = { ...this.state };
    clearTimeout(this.detailTimer);
    cancelaVistaPrevia();
    clearTimeout(this.topTimer);
    this.offMias?.();
    this.offTop?.();
    this.ro?.disconnect();
    if (this.mode !== 'play') this.app.preview.stop();
  }

  onLibrary() {
    this.applyFilter(false);
  }

  applyFilter(fromSearch) {
    const q = norm(this.search.value.trim());
    const inst = this.instSel.value;
    const sortKey = this.sortSel.value;
    const prevId = this.filtered[this.sel]?.id ?? this.state.selectId;
    this.state = { ...this.state, query: this.search.value, sort: sortKey, instrument: inst };
    const terms = q.split(/\s+/).filter(Boolean);
    let list = library.songs.filter((s) => {
      if (inst !== 'all' && !s.parts[inst]) return false;
      if (!terms.length) return true;
      const hay = norm(`${s.meta.name} ${s.meta.artist} ${s.meta.album} ${s.meta.charter} ${s.meta.genre}`);
      return terms.every((t) => hay.includes(t));
    });
    const get = SORTS[sortKey][1];
    list.sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === 'number') return va - vb;
      return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) || a.meta.name.localeCompare(b.meta.name, 'es');
    });
    this.filtered = list;
    this.count.textContent = library.scanning && !library.songs.length
      ? `Escaneando… ${library.progress}`
      : `${list.length.toLocaleString('es')} canciones`;
    this.spacer.style.height = `${list.length * ROW_H}px`;
    let idx = fromSearch ? 0 : list.findIndex((s) => s.id === prevId);
    this.select(Math.max(0, idx), true);
  }

  select(i, center = false) {
    if (!this.filtered.length) {
      this.sel = 0;
      this.renderRows();
      this.detail.replaceChildren(h('div', { class: 'empty' }, library.scanning ? 'Escaneando canciones…' : 'No hay canciones que coincidan'));
      return;
    }
    this.sel = Math.max(0, Math.min(this.filtered.length - 1, i));
    const top = this.sel * ROW_H;
    const lh = this.list.clientHeight;
    if (center) this.list.scrollTop = top - lh / 2 + ROW_H / 2;
    else if (top < this.list.scrollTop) this.list.scrollTop = top;
    else if (top + ROW_H > this.list.scrollTop + lh) this.list.scrollTop = top + ROW_H - lh;
    this.state.selectId = this.filtered[this.sel].id;
    this.renderRows();
    // al desplazarse rápido solo se actualiza la lista; la ficha y la vista previa esperan a que pares
    clearTimeout(this.detailTimer);
    this.detailTimer = setTimeout(() => this.renderDetail(), 90);
  }

  renderRows() {
    const st = this.list.scrollTop;
    const lh = this.list.clientHeight || 600;
    const from = Math.max(0, Math.floor(st / ROW_H) - 4);
    const to = Math.min(this.filtered.length, Math.ceil((st + lh) / ROW_H) + 4);
    const get = SORTS[this.state.sort][1];
    const rows = [];
    let lastHeader = from > 0 ? headerOf(get(this.filtered[from - 1]), this.state.sort) : null;
    for (let i = from; i < to; i++) {
      const s = this.filtered[i];
      const hd = headerOf(get(s), this.state.sort);
      const showHd = hd !== lastHeader;
      lastHeader = hd;
      rows.push(h('div', {
        class: `row${i === this.sel ? ' sel' : ''}`,
        style: { top: `${i * ROW_H}px` },
        onclick: () => this.select(i),
        ondblclick: () => this.confirm(),
      },
      showHd ? h('span', { class: 'row-hd' }, hd) : null,
      h('div', { class: 'r-name' }, s.meta.name),
      h('div', { class: 'r-sub' }, `${s.meta.artist}${s.meta.charter ? ` · ${s.meta.charter}` : ''}`),
      estrellasEl(sitio.record(s)),
      h('div', { class: 'r-len' }, fmtTime(s.length))));
    }
    this.rows.replaceChildren(...rows);
  }

  renderDetail() {
    const s = this.filtered[this.sel];
    if (!s) return;
    const m = s.meta;
    const parts = PART_ORDER.filter((p) => s.parts[p]).map((p) =>
      h('div', { class: 'inst' },
        h('span', { class: `inst-icon i-${p}` }),
        h('span', { class: 'inst-name' }, PARTS[p].label),
        difficultyDots(m.diffs[p] ?? -1) || h('span', { class: 'dots-na' }),
        h('span', { class: 'inst-diffs' }, DIFFS.filter((d) => s.parts[p][d]).map((d) => d[0].toUpperCase()).join(' '))));
    const info = (k, v) => (v ? h('div', { class: 'info' }, h('span', {}, k), h('b', {}, v)) : null);
    // replaceChildren escribe «null» en vez de saltárselo: lo que no va, fuera
    this.detail.replaceChildren(...[
      artImg(s, 'album') || h('div', { class: 'album empty' }, '♪'),
      h('div', { class: 'd-name' }, m.name),
      h('div', { class: 'd-artist' }, m.artist),
      h('div', { class: 'd-info' },
        info('Álbum', m.album), info('Año', m.year), info('Género', m.genre),
        info('Charter', m.charter), info('Duración', fmtTime(s.length)),
        info('Formato', s.chartFile.toLowerCase().endsWith('.mid') ? 'MIDI' : 'Chart'),
        s.video ? info('Video', 'Sí') : null),
      h('div', { class: 'insts' }, ...parts),
      library.remote ? h('div', { class: 'd-note' }, 'La canción se descarga al pulsar Jugar') : null,
      h('button', { class: 'primary', 'data-nav': true, onclick: () => this.confirm() }, this.mode === 'pick' ? 'Elegir esta canción' : 'Jugar'),
      (this.miRecord = h('div', { class: 'd-mio' })),
      sitio.embebido ? h('div', { class: 'd-aviso' }, h('i', { class: 'oro' }, '★'), ' Doradas: solo en Experto, o en la dificultad más alta que tenga el instrumento. En las demás, ', h('i', { class: 'azul' }, '★'), ' azules.') : null,
      (this.topEl = sitio.embebido && sitio.cuenta ? h('div', { class: 'd-top' }) : null)].filter(Boolean));
    this.renderMiRecord();
    // el top de esta canción, si te quedas en ella
    clearTimeout(this.topTimer);
    this.topK = claveCancion(s.id);
    if (this.topEl) {
      if (tops.has(this.topK)) this.renderTop();
      else {
        this.topEl.replaceChildren(h('div', { class: 'top-h' }, 'Mejores puntajes'), h('div', { class: 'top-espera' }, 'Quédate un momento en la canción para ver su top…'));
        const k = this.topK;
        this.topTimer = setTimeout(() => {
          if (this.topK !== k) return;
          this.topEl?.querySelector('.top-espera')?.replaceChildren('Cargando el top…');
          sitio.envia('top-pedir', { k });
        }, TOP_ESPERA);
      }
    }
    tocaVistaPrevia(this.app, s);
    // en una sala, quien dirige deja ver a los demás lo que tiene marcado
    if (this.onBrowse && s.id !== this.ojeado) {
      this.ojeado = s.id;
      this.onBrowse(s);
    }
  }

  renderMiRecord() {
    const s = this.filtered[this.sel];
    if (!this.miRecord || !s) return;
    const r = sitio.record(s);
    this.miRecord.replaceChildren(...(r && (r.s || r.g || r.b)
      ? [h('span', {}, 'Tu récord'), estrellasEl(r, 'd-stars') || h('span', { class: 'd-stars vacio' }, 'sin estrellas'), h('b', {}, fmtPts(r.s || 0))]
      : []));
  }

  renderTop() {
    const t = tops.get(this.topK);
    if (!this.topEl || !t) return;
    const filas = t.filas.slice(0, 10);
    this.topEl.replaceChildren(
      h('div', { class: 'top-h' }, 'Mejores puntajes'),
      t.error
        ? h('div', { class: 'top-espera' }, 'No se pudo cargar el top.')
        : !filas.length
          ? h('div', { class: 'top-espera' }, 'Nadie tiene puntaje en esta canción. ¡Estrénala!')
          : h('ol', { class: 'top-lista' }, ...filas.map((f, i) => h('li', { class: f.yo ? 'yo' : '' },
            h('span', { class: 'top-n' }, `${i + 1}`),
            h('span', { class: 'top-nombre', translate: 'no' }, f.nombre || 'Jugador'),
            h('span', { class: 'top-parte' }, `${PARTE_CORTA[f.p] || ''} ${DIFF_CORTA[f.d] || ''}`.trim(),
              f.e ? h('i', { class: f.oro ? 'oro' : 'azul' }, ` ${'★'.repeat(Math.min(5, f.e))}`) : null),
            h('b', {}, fmtPts(f.s))))));
  }

  confirm() {
    const s = this.filtered[this.sel];
    if (!s) return;
    if (this.mode === 'pick') return this.onPick?.(s);
    this.app.show(new PartSelectScreen(this.app, s));
  }

  back() {
    this.app.preview.stop();
    if (this.mode === 'pick') return this.onPick?.(null);
    this.app.goMenu();
  }

  onInput(ev) {
    if (!ev.down) return false;
    // Escribir letras enfoca la búsqueda
    if (ev.device === 'keyboard' && !ev.typing && ev.key && ev.key.length === 1 && !ev.event.ctrlKey && !ev.event.metaKey) {
      this.search.focus();
      return false;
    }
    if (ev.device === 'keyboard' && ev.typing && ev.code === 'Escape' && this.search.value) {
      this.search.value = '';
      this.applyFilter(true);
      this.search.blur();
      return true;
    }
    return false;
  }

  onNav(a) {
    if (a === 'up') this.select(this.sel - 1);
    else if (a === 'down') this.select(this.sel + 1);
    else if (a === 'pageup' || a === 'left') this.select(this.sel - 10);
    else if (a === 'pagedown' || a === 'right') this.select(this.sel + 10);
    else if (a === 'confirm') this.confirm();
    else if (a === 'back') this.back();
  }
}

function headerOf(v, sort) {
  if (sort === 'length') return `${Math.floor(v / 60000)} min`;
  if (sort === 'year') return String(v || '¿?').slice(0, 4);
  const c = norm(v).trim()[0];
  if (!c) return '#';
  return /[a-z]/.test(c) ? c.toUpperCase() : '#';
}
