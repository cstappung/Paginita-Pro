/* Sopa de letras — el motor, puro: temas, fecha de Chile, generación y racha.
   Sin DOM ni almacenamiento, para que la sopa diaria se pueda comprobar desde
   Node (tests/sopa.test.cjs) y salga idéntica en todos los navegadores.
   UMD: `SopaMotor` en la página, `module.exports` en Node. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.SopaMotor = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Mayúsculas, sin tildes ni Ñ, y de cuatro letras o más: las de tres
     aparecen solas en el relleno al azar y una palabra encontrada «sin
     querer» en el ruido confunde más de lo que entretiene. La más larga
     cabe en 15×15. */
  const TEMAS = [
    { id: "electronica", nombre: "Electrónica", icono: "🔌", palabras: ["DIODO", "RESISTOR", "CAPACITOR", "TRANSISTOR", "BOBINA", "FUSIBLE", "MOSFET", "RELE", "INDUCTOR", "TRIAC", "TIRISTOR", "ZENER", "OSCILADOR", "CRISTAL", "POTENCIOMETRO", "TRANSFORMADOR", "SOLDADURA", "PROTOBOARD", "MULTIMETRO", "CIRCUITO"] },
    { id: "energia", nombre: "Energía", icono: "⚡", palabras: ["SOLAR", "EOLICA", "INVERSOR", "RECTIFICADOR", "BATERIA", "TURBINA", "GENERADOR", "HIDRAULICA", "GEOTERMICA", "BIOMASA", "CORRIENTE", "VOLTAJE", "POTENCIA", "MEDIDOR", "PANEL", "CARGADOR", "ALTERNADOR", "ACUMULADOR", "TENSION", "CENTRAL"] },
    { id: "animales", nombre: "Animales", icono: "🦊", palabras: ["PERRO", "GATO", "CABALLO", "ELEFANTE", "JIRAFA", "TIGRE", "LEON", "CONEJO", "TORTUGA", "DELFIN", "BALLENA", "AGUILA", "CONDOR", "PINGUINO", "CANGURO", "COCODRILO", "MURCIELAGO", "ARDILLA", "ZORRO", "HUEMUL"] },
    { id: "paises", nombre: "Países", icono: "🌎", palabras: ["CHILE", "PERU", "ARGENTINA", "BOLIVIA", "URUGUAY", "PARAGUAY", "BRASIL", "COLOMBIA", "ECUADOR", "VENEZUELA", "MEXICO", "CANADA", "FRANCIA", "ITALIA", "ALEMANIA", "JAPON", "CHINA", "INDIA", "EGIPTO", "AUSTRALIA"] },
    { id: "comidas", nombre: "Comidas", icono: "🍲", palabras: ["EMPANADA", "PASTEL", "CAZUELA", "SOPAIPILLA", "HUMITA", "ASADO", "PIZZA", "TALLARINES", "ARROZ", "ENSALADA", "HAMBURGUESA", "CHURRASCO", "POROTOS", "CURANTO", "CEVICHE", "TACO", "SUSHI", "QUESADILLA", "PANQUEQUE", "CHARQUICAN"] },
    { id: "espacio", nombre: "Espacio", icono: "🪐", palabras: ["PLANETA", "ESTRELLA", "GALAXIA", "COMETA", "ASTEROIDE", "NEBULOSA", "ORBITA", "SATELITE", "TELESCOPIO", "COHETE", "ASTRONAUTA", "LUNA", "SATURNO", "JUPITER", "MARTE", "VENUS", "MERCURIO", "NEPTUNO", "ECLIPSE", "METEORITO"] },
    { id: "deportes", nombre: "Deportes", icono: "⚽", palabras: ["FUTBOL", "TENIS", "BASQUETBOL", "VOLEIBOL", "NATACION", "ATLETISMO", "CICLISMO", "BOXEO", "RUGBY", "GOLF", "HOCKEY", "KARATE", "JUDO", "ESGRIMA", "REMO", "SURF", "BEISBOL", "HANDBOL", "GIMNASIA", "AJEDREZ"] }
  ];

  /* Tamaño → cuántas palabras lleva. La clasificación del modo libre usa
     esta misma cuenta como «puntos» fijos, y club-datos.js la comprueba. */
  const TAMANOS = { 8: 6, 12: 10, 15: 13 };
  /* [dx, dy] de cada dirección que la dificultad permite. */
  const DIRECCIONES = {
    facil: [[1, 0], [0, 1]],
    medio: [[1, 0], [0, 1], [1, 1], [1, -1]],
    dificil: [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]]
  };
  const DIFICULTADES = { facil: "Fácil", medio: "Medio", dificil: "Difícil" };
  const DIARIA = { tam: 12, dif: "medio" };
  const INTENTOS = 300;
  const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* FNV-1a de 32 bits: la semilla de una cadena, igual en todo navegador. */
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  const entero = (rng, n) => Math.floor(rng() * n);
  function baraja(lista, rng) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = entero(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- el día de Chile ----------
     Todos los jugadores cambian de sopa a la misma medianoche, la de
     Santiago, sin importar la hora de su equipo. «en-CA» escribe la fecha
     como AAAA-MM-DD, que es justo lo que se quiere comparar. */
  const FORMATO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
  function diaChile(ahora) {
    const p = {};
    for (const x of FORMATO.formatToParts(ahora == null ? new Date() : ahora)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }
  /* Número de día desde 1970 de una fecha AAAA-MM-DD (en UTC, solo para contar). */
  const numeroDia = f => Math.round(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 864e5);
  const deNumero = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const diaAnterior = f => deNumero(numeroDia(f) - 1);
  /* La temática rota con el número de día, así pasan todas en orden. */
  const temaDelDia = f => TEMAS[((numeroDia(f) % TEMAS.length) + TEMAS.length) % TEMAS.length];

  /* ---------- generación ---------- */

  /* Ninguna elegida puede estar dentro de otra (ni al revés): encontrar
     «MARTE» dentro de otra palabra marcaría la que no era. */
  const contiene = (a, b) => a.includes(b) || a.includes([...b].reverse().join(""));
  function compatible(w, elegidas) {
    return elegidas.every(e => !contiene(e, w) && !contiene(w, e));
  }

  /* Intenta colocar `w` en la grilla: hasta INTENTOS posiciones al azar,
     cruzándose solo con letras iguales. Devuelve las celdas o null. */
  function coloca(grilla, tam, w, dirs, rng) {
    for (let k = 0; k < INTENTOS; k++) {
      const [dx, dy] = dirs[entero(rng, dirs.length)];
      const x0 = entero(rng, tam), y0 = entero(rng, tam);
      const x1 = x0 + dx * (w.length - 1), y1 = y0 + dy * (w.length - 1);
      if (x1 < 0 || x1 >= tam || y1 < 0 || y1 >= tam) continue;
      const celdas = [];
      let ok = true;
      for (let i = 0; i < w.length && ok; i++) {
        const c = (y0 + dy * i) * tam + x0 + dx * i;
        if (grilla[c] && grilla[c] !== w[i]) ok = false; else celdas.push(c);
      }
      if (!ok) continue;
      celdas.forEach((c, i) => { grilla[c] = w[i]; });
      return celdas;
    }
    return null;
  }

  /* La sopa entera a partir de un generador. Las más largas van primero
     (son las que menos sitios tienen); si una no entra se prueba con la
     siguiente candidata del tema, y si el tema se queda sin palabras se
     vuelve a empezar con la misma secuencia del generador, así que la
     diaria sigue siendo la misma para todos. */
  function generar({ tema, tam, dif, rng }) {
    const n = TAMANOS[tam], dirs = DIRECCIONES[dif];
    if (!n || !dirs) throw new Error("Tamaño o dificultad desconocidos");
    const t = TEMAS.find(x => x.id === tema) || TEMAS[0];
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const candidatas = baraja(t.palabras.filter(w => w.length <= tam), rng);
      const elegidas = [];
      for (const w of candidatas) { if (elegidas.length < n && compatible(w, elegidas)) elegidas.push(w); }
      const reserva = candidatas.filter(w => !elegidas.includes(w));
      elegidas.sort((a, b) => b.length - a.length);
      const grilla = new Array(tam * tam).fill(""), puestas = [];
      for (const w of elegidas) {
        let celdas = coloca(grilla, tam, w, dirs, rng), cual = w;
        while (!celdas && reserva.length) {
          const otra = reserva.shift();
          if (!compatible(otra, puestas.map(p => p.palabra))) continue;
          celdas = coloca(grilla, tam, otra, dirs, rng); cual = otra;
        }
        if (!celdas) break;
        puestas.push({ palabra: cual, celdas });
      }
      if (puestas.length < n) continue;
      for (let i = 0; i < grilla.length; i++) if (!grilla[i]) grilla[i] = LETRAS[entero(rng, LETRAS.length)];
      puestas.sort((a, b) => a.palabra.localeCompare(b.palabra));
      return { tema: t.id, tam, dif, grilla, palabras: puestas };
    }
    throw new Error("No se pudo generar la sopa");
  }

  /* La del día: solo depende de la fecha. */
  function sopaDiaria(fecha) {
    const t = temaDelDia(fecha);
    return Object.assign(generar({ tema: t.id, tam: DIARIA.tam, dif: DIARIA.dif, rng: mulberry32(hash("sopa:" + fecha)) }), { fecha });
  }

  /* ---------- selección ----------
     Del punto de inicio al de llegada, en línea recta: si el arrastre no
     es exacto se lleva a la dirección (de las ocho) más cercana, con el
     largo del eje mayor y recortado al borde. Devuelve las celdas. */
  function linea(tam, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    if (!dx && !dy) return [y0 * tam + x0];
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7;
    const [ux, uy] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][ang];
    let largo = Math.max(Math.abs(dx), Math.abs(dy));
    const celdas = [];
    for (let i = 0; i <= largo; i++) {
      const x = x0 + ux * i, y = y0 + uy * i;
      if (x < 0 || y < 0 || x >= tam || y >= tam) break;
      celdas.push(y * tam + x);
    }
    return celdas;
  }
  /* Qué palabra pendiente forman esas celdas, leídas en cualquier sentido. */
  function palabraEn(sopa, celdas, encontradas) {
    if (celdas.length < 2) return -1;
    const txt = celdas.map(c => sopa.grilla[c]).join(""), rev = [...txt].reverse().join("");
    return sopa.palabras.findIndex((p, i) => !encontradas.has(i) && (p.palabra === txt || p.palabra === rev));
  }

  /* ---------- racha ----------
     Solo cuenta la diaria. `r` = {ult, racha, mejor}, con `ult` la fecha
     de la última diaria completada. */
  const rachaVacia = () => ({ ult: "", racha: 0, mejor: 0 });
  function limpiaRacha(r) {
    const ok = r && typeof r === "object" && /^\d{4}-\d{2}-\d{2}$/.test(r.ult || "");
    const n = x => (Number.isSafeInteger(x) && x > 0 ? x : 0);
    return ok ? { ult: r.ult, racha: n(r.racha), mejor: Math.max(n(r.mejor), n(r.racha)) } : rachaVacia();
  }
  /* Lo que se muestra hoy: si pasó más de un día sin completarla, 0. */
  function rachaVisible(r, hoy) {
    r = limpiaRacha(r);
    return r.ult === hoy || r.ult === diaAnterior(hoy) ? r.racha : 0;
  }
  /* Completar la diaria de `hoy`. Repetirla el mismo día no suma. */
  function registraDiaria(r, hoy) {
    r = limpiaRacha(r);
    if (r.ult === hoy) return r;
    const racha = r.ult === diaAnterior(hoy) ? r.racha + 1 : 1;
    return { ult: hoy, racha, mejor: Math.max(r.mejor, racha) };
  }
  /* Dos copias (este navegador y la cuenta): manda la que completó más
     tarde, y la mejor racha es la mayor de las dos. */
  function mezclaRacha(a, b) {
    a = limpiaRacha(a); b = limpiaRacha(b);
    const base = a.ult > b.ult || (a.ult === b.ult && a.racha >= b.racha) ? a : b;
    return { ult: base.ult, racha: base.racha, mejor: Math.max(a.mejor, b.mejor, base.racha) };
  }

  return {
    TEMAS, TAMANOS, DIRECCIONES, DIFICULTADES, DIARIA, INTENTOS,
    mulberry32, hash, diaChile, diaAnterior, numeroDia, temaDelDia,
    generar, sopaDiaria, linea, palabraEn,
    rachaVacia, limpiaRacha, rachaVisible, registraDiaria, mezclaRacha
  };
});
