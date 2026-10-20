// La lista de pistas del selector («modo lista»): las pistas de una copa o de una playlist, con presets guardados,
// un borrador que sobrevive a recargar la página y sonido al agregar y al quitar — bitácora §74.
//
// Resumen: el dueño pidió que armar la copa de la sala sea una LISTA (no 4 casillas fijas): agregar todas las pistas
// que uno quiera (hasta 32, el tope de una copa de VS del juego), quitar, reordenar, guardar listas con nombre para
// usarlas otra vez y oír un sonido al agregar o quitar una pista. Este módulo es solo la lógica (sin dibujar nada), así
// se prueba en el banco sin el juego; interfaz.mjs la dibuja.
//   - crearLista: las pistas en orden ({copa, fila}); alternar(p) agrega la pista si no está y la quita si está (un
//     clic en la lista de copas); mover, quitar, vaciar, llenar al azar con semilla (sin repetir); avisa cada cambio.
//     Si se le da una clave, guarda un borrador en el navegador (localStorage): al volver a abrir, la lista sigue ahí.
//   - crearPresets: listas guardadas con nombre (localStorage "mkw.listas"): guardar (el mismo nombre reemplaza),
//     cargar, borrar; hasta 30.
//   - crearSonidosLista: sonidos cortos hechos con WebAudio (no son del juego): uno que sube al agregar, uno que
//     baja al quitar, uno sordo si la lista ya está llena y un «ding» cuando llega una sugerencia (playlist de la
//     sala). Respetan el volumen y el silencio de la página.
// Como un tablero de enchufes con tapa: cada pista se enchufa o desenchufa con un clic, y el tablero tiene un número
// fijo de tomas (32).
//
// Uso:  const l = crearLista({ max: 32, clave: 'mkw.lista.sala' });  l.alternar({copa: 3, fila: 1}) → 'agregada' | 'quitada' | 'llena'
//       l.alCambiar(pistas => …);  l.pistas (copia);  l.llenar(todas, 4, semilla)
//       const p = crearPresets();  p.guardar('Mis retro', l.pistas);  p.listar();  p.cargar('Mis retro')
//       const s = crearSonidosLista({ contexto: () => sonido.contexto, volumen: () => 0.7, silencio: () => false });  s.agregar()

export const MAX_PISTAS = 32;          // una copa de VS del juego llega hasta 32 carreras
const MAX_PRESETS = 30;

const leer = (almacen, clave, porDefecto) => { try { const v = almacen?.getItem(clave); return v == null ? porDefecto : JSON.parse(v); } catch { return porDefecto; } };
const escribir = (almacen, clave, valor) => { try { almacen?.setItem(clave, JSON.stringify(valor)); } catch {} };
const almacenDe = () => { try { return globalThis.localStorage || null; } catch { return null; } };
// una pista válida: copa 0..99, fila 0..3 (enteros)
const pistaValida = p => p && Number.isInteger(p.copa) && Number.isInteger(p.fila) && p.copa >= 0 && p.copa < 100 && p.fila >= 0 && p.fila < 4;
export const misma = (a, b) => !!a && !!b && a.copa === b.copa && a.fila === b.fila;
const limpia = (lista, max) => {
  const fuera = [];
  for (const p of Array.isArray(lista) ? lista : []) if (pistaValida(p) && !fuera.some(q => misma(p, q)) && fuera.length < max) fuera.push({ copa: p.copa, fila: p.fila });
  return fuera;
};

// Sorteos con semilla (mulberry32): la misma semilla da siempre las mismas pistas
export function azar(semilla) {
  let t = semilla >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

export function crearLista({ pistas = [], max = MAX_PISTAS, clave = '', almacen = almacenDe() } = {}) {
  max = Math.max(1, Math.min(MAX_PISTAS, max | 0 || MAX_PISTAS));
  // el borrador guardado manda sobre la lista inicial solo si la inicial viene vacía (la sala puede traer una armada)
  let lista = limpia(pistas, max);
  if (!lista.length && clave) lista = limpia(leer(almacen, clave, []), max);
  const oyentes = new Set();
  const cambio = () => { if (clave) escribir(almacen, clave, lista); for (const f of oyentes) f(lista.map(p => ({ ...p }))); };
  const indice = p => lista.findIndex(q => misma(p, q));

  return {
    get pistas() { return lista.map(p => ({ ...p })); },
    get max() { return max; },
    get llena() { return lista.length >= max; },
    tiene: p => indice(p) >= 0,
    posicion: p => indice(p),                 // 0.. o -1
    alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
    // un clic en una pista de las copas: si no está, va al final; si está, sale
    alternar(p) {
      if (!pistaValida(p)) return 'nada';
      const i = indice(p);
      if (i >= 0) { lista.splice(i, 1); cambio(); return 'quitada'; }
      if (lista.length >= max) return 'llena';
      lista.push({ copa: p.copa, fila: p.fila }); cambio(); return 'agregada';
    },
    agregar(p) { if (!pistaValida(p) || indice(p) >= 0) return 'nada'; if (lista.length >= max) return 'llena'; lista.push({ copa: p.copa, fila: p.fila }); cambio(); return 'agregada'; },
    quitar(i) { if (i < 0 || i >= lista.length) return false; lista.splice(i, 1); cambio(); return true; },
    mover(i, d) {                             // d = -1 sube, +1 baja
      const j = i + d;
      if (i < 0 || j < 0 || i >= lista.length || j >= lista.length) return false;
      [lista[i], lista[j]] = [lista[j], lista[i]]; cambio(); return true;
    },
    vaciar() { if (!lista.length) return false; lista = []; cambio(); return true; },
    poner(nueva) { lista = limpia(nueva, max); cambio(); return lista.length; },
    // llenar al azar hasta n pistas (sin repetir las que ya están), con esa semilla: devuelve cuántas agregó
    llenar(todas, n, semilla) {
      const r = azar(semilla), tope = Math.min(max, n | 0);
      let agregadas = 0;
      while (lista.length < tope) {
        const libres = todas.filter(p => indice(p) < 0);
        if (!libres.length) break;
        lista.push({ ...libres[Math.floor(r() * libres.length)] }); agregadas++;
      }
      if (agregadas) cambio();
      return agregadas;
    },
  };
}

// Las listas guardadas con nombre: [{ nombre, pistas, cuando }], la más nueva primero
export function crearPresets({ clave = 'mkw.listas', almacen = almacenDe(), ahora = () => Date.now() } = {}) {
  const todos = () => (leer(almacen, clave, []) || []).filter(x => x && typeof x.nombre === 'string' && Array.isArray(x.pistas));
  return {
    listar: () => todos().map(x => ({ nombre: x.nombre, pistas: limpia(x.pistas, MAX_PISTAS), cuando: x.cuando || 0 })),
    guardar(nombre, pistas) {
      nombre = String(nombre || '').trim().slice(0, 40);
      const p = limpia(pistas, MAX_PISTAS);
      if (!nombre || !p.length) return false;
      const resto = todos().filter(x => x.nombre.toLowerCase() !== nombre.toLowerCase());
      escribir(almacen, clave, [{ nombre, pistas: p, cuando: ahora() }, ...resto].slice(0, MAX_PRESETS));
      return true;
    },
    cargar: nombre => { const x = todos().find(x => x.nombre === nombre); return x ? limpia(x.pistas, MAX_PISTAS) : null; },
    borrar(nombre) { const antes = todos(); const resto = antes.filter(x => x.nombre !== nombre); escribir(almacen, clave, resto); return resto.length < antes.length; },
  };
}

// Los sonidos: un tono corto con su "envolvente" (sube rápido y se apaga), como el clic de un relé pero con nota.
// contexto(): el AudioContext de la página (el del juego, que ya pasa por el volumen de sonido.mjs) o null (entonces se
// crea uno propio, que respeta volumen() y silencio()).
export function crearSonidosLista({ contexto = () => null, volumen = () => 0.7, silencio = () => false } = {}) {
  let propio = null;
  const elContexto = () => {
    const c = contexto();
    if (c) return { c, salida: c.destination, nivel: 1 };          // el del juego: el volumen ya lo pone sonido.mjs
    try { propio ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch { return null; }
    return { c: propio, salida: propio.destination, nivel: silencio() ? 0 : volumen() };
  };
  const contados = { agregar: 0, quitar: 0, llena: 0, sugerencia: 0 };   // para las pruebas
  function tono(notas, { tipo = 'triangle', dur = 0.09, fuerza = 0.18 } = {}) {
    const x = elContexto();
    if (!x || x.nivel <= 0) return;
    const { c } = x;
    if (c.state === 'suspended') c.resume?.().catch(() => {});
    const t0 = c.currentTime + 0.005;
    notas.forEach((f, k) => {
      const o = c.createOscillator(), g = c.createGain(), t = t0 + k * dur * 0.75;
      o.type = tipo; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(fuerza * x.nivel, t + 0.008);   // ataque de 8 ms (sin chasquido)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);              // y se apaga
      o.connect(g).connect(x.salida);
      o.start(t); o.stop(t + dur + 0.02);
    });
  }
  return {
    contados,
    agregar() { contados.agregar++; tono([660, 990]); },                    // sube (mi → si): "entró"
    quitar() { contados.quitar++; tono([620, 410], { tipo: 'sine' }); },      // baja: "salió"
    llena() { contados.llena++; tono([180], { tipo: 'square', dur: 0.12, fuerza: 0.08 }); },   // sordo: "no cabe"
    sugerencia() { contados.sugerencia++; tono([880, 1320], { tipo: 'sine', dur: 0.07, fuerza: 0.14 }); },   // «ding»: llegó una sugerencia
  };
}
