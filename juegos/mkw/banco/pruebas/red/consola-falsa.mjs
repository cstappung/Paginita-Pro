// Una "consola" falsa para el banco: habla con el WFC (wfc.mjs) como lo hace Mario Kart Wii, con datos inventados
// con la misma forma (NAS por HTTP con el base64 de la Wii, GPCM con la cuenta MD5 de GameSpy, HTTP GET a las API).
// La usan las páginas red/ y vr/.
import { md5, leerGs, escribirGs } from '/web/navegador/wfc.mjs';

const tx = new TextEncoder(), rx = new TextDecoder('latin1');
export const espera = ms => new Promise(r => setTimeout(r, ms));
export const hasta = async (cond, ms = 5000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (cond()) return true; await espera(20); } return cond(); };
// lee de una conexión TCP de JS hasta que el texto acumulado cumpla `cond`
export const lector = con => { let txt = ''; con.alRecibir(b => { txt += rx.decode(b); }); return { texto: () => txt, esperar: async (cond, ms) => (await hasta(() => cond(txt), ms)) ? txt : null, vaciar: () => { txt = ''; } }; };
// el base64 de la Wii: * en vez de =, . en vez de +, - en vez de /
export const b64Wii = { a: s => btoa(s).replace(/=/g, '*').replace(/\+/g, '.').replace(/\//g, '-'), de: s => atob(s.replace(/\*/g, '=').replace(/\./g, '+').replace(/-/g, '/')) };

export function consolaFalsa(pila, wfcIp = '10.77.0.1') {
  // un pedido HTTP completo (Connection: close) → { estado, cuerpo }
  async function http(linea, cuerpo = '', cab = '') {
    const con = await pila.conectarTcp(wfcIp, 80), l = lector(con);
    con.enviar(tx.encode(`${linea} HTTP/1.1\r\nHost: nas.nintendowifi.net\r\n${cab}Content-Length: ${cuerpo.length}\r\n\r\n${cuerpo}`));
    const r = await l.esperar(t => { const i = t.indexOf('\r\n\r\n'); if (i < 0) return false; const n = +(/content-length:\s*(\d+)/i.exec(t)?.[1] || 0); return t.length >= i + 4 + n; }, 3000);
    const i = r.indexOf('\r\n\r\n');
    return { estado: r.slice(9, 12), cuerpo: r.slice(i + 4) };
  }
  async function nas(campos) {
    const cuerpo = Object.entries(campos).map(([k, v]) => `${k}=${encodeURIComponent(b64Wii.a(v))}`).join('&');
    const r = await http('POST /ac', cuerpo);
    return Object.fromEntries(r.cuerpo.trim().split('&').map(p => { const [k, v] = p.split('='); return [k, b64Wii.de(v)]; }));
  }
  // NAS → GPCM. → { r (la respuesta \lc\2…), prueba (la que debió mandar el servidor), con, l, enviar(pares) }
  async function entrar(datos) {
    const nasR = await nas(datos);
    const con = await pila.conectarTcp(wfcIp, 29900), l = lector(con);
    const hola = leerGs(await l.esperar(t => t.includes('\\final\\'), 3000));
    const reto = hola.datos.challenge, miReto = 'ABCDEFGHIJ', pw = md5(nasR.challenge), esp = ' '.repeat(48);
    l.vaciar();
    con.enviar(tx.encode(escribirGs([['login', ''], ['challenge', miReto], ['authtoken', nasR.token], ['partnerid', 11],
      ['response', md5(pw + esp + nasR.token + miReto + reto + pw)], ['gamename', 'mariokartwii'], ['sdkrevision', 3], ['namespaceid', 16], ['id', 1]])));
    const r = leerGs(await l.esperar(t => t.includes('\\final\\'), 3000));
    return { nas: nasR, r, prueba: md5(pw + esp + nasR.token + reto + miReto + pw), con, l, enviar: texto => con.enviar(tx.encode(texto)) };
  }
  return { http, nas, entrar };
}
