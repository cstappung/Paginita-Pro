// Buzón de señalización de prueba entre perfiles de Chrome independientes.
// Solo intercambia presencia/SDP/ICE: los botones siguen viajando por WebRTC real.
import { createServer } from 'node:http';
export async function crearBuzonHttp() {
  const clientes = new Map();
  const atender = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET') {
      const id = u.searchParams.get('id'), canal = u.searchParams.get('canal');
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(': listo\n\n');
      clientes.set(id, { canal, res });
      req.on('close', () => { if (clientes.get(id)?.res === res) clientes.delete(id); });
      return;
    }
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    try {
      let texto = '';
      for await (const b of req) { texto += b; if (texto.length > 2000000) throw new Error('mensaje demasiado grande'); }
      const m = JSON.parse(texto);
      for (const [id, c] of clientes) if (id !== m.id && c.canal === m.canal) c.res.write(`data: ${JSON.stringify(m.dato)}\n\n`);
      res.end('ok');
    } catch { res.writeHead(400); res.end(); }
  };
  // HTTP/1 limita las conexiones persistentes por origen: doce SSE en un puerto bloquearían los POST.
  // Un origen de recepción por puesto y otro de envío evitan ese atasco sin depender de DNS ni certificados.
  const servidores = Array.from({ length: 13 }, () => createServer(atender));
  for (const s of servidores) await new Promise(r => s.listen(0, '127.0.0.1', r));
  const urls = servidores.map(s => `http://127.0.0.1:${s.address().port}`);
  return { url: urls[0], streams: urls.slice(1), cerrar() { for (const s of servidores) { s.closeAllConnections(); s.close(); } } };
}

// Se instala solo en los contextos de esta prueba, antes de cargar cualquier módulo del juego.
export function instalarBuzon({ url, streams }) {
  globalThis.BroadcastChannel = class extends EventTarget {
    constructor(canal) {
      super();
      this.name = canal; this.id = crypto.randomUUID(); this.onmessage = null; this.cerrado = false;
      const puesto = Number(new URLSearchParams(location.search).get('uid')?.match(/^j(\d+)/)?.[1]) || 0;
      const origen = streams?.[puesto] || url;
      this.fuente = new EventSource(`${origen}/?id=${this.id}&canal=${encodeURIComponent(canal)}`);
      this.listo = new Promise(r => this.fuente.addEventListener('open', r, { once: true }));
      this.cola = this.listo;
      this.fuente.onmessage = e => {
        const evento = new MessageEvent('message', { data: JSON.parse(e.data) });
        this.onmessage?.(evento); this.dispatchEvent(evento);
      };
    }
    postMessage(dato) {
      const cuerpo = JSON.stringify({ id: this.id, canal: this.name, dato });
      this.cola = this.cola.then(() => { if (!this.cerrado) return fetch(url, { method: 'POST', body: cuerpo }); }).catch(() => {});
    }
    close() { this.cerrado = true; this.fuente.close(); }
  };
}
