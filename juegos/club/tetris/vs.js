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

  /* ======== Versión 1 (pruebas `v:1`, hasta noviembre de 2026) ========
     Los bots de antes, tal cual: solo sirven para rehacer las pruebas de los
     récords que ya están guardados. No tocar: cualquier cambio aquí cambia
     el final de esas partidas y dejan de verificar. */
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
  const PERFIL_V1 = {
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
  function puntuaV1(oc, celdas) {
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
  function jugadasV1(s, oc, t, y0) {
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
          r0.push({ r, x, p: puntuaV1(oc, TM.celdas(q)) });
        }
      }
    }
    return r0;
  }
  /* Elige la jugada de la pieza nueva. Mira la pieza en juego y, si el bot
     usa la reserva, la que saldría al guardar. */
  function decideV1(b, s) {
    const perfil = b.perfil, oc = ocupacion(s);
    let ops = jugadasV1(s, oc, s.p.t, s.p.y).map(o => Object.assign(o, { g: false }));
    if (perfil.guarda && s.puedeGuardar) {
      const otra = s.guardada || s.cola[0];
      if (otra && otra !== s.p.t) {
        const y0 = TM.cabe(s, { t: otra, r: 0, x: otra === "O" ? 4 : 3, y: 1 }) ? 1 : 0;
        ops = ops.concat(jugadasV1(s, oc, otra, y0).map(o => Object.assign(o, { g: true })));
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
  function crearBotV1(dif, semilla) {
    return { perfil: PERFIL_V1[dif], rng: TM.rng(semilla), piezas: -1, plan: null, espera: 0, cada: 1, guardo: false };
  }
  /* Un paso del bot: si la pieza es nueva, la piensa; si no, hace la
     siguiente acción de su plan cuando toca. */
  function pasoBotV1(b, s) {
    if (s.fin || !s.p) return;
    if (b.piezas !== s.piezas) {
      b.piezas = s.piezas;
      b.plan = decideV1(b, s);
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
  function mundoV1(cuenta, sal, dif) {
    const base = TM.semillaDe(cuenta, sal);
    const pozos = [], bots = [null];
    for (let i = 0; i <= RIVALES; i++) pozos.push(TM.crear({ semilla: semillaPozo(base, i), nivel: 1, subeCada: SUBE_CADA, soloTiempo: true }));
    for (let i = 1; i <= RIVALES; i++) bots.push(crearBotV1(dif, (base ^ Math.imul(i, 0x27d4eb2d)) >>> 0));
    const rt = TM.rng((base ^ 0xa5a5a5a5) >>> 0);
    const m = {
      pozos, bots, k: 0, fuera: pozos.map(() => -1), enviadas: pozos.map(() => 0), ataques: [], caidas: [],
      vivos: () => pozos.map((p, i) => i).filter(i => m.fuera[i] < 0),
      paso() {
        for (let i = 1; i <= RIVALES; i++) if (m.fuera[i] < 0) pasoBotV1(bots[i], pozos[i]);
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
  /* ======== fin de la versión 1 ======== */

  /* Pierdes si te sale el pozo por arriba (aunque el último bot caiga en
     el mismo paso); ganas cuando los tres están fuera. */
  function terminada(m) {
    if (m.pozos[0].fin) return { gano: false };
    for (let i = 1; i <= RIVALES; i++) if (m.fuera[i] < 0) return null;
    return { gano: true };
  }
  const derrotados = m => m.fuera.slice(1).filter(k => k >= 0).length;


  /* ======== Versión 2: bots que atacan, se equivocan y eligen a quién ========

     Lo que se le pedía a la versión 1: los bots solo hacían líneas sueltas
     (no mandaban nada), no fallaban nunca y la basura caía sobre un pozo al
     azar, así que nadie sabía a quién atacaba ni quién lo atacaba. Ahora:

     - **Arman para atacar.** Mientras la pila está baja, el bot deja una
       columna libre (su «pozo», en un borde) y apila al lado para meter un
       Tetris; las simples y dobles le cuestan. Cuando la pila sube (o le
       viene mucha basura) cambia a sobrevivir: limpia lo que pueda, porque
       cada pieza que limpia aplaza la basura. Con histéresis, para que no
       cambie de idea en cada pieza. Lo que hizo que la versión 1 se
       enterrara al premiar el Tetris era no tener esta salida.
     - **Se equivocan como una persona.** Se pasan una columna (y a veces se
       dan cuenta y corrigen tras dudar), giran de más y vuelven, eligen la
       segunda mejor, a veces la sueltan con el blando en vez de golpe, se
       distraen, se asustan cuando les llega basura y con la pila arriba se
       apuran y fallan el doble.
     - **Tienen un objetivo.** Cada pozo ataca a uno solo, que se ve en
       pantalla: la persona lo elige (clic en el rival, o la tecla de
       objetivo, que va en la prueba como cualquier jugada); los bots cambian
       cada tanto, prefieren al que está más alto (rematar) y a veces se
       vengan de quien les acaba de pegar. Si el objetivo cae, se pasa al
       siguiente vivo. Quien dio el último golpe a un pozo que cae (en los
       últimos 10 s) se lleva el KO.

     Todo sigue entero y sembrado: la prueba (`v:2`) es otra vez solo la
     semilla y las jugadas de la persona, y `rehace` vuelve a jugar a los
     bots. Cambiar cualquier número de aquí cambia el final de las pruebas
     `v:2`: entonces toca una versión 3 y guardar esta como se guardó la 1. */

  /* Cómo juega cada dificultad. Tiempos en pasos de 10 ms, probabilidades
     en milésimas:
     - `piensa` [mín, máx] antes de mover una pieza nueva; `cada` [mín, máx]
       entre una acción y la siguiente; `rapido`, lo menos que llegan a
       tardar [en pensar, entre acciones] cuando la gravedad aprieta;
     - `mira`: cuántas de sus mejores jugadas vuelve a pensar mirando la
       pieza siguiente (0, ninguna);
     - `ambicion` (0–3) y `umbral`: cuánto le importa el Tetris y hasta qué
       altura de pila sigue armando;
     - `duda`/`top`: elegir una de las `top` mejores en vez de la mejor;
       `torpe`: tirarla en cualquier sitio;
     - `desvio`: pasarse una columna; `corrige`: darse cuenta y volver;
       `sobregiro`: girar de más y deshacer; `blando`: bajarla con el blando
       en vez de soltarla; `distrae`: quedarse pensando un buen rato;
     - `guarda`: usa la reserva; `venganza`: apuntar a quien le pegó;
       `foco` [mín, máx]: cada cuánto se replantea a quién ataca; `remata`
       (0–2): cuánto prefiere al que tiene la pila más alta. El fácil
       reparte al azar: con el que va perdiendo no se ensaña. */
  const PERFIL = {
    facil: { piensa: [80, 130], cada: [10, 17], rapido: [36, 7], mira: 0, ambicion: 1, umbral: 8, duda: 220, top: 4, torpe: 30,
      desvio: 130, corrige: 420, sobregiro: 70, blando: 350, distrae: 50, guarda: false, venganza: 250, remata: 0, foco: [1100, 2000] },
    medio: { piensa: [42, 72], cada: [6, 11], rapido: [17, 4], mira: 3, ambicion: 2, umbral: 10, duda: 110, top: 3, torpe: 6,
      desvio: 80, corrige: 600, sobregiro: 45, blando: 120, distrae: 25, guarda: true, venganza: 450, remata: 1, foco: [900, 1600] },
    dificil: { piensa: [22, 38], cada: [4, 7], rapido: [9, 3], mira: 6, ambicion: 3, umbral: 12, duda: 30, top: 2, torpe: 0,
      desvio: 28, corrige: 800, sobregiro: 25, blando: 0, distrae: 10, guarda: true, venganza: 600, remata: 2, foco: [700, 1300] }
  };
  /* Lo que vale cada limpieza mientras arma, según la ambición: [simple,
     doble, triple, Tetris]. Una simple «gasta» filas que iban para el
     Tetris; la triple ya ataca. */
  const BONO_ARMA = [null, [-50, 20, 200, 800], [-100, -40, 150, 1000], [-160, -80, 140, 1500]];
  /* Cuántos pasos cuenta un golpe para el KO, y cuántos se queda un bot
     con un objetivo nuevo antes de poder vengarse (si no, cambia en cada
     golpe y en pantalla no se entiende nada). */
  const KO_PASOS = 1000, FIRME_PASOS = 300;

  const FORMAS = {};
  for (const t of TM.PIEZAS) { FORMAS[t] = []; for (let r = 0; r < 4; r++) FORMAS[t].push(TM.celdas({ t, r, x: 0, y: 0 })); }
  function cabeOc(oc, t, r, x, y) {
    const f = FORMAS[t][r];
    for (let i = 0; i < 4; i++) {
      const cx = x + f[i][0], cy = y + f[i][1];
      if (cx < 0 || cx >= W || cy >= H) return false;
      if (cy >= 0 && oc[cy * W + cx]) return false;
    }
    return true;
  }
  /* Fija la pieza en una copia del pozo y quita las filas llenas. */
  function coloca(oc, t, r, x, y) {
    const b = oc.slice(), f = FORMAS[t][r];
    let arriba = true;
    for (let i = 0; i < 4; i++) { const cy = y + f[i][1]; if (cy >= 0) b[cy * W + x + f[i][0]] = 1; if (cy >= OCULTAS) arriba = false; }
    let n = 0, dst = H - 1;
    for (let yy = H - 1; yy >= 0; yy--) {
      let llena = true;
      for (let xx = 0; xx < W; xx++) if (!b[yy * W + xx]) { llena = false; break; }
      if (llena) { n++; continue; }
      if (dst !== yy) for (let xx = 0; xx < W; xx++) b[dst * W + xx] = b[yy * W + xx];
      dst--;
    }
    for (; dst >= 0; dst--) for (let xx = 0; xx < W; xx++) b[dst * W + xx] = 0;
    return { b, n, arriba };
  }
  /* Las colocaciones de `t` que se alcanzan girándola donde nace y
     deslizándola a la altura `y0`: {r, x, y}. */
  function colocaciones(oc, t, y0) {
    const r0 = [], x0 = t === "O" ? 4 : 3, giros = t === "O" ? 1 : 4;
    for (let r = 0; r < giros; r++) {
      if (!cabeOc(oc, t, r, x0, y0)) continue;
      for (const dir of [-1, 1]) {
        for (let x = dir < 0 ? x0 : x0 + 1; cabeOc(oc, t, r, x, y0); x += dir) {
          let y = y0;
          while (cabeOc(oc, t, r, x, y + 1)) y++;
          r0.push({ r, x, y });
        }
      }
    }
    return r0;
  }
  const nacer = (oc, t) => cabeOc(oc, t, 0, t === "O" ? 4 : 3, 1) ? 1 : 0;
  function alturas(b) {
    const h = new Array(W).fill(0);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (b[y * W + x]) { h[x] = H - y; break; }
    return h;
  }
  /* Lo que vale un pozo ya colocado, en enteros. `e.pozo` es la columna
     que se deja libre al armar (−1 al sobrevivir). */
  function valora(b, e) {
    const h = alturas(b);
    let huecos = 0, cubiertas = 0, filasHueco = 0, maximo = 0;
    for (let x = 0; x < W; x++) {
      if (h[x] > maximo) maximo = h[x];
      let encima = 0;
      for (let y = H - h[x]; y < H; y++) {
        if (b[y * W + x]) encima++;
        else { huecos++; cubiertas += encima; }
      }
    }
    for (let y = 0; y < H; y++) {
      let lleno = false, hueco = false;
      for (let x = 0; x < W; x++) {
        if (b[y * W + x]) lleno = true;
        else if (H - y <= h[x]) hueco = true;
      }
      if (lleno && hueco) filasHueco++;
    }
    const c = e.pozo;
    let alto = 0, rugoso = 0, zanjas = 0, antes = -1;
    for (let x = 0; x < W; x++) {
      if (x === c) continue;
      alto += h[x];
      if (antes >= 0) rugoso += Math.abs(h[x] - antes);
      antes = h[x];
      /* Una zanja de una columna (que no es el pozo) pide una I. */
      const iz = x === 0 || x - 1 === c && x - 1 === 0 ? 99 : x - 1 === c ? (x - 2 >= 0 ? h[x - 2] : 99) : h[x - 1];
      const de = x === W - 1 || x + 1 === c && x + 1 === W - 1 ? 99 : x + 1 === c ? (x + 2 < W ? h[x + 2] : 99) : h[x + 1];
      const d = Math.min(iz, de) - h[x];
      if (d >= 3) zanjas += d - 2;
    }
    if (c < 0) {
      let p = -51 * alto - 360 * huecos - 100 * filasHueco - 10 * cubiertas - 18 * rugoso - 90 * zanjas;
      if (maximo > 14) p -= 420 * (maximo - 14);
      return p;
    }
    /* Armando: filas listas para el Tetris (todo lleno menos el pozo). */
    let listas = 0;
    for (let y = H - 1; y >= 0; y--) {
      if (b[y * W + c]) break;
      let llena = true;
      for (let x = 0; x < W; x++) if (x !== c && !b[y * W + x]) { llena = false; break; }
      if (!llena) break;
      listas++;
    }
    let p = -7 * alto - 330 * huecos - 150 * filasHueco - 18 * cubiertas - 22 * rugoso - 120 * zanjas - 45 * h[c] + 55 * Math.min(4, listas);
    if (maximo > e.umbral + 2) p -= 260 * (maximo - e.umbral - 2);
    return p;
  }
  function bono(n, e) {
    if (!n) return 0;
    if (e.pozo < 0) return 130 * n + (n === 4 ? 250 : 0);
    return BONO_ARMA[e.ambicion][n - 1];
  }
  /* Todas las jugadas de `t` sobre `oc`, con su valor. */
  function evalua(oc, t, y0, e) {
    return colocaciones(oc, t, y0).map(q => {
      const c = coloca(oc, t, q.r, q.x, q.y);
      return { r: q.r, x: q.x, y: q.y, b: c.b, n: c.n, p: c.arriba ? -1e9 : bono(c.n, e) + valora(c.b, e) };
    });
  }
  const alturaMax = oc => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (oc[y * W + x]) return H - y; return 0; };
  /* Arma o sobrevive, con histéresis: deja de armar pasando el umbral (o
     con mucha basura encima) y vuelve tres filas más abajo. */
  function estrategia(b, s, oc) {
    const pf = b.perfil, alto = alturaMax(oc), pend = TM.pendiente(s);
    b.alto = alto;
    if (!pf.ambicion) b.arma = false;
    else if (b.arma) { if (alto > pf.umbral || alto + pend > pf.umbral + 3) b.arma = false; }
    else if (alto <= pf.umbral - 3 && alto + pend <= pf.umbral) b.arma = true;
    return { pozo: b.arma ? b.pozo : -1, ambicion: pf.ambicion, umbral: pf.umbral };
  }
  const ordena = ops => ops.map((o, i) => [o, i]).sort((a, c) => c[0].p - a[0].p || a[1] - c[1]).map(a => a[0]);
  /* Elige la jugada de la pieza nueva (y si guardarla). */
  function decide(b, s) {
    const pf = b.perfil, oc = ocupacion(s), e = estrategia(b, s, oc);
    let ops = evalua(oc, s.p.t, s.p.y, e).map(o => Object.assign(o, { g: false }));
    if (pf.guarda && s.puedeGuardar) {
      const otra = s.guardada || s.cola[0];
      if (otra && otra !== s.p.t) ops = ops.concat(evalua(oc, otra, nacer(oc, otra), e).map(o => Object.assign(o, { g: true })));
    }
    if (!ops.length) return null;
    ops = ordena(ops);
    /* Mirar la pieza siguiente con las mejores: el valor pasa a ser lo que
       limpia esta más lo mejor que deja la siguiente. */
    if (pf.mira) {
      const k = Math.min(pf.mira, ops.length), top = ops.slice(0, k);
      for (const o of top) {
        if (o.p <= -1e8) continue;
        const sig = o.g ? (s.guardada ? s.cola[0] : s.cola[1]) : s.cola[0];
        let mejor = -1e9;
        if (sig) for (const q of evalua(o.b, sig, nacer(o.b, sig), e)) if (q.p > mejor) mejor = q.p;
        o.p = bono(o.n, e) + (mejor <= -1e8 ? valora(o.b, e) - 5000 : mejor);
      }
      ops = ordena(top).concat(ops.slice(k));
    }
    /* Con la pila arriba se apura y se equivoca el doble. */
    const pan = b.alto > 13 ? 2 : 1;
    const tira = milesima(b.rng);
    if (pf.torpe && tira < pf.torpe * pan) return ops[Math.floor(b.rng() * ops.length)];
    if (pf.duda && tira < (pf.torpe + pf.duda) * pan) return ops[Math.floor(b.rng() * Math.min(pf.top, ops.length))];
    return ops[0];
  }
  function crearBot(dif, semilla) {
    const b = { perfil: PERFIL[dif], rng: TM.rng(semilla), piezas: -1, plan: null, metas: [], espera: 0, guardo: false,
      suave: false, susto: 0, arma: true, alto: 0, pozo: 0, foco: 0 };
    /* Su columna para el Tetris: un borde, el que le toque. */
    b.pozo = b.rng() < 0.5 ? 0 : W - 1;
    return b;
  }
  /* Arma lo que va a hacer la mano con la jugada elegida: una lista de
     metas {r, x, pausa} (girar y mover hasta ahí, esperar `pausa`), y al
     final soltar (de golpe o con el blando). Aquí entran los errores. */
  function planifica(b, s, op) {
    const pf = b.perfil, pan = b.alto > 13 ? 2 : 1, metas = [];
    const t = op.g ? (s.guardada || s.cola[0]) : s.p.t;
    let fin = op.x;
    if (t !== "O" && milesima(b.rng) < pf.sobregiro) metas.push({ r: (op.r + (b.rng() < 0.5 ? 1 : 3)) % 4, x: null, pausa: entre(b.rng, 3, 10) });
    if (milesima(b.rng) < pf.desvio * pan) {
      const dx = b.rng() < 0.5 ? -1 : 1, oc = ocupacion(s);
      let x2 = op.x + dx;
      if (!cabeOc(oc, t, op.r, x2, op.y)) x2 = op.x - dx;
      if (cabeOc(oc, t, op.r, x2, op.y)) {
        if (milesima(b.rng) < pf.corrige) metas.push({ r: op.r, x: x2, pausa: entre(b.rng, 8, 26) });
        else fin = x2;
      }
    }
    metas.push({ r: op.r, x: fin, pausa: 0 });
    b.metas = metas;
    b.suave = milesima(b.rng) < pf.blando;
  }
  /* Un paso del bot. */
  function pasoBot(b, s) {
    if (s.fin || !s.p) return;
    const pf = b.perfil;
    const g = Math.floor(TM.gravedad(s.nivel) / PASO);
    if (b.piezas !== s.piezas) {
      b.piezas = s.piezas;
      s.blando = false;
      b.guardo = false;
      b.plan = decide(b, s);
      if (b.plan) planifica(b, s, b.plan); else b.metas = [];
      let piensa = entre(b.rng, pf.piensa[0], pf.piensa[1]);
      if (b.alto > 13) piensa = Math.floor(piensa * 2 / 3);
      /* Distraerse solo cuando la pieza cae despacio: a nivel alto nadie
         se queda mirando. */
      if (g >= 40 && milesima(b.rng) < pf.distrae) piensa += entre(b.rng, 40, 110);
      piensa += b.susto; b.susto = 0;
      b.espera = Math.max(pf.rapido[0], Math.min(piensa, 3 * g));
    }
    if (b.espera > 0) { b.espera--; return; }
    const accion = () => { b.espera = Math.max(pf.rapido[1], Math.min(entre(b.rng, pf.cada[0], pf.cada[1]), g)); };
    const pl = b.plan;
    if (!pl) { TM.caer(s); return; }
    if (pl.g && !b.guardo) {
      b.guardo = true;
      if (!TM.guardar(s)) pl.g = false;
      accion();
      return;
    }
    const meta = b.metas[0];
    if (meta) {
      if (s.p.r !== meta.r) {
        const dir = ((meta.r - s.p.r + 4) % 4) === 3 ? -1 : 1;
        if (!TM.rotar(s, dir)) meta.r = s.p.r;
        accion();
        return;
      }
      if (meta.x !== null && s.p.x !== meta.x) {
        if (!TM.mover(s, meta.x < s.p.x ? -1 : 1)) meta.x = s.p.x;
        accion();
        return;
      }
      b.metas.shift();
      if (meta.pausa) b.espera = meta.pausa; else accion();
      return;
    }
    if (b.suave) { s.blando = true; return; }
    TM.caer(s);
  }

  /* ---------- la partida: cuatro pozos a la vez ---------- */
  /* `pozos[0]` es el tuyo; 1–3, los bots. `objetivo[i]` es a quién ataca
     cada uno. `ataques` ({de, a, n}), `caidas` (i), `cambios` ({de, a}:
     alguien cambió de objetivo) y `kos` ({de, a}) se acumulan para el
     dibujo, que los vacía cuando quiere: no deciden nada. */
  function mundo(cuenta, sal, dif) {
    const base = TM.semillaDe(cuenta, sal);
    const pozos = [], bots = [null];
    for (let i = 0; i <= RIVALES; i++) pozos.push(TM.crear({ semilla: semillaPozo(base, i), nivel: 1, subeCada: SUBE_CADA, soloTiempo: true }));
    for (let i = 1; i <= RIVALES; i++) bots.push(crearBot(dif, (base ^ Math.imul(i, 0x27d4eb2d) ^ 0x51ed270b) >>> 0));
    const rt = TM.rng((base ^ 0x5bd1e995) >>> 0);
    const pf = PERFIL[dif];
    const vivo = j => m.fuera[j] < 0 && !pozos[j].fin;
    const alto = j => alturaMax(pozos[j].pozo.map(c => c ? 1 : 0));
    /* A quién apunta un bot: cualquiera vivo, con más peso el que está más
       alto (rematar, según `remata`), y menos el que ya tenía (cambiar de
       aires). */
    function elige(i) {
      const ops = [];
      let suma = 0;
      for (let j = 0; j <= RIVALES; j++) {
        if (j === i || !vivo(j)) continue;
        let w = 10 + (alto(j) * pf.remata >> 1);
        if (j === m.objetivo[i]) w = w >> 1;
        ops.push([j, w]); suma += w;
      }
      if (!ops.length) return;
      let t = Math.floor(rt() * suma);
      for (const [j, w] of ops) { if (t < w) { m.apunta(i, j); return; } t -= w; }
    }
    const m = {
      pozos, bots, k: 0, fuera: pozos.map(() => -1), enviadas: pozos.map(() => 0), ataques: [], caidas: [], cambios: [], kos: [],
      objetivo: pozos.map(() => -1), desde: pozos.map(() => -FIRME_PASOS), golpe: pozos.map(() => -1), golpeK: pozos.map(() => -1), ko: pozos.map(() => 0), verdugo: pozos.map(() => -1),
      vivos: () => pozos.map((p, i) => i).filter(i => m.fuera[i] < 0),
      /* `i` pasa a atacar a `j`. Falso si no cambia nada. */
      apunta(i, j) {
        if (!(j >= 0 && j <= RIVALES) || j === i || !vivo(j) || m.objetivo[i] === j) return false;
        m.objetivo[i] = j; m.desde[i] = m.k; m.cambios.push({ de: i, a: j });
        return true;
      },
      /* El siguiente vivo después del objetivo actual (la tecla de objetivo). */
      cicla(i) {
        for (let d = 1; d <= RIVALES; d++) {
          const j = ((m.objetivo[i] < 0 ? i : m.objetivo[i]) + d) % (RIVALES + 1);
          if (j !== i && vivo(j)) return m.apunta(i, j);
        }
        return false;
      },
      paso() {
        for (let i = 1; i <= RIVALES; i++) if (m.fuera[i] < 0) pasoBot(bots[i], pozos[i]);
        for (let i = 0; i <= RIVALES; i++) if (m.fuera[i] < 0) TM.avanza(pozos[i], PASO);
        /* Objetivos caídos y bots que se replantean. */
        for (let i = 0; i <= RIVALES; i++) {
          if (!vivo(i)) continue;
          const o = m.objetivo[i];
          if (o < 0 || !vivo(o)) { if (i) elige(i); else m.cicla(0); }
          else if (i && --bots[i].foco <= 0) { elige(i); bots[i].foco = entre(rt, pf.foco[0], pf.foco[1]); }
        }
        /* La basura: de cada pozo que limpió, a su objetivo. */
        for (let i = 0; i <= RIVALES; i++) {
          const s = pozos[i];
          if (s.salida <= 0) continue;
          const n = Math.min(ATAQUE_MAX, s.salida);
          s.salida = 0;
          if (s.fin) continue;
          const a = m.objetivo[i];
          if (a < 0 || !vivo(a)) continue;
          TM.recibe(pozos[a], n);
          m.enviadas[i] += n;
          m.golpe[a] = i; m.golpeK[a] = m.k;
          m.ataques.push({ de: i, a, n });
          if (a > 0) {
            bots[a].susto += entre(rt, 5, 18);
            if (m.objetivo[a] !== i && m.k - m.desde[a] >= FIRME_PASOS && milesima(rt) < pf.venganza) m.apunta(a, i);
          }
        }
        for (let i = 0; i <= RIVALES; i++) {
          if (i) pozos[i].eventos.length = 0;
          if (m.fuera[i] < 0 && pozos[i].fin) {
            m.fuera[i] = m.k; m.caidas.push(i);
            const v = m.golpe[i];
            if (v >= 0 && v !== i && m.k - m.golpeK[i] <= KO_PASOS) { m.verdugo[i] = v; m.ko[v]++; m.kos.push({ de: v, a: i }); }
          }
        }
        m.k++;
        return terminada(m);
      }
    };
    /* Al empezar: tú, al primero; cada bot, a quien le toque. */
    m.apunta(0, 1);
    for (let i = 1; i <= RIVALES; i++) { elige(i); bots[i].foco = entre(rt, pf.foco[0], pf.foco[1]); }
    m.cambios.length = 0;
    return m;
  }

  /* Lo mismo que `TM.grabadora`, con el mundo entero: `pide(a)` deja una
     acción tuya para el próximo paso, `paso(blando)` la aplica, avanza los
     cuatro pozos y dice si terminó, `prueba(extra)` es lo que viaja con el
     resultado. Además de las del motor, las acciones de objetivo:
     «objetivo» (el siguiente vivo, O) y «apunta1–3» (P, Q, R). */
  const PRUEBA_V = 2;
  const LETRA = { izq: "I", der: "D", gira: "G", contragira: "A", caer: "C", guarda: "H", objetivo: "O", apunta1: "P", apunta2: "Q", apunta3: "R" };
  const DE_LETRA = { I: "izq", D: "der", G: "gira", A: "contragira", C: "caer", H: "guarda", O: "objetivo", P: "apunta1", Q: "apunta2", R: "apunta3" };
  /* Aplica una acción de la persona al mundo: true si cambió algo. */
  function actua(m, a) {
    const s = m.pozos[0];
    if (s.fin) return false;
    if (a === "objetivo") return m.cicla(0);
    if (a === "apunta1" || a === "apunta2" || a === "apunta3") return m.apunta(0, +a.slice(-1));
    return TM.accion(s, a);
  }
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
          if (!actua(m, a)) continue;
          anota(LETRA[a]);
          if (op.alJugar) op.alJugar(a);
        }
        if (!!bl !== blando) { blando = !!bl; anota(blando ? "B" : "S"); }
        s.blando = blando;
        return m.paso();
      },
      prueba(extra) { return Object.assign({ v: PRUEBA_V, m: "bots", d: dif, u: cuenta, a: sal, n: m.k, e: txt }, extra || {}); }
    };
  }
  /* «3G12IC…» → [[paso, letra], …], con las letras de cada versión. */
  function leeJugadas(e, n, letras) {
    if (typeof e !== "string" || !new RegExp(`^(?:[0-9a-z]*[${letras}])*$`).test(e)) return null;
    const r = [];
    let k = 0;
    for (const [, d, l] of e.matchAll(new RegExp(`([0-9a-z]*)([${letras}])`, "g"))) {
      if (d.length > 7) return null;
      k += d ? parseInt(d, 36) : 0;
      if (k >= n) return null;
      r.push([k, l]);
    }
    return r;
  }
  /* Rehace una partida VS Bots desde su prueba, con las mismas reglas que
     `TM.rehace` (una jugada anotada que no hace nada, un blando doble o una
     partida que sigue tras terminar delatan una prueba tocada) y los bots
     jugando de nuevo: los de la versión 1 para una prueba `v:1` (los récords
     de antes), los de ahora para una `v:2`. Devuelve lo de `TM.rehace` más
     `derrotados`. */
  function rehace(p, tope) {
    if (!p || typeof p !== "object" || (p.v !== 1 && p.v !== PRUEBA_V)) return { error: "La prueba no es de esta versión del juego." };
    if (p.m !== "bots" || !DIFS.includes(p.d)) return { error: "La prueba no dice la dificultad de los bots." };
    if (typeof p.u !== "string" || !p.u || p.u.length > 128 || !Number.isSafeInteger(p.a) || p.a < 0 || p.a > 0xffffffff)
      return { error: "La prueba no trae su semilla." };
    const n = p.n;
    if (!Number.isSafeInteger(n) || n < 1 || n > (tope || 180000)) return { error: "La duración de la partida no es válida." };
    const v1 = p.v === 1;
    const jug = v1 ? TM.leeJugadas(p.e, n) : leeJugadas(p.e, n, "IDGACHBSOPQR");
    if (!jug) return { error: "Las jugadas de la prueba no se pueden leer." };
    const m = v1 ? mundoV1(p.u, p.a, p.d) : mundo(p.u, p.a, p.d), s = m.pozos[0];
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
        if (v1 ? s.fin || !TM.accion(s, DE_LETRA[l]) : !actua(m, DE_LETRA[l])) return { error: "La prueba trae una jugada que no se puede hacer." };
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

  return { RIVALES, SUBE_CADA, ATAQUE_MAX, DIFS, NOMBRE_DIF, NOMBRES, PERFIL, PRUEBA_V, mundo, mundoV1, terminada, derrotados, grabadora, rehace,
    pasoBot, crearBot, decide, pasoBotV1, crearBotV1, decideV1, actua };
});
