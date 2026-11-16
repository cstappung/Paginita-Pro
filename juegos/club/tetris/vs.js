/* Tetris Club — VS Bots: tú contra tres bots, todos contra todos.

   Es el modo «sala» de Tetris pero sin nadie más: cuatro pozos en el mismo
   navegador, la basura que limpia cada uno cae sobre otro vivo elegido al
   azar, y gana el último en pie. Lo que compite en la clasificación es el
   tiempo que tardas en dejar fuera a los tres bots, una tabla por
   dificultad (`club-tetris-bots-<dif>`).

   Todo es determinista para que la prueba del Club se pueda rehacer
   (docs/antitrampas/tetris.md): los cuatro pozos avanzan juntos en los
   mismos pasos de `TM.PASO` ms que la partida en solitario, los bots
   deciden con su propio generador sembrado desde la semilla de la partida
   y con aritmética entera (nada de `Math.pow` ni de flotantes que puedan
   variar entre motores de JS), y a quién le cae cada ataque también sale
   de un generador sembrado. Así la prueba sigue siendo la semilla más las
   jugadas de la persona: el verificador vuelve a jugar a los bots y tiene
   que llegar al mismo final, al mismo paso.

   UMD como el motor: lo cargan el juego (script suelto), el verificador
   (esbuild) y las pruebas de Node. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(require("./motor.js"));
  else raiz.TetrisVS = fabrica(raiz.TetrisMotor);
})(typeof globalThis !== "undefined" ? globalThis : this, function (TM) {
  "use strict";
  const W = TM.W, H = TM.H, OCULTAS = TM.OCULTAS, PASO = TM.PASO;
  const RIVALES = 3;
  /* Como la sala: el nivel sube cada 30 s, así que ninguna partida es
     eterna (al nivel 20 la pieza ya cae de golpe). */
  const SUBE_CADA = 30000;
  /* Lo más que viaja en un ataque, como en la sala. */
  const ATAQUE_MAX = 12;
  const DIFS = ["facil", "medio", "dificil"];
  const NOMBRE_DIF = { facil: "Fácil", medio: "Medio", dificil: "Difícil" };
  const NOMBRES = ["Píxel", "Turbo", "Glitch"];

  /* Cómo juega un bot de cada dificultad, en pasos de 10 ms:
     - `piensa`: lo que tarda en empezar a mover una pieza nueva [mín, máx];
     - `cada`: pasos entre una acción y la siguiente (mover, girar, soltar);
     - `error`: probabilidad (en milésimas) de no elegir la mejor jugada,
       sino una cualquiera de las `top` mejores; `torpe`, la de tirar la
       pieza en un sitio cualquiera que quepa;
     - `rapido`: lo menos que llega a tardar [en pensar, entre acciones]
       cuando la gravedad aprieta;
     - `guarda`: si usa la reserva.
     Da, más o menos, 0,6 · 1,1 · 2 piezas por segundo. */
  const PERFIL = {
    facil: { piensa: [95, 135], cada: 14, rapido: [40, 8], error: 300, top: 6, torpe: 60, guarda: false },
    medio: { piensa: [45, 70], cada: 8, rapido: [18, 4], error: 120, top: 3, torpe: 0, guarda: true },
    dificil: { piensa: [22, 34], cada: 5, rapido: [9, 3], error: 0, top: 1, torpe: 0, guarda: true }
  };

  const entre = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const milesima = r => Math.floor(r() * 1000);
  /* La semilla de cada pozo rival: otra bolsa para cada bot, así no juegan
     los tres la misma partida en paralelo. */
  const semillaPozo = (base, i) => i ? (Math.imul(base ^ 0x2545f491, 0x9e3779b1 + 2 * i) ^ (i * 0x632be5ab)) >>> 0 || 1 : base;

  /* ---------- la cabeza del bot ---------- */
  /* Puntúa un pozo después de fijar `celdas`: enteros, con los pesos de la
     IA clásica de Yiyuan Lee (altura total, líneas, huecos, rugosidad) ×100.
     Se probó premiar el ataque (dejar un pozo para el Tetris): con una sola
     pieza de vista el bot se enterraba solo y mandaba menos. La dificultad
     está en la velocidad y en los errores, no en la cabeza. */
  function puntua(oc, celdas) {
    const b = oc.slice();
    let arriba = true;
    for (const [x, y] of celdas) { if (y >= 0) b[y * W + x] = 1; if (y >= OCULTAS) arriba = false; }
    if (arriba) return -1e9;
    let n = 0;
    const filas = [];
    for (let y = 0; y < H; y++) {
      let llena = true;
      for (let x = 0; x < W; x++) if (!b[y * W + x]) { llena = false; break; }
      if (llena) n++; else filas.push(y);
    }
    /* Con las filas llenas fuera, la altura y los huecos de lo que queda. */
    const off = H - filas.length;
    let alto = 0, huecos = 0, rugoso = 0, maximo = 0, antes = -1;
    for (let x = 0; x < W; x++) {
      let h = 0, visto = false, hx = 0;
      for (let j = 0; j < filas.length; j++) {
        const c = b[filas[j] * W + x];
        if (c && !visto) { visto = true; h = H - (j + off); }
        else if (!c && visto) hx++;
      }
      alto += h; huecos += hx;
      if (h > maximo) maximo = h;
      if (antes >= 0) rugoso += Math.abs(h - antes);
      antes = h;
    }
    /* Arriba del todo, lo que importa es no morir. */
    let p = -51 * alto + 76 * n - 36 * huecos - 18 * rugoso;
    if (maximo > H - 6) p -= 400 * (maximo - (H - 6));
    return p;
  }
  const ocupacion = s => { const oc = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) oc[i] = s.pozo[i] ? 1 : 0; return oc; };
  /* Todas las jugadas de la pieza `t` que se pueden alcanzar desde donde
     nace deslizándola arriba: {r, x, p (puntos)}. */
  function jugadas(s, oc, t, y0) {
    const r0 = [];
    const x0 = t === "O" ? 4 : 3;
    const giros = t === "O" ? 1 : 4;
    for (let r = 0; r < giros; r++) {
      if (!TM.cabe(s, { t, r, x: x0, y: y0 })) continue;
      for (const dir of [-1, 1]) {
        for (let x = dir < 0 ? x0 : x0 + 1; ; x += dir) {
          const q = { t, r, x, y: y0 };
          if (!TM.cabe(s, q)) break;
          while (TM.cabe(s, { t, r, x, y: q.y + 1 })) q.y++;
          r0.push({ r, x, p: puntua(oc, TM.celdas(q)) });
        }
      }
    }
    return r0;
  }
  /* Elige la jugada de la pieza nueva. Mira la pieza en juego y, si el bot
     usa la reserva, la que saldría al guardar. */
  function decide(b, s) {
    const perfil = b.perfil, oc = ocupacion(s);
    let ops = jugadas(s, oc, s.p.t, s.p.y).map(o => Object.assign(o, { g: false }));
    if (perfil.guarda && s.puedeGuardar) {
      const otra = s.guardada || s.cola[0];
      if (otra && otra !== s.p.t) {
        const y0 = TM.cabe(s, { t: otra, r: 0, x: otra === "O" ? 4 : 3, y: 1 }) ? 1 : 0;
        ops = ops.concat(jugadas(s, oc, otra, y0).map(o => Object.assign(o, { g: true })));
      }
    }
    if (!ops.length) return null;
    /* Orden estable: a igual puntuación, la que se generó antes. */
    ops = ops.map((o, i) => [o, i]).sort((a, c) => c[0].p - a[0].p || a[1] - c[1]).map(a => a[0]);
    const tira = milesima(b.rng);
    if (perfil.torpe && tira < perfil.torpe) return ops[Math.floor(b.rng() * ops.length)];
    if (perfil.error && tira < perfil.error + perfil.torpe) return ops[Math.floor(b.rng() * Math.min(perfil.top, ops.length))];
    return ops[0];
  }
  function crearBot(dif, semilla) {
    return { perfil: PERFIL[dif], rng: TM.rng(semilla), piezas: -1, plan: null, espera: 0, cada: 1, guardo: false };
  }
  /* Un paso del bot: si la pieza es nueva, la piensa; si no, hace la
     siguiente acción de su plan cuando toca. */
  function pasoBot(b, s) {
    if (s.fin || !s.p) return;
    if (b.piezas !== s.piezas) {
      b.piezas = s.piezas;
      b.plan = decide(b, s);
      b.guardo = false;
      /* Con la gravedad alta el bot se apura, como una persona: no deja
         caer la pieza más de unas filas mientras piensa, ni una entera
         entre acción y acción. Pero hasta un tope (`rapido`): el difícil no
         se vuelve una máquina perfecta en el nivel 20. */
      const g = Math.floor(TM.gravedad(s.nivel) / PASO);
      b.espera = Math.max(b.perfil.rapido[0], Math.min(entre(b.rng, b.perfil.piensa[0], b.perfil.piensa[1]), 3 * g));
      b.cada = Math.max(b.perfil.rapido[1], Math.min(b.perfil.cada, g));
    }
    if (b.espera > 0) { b.espera--; return; }
    b.espera = b.cada;
    const pl = b.plan;
    if (!pl) { TM.caer(s); return; }
    if (pl.g && !b.guardo) {
      b.guardo = true;
      if (!TM.guardar(s)) pl.g = false;
      return;
    }
    if (s.p.r !== pl.r) {
      const dir = ((pl.r - s.p.r + 4) % 4) === 3 ? -1 : 1;
      if (!TM.rotar(s, dir)) pl.r = s.p.r;
      return;
    }
    if (s.p.x !== pl.x) {
      if (!TM.mover(s, pl.x < s.p.x ? -1 : 1)) pl.x = s.p.x;
      return;
    }
    TM.caer(s);
  }

  /* ---------- la partida: cuatro pozos a la vez ---------- */
  /* `pozos[0]` es el tuyo; 1–3, los bots. `paso()` avanza un paso de todos
     (las acciones de la persona ya aplicadas a `pozos[0]` por quien llama),
     reparte la basura y anota quién cayó. `ataques` y `caidas` se acumulan
     para el dibujo, que los vacía cuando quiere: no deciden nada. */
  function mundo(cuenta, sal, dif) {
    const base = TM.semillaDe(cuenta, sal);
    const pozos = [], bots = [null];
    for (let i = 0; i <= RIVALES; i++) pozos.push(TM.crear({ semilla: semillaPozo(base, i), nivel: 1, subeCada: SUBE_CADA, soloTiempo: true }));
    for (let i = 1; i <= RIVALES; i++) bots.push(crearBot(dif, (base ^ Math.imul(i, 0x27d4eb2d)) >>> 0));
    const rt = TM.rng((base ^ 0xa5a5a5a5) >>> 0);
    const m = {
      pozos, bots, k: 0, fuera: pozos.map(() => -1), enviadas: pozos.map(() => 0), ataques: [], caidas: [],
      vivos: () => pozos.map((p, i) => i).filter(i => m.fuera[i] < 0),
      paso() {
        for (let i = 1; i <= RIVALES; i++) if (m.fuera[i] < 0) pasoBot(bots[i], pozos[i]);
        for (let i = 0; i <= RIVALES; i++) if (m.fuera[i] < 0) TM.avanza(pozos[i], PASO);
        /* La basura: de cada pozo que limpió, a otro vivo al azar. */
        for (let i = 0; i <= RIVALES; i++) {
          const s = pozos[i];
          if (s.salida <= 0) continue;
          const n = Math.min(ATAQUE_MAX, s.salida);
          s.salida = 0;
          const blancos = [];
          for (let j = 0; j <= RIVALES; j++) if (j !== i && m.fuera[j] < 0 && !pozos[j].fin) blancos.push(j);
          if (!blancos.length || pozos[i].fin) continue;
          const a = blancos[Math.floor(rt() * blancos.length)];
          TM.recibe(pozos[a], n);
          m.enviadas[i] += n;
          m.ataques.push({ de: i, a, n });
        }
        for (let i = 0; i <= RIVALES; i++) {
          if (i) pozos[i].eventos.length = 0;
          if (m.fuera[i] < 0 && pozos[i].fin) { m.fuera[i] = m.k; m.caidas.push(i); }
        }
        m.k++;
        return terminada(m);
      }
    };
    return m;
  }
  /* Pierdes si te sale el pozo por arriba (aunque el último bot caiga en
     el mismo paso); ganas cuando los tres están fuera. */
  function terminada(m) {
    if (m.pozos[0].fin) return { gano: false };
    for (let i = 1; i <= RIVALES; i++) if (m.fuera[i] < 0) return null;
    return { gano: true };
  }
  const derrotados = m => m.fuera.slice(1).filter(k => k >= 0).length;

  /* Lo mismo que `TM.grabadora`, con el mundo entero: `pide(a)` deja una
     acción tuya para el próximo paso, `paso(blando)` la aplica, avanza los
     cuatro pozos y dice si terminó, `prueba(extra)` es lo que viaja con el
     resultado. */
  const LETRA = { izq: "I", der: "D", gira: "G", contragira: "A", caer: "C", guarda: "H" };
  const DE_LETRA = { I: "izq", D: "der", G: "gira", A: "contragira", C: "caer", H: "guarda" };
  function grabadora(op) {
    const cuenta = String(op.cuenta || "local"), sal = op.sal >>> 0, dif = DIFS.includes(op.dif) ? op.dif : "facil";
    const m = mundo(cuenta, sal, dif), s = m.pozos[0];
    const cola = [];
    let anterior = 0, txt = "", blando = false;
    const anota = l => { txt += (m.k - anterior ? (m.k - anterior).toString(36) : "") + l; anterior = m.k; };
    return {
      m, s, dif,
      pide(a) { if (LETRA[a]) cola.push(a); },
      vacia() { cola.length = 0; },
      paso(bl) {
        for (const a of cola.splice(0)) {
          if (s.fin || !TM.accion(s, a)) continue;
          anota(LETRA[a]);
          if (op.alJugar) op.alJugar(a);
        }
        if (!!bl !== blando) { blando = !!bl; anota(blando ? "B" : "S"); }
        s.blando = blando;
        return m.paso();
      },
      prueba(extra) { return Object.assign({ v: 1, m: "bots", d: dif, u: cuenta, a: sal, n: m.k, e: txt }, extra || {}); }
    };
  }
  /* Rehace una partida VS Bots desde su prueba, con las mismas reglas que
     `TM.rehace` (una jugada anotada que no hace nada, un blando doble o una
     partida que sigue tras terminar delatan una prueba tocada) y los bots
     jugando de nuevo. Devuelve lo de `TM.rehace` más `derrotados`. */
  function rehace(p, tope) {
    if (!p || typeof p !== "object" || p.v !== 1) return { error: "La prueba no es de esta versión del juego." };
    if (p.m !== "bots" || !DIFS.includes(p.d)) return { error: "La prueba no dice la dificultad de los bots." };
    if (typeof p.u !== "string" || !p.u || p.u.length > 128 || !Number.isSafeInteger(p.a) || p.a < 0 || p.a > 0xffffffff)
      return { error: "La prueba no trae su semilla." };
    const n = p.n;
    if (!Number.isSafeInteger(n) || n < 1 || n > (tope || 180000)) return { error: "La duración de la partida no es válida." };
    const jug = TM.leeJugadas(p.e, n);
    if (!jug) return { error: "Las jugadas de la prueba no se pueden leer." };
    const m = mundo(p.u, p.a, p.d), s = m.pozos[0];
    const fijas = [];
    let i = 0, blando = false, fin = null;
    for (let k = 0; k < n; k++) {
      for (; i < jug.length && jug[i][0] === k; i++) {
        const l = jug[i][1];
        if (l === "B" || l === "S") {
          if ((l === "B") === blando) return { error: "La prueba trae un blando imposible." };
          blando = l === "B";
          continue;
        }
        const antes = s.piezas;
        if (s.fin || !TM.accion(s, DE_LETRA[l])) return { error: "La prueba trae una jugada que no se puede hacer." };
        if (s.piezas > antes) fijas.push(k);
      }
      s.blando = blando;
      const ya = s.piezas;
      fin = m.paso();
      if (s.piezas > ya) fijas.push(k);
      s.eventos.length = 0;
      if (fin) {
        if (k !== n - 1) return { error: "La partida sigue después de terminar." };
        break;
      }
    }
    if (!fin) return { error: "La partida de la prueba no termina." };
    return { puntos: s.puntos, tiempo: s.tiempo, lineas: s.lineas, piezas: s.piezas, gano: fin.gano, pasos: n, fijas, jugadas: jug,
      derrotados: derrotados(m), enviadas: m.enviadas[0] };
  }

  return { RIVALES, SUBE_CADA, ATAQUE_MAX, DIFS, NOMBRE_DIF, NOMBRES, PERFIL, mundo, terminada, derrotados, grabadora, rehace, pasoBot, crearBot, decide };
});
