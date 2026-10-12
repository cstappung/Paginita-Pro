// Pantalla de resultados (local y en línea): estrellas que aparecen una a una, puntaje que sube,
// precisión en un anillo, récord personal, rendimiento a lo largo de la canción y por sección.
import { h, Screen } from './dom.js';
import { PARTS, DIFF_LABEL } from '../core/constants.js';
import { SongSelectScreen } from './songSelect.js';
import { LobbyScreen } from './online.js';
import { sitio } from '../sitio/puente.js';
import { dificultadMaxima } from '../sitio/clave.js';

const fmt = (n) => Math.round(n).toLocaleString('es');
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// Récord personal por canción, instrumento y dificultad (en este navegador)
function bestKey(entry, r) {
  return `hero.best.${entry.id}.${r.part}.${r.diff}`;
}
function readBest(entry, r) {
  try {
    return JSON.parse(localStorage.getItem(bestKey(entry, r)));
  } catch {
    return null;
  }
}
function saveBest(entry, r, s) {
  try {
    localStorage.setItem(bestKey(entry, r), JSON.stringify({ score: s.score, stars: s.stars, acc: s.accuracy, fc: s.fc }));
  } catch {}
}

// Doradas si se tocó en la dificultad más alta del instrumento; si no, azules
function starsEl(n, oro) {
  const shown = Math.min(5, n);
  return h('div', { class: `rc-stars ${oro ? 'oro' : 'azul'}` },
    Array.from({ length: 5 }, (_, i) =>
      h('span', { class: `star${i < shown ? ' on' : ''}`, style: { '--d': `${0.25 + i * 0.16}s` } }, '★')));
}

// Anillo de precisión (SVG)
function accuracyRing(acc) {
  const r = 46, c = 2 * Math.PI * r;
  const col = acc >= 0.95 ? '#53e7ff' : acc >= 0.8 ? '#3ee36b' : acc >= 0.6 ? '#ffb21e' : '#ff4d5e';
  const el = h('div', { class: 'rc-ring', style: { '--ring': col } });
  el.innerHTML = `<svg viewBox="0 0 110 110" aria-hidden="true">
    <circle cx="55" cy="55" r="${r}" class="ring-bg"/>
    <circle cx="55" cy="55" r="${r}" class="ring-fg" stroke="${col}"
      style="--c:${c.toFixed(1)};--off:${(c * (1 - acc)).toFixed(1)}" transform="rotate(-90 55 55)"/>
  </svg>`;
  el.append(h('div', { class: 'ring-txt' }, h('b', {}, `${(acc * 100).toFixed(1)}%`), h('span', {}, 'precisión')));
  return el;
}

// Rendimiento a lo largo de la canción: columnas verdes (aciertos) y rojas (fallos)
function timelineEl(tl) {
  const max = Math.max(1, ...tl.map(([a, b]) => a + b));
  const W = 480, H = 64, bw = W / tl.length;
  let bars = '';
  tl.forEach(([hit, miss], i) => {
    const x = (i * bw + 1).toFixed(1), w = Math.max(1, bw - 2).toFixed(1);
    const hh = (hit / max) * H, mh = (miss / max) * H;
    if (hit) bars += `<rect x="${x}" y="${(H - hh).toFixed(1)}" width="${w}" height="${hh.toFixed(1)}" rx="1.5" class="tl-hit" style="--i:${i}"/>`;
    if (miss) bars += `<rect x="${x}" y="${(H - hh - mh).toFixed(1)}" width="${w}" height="${mh.toFixed(1)}" rx="1.5" class="tl-miss" style="--i:${i}"/>`;
  });
  const el = h('div', { class: 'rc-timeline' }, h('div', { class: 'rc-sub' }, 'A lo largo de la canción'));
  const box = h('div', { class: 'tl-box' });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
  el.append(box, h('div', { class: 'tl-legend' }, h('span', { class: 'lg-hit' }, 'aciertos'), h('span', { class: 'lg-miss' }, 'fallos')));
  return el;
}

function sectionsEl(sections) {
  return h('div', { class: 'rc-sections' },
    h('div', { class: 'rc-sub' }, 'Por sección'),
    h('div', { class: 'sec-list' }, sections.map((s) => {
      const p = pct(s.hits, s.total);
      const cls = p >= 100 ? 'perfect' : p >= 85 ? 'good' : p >= 65 ? 'ok' : 'bad';
      return h('div', { class: `sec ${cls}` },
        h('span', { class: 'sec-name', title: s.name }, s.name),
        h('div', { class: 'sec-bar' }, h('i', { style: { width: `${p}%` } })),
        h('b', {}, p >= 100 ? '100%' : `${Math.floor(p)}%`));
    })));
}

export class ResultsScreen extends Screen {
  constructor(app, { entry, results, net }) {
    super(app);
    this.entry = entry;
    this.results = results;
    this.net = net;
    // récords: se comparan una sola vez al terminar (jugadores locales, no bots)
    for (const r of results) {
      if (r.type === 'remote' || r.bot || !r.stats || r.stats.quit) continue;
      r.prevBest = readBest(entry, r);
      r.newBest = !r.prevBest || r.stats.score > r.prevBest.score;
      if (r.newBest) saveBest(entry, r, r.stats);
    }
  }

  render() {
    this.cards = h('div', { class: 'result-cards' });
    const buttons = this.net
      ? [h('button', { class: 'primary', 'data-nav': true, onclick: () => this.app.show(new LobbyScreen(this.app)) }, 'Volver a la sala')]
      : [
        h('button', { class: 'primary', 'data-nav': true, onclick: () => this.app.restartSession() }, 'Repetir'),
        h('button', { 'data-nav': true, onclick: () => this.back() }, 'Elegir otra canción'),
      ];
    // Lo que dice la página de Juegos de esta canción: guardada, estrellas, monedas
    this.nube = sitio.embebido && sitio.cuenta ? h('div', { class: 'res-nube' }, 'Verificando tu partida…') : null;
    return h('div', { class: 'screen results' },
      this.nube,
      h('div', { class: 'res-title' },
        h('div', { class: 'res-kicker' }, 'Canción terminada'),
        h('div', { class: 'res-name' }, this.entry.meta.name),
        h('div', { class: 'res-artist' }, this.entry.meta.artist)),
      this.cards,
      this.net ? h('div', { class: 'hint wait-hint' }, 'Esperando a los demás jugadores…') : null,
      h('div', { class: 'res-buttons' }, ...buttons));
  }

  afterMount() {
    this.renderCards();
    this.focusFirst();
    this.offV = sitio.on('veredicto', (d) => this.pintaVeredicto(d));
    if (this.net) {
      this.off = this.net.on('room', (m) => this.mergeRoom(m.room));
      this.off2 = this.net.on('results', (m) => this.mergeRoom(m.room, true));
      if (this.net.room) this.mergeRoom(this.net.room, this.net.room.phase === 'lobby');
    }
  }

  pintaVeredicto(d) {
    if (!this.nube) return;
    const fmtM = (n) => `+${fmt(n)} 🪙`;
    if (!d.ok) {
      this.nube.className = 'res-nube mal';
      this.nube.replaceChildren(h('b', {}, 'Esta partida no se guardó'), h('span', {}, d.motivo || ''));
      return;
    }
    const partes = [];
    if (d.oro) partes.push(h('span', { class: 'rn-est' }, h('i', { class: 'oro' }, '★'), ` ${d.oro} ${d.oro === 1 ? 'dorada nueva' : 'doradas nuevas'}`));
    if (d.azul) partes.push(h('span', { class: 'rn-est' }, h('i', { class: 'azul' }, '★'), ` ${d.azul} ${d.azul === 1 ? 'azul nueva' : 'azules nuevas'}`));
    if (d.record) partes.push(h('span', {}, '¡Nuevo récord en esta canción!'));
    if (!d.maxima) partes.push(h('span', { class: 'rn-nota' }, 'Para estrellas doradas, toca en Experto (o la dificultad más alta del instrumento).'));
    const monedas = (d.monedasCancion || 0) + (d.monedasEstrellas || 0);
    this.nube.className = 'res-nube ok';
    this.nube.replaceChildren(...[
      h('b', {}, d.guardada ? 'Guardado en tu cuenta' : 'Partida verificada'),
      ...partes,
      monedas ? h('span', { class: 'rn-monedas' }, fmtM(monedas),
        h('small', {}, [d.monedasCancion ? `${d.monedasCancion} por terminarla` : '', d.monedasEstrellas ? `${d.monedasEstrellas} por estrellas` : ''].filter(Boolean).join(' · '))) : null,
      !d.monedasCancion && d.tope ? h('span', { class: 'rn-nota' }, 'Hoy ya cobraste las canciones de PRO HERO que pagan (15 al día).') : null].filter(Boolean));
  }

  beforeUnmount() {
    this.offV?.();
    this.off?.();
    this.off2?.();
    cancelAnimationFrame(this.countRaf);
  }

  mergeRoom(room, final = false) {
    let changed = false;
    for (const rp of room.players) {
      if (!rp.stats) continue;
      const r = this.results.find((x) => x.id === rp.id || (x.type !== 'remote' && rp.id === this.net.id));
      if (r && !r.stats) {
        r.stats = rp.stats;
        changed = true;
      }
    }
    if (final) this.el.querySelector('.wait-hint')?.remove();
    if (changed) this.renderCards();
  }

  renderCards() {
    const sorted = [...this.results].sort((a, b) => (b.stats?.score ?? -1) - (a.stats?.score ?? -1));
    const multi = sorted.length > 1;
    this.cards.classList.toggle('multi', multi);
    this.cards.replaceChildren(...sorted.map((r, i) => this.card(r, i, multi)));
    this.countUp();
  }

  card(r, i, multi) {
    const s = r.stats;
    const d = r.detail;
    const head = h('div', { class: 'rc-head' },
      h('div', {},
        h('div', { class: 'rc-name' }, `${r.name || 'Jugador'}${r.bot ? ' (BOT)' : ''}`),
        h('div', { class: 'rc-part' }, `${PARTS[r.part]?.label || r.part} · ${DIFF_LABEL[r.diff] || r.diff}`)),
      multi ? h('div', { class: `rc-rank${i === 0 && s ? ' first' : ''}` }, `#${i + 1}`) : null);
    if (!s) return h('div', { class: 'res-card' }, head, h('div', { class: 'rc-wait' }, 'Tocando…'));

    const badges = [
      s.fc ? h('span', { class: 'badge fc' }, 'FULL COMBO') : null,
      r.newBest && r.prevBest ? h('span', { class: 'badge best' }, '¡Nuevo récord!') : null,
      r.newBest && !r.prevBest ? h('span', { class: 'badge first' }, 'Primera vez') : null,
      s.quit ? h('span', { class: 'badge quit' }, 'Abandonó') : null,
    ].filter(Boolean);

    const stat = (label, value, cls = '') => h('div', { class: `st ${cls}` }, h('b', {}, value), h('span', {}, label));
    const grid = h('div', { class: 'rc-stats' },
      stat('notas', `${fmt(s.hits)} / ${fmt(s.total)}`),
      stat('fallos', fmt(s.misses ?? s.total - s.hits), (s.misses ?? 0) === 0 ? 'zero' : ''),
      stat('mejor racha', fmt(s.bestCombo)),
      stat('frases de Star Power', `${s.spPhrases} / ${s.spTotal}`),
      d?.soloBonus ? stat('bonus de solos', `+${fmt(d.soloBonus)}`) : null,
      s.overhits ? stat('notas de más', fmt(s.overhits)) : null);

    const prev = r.prevBest && !r.newBest
      ? h('div', { class: 'rc-prev' }, `Tu récord: ${fmt(r.prevBest.score)}`)
      : r.prevBest && r.newBest
        ? h('div', { class: 'rc-prev up' }, `+${fmt(s.score - r.prevBest.score)} sobre tu récord anterior`)
        : null;

    const extra = [];
    if (d?.timeline && !multi) extra.push(timelineEl(d.timeline));
    if (d?.sections?.length > 1 && !multi) extra.push(sectionsEl(d.sections));
    if (d?.solos?.length && !multi) {
      extra.push(h('div', { class: 'rc-solos' }, d.solos.map((so, k) =>
        h('span', { class: `solo${so.hits === so.total ? ' perfect' : ''}` },
          `${d.solos.length > 1 ? `Solo ${k + 1}` : 'Solo'}: ${Math.floor(pct(so.hits, so.total))}%`))));
    }

    return h('div', { class: `res-card${multi && i === 0 ? ' winner' : ''}${multi ? '' : ' solo-card'}` },
      head,
      starsEl(s.stars, this.app.lastSong ? r.diff === dificultadMaxima(this.app.lastSong, r.part) : r.diff === 'expert'),
      h('div', { class: 'rc-score', 'data-to': s.score }, '0'),
      badges.length ? h('div', { class: 'rc-badges' }, badges) : null,
      prev,
      h('div', { class: 'rc-main' }, accuracyRing(s.accuracy), grid),
      extra.length ? h('div', { class: 'rc-extra' }, extra) : null);
  }

  // el puntaje "sube" hasta el valor final
  countUp() {
    cancelAnimationFrame(this.countRaf);
    const els = [...this.cards.querySelectorAll('.rc-score[data-to]')];
    const t0 = performance.now(), dur = 1300;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - (1 - k) ** 3;
      for (const el of els) el.textContent = fmt(Number(el.dataset.to) * e);
      if (k < 1) this.countRaf = requestAnimationFrame(step);
    };
    step();
  }

  back() {
    if (this.net) this.app.show(new LobbyScreen(this.app));
    else this.app.show(new SongSelectScreen(this.app, { mode: 'play', selectId: this.entry.id }));
  }
}
