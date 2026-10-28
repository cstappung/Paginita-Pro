/* PRODROP — los desafíos de plantilla, compartido.
   Lo usan el abridor (la pantalla de desafíos), el cartero de Juegos (que
   comprueba antes de escribir) y la economía (que paga los premios). Por
   eso es UMD, puro y sin DOM, como el motor, del que sale todo lo de cada
   carta: media, rareza, posiciones, club y país.

   Una plantilla es un once en el 4-3-3 del motor (`FORMACION`) que cumple
   una condición: la mejor plantilla (`mejor`, sin condición), una por club
   en el álbum (`club-<club>`) y un reto cada semana (`reto-<id>-<semana>`). Se sube a una clasificación por
   plantilla y paga tres premios, una vez cada uno:
     1. completa y válida: 50 monedas y un sobre de fútbol;
     2. además las once graduadas con nota 6 o más: 100 y dos sobres de fútbol;
     3. además las once graduadas con nota 8 o más: 250 y un sobre Plus.

   El puntaje: cada carta vale (media − castigo de posición) × estado, con
   estado = 0,80 + 0,02 × nota si está graduada y 0,80 si no (la nota
   oculta no se filtra ni se premia). La plantilla es la suma de las once
   × 10, redondeada: un punto de media son 10 puntos, así que el Mbappé del
   Clásico (92) le gana al de siempre (91) con la misma nota. */
(function (raiz, fabrica) {
  const M = typeof module === "object" && module.exports ? require("./motor.js") : raiz.ProdropMotor;
  const R = fabrica(M);
  if (typeof module === "object" && module.exports) module.exports = R;
  else raiz.ProdropRetos = R;
})(typeof globalThis !== "undefined" ? globalThis : this, function (M) {
  "use strict";

  /* ---------- las plantillas ----------
     Una por club con plantel (≥15 cartas). */
  const FUT = M.CARDS.filter(c => M.esFutbol(c.col));
  const CLUBES = Object.keys(M.CLUBES).filter(club => FUT.filter(c => c.club === club).length >= 15);
  const ITALIA = ["inter", "roma", "napoli", "como"];
  const PREMIER = ["manutd", "mancity", "chelsea", "liverpool", "tottenham", "arsenal"];
  const SUDAMERICA = ["AR", "BR", "UY", "CO", "EC"];
  /* Los retos semanales, en el orden en que rotan desde la semana
     `PRIMERA` (El Clásico, la del 26-10-2026). `elegible` decide qué carta
     cumple; `tope` limita cuántas de un mismo club (El Clásico) y `extra`
     es una condición sobre las once juntas. `bandera` es la imagen de
     flags/ que se pinta en vez del emoji (Windows dibuja las banderas
     emoji como dos letras). Solo se agregan al final: el
     número de la semana elige el reto por su posición. Se activan solos el
     lunes; la pantalla los muestra en «Próximos retos» con su fecha. */
  const RETOS = [
    { id: "clasico", titulo: "El Clásico", icono: "⚔️", desc: "Solo Madrid y Barça, con al menos cinco de cada uno.", tope: 6,
      elegible: c => c.club === "realmadrid" || c.club === "barcelona",
      extra: cs => { const m = cs.filter(c => c.club === "realmadrid").length, b = cs.filter(c => c.club === "barcelona").length; return { ok: m >= 5 && b >= 5, txt: `Madrid ${m} · Barça ${b} (mínimo 5 de cada uno)` }; } },
    { id: "bleus", titulo: "Les Bleus", icono: "🇫🇷", bandera: "fr", desc: "Once jugadores de la selección francesa.", elegible: c => c.pais === "FR" },
    { id: "lions", titulo: "Three Lions", icono: "🦁", bandera: "eng", desc: "Once jugadores de la selección inglesa.", elegible: c => c.pais === "ENG" },
    { id: "furia", titulo: "Furia Roja", icono: "🇪🇸", bandera: "es", desc: "Once jugadores de la selección española.", elegible: c => c.pais === "ES" },
    { id: "calcio", titulo: "Calcio", icono: "🇮🇹", bandera: "it", desc: "Once jugadores de clubes italianos: Inter, Roma, Napoli y Como.", elegible: c => ITALIA.includes(c.club) },
    { id: "selecao", titulo: "Seleção", icono: "🇧🇷", bandera: "br", desc: "Once jugadores de la selección brasileña.", elegible: c => c.pais === "BR" },
    { id: "bigsix", titulo: "Big Six", icono: "🏴", desc: "Once jugadores de los seis grandes de la Premier.", elegible: c => PREMIER.includes(c.club) },
    { id: "albiceleste", titulo: "Albiceleste", icono: "🇦🇷", bandera: "ar", desc: "Once jugadores de la selección argentina.", elegible: c => c.pais === "AR" },
    { id: "sudamerica", titulo: "Sudamérica", icono: "🌎", desc: "Once jugadores de Argentina, Brasil, Uruguay, Colombia y Ecuador.", elegible: c => SUDAMERICA.includes(c.pais) }
  ];
  const RETO = Object.fromEntries(RETOS.map(r => [r.id, r]));

  /* ---------- la semana ----------
     Empieza el lunes a las 00:00 de Chile en horario de verano (03:00
     UTC): en invierno cambia a las 23:00 del domingo, una hora antes, y da
     igual mientras todos usen la hora del servidor. */
  const SEMANA_MS = 7 * 864e5;
  const SEMANA0 = Date.UTC(2026, 0, 5, 3);   // lunes 5-1-2026, 00:00 en Chile (verano)
  const semanaDe = ms => Math.floor((ms - SEMANA0) / SEMANA_MS);
  const inicioSemana = n => SEMANA0 + n * SEMANA_MS;
  const finSemana = n => SEMANA0 + (n + 1) * SEMANA_MS;
  const PRIMERA = 42;   // lunes 26-10-2026: la primera semana de retos, El Clásico
  const retoDeSemana = n => RETOS[(((n - PRIMERA) % RETOS.length) + RETOS.length) % RETOS.length];

  /* La plantilla general, siempre abierta: tus once mejores, de cualquier
     club y país. Gana quien tenga más media y mejor graduada. */
  const MEJOR = { clave: "mejor", tipo: "libre", titulo: "Mejor plantilla", icono: "⭐",
    desc: "Tus once mejores jugadores, de cualquier club y país.", elegible: () => true };

  /* ---------- una plantilla por su clave ----------
     `mejor`, `club-<club>` o `reto-<id>-<semana>`. Las claves van en Firebase
     (plantillas/s/<clave> y el reclamo `<clave>_<nivel>`): solo letras,
     números y guiones. */
  function plantilla(clave) {
    const s = String(clave || "");
    if (s === MEJOR.clave) return Object.assign({}, MEJOR);
    let m = /^club-([a-z]{2,15})$/.exec(s);
    if (m && CLUBES.includes(m[1])) {
      const club = m[1];
      return { clave: s, tipo: "club", club, titulo: M.CLUBES[club], desc: `Once jugadores del ${M.CLUBES[club]}.`, elegible: c => c.club === club };
    }
    m = /^reto-([a-z]{2,12})-([0-9]{1,5})$/.exec(s);
    if (m && RETO[m[1]] && retoDeSemana(+m[2]) === RETO[m[1]]) {
      const r = RETO[m[1]], n = +m[2];
      return Object.assign({}, r, { clave: s, tipo: "reto", semana: n, desde: inicioSemana(n), hasta: finSemana(n) });
    }
    return null;
  }
  const claveClub = club => "club-" + club;
  const claveReto = n => "reto-" + retoDeSemana(n).id + "-" + n;
  // la mejor plantilla y un club valen siempre; un reto, solo durante su semana (en hora del servidor)
  const vigente = (p, ms) => !!p && (p.tipo !== "reto" || (ms >= p.desde && ms < p.hasta));

  /* ---------- el puntaje ---------- */
  const NIVEL = { ok: 0, incomodo: 1, mal: 2 };
  // cómo le queda la casilla `i` a la carta `id`: 0 su puesto, 1 incómodo (−3), 2 no puede
  const encaje = (i, id) => { const a = M.ajuste(M.FORMACION[i].pos, M.CARDS[id].posiciones); return { nivel: NIVEL[a.nivel], pen: a.pen }; };
  const estado = f => (f.gr ? 0.8 + 0.02 * f.g : 0.8);
  // lo que vale la ficha {id, g, gr} en la casilla `i` (sin casilla: en su puesto)
  const puntosFicha = (f, i) => (M.CARDS[f.id].media - (i == null ? 0 : encaje(i, f.id).pen)) * estado(f);
  const puntaje = fichas => Math.round(fichas.reduce((s, f, i) => s + (f ? puntosFicha(f, i) : 0), 0) * 10);

  /* La plantilla `clave` con estas once fichas ({id, g, gr} o null):
     si vale y por qué no, su puntaje y lo que piden los premios. */
  function evalua(clave, fichas) {
    const p = plantilla(clave), fs = M.FORMACION.map((_, i) => (fichas && fichas[i]) || null);
    const llenas = fs.filter(Boolean), cs = llenas.map(f => M.CARDS[f.id]);
    const cumplen = p ? cs.filter(p.elegible).length : 0;
    const porClub = {};
    cs.forEach(c => { porClub[c.club] = (porClub[c.club] || 0) + 1; });
    const checks = [
      { ok: llenas.length === 11, txt: `Once jugadores (${llenas.length}/11)` },
      { ok: fs.every((f, i) => !f || encaje(i, f.id).nivel < 2), txt: "Nadie en un puesto que no puede jugar" },
      { ok: new Set(cs.map(c => c.person)).size === cs.length, txt: "Sin repetir jugador" }
    ];
    // la mejor plantilla no pide nada más que eso
    if (!p || p.tipo !== "libre") checks.push({ ok: !!p && cumplen === llenas.length && llenas.length > 0, txt: p ? `Todos cumplen «${p.titulo}» (${cumplen}/${llenas.length})` : "Plantilla desconocida" });
    if (p && p.tope) checks.push({ ok: Object.values(porClub).every(n => n <= p.tope), txt: `Como mucho ${p.tope} de un mismo club` });
    if (p && p.extra) checks.push(p.extra(cs));
    const grads = llenas.filter(f => f.gr);
    return {
      valida: checks.every(c => c.ok), checks, puntaje: puntaje(fs),
      media: cs.length ? cs.reduce((s, c) => s + c.media, 0) / cs.length : 0,
      graduadas: grads.length, notaMedia: grads.length ? grads.reduce((s, f) => s + f.g, 0) / grads.length : 0,
      notaMin: llenas.length === 11 && grads.length === 11 ? Math.min(...grads.map(f => f.g)) : 0,
      enPuesto: fs.filter((f, i) => f && encaje(i, f.id).nivel === 0).length
    };
  }

  /* ---------- los premios ----------
     `sobres` son las claves de los sobres que regala (SOBRES del motor), y
     su prefijo es lo que la regla exige en cada clave: el reclamo guarda la
     primera en `k` y la segunda en `k2`. */
  const PREMIOS = [
    { n: 1, monedas: 50, sobres: ["futbol"], txt: "Plantilla completa y válida" },
    { n: 2, monedas: 300, sobres: ["futbolplus"], antes: ["futbol", "futbol"], nota: 6, txt: "Las once graduadas con nota 6 o más" },
    { n: 3, monedas: 1000, sobres: ["futbolplus", "futbolplus"], antes: ["futbolplus"], nota: 8, txt: "Las once graduadas con nota 8 o más" }
  ];
  /* `antes`: los sobres que daba ese premio hasta el 29-10-2026 (el 2, dos
     normales; el 3, un Plus). Un reclamo ya escrito con esa forma sigue
     valiendo; las reglas de ahora solo dejan escribir la nueva. */
  const sobresValen = (pr, prefijos) => [pr.sobres, pr.antes].some(l => l && l.length === prefijos.length && l.every((t, i) => M.SOBRE[t].prefijo === prefijos[i]));
  // el premio que da el marco de perfil de un club: el 3 (las once graduadas con nota 8 o más)
  const PREMIO_MARCO = 3;
  // «un sobre», «dos sobres», «un sobre Plus»
  const textoSobres = pr => { const n = pr.sobres.length, plus = pr.sobres[0] === "futbolplus"; return (n === 1 ? "un sobre" : n === 2 ? "dos sobres" : n + " sobres") + (plus ? " Plus" : ""); };
  const premioOk = (n, ev) => !!ev.valida && (!PREMIOS[n - 1].nota || ev.notaMin >= PREMIOS[n - 1].nota);
  // `club-realmadrid_2`: el reclamo del premio 2 de esa plantilla
  const claveReclamo = (clave, n) => clave + "_" + n;
  const leeReclamo = id => { const m = /^(.+)_([123])$/.exec(String(id || "")); return m ? { clave: m[1], n: +m[2] } : null; };

  /* ---------- el podio de cada semana ----------
     Cada lunes (al cerrar la semana, `finSemana`) la economía mira las
     tablas tal como estaban en ese instante: las tablas de los clubes pagan
     al 1.º, 2.º y 3.º (`PODIO_CLUB`, solo monedas) y la del reto que se
     cierra paga su podio (`PODIO_RETO`, monedas y sobres; los sobres se
     cobran con un botón, como los premios). Solo con `MIN_PODIO` personas
     o más en la tabla: con menos no hay a quién ganarle. La mejor
     plantilla no paga podio. */
  const MIN_PODIO = 3;
  const PODIO_CLUB = [300, 200, 100];
  const PODIO_RETO = [
    { n: 1, monedas: 1500, sobres: ["futbolplus", "futbolplus", "futbolplus"] },
    { n: 2, monedas: 1000, sobres: ["futbolplus"] },
    { n: 3, monedas: 500, sobres: ["futbol"] }
  ];
  // «tres sobres Plus», «un sobre Plus», «un sobre»
  const textoSobresPodio = pr => (pr.sobres.length === 3 ? "tres sobres Plus" : pr.sobres[0] === "futbolplus" ? "un sobre Plus" : "un sobre");
  // `reto-clasico-42_p1`: el reclamo de los sobres del 1.º del reto de la semana 42
  const clavePodio = (clave, n) => clave + "_p" + n;
  const leePodio = id => { const m = /^(reto-[a-z]{2,12}-[0-9]{1,5})_p([123])$/.exec(String(id || "")); return m ? { clave: m[1], n: +m[2] } : null; };
  // el orden de una tabla: más puntaje primero; empate, quien la subió antes
  const ordenaTabla = filas => filas.slice().sort((a, b) => b.puntaje - a.puntaje || a.at - b.at || (a.u < b.u ? -1 : a.u > b.u ? 1 : 0));

  /* ---------- el álbum completo de un club ----------
     Tener a la vez a cada jugador del club (una copia de su carta, con
     cualquier nota, graduada o no) paga una vez `ALBUM`. Se cuentan
     jugadores, no cartas: la especial de un jugador (Mbappé MVP, Kane
     Balón de Oro) vale por su carta normal, pero no hace falta tenerla
     (son por tiempo limitado, y el álbum quedaría imposible). El reclamo
     guarda una copia por jugador (`c`), y la economía comprueba que eran
     tuyas en ese momento. */
  const ALBUM = { monedas: 2000, sobres: ["futbolplus"] };
  // los jugadores del álbum: la carta normal de cada uno (su `person` es el mismo que el de su especial)
  const cartasAlbum = club => M.CARDS.filter(c => M.esFutbol(c.col) && c.club === club && !c.especial);
  // la carta del álbum que cubre la carta `id` (la normal de su jugador), o null si no es de ese club
  const huecoAlbum = (club, id) => { const c = M.CARDS[id]; return c && c.club === club ? cartasAlbum(club).find(x => x.person === c.person) || null : null; };
  const claveAlbum = club => "album-" + club;
  const leeAlbum = id => { const m = /^album-([a-z]{2,15})$/.exec(String(id || "")); return m && CLUBES.includes(m[1]) ? m[1] : null; };

  /* El mejor once que se puede armar con estas copias ({key, id, g, gr}):
     cada casilla con la que más suma entre las que juegan ahí, después
     las que juegan incómodas. Para «Autocompletar». */
  function mejorOnce(clave, copias) {
    const p = plantilla(clave), out = M.FORMACION.map(() => null), usados = new Set(), porClub = {};
    if (!p) return out;
    const lista = copias.filter(cp => p.elegible(M.CARDS[cp.id]));
    for (const nivel of [0, 1])
      M.FORMACION.forEach((_, i) => {
        if (out[i]) return;
        let mejor = null, pm = -1;
        for (const cp of lista) {
          const c = M.CARDS[cp.id];
          if (usados.has(c.person) || encaje(i, cp.id).nivel > nivel || (p.tope && (porClub[c.club] || 0) >= p.tope)) continue;
          const v = puntosFicha(cp, i);
          if (v > pm) { pm = v; mejor = cp; }
        }
        if (mejor) { out[i] = mejor; usados.add(M.CARDS[mejor.id].person); porClub[M.CARDS[mejor.id].club] = (porClub[M.CARDS[mejor.id].club] || 0) + 1; }
      });
    return out;
  }

  return {
    MEJOR, CLUBES, RETOS, PRIMERA, SEMANA0, SEMANA_MS, semanaDe, inicioSemana, finSemana, retoDeSemana,
    plantilla, claveClub, claveReto, vigente, encaje, estado, puntosFicha, puntaje, evalua,
    PREMIOS, sobresValen, PREMIO_MARCO, textoSobres, premioOk, claveReclamo, leeReclamo, mejorOnce,
    MIN_PODIO, PODIO_CLUB, PODIO_RETO, textoSobresPodio, clavePodio, leePodio, ordenaTabla,
    ALBUM, cartasAlbum, huecoAlbum, claveAlbum, leeAlbum
  };
});
