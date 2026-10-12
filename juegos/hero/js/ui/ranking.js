// La clasificación de PRO HERO: una sola tabla, la general, por estrellas
// doradas (las que se ganan en Experto o en la dificultad más alta que tenga
// el instrumento). Los datos los trae la página (soloRanks/club-hero-estrellas).
import { h, Screen } from './dom.js';
import { sitio } from '../sitio/puente.js';

const fmt = (n) => Math.round(n).toLocaleString('es');

export class RankingScreen extends Screen {
  render() {
    this.body = h('div', { class: 'rk-body' }, h('div', { class: 'top-espera' }, 'Cargando la clasificación…'));
    return h('div', { class: 'screen ranking' },
      h('div', { class: 'ss-head' },
        h('button', { class: 'back-btn', 'data-nav': true, onclick: () => this.back() }, '‹'),
        h('h1', {}, 'Clasificación general')),
      h('p', { class: 'rk-lema' },
        'Gana quien tiene más ', h('i', { class: 'oro' }, '★'), ' estrellas doradas. Solo cuentan las de Experto, o las de la dificultad más alta que tenga el instrumento en esa canción. Si hay empate, desempatan las ',
        h('i', { class: 'azul' }, '★'), ' azules.'),
      this.body,
      h('div', { class: 'hint' }, 'Esc volver'));
  }

  afterMount() {
    this.off = sitio.on('ranking', (d) => this.pinta(d));
    sitio.envia('ranking-pedir');
    if (!sitio.embebido) this.body.replaceChildren(h('div', { class: 'top-espera' }, 'Abre PRO HERO desde Juegos para ver la clasificación.'));
  }

  beforeUnmount() {
    this.off?.();
  }

  pinta(d) {
    const filas = d.filas || [];
    if (d.error) return this.body.replaceChildren(h('div', { class: 'top-espera' }, 'No se pudo cargar la clasificación.'));
    if (!filas.length) return this.body.replaceChildren(h('div', { class: 'top-espera' }, 'Todavía nadie tiene estrellas doradas. ¡Estrena la tabla!'));
    const fila = (f) => h('tr', { class: f.yo ? 'yo' : '' },
      h('td', { class: 'rk-n' }, `${f.puesto}`),
      h('td', { class: 'rk-nombre', translate: 'no' }, f.nombre || 'Jugador'),
      h('td', { class: 'rk-oro' }, h('i', { class: 'oro' }, '★'), ` ${fmt(f.g)}`),
      h('td', { class: 'rk-azul' }, h('i', { class: 'azul' }, '★'), ` ${fmt(Math.max(0, f.m - f.g))}`),
      h('td', { class: 'rk-c' }, `${fmt(f.h || 0)}`),
      h('td', { class: 'rk-c' }, `${fmt(f.h5 || 0)}`));
    const propio = d.propio && !filas.some((f) => f.yo) ? [h('tr', { class: 'sep' }, h('td', { colspan: 6 }, '…')), fila(d.propio)] : [];
    this.body.replaceChildren(h('table', { class: 'rk-tabla' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Jugador'), h('th', {}, 'Doradas'), h('th', {}, 'Azules'),
        h('th', { title: 'Canciones con al menos una estrella dorada' }, 'Canciones'), h('th', { title: 'Canciones con las 5 estrellas doradas' }, '5 ★'))),
      h('tbody', {}, ...filas.map(fila), ...propio)));
  }

  // La tabla no tiene botones navegables: Esc (o el rojo del mando) vuelve igual
  onNav(a) {
    if (a === 'back') this.back();
  }

  back() {
    this.app.goMenu();
  }
}
