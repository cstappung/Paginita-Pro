// Muchos pedazos del disco en UNA llamada al Worker — bitácora §104.
//
// Resumen: el plan gratis de Cloudflare Workers da 100.000 llamadas al día, y antes una primera visita gastaba ~1.400:
// la mitad eran «preguntas previas» de CORS (el navegador pregunta antes de cada pedido con el token; con
// `cache: 'no-store'` no guarda la respuesta y vuelve a preguntar cada vez) y la otra mitad, pedazos de 256 KB de a uno.
// Este módulo junta los pedazos que se piden más o menos a la vez en un solo POST a una sola dirección (`<origen>/lote`):
//   - una sola dirección y POST = UNA pregunta previa cada 2 horas (Chrome la guarda ese rato), no una por pedazo;
//   - el cuerpo del pedido dice qué trozos quiere: {"p": [[ruta, inicio, fin], …]} (fin incluido, como en Range);
//   - la respuesta trae los trozos pegados en ese orden, sin separadores: la página ya sabe cuánto mide cada uno, y cada
//     trozo se entrega APENAS termina de llegar (el primero no espera a los demás);
//   - lo urgente (el juego esperando una lectura) va primero y sale en seguida; lo demás espera unos milisegundos
//     (`ventana`) para juntarse con otros; si todas las llamadas están ocupadas, lo que llega se va juntando y sale
//     junto en la siguiente: con más carga, lotes más grandes (menos llamadas), sin hacer esperar al juego;
//   - como mucho `maxPiezas` trozos y `maxBytes` por lote: el Worker gratis puede hacer 50 operaciones de R2 y de la
//     caché de Cloudflare por llamada, y cada trozo gasta hasta 3 (mirar la caché, leer R2, guardar en la caché);
//   - la primera llamada sale sola: así las demás encuentran la pregunta previa ya contestada (si salen todas a la vez,
//     el navegador pregunta por cada una);
//   - si el Worker no conoce /lote (uno viejo: 404/405/400), se apaga y quien pidió vuelve a pedir de a uno (Range);
//     un Worker viejo tampoco permite POST en la pregunta previa, y eso el navegador lo da como error de red: si las 2
//     primeras llamadas fallan así (sin que ninguna haya andado), también se apaga. Si un lote se corta a medias, los
//     trozos que faltaban fallan y quien pidió los vuelve a pedir de a uno.
// Es como juntar las cartas de toda una oficina en un solo envío certificado al día, en vez de un viaje por carta.
//
// Uso:  const l = crearLotes({ url: ORIGEN + '/lote', base: ORIGEN + '/' });
//       l.sirve(url) → ¿esa dirección puede ir por lote?      await l.pedir(url, inicio, fin, urgente) → Uint8Array
//       l.estado: { lotes, piezas, bytes, urgentes, fallidos, apagado }

export const SIN_LOTE = 'sin-lote';                 // el error de un trozo que hay que volver a pedir de a uno
export const MAX_TROZO = 32 * 1024 * 1024;          // un trozo más grande va de a uno (el Worker acepta hasta esto)

export function crearLotes({ url, base, buscar = (u, o) => fetch(u, o), maxPiezas = 12, maxBytes = 16 * 1024 * 1024,
                             maxVuelo = 4, extraUrgente = 2, ventana = 8, registro = () => {} } = {}) {
  // (historia: los últimos 3000 pedazos, [ms, n.º de lote, ruta, bytes, urgente], para medir qué se pide y cuándo)
  const estado = { lotes: 0, piezas: 0, bytes: 0, urgentes: 0, fallidos: 0, apagado: false, mayor: 0, historia: [] };
  const urgentes = [], normales = [];             // trozos esperando turno: { ruta, inicio, fin, largo, listo, error }
  let vuelo = 0, calentado = false, reloj = null, anduvo = false, sinRed = 0;

  const sirve = u => !estado.apagado && typeof u === 'string' && u.startsWith(base);

  function pedir(u, inicio, fin, urgente = false) {
    if (!sirve(u) || !(fin >= inicio) || fin - inicio + 1 > MAX_TROZO) return Promise.reject(new Error(SIN_LOTE));
    return new Promise((listo, error) => {
      // (la ruta va sin codificar, como la leería el Worker de una dirección: «Mi Pista.szs», no «Mi%20Pista.szs»)
      let ruta;
      try { ruta = decodeURIComponent(u.slice(base.length).split('?')[0]); } catch { error(new Error(SIN_LOTE)); return; }
      const t = { ruta, inicio, fin, largo: fin - inicio + 1, listo, error, urgente };
      (urgente ? urgentes : normales).push(t);
      if (urgente) { estado.urgentes++; queueMicrotask(enviar); }
      else if (!reloj) reloj = setTimeout(() => { reloj = null; enviar(); }, ventana);
    });
  }

  // Sacar de las filas un lote: lo urgente primero, después lo demás en el orden en que llegó
  function armar() {
    const lote = [];
    let bytes = 0;
    for (const fila of [urgentes, normales]) {
      while (fila.length && lote.length < maxPiezas && (lote.length === 0 || bytes + fila[0].largo <= maxBytes)) {
        const t = fila.shift(); lote.push(t); bytes += t.largo;
      }
    }
    return lote;
  }

  function enviar() {
    while (urgentes.length || normales.length) {
      if (!calentado && vuelo > 0) return;                       // la primera, sola (la pregunta previa)
      const tope = maxVuelo + (urgentes.length ? extraUrgente : 0);
      if (vuelo >= tope) return;                                 // todas ocupadas: se sigue juntando
      if (!urgentes.length && reloj) return;                     // lo normal todavía junta (salvo que haya urgente)
      const lote = armar();
      if (!lote.length) return;
      vuelo++;
      mandar(lote).finally(() => { vuelo--; enviar(); });
    }
  }

  // Si el lote no llega (o llega cortado), los trozos que faltaban fallan con SIN_LOTE: quien pidió los pide de a uno
  async function mandar(lote) {
    estado.lotes++; estado.piezas += lote.length;
    const total = lote.reduce((s, t) => s + t.largo, 0);
    estado.mayor = Math.max(estado.mayor, lote.length);
    const ahora = Math.round(performance.now());
    for (const t of lote) { estado.historia.push([ahora, estado.lotes, t.ruta, t.largo, t.urgente ? 1 : 0]); }
    if (estado.historia.length > 3000) estado.historia.splice(0, estado.historia.length - 3000);
    let i = 0;
    try {
      let r;
      try { r = await buscar(url, { method: 'POST', body: JSON.stringify({ p: lote.map(t => [t.ruta, t.inicio, t.fin]) }) }); }
      catch (e) {
        if (!anduvo && ++sinRed >= 2 && !estado.apagado) { estado.apagado = true; registro('[lote] /lote no responde (¿un Worker viejo sin POST?): de a uno, como antes'); }
        throw e;
      }
      calentado = true;
      if (!r.ok) {
        if ([400, 404, 405].includes(r.status) && !estado.apagado) { estado.apagado = true; registro(`[lote] el Worker no conoce /lote (${r.status}): de a uno, como antes`); }
        throw new Error(`lote: ${r.status}`);
      }
      // los trozos, uno detrás del otro: se llena el que va y se entrega apenas está completo
      const lector = r.body.getReader();
      let trozo = null, desde = 0, buf = null, lleno = 0;
      while (i < lote.length) {
        if (!trozo || desde >= trozo.length) {
          const { value, done } = await lector.read();
          if (done) throw new Error(`lote cortado: llegaron ${i} de ${lote.length} trozos`);
          trozo = value; desde = 0; continue;
        }
        const t = lote[i];
        if (!buf) {
          // el trozo entero cabe en lo que llegó: sin copiar
          if (trozo.length - desde >= t.largo) { t.listo(trozo.subarray(desde, desde + t.largo)); desde += t.largo; i++; continue; }
          buf = new Uint8Array(t.largo); lleno = 0;
        }
        const n = Math.min(t.largo - lleno, trozo.length - desde);
        buf.set(trozo.subarray(desde, desde + n), lleno); lleno += n; desde += n;
        if (lleno === t.largo) { t.listo(buf); buf = null; i++; }
      }
      estado.bytes += total; anduvo = true;
      lector.cancel().catch(() => {});
    } catch (e) {
      calentado = true;
      estado.fallidos += lote.length - i;
      for (; i < lote.length; i++) lote[i].error(new Error(SIN_LOTE + ': ' + (e?.message || e)));
    }
  }

  return { estado, sirve, pedir };
}
