// La red de una sala de PRO HERO dentro de Juegos. Ya no hay servidor
// WebSocket: la página (colabtex/src/juegos/hero-sala.js) hace de servidor.
// Lo que hay que acordar (la canción, las partes, «listo», el arranque, los
// resultados) va como jugadas al registro de la sala; el estado en vivo de
// cada uno (~10 por segundo) va de navegador a navegador por la malla
// WebRTC, sin pasar por la base de datos. Los mensajes son los mismos que
// hablaba el servidor de antes, así que online.js y session.js casi no
// cambian:
//   el juego manda  song, part, ready, start, loaded, noload, state, done, leave
//   la página manda welcome, room, load, go, pstate, results, error, reloj
import { sitio } from '../sitio/puente.js';

export class NetClient {
  constructor() {
    this.handlers = new Map();
    this.id = null;
    this.room = null;
    this.offset = 0; // hora del servidor - Date.now()
    this.rtt = 0;
    this._conectado = false;
    this.off = sitio.on('red', (d) => this._recibe(d.m || {}));
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!sitio.sala) return reject(new Error('Las salas de PRO HERO se abren desde el salón de Juegos'));
      if (this.id) return resolve();
      const t = setTimeout(() => reject(new Error('La sala no respondió')), 15000);
      const off = this.on('welcome', () => {
        clearTimeout(t);
        off();
        resolve();
      });
      sitio.envia('red', { m: { t: 'hello' } });
    });
  }

  _recibe(m) {
    if (m.t === 'welcome') {
      this.id = m.id;
      this._conectado = true;
    }
    if (m.t === 'reloj' && Number.isFinite(m.off)) this.offset = m.off;
    if (m.room) this.room = m.room;
    if (m.t === 'left') this.room = null;
    for (const fn of this.handlers.get(m.t) || []) fn(m);
    for (const fn of this.handlers.get('*') || []) fn(m);
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  send(m) {
    sitio.envia('red', { m });
  }

  close() {
    this.off?.();
    this._conectado = false;
  }

  get connected() {
    return this._conectado;
  }

  // Hora del servidor (ms) → performance.now() de este navegador
  serverToPerf(serverMs) {
    return performance.now() + (serverMs - (Date.now() + this.offset));
  }
}
