// Archivos del disco con caché: lo que se baja una vez queda guardado en este navegador (Cache Storage).
//
// Resumen: el juego lee los archivos grandes del disco por pedazos (mkw.mjs → Module.mkwLeeRango). Antes cada
// lectura era un pedido HTTP Range a la red, y al volver a abrir la página se bajaba todo otra vez. Ahora, igual que
// BT3 en el sitio (su caché "bt3-disco:<tamaño>"):
//   - cada archivo se parte en BLOQUES fijos de 256 KB; una lectura pide los bloques que toca (no los bytes sueltos);
//   - cada bloque bajado se guarda en Cache Storage (una caché de archivos del navegador, en el disco, que sobrevive
//     a cerrar la página) y en la memoria (los últimos ~64 MB, para no ir ni a Cache Storage);
//   - si faltan varios bloques seguidos, se piden en UN solo pedido a la red (menos viajes);
//   - la caché lleva la VERSIÓN de los archivos (la da el servidor: cambia si cambia el disco o Retro Rewind); al
//     abrir con otra versión, las cachés viejas se borran solas.
// Los archivos chicos que se bajan enteros al principio también pasan por la caché (entero()).
//
// Bajar ANTES de que el juego pida (bitácora §52): el juego lee de a una lectura, esperando cada una; con la red del
// sitio (~50 ms por pedido) 40 lecturas seguidas son 2 s. Dos formas de adelantarse, las dos en segundo plano (como
// mucho 12 pedidos a la vez: en el sitio la red es HTTP/2 y van todos por una conexión) y sin bajar dos veces lo mismo (una lectura del juego que llega mientras su bloque se
// está adelantando espera ese mismo pedido):
//   - adelantar(url, tam): el juego avisa que encontró un archivo en el índice del disco (rutas_nativo.cpp) y casi
//     siempre lo lee enseguida: se baja entero (hasta 4 MB; de los grandes, el primer MB);
//   - lectura seguida: si el juego lee un archivo en orden (videos THP, música, voces), se bajan los bloques que
//     siguen antes de que los pida: 1, 2, 4… hasta 8 bloques (2 MB) por delante mientras siga en orden;
//   - grupos (agrupar(url, rangos)): un archivo partido en pedazos que se leen enteros (los ~490 grupos del archivo
//     de sonido, brsar.mjs): apenas el juego lee dentro de uno, se baja el resto de ese grupo de una vez;
//   - prioridad baja (adelantar(url, tam, { baja: true })): una fila aparte, como mucho 4 a la vez, solo cuando la
//     fila normal está vacía, de a uno cada 40 ms, y nunca mientras el juego está cargando (si una lectura del juego
//     tuvo que esperar a la red en los últimos 300 ms, la fila baja espera: no le quita conexiones a una carga). La usa mkw.mjs para traer todos los archivos diminutos (≤ 8 KB) con el título en
//     pantalla: el juego los lee de a uno (los 64 fantasmas del Contrarreloj, uno por cuadro).
//
// En el sitio, lo mismo sirve con el Worker + R2 (R2 acepta pedidos Range); el Worker debe responder "no-store"
// para que el navegador no lo guarde dos veces (como BT3).
//
// Uso:  const d = crearDisco({ version });  await d.abrir();
//       await d.leer(url, tamañoDelArchivo, inicio, largo)  → Uint8Array      await d.entero(url) → Uint8Array
//       d.adelantar(url, tamañoDelArchivo)  → lo baja en segundo plano (no espera nada)
//       d.estado (pedidos a la red, bytes, aciertos), await d.ocupado() (bytes guardados), await d.borrar()

export const PREFIJO = 'mkw-disco:';

export function crearDisco({ version, bloque = 256 * 1024, memoriaMax = 64 * 1024 * 1024, buscar = (u, o) => fetch(u, o),
                             cajas = globalThis.caches, adelantarActivo = true, maxFondo = 12,
                             avisoMax = 4 * 1024 * 1024, avisoGrande = 1024 * 1024, rachaMax = 8, maxBaja = 4,
                             grupoMax = 8 * 1024 * 1024, pausaBaja = 40, quietud = 300 } = {}) {
  const estado = { pedidosRed: 0, bytesRed: 0, bloquesCache: 0, bloquesMemoria: 0, lecturas: 0, sinCache: false,
                   // adelantados: bloques traídos en segundo plano; aprovechados: bloques que el juego leyó y ya
                   // estaban (o venían en camino) gracias a eso; esperaRed: lecturas del juego que tuvieron que pedir
                   adelantados: 0, aprovechados: 0, esperaRed: 0, avisos: 0 };
  const memoria = new Map();            // clave → Uint8Array (el orden del Map = del más viejo al más nuevo)
  let enMemoria = 0, caja = null;
  const enCurso = new Map();            // clave → promesa (dos lecturas del mismo bloque a la vez piden una sola vez)
  const guardando = new Map();          // clave → promesa de Cache Storage todavía escribiéndose
  const deFondo = new Set();            // claves traídas (o en camino) en segundo plano y todavía no leídas
  const cola = [], colaBaja = [];       // trabajos de segundo plano esperando turno (normal y de prioridad baja)
  let activos = 0, activosBaja = 0, ultimoBaja = -Infinity, relojBaja = null, ultimaEspera = -Infinity;
  const racha = new Map();              // url → { fin, n }: dónde terminó la última lectura y cuántas seguidas van
  const grupos = new Map();             // url → rangos [inicio, fin) ordenados (agrupar)
  const clave = (url, b) => new URL(`${url}${url.includes('?') ? '&' : '?'}bloque=${b}&v=${encodeURIComponent(version)}`, location.href).href;

  async function abrir() {
    if (!cajas) { estado.sinCache = true; return; }   // sin Cache Storage (p. ej. página no segura): solo memoria
    try {
      for (const n of await cajas.keys()) if (n.startsWith(PREFIJO) && n !== PREFIJO + version) await cajas.delete(n);
      caja = await cajas.open(PREFIJO + version);
    } catch { estado.sinCache = true; }
  }

  function aMemoria(k, datos) {
    if (memoria.has(k)) { memoria.delete(k); enMemoria -= datos.length; }
    memoria.set(k, datos); enMemoria += datos.length;
    for (const [viejo, d] of memoria) { if (enMemoria <= memoriaMax) break; memoria.delete(viejo); enMemoria -= d.length; }
  }
  function deMemoria(k) {
    const d = memoria.get(k);
    if (d) { memoria.delete(k); memoria.set(k, d); }   // "recién usado": pasa al final
    return d;
  }

  // Bajar de la red los bloques [b0..b1] de un archivo en un solo pedido y repartirlos
  async function bajar(url, tam, b0, b1, aLaMemoria = true) {
    const ini = b0 * bloque, fin = Math.min((b1 + 1) * bloque, tam) - 1;
    // cache: 'no-store' = sin pasar por la caché HTTP de Chrome: además de no guardar dos veces, esa caché pone en FILA
    // los pedidos al mismo archivo (aunque pidan pedazos distintos), y el adelanto de un video quedaba de a uno (§52)
    const r = await buscar(url, { headers: { Range: `bytes=${ini}-${fin}` }, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} al leer ${url}`);
    const todo = new Uint8Array(await r.arrayBuffer());
    if (r.status !== 206 && todo.length !== fin - ini + 1) throw new Error(`el servidor no respetó el pedido de ${url}`);
    estado.pedidosRed++; estado.bytesRed += todo.length;
    const salida = [];
    for (let b = b0; b <= b1; b++) {
      // un solo bloque: el mismo búfer, sin copiar (menos basura para el recolector de memoria del navegador)
      const datos = b0 === b1 ? todo : todo.slice((b - b0) * bloque, Math.min((b - b0 + 1) * bloque, todo.length));
      const k = clave(url, b);
      if (aLaMemoria) aMemoria(k, datos);         // lo de prioridad baja solo a Cache Storage (no desplaza lo reciente)
      if (caja) {                                    // sin esperar: guardar no frena al juego
        const p = caja.put(k, new Response(datos)).catch(() => {}).finally(() => guardando.delete(k));
        guardando.set(k, p);
      }
      salida.push(datos);
    }
    return salida;
  }

  // Un bloque de Cache Storage (si se está terminando de guardar, se espera a que termine) o null
  async function deCaja(k) {
    if (!caja) return null;
    if (guardando.has(k)) await guardando.get(k);
    const r = await caja.match(k);
    if (!r) return null;
    const d = new Uint8Array(await r.arrayBuffer());
    estado.bloquesCache++;
    aMemoria(k, d);
    return d;
  }

  // Hacerse cargo de bloques que no están en memoria ni en camino: primero Cache Storage, lo que falte de la red en
  // tramos seguidos (un pedido por tramo). Cada bloque queda en enCurso mientras tanto, para que otra lectura del
  // mismo bloque espere este pedido en vez de hacer otro. Devuelve la promesa de un Map bloque → datos.
  function encargar(url, tam, bloques, alTerminar, aLaMemoria = true) {
    const trabajo = (async () => {
      const res = new Map();
      await Promise.all(bloques.map(async b => { const d = await deCaja(clave(url, b)); if (d) res.set(b, d); }));
      const faltan = bloques.filter(b => !res.has(b));
      for (let a = 0; a < faltan.length;) {
        let z = a;
        while (z + 1 < faltan.length && faltan[z + 1] === faltan[z] + 1) z++;
        const lista = await bajar(url, tam, faltan[a], faltan[z], aLaMemoria);
        for (let x = a; x <= z; x++) res.set(faltan[x], lista[x - a]);
        a = z + 1;
      }
      return res;
    })();
    const propias = bloques.map(b => [clave(url, b), trabajo.then(r => r.get(b))]);
    // si la red falla, estas promesas quedan rechazadas aunque nadie más las espere: marcarlas como "atendidas"
    // para que el navegador no avise "error sin atender" (quien sí las espera recibe el error igual)
    for (const [, p] of propias) p.catch(() => {});
    for (const [c, p] of propias) enCurso.set(c, p);
    const limpiar = () => { for (const [c, p] of propias) if (enCurso.get(c) === p) enCurso.delete(c); if (alTerminar) alTerminar(); };
    trabajo.then(limpiar, limpiar);
    return trabajo;
  }

  // ¿Hay que traer el bloque b? (ni en memoria ni en camino)
  const falta = (url, b) => { const k = clave(url, b); return !memoria.has(k) && !enCurso.has(k); };

  // Segundo plano: como mucho maxFondo trabajos a la vez; el resto espera su turno en la cola
  function aFondo(url, tam, b0, b1, baja = false) {
    const lista = [];
    for (let b = b0; b <= b1; b++) if (falta(url, b)) lista.push(b);
    if (!lista.length) return;
    for (const b of lista) deFondo.add(clave(url, b));
    (baja ? colaBaja : cola).push({ url, tam, lista, baja });
    siguienteFondo();
  }
  function siguienteFondo() {
    // primero la fila normal; la baja solo si la normal está vacía, con su propio tope y su ritmo
    while (activos < maxFondo && (cola.length || (colaBaja.length && activosBaja < maxBaja))) {
      if (!cola.length) {
        const espera = Math.max(ultimoBaja + pausaBaja, ultimaEspera + quietud) - performance.now();
        if (espera > 0) { if (!relojBaja) relojBaja = setTimeout(() => { relojBaja = null; siguienteFondo(); }, espera); return; }
        ultimoBaja = performance.now();
      }
      const { url, tam, lista, baja } = cola.length ? cola.shift() : colaBaja.shift();
      const ahora = lista.filter(b => falta(url, b));    // lo que el juego no pidió mientras esperaba turno
      if (!ahora.length) continue;
      activos++; if (baja) activosBaja++;
      encargar(url, tam, ahora, () => { activos--; if (baja) activosBaja--; siguienteFondo(); }, !baja)
        .then(res => { estado.adelantados += res.size; }, () => { for (const b of ahora) deFondo.delete(clave(url, b)); });
    }
  }

  // El juego avisa que va a leer este archivo: bajarlo entero (de los grandes, solo el principio)
  function adelantar(url, tam, { baja = false } = {}) {
    if (!adelantarActivo || !(tam > 0)) return;
    if (!baja) estado.avisos++;
    const hasta = tam <= avisoMax ? tam : Math.min(tam, avisoGrande);
    aFondo(url, tam, 0, Math.floor((hasta - 1) / bloque), baja);
  }

  // Bloques sueltos con prioridad baja (la semilla de bloques de mkw.mjs)
  function adelantarBloques(url, tam, b0, b1) { if (adelantarActivo) aFondo(url, tam, b0, b1, true); }

  // Los grupos de un archivo: rangos [inicio, fin) que el juego lee enteros (brsar.mjs)
  function agrupar(url, rangos) { if (rangos && rangos.length) grupos.set(url, rangos); }
  function grupoDe(rangos, x) {                 // búsqueda binaria: el último que empieza en x o antes
    let a = 0, z = rangos.length - 1, r = null;
    while (a <= z) { const m = (a + z) >> 1; if (rangos[m][0] <= x) { r = rangos[m]; a = m + 1; } else z = m - 1; }
    return r && x < r[1] ? r : null;
  }

  async function leer(url, tam, inicio, largo) {
    estado.lecturas++;
    const fin = Math.min(inicio + largo, tam);
    if (inicio >= fin) return new Uint8Array(0);
    const b0 = Math.floor(inicio / bloque), b1 = Math.floor((fin - 1) / bloque);
    const n = b1 - b0 + 1, k = i => clave(url, b0 + i);
    const bloques = Array.from({ length: n }, () => null);
    // 1) Sin esperar nada (para que dos lecturas a la vez no decidan las dos "lo bajo yo"): lo que está en memoria,
    //    lo que otra lectura (o el segundo plano) ya está trayendo, y el resto queda a cargo de esta lectura
    const mios = [];
    for (let i = 0; i < n; i++) {
      const m = deMemoria(k(i));
      if (m) { bloques[i] = m; estado.bloquesMemoria++; }
      else if (enCurso.has(k(i))) bloques[i] = enCurso.get(k(i));      // una promesa: se espera abajo
      else mios.push(i);
      if (deFondo.delete(k(i)) && bloques[i]) estado.aprovechados++;
    }
    // 2) Lectura seguida: adelantar los bloques que vienen (más cuanto más larga la racha: 1, 2, 4, 8)
    if (adelantarActivo) {
      const r = racha.get(url);
      const seguida = r && inicio >= r.fin - bloque && inicio <= r.fin + bloque;
      const nr = seguida ? Math.min(r.n + 1, 30) : 0;
      racha.delete(url); racha.set(url, { fin, n: nr });
      if (racha.size > 64) racha.delete(racha.keys().next().value);
      const ultimo = Math.floor((tam - 1) / bloque);
      // (en un archivo con grupos no: el grupo ya marca hasta dónde se va a leer, y seguir de largo bajaría el siguiente)
      if (nr > 0 && b1 < ultimo && !grupos.has(url)) aFondo(url, tam, b1 + 1, Math.min(ultimo, b1 + Math.min(2 ** (nr - 1), rachaMax)));
      // 2b) dentro de un grupo: el resto del grupo, de una vez (sin tocar los bloques que esta lectura pide ella misma)
      const g = grupos.has(url) && grupoDe(grupos.get(url), inicio);
      if (g && g[1] - g[0] <= grupoMax) {
        const g0 = Math.floor(g[0] / bloque), g1 = Math.floor((Math.min(g[1], tam) - 1) / bloque);
        if (g0 < b0) aFondo(url, tam, g0, b0 - 1);
        if (g1 > b1) aFondo(url, tam, b1 + 1, g1);
      }
    }
    if (mios.length) {
      estado.esperaRed++;
      ultimaEspera = performance.now();      // el juego está cargando: la fila baja se aparta un rato
      const res = await encargar(url, tam, mios.map(i => b0 + i));
      for (const i of mios) bloques[i] = res.get(b0 + i);
    }
    if (bloques.some(x => x instanceof Promise)) ultimaEspera = performance.now();   // esperó algo en camino
    for (let i = 0; i < n; i++) if (bloques[i] instanceof Promise) bloques[i] = await bloques[i];
    // 3) recortar justo los bytes pedidos
    const salida = new Uint8Array(fin - inicio);
    let p = 0;
    for (let i = 0; i < bloques.length; i++) {
      const base = (b0 + i) * bloque;
      const desde = Math.max(inicio, base) - base, hasta = Math.min(fin, base + bloques[i].length) - base;
      salida.set(bloques[i].subarray(desde, hasta), p);
      p += hasta - desde;
    }
    return salida;
  }

  // Un archivo chico entero (los que se bajan al principio)
  async function entero(url) {
    const k = new URL(`${url}${url.includes('?') ? '&' : '?'}entero=1&v=${encodeURIComponent(version)}`, location.href).href;
    if (caja) {
      const r = await caja.match(k);
      if (r) { estado.bloquesCache++; return new Uint8Array(await r.arrayBuffer()); }
    }
    const r = await buscar(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} al bajar ${url}`);
    const datos = new Uint8Array(await r.arrayBuffer());
    estado.pedidosRed++; estado.bytesRed += datos.length;
    if (caja) await caja.put(k, new Response(datos)).catch(() => {});
    return datos;
  }

  // Cuánto ocupa lo guardado (estimación del navegador para todo el sitio) y borrar la caché del disco
  async function ocupado() {
    try { const e = await navigator.storage.estimate(); return e.usageDetails?.caches ?? e.usage ?? 0; } catch { return 0; }
  }
  async function borrar() {
    memoria.clear(); enMemoria = 0;
    if (!cajas) return;
    for (const n of await cajas.keys()) if (n.startsWith(PREFIJO)) await cajas.delete(n);
    caja = null;
  }

  return { estado, abrir, leer, adelantar, adelantarBloques, agrupar, entero, ocupado, borrar, bloque };
}
